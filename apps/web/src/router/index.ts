import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";

import type { 阶段9模块 } from "../api/business-client.js";
import { 取最具体角色约束, 判断平台角色 } from "../shared/permission/role.js";
import { useSessionStore } from "../stores/session.js";
import { 是否业务页面路径, 是否移动访问, 选择登录后路径 } from "./entry-target.js";
import {
  Iam平台单点登录路径,
  UniSdp平台单点登录路径,
  构建UniSdp单点登录跳转,
  构建单点登录跳转,
  需要转入UniSdp单点登录,
  需要转入单点登录,
} from "./sso-entry.js";

type 页面动作 = "overview" | "list" | "create" | "import" | "platform";

interface 业务子路由 {
  path: string;
  name: string;
  标题: string;
  描述: string;
  模块?: 阶段9模块;
  页面动作?: 页面动作;
}

const 业务页面 = () => import("../pages/BusinessWorkspacePage.vue");
const 组织架构页面 = () => import("../pages/admin/platform-admin/OrganizationWorkspacePage.vue");
const 客户跟进页面 = () => import("../features/customer/CustomerFollowupPage.vue");
const 客户管理页面 = () => import("../features/customer/CustomerManagementPage.vue");
const 新建客户页面 = () => import("../features/customer/CustomerCreatePage.vue");
const 工作台页面 = () => import("../features/dashboard/DashboardPage.vue");
const 渠道列表页面 = () => import("../features/channel/ChannelListPage.vue");
const 订单中心页面 = () => import("../features/order/OrderCenterPage.vue");
const 商机中心页面 = () => import("../features/opportunity/OpportunityCenterPage.vue");
const 报价中心页面 = () => import("../features/quote/QuoteCenterPage.vue");
const 新建报价页面 = () => import("../features/quote/QuoteCreatePage.vue");
const 新建商机页面 = () => import("../features/opportunity/OpportunityCreatePage.vue");
const 产品目录页面 = () => import("../features/product/ProductCatalogPage.vue");
const 审核中心页面 = () => import("../features/approval/ApprovalCenterPage.vue");
const 账号管理页面 = () => import("../features/platform/AccountManagePage.vue");
const 开放接口页面 = () => import("../features/platform/OpenApiPage.vue");
const 审计日志页面 = () => import("../features/platform/AuditLogPage.vue");
const 工作量配置页面 = () => import("../features/product/WorkloadConfigPage.vue");
const 渠道报表页面 = () => import("../features/channel/PartnerReportPage.vue");
const 消息中心作战页 = () => import("../features/message/MessageCenterWarPage.vue");
const 价格规则作战页 = () => import("../features/product/PricingCenterPage.vue");
const 线索管理页面 = () => import("../features/lead/LeadManagementPage.vue");
const 线索中心页面 = () => import("../features/lead/LeadCenterPage.vue");
const 消息中心页面 = () => import("../features/message/MessageCenterPage.vue");
const 渠道档案页面 = () => import("../features/channel/ChannelProfilePage.vue");
const 渠道成员页面 = () => import("../features/channel/ChannelMembersPage.vue");
const 订单处理页面 = () => import("../features/order/OrderActionCenterPage.vue");
const 价格规则页面 = () => import("../features/product/PricingRulesPage.vue");
const 消息设置页面 = () => import("../features/message/MessageSettingsPage.vue");
const 证书风险页面 = () => import("../features/certificate/CertificateRiskPage.vue");
const 证书中心页面 = () => import("../features/certificate/CertificateCenterPage.vue");
const 平台配置页面 = () => import("../features/platform/PlatformCenterPage.vue");

const 组织工作区栏目: Array<[string, string]> = [
  ["units", "组织与岗位"],
  ["staff", "人员与任职"],
  ["business-roles", "业务角色"],
  ["certifications", "证书管理"],
  ["data-scopes", "权限与范围"],
  ["permission-roles", "权限与范围"],
  ["offboarding", "离职交接"],
  ["directory-sync", "企微组织同步"],
  ["external-identities", "外部身份映射"],
];

const 组织架构工作区路由: RouteRecordRaw[] = [
  {
    path: "/workspace/admin/platform-admin/organization",
    redirect: "/workspace/admin/platform-admin/organization/units",
  },
  ...创建组织工作区页面(组织工作区栏目, "/workspace/admin/platform-admin/organization", "组织架构"),
];

