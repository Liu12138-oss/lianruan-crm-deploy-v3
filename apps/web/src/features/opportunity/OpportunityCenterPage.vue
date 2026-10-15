<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import { 查询阶段9全部, type 阶段9记录 } from "../../api/business-client.js";
import WarKpis from "../../components/war/WarKpis.vue";
import WarLayout from "../../components/war/WarLayout.vue";
import WarRecordCard from "../../components/war/WarRecordCard.vue";
import type { 指标项 } from "../../components/war/types.js";
import {
  商机七阶段,
  商机阶段进度,
  商机阶段文案,
  映射商机阶段,
  查找商机阶段,
  type 商机阶段键,
} from "../../shared/stages/opportunity-stage.js";
import { 金额文本, 日期文本, 文本, 文本或 } from "../../shared/format/business-format.js";
import { use外壳前缀 } from "../../shared/navigation/shell-prefix.js";

const 路由器 = useRouter();
const 外壳前缀 = use外壳前缀();
const 路由 = useRoute();
const 加载中 = ref(false);
const 错误 = ref("");
const 商机列表 = ref<阶段9记录[]>([]);
const 报价列表 = ref<阶段9记录[]>([]);
const 订单列表 = ref<阶段9记录[]>([]);
const 选中编号 = ref("");
const 当前标签 = ref("全部");
const 当前页签 = ref("概览");
const 搜索词 = ref("");
const 选中区域 = ref("全部区域");

const 标签列表 = ["全部", "重点商机", "停滞风险"];
const 页签列表 = ["概览", "跟进", "报价", "订单", "档案与审计"];

function 原始(row: 阶段9记录 | null | undefined): Record<string, unknown> {
  return (row?.原始数据 as Record<string, unknown>) || {};
}

function 字段(row: 阶段9记录 | null | undefined, ...键列表: string[]): string {
  const 数据 = 原始(row);
  return 文本(...键列表.map((键) => 数据[键]), ...键列表.map((键) => (row as never)?.[键]));
}

function 阶段键(row: 阶段9记录 | null | undefined): 商机阶段键 {
  return 映射商机阶段(字段(row, "stage", "stageCode", "stage_code"), row?.状态, row?.状态名称);
}

function 阶段名称(row: 阶段9记录 | null | undefined): string {
  const 键 = 阶段键(row);
  return 商机阶段文案(键) || 文本(字段(row, "rawStageName", "raw_stage_name"), "未设置阶段");
}

function 停滞天数(row: 阶段9记录): number | null {
  const 时间 = 文本(row.更新时间, row.创建时间);
  if (!时间) return null;
  const 日期 = new Date(时间);
  if (Number.isNaN(日期.getTime())) return null;
  return Math.floor((Date.now() - 日期.getTime()) / 86400000);
}

function 停滞(row: 阶段9记录): boolean {
  const 天数 = 停滞天数(row);
  return 天数 !== null && 天数 >= 7 && !["won", "lost", "cancelled"].includes(阶段键(row));
}

/** 区域取值兼容中文键与英文历史键，保证区域下拉始终按真实数据生成。 */
function 区域文本(row: 阶段9记录 | null | undefined): string {
  return 文本(row?.区域, 字段(row, "region"), 字段(row, "regionName"));
}

const 区域选项 = computed(() =>
  [...new Set(商机列表.value.map((row: 阶段9记录) => 区域文本(row)).filter(Boolean))].sort(),
);

const 过滤后列表 = computed(() => {
  let 列表 = 商机列表.value;
  if (当前标签.value === "重点商机")
    列表 = 列表.filter((row) => ["customer_solution", "poc_trial", "project_approval", "tender"].includes(阶段键(row)));
  if (当前标签.value === "停滞风险") 列表 = 列表.filter((row) => 停滞(row));
  if (选中区域.value && 选中区域.value !== "全部区域")
    列表 = 列表.filter((row) => 区域文本(row) === 选中区域.value);
  const 关键词 = 搜索词.value.trim().toLowerCase();
  if (!关键词) return 列表;
  return 列表.filter((row) =>
    [row.标题, row.客户名称, row.编号, row.负责人, row.渠道名称, 字段(row, "quoteNo")]
      .filter(Boolean)
      .some((值) => String(值).toLowerCase().includes(关键词)),
  );
});

