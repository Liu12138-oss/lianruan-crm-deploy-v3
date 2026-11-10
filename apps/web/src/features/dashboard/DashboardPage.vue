<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import { 查询阶段9全部, type 阶段9记录 } from "../../api/business-client.js";
import type { 指标项 } from "../../components/war/types.js";
import WarKpis from "../../components/war/WarKpis.vue";
import { 文本, 日期时间文本, 订单状态文本, 金额文本 } from "../../shared/format/business-format.js";
import { use外壳前缀 } from "../../shared/navigation/shell-prefix.js";
import { 是内部管理员, 是区域管理员, 是超级管理员 } from "../../shared/permission/role.js";
import {
  商机七阶段,
  商机阶段文案,
  type 商机阶段键 as 商机阶段代码,
  映射商机阶段,
} from "../../shared/stages/opportunity-stage.js";
import { useSessionStore } from "../../stores/session.js";

const 路由器 = useRouter();
const 外壳前缀 = use外壳前缀();
const 会话 = useSessionStore();
/** 审核中心与审计日志只对内部管理员开放，渠道端不展示这两个入口。 */
const 内部管理员 = computed(() => 是内部管理员(会话.user));
const 超级管理员 = computed(() => 是超级管理员(会话.user));
const 加载中 = ref(false);
const 数据已加载 = ref(false);
const 错误 = ref("");
const 客户列表 = ref<阶段9记录[]>([]);
const 商机列表 = ref<阶段9记录[]>([]);
const 报价列表 = ref<阶段9记录[]>([]);
const 订单列表 = ref<阶段9记录[]>([]);
const 渠道列表 = ref<阶段9记录[]>([]);
const 产品列表 = ref<阶段9记录[]>([]);
const 审批列表 = ref<阶段9记录[]>([]);

const 待审订单状态 = new Set([
  "pending",
  "pending_primary_confirm",
  "region_pending",
  "primary_confirmed",
  "pending_superadmin_confirm",
]);
const 成交订单状态 = new Set(["confirmed", "processing", "shipped", "completed"]);
const 商机终止阶段 = new Set<商机阶段代码>(["won", "lost", "cancelled"]);

function 原始(row: 阶段9记录 | null | undefined): Record<string, unknown> {
  return (row?.原始数据 as Record<string, unknown>) || {};
}

function 字段(row: 阶段9记录 | null | undefined, ...键列表: string[]): string {
  const 数据 = 原始(row);
  return 文本(
    ...键列表.map((键) => 数据[键]),
    ...键列表.map((键) => (row as unknown as Record<string, unknown>)?.[键]),
  );
}

function 时间戳(row: 阶段9记录): number {
  const 时间 = 文本(row.创建时间, row.更新时间, 字段(row, "createdAt", "created_at", "createTime"));
  const 数值 = new Date(时间).getTime();
  return Number.isFinite(数值) ? 数值 : 0;
}

function 商机阶段键(row: 阶段9记录): 商机阶段代码 {
  return 映射商机阶段(字段(row, "stage", "stageCode", "stage_code"), row.状态, row.状态名称);
}

function 报价状态码(row: 阶段9记录): string {
  return 文本(row.状态, 字段(row, "status", "statusCode")).toLowerCase();
}

function 是标准报价(row: 阶段9记录): boolean {
  return 文本(字段(row, "quoteTypeCode"), "channel_distribution") === "standard";
}

function 报价状态文本(row: 阶段9记录): string {
  const 代码 = 报价状态码(row);
  return (
    {
      draft: "草稿",
      submitted: "已提交",
      approved: "已通过",
      rejected: "已驳回",
      withdrawn: "已撤回",
      converted: "已转订单",
      expired: "已过期",
      cancelled: "已取消",
    }[代码] ||
    文本(row.状态名称) ||
    "未知状态"
  );
}

function 产品线名称(row: 阶段9记录): string {
  const 数据 = 原始(row);
  const 候选 = [
    数据.categoryName,
    数据.category_name,
    数据.productLineName,
    数据.product_line_name,
    row.类型,
  ];
  return 文本(...候选, "未分类产品");
}

