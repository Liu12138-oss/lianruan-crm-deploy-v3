<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";

import {
  查询阶段9列表,
  读取阶段9概览,
  type 阶段9记录,
} from "../../api/business-client.js";
import WarKpis from "../../components/war/WarKpis.vue";
import type { 指标项 } from "../../components/war/types.js";
import { 日期时间文本, 文本 } from "../../shared/format/business-format.js";

interface 依赖项 {
  name: string;
  status: string;
  message: string;
  latencyMs?: number;
}

const 加载中 = ref(false);
const 错误 = ref("");
const 日志列表 = ref<阶段9记录[]>([]);
const 日志总数 = ref(0);
const 页码 = ref(1);
const 每页 = 40;
const 依赖列表 = ref<依赖项[]>([]);
const 依赖可用 = ref(false);
const 迁移状态 = ref<{ 批次编号: string; 正式落表: string; 校验结论: string } | null>(null);
const 搜索词 = ref("");

/**
 * 操作审计分类：与后端 module_code 归集口径一一对应。
 * 「后台管理操作」反向收口其余全部模块，保证新增模块不会从审计分类里漏掉。
 */
const 审计分类项 = ["全部", "客户操作", "线索操作", "商机操作", "渠道操作", "订单操作", "后台管理操作"];
const 当前分类 = ref("全部");
const 分类计数 = ref<Record<string, number>>({});

const 空态文案 = computed(() =>
  当前分类.value === "线索操作"
    ? "线索模块暂未产生审计记录：外采线索当前为只读数据，接入写入链路后会自动归集到该分类。"
    : "没有符合条件的审计记录。",
);

function 取(行: 阶段9记录, ...键列表: string[]): string {
  const 数据 = (行.原始数据 as Record<string, unknown>) || {};
  return 文本(...键列表.map((键) => 数据[键]), ...键列表.map((键) => (行 as never)?.[键]));
}

function 结果文本(行: 阶段9记录): string {
  const 结果 = 取(行, "result", "resultCode", "status") || 行.状态 || 行.状态名称;
  const 归一 = String(结果).trim().toLowerCase();
  if (归一 === "success" || 归一 === "ok" || 归一 === "已发送") return "成功";
  if (归一 === "failed" || 归一 === "failure" || 归一 === "error") return "失败";
  if (归一 === "queued") return "排队中";
  if (归一 === "pending") return "待处理";
  return 文本(行.状态名称, 结果) || "—";
}

function 操作人(行: 阶段9记录): string {
  return 文本(取(行, "operatorName", "username", "createdBy"), 行.负责人, "—");
}

function 动作(行: 阶段9记录): string {
  return 动作清洗(文本(行.标题, 取(行, "action", "event", "title"), "未记录动作"));
}

function 对象(行: 阶段9记录): string {
  const 名称 = 取(行, "targetName", "objectName");
  if (名称) return 名称;
  const 编号 = 取(行, "targetId") || 行.编号 || "";
  return 是否业务编号(编号) ? 编号 : "—";
}

const 依赖名称映射: Record<string, string> = {
  config: "配置校验",
  postgres: "数据库",
  redis: "Redis 缓存",
  migration: "数据库迁移",
};

function 依赖中文名(name: string): string {
  return 依赖名称映射[name] || name;
}

function 依赖(name: string): 依赖项 | undefined {
  return 依赖列表.value.find((项) => 项.name === name);
}

/**
 * 审计结果失败总数：取服务端全量计数，而不是已加载页的局部统计，
 * 否则最新 500 条里没有失败记录时会错误显示 0。
 */
const 失败总数 = ref(0);

let 搜索定时器: number | undefined;

watch(搜索词, () => {
  window.clearTimeout(搜索定时器);
  搜索定时器 = window.setTimeout(() => {
    页码.value = 1;
    void 加载日志();
  }, 300);
});

watch(当前分类, () => {
  页码.value = 1;
  void 加载日志();
});

function 翻页(方向: number): void {
  const 最大页 = Math.max(1, Math.ceil(日志总数.value / 每页));
  const 目标页 = Math.min(最大页, Math.max(1, 页码.value + 方向));
  if (目标页 === 页码.value) return;
  页码.value = 目标页;
  void 加载日志();
}

