import { describe, expect, it } from "vitest";

import { 计算订单审批进度 } from "../src/features/order/order-progress.js";

describe("订单顶部审批进度", () => {
  it.each([
    ["pending_primary_confirm", 0],
    ["pending", 0],
    ["primary_confirmed", 1],
    ["region_pending", 1],
    ["pending_superadmin_confirm", 2],
    ["confirmed", 3],
    ["processing", 4],
    ["shipped", 4],
  ])("状态 %s 对应正常步骤 %s", (状态, 步骤) => {
    const 进度 = 计算订单审批进度(状态);
    expect(进度).toMatchObject({
      步骤: ["待一级确认", "区管确认", "超管确认", "已确认", "履约交付"],
      当前步骤: 步骤,
      异常: false,
    });
  });

  it("已完成订单将五个步骤全部标记为完成", () => {
    expect(计算订单审批进度("completed")).toEqual({
      步骤: ["待一级确认", "区管确认", "超管确认", "已确认", "履约交付"],
      当前步骤: 5,
      异常: false,
    });
  });

  it.each([
    ["cancelled", "订单已取消"],
    ["returned_to_region", "已退回区管修改"],
    ["returned_to_primary", "已退回一级渠道商修改"],
    ["returned_to_secondary", "已退回二级渠道商修改"],
    ["rejected", "订单已驳回"],
    ["primary_rejected", "一级渠道商已驳回"],
    ["revision_requested", "等待回退修改审核"],
    ["replaced", "订单已替换"],
  ])("异常状态 %s 不展示正常审批轨道", (状态, 文案) => {
    expect(计算订单审批进度(状态)).toEqual({ 步骤: [文案], 当前步骤: 0, 异常: true });
  });
});
