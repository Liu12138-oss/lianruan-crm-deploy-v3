<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";

const 路由器 = useRouter();
const 选中路径 = ref("/admin/registration");
const 当前板块 = computed(
  () => 业务板块.find((项) => 项.路径 === 选中路径.value) ?? 业务板块[0]!,
);

interface 业务板块项 {
  标题: string;
  描述: string;
  路径: string;
  徽标: string;
  环节: string[];
}

/** 业务全景只呈现业务主线；组织、证书、审核、消息、审计与开放接口属于顶部「配置」菜单。 */
const 业务板块: 业务板块项[] = [
  {
    标题: "客户管理",
    描述: "客户报备、保护期、联系人与关联商机。",
    路径: "/admin/registration",
    徽标: "客户",
    环节: ["客户建档", "报备提交", "保护期校验", "客户跟进", "转商机"],
  },
  {
    标题: "线索管理",
    描述: "外部招投标线索检索、筛选与来源同步。",
    路径: "/admin/leads",
    徽标: "线索",
    环节: ["线索采集", "来源同步", "线索检索", "线索分配", "转客户"],
  },
  {
    标题: "商机作战",
    描述: "商机阶段推进、报价关联与赢单推进。",
    路径: "/admin/opportunity",
    徽标: "商机",
    环节: ["需求挖掘", "客户方案", "POC 试用", "立项推进", "招投标", "成单"],
  },
  {
    标题: "报价管理",
    描述: "套餐、补充功能与自定义报价，含区域覆盖与分销等级取价。",
    路径: "/admin/quote",
    徽标: "报价",
    环节: ["选择商机", "选择模块", "区域取价", "渠道比例", "生成报价单", "打印"],
  },
  {
    标题: "订单中心",
    描述: "报价转订单、订单审批链、数量调整与修订。",
    路径: "/admin/order",
    徽标: "订单",
    环节: ["报价转订单", "一级确认", "区管调价", "超管退回", "订单归档"],
  },
  {
    标题: "渠道管理",
    描述: "渠道主档、核心档案、成员账号与经营贡献。",
    路径: "/admin/partners",
    徽标: "渠道",
    环节: ["渠道建档", "资质审核", "合作中", "续签评估", "成员维护"],
  },
  {
    标题: "产品目录",
    描述: "产品目录、大类、模块、功能、硬件、套餐与价格规则。",
    路径: "/admin/products",
    徽标: "产品",
    环节: ["产品目录", "大类管理", "模块管理", "功能管理", "硬件管理", "套餐管理"],
  },
  {
    标题: "消息中心",
    描述: "审批待办、业务提醒与系统通知。",
    路径: "/admin/notifications",
    徽标: "消息",
    环节: ["待办提醒", "业务通知", "到期提醒", "投递记录"],
  },
];

const 指标 = computed(() => [
  { label: "业务板块", value: String(业务板块.length), unit: "个", note: "客户到订单的主业务链路" },
  { label: "当前板块", value: 当前板块.value.徽标, unit: "", note: 当前板块.value.描述 },
  {
    label: "业务环节",
    value: String(当前板块.value.环节.length),
    unit: "步",
    note: 当前板块.value.环节.join(" → "),
  },
  { label: "管理配置", value: "6", unit: "项", note: "组织、证书、审核、消息、审计与开放接口统一在顶部「配置」菜单" },
]);
</script>

<template>
  <div class="vui war-artboard 业务全景页">
    <div class="war-kpis">
      <article v-for="项 in 指标" :key="项.label" class="list-kpi">
        <div class="metric-label"><span>{{ 项.label }}</span></div>
        <div class="metric-value">
          <strong>{{ 项.value }}</strong><small v-if="项.unit">{{ 项.unit }}</small>
        </div>
        <div class="metric-foot">{{ 项.note }}</div>
      </article>
    </div>

    <div class="war-layout">
      <aside class="war-panel war-list">
        <div class="war-list-head">
          <div class="war-title-row">
            <strong>业务板块</strong><span class="count-badge">{{ 业务板块.length }}</span>
          </div>
          <div class="war-search" style="cursor: default">
            <span>从客户报备到订单交付的主链路</span>
          </div>
        </div>
        <div class="war-list-body">
          <article
            v-for="项目 in 业务板块"
            :key="项目.路径"
            class="war-record"
            :class="{ active: 选中路径 === 项目.路径 }"
            @click="选中路径 = 项目.路径"
          >
            <div class="war-record-top">
              <strong>{{ 项目.标题 }}</strong>
              <span class="status blue">{{ 项目.徽标 }}</span>
            </div>
            <p>{{ 项目.描述 }}</p>
          </article>
        </div>
      </aside>

      <main class="war-panel war-center">
        <div class="war-center-head">
          <div class="deal-title">
            <strong>{{ 当前板块.标题 }}</strong>
            <span>{{ 当前板块.描述 }}</span>
          </div>
          <div class="center-actions">
            <button type="button" class="button primary small" @click="路由器.push(当前板块.路径)">
              进入{{ 当前板块.标题 }}
            </button>
          </div>
        </div>
        <div class="extended-center-grid">
          <section class="panel">
            <header class="panel-head">
              <div><h2>业务环节</h2><p>该板块在业务主线中的推进步骤</p></div>
            </header>
            <div class="panel-body">
              <div class="环节链">
                <span v-for="(环节, 序号) in 当前板块.环节" :key="环节" class="环节项">
                  <b>{{ 序号 + 1 }}</b>{{ 环节 }}
                </span>
              </div>
            </div>
          </section>
        </div>
      </main>

      <aside class="war-panel war-right">
        <div class="right-section">
          <article class="right-card highlight">
            <div class="right-card-title"><strong>实时快照</strong><span>业务全景</span></div>
            <div class="info-grid">
              <div class="info-item"><span>业务板块</span><strong>{{ 业务板块.length }} 个</strong></div>
              <div class="info-item"><span>当前板块</span><strong>{{ 当前板块.徽标 }}</strong></div>
              <div class="info-item"><span>可见角色</span><strong>内部管理员</strong></div>
              <div class="info-item"><span>数据范围</span><strong>按账号数据范围过滤</strong></div>
            </div>
          </article>
          <article class="right-card">
            <div class="right-card-title"><strong>管理入口</strong><span>说明</span></div>
            <p class="war-note">
              组织与账号、证书与风险、审核与业务规则、消息与提醒、操作审计和开放接口属于管理员配置能力，
              统一在顶部一级菜单「配置」的二级菜单中进入。
            </p>
          </article>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.业务全景页 {
  display: grid;
  min-width: 960px;
  gap: 20px;
  color: #172b4d;
}
.环节链 {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.环节项 {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border: 1px solid #dce7f3;
  border-radius: 999px;
  background: #f7fbff;
  color: #3d5b7d;
  font-size: 11px;
  font-weight: 700;
}
.环节项 b {
  display: grid;
  width: 18px;
  height: 18px;
  place-items: center;
  border-radius: 50%;
  background: #2f69ed;
  color: #ffffff;
  font-size: 10px;
}
</style>
