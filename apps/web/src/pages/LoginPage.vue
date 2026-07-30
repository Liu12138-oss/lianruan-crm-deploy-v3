<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import { useSessionStore } from "../stores/session.js";

type 登录入口 = "admin" | "partner";

const 会话 = useSessionStore();
const 路由 = useRouter();
const 当前路由 = useRoute();
const 表单 = reactive({ username: "", password: "" });
const 提交中 = computed(() => 会话.loading);
const 设备提示 = ref("正在检测设备类型...");
const 推荐入口 = ref<登录入口>("admin");
const 已选入口 = ref<登录入口 | "">(读取初始入口());
const 显示登录表单 = computed(() => Boolean(已选入口.value));
const 当前入口配置 = computed(() =>
  已选入口.value === "partner"
    ? {
        图标: "🤝",
        标题: "渠道合作伙伴入口",
        徽标: "Partner",
        徽标类: "partner-badge",
        账号标签: "员工账号",
        占位: "请输入员工账号",
        说明: "请使用已开通的企业管理员或普通员工账号登录。",
        切换文案: "← 前往厂商管理入口",
        切换入口: "admin" as 登录入口,
        默认路径: "/partner/dashboard",
      }
    : {
        图标: "🏢",
        标题: "厂商管理后台",
        徽标: "Admin",
        徽标类: "admin-badge",
        账号标签: "管理员账号",
        占位: "请输入管理员账号",
        说明: "请使用已分配的管理员账号登录。",
        切换文案: "← 前往渠道伙伴入口",
        切换入口: "partner" as 登录入口,
        默认路径: "/admin/dashboard",
      },
);

async function 提交登录() {
  await 会话.登录系统(表单.username, 表单.password);
  const redirect = typeof 当前路由.query.redirect === "string" ? 当前路由.query.redirect : "";
  await 路由.push(redirect || 会话.user?.defaultPath || 当前入口配置.value.默认路径 || "/unified");
}

function 读取初始入口(): 登录入口 | "" {
  const entry = String(当前路由.query.entry || 当前路由.query["入口"] || "");
  if (entry === "select" || entry === "选择") return "";
  if (entry === "admin" || entry === "厂商") return "admin";
  if (entry === "partner" || entry === "渠道") return "partner";

  const redirect = typeof 当前路由.query.redirect === "string" ? 当前路由.query.redirect : "";
  if (redirect.startsWith("/admin") || redirect.startsWith("/mobile/admin")) return "admin";
  if (redirect.startsWith("/partner") || redirect.startsWith("/mobile/partner")) return "partner";
  return 是移动访问() ? "partner" : "admin";
}

function 选择入口(entry: 登录入口) {
  已选入口.value = entry;
  会话.errorMessage = "";
}

onMounted(() => {
  const 是移动设备 = 是移动访问();
  const isTablet = /ipad|android(?!.*mobile)|tablet/i.test(navigator.userAgent.toLowerCase());
  推荐入口.value = 是移动设备 || isTablet ? "partner" : "admin";
  设备提示.value = 是移动设备
    ? "📱 已检测到移动设备"
    : isTablet
      ? "📱 已检测到平板设备"
      : "💻 已检测到桌面设备";
});

function 是移动访问() {
  if (typeof window === "undefined") return false;
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobile = /iphone|ipad|ipod|android|webos|blackberry|windows phone/i.test(userAgent);
  const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth < 768;
  return isMobile || (isSmallScreen && isTouch);
}
</script>

<template>
  <main class="login-page" :class="{ 'role-select-page': !显示登录表单 }">
    <section v-if="!显示登录表单" class="role-select">
      <div class="brand-logo">
        <div class="logo-icon">🛡️</div>
        <h1>联软渠道管理平台</h1>
        <p>安全产品报价 · 报备 · 下单系统</p>
      </div>

      <div class="role-options">
        <button
          class="role-option admin"
          :class="{ recommended: 推荐入口 === 'admin' }"
          type="button"
          @click="选择入口('admin')"
        >
          <span class="icon">🏢</span>
          <span class="content">
            <strong class="title">厂商管理入口</strong>
            <small class="desc"
              >超级管理员、区域管理员登录<br />经营报表 · 渠道管理 · 审核中心</small
            >
          </span>
          <span class="arrow">→</span>
        </button>

        <button
          class="role-option partner"
          :class="{ recommended: 推荐入口 === 'partner' }"
          type="button"
          @click="选择入口('partner')"
        >
          <span class="icon">🤝</span>
          <span class="content">
            <strong class="title">渠道合作伙伴入口</strong>
            <small class="desc">代理商、经销商登录<br />客户报备 · 商机管理 · 快速报价</small>
          </span>
          <span class="arrow">→</span>
        </button>
      </div>

      <div class="device-hint">
        <p>💡 提示：手机访问渠道伙伴入口体验更佳</p>
        <p class="detected">{{ 设备提示 }}</p>
      </div>

      <div class="role-footer">© 2026 联软科技 · 渠道管理平台 v2.0</div>
    </section>

    <template v-else>
      <div class="login-bg-circles" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <section class="login-card">
        <div class="login-logo">
          <div class="logo-icon">{{ 当前入口配置.图标 }}</div>
          <h1>联软渠道管理平台</h1>
          <p>
            {{ 当前入口配置.标题 }}
            <span :class="当前入口配置.徽标类">{{ 当前入口配置.徽标 }}</span>
          </p>
        </div>

        <form class="login-form" @submit.prevent="提交登录">
          <label>
            <span class="form-label">{{ 当前入口配置.账号标签 }}</span>
            <input
              v-model="表单.username"
              class="form-control"
              autocomplete="username"
              :placeholder="当前入口配置.占位"
            />
          </label>
          <label>
            <span class="form-label">密码</span>
            <input
              v-model="表单.password"
              class="form-control"
              autocomplete="current-password"
              placeholder="请输入密码"
              type="password"
            />
          </label>
          <p v-if="会话.errorMessage" class="错误提示">{{ 会话.errorMessage }}</p>
          <button class="btn btn-primary login-submit" type="submit" :disabled="提交中">
            <span>{{ 提交中 ? "登录中..." : "登 录" }}</span>
          </button>
        </form>
        <div class="login-footer">
          <p>{{ 当前入口配置.说明 }}</p>
          <p>如需开通账号或重置密码，请联系系统管理员。</p>
          <button type="button" @click="选择入口(当前入口配置.切换入口)">
            {{ 当前入口配置.切换文案 }}
          </button>
          <p>© 2026 联软科技 · 渠道管理平台 v2.0</p>
        </div>
      </section>
    </template>
  </main>
</template>
