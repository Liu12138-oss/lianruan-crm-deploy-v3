<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import {
  查询账号目录,
  查询阶段9全部,
  查询阶段9列表,
  试算报价,
  执行订单动作,
  type 阶段9记录,
  type 报价试算结果,
} from "../../api/business-client.js";
import { 判断平台角色 } from "../../shared/permission/role.js";
import { use外壳前缀 } from "../../shared/navigation/shell-prefix.js";
import { 取数 } from "../../shared/format/business-format.js";
import { useSessionStore } from "../../stores/session.js";
import QuoteProfitPanel from "../quote/QuoteProfitPanel.vue";

type 订单动作 =
  | "primary_confirm"
  | "primary_reject"
  | "region_confirm"
  | "region_price_adjust"
  | "superadmin_confirm"
  | "superadmin_return"
  | "region_return"
  | "resubmit"
  | "legacy_confirm"
  | "ship"
  | "complete"
  | "cancel"
  | "fulfillment";

interface 动作定义 {
  key: 订单动作;
  title: string;
  description: string;
  danger?: boolean;
}

const 路由 = useRoute();
const 路由器 = useRouter();
const 外壳前缀 = use外壳前缀();
const 会话 = useSessionStore();
const 加载中 = ref(false);
const 提交中 = ref(false);
const 错误 = ref("");
const 订单 = ref<阶段9记录 | null>(null);
const 当前动作 = ref<订单动作 | null>(null);

const 表单 = reactive({
  reason: "",
  amount: 0,
  returnTarget: "region",
  nextStatus: "processing",
});

/** 修订后重新提交需要按报价单口径带出模块、数量和系统单价，与老 UI「修改并重新提交」一致。 */
type 重提明细项 = {
  itemName: string;
  productRefType: string;
  productRefId: string;
  quantity: number;
  unitPrice: number;
};

const 重提明细 = ref<重提明细项[]>([]);
const 产品目录 = ref<阶段9记录[]>([]);
const 产品目录关键词 = ref("");
const 显示产品选择 = ref(false);
const 试算中 = ref(false);

const 订单编号 = computed(() => String(路由.params.id || ""));
const 角色 = computed(() => 判断平台角色(会话.user));
const 明细 = computed<Array<Record<string, unknown>>>(() => {
  const items = 订单.value?.原始数据?.items;
  return Array.isArray(items) ? (items as Array<Record<string, unknown>>) : [];
});
const 状态历史 = computed<Array<Record<string, unknown>>>(() => {
  const items = 订单.value?.原始数据?.statusHistory;
  return Array.isArray(items) ? (items as Array<Record<string, unknown>>) : [];
});
const 明细合计 = computed(() =>
  明细.value.reduce((合计, item) => 合计 + 数字(item.lineAmount ?? item.小计), 0),
);
const 当前状态 = computed(() => String(订单.value?.状态 || 订单.value?.原始数据?.status || ""));
const 是V2历史订单 = computed(() => Boolean(订单.value?.原始数据?.legacyV2Order));
const 管理端角色 = computed(() => ["superadmin", "region_manager"].includes(角色.value));
/** 用户名 → 姓名映射；未命中时回退展示用户名，与订单中心口径保持一致。 */
const 账号名称 = ref<Record<string, string>>({});

function 姓名(值: unknown): string {
  const 原始值 = String(值 ?? "").trim();
  if (!原始值) return "";
  return 账号名称.value[原始值] || 原始值;
}

async function 加载账号目录() {
  if (Object.keys(账号名称.value).length) return;
  try {
    const 目录 = await 查询账号目录();
    账号名称.value = Object.fromEntries(目录.map((项) => [项.username, 项.name]));
  } catch {
    // 账号目录读取失败时回退显示用户名，不影响订单主数据显示。
  }
}

/** 渠道层级展示的是当前签约渠道伙伴的分销层级（一级分销 / 二级分销）。 */
const 分销层级文本 = computed(() => {
  const 值 = 字段(订单.value, "partnerLevel", "submittedPartnerLevel");
  const 映射: Record<string, string> = { primary: "一级分销", secondary: "二级分销", none: "无分销层级" };
  return 映射[值] || "未设置";
});

/** 订单产品类型：按明细 productRefType 去重合成，口径与订单中心一致。 */
const 产品类型文本 = computed(() => {
  const 映射: Record<string, string> = { feature: "软件", hardware: "硬件", manual: "手工/服务" };
  const 类型列表 = [
    ...new Set(
      明细.value
        .map((项) => String(项.productRefType ?? 项.product_ref_type ?? "").trim())
        .filter(Boolean),
    ),
  ].map((值) => 映射[值] || 值);
  return 类型列表.length ? 类型列表.join(" + ") : "未标注";
});

/** 收益核算挂在来源报价单上，优先取 quoteId，与老 UI 的 detail.quoteId || detail.quoteNo 一致。 */
const 报价编号 = computed(() => 字段(订单.value, "quoteId", "quoteNo", "报价编号"));

