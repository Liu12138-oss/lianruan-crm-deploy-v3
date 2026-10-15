<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import {
  保存渠道成员,
  查询渠道成员,
  更新渠道成员状态,
  重置渠道成员密码,
  type 渠道成员记录,
} from "../../api/business-client.js";

const 路由 = useRoute();
const 路由器 = useRouter();
const 加载中 = ref(false);
const 提交中 = ref(false);
const 错误 = ref("");
const 搜索词 = ref("");
const 当前状态 = ref("");
const 成员列表 = ref<渠道成员记录[]>([]);
const 编辑中 = ref<渠道成员记录 | null>(null);
const 弹窗打开 = ref(false);

const 表单 = reactive({
  name: "",
  username: "",
  phone: "",
  email: "",
  role: "销售",
  businessRoleCode: "channel_sales",
  password: "123456",
});

const 渠道编号 = computed(() => String(路由.params.id || ""));
const 渠道名称 = computed(() => 成员列表.value[0]?.partnerName || 渠道编号.value);
const 正常成员数 = computed(() => 成员列表.value.filter((item) => item.status === "active").length);
const 待审批成员数 = computed(
  () => 成员列表.value.filter((item) => item.status === "pending").length,
);
const 停用成员数 = computed(
  () => 成员列表.value.filter((item) => !["active", "pending"].includes(item.status)).length,
);
const 过滤后成员 = computed(() => {
  const 词 = 搜索词.value.trim().toLowerCase();
  return 成员列表.value.filter((item) => {
    if (当前状态.value && item.status !== 当前状态.value) return false;
    if (!词) return true;
    return [item.name, item.username, item.phone, item.email, item.role].some((value) =>
      String(value || "")
        .toLowerCase()
        .includes(词),
    );
  });
});

onMounted(() => void 加载成员());

async function 加载成员() {
  if (!渠道编号.value) {
    错误.value = "缺少渠道商编号。";
    return;
  }
  加载中.value = true;
  错误.value = "";
  try {
    成员列表.value = await 查询渠道成员(渠道编号.value);
  } catch (error) {
    错误.value = error instanceof Error ? error.message : "渠道成员加载失败。";
  } finally {
    加载中.value = false;
  }
}

function 打开新增成员() {
  编辑中.value = null;
  表单.name = "";
  表单.username = "";
  表单.phone = "";
  表单.email = "";
  表单.role = "销售";
  表单.businessRoleCode = "channel_sales";
  表单.password = "123456";
  弹窗打开.value = true;
}

function 打开编辑成员(成员: 渠道成员记录) {
  编辑中.value = 成员;
  表单.name = 成员.name;
  表单.username = 成员.username;
  表单.phone = 成员.phone;
  表单.email = 成员.email;
  表单.role = 成员.staffRole || 成员.role || "销售";
  表单.businessRoleCode = 成员.businessRoleCode || "channel_sales";
  表单.password = "123456";
  弹窗打开.value = true;
}

async function 保存成员() {
  if (!表单.name.trim() || !表单.username.trim()) {
    ElMessage.warning("姓名和登录账号不能为空。");
    return;
  }
  提交中.value = true;
  try {
    await 保存渠道成员(
      渠道编号.value,
      {
        name: 表单.name.trim(),
        username: 表单.username.trim(),
        phone: 表单.phone.trim(),
        email: 表单.email.trim(),
        role: 表单.role,
        staffRole: 表单.role,
        accountRole: 表单.businessRoleCode === "partner_admin" ? "partner_admin" : "staff",
        businessRoleCode: 表单.businessRoleCode,
        ...(编辑中.value ? {} : { password: 表单.password }),
      },
      编辑中.value?.id || "",
    );
    弹窗打开.value = false;
    ElMessage.success(编辑中.value ? "成员资料已保存。" : "成员已创建。");
    await 加载成员();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "成员保存失败。");
  } finally {
    提交中.value = false;
  }
}

async function 切换成员状态(成员: 渠道成员记录) {
  const 目标状态 = 成员.status === "active" ? "disabled" : "active";
  const 动作 = 目标状态 === "active" ? "启用" : "停用";
  if (!window.confirm(`确认${动作}成员“${成员.name}”吗？`)) return;
  try {
    await 更新渠道成员状态(渠道编号.value, 成员.id, 目标状态);
    ElMessage.success(`成员已${动作}。`);
    await 加载成员();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : `成员${动作}失败。`);
  }
}

