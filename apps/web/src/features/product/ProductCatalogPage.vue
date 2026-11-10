<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import { 查询工作量映射 } from "../../api/business-client.js";
import { type 区域, 查询区域列表 } from "../../api/organization-client.js";
import type { 指标项 } from "../../components/war/types.js";
import WarKpis from "../../components/war/WarKpis.vue";
import { 文本, 金额文本 } from "../../shared/format/business-format.js";
import { 是内部管理员, 是超级管理员 } from "../../shared/permission/role.js";
import { useSessionStore } from "../../stores/session.js";
import {
  type 产品大类,
  type 产品套餐,
  type 产品模块,
  type 产品资源类型,
  保存产品大类,
  保存产品套餐,
  保存产品模块,
  保存功能产品,
  保存硬件产品,
  type 功能产品,
  发布产品,
  归档产品,
  查询产品大类,
  查询产品套餐,
  查询产品模块,
  查询功能产品,
  查询硬件产品,
  type 硬件产品,
} from "./product-catalog-client.js";

const 路由器 = useRouter();
const 路由 = useRoute();
const 会话 = useSessionStore();

const 加载中 = ref(false);
const 错误 = ref("");
const 提交中 = ref(false);
const 搜索词 = ref("");
const 功能列表 = ref<功能产品[]>([]);
const 硬件列表 = ref<硬件产品[]>([]);
const 套餐列表 = ref<产品套餐[]>([]);
const 大类列表 = ref<产品大类[]>([]);
const 模块列表 = ref<产品模块[]>([]);
const 区域列表 = ref<区域[]>([]);
const 工作量映射数 = ref(0);

const 可维护 = computed(() => 是超级管理员(会话.user));
/** 价格规则入口与管理员向说明只对内部管理员（超管 / 区管）开放，渠道端不展示。 */
const 内部管理员 = computed(() => 是内部管理员(会话.user));
/** 价格区域覆盖只允许选择正式组织区域，避免手工输入造成规则无法命中。 */
const 可选区域 = computed(() =>
  区域列表.value
    .filter((项) => (项.statusCode || "active") === "active" && 项.regionLevel === "region")
    .map((项) => 项.regionName)
    .filter((名称, 序号, 全部) => 名称 && 全部.indexOf(名称) === 序号),
);

type 产品条目 =
  | {
      键: string;
      类型: "功能模块";
      名称: string;
      编码: string;
      单位: string;
      已发布: boolean;
      说明: string;
      功能: 功能产品;
    }
  | {
      键: string;
      类型: "硬件产品";
      名称: string;
      编码: string;
      单位: string;
      已发布: boolean;
      说明: string;
      硬件: 硬件产品;
    }
  | {
      键: string;
      类型: "产品套餐";
      名称: string;
      编码: string;
      单位: string;
      已发布: boolean;
      说明: string;
      套餐: 产品套餐;
    };

/** 表单内的数字允许空串（输入框清空），提交前统一转换为数字或 null。 */
interface 阶梯表单 {
  min: number | string;
  max: number | string;
  price: number | string;
}

interface 区域覆盖表单 {
  region: string;
  regions: string[];
  enabled: boolean;
  effectiveFrom: string;
  effectiveTo: string;
  tiers: 阶梯表单[];
  priceFixed: number | string | null;
  priceRatioPrimary: number | string | null;
  priceRatioSecondary: number | string | null;
  priceForPrimary: 阶梯表单[];
  priceForSecondary: 阶梯表单[];
}

const 档位修正提示 = ref("");

function 可空数字(值: unknown): number | null {
  if (值 === null || 值 === undefined || 值 === "") return null;
  const 数值 = Number(值);
  return Number.isFinite(数值) ? 数值 : null;
}

/** 兼容 V2 迁移数据：数字、单个价格对象和档位数组都转换为可编辑档位。 */
function 历史价格档位(值: unknown, 层级?: "primary" | "secondary"): 阶梯表单[] {
  if (值 === null || 值 === undefined || 值 === "") return [];
  if (Array.isArray(值)) return 值.flatMap((项) => 历史价格档位(项, 层级));
  const 数字值 = Number(值);
  if (typeof 值 !== "object" && Number.isFinite(数字值)) {
    return 数字值 < 0 ? [] : [{ min: 1, max: 999999, price: 数字值 }];
  }
  if (!值 || typeof 值 !== "object") return [];
  const 记录 = 值 as Record<string, unknown>;
  if (层级 && Object.prototype.hasOwnProperty.call(记录, 层级)) {
    return 历史价格档位(记录[层级], 层级);
  }
  const 起始 = Number(记录.min);
  const 结束 = Number(记录.max);
  const 价格 = Number(记录.price);
  if (Number.isFinite(起始) && Number.isFinite(结束) && Number.isFinite(价格)) {
    if (起始 === 0 && 结束 === 0) return [];
    return [{ min: 起始 < 1 ? 1 : 起始, max: 结束, price: 价格 }];
  }
  return [];
}

/**
 * 历史迁移数据存在少量档位重叠，例如结束点被拼成 2149，导致整条产品无法保存。
 * 打开编辑器时按“后一档起始点 - 1”收口，并提示用户核对；只修正重叠区间，不改价格。
 */
function 整理重叠档位(档位列表: 阶梯表单[]): { 档位: 阶梯表单[]; 修正数: number } {
  const 档位 = [...档位列表].sort((左, 右) => Number(左.min) - Number(右.min));
  let 修正数 = 0;
  for (let 序号 = 0; 序号 < 档位.length - 1; 序号 += 1) {
    const 当前 = 档位[序号];
    const 下一档 = 档位[序号 + 1];
    if (!当前 || !下一档) continue;
    const 当前结束 = Number(当前.max);
    const 下一开始 = Number(下一档.min);
    if (Number.isFinite(当前结束) && Number.isFinite(下一开始) && 当前结束 >= 下一开始) {
      当前.max = Math.max(Number(当前.min) || 1, 下一开始 - 1);
      修正数 += 1;
    }
  }
  return {
    档位: 档位.filter((档) => Number(档.max) >= Number(档.min)),
    修正数,
  };
}

/** 保存前再次校验档位，给出具体档位序号，避免只显示笼统的“保存失败”。 */
function 档位校验错误(档位列表: 阶梯表单[], 标签: string): string {
  const 有效档位 = 档位列表
    .map((档, 序号) => ({ ...档, 序号 }))
    .filter((档) => !(Number(档.min) === 0 && Number(档.max) === 0));
  const 排序后 = [...有效档位].sort((左, 右) => Number(左.min) - Number(右.min));
  for (const [位置, 档] of 排序后.entries()) {
    const 起始 = Number(档.min);
    const 结束 = Number(档.max);
    const 价格 = Number(档.price);
    if (
      !Number.isInteger(起始) ||
      !Number.isInteger(结束) ||
      起始 < 1 ||
      结束 < 起始 ||
      !Number.isFinite(价格) ||
      价格 < 0
    ) {
      return `${标签}第 ${档.序号 + 1} 档的起始点、结束点或价格不正确。`;
    }
    if (位置 > 0) {
      const 前一档 = 排序后[位置 - 1];
      if (前一档 && 起始 <= Number(前一档.max)) {
        return `${标签}第 ${前一档.序号 + 1} 档与第 ${档.序号 + 1} 档区间重叠，请调整结束点。`;
      }
    }
  }
  return "";
}

// —— 弹窗状态 ——
type 弹窗类型 = "" | "功能" | "硬件" | "套餐" | "大类" | "模块";
const 弹窗 = ref<弹窗类型>("");
const 编辑中功能 = ref<功能产品 | null>(null);
const 编辑中硬件 = ref<硬件产品 | null>(null);
const 编辑中套餐 = ref<产品套餐 | null>(null);
const 编辑中大类 = ref<产品大类 | null>(null);
const 编辑中模块 = ref<产品模块 | null>(null);

const 功能表单 = reactive({
  name: "",
  productCode: "",
  moduleId: "",
  unit: "端点",
  priceType: "fixed",
  priceFixed: 0,
  desc: "",
  required: false,
  published: true,
  priceRatioPrimary: 100,
  priceRatioSecondary: 110,
  tiers: [] as 阶梯表单[],
  一级专用价: [] as 阶梯表单[],
  二级专用价: [] as 阶梯表单[],
  区域覆盖: [] as 区域覆盖表单[],
});

const 硬件表单 = reactive({
  name: "",
  model: "",
  unit: "台",
  priceFixed: 0,
  specs: "",
  desc: "",
  published: true,
});

const 套餐表单 = reactive({
  name: "",
  code: "",
  desc: "",
  priceFixed: 0,
  published: true,
  模块编号: [] as string[],
  功能编号: [] as string[],
  硬件编号: [] as string[],
});

const 大类表单 = reactive({ name: "", code: "", type: "software", sort: 0 });
const 模块表单 = reactive({ name: "", code: "", categoryId: "", sort: 0 });

function 取模块名称(编号: string): string {
  return 模块列表.value.find((项) => 项.id === 编号)?.name || "未归属模块";
}

function 取大类名称(编号: string): string {
  return 大类列表.value.find((项) => 项.id === 编号)?.name || "";
}

function 模块所属大类(模块编号: string): string {
  const 模块 = 模块列表.value.find((项) => 项.id === 模块编号);
  return 模块 ? 取大类名称(模块.categoryId) : "";
}

const 全部条目 = computed<产品条目[]>(() => [
  ...功能列表.value.map((产品) => ({
    键: `feature-${产品.id}`,
    类型: "功能模块" as const,
    名称: 产品.name,
    编码: 产品.productCode,
    单位: 产品.unit,
    已发布: 产品.published !== false,
    说明: 产品.desc || "",
    功能: 产品,
  })),
  ...硬件列表.value.map((产品) => ({
    键: `hardware-${产品.id}`,
    类型: "硬件产品" as const,
    名称: 产品.name,
    编码: 产品.model,
    单位: 产品.unit,
    已发布: 产品.published !== false,
    说明: 产品.desc || "",
    硬件: 产品,
  })),
  ...套餐列表.value.map((产品) => ({
    键: `package-${产品.id}`,
    类型: "产品套餐" as const,
    名称: 产品.name,
    编码: 产品.code,
    单位: "套",
    已发布: 产品.published !== false,
    说明: 产品.desc || "",
    套餐: 产品,
  })),
]);

