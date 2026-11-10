<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import {
  下载商机跟进附件,
  下载报价PDF,
  type 商机跟进附件,
  更新商机,
  查询阶段9全部,
  type 阶段9记录,
} from "../../api/business-client.js";
import { 读取用户列表 } from "../../api/organization-client.js";
import type { 指标项 } from "../../components/war/types.js";
import WarKpis from "../../components/war/WarKpis.vue";
import WarLayout from "../../components/war/WarLayout.vue";
import WarRecordCard from "../../components/war/WarRecordCard.vue";
import { 业务类型名称, 规范业务类型, 记录业务类型 } from "../../shared/business/business-type.js";
import {
  取数,
  文本,
  文本或,
  日期文本,
  日期时间文本,
  金额文本,
} from "../../shared/format/business-format.js";
import { use外壳前缀 } from "../../shared/navigation/shell-prefix.js";
import { 是内部管理员, 是超级管理员 } from "../../shared/permission/role.js";
import {
  商机七阶段,
  商机阶段文案,
  商机阶段进度,
  type 商机阶段键,
  映射商机阶段,
} from "../../shared/stages/opportunity-stage.js";
import { useSessionStore } from "../../stores/session.js";
import QuoteProfitPanel from "../quote/QuoteProfitPanel.vue";
import QuoteToOrderDialog from "../quote/QuoteToOrderDialog.vue";
import OpportunityFollowupForm from "./OpportunityFollowupForm.vue";

const 路由器 = useRouter();
const 外壳前缀 = use外壳前缀();
const 路由 = useRoute();
const 会话 = useSessionStore();
// 首屏即进入加载态，避免列表尚未返回时把 KPI 先算成 0 造成闪烁。
const 加载中 = ref(true);
const 是超管 = computed(() => 是超级管理员(会话.user));
const 转移弹窗 = ref(false);
const 转移提交中 = ref(false);
const 转移用户列表 = ref<Array<Record<string, unknown>>>([]);
const 转移表单 = reactive({ ownerUserId: "", changeReason: "商机负责人转移" });
const 错误 = ref("");
const 商机列表 = ref<阶段9记录[]>([]);
const 报价列表 = ref<阶段9记录[]>([]);
const 订单列表 = ref<阶段9记录[]>([]);
const 选中编号 = ref("");
const 当前标签 = ref("全部");
const 当前页签 = ref("跟进");
const 搜索词 = ref("");
const 选中区域 = ref("全部区域");
const 显示全部状态 = ref(false);
const 报价弹窗可见 = ref(false);
const 选中报价 = ref<阶段9记录 | null>(null);
const 转单弹窗可见 = ref(false);
const 待转报价 = ref<阶段9记录 | null>(null);

const 标签列表 = ["全部", "重点商机", "停滞风险"];
const 页签列表 = ["跟进", "报价", "订单", "档案与审计"];

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
  if (!显示全部状态.value) {
    列表 = 列表.filter(
      (row) => !["cancelled", "rejected", "archived"].includes(文本(row.状态).toLowerCase()),
    );
  }
  if (当前标签.value === "重点商机")
    列表 = 列表.filter((row) =>
      ["customer_solution", "poc_trial", "project_approval", "tender"].includes(阶段键(row)),
    );
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
  () => 过滤后列表.value.find((row) => row.id === 选中编号.value) || 过滤后列表.value[0] || null,
);

function 客户档案路径(row: 阶段9记录 | null | undefined): string {
  const 报备编号 = 字段(row, "registrationUuid");
  const 客户编号 = 字段(row, "customerUuid");
  if (报备编号) return `${外壳前缀.value}/registration?selected=${encodeURIComponent(报备编号)}`;
  if (客户编号)
    return `${外壳前缀.value}/registration?customerUuid=${encodeURIComponent(客户编号)}`;
  return "";
}

function 报备档案路径(row: 阶段9记录 | null | undefined): string {
  const 报备编号 = 字段(row, "registrationUuid");
  return 报备编号 ? `${外壳前缀.value}/registration?selected=${encodeURIComponent(报备编号)}` : "";
}

function 报价档案路径(row: 阶段9记录 | null | undefined): string {
  const 报价编号 = 字段(row, "quoteUuid");
  return 报价编号 ? `${外壳前缀.value}/quote?quoteId=${encodeURIComponent(报价编号)}` : "";
}

function 订单档案路径(订单编号: string): string {
  return 订单编号 ? `${外壳前缀.value}/order?orderId=${encodeURIComponent(订单编号)}` : "";
}

const 动态 = computed(() => {
  const 记录 = 当前商机.value;
  if (!记录) return [];
  const 时间 = 文本(记录.更新时间, 记录.创建时间);
  return ["商机阶段已更新", "关联报价已同步", "跟进记录已登记"]
    .map((标题, 序号) => ({
      标题,
      时间: 序号 === 0 ? 日期文本(时间) : "",
      说明: ["阶段与负责人信息", "报价状态与金额", "最近一次客户跟进"][序号] || "",
    }))
    .filter((项) => 项.时间 || 项.说明);
});

const 关联报价 = computed(() =>
  报价列表.value.filter(
    (报价) =>
      文本(报价.原始数据?.opportunityUuid, 报价.原始数据?.opportunityId) ===
      (当前商机.value?.id || ""),
  ),
);

