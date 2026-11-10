<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";

import { 处理业务会话失效 } from "../../api/auth-client.js";
import {
  查询阶段9全部,
  查询阶段9列表,
  type 渠道经营摘要,
  type 阶段9记录,
} from "../../api/business-client.js";
import type { 指标项 } from "../../components/war/types.js";
import WarKpis from "../../components/war/WarKpis.vue";
import WarLayout from "../../components/war/WarLayout.vue";
import WarRecordCard from "../../components/war/WarRecordCard.vue";
import { 文本, 文本或, 日期文本, 渠道等级文本 } from "../../shared/format/business-format.js";
import { 联系电话错误 } from "../../shared/format/phone.js";
import { 清理有效上级编号, 渠道可作一级上级, 读取渠道分销层级 } from "./channel-level.js";
import {
  保存渠道核心档案,
  创建渠道商,
  查询标准城市选项,
  查询渠道核心档案,
} from "./channel-profile-client.js";
import { 匹配城市, type 城市检索项, 构建城市检索项 } from "./city-search.js";

const 路由器 = useRouter();
const 加载中 = ref(false);
const 错误 = ref("");
const 渠道列表 = ref<阶段9记录[]>([]);
const 选中编号 = ref("");
const 当前标签 = ref("全部");
const 搜索词 = ref("");
const 选中区域 = ref("全部区域");
const 选中层级 = ref("全部层级");
const 当前页码 = ref(1);
const 每页条数 = 20;
const 档案数据 = ref<Record<string, unknown>>({});
const 摘要数据 = ref<渠道经营摘要 | null>(null);
const 摘要加载中 = ref(false);
const 新建弹窗打开 = ref(false);
const 新建保存中 = ref(false);
const 新建错误 = ref("");

const 新建表单 = reactive({
  name: "",
  region: "",
  city: "",
  agreementNo: "",
  contact: "",
  phone: "",
  email: "",
  cooperationLevel: "none",
  distributionLevel: "none",
  parentPartnerIds: [] as string[],
  address: "",
  businessScope: "",
  cooperationBackground: "",
  agencyBrandsText: "",
  typicalCustomersText: "",
  customerIndustriesText: "",
  annualRevenue: "",
  employeeCount: "",
  socialInsuranceCount: "",
  invoiceCapability: "",
  serviceAreasText: "",
  authorizedProductsText: "",
  qualificationsText: "",
});

const 城市选项 = ref<城市检索项[]>([]);
const 城市选项加载失败 = ref(false);
const 当前城市是否标准 = computed(() =>
  城市选项.value.some((选项) => 选项.名称 === 新建表单.city.trim()),
);

/** 合作环节自动更新数据源：成员证书、客户报备、成交订单。 */
const 环节加载数据 = ref<{
  证书列表: Array<Record<string, unknown>>;
  报备总数: number;
  订单列表: 阶段9记录[];
}>({ 证书列表: [], 报备总数: 0, 订单列表: [] });
const 环节保存中 = ref("");

/**
 * 合作环节（不区分阶段）：前三个环节手动确认，后三个按业务数据自动更新，
 * 全部完成即视为进入「持续运营阶段」。手动结果落在渠道核心档案
 * extra_json.cooperationSteps，自动环节可手动覆盖并随时恢复自动。
 */
const 环节定义: Array<{ 代码: string; 名称: string; 自动: boolean; 说明: string }> = [
  { 代码: "firstVisit", 名称: "初次拜访", 自动: false, 说明: "是否已完成初次拜访" },
  { 代码: "training", 名称: "统一培训", 自动: false, 说明: "是否已完成统一培训" },
  {
    代码: "customerOpen",
    名称: "客户开放（协同拜访）",
    自动: false,
    说明: "是否已完成客户开放与协同拜访",
  },
  { 代码: "certification", 名称: "技术认证情况", 自动: true, 说明: "按渠道成员有效证书自动更新" },
  { 代码: "registration", 名称: "商机报备情况", 自动: true, 说明: "按渠道客户报备记录自动更新" },
  { 代码: "firstOrder", 名称: "首单合作成功", 自动: true, 说明: "按渠道成交订单自动更新" },
];

/** 成交口径：已确认、一级确认、已完成都视为合作产出，不含退回、取消和待审批。 */
const 成交状态集 = ["completed", "confirmed", "primary_confirmed"];

const 标签列表 = ["全部", "核心渠道", "待续签"];

function 原始(row: 阶段9记录 | null | undefined): Record<string, unknown> {
  return (row?.原始数据 as Record<string, unknown>) || {};
}

function 字段(row: 阶段9记录 | null | undefined, ...键列表: string[]): string {
  const 数据 = 原始(row);
  return 文本(...键列表.map((键) => 数据[键]), ...键列表.map((键) => (row as never)?.[键]));
}

/** 渠道业务编号与数据库 UUID 都兼容，列表动作、上下级关系统一优先使用业务编号。 */
function 渠道外部编号(row: 阶段9记录 | null | undefined): string {
  return 文本(字段(row, "id"), row?.编号, row?.id);
}

/**
 * 扩展档案字段读取：优先取渠道核心档案（含合作背景、协议编号等简介字段），
 * 取不到时回退到阶段9列表自带的原始数据，保证列表与档案展示一致。
 */
function 档案字段(row: 阶段9记录 | null | undefined, ...键列表: string[]): string {
  const 档案 = 档案数据.value || {};
  const 回退 = 原始(row);
  return 文本(
    ...键列表.map((键) => 档案[键]),
    ...键列表.map((键) => 回退[键]),
    ...键列表.map((键) => (row as never)?.[键]),
  );
}

/** 列表型扩展字段（资质证书、授权产品等）统一转成可读文本。 */
function 档案列表文本(row: 阶段9记录 | null | undefined, ...键列表: string[]): string {
  const 档案 = 档案数据.value || {};
  const 回退 = 原始(row);
  for (const 键 of 键列表) {
    const 值 = 档案[键] ?? 回退[键];
    if (Array.isArray(值)) {
      const 文本列表 = 值
        .map((项) =>
          项 && typeof 项 === "object"
            ? 文本((项 as Record<string, unknown>).name, (项 as Record<string, unknown>).title)
            : 文本(项),
        )
        .filter(Boolean);
      if (文本列表.length) return 文本列表.join("、");
    } else if (值 !== undefined && 值 !== null && String(值).trim()) {
      return String(值).trim();
    }
  }
  return "";
}

/** 带「未维护」占位的展示值，空值不显示为空白。 */
function 或未维护(值: string): string {
  return 值 && 值.trim() ? 值 : "未维护";
}

function 文本数组(值: unknown): string[] {
  if (!Array.isArray(值)) return [];
  return Array.from(
    new Set(
      值
        .map((项) =>
          项 && typeof 项 === "object"
            ? 文本((项 as Record<string, unknown>).name, (项 as Record<string, unknown>).title)
            : 文本(项),
        )
        .filter(Boolean),
    ),
  );
}

function 上级渠道名称(row: 阶段9记录 | null | undefined): string {
  return 文本数组(原始(row).parentPartnerNames).join("、");
}

function 下级渠道名称(row: 阶段9记录 | null | undefined): string {
  return 文本数组(原始(row).childPartnerNames).join("、");
}

/** 渠道卡片优先展示直接归属关系，二级显示所属一级，一级显示直属二级数量。 */
function 渠道关系摘要(row: 阶段9记录 | null | undefined): string {
  const 上级 = 上级渠道名称(row);
  if (上级) return `所属一级：${上级}`;
  const 下级列表 = 文本数组(原始(row).childPartnerNames);
  if (下级列表.length) return `直属二级：${下级列表.length} 家`;
  return "";
}

const 关联只读 = computed(() => {
  const 关系 = String(档案数据.value.relationship || "");
  return 关系 === "parent" || 关系 === "child";
});

