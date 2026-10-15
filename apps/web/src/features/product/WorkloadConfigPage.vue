<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import {
  查询阶段9全部,
  查询工作量映射,
  保存工作量映射,
  保存交付工作量规则,
  type 阶段9记录,
  type 工作量映射项,
} from "../../api/business-client.js";
import WarKpis from "../../components/war/WarKpis.vue";
import type { 指标项 } from "../../components/war/types.js";
import { 文本, 文本或 } from "../../shared/format/business-format.js";

const 路由器 = useRouter();
const 加载中 = ref(false);
const 错误 = ref("");
const 映射列表 = ref<工作量映射项[]>([]);
const 规则列表 = ref<规则行[]>([]);
const 映射搜索词 = ref("");
const 规则类型筛选 = ref<"全部" | "交付工作量" | "实施工作量">("全部");
const 类型筛选 = ref<"全部" | "feature" | "hardware">("全部");
const 编辑编号 = ref("");
const 编辑标签 = ref("");
const 保存中 = ref(false);
const 提示 = ref("");
const 提示失败 = ref(false);
const 规则弹窗打开 = ref(false);
const 规则保存中 = ref(false);
const 编辑规则 = ref<规则行 | null>(null);
const 规则表单 = ref({
  最小点数: 0,
  最大点数: null as number | null,
  人天: 0,
  组合人天: null as number | null,
  备注: "",
  启用: true,
});

interface 规则行 {
  id: string;
  名称: string;
  类型: "交付工作量" | "实施工作量";
  归属: string;
  条件: string;
  人天: number;
  备注: string;
  启用: boolean;
  /** 交付规则专属字段，用于打开编辑弹窗；实施规则保持只读。 */
  最小点数: number | null;
  最大点数: number | null;
  组合人天: number | null;
}

const 交付标签选项 = [
  { value: "", label: "不参与交付工作量" },
  { value: "EPP_BASE", label: "EPP（仅DLP基础）" },
  { value: "SENSITIVE_DATA", label: "敏感数据梳理" },
  { value: "UNIDES", label: "UniDES" },
  { value: "UNIAV", label: "UniAV" },
  { value: "NXG_NO_DLP", label: "NXG（不含DLP）" },
  { value: "NXG_WITH_DLP", label: "NXG（含DLP）" },
];

function 标签名称(value: string): string {
  return 交付标签选项.find((项) => 项.value === value)?.label || value || "未映射";
}

function 产品类型(项: 工作量映射项): string {
  return 项.itemType === "hardware" ? "硬件产品" : "软件产品";
}

function 标签取值(项: 工作量映射项): string {
  return Array.isArray(项.deliveryTags) && 项.deliveryTags.length ? 项.deliveryTags[0] || "" : "";
}

const 过滤后映射 = computed(() => {
  const 关键词 = 映射搜索词.value.trim().toLowerCase();
  return 映射列表.value.filter((项) => {
    if (类型筛选.value !== "全部" && 项.itemType !== 类型筛选.value) return false;
    if (!关键词) return true;
    return [项.featureName, 项.productCode, 项.moduleName, 项.categoryName]
      .filter(Boolean)
      .some((字段) => String(字段).toLowerCase().includes(关键词));
  });
});

const 硬件条数 = computed(() => 映射列表.value.filter((项) => 项.itemType === "hardware").length);
const 已配标签条数 = computed(
  () => 映射列表.value.filter((项) => 标签取值(项) !== "").length,
);
const 交付规则条数 = computed(
  () => 规则列表.value.filter((项) => 项.类型 === "交付工作量").length,
);
const 过滤后规则 = computed(() =>
  规则类型筛选.value === "全部"
    ? 规则列表.value
    : 规则列表.value.filter((项) => 项.类型 === 规则类型筛选.value),
);
const 规则标签数 = computed(
  () => new Set(规则列表.value.filter((项) => 项.类型 === "交付工作量").map((项) => 项.归属)).size,
);
const 平均人天 = computed(() => {
  const 数值 = 规则列表.value.map((项) => 项.人天).filter((值) => Number.isFinite(值) && 值 > 0);
  if (!数值.length) return "—";
  return (数值.reduce((合计, 值) => 合计 + 值, 0) / 数值.length).toFixed(1);
});

