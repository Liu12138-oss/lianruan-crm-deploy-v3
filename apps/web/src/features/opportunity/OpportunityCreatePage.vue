<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import { 创建商机, 查询阶段9全部, type 阶段9记录 } from "../../api/business-client.js";
import { 业务类型选项, 记录业务类型 } from "../../shared/business/business-type.js";
import { 文本 } from "../../shared/format/business-format.js";
import { use外壳前缀 } from "../../shared/navigation/shell-prefix.js";
import { 商机七阶段 } from "../../shared/stages/opportunity-stage.js";

const 路由 = useRoute();
const 路由器 = useRouter();
const 外壳前缀 = use外壳前缀();
const 提交中 = ref(false);
const 步骤索引 = ref(0);
const 已通过报备 = ref<阶段9记录[]>([]);
const 订单列表 = ref<阶段9记录[]>([]);
const 商机来源选项 = [
  "渠道推荐",
  "市场活动",
  "老客户续约",
  "展会获客",
  "政府关系",
  "网络询盘",
  "其他",
];

const 表单 = reactive({
  报备编号: "",
  业务类型: "product" as "product" | "maintenance",
  关联产品订单: [] as string[],
  商机名称: "",
  阶段: 商机七阶段[0]?.提交阶段 || "registered",
  端点数量: "",
  预计金额: "",
  商机来源: "",
  预计签约时间: "",
  首次跟进: "",
});

const 步骤 = [
  { 标题: "关联报备客户", 说明: "仅可选择已审批客户" },
  { 标题: "商机信息", 说明: "阶段、金额和预计签约时间" },
  { 标题: "首次跟进", 说明: "记录线索来源和沟通情况" },
  { 标题: "确认提交", 说明: "校验并生成商机编号" },
];

const 选中报备 = computed(() => 已通过报备.value.find((报备) => 报备.id === 表单.报备编号) || null);
const 可关联产品订单 = computed(() => {
  const 客户名称 = 选中报备.value?.客户名称 || "";
  if (!客户名称) return [];
  return 订单列表.value.filter(
    (订单) =>
      记录业务类型(订单) === "product" &&
      订单.客户名称 === 客户名称 &&
      ["confirmed", "completed"].includes(文本(订单.状态)),
  );
});

const 提交校验 = computed(() => [
  { 标签: "已选择报备客户", 通过: Boolean(表单.报备编号) },
  {
    标签: "维保商机已关联产品订单",
    通过: 表单.业务类型 === "product" || 表单.关联产品订单.length > 0,
  },
  { 标签: "商机名称已填写", 通过: Boolean(表单.商机名称.trim()) },
  { 标签: "预计金额已填写", 通过: Number(表单.预计金额) > 0 },
  { 标签: "商机来源已选择", 通过: Boolean(表单.商机来源) },
  { 标签: "阶段已选择", 通过: Boolean(表单.阶段) },
]);

const 通过数量 = computed(() => 提交校验.value.filter((项) => 项.通过).length);
const 当前阶段文案 = computed(
  () => 商机七阶段.find((项) => 项.提交阶段 === 表单.阶段)?.名称 || "客户建联（10%）",
);

onMounted(async () => {
  try {
    const [报备结果, 订单结果] = await Promise.all([
      查询阶段9全部("registrations", { status: "approved" }),
      查询阶段9全部("orders").catch(() => ({ 数据: [] as 阶段9记录[], 总数: 0 })),
    ]);
    已通过报备.value = 报备结果.数据;
    订单列表.value = 订单结果.数据;
    // 从客户报备页「报备商机」带 registrationId 进入时，预选对应报备客户。
    const 指定报备 = String(路由.query.registrationId || "");
    if (指定报备 && 已通过报备.value.some((报备) => 报备.id === 指定报备)) {
      表单.报备编号 = 指定报备;
    }
  } catch {
    已通过报备.value = [];
  }
});