const 指标 = computed<指标项[]>(() => {
  const 待发布 =
    功能列表.value.filter((项) => 项.published === false).length +
    硬件列表.value.filter((项) => 项.published === false).length +
    套餐列表.value.filter((项) => 项.published === false).length;
  const 价格规则条数 = 功能列表.value.reduce(
    (合计, 项) => 合计 + (项.tiers?.length || 0) + (项.regionPriceOverrides?.length || 0),
    0,
  );
  return [
    { label: "软件功能", value: String(功能列表.value.length), unit: "项", note: "功能产品目录" },
    { label: "硬件产品", value: String(硬件列表.value.length), unit: "款", note: "硬件产品目录" },
    { label: "产品套餐", value: String(套餐列表.value.length), unit: "个", note: "组合套餐目录" },
    {
      label: "产品大类 / 模块",
      value: `${大类列表.value.length} / ${模块列表.value.length}`,
      unit: "个",
      note: "目录层级结构",
    },
    ...(内部管理员.value
      ? [
          { label: "价格规则", value: String(价格规则条数), unit: "条", note: "阶梯价与区域覆盖" },
          { label: "待发布", value: String(待发布), unit: "项", note: "未发布的产品不参与报价" },
        ]
      : []),
  ];
});

/** 产品维护子目录：结构与老 UI 一致，样式沿用新 UI 画板。 */
type 页签名 =
  | "产品目录"
  | "大类管理"
  | "模块管理"
  | "功能管理"
  | "硬件管理"
  | "套餐管理"
  | "工作量配置"
  | "推荐套餐";

const 页签图标: Record<页签名, string> = {
  产品目录: "🗂️",
  大类管理: "📂",
  模块管理: "📋",
  功能管理: "⚙️",
  硬件管理: "🖥️",
  套餐管理: "📦",
  工作量配置: "🛠️",
  推荐套餐: "📦",
};

const 当前页签 = ref<页签名>("产品目录");
const 页签列表 = computed<页签名[]>(() =>
  可维护.value
    ? ["产品目录", "大类管理", "模块管理", "功能管理", "硬件管理", "套餐管理", "工作量配置"]
    : ["产品目录", "推荐套餐"],
);

/** 产品目录下钻状态：未选大类看大类，选中大类看模块，选中模块看功能。 */
const 目录大类 = ref<产品大类 | null>(null);
const 目录模块 = ref<产品模块 | null>(null);
const 目录搜索词 = ref("");
const 目录页码 = ref(1);
const 目录每页 = 20;
const 模块筛选大类 = ref("全部");
const 功能筛选模块 = ref("全部");
const 硬件搜索词 = ref("");
const 套餐搜索词 = ref("");

const 目录模块列表 = computed(() =>
  目录大类.value ? 模块列表.value.filter((项) => 项.categoryId === 目录大类.value?.id) : [],
);
const 目录功能列表 = computed(() =>
  目录模块.value ? 功能列表.value.filter((项) => 项.moduleId === 目录模块.value?.id) : [],
);
const 目录硬件列表 = computed(() => 硬件列表.value);
const 目录过滤大类 = computed(() =>
  按关键词过滤(大类列表.value, 目录搜索词.value, (项) => [项.name, 项.desc]),
);
const 目录过滤模块 = computed(() =>
  按关键词过滤(目录模块列表.value, 目录搜索词.value, (项) => [项.name, 项.desc]),
);
const 目录过滤功能 = computed(() =>
  按关键词过滤(目录功能列表.value, 目录搜索词.value, (项) => [项.name, 项.productCode, 项.desc]),
);
const 目录过滤硬件 = computed(() =>
  按关键词过滤(目录硬件列表.value, 目录搜索词.value, (项) => [
    项.name,
    项.model,
    项.specs,
    项.desc,
  ]),
);
const 目录结果总数 = computed(() => {
  if (!目录大类.value)
    return 目录过滤大类.value.length + (目录搜索词.value ? 0 : 目录过滤硬件.value.length);
  if (!目录模块.value) return 目录过滤模块.value.length;
  return 目录过滤功能.value.length;
});
const 目录总页数 = computed(() => Math.max(1, Math.ceil(目录结果总数.value / 目录每页)));
const 目录展示大类 = computed(() => 分页(目录过滤大类.value));
const 目录展示模块 = computed(() => 分页(目录过滤模块.value));
const 目录展示功能 = computed(() => 分页(目录过滤功能.value));
const 目录展示硬件 = computed(() => 分页(目录过滤硬件.value));

function 分页<T>(列表: T[]): T[] {
  const 起始 = (目录页码.value - 1) * 目录每页;
  return 列表.slice(起始, 起始 + 目录每页);
}

watch([目录大类, 目录模块, 目录搜索词], () => {
  目录页码.value = 1;
});
watch(目录页码, (页码) => {
  if (页码 > 目录总页数.value) 目录页码.value = 目录总页数.value;
});
const 模块管理列表 = computed(() =>
  模块筛选大类.value === "全部"
    ? 模块列表.value
    : 模块列表.value.filter((项) => 项.categoryId === 模块筛选大类.value),
);
const 功能管理列表 = computed(() =>
  按关键词过滤(功能列表.value, 搜索词.value, (项) => [项.name, 项.productCode, 项.desc]).filter(
    (项) => 功能筛选模块.value === "全部" || 项.moduleId === 功能筛选模块.value,
  ),
);
const 硬件管理列表 = computed(() =>
  按关键词过滤(硬件列表.value, 硬件搜索词.value, (项) => [项.name, 项.model, 项.specs, 项.desc]),
);
const 套餐管理列表 = computed(() =>
  按关键词过滤(套餐列表.value, 套餐搜索词.value, (项) => [项.name, 项.code, 项.desc]),
);

function 按关键词过滤<T>(
  列表: T[],
  关键词: string,
  取字段: (项: T) => Array<string | undefined>,
): T[] {
  const 词 = 关键词.trim().toLowerCase();
  if (!词) return 列表;
  return 列表.filter((项) =>
    取字段(项)
      .filter(Boolean)
      .some((值) => String(值).toLowerCase().includes(词)),
  );
}

function 取模块功能数(模块编号: string): number {
  return 功能列表.value.filter((项) => 项.moduleId === 模块编号).length;
}

function 取大类模块数(大类编号: string): number {
  return 模块列表.value.filter((项) => 项.categoryId === 大类编号).length;
}

function 取大类功能数(大类编号: string): number {
  const 模块编号集 = new Set(
    模块列表.value.filter((项) => 项.categoryId === 大类编号).map((项) => 项.id),
  );
  return 功能列表.value.filter((项) => 模块编号集.has(项.moduleId)).length;
}

function 大类图标(大类: 产品大类): string {
  return 大类.icon || (大类.type === "hardware" ? "🖥️" : "🗂️");
}

function 模块图标(模块: 产品模块): string {
  return 模块.icon || "📋";
}

function 切换页签(项: 页签名) {
  当前页签.value = 项;
  目录大类.value = null;
  目录模块.value = null;
  目录搜索词.value = "";
  目录页码.value = 1;
}

function 打开目录大类(大类: 产品大类) {
  目录大类.value = 大类;
  目录模块.value = null;
}

function 打开目录模块(模块: 产品模块) {
  目录模块.value = 模块;
}

function 返回目录上层() {
  if (目录模块.value) {
    目录模块.value = null;
    return;
  }
  目录大类.value = null;
}

async function 归档条目(资源: 产品资源类型, 编号: string, 名称: string) {
  if (!可维护.value) return;
  if (!window.confirm(`确认删除「${名称}」？删除后不再出现在产品目录与报价选择中。`)) return;
  try {
    await 归档产品(资源, 编号);
    ElMessage.success("已删除。");
    await 加载();
  } catch (异常) {
    ElMessage.error("删除失败：" + (异常 instanceof Error ? 异常.message : "未知错误"));
  }
}

async function 切换大类模块发布(资源: 产品资源类型, 编号: string, 已发布: boolean) {
  try {
    await 发布产品(资源, 编号, !已发布);
    ElMessage.success(已发布 ? "已下架，报价不再引用。" : "已发布。");
    await 加载();
  } catch (异常) {
    ElMessage.error("操作失败：" + (异常 instanceof Error ? 异常.message : "未知错误"));
  }
}

onMounted(async () => {
  await 会话.恢复会话();
  await 加载();
  const 目标功能 = 文本(路由.query.editFeature);
  if (目标功能) {
    if (可维护.value) {
      const 功能 = 功能列表.value.find((项) => 项.id === 目标功能 || 项.productCode === 目标功能);
      if (功能) {
        当前页签.value = "功能管理";
        打开功能弹窗(功能);
      } else {
        const 硬件 = 硬件列表.value.find((项) => 项.id === 目标功能 || 项.model === 目标功能);
        if (硬件) {
          当前页签.value = "硬件管理";
          打开硬件弹窗(硬件);
        } else {
          const 套餐 = 套餐列表.value.find((项) => 项.id === 目标功能 || 项.code === 目标功能);
          if (套餐) {
            当前页签.value = "套餐管理";
            打开套餐弹窗(套餐);
          } else {
            ElMessage.warning("未找到可维护的产品，可能已删除或归档。");
          }
        }
      }
    } else {
      ElMessage.warning("仅超级管理员可以维护产品价格。");
    }
    // 一次性定位参数必须在进入页面时清理。即使目标产品已归档或未找到，
    // 后续关闭弹窗、保存或刷新也只能停留在产品目录，不能回跳到价格规则页。
    const 其余查询 = { ...路由.query };
    delete 其余查询.editFeature;
    void 路由器.replace({ path: 路由.path, query: 其余查询 });
  }
});

async function 加载() {
  加载中.value = true;
  错误.value = "";
  try {
    const [功能, 硬件, 套餐, 大类, 模块, 映射, 区域结果] = await Promise.all([
      查询功能产品(),
      查询硬件产品(),
      查询产品套餐(),
      查询产品大类(),
      查询产品模块(),
      // 工作量映射接口仅对超级管理员开放，渠道与区管访问产品目录时不再产生无意义 403。
      可维护.value ? 查询工作量映射().catch(() => []) : Promise.resolve([]),
      可维护.value ? 查询区域列表().catch(() => ({ items: [] })) : Promise.resolve({ items: [] }),
    ]);
    功能列表.value = 功能;
    硬件列表.value = 硬件;
    套餐列表.value = 套餐;
    大类列表.value = 大类;
    模块列表.value = 模块;
    区域列表.value = 区域结果.items;
    工作量映射数.value = 映射.length;
  } catch (异常) {
    错误.value = 异常 instanceof Error ? 异常.message : "产品数据加载失败。";
  } finally {
    加载中.value = false;
  }
}

