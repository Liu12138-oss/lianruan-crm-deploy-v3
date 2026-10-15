<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useRoute } from "vue-router";

import WarKpis from "../../components/war/WarKpis.vue";
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

interface 数据来源 {
  名称: string;
  类型: string;
  覆盖: string;
  频率: string;
  最近成功: string;
  状态: "正常" | "部分失败" | "暂停";
  新增: number;
  更新: number;
  失败: number;
}

const 路由 = useRoute();
const 搜索词 = ref("");
const 当前页签 = ref("全部");
const 当前区域 = ref("");
const 当前来源 = ref("");
const 当前状态 = ref("");
const 选中编号 = ref("ZB-2026-0918-001");
const 详情打开 = ref(false);
const 备注打开 = ref(false);
const 备注文本 = ref("");
const 导出中 = ref(false);
const 操作提示 = ref("");

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

const 数据来源列表: 数据来源[] = [
  {
    名称: "湖南公共资源交易平台",
    类型: "公共资源",
    覆盖: "湖南全省",
    频率: "每 30 分钟",
    最近成功: "今天 09:12",
    状态: "正常",
    新增: 128,
    更新: 18,
    失败: 0,
  },
  {
    名称: "中国政府采购网",
    类型: "政府采购",
    覆盖: "全国 / 湖南优先",
    频率: "每小时",
    最近成功: "今天 09:10",
    状态: "正常",
    新增: 346,
    更新: 42,
    失败: 0,
  },
  {
    名称: "企业采购平台",
    类型: "商业平台",
    覆盖: "重点行业",
    频率: "每 2 小时",
    最近成功: "今天 08:40",
    状态: "部分失败",
    新增: 57,
    更新: 12,
    失败: 3,
  },
  {
    名称: "人工导入",
    类型: "手工数据",
    覆盖: "按导入文件",
    频率: "按需",
    最近成功: "昨天 17:20",
    状态: "暂停",
    新增: 0,
    更新: 0,
    失败: 0,
  },
];

const 正在看来源页 = computed(() => 路由.path.endsWith("/sources"));

/** 线索指标：第一版为前端 UI + 演示数据，真实采集接入后替换数据源即可。 */
const 线索指标 = computed<指标项[]>(() => {
  const 列表 = 线索列表.value;
  const 七天内截止 = 列表.filter((项) => {
    const 截止 = new Date(项.截止时间);
    if (Number.isNaN(截止.getTime())) return false;
    const 剩余 = 截止.getTime() - Date.now();
    return 剩余 > 0 && 剩余 <= 7 * 86400000;
  }).length;
  return [
    { label: "线索总量", value: String(列表.length), unit: "条", note: "当前线索库" },
    { label: "今日新增", value: String(列表.filter((项) => 项.发布时间 === "2026-09-18").length), unit: "条", note: "按发布日期统计" },
    { label: "待处理", value: String(列表.filter((项) => 项.状态 === "未处理").length), unit: "条", note: "状态为未处理" },
    { label: "已关注", value: String(列表.filter((项) => 项.状态 === "已关注").length), unit: "条", note: "已标记关注" },
    { label: "7 天内截止", value: String(七天内截止), unit: "条", note: "投标截止时间临近" },
    { label: "数据来源", value: String(数据来源列表.length), unit: "个", note: "采集来源数量" },
  ];
});
const 总预算 = computed(() => 线索列表.value.reduce((合计, item) => 合计 + item.预算, 0));
const 过滤后列表 = computed(() => {
  const 关键词 = 搜索词.value.trim().toLowerCase();
  return 线索列表.value.filter((item) => {
    if (当前页签.value === "我的关注" && item.状态 !== "已关注") return false;
    if (当前页签.value === "待处理" && item.状态 !== "未处理") return false;
    if (当前页签.value === "即将截止" && !item.截止时间.startsWith("2026-09-2")) return false;
    if (当前区域.value && !item.区域.includes(当前区域.value)) return false;
    if (当前来源.value && item.来源 !== 当前来源.value) return false;
    if (当前状态.value && item.状态 !== 当前状态.value) return false;
    if (!关键词) return true;
    return [item.标题, item.采购单位, item.公告编号, item.行业].some((文本) =>
      文本.toLowerCase().includes(关键词),
    );
  });
});
const 当前线索 = computed(
  () => 过滤后列表.value.find((item) => item.id === 选中编号.value) || 过滤后列表.value[0] || null,
);
const 来源选项 = computed(() => [...new Set(线索列表.value.map((item) => item.来源))]);

