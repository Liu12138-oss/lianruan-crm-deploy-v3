import {
  type 微盾收益范围,
  type 微盾收益计算结果,
  type 微盾硬件收益明细,
  type 微盾软件收益明细,
  计算微盾报价收益,
} from "@lianruan/shared";
import type { Pool } from "pg";

type 查询执行器 = Pick<Pool, "query">;

interface 收益明细行 {
  itemName: string;
  productRefType: string;
  productRefId: string | null;
  itemTypeCode: string;
  quantity: string;
  unitPrice: string;
  lineAmount: string;
  hardwareCode: string | null;
  hardwareScopeCode: 微盾收益范围;
  featureListPrice: string | null;
  categoryScopeCode: 微盾收益范围;
}

interface 收益口径 {
  productContractAmount: string;
  serviceContractAmount: string;
  warrantyYears: number;
  procurementMaintenanceYears: number;
}

/** 以订单最终总价为收入输入计算收益；区管调价时优先使用已固化的产品/服务合同额。 */
export async function 计算订单收益表(
  执行器: 查询执行器,
  quoteId: string,
  订单总额: string,
  年数: { warrantyYears: number; procurementMaintenanceYears: number },
  时点: string,
): Promise<微盾收益计算结果> {
  const [调价结果, 明细] = await Promise.all([
    执行器.query<{
      product_contract_amount: string | null;
      service_contract_amount: string | null;
      warranty_years: number | null;
      procurement_maintenance_years: number | null;
    }>(
      `SELECT extra_json->'priceAdjustment'->>'productContractAmount' AS product_contract_amount,
              extra_json->'priceAdjustment'->>'serviceContractAmount' AS service_contract_amount,
              NULLIF(extra_json->'priceAdjustment'->>'warrantyYears','')::integer AS warranty_years,
              NULLIF(extra_json->'priceAdjustment'->>'procurementMaintenanceYears','')::integer AS procurement_maintenance_years
       FROM crm.quotes WHERE id::text=$1 OR quote_no=$1 OR v2_source_id=$1 LIMIT 1`,
      [quoteId],
    ),
    读取明细(执行器, quoteId),
  ]);
  const 调价行 = 调价结果.rows[0];
  const 调价口径: 收益口径 | null = 调价行?.product_contract_amount
    ? {
        productContractAmount: 调价行.product_contract_amount,
        serviceContractAmount: 调价行.service_contract_amount || "0",
        warrantyYears: 调价行.warranty_years ?? 年数.warrantyYears,
        procurementMaintenanceYears:
          调价行.procurement_maintenance_years ?? 年数.procurementMaintenanceYears,
      }
    : null;

  const 软件明细: 微盾软件收益明细[] = [];
  const 硬件明细: 微盾硬件收益明细[] = [];
  let 服务金额 = 0;
  let 软件公开金额 = 0;
  let 硬件金额 = 0;
  let 未知分类 = false;
  for (const 行 of 明细) {
    if (行.itemTypeCode === "service") {
      服务金额 += Number(行.lineAmount) || 0;
      continue;
    }
    if (行.itemTypeCode === "hardware") {
      const 成本 = await 读取硬件成本(执行器, 行.productRefId, 时点);
      硬件金额 += Number(行.lineAmount) || 0;
      硬件明细.push({
        productId: 行.hardwareCode || 行.productRefId || 行.itemName,
        quantity: 规范硬件数量文本(行.quantity),
        quoteUnitPrice: 金额(行.unitPrice),
        ...(成本.internalSaleCost ? { internalSaleCost: 金额(成本.internalSaleCost) } : {}),
        annualWarrantyMaintenanceCost: 成本.annualWarrantyMaintenanceCost
          ? 金额(成本.annualWarrantyMaintenanceCost)
          : null,
        scopeCode: 行.hardwareScopeCode,
      });
      continue;
    }
    if (行.itemTypeCode === "software") {
      软件公开金额 += (Number(行.featureListPrice) || 0) * (Number(行.quantity) || 1);
      continue;
    }
    未知分类 = true;
  }

  const 服务合同额 = 调价口径?.serviceContractAmount ?? 服务金额.toFixed(6);
  if (调价口径) {
    软件明细.push({
      id: "订单软件汇总",
      quantity: "1",
      discountedUnitPrice: "0",
      publicUnitPrice: 软件公开金额.toFixed(6),
      scopeCode: 未知分类 ? "unclassified" : "weidun",
    });
  } else {
    const 软件折后金额 =
      Math.round((Number(订单总额) - 硬件金额 - 服务金额) * 1_000_000) / 1_000_000;
    if (软件折后金额 < 0) {
      return 计算微盾报价收益({
        scopeCode: "unclassified",
        softwareItems: [],
        hardwareItems: 硬件明细,
        serviceContractAmount: 服务金额.toFixed(6),
        warrantyYears: 年数.warrantyYears,
        procurementMaintenanceYears: 年数.procurementMaintenanceYears,
      });
    }
    if (软件折后金额 > 0 || 软件公开金额 > 0) {
      软件明细.push({
        id: "订单软件汇总",
        quantity: "1",
        discountedUnitPrice: 软件折后金额.toFixed(6),
        publicUnitPrice: 软件公开金额.toFixed(6),
        scopeCode: 未知分类 ? "unclassified" : "weidun",
      });
    }
  }

  return 计算微盾报价收益({
    scopeCode: 未知分类 ? "unclassified" : "weidun",
    softwareItems: 软件明细,
    hardwareItems: 硬件明细,
    ...(调价口径 ? { productContractAmount: 调价口径.productContractAmount } : {}),
    serviceContractAmount: 服务合同额,
    warrantyYears: 调价口径?.warrantyYears ?? 年数.warrantyYears,
    procurementMaintenanceYears:
      调价口径?.procurementMaintenanceYears ?? 年数.procurementMaintenanceYears,
  });
}

