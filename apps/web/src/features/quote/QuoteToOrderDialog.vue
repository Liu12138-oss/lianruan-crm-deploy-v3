<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, reactive, ref, watch } from "vue";

import { 创建报价转订单, type 阶段9记录 } from "../../api/business-client.js";
import { 文本, 金额文本 } from "../../shared/format/business-format.js";

const 属性 = defineProps<{
  报价: 阶段9记录;
}>();

const 发出 = defineEmits<{
  关闭: [];
  成功: [订单: 阶段9记录];
}>();

const 提交中 = ref(false);
const 错误 = ref("");
const 合同文件 = ref<File[]>([]);
const 文件输入 = ref<HTMLInputElement | null>(null);

const 表单 = reactive({
  收货人: "",
  联系电话: "",
  详细地址: "",
  出货金额: "",
});

const 原始数据 = computed<Record<string, unknown>>(
  () => (属性.报价.原始数据 as Record<string, unknown>) || {},
);
const 报价类型 = computed(() => 文本(原始数据.value.quoteTypeCode, "channel_distribution"));
const 是标准报价 = computed(() => 报价类型.value === "standard");
const 报价类型名称 = computed(() =>
  文本(原始数据.value.quoteTypeName, 是标准报价.value ? "标准产品报价" : "渠道分销产品报价"),
);
const 渠道层级 = computed(() =>
  文本(原始数据.value.partnerLevel, 原始数据.value.submittedPartnerLevel),
);
const 是一级渠道 = computed(() => 渠道层级.value === "primary");
const 渠道层级名称 = computed(() => {
  const 映射: Record<string, string> = {
    primary: "一级分销",
    secondary: "二级分销",
    none: "无分销层级",
  };
  return 映射[渠道层级.value] || "未设置";
});
const 报价编号 = computed(() => 文本(属性.报价.编号, 原始数据.value.quoteNo, "未编号"));
const 报价金额 = computed(() => (是标准报价.value ? "待区管定价" : 金额文本(属性.报价.金额)));

function 大小文本(大小: number): string {
  if (大小 >= 1024 * 1024) return `${(大小 / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(大小 / 1024))} KB`;
}

function 读取附件(事件: Event) {
  const 输入 = 事件.target as HTMLInputElement | null;
  const 文件列表 = Array.from(输入?.files || []);
  if (!文件列表.length) return;
  const 允许扩展名 = /\.(pdf|doc|docx|xls|xlsx|png|jpe?g)$/i;
  const 新增: File[] = [];
  for (const 文件 of 文件列表) {
    if (!允许扩展名.test(文件.name)) {
      ElMessage.warning(`附件「${文件.name}」格式不支持，仅可选择图片、PDF、Word 或 Excel。`);
      continue;
    }
    if (文件.size <= 0 || 文件.size > 20 * 1024 * 1024) {
      ElMessage.warning(`附件「${文件.name}」必须大于 0 且不超过 20 MB。`);
      continue;
    }
    const 已存在 = 合同文件.value.some(
      (现有) =>
        现有.name === 文件.name &&
        现有.size === 文件.size &&
        现有.lastModified === 文件.lastModified,
    );
    if (!已存在) 新增.push(文件);
  }
  const 合并 = [...合同文件.value, ...新增];
  if (合并.length > 10) {
    ElMessage.warning("每张订单最多上传 10 个合同附件。");
    合同文件.value = 合并.slice(0, 10);
  } else {
    合同文件.value = 合并;
  }
  if (输入) 输入.value = "";
}

function 移除附件(索引: number) {
  合同文件.value = 合同文件.value.filter((_, 位置) => 位置 !== 索引);
}

function 关闭() {
  if (提交中.value) return;
  发出("关闭");
}

function 显示错误(消息: string) {
  错误.value = 消息;
  ElMessage.error(消息);
}

async function 提交() {
  if (提交中.value) return;
  错误.value = "";
  try {
    const 收货人 = 表单.收货人.trim();
    const 联系电话 = 表单.联系电话.trim();
    const 详细地址 = 表单.详细地址.trim();
    if (!收货人) {
      显示错误("请填写收货人。");
      return;
    }
    if (!/^[0-9+\-\s()]{6,24}$/.test(联系电话)) {
      显示错误("请填写有效的收货联系电话。");
      return;
    }
    if (!详细地址) {
      显示错误("请填写详细收货地址。");
      return;
    }
    const 出货金额文本 = String(表单.出货金额 ?? "").trim();
    const 出货金额 = 出货金额文本 === "" ? null : Number(出货金额文本);
    if (出货金额 !== null && (!Number.isFinite(出货金额) || 出货金额 < 0)) {
      显示错误("出货金额必须是大于或等于 0 的有效数字。");
      return;
    }
    if (是一级渠道.value && 出货金额 === null) {
      显示错误("一级渠道商转订单必须填写出货金额。");
      return;
    }
    if (是一级渠道.value && !合同文件.value.length) {
      显示错误("一级渠道商转订单必须上传至少 1 个合同附件。");
      return;
    }
    提交中.value = true;
    const 订单 = await 创建报价转订单(
      属性.报价.id,
      {
        recipientName: 收货人,
        recipientPhone: 联系电话,
        deliveryAddress: 详细地址,
        ...(出货金额 === null ? {} : { shipmentAmount: 出货金额 }),
      },
      合同文件.value,
    );
    ElMessage.success(`报价已转为订单：${文本(订单.编号, "订单已创建")}`);
    发出("成功", 订单);
  } catch (异常) {
    显示错误(异常 instanceof Error ? 异常.message : "报价转订单失败，请稍后重试。");
  } finally {
    提交中.value = false;
  }
}