/**
 * 生成组织工作区页面路由。
 * 同一套页面同时挂在两条路径下：
 * - 独立全屏工作区：`/workspace/admin/platform-admin/organization/*`
 * - 管理端内嵌（顶部「配置」二级菜单）：`/admin/organization/*`，保留一级/二级菜单与返回入口
 */
function 创建组织工作区页面(
  栏目列表: Array<[string, string]>,
  基础路径: string,
  名称前缀: string,
): RouteRecordRaw[] {
  return 栏目列表.map(([栏目, 标题]) => {
    const 组织栏目 =
      栏目 === "data-scopes" || 栏目 === "permission-roles"
        ? "access"
        : (栏目 as NonNullable<RouteRecordRaw["meta"]>["组织栏目"]);
    return {
      path: `${基础路径}/${栏目}`,
      name: `${名称前缀}-${标题}`,
      component: 组织架构页面,
      meta: { 需要登录: true, 标题, 组织栏目, 允许角色: ["superadmin"] },
    } as RouteRecordRaw;
  });
}

const 管理端入口: 业务子路由[] = [
  { path: "", name: "管理端首页", 标题: "管理端", 描述: "管理端业务概览。", 页面动作: "overview" },
  {
    path: "dashboard",
    name: "管理端仪表盘",
    标题: "管理端仪表盘",
    描述: "客户报备、商机、报价、订单和待办汇总。",
    页面动作: "overview",
  },
  {
    path: "registration",
    name: "客户报备",
    标题: "客户报备",
    描述: "查看、审核和维护客户报备记录。",
    模块: "registrations",
  },
  {
    path: "registration/new",
    name: "新建客户报备",
    标题: "新建客户报备",
    描述: "按V2字段提交客户保护报备。",
    模块: "registrations",
    页面动作: "create",
  },
  {
    path: "registration/import",
    name: "报备导入",
    标题: "报备导入",
    描述: "报备批量导入、预检和任务结果。",
    模块: "importExport",
    页面动作: "import",
  },
  {
    path: "opportunity",
    name: "商机管理",
    标题: "商机管理",
    描述: "跟进销售机会，推进阶段并关联报价。",
    模块: "opportunities",
  },
  {
    path: "opportunity/new",
    name: "新建商机",
    标题: "新建商机",
    描述: "从已通过报备创建商机。",
    模块: "opportunities",
    页面动作: "create",
  },
  {
    path: "opportunity/import",
    name: "商机导入",
    标题: "商机导入",
    描述: "商机批量导入、预检和任务结果。",
    模块: "importExport",
    页面动作: "import",
  },
  {
    path: "quote",
    name: "报价单",
    标题: "报价管理",
    描述: "报价试算、确认和转订单。",
    模块: "quotes",
  },
  {
    path: "quote/new",
    name: "新建报价",
    标题: "新建报价单",
    描述: "选择商机、产品和端点数生成报价。",
    模块: "quotes",
    页面动作: "create",
  },
  {
    path: "quote/edit/:id",
    name: "编辑报价",
    标题: "修改报价",
    描述: "复核报价快照、工作量和金额。",
    模块: "quotes",
    页面动作: "create",
  },
  {
    path: "order",
    name: "订单管理",
    标题: "订单管理",
    描述: "订单确认、驳回和履约状态查看。",
    模块: "orders",
  },
  {
    path: "products",
    name: "产品目录",
    标题: "产品目录",
    描述: "软件功能、硬件产品和套餐目录。",
    模块: "products",
  },
  {
    path: "partner-report",
    name: "渠道报表",
    标题: "渠道报表",
    描述: "渠道数量、业务贡献和区域分布。",
    模块: "partners",
  },
  {
    path: "partners",
    name: "渠道商",
    标题: "渠道商",
    描述: "渠道主档、层级和成员信息。",
    模块: "partners",
  },
  {
    path: "partners/import",
    name: "渠道导入",
    标题: "渠道导入",
    描述: "渠道批量导入、预检和任务结果。",
    模块: "importExport",
    页面动作: "import",
  },
  {
    path: "partner-admin",
    name: "渠道管理员",
    标题: "渠道管理员",
    描述: "渠道管理员和渠道员工账号。",
    模块: "users",
  },
  {
    path: "admin-review",
    name: "审核中心",
    标题: "审核中心",
    描述: "报备、渠道、账号和订单相关审核。",
    模块: "approvals",
  },
  {
    path: "account-manage",
    name: "账号管理",
    标题: "账号管理",
    描述: "总部、区域、渠道账号和数据范围。",
    模块: "users",
  },
  {
    path: "account-manage/staff-import",
    name: "员工导入",
    标题: "员工导入",
    描述: "员工账号批量导入、预检和结果下载。",
    模块: "importExport",
    页面动作: "import",
  },
  {
    path: "audit-logs",
    name: "审计日志",
    标题: "审计日志",
    描述: "关键操作、接口调用和风险事件追踪。",
    模块: "audit",
  },
  {
    path: "openapi-integration",
    name: "开放接口",
    标题: "开放接口",
    描述: "OpenAPI客户端、密钥重签和调用记录。",
    模块: "openapi",
  },
  {
    path: "workload-config",
    name: "工作量配置",
    标题: "工作量配置",
    描述: "实施工作量规则、交付标签和产品映射。",
    模块: "workload",
  },
  {
    path: "platform-admin",
    name: "平台管理中心",
    标题: "平台管理中心",
    描述: "组织架构、账号权限、OpenAPI、导入导出、审计和系统状态。",
    页面动作: "platform",
  },
];

