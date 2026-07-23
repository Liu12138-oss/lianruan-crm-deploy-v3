<template>
  <ShellFrame title="无权限" subtitle="访问被拒绝" tone="error">
    <h1>无权限访问</h1>
    <p>当前账号没有访问该资源的权限。</p>
  </ShellFrame>
</template>

<script setup lang="ts">
import ShellFrame from "../components/ShellFrame.vue";
</script>
