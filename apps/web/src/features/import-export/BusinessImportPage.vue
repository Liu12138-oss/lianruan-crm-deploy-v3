<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import {
  下载导入模板,
  下载导入错误报告,
  type 业务导入类型,
  type 导入执行结果,
  type 导入预览结果,
  type 导入预览行,
  执行导入文件,
  预览导入文件,
} from "../../api/business-import-client.js";

interface 导入配置 {
  类型: 业务导入类型;
  标题: string;
  说明: string;
  返回路径: string;
  返回文案: string;
  字段: Array<{ 键: string; 名称: string }>;
}

const 路由 = useRouter();
const 当前路由 = useRoute();

const 配置表: Record<string, 导入配置> = {
  registrations: {
    类型: "registrations",
    标题: "客户报备批量导入",
    说明: "按老 UI 客户报备模板导入；先预检，再确认写入。重复客户、信用代码冲突和缺字段都会定位到具体行。",
    返回路径: "/admin/registration",
    返回文案: "返回客户管理",
    字段: [
      { 键: "customer", 名称: "客户名称" },
      { 键: "creditCode", 名称: "统一社会信用代码" },
      { 键: "industry", 名称: "行业" },
      { 键: "contact", 名称: "联系人" },
      { 键: "phone", 名称: "联系电话" },
      { 键: "assignedStaffName", 名称: "负责员工" },
      { 键: "partnerName", 名称: "所属渠道商" },
      { 键: "address", 名称: "客户地址" },
    ],
  },
  opportunities: {
    类型: "opportunities",
    标题: "商机批量导入",
    说明: "商机必须关联已通过报备的客户；预检会校验客户、渠道、负责人和金额，错误行不会写入。",
    返回路径: "/admin/opportunity",
    返回文案: "返回商机管理",
    字段: [
      { 键: "name", 名称: "商机名称" },
      { 键: "customer", 名称: "客户名称" },
      { 键: "amount", 名称: "商机金额" },
      { 键: "expectedClose", 名称: "预计签约日期" },
      { 键: "stage", 名称: "商机阶段" },
      { 键: "assignedStaffName", 名称: "负责员工" },
      { 键: "partnerName", 名称: "所属渠道商" },
      { 键: "remark", 名称: "备注" },
    ],
  },
  partners: {
    类型: "partners",
    标题: "渠道商批量导入",
    说明: "渠道商主档、区域、联系人和经营简介可一次导入；同名渠道和错误区域会在预检阶段提示。",
    返回路径: "/admin/partners",
    返回文案: "返回渠道管理",
    字段: [
      { 键: "name", 名称: "渠道商名称" },
      { 键: "level", 名称: "合作级别" },
      { 键: "region", 名称: "所在区域" },
      { 键: "city", 名称: "所在城市" },
      { 键: "contact", 名称: "联系人" },
      { 键: "phone", 名称: "联系电话" },
      { 键: "email", 名称: "邮箱" },
      { 键: "techServiceType", 名称: "技术服务商类型" },
    ],
  },
  staff: {
    类型: "staff",
    标题: "员工账号批量导入",
    说明: "员工必须归属已有渠道商；登录账号、手机号重复或渠道商不存在都会拒绝并标注行号。",
    返回路径: "/admin/account-manage",
    返回文案: "返回账号管理",
    字段: [
      { 键: "username", 名称: "登录账号" },
      { 键: "name", 名称: "员工姓名" },
      { 键: "partnerName", 名称: "所属渠道商" },
      { 键: "phone", 名称: "手机号" },
      { 键: "email", 名称: "邮箱" },
      { 键: "status", 名称: "状态" },
    ],
  },
};

const 配置 = computed<导入配置>(() => {
  const 类型 = String(当前路由.meta.导入类型 || 当前路由.params.type || "registrations");
  return 配置表[类型] || 配置表.registrations!;
});
const 文件 = ref<File | null>(null);
const 预检结果 = ref<导入预览结果 | null>(null);
const 执行结果 = ref<导入执行结果 | null>(null);
const 预检中 = ref(false);
const 导入中 = ref(false);
const 模板下载中 = ref(false);
const 错误 = ref("");
const 文件名 = ref("");

const 错误行数 = computed(() => 预检结果.value?.errorCount || 0);
const 合法行数 = computed(() => 预检结果.value?.validCount || 0);
const 结果摘要 = computed(() => {
  const 结果 = 执行结果.value;
  if (!结果) return "";
  return `新增 ${结果.success} 条，更新 ${结果.updated} 条，失败 ${结果.failed} 条。`;
});

