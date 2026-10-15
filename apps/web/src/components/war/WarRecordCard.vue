<script setup lang="ts">
import type { 记录标签 } from "./types.js";

defineProps<{
  title: string;
  meta?: string;
  badge?: string;
  tone?: "blue" | "green" | "amber" | "red" | "gray";
  owner?: string;
  amount?: string;
  tags?: 记录标签[];
  actions?: Array<{ text: string; path?: string }>;
  active?: boolean;
}>();

defineEmits<{ 选择: []; 动作: [text: string] }>();
</script>

<template>
  <article class="war-record" :class="{ active }" @click="$emit('选择')">
    <div class="war-record-top">
      <strong>{{ title }}</strong>
      <span v-if="badge" class="status" :class="tone || 'blue'">{{ badge }}</span>
    </div>
    <p v-if="meta">{{ meta }}</p>
    <div v-if="owner || amount" class="war-record-bottom">
      <span>{{ owner || "" }}</span>
      <strong>{{ amount || "" }}</strong>
    </div>
    <div v-if="tags?.length" class="record-tags">
      <span v-for="tag in tags" :key="tag.text" :class="{ hot: tag.hot }">{{ tag.text }}</span>
    </div>
    <div v-if="actions?.length" class="war-record-actions">
      <button
        v-for="动作 in actions"
        :key="动作.text"
        type="button"
        class="link"
        @click.stop="$emit('动作', 动作.text)"
      >
        {{ 动作.text }}
      </button>
    </div>
  </article>
</template>
