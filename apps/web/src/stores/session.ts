import { defineStore } from "pinia";

import { 登录, type 登录用户, 读取当前用户, 退出登录 } from "../api/auth-client.js";

export const useSessionStore = defineStore("session", {
  state: () => ({
    user: null as 登录用户 | null,
    loaded: false,
    loading: false,
    errorMessage: "",
  }),
  getters: {
    已登录: (state) => Boolean(state.user),
    用户名: (state) => state.user?.displayName || "",
    角色名: (state) => state.user?.roleName || "",
  },
  actions: {
    async 恢复会话() {
      if (this.loaded || this.loading) return;
      this.loading = true;
      try {
        this.user = await 读取当前用户();
        this.errorMessage = "";
      } catch {
        this.user = null;
      } finally {
        this.loaded = true;
        this.loading = false;
      }
    },
    async 登录系统(username: string, password: string) {
      this.loading = true;
      try {
        this.user = await 登录({ username, password });
        this.loaded = true;
        this.errorMessage = "";
      } catch (error) {
        this.user = null;
        this.errorMessage = error instanceof Error ? error.message : "登录失败，请稍后重试。";
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async 退出系统() {
      await 退出登录();
      this.user = null;
      this.loaded = true;
    },
  },
});
