import { createHash } from "node:crypto";

/** 微盾收益核算支持的产品范围。 */
export type 微盾收益范围 = "weidun" | "xcad" | "unclassified";

/** 收益计算结果状态。 */
export type 微盾收益状态 = "complete" | "incomplete" | "not_applicable";

/** 收益计算公式版本。调价订单使用总价输入口径，历史记录继续使用模块金额口径。 */
export type 微盾收益公式版本代码 = "weidun-v1" | "weidun-v2-total-input";

/** 计算引擎使用的十进制定点金额字符串。 */
export type 定点金额 = string;

/** 软件报价明细。金额由单价和数量在服务端定点计算得到。 */
export interface 微盾软件收益明细 {
  id: string;
  quantity: number | string;
  discountedUnitPrice?: 定点金额;
  publicUnitPrice?: 定点金额;
  scopeCode?: 微盾收益范围 | null;
}

/** 硬件报价及成本明细。成本规则缺失时，年度成本使用 null 表示未知。 */
export interface 微盾硬件收益明细 {
  productId: string;
  quantity: number | string;
  quoteUnitPrice?: 定点金额;
  internalSaleCost?: 定点金额;
  annualWarrantyMaintenanceCost?: 定点金额 | null;
  scopeCode?: 微盾收益范围 | null;
}

/** 微盾收益计算输入。金额字段只接受定点十进制字符串，不接受浮点数。 */
export interface 微盾收益计算输入 {
  scopeCode?: 微盾收益范围 | null;
  softwareItems?: 微盾软件收益明细[];
  hardwareItems?: 微盾硬件收益明细[];
  /** 区管调价后直接确认的产品合同额；存在时不再使用模块金额汇总该字段。 */
  productContractAmount?: 定点金额;
  serviceContractAmount?: 定点金额;
  warrantyYears: number | string;
  procurementMaintenanceYears: number | string;
}

export interface 微盾收益缺失规则 {
  code: string;
  field: string;
  message: string;
  targetId?: string;
}

export interface 微盾软件收益行结果 {
  id: string;
  quantity: number;
  discountedUnitPrice: 定点金额 | null;
  publicUnitPrice: 定点金额 | null;
  discountedAmount: 定点金额 | null;
  publicAmount: 定点金额 | null;
}

export interface 微盾硬件收益行结果 {
  productId: string;
  quantity: number;
  quoteUnitPrice: 定点金额 | null;
  quoteAmount: 定点金额 | null;
  internalSaleCost: 定点金额 | null;
  internalCostAmount: 定点金额 | null;
  annualWarrantyMaintenanceCost: 定点金额 | null;
  annualWarrantyCostAmount: 定点金额 | null;
  annualMaintenanceCostAmount: 定点金额 | null;
}

export interface 微盾收益计算结果 {
  formulaVersion: 微盾收益公式版本代码;
  scopeCode: 微盾收益范围 | null;
  statusCode: 微盾收益状态;
  complete: boolean;
  inputFingerprint: string;
  inputHash: string;
  warrantyYears: number;
  procurementMaintenanceYears: number;
  softwareLines: 微盾软件收益行结果[];
  hardwareLines: 微盾硬件收益行结果[];
  missingRules: 微盾收益缺失规则[];
  details: {
    softwareDiscountedAmount: 定点金额 | null;
    softwarePublicAmount: 定点金额 | null;
    hardwareQuoteAmount: 定点金额 | null;
    productContractAmount: 定点金额 | null;
    serviceContractAmount: 定点金额 | null;
    hardwareInternalCost: 定点金额 | null;
    hardwareAnnualWarrantyCost: 定点金额 | null;
    hardwareAnnualMaintenanceCost: 定点金额 | null;
    productTaxAmount: 定点金额 | null;
    serviceTaxAmount: 定点金额 | null;
    warrantyCost: 定点金额 | null;
    procurementMaintenanceCost: 定点金额 | null;
    effectiveContractIncome: 定点金额 | null;
    projectProfit: 定点金额 | null;
  };
}