const 管理端专项路由: RouteRecordRaw[] = [
  {
    path: "dashboard",
    name: "工作台",
    component: 工作台页面,
    meta: {
      工作区: "工作台",
      标题: "工作台",
      描述: "渠道、客户、商机、报价、订单与待办汇总。",
      需要登录: true,
      页面动作: "list",
      允许角色: ["superadmin", "region_manager"],
    },
  },
  {
    path: "partner-report",
    name: "渠道报表",
    component: 渠道报表页面,
    meta: {
      工作区: "渠道管理",
      标题: "渠道报表",
      描述: "渠道层级、区域覆盖与成员规模。",
      需要登录: true,
      页面动作: "list",
      允许角色: ["superadmin", "region_manager"],
    },
  },
  {
    path: "workload-config",
    name: "工作量配置",
    component: 工作量配置页面,
    meta: {
      工作区: "产品目录",
      标题: "工作量配置",
      描述: "工作量映射规则与交付标签。",
      需要登录: true,
      页面动作: "list",
      允许角色: ["superadmin"],
    },
  },
  {
    path: "account-manage",
    name: "账号管理",
    component: 账号管理页面,
    meta: {
      工作区: "管理配置",
      标题: "账号管理",
      描述: "总部、区域与渠道账号。",
      需要登录: true,
      页面动作: "list",
      允许角色: ["superadmin"],
    },
  },
  {
    path: "openapi-integration",
    name: "开放接口",
    component: 开放接口页面,
    meta: {
      工作区: "管理配置",
      标题: "开放接口",
      描述: "OpenAPI 客户端与密钥状态。",
      需要登录: true,
      页面动作: "list",
      允许角色: ["superadmin"],
    },
  },
  {
    path: "audit-logs",
    name: "审计日志",
    component: 审计日志页面,
    meta: {
      工作区: "管理配置",
      标题: "审计日志",
      描述: "关键操作与接口调用记录。",
      需要登录: true,
      页面动作: "list",
      允许角色: ["superadmin"],
    },
  },
  {
    path: "partners",
    name: "渠道列表",
    component: 渠道列表页面,
    meta: {
      工作区: "渠道管理",
      标题: "渠道管理",
      描述: "渠道商主档、等级、成员与经营能力。",
      需要登录: true,
      页面动作: "list",
      允许角色: ["superadmin", "region_manager"],
    },
  },
  {
    path: "order",
    name: "订单中心",
    component: 订单中心页面,
    meta: {
      工作区: "订单中心",
      标题: "订单中心",
      描述: "订单状态、金额、明细与审批历史。",
      需要登录: true,
      页面动作: "list",
      允许角色: ["superadmin", "region_manager"],
    },
  },
  {
    path: "opportunity",
    name: "商机作战",
    component: 商机中心页面,
    meta: {
      工作区: "商机作战",
      标题: "商机作战",
      描述: "七阶段推进、报价与停滞风险。",
      需要登录: true,
      页面动作: "list",
      允许角色: ["superadmin", "region_manager"],
    },
  },
  {
    path: "opportunity/new",
    name: "新建商机",
    component: 新建商机页面,
    meta: {
      工作区: "商机作战",
      标题: "新建商机",
      描述: "从已通过报备创建商机。",
      需要登录: true,
      页面动作: "list",
      允许角色: ["superadmin", "region_manager"],
    },
  },
  {
    path: "quote/new",
    name: "新建报价",
    component: 新建报价页面,
    meta: {
      工作区: "报价管理",
      标题: "新建报价单",
      描述: "选择商机、产品和端点数生成报价。",
      需要登录: true,
      页面动作: "list",
      允许角色: ["superadmin", "region_manager"],
    },
  },
  {
    path: "quote/edit/:id",
    name: "编辑报价",
    component: 新建报价页面,
    meta: {
      工作区: "报价管理",
      标题: "修改报价",
      描述: "复核报价快照、工作量和金额。",
      需要登录: true,
      页面动作: "list",
      允许角色: ["superadmin", "region_manager"],
    },
  },
  {
    path: "quote",
    name: "报价管理",
    component: 报价中心页面,
    meta: {
      工作区: "报价管理",
      标题: "报价管理",
      描述: "报价明细、工作量与转订单。",
      需要登录: true,
      页面动作: "list",
      允许角色: ["superadmin", "region_manager"],
    },
  },
  {
    path: "products",
    name: "产品目录",
    component: 产品目录页面,
    meta: {
      工作区: "产品目录",
      标题: "产品目录",
      描述: "产品、阶梯价与区域覆盖。",
      需要登录: true,
      页面动作: "list",
      允许角色: ["superadmin", "region_manager"],
    },
  },
  {
    path: "admin-review",
    name: "审核中心",
    component: 审核中心页面,
    meta: {
      工作区: "审核中心",
      标题: "审核中心",
      描述: "客户报备、订单与渠道审批。",
      需要登录: true,
      页面动作: "list",
      允许角色: ["superadmin", "region_manager"],
    },
  },
  {
    path: "registration",
    name: "客户管理",
    component: 客户管理页面,
    meta: {
      工作区: "客户管理",
      标题: "客户管理",
      描述: "客户报备、保护期、联系人与关联商机的作战视图。",
      需要登录: true,
      页面动作: "list",
      允许角色: ["superadmin", "region_manager"],
    },
  },
  {
    path: "registration/new",
    name: "新建客户报备",
    component: 新建客户页面,
    meta: {
      工作区: "客户管理",
      标题: "新建客户与报备",
      描述: "工商信息、联系人、归属与保护一次完成。",
      需要登录: true,
      页面动作: "list",
      允许角色: ["superadmin", "region_manager"],
    },
  },
  {
    path: "registration/:id/followup",
    name: "客户跟进",
    component: 客户跟进页面,
    meta: {
      工作区: "客户管理",
      标题: "客户跟进",
      描述: "维护客户档案并记录关联商机的跟进过程。",
      需要登录: true,
      页面动作: "list",
      允许角色: ["superadmin", "region_manager"],
    },
  },
  {
    path: "leads",
    name: "线索管理",
    component: 线索中心页面,
    meta: {
      工作区: "线索管理",
      标题: "线索管理",
      描述: "集中检索、筛选和查看外部招投标线索。",
      需要登录: true,
      页面动作: "list",
      允许角色: ["superadmin", "region_manager"],
    },
  },
  {
    path: "leads/sources",
    name: "线索数据来源",
    component: 线索管理页面,
    meta: {
      工作区: "线索管理",
      标题: "数据来源与采集",
      描述: "查看线索来源覆盖、同步状态和失败任务。",
      需要登录: true,
      页面动作: "list",
      允许角色: ["superadmin", "region_manager"],
    },
  },
  {
    path: "notifications",
    name: "消息中心",
    component: 消息中心作战页,
    meta: {
      工作区: "消息中心",
      标题: "消息中心",
      描述: "统一展示审批待办、业务提醒和系统通知。",
      需要登录: true,
      页面动作: "list",
    },
  },
  {
    path: "notifications/platform",
    name: "消息渠道配置",
    component: 消息设置页面,
    meta: {
      工作区: "消息中心",
      标题: "消息渠道配置",
      描述: "管理企微、短信和邮箱等外部消息渠道。",
      需要登录: true,
      页面动作: "list",
      允许角色: ["superadmin"],
    },
  },
  {
    path: "notifications/rules",
    name: "提醒规则与模板",
    component: 消息设置页面,
    meta: {
      工作区: "消息中心",
      标题: "提醒规则与模板",
      描述: "管理业务事件提醒、接收人、渠道和到期提醒规则。",
      需要登录: true,
      页面动作: "list",
      允许角色: ["superadmin"],
    },
  },
  {
    path: "certifications",
    name: "证书与风险",
    component: 证书中心页面,
    meta: {
      工作区: "管理配置",
      标题: "证书与风险",
      描述: "证书模板、持证记录、到期风险和撤销管理。",
      需要登录: true,
      页面动作: "list",
      允许角色: ["superadmin"],
    },
  },
  {
    path: "partners/:id/profile",
    name: "渠道核心档案",
    component: 渠道档案页面,
    meta: {
      工作区: "渠道管理",
      标题: "渠道核心档案",
      描述: "维护渠道商工商主体、经营地址、联系人和产品能力。",
      需要登录: true,
      页面动作: "list",
      允许角色: ["superadmin", "region_manager"],
    },
  },
  {
    path: "partners/:id/members",
    name: "渠道成员维护",
    component: 渠道成员页面,
    meta: {
      工作区: "渠道管理",
      标题: "渠道成员维护",
      描述: "维护渠道企业管理员、销售成员、账号状态和登录凭据。",
      需要登录: true,
      页面动作: "list",
      允许角色: ["superadmin", "region_manager"],
    },
  },
  {
    path: "order/:id/actions",
    name: "订单处理",
    component: 订单处理页面,
    meta: {
      工作区: "订单中心",
      标题: "订单处理",
      描述: "按订单状态和角色执行审批、调价、退回、修订和履约动作。",
      需要登录: true,
      页面动作: "list",
      允许角色: ["superadmin", "region_manager"],
    },
  },
  {
    path: "products/pricing",
    name: "模块价格规则",
    component: 价格规则作战页,
    meta: {
      工作区: "产品目录",
      标题: "模块价格规则",
      描述: "查看基础阶梯价、渠道比例和区域价格覆盖。",
      需要登录: true,
      页面动作: "list",
      允许角色: ["superadmin", "region_manager"],
    },
  },
  {
    path: "platform-admin",
    name: "管理配置",
    component: 平台配置页面,
    meta: {
      工作区: "管理配置",
      标题: "管理配置",
      描述: "组织、账号、审核、消息、产品、审计和开放接口配置。",
      需要登录: true,
      页面动作: "list",
      允许角色: ["superadmin"],
    },
  },
  {
    path: "organization",
    redirect: "/admin/organization/units",
    meta: { 需要登录: true, 允许角色: ["superadmin"] },
  },
  ...创建组织工作区页面(组织工作区栏目, "/admin/organization", "管理配置"),
];