const 跟进历史 = computed(() => {
  const 记录 = 当前商机.value;
  if (!记录) return [];
  const 数据 = 原始(记录);
  const 列表 = Array.isArray(数据.followups)
    ? (数据.followups as Array<Record<string, unknown>>)
    : [];
  if (列表.length) {
    return 列表.map((项, 序号) => {
      const 阶段值 = 文本(项.stage, 项.stageCode, 项.stageName);
      return {
        id: 文本(项.id, String(序号)),
        方式: 文本(项.followupMethod, 项.method, "商机跟进"),
        阶段: 阶段值 ? 商机阶段文案(映射商机阶段(阶段值)) : "未记录阶段",
        内容: 文本(项.content),
        下一步计划: 文本(项.nextStep),
        附件: Array.isArray(项.attachments) ? (项.attachments as 商机跟进附件[]) : [],
        操作人: 文本(项.actorName, "未记录操作人"),
        时间: 文本(项.createdAt, 项.followupAt),
      };
    });
  }
  // 兼容升级前只保存最近一次跟进文本的历史商机。
  const 最近内容 = 文本(字段(记录, "followup"));
  if (!最近内容) return [];
  return [
    {
      id: "legacy-followup",
      方式: "商机跟进",
      阶段: 阶段名称(记录),
      内容: 最近内容,
      下一步计划: 文本(字段(记录, "nextStep")),
      附件: [] as 商机跟进附件[],
      操作人: 文本(数据.updatedByName, 记录.负责人, "未记录操作人"),
      时间: 文本(数据.updatedAt, 记录.更新时间),
    },
  ];
});

async function 下载跟进附件(附件: 商机跟进附件): Promise<void> {
  try {
    const 结果 = await 下载商机跟进附件(附件);
    const 地址 = URL.createObjectURL(结果.内容);
    const 链接 = document.createElement("a");
    链接.href = 地址;
    链接.download = 结果.文件名;
    链接.click();
    URL.revokeObjectURL(地址);
  } catch (异常) {
    ElMessage.error(异常 instanceof Error ? 异常.message : "跟进附件下载失败。");
  }
}

const 关联订单 = computed(() =>
  订单列表.value.filter(
    (订单) =>
      文本(订单.原始数据?.opportunityUuid, 订单.原始数据?.opportunityId) ===
      (当前商机.value?.id || ""),
  ),
);

const 当前业务类型 = computed(() => 记录业务类型(当前商机.value));
const 当前业务类型名称 = computed(() => 业务类型名称(当前业务类型.value, "商机"));

const 关联产品订单 = computed(() => {
  const 数据 = 原始(当前商机.value).linkedProductOrders;
  return Array.isArray(数据) ? (数据 as Array<Record<string, unknown>>) : [];
});

const 可关联产品订单 = computed(() => {
  const 客户名称 = 当前商机.value?.客户名称 || "";
  return 订单列表.value.filter(
    (订单) =>
      记录业务类型(订单) === "product" &&
      订单.客户名称 === 客户名称 &&
      ["confirmed", "completed"].includes(文本(订单.状态, 字段(订单, "status"))),
  );
});

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
  const 完整 = Math.round(
    (字段清单.filter((值) => Boolean(文本(值))).length / 字段清单.length) * 100,
  );
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

const 报价状态映射: Record<string, string> = {
  draft: "草稿",
  submitted: "已提交",
  approved: "已通过",
  converted: "已转订单",
  rejected: "已驳回",
  expired: "已过期",
  cancelled: "已取消",
};

function 报价状态码(报价: 阶段9记录 | null | undefined): string {
  return 文本(报价?.状态, 字段(报价, "status"));
}

function 报价状态文本(报价: 阶段9记录 | null | undefined): string {
  // 报价通过统一使用“已通过”，避免历史状态名称把报价显示成订单语义的“已确认”。
  if (报价状态码(报价) === "approved") return "已通过";
  const 名称 = 文本(报价?.状态名称);
  if (名称 && !名称.includes("_")) return 名称;
  const 代码 = 报价状态码(报价);
  return 报价状态映射[代码] || (代码 ? "状态待确认" : "未设置状态");
}

function 报价明细(报价: 阶段9记录 | null | undefined): Array<Record<string, unknown>> {
  const 数据 = 原始(报价);
  const 报价项明细 = Array.isArray(数据.items)
    ? (数据.items as Array<Record<string, unknown>>)
    : [];
  const 硬件明细 = Array.isArray(数据.hardwareItems)
    ? (数据.hardwareItems as Array<Record<string, unknown>>)
    : [];
  if (!硬件明细.length) return 报价项明细;

  // 新版报价的 items 已包含硬件行，hardwareItems 只保存选型元数据，不能再次追加。
  // 老报价若只有独立硬件清单，则按产品编号去重后补齐，避免丢失历史明细。
  const 已存在标识 = new Set<string>();
  for (const 项 of 报价项明细) {
    for (const 值 of [项.名称, 项.name, 项.itemName, 项.productCode, 项.productId, 项.id]) {
      const 标识 = 文本(值).trim();
      if (标识) 已存在标识.add(标识);
    }
  }
  const 缺失硬件 = 硬件明细
    .filter((项) => {
      const 标识 = 文本(项.productCode, 项.productId, 项.id, 项.name, 项.名称).trim();
      return !标识 || !已存在标识.has(标识);
    })
    .map((项) => ({
      ...项,
      名称: 文本(项.name, 项.名称, 项.productName, 项.productCode, "硬件设备"),
    }));
  return [...报价项明细, ...缺失硬件];
}

function 报价项类型文本(项: Record<string, unknown>): string {
  const 类型 = 文本(项.类型, 项.type, 项.itemType);
  if (["feature", "software", "功能模块"].includes(类型)) return "功能模块";
  if (["hardware", "硬件产品"].includes(类型)) return "硬件产品";
  if (["service", "服务"].includes(类型)) return "服务";
  return 类型 && !/^[a-z_]+$/i.test(类型) ? 类型 : "报价项";
}

function 报价类型代码(报价: 阶段9记录 | null | undefined): string {
  return 文本(原始(报价).quoteTypeCode, "channel_distribution");
}