const 详情 = ref<阶段9记录 | null>(null);

/* ---------------------------------------------------------------------------
 * 审计详情的「用户视图」口径：
 * 后端代码（角色、模块、对象类型、字段名）只在接口里流转，
 * 页面统一翻译成中文名称展示，纯技术编号不再出现。
 * ------------------------------------------------------------------------- */
const 角色中文映射: Record<string, string> = {
  superadmin: "超级管理员",
  admin: "管理员",
  region_admin: "区域管理员",
  region_manager: "区域管理员",
  partner_admin: "渠道管理员",
  partner_user: "渠道用户",
  staff: "内部员工",
  auditor: "审计员",
  system: "系统",
};

const 模块中文映射: Record<string, string> = {
  customers: "客户管理",
  customer: "客户管理",
  leads: "线索管理",
  registrations: "客户报备",
  registration: "客户报备",
  opportunities: "商机作战",
  opportunity: "商机作战",
  quotes: "报价单",
  quote: "报价单",
  orders: "订单中心",
  order_preapproval: "订单预审",
  partners: "渠道管理",
  partner: "渠道管理",
  users: "账号管理",
  accounts: "账号管理",
  organization: "组织与账号",
  auth: "登录认证",
  certificates: "证书与风险",
  workload: "产品工作量",
  products: "产品目录",
  message_platform: "消息与提醒",
  messages: "消息中心",
  audit: "操作审计",
  openapi: "开放接口",
};

const 对象类型中文映射: Record<string, string> = {
  message_event_rule: "提醒规则",
  message_channel: "消息渠道",
  message_template: "消息模板",
  channel_member: "渠道成员",
  delivery_workload_rule: "交付工作量规则",
  workload_mapping: "工作量映射",
  workload_rule: "工作量规则",
  order: "订单",
  organization: "组织单元",
  partner: "渠道商",
  user: "账号",
  registration: "客户报备",
  customer: "客户",
  opportunity: "商机",
  quote: "报价单",
  product: "产品",
  feature: "功能模块",
  hardware: "硬件",
  certificate: "证书",
};

const 变更字段中文映射: Record<string, string> = {
  id: "编号",
  uuid: "编号",
  name: "名称",
  displayName: "姓名",
  title: "标题",
  stage: "商机阶段",
  amount: "金额",
  totalAmount: "总金额",
  customer: "客户",
  customerName: "客户名称",
  region: "区域",
  regionId: "所属区域",
  regionName: "所属区域",
  partnerId: "所属渠道",
  partnerName: "所属渠道",
  city: "城市",
  province: "省份",
  address: "地址",
  email: "邮箱",
  phone: "电话",
  mobile: "手机号",
  notes: "备注",
  remark: "备注",
  reason: "原因",
  level: "渠道级别",
  partnerLevel: "渠道级别",
  role: "角色",
  roleName: "角色",
  staffRole: "角色",
  businessRoleCode: "业务角色",
  businessRoleName: "业务角色",
  memberRoleCode: "成员角色",
  status: "状态",
  statusCode: "状态",
  toStatus: "变更为状态",
  fromStatus: "原状态",
  active: "是否启用",
  archived: "是否归档",
  accountDisabled: "账号是否停用",
  deleted: "是否删除",
  count: "数量",
  item: "明细项",
  items: "订单明细",
  maxPoints: "分数上限",
  minPoints: "分数下限",
  personDays: "人天",
  sortOrder: "排序",
  ruleType: "规则类型",
  condition: "规则条件",
  triggerCode: "触发类型",
  approvalRound: "审批轮次",
  deliveryTag: "交付标签",
  deliveryTags: "交付标签",
  productType: "产品类型",
  productTypeLabel: "产品类型",
  submittedAt: "提交时间",
  createdAt: "创建时间",
  updatedAt: "更新时间",
  lastFollowAt: "最近跟进时间",
  joinDate: "入职时间",
  startedAt: "开始时间",
  finishedAt: "完成时间",
  createdBy: "创建人",
  operatorName: "操作人",
  approvedBy: "审批人",
  userId: "成员",
  staffId: "成员",
  industry: "行业",
  isTechService: "是否技术服务",
  techServiceType: "技术服务类型",
  parentPartnerIds: "上级渠道",
  quoteCount: "报价单数",
  orderCount: "订单数",
  totalAmt: "成交金额",
  source: "来源",
  file: "文件",
  fileName: "文件名称",
};