// —— 功能产品维护 ——
function 打开功能弹窗(产品: 功能产品 | null) {
  if (!可维护.value) {
    ElMessage.warning("仅超级管理员可以维护产品目录。");
    return;
  }
  if (!模块列表.value.length) {
    ElMessage.warning("请先维护产品大类与产品模块，再新增功能产品。");
    return;
  }
  编辑中功能.value = 产品;
  功能表单.name = 产品?.name || "";
  功能表单.productCode = 产品?.productCode || "";
  功能表单.moduleId = 产品?.moduleId || 模块列表.value[0]?.id || "";
  功能表单.unit = 产品?.unit || "端点";
  功能表单.priceType = 产品?.priceType === "tiered" ? "tiered" : "fixed";
  功能表单.priceFixed = Number(产品?.priceFixed || 0);
  功能表单.desc = 产品?.desc || "";
  功能表单.required = Boolean(产品?.required);
  功能表单.published = 产品?.published !== false;
  功能表单.priceRatioPrimary = Number(产品?.priceRatioPrimary ?? 100);
  功能表单.priceRatioSecondary = Number(产品?.priceRatioSecondary ?? 110);
  let 修正数 = 0;
  const 标准档位 = 整理重叠档位(历史价格档位(产品?.tiers));
  const 一级档位 = 整理重叠档位(历史价格档位(产品?.priceForPrimary, "primary"));
  const 二级档位 = 整理重叠档位(历史价格档位(产品?.priceForSecondary, "secondary"));
  修正数 += 标准档位.修正数 + 一级档位.修正数 + 二级档位.修正数;
  功能表单.tiers = 标准档位.档位;
  功能表单.一级专用价 = 一级档位.档位;
  功能表单.二级专用价 = 二级档位.档位;
  功能表单.区域覆盖 = (产品?.regionPriceOverrides || []).map((覆盖) => {
    const 区域列表 = Array.from(
      new Set([...(覆盖.regions || []), 覆盖.region || ""].filter(Boolean)),
    );
    const 区域阶梯 = 整理重叠档位(历史价格档位(覆盖.tiers));
    const 区域一级档位 = 整理重叠档位(历史价格档位(覆盖.priceForPrimary, "primary"));
    const 区域二级档位 = 整理重叠档位(历史价格档位(覆盖.priceForSecondary, "secondary"));
    修正数 += 区域阶梯.修正数 + 区域一级档位.修正数 + 区域二级档位.修正数;
    return {
      region: 区域列表[0] || "",
      regions: 区域列表,
      enabled: 覆盖.enabled !== false,
      effectiveFrom: 文本(覆盖.effectiveAt, 覆盖.effectiveFrom, 覆盖.effectiveFromDate),
      effectiveTo: 文本(覆盖.effectiveTo, 覆盖.effectiveToDate),
      tiers: 区域阶梯.档位,
      priceFixed: 覆盖.priceFixed ?? null,
      priceRatioPrimary: 覆盖.priceRatioPrimary ?? null,
      priceRatioSecondary: 覆盖.priceRatioSecondary ?? null,
      priceForPrimary: 区域一级档位.档位,
      priceForSecondary: 区域二级档位.档位,
    };
  });
  档位修正提示.value = 修正数
    ? `检测到 ${修正数} 处历史阶梯档位区间重叠，已按“后一档起始点减 1”临时整理。请核对档位后保存。`
    : "";
  弹窗.value = "功能";
}

function 增加功能阶梯() {
  const 末档 = 功能表单.tiers[功能表单.tiers.length - 1];
  功能表单.tiers.push({
    min: 末档 ? Number(末档.max) + 1 : 1,
    max: 末档 ? Number(末档.max) + 100 : 100,
    price: 0,
  });
}

function 增加区域覆盖() {
  功能表单.区域覆盖.push({
    region: "",
    regions: [],
    enabled: true,
    effectiveFrom: "",
    effectiveTo: "",
    tiers: [],
    priceFixed: null,
    priceRatioPrimary: null,
    priceRatioSecondary: null,
    priceForPrimary: [],
    priceForSecondary: [],
  });
}

/** 同步历史兼容字段，保证老 UI 和报价取价仍能读取首个区域。 */
function 同步区域覆盖(覆盖: 区域覆盖表单) {
  const 区域列表 = Array.from(
    new Set((覆盖.regions || []).map((区域) => String(区域).trim()).filter(Boolean)),
  );
  覆盖.regions = 区域列表;
  覆盖.region = 区域列表[0] || "";
}

function 区域已被其他覆盖使用(区域: string, 当前序号: number): boolean {
  return 功能表单.区域覆盖.some(
    (覆盖, 序号) => 序号 !== 当前序号 && (覆盖.regions || []).includes(区域),
  );
}

function 历史区域选项(覆盖: 区域覆盖表单): string[] {
  return (覆盖.regions || []).filter((区域) => 区域 && !可选区域.value.includes(区域));
}

function 增加渠道专用阶梯(层级: "primary" | "secondary") {
  const 阶梯 = 层级 === "primary" ? 功能表单.一级专用价 : 功能表单.二级专用价;
  const 末档 = 阶梯[阶梯.length - 1];
  阶梯.push({
    min: 末档 ? Number(末档.max) + 1 : 1,
    max: 末档 ? Number(末档.max) + 100 : 100,
    price: 0,
  });
}

function 增加区域渠道阶梯(覆盖: 区域覆盖表单, 层级: "primary" | "secondary") {
  const 阶梯 = 层级 === "primary" ? 覆盖.priceForPrimary : 覆盖.priceForSecondary;
  const 末档 = 阶梯[阶梯.length - 1];
  阶梯.push({
    min: 末档 ? Number(末档.max) + 1 : 1,
    max: 末档 ? Number(末档.max) + 100 : 100,
    price: 0,
  });
}

function 阶梯载荷(阶梯: 阶梯表单[]): Array<{ min: number; max: number; price: number }> | null {
  const 有效档位 = 阶梯
    .map((档) => ({ min: Number(档.min), max: Number(档.max), price: Number(档.price) }))
    .filter((档) => !(档.min === 0 && 档.max === 0))
    .map((档) => ({ ...档, min: 档.min < 1 ? 1 : 档.min }));
  return 有效档位.length ? 有效档位 : null;
}

function 增加区域阶梯(覆盖: 区域覆盖表单) {
  const 阶梯 = 覆盖.tiers || (覆盖.tiers = []);
  const 末档 = 阶梯[阶梯.length - 1];
  阶梯.push({
    min: 末档 ? Number(末档.max) + 1 : 1,
    max: 末档 ? Number(末档.max) + 100 : 100,
    price: 0,
  });
}

async function 提交功能() {
  if (!功能表单.name.trim()) return ElMessage.warning("请填写功能名称。");
  if (!功能表单.moduleId) return ElMessage.warning("请选择所属产品模块。");
  if (功能表单.priceType === "tiered" && !功能表单.tiers.length) {
    return ElMessage.warning("阶梯计价至少需要一档价格。");
  }
  const 标准档位错误 = 档位校验错误(功能表单.tiers, "标准阶梯价");
  if (标准档位错误) return ElMessage.warning(标准档位错误);
  const 一级档位错误 = 档位校验错误(功能表单.一级专用价, "一级渠道专用价");
  if (一级档位错误) return ElMessage.warning(一级档位错误);
  const 二级档位错误 = 档位校验错误(功能表单.二级专用价, "二级渠道专用价");
  if (二级档位错误) return ElMessage.warning(二级档位错误);
  const 已使用区域 = new Set<string>();
  for (const [序号, 覆盖] of 功能表单.区域覆盖.entries()) {
    const 区域列表 = Array.from(
      new Set((覆盖.regions || []).map((区域) => String(区域).trim()).filter(Boolean)),
    );
    if (!区域列表.length) {
      return ElMessage.warning(`第 ${序号 + 1} 个区域覆盖请至少选择一个区域。`);
    }
    for (const 区域 of 区域列表) {
      if (已使用区域.has(区域)) {
        return ElMessage.warning(`区域“${区域}”已在其他覆盖项中配置，请勿重复选择。`);
      }
      已使用区域.add(区域);
    }
    覆盖.regions = 区域列表;
    覆盖.region = 区域列表[0] || "";
    if (覆盖.effectiveFrom && 覆盖.effectiveTo && 覆盖.effectiveFrom > 覆盖.effectiveTo) {
      return ElMessage.warning(`第 ${序号 + 1} 个区域覆盖的生效日期不能晚于失效日期。`);
    }
    const 区域档位错误 =
      档位校验错误(覆盖.tiers, `第 ${序号 + 1} 个区域覆盖的阶梯价`) ||
      档位校验错误(覆盖.priceForPrimary, `第 ${序号 + 1} 个区域覆盖的一级渠道价`) ||
      档位校验错误(覆盖.priceForSecondary, `第 ${序号 + 1} 个区域覆盖的二级渠道价`);
    if (区域档位错误) return ElMessage.warning(区域档位错误);
  }
  提交中.value = true;
  try {
    const 区域覆盖 = 功能表单.区域覆盖.map((覆盖) => ({
      region: String(覆盖.region || "").trim(),
      regions: [...覆盖.regions],
      enabled: 覆盖.enabled !== false,
      effectiveAt: 覆盖.effectiveFrom || null,
      effectiveTo: 覆盖.effectiveTo || null,
      tiers: 阶梯载荷(覆盖.tiers || []) || [],
      priceFixed: 可空数字(覆盖.priceFixed),
      priceRatioPrimary: 可空数字(覆盖.priceRatioPrimary),
      priceRatioSecondary: 可空数字(覆盖.priceRatioSecondary),
      priceForPrimary: 阶梯载荷(覆盖.priceForPrimary),
      priceForSecondary: 阶梯载荷(覆盖.priceForSecondary),
    }));
    await 保存功能产品(
      {
        name: 功能表单.name.trim(),
        productCode: 功能表单.productCode.trim() || 功能表单.name.trim(),
        moduleId: 功能表单.moduleId,
        unit: 功能表单.unit.trim() || "端点",
        priceType: 功能表单.priceType,
        priceFixed: Number(功能表单.priceFixed) || 0,
        desc: 功能表单.desc.trim(),
        required: 功能表单.required,
        published: 功能表单.published,
        priceRatioPrimary: Number(功能表单.priceRatioPrimary) || 100,
        priceRatioSecondary: Number(功能表单.priceRatioSecondary) || 110,
        priceForPrimary: 阶梯载荷(功能表单.一级专用价),
        priceForSecondary: 阶梯载荷(功能表单.二级专用价),
        tiers: 功能表单.priceType === "tiered" ? 阶梯载荷(功能表单.tiers) || [] : [],
        regionPriceOverrides: 区域覆盖,
      },
      编辑中功能.value?.id || "",
    );
    ElMessage.success(编辑中功能.value ? "功能产品已更新。" : "功能产品已创建。");
    弹窗.value = "";
    await 加载();
  } catch (异常) {
    ElMessage.error("保存失败：" + (异常 instanceof Error ? 异常.message : "未知错误"));
  } finally {
    提交中.value = false;
  }
}

// —— 硬件产品维护 ——
function 打开硬件弹窗(产品: 硬件产品 | null) {
  if (!可维护.value) return ElMessage.warning("仅超级管理员可以维护产品目录。");
  编辑中硬件.value = 产品;
  硬件表单.name = 产品?.name || "";
  硬件表单.model = 产品?.model || "";
  硬件表单.unit = 产品?.unit || "台";
  硬件表单.priceFixed = Number(产品?.priceFixed || 0);
  硬件表单.specs = 产品?.specs || "";
  硬件表单.desc = 产品?.desc || "";
  硬件表单.published = 产品?.published !== false;
  弹窗.value = "硬件";
}

