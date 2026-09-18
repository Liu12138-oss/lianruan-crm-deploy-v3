import type { 应用配置 } from "@lianruan/config";
import {
  type 微盾收益范围,
  type 微盾硬件收益明细,
  type 微盾软件收益明细,
  计算微盾报价收益,
} from "@lianruan/shared";
import { Pool } from "pg";

interface 已领取事件 {
  eventId: string;
  eventType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  retryCount: number;
  leaseToken: string;
}

interface 收益明细 {
  itemName: string;
  productRefType: string;
  productRefId: string | null;
  itemTypeCode: string;
  quantity: string;
  unitPrice: string;
  lineAmount: string;
  hardwareCode: string | null;
  hardwareScopeCode: 微盾收益范围;
  featureCode: string | null;
  featureListPrice: string | null;
  categoryScopeCode: 微盾收益范围;
}

export class 报价收益任务存储 {
  private readonly pool: Pool;

  public constructor(private readonly config: 应用配置) {
    if (!config.database.url) throw new Error("报价收益任务进程启动失败：未配置 DATABASE_URL。");
    this.pool = new Pool({ connectionString: config.database.url, max: 3 });
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }

  public async 处理下一事件(): Promise<boolean> {
    const 事件 = await this.领取事件();
    if (!事件) return false;
    try {
      if (事件.eventType === "crm.quote.profit.freeze.requested") await this.处理冻结事件(事件);
      else await this.处理成本规则变更(事件);
      await this.完成事件(事件);
    } catch (错误) {
      await this.记录失败(事件, 错误);
    }
    return true;
  }

  private async 领取事件(): Promise<已领取事件 | null> {
    const db = await this.pool.connect();
    try {
      await db.query("BEGIN");
      const 结果 = await db.query<{
        id: string;
        event_type: string;
        aggregate_id: string;
        payload_json: Record<string, unknown>;
        retry_count: number;
        lease_token: string;
      }>(
        `WITH candidate AS (
           SELECT id
           FROM ops.outbox_events
           WHERE event_type IN ('crm.quote.profit.freeze.requested','crm.quote.profit.cost_rule.changed')
             AND created_at >= $1::timestamptz
             AND (
               status_code='pending'
               OR (status_code='failed' AND next_retry_at IS NOT NULL AND next_retry_at <= now())
               OR (status_code='processing' AND next_retry_at IS NOT NULL AND next_retry_at <= now())
             )
           ORDER BY created_at,id
           FOR UPDATE SKIP LOCKED
           LIMIT 1
         )
         UPDATE ops.outbox_events event
         SET status_code='processing',next_retry_at=now()+interval '5 minutes',
             payload_json=event.payload_json || jsonb_build_object('leaseToken',gen_random_uuid()::text)
         FROM candidate
         WHERE event.id=candidate.id
         RETURNING event.id::text AS id,event.event_type,event.aggregate_id::text AS aggregate_id,
                   event.payload_json,event.retry_count,event.payload_json->>'leaseToken' AS lease_token`,
        [this.config.quoteProfit.eventCutoverAt || new Date().toISOString()],
      );
      await db.query("COMMIT");
      const 行 = 结果.rows[0];
      return 行
        ? {
            eventId: 行.id,
            eventType: 行.event_type,
            aggregateId: 行.aggregate_id,
            payload: 行.payload_json || {},
            retryCount: 行.retry_count,
            leaseToken: 行.lease_token,
          }
        : null;
    } catch (错误) {
      await db.query("ROLLBACK");
      throw 错误;
    } finally {
      db.release();
    }
  }

  private async 处理冻结事件(事件: 已领取事件): Promise<void> {
    const quoteId = 读取文本(事件.payload, "quoteId") || 事件.aggregateId;
    const orderId = 读取文本(事件.payload, "orderId");
    const confirmedAt = 读取文本(事件.payload, "confirmedAt") || new Date().toISOString();
    const 订单 = await this.读取订单(this.pool, orderId, quoteId);
    if (!订单) throw new Error("报价收益事件对应的订单或报价不存在。");
    const 已有正式快照 = await this.读取冻结记录(
      this.pool,
      订单.quoteId,
      订单.approvalRound,
      订单.revisionNo,
    );
    if (已有正式快照) return;
    const 年数 = await this.读取草稿年限(this.pool, 订单.quoteId);
    const 计算结果 = await this.计算订单收益(this.pool, 订单, confirmedAt, 年数);
    const 状态 = 计算结果.statusCode === "complete" ? "frozen" : 计算结果.statusCode;
    if (状态 === "not_applicable") {
      await this.保存计算结果(this.pool, 订单, 计算结果, "not_applicable", confirmedAt, null);
      return;
    }
    if (状态 === "incomplete") {
      await this.保存计算结果(this.pool, 订单, 计算结果, "incomplete", confirmedAt, null);
      return;
    }
    await this.保存计算结果(this.pool, 订单, 计算结果, "frozen", confirmedAt, null);
  }

