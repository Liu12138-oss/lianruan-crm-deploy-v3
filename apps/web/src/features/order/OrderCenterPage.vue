<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import {
  下载订单合同附件,
  查询阶段9全部,
  type 订单合同附件,
  type 阶段9记录,
} from "../../api/business-client.js";
import { 导出业务数据 } from "../../api/business-import-client.js";
import type { 指标项 } from "../../components/war/types.js";
import WarKpis from "../../components/war/WarKpis.vue";
import WarLayout from "../../components/war/WarLayout.vue";
import WarRecordCard from "../../components/war/WarRecordCard.vue";
import { 业务类型名称, 记录业务类型 } from "../../shared/business/business-type.js";
import {
  取数,
  文本,
  文本或,
  日期文本,
  日期时间文本,
  订单状态文本,
  金额文本,
} from "../../shared/format/business-format.js";
import { use外壳前缀 } from "../../shared/navigation/shell-prefix.js";
import { 判断平台角色, 是内部管理员 } from "../../shared/permission/role.js";
import { useSessionStore } from "../../stores/session.js";
import QuoteProfitPanel from "../quote/QuoteProfitPanel.vue";
import { 订单匹配列表分区 } from "./order-list-filter.js";
import { 计算订单审批进度 } from "./order-progress.js";

const 路由器 = useRouter();
const 路由 = useRoute();
const 外壳前缀 = use外壳前缀();
const 会话 = useSessionStore();
// 首屏即进入加载态，避免列表尚未返回时把 KPI 先算成 0 造成闪烁。
const 加载中 = ref(true);
const 错误 = ref("");
const 订单列表 = ref<阶段9记录[]>([]);
const 选中编号 = ref("");
const 当前标签 = ref(路由.query.filter === "completed" ? "已完成" : "全部");
const 搜索词 = ref("");
const 选中区域 = ref("全部区域");
const 选中排序 = ref("创建时间新→旧");
const 当前页码 = ref(1);
const 每页条数 = 20;
const 导出中 = ref(false);

const 标签列表 = ["全部", "待我处理", "已完成"];
const 排序选项 = ["创建时间新→旧", "创建时间旧→新", "金额高→低", "金额低→高"];

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

function 合同附件(row: 阶段9记录 | null | undefined): 订单合同附件[] {
  const 项 = 原始(row).contractAttachments;
  return Array.isArray(项) ? (项 as 订单合同附件[]) : [];
}

function 状态码(row: 阶段9记录 | null | undefined): string {
  return 文本(row?.状态, 字段(row, "status"));
}

function 订单报价类型代码(row: 阶段9记录 | null | undefined): string {
  return 文本(原始(row).quoteTypeCode, "channel_distribution");
}

function 订单报价类型名称(row: 阶段9记录 | null | undefined): string {
  return 文本(
    原始(row).quoteTypeName,
    订单报价类型代码(row) === "standard" ? "标准产品报价" : "渠道分销产品报价",
  );
}

function 是标准报价订单(row: 阶段9记录 | null | undefined): boolean {
  return 订单报价类型代码(row) === "standard";
}

function 订单待区管定价(row: 阶段9记录 | null | undefined): boolean {
  return Boolean(
    row && 是标准报价订单(row) && 文本(原始(row).pricingStatus, "priced") !== "priced",
  );
}

function 订单金额展示(row: 阶段9记录 | null | undefined): string {
  if (!row) return "—";
  if (订单待区管定价(row)) {
    return "待区管定价";
  }
  return 金额文本(row.金额);
}

function 百分比文本(值: unknown): string {
  if (值 === null || 值 === undefined || 值 === "") return "—";
  const 数字 = Number(值);
  return Number.isFinite(数字) ? `${数字.toFixed(2)}%` : "—";
}

function 可选出货金额(值: unknown): string {
  if (值 === null || 值 === undefined || 值 === "") return "—";
  return 金额文本(值);
}

function 价格对比金额文本(row: 阶段9记录 | null | undefined, 值: unknown): string {
  return 订单待区管定价(row) ? "待区管定价" : 可选出货金额(值);
}

function 价格对比百分比文本(row: 阶段9记录 | null | undefined, 值: unknown): string {
  return 订单待区管定价(row) ? "—" : 百分比文本(值);
}

function 订单明细金额文本(row: 阶段9记录 | null | undefined, 值: unknown): string {
  if (订单待区管定价(row)) {
    return "待区管定价";
  }
  return 金额文本(值);
}

