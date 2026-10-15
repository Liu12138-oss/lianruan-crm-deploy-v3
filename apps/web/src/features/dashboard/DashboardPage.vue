<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import { 查询阶段9全部, type 阶段9记录 } from "../../api/business-client.js";
import WarKpis from "../../components/war/WarKpis.vue";
import WarLayout from "../../components/war/WarLayout.vue";
import { use外壳前缀 } from "../../shared/navigation/shell-prefix.js";
import { 是内部管理员, 是超级管理员 } from "../../shared/permission/role.js";
import { useSessionStore } from "../../stores/session.js";
import { 金额文本, 订单状态文本, 日期时间文本, 文本 } from "../../shared/format/business-format.js";
import type { 指标项 } from "../../components/war/types.js";

const 路由器 = useRouter();
const 外壳前缀 = use外壳前缀();
const 会话 = useSessionStore();
/** 审核中心与审计日志只对内部管理员开放，渠道端不展示这两个入口。 */
const 内部管理员 = computed(() => 是内部管理员(会话.user));
const 超级管理员 = computed(() => 是超级管理员(会话.user));
const 加载中 = ref(false);
const 错误 = ref("");
const 客户列表 = ref<阶段9记录[]>([]);
const 商机列表 = ref<阶段9记录[]>([]);
const 报价列表 = ref<阶段9记录[]>([]);
const 订单列表 = ref<阶段9记录[]>([]);
const 渠道列表 = ref<阶段9记录[]>([]);
const 产品列表 = ref<阶段9记录[]>([]);

const 待办 = computed(() => {
  const 待审核客户 = 客户列表.value
    .filter((row) => row.状态 === "pending")
    .slice(0, 6)
    .map((row) => ({
      类型: "客户报备",
      标题: 文本(row.客户名称, row.标题, "未命名客户"),
      状态: 文本(row.状态名称, "待审核"),
      色调: "amber" as const,
      路径: `${外壳前缀.value}/registration/${row.id}/followup`,
      时间: 日期时间文本(row.创建时间),
    }));
  const 待审订单 = 订单列表.value
    .filter((row) =>
      ["pending", "pending_primary_confirm", "region_pending", "primary_confirmed", "pending_superadmin_confirm"].includes(
        String(row.状态 || ""),
      ),
    )
    .slice(0, 6)
    .map((row) => ({
      类型: "订单审批",
      标题: 文本(row.客户名称, row.标题, "未命名订单"),
      状态: 订单状态文本(row.状态, row.状态名称),
      色调: "blue" as const,
      路径: `${外壳前缀.value}/order/${row.id}/actions`,
      时间: 日期时间文本(row.更新时间),
    }));
  return [...待审核客户, ...待审订单];
});

const 最近业务 = computed(() => {
  const 全部 = [
    ...客户列表.value.map((row) => ({
      类型: "客户报备",
      标题: 文本(row.客户名称, row.标题, "未命名客户"),
      状态: 文本(row.状态名称, row.状态, "—"),
      时间: 文本(row.更新时间, row.创建时间),
      金额: 金额文本(row.金额),
      负责人: 文本(row.负责人, "—"),
    })),
    ...商机列表.value.map((row) => ({
      类型: "商机",
      标题: 文本(row.标题, row.客户名称, "未命名商机"),
      状态: 文本(row.状态名称, row.状态, "—"),
      时间: 文本(row.更新时间, row.创建时间),
      金额: 金额文本(row.金额),
      负责人: 文本(row.负责人, "—"),
    })),
    ...订单列表.value.map((row) => ({
      类型: "订单",
      标题: 文本(row.客户名称, row.标题, "未命名订单"),
      状态: 订单状态文本(row.状态, row.状态名称),
      时间: 文本(row.更新时间, row.创建时间),
      金额: 金额文本(row.金额),
      负责人: 文本(row.负责人, "—"),
    })),
  ];
  return 全部
    .filter((项) => 项.时间)
    .sort((左, 右) => new Date(右.时间).getTime() - new Date(左.时间).getTime())
    .slice(0, 8);
});

const 模块分布 = computed(() => [
  { 名称: "客户报备", 总数: 客户列表.value.length, 待处理: 客户列表.value.filter((row) => row.状态 === "pending").length },
  { 名称: "商机", 总数: 商机列表.value.length, 待处理: 商机列表.value.filter((row) => row.状态 === "active").length },
  { 名称: "报价单", 总数: 报价列表.value.length, 待处理: 报价列表.value.filter((row) => ["draft", "submitted"].includes(String(row.状态 || ""))).length },
  { 名称: "订单", 总数: 订单列表.value.length, 待处理: 订单列表.value.filter((row) => ["pending", "pending_primary_confirm", "region_pending", "primary_confirmed", "pending_superadmin_confirm"].includes(String(row.状态 || ""))).length },
  { 名称: "渠道商", 总数: 渠道列表.value.length, 待处理: 渠道列表.value.filter((row) => String(row.状态 || "") === "pending").length },
]);

