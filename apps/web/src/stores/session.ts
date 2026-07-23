import { defineStore } from "pinia";

export const useSessionStore = defineStore("session", {
  state: () => ({
    userName: "阶段1测试用户",
    roleName: "工程骨架",
  }),
});
