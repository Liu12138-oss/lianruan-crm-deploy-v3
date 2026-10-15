<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { use外壳前缀 } from "../../shared/navigation/shell-prefix.js";
import RegistrationReviewActions from "./RegistrationReviewActions.vue";

import {
  查询阶段9列表,
  更新报备资料,
  更新商机,
  type 阶段9记录,
} from "../../api/business-client.js";

interface 跟进记录 {
  id: string;
  at: string;
  type: string;
  content: string;
  owner: string;
  nextAt: string;
}

const 路由 = useRoute();
const 路由器 = useRouter();
const 外壳前缀 = use外壳前缀();
const 加载中 = ref(false);
const 提交中 = ref(false);
const 错误 = ref("");
const 客户 = ref<阶段9记录 | null>(null);
const 商机列表 = ref<阶段9记录[]>([]);
const 选中商机编号 = ref("");
const 编辑档案 = ref(false);

const 表单 = reactive({
  客户名称: "",
  统一社会信用代码: "",
  行业: "",
  联系人: "",
  职务: "",
  联系电话: "",
  邮箱: "",
  地区: "",
  地址: "",
  归属渠道: "",
  负责人: "",
  保护期: "",
});

const 跟进表单 = reactive({
  方式: "电话沟通",
  内容: "",
  下一步: "",
  下次跟进: "",
});

const 客户编号 = computed(() => String(路由.params.id || ""));
const 客户标题 = computed(
  () => 字段(客户.value, "客户名称", "customerName") || 主标题(客户.value) || "客户详情",
);
const 选中商机 = computed(
  () => 商机列表.value.find((item) => item.id === 选中商机编号.value) || 商机列表.value[0] || null,
);
const 跟进历史 = computed<跟进记录[]>(() => {
  const 记录列表 = 选中商机.value?.原始数据?.followUps;
  if (!Array.isArray(记录列表)) return [];
  return 记录列表
    .map((item, index) => {
      const 记录 = item as Record<string, unknown>;
      return {
        id: String(记录.id || `follow-${index}`),
        at: String(记录.at || 记录.createdAt || 选中商机.value?.更新时间 || ""),
        type: String(记录.type || 记录.方式 || "业务跟进"),
        content: String(记录.content || 记录.内容 || 记录.followup || ""),
        owner: String(记录.owner || 记录.ownerName || 选中商机.value?.负责人 || "—"),
        nextAt: String(记录.nextAt || 记录.下次跟进 || ""),
      };
    })
    .filter((item) => item.content || item.at);
});

onMounted(() => void 加载());

async function 加载() {
  if (!客户编号.value) {
    错误.value = "缺少客户编号。";
    return;
  }
  加载中.value = true;
  错误.value = "";
  try {
    const [客户结果, 商机结果] = await Promise.all([
      查询阶段9列表("registrations", { page: 1, pageSize: 100 }),
      查询阶段9列表("opportunities", { page: 1, pageSize: 200 }),
    ]);
    客户.value =
      客户结果.数据.find((item) => item.id === 客户编号.value || item.编号 === 客户编号.value) ||
      null;
    if (!客户.value) throw new Error("未找到客户记录，可能已超出当前账号的数据范围。");
    商机列表.value = 商机结果.数据.filter(
      (item) =>
        字段(item, "registrationId", "regId", "registrationNo", "报备编号") ===
          (客户.value?.id || "") ||
        字段(item, "registrationNo", "报备编号") === (客户.value?.编号 || "") ||
        (客户.value?.客户名称 && item.客户名称 === 客户.value.客户名称),
    );
    选中商机编号.value = 商机列表.value[0]?.id || "";
    应用客户();
  } catch (error) {
    错误.value = error instanceof Error ? error.message : "客户跟进数据加载失败。";
  } finally {
    加载中.value = false;
  }
}