/**
 * 动作清单严格对齐老 UI / 原业务审批链：
 * 二级渠道商下单 → 一级渠道商确认或驳回 → 区管确认、驳回或调价 → 超管确认或退回 → 履约（发货、完成、取消）。
 * 一级确认与一级驳回只出现在渠道端（/partner），管理端在「待一级确认」阶段只提示等待，不提供动作。
 */
const 可用动作 = computed<动作定义[]>(() => {
  const 状态 = 当前状态.value;
  const 动作: 动作定义[] = [];
  if (角色.value === "partner") {
    // 一级渠道商在待确认（含 V2 历史订单）阶段确认或驳回二级渠道商订单，与老 UI「确认 / 驳回」一致
    if (["pending", "pending_primary_confirm"].includes(状态)) {
      动作.push(
        { key: "primary_confirm", title: "一级确认", description: "确认二级渠道商订单并提交区域管理员审批。" },
        {
          key: "primary_reject",
          title: "一级驳回",
          description: "把订单退回二级渠道商修改，必须填写驳回原因。",
          danger: true,
        },
      );
    }
    if (["returned_to_region", "returned_to_primary", "returned_to_secondary"].includes(状态)) {
      动作.push({
        key: "resubmit",
        title: "修订后重新提交",
        description: "按退回意见调整模块与数量后重新进入审批链。",
      });
    }
    return 动作;
  }
  // 管理端：V2 历史订单在待确认阶段由区管或超管直接确认并进入处理中
  if (状态 === "pending" && 是V2历史订单.value) {
    动作.push({
      key: "legacy_confirm",
      title: "确认订单",
      description: "V2 历史订单不进入审批链，确认后直接进入处理中。",
    });
  }
  // 区管节点：仅区管可操作，超管在区管确认前只读
  if (状态 === "primary_confirmed" && 角色.value === "region_manager") {
    动作.push(
      {
        key: "region_confirm",
        title: "区管确认",
        description: "确认一级渠道商订单并提交超级管理员确认。",
      },
      {
        key: "region_return",
        title: "区管驳回",
        description: "退回一级或二级渠道商修改，必须填写驳回原因。",
        danger: true,
      },
      {
        key: "region_price_adjust",
        title: "区管调价",
        description: "调整订单总额后直接提交超管确认。",
      },
    );
  }
  // 超管节点：仅超管可操作
  if (状态 === "pending_superadmin_confirm" && 角色.value === "superadmin") {
    动作.push(
      {
        key: "superadmin_confirm",
        title: "超管确认",
        description: "最终确认订单并触发后续履约流程。",
      },
      {
        key: "superadmin_return",
        title: "超管退回",
        description: "选择退回目标并填写退回原因。",
        danger: true,
      },
    );
  }
  // 退回修改：内部管理员可在任一退回节点修订模块明细后重新提交（与老 UI canResubmit 一致）
  if (
    管理端角色.value &&
    ["returned_to_region", "returned_to_primary", "returned_to_secondary"].includes(状态)
  ) {
    动作.push({
      key: "resubmit",
      title: "修订后重新提交",
      description: "按退回意见调整模块、数量，单价由系统重新取价后回到审批链。",
    });
  }
  // 超管确认后（confirmed）与处理中（processing）都可确认发货，与 V2 兼容工作台口径一致
  if (状态 === "confirmed" || 状态 === "processing") {
    动作.push({ key: "ship", title: "确认发货", description: "License 已生成或硬件已发货。" });
  }
  if (状态 === "shipped") {
    动作.push({ key: "complete", title: "完成订单", description: "客户签收或实施完成，订单归档。" });
  }
  if (!["completed", "cancelled", "replaced"].includes(状态)) {
    动作.push({
      key: "cancel",
      title: "取消订单",
      description: "终止该订单，取消后不再流转。",
      danger: true,
    });
  }
  return 动作;
});

onMounted(() => {
  void 加载订单();
  if (管理端角色.value) void 加载账号目录();
});

async function 加载订单() {
  if (!订单编号.value) {
    错误.value = "缺少订单编号。";
    return;
  }
  加载中.value = true;
  错误.value = "";
  try {
    const 结果 = await 查询阶段9列表("orders", { page: 1, pageSize: 200 });
    订单.value =
      结果.数据.find((item) => item.id === 订单编号.value || item.编号 === 订单编号.value) || null;
    if (!订单.value) throw new Error("未找到订单，可能已超出当前账号的数据范围。");
    表单.amount = Number(订单.value.金额 || 0);
  } catch (error) {
    错误.value = error instanceof Error ? error.message : "订单处理数据加载失败。";
  } finally {
    加载中.value = false;
  }
}

