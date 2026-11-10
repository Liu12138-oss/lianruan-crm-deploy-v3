<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import {
  创建商机,
  更新报备资料,
  更新订单质保,
  查询阶段9全部,
  type 阶段9记录,
} from "../../api/business-client.js";
import { 读取用户列表 } from "../../api/organization-client.js";
import type { 指标项 } from "../../components/war/types.js";
import WarKpis from "../../components/war/WarKpis.vue";
import WarLayout from "../../components/war/WarLayout.vue";
import WarRecordCard from "../../components/war/WarRecordCard.vue";
import { 业务类型选项, 记录业务类型 } from "../../shared/business/business-type.js";
import {
  客户状态文本,
  文本,
  文本或,
  日期文本,
  日期时间文本,
  是本月,
  订单状态文本,
  金额文本,
} from "../../shared/format/business-format.js";
import { 联系电话错误 } from "../../shared/format/phone.js";
import { 清除富文本标签 } from "../../shared/format/plain-text.js";
import { use外壳前缀 } from "../../shared/navigation/shell-prefix.js";
import { 是内部管理员, 是超级管理员 } from "../../shared/permission/role.js";
import { 商机七阶段, 商机阶段文案, 映射商机阶段 } from "../../shared/stages/opportunity-stage.js";
import { useSessionStore } from "../../stores/session.js";
import RegistrationReviewActions from "./RegistrationReviewActions.vue";

const 路由器 = useRouter();
const 路由 = useRoute();
const 外壳前缀 = use外壳前缀();
const 会话 = useSessionStore();
// 首屏即进入加载态，避免列表尚未返回时把 KPI 先算成 0 造成闪烁。
const 加载中 = ref(true);
const 错误 = ref("");
const 是超管 = computed(() => 是超级管理员(会话.user));
const 可批量导入客户 = computed(() => 是内部管理员(会话.user));
const 转移弹窗 = ref(false);
const 转移提交中 = ref(false);
const 转移用户列表 = ref<Array<Record<string, unknown>>>([]);
const 转移表单 = reactive({ ownerUserId: "", changeReason: "客户负责人转移" });
const 客户列表 = ref<阶段9记录[]>([]);
const 商机列表 = ref<阶段9记录[]>([]);
const 订单列表 = ref<阶段9记录[]>([]);
const 订单加载失败 = ref(false);
const 选中编号 = ref("");
const 当前标签 = ref("全部");
const 搜索词 = ref("");
const 选中区域 = ref("全部区域");
const 选中排序 = ref("创建时间新→旧");
const 当前页码 = ref(1);
const 每页条数 = 20;
const 摘要记录 = ref<阶段9记录 | null>(null);
const 摘要类型 = ref<"订单" | "商机" | null>(null);
const 编辑档案可见 = ref(false);
const 档案提交中 = ref(false);
const 报备商机可见 = ref(false);
const 报备商机提交中 = ref(false);
const 报备商机客户 = ref<阶段9记录 | null>(null);
const 质保维护可见 = ref(false);
const 质保维护提交中 = ref(false);
const 质保维护订单 = ref<阶段9记录 | null>(null);

const 档案表单 = reactive({
  客户名称: "",
  统一社会信用代码: "",
  行业: "",
  联系人: "",
  职务: "",
  联系电话: "",
  邮箱: "",
  地址: "",
});

const 质保维护表单 = reactive({
  质保起始日: "",
  质保到期日: "",
  维保起始日: "",
  维保到期日: "",
});

const 报备商机表单 = reactive({
  商机名称: "",
  阶段: 商机七阶段[0]?.提交阶段 || "registered",
  业务类型: "product" as "product" | "maintenance",
  关联产品订单: [] as string[],
  端点数量: "",
  预计金额: "",
  预计签约时间: "",
  首次跟进: "",
});

const 标签列表 = ["全部", "待审核", "已驳回", "保护期内"];

const 可报备关联产品订单 = computed(() => {
  const 客户名称 = 报备商机客户.value?.客户名称 || "";
  if (!客户名称) return [];
  return 订单列表.value.filter(
    (订单) =>
      记录业务类型(订单) === "product" &&
      订单.客户名称 === 客户名称 &&
      ["confirmed", "completed"].includes(文本(订单.状态)),
  );
});

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

const 排序选项 = ["创建时间新→旧", "创建时间旧→新", "金额高→低", "金额低→高"];

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
  let 列表 = 客户列表.value;
  if (当前标签.value === "待审核") 列表 = 列表.filter((row) => row.状态 === "pending");
  if (当前标签.value === "已驳回") 列表 = 列表.filter((row) => row.状态 === "rejected");
  if (当前标签.value === "保护期内") 列表 = 列表.filter((row) => (距今天数(row) ?? -1) > 0);
  if (选中区域.value && 选中区域.value !== "全部区域")
    列表 = 列表.filter((row) => 文本(row.区域) === 选中区域.value);
  const 关键词 = 搜索词.value.trim().toLowerCase();
  if (关键词) {
    列表 = 列表.filter((row) =>
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
  }
  return 按当前方式排序(列表);
});

const 当前客户 = computed(
  () => 客户列表.value.find((row) => row.id === 选中编号.value) || 过滤后列表.value[0] || null,
);

const 总页数 = computed(() => Math.max(1, Math.ceil(过滤后列表.value.length / 每页条数)));
const 分页后列表 = computed(() => {
  const 起点 = (当前页码.value - 1) * 每页条数;
  return 过滤后列表.value.slice(起点, 起点 + 每页条数);
});

watch([当前标签, 搜索词, 选中区域, 选中排序], () => {
  当前页码.value = 1;
});

watch(总页数, (页数) => {
  if (当前页码.value > 页数) 当前页码.value = 页数;
});

watch(分页后列表, (列表) => {
  if (列表.length && !列表.some((row) => row.id === 选中编号.value)) {
    选中编号.value = 列表[0]?.id || "";
  }
});

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
  const 报备编号 = row.id;
  return 商机列表.value.filter((商机) => {
    const 商机客户 = 字段(商机, "customer", "customerName") || 商机.客户名称;
    const 商机报备编号 = 字段(商机, "regNo", "registrationNo", "regId", "registrationUuid");
    if (商机报备编号) {
      return (
        (Boolean(报备编号) && 商机报备编号 === 报备编号) || (Boolean(编号) && 商机报备编号 === 编号)
      );
    }
    return Boolean(客户名 && 商机客户 && 商机客户 === 客户名);
  });
}

/** 历史迁移订单可能没有报备标识，此时才回退到客户名称匹配，避免同名客户串单。 */
const 关联订单 = computed(() => {
  const row = 当前客户.value;
  if (!row) return [];
  const 客户名 = 字段(row, "customer", "customerName") || row.客户名称 || row.标题;
  return 订单列表.value.filter((订单) => {
    const 订单报备编号 = 字段(订单, "registrationUuid", "registrationNo", "regId", "regNo");
    if (订单报备编号) return 订单报备编号 === row.id || 订单报备编号 === row.编号;
    const 订单客户 = 字段(订单, "customer", "customerName") || 订单.客户名称;
    return Boolean(客户名 && 订单客户 && 订单客户 === 客户名);
  });
});

const 有效订单 = computed(() =>
  关联订单.value.filter((订单) => 文本(订单.状态, 字段(订单, "status")) !== "cancelled"),
);

function 订单业务类型(订单: 阶段9记录): "product" | "maintenance" {
  return 文本(字段(订单, "businessTypeCode", "business_type_code", "businessType")) ===
    "maintenance"
    ? "maintenance"
    : "product";
}

const 产品订单 = computed(() => 有效订单.value.filter((订单) => 订单业务类型(订单) === "product"));
const 维保订单 = computed(() =>
  有效订单.value.filter((订单) => 订单业务类型(订单) === "maintenance"),
);

function 日期数值(值: string): number | null {
  const 匹配 = /^(\d{4})-(\d{2})-(\d{2})/.exec(值);
  if (!匹配) return null;
  const 日期 = new Date(Number(匹配[1]), Number(匹配[2]) - 1, Number(匹配[3]));
  return Number.isNaN(日期.getTime()) ? null : 日期.getTime();
}

function 今天零点(): number {
  const 今天 = new Date();
  今天.setHours(0, 0, 0, 0);
  return 今天.getTime();
}

/** 在保/断保由产品质保和维保订单的到期日共同判断，是生命周期末阶段的派生状态。 */
const 质保状态 = computed(() => {
  if (!有效订单.value.length) return "未建立质保";
  const 到期列表 = 有效订单.value
    .map((订单) =>
      日期数值(
        订单业务类型(订单) === "maintenance"
          ? 字段(订单, "maintenanceEndDate", "维保到期日")
          : 字段(订单, "warrantyEndDate", "质保到期日"),
      ),
    )
    .filter((值): 值 is number => 值 !== null);
  if (!到期列表.length) return "未建立质保";
  return 到期列表.some((到期时间) => 到期时间 >= 今天零点()) ? "在保客户" : "断保客户";
});

const 可维护订单质保 = computed(() => 是内部管理员(会话.user));

function 订单质保信息(订单: 阶段9记录): { 等级: string; 文本: string } {
  const 是维保 = 订单业务类型(订单) === "maintenance";
  const 到期日 = 是维保
    ? 字段(订单, "maintenanceEndDate", "维保到期日")
    : 字段(订单, "warrantyEndDate", "质保到期日");
  const 周期名称 = 是维保 ? "维保" : "质保";
  const 到期时间 = 日期数值(到期日);
  if (到期时间 === null) return { 等级: "", 文本: `${周期名称}期限未设置` };
  const 剩余天数 = Math.round((到期时间 - 今天零点()) / 86400000);
  if (剩余天数 < 0)
    return { 等级: "质保已过期", 文本: `${周期名称}已过期 ${Math.abs(剩余天数)} 天` };
  if (剩余天数 <= 30) return { 等级: "质保即将到期", 文本: `${周期名称}剩余 ${剩余天数} 天` };
  return { 等级: "", 文本: `${周期名称}剩余 ${剩余天数} 天` };
}

