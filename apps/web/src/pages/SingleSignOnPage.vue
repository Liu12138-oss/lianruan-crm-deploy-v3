<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import { type 单点登录入口, type 单点登录配置, 读取单点登录配置 } from "../api/auth-client.js";
import { 选择登录后路径 } from "../router/entry-target.js";
import { useSessionStore } from "../stores/session.js";

type Emm回调 = (data: unknown) => void;

declare global {
  interface Window {
    JQAPI?: {
      getSSOToken(
        param: Record<string, string>,
        successCallBack: Emm回调,
        failedCallBack: Emm回调,
      ): void;
    };
  }
}

const 凭证参数名 = ["token", "sso_token", "ssotoken"];
const 默认超时毫秒 = 8000;

const 路由 = useRoute();
const 路由器 = useRouter();
const 会话 = useSessionStore();
const 状态消息 = ref("正在准备单点登录...");
const 错误消息 = ref("");
const 当前入口 = computed<单点登录入口>(() => 识别入口());
const 入口名称 = computed(() => (当前入口.value === "partner" ? "渠道伙伴入口" : "厂商管理入口"));
const 客户端类型 = computed(() => 读取查询文本("clientType") || (是移动访问() ? "mobile" : "pc"));

onMounted(() => {
  void 执行单点登录();
});

async function 执行单点登录() {
  错误消息.value = "";
  try {
    状态消息.value = "正在读取单点登录配置...";
    const 配置 = await 读取单点登录配置();
    状态消息.value = "正在读取单点登录凭证...";
    const token = 读取Url凭证() || (await 读取Emm凭证(配置));
    清理Url敏感参数();
    状态消息.value = "正在校验单点登录身份...";
    await 会话.单点登录系统(token, 当前入口.value, 客户端类型.value);
    状态消息.value = "单点登录成功，正在进入系统...";
    window.location.replace(读取安全跳转地址());
  } catch (error) {
    清理Url敏感参数();
    错误消息.value = error instanceof Error ? error.message : "单点登录失败，请重新进入。";
    状态消息.value = "单点登录未完成";
  }
}

function 识别入口(): 单点登录入口 {
  const entry = 读取查询文本("entry") || 读取查询文本("scope") || 读取查询文本("入口");
  if (entry === "partner" || entry === "渠道") return "partner";
  if (entry === "admin" || entry === "厂商") return "admin";

  const redirect = 读取查询文本("redirect");
  if (redirect.startsWith("/partner") || redirect.startsWith("/mobile/partner")) return "partner";
  if (redirect.startsWith("/admin") || redirect.startsWith("/mobile/admin")) return "admin";
  return 是移动访问() ? "partner" : "admin";
}

function 读取查询文本(name: string): string {
  const value = 路由.query[name];
  if (Array.isArray(value)) return String(value[0] || "").trim();
  return String(value || "").trim();
}

function 读取Url凭证(): string {
  const 查询集合 = [
    window.location.search.replace(/^\?/, ""),
    window.location.hash.includes("?")
      ? window.location.hash.slice(window.location.hash.indexOf("?") + 1)
      : "",
  ].filter(Boolean);

  for (const queryText of 查询集合) {
    const params = new URLSearchParams(queryText);
    for (const name of 凭证参数名) {
      const value = String(params.get(name) || "").trim();
      if (value) return value;
    }
  }
  return "";
}

async function 读取Emm凭证(配置: 单点登录配置): Promise<string> {
  if (!配置.enabled) throw new Error("单点登录未启用。");
  if (!是移动访问() && 读取查询文本("source") !== "emm") {
    throw new Error("缺少单点登录凭证，请从 IAM 入口重新进入。");
  }
  await 加载Emm桥接脚本();
  return 请求Emm凭证(配置);
}

function 加载Emm桥接脚本(): Promise<void> {
  if (window.JQAPI?.getSSOToken) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const 已存在脚本 = document.querySelector<HTMLScriptElement>('script[data-emm-h5-sso="true"]');
    if (已存在脚本) {
      已存在脚本.addEventListener("load", () => resolve(), { once: true });
      已存在脚本.addEventListener(
        "error",
        () => reject(new Error("EMM 单点登录桥接脚本加载失败。")),
        {
          once: true,
        },
      );
      return;
    }
    const script = document.createElement("script");
    script.src = "/emm-h5-sso.js";
    script.async = true;
    script.dataset.emmH5Sso = "true";
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("EMM 单点登录桥接脚本加载失败。")), {
      once: true,
    });
    document.head.appendChild(script);
  });
}

