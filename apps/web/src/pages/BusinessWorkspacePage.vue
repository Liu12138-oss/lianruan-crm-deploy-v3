<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import {
  type 交付工作量规则项,
  保存交付工作量规则,
  保存工作量映射,
  创建商机,
  创建开放接口客户端,
  创建报价,
  创建报备,
  创建订单,
  type 工作量映射项,
  type 开放接口客户端,
  type 开放接口密钥结果,
  type 开放接口总览,
  type 开放接口日志,
  type 报价试算结果,
  更新商机,
  更新开放接口客户端,
  更新报价状态,
  更新报备状态,
  更新订单状态,
  查询交付工作量规则,
  查询工作量映射,
  查询开放接口客户端,
  查询开放接口日志,
  查询阶段9列表,
  试算报价,
  读取开放接口总览,
  读取阶段9概览,
  重置开放接口密钥,
  type 阶段9列表结果,
  type 阶段9概览,
  type 阶段9模块,
  type 阶段9记录,
} from "../api/business-client.js";
import { useSessionStore } from "../stores/session.js";

type 页面动作 = "overview" | "list" | "create" | "import" | "platform";
type 列类型 = "text" | "money" | "status" | "partnerName" | "date" | "count";
type 产品目录标签 = "products" | "packages";
type 商机视图 = "list" | "kanban";
type 报价模式 = "package" | "supplement" | "custom";
type 审核标签 = "registration" | "partner" | "staff";

interface 列定义 {
  标题: string;
  类型?: 列类型;
  宽度?: string;
  取值: (row: 阶段9记录) => string | number;
}

interface 状态选项 {
  标签: string;
  值: string;
}

interface 详情字段 {
  标签: string;
  值: string;
  重点?: boolean;
}

interface 详情分组 {
  标题: string;
  字段: 详情字段[];
}

interface 产品目录分类 {
  id: string;
  名称: string;
  图标: string;
  描述: string;
  类型: "software" | "hardware";
  模块数: number;
  功能数: number;
  数据: 阶段9记录[];
}

const 路由 = useRoute();
const 路由器 = useRouter();
const 会话 = useSessionStore();
const 加载中 = ref(false);
const 提交中 = ref(false);
const 错误提示 = ref("");
const 概览 = ref<阶段9概览 | null>(null);
const 列表结果 = ref<阶段9列表结果>({ 数据: [], 分页: { 页码: 1, 每页: 20, 总数: 0 } });
const 详情 = ref<阶段9记录 | null>(null);
const 试算结果 = ref<报价试算结果 | null>(null);
const 产品候选 = ref<阶段9记录[]>([]);
const 商机候选 = ref<阶段9记录[]>([]);
const 报备候选 = ref<阶段9记录[]>([]);
const 报价候选 = ref<阶段9记录[]>([]);
const 渠道候选 = ref<阶段9记录[]>([]);
const 窄屏 = ref(false);
const 导入文件名 = ref("");
const 导入预检结果 = ref("");
const 上次模块 = ref<阶段9模块 | undefined>();
const 移动管理业务模块 = ref<阶段9模块>("registrations");
const 产品当前标签 = ref<产品目录标签>("products");
const 产品分类详情 = ref<产品目录分类 | null>(null);
const 产品功能详情 = ref<阶段9记录 | null>(null);
const 商机当前视图 = ref<商机视图>("list");
const 报价当前模式 = ref<报价模式>("package");
const 报备步骤 = ref(1);
const 审核当前标签 = ref<审核标签>("registration");
const 开放接口总览数据 = ref<开放接口总览 | null>(null);
const 开放接口客户端列表 = ref<开放接口客户端[]>([]);
const 开放接口日志列表 = ref<开放接口日志[]>([]);
const 开放接口用户候选 = ref<阶段9记录[]>([]);
const 开放接口弹窗 = ref(false);
const 开放接口编辑中 = ref(false);
const 开放接口编辑编号 = ref("");
const 开放接口表单错误 = ref("");
const 开放接口密钥弹窗 = ref(false);
const 开放接口密钥展示结果 = ref<开放接口密钥结果>({ id: "", appKey: "", appSecret: "" });
const 工作量搜索词 = ref("");
const 工作量映射列表 = ref<工作量映射项[]>([]);
const 工作量规则列表 = ref<交付工作量规则项[]>([]);
const 工作量规则弹窗 = ref(false);
const 工作量规则编辑编号 = ref("");

const 筛选 = reactive({
  keyword: "",
  status: "",
  level: "",
  region: "",
  page: 1,
});

const 表单 = reactive({
  customer: "",
  creditCode: "",
  contact: "",
  phone: "",
  email: "",
  industry: "",
  city: "",
  address: "",
  legalPerson: "",
  registrationId: "",
  opportunityName: "",
  project: "",
  amount: 0,
  stage: "registered",
  expectedClose: "",
  source: "渠道推荐",
  owner: "",
  tagsText: "",
  notes: "",
  firstFollow: "",
  partnerId: "",
  staffId: "",
  hasOpportunity: false,
  opportunityId: "",
  endpoints: 100,
  validDays: 30,
  productIds: [] as string[],
  quoteId: "",
});

const 开放接口表单 = reactive({
  name: "",
  boundUserId: "",
  status: "active",
  expiresAt: "",
  ipWhitelistText: "",
  allowedResources: ["*"] as string[],
  remark: "",
});

const 工作量映射表单 = reactive({
  featureId: "",
  deliveryTag: "",
});

const 工作量规则表单 = reactive({
  productTypeLabel: "",
  ruleType: "",
  minPoints: 1 as number | null,
  maxPoints: 5000 as number | null,
  personDays: 0,
  comboPersonDays: null as number | null,
  remark: "",
  active: true,
});

const 开放接口资源选项 = [
  { value: "*", label: "全部资源" },
  { value: "users", label: "用户" },
  { value: "partners", label: "渠道商" },
  { value: "registrations", label: "客户报备" },
  { value: "opportunities", label: "商机" },
  { value: "quotes", label: "报价" },
  { value: "orders", label: "订单" },
  { value: "products", label: "兼容产品" },
  { value: "features", label: "功能模块" },
  { value: "hardware", label: "硬件产品" },
  { value: "packages", label: "产品套餐" },
  { value: "product-tree", label: "产品目录树" },
  { value: "workload-mappings", label: "产品工作量映射" },
  { value: "workload-delivery-rules", label: "交付工作量规则" },
  { value: "audit-logs", label: "操作审计日志" },
];

const 工作量标签选项 = [
  { value: "EPP_BASE", label: "EPP（仅DLP基础）" },
  { value: "SENSITIVE_DATA", label: "敏感数据梳理" },
  { value: "UNIDES", label: "UniDES" },
  { value: "UNIAV", label: "UniAV" },
  { value: "NXG_NO_DLP", label: "NXG（不含DLP）" },
  { value: "NXG_WITH_DLP", label: "NXG（含DLP）" },
];

const 开放接口角色名称: Record<string, string> = {
  superadmin: "超级管理员",
  admin: "区域管理员",
  partner_admin: "企业管理员",
  staff: "员工",
  primary_partner: "一级渠道商",
  secondary_partner: "二级渠道商",
};

const 标题 = computed(() => String(路由.meta.标题 || "联软渠道平台"));
const 描述 = computed(() => String(路由.meta.描述 || ""));
const 路径推导模块 = computed<阶段9模块 | undefined>(() => {
  const path = String(路由.path);
  if (path.includes("/registration") || path.includes("/registrations")) return "registrations";
  if (path.includes("/opportunity") || path.includes("/opportunities")) return "opportunities";
  if (path.includes("/quote") || path.includes("/quotes")) return "quotes";
  if (path.includes("/order") || path.includes("/orders")) return "orders";
  if (path.includes("/products")) return "products";
  if (path.includes("/partners")) return "partners";
  if (path.includes("/account-manage") || path.includes("/partner-admin")) return "users";
  if (path.includes("/admin-review") || path.includes("/reviews")) return "approvals";
  if (path.includes("/audit-logs")) return "audit";
  if (path.includes("/openapi")) return "openapi";
  if (path.includes("/workload")) return "workload";
  return undefined;
});
const 路径推导动作 = computed<页面动作 | undefined>(() => {
  const path = String(路由.path);
  if (/\/(registration|registrations|opportunity|opportunities|quote|quotes)\/new$/.test(path)) {
    return "create";
  }
  if (path.endsWith("/import") || path.endsWith("/staff-import")) return "import";
  if (path.endsWith("/platform-admin")) return "platform";
  return undefined;
});
const 模块 = computed(() => (路由.meta.模块 as 阶段9模块 | undefined) || 路径推导模块.value);
const 当前页面动作 = computed<页面动作>(
  () => 路径推导动作.value || (路由.meta.页面动作 as 页面动作 | undefined) || "list",
);
const 是移动 = computed(() => String(路由.path).startsWith("/mobile") || 窄屏.value);
const 是渠道端 = computed(() => {
  const path = String(路由.path);
  return path.startsWith("/partner") || path.startsWith("/mobile/partner");
});
const 是移动管理端 = computed(() => String(路由.path).startsWith("/mobile/admin"));
const 是移动我的页 = computed(() => String(路由.path) === "/mobile/me");
const 是移动管理业务查询 = computed(() => String(路由.path) === "/mobile/admin/business");
const 当前业务模块 = computed<阶段9模块 | undefined>(() =>
  是移动管理业务查询.value ? 移动管理业务模块.value : 模块.value,
);
const 是开放接口页 = computed(() => 当前业务模块.value === "openapi");
const 是工作量配置页 = computed(() => 当前业务模块.value === "workload");
const 可新建 = computed(() =>
  ["registrations", "opportunities", "quotes"].includes(当前业务模块.value || ""),
);
const 新建按钮文案 = computed(() => {
  const 映射: Record<string, string> = {
    registrations: "新建报备",
    opportunities: "新建商机",
    quotes: "新建报价单",
  };
  return 映射[当前业务模块.value || ""] || "新增";
});
const 管理业务标签列表: Array<{ 名称: string; 模块: 阶段9模块 }> = [
  { 名称: "报备", 模块: "registrations" },
  { 名称: "商机", 模块: "opportunities" },
  { 名称: "报价", 模块: "quotes" },
  { 名称: "订单", 模块: "orders" },
];
const 商机阶段列表 = [
  { 键: "contacted", 名称: "1% 已联系上客户", 背景: "#e6f4ff", 点色: "#1677ff" },
  { 键: "registered", 名称: "10% 商机明确并报备", 背景: "#fff7e6", 点色: "#faad14" },
  { 键: "quoted", 名称: "20% 正式报价", 背景: "#fff0f6", 点色: "#eb2f96" },
  { 键: "budget", 名称: "30% 明确预算", 背景: "#f9f0ff", 点色: "#722ed1" },
  { 键: "design", 名称: "40% 技术交流/方案设计", 背景: "#f6ffed", 点色: "#52c41a" },
  { 键: "testing", 名称: "50% 产品测试", 背景: "#fff1f0", 点色: "#cf1322" },
  { 键: "negotiation", 名称: "70% 招投标/商务谈判", 背景: "#f0faff", 点色: "#0891b2" },
  { 键: "won", 名称: "100% 赢单", 背景: "#f6ffed", 点色: "#389e0d" },
  { 键: "cancelled", 名称: "项目取消", 背景: "#f5f5f5", 点色: "#8c8c8c" },
  { 键: "lost", 名称: "输单", 背景: "#fff1f0", 点色: "#cf1322" },
];
const 移动欢迎卡类 = computed(() =>
  是移动管理端.value ? "welcome-card--admin" : "welcome-card--partner",
);
const 欢迎用户名 = computed(() => 会话.用户名 || (是渠道端.value ? "渠道伙伴" : "管理员"));
const 移动渠道快捷入口 = [
  {
    名称: "客户报备",
    描述: "查看客户保护与报备状态",
    图标: "›",
    路径: "/mobile/partner/registrations",
  },
  {
    名称: "商机管理",
    描述: "跟进销售机会和阶段",
    图标: "›",
    路径: "/mobile/partner/opportunities",
  },
  { 名称: "报价管理", 描述: "查看报价单并转订单", 图标: "›", 路径: "/mobile/partner/quotes" },
  { 名称: "订单管理", 描述: "跟踪订单确认与履约", 图标: "›", 路径: "/mobile/partner/orders" },
  { 名称: "产品目录", 描述: "查看产品模块和套餐", 图标: "›", 路径: "/partner/products" },
  { 名称: "消息通知", 描述: "查看业务提醒", 图标: "›", 路径: "/mobile/me" },
];
const 桌面快捷入口 = computed(() =>
  是渠道端.value
    ? [
        { 图标: "📋", 标题: "客户报备", 描述: "提交客户保护", 路径: "/partner/registration/new" },
        { 图标: "🎯", 标题: "新建商机", 描述: "录入潜在客户", 路径: "/partner/opportunity/new" },
        { 图标: "💰", 标题: "制作报价单", 描述: "在线配置产品", 路径: "/partner/quote/new" },
        { 图标: "📦", 标题: "查看订单", 描述: "跟踪订单状态", 路径: "/partner/order" },
      ]
    : [
        { 图标: "✅", 标题: "审核中心", 描述: "处理待办事项", 路径: "/admin/admin-review" },
        { 图标: "🤝", 标题: "渠道商管理", 描述: "查看渠道体系", 路径: "/admin/partners" },
        { 图标: "📈", 标题: "经营报表", 描述: "查看业务贡献", 路径: "/admin/partner-report" },
        {
          图标: "🔌",
          标题: "OpenAPI 对接",
          描述: "查看接口配置",
          路径: "/admin/openapi-integration",
        },
      ],
);
const 最近商机列表 = computed(() => 过滤概览业务("商机"));
const 最近报价列表 = computed(() => 过滤概览业务("报价"));
const 概览左侧列表 = computed(() => (是渠道端.value ? 最近商机列表.value : 概览.value?.待办 || []));
const 概览右侧列表 = computed(() =>
  是渠道端.value ? 最近报价列表.value : 概览.value?.最近业务 || [],
);
const 产品线概览 = computed(() => {
  const 分组 = new Map<string, 阶段9记录[]>();
  for (const item of 产品候选.value.slice(0, 12)) {
    const key = item.类型 || 字段(item, "category", "类型") || "产品目录";
    分组.set(key, [...(分组.get(key) || []), item]);
  }
  return Array.from(分组.entries()).map(([类型, 数据]) => ({
    类型,
    数量: 数据.length,
    名称: 数据[0]?.标题 || 类型,
  }));
});
const 推荐套餐列表 = computed(() => 列表结果.value.数据.filter((row) => 是否套餐产品(row)));
const 硬件产品列表 = computed(() => 列表结果.value.数据.filter((row) => 是否硬件产品(row)));
const 报价套餐候选 = computed(() => 产品候选.value.filter((row) => 是否套餐产品(row)));
const 报价硬件候选 = computed(() => 产品候选.value.filter((row) => 是否硬件产品(row)));
const 报价功能候选 = computed(() =>
  产品候选.value.filter((row) => !是否套餐产品(row) && !是否硬件产品(row)),
);
const 报价当前候选 = computed(() => {
  if (报价当前模式.value === "package") {
    return 报价套餐候选.value.length ? 报价套餐候选.value : 产品候选.value.slice(0, 6);
  }
  if (报价当前模式.value === "supplement") {
    return 报价功能候选.value.length ? 报价功能候选.value : 产品候选.value.slice(0, 8);
  }
  return 报价功能候选.value.length ? 报价功能候选.value : 产品候选.value;
});
const 已选产品列表 = computed(() =>
  产品候选.value.filter((row) => 表单.productIds.includes(row.id)),
);
const 报价预估金额 = computed(() => {
  if (试算结果.value) return 试算结果.value.total;
  return 已选产品列表.value.reduce((sum, row) => sum + 数字字段(row, "金额", "price", "amount"), 0);
});
const 商机金额合计 = computed(() =>
  列表结果.value.数据.reduce((sum, row) => sum + 数字字段(row, "金额", "amount"), 0),
);
const 商机看板列表 = computed(() =>
  商机阶段列表.map((stage) => {
    const 数据 = 列表结果.value.数据.filter((row) => 商机阶段键(row) === stage.键);
    return {
      ...stage,
      数据,
      合计金额: 数据.reduce((sum, row) => sum + 数字字段(row, "金额", "amount"), 0),
    };
  }),
);
const 产品分类列表 = computed<产品目录分类[]>(() => {
  const 分组 = new Map<string, 阶段9记录[]>();
  const 软件产品 = 列表结果.value.数据.filter((row) => !是否套餐产品(row) && !是否硬件产品(row));
  for (const row of 软件产品) {
    const key = 产品分类名称(row);
    分组.set(key, [...(分组.get(key) || []), row]);
  }
  return Array.from(分组.entries()).map(([名称, 数据]) => {
    const 模块名称集合 = new Set(数据.map((row) => 产品模块名称(row)).filter(Boolean));
    return {
      id: 名称,
      名称,
      图标: 产品分类图标(名称),
      描述: 产品分类描述(名称, 数据),
      类型: "software",
      模块数: Math.max(模块名称集合.size, 1),
      功能数: 数据.length,
      数据,
    };
  });
});
const 商机漏斗 = computed(() => {
  const 数据 = (概览.value?.最近业务 || []).filter((item) => item.类型.includes("商机"));
  const 阶段 = [
    { 键: "registered", 名称: "已报备", 颜色: "#1890ff" },
    { 键: "quoted", 名称: "已报价", 颜色: "#4096ff" },
    { 键: "testing", 名称: "产品测试", 颜色: "#faad14" },
    { 键: "closing", 名称: "签约中", 颜色: "#52c41a" },
  ];
  return 阶段.map((item) => ({
    ...item,
    数量: 数据.filter((row) => `${row.状态} ${row.状态名称}`.toLowerCase().includes(item.键))
      .length,
  }));
});
const 状态选项列表 = computed<状态选项[]>(() => {
  const 通用 = [
    { 标签: "全部状态", 值: "" },
    { 标签: "待审核", 值: "pending" },
    { 标签: "已通过", 值: "approved" },
    { 标签: "正常", 值: "active" },
    { 标签: "草稿", 值: "draft" },
    { 标签: "已确认", 值: "confirmed" },
    { 标签: "已转订单", 值: "converted" },
  ];
  const 映射: Partial<Record<阶段9模块, 状态选项[]>> = {
    registrations: [
      { 标签: "全部状态", 值: "" },
      { 标签: "待审核", 值: "pending" },
      { 标签: "已通过", 值: "approved" },
      { 标签: "已驳回", 值: "rejected" },
      { 标签: "已取消", 值: "cancelled" },
    ],
    opportunities: [
      { 标签: "全部阶段", 值: "" },
      { 标签: "推进中", 值: "active" },
      { 标签: "已赢单", 值: "won" },
      { 标签: "已丢单", 值: "lost" },
      { 标签: "已取消", 值: "cancelled" },
    ],
    quotes: [
      { 标签: "全部状态", 值: "" },
      { 标签: "草稿", 值: "draft" },
      { 标签: "已提交", 值: "submitted" },
      { 标签: "已确认", 值: "approved" },
      { 标签: "已转订单", 值: "converted" },
      { 标签: "已驳回", 值: "rejected" },
    ],
    orders: [
      { 标签: "全部状态", 值: "" },
      { 标签: "待一级确认", 值: "pending_primary_confirm" },
      { 标签: "一级已确认", 值: "primary_confirmed" },
      { 标签: "待超管确认", 值: "pending_superadmin_confirm" },
      { 标签: "已确认", 值: "confirmed" },
      { 标签: "已完成", 值: "completed" },
      { 标签: "已驳回", 值: "rejected" },
    ],
    partners: [
      { 标签: "全部状态", 值: "" },
      { 标签: "启用", 值: "active" },
      { 标签: "停用", 值: "disabled" },
    ],
  };
  return 映射[当前业务模块.value || "registrations"] || 通用;
});
const 导入路径 = computed(() => {
  if (是渠道端.value || !当前业务模块.value) return "";
  const 映射: Partial<Record<阶段9模块, string>> = {
    registrations: "/admin/registration/import",
    opportunities: "/admin/opportunity/import",
    partners: "/admin/partners/import",
  };
  return 映射[当前业务模块.value] || "";
});
const 是审核中心 = computed(() => 当前业务模块.value === "approvals");
const 报备步骤列表 = computed(() =>
  表单.hasOpportunity
    ? ["客户信息", "项目信息", "指派渠道", "提交确认"]
    : ["客户信息", "指派渠道", "提交确认"],
);
const 报备第一步缺失 = computed(() => {
  const 缺失: string[] = [];
  if (!表单.customer.trim()) 缺失.push("客户名称");
  if (!表单.creditCode.trim()) 缺失.push("统一社会信用代码");
  if (!表单.industry.trim()) 缺失.push("所属行业");
  if (!表单.contact.trim()) 缺失.push("联系人姓名");
  if (!表单.phone.trim()) 缺失.push("联系电话");
  return 缺失;
});
const 报备第一步可继续 = computed(() => 报备第一步缺失.value.length === 0);
const 审核客户报备列表 = computed(() =>
  列表结果.value.数据.filter((row) => {
    const text = `${row.类型} ${字段(row, "targetType", "approvalType", "type")}`;
    return text.includes("客户报备") || text.includes("registration");
  }),
);
const 审核渠道商列表 = computed(() =>
  列表结果.value.数据.filter((row) => {
    const text = `${row.类型} ${字段(row, "targetType", "approvalType", "type")}`;
    return text.includes("渠道") || text.includes("partner");
  }),
);
const 审核员工列表 = computed(() =>
  列表结果.value.数据.filter((row) => {
    const text = `${row.类型} ${字段(row, "targetType", "approvalType", "type")}`;
    return text.includes("员工") || text.includes("staff") || text.includes("user");
  }),
);
const 当前审核列表 = computed(() => {
  if (审核当前标签.value === "partner") return 审核渠道商列表.value;
  if (审核当前标签.value === "staff") return 审核员工列表.value;
  return 审核客户报备列表.value;
});
const 开放接口文档列表 = computed(() => 开放接口总览数据.value?.docs || []);
const 开放接口核心资源 = computed(() => 开放接口总览数据.value?.coreResources || []);
const 开放接口BaseUrl = computed(() => 开放接口总览数据.value?.baseUrl || "/api/open/v1");
const 开放接口Token地址 = computed(
  () => 开放接口总览数据.value?.tokenEndpoint || `${开放接口BaseUrl.value}/auth/token`,
);
const 开放接口Token有效期 = computed(() => {
  const seconds = Number(开放接口总览数据.value?.tokenTtlSeconds || 0);
  if (!seconds) return "以服务端配置为准";
  if (seconds >= 3600) return `${Math.round(seconds / 3600)} 小时`;
  return `${seconds} 秒`;
});
const 工作量映射选项 = computed(() =>
  工作量映射列表.value.slice().sort((a, b) => {
    const 类型差异 = a.itemType.localeCompare(b.itemType);
    if (类型差异 !== 0) return 类型差异;
    return a.featureName.localeCompare(b.featureName, "zh-CN");
  }),
);
const 当前工作量映射 = computed(
  () => 工作量映射列表.value.find((item) => item.featureId === 工作量映射表单.featureId) || null,
);

