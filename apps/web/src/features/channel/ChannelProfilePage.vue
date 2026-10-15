<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import { 保存渠道核心档案, 查询渠道核心档案, type 渠道核心档案 } from "./channel-profile-client.js";

const 路由 = useRoute();
const 路由器 = useRouter();
const 加载中 = ref(false);
const 保存中 = ref(false);
const 错误 = ref("");
const 档案 = ref<渠道核心档案 | null>(null);
const 编辑分组 = ref("business");

const 表单 = reactive({
  name: "",
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
  techServiceType: "",
  authorizedProductsText: "",
  qualificationsText: "",
  authorizationExpiryReminder: "",
  verified: false,
});

const 分组列表 = [
  { 键: "business", 名称: "工商主体" },
  { 键: "operation", 名称: "经营与地址" },
  { 键: "contact", 名称: "联系人与合作信息" },
  { 键: "capability", 名称: "产品能力与提醒" },
];

const 模块标题 = computed(() => 档案.value?.partnerName || 档案.value?.name || "渠道核心档案");
const 可编辑 = computed(() => 档案.value?.permissions?.canEditProfile !== false);
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

watch(
  () => 路由.params.id,
  () => void 加载档案(),
  { immediate: true },
);

onMounted(() => {
  if (!档案.value) void 加载档案();
});

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
  } catch (error) {
    错误.value = error instanceof Error ? error.message : "读取渠道核心档案失败。";
  } finally {
    加载中.value = false;
  }
}

function 应用档案(数据: 渠道核心档案) {
  const 简介 = 数据.profile || {};
  表单.name = 文本(数据.partnerName || 数据.name);
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
  表单.techServiceType = 文本(数据.techServiceType);
  表单.authorizedProductsText = 列表文本(简介.authorizedProducts);
  表单.qualificationsText = 列表文本(简介.qualifications);
  表单.authorizationExpiryReminder = 文本(简介.authorizationExpiryReminder);
  表单.verified = Boolean(简介.verified);
}

async function 保存() {
  const id = String(路由.params.id || "");
  if (!id || 保存中.value) return;
  保存中.value = true;
  错误.value = "";
  try {
    const 数据 = await 保存渠道核心档案(id, {
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
      authorizedProducts: 拆分列表(表单.authorizedProductsText),
      qualifications: 拆分列表(表单.qualificationsText),
      authorizationExpiryReminder: 表单.authorizationExpiryReminder,
      verified: 表单.verified,
    });
    档案.value = 数据;
    应用档案(数据);
  } catch (error) {
    错误.value = error instanceof Error ? error.message : "保存渠道核心档案失败。";
  } finally {
    保存中.value = false;
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
        <h1>{{ 模块标题 }}</h1>
        <p>集中维护工商主体、经营地址、联系人、合作信息、产品能力和授权提醒。</p>
      </div>
      <div class="档案页动作">
        <span class="完整度">档案完整度 {{ 完整度 }}%</span>
        <RouterLink
          class="档案按钮"
          :to="`/admin/partners/${encodeURIComponent(String(路由.params.id || ''))}/members`"
        >
          成员维护
        </RouterLink>
        <button class="档案按钮 主按钮" type="button" :disabled="保存中 || !可编辑" @click="保存">
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
            <dd>{{ 档案?.status === "active" ? "合作中" : "待审批" }}</dd>
          </div>
          <div>
            <dt>所属层级</dt>
            <dd>{{ 档案?.level || "未设置" }}</dd>
          </div>
        </dl>
      </aside>

      <main class="档案主体">
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
              ><span>成立日期</span
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
                <option value="none">未设置</option>
                <option value="full">全能力技术服务商</option>
                <option value="delivery">交付服务商</option>
                <option value="integration">集成服务商</option>
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

        <section v-else class="档案分组">
          <header>
            <div>
              <h2>产品能力与提醒</h2>
              <p>维护授权产品、资质认证和授权到期提醒。</p>
            </div>
          </header>
          <div class="表单网格">
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
  min-width: 1100px;
  gap: 18px;
  color: #172b4d;
}
.档案页头 {
  display: flex;
  align-items: flex-end;
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
</style>
