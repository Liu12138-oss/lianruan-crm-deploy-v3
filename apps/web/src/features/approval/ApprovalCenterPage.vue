<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import { 查询阶段9全部, type 阶段9记录 } from "../../api/business-client.js";
import WarKpis from "../../components/war/WarKpis.vue";
import type { 指标项 } from "../../components/war/types.js";
import { 金额文本, 日期时间文本, 文本 } from "../../shared/format/business-format.js";

const 路由器 = useRouter();
const 加载中 = ref(false);
const 错误 = ref("");
const 审批列表 = ref<阶段9记录[]>([]);
const 当前分区 = ref<"待审批" | "已审批">("待审批");
const 当前类型 = ref("全部");
const 搜索词 = ref("");
const 展开编号 = ref("");

const 类型定义 = [
  { 键: "registration", 短名: "客户报备", 全名: "客户报备" },
  { 键: "partner", 短名: "渠道与账号", 全名: "渠道与账号" },
  { 键: "quote", 短名: "报价", 全名: "报价审核" },
  { 键: "order", 短名: "订单", 全名: "订单审批" },
];

function 原始(row: 阶段9记录 | null | undefined): Record<string, unknown> {
  return (row?.原始数据 as Record<string, unknown>) || {};
}

function 字段(row: 阶段9记录 | null | undefined, ...键列表: string[]): string {
  const 数据 = 原始(row);
  return 文本(...键列表.map((键) => 数据[键]), ...键列表.map((键) => (row as never)?.[键]));
}

/**
 * 审批类型判定：订单 / 渠道 / 报价类审批带 `type`，
 * 客户报备类审批只有 `targetType`，账号类审批的 `type` 为 staff / partner_admin。
 */
function 类型代码(row: 阶段9记录 | null | undefined): string {
  const 原始类型 = 字段(row, "type");
  const 代码 = 原始类型 || 字段(row, "targetType");
  if (代码 === "staff" || 代码 === "user" || 代码 === "partner_admin") return "partner";
  return 代码;
}

function 类型文本(row: 阶段9记录 | null | undefined): string {
  const 代码 = 类型代码(row);
  return 类型定义.find((项) => 项.键 === 代码)?.全名 || (代码 ? 代码 : "其他审批");
}

function 状态代码(row: 阶段9记录 | null | undefined): string {
  return 文本(row?.状态, 字段(row, "status"));
}

/**
 * 列表行键：优先取审批记录自身编号（approvalId）。
 * 同一订单/报备可能有多级审批记录，target_id 会重复，不能直接作为行键。
 */
function 行键(row: 阶段9记录): string {
  return 文本(字段(row, "approvalId")) || row.id;
}

function 状态文本(row: 阶段9记录 | null | undefined): string {
  const 代码 = 状态代码(row);
  // V2 迁移的渠道商与账号审批以 active 表示「已通过」，与老 UI 展示口径一致。
  if (代码 === "active") return "已通过";
  const 名称 = 文本(row?.状态名称);
  if (名称) return 名称;
  const 映射: Record<string, string> = { pending: "待处理", approved: "已通过", rejected: "已驳回", cancelled: "已取消" };
  return 映射[代码] || 代码 || "未知状态";
}

function 状态色调(row: 阶段9记录 | null | undefined): string {
  const 代码 = 状态代码(row);
  if (代码 === "approved" || 代码 === "active") return "green";
  if (代码 === "rejected" || 代码 === "cancelled") return "red";
  if (代码 === "pending") return "amber";
  return "gray";
}

function 相对时间(文本值: string): string {
  const 时间 = new Date(文本值);
  if (Number.isNaN(时间.getTime())) return "—";
  const 分钟 = Math.floor((Date.now() - 时间.getTime()) / 60000);
  if (分钟 < 1) return "刚刚";
  if (分钟 < 60) return `${分钟} 分钟前`;
  if (分钟 < 1440) return `${Math.floor(分钟 / 60)} 小时前`;
  return `${Math.floor(分钟 / 1440)} 天前`;
}

function 时效(row: 阶段9记录): string {
  return 相对时间(文本(row.创建时间, 字段(row, "createdAt")));
}

function 处理路径(row: 阶段9记录 | null | undefined): string {
  const 目标 = 字段(row, "targetId");
  const 类型 = 类型代码(row);
  if (!目标) return "/admin/admin-review";
  if (类型 === "order") return `/admin/order/${目标}/actions`;
  if (类型 === "registration") return `/admin/registration/${目标}/followup`;
  return "/admin/admin-review";
}