/** 区管确认后订单号会切换为正式编号，前置编号用于全链路追溯。 */
function 前置编号(row: 阶段9记录 | null | undefined): string {
  return 文本(字段(row, "preRegionOrderNo", "pre_region_order_no"));
}

function 状态色调(row: 阶段9记录 | null | undefined): "blue" | "green" | "amber" | "red" | "gray" {
  const 代码 = 状态码(row);
  if (["completed", "confirmed"].includes(代码)) return "green";
  if (代码.startsWith("returned") || 代码 === "cancelled") return "red";
  if (
    [
      "pending",
      "pending_primary_confirm",
      "region_pending",
      "primary_confirmed",
      "pending_superadmin_confirm",
    ].includes(代码)
  )
    return "amber";
  return "gray";
}

const 平台角色 = computed(() => 判断平台角色(会话.user));

function 是否属于待我处理(row: 阶段9记录 | null | undefined): boolean {
  return 订单匹配列表分区(状态码(row), "待我处理", 平台角色.value);
}

const 区域选项 = computed(() =>
  [...new Set(订单列表.value.map((row: 阶段9记录) => 文本(row.区域)).filter(Boolean))].sort(),
);

function 时间排序值(row: 阶段9记录): number {
  const 时间 = new Date(文本(row.创建时间, row.更新时间));
  return Number.isNaN(时间.getTime()) ? 0 : 时间.getTime();
}

function 按当前方式排序(列表: 阶段9记录[]): 阶段9记录[] {
  const 稳定比较 = (左: 阶段9记录, 右: 阶段9记录, 主比较: number) =>
    主比较 || String(左.id).localeCompare(String(右.id), "zh-CN");
  return [...列表].sort((左, 右) => {
    if (选中排序.value === "创建时间旧→新") {
      return 稳定比较(左, 右, 时间排序值(左) - 时间排序值(右));
    }
    if (选中排序.value === "金额高→低") {
      return 稳定比较(左, 右, (Number(右.金额) || 0) - (Number(左.金额) || 0));
    }
    if (选中排序.value === "金额低→高") {
      return 稳定比较(左, 右, (Number(左.金额) || 0) - (Number(右.金额) || 0));
    }
    return 稳定比较(左, 右, 时间排序值(右) - 时间排序值(左));
  });
}

const 过滤后列表 = computed(() => {
  let 列表 = 订单列表.value;
  if (当前标签.value !== "全部") {
    列表 = 列表.filter((row) =>
      订单匹配列表分区(状态码(row), 当前标签.value as "待我处理" | "已完成", 平台角色.value),
    );
  }
  if (选中区域.value && 选中区域.value !== "全部区域")
    列表 = 列表.filter((row) => 文本(row.区域) === 选中区域.value);
  const 关键词 = 搜索词.value.trim().toLowerCase();
  if (关键词) {
    列表 = 列表.filter((row) =>
      [
        row.编号,
        row.客户名称,
        row.渠道名称,
        row.负责人,
        row.区域,
        字段(row, "quoteNo", "quoteId"),
        字段(row, "preRegionOrderNo", "pre_region_order_no"),
        字段(row, "businessTypeName"),
        字段(row, "linkedProductOrderIds"),
      ]
        .filter(Boolean)
        .some((值) => String(值).toLowerCase().includes(关键词)),
    );
  }
  return 按当前方式排序(列表);
});

const 当前订单 = computed(
  () => 订单列表.value.find((row) => row.id === 选中编号.value) || 过滤后列表.value[0] || null,
);

const 当前订单进度 = computed(() =>
  计算订单审批进度(状态码(当前订单.value), 文本(当前订单.value?.状态名称)),
);

const 总页数 = computed(() => Math.max(1, Math.ceil(过滤后列表.value.length / 每页条数)));
const 分页后列表 = computed(() => {
  const 起点 = (当前页码.value - 1) * 每页条数;
  return 过滤后列表.value.slice(起点, 起点 + 每页条数);
});

watch([当前标签, 搜索词, 选中区域, 选中排序], () => {
  当前页码.value = 1;
});

watch(
  () => 路由.query.filter,
  (筛选) => {
    if (筛选 === "completed" && 当前标签.value !== "已完成") 当前标签.value = "已完成";
  },
);

watch(总页数, (页数) => {
  if (当前页码.value > 页数) 当前页码.value = 页数;
});

watch(分页后列表, (列表) => {
  if (列表.length && !列表.some((row) => row.id === 选中编号.value)) {
    选中编号.value = 列表[0]?.id || "";
  }
});