const 渠道端入口: 业务子路由[] = [
  { path: "", name: "渠道端首页", 标题: "渠道端", 描述: "渠道端业务概览。", 页面动作: "overview" },
  {
    path: "dashboard",
    name: "渠道仪表盘",
    标题: "总览仪表盘",
    描述: "本渠道报备、商机、报价和订单汇总。",
    页面动作: "overview",
  },
  {
    path: "registration",
    name: "渠道客户报备",
    标题: "客户报备",
    描述: "渠道侧客户报备和保护状态。",
    模块: "registrations",
  },
  {
    path: "registration/new",
    name: "渠道新建报备",
    标题: "新建客户报备",
    描述: "渠道侧提交客户保护报备。",
    模块: "registrations",
    页面动作: "create",
  },
  {
    path: "opportunity",
    name: "渠道商机",
    标题: "商机管理",
    描述: "渠道侧商机跟进和阶段推进。",
    模块: "opportunities",
  },
  {
    path: "opportunity/new",
    name: "渠道新建商机",
    标题: "新建商机",
    描述: "渠道侧从已通过报备创建商机。",
    模块: "opportunities",
    页面动作: "create",
  },
  {
    path: "quote",
    name: "渠道报价",
    标题: "报价管理",
    描述: "渠道侧报价查看、确认和转订单。",
    模块: "quotes",
  },
  {
    path: "quote/new",
    name: "渠道新建报价",
    标题: "新建报价单",
    描述: "渠道侧选择商机和产品生成报价。",
    模块: "quotes",
    页面动作: "create",
  },
  {
    path: "quote/edit/:id",
    name: "渠道编辑报价",
    标题: "修改报价",
    描述: "渠道侧复核报价快照和金额。",
    模块: "quotes",
    页面动作: "create",
  },
  {
    path: "order",
    name: "渠道订单",
    标题: "订单管理",
    描述: "渠道侧订单确认和状态查看。",
    模块: "orders",
  },
  {
    path: "products",
    name: "渠道产品目录",
    标题: "产品目录",
    描述: "渠道侧产品、硬件和套餐浏览。",
    模块: "products",
  },
];