async function 重置密码(成员: 渠道成员记录) {
  if (!window.confirm(`确认将成员“${成员.name}”的密码重置为 123456 吗？`)) return;
  try {
    await 重置渠道成员密码(渠道编号.value, 成员.id);
    ElMessage.success("密码已重置为 123456。");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "密码重置失败。");
  }
}

function 状态名称(status: string): string {
  return (
    { active: "正常", pending: "待审批", disabled: "已停用", rejected: "已驳回" }[status] ||
    status ||
    "—"
  );
}

function 状态类(status: string): string {
  if (status === "active") return "正常";
  if (status === "pending") return "待审批";
  return "停用";
}
</script>

<template>
  <section class="成员页">
    <header class="成员页头">
      <div>
        <button class="返回按钮" type="button" @click="路由器.push('/admin/partners')">
          ← 返回渠道商列表
        </button>
        <span class="页面标签">渠道成员维护</span>
        <h1>{{ 渠道名称 }}</h1>
        <p>维护企业管理员和销售成员，支持新增、编辑、启停和密码重置。</p>
      </div>
      <div class="页头动作">
        <RouterLink
          class="次要按钮"
          :to="`/admin/partners/${encodeURIComponent(渠道编号)}/profile`"
        >
          核心档案
        </RouterLink>
        <button class="主按钮" type="button" @click="打开新增成员">+ 新增成员</button>
      </div>
    </header>

    <div v-if="错误" class="错误提示">{{ 错误 }}</div>
    <div class="指标条">
      <article>
        <span>成员总数</span><strong>{{ 成员列表.length }}</strong
        ><small>含企业管理员</small>
      </article>
      <article>
        <span>正常成员</span><strong>{{ 正常成员数 }}</strong
        ><small>可登录参与业务</small>
      </article>
      <article>
        <span>待审批</span><strong>{{ 待审批成员数 }}</strong
        ><small>需完成账号审批</small>
      </article>
      <article>
        <span>停用成员</span><strong>{{ 停用成员数 }}</strong
        ><small>保留历史业务关系</small>
      </article>
    </div>

    <section class="成员面板">
      <div class="成员工具栏">
        <div class="搜索框">
          <span>⌕</span>
          <input v-model="搜索词" placeholder="搜索姓名、账号、电话、邮箱或角色" />
        </div>
        <select v-model="当前状态">
          <option value="">全部状态</option>
          <option value="active">正常</option>
          <option value="pending">待审批</option>
          <option value="disabled">已停用</option>
          <option value="rejected">已驳回</option>
        </select>
        <button class="次要按钮" type="button" @click="加载成员">刷新</button>
      </div>

      <div v-if="加载中" class="加载态">正在加载渠道成员...</div>
      <div v-else class="表格容器">
        <table>
          <thead>
            <tr>
              <th>成员</th>
              <th>登录账号</th>
              <th>联系方式</th>
              <th>成员角色</th>
              <th>账号状态</th>
              <th>所属渠道</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="成员 in 过滤后成员" :key="成员.id">
              <td>
                <div class="成员身份">
                  <span>{{ 成员.name.slice(0, 1) }}</span>
                  <strong>{{ 成员.name }}</strong>
                </div>
              </td>
              <td>{{ 成员.username }}</td>
              <td>
                <strong>{{ 成员.phone || "—" }}</strong
                ><small>{{ 成员.email || "未填写邮箱" }}</small>
              </td>
              <td>{{ 成员.businessRoleCode === "partner_admin" ? "企业管理员" : 成员.role }}</td>
              <td>
                <span class="状态标签" :class="状态类(成员.status)">{{
                  状态名称(成员.status)
                }}</span>
              </td>
              <td>{{ 成员.partnerName || 渠道名称 }}</td>
              <td>
                <div class="行操作">
                  <button type="button" @click="打开编辑成员(成员)">编辑</button>
                  <button type="button" @click="切换成员状态(成员)">
                    {{ 成员.status === "active" ? "停用" : "启用" }}
                  </button>
                  <button type="button" @click="重置密码(成员)">重置密码</button>
                </div>
              </td>
            </tr>
            <tr v-if="!过滤后成员.length">
              <td colspan="7"><div class="空态">当前筛选条件下没有成员。</div></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div v-if="弹窗打开" class="弹窗遮罩" @click.self="弹窗打开 = false">
      <section class="成员弹窗">
        <header>
          <div>
            <h2>{{ 编辑中 ? "编辑渠道成员" : "新增渠道成员" }}</h2>
            <p>账号权限和成员职责由成员角色控制。</p>
          </div>
          <button type="button" @click="弹窗打开 = false">×</button>
        </header>
        <div class="弹窗表单">
          <label><span>姓名 *</span><input v-model="表单.name" /></label>
          <label
            ><span>登录账号 *</span><input v-model="表单.username" :disabled="Boolean(编辑中)"
          /></label>
          <label><span>联系电话</span><input v-model="表单.phone" /></label>
          <label><span>邮箱</span><input v-model="表单.email" /></label>
          <label>
            <span>成员职责</span>
            <select v-model="表单.businessRoleCode">
              <option value="channel_sales">销售成员</option>
              <option value="channel_technical">技术成员</option>
              <option value="partner_admin">企业管理员</option>
            </select>
          </label>
          <label><span>岗位名称</span><input v-model="表单.role" /></label>
          <label v-if="!编辑中" class="全宽"
            ><span>初始密码</span><input v-model="表单.password"
          /></label>
        </div>
        <footer>
          <button class="次要按钮" type="button" @click="弹窗打开 = false">取消</button>
          <button class="主按钮" type="button" :disabled="提交中" @click="保存成员">
            {{ 提交中 ? "保存中..." : "保存成员" }}
          </button>
        </footer>
      </section>
    </div>
  </section>