const 进行中商机 = computed(
  () => 商机列表.value.filter((row) => !商机终止阶段.has(商机阶段键(row))).length,
);

const 累计成交金额 = computed(() =>
  订单列表.value
    .filter((row) => 成交订单状态.has(文本(row.状态).toLowerCase()))
    .reduce((合计, row) => 合计 + (Number(row.金额) || 0), 0),
);

const 成交金额卡 = computed(() => {
  const 金额 = 累计成交金额.value;
  if (金额 >= 100_000_000) return { value: (金额 / 100_000_000).toFixed(2), unit: "亿元" };
  if (金额 >= 10_000) return { value: (金额 / 10_000).toFixed(2), unit: "万元" };
  return { value: 金额.toLocaleString("zh-CN", { maximumFractionDigits: 2 }), unit: "元" };
});

/** 待办与审核中心共用 approvals 数据源，避免工作台显示 6 条、进入后变成 31 条的口径冲突。 */
const 待审审批 = computed(() => {
  if (!内部管理员.value) return [];
  return 审批列表.value
    .filter((row) => 文本(row.状态, 字段(row, "status")).toLowerCase() === "pending")
    .filter((row) => 文本(字段(row, "type", "targetType")) !== "quote")
    .filter((row) => {
      if (!是区域管理员(会话.user)) return true;
      const 类型 = 文本(字段(row, "targetType", "type"));
      if (!["order", "order_revision"].includes(类型)) return true;
      // 区管只处理区管阶段；一级确认和超管确认不属于当前待办。
      return ["primary_confirmed", "region_pending"].includes(字段(row, "orderStatus"));
    })
    .sort((左, 右) => 时间戳(右) - 时间戳(左));
});

function 审批类型代码(row: 阶段9记录): string {
  const 代码 = 文本(字段(row, "targetType", "type", "approvalType"));
  if (["staff", "user", "partner_admin", "account"].includes(代码)) return "partner";
  return 代码;
}

function 审批类型名称(row: 阶段9记录): string {
  return (
    {
      registration: "客户报备待审核",
      order: "订单待审批",
      order_revision: "订单修订待审批",
      partner: "渠道与账号待审批",
    }[审批类型代码(row)] || "审批待办"
  );
}

function 审批路径(row: 阶段9记录): string {
  const 类型 = 审批类型代码(row);
  const 目标 = 文本(字段(row, "targetId")) || row.id;
  if (类型 === "registration") {
    return `${外壳前缀.value}/registration?selected=${encodeURIComponent(目标)}`;
  }
  if (["order", "order_revision"].includes(类型)) {
    return `${外壳前缀.value}/order/${encodeURIComponent(目标)}/actions`;
  }
  return `${外壳前缀.value}/admin-review`;
}

const 内部待办总数 = computed(() => 待审审批.value.length);
const 内部待办 = computed(() =>
  [...待审审批.value]
    .sort((左, 右) => 时间戳(右) - 时间戳(左))
    .slice(0, 6)
    .map((row) => ({
      类型: 审批类型名称(row),
      标题: 文本(row.标题, row.客户名称, 字段(row, "targetName"), "未命名审批事项"),
      状态: 文本(row.状态名称, "待审核"),
      色调: 审批类型代码(row) === "order" ? ("blue" as const) : ("amber" as const),
      路径: 审批路径(row),
      时间: 日期时间文本(文本(row.更新时间, row.创建时间)),
    })),
);

/**
 * 渠道工作台只提供本渠道业务待办，不展示内部审批待办。
 * 待办来源全部取当前账号已获授权的业务列表，避免跨渠道或越权计数。
 */