const 渠道端专项路由: RouteRecordRaw[] = [
  {
    path: "dashboard",
    name: "渠道工作台",
    component: 工作台页面,
    meta: {
      工作区: "工作台",
      标题: "总览仪表盘",
      描述: "本渠道客户、商机、报价、订单与待办汇总。",
      需要登录: true,
      页面动作: "list",
    },
  },
  {
    path: "order",
    name: "渠道订单中心",
    component: 订单中心页面,
    meta: {
      工作区: "订单中心",
      标题: "订单管理",
      描述: "本渠道订单状态与审批历史。",
      需要登录: true,
      页面动作: "list",
    },
  },
  {
    path: "opportunity",
    name: "渠道商机作战",
    component: 商机中心页面,
    meta: {
      工作区: "商机作战",
      标题: "商机管理",
      描述: "本渠道商机推进与停滞风险。",
      需要登录: true,
      页面动作: "list",
    },
  },
  {
    // 渠道端新建商机与管理端共用同一套新 UI 表单，避免渠道侧落到通用工作区页面。
    path: "opportunity/new",
    name: "渠道新建商机",
    component: 新建商机页面,
    meta: {
      工作区: "商机作战",
      标题: "新建商机",
      描述: "渠道侧从已通过报备创建商机。",
      需要登录: true,
      页面动作: "create",
    },
  },
  {
    path: "quote",
    name: "渠道报价管理",
    component: 报价中心页面,
    meta: {
      工作区: "报价管理",
      标题: "报价管理",
      描述: "本渠道报价明细与转订单。",
      需要登录: true,
      页面动作: "list",
    },
  },
  {
    // 渠道端报价单创建/编辑与内部管理端共用同一套新 UI 报价构建器，避免渠道侧继续落到 V2 兼容页。
    path: "quote/new",
    name: "渠道新建报价单",
    component: 新建报价页面,
    meta: {
      工作区: "报价管理",
      标题: "新建报价单",
      描述: "本渠道选择商机、报价方式与产品模块生成报价单。",
      需要登录: true,
      页面动作: "create",
    },
  },
  {
    path: "quote/edit/:id",
    name: "渠道编辑报价单",
    component: 新建报价页面,
    meta: {
      工作区: "报价管理",
      标题: "修改报价",
      描述: "本渠道复核报价快照、模块数量与金额。",
      需要登录: true,
      页面动作: "create",
    },
  },
  {
    path: "products",
    name: "渠道产品目录",
    component: 产品目录页面,
    meta: {
      工作区: "产品目录",
      标题: "产品目录",
      描述: "渠道侧产品、阶梯价与区域覆盖浏览。",
      需要登录: true,
      页面动作: "list",
    },
  },
  {
    path: "registration",
    name: "渠道客户管理",
    component: 客户管理页面,
    meta: {
      工作区: "客户管理",
      标题: "客户管理",
      描述: "本渠道客户报备、保护期与关联商机。",
      需要登录: true,
      页面动作: "list",
    },
  },
  {
    path: "registration/new",
    name: "渠道新建客户报备",
    component: 新建客户页面,
    meta: {
      工作区: "客户管理",
      标题: "新建客户报备",
      描述: "渠道侧提交客户保护报备。",
      需要登录: true,
      页面动作: "list",
    },
  },
  {
    path: "registration/:id/followup",
    name: "渠道客户跟进",
    component: 客户跟进页面,
    meta: {
      工作区: "客户管理",
      标题: "客户跟进",
      描述: "维护本渠道客户档案并记录关联商机的跟进过程。",
      需要登录: true,
      页面动作: "list",
    },
  },
  {
    path: "order/:id/actions",
    name: "渠道订单处理",
    component: 订单处理页面,
    meta: {
      工作区: "订单中心",
      标题: "订单处理",
      描述: "按订单状态执行一级确认、驳回、修订和履约动作。",
      需要登录: true,
      页面动作: "list",
    },
  },
];