export const 微盾收益公式版本 = "weidun-v1" as const;
export const 微盾总价收益公式版本 = "weidun-v2-total-input" as const;
const 金额倍率 = 1_000_000n;
const 数量倍率 = 10_000n;
const 产品税率 = 50_000n;
const 服务税率 = 70_000n;
const 软件年度成本率 = 5_000n;
const 产品有效收入率 = 950_000n;
const 服务有效收入率 = 930_000n;

/**
 * 使用 BigInt 百万分之一元定点数计算微盾报价收益。
 * 该函数不访问数据库、系统时间或环境变量，适合 API 与 Worker 共用。
 */
export function 计算微盾报价收益(输入: 微盾收益计算输入): 微盾收益计算结果 {
  const 软件明细 = 输入.softwareItems || [];
  const 硬件明细 = 输入.hardwareItems || [];
  const 质保年限 = 解析年限(输入.warrantyYears, "质保年限", 1);
  const 采购维保年限 = 解析年限(输入.procurementMaintenanceYears, "采购维保年限", 0);
  const 公式版本: 微盾收益公式版本代码 =
    输入.productContractAmount === undefined ? 微盾收益公式版本 : 微盾总价收益公式版本;
  const 范围判定 = 判定收益范围(输入.scopeCode, 软件明细, 硬件明细);

  if (范围判定.statusCode === "not_applicable") {
    const 输入指纹 = 生成输入指纹(输入, 质保年限, 采购维保年限, 公式版本);
    return 创建不适用结果(
      范围判定.scopeCode,
      输入指纹,
      质保年限,
      采购维保年限,
      范围判定.missingRules,
      公式版本,
      输入.productContractAmount === undefined
        ? null
        : 解析金额或抛错(输入.productContractAmount, "产品合同额"),
      输入.serviceContractAmount === undefined
        ? null
        : 解析金额或抛错(输入.serviceContractAmount, "服务合同额"),
    );
  }

  const 缺失规则 = [...范围判定.missingRules];
  const 服务合同额 =
    输入.serviceContractAmount === undefined
      ? 0n
      : 解析金额或缺失(输入.serviceContractAmount, "服务合同额", 缺失规则);
  if (软件明细.length === 0 && 硬件明细.length === 0) {
    缺失规则.push({
      code: "QUOTE_ITEMS_REQUIRED",
      field: "softwareItems/hardwareItems",
      message: "报价至少需要一项微盾软件或硬件明细。",
    });
  }

  const 软件结果 = 软件明细.map((明细, 下标) => 计算软件行(明细, 下标, 缺失规则));
  const 硬件结果 = 硬件明细.map((明细, 下标) => 计算硬件行(明细, 下标, 缺失规则));
  const 输入指纹 = 生成输入指纹(输入, 质保年限, 采购维保年限, 公式版本);
  const 无商品明细 = 软件明细.length === 0 && 硬件明细.length === 0;
  const 软件折后价 = 无商品明细
    ? null
    : 汇总金额(
        软件结果.map((行) => 行.discountedAmount),
        缺失规则,
        "softwareDiscountedAmount",
      );
  const 软件公开价 = 无商品明细
    ? null
    : 汇总金额(
        软件结果.map((行) => 行.publicAmount),
        缺失规则,
        "softwarePublicAmount",
      );
  const 硬件报价 = 无商品明细
    ? null
    : 汇总金额(
        硬件结果.map((行) => 行.quoteAmount),
        缺失规则,
        "hardwareQuoteAmount",
      );
  const 硬件内部成本 = 无商品明细
    ? null
    : 汇总金额(
        硬件结果.map((行) => 行.internalCostAmount),
        缺失规则,
        "hardwareInternalCost",
      );
  const 硬件年度质保成本 = 无商品明细
    ? null
    : 汇总金额(
        硬件结果.map((行) => 行.annualWarrantyCostAmount),
        缺失规则,
        "hardwareAnnualWarrantyCost",
      );
  const 硬件年度维保成本 = 无商品明细
    ? null
    : 汇总金额(
        硬件结果.map((行) => 行.annualMaintenanceCostAmount),
        缺失规则,
        "hardwareAnnualMaintenanceCost",
      );
  const 产品合同额 =
    公式版本 === 微盾总价收益公式版本
      ? 解析金额或缺失(输入.productContractAmount, "产品合同额", 缺失规则)
      : 相加(软件折后价, 硬件报价);
  const 产品税费 = 乘倍率(相减(产品合同额, 硬件内部成本), 产品税率);
  const 服务税费 = 乘倍率(服务合同额, 服务税率);
  const 质保基础 = 相加(硬件年度质保成本, 乘倍率(软件公开价, 软件年度成本率));
  const 采购维保基础 = 相加(硬件年度维保成本, 乘倍率(软件公开价, 软件年度成本率));
  const 质保成本 = 乘整数(质保基础, BigInt(质保年限 - 1));
  const 采购维保成本 = 乘整数(采购维保基础, BigInt(采购维保年限));
  const 合同有效收入 = 相加(
    乘倍率(相减(产品合同额, 硬件内部成本), 产品有效收入率),
    乘倍率(服务合同额, 服务有效收入率),
  );
  const 项目收益 = 相减(合同有效收入, 质保成本);
  const 是否完整 = 缺失规则.length === 0;

  return {
    formulaVersion: 公式版本,
    scopeCode: 范围判定.scopeCode,
    statusCode: 是否完整 ? "complete" : "incomplete",
    complete: 是否完整,
    inputFingerprint: 输入指纹,
    inputHash: 输入指纹,
    warrantyYears: 质保年限,
    procurementMaintenanceYears: 采购维保年限,
    softwareLines: 软件结果,
    hardwareLines: 硬件结果,
    missingRules: 去重缺失规则(缺失规则),
    details: {
      softwareDiscountedAmount: 格式金额(软件折后价),
      softwarePublicAmount: 格式金额(软件公开价),
      hardwareQuoteAmount: 格式金额(硬件报价),
      productContractAmount: 格式金额(产品合同额),
      serviceContractAmount: 格式金额(服务合同额),
      hardwareInternalCost: 格式金额(硬件内部成本),
      hardwareAnnualWarrantyCost: 格式金额(硬件年度质保成本),
      hardwareAnnualMaintenanceCost: 格式金额(硬件年度维保成本),
      productTaxAmount: 格式金额(产品税费),
      serviceTaxAmount: 格式金额(服务税费),
      warrantyCost: 格式金额(质保成本),
      procurementMaintenanceCost: 格式金额(采购维保成本),
      effectiveContractIncome: 格式金额(合同有效收入),
      projectProfit: 格式金额(项目收益),
    },
  };
}

