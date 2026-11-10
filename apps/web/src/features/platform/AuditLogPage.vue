<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, onMounted, ref, watch } from "vue";

import { 处理业务会话失效 } from "../../api/auth-client.js";
import {
  type 客户查重冲突明细,
  type 客户查重周报,
  导出审计日志,
  查询客户查重周报,
  查询阶段9列表,
  读取阶段9概览,
  type 阶段9记录,
} from "../../api/business-client.js";
import type { 指标项 } from "../../components/war/types.js";
import WarKpis from "../../components/war/WarKpis.vue";
import { 文本, 日期时间文本 } from "../../shared/format/business-format.js";
import { 依赖业务说明, 依赖中文名 } from "../../shared/format/dependency-status.js";

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
const 每页 = ref(40);
const 每页选项 = [20, 40, 80, 100];
const 依赖列表 = ref<依赖项[]>([]);
const 依赖可用 = ref(false);
const 迁移状态 = ref<{ 批次编号: string; 正式落表: string; 校验结论: string } | null>(null);
const 搜索词 = ref("");
const 开始日期 = ref("");
const 结束日期 = ref("");
const 导出中 = ref(false);

/**
 * 操作审计分类：与后端 module_code 归集口径一一对应。
 * 「后台管理操作」反向收口其余全部模块，保证新增模块不会从审计分类里漏掉。
 */
const 审计分类项 = [
  "全部",
  "客户操作",
  "线索操作",
  "商机操作",
  "渠道操作",
  "订单操作",
  "后台管理操作",
];
const 当前分类 = ref("全部");
const 分类计数 = ref<Record<string, number>>({});
const 查重周报 = ref<客户查重周报 | null>(null);
const 查重周报加载中 = ref(false);
const 查重周报错误 = ref("");

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
  if (归一 === "warning" || 归一 === "warn") return "警告";
  if (归一 === "queued") return "排队中";
  if (归一 === "pending") return "待处理";
  return 文本(行.状态名称, 结果) || "—";
}

function 操作人(行: 阶段9记录): string {
  return 文本(取(行, "operatorName", "username", "createdBy"), 行.负责人, "—");
}

function 动作(行: 阶段9记录): string {
  return 动作清洗(
    文本(取(行, "actionCode"), 行.标题, 取(行, "action", "event", "title"), "未记录动作"),
  );
}

function 对象(行: 阶段9记录): string {
  const 名称 = 取(行, "targetName", "objectName");
  if (名称) return 名称;
  const 编号 = 取(行, "targetId") || 行.编号 || "";
  return 是否业务编号(编号) ? 编号 : "—";
}

/** 迁移批次状态和校验结论统一中文化，避免 validated 等后端枚举出现在用户页面。 */
function 迁移字段中文(值: unknown): string {
  const 原文 = 文本(值).trim();
  if (!原文) return "—";
  const 中文映射: Record<string, string> = {
    validated: "已校验",
    completed: "已完成",
    applied: "已应用",
    formalized: "已正式落表",
    running: "执行中",
    pending: "待执行",
    skipped: "已跳过",
    failed: "失败",
    unknown: "状态未记录",
  };
  if (中文映射[原文.toLowerCase()]) return 中文映射[原文.toLowerCase()]!;
  return /[\u4e00-\u9fa5]/.test(原文) ? 原文 : "状态待确认";
}

function 依赖(name: string): 依赖项 | undefined {
  return 依赖列表.value.find((项) => 项.name === name);
}

/**
 * 审计结果失败总数：取服务端全量计数，而不是已加载页的局部统计，
 * 否则最新 500 条里没有失败记录时会错误显示 0。
 */
const 失败总数 = ref(0);

const 总页数 = computed(() => Math.max(1, Math.ceil(日志总数.value / 每页.value)));

/** 页码按钮只展示当前页附近最多 7 页，避免几千条审计记录撑满页面。 */
const 页码按钮列表 = computed(() => {
  const 总数 = 总页数.value;
  const 当前 = Math.min(总数, Math.max(1, 页码.value));
  const 起点 = Math.max(1, Math.min(当前 - 3, 总数 - 6));
  const 终点 = Math.min(总数, 起点 + 6);
  return Array.from({ length: 终点 - 起点 + 1 }, (_, 序号) => 起点 + 序号);
});

let 搜索定时器: number | undefined;