const 待处理列表 = computed(() => 审批列表.value.filter((row) => 状态代码(row) === "pending"));

/** 已审批留存：状态离开待处理（pending）的审批记录，含 V2 迁移的 active（已通过）。 */
const 已处理列表 = computed(() =>
  审批列表.value.filter((row) => {
    const 代码 = 状态代码(row);
    return 代码 !== "" && 代码 !== "pending";
  }),
);

/** 当前分区对应的基础列表；类型筛选与搜索都基于它。 */
const 分区列表 = computed(() => (当前分区.value === "待审批" ? 待处理列表.value : 已处理列表.value));

const 过滤后列表 = computed(() => {
  let 列表 = 分区列表.value;
  if (当前类型.value !== "全部") 列表 = 列表.filter((row) => 类型代码(row) === 当前类型.value);
  const 关键词 = 搜索词.value.trim().toLowerCase();
  if (!关键词) return 列表;
  return 列表.filter((row) =>
    [
      字段(row, "targetName"),
      字段(row, "targetNo"),
      字段(row, "stepName"),
      字段(row, "reason"),
      字段(row, "createdBy"),
      row.客户名称,
      行渠道名称(row),
      类型文本(row),
    ]
      .filter(Boolean)
      .some((值) => String(值).toLowerCase().includes(关键词)),
  );
});

function 行渠道名称(row: 阶段9记录): string {
  return 文本(行渠道(row), 字段(row, "customerName"), row.客户名称);
}

function 行渠道(row: 阶段9记录): string {
  return 文本(字段(row, "targetPartnerName", "parentPartnerName"), row.渠道名称);
}

const 指标 = computed<指标项[]>(() => {
  const 计数 = (键: string) => 待处理列表.value.filter((row) => 类型代码(row) === 键).length;
  const 今日已完成 = 审批列表.value.filter((row) => {
    const 已批 = 文本(字段(row, "approvedAt"));
    if (状态代码(row) !== "approved") return false;
    const 时间 = new Date(已批 || row.更新时间);
    return !Number.isNaN(时间.getTime()) && 时间.toDateString() === new Date().toDateString();
  }).length;
  return [
    { label: "待处理总数", value: String(待处理列表.value.length), unit: "项", note: "状态为待处理的审批" },
    { label: "客户报备", value: String(计数("registration")), unit: "项", note: "客户报备审核" },
    { label: "渠道与账号", value: String(计数("partner")), unit: "项", note: "渠道与账号审批" },
    { label: "报价审核", value: String(计数("quote")), unit: "项", note: "报价审核" },
    { label: "订单审批", value: String(计数("order")), unit: "项", note: "一级 / 区管 / 超管确认" },
    { label: "今日已完成", value: String(今日已完成), unit: "项", note: "今日审批通过数" },
  ];
});

onMounted(() => void 加载());

async function 加载() {
  加载中.value = true;
  错误.value = "";
  try {
    const 结果 = await 查询阶段9全部("approvals");
    审批列表.value = 结果.数据;
  } catch (异常) {
    错误.value = 异常 instanceof Error ? 异常.message : "审批数据加载失败。";
  } finally {
    加载中.value = false;
  }
}

function 类型计数(键: string): number {
  return 分区列表.value.filter((row) => 类型代码(row) === 键).length;
}

function 切换分区(分区: "待审批" | "已审批") {
  当前分区.value = 分区;
  展开编号.value = "";
  当前类型.value = "全部";
}

function 切换展开(row: 阶段9记录) {
  展开编号.value = 展开编号.value === 行键(row) ? "" : 行键(row);
}
</script>