function 创建不适用结果(
  范围: 微盾收益范围 | null,
  输入指纹: string,
  质保年限: number,
  采购维保年限: number,
  缺失规则: 微盾收益缺失规则[],
  公式版本: 微盾收益公式版本代码,
  产品合同额: bigint | null,
  服务合同额: bigint | null,
): 微盾收益计算结果 {
  const 空结果 = {
    softwareDiscountedAmount: null,
    softwarePublicAmount: null,
    hardwareQuoteAmount: null,
    productContractAmount: 格式金额(产品合同额),
    serviceContractAmount: 格式金额(服务合同额),
    hardwareInternalCost: null,
    hardwareAnnualWarrantyCost: null,
    hardwareAnnualMaintenanceCost: null,
    productTaxAmount: null,
    serviceTaxAmount: null,
    warrantyCost: null,
    procurementMaintenanceCost: null,
    effectiveContractIncome: null,
    projectProfit: null,
  } as const;
  return {
    formulaVersion: 公式版本,
    scopeCode: 范围,
    statusCode: "not_applicable",
    complete: false,
    inputFingerprint: 输入指纹,
    inputHash: 输入指纹,
    warrantyYears: 质保年限,
    procurementMaintenanceYears: 采购维保年限,
    softwareLines: [],
    hardwareLines: [],
    missingRules: 去重缺失规则(缺失规则),
    details: 空结果,
  };
}

