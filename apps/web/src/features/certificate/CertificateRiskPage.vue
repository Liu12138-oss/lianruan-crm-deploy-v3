<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";

import {
  创建证书模板,
  延期证书,
  查询成员证书,
  查询证书模板,
  撤销证书,
  颁发证书,
  type 成员证书,
  type 证书模板,
} from "../../api/organization-client.js";
import WarKpis from "../../components/war/WarKpis.vue";
import type { 指标项 } from "../../components/war/types.js";

const 路由器 = useRouter();
const 加载中 = ref(false);
const 提交中 = ref(false);
const 错误 = ref("");
const 搜索词 = ref("");
const 当前标签 = ref<"records" | "templates">("records");
const 模板列表 = ref<证书模板[]>([]);
const 证书列表 = ref<成员证书[]>([]);
const 模板弹窗 = ref(false);
const 颁发弹窗 = ref(false);
const 操作证书 = ref<成员证书 | null>(null);

const 模板表单 = reactive({
  templateCode: "",
  templateName: "",
  category: "product",
});

const 颁发表单 = reactive({
  userId: "",
  certificationTemplateId: "",
  certificateNo: "",
  expiresOn: "",
});

const 延期表单 = reactive({ expiresOn: "" });

const 过滤后证书 = computed(() => {
  const 词 = 搜索词.value.trim().toLowerCase();
  if (!词) return 证书列表.value;
  return 证书列表.value.filter((item) =>
    [item.displayName, item.templateName, item.statusCode].some((value) =>
      String(value || "")
        .toLowerCase()
        .includes(词),
    ),
  );
});
const 已过期 = computed(() => 证书列表.value.filter((item) => 证书风险(item) === "已过期").length);
const 临近到期 = computed(
  () => 证书列表.value.filter((item) => 证书风险(item) === "30 天内到期").length,
);
const 正常数量 = computed(() => 证书列表.value.filter((item) => 证书风险(item) === "有效").length);
const 已撤销 = computed(
  () => 证书列表.value.filter((item) => item.statusCode === "revoked").length,
);
const 有效总数 = computed(
  () =>
    证书列表.value.filter((item) => {
      if (item.statusCode === "revoked") return false;
      if (!item.expiresOn) return true;
      const 到期 = new Date(item.expiresOn);
      return Number.isNaN(到期.getTime()) || 到期.getTime() >= Date.now();
    }).length,
);
const 风险指标 = computed<指标项[]>(() => [
  { label: "证书模板", value: String(模板列表.value.length), unit: "个", note: "可颁发的证书类型" },
  { label: "持证记录", value: String(证书列表.value.length), unit: "条", note: "成员证书总数" },
  { label: "有效证书", value: String(有效总数.value), unit: "条", note: "未过期且未撤销（含临近到期）" },
  { label: "临近到期", value: String(临近到期.value), unit: "条", note: "30 天内到期，需要提醒" },
  { label: "已过期", value: String(已过期.value), unit: "条", note: "已超过到期日" },
  { label: "已撤销", value: String(已撤销.value), unit: "条", note: "状态为撤销，保留历史" },
]);

onMounted(() => void 加载());

async function 加载() {
  加载中.value = true;
  错误.value = "";
  try {
    const [模板, 证书] = await Promise.all([查询证书模板(), 查询成员证书()]);
    模板列表.value = 模板.items;
    证书列表.value = 证书.items;
  } catch (error) {
    错误.value = error instanceof Error ? error.message : "证书与风险数据加载失败。";
  } finally {
    加载中.value = false;
  }
}

async function 保存模板() {
  if (!模板表单.templateCode.trim() || !模板表单.templateName.trim()) {
    ElMessage.warning("模板编码和名称不能为空。");
    return;
  }
  提交中.value = true;
  try {
    await 创建证书模板({ ...模板表单 }, { 幂等键: `cert-template-${Date.now()}` });
    模板弹窗.value = false;
    ElMessage.success("证书模板已创建。");
    await 加载();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "证书模板创建失败。");
  } finally {
    提交中.value = false;
  }
}

async function 保存颁发() {
  if (!颁发表单.userId.trim() || !颁发表单.certificationTemplateId) {
    ElMessage.warning("请填写用户编号并选择证书模板。");
    return;
  }
  提交中.value = true;
  try {
    await 颁发证书(
      颁发表单.userId.trim(),
      {
        certificationTemplateId: 颁发表单.certificationTemplateId,
        certificateNo: 颁发表单.certificateNo.trim() || undefined,
        expiresOn: 颁发表单.expiresOn || undefined,
      },
      { 幂等键: `cert-issue-${Date.now()}` },
    );
    颁发弹窗.value = false;
    ElMessage.success("证书已颁发。");
    await 加载();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "证书颁发失败。");
  } finally {
    提交中.value = false;
  }
}