function 报价类型名称(报价: 阶段9记录 | null | undefined): string {
  return 文本(
    原始(报价).quoteTypeName,
    报价类型代码(报价) === "standard" ? "标准产品报价" : "渠道分销产品报价",
  );
}

function 是标准报价(报价: 阶段9记录 | null | undefined): boolean {
  return 报价类型代码(报价) === "standard";
}

function 报价金额文本(报价: 阶段9记录 | null | undefined): string {
  return 是标准报价(报价) ? "待区管定价" : 金额文本(报价?.金额);
}

const 内部管理员 = computed(() => 是内部管理员(会话.user));
const 可修改报价 = (报价: 阶段9记录 | null | undefined) =>
  ["draft", "rejected"].includes(报价状态码(报价));
const 可转订单 = (报价: 阶段9记录 | null | undefined) =>
  ["draft", "submitted", "approved", "rejected"].includes(报价状态码(报价));

function 替换商机(更新后: 阶段9记录) {
  const 序号 = 商机列表.value.findIndex((row) => row.id === 更新后.id);
  if (序号 < 0) {
    商机列表.value = [更新后, ...商机列表.value];
    return;
  }
  const 副本 = [...商机列表.value];
  副本.splice(序号, 1, 更新后);
  商机列表.value = 副本;
}

function 创建报价单(quoteTypeCode: "standard" | "channel_distribution") {
  const 记录 = 当前商机.value;
  if (!记录) return;
  路由器.push({
    path: `${外壳前缀.value}/quote/new`,
    query: { opportunityId: 记录.id, quoteTypeCode },
  });
}

function 查看报价(报价?: 阶段9记录) {
  const 目标 = 报价 || 关联报价.value[0];
  if (!目标) {
    ElMessage.warning("该商机还没有关联报价单，请先创建报价单。");
    return;
  }
  选中报价.value = 目标;
  报价弹窗可见.value = true;
}

function 关闭报价弹窗() {
  报价弹窗可见.value = false;
  选中报价.value = null;
}

function 修改报价(报价: 阶段9记录) {
  const 商机编号 = 当前商机.value?.id || "";
  路由器.push(
    `${外壳前缀.value}/quote/edit/${encodeURIComponent(报价.id)}${
      商机编号 ? `?opportunityId=${encodeURIComponent(商机编号)}` : ""
    }`,
  );
}

async function 打印报价(报价: 阶段9记录) {
  try {
    const 文件 = await 下载报价PDF(报价.id);
    const 地址 = URL.createObjectURL(文件.内容);
    const 窗口 = window.open(地址, "_blank");
    if (!窗口) {
      const 链接 = document.createElement("a");
      链接.href = 地址;
      链接.download = 文件.文件名;
      document.body.appendChild(链接);
      链接.click();
      链接.remove();
      ElMessage.success("已开始下载报价单 PDF，可在下载目录打开打印。");
    } else {
      ElMessage.success("报价单已在新窗口打开，可直接打印或另存为 PDF。");
    }
    window.setTimeout(() => URL.revokeObjectURL(地址), 60_000);
  } catch (异常) {
    ElMessage.error(异常 instanceof Error ? 异常.message : "报价单打印失败，请稍后重试。");
  }
}

function 转订单(报价: 阶段9记录) {
  待转报价.value = 报价;
  转单弹窗可见.value = true;
}

async function 转单成功() {
  转单弹窗可见.value = false;
  待转报价.value = null;
  报价弹窗可见.value = false;
  选中报价.value = null;
  await 加载(当前商机.value?.id || 选中编号.value);
  当前页签.value = "订单";
}