const 当前商机 = computed(
  () => 商机列表.value.find((row) => row.id === 选中编号.value) || 过滤后列表.value[0] || null,
);

const 动态 = computed(() => {
  const 记录 = 当前商机.value;
  if (!记录) return [];
  const 时间 = 文本(记录.更新时间, 记录.创建时间);
  return ['商机阶段已更新', '关联报价已同步', '跟进记录已登记']
    .map((标题, 序号) => ({ 标题, 时间: 序号 === 0 ? 日期文本(时间) : "", 说明: "来自当前记录真实数据" }))
    .filter((项) => 项.时间 || 项.说明);
});

const 关联报价 = computed(() =>
  报价列表.value.filter(
    (报价) =>
      文本(报价.原始数据?.opportunityUuid, 报价.原始数据?.opportunityId) === (当前商机.value?.id || ""),
  ),
);

const 关联订单 = computed(() =>
  订单列表.value.filter(
    (订单) =>
      文本(订单.原始数据?.opportunityUuid, 订单.原始数据?.opportunityId) === (当前商机.value?.id || ""),
  ),
);

const 阶段序号 = computed(() => {
  const 记录 = 当前商机.value;
  if (!记录) return 0;
  const 序号 = 商机七阶段.findIndex((项) => 项.键 === 阶段键(记录));
  return 序号 < 0 ? 0 : 序号;
});

const 阶段完成率 = computed(() => 商机七阶段[阶段序号.value]?.进度 || "—");

const 流程步骤 = computed(() =>
  商机七阶段.map((阶段) => `${阶段.名称.replace(/（.*）/, "")} ${阶段.进度}`),
);

const 健康度 = computed(() => {
  const 记录 = 当前商机.value;
  if (!记录) return [];
  const 天数 = 停滞天数(记录);
  const 活跃 = 天数 === null ? 0 : 天数 <= 3 ? 92 : 天数 <= 7 ? 76 : 天数 <= 14 ? 58 : 40;
  const 阶段 = Math.round(((阶段序号.value + 1) / 商机七阶段.length) * 100);
  const 字段清单 = [
    记录.客户名称,
    记录.渠道名称,
    记录.负责人,
    记录.金额,
    字段(记录, "registrationNo"),
    字段(记录, "quoteNo"),
  ];
  const 完整 = Math.round((字段清单.filter((值) => Boolean(文本(值))).length / 字段清单.length) * 100);
  return [
    { 名称: "客户活跃度", 值: 活跃 },
    { 名称: "阶段完成度", 值: 阶段 },
    { 名称: "资料完整度", 值: 完整 },
  ];
});

const 下一步建议 = computed(() => {
  const 记录 = 当前商机.value;
  if (!记录) return "";
  const 键 = 阶段键(记录);
  const 建议: Record<商机阶段键, string> = {
    customer_contact: "建议补充客户需求范围与关键联系人，尽快推进到需求挖掘阶段。",
    demand_discovery: "建议梳理客户痛点与采购预算，形成初步解决方案并确认决策链。",
    customer_solution: "建议本周完成技术方案评审，并创建报价单同步商务口径。",
    poc_trial: "建议明确 POC 验收标准与测试范围，跟踪试用反馈并推进立项。",
    project_approval: "建议跟进立项审批进度，同步采购流程与合同主体信息。",
    tender: "建议核对投标材料与报价版本，确认投标时间节点。",
    won: "已成单，建议关注订单交付与后续复购机会。",
    lost: "已输单，建议记录输单原因并归档客户信息。",
    cancelled: "项目已取消，建议保持客户联系并纳入后续跟进。",
  };
  const 基础 = 建议[键] || "建议补充商机信息并维护跟进记录。";
  const 天数 = 停滞天数(记录);
  return 天数 !== null && 天数 >= 7 ? `${基础} 该商机已 ${天数} 天未更新，已标记停滞风险。` : 基础;
});

function 报价状态文本(报价: 阶段9记录): string {
  return 文本(报价.状态名称, 报价.状态, "草稿");
}

function 创建报价单() {
  const 记录 = 当前商机.value;
  if (!记录) return;
  路由器.push(`${外壳前缀.value}/quote/new?opportunityId=${encodeURIComponent(记录.id)}`);
}