watch([搜索词, 开始日期, 结束日期], () => {
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
  const 目标页 = Math.min(总页数.value, Math.max(1, 页码.value + 方向));
  if (目标页 === 页码.value) return;
  页码.value = 目标页;
  void 加载日志();
}

function 跳转到页码(目标页: number): void {
  const 页码值 = Math.min(总页数.value, Math.max(1, Number(目标页) || 1));
  if (页码值 === 页码.value) return;
  页码.value = 页码值;
  void 加载日志();
}

function 跳转输入(事件: Event): void {
  const 输入 = 事件.target as HTMLInputElement | null;
  跳转到页码(Number(输入?.value || 1));
}

watch(每页, () => {
  页码.value = 1;
  void 加载日志();
});

/** Element Plus 日期面板用本地日期比较，避免 UTC 转换导致可选范围偏移一天。 */
function 本地日期文本(日期: Date): string {
  const 年 = 日期.getFullYear();
  const 月 = String(日期.getMonth() + 1).padStart(2, "0");
  const 日 = String(日期.getDate()).padStart(2, "0");
  return `${年}-${月}-${日}`;
}

function 禁用开始日期(日期: Date): boolean {
  return Boolean(结束日期.value && 本地日期文本(日期) > 结束日期.value);
}

function 禁用结束日期(日期: Date): boolean {
  return Boolean(开始日期.value && 本地日期文本(日期) < 开始日期.value);
}

const 筛选已启用 = computed(() =>
  Boolean(搜索词.value.trim() || 开始日期.value || 结束日期.value || 当前分类.value !== "全部"),
);

function 清空筛选(): void {
  window.clearTimeout(搜索定时器);
  搜索词.value = "";
  开始日期.value = "";
  结束日期.value = "";
  当前分类.value = "全部";
  页码.value = 1;
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
  V3登录用户: "内部用户",
  V2页面用户: "历史业务用户",
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
  warning: "警告",
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
  approved: "已通过",
  registered: "已登记",
  validated: "已校验",
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
const 详情模块 = computed(() =>
  取值中文(模块中文映射, 文本(详情原始.value.moduleCode), "其他模块"),
);
const 详情对象类型 = computed(() =>
  取值中文(对象类型中文映射, 文本(详情原始.value.targetType), "业务对象"),
);
const 详情对象名称 = computed(() => 文本(详情原始.value.targetName));
/** 审批记录编号与业务对象编号都是可追溯标识，详情中并排展示，便于跨页面回查。 */
const 详情业务编号 = computed(() => 文本(详情原始.value.businessTargetId, 详情原始.value.targetId));
const 详情审批编号 = computed(() => 文本(详情原始.value.approvalId));

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
        附加字段中文映射[键] &&
        值 !== null &&
        值 !== undefined &&
        值 !== "" &&
        typeof 值 !== "object",
    )
    .map(([键, 值]) => ({ 键, 标签: 附加字段中文映射[键], 值: 值展示(值) }))
    .filter((项) => /[\u4e00-\u9fa5]/.test(项.值) || /^[\d,.-]+$/.test(项.值)),
);