async function 提交() {
  if (提交中.value) return;
  if (通过数量.value < 提交校验.value.length) {
    ElMessage.warning("请先补全必填项");
    return;
  }
  提交中.value = true;
  try {
    await 创建商机({
      registrationId: 表单.报备编号,
      businessTypeCode: 表单.业务类型,
      linkedProductOrderIds: 表单.业务类型 === "maintenance" ? 表单.关联产品订单 : [],
      name: 表单.商机名称,
      amount: Number(表单.预计金额),
      stage: 表单.阶段,
      source: 表单.商机来源,
      endpoints: 表单.端点数量.trim(),
      expectedClose: 表单.预计签约时间,
      ...(表单.首次跟进 ? { notes: 表单.首次跟进 } : {}),
    });
    ElMessage.success("商机已创建");
    路由器.push(`${外壳前缀.value}/opportunity`);
  } catch (异常) {
    ElMessage.error(异常 instanceof Error ? 异常.message : "创建商机失败。");
  } finally {
    提交中.value = false;
  }
}
</script>

<template>
  <div class="vui war-artboard-plain 新建商机页">
    <header class="war-form-head">
      <div>
        <button class="返回按钮" type="button" @click="路由器.push(`${外壳前缀}/opportunity`)">
          ← 返回商机列表
        </button>
        <h1>新建商机</h1>
        <p>商机必须关联已审批的报备客户，同一客户可创建多个商机。</p>
      </div>
      <div class="button-row">
        <button type="button" class="button primary" :disabled="提交中" @click="提交">
          创建商机
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
            <div class="section-head"><strong>关联报备客户</strong><span>保护期内客户</span></div>
            <div class="section-body">
              <div class="form-grid">
                <div class="form-field full">
                  <label class="form-label required">客户</label>
                  <select class="form-control" v-model="表单.报备编号">
                    <option value="">请选择已通过审核的报备客户</option>
                    <option v-for="报备 in 已通过报备" :key="报备.id" :value="报备.id">
                      {{ 文本(报备.客户名称, 报备.标题) }}（{{ 报备.编号 }}）
                    </option>
                  </select>
                  <div class="helper">
                    {{
                      选中报备
                        ? `报备编号 ${选中报备.编号}，客户 ${文本(选中报备.客户名称)}`
                        : `当前有 ${已通过报备.length} 条已通过报备可选`
                    }}
                  </div>
                </div>
              </div>
              <div v-if="选中报备" class="info-grid" style="margin-top: 10px">
                <div class="info-item">
                  <span>联系人</span
                  ><strong>{{ 文本(选中报备.原始数据?.contact, "未填写") }}</strong>
                </div>
                <div class="info-item">
                  <span>联系电话</span
                  ><strong>{{ 文本(选中报备.原始数据?.phone, "未填写") }}</strong>
                </div>
                <div class="info-item">
                  <span>所属行业</span
                  ><strong>{{ 文本(选中报备.原始数据?.industry, "未填写") }}</strong>
                </div>
                <div class="info-item">
                  <span>归属渠道</span><strong>{{ 文本(选中报备.渠道名称, "未填写") }}</strong>
                </div>
              </div>
            </div>
          </section>

          <section class="section">
            <div class="section-head">
              <strong>商机信息</strong><span>阶段、金额和预计签约时间由业务填写</span>
            </div>
            <div class="section-body">
              <div class="form-grid">
                <div class="form-field full">
                  <label class="form-label required">商机名称</label>
                  <input
                    class="form-control"
                    v-model="表单.商机名称"
                    placeholder="如：终端安全改造项目"
                  />
                </div>
                <div class="form-field">
                  <label class="form-label required">当前阶段</label>
                  <select class="form-control" v-model="表单.阶段">
                    <option v-for="阶段 in 商机七阶段" :key="阶段.键" :value="阶段.提交阶段">
                      {{ 阶段.名称 }}
                    </option>
                  </select>
                </div>
                <div class="form-field">
                  <label class="form-label required">业务类型</label>
                  <select class="form-control" v-model="表单.业务类型">
                    <option v-for="类型 in 业务类型选项" :key="类型.代码" :value="类型.代码">
                      {{ 类型.名称 }} · {{ 类型.说明 }}
                    </option>
                  </select>
                </div>
                <div v-if="表单.业务类型 === 'maintenance'" class="form-field full">
                  <label class="form-label required">关联产品订单</label>
                  <select class="form-control" v-model="表单.关联产品订单" multiple size="5">
                    <option v-for="订单 in 可关联产品订单" :key="订单.id" :value="订单.id">
                      {{ 文本(订单.编号, "未编号") }} · {{ 订单.金额 }} ·
                      {{ 文本(订单.客户名称, "未关联客户") }}
                    </option>
                  </select>
                  <div class="helper">
                    仅可选择同一客户、已确认或已完成的产品订单，可多选；不要求同区域或同渠道。
                  </div>
                </div>
                <div class="form-field">
                  <label class="form-label">端点数量</label>
                  <input class="form-control" v-model="表单.端点数量" placeholder="选填" />
                </div>
                <div class="form-field">
                  <label class="form-label required">预计金额（元）</label>
                  <input class="form-control" v-model="表单.预计金额" placeholder="如 428000" />
                </div>
                <div class="form-field">
                  <label class="form-label required">商机来源</label>
                  <select class="form-control" v-model="表单.商机来源">
                    <option value="" disabled>请选择商机来源</option>
                    <option v-for="来源 in 商机来源选项" :key="来源" :value="来源">
                      {{ 来源 }}
                    </option>
                  </select>
                </div>
                <div class="form-field">
                  <label class="form-label">预计签约时间</label>
                  <el-date-picker
                    v-model="表单.预计签约时间"
                    type="date"
                    value-format="YYYY-MM-DD"
                    placeholder="选择预计签约时间"
                    style="width: 100%"
                  />
                </div>
                <div class="form-field full">
                  <label class="form-label">首次跟进记录</label>
                  <textarea
                    class="form-control"
                    rows="3"
                    v-model="表单.首次跟进"
                    placeholder="记录沟通情况与下一步计划"
                  ></textarea>
                </div>
              </div>
            </div>
          </section>
        </main>

        <aside class="wizard-aside">
          <article class="right-card highlight">
            <div class="right-card-title"><strong>阶段口径</strong><span>标准流程</span></div>
            <div class="step-list">
              <div
                v-for="(阶段, 序号) in 商机七阶段"
                :key="阶段.键"
                class="step-item"
                :class="{
                  active: 阶段.提交阶段 === 表单.阶段,
                  done: 商机七阶段.findIndex((项) => 项.提交阶段 === 表单.阶段) > 序号,
                }"
              >
                <span class="step-no">{{ 序号 + 1 }}</span>
                <div>
                  <strong>{{ 阶段.名称 }}</strong
                  ><span>{{ 阶段.进度 }}</span>
                </div>
              </div>
            </div>
          </article>

          <article class="right-card">
            <div class="right-card-title"><strong>服务端自动生成</strong><span>只读</span></div>
            <div class="info-grid">
              <div class="info-item"><span>商机编号</span><strong>系统生成</strong></div>
              <div class="info-item"><span>归属渠道</span><strong>当前客户渠道</strong></div>
              <div class="info-item"><span>负责人</span><strong>当前账号</strong></div>
              <div class="info-item"><span>创建时间</span><strong>提交时生成</strong></div>
            </div>
          </article>

          <article class="right-card">
            <div class="right-card-title">
              <strong>提交前检查</strong><span>{{ 通过数量 }} / {{ 提交校验.length }}</span>
            </div>
            <div
              v-for="项 in 提交校验"
              :key="项.标签"
              class="callout"
              :class="项.通过 ? 'success' : 'warning'"
              style="margin-top: 6px"
            >
              {{ 项.标签 }}{{ 项.通过 ? " 已通过" : " 待补充" }}
            </div>
            <div class="callout" style="margin-top: 8px">当前阶段：{{ 当前阶段文案 }}</div>
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

.新建商机页 :deep(.form-control) {
  min-height: 32px;
  padding: 6px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #ffffff;
  font: inherit;
  font-size: 11px;
}
</style>