/** 附加信息只展示登记过的业务字段，接口参数、请求体等内部信息不再直出。 */
const 附加字段中文映射: Record<string, string> = {
  partnerName: "所属渠道",
  targetName: "对象名称",
  operatorName: "操作人",
  projectName: "项目名称",
  customerName: "客户名称",
  fileName: "文件名称",
  region: "区域",
  count: "记录数",
  source: "来源",
  message: "说明",
};

/** 状态与枚举值中文化：只有整值命中才翻译，避免误改业务名称。 */
const 状态值中文映射: Record<string, string> = {
  active: "启用",
  disabled: "停用",
  inactive: "停用",
  success: "成功",
  failed: "失败",
  failure: "失败",
  queued: "排队中",
  pending: "待处理",
  pending_primary_confirm: "待一级确认",
  region_pending: "待区管确认",
  pending_superadmin_confirm: "待超管确认",
  primary_confirmed: "一级已确认",
  confirmed: "已确认",
  completed: "已完成",
  cancelled: "已取消",
  canceled: "已取消",
  returned_to_primary: "已退回一级渠道",
  returned_to_secondary: "已退回二级渠道",
  returned_to_region: "已退回区域",
  draft: "草稿",
  draft_calculated: "草稿核算",
  submitted: "已提交",
  approved: "已确认",
  converted: "已转订单",
  none: "未分级",
  lep: "核心渠道",
  gold: "金牌",
  silver: "银牌",
  bronze: "铜牌",
  primary: "一级渠道",
  secondary: "二级渠道",
  industry: "行业渠道",
  full: "完整服务",
  developing: "建设中",
  staff: "内部员工",
  superadmin: "超级管理员",
  admin: "管理员",
  partner_admin: "渠道管理员",
  channel_sales: "渠道销售",
  region_confirmed: "区域已确认",
  EPP_BASE: "EPP 基础交付",
  base: "基础",
  seed: "系统初始化",
  true: "是",
  false: "否",
};

function 取值中文(映射表: Record<string, string>, 原值: string, 兜底: string): string {
  if (!原值 || 原值 === "—") return "—";
  return 映射表[原值] || (/[\u4e00-\u9fa5]/.test(原值) ? 原值 : 兜底);
}

/** 时间类字段：按用户习惯格式化为「YYYY/MM/DD hh:mm」，不展示 ISO 原文。 */
const 时间字段集合 = new Set([
  "submittedAt",
  "createdAt",
  "updatedAt",
  "lastFollowAt",
  "startedAt",
  "finishedAt",
  "joinDate",
  "timestamp",
]);

/** 值展示：枚举转中文、时间转本地格式，数组与对象只给概括，不把 JSON 直接倒给用户。 */
function 值展示(值: unknown, 键 = ""): string {
  if (值 === null || 值 === undefined || 值 === "") return "空";
  if (typeof 值 === "boolean") return 值 ? "是" : "否";
  if (Array.isArray(值)) return 值.length ? `共 ${值.length} 项` : "空";
  if (typeof 值 === "object") return "已更新";
  const 原值 = String(值).trim();
  if (!原值) return "空";
  if (时间字段集合.has(键)) return 日期时间文本(原值);
  const 中文 = 状态值中文映射[原值] || 状态值中文映射[原值.toLowerCase()];
  if (中文) return 中文;
  // 未登记的全英文取值多为开发侧代码，直接展示会超出普通用户理解范围。
  if (/^[A-Za-z][A-Za-z0-9_]*$/.test(原值)) return "已设置";
  return 原值;
}

/** 业务编号识别：UUID 与长哈希属于技术编号，不展示给用户。 */
function 是否业务编号(值: string): boolean {
  const 原值 = 值.trim();
  if (!原值) return false;
  if (/^[0-9a-f]{24,}$/i.test(原值)) return false;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(原值)) return false;
  return /^[A-Za-z0-9-]+$/.test(原值) && /\d/.test(原值) && 原值.length <= 32;
}

