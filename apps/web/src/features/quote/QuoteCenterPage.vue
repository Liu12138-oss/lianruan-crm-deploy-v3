<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import { 下载报价PDF, 查询阶段9全部, type 阶段9记录 } from "../../api/business-client.js";
import type { 指标项 } from "../../components/war/types.js";
import WarKpis from "../../components/war/WarKpis.vue";
import WarLayout from "../../components/war/WarLayout.vue";
import WarRecordCard from "../../components/war/WarRecordCard.vue";
import { 业务类型名称, 记录业务类型 } from "../../shared/business/business-type.js";
import {
  取数,
  文本,
  文本或,
  日期文本,
  日期时间文本,
  金额文本,
} from "../../shared/format/business-format.js";
import { 计算历史缺价序号 } from "../../shared/format/quote-history.js";
import { use外壳前缀 } from "../../shared/navigation/shell-prefix.js";
import { 是内部管理员 } from "../../shared/permission/role.js";
import { useSessionStore } from "../../stores/session.js";
import QuoteProfitPanel from "./QuoteProfitPanel.vue";
import QuoteToOrderDialog from "./QuoteToOrderDialog.vue";

const 路由器 = useRouter();
const 外壳前缀 = use外壳前缀();
const 路由 = useRoute();
const 会话 = useSessionStore();
const 加载中 = ref(false);
const 错误 = ref("");
const 报价列表 = ref<阶段9记录[]>([]);
const 选中编号 = ref("");
const 当前标签 = ref("全部");
const 搜索词 = ref("");
const 选中区域 = ref("全部区域");
const 转单弹窗可见 = ref(false);
const 待转报价 = ref<阶段9记录 | null>(null);

const 标签列表 = ["全部", "待转订单", "标准产品", "渠道分销"];

function 原始(row: 阶段9记录 | null | undefined): Record<string, unknown> {
  return (row?.原始数据 as Record<string, unknown>) || {};
}

function 字段(row: 阶段9记录 | null | undefined, ...键列表: string[]): string {
  const 数据 = 原始(row);
  return 文本(...键列表.map((键) => 数据[键]), ...键列表.map((键) => (row as never)?.[键]));
}

function 明细(row: 阶段9记录 | null | undefined): Array<Record<string, unknown>> {
  const 项 = 原始(row).items;
  return Array.isArray(项) ? (项 as Array<Record<string, unknown>>) : [];
}

const 状态映射: Record<string, string> = {
  draft: "草稿",
  submitted: "已提交",
  approved: "已通过",
  converted: "已转订单",
  rejected: "已驳回",
  expired: "已过期",
  cancelled: "已取消",
};

function 状态码(row: 阶段9记录 | null | undefined): string {
  return 文本(row?.状态, 字段(row, "status"));
}

function 状态文本(row: 阶段9记录 | null | undefined): string {
  // 历史报价的 approved 统一显示“已通过”；订单确认状态才使用“已确认”，避免两个业务概念混用。
  if (状态码(row) === "approved") return "已通过";
  const 名称 = 文本(row?.状态名称);
  if (名称) return 名称;
  const 代码 = 状态码(row);
  return 状态映射[代码] || (代码 ? `${代码}（未知状态）` : "未知状态");
}

function 状态色调(row: 阶段9记录 | null | undefined): "blue" | "green" | "amber" | "red" | "gray" {
  const 代码 = 状态码(row);
  if (代码 === "converted" || 代码 === "approved") return "green";
  if (代码 === "rejected" || 代码 === "expired" || 代码 === "cancelled") return "red";
  if (代码 === "submitted") return "blue";
  return "amber";
}

function 可转订单(row: 阶段9记录 | null | undefined): boolean {
  return ["draft", "submitted", "approved", "rejected"].includes(状态码(row));
}

function 可编辑(row: 阶段9记录 | null | undefined): boolean {
  return ["draft", "rejected"].includes(状态码(row));
}

function 报价类型代码(row: 阶段9记录 | null | undefined): string {
  return 文本(原始(row).quoteTypeCode, "channel_distribution");
}

