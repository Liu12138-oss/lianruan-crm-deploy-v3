<script setup lang="ts">
import type { 指标项 } from "./types.js";

defineProps<{ items: 指标项[] }>();
</script>

<template>
  <div class="war-kpis">
    <article v-for="item in items" :key="item.label" class="list-kpi">
      <div class="metric-label">
        <span>{{ item.label }}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
          <path d="M3 17l6-6 4 4 8-8" />
        </svg>
      </div>
      <div class="metric-value">
        <strong>{{ item.value }}</strong>
        <small v-if="item.unit">{{ item.unit }}</small>
      </div>
      <div v-if="item.note" class="metric-foot">{{ item.note }}</div>
    </article>
  </div>
</template>