const 移动端入口: 业务子路由[] = [
  { path: "", name: "移动端首页", 标题: "移动端", 描述: "手机一期工作台。", 页面动作: "overview" },
  {
    path: "partner/home",
    name: "手机渠道首页",
    标题: "渠道工作台",
    描述: "手机一期渠道用户工作台。",
    页面动作: "overview",
  },
  {
    path: "partner/registrations",
    name: "手机渠道报备",
    标题: "客户报备",
    描述: "手机一期报备列表。",
    模块: "registrations",
  },
  {
    path: "partner/registrations/new",
    name: "手机新建报备",
    标题: "新建客户报备",
    描述: "手机一期新建报备。",
    模块: "registrations",
    页面动作: "create",
  },
  {
    path: "partner/opportunities",
    name: "手机渠道商机",
    标题: "商机",
    描述: "手机一期商机列表和跟进。",
    模块: "opportunities",
  },
  {
    path: "partner/opportunities/new",
    name: "手机新建商机",
    标题: "新建商机",
    描述: "手机一期新建商机。",
    模块: "opportunities",
    页面动作: "create",
  },
  {
    path: "partner/quotes",
    name: "手机渠道报价",
    标题: "报价单",
    描述: "手机一期报价查看和转订单。",
    模块: "quotes",
  },
  {
    path: "partner/quotes/new",
    name: "手机新建报价",
    标题: "新建报价单",
    描述: "手机一期新建报价。",
    模块: "quotes",
    页面动作: "create",
  },
  {
    path: "partner/orders",
    name: "手机渠道订单",
    标题: "订单",
    描述: "手机一期订单查看。",
    模块: "orders",
  },
  {
    path: "partner/products",
    name: "手机产品目录",
    标题: "产品目录",
    描述: "手机一期产品目录。",
    模块: "products",
  },
  {
    path: "admin/home",
    name: "手机管理员首页",
    标题: "管理工作台",
    描述: "手机一期管理员工作台。",
    页面动作: "overview",
  },
  {
    path: "admin/reviews",
    name: "手机审核中心",
    标题: "审核中心",
    描述: "手机一期审核任务。",
    模块: "approvals",
  },
  {
    path: "admin/business",
    name: "手机业务查询",
    标题: "业务查询",
    描述: "手机一期业务查询。",
    模块: "registrations",
  },
  {
    path: "admin/partners",
    name: "手机渠道查询",
    标题: "渠道商",
    描述: "手机一期渠道查询。",
    模块: "partners",
  },
  {
    path: "me",
    name: "手机我的",
    标题: "我的",
    描述: "当前账号和会话状态。",
    页面动作: "overview",
  },
];