watch(
  () => 属性.报价.id,
  () => {
    表单.收货人 = "";
    表单.联系电话 = "";
    表单.详细地址 = "";
    表单.出货金额 = "";
    合同文件.value = [];
    错误.value = "";
  },
  { immediate: true },
);
</script>

<template>
  <Teleport to="body">
    <div class="报价转订单遮罩" @click.self="关闭">
      <section
        class="报价转订单弹窗"
        role="dialog"
        aria-modal="true"
        aria-labelledby="报价转订单标题"
      >
        <header>
          <div>
            <span class="弹窗标签">报价转订单</span>
            <h2 id="报价转订单标题">{{ 报价编号 }}</h2>
            <p>{{ 文本(属性.报价.客户名称, "未关联客户") }} · {{ 报价类型名称 }}</p>
          </div>
          <button type="button" class="关闭按钮" aria-label="关闭" :disabled="提交中" @click="关闭">
            ×
          </button>
        </header>

        <div class="弹窗主体">
          <section class="转单摘要">
            <div>
              <span>报价金额</span>
              <strong :class="{ 待定价: 是标准报价 }">{{ 报价金额 }}</strong>
            </div>
            <div>
              <span>渠道层级</span>
              <strong>{{ 渠道层级名称 }}</strong>
            </div>
            <div>
              <span>归属渠道</span>
              <strong>{{ 文本(属性.报价.渠道名称, "未归属渠道") }}</strong>
            </div>
          </section>

          <p v-if="是标准报价" class="转单提示">
            标准产品报价不展示价格。订单创建后由区管在审批环节补充最终订单价格，未补价不能继续提交。
          </p>
          <p v-else class="转单提示">
            请核对报价金额、出货金额与合同附件。负利润允许录入，订单详情会以风险样式提示。
          </p>

          <div class="转单表单">
            <label>
              <span>收货人 *</span>
              <input v-model="表单.收货人" maxlength="80" placeholder="请输入收货人姓名" />
            </label>
            <label>
              <span>联系电话 *</span>
              <input
                v-model="表单.联系电话"
                maxlength="24"
                inputmode="tel"
                placeholder="请输入手机号或座机"
              />
            </label>
            <label class="全宽">
              <span>详细收货地址 *</span>
              <textarea
                v-model="表单.详细地址"
                maxlength="500"
                rows="3"
                placeholder="请输入省、市、区县、街道和门牌信息"
              ></textarea>
            </label>
            <label class="全宽">
              <span>
                出货金额
                <em v-if="是一级渠道">* 一级渠道必填</em>
                <em v-else>（选填）</em>
              </span>
              <div class="金额输入">
                <span>¥</span>
                <input
                  v-model="表单.出货金额"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="请输入出货金额"
                />
              </div>
            </label>
            <div class="全宽 附件区域">
              <div class="附件标题">
                <span>
                  合同附件
                  <em v-if="是一级渠道">* 一级渠道至少 1 个</em>
                  <em v-else>（选填）</em>
                </span>
                <small>支持 JPG、PNG、PDF、Word、Excel，单个不超过 20 MB，最多 10 个</small>
              </div>
              <input
                ref="文件输入"
                class="隐藏文件输入"
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                @change="读取附件"
              />
              <button type="button" class="选择附件按钮" @click="文件输入?.click()">
                ＋ 选择合同文件
              </button>
              <div v-if="合同文件.length" class="附件列表">
                <div v-for="(文件, 索引) in 合同文件" :key="`${文件.name}-${文件.lastModified}`">
                  <span class="附件图标">文</span>
                  <div>
                    <strong>{{ 文件.name }}</strong>
                    <small>{{ 大小文本(文件.size) }}</small>
                  </div>
                  <button type="button" @click="移除附件(索引)">移除</button>
                </div>
              </div>
            </div>
          </div>

          <p v-if="错误" class="转单错误">{{ 错误 }}</p>
        </div>

        <footer>
          <button type="button" class="次要按钮" :disabled="提交中" @click="关闭">取消</button>
          <button type="button" class="主按钮" :disabled="提交中" @click="提交">
            {{ 提交中 ? "正在转订单…" : "确认转订单" }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.报价转订单遮罩 {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(18, 33, 55, 0.46);
  backdrop-filter: blur(4px);
}

.报价转订单弹窗 {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: min(760px, 96vw);
  max-height: min(90vh, 900px);
  overflow: hidden;
  border: 1px solid #d7e4f1;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 28px 80px rgba(15, 32, 60, 0.3);
}

.报价转订单弹窗 > header,
.报价转订单弹窗 > footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 22px;
  border-bottom: 1px solid #e7eef6;
}