const 指标 = computed<指标项[]>(() => [
  { label: "渠道商", value: String(渠道列表.value.length), unit: "家", note: "正式渠道主档" },
  { label: "客户报备", value: String(客户列表.value.length), unit: "条", note: `待审核 ${客户列表.value.filter((row) => row.状态 === "pending").length} 条` },
  { label: "商机", value: String(商机列表.value.length), unit: "条", note: "进行中商机" },
  { label: "报价单", value: String(报价列表.value.length), unit: "份", note: "含草稿与已确认" },
  { label: "订单", value: String(订单列表.value.length), unit: "笔", note: "全部订单" },
  { label: "产品", value: String(产品列表.value.length), unit: "项", note: "正式产品目录" },
]);

onMounted(() => void 加载());

async function 加载() {
  加载中.value = true;
  错误.value = "";
  try {
    const [客户, 商机, 报价, 订单, 渠道, 产品] = await Promise.all([
      查询阶段9全部("registrations"),
      查询阶段9全部("opportunities"),
      查询阶段9全部("quotes"),
      查询阶段9全部("orders"),
      查询阶段9全部("partners"),
      查询阶段9全部("products"),
    ]);
    客户列表.value = 客户.数据;
    商机列表.value = 商机.数据;
    报价列表.value = 报价.数据;
    订单列表.value = 订单.数据;
    渠道列表.value = 渠道.数据;
    产品列表.value = 产品.数据;
  } catch (异常) {
    错误.value = 异常 instanceof Error ? 异常.message : "工作台数据加载失败。";
  } finally {
    加载中.value = false;
  }
}
</script>

<template>
  <div class="vui war-artboard 工作台页">
    <WarKpis :items="指标" />

    <div class="dashboard-body">
      <div v-if="加载中" class="war-empty">正在加载工作台数据…</div>
      <div v-else-if="错误" class="war-empty">{{ 错误 }}</div>

      <div class="grid-2">
        <section class="panel">
          <header class="panel-head">
            <div><h2>我的待办</h2><p>按优先级显示需当前账号处理的业务事项。</p></div>
            <div v-if="内部管理员" class="button-row">
              <button type="button" class="button small" @click="路由器.push(`${外壳前缀}/admin-review`)">
                进入审核中心
              </button>
            </div>
          </header>
          <div class="panel-body">
            <div class="list-stack">
              <article
                v-for="(项, 序号) in 待办"
                :key="序号"
                class="record-card"
                @click="路由器.push(项.路径)"
              >
                <div class="record-top">
                  <strong>{{ 项.标题 }}</strong>
                  <span class="status" :class="项.色调">{{ 项.状态 }}</span>
                </div>
                <p>{{ 项.类型 }} · {{ 项.时间 }}</p>
              </article>
              <p v-if="!待办.length" class="war-note">当前没有待办事项。</p>
            </div>
          </div>
        </section>

        <section class="panel">
          <header class="panel-head">
            <div><h2>业务趋势</h2><p>指标口径待业务确认。</p></div>
          </header>
          <div class="panel-body">
            <div class="grid-2">
              <div class="callout">
                <strong>客户与商机趋势</strong><br />
                <span class="status amber">口径待确认</span><br />
                <span class="record-meta">包含时间范围、统计时间字段和转化分母定义</span>
              </div>
              <div class="callout">
                <strong>报价与订单趋势</strong><br />
                <span class="status amber">口径待确认</span><br />
                <span class="record-meta">包含确认率、履约率、金额口径和币种精度</span>
              </div>
            </div>
            <div class="callout warning" style="margin-top: 12px">
              转化率、趋势、合同额和回款类指标暂不作为正式验收值。
            </div>
          </div>
        </section>
      </div>

      <section class="panel">
        <header class="panel-head">
          <div><h2>最近业务</h2><p>跨模块展示最近发生的关键业务变化。</p></div>
          <div v-if="超级管理员" class="button-row">
            <button type="button" class="button small" @click="路由器.push('/admin/audit-logs')">
              查看操作日志
            </button>
          </div>
        </header>
        <div class="panel-body flush">
          <table class="vui-table">
            <thead>
              <tr>
                <th>业务类型</th>
                <th>对象</th>
                <th>状态</th>
                <th>负责人</th>
                <th>更新时间</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(项, 序号) in 最近业务" :key="序号">
                <td>{{ 项.类型 }}</td>
                <td><span class="record-title">{{ 项.标题 }}</span></td>
                <td>{{ 项.状态 }}</td>
                <td>{{ 项.负责人 }}</td>
                <td>{{ 日期时间文本(项.时间) }}</td>
              </tr>
              <tr v-if="!最近业务.length">
                <td colspan="5" class="war-empty">暂无最近业务。</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.工作台页 {
  display: grid;
  grid-template-rows: 96px auto;
  gap: 12px;
  min-height: 0;
  padding: 10px 20px 18px;
  overflow-y: auto !important;
}

.工作台页 :deep(.war-kpis) {
  position: static;
  inset: auto;
  height: auto;
}

.dashboard-body {
  display: grid;
  gap: 12px;
}

.list-stack {
  display: grid;
  gap: 8px;
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
</style>