function 切换页签(页签: string) {
  当前页签.value = 页签;
  const 第一条 = 过滤后列表.value[0];
  if (第一条) 选中编号.value = 第一条.id;
}

function 查看详情(item: 线索记录) {
  选中编号.value = item.id;
  详情打开.value = true;
}

function 切换关注(item: 线索记录 | null) {
  if (!item) return;
  item.状态 = item.状态 === "已关注" ? "未处理" : "已关注";
  操作提示.value = item.状态 === "已关注" ? "已加入我的关注。" : "已取消关注。";
}

function 忽略线索(item: 线索记录 | null) {
  if (!item) return;
  item.状态 = "已忽略";
  操作提示.value = "已忽略，可在全部线索中按状态重新查看。";
}

function 打开备注(item: 线索记录 | null) {
  if (!item) return;
  选中编号.value = item.id;
  备注文本.value = "";
  备注打开.value = true;
}

function 保存备注() {
  备注打开.value = false;
  操作提示.value = 备注文本.value.trim() ? "备注已保存到本地原型状态。" : "未填写备注。";
}

async function 导出结果() {
  导出中.value = true;
  await new Promise((完成) => window.setTimeout(完成, 500));
  导出中.value = false;
  操作提示.value = `已模拟导出 ${过滤后列表.value.length} 条线索，正式接口接入后生成任务文件。`;
}
</script>

