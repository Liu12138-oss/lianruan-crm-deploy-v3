<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, onMounted, ref } from "vue";

import {
  创建证书模板,
  延期证书,
  颁发证书,
  撤销证书,
  查询成员证书,
  查询证书模板,
  type 成员证书,
  type 证书模板,
} from "../../api/organization-client.js";
import WarKpis from "../../components/war/WarKpis.vue";
import WarLayout from "../../components/war/WarLayout.vue";
import WarRecordCard from "../../components/war/WarRecordCard.vue";
import type { 指标项 } from "../../components/war/types.js";
import { 日期文本, 文本 } from "../../shared/format/business-format.js";

const 加载中 = ref(false);
const 提交中 = ref(false);
const 错误 = ref("");
const 模板列表 = ref<证书模板[]>([]);
const 证书列表 = ref<成员证书[]>([]);
const 当前标签 = ref("模板");
const 选中编号 = ref("");
const 搜索词 = ref("");
const 弹窗 = ref<"" | "模板" | "颁发">("");
const 表单 = ref({ templateCode: "", templateName: "", category: "技术类", userId: "", expiresOn: "" });

const 标签列表 = ["模板", "持证记录", "到期风险"];

function 风险文本(证书: 成员证书): string {
  if (证书.statusCode === "revoked") return "已撤销";
  if (!证书.expiresOn) return "无到期日";
  const 到期 = new Date(证书.expiresOn).getTime();
  if (Number.isNaN(到期)) return "日期异常";
  const 剩余 = Math.ceil((到期 - Date.now()) / 86400000);
  if (剩余 < 0) return "已过期";
  if (剩余 <= 30) return `即将到期 ${剩余} 天`;
  return "有效";
}

function 风险色调(证书: 成员证书): "green" | "amber" | "red" | "gray" {
  const 文本值 = 风险文本(证书);
  if (文本值 === "已过期" || 文本值 === "已撤销") return "red";
  if (文本值.startsWith("即将到期")) return "amber";
  if (文本值 === "有效") return "green";
  return "gray";
}

const 持证视图 = computed(() => {
  const 关键词 = 搜索词.value.trim().toLowerCase();
  return 证书列表.value
    .filter((证书) => {
      if (当前标签.value === "到期风险") return 风险文本(证书) !== "有效";
      return true;
    })
    .filter((证书) =>
      关键词
        ? [证书.displayName, 证书.templateName, 风险文本(证书)].some((值) =>
            String(值 || "").toLowerCase().includes(关键词),
          )
        : true,
    );
});

const 模板视图 = computed(() => {
  const 关键词 = 搜索词.value.trim().toLowerCase();
  return 模板列表.value.filter((模板) =>
    关键词
      ? [模板.templateName, 模板.templateCode, 模板.category].some((值) =>
          String(值 || "").toLowerCase().includes(关键词),
        )
      : true,
  );
});

const 当前模板 = computed(
  () => 模板列表.value.find((模板) => 模板.id === 选中编号.value) || 模板视图.value[0] || null,
);
const 当前证书 = computed(
  () => 证书列表.value.find((证书) => 证书.id === 选中编号.value) || 持证视图.value[0] || null,
);

const 指标 = computed<指标项[]>(() => {
  const 已过期 = 证书列表.value.filter((证书) => 风险文本(证书) === "已过期").length;
  const 临近 = 证书列表.value.filter((证书) => 风险文本(证书).startsWith("即将到期")).length;
  const 已撤销 = 证书列表.value.filter((证书) => 证书.statusCode === "revoked").length;
  const 本月 = new Date();
  const 本月颁发 = 证书列表.value.filter((证书) => {
    const 时间 = new Date(证书.issuedOn);
    return (
      !Number.isNaN(时间.getTime()) &&
      时间.getFullYear() === 本月.getFullYear() &&
      时间.getMonth() === 本月.getMonth()
    );
  }).length;
  return [
    { label: "证书模板", value: String(模板列表.value.length), unit: "个", note: "可颁发的证书类型" },
    { label: "持证记录", value: String(证书列表.value.length), unit: "条", note: "成员证书总数" },
    { label: "本月颁发", value: String(本月颁发), unit: "条", note: "按颁证日期统计" },
    { label: "即将到期", value: String(临近), unit: "条", note: "30 天内到期" },
    { label: "已过期", value: String(已过期), unit: "条", note: "超过到期日" },
    { label: "已撤销", value: String(已撤销), unit: "条", note: "保留历史记录" },
  ];
});

onMounted(() => void 加载());

async function 加载() {
  加载中.value = true;
  错误.value = "";
  try {
    const [模板结果, 证书结果] = await Promise.all([查询证书模板(), 查询成员证书()]);
    模板列表.value = 模板结果.items;
    证书列表.value = 证书结果.items;
    选中编号.value =
      当前标签.value === "模板" ? 模板列表.value[0]?.id || "" : 证书列表.value[0]?.id || "";
  } catch (异常) {
    错误.value = 异常 instanceof Error ? 异常.message : "证书数据加载失败。";
  } finally {
    加载中.value = false;
  }
}

