<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";

import {
  上传报备附件,
  创建报备,
  type 报备附件,
  查询阶段9全部,
  type 阶段9记录,
} from "../../api/business-client.js";
import { 文本 } from "../../shared/format/business-format.js";
import { use外壳前缀 } from "../../shared/navigation/shell-prefix.js";

const 路由器 = useRouter();
const 外壳前缀 = use外壳前缀();
const 提交中 = ref(false);
const 已存在客户 = ref<阶段9记录[]>([]);
const 步骤索引 = ref(0);
const 附件列表 = ref<报备附件[]>([]);
const 附件上传中 = ref(false);
const 附件大小上限 = 10 * 1024 * 1024;

const 行业选项 = [
  "金融",
  "制造",
  "政府/央企",
  "医疗",
  "教育",
  "互联网",
  "零售",
  "能源",
  "交通",
  "其他",
];
const 企业规模选项 = [
  "0-100人",
  "100-300人",
  "300-500人",
  "500-1000人",
  "1000-2000人",
  "2000-5000人",
  "5000人以上",
];
const 客户来源选项 = [
  "渠道推荐",
  "市场活动",
  "老客户续约",
  "展会获客",
  "政府关系",
  "网络询盘",
  "其他",
];
const 端点范围选项 = ["10~19", "20~49", "50~99", "100~199", "200~500", "500以上"];
const 保护期选项 = [
  { 标签: "90天", 值: 90 },
  { 标签: "180天", 值: 180 },
  { 标签: "365天", 值: 365 },
];

const 表单 = reactive({
  客户名称: "",
  统一社会信用代码: "",
  所属行业: "",
  企业规模: "",
  客户来源: "",
  注册地址: "",
  联系人: "",
  联系人职务: "",
  联系电话: "",
  联系邮箱: "",
  项目需求: "",
  同时报备商机: false,
  项目名称: "",
  预计端点范围: "",
  保护期天数: 180,
  项目备注: "",
});

const 步骤 = [
  { 标题: "客户主体信息", 说明: "企业名称、信用代码和工商信息" },
  { 标题: "联系人与需求", 说明: "联系人、预算与项目背景" },
  { 标题: "归属与保护", 说明: "区域、渠道和跟进人员" },
  { 标题: "资料附件", 说明: "营业执照和项目材料" },
  { 标题: "确认提交", 说明: "查重与提交校验" },
];

const 查重结果 = computed(() => {
  const 名称 = 归一化客户名称(表单.客户名称);
  const 信用代码 = 归一化信用代码(表单.统一社会信用代码);
  if (!名称 && !信用代码) return [];
  return 已存在客户.value.filter((客户) => {
    const 客户名称 = 归一化客户名称(文本(客户.客户名称, 客户.标题));
    const 代码 = 归一化信用代码(文本(客户.原始数据?.creditCode));
    return (Boolean(名称) && 客户名称 === 名称) || (Boolean(信用代码) && 代码 === 信用代码);
  });
});

function 归一化客户名称(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "");
}

