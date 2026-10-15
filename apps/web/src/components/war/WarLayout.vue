<script setup lang="ts">
defineProps<{
  listTitle: string;
  listCount?: string;
  searchPlaceholder?: string;
  modelValue?: string;
  tabs?: string[];
  activeTab?: string;
  区域列表?: string[];
  选中区域?: string;
  动态?: Array<{ 标题: string; 说明?: string; 时间?: string }>;
  步骤?: string[];
  当前步骤?: number;
  流程标题?: string;
  流程说明?: string;
}>();

defineEmits<{
  切换标签: [tab: string];
  "update:modelValue": [value: string];
  "update:选中区域": [value: string];
}>();
</script>

<template>
  <div class="war-layout">
    <aside class="war-panel war-list">
      <div class="war-list-head">
        <div class="war-title-row">
          <strong>{{ listTitle }}</strong>
          <span v-if="listCount" class="count-badge">{{ listCount }}</span>
        </div>
        <label class="war-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            :value="modelValue"
            :placeholder="searchPlaceholder || '搜索'"
            @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <div v-if="tabs?.length" class="war-tabs">
          <button
            v-for="tab in tabs"
            :key="tab"
            type="button"
            class="war-tab"
            :class="{ active: (activeTab || tabs[0]) === tab }"
            @click="$emit('切换标签', tab)"
          >
            {{ tab }}
          </button>
        </div>
        <div v-if="区域列表?.length" class="war-region">
          <label>区域范围</label>
          <select
            :value="选中区域 || '全部区域'"
            @change="$emit('update:选中区域', ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="区域 in ['全部区域', ...区域列表]" :key="区域" :value="区域">
              {{ 区域 }}
            </option>
          </select>
        </div>
      </div>
      <div class="war-list-body">
        <slot name="list" />
      </div>
    </aside>

    <main class="war-panel war-center">
      <slot name="center-head" />
      <section v-if="步骤?.length" class="stage-band">
        <div v-if="流程标题 || 流程说明" class="step-head">
          <span>{{ 流程标题 }}</span>
          <span v-if="流程说明">{{ 流程说明 }}</span>
        </div>
        <div class="step-dots">
          <div
            v-for="(项, 序号) in 步骤"
            :key="项"
            class="step-item"
            :class="{ done: 序号 < (当前步骤 ?? 0), active: 序号 === (当前步骤 ?? 0) }"
          >
            <span class="dot">{{ 序号 < (当前步骤 ?? 0) ? "✓" : 序号 + 1 }}</span>
            <strong>{{ 项 }}</strong>
          </div>
        </div>
      </section>
      <slot name="center" />
    </main>

    <aside class="war-panel war-right">
      <div class="right-section">
        <slot name="right" />
        <article v-if="动态?.length" class="right-card">
          <div class="right-card-title">
            <strong>最近动态</strong><span>{{ 动态.length }} 条</span>
          </div>
          <div class="timeline">
            <div v-for="(项, 序号) in 动态" :key="序号" class="timeline-item">
              <i class="timeline-dot"></i>
              <div>
                <strong>{{ 项.标题 }}</strong>
                <p v-if="项.说明">{{ 项.说明 }}</p>
              </div>
              <time v-if="项.时间">{{ 项.时间 }}</time>
            </div>
          </div>
        </article>
      </div>
    </aside>
  </div>
</template>