async function 读取明细(执行器: 查询执行器, quoteId: string): Promise<收益明细行[]> {
  const 结果 = await 执行器.query<Record<string, unknown>>(
    `SELECT qi.item_name AS "itemName",qi.product_ref_type AS "productRefType",
            qi.product_ref_id::text AS "productRefId",qi.item_type_code AS "itemTypeCode",
            qi.quantity::text AS quantity,qi.unit_price::text AS "unitPrice",qi.line_amount::text AS "lineAmount",
            h.hardware_code AS "hardwareCode",COALESCE(h.profit_scope_code,'unclassified') AS "hardwareScopeCode",
            f.list_price::text AS "featureListPrice",
            COALESCE(c.profit_scope_code,'unclassified') AS "categoryScopeCode"
     FROM crm.quote_items qi
     LEFT JOIN catalog.hardware_products h ON qi.product_ref_type='hardware' AND h.id=qi.product_ref_id
     LEFT JOIN catalog.product_features f ON qi.product_ref_type='feature' AND f.id=qi.product_ref_id
     LEFT JOIN catalog.product_modules m ON m.id=f.module_id
     LEFT JOIN catalog.product_categories c ON c.id=m.category_id
     WHERE qi.quote_id=$1::uuid ORDER BY qi.sort_order,qi.id`,
    [quoteId],
  );
  return 结果.rows.map((行) => ({
    itemName: String(行.itemName || ""),
    productRefType: String(行.productRefType || "manual"),
    productRefId: 行.productRefId ? String(行.productRefId) : null,
    itemTypeCode: String(行.itemTypeCode || "unknown"),
    quantity: String(行.quantity || "1"),
    unitPrice: String(行.unitPrice || "0"),
    lineAmount: String(行.lineAmount || "0"),
    hardwareCode: 行.hardwareCode ? String(行.hardwareCode) : null,
    hardwareScopeCode: (行.hardwareScopeCode as 微盾收益范围) || "unclassified",
    featureListPrice: 行.featureListPrice ? String(行.featureListPrice) : null,
    categoryScopeCode: (行.categoryScopeCode as 微盾收益范围) || "unclassified",
  }));
}

async function 读取硬件成本(
  执行器: 查询执行器,
  hardwareProductId: string | null,
  时点: string,
): Promise<{ internalSaleCost: string | null; annualWarrantyMaintenanceCost: string | null }> {
  if (!hardwareProductId) return { internalSaleCost: null, annualWarrantyMaintenanceCost: null };
  const 结果 = await 执行器.query<{
    internal_sale_cost: string;
    annual_warranty_maintenance_cost: string | null;
  }>(
    `SELECT internal_sale_cost::text AS internal_sale_cost,
            annual_warranty_maintenance_cost::text AS annual_warranty_maintenance_cost
     FROM catalog.hardware_profit_cost_rules
     WHERE hardware_product_id=$1::uuid AND status_code='active'
       AND effective_from <= $2::timestamptz AND (effective_to IS NULL OR effective_to > $2::timestamptz)
     ORDER BY version_no DESC LIMIT 1`,
    [hardwareProductId, 时点],
  );
  return {
    internalSaleCost: 结果.rows[0]?.internal_sale_cost || null,
    annualWarrantyMaintenanceCost: 结果.rows[0]?.annual_warranty_maintenance_cost || null,
  };
}

function 金额(值: string): string {
  const 数值 = Number(值);
  return Number.isFinite(数值) ? 数值.toFixed(6) : "0.000000";
}

function 规范硬件数量文本(值: string): string {
  const 数值 = Number(值);
  if (!Number.isFinite(数值) || 数值 <= 0) return "1";
  return Math.trunc(数值) === 数值 ? String(Math.trunc(数值)) : String(数值);
}