/** 内部收益核算与区域审批信息只对内部管理员（超管 / 区管）展示，渠道端不返回内部字段。 */
const 内部管理员 = computed(() => 是内部管理员(会话.user));
const 当前订单是渠道用户 = computed(() => !内部管理员.value);
const 当前订单是标准报价 = computed(() => 是标准报价订单(当前订单.value));
/** 订单接口已返回姓名；这里仅做空值与首尾空白归一，避免渠道端再读取管理账号目录。 */
function 姓名(值: string): string {
  return String(值 || "").trim();
}

/** 订单明细合计（总价），与订单处理页同口径按行小计求和。 */
const 明细合计 = computed(() =>
  明细(当前订单.value).reduce((合计, 项) => 合计 + Number(取数(项.小计, 项.lineAmount) || 0), 0),
);
const 当前价格对比 = computed(() => {
  const 数据 = 原始(当前订单.value);
  return {
    原价: Number(数据.originalAmount || 0),
    渠道订单价: Number(数据.channelOrderAmount ?? 数据.total ?? 当前订单.value?.金额 ?? 0),
    出货金额:
      数据.shipmentAmount === null || 数据.shipmentAmount === undefined
        ? null
        : Number(数据.shipmentAmount),
    渠道订单折扣: 数据.channelOrderDiscount,
    出货折扣: 数据.shipmentDiscount,
    渠道利润: 数据.channelProfit,
    出货订单比例: 数据.shipmentToOrderRatio,
  };
});

function 下载附件(附件: 订单合同附件) {
  const 订单编号 = 当前订单.value?.id;
  if (!订单编号) return;
  void 下载订单合同附件(订单编号, 附件)
    .then((文件) => {
      const 地址 = URL.createObjectURL(文件.内容);
      const 链接 = document.createElement("a");
      链接.href = 地址;
      链接.download = 文件.文件名;
      document.body.appendChild(链接);
      链接.click();
      链接.remove();
      window.setTimeout(() => URL.revokeObjectURL(地址), 30_000);
    })
    .catch((异常) => {
      ElMessage.error(异常 instanceof Error ? 异常.message : "合同附件下载失败。");
    });
}

/** 收益核算挂在来源报价单上，优先取 quoteId，与订单处理页口径一致。 */
const 报价编号 = computed(() => 字段(当前订单.value, "quoteId", "quoteNo", "报价编号"));
const 订单业务类型 = computed(() => 记录业务类型(当前订单.value));
const 订单业务类型名称 = computed(() => 业务类型名称(订单业务类型.value, "订单"));
const 关联产品订单 = computed(() => {
  const 项 = 当前订单.value?.原始数据?.linkedProductOrders;
  return Array.isArray(项) ? (项 as Array<Record<string, unknown>>) : [];
});
const 保障周期标签 = computed(() => (订单业务类型.value === "maintenance" ? "维保期" : "质保期"));
const 保障周期文本 = computed(() => {
  const 记录 = 当前订单.value;
  const 起始 = 日期文本(
    字段(
      记录,
      订单业务类型.value === "maintenance" ? "maintenanceStartDate" : "warrantyStartDate",
      订单业务类型.value === "maintenance" ? "维保起始日" : "质保起始日",
    ),
  );
  const 到期 = 日期文本(
    字段(
      记录,
      订单业务类型.value === "maintenance" ? "maintenanceEndDate" : "warrantyEndDate",
      订单业务类型.value === "maintenance" ? "维保到期日" : "质保到期日",
    ),
  );
  return 起始 === "—" && 到期 === "—" ? "未维护" : `${起始} 至 ${到期}`;
});

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
  const 映射: Record<string, string> = {
    primary: "一级分销",
    secondary: "二级分销",
    none: "无分销层级",
  };
  return 映射[值] || "未设置";
});

const 动态 = computed(() => {
  const 记录 = 当前订单.value;
  if (!记录) return [];
  const 时间 = 文本(记录.更新时间, 记录.创建时间);
  return ["订单状态已流转", "审批历史已记录", "报价快照已关联"]
    .map((标题, 序号) => ({
      标题,
      时间: 序号 === 0 ? 日期文本(时间) : "",
      说明: ["当前订单状态", "最近一次审批处理", "订单关联报价信息"][序号] || "",
    }))
    .filter((项) => 项.时间 || 项.说明);
});

