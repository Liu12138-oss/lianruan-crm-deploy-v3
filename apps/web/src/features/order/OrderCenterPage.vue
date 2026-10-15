<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import { 查询阶段9全部, 查询账号目录, type 阶段9记录 } from "../../api/business-client.js";
import WarKpis from "../../components/war/WarKpis.vue";
import WarLayout from "../../components/war/WarLayout.vue";
import WarRecordCard from "../../components/war/WarRecordCard.vue";
import { 是内部管理员 } from "../../shared/permission/role.js";
import { use外壳前缀 } from "../../shared/navigation/shell-prefix.js";
import { useSessionStore } from "../../stores/session.js";
import QuoteProfitPanel from "../quote/QuoteProfitPanel.vue";
import type { 指标项 } from "../../components/war/types.js";
import {
  金额文本,
  取数,
  订单状态文本,
  日期文本,
  日期时间文本,
  文本,
  文本或,
} from "../../shared/format/business-format.js";

const 路由器 = useRouter();
const 外壳前缀 = use外壳前缀();
const 会话 = useSessionStore();
const 加载中 = ref(false);
const 错误 = ref("");
const 订单列表 = ref<阶段9记录[]>([]);
const 选中编号 = ref("");
const 当前标签 = ref("全部");
const 搜索词 = ref("");
const 选中区域 = ref("全部区域");

const 标签列表 = ["全部", "待我处理", "已完成"];

function 原始(row: 阶段9记录 | null | undefined): Record<string, unknown> {
  return (row?.原始数据 as Record<string, unknown>) || {};
}

function 字段(row: 阶段9记录 | null | undefined, ...键列表: string[]): string {
  const 数据 = 原始(row);
  return 文本(...键列表.map((键) => 数据[键]), ...键列表.map((键) => (row as never)?.[键]));
}

function 明细(row: 阶段9记录 | null | undefined): Array<Record<string, unknown>> {
  const 项 = 原始(row).items;
  return Array.isArray(项) ? (项 as Array<Record<string, unknown>>) : [];
}

function 历史(row: 阶段9记录 | null | undefined): Array<Record<string, unknown>> {
  const 项 = 原始(row).statusHistory;
  return Array.isArray(项) ? (项 as Array<Record<string, unknown>>) : [];
}

function 状态码(row: 阶段9记录 | null | undefined): string {
  return 文本(row?.状态, 字段(row, "status"));
}

/** 区管确认后订单号会切换为正式编号，前置编号用于全链路追溯。 */
function 前置编号(row: 阶段9记录 | null | undefined): string {
  return 文本(字段(row, "preRegionOrderNo", "pre_region_order_no"));
}

function 状态色调(row: 阶段9记录 | null | undefined): "blue" | "green" | "amber" | "red" | "gray" {
  const 代码 = 状态码(row);
  if (["completed", "confirmed"].includes(代码)) return "green";
  if (代码.startsWith("returned") || 代码 === "cancelled") return "red";
  if (["pending", "pending_primary_confirm", "region_pending", "primary_confirmed", "pending_superadmin_confirm"].includes(代码))
    return "amber";
  return "gray";
}

const 待处理状态 = new Set([
  "pending",
  "pending_primary_confirm",
  "region_pending",
  "primary_confirmed",
  "pending_superadmin_confirm",
]);

const 区域选项 = computed(() =>
  [...new Set(订单列表.value.map((row: 阶段9记录) => 文本(row.区域)).filter(Boolean))].sort(),
);

const 过滤后列表 = computed(() => {
  let 列表 = 订单列表.value;
  if (当前标签.value === "待我处理") 列表 = 列表.filter((row) => 待处理状态.has(状态码(row)));
  if (当前标签.value === "已完成") 列表 = 列表.filter((row) => ["completed", "confirmed"].includes(状态码(row)));
  if (选中区域.value && 选中区域.value !== "全部区域")
    列表 = 列表.filter((row) => 文本(row.区域) === 选中区域.value);
  const 关键词 = 搜索词.value.trim().toLowerCase();
  if (!关键词) return 列表;
  return 列表.filter((row) =>
    [
      row.编号,
      row.客户名称,
      row.渠道名称,
      row.负责人,
      row.区域,
      字段(row, "quoteNo", "quoteId"),
      字段(row, "preRegionOrderNo", "pre_region_order_no"),
    ]
      .filter(Boolean)
      .some((值) => String(值).toLowerCase().includes(关键词)),
  );
});

