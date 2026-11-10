<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, onMounted, reactive, ref } from "vue";

import { 修改当前密码 } from "../api/auth-client.js";
import type { 阶段9记录 } from "../api/business-client.js";
import { 查询统一消息列表, 标记统一消息已读 } from "../api/message-client.js";

defineProps<{
  用户名: string;
}>();

const 通知打开 = ref(false);
const 通知列表 = ref<阶段9记录[]>([]);
const 通知加载中 = ref(false);
const 修改密码打开 = ref(false);
const 密码提交中 = ref(false);
const 密码错误 = ref("");
const 密码表单 = reactive({
  oldPassword: "",
  newPassword: "",
  confirmPassword: "",
});

const 未读数量 = computed(
  () => 通知列表.value.filter((item) => item.状态 === "unread" || item.状态名称 === "未读").length,
);

async function 切换通知() {
  通知打开.value = !通知打开.value;
  if (通知打开.value && !通知列表.value.length) await 加载通知();
}

async function 加载通知() {
  通知加载中.value = true;
  try {
    const 结果 = await 查询统一消息列表({ limit: 20 });
    通知列表.value = 结果.数据;
  } catch {
    通知列表.value = [];
  } finally {
    通知加载中.value = false;
  }
}

async function 全部已读() {
  try {
    await 标记统一消息已读();
    通知列表.value = 通知列表.value.map((item) => ({
      ...item,
      状态: "read",
      状态名称: "已读",
    }));
    ElMessage.success("通知已全部标记为已读。");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "通知标记失败。");
  }
}

async function 标记单条已读(item: 阶段9记录) {
  if (item.状态 === "read" || item.状态名称 === "已读") return;
  if (!item.id) {
    ElMessage.error("通知编号缺失，请刷新后重试。");
    return;
  }
  try {
    // 单条已读必须写回服务端；只改前端状态会在刷新后被未读数据覆盖。
    await 标记统一消息已读(item.id);
    item.状态 = "read";
    item.状态名称 = "已读";
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "通知标记失败。");
  }
}

function 打开修改密码弹窗() {
  密码表单.oldPassword = "";
  密码表单.newPassword = "";
  密码表单.confirmPassword = "";
  密码错误.value = "";
  修改密码打开.value = true;
}

function 关闭修改密码弹窗() {
  修改密码打开.value = false;
}

async function 提交修改密码() {
  密码错误.value = "";
  if (!密码表单.oldPassword) {
    密码错误.value = "请输入当前密码";
    return;
  }
  if (!密码表单.newPassword) {
    密码错误.value = "请输入新密码";
    return;
  }
  if (密码表单.newPassword.length < 6) {
    密码错误.value = "新密码长度不能少于6位";
    return;
  }
  if (密码表单.newPassword !== 密码表单.confirmPassword) {
    密码错误.value = "两次输入的新密码不一致";
    return;
  }

  密码提交中.value = true;
  try {
    await 修改当前密码({
      oldPassword: 密码表单.oldPassword,
      newPassword: 密码表单.newPassword,
    });
    ElMessage.success("密码已修改，请使用新密码重新登录。");
    修改密码打开.value = false;
    window.setTimeout(() => {
      window.location.replace("/login?passwordChanged=1");
    }, 300);
  } catch (error) {
    密码错误.value = error instanceof Error ? error.message : "密码修改失败，请稍后重试。";
  } finally {
    密码提交中.value = false;
  }
}

function 通知描述(item: 阶段9记录) {
  const raw = item.原始数据 || {};
  return String(
    raw.desc || raw.description || raw.message || raw.body || item.负责人 || "暂无通知详情",
  );
}

function 通知时间(item: 阶段9记录) {
  const raw = item.原始数据 || {};
  const value = String(raw.time || item.创建时间 || "");
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

onMounted(() => {
  void 加载通知();
});

defineExpose({ 打开修改密码弹窗 });
</script>

<template>
  <div class="v2-顶部动作">
    <button type="button" title="通知" @click="切换通知">
      🔔
      <span v-if="未读数量" class="notif-dot"></span>
    </button>
    <button type="button" title="帮助">❓</button>
    <span>{{ 用户名.slice(0, 6) }}{{ 用户名.length > 6 ? "…" : "" }}</span>
  </div>

  <Teleport to="body">
    <aside class="notif-panel" :class="{ open: 通知打开 }" aria-label="通知中心">
      <header class="notif-panel__header">
        <strong>通知中心</strong>
        <button type="button" @click="全部已读">全部已读</button>
      </header>
      <div class="notif-panel__body">
        <div v-if="通知加载中" class="notif-empty">通知加载中...</div>
        <template v-else>
          <button
            v-for="item in 通知列表"
            :key="item.id"
            class="notif-item"
            :class="{ unread: item.状态 === 'unread' || item.状态名称 === '未读' }"
            type="button"
            @click="标记单条已读(item)"
          >
            <span class="ni-title">{{ item.标题 }}</span>
            <span class="ni-desc">{{ 通知描述(item) }}</span>
            <span class="ni-time">{{ 通知时间(item) }}</span>
          </button>
        </template>
        <div v-if="!通知加载中 && !通知列表.length" class="notif-empty">暂无通知</div>
      </div>
    </aside>
    <button
      v-if="通知打开"
      class="notif-mask"
      type="button"
      aria-label="关闭通知中心"
      @click="通知打开 = false"
    ></button>

    <div v-if="修改密码打开" class="modal-overlay" @click.self="关闭修改密码弹窗">
      <section class="modal v2-password-modal">
        <header class="modal-header">
          <h2 class="modal-title">修改密码</h2>
          <button class="modal-close" type="button" @click="关闭修改密码弹窗">×</button>
        </header>
        <div class="modal-body">
          <div class="form-grid v2-password-form">
            <label class="form-item full">
              <span class="form-label">当前密码</span>
              <input
                v-model="密码表单.oldPassword"
                class="form-control"
                placeholder="请输入当前密码"
                type="password"
              />
            </label>
            <label class="form-item full">
              <span class="form-label">新密码</span>
              <input
                v-model="密码表单.newPassword"
                class="form-control"
                placeholder="请输入新密码（至少6位）"
                type="password"
              />
            </label>
            <label class="form-item full">
              <span class="form-label">确认新密码</span>
              <input
                v-model="密码表单.confirmPassword"
                class="form-control"
                placeholder="请再次输入新密码"
                type="password"
              />
            </label>
            <p v-if="密码错误" class="v2-password-error">{{ 密码错误 }}</p>
          </div>
        </div>
        <footer class="modal-footer">
          <button class="btn btn-default" type="button" @click="关闭修改密码弹窗">取消</button>
          <button
            class="btn btn-primary"
            type="button"
            :disabled="密码提交中"
            @click="提交修改密码"
          >
            {{ 密码提交中 ? "提交中..." : "确认修改" }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
