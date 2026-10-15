<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, ref } from "vue";

import WarKpis from "../../components/war/WarKpis.vue";
import WarLayout from "../../components/war/WarLayout.vue";
import WarRecordCard from "../../components/war/WarRecordCard.vue";
import type { 指标项 } from "../../components/war/types.js";

interface 线索记录 {
  id: string;
  标题: string;
  公告编号: string;
  采购单位: string;
  区域: string;
  行业: string;
  预算: number;
  发布时间: string;
  截止时间: string;
  来源: string;
  状态: "未处理" | "已关注" | "已忽略";
  重点: boolean;
  摘要: string;
  联系方式: string;
  抓取时间: string;
}

/**
 * 线索第一版只做 UI：数据为演示数据，采集与接口由独立模块提供。
 * 接口契约见 docs/tasks/ui-reconstruction-leadership-review/frontend-refactor-delivery/26-LEAD-MODULE-API-CONTRACT.md
 */
const 线索列表 = ref<线索记录[]>([
  {
    id: "ZB-2026-0918-001",
    标题: "湖南省某金融机构终端安全与数据防泄漏建设项目",
    公告编号: "HNSZ-2026-JC-0918",
    采购单位: "湖南某金融机构",
    区域: "湖南区 / 长沙市",
    行业: "金融",
    预算: 386,
    发布时间: "2026-09-18",
    截止时间: "2026-09-29 09:30",
    来源: "湖南公共资源交易平台",
    状态: "未处理",
    重点: true,
    摘要: "采购终端安全管理、数据防泄漏、准入控制和实施服务，要求原厂授权。",
    联系方式: "0731-****6688",
    抓取时间: "2026-09-23 09:12",
  },
  {
    id: "ZB-2026-0917-006",
    标题: "某高校智慧校园安全运营中心采购项目",
    公告编号: "JY-2026-0917-06",
    采购单位: "湖南某高校",
    区域: "湖南区 / 湘潭市",
    行业: "教育",
    预算: 218,
    发布时间: "2026-09-17",
    截止时间: "2026-09-28 14:00",
    来源: "中国政府采购网",
    状态: "已关注",
    重点: true,
    摘要: "建设统一安全运营中心，覆盖资产梳理、告警分析和应急处置能力。",
    联系方式: "0731-****2210",
    抓取时间: "2026-09-23 09:10",
  },
  {
    id: "ZB-2026-0915-012",
    标题: "某制造集团工业终端统一管控项目",
    公告编号: "GY-2026-0915-12",
    采购单位: "湖南某制造集团",
    区域: "湖南区 / 株洲市",
    行业: "制造",
    预算: 152,
    发布时间: "2026-09-15",
    截止时间: "2026-09-26 10:00",
    来源: "企业采购平台",
    状态: "未处理",
    重点: false,
    摘要: "采购工业终端管控、病毒防护和集中运维能力，包含三年维保。",
    联系方式: "0731-****1902",
    抓取时间: "2026-09-23 09:08",
  },
  {
    id: "ZB-2026-0912-003",
    标题: "某医院数据分类分级与安全治理项目",
    公告编号: "YY-2026-0912-03",
    采购单位: "湖南某三甲医院",
    区域: "湖南区 / 长沙市",
    行业: "医疗",
    预算: 96,
    发布时间: "2026-09-12",
    截止时间: "2026-09-25 15:00",
    来源: "中国政府采购网",
    状态: "已关注",
    重点: false,
    摘要: "开展数据分类分级、敏感数据识别和安全制度治理，要求驻场实施。",
    联系方式: "0731-****8876",
    抓取时间: "2026-09-23 09:05",
  },
  {
    id: "ZB-2026-0908-019",
    标题: "某园区网络安全设备扩容采购",
    公告编号: "YQ-2026-0908-19",
    采购单位: "湖南某产业园区",
    区域: "湖南区 / 岳阳市",
    行业: "园区",
    预算: 74,
    发布时间: "2026-09-08",
    截止时间: "2026-09-20 09:00",
    来源: "湖南公共资源交易平台",
    状态: "已忽略",
    重点: false,
    摘要: "采购边界防护和日志审计设备，项目已截止，保留检索记录。",
    联系方式: "0730-****3341",
    抓取时间: "2026-09-23 09:00",
  },
]);

