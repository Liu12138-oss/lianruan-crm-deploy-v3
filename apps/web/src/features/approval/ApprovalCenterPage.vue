<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import { 更新待审批事项, 查询阶段9全部, type 阶段9记录 } from "../../api/business-client.js";
import type { 指标项 } from "../../components/war/types.js";
import WarKpis from "../../components/war/WarKpis.vue";
import { 文本, 日期时间文本, 金额文本 } from "../../shared/format/business-format.js";
import { 清除富文本标签 } from "../../shared/format/plain-text.js";
import { 是区域管理员, 是超级管理员 } from "../../shared/permission/role.js";
import { useSessionStore } from "../../stores/session.js";

const 属性 = defineProps<{
  限定渠道资质?: boolean;
  页面标题?: string;
  页面说明?: string;
}>();
const 路由器 = useRouter();
const 会话 = useSessionStore();
const 加载中 = ref(false);
const 错误 = ref("");
const 审批列表 = ref<阶段9记录[]>([]);
const 当前分区 = ref<"待审批" | "已审批">("待审批");
const 当前类型 = ref("全部");
const 搜索词 = ref("");
const 展开编号 = ref("");
const 审批提交中 = ref(false);
const 驳回弹窗打开 = ref(false);
const 驳回目标 = ref<阶段9记录 | null>(null);
const 驳回原因 = ref("");