/** 动作标题清洗：历史数据里夹带的后端字段名与枚举值统一翻译成中文。 */
const 动作词中文映射: Record<string, string> = {
  create: "新建业务记录",
  update: "更新业务记录",
  delete: "删除业务记录",
  login: "账号登录",
  logout: "退出登录",
  export: "导出数据",
  import: "导入数据",
  cancel: "业务取消",
  complete: "完成业务处理",
  return: "业务退回",
  status_change: "状态变更",
  change_status: "状态变更",
  primary_confirm: "一级确认",
  region_confirm: "区管确认",
  superadmin_confirm: "超管确认",
  resubmit_after_return: "退回后重新提交",
  create_from_quote: "报价转订单",
  price_adjust: "订单调价",
  create_client: "客户创建",
  update_client: "客户资料更新",
  update_warranty: "质保信息更新",
  create_from_registration: "报备转商机",
  customer_duplicate_conflict: "客户查重冲突",
  draft_calculated: "报价草稿核算",
  change_password: "修改登录密码",
  reset_secret: "重置登录凭证",
  "partner.create": "渠道商建档",
  "partner.profile.update": "渠道档案更新",
  "partner.level.update": "渠道等级更新",
  "partner.order_target.update": "渠道订单指标更新",
  set_level: "渠道等级设置",
  add_staff: "渠道成员添加",
  "channel_member.created": "渠道成员新增",
  "channel_member.updated": "渠道成员资料更新",
  "channel_member.enabled": "渠道成员启用",
  "channel_member.disabled": "渠道成员停用",
  "channel_member.archived": "渠道成员归档",
  "channel_member.business_role_synced": "渠道成员业务角色同步",
  "business_role.created": "业务角色创建",
  "member_business_role.assigned": "成员业务角色分配",
  "member_business_role.expired": "成员业务角色到期",
  "unit.created": "组织部门创建",
  "units.imported": "组织部门导入",
  "approval.approved": "审批通过",
  "approval.rejected": "审批驳回",
  "approval.region_approved": "区管初审通过",
  "approval.resubmitted": "审批重新提交",
  "audit.searched": "操作审计检索",
  "certification.issued": "证书签发",
  "certification.revoked": "证书撤销",
  "certification.extended": "证书延期",
  "certification_template.created": "证书模板创建",
  "opportunity.updated": "商机资料更新",
  "opportunity.owner_transferred": "商机负责人转移",
  "assignment.created": "分配任务创建",
  "assignment.updated": "分配任务更新",
  "assignment.expired": "分配任务到期",
  review_pending_approval: "审批待办巡检",
  process_pending: "待办处理",
  auto_requested: "OA 自动拉群申请",
  "oa.accepted": "OA 请求已接收",
  "oa.failed": "OA 请求失败",
  "offboarding.initiated": "离职交接发起",
  "offboarding.completed": "离职交接完成",
  "offboarding.owner_transferred": "离职负责人转移",
  "external_identity.batch_import": "外部身份批量导入",
  "eteams_identity.auto_bound": "企微身份自动绑定",
  "eteams_identity.candidate_created": "企微身份候选创建",
  "eteams_identity.confirmed": "企微身份确认",
  "eteams_identity.takeover": "企微身份接管",
  "wecom_identity.imported": "企微身份导入",
  "wecom_identity.corrected": "企微身份修正",
  "admin_accounts.synced": "管理账号同步",
  "admin_config.forbidden": "管理配置越权拦截",
  "rbac.user.roles.updated": "用户角色更新",
  update_mapping: "迁移映射更新",
  delete_mapping: "迁移映射删除",
  "migration.mapping_reconciled": "迁移映射校对",
  read_channel_config: "查询消息渠道配置",
  read_delivery_status: "查询消息投递状态",
  read_event_rules: "查询事件提醒规则",
  read_reminder_rules: "查询到期提醒规则",
  read_task_templates: "查询提醒任务模板",
  read_recipient_candidates: "查询提醒接收人",
  update_event_rule: "事件提醒规则更新",
  save_channel_config: "保存消息渠道配置",
  test_channel: "消息渠道测试",
  enable_channel: "启用消息渠道",
  enable_channel_by_deployment: "按部署启用消息渠道",
  "auth.login.succeeded": "账号登录成功",
  "auth.login.failed": "账号登录失败",
  "auth.login.rate_limited": "账号登录触发限流",
  "auth.logout": "退出登录",
  "auth.sso.iam.succeeded": "IAM 单点登录成功",
  "auth.sso.iam.failed": "IAM 单点登录失败",
  "auth.sso.unisdp.succeeded": "UniSDP 单点登录成功",
  "auth.sso.unisdp.failed": "UniSDP 单点登录失败",
  "auth.sso.unisdp_portal.succeeded": "UniSDP 门户登录成功",
  "auth.sso.unisdp_portal.failed": "UniSDP 门户登录失败",
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
};

