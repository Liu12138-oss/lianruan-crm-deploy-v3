<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";

import { 查询阶段9全部, 创建报备, type 阶段9记录 } from "../../api/business-client.js";
import { 文本 } from "../../shared/format/business-format.js";
import { use外壳前缀 } from "../../shared/navigation/shell-prefix.js";

const 路由器 = useRouter();
const 外壳前缀 = use外壳前缀();
const 提交中 = ref(false);
const 已存在客户 = ref<阶段9记录[]>([]);
const 步骤索引 = ref(0);

const 表单 = reactive({
  客户名称: "",
  统一社会信用代码: "",
  所属行业: "",
  客户等级: "",
  企业规模: "",
  注册地址: "",
  联系人: "",
  联系人职务: "",
  联系电话: "",
  联系邮箱: "",
  预计金额: "",
  预计签约时间: "",
  项目需求: "",
});

const 步骤 = [
  { 标题: "客户主体信息", 说明: "企业名称、信用代码和工商信息" },
  { 标题: "联系人与需求", 说明: "联系人、预算与项目背景" },
  { 标题: "归属与保护", 说明: "区域、渠道和跟进人员" },
  { 标题: "资料附件", 说明: "营业执照和项目材料" },
  { 标题: "确认提交", 说明: "查重与提交校验" },
];

const 查重结果 = computed(() => {
  const 名称 = 表单.客户名称.trim();
  const 信用代码 = 表单.统一社会信用代码.trim();
  if (!名称 && !信用代码) return [];
  return 已存在客户.value.filter((客户) => {
    const 客户名称 = 文本(客户.客户名称, 客户.标题);
    const 代码 = 文本(客户.原始数据?.creditCode);
    return (
      (名称 && 客户名称 && 客户名称.includes(名称)) ||
      (信用代码 && 代码 && 代码 === 信用代码)
    );
  });
});

const 校验项 = computed(() => [
  { 标签: "客户名称", 通过: Boolean(表单.客户名称.trim()) },
  { 标签: "统一社会信用代码", 通过: Boolean(表单.统一社会信用代码.trim()) },
  { 标签: "联系人", 通过: Boolean(表单.联系人.trim()) },
  { 标签: "联系电话", 通过: /^1\d{10}$/.test(表单.联系电话.trim()) },
  { 标签: "所属行业", 通过: Boolean(表单.所属行业.trim()) },
  { 标签: "查重通过", 通过: 查重结果.value.length === 0 },
]);

const 通过数量 = computed(() => 校验项.value.filter((项) => 项.通过).length);

onMounted(async () => {
  try {
    const 结果 = await 查询阶段9全部("registrations");
    已存在客户.value = 结果.数据;
  } catch {
    已存在客户.value = [];
  }
});

async function 提交() {
  if (提交中.value) return;
  if (通过数量.value < 校验项.value.length) {
    ElMessage.warning("请先补全必填项并通过查重校验");
    return;
  }
  提交中.value = true;
  try {
    await 创建报备({
      customer: 表单.客户名称,
      creditCode: 表单.统一社会信用代码,
      contact: 表单.联系人,
      phone: 表单.联系电话,
      industry: 表单.所属行业,
      ...(表单.注册地址 ? { address: 表单.注册地址 } : {}),
      ...(表单.项目需求 ? { notes: 表单.项目需求 } : {}),
    });
    ElMessage.success("客户报备已提交审核");
    路由器.push(`${外壳前缀.value}/registration`);
  } catch (异常) {
    ElMessage.error(异常 instanceof Error ? 异常.message : "提交失败。");
  } finally {
    提交中.value = false;
  }
}
</script>