export const 布局路由表: RouteRecordRaw[] = [
  {
    path: "/unified",
    component: () => import("../layouts/UnifiedLayout.vue"),
    meta: { 需要登录: true },
    children: [
      {
        path: "",
        name: "统一入口",
        component: 业务页面,
        meta: {
          工作区: "统一入口",
          标题: "统一入口",
          描述: "联软总部与渠道体系统一入口。",
          需要登录: true,
          页面动作: "overview",
        },
      },
    ],
  },
  {
    path: "/admin",
    component: () => import("../layouts/AdminLayout.vue"),
    meta: { 需要登录: true, 允许角色: ["superadmin", "region_manager"] },
    children: [
      ...管理端专项路由,
      ...去除已覆盖路由(转换业务路由列表(管理端入口), 管理端专项路由),
    ],
  },
  {
    path: "/partner",
    component: () => import("../layouts/PartnerLayout.vue"),
    meta: { 需要登录: true },
    children: [
      ...渠道端专项路由,
      ...去除已覆盖路由(转换业务路由列表(渠道端入口), 渠道端专项路由),
    ],
  },
  {
    path: "/mobile",
    component: () => import("../layouts/MobileLayout.vue"),
    meta: { 需要登录: true },
    children: 转换业务路由列表(移动端入口),
  },
];

