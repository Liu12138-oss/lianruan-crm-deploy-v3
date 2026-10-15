<script setup lang="ts">
/**
 * 内部收益核算面板（对齐老 UI QuoteProfitPanel 的订单只读口径）。
 *
 * 仅区管和超级管理员可见；金额全部由服务端计算，前端不做任何推算。
 * 订单审批场景只读展示核算结果、冻结状态和缺项规则。
 */
import { computed, ref, watch } from "vue";

import { 读取报价收益, type 收益计算响应 } from "../../api/quote-profit-client.js";

const 属性 = defineProps<{ quoteId: string }>();

const 加载中 = ref(false);
const 错误 = ref("");
const 收益 = ref<收益计算响应 | null>(null);

const 已冻结 = computed(() => 收益.value?.statusCode === "frozen");
const 不适用 = computed(() => 收益.value?.statusCode === "not_applicable");
const 核算不完整 = computed(() => 收益.value?.statusCode === "incomplete");
const 只读提示 = computed(() => {
  if (已冻结.value) return "该订单已形成正式收益快照，以下金额只读且不可覆盖。";
  if (不适用.value) return "该报价包含非微盾范围产品，不适用本收益核算。";
  return "订单尚未形成正式收益快照，以下为最新核算结果，仅供内部参考。";
});
const 缺项说明 = computed(() =>
  (收益.value?.missingRules || [])
    .map((项) => String(项.message || "").trim())
    .filter(Boolean)
    .join("；"),
);

watch(
  () => 属性.quoteId,
  (编号) => void 加载(编号),
  { immediate: true },
);

async function 加载(编号: string) {
  收益.value = null;
  错误.value = "";
  const 目标编号 = String(编号 || "").trim();
  if (!目标编号) return;
  加载中.value = true;
  try {
    收益.value = await 读取报价收益(目标编号);
  } catch (异常) {
    错误.value = 异常 instanceof Error ? 异常.message : "收益数据加载失败。";
  } finally {
    加载中.value = false;
  }
}

