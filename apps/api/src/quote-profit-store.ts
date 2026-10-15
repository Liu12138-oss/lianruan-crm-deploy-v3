import {
  应用错误,
  type 微盾收益范围,
  type 微盾收益计算结果,
  type 微盾硬件收益明细,
  type 微盾软件收益明细,
  计算微盾报价收益,
} from "@lianruan/shared";
import { Pool, type PoolClient } from "pg";

type 查询执行器 = Pick<Pool, "query"> | Pick<PoolClient, "query">;

export interface 收益操作者 {
  userId: string;
  username: string;
  displayName: string;
  roleCodes: string[];
  regionIds: string[];
  superadmin: boolean;
}

export interface 收益计算响应 {
  quoteId: string;
  orderId: string | null;
  regionId: string | null;
  scopeCode: 微盾收益范围 | null;
  statusCode: "estimated" | "draft" | "incomplete" | "frozen" | "void" | "not_applicable";
  statusName: string;
  formulaVersion: string;
  warrantyYears: number;
  procurementMaintenanceYears: number;
  quoteRowVersion: number;
  calculationVersion: number | null;
  calculatedAt: string;
  frozenAt: string | null;
  inputHash: string | null;
  priceAdjustment: 报价基础["priceAdjustment"];
  inputLocked: boolean;
  summary: {
    productContractAmount: string | null;
    serviceContractAmount: string | null;
    effectiveContractIncome: string | null;
    projectProfit: string | null;
  };
  details: 微盾收益计算结果["details"];
  softwareLines: 微盾收益计算结果["softwareLines"];
  hardwareLines: 微盾收益计算结果["hardwareLines"];
  missingRules: 微盾收益计算结果["missingRules"];
}

export interface 收益数据服务 {
  读取收益(quoteId: string, username: string): Promise<收益计算响应>;
  保存草稿(quoteId: string, 输入: Record<string, unknown>, username: string): Promise<收益计算响应>;
  重算(quoteId: string, 输入: Record<string, unknown>, username: string): Promise<收益计算响应>;
  投递冻结(
    quoteId: string,
    输入: Record<string, unknown>,
    username: string,
  ): Promise<{
    quoteId: string;
    orderId: string;
    eventId: string;
    statusCode: "pending" | "frozen";
  }>;
  查询成本规则(
    filters: Record<string, unknown>,
    username: string,
  ): Promise<{ rules: Array<Record<string, unknown>> }>;
  创建成本规则(输入: Record<string, unknown>, username: string): Promise<Record<string, unknown>>;
  关闭(): Promise<void>;
}

interface 报价基础 {
  id: string;
  quoteNo: string;
  rowVersion: number;
  regionId: string | null;
  orderId: string | null;
  orderStatus: string | null;
  approvalRound: number;
  orderRevisionNo: number;
  priceAdjustment: {
    productContractAmount: string;
    serviceContractAmount: string;
    warrantyYears: number;
    procurementMaintenanceYears: number;
  } | null;
}

interface 报价明细行 {
  id: string;
  itemName: string;
  productRefType: "feature" | "hardware" | "package" | "manual";
  productRefId: string | null;
  quantity: string;
  unitPrice: string;
  lineAmount: string;
  itemTypeCode: "software" | "hardware" | "service" | "unknown";
  extraJson: Record<string, unknown>;
  hardwareCode: string | null;
  hardwareScopeCode: 微盾收益范围;
  hardwareListPrice: string | null;
  featureCode: string | null;
  featureListPrice: string | null;
  categoryCode: string | null;
  productTypeCode: string | null;
  categoryScopeCode: 微盾收益范围;
}

interface 计算输入 {
  softwareItems: 微盾软件收益明细[];
  hardwareItems: 微盾硬件收益明细[];
  serviceContractAmount: string;
  topScope: 微盾收益范围 | null;
}

interface 当前计算记录 {
  id: string;
  statusCode: "draft" | "incomplete" | "frozen" | "void" | "not_applicable";
  calculationVersion: number;
  quoteRowVersion: number;
  warrantyYears: number;
  procurementMaintenanceYears: number;
  formulaVersion: string;
  frozenAt: string | null;
  inputHash: string | null;
  details: Record<string, string | null>;
  softwareLines: unknown[];
  hardwareLines: unknown[];
  missingRules: unknown[];
}

const 状态名称: Record<收益计算响应["statusCode"], string> = {
  estimated: "实时预估",
  draft: "草稿",
  incomplete: "核算不完整",
  frozen: "正式快照",
  void: "已作废",
  not_applicable: "不适用",
};

export function 创建收益数据服务(databaseUrl: string): 收益数据服务 {
  return new QuoteProfitStore(databaseUrl);
}

export class QuoteProfitStore implements 收益数据服务 {
  private readonly pool: Pool;

