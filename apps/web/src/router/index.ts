import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";

export const 布局路由表: RouteRecordRaw[] = [
  {
    path: "/unified",
    component: () => import("../layouts/UnifiedLayout.vue"),
    children: [
      {
        path: "",
        name: "统一入口",
        component: () => import("../pages/WorkspacePage.vue"),
        meta: { 工作区: "统一入口", 标题: "统一入口", 描述: "统一访问入口已就绪。" },
      },
    ],
  },
  {
    path: "/admin",
    component: () => import("../layouts/AdminLayout.vue"),
    children: [
      {
        path: "",
        name: "管理端",
        component: () => import("../pages/WorkspacePage.vue"),
        meta: { 工作区: "管理端", 标题: "管理端", 描述: "管理端布局骨架已就绪。" },
      },
    ],
  },
  {
    path: "/partner",
    component: () => import("../layouts/PartnerLayout.vue"),
    children: [
      {
        path: "",
        name: "渠道端",
        component: () => import("../pages/WorkspacePage.vue"),
        meta: { 工作区: "渠道端", 标题: "渠道端", 描述: "渠道端布局骨架已就绪。" },
      },
    ],
  },
  {
    path: "/mobile",
    component: () => import("../layouts/MobileLayout.vue"),
    children: [
      {
        path: "",
        name: "移动端",
        component: () => import("../pages/WorkspacePage.vue"),
        meta: { 工作区: "移动端", 标题: "移动端", 描述: "移动端布局骨架已就绪。" },
      },
    ],
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
  routes: [{ path: "/", redirect: "/unified" }, ...布局路由表, ...错误路由表],
});