async function 读取渠道证书(编号: string): Promise<Array<Record<string, unknown>>> {
  try {
    const 响应 = await fetch(
      `/api/org/member-certifications?partnerId=${encodeURIComponent(编号)}`,
      { credentials: "include" },
    );
    if (响应.status === 401) {
      处理业务会话失效();
      return [];
    }
    if (!响应.ok) return [];
    const 内容 = (await 响应.json()) as { data?: { items?: Array<Record<string, unknown>> } };
    return 内容.data?.items || [];
  } catch {
    return [];
  }
}

/** 城市检索同时匹配中文、无声调全拼和首字母，例如南京、nanjing、nj。 */
function 检索城市(
  查询: string,
  回调: (结果: Array<{ value: string; 全拼: string; 首字母: string }>) => void,
) {
  const 结果 = 匹配城市(城市选项.value, 查询);
  回调(
    结果.map((选项) => ({
      value: 选项.名称,
      全拼: 选项.全拼,
      首字母: 选项.首字母,
    })),
  );
}

async function 加载城市选项() {
  try {
    const 城市名称列表 = await 查询标准城市选项();
    城市选项.value = 构建城市检索项(城市名称列表);
    城市选项加载失败.value = false;
  } catch {
    城市选项.value = [];
    城市选项加载失败.value = true;
  }
}

async function 加载渠道详情(编号: string) {
  if (!编号) {
    档案数据.value = {};
    摘要数据.value = null;
    环节加载数据.value = { 证书列表: [], 报备总数: 0, 订单列表: [] };
    return;
  }
  摘要加载中.value = true;
  const [档案结果, 证书结果, 报备结果, 订单结果] = await Promise.all([
    查询渠道核心档案(编号).catch(() => null),
    读取渠道证书(编号),
    查询阶段9列表("registrations", { partnerId: 编号, page: 1, pageSize: 1 }).catch(() => null),
    查询阶段9全部("orders", { partnerId: 编号, 最大页数: 3 }).catch(() => ({ 数据: [], 总数: 0 })),
  ]);
  if (选中编号.value !== 编号) return;
  档案数据.value = (档案结果 as Record<string, unknown> | null) || {};
  摘要数据.value = 档案结果?.businessSummary || null;
  环节加载数据.value = {
    证书列表: 证书结果,
    报备总数: Number(报备结果?.分页?.总数 || 0),
    订单列表: 订单结果?.数据 || [],
  };
  摘要加载中.value = false;
}

/** 摘要卡可下钻到当前渠道对应的正式业务列表。 */
function 打开经营明细(模块: "registrations" | "opportunities" | "quotes" | "orders") {
  const 编号 = 当前渠道.value?.id;
  if (!编号) return;
  const 路径: Record<typeof 模块, string> = {
    registrations: "/admin/registration",
    opportunities: "/admin/opportunity",
    quotes: "/admin/quote",
    orders: "/admin/order",
  };
  void 路由器.push({ path: 路径[模块], query: { partnerId: 编号 } });
}

/* ---------------- 合作环节与运营指标 ---------------- */

/** 环节手动覆盖结果（存在即优先，未配置的手动环节默认未完成）。 */
const 环节覆盖 = computed<Record<string, boolean>>(() => {
  const 原始值 = 档案数据.value?.cooperationSteps;
  if (!原始值 || typeof 原始值 !== "object" || Array.isArray(原始值)) return {};
  const 结果: Record<string, boolean> = {};
  for (const 项 of 环节定义) {
    const 值 = (原始值 as Record<string, unknown>)[项.代码];
    if (typeof 值 === "boolean") 结果[项.代码] = 值;
  }
  return 结果;
});

function 证书未过期(证书: Record<string, unknown>): boolean {
  const 到期 = 文本(证书.expiresOn);
  if (!到期) return true;
  const 时间 = new Date(到期).getTime();
  return Number.isNaN(时间) || 时间 >= Date.now();
}

const 有效证书 = computed(() =>
  环节加载数据.value.证书列表.filter(
    (证书) => 文本(证书.statusCode) === "active" && 证书未过期(证书),
  ),
);

const 成交订单 = computed(() =>
  环节加载数据.value.订单列表.filter((行) => 成交状态集.includes(文本(行.状态))),
);

const 今年 = new Date().getFullYear();
const 去年 = 今年 - 1;

function 年份(值: string): number {
  const 时间 = new Date(值);
  return Number.isNaN(时间.getTime()) ? 0 : 时间.getFullYear();
}

const 当年订单 = computed(() => 成交订单.value.filter((行) => 年份(文本(行.创建时间)) === 今年));
const 去年订单 = computed(() => 成交订单.value.filter((行) => 年份(文本(行.创建时间)) === 去年));
const 当年金额 = computed(() =>
  当年订单.value.reduce((合计, 行) => 合计 + (Number(行.金额) || 0), 0),
);

/** 活跃度：产出一单为 1%，当年与去年同口径对比，封顶 100%。 */
const 活跃度当年 = computed(() => Math.min(100, 当年订单.value.length));
const 活跃度去年 = computed(() => Math.min(100, 去年订单.value.length));

