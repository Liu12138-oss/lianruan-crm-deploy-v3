<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";

import V2TopActions from "../components/V2TopActions.vue";
import { useSessionStore } from "../stores/session.js";

interface 菜单项 {
  名称: string;
  路径: string;
  精确?: boolean;
}

interface 顶栏动作实例 {
  打开修改密码弹窗: () => void;
}

const 路由 = useRoute();
const 会话 = useSessionStore();
const 顶栏动作 = ref<顶栏动作实例 | null>(null);

const 菜单项列表: 菜单项[] = [
  { 名称: "工作台", 路径: "/partner/dashboard" },
  { 名称: "客户管理", 路径: "/partner/registration" },
  { 名称: "商机作战", 路径: "/partner/opportunity" },
  { 名称: "报价管理", 路径: "/partner/quote" },
  { 名称: "订单中心", 路径: "/partner/order" },
  { 名称: "产品目录", 路径: "/partner/products", 精确: true },
];

/**
 * 渠道关系与成员维护属于渠道企业管理员能力，不占用一级业务导航。
 * 测试口径要求渠道端一级导航固定 6 项，因此收口到右上角「企业管理」。
 */

const 用户简称 = computed(() => (会话.用户名 || "渠").slice(0, 1));
const 可见菜单项列表 = computed(() => 菜单项列表.filter((item) => 可显示菜单(item)));
/** 顶栏主操作：渠道账号可直接新建客户、商机和报价。 */
const 模块主操作 = computed(() => {
  const 路径 = 路由.path;
  if (路径 === "/partner/registration/new") return null;
  if (路径.startsWith("/partner/registration"))
    return { 文案: "新建客户", 目标: "/partner/registration/new" };
  if (路径 === "/partner/opportunity/new") return null;
  if (路径.startsWith("/partner/opportunity"))
    return { 文案: "新建商机", 目标: "/partner/opportunity/new" };
  if (路径 === "/partner/quote/new") return null;
  if (路径.startsWith("/partner/quote")) return { 文案: "新建报价", 目标: "/partner/quote/new" };
  return null;
});

function 是激活(item: 菜单项) {
  if (item.精确) return 路由.path === item.路径;
  return 路由.path === item.路径 || 路由.path.startsWith(`${item.路径}/`);
}

function 可显示菜单(item: 菜单项) {
  const paths = 会话.user?.allowedPaths || [];
  if (!paths.length || paths.includes("*")) return true;
  return paths.some(
    (path) =>
      path === item.路径 || item.路径.startsWith(`${path}/`) || path.startsWith(`${item.路径}/`),
  );
}

/** 兼容新老账号数据：角色标识可能在 roles、roleName 或页面会话中，任一命中即可。 */
function 是渠道企业管理员(): boolean {
  const 用户 = 会话.user;
  if (用户?.roles?.includes("partner_admin")) return true;
  if (/渠道管理员|企业管理员|渠道企业管理员/.test(用户?.roleName || "")) return true;
  if (typeof window === "undefined") return false;
  for (const 键 of ["partner_user_info", "partner_api_user", "api_user"]) {
    try {
      const 原文 = window.localStorage.getItem(键);
      if (!原文) continue;
      const 解析值 = JSON.parse(原文) as Record<string, unknown>;
      const 页面用户 = (解析值.user as Record<string, unknown> | undefined) || 解析值;
      const 角色 = String(页面用户.role || "").toLowerCase();
      const 角色列表 = Array.isArray(页面用户.roles)
        ? 页面用户.roles.map((项) => String(项).toLowerCase())
        : [];
      if (
        角色 === "partner_admin" ||
        角色列表.includes("partner_admin") ||
        /渠道管理员|企业管理员|渠道企业管理员/.test(String(页面用户.roleName || ""))
      ) {
        return true;
      }
    } catch {
      // 页面会话异常时继续尝试下一份兼容存储。
    }
  }
  return false;
}

function 修改密码() {
  顶栏动作.value?.打开修改密码弹窗();
}

async function 退出() {
  await 会话.退出系统();
  window.location.replace("/login");
}
</script>

<template>
  <main class="v2-桌面布局 v2-渠道端布局 v2-顶部导航布局">
    <header class="v2-顶部业务导航">
      <RouterLink class="v2-导航品牌" to="/partner/dashboard" aria-label="联软渠道管理平台">
        <span class="v2-导航品牌标识">L</span>
        <span class="v2-导航品牌文字">
          <strong>联软渠道管理平台</strong>
          <small>渠道工作台</small>
        </span>
      </RouterLink>

      <nav class="v2-一级导航" aria-label="渠道端一级导航">
        <RouterLink
          v-for="item in 可见菜单项列表"
          :key="item.路径"
          class="v2-一级导航项"
          :class="{ active: 是激活(item) }"
          :to="item.路径"
          :title="item.名称"
        >
          <span>{{ item.名称 }}</span>
        </RouterLink>
      </nav>

      <div class="v2-顶部业务动作">
        <RouterLink v-if="模块主操作" class="v2-顶部主操作" :to="模块主操作.目标">
          ＋ {{ 模块主操作.文案 }}
        </RouterLink>
        <V2TopActions ref="顶栏动作" :用户名="会话.用户名" />
        <span class="v2-顶部用户">
          <span class="v2-顶部头像">{{ 用户简称 }}</span>
          <span class="v2-顶部用户文案">
            <strong>{{ 会话.用户名 }}</strong>
            <small>{{ 会话.角色名 || "渠道用户" }}</small>
          </span>
          <details v-if="是渠道企业管理员()" class="v2-企业管理">
            <summary>企业管理</summary>
            <div class="v2-企业管理菜单">
              <RouterLink to="/partner/partners">渠道关系</RouterLink>
              <RouterLink to="/partner/members">成员维护</RouterLink>
            </div>
          </details>
          <button class="v2-修改密码" type="button" title="修改密码" @click="修改密码">
            修改密码
          </button>
          <button class="v2-顶部退出" type="button" title="退出登录" @click="退出">退出</button>
        </span>
      </div>
    </header>

    <section class="v2-内容区">
      <main class="v2-页面内容">
        <RouterView />
      </main>
    </section>
  </main>
</template>
