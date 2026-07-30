import type { RouteRecordRaw } from "vue-router";
import { createRouter, createWebHistory } from "vue-router";

export const routes: RouteRecordRaw[] = [
  {
    path: "/login",
    name: "login",
    component: () => import("./pages/LoginPage.vue"),
    meta: { title: "登录", layout: "entry" },
  },
  {
    path: "/",
    name: "home",
    component: () => import("./views/HomeView.vue"),
    meta: { title: "统一入口", layout: "entry" },
  },
  {
    path: "/admin",
    name: "admin",
    component: () => import("./views/AdminShellView.vue"),
    meta: { title: "管理端", layout: "admin" },
  },
  {
    path: "/partner",
    name: "partner",
    component: () => import("./views/PartnerShellView.vue"),
    meta: { title: "渠道端", layout: "partner" },
  },
  {
    path: "/mobile",
    name: "mobile",
    component: () => import("./views/MobileShellView.vue"),
    meta: { title: "移动端", layout: "mobile" },
  },
  {
    path: "/403",
    name: "forbidden403",
    component: () => import("./views/ForbiddenView.vue"),
    meta: { title: "无权限", layout: "error" },
  },
  {
    path: "/forbidden",
    name: "forbidden",
    component: () => import("./views/ForbiddenView.vue"),
    meta: { title: "无权限", layout: "error" },
  },
  {
    path: "/session-expired",
    name: "sessionExpired",
    component: () => import("./views/SessionExpiredView.vue"),
    meta: { title: "会话失效", layout: "error" },
  },
  {
    path: "/maintenance",
    name: "maintenance",
    component: () => import("./views/MaintenanceView.vue"),
    meta: { title: "系统维护", layout: "error" },
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