const 渠道业务待办 = computed(() => {
  if (内部管理员.value) return [];
  const 待处理报价状态 = new Set(["draft", "approved", "rejected"]);
  const 待处理订单状态 = new Set([
    "primary_rejected",
    "returned_to_primary",
    "returned_to_secondary",
    "revision_requested",
  ]);
  const 报价动作: Record<string, { 类型: string; 状态: string }> = {
    draft: { 类型: "报价草稿待完成", 状态: "待处理" },
    approved: { 类型: "报价待转订单", 状态: "待处理" },
    rejected: { 类型: "报价被驳回", 状态: "待修改" },
  };
  const 订单动作: Record<string, string> = {
    primary_rejected: "一级渠道已驳回，请查看原因后处理",
    returned_to_primary: "已退回一级渠道商修改",
    returned_to_secondary: "已退回二级渠道商修改",
    revision_requested: "订单回退修改待处理",
  };
  const 待办项 = [
    ...客户列表.value
      .filter((row) => 文本(row.状态).toLowerCase() === "rejected")
      .map((row) => ({
        类型: "客户报备被驳回",
        标题: 文本(row.客户名称, row.标题, "未命名客户"),
        状态: "待修改",
        色调: "amber" as const,
        路径: `${外壳前缀.value}/registration?selected=${encodeURIComponent(row.id)}`,
        时间: 日期时间文本(文本(row.更新时间, row.创建时间)),
      })),
    ...报价列表.value
      .filter((row) => 待处理报价状态.has(报价状态码(row)))
      .map((row) => {
        const 动作 = 报价动作[报价状态码(row)] || { 类型: "报价待处理", 状态: "待处理" };
        return {
          类型: 动作.类型,
          标题: 文本(row.客户名称, row.标题, "未命名报价单"),
          状态: 动作.状态,
          色调: "blue" as const,
          路径: `${外壳前缀.value}/quote?quoteId=${encodeURIComponent(row.id)}`,
          时间: 日期时间文本(文本(row.更新时间, row.创建时间)),
        };
      }),
    ...订单列表.value
      .filter((row) => 待处理订单状态.has(文本(row.状态).toLowerCase()))
      .map((row) => ({
        类型: 订单动作[文本(row.状态).toLowerCase()] || "订单待处理",
        标题: 文本(row.客户名称, row.标题, "未命名订单"),
        状态: "待处理",
        色调: "amber" as const,
        路径: `${外壳前缀.value}/order?orderId=${encodeURIComponent(row.id)}`,
        时间: 日期时间文本(文本(row.更新时间, row.创建时间)),
      })),
  ];
  return 待办项.sort((左, 右) => new Date(右.时间).getTime() - new Date(左.时间).getTime());
});

const 待办总数 = computed(() =>
  内部管理员.value ? 内部待办总数.value : 渠道业务待办.value.length,
);
const 待办 = computed(() => (内部管理员.value ? 内部待办.value : 渠道业务待办.value.slice(0, 6)));
const 待办标题 = computed(() => (内部管理员.value ? "我的待办" : "业务待办"));
const 待办说明 = computed(() =>
  内部管理员.value
    ? "按当前账号数据范围统计，待办与审核中心使用同一口径。"
    : "仅统计当前渠道的客户报备、报价和订单处理事项，不包含内部审批待办。",
);

const 近六个月趋势 = computed(() => {
  const 当前 = new Date();
  const 月份列表 = Array.from({ length: 6 }, (_, 序号) => {
    const 月 = new Date(当前.getFullYear(), 当前.getMonth() - (5 - 序号), 1);
    return { 年: 月.getFullYear(), 月: 月.getMonth(), 标签: `${月.getMonth() + 1}月` };
  });
  const 计数 = (列表: 阶段9记录[], 年: number, 月: number) =>
    列表.filter((row) => {
      const 时间 = new Date(文本(row.创建时间));
      return 时间.getFullYear() === 年 && 时间.getMonth() === 月;
    }).length;
  return 月份列表.map((项) => ({
    标签: 项.标签,
    客户报备: 计数(客户列表.value, 项.年, 项.月),
    商机: 计数(商机列表.value, 项.年, 项.月),
    报价单: 计数(报价列表.value, 项.年, 项.月),
    订单: 计数(订单列表.value, 项.年, 项.月),
  }));
});

