/**
 * 渠道用户可见的产品字段口径：产品目录、功能、套餐与产品树只允许展示
 * 名称、模块和业务描述；价格、折扣、渠道等级比例及价格维护时间均不可见。
 */
export const 产品价格字段 = new Set([
  "金额",
  "priceFixed",
  "listPrice",
  "list_price",
  "price",
  "unitPrice",
  "publicUnitPrice",
  "priceType",
  "discount",
  "priceRatioUpdatedAt",
  "regionPriceUpdatedAt",
  "tiers",
  "regionPriceOverrides",
  "priceForPrimary",
  "priceForSecondary",
  "priceRatioPrimary",
  "priceRatioSecondary",
  "priceRule",
  "pricingBasis",
  "maintenanceModuleRates",
  "maintenanceFeatureOverrides",
  "maintenancePrice",
  "channelPrice",
  "channelPrices",
  "primaryPrice",
  "secondaryPrice",
  "regionPrices",
  "priceTiers",
]);

/** 递归移除产品响应中的价格字段，数组与嵌套对象按同一口径处理。 */
export function 移除产品价格字段<T>(数据: T): T {
  if (Array.isArray(数据)) return 数据.map((项) => 移除产品价格字段(项)) as T;
  if (!数据 || typeof 数据 !== "object") return 数据;
  return Object.fromEntries(
    Object.entries(数据 as Record<string, unknown>)
      .filter(([键]) => !产品价格字段.has(键))
      .map(([键, 值]) => [键, 移除产品价格字段(值)]),
  ) as T;
}