const 当前标签 = ref("全部线索");
const 搜索词 = ref("");
const 选中编号 = ref(线索列表.value[0]?.id || "");
const 备注文本 = ref("");

const 标签列表 = ["全部线索", "待跟进"];

function 剩余天数(线索: 线索记录): number | null {
  const 截止 = new Date(线索.截止时间);
  if (Number.isNaN(截止.getTime())) return null;
  return Math.ceil((截止.getTime() - Date.now()) / 86400000);
}

const 过滤后列表 = computed(() => {
  let 列表 = 线索列表.value;
  if (当前标签.value === "待跟进") 列表 = 列表.filter((线索) => 线索.状态 === "未处理");
  const 关键词 = 搜索词.value.trim().toLowerCase();
  if (!关键词) return 列表;
  return 列表.filter((线索) =>
    [线索.标题, 线索.公告编号, 线索.采购单位, 线索.区域, 线索.行业, 线索.来源]
      .filter(Boolean)
      .some((值) => String(值).toLowerCase().includes(关键词)),
  );
});

const 当前线索 = computed(
  () => 线索列表.value.find((线索) => 线索.id === 选中编号.value) || 过滤后列表.value[0] || null,
);

const 指标 = computed<指标项[]>(() => {
  const 列表 = 线索列表.value;
  const 即将截止 = 列表.filter((线索) => {
    const 剩余 = 剩余天数(线索);
    return 剩余 !== null && 剩余 >= 0 && 剩余 <= 7;
  }).length;
  return [
    { label: "线索总量", value: String(列表.length), unit: "条", note: "演示数据（采集模块待接入）" },
    {
      label: "今日新增",
      value: String(列表.filter((线索) => 线索.发布时间 === "2026-09-18").length),
      unit: "条",
      note: "按发布日期统计",
    },
    {
      label: "待跟进线索",
      value: String(列表.filter((线索) => 线索.状态 === "未处理").length),
      unit: "条",
      note: "状态为未处理",
    },
    {
      label: "已关注",
      value: String(列表.filter((线索) => 线索.状态 === "已关注").length),
      unit: "条",
      note: "已标记关注",
    },
    { label: "即将截止", value: String(即将截止), unit: "条", note: "7 天内截止" },
    {
      label: "重点线索",
      value: String(列表.filter((线索) => 线索.重点).length),
      unit: "条",
      note: "已标记重点",
    },
  ];
});

function 切换关注() {
  if (!当前线索.value) return;
  当前线索.value.状态 = 当前线索.value.状态 === "已关注" ? "未处理" : "已关注";
  ElMessage.success(当前线索.value.状态 === "已关注" ? "已加入关注" : "已取消关注");
}

function 忽略() {
  if (!当前线索.value) return;
  当前线索.value.状态 = "已忽略";
  ElMessage.success("已忽略该线索");
}

function 保存备注() {
  ElMessage.success(`备注已记录：${备注文本.value || "（空）"}`);
  备注文本.value = "";
}
</script>

