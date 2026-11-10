import type { 阶段9记录 } from "../../api/business-client.js";

export type 渠道分销层级代码 = "none" | "primary" | "secondary";

function 原始数据(row: 阶段9记录): Record<string, unknown> {
  return (row.原始数据 as Record<string, unknown>) || {};
}

function 文本(值: unknown): string {
  return 值 === undefined || 值 === null ? "" : String(值).trim();
}

function 有效下级编号(row: 阶段9记录): string[] {
  const 下级 = 原始数据(row).childPartnerIds;
  if (!Array.isArray(下级)) return [];
  return 下级.map(文本).filter(Boolean);
}

/**
 * 分销层级以有效下级关系为最高优先级。
 * 历史数据中部分一级渠道的主档字段为 none，但关系表已有下级，不能因此丢失一级身份。
 */
export function 读取渠道分销层级(row: 阶段9记录): 渠道分销层级代码 {
  if (有效下级编号(row).length) return "primary";
  const 原始 = 原始数据(row);
  const 主档层级 = 文本(原始.partnerLevel).toLowerCase();
  if (主档层级 === "primary" || 主档层级 === "secondary") return 主档层级;
  const 兼容层级 = 文本(原始.level).toLowerCase();
  if (兼容层级 === "primary" || 兼容层级 === "secondary") return 兼容层级;
  return "none";
}

/** 新建或维护二级渠道时，只允许选择同区域、生效中的有效一级渠道。 */
export function 渠道可作一级上级(row: 阶段9记录, 区域: string): boolean {
  const 目标区域 = 文本(区域);
  if (!目标区域) return false;
  const 原始 = 原始数据(row);
  const 状态 = 文本(原始.status || row.状态).toLowerCase();
  if (!["active", "启用", "合作中"].includes(状态)) return false;
  const 渠道区域 = 文本(原始.region || row.区域);
  return 渠道区域 === 目标区域 && 读取渠道分销层级(row) === "primary";
}

/** 切换区域或层级后，只保留当前仍有效的上级编号。 */
export function 清理有效上级编号(候选: 阶段9记录[], 区域: string, 已选编号: string[]): string[] {
  const 有效编号 = new Set(
    候选
      .filter((row) => 渠道可作一级上级(row, 区域))
      .map((row) => 文本(原始数据(row).id) || 文本(row.编号) || 文本(row.id)),
  );
  return 已选编号.filter((编号) => 有效编号.has(编号));
}
