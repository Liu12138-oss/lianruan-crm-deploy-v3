<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

import { useSessionStore } from "../stores/session.js";

const 路由 = useRoute();
const 路由器 = useRouter();
const 会话 = useSessionStore();
const 是管理员 = computed(() => {
  if (路由.path.startsWith("/mobile/admin")) return true;
  if (路由.path.startsWith("/mobile/partner")) return false;
  const paths = 会话.user?.allowedPaths || [];
  return (
    会话.user?.defaultPath.startsWith("/admin") || paths.some((path) => path.startsWith("/admin"))
  );
});
const 当前标题 = computed(() => String(路由.meta.标题 || "联软渠道平台"));
const 当前副标题 = computed(() => 会话.角色名 || (是管理员.value ? "管理员" : "渠道伙伴"));
const 是二级页面 = computed(() => 路由.path.includes("/new") || 路由.path.includes("/detail"));
const 显示底部导航 = computed(() => !是二级页面.value);

const 导航项列表 = computed(() =>
  是管理员.value
    ? [
        { 名称: "工作台", 图标: "⌂", 路径: "/mobile/admin/home" },
        { 名称: "审核", 图标: "✓", 路径: "/mobile/admin/reviews" },
        { 名称: "业务", 图标: "▦", 路径: "/mobile/admin/business" },
        { 名称: "渠道", 图标: "◇", 路径: "/mobile/admin/partners" },
        { 名称: "我的", 图标: "◉", 路径: "/mobile/me" },
      ]
    : [
        { 名称: "工作台", 图标: "⌂", 路径: "/mobile/partner/home" },
        { 名称: "客户", 图标: "＋", 路径: "/mobile/partner/registrations" },
        { 名称: "商机", 图标: "◉", 路径: "/mobile/partner/opportunities" },
        { 名称: "报价", 图标: "¥", 路径: "/mobile/partner/quotes" },
        { 名称: "我的", 图标: "◉", 路径: "/mobile/me" },
      ],
);

function 返回上一页() {
  const 默认路径 = 是管理员.value ? "/mobile/admin/home" : "/mobile/partner/home";
  if (window.history.length > 1) {
    路由器.back();
    return;
  }
  void 路由器.push(默认路径);
}

function 刷新当前页() {
  window.dispatchEvent(new CustomEvent("v2-mobile-refresh"));
}
</script>

<template>
  <main class="移动端页面">
    <section class="移动端壳">
      <header class="移动端头部">
        <button
          v-if="是二级页面"
          class="移动端头部按钮"
          type="button"
          aria-label="返回"
          @click="返回上一页"
        >
          ‹
        </button>
        <span v-else class="移动端头部占位"></span>
        <div class="移动端标题">
          <strong>{{ 当前标题 }}</strong>
          <small>{{ 当前副标题 }}</small>
        </div>
        <button class="移动端头部按钮" type="button" aria-label="刷新" @click="刷新当前页">
          ↻
        </button>
      </header>
      <main class="移动端内容" :class="{ '移动端内容-有导航': 显示底部导航 }">
        <RouterView />
      </main>
      <nav v-if="显示底部导航" class="移动端导航" aria-label="移动端导航">
        <RouterLink
          v-for="item in 导航项列表"
          :key="item.路径"
          class="移动端导航项"
          :to="item.路径"
        >
          <span>{{ item.图标 }}</span>
          <span>{{ item.名称 }}</span>
        </RouterLink>
      </nav>
    </section>
  </main>
</template>
