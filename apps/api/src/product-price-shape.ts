/**
 * 产品价格历史结构兼容。
 *
 * V2 迁移数据中，渠道专用价可能保存为数字、单个价格对象或档位数组；
 * 区域覆盖内也可能混用这些结构。本模块只统一数据形状和空占位档位，
 * 不推断、不修改任何真实价格。
 */
export interface 标准价格档位 {
  min: number;
  max: number;
  price: number;
}

export type 价格层级 = "primary" | "secondary";

const 单档价格上限 = 999999;

function 读取有限数字(值: unknown): number | null {
  if (typeof 值 === "number" && Number.isFinite(值)) return 值;
  if (typeof 值 === "string" && 值.trim() && Number.isFinite(Number(值))) return Number(值);
  return null;
}

/**
 * 将历史价格转换为档位数组。
 * - `0-0` 是旧页面保存的空占位档位，直接忽略；
 * - `0-1` 等从 0 开始的档位按端点口径归一到 1；
 * - 标量价格视为覆盖全部端点数量的单档价格；
 * - 渠道价格对象支持 `{ primary, secondary }` 和 `{ min, max, price }` 两种历史写法。
 */
export function 规范化历史价格档位(值: unknown, 层级?: 价格层级): unknown[] {
  if (值 === null || 值 === undefined || 值 === "") return [];
  if (Array.isArray(值)) {
    return 值.flatMap((项) => 规范化历史价格档位(项, 层级));
  }
  const 数字值 = 读取有限数字(值);
  if (数字值 !== null) {
    if (数字值 < 0) return [];
    return [{ min: 1, max: 单档价格上限, price: 数字值 }];
  }
  if (typeof 值 !== "object") return [];
  const 记录 = 值 as Record<string, unknown>;
  if (层级 && Object.prototype.hasOwnProperty.call(记录, 层级)) {
    return 规范化历史价格档位(记录[层级], 层级);
  }
  if (
    Object.prototype.hasOwnProperty.call(记录, "min") ||
    Object.prototype.hasOwnProperty.call(记录, "max")
  ) {
    const 起始 = 读取有限数字(记录.min);
    const 结束 = 读取有限数字(记录.max);
    const 价格 = 读取有限数字(记录.price);
    if (起始 === null || 结束 === null || 价格 === null) return [];
    if (起始 === 0 && 结束 === 0) return [];
    return [
      {
        ...记录,
        min: 起始 < 1 ? 1 : 起始,
        max: 结束,
        price: 价格,
      },
    ];
  }
  if (Object.prototype.hasOwnProperty.call(记录, "price")) {
    const 价格 = 读取有限数字(记录.price);
    return 价格 === null || 价格 < 0 ? [] : [{ min: 1, max: 单档价格上限, price: 价格 }];
  }
  return [];
}

/** 区域价格覆盖兼容历史结构与多区域字段，其他业务字段原样保留。 */
export function 规范化区域价格覆盖(值: unknown): unknown[] {
  if (!Array.isArray(值)) return [];
  return 值
    .filter((项) => 项 && typeof 项 === "object" && !Array.isArray(项))
    .map((项) => {
      const 记录 = 项 as Record<string, unknown>;
      const 区域列表 = Array.isArray(记录.regions)
        ? 记录.regions.map((区域) => String(区域 || "").trim()).filter(Boolean)
        : [];
      const 单项区域 = String(记录.region || "").trim();
      return {
        ...记录,
        regions: Array.from(new Set([...(单项区域 ? [单项区域] : []), ...区域列表])),
        tiers: 规范化历史价格档位(记录.tiers),
        priceForPrimary: 规范化历史价格档位(记录.priceForPrimary, "primary"),
        priceForSecondary: 规范化历史价格档位(记录.priceForSecondary, "secondary"),
      };
    });
}

/** 保存前统一历史结构，避免校验器把空占位档位或旧对象格式误判为非法。 */
export function 标准化功能价格输入(输入: Record<string, unknown>): Record<string, unknown> {
  return {
    ...输入,
    tiers: 规范化历史价格档位(输入.tiers),
    priceForPrimary: 规范化历史价格档位(输入.priceForPrimary, "primary"),
    priceForSecondary: 规范化历史价格档位(输入.priceForSecondary, "secondary"),
    regionPriceOverrides: 规范化区域价格覆盖(输入.regionPriceOverrides),
  };
}