function 打开动作(action: 动作定义) {
  当前动作.value = action.key;
  表单.reason = "";
  表单.amount = Number(订单.value?.金额 || 0);
  表单.returnTarget = action.key === "region_return" ? "secondary" : "region";
  表单.nextStatus = "processing";
  if (action.key === "resubmit") {
    初始化重提明细();
    显示产品选择.value = false;
    产品目录关键词.value = "";
    void 加载产品目录();
    void 刷新重提试算();
  }
}

/** 重提初始明细优先取上一次提交版本（含产品引用），否则取订单当前模块明细。 */
function 初始化重提明细() {
  const 原始 = (订单.value?.原始数据 as Record<string, unknown>) || {};
  const 上一次 = 原始.resubmission as Record<string, unknown> | undefined;
  const 来源 = (
    Array.isArray(上一次?.items)
      ? (上一次?.items as Array<Record<string, unknown>>)
      : Array.isArray(原始.items)
        ? (原始.items as Array<Record<string, unknown>>)
        : []
  ).map((项) => ({
    itemName: String(项.itemName || 项.名称 || "订单模块"),
    productRefType: String(项.productRefType || ""),
    productRefId: String(项.productRefId || ""),
    quantity: Number(项.quantity || 项.数量 || 1) || 1,
    unitPrice: Number(项.unitPrice || 项.单价 || 0) || 0,
  }));
  重提明细.value = 来源;
}

async function 加载产品目录() {
  if (产品目录.value.length) return;
  const 结果 = await 查询阶段9全部("products").catch(() => ({ 数据: [] as 阶段9记录[], 总数: 0 }));
  产品目录.value = 结果.数据;
}

/** 产品目录类型 → 服务端可识别的产品引用类型。 */
function 产品引用类型(产品: 阶段9记录): string {
  if (产品.类型 === "功能模块") return "feature";
  if (产品.类型 === "硬件产品") return "hardware";
  if (产品.类型 === "产品套餐") return "package";
  return "manual";
}

const 过滤产品目录 = computed(() => {
  const 已选 = new Set(重提明细.value.map((项) => 项.productRefId).filter(Boolean));
  const 候选 = 产品目录.value.filter((产品) => !已选.has(产品.id));
  const 关键词 = 产品目录关键词.value.trim();
  const 命中 = 关键词 ? 候选.filter((产品) => String(产品.标题 || "").includes(关键词)) : 候选;
  return 命中.slice(0, 30);
});

const 重提合计 = computed(
  () =>
    Math.round(
      重提明细.value.reduce((合计, 项) => 合计 + Number(项.quantity) * Number(项.unitPrice), 0) *
        100,
    ) / 100,
);

function 添加重提模块(产品: 阶段9记录) {
  if (重提明细.value.some((项) => 项.productRefId === 产品.id)) {
    ElMessage.warning("该模块已在明细中。");
    return;
  }
  重提明细.value = [
    ...重提明细.value,
    {
      itemName: String(产品.标题 || 产品.编号 || "新增模块"),
      productRefType: 产品引用类型(产品),
      productRefId: 产品.id,
      quantity: 1,
      unitPrice: Number(产品.金额 || 0) || 0,
    },
  ];
  产品目录关键词.value = "";
  void 刷新重提试算();
}

function 移除重提明细(索引: number) {
  if (重提明细.value.length <= 1) {
    ElMessage.warning("请至少保留一项报价模块明细。");
    return;
  }
  重提明细.value = 重提明细.value.filter((_, 位置) => 位置 !== 索引);
}

/** 模块数量必须是大于 0 的整数，调整后由服务端按新数量重新取价。 */
function 调整重提数量(索引: number, 事件: Event) {
  const 输入框 = 事件.target as HTMLInputElement | null;
  const 数值 = Math.floor(Number(输入框?.value));
  if (!Number.isFinite(数值) || 数值 <= 0) {
    if (输入框) 输入框.value = String(重提明细.value[索引]?.quantity || 1);
    ElMessage.warning("模块数量必须是大于 0 的整数。");
    return;
  }
  重提明细.value = 重提明细.value.map((项, 位置) =>
    位置 === 索引 ? { ...项, quantity: 数值 } : 项,
  );
  void 刷新重提试算();
}

/** 用试算接口按订单所属商机的区域与渠道等级重新取价，单价仍由服务端最终裁定。 */
async function 刷新重提试算() {
  const 可试算 = 重提明细.value.filter((项) => 项.productRefId);
  if (!可试算.length) return;
  const 原始 = (订单.value?.原始数据 as Record<string, unknown>) || {};
  const 商机编号 = String(原始.opportunityUuid || 原始.opportunityNo || 原始.oppId || "");
  if (!商机编号) return;
  试算中.value = true;
  try {
    const 结果: 报价试算结果 = await 试算报价({
      opportunityId: 商机编号,
      endpoints: Math.max(...重提明细.value.map((项) => Number(项.quantity) || 1), 1),
      productIds: [...new Set(可试算.map((项) => 项.productRefId))],
      itemQuantities: Object.fromEntries(
        可试算.map((项) => [项.productRefId, Number(项.quantity) || 1]),
      ),
    });
    const 单价表 = new Map(结果.items.map((项) => [项.id, Number(项.单价) || 0]));
    const 名称单价表 = new Map(结果.items.map((项) => [项.名称, Number(项.单价) || 0]));
    重提明细.value = 重提明细.value.map((项) => {
      const 单价 = 单价表.get(项.productRefId) || 名称单价表.get(项.itemName);
      return 单价 && 单价 > 0 ? { ...项, unitPrice: 单价 } : 项;
    });
  } catch {
    // 试算失败时保留历史单价，最终金额以重新提交接口的服务端计算为准。
  } finally {
    试算中.value = false;
  }
}

