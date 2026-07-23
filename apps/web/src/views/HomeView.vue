<template>
  <ShellFrame title="联软CRM V3" subtitle="统一入口骨架" tone="entry">
    <h1>统一入口</h1>
    <nav class="route-grid" aria-label="阶段1测试路由">
      <RouterLink to="/admin">管理端</RouterLink>
      <RouterLink to="/partner">渠道端</RouterLink>
      <RouterLink to="/mobile">移动端</RouterLink>
      <RouterLink to="/maintenance">维护页</RouterLink>
    </nav>
  </ShellFrame>
</template>

<script setup lang="ts">
import ShellFrame from "../components/ShellFrame.vue";
</script>