<template>
  <div class="vui war-artboard-plain 新建客户页">
    <header class="war-form-head">
      <div>
        <button
          class="返回按钮"
          type="button"
          @click="路由器.push(`${外壳前缀}/registration`)"
        >
          ← 返回客户列表
        </button>
        <h1>新建客户与报备</h1>
        <p>工商查询、客户档案、报备保护、联系人与归属一次完成。</p>
      </div>
      <div class="button-row">
        <button type="button" class="button primary" :disabled="提交中" @click="提交">提交审核</button>
      </div>
    </header>

    <section class="panel">
      <div class="wizard-layout">
        <aside class="wizard-steps">
          <span class="nav-caption">填写进度</span>
          <div class="step-list">
            <div
              v-for="(项, 序号) in 步骤"
              :key="项.标题"
              class="step-item"
              :class="{ active: 步骤索引 === 序号, done: 步骤索引 > 序号 }"
              @click="步骤索引 = 序号"
            >
              <span class="step-no">{{ 步骤索引 > 序号 ? "✓" : 序号 + 1 }}</span>
              <div><strong>{{ 项.标题 }}</strong><span>{{ 项.说明 }}</span></div>
            </div>
          </div>
        </aside>

        <main class="wizard-main">
          <section class="section">
            <div class="section-head"><strong>客户主体信息</strong><span>* 为必填项</span></div>
            <div class="section-body">
              <div class="form-grid">
                <div class="form-field full">
                  <label class="form-label required">客户名称（工商全称）</label>
                  <input class="form-control" v-model="表单.客户名称" placeholder="请输入工商全称" />
                  <div class="helper">提交后系统会自动查重，存在相似客户会提示。</div>
                </div>
                <div class="form-field">
                  <label class="form-label required">统一社会信用代码</label>
                  <input class="form-control" v-model="表单.统一社会信用代码" placeholder="18 位信用代码" />
                </div>
                <div class="form-field">
                  <label class="form-label">所属行业</label>
                  <input class="form-control" v-model="表单.所属行业" placeholder="如 制造业 / 金融" />
                </div>
                <div class="form-field">
                  <label class="form-label">客户等级</label>
                  <input class="form-control" v-model="表单.客户等级" placeholder="重点客户 / 普通客户" />
                </div>
                <div class="form-field">
                  <label class="form-label">企业规模</label>
                  <input class="form-control" v-model="表单.企业规模" placeholder="如 1000-5000 人" />
                </div>
                <div class="form-field full">
                  <label class="form-label">注册地址</label>
                  <input class="form-control" v-model="表单.注册地址" placeholder="工商注册地址" />
                </div>
              </div>
            </div>
          </section>

          <section class="section">
            <div class="section-head"><strong>联系人与项目需求</strong><span>用于运营审核和后续跟进</span></div>
            <div class="section-body">
              <div class="form-grid">
                <div class="form-field">
                  <label class="form-label required">主要联系人</label>
                  <input class="form-control" v-model="表单.联系人" placeholder="联系人姓名" />
                </div>
                <div class="form-field">
                  <label class="form-label">联系人职务</label>
                  <input class="form-control" v-model="表单.联系人职务" placeholder="如 信息中心负责人" />
                </div>
                <div class="form-field">
                  <label class="form-label required">联系电话</label>
                  <input class="form-control" v-model="表单.联系电话" placeholder="11 位手机号" />
                </div>
                <div class="form-field">
                  <label class="form-label">联系邮箱</label>
                  <input class="form-control" v-model="表单.联系邮箱" placeholder="选填" />
                </div>
                <div class="form-field">
                  <label class="form-label">预计金额（万元）</label>
                  <input class="form-control" v-model="表单.预计金额" placeholder="选填" />
                </div>
                <div class="form-field">
                  <label class="form-label">预计签约时间</label>
                  <input class="form-control" v-model="表单.预计签约时间" placeholder="YYYY-MM-DD" />
                </div>
                <div class="form-field full">
                  <label class="form-label">项目需求说明</label>
                  <textarea class="form-control" rows="3" v-model="表单.项目需求" placeholder="项目背景、范围与关键需求"></textarea>
                </div>
              </div>
            </div>
          </section>
        </main>

        <aside class="wizard-aside">
          <article class="right-card highlight">
            <div class="right-card-title"><strong>查重结果</strong><span>实时</span></div>
            <span class="status" :class="查重结果.length ? 'red' : 'green'">
              {{ 查重结果.length ? `发现 ${查重结果.length} 条相似客户` : "未发现重复客户" }}
            </span>
            <div v-if="查重结果.length" class="info-grid" style="margin-top: 10px">
              <div v-for="客户 in 查重结果.slice(0, 3)" :key="客户.id" class="info-item">
                <span>{{ 文本(客户.区域, "区域未填") }}</span>
                <strong>{{ 文本(客户.客户名称, 客户.标题) }}</strong>
              </div>
            </div>
          </article>

          <article class="right-card">
            <div class="right-card-title"><strong>归属与保护</strong><span>按账号带入</span></div>
            <div class="info-grid">
              <div class="info-item"><span>归属渠道</span><strong>当前账号渠道</strong></div>
              <div class="info-item"><span>所属区域</span><strong>按账号数据范围</strong></div>
              <div class="info-item"><span>跟进人员</span><strong>当前账号</strong></div>
              <div class="info-item"><span>保护期</span><strong>审核通过后生效</strong></div>
            </div>
          </article>

          <article class="right-card">
            <div class="right-card-title">
              <strong>提交校验</strong><span>{{ 通过数量 }} / {{ 校验项.length }}</span>
            </div>
            <div
              v-for="项 in 校验项"
              :key="项.标签"
              class="callout"
              :class="项.通过 ? 'success' : 'warning'"
              style="margin-top: 6px"
            >
              {{ 项.标签 }}{{ 项.通过 ? " 已通过" : " 待补充" }}
            </div>
          </article>
        </aside>
      </div>
    </section>
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

.新建客户页 :deep(.form-control) {
  min-height: 32px;
  padding: 6px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #ffffff;
  font: inherit;
  font-size: 11px;
}

.新建客户页 :deep(textarea.form-control) {
  resize: vertical;
}
</style>
