<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import { 读取阶段9概览 } from "../api/business-client.js";
import V2TopActions from "../components/V2TopActions.vue";
import { useSessionStore } from "../stores/session.js";

interface 菜单项 {
  名称: string;
  图标: string;
  路径: string;
  精确?: boolean;
  徽标?: string;
  超管专属?: boolean;
}

interface 菜单组 {
  标题: string;
  菜单: 菜单项[];
}

interface 顶栏动作实例 {
  打开修改密码弹窗: () => void;
}

const 路由 = useRoute();
const 路由器 = useRouter();
const 会话 = useSessionStore();
const 菜单打开 = ref(false);
const 待办数量 = ref(0);
const 窄屏 = ref(false);
const 顶栏动作 = ref<顶栏动作实例 | null>(null);

const 菜单组列表: 菜单组[] = [
  {
    标题: "工作台",
    菜单: [{ 名称: "总览仪表盘", 图标: "📊", 路径: "/admin/dashboard" }],
  },
  {
    标题: "业务管理",
    菜单: [
      { 名称: "商机管理", 图标: "🎯", 路径: "/admin/opportunity" },
      { 名称: "客户报备", 图标: "📋", 路径: "/admin/registration", 徽标: "待审" },
      { 名称: "报价管理", 图标: "💰", 路径: "/admin/quote" },
      { 名称: "订单管理", 图标: "📦", 路径: "/admin/order" },
    ],
  },
  {
    标题: "产品",
    菜单: [{ 名称: "产品目录", 图标: "🗂️", 路径: "/admin/products", 精确: true }],
  },
  {
    标题: "管理后台",
    菜单: [
      { 名称: "经营报表", 图标: "📈", 路径: "/admin/partner-report", 精确: true },
      { 名称: "渠道商管理", 图标: "🤝", 路径: "/admin/partners" },
      { 名称: "企业管理员", 图标: "🏢", 路径: "/admin/partner-admin", 精确: true },
      { 名称: "审核中心", 图标: "✅", 路径: "/admin/admin-review", 精确: true, 徽标: "待办" },
      { 名称: "账号管理", 图标: "👤", 路径: "/admin/account-manage", 超管专属: true },
      { 名称: "操作日志", 图标: "📋", 路径: "/admin/audit-logs", 精确: true, 超管专属: true },
      {
        名称: "OpenAPI 对接",
        图标: "🔌",
        路径: "/admin/openapi-integration",
        精确: true,
        超管专属: true,
      },
    ],
  },
];

const 当前标题 = computed(() => String(路由.meta.标题 || 路由.name || "管理端"));
const 用户简称 = computed(() => (会话.用户名 || "用户").slice(0, 1));
const 可见菜单组列表 = computed(() =>
  菜单组列表
    .map((group) => ({ ...group, 菜单: group.菜单.filter((item) => 可显示菜单(item)) }))
    .filter((group) => group.菜单.length > 0),
);

function 是激活(item: 菜单项) {
  if (item.精确) return 路由.path === item.路径;
  return 路由.path === item.路径 || 路由.path.startsWith(`${item.路径}/`);
}

function 可显示菜单(item: 菜单项) {
  if (item.超管专属 && !是超管账号()) return false;
  const paths = 会话.user?.allowedPaths || [];
  if (!paths.length || paths.includes("*")) return true;
  return paths.some(
    (path) =>
      path === item.路径 || item.路径.startsWith(`${path}/`) || path.startsWith(`${item.路径}/`),
  );
}

function 是超管账号() {
  const role = `${会话.user?.roleName || ""} ${会话.user?.username || ""}`.toLowerCase();
  return /超管|超级管理员|系统管理员|superadmin|root/.test(role);
}

function 菜单徽标(item: 菜单项) {
  if (!item.徽标) return "";
  if (item.路径.includes("registration") || item.路径.includes("admin-review")) {
    return 待办数量.value > 99 ? "99+" : String(待办数量.value || item.徽标);
  }
  return item.徽标;
}

function 同步窄屏() {
  窄屏.value = typeof window !== "undefined" && window.innerWidth <= 860;
  if (!窄屏.value) 菜单打开.value = false;
}

function 切换菜单() {
  菜单打开.value = !菜单打开.value;
}

function 关闭菜单() {
  菜单打开.value = false;
}

async function 加载待办数量() {
  try {
    const 概览 = await 读取阶段9概览();
    待办数量.value = 概览.待办.length;
  } catch {
    待办数量.value = 0;
  }
}

function 修改密码() {
  顶栏动作.value?.打开修改密码弹窗();
}

async function 退出() {
  await 会话.退出系统();
  await 路由器.push("/login");
}

watch(
  () => 路由.fullPath,
  () => 关闭菜单(),
);

onMounted(() => {
  同步窄屏();
  window.addEventListener("resize", 同步窄屏);
  void 加载待办数量();
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", 同步窄屏);
});
</script>

<template>
  <main class="v2-桌面布局 v2-管理端布局" :class="{ 'v2-移动侧栏打开': 菜单打开 }">
    <button
      v-if="窄屏 && 菜单打开"
      class="v2-侧栏遮罩"
      type="button"
      aria-label="关闭菜单"
      @click="关闭菜单"
    />

    <aside class="v2-侧边栏">
      <RouterLink class="v2-品牌" to="/unified">
        <span class="v2-品牌标识">🛡️</span>
        <span class="v2-品牌文字">
          <strong>联软渠道平台</strong>
          <small>Channel Portal</small>
        </span>
      </RouterLink>

      <nav class="v2-侧边导航" aria-label="管理端导航">
        <section v-for="group in 可见菜单组列表" :key="group.标题" class="v2-菜单组">
          <p class="v2-菜单组标题">{{ group.标题 }}</p>
          <RouterLink
            v-for="item in group.菜单"
            :key="item.路径"
            class="v2-菜单项"
            :class="{ active: 是激活(item) }"
            :to="item.路径"
          >
            <span class="v2-菜单图标">{{ item.图标 }}</span>
            <span>{{ item.名称 }}</span>
            <em v-if="菜单徽标(item)" class="v2-菜单徽标">{{ 菜单徽标(item) }}</em>
          </RouterLink>
        </section>
      </nav>

      <footer v-if="会话.已登录" class="v2-侧边底部">
        <div class="v2-用户卡">
          <span class="v2-用户头像">{{ 用户简称 }}</span>
          <span class="v2-用户信息">
            <strong>{{ 会话.用户名 }}</strong>
            <small>
              <button type="button" @click="修改密码">修改密码</button>
              <i>|</i>
              <button type="button" @click="退出">退出登录</button>
            </small>
          </span>
        </div>
      </footer>
    </aside>

    <section class="v2-内容区">
      <header class="v2-顶部栏">
        <div class="v2-面包屑">
          <button
            v-if="窄屏"
            class="v2-移动菜单按钮"
            type="button"
            aria-label="打开菜单"
            @click="切换菜单"
          >
            ☰
          </button>
          <span>联软渠道平台</span>
          <b>›</b>
          <strong>{{ 当前标题 }}</strong>
        </div>
        <V2TopActions ref="顶栏动作" :用户名="会话.用户名" />
      </header>
      <main class="v2-页面内容">
        <RouterView />
      </main>
    </section>
  </main>
</template>