function 应用客户() {
  const row = 客户.value;
  if (!row) return;
  表单.客户名称 = 字段(row, "客户名称", "customerName");
  表单.统一社会信用代码 = 字段(row, "creditCode", "统一社会信用代码");
  表单.行业 = 字段(row, "industry", "行业");
  表单.联系人 = 字段(row, "contact", "联系人");
  表单.职务 = 字段(row, "position", "职务", "contactTitle");
  表单.联系电话 = 字段(row, "phone", "联系电话");
  表单.邮箱 = 字段(row, "email", "邮箱");
  表单.地区 = 组合文本(字段(row, "区域", "region"), 字段(row, "city", "城市"));
  表单.地址 = 字段(row, "address", "注册地址");
  表单.归属渠道 = 字段(row, "渠道名称", "partnerName", "assignedPartnerName");
  表单.负责人 = row.负责人 || 字段(row, "ownerName", "assignedStaffName");
  表单.保护期 = 字段(row, "expireAt", "保护期至");
}

async function 保存客户档案() {
  if (!客户.value || 提交中.value) return;
  if (!表单.客户名称.trim()) {
    ElMessage.warning("客户名称不能为空。");
    return;
  }
  提交中.value = true;
  try {
    const 更新后 = await 更新报备资料(客户.value.id, {
      customer: 表单.客户名称.trim(),
      customerName: 表单.客户名称.trim(),
      creditCode: 表单.统一社会信用代码.trim(),
      industry: 表单.行业,
      contact: 表单.联系人,
      position: 表单.职务,
      phone: 表单.联系电话,
      email: 表单.邮箱,
      city: 表单.地区,
      address: 表单.地址,
      partnerName: 表单.归属渠道,
      assignedStaffName: 表单.负责人,
    });
    客户.value = 更新后;
    编辑档案.value = false;
    ElMessage.success("客户档案已保存。");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "客户档案保存失败。");
  } finally {
    提交中.value = false;
  }
}

async function 保存跟进() {
  const 商机 = 选中商机.value;
  if (!商机) {
    ElMessage.warning("当前客户还没有关联商机，请先创建商机。");
    return;
  }
  if (!跟进表单.内容.trim()) {
    ElMessage.warning("请填写跟进内容。");
    return;
  }
  提交中.value = true;
  try {
    const 旧记录 = Array.isArray(商机.原始数据.followUps) ? 商机.原始数据.followUps : [];
    const 新记录 = {
      id: `follow-${Date.now()}`,
      at: new Date().toISOString(),
      type: 跟进表单.方式,
      content: 跟进表单.内容.trim(),
      owner: 商机.负责人 || "当前用户",
      nextAt: 跟进表单.下次跟进,
      下一步: 跟进表单.下一步.trim(),
    };
    const 更新后 = await 更新商机(商机.id, {
      stage: 字段(商机, "stage", "阶段", "状态") || "registered",
      followup: 跟进表单.内容.trim(),
      nextFollowAt: 跟进表单.下次跟进,
      followUps: [...旧记录, 新记录],
      changeReason: `客户跟进：${跟进表单.方式}`,
    });
    const 位置 = 商机列表.value.findIndex((item) => item.id === 商机.id);
    if (位置 >= 0) 商机列表.value.splice(位置, 1, 更新后);
    跟进表单.内容 = "";
    跟进表单.下一步 = "";
    ElMessage.success("跟进记录已保存。");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "跟进记录保存失败。");
  } finally {
    提交中.value = false;
  }
}

function 字段(row: 阶段9记录 | null | undefined, ...keys: string[]): string {
  if (!row) return "";
  for (const key of keys) {
    const 值 = row.原始数据?.[key];
    const 顶层值 = (row as unknown as Record<string, unknown>)[key];
    if (值 !== null && 值 !== undefined && 值 !== "") return String(值);
    if (顶层值 !== null && 顶层值 !== undefined && 顶层值 !== "") return String(顶层值);
  }
  return "";
}

function 主标题(row: 阶段9记录 | null): string {
  return row?.标题 || row?.客户名称 || row?.编号 || "";
}

function 组合文本(...values: string[]): string {
  return values.filter(Boolean).join(" / ");
}

/** 审核动作成功后同步页面数据：状态、保护期与审批字段都来自服务端返回。 */
function 应用审核结果(记录: 阶段9记录) {
  客户.value = 记录;
  应用客户();
}