function 金额(值: string | null | undefined): string {
  const 数值 = Number(值 || 0);
  if (!Number.isFinite(数值)) return "—";
  return `¥${数值.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function 为负数(值: string | null | undefined): boolean {
  return Number(值 || 0) < 0;
}
</script>

<template>
  <section class="收益面板">
    <header class="收益面板标题">
      <div>
        <h2>内部收益核算</h2>
        <p>仅区管和超级管理员可见，金额由服务端计算。</p>
      </div>
      <span v-if="收益" class="收益状态" :class="`状态-${收益.statusCode}`">
        {{ 收益.statusName }}
      </span>
    </header>

    <div v-if="加载中" class="收益加载">收益数据加载中…</div>
    <div v-else-if="错误" class="收益错误">{{ 错误 }}</div>
    <template v-else-if="收益">
      <p class="收益只读提示" :class="{ 冻结: 已冻结, 不适用: 不适用 }">{{ 只读提示 }}</p>
      <div class="收益指标">
        <article>
          <span>产品合同额</span>
          <strong>{{ 金额(收益.summary.productContractAmount) }}</strong>
        </article>
        <article>
          <span>服务合同额</span>
          <strong>{{ 金额(收益.summary.serviceContractAmount) }}</strong>
        </article>
        <article>
          <span>合同有效收入</span>
          <strong>{{ 金额(收益.summary.effectiveContractIncome) }}</strong>
        </article>
        <article>
          <span>项目收益</span>
          <strong :class="{ 负数: 为负数(收益.summary.projectProfit) }">
            {{ 金额(收益.summary.projectProfit) }}
          </strong>
        </article>
      </div>
      <div class="收益构成">
        <div class="收益构成标题">
          <strong>收益构成明细</strong><span>服务端计算</span>
        </div>
        <div class="收益构成网格">
          <div class="收益构成项">
            <span>软件折后价</span><strong>{{ 金额(收益.details.softwareDiscountedAmount) }}</strong>
          </div>
          <div class="收益构成项">
            <span>软件公开价</span><strong>{{ 金额(收益.details.softwarePublicAmount) }}</strong>
          </div>
          <div class="收益构成项">
            <span>硬件报价</span><strong>{{ 金额(收益.details.hardwareQuoteAmount) }}</strong>
          </div>
          <div class="收益构成项">
            <span>硬件内部成本</span><strong>{{ 金额(收益.details.hardwareInternalCost) }}</strong>
          </div>
          <div class="收益构成项">
            <span>产品税费</span><strong>{{ 金额(收益.details.productTaxAmount) }}</strong>
          </div>
          <div class="收益构成项">
            <span>服务税费</span><strong>{{ 金额(收益.details.serviceTaxAmount) }}</strong>
          </div>
          <div class="收益构成项">
            <span>质保成本</span><strong>{{ 金额(收益.details.warrantyCost) }}</strong>
          </div>
          <div class="收益构成项">
            <span>采购维保成本</span
            ><strong>{{ 金额(收益.details.procurementMaintenanceCost) }}</strong>
          </div>
        </div>
      </div>
      <p v-if="核算不完整" class="收益缺项">
        当前核算不完整，不能冻结正式收益。<template v-if="缺项说明">
          缺少：{{ 缺项说明 }}</template
        >
      </p>
    </template>
    <div v-else class="收益空态">该订单暂无可展示的收益核算数据。</div>
  </section>
</template>

<style scoped>
.收益面板 {
  overflow: hidden;
  border: 1px solid #dce7f3;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(35, 69, 115, 0.05);
}
.收益面板标题 {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid #e8eef6;
}
.收益面板标题 h2 {
  margin: 0;
  font-size: 16px;
}
.收益面板标题 p {
  margin: 5px 0 0;
  color: #74869b;
  font-size: 11px;
}
.收益状态 {
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}
.状态-frozen {
  color: #0b7a55;
  background: #e8f8f1;
}
.状态-estimated,
.状态-draft {
  color: #175bcf;
  background: #e9f2ff;
}
.状态-incomplete,
.状态-not_applicable,
.状态-void {
  color: #ad4e00;
  background: #fff3e0;
}
.收益加载,
.收益空态 {
  padding: 28px;
  color: #73849a;
  font-size: 11px;
  text-align: center;
}
.收益错误 {
  margin: 16px 18px;
  padding: 12px 14px;
  border: 1px solid #f0c4c4;
  border-radius: 8px;
  color: #a72f2f;
  background: #fff2f2;
  font-size: 11px;
}
.收益只读提示 {
  margin: 16px 18px 0;
  padding: 10px 12px;
  border-radius: 8px;
  color: #ad4e00;
  background: #fff7e6;
  font-size: 11px;
  line-height: 1.55;
}
.收益只读提示.冻结 {
  color: #237804;
  background: #f6ffed;
}
.收益指标 {
  display: grid;
  /* 面板在订单中心只占半栏，用 auto-fit 保证半栏两列、整栏四列都不挤压数值。 */
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
  padding: 16px 18px;
}
.收益指标 article {
  display: grid;
  gap: 6px;
  padding: 12px;
  border: 1px solid #e1eaf4;
  border-radius: 9px;
  background: #f9fbff;
}
.收益指标 span {
  color: #74869b;
  font-size: 11px;
}
.收益指标 strong {
  font-size: 16px;
}
.收益指标 strong.负数 {
  color: #cf1322;
}
.收益构成 {
  padding: 0 18px 16px;
}
.收益构成标题 {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding: 0 2px 8px;
}
.收益构成标题 strong {
  font-size: 11px;
  font-weight: 700;
}
.收益构成标题 span {
  color: #74869b;
  font-size: 11px;
}
.收益构成网格 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 10px;
  padding: 10px 12px;
  border: 1px solid #e1eaf4;
  border-radius: 9px;
  background: #fbfdff;
}
.收益构成项 {
  display: flex;
  align-items: baseline;
  justify-content: flex-start;
  gap: 8px;
  min-width: 0;
}
.收益构成项 span {
  /* 标签定宽，宽屏下金额紧跟标签，不会与标签拉开一大段空白。 */
  flex: none;
  width: 78px;
  color: #74869b;
  font-size: 11px;
  white-space: nowrap;
}
.收益构成项 strong {
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}
.收益缺项 {
  margin: 0 18px 16px;
  padding: 10px 12px;
  border-radius: 8px;
  color: #ad4e00;
  background: #fff7e6;
  font-size: 11px;
  line-height: 1.55;
}
</style>