function 打开延期(证书: 成员证书) {
  操作证书.value = 证书;
  延期表单.expiresOn = 证书.expiresOn || "";
}

async function 提交延期() {
  if (!操作证书.value || !延期表单.expiresOn) {
    ElMessage.warning("请选择新的到期日期。");
    return;
  }
  try {
    await 延期证书(
      操作证书.value.id,
      { expiresOn: 延期表单.expiresOn, rowVersion: 操作证书.value.rowVersion },
      { rowVersion: 操作证书.value.rowVersion, 幂等键: `cert-extend-${Date.now()}` },
    );
    操作证书.value = null;
    ElMessage.success("证书已延期。");
    await 加载();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "证书延期失败。");
  }
}

async function 提交撤销(证书: 成员证书) {
  if (!window.confirm(`确认撤销“${证书.displayName}”的证书“${证书.templateName}”吗？`)) return;
  try {
    await 撤销证书(
      证书.id,
      { reason: "页面人工撤销", rowVersion: 证书.rowVersion },
      { rowVersion: 证书.rowVersion, 幂等键: `cert-revoke-${Date.now()}` },
    );
    ElMessage.success("证书已撤销。");
    await 加载();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "证书撤销失败。");
  }
}

function 证书风险(证书: 成员证书): "有效" | "30 天内到期" | "已过期" | "已撤销" {
  if (证书.statusCode === "revoked") return "已撤销";
  if (!证书.expiresOn) return "有效";
  const 到期时间 = new Date(证书.expiresOn).getTime();
  const 当前时间 = Date.now();
  if (到期时间 < 当前时间) return "已过期";
  if (到期时间 - 当前时间 <= 30 * 24 * 60 * 60 * 1000) return "30 天内到期";
  return "有效";
}

function 风险类(风险: string): string {
  if (风险 === "有效") return "green";
  if (风险 === "30 天内到期") return "amber";
  return "red";
}

function 日期(value: string | null): string {
  if (!value) return "长期有效";
  const 时间 = new Date(value);
  return Number.isNaN(时间.getTime()) ? value : 时间.toLocaleDateString("zh-CN");
}
</script>