const 指标 = computed<指标项[]>(() => {
  const 列表 = 订单列表.value;
  const 计数 = (状态集合: string[]) => 列表.filter((row) => 状态集合.includes(状态码(row))).length;
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
});

async function 加载() {
  加载中.value = true;
  错误.value = "";
  try {
    const 结果 = await 查询阶段9全部("orders");
    订单列表.value = 结果.数据;
    const 预选 = 文本(路由.query.orderId);
    选中编号.value =
      (预选 &&
        订单列表.value.find(
          (row) =>
            row.id === 预选 ||
            row.编号 === 预选 ||
            前置编号(row) === 预选 ||
            文本(字段(row, "formalOrderNo")) === 预选,
        )?.id) ||
      订单列表.value[0]?.id ||
      "";
    const 指定位置 = 订单列表.value.findIndex((row) => row.id === 选中编号.value);
    if (指定位置 >= 0) 当前页码.value = Math.floor(指定位置 / 每页条数) + 1;
  } catch (异常) {
    错误.value = 异常 instanceof Error ? 异常.message : "订单数据加载失败。";
  } finally {
    加载中.value = false;
  }
}

function 切换页码(页码: number) {
  当前页码.value = Math.min(总页数.value, Math.max(1, 页码));
}

function 打开处理(row: 阶段9记录) {
  // 管理端与渠道端共用本页；订单处理页分别挂在 /admin 与 /partner 下，跳转必须跟随当前外壳，
  // 否则一级渠道商点开会落到无权访问的 /admin 路由，无法确认二级渠道商订单。
  路由器.push(`${外壳前缀.value}/order/${row.id}/actions`);
}

/** 订单只允许从正式业务链路生成，导出不提供 Excel 反向导入。 */
async function 导出当前订单() {
  if (导出中.value) return;
  导出中.value = true;
  try {
    const 结果 = await 导出业务数据("orders");
    const 地址 = URL.createObjectURL(结果.内容);
    const 链接 = document.createElement("a");
    链接.href = 地址;
    链接.download = 结果.文件名;
    document.body.appendChild(链接);
    链接.click();
    链接.remove();
    URL.revokeObjectURL(地址);
    ElMessage.success("订单数据已导出。");
  } catch (异常) {
    ElMessage.error(异常 instanceof Error ? 异常.message : "订单导出失败。");
  } finally {
    导出中.value = false;
  }
}
</script>

