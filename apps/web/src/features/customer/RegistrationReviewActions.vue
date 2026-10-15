<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import { 更新报备状态, type 阶段9记录 } from "../../api/business-client.js";
import { use外壳前缀 } from "../../shared/navigation/shell-prefix.js";
import { 是内部管理员 } from "../../shared/permission/role.js";
import { useSessionStore } from "../../stores/session.js";

/**
 * 客户报备审核动作：与老 UI 审核页口径一致。
 * 待审核 → 内部管理员可通过或驳回（驳回必填原因）；
 * 已驳回 → 内部管理员可重新提交，状态回到待审核；
 * 已通过 → 提供「报备商机」入口。
 * 渠道端不出现审核按钮，避免越权提交；服务端会再次校验角色。
 */
const 属性 = defineProps<{
  客户: 阶段9记录 | null | undefined;
  尺寸?: "标准" | "大";
}>();

const 发出 = defineEmits<{ 更新: [记录: 阶段9记录] }>();

const 路由器 = useRouter();
const 外壳前缀 = use外壳前缀();
const 会话 = useSessionStore();

const 内部管理员 = computed(() => 是内部管理员(会话.user));
const 待审核 = computed(() => 属性.客户?.状态 === "pending");
const 已驳回 = computed(() => 属性.客户?.状态 === "rejected");
const 已通过 = computed(() => 属性.客户?.状态 === "approved");
const 审核动作 = ref<"" | "通过" | "驳回" | "重提">("");
const 审核意见 = ref("");
const 提交中 = ref(false);

function 打开审核(动作: "通过" | "驳回" | "重提") {
  审核动作.value = 动作;
  审核意见.value = "";
}

function 关闭审核() {
  if (提交中.value) return;
  审核动作.value = "";
  审核意见.value = "";
}

async function 提交审核() {
  const 记录 = 属性.客户;
  if (!记录 || !审核动作.value || 提交中.value) return;
  if (审核动作.value === "驳回" && !审核意见.value.trim()) {
    ElMessage.warning("请填写驳回原因，将记录在审批历史里。");
    return;
  }
  const 决定 = 审核动作.value;
  const 目标状态 = 决定 === "通过" ? "approved" : 决定 === "驳回" ? "rejected" : "pending";
  const 默认说明 = 决定 === "通过" ? "客户报备审核通过" : 决定 === "驳回" ? "客户报备驳回" : "重新提交审核";
  提交中.value = true;
  try {
    const 更新后 = await 更新报备状态(记录.id, {
      status: 目标状态,
      reason: 审核意见.value.trim() || 默认说明,
    });
    发出("更新", 更新后);
    ElMessage.success(
      决定 === "通过"
        ? "客户报备已通过，保护期开始生效。"
        : 决定 === "驳回"
          ? "客户报备已驳回。"
          : "客户报备已重新提交，等待审核。",
    );
    审核动作.value = "";
    审核意见.value = "";
  } catch (错误) {
    ElMessage.error(错误 instanceof Error ? 错误.message : "报备审核提交失败。");
  } finally {
    提交中.value = false;
  }
}

function 打开报备商机() {
  const 记录 = 属性.客户;
  if (!记录) return;
  路由器.push(`${外壳前缀.value}/opportunity/new?registrationId=${encodeURIComponent(记录.id)}`);
}
</script>

