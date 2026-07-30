<script setup lang="ts">
import { House, Iphone, Menu, User } from "@element-plus/icons-vue";

import SessionBar from "../components/SessionBar.vue";
</script>

<template>
  <main class="布局 布局-统一">
    <header class="顶部栏">
      <div class="品牌块">
        <el-icon><House /></el-icon>
        <strong>联软CRM V3</strong>
      </div>
      <nav class="导航组" aria-label="工作区导航">
        <RouterLink class="图标按钮" to="/admin" aria-label="管理端">
          <el-icon><Menu /></el-icon>
          <span>管理端</span>
        </RouterLink>
        <RouterLink class="图标按钮" to="/partner" aria-label="渠道端">
          <el-icon><User /></el-icon>
          <span>渠道端</span>
        </RouterLink>
        <RouterLink class="图标按钮" to="/mobile" aria-label="移动端">
          <el-icon><Iphone /></el-icon>
          <span>移动端</span>
        </RouterLink>
      </nav>
      <SessionBar />
    </header>
    <section class="内容区 内容区-居中">
      <RouterView />
    </section>
  </main>
</template>
