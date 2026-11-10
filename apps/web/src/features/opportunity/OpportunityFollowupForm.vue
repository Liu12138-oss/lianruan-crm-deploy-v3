<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, reactive, ref, watch } from "vue";

import {
  上传商机跟进附件,
  type 商机跟进附件,
  更新商机,
  type 阶段9记录,
} from "../../api/business-client.js";
import { 文本 } from "../../shared/format/business-format.js";
import {
  商机七阶段,
  商机终止状态,
  商机阶段文案,
  type 商机阶段键,
  映射商机阶段,
  查找商机阶段,
} from "../../shared/stages/opportunity-stage.js";

const props = withDefaults(
  defineProps<{
    商机: 阶段9记录;
    紧凑?: boolean;
    可推进阶段?: boolean;
  }>(),
  {
    紧凑: false,
    可推进阶段: false,
  },
);

const emit = defineEmits<{
  保存成功: [商机: 阶段9记录];
  取消: [];
}>();

const 提交中 = ref(false);
const 上传中 = ref(false);
const 附件输入 = ref<HTMLInputElement | null>(null);
const 已选附件 = ref<File[]>([]);
const 表单 = reactive({
  跟进方式: "电话沟通",
  本次沟通内容: "",
  下一步计划: "",
  目标阶段: "",
  变更原因: "",
});

const 跟进方式选项 = ["电话沟通", "现场拜访", "线上会议", "微信沟通", "客户反馈"];
const 附件扩展名 = /\.(pdf|docx?|xlsx?|png|jpe?g|zip)$/i;
const 附件上限 = 10 * 1024 * 1024;

function 原始(row: 阶段9记录 | null | undefined): Record<string, unknown> {
  return (row?.原始数据 as Record<string, unknown>) || {};
}

function 字段(row: 阶段9记录 | null | undefined, ...键列表: string[]): string {
  const 数据 = 原始(row);
  return 文本(...键列表.map((键) => 数据[键]), ...键列表.map((键) => (row as never)?.[键]));
}

function 阶段键(row: 阶段9记录 | null | undefined): 商机阶段键 {
  return 映射商机阶段(字段(row, "stage", "stageCode", "stage_code"), row?.状态, row?.状态名称);
}

function 阶段提交值(键: 商机阶段键): string {
  if (键 === "lost" || 键 === "cancelled") return 键;
  if (键 === "project_approval") return "70";
  return 查找商机阶段(键)?.提交阶段 || 字段(props.商机, "stage", "stageCode") || "registered";
}

const 当前阶段值 = computed(() => 阶段提交值(阶段键(props.商机)));
const 阶段选项 = computed(() => {
  const 当前键 = 阶段键(props.商机);
  if (当前键 === "won" || 当前键 === "lost" || 当前键 === "cancelled") return [];
  const 当前序号 = 商机七阶段.findIndex((阶段) => 阶段.键 === 当前键);
  const 下一阶段 = 商机七阶段[当前序号 + 1];
  return [
    ...(下一阶段
      ? [
          {
            值: 下一阶段.键 === "project_approval" ? "70" : 下一阶段.提交阶段,
            文案: 下一阶段.名称,
          },
        ]
      : []),
    ...商机终止状态.map((状态) => ({ 值: 状态.键, 文案: 状态.名称 })),
  ];
});
const 阶段已变更 = computed(() => Boolean(表单.目标阶段) && 表单.目标阶段 !== 当前阶段值.value);
const 当前阶段名称 = computed(() => {
  const 键 = 阶段键(props.商机);
  return 商机阶段文案(键) || 字段(props.商机, "rawStageName") || "未设置阶段";
});

function 重置表单() {
  表单.跟进方式 = "电话沟通";
  表单.本次沟通内容 = "";
  表单.下一步计划 = "";
  表单.目标阶段 = "";
  表单.变更原因 = "";
  已选附件.value = [];
  if (附件输入.value) 附件输入.value.value = "";
}

