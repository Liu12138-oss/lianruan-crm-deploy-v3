<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import { 查询阶段9全部, type 阶段9记录 } from "../../api/business-client.js";
import { use外壳前缀 } from "../../shared/navigation/shell-prefix.js";
import RegistrationReviewActions from "./RegistrationReviewActions.vue";
import WarKpis from "../../components/war/WarKpis.vue";
import WarLayout from "../../components/war/WarLayout.vue";
import WarRecordCard from "../../components/war/WarRecordCard.vue";
import type { 指标项 } from "../../components/war/types.js";
import {
  金额文本,
  客户状态文本,
  日期文本,
  文本,
  文本或,
  是本月,
} from "../../shared/format/business-format.js";

const 路由器 = useRouter();
const 外壳前缀 = use外壳前缀();
const 加载中 = ref(false);
const 错误 = ref("");
const 客户列表 = ref<阶段9记录[]>([]);
const 商机列表 = ref<阶段9记录[]>([]);
const 选中编号 = ref("");
const 当前标签 = ref("全部");
const 搜索词 = ref("");
const 选中区域 = ref("全部区域");

const 标签列表 = ["全部", "待审核", "保护期内"];

function 原始(row: 阶段9记录 | null | undefined): Record<string, unknown> {
  return (row?.原始数据 as Record<string, unknown>) || {};
}

function 字段(row: 阶段9记录 | null | undefined, ...键列表: string[]): string {
  const 数据 = 原始(row);
  return 文本(...键列表.map((键) => 数据[键]), ...键列表.map((键) => (row as never)?.[键]));
}

const 区域选项 = computed(() =>
  [...new Set(客户列表.value.map((row) => 文本(row.区域)).filter(Boolean))].sort(),
);

const 过滤后列表 = computed(() => {
  let 列表 = 客户列表.value;
  if (当前标签.value === "待审核") 列表 = 列表.filter((row) => row.状态 === "pending");
  if (当前标签.value === "保护期内") 列表 = 列表.filter((row) => (距今天数(row) ?? -1) > 0);
  if (选中区域.value && 选中区域.value !== "全部区域")
    列表 = 列表.filter((row) => 文本(row.区域) === 选中区域.value);
  const 关键词 = 搜索词.value.trim().toLowerCase();
  if (!关键词) return 列表;
  return 列表.filter((row) =>
    [
      row.客户名称,
      row.标题,
      row.编号,
      row.负责人,
      row.渠道名称,
      字段(row, "creditCode"),
      字段(row, "contact"),
    ]
      .filter(Boolean)
      .some((值) => String(值).toLowerCase().includes(关键词)),
  );
});

const 当前客户 = computed(
  () => 客户列表.value.find((row) => row.id === 选中编号.value) || 过滤后列表.value[0] || null,
);

function 距今天数(row: 阶段9记录): number | null {
  const 到期 = 字段(row, "expireAt", "保护期至", "保护期");
  if (!到期) return null;
  const 日期 = new Date(到期);
  if (Number.isNaN(日期.getTime())) return null;
  return Math.ceil((日期.getTime() - Date.now()) / 86400000);
}

function 关联商机(row: 阶段9记录 | null): 阶段9记录[] {
  if (!row) return [];
  const 客户名 = 字段(row, "customer", "customerName") || row.客户名称 || row.标题;
  const 编号 = row.编号;
  return 商机列表.value.filter((商机) => {
    const 商机客户 = 字段(商机, "customer", "customerName") || 商机.客户名称;
    const 报备编号 = 字段(商机, "regNo", "registrationNo", "regId");
    return (客户名 && 商机客户 && 商机客户 === 客户名) || (编号 && 报备编号 === 编号);
  });
}

const 动态 = computed(() => {
  const 记录 = 当前客户.value;
  if (!记录) return [];
  const 时间 = 文本(记录.更新时间, 记录.创建时间);
  return ['本月新增客户报备', '客户档案已同步', '保护期状态更新']
    .map((标题, 序号) => ({ 标题, 时间: 序号 === 0 ? 日期文本(时间) : "", 说明: "来自当前记录真实数据" }))
    .filter((项) => 项.时间 || 项.说明);
});