<template>
  <section class="vui war-artboard-plain 线索页">
    <WarKpis :items="线索指标" />
    <header class="线索页头">
      <div>
        <span class="线索页标签">独立业务板块</span>
        <h1>线索管理</h1>
        <p>集中检索、筛选和查看外部招投标线索；第一版不联动客户与商机。</p>
      </div>
      <div class="线索页动作">
        <RouterLink class="线索按钮" :class="{ active: !正在看来源页 }" to="/admin/leads"
          >线索检索</RouterLink
        >
        <RouterLink class="线索按钮" :class="{ active: 正在看来源页 }" to="/admin/leads/sources"
          >数据来源</RouterLink
        >
        <button class="线索按钮 主按钮" type="button" :disabled="导出中" @click="导出结果">
          {{ 导出中 ? "导出中..." : "导出结果" }}
        </button>
      </div>
    </header>

    <div v-if="操作提示" class="线索提示">{{ 操作提示 }}</div>

    <template v-if="正在看来源页">
      <div class="线索指标">
        <article>
          <span>来源总数</span><strong>{{ 数据来源列表.length }}</strong
          ><small>含公共资源、政府采购和手工数据</small>
        </article>
        <article>
          <span>正常同步</span
          ><strong>{{ 数据来源列表.filter((item) => item.状态 === "正常").length }}</strong
          ><small>最近一次采集成功</small>
        </article>
        <article>
          <span>今日新增</span
          ><strong>{{ 数据来源列表.reduce((合计, item) => 合计 + item.新增, 0) }}</strong
          ><small>已归一化进入线索库</small>
        </article>
        <article>
          <span>失败任务</span
          ><strong class="风险">{{
            数据来源列表.reduce((合计, item) => 合计 + item.失败, 0)
          }}</strong
          ><small>需要重试或检查来源结构</small>
        </article>
      </div>

      <section class="来源面板">
        <div class="来源面板头">
          <div>
            <strong>数据来源与采集状态</strong
            ><span>爬虫由独立模块负责，UI 只消费标准化线索数据。</span>
          </div>
          <button
            class="线索按钮"
            type="button"
            @click="操作提示 = '已模拟立即采集任务；正式版本由采集调度模块返回任务编号。'"
          >
            立即采集
          </button>
        </div>
        <div class="来源表">
          <div class="来源表头">
            <span>来源名称</span><span>类型</span><span>覆盖区域</span><span>采集频率</span
            ><span>最近成功</span><span>新增 / 更新 / 失败</span><span>状态</span><span>操作</span>
          </div>
          <div v-for="来源 in 数据来源列表" :key="来源.名称" class="来源行">
            <strong>{{ 来源.名称 }}</strong>
            <span>{{ 来源.类型 }}</span>
            <span>{{ 来源.覆盖 }}</span>
            <span>{{ 来源.频率 }}</span>
            <span>{{ 来源.最近成功 }}</span>
            <span>{{ 来源.新增 }} / {{ 来源.更新 }} / {{ 来源.失败 }}</span>
            <span class="来源状态" :class="来源.状态">{{ 来源.状态 }}</span>
            <button
              class="文本按钮"
              type="button"
              @click="操作提示 = `${来源.名称}：已打开采集日志原型。`"
            >
              采集日志
            </button>
          </div>
        </div>
      </section>
    </template>

    <template v-else>
      <div class="线索指标">
        <article>
          <span>线索总量</span><strong>{{ 线索列表.length }}</strong
          ><small>当前仅展示原型 mock 数据</small>
        </article>
        <article><span>今日新增</span><strong>3</strong><small>较昨日增加 1 条</small></article>
        <article>
          <span>重点线索</span><strong>{{ 线索列表.filter((item) => item.重点).length }}</strong
          ><small>需要优先查看和判断</small>
        </article>
        <article>
          <span>估算预算</span><strong>{{ 总预算 }} 万</strong><small>仅汇总当前 mock 结果</small>
        </article>
      </div>

      <section class="检索布局">
        <aside class="筛选面板">
          <div class="面板标题">
            <strong>筛选条件</strong
            ><button
              type="button"
              @click="
                搜索词 = '';
                当前区域 = '';
                当前来源 = '';
                当前状态 = '';
              "
            >
              重置
            </button>
          </div>
          <label
            ><span>关键词</span><input v-model="搜索词" placeholder="标题、采购单位、编号"
          /></label>
          <label
            ><span>区域</span
            ><select v-model="当前区域">
              <option value="">全部区域</option>
              <option>湖南区</option>
            </select></label
          >
          <label
            ><span>行业</span
            ><select>
              <option>全部行业</option>
              <option>金融</option>
              <option>教育</option>
              <option>制造</option>
              <option>医疗</option>
              <option>园区</option>
            </select></label
          >
          <label
            ><span>数据来源</span
            ><select v-model="当前来源">
              <option value="">全部来源</option>
              <option v-for="来源 in 来源选项" :key="来源">{{ 来源 }}</option>
            </select></label
          >
          <label
            ><span>处理状态</span
            ><select v-model="当前状态">
              <option value="">全部状态</option>
              <option>未处理</option>
              <option>已关注</option>
              <option>已忽略</option>
            </select></label
          >
          <label
            ><span>预算范围</span
            ><select>
              <option>不限预算</option>
              <option>100 万以下</option>
              <option>100-300 万</option>
              <option>300 万以上</option>
            </select></label
          >
          <div class="筛选备注">客户与商机关联将在后续版本开放，本版筛选不依赖客户档案。</div>
        </aside>

        <main class="线索主区">
          <nav class="线索页签">
            <button
              v-for="页签 in ['全部', '待处理', '我的关注', '即将截止']"
              :key="页签"
              :class="{ active: 当前页签 === 页签 }"
              type="button"
              @click="切换页签(页签)"
            >
              {{ 页签 }}
            </button>
          </nav>
          <div class="线索表头">
            <span>公告标题 / 编号</span><span>采购单位</span><span>区域 / 行业</span
            ><span>预算</span><span>截止时间</span><span>来源</span><span>状态</span
            ><span>操作</span>
          </div>
          <div class="线索表体">
            <div
              v-for="线索 in 过滤后列表"
              :key="线索.id"
              class="线索行"
              :class="{ active: 当前线索?.id === 线索.id }"
              role="button"
              tabindex="0"
              @click="选中编号 = 线索.id"
              @keydown.enter="选中编号 = 线索.id"
            >
              <span class="线索标题"
                ><strong>{{ 线索.标题 }}</strong
                ><small>{{ 线索.公告编号 }} · {{ 线索.重点 ? "重点" : 线索.行业 }}</small></span
              >
              <span>{{ 线索.采购单位 }}</span>
              <span>{{ 线索.区域 }}</span>
              <span class="金额">{{ 线索.预算 }} 万</span>
              <span>{{ 线索.截止时间 }}</span>
              <span>{{ 线索.来源 }}</span>
              <span class="线索状态" :class="线索.状态">{{ 线索.状态 }}</span>
              <span class="行操作"
                ><button type="button" @click.stop="查看详情(线索)">查看</button
                ><button type="button" @click.stop="切换关注(线索)">
                  {{ 线索.状态 === "已关注" ? "取消关注" : "关注" }}
                </button></span
              >
            </div>
            <div v-if="!过滤后列表.length" class="空结果">当前筛选条件下没有线索。</div>
          </div>
        </main>

        <aside class="摘要面板">
          <template v-if="当前线索">
            <span class="摘要标签">{{ 当前线索.来源 }}</span>
            <h2>{{ 当前线索.标题 }}</h2>
            <p>{{ 当前线索.摘要 }}</p>
            <dl>
              <div>
                <dt>采购单位</dt>
                <dd>{{ 当前线索.采购单位 }}</dd>
              </div>
              <div>
                <dt>预算金额</dt>
                <dd>{{ 当前线索.预算 }} 万元</dd>
              </div>
              <div>
                <dt>投标截止</dt>
                <dd class="风险">{{ 当前线索.截止时间 }}</dd>
              </div>
              <div>
                <dt>联系方式</dt>
                <dd>{{ 当前线索.联系方式 }}</dd>
              </div>
              <div>
                <dt>抓取时间</dt>
                <dd>{{ 当前线索.抓取时间 }}</dd>
              </div>
            </dl>
            <section class="预留区">
              <strong>客户与商机关联</strong>
              <span>后续开放</span>
              <p>位置、字段和权限边界已预留，本版不提供关联动作。</p>
            </section>
            <div class="摘要动作">
              <button class="线索按钮 主按钮" type="button" @click="查看详情(当前线索)">
                查看详情
              </button>
              <button class="线索按钮" type="button" @click="切换关注(当前线索)">
                {{ 当前线索.状态 === "已关注" ? "取消关注" : "关注" }}
              </button>
              <button class="线索按钮" type="button" @click="打开备注(当前线索)">备注</button>
              <button class="线索按钮 危险" type="button" @click="忽略线索(当前线索)">忽略</button>
            </div>
          </template>
        </aside>
      </section>
    </template>

    <div v-if="详情打开 && 当前线索" class="线索弹层" @click.self="详情打开 = false">
      <article class="线索详情">
        <header>
          <div>
            <span>线索详情 · {{ 当前线索.公告编号 }}</span>
            <h2>{{ 当前线索.标题 }}</h2>
          </div>
          <button type="button" @click="详情打开 = false">关闭</button>
        </header>
        <div class="详情布局">
          <main>
            <section>
              <h3>公告信息</h3>
              <dl>
                <div>
                  <dt>采购单位</dt>
                  <dd>{{ 当前线索.采购单位 }}</dd>
                </div>
                <div>
                  <dt>所属区域</dt>
                  <dd>{{ 当前线索.区域 }}</dd>
                </div>
                <div>
                  <dt>行业</dt>
                  <dd>{{ 当前线索.行业 }}</dd>
                </div>
                <div>
                  <dt>预算金额</dt>
                  <dd>{{ 当前线索.预算 }} 万元</dd>
                </div>
                <div>
                  <dt>发布时间</dt>
                  <dd>{{ 当前线索.发布时间 }}</dd>
                </div>
                <div>
                  <dt>截止时间</dt>
                  <dd>{{ 当前线索.截止时间 }}</dd>
                </div>
              </dl>
            </section>
            <section>
              <h3>项目摘要</h3>
              <p>{{ 当前线索.摘要 }}</p>
            </section>
            <section class="预留详情">
              <h3>客户与商机关联</h3>
              <p>
                本版仅保留位置，不返回候选客户、商机或关联接口。后续版本再定义人工确认和审计规则。
              </p>
            </section>
          </main>
          <aside>
            <dl>
              <div>
                <dt>来源</dt>
                <dd>{{ 当前线索.来源 }}</dd>
              </div>
              <div>
                <dt>原始链接</dt>
                <dd>正式接入后提供</dd>
              </div>
              <div>
                <dt>附件</dt>
                <dd>正式接入后提供</dd>
              </div>
              <div>
                <dt>抓取时间</dt>
                <dd>{{ 当前线索.抓取时间 }}</dd>
              </div>
            </dl>
            <button
              class="线索按钮 主按钮"
              type="button"
              @click="操作提示 = '已模拟打开公开来源；正式接入后跳转原公告。'"
            >
              打开原公告
            </button>
          </aside>
        </div>
      </article>
    </div>

    <div v-if="备注打开" class="线索弹层" @click.self="备注打开 = false">
      <article class="备注弹窗">
        <header>
          <h2>线索备注</h2>
          <button type="button" @click="备注打开 = false">关闭</button>
        </header>
        <textarea v-model="备注文本" placeholder="记录判断依据、跟进建议或来源说明"></textarea>
        <footer>
          <button class="线索按钮" type="button" @click="备注打开 = false">取消</button
          ><button class="线索按钮 主按钮" type="button" @click="保存备注">保存备注</button>
        </footer>
      </article>
    </div>
  </section>
