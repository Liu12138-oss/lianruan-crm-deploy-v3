<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

import { useSessionStore } from "../stores/session.js";
import { 使用工作区Store } from "../stores/workspace.js";

const 路由 = useRoute();
const 工作区 = 使用工作区Store();
const 会话 = useSessionStore();
const 标题 = computed(() => 路由.meta.标题 ?? "联软CRM V3");
const 描述 = computed(() => 路由.meta.描述 ?? "工程化骨架已就绪。");
</script>

<template>
  <article class="工作区面板">
    <p class="状态标签">V3验收版</p>
    <h1>{{ 标题 }}</h1>
    <p class="摘要">{{ 描述 }}</p>
    <dl class="信息网格">
      <div>
        <dt>版本</dt>
        <dd>{{ 工作区.版本 }}</dd>
      </div>
      <div>
        <dt>健康检查</dt>
        <dd>{{ 工作区.健康检查路径.length }}项</dd>
      </div>
      <div>
        <dt>当前账号</dt>
        <dd>{{ 会话.用户名 }}</dd>
      </div>
      <div>
        <dt>当前角色</dt>
        <dd>{{ 会话.角色名 }}</dd>
      </div>
    </dl>
  </article>
</template>
