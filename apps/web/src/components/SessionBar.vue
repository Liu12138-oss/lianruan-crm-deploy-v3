<script setup lang="ts">
import { SwitchButton, User } from "@element-plus/icons-vue";
import { useRouter } from "vue-router";

import { useSessionStore } from "../stores/session.js";

const 会话 = useSessionStore();
const 路由 = useRouter();

async function 退出() {
  await 会话.退出系统();
  await 路由.push("/login");
}
</script>

<template>
  <div v-if="会话.已登录" class="会话栏">
    <span class="会话用户">
      <el-icon><User /></el-icon>
      <span>{{ 会话.用户名 }}</span>
    </span>
    <span class="会话角色">{{ 会话.角色名 }}</span>
    <button class="图标按钮" type="button" @click="退出">
      <el-icon><SwitchButton /></el-icon>
      <span>退出</span>
    </button>
  </div>
</template>