function 金额数值(值: unknown): number {
  const 数值 = Number(值);
  return Number.isFinite(数值) ? 数值 : 0;
}

function 金额汇总文本(值: number): string {
  return `¥ ${值.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const 订单总金额 = computed(() =>
  有效订单.value.reduce((合计, 订单) => 合计 + 金额数值(订单.金额), 0),
);

const 商机总金额 = computed(() =>
  关联商机(当前客户.value).reduce((合计, 商机) => 合计 + 金额数值(商机.金额), 0),
);

const 业务概况指标 = computed(() => [
  { 标签: "订单总数", 数值: `${有效订单.value.length}`, 说明: "不含已取消订单" },
  { 标签: "订单总金额", 数值: 金额汇总文本(订单总金额.value), 说明: "非取消订单金额合计" },
  { 标签: "商机数", 数值: `${关联商机(当前客户.value).length}`, 说明: "含已成交商机" },
  { 标签: "商机金额", 数值: 金额汇总文本(商机总金额.value), 说明: "全部关联商机预计金额" },
]);

const 摘要状态文本 = computed(() => {
  const 记录 = 摘要记录.value;
  if (!记录) return "";
  return 摘要类型.value === "订单" ? 订单状态文本(记录.状态, 记录.状态名称) : 商机阶段名称(记录);
});

function 明细列表(记录: 阶段9记录 | null): Array<Record<string, unknown>> {
  const 明细 = 原始(记录).items;
  return Array.isArray(明细) ? (明细 as Array<Record<string, unknown>>) : [];
}

function 明细字段(项: Record<string, unknown>, ...键列表: string[]): string {
  return 文本(...键列表.map((键) => 项[键]));
}

const 摘要明细 = computed(() => 明细列表(摘要记录.value));

const 摘要明细合计 = computed(() =>
  摘要明细.value.reduce(
    (合计, 项) => 合计 + 金额数值(明细字段(项, "lineAmount", "小计", "金额")),
    0,
  ),
);

const 摘要伙伴层级 = computed(() => {
  const 层级 = 字段(摘要记录.value, "partnerLevel", "submittedPartnerLevel");
  const 映射: Record<string, string> = {
    primary: "一级分销",
    secondary: "二级分销",
    none: "无分销层级",
  };
  return 映射[层级] || "未设置";
});

const 摘要客户名称 = computed(() =>
  文本(摘要记录.value?.客户名称, 字段(摘要记录.value, "customer", "customerName"), "未关联客户"),
);

const 摘要合作伙伴 = computed(() =>
  文本(
    摘要记录.value?.渠道名称,
    字段(摘要记录.value, "partnerName", "assignedPartnerName"),
    "未归属合作伙伴",
  ),
);

const 摘要关联报价 = computed(() =>
  文本(字段(摘要记录.value, "quoteNo", "quoteId", "报价编号"), "—"),
);

const 摘要关联商机 = computed(() =>
  文本(字段(摘要记录.value, "opportunityNo", "oppId", "商机编号"), "—"),
);

const 摘要产品类型 = computed(() => {
  const 映射: Record<string, string> = {
    feature: "软件",
    hardware: "硬件",
    manual: "手工/服务",
    service: "服务",
  };
  const 类型列表 = [
    ...new Set(
      摘要明细.value
        .map((项) => 明细字段(项, "productRefType", "product_ref_type", "类型"))
        .filter(Boolean),
    ),
  ].map((值) => 映射[值] || 值);
  return 类型列表.length ? 类型列表.join(" + ") : "—";
});

const 摘要最新跟进 = computed(() => {
  const 记录列表 = 原始(摘要记录.value).followups;
  if (!Array.isArray(记录列表) || !记录列表.length) return "";
  const 记录 = 记录列表[0] as Record<string, unknown>;
  return 文本(记录.content, 记录.内容, 记录.followup, "暂无跟进内容");
});

/** 关联商机统一展示中文阶段名，避免把 registered / contacted 这类后端状态码直接给用户看。 */
function 商机阶段名称(商机: 阶段9记录): string {
  return 商机阶段文案(映射商机阶段(字段(商机, "stage", "stageCode"), 商机.状态, 商机.状态名称));
}

/** 审批人和审批时间由服务端在报备状态流转时写入，历史数据兼容 approved/reviewed 两套键。 */
const 报备审批人 = computed(() => {
  const 记录 = 当前客户.value;
  return 记录 ? 文本(字段(记录, "approvedBy", "reviewedByName"), "未记录") : "";
});

const 报备审批时间 = computed(() => {
  const 记录 = 当前客户.value;
  const 时间 = 记录 ? 字段(记录, "approvedAt", "reviewedAt") : "";
  return 时间 ? 日期时间文本(时间) : "未记录";
});

/** 驳回原因由审核动作写入报备扩展数据，渠道与内部管理员使用同一字段。 */
const 报备驳回原因 = computed(() => {
  const 记录 = 当前客户.value;
  if (!记录) return "";
  const 当前意见 = 文本(字段(记录, "reviewRemark", "reason", "remark"));
  if (当前意见) return 清除富文本标签(当前意见);
  return 清除富文本标签(
    报备审批历史(记录)
      .filter((项) => ["rejected", "primary_rejected"].includes(项.toStatus))
      .at(-1)?.reason || "未记录驳回原因",
  );
});

interface 报备审批历史项 {
  eventCode: string;
  fromStatus: string;
  toStatus: string;
  reason: string;
  actorName: string;
  createdAt: string;
}

/** 审批事件按时间正序展示，当前状态变化不会覆盖历史驳回意见。 */
function 报备审批历史(row: 阶段9记录 | null | undefined): 报备审批历史项[] {
  const 历史 = row?.原始数据?.approvalHistory;
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

function 报备审批事件名称(代码: string): string {
  return (
    {
      submit: "提交审核",
      resubmit: "驳回后重新提交",
      approve: "审核通过",
      reject: "审核驳回",
      cancel: "取消审批",
      region_approve: "区管初审通过",
    }[代码] || "审批更新"
  );
}

function 报备审批状态名称(代码: string): string {
  return (
    {
      pending: "待审核",
      approved: "已通过",
      rejected: "已驳回",
      cancelled: "已取消",
      converted: "已转商机",
    }[代码] || "状态更新"
  );
}

const 动态 = computed(() => {
  const 记录 = 当前客户.value;
  if (!记录) return [];
  const 时间 = 文本(记录.更新时间, 记录.创建时间);
  return ["本月新增客户报备", "客户档案已同步", "保护期状态更新"]
    .map((标题, 序号) => ({
      标题,
      时间: 序号 === 0 ? 日期文本(时间) : "",
      说明: ["客户报备进度", "客户档案信息", "当前保护期状态"][序号] || "",
    }))
    .filter((项) => 项.时间 || 项.说明);
});

const 生命周期步骤 = computed(() => [
  "客户报备",
  "审核通过",
  "保护期",
  "商机创建",
  "报价推进",
  "订单交付",
  "持续运营",
]);

const 生命周期阶段序号 = computed(() => {
  const 记录 = 当前客户.value;
  if (!记录) return 0;
  if (有效订单.value.length) return 6;
  if (记录.状态 !== "approved") return 0;
  return 关联商机(记录).length ? 3 : 2;
});

const 生命周期阶段名 = computed(() => 生命周期步骤.value[生命周期阶段序号.value] || "客户报备");

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
  const 在保客户 = 列表.filter((row) => {
    const 客户名 = 字段(row, "customer", "customerName") || row.客户名称 || row.标题;
    return 订单列表.value.some((订单) => {
      if (文本(订单.状态, 字段(订单, "status")) === "cancelled") return false;
      const 订单客户 = 字段(订单, "customer", "customerName") || 订单.客户名称;
      if (!客户名 || !订单客户 || 订单客户 !== 客户名) return false;
      const 到期 = 日期数值(
        订单业务类型(订单) === "maintenance"
          ? 字段(订单, "maintenanceEndDate", "维保到期日")
          : 字段(订单, "warrantyEndDate", "质保到期日"),
      );
      return 到期 !== null && 到期 >= 今天零点();
    });
  }).length;
  return [
    { label: "客户总数", value: String(总数), unit: "家", note: "当前数据范围内客户报备总数" },
    { label: "待审核报备", value: String(待审核), unit: "家", note: "状态为待审核的报备" },
    { label: "保护期内", value: String(保护期内), unit: "家", note: "保护期到期日晚于今天" },
    { label: "30 天内到期", value: String(即将到期), unit: "家", note: "需要提醒续报的客户" },
    { label: "本月新增", value: String(本月新增), unit: "家", note: "按报备创建时间统计" },
    { label: "在保客户", value: String(在保客户), unit: "家", note: "产品质保或维保仍在有效期内" },
  ];
});

onMounted(() => void 加载());

async function 加载() {
  加载中.value = true;
  错误.value = "";
  订单加载失败.value = false;
  try {
    const [报备结果, 商机结果, 订单结果] = await Promise.all([
      查询阶段9全部("registrations"),
      查询阶段9全部("opportunities"),
      加载订单列表(),
    ]);
    客户列表.value = 报备结果.数据;
    商机列表.value = 商机结果.数据;
    订单列表.value = 订单结果.数据;
    const 指定客户 = 文本(路由.query.selected, 路由.query.id);
    const 指定客户UUID = 文本(路由.query.customerUuid);
    const 匹配客户 = 客户列表.value.find(
      (row) =>
        (Boolean(指定客户) && row.id === 指定客户) ||
        (Boolean(指定客户UUID) && 字段(row, "customerUuid") === 指定客户UUID),
    );
    选中编号.value = 匹配客户?.id || 客户列表.value[0]?.id || "";
    const 指定位置 = 客户列表.value.findIndex((row) => row.id === 选中编号.value);
    if (指定位置 >= 0) 当前页码.value = Math.floor(指定位置 / 每页条数) + 1;
  } catch (异常) {
    错误.value = 异常 instanceof Error ? 异常.message : "客户数据加载失败。";
  } finally {
    加载中.value = false;
  }
}

function 切换页码(页码: number) {
  当前页码.value = Math.min(总页数.value, Math.max(1, 页码));
}

/** 质保保存后重新读取订单列表，确保日期、剩余天数和预警样式一次刷新。 */
async function 加载订单列表(): Promise<{ 数据: 阶段9记录[]; 总数: number }> {
  try {
    const 结果 = await 查询阶段9全部("orders");
    订单加载失败.value = false;
    return 结果;
  } catch {
    订单加载失败.value = true;
    return { 数据: [] as 阶段9记录[], 总数: 0 };
  }
}

/** 报备审核成功后原位替换列表记录：状态、保护期与 KPI 随之刷新，不打断当前选中客户。 */
function 应用审核结果(记录: 阶段9记录) {
  const 位置 = 客户列表.value.findIndex((row) => row.id === 记录.id);
  if (位置 >= 0) 客户列表.value.splice(位置, 1, 记录);
}

function 打开报备商机(row: 阶段9记录) {
  报备商机客户.value = row;
  报备商机表单.商机名称 = "";
  报备商机表单.阶段 = 商机七阶段[0]?.提交阶段 || "registered";
  报备商机表单.业务类型 = "product";
  报备商机表单.关联产品订单 = [];
  报备商机表单.端点数量 = "";
  报备商机表单.预计金额 = "";
  报备商机表单.预计签约时间 = "";
  报备商机表单.首次跟进 = "";
  报备商机可见.value = true;
}

function 关闭报备商机() {
  if (报备商机提交中.value) return;
  报备商机可见.value = false;
  报备商机客户.value = null;
}

async function 保存报备商机() {
  const 客户 = 报备商机客户.value;
  if (!客户 || 客户.状态 !== "approved") {
    ElMessage.warning("仅审核通过的客户可以报备商机。");
    return;
  }
  if (!报备商机表单.商机名称.trim()) {
    ElMessage.warning("请填写商机名称。");
    return;
  }
  const 预计金额 = Number(报备商机表单.预计金额);
  if (!Number.isFinite(预计金额) || 预计金额 <= 0) {
    ElMessage.warning("请填写有效的预计金额。");
    return;
  }
  if (!报备商机表单.阶段) {
    ElMessage.warning("请选择商机阶段。");
    return;
  }
  if (报备商机表单.业务类型 === "maintenance" && !报备商机表单.关联产品订单.length) {
    ElMessage.warning("维保商机必须关联至少一个同客户的产品订单。");
    return;
  }
  报备商机提交中.value = true;
  try {
    const 创建后 = await 创建商机({
      registrationId: 客户.id,
      name: 报备商机表单.商机名称.trim(),
      amount: 预计金额,
      stage: 报备商机表单.阶段,
      businessTypeCode: 报备商机表单.业务类型,
      linkedProductOrderIds:
        报备商机表单.业务类型 === "maintenance" ? 报备商机表单.关联产品订单 : [],
      expectedClose: 报备商机表单.预计签约时间,
      endpoints: Number(报备商机表单.端点数量) || 0,
      ...(报备商机表单.首次跟进.trim() ? { notes: 报备商机表单.首次跟进.trim() } : {}),
    });
    商机列表.value.unshift(创建后);
    报备商机可见.value = false;
    报备商机客户.value = null;
    ElMessage.success("商机已报备。");
  } catch (错误) {
    ElMessage.error(错误 instanceof Error ? 错误.message : "商机报备失败。");
  } finally {
    报备商机提交中.value = false;
  }
}

async function 打开转移负责人() {
  if (!当前客户.value) return;
  转移表单.ownerUserId = "";
  转移表单.changeReason = "客户负责人转移";
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
  const 记录 = 当前客户.value;
  if (!记录 || !转移表单.ownerUserId) {
    ElMessage.warning("请选择新的负责人。");
    return;
  }
  if (!转移表单.changeReason.trim()) {
    ElMessage.warning("请填写转移原因。");
    return;
  }
  转移提交中.value = true;
  try {
    await 更新报备资料(记录.id, {
      ownerUserId: 转移表单.ownerUserId,
      changeReason: 转移表单.changeReason.trim(),
    });
    ElMessage.success("客户负责人已转移，并已通知新负责人。");
    转移弹窗.value = false;
    await 加载();
  } catch (异常) {
    ElMessage.error(异常 instanceof Error ? 异常.message : "客户负责人转移失败。");
  } finally {
    转移提交中.value = false;
  }
}

function 打开编辑档案() {
  const row = 当前客户.value;
  if (!row) return;
  档案表单.客户名称 = 文本(row.客户名称, row.标题);
  档案表单.统一社会信用代码 = 字段(row, "creditCode", "统一社会信用代码");
  档案表单.行业 = 字段(row, "industry", "行业");
  档案表单.联系人 = 字段(row, "contact", "联系人");
  档案表单.职务 = 字段(row, "position", "职务", "contactTitle");
  档案表单.联系电话 = 字段(row, "phone", "联系电话");
  档案表单.邮箱 = 字段(row, "email", "邮箱");
  档案表单.地址 = 字段(row, "address", "注册地址");
  编辑档案可见.value = true;
}

function 关闭编辑档案() {
  if (档案提交中.value) return;
  编辑档案可见.value = false;
}

async function 保存客户档案() {
  const row = 当前客户.value;
  if (!row || 档案提交中.value) return;
  if (!档案表单.客户名称.trim()) {
    ElMessage.warning("客户名称不能为空。");
    return;
  }
  const 电话错误 = 联系电话错误(档案表单.联系电话);
  if (电话错误) {
    ElMessage.warning(电话错误);
    return;
  }
  档案提交中.value = true;
  try {
    const 更新后 = await 更新报备资料(row.id, {
      customer: 档案表单.客户名称.trim(),
      customerName: 档案表单.客户名称.trim(),
      creditCode: 档案表单.统一社会信用代码.trim(),
      industry: 档案表单.行业.trim(),
      contact: 档案表单.联系人.trim(),
      position: 档案表单.职务.trim(),
      phone: 档案表单.联系电话.trim(),
      email: 档案表单.邮箱.trim(),
      address: 档案表单.地址.trim(),
    });
    const 位置 = 客户列表.value.findIndex((项) => 项.id === 更新后.id);
    if (位置 >= 0) 客户列表.value.splice(位置, 1, 更新后);
    编辑档案可见.value = false;
    ElMessage.success("客户档案已保存。");
  } catch (错误) {
    ElMessage.error(错误 instanceof Error ? 错误.message : "客户档案保存失败。");
  } finally {
    档案提交中.value = false;
  }
}

function 打开摘要(类型: "订单" | "商机", 记录: 阶段9记录) {
  摘要类型.value = 类型;
  摘要记录.value = 记录;
}

function 关闭摘要() {
  摘要类型.value = null;
  摘要记录.value = null;
}

function 查看完整详情() {
  const 记录 = 摘要记录.value;
  if (!记录) return;
  const 类型 = 摘要类型.value;
  关闭摘要();
  if (类型 === "订单") {
    路由器.push(`${外壳前缀.value}/order?orderId=${encodeURIComponent(记录.id)}`);
    return;
  }
  路由器.push(`${外壳前缀.value}/opportunity?opportunityId=${encodeURIComponent(记录.id)}`);
}

function 打开质保维护(订单: 阶段9记录 | null) {
  if (!订单 || !可维护订单质保.value) return;
  质保维护订单.value = 订单;
  质保维护表单.质保起始日 = 字段(订单, "warrantyStartDate", "质保起始日");
  质保维护表单.质保到期日 = 字段(订单, "warrantyEndDate", "质保到期日");
  质保维护表单.维保起始日 = 字段(订单, "maintenanceStartDate", "维保起始日");
  质保维护表单.维保到期日 = 字段(订单, "maintenanceEndDate", "维保到期日");
  质保维护可见.value = true;
}

function 关闭质保维护() {
  if (质保维护提交中.value) return;
  质保维护可见.value = false;
  质保维护订单.value = null;
}

async function 保存订单质保() {
  const 订单 = 质保维护订单.value;
  if (!订单 || 质保维护提交中.value) return;
  const 字段组合 = [
    [质保维护表单.质保起始日, 质保维护表单.质保到期日, "质保起始日和质保到期日"],
    [质保维护表单.维保起始日, 质保维护表单.维保到期日, "维保起始日和维保到期日"],
  ] as const;
  const 不完整 = 字段组合.find(([起始日, 到期日]) => Boolean(起始日) !== Boolean(到期日));
  if (不完整) {
    ElMessage.warning(`${不完整[2]}必须同时填写或同时留空。`);
    return;
  }
  if (
    质保维护表单.质保起始日 &&
    质保维护表单.质保到期日 &&
    质保维护表单.质保起始日 > 质保维护表单.质保到期日
  ) {
    ElMessage.warning("质保起始日不能晚于质保到期日。");
    return;
  }
  if (
    质保维护表单.维保起始日 &&
    质保维护表单.维保到期日 &&
    质保维护表单.维保起始日 > 质保维护表单.维保到期日
  ) {
    ElMessage.warning("维保起始日不能晚于维保到期日。");
    return;
  }
  if (
    质保维护表单.质保到期日 &&
    质保维护表单.维保起始日 &&
    质保维护表单.维保起始日 <= 质保维护表单.质保到期日
  ) {
    ElMessage.warning("维保起始日必须晚于质保到期日。");
    return;
  }
  质保维护提交中.value = true;
  try {
    const 更新后 = await 更新订单质保(订单.id, {
      warrantyStartDate: 质保维护表单.质保起始日,
      warrantyEndDate: 质保维护表单.质保到期日,
      maintenanceStartDate: 质保维护表单.维保起始日,
      maintenanceEndDate: 质保维护表单.维保到期日,
    });
    const 位置 = 订单列表.value.findIndex((项) => 项.id === 更新后.id);
    if (位置 >= 0) 订单列表.value.splice(位置, 1, 更新后);
    if (摘要记录.value?.id === 更新后.id) 摘要记录.value = 更新后;
    const 最新订单 = await 加载订单列表();
    if (最新订单.数据.length) 订单列表.value = 最新订单.数据;
    摘要记录.value = 订单列表.value.find((项) => 项.id === 更新后.id) || 摘要记录.value || 更新后;
    质保维护可见.value = false;
    质保维护订单.value = null;
    ElMessage.success("订单质保与维保日期已更新。");
  } catch (错误) {
    ElMessage.error(错误 instanceof Error ? 错误.message : "订单质保保存失败。");
  } finally {
    质保维护提交中.value = false;
  }
}
</script>

<template>
  <div class="vui war-artboard 客户管理页">
    <WarKpis :items="指标" :加载中="加载中" />

    <WarLayout
      v-model="搜索词"
      list-title="客户列表"
      :list-count="String(过滤后列表.length)"
      search-placeholder="搜索客户名称、信用代码或负责人"
      :tabs="标签列表"
      :active-tab="当前标签"
      :步骤="生命周期步骤"
      :当前步骤="生命周期阶段序号"
      流程标题="客户全生命周期"
      :流程说明="`当前阶段：${生命周期阶段名}`"
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
        <RouterLink
          v-if="可批量导入客户"
          class="客户批量导入按钮"
          :to="`${外壳前缀}/registration/import`"
        >
          批量导入客户
        </RouterLink>
      </template>
      <template #list>
        <div v-if="加载中" class="war-empty">正在加载客户数据…</div>
        <div v-else-if="错误" class="war-empty">{{ 错误 }}</div>
        <WarRecordCard
          v-for="row in 分页后列表"
          :key="row.id"
          :title="文本或([row.客户名称, row.标题], '未命名客户')"
          :meta="
            [
              文本(字段(row, 'industry'), '未填写行业'),
              文本(row.区域, '未填写区域'),
              文本(row.渠道名称, '未归属渠道'),
            ].join(' · ')
          "
          :badge="
            ['pending', 'rejected'].includes(row.状态) ? 客户状态文本(row.状态, row.状态名称) : ''
          "
          :tone="
            row.状态 === 'approved'
              ? 'green'
              : row.状态 === 'pending'
                ? 'amber'
                : row.状态 === 'rejected'
                  ? 'red'
                  : 'gray'
          "
          :owner="`归属：${文本(row.渠道名称, '未归属')}／${文本(row.负责人, '未指派')}`"
          :amount="金额数值(row.金额) > 0 ? 金额文本(row.金额) : ''"
          :tags="[
            {
              text: 距今天数(row) !== null ? `保护期剩余 ${距今天数(row)} 天` : '保护期未设置',
              hot: (距今天数(row) ?? 999) <= 30,
            },
            { text: `关联商机 ${关联商机(row).length} 个` },
            ...(row.状态 === 'rejected'
              ? [
                  {
                    text: `驳回原因：${清除富文本标签(文本(字段(row, 'reviewRemark', 'reason', 'remark'), '未记录'))}`,
                    hot: true,
                  },
                ]
              : []),
          ]"
          :active="当前客户?.id === row.id"
          @选择="选中编号 = row.id"
        />
        <div v-if="!加载中 && !错误 && !过滤后列表.length" class="war-empty">
          当前筛选条件下没有客户记录。
        </div>
        <nav
          v-if="过滤后列表.length > 每页条数"
          class="war-list-pagination"
          aria-label="客户列表分页"
        >
          <button type="button" :disabled="当前页码 <= 1" @click="切换页码(当前页码 - 1)">
            上一页
          </button>
          <span>第 {{ 当前页码 }} / {{ 总页数 }} 页，共 {{ 过滤后列表.length }} 家</span>
          <button type="button" :disabled="当前页码 >= 总页数" @click="切换页码(当前页码 + 1)">
            下一页
          </button>
        </nav>
      </template>

      <template #center-head>
        <div v-if="当前客户" class="war-center-head">
          <div class="deal-title">
            <strong>{{ 文本或([当前客户.客户名称, 当前客户.标题], "未命名客户") }}</strong>
            <span>
              {{ 文本(当前客户.编号, "无编号") }} ·
              {{ 文本(字段(当前客户, "industry"), "未填写行业") }} ·
              {{ 文本(当前客户.区域, "未填写区域") }} · 归属渠道：{{
                文本(当前客户.渠道名称, "未归属")
              }}
            </span>
          </div>
          <div class="center-actions">
            <RegistrationReviewActions
              :客户="当前客户"
              @更新="应用审核结果"
              @报备商机="打开报备商机"
            />
            <button v-if="是超管" type="button" class="button" @click="打开转移负责人">
              转移负责人
            </button>
            <button type="button" class="button" @click="打开编辑档案">编辑客户档案</button>
          </div>
        </div>
      </template>

      <template #center>
        <template v-if="当前客户">
          <div class="extended-center-grid">
            <section class="panel 客户档案面板">
              <header class="panel-head">
                <div>
                  <h2>客户档案</h2>
                  <p>{{ 文本(字段(当前客户, "notes", "project"), "来自客户报备数据") }}</p>
                </div>
              </header>
              <div class="panel-body">
                <div class="info-grid">
                  <div class="info-item">
                    <span>报备编号</span><strong>{{ 文本(当前客户.编号, "—") }}</strong>
                  </div>
                  <div class="info-item">
                    <span>统一社会信用代码</span>
                    <strong>{{ 文本(字段(当前客户, "creditCode"), "未填写") }}</strong>
                  </div>
                  <div class="info-item">
                    <span>所属行业</span>
                    <strong>{{ 文本(字段(当前客户, "industry"), "未填写") }}</strong>
                  </div>
                  <div class="info-item">
                    <span>所属区域</span>
                    <strong>{{ 文本(当前客户.区域, "未填写") }}</strong>
                  </div>
                  <div class="info-item">
                    <span>归属渠道</span>
                    <strong>{{ 文本(当前客户.渠道名称, "未归属") }}</strong>
                  </div>
                  <div class="info-item">
                    <span>报备日期</span>
                    <strong>{{ 日期文本(当前客户.创建时间) }}</strong>
                  </div>
                  <div class="info-item">
                    <span>保护期到期</span>
                    <strong>{{ 日期文本(字段(当前客户, "expireAt")) }}</strong>
                  </div>
                  <div class="info-item">
                    <span>企业规模</span>
                    <strong>{{ 文本(字段(当前客户, "enterpriseScale"), "未填写") }}</strong>
                  </div>
                  <div class="info-item">
                    <span>客户来源</span>
                    <strong>{{ 文本(字段(当前客户, "source"), "未填写") }}</strong>
                  </div>
                  <div class="info-item">
                    <span>审核状态</span>
                    <strong>{{ 客户状态文本(当前客户.状态, 当前客户.状态名称) }}</strong>
                  </div>
                  <div class="info-item">
                    <span>质保状态</span>
                    <strong>{{ 质保状态 }}</strong>
                  </div>
                  <div class="info-item">
                    <span>负责人</span>
                    <strong>{{ 文本(当前客户.负责人, "未指派") }}</strong>
                  </div>
                  <div class="info-item">
                    <span>联系人</span>
                    <strong>{{ 文本(字段(当前客户, "contact"), "未填写") }}</strong>
                  </div>
                  <div class="info-item">
                    <span>联系人职务</span>
                    <strong>{{
                      文本(字段(当前客户, "position", "contactTitle"), "未填写")
                    }}</strong>
                  </div>
                  <div class="info-item">
                    <span>联系电话</span>
                    <strong>{{ 文本(字段(当前客户, "phone"), "未填写") }}</strong>
                  </div>
                  <div class="info-item">
                    <span>邮箱</span>
                    <strong>{{ 文本(字段(当前客户, "email"), "未填写") }}</strong>
                  </div>
                  <div class="info-item">
                    <span>注册地址</span>
                    <strong>{{ 文本(字段(当前客户, "address"), "未填写") }}</strong>
                  </div>
                  <div v-if="当前客户.状态 !== 'pending'" class="info-item">
                    <span>审批人</span>
                    <strong>{{ 报备审批人 }}</strong>
                  </div>
                  <div v-if="当前客户.状态 !== 'pending'" class="info-item">
                    <span>审批时间</span>
                    <strong>{{ 报备审批时间 }}</strong>
                  </div>
                  <div v-if="当前客户.状态 === 'rejected'" class="info-item 驳回原因项">
                    <span>驳回原因</span>
                    <strong>{{ 报备驳回原因 }}</strong>
                  </div>
                </div>
                <div v-if="报备审批历史(当前客户).length" class="档案审批历史">
                  <div class="档案审批历史头">
                    <strong>审批历史</strong>
                    <span
                      >共 {{ 报备审批历史(当前客户).length }} 条，包含驳回、重新提交与通过记录</span
                    >
                  </div>
                  <ol class="档案审批时间线">
                    <li
                      v-for="(事件, 序号) in 报备审批历史(当前客户)"
                      :key="`${事件.createdAt}-${序号}`"
                    >
                      <span class="档案审批时间">{{ 日期时间文本(事件.createdAt) }}</span>
                      <div>
                        <strong>{{ 报备审批事件名称(事件.eventCode) }}</strong>
                        <p>
                          {{ 报备审批状态名称(事件.fromStatus) }} →
                          {{ 报备审批状态名称(事件.toStatus) }} · {{ 事件.actorName }}
                        </p>
                        <p v-if="事件.reason" class="档案审批意见">
                          审批意见：{{ 清除富文本标签(事件.reason) }}
                        </p>
                      </div>
                    </li>
                  </ol>
                </div>
              </div>
            </section>

            <section class="panel 业务概况面板">
              <header class="panel-head">
                <div>
                  <h2>业务概况</h2>
                  <p>订单与商机均按当前客户关联关系汇总</p>
                </div>
              </header>
              <div class="panel-body">
                <div class="业务指标">
                  <div v-for="项 in 业务概况指标" :key="项.标签" class="业务指标项">
                    <span>{{ 项.标签 }}</span>
                    <strong>{{ 项.数值 }}</strong>
                    <em>{{ 项.说明 }}</em>
                  </div>
                </div>

                <p v-if="订单加载失败" class="业务加载提示">
                  订单数据暂时未能加载，不影响客户档案与其他业务查看。
                </p>

                <div class="业务明细列">
                  <section class="业务明细块">
                    <div class="业务明细头">
                      <strong>商机条目</strong>
                      <span>{{ 关联商机(当前客户).length }} 条</span>
                    </div>
                    <div class="业务滚动区">
                      <button
                        v-for="商机 in 关联商机(当前客户)"
                        :key="商机.id"
                        type="button"
                        class="业务条目"
                        @click="打开摘要('商机', 商机)"
                      >
                        <span class="业务条目正文">
                          <strong>{{ 文本或([商机.标题, 商机.客户名称], "未命名商机") }}</strong>
                          <small>
                            {{ 文本(商机.编号, "无编号") }} · {{ 商机阶段名称(商机) }}
                          </small>
                        </span>
                        <span class="业务条目金额">{{ 金额汇总文本(金额数值(商机.金额)) }}</span>
                      </button>
                      <div v-if="!关联商机(当前客户).length" class="业务空态">
                        该客户暂未创建关联商机。
                      </div>
                    </div>
                  </section>

                  <section class="业务明细块">
                    <div class="业务明细头">
                      <strong>产品订单</strong>
                      <span>{{ 产品订单.length }} 笔</span>
                    </div>
                    <div class="业务滚动区">
                      <div v-for="订单 in 产品订单" :key="订单.id" class="业务条目行">
                        <button
                          type="button"
                          class="业务条目"
                          :class="订单质保信息(订单).等级"
                          @click="打开摘要('订单', 订单)"
                        >
                          <span class="业务条目正文">
                            <strong>{{ 文本或([订单.标题, 订单.客户名称], "未命名订单") }}</strong>
                            <small>
                              {{ 文本(订单.编号, "无编号") }} ·
                              {{ 订单状态文本(订单.状态, 订单.状态名称) }}
                            </small>
                            <small class="业务条目质保">{{ 订单质保信息(订单).文本 }}</small>
                          </span>
                          <span class="业务条目金额">{{ 金额汇总文本(金额数值(订单.金额)) }}</span>
                        </button>
                        <button
                          v-if="可维护订单质保"
                          type="button"
                          class="质保维护按钮"
                          @click="打开质保维护(订单)"
                        >
                          维护质保
                        </button>
                      </div>
                      <div v-if="!产品订单.length" class="业务空态">该客户暂无产品订单。</div>
                    </div>
                  </section>

                  <section class="业务明细块">
                    <div class="业务明细头">
                      <strong>维保订单</strong>
                      <span>{{ 维保订单.length }} 笔</span>
                    </div>
                    <div class="业务滚动区">
                      <div v-for="订单 in 维保订单" :key="订单.id" class="业务条目行">
                        <button
                          type="button"
                          class="业务条目"
                          :class="订单质保信息(订单).等级"
                          @click="打开摘要('订单', 订单)"
                        >
                          <span class="业务条目正文">
                            <strong>{{ 文本或([订单.标题, 订单.客户名称], "未命名订单") }}</strong>
                            <small>
                              {{ 文本(订单.编号, "无编号") }} ·
                              {{ 订单状态文本(订单.状态, 订单.状态名称) }}
                            </small>
                            <small class="业务条目质保">{{ 订单质保信息(订单).文本 }}</small>
                          </span>
                          <span class="业务条目金额">{{ 金额汇总文本(金额数值(订单.金额)) }}</span>
                        </button>
                        <button
                          v-if="可维护订单质保"
                          type="button"
                          class="质保维护按钮"
                          @click="打开质保维护(订单)"
                        >
                          维护质保
                        </button>
                      </div>
                      <div v-if="!维保订单.length" class="业务空态">该客户暂无维保订单。</div>
                    </div>
                  </section>
                </div>
              </div>
            </section>
          </div>
        </template>
        <div v-else class="war-empty">请选择左侧客户查看档案。</div>
      </template>
    </WarLayout>

    <Teleport to="body">
      <div v-if="编辑档案可见" class="vui 业务摘要遮罩" @click.self="关闭编辑档案">
        <section
          class="档案编辑弹窗"
          role="dialog"
          aria-modal="true"
          aria-labelledby="编辑客户档案标题"
        >
          <header>
            <div>
              <h2 id="编辑客户档案标题">编辑客户档案</h2>
              <p>保存后同步更新当前客户档案与联系人信息，不会离开当前客户。</p>
            </div>
            <button
              type="button"
              aria-label="关闭编辑客户档案"
              :disabled="档案提交中"
              @click="关闭编辑档案"
            >
              ×
            </button>
          </header>
          <form class="档案编辑表单" @submit.prevent="保存客户档案">
            <fieldset :disabled="档案提交中">
              <label>
                <span>客户名称 *</span>
                <input v-model="档案表单.客户名称" maxlength="120" autocomplete="organization" />
              </label>
              <label>
                <span>统一社会信用代码</span>
                <input v-model="档案表单.统一社会信用代码" maxlength="32" />
              </label>
              <label>
                <span>所属行业</span>
                <input v-model="档案表单.行业" maxlength="80" />
              </label>
              <label>
                <span>联系人</span>
                <input v-model="档案表单.联系人" maxlength="80" autocomplete="name" />
              </label>
              <label>
                <span>联系人职务</span>
                <input v-model="档案表单.职务" maxlength="80" autocomplete="organization-title" />
              </label>
              <label>
                <span>联系电话</span>
                <input v-model="档案表单.联系电话" maxlength="32" autocomplete="tel" />
              </label>
              <label class="档案全宽">
                <span>邮箱</span>
                <input v-model="档案表单.邮箱" maxlength="120" type="email" autocomplete="email" />
              </label>
              <label class="档案全宽">
                <span>注册地址</span>
                <input v-model="档案表单.地址" maxlength="240" autocomplete="street-address" />
              </label>
            </fieldset>
            <footer>
              <button
                type="button"
                class="业务摘要次要按钮"
                :disabled="档案提交中"
                @click="关闭编辑档案"
              >
                取消
              </button>
              <button type="submit" class="业务摘要主要按钮" :disabled="档案提交中">
                {{ 档案提交中 ? "保存中…" : "保存档案" }}
              </button>
            </footer>
          </form>
        </section>
      </div>

      <div v-if="报备商机可见" class="vui 业务摘要遮罩" @click.self="关闭报备商机">
        <form
          class="报备商机弹窗"
          role="dialog"
          aria-modal="true"
          aria-labelledby="客户报备商机标题"
          @submit.prevent="保存报备商机"
        >
          <header>
            <div>
              <h2 id="客户报备商机标题">报备商机</h2>
              <p>
                {{ 文本或([报备商机客户?.客户名称, 报备商机客户?.标题], "当前客户") }} ·
                {{ 文本(报备商机客户?.编号, "无编号") }}
              </p>
            </div>
            <button
              type="button"
              aria-label="关闭报备商机"
              :disabled="报备商机提交中"
              @click="关闭报备商机"
            >
              ×
            </button>
          </header>
          <div class="报备商机内容">
            <section class="摘要信息区">
              <h3>关联客户</h3>
              <div class="info-grid 报备客户信息">
                <div class="info-item">
                  <span>客户名称</span>
                  <strong>{{
                    文本或([报备商机客户?.客户名称, 报备商机客户?.标题], "未命名客户")
                  }}</strong>
                </div>
                <div class="info-item">
                  <span>报备编号</span><strong>{{ 文本(报备商机客户?.编号, "未填写") }}</strong>
                </div>
                <div class="info-item">
                  <span>所属区域</span>
                  <strong>{{ 文本(报备商机客户?.区域, "未填写") }}</strong>
                </div>
                <div class="info-item">
                  <span>归属渠道</span>
                  <strong>{{ 文本(报备商机客户?.渠道名称, "未归属") }}</strong>
                </div>
              </div>
            </section>
            <section class="摘要信息区">
              <h3>商机信息</h3>
              <fieldset class="业务弹窗表单 报备商机表单网格" :disabled="报备商机提交中">
                <label class="业务表单全宽">
                  <span>商机名称 *</span>
                  <input
                    v-model="报备商机表单.商机名称"
                    maxlength="120"
                    placeholder="如：终端安全改造项目"
                  />
                </label>
                <label>
                  <span>当前阶段 *</span>
                  <select v-model="报备商机表单.阶段">
                    <option v-for="阶段 in 商机七阶段" :key="阶段.键" :value="阶段.提交阶段">
                      {{ 阶段.名称 }}
                    </option>
                  </select>
                </label>
                <label>
                  <span>业务类型 *</span>
                  <select v-model="报备商机表单.业务类型">
                    <option v-for="类型 in 业务类型选项" :key="类型.代码" :value="类型.代码">
                      {{ 类型.名称 }}
                    </option>
                  </select>
                </label>
                <label v-if="报备商机表单.业务类型 === 'maintenance'" class="业务表单全宽">
                  <span>关联产品订单 *</span>
                  <select v-model="报备商机表单.关联产品订单" multiple size="5">
                    <option v-for="订单 in 可报备关联产品订单" :key="订单.id" :value="订单.id">
                      {{ 文本(订单.编号, "未编号") }} · {{ 金额文本(订单.金额) }} ·
                      {{ 文本(订单.客户名称, "未关联客户") }}
                    </option>
                  </select>
                  <small class="业务表单说明">
                    仅可选择同一客户、已确认或已完成的产品订单；可多选。
                  </small>
                </label>
                <label>
                  <span>端点数量</span>
                  <input v-model="报备商机表单.端点数量" type="number" min="0" placeholder="选填" />
                </label>
                <label>
                  <span>预计金额（元）*</span>
                  <input
                    v-model="报备商机表单.预计金额"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="如 428000"
                  />
                </label>
                <label>
                  <span>预计签约时间</span>
                  <el-date-picker
                    v-model="报备商机表单.预计签约时间"
                    type="date"
                    value-format="YYYY-MM-DD"
                    placeholder="选择预计签约时间"
                    style="width: 100%"
                  />
                </label>
                <label class="业务表单全宽">
                  <span>首次跟进记录</span>
                  <textarea
                    v-model="报备商机表单.首次跟进"
                    rows="3"
                    placeholder="记录沟通情况与下一步计划"
                  ></textarea>
                </label>
              </fieldset>
            </section>
            <p class="报备商机说明">
              商机编号、归属渠道、区域与负责人由系统根据当前客户和账号自动生成。
            </p>
          </div>
          <footer>
            <button
              type="button"
              class="业务摘要次要按钮"
              :disabled="报备商机提交中"
              @click="关闭报备商机"
            >
              取消
            </button>
            <button type="submit" class="业务摘要主要按钮" :disabled="报备商机提交中">
              {{ 报备商机提交中 ? "提交中…" : "确认报备商机" }}
            </button>
          </footer>
        </form>
      </div>

      <div v-if="质保维护可见" class="vui 业务摘要遮罩 质保维护遮罩" @click.self="关闭质保维护">
        <form
          class="质保维护弹窗"
          role="dialog"
          aria-modal="true"
          aria-labelledby="维护订单质保标题"
          @submit.prevent="保存订单质保"
        >
          <header>
            <div>
              <h2 id="维护订单质保标题">维护订单质保</h2>
              <p>
                {{ 文本或([质保维护订单?.标题, 质保维护订单?.客户名称], "当前订单") }} ·
                {{ 文本(质保维护订单?.编号, "无编号") }}
              </p>
            </div>
            <button type="button" aria-label="关闭订单质保维护" @click="关闭质保维护">×</button>
          </header>
          <div class="质保维护内容">
            <p class="质保维护说明">
              系统按订单确认日期和报价收益年限自动带出日期；人工保存后将保留手工值，不再被自动计算覆盖。
            </p>
            <fieldset class="业务弹窗表单 质保维护表单网格" :disabled="质保维护提交中">
              <label>
                <span>质保起始日</span>
                <el-date-picker
                  v-model="质保维护表单.质保起始日"
                  type="date"
                  value-format="YYYY-MM-DD"
                  placeholder="选择质保起始日"
                  style="width: 100%"
                />
              </label>
              <label>
                <span>质保到期日</span>
                <el-date-picker
                  v-model="质保维护表单.质保到期日"
                  type="date"
                  value-format="YYYY-MM-DD"
                  placeholder="选择质保到期日"
                  style="width: 100%"
                />
              </label>
              <label>
                <span>维保起始日</span>
                <el-date-picker
                  v-model="质保维护表单.维保起始日"
                  type="date"
                  value-format="YYYY-MM-DD"
                  placeholder="选择维保起始日"
                  style="width: 100%"
                />
              </label>
              <label>
                <span>维保到期日</span>
                <el-date-picker
                  v-model="质保维护表单.维保到期日"
                  type="date"
                  value-format="YYYY-MM-DD"
                  placeholder="选择维保到期日"
                  style="width: 100%"
                />
              </label>
            </fieldset>
          </div>
          <footer>
            <button
              type="button"
              class="业务摘要次要按钮"
              :disabled="质保维护提交中"
              @click="关闭质保维护"
            >
              取消
            </button>
            <button type="submit" class="业务摘要主要按钮" :disabled="质保维护提交中">
              {{ 质保维护提交中 ? "保存中…" : "保存质保日期" }}
            </button>
          </footer>
        </form>
      </div>

      <div v-if="摘要记录" class="vui 业务摘要遮罩" @click.self="关闭摘要">
        <section
          class="业务摘要弹窗"
          role="dialog"
          aria-modal="true"
          aria-labelledby="业务摘要标题"
        >
          <header>
            <div>
              <h2 id="业务摘要标题">{{ 摘要类型 }}摘要</h2>
              <p>
                {{ 文本或([摘要记录.标题, 摘要记录.客户名称], "未命名记录") }} ·
                {{ 文本(摘要记录.编号, "无编号") }}
              </p>
            </div>
            <button type="button" aria-label="关闭摘要" @click="关闭摘要">×</button>
          </header>
          <div class="业务摘要内容">
            <section class="摘要信息区">
              <h3>{{ 摘要类型 }}信息</h3>
              <div class="info-grid 摘要信息网格">
                <div v-if="摘要类型 === '订单'" class="info-item">
                  <span>订单编号</span><strong>{{ 文本(摘要记录.编号, "—") }}</strong>
                </div>
                <div v-if="摘要类型 === '订单'" class="info-item">
                  <span>订单状态</span><strong>{{ 摘要状态文本 }}</strong>
                </div>
                <div v-if="摘要类型 === '订单'" class="info-item">
                  <span>订单金额</span><strong>{{ 金额汇总文本(金额数值(摘要记录.金额)) }}</strong>
                </div>
                <div v-if="摘要类型 === '订单'" class="info-item">
                  <span>订单产品类型</span><strong>{{ 摘要产品类型 }}</strong>
                </div>

                <div v-if="摘要类型 === '商机'" class="info-item">
                  <span>商机名称</span>
                  <strong>{{ 文本(摘要记录.标题, 摘要记录.客户名称, "—") }}</strong>
                </div>
                <div v-if="摘要类型 === '商机'" class="info-item">
                  <span>商机编号</span><strong>{{ 文本(摘要记录.编号, "—") }}</strong>
                </div>
                <div v-if="摘要类型 === '商机'" class="info-item">
                  <span>商机阶段</span><strong>{{ 摘要状态文本 }}</strong>
                </div>
                <div v-if="摘要类型 === '商机'" class="info-item">
                  <span>预计金额</span><strong>{{ 金额汇总文本(金额数值(摘要记录.金额)) }}</strong>
                </div>

                <div class="info-item">
                  <span>客户</span><strong>{{ 摘要客户名称 }}</strong>
                </div>
                <div class="info-item">
                  <span>所属区域</span><strong>{{ 文本(摘要记录.区域, "未填写") }}</strong>
                </div>
                <div v-if="摘要类型 === '商机'" class="info-item">
                  <span>预计签约日期</span>
                  <strong>{{ 日期文本(字段(摘要记录, "expectedClose", "预计签约日期")) }}</strong>
                </div>
                <div class="info-item">
                  <span>创建时间</span><strong>{{ 日期文本(摘要记录.创建时间) }}</strong>
                </div>
                <div class="info-item">
                  <span>最近更新</span><strong>{{ 日期文本(摘要记录.更新时间) }}</strong>
                </div>
              </div>
            </section>

            <section v-if="摘要类型 === '订单'" class="摘要信息区 订单质保区">
              <div class="摘要明细头">
                <h3>订单质保与维保</h3>
                <button
                  v-if="可维护订单质保"
                  type="button"
                  class="业务摘要次要按钮"
                  @click="打开质保维护(摘要记录)"
                >
                  维护质保日期
                </button>
              </div>
              <div class="info-grid 摘要信息网格">
                <div class="info-item">
                  <span>质保起始日</span>
                  <strong>{{ 日期文本(字段(摘要记录, "warrantyStartDate", "质保起始日")) }}</strong>
                </div>
                <div class="info-item">
                  <span>质保到期日</span>
                  <strong>{{ 日期文本(字段(摘要记录, "warrantyEndDate", "质保到期日")) }}</strong>
                </div>
                <div class="info-item">
                  <span>维护状态</span>
                  <strong>{{
                    字段(摘要记录, "warrantyManualOverride") === "true" ? "人工维护" : "系统自动"
                  }}</strong>
                </div>
                <div class="info-item">
                  <span>维保起始日</span>
                  <strong>{{
                    日期文本(字段(摘要记录, "maintenanceStartDate", "维保起始日"))
                  }}</strong>
                </div>
                <div class="info-item">
                  <span>维保到期日</span>
                  <strong>{{
                    日期文本(字段(摘要记录, "maintenanceEndDate", "维保到期日"))
                  }}</strong>
                </div>
                <div class="info-item">
                  <span>维护人</span>
                  <strong>{{ 文本(字段(摘要记录, "warrantyUpdatedByName"), "系统自动") }}</strong>
                </div>
              </div>
            </section>

            <section class="摘要信息区">
              <h3>合作伙伴与业务关联</h3>
              <div class="info-grid 摘要信息网格">
                <div class="info-item">
                  <span>合作伙伴</span><strong>{{ 摘要合作伙伴 }}</strong>
                </div>
                <div v-if="摘要类型 === '订单'" class="info-item">
                  <span>渠道层级</span><strong>{{ 摘要伙伴层级 }}</strong>
                </div>
                <div v-if="摘要类型 === '订单'" class="info-item">
                  <span>上级一级渠道</span>
                  <strong>{{ 文本(字段(摘要记录, "parentPartnerName"), "—") }}</strong>
                </div>
                <div v-if="摘要类型 === '订单'" class="info-item">
                  <span>签单人员</span>
                  <strong>{{
                    文本(字段(摘要记录, "assignedStaffName"), 摘要记录.负责人, "—")
                  }}</strong>
                </div>
                <div v-if="摘要类型 === '商机'" class="info-item">
                  <span>负责人</span>
                  <strong>{{
                    文本(摘要记录.负责人, 字段(摘要记录, "assignedStaffName"), "—")
                  }}</strong>
                </div>
                <div class="info-item">
                  <span>关联报价单</span><strong>{{ 摘要关联报价 }}</strong>
                </div>
                <div v-if="摘要类型 === '订单'" class="info-item">
                  <span>关联商机</span><strong>{{ 摘要关联商机 }}</strong>
                </div>
                <div v-if="摘要类型 === '订单'" class="info-item 摘要全宽">
                  <span>收货地址</span>
                  <strong>{{ 文本(字段(摘要记录, "deliveryAddr", "address"), "未填写") }}</strong>
                </div>
              </div>
            </section>

            <section v-if="摘要类型 === '订单'" class="摘要明细区">
              <div class="摘要明细头">
                <h3>订单明细</h3>
                <span>共 {{ 摘要明细.length }} 项，合计 {{ 金额汇总文本(摘要明细合计) }}</span>
              </div>
              <div class="摘要明细表容器">
                <table class="vui-table 摘要明细表">
                  <thead>
                    <tr>
                      <th>模块 / 产品</th>
                      <th>数量</th>
                      <th>单价</th>
                      <th>小计</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(项, 序号) in 摘要明细" :key="序号">
                      <td>{{ 文本(明细字段(项, "itemName", "名称", "name"), "未命名项") }}</td>
                      <td>{{ 文本(明细字段(项, "quantity", "数量"), "—") }}</td>
                      <td>{{ 金额汇总文本(金额数值(明细字段(项, "unitPrice", "单价"))) }}</td>
                      <td>
                        {{ 金额汇总文本(金额数值(明细字段(项, "lineAmount", "小计", "金额"))) }}
                      </td>
                    </tr>
                    <tr v-if="!摘要明细.length">
                      <td colspan="4" class="摘要空态">该订单没有明细记录。</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-if="摘要明细.length" class="摘要明细合计">
                <span>明细合计（总价）</span><strong>{{ 金额汇总文本(摘要明细合计) }}</strong>
              </div>
            </section>

            <section v-if="摘要类型 === '商机'" class="摘要信息区">
              <h3>最近跟进</h3>
              <p class="摘要跟进内容">{{ 摘要最新跟进 || "暂无跟进记录。" }}</p>
            </section>
          </div>
          <footer>
            <button type="button" class="业务摘要次要按钮" @click="关闭摘要">关闭</button>
            <button type="button" class="业务摘要主要按钮" @click="查看完整详情">
              查看完整详情
            </button>
          </footer>
        </section>
      </div>
      <div v-if="转移弹窗" class="vui 业务摘要遮罩" @click.self="转移弹窗 = false">
        <section class="档案编辑弹窗" role="dialog" aria-modal="true" aria-label="转移客户负责人">
          <header>
            <div>
              <h2>转移客户负责人</h2>
              <p>转移后新负责人立即获得该客户的数据范围，原负责人按新范围失去编辑权。</p>
            </div>
            <button type="button" aria-label="关闭转移负责人" @click="转移弹窗 = false">×</button>
          </header>
          <form class="档案编辑表单" @submit.prevent="提交转移负责人">
            <fieldset :disabled="转移提交中">
              <label class="档案全宽">
                <span>新负责人 *</span>
                <select v-model="转移表单.ownerUserId" class="form-control">
                  <option value="">请选择内部账号</option>
                  <option
                    v-for="用户 in 转移用户列表"
                    :key="String(用户.id)"
                    :value="String(用户.id)"
                  >
                    {{ 用户.name || 用户.displayName || 用户.username }}（{{ 用户.username }}）
                  </option>
                </select>
              </label>
              <label class="档案全宽">
                <span>转移原因 *</span>
                <input v-model="转移表单.changeReason" maxlength="200" />
              </label>
            </fieldset>
            <footer>
              <button type="button" class="业务摘要次要按钮" @click="转移弹窗 = false">取消</button>
              <button type="submit" class="业务摘要主要按钮" :disabled="转移提交中">
                {{ 转移提交中 ? "转移中…" : "确认转移" }}
              </button>
            </footer>
          </form>
        </section>
      </div>
    </Teleport>
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

.客户批量导入按钮 {
  display: block;
  margin-top: 8px;
  padding: 7px 10px;
  border: 1px solid #cbdcf0;
  border-radius: 8px;
  background: #f5faff;
  color: #2d619b;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  text-align: center;
  text-decoration: none;
}

.客户批量导入按钮:hover,
.客户批量导入按钮:focus-visible {
  border-color: #8db7ee;
  background: #eaf4ff;
  outline: none;
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

.业务概况面板 {
  grid-column: 1 / -1;
}

.客户档案面板 {
  grid-column: 1 / -1;
}

.业务指标 {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 9px;
}

.业务指标项 {
  display: grid;
  min-width: 0;
  gap: 3px;
  padding: 10px 12px;
  border: 1px solid var(--line-soft);
  border-radius: 9px;
  background: #f8fbff;
}

.业务指标项 span {
  color: var(--text-3);
  font-size: 11px;
}

.业务指标项 strong {
  overflow: hidden;
  color: var(--text);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.业务指标项 em {
  overflow: hidden;
  color: var(--text-3);
  font-size: 11px;
  font-style: normal;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.业务加载提示 {
  margin: 9px 0 0;
  padding: 8px 10px;
  border: 1px solid #f0dfb3;
  border-radius: 8px;
  background: #fffaf0;
  color: #8a6414;
  font-size: 11px;
}

.业务明细列 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 10px;
}

.业务明细块 {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--line-soft);
  border-radius: 9px;
  background: #ffffff;
}

.业务明细头 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--line-soft);
  background: #fbfdff;
}

.业务明细头 span {
  color: var(--text-3);
  font-size: 11px;
}

.业务滚动区 {
  display: grid;
  align-content: start;
  gap: 7px;
  height: 150px;
  padding: 8px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.业务条目 {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 9px;
  border: 1px solid var(--line-soft);
  border-radius: 8px;
  background: #ffffff;
  color: var(--text);
  text-align: left;
  cursor: pointer;
}

.业务条目行 {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: stretch;
  gap: 6px;
}

.质保维护按钮 {
  align-self: stretch;
  padding: 0 8px;
  border: 1px solid #c9dbf3;
  border-radius: 8px;
  background: #f4f9ff;
  color: #2f69ed;
  font: inherit;
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}

.质保维护按钮:hover,
.质保维护按钮:focus-visible {
  border-color: #8db7ee;
  background: #e8f2ff;
  outline: none;
}

.业务条目:hover,
.业务条目:focus-visible {
  border-color: #bfd4f5;
  background: #f7fbff;
  outline: none;
}

.业务条目正文 {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.业务条目正文 strong,
.业务条目正文 small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.业务条目正文 small {
  color: var(--text-3);
  font-size: 11px;
}

.业务条目质保 {
  color: var(--text-2) !important;
}

.业务条目.质保即将到期 {
  border-color: #ecd58b;
  background: #fff9e8;
}

.业务条目.质保已过期 {
  border-color: #efb7b7;
  background: #fff3f3;
}

.业务条目.质保即将到期:hover,
.业务条目.质保即将到期:focus-visible {
  border-color: #d9b64d;
  background: #fff4d6;
}

.业务条目.质保已过期:hover,
.业务条目.质保已过期:focus-visible {
  border-color: #dc8a8a;
  background: #ffe7e7;
}

.业务条目金额 {
  color: var(--text-2);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.业务空态 {
  display: grid;
  place-items: center;
  min-height: 100%;
  padding: 16px;
  color: var(--text-3);
  font-size: 11px;
  text-align: center;
}

.业务摘要遮罩 {
  position: fixed;
  inset: 0;
  z-index: 1300;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(18, 33, 55, 0.42);
  backdrop-filter: blur(4px);
}

.业务摘要遮罩.质保维护遮罩 {
  z-index: 1310;
}

.业务摘要弹窗,
.档案编辑弹窗,
.跟进弹窗,
.报备商机弹窗,
.质保维护弹窗 {
  overflow: hidden;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 24px 70px rgba(15, 32, 60, 0.24);
}

.业务摘要弹窗 {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: min(980px, 96vw);
  max-height: 88vh;
}

.档案编辑弹窗 {
  display: flex;
  flex-direction: column;
  width: min(760px, 96vw);
  max-height: 90vh;
}

.跟进弹窗 {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: min(1040px, 96vw);
  max-height: 90vh;
}

.报备商机弹窗 {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: min(760px, 96vw);
  max-height: 90vh;
}

.质保维护弹窗 {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: min(680px, 96vw);
  max-height: 90vh;
}

.业务摘要弹窗 header,
.档案编辑弹窗 header,
.跟进弹窗 header,
.报备商机弹窗 header,
.质保维护弹窗 header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px;
  border-bottom: 1px solid #e7eef6;
}

.业务摘要弹窗 h2,
.档案编辑弹窗 h2,
.跟进弹窗 h2,
.报备商机弹窗 h2,
.质保维护弹窗 h2 {
  margin: 0;
  color: #172b4d;
  font-size: 16px;
}

.业务摘要弹窗 header p,
.档案编辑弹窗 header p,
.跟进弹窗 header p,
.报备商机弹窗 header p,
.质保维护弹窗 header p {
  margin: 5px 0 0;
  color: #75869a;
  font-size: 11px;
}

.业务摘要弹窗 header button,
.档案编辑弹窗 header button,
.跟进弹窗 header button,
.报备商机弹窗 header button,
.质保维护弹窗 header button {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: #f2f5f9;
  color: #75869a;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

.业务摘要弹窗 header button:disabled,
.档案编辑弹窗 header button:disabled,
.跟进弹窗 header button:disabled,
.报备商机弹窗 header button:disabled,
.质保维护弹窗 header button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.业务摘要内容 {
  display: grid;
  align-content: start;
  gap: 16px;
  min-height: 0;
  padding: 20px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.摘要信息区,
.摘要明细区 {
  min-width: 0;
  overflow: hidden;
  border: 1px solid #e3ebf4;
  border-radius: 10px;
  background: #ffffff;
}

.摘要信息区 > h3,
.摘要明细头 {
  padding: 10px 12px;
  margin: 0;
  border-bottom: 1px solid #e8eef6;
  background: #f8fbff;
  color: #2f445b;
  font-size: 13px;
  font-weight: 700;
}

.摘要信息网格 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px 18px;
  padding: 14px;
}

.摘要信息网格 .info-item {
  min-width: 0;
}

.摘要信息网格 .info-item strong {
  overflow-wrap: anywhere;
}

.摘要全宽 {
  grid-column: 1 / -1;
}

.摘要明细头 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.摘要明细头 span {
  color: #75869a;
  font-size: 11px;
  font-weight: 400;
}

.摘要明细表容器 {
  overflow-x: auto;
}

.摘要明细表 {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.摘要明细表 th,
.摘要明细表 td {
  padding: 9px 12px;
  border-bottom: 1px solid #eef3f8;
  color: #34495f;
  text-align: left;
  white-space: nowrap;
}

.摘要明细表 th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #fbfdff;
  color: #60748c;
  font-weight: 700;
}

.摘要明细表 th:not(:first-child),
.摘要明细表 td:not(:first-child) {
  text-align: right;
}

.摘要明细合计 {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 18px;
  padding: 11px 14px;
  border-top: 1px solid #e8eef6;
  background: #f8fbff;
  color: #425970;
  font-size: 11px;
}

.摘要明细合计 strong {
  color: #172b4d;
  font-size: 13px;
}

.摘要空态 {
  padding: 28px 16px !important;
  color: #8090a3 !important;
  text-align: center !important;
}

.摘要跟进内容 {
  padding: 14px;
  margin: 0;
  color: #425970;
  font-size: 11px;
  line-height: 1.7;
  white-space: pre-wrap;
}

.跟进弹窗内容 {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  align-items: start;
  gap: 16px;
  min-height: 0;
  padding: 20px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.跟进客户摘要 {
  overflow: hidden;
  border: 1px solid #e3ebf4;
  border-radius: 10px;
  background: #ffffff;
}

.跟进客户标识 {
  display: grid;
  gap: 4px;
  padding: 14px;
  border-bottom: 1px solid #e8eef6;
  background: #f8fbff;
}

.跟进客户标识 strong {
  color: #172b4d;
  font-size: 11px;
}

.跟进客户标识 span {
  color: #75869a;
  font-size: 11px;
}

.跟进客户摘要 dl {
  display: grid;
  gap: 0;
  padding: 4px 14px;
  margin: 0;
}

.跟进客户摘要 dl > div {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  gap: 10px;
  padding: 9px 0;
  border-bottom: 1px solid #eef3f8;
}

.跟进客户摘要 dt {
  color: #75869a;
  font-size: 11px;
  font-weight: 700;
}

.跟进客户摘要 dd {
  margin: 0;
  color: #34495f;
  font-size: 11px;
  text-align: right;
  overflow-wrap: anywhere;
}

.跟进商机选择 {
  display: grid;
  gap: 7px;
  padding: 14px;
  color: #41556d;
  font-size: 11px;
  font-weight: 700;
}

.跟进商机选择 select {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: 36px;
  padding: 8px 10px;
  border: 1px solid #d5e1ee;
  border-radius: 8px;
  color: #2f445b;
  background: #ffffff;
  font: inherit;
  font-size: 11px;
  font-weight: 400;
}

.跟进空态 {
  margin: 0;
  padding: 0 14px 14px;
  color: #8a6414;
  font-size: 11px;
  line-height: 1.6;
}

.跟进主体区 {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.业务弹窗表单 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 16px;
  padding: 14px;
  margin: 0;
  border: 0;
  min-width: 0;
}

.业务弹窗表单 label {
  display: grid;
  gap: 7px;
  min-width: 0;
  color: #41556d;
  font-size: 11px;
  font-weight: 700;
}

.业务弹窗表单 input,
.业务弹窗表单 select,
.业务弹窗表单 textarea {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: 36px;
  padding: 8px 10px;
  border: 1px solid #d5e1ee;
  border-radius: 8px;
  color: #2f445b;
  background: #ffffff;
  font: inherit;
  font-size: 11px;
  font-weight: 400;
  outline: none;
}

.业务弹窗表单 textarea {
  resize: vertical;
  line-height: 1.6;
}

.业务弹窗表单 input:focus,
.业务弹窗表单 select:focus,
.业务弹窗表单 textarea:focus {
  border-color: #2f69ed;
  box-shadow: 0 0 0 3px rgba(47, 105, 237, 0.1);
}

.业务表单全宽 {
  grid-column: 1 / -1;
}

.跟进历史标题 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid #e8eef6;
  background: #f8fbff;
}

.跟进历史标题 h3 {
  padding: 0;
  margin: 0;
  border: 0;
  background: transparent;
  color: #2f445b;
  font-size: 13px;
  font-weight: 700;
}

.跟进历史标题 span {
  color: #75869a;
  font-size: 11px;
}

.跟进时间线 {
  display: grid;
  max-height: 210px;
  padding: 12px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.跟进时间线 article {
  display: grid;
  gap: 5px;
  padding: 10px 0;
  border-bottom: 1px solid #eef3f8;
}

.跟进时间线 article:last-child {
  border-bottom: 0;
}

.跟进时间线头 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.跟进时间线头 strong {
  color: #2f445b;
  font-size: 11px;
}

.跟进时间线头 span,
.跟进时间线 small {
  color: #75869a;
  font-size: 11px;
}

.跟进时间线 p {
  margin: 0;
  color: #34495f;
  font-size: 11px;
  line-height: 1.65;
  white-space: pre-wrap;
}

.跟进历史空态 {
  padding: 24px 14px;
  color: #8090a3;
  font-size: 11px;
  text-align: center;
}

.报备商机内容 {
  display: grid;
  align-content: start;
  gap: 14px;
  min-height: 0;
  padding: 20px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.质保维护内容 {
  display: grid;
  align-content: start;
  gap: 14px;
  min-height: 0;
  padding: 20px;
  overflow-y: auto;
}

.质保维护说明 {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid #cfe1ff;
  border-radius: 8px;
  color: #33506f;
  background: #f2f8ff;
  font-size: 11px;
  line-height: 1.6;
}

.质保维护表单网格 {
  padding: 0;
}

.报备客户信息 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding: 14px;
}

.报备商机说明 {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid #cfe1ff;
  border-radius: 8px;
  color: #33506f;
  background: #f2f8ff;
  font-size: 11px;
  line-height: 1.6;
}

.档案编辑表单 {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.档案编辑表单 fieldset {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 16px;
  padding: 20px;
  margin: 0;
  border: 0;
  overflow-y: auto;
}

.档案编辑表单 label {
  display: grid;
  gap: 7px;
  min-width: 0;
  color: #41556d;
  font-size: 11px;
  font-weight: 700;
}

.档案编辑表单 input {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: 36px;
  padding: 8px 10px;
  border: 1px solid #d5e1ee;
  border-radius: 8px;
  color: #2f445b;
  background: #ffffff;
  font: inherit;
  font-size: 11px;
  font-weight: 400;
  outline: none;
}

.档案编辑表单 input:focus {
  border-color: #2f69ed;
  box-shadow: 0 0 0 3px rgba(47, 105, 237, 0.1);
}

.档案全宽 {
  grid-column: 1 / -1;
}

.档案编辑表单 footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid #e7eef6;
}

.业务摘要弹窗 footer,
.跟进弹窗 footer,
.报备商机弹窗 footer,
.质保维护弹窗 footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid #e7eef6;
}

.业务摘要次要按钮,
.业务摘要主要按钮 {
  min-height: 32px;
  padding: 0 14px;
  border: 1px solid transparent;
  border-radius: 8px;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.业务摘要次要按钮:disabled,
.业务摘要主要按钮:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.业务摘要次要按钮 {
  border-color: #d5e1ee;
  background: #ffffff;
  color: #425970;
}

.业务摘要主要按钮 {
  background: #2367d1;
  color: #ffffff;
}

@media (max-width: 1180px) {
  .业务指标 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .业务明细列 {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 900px) {
  .摘要信息网格 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .跟进弹窗内容 {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 640px) {
  .业务摘要遮罩 {
    padding: 12px;
  }

  .摘要信息网格,
  .档案编辑表单 fieldset,
  .业务弹窗表单,
  .报备客户信息 {
    grid-template-columns: minmax(0, 1fr);
  }

  .摘要全宽,
  .档案全宽,
  .业务表单全宽 {
    grid-column: auto;
  }

  .摘要明细头 {
    align-items: flex-start;
    flex-direction: column;
  }
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

.驳回原因项 {
  grid-column: 1 / -1;
}

.驳回原因项 strong {
  color: #c33b3b;
}

.档案审批历史 {
  margin-top: 14px;
  padding: 12px 14px;
  border: 1px solid var(--line-soft);
  border-radius: 10px;
  background: #f8fbff;
}

.档案审批历史头 {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.档案审批历史头 span {
  color: var(--text-3);
  font-size: 11px;
}

.档案审批时间线 {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.档案审批时间线 li {
  display: grid;
  grid-template-columns: 138px minmax(0, 1fr);
  gap: 10px;
  padding-top: 8px;
  border-top: 1px dashed var(--line-soft);
}

.档案审批时间线 li:first-child {
  padding-top: 0;
  border-top: 0;
}

.档案审批时间 {
  color: var(--text-3);
  font-size: 11px;
}

.档案审批时间线 strong {
  color: var(--text);
}

.档案审批时间线 p {
  margin: 3px 0 0;
  color: var(--text-3);
  font-size: 11px;
}

.档案审批意见 {
  color: #b45309 !important;
}
</style>