const 生命周期步骤 = ['客户报备', '审核通过', '保护期', '商机创建', '报价推进', '订单交付', '持续运营'];

const 生命周期阶段序号 = computed(() => {
  const 记录 = 当前客户.value;
  if (!记录) return 0;
  if (记录.状态 === "pending") return 0;
  if (记录.状态 !== "approved") return 1;
  return 关联商机(记录).length ? 3 : 2;
});

const 生命周期阶段名 = computed(() => 生命周期步骤[生命周期阶段序号.value] || "客户报备");

const 指标 = computed<指标项[]>(() => {
  const 列表 = 客户列表.value;
  const 总数 = 列表.length;
  const 待审核 = 列表.filter((row) => row.状态 === "pending").length;
  const 保护期内 = 列表.filter((row) => (距今天数(row) ?? -1) > 0).length;
  const 即将到期 = 列表.filter((row) => {
    const 天数 = 距今天数(row);
    return 天数 !== null && 天数 >= 0 && 天数 <= 30;
  }).length;
  const 本月新增 = 列表.filter((row) => 是本月(row.创建时间)).length;
  const 已通过 = 列表.filter((row) => row.状态 === "approved").length;
  return [
    { label: "客户总数", value: String(总数), unit: "家", note: "当前数据范围内客户报备总数" },
    { label: "待审核报备", value: String(待审核), unit: "家", note: "状态为待审核的报备" },
    { label: "保护期内", value: String(保护期内), unit: "家", note: "保护期到期日晚于今天" },
    { label: "30 天内到期", value: String(即将到期), unit: "家", note: "需要提醒续报的客户" },
    { label: "本月新增", value: String(本月新增), unit: "家", note: "按报备创建时间统计" },
    { label: "已通过", value: String(已通过), unit: "家", note: "审核通过的客户报备" },
  ];
});

onMounted(() => void 加载());

async function 加载() {
  加载中.value = true;
  错误.value = "";
  try {
    const [报备结果, 商机结果] = await Promise.all([
      查询阶段9全部("registrations"),
      查询阶段9全部("opportunities"),
    ]);
    客户列表.value = 报备结果.数据;
    商机列表.value = 商机结果.数据;
    选中编号.value = 客户列表.value[0]?.id || "";
  } catch (异常) {
    错误.value = 异常 instanceof Error ? 异常.message : "客户数据加载失败。";
  } finally {
    加载中.value = false;
  }
}

/** 报备审核成功后原位替换列表记录：状态、保护期与 KPI 随之刷新，不打断当前选中客户。 */
function 应用审核结果(记录: 阶段9记录) {
  const 位置 = 客户列表.value.findIndex((row) => row.id === 记录.id);
  if (位置 >= 0) 客户列表.value.splice(位置, 1, 记录);
}

function 打开跟进(row: 阶段9记录) {
  路由器.push(`${外壳前缀.value}/registration/${row.id}/followup`);
}
</script>