const 近期商机 = computed(() =>
  商机列表.value
    .filter((row) => !商机终止阶段.has(商机阶段键(row)))
    .sort((左, 右) => 时间戳(右) - 时间戳(左))
    .slice(0, 5)
    .map((row) => ({
      标题: 文本(row.标题, row.客户名称, "未命名商机"),
      客户: 文本(row.客户名称, "未填写客户"),
      阶段: 商机阶段文案(商机阶段键(row)).replace(/（.*）/, ""),
      金额: 金额文本(row.金额),
      路径: `${外壳前缀.value}/opportunity?opportunityId=${encodeURIComponent(row.id)}`,
    })),
);

const 最近报价 = computed(() =>
  报价列表.value
    .slice()
    .sort((左, 右) => 时间戳(右) - 时间戳(左))
    .slice(0, 5)
    .map((row) => ({
      标题: 文本(row.客户名称, row.标题, "未命名报价单"),
      状态: 报价状态文本(row),
      金额: 是标准报价(row) ? "待区管定价" : 金额文本(row.金额),
      路径: `${外壳前缀.value}/quote?quoteId=${encodeURIComponent(row.id)}`,
    })),
);

const 产品线分布 = computed(() => {
  const 统计 = new Map<string, number>();
  for (const row of 产品列表.value) {
    const 名称 = 产品线名称(row);
    统计.set(名称, (统计.get(名称) || 0) + 1);
  }
  return [...统计.entries()]
    .map(([名称, 数量]) => ({ 名称, 数量 }))
    .sort((左, 右) => 右.数量 - 左.数量)
    .slice(0, 6);
});

const 商机漏斗 = computed(() => {
  const 统计 = new Map<商机阶段代码, number>();
  for (const row of 商机列表.value) {
    const 键 = 商机阶段键(row);
    if (["lost", "cancelled"].includes(键)) continue;
    统计.set(键, (统计.get(键) || 0) + 1);
  }
  return 商机七阶段.map((阶段) => ({
    键: 阶段.键,
    名称: 阶段.名称.replace(/（.*）/, ""),
    数量: 统计.get(阶段.键) || 0,
  }));
});

const 漏斗最大值 = computed(() => Math.max(1, ...商机漏斗.value.map((项) => 项.数量)));
const 产品线最大值 = computed(() => Math.max(1, ...产品线分布.value.map((项) => 项.数量)));

function 漏斗宽度(数量: number): string {
  return `${Math.max(数量 ? 8 : 0, Math.round((数量 / 漏斗最大值.value) * 100))}%`;
}

function 产品线宽度(数量: number): string {
  return `${Math.max(数量 ? 8 : 0, Math.round((数量 / 产品线最大值.value) * 100))}%`;
}

const 最近业务 = computed(() => {
  const 全部 = [
    ...客户列表.value.map((row) => ({
      类型: "客户报备",
      标题: 文本(row.客户名称, row.标题, "未命名客户"),
      状态: 文本(row.状态名称, row.状态, "—"),
      时间: 文本(row.更新时间, row.创建时间),
      金额: 金额文本(row.金额),
      负责人: 文本(row.负责人, "—"),
    })),
    ...商机列表.value.map((row) => ({
      类型: "商机",
      标题: 文本(row.标题, row.客户名称, "未命名商机"),
      状态: 商机阶段文案(商机阶段键(row)),
      时间: 文本(row.更新时间, row.创建时间),
      金额: 金额文本(row.金额),
      负责人: 文本(row.负责人, "—"),
    })),
    ...报价列表.value.map((row) => ({
      类型: "报价单",
      标题: 文本(row.客户名称, row.标题, "未命名报价单"),
      状态: 报价状态文本(row),
      时间: 文本(row.更新时间, row.创建时间),
      金额: 金额文本(row.金额),
      负责人: 文本(row.负责人, "—"),
    })),
    ...订单列表.value.map((row) => ({
      类型: "订单",
      标题: 文本(row.客户名称, row.标题, "未命名订单"),
      状态: 订单状态文本(row.状态, row.状态名称),
      时间: 文本(row.更新时间, row.创建时间),
      金额: 金额文本(row.金额),
      负责人: 文本(row.负责人, "—"),
    })),
  ];
  return 全部
    .filter((项) => 项.时间)
    .sort((左, 右) => new Date(右.时间).getTime() - new Date(左.时间).getTime())
    .slice(0, 8);
});