const 当前订单 = computed(
  () => 订单列表.value.find((row) => row.id === 选中编号.value) || 过滤后列表.value[0] || null,
);

/** 内部收益核算与区域审批信息只对内部管理员（超管 / 区管）展示，渠道端不返回内部字段。 */
const 内部管理员 = computed(() => 是内部管理员(会话.user));
/** 用户名 → 姓名映射；未命中时回退展示用户名，保证信息不丢。 */
const 账号名称 = ref<Record<string, string>>({});

/** 订单里的区管、提报人等字段存的是登录账号，展示时统一转成姓名。 */
function 姓名(值: string): string {
  const 原始 = String(值 || "").trim();
  if (!原始) return "";
  return 账号名称.value[原始] || 原始;
}

/** 订单明细合计（总价），与订单处理页同口径按行小计求和。 */
const 明细合计 = computed(() =>
  明细(当前订单.value).reduce((合计, 项) => 合计 + Number(取数(项.小计, 项.lineAmount) || 0), 0),
);

async function 加载账号目录() {
  // 渠道端订单详情同样会出现提报人账号，账号目录对渠道账号可读，两端统一转姓名。
  if (Object.keys(账号名称.value).length) return;
  try {
    const 目录 = await 查询账号目录();
    账号名称.value = Object.fromEntries(目录.map((项) => [项.username, 项.name]));
  } catch {
    // 账号目录读取失败时回退显示用户名，不影响订单主数据显示。
  }
}
/** 收益核算挂在来源报价单上，优先取 quoteId，与订单处理页口径一致。 */
const 报价编号 = computed(() =>
  字段(当前订单.value, "quoteId", "quoteNo", "报价编号"),
);

/** 订单产品类型：按明细 productRefType 去重后合成（软件 / 硬件 / 手工服务）。 */
const 产品类型文本 = computed(() => {
  const 映射: Record<string, string> = { feature: "软件", hardware: "硬件", manual: "手工/服务" };
  const 类型列表 = [
    ...new Set(
      明细(当前订单.value)
        .map((项) => 文本(项.productRefType, 项.product_ref_type))
        .filter(Boolean),
    ),
  ].map((值) => 映射[值] || 值);
  // 历史订单（V2 结转）明细没有 productRefType，展示“未标注”比空横杠更明确。
  return 类型列表.length ? 类型列表.join(" + ") : "未标注";
});

/** 分销层级：当前签约渠道伙伴的分销层级（一级分销 / 二级分销）。 */
const 分销层级文本 = computed(() => {
  const 值 = 字段(当前订单.value, "partnerLevel", "submittedPartnerLevel");
  const 映射: Record<string, string> = { primary: "一级分销", secondary: "二级分销", none: "无分销层级" };
  return 映射[值] || "未设置";
});

const 动态 = computed(() => {
  const 记录 = 当前订单.value;
  if (!记录) return [];
  const 时间 = 文本(记录.更新时间, 记录.创建时间);
  return ['订单状态已流转', '审批历史已记录', '报价快照已关联']
    .map((标题, 序号) => ({ 标题, 时间: 序号 === 0 ? 日期文本(时间) : "", 说明: "来自当前记录真实数据" }))
    .filter((项) => 项.时间 || 项.说明);
});

const 指标 = computed<指标项[]>(() => {
  const 列表 = 订单列表.value;
  const 计数 = (状态集合: string[]) =>
    列表.filter((row) => 状态集合.includes(状态码(row))).length;
  return [
    { label: "订单总数", value: String(列表.length), unit: "笔", note: "当前数据范围内订单" },
    {
      label: "待一级确认",
      value: String(计数(["pending", "pending_primary_confirm"])),
      unit: "笔",
      note: "等待一级渠道确认",
    },
    {
      label: "待区管确认",
      value: String(计数(["region_pending", "primary_confirmed"])),
      unit: "笔",
      note: "一级已确认，等待区管确认",
    },
    {
      label: "待超管确认",
      value: String(计数(["pending_superadmin_confirm"])),
      unit: "笔",
      note: "等待超级管理员确认",
    },
    { label: "已确认", value: String(计数(["confirmed"])), unit: "笔", note: "审批已通过" },
    {
      label: "已完成 / 已退回 / 取消",
      value: `${计数(["completed"])} / ${计数([
        "returned_to_primary",
        "returned_to_secondary",
        "returned_to_region",
      ])} / ${计数(["cancelled"])}`,
      unit: "笔",
      note: "终态汇总：完成、退回原渠道、取消",
    },
  ];
});

