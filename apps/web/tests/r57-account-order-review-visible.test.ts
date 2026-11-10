import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const 读取 = (路径: string) => readFile(resolve(process.cwd(), 路径), "utf8");

describe("账号审批、客户驳回与订单完成态展示", () => {
  it("账号审批详情展示账号身份、渠道、区域与联系方式", async () => {
    const 页面 = await 读取("src/features/approval/ApprovalCenterPage.vue");
    expect(页面).toContain("账号信息");
    expect(页面).toContain("登录账号");
    expect(页面).toContain("账号类型");
    expect(页面).toContain("所属渠道");
    expect(页面).toContain('字段(审批, "phone")');
  });

  it("客户列表与档案展示已驳回状态和驳回原因", async () => {
    const 页面 = await 读取("src/features/customer/CustomerManagementPage.vue");
    expect(页面).toContain('标签列表 = ["全部", "待审核", "已驳回", "保护期内"]');
    expect(页面).toContain("驳回原因：");
    expect(页面).toContain("报备驳回原因");
    expect(页面).toContain("row.状态 === 'rejected'");
  });

  it("渠道用户一级确认后的订单保留在已完成分区", async () => {
    const 页面 = await 读取("src/features/order/OrderCenterPage.vue");
    expect(页面).toContain("订单匹配列表分区");
    expect(页面).toContain("判断平台角色");
  });
});
