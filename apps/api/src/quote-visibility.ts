export type 报价类型代码 = "standard" | "channel_distribution";

const 标准报价禁止字段 = new Set([
  "金额",
  "单价",
  "小计",
  "总价",
  "原价",
  "成交价",
  "报价金额",
  "报价总额",
  "amount",
  "total",
  "totalAmount",
  "originalAmount",
  "quoteAmount",
  "lineAmount",
  "unitPrice",
  "publicUnitPrice",
  "discount",
  "discountAmount",
  "折扣",
  "折扣金额",
  "定价明细",
  "pricingBreakdown",
  "渠道价格参考",
  "channelPrices",
  "regionPrices",
  "tiers",
  "price",
  "listPrice",
  "channelPrice",
  "primaryPrice",
  "secondaryPrice",
  "standardUnitPrice",
  "regionUnitPrice",
  "finalUnitPrice",
]);

const 价格类字段模式 =
  /(price|amount|profit|margin|total|difference|discount|定价|单价|金额|小计|总价|折扣|差额|利润|毛利)/i;

/** 统一解析报价类型，兼容前端中文、历史英文和空值默认值。 */
export function 解析报价类型(value: unknown): 报价类型代码 {
  const 文本 = String(value ?? "")
    .trim()
    .toLowerCase();
  if (["standard", "标准", "标准产品报价", "标准报价"].includes(文本)) return "standard";
  return "channel_distribution";
}

export function 报价类型名称(value: unknown): string {
  return 解析报价类型(value) === "standard" ? "标准产品报价" : "渠道分销产品报价";
}

/** 递归移除标准报价中的价格字段，保留产品、数量、类型、工作量和状态等业务信息。 */
export function 移除标准报价价格字段<T>(数据: T): T {
  if (Array.isArray(数据)) return 数据.map((项) => 移除标准报价价格字段(项)) as T;
  if (!数据 || typeof 数据 !== "object" || 数据 instanceof Date) return 数据;
  return Object.fromEntries(
    Object.entries(数据 as Record<string, unknown>)
      .filter(([键]) => !标准报价禁止字段.has(键) && !价格类字段模式.test(键))
      .map(([键, 值]) => [键, 移除标准报价价格字段(值)]),
  ) as T;
}

/** 对单条报价记录执行服务端脱敏；非标准报价仅补充类型字段，不改变原有价格口径。 */
export function 构建报价公开记录<
  T extends {
    金额: number;
    原始数据: Record<string, unknown>;
  },
>(记录: T, 类型: 报价类型代码): T {
  const 原始数据 = 记录.原始数据 || {};
  const 类型信息 = {
    quoteTypeCode: 类型,
    quoteTypeName: 报价类型名称(类型),
  };
  if (类型 !== "standard") {
    return { ...记录, 原始数据: { ...原始数据, ...类型信息, priceVisible: true } };
  }
  const 脱敏原始数据 = 移除标准报价价格字段(原始数据);
  return {
    ...记录,
    金额: 0,
    原始数据: {
      ...脱敏原始数据,
      ...类型信息,
      priceVisible: false,
      pricingNote: "标准产品报价不展示价格，订单价格由区管在审批环节补充。",
    },
  };
}

/** 对试算响应执行标准报价脱敏，保留产品明细、数量和工作量。 */
export function 构建报价试算公开视图<T>(试算: T, 类型: 报价类型代码): T {
  if (类型 !== "standard") return 试算;
  return {
    ...移除标准报价价格字段(试算),
    quoteTypeCode: 类型,
    quoteTypeName: 报价类型名称(类型),
    priceVisible: false,
    total: 0,
  } as T;
}