function 判定收益范围(
  顶层范围: 微盾收益范围 | null | undefined,
  软件明细: 微盾软件收益明细[],
  硬件明细: 微盾硬件收益明细[],
): { scopeCode: 微盾收益范围 | null; statusCode: 微盾收益状态; missingRules: 微盾收益缺失规则[] } {
  const 范围集合 = [
    顶层范围,
    ...软件明细.map((明细) => 明细.scopeCode),
    ...硬件明细.map((明细) => 明细.scopeCode),
  ];
  if (范围集合.some((范围) => 范围 === "xcad")) {
    return {
      scopeCode: "xcad",
      statusCode: "not_applicable",
      missingRules: [
        {
          code: "XCAD_SCOPE",
          field: "scopeCode",
          message: "报价包含 XCAD 产品，不适用微盾收益核算。",
        },
      ],
    };
  }
  if (范围集合.some((范围) => 范围 === "unclassified")) {
    return {
      scopeCode: "unclassified",
      statusCode: "not_applicable",
      missingRules: [
        {
          code: "UNCLASSIFIED_SCOPE",
          field: "scopeCode",
          message: "报价包含未明确收益范围的产品，不适用微盾收益核算。",
        },
      ],
    };
  }
  if (范围集合.some((范围) => 范围 === "weidun")) {
    return { scopeCode: "weidun", statusCode: "complete", missingRules: [] };
  }
  return {
    scopeCode: null,
    statusCode: "incomplete",
    missingRules: [
      {
        code: "PROFIT_SCOPE_REQUIRED",
        field: "scopeCode",
        message: "报价缺少明确的微盾收益范围标识。",
      },
    ],
  };
}

function 计算软件行(
  输入: 微盾软件收益明细,
  下标: number,
  缺失规则: 微盾收益缺失规则[],
): 微盾软件收益行结果 {
  const 数量定点 = 解析数量定点(输入.quantity, `软件明细第${下标 + 1}项数量`);
  const 数量 = Number(数量定点.原始文本);
  const 折后单价 = 解析金额或缺失(输入.discountedUnitPrice, "软件折后单价", 缺失规则, 输入.id);
  const 公开单价 = 解析金额或缺失(输入.publicUnitPrice, "软件公开单价", 缺失规则, 输入.id);
  return {
    id: 输入.id,
    quantity: 数量,
    discountedUnitPrice: 格式金额(折后单价),
    publicUnitPrice: 格式金额(公开单价),
    discountedAmount: 格式金额(乘数量(折后单价, 数量定点.缩放值)),
    publicAmount: 格式金额(乘数量(公开单价, 数量定点.缩放值)),
  };
}

function 计算硬件行(
  输入: 微盾硬件收益明细,
  下标: number,
  缺失规则: 微盾收益缺失规则[],
): 微盾硬件收益行结果 {
  const 数量 = 解析正整数(输入.quantity, `硬件明细第${下标 + 1}项数量`);
  const 报价单价 = 解析金额或缺失(输入.quoteUnitPrice, "硬件报价单价", 缺失规则, 输入.productId);
  const 内部成本 = 解析金额或缺失(
    输入.internalSaleCost,
    "硬件内部销售成本",
    缺失规则,
    输入.productId,
  );
  const 年度成本 = 解析金额或缺失(
    输入.annualWarrantyMaintenanceCost,
    "年度质保/维保成本",
    缺失规则,
    输入.productId,
  );
  return {
    productId: 输入.productId,
    quantity: 数量,
    quoteUnitPrice: 格式金额(报价单价),
    quoteAmount: 格式金额(折整数(报价单价, 数量)),
    internalSaleCost: 格式金额(内部成本),
    internalCostAmount: 格式金额(折整数(内部成本, 数量)),
    annualWarrantyMaintenanceCost: 格式金额(年度成本),
    annualWarrantyCostAmount: 格式金额(折整数(年度成本, 数量)),
    annualMaintenanceCostAmount: 格式金额(折整数(年度成本, 数量)),
  };
}