<template>
  <template v-if="客户">
    <button
      v-if="内部管理员 && 待审核"
      type="button"
      class="报备动作 通过"
      :class="{ 大: 尺寸 === '大' }"
      @click="打开审核('通过')"
    >
      ✓ 通过报备
    </button>
    <button
      v-if="内部管理员 && 待审核"
      type="button"
      class="报备动作 驳回"
      :class="{ 大: 尺寸 === '大' }"
      @click="打开审核('驳回')"
    >
      ✕ 驳回报备
    </button>
    <button
      v-if="内部管理员 && 已驳回"
      type="button"
      class="报备动作 重提"
      :class="{ 大: 尺寸 === '大' }"
      @click="打开审核('重提')"
    >
      ↻ 重新提交
    </button>
    <button
      v-if="已通过"
      type="button"
      class="报备动作 转商机"
      :class="{ 大: 尺寸 === '大' }"
      @click="打开报备商机"
    >
      🎯 报备商机
    </button>

    <Teleport to="body">
      <div v-if="审核动作" class="报备遮罩" @click.self="关闭审核">
        <section class="报备弹窗">
          <header>
            <div>
              <h2>
                {{
                  审核动作 === "通过"
                    ? "通过客户报备"
                    : 审核动作 === "驳回"
                      ? "驳回客户报备"
                      : "重新提交报备"
                }}
              </h2>
              <p>{{ 客户.编号 || 客户.id }} · {{ 客户.客户名称 || 客户.标题 || "未命名客户" }}</p>
            </div>
            <button type="button" @click="关闭审核">×</button>
          </header>
          <div class="报备表单">
            <p class="报备说明">
              {{
                审核动作 === "通过"
                  ? "通过后客户进入保护期，渠道可按保护期规则推进商机与报价。"
                  : 审核动作 === "驳回"
                    ? "驳回后不产生保护期，客户报备将在审核页保留已驳回记录。"
                    : "重新提交后报备回到待审核，审核记录继续保留在审批中心。"
              }}
            </p>
            <label>
              <span>{{ 审核动作 === "驳回" ? "驳回原因 *" : "审核说明（可选）" }}</span>
              <textarea
                v-model="审核意见"
                rows="3"
                :placeholder="
                  审核动作 === '驳回'
                    ? '请说明驳回原因，将记录在审批历史里。'
                    : '可补充说明，将记录在审批历史里。'
                "
              ></textarea>
            </label>
          </div>
          <footer>
            <button type="button" class="弹窗次要按钮" @click="关闭审核">取消</button>
            <button
              type="button"
              class="弹窗主要按钮"
              :class="{ 驳回确认: 审核动作 === '驳回' }"
              :disabled="提交中"
              @click="提交审核"
            >
              {{
                提交中
                  ? "提交中…"
                  : 审核动作 === "通过"
                    ? "确认通过"
                    : 审核动作 === "驳回"
                      ? "确认驳回"
                      : "确认提交"
              }}
            </button>
          </footer>
        </section>
      </div>
    </Teleport>
  </template>
</template>

<style scoped>
.报备动作 {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 32px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 8px;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}
.报备动作.大 {
  min-height: 38px;
  padding: 0 15px;
}
.报备动作:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.报备动作.通过 {
  border-color: #0b8d69;
  background: #0b8d69;
  color: #ffffff;
}
.报备动作.通过:hover {
  background: #0a7d5d;
}
.报备动作.驳回 {
  border-color: #f0c4c4;
  background: #fff2f2;
  color: #a72f2f;
}
.报备动作.驳回:hover {
  border-color: #e3a9a9;
}
.报备动作.重提 {
  border-color: #cfe1ff;
  background: #ffffff;
  color: #2367d1;
}
.报备动作.重提:hover {
  background: #f2f8ff;
}
.报备动作.转商机 {
  border-color: #cfe1ff;
  background: #f2f8ff;
  color: #2367d1;
}
.报备动作.转商机:hover {
  border-color: #9cc2f5;
}

.报备遮罩 {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(18, 33, 55, 0.42);
  backdrop-filter: blur(4px);
}
.报备弹窗 {
  width: min(520px, 96vw);
  overflow: hidden;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 24px 70px rgba(15, 32, 60, 0.24);
}
.报备弹窗 header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px;
  border-bottom: 1px solid #e7eef6;
}
.报备弹窗 h2 {
  margin: 0;
  color: #172b4d;
  font-size: 16px;
}
.报备弹窗 header p {
  margin: 5px 0 0;
  color: #75869a;
  font-size: 11px;
}
.报备弹窗 header button {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  color: #75869a;
  background: #f2f5f9;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}
.报备表单 {
  display: grid;
  gap: 12px;
  padding: 20px;
}
.报备说明 {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid #cfe1ff;
  border-radius: 8px;
  color: #33506f;
  background: #f2f8ff;
  font-size: 11px;
  line-height: 1.6;
}
.报备表单 label {
  display: grid;
  gap: 7px;
  color: #425970;
  font-size: 11px;
  font-weight: 700;
}
.报备表单 textarea {
  box-sizing: border-box;
  width: 100%;
  padding: 9px 10px;
  border: 1px solid #d5e1ee;
  border-radius: 8px;
  color: #172b4d;
  background: #ffffff;
  font: inherit;
  font-size: 11px;
  resize: vertical;
}
.报备弹窗 footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid #e7eef6;
}
.弹窗次要按钮,
.弹窗主要按钮 {
  min-height: 32px;
  padding: 0 14px;
  border-radius: 8px;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}
.弹窗次要按钮 {
  border: 1px solid #d5e1ee;
  background: #ffffff;
  color: #34495f;
}
.弹窗主要按钮 {
  border: 0;
  background: #2367d1;
  color: #ffffff;
}
.弹窗主要按钮.驳回确认 {
  background: #cf3636;
}
.弹窗主要按钮:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
