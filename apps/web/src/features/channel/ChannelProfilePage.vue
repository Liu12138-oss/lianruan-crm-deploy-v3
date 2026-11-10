<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import {
  保存渠道年度订单目标,
  查询渠道年度订单目标,
  查询阶段9全部,
  type 渠道年度订单目标,
  type 阶段9记录,
} from "../../api/business-client.js";
import { 渠道等级文本 as 读取渠道等级文本 } from "../../shared/format/business-format.js";
import { 联系电话错误 } from "../../shared/format/phone.js";
import { 渠道可作一级上级 } from "./channel-level.js";
import {
  保存渠道商层级,
  保存渠道核心档案,
  查询渠道核心档案,
  type 渠道核心档案,
} from "./channel-profile-client.js";

const 路由 = useRoute();
const 路由器 = useRouter();
const 加载中 = ref(false);
const 保存中 = ref(false);
const 层级保存中 = ref(false);
const 目标加载中 = ref(false);
const 目标保存中 = ref(false);
const 错误 = ref("");
const 目标错误 = ref("");
const 档案 = ref<渠道核心档案 | null>(null);
const 渠道目标 = ref<渠道年度订单目标 | null>(null);
const 编辑分组 = ref("business");
const 渠道候选 = ref<阶段9记录[]>([]);
const 当前年份 = new Date().getFullYear();

const 表单 = reactive({
  name: "",
  agreementNo: "",
  unifiedSocialCreditCode: "",
  businessStatus: "",
  legalRepresentative: "",
  registeredCapital: "",
  paidInCapital: "",
  establishedAt: "",
  employeeCount: "",
  socialInsuranceCount: "",
  annualRevenue: "",
  invoiceCapability: "",
  businessScope: "",
  address: "",
  serviceAreasText: "",
  contact: "",
  phone: "",
  email: "",
  bossName: "",
  bossPhone: "",
  cooperationBackground: "",
  cooperationLevel: "none",
  distributionLevel: "none",
  parentPartnerIds: [] as string[],
  techServiceType: "",
  agencyBrandsText: "",
  typicalCustomersText: "",
  customerIndustriesText: "",
  authorizedProductsText: "",
  qualificationsText: "",
  authorizationExpiryReminder: "",
  verified: false,
});

const 目标表单 = reactive({
  year: 当前年份,
  targetAmount: 0,
  remark: "",
});

const 分组列表 = [
  { 键: "business", 名称: "工商主体" },
  { 键: "operation", 名称: "经营与地址" },
  { 键: "contact", 名称: "联系人与合作信息" },
  { 键: "level", 名称: "合作与分销层级" },
  { 键: "capability", 名称: "产品能力与提醒" },
];

const 模块标题 = computed(() => 档案.value?.partnerName || 档案.value?.name || "渠道核心档案");
const 可编辑 = computed(() => 档案.value?.permissions?.canEditProfile === true);
const 可维护层级 = computed(() => 档案.value?.permissions?.canMaintainLevel === true);
const 关联只读 = computed(
  () => 档案.value?.relationship === "parent" || 档案.value?.relationship === "child",
);
const 直属一级渠道名称 = computed(() =>
  (档案.value?.parentPartnerNames || []).filter(Boolean).join("、"),
);
const 直属二级渠道名称 = computed(() =>
  (档案.value?.childPartnerNames || []).filter(Boolean).join("、"),
);
const 可编辑目标 = computed(
  () =>
    !关联只读.value &&
    (渠道目标.value?.canEdit === true || 档案.value?.canEditOrderTarget === true),
);
/** 分销层级只展示业务名称，避免 primary / secondary 等内部代码出现在档案页。 */
const 渠道层级名称 = computed(() => {
  const 分销层级 = String(档案.value?.partnerLevel || "").trim();
  return 分销层级 ? 读取渠道等级文本(分销层级) : 读取渠道等级文本(档案.value?.level);
});
const 合作级别名称 = computed(() => 合作级别文本(表单.cooperationLevel));
const 一级渠道选项 = computed(() => {
  const 当前编号 = 文本(档案.value?.partnerId || 档案.value?.id);
  const 当前区域 = 文本(档案.value?.region);
  return 渠道候选.value
    .filter((row) => 行外部编号(row) !== 当前编号 && row.id !== 当前编号)
    .filter((row) => 渠道可作一级上级(row, 当前区域))
    .map((row) => ({
      id: 行外部编号(row),
      label: `${row.标题 || row.渠道名称} · ${行字段(row, "region") || "未填写区域"}`,
    }));
});
const 成员数量 = computed(() => Number(档案.value?.memberCount) || 0);
const 经营摘要 = computed(() => 档案.value?.businessSummary || null);
const 合作状态名称 = computed(() => {
  const 代码 = String(档案.value?.status || "")
    .trim()
    .toLowerCase();
  const 映射: Record<string, string> = {
    active: "合作中",
    pending: "待审批",
    rejected: "已驳回",
    disabled: "已停用",
  };
  return 映射[代码] || (代码 ? "其他状态" : "未设置");
});
const 完整度 = computed(() => {
  const 值 = [
    表单.unifiedSocialCreditCode,
    表单.legalRepresentative,
    表单.registeredCapital,
    表单.establishedAt,
    表单.employeeCount,
    表单.businessScope,
    表单.address,
    表单.contact,
    表单.phone,
    表单.authorizedProductsText,
  ];
  return Math.round((值.filter((item) => item.trim()).length / 值.length) * 100);
});
const 年度完成率 = computed(() => {
  const 目标金额 = Number(渠道目标.value?.targetAmount || 0);
  if (目标金额 <= 0) return "—";
  const 实际金额 = Number(渠道目标.value?.actualOrderAmount || 0);
  return `${((实际金额 / 目标金额) * 100).toFixed(2)}%`;
});

