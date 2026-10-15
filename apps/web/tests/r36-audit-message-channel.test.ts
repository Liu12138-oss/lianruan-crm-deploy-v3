import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const 根目录 = process.cwd();

async function 读取(路径: string): Promise<string> {
  return readFile(resolve(根目录, 路径), "utf8");
}

describe("R36 审计分类、消息返回与渠道环节", () => {
  it("操作审计提供六类业务分类筛选并传参给服务端", async () => {
    const [审计页, 客户端] = await Promise.all([
      读取("src/features/platform/AuditLogPage.vue"),
      读取("src/api/business-client.ts"),
    ]);

    for (const 分类 of ["客户操作", "线索操作", "商机操作", "渠道操作", "订单操作", "后台管理操作"]) {
      expect(审计页).toContain(分类);
    }
    expect(审计页).toContain("当前分类");
    expect(审计页).toContain("module: 分类");
    expect(客户端).toContain('search.set("module"');
  });

  it("消息渠道配置与规则分类提供统一返回按钮，且页面不再直接展示英文事件代码", async () => {
    const 消息设置 = await 读取("src/features/message/MessageSettingsPage.vue");

    expect(消息设置).toContain("返回消息列表");
    expect(消息设置).toContain("路由器.push");
    expect(消息设置).toContain("/admin/notifications");
    expect(消息设置).toContain('class="返回按钮"');
    expect(消息设置).toContain("事件中文名");
    expect(消息设置).not.toContain('文本(模板.eventCode, "—")');
  });

  it("渠道商页用六环节替代阶段条，并展示活跃度、业务能力与原厂资质", async () => {
    const 渠道页 = await 读取("src/features/channel/ChannelListPage.vue");

    for (const 环节 of [
      "初次拜访",
      "统一培训",
      "客户开放（协同拜访）",
      "技术认证情况",
      "商机报备情况",
      "首单合作成功",
    ]) {
      expect(渠道页).toContain(环节);
    }
    expect(渠道页).toContain("持续运营阶段");
    expect(渠道页).toContain("活跃度（当年）");
    expect(渠道页).toContain("客单价");
    expect(渠道页).toContain("原厂资质");
    expect(渠道页).toContain("cooperationSteps");
    expect(渠道页).not.toContain("续签评估");
  });
});