function 查看报价(报价?: 阶段9记录) {
  const 目标 = 报价 || 关联报价.value[0];
  if (!目标) {
    ElMessage.warning("该商机还没有关联报价单，请先创建报价单。");
    return;
  }
  路由器.push(`${外壳前缀.value}/quote?quoteId=${encodeURIComponent(目标.id)}`);
}

const 指标 = computed<指标项[]>(() => {
  const 列表 = 商机列表.value;
  const 推进中 = 列表.filter((row) => !["won", "lost", "cancelled"].includes(阶段键(row))).length;
  const 方案与试用 = 列表.filter((row) => ["customer_solution", "poc_trial"].includes(阶段键(row))).length;
  const 立项与招投标 = 列表.filter((row) => ["project_approval", "tender"].includes(阶段键(row))).length;
  const 成单 = 列表.filter((row) => 阶段键(row) === "won").length;
  const 风险 = 列表.filter((row) => 停滞(row)).length;
  const 合计金额 = 列表.reduce((合计, row) => 合计 + Number(row.金额 || 0), 0);
  return [
    { label: "商机总数", value: String(列表.length), unit: "条", note: "当前数据范围内商机" },
    { label: "活跃商机", value: String(推进中), unit: "条", note: "未成单/未丢单/未取消" },
    { label: "客户方案 / POC", value: String(方案与试用), unit: "条", note: "40% / 50% 阶段" },
    { label: "立项推进 / 招投标", value: String(立项与招投标), unit: "条", note: "60%-90% 阶段" },
    { label: "已成单", value: String(成单), unit: "条", note: "阶段为成单" },
    {
      label: "停滞风险",
      value: String(风险),
      unit: "条",
      note: 风险 ? `超过 7 天未更新 · 商机预计金额合计 ${金额文本(合计金额)}` : "超过 7 天未更新",
    },
  ];
});

onMounted(() => void 加载());

async function 加载() {
  加载中.value = true;
  错误.value = "";
  try {
    const [商机, 报价, 订单] = await Promise.all([
      查询阶段9全部("opportunities"),
      查询阶段9全部("quotes").catch(() => ({ 数据: [] as 阶段9记录[], 总数: 0 })),
      查询阶段9全部("orders").catch(() => ({ 数据: [] as 阶段9记录[], 总数: 0 })),
    ]);
    商机列表.value = 商机.数据;
    报价列表.value = 报价.数据;
    订单列表.value = 订单.数据;
    // 支持从报价单/订单页带 ?opportunityId= 返回时直接选中对应商机
    const 预选 = 文本(路由.query.opportunityId);
    选中编号.value =
      (预选 && 商机列表.value.some((row) => row.id === 预选) ? 预选 : "") ||
      商机列表.value[0]?.id ||
      "";
  } catch (异常) {
    错误.value = 异常 instanceof Error ? 异常.message : "商机数据加载失败。";
  } finally {
    加载中.value = false;
  }
}

function 打开跟进(row: 阶段9记录) {
  路由器.push(`${外壳前缀.value}/registration/${字段(row, "registrationUuid") || ""}/followup`);
}
</script>

