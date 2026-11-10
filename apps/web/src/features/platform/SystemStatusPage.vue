<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import { 读取阶段9概览 } from "../../api/business-client.js";
import type { 指标项 } from "../../components/war/types.js";
import WarKpis from "../../components/war/WarKpis.vue";
import { 文本, 日期时间文本 } from "../../shared/format/business-format.js";
import { 依赖业务说明, 依赖中文名 } from "../../shared/format/dependency-status.js";

interface 依赖项 {
  name: string;
  status: string;
  message: string;
  latencyMs?: number;
}

interface 构建信息 {
  版本: string;
  提交: string;
  构建时间: string;
}

interface 健康数据 {
  status: string;
  service: string;
  checkedAt: string;
  dependencies: 依赖项[];
}

interface 健康结果 {
  data: 健康数据;
  build: 构建信息 | null;
  httpStatus: number;
}

const 路由器 = useRouter();
const 加载中 = ref(false);
const 错误 = ref("");
const 存活结果 = ref<健康结果 | null>(null);
const 就绪结果 = ref<健康结果 | null>(null);
const 依赖列表 = ref<依赖项[]>([]);
const 迁移状态 = ref<{ 批次编号: string; 正式落表: string; 校验结论: string } | null>(null);

function 依赖(name: string): 依赖项 | undefined {
  return 依赖列表.value.find((项) => 项.name === name);
}

function 状态中文(status: unknown): string {
  const 代码 = 文本(status).toLowerCase();
  if (代码 === "ok") return "正常";
  if (代码 === "degraded") return "降级";
  if (代码 === "failed") return "异常";
  if (代码 === "skipped") return "未启用";
  return "未知";
}

function 状态样式(status: unknown): string {
  const 代码 = 文本(status).toLowerCase();
  if (代码 === "ok") return "green";
  if (代码 === "degraded" || 代码 === "skipped") return "amber";
  return "red";
}

/** 迁移批次状态和校验结论只展示业务中文，不把后端枚举直接暴露给用户。 */
function 迁移字段中文(值: unknown): string {
  const 原文 = 文本(值).trim();
  if (!原文) return "—";
  const 中文映射: Record<string, string> = {
    validated: "已校验",
    completed: "已完成",
    applied: "已应用",
    formalized: "已正式落表",
    running: "执行中",
    pending: "待执行",
    skipped: "已跳过",
    failed: "失败",
    unknown: "状态未记录",
  };
  if (中文映射[原文.toLowerCase()]) return 中文映射[原文.toLowerCase()]!;
  return /[\u4e00-\u9fa5]/.test(原文) ? 原文 : "状态待确认";
}

const 构建 = computed(() => 存活结果.value?.build || 就绪结果.value?.build || null);

const 检查时间 = computed(() =>
  日期时间文本(文本(存活结果.value?.data.checkedAt, 就绪结果.value?.data.checkedAt)),
);

const 依赖正常数 = computed(() => 依赖列表.value.filter((项) => 项.status === "ok").length);

const 指标 = computed<指标项[]>(() => [
  {
    label: "服务存活",
    value: 状态中文(存活结果.value?.data.status),
    note: `最近检查 ${检查时间.value}`,
  },
  {
    label: "就绪状态",
    value: 状态中文(就绪结果.value?.data.status),
    note: 就绪结果.value ? "数据库、缓存与迁移已联合检查" : "未取得就绪检查结果",
  },
  {
    label: "数据库",
    value: 状态中文(依赖("postgres")?.status),
    note: 依赖("postgres")
      ? 依赖业务说明("postgres", 依赖("postgres")!.status)
      : "未取得数据库检查结果",
  },
  {
    label: "缓存服务",
    value: 状态中文(依赖("redis")?.status),
    note: 依赖("redis") ? 依赖业务说明("redis", 依赖("redis")!.status) : "未取得缓存检查结果",
  },
  {
    label: "数据服务",
    value: 状态中文(依赖("migration")?.status),
    note: 依赖("migration")
      ? 依赖业务说明("migration", 依赖("migration")!.status)
      : "未取得数据服务检查结果",
  },
  {
    label: "依赖项",
    value: `${依赖正常数.value}/${依赖列表.value.length}`,
    note: "通过数 / 已检查数",
  },
]);

onMounted(() => void 加载());

async function 读取健康接口(url: string): Promise<健康结果> {
  const 响应 = await fetch(url, { credentials: "include", cache: "no-store" });
  const 内容 = (await 响应.json()) as {
    success?: boolean;
    data?: 健康数据;
    meta?: { build?: 构建信息 };
  };
  if (!内容.data) throw new Error("服务状态响应内容不完整。");
  return {
    data: 内容.data,
    build: 内容.meta?.build || null,
    httpStatus: 响应.status,
  };
}

async function 加载(): Promise<void> {
  加载中.value = true;
  错误.value = "";
  try {
    const [存活, 就绪, 依赖, 概览] = await Promise.allSettled([
      读取健康接口("/health/live"),
      读取健康接口("/health/ready"),
      读取健康接口("/health/dependencies"),
      读取阶段9概览(),
    ]);
    存活结果.value = 存活.status === "fulfilled" ? 存活.value : null;
    就绪结果.value = 就绪.status === "fulfilled" ? 就绪.value : null;
    依赖列表.value =
      依赖.status === "fulfilled"
        ? 依赖.value.data.dependencies
        : 就绪.status === "fulfilled"
          ? 就绪.value.data.dependencies
          : [];
    迁移状态.value = 概览.status === "fulfilled" ? 概览.value.迁移状态 : null;
    if (!存活结果.value && !就绪结果.value && !依赖列表.value.length) {
      错误.value = "服务状态暂时无法读取，请稍后刷新重试。";
    }
  } finally {
    加载中.value = false;
  }
}
</script>