  private async 处理成本规则变更(事件: 已领取事件): Promise<void> {
    const 硬件编号 = 读取文本(事件.payload, "hardwareProductId") || 事件.aggregateId;
    const 候选 = await this.pool.query<{
      order_id: string;
      quote_id: string;
      confirmed_at: string;
      approval_round: number;
      revision_no: number;
    }>(
      `SELECT DISTINCT ON (o.id)
          o.id::text AS order_id,q.id::text AS quote_id,
          COALESCE(h.changed_at,o.updated_at) AS confirmed_at,
          COALESCE((SELECT MAX(request.approval_round) FROM integration.order_preapproval_requests request WHERE request.order_id=o.id),1) AS approval_round,
          COALESCE(o.revision_no,0) AS revision_no
       FROM crm.quote_profit_calculations p
       JOIN crm.quotes q ON q.id=p.quote_id
       JOIN crm.orders o ON o.quote_id=q.id
       LEFT JOIN crm.order_status_history h ON h.order_id=o.id AND h.to_status_code='confirmed'
       JOIN crm.quote_items qi ON qi.quote_id=q.id AND qi.product_ref_id=$1::uuid
       WHERE p.status_code='incomplete'
         AND o.status_code IN ('confirmed','processing','shipped','completed')
       ORDER BY o.id,COALESCE(h.changed_at,o.updated_at) DESC`,
      [硬件编号],
    );
    for (const 行 of 候选.rows) {
      await this.pool.query(
        `INSERT INTO ops.outbox_events(event_type,aggregate_type,aggregate_id,payload_json)
         SELECT 'crm.quote.profit.freeze.requested','quote',$1::uuid,$2::jsonb
         WHERE NOT EXISTS (
           SELECT 1 FROM ops.outbox_events
           WHERE event_type='crm.quote.profit.freeze.requested'
             AND aggregate_id=$1::uuid
             AND status_code IN ('pending','processing','failed')
         )`,
        [
          行.quote_id,
          JSON.stringify({
            quoteId: 行.quote_id,
            orderId: 行.order_id,
            orderRowVersion: 0,
            approvalRound: 行.approval_round,
            orderRevisionNo: 行.revision_no,
            confirmedAt: 行.confirmed_at,
            eventCode: "profit_freeze_requested",
            formulaVersion: "weidun-v1",
          }),
        ],
      );
    }
  }

  private async 读取订单(
    执行器: { query: Pool["query"] },
    orderId: string,
    quoteId: string,
  ): Promise<{
    orderId: string;
    quoteId: string;
    regionId: string | null;
    totalAmount: string;
    approvalRound: number;
    revisionNo: number;
    orderStatus: string;
  } | null> {
    const 结果 = await 执行器.query<{
      order_id: string;
      quote_id: string;
      region_id: string | null;
      total_amount: string;
      approval_round: number;
      revision_no: number;
      status_code: string;
    }>(
      `SELECT o.id::text AS order_id,q.id::text AS quote_id,q.region_id::text AS region_id,
              o.total_amount::text AS total_amount,
              COALESCE((SELECT MAX(request.approval_round) FROM integration.order_preapproval_requests request WHERE request.order_id=o.id),1) AS approval_round,
              COALESCE(o.revision_no,0) AS revision_no,o.status_code
       FROM crm.orders o JOIN crm.quotes q ON q.id=o.quote_id
       WHERE ($1 <> '' AND o.id::text=$1) OR ($1 = '' AND q.id::text=$2)
       ORDER BY o.created_at DESC LIMIT 1`,
      [orderId, quoteId],
    );
    const 行 = 结果.rows[0];
    return 行
      ? {
          orderId: 行.order_id,
          quoteId: 行.quote_id,
          regionId: 行.region_id,
          totalAmount: 行.total_amount,
          approvalRound: 行.approval_round,
          revisionNo: 行.revision_no,
          orderStatus: 行.status_code,
        }
      : null;
  }