function 格式时间(value: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}
</script>

<template>
  <section class="客户跟进页">
    <header class="跟进页头">
      <div>
        <button class="返回按钮" type="button" @click="路由器.push(`${外壳前缀}/registration`)">
          ← 返回客户列表
        </button>
        <span class="页面标签">客户经营</span>
        <h1>{{ 客户标题 }}</h1>
        <p>维护客户档案，并围绕关联商机记录沟通、下一步计划和下次跟进时间。</p>
      </div>
      <div class="页头动作">
        <RegistrationReviewActions :客户="客户" 尺寸="大" @更新="应用审核结果" />
        <span class="保护期">保护期至 {{ 表单.保护期 || "未生效" }}</span>
        <button class="主按钮" type="button" @click="编辑档案 = !编辑档案">
          {{ 编辑档案 ? "取消编辑" : "编辑客户档案" }}
        </button>
      </div>
    </header>

    <div v-if="错误" class="错误提示">{{ 错误 }}</div>
    <div v-if="加载中" class="加载态">正在读取客户、商机和跟进记录...</div>

    <template v-else-if="客户">
      <section v-if="编辑档案" class="档案编辑面板">
        <div class="面板标题">
          <div>
            <h2>编辑客户档案</h2>
            <p>字段保存后进入客户报备事实，不复制到商机。</p>
          </div>
          <button class="保存按钮" type="button" :disabled="提交中" @click="保存客户档案">
            {{ 提交中 ? "保存中..." : "保存档案" }}
          </button>
        </div>
        <div class="表单网格">
          <label><span>客户名称 *</span><input v-model="表单.客户名称" /></label>
          <label><span>统一社会信用代码</span><input v-model="表单.统一社会信用代码" /></label>
          <label><span>行业</span><input v-model="表单.行业" /></label>
          <label><span>联系人</span><input v-model="表单.联系人" /></label>
          <label><span>联系人职务</span><input v-model="表单.职务" /></label>
          <label><span>联系电话</span><input v-model="表单.联系电话" /></label>
          <label><span>邮箱</span><input v-model="表单.邮箱" /></label>
          <label><span>区域 / 城市</span><input v-model="表单.地区" /></label>
          <label class="全宽"><span>注册地址</span><input v-model="表单.地址" /></label>
          <label><span>归属渠道</span><input v-model="表单.归属渠道" /></label>
          <label><span>负责人</span><input v-model="表单.负责人" /></label>
        </div>
      </section>

      <div class="跟进布局">
        <aside class="客户摘要面板">
          <div class="客户标识">
            <span>{{ 客户标题.slice(0, 1) }}</span>
            <div>
              <strong>{{ 客户标题 }}</strong
              ><small>{{ 表单.行业 || "未填写行业" }}</small>
            </div>
          </div>
          <dl>
            <div>
              <dt>客户编号</dt>
              <dd>{{ 客户.编号 || 客户.id }}</dd>
            </div>
            <div>
              <dt>统一社会信用代码</dt>
              <dd>{{ 表单.统一社会信用代码 || "—" }}</dd>
            </div>
            <div>
              <dt>联系人</dt>
              <dd>{{ 表单.联系人 || "—" }} · {{ 表单.联系电话 || "—" }}</dd>
            </div>
            <div>
              <dt>区域 / 城市</dt>
              <dd>{{ 表单.地区 || "—" }}</dd>
            </div>
            <div>
              <dt>归属渠道</dt>
              <dd>{{ 表单.归属渠道 || "—" }}</dd>
            </div>
            <div>
              <dt>负责人</dt>
              <dd>{{ 表单.负责人 || "—" }}</dd>
            </div>
          </dl>
          <div class="关联商机">
            <strong>关联商机</strong>
            <button
              v-for="商机 in 商机列表"
              :key="商机.id"
              type="button"
              :class="{ active: 选中商机编号 === 商机.id }"
              @click="选中商机编号 = 商机.id"
            >
              <span>{{ 商机.标题 }}</span>
              <small>{{ 商机.编号 }} · {{ 商机.状态名称 }}</small>
            </button>
            <p v-if="!商机列表.length">暂无关联商机，请从客户报备转为商机。</p>
          </div>
        </aside>

        <main class="跟进主体">
          <section class="跟进表单面板">
            <div class="面板标题">
              <div>
                <h2>记录客户跟进</h2>
                <p>
                  {{ 选中商机 ? `跟进对象：${选中商机.标题}` : "当前客户没有可跟进的商机" }}
                </p>
              </div>
            </div>
            <div class="跟进表单">
              <label>
                <span>跟进方式</span>
                <select v-model="跟进表单.方式">
                  <option>电话沟通</option>
                  <option>现场拜访</option>
                  <option>线上会议</option>
                  <option>微信沟通</option>
                  <option>客户反馈</option>
                </select>
              </label>
              <label>
                <span>下次跟进时间</span>
                <input v-model="跟进表单.下次跟进" type="datetime-local" />
              </label>
              <label class="全宽">
                <span>本次沟通内容 *</span>
                <textarea
                  v-model="跟进表单.内容"
                  rows="4"
                  placeholder="记录客户反馈、关键决策人、预算、时间计划或风险..."
                ></textarea>
              </label>
              <label class="全宽">
                <span>下一步计划</span>
                <textarea
                  v-model="跟进表单.下一步"
                  rows="3"
                  placeholder="明确下一步动作、负责人和时间要求..."
                ></textarea>
              </label>
              <button
                class="保存按钮 全宽"
                type="button"
                :disabled="提交中 || !选中商机"
                @click="保存跟进"
              >
                {{ 提交中 ? "保存中..." : "保存跟进记录" }}
              </button>
            </div>
          </section>

          <section class="时间线面板">
            <div class="面板标题">
              <div>
                <h2>跟进时间线</h2>
                <p>按时间倒序展示已记录的客户沟通。</p>
              </div>
            </div>
            <div v-if="跟进历史.length" class="时间线">
              <article v-for="记录 in 跟进历史" :key="记录.id">
                <i></i>
                <div>
                  <strong>{{ 记录.type }}</strong>
                  <p>{{ 记录.content }}</p>
                  <small>下次跟进：{{ 格式时间(记录.nextAt) }}</small>
                </div>
                <time>{{ 格式时间(记录.at) }}<br />{{ 记录.owner }}</time>
              </article>
            </div>
            <div v-else class="空态">暂无跟进记录，使用上方表单记录首次客户沟通。</div>
          </section>
        </main>
      </div>
    </template>
  </section>