<template>
  <div class="vui war-artboard 客户管理页">
    <WarKpis :items="指标" />

    <WarLayout
      list-title="客户列表"
      :list-count="String(过滤后列表.length)"
      search-placeholder="搜索客户名称、信用代码或负责人"
      :tabs="标签列表"
      :active-tab="当前标签"
      v-model="搜索词"
      :步骤="生命周期步骤"
      :当前步骤="生命周期阶段序号"
      流程标题="客户全生命周期"
      :流程说明="`当前阶段：${生命周期阶段名}`"
      :动态="动态"
      :区域列表="区域选项"
      :选中区域="选中区域"
      @update:选中区域="选中区域 = $event"
      @切换标签="当前标签 = $event"
    >
      <template #list>
        <div v-if="加载中" class="war-empty">正在加载客户数据…</div>
        <div v-else-if="错误" class="war-empty">{{ 错误 }}</div>
        <WarRecordCard
          v-for="row in 过滤后列表"
          :key="row.id"
          :title="文本或([row.客户名称, row.标题], '未命名客户')"
          :meta="[
            文本(字段(row, 'industry'), '未填写行业'),
            文本(row.区域, '未填写区域'),
            文本(row.渠道名称, '未归属渠道'),
          ].join(' · ')"
          :badge="客户状态文本(row.状态, row.状态名称)"
          :tone="row.状态 === 'approved' ? 'green' : row.状态 === 'pending' ? 'amber' : 'gray'"
          :owner="`归属：${文本(row.渠道名称, '未归属')}／${文本(row.负责人, '未指派')}`"
          :amount="金额文本(row.金额)"
          :tags="[
            { text: 距今天数(row) !== null ? `保护期剩余 ${距今天数(row)} 天` : '保护期未设置', hot: (距今天数(row) ?? 999) <= 30 },
            { text: `关联商机 ${关联商机(row).length} 个` },
          ]"
          :active="当前客户?.id === row.id"
          @选择="选中编号 = row.id"
        />
        <div v-if="!加载中 && !错误 && !过滤后列表.length" class="war-empty">
          当前筛选条件下没有客户记录。
        </div>
      </template>

      <template #center-head>
        <div v-if="当前客户" class="war-center-head">
          <div class="deal-title">
            <strong>{{ 文本或([当前客户.客户名称, 当前客户.标题], '未命名客户') }}</strong>
            <span>
              {{ 文本(当前客户.编号, '无编号') }} ·
              {{ 文本(字段(当前客户, 'industry'), '未填写行业') }} ·
              {{ 文本(当前客户.区域, '未填写区域') }} · 归属渠道：{{
                文本(当前客户.渠道名称, '未归属')
              }}
            </span>
          </div>
          <div class="center-actions">
            <RegistrationReviewActions :客户="当前客户" @更新="应用审核结果" />
            <button type="button" class="button" @click="打开跟进(当前客户)">编辑客户档案</button>
            <button type="button" class="button primary" @click="打开跟进(当前客户)">
              记录客户跟进
            </button>
          </div>
        </div>
      </template>

      <template #center>
        <template v-if="当前客户">
          <div class="extended-center-grid">
            <section class="panel">
              <header class="panel-head">
                <div>
                  <h2>客户档案</h2>
                  <p>{{ 文本(字段(当前客户, 'notes', 'project'), '来自客户报备数据') }}</p>
                </div>
              </header>
              <div class="panel-body">
                <div class="info-grid">
                  <div class="info-item">
                    <span>报备编号</span><strong>{{ 文本(当前客户.编号, '—') }}</strong>
                  </div>
                  <div class="info-item">
                    <span>统一社会信用代码</span>
                    <strong>{{ 文本(字段(当前客户, 'creditCode'), '未填写') }}</strong>
                  </div>
                  <div class="info-item">
                    <span>所属行业</span>
                    <strong>{{ 文本(字段(当前客户, 'industry'), '未填写') }}</strong>
                  </div>
                  <div class="info-item">
                    <span>所属区域</span>
                    <strong>{{ 文本(当前客户.区域, '未填写') }}</strong>
                  </div>
                  <div class="info-item">
                    <span>归属渠道</span>
                    <strong>{{ 文本(当前客户.渠道名称, '未归属') }}</strong>
                  </div>
                  <div class="info-item">
                    <span>报备日期</span>
                    <strong>{{ 日期文本(当前客户.创建时间) }}</strong>
                  </div>
                  <div class="info-item">
                    <span>保护期到期</span>
                    <strong>{{ 日期文本(字段(当前客户, 'expireAt')) }}</strong>
                  </div>
                  <div class="info-item">
                    <span>负责人</span>
                    <strong>{{ 文本(当前客户.负责人, '未指派') }}</strong>
                  </div>
                </div>
              </div>
            </section>

            <section class="panel">
              <header class="panel-head">
                <div>
                  <h2>联系人信息</h2>
                  <p>来自报备与工商主体字段</p>
                </div>
              </header>
              <div class="panel-body">
                <div class="info-grid">
                  <div class="info-item">
                    <span>联系人</span>
                    <strong>{{ 文本(字段(当前客户, 'contact'), '未填写') }}</strong>
                  </div>
                  <div class="info-item">
                    <span>联系电话</span>
                    <strong>{{ 文本(字段(当前客户, 'phone'), '未填写') }}</strong>
                  </div>
                  <div class="info-item">
                    <span>邮箱</span>
                    <strong>{{ 文本(字段(当前客户, 'email'), '未填写') }}</strong>
                  </div>
                  <div class="info-item">
                    <span>地址</span>
                    <strong>{{ 文本(字段(当前客户, 'address'), '未填写') }}</strong>
                  </div>
                </div>
              </div>
            </section>

            <section class="panel">
              <header class="panel-head">
                <div>
                  <h2>业务概况</h2>
                  <p>关联业务快照</p>
                </div>
              </header>
              <div class="panel-body">
                <div class="info-grid">
                  <div class="info-item">
                    <span>关联商机</span>
                    <strong>{{ 关联商机(当前客户).length }} 个</strong>
                  </div>
                  <div class="info-item">
                    <span>报备状态</span>
                    <strong>{{ 客户状态文本(当前客户.状态, 当前客户.状态名称) }}</strong>
                  </div>
                  <div class="info-item">
                    <span>最近更新</span>
                    <strong>{{ 日期文本(当前客户.更新时间) }}</strong>
                  </div>
                  <div class="info-item">
                    <span>保护期剩余</span>
                    <strong>{{
                      距今天数(当前客户) === null ? "未设置" : `${距今天数(当前客户)} 天`
                    }}</strong>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </template>
        <div v-else class="war-empty">请选择左侧客户查看档案。</div>
      </template>

      <template #right>
        <article v-if="当前客户" class="right-card highlight">
          <div class="right-card-title"><strong>当前状态</strong><span>实时快照</span></div>
          <div class="info-grid">
            <div class="info-item">
              <span>报备状态</span>
              <strong>{{ 客户状态文本(当前客户.状态, 当前客户.状态名称) }}</strong>
            </div>
            <div class="info-item">
              <span>关联商机</span>
              <strong>{{ 关联商机(当前客户).length }} 个</strong>
            </div>
            <div class="info-item">
              <span>保护期剩余</span>
              <strong>{{
                距今天数(当前客户) === null ? "未设置" : `${距今天数(当前客户)} 天`
              }}</strong>
            </div>
            <div class="info-item">
              <span>归属负责人</span>
              <strong>{{ 文本(当前客户.负责人, "未指派") }}</strong>
            </div>
          </div>
        </article>

        <article v-if="当前客户" class="right-card">
          <div class="right-card-title"><strong>关联商机</strong><span>{{ 关联商机(当前客户).length }} 条</span></div>
          <div v-if="关联商机(当前客户).length" class="mini-list">
            <div v-for="商机 in 关联商机(当前客户)" :key="商机.id" class="mini-item">
              <strong>{{ 文本(商机.标题, 商机.客户名称, "未命名商机") }}</strong>
              <span>{{ 文本(商机.状态名称, 商机.状态, "状态未知") }} · {{ 金额文本(商机.金额) }}</span>
            </div>
          </div>
          <p v-else class="war-note">该客户暂未创建关联商机。</p>
        </article>

        <article v-if="当前客户" class="right-card">
          <div class="right-card-title"><strong>建议动作</strong><span>口径提示</span></div>
          <p class="war-note">
            保护期与状态来自客户报备真实数据；跟进记录请在客户跟进页维护，后续版本会在此处展示时间线。
          </p>
        </article>
      </template>
    </WarLayout>
  </div>
</template>

<style scoped>
.客户管理页 {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 12px;
  min-height: calc(100vh - 96px);
  padding: 14px 18px 18px;
}

.客户管理页 :deep(.war-kpis) {
  position: static;
  inset: auto;
  height: auto;
}

.客户管理页 :deep(.war-layout) {
  position: static;
  inset: auto;
  min-height: 620px;
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
  background: #f8fbff;
}

.客户管理页 :deep(.war-list-body) {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.war-empty {
  display: grid;
  place-items: center;
  min-height: 120px;
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

.客户管理页 :deep(.war-search) {
  cursor: text;
}

.客户管理页 :deep(.war-search input) {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--text);
  font-size: 11px;
  outline: none;
}

.mini-list {
  display: grid;
  gap: 8px;
  margin-top: 8px;
}

.mini-item {
  display: grid;
  gap: 2px;
  padding: 8px 10px;
  border: 1px solid var(--line-soft);
  border-radius: 8px;
  background: #ffffff;
}

.mini-item strong {
  font-size: 11px;
}

.mini-item span {
  color: var(--text-3);
  font-size: 11px;
}
</style>