export const 错误路由表: RouteRecordRaw[] = [
  {
    path: "/403",
    name: "无权限",
    component: () => import("../pages/ForbiddenPage.vue"),
  },
  {
    path: "/session-expired",
    name: "会话失效",
    component: () => import("../pages/SessionExpiredPage.vue"),
  },
  {
    path: "/maintenance",
    name: "维护中",
    component: () => import("../pages/MaintenancePage.vue"),
  },
  {
    path: "/:pathMatch(.*)*",
    name: "未找到",
    component: () => import("../pages/NotFoundPage.vue"),
  },
];

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      redirect: (to) => {
        if (需要转入UniSdp单点登录(to)) return 构建UniSdp单点登录跳转(to);
        if (需要转入单点登录(to) || 是否移动访问()) {
          return 构建单点登录跳转(to, { 自动尝试: true, 失败回登录: true });
        }
        return "/login";
      },
    },
    { path: "/admin/system/import-export", redirect: "/admin/platform-admin" },
    { path: "/login", name: "登录", component: () => import("../pages/LoginPage.vue") },
    {
      path: "/login/singlesignonlogin/login.do",
      name: "单点登录兼容入口",
      component: () => import("../pages/SingleSignOnPage.vue"),
    },
    {
      path: Iam平台单点登录路径,
      name: "IAM平台单点登录入口",
      component: () => import("../pages/SingleSignOnPage.vue"),
    },
    {
      path: UniSdp平台单点登录路径,
      name: "UniSDP平台单点登录入口",
      component: () => import("../pages/SingleSignOnPage.vue"),
    },
    ...组织架构工作区路由,
    ...布局路由表,
    ...错误路由表,
  ],
});

router.beforeEach(async (to) => {
  if (需要转入UniSdp单点登录(to)) return 构建UniSdp单点登录跳转(to);
  if (需要转入单点登录(to)) return 构建单点登录跳转(to, { 失败回登录: true });
  const 会话 = useSessionStore();
  await 会话.恢复会话();
  if (
    (to.path === "/login" ||
      to.path === "/login/singlesignonlogin/login.do" ||
      to.path === Iam平台单点登录路径 ||
      to.path === UniSdp平台单点登录路径) &&
    会话.已登录
  ) {
    const 实际页面 = 选择登录后路径(会话.user, { 移动访问: 是否移动访问() });
    if (是否业务页面路径(实际页面)) {
      window.location.replace(实际页面);
      return false;
    }
    return 实际页面;
  }
  if (to.matched.some((record) => record.meta.需要登录) && !会话.已登录) {
    return { path: "/login", query: { redirect: to.fullPath } };
  }
  const 允许角色 = 取最具体角色约束(to.matched.map((record) => record.meta.允许角色));
  if (允许角色.length && !允许角色.includes(判断平台角色(会话.user))) {
    return { path: "/403" };
  }
  return true;
});

function 转换业务路由(item: 业务子路由): RouteRecordRaw {
  const meta: RouteRecordRaw["meta"] = {
    工作区: item.name,
    标题: item.标题,
    描述: item.描述,
    需要登录: true,
    页面动作: item.页面动作 || "list",
  };
  if (
    ["account-manage", "audit-logs", "openapi-integration", "platform-admin"].some((敏感路径) =>
      item.path.startsWith(敏感路径),
    )
  ) {
    meta.允许角色 = ["superadmin"];
  }
  if (item.模块) meta.模块 = item.模块;
  return {
    path: item.path,
    name: item.name,
    component: 业务页面,
    meta,
  };
}

function 转换业务路由列表(items: 业务子路由[]): RouteRecordRaw[] {
  return [...items]
    .sort((左, 右) => {
      const 左层级 = 左.path.split("/").filter(Boolean).length;
      const 右层级 = 右.path.split("/").filter(Boolean).length;
      return 右层级 - 左层级;
    })
    .map(转换业务路由);
}

/** 专项路由优先：同路径的通用工作区路由不再注册，避免重复定义导致旧页面被匹配。 */
function 去除已覆盖路由(通用路由: RouteRecordRaw[], 专项路由: RouteRecordRaw[]): RouteRecordRaw[] {
  const 已覆盖 = new Set(专项路由.map((路由) => 路由.path));
  return 通用路由.filter((路由) => !已覆盖.has(路由.path));
}