async function 提交硬件() {
  if (!硬件表单.name.trim()) return ElMessage.warning("请填写硬件名称。");
  提交中.value = true;
  try {
    await 保存硬件产品(
      {
        name: 硬件表单.name.trim(),
        model: 硬件表单.model.trim() || 硬件表单.name.trim(),
        unit: 硬件表单.unit.trim() || "台",
        priceFixed: Number(硬件表单.priceFixed) || 0,
        specs: 硬件表单.specs.trim(),
        desc: 硬件表单.desc.trim(),
        published: 硬件表单.published,
      },
      编辑中硬件.value?.id || "",
    );
    ElMessage.success(编辑中硬件.value ? "硬件产品已更新。" : "硬件产品已创建。");
    弹窗.value = "";
    await 加载();
  } catch (异常) {
    ElMessage.error("保存失败：" + (异常 instanceof Error ? 异常.message : "未知错误"));
  } finally {
    提交中.value = false;
  }
}

// —— 产品套餐维护 ——
function 打开套餐弹窗(产品: 产品套餐 | null) {
  if (!可维护.value) return ElMessage.warning("仅超级管理员可以维护产品目录。");
  编辑中套餐.value = 产品;
  套餐表单.name = 产品?.name || "";
  套餐表单.code = 产品?.code || "";
  套餐表单.desc = 产品?.desc || "";
  套餐表单.priceFixed = Number(产品?.priceFixed || 0);
  套餐表单.published = 产品?.published !== false;
  套餐表单.模块编号 = [...(产品?.moduleIds || [])];
  套餐表单.功能编号 = [...(产品?.featureIds || [])];
  套餐表单.硬件编号 = [...(产品?.hardwareIds || [])];
  弹窗.value = "套餐";
}

function 切换编号(列表: string[], 编号: string) {
  const 位置 = 列表.indexOf(编号);
  if (位置 >= 0) 列表.splice(位置, 1);
  else 列表.push(编号);
}

async function 提交套餐() {
  if (!套餐表单.name.trim()) return ElMessage.warning("请填写套餐名称。");
  提交中.value = true;
  try {
    await 保存产品套餐(
      {
        name: 套餐表单.name.trim(),
        code: 套餐表单.code.trim() || 套餐表单.name.trim(),
        desc: 套餐表单.desc.trim(),
        priceFixed: Number(套餐表单.priceFixed) || 0,
        published: 套餐表单.published,
        moduleIds: 套餐表单.模块编号,
        featureIds: 套餐表单.功能编号,
        hardwareIds: 套餐表单.硬件编号,
      },
      编辑中套餐.value?.id || "",
    );
    ElMessage.success(编辑中套餐.value ? "产品套餐已更新。" : "产品套餐已创建。");
    弹窗.value = "";
    await 加载();
  } catch (异常) {
    ElMessage.error("保存失败：" + (异常 instanceof Error ? 异常.message : "未知错误"));
  } finally {
    提交中.value = false;
  }
}

// —— 产品大类 / 模块维护 ——
function 打开大类弹窗(大类: 产品大类 | null) {
  if (!可维护.value) return ElMessage.warning("仅超级管理员可以维护产品目录。");
  编辑中大类.value = 大类;
  大类表单.name = 大类?.name || "";
  大类表单.code = 大类?.code || "";
  大类表单.type = 大类?.type || "software";
  大类表单.sort = Number(大类?.sort || 0);
  弹窗.value = "大类";
}

async function 提交大类() {
  if (!大类表单.name.trim()) return ElMessage.warning("请填写大类名称。");
  提交中.value = true;
  try {
    await 保存产品大类(
      {
        name: 大类表单.name.trim(),
        code: 大类表单.code.trim() || 大类表单.name.trim(),
        type: 大类表单.type,
        sort: Number(大类表单.sort) || 0,
      },
      编辑中大类.value?.id || "",
    );
    ElMessage.success(编辑中大类.value ? "产品大类已更新。" : "产品大类已创建。");
    弹窗.value = "";
    await 加载();
  } catch (异常) {
    ElMessage.error("保存失败：" + (异常 instanceof Error ? 异常.message : "未知错误"));
  } finally {
    提交中.value = false;
  }
}

function 打开模块弹窗(模块: 产品模块 | null) {
  if (!可维护.value) return ElMessage.warning("仅超级管理员可以维护产品目录。");
  if (!大类列表.value.length) return ElMessage.warning("请先新建产品大类。");
  编辑中模块.value = 模块;
  模块表单.name = 模块?.name || "";
  模块表单.code = 模块?.code || "";
  模块表单.categoryId = 模块?.categoryId || 大类列表.value[0]?.id || "";
  模块表单.sort = Number(模块?.sort || 0);
  弹窗.value = "模块";
}

async function 提交模块() {
  if (!模块表单.name.trim()) return ElMessage.warning("请填写模块名称。");
  if (!模块表单.categoryId) return ElMessage.warning("请选择所属产品大类。");
  提交中.value = true;
  try {
    await 保存产品模块(
      {
        name: 模块表单.name.trim(),
        code: 模块表单.code.trim() || 模块表单.name.trim(),
        categoryId: 模块表单.categoryId,
        sort: Number(模块表单.sort) || 0,
      },
      编辑中模块.value?.id || "",
    );
    ElMessage.success(编辑中模块.value ? "产品模块已更新。" : "产品模块已创建。");
    弹窗.value = "";
    await 加载();
  } catch (异常) {
    ElMessage.error("保存失败：" + (异常 instanceof Error ? 异常.message : "未知错误"));
  } finally {
    提交中.value = false;
  }
}

void 工作量映射数;
</script>