const 指标 = computed<指标项[]>(() => [
  {
    label: "产品工作量映射",
    value: String(映射列表.value.length),
    unit: "条",
    note: `硬件 ${硬件条数.value} 条 / 软件 ${映射列表.value.length - 硬件条数.value} 条`,
  },
  {
    label: "已配交付标签",
    value: String(已配标签条数.value),
    unit: "条",
    note: "报价试算按此标签命中交付规则",
  },
  {
    label: "工作量规则",
    value: String(规则列表.value.length),
    unit: "条",
    note: `交付 ${交付规则条数.value} 条 / 实施 ${规则列表.value.length - 交付规则条数.value} 条`,
  },
  {
    label: "启用规则",
    value: String(规则列表.value.filter((项) => 项.启用).length),
    unit: "条",
    note: `交付标签覆盖 ${规则标签数.value} 个`,
  },
  {
    label: "交付标签",
    value: String(交付标签选项.length - 1),
    unit: "个",
    note: "V2 交付标签全集（不含“不参与”）",
  },
  { label: "平均人天", value: 平均人天.value, unit: "人天", note: "按全部规则人天求平均" },
]);

onMounted(() => void 加载());

async function 加载() {
  加载中.value = true;
  错误.value = "";
  try {
    const [映射结果, 规则结果] = await Promise.all([
      查询工作量映射(),
      查询阶段9全部("workload"),
    ]);
    映射列表.value = 映射结果;
    规则列表.value = 规则结果.数据.map(转规则行);
  } catch (异常) {
    错误.value = 异常 instanceof Error ? 异常.message : "工作量配置加载失败。";
  } finally {
    加载中.value = false;
  }
}

function 取可空数字(值: unknown): number | null {
  if (值 === null || 值 === undefined || 值 === "") return null;
  const 结果 = Number(值);
  return Number.isFinite(结果) ? 结果 : null;
}

function 转规则行(记录: 阶段9记录): 规则行 {
  const 数据 = (记录.原始数据 as Record<string, unknown>) || {};
  const 是交付规则 = Boolean(数据.ruleType);
  const 最小值 = 数据.minQuantity ?? 数据.minPoints;
  const 最大值 = 数据.maxQuantity ?? 数据.maxPoints;
  const 人天 = Number(数据.personDays ?? 数据.workloadDays ?? 0);
  return {
    id: 记录.id,
    名称: 文本(数据.item, 数据.ruleName, 记录.标题, "未命名规则"),
    类型: 是交付规则 ? "交付工作量" : "实施工作量",
    归属: 文本(
      是交付规则 ? 数据.deliveryTag : 数据.classificationName,
      数据.productTypeLabel,
      "通用",
    ),
    条件:
      !文本(数据.condition) &&
      Number.isFinite(Number(最小值)) &&
      Number.isFinite(Number(最大值))
        ? `${最小值}-${最大值} 点`
        : 文本或([数据.condition], "—"),
    人天: Number.isFinite(人天) ? 人天 : 0,
    备注: 文本(数据.remark, "无备注"),
    启用: 数据.active === undefined ? 记录.状态 !== "disabled" : 数据.active !== false,
    最小点数: 取可空数字(最小值),
    最大点数: 取可空数字(最大值),
    组合人天: 取可空数字(数据.comboPersonDays),
  };
}

/** 打开交付工作量规则编辑弹窗；实施规则来自历史规则库，与老 UI 一致保持只读。 */
function 开始编辑规则(项: 规则行) {
  if (项.类型 !== "交付工作量") return;
  编辑规则.value = 项;
  规则表单.value = {
    最小点数: 项.最小点数 ?? 0,
    最大点数: 项.最大点数,
    人天: 项.人天,
    组合人天: 项.组合人天,
    备注: 项.备注 === "无备注" ? "" : 项.备注,
    启用: 项.启用,
  };
  提示.value = "";
  规则弹窗打开.value = true;
}

function 取消编辑规则() {
  规则弹窗打开.value = false;
  编辑规则.value = null;
}

async function 保存规则() {
  const 行 = 编辑规则.value;
  if (!行) return;
  const 表单 = 规则表单.value;
  // 数字输入框清空时 v-model 会留下空串，统一按「留空」口径归一化后再提交。
  const 最小点数 = 取可空数字(表单.最小点数) ?? 0;
  const 最大点数 = 取可空数字(表单.最大点数);
  const 人天 = 取可空数字(表单.人天);
  const 组合人天 = 取可空数字(表单.组合人天);
  if (人天 === null || 人天 < 0) {
    提示失败.value = true;
    提示.value = "人天必须是不小于 0 的数字。";
    return;
  }
  if (最大点数 !== null && 最大点数 < 最小点数) {
    提示失败.value = true;
    提示.value = "最大点数不能小于最小点数。";
    return;
  }
  规则保存中.value = true;
  try {
    await 保存交付工作量规则(行.id, {
      minPoints: 最小点数,
      maxPoints: 最大点数,
      personDays: 人天,
      comboPersonDays: 组合人天,
      remark: 表单.备注.trim(),
      active: 表单.启用,
    });
    提示失败.value = false;
    提示.value = `已保存交付规则「${行.名称} · ${行.条件}」：${人天} 人天。`;
    规则弹窗打开.value = false;
    编辑规则.value = null;
    await 加载();
  } catch (异常) {
    提示失败.value = true;
    提示.value = 异常 instanceof Error ? 异常.message : "规则保存失败。";
  } finally {
    规则保存中.value = false;
  }
}