function 选择文件(event: Event) {
  const input = event.target as HTMLInputElement;
  const 选中 = input.files?.[0] || null;
  文件.value = 选中;
  文件名.value = 选中?.name || "";
  预检结果.value = null;
  执行结果.value = null;
  错误.value = "";
}

async function 下载模板() {
  if (模板下载中.value) return;
  模板下载中.value = true;
  try {
    const 结果 = await 下载导入模板(配置.value.类型);
    保存文件(结果.内容, 结果.文件名);
    ElMessage.success("导入模板已下载。");
  } catch (异常) {
    ElMessage.error(异常 instanceof Error ? 异常.message : "模板下载失败。");
  } finally {
    模板下载中.value = false;
  }
}

async function 预检() {
  if (!文件.value || 预检中.value) {
    if (!文件.value) ElMessage.warning("请先选择要导入的 Excel 或 CSV 文件。");
    return;
  }
  预检中.value = true;
  错误.value = "";
  执行结果.value = null;
  try {
    const 结果 = await 预览导入文件(配置.value.类型, 文件.value);
    预检结果.value = 结果;
    if (!结果.totalCount) {
      ElMessage.warning("文件中没有可识别的数据行。");
    } else if (结果.errorCount) {
      ElMessage.warning(`预检完成：${结果.validCount} 行可导入，${结果.errorCount} 行需要修正。`);
    } else {
      ElMessage.success(`预检通过：共 ${结果.validCount} 行，可以确认导入。`);
    }
  } catch (异常) {
    错误.value = 异常 instanceof Error ? 异常.message : "导入预检失败。";
    ElMessage.error(错误.value);
  } finally {
    预检中.value = false;
  }
}

async function 确认导入() {
  if (!文件.value || !预检结果.value || 导入中.value) return;
  if (预检结果.value.validCount <= 0) {
    ElMessage.warning("当前文件没有通过预检的数据行，请修正后重新上传。");
    return;
  }
  if (
    !window.confirm(
      `确认导入 ${预检结果.value.validCount} 行合法数据？未通过预检的 ${预检结果.value.errorCount} 行不会写入。`,
    )
  ) {
    return;
  }
  导入中.value = true;
  错误.value = "";
  try {
    const 结果 = await 执行导入文件(配置.value.类型, 文件.value);
    执行结果.value = 结果.结果 || null;
    if (结果.结果) {
      ElMessage[结果.成功 ? "success" : "error"](
        `${结果.消息}${结果.结果.failed ? " 可下载错误报告。" : ""}`,
      );
    } else {
      ElMessage[结果.成功 ? "success" : "error"](结果.消息);
    }
  } catch (异常) {
    错误.value = 异常 instanceof Error ? 异常.message : "导入执行失败。";
    ElMessage.error(错误.value);
  } finally {
    导入中.value = false;
  }
}

async function 下载错误报告() {
  const 地址 = 执行结果.value?.errorReportUrl;
  if (!地址) return;
  try {
    const 结果 = await 下载导入错误报告(地址);
    保存文件(结果.内容, 结果.文件名);
  } catch (异常) {
    ElMessage.error(异常 instanceof Error ? 异常.message : "错误报告下载失败。");
  }
}

function 保存文件(内容: Blob, 名称: string) {
  const 地址 = URL.createObjectURL(内容);
  const 链接 = document.createElement("a");
  链接.href = 地址;
  链接.download = 名称;
  document.body.appendChild(链接);
  链接.click();
  document.body.removeChild(链接);
  URL.revokeObjectURL(地址);
}

function 行状态(行: 导入预览行): "合法" | "错误" {
  return 行.errors.length ? "错误" : "合法";
}

function 字段文本(行: 导入预览行, 键: string): string {
  const 值 = 行.data[键];
  if (键 === "password") return 值 ? "已填写" : "—";
  if (值 === null || 值 === undefined || 值 === "") return "—";
  return String(值);
}

function 行错误(行: 导入预览行): string {
  return 行.errors.join("；") || "—";
}
</script>