function 报价类型名称(row: 阶段9记录 | null | undefined): string {
  return 文本(
    原始(row).quoteTypeName,
    报价类型代码(row) === "standard" ? "标准产品报价" : "渠道分销产品报价",
  );
}

function 是标准报价(row: 阶段9记录 | null | undefined): boolean {
  return 报价类型代码(row) === "standard";
}

function 报价金额文本(row: 阶段9记录 | null | undefined): string {
  return 是标准报价(row) ? "待区管定价" : 金额文本(row?.金额);
}

const 内部管理员 = computed(() => 是内部管理员(会话.user));
const 当前报价业务类型 = computed(() => 记录业务类型(当前报价.value));
const 当前报价业务类型名称 = computed(() => 业务类型名称(当前报价业务类型.value, "报价"));
const 当前报价是标准报价 = computed(() => 是标准报价(当前报价.value));
const 当前关联产品订单 = computed(() => {
  const 项 = 当前报价.value?.原始数据?.linkedProductOrders;
  return Array.isArray(项) ? (项 as Array<Record<string, unknown>>) : [];
});
const 价格快照 = computed<Record<string, unknown>>(() => {
  const 快照 = 当前报价.value?.原始数据?.pricingSnapshot;
  return 快照 && typeof 快照 === "object" && !Array.isArray(快照)
    ? (快照 as Record<string, unknown>)
    : {};
});
const 价格版本 = computed(() =>
  文本(
    字段(当前报价.value, "pricingVersion"),
    价格快照.value.pricingVersion,
    "历史报价未记录价格版本",
  ),
);
const 取价时间 = computed(() => {
  const 时间 = 文本(字段(当前报价.value, "pricingCapturedAt"), 价格快照.value.capturedAt);
  return 时间 ? 日期时间文本(时间) : "历史报价未记录取价时间";
});
const 价格规则生效时间 = computed(() => {
  const 时间 = 文本(价格快照.value.effectiveAt);
  return 时间 ? 日期文本(时间) : "未单独配置生效日期";
});

const 区域选项 = computed(() =>
  [...new Set(报价列表.value.map((row: 阶段9记录) => 文本(row.区域)).filter(Boolean))].sort(),
);

const 过滤后列表 = computed(() => {
  let 列表 = 报价列表.value;
  if (当前标签.value === "待转订单") 列表 = 列表.filter((row) => 可转订单(row));
  if (当前标签.value === "标准产品") 列表 = 列表.filter((row) => 是标准报价(row));
  if (当前标签.value === "渠道分销") 列表 = 列表.filter((row) => !是标准报价(row));
  if (选中区域.value && 选中区域.value !== "全部区域")
    列表 = 列表.filter((row) => 文本(row.区域) === 选中区域.value);
  const 关键词 = 搜索词.value.trim().toLowerCase();
  if (!关键词) return 列表;
  return 列表.filter((row) =>
    [row.编号, row.客户名称, row.渠道名称, row.负责人, 字段(row, "opportunityNo", "quoteNo")]
      .filter(Boolean)
      .some((值) => String(值).toLowerCase().includes(关键词)),
  );
});

const 当前报价 = computed(
  () => 报价列表.value.find((row) => row.id === 选中编号.value) || 过滤后列表.value[0] || null,
);

const 流程步骤 = ["待转订单", "已转订单"];
const 阶段序号 = computed(() => {
  return 状态码(当前报价.value) === "converted" ? 1 : 0;
});

const 动态 = computed(() => {
  const 记录 = 当前报价.value;
  if (!记录) return [];
  const 时间 = 文本(记录.更新时间, 记录.创建时间);
  return ["报价单已创建", "价格规则已命中", "状态已更新"]
    .map((标题, 序号) => ({ 标题, 时间: 序号 === 0 ? 日期文本(时间) : "", 说明: "" }))
    .filter((项) => 项.时间 || 项.说明);
});

/** 历史驳回原因继续保留展示，避免旧报价丢失审核说明。 */
const 驳回原因 = computed(() => {
  const 记录 = 当前报价.value;
  return 记录 ? 文本(字段(记录, "reviewRemark", "reason", "审核意见")) : "";
});