async function 提交动作() {
  if (!订单.value || !当前动作.value || 提交中.value) return;
  const 需要原因 = [
    "primary_reject",
    "region_return",
    "region_price_adjust",
    "superadmin_return",
    "resubmit",
  ].includes(当前动作.value);
  if (需要原因 && !表单.reason.trim()) {
    ElMessage.warning("请填写业务原因。");
    return;
  }
  if (当前动作.value === "region_price_adjust" && 表单.amount <= 0) {
    ElMessage.warning("调价金额必须大于 0。");
    return;
  }
  if (当前动作.value === "resubmit") {
    if (!重提明细.value.length) {
      ElMessage.warning("请至少保留一项报价模块明细。");
      return;
    }
    if (重提明细.value.some((项) => !Number.isFinite(Number(项.quantity)) || Number(项.quantity) <= 0)) {
      ElMessage.warning("模块数量必须是大于 0 的整数。");
      return;
    }
  }
  提交中.value = true;
  try {
    const 载荷: Record<string, unknown> = { reason: 表单.reason.trim() };
    if (当前动作.value === "region_price_adjust") {
      载荷.amount = 表单.amount;
      载荷.total = 表单.amount;
    }
    if (当前动作.value === "resubmit") {
      // 模块、数量与系统单价按报价单口径提交；订单金额由服务端按最新取价规则重算。
      载荷.items = 重提明细.value.map((项) => ({
        itemName: 项.itemName,
        productRefType: 项.productRefType || undefined,
        productRefId: 项.productRefId || undefined,
        quantity: Number(项.quantity),
        unitPrice: Number(项.unitPrice),
        lineAmount: Math.round(Number(项.quantity) * Number(项.unitPrice) * 100) / 100,
      }));
    }
    if (当前动作.value === "superadmin_return" || 当前动作.value === "region_return") {
      载荷.returnTarget = 表单.returnTarget;
      载荷.status =
        表单.returnTarget === "region"
          ? "returned_to_region"
          : 表单.returnTarget === "primary"
            ? "returned_to_primary"
            : "returned_to_secondary";
    }
    const 更新后 = await 执行订单动作(订单.value.id, 当前动作.value, 载荷);
    订单.value = 更新后;
    当前动作.value = null;
    ElMessage.success("订单动作已提交，状态与审批历史已刷新。");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "订单动作提交失败。");
  } finally {
    提交中.value = false;
  }
}

function 字段(row: 阶段9记录 | null, ...keys: string[]): string {
  if (!row) return "";
  for (const key of keys) {
    const 顶层 = (row as unknown as Record<string, unknown>)[key];
    const 原始 = row.原始数据?.[key];
    if (顶层 !== undefined && 顶层 !== null && 顶层 !== "") return String(顶层);
    if (原始 !== undefined && 原始 !== null && 原始 !== "") return String(原始);
  }
  return "";
}

function 数字(value: unknown): number {
  const 结果 = Number(value || 0);
  return Number.isFinite(结果) ? 结果 : 0;
}