</template>

<style scoped>
.线索页 {
  display: grid;
  min-width: 1180px;
  gap: 18px;
  color: #172b4d;
}
.线索页头 {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
}
.线索页标签 {
  display: inline-flex;
  min-height: 22px;
  align-items: center;
  padding: 0 8px;
  border-radius: 6px;
  background: #edf5ff;
  color: #1557d6;
  font-size: 11px;
  font-weight: 700;
}
.线索页头 h1 {
  margin: 8px 0 5px;
  font-size: 22px;
  line-height: 1.2;
  letter-spacing: 0;
}
.线索页头 p {
  margin: 0;
  color: #60748c;
  font-size: 11px;
}
.线索页动作 {
  display: flex;
  gap: 8px;
  flex-wrap: nowrap;
}
.线索按钮 {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  justify-content: center;
  padding: 0 14px;
  border: 1px solid #d5e2f0;
  border-radius: 8px;
  background: #fff;
  color: #4f6178;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}
.线索按钮:hover,
.线索按钮.active {
  border-color: #8db8ef;
  background: #edf5ff;
  color: #1557d6;
}
.线索按钮.主按钮 {
  /* 覆盖业务工作台遗留的 .主按钮 { margin-top: 18px }，避免同排按钮上下错位 */
  margin-top: 0;
  border-color: #2f69ed;
  background: #2f69ed;
  color: #fff;
}
.线索按钮:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.线索提示 {
  padding: 10px 12px;
  border: 1px solid #b8ead8;
  border-radius: 8px;
  background: #ecf9f3;
  color: #0b795d;
  font-size: 11px;
}
.线索指标 {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}
.线索指标 article {
  display: grid;
  min-height: 106px;
  gap: 7px;
  padding: 18px;
  border: 1px solid #dce7f3;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 10px 28px rgba(42, 82, 130, 0.07);
}
.线索指标 span,
.线索指标 small {
  color: #8391a5;
  font-size: 11px;
}
.线索指标 strong {
  font-size: 23px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.线索指标 .风险,
.风险 {
  color: #ce4b58 !important;
}
.检索布局 {
  display: grid;
  min-height: 594px;
  grid-template-columns: 214px minmax(620px, 1fr) 292px;
  gap: 14px;
}
.筛选面板,
.线索主区,
.摘要面板,
.来源面板 {
  min-width: 0;
  border: 1px solid #dce7f3;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 10px 28px rgba(42, 82, 130, 0.07);
}
.筛选面板 {
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 16px;
}
.面板标题,
.来源面板头 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.面板标题 strong,
.来源面板头 strong {
  font-size: 11px;
}
.面板标题 button {
  border: 0;
  background: transparent;
  color: #2f69ed;
  font-size: 11px;
  cursor: pointer;
}
.筛选面板 label {
  display: grid;
  gap: 6px;
}
.筛选面板 label span {
  color: #60748c;
  font-size: 11px;
  font-weight: 700;
}
.筛选面板 input,
.筛选面板 select {
  width: 100%;
  height: 34px;
  padding: 0 10px;
  border: 1px solid #dce7f3;
  border-radius: 7px;
  background: #fff;
  color: #172b4d;
  font: inherit;
  font-size: 11px;
}
.筛选备注 {
  padding: 10px;
  border-radius: 8px;
  background: #f5f8fb;
  color: #68798e;
  font-size: 11px;
  line-height: 1.6;
}
.线索主区 {
  display: grid;
  min-width: 0;
  grid-template-rows: auto auto minmax(0, 1fr);
  overflow: hidden;
}
.线索页签 {
  display: flex;
  min-height: 48px;
  align-items: center;
  gap: 4px;
  padding: 0 14px;
  border-bottom: 1px solid #e9f0f7;
}
.线索页签 button {
  min-height: 30px;
  padding: 0 12px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #60748c;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}
.线索页签 button.active {
  background: #edf5ff;
  color: #1557d6;
}
.线索表头,
.线索行 {
  display: grid;
  grid-template-columns: minmax(250px, 2.2fr) 132px 124px 76px 116px 128px 68px 106px;
  align-items: center;
  gap: 10px;
}
.线索表头 {
  min-height: 42px;
  padding: 0 14px;
  background: #f6f9fc;
  color: #68798e;
  font-size: 11px;
  font-weight: 700;
}
.线索表体 {
  min-height: 0;
  overflow: auto;
}
.线索行 {
  width: 100%;
  min-height: 80px;
  padding: 10px 14px;
  border: 0;
  border-bottom: 1px solid #edf2f7;
  background: #fff;
  color: #34475f;
  font: inherit;
  font-size: 11px;
  text-align: left;
  cursor: pointer;
}
.线索行:hover,
.线索行.active {
  background: #f5f9ff;
}
.线索行 > span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.线索标题 {
  display: grid;
  gap: 5px;
}
.线索标题 strong {
  overflow: hidden;
  color: #172b4d;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.线索标题 small {
  color: #8391a5;
  font-size: 11px;
}
.金额 {
  color: #1557d6;
  font-weight: 700;
}
.线索状态 {
  justify-self: start;
  padding: 4px 8px;
  border-radius: 6px;
  background: #f0f3f7;
  color: #68798e;
  font-size: 11px;
  font-weight: 700;
}
.线索状态.已关注 {
  background: #edf5ff;
  color: #1557d6;
}
.线索状态.已忽略 {
  background: #f0f3f7;
  color: #8391a5;
}
.行操作 {
  display: flex;
  gap: 5px;
}
.行操作 button,
.文本按钮 {
  padding: 0;
  border: 0;
  background: transparent;
  color: #2f69ed;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}
.空结果 {
  display: grid;
  min-height: 180px;
  place-items: center;
  color: #8391a5;
  font-size: 11px;
}
.摘要面板 {
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 18px;
}
.摘要标签 {
  justify-self: start;
  padding: 4px 8px;
  border-radius: 6px;
  background: #edf5ff;
  color: #1557d6;
  font-size: 11px;
  font-weight: 700;
}
.摘要面板 h2 {
  margin: 0;
  font-size: 16px;
  line-height: 1.5;
}
.摘要面板 > p {
  margin: 0;
  color: #60748c;
  font-size: 11px;
  line-height: 1.7;
}
.摘要面板 dl,
.线索详情 dl {
  display: grid;
  gap: 0;
  margin: 0;
}
.摘要面板 dl div,
.线索详情 dl div {
  display: flex;
  min-height: 38px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid #eef3f8;
}
.摘要面板 dt,
.线索详情 dt {
  color: #8391a5;
  font-size: 11px;
}
.摘要面板 dd,
.线索详情 dd {
  margin: 0;
  color: #34475f;
  font-size: 11px;
  font-weight: 700;
  text-align: right;
}
.预留区,
.预留详情 {
  display: grid;
  gap: 7px;
  padding: 12px;
  border: 1px dashed #cbd9e8;
  border-radius: 8px;
  background: #f8fafc;
}
.预留区 strong,
.预留详情 h3 {
  margin: 0;
  color: #68798e;
  font-size: 11px;
}
.预留区 span {
  justify-self: start;
  padding: 3px 7px;
  border-radius: 5px;
  background: #e9eef4;
  color: #8391a5;
  font-size: 11px;
  font-weight: 700;
}
.预留区 p,
.预留详情 p {
  margin: 0;
  color: #8391a5;
  font-size: 11px;
  line-height: 1.65;
}
.摘要动作 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.线索按钮.危险 {
  color: #ce4b58;
}
.来源面板 {
  overflow: hidden;
}
.来源面板头 {
  min-height: 62px;
  padding: 0 18px;
  border-bottom: 1px solid #e9f0f7;
}
.来源面板头 div {
  display: grid;
  gap: 4px;
}
.来源面板头 span {
  color: #8391a5;
  font-size: 11px;
}
.来源表 {
  min-width: 1120px;
}
.来源表头,
.来源行 {
  display: grid;
  grid-template-columns: 220px 100px 150px 100px 110px 150px 90px 90px;
  align-items: center;
  gap: 12px;
  padding: 0 18px;
}
.来源表头 {
  min-height: 42px;
  background: #f6f9fc;
  color: #68798e;
  font-size: 11px;
  font-weight: 700;
}
.来源行 {
  min-height: 68px;
  border-top: 1px solid #edf2f7;
  color: #4f6178;
  font-size: 11px;
}
.来源行 strong {
  color: #172b4d;
}
.来源状态 {
  justify-self: start;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
}
.来源状态.正常 {
  background: #e8f9f3;
  color: #0b795d;
}
.来源状态.部分失败 {
  background: #fff7df;
  color: #936409;
}
.来源状态.暂停 {
  background: #f0f3f7;
  color: #68798e;
}
.线索弹层 {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: grid;
  place-items: center;
  padding: 28px;
  background: rgba(15, 31, 52, 0.46);
  backdrop-filter: blur(4px);
}
.线索详情 {
  width: min(1040px, 100%);
  max-height: calc(100vh - 56px);
  overflow: hidden;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 28px 70px rgba(15, 31, 52, 0.26);
}
.线索详情 > header,
.备注弹窗 > header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 20px 24px;
  border-bottom: 1px solid #e9f0f7;
}
.线索详情 header span {
  color: #8391a5;
  font-size: 11px;
}
.线索详情 h2 {
  margin: 6px 0 0;
  font-size: 16px;
}
.线索详情 header button,
.备注弹窗 header button {
  border: 0;
  background: transparent;
  color: #60748c;
  font: inherit;
  font-size: 20px;
  cursor: pointer;
}
.详情布局 {
  display: grid;
  max-height: calc(100vh - 150px);
  grid-template-columns: minmax(0, 1fr) 250px;
  overflow: auto;
}
.详情布局 main {
  display: grid;
  gap: 14px;
  padding: 22px 24px;
}
.详情布局 section {
  padding: 16px;
  border: 1px solid #e3ebf4;
  border-radius: 9px;
}
.详情布局 h3 {
  margin: 0 0 12px;
  font-size: 11px;
}
.详情布局 section p {
  margin: 0;
  color: #4f6178;
  line-height: 1.75;
}
.详情布局 dl {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 18px;
}
.详情布局 dl div {
  justify-content: flex-start;
}
.详情布局 aside {
  display: grid;
  align-content: start;
  gap: 16px;
  padding: 22px 18px;
  border-left: 1px solid #e9f0f7;
  background: #f8fafc;
}
.备注弹窗 {
  display: grid;
  width: min(520px, 100%);
  overflow: hidden;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 28px 70px rgba(15, 31, 52, 0.26);
}
.备注弹窗 h2 {
  margin: 0;
  font-size: 16px;
}
.备注弹窗 textarea {
  min-height: 180px;
  margin: 20px 22px;
  padding: 12px;
  border: 1px solid #dce7f3;
  border-radius: 8px;
  resize: vertical;
  color: #172b4d;
  font: inherit;
  line-height: 1.6;
}
.备注弹窗 footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid #e9f0f7;
}
</style>