const 指标 = computed<指标项[]>(() => {
  const 已加载 = 数据已加载.value;
  const 待审核客户 = 客户列表.value.filter(
    (row) => 文本(row.状态).toLowerCase() === "pending",
  ).length;
  const 待审订单 = 订单列表.value.filter((row) =>
    待审订单状态.has(文本(row.状态).toLowerCase()),
  ).length;
  const 待转订单 = 报价列表.value.filter((row) =>
    ["draft", "submitted", "approved", "rejected"].includes(报价状态码(row)),
  ).length;
  const 公共指标: 指标项[] = [
    {
      label: "进行中商机",
      value: 已加载 ? String(进行中商机.value) : "—",
      unit: "条",
      note: 已加载 ? `全部商机 ${商机列表.value.length} 条` : "数据加载中",
      path: `${外壳前缀.value}/opportunity`,
    },
    {
      label: "客户报备",
      value: 已加载 ? String(客户列表.value.length) : "—",
      unit: "条",
      note: 已加载 ? `待审核 ${待审核客户} 条` : "数据加载中",
      path: `${外壳前缀.value}/registration`,
    },
    {
      label: "报价单",
      value: 已加载 ? String(报价列表.value.length) : "—",
      unit: "份",
      note: 已加载 ? `待转订单 ${待转订单} 份` : "数据加载中",
      path: `${外壳前缀.value}/quote`,
    },
    {
      label: "累计成交金额",
      value: 已加载 ? 成交金额卡.value.value : "—",
      unit: 成交金额卡.value.unit,
      note: 已加载 ? "按当前数据范围统计已确认及履约中订单" : "数据加载中",
      path: `${外壳前缀.value}/order?filter=completed`,
    },
    {
      label: "订单",
      value: 已加载 ? String(订单列表.value.length) : "—",
      unit: "笔",
      note: 已加载 ? `待审批 ${待审订单} 笔` : "数据加载中",
      path: `${外壳前缀.value}/order`,
    },
  ];
  return 内部管理员.value
    ? [
        ...公共指标,
        {
          label: "渠道商",
          value: 已加载 ? String(渠道列表.value.length) : "—",
          unit: "家",
          note: 已加载 ? "正式渠道主档" : "数据加载中",
          path: `${外壳前缀.value}/partners`,
        },
      ]
    : [
        ...公共指标,
        {
          label: "产品",
          value: 已加载 ? String(产品列表.value.length) : "—",
          unit: "项",
          note: 已加载 ? "可选产品目录" : "数据加载中",
          path: `${外壳前缀.value}/products`,
        },
      ];
});

onMounted(() => void 加载());

function 跳转指标(path: string): void {
  void 路由器.push(path);
}

async function 加载() {
  加载中.value = true;
  数据已加载.value = false;
  错误.value = "";
  try {
    const [客户, 商机, 报价, 订单, 渠道, 产品, 审批] = await Promise.all([
      查询阶段9全部("registrations"),
      查询阶段9全部("opportunities"),
      查询阶段9全部("quotes"),
      查询阶段9全部("orders"),
      查询阶段9全部("partners"),
      查询阶段9全部("products"),
      内部管理员.value
        ? 查询阶段9全部("approvals").catch(() => ({ 数据: [], 总数: 0 }))
        : Promise.resolve({ 数据: [], 总数: 0 }),
    ]);
    客户列表.value = 客户.数据;
    商机列表.value = 商机.数据;
    报价列表.value = 报价.数据;
    订单列表.value = 订单.数据;
    渠道列表.value = 渠道.数据;
    产品列表.value = 产品.数据;
    审批列表.value = 审批.数据;
    数据已加载.value = true;
  } catch (异常) {
    错误.value = 异常 instanceof Error ? 异常.message : "工作台数据加载失败。";
  } finally {
    加载中.value = false;
  }
}
</script>

