import "element-plus/dist/index.css";
import "./styles/theme.css";
import "./styles/war-typography.css";
import "./styles/visual-ui.css";
import "./styles/war-artboard.css";
import "./styles/war-form.css";
import "./styles/war-demo.css";
import "./styles/war-typography-lock.css";

import ElementPlus from "element-plus";
import { createPinia } from "pinia";
import { createApp } from "vue";

import { 安装业务会话同步监听, 校验页面会话有效 } from "./api/auth-client.js";
import App from "./App.vue";
import { 归一化Sdp网关入口, 是否跳过页面会话复核 } from "./router/entry-target.js";
import { router } from "./router/index.js";

归一化Sdp网关入口();

const 应用 = createApp(App);

应用.use(createPinia());
应用.use(router);
应用.use(ElementPlus);

应用.mount("#app");
安装业务会话同步监听();

let 会话复核中 = false;
let 最近会话复核时间 = 0;

/** 页面恢复或路由切换后重新确认服务端会话，避免只信任本地缓存并展示失效页面。 */
function 复核页面会话(强制 = false): void {
  if (会话复核中 || 是否跳过页面会话复核(window.location.pathname)) return;
  const 当前时间 = Date.now();
  if (!强制 && 当前时间 - 最近会话复核时间 < 1000) return;
  最近会话复核时间 = 当前时间;
  会话复核中 = true;
  // 不能只看本页 localStorage：新标签页初次打开时只有 HttpOnly Cookie。
  // 必须先向服务端确认，确认有效时补写页面会话，只有明确失效才跳转登录页。
  void 校验页面会话有效()
    .then((有效) => {
      if (!有效) window.location.replace("/login");
    })
    .finally(() => {
      会话复核中 = false;
    });
}

window.addEventListener("pageshow", () => 复核页面会话());
window.addEventListener("popstate", () => 复核页面会话(true));
router.afterEach(() => 复核页面会话());
