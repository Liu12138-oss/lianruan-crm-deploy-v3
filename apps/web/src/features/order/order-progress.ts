export interface 订单审批进度 {
  步骤: string[];
  当前步骤: number;
  异常: boolean;
}

const 正常审批步骤 = ["待一级确认", "区管确认", "超管确认", "已确认", "履约交付"];

const 异常步骤: Record<string, string> = {
  cancelled: "订单已取消",
  canceled: "订单已取消",
  returned_to_secondary: "已退回二级渠道商修改",
  returned_to_primary: "已退回一级渠道商修改",
  returned_to_region: "已退回区管修改",
  rejected: "订单已驳回",
  primary_rejected: "一级渠道商已驳回",
  revision_requested: "等待回退修改审核",
  replaced: "订单已替换",
  draft: "草稿待提交",
};

/** 订单顶部进度只依据真实状态计算，禁止在页面内写死任何步骤。 */
export function 计算订单审批进度(状态码: string, 状态名称 = ""): 订单审批进度 {
  const 代码 = 状态码.trim().toLowerCase();
  if (异常步骤[代码]) {
    return { 步骤: [异常步骤[代码]], 当前步骤: 0, 异常: true };
  }

  const 当前步骤 = (() => {
    if (!代码 || ["pending", "pending_primary_confirm"].includes(代码)) return 0;
    if (["primary_confirmed", "region_pending"].includes(代码)) return 1;
    if (代码 === "pending_superadmin_confirm") return 2;
    if (代码 === "confirmed") return 3;
    if (["processing", "shipped"].includes(代码)) return 4;
    // completed 时返回步骤总数，WarLayout 会把所有步骤标记为已完成。
    if (代码 === "completed") return 正常审批步骤.length;
    return -1;
  })();

  if (当前步骤 >= 0) {
    return { 步骤: 正常审批步骤, 当前步骤, 异常: false };
  }

  return {
    步骤: [状态名称.trim() || "订单状态待核对"],
    当前步骤: 0,
    异常: true,
  };
}
