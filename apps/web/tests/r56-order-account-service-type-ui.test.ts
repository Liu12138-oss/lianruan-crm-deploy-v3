import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

async function 读取(相对路径: string): Promise<string> {
  return readFile(resolve(process.cwd(), 相对路径), "utf8");
}

describe("订单进度、账号审批与技术服务商界面回归", () => {
  it("订单中心使用真实状态计算顶部审批进度", async () => {
    const 源码 = await 读取("src/features/order/OrderCenterPage.vue");

    expect(源码).toContain(':当前步骤="当前订单进度.当前步骤"');
    expect(源码).not.toMatch(/:当前步骤="1"/);
  });

  it("企业管理员拥有独立成员维护入口，并由菜单角色控制显示", async () => {
    const 路由源码 = await 读取("src/router/index.ts");
    const 布局源码 = await 读取("src/layouts/PartnerLayout.vue");

    expect(路由源码).toContain('path: "members"');
    expect(路由源码).toContain('name: "管理端渠道成员维护"');
    expect(路由源码).toContain('描述: "企业管理员维护本渠道员工账号并提交区管、超管审批。"');
    expect(布局源码).toContain("function 是渠道企业管理员(): boolean");
    expect(布局源码).toContain('用户?.roles?.includes("partner_admin")');
    expect(布局源码).toContain("渠道管理员|企业管理员|渠道企业管理员");
    expect(布局源码).toContain('"partner_user_info", "partner_api_user", "api_user"');
  });

  it("账号审批按区管初审和超管终审限制操作人", async () => {
    const 源码 = await 读取("src/features/approval/ApprovalCenterPage.vue");

    expect(源码).toContain(
      'if (审批阶段(row) === "region_review") return 是区域管理员(会话.user);',
    );
    expect(源码).toContain("return 是超级管理员(会话.user);");
    expect(源码).toContain(
      'return 审批阶段(row) === "region_review" ? "区管初审通过" : "终审通过";',
    );
    expect(源码).toContain(
      'return 审批阶段(row) === "region_review" ? "待区管初审" : "待超管终审";',
    );
    expect(源码).toContain("function 最终审批人");
    expect(源码).toContain('字段(row, "approvedBy", "reviewedByName", "updatedByName")');
    expect(源码).toContain("function 最终审批时间");
    expect(源码).toContain('字段(row, "approvedAt", "reviewedAt")');
  });

  it("组织与岗位页不再展示顶部任意账号检索框", async () => {
    const 源码 = await 读取("src/pages/admin/platform-admin/OrganizationWorkspacePage.vue");

    expect(源码).not.toContain("检索任意内部账号");
    expect(源码).toContain("搜索成员姓名/用户名");
  });

  it("渠道标题区展示技术服务商业务类型", async () => {
    const 源码 = await 读取("src/features/channel/ChannelListPage.vue");

    expect(源码).toContain("技术服务商：{{ 技术服务商类型文本(当前渠道) }}");
    expect(源码).toContain('return "非技术服务商";');
  });
});