<template>
  <div class="vui war-artboard war-artboard-flow 产品页">
    <WarKpis :items="指标" :加载中="加载中" />

    <section class="panel 产品面板">
      <header class="panel-head">
        <div>
          <h2>产品与套餐</h2>
          <p>
            {{
              内部管理员
                ? "产品目录承担对外报价与内部成本的双重职责，功能、硬件、套餐与价格规则统一在此维护。"
                : "浏览在售软件功能、硬件与套餐，可在报价单中直接选型并使用系统计价。"
            }}
          </p>
        </div>
        <div class="产品维护入口">
          <span class="war-count">共 {{ 全部条目.length }} 项</span>
          <button
            v-if="内部管理员"
            type="button"
            class="button primary"
            @click="路由器.push('/admin/products/pricing')"
          >
            价格规则维护
          </button>
          <button v-if="内部管理员" type="button" class="button" @click="加载">刷新</button>
        </div>
      </header>

      <nav class="产品子目录" aria-label="产品维护子目录">
        <button
          v-for="项 in 页签列表"
          :key="项"
          type="button"
          class="产品子目录项"
          :class="{ active: 当前页签 === 项 }"
          @click="切换页签(项)"
        >
          <span class="产品子目录图标">{{ 页签图标[项] }}</span
          >{{ 项 }}
        </button>
      </nav>

      <div class="panel-body">
        <div v-if="加载中" class="war-empty">正在加载产品目录…</div>
        <div v-else-if="错误" class="war-empty">{{ 错误 }}</div>

        <!-- 子目录一：产品目录（大类 → 模块 → 功能 三层下钻，与老 UI 结构一致） -->
        <template v-else-if="当前页签 === '产品目录'">
          <div class="目录工具条">
            <div class="目录面包屑">
              <button type="button" class="link" @click="((目录大类 = null), (目录模块 = null))">
                产品目录
              </button>
              <template v-if="目录大类">
                <span>/</span>
                <button type="button" class="link" @click="目录模块 = null">
                  {{ 大类图标(目录大类) }} {{ 目录大类.name }}
                </button>
              </template>
              <template v-if="目录模块">
                <span>/</span>
                <strong>{{ 模块图标(目录模块) }} {{ 目录模块.name }}</strong>
              </template>
              <button v-if="目录大类" type="button" class="link 返回上层" @click="返回目录上层">
                ← 返回
              </button>
            </div>
            <div class="目录工具条右侧">
              <button
                v-if="可维护 && !目录大类"
                type="button"
                class="button small"
                @click="打开大类弹窗(null)"
              >
                + 新增大类
              </button>
              <button
                v-if="可维护 && 目录大类 && !目录模块"
                type="button"
                class="button small"
                @click="打开模块弹窗(null)"
              >
                + 新增模块
              </button>
              <button
                v-if="可维护 && 目录模块"
                type="button"
                class="button primary small"
                @click="打开功能弹窗(null)"
              >
                + 新增功能
              </button>
              <button
                v-if="可维护 && !目录大类"
                type="button"
                class="button small"
                @click="打开硬件弹窗(null)"
              >
                + 新增硬件
              </button>
            </div>
          </div>

          <div class="目录检索行">
            <div class="field search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              <input v-model="目录搜索词" placeholder="搜索当前目录的名称、编码或说明" />
            </div>
            <span class="war-count">共 {{ 目录结果总数 }} 项</span>
          </div>

          <div v-if="!目录大类" class="目录网格">
            <article
              v-for="大类 in 目录展示大类"
              :key="大类.id"
              class="目录卡"
              @click="打开目录大类(大类)"
            >
              <div class="目录卡头">
                <span class="目录卡图标">{{ 大类图标(大类) }}</span>
                <div class="目录卡文字">
                  <strong class="目录卡名称">{{ 大类.name }}</strong>
                  <p class="目录卡描述">{{ 文本(大类.desc, "暂无描述") }}</p>
                </div>
              </div>
              <div class="目录卡标签">
                <span class="标签" :class="大类.type === 'hardware' ? '紫' : '蓝'">
                  {{ 大类.type === "hardware" ? "硬件" : "软件" }}
                </span>
                <span class="标签 灰">{{ 取大类模块数(大类.id) }} 模块</span>
                <span class="标签 灰">{{ 取大类功能数(大类.id) }} 功能</span>
              </div>
              <span class="目录卡箭头">→</span>
            </article>
            <p v-if="!目录过滤大类.length" class="war-note">没有符合条件的产品大类。</p>
          </div>

          <template v-else-if="!目录模块">
            <div class="目录网格">
              <article
                v-for="模块 in 目录展示模块"
                :key="模块.id"
                class="目录卡"
                @click="打开目录模块(模块)"
              >
                <div class="目录卡头">
                  <span class="目录卡图标">{{ 模块图标(模块) }}</span>
                  <div class="目录卡文字">
                    <strong class="目录卡名称">{{ 模块.name }}</strong>
                    <p class="目录卡描述">{{ 文本(模块.desc, "暂无描述") }}</p>
                  </div>
                </div>
                <div class="目录卡标签">
                  <span class="标签 蓝">{{ 取模块功能数(模块.id) }} 功能</span>
                  <span v-if="模块.published === false" class="标签 橙">待发布</span>
                </div>
                <span class="目录卡箭头">→</span>
              </article>
              <p v-if="!目录过滤模块.length" class="war-note">没有符合条件的模块。</p>
            </div>
          </template>

          <div v-else class="目录网格 功能网格">
            <article v-for="功能 in 目录展示功能" :key="功能.id" class="目录卡 静态卡">
              <div class="目录卡头">
                <span class="目录卡图标">⚙️</span>
                <div class="目录卡文字">
                  <strong class="目录卡名称">{{ 功能.name }}</strong>
                  <p class="目录卡编码">{{ 文本(功能.productCode, "未填写产品编码") }}</p>
                </div>
              </div>
              <div class="目录卡标签">
                <span v-if="功能.required" class="标签 红">必选</span>
                <span v-if="功能.published === false" class="标签 橙">待发布</span>
                <span v-if="内部管理员 && 功能.tiers?.length" class="标签 灰">
                  {{ 功能.tiers.length }} 档阶梯价
                </span>
                <span v-if="内部管理员 && 功能.regionPriceOverrides?.length" class="标签 灰">
                  {{ 功能.regionPriceOverrides.length }} 个区域覆盖
                </span>
              </div>
              <p class="目录卡描述">{{ 文本(功能.desc, "暂无产品说明。") }}</p>
              <div v-if="内部管理员" class="价格块">
                <template v-if="功能.priceType === 'tiered' && 功能.tiers?.length">
                  <span v-for="(档, 序号) in 功能.tiers" :key="序号" class="价格档">
                    {{ 文本(档.min) }}–{{ 文本(档.max) }}：{{ 金额文本(档.price) }}
                  </span>
                </template>
                <strong v-else class="价格主">
                  {{ 金额文本(功能.priceFixed) }}<small>/{{ 文本(功能.unit, "套") }}</small>
                </strong>
              </div>
              <div v-if="可维护" class="目录卡操作" @click.stop>
                <button type="button" class="link" @click="打开功能弹窗(功能)">编辑</button>
                <button
                  type="button"
                  class="link"
                  @click="切换大类模块发布('features', 功能.id, 功能.published !== false)"
                >
                  {{ 功能.published === false ? "发布" : "下架" }}
                </button>
                <button
                  type="button"
                  class="link danger"
                  @click="归档条目('features', 功能.id, 功能.name)"
                >
                  删除
                </button>
              </div>
            </article>
            <p v-if="!目录过滤功能.length" class="war-note">没有符合条件的功能产品。</p>
          </div>

          <div v-if="!目录大类 && !目录搜索词 && 目录展示硬件.length" class="目录分区">
            <h3 class="目录分区标题">🖥️ 硬件产品</h3>
            <div class="目录网格">
              <article v-for="硬件 in 目录展示硬件" :key="硬件.id" class="目录卡 静态卡">
                <div class="目录卡头">
                  <span class="目录卡图标">🖥️</span>
                  <div class="目录卡文字">
                    <strong class="目录卡名称">{{ 硬件.name }}</strong>
                    <p class="目录卡编码">{{ 文本(硬件.model, "未填写型号") }}</p>
                  </div>
                </div>
                <p class="目录卡描述">{{ 文本(硬件.desc, "暂无产品说明。") }}</p>
                <div v-if="内部管理员" class="价格块">
                  <strong class="价格主">
                    {{ 金额文本(硬件.priceFixed) }}<small>/{{ 文本(硬件.unit, "台") }}</small>
                  </strong>
                </div>
              </article>
            </div>
          </div>
          <div v-if="目录总页数 > 1" class="目录分页">
            <button
              type="button"
              class="button small"
              :disabled="目录页码 <= 1"
              @click="目录页码 -= 1"
            >
              上一页
            </button>
            <span>第 {{ 目录页码 }} / {{ 目录总页数 }} 页</span>
            <button
              type="button"
              class="button small"
              :disabled="目录页码 >= 目录总页数"
              @click="目录页码 += 1"
            >
              下一页
            </button>
          </div>
        </template>

        <!-- 子目录二：大类管理 -->
        <template v-else-if="当前页签 === '大类管理'">
          <div class="目录工具条">
            <div class="目录面包屑">
              <strong>产品大类管理</strong>
              <span class="war-count">共 {{ 大类列表.length }} 个</span>
            </div>
            <div class="目录工具条右侧">
              <button
                v-if="可维护"
                type="button"
                class="button primary small"
                @click="打开大类弹窗(null)"
              >
                + 新增大类
              </button>
            </div>
          </div>
          <div class="目录网格">
            <article v-for="大类 in 大类列表" :key="大类.id" class="目录卡 静态卡">
              <div class="目录卡头">
                <span class="目录卡图标">{{ 大类图标(大类) }}</span>
                <div class="目录卡文字">
                  <strong class="目录卡名称">{{ 大类.name }}</strong>
                  <p class="目录卡描述">{{ 文本(大类.desc, "暂无描述") }}</p>
                </div>
              </div>
              <div class="目录卡标签">
                <span class="标签" :class="大类.type === 'hardware' ? '紫' : '蓝'">
                  {{ 大类.type === "hardware" ? "硬件" : "软件" }}
                </span>
                <span class="标签 灰">{{ 取大类模块数(大类.id) }} 模块</span>
                <span class="标签 灰">{{ 取大类功能数(大类.id) }} 功能</span>
              </div>
              <div v-if="可维护" class="目录卡操作">
                <button type="button" class="link" @click="打开大类弹窗(大类)">编辑</button>
                <button
                  type="button"
                  class="link danger"
                  @click="归档条目('categories', 大类.id, 大类.name)"
                >
                  删除
                </button>
              </div>
            </article>
            <p v-if="!大类列表.length" class="war-note">暂无产品大类，请先新建。</p>
          </div>
        </template>

        <!-- 子目录三：模块管理 -->
        <template v-else-if="当前页签 === '模块管理'">
          <div class="目录工具条">
            <div class="目录筛选">
              <select v-model="模块筛选大类" class="目录下拉">
                <option value="全部">全部大类</option>
                <option v-for="大类 in 大类列表" :key="大类.id" :value="大类.id">
                  {{ 大类.name }}
                </option>
              </select>
              <span class="war-count">共 {{ 模块管理列表.length }} 个模块</span>
            </div>
            <div class="目录工具条右侧">
              <button
                v-if="可维护"
                type="button"
                class="button primary small"
                @click="打开模块弹窗(null)"
              >
                + 新增模块
              </button>
            </div>
          </div>
          <div class="目录网格">
            <article v-for="模块 in 模块管理列表" :key="模块.id" class="目录卡 静态卡">
              <div class="目录卡头">
                <span class="目录卡图标">{{ 模块图标(模块) }}</span>
                <div class="目录卡文字">
                  <strong class="目录卡名称">{{ 模块.name }}</strong>
                  <p class="目录卡描述">{{ 文本(模块.desc, "暂无描述") }}</p>
                </div>
              </div>
              <div class="目录卡标签">
                <span class="标签 灰">{{ 取大类名称(模块.categoryId) || "未归属大类" }}</span>
                <span class="标签 蓝">{{ 取模块功能数(模块.id) }} 功能</span>
                <span v-if="模块.published === false" class="标签 橙">待发布</span>
              </div>
              <div v-if="可维护" class="目录卡操作">
                <button type="button" class="link" @click="打开模块弹窗(模块)">编辑</button>
                <button
                  type="button"
                  class="link danger"
                  @click="归档条目('modules', 模块.id, 模块.name)"
                >
                  删除
                </button>
              </div>
            </article>
            <p v-if="!模块管理列表.length" class="war-note">暂无产品模块，请先新建。</p>
          </div>
        </template>

        <!-- 子目录四：功能管理 -->
        <template v-else-if="当前页签 === '功能管理'">
          <div class="目录工具条">
            <div class="目录筛选">
              <select v-model="功能筛选模块" class="目录下拉">
                <option value="全部">全部模块</option>
                <option v-for="模块 in 模块列表" :key="模块.id" :value="模块.id">
                  {{ 取大类名称(模块.categoryId) }} / {{ 模块.name }}
                </option>
              </select>
              <div class="field search">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" />
                </svg>
                <input v-model="搜索词" placeholder="搜索功能名称、编码或说明" />
              </div>
              <span class="war-count">共 {{ 功能管理列表.length }} 项</span>
            </div>
            <div class="目录工具条右侧">
              <button
                v-if="可维护"
                type="button"
                class="button primary small"
                @click="打开功能弹窗(null)"
              >
                + 新增功能
              </button>
            </div>
          </div>
          <div class="目录网格 功能网格">
            <article v-for="功能 in 功能管理列表" :key="功能.id" class="目录卡 静态卡">
              <div class="目录卡头">
                <span class="目录卡图标">⚙️</span>
                <div class="目录卡文字">
                  <strong class="目录卡名称">{{ 功能.name }}</strong>
                  <p class="目录卡编码">{{ 文本(功能.productCode, "未填写产品编码") }}</p>
                </div>
              </div>
              <div class="目录卡标签">
                <span class="标签 灰"
                  >{{ 模块所属大类(功能.moduleId) }} / {{ 取模块名称(功能.moduleId) }}</span
                >
                <span v-if="功能.required" class="标签 红">必选</span>
                <span v-if="功能.published === false" class="标签 橙">待发布</span>
                <span v-if="功能.tiers?.length" class="标签 灰"
                  >{{ 功能.tiers.length }} 档阶梯价</span
                >
                <span v-if="功能.regionPriceOverrides?.length" class="标签 灰">
                  {{ 功能.regionPriceOverrides.length }} 个区域覆盖
                </span>
              </div>
              <p class="目录卡描述">{{ 文本(功能.desc, "暂无产品说明。") }}</p>
              <div class="价格块">
                <template v-if="功能.priceType === 'tiered' && 功能.tiers?.length">
                  <span v-for="(档, 序号) in 功能.tiers" :key="序号" class="价格档">
                    {{ 文本(档.min) }}–{{ 文本(档.max) }}：{{ 金额文本(档.price) }}
                  </span>
                </template>
                <strong v-else class="价格主">
                  {{ 金额文本(功能.priceFixed) }}<small>/{{ 文本(功能.unit, "套") }}</small>
                </strong>
              </div>
              <div v-if="可维护" class="目录卡操作">
                <button type="button" class="link" @click="打开功能弹窗(功能)">编辑</button>
                <button
                  type="button"
                  class="link"
                  @click="切换大类模块发布('features', 功能.id, 功能.published !== false)"
                >
                  {{ 功能.published === false ? "发布" : "下架" }}
                </button>
                <button
                  type="button"
                  class="link danger"
                  @click="归档条目('features', 功能.id, 功能.name)"
                >
                  删除
                </button>
              </div>
            </article>
            <p v-if="!功能管理列表.length" class="war-note">没有符合条件的功能产品。</p>
          </div>
        </template>

        <!-- 子目录五：硬件管理 -->
        <template v-else-if="当前页签 === '硬件管理'">
          <div class="目录工具条">
            <div class="目录筛选">
              <div class="field search">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" />
                </svg>
                <input v-model="硬件搜索词" placeholder="搜索硬件名称、型号或规格" />
              </div>
              <span class="war-count">共 {{ 硬件管理列表.length }} 款</span>
            </div>
            <div class="目录工具条右侧">
              <button
                v-if="可维护"
                type="button"
                class="button primary small"
                @click="打开硬件弹窗(null)"
              >
                + 新增硬件
              </button>
            </div>
          </div>
          <div class="目录网格">
            <article v-for="硬件 in 硬件管理列表" :key="硬件.id" class="目录卡 静态卡">
              <div class="目录卡头">
                <span class="目录卡图标">🖥️</span>
                <div class="目录卡文字">
                  <strong class="目录卡名称">{{ 硬件.name }}</strong>
                  <p class="目录卡编码">{{ 文本(硬件.model, "未填写型号") }}</p>
                </div>
              </div>
              <div class="目录卡标签">
                <span class="标签 灰">{{ 文本(硬件.specs, "未填写规格") }}</span>
                <span v-if="硬件.published === false" class="标签 橙">待发布</span>
              </div>
              <p class="目录卡描述">{{ 文本(硬件.desc, "暂无产品说明。") }}</p>
              <div class="价格块">
                <strong class="价格主">
                  {{ 金额文本(硬件.priceFixed) }}<small>/{{ 文本(硬件.unit, "台") }}</small>
                </strong>
              </div>
              <div v-if="可维护" class="目录卡操作">
                <button type="button" class="link" @click="打开硬件弹窗(硬件)">编辑</button>
                <button
                  type="button"
                  class="link"
                  @click="切换大类模块发布('hardware', 硬件.id, 硬件.published !== false)"
                >
                  {{ 硬件.published === false ? "发布" : "下架" }}
                </button>
                <button
                  type="button"
                  class="link danger"
                  @click="归档条目('hardware', 硬件.id, 硬件.name)"
                >
                  删除
                </button>
              </div>
            </article>
            <p v-if="!硬件管理列表.length" class="war-note">暂无硬件产品，请先新建。</p>
          </div>
        </template>

        <!-- 子目录六：套餐管理 -->
        <template v-else-if="当前页签 === '套餐管理'">
          <div class="目录工具条">
            <div class="目录筛选">
              <div class="field search">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" />
                </svg>
                <input v-model="套餐搜索词" placeholder="搜索套餐名称或编码" />
              </div>
              <span class="war-count">共 {{ 套餐管理列表.length }} 个</span>
            </div>
            <div class="目录工具条右侧">
              <button
                v-if="可维护"
                type="button"
                class="button primary small"
                @click="打开套餐弹窗(null)"
              >
                + 新增套餐
              </button>
            </div>
          </div>
          <div class="目录网格">
            <article v-for="套餐 in 套餐管理列表" :key="套餐.id" class="目录卡 静态卡">
              <div class="目录卡头">
                <span class="目录卡图标">📦</span>
                <div class="目录卡文字">
                  <strong class="目录卡名称">{{ 套餐.name }}</strong>
                  <p class="目录卡编码">{{ 文本(套餐.code, "未填写套餐编码") }}</p>
                </div>
              </div>
              <div class="目录卡标签">
                <span class="标签 蓝">{{ (套餐.moduleIds || []).length }} 模块</span>
                <span class="标签 绿">{{ (套餐.featureIds || []).length }} 功能</span>
                <span class="标签 紫">{{ (套餐.hardwareIds || []).length }} 硬件</span>
                <span v-if="套餐.published === false" class="标签 橙">待发布</span>
              </div>
              <p class="目录卡描述">{{ 文本(套餐.desc, "暂无套餐说明。") }}</p>
              <div v-if="可维护" class="目录卡操作">
                <button type="button" class="link" @click="打开套餐弹窗(套餐)">编辑</button>
                <button
                  type="button"
                  class="link"
                  @click="切换大类模块发布('packages', 套餐.id, 套餐.published !== false)"
                >
                  {{ 套餐.published === false ? "发布" : "下架" }}
                </button>
                <button
                  type="button"
                  class="link danger"
                  @click="归档条目('packages', 套餐.id, 套餐.name)"
                >
                  删除
                </button>
              </div>
            </article>
            <p v-if="!套餐管理列表.length" class="war-note">暂无产品套餐，请先新建。</p>
          </div>
        </template>

        <!-- 子目录七：人天与工作量配置 -->
        <template v-else-if="当前页签 === '工作量配置'">
          <div class="目录工具条">
            <div class="目录面包屑">
              <strong>人天与工作量配置</strong>
              <span class="war-count">已配置 {{ 工作量映射数 }} 条产品映射</span>
            </div>
          </div>
          <div class="工作量入口">
            <p class="war-note">
              人天与工作量配置包含产品工作量映射、交付标签与实施工作量规则，独立页面维护，
              报价试算按此命中交付工作量。
            </p>
            <button
              type="button"
              class="button primary"
              @click="路由器.push('/admin/workload-config')"
            >
              打开人天与工作量配置
            </button>
          </div>
        </template>

        <!-- 区域管理员：推荐套餐（只读） -->
        <template v-else>
          <div class="目录工具条">
            <div class="目录面包屑">
              <strong>推荐套餐</strong>
              <span class="war-count">共 {{ 套餐列表.length }} 个</span>
            </div>
          </div>
          <div class="目录网格">
            <article v-for="套餐 in 套餐列表" :key="套餐.id" class="目录卡 静态卡">
              <div class="目录卡头">
                <span class="目录卡图标">📦</span>
                <div class="目录卡文字">
                  <strong class="目录卡名称">{{ 套餐.name }}</strong>
                  <p class="目录卡编码">{{ 文本(套餐.code, "未填写套餐编码") }}</p>
                </div>
              </div>
              <div class="目录卡标签">
                <span class="标签 蓝">{{ (套餐.moduleIds || []).length }} 模块</span>
                <span class="标签 绿">{{ (套餐.featureIds || []).length }} 功能</span>
                <span class="标签 紫">{{ (套餐.hardwareIds || []).length }} 硬件</span>
              </div>
              <p class="目录卡描述">{{ 文本(套餐.desc, "暂无套餐说明。") }}</p>
            </article>
            <p v-if="!套餐列表.length" class="war-note">暂无推荐套餐。</p>
          </div>
        </template>
      </div>
    </section>

    <!-- 功能产品弹窗 -->
    <div v-if="弹窗 === '功能'" class="弹窗遮罩" @click.self="弹窗 = ''">
      <section class="产品弹窗 宽弹窗">
        <header>
          <div>
            <h2>{{ 编辑中功能 ? "编辑功能产品" : "新建功能产品" }}</h2>
            <p>阶梯价、区域覆盖与渠道比例会直接影响报价试算结果。</p>
          </div>
          <button type="button" @click="弹窗 = ''">×</button>
        </header>
        <div class="弹窗表单">
          <p v-if="档位修正提示" class="war-note 档位修正提示" role="status">
            {{ 档位修正提示 }}
          </p>
          <label
            ><span>功能名称 *</span
            ><input v-model="功能表单.name" placeholder="如：网络准入控制（NAC）"
          /></label>
          <label
            ><span>产品编码</span><input v-model="功能表单.productCode" placeholder="如：UA-NAC-1"
          /></label>
          <label>
            <span>所属模块 *</span>
            <select v-model="功能表单.moduleId">
              <option v-for="模块 in 模块列表" :key="模块.id" :value="模块.id">
                {{ 取大类名称(模块.categoryId) }} / {{ 模块.name }}
              </option>
            </select>
          </label>
          <label
            ><span>计价单位</span><input v-model="功能表单.unit" placeholder="端点 / 月 / 套"
          /></label>
          <label>
            <span>价格类型</span>
            <select v-model="功能表单.priceType">
              <option value="fixed">固定价</option>
              <option value="tiered">阶梯计价</option>
            </select>
          </label>
          <label
            ><span>固定价</span><input v-model.number="功能表单.priceFixed" type="number" min="0"
          /></label>
          <label
            ><span>一级渠道比例（%）</span
            ><input v-model.number="功能表单.priceRatioPrimary" type="number"
          /></label>
          <label
            ><span>二级渠道比例（%）</span
            ><input v-model.number="功能表单.priceRatioSecondary" type="number"
          /></label>
          <label class="全宽"
            ><span>功能说明</span><textarea v-model="功能表单.desc" rows="2" />
          </label>
          <label class="全宽 复选行">
            <span><input v-model="功能表单.required" type="checkbox" /> 必选功能</span>
            <span><input v-model="功能表单.published" type="checkbox" /> 立即发布</span>
          </label>

          <div class="全宽 子表单">
            <div class="子表单头">
              <strong>渠道等级专用价</strong>
              <span class="war-note">留空时按一级 / 二级渠道比例折算基础阶梯价。</span>
            </div>
            <div class="渠道等级价网格">
              <div>
                <div class="子表单头">
                  <strong>一级渠道专用价</strong>
                  <button type="button" class="link" @click="增加渠道专用阶梯('primary')">
                    + 添加档位
                  </button>
                </div>
                <div
                  v-for="(档, 序号) in 功能表单.一级专用价"
                  :key="`primary-${序号}`"
                  class="三列表格"
                >
                  <input v-model.number="档.min" type="number" placeholder="起始点" />
                  <input v-model.number="档.max" type="number" placeholder="结束点" />
                  <input v-model.number="档.price" type="number" placeholder="渠道单价" />
                  <button
                    type="button"
                    class="link danger"
                    @click="功能表单.一级专用价.splice(序号, 1)"
                  >
                    删除
                  </button>
                </div>
                <p v-if="!功能表单.一级专用价.length" class="war-note">
                  未配置时按一级渠道比例折算。
                </p>
              </div>
              <div>
                <div class="子表单头">
                  <strong>二级渠道专用价</strong>
                  <button type="button" class="link" @click="增加渠道专用阶梯('secondary')">
                    + 添加档位
                  </button>
                </div>
                <div
                  v-for="(档, 序号) in 功能表单.二级专用价"
                  :key="`secondary-${序号}`"
                  class="三列表格"
                >
                  <input v-model.number="档.min" type="number" placeholder="起始点" />
                  <input v-model.number="档.max" type="number" placeholder="结束点" />
                  <input v-model.number="档.price" type="number" placeholder="渠道单价" />
                  <button
                    type="button"
                    class="link danger"
                    @click="功能表单.二级专用价.splice(序号, 1)"
                  >
                    删除
                  </button>
                </div>
                <p v-if="!功能表单.二级专用价.length" class="war-note">
                  未配置时按二级渠道比例折算。
                </p>
              </div>
            </div>
          </div>

          <div v-if="功能表单.priceType === 'tiered'" class="全宽 子表单">
            <div class="子表单头">
              <strong>阶梯价</strong>
              <button type="button" class="link" @click="增加功能阶梯">+ 添加档位</button>
            </div>
            <div v-for="(档, 序号) in 功能表单.tiers" :key="序号" class="三列表格">
              <input v-model.number="档.min" type="number" placeholder="起始点" />
              <input v-model.number="档.max" type="number" placeholder="结束点" />
              <input v-model.number="档.price" type="number" placeholder="单价" />
              <button type="button" class="link danger" @click="功能表单.tiers.splice(序号, 1)">
                删除
              </button>
            </div>
            <p v-if="!功能表单.tiers.length" class="war-note">尚未添加阶梯价档位。</p>
          </div>

          <div class="全宽 子表单">
            <div class="子表单头">
              <strong>区域价格覆盖</strong>
              <button type="button" class="link" @click="增加区域覆盖">+ 添加区域</button>
            </div>
            <div v-for="(覆盖, 序号) in 功能表单.区域覆盖" :key="序号" class="区域覆盖编辑">
              <div class="三列表格">
                <el-select
                  v-model="覆盖.regions"
                  class="区域多选"
                  aria-label="生效区域"
                  multiple
                  filterable
                  clearable
                  collapse-tags
                  collapse-tags-tooltip
                  placeholder="请选择一个或多个生效区域"
                  @change="同步区域覆盖(覆盖)"
                >
                  <el-option
                    v-for="区域名称 in 可选区域"
                    :key="区域名称"
                    :label="区域名称"
                    :value="区域名称"
                    :disabled="区域已被其他覆盖使用(区域名称, 序号)"
                  />
                  <el-option
                    v-for="区域名称 in 历史区域选项(覆盖)"
                    :key="`历史-${区域名称}`"
                    :label="`${区域名称}（历史区域）`"
                    :value="区域名称"
                  />
                </el-select>
                <input
                  v-model.number="覆盖.priceFixed"
                  type="number"
                  placeholder="覆盖固定价（可空）"
                />
                <button
                  type="button"
                  class="link danger"
                  @click="功能表单.区域覆盖.splice(序号, 1)"
                >
                  删除区域
                </button>
              </div>
              <div class="三列表格 区域有效期">
                <label>
                  <span>生效日期</span>
                  <input v-model="覆盖.effectiveFrom" type="date" />
                </label>
                <label>
                  <span>失效日期</span>
                  <input v-model="覆盖.effectiveTo" type="date" />
                </label>
                <span class="war-note">留空表示立即生效或长期有效；同一区域有效期不能重叠。</span>
              </div>
              <div class="三列表格">
                <input
                  v-model.number="覆盖.priceRatioPrimary"
                  type="number"
                  placeholder="一级比例 %（可空）"
                />
                <input
                  v-model.number="覆盖.priceRatioSecondary"
                  type="number"
                  placeholder="二级比例 %（可空）"
                />
                <button type="button" class="link" @click="增加区域阶梯(覆盖)">+ 覆盖阶梯</button>
              </div>
              <div v-for="(档, 档序) in 覆盖.tiers || []" :key="档序" class="三列表格">
                <input v-model.number="档.min" type="number" placeholder="起始点" />
                <input v-model.number="档.max" type="number" placeholder="结束点" />
                <input v-model.number="档.price" type="number" placeholder="覆盖单价" />
                <button type="button" class="link danger" @click="覆盖.tiers?.splice(档序, 1)">
                  删除
                </button>
              </div>
              <div class="区域渠道价块">
                <div class="子表单头">
                  <strong>区域渠道等级专用价</strong>
                  <span class="war-note">留空时使用区域阶梯并按区域渠道比例折算。</span>
                </div>
                <div class="渠道等级价网格">
                  <div>
                    <div class="子表单头">
                      <strong>一级渠道</strong>
                      <button type="button" class="link" @click="增加区域渠道阶梯(覆盖, 'primary')">
                        + 添加档位
                      </button>
                    </div>
                    <div
                      v-for="(档, 档序) in 覆盖.priceForPrimary"
                      :key="`region-primary-${档序}`"
                      class="三列表格"
                    >
                      <input v-model.number="档.min" type="number" placeholder="起始点" />
                      <input v-model.number="档.max" type="number" placeholder="结束点" />
                      <input v-model.number="档.price" type="number" placeholder="一级渠道单价" />
                      <button
                        type="button"
                        class="link danger"
                        @click="覆盖.priceForPrimary.splice(档序, 1)"
                      >
                        删除
                      </button>
                    </div>
                    <p v-if="!覆盖.priceForPrimary.length" class="war-note">
                      未配置区域一级专用价。
                    </p>
                  </div>
                  <div>
                    <div class="子表单头">
                      <strong>二级渠道</strong>
                      <button
                        type="button"
                        class="link"
                        @click="增加区域渠道阶梯(覆盖, 'secondary')"
                      >
                        + 添加档位
                      </button>
                    </div>
                    <div
                      v-for="(档, 档序) in 覆盖.priceForSecondary"
                      :key="`region-secondary-${档序}`"
                      class="三列表格"
                    >
                      <input v-model.number="档.min" type="number" placeholder="起始点" />
                      <input v-model.number="档.max" type="number" placeholder="结束点" />
                      <input v-model.number="档.price" type="number" placeholder="二级渠道单价" />
                      <button
                        type="button"
                        class="link danger"
                        @click="覆盖.priceForSecondary.splice(档序, 1)"
                      >
                        删除
                      </button>
                    </div>
                    <p v-if="!覆盖.priceForSecondary.length" class="war-note">
                      未配置区域二级专用价。
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <p v-if="!功能表单.区域覆盖.length" class="war-note">
              未配置区域覆盖时，全国统一按标准价执行。
            </p>
          </div>
        </div>
        <footer>
          <button class="次要按钮" type="button" @click="弹窗 = ''">取消</button>
          <button class="主按钮" type="button" :disabled="提交中" @click="提交功能">
            {{ 提交中 ? "保存中…" : "保存功能产品" }}
          </button>
        </footer>
      </section>
    </div>

    <!-- 硬件产品弹窗 -->
    <div v-if="弹窗 === '硬件'" class="弹窗遮罩" @click.self="弹窗 = ''">
      <section class="产品弹窗">
        <header>
          <div>
            <h2>{{ 编辑中硬件 ? "编辑硬件产品" : "新建硬件产品" }}</h2>
            <p>硬件价格用于报价与收益核算。</p>
          </div>
          <button type="button" @click="弹窗 = ''">×</button>
        </header>
        <div class="弹窗表单">
          <label
            ><span>硬件名称 *</span><input v-model="硬件表单.name" placeholder="如：微盾探针一体机"
          /></label>
          <label><span>型号</span><input v-model="硬件表单.model" /></label>
          <label><span>单位</span><input v-model="硬件表单.unit" /></label>
          <label
            ><span>价格</span><input v-model.number="硬件表单.priceFixed" type="number" min="0"
          /></label>
          <label class="全宽"><span>规格</span><input v-model="硬件表单.specs" /></label>
          <label class="全宽"><span>说明</span><textarea v-model="硬件表单.desc" rows="2" /></label>
          <label class="全宽 复选行"
            ><span><input v-model="硬件表单.published" type="checkbox" /> 立即发布</span></label
          >
        </div>
        <footer>
          <button class="次要按钮" type="button" @click="弹窗 = ''">取消</button>
          <button class="主按钮" type="button" :disabled="提交中" @click="提交硬件">
            {{ 提交中 ? "保存中…" : "保存硬件产品" }}
          </button>
        </footer>
      </section>
    </div>

    <!-- 产品套餐弹窗 -->
    <div v-if="弹窗 === '套餐'" class="弹窗遮罩" @click.self="弹窗 = ''">
      <section class="产品弹窗 宽弹窗">
        <header>
          <div>
            <h2>{{ 编辑中套餐 ? "编辑产品套餐" : "新建产品套餐" }}</h2>
            <p>套餐可组合模块、功能与硬件，方便整包报价。</p>
          </div>
          <button type="button" @click="弹窗 = ''">×</button>
        </header>
        <div class="弹窗表单">
          <label><span>套餐名称 *</span><input v-model="套餐表单.name" /></label>
          <label><span>套餐编码</span><input v-model="套餐表单.code" /></label>
          <label
            ><span>套餐价格</span><input v-model.number="套餐表单.priceFixed" type="number" min="0"
          /></label>
          <label class="全宽"
            ><span>套餐说明</span><textarea v-model="套餐表单.desc" rows="2" />
          </label>
          <label class="全宽 复选行"
            ><span><input v-model="套餐表单.published" type="checkbox" /> 立即发布</span></label
          >
          <div class="全宽 子表单">
            <div class="子表单头"><strong>包含产品模块</strong></div>
            <div class="多选列表">
              <label v-for="模块 in 模块列表" :key="模块.id" class="多选项">
                <input
                  type="checkbox"
                  :checked="套餐表单.模块编号.includes(模块.id)"
                  @change="切换编号(套餐表单.模块编号, 模块.id)"
                />
                <span>{{ 取大类名称(模块.categoryId) }} / {{ 模块.name }}</span>
              </label>
              <p v-if="!模块列表.length" class="war-note">暂无产品模块。</p>
            </div>
          </div>
          <div class="全宽 子表单">
            <div class="子表单头"><strong>包含功能产品</strong></div>
            <div class="多选列表 高列表">
              <label v-for="功能 in 功能列表" :key="功能.id" class="多选项">
                <input
                  type="checkbox"
                  :checked="套餐表单.功能编号.includes(功能.id)"
                  @change="切换编号(套餐表单.功能编号, 功能.id)"
                />
                <span>{{ 功能.name }}（{{ 功能.productCode }}）</span>
              </label>
              <p v-if="!功能列表.length" class="war-note">暂无功能产品。</p>
            </div>
          </div>
          <div class="全宽 子表单">
            <div class="子表单头"><strong>包含硬件产品</strong></div>
            <div class="多选列表">
              <label v-for="硬件 in 硬件列表" :key="硬件.id" class="多选项">
                <input
                  type="checkbox"
                  :checked="套餐表单.硬件编号.includes(硬件.id)"
                  @change="切换编号(套餐表单.硬件编号, 硬件.id)"
                />
                <span>{{ 硬件.name }}（{{ 硬件.model }}）</span>
              </label>
              <p v-if="!硬件列表.length" class="war-note">暂无硬件产品。</p>
            </div>
          </div>
        </div>
        <footer>
          <button class="次要按钮" type="button" @click="弹窗 = ''">取消</button>
          <button class="主按钮" type="button" :disabled="提交中" @click="提交套餐">
            {{ 提交中 ? "保存中…" : "保存产品套餐" }}
          </button>
        </footer>
      </section>
    </div>

    <!-- 产品大类弹窗 -->
    <div v-if="弹窗 === '大类'" class="弹窗遮罩" @click.self="弹窗 = ''">
      <section class="产品弹窗 窄弹窗">
        <header>
          <div>
            <h2>{{ 编辑中大类 ? "编辑产品大类" : "新建产品大类" }}</h2>
            <p>大类用于产品目录分组。</p>
          </div>
          <button type="button" @click="弹窗 = ''">×</button>
        </header>
        <div class="弹窗表单">
          <label><span>大类名称 *</span><input v-model="大类表单.name" /></label>
          <label><span>大类编码</span><input v-model="大类表单.code" /></label>
          <label>
            <span>产品类型</span>
            <select v-model="大类表单.type">
              <option value="software">软件</option>
              <option value="hardware">硬件</option>
              <option value="service">服务</option>
            </select>
          </label>
          <label><span>排序</span><input v-model.number="大类表单.sort" type="number" /></label>
        </div>
        <footer>
          <button class="次要按钮" type="button" @click="弹窗 = ''">取消</button>
          <button class="主按钮" type="button" :disabled="提交中" @click="提交大类">
            {{ 提交中 ? "保存中…" : "保存大类" }}
          </button>
        </footer>
      </section>
    </div>

    <!-- 产品模块弹窗 -->
    <div v-if="弹窗 === '模块'" class="弹窗遮罩" @click.self="弹窗 = ''">
      <section class="产品弹窗 窄弹窗">
        <header>
          <div>
            <h2>{{ 编辑中模块 ? "编辑产品模块" : "新建产品模块" }}</h2>
            <p>模块挂在产品大类下，功能产品必须归属模块。</p>
          </div>
          <button type="button" @click="弹窗 = ''">×</button>
        </header>
        <div class="弹窗表单">
          <label><span>模块名称 *</span><input v-model="模块表单.name" /></label>
          <label><span>模块编码</span><input v-model="模块表单.code" /></label>
          <label>
            <span>所属大类 *</span>
            <select v-model="模块表单.categoryId">
              <option v-for="大类 in 大类列表" :key="大类.id" :value="大类.id">
                {{ 大类.name }}
              </option>
            </select>
          </label>
          <label><span>排序</span><input v-model.number="模块表单.sort" type="number" /></label>
        </div>
        <footer>
          <button class="次要按钮" type="button" @click="弹窗 = ''">取消</button>
          <button class="主按钮" type="button" :disabled="提交中" @click="提交模块">
            {{ 提交中 ? "保存中…" : "保存模块" }}
          </button>
        </footer>
      </section>
    </div>
  </div>