onMounted(() => {
  void 加载();
  void 加载账号目录();
});

async function 加载() {
  加载中.value = true;
  错误.value = "";
  try {
    const 结果 = await 查询阶段9全部("orders");
    订单列表.value = 结果.数据;
    选中编号.value = 订单列表.value[0]?.id || "";
  } catch (异常) {
    错误.value = 异常 instanceof Error ? 异常.message : "订单数据加载失败。";
  } finally {
    加载中.value = false;
  }
}

function 打开处理(row: 阶段9记录) {
  // 管理端与渠道端共用本页；订单处理页分别挂在 /admin 与 /partner 下，跳转必须跟随当前外壳，
  // 否则一级渠道商点开会落到无权访问的 /admin 路由，无法确认二级渠道商订单。
  路由器.push(`${外壳前缀.value}/order/${row.id}/actions`);
}
</script>

<template>
  <div class="vui war-artboard 订单中心页">
    <WarKpis :items="指标" />

    <WarLayout
      list-title="订单列表"
      :list-count="String(过滤后列表.length)"
      search-placeholder="搜索订单编号、客户、渠道商或报价单"
      :tabs="标签列表"
      :active-tab="当前标签"
      v-model="搜索词"
      :步骤="['待一级确认', '区管确认', '超管确认', '已确认', '履约交付']"
      :当前步骤="1"
      :动态="动态"
      :区域列表="区域选项"
      :选中区域="选中区域"
      @update:选中区域="选中区域 = $event"
      @切换标签="当前标签 = $event"
    >
      <template #list>
        <div v-if="加载中" class="war-empty">正在加载订单数据…</div>
        <div v-else-if="错误" class="war-empty">{{ 错误 }}</div>
        <WarRecordCard
          v-for="row in 过滤后列表"
          :key="row.id"
          :title="文本或([row.客户名称, row.标题], '未命名订单')"
          :meta="[
            文本(row.编号, '无编号'),
            文本(row.渠道名称, '未归属渠道'),
            文本(row.区域, '未填写区域'),
          ].join(' · ')"
          :badge="订单状态文本(状态码(row), row.状态名称)"
          :tone="状态色调(row)"
          :owner="`负责人：${文本(row.负责人, '未指派')}`"
          :amount="金额文本(row.金额)"
          :tags="[
            { text: 字段(row, 'quoteNo', 'quoteId') ? '已关联报价' : '无报价' },
            {
              text: 待处理状态.has(状态码(row)) ? '待审批处理' : `更新 ${日期文本(row.更新时间)}`,
              hot: 待处理状态.has(状态码(row)),
            },
          ]"
          :active="当前订单?.id === row.id"
          @选择="选中编号 = row.id"
        />
        <div v-if="!加载中 && !错误 && !过滤后列表.length" class="war-empty">
          当前筛选条件下没有订单记录。
        </div>
      </template>

      <template #center>
        <template v-if="当前订单">
          <div class="war-center-head">
            <div class="deal-title">
              <strong>{{ 文本或([当前订单.客户名称, 当前订单.标题], "未命名订单") }}</strong>
              <span>
                {{ 文本(当前订单.编号, "无编号") }} · {{ 文本(当前订单.渠道名称, "未归属渠道") }} ·
                {{ 文本(当前订单.区域, "未填写区域") }} · 来源报价：{{
                  文本(字段(当前订单, "quoteNo", "quoteId"), "无")
                }}
              </span>
            </div>
            <div class="center-actions">
              <button type="button" class="button primary" @click="打开处理(当前订单)">
                订单处理
              </button>
            </div>
          </div>

          <div class="extended-center-grid">
            <section class="panel">
              <header class="panel-head">
                <div>
                  <h2>订单信息</h2>
                  <p>订单主档、区域归属与交付联系信息</p>
                </div>
              </header>
              <div class="panel-body">
                <div class="info-grid">
                  <div class="info-item">
                    <span>订单编号</span><strong>{{ 文本(当前订单.编号, "—") }}</strong>
                  </div>
                  <div class="info-item">
                    <span>前置订单编号</span>
                    <strong>{{ 前置编号(当前订单) || "—" }}</strong>
                  </div>
                  <div class="info-item">
                    <span>订单状态</span>
                    <strong>{{ 订单状态文本(状态码(当前订单), 当前订单.状态名称) }}</strong>
                  </div>
                  <div class="info-item">
                    <span>订单金额</span><strong>{{ 金额文本(当前订单.金额) }}</strong>
                  </div>
                  <div class="info-item">
                    <span>所属区域</span>
                    <strong>{{ 文本(当前订单.区域, "未填写") }}</strong>
                  </div>
                  <div class="info-item">
                    <span>提交区域</span>
                    <strong>{{ 文本(字段(当前订单, "submittedByRegion"), "—") }}</strong>
                  </div>
                  <div v-if="内部管理员" class="info-item">
                    <span>负责区管</span>
                    <strong>{{
                      姓名(字段(当前订单, "regionConfirmedByUsername")) || "未确认"
                    }}</strong>
                  </div>
                  <div v-if="内部管理员" class="info-item">
                    <span>审批轮次</span>
                    <strong>第 {{ 文本(字段(当前订单, "approvalRound"), "1") }} 轮</strong>
                  </div>
                  <div class="info-item">
                    <span>收货地址</span>
                    <strong>{{ 文本(字段(当前订单, "deliveryAddr"), "未填写") }}</strong>
                  </div>
                  <div class="info-item">
                    <span>联系人</span>
                    <strong>{{ 文本(字段(当前订单, "contacts"), "未填写") }}</strong>
                  </div>
                  <div class="info-item">
                    <span>创建时间</span>
                    <strong>{{ 日期时间文本(当前订单.创建时间) }}</strong>
                  </div>
                  <div class="info-item">
                    <span>最近更新</span>
                    <strong>{{ 日期时间文本(当前订单.更新时间) }}</strong>
                  </div>
                </div>
              </div>
            </section>

            <section class="panel 明细面板">
              <header class="panel-head">
                <div>
                  <h2>订单明细</h2>
                  <p>
                    共 {{ 明细(当前订单).length }} 个模块/硬件项 · 订单产品类型：{{ 产品类型文本 }}
                  </p>
                </div>
              </header>
              <div class="panel-body flush 明细面板体">
                <table class="vui-table">
                  <thead>
                    <tr>
                      <th>模块 / 产品</th>
                      <th>数量</th>
                      <th>单价</th>
                      <th>小计</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(项, 序号) in 明细(当前订单)" :key="序号">
                      <td>{{ 文本(取数(项.名称, 项.itemName, 项.name), "未命名项") }}</td>
                      <td>{{ 文本(取数(项.数量, 项.quantity), "—") }}</td>
                      <td>{{ 金额文本(取数(项.单价, 项.unitPrice)) }}</td>
                      <td>{{ 金额文本(取数(项.小计, 项.lineAmount)) }}</td>
                    </tr>
                    <tr v-if="!明细(当前订单).length">
                      <td colspan="4" class="war-empty">该订单没有明细记录。</td>
                    </tr>
                  </tbody>
                </table>
                <div v-if="明细(当前订单).length" class="明细合计条">
                  <span>明细合计（总价）</span>
                  <strong>{{ 金额文本(明细合计) }}</strong>
                </div>
              </div>
            </section>

            <section class="panel" :class="{ 面板全宽: !内部管理员 }">
              <header class="panel-head">
                <div>
                  <h2>合作伙伴与签单</h2>
                  <p>伙伴分销层级、签单提报人员与关联单据</p>
                </div>
              </header>
              <div class="panel-body">
                <div class="info-grid">
                  <div class="info-item">
                    <span>合作伙伴</span>
                    <strong>{{
                      文本(当前订单.渠道名称, 字段(当前订单, "partnerName"), "未归属")
                    }}</strong>
                  </div>
                  <div class="info-item">
                    <span>渠道层级</span><strong>{{ 分销层级文本 }}</strong>
                  </div>
                  <div class="info-item">
                    <span>上级一级渠道</span>
                    <strong>{{ 文本(字段(当前订单, "parentPartnerName"), "—") }}</strong>
                  </div>
                  <div class="info-item">
                    <span>签单人员</span>
                    <strong>{{ 文本(字段(当前订单, "assignedStaffName"), "未指派") }}</strong>
                  </div>
                  <div class="info-item">
                    <span>提报人</span>
                    <strong>{{
                      姓名(字段(当前订单, "createdByName", "submittedByUsername")) || "—"
                    }}</strong>
                  </div>
                  <div class="info-item">
                    <span>订单产品类型</span><strong>{{ 产品类型文本 }}</strong>
                  </div>
                  <div class="info-item">
                    <span>关联报价单</span>
                    <strong>{{ 文本(字段(当前订单, "quoteNo", "quoteId"), "—") }}</strong>
                  </div>
                  <div class="info-item">
                    <span>关联商机</span>
                    <strong>{{ 文本(字段(当前订单, "opportunityNo", "oppId"), "—") }}</strong>
                  </div>
                  <div class="info-item">
                    <span>合同编号</span>
                    <strong>{{ 文本(字段(当前订单, "agreementNo"), "—") }}</strong>
                  </div>
                  <div class="info-item">
                    <span>报备编号</span>
                    <strong>{{ 文本(字段(当前订单, "registrationNo"), "—") }}</strong>
                  </div>
                </div>
              </div>
            </section>

            <QuoteProfitPanel
              v-if="内部管理员 && 报价编号"
              :quote-id="报价编号"
            />
          </div>
        </template>
        <div v-else class="war-empty">请选择左侧订单查看详情。</div>
      </template>

      <template #right>
        <article v-if="当前订单" class="right-card highlight">
          <div class="right-card-title"><strong>实时快照</strong><span>订单</span></div>
          <div class="info-grid">
            <div class="info-item">
              <span>订单状态</span>
              <strong>{{ 订单状态文本(状态码(当前订单), 当前订单.状态名称) }}</strong>
            </div>
            <div class="info-item">
              <span>订单金额</span><strong>{{ 金额文本(当前订单.金额) }}</strong>
            </div>
            <div class="info-item">
              <span>明细项</span><strong>{{ 明细(当前订单).length }} 项</strong>
            </div>
            <div class="info-item">
              <span>负责人</span><strong>{{ 文本(当前订单.负责人, "未指派") }}</strong>
            </div>
          </div>
        </article>

        <article v-if="当前订单" class="right-card">
          <div class="right-card-title">
            <strong>审批历史</strong><span>{{ 历史(当前订单).length }} 条</span>
          </div>
          <div v-if="历史(当前订单).length" class="mini-list">
            <div v-for="(项, 序号) in 历史(当前订单)" :key="序号" class="mini-item">
              <strong>{{ 订单状态文本(项.to) }}</strong>
              <span>
                {{ 文本(项.operatorName, "系统") }} · {{ 日期时间文本(项.timestamp) }} ·
                {{ 文本(项.remark, "无备注") }}
              </span>
            </div>
          </div>
          <p v-else class="war-note">该订单暂无状态流转记录。</p>
        </article>
      </template>
    </WarLayout>
  </div>
