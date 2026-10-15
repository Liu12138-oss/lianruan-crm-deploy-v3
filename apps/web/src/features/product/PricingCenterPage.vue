<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import { 查询阶段9全部, type 阶段9记录 } from "../../api/business-client.js";
import WarKpis from "../../components/war/WarKpis.vue";
import WarLayout from "../../components/war/WarLayout.vue";
import WarRecordCard from "../../components/war/WarRecordCard.vue";
import type { 指标项 } from "../../components/war/types.js";
import { 金额文本, 文本, 文本或 } from "../../shared/format/business-format.js";
import { 查询产品模块, type 产品模块 } from "./product-catalog-client.js";

const 加载中 = ref(false);
const 错误 = ref("");
const 产品列表 = ref<阶段9记录[]>([]);
const 模块列表 = ref<产品模块[]>([]);
const 选中编号 = ref("");
const 当前标签 = ref("全部");
const 搜索词 = ref("");

const 标签列表 = ["全部", "阶梯计价", "固定价", "区域覆盖"];

function 原始(row: 阶段9记录 | null | undefined): Record<string, unknown> {
  return (row?.原始数据 as Record<string, unknown>) || {};
}

function 字段(row: 阶段9记录 | null | undefined, ...键列表: string[]): string {
  const 数据 = 原始(row);
  return 文本(...键列表.map((键) => 数据[键]), ...键列表.map((键) => (row as never)?.[键]));
}

function 阶梯(row: 阶段9记录 | null | undefined): Array<Record<string, unknown>> {
  const 项 = 原始(row).tiers;
  return Array.isArray(项) ? (项 as Array<Record<string, unknown>>) : [];
}

function 区域覆盖(row: 阶段9记录 | null | undefined): Array<Record<string, unknown>> {
  const 项 = 原始(row).regionPriceOverrides;
  return Array.isArray(项) ? (项 as Array<Record<string, unknown>>) : [];
}

function 渠道价(row: 阶段9记录 | null | undefined, 层级: "primary" | "secondary"): Array<Record<string, unknown>> {
  const 键 = 层级 === "primary" ? "priceForPrimary" : "priceForSecondary";
  const 项 = 原始(row)[键];
  return Array.isArray(项) ? (项 as Array<Record<string, unknown>>) : [];
}

function 有非零渠道价(行列表: 阶段9记录[], 层级: "primary" | "secondary"): number {
  return 行列表.filter((行) =>
    渠道价(行, 层级).some((档) => Number(档.price ?? 0) > 0),
  ).length;
}

/** 模块名称展示：把后端模块编号翻译成目录里的中文模块名，取不到时不展示。 */
function 模块名称(row: 阶段9记录 | null | undefined): string {
  const 编号 = 字段(row, "moduleId");
  if (!编号) return "";
  return 模块列表.value.find((项) => 项.id === 编号)?.name || "";
}

function 渠道价文本(档: Record<string, unknown>): string {
  const 价格 = Number(档.price ?? 0);
  if (!Number.isFinite(价格) || 价格 <= 0) return "未设置";
  return 金额文本(价格);
}

function 价格类型(row: 阶段9记录 | null | undefined): string {
  const 类型 = 文本(字段(row, "priceType"));
  if (类型 === "tiered") return "阶梯计价";
  if (类型 === "fixed") return "固定价";
  return 类型 || "未设置";
}

const 过滤后列表 = computed(() => {
  let 列表 = 产品列表.value;
  if (当前标签.value === "阶梯计价") 列表 = 列表.filter((row) => 阶梯(row).length > 0);
  if (当前标签.value === "固定价") 列表 = 列表.filter((row) => 价格类型(row) === "固定价");
  if (当前标签.value === "区域覆盖") 列表 = 列表.filter((row) => 区域覆盖(row).length > 0);
  const 关键词 = 搜索词.value.trim().toLowerCase();
  if (!关键词) return 列表;
  return 列表.filter((row) =>
    [row.标题, 字段(row, "name"), 字段(row, "productCode"), 价格类型(row)]
      .filter(Boolean)
      .some((值) => String(值).toLowerCase().includes(关键词)),
  );
});

const 当前产品 = computed(
  () => 产品列表.value.find((row) => row.id === 选中编号.value) || 过滤后列表.value[0] || null,
);