<template>
  <section class="vui war-artboard-plain 证书风险页">
    <WarKpis :items="风险指标" />
    <header class="证书页头">
      <div>
        <button class="返回按钮" type="button" @click="路由器.push('/admin/organization')">
          ← 返回管理配置
        </button>
        <span class="页面标签">平台治理</span>
        <h1>证书与风险</h1>
        <p>集中查看证书模板、持证记录、到期风险和撤销状态。</p>
      </div>
      <div class="页头动作">
        <button class="次要按钮" type="button" @click="模板弹窗 = true">新建模板</button>
        <button class="主按钮" type="button" @click="颁发弹窗 = true">颁发证书</button>
      </div>
    </header>

    <div v-if="错误" class="错误提示">
      {{ 错误 }} 页面保留完整视觉结构和操作入口，组织能力恢复后可继续维护。
    </div>

    <div class="指标条">
      <article>
        <span>持证记录</span><strong>{{ 证书列表.length }}</strong
        ><small>已登记的人员证书</small>
      </article>
      <article>
        <span>有效证书</span><strong>{{ 正常数量 }}</strong
        ><small>当前可正常使用</small>
      </article>
      <article>
        <span>30 天内到期</span><strong>{{ 临近到期 }}</strong
        ><small>需要安排延期或换证</small>
      </article>
      <article>
        <span>已过期</span><strong>{{ 已过期 }}</strong
        ><small>到期仅告警，不自动改角色</small>
      </article>
    </div>

    <nav class="证书标签">
      <button
        type="button"
        :class="{ active: 当前标签 === 'records' }"
        @click="当前标签 = 'records'"
      >
        持证记录
      </button>
      <button
        type="button"
        :class="{ active: 当前标签 === 'templates' }"
        @click="当前标签 = 'templates'"
      >
        证书模板
      </button>
    </nav>

    <section class="证书面板">
      <header>
        <div>
          <h2>{{ 当前标签 === "records" ? "持证记录与风险" : "证书模板" }}</h2>
          <p>证书到期只产生告警，不会自动撤销业务角色。</p>
        </div>
        <div class="过滤动作" v-if="当前标签 === 'records'">
          <input v-model="搜索词" placeholder="搜索人员、证书或状态" />
          <button class="次要按钮" type="button" @click="加载">刷新</button>
        </div>
      </header>
      <div v-if="加载中" class="加载态">正在读取证书与风险...</div>
      <div v-else-if="当前标签 === 'records'" class="表格容器">
        <table>
          <thead>
            <tr>
              <th>持证人</th>
              <th>证书模板</th>
              <th>颁发日期</th>
              <th>到期日期</th>
              <th>风险状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="证书 in 过滤后证书" :key="证书.id">
              <td>
                <strong>{{ 证书.displayName || 证书.userId }}</strong
                ><small>{{ 证书.userId }}</small>
              </td>
              <td>{{ 证书.templateName }}</td>
              <td>{{ 日期(证书.issuedOn) }}</td>
              <td>{{ 日期(证书.expiresOn) }}</td>
              <td>
                <span class="风险标签" :class="风险类(证书风险(证书))">{{ 证书风险(证书) }}</span>
              </td>
              <td>
                <div class="行操作">
                  <button type="button" @click="打开延期(证书)">延期</button
                  ><button type="button" @click="提交撤销(证书)">撤销</button>
                </div>
              </td>
            </tr>
            <tr v-if="!过滤后证书.length">
              <td colspan="6"><div class="空态">暂无证书记录。</div></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="表格容器">
        <table>
          <thead>
            <tr>
              <th>模板编码</th>
              <th>模板名称</th>
              <th>证书类别</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="模板 in 模板列表" :key="模板.id">
              <td>
                <code>{{ 模板.templateCode }}</code>
              </td>
              <td>{{ 模板.templateName }}</td>
              <td>{{ 模板.category }}</td>
              <td><span class="风险标签 green">可用</span></td>
            </tr>
            <tr v-if="!模板列表.length">
              <td colspan="4"><div class="空态">暂无证书模板。</div></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div v-if="模板弹窗" class="弹窗遮罩" @click.self="模板弹窗 = false">
      <section class="证书弹窗">
        <header>
          <h2>新建证书模板</h2>
          <button type="button" @click="模板弹窗 = false">×</button>
        </header>
        <div class="弹窗表单">
          <label><span>模板编码 *</span><input v-model="模板表单.templateCode" /></label
          ><label><span>模板名称 *</span><input v-model="模板表单.templateName" /></label
          ><label
            ><span>证书类别</span
            ><select v-model="模板表单.category">
              <option value="product">产品认证</option>
              <option value="technical">技术认证</option>
              <option value="service">服务认证</option>
              <option value="other">其他</option>
            </select></label
          >
        </div>
        <footer>
          <button class="次要按钮" type="button" @click="模板弹窗 = false">取消</button
          ><button class="主按钮" type="button" :disabled="提交中" @click="保存模板">
            保存模板
          </button>
        </footer>
      </section>
    </div>

    <div v-if="颁发弹窗" class="弹窗遮罩" @click.self="颁发弹窗 = false">
      <section class="证书弹窗">
        <header>
          <h2>颁发证书</h2>
          <button type="button" @click="颁发弹窗 = false">×</button>
        </header>
        <div class="弹窗表单">
          <label
            ><span>用户编号 *</span
            ><input v-model="颁发表单.userId" placeholder="输入用户名或用户 UUID" /></label
          ><label
            ><span>证书模板 *</span
            ><select v-model="颁发表单.certificationTemplateId">
              <option value="">请选择</option>
              <option v-for="模板 in 模板列表" :key="模板.id" :value="模板.id">
                {{ 模板.templateName }}
              </option>
            </select></label
          ><label><span>证书编号</span><input v-model="颁发表单.certificateNo" /></label
          ><label><span>到期日期</span><input v-model="颁发表单.expiresOn" type="date" /></label>
        </div>
        <footer>
          <button class="次要按钮" type="button" @click="颁发弹窗 = false">取消</button
          ><button class="主按钮" type="button" :disabled="提交中" @click="保存颁发">
            确认颁发
          </button>
        </footer>
      </section>
    </div>

    <div v-if="操作证书" class="弹窗遮罩" @click.self="操作证书 = null">
      <section class="证书弹窗 小弹窗">
        <header>
          <h2>延期证书</h2>
          <button type="button" @click="操作证书 = null">×</button>
        </header>
        <div class="弹窗表单">
          <p>{{ 操作证书.displayName }} · {{ 操作证书.templateName }}</p>
          <label
            ><span>新的到期日期 *</span><input v-model="延期表单.expiresOn" type="date"
          /></label>
        </div>
        <footer>
          <button class="次要按钮" type="button" @click="操作证书 = null">取消</button
          ><button class="主按钮" type="button" @click="提交延期">确认延期</button>
        </footer>
      </section>
    </div>
  </section>