<template>
  <div class="vui war-artboard 线索中心页">
    <WarKpis :items="指标" />

    <WarLayout
      list-title="线索筛选"
      :list-count="String(过滤后列表.length)"
      search-placeholder="搜索公告标题、采购单位或编号"
      :tabs="标签列表"
      :active-tab="当前标签"
      v-model="搜索词"
      @切换标签="当前标签 = $event"
    >
      <template #list>
        <WarRecordCard
          v-for="线索 in 过滤后列表"
          :key="线索.id"
          :title="线索.标题"
          :meta="`${线索.采购单位} · ${线索.区域}`"
          :badge="线索.状态"
          :tone="线索.状态 === '已关注' ? 'green' : 线索.状态 === '已忽略' ? 'gray' : 'amber'"
          :owner="`${线索.来源} · ${线索.发布时间}`"
          :amount="线索.预算 ? `${线索.预算} 万` : '预算未公开'"
          :tags="[
            { text: 线索.行业 },
            {
              text: 剩余天数(线索) === null ? '截止未知' : `剩余 ${剩余天数(线索)} 天`,
              hot: (剩余天数(线索) ?? 999) <= 7,
            },
          ]"
          :active="当前线索?.id === 线索.id"
          @选择="选中编号 = 线索.id"
        />
        <div v-if="!过滤后列表.length" class="war-empty">当前条件下没有线索。</div>
      </template>

      <template #center>
        <template v-if="当前线索">
          <div class="war-center-head">
            <div class="deal-title">
              <strong>{{ 当前线索.标题 }}</strong>
              <span>
                {{ 当前线索.公告编号 }} · {{ 当前线索.采购单位 }} · {{ 当前线索.区域 }} ·
                {{ 当前线索.来源 }}
              </span>
            </div>
            <div class="center-actions">
              <button type="button" class="button" @click="切换关注">
                {{ 当前线索.状态 === "已关注" ? "取消关注" : "关注" }}
              </button>
              <button type="button" class="button" @click="忽略">忽略</button>
            </div>
          </div>

          <div class="extended-center-grid">
            <section class="panel">
              <header class="panel-head">
                <div><h2>公告详情</h2><p>招投标线索基础信息</p></div>
              </header>
              <div class="panel-body">
                <div class="info-grid">
                  <div class="info-item"><span>公告编号</span><strong>{{ 当前线索.公告编号 }}</strong></div>
                  <div class="info-item"><span>采购单位</span><strong>{{ 当前线索.采购单位 }}</strong></div>
                  <div class="info-item"><span>所属区域</span><strong>{{ 当前线索.区域 }}</strong></div>
                  <div class="info-item"><span>所属行业</span><strong>{{ 当前线索.行业 }}</strong></div>
                  <div class="info-item">
                    <span>预算</span><strong>{{ 当前线索.预算 ? `${当前线索.预算} 万` : "未公开" }}</strong>
                  </div>
                  <div class="info-item"><span>发布时间</span><strong>{{ 当前线索.发布时间 }}</strong></div>
                  <div class="info-item"><span>截止时间</span><strong>{{ 当前线索.截止时间 }}</strong></div>
                  <div class="info-item"><span>联系方式</span><strong>{{ 当前线索.联系方式 || "未公开" }}</strong></div>
                </div>
                <p class="war-note">{{ 当前线索.摘要 }}</p>
              </div>
            </section>

            <section class="panel">
              <header class="panel-head">
                <div><h2>线索备注</h2><p>第一版为前端记录，接口接入后持久化</p></div>
              </header>
              <div class="panel-body">
                <textarea v-model="备注文本" rows="4" placeholder="记录跟进要点、投标策略或联系人信息"></textarea>
                <button type="button" class="button primary" style="margin-top: 8px" @click="保存备注">
                  保存备注
                </button>
              </div>
            </section>
          </div>
        </template>
        <div v-else class="war-empty">请选择左侧线索查看详情。</div>
      </template>

      <template #right>
        <article v-if="当前线索" class="right-card highlight">
          <div class="right-card-title"><strong>实时快照</strong><span>线索</span></div>
          <div class="info-grid">
            <div class="info-item"><span>处理状态</span><strong>{{ 当前线索.状态 }}</strong></div>
            <div class="info-item">
              <span>预算</span><strong>{{ 当前线索.预算 ? `${当前线索.预算} 万` : "未公开" }}</strong>
            </div>
            <div class="info-item">
              <span>剩余天数</span>
              <strong>{{ 剩余天数(当前线索) === null ? "—" : `${剩余天数(当前线索)} 天` }}</strong>
            </div>
            <div class="info-item"><span>数据来源</span><strong>{{ 当前线索.来源 }}</strong></div>
          </div>
        </article>
        <article class="right-card">
          <div class="right-card-title"><strong>业务边界</strong><span>说明</span></div>
          <p class="war-note">
            线索管理为独立一级板块，第一版只做检索与轻量处理，不联动客户与商机；数据由外部采集模块归一化后提供。
          </p>
        </article>
      </template>
    </WarLayout>
  </div>
</template>

<style scoped>
.线索中心页 textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--text);
  font: inherit;
  font-size: 11px;
  resize: vertical;
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
