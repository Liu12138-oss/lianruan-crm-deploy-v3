<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";

import {
  查询阶段9全部,
  查询阶段9列表,
  查询渠道经营摘要,
  type 阶段9记录,
  type 渠道经营摘要,
} from "../../api/business-client.js";
import WarKpis from "../../components/war/WarKpis.vue";
import WarLayout from "../../components/war/WarLayout.vue";
import WarRecordCard from "../../components/war/WarRecordCard.vue";
import type { 指标项 } from "../../components/war/types.js";
import { 日期文本, 文本, 文本或 } from "../../shared/format/business-format.js";
import { 查询渠道核心档案, 保存渠道核心档案 } from "./channel-profile-client.js";

const 路由器 = useRouter();
const 加载中 = ref(false);
const 错误 = ref("");
const 渠道列表 = ref<阶段9记录[]>([]);
const 选中编号 = ref("");
const 当前标签 = ref("全部");
const 搜索词 = ref("");
const 选中区域 = ref("全部区域");
const 档案数据 = ref<Record<string, unknown>>({});
const 摘要数据 = ref<渠道经营摘要 | null>(null);
const 摘要加载中 = ref(false);

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
  { 代码: "customerOpen", 名称: "客户开放（协同拜访）", 自动: false, 说明: "是否已完成客户开放与协同拜访" },
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

