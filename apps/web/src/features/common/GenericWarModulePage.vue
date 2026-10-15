<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import { 查询阶段9全部, type 阶段9模块, type 阶段9记录 } from "../../api/business-client.js";
import WarKpis from "../../components/war/WarKpis.vue";
import WarLayout from "../../components/war/WarLayout.vue";
import WarRecordCard from "../../components/war/WarRecordCard.vue";
import type { 记录标签, 指标项 } from "../../components/war/types.js";

export interface 字段配置 {
  标签: string;
  取值: (行: 阶段9记录) => string;
}

export interface 指标配置 {
  标签: string;
  单位?: string;
  说明?: string;
  取值: (行列表: 阶段9记录[], 总数: number) => string;
}

export interface 卡片配置 {
  标题: (行: 阶段9记录) => string;
  说明: (行: 阶段9记录) => string;
  徽标?: (行: 阶段9记录) => string;
  色调?: (行: 阶段9记录) => "blue" | "green" | "amber" | "red" | "gray";
  归属?: (行: 阶段9记录) => string;
  金额?: (行: 阶段9记录) => string;
  标签?: (行: 阶段9记录) => 记录标签[];
}

export interface 模块配置 {
  模块: 阶段9模块;
  列表标题: string;
  搜索占位?: string;
  标签?: string[];
  卡片: 卡片配置;
  详情: 字段配置[];
  指标: 指标配置[];
  说明?: string;
  处理路径?: (行: 阶段9记录) => string;
  处理文案?: string;
  /** 列表最多加载页数（每页 100），用于控制大数据量模块的首屏渲染；KPI 仍使用服务端总数。 */
  最大页数?: number;
  /** 只读核对页的维护入口：指向真正可写的模块（例如组织与账号）。 */
  维护入口?: { 文案: string; 路径: string };
}

const 属性 = defineProps<{ 配置: 模块配置 }>();
const 路由器 = useRouter();
const 加载中 = ref(false);
const 错误 = ref("");
const 列表 = ref<阶段9记录[]>([]);
const 总条数 = ref(0);
const 选中编号 = ref("");
const 当前标签 = ref("全部");
const 搜索词 = ref("");

const 标签列表 = computed(() => 属性.配置.标签?.length ? 属性.配置.标签 : ["全部"]);

const 过滤后列表 = computed(() => {
  const 关键词 = 搜索词.value.trim().toLowerCase();
  if (!关键词) return 列表.value;
  const 候选字段 = [
    ...属性.配置.详情.map((项) => 项.取值),
    属性.配置.卡片.标题,
    属性.配置.卡片.说明,
  ];
  return 列表.value.filter((行) =>
    候选字段.some((取值) => {
      try {
        return 取值(行).toLowerCase().includes(关键词);
      } catch {
        return false;
      }
    }),
  );
});

const 当前记录 = computed(
  () => 列表.value.find((行) => 行.id === 选中编号.value) || 过滤后列表.value[0] || null,
);

const 指标 = computed<指标项[]>(() =>
  属性.配置.指标.map((项) => ({
    label: 项.标签,
    value: 项.取值(列表.value, 总条数.value),
    ...(项.单位 ? { unit: 项.单位 } : {}),
    ...(项.说明 ? { note: 项.说明 } : {}),
  })),
);

/** 与原型一致：右栏展示当前记录的最近动态。 */
const 记录动态 = computed(() => {
  const 行 = 当前记录.value;
  if (!行) return [];
  const 时间 = String((行 as never)["更新时间"] || (行 as never)["创建时间"] || "");
  const 状态 = 属性.配置.卡片.徽标 ? 安全取值(属性.配置.卡片.徽标, 行) : "已更新";
  return [
    { 标题: `当前状态：${状态}`, 说明: "来自当前记录真实数据", 时间: 时间.slice(0, 10) },
    ...(时间
      ? [{ 标题: "记录已同步", 说明: "接口返回的更新时间", 时间: "" }]
      : []),
  ];
});

onMounted(() => void 加载());

async function 加载() {
  加载中.value = true;
  错误.value = "";
  try {
    const 结果 = await 查询阶段9全部(属性.配置.模块, {
      ...(属性.配置.最大页数 ? { 最大页数: 属性.配置.最大页数 } : {}),
    });
    列表.value = 结果.数据;
    总条数.value = 结果.总数;
    选中编号.value = 列表.value[0]?.id || "";
  } catch (异常) {
    错误.value = 异常 instanceof Error ? 异常.message : "数据加载失败。";
  } finally {
    加载中.value = false;
  }
}

function 卡片标签(行: 阶段9记录): 记录标签[] {
  try {
    return 属性.配置.卡片.标签?.(行) || [];
  } catch {
    return [];
  }
}

