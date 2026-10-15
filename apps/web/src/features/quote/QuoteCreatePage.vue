<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import {
  创建报价,
  试算报价,
  查询阶段9全部,
  更新报价,
  type 阶段9记录,
  type 报价试算结果,
  type 产品定价明细,
} from "../../api/business-client.js";
import { 金额文本, 取数, 文本 } from "../../shared/format/business-format.js";
import { use外壳前缀 } from "../../shared/navigation/shell-prefix.js";

type 报价明细项 = 报价试算结果["items"][number];

const 路由 = useRoute();
const 路由器 = useRouter();
const 外壳前缀 = use外壳前缀();
const 提交中 = ref(false);
const 试算中 = ref(false);
const 商机列表 = ref<阶段9记录[]>([]);
const 产品列表 = ref<阶段9记录[]>([]);
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
const 显示硬件选择 = ref(false);

const 报价方式列表 = ["套餐报价", "补充功能", "自定义报价"] as const;
const 表单 = reactive({
  商机编号: "",
  端点数量: 120,
  报价方式: "套餐报价" as (typeof 报价方式列表)[number],
  报价有效期: 30,
});
const 编辑编号 = computed(() => String(路由.params.id || ""));
const 编辑单号 = ref("");

const 选中商机 = computed(
  () => 商机列表.value.find((商机) => 商机.id === 表单.商机编号) || 商机列表.value[0] || null,
);

const 功能模块列表 = computed(() => 产品列表.value.filter((产品) => 产品.类型 === "功能模块"));
const 硬件产品列表 = computed(() => 产品列表.value.filter((产品) => 产品.类型 === "硬件产品"));
const 套餐列表 = computed(() => 产品列表.value.filter((产品) => 产品.类型 === "产品套餐"));
const 选中套餐对象 = computed(() => 套餐列表.value.find((套餐) => 套餐.id === 选中套餐.value) || null);

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
  const 命中 = 产品列表.value.find(
    (产品) => 文本(产品.标题, 产品.原始数据?.name).trim() === 目标,
  );
  return 命中?.id || "";
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
  if (表单.报价方式 === "自定义报价") return 功能模块列表.value;
  if (表单.报价方式 === "套餐报价") {
    return 功能模块列表.value.filter((产品) => 套餐功能键集合.value.has(功能键(产品)));
  }
  return 功能模块列表.value.filter((产品) => !套餐功能键集合.value.has(功能键(产品)));
});

const 过滤后可选功能 = computed(() => {
  const 关键词 = 搜索产品.value.trim().toLowerCase();
  if (!关键词) return 可选功能列表.value.slice(0, 40);
  return 可选功能列表.value
    .filter((产品) =>
      [产品.标题, 文本(产品.原始数据?.name), 文本(产品.原始数据?.productCode)]
        .filter(Boolean)
        .some((值) => String(值).toLowerCase().includes(关键词)),
    )
    .slice(0, 40);
});

const 试算明细 = computed(() => 试算结果.value?.items || []);
const 硬件明细 = computed(() => 试算明细.value.filter((项) => 项.类型 === "硬件产品"));
const 软件明细 = computed(() => 试算明细.value.filter((项) => 项.类型 !== "硬件产品"));
const 软件小计 = computed(() => 软件明细.value.reduce((合计, 项) => 合计 + Number(项.小计 || 0), 0));
const 硬件小计 = computed(() => 硬件明细.value.reduce((合计, 项) => 合计 + Number(项.小计 || 0), 0));
const 合计 = computed(() => Number(试算结果.value?.total || 0));
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
  Object.entries(选中硬件.value).filter(([, 数量]) => Number(数量) > 0),
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