</template>

<style scoped>
.客户跟进页 {
  display: grid;
  min-width: 1180px;
  gap: 18px;
  color: #172b4d;
}
.跟进页头 {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  padding: 22px 24px;
  border: 1px solid #dce7f3;
  border-radius: 12px;
  background: linear-gradient(120deg, #fff, #f2f7ff);
}
.页面标签 {
  color: #2f69ed;
  font-size: 11px;
  font-weight: 700;
}
.跟进页头 h1 {
  margin: 7px 0 5px;
  font-size: 22px;
}
.跟进页头 p {
  margin: 0;
  color: #60748c;
  font-size: 11px;
}
.页头动作 {
  display: flex;
  align-items: center;
  gap: 12px;
  white-space: nowrap;
}
.保护期 {
  padding: 7px 10px;
  border-radius: 999px;
  color: #1d6b50;
  background: #e7f7ef;
  font-size: 11px;
  font-weight: 700;
}
.主按钮,
.保存按钮 {
  min-height: 38px;
  padding: 0 15px;
  border: 0;
  border-radius: 8px;
  color: #fff;
  background: #2367d1;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}
.保存按钮:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.错误提示 {
  padding: 12px 14px;
  border: 1px solid #f0c4c4;
  border-radius: 8px;
  color: #a72f2f;
  background: #fff2f2;
}
.加载态,
.空态 {
  padding: 40px;
  color: #73849a;
  text-align: center;
  border: 1px dashed #ccd9e8;
  border-radius: 10px;
  background: #fff;
}
.跟进布局 {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}
.客户摘要面板,
.跟进表单面板,
.时间线面板,
.档案编辑面板 {
  border: 1px solid #dce7f3;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(35, 69, 115, 0.05);
}
.客户摘要面板 {
  position: sticky;
  top: 14px;
  overflow: hidden;
}
.客户标识 {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px;
  border-bottom: 1px solid #e7eef7;
  background: #f7faff;
}
.客户标识 > span {
  display: grid;
  width: 46px;
  height: 46px;
  place-items: center;
  border-radius: 12px;
  color: #fff;
  background: #2367d1;
  font-size: 20px;
  font-weight: 700;
}
.客户标识 strong,
.客户标识 small {
  display: block;
}
.客户标识 strong {
  font-size: 11px;
}
.客户标识 small {
  margin-top: 4px;
  color: #72849a;
  font-size: 11px;
}
.客户摘要面板 dl {
  display: grid;
  gap: 0;
  padding: 8px 18px;
  margin: 0;
}
.客户摘要面板 dl > div {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid #eef2f7;
}
.客户摘要面板 dt {
  color: #8190a3;
  font-size: 11px;
}
.客户摘要面板 dd {
  margin: 0;
  color: #34495f;
  font-size: 11px;
  line-height: 1.5;
  text-align: right;
  word-break: break-word;
}
.关联商机 {
  display: grid;
  gap: 8px;
  padding: 16px 18px 18px;
}
.关联商机 > strong {
  color: #41556d;
  font-size: 11px;
}
.关联商机 button {
  display: grid;
  gap: 4px;
  padding: 10px;
  border: 1px solid #dce7f3;
  border-radius: 8px;
  color: #41556d;
  background: #fff;
  text-align: left;
  cursor: pointer;
}
.关联商机 button.active {
  border-color: #75a8ed;
  background: #edf5ff;
}
.关联商机 button span {
  font-size: 11px;
  font-weight: 700;
}
.关联商机 button small,
.关联商机 p {
  color: #7b8ca0;
  font-size: 11px;
}
.关联商机 p {
  margin: 0;
  line-height: 1.55;
}
.跟进主体 {
  display: grid;
  gap: 18px;
  min-width: 0;
}
.面板标题 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px;
  border-bottom: 1px solid #e8eef6;
}
.面板标题 h2 {
  margin: 0;
  font-size: 16px;
}
.面板标题 p {
  margin: 5px 0 0;
  color: #74869b;
  font-size: 11px;
}
.跟进表单,
.表单网格 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  padding: 18px;
}
.跟进表单 label,
.表单网格 label {
  display: grid;
  gap: 7px;
  min-width: 0;
  color: #41556d;
  font-size: 11px;
  font-weight: 700;
}
.全宽 {
  grid-column: 1 / -1;
}
input,
select,
textarea {
  width: 100%;
  min-width: 0;
  min-height: 38px;
  padding: 9px 11px;
  border: 1px solid #d5e1ee;
  border-radius: 8px;
  color: #2f445b;
  background: #fff;
  font: inherit;
  font-weight: 400;
  outline: 0;
}
textarea {
  resize: vertical;
  line-height: 1.55;
}
input:focus,
select:focus,
textarea:focus {
  border-color: #2f69ed;
  box-shadow: 0 0 0 3px rgba(47, 105, 237, 0.1);
}
.时间线 {
  padding: 18px;
}
.时间线 article {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr) 150px;
  gap: 10px;
  padding: 0 0 18px;
}
.时间线 article > i {
  width: 9px;
  height: 9px;
  margin-top: 5px;
  border-radius: 50%;
  background: #2367d1;
  box-shadow: 0 0 0 4px #e8f2ff;
}
.时间线 strong {
  font-size: 11px;
}
.时间线 p {
  margin: 5px 0;
  color: #51677e;
  font-size: 11px;
  line-height: 1.6;
  white-space: pre-wrap;
}
.时间线 small,
.时间线 time {
  color: #8090a3;
  font-size: 11px;
}
.时间线 time {
  text-align: right;
  line-height: 1.6;
}
</style>
