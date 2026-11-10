<script setup lang="ts">
import type { 指标项 } from "./types.js";

defineProps<{ items: 指标项[]; 加载中?: boolean }>();
const emit = defineEmits<{ 选择: [path: string] }>();

function 选择指标(item: 指标项): void {
  if (item.path) emit("选择", item.path);
}
</script>

<template>
  <div class="war-kpis">
    <article
      v-for="item in items"
      :key="item.label"
      class="list-kpi"
      :class="{ 可跳转: Boolean(item.path) }"
      :role="item.path ? 'button' : undefined"
      :tabindex="item.path ? 0 : undefined"
      @click="选择指标(item)"
      @keydown.enter.prevent="选择指标(item)"
      @keydown.space.prevent="选择指标(item)"
    >
      <div class="metric-label">
        <span>{{ item.label }}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
          <path d="M3 17l6-6 4 4 8-8" />
        </svg>
      </div>
      <div class="metric-value">
        <strong>{{ 加载中 ? "—" : item.value }}</strong>
        <small v-if="!加载中 && item.unit">{{ item.unit }}</small>
      </div>
      <div v-if="item.note" class="metric-foot">
        {{ 加载中 ? "数据加载中…" : item.note }}
      </div>
    </article>
  </div>
</template>

<style scoped>
.list-kpi.可跳转 {
  cursor: pointer;
}

.list-kpi.可跳转:focus-visible {
  outline: 2px solid #2f69ed;
  outline-offset: 2px;
}
</style>