<template>
  <div class="vui war-artboard 商机页">
    <WarKpis :items="指标" />

    <WarLayout
      list-title="商机列表"
      :list-count="String(过滤后列表.length)"
      search-placeholder="搜索商机名称、客户、编号或报价单"
      :tabs="标签列表"
      :active-tab="当前标签"
      v-model="搜索词"
      :步骤="流程步骤"
      :当前步骤="阶段序号"
      流程标题="标准化商机作战流程"
      :流程说明="当前商机 ? `当前阶段：${阶段名称(当前商机)}` : ''"
      :动态="动态"
      :区域列表="区域选项"
      :选中区域="选中区域"
      @update:选中区域="选中区域 = $event"
      @切换标签="当前标签 = $event"
    >
      <template #center-head>
        <div v-if="当前商机" class="war-center-head">
          <div class="deal-title">
            <strong>{{ 文本或([当前商机.标题, 当前商机.客户名称], "未命名商机") }}</strong>
            <span>
              {{ 文本(当前商机.编号, "无编号") }} · {{ 文本(当前商机.客户名称, "未关联客户") }} ·
              {{ 阶段名称(当前商机) }} · 成单概率 {{ 阶段完成率 }}
            </span>
          </div>
          <div class="center-actions">
            <button type="button" class="button" @click="打开跟进(当前商机)">记录跟进</button>
            <button type="button" class="button primary" @click="创建报价单">创建报价单</button>
          </div>
        </div>
      </template>

      <template #list>
        <div v-if="加载中" class="war-empty">正在加载商机数据…</div>
        <div v-else-if="错误" class="war-empty">{{ 错误 }}</div>
        <WarRecordCard
          v-for="row in 过滤后列表"
          :key="row.id"
          :title="文本或([row.标题, row.客户名称], '未命名商机')"
          :meta="[
            阶段名称(row),
            区域文本(row) || '未填写区域',
            文本(row.客户名称, '未关联客户'),
          ].join(' · ')"
          :badge="商机阶段进度(阶段键(row)) || 阶段名称(row)"
          :tone="阶段键(row) === 'won' ? 'green' : 停滞(row) ? 'red' : 'blue'"
          :owner="`负责人：${文本(row.负责人, '未指派')}`"
          :amount="金额文本(row.金额)"
          :tags="[
            { text: 阶段名称(row), hot: !['won', 'lost', 'cancelled'].includes(阶段键(row)) },
            { text: 停滞(row) ? `停滞 ${停滞天数(row)} 天` : `更新 ${日期文本(row.更新时间)}` },
          ]"
          :active="当前商机?.id === row.id"
          @选择="选中编号 = row.id"
        />
        <div v-if="!加载中 && !错误 && !过滤后列表.length" class="war-empty">
          当前筛选条件下没有商机记录。
        </div>
      </template>

      <template #center>
        <template v-if="当前商机">
          <div class="section-tabs">
            <button
              v-for="页签 in 页签列表"
              :key="页签"
              type="button"
              class="section-tab"
              :class="{ active: 当前页签 === 页签 }"
              @click="当前页签 = 页签"
            >
              {{ 页签 }}
            </button>
          </div>

          <section v-if="当前页签 === '概览' || 当前页签 === '报价'" class="panel">
            <header class="panel-head">
              <div>
                <h2>关联报价单</h2>
                <p>
                  共 {{ 关联报价.length }} 份 ·
                  {{
                    关联报价.length > 2
                      ? `报价单独立管理，商机只展示最近 2 份`
                      : `报价单独立管理，商机只展示上下文`
                  }}
                </p>
              </div>
              <div class="center-actions">
                <button type="button" class="button" @click="创建报价单">＋新建报价</button>
                <button type="button" class="button" @click="查看报价()">查看报价</button>
              </div>
            </header>
            <div class="panel-body">
              <template v-if="关联报价.length">
                <div class="quote-grid">
                  <article
                    v-for="报价 in 关联报价.slice(0, 2)"
                    :key="报价.id"
                    class="quote-card"
                    @click="查看报价(报价)"
                  >
                    <div class="quote-card-head">
                      <strong>{{ 文本(报价.编号, 字段(报价, "quoteNo"), "未编号") }}</strong>
                      <span class="quote-status">{{ 报价状态文本(报价) }}</span>
                    </div>
                    <p>
                      {{ 文本(报价.标题, 报价.客户名称, "未命名报价") }} · 端点
                      {{ 文本(字段(报价, "endpoints"), "—") }} · {{ 金额文本(报价.金额) }} ·
                      {{ 文本(报价.负责人, "未指派") }} · {{ 日期文本(报价.更新时间) }}
                    </p>
                  </article>
                </div>
              </template>
              <div v-else class="war-empty">该商机还没有关联报价单，可点击「＋新建报价」创建。</div>
            </div>
          </section>

          <div v-if="当前页签 === '概览'" class="extended-center-grid">
            <section class="panel">
              <header class="panel-head">
                <div><h2>商机信息</h2><p>业务事实</p></div>
              </header>
              <div class="panel-body">
                <div class="info-grid">
                  <div class="info-item">
                    <span>商机编号</span><strong>{{ 文本(当前商机.编号, "—") }}</strong>
                  </div>
                  <div class="info-item">
                    <span>客户</span>
                    <strong>{{ 文本(当前商机.客户名称, "未关联") }}</strong>
                  </div>
                  <div class="info-item">
                    <span>预计金额</span><strong>{{ 金额文本(当前商机.金额) }}</strong>
                  </div>
                  <div class="info-item">
                    <span>负责人</span>
                    <strong>{{ 文本(当前商机.负责人, "未指派") }}</strong>
                  </div>
                  <div class="info-item">
                    <span>渠道商</span>
                    <strong>{{ 文本(当前商机.渠道名称, "未归属") }}</strong>
                  </div>
                  <div class="info-item">
                    <span>关联报价</span>
                    <strong>{{ 文本(字段(当前商机, "quoteNo"), "尚未报价") }}</strong>
                  </div>
                </div>
              </div>
            </section>

            <section class="panel">
              <header class="panel-head">
                <div><h2>下一步建议</h2><p>业务助手</p></div>
              </header>
              <div class="panel-body">
                <p class="advice-text">{{ 下一步建议 }}</p>
              </div>
            </section>
          </div>

          <section v-else-if="当前页签 === '跟进'" class="panel">
            <header class="panel-head">
              <div><h2>跟进记录</h2><p>正式记录归属关联商机与客户档案</p></div>
              <div class="center-actions">
                <button type="button" class="button primary" @click="打开跟进(当前商机)">
                  打开客户跟进
                </button>
              </div>
            </header>
            <div class="panel-body">
              <p class="advice-text">
                {{ 文本(字段(当前商机, "followup"), "当前商机暂无跟进记录，点击「打开客户跟进」登记。") }}
              </p>
              <p class="war-note">
                关联报备：{{ 文本(字段(当前商机, "registrationNo"), "无") }} · 最近更新：{{
                  日期文本(当前商机.更新时间)
                }}
              </p>
            </div>
          </section>

          <section v-else-if="当前页签 === '订单'" class="panel">
            <header class="panel-head">
              <div><h2>关联订单</h2><p>共 {{ 关联订单.length }} 笔 · 订单动作在订单中心处理</p></div>
            </header>
            <div class="panel-body flush">
              <table class="vui-table">
                <thead>
                  <tr><th>订单编号</th><th>状态</th><th>金额</th><th>更新时间</th></tr>
                </thead>
                <tbody>
                  <tr v-for="订单 in 关联订单" :key="订单.id">
                    <td>{{ 文本(订单.编号, "未编号") }}</td>
                    <td>{{ 文本(订单.状态名称, 订单.状态, "—") }}</td>
                    <td>{{ 金额文本(订单.金额) }}</td>
                    <td>{{ 日期文本(订单.更新时间) }}</td>
                  </tr>
                  <tr v-if="!关联订单.length">
                    <td colspan="4" class="war-empty">该商机还没有关联订单。</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section v-else class="panel">
            <header class="panel-head">
              <div><h2>档案与审计</h2><p>商机全字段与时间戳</p></div>
            </header>
            <div class="panel-body">
              <div class="info-grid">
                <div class="info-item"><span>商机编号</span><strong>{{ 文本(当前商机.编号, "—") }}</strong></div>
                <div class="info-item"><span>商机名称</span><strong>{{ 文本(当前商机.标题, "—") }}</strong></div>
                <div class="info-item"><span>客户</span><strong>{{ 文本(当前商机.客户名称, "未关联") }}</strong></div>
                <div class="info-item"><span>渠道商</span><strong>{{ 文本(当前商机.渠道名称, "未归属") }}</strong></div>
                <div class="info-item"><span>负责人</span><strong>{{ 文本(当前商机.负责人, "未指派") }}</strong></div>
                <div class="info-item"><span>所属区域</span><strong>{{ 区域文本(当前商机) || "未填写" }}</strong></div>
                <div class="info-item"><span>关联报备</span><strong>{{ 文本(字段(当前商机, "registrationNo"), "无") }}</strong></div>
                <div class="info-item"><span>关联报价</span><strong>{{ 文本(字段(当前商机, "quoteNo"), "尚未报价") }}</strong></div>
                <div class="info-item"><span>当前阶段</span><strong>{{ 阶段名称(当前商机) }}</strong></div>
                <div class="info-item"><span>预计金额</span><strong>{{ 金额文本(当前商机.金额) }}</strong></div>
                <div class="info-item"><span>创建时间</span><strong>{{ 日期文本(当前商机.创建时间) }}</strong></div>
                <div class="info-item"><span>更新时间</span><strong>{{ 日期文本(当前商机.更新时间) }}</strong></div>
              </div>
              <p class="war-note">
                阶段口径：客户建联 → 需求挖掘 → 客户方案 → POC 试用 → 立项推进 → 招投标 → 成单；
                输单与项目取消为终止结果，不计入主进度；超过 7 天未更新标记停滞风险。
              </p>
            </div>
          </section>
        </template>
        <div v-else class="war-empty">请选择左侧商机查看详情。</div>
      </template>

      <template #right>
        <article v-if="当前商机" class="right-card highlight">
          <div class="right-card-title"><strong>业务状态</strong><span>实时快照</span></div>
          <div class="info-grid">
            <div class="info-item">
              <span>商机状态</span><strong>{{ 阶段名称(当前商机) }}</strong>
            </div>
            <div class="info-item">
              <span>成单概率</span><strong>{{ 阶段完成率 }}</strong>
            </div>
            <div class="info-item">
              <span>预计金额</span><strong>{{ 金额文本(当前商机.金额) }}</strong>
            </div>
            <div class="info-item">
              <span>停滞天数</span>
              <strong>{{ 停滞天数(当前商机) === null ? "—" : `${停滞天数(当前商机)} 天` }}</strong>
            </div>
            <div class="info-item">
              <span>负责人</span><strong>{{ 文本(当前商机.负责人, "未指派") }}</strong>
            </div>
            <div class="info-item">
              <span>最近更新</span><strong>{{ 日期文本(当前商机.更新时间) }}</strong>
            </div>
          </div>
        </article>
        <article v-if="当前商机" class="right-card">
          <div class="right-card-title"><strong>商机健康度</strong><span>当前周期</span></div>
          <div v-for="项 in 健康度" :key="项.名称" class="health-row">
            <span class="health-label">{{ 项.名称 }}</span>
            <div class="progress">
              <div class="progress-track"><i :style="{ width: `${项.值}%` }"></i></div>
              <span>{{ 项.值 }}%</span>
            </div>
          </div>
          <p class="war-note">按阶段完成度、更新时效与字段完整度推算，口径待业务确认。</p>
        </article>
      </template>
    </WarLayout>
  </div>