function 打开附件选择(): void {
  if (提交中.value || 上传中.value) return;
  附件输入.value?.click();
}

function 处理附件选择(event: Event): void {
  const 输入 = event.target as HTMLInputElement;
  const 新文件 = Array.from(输入.files || []);
  输入.value = "";
  for (const 文件 of 新文件) {
    if (!附件扩展名.test(文件.name)) {
      ElMessage.warning(`附件「${文件.name}」格式不支持。`);
      continue;
    }
    if (文件.size > 附件上限) {
      ElMessage.warning(`附件「${文件.name}」超过 10MB。`);
      continue;
    }
    if (已选附件.value.length >= 5) {
      ElMessage.warning("单次跟进最多上传 5 个附件。");
      break;
    }
    if (已选附件.value.some((项) => 项.name === 文件.name && 项.size === 文件.size)) continue;
    已选附件.value.push(文件);
  }
}

function 移除附件(序号: number): void {
  已选附件.value.splice(序号, 1);
}

watch(
  () => props.商机.id,
  () => 重置表单(),
);

async function 提交() {
  if (提交中.value) return;
  const 内容 = 表单.本次沟通内容.trim();
  if (!内容) {
    ElMessage.warning("请填写本次沟通内容。");
    return;
  }
  if (阶段已变更.value && !表单.变更原因.trim()) {
    ElMessage.warning("推进阶段时必须填写变更原因。");
    return;
  }
  提交中.value = true;
  try {
    const 已上传附件: 商机跟进附件[] = [];
    if (已选附件.value.length) {
      上传中.value = true;
      for (const 文件 of 已选附件.value) {
        已上传附件.push(await 上传商机跟进附件(文件));
      }
    }
    const 目标阶段 = 表单.目标阶段 || 当前阶段值.value;
    const 更新后 = await 更新商机(props.商机.id, {
      stage: 目标阶段,
      followup: 内容,
      followupMethod: 表单.跟进方式,
      nextStep: 表单.下一步计划.trim(),
      followupAttachments: 已上传附件,
      changeReason: 阶段已变更.value ? 表单.变更原因.trim() : `记录商机跟进（${表单.跟进方式}）`,
    });
    ElMessage.success(阶段已变更.value ? "跟进已保存，商机阶段已更新。" : "商机跟进已保存。");
    emit("保存成功", 更新后);
    重置表单();
  } catch (异常) {
    ElMessage.error(异常 instanceof Error ? 异常.message : "商机跟进保存失败。");
  } finally {
    上传中.value = false;
    提交中.value = false;
  }
}
</script>