onMounted(async () => {
  const [商机, 产品, 报价] = await Promise.all([
    查询阶段9全部("opportunities").catch(() => ({ 数据: [] as 阶段9记录[], 总数: 0 })),
    查询阶段9全部("products").catch(() => ({ 数据: [] as 阶段9记录[], 总数: 0 })),
    编辑编号.value
      ? 查询阶段9全部("quotes").catch(() => ({ 数据: [] as 阶段9记录[], 总数: 0 }))
      : Promise.resolve({ 数据: [] as 阶段9记录[], 总数: 0 }),
  ]);
  商机列表.value = 商机.数据;
  产品列表.value = 产品.数据;

  const 待编辑 = 编辑编号.value
    ? 报价.数据.find((row) => row.id === 编辑编号.value)
    : undefined;
  if (待编辑) {
    const 存档 = (待编辑.原始数据 as Record<string, unknown>) || {};
    编辑单号.value = 文本(存档.quoteNo, 待编辑.编号);
    存档商机编号.value = 文本(存档.opportunityId, 存档.opportunityUuid);
    表单.商机编号 =
      (文本(存档.opportunityId, 存档.opportunityUuid) || 商机列表.value[0]?.id) ?? "";
    表单.端点数量 = Number(取数(存档.endpoints, 存档.端点数)) || 表单.端点数量;
    表单.报价有效期 = Number(取数(存档.validDays, 存档.有效期)) || 表单.报价有效期;
    const 存档方式 = 文本(存档.quoteMode, 存档.报价方式);
    if ((报价方式列表 as readonly string[]).includes(存档方式)) {
      表单.报价方式 = 存档方式 as (typeof 报价方式列表)[number];
    }
    const 存档产品 = Array.isArray(存档.productIds) ? (存档.productIds as string[]) : [];
    const 存档套餐 = 文本(存档.packageId);
    if (存档套餐) 选中套餐.value = 存档套餐;
    // 套餐内模块由套餐还原；补充加选与自定义勾选分别回到各自清单，避免相互覆盖。
    if (表单.报价方式 === "自定义报价") {
      自定义选择.value = [...存档产品];
      自定义已引导.value = true;
    } else if (表单.报价方式 === "补充功能") {
      const 套餐内集合 = new Set(套餐内产品编号.value);
      补充功能选择.value = 存档产品.filter((编号) => !套餐内集合.has(编号));
    }
    const 存档硬件 = Array.isArray(存档.hardwareItems)
      ? (存档.hardwareItems as Array<Record<string, unknown>>)
      : [];
    if (存档硬件.length) {
      选中硬件.value = Object.fromEntries(
        存档硬件.map((项) => [文本(项.productId, 项.hardwareId, 项.id), Number(项.quantity) || 1]),
      );
    }
    // 编辑模式先展示该报价已保存的明细，避免用试算结果覆盖历史成交口径；用户可点「重新试算」刷新。
    const 存档明细 = Array.isArray(存档.items) ? (存档.items as Array<Record<string, unknown>>) : [];
    const 存档硬件明细 = Array.isArray(存档.hardwareItems)
      ? (存档.hardwareItems as Array<Record<string, unknown>>)
      : [];
    if (存档明细.length || 存档硬件明细.length) {
      const 规范明细: 报价明细项[] = [...存档明细, ...存档硬件明细].map((项) => ({
       名称: 文本(项.名称, 项.name, 项.itemName, "未命名模块"),
        // 存档明细只保存名称与金额，缺 id 时按名称回填，编辑态才能调整数量与移除模块。
        id:
          文本(项.id, 项.productRefId) ||
          按名称找产品编号(文本(项.名称, 项.name, 项.itemName)),
        类型: 文本(项.类型, 项.type, "功能模块"),
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
    } else {
      await 试算();
    }
  } else {
    const 预选商机 = 文本(路由.query.opportunityId);
    表单.商机编号 =
      (商机列表.value.some((row) => row.id === 预选商机) ? 预选商机 : "") ||
      商机列表.value[0]?.id ||
      "";
    const 预选套餐 = 文本(路由.query.packageId);
    if (预选套餐 && 套餐列表.value.some((套餐) => 套餐.id === 预选套餐)) {
      选中套餐.value = 预选套餐;
      应用套餐(选中套餐.value);
    } else if (套餐列表.value.length && 表单.报价方式 !== "自定义报价") {
      // 默认进入套餐报价，直接带出第一个套餐的标准组合，避免空白报价单
      选中套餐.value = 套餐列表.value[0]?.id || "";
      if (选中套餐.value) 应用套餐(选中套餐.value);
    }
    await 试算();
  }
});

/**
 * 选中基础套餐：只切换套餐本身并重算，不清空用户已勾选内容。
 * 补充加选与自定义勾选分别保存在各自清单里，切回对应模式即可恢复。
 */
function 应用套餐(编号: string) {
  if (!套餐列表.value.some((项) => 项.id === 编号)) return;
  选中套餐.value = 编号;
  void 试算();
}

/** 切换报价方式只改变入单口径，不再重算并覆盖用户已勾选的模块（对齐旧 UI）。 */
function 切换报价方式(方式: (typeof 报价方式列表)[number]) {
  const 切换前模块 = [...选中产品.value];
  表单.报价方式 = 方式;
  if (方式 === "自定义报价") {
    // 首次进入自定义报价时用当前报价内容引导一次，之后完全按用户勾选
    if (!自定义已引导.value) {
      自定义选择.value = 切换前模块;
      自定义已引导.value = true;
    }
  } else if (!选中套餐.value && 套餐列表.value.length) {
    // 套餐报价与补充功能都必须基于一个套餐，未选时默认第一个（与旧 UI 一致）
    选中套餐.value = 套餐列表.value[0]?.id || "";
  }
  void 试算();
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
      quoteMode: 表单.报价方式,
      validDays: Number(表单.报价有效期) || 30,
      packageId: 选中套餐.value,
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

/** 套餐报价模式下套餐内功能固定勾选，不允许在报价单里增减。 */
function 是否锁定(产品: 阶段9记录): boolean {
  if (表单.报价方式 === "自定义报价") return false;
  return 套餐功能键集合.value.has(功能键(产品));
}

/** 套餐报价下套餐内模块属于标准组合，不允许在报价单里单独移除。 */
function 可移除(项: 报价明细项): boolean {
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
  void 试算();
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
  void 试算();
}

/** 勾选/取消模块：按当前报价方式写入对应清单，套餐内模块固定不可勾选。 */
function 切换产品(编号: string) {
  if (表单.报价方式 === "自定义报价") {
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
  void 试算();
}

function 切换硬件(编号: string) {
  if (选中硬件.value[编号]) {
    选中硬件.value = Object.fromEntries(
      Object.entries(选中硬件.value).filter(([键]) => 键 !== 编号),
    );
  } else {
    选中硬件.value = { ...选中硬件.value, [编号]: 1 };
  }
  void 试算();
}

function 设置硬件数量(编号: string, 数量: unknown) {
  const 数值 = Math.max(1, Math.floor(Number(数量) || 1));
  选中硬件.value = { ...选中硬件.value, [编号]: 数值 };
  void 试算();
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
  提交中.value = true;
  try {
    const 载荷 = {
      opportunityId: 表单.商机编号,
      endpoints: Number(表单.端点数量) || 1,
      productIds: 选中产品.value,
      hardwareItems: 硬件数量列表.value.map(([productId, quantity]) => ({ productId, quantity })),
      quoteMode: 表单.报价方式,
      validDays: Number(表单.报价有效期) || 30,
      packageId: 选中套餐.value,
    };
    if (编辑编号.value) {
      await 更新报价(编辑编号.value, 载荷);
      ElMessage.success("报价单已更新");
    } else {
      await 创建报价(载荷);
      ElMessage.success("报价单已生成");
    }
    路由器.push(`${外壳前缀.value}/quote`);
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
        <button
          class="返回按钮"
          type="button"
          @click="路由器.push(`${外壳前缀}/quote`)"
        >
          ← 返回报价列表
        </button>
        <h1>{{ 编辑编号 ? "编辑报价单" : "新建 / 编辑报价单" }}</h1>
        <p>
          {{
            编辑单号
              ? `报价单 ${编辑单号}：已回填关联商机、端点数量与产品选择，保存后更新该报价。`
              : "报价单按客户和商机创建，软件、硬件、服务、阶梯价、区域覆盖和渠道价格比例均由服务端试算。"
          }}
        </p>
      </div>
      <div class="button-row">
        <button v-if="返回商机编号" type="button" class="button" @click="返回商机">返回商机</button>
        <button type="button" class="button" :disabled="试算中" @click="试算">重新试算</button>
        <button type="button" class="button primary" :disabled="提交中" @click="提交">
          {{ 编辑编号 ? "保存报价单" : "生成报价单" }}
        </button>
      </div>
    </header>

    <div class="quote-builder-layout">
      <aside class="quote-builder-side">
        <section class="panel">
          <header class="panel-head"><div><h2>报价对象</h2><p>客户、商机与价格上下文</p></div></header>
          <div class="panel-body">
            <div class="quote-field-list">
              <div>
                <span>关联商机</span>
                <select class="form-control" v-model="表单.商机编号" @change="试算">
                  <option value="">请选择商机</option>
                  <option v-for="商机 in 商机列表" :key="商机.id" :value="商机.id">
                    {{ 文本(商机.标题, 商机.客户名称) }}（{{ 商机.编号 }}）
                  </option>
                </select>
              </div>
              <div><span>客户名称</span><strong>{{ 文本(选中商机?.客户名称, "未关联") }}</strong></div>
              <div>
                <span>端点数量</span>
                <input class="form-control" v-model="表单.端点数量" @change="试算" />
              </div>
              <div>
                <span>归属区域</span>
                <strong>{{ 文本(定价上下文?.区域, 选中商机?.区域, "未填写") }}</strong>
              </div>
              <div>
                <span>渠道层级</span>
                <strong>{{ 文本(定价上下文?.渠道层级名称, "试算后生成") }}</strong>
              </div>
              <div>
                <span>等级价系数</span>
                <strong>{{ 等级价系数说明 }}</strong>
              </div>
              <div>
                <span>报价有效期</span>
                <select class="form-control" v-model.number="表单.报价有效期">
                  <option :value="15">15 天</option>
                  <option :value="30">30 天</option>
                  <option :value="60">60 天</option>
                  <option :value="90">90 天</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        <section class="panel">
          <header class="panel-head"><div><h2>报价方式</h2><p>切换套餐、补充功能或自定义模块</p></div></header>
          <div class="panel-body">
            <div class="quote-mode-grid">
              <button
                v-for="方式 in 报价方式列表"
                :key="方式"
                type="button"
                class="quote-mode"
                :class="{ active: 表单.报价方式 === 方式 }"
                @click="切换报价方式(方式)"
              >
                <strong>{{ 方式 }}</strong>
                <span>{{ 方式 === "套餐报价" ? "标准组合" : 方式 === "补充功能" ? "套餐加配" : "自由组合" }}</span>
              </button>
            </div>

            <div v-if="表单.报价方式 !== '自定义报价'" class="产品勾选列表 报价方式套餐列表">
              <button
                v-for="套餐 in 套餐列表"
                :key="套餐.id"
                type="button"
                class="quote-mode"
                :class="{ active: 选中套餐 === 套餐.id }"
                @click="应用套餐(套餐.id)"
              >
                <strong>{{ 文本(套餐.标题, "未命名套餐") }}</strong>
                <span>{{ 套餐功能编号(套餐).length }} 个功能</span>
              </button>
              <p v-if="!套餐列表.length" class="war-note">暂无可用套餐，请联系管理员在产品目录配置。</p>
            </div>
            <p v-else class="war-note">自定义报价不受套餐约束，可在下方自由组合全部功能模块。</p>
          </div>
        </section>

        <section class="panel">
          <header class="panel-head"><div><h2>价格规则命中</h2><p>服务端实时计算</p></div></header>
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
            <div><h2>软件模块</h2><p>价格 = 区域覆盖价优先于标准阶梯价，再应用渠道比例</p></div>
            <div class="button-row">
              <button type="button" class="button small" :disabled="试算中" @click="试算">
                {{ 试算中 ? "试算中…" : "重新试算" }}
              </button>
            </div>
          </header>
          <div class="panel-body flush">
            <div class="模块方格网格">
              <article
                v-for="(项, 序号) in 软件明细"
                :key="序号"
                class="模块方格"
                :class="{ '套餐内': !可移除(项) }"
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
                <div class="方格单价">
                  <span>最终单价</span>
                  <strong>{{ 金额或短横(项.单价) }}</strong>
                </div>
                <dl class="方格价格构成">
                  <div><dt>标准价</dt><dd>{{ 单价列(项, "标准单价") }}</dd></div>
                  <div><dt>区域覆盖</dt><dd>{{ 单价列(项, "区域覆盖单价") }}</dd></div>
                  <div><dt>渠道比例</dt><dd>{{ 比例列(项) }}</dd></div>
                </dl>
                <p v-if="越档提示(项)" class="方格越档提示">{{ 越档提示(项) }}</p>
                <div class="方格小计">
                  <span>小计</span>
                  <strong>{{ 金额或短横(项.小计) }}</strong>
                </div>
              </article>
              <p v-if="!软件明细.length" class="war-empty">请选择商机与产品模块后进行试算。</p>
            </div>
          </div>
          <div class="panel-body">
            <div class="quote-add-row">
              <input class="form-control" v-model="搜索产品" placeholder="搜索产品名称或编码" />
              <span class="war-note">可选 {{ 过滤后可选功能.length }} 个模块</span>
            </div>
            <div class="模块选择网格">
              <button
                v-for="产品 in 过滤后可选功能"
                :key="产品.id"
                type="button"
                class="模块选择方格"
                :class="{ 已选: 是否已选(产品), 锁定: 是否锁定(产品) }"
                :disabled="是否锁定(产品)"
                @click="切换产品(产品.id)"
              >
                <span class="选择角标">{{ 是否已选(产品) ? "✓" : "＋" }}</span>
                <strong>{{ 文本(产品.标题, 产品.原始数据?.name) }}</strong>
                <small>{{ 是否锁定(产品) ? "套餐内模块" : 文本(产品.原始数据?.productCode, "无编码") }}</small>
              </button>
            </div>
            <p v-if="!过滤后可选功能.length" class="war-note">
              {{ 表单.报价方式 === "补充功能" ? "该套餐已覆盖全部可选功能。" : "没有匹配的产品模块。" }}
            </p>
          </div>
        </section>

        <section class="panel">
          <header class="panel-head">
            <div><h2>硬件与服务</h2><p>硬件数量、服务周期和赠送质保明细</p></div>
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
                <span class="方格角标 硬件角标">{{ 文本(项.类型, "硬件") }}</span>
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
                <div class="方格单价">
                  <span>单价</span>
                  <strong>{{ 金额或短横(项.单价) }}</strong>
                </div>
                <div class="方格小计">
                  <span>小计</span>
                  <strong>{{ 金额或短横(项.小计) }}</strong>
                </div>
              </article>
              <p v-if="!硬件明细.length" class="war-empty">本次报价不含硬件或服务项。</p>
            </div>
          </div>
        </section>
      </main>

      <aside class="quote-builder-summary">
        <section class="panel">
          <header class="panel-head"><div><h2>报价单预览</h2><p>正式报价单结构</p></div></header>
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
                <div class="info-item"><span>客户</span><strong>{{ 文本(选中商机?.客户名称, "未关联") }}</strong></div>
                <div class="info-item"><span>商机</span><strong>{{ 文本(选中商机?.标题, "未关联") }}</strong></div>
                <div class="info-item"><span>渠道</span><strong>{{ 文本(选中商机?.渠道名称, "未填写") }}</strong></div>
                <div class="info-item"><span>归属区域</span><strong>{{ 文本(定价上下文?.区域, "未填写") }}</strong></div>
                <div class="info-item"><span>报价日期</span><strong>{{ new Date().toLocaleDateString("zh-CN") }}</strong></div>
                <div class="info-item"><span>有效期</span><strong>{{ 表单.报价有效期 }} 天</strong></div>
              </div>
              <div class="quote-document-lines">
                <div v-for="(项, 序号) in 试算明细" :key="序号">
                  <span>{{ 文本(项.名称, "未命名项") }}</span>
                  <strong>{{ 金额或短横(项.小计) }}</strong>
                </div>
                <div v-if="!试算明细.length"><span>暂无明细</span><strong>—</strong></div>
              </div>
              <div class="quote-document-total">
                <span>报价总额</span>
                <strong>{{ 金额(合计) }}</strong>
              </div>
            </div>
          </div>
        </section>

        <section class="panel">
          <header class="panel-head"><div><h2>试算汇总</h2><p>服务端结果</p></div></header>
          <div class="panel-body">
            <div class="quote-summary-lines">
              <div><span>产品小计</span><strong>{{ 金额(软件小计) }}</strong></div>
              <div><span>硬件与服务</span><strong>{{ 金额(硬件小计) }}</strong></div>
              <div><span>端点数量</span><strong>{{ 表单.端点数量 }} 点</strong></div>
              <div><span>工作量说明</span><strong>{{ 试算结果?.workloadSummary || "试算后生成" }}</strong></div>
              <div class="sign"><span>报价总额</span><strong>{{ 金额(合计) }}</strong></div>
            </div>
            <p class="war-note">
              报价生成后可在报价列表执行「报价转订单」；同一报价只能转一次订单，重复转单会被拒绝并提示已有订单号。
            </p>
          </div>
        </section>

        <section class="panel">
          <header class="panel-head"><div><h2>渠道商价格参考</h2><p>按分销等级分档</p></div></header>
          <div class="panel-body">
            <div class="quote-summary-lines">
              <div><span>标准价合计</span><strong>{{ 金额(渠道价格参考?.标准价 ?? 软件小计) }}</strong></div>
              <div><span>区域覆盖价合计</span><strong>{{ 金额(渠道价格参考?.区域覆盖价 ?? 软件小计) }}</strong></div>
              <div><span>一级渠道商价</span><strong>{{ 金额(渠道价格参考?.一级 ?? 软件小计) }}</strong></div>
              <div><span>二级渠道商价</span><strong>{{ 金额(渠道价格参考?.二级 ?? 软件小计) }}</strong></div>
            </div>
            <p class="war-note">
              适用价格区域：{{ 文本(定价上下文?.区域, "全国默认价") }}；硬件按原价计入，参考价只统计软件模块。
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
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
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
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
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
</style>