</template>

<style scoped>
.产品维护入口 {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.war-count {
  color: var(--text-3);
  font-weight: 700;
}

.war-empty {
  display: grid;
  place-items: center;
  min-height: 80px;
  padding: 16px;
  color: var(--text-3);
}

.link.danger {
  color: #d4380d;
}

.结构卡头 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 6px;
  border-bottom: 1px dashed var(--line-soft);
}

.结构模块列表 {
  display: grid;
  gap: 4px;
}

/* —— 弹窗样式沿用渠道成员弹窗的视觉口径 —— */
.弹窗遮罩 {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(15, 32, 56, 0.32);
}

.产品弹窗 {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: min(560px, 100%);
  max-height: 88vh;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 18px 48px rgba(15, 32, 56, 0.18);
}

.宽弹窗 {
  width: min(880px, 100%);
}

.窄弹窗 {
  width: min(460px, 100%);
}

.产品弹窗 > header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--line-soft);
}

.产品弹窗 > header h2 {
  margin: 0 0 4px;
}

.产品弹窗 > header p {
  margin: 0;
  color: var(--text-3);
}

.产品弹窗 > header button {
  border: 0;
  background: transparent;
  color: var(--text-3);
  font: inherit;
  cursor: pointer;
}

.弹窗表单 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 14px;
  padding: 16px 18px;
  overflow-y: auto;
}