<template>
  <form class="opportunity-followup-form" :class="{ compact: 紧凑 }" @submit.prevent="提交">
    <div class="followup-form-head">
      <div>
        <strong>记录商机跟进</strong>
        <span>当前阶段：{{ 当前阶段名称 }}</span>
      </div>
      <button v-if="紧凑" type="button" class="text-button" @click="emit('取消')">收起</button>
    </div>

    <div class="followup-fields">
      <label>
        <span>跟进方式</span>
        <select v-model="表单.跟进方式">
          <option v-for="方式 in 跟进方式选项" :key="方式" :value="方式">{{ 方式 }}</option>
        </select>
      </label>
      <label class="full">
        <span>本次沟通内容 *</span>
        <small class="followup-hint">
          需求挖掘填写越精准，越能提供更具体、细致、针对性的客户方案。
        </small>
        <textarea
          v-model="表单.本次沟通内容"
          :rows="紧凑 ? 3 : 4"
          maxlength="2000"
          placeholder="记录客户反馈、关键决策人、预算、时间计划或项目风险"
        ></textarea>
      </label>
      <label class="full">
        <span>下一步计划</span>
        <input
          v-model="表单.下一步计划"
          maxlength="500"
          placeholder="明确下一步动作、负责人和时间要求"
        />
      </label>
      <div class="followup-attachments full">
        <div class="followup-attachments-head">
          <span>跟进附件</span>
          <button type="button" class="text-button" :disabled="提交中" @click="打开附件选择">
            ＋ 添加附件
          </button>
        </div>
        <input
          ref="附件输入"
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip"
          hidden
          @change="处理附件选择"
        />
        <small class="followup-hint">
          支持 PDF、Word、Excel、图片或 ZIP，单个不超过 10MB，单次最多 5 个。
        </small>
        <div v-if="已选附件.length" class="followup-attachment-list">
          <span v-for="(文件, 序号) in 已选附件" :key="`${文件.name}-${文件.size}`">
            {{ 文件.name }}
            <button type="button" :disabled="提交中" @click="移除附件(序号)">移除</button>
          </span>
        </div>
      </div>
      <template v-if="可推进阶段 && 阶段选项.length">
        <label>
          <span>同步推进阶段（可选）</span>
          <select v-model="表单.目标阶段">
            <option value="">不推进阶段</option>
            <option v-for="阶段 in 阶段选项" :key="阶段.值" :value="阶段.值">
              {{ 阶段.文案 }}
            </option>
          </select>
        </label>
        <label v-if="阶段已变更">
          <span>变更原因 *</span>
          <input
            v-model="表单.变更原因"
            maxlength="500"
            placeholder="例如：客户确认技术方案，推进阶段"
          />
        </label>
      </template>
    </div>

    <div class="followup-form-actions">
      <button v-if="紧凑" type="button" class="button" @click="emit('取消')">取消</button>
      <button type="submit" class="button primary" :disabled="提交中">
        {{ 上传中 ? "上传附件中…" : 提交中 ? "保存中…" : "保存跟进" }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.opportunity-followup-form {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid #dbe7f4;
  border-radius: 12px;
  background: linear-gradient(145deg, #f8fbff, #ffffff);
}

.opportunity-followup-form.compact {
  gap: 8px;
  margin: 0 8px 8px;
  padding: 10px;
  border-radius: 9px;
  background: #f7fbff;
}

.followup-form-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.followup-form-head > div {
  display: grid;
  gap: 2px;
}

.followup-form-head strong {
  color: #1e3d68;
  font-size: 12px;
}

.followup-form-head span {
  color: #70839a;
  font-size: 11px;
}

.text-button {
  padding: 0;
  border: 0;
  background: transparent;
  color: #2f69ed;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

.followup-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 10px;
}

.compact .followup-fields {
  grid-template-columns: minmax(0, 1fr);
}

.followup-fields label {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.followup-fields label.full,
.followup-fields .full {
  grid-column: 1 / -1;
}

.followup-attachments {
  display: grid;
  gap: 5px;
  padding: 8px 10px;
  border: 1px dashed #cbdced;
  border-radius: 8px;
  background: #fbfdff;
}

.followup-attachments-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.followup-attachments-head > span {
  color: #5d7087;
  font-size: 11px;
  font-weight: 700;
}

.followup-attachment-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.followup-attachment-list > span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 4px 8px;
  border-radius: 6px;
  background: #edf4ff;
  color: #34577f;
  font-size: 11px;
}

.followup-attachment-list button {
  padding: 0;
  border: 0;
  background: transparent;
  color: #c04d59;
  font: inherit;
  cursor: pointer;
}

.followup-fields label > span {
  color: #5d7087;
  font-size: 11px;
  font-weight: 700;
}

.followup-hint {
  color: #7a8ca2;
  font-size: 11px;
  line-height: 1.55;
}

.followup-fields select,
.followup-fields input,
.followup-fields textarea {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  padding: 6px 9px;
  border: 1px solid #d5e2f0;
  border-radius: 7px;
  background: #ffffff;
  color: #1f3552;
  font: inherit;
  font-size: 11px;
}

.followup-fields textarea {
  min-height: 76px;
  resize: vertical;
  line-height: 1.6;
}

.followup-fields select:focus,
.followup-fields input:focus,
.followup-fields textarea:focus {
  border-color: #8eb4f3;
  outline: 2px solid rgba(47, 105, 237, 0.1);
}

.followup-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