const 指标 = computed<指标项[]>(() => {
  const 列表 = 商机列表.value;
  const 推进中 = 列表.filter((row) => !["won", "lost", "cancelled"].includes(阶段键(row))).length;
  const 方案与试用 = 列表.filter((row) =>
    ["customer_solution", "poc_trial"].includes(阶段键(row)),
  ).length;
  const 立项与招投标 = 列表.filter((row) =>
    ["project_approval", "tender"].includes(阶段键(row)),
  ).length;
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

async function 加载(保留商机编号 = "") {
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
    // 支持从报价单/订单页带 ?opportunityId= 返回时直接选中对应商机。
    const 预选 = 文本(路由.query.opportunityId);
    const 保留 = 预选 || 保留商机编号;
    选中编号.value =
      (保留 && 商机列表.value.some((row) => row.id === 保留) ? 保留 : "") ||
      商机列表.value[0]?.id ||
      "";
  } catch (异常) {
    错误.value = 异常 instanceof Error ? 异常.message : "商机数据加载失败。";
  } finally {
    加载中.value = false;
  }
}

function 应用详情跟进(更新后: 阶段9记录) {
  替换商机(更新后);
  选中编号.value = 更新后.id;
}

const 编辑弹窗可见 = ref(false);
const 编辑提交中 = ref(false);
const 编辑表单 = ref({
  名称: "",
  金额: "",
  预计签约时间: "",
  业务类型: "product" as "product" | "maintenance",
  关联产品订单: [] as string[],
});

async function 打开转移负责人() {
  if (!当前商机.value) return;
  转移表单.ownerUserId = "";
  转移表单.changeReason = "商机负责人转移";
  转移弹窗.value = true;
  if (!转移用户列表.value.length) {
    try {
      const 结果 = await 读取用户列表();
      转移用户列表.value = (结果.数据 || []).filter(
        (用户) => String(用户.status || 用户.statusCode || "active") === "active",
      );
    } catch (异常) {
      ElMessage.error(异常 instanceof Error ? 异常.message : "读取用户列表失败。");
    }
  }
}

async function 提交转移负责人() {
  const 记录 = 当前商机.value;
  if (!记录 || !转移表单.ownerUserId) {
    ElMessage.warning("请选择新的负责人。");
    return;
  }
  转移提交中.value = true;
  try {
    await 更新商机(记录.id, {
      ownerUserId: 转移表单.ownerUserId,
      changeReason: 转移表单.changeReason.trim() || "商机负责人转移",
    });
    ElMessage.success("商机负责人已转移，并已通知新负责人。");
    转移弹窗.value = false;
    await 加载(记录.id);
  } catch (异常) {
    ElMessage.error(异常 instanceof Error ? 异常.message : "商机负责人转移失败。");
  } finally {
    转移提交中.value = false;
  }
}

function 打开编辑商机() {
  const 记录 = 当前商机.value;
  if (!记录) return;
  编辑表单.value = {
    名称: 文本(记录.标题, 字段(记录, "name")),
    金额: 记录.金额 === null || 记录.金额 === undefined ? "" : String(记录.金额),
    预计签约时间: 文本(字段(记录, "expectedClose")),
    业务类型: 当前业务类型.value,
    关联产品订单: 关联产品订单.value.map((项) => 文本(项.id, 项.orderNo)).filter(Boolean),
  };
  编辑弹窗可见.value = true;
}

async function 提交编辑商机() {
  const 记录 = 当前商机.value;
  if (!记录) return;
  const 名称 = 编辑表单.value.名称.trim();
  if (!名称) {
    ElMessage.warning("商机名称不能为空。");
    return;
  }
  if (编辑表单.value.业务类型 === "maintenance" && !编辑表单.value.关联产品订单.length) {
    ElMessage.warning("维保商机必须关联至少一个同客户的产品订单。");
    return;
  }
  编辑提交中.value = true;
  try {
    const 更新后 = await 更新商机(记录.id, {
      name: 名称,
      amount: Number(编辑表单.value.金额 || 0),
      expectedClose: 编辑表单.value.预计签约时间,
      businessTypeCode: 规范业务类型(编辑表单.value.业务类型),
      linkedProductOrderIds:
        编辑表单.value.业务类型 === "maintenance" ? 编辑表单.value.关联产品订单 : [],
      stage: 文本(字段(记录, "stage", "stageCode"), 记录.状态, "registered"),
      changeReason: "维护商机基本资料",
    });
    替换商机(更新后);
    选中编号.value = 更新后.id;
    ElMessage.success("商机资料已更新。");
    编辑弹窗可见.value = false;
  } catch (异常) {
    ElMessage.error(异常 instanceof Error ? 异常.message : "商机更新失败，请稍后重试。");
  } finally {
    编辑提交中.value = false;
  }
}
</script>

<template>
  <div class="vui war-artboard 商机页">
    <WarKpis :items="指标" :加载中="加载中" />

    <WarLayout
      v-model="搜索词"
      list-title="商机列表"
      :list-count="String(过滤后列表.length)"
      search-placeholder="搜索商机名称、客户、编号或报价单"
      :tabs="标签列表"
      :active-tab="当前标签"
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
              {{ 当前业务类型名称 }} · {{ 阶段名称(当前商机) }} · 成单概率 {{ 阶段完成率 }}
            </span>
          </div>
          <div v-if="是超管" class="center-actions">
            <button type="button" class="button" @click="打开转移负责人">转移负责人</button>
          </div>
        </div>
      </template>

      <template #list>
        <div v-if="加载中" class="war-empty">正在加载商机数据…</div>
        <div v-else-if="错误" class="war-empty">{{ 错误 }}</div>
        <label v-if="!加载中 && !错误" class="商机状态开关">
          <input v-model="显示全部状态" type="checkbox" />
          <span>显示已取消、已驳回与已归档商机（默认仅统计在管商机）</span>
        </label>
        <div v-for="row in 过滤后列表" :key="row.id" class="opportunity-list-item">
          <WarRecordCard
            :title="文本或([row.标题, row.客户名称], '未命名商机')"
            :meta="
              [阶段名称(row), 区域文本(row) || '未填写区域', 文本(row.客户名称, '未关联客户')].join(
                ' · ',
              )
            "
            :badge="商机阶段进度(阶段键(row)) || 阶段名称(row)"
            :tone="阶段键(row) === 'won' ? 'green' : 停滞(row) ? 'red' : 'blue'"
            :owner="`负责人：${文本(row.负责人, '未指派')}`"
            :amount="金额文本(row.金额)"
            :tags="[
              {
                text: 业务类型名称(记录业务类型(row), '商机'),
                hot: 记录业务类型(row) === 'maintenance',
              },
              { text: 阶段名称(row), hot: !['won', 'lost', 'cancelled'].includes(阶段键(row)) },
              { text: 停滞(row) ? `停滞 ${停滞天数(row)} 天` : `更新 ${日期文本(row.更新时间)}` },
            ]"
            :active="当前商机?.id === row.id"
            @选择="选中编号 = row.id"
          />
        </div>
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

          <section v-if="当前页签 === '报价'" class="panel">
            <header class="panel-head">
              <div>
                <h2>关联报价单</h2>
                <p>共 {{ 关联报价.length }} 份 · 点击报价卡可在当前商机内查看明细与业务动作</p>
              </div>
              <div class="center-actions">
                <button type="button" class="button" @click="创建报价单('standard')">
                  ＋ 标准产品报价
                </button>
                <button type="button" class="button" @click="创建报价单('channel_distribution')">
                  ＋ 渠道分销报价
                </button>
                <button type="button" class="button" @click="查看报价()">查看最近报价</button>
              </div>
            </header>
            <div class="panel-body">
              <template v-if="关联报价.length">
                <div class="quote-grid">
                  <article
                    v-for="报价 in 关联报价"
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
                      {{ 文本(字段(报价, "endpoints"), "—") }} · {{ 报价类型名称(报价) }} ·
                      {{ 报价金额文本(报价) }} · {{ 文本(报价.负责人, "未指派") }} ·
                      {{ 日期文本(报价.更新时间) }}
                    </p>
                  </article>
                </div>
              </template>
              <div v-else class="war-empty">该商机还没有关联报价单，可点击「＋新建报价」创建。</div>
            </div>
          </section>

          <section v-else-if="当前页签 === '跟进'" class="panel">
            <header class="panel-head">
              <div>
                <h2>商机跟进</h2>
                <p>直接记录沟通内容，可选同步推进阶段并写入审计</p>
              </div>
            </header>
            <div class="panel-body followup-panel-body">
              <OpportunityFollowupForm
                :商机="当前商机"
                :可推进阶段="true"
                @保存成功="应用详情跟进"
              />
              <div class="followup-history-head">
                <strong>跟进历史</strong>
                <span>共 {{ 跟进历史.length }} 条 · 最近记录在前</span>
              </div>
              <div v-if="跟进历史.length" class="followup-history-list">
                <article
                  v-for="跟进记录 in 跟进历史"
                  :key="跟进记录.id"
                  class="followup-history-item"
                >
                  <header>
                    <div>
                      <span class="followup-stage">{{ 跟进记录.阶段 }}</span>
                      <strong>{{ 跟进记录.方式 }}</strong>
                      <span>{{ 跟进记录.操作人 }}</span>
                    </div>
                    <time>{{ 日期时间文本(跟进记录.时间) }}</time>
                  </header>
                  <div class="followup-history-content">
                    <span>本次沟通内容</span>
                    <p>{{ 文本(跟进记录.内容, "未填写沟通内容") }}</p>
                  </div>
                  <div v-if="跟进记录.下一步计划" class="followup-history-meta">
                    <span v-if="跟进记录.下一步计划">下一步：{{ 跟进记录.下一步计划 }}</span>
                  </div>
                  <div v-if="跟进记录.附件.length" class="followup-history-attachments">
                    <span>附件</span>
                    <button
                      v-for="附件 in 跟进记录.附件"
                      :key="附件.存储名"
                      type="button"
                      @click="下载跟进附件(附件)"
                    >
                      {{ 附件.文件名 }}
                    </button>
                  </div>
                </article>
              </div>
              <div v-else class="war-empty">当前商机暂无跟进记录，可在上方直接登记。</div>
            </div>
          </section>

          <section v-else-if="当前页签 === '订单'" class="panel">
            <header class="panel-head">
              <div>
                <h2>关联订单</h2>
                <p>共 {{ 关联订单.length }} 笔 · 订单动作在订单中心处理</p>
              </div>
            </header>
            <div class="panel-body flush">
              <table class="vui-table">
                <thead>
                  <tr>
                    <th>订单编号</th>
                    <th>业务类型</th>
                    <th>状态</th>
                    <th>金额</th>
                    <th>更新时间</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="订单 in 关联订单" :key="订单.id">
                    <td>{{ 文本(订单.编号, "未编号") }}</td>
                    <td>{{ 业务类型名称(记录业务类型(订单), "订单") }}</td>
                    <td>{{ 文本(订单.状态名称, 订单.状态, "—") }}</td>
                    <td>{{ 金额文本(订单.金额) }}</td>
                    <td>{{ 日期文本(订单.更新时间) }}</td>
                  </tr>
                  <tr v-if="!关联订单.length">
                    <td colspan="5" class="war-empty">该商机还没有关联订单。</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section v-else class="panel">
            <header class="panel-head">
              <div>
                <h2>档案与审计</h2>
                <p>商机全字段、基本资料维护与时间戳</p>
              </div>
              <div class="center-actions">
                <button type="button" class="button primary" @click="打开编辑商机">
                  编辑商机资料
                </button>
              </div>
            </header>
            <div class="panel-body">
              <div class="info-grid">
                <div class="info-item">
                  <span>商机编号</span><strong>{{ 文本(当前商机.编号, "—") }}</strong>
                </div>
                <div class="info-item">
                  <span>商机名称</span><strong>{{ 文本(当前商机.标题, "—") }}</strong>
                </div>
                <div class="info-item">
                  <span>业务类型</span><strong>{{ 当前业务类型名称 }}</strong>
                </div>
                <div class="info-item">
                  <span>客户</span>
                  <strong v-if="客户档案路径(当前商机)">
                    <RouterLink class="追溯链接" :to="客户档案路径(当前商机)">
                      {{ 文本(当前商机.客户名称, "未关联") }}
                    </RouterLink>
                  </strong>
                  <strong v-else>{{ 文本(当前商机.客户名称, "未关联") }}</strong>
                </div>
                <div class="info-item">
                  <span>渠道商</span><strong>{{ 文本(当前商机.渠道名称, "未归属") }}</strong>
                </div>
                <div class="info-item">
                  <span>负责人</span><strong>{{ 文本(当前商机.负责人, "未指派") }}</strong>
                </div>
                <div class="info-item">
                  <span>所属区域</span><strong>{{ 区域文本(当前商机) || "未填写" }}</strong>
                </div>
                <div class="info-item">
                  <span>关联报备</span>
                  <strong v-if="报备档案路径(当前商机)">
                    <RouterLink class="追溯链接" :to="报备档案路径(当前商机)">
                      {{ 文本(字段(当前商机, "registrationNo"), "查看报备档案") }}
                    </RouterLink>
                  </strong>
                  <strong v-else>{{ 文本(字段(当前商机, "registrationNo"), "无") }}</strong>
                </div>
                <div class="info-item">
                  <span>关联报价</span>
                  <strong v-if="报价档案路径(当前商机)">
                    <RouterLink class="追溯链接" :to="报价档案路径(当前商机)">
                      {{ 文本(字段(当前商机, "quoteNo"), "查看报价单") }}
                    </RouterLink>
                  </strong>
                  <strong v-else>{{ 文本(字段(当前商机, "quoteNo"), "尚未报价") }}</strong>
                </div>
                <div class="info-item">
                  <span>关联产品订单</span>
                  <strong v-if="关联产品订单.length" class="order-trace-list">
                    <RouterLink
                      v-for="项 in 关联产品订单"
                      :key="文本(项.orderNo, 项.id)"
                      class="追溯链接"
                      :to="订单档案路径(文本(项.orderUuid, 项.orderId, 项.id))"
                    >
                      {{ 文本(项.orderNo, 项.id) }}
                    </RouterLink>
                  </strong>
                  <strong v-else>无</strong>
                </div>
                <div class="info-item">
                  <span>当前阶段</span><strong>{{ 阶段名称(当前商机) }}</strong>
                </div>
                <div class="info-item">
                  <span>预计金额</span><strong>{{ 金额文本(当前商机.金额) }}</strong>
                </div>
                <div class="info-item">
                  <span>创建时间</span><strong>{{ 日期文本(当前商机.创建时间) }}</strong>
                </div>
                <div class="info-item">
                  <span>更新时间</span><strong>{{ 日期文本(当前商机.更新时间) }}</strong>
                </div>
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
              <span>商机编号</span><strong>{{ 文本(当前商机.编号, "—") }}</strong>
            </div>
            <div class="info-item">
              <span>客户</span>
              <strong v-if="客户档案路径(当前商机)">
                <RouterLink class="追溯链接" :to="客户档案路径(当前商机)">
                  {{ 文本(当前商机.客户名称, "未关联") }}
                </RouterLink>
              </strong>
              <strong v-else>{{ 文本(当前商机.客户名称, "未关联") }}</strong>
            </div>
            <div class="info-item">
              <span>来源报备</span>
              <strong v-if="报备档案路径(当前商机)">
                <RouterLink class="追溯链接" :to="报备档案路径(当前商机)">
                  {{ 文本(字段(当前商机, "registrationNo"), "查看报备档案") }}
                </RouterLink>
              </strong>
              <strong v-else>{{ 文本(字段(当前商机, "registrationNo"), "无") }}</strong>
            </div>
            <div class="info-item">
              <span>商机状态</span><strong>{{ 阶段名称(当前商机) }}</strong>
            </div>
            <div class="info-item">
              <span>业务类型</span><strong>{{ 当前业务类型名称 }}</strong>
            </div>
            <div class="info-item">
              <span>关联产品订单</span>
              <strong v-if="关联产品订单.length" class="order-trace-list">
                <RouterLink
                  v-for="项 in 关联产品订单"
                  :key="文本(项.orderNo, 项.id)"
                  class="追溯链接"
                  :to="订单档案路径(文本(项.orderUuid, 项.orderId, 项.id))"
                >
                  {{ 文本(项.orderNo, 项.id) }}
                </RouterLink>
              </strong>
              <strong v-else>无</strong>
            </div>
            <div class="info-item">
              <span>成单概率</span><strong>{{ 阶段完成率 }}</strong>
            </div>
            <div class="info-item">
              <span>预计金额</span><strong>{{ 金额文本(当前商机.金额) }}</strong>
            </div>
            <div class="info-item">
              <span>负责人</span><strong>{{ 文本(当前商机.负责人, "未指派") }}</strong>
            </div>
            <div class="info-item">
              <span>渠道商</span><strong>{{ 文本(当前商机.渠道名称, "未归属") }}</strong>
            </div>
            <div class="info-item">
              <span>关联报价</span>
              <strong v-if="报价档案路径(当前商机)">
                <RouterLink class="追溯链接" :to="报价档案路径(当前商机)">
                  {{ 文本(字段(当前商机, "quoteNo"), "查看报价单") }}
                </RouterLink>
              </strong>
              <strong v-else>{{ 文本(字段(当前商机, "quoteNo"), "尚未报价") }}</strong>
            </div>
            <div class="info-item">
              <span>停滞天数</span>
              <strong>{{ 停滞天数(当前商机) === null ? "—" : `${停滞天数(当前商机)} 天` }}</strong>
            </div>
            <div class="info-item">
              <span>最近更新</span><strong>{{ 日期文本(当前商机.更新时间) }}</strong>
            </div>
          </div>
          <p class="war-note business-advice">下一步建议：{{ 下一步建议 }}</p>
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
          <p class="war-note">按阶段完成度、更新时效与资料完整度综合评估。</p>
        </article>
      </template>
    </WarLayout>

    <div v-if="编辑弹窗可见" class="modal-overlay" @click.self="编辑弹窗可见 = false">
      <section class="modal">
        <header class="modal-header">
          <h2 class="modal-title">编辑商机资料</h2>
          <button class="modal-close" type="button" @click="编辑弹窗可见 = false">×</button>
        </header>
        <div class="modal-body">
          <div class="form-grid">
            <label class="form-item full">
              <span>商机名称 *</span>
              <input v-model="编辑表单.名称" class="form-control" placeholder="商机名称" />
            </label>
            <label class="form-item">
              <span>预计金额（元）</span>
              <input
                v-model="编辑表单.金额"
                class="form-control"
                type="number"
                min="0"
                placeholder="0"
              />
            </label>
            <label class="form-item">
              <span>预计签约时间</span>
              <el-date-picker
                v-model="编辑表单.预计签约时间"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="选择预计签约时间"
                style="width: 100%"
              />
            </label>
            <label class="form-item">
              <span>业务类型 *</span>
              <select v-model="编辑表单.业务类型" class="form-control">
                <option value="product">产品商机</option>
                <option value="maintenance">维保商机</option>
              </select>
            </label>
            <label v-if="编辑表单.业务类型 === 'maintenance'" class="form-item full">
              <span>关联产品订单 *</span>
              <select v-model="编辑表单.关联产品订单" class="form-control" multiple size="5">
                <option v-for="订单 in 可关联产品订单" :key="订单.id" :value="订单.id">
                  {{ 文本(订单.编号, "未编号") }} · {{ 金额文本(订单.金额) }} ·
                  {{ 文本(订单.客户名称, "未关联客户") }}
                </option>
              </select>
              <small class="war-note">
                仅可关联同一客户、已确认或已完成的产品订单；可按住 Ctrl / Command 多选。
              </small>
            </label>
          </div>
          <p class="war-note">
            此处只维护商机基本资料；跟进记录和阶段推进请在「跟进」页签完成，保存动作会写入操作审计。
          </p>
        </div>
        <div class="modal-footer">
          <button type="button" class="button" @click="编辑弹窗可见 = false">取消</button>
          <button type="button" class="button primary" :disabled="编辑提交中" @click="提交编辑商机">
            {{ 编辑提交中 ? "保存中…" : "保存商机资料" }}
          </button>
        </div>
      </section>
    </div>

    <div v-if="报价弹窗可见 && 选中报价" class="modal-overlay" @click.self="关闭报价弹窗">
      <section class="modal quote-modal">
        <header class="modal-header">
          <div class="quote-modal-title">
            <h2 class="modal-title">
              报价详情 · {{ 文本(选中报价.编号, 字段(选中报价, "quoteNo"), "未编号") }}
            </h2>
            <span class="quote-modal-status">{{ 报价状态文本(选中报价) }}</span>
          </div>
          <button class="modal-close" type="button" @click="关闭报价弹窗">×</button>
        </header>
        <div class="modal-body quote-modal-body">
          <div class="info-grid quote-modal-summary">
            <div class="info-item">
              <span>客户</span><strong>{{ 文本(选中报价.客户名称, "未关联客户") }}</strong>
            </div>
            <div class="info-item">
              <span>关联商机</span><strong>{{ 文本(当前商机?.标题, "未关联商机") }}</strong>
            </div>
            <div class="info-item">
              <span>业务类型</span
              ><strong>{{ 业务类型名称(记录业务类型(选中报价), "报价") }}</strong>
            </div>
            <div class="info-item">
              <span>报价类型</span><strong>{{ 报价类型名称(选中报价) }}</strong>
            </div>
            <div class="info-item">
              <span>报价金额</span><strong>{{ 报价金额文本(选中报价) }}</strong>
            </div>
            <div class="info-item">
              <span>端点数量</span><strong>{{ 文本(字段(选中报价, "endpoints"), "—") }}</strong>
            </div>
            <div class="info-item">
              <span>工作量</span>
              <strong>{{ 文本(字段(选中报价, "workloadSummary"), "未计算") }}</strong>
            </div>
            <div class="info-item">
              <span>最近更新</span><strong>{{ 日期时间文本(选中报价.更新时间) }}</strong>
            </div>
          </div>

          <div class="quote-detail-head">
            <strong>报价明细</strong>
            <span>共 {{ 报价明细(选中报价).length }} 项</span>
          </div>
          <div
            v-if="文本(字段(选中报价, 'reviewRemark', 'reason', '审核意见'))"
            class="quote-reject-reason"
          >
            <span>驳回原因</span>
            <strong>{{ 文本(字段(选中报价, "reviewRemark", "reason", "审核意见")) }}</strong>
          </div>
          <div class="quote-detail-table-wrap">
            <table class="vui-table quote-detail-table">
              <thead>
                <tr>
                  <th>模块 / 产品</th>
                  <th>类型</th>
                  <th>数量</th>
                  <th v-if="!是标准报价(选中报价)">单价</th>
                  <th v-if="!是标准报价(选中报价)">小计</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(项, 序号) in 报价明细(选中报价)" :key="序号">
                  <td>{{ 文本(取数(项.名称, 项.name, 项.itemName), "未命名项") }}</td>
                  <td>{{ 报价项类型文本(项) }}</td>
                  <td>{{ 文本(取数(项.数量, 项.quantity), "—") }}</td>
                  <td v-if="!是标准报价(选中报价)">
                    {{ 金额文本(取数(项.单价, 项.unitPrice)) }}
                  </td>
                  <td v-if="!是标准报价(选中报价)">
                    {{ 金额文本(取数(项.小计, 项.lineAmount)) }}
                  </td>
                </tr>
                <tr v-if="!报价明细(选中报价).length">
                  <td :colspan="是标准报价(选中报价) ? 3 : 5" class="war-empty">
                    该报价没有明细记录。
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <QuoteProfitPanel v-if="内部管理员 && !是标准报价(选中报价)" :quote-id="选中报价.id" />
        </div>
        <footer class="modal-footer quote-modal-footer">
          <button type="button" class="button" @click="打印报价(选中报价)">打印 / 下载 PDF</button>
          <button
            v-if="可修改报价(选中报价)"
            type="button"
            class="button"
            @click="修改报价(选中报价)"
          >
            修改报价
          </button>
          <button
            v-if="可转订单(选中报价)"
            type="button"
            class="button primary"
            @click="转订单(选中报价)"
          >
            报价转订单
          </button>
        </footer>
      </section>
    </div>

    <div v-if="转移弹窗" class="modal-overlay" @click.self="转移弹窗 = false">
      <section class="modal" role="dialog" aria-modal="true" aria-label="转移商机负责人">
        <header class="modal-header">
          <h2 class="modal-title">转移商机负责人</h2>
          <button class="modal-close" type="button" @click="转移弹窗 = false">×</button>
        </header>
        <div class="modal-body">
          <p class="war-note">
            转移后新负责人立即获得该商机的数据范围，原负责人按新范围失去编辑权；系统会写审计并通知新负责人。
          </p>
          <label class="form-item">
            <span class="form-label">新负责人 *</span>
            <select v-model="转移表单.ownerUserId" class="form-control">
              <option value="">请选择内部账号</option>
              <option v-for="用户 in 转移用户列表" :key="String(用户.id)" :value="String(用户.id)">
                {{ 用户.name || 用户.displayName || 用户.username }}（{{ 用户.username }}）
              </option>
            </select>
          </label>
          <label class="form-item">
            <span class="form-label">转移原因</span>
            <input v-model="转移表单.changeReason" class="form-control" maxlength="200" />
          </label>
        </div>
        <footer class="modal-footer">
          <button type="button" class="button" @click="转移弹窗 = false">取消</button>
          <button
            type="button"
            class="button primary"
            :disabled="转移提交中"
            @click="提交转移负责人"
          >
            {{ 转移提交中 ? "转移中…" : "确认转移" }}
          </button>
        </footer>
      </section>
    </div>

    <QuoteToOrderDialog
      v-if="转单弹窗可见 && 待转报价"
      :报价="待转报价"
      @关闭="转单弹窗可见 = false"
      @成功="转单成功"
    />
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
.war-center > .panel {
  flex-shrink: 0;
}

