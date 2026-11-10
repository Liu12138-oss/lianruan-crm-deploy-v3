<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import { 查询阶段9全部, type 阶段9记录 } from "../../api/business-client.js";
import type { 指标项 } from "../../components/war/types.js";
import WarKpis from "../../components/war/WarKpis.vue";
import { 文本, 文本或, 渠道等级文本 } from "../../shared/format/business-format.js";

interface 页面渠道身份 {
  id: string;
  name: string;
}

const 渠道列表 = ref<阶段9记录[]>([]);
const 加载中 = ref(true);
const 错误 = ref("");
const 页面身份 = 读取页面渠道身份();

function 原始(row: 阶段9记录 | null | undefined): Record<string, unknown> {
  return (row?.原始数据 as Record<string, unknown>) || {};
}

function 字段(row: 阶段9记录 | null | undefined, ...键列表: string[]): string {
  const 数据 = 原始(row);
  return 文本(...键列表.map((键) => 数据[键]), ...键列表.map((键) => (row as never)?.[键]));
}

function 文本数组(值: unknown): string[] {
  return Array.isArray(值) ? 值.map(文本).filter(Boolean) : [];
}

/** 当前页面会话中的渠道编号用于兼容旧接口未返回 isSelf 的情况。 */
function 读取页面渠道身份(): 页面渠道身份 {
  if (typeof window === "undefined") return { id: "", name: "" };
  try {
    const 原始用户 = window.localStorage.getItem("partner_user_info");
    const 用户 = 原始用户 ? (JSON.parse(原始用户) as Record<string, unknown>) : {};
    return {
      id: 文本(用户.partnerId),
      name: 文本(用户.partnerName),
    };
  } catch {
    return { id: "", name: "" };
  }
}

function 渠道编号(row: 阶段9记录): string {
  return 文本(字段(row, "id", "partnerId", "uuid"), row.编号, row.id);
}

function 渠道名称(row: 阶段9记录): string {
  return 文本或([字段(row, "name", "partnerName"), row.标题, row.渠道名称], "未命名渠道商");
}

function 渠道区域(row: 阶段9记录): string {
  return 文本或([字段(row, "region"), row.区域], "未填写区域");
}

function 渠道等级(row: 阶段9记录): string {
  return 渠道等级文本(字段(row, "partnerLevel", "level"));
}

function 编号集合(row: 阶段9记录): Set<string> {
  return new Set(
    [row.id, row.编号, 字段(row, "id"), 字段(row, "uuid"), 字段(row, "partnerId")]
      .map(文本)
      .filter(Boolean),
  );
}

function 命中关系(row: 阶段9记录, 关系编号: string[], 关系名称: string[]): boolean {
  if (关系名称.includes(渠道名称(row))) return true;
  const 当前编号 = 编号集合(row);
  return 关系编号.some((编号) => 当前编号.has(编号));
}

const 自身渠道 = computed(() => {
  const 接口标记 = 渠道列表.value.find((row) => 原始(row).isSelf === true);
  if (接口标记) return 接口标记;
  if (页面身份.id) {
    const 编号命中 = 渠道列表.value.find((row) => 编号集合(row).has(页面身份.id));
    if (编号命中) return 编号命中;
  }
  if (页面身份.name) {
    return 渠道列表.value.find((row) => 渠道名称(row) === 页面身份.name);
  }
  return undefined;
});

const 上级编号 = computed(() => 文本数组(原始(自身渠道.value).parentPartnerIds));
const 上级名称 = computed(() => 文本数组(原始(自身渠道.value).parentPartnerNames));
const 下级编号 = computed(() => 文本数组(原始(自身渠道.value).childPartnerIds));
const 下级名称 = computed(() => 文本数组(原始(自身渠道.value).childPartnerNames));

const 上级渠道 = computed(() =>
  渠道列表.value.filter(
    (row) => row !== 自身渠道.value && 命中关系(row, 上级编号.value, 上级名称.value),
  ),
);

const 下级渠道 = computed(() =>
  渠道列表.value.filter(
    (row) => row !== 自身渠道.value && 命中关系(row, 下级编号.value, 下级名称.value),
  ),
);

const 覆盖区域数 = computed(
  () =>
    new Set(
      [自身渠道.value, ...上级渠道.value, ...下级渠道.value]
        .filter((row): row is 阶段9记录 => Boolean(row))
        .map(渠道区域)
        .filter((区域) => 区域 !== "未填写区域"),
    ).size,
);