<template>
  <div class="vui war-artboard 工作台页">
    <section class="工作台概览区" aria-labelledby="工作台指标标题">
      <header class="工作台指标头">
        <div>
          <h2 id="工作台指标标题">
            {{
              超级管理员 ? "经营指标" : 是区域管理员(会话.user) ? "区域经营指标" : "渠道经营指标"
            }}
          </h2>
          <p>
            {{
              超级管理员
                ? "按当前账号全量数据范围统计。"
                : 是区域管理员(会话.user)
                  ? "仅统计当前负责区域的客户、商机、报价和订单。"
                  : "仅统计当前渠道可见的客户、商机、报价和订单。"
            }}
          </p>
        </div>
      </header>
      <WarKpis :items="指标" :加载中="加载中" @选择="跳转指标" />
    </section>

    <div class="dashboard-body">
      <div v-if="!数据已加载 && !错误" class="war-empty">正在加载工作台数据…</div>
      <div v-else-if="错误" class="war-empty">{{ 错误 }}</div>

      <template v-else>
        <div class="grid-2">
          <section class="panel">
            <header class="panel-head">
              <div>
                <h2>{{ 待办标题 }}</h2>
                <p>
                  {{ 待办说明 }} 共 {{ 待办总数 }} 条，当前展示最近 {{ Math.min(待办总数, 6) }} 条。
                </p>
              </div>
              <div v-if="内部管理员" class="button-row">
                <button
                  type="button"
                  class="button small"
                  aria-label="进入审核中心"
                  @click="路由器.push(`${外壳前缀}/admin-review`)"
                >
                  查看全部{{ 待办总数 ? `（${待办总数}）` : "" }}
                </button>
              </div>
            </header>
            <div class="panel-body">
              <div class="list-stack">
                <article
                  v-for="(项, 序号) in 待办"
                  :key="序号"
                  class="record-card"
                  role="button"
                  tabindex="0"
                  @click="路由器.push(项.路径)"
                  @keydown.enter.prevent="路由器.push(项.路径)"
                >
                  <div class="record-top">
                    <strong>{{ 项.标题 }}</strong>
                    <span class="status" :class="项.色调">{{ 项.状态 }}</span>
                  </div>
                  <p>{{ 项.类型 }} · {{ 项.时间 }}</p>
                </article>
                <p v-if="!待办.length" class="war-note">当前没有待办事项。</p>
                <p v-else-if="待办总数 > 待办.length" class="war-note">
                  仅展示最近 {{ 待办.length }} 条，其余
                  {{ 待办总数 - 待办.length }} 条请进入对应业务列表查看。
                </p>
              </div>
            </div>
          </section>

          <section class="panel">
            <header class="panel-head">
              <div>
                <h2>业务趋势</h2>
                <p>按创建时间统计近 6 个自然月，数据来自当前账号可见的正式业务记录。</p>
              </div>
            </header>
            <div class="panel-body">
              <table class="趋势表">
                <thead>
                  <tr>
                    <th>月份</th>
                    <th>客户报备</th>
                    <th>商机</th>
                    <th>报价单</th>
                    <th>订单</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="月份 in 近六个月趋势" :key="月份.标签">
                    <td>{{ 月份.标签 }}</td>
                    <td>{{ 月份.客户报备 }}</td>
                    <td>{{ 月份.商机 }}</td>
                    <td>{{ 月份.报价单 }}</td>
                    <td>{{ 月份.订单 }}</td>
                  </tr>
                </tbody>
              </table>
              <p class="war-note">统计口径：按各业务记录的创建时间归月，不使用更新时间重复计数。</p>
            </div>
          </section>
        </div>

        <div class="insight-grid">
          <section class="panel">
            <header class="panel-head">
              <div>
                <h2>近期商机</h2>
                <p>按最近创建或更新时间展示进行中的商机。</p>
              </div>
            </header>
            <div class="panel-body">
              <div class="紧凑列表">
                <button
                  v-for="商机 in 近期商机"
                  :key="商机.路径"
                  type="button"
                  class="紧凑条目"
                  @click="路由器.push(商机.路径)"
                >
                  <span
                    ><strong>{{ 商机.标题 }}</strong
                    ><small>{{ 商机.客户 }}</small></span
                  >
                  <span class="条目右侧"
                    ><b>{{ 商机.阶段 }}</b
                    ><small>{{ 商机.金额 }}</small></span
                  >
                </button>
                <p v-if="!近期商机.length" class="war-note">当前没有进行中的商机。</p>
              </div>
            </div>
          </section>

          <section class="panel">
            <header class="panel-head">
              <div>
                <h2>最近报价</h2>
                <p>按创建时间展示最近报价单及当前状态。</p>
              </div>
            </header>
            <div class="panel-body">
              <div class="紧凑列表">
                <button
                  v-for="报价 in 最近报价"
                  :key="报价.路径"
                  type="button"
                  class="紧凑条目"
                  @click="路由器.push(报价.路径)"
                >
                  <span
                    ><strong>{{ 报价.标题 }}</strong
                    ><small>{{ 报价.状态 }}</small></span
                  >
                  <span class="条目右侧"
                    ><b>{{ 报价.金额 }}</b
                    ><small>查看报价</small></span
                  >
                </button>
                <p v-if="!最近报价.length" class="war-note">当前没有报价单。</p>
              </div>
            </div>
          </section>

          <section class="panel">
            <header class="panel-head">
              <div>
                <h2>产品线</h2>
                <p>按产品目录所属产品线统计产品数量。</p>
              </div>
            </header>
            <div class="panel-body">
              <div class="条形列表">
                <div v-for="产品线 in 产品线分布" :key="产品线.名称" class="条形行">
                  <span>{{ 产品线.名称 }}</span>
                  <div class="条形轨道"><i :style="{ width: 产品线宽度(产品线.数量) }" /></div>
                  <strong>{{ 产品线.数量 }}</strong>
                </div>
                <p v-if="!产品线分布.length" class="war-note">产品目录暂无产品。</p>
              </div>
            </div>
          </section>

          <section class="panel">
            <header class="panel-head">
              <div>
                <h2>商机漏斗</h2>
                <p>按七阶段统计当前商机分布，不包含输单与项目取消。</p>
              </div>
            </header>
            <div class="panel-body">
              <div class="漏斗列表">
                <div v-for="阶段 in 商机漏斗" :key="阶段.键" class="漏斗行">
                  <span>{{ 阶段.名称 }}</span>
                  <div class="漏斗轨道"><i :style="{ width: 漏斗宽度(阶段.数量) }" /></div>
                  <strong>{{ 阶段.数量 }}</strong>
                </div>
              </div>
              <p v-if="!进行中商机" class="war-note">当前没有进行中的商机，七阶段均为 0。</p>
            </div>
          </section>
        </div>

        <section class="panel">
          <header class="panel-head">
            <div>
              <h2>最近业务</h2>
              <p>跨模块展示最近发生的关键业务变化。</p>
            </div>
            <div v-if="超级管理员" class="button-row">
              <button type="button" class="button small" @click="路由器.push('/admin/audit-logs')">
                查看操作日志
              </button>
            </div>
          </header>
          <div class="panel-body flush">
            <table class="vui-table">
              <thead>
                <tr>
                  <th>业务类型</th>
                  <th>对象</th>
                  <th>状态</th>
                  <th>金额</th>
                  <th>负责人</th>
                  <th>更新时间</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(项, 序号) in 最近业务" :key="序号">
                  <td>{{ 项.类型 }}</td>
                  <td>
                    <span class="record-title">{{ 项.标题 }}</span>
                  </td>
                  <td>{{ 项.状态 }}</td>
                  <td>{{ 项.金额 }}</td>
                  <td>{{ 项.负责人 }}</td>
                  <td>{{ 日期时间文本(项.时间) }}</td>
                </tr>
                <tr v-if="!最近业务.length">
                  <td colspan="6" class="war-empty">暂无最近业务。</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>