function 汇总金额(
  金额列表: Array<定点金额 | null | undefined>,
  缺失规则: 微盾收益缺失规则[],
  字段: string,
): bigint | null {
  if (金额列表.some((金额) => 金额 === null || 金额 === undefined)) {
    if (!缺失规则.some((规则) => 规则.field === 字段)) {
      缺失规则.push({ code: "AMOUNT_REQUIRED", field: 字段, message: `${字段}缺少必要金额输入。` });
    }
    return null;
  }
  return (金额列表 as 定点金额[]).reduce((合计, 金额) => 合计 + 解析金额或抛错(金额, 字段), 0n);
}

function 解析金额或缺失(
  值: 定点金额 | null | undefined,
  字段: string,
  缺失规则: 微盾收益缺失规则[],
  目标编号?: string,
): bigint | null {
  if (值 === null || 值 === undefined || 值 === "") {
    缺失规则.push({
      code: "AMOUNT_REQUIRED",
      field: 字段,
      message: `${字段}未配置。`,
      ...(目标编号 ? { targetId: 目标编号 } : {}),
    });
    return null;
  }
  return 解析金额或抛错(值, 字段);
}

function 解析金额或抛错(值: 定点金额, 字段: string): bigint {
  if (typeof 值 !== "string") throw new Error(`${字段}必须使用十进制定点字符串。`);
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(值)) {
    throw new Error(`${字段}必须是最多6位小数的十进制定点金额。`);
  }
  const 是否负数 = 值.startsWith("-");
  const 正值 = 是否负数 ? 值.slice(1) : 值;
  const [整数部分 = "0", 小数部分 = ""] = 正值.split(".");
  const 小数 = 小数部分.padEnd(6, "0");
  const 结果 = BigInt(整数部分) * 金额倍率 + BigInt(小数 || "0");
  if (是否负数) {
    throw new Error(`${字段}不能为负数。`);
  }
  return 结果;
}

function 解析年限(值: number | string, 字段: string, 最小值: number): number {
  const 文本 = typeof 值 === "number" ? String(值) : 值;
  if (typeof 文本 !== "string" || !/^(?:0|[1-9]\d*)$/.test(文本)) {
    throw new Error(`${字段}必须是整数。`);
  }
  const 结果 = Number(文本);
  if (!Number.isSafeInteger(结果) || 结果 < 最小值 || 结果 > 20) {
    throw new Error(`${字段}必须在${最小值}至20年之间。`);
  }
  return 结果;
}

function 解析正整数(值: number | string, 字段: string): number {
  const 文本 = typeof 值 === "number" ? String(值) : 值;
  if (typeof 文本 !== "string" || !/^[1-9]\d*$/.test(文本)) {
    throw new Error(`${字段}必须是正整数。`);
  }
  const 结果 = Number(文本);
  if (!Number.isSafeInteger(结果) || 结果 > 9_999) {
    throw new Error(`${字段}必须在1至9999之间。`);
  }
  return 结果;
}

function 解析数量定点(值: number | string, 字段: string): { 原始文本: string; 缩放值: bigint } {
  const 文本 = typeof 值 === "number" ? String(值) : 值;
  if (typeof 文本 !== "string" || !/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/.test(文本)) {
    throw new Error(`${字段}必须是正数，最多4位小数。`);
  }
  const [整数部分 = "0", 小数部分 = ""] = 文本.split(".");
  const 缩放值 = BigInt(整数部分) * 数量倍率 + BigInt(小数部分.padEnd(4, "0") || "0");
  if (缩放值 <= 0n) throw new Error(`${字段}必须大于0。`);
  return { 原始文本: 文本, 缩放值 };
}

function 格式金额(值: bigint | null): string | null {
  if (值 === null) return null;
  const 负号 = 值 < 0n ? "-" : "";
  const 绝对值 = 值 < 0n ? -值 : 值;
  const 整数部分 = 绝对值 / 金额倍率;
  const 小数部分 = (绝对值 % 金额倍率).toString().padStart(6, "0");
  return `${负号}${整数部分.toString()}.${小数部分}`;
}

function 折整数(值: bigint | null, 数量: number): bigint | null {
  return 值 === null ? null : 值 * BigInt(数量);
}

function 乘数量(值: bigint | null, 数量缩放值: bigint): bigint | null {
  return 值 === null ? null : 除法四舍五入(值 * 数量缩放值, 数量倍率);
}

