import type { 平台角色 } from "../../shared/permission/role.js";

export type 订单列表分区 = "全部" | "待我处理" | "已完成";

const 通用待处理 = new Set([
  "pending",
  "pending_primary_confirm",
  "region_pending",
  "primary_confirmed",
  "pending_superadmin_confirm",
  "returned_to_primary",
  "returned_to_secondary",
  "returned_to_region",
]);

const 渠道已完成 = new Set([
  "primary_confirmed",
  "pending_superadmin_confirm",
  "confirmed",
  "processing",
  "shipped",
  "completed",
]);

const 区管已完成 = new Set([
  "pending_superadmin_confirm",
  "confirmed",
  "processing",
  "shipped",
  "completed",
]);

const 超管已完成 = new Set(["confirmed", "processing", "shipped", "completed"]);

/**
 * 订单中心分区按当前账号的真实待办口径计算。
 * 渠道用户完成一级确认后，订单进入区管环节，但对该渠道仍属于“已完成”。
 */
export function 订单匹配列表分区(状态: string, 分区: 订单列表分区, 角色: 平台角色): boolean {
  if (分区 === "全部") return true;
  if (分区 === "待我处理") {
    if (角色 === "region_manager")
      return ["primary_confirmed", "returned_to_region"].includes(状态);
    if (角色 === "superadmin") return 状态 === "pending_superadmin_confirm";
    return 通用待处理.has(状态);
  }
  if (角色 === "region_manager") return 区管已完成.has(状态);
  if (角色 === "superadmin") return 超管已完成.has(状态);
  return 渠道已完成.has(状态);
}