const 详情原始 = computed<Record<string, unknown>>(
  () => (详情.value?.原始数据 as Record<string, unknown>) || {},
);

const 详情角色 = computed(() => 取值中文(角色中文映射, 文本(详情原始.value.actorRole), "其他角色"));
const 详情模块 = computed(() => 取值中文(模块中文映射, 文本(详情原始.value.moduleCode), "其他模块"));
const 详情对象类型 = computed(() =>
  取值中文(对象类型中文映射, 文本(详情原始.value.targetType), "业务对象"),
);
const 详情对象名称 = computed(() => 文本(详情原始.value.targetName));

const 变更字段 = computed(() => {
  const 前 = (详情原始.value.beforeJson as Record<string, unknown> | null) || {};
  const 后 = (详情原始.value.afterJson as Record<string, unknown> | null) || {};
  return [...new Set([...Object.keys(前), ...Object.keys(后)])]
    .map((键) => ({
      键,
      标签: 变更字段中文映射[键] || "",
      前: 值展示(前[键], 键),
      后: 值展示(后[键], 键),
    }))
    .filter((项) => 项.标签 && !(项.前 === "空" && 项.后 === "空"))
    .map((项) => ({ ...项, 有变化: 项.前 !== 项.后 }));
});

const 隐藏字段数 = computed(() => {
  const 前 = (详情原始.value.beforeJson as Record<string, unknown> | null) || {};
  const 后 = (详情原始.value.afterJson as Record<string, unknown> | null) || {};
  const 全部 = [...new Set([...Object.keys(前), ...Object.keys(后)])];
  return 全部.filter((键) => !变更字段中文映射[键]).length;
});

const 附加字段 = computed(() =>
  Object.entries(详情原始.value)
    .filter(
      ([键, 值]) =>
        附加字段中文映射[键] && 值 !== null && 值 !== undefined && 值 !== "" && typeof 值 !== "object",
    )
    .map(([键, 值]) => ({ 键, 标签: 附加字段中文映射[键], 值: 值展示(值) }))
    .filter((项) => /[\u4e00-\u9fa5]/.test(项.值) || /^[\d,.\-]+$/.test(项.值)),
);

/** 动作标题清洗：历史数据里夹带的后端字段名与枚举值统一翻译成中文。 */
const 动作词中文映射: Record<string, string> = {
  approvedBy: "审批人",
  partnerLevel: "渠道级别",
  techServiceType: "技术服务类型",
  parentPartnerIds: "上级渠道",
  lastFollowAt: "最近跟进时间",
  accountMissing: "账号缺失",
  isTechService: "是否技术服务",
  quoteCount: "报价单数",
  orderCount: "订单数",
  totalAmt: "成交金额",
  createdBy: "创建人",
  partnerId: "所属渠道",
  staffId: "成员",
  userId: "成员",
  level: "渠道级别",
  industry: "行业",
  status: "状态",
  staff: "成员",
  deleted: "已删除",
  id: "编号",
  items: "明细",
  quote_profit: "报价收益",
  draft_calculated: "草稿核算",
};

function 动作清洗(原始动作: string): string {
  const 原值 = 原始动作.trim();
  if (!原值) return 原始动作;
  if (/^Auto audit:/i.test(原值)) return "系统自动记录业务变更";
  if (/^Quote updated successfully$/i.test(原值)) return "报价单已更新";
  if (/^EACCES:/.test(原值)) return "文件目录创建失败（权限不足）";
  return 原值
    .replace(
      /([A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)*)/g,
      (词) => 动作词中文映射[词] || 动作词中文映射[词.toLowerCase()] || 词,
    )
    .replace(/「([^」]*)」/g, (_原文, 内容: string) => {
      const 中文 = 状态值中文映射[内容] || 状态值中文映射[String(内容).toLowerCase()];
      return `「${中文 || 内容}」`;
    });
}

function 打开详情(行: 阶段9记录): void {
  详情.value = 行;
}

function 关闭详情(): void {
  详情.value = null;
}