const 类型定义 = [
  { 键: "registration", 短名: "客户报备", 全名: "客户报备" },
  { 键: "partner", 短名: "渠道与账号", 全名: "渠道与账号" },
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

/** 审批记录编号与业务目标编号都可作为定位入口，二者必须指向同一条审批详情。 */
function 审批记录编号(row: 阶段9记录): string {
  return 文本(字段(row, "approvalId"), row.id);
}

function 业务目标编号(row: 阶段9记录): string {
  return 文本(字段(row, "targetNo", "targetId"));
}

function 状态文本(row: 阶段9记录 | null | undefined): string {
  const 代码 = 状态代码(row);
  const 映射: Record<string, string> = {
    pending: "待处理",
    approved: "已通过",
    rejected: "已驳回",
    cancelled: "已取消",
    active: "已通过",
  };
  // V2 迁移的渠道商与账号审批以 active 表示「已通过」，与老 UI 展示口径一致。
  if (代码 === "active") return "已通过";
  // 账号审批待办必须展示当前审批阶段，不能只显示笼统的「待审核 / 待审批」。
  if (代码 === "pending" && 是账号审批(row)) {
    const 阶段名称 = 文本(字段(row, "approvalStageName", "stepName"));
    if (阶段名称) return 阶段名称;
    return 审批阶段(row) === "region_review" ? "待区管初审" : "待超管终审";
  }
  // 状态枚举是唯一可信来源；历史数据的状态名称可能仍是“待审核”，不能覆盖 cancelled。
  const 映射文本 = 映射[代码];
  if (映射文本) return 映射文本;
  const 名称 = 文本(row?.状态名称);
  if (名称) return 名称;
  return 代码 || "未知状态";
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

/**
 * 审批说明：驳回 / 通过原因在审批记录上以 reviewRemark 落库（报备审核链路），
 * 订单类审批历史上写 reason，这里按新键优先、旧键兜底取值。
 */
function 审批说明(row: 阶段9记录 | null | undefined): string {
  return 清除富文本标签(
    文本(字段(row, "reviewRemark", "reason", "remark", "审核意见"), "无审批说明。"),
  );
}

function 是审批终态(row: 阶段9记录 | null | undefined): boolean {
  return ["approved", "active", "rejected", "cancelled"].includes(状态代码(row));
}

/** 审批完成后优先展示最后处理人；历史数据只有 updatedByName，不能继续显示“待审批”。 */
function 最终审批人(row: 阶段9记录 | null | undefined): string {
  if (!是审批终态(row)) return "待审批";
  const 明确审批人 = 文本(字段(row, "approvedBy", "reviewedByName", "updatedByName"));
  if (明确审批人) return 明确审批人;
  const 历史 = 审批历史(row);
  return 文本(历史.at(-1)?.actorName, "系统");
}

/** 审批时间与审批人使用同一口径，避免状态已通过但时间仍显示待审批。 */
function 最终审批时间(row: 阶段9记录 | null | undefined): string {
  if (!是审批终态(row)) return "待审批";
  const 明确时间 = 文本(字段(row, "approvedAt", "reviewedAt"));
  if (明确时间) return 日期时间文本(明确时间);
  const 更新时间 = 文本(row?.更新时间, 字段(row, "updatedAt"));
  if (更新时间) return 日期时间文本(更新时间);
  const 历史 = 审批历史(row);
  return 文本(历史.at(-1)?.createdAt) ? 日期时间文本(文本(历史.at(-1)?.createdAt)) : "—";
}

interface 审批历史项 {
  eventCode: string;
  fromStatus: string;
  toStatus: string;
  reason: string;
  actorName: string;
  createdAt: string;
}

/** 审批历史来自审批事件表，保留驳回、重提、通过等全部过程，不能被当前审批状态覆盖。 */
function 审批历史(row: 阶段9记录 | null | undefined): 审批历史项[] {
  const 历史 = 原始(row).approvalHistory;
  if (!Array.isArray(历史)) return [];
  return 历史
    .filter((项): 项 is Record<string, unknown> => Boolean(项) && typeof 项 === "object")
    .map((项) => ({
      eventCode: 文本(项.eventCode),
      fromStatus: 文本(项.fromStatus),
      toStatus: 文本(项.toStatus),
      reason: 文本(项.reason),
      actorName: 文本(项.actorName, "系统"),
      createdAt: 文本(项.createdAt),
    }))
    .filter((项) => Boolean(项.eventCode || 项.reason || 项.createdAt));
}

function 审批事件名称(代码: string): string {
  return (
    {
      submit: "提交审核",
      approve: "审核通过",
      reject: "审核驳回",
      cancel: "取消审批",
      update: "更新审批",
      region_approve: "区管初审通过",
    }[代码] || "审批更新"
  );
}

function 审批状态名称(代码: string): string {
  return (
    {
      pending: "待审核",
      approved: "已通过",
      rejected: "已驳回",
      cancelled: "已取消",
      active: "已通过",
    }[代码] || "状态更新"
  );
}

function 处理路径(row: 阶段9记录 | null | undefined): string {
  const 目标 = 字段(row, "targetId");
  const 类型 = 类型代码(row);
  if (!目标) return "/admin/admin-review";
  if (类型 === "order") return `/admin/order/${目标}/actions`;
  if (类型 === "registration") return `/admin/registration?selected=${encodeURIComponent(目标)}`;
  return "/admin/admin-review";
}

function 是渠道资质审批(row: 阶段9记录): boolean {
  const 对象类型 = 字段(row, "targetType");
  const 记录类型 = 字段(row, "type");
  return (
    对象类型 === "partner" ||
    (记录类型 === "partner" && !["staff", "user", "partner_admin"].includes(对象类型))
  );
}

function 是渠道类审批(row: 阶段9记录): boolean {
  return 类型代码(row) === "partner";
}

function 是账号审批(row: 阶段9记录 | null | undefined): boolean {
  const 对象类型 = 字段(row, "targetType");
  const 记录类型 = 字段(row, "type");
  return (
    ["user", "staff", "account"].includes(对象类型) || ["staff", "partner_admin"].includes(记录类型)
  );
}

function 审批阶段(row: 阶段9记录 | null | undefined): string {
  return 文本(字段(row, "approvalStage"));
}

function 审批步骤(row: 阶段9记录): string {
  return 文本(字段(row, "stepName", "approvalStageName"), "—");
}

/** 账号审批展示业务角色名称，不把 staff / partner_admin 等内部代码直接暴露给用户。 */
function 账号角色名称(row: 阶段9记录 | null | undefined): string {
  const 代码 = 文本(字段(row, "type", "targetType"));
  const 映射: Record<string, string> = {
    staff: "渠道员工",
    partner_admin: "渠道企业管理员",
    user: "员工账号",
    account: "员工账号",
  };
  return 映射[代码] || "员工账号";
}

/** 账号审批按阶段控制操作人：区管初审不可由超管越级，超管终审不可由区管处理。 */
function 可处理审批(row: 阶段9记录): boolean {
  if (当前分区.value !== "待审批") return false;
  if (是账号审批(row)) {
    if (审批阶段(row) === "region_review") return 是区域管理员(会话.user);
    return 是超级管理员(会话.user);
  }
  if (是渠道类审批(row)) return 是超级管理员(会话.user);
  return false;
}

function 审批按钮文案(row: 阶段9记录): string {
  if (!是账号审批(row)) return "通过";
  return 审批阶段(row) === "region_review" ? "区管初审通过" : "终审通过";
}

/** 新报价流程免审批；历史报价审批不再进入待办和已审批列表，避免形成无法处理的僵尸任务。 */
function 是已退役报价审批(row: 阶段9记录): boolean {
  return 类型代码(row) === "quote";
}

function 可渠道审批(row: 阶段9记录): boolean {
  return 可处理审批(row);
}

const 源审批列表 = computed(() => {
  const 列表 = 审批列表.value.filter((row) => !是已退役报价审批(row));
  return 属性.限定渠道资质 ? 列表.filter(是渠道资质审批) : 列表;
});

const 待处理列表 = computed(() => 源审批列表.value.filter((row) => 状态代码(row) === "pending"));

/** 已审批留存：状态离开待处理（pending）的审批记录，含 V2 迁移的 active（已通过）。 */
const 已处理列表 = computed(() =>
  源审批列表.value.filter((row) => {
    const 代码 = 状态代码(row);
    return 代码 !== "" && 代码 !== "pending";
  }),
);

/** 当前分区对应的基础列表；类型筛选与搜索都基于它。 */
const 分区列表 = computed(() =>
  当前分区.value === "待审批" ? 待处理列表.value : 已处理列表.value,
);

const 过滤后列表 = computed(() => {
  let 列表 = 分区列表.value;
  if (当前类型.value !== "全部") 列表 = 列表.filter((row) => 类型代码(row) === 当前类型.value);
  const 关键词 = 搜索词.value.trim().toLowerCase();
  if (!关键词) return 列表;
  return 列表.filter((row) =>
    [
      字段(row, "targetName"),
      字段(row, "targetNo"),
      审批记录编号(row),
      业务目标编号(row),
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
  const 今日已完成 = 源审批列表.value.filter((row) => {
    const 已批 = 文本(字段(row, "approvedAt"));
    if (状态代码(row) !== "approved") return false;
    const 时间 = new Date(已批 || row.更新时间);
    return !Number.isNaN(时间.getTime()) && 时间.toDateString() === new Date().toDateString();
  }).length;
  return [
    {
      label: "待处理总数",
      value: String(待处理列表.value.length),
      unit: "项",
      note: "状态为待处理的审批",
    },
    { label: "客户报备", value: String(计数("registration")), unit: "项", note: "客户报备审核" },
    { label: "渠道与账号", value: String(计数("partner")), unit: "项", note: "渠道与账号审批" },
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

async function 执行审批(row: 阶段9记录, action: "approve" | "reject", remark = "") {
  if (action === "reject" && !remark.trim()) {
    ElMessage.warning("请填写驳回原因。");
    return;
  }
  审批提交中.value = true;
  try {
    await 更新待审批事项(行键(row), action, remark.trim());
    ElMessage.success(action === "approve" ? "审批已通过。" : "审批已驳回。");
    驳回弹窗打开.value = false;
    驳回目标.value = null;
    驳回原因.value = "";
    await 加载();
  } catch (异常) {
    ElMessage.error(异常 instanceof Error ? 异常.message : "审批处理失败，请稍后重试。");
  } finally {
    审批提交中.value = false;
  }
}

async function 通过审批(row: 阶段9记录) {
  const 名称 = 文本(字段(row, "targetName"), row.标题, "该审批事项");
  if (!window.confirm(`确认通过“${名称}”吗？`)) return;
  await 执行审批(row, "approve", "审核通过");
}

function 打开驳回(row: 阶段9记录) {
  驳回目标.value = row;
  驳回原因.value = "";
  驳回弹窗打开.value = true;
}

async function 提交驳回() {
  if (!驳回目标.value) return;
  await 执行审批(驳回目标.value, "reject", 驳回原因.value);
}
</script>

<template>
  <div class="vui war-artboard war-artboard-flow 审核页">
    <WarKpis :items="指标" :加载中="加载中" />

    <section class="panel">
      <header class="panel-head">
        <div>
          <h2>{{ 属性.页面标题 || "审批任务" }}</h2>
          <p>{{ 属性.页面说明 || "所有审批均保留业务上下文和状态变化记录。" }}</p>
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
                    <span class="record-title">{{
                      文本(字段(审批, "targetName"), 审批.标题, "—")
                    }}</span>
                    <span class="审批编号行">
                      <button type="button" class="link" @click.stop="切换展开(审批)">
                        审批记录 {{ 审批记录编号(审批) }}
                      </button>
                      <button
                        v-if="业务目标编号(审批)"
                        type="button"
                        class="link"
                        @click.stop="切换展开(审批)"
                      >
                        业务编号 {{ 业务目标编号(审批) }}
                      </button>
                    </span>
                  </td>
                  <td>{{ 文本(行渠道名称(审批), "—") }}</td>
                  <td>{{ 文本(字段(审批, "createdBy"), 审批.负责人, "—") }}</td>
                  <td>{{ 时效(审批) }}</td>
                  <td>
                    <span class="status" :class="状态色调(审批)">{{ 状态文本(审批) }}</span>
                  </td>
                  <td>
                    <span class="table-actions">
                      <template v-if="可渠道审批(审批)">
                        <button type="button" class="link" @click.stop="通过审批(审批)">
                          {{ 审批按钮文案(审批) }}
                        </button>
                        <button type="button" class="link danger" @click.stop="打开驳回(审批)">
                          驳回
                        </button>
                      </template>
                      <button
                        v-else-if="!是渠道类审批(审批)"
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
                        <div v-if="是账号审批(审批)" class="账号审批信息">
                          <h3>账号信息</h3>
                          <div class="info-grid">
                            <div class="info-item">
                              <span>员工姓名</span>
                              <strong>{{ 文本(字段(审批, "targetName"), "未填写") }}</strong>
                            </div>
                            <div class="info-item">
                              <span>登录账号</span>
                              <strong>{{ 文本(字段(审批, "username"), "未填写") }}</strong>
                            </div>
                            <div class="info-item">
                              <span>账号类型</span>
                              <strong>{{ 账号角色名称(审批) }}</strong>
                            </div>
                            <div class="info-item">
                              <span>岗位</span>
                              <strong>{{ 文本(字段(审批, "staffRole"), "未填写") }}</strong>
                            </div>
                            <div class="info-item">
                              <span>所属渠道</span>
                              <strong>{{ 文本(字段(审批, "targetPartnerName"), "未填写") }}</strong>
                            </div>
                            <div class="info-item">
                              <span>所属区域</span>
                              <strong>{{ 文本(字段(审批, "region"), "未填写") }}</strong>
                            </div>
                            <div class="info-item">
                              <span>联系电话</span>
                              <strong>{{ 文本(字段(审批, "phone"), "未填写") }}</strong>
                            </div>
                            <div class="info-item">
                              <span>邮箱</span>
                              <strong>{{ 文本(字段(审批, "email"), "未填写") }}</strong>
                            </div>
                            <div class="info-item">
                              <span>提交人</span>
                              <strong>{{ 文本(字段(审批, "createdBy"), "未填写") }}</strong>
                            </div>
                          </div>
                        </div>
                        <h3>审批信息</h3>
                        <div class="info-grid">
                          <div class="info-item">
                            <span>审批步骤</span><strong>{{ 审批步骤(审批) }}</strong>
                          </div>
                          <div class="info-item">
                            <span>审批记录编号</span><strong>{{ 审批记录编号(审批) }}</strong>
                          </div>
                          <div class="info-item">
                            <span>业务编号</span
                            ><strong>{{ 文本(业务目标编号(审批), "—") }}</strong>
                          </div>
                          <div class="info-item">
                            <span>金额</span
                            ><strong>{{ 金额文本(字段(审批, "amount", "total")) }}</strong>
                          </div>
                          <div class="info-item">
                            <span>所属区域</span
                            ><strong>{{ 文本(字段(审批, "region"), 审批.区域, "未填写") }}</strong>
                          </div>
                          <div class="info-item">
                            <span>提交时间</span><strong>{{ 日期时间文本(审批.创建时间) }}</strong>
                          </div>
                          <div class="info-item">
                            <span>更新时间</span><strong>{{ 日期时间文本(审批.更新时间) }}</strong>
                          </div>
                          <div class="info-item">
                            <span>审批人</span>
                            <strong>{{ 最终审批人(审批) }}</strong>
                          </div>
                          <div class="info-item">
                            <span>审批时间</span>
                            <strong>{{ 最终审批时间(审批) }}</strong>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h3>审批说明</h3>
                        <p class="war-note">{{ 审批说明(审批) }}</p>
                        <div class="审批历史">
                          <h4>历史审批意见</h4>
                          <ol v-if="审批历史(审批).length" class="审批时间线">
                            <li
                              v-for="(事件, 序号) in 审批历史(审批)"
                              :key="`${事件.createdAt}-${序号}`"
                            >
                              <div class="审批时间线头部">
                                <strong>{{ 审批事件名称(事件.eventCode) }}</strong>
                                <time>{{ 日期时间文本(事件.createdAt) }}</time>
                              </div>
                              <p>
                                <span>操作人：{{ 事件.actorName }}</span>
                                <span v-if="事件.toStatus">
                                  状态：{{ 审批状态名称(事件.fromStatus || "pending") }} →
                                  {{ 审批状态名称(事件.toStatus) }}
                                </span>
                              </p>
                              <p class="审批时间线意见">
                                {{ 清除富文本标签(事件.reason) || "未填写审批意见。" }}
                              </p>
                            </li>
                          </ol>
                          <p v-else class="war-note">暂无历史审批记录。</p>
                        </div>
                        <p v-if="是账号审批(审批)" class="war-note">
                          企业管理员提交的员工账号先由区管初审，再由超管终审；任一级驳回后账号不会启用。
                        </p>
                        <p v-else-if="是渠道类审批(审批)" class="war-note">
                          渠道商与渠道账号可直接在本页通过或驳回；驳回时必须填写原因，处理结果会写入审批记录。
                        </p>
                        <p v-else class="war-note">
                          审批动作在业务页面完成：订单审批进入「订单处理」，客户报备审核进入「客户管理」。
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
              <tr v-if="!过滤后列表.length">
                <td colspan="7" class="war-empty">
                  {{
                    当前分区 === "待审批"
                      ? "没有符合条件的待审批任务。"
                      : "没有符合条件的已审批记录。"
                  }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <div v-if="驳回弹窗打开" class="审批弹窗遮罩" @click.self="驳回弹窗打开 = false">
      <section class="审批弹窗" role="dialog" aria-modal="true" aria-labelledby="驳回审批标题">
        <header>
          <div>
            <h2 id="驳回审批标题">驳回审批</h2>
            <p>{{ 文本(字段(驳回目标, "targetName"), 驳回目标?.标题, "该审批事项") }}</p>
          </div>
          <button type="button" class="关闭按钮" aria-label="关闭" @click="驳回弹窗打开 = false">
            ×
          </button>
        </header>
        <label>
          <span>驳回原因</span>
          <textarea
            v-model="驳回原因"
            maxlength="500"
            rows="4"
            placeholder="请填写驳回原因，提交人可在审批记录中查看。"
          />
        </label>
        <footer>
          <button
            type="button"
            class="次要按钮"
            :disabled="审批提交中"
            @click="驳回弹窗打开 = false"
          >
            取消
          </button>
          <button type="button" class="危险按钮" :disabled="审批提交中" @click="提交驳回">
            {{ 审批提交中 ? "提交中…" : "确认驳回" }}
          </button>
        </footer>
      </section>
    </div>
  </div>
</template>

<style scoped>
.审批表 tbody tr {
  cursor: pointer;
}

.审批编号行 {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
  font-size: 10px;
}

.审批详情行 {
  cursor: default;
}

.账号审批信息 {
  margin-bottom: 18px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(15, 57, 111, 0.1);
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
.link.danger {
  color: #b42318;
}
.审批弹窗遮罩 {
  position: fixed;
  z-index: 80;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgb(15 23 42 / 38%);
}
.审批弹窗 {
  width: min(480px, 100%);
  padding: 22px;
  border: 1px solid #dbe5f1;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 24px 72px rgb(15 23 42 / 20%);
}
.审批弹窗 header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.审批弹窗 h2 {
  margin: 0;
  color: #17324f;
  font-size: 16px;
}
.审批弹窗 header p {
  margin: 6px 0 0;
  color: #718198;
  font-size: 11px;
}
.关闭按钮 {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  color: #718198;
  background: #f2f6fb;
  font-size: 18px;
  cursor: pointer;
}
.审批弹窗 label {
  display: grid;
  gap: 8px;
  margin-top: 18px;
  color: #40556c;
  font-size: 11px;
  font-weight: 700;
}
.审批弹窗 textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid #d7e3f0;
  border-radius: 10px;
  color: #17324f;
  background: #fff;
  font: inherit;
  font-weight: 400;
  line-height: 1.6;
  resize: vertical;
}
.审批弹窗 footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
}
.审批弹窗 footer button {
  min-height: 34px;
  padding: 0 16px;
  border-radius: 9px;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}
.审批弹窗 .次要按钮 {
  border: 1px solid #d7e3f0;
  color: #40556c;
  background: #fff;
}
.审批弹窗 .危险按钮 {
  border: 1px solid #b42318;
  color: #fff;
  background: #b42318;
}
.审批弹窗 button:disabled {
  opacity: 0.58;
  cursor: wait;
}

.审批历史 {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #d7e3f0;
}

.审批历史 h4 {
  margin: 0 0 8px;
  color: #17324f;
  font-size: 11px;
  font-weight: 700;
}

.审批时间线 {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.审批时间线 li {
  padding: 9px 11px;
  border-left: 3px solid #2f69ed;
  border-radius: 0 8px 8px 0;
  background: #f7faff;
}

.审批时间线头部 {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;
}

.审批时间线头部 strong {
  color: #17324f;
  font-size: 11px;
}

.审批时间线头部 time,
.审批时间线 p {
  color: #718198;
  font-size: 10px;
}

.审批时间线 p {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin: 5px 0 0;
}

.审批时间线 .审批时间线意见 {
  color: #40556c;
  line-height: 1.55;
}
</style>