const 指标 = computed<指标项[]>(() => {
  const 列表 = 产品列表.value;
  const 阶梯列表 = 列表.filter((row) => 阶梯(row).length > 0);
  const 固定价 = 列表.filter((row) => 价格类型(row) === "固定价").length;
  const 区域数 = 列表.filter((row) => 区域覆盖(row).length > 0).length;
  const 阶梯档位合计 = 阶梯列表.reduce((合计, row) => 合计 + 阶梯(row).length, 0);
  const 平均档位 = 阶梯列表.length ? (阶梯档位合计 / 阶梯列表.length).toFixed(1) : "—";
  const 一级渠道价 = 列表.filter((row) => 渠道价(row, "primary").length > 0).length;
  const 二级渠道价 = 列表.filter((row) => 渠道价(row, "secondary").length > 0).length;
  return [
    { label: "软件模块", value: String(列表.length), unit: "项", note: "已发布产品目录" },
    { label: "阶梯计价", value: String(阶梯列表.length), unit: "项", note: "按端点数量匹配" },
    { label: "固定价", value: String(固定价), unit: "项", note: "按固定单价计价" },
    { label: "区域覆盖", value: String(区域数), unit: "项", note: "存在区域差异化定价" },
    {
      label: "一级渠道比例",
      value: `${一级渠道价} / ${有非零渠道价(列表, "primary")}`,
      unit: "项",
      note: "配置数 / 非零价数",
    },
    {
      label: "二级渠道比例",
      value: `${二级渠道价} / ${有非零渠道价(列表, "secondary")}`,
      unit: "项",
      note: `阶梯档位合计 ${阶梯档位合计} 档，平均 ${平均档位} 档`,
    },
  ];
});

onMounted(() => void 加载());

async function 加载() {
  加载中.value = true;
  错误.value = "";
  try {
    const [结果, 模块结果] = await Promise.all([
      查询阶段9全部("products"),
      查询产品模块().catch(() => [] as 产品模块[]),
    ]);
    产品列表.value = 结果.数据;
    模块列表.value = 模块结果;
    选中编号.value = 产品列表.value[0]?.id || "";
  } catch (异常) {
    错误.value = 异常 instanceof Error ? 异常.message : "价格规则加载失败。";
  } finally {
    加载中.value = false;
  }
}
</script>

