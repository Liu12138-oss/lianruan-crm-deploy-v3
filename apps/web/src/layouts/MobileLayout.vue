<script setup lang="ts">
import { House, Iphone, User } from "@element-plus/icons-vue";
</script>

<template>
  <main class="布局 布局-移动">
    <section class="移动壳">
      <header class="移动栏">
        <RouterLink class="品牌块" to="/unified">
          <el-icon><House /></el-icon>
          <strong>联软CRM V3</strong>
        </RouterLink>
      </header>
      <RouterView />
      <nav class="移动导航" aria-label="移动端导航">
        <RouterLink class="图标按钮" to="/mobile">
          <el-icon><Iphone /></el-icon>
          <span>移动端</span>
        </RouterLink>
        <RouterLink class="图标按钮" to="/partner">
          <el-icon><User /></el-icon>
          <span>渠道端</span>
        </RouterLink>
      </nav>
    </section>
  </main>
</template>