</template>

<style scoped>
.订单中心页 {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 12px;
  min-height: calc(100vh - 96px);
  padding: 14px 18px 18px;
}

.订单中心页 :deep(.war-kpis) {
  position: static;
  inset: auto;
  height: auto;
}

.订单中心页 :deep(.war-layout) {
  position: static;
  inset: auto;
  min-height: 620px;
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
  background: #f8fbff;
}

.订单中心页 :deep(.war-list-body) {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.订单中心页 :deep(.war-search input) {
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

/* 渠道端没有内部收益核算面板，合作伙伴与签单跨满整行，避免第二行留下半格空白。 */
.面板全宽 {
  grid-column: 1 / -1;
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

/* 明细合计（总价）行需要与普通明细行区分，避免用户漏看总价。 */
.vui-table tfoot td {
  border-bottom: 0;
  background: #f4f8ff;
  font-weight: 700;
  color: var(--text);
}

/* 订单明细面板与同排面板等高时，总价固定在方框内最下方，不再悬在空白中间。 */
.明细面板 {
  display: flex;
  flex-direction: column;
}
.明细面板体 {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
}
.明细合计条 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
  padding: 10px 13px;
  border-top: 1px solid var(--line);
  background: #f4f8ff;
  font-weight: 700;
  color: var(--text);
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
