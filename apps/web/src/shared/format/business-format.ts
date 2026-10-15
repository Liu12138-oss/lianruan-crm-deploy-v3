/**
 * 业务字段兼容与格式化工具。
 * 目的：V3 底座上的历史迁移数据存在空值、原始状态码、英文枚举等差异，
 * 页面必须通过本模块做兜底，不允许把 none/null/undefined/空白直接渲染到界面。
 */

const 空值集合 = new Set(["", "none", "null", "undefined", "n/a", "na", "-", "—", "nan"]);

/** 依次取第一个有效值；空字符串、none、null 等视为无效。 */
export function 文本(...候选项: unknown[]): string {
  for (const 项 of 候选项) {
    if (项 === null || 项 === undefined) continue;
    const 结果 = String(项).trim();
    if (!结果) continue;
    if (空值集合.has(结果.toLowerCase())) continue;
    return 结果;
  }
  return "";
}

export function 文本或(候选项: unknown[], 兜底: string): string {
  return 文本(...候选项) || 兜底;
}

/** 依次取第一个非空原始值（保留数字类型），用于中文键与英文历史键的兼容。 */
export function 取数(...候选项: unknown[]): unknown {
  for (const 项 of 候选项) {
    if (项 === null || 项 === undefined) continue;
    if (typeof 项 === "string" && !项.trim()) continue;
    return 项;
  }
  return undefined;
}

export function 数字(值: unknown): number {
  const 结果 = Number(值);
  return Number.isFinite(结果) ? 结果 : 0;
}

export function 金额文本(值: unknown): string {
  const 数值 = Number(值);
  if (!Number.isFinite(数值) || 数值 === 0) return "—";
  return `¥ ${数值.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}

export function 日期文本(值: unknown): string {
  const 原始 = 文本(值);
  if (!原始) return "—";
  const 日期 = new Date(原始);
  if (Number.isNaN(日期.getTime())) return 原始;
  const 补零 = (数字值: number) => String(数字值).padStart(2, "0");
  return `${日期.getFullYear()}/${补零(日期.getMonth() + 1)}/${补零(日期.getDate())}`;
}

export function 日期时间文本(值: unknown): string {
  const 原始 = 文本(值);
  if (!原始) return "—";
  const 日期 = new Date(原始);
  if (Number.isNaN(日期.getTime())) return 原始;
  const 补零 = (数字值: number) => String(数字值).padStart(2, "0");
  return `${日期.getFullYear()}/${补零(日期.getMonth() + 1)}/${补零(日期.getDate())} ${补零(日期.getHours())}:${补零(日期.getMinutes())}`;
}

export function 距今月数或天数(值: unknown): number | null {
  const 原始 = 文本(值);
  if (!原始) return null;
  const 日期 = new Date(原始);
  if (Number.isNaN(日期.getTime())) return null;
  return Math.ceil((日期.getTime() - Date.now()) / 86400000);
}

const 客户状态映射: Record<string, string> = {
  pending: "待审核",
  approved: "已通过",
  rejected: "已驳回",
  expired: "已过期",
  draft: "草稿",
  active: "启用",
  disabled: "停用",
};

export function 客户状态文本(状态码: unknown, 状态名?: unknown): string {
  const 名称 = 文本(状态名);
  if (名称) return 名称;
  const 代码 = 文本(状态码);
  return 客户状态映射[代码] || (代码 ? `${代码}（未知状态）` : "未知状态");
}

const 渠道等级映射: Record<string, string> = {
  none: "未分级",
  silver: "银牌",
  gold: "金牌",
  primary: "一级渠道",
  secondary: "二级渠道",
  lep: "核心渠道",
};

export function 渠道等级文本(等级码: unknown): string {
  const 代码 = 文本(等级码);
  return 渠道等级映射[代码] || (代码 ? 代码 : "未分级");
}

export function 渠道等级样式(等级码: unknown): string {
  const 代码 = 文本(等级码);
  if (代码 === "primary" || 代码 === "lep") return "blue";
  if (代码 === "gold") return "amber";
  if (代码 === "silver") return "gray";
  if (代码 === "secondary") return "green";
  return "gray";
}

const 订单状态映射: Record<string, string> = {
  pending: "待一级确认",
  pending_primary_confirm: "待一级确认",
  primary_confirmed: "一级已确认",
  region_pending: "待区管确认",
  pending_superadmin_confirm: "待超管确认",
  returned_to_region: "已退回区管",
  returned_to_primary: "已退回一级",
  returned_to_secondary: "已退回二级",
  confirmed: "已确认",
  processing: "处理中",
  shipped: "已发货",
  completed: "已完成",
  cancelled: "已取消",
  primary_rejected: "一级已驳回",
  rejected: "已驳回",
  revision_requested: "待回退修改审核",
  replaced: "已替换",
};

export function 订单状态文本(状态码: unknown, 状态名?: unknown): string {
  const 名称 = 文本(状态名);
  if (名称) return 名称;
  const 代码 = 文本(状态码);
  return 订单状态映射[代码] || (代码 ? `${代码}（未知状态）` : "未知状态");
}

export function 订单状态样式(状态码: unknown): string {
  const 代码 = 文本(状态码);
  if (["completed", "confirmed"].includes(代码)) return "green";
  if (["cancelled", "returned_to_region", "returned_to_primary", "returned_to_secondary"].includes(代码))
    return "red";
  if (["pending", "pending_primary_confirm", "pending_superadmin_confirm", "region_pending"].includes(代码))
    return "amber";
  return "blue";
}

export function 是本月(值: unknown): boolean {
  const 原始 = 文本(值);
  if (!原始) return false;
  const 日期 = new Date(原始);
  if (Number.isNaN(日期.getTime())) return false;
  const 今天 = new Date();
  return 日期.getFullYear() === 今天.getFullYear() && 日期.getMonth() === 今天.getMonth();
}