const 当前列 = computed<列定义[]>(() => {
  if (当前业务模块.value === "partners") {
    return [
      { 标题: "渠道商名称", 类型: "partnerName", 宽度: "260px", 取值: (row) => 主标题(row) },
      { 标题: "级别", 取值: (row) => 等级名称(row) },
      {
        标题: "区域",
        取值: (row) => 组合文本(字段(row, "区域", "region"), 字段(row, "city", "城市")),
      },
      { 标题: "联系人/电话", 取值: (row) => 联系方式(row) },
      {
        标题: "销售人数",
        类型: "count",
        取值: (row) => 字段(row, "staffCount", "销售人数") || "0",
      },
      {
        标题: "报价/订单",
        取值: (row) =>
          `${字段(row, "quoteCount", "报价数") || "0"} / ${字段(row, "orderCount", "订单数") || "0"}`,
      },
      {
        标题: "累计金额",
        类型: "money",
        取值: (row) => 数字字段(row, "金额", "totalAmt", "totalAmount"),
      },
      { 标题: "状态", 类型: "status", 取值: (row) => 状态名称(row) },
    ];
  }
  if (当前业务模块.value === "registrations") {
    return 过滤渠道端列([
      { 标题: "报备编号", 宽度: "180px", 取值: (row) => 字段(row, "编号", "id") },
      {
        标题: "客户名称",
        宽度: "220px",
        取值: (row) => 字段(row, "客户名称", "customerName", "customer") || 主标题(row),
      },
      {
        标题: "合作伙伴",
        取值: (row) => 字段(row, "渠道名称", "partnerName", "assignedPartnerName"),
      },
      { 标题: "行业", 取值: (row) => 字段(row, "industry", "行业") },
      { 标题: "联系人/电话", 取值: (row) => 联系方式(row) },
      { 标题: "状态", 类型: "status", 取值: (row) => 状态名称(row) },
      { 标题: "报备日期", 类型: "date", 取值: (row) => 字段(row, "创建时间", "createdAt") },
      { 标题: "保护期至", 类型: "date", 取值: (row) => 字段(row, "expireAt", "保护期至") },
    ]);
  }
  if (当前业务模块.value === "opportunities") {
    return 过滤渠道端列([
      { 标题: "商机名称", 宽度: "240px", 取值: (row) => 主标题(row) },
      {
        标题: "客户",
        取值: (row) => 字段(row, "客户名称", "customerName", "customer"),
      },
      { 标题: "合作伙伴", 取值: (row) => 字段(row, "渠道名称", "partnerName") },
      { 标题: "阶段", 类型: "status", 取值: (row) => 状态名称(row) },
      { 标题: "金额", 类型: "money", 取值: (row) => 数字字段(row, "金额", "amount") },
      { 标题: "预计关闭", 类型: "date", 取值: (row) => 字段(row, "expectedClose", "预计关闭") },
      { 标题: "最近跟进", 类型: "date", 取值: (row) => 字段(row, "lastFollowAt", "最近跟进") },
      { 标题: "负责人", 取值: (row) => 字段(row, "负责人", "ownerName") },
    ]);
  }
  if (当前业务模块.value === "quotes") {
    return 过滤渠道端列([
      { 标题: "报价单号", 宽度: "180px", 取值: (row) => 字段(row, "编号", "id") },
      {
        标题: "客户",
        宽度: "180px",
        取值: (row) => 字段(row, "客户名称", "customerName", "customer"),
      },
      { 标题: "合作伙伴", 取值: (row) => 字段(row, "渠道名称", "partnerName") },
      {
        标题: "项目名称",
        取值: (row) => 字段(row, "项目名称", "opportunityName", "商机名称", "oppId", "商机编号"),
      },
      {
        标题: "端点数",
        取值: (row) => `${数字字段(row, "endpoints", "端点数")} 台`,
      },
      { 标题: "报价总额", 类型: "money", 取值: (row) => 数字字段(row, "金额", "amount", "total") },
      { 标题: "创建日期", 类型: "date", 取值: (row) => 字段(row, "创建时间", "createdAt") },
      { 标题: "有效期", 取值: (row) => `${字段(row, "validDays", "有效期") || "30"} 天` },
    ]);
  }
  if (当前业务模块.value === "orders") {
    return 过滤渠道端列([
      { 标题: "订单编号", 宽度: "180px", 取值: (row) => 字段(row, "编号", "id") },
      {
        标题: "关联报价",
        取值: (row) => 字段(row, "quoteId", "报价编号"),
      },
      { 标题: "客户", 取值: (row) => 字段(row, "客户名称", "customerName", "customer") },
      { 标题: "合作伙伴", 取值: (row) => 字段(row, "渠道名称", "partnerName") },
      { 标题: "金额", 类型: "money", 取值: (row) => 数字字段(row, "金额", "amount", "total") },
      { 标题: "状态", 类型: "status", 取值: (row) => 状态名称(row) },
      { 标题: "下单日期", 类型: "date", 取值: (row) => 字段(row, "创建时间", "createdAt") },
      { 标题: "收货地址", 取值: (row) => 字段(row, "deliveryAddr", "交付地址") },
    ]);
  }
  if (当前业务模块.value === "products") {
    return [
      { 标题: "产品名称", 宽度: "260px", 取值: (row) => 主标题(row) },
      { 标题: "类型", 取值: (row) => 字段(row, "类型", "type", "category") },
      { 标题: "产品线", 取值: (row) => 字段(row, "productLine", "产品线") || "联软安全产品" },
      { 标题: "状态", 类型: "status", 取值: (row) => 状态名称(row) || "正常" },
      { 标题: "更新时间", 类型: "date", 取值: (row) => 字段(row, "更新时间", "updatedAt") },
    ];
  }
  return [
    { 标题: "编号", 宽度: "180px", 取值: (row) => 字段(row, "编号", "code") },
    { 标题: "标题", 宽度: "260px", 取值: (row) => 主标题(row) },
    { 标题: "类型", 取值: (row) => 字段(row, "类型", "type") },
    { 标题: "状态", 类型: "status", 取值: (row) => 状态名称(row) },
    { 标题: "创建时间", 类型: "date", 取值: (row) => 字段(row, "创建时间", "createdAt") },
  ];
});

function 过滤渠道端列(columns: 列定义[]) {
  if (!是渠道端.value) return columns;
  return columns.filter((col) => col.标题 !== "合作伙伴");
}

watch(
  () => 路由.fullPath,
  async () => {
    await 加载页面();
  },
  { immediate: true },
);

watch(
  () => 工作量映射表单.featureId,
  () => {
    工作量映射表单.deliveryTag = 工作量映射标签(当前工作量映射.value);
  },
);

onMounted(() => {
  同步窄屏();
  window.addEventListener("resize", 同步窄屏);
  window.addEventListener("v2-mobile-refresh", 处理移动刷新);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", 同步窄屏);
  window.removeEventListener("v2-mobile-refresh", 处理移动刷新);
});

function 同步窄屏() {
  窄屏.value = typeof window !== "undefined" && window.innerWidth <= 760;
}

async function 加载页面() {
  if (上次模块.value !== 当前业务模块.value) {
    筛选.keyword = "";
    筛选.status = "";
    筛选.level = "";
    筛选.region = "";
    筛选.page = 1;
    上次模块.value = 当前业务模块.value;
  }
  加载中.value = true;
  错误提示.value = "";
  try {
    if (当前页面动作.value === "overview" || 当前页面动作.value === "platform") {
      概览.value = await 读取阶段9概览();
      if (!产品候选.value.length) {
        const 产品 = await 查询阶段9列表("products", { pageSize: 12 });
        产品候选.value = 产品.数据;
      }
    }
    if (是开放接口页.value) {
      await 加载开放接口页面();
      return;
    }
    if (是工作量配置页.value) {
      await 加载工作量配置页面();
      return;
    }
    if (当前业务模块.value) {
      列表结果.value = await 查询阶段9列表(当前业务模块.value, {
        keyword: 筛选.keyword,
        status: 筛选.status,
        level: 筛选.level,
        region: 筛选.region,
        page: 筛选.page,
        pageSize: 是移动.value ? 10 : 20,
      });
    }
    if (当前页面动作.value === "create") await 加载表单候选();
  } catch (error) {
    错误提示.value = error instanceof Error ? error.message : "页面数据加载失败。";
  } finally {
    加载中.value = false;
  }
}

async function 加载表单候选() {
  const [产品, 商机, 报备, 报价, 渠道] = await Promise.all([
    查询阶段9列表("products", { pageSize: 100 }),
    查询阶段9列表("opportunities", { pageSize: 100 }),
    查询阶段9列表("registrations", { status: "approved", pageSize: 100 }),
    查询阶段9列表("quotes", { pageSize: 100 }),
    查询阶段9列表("partners", { pageSize: 100 }),
  ]);
  产品候选.value = 产品.数据;
  商机候选.value = 商机.数据;
  报备候选.value = 报备.数据;
  报价候选.value = 报价.数据;
  渠道候选.value = 渠道.数据;
  const 报备编号 = String(路由.query.regId || 路由.query.registrationId || "");
  if (模块.value === "opportunities" && 报备编号 && !表单.registrationId) {
    表单.registrationId = 报备编号;
    const 命中报备 = 报备.数据.find((item) => item.id === 报备编号 || item.编号 === 报备编号);
    if (命中报备) {
      表单.customer = 命中报备.客户名称;
      表单.contact = 字段(命中报备, "contact", "联系人");
      表单.phone = 字段(命中报备, "phone", "联系电话");
      表单.industry = 字段(命中报备, "industry", "行业");
      表单.opportunityName = `${命中报备.客户名称}商机`;
    }
  }
}

async function 加载开放接口页面() {
  const [总览, 客户端, 用户, 日志] = await Promise.all([
    读取开放接口总览(),
    查询开放接口客户端(),
    查询阶段9列表("users", { pageSize: 100 }),
    查询开放接口日志(80),
  ]);
  开放接口总览数据.value = 总览;
  开放接口客户端列表.value = 客户端;
  开放接口用户候选.value = 用户.数据;
  开放接口日志列表.value = 日志;
}

async function 加载工作量配置页面() {
  const [映射, 规则] = await Promise.all([
    查询工作量映射(工作量搜索词.value),
    查询交付工作量规则(),
  ]);
  工作量映射列表.value = 映射;
  工作量规则列表.value = 规则;
}

async function 刷新() {
  await 加载页面();
  ElMessage.success("数据已刷新。");
}

async function 刷新工作量映射() {
  工作量映射列表.value = await 查询工作量映射(工作量搜索词.value);
}

function 重置开放接口表单() {
  开放接口表单.name = "";
  开放接口表单.boundUserId = "";
  开放接口表单.status = "active";
  开放接口表单.expiresAt = "";
  开放接口表单.ipWhitelistText = "";
  开放接口表单.allowedResources = ["*"];
  开放接口表单.remark = "";
  开放接口表单错误.value = "";
  开放接口编辑编号.value = "";
}

function 打开新增开放接口客户端() {
  开放接口编辑中.value = false;
  重置开放接口表单();
  开放接口弹窗.value = true;
}

function 打开编辑开放接口客户端(client: 开放接口客户端) {
  开放接口编辑中.value = true;
  开放接口编辑编号.value = client.id;
  开放接口表单.name = client.name || "";
  开放接口表单.boundUserId = client.boundUserId || "";
  开放接口表单.status = client.status || "active";
  开放接口表单.expiresAt = 转日期输入(client.expiresAt);
  开放接口表单.ipWhitelistText = Array.isArray(client.ipWhitelist)
    ? client.ipWhitelist.join("\n")
    : "";
  开放接口表单.allowedResources =
    Array.isArray(client.allowedResources) && client.allowedResources.length
      ? [...client.allowedResources]
      : ["*"];
  开放接口表单.remark = client.remark || "";
  开放接口表单错误.value = "";
  开放接口弹窗.value = true;
}

function 关闭开放接口弹窗() {
  开放接口弹窗.value = false;
  重置开放接口表单();
}

function 构建开放接口载荷() {
  const resources = 开放接口表单.allowedResources.includes("*")
    ? ["*"]
    : 开放接口表单.allowedResources.filter(Boolean);
  return {
    name: 开放接口表单.name.trim(),
    boundUserId: 开放接口表单.boundUserId,
    status: 开放接口表单.status,
    expiresAt: 开放接口表单.expiresAt || "",
    ipWhitelist: 开放接口表单.ipWhitelistText
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean),
    allowedResources: resources.length ? resources : ["*"],
    remark: 开放接口表单.remark.trim(),
  };
}

async function 保存开放接口表单() {
  开放接口表单错误.value = "";
  if (!开放接口表单.name.trim()) {
    开放接口表单错误.value = "请填写 Client 名称。";
    return;
  }
  if (!开放接口表单.boundUserId) {
    开放接口表单错误.value = "请选择绑定 CRM 用户。";
    return;
  }
  提交中.value = true;
  try {
    const payload = 构建开放接口载荷();
    if (开放接口编辑中.value) {
      await 更新开放接口客户端(开放接口编辑编号.value, payload);
      ElMessage.success("Client 已保存。");
    } else {
      开放接口密钥展示结果.value = await 创建开放接口客户端(payload);
      开放接口密钥弹窗.value = true;
      ElMessage.success("Client 已创建，请立即保存 AppSecret。");
    }
    关闭开放接口弹窗();
    开放接口客户端列表.value = await 查询开放接口客户端();
  } catch (error) {
    开放接口表单错误.value = error instanceof Error ? error.message : "保存 OpenAPI Client 失败。";
  } finally {
    提交中.value = false;
  }
}

