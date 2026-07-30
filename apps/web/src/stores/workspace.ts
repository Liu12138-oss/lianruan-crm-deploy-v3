import type { 契约路径 } from "@lianruan/contracts";
import { defineStore } from "pinia";

export const 健康检查路径: 契约路径[] = ["/health/live", "/health/ready", "/health/dependencies"];

export const 使用工作区Store = defineStore("工作区", {
  state: () => ({
    版本: import.meta.env.VITE_APP_VERSION || "3.0.0-stage9.20260727",
    健康检查路径,
  }),
});