const 指标 = computed<指标项[]>(() => {
  const postgres = 依赖("postgres");
  const redis = 依赖("redis");
  const 服务状态 = 依赖列表.value.length
    ? 依赖列表.value.every((项) => 项.status === "ok")
      ? "正常"
      : "异常"
    : "未知";
  return [
    {
      label: "服务状态",
      value: 服务状态,
      unit: "",
      note: 依赖可用.value ? `${依赖列表.value.length} 项依赖已检查` : "依赖检查接口不可用",
    },
    {
      label: "数据库",
      value: postgres ? (postgres.status === "ok" ? "正常" : "异常") : "未知",
      unit: "",
      note: postgres ? 文本(postgres.message, "PostgreSQL") : "未取到依赖检查结果",
    },
    {
      label: "Redis",
      value: redis ? (redis.status === "ok" ? "正常" : "异常") : "未知",
      unit: "",
      note: redis ? 文本(redis.message, "Redis") : "未取到依赖检查结果",
    },
    { label: "最近备份", value: "—", unit: "", note: "当前未接入备份状态接口" },
    {
      label: "待处理告警",
      value: String(失败总数.value),
      unit: "项",
      note: "审计结果失败记录总数（库内全量统计）",
    },
    {
      label: "迁移版本",
      value: 文本(迁移状态.value?.批次编号, "—"),
      unit: "",
      note: 迁移状态.value ? `校验结论：${文本(迁移状态.value.校验结论, "—")}` : "未取到迁移状态",
    },
  ];
});

onMounted(() => void 加载());

async function 加载日志() {
  加载中.value = true;
  错误.value = "";
  try {
    const 关键词 = 搜索词.value.trim();
    const 分类 = 当前分类.value === "全部" ? undefined : 当前分类.value;
    const 日志结果 = await 查询阶段9列表("audit", {
      ...(关键词 ? { keyword: 关键词 } : {}),
      ...(分类 ? { module: 分类 } : {}),
      page: 页码.value,
      pageSize: 每页,
    });
    日志列表.value = 日志结果.数据;
    日志总数.value = Number(日志结果.分页?.总数 || 日志结果.数据.length);
  } catch (异常) {
    错误.value = 异常 instanceof Error ? 异常.message : "审计数据加载失败。";
  } finally {
    加载中.value = false;
  }
}

/** 分类计数：只统计各分类记录总数，用于分类标签展示与线索空态提示。 */
async function 加载分类计数() {
  try {
    const 分类 = 审计分类项.filter((项) => 项 !== "全部");
    const 结果 = await Promise.all(
      分类.map(async (项) => {
        const 列表结果 = await 查询阶段9列表("audit", { module: 项, page: 1, pageSize: 1 });
        return [项, Number(列表结果.分页?.总数 || 0)] as const;
      }),
    );
    分类计数.value = Object.fromEntries(结果);
  } catch {
    分类计数.value = {};
  }
}

async function 加载() {
  await Promise.all([
    加载日志(),
    加载分类计数(),
    (async () => {
      const 概览结果 = await 读取阶段9概览().catch(() => null);
      迁移状态.value = 概览结果?.迁移状态 ?? null;
    })(),
    (async () => {
      const 依赖结果 = await fetch("/health/dependencies", { credentials: "include" })
        .then((响应) => (响应.ok ? 响应.json() : null))
        .catch(() => null);
      const 依赖数据 = (依赖结果 as { data?: { dependencies?: 依赖项[] } } | null)?.data;
      依赖列表.value = 依赖数据?.dependencies ?? [];
      依赖可用.value = 依赖列表.value.length > 0;
    })(),
    (async () => {
      const 失败计数 = await Promise.all([
        查询阶段9列表("audit", { status: "failure", pageSize: 1 }),
        查询阶段9列表("audit", { status: "failed", pageSize: 1 }),
      ]).catch(() => null);
      失败总数.value = 失败计数
        ? Number(失败计数[0]?.分页?.总数 || 0) + Number(失败计数[1]?.分页?.总数 || 0)
        : 0;
    })(),
  ]);
}
</script>