.档位修正提示 {
  grid-column: 1 / -1;
  margin: 0;
  padding: 10px 12px;
  border: 1px solid #f0c36d;
  border-radius: 8px;
  background: #fff8e6;
  color: #8a5a00;
}

.弹窗表单 label,
.弹窗表单 .全宽 {
  display: grid;
  gap: 4px;
}

.弹窗表单 label > span,
.子表单头 strong {
  color: var(--text-2);
}

.弹窗表单 input,
.弹窗表单 select,
.弹窗表单 textarea {
  min-height: 32px;
  padding: 5px 9px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: #fff;
  font: inherit;
  color: var(--text);
}

.弹窗表单 .全宽 {
  grid-column: 1 / -1;
}

.复选行 {
  display: flex;
  gap: 18px;
}

.复选行 > span {
  display: flex;
  align-items: center;
  gap: 6px;
}

.子表单 {
  display: grid;
  gap: 6px;
  padding: 10px 12px;
  border: 1px dashed var(--line);
  border-radius: 9px;
  background: #f8fbff;
}

.子表单头 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.三列表格 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
  gap: 8px;
  align-items: center;
}

.三列表格.区域有效期 label {
  display: grid;
  gap: 4px;
  color: #5a6f86;
  font-size: 10px;
  font-weight: 700;
}

