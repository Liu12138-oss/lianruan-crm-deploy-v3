<script setup lang="ts">
import { computed, reactive } from "vue";
import { useRoute } from "vue-router";

import { 是否移动访问, 选择登录后路径 } from "../router/entry-target.js";
import { useSessionStore } from "../stores/session.js";

const 会话 = useSessionStore();
const 当前路由 = useRoute();
const 表单 = reactive({ username: "", password: "" });
const 提交中 = computed(() => 会话.loading);

async function 提交登录() {
  await 会话.登录系统(表单.username, 表单.password);
  const redirect = typeof 当前路由.query.redirect === "string" ? 当前路由.query.redirect : "";
  const 实际页面 = 选择登录后路径(会话.user, {
    移动访问: 是否移动访问(),
    候选路径: redirect,
  });
  window.location.assign(实际页面);
}
</script>

<template>
  <main class="login-page">
    <div class="login-bg-circles" aria-hidden="true">
      <span></span>
      <span></span>
      <span></span>
    </div>
    <section class="login-card">
      <div class="login-logo">
        <div class="logo-icon">🛡️</div>
        <h1>联软渠道管理平台</h1>
        <p>统一登录入口</p>
      </div>

      <form class="login-form" @submit.prevent="提交登录">
        <label>
          <span class="form-label">登录账号</span>
          <input
            v-model="表单.username"
            class="form-control"
            autocomplete="username"
            placeholder="请输入登录账号"
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
        <p>系统会根据账号权限自动进入对应页面。</p>
        <p>如需开通账号或重置密码，请联系系统管理员。</p>
        <p>© 2026 联软科技 · 渠道管理平台 V3</p>
      </div>
    </section>
  </main>
</template>