function 乘整数(值: bigint | null, 倍数: bigint): bigint | null {
  return 值 === null ? null : 值 * 倍数;
}

function 乘倍率(值: bigint | null, 倍率: bigint): bigint | null {
  return 值 === null ? null : 除法四舍五入(值 * 倍率, 金额倍率);
}

/** 定点整数除法，按金额快照精度执行远离零点的四舍五入。 */
function 除法四舍五入(被除数: bigint, 除数: bigint): bigint {
  if (被除数 === 0n) return 0n;
  const 负数 = 被除数 < 0n;
  const 绝对值 = 负数 ? -被除数 : 被除数;
  const 商 = 绝对值 / 除数;
  const 余数 = 绝对值 % 除数;
  const 舍入商 = 余数 * 2n >= 除数 ? 商 + 1n : 商;
  return 负数 ? -舍入商 : 舍入商;
}

function 相加(左值: bigint | null, 右值: bigint | null): bigint | null {
  return 左值 === null || 右值 === null ? null : 左值 + 右值;
}

function 相减(左值: bigint | null, 右值: bigint | null): bigint | null {
  return 左值 === null || 右值 === null ? null : 左值 - 右值;
}

function 去重缺失规则(规则列表: 微盾收益缺失规则[]): 微盾收益缺失规则[] {
  const 已有 = new Set<string>();
  return 规则列表.filter((规则) => {
    const 键 = `${规则.code}|${规则.field}|${规则.targetId || ""}`;
    if (已有.has(键)) return false;
    已有.add(键);
    return true;
  });
}

function 生成输入指纹(
  输入: 微盾收益计算输入,
  质保年限: number,
  采购维保年限: number,
  公式版本: 微盾收益公式版本代码,
): string {
  const 软件明细 = (输入.softwareItems || [])
    .map((明细) => ({
      id: 明细.id,
      quantity: 规范数量文本(明细.quantity),
      discountedUnitPrice: 规范金额文本(明细.discountedUnitPrice),
      publicUnitPrice: 规范金额文本(明细.publicUnitPrice),
      scopeCode: 明细.scopeCode || null,
    }))
    .sort((左, 右) => 左.id.localeCompare(右.id));
  const 硬件明细 = (输入.hardwareItems || [])
    .map((明细) => ({
      productId: 明细.productId,
      quantity: 规范数量文本(明细.quantity),
      quoteUnitPrice: 规范金额文本(明细.quoteUnitPrice),
      internalSaleCost: 规范金额文本(明细.internalSaleCost),
      annualWarrantyMaintenanceCost:
        明细.annualWarrantyMaintenanceCost === null
          ? null
          : 规范金额文本(明细.annualWarrantyMaintenanceCost),
      scopeCode: 明细.scopeCode || null,
    }))
    .sort((左, 右) => 左.productId.localeCompare(右.productId));
  const 规范输入 = {
    formulaVersion: 公式版本,
    scopeCode: 输入.scopeCode || null,
    softwareItems: 软件明细,
    hardwareItems: 硬件明细,
    productContractAmount:
      输入.productContractAmount === undefined ? null : 规范金额文本(输入.productContractAmount),
    serviceContractAmount:
      输入.serviceContractAmount === undefined
        ? "0.000000"
        : 规范金额文本(输入.serviceContractAmount),
    warrantyYears: 质保年限,
    procurementMaintenanceYears: 采购维保年限,
  };
  return createHash("sha256").update(JSON.stringify(规范输入), "utf8").digest("hex");
}

function 规范金额文本(值: 定点金额 | null | undefined): string | null {
  if (值 === null || 值 === undefined) return null;
  return 格式金额(解析金额或抛错(值, "输入金额"));
}

function 规范数量文本(值: number | string): string {
  const 文本 = String(值);
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/.test(文本)) return 文本;
  const [整数部分 = "0", 小数部分 = ""] = 文本.split(".");
  const 缩放值 = BigInt(整数部分) * 数量倍率 + BigInt(小数部分.padEnd(4, "0") || "0");
  return 缩放值.toString();
}
