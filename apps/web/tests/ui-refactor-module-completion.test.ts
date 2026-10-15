import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const 根目录 = process.cwd();

async function 读取(路径: string): Promise<string> {
  return readFile(resolve(根目录, 路径), "utf8");
}

describe("UI 重构模块补齐", () => {
  it("提供客户跟进、渠道成员、订单动作和价格规则正式页面", async () => {
    const [路由, 客户跟进, 渠道成员, 订单动作, 价格规则, 证书风险, 消息设置] = await Promise.all([
      读取("src/router/index.ts"),
      读取("src/features/customer/CustomerFollowupPage.vue"),
      读取("src/features/channel/ChannelMembersPage.vue"),
      读取("src/features/order/OrderActionCenterPage.vue"),
      读取("src/features/product/PricingRulesPage.vue"),
      读取("src/features/certificate/CertificateRiskPage.vue"),
      读取("src/features/message/MessageSettingsPage.vue"),
    ]);

    expect(路由).toContain('path: "registration/:id/followup"');
    expect(路由).toContain('path: "partners/:id/members"');
    expect(路由).toContain('path: "order/:id/actions"');
    expect(路由).toContain('path: "products/pricing"');
    expect(路由).toContain('path: "certifications"');
    expect(路由).toContain('path: "notifications/platform"');
    expect(路由).toContain('path: "notifications/rules"');

    expect(客户跟进).toContain("编辑客户档案");
    expect(客户跟进).toContain("记录客户跟进");
    expect(渠道成员).toContain("新增渠道成员");
    expect(渠道成员).toContain("重置密码");
    expect(订单动作).toContain("一级确认");
    expect(订单动作).toContain("区管调价");
    expect(订单动作).toContain("超管退回");
    expect(订单动作).toContain("修订后重新提交");
    expect(价格规则).toContain("基础阶梯价");
    expect(价格规则).toContain("区域价格覆盖");
    expect(价格规则).toContain("渠道价格比例");
    expect(证书风险).toContain("证书模板");
    expect(证书风险).toContain("30 天内到期");
    expect(消息设置).toContain("消息渠道配置");
    expect(消息设置).toContain("提醒规则与模板");
  });

  it("商机详情创建报价时带入当前商机编号", async () => {
    const 工作区 = await 读取("src/pages/BusinessWorkspacePage.vue");

    expect(工作区).toContain("function 产品报价路径(row?: 阶段9记录)");
    expect(工作区).toContain("?opportunityId=${encodeURIComponent(opportunityId)}");
    expect(工作区).toContain("路由.query.opportunityId || 路由.query.oppId");
    expect(工作区).toContain("async function 发送报价");
    expect(工作区).toContain("async function 撤回报价");
  });

  it("管理配置二级菜单提供组织、证书、审核、消息、审计与开放接口正式入口", async () => {
    const [运维页, 消息页, 导航] = await Promise.all([
      读取("src/features/platform/PlatformCenterPage.vue"),
      读取("src/features/message/MessageCenterPage.vue"),
      读取("src/shared/navigation/admin-navigation.ts"),
    ]);

    // 管理配置功能统一挂在顶部「配置」一级菜单的二级菜单里，不再放在业务全景页。
    for (const 路径 of [
      "/admin/organization",
      "/admin/certifications",
      "/admin/admin-review",
      "/admin/notifications/platform",
      "/admin/audit-logs",
      "/admin/openapi-integration",
    ]) {
      expect(导航).toContain(`路径: "${路径}"`);
    }
    expect(导航).toContain("子项");
    expect(运维页).not.toContain("/admin/certifications");
    expect(消息页).toContain('to="/admin/notifications/platform"');
    expect(消息页).toContain('to="/admin/notifications/rules"');
  });

  it("审核中心提供独立一级入口与待审批 / 已审批双分区", async () => {
    const [导航, 审批页] = await Promise.all([
      读取("src/shared/navigation/admin-navigation.ts"),
      读取("src/features/approval/ApprovalCenterPage.vue"),
    ]);

    // 一级入口：审核中心不藏在配置二级菜单里，超管与区域管理员都能直接进入。
    expect(导航).toContain('名称: "审核中心", 简称: "审核", 路径: "/admin/admin-review"');
    // 配置里的「审核与业务规则」保留跳转但不再参与激活，避免双高亮。
    expect(导航).toContain('if (子项.路径 === "/admin/admin-review") return false;');
    // 审批页提供待审批与已审批两个分区，已审批作为留存。
    expect(审批页).toContain("待审批 {{ 待处理列表.length }}");
    expect(审批页).toContain("已审批 {{ 已处理列表.length }}");
    expect(审批页).toContain('{{ 当前分区 === "待审批" ? "处理" : "查看业务" }}');
  });
});