async function 保存模板() {
  if (提交中.value) return;
  提交中.value = true;
  try {
    await 创建证书模板({
      templateCode: 表单.value.templateCode,
      templateName: 表单.value.templateName,
      category: 表单.value.category,
    });
    ElMessage.success("证书模板已创建");
    弹窗.value = "";
    await 加载();
  } catch (异常) {
    ElMessage.error(异常 instanceof Error ? 异常.message : "创建模板失败。");
  } finally {
    提交中.value = false;
  }
}

async function 颁发() {
  if (提交中.value) return;
  提交中.value = true;
  try {
    await 颁发证书(表单.value.userId, {
      certificationTemplateId: 当前模板.value?.id,
      ...(表单.value.expiresOn ? { expiresOn: 表单.value.expiresOn } : {}),
    });
    ElMessage.success("证书已颁发");
    弹窗.value = "";
    await 加载();
  } catch (异常) {
    ElMessage.error(异常 instanceof Error ? 异常.message : "颁发证书失败。");
  } finally {
    提交中.value = false;
  }
}

async function 延期() {
  if (!当前证书.value) return;
  const 目标 = window.prompt("请输入新的到期日（YYYY-MM-DD）", 当前证书.value.expiresOn || "");
  if (!目标) return;
  try {
    await 延期证书(当前证书.value.id, { expiresOn: 目标 }, {});
    ElMessage.success("证书已延期");
    await 加载();
  } catch (异常) {
    ElMessage.error(异常 instanceof Error ? 异常.message : "延期失败。");
  }
}

async function 撤销() {
  if (!当前证书.value) return;
  if (!window.confirm(`确认撤销「${当前证书.value.templateName}」证书？`)) return;
  try {
    await 撤销证书(当前证书.value.id, { reason: "页面撤销" }, {});
    ElMessage.success("证书已撤销");
    await 加载();
  } catch (异常) {
    ElMessage.error(异常 instanceof Error ? 异常.message : "撤销失败。");
  }
}

async function 切换标签(标签: string) {
  当前标签.value = 标签;
  选中编号.value =
    标签 === "模板" ? 模板列表.value[0]?.id || "" : 证书列表.value[0]?.id || "";
}
</script>