function 开始编辑(项: 工作量映射项) {
  编辑编号.value = 项.featureId;
  编辑标签.value = 标签取值(项);
  提示.value = "";
}

function 取消编辑() {
  编辑编号.value = "";
  编辑标签.value = "";
}

async function 保存(项: 工作量映射项) {
  保存中.value = true;
  提示.value = "";
  try {
    await 保存工作量映射(项.featureId, {
      deliveryTags: 编辑标签.value ? [编辑标签.value] : [],
      active: true,
    });
    提示失败.value = false;
    提示.value = `已保存「${项.featureName}」的交付标签：${编辑标签.value ? 标签名称(编辑标签.value) : "不参与交付工作量"}。`;
    编辑编号.value = "";
    await 加载();
  } catch (异常) {
    提示失败.value = true;
    提示.value = 异常 instanceof Error ? 异常.message : "保存失败。";
  } finally {
    保存中.value = false;
  }
}
</script>

<template>
  <section class="vui 工作量配置页">
    <header class="工作量页头">
      <div>
        <button class="返回按钮" type="button" @click="路由器.push('/admin/products')">
          ← 返回产品与套餐
        </button>
        <span class="页面标签">产品与配置</span>
        <h1>工作量配置</h1>
        <p>维护软硬件产品的交付标签与实施工作量规则，报价试算按此命中人天。</p>
      </div>
      <div class="页头提示">交付标签与工作量规则直接影响报价试算的人天与成本，修改后立即生效。</div>
    </header>

    <WarKpis :items="指标" />

    <div class="grid-2 工作量网格">
      <section class="panel">
        <header class="panel-head">
          <div>
            <h2>产品工作量映射</h2>
            <p>软硬件产品的交付标签，报价试算按此命中交付工作量规则。</p>
          </div>
          <div class="field search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input v-model="映射搜索词" placeholder="搜索产品、型号或模块" />
          </div>
        </header>
        <div class="panel-body flush">
          <div class="toolbar">
            <div class="filters">
              <div class="field">
                <select v-model="类型筛选">
                  <option value="全部">全部类型</option>
                  <option value="feature">软件产品</option>
                  <option value="hardware">硬件产品</option>
                </select>
              </div>
            </div>
            <span class="工作量计数">共 {{ 过滤后映射.length }} 条</span>
          </div>
          <div v-if="加载中" class="war-empty">正在加载工作量配置…</div>
          <div v-else-if="错误" class="war-empty">{{ 错误 }}</div>
          <div v-else class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>产品名称</th>
                  <th>类型</th>
                  <th>产品编码 / 型号</th>
                  <th>交付标签</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="项 in 过滤后映射" :key="项.featureId">
                  <td>
                    <span class="record-title">{{ 项.featureName }}</span>
                    <small class="工作量次要">{{ 项.moduleName || 项.categoryName || "—" }}</small>
                  </td>
                  <td>
                    <span class="tag" :class="项.itemType === 'hardware' ? 'tag-blue' : 'tag-gray'">
                      {{ 产品类型(项) }}
                    </span>
                  </td>
                  <td>{{ 项.productCode || "—" }}</td>
                  <td>
                    <template v-if="编辑编号 === 项.featureId">
                      <select v-model="编辑标签" class="工作量选择">
                        <option v-for="标签 in 交付标签选项" :key="标签.value" :value="标签.value">
                          {{ 标签.label }}
                        </option>
                      </select>
                    </template>
                    <span v-else class="tag" :class="标签取值(项) ? 'tag-blue' : 'tag-gray'">
                      {{ 标签取值(项) ? 标签名称(标签取值(项)) : "未映射" }}
                    </span>
                  </td>
                  <td>
                    <span class="status" :class="项.active ? 'green' : 'gray'">
                      {{ 项.active ? "启用" : "停用" }}
                    </span>
                  </td>
                  <td>
                    <template v-if="编辑编号 === 项.featureId">
                      <button
                        class="btn btn-primary btn-sm"
                        type="button"
                        :disabled="保存中"
                        @click="保存(项)"
                      >
                        保存
                      </button>
                      <button class="btn btn-default btn-sm" type="button" @click="取消编辑">
                        取消
                      </button>
                    </template>
                    <button
                      v-else
                      class="btn btn-text btn-sm"
                      type="button"
                      @click="开始编辑(项)"
                    >
                      配置
                    </button>
                  </td>
                </tr>
                <tr v-if="!过滤后映射.length">
                  <td colspan="6" class="war-empty">没有符合条件的产品。</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section class="panel">
        <header class="panel-head">
          <div>
            <h2>工作量规则</h2>
            <p>
              交付工作量按交付标签计人天，可在此编辑；实施工作量按产品分类与端点数区间计人天，
              来自历史规则库，与老 UI 一致只读。
            </p>
          </div>
          <div class="field">
            <select v-model="规则类型筛选">
              <option value="全部">全部规则</option>
              <option value="交付工作量">交付工作量</option>
              <option value="实施工作量">实施工作量</option>
            </select>
          </div>
        </header>
        <div class="panel-body flush">
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>规则</th>
                  <th>归属</th>
                  <th>适用条件</th>
                  <th>人天</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="项 in 过滤后规则" :key="项.id">
                  <td>
                    <span class="record-title">{{ 项.名称 }}</span>
                    <small class="工作量次要">{{ 项.类型 }} · {{ 项.备注 }}</small>
                  </td>
                  <td>
                    <span class="tag" :class="项.类型 === '交付工作量' ? 'tag-blue' : 'tag-gray'">
                      {{ 项.归属 }}
                    </span>
                  </td>
                  <td>{{ 项.条件 }}</td>
                  <td>{{ 项.人天 }} 人天</td>
                  <td>
                    <span class="status" :class="项.启用 ? 'green' : 'gray'">
                      {{ 项.启用 ? "启用" : "停用" }}
                    </span>
                  </td>
                  <td>
                    <button
                      v-if="项.类型 === '交付工作量'"
                      class="btn btn-text btn-sm"
                      type="button"
                      @click="开始编辑规则(项)"
                    >
                      编辑
                    </button>
                    <span v-else class="规则只读" title="实施工作量规则来自历史规则库，与老 UI 一致只读">
                      只读
                    </span>
                  </td>
                </tr>
                <tr v-if="!过滤后规则.length">
                  <td colspan="6" class="war-empty">暂无工作量规则。</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>

    <p v-if="提示" class="工作量提示" :class="{ 失败: 提示失败 }">{{ 提示 }}</p>

    <div v-if="规则弹窗打开 && 编辑规则" class="弹窗遮罩" @click.self="取消编辑规则">
      <section class="规则弹窗">
        <header>
          <div>
            <h2>编辑交付工作量规则</h2>
            <p>{{ 编辑规则.名称 }} · {{ 编辑规则.条件 }} · 保存后立即影响报价试算。</p>
          </div>
          <button type="button" @click="取消编辑规则">×</button>
        </header>
        <div class="弹窗表单">
          <label class="全宽">
            <span>规则名称</span>
            <input :value="编辑规则.名称" disabled />
          </label>
          <label>
            <span>最小点数</span>
            <input v-model.number="规则表单.最小点数" type="number" min="0" step="1" />
          </label>
          <label>
            <span>最大点数</span>
            <input
              v-model.number="规则表单.最大点数"
              type="number"
              min="0"
              step="1"
              placeholder="留空表示不设上限"
            />
          </label>
          <label>
            <span>人天</span>
            <input v-model.number="规则表单.人天" type="number" min="0" step="0.5" />
          </label>
          <label>
            <span>组合项目加项（人天）</span>
            <input
              v-model.number="规则表单.组合人天"
              type="number"
              min="0"
              step="0.5"
              placeholder="留空表示无组合加项"
            />
          </label>
          <label>
            <span>状态</span>
            <select v-model="规则表单.启用">
              <option :value="true">启用</option>
              <option :value="false">停用</option>
            </select>
          </label>
          <label class="全宽">
            <span>说明</span>
            <textarea v-model="规则表单.备注" rows="3" placeholder="规则口径说明，供维护人员查看" />
          </label>
        </div>
        <footer>
          <button class="次要按钮" type="button" @click="取消编辑规则">取消</button>
          <button class="主按钮" type="button" :disabled="规则保存中" @click="保存规则">
            {{ 规则保存中 ? "保存中..." : "保存规则" }}
          </button>
        </footer>
      </section>
    </div>
  </section>
