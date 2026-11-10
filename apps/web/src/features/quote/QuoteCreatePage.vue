<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import {
  type 产品定价明细,
  创建报价,
  type 报价试算结果,
  更新报价,
  查询阶段9全部,
  试算报价,
  type 阶段9记录,
} from "../../api/business-client.js";
import {
  type 业务类型代码,
  业务类型名称,
  记录业务类型,
} from "../../shared/business/business-type.js";
import { 取数, 文本, 日期文本 } from "../../shared/format/business-format.js";
import { 计算历史缺价序号 } from "../../shared/format/quote-history.js";
import { use外壳前缀 } from "../../shared/navigation/shell-prefix.js";
import { type 产品树大类, 查询产品树 } from "../product/product-catalog-client.js";
import {
  分组已选报价明细,
  type 报价目录功能,
  type 报价目录大类,
  type 报价目录模块,
  是维保报价产品,
  构建报价目录,
  筛选套餐功能目录,
  过滤报价目录,
} from "./quote-catalog-tree.js";

type 报价明细项 = 报价试算结果["items"][number];
type 报价类型代码 = "standard" | "channel_distribution";

const 路由 = useRoute();
const 路由器 = useRouter();
const 外壳前缀 = use外壳前缀();
const 提交中 = ref(false);
const 试算中 = ref(false);
const 商机列表 = ref<阶段9记录[]>([]);
const 产品列表 = ref<阶段9记录[]>([]);
const 产品树数据 = ref<产品树大类[]>([]);
const 试算结果 = ref<报价试算结果 | null>(null);
/**
 * 报价模块按报价方式分开保存，避免切换方式或换套餐时把用户已勾选的内容冲掉（对齐旧 UI）：
 * - 套餐报价：入单模块完全来自套餐；
 * - 补充功能：套餐内模块 + 本清单里手动加选的模块；
 * - 自定义报价：入单模块完全来自本清单。
 */
const 补充功能选择 = ref<string[]>([]);
const 自定义选择 = ref<string[]>([]);
/** 自定义报价首次进入时用当前报价内容引导一次，之后以用户勾选为准。 */
const 自定义已引导 = ref(false);
const 选中硬件 = ref<Record<string, number>>({});
/** 逐项数量：用户手工调整过的模块数量，键为产品 id；未调整的模块沿用服务端口径（端点类=端点数，其余=1）。 */
const 选中数量 = ref<Record<string, number>>({});
const 选中套餐 = ref("");
const 搜索产品 = ref("");
const 展开套餐详情 = ref(true);
const 展开大类编号 = ref("");
const 显示硬件选择 = ref(false);

const 报价方式列表 = ["套餐报价", "补充功能", "自定义报价"] as const;
const 表单 = reactive({
  商机编号: "",
  端点数量: 120,
  报价方式: "套餐报价" as (typeof 报价方式列表)[number],
  报价有效期: 30,
  报价类型: "channel_distribution" as 报价类型代码,
});
const 编辑编号 = computed(() => String(路由.params.id || ""));
const 编辑单号 = ref("");
const 是标准报价 = computed(() => 表单.报价类型 === "standard");
const 报价类型名称 = computed(() => (是标准报价.value ? "标准产品报价" : "渠道分销产品报价"));
const 报价类型已锁定 = computed(() => Boolean(编辑编号.value));
/** 编辑历史报价时，只要用户没有改套餐、模块、数量或端点，就用服务端原明细保存，避免旧编码无法试算时把金额归零。 */
const 编辑已改动 = ref(false);
const 可保留原明细 = ref(false);
/** 编辑历史报价时沿用原创建日期，不能用打开页面的当天覆盖历史事实。 */
const 存档创建时间 = ref("");
/** 编辑报价时携带打开页面的版本号，服务端据此拒绝另一窗口的覆盖保存。 */
const 存档版本 = ref<number | null>(null);

const 选中商机 = computed(
  () => 商机列表.value.find((商机) => 商机.id === 表单.商机编号) || 商机列表.value[0] || null,
);

const 商机业务类型 = computed<业务类型代码>(() => 记录业务类型(选中商机.value));
const 是维保报价 = computed(() => 商机业务类型.value === "maintenance");
const 商机业务类型名称 = computed(() => 业务类型名称(商机业务类型.value, "报价"));
const 关联产品订单 = computed(() => {
  const 项 = 选中商机.value?.原始数据?.linkedProductOrders;
  return Array.isArray(项) ? (项 as Array<Record<string, unknown>>) : [];
});

/** 报价只能选择已发布且启用中的产品；下架硬件、功能和套餐不能继续进入新报价。 */
function 是可选产品(产品: 阶段9记录): boolean {
  const 原始 = (产品.原始数据 || {}) as Record<string, unknown>;
  return 产品.状态 === "active" && 原始.published !== false;
}

const 全部功能模块 = computed(() =>
  产品列表.value.filter((产品) => 产品.类型 === "功能模块" && 是可选产品(产品)),
);
const 功能模块列表 = computed(() => 全部功能模块.value.filter((产品) => !是维保报价产品(产品)));
const 维保服务列表 = computed(() => 全部功能模块.value.filter(是维保报价产品));
const 硬件产品列表 = computed(() =>
  产品列表.value.filter((产品) => 产品.类型 === "硬件产品" && 是可选产品(产品)),
);
/** 历史测试套餐可能很多：保留全部数据，但优先展示配置顺序靠前、功能完整的套餐。 */
const 套餐列表 = computed(() =>
  产品列表.value
    .filter((产品) => 产品.类型 === "产品套餐" && 是可选产品(产品))
    .sort((左, 右) => {
      const 左排序 = Number((左.原始数据 as Record<string, unknown>)?.sort);
      const 右排序 = Number((右.原始数据 as Record<string, unknown>)?.sort);
      return (
        (Number.isFinite(左排序) ? 左排序 : 9999) - (Number.isFinite(右排序) ? 右排序 : 9999) ||
        套餐功能编号(右).length - 套餐功能编号(左).length ||
        文本(左.标题).localeCompare(文本(右.标题), "zh-CN")
      );
    }),
);
const 选中套餐对象 = computed(
  () => 套餐列表.value.find((套餐) => 套餐.id === 选中套餐.value) || null,
);

/** 套餐通过 extra_json.featureIds 关联功能模块，键为功能模块 V2 编号。 */
function 套餐功能编号(套餐: 阶段9记录 | null): string[] {
  const 原始 = (套餐?.原始数据 as Record<string, unknown>) || {};
  const 列表 = 原始.featureIds;
  return Array.isArray(列表) ? (列表 as unknown[]).map((项) => String(项)) : [];
}
function 功能键(产品: 阶段9记录): string {
  const 原始 = (产品.原始数据 as Record<string, unknown>) || {};
  return 文本(原始.id, 产品.编号, 产品.id);
}

/** 存档明细按名称回填产品 id：老报价只存名称与金额，编辑态要靠 id 才能调数量、移除模块。 */
function 按名称找产品编号(名称: string): string {
  const 目标 = 名称.trim();
  if (!目标) return "";
  const 命中 = 产品列表.value.find((产品) => 文本(产品.标题, 产品.原始数据?.name).trim() === 目标);
  return 命中?.id || "";
}
/** 兼容 V2 的业务编码、V3 的 UUID 和目录原始编号，统一解析成当前产品记录。 */
function 按业务编号找产品(编号: unknown): 阶段9记录 | null {
  const 目标 = 文本(编号);
  if (!目标) return null;
  return (
    产品列表.value.find((产品) => {
      const 原始 = (产品.原始数据 as Record<string, unknown>) || {};
      return [
        产品.id,
        产品.编号,
        文本(原始.id),
        文本(原始.v2_source_id, 原始.v2SourceId),
        文本(原始.feature_code, 原始.featureCode, 原始.productCode),
        文本(原始.hardware_code, 原始.hardwareCode),
        文本(原始.package_code, 原始.packageCode),
      ].includes(目标);
    }) || null
  );
}
function 归一产品编号(编号: unknown): string {
  return 按业务编号找产品(编号)?.id || 文本(编号);
}
const 套餐功能键集合 = computed(() => new Set(套餐功能编号(选中套餐对象.value)));

/** 套餐内模块的产品 id：由套餐 featureIds（V2 功能编号）解析到产品目录后得到。 */
const 套餐内产品编号 = computed(() =>
  功能模块列表.value
    .filter((产品) => 套餐功能键集合.value.has(功能键(产品)))
    .map((产品) => 产品.id),
);

/** 当前入单模块：套餐报价=套餐内；补充功能=套餐内+手动加选；自定义报价=完全按勾选。 */
const 选中产品 = computed<string[]>(() => {
  const 可入单集合 = new Set(
    (是维保报价.value ? 维保服务列表.value : 功能模块列表.value).map((产品) => 产品.id),
  );
  if (是维保报价.value) {
    return 自定义选择.value.filter((编号) => 可入单集合.has(编号));
  }
  const 套餐内 = 套餐内产品编号.value;
  if (表单.报价方式 === "自定义报价") return 自定义选择.value;
  if (表单.报价方式 === "补充功能") {
    const 套餐内集合 = new Set(套餐内);
    return [...套餐内, ...补充功能选择.value.filter((编号) => !套餐内集合.has(编号))];
  }
  return 套餐内;
});

/** 套餐报价只出套餐内功能；补充功能出套餐内 + 套餐外可加项；自定义报价出全部功能。 */
const 可选功能列表 = computed(() => {
  if (是维保报价.value) return 维保服务列表.value;
  if (表单.报价方式 === "自定义报价") return 功能模块列表.value;
  if (表单.报价方式 === "套餐报价") {
    return 功能模块列表.value.filter((产品) => 套餐功能键集合.value.has(功能键(产品)));
  }
  return 功能模块列表.value.filter((产品) => !套餐功能键集合.value.has(功能键(产品)));
});

const 全部报价目录 = computed(() => 构建报价目录(全部功能模块.value, 产品树数据.value));
const 可选用报价目录 = computed(() => 构建报价目录(可选功能列表.value, 产品树数据.value));
const 过滤后可选目录 = computed(() => 过滤报价目录(可选用报价目录.value, 搜索产品.value));
const 当前展开大类 = computed(
  () =>
    过滤后可选目录.value.find((大类) => 大类.编号 === 展开大类编号.value) ||
    过滤后可选目录.value[0] ||
    null,
);
const 套餐目录映射 = computed(
  () =>
    new Map(
      套餐列表.value.map((套餐) => [
        套餐.id,
        筛选套餐功能目录(全部报价目录.value, 套餐功能编号(套餐)),
      ]),
    ),
);
const 当前套餐目录 = computed(() =>
  选中套餐对象.value ? 套餐目录映射.value.get(选中套餐对象.value.id) || [] : [],
);
const 当前套餐硬件 = computed(() => {
  const 编号列表 = (选中套餐对象.value?.原始数据 as Record<string, unknown> | undefined)
    ?.hardwareIds;
  if (!Array.isArray(编号列表)) return [];
  return 编号列表
    .map((编号) => 按业务编号找产品(编号))
    .filter((产品): 产品 is 阶段9记录 => Boolean(产品));
});