watch(
  () => 路由.params.id,
  () => void 加载档案(),
  { immediate: true },
);

onMounted(() => {
  if (!档案.value) void 加载档案();
  void 加载渠道候选();
  应用路由分组();
});

watch(
  () => 路由.query.group,
  () => 应用路由分组(),
);

async function 加载档案() {
  const id = String(路由.params.id || "");
  if (!id) {
    错误.value = "缺少渠道商编号。";
    return;
  }
  加载中.value = true;
  错误.value = "";
  try {
    const 数据 = await 查询渠道核心档案(id);
    档案.value = 数据;
    应用档案(数据);
    应用订单目标(数据);
    await 加载年度订单目标(id);
  } catch (error) {
    错误.value = error instanceof Error ? error.message : "读取渠道核心档案失败。";
  } finally {
    加载中.value = false;
  }
}

async function 加载年度订单目标(id: string) {
  目标加载中.value = true;
  目标错误.value = "";
  try {
    const 数据 = await 查询渠道年度订单目标(id, 目标表单.year);
    渠道目标.value = 数据;
    应用订单目标(数据);
  } catch (异常) {
    // 档案接口已带回目标字段时保留现有展示；独立目标接口失败只提示该区域，不阻断整页档案。
    if (!渠道目标.value) {
      目标错误.value = 异常 instanceof Error ? 异常.message : "读取年度订单目标失败。";
    }
  } finally {
    目标加载中.value = false;
  }
}

function 应用订单目标(数据: Record<string, unknown> | 渠道核心档案 | 渠道年度订单目标) {
  const 年份 = Number(数据.year || 当前年份);
  目标表单.year = Number.isInteger(年份) && 年份 >= 2000 ? 年份 : 当前年份;
  目标表单.targetAmount = Number(数据.targetAmount || 0);
  目标表单.remark = 文本(dataValue(数据, "remark"));
  const 可编辑 =
    dataValue(数据, "canEdit") === true || dataValue(数据, "canEditOrderTarget") === true;
  渠道目标.value = {
    year: 目标表单.year,
    targetAmount: 目标表单.targetAmount,
    remark: 目标表单.remark,
    updatedAt: 文本(dataValue(数据, "updatedAt")),
    actualOrderAmount: Number(dataValue(数据, "actualOrderAmount") || 0),
    canEdit: 可编辑,
  };
}

function dataValue(数据: Record<string, unknown> | 渠道核心档案 | 渠道年度订单目标, 键: string) {
  return (数据 as Record<string, unknown>)[键];
}

async function 加载渠道候选() {
  try {
    const 结果 = await 查询阶段9全部("partners");
    渠道候选.value = 结果.数据;
  } catch {
    渠道候选.value = [];
  }
}

function 应用路由分组() {
  const 分组 = String(路由.query.group || "");
  if (分组列表.some((项) => 项.键 === 分组)) 编辑分组.value = 分组;
}

function 应用档案(数据: 渠道核心档案) {
  // 兼容接口的扁平字段和历史 profile 嵌套字段；否则工商、地址等已保存数据会被当成空值。
  const 简介 = { ...数据, ...(数据.profile || {}) } as Record<string, unknown>;
  表单.name = 文本(数据.partnerName || 数据.name);
  表单.agreementNo = 文本(数据.agreementNo);
  表单.unifiedSocialCreditCode = 文本(简介.unifiedSocialCreditCode || 数据.creditCode);
  表单.businessStatus = 文本(简介.businessStatus);
  表单.legalRepresentative = 文本(简介.legalRepresentative);
  表单.registeredCapital = 文本(简介.registeredCapital);
  表单.paidInCapital = 文本(简介.paidInCapital);
  表单.establishedAt = 文本(简介.establishedAt);
  表单.employeeCount = 文本(简介.employeeCount);
  表单.socialInsuranceCount = 文本(简介.socialInsuranceCount);
  表单.annualRevenue = 文本(简介.annualRevenue);
  表单.invoiceCapability = 文本(简介.invoiceCapability);
  表单.businessScope = 文本(简介.businessScope);
  表单.address = 文本(简介.address || 数据.address);
  表单.serviceAreasText = 列表文本(简介.serviceAreas || 数据.city || 数据.region);
  表单.contact = 文本(数据.contact);
  表单.phone = 文本(数据.phone);
  表单.email = 文本(数据.email);
  表单.bossName = 文本(简介.bossName);
  表单.bossPhone = 文本(简介.bossPhone);
  表单.cooperationBackground = 文本(简介.cooperationBackground);
  表单.cooperationLevel = 文本(数据.cooperationLevel || 简介.cooperationLevel || "none");
  const 主档层级 = 文本(数据.partnerLevel || 简介.partnerLevel || "none");
  const 有有效下级 = Array.isArray(数据.childPartnerIds) && 数据.childPartnerIds.length > 0;
  表单.distributionLevel = 主档层级 === "none" && 有有效下级 ? "primary" : 主档层级;
  表单.parentPartnerIds = Array.isArray(数据.parentPartnerIds)
    ? 数据.parentPartnerIds.map(文本).filter(Boolean)
    : [];
  表单.techServiceType = 规范技术服务商类型(文本(简介.techServiceType));
  表单.agencyBrandsText = 列表文本(简介.agencyBrands);
  表单.typicalCustomersText = 列表文本(简介.typicalCustomers);
  表单.customerIndustriesText = 列表文本(简介.customerIndustries);
  表单.authorizedProductsText = 列表文本(简介.authorizedProducts);
  表单.qualificationsText = 列表文本(简介.qualifications);
  表单.authorizationExpiryReminder = 文本(简介.authorizationExpiryReminder);
  表单.verified = Boolean(简介.verified);
}