/**
 * 历史报价存在“总额有值、明细单价和小计全为 0”的旧快照。
 * 这类数据不能平均分摊或伪造单价，页面需要明确说明，并在保存时保留原明细。
 */
const 历史缺价序号 = computed(() => 计算历史缺价序号(明细(当前报价.value), 当前报价.value?.金额));
const 历史明细缺失价格 = computed(() => 历史缺价序号.value.size > 0);

function 明细金额文本(序号: number, 值: unknown): string {
  return 历史缺价序号.value.has(序号) ? "历史未记录" : 金额文本(值);
}

const 指标 = computed<指标项[]>(() => {
  const 列表 = 报价列表.value;
  const 计数 = (代码: string) => 列表.filter((row) => 状态码(row) === 代码).length;
  const 待转订单 = 列表.filter((row) => 可转订单(row)).length;
  const 已关闭 = 列表.filter((row) => ["cancelled", "expired"].includes(状态码(row))).length;
  const 标准产品 = 列表.filter((row) => 是标准报价(row)).length;
  const 渠道分销 = 列表.length - 标准产品;
  return [
    { label: "报价单总数", value: String(列表.length), unit: "份", note: "当前数据范围内报价单" },
    { label: "待转订单", value: String(待转订单), unit: "份", note: "可直接转为订单" },
    { label: "已转订单", value: String(计数("converted")), unit: "份", note: "不可重复转单" },
    { label: "标准产品", value: String(标准产品), unit: "份", note: "订单由区管补价" },
    { label: "渠道分销", value: String(渠道分销), unit: "份", note: "服务端自动取价" },
    {
      label: "已关闭",
      value: String(已关闭),
      unit: "份",
      note: "取消或过期报价",
    },
  ];
});

onMounted(() => void 加载());

async function 加载() {
  加载中.value = true;
  错误.value = "";
  try {
    const 结果 = await 查询阶段9全部("quotes");
    报价列表.value = 结果.数据;
    const 目标编号 = 文本(路由.query.quoteId);
    const 命中 = 目标编号 ? 报价列表.value.find((row) => row.id === 目标编号) : null;
    选中编号.value = 命中?.id || 报价列表.value[0]?.id || "";
  } catch (异常) {
    错误.value = 异常 instanceof Error ? 异常.message : "报价数据加载失败。";
  } finally {
    加载中.value = false;
  }
}

/** 当前报价关联的商机编号，用于「返回商机」；报价单独立管理，但需要能回到来源商机。 */
const 当前商机编号 = computed(() => 文本(字段(当前报价.value, "opportunityId", "opportunityUuid")));

function 返回商机() {
  const 编号 = 当前商机编号.value;
  路由器.push(
    编号
      ? `${外壳前缀.value}/opportunity?opportunityId=${encodeURIComponent(编号)}`
      : `${外壳前缀.value}/opportunity`,
  );
}

/**
 * 打印报价单：调用服务端正式报价单 PDF（A4），新窗口直接打开浏览器打印预览。
 * 浏览器拦截弹窗时退化为下载，保证「打印 / 下载」始终可用。
 */
