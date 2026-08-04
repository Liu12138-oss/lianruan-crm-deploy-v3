import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";

import type { 阶段9模块 } from "../api/business-client.js";
import { useSessionStore } from "../stores/session.js";
import { 是否业务页面路径, 是否移动访问, 选择登录后路径 } from "./entry-target.js";

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
    meta: { 需要登录: true },
    children: 转换业务路由列表(管理端入口),
  },
  {
    path: "/partner",
    component: () => import("../layouts/PartnerLayout.vue"),
    meta: { 需要登录: true },
    children: 转换业务路由列表(渠道端入口),
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
    { path: "/", redirect: "/login" },
    { path: "/admin/system/import-export", redirect: "/admin/platform-admin" },
    { path: "/login", name: "登录", component: () => import("../pages/LoginPage.vue") },
    {
      path: "/login/singlesignonlogin/login.do",
      name: "单点登录兼容入口",
      component: () => import("../pages/SingleSignOnPage.vue"),
    },
    ...布局路由表,
    ...错误路由表,
  ],
});

router.beforeEach(async (to) => {
  const 会话 = useSessionStore();
  await 会话.恢复会话();
  if (to.path === "/login" && 会话.已登录) {
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