function 金额(value: unknown): string {
  return `¥${数字(value).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function 状态名称(status: string): string {
  return (
    {
      pending: "待确认",
      pending_primary_confirm: "待一级确认",
      primary_confirmed: "一级已确认",
      primary_rejected: "一级已驳回",
      pending_superadmin_confirm: "待超管确认",
      returned_to_region: "已退回区管修改",
      returned_to_primary: "已退回一级修改",
      returned_to_secondary: "已退回二级修改",
      revision_requested: "待回退修改审核",
      confirmed: "已确认",
      processing: "处理中",
      shipped: "已发货",
      completed: "已完成",
      cancelled: "已取消",
      rejected: "已驳回",
    }[status] ||
    (status ? "其他状态" : "—")
  );
}

function 时间(value: unknown): string {
  const 文本 = String(value || "");
  if (!文本) return "—";
  const 日期 = new Date(文本);
  return Number.isNaN(日期.getTime()) ? 文本 : 日期.toLocaleString("zh-CN", { hour12: false });
}
</script>

<template>
  <section class="订单处理页">
    <header class="订单页头">
      <div>
        <button
          class="返回按钮"
          type="button"
          @click="路由器.push(`${外壳前缀}/order`)"
        >
          ← 返回订单中心
        </button>
        <span class="页面标签">订单审批与履约</span>
        <h1>{{ 订单?.客户名称 || 订单?.标题 || "订单处理" }}</h1>
        <p>{{ 订单?.编号 || 订单编号 }} · {{ 状态名称(当前状态) }}</p>
      </div>
      <span class="当前状态">{{ 状态名称(当前状态) }}</span>
    </header>

    <div v-if="错误" class="错误提示">{{ 错误 }}</div>
    <div v-if="加载中" class="加载态">正在加载订单、报价快照和审批历史...</div>

    <template v-else-if="订单">
      <section class="订单摘要">
        <article>
          <span>订单总额</span><strong>{{ 金额(订单.金额) }}</strong
          ><small>报价快照金额</small>
        </article>
        <article>
          <span>来源报价</span
          ><strong>{{ 字段(订单, "quoteNo", "quoteId", "报价编号") || "—" }}</strong
          ><small>订单不直接修改报价</small>
        </article>
        <article>
          <span>渠道层级</span
          ><strong>{{ 分销层级文本 }}</strong
          ><small>{{ 字段(订单, "渠道名称", "partnerName") }}</small>
        </article>
        <article>
          <span>审批轮次</span><strong>{{ 字段(订单, "approvalRound") || "1" }}</strong
          ><small>{{ 姓名(字段(订单, "regionConfirmedByUsername")) || "等待审批" }}</small>
        </article>
      </section>

      <div class="订单布局">
        <main class="订单主体">
          <section class="数据面板">
            <div class="面板标题">
              <div>
                <h2>商品与模块明细</h2>
                <p>订单明细来自报价快照，调价不会覆盖原报价。</p>
              </div>
            </div>
            <div class="表格容器">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>产品 / 模块</th>
                    <th>数量</th>
                    <th>订单单价</th>
                    <th>小计</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(item, index) in 明细" :key="String(item.productRefId || index)">
                    <td>{{ index + 1 }}</td>
                    <td>
                      <strong>{{ item.itemName || item.name || "—" }}</strong>
                    </td>
                    <td>{{ 数字(取数(item.数量, item.quantity)) }}</td>
                    <td>{{ 金额(取数(item.单价, item.unitPrice)) }}</td>
                    <td>
                      <strong>{{ 金额(取数(item.小计, item.lineAmount)) }}</strong>
                    </td>
                  </tr>
                  <tr v-if="!明细.length">
                    <td colspan="5"><div class="空态">当前订单没有可展示的模块明细。</div></td>
                  </tr>
                </tbody>
                <tfoot v-if="明细.length">
                  <tr>
                    <td colspan="4">明细合计</td>
                    <td>{{ 金额(明细合计) }}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <section class="数据面板">
            <div class="面板标题">
              <div>
                <h2>订单信息</h2>
                <p>客户、收货信息、来源和最终审批结果。</p>
              </div>
            </div>
            <dl class="订单定义">
              <div>
                <dt>客户名称</dt>
                <dd>{{ 订单.客户名称 || 字段(订单, "customerName") || "—" }}</dd>
              </div>
              <div>
                <dt>归属渠道</dt>
                <dd>{{ 订单.渠道名称 || 字段(订单, "partnerName") || "—" }}</dd>
              </div>
              <div>
                <dt>负责人</dt>
                <dd>{{ 订单.负责人 || 字段(订单, "ownerName") || "—" }}</dd>
              </div>
              <div>
                <dt>签单人员</dt>
                <dd>{{ 字段(订单, "assignedStaffName") || "未指派" }}</dd>
              </div>
              <div v-if="管理端角色">
                <dt>负责区管</dt>
                <dd>{{ 姓名(字段(订单, "regionConfirmedByUsername")) || "未确认" }}</dd>
              </div>
              <div>
                <dt>订单产品类型</dt>
                <dd>{{ 产品类型文本 }}</dd>
              </div>
              <div>
                <dt>所在区域</dt>
                <dd>{{ 订单.区域 || 字段(订单, "region") || "—" }}</dd>
              </div>
              <div>
                <dt>收货地址</dt>
                <dd>{{ 字段(订单, "deliveryAddr", "contacts") || "—" }}</dd>
              </div>
              <div>
                <dt>关联商机</dt>
                <dd>{{ 字段(订单, "oppId", "opportunityNo") || "—" }}</dd>
              </div>
              <div>
                <dt>报备编号</dt>
                <dd>{{ 字段(订单, "registrationNo") || "—" }}</dd>
              </div>
              <div>
                <dt>下单时间</dt>
                <dd>{{ 时间(订单.创建时间) }}</dd>
              </div>
              <div>
                <dt>最近更新</dt>
                <dd>{{ 时间(订单.更新时间) }}</dd>
              </div>
            </dl>
          </section>

          <section class="数据面板">
            <div class="面板标题">
              <div>
                <h2>审批与履约历史</h2>
                <p>保留每次状态变化、操作人和业务原因。</p>
              </div>
            </div>
            <div class="审批时间线">
              <article v-for="(记录, index) in [...状态历史].reverse()" :key="index">
                <i></i>
                <div>
                  <strong>{{ 状态名称(String(记录.to || "")) }}</strong>
                  <p>{{ 记录.remark || "未填写说明" }}</p>
                </div>
                <time>{{ 时间(记录.timestamp) }}<br />{{ 记录.operatorName || "系统" }}</time>
              </article>
              <div v-if="!状态历史.length" class="空态">暂无审批历史。</div>
            </div>
          </section>

          <QuoteProfitPanel v-if="管理端角色 && 报价编号" :quote-id="报价编号" />
        </main>

        <aside class="动作面板">
          <div class="面板标题">
            <div>
              <h2>当前可执行动作</h2>
              <p>仅显示当前角色和订单状态允许的操作。</p>
            </div>
          </div>
          <div v-if="可用动作.length" class="动作列表">
            <article v-for="动作 in 可用动作" :key="动作.key" :class="{ danger: 动作.danger }">
              <div>
                <strong>{{ 动作.title }}</strong>
                <p>{{ 动作.description }}</p>
              </div>
              <button type="button" @click="打开动作(动作)">执行</button>
            </article>
          </div>
          <div v-else class="空态">当前角色在该订单状态下没有可执行动作。</div>
          <div class="规则提示">
            <strong>审批边界</strong>
            <p>一级确认、区管确认、超管确认、调价、退回和修订重新提交均由服务端再次校验。</p>
          </div>
        </aside>
      </div>
    </template>

    <div v-if="当前动作" class="弹窗遮罩" @click.self="当前动作 = null">
      <section class="动作弹窗" :class="{ 宽弹窗: 当前动作 === 'resubmit' }">
        <header>
          <div>
            <h2>{{ 可用动作.find((item) => item.key === 当前动作)?.title }}</h2>
            <p>{{ 订单?.编号 }} · 当前状态 {{ 状态名称(当前状态) }}</p>
          </div>
          <button type="button" @click="当前动作 = null">×</button>
        </header>
        <div class="动作表单">
          <label v-if="当前动作 === 'region_price_adjust'">
            <span>调整后订单总额 *</span>
            <input v-model.number="表单.amount" type="number" min="0" step="0.01" />
          </label>
          <label v-if="当前动作 === 'superadmin_return' || 当前动作 === 'region_return'">
            <span>退回目标 *</span>
            <select v-model="表单.returnTarget">
              <option v-if="当前动作 === 'superadmin_return'" value="region">
                退回区域管理员修改
              </option>
              <option value="primary">退回一级渠道商修改</option>
              <option value="secondary">退回二级渠道商修改</option>
            </select>
          </label>
          <div v-if="当前动作 === 'resubmit'" class="重提编辑器">
            <div class="重提表头">
              <span>产品 / 模块</span>
              <span>数量</span>
              <span>系统单价</span>
              <span>小计</span>
              <span>操作</span>
            </div>
            <div v-for="(项, 索引) in 重提明细" :key="索引" class="重提行">
              <strong>{{ 项.itemName }}</strong>
              <input
                type="number"
                min="1"
                step="1"
                :value="项.quantity"
                @change="调整重提数量(索引, $event)"
              />
              <span>{{ 金额(项.unitPrice) }}</span>
              <b>{{ 金额(Number(项.quantity) * Number(项.unitPrice)) }}</b>
              <button type="button" class="移除按钮" @click="移除重提明细(索引)">移除</button>
            </div>
            <div class="重提合计">
              <span>订单总额（系统取价）</span>
              <strong>{{ 金额(重提合计) }}</strong>
            </div>
            <button type="button" class="次要按钮 添加模块按钮" @click="显示产品选择 = !显示产品选择">
              {{ 显示产品选择 ? "收起产品目录" : "＋ 从产品目录添加模块" }}
            </button>
            <div v-if="显示产品选择" class="产品选择面板">
              <input v-model="产品目录关键词" placeholder="搜索产品或模块名称" />
              <div class="产品选择列表">
                <button
                  v-for="产品 in 过滤产品目录"
                  :key="产品.id"
                  type="button"
                  @click="添加重提模块(产品)"
                >
                  <span>{{ 产品.标题 || 产品.编号 }}</span>
                  <small>{{ 产品.类型 }}</small>
                </button>
                <div v-if="!过滤产品目录.length" class="空态">没有匹配的产品或模块。</div>
              </div>
            </div>
            <p class="重提提示">
              数量可调整，单价由系统按区域覆盖价、渠道等级价和阶梯价重新计算；金额以服务端计算为准。
              <template v-if="试算中">（正在重新取价...）</template>
            </p>
          </div>
          <label>
            <span
              >业务原因
              {{
                [
                  "primary_reject",
                  "region_return",
                  "region_price_adjust",
                  "superadmin_return",
                  "resubmit",
                ].includes(
                  当前动作,
                )
                  ? "*"
                  : "（可选）"
              }}</span
            >
            <textarea
              v-model="表单.reason"
              rows="4"
              placeholder="填写审批、调价、退回或修订原因，结果会写入审批历史。"
            ></textarea>
          </label>
        </div>
        <footer>
          <button class="次要按钮" type="button" @click="当前动作 = null">取消</button>
          <button
            class="危险按钮"
            v-if="['primary_reject', 'region_return', 'superadmin_return', 'cancel'].includes(当前动作)"
            type="button"
            :disabled="提交中"
            @click="提交动作"
          >
            {{ 提交中 ? "提交中..." : "确认执行" }}
          </button>
          <button class="主按钮" v-else type="button" :disabled="提交中" @click="提交动作">
            {{ 提交中 ? "提交中..." : "确认执行" }}
          </button>
        </footer>
      </section>
    </div>
  </section>
</template>

<style scoped>
.订单处理页 {
  display: grid;
  min-width: 1180px;
  gap: 18px;
  color: #172b4d;
}
.订单页头 {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  padding: 22px 24px;
  border: 1px solid #dce7f3;
  border-radius: 12px;
  background: linear-gradient(120deg, #fff, #f3f8ff);
}
.页面标签 {
  color: #2f69ed;
  font-size: 11px;
  font-weight: 700;
}
.订单页头 h1 {
  margin: 7px 0 5px;
  font-size: 22px;
}
.订单页头 p {
  margin: 0;
  color: #60748c;
  font-size: 11px;
}
.当前状态 {
  padding: 8px 12px;
  border-radius: 999px;
  color: #175bcf;
  background: #e9f2ff;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}
.错误提示 {
  padding: 12px 14px;
  border: 1px solid #f0c4c4;
  border-radius: 8px;
  color: #a72f2f;
  background: #fff2f2;
}
.加载态,
.空态 {
  padding: 40px;
  color: #73849a;
  text-align: center;
}
.订单摘要 {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}
.订单摘要 article {
  display: grid;
  gap: 6px;
  padding: 17px 18px;
  border: 1px solid #dce7f3;
  border-radius: 10px;
  background: #fff;
}
.订单摘要 span,
.订单摘要 small {
  color: #74869b;
  font-size: 11px;
}
.订单摘要 strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 16px;
}
.订单布局 {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 330px;
  gap: 18px;
  align-items: start;
}
.订单主体 {
  display: grid;
  gap: 18px;
  min-width: 0;
}
.数据面板,
.动作面板 {
  overflow: hidden;
  border: 1px solid #dce7f3;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(35, 69, 115, 0.05);
}
.面板标题 {
  padding: 16px 18px;
  border-bottom: 1px solid #e8eef6;
}
.面板标题 h2 {
  margin: 0;
  font-size: 16px;
}
.面板标题 p {
  margin: 5px 0 0;
  color: #74869b;
  font-size: 11px;
}
.表格容器 {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th {
  padding: 11px 14px;
  color: #667991;
  background: #f7f9fc;
  font-size: 11px;
  text-align: left;
  white-space: nowrap;
}
td {
  padding: 13px 14px;
  border-top: 1px solid #eaf0f7;
  color: #40556c;
  font-size: 11px;
  white-space: nowrap;
}
tfoot td {
  color: #175bcf;
  background: #f7fbff;
  font-weight: 700;
  text-align: right;
}
.订单定义 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0;
  padding: 0 18px;
  margin: 0;
}
.订单定义 > div {
  display: grid;
  grid-template-columns: 100px minmax(0, 1fr);
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid #eef2f7;
}
.订单定义 dt {
  color: #8190a3;
  font-size: 11px;
}
.订单定义 dd {
  margin: 0;
  color: #34495f;
  font-size: 11px;
  /* 值与标签贴近左对齐，避免宽单元格里标签和值左右分离、看起来不成对。 */
  text-align: left;
  word-break: break-word;
}
.审批时间线 {
  padding: 18px;
}
.审批时间线 article {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr) 170px;
  gap: 10px;
  padding-bottom: 18px;
}
.审批时间线 i {
  width: 9px;
  height: 9px;
  margin-top: 5px;
  border-radius: 50%;
  background: #2367d1;
  box-shadow: 0 0 0 4px #e8f2ff;
}
.审批时间线 strong {
  font-size: 11px;
}
.审批时间线 p {
  margin: 5px 0 0;
  color: #51677e;
  font-size: 11px;
  line-height: 1.55;
}
.审批时间线 time {
  color: #8090a3;
  font-size: 11px;
  line-height: 1.6;
  text-align: right;
}
.动作面板 {
  position: sticky;
  top: 14px;
}
.动作列表 {
  display: grid;
  gap: 10px;
  padding: 16px;
}
.动作列表 article {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 13px;
  border: 1px solid #dce7f3;
  border-radius: 9px;
  background: #f9fbff;
}
.动作列表 article.danger {
  border-color: #f0cdcd;
  background: #fff8f8;
}
.动作列表 strong {
  font-size: 11px;
}
.动作列表 p {
  margin: 4px 0 0;
  color: #74869b;
  font-size: 11px;
  line-height: 1.45;
}
.动作列表 button {
  min-width: 58px;
  min-height: 32px;
  border: 0;
  border-radius: 7px;
  color: #fff;
  background: #2367d1;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}
.动作列表 article.danger button {
  background: #cf3636;
}
.规则提示 {
  margin: 0 16px 16px;
  padding: 12px;
  border: 1px solid #cfe1ff;
  border-radius: 8px;
  color: #33506f;
  background: #f2f8ff;
}
.规则提示 strong {
  font-size: 11px;
}
.规则提示 p {
  margin: 5px 0 0;
  font-size: 11px;
  line-height: 1.55;
}
.弹窗遮罩 {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(18, 33, 55, 0.42);
  backdrop-filter: blur(4px);
}
.动作弹窗 {
  width: min(620px, 96vw);
  overflow: hidden;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 24px 70px rgba(15, 32, 60, 0.24);
}
.动作弹窗 header,
.动作弹窗 footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px;
  border-bottom: 1px solid #e7eef6;
}
.动作弹窗 footer {
  justify-content: flex-end;
  border-top: 1px solid #e7eef6;
  border-bottom: 0;
}
.动作弹窗 h2 {
  margin: 0;
  font-size: 16px;
}
.动作弹窗 p {
  margin: 5px 0 0;
  color: #75869a;
  font-size: 11px;
}
.动作弹窗 header button {
  width: 32px;
  height: 32px;
  border: 0;
  color: #75869a;
  background: #f2f5f9;
  font-size: 20px;
  cursor: pointer;
}
.动作表单 {
  display: grid;
  gap: 14px;
  padding: 20px;
}
.动作表单 label {
  display: grid;
  gap: 7px;
  color: #425970;
  font-size: 11px;
  font-weight: 700;
}
input,
select,
textarea {
  width: 100%;
  min-height: 40px;
  padding: 9px 11px;
  border: 1px solid #d5e1ee;
  border-radius: 8px;
  color: #34495f;
  background: #fff;
  font: inherit;
  outline: 0;
}
textarea {
  resize: vertical;
  line-height: 1.55;
}
.主按钮,
.次要按钮,
.危险按钮 {
  min-height: 38px;
  padding: 0 15px;
  border-radius: 8px;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}
.主按钮 {
  border: 0;
  color: #fff;
  background: #2367d1;
}
.次要按钮 {
  border: 1px solid #d2e0f0;
  color: #425b76;
  background: #fff;
}
.危险按钮 {
  border: 0;
  color: #fff;
  background: #cf3636;
}
.主按钮:disabled,
.危险按钮:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.动作弹窗.宽弹窗 {
  width: min(780px, 96vw);
}
.重提编辑器 {
  display: grid;
  gap: 10px;
}
.重提表头,
.重提行 {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 96px 110px 120px 66px;
  gap: 10px;
  align-items: center;
}
.重提表头 {
  color: #667991;
  font-size: 11px;
}
.重提行 strong {
  overflow-wrap: anywhere;
  font-size: 11px;
}
.重提行 input {
  min-height: 34px;
  text-align: right;
}
.重提行 span,
.重提行 b {
  font-size: 11px;
  text-align: right;
}
.重提行 b {
  color: #175bcf;
}
.移除按钮 {
  min-height: 32px;
  border: 1px solid #efc9c9;
  border-radius: 7px;
  color: #b83737;
  background: #fff6f6;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}
.重提合计 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border: 1px solid #cfe1ff;
  border-radius: 8px;
  color: #33506f;
  background: #f2f8ff;
  font-size: 11px;
}
.重提合计 strong {
  color: #175bcf;
  font-size: 14px;
}
.添加模块按钮 {
  justify-self: start;
}
.产品选择面板 {
  display: grid;
  gap: 8px;
}
.产品选择列表 {
  display: grid;
  gap: 6px;
  max-height: 220px;
  overflow-y: auto;
  padding: 8px;
  border: 1px solid #e3ebf5;
  border-radius: 8px;
}
.产品选择列表 button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 34px;
  padding: 6px 10px;
  border: 1px solid #dce7f3;
  border-radius: 7px;
  color: #34495f;
  background: #fff;
  font: inherit;
  font-size: 11px;
  text-align: left;
  cursor: pointer;
}
.产品选择列表 button:hover {
  border-color: #9fc2f6;
  background: #f6faff;
}
.产品选择列表 small {
  color: #74869b;
}
.重提提示 {
  margin: 0;
  color: #74869b;
  font-size: 11px;
  line-height: 1.6;
}
</style>