.war-center > .panel {
  margin: 10px 16px 16px;
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

.business-advice {
  margin-top: 10px;
  padding-top: 9px;
  border-top: 1px dashed var(--line-soft);
}

.opportunity-list-item {
  display: grid;
  gap: 6px;
}

.商机状态开关 {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin: 0 0 8px;
  padding: 8px 10px;
  border: 1px solid var(--line-soft);
  border-radius: 8px;
  background: #f8fbff;
  color: var(--text-3);
  font-size: 11px;
  line-height: 1.5;
}

.商机状态开关 input {
  margin-top: 2px;
}

.追溯链接 {
  color: #2f69ed;
  text-decoration: none;
}

.追溯链接:hover,
.追溯链接:focus-visible {
  text-decoration: underline;
}

.order-trace-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
}

.followup-panel-body {
  display: grid;
  gap: 12px;
  min-height: 0;
  overflow-y: auto;
}

.followup-history-head,
.quote-detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 4px;
  color: var(--text-2);
  font-size: 11px;
}

.followup-history-head strong,
.quote-detail-head strong {
  color: var(--text);
  font-size: 12px;
}

.followup-history-head span,
.quote-detail-head span {
  color: var(--text-3);
}

.followup-history-list {
  display: grid;
  gap: 8px;
}

