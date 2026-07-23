<script setup lang="ts">
import { House, Menu, Tools, User } from "@element-plus/icons-vue";
</script>

<template>
  <main class="布局 布局-管理">
    <aside class="侧边栏">
      <RouterLink class="品牌块" to="/unified">
        <el-icon><House /></el-icon>
        <strong>联软CRM V3</strong>
      </RouterLink>
      <nav class="纵向导航" aria-label="管理端导航">
        <RouterLink class="图标按钮" to="/admin">
          <el-icon><Menu /></el-icon>
          <span>管理端</span>
        </RouterLink>
        <RouterLink class="图标按钮" to="/partner">
          <el-icon><User /></el-icon>
          <span>渠道端</span>
        </RouterLink>
        <RouterLink class="图标按钮" to="/maintenance">
          <el-icon><Tools /></el-icon>
          <span>维护页</span>
        </RouterLink>
      </nav>
    </aside>
    <section class="内容区">
      <RouterView />
    </section>
  </main>
</template>