<template>
  <div class="vui war-artboard 证书页">
    <WarKpis :items="指标" />

    <WarLayout
      :list-title="当前标签 === '模板' ? '证书名称' : 当前标签 === '持证记录' ? '持证记录' : '到期风险'"
      :list-count="String(当前标签 === '模板' ? 模板视图.length : 持证视图.length)"
      search-placeholder="搜索证书名称、人员或风险状态"
      :tabs="标签列表"
      :active-tab="当前标签"
      v-model="搜索词"
      @切换标签="切换标签"
    >
      <template #list>
        <div v-if="加载中" class="war-empty">正在加载证书数据…</div>
        <div v-else-if="错误" class="war-empty">{{ 错误 }}</div>

        <template v-if="当前标签 === '模板'">
          <WarRecordCard
            v-for="模板 in 模板视图"
            :key="模板.id"
            :title="模板.templateName"
            :meta="`${模板.category || '未分类'} · ${模板.templateCode}`"
            :badge="模板.statusCode === 'disabled' ? '停用' : '启用'"
            :tone="模板.statusCode === 'disabled' ? 'gray' : 'green'"
            :active="当前模板?.id === 模板.id"
            @选择="选中编号 = 模板.id"
          />
        </template>

        <template v-else>
          <WarRecordCard
            v-for="证书 in 持证视图"
            :key="证书.id"
            :title="文本(证书.displayName, '未命名成员')"
            :meta="`${证书.templateName} · 颁发 ${日期文本(证书.issuedOn)}`"
            :badge="风险文本(证书)"
            :tone="风险色调(证书)"
            :owner="`到期：${日期文本(证书.expiresOn)}`"
            :active="当前证书?.id === 证书.id"
            @选择="选中编号 = 证书.id"
          />
        </template>

        <div
          v-if="!加载中 && !错误 && !(当前标签 === '模板' ? 模板视图.length : 持证视图.length)"
          class="war-empty"
        >
          当前条件下没有记录。
        </div>
      </template>

      <template #center>
        <template v-if="当前标签 === '模板' && 当前模板">
          <div class="war-center-head">
            <div class="deal-title">
              <strong>{{ 当前模板.templateName }}</strong>
              <span>{{ 当前模板.category || "未分类" }} · {{ 当前模板.templateCode }}</span>
            </div>
            <div class="center-actions">
              <button type="button" class="button" @click="弹窗 = '模板'">新建模板</button>
              <button type="button" class="button primary" @click="弹窗 = '颁发'">
                颁发证书
              </button>
            </div>
          </div>
          <div class="extended-center-grid">
            <section class="panel">
              <header class="panel-head">
                <div><h2>模板信息</h2><p>证书模板与状态</p></div>
              </header>
              <div class="panel-body">
                <div class="info-grid">
                  <div class="info-item"><span>模板名称</span><strong>{{ 当前模板.templateName }}</strong></div>
                  <div class="info-item"><span>模板编号</span><strong>{{ 当前模板.templateCode }}</strong></div>
                  <div class="info-item"><span>类别</span><strong>{{ 当前模板.category || "未分类" }}</strong></div>
                  <div class="info-item">
                    <span>状态</span>
                    <strong>{{ 当前模板.statusCode === "disabled" ? "停用" : "启用" }}</strong>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </template>

        <template v-else-if="当前证书">
          <div class="war-center-head">
            <div class="deal-title">
              <strong>{{ 文本(当前证书.displayName, "未命名成员") }}</strong>
              <span>
                {{ 当前证书.templateName }} · 颁发 {{ 日期文本(当前证书.issuedOn) }} ·
                到期 {{ 日期文本(当前证书.expiresOn) }}
              </span>
            </div>
            <div class="center-actions">
              <button type="button" class="button" @click="延期">延期</button>
              <button type="button" class="button" @click="撤销">撤销</button>
            </div>
          </div>
          <div class="extended-center-grid">
            <section class="panel">
              <header class="panel-head">
                <div><h2>持证信息</h2><p>成员证书与风险状态</p></div>
              </header>
              <div class="panel-body">
                <div class="info-grid">
                  <div class="info-item"><span>持证人</span><strong>{{ 文本(当前证书.displayName, "—") }}</strong></div>
                  <div class="info-item"><span>证书名称</span><strong>{{ 当前证书.templateName }}</strong></div>
                  <div class="info-item"><span>颁发日期</span><strong>{{ 日期文本(当前证书.issuedOn) }}</strong></div>
                  <div class="info-item"><span>到期日期</span><strong>{{ 日期文本(当前证书.expiresOn) }}</strong></div>
                  <div class="info-item"><span>风险状态</span><strong>{{ 风险文本(当前证书) }}</strong></div>
                  <div class="info-item">
                    <span>证书状态</span>
                    <strong>{{ 当前证书.statusCode === "revoked" ? "已撤销" : "有效" }}</strong>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </template>
        <div v-else class="war-empty">请选择左侧记录查看详情。</div>
      </template>

      <template #right>
        <article class="right-card highlight">
          <div class="right-card-title"><strong>实时快照</strong><span>证书与风险</span></div>
          <div class="info-grid">
            <div class="info-item"><span>证书模板</span><strong>{{ 模板列表.length }} 个</strong></div>
            <div class="info-item"><span>持证记录</span><strong>{{ 证书列表.length }} 条</strong></div>
            <div class="info-item">
              <span>即将到期</span>
              <strong>{{ 证书列表.filter((证书) => 风险文本(证书).startsWith("即将到期")).length }} 条</strong>
            </div>
            <div class="info-item">
              <span>已过期</span>
              <strong>{{ 证书列表.filter((证书) => 风险文本(证书) === "已过期").length }} 条</strong>
            </div>
          </div>
        </article>
        <article class="right-card">
          <div class="right-card-title"><strong>风险口径</strong><span>说明</span></div>
          <p class="war-note">
            30 天内到期标记为「即将到期」并进入到期风险列表；过期与撤销记录保留历史，不会删除。
          </p>
        </article>
      </template>
    </WarLayout>

    <div v-if="弹窗" class="证书弹窗">
      <header>
        <h2>{{ 弹窗 === "模板" ? "新建证书模板" : "颁发证书" }}</h2>
        <button type="button" @click="弹窗 = ''">关闭</button>
      </header>
      <div class="弹窗内容">
        <template v-if="弹窗 === '模板'">
          <label>模板编号<input v-model="表单.templateCode" placeholder="如 CERT-TECH-01" /></label>
          <label>模板名称<input v-model="表单.templateName" placeholder="如 终端安全产品认证" /></label>
          <label>类别<input v-model="表单.category" placeholder="技术类 / 销售类" /></label>
        </template>
        <template v-else>
          <label>成员标识<input v-model="表单.userId" placeholder="成员 UUID" /></label>
          <label>到期日期<input v-model="表单.expiresOn" placeholder="YYYY-MM-DD" /></label>
        </template>
      </div>
      <footer>
        <button type="button" class="button" @click="弹窗 = ''">取消</button>
        <button
          type="button"
          class="button primary"
          :disabled="提交中"
          @click="弹窗 === '模板' ? 保存模板() : 颁发()"
        >
          提交
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.证书页 {
  position: relative;
}

.证书弹窗 {
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: 30;
  width: 420px;
  transform: translate(-50%, -50%);
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 24px 60px rgba(23, 52, 94, 0.18);
}

.证书弹窗 header,
.证书弹窗 footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--line-soft);
}

.证书弹窗 footer {
  border-top: 1px solid var(--line-soft);
  border-bottom: 0;
  justify-content: flex-end;
}

.证书弹窗 h2 {
  margin: 0;
  font-size: 16px;
}

.弹窗内容 {
  display: grid;
  gap: 10px;
  padding: 16px;
}

.弹窗内容 label {
  display: grid;
  gap: 4px;
  color: var(--text-3);
  font-size: 11px;
}

.弹窗内容 input {
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  font-size: 11px;
}

.war-empty {
  display: grid;
  place-items: center;
  min-height: 100px;
  padding: 18px;
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