<template>
  <div class="vui war-artboard 订单中心页">
    <WarKpis :items="指标" :加载中="加载中" />

    <WarLayout
      v-model="搜索词"
      list-title="订单列表"
      :list-count="String(过滤后列表.length)"
      search-placeholder="搜索订单编号、客户、渠道商或报价单"
      :tabs="标签列表"
      :active-tab="当前标签"
      :步骤="当前订单进度.步骤"
      :当前步骤="当前订单进度.当前步骤"
      :动态="动态"
      :区域列表="区域选项"
      :选中区域="选中区域"
      :排序选项="排序选项"
      :选中排序="选中排序"
      @update:选中区域="选中区域 = $event"
      @update:选中排序="选中排序 = $event"
      @切换标签="当前标签 = $event"
    >
      <template #list-tools>
        <button type="button" class="订单导出按钮" :disabled="导出中" @click="导出当前订单">
          {{ 导出中 ? "导出中…" : "导出订单数据" }}
        </button>
      </template>
      <template #list>
        <div v-if="加载中" class="war-empty">正在加载订单数据…</div>
        <div v-else-if="错误" class="war-empty">{{ 错误 }}</div>
        <WarRecordCard
          v-for="row in 分页后列表"
          :key="row.id"
          :title="文本或([row.客户名称, row.标题], '未命名订单')"
          :meta="
            [
              文本(row.编号, '无编号'),
              文本(row.渠道名称, '未归属渠道'),
              文本(row.区域, '未填写区域'),
            ].join(' · ')
          "
          :badge="订单状态文本(状态码(row), row.状态名称)"
          :tone="状态色调(row)"
          :owner="`负责人：${文本(row.负责人, '未指派')}`"
          :amount="订单金额展示(row)"
          :tags="[
            { text: 业务类型名称(记录业务类型(row), '订单') },
            { text: 订单报价类型名称(row), hot: 是标准报价订单(row) },
            { text: 字段(row, 'quoteNo', 'quoteId') ? '已关联报价' : '无报价' },
            {
              text: 是否属于待我处理(row) ? '待审批处理' : `更新 ${日期文本(row.更新时间)}`,
              hot: 是否属于待我处理(row),
            },
          ]"
          :active="当前订单?.id === row.id"
          @选择="选中编号 = row.id"
        />
        <div v-if="!加载中 && !错误 && !过滤后列表.length" class="war-empty">
          当前筛选条件下没有订单记录。
        </div>
        <nav
          v-if="过滤后列表.length > 每页条数"
          class="war-list-pagination"
          aria-label="订单列表分页"
        >
          <button type="button" :disabled="当前页码 <= 1" @click="切换页码(当前页码 - 1)">
            上一页
          </button>
          <span>第 {{ 当前页码 }} / {{ 总页数 }} 页，共 {{ 过滤后列表.length }} 条</span>
          <button type="button" :disabled="当前页码 >= 总页数" @click="切换页码(当前页码 + 1)">
            下一页
          </button>
        </nav>
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
                · {{ 订单报价类型名称(当前订单) }}
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
                    <span>订单金额</span><strong>{{ 订单金额展示(当前订单) }}</strong>
                  </div>
                  <div class="info-item">
                    <span>报价类型</span><strong>{{ 订单报价类型名称(当前订单) }}</strong>
                  </div>
                  <div v-if="当前订单是标准报价" class="info-item">
                    <span>定价状态</span>
                    <strong>{{ 文本(字段(当前订单, "pricingStatusName"), "待区管定价") }}</strong>
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
                      姓名(字段(当前订单, "regionConfirmedByName", "regionConfirmedByUsername")) ||
                      "未确认"
                    }}</strong>
                  </div>
                  <div v-if="内部管理员" class="info-item">
                    <span>审批轮次</span>
                    <strong>第 {{ 文本(字段(当前订单, "approvalRound"), "1") }} 轮</strong>
                  </div>
                  <div class="info-item">
                    <span>收货地址</span>
                    <strong>{{
                      文本(字段(当前订单, "deliveryAddress", "deliveryAddr"), "未填写")
                    }}</strong>
                  </div>
                  <div class="info-item">
                    <span>收货人</span>
                    <strong>{{
                      文本(字段(当前订单, "recipientName", "contacts"), "未填写")
                    }}</strong>
                  </div>
                  <div class="info-item">
                    <span>收货电话</span>
                    <strong>{{ 文本(字段(当前订单, "recipientPhone"), "未填写") }}</strong>
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
                <div class="合同附件区">
                  <div class="合同附件标题">
                    <strong>合同附件</strong>
                    <span>共 {{ 合同附件(当前订单).length }} 个</span>
                  </div>
                  <div v-if="合同附件(当前订单).length" class="合同附件列表">
                    <button
                      v-for="附件 in 合同附件(当前订单)"
                      :key="附件.id"
                      type="button"
                      @click="下载附件(附件)"
                    >
                      <span>文</span>
                      <strong>{{ 附件.文件名 }}</strong>
                      <small>下载</small>
                    </button>
                  </div>
                  <p v-else class="war-note">本订单没有上传合同附件。</p>
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
                      <td>{{ 订单明细金额文本(当前订单, 取数(项.单价, 项.unitPrice)) }}</td>
                      <td>{{ 订单明细金额文本(当前订单, 取数(项.小计, 项.lineAmount)) }}</td>
                    </tr>
                    <tr v-if="!明细(当前订单).length">
                      <td colspan="4" class="war-empty">该订单没有明细记录。</td>
                    </tr>
                  </tbody>
                </table>
                <div v-if="明细(当前订单).length" class="明细合计条">
                  <span>明细合计（总价）</span>
                  <strong>{{ 订单明细金额文本(当前订单, 明细合计) }}</strong>
                </div>
                <div class="价格对比区">
                  <div class="价格对比标题">
                    <strong>价格对比</strong>
                    <span>原价、渠道订单价与出货价统一在明细总价下方核对</span>
                  </div>
                  <dl class="价格对比网格">
                    <div>
                      <dt>原价</dt>
                      <dd>{{ 价格对比金额文本(当前订单, 当前价格对比.原价) }}</dd>
                    </div>
                    <div>
                      <dt>渠道订单价</dt>
                      <dd>
                        {{
                          订单待区管定价(当前订单)
                            ? "待区管定价"
                            : 金额文本(当前价格对比.渠道订单价)
                        }}
                      </dd>
                    </div>
                    <div>
                      <dt>出货金额</dt>
                      <dd>{{ 价格对比金额文本(当前订单, 当前价格对比.出货金额) }}</dd>
                    </div>
                    <div>
                      <dt>渠道订单折扣</dt>
                      <dd>{{ 价格对比百分比文本(当前订单, 当前价格对比.渠道订单折扣) }}</dd>
                    </div>
                    <div>
                      <dt>出货折扣</dt>
                      <dd>{{ 价格对比百分比文本(当前订单, 当前价格对比.出货折扣) }}</dd>
                    </div>
                    <div v-if="!当前订单是渠道用户">
                      <dt>渠道利润</dt>
                      <dd
                        :class="{
                          负利润:
                            当前价格对比.渠道利润 !== null && Number(当前价格对比.渠道利润) < 0,
                        }"
                      >
                        {{ 价格对比金额文本(当前订单, 当前价格对比.渠道利润) }}
                      </dd>
                    </div>
                    <div>
                      <dt>出货 / 订单比例</dt>
                      <dd>{{ 价格对比百分比文本(当前订单, 当前价格对比.出货订单比例) }}</dd>
                    </div>
                  </dl>
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
                      姓名(
                        字段(当前订单, "createdByName", "submittedByName", "submittedByUsername"),
                      ) || "—"
                    }}</strong>
                  </div>
                  <div class="info-item">
                    <span>订单业务类型</span><strong>{{ 订单业务类型名称 }}</strong>
                  </div>
                  <div class="info-item">
                    <span>明细产品类型</span><strong>{{ 产品类型文本 }}</strong>
                  </div>
                  <div class="info-item">
                    <span>{{ 保障周期标签 }}</span
                    ><strong>{{ 保障周期文本 }}</strong>
                  </div>
                  <div v-if="关联产品订单.length" class="info-item full">
                    <span>关联产品订单</span>
                    <strong>{{
                      关联产品订单.map((订单) => 文本(订单.orderNo, 订单.id)).join("、")
                    }}</strong>
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
              v-if="内部管理员 && 报价编号 && !当前订单是标准报价"
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
              <span>订单金额</span><strong>{{ 订单金额展示(当前订单) }}</strong>
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
.订单导出按钮 {
  width: 100%;
  margin-top: 8px;
  padding: 7px 10px;
  border: 1px solid #cbdcf0;
  border-radius: 8px;
  background: #f5faff;
  color: #2d619b;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.订单导出按钮:hover:not(:disabled),
.订单导出按钮:focus-visible {
  border-color: #8db7ee;
  background: #eaf4ff;
  outline: none;
}

.订单导出按钮:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>

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

.合同附件区 {
  display: grid;
  gap: 8px;
  margin-top: 14px;
  padding-top: 13px;
  border-top: 1px solid var(--line-soft);
}

.合同附件标题 {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.合同附件标题 strong {
  color: var(--text);
  font-size: 11px;
}

.合同附件标题 span {
  color: var(--text-3);
  font-size: 11px;
}

.合同附件列表 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 8px;
}

.合同附件列表 button {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid var(--line-soft);
  border-radius: 8px;
  background: #ffffff;
  color: var(--text-2);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.合同附件列表 button:hover,
.合同附件列表 button:focus-visible {
  border-color: #9fc2f6;
  background: #f6faff;
  outline: none;
}

.合同附件列表 button > span {
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  border-radius: 7px;
  background: #eef5ff;
  color: #2f69ed;
  font-size: 11px;
  font-weight: 700;
}

.合同附件列表 strong {
  overflow: hidden;
  color: var(--text-2);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.合同附件列表 small {
  color: var(--text-3);
  font-size: 11px;
  white-space: nowrap;
}

.价格对比区 {
  display: grid;
  gap: 10px;
  margin: 12px 13px 13px;
  padding: 12px;
  border: 1px solid #dbe7f5;
  border-radius: 9px;
  background: #f8fbff;
}

.价格对比标题 {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.价格对比标题 strong {
  color: var(--text);
  font-size: 11px;
}

.价格对比标题 span {
  color: var(--text-3);
  font-size: 11px;
}

.价格对比网格 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 8px;
  margin: 0;
}

.价格对比网格 > div {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 9px 10px;
  border: 1px solid #e3ebf5;
  border-radius: 8px;
  background: #ffffff;
}

.价格对比网格 dt {
  color: var(--text-3);
  font-size: 11px;
}

.价格对比网格 dd {
  margin: 0;
  color: var(--text);
  font-size: 11px;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.价格对比网格 dd.负利润 {
  color: #c73535;
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