.报价转订单弹窗 > footer {
  justify-content: flex-end;
  border-top: 1px solid #e7eef6;
  border-bottom: 0;
  background: #fbfdff;
}

.报价转订单弹窗 h2 {
  margin: 4px 0 3px;
  color: #172b4d;
  font-size: 18px;
  font-weight: 700;
}

.报价转订单弹窗 header p {
  margin: 0;
  color: #71839a;
  font-size: 11px;
}

.弹窗标签 {
  color: #2f69ed;
  font-size: 11px;
  font-weight: 700;
}

.关闭按钮 {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 0;
  border-radius: 8px;
  color: #71839a;
  background: #f1f5fa;
  font-size: 20px;
  cursor: pointer;
}

.弹窗主体 {
  display: grid;
  gap: 16px;
  overflow-y: auto;
  padding: 20px 22px;
}

.转单摘要 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.转单摘要 div {
  display: grid;
  gap: 6px;
  min-width: 0;
  padding: 13px 14px;
  border: 1px solid #dce8f5;
  border-radius: 9px;
  background: #f8fbff;
}

.转单摘要 span,
.转单摘要 strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.转单摘要 span {
  color: #7a8ba0;
  font-size: 11px;
}

.转单摘要 strong {
  color: #1f3552;
  font-size: 14px;
}

.转单摘要 strong.待定价 {
  color: #a46400;
}

.转单提示 {
  margin: 0;
  padding: 11px 13px;
  border: 1px solid #cfe1ff;
  border-radius: 9px;
  color: #315276;
  background: #f2f8ff;
  font-size: 11px;
  line-height: 1.65;
}

.转单表单 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 15px 16px;
}

.转单表单 label,
.附件区域 {
  display: grid;
  gap: 7px;
  min-width: 0;
}

.转单表单 label > span,
.附件标题 > span {
  color: #53677f;
  font-size: 11px;
  font-weight: 700;
}

.转单表单 em,
.附件标题 em {
  color: #8b9aab;
  font-size: 11px;
  font-style: normal;
  font-weight: 400;
}

.转单表单 input,
.转单表单 textarea {
  width: 100%;
  min-height: 40px;
  padding: 9px 11px;
  border: 1px solid #cfdded;
  border-radius: 8px;
  color: #263b56;
  background: #fff;
  font: inherit;
  font-size: 11px;
  outline: 0;
}

.转单表单 textarea {
  min-height: 82px;
  resize: vertical;
  line-height: 1.6;
}

.转单表单 input:focus,
.转单表单 textarea:focus {
  border-color: #78a7ef;
  box-shadow: 0 0 0 3px rgba(47, 105, 237, 0.1);
}

.全宽 {
  grid-column: 1 / -1;
}

.金额输入 {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  align-items: center;
  border: 1px solid #cfdded;
  border-radius: 8px;
  background: #fff;
}

.金额输入 > span {
  display: grid;
  height: 100%;
  place-items: center;
  border-right: 1px solid #e3ebf4;
  color: #71839a;
  font-size: 12px;
}

.金额输入 input {
  border: 0;
  box-shadow: none;
}

.附件区域 {
  padding: 13px;
  border: 1px dashed #c8d9ec;
  border-radius: 10px;
  background: #fbfdff;
}

.附件标题 {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px 14px;
}

.附件标题 small {
  color: #8898aa;
  font-size: 11px;
}

.隐藏文件输入 {
  display: none;
}

.选择附件按钮 {
  justify-self: start;
  min-height: 34px;
  padding: 0 13px;
  border: 1px solid #b9d2f2;
  border-radius: 8px;
  color: #245cae;
  background: #f2f7ff;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.附件列表 {
  display: grid;
  gap: 7px;
}

.附件列表 > div {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  padding: 8px 9px;
  border: 1px solid #e1eaf4;
  border-radius: 8px;
  background: #fff;
}

.附件图标 {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 7px;
  color: #2f69ed;
  background: #eef5ff;
  font-size: 11px;
  font-weight: 700;
}

.附件列表 div div {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.附件列表 strong {
  overflow: hidden;
  color: #334b66;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.附件列表 small {
  color: #8898aa;
  font-size: 11px;
}

.附件列表 button {
  border: 0;
  color: #b53d49;
  background: transparent;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

.转单错误 {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid #efc6cb;
  border-radius: 8px;
  color: #a72f3b;
  background: #fff2f4;
  font-size: 11px;
  line-height: 1.6;
}

.主按钮,
.次要按钮 {
  min-height: 38px;
  padding: 0 16px;
  border-radius: 8px;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.主按钮 {
  border: 0;
  color: #fff;
  background: #2f69ed;
}

.次要按钮 {
  border: 1px solid #d2e0ef;
  color: #50657d;
  background: #fff;
}

.主按钮:disabled,
.次要按钮:disabled,
.关闭按钮:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

@media (max-width: 720px) {
  .转单摘要,
  .转单表单 {
    grid-template-columns: 1fr;
  }
}
</style>