async function 打印报价(row: 阶段9记录) {
  if (!row.id) return;
  try {
    const 文件 = await 下载报价PDF(row.id);
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

function 修改报价(row: 阶段9记录) {
  const 商机编号 = 文本(字段(row, "opportunityId", "opportunityUuid"));
  路由器.push(
    `${外壳前缀.value}/quote/edit/${row.id}${
      商机编号 ? `?opportunityId=${encodeURIComponent(商机编号)}` : ""
    }`,
  );
}

function 新建报价(quoteTypeCode: "standard" | "channel_distribution") {
  路由器.push({
    path: `${外壳前缀.value}/quote/new`,
    query: { quoteTypeCode },
  });
}

function 转订单(row: 阶段9记录) {
  待转报价.value = row;
  转单弹窗可见.value = true;
}

async function 转单成功(订单: 阶段9记录) {
  转单弹窗可见.value = false;
  待转报价.value = null;
  await 加载();
  ElMessage.success(`已转为订单：${文本(订单.编号, "订单已创建")}`);
  路由器.push(`${外壳前缀.value}/order?orderId=${encodeURIComponent(订单.id)}`);
}
</script>

<template>
  <div class="vui war-artboard 报价页">
    <WarKpis :items="指标" :加载中="加载中" />

    <div class="报价新建栏">
      <div>
        <strong>新建报价</strong>
        <span>先选择报价体系，再进入产品组装；报价类型创建后不可切换。</span>
      </div>
      <div class="报价新建动作">
        <button type="button" class="button" @click="新建报价('standard')">＋ 标准产品报价</button>
        <button type="button" class="button primary" @click="新建报价('channel_distribution')">
          ＋ 渠道分销产品报价
        </button>
      </div>
    </div>

    <WarLayout
      v-model="搜索词"
      list-title="报价单列表"
      :list-count="String(过滤后列表.length)"
      search-placeholder="搜索报价单编号、客户、渠道商或商机编号"
      :tabs="标签列表"
      :active-tab="当前标签"
      :步骤="流程步骤"
      :当前步骤="阶段序号"
      流程标题="报价转单流程"
      :流程说明="当前报价 ? `当前状态：${状态文本(当前报价)}` : ''"
      :动态="动态"
      :区域列表="区域选项"
      :选中区域="选中区域"
      @update:选中区域="选中区域 = $event"
      @切换标签="当前标签 = $event"
    >
      <template #list>
        <div v-if="加载中" class="war-empty">正在加载报价数据…</div>
        <div v-else-if="错误" class="war-empty">{{ 错误 }}</div>
        <WarRecordCard
          v-for="row in 过滤后列表"
          :key="row.id"
          :title="文本或([row.客户名称, row.标题], '未命名报价')"
          :meta="
            [
              文本(字段(row, 'quoteNo'), row.编号, '无编号'),
              文本(row.客户名称, 字段(row, 'opportunityNo'), '未关联业务'),
            ].join(' · ')
          "
          :badge="状态文本(row)"
          :tone="状态色调(row)"
          :owner="`负责人：${文本(row.负责人, '未指派')}`"
          :amount="报价金额文本(row)"
          :tags="[
            { text: `明细 ${明细(row).length} 项` },
            { text: 报价类型名称(row), hot: 是标准报价(row) },
            {
              text: 可转订单(row)
                ? '可直转订单'
                : 状态码(row) === 'converted'
                  ? '已转订单'
                  : '不可转订单',
              hot: 可转订单(row),
            },
          ]"
          :active="当前报价?.id === row.id"
          @选择="选中编号 = row.id"
        />
        <div v-if="!加载中 && !错误 && !过滤后列表.length" class="war-empty">
          当前筛选条件下没有报价单。
        </div>
      </template>

      <template #center>
        <template v-if="当前报价">
          <div class="war-center-head">
            <div class="deal-title">
              <strong>{{ 文本或([当前报价.客户名称, 当前报价.标题], "未命名报价") }}</strong>
              <span>
                {{ 文本(字段(当前报价, "quoteNo"), 当前报价.编号, "无编号") }} ·
                {{ 文本(当前报价.渠道名称, "未归属渠道") }} ·
                {{ 文本(当前报价.区域, "未填写区域") }} · {{ 当前报价业务类型名称 }} · 关联商机：{{
                  文本(字段(当前报价, "opportunityNo"), "无")
                }}
                · {{ 报价类型名称(当前报价) }}
              </span>
            </div>
            <div class="center-actions">
              <button
                v-if="当前商机编号"
                type="button"
                class="button"
                title="返回该报价单的来源商机"
                @click="返回商机"
              >
                返回商机
              </button>
              <button
                type="button"
                class="button"
                title="打印或下载该报价单的正式 PDF"
                @click="打印报价(当前报价)"
              >
                打印 / 下载 PDF
              </button>
              <button
                type="button"
                class="button"
                :disabled="!可编辑(当前报价)"
                :title="可编辑(当前报价) ? '修改报价' : '只有草稿或已驳回报价可以修改'"
                @click="修改报价(当前报价)"
              >
                修改报价
              </button>
              <button
                type="button"
                class="button primary"
                :disabled="!可转订单(当前报价)"
                @click="转订单(当前报价)"
              >
                {{
                  状态码(当前报价) === "converted"
                    ? "已转订单"
                    : 可转订单(当前报价)
                      ? "报价转订单"
                      : "不可转订单"
                }}
              </button>
            </div>
          </div>

          <div class="extended-center-grid">
            <section class="panel">
              <header class="panel-head">
                <div>
                  <h2>报价明细</h2>
                  <p>共 {{ 明细(当前报价).length }} 项</p>
                </div>
              </header>
              <div class="panel-body flush">
                <p v-if="历史明细缺失价格" class="报价提示">
                  该历史报价的总金额已保留，但旧快照未记录明细单价和小计。请重新试算后再保存，系统不会自动拆分或覆盖原总额。
                </p>
                <table class="vui-table">
                  <thead>
                    <tr>
                      <th>模块 / 产品</th>
                      <th>数量</th>
                      <th v-if="!当前报价是标准报价">单价</th>
                      <th v-if="!当前报价是标准报价">小计</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(项, 序号) in 明细(当前报价)" :key="序号">
                      <td>{{ 文本(取数(项.名称, 项.name, 项.itemName), "未命名项") }}</td>
                      <td>{{ 文本(取数(项.数量, 项.quantity), "—") }}</td>
                      <td v-if="!当前报价是标准报价">
                        {{ 明细金额文本(序号, 取数(项.单价, 项.unitPrice)) }}
                      </td>
                      <td v-if="!当前报价是标准报价">
                        {{ 明细金额文本(序号, 取数(项.小计, 项.lineAmount)) }}
                      </td>
                    </tr>
                    <tr v-if="!明细(当前报价).length">
                      <td :colspan="当前报价是标准报价 ? 2 : 4" class="war-empty">
                        该报价没有明细记录。
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section class="panel">
              <header class="panel-head">
                <div>
                  <h2>报价信息</h2>
                  <p>金额、工作量与状态</p>
                </div>
              </header>
              <div class="panel-body">
                <div class="info-grid">
                  <div class="info-item">
                    <span>报价状态</span><strong>{{ 状态文本(当前报价) }}</strong>
                  </div>
                  <div class="info-item">
                    <span>报价金额</span><strong>{{ 报价金额文本(当前报价) }}</strong>
                  </div>
                  <div class="info-item">
                    <span>报价类型</span><strong>{{ 报价类型名称(当前报价) }}</strong>
                  </div>
                  <div class="info-item">
                    <span>报价业务类型</span><strong>{{ 当前报价业务类型名称 }}</strong>
                  </div>
                  <div class="info-item">
                    <span>端点数量</span>
                    <strong>{{ 文本(字段(当前报价, "endpoints"), "—") }}</strong>
                  </div>
                  <div class="info-item">
                    <span>工作量</span>
                    <strong>{{ 文本(字段(当前报价, "workloadSummary"), "未计算") }}</strong>
                  </div>
                  <div class="info-item">
                    <span>价格版本</span><strong>{{ 价格版本 }}</strong>
                  </div>
                  <div class="info-item">
                    <span>取价时间</span><strong>{{ 取价时间 }}</strong>
                  </div>
                  <div class="info-item">
                    <span>规则生效时间</span><strong>{{ 价格规则生效时间 }}</strong>
                  </div>
                  <div class="info-item">
                    <span>创建时间</span><strong>{{ 日期文本(当前报价.创建时间) }}</strong>
                  </div>
                  <div class="info-item">
                    <span>最近更新</span><strong>{{ 日期文本(当前报价.更新时间) }}</strong>
                  </div>
                  <div v-if="驳回原因" class="info-item full">
                    <span>驳回原因</span><strong class="驳回原因">{{ 驳回原因 }}</strong>
                  </div>
                  <div v-if="当前关联产品订单.length" class="info-item full">
                    <span>关联产品订单</span>
                    <strong>{{
                      当前关联产品订单.map((订单) => 文本(订单.orderNo, 订单.id)).join("、")
                    }}</strong>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <QuoteProfitPanel
            v-if="内部管理员 && 当前报价.id && !当前报价是标准报价"
            :quote-id="当前报价.id"
          />
        </template>
        <div v-else class="war-empty">请选择左侧报价单查看明细。</div>
      </template>

      <template #right>
        <article v-if="当前报价" class="right-card highlight">
          <div class="right-card-title"><strong>实时快照</strong><span>报价单</span></div>
          <div class="info-grid">
            <div class="info-item">
              <span>报价状态</span><strong>{{ 状态文本(当前报价) }}</strong>
            </div>
            <div class="info-item">
              <span>报价金额</span><strong>{{ 报价金额文本(当前报价) }}</strong>
            </div>
            <div class="info-item">
              <span>明细项</span><strong>{{ 明细(当前报价).length }} 项</strong>
            </div>
            <div class="info-item">
              <span>负责人</span><strong>{{ 文本(当前报价.负责人, "未指派") }}</strong>
            </div>
          </div>
        </article>
        <article v-if="当前报价" class="right-card">
          <div class="right-card-title"><strong>转订单规则</strong><span>口径</span></div>
          <p class="war-note">
            报价不再经过报价审批，草稿报价可直接转订单。转单时须填写收货信息；一级渠道还必须填写出货金额并上传合同附件。
            同一报价只能转一次，重复转单会被拒绝并提示已有订单号。
          </p>
          <p v-if="当前报价是标准报价" class="war-note 标准报价说明">
            标准产品报价全链路不展示价格，订单由区管补充最终订单价格后才能继续审批。
          </p>
        </article>
        <article v-if="当前报价 && 驳回原因" class="right-card">
          <div class="right-card-title"><strong>驳回说明</strong><span>需修改</span></div>
          <p class="驳回原因">{{ 驳回原因 }}</p>
        </article>
      </template>
    </WarLayout>

    <QuoteToOrderDialog
      v-if="转单弹窗可见 && 待转报价"
      :报价="待转报价"
      @关闭="转单弹窗可见 = false"
      @成功="转单成功"
    />
  </div>
</template>

<style scoped>
.报价页 {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: 12px;
  min-height: calc(100vh - 96px);
  padding: 14px 18px 18px;
}

.报价新建栏 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 12px 16px;
  border: 1px solid #dce7f3;
  border-radius: 10px;
  background: #fff;
}

