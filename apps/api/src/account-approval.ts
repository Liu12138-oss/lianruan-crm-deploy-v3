export type 账号审批阶段 = "region_review" | "superadmin_review";

export const 账号审批目标类型 = new Set(["user", "staff", "account"]);

export function 是账号审批目标(目标类型: string): boolean {
  return 账号审批目标类型.has(目标类型.trim().toLowerCase());
}

/** 历史待办没有阶段字段时按超管终审兼容，避免存量审批无法处理。 */
export function 读取账号审批阶段(
  扩展数据: Record<string, unknown> | null | undefined,
): 账号审批阶段 {
  const 原始阶段 = String(
    扩展数据?.approvalStage ?? 扩展数据?.approval_stage ?? 扩展数据?.stage ?? "",
  )
    .trim()
    .toLowerCase();
  if (["region_review", "region", "region_approve"].includes(原始阶段)) return "region_review";
  return "superadmin_review";
}

export function 账号审批阶段名称(阶段: 账号审批阶段): string {
  return 阶段 === "region_review" ? "待区管初审" : "待超管终审";
}

/** 审批详情展示用户可读步骤，不把内部阶段代码直接暴露到页面。 */
export function 账号审批步骤名称(
  阶段: 账号审批阶段,
  状态: "pending" | "approved" | "rejected" | "cancelled" | string,
): string {
  if (状态 === "approved") return "审批已通过";
  if (状态 === "rejected") {
    return 阶段 === "region_review" ? "区管初审已驳回" : "超管终审已驳回";
  }
  if (状态 === "cancelled") return "审批已取消";
  return 账号审批阶段名称(阶段);
}

/** 企业管理员提交先走区管；区管提交直接进入超管终审，避免自审。 */
export function 初始账号审批阶段(提交人角色: string): 账号审批阶段 {
  return 提交人角色 === "partner_admin" ? "region_review" : "superadmin_review";
}