<template>
  <div class="vui war-artboard war-artboard-flow 审计页">
    <WarKpis :items="指标" />

    <div class="grid-2 审计网格">
      <section class="panel">
        <header class="panel-head">
          <div>
            <h2>操作审计</h2>
            <p>关键操作、账号、数据范围和结果，支持按业务分类筛选（点击行查看变更详情）。</p>
          </div>
          <div class="field search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input v-model="搜索词" placeholder="搜索操作人、动作或结果" />
          </div>
        </header>
        <div class="审计分类条">
          <div class="section-tabs 审计分类">
            <button
              v-for="分类 in 审计分类项"
              :key="分类"
              type="button"
              class="section-tab"
              :class="{ active: 当前分类 === 分类 }"
              @click="当前分类 = 分类"
            >
              <span>{{ 分类 }}</span>
              <span v-if="分类 !== '全部' && 分类计数[分类] !== undefined" class="分类计数">
                {{ 分类计数[分类] }}
              </span>
            </button>
          </div>
        </div>
        <div class="panel-body flush">
          <div v-if="加载中" class="war-empty">正在加载审计记录…</div>
          <div v-else-if="错误" class="war-empty">{{ 错误 }}</div>
          <div v-else class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>操作人</th>
                  <th>动作</th>
                  <th>对象</th>
                  <th>结果</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="日志 in 日志列表"
                  :key="日志.id"
                  class="日志行"
                  title="点击查看变更详情"
                  @click="打开详情(日志)"
                >
                  <td>{{ 日期时间文本(文本(日志.创建时间, 取(日志, "createdAt"))) }}</td>
                  <td>{{ 操作人(日志) }}</td>
                  <td><span class="record-title">{{ 动作(日志) }}</span></td>
                  <td>{{ 对象(日志) }}</td>
                  <td>
                    <span class="status" :class="结果文本(日志) === '失败' ? 'red' : 'green'">
                      {{ 结果文本(日志) }}
                    </span>
                  </td>
                </tr>
                <tr v-if="!日志列表.length">
                  <td colspan="5" class="war-empty">{{ 空态文案 }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="!加载中 && !错误" class="pagination">
            <span class="pagination-info">共 {{ 日志总数 }} 条，第 {{ 页码 }} 页</span>
            <button class="btn btn-sm" type="button" :disabled="页码 <= 1" @click="翻页(-1)">
              上一页
            </button>
            <button class="btn btn-sm active" type="button">{{ 页码 }}</button>
            <button
              class="btn btn-sm"
              type="button"
              :disabled="页码 * 每页 >= 日志总数"
              @click="翻页(1)"
            >
              下一页
            </button>
          </div>
        </div>
      </section>

      <section class="panel">
        <header class="panel-head">
          <div>
            <h2>服务健康</h2>
            <p>存活、就绪和依赖检查。</p>
          </div>
        </header>
        <div class="panel-body">
          <div class="member-risk-list">
            <div
              v-for="项 in 依赖列表"
              :key="项.name"
              class="member-risk-row"
              :class="{ warning: 项.status !== 'ok' }"
            >
              <span>
                <strong>{{ 依赖中文名(项.name) }}</strong>
                <small>{{ 文本(项.message, "—") }}</small>
              </span>
              <b>{{ 项.status === "ok" ? "正常" : "异常" }}</b>
            </div>
            <div v-if="!依赖列表.length" class="member-risk-row warning">
              <span>
                <strong>依赖检查不可用</strong>
                <small>未能读取 /health/dependencies。</small>
              </span>
              <b>未知</b>
            </div>
          </div>

          <div class="info-grid 迁移信息">
            <div class="info-item">
              <span>迁移批次</span><strong>{{ 文本(迁移状态?.批次编号, "—") }}</strong>
            </div>
            <div class="info-item">
              <span>正式落表</span><strong>{{ 文本(迁移状态?.正式落表, "—") }}</strong>
            </div>
            <div class="info-item">
              <span>校验结论</span><strong>{{ 文本(迁移状态?.校验结论, "—") }}</strong>
            </div>
            <div class="info-item">
              <span>最近备份</span><strong>未接入</strong>
            </div>
          </div>
        </div>
      </section>
    </div>

    <div v-if="详情" class="modal-overlay" @click.self="关闭详情">
      <section class="modal modal-lg">
        <header class="modal-header">
          <h2 class="modal-title">审计详情 · {{ 动作(详情) }}</h2>
          <button class="modal-close" type="button" @click="关闭详情">×</button>
        </header>
        <div class="modal-body">
          <section class="详情分组">
            <h3>基本信息</h3>
            <div class="info-grid three">
              <div class="info-item">
                <span>时间</span><strong>{{ 日期时间文本(文本(详情.创建时间)) }}</strong>
              </div>
              <div class="info-item"><span>操作人</span><strong>{{ 操作人(详情) }}</strong></div>
              <div class="info-item">
                <span>角色</span><strong>{{ 详情角色 }}</strong>
              </div>
              <div class="info-item">
                <span>模块</span><strong>{{ 详情模块 }}</strong>
              </div>
              <div class="info-item"><span>动作</span><strong>{{ 动作(详情) }}</strong></div>
              <div class="info-item"><span>结果</span><strong>{{ 结果文本(详情) }}</strong></div>
              <div class="info-item">
                <span>对象类型</span><strong>{{ 详情对象类型 }}</strong>
              </div>
              <div v-if="详情对象名称" class="info-item">
                <span>对象名称</span><strong>{{ 详情对象名称 }}</strong>
              </div>
              <div class="info-item">
                <span>IP</span><strong>{{ 文本(详情原始.ip) || "—" }}</strong>
              </div>
            </div>
          </section>

          <section class="详情分组">
            <h3>变更前后</h3>
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>字段</th>
                    <th>变更前</th>
                    <th>变更后</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="项 in 变更字段" :key="项.键" :class="{ 变更行: 项.有变化 }">
                    <td>{{ 项.标签 }}</td>
                    <td>{{ 项.前 }}</td>
                    <td>{{ 项.后 }}</td>
                  </tr>
                  <tr v-if="!变更字段.length">
                    <td colspan="3"><div class="war-empty">该记录未记录变更明细。</div></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-if="隐藏字段数" class="变更说明">
              另有 {{ 隐藏字段数 }} 项内部技术字段不面向业务展示，已自动隐藏。
            </p>
          </section>

          <section class="详情分组">
            <h3>附加信息</h3>
            <div v-if="附加字段.length" class="info-grid">
              <div v-for="项 in 附加字段" :key="项.键" class="info-item">
                <span>{{ 项.标签 }}</span><strong>{{ 项.值 }}</strong>
              </div>
            </div>
            <div v-else class="war-empty">无附加信息。</div>
          </section>
        </div>
        <footer class="modal-footer">
          <button class="btn btn-default" type="button" @click="关闭详情">关闭</button>
        </footer>
      </section>
    </div>
  </div>
</template>

<style scoped>
.审计网格 .panel-head {
  gap: 10px;
}

/* 变更明细的技术字段隐藏说明：弱化展示，避免干扰业务信息。 */
.变更说明 {
  margin: 8px 0 0;
  color: var(--text-3);
  line-height: 1.6;
}

/* 审计详情内容较长：放宽弹窗高度上限，避免「附加信息」被裁在可视区之外。 */
.审计页 .modal {
  max-height: calc(100vh - 40px);
}

/* 审计分类条：与页头分隔，标签换行展示，计数使用次要色。 */
.审计分类条 {
  padding: 10px 18px 2px;
}

.审计分类 {
  flex-wrap: wrap;
}

.审计分类 .section-tab {
  gap: 5px;
}

.审计分类 .分类计数 {
  color: var(--text-3);
  font-weight: 400;
}

.审计分类 .section-tab.active .分类计数 {
  color: var(--blue-strong);
}

.审计网格 .field.search {
  width: 220px;
  min-width: 160px;
}

.迁移信息 {
  margin-top: 12px;
}

.日志行 {
  cursor: pointer;
}

.日志行:hover {
  background: rgba(47, 105, 237, 0.06);
}

.详情分组 {
  margin-bottom: 18px;
}

.详情分组 h3 {
  margin: 0 0 10px;
  color: var(--text-1);
  font-size: 16px;
  font-weight: 700;
}

.详情分组 .table-wrap {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 8px;
}

.详情分组 .data-table td,
.详情分组 .data-table th {
  word-break: break-all;
  white-space: normal;
}

.变更行 td:last-child {
  color: var(--success, #0b8d69);
  font-weight: 700;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 28px;
  border-top: 1px solid var(--divider);
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