.报价新建栏 > div:first-child {
  display: grid;
  gap: 3px;
}

.报价新建栏 strong {
  color: #20354f;
  font-size: 13px;
}

.报价新建栏 span {
  color: #71839a;
  font-size: 11px;
}

.报价新建动作 {
  display: flex;
  gap: 8px;
}

.标准报价说明 {
  color: #8a5a00;
}

.报价页 :deep(.war-kpis) {
  position: static;
  inset: auto;
  height: auto;
}

.报价页 :deep(.war-layout) {
  position: static;
  inset: auto;
  min-height: 620px;
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
  background: #f8fbff;
}

.报价页 :deep(.war-list-body) {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.报价页 :deep(.war-search input) {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--text);
  font-size: 11px;
  outline: none;
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

.war-empty {
  display: grid;
  place-items: center;
  min-height: 80px;
  padding: 16px;
  color: var(--text-3);
  font-size: 11px;
}

.war-note {
  margin: 8px 0 0;
  color: var(--text-3);
  font-size: 11px;
  line-height: 1.6;
}

.报价提示 {
  margin: 0;
  padding: 10px 12px;
  border-bottom: 1px solid #f2d58a;
  background: #fff9e8;
  color: #7d5a00;
  font-size: 11px;
  line-height: 1.6;
}

.驳回原因 {
  color: #b42318;
  line-height: 1.6;
}
</style>