</template>

<style scoped>
.证书风险页 {
  display: grid;
  min-width: 1120px;
  gap: 18px;
  color: #172b4d;
}
.证书页头 {
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
.证书页头 h1 {
  margin: 7px 0 5px;
  font-size: 22px;
}
.证书页头 p {
  margin: 0;
  color: #60748c;
  font-size: 11px;
}
.页头动作,
.过滤动作 {
  display: flex;
  align-items: center;
  gap: 10px;
}
.主按钮,
.次要按钮 {
  min-height: 38px;
  padding: 0 15px;
  border-radius: 8px;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
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
.错误提示 {
  padding: 12px 14px;
  border: 1px solid #f0c4c4;
  border-radius: 8px;
  color: #a72f2f;
  background: #fff2f2;
  font-size: 11px;
}
.指标条 {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}
.指标条 article {
  display: grid;
  gap: 5px;
  padding: 17px 18px;
  border: 1px solid #dce7f3;
  border-radius: 10px;
  background: #fff;
}
.指标条 span,
.指标条 small {
  color: #74869b;
  font-size: 11px;
}
.指标条 strong {
  font-size: 23px;
  font-variant-numeric: tabular-nums;
}
.证书标签 {
  display: flex;
  gap: 8px;
}
.证书标签 button {
  min-height: 34px;
  padding: 0 14px;
  border: 1px solid #d8e4f2;
  border-radius: 8px;
  color: #61748b;
  background: #fff;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}
.证书标签 button.active {
  border-color: #2367d1;
  color: #fff;
  background: #2367d1;
}
.证书面板 {
  overflow: hidden;
  border: 1px solid #dce7f3;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(35, 69, 115, 0.05);
}
.证书面板 > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px;
  border-bottom: 1px solid #e8eef6;
}
.证书面板 h2 {
  margin: 0;
  font-size: 16px;
}
.证书面板 header p {
  margin: 5px 0 0;
  color: #75869a;
  font-size: 11px;
}
.过滤动作 input {
  width: 260px;
  min-height: 38px;
  padding: 8px 11px;
  border: 1px solid #d5e1ee;
  border-radius: 8px;
  font: inherit;
  outline: 0;
}
.表格容器 {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th {
  padding: 12px 14px;
  color: #667991;
  background: #f7f9fc;
  font-size: 11px;
  text-align: left;
  white-space: nowrap;
}
td {
  padding: 14px;
  border-top: 1px solid #eaf0f7;
  color: #40556c;
  font-size: 11px;
  white-space: nowrap;
}
td strong,
td small {
  display: block;
}
td small {
  margin-top: 4px;
  color: #8292a5;
}
code {
  color: #1557d6;
  font-family: var(--font);
  font-size: 11px;
}
.风险标签 {
  padding: 5px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}
.风险标签.green {
  color: #1c7854;
  background: #e5f7ee;
}
.风险标签.amber {
  color: #9a630b;
  background: #fff4da;
}
.风险标签.red {
  color: #af3030;
  background: #fff0f0;
}
.行操作 {
  display: flex;
  gap: 8px;
}
.行操作 button {
  padding: 0;
  border: 0;
  color: #2768cf;
  background: transparent;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}
.加载态,
.空态 {
  padding: 42px;
  color: #75869a;
  text-align: center;
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
.证书弹窗 {
  width: min(640px, 96vw);
  overflow: hidden;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 24px 70px rgba(15, 32, 60, 0.24);
}
.小弹窗 {
  width: min(480px, 96vw);
}
.证书弹窗 header,
.证书弹窗 footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px;
  border-bottom: 1px solid #e7eef6;
}
.证书弹窗 footer {
  justify-content: flex-end;
  border-top: 1px solid #e7eef6;
  border-bottom: 0;
}
.证书弹窗 h2 {
  margin: 0;
  font-size: 16px;
}
.证书弹窗 header button {
  width: 32px;
  height: 32px;
  border: 0;
  color: #75869a;
  background: #f2f5f9;
  font-size: 20px;
  cursor: pointer;
}
.弹窗表单 {
  display: grid;
  gap: 14px;
  padding: 20px;
}
.弹窗表单 label {
  display: grid;
  gap: 7px;
  color: #425970;
  font-size: 11px;
  font-weight: 700;
}
.弹窗表单 p {
  margin: 0;
  color: #526a82;
}
.弹窗表单 input,
.弹窗表单 select {
  width: 100%;
  min-height: 40px;
  padding: 9px 11px;
  border: 1px solid #d5e1ee;
  border-radius: 8px;
  font: inherit;
  outline: 0;
}
</style>