function 动作清洗(原始动作: string): string {
  const 原值 = 原始动作.trim();
  if (!原值) return 原始动作;
  if (动作词中文映射[原值]) return 动作词中文映射[原值]!;
  if (动作词中文映射[原值.toLowerCase()]) return 动作词中文映射[原值.toLowerCase()]!;
  if (/^Auto audit:/i.test(原值)) return "系统自动记录业务变更";
  if (/^Quote updated successfully$/i.test(原值)) return "报价单已更新";
  if (/^EACCES:/.test(原值)) return "文件目录创建失败（权限不足）";
  const 清洗结果 = 原值
    .replace(
      /([A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)*)/g,
      (词) => 动作词中文映射[词] || 动作词中文映射[词.toLowerCase()] || 词,
    )
    .replace(/「([^」]*)」/g, (_原文, 内容: string) => {
      const 中文 = 状态值中文映射[内容] || 状态值中文映射[String(内容).toLowerCase()];
      return `「${中文 || 内容}」`;
    });
  if (/^[A-Za-z][A-Za-z0-9_.:-]*$/.test(清洗结果.trim())) return "其他业务操作";
  return 清洗结果;
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
      note: 依赖可用.value ? `${依赖列表.value.length} 项服务已检查` : "服务检查暂不可用",
    },
    {
      label: "数据库",
      value: postgres ? (postgres.status === "ok" ? "正常" : "异常") : "未知",
      unit: "",
      note: postgres ? 依赖业务说明("postgres", postgres.status) : "服务状态暂不可用",
    },
    {
      label: "缓存服务",
      value: redis ? (redis.status === "ok" ? "正常" : "异常") : "未知",
      unit: "",
      note: redis ? 依赖业务说明("redis", redis.status) : "服务状态暂不可用",
    },
    {
      label: "本周查重冲突",
      value: String(查重周报.value?.冲突次数 || 0),
      unit: "次",
      note: `涉及 ${查重周报.value?.涉及客户数 || 0} 家客户，${查重周报.value?.提交人数 || 0} 人提交`,
    },
    {
      label: "待处理告警",
      value: String(失败总数.value),
      unit: "项",
      note: "全部审计范围内的失败操作",
    },
    {
      label: "数据状态",
      value: 迁移状态.value ? "已就绪" : "暂无记录",
      unit: "",
      note: 迁移状态.value
        ? `检查结果：${迁移字段中文(迁移状态.value.校验结论)}`
        : "业务数据状态正常",
    },
  ];
});

onMounted(() => void 加载());

async function 导出当前筛选() {
  if (导出中.value) return;
  导出中.value = true;
  try {
    const 关键词 = 搜索词.value.trim();
    const 结果 = await 导出审计日志({
      ...(关键词 ? { keyword: 关键词 } : {}),
      ...(当前分类.value !== "全部" ? { module: 当前分类.value } : {}),
      ...(开始日期.value ? { from: 开始日期.value } : {}),
      ...(结束日期.value ? { to: 结束日期.value } : {}),
    });
    const 地址 = URL.createObjectURL(结果.内容);
    const 链接 = document.createElement("a");
    链接.href = 地址;
    链接.download = 结果.文件名;
    链接.click();
    URL.revokeObjectURL(地址);
  } catch (异常) {
    ElMessage.error(异常 instanceof Error ? 异常.message : "审计日志导出失败。");
  } finally {
    导出中.value = false;
  }
}