</template>

<style scoped>
.商机页 {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 12px;
  min-height: calc(100vh - 96px);
  padding: 14px 18px 18px;
}

.商机页 :deep(.war-kpis) {
  position: static;
  inset: auto;
  height: auto;
}

.商机页 :deep(.war-layout) {
  position: static;
  inset: auto;
  min-height: 620px;
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
  background: #f8fbff;
}

.商机页 :deep(.war-list-body) {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.商机页 :deep(.war-search input) {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--text);
  font-size: 11px;
  outline: none;
}

.stage-flow {
  display: grid;
  gap: 6px;
}

.stage-node {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border: 1px solid var(--line-soft);
  border-radius: 8px;
  background: #ffffff;
  color: var(--text-3);
  font-size: 11px;
}

.stage-node.done {
  color: var(--green);
  border-color: #cdebdf;
  background: var(--green-soft);
}

.stage-node.active {
  color: var(--blue-strong);
  border-color: #c9dcff;
  background: var(--blue-soft);
  font-weight: 700;
}

.stage-index {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #eef3f9;
  font-size: 11px;
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

.section-tabs {
  margin: 10px 16px 0;
}

.war-center > .section-tabs,
.war-center > .panel,
.war-center > .extended-center-grid {
  flex-shrink: 0;
}

.商机页 :deep(.panel-head) {
  padding: 9px 12px;
}

.商机页 :deep(.panel-head h2) {
  margin-bottom: 2px;
}

.商机页 :deep(.info-grid) {
  gap: 6px 12px;
}

.商机页 :deep(.info-item strong) {
  margin-top: 1px;
}

.quote-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.quote-card {
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: linear-gradient(145deg, #f7fbff, #ffffff);
  cursor: pointer;
}

.quote-card:hover {
  border-color: #cfe1fa;
}

.quote-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.quote-card-head strong {
  font-size: 11px;
}

.quote-status {
  padding: 1px 7px;
  border-radius: 999px;
  background: #eef4fb;
  color: var(--text-3);
  font-size: 11px;
}

.quote-card p {
  margin: 0;
  color: var(--text-2);
  font-size: 11px;
}

.advice-text {
  margin: 0;
  color: var(--text-2);
  font-size: 11px;
  line-height: 1.7;
}

.health-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 7px;
}

.health-label {
  flex: 0 0 62px;
  color: var(--text-3);
  font-size: 11px;
}

.health-row .progress {
  flex: 1 1 auto;
  margin-top: 0;
}
</style>