<style scoped>
.工作台页 {
  display: grid;
  grid-template-rows: auto auto;
  gap: 12px;
  min-height: 0;
  padding: 10px 20px 18px;
  /* 由全局画板规则提供唯一纵向滚动，避免 1366×768 下同时出现内外两条纵向进度条。 */
}

.工作台概览区 {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.工作台指标头 {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.工作台指标头 h2 {
  margin: 0;
  color: var(--text);
  font-size: 14px;
  font-weight: 700;
  line-height: 1.35;
}

.工作台指标头 p {
  margin: 2px 0 0;
  color: var(--text-3);
  font-size: 11px;
  line-height: 1.45;
}

.工作台页 :deep(.war-kpis) {
  position: static;
  inset: auto;
  height: auto;
}

.工作台页 :deep(.list-kpi.可跳转:hover) {
  border-color: #9fc1ee;
  box-shadow: 0 8px 24px rgba(47, 105, 237, 0.12);
}

.dashboard-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  min-width: 0;
}

.list-stack {
  display: grid;
  gap: 8px;
}

.dashboard-body > .grid-2 {
  align-items: start;
}

.dashboard-body .panel,
.dashboard-body .panel-body,
.dashboard-body .list-stack {
  min-width: 0;
}

.dashboard-body .record-card {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.dashboard-body .record-top {
  min-width: 0;
}

.dashboard-body .record-top strong {
  flex: 1 1 auto;
  min-width: 0;
}

.dashboard-body .record-top .status {
  flex: 0 0 auto;
  white-space: nowrap;
}

.insight-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  min-width: 0;
}

.insight-grid > .panel {
  min-width: 0;
  height: 100%;
  margin-top: 0;
}

.趋势表 {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.趋势表 th,
.趋势表 td {
  padding: 7px 9px;
  border-bottom: 1px solid var(--line-soft);
  text-align: right;
}

.趋势表 th:first-child,
.趋势表 td:first-child {
  text-align: left;
}

.趋势表 th {
  color: var(--text-3);
  font-weight: 700;
}

.趋势表 tbody tr:last-child td {
  border-bottom: 0;
}

.紧凑列表 {
  display: grid;
  gap: 6px;
  min-height: 84px;
}

.紧凑条目 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  padding: 7px 9px;
  border: 1px solid var(--line-soft);
  border-radius: 7px;
  background: #fff;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.紧凑条目:hover {
  border-color: #a9c7ed;
  background: #f7fbff;
}

.紧凑条目 > span {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.紧凑条目 strong,
.紧凑条目 b {
  overflow: hidden;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.紧凑条目 small {
  overflow: hidden;
  color: var(--text-3);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.紧凑条目 .条目右侧 {
  flex: 0 0 auto;
  text-align: right;
}

.条形列表,
.漏斗列表 {
  display: grid;
  gap: 8px;
  min-height: 84px;
}

.条形行,
.漏斗行 {
  display: grid;
  grid-template-columns: minmax(78px, 0.9fr) minmax(80px, 1.4fr) 32px;
  align-items: center;
  gap: 8px;
  font-size: 10.5px;
}

.条形行 > span,
.漏斗行 > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.条形行 > strong,
.漏斗行 > strong {
  color: var(--text-2);
  text-align: right;
}

.条形轨道,
.漏斗轨道 {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: #edf2f8;
}

.条形轨道 i,
.漏斗轨道 i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #65a9e7, #2f69ed);
}

.漏斗轨道 i {
  background: linear-gradient(90deg, #48b99b, #0b8d69);
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