async function 保存() {
  const id = String(路由.params.id || "");
  if (!id || 保存中.value) return;
  const 电话错误 = 联系电话错误(表单.phone) || 联系电话错误(表单.bossPhone);
  if (电话错误) {
    错误.value = 电话错误;
    ElMessage.warning(电话错误);
    return;
  }
  保存中.value = true;
  错误.value = "";
  try {
    const 数据 = await 保存渠道核心档案(id, {
      agreementNo: 表单.agreementNo.trim(),
      unifiedSocialCreditCode: 表单.unifiedSocialCreditCode,
      businessStatus: 表单.businessStatus,
      legalRepresentative: 表单.legalRepresentative,
      registeredCapital: 表单.registeredCapital,
      paidInCapital: 表单.paidInCapital,
      establishedAt: 表单.establishedAt,
      employeeCount: 表单.employeeCount,
      socialInsuranceCount: 表单.socialInsuranceCount,
      annualRevenue: 表单.annualRevenue,
      invoiceCapability: 表单.invoiceCapability,
      businessScope: 表单.businessScope,
      address: 表单.address,
      serviceAreas: 拆分列表(表单.serviceAreasText),
      contact: 表单.contact,
      phone: 表单.phone,
      email: 表单.email,
      bossName: 表单.bossName,
      bossPhone: 表单.bossPhone,
      cooperationBackground: 表单.cooperationBackground,
      techServiceType: 表单.techServiceType,
      agencyBrands: 拆分列表(表单.agencyBrandsText),
      typicalCustomers: 拆分列表(表单.typicalCustomersText),
      customerIndustries: 拆分列表(表单.customerIndustriesText),
      authorizedProducts: 拆分列表(表单.authorizedProductsText),
      qualifications: 拆分列表(表单.qualificationsText),
      authorizationExpiryReminder: 表单.authorizationExpiryReminder,
      verified: 表单.verified,
    });
    档案.value = 数据;
    应用档案(数据);
    ElMessage.success("渠道核心档案已保存。");
  } catch (error) {
    错误.value = error instanceof Error ? error.message : "保存渠道核心档案失败。";
  } finally {
    保存中.value = false;
  }
}

async function 保存层级() {
  const id = String(路由.params.id || "");
  if (!id || 层级保存中.value || !可维护层级.value) return;
  if (表单.distributionLevel === "secondary" && !表单.parentPartnerIds.length) {
    错误.value = "二级渠道商必须至少绑定一个同区域一级渠道商。";
    return;
  }
  层级保存中.value = true;
  错误.value = "";
  try {
    await 保存渠道商层级(id, {
      cooperationLevel: 表单.cooperationLevel,
      partnerLevel: 表单.distributionLevel,
      parentPartnerIds: 表单.distributionLevel === "secondary" ? 表单.parentPartnerIds : [],
    });
    await 加载档案();
    ElMessage.success("合作级别与分销层级已保存。");
  } catch (异常) {
    错误.value = 异常 instanceof Error ? 异常.message : "保存渠道商层级失败。";
  } finally {
    层级保存中.value = false;
  }
}

async function 保存订单目标() {
  const id = String(路由.params.id || "");
  if (!id || 目标保存中.value || !可编辑目标.value) return;
  const 目标金额 = Number(目标表单.targetAmount);
  if (!Number.isFinite(目标金额) || 目标金额 < 0) {
    目标错误.value = "年度订单目标金额必须是大于或等于 0 的有效数字。";
    return;
  }
  if (目标表单.remark.trim().length > 500) {
    目标错误.value = "目标备注不能超过 500 个字符。";
    return;
  }
  目标保存中.value = true;
  目标错误.value = "";
  try {
    const 数据 = await 保存渠道年度订单目标(id, {
      year: 目标表单.year,
      targetAmount: 目标金额,
      remark: 目标表单.remark.trim(),
    });
    渠道目标.value = { ...数据, canEdit: 可编辑目标.value };
    应用订单目标(渠道目标.value);
    ElMessage.success("年度订单目标已保存，实际完成金额由系统自动统计。");
  } catch (异常) {
    目标错误.value = 异常 instanceof Error ? 异常.message : "保存年度订单目标失败。";
  } finally {
    目标保存中.value = false;
  }
}

function 文本(值: unknown): string {
  if (值 === null || 值 === undefined) return "";
  return String(值);
}