const 试算明细 = computed(() => 试算结果.value?.items || []);
/** 历史明细可能只有报价项 id 或名称，先回产品目录找同一产品，再判断硬件/服务。 */
function 匹配目录产品(项: 报价明细项): 阶段9记录 | null {
  const 编号 = 文本(项.id);
  const 名称 = 文本(项.名称).trim();
  return (
    产品列表.value.find((产品) => 编号 && 产品.id === 编号) ||
    产品列表.value.find((产品) => 名称 && 文本(产品.标题, 产品.原始数据?.name).trim() === 名称) ||
    null
  );
}
function 是服务产品(产品: 阶段9记录 | null): boolean {
  if (!产品) return false;
  // 维保服务使用显式分类；实施类服务再结合产品负责人和编码判断，避免仅凭名称误判软件功能。
  return (
    是维保报价产品(产品) ||
    /维保|实施|技术服务/.test(文本(产品.负责人)) ||
    /^MAINT-/.test(文本(产品.编号))
  );
}
/** 历史报价可能只保存名称，类型会落成软件产品；结合产品目录识别硬件和服务，避免展示到错误分区。 */
function 是硬件或服务明细(项: 报价明细项): boolean {
  // 维保服务单独在主区域展示，不并入普通硬件或实施服务。
  if (文本(项.categoryCode) === "CAT-MAINTENANCE") return false;
  if (项.itemTypeCode === "hardware" || 项.itemTypeCode === "service") return true;
  const 目录产品 = 匹配目录产品(项);
  if (目录产品) return 目录产品.类型 === "硬件产品" || 是服务产品(目录产品);
  const 类型文本 = 文本(项.类型);
  if (/硬件|设备|服务器|网关|探针/.test(类型文本)) return true;
  return /质保|维保|维护|实施|培训|部署|安装|售后/.test(类型文本);
}
function 明细类型(项: 报价明细项): string {
  if (文本(项.categoryCode) === "CAT-MAINTENANCE") return "维保服务";
  const 目录产品 = 匹配目录产品(项);
  if (目录产品?.类型 === "硬件产品") return "硬件产品";
  if (是服务产品(目录产品)) return "服务项";
  return 文本(项.类型, "软件产品");
}

interface 套餐组成项 {
  类型: "feature" | "hardware";
  名称: string;
  数量: number;
  状态: string;
}

/** 服务端试算结果会把套餐展开为功能与硬件组成项，但套餐价格仍只按套餐行计一次。 */
function 套餐组成(项: 报价明细项): 套餐组成项[] {
  const 组成 = 项.extraJson?.packageItems;
  if (!Array.isArray(组成)) return [];
  return 组成
    .filter((子项): 子项 is Record<string, unknown> => Boolean(子项 && typeof 子项 === "object"))
    .map((子项) => ({
      类型: 子项.类型 === "hardware" ? "hardware" : "feature",
      名称: 文本(子项.名称, "未命名组成项"),
      数量: Number(子项.数量) || 1,
      状态: 文本(子项.状态),
    }));
}
const 硬件明细 = computed(() => 试算明细.value.filter(是硬件或服务明细));
const 软件明细 = computed(() => 试算明细.value.filter((项) => !是硬件或服务明细(项)));
const 软件小计 = computed(() =>
  软件明细.value.reduce((合计, 项) => 合计 + Number(项.小计 || 0), 0),
);
const 已选软件分组 = computed(() => 分组已选报价明细(软件明细.value, 全部报价目录.value));
const 硬件小计 = computed(() =>
  硬件明细.value.reduce((合计, 项) => 合计 + Number(项.小计 || 0), 0),
);
const 合计 = computed(() => Number(试算结果.value?.total || 0));
const 历史缺价序号 = computed(() =>
  是标准报价.value
    ? new Set<number>()
    : 计算历史缺价序号(
        试算明细.value.map((项) => ({ 单价: 项.单价, 小计: 项.小计 })),
        合计.value,
      ),
);
const 历史明细缺失价格 = computed(() => 历史缺价序号.value.size > 0);
const 报价日期 = computed(() => 日期文本(存档创建时间.value || new Date().toISOString()));
const 定价上下文 = computed(() => 试算结果.value?.定价上下文 || null);
const 渠道价格参考 = computed(() => 试算结果.value?.渠道价格参考 || null);
const 价格命中说明 = computed(() => {
  const 命中集合 = new Set<string>();
  for (const 项 of 试算明细.value) {
    for (const 说明 of 项.定价明细?.命中说明 || []) 命中集合.add(说明);
  }
  return [...命中集合];
});
// 等级价系数来自服务端：一级为基准 100%，二级在一级基础上上浮 10%。
const 等级价系数说明 = computed(() => {
  const 系数 = 定价上下文.value?.等级价系数;
  if (系数 === null || 系数 === undefined) return "无分销等级，不套用等级价";
  const 名称 = 定价上下文.value?.渠道层级名称 || "分销等级";
  return 系数 === 100 ? `${名称}基准价 ×100%` : `${名称} ×${系数}%（一级上浮 10%）`;
});
// 来源商机编号：优先取地址栏参数（从商机页跳转），其次取编辑报价单里存档的关联商机。
const 存档商机编号 = ref("");
const 返回商机编号 = computed(() => 文本(路由.query.opportunityId) || 存档商机编号.value);

const 硬件数量列表 = computed(() =>
  是维保报价.value ? [] : Object.entries(选中硬件.value).filter(([, 数量]) => Number(数量) > 0),
);

function 定价明细(项: 报价明细项): 产品定价明细 | null {
  return 项.定价明细 || null;
}

