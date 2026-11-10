import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const 根目录 = process.cwd();

async function 读取(路径: string): Promise<string> {
  return readFile(resolve(根目录, 路径), "utf8");
}

describe("UI 重构模块补齐", () => {
  it("客户跟进收口，渠道成员、订单动作和价格规则保留正式页面", async () => {
    const [路由, 客户页, 渠道成员, 订单动作, 价格规则, 产品目录, 证书风险, 消息设置] =
      await Promise.all([
        读取("src/router/index.ts"),
        读取("src/features/customer/CustomerManagementPage.vue"),
        读取("src/features/channel/ChannelMembersPage.vue"),
        读取("src/features/order/OrderActionCenterPage.vue"),
        读取("src/features/product/PricingRulesPage.vue"),
        读取("src/features/product/ProductCatalogPage.vue"),
        读取("src/features/certificate/CertificateRiskPage.vue"),
        读取("src/features/message/MessageSettingsPage.vue"),
      ]);

    expect(路由).not.toContain('path: "registration/:id/followup"');
    expect(路由).toContain('path: "partners/:id/members"');
    expect(路由).toContain('path: "order/:id/actions"');
    expect(路由).toContain('path: "products/pricing"');
    expect(路由).toContain('path: "certifications"');
    expect(路由).toContain('path: "notifications/platform"');
    expect(路由).toContain('path: "notifications/rules"');

    expect(客户页).not.toContain('aria-labelledby="记录客户跟进标题"');
    expect(客户页).not.toContain('@submit.prevent="保存跟进"');
    expect(渠道成员).toContain("新增渠道成员");
    expect(渠道成员).toContain("重置密码");
    expect(订单动作).toContain("一级确认");
    expect(订单动作).toContain("区管调价");
    expect(订单动作).toContain("超管退回");
    expect(订单动作).toContain("修订后重新提交");
    expect(价格规则).toContain("基础阶梯价");
    expect(价格规则).toContain("区域价格覆盖");
    expect(价格规则).toContain("渠道价格比例");
    expect(价格规则).toContain("维护价格规则");
    expect(价格规则).toContain("editFeature: 产品.id");
    // 区域覆盖必须从正式组织区域中选择，避免自由文本导致价格规则无法命中。
    expect(产品目录).toContain("查询区域列表");
    expect(产品目录).toContain("可选区域");
    expect(产品目录).toContain('v-model="覆盖.regions"');
    expect(产品目录).toContain('aria-label="生效区域"');
    expect(产品目录).toContain("multiple");
    expect(产品目录).toContain("同步区域覆盖(覆盖)");
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

  it("价格规则维护入口使用产品编码打开功能产品编辑器", async () => {
    const 定价页 = await 读取("src/features/product/PricingCenterPage.vue");

    expect(定价页).toContain('字段(产品, "productCode")');
    expect(定价页).toContain("/admin/products?editFeature=");
    expect(定价页).not.toContain("encodeURIComponent(产品.id)");
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
      "/admin/organization/business-roles",
      "/admin/organization/data-scopes",
      "/admin/workload-config",
      "/admin/data-import-export",
    ]) {
      expect(导航).toContain(`路径: "${路径}"`);
    }
    expect(导航).toContain("子项");
    expect(运维页).not.toContain("/admin/certifications");
    expect(消息页).toContain('to="/admin/notifications/platform"');
    expect(消息页).toContain('to="/admin/notifications/rules"');
  });

  it("证书延期与撤销携带行版本和幂等键，商机报价状态统一为已通过", async () => {
    const [证书页, 商机页] = await Promise.all([
      读取("src/features/certificate/CertificateCenterPage.vue"),
      读取("src/features/opportunity/OpportunityCenterPage.vue"),
    ]);

    expect(证书页).toContain("rowVersion: 当前证书.value.rowVersion");
    expect(证书页).toContain("幂等键: `cert-extend-${Date.now()}`");
    expect(证书页).toContain("幂等键: `cert-revoke-${Date.now()}`");
    expect(商机页).toContain('approved: "已通过"');
    expect(商机页).not.toContain('approved: "已确认"');
  });

  it("消息已读写回服务端，迁移状态与返回按钮使用业务中文和统一位置", async () => {
    const [消息页, 作战消息页, 系统状态, 审计页, 价格规则, 消息设置, 资质审核] = await Promise.all([
      读取("src/features/message/MessageCenterPage.vue"),
      读取("src/features/message/MessageCenterWarPage.vue"),
      读取("src/features/platform/SystemStatusPage.vue"),
      读取("src/features/platform/AuditLogPage.vue"),
      读取("src/features/product/PricingCenterPage.vue"),
      读取("src/features/message/MessageSettingsPage.vue"),
      读取("src/features/channel/ChannelQualificationApprovalPage.vue"),
    ]);

    expect(消息页).toContain("await 标记统一消息已读(消息.id)");
    expect(消息页).toContain("await 标记统一消息已读()");
    expect(消息页).not.toContain("示例消息()");
    // 正式状态优先于 V2 迁移快照中的 unread 字段，避免已读消息被误判为未读。
    expect(作战消息页).toContain('if (状态 === "read") return true;');
    expect(作战消息页).toContain('if (状态 === "unread") return false;');
    expect(系统状态).toContain('validated: "已校验"');
    expect(审计页).toContain("迁移字段中文(迁移状态?.正式落表)");
    // 依赖检查只展示业务说明，接口中的技术组件名和原始 message 不得直出页面。
    expect(系统状态).toContain("依赖业务说明(项.name, 项.status)");
    expect(系统状态).not.toContain("文本(项.message");
    expect(审计页).toContain("依赖业务说明(项.name, 项.status)");
    expect(审计页).not.toContain("文本(项.message");
    expect(价格规则).toContain("padding: 0 42px");
    expect(价格规则).toContain("grid-template-rows: 96px 96px minmax(0, 1fr) !important");
    expect(消息设置).toContain("grid-template-rows: 45px 96px minmax(0, 1fr)");
    expect(消息设置).toContain("padding-top: 0");
    expect(消息设置).toContain("padding: 0 42px");
    expect(资质审核).toContain("padding: 23px 25px 0");
  });

  it("审核中心提供独立一级入口与待审批 / 已审批双分区", async () => {
    const [导航, 审批页, 渠道成员页, 业务客户端, 顶栏动作, 组织页] = await Promise.all([
      读取("src/shared/navigation/admin-navigation.ts"),
      读取("src/features/approval/ApprovalCenterPage.vue"),
      读取("src/features/channel/ChannelMembersPage.vue"),
      读取("src/api/business-client.ts"),
      读取("src/components/V2TopActions.vue"),
      读取("src/pages/admin/platform-admin/OrganizationWorkspacePage.vue"),
    ]);

    // 一级入口：审核中心不藏在配置二级菜单里，超管与区域管理员都能直接进入。
    expect(导航).toContain('名称: "审核中心", 简称: "审核", 路径: "/admin/admin-review"');
    // 配置里的「审核与业务规则」保留跳转但不再参与激活，避免双高亮。
    expect(导航).toContain('if (子项.路径 === "/admin/admin-review") return false;');
    // 审批页提供待审批与已审批两个分区，已审批作为留存。
    expect(审批页).toContain("待审批 {{ 待处理列表.length }}");
    expect(审批页).toContain("已审批 {{ 已处理列表.length }}");
    expect(审批页).toContain('{{ 当前分区 === "待审批" ? "处理" : "查看业务" }}');
    // 渠道商与渠道账号审批可在审核中心直接闭环，驳回必须填写原因。
    expect(审批页).toContain("async function 通过审批");
    expect(审批页).toContain("async function 提交驳回");
    expect(审批页).toContain("请填写驳回原因。");
    expect(审批页).toContain("渠道商与渠道账号可直接在本页通过或驳回");
    expect(业务客户端).toContain("`/api/approvals/${encodeURIComponent(id)}/status`");
    expect(业务客户端).not.toContain("`/api/v2/pending-approvals/${encodeURIComponent(id)}`");
    // 渠道成员页展示审批驳回原因，便于渠道侧修改后重新提交。
    expect(渠道成员页).toContain("驳回原因：{{ 成员.reviewRemark }}");
    // 顶栏通知单条已读必须调用服务端；组织页新建区域管理员必须能选择负责区域。
    expect(顶栏动作).toContain("await 标记统一消息已读(item.id)");
    expect(组织页).toContain("负责区域");
  });

  it("新建用户只渲染一套区域字段，渠道档案统一使用成立时间", async () => {
    const [组织页, 渠道档案] = await Promise.all([
      读取("src/pages/admin/platform-admin/OrganizationWorkspacePage.vue"),
      读取("src/features/channel/ChannelProfilePage.vue"),
    ]);

    // 区域管理员的新建表单只保留一套“所属大区 / 负责区域”，防止字段重复渲染。
    expect(组织页.match(/<label class="form-label required">所属大区<\/label>/g)?.length).toBe(1);
    expect(组织页.match(/<label class="form-label required">负责区域<\/label>/g)?.length).toBe(1);
    expect(渠道档案).toContain("成立时间");
    expect(渠道档案).not.toContain("成立日期");
    expect(渠道档案).toContain("渠道等级文本 as 读取渠道等级文本");
    expect(渠道档案).toContain("读取渠道等级文本(档案.value?.level)");
    expect(渠道档案).toContain("{{ 渠道层级名称 }}");
    expect(渠道档案).not.toContain('{{ 档案?.level || "未设置" }}');
  });
});