  private async 读取明细(执行器: { query: Pool["query"] }, quoteId: string): Promise<收益明细[]> {
    const 结果 = await 执行器.query<Record<string, unknown>>(
      `SELECT qi.item_name AS "itemName",qi.product_ref_type AS "productRefType",
              qi.product_ref_id::text AS "productRefId",qi.item_type_code AS "itemTypeCode",
              qi.quantity::text AS quantity,qi.unit_price::text AS "unitPrice",qi.line_amount::text AS "lineAmount",
              h.hardware_code AS "hardwareCode",COALESCE(h.profit_scope_code,'unclassified') AS "hardwareScopeCode",
              f.feature_code AS "featureCode",f.list_price::text AS "featureListPrice",
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
      featureCode: 行.featureCode ? String(行.featureCode) : null,
      featureListPrice: 行.featureListPrice ? String(行.featureListPrice) : null,
      categoryScopeCode: (行.categoryScopeCode as 微盾收益范围) || "unclassified",
    }));
  }

  private async 读取草稿年限(
    执行器: { query: Pool["query"] },
    quoteId: string,
  ): Promise<{ warrantyYears: number; procurementMaintenanceYears: number }> {
    const 结果 = await 执行器.query<{
      warranty_years: number;
      procurement_maintenance_years: number;
    }>(
      `SELECT warranty_years,procurement_maintenance_years
       FROM crm.quote_profit_calculations
       WHERE quote_id=$1::uuid AND status_code IN ('draft','incomplete')
       ORDER BY calculation_version DESC LIMIT 1`,
      [quoteId],
    );
    return {
      warrantyYears: Number(结果.rows[0]?.warranty_years) || 3,
      procurementMaintenanceYears: Number(结果.rows[0]?.procurement_maintenance_years) || 0,
    };
  }

  private async 计算订单收益(
    执行器: { query: Pool["query"] },
    订单: {
      quoteId: string;
      totalAmount: string;
      approvalRound: number;
      revisionNo: number;
    },
    确认时间: string,
    年数: { warrantyYears: number; procurementMaintenanceYears: number },
  ) {
    const 明细 = await this.读取明细(执行器, 订单.quoteId);
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
        const 成本 = await this.读取成本(执行器, 行.productRefId, 确认时间);
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
    const 软件折后金额 =
      Math.round((Number(订单.totalAmount) - 硬件金额 - 服务金额) * 1_000_000) / 1_000_000;
    if (软件折后金额 < 0)
      return 计算微盾报价收益({
        scopeCode: "unclassified",
        softwareItems: [],
        hardwareItems: 硬件明细,
        serviceContractAmount: 服务金额.toFixed(6),
        warrantyYears: 年数.warrantyYears,
        procurementMaintenanceYears: 年数.procurementMaintenanceYears,
      });
    if (软件折后金额 > 0 || 软件公开金额 > 0) {
      软件明细.push({
        id: "订单软件汇总",
        quantity: "1",
        discountedUnitPrice: 软件折后金额.toFixed(6),
        publicUnitPrice: 软件公开金额.toFixed(6),
        scopeCode: 未知分类 ? "unclassified" : "weidun",
      });
    }
    const 范围 = 未知分类 ? "unclassified" : "weidun";
    return 计算微盾报价收益({
      scopeCode: 范围,
      softwareItems: 软件明细,
      hardwareItems: 硬件明细,
      serviceContractAmount: 服务金额.toFixed(6),
      warrantyYears: 年数.warrantyYears,
      procurementMaintenanceYears: 年数.procurementMaintenanceYears,
    });
  }

  private async 读取成本(
    执行器: { query: Pool["query"] },
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

  private async 读取冻结记录(
    执行器: { query: Pool["query"] },
    quoteId: string,
    approvalRound: number,
    revisionNo: number,
  ): Promise<boolean> {
    const 结果 = await 执行器.query(
      `SELECT 1 FROM crm.quote_profit_calculations
       WHERE quote_id=$1::uuid AND approval_round=$2 AND order_revision_no=$3
         AND formula_version='weidun-v1' AND status_code='frozen' LIMIT 1`,
      [quoteId, approvalRound, revisionNo],
    );
    return (结果.rowCount || 0) > 0;
  }

  private async 保存计算结果(
    pool: Pool,
    order: {
      orderId: string;
      quoteId: string;
      regionId: string | null;
      totalAmount: string;
      approvalRound: number;
      revisionNo: number;
    },
    result: ReturnType<typeof 计算微盾报价收益>,
    statusCode: "frozen" | "incomplete" | "not_applicable",
    confirmedAt: string,
    _operationId: string | null,
  ): Promise<void> {
    const db = await pool.connect();
    await db.query("BEGIN");
    try {
      const 报价 = await db.query<{ row_version: number }>(
        `SELECT row_version::int AS row_version FROM crm.quotes WHERE id=$1::uuid FOR UPDATE`,
        [order.quoteId],
      );
      const 版本 = await db.query<{ next_version: number }>(
        `SELECT COALESCE(MAX(calculation_version),0)+1 AS next_version
         FROM crm.quote_profit_calculations WHERE quote_id=$1::uuid`,
        [order.quoteId],
      );
      if (statusCode !== "frozen") {
        await db.query(
          `UPDATE crm.quote_profit_calculations SET status_code='void',updated_at=now(),row_version=row_version+1
           WHERE quote_id=$1::uuid AND status_code IN ('draft','incomplete','not_applicable')`,
          [order.quoteId],
        );
      }
      const 金额 = result.details;
      const 插入 = await db.query<{ id: string }>(
        `INSERT INTO crm.quote_profit_calculations (
           quote_id,order_id,region_id,status_code,calculation_version,formula_version,quote_row_version,
           approval_round,order_revision_no,warranty_years,procurement_maintenance_years,
           software_discounted_amount,software_public_amount,hardware_quote_amount,product_contract_amount,
           service_contract_amount,hardware_internal_cost,hardware_annual_warranty_cost,
           hardware_annual_maintenance_cost,product_tax_amount,service_tax_amount,warranty_cost,
           procurement_maintenance_cost,effective_contract_income,project_profit,
           missing_rules_json,input_snapshot_json,calculation_snapshot_json,input_hash,frozen_at
         ) VALUES (
           $1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8,$9,$10,$11,
           $12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26::jsonb,$27::jsonb,$28::jsonb,$29,
           CASE WHEN $4='frozen' THEN $30::timestamptz ELSE NULL END
         ) ON CONFLICT DO NOTHING RETURNING id::text AS id`,
        [
          order.quoteId,
          order.orderId,
          order.regionId,
          statusCode,
          版本.rows[0]?.next_version || 1,
          result.formulaVersion,
          Number(报价.rows[0]?.row_version || 0),
          order.approvalRound,
          order.revisionNo,
          result.warrantyYears,
          result.procurementMaintenanceYears,
          金额.softwareDiscountedAmount,
          金额.softwarePublicAmount,
          金额.hardwareQuoteAmount,
          金额.productContractAmount,
          金额.serviceContractAmount,
          金额.hardwareInternalCost,
          金额.hardwareAnnualWarrantyCost,
          金额.hardwareAnnualMaintenanceCost,
          金额.productTaxAmount,
          金额.serviceTaxAmount,
          金额.warrantyCost,
          金额.procurementMaintenanceCost,
          金额.effectiveContractIncome,
          金额.projectProfit,
          JSON.stringify(result.missingRules),
          JSON.stringify({ totalAmount: order.totalAmount }),
          JSON.stringify(result),
          result.inputHash,
          confirmedAt,
        ],
      );
      await db.query(
        `INSERT INTO audit.audit_logs(
           created_at,actor_username,actor_name,actor_role,module_code,action_code,target_type,target_id,result_code,after_json
         ) VALUES(now(),'system','报价收益任务','system','quote_profit',$1,'quote',$2,'success',$3::jsonb)`,
        [
          statusCode === "frozen" ? "frozen" : "freeze_incomplete",
          order.quoteId,
          JSON.stringify({ orderId: order.orderId, calculationId: 插入.rows[0]?.id, statusCode }),
        ],
      );
      await db.query("COMMIT");
    } catch (错误) {
      await db.query("ROLLBACK");
      throw 错误;
    } finally {
      db.release();
    }
  }

  private async 完成事件(事件: 已领取事件): Promise<void> {
    await this.pool.query(
      `UPDATE ops.outbox_events SET status_code='sent',next_retry_at=NULL
       WHERE id=$1::uuid AND status_code='processing' AND payload_json->>'leaseToken'=$2`,
      [事件.eventId, 事件.leaseToken],
    );
  }

  private async 记录失败(事件: 已领取事件, 错误: unknown): Promise<void> {
    const 可重试 = 事件.retryCount + 1 < this.config.quoteProfit.maxRetries;
    await this.pool.query(
      `UPDATE ops.outbox_events
       SET status_code=$2,retry_count=retry_count+1,
           next_retry_at=CASE WHEN $3::boolean THEN now()+make_interval(secs=>$4) ELSE NULL END,
           payload_json=payload_json || jsonb_build_object('lastError',$5::text,'lastFailedAt',now())
       WHERE id=$1::uuid AND status_code='processing' AND payload_json->>'leaseToken'=$6`,
      [
        事件.eventId,
        可重试 ? "failed" : "sent",
        可重试,
        Math.min(300, 2 ** Math.min(事件.retryCount + 1, 8)),
        错误 instanceof Error ? 错误.message.slice(0, 500) : "报价收益任务失败",
        事件.leaseToken,
      ],
    );
  }
}

function 读取文本(来源: Record<string, unknown>, key: string): string {
  const 值 = 来源[key];
  return typeof 值 === "string" ? 值.trim() : "";
}

function 金额(值: string | number | null | undefined): string {
  const 数字 = Number(值);
  return Number.isFinite(数字) ? 数字.toFixed(6) : "0.000000";
}

function 规范硬件数量文本(值: string): string {
  const 数字 = Number(值);
  if (!Number.isSafeInteger(数字) || 数字 < 1 || 数字 > 9_999) return 值;
  return String(数字);
}