/** 阶梯越界提示：服务端在命中说明里回传「超出最高档 / 低于最低档」，在方格上直接标出来。 */
function 越档提示(项: 报价明细项): string {
  const 说明 = 项.定价明细?.命中说明 || [];
  return 说明.find((条) => /超出.*最高档|低于.*最低档/.test(条)) || "";
}
function 金额(值: unknown): string {
  const 数值 = Number(值);
  if (!Number.isFinite(数值)) return "—";
  return `¥ ${数值.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
/** 0 元也要显示为金额（例如赠送质保服务），不能用 金额文本 的「—」兜底。 */
function 金额或短横(值: unknown): string {
  const 数值 = Number(值);
  if (!Number.isFinite(数值)) return "—";
  return 金额(数值);
}
function 明细金额(项: 报价明细项, 值: unknown): string {
  return 历史缺价序号.value.has(试算明细.value.indexOf(项)) ? "历史未记录" : 金额或短横(值);
}
function 单价列(项: 报价明细项, 键: "标准单价" | "区域覆盖单价" | "最终单价"): string {
  const 明细 = 定价明细(项);
  if (!明细) return "—";
  const 值 = 明细[键];
  return 值 === null || 值 === undefined ? "—" : 金额(值);
}
function 比例列(项: 报价明细项): string {
  const 明细 = 定价明细(项);
  if (!明细 || 明细.渠道比例 === null) return "—";
  return `${明细.渠道比例}%`;
}

/** 维保报价不参与套餐组合，只保留维保服务项选择。 */
function 同步业务类型选择() {
  const 允许集合 = new Set(
    (是维保报价.value ? 维保服务列表.value : 功能模块列表.value).map((产品) => 产品.id),
  );
  自定义选择.value = 自定义选择.value.filter((编号) => 允许集合.has(编号));
  if (!是维保报价.value) return;
  表单.报价方式 = "自定义报价";
  选中套餐.value = "";
  补充功能选择.value = [];
  选中硬件.value = {};
  自定义已引导.value = true;
}

function 规范报价类型(值: unknown): 报价类型代码 {
  return ["standard", "标准", "标准产品报价", "标准报价"].includes(String(值 ?? "").trim())
    ? "standard"
    : "channel_distribution";
}

/** 报价类型决定是否展示价格；创建后不允许切换，避免同一报价的取价口径变化。 */
function 选择报价类型(类型: 报价类型代码) {
  if (报价类型已锁定.value || 表单.报价类型 === 类型) return;
  表单.报价类型 = 类型;
  试算结果.value = null;
  触发试算();
}

function 切换商机() {
  同步业务类型选择();
  触发试算();
}

onMounted(async () => {
  表单.报价类型 = 规范报价类型(路由.query.quoteTypeCode);
  const [商机, 产品, 产品树, 报价] = await Promise.all([
    查询阶段9全部("opportunities").catch(() => ({ 数据: [] as 阶段9记录[], 总数: 0 })),
    查询阶段9全部("products").catch(() => ({ 数据: [] as 阶段9记录[], 总数: 0 })),
    查询产品树().catch(() => [] as 产品树大类[]),
    编辑编号.value
      ? 查询阶段9全部("quotes").catch(() => ({ 数据: [] as 阶段9记录[], 总数: 0 }))
      : Promise.resolve({ 数据: [] as 阶段9记录[], 总数: 0 }),
  ]);
  商机列表.value = 商机.数据;
  产品列表.value = 产品.数据;
  产品树数据.value = 产品树;

  const 待编辑 = 编辑编号.value ? 报价.数据.find((row) => row.id === 编辑编号.value) : undefined;
  if (待编辑) {
    const 存档 = (待编辑.原始数据 as Record<string, unknown>) || {};
    表单.报价类型 = 规范报价类型(存档.quoteTypeCode);
    const 版本值 = Number(取数(存档.rowVersion, 存档.row_version));
    存档版本.value = Number.isInteger(版本值) && 版本值 >= 0 ? 版本值 : null;
    编辑单号.value = 文本(存档.quoteNo, 待编辑.编号);
    存档创建时间.value = 待编辑.创建时间;
    存档商机编号.value = 文本(存档.opportunityId, 存档.opportunityUuid);
    表单.商机编号 = (文本(存档.opportunityId, 存档.opportunityUuid) || 商机列表.value[0]?.id) ?? "";
    同步业务类型选择();
    表单.端点数量 = Number(取数(存档.endpoints, 存档.端点数)) || 表单.端点数量;
    表单.报价有效期 = Number(取数(存档.validDays, 存档.有效期)) || 表单.报价有效期;
    const 存档方式 = 文本(存档.quoteMode, 存档.报价方式);
    if (!是维保报价.value && (报价方式列表 as readonly string[]).includes(存档方式)) {
      表单.报价方式 = 存档方式 as (typeof 报价方式列表)[number];
    }
    const 新格式产品 = Array.isArray(存档.productIds) ? (存档.productIds as unknown[]) : [];
    const 旧格式产品 = Array.isArray(存档.products) ? (存档.products as unknown[]) : [];
    const 存档产品 = [
      ...new Set((新格式产品.length ? 新格式产品 : 旧格式产品).map(归一产品编号).filter(Boolean)),
    ];
    const 允许入单集合 = new Set(
      (是维保报价.value ? 维保服务列表.value : 功能模块列表.value).map((产品) => 产品.id),
    );
    const 可回填产品 = 存档产品.filter((编号) => 允许入单集合.has(编号));
    const 存档套餐 = 文本(存档.packageId);
    const 存档套餐对象 = 按业务编号找产品(存档套餐);
    if (存档套餐对象?.类型 === "产品套餐") 选中套餐.value = 存档套餐对象.id;
    // 套餐已被删除或编码无法映射时，退回自定义报价并使用存档产品，保证明细不丢。
    if (表单.报价方式 !== "自定义报价" && !存档套餐对象 && 可回填产品.length) {
      表单.报价方式 = "自定义报价";
    }
    // 套餐内模块由套餐还原；补充加选与自定义勾选分别回到各自清单，避免相互覆盖。
    if (表单.报价方式 === "自定义报价") {
      自定义选择.value = [...可回填产品];
      自定义已引导.value = true;
    } else if (表单.报价方式 === "补充功能") {
      const 套餐内集合 = new Set(套餐内产品编号.value);
      补充功能选择.value = 可回填产品.filter((编号) => !套餐内集合.has(编号));
    }
    const 新格式硬件 = Array.isArray(存档.hardwareItems) ? (存档.hardwareItems as unknown[]) : [];
    const 旧格式硬件 = Array.isArray(存档.hardwareIds) ? (存档.hardwareIds as unknown[]) : [];
    const 存档硬件 = 新格式硬件.length ? 新格式硬件 : 旧格式硬件;
    if (存档硬件.length) {
      const 硬件映射: Record<string, number> = {};
      for (const 项 of 存档硬件) {
        const 记录 = 项 && typeof 项 === "object" ? (项 as Record<string, unknown>) : null;
        const 编号 = 记录 ? 文本(记录.productId, 记录.hardwareId, 记录.id) : 文本(项);
        const 命中 = 按业务编号找产品(编号);
        if (命中?.类型 !== "硬件产品") continue;
        硬件映射[命中.id] = Math.max(
          1,
          Math.floor(Number(记录 ? 取数(记录.quantity, 记录.数量) : 1) || 1),
        );
      }
      选中硬件.value = 硬件映射;
    }
    // 编辑模式先展示该报价已保存的明细，避免用试算结果覆盖历史成交口径；用户可点「重新试算」刷新。
    const 存档明细 = Array.isArray(存档.items)
      ? (存档.items as Array<Record<string, unknown>>)
      : [];
    const 快照 = (存档.workloadSnapshot as Record<string, unknown>) || {};
    const 快照明细 = Array.isArray(快照.items)
      ? (快照.items as Array<Record<string, unknown>>)
      : [];
    const 明细来源 = 存档明细.length ? 存档明细 : 快照明细;
    if (明细来源.length) {
      const 规范明细: 报价明细项[] = 明细来源.map((项) => ({
        名称: 文本(项.名称, 项.name, 项.itemName, "未命名模块"),
        // 存档明细只保存名称与金额，缺 id 时按名称回填，编辑态才能调整数量与移除模块。
        id: 文本(项.id, 项.productRefId) || 按名称找产品编号(文本(项.名称, 项.name, 项.itemName)),
        类型: 文本(项.类型, 项.type, "功能模块"),
        categoryCode: 文本(项.categoryCode, 项.category_code),
        数量: Number(取数(项.数量, 项.quantity)) || 0,
        单价: Number(取数(项.单价, 项.unitPrice)) || 0,
        小计: Number(取数(项.小计, 项.lineAmount)) || 0,
      }));
      试算结果.value = {
        endpoints: 表单.端点数量,
        productIds: 存档产品,
        hardwareIds: [],
        items: 规范明细,
        total: Number(取数(存档.total, 待编辑.金额)) || 0,
        workloadDays: 0,
        workloadSummary: 文本(存档.workloadSummary),
      };
      可保留原明细.value = true;
    } else {
      await 试算();
    }
    编辑已改动.value = false;
  } else {
    const 预选商机 = 文本(路由.query.opportunityId);
    表单.商机编号 =
      (商机列表.value.some((row) => row.id === 预选商机) ? 预选商机 : "") ||
      商机列表.value[0]?.id ||
      "";
    同步业务类型选择();
    const 预选套餐 = 文本(路由.query.packageId);
    if (预选套餐 && 套餐列表.value.some((套餐) => 套餐.id === 预选套餐)) {
      选中套餐.value = 预选套餐;
      应用套餐(选中套餐.value);
    }
    await 试算();
  }
});

/** 用户主动改价时解除“保留原明细”，确保重新试算和保存走同一次真实选择。 */
function 标记编辑改动() {
  if (编辑编号.value) 编辑已改动.value = true;
}

function 触发试算() {
  标记编辑改动();
  void 试算();
}

/**
 * 选中基础套餐：只切换套餐本身并重算，不清空用户已勾选内容。
 * 补充加选与自定义勾选分别保存在各自清单里，切回对应模式即可恢复。
 */
function 应用套餐(编号: string) {
  if (是维保报价.value) return;
  if (!套餐列表.value.some((项) => 项.id === 编号)) return;
  选中套餐.value = 编号;
  展开套餐详情.value = true;
  触发试算();
}

/** 查看套餐功能：切换套餐时同步选中并展开，已选套餐再次点击则收起详情。 */
function 切换套餐详情(编号: string) {
  if (是维保报价.value) return;
  if (选中套餐.value !== 编号) {
    应用套餐(编号);
    return;
  }
  展开套餐详情.value = !展开套餐详情.value;
}

/** 切换报价方式只改变入单口径，不再重算并覆盖用户已勾选的模块（对齐旧 UI）。 */
function 切换报价方式(方式: (typeof 报价方式列表)[number]) {
  if (是维保报价.value) return;
  const 切换前模块 = [...选中产品.value];
  表单.报价方式 = 方式;
  搜索产品.value = "";
  展开大类编号.value = "";
  展开套餐详情.value = true;
  if (方式 === "自定义报价") {
    // 首次进入自定义报价时用当前报价内容引导一次，之后完全按用户勾选
    if (!自定义已引导.value) {
      自定义选择.value = 切换前模块;
      自定义已引导.value = true;
    }
  }
  触发试算();
}

async function 试算() {
  if (!表单.商机编号) return;
  试算中.value = true;
  try {
    试算结果.value = await 试算报价({
      opportunityId: 表单.商机编号,
      endpoints: Number(表单.端点数量) || 1,
      productIds: 选中产品.value,
      hardwareItems: 硬件数量列表.value.map(([productId, quantity]) => ({ productId, quantity })),
      itemQuantities: 选中数量.value,
      quoteMode: 是维保报价.value ? "自定义报价" : 表单.报价方式,
      validDays: Number(表单.报价有效期) || 30,
      packageId: 是维保报价.value ? "" : 选中套餐.value,
      quoteTypeCode: 表单.报价类型,
    });
  } catch (异常) {
    ElMessage.error(异常 instanceof Error ? 异常.message : "试算失败。");
  } finally {
    试算中.value = false;
  }
}

function 是否已选(产品: 阶段9记录): boolean {
  return 选中产品.value.includes(产品.id);
}

/** 套餐详情直接复用目录结构，功能仍按类型、模块和选择值一一对应。 */
function 套餐功能列表(套餐: 阶段9记录): 报价目录功能[] {
  return (套餐目录映射.value.get(套餐.id) || []).flatMap((大类) =>
    大类.模块.flatMap((模块) => 模块.功能),
  );
}

/** 套餐硬件按 business code、UUID 或展示编号统一解析，兼容历史 V2 套餐。 */
function 套餐硬件列表(套餐: 阶段9记录): 阶段9记录[] {
  const 编号列表 = (套餐.原始数据 as Record<string, unknown> | undefined)?.hardwareIds;
  if (!Array.isArray(编号列表)) return [];
  return 编号列表
    .map((编号) => 按业务编号找产品(编号))
    .filter((产品): 产品 is 阶段9记录 => Boolean(产品));
}

function 套餐预览功能(套餐: 阶段9记录): 报价目录功能[] {
  return 套餐功能列表(套餐).slice(0, 4);
}

function 目录功能数量(大类: 报价目录大类): number {
  return 大类.模块.reduce((合计, 模块) => 合计 + 模块.功能.length, 0);
}

function 模块功能数量(模块: 报价目录模块): number {
  return 模块.功能.length;
}

function 目录已选数量(大类: 报价目录大类): number {
  return 大类.模块.reduce(
    (合计, 模块) => 合计 + 模块.功能.filter((功能) => 是否已选(功能.产品)).length,
    0,
  );
}

function 模块已选数量(模块: 报价目录模块): number {
  return 模块.功能.filter((功能) => 是否已选(功能.产品)).length;
}

/** 套餐报价下套餐内模块属于标准组合，不允许在报价单里单独移除。 */
function 可移除(项: 报价明细项): boolean {
  if (是维保报价.value) return Boolean(项.id) && 选中产品.value.includes(项.id);
  if (表单.报价方式 === "套餐报价") return false;
  // 补充功能下套餐内模块同样属于标准组合，只有手动加选的模块可以移除（与旧 UI 一致）。
  if (表单.报价方式 === "补充功能" && 套餐内产品编号.value.includes(项.id)) return false;
  return Boolean(项.id) && 选中产品.value.includes(项.id);
}

/** 写入单个模块数量并重新试算（价格阶梯、渠道比例都按新数量重算）。 */
function 设置模块数量(项: 报价明细项, 数值: number) {
  if (!项.id || !Number.isFinite(数值) || 数值 <= 0) {
    ElMessage.warning("模块数量必须是大于 0 的整数。");
    return;
  }
  const 下一个 = { ...选中数量.value };
  if (数值 === Number(项.数量)) delete 下一个[项.id];
  else 下一个[项.id] = 数值;
  选中数量.value = 下一个;
  触发试算();
}

/** 模块方格的 −/＋ 步进：以当前生效数量为基准，最小为 1。 */
function 步进数量(项: 报价明细项, 步长: number) {
  设置模块数量(项, Math.max(1, Math.floor(Number(项.数量 || 1)) + 步长));
}

/** 硬件方格的 −/＋ 步进：复用硬件数量写入逻辑。 */
function 步进硬件数量(项: 报价明细项, 步长: number) {
  设置硬件数量(
    项.id,
    Math.max(1, Math.floor(Number(选中硬件.value[项.id] || 项.数量 || 1)) + 步长),
  );
}

function 调整数量(项: 报价明细项, 事件: Event) {
  const 输入框 = 事件.target as HTMLInputElement | null;
  const 数值 = Math.floor(Number(输入框?.value));
  if (!项.id || !Number.isFinite(数值) || 数值 <= 0) {
    if (输入框) 输入框.value = String(项.数量 || 1);
    ElMessage.warning("模块数量必须是大于 0 的整数。");
    return;
  }
  设置模块数量(项, 数值);
}

function 移除模块(项: 报价明细项) {
  if (!可移除(项) || !项.id) return;
  if (表单.报价方式 === "自定义报价") {
    自定义选择.value = 自定义选择.value.filter((编号) => 编号 !== 项.id);
  } else {
    补充功能选择.value = 补充功能选择.value.filter((编号) => 编号 !== 项.id);
  }
  触发试算();
}

/** 勾选/取消模块：按当前报价方式写入对应清单，套餐内模块固定不可勾选。 */
function 切换产品(编号: string) {
  if (是维保报价.value || 表单.报价方式 === "自定义报价") {
    自定义选择.value = 自定义选择.value.includes(编号)
      ? 自定义选择.value.filter((项) => 项 !== 编号)
      : [...自定义选择.value, 编号];
  } else if (表单.报价方式 === "补充功能") {
    补充功能选择.value = 补充功能选择.value.includes(编号)
      ? 补充功能选择.value.filter((项) => 项 !== 编号)
      : [...补充功能选择.value, 编号];
  } else {
    // 套餐报价下套餐内模块固定，勾选面板里的模块本来就是禁用态，这里直接忽略。
    return;
  }
  触发试算();
}

function 切换硬件(编号: string) {
  if (是维保报价.value) return;
  if (选中硬件.value[编号]) {
    选中硬件.value = Object.fromEntries(
      Object.entries(选中硬件.value).filter(([键]) => 键 !== 编号),
    );
  } else {
    选中硬件.value = { ...选中硬件.value, [编号]: 1 };
  }
  触发试算();
}

function 设置硬件数量(编号: string, 数量: unknown) {
  const 数值 = Math.max(1, Math.floor(Number(数量) || 1));
  选中硬件.value = { ...选中硬件.value, [编号]: 数值 };
  触发试算();
}

function 返回商机() {
  const 编号 = 返回商机编号.value;
  路由器.push(
    编号
      ? `${外壳前缀.value}/opportunity?opportunityId=${encodeURIComponent(编号)}`
      : `${外壳前缀.value}/opportunity`,
  );
}

async function 提交() {
  if (提交中.value) return;
  if (!表单.商机编号) {
    ElMessage.warning("请先选择关联商机");
    return;
  }
  const 端点数量 = Number(表单.端点数量);
  if (!Number.isInteger(端点数量) || 端点数量 < 1 || 端点数量 > 100_000_000) {
    ElMessage.warning("端点数量必须是 1 至 100000000 之间的整数");
    return;
  }
  提交中.value = true;
  try {
    const 载荷 = {
      opportunityId: 表单.商机编号,
      endpoints: 端点数量,
      productIds: 选中产品.value,
      hardwareItems: 硬件数量列表.value.map(([productId, quantity]) => ({ productId, quantity })),
      // 逐项数量必须随保存一起提交，否则服务端按端点数量重算，界面手工调整的单模块数量会丢失。
      itemQuantities: 选中数量.value,
      quoteMode: 是维保报价.value ? "自定义报价" : 表单.报价方式,
      validDays: Number(表单.报价有效期) || 30,
      packageId: 是维保报价.value ? "" : 选中套餐.value,
      quoteTypeCode: 表单.报价类型,
      preserveExistingItems: Boolean(编辑编号.value && 可保留原明细.value && !编辑已改动.value),
      ...(编辑编号.value && 存档版本.value !== null ? { rowVersion: 存档版本.value } : {}),
    };
    if (编辑编号.value) {
      await 更新报价(编辑编号.value, 载荷);
      ElMessage.success("报价单已更新");
    } else {
      await 创建报价(载荷);
      ElMessage.success("报价单已生成");
    }
    路由器.push(
      `${外壳前缀.value}/opportunity${
        返回商机编号.value ? `?opportunityId=${encodeURIComponent(返回商机编号.value)}` : ""
      }`,
    );
  } catch (异常) {
    ElMessage.error(异常 instanceof Error ? 异常.message : "生成报价失败。");
  } finally {
    提交中.value = false;
  }
}
</script>

<template>
  <div class="vui war-artboard-plain 新建报价页">
    <header class="war-form-head">
      <div>
        <button class="返回按钮" type="button" @click="返回商机">
          ← {{ 返回商机编号 ? "返回商机" : "返回商机列表" }}
        </button>
        <h1>{{ 编辑编号 ? "编辑报价单" : "新建 / 编辑报价单" }}</h1>
        <p>
          {{
            编辑单号
              ? `报价单 ${编辑单号}：已回填关联商机、端点数量与产品选择，保存后更新该报价。`
              : 是标准报价
                ? "标准产品报价不展示价格；产品、数量和工作量照常保存，最终订单价格由区管在审批环节补充。"
                : "渠道分销产品报价按标准价、区域覆盖价和渠道等级价由服务端试算。"
          }}
        </p>
      </div>
      <div class="button-row">
        <button type="button" class="button" :disabled="试算中" @click="触发试算">重新试算</button>
        <button type="button" class="button primary" :disabled="提交中" @click="提交">
          {{ 编辑编号 ? "保存报价单" : "生成报价单" }}
        </button>
      </div>
    </header>

    <section class="panel 报价方式顶部面板">
      <header class="panel-head">
        <div>
          <h2>报价方式</h2>
          <p>
            {{
              是维保报价
                ? "按产品大类、模块选择维保服务，选中内容进入下方报价清单"
                : "按报价方式、功能模块、具体功能逐级选择，可选内容全部在本面板内完成"
            }}
          </p>
        </div>
        <div class="报价类型标签组">
          <span class="报价体系标签" :class="{ 标准: 是标准报价 }">{{ 报价类型名称 }}</span>
          <span class="报价业务类型标签" :class="{ 维保: 是维保报价 }">{{ 商机业务类型名称 }}</span>
        </div>
      </header>
      <div class="panel-body 报价方式内容">
        <section class="报价类型选择区">
          <header class="quote-choice-head">
            <div>
              <h3>报价体系</h3>
              <p>标准产品报价全程免价；渠道分销产品报价展示本渠道适用价格。</p>
            </div>
            <span v-if="报价类型已锁定" class="quote-choice-meta">已锁定，不可切换</span>
          </header>
          <div v-if="!报价类型已锁定" class="quote-type-grid">
            <button
              type="button"
              class="quote-type-card"
              :class="{ active: 是标准报价 }"
              @click="选择报价类型('standard')"
            >
              <span class="quote-type-icon">标</span>
              <span class="quote-type-copy">
                <strong>标准产品报价</strong>
                <small>不展示任何价格，转单后由区管补价</small>
              </span>
              <span v-if="是标准报价" class="quote-type-check">✓</span>
            </button>
            <button
              type="button"
              class="quote-type-card"
              :class="{ active: !是标准报价 }"
              @click="选择报价类型('channel_distribution')"
            >
              <span class="quote-type-icon 渠道">渠</span>
              <span class="quote-type-copy">
                <strong>渠道分销产品报价</strong>
                <small>按区域覆盖和分销等级自动取价</small>
              </span>
              <span v-if="!是标准报价" class="quote-type-check">✓</span>
            </button>
          </div>
          <div v-else class="quote-type-locked">
            <strong>{{ 报价类型名称 }}</strong>
            <span>{{
              是标准报价
                ? "该报价全链路不展示价格，订单价格由区管补充。"
                : "该报价按渠道分销价格规则展示和保存。"
            }}</span>
          </div>
        </section>
        <div v-if="是维保报价" class="callout success">
          <p>当前商机为维保商机，报价只能包含维保服务项，不能混入软件、硬件或普通实施服务。</p>
          <p v-if="关联产品订单.length">
            关联产品订单：{{ 关联产品订单.map((订单) => 文本(订单.orderNo, 订单.id)).join("、") }}
          </p>
        </div>
        <template v-if="!是维保报价">
          <div class="quote-mode-grid">
            <button
              v-for="方式 in 报价方式列表"
              :key="方式"
              type="button"
              class="quote-mode"
              :class="{ active: 表单.报价方式 === 方式 }"
              @click="切换报价方式(方式)"
            >
              <span class="quote-mode-icon" aria-hidden="true">{{
                方式 === "套餐报价" ? "📦" : 方式 === "补充功能" ? "➕" : "🎨"
              }}</span>
              <span class="quote-mode-copy">
                <strong>{{ 方式 }}</strong>
                <small>{{
                  方式 === "套餐报价"
                    ? "选择标准套餐"
                    : 方式 === "补充功能"
                      ? "在套餐基础上增加功能"
                      : "自由组合全部功能"
                }}</small>
              </span>
              <span v-if="表单.报价方式 === 方式" class="quote-mode-check" aria-label="当前报价方式"
                >✓</span
              >
            </button>
          </div>
        </template>

        <section
          v-if="!是维保报价 && 表单.报价方式 !== '自定义报价'"
          class="quote-choice-section 套餐选择区"
        >
          <header class="quote-choice-head">
            <div>
              <h3>选择产品套餐</h3>
              <p>套餐内功能会作为标准组合进入报价，切换套餐后重新试算。</p>
            </div>
            <span v-if="选中套餐对象" class="quote-choice-meta"
              >已选 {{ 文本(选中套餐对象.标题, "未命名套餐") }}</span
            >
          </header>
          <div class="quote-package-grid">
            <article
              v-for="套餐 in 套餐列表"
              :key="套餐.id"
              class="quote-package-card"
              :class="{ active: 选中套餐 === 套餐.id }"
            >
              <button type="button" class="quote-package-select" @click="应用套餐(套餐.id)">
                <span class="quote-package-icon" aria-hidden="true">📦</span>
                <span class="quote-package-copy">
                  <strong>{{ 文本(套餐.标题, "未命名套餐") }}</strong>
                  <small
                    >{{ 套餐功能列表(套餐).length }} 个功能<template
                      v-if="套餐硬件列表(套餐).length"
                    >
                      · {{ 套餐硬件列表(套餐).length }} 个硬件</template
                    ></small
                  >
                </span>
                <span class="quote-package-state">{{
                  选中套餐 === 套餐.id ? "已选" : "选择"
                }}</span>
              </button>
              <div class="quote-package-tags">
                <span v-for="功能 in 套餐预览功能(套餐)" :key="功能.编号">{{ 功能.名称 }}</span>
                <span v-if="套餐功能列表(套餐).length > 套餐预览功能(套餐).length"
                  >+{{ 套餐功能列表(套餐).length - 套餐预览功能(套餐).length }}</span
                >
              </div>
              <button
                type="button"
                class="quote-package-detail-link"
                @click="切换套餐详情(套餐.id)"
              >
                {{ 选中套餐 === 套餐.id && 展开套餐详情 ? "收起套餐功能" : "查看套餐功能" }}
                <span aria-hidden="true">{{
                  选中套餐 === 套餐.id && 展开套餐详情 ? "▴" : "▾"
                }}</span>
              </button>
            </article>
            <p v-if="!套餐列表.length" class="war-note">
              暂无可用套餐，请联系管理员在产品目录配置。
            </p>
          </div>

          <div
            v-if="选中套餐对象 && (当前套餐目录.length || 当前套餐硬件.length) && 展开套餐详情"
            class="quote-catalog-detail 套餐功能详情"
          >
            <header class="quote-catalog-detail-head">
              <span class="quote-catalog-detail-icon" aria-hidden="true">📦</span>
              <div>
                <strong>{{ 文本(选中套餐对象.标题, "当前套餐") }}</strong>
                <small>套餐包含的全部功能与硬件，已锁定进入报价清单</small>
              </div>
              <span class="quote-catalog-detail-count"
                >{{
                  当前套餐目录.reduce((合计, 大类) => 合计 + 目录功能数量(大类), 0)
                }}
                个功能<template v-if="当前套餐硬件.length">
                  · {{ 当前套餐硬件.length }} 个硬件</template
                ></span
              >
            </header>
            <div class="quote-catalog-module-list">
              <section
                v-for="大类 in 当前套餐目录"
                :key="大类.编号"
                class="quote-catalog-module-group"
              >
                <header class="quote-catalog-module-head">
                  <strong
                    ><span aria-hidden="true">{{ 大类.图标 || "📦" }}</span
                    >{{ 大类.名称 }}</strong
                  >
                  <small>{{ 大类.模块.length }} 个模块</small>
                </header>
                <div v-for="模块 in 大类.模块" :key="模块.编号" class="quote-catalog-module">
                  <div class="quote-catalog-module-title">
                    <strong
                      ><span aria-hidden="true">{{ 模块.图标 || "📋" }}</span
                      >{{ 模块.名称 }}</strong
                    >
                    <span>{{ 模块功能数量(模块) }} 个功能</span>
                  </div>
                  <div class="quote-feature-pills">
                    <span
                      v-for="功能 in 模块.功能"
                      :key="功能.编号"
                      class="quote-feature-pill 已选 锁定"
                    >
                      <span class="quote-feature-check" aria-hidden="true">✓</span>
                      <span>{{ 功能.名称 }}</span>
                      <small>套餐内</small>
                    </span>
                  </div>
                </div>
              </section>
            </div>
            <div v-if="当前套餐硬件.length" class="套餐硬件清单">
              <header>
                <strong>套餐内硬件</strong>
                <span>{{ 当前套餐硬件.length }} 项</span>
              </header>
              <div class="quote-feature-pills">
                <span
                  v-for="硬件 in 当前套餐硬件"
                  :key="硬件.id"
                  class="quote-feature-pill 已选 锁定"
                >
                  <span class="quote-feature-check" aria-hidden="true">✓</span>
                  <span>{{ 文本(硬件.标题, "未命名硬件") }}</span>
                  <small>套餐内</small>
                </span>
              </div>
            </div>
          </div>
          <p
            v-else-if="选中套餐对象 && !当前套餐目录.length && !当前套餐硬件.length"
            class="war-note"
          >
            当前套餐暂无可匹配的功能或硬件明细，请联系管理员检查套餐与产品目录配置。
          </p>
        </section>

        <section
          v-if="是维保报价 || 表单.报价方式 !== '套餐报价'"
          class="quote-choice-section 功能选择区"
        >
          <header class="quote-choice-head">
            <div>
              <h3>
                {{
                  是维保报价
                    ? "选择维保服务"
                    : 表单.报价方式 === "补充功能"
                      ? "选择补充功能"
                      : "选择功能模块"
                }}
              </h3>
              <p>
                {{
                  是维保报价
                    ? "点击产品大类，在下方按模块展开具体维保服务。"
                    : 表单.报价方式 === "补充功能"
                      ? "仅展示当前套餐未包含的功能，点击功能即可加入补充清单。"
                      : "点击产品大类，在下方按模块展开具体功能；已选功能进入报价清单。"
                }}
              </p>
            </div>
            <span class="quote-choice-meta">{{ 可选功能列表.length }} 个可选</span>
          </header>

          <div class="quote-catalog-toolbar">
            <input
              v-model="搜索产品"
              class="form-control"
              :placeholder="
                是维保报价 ? '搜索维保服务、模块或编码' : '搜索功能名称、所属模块或业务编码'
              "
            />
            <span>当前展示 {{ 过滤后可选目录.length }} 个产品大类</span>
          </div>

          <div v-if="过滤后可选目录.length" class="quote-category-grid">
            <button
              v-for="大类 in 过滤后可选目录"
              :key="大类.编号"
              type="button"
              class="quote-category-card"
              :class="{ active: 当前展开大类?.编号 === 大类.编号 }"
              :aria-expanded="当前展开大类?.编号 === 大类.编号"
              @click="展开大类编号 = 大类.编号"
            >
              <span class="quote-category-icon" aria-hidden="true">{{ 大类.图标 || "📦" }}</span>
              <span class="quote-category-copy">
                <strong>{{ 大类.名称 }}</strong>
                <small>{{ 大类.模块.length }} 个模块 · {{ 目录功能数量(大类) }} 个功能</small>
              </span>
              <span v-if="目录已选数量(大类)" class="quote-category-count"
                >已选 {{ 目录已选数量(大类) }}</span
              >
              <span class="quote-category-arrow" aria-hidden="true">{{
                当前展开大类?.编号 === 大类.编号 ? "▴" : "▾"
              }}</span>
            </button>
          </div>

          <div v-if="当前展开大类" class="quote-catalog-detail">
            <header class="quote-catalog-detail-head">
              <span class="quote-catalog-detail-icon" aria-hidden="true">{{
                当前展开大类.图标 || "📦"
              }}</span>
              <div>
                <strong>{{ 当前展开大类.名称 }}</strong>
                <small>点击具体功能后立即加入或移出当前报价</small>
              </div>
              <span class="quote-catalog-detail-count"
                >{{ 当前展开大类.模块.length }} 个模块 ·
                {{ 目录功能数量(当前展开大类) }} 个功能</span
              >
            </header>
            <div class="quote-catalog-module-list">
              <section
                v-for="模块 in 当前展开大类.模块"
                :key="模块.编号"
                class="quote-catalog-module"
              >
                <div class="quote-catalog-module-title">
                  <strong
                    ><span aria-hidden="true">{{ 模块.图标 || "📋" }}</span
                    >{{ 模块.名称 }}</strong
                  >
                  <span>已选 {{ 模块已选数量(模块) }} / {{ 模块功能数量(模块) }} 个功能</span>
                </div>
                <div class="quote-feature-pills">
                  <button
                    v-for="功能 in 模块.功能"
                    :key="功能.编号"
                    type="button"
                    class="quote-feature-pill"
                    :class="{ 已选: 是否已选(功能.产品) }"
                    :aria-pressed="是否已选(功能.产品)"
                    @click="切换产品(功能.编号)"
                  >
                    <span class="quote-feature-check" aria-hidden="true">{{
                      是否已选(功能.产品) ? "✓" : "＋"
                    }}</span>
                    <span>{{ 功能.名称 }}</span>
                  </button>
                </div>
              </section>
            </div>
          </div>

          <p v-else class="war-note">
            {{
              是维保报价
                ? "产品目录暂无可匹配的维保服务项。"
                : 表单.报价方式 === "补充功能"
                  ? "该套餐已覆盖全部可选功能，或搜索条件没有匹配项。"
                  : "没有匹配的产品功能，请调整搜索条件。"
            }}
          </p>
        </section>
      </div>
    </section>

    <div class="quote-builder-layout">
      <aside class="quote-builder-side">
        <section class="panel">
          <header class="panel-head">
            <div>
              <h2>报价对象</h2>
              <p>客户、商机与价格上下文</p>
            </div>
          </header>
          <div class="panel-body">
            <div class="quote-field-list">
              <div>
                <span>关联商机</span>
                <select v-model="表单.商机编号" class="form-control" @change="切换商机">
                  <option value="">请选择商机</option>
                  <option v-for="商机 in 商机列表" :key="商机.id" :value="商机.id">
                    {{ 文本(商机.标题, 商机.客户名称) }}（{{ 商机.编号 }}）
                  </option>
                </select>
              </div>
              <div>
                <span>客户名称</span><strong>{{ 文本(选中商机?.客户名称, "未关联") }}</strong>
              </div>
              <div>
                <span>报价业务类型</span><strong>{{ 商机业务类型名称 }}</strong>
              </div>
              <div>
                <span>端点数量</span>
                <input v-model="表单.端点数量" class="form-control" @change="触发试算" />
              </div>
              <div>
                <span>归属区域</span>
                <strong>{{ 文本(定价上下文?.区域, 选中商机?.区域, "未填写") }}</strong>
              </div>
              <div>
                <span>渠道层级</span>
                <strong>{{ 文本(定价上下文?.渠道层级名称, "试算后生成") }}</strong>
              </div>
              <div v-if="!是标准报价">
                <span>等级价系数</span>
                <strong>{{ 等级价系数说明 }}</strong>
              </div>
              <div>
                <span>报价有效期</span>
                <select v-model.number="表单.报价有效期" class="form-control">
                  <option :value="15">15 天</option>
                  <option :value="30">30 天</option>
                  <option :value="60">60 天</option>
                  <option :value="90">90 天</option>
                </select>
              </div>
              <div v-if="是维保报价" class="full">
                <span>关联产品订单</span>
                <strong>{{
                  关联产品订单.length
                    ? 关联产品订单.map((订单) => 文本(订单.orderNo, 订单.id)).join("、")
                    : "未关联"
                }}</strong>
              </div>
            </div>
          </div>
        </section>

        <section v-if="!是标准报价" class="panel">
          <header class="panel-head">
            <div>
              <h2>价格规则命中</h2>
              <p>服务端实时计算</p>
            </div>
          </header>
          <div class="panel-body">
            <div class="callout success">
              <template v-if="价格命中说明.length">
                <p v-for="说明 in 价格命中说明" :key="说明">{{ 说明 }}</p>
              </template>
              <p v-else>选择商机与产品模块后展示命中的区域覆盖、渠道比例与阶梯价。</p>
            </div>
          </div>
        </section>
      </aside>

      <main class="quote-builder-main">
        <section class="panel">
          <header class="panel-head">
            <div>
              <h2>{{ 是维保报价 ? "维保服务项目" : "软件模块" }}</h2>
              <p>
                {{
                  是维保报价
                    ? "仅展示已经选入报价的维保服务，选择动作在上方报价方式内完成"
                    : "仅展示已经入单的功能；可选功能已收口到上方报价方式面板"
                }}
              </p>
            </div>
            <div class="button-row">
              <button type="button" class="button small" :disabled="试算中" @click="触发试算">
                {{ 试算中 ? "试算中…" : "重新试算" }}
              </button>
            </div>
          </header>
          <div class="panel-body flush">
            <p v-if="历史明细缺失价格" class="报价历史提示">
              当前是历史报价快照：总额已保留，但旧数据没有记录各模块单价和小计。直接保存不会覆盖原总额；点击「重新试算」可生成完整的新明细。
            </p>
            <div v-if="已选软件分组.length" class="已选软件分组列表">
              <section
                v-for="分组 in 已选软件分组"
                :key="`${分组.大类名称}-${分组.模块名称}`"
                class="已选软件分组"
              >
                <header class="已选软件分组头">
                  <div>
                    <strong>{{ 分组.大类名称 }}</strong>
                    <span>{{ 分组.模块名称 }}</span>
                  </div>
                  <small>{{ 分组.明细.length }} 个功能</small>
                </header>
                <div class="模块方格网格">
                  <article
                    v-for="(项, 序号) in 分组.明细"
                    :key="`${分组.模块名称}-${序号}-${项.id}`"
                    class="模块方格"
                    :class="{ 套餐内: !可移除(项) }"
                  >
                    <span v-if="!可移除(项)" class="方格角标">套餐内</span>
                    <button
                      v-else
                      type="button"
                      class="方格移除"
                      title="从报价单移除该模块"
                      @click="移除模块(项)"
                    >
                      ×
                    </button>
                    <h3 class="方格名称">{{ 文本(项.名称, "未命名模块") }}</h3>
                    <div v-if="套餐组成(项).length" class="方格套餐组成">
                      <span
                        v-for="(组成, 组成序号) in 套餐组成(项)"
                        :key="`${项.id}-${组成序号}`"
                        :class="{ 已归档: 组成.状态 === 'archived' }"
                      >
                        {{ 组成.类型 === "hardware" ? "硬件" : "功能" }} · {{ 组成.名称
                        }}{{ 组成.数量 > 1 ? ` ×${组成.数量}` : "" }}
                      </span>
                    </div>
                    <div class="方格数量">
                      <button
                        type="button"
                        class="步进按钮"
                        :disabled="Number(项.数量) <= 1"
                        @click="步进数量(项, -1)"
                      >
                        −
                      </button>
                      <input
                        class="form-control 数量输入框"
                        type="number"
                        min="1"
                        step="1"
                        :value="项.数量"
                        @change="调整数量(项, $event)"
                      />
                      <button type="button" class="步进按钮" @click="步进数量(项, 1)">＋</button>
                    </div>
                    <div v-if="!是标准报价" class="方格单价">
                      <span>最终单价</span>
                      <strong>{{ 明细金额(项, 项.单价) }}</strong>
                    </div>
                    <dl v-if="!是标准报价" class="方格价格构成">
                      <div>
                        <dt>标准价</dt>
                        <dd>{{ 单价列(项, "标准单价") }}</dd>
                      </div>
                      <div>
                        <dt>区域覆盖</dt>
                        <dd>{{ 单价列(项, "区域覆盖单价") }}</dd>
                      </div>
                      <div>
                        <dt>渠道比例</dt>
                        <dd>{{ 比例列(项) }}</dd>
                      </div>
                    </dl>
                    <p v-if="!是标准报价 && 越档提示(项)" class="方格越档提示">
                      {{ 越档提示(项) }}
                    </p>
                    <div v-if="!是标准报价" class="方格小计">
                      <span>小计</span>
                      <strong>{{ 明细金额(项, 项.小计) }}</strong>
                    </div>
                  </article>
                </div>
              </section>
            </div>
            <p v-else class="war-empty">
              {{
                是维保报价
                  ? "请在报价方式中选择维保服务后进行试算。"
                  : "请在报价方式中选择套餐或具体功能后进行试算。"
              }}
            </p>
          </div>
        </section>

        <section v-if="!是维保报价" class="panel">
          <header class="panel-head">
            <div>
              <h2>硬件与服务</h2>
              <p>硬件数量、服务周期和赠送质保明细</p>
            </div>
            <div class="button-row">
              <button type="button" class="button small" @click="显示硬件选择 = !显示硬件选择">
                {{ 显示硬件选择 ? "收起硬件目录" : "添加硬件或服务" }}
              </button>
            </div>
          </header>
          <div v-if="显示硬件选择" class="panel-body">
            <div class="模块选择网格 硬件选择">
              <button
                v-for="产品 in 硬件产品列表"
                :key="产品.id"
                type="button"
                class="模块选择方格 硬件方格"
                :class="{ 已选: Boolean(选中硬件[产品.id]) }"
                @click="切换硬件(产品.id)"
              >
                <span class="选择角标">{{ 选中硬件[产品.id] ? "✓" : "＋" }}</span>
                <strong>{{ 文本(产品.标题, 产品.原始数据?.name) }}</strong>
                <small>{{ 文本(产品.原始数据?.hardwareCode, 产品.编号, "无编码") }}</small>
              </button>
              <p v-if="!硬件产品列表.length" class="war-note">产品目录暂无可选硬件。</p>
            </div>
          </div>
          <div class="panel-body flush">
            <div class="模块方格网格">
              <article v-for="(项, 序号) in 硬件明细" :key="序号" class="模块方格 硬件方格">
                <span class="方格角标 硬件角标">{{ 明细类型(项) }}</span>
                <h3 class="方格名称">{{ 文本(项.名称, "未命名项") }}</h3>
                <div class="方格数量">
                  <button
                    type="button"
                    class="步进按钮"
                    :disabled="Number(选中硬件[项.id] || 项.数量) <= 1"
                    @click="步进硬件数量(项, -1)"
                  >
                    −
                  </button>
                  <input
                    class="form-control 数量输入框"
                    type="number"
                    min="1"
                    step="1"
                    :value="选中硬件[项.id] || 项.数量"
                    @change="设置硬件数量(项.id, ($event.target as HTMLInputElement).value)"
                  />
                  <button type="button" class="步进按钮" @click="步进硬件数量(项, 1)">＋</button>
                </div>
                <div v-if="!是标准报价" class="方格单价">
                  <span>单价</span>
                  <strong>{{ 明细金额(项, 项.单价) }}</strong>
                </div>
                <div v-if="!是标准报价" class="方格小计">
                  <span>小计</span>
                  <strong>{{ 明细金额(项, 项.小计) }}</strong>
                </div>
              </article>
              <p v-if="!硬件明细.length" class="war-empty">本次报价不含硬件或服务项。</p>
            </div>
          </div>
        </section>
      </main>

      <aside class="quote-builder-summary">
        <section class="panel">
          <header class="panel-head">
            <div>
              <h2>报价单预览</h2>
              <p>正式报价单结构</p>
            </div>
          </header>
          <div class="panel-body">
            <div class="quote-document">
              <div class="quote-document-brand">
                <span class="brand-logo">L</span>
                <div>
                  <strong>联软安全产品报价单</strong>
                  <small>{{ 编辑单号 ? `报价单号 ${编辑单号}` : "报价单号：生成后分配" }}</small>
                </div>
              </div>
              <div class="quote-document-meta">
                <div class="info-item">
                  <span>客户</span><strong>{{ 文本(选中商机?.客户名称, "未关联") }}</strong>
                </div>
                <div class="info-item">
                  <span>商机</span><strong>{{ 文本(选中商机?.标题, "未关联") }}</strong>
                </div>
                <div class="info-item">
                  <span>业务类型</span><strong>{{ 商机业务类型名称 }}</strong>
                </div>
                <div class="info-item">
                  <span>报价类型</span><strong>{{ 报价类型名称 }}</strong>
                </div>
                <div class="info-item">
                  <span>渠道</span><strong>{{ 文本(选中商机?.渠道名称, "未填写") }}</strong>
                </div>
                <div class="info-item">
                  <span>归属区域</span
                  ><strong>{{ 文本(定价上下文?.区域, 选中商机?.区域, "未填写") }}</strong>
                </div>
                <div class="info-item">
                  <span>报价日期</span><strong>{{ 报价日期 }}</strong>
                </div>
                <div class="info-item">
                  <span>有效期</span><strong>{{ 表单.报价有效期 }} 天</strong>
                </div>
              </div>
              <div class="quote-document-lines">
                <div v-for="(项, 序号) in 试算明细" :key="序号">
                  <span>{{ 文本(项.名称, "未命名项") }}</span>
                  <strong>{{ 是标准报价 ? "免价" : 明细金额(项, 项.小计) }}</strong>
                </div>
                <div v-if="!试算明细.length"><span>暂无明细</span><strong>—</strong></div>
              </div>
              <div v-if="是标准报价" class="quote-document-total 待定价说明">
                <span>订单价格</span>
                <strong>待区管定价</strong>
              </div>
              <div v-else class="quote-document-total">
                <span>报价总额</span>
                <strong>{{ 金额(合计) }}</strong>
              </div>
            </div>
          </div>
        </section>

        <section class="panel">
          <header class="panel-head">
            <div>
              <h2>试算汇总</h2>
              <p>服务端结果</p>
            </div>
          </header>
          <div class="panel-body">
            <div class="quote-summary-lines">
              <div v-if="!是标准报价">
                <span>{{ 是维保报价 ? "维保服务小计" : "产品小计" }}</span
                ><strong>{{
                  软件明细.some((项) => 历史缺价序号.has(试算明细.indexOf(项)))
                    ? "历史未记录"
                    : 金额(软件小计)
                }}</strong>
              </div>
              <div v-if="!是标准报价">
                <span>硬件与服务</span
                ><strong>{{
                  硬件明细.some((项) => 历史缺价序号.has(试算明细.indexOf(项)))
                    ? "历史未记录"
                    : 金额(硬件小计)
                }}</strong>
              </div>
              <div>
                <span>端点数量</span><strong>{{ 表单.端点数量 }} 点</strong>
              </div>
              <div>
                <span>工作量说明</span
                ><strong>{{ 试算结果?.workloadSummary || "试算后生成" }}</strong>
              </div>
              <div v-if="!是标准报价" class="sign">
                <span>报价总额</span><strong>{{ 金额(合计) }}</strong>
              </div>
            </div>
            <p class="war-note">
              {{
                是标准报价
                  ? "标准产品报价不展示、不返回任何价格。转单后由区管在订单审批环节补充最终订单价格，未补价不能提交超管确认。"
                  : 是维保报价
                    ? "维保报价只能生成维保订单，并需关联同客户的已确认或已完成产品订单；同一报价只能转一次。"
                    : "产品报价只能生成产品订单；同一报价只能转一次订单，重复转单会被拒绝并提示已有订单号。"
              }}
            </p>
          </div>
        </section>

        <section v-if="!是标准报价" class="panel">
          <header class="panel-head">
            <div>
              <h2>渠道商价格参考</h2>
              <p>按分销等级分档</p>
            </div>
          </header>
          <div class="panel-body">
            <div class="quote-summary-lines">
              <div>
                <span>标准价合计</span><strong>{{ 金额(渠道价格参考?.标准价 ?? 软件小计) }}</strong>
              </div>
              <div>
                <span>区域覆盖价合计</span
                ><strong>{{ 金额(渠道价格参考?.区域覆盖价 ?? 软件小计) }}</strong>
              </div>
              <div>
                <span>一级渠道商价</span><strong>{{ 金额(渠道价格参考?.一级 ?? 软件小计) }}</strong>
              </div>
              <div>
                <span>二级渠道商价</span><strong>{{ 金额(渠道价格参考?.二级 ?? 软件小计) }}</strong>
              </div>
            </div>
            <p class="war-note">
              适用价格区域：{{
                文本(定价上下文?.区域, "全国默认价")
              }}；硬件按原价计入，参考价只统计软件模块。
            </p>
          </div>
        </section>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.war-form-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 18px;
  padding: 22px 24px;
  border: 1px solid #dce7f3;
  border-radius: 12px;
  background: linear-gradient(120deg, #fff, #f3f8ff);
}

.war-form-head h1 {
  margin: 7px 0 5px;
  font-size: 22px;
}

.war-form-head p {
  margin: 0;
  color: #60748c;
  font-size: 11px;
}

.报价方式顶部面板 {
  margin-bottom: 12px;
}

.报价方式顶部面板 .quote-mode-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.报价方式顶部面板 .报价方式套餐列表 {
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  max-height: none;
  margin-top: 10px;
}

.报价类型标签组 {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 7px;
}

.报价体系标签 {
  align-self: center;
  padding: 4px 10px;
  border: 1px solid #b8d9ce;
  border-radius: 999px;
  background: #effaf6;
  color: #15735b;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.报价体系标签.标准 {
  border-color: #edcf8d;
  background: #fff9e8;
  color: #8a5a00;
}

.报价业务类型标签 {
  align-self: center;
  padding: 4px 10px;
  border: 1px solid #b9d2ff;
  border-radius: 999px;
  background: #eef5ff;
  color: var(--blue-strong);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.报价业务类型标签.维保 {
  border-color: #f2d58a;
  background: #fff9e8;
  color: #7d5a00;
}

.报价类型选择区 {
  display: grid;
  gap: 11px;
  margin-bottom: 15px;
  padding-bottom: 15px;
  border-bottom: 1px solid #e7eef6;
}

.quote-type-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.quote-type-card {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) 24px;
  align-items: center;
  gap: 11px;
  min-height: 76px;
  padding: 12px 14px;
  border: 2px solid #dce7f3;
  border-radius: 11px;
  color: #3d526b;
  background: #fff;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;
}

.quote-type-card:hover {
  border-color: #9ebcf0;
  background: #f8fbff;
}

.quote-type-card.active {
  border-color: #4f86e8;
  background: #f1f7ff;
  box-shadow: 0 4px 14px rgba(47, 105, 237, 0.1);
}

.quote-type-icon {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 10px;
  color: #8a5a00;
  background: #fff4d8;
  font-size: 13px;
  font-weight: 700;
}

.quote-type-icon.渠道 {
  color: #176b57;
  background: #e9f8f2;
}

.quote-type-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.quote-type-copy strong {
  color: #20354f;
  font-size: 12px;
}

.quote-type-copy small {
  color: #73859a;
  font-size: 11px;
  line-height: 1.5;
}

.quote-type-check {
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  border-radius: 50%;
  color: #fff;
  background: #2f69ed;
  font-size: 11px;
  font-weight: 700;
}

.quote-type-locked {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px 12px;
  padding: 12px 14px;
  border: 1px solid #e2d5ad;
  border-radius: 9px;
  background: #fffcf2;
}

.quote-type-locked strong {
  color: #6f4b00;
  font-size: 12px;
}

.quote-type-locked span {
  color: #7d6a45;
  font-size: 11px;
}

.quote-document-total.待定价说明 strong {
  color: #9a6400;
  font-size: 13px;
}

.quote-field-list > div.full {
  align-items: flex-start;
  flex-direction: column;
}

.quote-field-list > div.full strong {
  max-width: none;
  text-align: left;
}

.新建报价页 :deep(.form-control) {
  min-height: 30px;
  padding: 5px 9px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #ffffff;
  font: inherit;
  font-size: 11px;
}

.产品勾选列表 {
  display: grid;
  gap: 6px;
  max-height: 320px;
  margin-top: 8px;
  overflow-y: auto;
}

.报价方式套餐列表 {
  max-height: 216px;
}

.产品勾选列表 .quote-mode.locked {
  cursor: default;
  opacity: 0.72;
}

/* 模块方格：对齐老 UI（V2）报价页「一小块一小块」的圆角方格卡片，管理端与渠道端共用同一套样式。 */
.模块方格网格 {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(236px, 1fr));
  gap: 10px;
}

.模块方格 {
  position: relative;
  display: grid;
  gap: 8px;
  align-content: start;
  padding: 12px;
  border: 2px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--surface);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.模块方格:hover {
  border-color: var(--blue);
  box-shadow: 0 4px 12px rgba(47, 105, 237, 0.12);
}

.模块方格.套餐内 {
  background: var(--blue-soft);
}

.方格名称 {
  margin: 0;
  padding-right: 34px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.45;
  color: var(--text);
}

.方格套餐组成 {
  display: grid;
  max-height: 112px;
  gap: 3px;
  padding: 6px 7px;
  overflow-y: auto;
  border: 1px solid #d7e5f7;
  border-radius: 7px;
  background: rgb(255 255 255 / 72%);
}

.方格套餐组成 span {
  overflow: hidden;
  color: #526b86;
  font-size: 10px;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.方格套餐组成 span.已归档 {
  color: #b14a4a;
  text-decoration: line-through;
}

.方格角标 {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 1px 7px;
  border-radius: 999px;
  background: #e8f1ff;
  color: var(--blue-strong);
  font-size: 10px;
}

.硬件角标 {
  background: var(--amber-soft);
  color: var(--amber);
}

.方格移除 {
  position: absolute;
  top: 7px;
  right: 7px;
  width: 20px;
  height: 20px;
  border: 0;
  border-radius: 50%;
  background: rgba(23, 43, 77, 0.08);
  color: var(--text-2);
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
}

.方格移除:hover {
  background: var(--red);
  color: #ffffff;
}

.方格数量 {
  display: flex;
  align-items: center;
  gap: 6px;
}

.步进按钮 {
  width: 24px;
  height: 24px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: #ffffff;
  color: var(--text);
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
}

.步进按钮:hover:not(:disabled) {
  border-color: var(--blue);
  color: var(--blue-strong);
}

.步进按钮:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.方格数量 .数量输入框 {
  flex: 1 1 auto;
  text-align: center;
}

.方格单价,
.方格小计 {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
}

.方格单价 span,
.方格小计 span {
  color: var(--text-3);
}

.方格单价 strong {
  color: var(--blue-strong);
  font-size: 14px;
}

.方格小计 {
  padding-top: 7px;
  border-top: 1px dashed var(--line-soft);
}

.方格小计 strong {
  font-size: 12px;
}

.方格价格构成 {
  display: grid;
  gap: 2px;
  margin: 0;
  font-size: 10px;
}

.方格价格构成 > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.方格价格构成 dt {
  color: var(--text-3);
}

.方格价格构成 dd {
  margin: 0;
  color: var(--text-2);
}

.方格越档提示 {
  margin: 0;
  padding: 5px 7px;
  border-radius: var(--radius-sm);
  background: var(--amber-soft);
  color: var(--amber);
  font-size: 10px;
  line-height: 1.5;
}

/* 可选模块方格：与 V2 的补充功能 / 硬件卡片一致，带勾选角标 */
.模块选择网格 {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(196px, 1fr));
  gap: 8px;
  max-height: 320px;
  margin-top: 8px;
  overflow-y: auto;
}

.模块选择方格 {
  position: relative;
  display: grid;
  gap: 2px;
  padding: 9px 12px 9px 32px;
  border: 2px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--surface);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    background 0.2s ease;
}

.模块选择方格:hover:not(:disabled) {
  border-color: var(--blue);
  box-shadow: 0 3px 10px rgba(47, 105, 237, 0.12);
}

.模块选择方格.已选 {
  border-color: var(--blue);
  background: var(--blue-soft);
}

.模块选择方格.锁定 {
  cursor: default;
  opacity: 0.78;
}

.模块选择方格 strong {
  color: var(--text);
  font-size: 11px;
  font-weight: 700;
  line-height: 1.4;
}

.模块选择方格 small {
  color: var(--text-3);
  font-size: 10px;
}

.选择角标 {
  position: absolute;
  top: 50%;
  left: 9px;
  width: 16px;
  height: 16px;
  margin-top: -8px;
  border-radius: 50%;
  background: var(--line);
  color: #ffffff;
  font-size: 10px;
  line-height: 16px;
  text-align: center;
}

.模块选择方格.已选 .选择角标 {
  background: var(--blue);
}

/* 逐项数量输入框：与表格同高，宽度收窄，便于逐模块调整 */
.数量输入框 {
  width: 78px;
  min-height: 26px;
  padding: 3px 6px;
  text-align: right;
}

.war-empty {
  display: grid;
  place-items: center;
  min-height: 70px;
  padding: 14px;
  color: var(--text-3);
  font-size: 11px;
}

.war-note {
  margin: 8px 0 0;
  color: var(--text-3);
  font-size: 11px;
  line-height: 1.6;
}

.callout {
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 11px;
  line-height: 1.7;
}

.callout.success {
  border: 1px solid #b7eb8f;
  background: #f6ffed;
  color: #237804;
}

.callout p {
  margin: 0;
}

.quote-add-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.quote-add-row .form-control {
  flex: 1 1 auto;
}

.quote-add-row .war-note {
  margin: 0;
  white-space: nowrap;
}

.quote-document-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 10px 0;
}

.quote-document-total {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--line-soft);
  color: var(--blue-strong);
  font-size: 12px;
  font-weight: 700;
}

.quote-summary-lines {
  display: grid;
  gap: 8px;
}

.quote-summary-lines > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 11px;
}

.war-empty-inline {
  color: var(--text-3);
  font-size: 11px;
}

.quote-summary-lines > div.sign {
  padding-top: 8px;
  border-top: 1px solid var(--line-soft);
  color: var(--blue-strong);
  font-weight: 700;
}

.报价历史提示 {
  margin: 0;
  padding: 10px 12px;
  border-bottom: 1px solid #f2d58a;
  background: #fff9e8;
  color: #7d5a00;
  font-size: 11px;
  line-height: 1.6;
}

/* 报价方式三级选择：保留新 UI 的卡片语言，按老 UI 的“方式 → 模块 → 功能”组织信息。 */
.报价方式内容 {
  display: grid;
  gap: 14px;
}

.报价方式顶部面板 .quote-mode-grid {
  gap: 10px;
}

.报价方式顶部面板 .quote-mode {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 22px;
  align-items: center;
  gap: 11px;
  min-height: 76px;
  padding: 11px 13px;
  border: 2px solid var(--line);
  border-radius: 12px;
  background: #ffffff;
  color: var(--text);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;
}

.报价方式顶部面板 .quote-mode:hover {
  border-color: #9dc2ff;
  box-shadow: 0 4px 14px rgba(47, 105, 237, 0.1);
}

.报价方式顶部面板 .quote-mode.active {
  border-color: var(--blue);
  background: linear-gradient(135deg, #f4f8ff, #eaf3ff);
  box-shadow: 0 4px 14px rgba(47, 105, 237, 0.14);
}

.quote-mode-icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: #f3f7fc;
  font-size: 20px;
}

.quote-mode.active .quote-mode-icon {
  background: #dfedff;
}

.quote-mode-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.报价方式顶部面板 .quote-mode-copy strong {
  color: var(--text);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.3;
}

.报价方式顶部面板 .quote-mode.active .quote-mode-copy strong {
  color: var(--blue-strong);
}

.报价方式顶部面板 .quote-mode-copy small {
  color: var(--text-3);
  font-size: 10px;
  line-height: 1.45;
}

.quote-mode-check {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--blue);
  color: #ffffff !important;
  font-size: 11px !important;
  font-weight: 700;
}

.quote-choice-section {
  display: grid;
  gap: 10px;
  padding-top: 13px;
  border-top: 1px dashed #dce7f3;
}

.quote-choice-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.quote-choice-head h3 {
  margin: 0;
  color: var(--text);
  font-size: 13px;
  font-weight: 700;
}

.quote-choice-head p {
  margin: 4px 0 0;
  color: var(--text-3);
  font-size: 10px;
  line-height: 1.55;
}

.quote-choice-meta {
  flex: 0 0 auto;
  padding: 4px 9px;
  border: 1px solid #d8e6f5;
  border-radius: 999px;
  background: #f7faff;
  color: var(--blue-strong);
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
}

.quote-package-grid,
.quote-category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(216px, 1fr));
  gap: 10px;
}

.quote-package-grid {
  max-height: 356px;
  padding: 2px 4px 2px 2px;
  overflow-y: auto;
}

.quote-package-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  padding: 11px;
  border: 2px solid var(--line);
  border-radius: 11px;
  background: #ffffff;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    background 0.2s ease;
}

.quote-package-card:hover {
  border-color: #9dc2ff;
  box-shadow: 0 4px 12px rgba(47, 105, 237, 0.1);
}

.quote-package-card.active {
  border-color: var(--blue);
  background: linear-gradient(135deg, #f7faff, #eef5ff);
}

.quote-package-select {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text);
  text-align: left;
  cursor: pointer;
}

.quote-package-icon {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background: #fff7e3;
  font-size: 17px;
}

.quote-package-copy {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.quote-package-copy strong {
  overflow: hidden;
  color: var(--text);
  font-size: 11px;
  font-weight: 700;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quote-package-copy small {
  color: var(--text-3);
  font-size: 9px;
}

.quote-package-state {
  padding: 2px 7px;
  border-radius: 999px;
  background: #f0f4fa;
  color: var(--text-3);
  font-size: 9px;
  font-weight: 700;
  white-space: nowrap;
}

.quote-package-card.active .quote-package-state {
  background: var(--blue);
  color: #ffffff;
}

.quote-package-tags {
  display: flex;
  min-height: 44px;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 5px;
  margin: 10px 0;
}

.quote-package-tags span {
  max-width: 100%;
  overflow: hidden;
  padding: 3px 7px;
  border: 1px solid #e6edf5;
  border-radius: 5px;
  background: #f7f9fc;
  color: var(--text-3);
  font-size: 9px;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quote-package-detail-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  min-height: 30px;
  margin-top: auto;
  padding: 5px 9px;
  border: 1px solid #c8ddf7;
  border-radius: 7px;
  background: #f4f8ff;
  color: var(--blue-strong);
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
}

.quote-package-detail-link:hover {
  border-color: var(--blue);
  background: #e8f2ff;
}

.quote-catalog-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid #e1ebf6;
  border-radius: 9px;
  background: #f8fbff;
}

.quote-catalog-toolbar .form-control {
  flex: 1 1 auto;
  min-width: 180px;
  background: #ffffff;
}

.quote-catalog-toolbar > span {
  flex: 0 0 auto;
  color: var(--text-3);
  font-size: 10px;
  white-space: nowrap;
}

.quote-category-card {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 9px;
  min-height: 66px;
  padding: 10px 11px;
  border: 2px solid var(--line);
  border-radius: 11px;
  background: #ffffff;
  color: var(--text);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    background 0.2s ease;
}

.quote-category-card:hover {
  border-color: #9dc2ff;
  box-shadow: 0 4px 12px rgba(47, 105, 237, 0.1);
}

.quote-category-card.active {
  border-color: var(--blue);
  background: linear-gradient(135deg, #f7faff, #edf5ff);
}

.quote-category-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: #f2f7ff;
  font-size: 18px;
}

.quote-category-copy {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.quote-category-copy strong {
  display: -webkit-box;
  overflow: hidden;
  color: var(--text);
  font-size: 11px;
  font-weight: 700;
  line-height: 1.4;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.quote-category-copy small {
  color: var(--text-3);
  font-size: 9px;
}

.quote-category-count {
  padding: 2px 7px;
  border-radius: 999px;
  background: #e8f2ff;
  color: var(--blue-strong);
  font-size: 9px;
  font-weight: 700;
  white-space: nowrap;
}

.quote-category-arrow {
  color: var(--blue);
  font-size: 10px;
}

.quote-catalog-detail {
  overflow: hidden;
  border: 1px solid #a9c9fa;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 5px 16px rgba(47, 105, 237, 0.08);
}

.quote-catalog-detail-head {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  padding: 10px 12px;
  border-bottom: 1px solid #cfe1fa;
  background: linear-gradient(120deg, #f4f8ff, #eaf3ff);
}

.quote-catalog-detail-icon {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: #ffffff;
  font-size: 16px;
}

.quote-catalog-detail-head > div {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.quote-catalog-detail-head strong {
  overflow-wrap: anywhere;
  color: var(--blue-strong);
  font-size: 12px;
  line-height: 1.4;
}

.quote-catalog-detail-head small {
  color: var(--text-3);
  font-size: 9px;
  line-height: 1.45;
}

.quote-catalog-detail-count {
  padding: 3px 8px;
  border: 1px solid #c8ddf7;
  border-radius: 999px;
  background: #ffffff;
  color: var(--blue-strong);
  font-size: 9px;
  font-weight: 700;
  white-space: nowrap;
}

.quote-catalog-module-list {
  display: grid;
  max-height: 380px;
  gap: 10px;
  padding: 11px;
  overflow-y: auto;
}

.套餐硬件清单 {
  display: grid;
  gap: 8px;
  padding: 0 11px 11px;
}

.套餐硬件清单 > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #3d5874;
  font-size: 10px;
}

.quote-catalog-module-group {
  display: grid;
  gap: 8px;
  padding-bottom: 9px;
  border-bottom: 1px dashed #dce7f3;
}

.quote-catalog-module-group:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.quote-catalog-module-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 9px;
  border-radius: 7px;
  background: #f7faff;
}

.quote-catalog-module-head strong,
.quote-catalog-module-title strong {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: var(--text);
  font-size: 10px;
  font-weight: 700;
  line-height: 1.45;
}

.quote-catalog-module-head small,
.quote-catalog-module-title > span {
  flex: 0 0 auto;
  color: var(--text-3);
  font-size: 9px;
}

.quote-catalog-module {
  display: grid;
  gap: 7px;
  padding: 8px 9px;
  border: 1px solid #edf2f8;
  border-radius: 8px;
  background: #fcfdff;
}

.quote-catalog-module-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.quote-feature-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.quote-feature-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 27px;
  max-width: 100%;
  padding: 4px 9px;
  border: 1px solid #d9e5f2;
  border-radius: 999px;
  background: #ffffff;
  color: var(--text-2);
  font: inherit;
  font-size: 10px;
  line-height: 1.35;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    color 0.18s ease;
}

button.quote-feature-pill:hover {
  border-color: #8db8f8;
  color: var(--blue-strong);
}

.quote-feature-pill.已选 {
  border-color: var(--blue);
  background: var(--blue);
  color: #ffffff;
}

.quote-feature-pill.锁定 {
  cursor: default;
  opacity: 0.9;
}

.quote-feature-check {
  display: inline-grid;
  flex: 0 0 auto;
  place-items: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #eef3f9;
  color: var(--text-3);
  font-size: 9px;
  font-weight: 700;
}

.quote-feature-pill.已选 .quote-feature-check {
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
}

.quote-feature-pill small {
  padding-left: 5px;
  border-left: 1px solid rgba(255, 255, 255, 0.35);
  color: rgba(255, 255, 255, 0.82);
  font-size: 8px;
  white-space: nowrap;
}

.已选软件分组列表 {
  display: grid;
  gap: 13px;
  padding: 12px;
}

.已选软件分组 {
  display: grid;
  gap: 9px;
  padding: 10px;
  border: 1px solid #e1ebf6;
  border-radius: 11px;
  background: #fbfdff;
}

.已选软件分组头 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 9px;
  border-left: 3px solid var(--blue);
  border-radius: 0 7px 7px 0;
  background: #f2f7ff;
}

.已选软件分组头 > div {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 8px;
}

.已选软件分组头 strong {
  overflow-wrap: anywhere;
  color: var(--text);
  font-size: 11px;
}

.已选软件分组头 span {
  color: var(--blue-strong);
  font-size: 10px;
}

.已选软件分组头 small {
  flex: 0 0 auto;
  color: var(--text-3);
  font-size: 9px;
}

@media (max-width: 1360px) {
  .vui .quote-builder-layout {
    grid-template-columns: 270px minmax(0, 1fr) 310px;
  }
}

@media (max-width: 1180px) {
  .vui .quote-builder-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .vui .quote-builder-side,
  .vui .quote-builder-summary {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    align-items: start;
  }
}

@media (max-width: 840px) {
  .报价方式顶部面板 .quote-mode-grid,
  .quote-package-grid,
  .quote-category-grid,
  .vui .quote-builder-side,
  .vui .quote-builder-summary {
    grid-template-columns: minmax(0, 1fr);
  }

  .quote-choice-head,
  .quote-catalog-toolbar,
  .已选软件分组头 {
    align-items: stretch;
    flex-direction: column;
  }

  .quote-choice-meta,
  .quote-catalog-toolbar > span {
    align-self: flex-start;
  }

  .quote-catalog-detail-head {
    grid-template-columns: 30px minmax(0, 1fr);
  }

  .quote-catalog-detail-count {
    grid-column: 1 / -1;
    justify-self: start;
  }
}
</style>