.followup-history-item {
  padding: 10px 12px;
  border: 1px solid var(--line-soft);
  border-radius: 10px;
  background: #ffffff;
}

.followup-history-item header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.followup-history-item header > div {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
}

.followup-history-item strong {
  color: var(--text);
  font-size: 11px;
}

.followup-history-item header span,
.followup-history-item time {
  color: var(--text-3);
  font-size: 10px;
}

.followup-history-item .followup-stage {
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--blue-soft);
  color: var(--blue-strong);
  font-size: 9px;
  font-weight: 700;
}

.followup-history-content {
  margin-top: 8px;
}

.followup-history-content > span {
  color: var(--text-3);
  font-size: 9px;
}

.followup-history-item p {
  margin: 3px 0 0;
  color: var(--text-2);
  font-size: 11px;
  line-height: 1.7;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.followup-history-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  margin-top: 7px;
  padding-top: 7px;
  border-top: 1px dashed var(--line-soft);
  color: var(--text-3);
  font-size: 10px;
}

.followup-history-attachments {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 7px;
  color: var(--text-3);
  font-size: 10px;
}

.followup-history-attachments button {
  max-width: 240px;
  padding: 3px 8px;
  overflow: hidden;
  border: 1px solid #cfe0f4;
  border-radius: 6px;
  background: #f2f8ff;
  color: #2860a8;
  font: inherit;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.quote-modal {
  width: min(1040px, calc(100vw - 40px));
}

.quote-modal-title {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.quote-modal-title .modal-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quote-modal-status {
  flex: 0 0 auto;
  padding: 3px 9px;
  border-radius: 999px;
  background: var(--blue-soft);
  color: var(--blue-strong);
  font-size: 10px;
  font-weight: 700;
}

.quote-modal-body {
  display: grid;
  gap: 14px;
  padding: 18px 20px;
}

.quote-modal-summary {
  padding: 12px 14px;
  border: 1px solid var(--line-soft);
  border-radius: 10px;
  background: linear-gradient(145deg, #f8fbff, #ffffff);
}

.quote-reject-reason {
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid #f4c7c7;
  border-radius: 9px;
  background: #fff7f7;
}

.quote-reject-reason span {
  color: var(--text-3);
  font-size: 9px;
}

.quote-reject-reason strong {
  color: #a13c3c;
  font-size: 11px;
  line-height: 1.6;
}

.quote-detail-table-wrap {
  overflow: auto;
  border: 1px solid var(--line-soft);
  border-radius: 10px;
}

.quote-detail-table {
  min-width: 720px;
}

.quote-detail-table th {
  position: sticky;
  top: 0;
  background: #f7faff;
}

.quote-modal-footer {
  flex-wrap: wrap;
}

@media (max-width: 760px) {
  .quote-modal {
    width: calc(100vw - 24px);
  }

  .quote-modal-summary {
    grid-template-columns: 1fr;
  }
}
</style>