<template>
  <div class="vui war-artboard 价格规则页">
    <WarKpis :items="指标" />

    <WarLayout
      list-title="模块价格规则"
      :list-count="String(过滤后列表.length)"
      search-placeholder="搜索产品名称、编码或价格类型"
      :tabs="标签列表"
      :active-tab="当前标签"
      v-model="搜索词"
      :步骤="['基础阶梯价', '区域覆盖', '渠道价格', '报价命中']"
      :当前步骤="3"
      @切换标签="当前标签 = $event"
    >
      <template #list>
        <div v-if="加载中" class="war-empty">正在加载价格规则…</div>
        <div v-else-if="错误" class="war-empty">{{ 错误 }}</div>
        <WarRecordCard
          v-for="row in 过滤后列表"
          :key="row.id"
          :title="文本或([字段(row, 'name'), row.标题], '未命名产品')"
          :meta="[
            文本(字段(row, 'productCode'), '无编码'),
            价格类型(row),
            `阶梯 ${阶梯(row).length} 档`,
          ].join(' · ')"
          :badge="价格类型(row)"
          :tone="价格类型(row) === '阶梯计价' ? 'blue' : 'green'"
          :owner="`区域覆盖 ${区域覆盖(row).length} 个`"
          :amount="
            阶梯(row).length ? 金额文本(阶梯(row)[0]?.price) + ' 起' : 金额文本(字段(row, 'priceFixed'))
          "
          :tags="[
            ...(模块名称(row) ? [{ text: `模块 ${模块名称(row)}` }] : []),
            { text: 原始(row).published === false ? '未发布' : '已发布', hot: 原始(row).published !== false },
          ]"
          :active="当前产品?.id === row.id"
          @选择="选中编号 = row.id"
        />
        <div v-if="!加载中 && !错误 && !过滤后列表.length" class="war-empty">
          当前条件下没有价格规则。
        </div>
      </template>

      <template #center>
        <template v-if="当前产品">
          <div class="war-center-head">
            <div class="deal-title">
              <strong>{{ 文本或([字段(当前产品, "name"), 当前产品.标题], "未命名产品") }}</strong>
              <span>
                {{ 文本(字段(当前产品, "productCode"), "无编码") }} · {{ 价格类型(当前产品) }}
                <template v-if="模块名称(当前产品)"> · 模块 {{ 模块名称(当前产品) }}</template>
              </span>
            </div>
          </div>

          <div class="extended-center-grid">
            <section class="panel">
              <header class="panel-head">
                <div><h2>基础阶梯价</h2><p>按端点数量匹配的单价档位</p></div>
              </header>
              <div class="panel-body flush">
                <table class="vui-table">
                  <thead><tr><th>区间</th><th>单价</th></tr></thead>
                  <tbody>
                    <tr v-for="(档, 序号) in 阶梯(当前产品)" :key="序号">
                      <td>{{ 文本(档.min) }} - {{ 文本(档.max) }} 点</td>
                      <td>{{ 金额文本(档.price) }}</td>
                    </tr>
                    <tr v-if="!阶梯(当前产品).length">
                      <td colspan="2" class="war-empty">该产品未维护阶梯价。</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section class="panel">
              <header class="panel-head">
                <div><h2>区域价格覆盖</h2><p>区域优先于全国默认价</p></div>
              </header>
              <div class="panel-body flush">
                <table class="vui-table">
                  <thead><tr><th>区域</th><th>覆盖价格</th></tr></thead>
                  <tbody>
                    <tr v-for="(覆盖, 序号) in 区域覆盖(当前产品)" :key="序号">
                      <td>{{ 文本(覆盖.region, 覆盖.regionName, "未命名区域") }}</td>
                      <td>{{ 金额文本(覆盖.price ?? 覆盖.priceFixed) }}</td>
                    </tr>
                    <tr v-if="!区域覆盖(当前产品).length">
                      <td colspan="2" class="war-empty">该产品未设置区域价格覆盖。</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section class="panel">
              <header class="panel-head">
                <div><h2>渠道价格（一级 / 二级）</h2><p>按渠道层级覆盖的阶梯价</p></div>
              </header>
              <div class="panel-body flush">
                <table class="vui-table">
                  <thead><tr><th>渠道层级</th><th>区间</th><th>价格</th></tr></thead>
                  <tbody>
                    <template v-for="(档, 序号) in 渠道价(当前产品, 'primary')" :key="`p-${序号}`">
                      <tr>
                        <td>一级渠道</td>
                        <td>{{ 文本(档.min) }} - {{ 文本(档.max) }} 点</td>
                        <td>{{ 渠道价文本(档) }}</td>
                      </tr>
                    </template>
                    <template v-for="(档, 序号) in 渠道价(当前产品, 'secondary')" :key="`s-${序号}`">
                      <tr>
                        <td>二级渠道</td>
                        <td>{{ 文本(档.min) }} - {{ 文本(档.max) }} 点</td>
                        <td>{{ 渠道价文本(档) }}</td>
                      </tr>
                    </template>
                    <tr
                      v-if="
                        !渠道价(当前产品, 'primary').length && !渠道价(当前产品, 'secondary').length
                      "
                    >
                      <td colspan="3" class="war-empty">该产品未设置渠道层级价格。</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </template>
        <div v-else class="war-empty">请选择左侧产品查看价格规则。</div>
      </template>

      <template #right>
        <article v-if="当前产品" class="right-card highlight">
          <div class="right-card-title"><strong>实时快照</strong><span>价格规则</span></div>
          <div class="info-grid">
            <div class="info-item"><span>价格类型</span><strong>{{ 价格类型(当前产品) }}</strong></div>
            <div class="info-item"><span>阶梯档位</span><strong>{{ 阶梯(当前产品).length }} 档</strong></div>
            <div class="info-item"><span>区域覆盖</span><strong>{{ 区域覆盖(当前产品).length }} 个</strong></div>
            <div class="info-item">
              <span>渠道价格</span>
              <strong>
                一级 {{ 渠道价(当前产品, "primary").length }} 档 / 二级
                {{ 渠道价(当前产品, "secondary").length }} 档
              </strong>
            </div>
            <div class="info-item">
              <span>发布状态</span>
              <strong>{{ 原始(当前产品).published === false ? "未发布" : "已发布" }}</strong>
            </div>
          </div>
        </article>
        <article class="right-card">
          <div class="right-card-title"><strong>价格命中顺序</strong><span>口径</span></div>
          <p class="war-note">
            报价时先匹配区域价格覆盖，再匹配全国基础阶梯价，最后按渠道层级（一级 / 二级）应用渠道价格；渠道价格缺失时回退到基础阶梯价。
          </p>
        </article>
      </template>
    </WarLayout>
  </div>
</template>

<style scoped>
.价格规则页 {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 12px;
  min-height: calc(100vh - 96px);
  padding: 14px 18px 18px;
}

.价格规则页 :deep(.war-kpis) {
  position: static;
  inset: auto;
  height: auto;
}

.价格规则页 :deep(.war-layout) {
  position: static;
  inset: auto;
  min-height: 620px;
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
  background: #f8fbff;
}

.价格规则页 :deep(.war-list-body) {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.价格规则页 :deep(.war-search input) {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--text);
  font-size: 11px;
  outline: none;
}

.vui-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.vui-table th,
.vui-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--line-soft);
  text-align: left;
}

.vui-table th {
  color: var(--text-3);
  font-weight: 700;
}

.war-empty {
  display: grid;
  place-items: center;
  min-height: 80px;
  padding: 16px;
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