<template>
  <div class="vui 导入页面">
    <header class="导入页头">
      <button type="button" class="返回按钮" @click="路由.push(配置.返回路径)">
        ← {{ 配置.返回文案 }}
      </button>
      <div>
        <h1>{{ 配置.标题 }}</h1>
        <p>{{ 配置.说明 }}</p>
      </div>
      <button type="button" class="次要按钮" :disabled="模板下载中" @click="下载模板">
        {{ 模板下载中 ? "下载中…" : "下载导入模板" }}
      </button>
    </header>

    <section class="步骤条" aria-label="导入步骤">
      <div class="步骤" :class="{ 当前: !预检结果 }">
        <span>1</span>
        <div><strong>选择文件</strong><small>下载模板后填写</small></div>
      </div>
      <div class="步骤" :class="{ 当前: 预检结果 && !执行结果 }">
        <span>2</span>
        <div><strong>预检确认</strong><small>逐行查看结果</small></div>
      </div>
      <div class="步骤" :class="{ 当前: 执行结果 }">
        <span>3</span>
        <div><strong>完成导入</strong><small>下载错误报告</small></div>
      </div>
    </section>

    <section class="面板">
      <header class="面板头">
        <div>
          <h2>上传数据文件</h2>
          <p>支持 .xlsx、.xls 和 UTF-8 CSV；GBK 文件会被明确拒绝并提示另存为 UTF-8。</p>
        </div>
        <span class="文件提示">{{ 文件名 || "尚未选择文件" }}</span>
      </header>
      <div class="上传区">
        <label class="文件选择">
          <input
            type="file"
            accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            @change="选择文件"
          />
          <span class="文件图标">⇧</span>
          <span>
            <strong>{{ 文件 ? 文件.name : "点击选择导入文件" }}</strong>
            <small>{{
              文件 ? `${Math.ceil(文件.size / 1024)} KB` : "选择后先预检，不会立即写入数据库"
            }}</small>
          </span>
        </label>
        <button type="button" class="主按钮" :disabled="!文件 || 预检中" @click="预检">
          {{ 预检中 ? "预检中…" : "开始预检" }}
        </button>
      </div>
      <p v-if="错误" class="错误提示">{{ 错误 }}</p>
    </section>

    <section v-if="预检结果" class="面板">
      <header class="面板头">
        <div>
          <h2>预检结果</h2>
          <p>共识别 {{ 预检结果.totalCount }} 行，仅展示前 {{ 预检结果.previewCount }} 行。</p>
        </div>
        <div class="预检统计">
          <span class="合法">合法 {{ 合法行数 }} 行</span>
          <span class="错误">错误 {{ 错误行数 }} 行</span>
        </div>
      </header>
      <div class="表格滚动">
        <table class="导入表格">
          <thead>
            <tr>
              <th>行号</th>
              <th>状态</th>
              <th v-for="字段 in 配置.字段" :key="字段.键">{{ 字段.名称 }}</th>
              <th>错误原因</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="行 in 预检结果.preview"
              :key="行.rowIndex"
              :class="{ 错误行: 行.errors.length }"
            >
              <td>{{ 行.rowIndex }}</td>
              <td>
                <span class="行状态" :class="行状态(行)">{{ 行状态(行) }}</span>
              </td>
              <td v-for="字段 in 配置.字段" :key="字段.键" :title="字段文本(行, 字段.键)">
                {{ 字段文本(行, 字段.键) }}
              </td>
              <td class="错误原因">{{ 行错误(行) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <footer class="面板底">
        <span class="导入说明">
          预检只校验不写入；确认后合法行写入，错误行跳过。若整批都未通过，后端不会写入任何业务数据。
        </span>
        <button type="button" class="主按钮" :disabled="导入中 || 合法行数 <= 0" @click="确认导入">
          {{ 导入中 ? "导入中…" : `确认导入 ${合法行数} 行合法数据` }}
        </button>
      </footer>
    </section>

    <section v-if="执行结果" class="面板 结果面板">
      <header class="面板头">
        <div>
          <h2>{{ 执行结果.success + 执行结果.updated > 0 ? "导入完成" : "导入失败" }}</h2>
          <p>{{ 结果摘要 }}</p>
        </div>
        <button
          v-if="执行结果.failed > 0 && 执行结果.errorReportUrl"
          type="button"
          class="次要按钮"
          @click="下载错误报告"
        >
          下载错误报告
        </button>
      </header>
      <div v-if="执行结果.rows?.length" class="表格滚动">
        <table class="导入表格 结果表">
          <thead>
            <tr>
              <th>行号</th>
              <th>结果</th>
              <th>说明</th>
              <th>变更字段</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="行 in 执行结果.rows" :key="`${行.row}-${行.status}`">
              <td>{{ 行.row }}</td>
              <td>
                <span class="行状态" :class="行.status === 'failed' ? '错误' : '合法'">
                  {{ 行.status === "created" ? "新增" : 行.status === "updated" ? "更新" : "失败" }}
                </span>
              </td>
              <td>{{ 行.message }}</td>
              <td>{{ (行.changedFields || []).join("、") || "—" }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.导入页面 {
  display: grid;
  align-content: start;
  gap: 14px;
  min-height: min(760px, calc(100vh - 86px));
  padding: 4px 2px 18px;
  color: #172b4d;
}
.导入页头 {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 18px;
}
.导入页头 h1,
.面板头 h2 {
  margin: 0;
  color: #172b4d;
}
.导入页头 h1 {
  font-size: 20px;
}
.导入页头 p,
.面板头 p {
  margin: 6px 0 0;
  color: #64768a;
  font-size: 12px;
  line-height: 1.7;
}
.返回按钮,
.次要按钮,
.主按钮 {
  min-height: 34px;
  padding: 0 14px;
  border-radius: 8px;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}
.返回按钮,
.次要按钮 {
  border: 1px solid #d7e3f0;
  background: #ffffff;
  color: #31506f;
}
.主按钮 {
  border: 1px solid #2367d1;
  background: #2367d1;
  color: #ffffff;
}
.主按钮:disabled,
.次要按钮:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.步骤条 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.步骤 {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  border: 1px solid #e0e9f4;
  border-radius: 10px;
  background: #f7faff;
  color: #7a8ca0;
}
.步骤 > span {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 999px;
  background: #e8eef8;
  color: #4d6b8d;
  font-weight: 700;
}
.步骤 strong,
.步骤 small {
  display: block;
}
.步骤 strong {
  color: #2b4058;
  font-size: 12px;
}
.步骤 small {
  margin-top: 2px;
  font-size: 11px;
}
.步骤.当前 {
  border-color: #b8d1f6;
  background: #eef5ff;
}
.步骤.当前 > span {
  background: #2367d1;
  color: #ffffff;
}
.面板 {
  border: 1px solid #dce7f3;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 8px 22px rgb(31 70 120 / 5%);
  overflow: hidden;
}
.面板头 {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px;
  border-bottom: 1px solid #e7eef6;
}
.面板头 h2 {
  font-size: 16px;
}
.文件提示 {
  max-width: 300px;
  overflow: hidden;
  color: #5c7390;
  font-size: 12px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.上传区 {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px;
}
.文件选择 {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 12px;
  min-height: 74px;
  padding: 14px 16px;
  border: 1px dashed #aac4e7;
  border-radius: 10px;
  background: #f8fbff;
  cursor: pointer;
}
.文件选择 input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}
.文件图标 {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: #e5efff;
  color: #2367d1;
  font-size: 20px;
  font-weight: 700;
}
.文件选择 strong,
.文件选择 small {
  display: block;
}
.文件选择 strong {
  color: #24415f;
  font-size: 13px;
}
.文件选择 small {
  margin-top: 3px;
  color: #7790aa;
  font-size: 11px;
}
.错误提示 {
  margin: 0 18px 16px;
  padding: 10px 12px;
  border: 1px solid #f0c4c4;
  border-radius: 8px;
  background: #fff4f4;
  color: #a52a2a;
  font-size: 12px;
}
.预检统计 {
  display: flex;
  gap: 8px;
}
.预检统计 span,
.行状态 {
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}
.预检统计 .合法,
.行状态.合法 {
  background: #eaf8f2;
  color: #0b7a5d;
}
.预检统计 .错误,
.行状态.错误 {
  background: #fff0f0;
  color: #b02a2a;
}
.表格滚动 {
  max-width: 100%;
  overflow-x: auto;
}
.导入表格 {
  width: 100%;
  min-width: 920px;
  border-collapse: collapse;
  font-size: 11px;
}
.导入表格 th,
.导入表格 td {
  padding: 9px 10px;
  border-bottom: 1px solid #edf2f8;
  text-align: left;
  vertical-align: top;
}
.导入表格 th {
  position: sticky;
  top: 0;
  background: #f4f8fd;
  color: #425b75;
  white-space: nowrap;
}
.导入表格 td {
  max-width: 220px;
  overflow: hidden;
  color: #36516c;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.导入表格 .错误原因 {
  max-width: 280px;
  color: #a52a2a;
  white-space: normal;
}
.错误行 {
  background: #fffafa;
}
.面板底 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 18px;
  border-top: 1px solid #e7eef6;
  background: #fbfdff;
}
.导入说明 {
  color: #71859a;
  font-size: 11px;
  line-height: 1.6;
}
.结果面板 .面板头 {
  background: #f8fbff;
}
@media (max-width: 900px) {
  .导入页头,
  .上传区,
  .面板底 {
    grid-template-columns: 1fr;
    flex-direction: column;
    align-items: stretch;
  }
  .步骤条 {
    grid-template-columns: 1fr;
  }
}
</style>