  public constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl, max: 8 });
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }

  public async 关闭(): Promise<void> {
    await this.close();
  }

  public async 读取收益(quoteId: string, username: string): Promise<收益计算响应> {
    const 操作者 = await this.读取操作者(this.pool, username);
    const 报价 = await this.读取报价(this.pool, quoteId);
    await this.校验报价范围(this.pool, 报价, 操作者);
    const 现有 = await this.读取当前计算记录(this.pool, 报价.id);
    if (现有?.statusCode === "frozen") return this.组装存储响应(报价, 现有);
    const 计算结果 = await this.计算(
      this.pool,
      报价.id,
      现有?.warrantyYears ?? 3,
      现有?.procurementMaintenanceYears ?? 0,
      new Date(),
    );
    if (现有 && 现有.quoteRowVersion === 报价.rowVersion)
      return this.组装计算结果响应(报价, 计算结果, 现有);
    return this.组装计算结果响应(报价, 计算结果, null, "estimated");
  }

  public async 保存草稿(
    quoteId: string,
    输入: Record<string, unknown>,
    username: string,
  ): Promise<收益计算响应> {
    return this.保存新版本(quoteId, 输入, username);
  }

  public async 重算(
    quoteId: string,
    输入: Record<string, unknown>,
    username: string,
  ): Promise<收益计算响应> {
    return this.保存新版本(quoteId, 输入, username);
  }

  public async 投递冻结(
    quoteId: string,
    输入: Record<string, unknown>,
    username: string,
  ): Promise<{
    quoteId: string;
    orderId: string;
    eventId: string;
    statusCode: "pending" | "frozen";
  }> {
    const db = await this.pool.connect();
    try {
      await db.query("BEGIN");
      const 操作者 = await this.读取操作者(db, username);
      if (!操作者.superadmin)
        throw new 应用错误(
          "V3_QUOTE_PROFIT_ROLE_DENIED",
          "仅超级管理员可以投递正式收益冻结。",
          403,
        );
      const 报价 = await this.读取报价(db, quoteId, true);
      if (!报价.orderId)
        throw new 应用错误(
          "V3_QUOTE_PROFIT_ORDER_REQUIRED",
          "报价尚未转订单，不能冻结正式收益。",
          409,
        );
      if (!["confirmed", "processing", "shipped", "completed"].includes(报价.orderStatus || ""))
        throw new 应用错误(
          "V3_QUOTE_PROFIT_ORDER_STATE_INVALID",
          "当前订单状态不能冻结正式收益。",
          409,
        );
      const 已有 = await this.读取当前计算记录(db, 报价.id);
      if (已有?.statusCode === "frozen")
        return { quoteId: 报价.id, orderId: 报价.orderId, eventId: 已有.id, statusCode: "frozen" };
      const 年数 = this.读取年限输入(输入, 已有, 报价.priceAdjustment);
      const 计算结果 = await this.计算(
        db,
        报价.id,
        年数.warrantyYears,
        年数.procurementMaintenanceYears,
        new Date(),
      );
      if (计算结果.statusCode !== "complete")
        throw new 应用错误("V3_QUOTE_PROFIT_INCOMPLETE", "收益输入不完整，不能冻结正式收益。", 422);
      const 事件 = await db.query<{ id: string }>(
        `INSERT INTO ops.outbox_events (
           event_type, aggregate_type, aggregate_id, payload_json
         ) VALUES (
           'crm.quote.profit.freeze.requested', 'quote', $1::uuid, $2::jsonb
         ) RETURNING id::text AS id`,
        [
          报价.id,
          JSON.stringify({
            orderId: 报价.orderId,
            quoteId: 报价.id,
            orderRowVersion: 报价.rowVersion,
            approvalRound: 报价.approvalRound,
            orderRevisionNo: 报价.orderRevisionNo,
            formulaVersion: 计算结果.formulaVersion,
            eventCode: "profit_freeze_requested",
            confirmedAt: new Date().toISOString(),
          }),
        ],
      );
      await this.写入审计(db, 操作者, "freeze_requested", 报价.id, {
        orderId: 报价.orderId,
        eventId: 事件.rows[0]?.id,
      });
      await db.query("COMMIT");
      return {
        quoteId: 报价.id,
        orderId: 报价.orderId,
        eventId: 事件.rows[0]?.id || "",
        statusCode: "pending",
      };
    } catch (错误) {
      await db.query("ROLLBACK");
      throw 错误;
    } finally {
      db.release();
    }
  }

  public async 查询成本规则(
    filters: Record<string, unknown>,
    username: string,
  ): Promise<{ rules: Array<Record<string, unknown>> }> {
    const 操作者 = await this.读取操作者(this.pool, username);
    if (!操作者.superadmin)
      throw new 应用错误("V3_QUOTE_PROFIT_ROLE_DENIED", "仅超级管理员可以读取硬件成本规则。", 403);
    const 型号 = 读取文本(filters, ["hardwareProductId", "hardwareCode", "keyword"]);
    const 仅缺失 = filters.missingOnly === true || filters.missingOnly === "true";
    const 结果 = await this.pool.query<Record<string, unknown>>(
      `SELECT h.id::text AS "hardwareProductId",
              COALESCE(h.hardware_code, h.v2_source_id, h.id::text) AS "hardwareCode",
              h.hardware_name AS "hardwareName",
              COALESCE(history.rules, '[]'::jsonb) AS "history",
              current_rule.rule AS "currentRule"
       FROM catalog.hardware_products h
       LEFT JOIN LATERAL (
         SELECT jsonb_agg(jsonb_build_object(
           'id', r.id::text,
           'internalSaleCost', r.internal_sale_cost::text,
           'annualWarrantyMaintenanceCost', r.annual_warranty_maintenance_cost::text,
           'versionNo', r.version_no,
           'effectiveFrom', r.effective_from,
           'effectiveTo', r.effective_to,
           'statusCode', r.status_code,
           'sourceCode', r.source_code,
           'sourceReference', r.source_reference
         ) ORDER BY r.version_no DESC) AS rules
         FROM catalog.hardware_profit_cost_rules r
         WHERE r.hardware_product_id = h.id
       ) history ON true
       LEFT JOIN LATERAL (
         SELECT jsonb_build_object(
           'id', r.id::text,
           'hardwareProductId', r.hardware_product_id::text,
           'internalSaleCost', r.internal_sale_cost::text,
           'annualWarrantyMaintenanceCost', r.annual_warranty_maintenance_cost::text,
           'versionNo', r.version_no,
           'effectiveFrom', r.effective_from,
           'effectiveTo', r.effective_to,
           'statusCode', r.status_code,
           'sourceCode', r.source_code,
           'sourceReference', r.source_reference
         ) AS rule
         FROM catalog.hardware_profit_cost_rules r
         WHERE r.hardware_product_id = h.id
           AND r.status_code = 'active'
           AND r.effective_from <= now()
           AND (r.effective_to IS NULL OR r.effective_to > now())
         ORDER BY r.version_no DESC
         LIMIT 1
       ) current_rule ON true
       WHERE h.status_code <> 'archived'
         AND ($1 = '' OR h.id::text = $1 OR h.hardware_code = $1 OR h.v2_source_id = $1 OR h.hardware_name ILIKE '%' || $1 || '%')
         AND (NOT $2 OR current_rule.rule IS NULL OR current_rule.rule->>'annualWarrantyMaintenanceCost' IS NULL)
       ORDER BY h.hardware_name`,
      [型号, 仅缺失],
    );
    return { rules: 结果.rows };
  }

  public async 创建成本规则(
    输入: Record<string, unknown>,
    username: string,
  ): Promise<Record<string, unknown>> {
    const db = await this.pool.connect();
    try {
      await db.query("BEGIN");
      const 操作者 = await this.读取操作者(db, username);
      if (!操作者.superadmin)
        throw new 应用错误(
          "V3_QUOTE_PROFIT_ROLE_DENIED",
          "仅超级管理员可以维护硬件成本规则。",
          403,
        );
      const 硬件标识 = 读取文本(输入, ["hardwareProductId"]);
      const 内部成本 = 读取金额文本(输入, "internalSaleCost");
      const 年度成本原始 = 输入.annualWarrantyMaintenanceCost;
      const 年度成本 =
        年度成本原始 === null || 年度成本原始 === undefined || String(年度成本原始).trim() === ""
          ? null
          : 读取金额文本(输入, "annualWarrantyMaintenanceCost");
      const 生效时间 = 读取文本(输入, ["effectiveFrom"]);
      const 来源说明 = 读取文本(输入, ["sourceReference"]);
      if (!硬件标识 || !生效时间 || !来源说明)
        throw new 应用错误(
          "V3_QUOTE_PROFIT_COST_RULE_INVALID",
          "硬件、生效时间和来源说明为必填项。",
          400,
        );
      const 生效日期 = new Date(生效时间);
      if (Number.isNaN(生效日期.getTime()))
        throw new 应用错误("V3_QUOTE_PROFIT_COST_RULE_INVALID", "生效时间格式不正确。", 400);
      if (生效日期.getTime() > Date.now() + 60_000)
        throw new 应用错误(
          "V3_QUOTE_PROFIT_COST_RULE_FUTURE_FORBIDDEN",
          "V1 不允许未来生效的成本规则。",
          400,
        );
      const 硬件 = await db.query<{ id: string }>(
        `SELECT id::text AS id FROM catalog.hardware_products
         WHERE id::text=$1 OR hardware_code=$1 OR v2_source_id=$1
         FOR UPDATE`,
        [硬件标识],
      );
      if (硬件.rows.length !== 1)
        throw new 应用错误(
          "V3_QUOTE_PROFIT_HARDWARE_NOT_UNIQUE",
          "硬件产品编号无法唯一匹配。",
          409,
        );
      const 硬件编号 = 硬件.rows[0]?.id || "";
      const 当前 = await db.query<{ id: string; version_no: number; effective_from: string }>(
        `SELECT id::text AS id, version_no, effective_from
         FROM catalog.hardware_profit_cost_rules
         WHERE hardware_product_id=$1::uuid AND status_code='active'
           AND effective_from <= $2::timestamptz
           AND (effective_to IS NULL OR effective_to > $2::timestamptz)
         ORDER BY version_no DESC LIMIT 1 FOR UPDATE`,
        [硬件编号, 生效时间],
      );
      const 当前规则 = 当前.rows[0];
      if (当前规则 && 生效日期.getTime() <= new Date(当前规则.effective_from).getTime())
        throw new 应用错误(
          "V3_QUOTE_PROFIT_COST_RULE_ORDER_INVALID",
          "新成本版本不能早于当前版本生效时间。",
          409,
        );
      const 下一个版本 = await db.query<{ version_no: number }>(
        `SELECT COALESCE(MAX(version_no),0)+1 AS version_no
         FROM catalog.hardware_profit_cost_rules WHERE hardware_product_id=$1::uuid`,
        [硬件编号],
      );
      if (当前规则) {
        await db.query(
          `UPDATE catalog.hardware_profit_cost_rules
           SET effective_to=$2::timestamptz,status_code='disabled',updated_at=now(),row_version=row_version+1
           WHERE id=$1::uuid`,
          [当前规则.id, 生效时间],
        );
      }
      const 插入 = await db.query<Record<string, unknown>>(
        `INSERT INTO catalog.hardware_profit_cost_rules (
           hardware_product_id,internal_sale_cost,annual_warranty_maintenance_cost,version_no,
           effective_from,status_code,source_code,source_reference,created_by_user_id
         ) VALUES ($1::uuid,$2::numeric,$3::numeric,$4,$5::timestamptz,'active','manual',$6,$7::uuid)
         RETURNING id::text AS "id",hardware_product_id::text AS "hardwareProductId",
           internal_sale_cost::text AS "internalSaleCost",
           annual_warranty_maintenance_cost::text AS "annualWarrantyMaintenanceCost",
           version_no AS "versionNo",effective_from AS "effectiveFrom",effective_to AS "effectiveTo",
           status_code AS "statusCode",source_code AS "sourceCode",source_reference AS "sourceReference"`,
        [
          硬件编号,
          内部成本,
          年度成本,
          下一个版本.rows[0]?.version_no || 1,
          生效时间,
          来源说明,
          操作者.userId,
        ],
      );
      await this.写入审计(db, 操作者, "cost_rule_created", 硬件编号, {
        ruleId: 插入.rows[0]?.id,
        internalSaleCost: 内部成本,
        annualWarrantyMaintenanceCost: 年度成本,
      });
      await db.query(
        `INSERT INTO ops.outbox_events(event_type,aggregate_type,aggregate_id,payload_json)
         VALUES ('crm.quote.profit.cost_rule.changed','hardware_product',$1::uuid,$2::jsonb)`,
        [硬件编号, JSON.stringify({ hardwareProductId: 硬件编号, effectiveFrom: 生效时间 })],
      );
      await db.query("COMMIT");
      return 插入.rows[0] || {};
    } catch (错误) {
      await db.query("ROLLBACK");
      throw 错误;
    } finally {
      db.release();
    }
  }

  private async 保存新版本(
    quoteId: string,
    输入: Record<string, unknown>,
    username: string,
  ): Promise<收益计算响应> {
    const db = await this.pool.connect();
    try {
      await db.query("BEGIN");
      const 操作者 = await this.读取操作者(db, username);
      const 报价 = await this.读取报价(db, quoteId, true);
      await this.校验报价范围(db, 报价, 操作者);
      const 现有 = await this.读取当前计算记录(db, 报价.id);
      if (现有?.statusCode === "frozen")
        throw new 应用错误("V3_QUOTE_PROFIT_FROZEN_READ_ONLY", "正式收益快照不可覆盖。", 409);
      const 预期版本 = 读取可选整数(输入.expectedRowVersion);
      if (预期版本 !== null && 预期版本 !== 报价.rowVersion)
        throw new 应用错误(
          "V3_QUOTE_PROFIT_VERSION_CONFLICT",
          "报价数据已被其他操作更新，请刷新后重试。",
          409,
        );
      const 年数 = this.读取年限输入(输入, 现有, 报价.priceAdjustment);
      const 计算结果 = await this.计算(
        db,
        报价.id,
        年数.warrantyYears,
        年数.procurementMaintenanceYears,
        new Date(),
      );
      const 持久状态 = 计算结果.statusCode === "complete" ? "draft" : 计算结果.statusCode;
      const 版本 = await db.query<{ next_version: number }>(
        `SELECT COALESCE(MAX(calculation_version),0)+1 AS next_version
         FROM crm.quote_profit_calculations WHERE quote_id=$1::uuid`,
        [报价.id],
      );
      await db.query(
        `UPDATE crm.quote_profit_calculations SET status_code='void',updated_at=now(),row_version=row_version+1
         WHERE quote_id=$1::uuid AND status_code IN ('draft','incomplete','not_applicable')`,
        [报价.id],
      );
      const 金额 = 计算结果.details;
      const 插入 = await db.query<{ id: string }>(
        `INSERT INTO crm.quote_profit_calculations (
           quote_id,order_id,region_id,status_code,calculation_version,formula_version,quote_row_version,
           approval_round,order_revision_no,warranty_years,procurement_maintenance_years,
           software_discounted_amount,software_public_amount,hardware_quote_amount,product_contract_amount,
           service_contract_amount,hardware_internal_cost,hardware_annual_warranty_cost,
           hardware_annual_maintenance_cost,product_tax_amount,service_tax_amount,warranty_cost,
           procurement_maintenance_cost,effective_contract_income,project_profit,
           missing_rules_json,input_snapshot_json,calculation_snapshot_json,input_hash,created_by_user_id,updated_by_user_id
         ) VALUES (
           $1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8,$9,$10,$11,
           $12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26::jsonb,$27::jsonb,$28::jsonb,$29,$30::uuid,$30::uuid
         ) RETURNING id::text AS id`,
        [
          报价.id,
          报价.orderId,
          报价.regionId,
          持久状态,
          版本.rows[0]?.next_version || 1,
          计算结果.formulaVersion,
          报价.rowVersion,
          报价.approvalRound,
          报价.orderRevisionNo,
          计算结果.warrantyYears,
          计算结果.procurementMaintenanceYears,
          this.可选金额(金额.softwareDiscountedAmount),
          this.可选金额(金额.softwarePublicAmount),
          this.可选金额(金额.hardwareQuoteAmount),
          this.可选金额(金额.productContractAmount),
          this.可选金额(金额.serviceContractAmount),
          this.可选金额(金额.hardwareInternalCost),
          this.可选金额(金额.hardwareAnnualWarrantyCost),
          this.可选金额(金额.hardwareAnnualMaintenanceCost),
          this.可选金额(金额.productTaxAmount),
          this.可选金额(金额.serviceTaxAmount),
          this.可选金额(金额.warrantyCost),
          this.可选金额(金额.procurementMaintenanceCost),
          this.可选金额(金额.effectiveContractIncome),
          this.可选金额(金额.projectProfit),
          JSON.stringify(计算结果.missingRules),
          JSON.stringify({
            warrantyYears: 计算结果.warrantyYears,
            procurementMaintenanceYears: 计算结果.procurementMaintenanceYears,
          }),
          JSON.stringify(计算结果),
          计算结果.inputHash,
          操作者.userId,
        ],
      );
      await this.写入审计(db, 操作者, "draft_calculated", 报价.id, {
        calculationId: 插入.rows[0]?.id,
        statusCode: 持久状态,
      });
      await db.query("COMMIT");
      return this.组装计算结果响应(报价, 计算结果, {
        id: 插入.rows[0]?.id || "",
        statusCode: 持久状态,
        calculationVersion: 版本.rows[0]?.next_version || 1,
        quoteRowVersion: 报价.rowVersion,
        warrantyYears: 年数.warrantyYears,
        procurementMaintenanceYears: 年数.procurementMaintenanceYears,
        formulaVersion: 计算结果.formulaVersion,
        frozenAt: null,
        inputHash: 计算结果.inputHash,
        details: 计算结果.details,
        softwareLines: 计算结果.softwareLines,
        hardwareLines: 计算结果.hardwareLines,
        missingRules: 计算结果.missingRules,
      });
    } catch (错误) {
      await db.query("ROLLBACK");
      throw 错误;
    } finally {
      db.release();
    }
  }

  private async 计算(
    执行器: 查询执行器,
    quoteId: string,
    warrantyYears: number,
    procurementMaintenanceYears: number,
    asOf: Date,
  ) {
    const 调价结果 = await 执行器.query<{
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
    );
    const 调价 = 调价结果.rows[0];
    const 使用总价口径 = Boolean(调价?.product_contract_amount);
    const 明细 = await this.读取报价明细(执行器, quoteId);
    const 输入: 计算输入 = {
      softwareItems: [],
      hardwareItems: [],
      serviceContractAmount: "0.00",
      topScope: null,
    };
    for (const 行 of 明细) {
      if (行.itemTypeCode === "service") {
        输入.serviceContractAmount = (
          Number(输入.serviceContractAmount) + Number(行.lineAmount)
        ).toFixed(6);
        continue;
      }
      if (行.itemTypeCode === "hardware") {
        const 成本 = await this.读取硬件成本(执行器, 行.productRefId, asOf);
        输入.hardwareItems.push({
          productId: 行.hardwareCode || 行.productRefId || 行.id,
          quantity: 规范硬件数量文本(行.quantity),
          quoteUnitPrice: 格式化金额(行.unitPrice),
          ...(成本.internalSaleCost ? { internalSaleCost: 格式化金额(成本.internalSaleCost) } : {}),
          annualWarrantyMaintenanceCost: 成本.annualWarrantyMaintenanceCost
            ? 格式化金额(成本.annualWarrantyMaintenanceCost)
            : null,
          scopeCode: 行.hardwareScopeCode,
        });
        continue;
      }
      if (行.itemTypeCode === "software") {
        const 数量 = Number(行.quantity) || 1;
        输入.softwareItems.push({
          id: 行.featureCode || 行.productRefId || 行.id,
          quantity: 行.quantity,
          discountedUnitPrice: 定点除法(行.lineAmount, 数量),
          ...(行.featureListPrice ? { publicUnitPrice: 格式化金额(行.featureListPrice) } : {}),
          scopeCode: 行.categoryScopeCode,
        });
        continue;
      }
      输入.topScope = "unclassified";
    }
    return 计算微盾报价收益({
      scopeCode: 输入.topScope,
      softwareItems: 输入.softwareItems,
      hardwareItems: 输入.hardwareItems,
      ...(使用总价口径
        ? { productContractAmount: 格式化金额(调价!.product_contract_amount!) }
        : {}),
      serviceContractAmount: 使用总价口径
        ? 格式化金额(调价!.service_contract_amount || "0")
        : 输入.serviceContractAmount,
      warrantyYears: 调价?.warranty_years ?? warrantyYears,
      procurementMaintenanceYears:
        调价?.procurement_maintenance_years ?? procurementMaintenanceYears,
    });
  }

  private async 读取报价(
    执行器: 查询执行器,
    quoteId: string,
    forUpdate = false,
  ): Promise<报价基础> {
    const 结果 = await 执行器.query<{
      id: string;
      quote_no: string;
      row_version: number;
      region_id: string | null;
      order_id: string | null;
      order_status: string | null;
      approval_round: number | null;
      revision_no: number | null;
      product_contract_amount: string | null;
      service_contract_amount: string | null;
      warranty_years: number | null;
      procurement_maintenance_years: number | null;
    }>(
      `SELECT q.id::text AS id,q.quote_no,q.row_version::int AS row_version,q.region_id::text AS region_id,
              o.id::text AS order_id,o.status_code AS order_status,
              COALESCE((SELECT MAX(request.approval_round) FROM integration.order_preapproval_requests request WHERE request.order_id=o.id),1) AS approval_round,
              COALESCE(o.revision_no,0) AS revision_no,
              q.extra_json->'priceAdjustment'->>'productContractAmount' AS product_contract_amount,
              q.extra_json->'priceAdjustment'->>'serviceContractAmount' AS service_contract_amount,
              NULLIF(q.extra_json->'priceAdjustment'->>'warrantyYears','')::integer AS warranty_years,
              NULLIF(q.extra_json->'priceAdjustment'->>'procurementMaintenanceYears','')::integer AS procurement_maintenance_years
       FROM crm.quotes q
       LEFT JOIN LATERAL (
         SELECT id,status_code,revision_no FROM crm.orders
         WHERE quote_id=q.id ORDER BY created_at DESC LIMIT 1
       ) o ON true
       WHERE q.id::text=$1 OR q.quote_no=$1 OR q.v2_source_id=$1
       ${forUpdate ? "FOR UPDATE OF q" : ""}`,
      [quoteId],
    );
    const 行 = 结果.rows[0];
    if (!行) throw new 应用错误("V3_QUOTE_PROFIT_NOT_FOUND", "报价不存在或无权访问。", 404);
    return {
      id: 行.id,
      quoteNo: 行.quote_no,
      rowVersion: 行.row_version,
      regionId: 行.region_id,
      orderId: 行.order_id,
      orderStatus: 行.order_status,
      approvalRound: 行.approval_round || 0,
      orderRevisionNo: 行.revision_no || 0,
      priceAdjustment: 行.product_contract_amount
        ? {
            productContractAmount: 行.product_contract_amount,
            serviceContractAmount: 行.service_contract_amount || "0",
            warrantyYears: 行.warranty_years ?? 3,
            procurementMaintenanceYears: 行.procurement_maintenance_years ?? 0,
          }
        : null,
    };
  }

  private async 读取报价明细(执行器: 查询执行器, quoteId: string): Promise<报价明细行[]> {
    const 结果 = await 执行器.query<Record<string, unknown>>(
      `SELECT qi.id::text AS id,qi.item_name AS "itemName",qi.product_ref_type AS "productRefType",
              qi.product_ref_id::text AS "productRefId",qi.quantity::text AS quantity,
              qi.unit_price::text AS "unitPrice",qi.line_amount::text AS "lineAmount",
              qi.item_type_code AS "itemTypeCode",COALESCE(qi.extra_json,'{}'::jsonb) AS "extraJson",
              h.hardware_code AS "hardwareCode",COALESCE(h.profit_scope_code,'unclassified') AS "hardwareScopeCode",
              h.list_price::text AS "hardwareListPrice",f.feature_code AS "featureCode",
              f.list_price::text AS "featureListPrice",c.category_code AS "categoryCode",
              c.product_type_code AS "productTypeCode",COALESCE(c.profit_scope_code,'unclassified') AS "categoryScopeCode"
       FROM crm.quote_items qi
       LEFT JOIN catalog.hardware_products h ON qi.product_ref_type='hardware' AND h.id=qi.product_ref_id
       LEFT JOIN catalog.product_features f ON qi.product_ref_type='feature' AND f.id=qi.product_ref_id
       LEFT JOIN catalog.product_modules m ON m.id=f.module_id
       LEFT JOIN catalog.product_categories c ON c.id=m.category_id
       WHERE qi.quote_id=$1::uuid ORDER BY qi.sort_order,qi.id`,
      [quoteId],
    );
    return 结果.rows.map((行) => ({
      id: String(行.id),
      itemName: String(行.itemName || ""),
      productRefType: String(行.productRefType) as 报价明细行["productRefType"],
      productRefId: 行.productRefId ? String(行.productRefId) : null,
      quantity: String(行.quantity || "1"),
      unitPrice: String(行.unitPrice || "0"),
      lineAmount: String(行.lineAmount || "0"),
      itemTypeCode: String(行.itemTypeCode || "unknown") as 报价明细行["itemTypeCode"],
      extraJson: (行.extraJson as Record<string, unknown>) || {},
      hardwareCode: 行.hardwareCode ? String(行.hardwareCode) : null,
      hardwareScopeCode: (行.hardwareScopeCode as 微盾收益范围) || "unclassified",
      hardwareListPrice: 行.hardwareListPrice ? String(行.hardwareListPrice) : null,
      featureCode: 行.featureCode ? String(行.featureCode) : null,
      featureListPrice: 行.featureListPrice ? String(行.featureListPrice) : null,
      categoryCode: 行.categoryCode ? String(行.categoryCode) : null,
      productTypeCode: 行.productTypeCode ? String(行.productTypeCode) : null,
      categoryScopeCode: (行.categoryScopeCode as 微盾收益范围) || "unclassified",
    }));
  }

  private async 读取硬件成本(
    执行器: 查询执行器,
    hardwareProductId: string | null,
    asOf: Date,
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
         AND effective_from <= $2::timestamptz
         AND (effective_to IS NULL OR effective_to > $2::timestamptz)
       ORDER BY version_no DESC LIMIT 1`,
      [hardwareProductId, asOf],
    );
    return {
      internalSaleCost: 结果.rows[0]?.internal_sale_cost || null,
      annualWarrantyMaintenanceCost: 结果.rows[0]?.annual_warranty_maintenance_cost || null,
    };
  }

  private async 读取操作者(执行器: 查询执行器, username: string): Promise<收益操作者> {
    if (!username) throw new 应用错误("V3_AUTH_REQUIRED", "请先登录。", 401);
    const 结果 = await 执行器.query<{
      id: string;
      username: string;
      display_name: string | null;
      status_code: string;
      region_id: string | null;
      role_codes: string[] | null;
    }>(
      `SELECT u.id::text AS id,u.username::text AS username,u.display_name,u.status_code,u.region_id::text AS region_id,
              ARRAY_REMOVE(ARRAY_AGG(DISTINCT r.role_code) FILTER (WHERE r.role_code IS NOT NULL),NULL) AS role_codes
       FROM iam.users u
       LEFT JOIN iam.user_roles ur ON ur.user_id=u.id
       LEFT JOIN iam.roles r ON r.id=ur.role_id AND r.status_code='active'
       WHERE u.username=$1::citext OR u.v2_source_id=$1
       GROUP BY u.id,u.username,u.display_name,u.status_code,u.region_id
       LIMIT 1`,
      [username],
    );
    const 用户 = 结果.rows[0];
    if (!用户 || 用户.status_code !== "active")
      throw new 应用错误("V3_AUTH_ACCOUNT_UNAVAILABLE", "账号不存在或不可用。", 401);
    const roleCodes = 用户.role_codes || [];
    const superadmin = roleCodes.includes("superadmin");
    let regionIds: string[] = [];
    if (superadmin) {
      regionIds = [];
    } else {
      if (!roleCodes.some((角色) => 角色 === "region_manager" || 角色 === "admin"))
        throw new 应用错误("V3_QUOTE_PROFIT_ROLE_DENIED", "当前角色不能访问收益数据。", 403);
      const 范围 = await 执行器.query<{ region_id: string }>(
        `SELECT DISTINCT d.scope_ref_id::text AS region_id
         FROM iam.user_roles ur
         JOIN iam.roles r ON r.id=ur.role_id AND r.status_code='active'
         JOIN iam.data_scope_bindings d ON d.role_id=ur.role_id AND d.status_code='active'
         WHERE ur.user_id=$1::uuid AND d.resource_code='quote' AND d.scope_type='region' AND d.scope_ref_id IS NOT NULL`,
        [用户.id],
      );
      regionIds = 范围.rows.map((行) => 行.region_id);
      if (!regionIds.length && 用户.region_id) regionIds = [用户.region_id];
      if (!regionIds.length)
        throw new 应用错误("V3_QUOTE_PROFIT_REGION_REQUIRED", "区管未绑定正式收益区域。", 403);
    }
    return {
      userId: 用户.id,
      username: 用户.username,
      displayName: 用户.display_name || 用户.username,
      roleCodes,
      regionIds,
      superadmin,
    };
  }

  private async 校验报价范围(
    执行器: 查询执行器,
    报价: 报价基础,
    操作者: 收益操作者,
  ): Promise<void> {
    if (操作者.superadmin) return;
    if (!报价.regionId || !操作者.regionIds.includes(报价.regionId))
      throw new 应用错误("V3_QUOTE_PROFIT_NOT_FOUND", "报价不存在或无权访问。", 404);
  }

  private async 读取当前计算记录(
    执行器: 查询执行器,
    quoteId: string,
  ): Promise<当前计算记录 | null> {
    const 结果 = await 执行器.query<Record<string, unknown>>(
      `SELECT id::text AS id,status_code AS "statusCode",calculation_version AS "calculationVersion",
              quote_row_version AS "quoteRowVersion",warranty_years AS "warrantyYears",
              procurement_maintenance_years AS "procurementMaintenanceYears",formula_version AS "formulaVersion",
              frozen_at AS "frozenAt",input_hash AS "inputHash",calculation_snapshot_json AS "calculationSnapshot",
              missing_rules_json AS "missingRules"
       FROM crm.quote_profit_calculations
       WHERE quote_id=$1::uuid
       ORDER BY CASE WHEN status_code='frozen' THEN 0 WHEN status_code IN ('draft','incomplete') THEN 1 ELSE 2 END,
                calculation_version DESC LIMIT 1`,
      [quoteId],
    );
    const 行 = 结果.rows[0];
    if (!行) return null;
    const 快照 = (行.calculationSnapshot as Record<string, unknown>) || {};
    return {
      id: String(行.id),
      statusCode: String(行.statusCode) as 当前计算记录["statusCode"],
      calculationVersion: Number(行.calculationVersion) || 1,
      quoteRowVersion: Number(行.quoteRowVersion) || 0,
      warrantyYears: Number(行.warrantyYears) || 3,
      procurementMaintenanceYears: Number(行.procurementMaintenanceYears) || 0,
      formulaVersion: String(行.formulaVersion || "weidun-v1"),
      frozenAt: 行.frozenAt ? String(行.frozenAt) : null,
      inputHash: 行.inputHash ? String(行.inputHash) : null,
      details: (快照.details as Record<string, string | null>) || {},
      softwareLines: Array.isArray(快照.softwareLines) ? 快照.softwareLines : [],
      hardwareLines: Array.isArray(快照.hardwareLines) ? 快照.hardwareLines : [],
      missingRules: Array.isArray(行.missingRules) ? 行.missingRules : [],
    };
  }

  private 读取年限输入(
    输入: Record<string, unknown>,
    现有: 当前计算记录 | null,
    价格调整: 报价基础["priceAdjustment"],
  ): { warrantyYears: number; procurementMaintenanceYears: number } {
    if (价格调整) {
      return {
        warrantyYears: 价格调整.warrantyYears,
        procurementMaintenanceYears: 价格调整.procurementMaintenanceYears,
      };
    }
    const warrantyYears = 读取可选整数(输入.warrantyYears) ?? 现有?.warrantyYears ?? 3;
    const procurementMaintenanceYears =
      读取可选整数(输入.procurementMaintenanceYears) ?? 现有?.procurementMaintenanceYears ?? 0;
    if (warrantyYears < 1 || warrantyYears > 20)
      throw new 应用错误("V3_QUOTE_PROFIT_PARAMETER_INVALID", "质保年限必须在1至20年之间。", 400);
    if (procurementMaintenanceYears < 0 || procurementMaintenanceYears > 20)
      throw new 应用错误(
        "V3_QUOTE_PROFIT_PARAMETER_INVALID",
        "采购维保年限必须在0至20年之间。",
        400,
      );
    return { warrantyYears, procurementMaintenanceYears };
  }

  private 组装计算结果响应(
    报价: 报价基础,
    计算结果: 微盾收益计算结果,
    现有: 当前计算记录 | null,
    状态覆盖?: 收益计算响应["statusCode"],
  ): 收益计算响应 {
    const 状态 = 状态覆盖 || (计算结果.statusCode === "complete" ? "draft" : 计算结果.statusCode);
    return {
      quoteId: 报价.id,
      orderId: 报价.orderId,
      regionId: 报价.regionId,
      scopeCode: 计算结果.scopeCode,
      statusCode: 状态,
      statusName: 状态名称[状态],
      formulaVersion: 计算结果.formulaVersion,
      warrantyYears: 计算结果.warrantyYears,
      procurementMaintenanceYears: 计算结果.procurementMaintenanceYears,
      quoteRowVersion: 报价.rowVersion,
      calculationVersion: 现有?.calculationVersion ?? null,
      calculatedAt: new Date().toISOString(),
      frozenAt: 现有?.frozenAt ?? null,
      inputHash: 计算结果.inputHash,
      priceAdjustment: 报价.priceAdjustment,
      inputLocked: Boolean(报价.priceAdjustment),
      summary: {
        productContractAmount: 计算结果.details.productContractAmount,
        serviceContractAmount: 计算结果.details.serviceContractAmount,
        effectiveContractIncome: 计算结果.details.effectiveContractIncome,
        projectProfit: 计算结果.details.projectProfit,
      },
      details: 计算结果.details,
      softwareLines: 计算结果.softwareLines,
      hardwareLines: 计算结果.hardwareLines,
      missingRules: 计算结果.missingRules,
    };
  }

  private 组装存储响应(报价: 报价基础, 现有: 当前计算记录): 收益计算响应 {
    return {
      quoteId: 报价.id,
      orderId: 报价.orderId,
      regionId: 报价.regionId,
      scopeCode: "weidun",
      statusCode: 现有.statusCode,
      statusName: 状态名称[现有.statusCode],
      formulaVersion: 现有.formulaVersion,
      warrantyYears: 现有.warrantyYears,
      procurementMaintenanceYears: 现有.procurementMaintenanceYears,
      quoteRowVersion: 报价.rowVersion,
      calculationVersion: 现有.calculationVersion,
      calculatedAt: 现有.frozenAt || new Date().toISOString(),
      frozenAt: 现有.frozenAt,
      inputHash: 现有.inputHash,
      priceAdjustment: 报价.priceAdjustment,
      inputLocked: Boolean(报价.priceAdjustment),
      summary: {
        productContractAmount: 现有.details.productContractAmount ?? null,
        serviceContractAmount: 现有.details.serviceContractAmount ?? null,
        effectiveContractIncome: 现有.details.effectiveContractIncome ?? null,
        projectProfit: 现有.details.projectProfit ?? null,
      },
      details: 现有.details as 微盾收益计算结果["details"],
      softwareLines: 现有.softwareLines as 微盾收益计算结果["softwareLines"],
      hardwareLines: 现有.hardwareLines as 微盾收益计算结果["hardwareLines"],
      missingRules: 现有.missingRules as 微盾收益计算结果["missingRules"],
    };
  }

  private 可选金额(值: string | null): string | null {
    return 值 === null || 值 === undefined ? null : 值;
  }

  private async 写入审计(
    执行器: 查询执行器,
    操作者: 收益操作者,
    actionCode: string,
    targetId: string,
    after: Record<string, unknown>,
  ): Promise<void> {
    await 执行器.query(
      `INSERT INTO audit.audit_logs (
         created_at,actor_user_id,actor_username,actor_name,actor_role,module_code,action_code,target_type,target_id,result_code,after_json
       ) VALUES (now(),$1::uuid,$2,$3,$4,'quote_profit',$5,'quote',$6,'success',$7::jsonb)`,
      [
        操作者.userId,
        操作者.username,
        操作者.displayName,
        操作者.roleCodes[0] || "unknown",
        actionCode,
        targetId,
        JSON.stringify(after),
      ],
    );
  }
}

function 读取文本(来源: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const 值 = 来源[key];
    if (typeof 值 === "string" && 值.trim()) return 值.trim();
  }
  return "";
}

function 读取可选整数(值: unknown): number | null {
  if (值 === null || 值 === undefined || 值 === "") return null;
  const 数字 = Number(值);
  return Number.isInteger(数字) ? 数字 : null;
}

function 读取金额文本(来源: Record<string, unknown>, key: string): string {
  const 值 = 读取文本(来源, [key]);
  if (!/^\d+(?:\.\d{1,2})?$/.test(值))
    throw new 应用错误(
      "V3_QUOTE_PROFIT_COST_RULE_INVALID",
      "成本金额必须是最多两位小数的非负数。",
      400,
    );
  return 值;
}

function 格式化金额(值: string | number | null | undefined): string {
  const 数字 = Number(值);
  return Number.isFinite(数字) ? 数字.toFixed(6) : "0.000000";
}

function 定点除法(值: string, 数量: number): string {
  const 数字 = Number(值) / 数量;
  return Number.isFinite(数字) ? 数字.toFixed(6) : "0.000000";
}

function 规范硬件数量文本(值: string): string {
  const 数字 = Number(值);
  if (!Number.isSafeInteger(数字) || 数字 < 1 || 数字 > 9_999) return 值;
  return String(数字);
}