const 指标 = computed<指标项[]>(() => [
  {
    label: "当前渠道",
    value: 自身渠道.value ? "1" : "0",
    unit: "家",
    note: 自身渠道.value ? 渠道名称(自身渠道.value) : "未识别当前渠道",
  },
  {
    label: "所属一级渠道商",
    value: String(上级渠道.value.length),
    unit: "家",
    note: 上级渠道.value.length ? 上级渠道.value.map(渠道名称).join("、") : "暂无直属上级",
  },
  {
    label: "直属二级渠道商",
    value: String(下级渠道.value.length),
    unit: "家",
    note: 下级渠道.value.length ? 下级渠道.value.map(渠道名称).join("、") : "暂无直属下级",
  },
  {
    label: "关系覆盖区域",
    value: String(覆盖区域数.value),
    unit: "个",
    note: "仅统计当前渠道及直属上下级",
  },
]);

async function 加载渠道关系() {
  加载中.value = true;
  错误.value = "";
  try {
    const 结果 = await 查询阶段9全部("partners");
    渠道列表.value = 结果.数据;
    if (!自身渠道.value) {
      错误.value = "当前账号未匹配到所属渠道，请联系渠道管理员核对账号绑定关系。";
    }
  } catch (异常) {
    错误.value = 异常 instanceof Error ? 异常.message : "读取渠道关系失败，请稍后重试。";
  } finally {
    加载中.value = false;
  }
}

onMounted(加载渠道关系);
</script>

<template>
  <div class="vui war-artboard-plain 渠道关系页">
    <WarKpis :items="指标" :加载中="加载中" />

    <section class="关系提示">
      <strong>渠道关系只读视图</strong>
      <span
        >仅展示当前渠道及直属一级、直属二级渠道的基础信息；经营摘要、成员和档案维护不对上下级开放。</span
      >
    </section>

    <div v-if="加载中" class="关系状态">正在读取渠道关系…</div>
    <div v-else-if="错误" class="关系状态 关系错误">{{ 错误 }}</div>
    <div v-else-if="自身渠道" class="关系内容">
      <section class="当前渠道卡">
        <header class="当前渠道头">
          <div>
            <span class="区域标记">当前渠道</span>
            <h1>{{ 渠道名称(自身渠道) }}</h1>
          </div>
          <span class="只读标记">只读关系</span>
        </header>

        <div class="当前渠道信息">
          <div class="渠道字段">
            <span>渠道编号</span>
            <strong>{{ 渠道编号(自身渠道) }}</strong>
          </div>
          <div class="渠道字段">
            <span>渠道层级</span>
            <strong>{{ 渠道等级(自身渠道) }}</strong>
          </div>
          <div class="渠道字段">
            <span>所属区域</span>
            <strong>{{ 渠道区域(自身渠道) }}</strong>
          </div>
        </div>

        <div class="当前关系摘要">
          <div>
            <span>所属一级渠道商</span>
            <strong>{{ 上级渠道.length ? 上级渠道.map(渠道名称).join("、") : "无" }}</strong>
          </div>
          <div>
            <span>直属二级渠道商</span>
            <strong>{{ 下级渠道.length ? 下级渠道.map(渠道名称).join("、") : "无" }}</strong>
          </div>
        </div>
      </section>

      <section class="关系网格">
        <article class="关系面板">
          <header class="关系面板头">
            <div>
              <h2>所属一级渠道商</h2>
              <p>二级渠道可在此确认自己的直属一级渠道。</p>
            </div>
            <span>{{ 上级渠道.length }} 家</span>
          </header>
          <div class="关系卡片列表">
            <article v-for="row in 上级渠道" :key="`上级-${row.id}`" class="关系卡片">
              <div class="关系卡片头">
                <strong>{{ 渠道名称(row) }}</strong>
                <span>{{ 渠道等级(row) }}</span>
              </div>
              <div class="关系卡片元">
                <span>区域：{{ 渠道区域(row) }}</span>
                <span>编号：{{ 渠道编号(row) }}</span>
              </div>
            </article>
            <div v-if="!上级渠道.length" class="关系空态">
              当前渠道暂无直属一级渠道，或当前渠道本身为一级渠道。
            </div>
          </div>
        </article>

        <article class="关系面板">
          <header class="关系面板头">
            <div>
              <h2>直属二级渠道商</h2>
              <p>一级渠道可在此查看直接归属自己的二级渠道。</p>
            </div>
            <span>{{ 下级渠道.length }} 家</span>
          </header>
          <div class="关系卡片列表">
            <article v-for="row in 下级渠道" :key="`下级-${row.id}`" class="关系卡片">
              <div class="关系卡片头">
                <strong>{{ 渠道名称(row) }}</strong>
                <span>{{ 渠道等级(row) }}</span>
              </div>
              <div class="关系卡片元">
                <span>区域：{{ 渠道区域(row) }}</span>
                <span>编号：{{ 渠道编号(row) }}</span>
              </div>
            </article>
            <div v-if="!下级渠道.length" class="关系空态">当前渠道暂无直属二级渠道。</div>
          </div>
        </article>
      </section>
    </div>
  </div>