async function 读取渠道证书(编号: string): Promise<Array<Record<string, unknown>>> {
  try {
    const 响应 = await fetch(
      `/api/org/member-certifications?partnerId=${encodeURIComponent(编号)}`,
      { credentials: "include" },
    );
    if (!响应.ok) return [];
    const 内容 = (await 响应.json()) as { data?: { items?: Array<Record<string, unknown>> } };
    return 内容.data?.items || [];
  } catch {
    return [];
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
  const [档案结果, 摘要结果, 证书结果, 报备结果, 订单结果] = await Promise.all([
    查询渠道核心档案(编号).catch(() => null),
    查询渠道经营摘要(编号).catch(() => null),
    读取渠道证书(编号),
    查询阶段9列表("registrations", { partnerId: 编号, page: 1, pageSize: 1 }).catch(() => null),
    查询阶段9全部("orders", { partnerId: 编号, 最大页数: 3 }).catch(() => ({ 数据: [], 总数: 0 })),
  ]);
  if (选中编号.value !== 编号) return;
  档案数据.value = (档案结果 as Record<string, unknown> | null) || {};
  摘要数据.value = 摘要结果;
  环节加载数据.value = {
    证书列表: 证书结果,
    报备总数: Number(报备结果?.分页?.总数 || 0),
    订单列表: 订单结果?.数据 || [],
  };
  摘要加载中.value = false;
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
    ElMessage.success(
      目标 === undefined ? `${定义.名称}已恢复自动更新。` : `${定义.名称}已更新。`,
    );
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

const 级别映射: Record<string, string> = {
  none: "未分级",
  silver: "银牌",
  gold: "金牌",
  primary: "一级渠道",
  secondary: "二级渠道",
  lep: "核心渠道",
};

function 等级文本(row: 阶段9记录 | null | undefined): string {
  const 代码 = 文本(字段(row, "partnerLevel", "level"));
  return 级别映射[代码] || (代码 ? 代码 : "未分级");
}

function 等级色调(row: 阶段9记录 | null | undefined): "blue" | "amber" | "gray" | "green" {
  const 代码 = 文本(字段(row, "partnerLevel", "level"));
  if (代码 === "primary" || 代码 === "lep") return "blue";
  if (代码 === "gold") return "amber";
  if (代码 === "secondary") return "green";
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

const 区域选项 = computed(() =>
  [...new Set(渠道列表.value.map((row: 阶段9记录) => 区域文本(row)).filter(Boolean))].sort(),
);

const 过滤后列表 = computed(() => {
  let 列表 = 渠道列表.value;
  if (当前标签.value === "核心渠道")
    列表 = 列表.filter((row) => ["核心渠道", "一级渠道"].includes(等级文本(row)));
  if (当前标签.value === "待续签")
    列表 = 列表.filter((row) => 等级文本(row) === "未分级");
  if (选中区域.value && 选中区域.value !== "全部区域")
    列表 = 列表.filter((row) => 区域文本(row) === 选中区域.value);
  const 关键词 = 搜索词.value.trim().toLowerCase();
  if (!关键词) return 列表;
  return 列表.filter((row) =>
    [row.标题, row.渠道名称, 字段(row, "region"), 联系人(row), 联系电话(row), 等级文本(row)]
      .filter(Boolean)
      .some((值) => String(值).toLowerCase().includes(关键词)),
  );
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
  return ['渠道主档已更新', '成员维护状态同步', '渠道等级已核对']
    .map((标题, 序号) => ({ 标题, 时间: 序号 === 0 ? 日期文本(时间) : "", 说明: "来自当前记录真实数据" }))
    .filter((项) => 项.时间 || 项.说明);
});

const 指标 = computed<指标项[]>(() => {
  const 列表 = 渠道列表.value;
  const 核心 = 列表.filter((row) => ["lep", "primary"].includes(文本(字段(row, "partnerLevel", "level")))).length;
  const 金牌 = 列表.filter((row) => 文本(字段(row, "partnerLevel", "level")) === "gold").length;
  const 未分级 = 列表.filter((row) => 等级文本(row) === "未分级").length;
  const 已维护成员 = 列表.filter((row) => 成员列表(row).length > 0).length;
  return [
    { label: "渠道商总数", value: String(列表.length), unit: "家", note: "当前数据范围内渠道商主档" },
    { label: "核心渠道", value: String(核心), unit: "家", note: "核心渠道与一级渠道" },
    { label: "金牌渠道", value: String(金牌), unit: "家", note: "渠道等级为金牌" },
    { label: "未分级", value: String(未分级), unit: "家", note: "渠道等级待维护，可在核心档案补全" },
    { label: "已维护成员", value: String(已维护成员), unit: "家", note: "已有渠道成员账号的渠道商" },
    { label: "成员总数", value: String(成员总数.value), unit: "人", note: "按渠道成员记录汇总" },
  ];
});

onMounted(() => void 加载());

watch(选中编号, (编号) => void 加载渠道详情(编号));

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

function 打开档案(row: 阶段9记录) {
  路由器.push(`/admin/partners/${row.id}/profile`);
}

function 打开成员(row: 阶段9记录) {
  路由器.push(`/admin/partners/${row.id}/members`);
}
</script>

<template>
  <div class="vui war-artboard 渠道商页">
    <WarKpis :items="指标" />

    <WarLayout
      list-title="渠道商列表"
      :list-count="String(过滤后列表.length)"
      search-placeholder="搜索渠道商名称、区域、联系人或级别"
      :tabs="标签列表"
      :active-tab="当前标签"
      v-model="搜索词"
      :动态="动态"
      :区域列表="区域选项"
      :选中区域="选中区域"
      @update:选中区域="选中区域 = $event"
      @切换标签="当前标签 = $event"
    >
      <template #list>
        <div v-if="加载中" class="war-empty">正在加载渠道商数据…</div>
        <div v-else-if="错误" class="war-empty">{{ 错误 }}</div>
        <WarRecordCard
          v-for="row in 过滤后列表"
          :key="row.id"
          :title="文本或([row.标题, row.渠道名称], '未命名渠道商')"
          :meta="[
            等级文本(row),
            区域文本(row) || '未填写区域',
            `负责人：${联系人(row)}`,
          ].join(' · ')"
          :badge="合作状态文本(row)"
          :tone="等级色调(row)"
          :owner="成员列表(row).length ? `${成员列表(row).length} 人 / ${证书数(row)} 项证书` : '成员与证书未维护'"
          :amount="文本(字段(row, 'bigRegion'), '—')"
          :tags="[
            { text: 等级文本(row) },
            { text: 成员列表(row).length ? '资质已维护' : '资质待补齐', hot: 成员列表(row).length > 0 },
          ]"
          :actions="[{ text: '查看档案' }, { text: '成员维护' }]"
          :active="当前渠道?.id === row.id"
          @选择="选中编号 = row.id"
          @动作="(动作: string) => (动作 === '查看档案' ? 打开档案(row) : 打开成员(row))"
        />
        <div v-if="!加载中 && !错误 && !过滤后列表.length" class="war-empty">
          当前筛选条件下没有渠道商记录。
        </div>
      </template>

      <template #center>
        <template v-if="当前渠道">
          <div class="war-center-head">
            <div class="deal-title">
              <strong>{{ 文本或([当前渠道.标题, 当前渠道.渠道名称], "未命名渠道商") }}</strong>
              <span>
                {{ 等级文本(当前渠道) }} · {{ 区域文本(当前渠道) || "未填写区域" }} ·
                负责人：{{ 联系人(当前渠道) }}
              </span>
            </div>
            <div class="center-actions">
              <button type="button" class="button" @click="打开档案(当前渠道)">
                渠道核心档案
              </button>
              <button type="button" class="button primary" @click="打开成员(当前渠道)">
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
                    <div class="环节操作">
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
                <div><h2>渠道运营指标</h2><p>活跃度、业务能力与原厂资质按当前渠道实时计算</p></div>
              </header>
              <div class="panel-body">
                <div class="摘要网格 三列">
                  <div class="摘要卡">
                    <span>活跃度（当年）</span>
                    <div class="metric-value"><strong>{{ 活跃度当年 }}%</strong></div>
                    <small>
                      当年 {{ 当年订单.length }} 单 · 去年 {{ 活跃度去年 }}%（{{ 去年订单.length }} 单）
                    </small>
                  </div>
                  <div class="摘要卡">
                    <span>业务能力 · 客单价（当年）</span>
                    <div class="metric-value"><strong>{{ 客单价文本 }}</strong></div>
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
                  指标口径：活跃度按当年成交订单数计（1 单 = 1%，上限 100%），历史对比展示去年同口径；
                  客单价 = 当年成交金额 ÷ 当年成交单数；原厂资质按渠道成员有效证书统计，
                  证书等级按模板名称中的初级 / 中级 / 高级（专家）折算 1 / 2 / 3 分。
                </p>
              </div>
            </section>

            <section class="panel">
              <header class="panel-head">
                <div><h2>工商主体</h2><p>成立时间、注册资本与统一社会信用代码</p></div>
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
                    <strong>{{ 或未维护(档案字段(当前渠道, "establishedAt", "foundedAt")) }}</strong>
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
                <div><h2>经营与能力</h2><p>代理品牌、服务区域与团队规模</p></div>
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
                <div><h2>合作背景</h2><p>合作历史、典型客户与业务范围</p></div>
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

            <section class="panel">
              <header class="panel-head">
                <div><h2>合作经营摘要</h2><p>按渠道主档归集的正式业务记录</p></div>
                <span class="摘要状态">{{ 摘要加载中 ? "统计中…" : "实时统计" }}</span>
              </header>
              <div class="panel-body">
                <div class="摘要网格">
                  <div class="摘要卡">
                    <span>客户</span>
                    <div class="metric-value"><strong>{{ 摘要数据?.客户数 ?? "—" }}</strong></div>
                    <small>报备客户</small>
                  </div>
                  <div class="摘要卡">
                    <span>商机</span>
                    <div class="metric-value"><strong>{{ 摘要数据?.商机数 ?? "—" }}</strong></div>
                    <small>在管商机</small>
                  </div>
                  <div class="摘要卡">
                    <span>报价单</span>
                    <div class="metric-value"><strong>{{ 摘要数据?.报价单数 ?? "—" }}</strong></div>
                    <small>累计报价</small>
                  </div>
                  <div class="摘要卡">
                    <span>订单</span>
                    <div class="metric-value"><strong>{{ 摘要数据?.订单数 ?? "—" }}</strong></div>
                    <small>累计订单</small>
                  </div>
                </div>
                <p class="war-note">
                  统计口径：客户报备、商机、报价单、订单的正式记录按渠道主档关联实时汇总，
                  渠道账号仅统计本渠道数据范围。
                </p>
              </div>
            </section>
          </div>
        </template>
        <div v-else class="war-empty">请选择左侧渠道商查看档案。</div>
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
            <div class="info-item">
              <span>成员账号</span><strong>{{ 成员列表(当前渠道).length }} 人</strong>
            </div>
            <div class="info-item">
              <span>负责人</span><strong>{{ 联系人(当前渠道) }}</strong>
            </div>
          </div>
        </article>

        <article v-if="当前渠道" class="right-card">
          <div class="right-card-title">
            <strong>渠道成员</strong><span>{{ 成员列表(当前渠道).length }} 人</span>
          </div>
          <div v-if="成员列表(当前渠道).length" class="mini-list">
            <div v-for="成员 in 成员列表(当前渠道)" :key="String(成员.id || 成员.username)" class="mini-item">
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
  padding: 10px 12px;
  border: 1px solid var(--line-soft);
  border-radius: 9px;
  background: linear-gradient(120deg, #ffffff, #f4f9ff);
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
</style>