</template>

<style scoped>
.工作量配置页 {
  display: grid;
  /* 覆盖 .vui 的 min-width:1440px / min-height:100%：页面高度由内容决定，
     网格行不再被拉伸摊高，面板底部不会出现大片空白。 */
  min-width: 1200px;
  min-height: 0;
  align-content: start;
  gap: 18px;
  /* 覆盖 .vui 默认的全屏渐变底，与价格规则页保持一致的白底页壳。 */
  background: transparent;
  color: #172b4d;
}
.工作量页头 {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  padding: 22px 24px;
  border: 1px solid #dce7f3;
  border-radius: 12px;
  background: linear-gradient(120deg, #fff, #f3f8ff);
}
.页面标签 {
  color: #2f69ed;
  font-size: 11px;
  font-weight: 700;
}
.工作量页头 h1 {
  margin: 7px 0 5px;
  font-size: 22px;
}
.工作量页头 p {
  margin: 0;
  color: #60748c;
  font-size: 11px;
}
.页头提示 {
  max-width: 420px;
  padding: 10px 12px;
  border: 1px solid #cfe1ff;
  border-radius: 8px;
  color: #315f96;
  background: #eff6ff;
  font-size: 11px;
  line-height: 1.55;
}
/* 工作量页不再使用固定画板：指标区回到文档流，面板高度随内容自适应，底部不留白。 */
.工作量配置页 :deep(.war-kpis) {
  position: static;
  inset: auto;
  margin: 0;
  height: 96px;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
}
.工作量网格 {
  min-height: 0;
}
.工作量网格 .panel-head {
  gap: 10px;
}
.工作量网格 .field.search {
  width: 220px;
  min-width: 160px;
}
.工作量计数 {
  color: var(--text-3);
  font-size: 13px;
}
.工作量次要 {
  display: block;
  color: var(--text-3);
  font-size: 12px;
}
.工作量选择 {
  width: 100%;
  min-width: 150px;
}
.工作量提示 {
  margin: 0;
  color: var(--success, #0b8d69);
  font-size: 13px;
}
.规则只读 {
  color: #7b8da2;
  font-size: 11px;
}
.弹窗遮罩 {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(18, 33, 55, 0.42);
  backdrop-filter: blur(4px);
}
.规则弹窗 {
  width: min(640px, 96vw);
  overflow: hidden;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 24px 70px rgba(15, 32, 60, 0.24);
}
.规则弹窗 header,
.规则弹窗 footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px;
  border-bottom: 1px solid #e7eef6;
}
.规则弹窗 footer {
  justify-content: flex-end;
  border-top: 1px solid #e7eef6;
  border-bottom: 0;
}
.规则弹窗 h2 {
  margin: 0;
  font-size: 16px;
}
.规则弹窗 p {
  margin: 5px 0 0;
  color: #75869a;
  font-size: 11px;
}
.规则弹窗 header button {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  color: #75869a;
  background: #f2f5f9;
  font-size: 20px;
  cursor: pointer;
}
.弹窗表单 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  padding: 20px;
}
.弹窗表单 label {
  display: grid;
  gap: 7px;
  color: #425970;
  font-size: 11px;
  font-weight: 700;
}
.弹窗表单 .全宽 {
  grid-column: 1 / -1;
}
.弹窗表单 input,
.弹窗表单 select,
.弹窗表单 textarea {
  min-height: 36px;
  padding: 8px 10px;
  border: 1px solid #d5e1ee;
  border-radius: 8px;
  color: #34495f;
  background: #fff;
  font: inherit;
  outline: 0;
}
.弹窗表单 input:disabled {
  background: #f4f7fb;
  color: #74869b;
}
.弹窗表单 textarea {
  resize: vertical;
}
.规则弹窗 .主按钮,
.规则弹窗 .次要按钮 {
  min-height: 36px;
  padding: 0 15px;
  border-radius: 8px;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}
.规则弹窗 .主按钮 {
  border: 0;
  color: #fff;
  background: #2367d1;
}
.规则弹窗 .次要按钮 {
  border: 1px solid #d2e0f0;
  color: #425b76;
  background: #fff;
}
.工作量提示.失败 {
  color: var(--danger, #d64545);
}
.工作量网格 .table-wrap {
  max-height: 420px;
  overflow-y: auto;
}
</style>