async function 重置开放接口Client密钥(client: 开放接口客户端) {
  if (
    !window.confirm(
      `确认重置并显示“${client.name}”的新 AppSecret 吗？\n\n旧密钥会立即失效，新密钥只展示一次。`,
    )
  ) {
    return;
  }
  开放接口密钥展示结果.value = await 重置开放接口密钥(client.id);
  开放接口密钥弹窗.value = true;
  开放接口客户端列表.value = await 查询开放接口客户端();
  ElMessage.success("AppSecret 已重置。");
}

async function 下载开放接口文档(doc: 开放接口总览["docs"][number]) {
  const 响应 = await fetch(`/api/open-api/docs/${encodeURIComponent(doc.id)}/download`, {
    credentials: "include",
  });
  if (!响应.ok) throw new Error("下载文档失败。");
  const blob = await 响应.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = doc.fileName || `${doc.id}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}

async function 复制文本(value: string) {
  const text = String(value || "");
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    ElMessage.success("已复制。");
  } catch {
    window.prompt("请手动复制以下内容", text);
  }
}

function 开放接口资源名称(value: string) {
  return 开放接口资源选项.find((item) => item.value === value)?.label || value;
}

function 格式开放接口资源(resources: string[]) {
  const list = Array.isArray(resources) && resources.length ? resources : ["*"];
  return list.map(开放接口资源名称).join("、");
}

function 格式开放接口列表(list: string[]) {
  if (!Array.isArray(list) || !list.length) return "不限制";
  return list.join("、");
}

function 格式开放接口日期(value: string) {
  if (!value) return "长期有效";
  return 格式时间(value);
}

function 开放接口用户账号(row: 阶段9记录) {
  return row.负责人 || 字段(row, "username", "账号") || row.编号;
}

function 开放接口用户角色(row: 阶段9记录) {
  const role = 字段(row, "role", "角色");
  return 开放接口角色名称[role] || role || row.类型;
}

function 开放接口用户显示(row: 阶段9记录) {
  return `${row.标题 || row.负责人 || row.编号} / ${开放接口用户账号(row)} / ${开放接口用户角色(row)}`;
}

function 转日期输入(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function 工作量标签名称(value: string) {
  return 工作量标签选项.find((item) => item.value === value)?.label || value || "未映射";
}

function 工作量产品类型(item: 工作量映射项 | null) {
  return item?.itemType === "hardware" ? "硬件产品" : "软件产品";
}

function 工作量映射标签(item: 工作量映射项 | null) {
  return Array.isArray(item?.deliveryTags) && item.deliveryTags.length
    ? item.deliveryTags[0] || ""
    : "";
}

function 工作量映射标签名称(item: 工作量映射项 | null) {
  const tag = 工作量映射标签(item);
  return tag ? 工作量标签名称(tag) : "未映射";
}

function 工作量选项文本(item: 工作量映射项) {
  const code = item.productCode ? ` / ${item.productCode}` : "";
  const moduleName = item.moduleName || item.categoryName || "-";
  return `${工作量产品类型(item)}｜${item.featureName}${code}｜${moduleName}`;
}

function 编辑工作量映射(item: 工作量映射项) {
  工作量映射表单.featureId = item.featureId;
  工作量映射表单.deliveryTag = 工作量映射标签(item);
}

function 重置工作量映射表单() {
  工作量映射表单.featureId = "";
  工作量映射表单.deliveryTag = "";
}

async function 保存当前工作量映射() {
  if (!工作量映射表单.featureId) {
    ElMessage.warning("请选择产品。");
    return;
  }
  const deliveryTags = 工作量映射表单.deliveryTag ? [工作量映射表单.deliveryTag] : [];
  await 保存工作量映射(工作量映射表单.featureId, { deliveryTags, active: true });
  ElMessage.success("映射已保存。");
  await 刷新工作量映射();
}

function 格式工作量规则范围(rule: 交付工作量规则项) {
  if (rule.ruleType === "fixed") return "独立项目";
  return `${rule.minPoints || 1}-${rule.maxPoints || 5000}点`;
}

function 打开工作量规则弹窗(rule: 交付工作量规则项) {
  工作量规则编辑编号.value = rule.id;
  工作量规则表单.productTypeLabel = rule.productTypeLabel || rule.item || "";
  工作量规则表单.ruleType = rule.ruleType || "";
  工作量规则表单.minPoints = rule.minPoints ?? 1;
  工作量规则表单.maxPoints = rule.maxPoints ?? 5000;
  工作量规则表单.personDays = rule.personDays || 0;
  工作量规则表单.comboPersonDays = rule.comboPersonDays ?? null;
  工作量规则表单.remark = rule.remark || "";
  工作量规则表单.active = rule.active !== false;
  工作量规则弹窗.value = true;
}

async function 保存当前工作量规则() {
  await 保存交付工作量规则(工作量规则编辑编号.value, {
    minPoints: 工作量规则表单.ruleType === "fixed" ? null : 工作量规则表单.minPoints,
    maxPoints: 工作量规则表单.ruleType === "fixed" ? null : 工作量规则表单.maxPoints,
    personDays: 工作量规则表单.personDays,
    comboPersonDays: 工作量规则表单.comboPersonDays,
    remark: 工作量规则表单.remark,
    active: 工作量规则表单.active,
  });
  工作量规则弹窗.value = false;
  工作量规则列表.value = await 查询交付工作量规则();
  ElMessage.success("工作量规则已保存。");
}

async function 退出移动登录() {
  await 会话.退出系统();
  await 路由器.push("/login");
}

function 提示移动设置(名称: string) {
  ElMessage.info(`${名称} 暂无新的消息。`);
}

function 处理移动刷新() {
  void 刷新();
}

async function 切换移动管理业务(next: 阶段9模块) {
  移动管理业务模块.value = next;
  筛选.keyword = "";
  筛选.status = "";
  筛选.page = 1;
  await 加载页面();
}

async function 查询() {
  筛选.page = 1;
  await 加载页面();
}

function 报备下一步() {
  if (报备步骤.value === 1 && !报备第一步可继续.value) {
    ElMessage.warning(`请先完善：${报备第一步缺失.value.join("、")}`);
    return;
  }
  报备步骤.value = Math.min(报备步骤.value + 1, 报备步骤列表.value.length);
}

function 报备上一步() {
  报备步骤.value = Math.max(1, 报备步骤.value - 1);
}

function 审核报备编号(row: 阶段9记录) {
  return 字段(row, "targetId", "registrationId") || row.id;
}

async function 提交创建() {
  if (!模块.value) return;
  if (模块.value === "registrations" && 报备步骤.value < 报备步骤列表.value.length) {
    报备下一步();
    return;
  }
  提交中.value = true;
  错误提示.value = "";
  try {
    if (模块.value === "registrations") {
      await 创建报备({
        customer: 表单.customer,
        creditCode: 表单.creditCode,
        legalPerson: 表单.legalPerson,
        industry: 表单.industry,
        city: 表单.city,
        address: 表单.address,
        contact: 表单.contact,
        phone: 表单.phone,
        email: 表单.email,
        project: 表单.hasOpportunity ? 表单.opportunityName || 表单.project : "",
        amount: 表单.hasOpportunity ? 表单.amount : 0,
        endpoints: 表单.hasOpportunity ? 表单.endpoints : 0,
        expectedClose: 表单.hasOpportunity ? 表单.expectedClose : "",
        notes: 表单.notes,
        partnerId: 表单.partnerId,
        ownerUserId: 表单.staffId,
      });
      ElMessage.success("报备已提交，等待审核。");
      await 路由器.push(列表返回路径("registrations"));
    }
    if (模块.value === "opportunities") {
      await 创建商机({
        registrationId: 表单.registrationId,
        customer: 表单.customer,
        name: 表单.opportunityName,
        amount: 表单.amount,
        stage: 表单.stage,
        endpoints: 表单.endpoints,
        expectedClose: 表单.expectedClose,
        source: 表单.source,
        owner: 表单.owner,
        tags: 表单.tagsText
          .split(/[，,]/)
          .map((item) => item.trim())
          .filter(Boolean),
        notes: 表单.notes,
        followup: 表单.firstFollow,
        partnerId: 表单.partnerId,
        ownerUserId: 表单.staffId,
      });
      ElMessage.success("商机已创建。");
      await 路由器.push(列表返回路径("opportunities"));
    }
    if (模块.value === "quotes") {
      await 创建报价({
        opportunityId: 表单.opportunityId,
        endpoints: 表单.endpoints,
        validDays: 表单.validDays,
        productIds: 表单.productIds,
        quoteMode: 报价当前模式.value,
      });
      ElMessage.success("报价单已创建。");
      await 路由器.push(列表返回路径("quotes"));
    }
    if (模块.value === "orders") {
      await 创建订单({ quoteId: 表单.quoteId });
      ElMessage.success("订单已创建，请等待下一步审批。");
      await 路由器.push(列表返回路径("orders"));
    }
  } catch (error) {
    错误提示.value = error instanceof Error ? error.message : "保存失败，请稍后重试。";
  } finally {
    提交中.value = false;
  }
}

async function 报价预览() {
  试算结果.value = await 试算报价({
    opportunityId: 表单.opportunityId,
    endpoints: 表单.endpoints,
    productIds: 表单.productIds,
  });
}

async function 通过报备(row: 阶段9记录) {
  await 更新报备状态(审核报备编号(row), { status: "approved", reason: "页面审核通过" });
  ElMessage.success("报备已通过。");
  await 加载页面();
}

async function 驳回报备(row: 阶段9记录) {
  await 更新报备状态(审核报备编号(row), { status: "rejected", reason: "页面驳回" });
  ElMessage.success("报备已驳回。");
  await 加载页面();
}

async function 跟进商机(row: 阶段9记录) {
  await 更新商机(row.id, { stage: "contacted", followup: "页面记录跟进" });
  ElMessage.success("商机跟进已记录。");
  await 加载页面();
}

async function 推进商机阶段(row: 阶段9记录, stage: (typeof 商机阶段列表)[number]) {
  if (stage.键 === 商机阶段键(row)) return;
  await 更新商机(row.id, { stage: stage.键, followup: `阶段推进：${stage.名称}` });
  ElMessage.success("商机阶段已更新。");
  await 加载页面();
  if (详情.value?.id === row.id)
    详情.value = { ...详情.value, 状态: stage.键, 状态名称: stage.名称 };
}

async function 修改报价(row: 阶段9记录) {
  关闭详情();
  await 路由器.push(修改报价路径(row));
}

function 下载报价PDF() {
  ElMessage.info("请在打印窗口选择另存为 PDF。");
  window.setTimeout(() => window.print(), 80);
}

async function 商机赢单转订单(row: 阶段9记录) {
  const quoteId = 字段(row, "quoteId", "报价编号", "quoteNo");
  if (!quoteId) {
    ElMessage.warning("该商机还没有关联报价单，请先创建报价单。");
    return;
  }
  await 创建订单({ quoteId });
  ElMessage.success("已根据关联报价生成订单。");
  await 加载页面();
}

async function 确认报价(row: 阶段9记录) {
  await 更新报价状态(row.id, { status: "approved" });
  ElMessage.success("报价已确认。");
  await 加载页面();
}

async function 转订单(row: 阶段9记录) {
  await 创建订单({ quoteId: row.id });
  ElMessage.success("报价已转订单。");
  await 加载页面();
}

async function 确认订单(row: 阶段9记录) {
  const targetStatus =
    row.状态 === "pending_superadmin_confirm"
      ? "confirmed"
      : row.状态 === "primary_confirmed"
        ? "pending_superadmin_confirm"
        : "confirmed";
  await 更新订单状态(row.id, targetStatus);
  ElMessage.success(targetStatus === "confirmed" ? "订单已确认。" : "订单已提交超管确认。");
  await 加载页面();
}

function 打开详情(row: 阶段9记录) {
  详情.value = row;
}

function 关闭详情() {
  详情.value = null;
}

function 打开占位动作(名称: string) {
  ElMessage.info(`${名称} 暂不可用，请联系管理员处理。`);
}

function 过滤概览业务(类型: string) {
  const 数据 = 概览.value?.最近业务 || [];
  const 结果 = 数据.filter((row) => `${row.类型} ${row.标题}`.includes(类型));
  return (结果.length ? 结果 : 数据).slice(0, 5);
}

function 统计图标(title: string) {
  const 映射: Record<string, string> = {
    渠道商: "🤝",
    客户报备: "📋",
    商机: "🎯",
    报价单: "💰",
    订单: "📦",
    产品: "🗂️",
  };
  return 映射[title] || title.slice(0, 1);
}

function 统计图标类(index: number) {
  return ["blue", "green", "orange", "purple"][index % 4];
}

function 移动列表描述(row: 阶段9记录) {
  return (
    字段(row, "客户名称", "customerName") ||
    字段(row, "渠道名称", "partnerName") ||
    字段(row, "联系人", "contact") ||
    row.编号 ||
    "—"
  );
}

function 移动列表底部(row: 阶段9记录) {
  const amount = Number(row.金额 || 0);
  if (amount > 0) return 格式金额(amount);
  return 字段(row, "负责人", "assignedStaffName", "ownerName") || "处理";
}

function 商机阶段键(row: 阶段9记录) {
  const stage = 字段(row, "stage", "阶段", "状态").toLowerCase();
  const status = `${stage} ${row.状态 || ""} ${状态名称(row)}`.toLowerCase();
  if (/won|赢单|100/.test(status)) return "won";
  if (/lost|输单/.test(status)) return "lost";
  if (/cancel|取消/.test(status)) return "cancelled";
  if (/negotiation|closing|商务|签约|70/.test(status)) return "negotiation";
  if (/testing|测试|50/.test(status)) return "testing";
  if (/design|方案|技术交流|40/.test(status)) return "design";
  if (/budget|预算|30/.test(status)) return "budget";
  if (/quoted|报价|20/.test(status)) return "quoted";
  if (/registered|报备|10/.test(status)) return "registered";
  return "contacted";
}

function 商机阶段名称(row: 阶段9记录) {
  const stage = 商机阶段列表.find((item) => item.键 === 商机阶段键(row));
  return stage?.名称 || 状态名称(row);
}

function 商机阶段点色(row: 阶段9记录) {
  return 商机阶段列表.find((item) => item.键 === 商机阶段键(row))?.点色 || "#1677ff";
}

function 商机阶段标签类(row: 阶段9记录) {
  const key = 商机阶段键(row);
  if (["won", "design"].includes(key)) return "tag-green";
  if (["lost", "cancelled", "testing"].includes(key)) return "tag-red";
  if (["budget", "quoted"].includes(key)) return "tag-purple";
  if (key === "registered") return "tag-orange";
  return "tag-blue";
}

function 商机客户名称(row: 阶段9记录) {
  return 字段(row, "客户名称", "customerName", "customer") || "-";
}

function 商机联系人(row: 阶段9记录) {
  return 组合文本(字段(row, "联系人", "contact"), 字段(row, "联系电话", "phone"));
}

function 商机负责人(row: 阶段9记录) {
  return 字段(row, "负责人", "assignedStaffName", "createdByName", "ownerName", "owner") || "—";
}

function 商机预计关闭(row: 阶段9记录) {
  return 字段(row, "expectedClose", "预计关闭") || "-";
}

function 商机是否逾期(row: 阶段9记录) {
  const value = 商机预计关闭(row);
  if (!value || value === "-") return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now() && 商机阶段键(row) !== "won";
}

function 商机概率(row: 阶段9记录) {
  const direct = Number(字段(row, "probability", "赢率", "概率"));
  if (Number.isFinite(direct) && direct > 0) return direct;
  const 映射: Record<string, number> = {
    contacted: 1,
    registered: 10,
    quoted: 20,
    budget: 30,
    design: 40,
    testing: 50,
    negotiation: 70,
    won: 100,
    cancelled: 0,
    lost: 0,
  };
  return 映射[商机阶段键(row)] ?? 1;
}

function 商机关联报备(row: 阶段9记录) {
  return 字段(row, "registrationId", "regId", "报备编号") || "未关联";
}

function 商机跟进摘要(row: 阶段9记录) {
  return (
    字段(row, "lastFollowContent", "最近跟进", "followup", "notes", "备注") ||
    "等待继续跟进销售动作。"
  );
}

function 列表搜索占位() {
  const 映射: Partial<Record<阶段9模块, string>> = {
    registrations: "搜索客户名称、联系人...",
    opportunities: "搜索商机名称、客户...",
    quotes: "搜索客户、报价单号...",
    orders: "搜索客户、订单号...",
    partners: "搜索渠道商名称、联系人...",
    products: "搜索产品名称、产品线...",
  };
  return 映射[当前业务模块.value || "registrations"] || "搜索名称、编号、联系人...";
}

function 报价客户名称(row: 阶段9记录) {
  return 字段(row, "客户名称", "customerName", "customer") || "-";
}

function 报价项目名称(row: 阶段9记录) {
  return 字段(row, "项目名称", "opportunityName", "商机名称", "oppId", "商机编号") || "—";
}

function 报价端点数(row: 阶段9记录) {
  return 数字字段(row, "endpoints", "端点数");
}

function 报价总额(row: 阶段9记录) {
  return 数字字段(row, "金额", "amount", "total", "totalAmount");
}

function 报价有效期(row: 阶段9记录) {
  return 字段(row, "validDays", "有效期") || "30";
}

function 导出当前列表() {
  if (!列表结果.value.数据.length) {
    ElMessage.warning("当前没有可导出的列表数据。");
    return;
  }
  const 表头 = 当前列.value.map((col) => col.标题).concat("编号");
  const 行 = 列表结果.value.数据.map((row) =>
    当前列.value.map((col) => 单元格文本(row, col)).concat(row.编号 || row.id),
  );
  下载文本文件(`${标题.value}-${日期文件名()}.csv`, 转CSV([表头, ...行]));
  ElMessage.success("当前列表已导出。");
}

function 下载导入模板() {
  const 模板: Record<string, string[]> = {
    registrations: ["客户名称", "统一社会信用代码", "行业", "联系人", "联系电话", "渠道商", "区域"],
    opportunities: ["商机名称", "客户名称", "关联报备编号", "预计金额", "预计关闭日期", "负责人"],
    partners: ["渠道商名称", "级别", "区域", "城市", "联系人", "联系电话", "邮箱"],
  };
  const headers = 模板[当前业务模块.value || ""] || ["名称", "编号", "状态", "备注"];
  下载文本文件(`${标题.value}-导入模板.csv`, 转CSV([headers]));
  ElMessage.success("导入模板已生成。");
}

async function 预检导入文件(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  导入文件名.value = file.name;
  const 内容 = await file.text();
  const 行 = 内容.split(/\r?\n/).filter((item) => item.trim());
  const 表头 = 行[0]?.split(",").map((item) => item.trim()) || [];
  if (!行.length || 表头.length < 2) {
    导入预检结果.value = "预检未通过：文件为空或表头字段不足。";
    ElMessage.error("导入文件预检未通过。");
    return;
  }
  导入预检结果.value = `预检通过：识别 ${行.length - 1} 行数据、${表头.length} 个字段。请确认字段映射后再提交导入。`;
  ElMessage.success("导入文件预检通过。");
}

function 列表返回路径(moduleName = 模块.value) {
  if (!moduleName)
    return 是移动.value ? "/mobile/partner/home" : 是渠道端.value ? "/partner" : "/admin";
  if (是移动.value) {
    const 移动映射: Partial<Record<阶段9模块, string>> = {
      registrations: "/mobile/partner/registrations",
      opportunities: "/mobile/partner/opportunities",
      quotes: "/mobile/partner/quotes",
      orders: "/mobile/partner/orders",
      products: "/mobile/partner/products",
    };
    return (
      移动映射[moduleName] || (是移动管理端.value ? "/mobile/admin/home" : "/mobile/partner/home")
    );
  }
  const 前缀 = 是渠道端.value ? "/partner" : "/admin";
  const 映射: Partial<Record<阶段9模块, string>> = {
    registrations: `${前缀}/registration`,
    opportunities: `${前缀}/opportunity`,
    quotes: `${前缀}/quote`,
    orders: `${前缀}/order`,
    products: `${前缀}/products`,
  };
  return 映射[moduleName] || 前缀;
}

function 新建路径() {
  if (!当前业务模块.value) return 列表返回路径();
  if (是移动.value) {
    const 移动映射: Partial<Record<阶段9模块, string>> = {
      registrations: "/mobile/partner/registrations/new",
      opportunities: "/mobile/partner/opportunities/new",
      quotes: "/mobile/partner/quotes/new",
    };
    return 移动映射[当前业务模块.value] || 列表返回路径(当前业务模块.value);
  }
  const 前缀 = 是渠道端.value ? "/partner" : "/admin";
  const 映射: Partial<Record<阶段9模块, string>> = {
    registrations: `${前缀}/registration/new`,
    opportunities: `${前缀}/opportunity/new`,
    quotes: `${前缀}/quote/new`,
    orders: `${前缀}/order`,
  };
  return 映射[当前业务模块.value] || 路由.path;
}

function 切换报价模式(mode: 报价模式) {
  报价当前模式.value = mode;
  试算结果.value = null;
}

function 切换产品选择(row: 阶段9记录) {
  const exists = 表单.productIds.includes(row.id);
  表单.productIds = exists
    ? 表单.productIds.filter((id) => id !== row.id)
    : [...表单.productIds, row.id];
  试算结果.value = null;
}

function 是否产品已选(row: 阶段9记录) {
  return 表单.productIds.includes(row.id);
}

function 单元格文本(row: 阶段9记录, col: 列定义) {
  const value = col.取值(row);
  if (col.类型 === "money") return 格式金额(Number(value || 0));
  if (col.类型 === "date") return 格式时间(String(value || ""));
  return String(value || "-");
}

function 产品数量(row: 阶段9记录) {
  const products = row.原始数据.products;
  if (Array.isArray(products)) return `${products.length}项产品`;
  const productIds = row.原始数据.productIds;
  if (Array.isArray(productIds)) return `${productIds.length}项产品`;
  return 字段(row, "产品", "products") || "未选产品";
}

function 报价明细分组列表(row: 阶段9记录) {
  const 明细 = 读取报价产品明细(row);
  const 分组 = [
    {
      标题: "🖥️ 软件产品",
      类型: "软件",
      数据: 明细.filter((item) => item.类型.includes("软件") || item.类型.includes("功能")),
    },
    { 标题: "🖨️ 硬件设备", 类型: "硬件", 数据: 明细.filter((item) => item.类型.includes("硬件")) },
    { 标题: "服务项", 类型: "服务", 数据: 明细.filter((item) => item.类型.includes("服务")) },
  ].filter((group) => group.数据.length > 0);
  return 分组.length ? 分组 : [{ 标题: "产品明细", 类型: "产品", 数据: 明细 }];
}

function 读取报价产品明细(row: 阶段9记录) {
  const source = row.原始数据.items || row.原始数据.products || row.原始数据.productItems;
  if (Array.isArray(source) && source.length) {
    return source.map((item, index) => {
      const record = item as Record<string, unknown>;
      return {
        id: 读取记录文本(record, ["id", "productId"], String(index + 1)),
        名称: 读取记录文本(record, ["name", "名称", "productName"], 产品数量(row)),
        类型: 读取记录文本(record, ["type", "类型", "category"], "软件产品"),
        数量: 读取记录文本(record, ["qtyLabel", "qty", "quantity"], `${报价端点数(row)} 台`),
        小计: 读取记录数字(record, ["subtotal", "amount", "total"], 报价总额(row)),
      };
    });
  }
  return [
    {
      id: row.id,
      名称: 产品数量(row),
      类型: "软件产品",
      数量: `${报价端点数(row)} 台`,
      小计: 报价总额(row),
    },
  ];
}

function 读取记录文本(record: Record<string, unknown>, keys: string[], fallback: string) {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value);
  }
  return fallback;
}

function 读取记录数字(record: Record<string, unknown>, keys: string[], fallback: number) {
  const value = 读取记录文本(record, keys, "");
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function 产品卡描述(row: 阶段9记录) {
  return (
    字段(row, "description", "描述", "productLine", "产品线") ||
    `${row.类型 || "产品"} · ${状态名称(row)}`
  );
}

function 切换产品标签(tab: 产品目录标签) {
  产品当前标签.value = tab;
  产品分类详情.value = null;
  产品功能详情.value = null;
}

function 打开产品分类(category: 产品目录分类) {
  产品分类详情.value = category;
  产品功能详情.value = null;
}

function 关闭产品分类() {
  产品分类详情.value = null;
  产品功能详情.value = null;
}

function 打开产品功能(row: 阶段9记录) {
  产品功能详情.value = row;
}

function 关闭产品功能() {
  产品功能详情.value = null;
}

function 产品分组明细(category: 产品目录分类) {
  const 分组 = new Map<string, 阶段9记录[]>();
  for (const row of category.数据) {
    const key = 产品模块名称(row);
    分组.set(key, [...(分组.get(key) || []), row]);
  }
  return Array.from(分组.entries()).map(([名称, 数据]) => {
    const 首条 = 数据[0];
    return {
      id: `${category.id}-${名称}`,
      名称,
      图标: 产品分类图标(名称),
      描述:
        (首条 && 字段(首条, "moduleDesc", "模块描述", "description", "描述")) || `${名称}功能模块`,
      功能数: 数据.length,
      数据,
    };
  });
}

function 产品分类名称(row: 阶段9记录) {
  return (
    字段(row, "categoryName", "category", "大类", "productLine", "产品线") ||
    (row.类型 && row.类型 !== "功能模块" ? row.类型 : "") ||
    "联软安全产品"
  );
}

function 产品模块名称(row: 阶段9记录) {
  return 字段(row, "moduleName", "module", "模块", "类型") || row.类型 || "产品模块";
}

function 产品分类描述(name: string, rows: 阶段9记录[]) {
  const 首条 = rows[0];
  return (
    (首条 && 字段(首条, "categoryDesc", "大类描述", "description", "描述")) ||
    `${name}产品模块与功能清单`
  );
}

function 打开产品组首项(rows: 阶段9记录[]) {
  const 首条 = rows[0];
  if (首条) 打开产品功能(首条);
}

function 产品分类图标(name: string) {
  if (/硬件|设备|终端盒|网关/.test(name)) return "🖥️";
  if (/数据|数据库|存储/.test(name)) return "🗄️";
  if (/网络|准入|边界/.test(name)) return "🌐";
  if (/安全|防护|终端/.test(name)) return "🛡️";
  if (/套餐|组合/.test(name)) return "📦";
  return "💻";
}

function 是否硬件产品(row: 阶段9记录) {
  const text = `${row.类型} ${字段(row, "category", "categoryName", "产品线", "type")}`;
  return /硬件|设备|hardware/i.test(text);
}

function 是否套餐产品(row: 阶段9记录) {
  const text = `${row.类型} ${字段(row, "category", "categoryName", "产品线", "type", "quoteMode")}`;
  return /套餐|package/i.test(text);
}

function 产品报价路径() {
  if (是移动.value) return "/mobile/partner/quotes/new";
  return 是渠道端.value ? "/partner/quote/new" : "/admin/quote/new";
}

function 修改报价路径(row: 阶段9记录) {
  const id = encodeURIComponent(row.id || row.编号);
  if (是移动.value) return `/mobile/partner/quotes/new?quoteId=${id}`;
  return 是渠道端.value ? `/partner/quote/edit/${id}` : `/admin/quote/edit/${id}`;
}

function 字段(row: 阶段9记录, ...keys: string[]) {
  const source = row as unknown as Record<string, unknown>;
  const raw = row.原始数据 || {};
  for (const key of keys) {
    const value = source[key] ?? raw[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value);
  }
  return "";
}

function 数字字段(row: 阶段9记录, ...keys: string[]) {
  const value = 字段(row, ...keys);
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function 主标题(row: 阶段9记录) {
  return 字段(row, "标题", "名称", "name", "title") || row.标题 || "-";
}

function 状态名称(row: 阶段9记录) {
  return 字段(row, "状态名称", "statusName") || row.状态名称 || row.状态 || "正常";
}

function 等级名称(row: 阶段9记录) {
  const level = 字段(row, "level", "级别", "等级").toLowerCase();
  const 映射: Record<string, string> = {
    lep: "💎 LEP",
    diamond: "🔷 钻石",
    gold: "🥇 金牌",
    silver: "🥈 银牌",
    bronze: "🥉 铜牌",
    industry: "🏭 行业总代",
  };
  return 映射[level] || 字段(row, "级别", "等级") || "○ 无层级";
}

function 联系方式(row: 阶段9记录) {
  return 组合文本(
    字段(row, "联系人", "contact", "contactName", "负责人", "ownerName"),
    字段(row, "联系电话", "phone", "contactPhone"),
  );
}

function 组合文本(...values: string[]) {
  return values.filter(Boolean).join(" / ") || "-";
}

function 日期文件名() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
}

function 转CSV(rows: Array<Array<string | number>>) {
  return "\uFEFF" + rows.map((row) => row.map((value) => CSV单元格(value)).join(",")).join("\n");
}

function CSV单元格(value: string | number) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function 下载文本文件(fileName: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function 格式金额(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function 格式时间(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function 状态类(row: 阶段9记录) {
  const status = `${row.状态 || ""} ${状态名称(row)}`.toLowerCase();
  if (status.includes("reject") || status.includes("驳回") || status.includes("失败"))
    return "tag-red";
  if (status.includes("pending") || status.includes("待")) return "tag-orange";
  if (status.includes("draft") || status.includes("草稿")) return "tag-gray";
  if (status.includes("converted") || status.includes("转")) return "tag-purple";
  return "tag-green";
}

function 详情分组列表(row: 阶段9记录): 详情分组[] {
  const 基础信息: 详情字段[] = [
    { 标签: "编号", 值: row.编号 || row.id, 重点: true },
    { 标签: "类型", 值: row.类型 },
    { 标签: "状态", 值: 状态名称(row), 重点: true },
    { 标签: "创建时间", 值: 格式时间(row.创建时间) },
    { 标签: "更新时间", 值: 格式时间(row.更新时间) },
  ];
  const 业务信息: 详情字段[] = [
    { 标签: "客户名称", 值: 字段(row, "客户名称", "customerName", "customer") },
    { 标签: "渠道商", 值: 字段(row, "渠道名称", "partnerName", "assignedPartnerName") },
    { 标签: "负责人", 值: 字段(row, "负责人", "assignedStaffName", "owner", "createdByName") },
    { 标签: "区域", 值: 字段(row, "区域", "region", "bigRegion") },
    { 标签: "联系人", 值: 字段(row, "联系人", "contact", "contacts") },
    { 标签: "联系电话", 值: 字段(row, "联系电话", "phone") },
    { 标签: "行业", 值: 字段(row, "industry", "行业") },
    { 标签: "金额", 值: 格式金额(数字字段(row, "金额", "amount", "total")) },
    { 标签: "端点数", 值: 字段(row, "endpoints", "端点数") },
    { 标签: "工作量", 值: 字段(row, "workloadSummary", "工作量") },
    { 标签: "保护期", 值: 格式时间(字段(row, "expireAt", "保护期至")) },
    { 标签: "预计关闭", 值: 格式时间(字段(row, "expectedClose", "预计关闭")) },
  ].filter((item) => item.值 && item.值 !== "-" && item.值 !== "￥0");
  return [
    { 标题: "基础信息", 字段: 基础信息 },
    { 标题: "业务信息", 字段: 业务信息 },
  ].filter((group) => group.字段.length > 0);
}
</script>

<template>
  <section class="v2-业务页" :class="{ 'v2-业务页-移动': 是移动 }">
    <header
      v-if="当前页面动作 !== 'overview' && 当前页面动作 !== 'platform' && 当前页面动作 !== 'list'"
      class="v2-业务页标题栏"
    >
      <div>
        <h1>{{ 标题 }}</h1>
        <p>{{ 描述 }}</p>
      </div>
      <div class="v2-页面动作">
        <button class="btn btn-default" type="button" @click="刷新">🔄 刷新</button>
      </div>
    </header>

    <div v-if="错误提示" class="v2-错误提示">{{ 错误提示 }}</div>

    <section v-if="当前页面动作 === 'overview' || 当前页面动作 === 'platform'" class="v2-工作台">
      <template v-if="是移动">
        <template v-if="是移动我的页">
          <section class="v2-profile">
            <span>{{ 欢迎用户名.slice(0, 1) }}</span>
            <div>
              <h1>{{ 欢迎用户名 }}</h1>
              <p>{{ 会话.角色名 || "联软渠道平台用户" }}</p>
              <small>{{ 会话.user?.username || "当前账号" }}</small>
            </div>
          </section>
          <section class="v2-settings">
            <button type="button" @click="提示移动设置('消息通知')">
              <span>消息通知</span>
              <b>›</b>
            </button>
            <button type="button" @click="刷新">
              <span>校验登录态</span>
              <b>›</b>
            </button>
            <RouterLink :to="是移动管理端 ? '/mobile/admin/home' : '/mobile/partner/home'">
              <span>返回工作台</span>
              <b>›</b>
            </RouterLink>
            <button class="v2-settings__danger" type="button" @click="退出移动登录">
              <span>退出登录</span>
              <b>›</b>
            </button>
          </section>
        </template>

        <template v-else>
          <article class="v2-移动欢迎卡" :class="移动欢迎卡类">
            <p>您好，{{ 欢迎用户名 }}</p>
            <h1>{{ 是渠道端 ? "高效处理渠道业务" : "及时处理审核事项" }}</h1>
            <span>{{ 描述 || "联软渠道管理平台" }}</span>
          </article>

          <div class="v2-移动指标网格">
            <button v-for="item in 概览?.统计 || []" :key="item.标题" type="button">
              <b>{{ item.数量 }}</b>
              <span>{{ item.标题 }}</span>
            </button>
          </div>

          <section class="v2-移动区块">
            <div class="v2-移动区块标题">
              <h2>{{ 是渠道端 ? "常用查询" : "待办事项" }}</h2>
            </div>
            <div v-if="是移动管理端" class="todo-list">
              <RouterLink to="/mobile/admin/reviews">
                <span>客户报备待审核</span>
                <b>{{ 概览?.待办.length || 0 }}</b>
              </RouterLink>
              <RouterLink to="/mobile/admin/partners">
                <span>渠道商及账号待审核</span>
                <b>处理</b>
              </RouterLink>
            </div>
            <div v-else class="v2-shortcuts">
              <RouterLink v-for="item in 移动渠道快捷入口" :key="item.路径" :to="item.路径">
                <span>
                  <strong>{{ item.名称 }}</strong>
                  <small>{{ item.描述 }}</small>
                </span>
                <b>{{ item.图标 }}</b>
              </RouterLink>
            </div>
          </section>

          <section class="v2-移动区块">
            <div class="v2-移动区块标题">
              <h2>{{ 是渠道端 ? "最近业务" : "待审核报备" }}</h2>
              <button class="btn btn-text btn-sm" type="button" @click="刷新">刷新</button>
            </div>
            <div class="v2-移动卡片列表 compact-list">
              <button
                v-for="row in (是渠道端 ? 概览?.最近业务 : 概览?.待办) || []"
                :key="row.id"
                class="record-card"
                type="button"
                @click="打开详情(row)"
              >
                <span class="record-card__top">
                  <span class="tag" :class="状态类(row)">{{ 状态名称(row) }}</span>
                  <small>{{ row.id }}</small>
                </span>
                <strong>{{ 主标题(row) }}</strong>
                <p>{{ 移动列表描述(row) }}</p>
                <span class="record-card__bottom">
                  <span>{{ 格式时间(row.创建时间) }}</span>
                  <b>{{ 移动列表底部(row) }}</b>
                </span>
              </button>
              <div
                v-if="!((是渠道端 ? 概览?.最近业务 : 概览?.待办) || []).length"
                class="empty-state"
              >
                暂无数据
              </div>
            </div>
          </section>
        </template>
      </template>

      <template v-else>
        <header class="v2-dashboard-heading">
          <h2>{{ 标题 }}</h2>
          <p>{{ 描述 }}</p>
        </header>
        <div class="stats-grid">
          <article v-for="(item, index) in 概览?.统计 || []" :key="item.标题" class="stat-card">
            <span class="stat-icon" :class="统计图标类(index)">{{ 统计图标(item.标题) }}</span>
            <span>
              <strong class="stat-value">{{ item.数量 }}</strong>
              <small class="stat-label">{{ item.标题 }} · {{ item.说明 }}</small>
            </span>
          </article>
        </div>
        <nav class="quick-actions" aria-label="快捷入口">
          <RouterLink
            v-for="item in 桌面快捷入口"
            :key="item.路径"
            class="quick-action"
            :to="item.路径"
          >
            <span class="qa-icon">{{ item.图标 }}</span>
            <span>
              <strong class="qa-title">{{ item.标题 }}</strong>
              <small class="qa-desc">{{ item.描述 }}</small>
            </span>
          </RouterLink>
        </nav>
        <div class="v2-双栏">
          <article class="card">
            <div class="card-header">
              <h2 class="card-title">{{ 是渠道端 ? "近期商机" : "待审核" }}</h2>
            </div>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{{ 是渠道端 ? "商机名称" : "标题" }}</th>
                    <th>{{ 是渠道端 ? "金额" : "渠道" }}</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in 概览左侧列表"
                    :key="row.id"
                    class="clickable-row"
                    @click="打开详情(row)"
                  >
                    <td>{{ 主标题(row) }}</td>
                    <td>
                      {{ 是渠道端 ? 格式金额(row.金额) : 字段(row, "渠道名称", "partnerName") }}
                    </td>
                    <td>
                      <span class="tag" :class="状态类(row)">{{ 状态名称(row) }}</span>
                    </td>
                  </tr>
                  <tr v-if="!概览左侧列表.length">
                    <td colspan="3"><div class="empty-state">暂无数据</div></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>
          <article class="card">
            <div class="card-header">
              <h2 class="card-title">{{ 是渠道端 ? "最近报价单" : "最近业务" }}</h2>
            </div>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{{ 是渠道端 ? "报价单号" : "类型" }}</th>
                    <th>{{ 是渠道端 ? "客户" : "标题" }}</th>
                    <th>创建时间</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in 概览右侧列表"
                    :key="row.id"
                    class="clickable-row"
                    @click="打开详情(row)"
                  >
                    <td>{{ 是渠道端 ? row.id : 字段(row, "类型", "type") }}</td>
                    <td>{{ 是渠道端 ? 移动列表描述(row) : 主标题(row) }}</td>
                    <td>{{ 格式时间(row.创建时间) }}</td>
                  </tr>
                  <tr v-if="!概览右侧列表.length">
                    <td colspan="3"><div class="empty-state">暂无最近业务</div></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>
        </div>
        <article class="card">
          <div class="card-header">
            <h2 class="card-title">主力产品线</h2>
            <RouterLink
              class="btn btn-text btn-sm"
              :to="是渠道端 ? '/partner/products' : '/admin/products'"
              >产品目录 →</RouterLink
            >
          </div>
          <div class="product-line-list v2-dashboard-product-lines">
            <RouterLink
              v-for="item in 产品线概览.slice(0, 5)"
              :key="item.类型"
              class="product-line-item"
              :to="是渠道端 ? '/partner/products' : '/admin/products'"
            >
              <span>{{ 产品分类图标(item.类型) }}</span>
              <strong>{{ item.类型 }}</strong>
              <small>{{ item.数量 }} 款产品</small>
            </RouterLink>
            <div v-if="!产品线概览.length" class="empty-state">暂无产品数据</div>
          </div>
        </article>
        <article class="card">
          <div class="card-header">
            <h2 class="card-title">商机销售漏斗</h2>
            <RouterLink
              class="btn btn-text btn-sm"
              :to="是渠道端 ? '/partner/opportunity' : '/admin/opportunity'"
              >查看全部 →</RouterLink
            >
          </div>
          <div class="v2-dashboard-funnel">
            <div v-for="item in 商机漏斗" :key="item.键" class="v2-dashboard-funnel__bar">
              <strong>{{ item.数量 }}</strong>
              <span
                :style="{
                  height: `${Math.max(18, item.数量 * 36)}px`,
                  background: item.颜色,
                }"
              ></span>
              <small>{{ item.名称 }}</small>
            </div>
          </div>
          <div class="v2-dashboard-funnel__legend">
            <div v-for="item in 商机漏斗" :key="`legend-${item.键}`">
              <span :style="{ background: item.颜色 }"></span>
              <b>{{ item.名称 }}：{{ item.数量 }}</b>
            </div>
          </div>
        </article>
        <article v-if="概览 && 当前页面动作 === 'platform'" class="card">
          <div class="card-header"><h2 class="card-title">迁移状态</h2></div>
          <div class="v2-定义网格">
            <div>
              <span>批次编号</span>
              <strong>{{ 概览.迁移状态.批次编号 }}</strong>
            </div>
            <div>
              <span>正式落表</span>
              <strong>{{ 概览.迁移状态.正式落表 }}</strong>
            </div>
            <div>
              <span>校验结论</span>
              <strong>{{ 概览.迁移状态.校验结论 }}</strong>
            </div>
          </div>
        </article>
      </template>
    </section>

    <section v-else-if="当前页面动作 === 'create'" class="card v2-create-card">
      <div class="card-header">
        <h2 class="card-title">{{ 标题 }}</h2>
      </div>
      <form class="v2-表单" @submit.prevent="提交创建">
        <template v-if="模块 === 'registrations'">
          <div class="v2-form-steps full" aria-label="报备步骤">
            <span
              v-for="(item, index) in 报备步骤列表"
              :key="item"
              :class="{ active: 报备步骤 === index + 1, done: 报备步骤 > index + 1 }"
            >
              <b>{{ 报备步骤 > index + 1 ? "✓" : index + 1 }}</b
              >{{ item }}
            </span>
          </div>
          <section v-if="报备步骤 === 1" class="v2-write-panel full">
            <div class="v2-write-panel__title">
              <strong>客户信息</strong>
              <small>输入公司名关键词，自动查询工商信息并回填；没有结果时可手动填写。</small>
            </div>
            <div class="form-grid">
              <label class="form-item full">
                <span>客户名称（全称） *</span>
                <div class="v2-enterprise-search">
                  <input
                    v-model="表单.customer"
                    class="form-control"
                    placeholder="输入公司名关键词，自动查询工商信息并回填"
                  />
                  <div v-if="表单.customer" class="v2-enterprise-hint">
                    <b>企业查询提示</b>
                    <span>已保留工商查询入口；当前测试环境按本地字段提交并进入审核。</span>
                  </div>
                </div>
              </label>
              <label class="form-item full">
                <span>统一社会信用代码 *</span>
                <input
                  v-model="表单.creditCode"
                  class="form-control"
                  maxlength="18"
                  placeholder="18位统一社会信用代码（选中企业后自动填入）"
                />
              </label>
              <label class="form-item">
                <span>法定代表人</span>
                <input
                  v-model="表单.legalPerson"
                  class="form-control"
                  placeholder="（自动回填或手动填写）"
                />
              </label>
              <label class="form-item">
                <span>所属行业 *</span>
                <select v-model="表单.industry" class="form-control">
                  <option value="">请选择</option>
                  <option>政府/央企</option>
                  <option>金融</option>
                  <option>制造</option>
                  <option>教育</option>
                  <option>医疗</option>
                  <option>其他</option>
                </select>
              </label>
              <label class="form-item">
                <span>客户省份/城市</span>
                <input v-model="表单.city" class="form-control" placeholder="例：北京市朝阳区" />
              </label>
              <label class="form-item full">
                <span>注册地址</span>
                <input
                  v-model="表单.address"
                  class="form-control"
                  placeholder="（自动回填或手动填写）"
                />
              </label>
              <label class="form-item">
                <span>联系人姓名 *</span>
                <input
                  v-model="表单.contact"
                  class="form-control"
                  placeholder="客户决策人或联系人"
                />
              </label>
              <label class="form-item">
                <span>联系电话 *</span>
                <input v-model="表单.phone" class="form-control" placeholder="138-0000-0000" />
              </label>
              <label class="form-item full">
                <span>客户邮箱</span>
                <input
                  v-model="表单.email"
                  class="form-control"
                  placeholder="contact@company.com"
                />
              </label>
            </div>
            <div class="v2-inline-option">
              <label>
                <input v-model="表单.hasOpportunity" type="checkbox" />
                <span>同时报备商机（项目信息）</span>
              </label>
              <p>勾选后，您可以在下一步填写项目详情，获得商机保护期。</p>
            </div>
            <div v-if="报备第一步缺失.length" class="v2-form-warning">
              还需完善后才能进入下一步：{{ 报备第一步缺失.join("、") }}
            </div>
          </section>

          <section
            v-if="表单.hasOpportunity && 报备步骤列表[报备步骤 - 1] === '项目信息'"
            class="v2-write-panel full"
          >
            <div class="v2-write-panel__title">
              <strong>项目信息</strong>
              <small>保持 V2 的同时报备商机入口，客户审核通过后可继续进入商机链路。</small>
            </div>
            <div class="form-grid">
              <label class="form-item full">
                <span>项目名称</span>
                <input
                  v-model="表单.opportunityName"
                  class="form-control"
                  placeholder="例：XX公司终端安全管控项目"
                />
              </label>
              <label class="form-item">
                <span>预计端点数量</span>
                <input v-model.number="表单.endpoints" class="form-control" type="number" min="1" />
              </label>
              <label class="form-item">
                <span>预计金额（元）</span>
                <input v-model.number="表单.amount" class="form-control" type="number" min="0" />
              </label>
              <label class="form-item">
                <span>预计签约日期</span>
                <input v-model="表单.expectedClose" class="form-control" type="date" />
              </label>
              <label class="form-item full">
                <span>项目背景 / 备注</span>
                <textarea
                  v-model="表单.notes"
                  class="form-control"
                  rows="3"
                  placeholder="项目来源、痛点、竞争情况等..."
                ></textarea>
              </label>
            </div>
          </section>

          <section v-if="报备步骤列表[报备步骤 - 1] === '指派渠道'" class="v2-write-panel full">
            <div class="v2-write-panel__title">
              <strong>指派渠道</strong>
              <small>按 V2 流程选择渠道合作伙伴和跟进员工。</small>
            </div>
            <div class="form-grid">
              <label class="form-item full">
                <span>渠道合作伙伴</span>
                <select v-model="表单.partnerId" class="form-control">
                  <option value="">请选择或保持系统默认渠道</option>
                  <option v-for="item in 渠道候选" :key="item.id" :value="item.id">
                    {{ item.渠道名称 || item.标题 }}
                  </option>
                </select>
              </label>
              <label class="form-item full">
                <span>指派跟进员工</span>
                <input
                  v-model="表单.staffId"
                  class="form-control"
                  placeholder="请输入员工账号、姓名或保持系统默认"
                />
              </label>
            </div>
          </section>

          <section v-if="报备步骤列表[报备步骤 - 1] === '提交确认'" class="v2-write-panel full">
            <div class="v2-write-panel__title">
              <strong>提交确认</strong>
              <small>提交后进入审核中心，管理员可通过或拒绝。</small>
            </div>
            <div class="v2-confirm-grid">
              <div>
                <span>客户名称</span><strong>{{ 表单.customer || "-" }}</strong>
              </div>
              <div>
                <span>统一社会信用代码</span><strong>{{ 表单.creditCode || "-" }}</strong>
              </div>
              <div>
                <span>所属行业</span><strong>{{ 表单.industry || "-" }}</strong>
              </div>
              <div>
                <span>联系人</span><strong>{{ 表单.contact || "-" }}</strong>
              </div>
              <div>
                <span>联系电话</span><strong>{{ 表单.phone || "-" }}</strong>
              </div>
              <div>
                <span>客户省份/城市</span><strong>{{ 表单.city || "-" }}</strong>
              </div>
              <div v-if="表单.hasOpportunity">
                <span>项目名称</span><strong>{{ 表单.opportunityName || "-" }}</strong>
              </div>
              <div v-if="表单.hasOpportunity">
                <span>预计金额</span><strong>{{ 格式金额(表单.amount) }}</strong>
              </div>
            </div>
          </section>
        </template>

        <template v-if="模块 === 'opportunities'">
          <section class="v2-write-panel full">
            <div class="v2-write-panel__title">
              <strong>关联报备客户</strong>
              <small>商机须关联已审批的报备客户；如客户尚未报备，请先进入客户报备。</small>
            </div>
            <div class="form-grid">
              <label class="form-item full">
                <span>客户搜索 / 关联报备</span>
                <select v-model="表单.registrationId" class="form-control">
                  <option value="">搜索已审批客户名称...</option>
                  <option v-for="item in 报备候选" :key="item.id" :value="item.id">
                    {{ item.客户名称 }} / {{ 联系方式(item) }} / {{ item.编号 }}
                  </option>
                </select>
              </label>
              <label class="form-item full">
                <span>商机名称 *</span>
                <input
                  v-model="表单.opportunityName"
                  class="form-control"
                  placeholder="例：XX公司终端安全改造项目"
                />
              </label>
              <label class="form-item">
                <span>当前阶段</span>
                <select v-model="表单.stage" class="form-control">
                  <option value="contacted">1% 已联系上客户</option>
                  <option value="registered">10% 商机明确并报备</option>
                  <option value="quoted">20% 正式报价</option>
                  <option value="budget">30% 明确预算</option>
                  <option value="design">40% 技术交流/方案设计</option>
                  <option value="testing">50% 产品测试</option>
                  <option value="negotiation">70% 招投标/商务谈判</option>
                </select>
              </label>
              <label class="form-item">
                <span>预计金额（元） *</span>
                <input
                  v-model.number="表单.amount"
                  class="form-control"
                  type="number"
                  min="0"
                  step="1000"
                />
              </label>
              <label class="form-item">
                <span>端点数量</span>
                <input v-model.number="表单.endpoints" class="form-control" type="number" min="1" />
              </label>
              <label class="form-item">
                <span>预计关闭日期</span>
                <input v-model="表单.expectedClose" class="form-control" type="date" />
              </label>
              <label class="form-item">
                <span>商机来源</span>
                <select v-model="表单.source" class="form-control">
                  <option>渠道推荐</option>
                  <option>市场活动</option>
                  <option>老客户续约</option>
                  <option>展会获客</option>
                  <option>政府关系</option>
                  <option>网络询盘</option>
                  <option>其他</option>
                </select>
              </label>
              <label class="form-item">
                <span>负责人</span>
                <input v-model="表单.owner" class="form-control" placeholder="销售负责人姓名" />
              </label>
              <label class="form-item full">
                <span>标签</span>
                <input
                  v-model="表单.tagsText"
                  class="form-control"
                  placeholder="输入标签，多个标签用逗号分隔"
                />
              </label>
              <label class="form-item full">
                <span>项目背景 / 备注</span>
                <textarea
                  v-model="表单.notes"
                  class="form-control"
                  rows="3"
                  placeholder="项目背景、竞争情况、关键决策人..."
                ></textarea>
              </label>
              <label class="form-item full">
                <span>首次跟进记录</span>
                <textarea
                  v-model="表单.firstFollow"
                  class="form-control"
                  rows="3"
                  placeholder="记录线索来源或首次沟通情况（可选）"
                ></textarea>
              </label>
            </div>
          </section>
          <section class="v2-write-panel full">
            <div class="v2-write-panel__title">
              <strong>指派跟进渠道</strong>
              <small>保持 V2 的渠道合作伙伴和跟进员工指派方式。</small>
            </div>
            <div class="form-grid">
              <label class="form-item full">
                <span>渠道合作伙伴</span>
                <select v-model="表单.partnerId" class="form-control">
                  <option value="">请选择渠道商或保持报备原渠道</option>
                  <option v-for="item in 渠道候选" :key="item.id" :value="item.id">
                    {{ item.渠道名称 || item.标题 }}
                  </option>
                </select>
              </label>
              <label class="form-item full">
                <span>指派跟进员工</span>
                <input
                  v-model="表单.staffId"
                  class="form-control"
                  placeholder="请选择跟进员工或输入员工账号"
                />
              </label>
            </div>
          </section>
        </template>

        <template v-if="模块 === 'quotes'">
          <div class="v2-quick-quote-banner full">
            <span>💡</span>
            <div>
              <strong>智能报价配置器</strong>
              <small>按 V2 三段式流程选择商机、报价方式、产品功能并生成报价单。</small>
            </div>
          </div>

          <section class="v2-quote-step full">
            <div class="v2-step-title"><b>1</b><strong>基本信息</strong></div>
            <div class="form-grid form-grid-3">
              <label class="form-item">
                <span>客户搜索</span>
                <input
                  v-model="表单.customer"
                  class="form-control"
                  placeholder="搜索客户名称或从商机带入"
                />
              </label>
              <label class="form-item">
                <span>关联商机</span>
                <select v-model="表单.opportunityId" class="form-control">
                  <option value="">请选择商机</option>
                  <option v-for="item in 商机候选" :key="item.id" :value="item.id">
                    {{ item.客户名称 }} / {{ item.标题 }}
                  </option>
                </select>
              </label>
              <label class="form-item">
                <span>端点数</span>
                <input
                  v-model.number="表单.endpoints"
                  class="form-control"
                  type="number"
                  min="1"
                  step="10"
                />
              </label>
              <label class="form-item">
                <span>报价有效期</span>
                <select v-model.number="表单.validDays" class="form-control">
                  <option :value="15">15天</option>
                  <option :value="30">30天</option>
                  <option :value="60">60天</option>
                  <option :value="90">90天</option>
                </select>
              </label>
            </div>
          </section>

          <section class="v2-quote-step full">
            <div class="v2-step-title"><b>2</b><strong>选择报价方式</strong></div>
            <div class="quote-mode-selector">
              <button
                class="mode-card"
                :class="{ active: 报价当前模式 === 'package' }"
                type="button"
                @click="切换报价模式('package')"
              >
                <span class="mode-icon">📦</span>
                <strong>套餐报价</strong>
                <small>选择标准套餐</small>
              </button>
              <button
                class="mode-card"
                :class="{ active: 报价当前模式 === 'supplement' }"
                type="button"
                @click="切换报价模式('supplement')"
              >
                <span class="mode-icon">➕</span>
                <strong>补充功能</strong>
                <small>在套餐基础上追加功能</small>
              </button>
              <button
                class="mode-card"
                :class="{ active: 报价当前模式 === 'custom' }"
                type="button"
                @click="切换报价模式('custom')"
              >
                <span class="mode-icon">🎨</span>
                <strong>自定义报价</strong>
                <small>自由组合产品模块</small>
              </button>
            </div>

            <div class="v2-quote-subtitle">
              <strong>{{
                报价当前模式 === "package"
                  ? "选择产品套餐"
                  : 报价当前模式 === "supplement"
                    ? "补充功能"
                    : "选择功能模块"
              }}</strong>
              <small>已选 {{ 表单.productIds.length }} 项</small>
            </div>
            <div class="v2-quote-product-grid">
              <button
                v-for="item in 报价当前候选"
                :key="item.id"
                class="v2-quote-product-card"
                :class="{ selected: 是否产品已选(item) }"
                type="button"
                @click="切换产品选择(item)"
              >
                <span class="check-mark">✓</span>
                <b>{{ 产品分类图标(主标题(item)) }}</b>
                <strong>{{ 主标题(item) }}</strong>
                <small>{{ 产品卡描述(item) }}</small>
                <em>{{ item.金额 ? 格式金额(item.金额) : "按试算" }}</em>
                <span class="v2-card-link">查看详情 ▸</span>
              </button>
              <div v-if="!报价当前候选.length" class="empty-state">
                暂无可选产品，请先维护产品目录。
              </div>
            </div>

            <template v-if="报价硬件候选.length">
              <div class="v2-quote-subtitle">
                <strong>加配硬件</strong>
                <small>可选</small>
              </div>
              <div class="v2-hardware-grid">
                <button
                  v-for="item in 报价硬件候选"
                  :key="item.id"
                  class="v2-hardware-card"
                  :class="{ selected: 是否产品已选(item) }"
                  type="button"
                  @click="切换产品选择(item)"
                >
                  <span class="check-mark">✓</span>
                  <b>{{ 产品分类图标(主标题(item)) }}</b>
                  <strong>{{ 主标题(item) }}</strong>
                  <small>{{ 产品卡描述(item) }}</small>
                  <em>{{ item.金额 ? 格式金额(item.金额) : "按试算" }}</em>
                </button>
              </div>
            </template>
          </section>

          <section class="v2-quote-step v2-quote-summary-panel full">
            <div class="v2-step-title">
              <b>3</b><strong>报价汇总</strong><span>端点数：{{ 表单.endpoints || "—" }}</span>
            </div>
            <div class="summary-section">
              <div class="summary-title">已选产品</div>
              <div v-if="已选产品列表.length" class="v2-summary-list">
                <div v-for="item in 已选产品列表" :key="item.id" class="summary-row">
                  <span>{{ 主标题(item) }}</span>
                  <strong>{{ item.金额 ? 格式金额(item.金额) : "按试算" }}</strong>
                </div>
              </div>
              <div v-else class="empty-state compact">请选择套餐、功能或硬件。</div>
            </div>
            <div class="grand-total-box">
              <div class="total-row">
                <span>产品合计</span>
                <span>{{ 格式金额(报价预估金额) }}</span>
              </div>
              <div class="total-row">
                <span>标准工作量建议</span>
                <span>{{ 试算结果?.workloadSummary || "保存前可先试算" }}</span>
              </div>
              <div class="total-row grand">
                <span>报价总额</span>
                <span>{{ 格式金额(报价预估金额) }}</span>
              </div>
            </div>
            <button class="btn btn-default" type="button" @click="报价预览">📄 试算报价</button>
          </section>
        </template>

        <template v-if="模块 === 'orders'">
          <label class="full">
            <span>关联报价</span>
            <select v-model="表单.quoteId" class="form-control">
              <option value="">请选择报价单</option>
              <option v-for="item in 报价候选" :key="item.id" :value="item.id">
                {{ item.客户名称 }} / {{ 格式金额(item.金额) }}
              </option>
            </select>
          </label>
        </template>

        <div class="full v2-表单动作">
          <button
            v-if="模块 === 'registrations' && 报备步骤 > 1"
            class="btn btn-default"
            type="button"
            @click="报备上一步"
          >
            上一步
          </button>
          <button v-else class="btn btn-default" type="button" @click="路由器.back()">取消</button>
          <button
            class="btn btn-primary"
            type="submit"
            :disabled="
              提交中 || (模块 === 'quotes' && (!表单.opportunityId || !表单.productIds.length))
            "
          >
            <template v-if="提交中">提交中...</template>
            <template v-else-if="模块 === 'registrations' && 报备步骤 < 报备步骤列表.length">
              下一步
            </template>
            <template v-else-if="模块 === 'registrations'">提交审核</template>
            <template v-else-if="模块 === 'opportunities'">创建商机</template>
            <template
              v-else-if="模块 === 'quotes' && (!表单.opportunityId || !表单.productIds.length)"
            >
              请完善信息
            </template>
            <template v-else>确认提交</template>
          </button>
        </div>
      </form>
    </section>

    <section v-else-if="当前页面动作 === 'import'" class="card">
      <div class="card-header">
        <h2 class="card-title">{{ 标题 }}</h2>
        <div class="v2-页面动作">
          <button class="btn btn-default" type="button" @click="下载导入模板">📥 下载模板</button>
          <label class="btn btn-primary">
            📤 上传并预检
            <input type="file" accept=".csv,.xlsx,.xls" hidden @change="预检导入文件" />
          </label>
        </div>
      </div>
      <div class="v2-导入面板">
        <div class="empty-state">
          <span v-if="导入文件名">当前文件：{{ 导入文件名 }}</span>
          <span v-else>请选择 CSV 或 Excel 文件进行预检。</span>
        </div>
        <div v-if="导入预检结果" class="v2-导入结果">{{ 导入预检结果 }}</div>
      </div>
    </section>

    <section v-else-if="是审核中心" class="v2-review-page">
      <div class="v2-review-tabs">
        <button
          type="button"
          :class="{ active: 审核当前标签 === 'registration' }"
          @click="审核当前标签 = 'registration'"
        >
          📋 客户报备
          <span v-if="审核客户报备列表.length" class="nav-badge">
            {{ 审核客户报备列表.length }}
          </span>
        </button>
        <button
          type="button"
          :class="{ active: 审核当前标签 === 'partner' }"
          @click="审核当前标签 = 'partner'"
        >
          🤝 渠道商
          <span v-if="审核渠道商列表.length" class="nav-badge">{{ 审核渠道商列表.length }}</span>
        </button>
        <button
          type="button"
          :class="{ active: 审核当前标签 === 'staff' }"
          @click="审核当前标签 = 'staff'"
        >
          👤 员工
          <span v-if="审核员工列表.length" class="nav-badge">{{ 审核员工列表.length }}</span>
        </button>
      </div>

      <article class="card">
        <div class="card-header">
          <h2 class="card-title">
            {{
              审核当前标签 === "registration"
                ? "客户报备审核"
                : 审核当前标签 === "partner"
                  ? "渠道商审核"
                  : "渠道商员工审核"
            }}
          </h2>
        </div>
        <div v-if="加载中" class="empty-state">数据加载中...</div>
        <div v-else class="table-wrap">
          <table>
            <thead>
              <tr v-if="审核当前标签 === 'registration'">
                <th>报备编号</th>
                <th>客户名称</th>
                <th>所属区域</th>
                <th>行业</th>
                <th>联系人</th>
                <th>状态</th>
                <th>提交日期</th>
                <th>操作</th>
              </tr>
              <tr v-else-if="审核当前标签 === 'partner'">
                <th>渠道商编号</th>
                <th>公司名称</th>
                <th>所属区域</th>
                <th>级别</th>
                <th>联系人</th>
                <th>状态</th>
                <th>提交日期</th>
                <th>操作</th>
              </tr>
              <tr v-else>
                <th>员工编号</th>
                <th>姓名</th>
                <th>所属渠道商</th>
                <th>职位</th>
                <th>联系方式</th>
                <th>状态</th>
                <th>提交日期</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in 当前审核列表"
                :key="`${审核当前标签}-${row.id}`"
                class="clickable-row"
                @click="打开详情(row)"
              >
                <template v-if="审核当前标签 === 'registration'">
                  <td>{{ row.编号 || row.id }}</td>
                  <td>
                    <strong>{{ row.客户名称 || 主标题(row) }}</strong>
                  </td>
                  <td>
                    <span class="tag tag-purple">{{ row.区域 || "未分配" }}</span>
                  </td>
                  <td>{{ 字段(row, "industry", "行业") || "-" }}</td>
                  <td>{{ 联系方式(row) }}</td>
                  <td>
                    <span class="tag" :class="状态类(row)">{{ 状态名称(row) }}</span>
                  </td>
                  <td>{{ 格式时间(row.创建时间) }}</td>
                  <td @click.stop>
                    <button
                      v-if="row.状态 === 'pending'"
                      class="btn btn-success btn-sm"
                      type="button"
                      @click="通过报备(row)"
                    >
                      ✓ 通过
                    </button>
                    <button
                      v-if="row.状态 === 'pending'"
                      class="btn btn-danger btn-sm"
                      type="button"
                      @click="驳回报备(row)"
                    >
                      ✕ 拒绝
                    </button>
                    <span v-if="row.状态 === 'approved'" class="v2-muted">已通过</span>
                  </td>
                </template>
                <template v-else>
                  <td>{{ row.编号 || row.id }}</td>
                  <td>
                    <strong>{{ 主标题(row) }}</strong>
                  </td>
                  <td>{{ row.区域 || "-" }}</td>
                  <td>{{ 字段(row, "level", "role", "职位") || "-" }}</td>
                  <td>{{ 联系方式(row) }}</td>
                  <td>
                    <span class="tag" :class="状态类(row)">{{ 状态名称(row) }}</span>
                  </td>
                  <td>{{ 格式时间(row.创建时间) }}</td>
                  <td>
                    <button
                      class="btn btn-default btn-sm"
                      type="button"
                      @click.stop="打开详情(row)"
                    >
                      查看
                    </button>
                  </td>
                </template>
              </tr>
              <tr v-if="!当前审核列表.length">
                <td colspan="8">
                  <div class="empty-state">
                    {{
                      审核当前标签 === "registration"
                        ? "暂无客户报备审核记录"
                        : 审核当前标签 === "partner"
                          ? "暂无渠道商审核记录"
                          : "暂无员工审核记录"
                    }}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="pagination">
          <span class="pagination-info">共 {{ 当前审核列表.length }} 条</span>
        </div>
      </article>
    </section>

    <section v-else-if="是开放接口页" class="v2-admin-config-page">
      <article class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">OpenAPI 对接总览</h2>
            <p class="v2-card-desc">
              给 AI-agent / 第三方系统使用的标准接口入口、鉴权参数和对接文档下载入口。
            </p>
          </div>
          <button class="btn btn-default" type="button" :disabled="加载中" @click="刷新">
            {{ 加载中 ? "刷新中..." : "刷新" }}
          </button>
        </div>

        <div class="stats-grid v2-config-stats">
          <article class="stat-card">
            <span class="stat-label">Base URL</span>
            <strong class="v2-code-text">{{ 开放接口BaseUrl }}</strong>
            <button class="btn btn-text btn-sm" type="button" @click="复制文本(开放接口BaseUrl)">
              复制
            </button>
          </article>
          <article class="stat-card">
            <span class="stat-label">Token 地址</span>
            <strong class="v2-code-text">{{ 开放接口Token地址 }}</strong>
            <button class="btn btn-text btn-sm" type="button" @click="复制文本(开放接口Token地址)">
              复制
            </button>
          </article>
          <article class="stat-card">
            <span class="stat-label">鉴权方式</span>
            <strong class="v2-code-text">Authorization: Bearer accessToken</strong>
            <small>Token 有效期 {{ 开放接口Token有效期 }}</small>
          </article>
          <article class="stat-card">
            <span class="stat-label">核心资源</span>
            <div class="v2-tag-list">
              <span v-for="item in 开放接口核心资源" :key="item" class="tag tag-blue">
                {{ 开放接口资源名称(item) }}
              </span>
            </div>
          </article>
        </div>

        <div class="v2-config-two-col">
          <section class="v2-config-panel">
            <h3>对接参数速览</h3>
            <div class="v2-param-grid">
              <strong>AppKey</strong><span>在下方 Client 表格中查看，用于换取 accessToken。</span>
              <strong>AppSecret</strong><span>仅创建或重置时一次性展示，系统只保存哈希。</span>
              <strong>IP 白名单</strong><span>为空表示不限制；生产联调建议只填写对方出口 IP。</span>
              <strong>绑定 CRM 用户</strong
              ><span>决定对接方能看到的数据范围，沿用 CRM 账号权限。</span> <strong>资源授权</strong
              ><span>按用户、渠道商、客户报备、商机、报价、订单等资源收敛。</span>
            </div>
          </section>
          <section class="v2-config-panel">
            <h3>对接文档下载</h3>
            <div v-if="!开放接口文档列表.length" class="empty-state compact">暂无文档清单</div>
            <div v-for="doc in 开放接口文档列表" :key="doc.id" class="v2-doc-row">
              <span>
                <strong>{{ doc.title }}</strong>
                <small>{{ doc.description }}</small>
              </span>
              <button
                class="btn btn-default btn-sm"
                type="button"
                :disabled="!doc.available"
                @click="下载开放接口文档(doc)"
              >
                下载
              </button>
            </div>
          </section>
        </div>
      </article>

      <article class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Client 凭证管理</h2>
            <p class="v2-card-desc">
              可修改绑定用户、白名单、资源范围和有效期。AppSecret 明文只在新建或重置后展示一次。
            </p>
          </div>
          <button class="btn btn-primary" type="button" @click="打开新增开放接口客户端">
            新增 Client
          </button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Client 名称</th>
                <th>AppKey</th>
                <th>AppSecret</th>
                <th>绑定用户</th>
                <th>状态</th>
                <th>IP 白名单</th>
                <th>资源范围</th>
                <th>有效期</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="client in 开放接口客户端列表" :key="client.id">
                <td>
                  <strong>{{ client.name }}</strong>
                  <small class="v2-muted block">{{ client.id }}</small>
                </td>
                <td>
                  <span class="v2-code-text">{{ client.appKey }}</span>
                  <button
                    class="btn btn-text btn-sm"
                    type="button"
                    @click="复制文本(client.appKey)"
                  >
                    复制 AppKey
                  </button>
                </td>
                <td>
                  <span class="v2-muted">历史明文不可查看</span>
                  <button
                    class="btn btn-text btn-sm danger"
                    type="button"
                    @click="重置开放接口Client密钥(client)"
                  >
                    重置并显示新密钥
                  </button>
                </td>
                <td>
                  <strong>{{ client.boundUser?.name || client.boundUserId || "-" }}</strong>
                  <small class="v2-muted block">
                    {{ client.boundUser?.username || "" }}
                    {{
                      开放接口角色名称[client.boundUser?.role || ""] || client.boundUser?.role || ""
                    }}
                  </small>
                </td>
                <td>
                  <span class="tag" :class="client.status === 'active' ? 'tag-green' : 'tag-gray'">
                    {{ client.status === "active" ? "启用" : "停用" }}
                  </span>
                </td>
                <td>{{ 格式开放接口列表(client.ipWhitelist) }}</td>
                <td>{{ 格式开放接口资源(client.allowedResources) }}</td>
                <td>{{ 格式开放接口日期(client.expiresAt) }}</td>
                <td>
                  <button
                    class="btn btn-text btn-sm"
                    type="button"
                    @click="打开编辑开放接口客户端(client)"
                  >
                    编辑
                  </button>
                </td>
              </tr>
              <tr v-if="!开放接口客户端列表.length">
                <td colspan="9"><div class="empty-state">暂无 OpenAPI Client</div></td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">OpenAPI 调用审计</h2>
            <p class="v2-card-desc">
              展示最近调用记录，便于联调时定位 401 / 403 / 404 / 权限范围问题。
            </p>
          </div>
          <button class="btn btn-default" type="button" @click="加载开放接口页面">刷新日志</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>时间</th>
                <th>Client</th>
                <th>结果</th>
                <th>接口</th>
                <th>IP</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in 开放接口日志列表" :key="log.id || log.requestId">
                <td>{{ 格式时间(log.time) }}</td>
                <td>{{ log.clientName || "-" }}</td>
                <td>
                  <span
                    :class="
                      log.resultCode >= 200 && log.resultCode < 400 ? 'v2-success' : 'v2-danger'
                    "
                  >
                    {{ log.resultCode }}
                  </span>
                </td>
                <td class="v2-code-text">{{ log.method }} {{ log.path }}</td>
                <td>{{ log.ip || "-" }}</td>
                <td>{{ log.resultMessage || "-" }}</td>
              </tr>
              <tr v-if="!开放接口日志列表.length">
                <td colspan="6"><div class="empty-state">暂无调用日志</div></td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <div v-if="开放接口弹窗" class="modal-overlay" @click.self="关闭开放接口弹窗">
        <section class="modal modal-lg">
          <header class="modal-header">
            <h2 class="modal-title">
              {{ 开放接口编辑中 ? "编辑 OpenAPI Client" : "新增 OpenAPI Client" }}
            </h2>
            <button class="modal-close" type="button" @click="关闭开放接口弹窗">×</button>
          </header>
          <div class="modal-body">
            <div class="form-grid">
              <label class="form-item">
                <span>Client 名称</span>
                <input
                  v-model="开放接口表单.name"
                  class="form-control"
                  placeholder="如 AI-agent-prod"
                />
              </label>
              <label class="form-item">
                <span>绑定 CRM 用户</span>
                <select v-model="开放接口表单.boundUserId" class="form-control">
                  <option value="">请选择绑定用户</option>
                  <option v-for="user in 开放接口用户候选" :key="user.id" :value="user.id">
                    {{ 开放接口用户显示(user) }}
                  </option>
                </select>
              </label>
              <label class="form-item">
                <span>状态</span>
                <select v-model="开放接口表单.status" class="form-control">
                  <option value="active">启用</option>
                  <option value="disabled">停用</option>
                </select>
              </label>
              <label class="form-item">
                <span>有效期</span>
                <input v-model="开放接口表单.expiresAt" class="form-control" type="date" />
              </label>
              <label class="form-item full">
                <span>IP 白名单</span>
                <textarea
                  v-model="开放接口表单.ipWhitelistText"
                  class="form-control"
                  rows="3"
                  placeholder="一行一个 IP，支持 *；为空表示不限制"
                ></textarea>
              </label>
              <div class="form-item full">
                <span>资源范围</span>
                <div class="v2-check-grid">
                  <label v-for="item in 开放接口资源选项" :key="item.value">
                    <input
                      v-model="开放接口表单.allowedResources"
                      type="checkbox"
                      :value="item.value"
                    />
                    <span>{{ item.label }}</span>
                  </label>
                </div>
              </div>
              <label class="form-item full">
                <span>备注</span>
                <textarea
                  v-model="开放接口表单.remark"
                  class="form-control"
                  rows="2"
                  placeholder="记录对接方、用途、环境等信息"
                ></textarea>
              </label>
            </div>
            <div v-if="开放接口表单错误" class="v2-错误提示">{{ 开放接口表单错误 }}</div>
          </div>
          <footer class="modal-footer">
            <button class="btn btn-default" type="button" @click="关闭开放接口弹窗">取消</button>
            <button
              class="btn btn-primary"
              type="button"
              :disabled="提交中"
              @click="保存开放接口表单"
            >
              {{ 提交中 ? "保存中..." : "保存" }}
            </button>
          </footer>
        </section>
      </div>

      <div v-if="开放接口密钥弹窗" class="modal-overlay" @click.self="开放接口密钥弹窗 = false">
        <section class="modal modal-lg">
          <header class="modal-header">
            <h2 class="modal-title">请立即保存 AppSecret</h2>
            <button class="modal-close" type="button" @click="开放接口密钥弹窗 = false">×</button>
          </header>
          <div class="modal-body">
            <div class="v2-warning-box">
              AppSecret 只在本次创建或重置后展示一次，关闭后无法从系统反查。
            </div>
            <div class="v2-param-grid">
              <strong>Client ID</strong
              ><span class="v2-code-text">{{ 开放接口密钥展示结果.id }}</span>
              <strong>AppKey</strong
              ><span class="v2-code-text">{{ 开放接口密钥展示结果.appKey }}</span>
              <strong>AppSecret</strong
              ><span class="v2-code-text v2-danger">{{ 开放接口密钥展示结果.appSecret }}</span>
            </div>
          </div>
          <footer class="modal-footer">
            <button
              class="btn btn-default"
              type="button"
              @click="复制文本(开放接口密钥展示结果.appKey)"
            >
              复制 AppKey
            </button>
            <button
              class="btn btn-primary"
              type="button"
              @click="复制文本(开放接口密钥展示结果.appSecret)"
            >
              复制 AppSecret
            </button>
          </footer>
        </section>
      </div>
    </section>

    <section v-else-if="是工作量配置页" class="v2-admin-config-page">
      <article class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">标准工作量配置</h2>
            <p class="v2-card-desc">
              新产品上线后自动进入映射清单；报价预览和保存报价会使用下方交付工作量规则。
            </p>
          </div>
          <div class="v2-config-actions">
            <input
              v-model="工作量搜索词"
              class="form-control compact"
              placeholder="搜索产品、模块、编码"
              @keyup.enter="刷新工作量映射"
            />
            <button class="btn btn-default" type="button" @click="刷新工作量映射">刷新</button>
          </div>
        </div>
      </article>

      <article class="card">
        <div class="card-header">
          <h2 class="card-title">产品映射规则</h2>
        </div>
        <div class="v2-mapping-editor">
          <label class="form-item">
            <span>软硬件产品</span>
            <select v-model="工作量映射表单.featureId" class="form-control">
              <option value="">请选择产品</option>
              <option v-for="item in 工作量映射选项" :key="item.featureId" :value="item.featureId">
                {{ 工作量选项文本(item) }}
              </option>
            </select>
          </label>
          <label class="form-item">
            <span>产品类型</span>
            <select v-model="工作量映射表单.deliveryTag" class="form-control">
              <option value="">不参与交付工作量</option>
              <option v-for="tag in 工作量标签选项" :key="tag.value" :value="tag.value">
                {{ tag.label }}
              </option>
            </select>
          </label>
          <div class="v2-config-actions">
            <button
              class="btn btn-primary"
              type="button"
              :disabled="!工作量映射表单.featureId"
              @click="保存当前工作量映射"
            >
              保存映射
            </button>
            <button class="btn btn-default" type="button" @click="重置工作量映射表单">清空</button>
          </div>
        </div>
        <div v-if="当前工作量映射" class="v2-current-mapping">
          当前选择：<strong>{{ 当前工作量映射.featureName }}</strong>
          <span>{{ 工作量产品类型(当前工作量映射) }}</span>
          <span>{{ 当前工作量映射.moduleName || 当前工作量映射.categoryName || "-" }}</span>
          <span>{{ 当前工作量映射.productCode || "-" }}</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>产品名称</th>
                <th>类型</th>
                <th>模块/分类</th>
                <th>产品编码/型号</th>
                <th>已映射产品类型</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in 工作量映射列表" :key="item.featureId">
                <td>
                  <strong>{{ item.featureName }}</strong>
                  <small class="v2-muted block">{{ item.categoryName || "-" }}</small>
                </td>
                <td>{{ 工作量产品类型(item) }}</td>
                <td>{{ item.moduleName || item.categoryName || "-" }}</td>
                <td class="v2-code-text">{{ item.productCode || "-" }}</td>
                <td>
                  <span class="tag" :class="工作量映射标签(item) ? 'tag-blue' : 'tag-gray'">
                    {{ 工作量映射标签名称(item) }}
                  </span>
                </td>
                <td>{{ item.active === false ? "停用" : "启用" }}</td>
                <td>
                  <button class="btn btn-text btn-sm" type="button" @click="编辑工作量映射(item)">
                    编辑
                  </button>
                </td>
              </tr>
              <tr v-if="!工作量映射列表.length">
                <td colspan="7"><div class="empty-state">暂无可配置产品</div></td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="card">
        <div class="card-header">
          <h2 class="card-title">交付工作量规则（LEP-DELIVERY-20260612）</h2>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>产品类型</th>
                <th>点数范围/适用条件</th>
                <th>人天</th>
                <th>组合项目加项</th>
                <th>说明</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="rule in 工作量规则列表" :key="rule.id">
                <td>{{ rule.productTypeLabel || rule.item }}</td>
                <td>{{ rule.condition || 格式工作量规则范围(rule) }}</td>
                <td>
                  <strong class="v2-success">{{ rule.personDays }}</strong>
                </td>
                <td>{{ rule.comboPersonDays !== null ? `+${rule.comboPersonDays}` : "-" }}</td>
                <td>{{ rule.remark || "-" }}</td>
                <td>{{ rule.active === false ? "停用" : "启用" }}</td>
                <td>
                  <button
                    class="btn btn-text btn-sm"
                    type="button"
                    @click="打开工作量规则弹窗(rule)"
                  >
                    编辑
                  </button>
                </td>
              </tr>
              <tr v-if="!工作量规则列表.length">
                <td colspan="7"><div class="empty-state">暂无工作量规则</div></td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <div v-if="工作量规则弹窗" class="modal-overlay" @click.self="工作量规则弹窗 = false">
        <section class="modal modal-lg">
          <header class="modal-header">
            <h2 class="modal-title">编辑工作量规则</h2>
            <button class="modal-close" type="button" @click="工作量规则弹窗 = false">×</button>
          </header>
          <div class="modal-body">
            <div class="form-grid">
              <label class="form-item full">
                <span>产品类型</span>
                <input v-model="工作量规则表单.productTypeLabel" class="form-control" disabled />
              </label>
              <label v-if="工作量规则表单.ruleType !== 'fixed'" class="form-item">
                <span>最小点数</span>
                <input
                  v-model.number="工作量规则表单.minPoints"
                  class="form-control"
                  type="number"
                  min="1"
                />
              </label>
              <label v-if="工作量规则表单.ruleType !== 'fixed'" class="form-item">
                <span>最大点数</span>
                <input
                  v-model.number="工作量规则表单.maxPoints"
                  class="form-control"
                  type="number"
                  min="1"
                />
              </label>
              <label v-if="工作量规则表单.ruleType === 'fixed'" class="form-item">
                <span>适用条件</span>
                <input class="form-control" value="独立项目" disabled />
              </label>
              <label class="form-item">
                <span>{{ 工作量规则表单.ruleType === "fixed" ? "独立项目人天" : "人天" }}</span>
                <input
                  v-model.number="工作量规则表单.personDays"
                  class="form-control"
                  type="number"
                  min="0"
                  step="0.5"
                />
              </label>
              <label v-if="工作量规则表单.ruleType === 'fixed'" class="form-item">
                <span>组合项目加项人天</span>
                <input
                  v-model.number="工作量规则表单.comboPersonDays"
                  class="form-control"
                  type="number"
                  min="0"
                  step="0.5"
                />
              </label>
              <label class="form-item">
                <span>状态</span>
                <select v-model="工作量规则表单.active" class="form-control">
                  <option :value="true">启用</option>
                  <option :value="false">停用</option>
                </select>
              </label>
              <label class="form-item full">
                <span>说明</span>
                <textarea v-model="工作量规则表单.remark" class="form-control" rows="3"></textarea>
              </label>
            </div>
          </div>
          <footer class="modal-footer">
            <button class="btn btn-default" type="button" @click="工作量规则弹窗 = false">
              取消
            </button>
            <button class="btn btn-primary" type="button" @click="保存当前工作量规则">保存</button>
          </footer>
        </section>
      </div>
    </section>

    <section v-else class="v2-列表页">
      <div v-if="是移动管理业务查询" class="segment-control">
        <button
          v-for="item in 管理业务标签列表"
          :key="item.模块"
          type="button"
          :class="{ active: 移动管理业务模块 === item.模块 }"
          @click="切换移动管理业务(item.模块)"
        >
          {{ item.名称 }}
        </button>
      </div>

      <div v-if="是移动 && 是渠道端 && 可新建" class="v2-write-entry">
        <div>
          <strong>{{ 新建按钮文案 }}</strong>
          <small>按 V2 手机端写入入口进入业务新建页面</small>
        </div>
        <RouterLink class="v2-button v2-button--primary" :to="新建路径()">进入</RouterLink>
      </div>

      <div class="search-bar">
        <div class="search-input-wrap">
          <span class="search-icon">🔍</span>
          <input
            v-model="筛选.keyword"
            class="form-control"
            :placeholder="列表搜索占位()"
            @keyup.enter="查询"
          />
        </div>
        <select
          v-if="当前业务模块 === 'partners'"
          v-model="筛选.level"
          class="form-control compact"
        >
          <option value="">全部级别</option>
          <option value="lep">💎 LEP</option>
          <option value="diamond">🔷 钻石</option>
          <option value="gold">🥇 金牌</option>
          <option value="silver">🥈 银牌</option>
          <option value="bronze">🥉 铜牌</option>
        </select>
        <select
          v-if="当前业务模块 === 'partners'"
          v-model="筛选.region"
          class="form-control compact"
        >
          <option value="">全部区域</option>
          <option>华东区</option>
          <option>华北区</option>
          <option>华南区</option>
          <option>西南区</option>
        </select>
        <select v-model="筛选.status" class="form-control compact">
          <option v-for="item in 状态选项列表" :key="item.值 || 'all'" :value="item.值">
            {{ item.标签 }}
          </option>
        </select>
        <select
          v-if="当前业务模块 === 'opportunities' && !是移动"
          v-model="商机当前视图"
          class="form-control compact"
        >
          <option value="list">📋 列表视图</option>
          <option value="kanban">📌 看板视图</option>
        </select>
        <button class="btn btn-primary" type="button" @click="查询">查询</button>
        <RouterLink v-if="可新建 && !是移动" class="btn btn-primary" :to="新建路径()"
          >➕ {{ 新建按钮文案 }}</RouterLink
        >
        <button v-if="!是移动" class="btn btn-default" type="button" @click="导出当前列表">
          📤 导出
        </button>
        <RouterLink v-if="导入路径 && !是移动" class="btn btn-default" :to="导入路径"
          >📥 批量导入</RouterLink
        >
      </div>

      <article :class="是移动 ? 'v2-mobile-list-shell' : 'card'">
        <div v-if="加载中" class="empty-state">数据加载中...</div>
        <div v-else-if="是移动" class="v2-移动卡片列表">
          <button
            v-for="row in 列表结果.数据"
            :key="row.id"
            class="record-card"
            type="button"
            @click="打开详情(row)"
          >
            <span class="record-card__top">
              <span class="tag" :class="状态类(row)">{{ 状态名称(row) }}</span>
              <small>{{ row.编号 || row.id }}</small>
            </span>
            <strong>{{ 主标题(row) }}</strong>
            <p>{{ 移动列表描述(row) }}</p>
            <span class="record-card__bottom">
              <span>{{ 格式时间(row.创建时间) }}</span>
              <b>{{ 移动列表底部(row) }}</b>
            </span>
          </button>
          <div v-if="!列表结果.数据.length" class="empty-state">暂无记录</div>
          <button
            v-if="筛选.page * 列表结果.分页.每页 < 列表结果.分页.总数"
            class="load-more"
            type="button"
            @click="
              筛选.page++;
              加载页面();
            "
          >
            加载更多
          </button>
        </div>
        <div
          v-else-if="当前业务模块 === 'opportunities' && 商机当前视图 === 'kanban'"
          class="opportunity-kanban"
        >
          <section v-for="stage in 商机看板列表" :key="stage.键" class="kanban-column">
            <header :style="{ background: stage.背景 }">
              <strong>{{ stage.名称 }}</strong>
              <span>{{ stage.数据.length }}</span>
            </header>
            <div class="kanban-column__body">
              <button
                v-for="row in stage.数据"
                :key="row.id"
                class="kanban-card"
                type="button"
                @click="打开详情(row)"
              >
                <strong>{{ 主标题(row) }}</strong>
                <small>{{ 商机客户名称(row) }}</small>
                <b>{{ 格式金额(数字字段(row, "金额", "amount")) }}</b>
                <span>
                  <i>{{ 商机负责人(row) }}</i>
                  <i>{{ 商机预计关闭(row) }}</i>
                </span>
              </button>
              <div v-if="!stage.数据.length" class="kanban-empty">暂无商机</div>
            </div>
            <footer :style="{ background: stage.背景 }">{{ 格式金额(stage.合计金额) }}</footer>
          </section>
        </div>
        <div v-else-if="当前业务模块 === 'products'" class="v2-product-catalog">
          <nav class="tab-nav" aria-label="产品目录标签">
            <button
              class="tab-item"
              :class="{ active: 产品当前标签 === 'products' }"
              type="button"
              @click="切换产品标签('products')"
            >
              💻 产品目录
            </button>
            <button
              class="tab-item"
              :class="{ active: 产品当前标签 === 'packages' }"
              type="button"
              @click="切换产品标签('packages')"
            >
              📦 推荐套餐
            </button>
          </nav>

          <template v-if="产品当前标签 === 'products'">
            <header class="v2-product-catalog__heading">
              <div>
                <h2>💻 产品目录</h2>
                <p>点击查看产品详情与价格体系</p>
              </div>
            </header>

            <div class="category-card-grid">
              <button
                v-for="category in 产品分类列表"
                :key="category.id"
                class="category-card"
                type="button"
                @click="打开产品分类(category)"
              >
                <span class="category-card-icon">{{ category.图标 }}</span>
                <span class="category-card-content">
                  <strong class="category-card-name">{{ category.名称 }}</strong>
                  <small class="category-card-desc">{{ category.描述 }}</small>
                  <span class="category-card-meta">
                    <span
                      class="tag"
                      :class="category.类型 === 'software' ? 'tag-blue' : 'tag-purple'"
                    >
                      {{ category.类型 === "software" ? "软件" : "硬件" }}
                    </span>
                    <span class="tag tag-gray">{{ category.模块数 }} 模块</span>
                    <span class="tag tag-gray">{{ category.功能数 }} 功能</span>
                  </span>
                </span>
                <b>→</b>
              </button>
            </div>

            <section v-if="硬件产品列表.length" class="v2-hardware-section">
              <h3>🖥️ 硬件产品</h3>
              <div class="feature-card-grid">
                <button
                  v-for="row in 硬件产品列表"
                  :key="row.id"
                  class="feature-card"
                  type="button"
                  @click="打开产品功能(row)"
                >
                  <span class="module-icon">{{ 产品分类图标(主标题(row)) }}</span>
                  <span>
                    <strong>{{ 主标题(row) }}</strong>
                    <small>{{ 产品卡描述(row) }}</small>
                    <b>{{ row.金额 ? 格式金额(row.金额) : 状态名称(row) }}</b>
                  </span>
                </button>
              </div>
            </section>

            <div
              v-if="!产品分类列表.length && !硬件产品列表.length"
              class="empty-state product-empty-state"
            >
              <div class="empty-icon">📦</div>
              <p>暂无产品数据</p>
              <p>请联系管理员配置产品目录</p>
            </div>
          </template>

          <template v-else>
            <header class="v2-product-catalog__heading">
              <div>
                <h2>📦 推荐套餐</h2>
                <p>精选产品组合，一键获取方案报价</p>
              </div>
            </header>
            <div class="package-card-grid">
              <article
                v-for="row in 推荐套餐列表"
                :key="row.id"
                class="package-card"
                tabindex="0"
                @click="打开产品功能(row)"
                @keydown.enter.prevent="打开产品功能(row)"
              >
                <span class="package-card__icon">📦</span>
                <span>
                  <strong>{{ 主标题(row) }}</strong>
                  <small>{{ 产品卡描述(row) }}</small>
                  <span class="category-card-meta">
                    <span class="tag tag-blue">{{ 产品模块名称(row) }}</span>
                    <span class="tag tag-green">{{ 状态名称(row) }}</span>
                  </span>
                </span>
                <RouterLink class="btn btn-primary btn-sm" :to="产品报价路径()" @click.stop>
                  快速报价
                </RouterLink>
              </article>
            </div>
            <div v-if="!推荐套餐列表.length" class="empty-state product-empty-state">
              <div class="empty-icon">📦</div>
              <p>暂无推荐套餐</p>
            </div>
          </template>
        </div>
        <div v-else class="table-wrap">
          <table>
            <thead>
              <tr>
                <th v-for="col in 当前列" :key="col.标题" :style="{ width: col.宽度 }">
                  {{ col.标题 }}
                </th>
                <th style="width: 180px">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in 列表结果.数据"
                :key="row.id"
                class="clickable-row"
                @click="打开详情(row)"
              >
                <td v-for="col in 当前列" :key="col.标题">
                  <template v-if="col.类型 === 'partnerName'">
                    <div class="v2-主列">
                      <strong>{{ 主标题(row) }}</strong>
                      <span
                        v-if="字段(row, 'techServiceType', '技术服务类型')"
                        class="tag tag-green"
                      >
                        🌱 {{ 字段(row, "techServiceType", "技术服务类型") }}
                      </span>
                    </div>
                  </template>
                  <template v-else-if="col.类型 === 'status'">
                    <span
                      class="tag"
                      :class="当前业务模块 === 'opportunities' ? 商机阶段标签类(row) : 状态类(row)"
                    >
                      <i
                        v-if="当前业务模块 === 'opportunities'"
                        class="stage-dot"
                        :style="{ background: 商机阶段点色(row) }"
                      ></i>
                      {{
                        当前业务模块 === "opportunities" ? 商机阶段名称(row) : 单元格文本(row, col)
                      }}
                    </span>
                  </template>
                  <template v-else-if="col.类型 === 'count'">
                    <span class="badge badge-primary">{{ 单元格文本(row, col) }} 人</span>
                  </template>
                  <template v-else>
                    {{ 单元格文本(row, col) }}
                  </template>
                </td>
                <td @click.stop>
                  <div class="v2-行操作">
                    <button class="btn btn-text btn-sm" type="button" @click="打开详情(row)">
                      详情
                    </button>
                    <button
                      v-if="当前业务模块 === 'registrations' && row.状态 === 'pending'"
                      class="btn btn-text btn-sm"
                      type="button"
                      @click="通过报备(row)"
                    >
                      通过
                    </button>
                    <button
                      v-if="当前业务模块 === 'registrations' && row.状态 === 'pending'"
                      class="btn btn-text btn-sm danger"
                      type="button"
                      @click="驳回报备(row)"
                    >
                      驳回
                    </button>
                    <RouterLink
                      v-if="当前业务模块 === 'registrations' && row.状态 === 'approved'"
                      class="btn btn-text btn-sm"
                      :to="`${是渠道端 ? '/partner' : '/admin'}/opportunity/new?registrationId=${encodeURIComponent(row.id)}`"
                    >
                      🎯 报备商机
                    </RouterLink>
                    <button
                      v-if="当前业务模块 === 'opportunities'"
                      class="btn btn-text btn-sm"
                      type="button"
                      @click="跟进商机(row)"
                    >
                      跟进
                    </button>
                    <button
                      v-if="当前业务模块 === 'quotes' && row.状态 === 'draft'"
                      class="btn btn-text btn-sm"
                      type="button"
                      @click="确认报价(row)"
                    >
                      确认
                    </button>
                    <button
                      v-if="当前业务模块 === 'quotes'"
                      class="btn btn-text btn-sm"
                      type="button"
                      @click="转订单(row)"
                    >
                      转订单
                    </button>
                    <button
                      v-if="
                        当前业务模块 === 'orders' &&
                        ['primary_confirmed', 'pending_superadmin_confirm'].includes(row.状态)
                      "
                      class="btn btn-text btn-sm"
                      type="button"
                      @click="确认订单(row)"
                    >
                      {{ row.状态 === "pending_superadmin_confirm" ? "超管确认" : "区管确认" }}
                    </button>
                    <button
                      v-if="当前业务模块 === 'partners'"
                      class="btn btn-text btn-sm"
                      type="button"
                      @click="打开占位动作('编辑渠道商')"
                    >
                      编辑
                    </button>
                    <button
                      v-if="当前业务模块 === 'partners'"
                      class="btn btn-text btn-sm purple"
                      type="button"
                      @click="打开占位动作('分销层级')"
                    >
                      分销层级
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="!列表结果.数据.length">
                <td :colspan="当前列.length + 1"><div class="empty-state">暂无记录</div></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div
          v-if="!是移动 && 当前业务模块 === 'opportunities' && 商机当前视图 === 'list'"
          class="opportunity-summary"
        >
          <span
            >共 <b>{{ 列表结果.数据.length }}</b> 条商机</span
          >
          <span
            >合计金额：<b>{{ 格式金额(商机金额合计) }}</b></span
          >
        </div>
        <div class="pagination">
          <span class="pagination-info"
            >共 {{ 列表结果.分页.总数 }} 条，第 {{ 列表结果.分页.页码 }} 页</span
          >
          <button
            class="btn btn-sm"
            type="button"
            :disabled="筛选.page <= 1"
            @click="
              筛选.page--;
              加载页面();
            "
          >
            上一页
          </button>
          <button class="btn btn-sm active" type="button">{{ 筛选.page }}</button>
          <button
            class="btn btn-sm"
            type="button"
            :disabled="筛选.page * 列表结果.分页.每页 >= 列表结果.分页.总数"
            @click="
              筛选.page++;
              加载页面();
            "
          >
            下一页
          </button>
        </div>
      </article>
    </section>

    <div v-if="产品分类详情" class="modal-overlay" @click.self="关闭产品分类">
      <section class="modal modal-xl v2-product-modal">
        <header class="modal-header">
          <div class="v2-product-modal__title">
            <span>{{ 产品分类详情.图标 }}</span>
            <span>
              <strong>{{ 产品分类详情.名称 }}</strong>
              <small>产品模块 · 点击卡片查看功能详情</small>
            </span>
          </div>
          <button class="modal-close" type="button" @click="关闭产品分类">×</button>
        </header>
        <div class="modal-body">
          <div class="module-card-grid">
            <button
              v-for="group in 产品分组明细(产品分类详情)"
              :key="group.id"
              class="module-card-v"
              type="button"
              @click="打开产品组首项(group.数据)"
            >
              <span>{{ group.图标 }}</span>
              <strong>{{ group.名称 }}</strong>
              <span class="tag tag-blue">{{ group.功能数 }} 功能</span>
              <small>{{ group.描述 }}</small>
              <b>查看 →</b>
            </button>
          </div>
        </div>
        <footer class="modal-footer">
          <button class="btn btn-default" type="button" @click="关闭产品分类">关闭</button>
        </footer>
      </section>
    </div>

    <div v-if="产品功能详情" class="modal-overlay" @click.self="关闭产品功能">
      <section class="modal modal-lg v2-product-modal">
        <header class="modal-header">
          <div class="v2-product-modal__title">
            <span>{{ 产品分类图标(主标题(产品功能详情)) }}</span>
            <span>
              <strong>{{ 主标题(产品功能详情) }}</strong>
              <small>{{ 产品分类名称(产品功能详情) }} › {{ 产品模块名称(产品功能详情) }}</small>
            </span>
          </div>
          <button class="modal-close" type="button" @click="关闭产品功能">×</button>
        </header>
        <div class="modal-body">
          <section class="v2-product-detail-desc">
            <p>{{ 产品卡描述(产品功能详情) }}</p>
          </section>
          <div class="v2-定义网格 v2-product-detail-grid">
            <div>
              <span>产品编号</span>
              <strong>{{ 产品功能详情.编号 || 产品功能详情.id }}</strong>
            </div>
            <div>
              <span>产品类型</span>
              <strong>{{ 产品功能详情.类型 || "功能模块" }}</strong>
            </div>
            <div>
              <span>当前状态</span>
              <strong>{{ 状态名称(产品功能详情) }}</strong>
            </div>
            <div>
              <span>计价方式</span>
              <strong>{{
                字段(产品功能详情, "priceType", "计价方式") || "按端点/模块计价"
              }}</strong>
            </div>
            <div class="highlight">
              <span>参考价格</span>
              <strong>{{ 产品功能详情.金额 ? 格式金额(产品功能详情.金额) : "按报价试算" }}</strong>
            </div>
            <div>
              <span>更新时间</span>
              <strong>{{ 格式时间(产品功能详情.更新时间) }}</strong>
            </div>
          </div>
        </div>
        <footer class="modal-footer">
          <button class="btn btn-default" type="button" @click="关闭产品功能">关闭</button>
          <RouterLink class="btn btn-primary" :to="产品报价路径()" @click="关闭产品功能">
            制作报价单 →
          </RouterLink>
        </footer>
      </section>
    </div>

    <div v-if="详情" class="modal-overlay" @click.self="关闭详情">
      <section v-if="当前业务模块 === 'quotes'" class="modal modal-xl">
        <header class="modal-header">
          <h2 class="modal-title">报价单预览 — {{ 详情.id }}</h2>
          <button class="modal-close" type="button" @click="关闭详情">×</button>
        </header>
        <div class="modal-body quote-modal-body">
          <div class="quote-header">
            <h2>🛡️ 联软安全产品报价单</h2>
            <p>UniSoft Security Products Quotation</p>
            <div class="quote-meta">
              <div class="quote-meta-item">
                <label>报价编号</label>
                <span>{{ 详情.id }}</span>
              </div>
              <div class="quote-meta-item">
                <label>客户名称</label>
                <span>{{ 报价客户名称(详情) }}</span>
              </div>
              <div class="quote-meta-item">
                <label>项目名称</label>
                <span>{{ 报价项目名称(详情) }}</span>
              </div>
              <div class="quote-meta-item">
                <label>报价日期</label>
                <span>{{ 格式时间(详情.创建时间) }}</span>
              </div>
              <div class="quote-meta-item">
                <label>有效期</label>
                <span>{{ 报价有效期(详情) }} 天</span>
              </div>
              <div class="quote-meta-item">
                <label>端点数量</label>
                <span>{{ 报价端点数(详情) }} 台</span>
              </div>
              <div class="quote-meta-item">
                <label>报价状态</label>
                <span>{{ 状态名称(详情) }}</span>
              </div>
            </div>
          </div>
          <div class="quote-body">
            <div class="quote-section-title">产品明细</div>
            <section
              v-for="group in 报价明细分组列表(详情)"
              :key="group.标题"
              class="quote-product-group"
            >
              <h3>{{ group.标题 }}</h3>
              <div class="table-wrap">
                <table class="quote-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>产品名称</th>
                      <th>数量</th>
                      <th>小计（元）</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(item, index) in group.数据" :key="`${group.标题}-${item.id}`">
                      <td>{{ index + 1 }}</td>
                      <td>{{ item.名称 }}</td>
                      <td>{{ item.数量 }}</td>
                      <td style="font-weight: 700">{{ 格式金额(item.小计) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
            <div v-if="字段(详情, 'workloadSummary', '工作量')" class="quote-workload">
              <div>
                <strong>标准工作量建议</strong>
                <span>{{ 字段(详情, "workloadSummary", "工作量") }}</span>
              </div>
              <b>{{ 字段(详情, "standardPersonDays", "标准人天") || "-" }}</b>
            </div>
            <div class="quote-total">
              <div class="quote-total-box">
                <div class="total-row">
                  <span>产品合计</span><span>{{ 格式金额(报价总额(详情)) }}</span>
                </div>
                <div class="total-row"><span>实施服务费</span><span>另行报价</span></div>
                <div class="total-row grand">
                  <span>报价总额</span><span>{{ 格式金额(报价总额(详情)) }}</span>
                </div>
              </div>
            </div>
            <div class="quote-sign">
              <span>报价方签章：___________________</span>
              <span>客户方签章：___________________</span>
            </div>
          </div>
        </div>
        <footer class="modal-footer">
          <button class="btn btn-default" type="button" @click="关闭详情">关闭</button>
          <button class="btn btn-default" type="button" @click="下载报价PDF">📄 下载 PDF</button>
          <button class="btn btn-primary" type="button" @click="修改报价(详情)">✏️ 修改报价</button>
          <button class="btn btn-primary quote-order-btn" type="button" @click="转订单(详情)">
            📦 转订单
          </button>
        </footer>
      </section>

      <section
        v-else-if="当前业务模块 === 'opportunities'"
        class="modal modal-xl v2-opportunity-modal"
      >
        <header class="modal-header">
          <h2 class="modal-title">{{ 主标题(详情) }}</h2>
          <button class="modal-close" type="button" @click="关闭详情">×</button>
        </header>
        <div class="modal-body v2-opportunity-body">
          <aside class="v2-opportunity-side">
            <span class="tag" :class="商机阶段标签类(详情)">
              <i class="stage-dot" :style="{ background: 商机阶段点色(详情) }"></i>
              {{ 商机阶段名称(详情) }}
            </span>
            <div class="v2-opportunity-info">
              <label>商机名称</label>
              <strong>{{ 主标题(详情) }}</strong>
            </div>
            <div class="v2-opportunity-info">
              <label>客户名称</label>
              <strong>{{ 商机客户名称(详情) }}</strong>
            </div>
            <div class="v2-opportunity-info">
              <label>联系人</label>
              <span>{{ 商机联系人(详情) }}</span>
            </div>
            <div class="v2-opportunity-info">
              <label>商机金额</label>
              <b>{{ 格式金额(数字字段(详情, "金额", "amount")) }}</b>
            </div>
            <div class="v2-opportunity-info">
              <label>预计签约</label>
              <span :class="{ danger: 商机是否逾期(详情) }">
                {{ 商机预计关闭(详情) }}
                <em v-if="商机是否逾期(详情)">已逾期</em>
              </span>
            </div>
            <div class="v2-opportunity-info">
              <label>负责人</label>
              <span>{{ 商机负责人(详情) }}</span>
            </div>
            <div class="v2-opportunity-linked">
              <strong>关联记录</strong>
              <div>
                <span>客户报备</span>
                <b>{{ 商机关联报备(详情) }}</b>
              </div>
              <div>
                <span>报价单</span>
                <b>{{ 字段(详情, "quoteId", "报价编号") || "未创建" }}</b>
              </div>
            </div>
          </aside>
          <section class="v2-opportunity-main">
            <div class="v2-stage-flow">
              <button
                v-for="stage in 商机阶段列表"
                :key="stage.键"
                type="button"
                :class="{ active: stage.键 === 商机阶段键(详情) }"
                :style="{ '--stage-color': stage.点色 }"
                @click="推进商机阶段(详情, stage)"
              >
                <i></i>
                <span>{{ stage.名称 }}</span>
              </button>
            </div>
            <div class="v2-opportunity-actions">
              <button class="btn btn-primary" type="button" @click="跟进商机(详情)">
                + 记录跟进
              </button>
              <RouterLink class="btn btn-default" :to="产品报价路径()" @click="关闭详情">
                📄 创建报价单
              </RouterLink>
              <button class="btn btn-default" type="button" @click="商机赢单转订单(详情)">
                📦 赢单转订单
              </button>
            </div>
            <section class="v2-follow-section">
              <div class="v2-section-title">跟进记录</div>
              <div class="timeline">
                <div class="timeline-item">
                  <div class="timeline-dot-wrap">
                    <div class="timeline-dot active"></div>
                    <div class="timeline-line"></div>
                  </div>
                  <div class="timeline-content">
                    <div class="tl-title">商机建立</div>
                    <div class="tl-time">{{ 格式时间(详情.创建时间) }}</div>
                    <div class="tl-desc">从报备客户进入商机跟进流程。</div>
                  </div>
                </div>
                <div class="timeline-item">
                  <div class="timeline-dot-wrap"><div class="timeline-dot active"></div></div>
                  <div class="timeline-content">
                    <div class="tl-title">{{ 商机阶段名称(详情) }}</div>
                    <div class="tl-time">
                      {{ 格式时间(字段(详情, "lastFollowAt", "最近跟进") || 详情.更新时间) }}
                    </div>
                    <div class="tl-desc">{{ 商机跟进摘要(详情) }}</div>
                  </div>
                </div>
              </div>
            </section>
            <section class="v2-opportunity-metrics">
              <div>
                <span>赢率</span>
                <strong>{{ 商机概率(详情) }}%</strong>
              </div>
              <div>
                <span>端点数</span>
                <strong>{{ 字段(详情, "endpoints", "端点数") || "—" }}</strong>
              </div>
              <div>
                <span>区域</span>
                <strong>{{ 字段(详情, "区域", "region") || "—" }}</strong>
              </div>
            </section>
          </section>
        </div>
        <footer class="modal-footer">
          <button class="btn btn-default" type="button" @click="关闭详情">关闭</button>
        </footer>
      </section>

      <section v-else class="modal modal-lg">
        <header class="modal-header">
          <h2 class="modal-title">{{ 详情.标题 || "业务详情" }}</h2>
          <button class="modal-close" type="button" @click="关闭详情">×</button>
        </header>
        <div class="modal-body">
          <section v-for="group in 详情分组列表(详情)" :key="group.标题" class="v2-详情分组">
            <h3>{{ group.标题 }}</h3>
            <div class="v2-定义网格">
              <div
                v-for="item in group.字段"
                :key="`${group.标题}-${item.标签}`"
                :class="{ highlight: item.重点 }"
              >
                <span>{{ item.标签 }}</span>
                <strong>{{ item.值 || "-" }}</strong>
              </div>
            </div>
          </section>
          <section v-if="当前业务模块 === 'registrations'" class="v2-详情分组">
            <h3>审批时间线</h3>
            <div class="v2-detail-summary">
              <div>
                <span>📦 订单总数</span>
                <strong>{{ 字段(详情, "orderCount", "订单总数") || "0" }}</strong>
              </div>
              <div>
                <span>💰 订单总额</span>
                <strong>{{ 格式金额(数字字段(详情, "orderAmount", "订单总额")) }}</strong>
              </div>
            </div>
            <div class="timeline">
              <div class="timeline-item">
                <div class="timeline-dot-wrap">
                  <div class="timeline-dot active"></div>
                  <div class="timeline-line"></div>
                </div>
                <div class="timeline-content">
                  <div class="tl-title">提交报备申请</div>
                  <div class="tl-time">{{ 格式时间(详情.创建时间) }}</div>
                </div>
              </div>
              <div class="timeline-item">
                <div class="timeline-dot-wrap">
                  <div
                    class="timeline-dot"
                    :class="状态类(详情) === 'tag-red' ? 'danger-dot' : 'active'"
                  ></div>
                  <div class="timeline-line"></div>
                </div>
                <div class="timeline-content">
                  <div class="tl-title">{{ 状态名称(详情) }}</div>
                  <div class="tl-desc">
                    {{ 字段(详情, "reviewReason", "审核意见") || "按迁移记录展示当前审批状态" }}
                  </div>
                </div>
              </div>
              <div v-if="状态类(详情) === 'tag-green'" class="timeline-item">
                <div class="timeline-dot-wrap"><div class="timeline-dot active"></div></div>
                <div class="timeline-content">
                  <div class="tl-title">报备保护期生效</div>
                  <div class="tl-desc">
                    有效期至 {{ 格式时间(字段(详情, "expireAt", "保护期至")) }}
                  </div>
                </div>
              </div>
            </div>
          </section>
          <section v-if="当前业务模块 === 'orders'" class="v2-详情分组">
            <h3>订单进度</h3>
            <div class="timeline">
              <div class="timeline-item">
                <div class="timeline-dot-wrap">
                  <div class="timeline-dot active"></div>
                  <div class="timeline-line"></div>
                </div>
                <div class="timeline-content">
                  <div class="tl-title">订单生成</div>
                  <div class="tl-time">{{ 格式时间(详情.创建时间) }}</div>
                </div>
              </div>
              <div class="timeline-item">
                <div class="timeline-dot-wrap"><div class="timeline-dot active"></div></div>
                <div class="timeline-content">
                  <div class="tl-title">{{ 状态名称(详情) }}</div>
                  <div class="tl-desc">
                    {{ 字段(详情, "deliveryAddr", "交付地址") || "等待订单履约处理" }}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
        <footer class="modal-footer">
          <button class="btn btn-default" type="button" @click="关闭详情">关闭</button>
        </footer>
      </section>
    </div>
  </section>
</template>
