import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const 根目录 = process.cwd();

async function 读取(路径: string): Promise<string> {
  return readFile(resolve(根目录, 路径), "utf8");
}

describe("R44 工作台待办溢出与客户报备商机提交", () => {
  it("端点数量为数字输入时不再调用字符串 trim", async () => {
    const 客户页 = await 读取("src/features/customer/CustomerManagementPage.vue");

    expect(客户页).toContain('v-model="报备商机表单.端点数量" type="number"');
    expect(客户页).toContain("endpoints: Number(报备商机表单.端点数量) || 0");
    expect(客户页).not.toContain("报备商机表单.端点数量.trim()");
  });

  it("工作台待办卡片限制在面板内并对超长标题显示省略号", async () => {
    const 工作台 = await 读取("src/features/dashboard/DashboardPage.vue");

    expect(工作台).toMatch(
      /\.dashboard-body \.record-card \{[\s\S]*?min-width: 0;[\s\S]*?max-width: 100%;[\s\S]*?overflow: hidden;/,
    );
    expect(工作台).toMatch(
      /\.dashboard-body \.record-top strong \{[\s\S]*?flex: 1 1 auto;[\s\S]*?min-width: 0;/,
    );
    expect(工作台).toMatch(
      /\.dashboard-body \.record-top \.status \{[\s\S]*?flex: 0 0 auto;[\s\S]*?white-space: nowrap;/,
    );
  });

  it("订单页优先使用服务端姓名，区管不再读取管理账号目录", async () => {
    const [订单列表, 订单处理] = await Promise.all([
      读取("src/features/order/OrderCenterPage.vue"),
      读取("src/features/order/OrderActionCenterPage.vue"),
    ]);

    for (const 页面 of [订单列表, 订单处理]) {
      expect(页面).not.toContain("查询账号目录");
      expect(页面).toContain('regionConfirmedByName", "regionConfirmedByUsername');
    }
  });
});