</template>

<style scoped>
.渠道关系页 {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.渠道关系页 :deep(.war-kpis) {
  flex: 0 0 96px;
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
}

.关系提示 {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 42px;
  padding: 9px 14px;
  border: 1px solid #cfe1fa;
  border-radius: 10px;
  background: linear-gradient(135deg, #edf5ff, #ffffff);
  color: var(--text-2);
  font-size: 11px;
}

.关系提示 strong {
  flex: 0 0 auto;
  color: var(--blue-strong);
  font-size: 12px;
}

.关系状态 {
  display: grid;
  place-items: center;
  min-height: 360px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #f8fbff;
  color: var(--text-3);
  font-size: 12px;
}

.关系错误 {
  color: #b53d49;
}

.关系内容 {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.当前渠道卡,
.关系面板 {
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 8px 22px rgba(47, 105, 237, 0.06);
}

.当前渠道卡 {
  padding: 16px 18px;
  background: linear-gradient(145deg, #edf5ff, #ffffff 62%);
}

.当前渠道头,
.关系面板头,
.关系卡片头,
.关系卡片元,
.当前关系摘要 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.当前渠道头 h1,
.关系面板头 h2 {
  margin: 5px 0 0;
  color: var(--text);
}

.当前渠道头 h1 {
  font-size: 17px;
  font-weight: 700;
}

.区域标记 {
  color: var(--blue-strong);
  font-size: 10px;
  font-weight: 700;
}

.只读标记 {
  padding: 5px 9px;
  border: 1px solid #cfe1fa;
  border-radius: 999px;
  background: #ffffff;
  color: var(--blue-strong);
  font-size: 10px;
  font-weight: 700;
}

.当前渠道信息 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.渠道字段 {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid #dce8f6;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.76);
}

.渠道字段 span,
.当前关系摘要 span,
.关系面板头 p,
.关系卡片元,
.关系空态 {
  color: var(--text-3);
  font-size: 10px;
}

.渠道字段 strong {
  overflow: hidden;
  color: var(--text);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.当前关系摘要 {
  align-items: stretch;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--line-soft);
}

.当前关系摘要 > div {
  display: grid;
  flex: 1 1 0;
  gap: 3px;
  min-width: 0;
}

.当前关系摘要 strong {
  overflow: hidden;
  color: var(--text-2);
  font-size: 11px;
  line-height: 1.6;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.关系网格 {
  display: grid;
  flex: 1 1 auto;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  min-height: 280px;
}

.关系面板 {
  display: flex;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}

.关系面板头 {
  min-height: 64px;
  padding: 12px 15px;
  border-bottom: 1px solid var(--line-soft);
  background: #f8fbff;
}

.关系面板头 h2 {
  font-size: 13px;
}

.关系面板头 p {
  margin: 4px 0 0;
}

.关系面板头 > span {
  flex: 0 0 auto;
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--blue-soft);
  color: var(--blue-strong);
  font-size: 10px;
  font-weight: 700;
}

.关系卡片列表 {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  padding: 10px;
  overflow-y: auto;
}

.关系卡片 {
  padding: 11px 12px;
  border: 1px solid #dce8f6;
  border-radius: 9px;
  background: #fbfdff;
}

.关系卡片头 strong {
  overflow: hidden;
  color: var(--text);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.关系卡片头 span {
  flex: 0 0 auto;
  padding: 3px 7px;
  border-radius: 999px;
  background: #edf3fa;
  color: var(--text-2);
  font-size: 9px;
  font-weight: 700;
}

.关系卡片元 {
  justify-content: flex-start;
  flex-wrap: wrap;
  margin-top: 7px;
}

.关系空态 {
  display: grid;
  flex: 1 1 auto;
  place-items: center;
  min-height: 140px;
  padding: 18px;
  border: 1px dashed #d5e2f0;
  border-radius: 9px;
  background: #fbfdff;
  text-align: center;
}

@media (max-width: 980px) {
  .关系网格,
  .当前渠道信息 {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
