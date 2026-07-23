<script setup lang="ts">
import { House, Iphone, SwitchButton, User } from "@element-plus/icons-vue";
</script>

<template>
  <main class="布局 布局-渠道">
    <header class="顶部栏 顶部栏-渠道">
      <RouterLink class="品牌块" to="/unified">
        <el-icon><House /></el-icon>
        <strong>联软CRM V3</strong>
      </RouterLink>
      <nav class="导航组" aria-label="渠道端导航">
        <RouterLink class="图标按钮" to="/partner">
          <el-icon><User /></el-icon>
          <span>渠道端</span>
        </RouterLink>
        <RouterLink class="图标按钮" to="/mobile">
          <el-icon><Iphone /></el-icon>
          <span>移动端</span>
        </RouterLink>
        <RouterLink class="图标按钮" to="/session-expired">
          <el-icon><SwitchButton /></el-icon>
          <span>会话</span>
        </RouterLink>
      </nav>
    </header>
    <section class="内容区">
      <RouterView />
    </section>
  </main>
</template>