function 请求Emm凭证(配置: 单点登录配置): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!window.JQAPI?.getSSOToken) {
      reject(new Error("当前环境未检测到 EMM 单点登录能力。"));
      return;
    }
    let finished = false;
    const timer = window.setTimeout(() => {
      if (finished) return;
      finished = true;
      reject(new Error("未能从 EMM 获取单点登录凭证，请确认当前页面在 EMM 客户端中打开。"));
    }, 配置.timeoutMs || 默认超时毫秒);

    function finish(callback: Emm回调): Emm回调 {
      return (data) => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timer);
        callback(data);
      };
    }

    window.JQAPI.getSSOToken(
      { ISAID: 配置.requestIsaidByEntry[当前入口.value] },
      finish((data) => {
        const token = 解析Emm返回凭证(data);
        if (!token) {
          reject(new Error("EMM 返回缺少单点登录凭证。"));
          return;
        }
        resolve(token);
      }),
      finish((data) => {
        reject(new Error(解析Emm错误(data)));
      }),
    );
  });
}

function 解析Emm返回凭证(data: unknown): string {
  const payload = 解析Emm返回(data);
  const token = payload.SSOToken?.token || payload.SSOToken?.ltpatoken || "";
  return String(token || "").trim();
}

function 解析Emm错误(data: unknown): string {
  try {
    const payload = 解析Emm返回(data);
    return String(payload.msg || "EMM 单点登录失败，请稍后重试。");
  } catch {
    return data ? String(data) : "EMM 单点登录失败，请稍后重试。";
  }
}

function 解析Emm返回(data: unknown): {
  SSOToken?: { token?: string; ltpatoken?: string };
  msg?: string;
} {
  if (!data) return {};
  if (typeof data === "string")
    return JSON.parse(data) as { SSOToken?: { token?: string }; msg?: string };
  return data as { SSOToken?: { token?: string; ltpatoken?: string }; msg?: string };
}

function 读取安全跳转地址(): string {
  const redirect = 读取查询文本("redirect");
  return 选择登录后路径(会话.user, {
    移动访问: 是移动访问(),
    候选路径: redirect,
  });
}

function 清理Url敏感参数() {
  const search = 清理查询字符串(window.location.search);
  const hash = 清理Hash(window.location.hash);
  window.history.replaceState(
    window.history.state,
    "",
    `${window.location.pathname}${search}${hash}`,
  );
}

function 清理查询字符串(search: string): string {
  if (!search) return "";
  const params = new URLSearchParams(search);
  凭证参数名.forEach((name) => params.delete(name));
  const text = params.toString();
  return text ? `?${text}` : "";
}

function 清理Hash(hash: string): string {
  if (!hash || !hash.includes("?")) return hash;
  const [path = "", query = ""] = hash.split("?");
  const params = new URLSearchParams(query);
  凭证参数名.forEach((name) => params.delete(name));
  const text = params.toString();
  return text ? `${path}?${text}` : path;
}

function 返回登录页() {
  void 路由器.replace({ path: "/login", query: { entry: 当前入口.value } });
}

function 是移动访问() {
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobile = /iphone|ipad|ipod|android|webos|blackberry|windows phone/i.test(userAgent);
  const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth < 768;
  return isMobile || (isSmallScreen && isTouch);
}
</script>

<template>
  <main class="登录页">
    <section class="登录面板 单点登录面板">
      <div class="登录品牌">
        <strong>单点登录</strong>
        <span>{{ 入口名称 }}</span>
      </div>
      <div class="单点状态" :class="{ '单点状态-失败': 错误消息 }">
        <span class="单点圆点" aria-hidden="true"></span>
        <p>{{ 状态消息 }}</p>
      </div>
      <p v-if="错误消息" class="错误提示">{{ 错误消息 }}</p>
      <button v-if="错误消息" class="登录按钮" type="button" @click="返回登录页">
        返回账号密码登录
      </button>
    </section>
  </main>
</template>

<style scoped>
.单点登录面板 {
  display: grid;
  gap: 18px;
}

.单点状态 {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  padding: 14px;
  border: 1px solid #cfe0e5;
  border-radius: 8px;
  background: #eef8fa;
  color: #15515d;
}

.单点状态 p {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
}

.单点状态-失败 {
  border-color: #f2c7c2;
  background: #fff4f2;
  color: #b42318;
}

.单点圆点 {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #1f7a8c;
  box-shadow: 0 0 0 6px rgba(31, 122, 140, 0.12);
}

.单点状态-失败 .单点圆点 {
  background: #b42318;
  box-shadow: 0 0 0 6px rgba(180, 35, 24, 0.1);
}
</style>