<template>
  <section class="vui war-artboard-plain 系统状态页">
    <div class="配置返回行">
      <button class="返回按钮" type="button" @click="路由器.push('/admin/organization')">
        ← 返回管理配置
      </button>
    </div>
    <header class="状态页头">
      <div>
        <span class="页面标签">管理配置</span>
        <h1>系统版本与服务状态</h1>
        <p>查看当前运行版本、服务存活、依赖组件和业务数据准备状态。</p>
      </div>
      <button class="刷新按钮" type="button" :disabled="加载中" @click="加载">
        {{ 加载中 ? "检查中…" : "重新检查" }}
      </button>
    </header>

    <WarKpis :items="指标" :加载中="加载中" />

    <p v-if="错误" class="状态错误">{{ 错误 }}</p>

    <div class="状态网格">
      <section class="panel">
        <header class="panel-head">
          <div>
            <h2>运行版本</h2>
            <p>来自当前服务构建信息。</p>
          </div>
        </header>
        <div class="panel-body">
          <div class="版本信息">
            <div>
              <span>当前版本</span><strong>{{ 文本(构建?.版本, "—") }}</strong>
            </div>
            <div>
              <span>构建时间</span><strong>{{ 日期时间文本(构建?.构建时间) }}</strong>
            </div>
            <div>
              <span>最近检查</span><strong>{{ 检查时间 }}</strong>
            </div>
          </div>
        </div>
      </section>

      <section class="panel">
        <header class="panel-head">
          <div>
            <h2>服务与依赖</h2>
            <p>配置、数据库、缓存、迁移与后台任务的检查结果。</p>
          </div>
        </header>
        <div class="panel-body flush">
          <table class="状态表">
            <thead>
              <tr>
                <th>检查项</th>
                <th>状态</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="项 in 依赖列表" :key="项.name">
                <td>{{ 依赖中文名(项.name) }}</td>
                <td>
                  <span class="status" :class="状态样式(项.status)">{{ 状态中文(项.status) }}</span>
                </td>
                <td>{{ 依赖业务说明(项.name, 项.status) }}</td>
              </tr>
              <tr v-if="!依赖列表.length">
                <td colspan="3" class="war-empty">暂未取得依赖检查结果。</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel 迁移面板">
        <header class="panel-head">
          <div>
            <h2>数据准备状态</h2>
            <p>展示业务数据是否已完成准备及最近检查结果。</p>
          </div>
        </header>
        <div class="panel-body">
          <div class="版本信息 迁移信息">
            <div>
              <span>数据准备</span
              ><strong>{{ 文本(迁移状态?.正式落表, "—") ? "已完成" : "暂无记录" }}</strong>
            </div>
            <div>
              <span>校验结论</span><strong>{{ 迁移字段中文(迁移状态?.校验结论) }}</strong>
            </div>
          </div>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.系统状态页 {
  display: grid;
  align-content: start;
  gap: 16px;
  min-height: 0;
  grid-template-rows: 30px auto auto auto;
  padding-top: 0 !important;
  background: transparent;
  color: #172b4d;
}

.配置返回行 {
  display: flex;
  align-items: flex-start;
  /* 与证书、消息等配置二级页统一：返回按钮内容起点为 x=53。 */
  padding: 0 25px;
}

.配置返回行 .返回按钮 {
  margin: 0;
  transform: translateY(-6px);
}

.状态页头 {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  padding: 22px 24px;
  border: 1px solid #dce7f3;
  border-radius: 12px;
  background: linear-gradient(120deg, #fff, #f3f8ff);
}

.页面标签 {
  display: block;
  color: #2f69ed;
  font-size: 11px;
  font-weight: 700;
}

.状态页头 h1 {
  margin: 6px 0 4px;
  font-size: 22px;
}

.状态页头 p {
  margin: 0;
  color: #60748c;
  font-size: 12px;
}

.刷新按钮 {
  min-height: 36px;
  padding: 0 16px;
  border: 0;
  border-radius: 8px;
  color: #fff;
  background: #2367d1;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.刷新按钮:disabled {
  opacity: 0.6;
  cursor: wait;
}

.状态网格 {
  display: grid;
  grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
  gap: 16px;
}

.状态网格 > .panel {
  min-width: 0;
  margin-top: 0;
}

.迁移面板 {
  grid-column: 1 / -1;
}

.版本信息 {
  display: grid;
  gap: 10px;
}

.版本信息 > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 9px 11px;
  border: 1px solid #e4edf6;
  border-radius: 8px;
  background: #f8fbff;
}

.版本信息 span {
  color: #6a7e94;
  font-size: 11px;
}

.版本信息 strong {
  overflow-wrap: anywhere;
  color: #1f3b5f;
  font-size: 12px;
  text-align: right;
}

.迁移信息 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.迁移信息 > div {
  align-items: flex-start;
  flex-direction: column;
  gap: 5px;
}

.迁移信息 strong {
  text-align: left;
}

.状态表 {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.状态表 th,
.状态表 td {
  padding: 9px 12px;
  border-bottom: 1px solid #e9f0f7;
  text-align: left;
}

.状态表 th {
  color: #6a7e94;
  font-weight: 700;
}

.状态表 tbody tr:last-child td {
  border-bottom: 0;
}

.状态错误 {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid #f2c8c8;
  border-radius: 8px;
  color: #b42323;
  background: #fff5f5;
  font-size: 12px;
}

.war-empty {
  padding: 20px;
  color: #7b8da2;
  text-align: center;
}
</style>