</template>

<style scoped>
.成员页 {
  display: grid;
  min-width: 1120px;
  gap: 18px;
  color: #172b4d;
}
.成员页头 {
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
.成员页头 h1 {
  margin: 7px 0 5px;
  font-size: 22px;
}
.成员页头 p {
  margin: 0;
  color: #60748c;
  font-size: 11px;
}
.页头动作 {
  display: flex;
  align-items: center;
  gap: 10px;
  white-space: nowrap;
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
.成员面板 {
  overflow: hidden;
  border: 1px solid #dce7f3;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(35, 69, 115, 0.05);
}
.成员工具栏 {
  display: grid;
  grid-template-columns: minmax(280px, 1fr) 160px auto;
  gap: 10px;
  padding: 15px 16px;
  border-bottom: 1px solid #e6edf6;
  background: #f8fbff;
}
.搜索框 {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 11px;
  border: 1px solid #d5e1ee;
  border-radius: 8px;
  background: #fff;
}
.搜索框 span {
  color: #7b8da2;
}
.搜索框 input {
  flex: 1;
  min-width: 0;
  height: 38px;
  border: 0;
  outline: 0;
  font: inherit;
}
select,
input {
  width: 100%;
  min-height: 38px;
  padding: 8px 10px;
  border: 1px solid #d5e1ee;
  border-radius: 8px;
  color: #34495f;
  background: #fff;
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
  vertical-align: middle;
}
td > small {
  display: block;
  margin-top: 4px;
  color: #8594a6;
}
.成员身份 {
  display: flex;
  align-items: center;
  gap: 10px;
}
.成员身份 > span {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 9px;
  color: #1557d6;
  background: #eaf3ff;
  font-weight: 700;
}
.状态标签 {
  display: inline-flex;
  min-height: 24px;
  align-items: center;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}
.状态标签.正常 {
  color: #1c7854;
  background: #e5f7ee;
}
.状态标签.待审批 {
  color: #9a630b;
  background: #fff4da;
}
.状态标签.停用 {
  color: #697789;
  background: #edf1f5;
}
.行操作 {
  display: flex;
  gap: 8px;
  white-space: nowrap;
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
.成员弹窗 {
  width: min(680px, 96vw);
  overflow: hidden;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 24px 70px rgba(15, 32, 60, 0.24);
}
.成员弹窗 header,
.成员弹窗 footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px;
  border-bottom: 1px solid #e7eef6;
}
.成员弹窗 footer {
  justify-content: flex-end;
  border-top: 1px solid #e7eef6;
  border-bottom: 0;
}
.成员弹窗 h2 {
  margin: 0;
  font-size: 16px;
}
.成员弹窗 p {
  margin: 5px 0 0;
  color: #75869a;
  font-size: 11px;
}
.成员弹窗 header button {
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
  grid-template-columns: repeat(2, minmax(0, 1fr));
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
.弹窗表单 .全宽 {
  grid-column: 1 / -1;
}
</style>