function 列表文本(值: unknown): string {
  if (Array.isArray(值)) return 值.map(文本).filter(Boolean).join("、");
  return 文本(值);
}

function 合作级别文本(值: string): string {
  const 映射: Record<string, string> = {
    none: "未设置",
    lep: "核心渠道",
    diamond: "钻石",
    gold: "金牌",
    silver: "银牌",
    bronze: "铜牌",
    industry: "行业总代",
  };
  return 映射[值] || "未设置";
}

/** 技术服务商只有签约、提名两种业务类型；历史无效值按未选择处理。 */
function 规范技术服务商类型(值: string): string {
  return 值 === "full" || 值 === "developing" ? 值 : "none";
}

function 行字段(row: 阶段9记录, 键: string): string {
  const 原始 = (row.原始数据 || {}) as Record<string, unknown>;
  return 文本(原始[键] ?? (row as unknown as Record<string, unknown>)[键]);
}

function 行外部编号(row: 阶段9记录): string {
  return 文本(行字段(row, "id") || row.编号 || row.id);
}

function 金额文本(金额: number | undefined): string {
  return `¥${Number(金额 || 0).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}

function 目标更新时间文本(value: string): string {
  if (!value) return "—";
  const 日期 = new Date(value);
  return Number.isNaN(日期.getTime()) ? value : 日期.toLocaleString("zh-CN", { hour12: false });
}

function 打开经营明细(模块: "registrations" | "opportunities" | "quotes" | "orders") {
  const 编号 = String(档案.value?.id || 档案.value?.partnerId || "").trim();
  if (!编号) return;
  const 路径: Record<typeof 模块, string> = {
    registrations: "/admin/registration",
    opportunities: "/admin/opportunity",
    quotes: "/admin/quote",
    orders: "/admin/order",
  };
  void 路由器.push({ path: 路径[模块], query: { partnerId: 编号 } });
}

function 拆分列表(值: string): string[] {
  return 值
    .split(/[、,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}
</script>

<template>
  <section class="渠道档案页">
    <header class="档案页头">
      <div>
        <button class="返回按钮" type="button" @click="路由器.push('/admin/partners')">
          ← 返回渠道商列表
        </button>
        <span class="档案标签">渠道核心档案</span>
        <span v-if="关联只读" class="档案标签 只读标签">上下级只读</span>
        <h1>{{ 模块标题 }}</h1>
        <p>
          <template v-if="关联只读"
            >查看直属上下级渠道的工商主体、经营地址、联系人和合作信息。</template
          >
          <template v-else>
            集中维护工商主体、经营地址、联系人、合作信息、产品能力和授权提醒。当前成员
            {{ 成员数量 }} 人。
          </template>
        </p>
      </div>
      <div class="档案页动作">
        <span v-if="!关联只读" class="完整度">档案完整度 {{ 完整度 }}%</span>
        <RouterLink
          v-if="!关联只读"
          class="档案按钮"
          :to="`/admin/partners/${encodeURIComponent(String(路由.params.id || ''))}/members`"
        >
          成员维护
        </RouterLink>
        <button
          v-if="!关联只读"
          class="档案按钮 主按钮"
          type="button"
          :disabled="保存中 || !可编辑"
          @click="保存"
        >
          {{ 保存中 ? "保存中..." : "保存档案" }}
        </button>
      </div>
    </header>

    <div v-if="错误" class="档案错误">{{ 错误 }}</div>
    <div v-if="加载中" class="档案加载">正在读取渠道核心档案...</div>

    <section v-else class="档案布局">
      <aside class="档案侧栏">
        <div class="渠道路由卡">
          <span>{{ 模块标题.slice(0, 1) }}</span>
          <strong>{{ 模块标题 }}</strong>
          <small>{{ 档案?.region || "—" }} · {{ 档案?.city || "—" }}</small>
        </div>
        <nav>
          <button
            v-for="分组 in 分组列表"
            :key="分组.键"
            :class="{ active: 编辑分组 === 分组.键 }"
            type="button"
            @click="编辑分组 = 分组.键"
          >
            {{ 分组.名称 }}
          </button>
        </nav>
        <dl>
          <div>
            <dt>渠道商编号</dt>
            <dd>{{ 档案?.partnerId || 档案?.id || "—" }}</dd>
          </div>
          <div>
            <dt>协议编号</dt>
            <dd>{{ 档案?.agreementNo || "—" }}</dd>
          </div>
          <div>
            <dt>合作状态</dt>
            <dd>{{ 合作状态名称 }}</dd>
          </div>
          <div>
            <dt>所属层级</dt>
            <dd>{{ 渠道层级名称 }}</dd>
          </div>
          <div>
            <dt>合作级别</dt>
            <dd>{{ 合作级别名称 }}</dd>
          </div>
          <div v-if="直属一级渠道名称">
            <dt>所属一级渠道商</dt>
            <dd>{{ 直属一级渠道名称 }}</dd>
          </div>
          <div v-if="直属二级渠道名称">
            <dt>直属二级渠道商</dt>
            <dd>{{ 档案?.childPartnerCount || 0 }} 家 · {{ 直属二级渠道名称 }}</dd>
          </div>
        </dl>
      </aside>

      <main class="档案主体">
        <section v-if="!关联只读" class="档案分组 经营摘要组">
          <header>
            <div>
              <h2>合作经营摘要</h2>
              <p>
                与渠道列表、经营报表共用同一统计口径；客户按主体去重，有效报价不含草稿、已取消、已驳回及已归档记录。
              </p>
            </div>
          </header>
          <div class="经营摘要网格">
            <button type="button" @click="打开经营明细('registrations')">
              <span>客户（去重）</span><strong>{{ 经营摘要?.客户数 ?? 0 }}</strong>
            </button>
            <button type="button" @click="打开经营明细('opportunities')">
              <span>在管商机</span><strong>{{ 经营摘要?.商机数 ?? 0 }}</strong>
            </button>
            <button type="button" @click="打开经营明细('quotes')">
              <span>有效报价</span><strong>{{ 经营摘要?.报价单数 ?? 0 }}</strong>
            </button>
            <button type="button" @click="打开经营明细('orders')">
              <span>有效订单</span><strong>{{ 经营摘要?.订单数 ?? 0 }}</strong>
            </button>
          </div>
          <div class="经营金额行">
            <span
              >有效商机金额 <strong>{{ 金额文本(经营摘要?.商机金额) }}</strong></span
            >
            <span
              >有效订单金额 <strong>{{ 金额文本(经营摘要?.订单金额) }}</strong></span
            >
            <span
              >全链路转化率 <strong>{{ 经营摘要?.全链路转化率 ?? 0 }}%</strong></span
            >
          </div>
        </section>

        <section v-if="!关联只读" class="档案分组 年度目标组">
          <header>
            <div>
              <h2>年度订单目标</h2>
              <p>目标金额由管理员人工维护，实际完成金额按当年有效订单自动统计。</p>
            </div>
            <span class="目标年份">{{ 目标表单.year }} 年度</span>
          </header>
          <div v-if="目标错误" class="目标错误">{{ 目标错误 }}</div>
          <div class="年度目标网格">
            <label class="目标字段">
              <span>年度目标金额（人工）</span>
              <div class="目标金额输入">
                <span>¥</span>
                <input
                  v-model.number="目标表单.targetAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  :disabled="!可编辑目标 || 目标保存中"
                  placeholder="请输入年度订单目标金额"
                />
              </div>
              <small>{{
                可编辑目标 ? "超管可维护全部渠道，区管仅可维护本区域。" : "当前账号只读。"
              }}</small>
            </label>
            <div class="目标数据卡">
              <span>系统实际完成金额</span>
              <strong>{{ 金额文本(渠道目标?.actualOrderAmount) }}</strong>
              <small>已确认、处理中、已发货和已完成订单</small>
            </div>
            <div class="目标数据卡">
              <span>年度完成率</span>
              <strong>{{ 年度完成率 }}</strong>
              <small>实际完成金额 ÷ 人工目标金额</small>
            </div>
          </div>
          <label class="目标备注">
            <span>目标备注</span>
            <textarea
              v-model="目标表单.remark"
              maxlength="500"
              rows="3"
              :disabled="!可编辑目标 || 目标保存中"
              placeholder="可填写年度目标说明、重点行业或渠道协同要求"
            ></textarea>
          </label>
          <footer class="目标动作">
            <span>
              {{
                渠道目标?.updatedAt
                  ? `最近更新：${目标更新时间文本(渠道目标.updatedAt)}`
                  : "尚未维护年度订单目标"
              }}
              <template v-if="目标加载中"> · 正在刷新…</template>
            </span>
            <button
              type="button"
              class="档案按钮 主按钮"
              :disabled="!可编辑目标 || 目标保存中 || 目标加载中"
              @click="保存订单目标"
            >
              {{ 目标保存中 ? "保存中..." : "保存年度目标" }}
            </button>
          </footer>
        </section>

        <section v-if="编辑分组 === 'business'" class="档案分组">
          <header>
            <div>
              <h2>工商主体</h2>
              <p>用于渠道身份识别、资质核验和业务审核。</p>
            </div>
            <label class="核验开关"
              ><input v-model="表单.verified" type="checkbox" :disabled="!可编辑" />
              已完成工商核验</label
            >
          </header>
          <div class="表单网格">
            <label><span>渠道商名称</span><input v-model="表单.name" disabled /></label>
            <label
              ><span>协议编号</span
              ><input
                v-model="表单.agreementNo"
                :disabled="!可编辑"
                maxlength="120"
                placeholder="渠道合作协议编号；区管正式确认订单前必须维护"
            /></label>
            <label
              ><span>统一社会信用代码</span
              ><input
                v-model="表单.unifiedSocialCreditCode"
                :disabled="!可编辑"
                placeholder="请输入工商信用代码"
            /></label>
            <label
              ><span>法定代表人</span
              ><input v-model="表单.legalRepresentative" :disabled="!可编辑" placeholder="姓名"
            /></label>
            <label
              ><span>经营状态</span
              ><input
                v-model="表单.businessStatus"
                :disabled="!可编辑"
                placeholder="存续 / 注销 / 迁出"
            /></label>
            <label
              ><span>注册资本</span
              ><input
                v-model="表单.registeredCapital"
                :disabled="!可编辑"
                placeholder="例如：3000 万元"
            /></label>
            <label
              ><span>实缴资本</span
              ><input
                v-model="表单.paidInCapital"
                :disabled="!可编辑"
                placeholder="例如：1800 万元"
            /></label>
            <label
              ><span>成立时间</span
              ><input v-model="表单.establishedAt" :disabled="!可编辑" placeholder="YYYY-MM-DD"
            /></label>
            <label
              ><span>企业人数</span
              ><input v-model="表单.employeeCount" :disabled="!可编辑" placeholder="例如：86 人"
            /></label>
          </div>
        </section>

        <section v-else-if="编辑分组 === 'operation'" class="档案分组">
          <header>
            <div>
              <h2>经营与地址</h2>
              <p>维护经营规模、服务区域和注册办公地址。</p>
            </div>
          </header>
          <div class="表单网格">
            <label
              ><span>社保人数</span
              ><input
                v-model="表单.socialInsuranceCount"
                :disabled="!可编辑"
                placeholder="例如：86 人"
            /></label>
            <label
              ><span>年营业收入</span
              ><input v-model="表单.annualRevenue" :disabled="!可编辑" placeholder="金额或区间"
            /></label>
            <label
              ><span>开票能力</span
              ><input
                v-model="表单.invoiceCapability"
                :disabled="!可编辑"
                placeholder="增值税专票 / 普通发票"
            /></label>
            <label
              ><span>服务区域</span
              ><input
                v-model="表单.serviceAreasText"
                :disabled="!可编辑"
                placeholder="多个区域用顿号分隔"
            /></label>
            <label class="全宽"
              ><span>注册 / 办公地址</span
              ><input v-model="表单.address" :disabled="!可编辑" placeholder="详细地址"
            /></label>
            <label class="全宽"
              ><span>经营范围</span
              ><textarea
                v-model="表单.businessScope"
                :disabled="!可编辑"
                placeholder="经营范围或可展示的业务能力"
              />
            </label>
          </div>
        </section>

        <section v-else-if="编辑分组 === 'contact'" class="档案分组">
          <header>
            <div>
              <h2>联系人与合作信息</h2>
              <p>维护业务联系人、决策人和渠道合作背景。</p>
            </div>
          </header>
          <div class="表单网格">
            <label
              ><span>渠道负责人</span><input v-model="表单.contact" :disabled="!可编辑"
            /></label>
            <label><span>联系电话</span><input v-model="表单.phone" :disabled="!可编辑" /></label>
            <label><span>联系邮箱</span><input v-model="表单.email" :disabled="!可编辑" /></label>
            <label
              ><span>核心决策人</span><input v-model="表单.bossName" :disabled="!可编辑"
            /></label>
            <label
              ><span>决策人电话</span><input v-model="表单.bossPhone" :disabled="!可编辑"
            /></label>
            <label
              ><span>技术服务商类型</span
              ><select v-model="表单.techServiceType" :disabled="!可编辑">
                <option value="none">请选择</option>
                <option value="full">签约技术服务商</option>
                <option value="developing">提名技术服务商</option>
              </select></label
            >
            <label class="全宽"
              ><span>合作背景</span
              ><textarea
                v-model="表单.cooperationBackground"
                :disabled="!可编辑"
                placeholder="合作历史、重点项目和战略关系"
              />
            </label>
          </div>
        </section>

        <section v-else-if="编辑分组 === 'level'" class="档案分组">
          <header>
            <div>
              <h2>合作与分销层级</h2>
              <p>合作级别用于渠道评级；分销层级用于区分一级、二级渠道和价格取价。</p>
            </div>
            <button
              class="档案按钮 主按钮"
              type="button"
              :disabled="层级保存中 || !可维护层级"
              @click="保存层级"
            >
              {{ 层级保存中 ? "保存中..." : "保存层级" }}
            </button>
          </header>
          <div class="表单网格">
            <label>
              <span>合作级别</span>
              <select v-model="表单.cooperationLevel" :disabled="!可维护层级">
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
              <span>渠道分销层级</span>
              <select v-model="表单.distributionLevel" :disabled="!可维护层级">
                <option value="none">未设置</option>
                <option value="primary">一级渠道商</option>
                <option value="secondary">二级渠道商</option>
              </select>
            </label>
            <label v-if="表单.distributionLevel === 'secondary'" class="全宽">
              <span>上级一级渠道商</span>
              <el-select
                v-model="表单.parentPartnerIds"
                class="层级多选"
                multiple
                filterable
                placeholder="选择一个或多个同区域一级渠道商"
                :disabled="!可维护层级"
              >
                <el-option
                  v-for="选项 in 一级渠道选项"
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
          <div class="能力说明">
            二级渠道商必须绑定同区域一级渠道商；校验以服务端会话中的区域为准，跨区域、自绑和循环关系会被拒绝。
          </div>
        </section>

        <section v-else-if="编辑分组 === 'capability'" class="档案分组">
          <header>
            <div>
              <h2>产品能力与提醒</h2>
              <p>维护代理品牌、典型客户、客户行业、授权产品和资质认证。</p>
            </div>
          </header>
          <div class="表单网格">
            <label class="全宽"
              ><span>代理品牌</span
              ><textarea
                v-model="表单.agencyBrandsText"
                :disabled="!可编辑"
                placeholder="多个品牌用顿号分隔"
              />
            </label>
            <label class="全宽"
              ><span>典型客户</span
              ><textarea
                v-model="表单.typicalCustomersText"
                :disabled="!可编辑"
                placeholder="多个客户用顿号分隔"
              />
            </label>
            <label class="全宽"
              ><span>客户行业</span
              ><textarea
                v-model="表单.customerIndustriesText"
                :disabled="!可编辑"
                placeholder="金融、制造业、医疗等，多个行业用顿号分隔"
              />
            </label>
            <label class="全宽"
              ><span>授权产品线</span
              ><textarea
                v-model="表单.authorizedProductsText"
                :disabled="!可编辑"
                placeholder="多个产品用顿号分隔"
              />
            </label>
            <label class="全宽"
              ><span>证书与资质</span
              ><textarea
                v-model="表单.qualificationsText"
                :disabled="!可编辑"
                placeholder="认证类型、人数和有效期"
              />
            </label>
            <label class="全宽"
              ><span>授权到期提醒</span
              ><input
                v-model="表单.authorizationExpiryReminder"
                :disabled="!可编辑"
                placeholder="例如：到期前 60 天提醒"
            /></label>
          </div>
          <div class="能力说明">
            区域管理员的维护范围仅限本区域渠道商；内部管理员账号维护不在渠道档案权限范围内。
          </div>
        </section>
      </main>
    </section>
  </section>
</template>

<style scoped>
.渠道档案页 {
  display: grid;
  min-width: 0;
  width: 100%;
  gap: 18px;
  color: #172b4d;
  overflow-x: hidden;
}
.档案页头 {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding: 22px 24px;
  border: 1px solid #dce7f3;
  border-radius: 12px;
  background: linear-gradient(120deg, #fff, #f3f8ff);
}
.档案标签 {
  color: #2f69ed;
  font-size: 11px;
  font-weight: 700;
}
.档案标签 + .档案标签 {
  margin-left: 8px;
}
.只读标签 {
  padding: 2px 7px;
  border-radius: 999px;
  background: #eef3f8;
  color: #60748c;
}
.档案页头 h1 {
  margin: 8px 0 5px;
  font-size: 22px;
}
.档案页头 p {
  margin: 0;
  color: #60748c;
  font-size: 11px;
}
.档案页动作 {
  display: flex;
  align-items: center;
  gap: 10px;
}
.完整度 {
  display: inline-flex;
  align-items: center;
  min-height: 29px;
  padding: 6px 10px;
  border-radius: 999px;
  background: #e8f9f3;
  color: #0b795d;
  font-size: 11px;
  font-weight: 700;
}
.档案按钮 {
  min-height: 36px;
  margin: 0;
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
.档案按钮.主按钮 {
  border-color: #2f69ed;
  background: #2f69ed;
  color: #fff;
}
.档案错误 {
  padding: 10px 12px;
  border: 1px solid #f1c4ca;
  border-radius: 8px;
  background: #fff0f2;
  color: #b53d49;
  font-size: 11px;
}
.档案加载 {
  display: grid;
  min-height: 420px;
  place-items: center;
  border: 1px solid #dce7f3;
  border-radius: 10px;
  background: #fff;
  color: #60748c;
}
.档案布局 {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 16px;
}
.档案侧栏,
.档案主体 {
  border: 1px solid #dce7f3;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 10px 28px rgba(42, 82, 130, 0.07);
}
.档案侧栏 {
  display: grid;
  align-content: start;
  gap: 16px;
  padding: 18px;
}
.渠道路由卡 {
  display: grid;
  justify-items: center;
  gap: 7px;
  padding: 16px 8px;
  border-radius: 9px;
  background: #f5f9ff;
  text-align: center;
}
.渠道路由卡 > span {
  display: grid;
  width: 46px;
  height: 46px;
  place-items: center;
  border-radius: 50%;
  background: linear-gradient(145deg, #dcecff, #fff);
  color: #1557d6;
  font-size: 18px;
  font-weight: 700;
}
.渠道路由卡 strong {
  font-size: 11px;
}
.渠道路由卡 small {
  color: #8391a5;
  font-size: 11px;
}
.档案侧栏 nav {
  display: grid;
  gap: 5px;
}
.档案侧栏 nav button {
  min-height: 38px;
  padding: 0 12px;
  border: 1px solid #e1eaf5;
  border-radius: 8px;
  background: #f8fbff;
  color: #4f6178;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
}
.档案侧栏 nav button:hover {
  border-color: #c3d8f2;
  background: #f1f7ff;
}
.档案侧栏 nav button.active {
  border-color: #b6d0f7;
  background: #edf5ff;
  color: #1557d6;
}
.档案侧栏 dl {
  display: grid;
  gap: 0;
  margin: 0;
}
.档案侧栏 dl div {
  display: grid;
  gap: 4px;
  padding: 9px 0;
  border-top: 1px solid #edf2f7;
}
.档案侧栏 dt {
  color: #8391a5;
  font-size: 11px;
}
.档案侧栏 dd {
  margin: 0;
  color: #34475f;
  font-size: 11px;
  font-weight: 700;
  overflow-wrap: anywhere;
}
.档案主体 {
  display: grid;
  gap: 18px;
  padding: 22px;
}
.档案分组 {
  display: grid;
  gap: 20px;
}
.档案分组 > header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #edf2f7;
}
.档案分组 h2 {
  margin: 0;
  font-size: 16px;
}
.档案分组 p {
  margin: 6px 0 0;
  color: #8391a5;
  font-size: 11px;
}
.核验开关 {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #60748c;
  font-size: 11px;
  white-space: nowrap;
}

.经营摘要组 {
  padding: 16px;
  border: 1px solid #e4edf8;
  border-radius: 12px;
  background: #f8fbff;
}

.经营摘要网格 {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.经营摘要网格 button {
  display: grid;
  gap: 5px;
  padding: 12px;
  border: 1px solid #dce8f7;
  border-radius: 9px;
  background: #fff;
  color: #60748c;
  text-align: left;
  cursor: pointer;
}

.经营摘要网格 button:hover,
.经营摘要网格 button:focus-visible {
  border-color: #9dbcf6;
  outline: none;
}

.经营摘要网格 strong {
  color: #1f2f44;
  font-size: 20px;
}

.经营金额行 {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  color: #60748c;
  font-size: 11px;
}

.经营金额行 strong {
  color: #1f2f44;
  font-size: 12px;
}

.年度目标组 {
  padding: 16px;
  border: 1px solid #e4edf8;
  border-radius: 12px;
  background: #fbfdff;
}

.目标年份 {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid #cfe1f5;
  border-radius: 999px;
  color: #245a9f;
  background: #eef6ff;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.目标错误 {
  padding: 9px 11px;
  border: 1px solid #f1c4ca;
  border-radius: 8px;
  color: #b53d49;
  background: #fff0f2;
  font-size: 11px;
}

.年度目标网格 {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.目标字段,
.目标数据卡 {
  display: grid;
  align-content: start;
  gap: 7px;
  min-width: 0;
  padding: 13px;
  border: 1px solid #dce8f7;
  border-radius: 9px;
  background: #fff;
}

.目标字段 > span,
.目标数据卡 > span {
  color: #60748c;
  font-size: 11px;
  font-weight: 700;
}

.目标字段 small,
.目标数据卡 small {
  color: #8391a5;
  font-size: 11px;
  line-height: 1.5;
}

.目标数据卡 strong {
  color: #1f2f44;
  font-size: 20px;
}

.目标金额输入 {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  align-items: center;
  overflow: hidden;
  border: 1px solid #b9cde2;
  border-radius: 8px;
  background: #f8fbff;
}

.目标金额输入 > span {
  display: grid;
  height: 100%;
  place-items: center;
  border-right: 1px solid #e1eaf4;
  color: #60748c;
  font-size: 11px;
}

.目标金额输入 input {
  width: 100%;
  min-height: 38px;
  padding: 9px 11px;
  border: 0;
  color: #172b4d;
  background: transparent;
  font: inherit;
  font-size: 11px;
  box-shadow: none;
  outline: 0;
}

.目标金额输入 input:disabled,
.目标备注 textarea:disabled {
  color: #8391a5;
  background: #f6f8fb;
}

.目标备注 {
  display: grid;
  gap: 7px;
}

.目标备注 > span {
  color: #60748c;
  font-size: 11px;
  font-weight: 700;
}

.目标备注 textarea {
  width: 100%;
  min-height: 78px;
  padding: 9px 11px;
  border: 1px solid #dce7f3;
  border-radius: 8px;
  color: #172b4d;
  background: #fff;
  font: inherit;
  font-size: 11px;
  line-height: 1.6;
  resize: vertical;
}

.目标动作 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-top: 12px;
  border-top: 1px solid #edf2f7;
}

.目标动作 > span {
  color: #8391a5;
  font-size: 11px;
}
.表单网格 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px 18px;
}
.表单网格 label {
  display: grid;
  gap: 7px;
  min-width: 0;
}
.表单网格 label > span {
  color: #60748c;
  font-size: 11px;
  font-weight: 700;
}
.表单网格 input,
.表单网格 select,
.表单网格 textarea {
  width: 100%;
  min-height: 38px;
  padding: 9px 11px;
  border: 1px solid #dce7f3;
  border-radius: 8px;
  background: #fff;
  color: #172b4d;
  font: inherit;
  font-size: 11px;
}
.表单网格 input:not(:disabled),
.表单网格 select:not(:disabled),
.表单网格 textarea:not(:disabled) {
  border-color: #b9cde2;
  background: #f8fbff;
  box-shadow: inset 0 0 0 1px rgba(47, 105, 237, 0.04);
}
.表单网格 textarea {
  min-height: 88px;
  resize: vertical;
  line-height: 1.6;
}
.表单网格 input:disabled,
.表单网格 select:disabled,
.表单网格 textarea:disabled {
  background: #f6f8fb;
  color: #8391a5;
}
.表单网格 .全宽 {
  grid-column: 1 / -1;
}
.能力说明 {
  padding: 12px;
  border: 1px solid #cce0f8;
  border-radius: 8px;
  background: #edf5ff;
  color: #1557d6;
  font-size: 11px;
  line-height: 1.65;
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

@media (max-width: 1180px) {
  .档案布局 {
    grid-template-columns: 210px minmax(0, 1fr);
  }
  .年度目标网格 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .目标字段 {
    grid-column: 1 / -1;
  }
}
</style>