function 归一化信用代码(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

const 统一社会信用代码校验通过 = computed(() =>
  /^[0-9A-Z]{18}$/.test(归一化信用代码(表单.统一社会信用代码)),
);
const 联系电话校验通过 = computed(() =>
  /^(?:1\d{10}|0\d{2,3}-?\d{7,8}(?:-\d{1,6})?)$/.test(表单.联系电话.trim()),
);
const 联系邮箱校验通过 = computed(() => {
  const 邮箱 = 表单.联系邮箱.trim();
  return !邮箱 || (邮箱.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(邮箱));
});

/** 文本字段统一校验：长度、控制字符和标签符号；备注类允许多行但不允许 HTML 标签。 */
function 包含控制字符(值: string, 允许多行 = false): boolean {
  for (const 字符 of 值) {
    const 码点 = 字符.codePointAt(0) ?? 0;
    if (码点 === 0x7f) return true;
    if (码点 < 0x20 && (!允许多行 || ![0x09, 0x0a, 0x0d].includes(码点))) return true;
  }
  return false;
}

function 文本字段错误(字段名: string, 值: string, 最大长度: number, 允许多行 = false): string {
  const 文本值 = 值.trim();
  if (!文本值) return "";
  if (文本值.length > 最大长度) return `${字段名}不能超过 ${最大长度} 个字符。`;
  if (包含控制字符(文本值, 允许多行)) return `${字段名}包含不允许的控制字符。`;
  if (允许多行 ? /<[A-Za-z/!][^>]*>/.test(文本值) : /[<>]/.test(文本值)) {
    return `${字段名}不能包含 HTML 标签或尖括号。`;
  }
  return "";
}

const 字段校验错误 = computed(() => {
  const 错误列表 = [
    !统一社会信用代码校验通过.value ? "统一社会信用代码应为 18 位数字或大写字母。" : "",
    !联系电话校验通过.value ? "联系电话格式不正确，请填写 11 位手机号或带区号的固定电话。" : "",
    !联系邮箱校验通过.value ? "联系邮箱格式不正确。" : "",
    文本字段错误("联系人", 表单.联系人, 50),
    文本字段错误("联系人职务", 表单.联系人职务, 80),
    文本字段错误("注册地址", 表单.注册地址, 300),
    文本字段错误("项目需求说明", 表单.项目需求, 2000, true),
    文本字段错误("项目名称", 表单.项目名称, 120),
    文本字段错误("项目备注", 表单.项目备注, 2000, true),
  ];
  return 错误列表.find(Boolean) || "";
});

const 校验项 = computed(() => [
  { 标签: "客户名称", 通过: 客户名称校验通过.value },
  { 标签: "统一社会信用代码", 通过: 统一社会信用代码校验通过.value },
  { 标签: "联系人", 通过: Boolean(表单.联系人.trim()) },
  { 标签: "联系电话", 通过: 联系电话校验通过.value },
  { 标签: "联系邮箱", 通过: 联系邮箱校验通过.value },
  { 标签: "字段格式", 通过: !字段校验错误.value },
  { 标签: "所属行业", 通过: Boolean(表单.所属行业.trim()) },
  { 标签: "企业规模", 通过: Boolean(表单.企业规模.trim()) },
  { 标签: "客户来源", 通过: Boolean(表单.客户来源.trim()) },
  {
    标签: "项目信息",
    通过: !表单.同时报备商机 || Boolean(表单.项目名称.trim() && 表单.预计端点范围.trim()),
  },
  { 标签: "查重通过", 通过: 查重结果.value.length === 0 },
]);

const 通过数量 = computed(() => 校验项.value.filter((项) => 项.通过).length);

/** 与后端同一口径校验客户名称，避免用户填写到提交后才看到错误。 */
const 客户名称校验通过 = computed(() => {
  const 名称 = 表单.客户名称.trim();
  return (
    Boolean(名称) &&
    名称.length <= 120 &&
    !包含控制字符(名称) &&
    !/[@#$%^+=|<>{}~`\\/￥＠＃％＾＋＝｜＜＞｛｝～]/.test(名称)
  );
});

const 客户名称提示 = computed(() => {
  const 名称 = 表单.客户名称.trim();
  if (!名称) return "提交后系统会自动查重，存在相似客户会提示。";
  if (名称.length > 120) return "客户名称不能超过 120 个字符。";
  if (包含控制字符(名称)) return "客户名称包含不允许的控制字符。";
  if (/[@#$%^+=|<>{}~`\\/￥＠＃％＾＋＝｜＜＞｛｝～]/.test(名称)) {
    return "客户名称不能包含 @、#、￥、%、/ 等特殊字符。";
  }
  return "提交后系统会自动查重，存在相似客户会提示。";
});

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
  if (!客户名称校验通过.value) {
    ElMessage.warning(客户名称提示.value);
    return;
  }
  if (字段校验错误.value) {
    ElMessage.warning(字段校验错误.value);
    return;
  }
  if (通过数量.value < 校验项.value.length) {
    ElMessage.warning("请先补全必填项并通过查重校验");
    return;
  }
  提交中.value = true;
  try {
    await 创建报备({
      customer: 表单.客户名称.trim(),
      creditCode: 归一化信用代码(表单.统一社会信用代码),
      contact: 表单.联系人.trim(),
      position: 表单.联系人职务.trim(),
      phone: 表单.联系电话.trim(),
      email: 表单.联系邮箱.trim(),
      industry: 表单.所属行业.trim(),
      enterpriseScale: 表单.企业规模.trim(),
      source: 表单.客户来源.trim(),
      hasOpportunity: 表单.同时报备商机,
      ...(表单.同时报备商机
        ? {
            projectName: 表单.项目名称.trim(),
            endpointRange: 表单.预计端点范围.trim(),
            protectDays: 表单.保护期天数,
            projectNotes: 表单.项目备注.trim(),
          }
        : {}),
      ...(附件列表.value.length ? { attachments: 附件列表.value } : {}),
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

async function 选择附件(事件: Event) {
  const 输入 = 事件.target as HTMLInputElement;
  const 文件列表 = Array.from(输入.files || []);
  输入.value = "";
  if (!文件列表.length) return;
  const 超限文件 = 文件列表.find((文件) => 文件.size > 附件大小上限);
  if (超限文件) {
    ElMessage.error(`附件「${超限文件.name}」超过 10MB，请压缩或拆分后再上传。`);
    return;
  }
  if (附件列表.value.length + 文件列表.length > 5) {
    ElMessage.warning("最多上传 5 个资料附件。");
    return;
  }
  附件上传中.value = true;
  try {
    for (const 文件 of 文件列表) {
      附件列表.value.push(await 上传报备附件(文件));
    }
    ElMessage.success(`已上传 ${文件列表.length} 个资料附件。`);
  } catch (错误) {
    ElMessage.error(错误 instanceof Error ? 错误.message : "附件上传失败，请稍后重试。");
  } finally {
    附件上传中.value = false;
  }
}

function 移除附件(编号: string) {
  if (附件上传中.value) return;
  附件列表.value = 附件列表.value.filter((附件) => 附件.id !== 编号);
}
</script>

<template>
  <div class="vui war-artboard-plain 新建客户页">
    <header class="war-form-head">
      <div>
        <button class="返回按钮" type="button" @click="路由器.push(`${外壳前缀}/registration`)">
          ← 返回客户列表
        </button>
        <h1>新建客户与报备</h1>
        <p>工商查询、客户档案、报备保护、联系人与归属一次完成。</p>
      </div>
      <div class="button-row">
        <button type="button" class="button primary" :disabled="提交中" @click="提交">
          提交审核
        </button>
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
              <div>
                <strong>{{ 项.标题 }}</strong
                ><span>{{ 项.说明 }}</span>
              </div>
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
                  <input
                    v-model="表单.客户名称"
                    class="form-control"
                    placeholder="请输入工商全称"
                    :aria-invalid="!客户名称校验通过"
                  />
                  <div
                    class="helper"
                    :class="{ 'helper-error': !客户名称校验通过 && 表单.客户名称 }"
                  >
                    {{ 客户名称提示 }}
                  </div>
                </div>
                <div class="form-field">
                  <label class="form-label required">统一社会信用代码</label>
                  <input
                    v-model="表单.统一社会信用代码"
                    class="form-control"
                    placeholder="18 位信用代码"
                  />
                </div>
                <div class="form-field">
                  <label class="form-label required">所属行业</label>
                  <select v-model="表单.所属行业" class="form-control">
                    <option value="" disabled>请选择所属行业</option>
                    <option v-for="行业 in 行业选项" :key="行业" :value="行业">{{ 行业 }}</option>
                  </select>
                </div>
                <div class="form-field">
                  <label class="form-label required">企业规模</label>
                  <select v-model="表单.企业规模" class="form-control">
                    <option value="" disabled>请选择企业规模</option>
                    <option v-for="规模 in 企业规模选项" :key="规模" :value="规模">
                      {{ 规模 }}
                    </option>
                  </select>
                </div>
                <div class="form-field">
                  <label class="form-label required">客户来源</label>
                  <select v-model="表单.客户来源" class="form-control">
                    <option value="" disabled>请选择客户来源</option>
                    <option v-for="来源 in 客户来源选项" :key="来源" :value="来源">
                      {{ 来源 }}
                    </option>
                  </select>
                </div>
                <div class="form-field full">
                  <label class="form-label">注册地址</label>
                  <input v-model="表单.注册地址" class="form-control" placeholder="工商注册地址" />
                </div>
              </div>
            </div>
          </section>

          <section class="section">
            <div class="section-head">
              <strong>联系人与项目需求</strong><span>用于运营审核和后续跟进</span>
            </div>
            <div class="section-body">
              <div class="form-grid">
                <div class="form-field">
                  <label class="form-label required">主要联系人</label>
                  <input v-model="表单.联系人" class="form-control" placeholder="联系人姓名" />
                </div>
                <div class="form-field">
                  <label class="form-label">联系人职务</label>
                  <input
                    v-model="表单.联系人职务"
                    class="form-control"
                    placeholder="如 信息中心负责人"
                  />
                </div>
                <div class="form-field">
                  <label class="form-label required">联系电话</label>
                  <input v-model="表单.联系电话" class="form-control" placeholder="11 位手机号" />
                </div>
                <div class="form-field">
                  <label class="form-label">联系邮箱</label>
                  <input
                    v-model="表单.联系邮箱"
                    class="form-control"
                    type="email"
                    autocomplete="email"
                    placeholder="选填"
                  />
                </div>
                <div class="form-field full">
                  <label class="form-label">项目需求说明</label>
                  <textarea
                    v-model="表单.项目需求"
                    class="form-control"
                    rows="3"
                    placeholder="项目背景、范围与关键需求"
                  ></textarea>
                </div>
              </div>
            </div>
          </section>

          <section class="section">
            <div class="section-head">
              <strong>同时报备商机</strong><span>选填，审核通过后自动生成关联商机</span>
            </div>
            <div class="section-body">
              <label class="同时商机开关">
                <input v-model="表单.同时报备商机" type="checkbox" />
                <span>
                  <strong>提交客户时一并报备商机</strong>
                  <small>仅填写客户资料时不会自动创建商机。</small>
                </span>
              </label>
              <div v-if="表单.同时报备商机" class="form-grid 商机补充区">
                <div class="form-field full">
                  <label class="form-label required">项目名称</label>
                  <input
                    v-model="表单.项目名称"
                    class="form-control"
                    placeholder="如：终端安全改造项目"
                  />
                </div>
                <div class="form-field">
                  <label class="form-label required">预计端点范围</label>
                  <select v-model="表单.预计端点范围" class="form-control">
                    <option value="" disabled>请选择端点范围</option>
                    <option v-for="范围 in 端点范围选项" :key="范围" :value="范围">
                      {{ 范围 }}
                    </option>
                  </select>
                </div>
                <div class="form-field">
                  <label class="form-label">申请保护期</label>
                  <select v-model="表单.保护期天数" class="form-control">
                    <option v-for="选项 in 保护期选项" :key="选项.值" :value="选项.值">
                      {{ 选项.标签 }}
                    </option>
                  </select>
                </div>
                <div class="form-field full">
                  <label class="form-label">项目备注</label>
                  <textarea
                    v-model="表单.项目备注"
                    class="form-control"
                    rows="3"
                    placeholder="项目背景、预算、时间计划或关键风险"
                  ></textarea>
                </div>
              </div>
            </div>
          </section>

          <section class="section">
            <div class="section-head">
              <strong>资料附件</strong><span>选填，单个文件不超过 10MB，最多 5 个</span>
            </div>
            <div class="section-body">
              <div class="附件上传区">
                <label
                  class="附件选择按钮"
                  :class="{ disabled: 附件上传中 || 附件列表.length >= 5 }"
                >
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip"
                    :disabled="附件上传中 || 附件列表.length >= 5"
                    @change="选择附件"
                  />
                  {{ 附件上传中 ? "上传中…" : "选择资料附件" }}
                </label>
                <span class="war-note">可上传营业执照、项目材料等，单个文件上限 10MB。</span>
              </div>
              <ul v-if="附件列表.length" class="附件清单">
                <li v-for="附件 in 附件列表" :key="附件.id">
                  <span>{{ 附件.文件名 }}</span>
                  <small>{{ (附件.大小 / 1024 / 1024).toFixed(2) }} MB</small>
                  <button type="button" :disabled="附件上传中" @click="移除附件(附件.id)">
                    移除
                  </button>
                </li>
              </ul>
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
            <div v-if="字段校验错误" class="callout warning" style="margin-top: 6px">
              {{ 字段校验错误 }}
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

.helper-error {
  color: #b42318;
}

.附件上传区 {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.附件选择按钮 {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 14px;
  border: 1px solid #b9cde6;
  border-radius: 8px;
  background: #f7fbff;
  color: #23507d;
  font-weight: 700;
  cursor: pointer;
}

.附件选择按钮.disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.附件选择按钮 input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.附件清单 {
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}

.附件清单 li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 0;
  border-top: 1px solid var(--line-soft);
}

.附件清单 li span {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.附件清单 li small {
  color: var(--text-3);
}

.附件清单 li button {
  border: 0;
  background: transparent;
  color: #b42318;
  cursor: pointer;
}

.新建客户页 :deep(textarea.form-control) {
  resize: vertical;
}

.同时商机开关 {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid #dce7f3;
  border-radius: 9px;
  background: #f8fbff;
  cursor: pointer;
}

.同时商机开关 input {
  width: 16px;
  height: 16px;
  margin: 1px 0 0;
  accent-color: var(--blue-strong);
}

.同时商机开关 span {
  display: grid;
  gap: 3px;
}

.同时商机开关 strong {
  color: var(--text-1);
}

.同时商机开关 small {
  color: var(--text-3);
  font-size: 10px;
}

.商机补充区 {
  margin-top: 12px;
}
</style>