<template>
  <div class="vui war-artboard war-artboard-flow 审核页">
    <WarKpis :items="指标" />

    <section class="panel">
      <header class="panel-head">
        <div>
          <h2>审批任务</h2>
          <p>所有审批均保留业务上下文和状态变化记录。</p>
        </div>
        <div class="tabs" role="tablist" aria-label="审批分区">
          <button
            type="button"
            class="tab"
            role="tab"
            :aria-selected="当前分区 === '待审批'"
            :class="{ active: 当前分区 === '待审批' }"
            @click="切换分区('待审批')"
          >
            待审批 {{ 待处理列表.length }}
          </button>
          <button
            type="button"
            class="tab"
            role="tab"
            :aria-selected="当前分区 === '已审批'"
            :class="{ active: 当前分区 === '已审批' }"
            @click="切换分区('已审批')"
          >
            已审批 {{ 已处理列表.length }}
          </button>
        </div>
      </header>
      <div class="panel-body flush">
        <div class="toolbar">
          <div class="filters">
            <div class="segmented">
              <button
                type="button"
                class="segment"
                :class="{ active: 当前类型 === '全部' }"
                @click="当前类型 = '全部'"
              >
                全部 {{ 分区列表.length }}
              </button>
              <button
                v-for="项 in 类型定义"
                :key="项.键"
                type="button"
                class="segment"
                :class="{ active: 当前类型 === 项.键 }"
                @click="当前类型 = 项.键"
              >
                {{ 项.短名 }} {{ 类型计数(项.键) }}
              </button>
            </div>
            <div class="field search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
                      <input v-model="搜索词" placeholder="搜索业务对象、申请人或单号" />
            </div>
          </div>
        </div>

        <div v-if="加载中" class="war-empty">正在加载审批任务…</div>
        <div v-else-if="错误" class="war-empty">{{ 错误 }}</div>
        <div v-else class="table-wrap">
          <table class="data-table 审批表">
            <thead>
              <tr>
                <th>审批类型</th>
                <th>业务对象</th>
                <th>渠道 / 客户</th>
                <th>申请人</th>
                <th>时效</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="审批 in 过滤后列表" :key="行键(审批)">
                <tr @click="切换展开(审批)">
                  <td>{{ 类型文本(审批) }}</td>
                  <td>
                    <span class="record-title">
                      {{ 文本(字段(审批, "targetName"), 审批.标题, "—") }}
                    </span>
                  </td>
                  <td>{{ 文本(行渠道名称(审批), "—") }}</td>
                  <td>{{ 文本(字段(审批, "createdBy"), 审批.负责人, "—") }}</td>
                  <td>{{ 时效(审批) }}</td>
                  <td><span class="status" :class="状态色调(审批)">{{ 状态文本(审批) }}</span></td>
                  <td>
                    <span class="table-actions">
                      <button
                        type="button"
                        class="link"
                        @click.stop="路由器.push(处理路径(审批))"
                      >
                        {{ 当前分区 === "待审批" ? "处理" : "查看业务" }}
                      </button>
                      <button type="button" class="link" @click.stop="切换展开(审批)">
                        {{ 展开编号 === 行键(审批) ? "收起" : "查看" }}
                      </button>
                    </span>
                  </td>
                </tr>
                <tr v-if="展开编号 === 行键(审批)" :key="`${行键(审批)}-详情`" class="审批详情行">
                  <td colspan="7">
                    <div class="grid-2 审批详情网格">
                      <div>
                        <h3>审批信息</h3>
                        <div class="info-grid">
                          <div class="info-item"><span>审批步骤</span><strong>{{ 文本(字段(审批, "stepName"), "—") }}</strong></div>
                          <div class="info-item"><span>对象编号</span><strong>{{ 文本(字段(审批, "targetNo"), "—") }}</strong></div>
                          <div class="info-item"><span>金额</span><strong>{{ 金额文本(字段(审批, "amount", "total")) }}</strong></div>
                          <div class="info-item"><span>所属区域</span><strong>{{ 文本(字段(审批, "region"), 审批.区域, "未填写") }}</strong></div>
                          <div class="info-item"><span>提交时间</span><strong>{{ 日期时间文本(审批.创建时间) }}</strong></div>
                          <div class="info-item"><span>更新时间</span><strong>{{ 日期时间文本(审批.更新时间) }}</strong></div>
                        </div>
                      </div>
                      <div>
                        <h3>审批说明</h3>
                        <p class="war-note">{{ 文本(字段(审批, "reason"), "无审批说明。") }}</p>
                        <p class="war-note">
                          审批动作在业务页面完成：订单审批进入「订单处理」，客户报备审核进入「客户跟进」。
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
              <tr v-if="!过滤后列表.length">
                <td colspan="7" class="war-empty">
                  {{ 当前分区 === "待审批" ? "没有符合条件的待审批任务。" : "没有符合条件的已审批记录。" }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.审批表 tbody tr {
  cursor: pointer;
}

.审批详情行 {
  cursor: default;
}

.审批详情行 td {
  padding: 12px 13px;
  background: #f8fbff;
}

.审批详情网格 h3 {
  margin: 0 0 8px;
  font-size: 11px;
}

.审批详情网格 .war-note {
  margin: 0 0 8px;
  color: var(--text-3);
  font-size: 11px;
  line-height: 1.6;
}

.war-empty {
  display: grid;
  place-items: center;
  min-height: 80px;
  padding: 16px;
  color: var(--text-3);
  font-size: 11px;
}
</style>