function 金额文本(金额: number): string {
  if (!Number.isFinite(金额) || 金额 <= 0) return "¥0";
  return `¥${金额.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}

/** 客单价 = 当年成交金额 ÷ 当年成交单数。 */
const 客单价文本 = computed(() => {
  if (!当年订单.value.length) return "—";
  return 金额文本(Math.round((当年金额.value / 当年订单.value.length) * 100) / 100);
});

function 证书归类文本(证书: Record<string, unknown>): string {
  return `${文本(证书.category)} ${文本(证书.templateName)}`;
}

/** 证书等级折算：高级/专家 3 分、中级 2 分、初级及未标注 1 分。 */
function 证书等级分(证书: Record<string, unknown>): number {
  const 归类 = 证书归类文本(证书);
  if (/专家|高级|资深/.test(归类)) return 3;
  if (/中级/.test(归类)) return 2;
  return 1;
}

/** 原厂资质：有效证书总数 + 等级分，售前/售后按证书类别与模板名称归集。 */
const 资质汇总 = computed(() => {
  let 售前 = 0;
  let 售后 = 0;
  let 等级分 = 0;
  for (const 证书 of 有效证书.value) {
    const 归类 = 证书归类文本(证书);
    if (/售前|技术/.test(归类)) 售前 += 1;
    else if (/售后|运维|服务/.test(归类)) 售后 += 1;
    等级分 += 证书等级分(证书);
  }
  const 总数 = 有效证书.value.length;
  return { 总数, 售前, 售后, 其他: Math.max(0, 总数 - 售前 - 售后), 等级分 };
});

const 环节列表 = computed(() =>
  环节定义.map((项) => {
    const 覆盖值 = 环节覆盖.value[项.代码];
    const 自动完成 =
      (项.代码 === "certification" && 有效证书.value.length > 0) ||
      (项.代码 === "registration" && 环节加载数据.value.报备总数 > 0) ||
      (项.代码 === "firstOrder" && 成交订单.value.length > 0);
    const 完成 = 覆盖值 !== undefined ? 覆盖值 : 项.自动 && 自动完成;
    const 明细 =
      项.代码 === "certification"
        ? 有效证书.value.length
          ? `${有效证书.value.length} 张有效证书`
          : "暂未取得有效证书"
        : 项.代码 === "registration"
          ? 环节加载数据.value.报备总数
            ? `${环节加载数据.value.报备总数} 条客户报备`
            : "暂无报备记录"
          : 项.代码 === "firstOrder"
            ? 成交订单.value.length
              ? `已成交 ${成交订单.value.length} 单`
              : "暂无成交订单"
            : 项.说明;
    return { ...项, 完成, 明细, 手动覆盖: 覆盖值 !== undefined };
  }),
);

const 环节完成数 = computed(() => 环节列表.value.filter((项) => 项.完成).length);
const 持续运营 = computed(() => 环节完成数.value === 环节定义.length);

/** 当前环节：沿用商机进度的口径，取第一个尚未完成的环节作为高亮节点。 */
const 当前环节序号 = computed(() => 环节列表.value.findIndex((项) => !项.完成));

async function 更新环节(代码: string, 目标: boolean | undefined) {
  const 渠道 = 当前渠道.value;
  const 定义 = 环节定义.find((项) => 项.代码 === 代码);
  if (!渠道 || !定义) return;
  环节保存中.value = 代码;
  try {
    const 新覆盖 = { ...环节覆盖.value };
    // 手动环节撤销完成时删除留痕（默认即未完成），自动环节仅在手动覆盖时留痕。
    if (目标 === undefined || (目标 === false && !定义.自动)) delete 新覆盖[代码];
    else 新覆盖[代码] = 目标;
    await 保存渠道核心档案(渠道.id, { cooperationSteps: 新覆盖 });
    await 加载渠道详情(渠道.id);
    ElMessage.success(目标 === undefined ? `${定义.名称}已恢复自动更新。` : `${定义.名称}已更新。`);
  } catch (异常) {
    ElMessage.error(异常 instanceof Error ? 异常.message : "环节更新失败，请稍后重试。");
  } finally {
    环节保存中.value = "";
  }
}

function 成员列表(row: 阶段9记录 | null | undefined): Array<Record<string, unknown>> {
  const 成员 = 原始(row).staff;
  return Array.isArray(成员) ? (成员 as Array<Record<string, unknown>>) : [];
}

/** 成员姓名、账号和电话也纳入渠道商检索，避免只能按渠道主档联系人才搜到。 */
function 成员检索文本(row: 阶段9记录): string {
  return 成员列表(row)
    .flatMap((成员) => [成员.name, 成员.username, 成员.phone, 成员.displayName])
    .filter(Boolean)
    .join(" ");
}

function 等级文本(row: 阶段9记录 | null | undefined): string {
  return [分销层级文本(row), 合作级别代码(row) === "none" ? "" : 合作级别文本(row)]
    .filter(Boolean)
    .join(" · ");
}

function 分销层级文本(row: 阶段9记录 | null | undefined): string {
  return row ? 渠道等级文本(读取渠道分销层级(row)) : "未设置";
}

function 合作级别文本(row: 阶段9记录 | null | undefined): string {
  const 代码 = 合作级别代码(row);
  const 映射: Record<string, string> = {
    lep: "核心渠道",
    diamond: "钻石",
    gold: "金牌",
    silver: "银牌",
    bronze: "铜牌",
    industry: "行业总代",
    none: "未设置合作级别",
  };
  return 映射[代码] || "未设置合作级别";
}

function 合作级别代码(row: 阶段9记录 | null | undefined): string {
  const 代码 = 文本(字段(row, "cooperationLevel", "level")).toLowerCase();
  return ["lep", "diamond", "gold", "silver", "bronze", "industry"].includes(代码) ? 代码 : "none";
}

function 等级色调(row: 阶段9记录 | null | undefined): "blue" | "amber" | "gray" | "green" {
  const 合作代码 = 合作级别代码(row);
  if (合作代码 === "lep" || 合作代码 === "diamond") return "blue";
  if (合作代码 === "gold") return "amber";
  const 层级代码 = 文本(字段(row, "partnerLevel", "level"));
  if (层级代码 === "primary") return "blue";
  if (层级代码 === "secondary") return "green";
  return "gray";
}

function 联系人(row: 阶段9记录 | null | undefined): string {
  return 文本或([字段(row, "contact"), 字段(row, "bossName")], "未维护");
}

function 证书数(row: 阶段9记录 | null | undefined): number {
  const 值 = Number(原始(row).certificateCount ?? 原始(row).certifications);
  return Number.isFinite(值) && 值 > 0 ? 值 : 0;
}

function 合作状态文本(row: 阶段9记录 | null | undefined): string {
  const 代码 = 文本(row?.状态, 字段(row, "status"));
  if (代码 === "active") return "合作中";
  if (代码 === "pending") return "待审批";
  return 文本(row?.状态名称, 代码, "未知状态");
}

function 联系电话(row: 阶段9记录 | null | undefined): string {
  return 文本或([字段(row, "phone"), 字段(row, "bossPhone")], "未维护");
}

/** 区域取值兼容中文键与英文历史键，避免个别记录只带原始数据时漏进区域筛选。 */
function 区域文本(row: 阶段9记录 | null | undefined): string {
  return 文本(row?.区域, 字段(row, "region"), 字段(row, "regionName"));
}

/** 技术服务商类型只展示业务中文口径，历史空值统一归为“非技术服务商”。 */
function 技术服务商类型文本(row: 阶段9记录 | null | undefined): string {
  const 代码 = 档案字段(row, "techServiceType").toLowerCase();
  if (["full", "signed", "contract", "签约", "签约技术服务商"].includes(代码)) {
    return "签约技术服务商";
  }
  if (["developing", "nominated", "nomination", "提名", "提名技术服务商"].includes(代码)) {
    return "提名技术服务商";
  }
  return "非技术服务商";
}

const 区域选项 = computed(() =>
  [...new Set(渠道列表.value.map((row: 阶段9记录) => 区域文本(row)).filter(Boolean))].sort(),
);
const 层级选项 = ["一级渠道", "二级渠道", "未分级"];

const 新建上级渠道选项 = computed(() => {
  const 区域 = 新建表单.region.trim();
  return 渠道列表.value
    .filter((row) => 渠道可作一级上级(row, 区域))
    .map((row) => ({
      id: 渠道外部编号(row),
      label: `${row.标题 || row.渠道名称} · ${区域文本(row) || "未填写区域"}`,
    }));
});

watch(
  () => [新建表单.region, 新建表单.distributionLevel] as const,
  () => {
    if (新建表单.distributionLevel !== "secondary") {
      新建表单.parentPartnerIds = [];
      return;
    }
    新建表单.parentPartnerIds = 清理有效上级编号(
      渠道列表.value,
      新建表单.region,
      新建表单.parentPartnerIds,
    );
  },
);

const 过滤后列表 = computed(() => {
  let 列表 = 渠道列表.value;
  if (当前标签.value === "核心渠道") 列表 = 列表.filter((row) => 合作级别代码(row) === "lep");
  if (当前标签.value === "待续签") 列表 = 列表.filter((row) => 合作级别代码(row) === "none");
  if (选中区域.value && 选中区域.value !== "全部区域")
    列表 = 列表.filter((row) => 区域文本(row) === 选中区域.value);
  if (选中层级.value && 选中层级.value !== "全部层级")
    列表 = 列表.filter((row) => 分销层级文本(row) === 选中层级.value);
  const 关键词 = 搜索词.value.trim().toLowerCase();
  if (!关键词) return 列表;
  return 列表.filter((row) =>
    [
      row.标题,
      row.渠道名称,
      区域文本(row),
      联系人(row),
      联系电话(row),
      等级文本(row),
      成员检索文本(row),
    ]
      .filter(Boolean)
      .some((值) => String(值).toLowerCase().includes(关键词)),
  );
});

// 搜索或筛选条件变化后必须回到第一页，否则停留在旧页码会看到空列表，误判为检索失效。
watch([搜索词, 当前标签, 选中区域, 选中层级], () => {
  当前页码.value = 1;
});

const 总页数 = computed(() => Math.max(1, Math.ceil(过滤后列表.value.length / 每页条数)));
const 分页后列表 = computed(() => {
  const 起点 = (当前页码.value - 1) * 每页条数;
  return 过滤后列表.value.slice(起点, 起点 + 每页条数);
});

const 当前渠道 = computed(
  () => 渠道列表.value.find((row) => row.id === 选中编号.value) || 过滤后列表.value[0] || null,
);

const 成员总数 = computed(() =>
  渠道列表.value.reduce((合计, row) => 合计 + 成员列表(row).length, 0),
);

const 动态 = computed(() => {
  const 记录 = 当前渠道.value;
  if (!记录) return [];
  const 时间 = 文本(记录.更新时间, 记录.创建时间);
  return ["渠道主档已更新", "成员维护状态同步", "渠道等级已核对"]
    .map((标题, 序号) => ({
      标题,
      时间: 序号 === 0 ? 日期文本(时间) : "",
      说明: ["渠道档案信息", "渠道成员信息", "当前渠道等级"][序号] || "",
    }))
    .filter((项) => 项.时间 || 项.说明);
});

const 指标 = computed<指标项[]>(() => {
  const 列表 = 渠道列表.value;
  const 核心 = 列表.filter((row) => 合作级别代码(row) === "lep").length;
  const 金牌 = 列表.filter((row) => 合作级别代码(row) === "gold").length;
  const 未分级 = 列表.filter((row) => 合作级别代码(row) === "none").length;
  const 已维护成员 = 列表.filter((row) => 成员列表(row).length > 0).length;
  return [
    {
      label: "渠道商总数",
      value: String(列表.length),
      unit: "家",
      note: "当前数据范围内渠道商主档",
    },
    { label: "核心渠道", value: String(核心), unit: "家", note: "核心渠道与一级渠道" },
    { label: "金牌渠道", value: String(金牌), unit: "家", note: "渠道等级为金牌" },
    {
      label: "未分级",
      value: String(未分级),
      unit: "家",
      note: "渠道等级待维护，可在核心档案补全",
    },
    {
      label: "已维护成员",
      value: String(已维护成员),
      unit: "家",
      note: "已有渠道成员账号的渠道商",
    },
    { label: "成员总数", value: String(成员总数.value), unit: "人", note: "按渠道成员记录汇总" },
  ];
});

onMounted(() => {
  void 加载();
  void 加载城市选项();
});

watch(选中编号, (编号) => void 加载渠道详情(编号));
watch([当前标签, 搜索词, 选中区域, 选中层级], () => {
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

async function 加载() {
  加载中.value = true;
  错误.value = "";
  try {
    const 结果 = await 查询阶段9全部("partners");
    渠道列表.value = 结果.数据;
    选中编号.value = 渠道列表.value[0]?.id || "";
    if (选中编号.value) await 加载渠道详情(选中编号.value);
  } catch (异常) {
    错误.value = 异常 instanceof Error ? 异常.message : "渠道商数据加载失败。";
  } finally {
    加载中.value = false;
  }
}

function 打开档案(row: 阶段9记录, group = "business") {
  路由器.push({
    path: `/admin/partners/${encodeURIComponent(row.id)}/profile`,
    query: { group },
  });
}

function 打开成员(row: 阶段9记录) {
  路由器.push(`/admin/partners/${row.id}/members`);
}

function 打开新建渠道商() {
  新建错误.value = "";
  Object.assign(新建表单, {
    name: "",
    region: 区域选项.value.length === 1 ? 区域选项.value[0] : "",
    city: "",
    agreementNo: "",
    contact: "",
    phone: "",
    email: "",
    cooperationLevel: "none",
    distributionLevel: "none",
    parentPartnerIds: [],
    address: "",
    businessScope: "",
    cooperationBackground: "",
    agencyBrandsText: "",
    typicalCustomersText: "",
    customerIndustriesText: "",
    annualRevenue: "",
    employeeCount: "",
    socialInsuranceCount: "",
    invoiceCapability: "",
    serviceAreasText: "",
    authorizedProductsText: "",
    qualificationsText: "",
  });
  新建弹窗打开.value = true;
}

async function 提交新建渠道商() {
  if (新建保存中.value) return;
  新建错误.value = "";
  if (!新建表单.name.trim() || !新建表单.region.trim() || !新建表单.city.trim()) {
    新建错误.value = "请填写渠道商名称、所属区域和所在城市。";
    return;
  }
  if (!新建表单.contact.trim() || !新建表单.phone.trim()) {
    新建错误.value = "请填写渠道负责人和联系电话。";
    return;
  }
  const 电话错误 = 联系电话错误(新建表单.phone);
  if (电话错误) {
    新建错误.value = 电话错误;
    return;
  }
  if (新建表单.distributionLevel === "secondary" && !新建表单.parentPartnerIds.length) {
    新建错误.value = "二级渠道商必须至少绑定一个同区域一级渠道商。";
    return;
  }
  新建保存中.value = true;
  try {
    const 结果 = await 创建渠道商({
      name: 新建表单.name.trim(),
      region: 新建表单.region.trim(),
      city: 新建表单.city.trim(),
      agreementNo: 新建表单.agreementNo.trim(),
      contact: 新建表单.contact.trim(),
      phone: 新建表单.phone.trim(),
      email: 新建表单.email.trim(),
      cooperationLevel: 新建表单.cooperationLevel,
      partnerLevel: 新建表单.distributionLevel,
      parentPartnerIds: 新建表单.distributionLevel === "secondary" ? 新建表单.parentPartnerIds : [],
      address: 新建表单.address.trim(),
      businessScope: 新建表单.businessScope.trim(),
      cooperationBackground: 新建表单.cooperationBackground.trim(),
      agencyBrands: 拆分新建列表(新建表单.agencyBrandsText),
      typicalCustomers: 拆分新建列表(新建表单.typicalCustomersText),
      customerIndustries: 拆分新建列表(新建表单.customerIndustriesText),
      annualRevenue: 新建表单.annualRevenue.trim(),
      employeeCount: 新建表单.employeeCount.trim(),
      socialInsuranceCount: 新建表单.socialInsuranceCount.trim(),
      invoiceCapability: 新建表单.invoiceCapability.trim(),
      serviceAreas: 拆分新建列表(新建表单.serviceAreasText),
      authorizedProducts: 拆分新建列表(新建表单.authorizedProductsText),
      qualifications: 拆分新建列表(新建表单.qualificationsText),
    });
    新建弹窗打开.value = false;
    await 加载();
    const 新建编号 = 文本(结果.id);
    const 新建渠道 = 渠道列表.value.find(
      (row) => 渠道外部编号(row) === 新建编号 || row.id === 新建编号,
    );
    选中编号.value = 新建渠道?.id || 渠道列表.value[0]?.id || "";
    ElMessage.success(
      结果.status === "pending" ? "渠道商已提交，等待超级管理员审批。" : "渠道商已创建。",
    );
  } catch (异常) {
    新建错误.value = 异常 instanceof Error ? 异常.message : "新建渠道商失败，请稍后重试。";
  } finally {
    新建保存中.value = false;
  }
}

function 关闭新建渠道商() {
  if (新建保存中.value) return;
  新建弹窗打开.value = false;
  新建错误.value = "";
}

function 拆分新建列表(值: string): string[] {
  return 值
    .split(/[、,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function 打开资质审核() {
  路由器.push("/admin/partners/qualification-review");
}

function 切换页码(页码: number) {
  当前页码.value = Math.min(总页数.value, Math.max(1, 页码));
}
</script>

<template>
  <div class="vui war-artboard 渠道商页">
    <WarKpis :items="指标" :加载中="加载中" />

    <WarLayout
      v-model="搜索词"
      list-title="渠道商列表"
      :list-count="String(过滤后列表.length)"
      search-placeholder="搜索渠道商名称、区域、联系人或级别"
      :tabs="标签列表"
      :active-tab="当前标签"
      :动态="动态"
      :区域列表="区域选项"
      :选中区域="选中区域"
      :层级列表="层级选项"
      :选中层级="选中层级"
      @update:选中区域="选中区域 = $event"
      @update:选中层级="选中层级 = $event"
      @切换标签="当前标签 = $event"
    >
      <template #list>
        <div v-if="加载中" class="war-empty">正在加载渠道商数据…</div>
        <div v-else-if="错误" class="war-empty">{{ 错误 }}</div>
        <WarRecordCard
          v-for="row in 分页后列表"
          :key="row.id"
          :title="文本或([row.标题, row.渠道名称], '未命名渠道商')"
          :meta="
            [
              等级文本(row),
              区域文本(row) || '未填写区域',
              `负责人：${联系人(row)}`,
              渠道关系摘要(row),
            ]
              .filter(Boolean)
              .join(' · ')
          "
          :badge="合作状态文本(row)"
          :tone="等级色调(row)"
          :owner="
            成员列表(row).length
              ? `${成员列表(row).length} 人 / ${证书数(row)} 项证书`
              : '成员与证书未维护'
          "
          :amount="文本(字段(row, 'bigRegion'), '—')"
          :tags="[
            { text: 等级文本(row) },
            {
              text: 成员列表(row).length ? '资质已维护' : '资质待补齐',
              hot: 成员列表(row).length > 0,
            },
          ]"
          :active="当前渠道?.id === row.id"
          @选择="选中编号 = row.id"
        />
        <div v-if="!加载中 && !错误 && !过滤后列表.length" class="war-empty">
          当前筛选条件下没有渠道商记录。
        </div>
        <nav v-if="过滤后列表.length > 每页条数" class="渠道分页" aria-label="渠道商列表分页">
          <button type="button" :disabled="当前页码 <= 1" @click="切换页码(当前页码 - 1)">
            上一页
          </button>
          <span>第 {{ 当前页码 }} / {{ 总页数 }} 页，共 {{ 过滤后列表.length }} 家</span>
          <button type="button" :disabled="当前页码 >= 总页数" @click="切换页码(当前页码 + 1)">
            下一页
          </button>
        </nav>
      </template>

      <template #center>
        <template v-if="当前渠道">
          <div class="war-center-head">
            <div class="deal-title">
              <strong>{{ 文本或([当前渠道.标题, 当前渠道.渠道名称], "未命名渠道商") }}</strong>
              <span>
                {{ 等级文本(当前渠道) }} · {{ 区域文本(当前渠道) || "未填写区域" }} · 负责人：{{
                  联系人(当前渠道)
                }}
                · 技术服务商：{{ 技术服务商类型文本(当前渠道) }}
              </span>
            </div>
            <div class="center-actions">
              <button type="button" class="button primary" @click="打开新建渠道商">
                新建渠道商
              </button>
              <button type="button" class="button" @click="打开资质审核">渠道资质审核</button>
              <button type="button" class="button" @click="打开档案(当前渠道)">渠道核心档案</button>
              <button v-if="!关联只读" type="button" class="button" @click="打开成员(当前渠道)">
                成员维护
              </button>
            </div>
          </div>

          <div class="extended-center-grid">
            <section class="panel 通栏面板">
              <header class="panel-head">
                <div>
                  <h2>合作环节</h2>
                  <p>六个环节不区分阶段：前三个手动确认，后三个按业务数据自动更新。</p>
                </div>
                <span class="阶段徽标" :class="{ 持续运营 }">
                  {{ 持续运营 ? "已进入持续运营阶段" : `推进中 ${环节完成数}/${环节定义.length}` }}
                </span>
              </header>
              <div class="panel-body">
                <div class="环节轨道">
                  <div
                    v-for="(项, 序号) in 环节列表"
                    :key="项.代码"
                    class="环节节点"
                    :class="{ 已完成: 项.完成, 当前节点: 当前环节序号 === 序号 }"
                  >
                    <span class="环节圆点">{{ 项.完成 ? "✓" : 序号 + 1 }}</span>
                    <strong>{{ 项.名称 }}</strong>
                    <span class="环节来源">{{ 项.自动 ? "自动更新" : "手动确认" }}</span>
                    <small class="环节明细">{{ 项.明细 }}</small>
                    <div v-if="!关联只读" class="环节操作">
                      <button
                        type="button"
                        class="button"
                        :disabled="环节保存中 === 项.代码"
                        @click="更新环节(项.代码, !项.完成)"
                      >
                        {{ 项.完成 ? (项.自动 ? "标记未完成" : "撤销完成") : "标记完成" }}
                      </button>
                      <button
                        v-if="项.自动 && 项.手动覆盖"
                        type="button"
                        class="link"
                        :disabled="环节保存中 === 项.代码"
                        @click="更新环节(项.代码, undefined)"
                      >
                        恢复自动
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section class="panel 通栏面板">
              <header class="panel-head">
                <div>
                  <h2>渠道运营指标</h2>
                  <p>活跃度、业务能力与原厂资质按当前渠道实时计算</p>
                </div>
              </header>
              <div class="panel-body">
                <div class="摘要网格 三列">
                  <div class="摘要卡">
                    <span>活跃度（当年）</span>
                    <div class="metric-value">
                      <strong>{{ 活跃度当年 }}%</strong>
                    </div>
                    <small>
                      当年 {{ 当年订单.length }} 单 · 去年 {{ 活跃度去年 }}%（{{ 去年订单.length }}
                      单）
                    </small>
                  </div>
                  <div class="摘要卡">
                    <span>业务能力 · 客单价（当年）</span>
                    <div class="metric-value">
                      <strong>{{ 客单价文本 }}</strong>
                    </div>
                    <small>当年成交 {{ 当年订单.length }} 单 · 合计 {{ 金额文本(当年金额) }}</small>
                  </div>
                  <div class="摘要卡">
                    <span>原厂资质（当前）</span>
                    <div class="metric-value">
                      <strong>{{ 资质汇总.总数 }} 张 · 等级分 {{ 资质汇总.等级分 }}</strong>
                    </div>
                    <small>
                      售前 {{ 资质汇总.售前 }} · 售后 {{ 资质汇总.售后 }} · 其他 {{ 资质汇总.其他 }}
                    </small>
                  </div>
                </div>
                <p class="war-note">
                  指标口径：活跃度按当年成交订单数计（1 单 = 1%，上限
                  100%），历史对比展示去年同口径； 客单价 = 当年成交金额 ÷
                  当年成交单数；原厂资质按渠道成员有效证书统计， 证书等级按模板名称中的初级 / 中级 /
                  高级（专家）折算 1 / 2 / 3 分。
                </p>
              </div>
            </section>

            <section class="panel">
              <header class="panel-head">
                <div>
                  <h2>工商主体</h2>
                  <p>成立时间、注册资本与统一社会信用代码</p>
                </div>
              </header>
              <div class="panel-body">
                <div class="info-grid">
                  <div class="info-item">
                    <span>统一社会信用代码</span>
                    <strong>{{
                      或未维护(档案字段(当前渠道, "unifiedSocialCreditCode", "creditCode"))
                    }}</strong>
                  </div>
                  <div class="info-item">
                    <span>成立时间</span>
                    <strong>{{
                      或未维护(档案字段(当前渠道, "establishedAt", "foundedAt"))
                    }}</strong>
                  </div>
                  <div class="info-item">
                    <span>注册资本（万元）</span>
                    <strong>{{ 或未维护(档案字段(当前渠道, "registeredCapital")) }}</strong>
                  </div>
                  <div class="info-item">
                    <span>实缴资本（万元）</span>
                    <strong>{{ 或未维护(档案字段(当前渠道, "paidInCapital")) }}</strong>
                  </div>
                  <div class="info-item">
                    <span>法定代表人</span>
                    <strong>{{ 或未维护(档案字段(当前渠道, "legalRepresentative")) }}</strong>
                  </div>
                  <div class="info-item">
                    <span>经营状态</span>
                    <strong>{{ 或未维护(档案字段(当前渠道, "businessStatus")) }}</strong>
                  </div>
                  <div class="info-item">
                    <span>工商认证</span>
                    <strong>{{ 原始(当前渠道).verified ? "已认证" : "未认证" }}</strong>
                  </div>
                  <div class="info-item">
                    <span>渠道商编号</span><strong>{{ 文本(当前渠道.编号, "—") }}</strong>
                  </div>
                </div>
              </div>
            </section>

            <section class="panel">
              <header class="panel-head">
                <div>
                  <h2>经营与能力</h2>
                  <p>代理品牌、服务区域与团队规模</p>
                </div>
              </header>
              <div class="panel-body">
                <div class="info-grid">
                  <div class="info-item">
                    <span>代理品牌</span>
                    <strong>{{ 或未维护(档案字段(当前渠道, "agencyBrands")) }}</strong>
                  </div>
                  <div class="info-item">
                    <span>服务区域</span>
                    <strong>{{ 或未维护(档案字段(当前渠道, "serviceAreas")) }}</strong>
                  </div>
                  <div class="info-item">
                    <span>年营收规模</span>
                    <strong>{{ 或未维护(档案字段(当前渠道, "annualRevenue")) }}</strong>
                  </div>
                  <div class="info-item">
                    <span>员工人数</span>
                    <strong>{{ 或未维护(档案字段(当前渠道, "employeeCount")) }}</strong>
                  </div>
                  <div class="info-item">
                    <span>参保人数</span>
                    <strong>{{ 或未维护(档案字段(当前渠道, "socialInsuranceCount")) }}</strong>
                  </div>
                  <div class="info-item">
                    <span>开票能力</span>
                    <strong>{{ 或未维护(档案字段(当前渠道, "invoiceCapability")) }}</strong>
                  </div>
                  <div class="info-item">
                    <span>授权产品</span>
                    <strong>{{ 或未维护(档案列表文本(当前渠道, "authorizedProducts")) }}</strong>
                  </div>
                  <div class="info-item">
                    <span>资质证书</span>
                    <strong>{{ 或未维护(档案列表文本(当前渠道, "qualifications")) }}</strong>
                  </div>
                </div>
              </div>
            </section>

            <section class="panel">
              <header class="panel-head">
                <div>
                  <h2>合作背景</h2>
                  <p>合作历史、典型客户与业务范围</p>
                </div>
              </header>
              <div class="panel-body">
                <div class="info-grid">
                  <div class="info-item">
                    <span>协议编号</span>
                    <strong>{{ 或未维护(档案字段(当前渠道, "agreementNo")) }}</strong>
                  </div>
                  <div class="info-item">
                    <span>合作起始</span>
                    <strong>{{ 日期文本(档案字段(当前渠道, "joinDate")) }}</strong>
                  </div>
                  <div class="info-item">
                    <span>负责人</span><strong>{{ 联系人(当前渠道) }}</strong>
                  </div>
                  <div class="info-item">
                    <span>联系电话</span><strong>{{ 联系电话(当前渠道) }}</strong>
                  </div>
                </div>
                <div class="长文字段">
                  <div>
                    <span>合作背景</span>
                    <p>{{ 或未维护(档案字段(当前渠道, "cooperationBackground")) }}</p>
                  </div>
                  <div>
                    <span>业务范围</span>
                    <p>{{ 或未维护(档案字段(当前渠道, "businessScope")) }}</p>
                  </div>
                  <div>
                    <span>典型客户</span>
                    <p>{{ 或未维护(档案字段(当前渠道, "typicalCustomers")) }}</p>
                  </div>
                  <div>
                    <span>客户行业</span>
                    <p>{{ 或未维护(档案列表文本(当前渠道, "customerIndustries")) }}</p>
                  </div>
                </div>
              </div>
            </section>

            <section v-if="!关联只读" class="panel">
              <header class="panel-head">
                <div>
                  <h2>合作经营摘要</h2>
                  <p>
                    按渠道主档归集；客户按客户主体去重，有效报价不含草稿、已取消、已驳回及已归档记录
                  </p>
                </div>
                <span class="摘要状态">{{ 摘要加载中 ? "统计中…" : "实时统计" }}</span>
              </header>
              <div class="panel-body">
                <div class="摘要网格">
                  <button type="button" class="摘要卡" @click="打开经营明细('registrations')">
                    <span>客户（去重）</span>
                    <div class="metric-value">
                      <strong>{{ 摘要数据?.客户数 ?? "—" }}</strong>
                    </div>
                    <small>按客户主体去重</small>
                  </button>
                  <button type="button" class="摘要卡" @click="打开经营明细('opportunities')">
                    <span>商机</span>
                    <div class="metric-value">
                      <strong>{{ 摘要数据?.商机数 ?? "—" }}</strong>
                    </div>
                    <small>在管商机</small>
                  </button>
                  <button type="button" class="摘要卡" @click="打开经营明细('quotes')">
                    <span>报价单</span>
                    <div class="metric-value">
                      <strong>{{ 摘要数据?.报价单数 ?? "—" }}</strong>
                    </div>
                    <small>有效报价</small>
                  </button>
                  <button type="button" class="摘要卡" @click="打开经营明细('orders')">
                    <span>订单</span>
                    <div class="metric-value">
                      <strong>{{ 摘要数据?.订单数 ?? "—" }}</strong>
                    </div>
                    <small>累计订单</small>
                  </button>
                </div>
                <div class="摘要金额">
                  <span
                    >有效商机金额 <strong>{{ 金额文本(摘要数据?.商机金额 || 0) }}</strong></span
                  >
                  <span
                    >有效订单金额 <strong>{{ 金额文本(摘要数据?.订单金额 || 0) }}</strong></span
                  >
                  <span
                    >全链路转化率 <strong>{{ 摘要数据?.全链路转化率 ?? 0 }}%</strong></span
                  >
                </div>
                <p class="war-note">
                  统计口径：客户只计待审核、已通过和已转商机的去重客户主体；有效报价排除草稿、取消、驳回和替换记录。
                  点击卡片可查看对应业务明细。
                </p>
              </div>
            </section>
          </div>
        </template>
        <div v-else class="war-empty 无渠道空态">
          <span>请选择左侧渠道商查看档案。</span>
          <button type="button" class="button primary" @click="打开新建渠道商">新建渠道商</button>
        </div>
      </template>

      <template #right>
        <article v-if="当前渠道" class="right-card highlight">
          <div class="right-card-title"><strong>实时快照</strong><span>渠道商</span></div>
          <div class="info-grid">
            <div class="info-item">
              <span>渠道级别</span><strong>{{ 等级文本(当前渠道) }}</strong>
            </div>
            <div class="info-item">
              <span>所属区域</span>
              <strong>{{ 文本(字段(当前渠道, "region"), "未填写") }}</strong>
            </div>
            <div v-if="!关联只读" class="info-item">
              <span>成员账号</span><strong>{{ 成员列表(当前渠道).length }} 人</strong>
            </div>
            <div class="info-item">
              <span>负责人</span><strong>{{ 联系人(当前渠道) }}</strong>
            </div>
            <div class="info-item">
              <span>技术服务商</span><strong>{{ 技术服务商类型文本(当前渠道) }}</strong>
            </div>
            <div v-if="上级渠道名称(当前渠道)" class="info-item">
              <span>所属一级渠道商</span><strong>{{ 上级渠道名称(当前渠道) }}</strong>
            </div>
            <div v-if="下级渠道名称(当前渠道)" class="info-item">
              <span>直属二级渠道商</span>
              <strong>{{ 文本数组(原始(当前渠道).childPartnerNames).length }} 家</strong>
            </div>
          </div>
        </article>

        <article v-if="当前渠道 && !关联只读" class="right-card">
          <div class="right-card-title">
            <strong>渠道成员</strong><span>{{ 成员列表(当前渠道).length }} 人</span>
          </div>
          <div v-if="成员列表(当前渠道).length" class="mini-list">
            <div
              v-for="成员 in 成员列表(当前渠道)"
              :key="String(成员.id || 成员.username)"
              class="mini-item"
            >
              <strong>{{ 文本(成员.name, 成员.username, "未命名成员") }}</strong>
              <span>
                {{ 文本(成员.role, "成员") }} · {{ 文本(成员.phone, "未维护电话") }} ·
                {{ 文本(成员.status) === "active" ? "启用" : "停用" }}
              </span>
            </div>
          </div>
          <p v-else class="war-note">该渠道商暂未维护成员账号，可在成员维护中新增。</p>
        </article>
      </template>
    </WarLayout>

    <Teleport to="body">
      <div v-if="新建弹窗打开" class="vui 新建渠道遮罩" @click.self="关闭新建渠道商">
        <section
          class="新建渠道弹窗"
          role="dialog"
          aria-modal="true"
          aria-labelledby="新建渠道商标"
        >
          <header>
            <div>
              <h2 id="新建渠道商标">新建渠道商</h2>
              <p>超管创建后立即生效；区域管理员创建的渠道商按账号所属区域进入待审批。</p>
            </div>
            <button
              type="button"
              aria-label="关闭新建渠道商"
              :disabled="新建保存中"
              @click="关闭新建渠道商"
            >
              ×
            </button>
          </header>
          <form class="新建渠道表单" @submit.prevent="提交新建渠道商">
            <fieldset :disabled="新建保存中">
              <p v-if="新建错误" class="新建错误提示" role="alert">{{ 新建错误 }}</p>

              <div class="新建分区">
                <h3>主体与区域</h3>
                <div class="新建表单网格">
                  <label class="全宽">
                    <span>渠道商名称 *</span>
                    <input
                      v-model="新建表单.name"
                      maxlength="120"
                      autocomplete="organization"
                      placeholder="请输入渠道商完整名称"
                    />
                  </label>
                  <label>
                    <span>所属区域 *</span>
                    <input
                      v-model="新建表单.region"
                      list="新建渠道区域选项"
                      maxlength="80"
                      placeholder="选择或输入所属区域"
                    />
                    <datalist id="新建渠道区域选项">
                      <option v-for="区域 in 区域选项" :key="区域" :value="区域" />
                    </datalist>
                  </label>
                  <label>
                    <span>所在城市 *</span>
                    <el-autocomplete
                      v-model="新建表单.city"
                      :fetch-suggestions="检索城市"
                      maxlength="80"
                      clearable
                      placeholder="输入中文、全拼或首字母，例如：南京 / nanjing / nj"
                    >
                      <template #default="{ item }">
                        <div class="城市选项">
                          <span>{{ item.value }}</span>
                          <small>{{ item.全拼 }} · {{ item.首字母 }}</small>
                        </div>
                      </template>
                    </el-autocomplete>
                    <small v-if="新建表单.city.trim() && !当前城市是否标准" class="城市自定义提示">
                      {{
                        城市选项加载失败 ? "标准城市暂不可用，" : "未匹配标准城市，"
                      }}将按自定义城市保存
                    </small>
                  </label>
                  <label>
                    <span>合作级别</span>
                    <select v-model="新建表单.cooperationLevel">
                      <option value="none">未设置</option>
                      <option value="lep">核心渠道</option>
                      <option value="diamond">钻石</option>
                      <option value="gold">金牌</option>
                      <option value="silver">银牌</option>
                      <option value="bronze">铜牌</option>
                      <option value="industry">行业总代</option>
                    </select>
                  </label>
                  <label>
                    <span>分销层级</span>
                    <select v-model="新建表单.distributionLevel">
                      <option value="none">未设置</option>
                      <option value="primary">一级渠道商</option>
                      <option value="secondary">二级渠道商</option>
                    </select>
                  </label>
                  <label v-if="新建表单.distributionLevel === 'secondary'" class="全宽">
                    <span>上级一级渠道商 *</span>
                    <el-select
                      v-model="新建表单.parentPartnerIds"
                      class="层级多选"
                      multiple
                      filterable
                      placeholder="选择一个或多个同区域一级渠道商"
                    >
                      <el-option
                        v-for="选项 in 新建上级渠道选项"
                        :key="选项.id"
                        :label="选项.label"
                        :value="选项.id"
                      />
                      <template #empty>
                        <div class="层级空选项">当前区域暂无可用的一级渠道商</div>
                      </template>
                    </el-select>
                  </label>
                </div>
              </div>

              <div class="新建分区">
                <h3>联系人与合作信息</h3>
                <div class="新建表单网格">
                  <label>
                    <span>协议编号</span>
                    <input
                      v-model="新建表单.agreementNo"
                      maxlength="120"
                      placeholder="选填；区管正式确认订单前必须维护"
                    />
                  </label>
                  <label>
                    <span>渠道负责人 *</span>
                    <input
                      v-model="新建表单.contact"
                      maxlength="80"
                      autocomplete="name"
                      placeholder="请输入负责人姓名"
                    />
                  </label>
                  <label>
                    <span>联系电话 *</span>
                    <input
                      v-model="新建表单.phone"
                      maxlength="32"
                      autocomplete="tel"
                      placeholder="请输入联系电话"
                    />
                  </label>
                  <label>
                    <span>联系邮箱</span>
                    <input
                      v-model="新建表单.email"
                      type="email"
                      maxlength="120"
                      autocomplete="email"
                      placeholder="请输入联系邮箱"
                    />
                  </label>
                  <label>
                    <span>开票能力</span>
                    <input
                      v-model="新建表单.invoiceCapability"
                      placeholder="增值税专票 / 普通发票"
                    />
                  </label>
                  <label class="全宽">
                    <span>注册 / 办公地址</span>
                    <input
                      v-model="新建表单.address"
                      maxlength="240"
                      placeholder="请输入详细地址"
                    />
                  </label>
                  <label class="全宽">
                    <span>合作背景</span>
                    <textarea
                      v-model="新建表单.cooperationBackground"
                      maxlength="2000"
                      placeholder="合作历史、重点项目和战略关系"
                    />
                  </label>
                </div>
              </div>

              <div class="新建分区">
                <h3>经营能力（可选）</h3>
                <div class="新建表单网格">
                  <label>
                    <span>经营范围</span>
                    <textarea
                      v-model="新建表单.businessScope"
                      placeholder="经营范围或可展示的业务能力"
                    />
                  </label>
                  <label>
                    <span>服务区域</span>
                    <textarea
                      v-model="新建表单.serviceAreasText"
                      placeholder="多个区域用顿号分隔"
                    />
                  </label>
                  <label>
                    <span>代理品牌</span>
                    <textarea
                      v-model="新建表单.agencyBrandsText"
                      placeholder="多个品牌用顿号分隔"
                    />
                  </label>
                  <label>
                    <span>典型客户</span>
                    <textarea
                      v-model="新建表单.typicalCustomersText"
                      placeholder="多个客户用顿号分隔"
                    />
                  </label>
                  <label>
                    <span>客户行业</span>
                    <textarea
                      v-model="新建表单.customerIndustriesText"
                      placeholder="金融、制造业、医疗等"
                    />
                  </label>
                  <label>
                    <span>年营业收入</span>
                    <input v-model="新建表单.annualRevenue" placeholder="金额或区间" />
                  </label>
                  <label>
                    <span>员工人数</span>
                    <input v-model="新建表单.employeeCount" placeholder="例如：86 人" />
                  </label>
                  <label>
                    <span>参保人数</span>
                    <input v-model="新建表单.socialInsuranceCount" placeholder="例如：68 人" />
                  </label>
                  <label class="全宽">
                    <span>授权产品</span>
                    <textarea
                      v-model="新建表单.authorizedProductsText"
                      placeholder="多个产品用顿号分隔"
                    />
                  </label>
                  <label class="全宽">
                    <span>证书与资质</span>
                    <textarea
                      v-model="新建表单.qualificationsText"
                      placeholder="认证类型、人数和有效期"
                    />
                  </label>
                </div>
              </div>
            </fieldset>

            <footer>
              <span v-if="新建表单.distributionLevel === 'secondary'" class="新建提示">
                二级渠道商必须绑定同区域一级渠道商。
              </span>
              <button type="button" class="按钮次要" :disabled="新建保存中" @click="关闭新建渠道商">
                取消
              </button>
              <button type="submit" class="按钮主要" :disabled="新建保存中">
                {{ 新建保存中 ? "保存中…" : "提交新建" }}
              </button>
            </footer>
          </form>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.渠道商页 {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 12px;
  min-height: calc(100vh - 96px);
  padding: 14px 18px 18px;
}

.渠道商页 :deep(.war-kpis) {
  position: static;
  inset: auto;
  height: auto;
}

.渠道商页 :deep(.war-layout) {
  position: static;
  inset: auto;
  min-height: 620px;
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
  background: #f8fbff;
}

.渠道商页 :deep(.war-list-body) {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.渠道商页 :deep(.war-search input) {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--text);
  font-size: 11px;
  outline: none;
}

.war-empty {
  display: grid;
  place-items: center;
  min-height: 120px;
  padding: 18px;
  color: var(--text-3);
  font-size: 11px;
}

.无渠道空态 {
  gap: 10px;
}

/* 合作背景等长文字段：多行展示，避免挤压信息网格。 */
.长文字段 {
  display: grid;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--line-soft);
}

.长文字段 > div {
  display: grid;
  gap: 2px;
}

.长文字段 span {
  color: var(--text-3);
}

.长文字段 p {
  margin: 0;
  color: var(--text-2);
  line-height: 1.7;
  word-break: break-all;
}

/* 通栏面板：环节与运营指标在中间栏独占一行，保证六宫格与三宫格不挤压。 */
.通栏面板 {
  grid-column: 1 / -1;
}

/* 合作环节：对齐商机进度的横向轨道，圆点串联六个环节，已完成打勾、当前节点高亮。 */
.环节轨道 {
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 4px;
  padding: 4px 0 2px;
}

.环节轨道::before {
  content: "";
  position: absolute;
  left: calc(100% / 12);
  right: calc(100% / 12);
  top: 14px;
  height: 2px;
  background: #dbe7f5;
}

.环节节点 {
  position: relative;
  z-index: 1;
  display: grid;
  flex: 1 1 0;
  justify-items: center;
  gap: 4px;
  min-width: 0;
  text-align: center;
}

.环节圆点 {
  display: grid;
  place-items: center;
  width: 21px;
  height: 21px;
  border: 2px solid #d6e4f4;
  border-radius: 50%;
  background: #ffffff;
  color: #7990a9;
  font-weight: 700;
}

.环节节点.已完成 .环节圆点 {
  border-color: var(--blue, #2f69ed);
  background: var(--blue, #2f69ed);
  color: #ffffff;
}

.环节节点.当前节点 .环节圆点 {
  border-color: var(--blue, #2f69ed);
  color: var(--blue, #2f69ed);
  box-shadow: 0 0 0 4px rgba(47, 105, 237, 0.11);
}

.环节节点 > strong {
  overflow: hidden;
  max-width: 100%;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.环节来源 {
  padding: 1px 6px;
  border-radius: 999px;
  background: #f1f6ff;
  color: var(--blue, #2f69ed);
}

.环节明细 {
  display: block;
  min-height: 2.6em;
  margin: 0;
  color: var(--text-3);
  line-height: 1.6;
}

.环节操作 {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 26px;
}

.阶段徽标 {
  padding: 3px 10px;
  border: 1px solid #d5e5fb;
  border-radius: 999px;
  background: #f1f6ff;
  color: var(--blue, #2f69ed);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.阶段徽标.持续运营 {
  border-color: #cdebd9;
  background: #e6f7ee;
  color: #0b8d69;
}

/* 运营指标三宫格：沿用合作经营摘要卡片样式。 */
.摘要网格.三列 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

/* 合作经营摘要：四宫格指标，数字与其他页 KPI 口径一致。 */
.摘要状态 {
  color: var(--text-3);
}

.摘要网格 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.摘要卡 {
  display: grid;
  gap: 1px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--line-soft);
  border-radius: 9px;
  background: linear-gradient(120deg, #ffffff, #f4f9ff);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.16s ease,
    transform 0.16s ease;
}

.摘要卡:hover,
.摘要卡:focus-visible {
  border-color: #9dbcf6;
  outline: none;
  transform: translateY(-1px);
}

.摘要金额 {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  margin-top: 10px;
  color: var(--text-3);
  font-size: 12px;
}

.摘要金额 strong {
  color: var(--text-1);
  font-size: 13px;
}

.摘要卡 span,
.摘要卡 small {
  color: var(--text-3);
}

.摘要卡 .metric-value strong {
  color: var(--text);
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

.渠道分页 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 2px 2px;
  color: var(--text-3);
  font-size: 11px;
}

.渠道分页 button {
  padding: 5px 10px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: #fff;
  color: var(--text-2);
  font-size: 11px;
  cursor: pointer;
}

.渠道分页 button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.层级多选 {
  display: block;
  width: 100%;
}

.层级空选项 {
  padding: 12px 16px;
  color: #7a8798;
  font-size: 13px;
  text-align: center;
}

.城市选项 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.城市选项 small,
.城市自定义提示 {
  color: #8391a5;
  font-size: 12px;
}

.城市自定义提示 {
  display: block;
  margin-top: 4px;
}

.新建渠道遮罩 {
  position: fixed;
  z-index: 1320;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(13, 29, 52, 0.42);
  backdrop-filter: blur(4px);
}

.新建渠道弹窗 {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  width: min(900px, 96vw);
  max-height: 92vh;
  overflow: hidden;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 24px 70px rgba(15, 32, 60, 0.24);
}

.新建渠道弹窗 > header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
  border-bottom: 1px solid #e7eef6;
}

.新建渠道弹窗 h2 {
  margin: 0;
  color: #172b4d;
  font-size: 16px;
}

.新建渠道弹窗 header p {
  margin: 5px 0 0;
  color: #75869a;
  font-size: 11px;
  line-height: 1.6;
}

.新建渠道弹窗 header > button {
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

.新建渠道弹窗 header > button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.新建渠道表单 {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  min-height: 0;
  overflow: hidden;
}

.新建渠道表单 fieldset {
  display: grid;
  align-content: start;
  gap: 18px;
  min-height: 0;
  margin: 0;
  padding: 18px 20px;
  overflow-y: auto;
  border: 0;
  overscroll-behavior: contain;
}

.新建分区 {
  display: grid;
  gap: 12px;
}

.新建分区 > h3 {
  margin: 0;
  padding-bottom: 8px;
  border-bottom: 1px solid #edf2f7;
  color: #34475f;
  font-size: 13px;
}

.新建表单网格 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 16px;
}

.新建表单网格 label {
  display: grid;
  gap: 7px;
  min-width: 0;
}

.新建表单网格 label > span {
  color: #60748c;
  font-size: 11px;
  font-weight: 700;
}

.新建表单网格 input,
.新建表单网格 select,
.新建表单网格 textarea {
  width: 100%;
  min-height: 38px;
  padding: 9px 11px;
  border: 1px solid #b9cde2;
  border-radius: 8px;
  background: #f8fbff;
  color: #172b4d;
  font: inherit;
  font-size: 11px;
}

.新建表单网格 textarea {
  min-height: 78px;
  resize: vertical;
  line-height: 1.6;
}

.新建表单网格 input:disabled,
.新建表单网格 select:disabled,
.新建表单网格 textarea:disabled {
  background: #f6f8fb;
  color: #8391a5;
}

.新建表单网格 .全宽 {
  grid-column: 1 / -1;
}

.新建错误提示 {
  margin: 0;
  padding: 9px 11px;
  border: 1px solid #f1c4ca;
  border-radius: 8px;
  background: #fff0f2;
  color: #b53d49;
  font-size: 11px;
}

.新建渠道表单 > footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid #e7eef6;
  background: #fbfdff;
}

.新建提示 {
  margin-right: auto;
  color: #75869a;
  font-size: 11px;
}

.按钮次要,
.按钮主要 {
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid #d5e2f0;
  border-radius: 8px;
  background: #fff;
  color: #4f6178;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.按钮主要 {
  border-color: #2f69ed;
  background: #2f69ed;
  color: #fff;
}

.按钮次要:disabled,
.按钮主要:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

@media (max-width: 680px) {
  .新建渠道遮罩 {
    padding: 10px;
  }

  .新建表单网格 {
    grid-template-columns: minmax(0, 1fr);
  }

  .新建表单网格 .全宽 {
    grid-column: auto;
  }
}
</style>