function 安全取值(取值: (行: 阶段9记录) => string, 行: 阶段9记录): string {
  try {
    return 取值(行) || "—";
  } catch {
    return "—";
  }
}
</script>

<template>
  <div class="vui war-artboard 通用模块页">
    <WarKpis :items="指标" />

    <WarLayout
      :list-title="配置.列表标题"
      :list-count="String(过滤后列表.length)"
      :search-placeholder="配置.搜索占位 || '搜索'"
      :tabs="标签列表"
      :active-tab="当前标签"
      v-model="搜索词"
      :动态="记录动态"
      @切换标签="当前标签 = $event"
    >
      <template #list>
        <div v-if="加载中" class="war-empty">正在加载数据…</div>
        <div v-else-if="错误" class="war-empty">{{ 错误 }}</div>
        <WarRecordCard
          v-for="行 in 过滤后列表"
          :key="行.id"
          :title="安全取值(配置.卡片.标题, 行)"
          :meta="安全取值(配置.卡片.说明, 行)"
          :badge="配置.卡片.徽标 ? 安全取值(配置.卡片.徽标, 行) : ''"
          :tone="配置.卡片.色调?.(行) || 'blue'"
          :owner="配置.卡片.归属 ? 安全取值(配置.卡片.归属, 行) : ''"
          :amount="配置.卡片.金额 ? 安全取值(配置.卡片.金额, 行) : ''"
          :tags="卡片标签(行)"
          :active="当前记录?.id === 行.id"
          @选择="选中编号 = 行.id"
        />
        <div v-if="!加载中 && !错误 && !过滤后列表.length" class="war-empty">
          当前条件下没有记录。
        </div>
      </template>

      <template #center>
        <template v-if="当前记录">
          <div class="war-center-head">
            <div class="deal-title">
              <strong>{{ 安全取值(配置.卡片.标题, 当前记录) }}</strong>
              <span>{{ 安全取值(配置.卡片.说明, 当前记录) }}</span>
            </div>
            <div v-if="配置.处理路径 || 配置.维护入口" class="center-actions">
              <button
                v-if="配置.维护入口"
                type="button"
                class="button small"
                @click="路由器.push(配置.维护入口!.路径)"
              >
                {{ 配置.维护入口.文案 }}
              </button>
              <button
                type="button"
                class="button primary small"
                v-if="配置.处理路径"
                @click="路由器.push(配置.处理路径!(当前记录))"
              >
                {{ 配置.处理文案 || "打开处理页" }}
              </button>
            </div>
          </div>

          <div class="extended-center-grid">
            <section class="panel">
              <header class="panel-head">
                <div><h2>记录详情</h2><p>字段来自当前接口真实数据</p></div>
              </header>
              <div class="panel-body">
                <div class="info-grid">
                  <div v-for="项 in 配置.详情" :key="项.标签" class="info-item">
                    <span>{{ 项.标签 }}</span>
                    <strong>{{ 安全取值(项.取值, 当前记录) }}</strong>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </template>
        <div v-else class="war-empty">请选择左侧记录查看详情。</div>
      </template>

      <template #right>
        <article v-if="当前记录" class="right-card highlight">
          <div class="right-card-title"><strong>实时快照</strong><span>{{ 配置.列表标题 }}</span></div>
          <div class="info-grid">
            <div v-for="项 in 配置.详情.slice(0, 4)" :key="项.标签" class="info-item">
              <span>{{ 项.标签 }}</span>
              <strong>{{ 安全取值(项.取值, 当前记录) }}</strong>
            </div>
          </div>
        </article>
        <article v-if="配置.说明" class="right-card">
          <div class="right-card-title"><strong>口径说明</strong><span>提示</span></div>
          <p class="war-note">{{ 配置.说明 }}</p>
        </article>
      </template>
    </WarLayout>
  </div>
</template>

<style scoped>
.通用模块页 {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 12px;
  min-height: calc(100vh - 96px);
  padding: 14px 18px 18px;
}

.通用模块页 :deep(.war-kpis) {
  position: static;
  inset: auto;
  height: auto;
}

.通用模块页 :deep(.war-layout) {
  position: static;
  inset: auto;
  min-height: 620px;
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
  background: #f8fbff;
}

.通用模块页 :deep(.war-list-body) {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.通用模块页 :deep(.war-search input) {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--text);
  font-size: 11px;
  outline: none;
}

.war-empty {
  display: grid;
  place-items: center;
  min-height: 100px;
  padding: 18px;
  color: var(--text-3);
  font-size: 11px;
}

.war-note {
  margin: 8px 0 0;
  color: var(--text-3);
  font-size: 11px;
  line-height: 1.6;
}
</style>