.三列表格.区域有效期 .war-note {
  margin: 0;
  font-size: 10px;
  font-weight: 400;
}

.渠道等级价网格 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.渠道等级价网格 > div {
  display: grid;
  align-content: start;
  gap: 6px;
  padding: 10px;
  border: 1px solid var(--line-soft);
  border-radius: 8px;
  background: #fff;
}

.渠道等级价网格 .war-note,
.子表单头 .war-note {
  margin: 0;
  font-size: 11px;
  font-weight: 400;
}

.区域渠道价块 {
  display: grid;
  gap: 8px;
  margin-top: 4px;
  padding-top: 8px;
  border-top: 1px dashed var(--line);
}

.区域覆盖编辑 {
  display: grid;
  gap: 6px;
  padding: 8px;
  border-radius: 8px;
  background: #fff;
}

.区域多选 {
  width: 100%;
}

.多选列表 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 12px;
  max-height: 150px;
  overflow-y: auto;
}

.高列表 {
  max-height: 220px;
}

.多选项 {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-2);
}

.产品弹窗 > footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 18px;
  border-top: 1px solid var(--line-soft);
}

.主按钮,
.次要按钮 {
  min-height: 34px;
  padding: 0 14px;
  border-radius: 8px;
  font: inherit;
  cursor: pointer;
}

.主按钮 {
  border: 0;
  background: #2f69ed;
  color: #fff;
  font-weight: 700;
}

.次要按钮 {
  border: 1px solid var(--line);
  background: #fff;
  color: var(--text-2);
}

/* ── 产品维护子目录（结构与老 UI 一致，样式按新 UI 画板） ── */
.产品子目录 {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 12px 18px;
  border-bottom: 1px solid var(--line-soft);
  background: #f7fbff;
}

.产品子目录项 {
  display: inline-flex;
  min-height: 32px;
  align-items: center;
  gap: 6px;
  padding: 0 13px;
  border: 1px solid transparent;
  border-radius: 9px;
  background: transparent;
  color: #60748c;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.产品子目录项:hover {
  background: rgba(47, 105, 237, 0.07);
  color: #1557d6;
}

.产品子目录项.active {
  border-color: #cfe0f8;
  background: #ffffff;
  box-shadow: 0 6px 16px rgba(47, 105, 237, 0.12);
  color: #1557d6;
}

.产品子目录图标 {
  font-size: 13px;
}

.目录工具条 {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 4px 2px 14px;
}

.目录面包屑 {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  color: #3d5b7d;
  font-size: 12px;
}

.目录面包屑 strong {
  color: #172b4d;
  font-size: 13px;
}

.返回上层 {
  margin-left: 4px;
}

.目录工具条右侧 {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.目录筛选 {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.目录检索行 {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  padding: 8px 10px;
  border: 1px solid #dce7f3;
  border-radius: 9px;
  background: #f8fbff;
}

.目录检索行 .field.search {
  flex: 1 1 260px;
}

.目录分页 {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 14px;
  color: var(--text-3);
  font-size: 11px;
}

.目录下拉 {
  min-height: 32px;
  padding: 0 10px;
  border: 1px solid var(--line-soft);
  border-radius: 8px;
  background: #ffffff;
  color: #3d5b7d;
  font: inherit;
  font-size: 12px;
}

.目录网格 {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 14px;
}

.功能网格 {
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
}

.目录卡 {
  position: relative;
  display: grid;
  gap: 10px;
  align-content: start;
  padding: 14px 16px;
  border: 1px solid #dce7f3;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 8px 22px rgba(42, 82, 130, 0.06);
  cursor: pointer;
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}

.目录卡:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 30px rgba(42, 82, 130, 0.12);
}

.目录卡.静态卡 {
  cursor: default;
}

.目录卡.静态卡:hover {
  transform: none;
  box-shadow: 0 8px 22px rgba(42, 82, 130, 0.06);
}

.目录卡头 {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.目录卡图标 {
  display: grid;
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 10px;
  background: linear-gradient(145deg, #edf5ff, #dceafd);
  font-size: 18px;
}

.目录卡文字 {
  min-width: 0;
}

.目录卡名称 {
  display: block;
  color: #172b4d;
  font-size: 13px;
  font-weight: 700;
}

.目录卡描述 {
  margin: 4px 0 0;
  color: #60748c;
  font-size: 11px;
  line-height: 1.6;
}

.目录卡编码 {
  margin: 3px 0 0;
  color: #8391a5;
  font-size: 10px;
}

.目录卡标签 {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.标签 {
  display: inline-flex;
  min-height: 20px;
  align-items: center;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 700;
}

.标签.蓝 {
  background: #edf5ff;
  color: #1557d6;
}

.标签.绿 {
  background: #e8f7ee;
  color: #17794a;
}

.标签.紫 {
  background: #f2ecfd;
  color: #6b39c4;
}

.标签.灰 {
  background: #f0f3f7;
  color: #60748c;
}

.标签.红 {
  background: #fdeceb;
  color: #c0271c;
}

.标签.橙 {
  background: #fdf3e3;
  color: #a86500;
}

.目录卡箭头 {
  position: absolute;
  right: 14px;
  bottom: 12px;
  color: #2f69ed;
  font-size: 16px;
}

.目录卡操作 {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--line-soft);
}

.价格块 {
  display: grid;
  gap: 4px;
  padding: 9px 10px;
  border-radius: 9px;
  background: #f8fbff;
}

.价格主 {
  color: #c0271c;
  font-size: 16px;
  font-weight: 700;
}

.价格主 small {
  color: #8391a5;
  font-size: 11px;
  font-weight: 400;
}

.价格档 {
  color: #3d5b7d;
  font-size: 11px;
}

.目录分区 {
  margin-top: 22px;
}

.目录分区标题 {
  margin: 0 0 12px;
  color: #172b4d;
  font-size: 14px;
}

.工作量入口 {
  display: grid;
  gap: 12px;
  justify-items: start;
  padding: 18px;
  border: 1px solid #dce7f3;
  border-radius: 12px;
  background: #f7fbff;
}
</style>