async function 加载日志() {
  加载中.value = true;
  错误.value = "";
  try {
    const 关键词 = 搜索词.value.trim();
    const 分类 = 当前分类.value === "全部" ? undefined : 当前分类.value;
    const 日志结果 = await 查询阶段9列表("audit", {
      ...(关键词 ? { keyword: 关键词 } : {}),
      ...(分类 ? { module: 分类 } : {}),
      ...(开始日期.value ? { from: 开始日期.value } : {}),
      ...(结束日期.value ? { to: 结束日期.value } : {}),
      记录审计检索: true,
      page: 页码.value,
      pageSize: 每页.value,
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

async function 加载查重周报() {
  查重周报加载中.value = true;
  查重周报错误.value = "";
  try {
    查重周报.value = await 查询客户查重周报();
  } catch (异常) {
    查重周报.value = null;
    查重周报错误.value = 异常 instanceof Error ? 异常.message : "客户查重冲突汇总加载失败。";
  } finally {
    查重周报加载中.value = false;
  }
}

function 冲突字段文本(明细: 客户查重冲突明细): string {
  return 明细.冲突字段.length ? 明细.冲突字段.join("、") : "客户名称或统一社会信用代码";
}

async function 加载() {
  await Promise.all([
    加载日志(),
    加载分类计数(),
    加载查重周报(),
    (async () => {
      const 概览结果 = await 读取阶段9概览().catch(() => null);
      迁移状态.value = 概览结果?.迁移状态 ?? null;
    })(),
    (async () => {
      const 依赖结果 = await fetch("/health/dependencies", { credentials: "include" })
        .then((响应) => {
          if (响应.status === 401) {
            处理业务会话失效();
            return null;
          }
          return 响应.ok ? 响应.json() : null;
        })
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
    <WarKpis :items="指标" :加载中="加载中" />

    <div class="审计布局">
      <section class="panel">
        <header class="panel-head">
          <div>
            <h2>操作审计</h2>
            <p>关键操作、账号、业务编号和变更结果，支持按业务分类筛选（点击行查看详情）。</p>
          </div>
          <div class="field search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input v-model="搜索词" placeholder="搜索操作人、动作、业务编号或结果" />
          </div>
        </header>
        <div class="审计筛选条">
          <label>
            <span>开始日期</span>
            <el-date-picker
              v-model="开始日期"
              class="审计日期输入"
              type="date"
              value-format="YYYY-MM-DD"
              format="YYYY-MM-DD"
              placeholder="选择开始日期"
              :disabled-date="禁用开始日期"
            />
          </label>
          <label>
            <span>结束日期</span>
            <el-date-picker
              v-model="结束日期"
              class="审计日期输入"
              type="date"
              value-format="YYYY-MM-DD"
              format="YYYY-MM-DD"
              placeholder="选择结束日期"
              :disabled-date="禁用结束日期"
            />
          </label>
          <button type="button" class="button small" :disabled="!筛选已启用" @click="清空筛选">
            一键清除筛选
          </button>
          <button
            type="button"
            class="button small primary"
            :disabled="导出中"
            @click="导出当前筛选"
          >
            {{ 导出中 ? "导出中…" : "导出当前筛选结果" }}
          </button>
        </div>
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
                  <td>
                    <span class="record-title">{{ 动作(日志) }}</span>
                  </td>
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
            <span class="pagination-info"
              >共 {{ 日志总数 }} 条，第 {{ 页码 }} / {{ 总页数 }} 页</span
            >
            <label class="每页选择">
              <span>每页</span>
              <select v-model.number="每页" class="form-control">
                <option v-for="选项 in 每页选项" :key="选项" :value="选项">{{ 选项 }}</option>
              </select>
              <span>条</span>
            </label>
            <button class="btn btn-sm" type="button" :disabled="页码 <= 1" @click="翻页(-1)">
              上一页
            </button>
            <button
              v-for="页 in 页码按钮列表"
              :key="页"
              class="btn btn-sm"
              :class="{ active: 页 === 页码 }"
              type="button"
              @click="跳转到页码(页)"
            >
              {{ 页 }}
            </button>
            <button class="btn btn-sm" type="button" :disabled="页码 >= 总页数" @click="翻页(1)">
              下一页
            </button>
            <label class="页码跳转">
              <span>跳至</span>
              <input
                :value="页码"
                type="number"
                min="1"
                :max="总页数"
                class="form-control"
                @change="跳转输入"
              />
              <span>页</span>
            </label>
          </div>
        </div>
      </section>

      <div class="grid-2 管理信息网格">
        <section class="panel 服务状态">
          <header class="panel-head">
            <div>
              <h2>服务状态</h2>
              <p>运行状态与服务检查。</p>
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
                  <small>{{ 依赖业务说明(项.name, 项.status) }}</small>
                </span>
                <b>{{ 项.status === "ok" ? "正常" : "异常" }}</b>
              </div>
              <div v-if="!依赖列表.length" class="member-risk-row warning">
                <span>
                  <strong>依赖检查不可用</strong>
                  <small>暂时无法获取服务状态。</small>
                </span>
                <b>未知</b>
              </div>
            </div>

            <div class="info-grid 迁移信息">
              <div class="info-item">
                <span>数据准备</span><strong>{{ 迁移状态 ? "已完成" : "暂无记录" }}</strong>
              </div>
              <div class="info-item">
                <span>业务数据</span><strong>{{ 迁移字段中文(迁移状态?.正式落表) }}</strong>
              </div>
              <div class="info-item">
                <span>检查结果</span><strong>{{ 迁移字段中文(迁移状态?.校验结论) }}</strong>
              </div>
              <div class="info-item"><span>备份情况</span><strong>暂无记录</strong></div>
            </div>
          </div>
        </section>

        <section class="panel 查重周报">
          <header class="panel-head">
            <div>
              <h2>本周客户查重冲突</h2>
              <p>重复报备被拦截时即时记录，可按提交人、冲突客户和完整报备信息追溯。</p>
            </div>
            <span v-if="查重周报" class="查重周期">
              {{ 日期时间文本(查重周报.周期开始) }} 至 {{ 日期时间文本(查重周报.统计截止) }}
            </span>
          </header>
          <div class="panel-body">
            <div v-if="查重周报加载中" class="war-empty">正在加载本周客户查重冲突…</div>
            <div v-else-if="查重周报错误" class="war-empty">{{ 查重周报错误 }}</div>
            <template v-else-if="查重周报">
              <div class="查重汇总">
                <div>
                  <span>冲突次数</span><strong>{{ 查重周报.冲突次数 }}</strong
                  ><small>本周被拦截的报备尝试</small>
                </div>
                <div>
                  <span>涉及客户</span><strong>{{ 查重周报.涉及客户数 }}</strong
                  ><small>存在重复的客户主体</small>
                </div>
                <div>
                  <span>提交人数</span><strong>{{ 查重周报.提交人数 }}</strong
                  ><small>发起重复报备的账号数</small>
                </div>
              </div>
              <div v-if="查重周报.明细.length" class="查重明细列表">
                <details v-for="明细 in 查重周报.明细" :key="明细.id" class="查重明细项">
                  <summary>
                    <span class="查重主体">
                      <strong>{{ 明细.客户名称 || "未填写客户名称" }}</strong>
                      <small>
                        {{ 日期时间文本(明细.发生时间) }} ·
                        {{ 明细.提交人 || 明细.提交账号 || "未知提交人" }}
                      </small>
                    </span>
                    <span class="查重冲突对象">
                      与「{{ 明细.冲突客户名称 || "未知客户" }}」重复 · {{ 冲突字段文本(明细) }}
                    </span>
                  </summary>
                  <div class="查重明细内容">
                    <div class="info-grid 查重信息网格">
                      <div class="info-item">
                        <span>提交账号</span><strong>{{ 明细.提交账号 || "—" }}</strong>
                      </div>
                      <div class="info-item">
                        <span>所属渠道</span><strong>{{ 明细.渠道名称 || "—" }}</strong>
                      </div>
                      <div class="info-item">
                        <span>所属区域</span><strong>{{ 明细.区域 || "—" }}</strong>
                      </div>
                      <div class="info-item">
                        <span>统一社会信用代码</span
                        ><strong>{{ 明细.统一社会信用代码 || "—" }}</strong>
                      </div>
                      <div class="info-item">
                        <span>联系人</span><strong>{{ 明细.联系人 || "—" }}</strong>
                      </div>
                      <div class="info-item">
                        <span>联系电话</span><strong>{{ 明细.联系电话 || "—" }}</strong>
                      </div>
                      <div class="info-item">
                        <span>所属行业</span><strong>{{ 明细.所属行业 || "—" }}</strong>
                      </div>
                      <div class="info-item">
                        <span>企业规模</span><strong>{{ 明细.企业规模 || "—" }}</strong>
                      </div>
                      <div class="info-item">
                        <span>客户来源</span><strong>{{ 明细.客户来源 || "—" }}</strong>
                      </div>
                      <div class="info-item 查重全宽">
                        <span>注册地址</span><strong>{{ 明细.注册地址 || "—" }}</strong>
                      </div>
                      <div class="info-item">
                        <span>项目名称</span><strong>{{ 明细.项目名称 || "—" }}</strong>
                      </div>
                      <div class="info-item">
                        <span>预计端点范围</span><strong>{{ 明细.预计端点范围 || "—" }}</strong>
                      </div>
                      <div class="info-item">
                        <span>申请保护期</span>
                        <strong>{{
                          明细.保护期天数 === null ? "—" : `${明细.保护期天数} 天`
                        }}</strong>
                      </div>
                      <div class="info-item 查重全宽">
                        <span>项目备注</span><strong>{{ 明细.项目备注 || "—" }}</strong>
                      </div>
                    </div>
                  </div>
                </details>
              </div>
              <div v-else class="war-empty">本周没有客户报备查重冲突。</div>
            </template>
          </div>
        </section>
      </div>
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
              <div class="info-item">
                <span>操作人</span><strong>{{ 操作人(详情) }}</strong>
              </div>
              <div class="info-item">
                <span>角色</span><strong>{{ 详情角色 }}</strong>
              </div>
              <div class="info-item">
                <span>模块</span><strong>{{ 详情模块 }}</strong>
              </div>
              <div class="info-item">
                <span>动作</span><strong>{{ 动作(详情) }}</strong>
              </div>
              <div class="info-item">
                <span>结果</span><strong>{{ 结果文本(详情) }}</strong>
              </div>
              <div class="info-item">
                <span>对象类型</span><strong>{{ 详情对象类型 }}</strong>
              </div>
              <div v-if="详情业务编号" class="info-item">
                <span>业务编号</span><strong>{{ 详情业务编号 }}</strong>
              </div>
              <div v-if="详情审批编号" class="info-item">
                <span>审批记录编号</span><strong>{{ 详情审批编号 }}</strong>
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
              另有 {{ 隐藏字段数 }} 项与本次业务操作无关的信息未展示。
            </p>
          </section>

          <section class="详情分组">
            <h3>附加信息</h3>
            <div v-if="附加字段.length" class="info-grid">
              <div v-for="项 in 附加字段" :key="项.键" class="info-item">
                <span>{{ 项.标签 }}</span
                ><strong>{{ 项.值 }}</strong>
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
.审计布局 {
  display: grid;
  gap: 12px;
}

.审计布局 .panel-head {
  gap: 10px;
}

/* 操作审计独占整行，本周查重冲突与服务状态在其下方并排，避免主表被窄栏挤压。 */
.管理信息网格 {
  grid-template-columns: minmax(0, 1.45fr) minmax(300px, 0.55fr);
  align-items: start;
}

.管理信息网格 .查重周报 {
  order: -1;
  margin-top: 0;
}

.审计布局 .table-wrap {
  max-height: 560px;
  overflow-y: auto;
}

.审计日期输入 {
  width: 168px;
}

.每页选择 {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-3);
  font-size: 11px;
}

.每页选择 .form-control {
  width: 72px;
  min-width: 72px;
  min-height: 30px;
  padding: 0 8px;
}

.页码跳转 {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-3);
  font-size: 11px;
}

.页码跳转 .form-control {
  width: 64px;
  min-width: 64px;
  min-height: 30px;
  padding: 0 8px;
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

.审计布局 .field.search {
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

/* 审计动作需要完整展示，不能因省略号丢失“新增 / 停用 / 审批”等关键差异。 */
.审计页 .record-title {
  overflow: visible;
  white-space: normal;
  text-overflow: clip;
  line-height: 1.55;
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

.审计筛选条 {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--line-soft);
  background: #f8fbff;
}

.审计筛选条 label {
  display: grid;
  gap: 4px;
  color: var(--text-3);
  font-size: 11px;
}

.审计筛选条 .form-control {
  min-width: 150px;
  min-height: 30px;
}

.查重周报 {
  margin-top: 12px;
}

.查重周期 {
  color: var(--text-3);
  font-size: 11px;
}

.查重汇总 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.查重汇总 > div {
  display: grid;
  gap: 3px;
  padding: 12px 14px;
  border: 1px solid var(--line-soft);
  border-radius: 9px;
  background: #f8fbff;
}

.查重汇总 span,
.查重汇总 small {
  color: var(--text-3);
  font-size: 11px;
}

.查重汇总 strong {
  color: var(--text-1);
  font-size: 18px;
}

.查重明细列表 {
  display: grid;
  gap: 8px;
}

.查重明细项 {
  overflow: hidden;
  border: 1px solid var(--line-soft);
  border-radius: 9px;
  background: #ffffff;
}

.查重明细项 summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 11px 13px;
  cursor: pointer;
  list-style: none;
}

.查重明细项 summary::-webkit-details-marker {
  display: none;
}

.查重明细项[open] summary {
  border-bottom: 1px solid var(--line-soft);
  background: #f8fbff;
}

.查重主体,
.查重冲突对象 {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.查重主体 strong {
  color: var(--text-1);
}

.查重主体 small,
.查重冲突对象 {
  color: var(--text-3);
  font-size: 11px;
}

.查重冲突对象 {
  flex: 0 1 auto;
  text-align: right;
}

.查重明细内容 {
  padding: 12px 13px 14px;
}

.查重信息网格 {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px 16px;
}

.查重全宽 {
  grid-column: span 2;
}

@media (max-width: 900px) {
  .管理信息网格 {
    grid-template-columns: minmax(0, 1fr);
  }

  .查重汇总,
  .查重信息网格 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .查重明细项 summary {
    align-items: flex-start;
    flex-direction: column;
  }

  .查重冲突对象 {
    text-align: left;
  }
}
</style>
