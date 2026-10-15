<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import { 查询阶段9列表, type 阶段9记录 } from "../../api/business-client.js";

interface 价格阶梯 {
  min: number;
  max: number | null;
  price: number;
}

interface 区域覆盖 {
  region: string;
  enabled: boolean;
  priceRatioPrimary: number;
  priceRatioSecondary: number;
  priceForPrimary: 价格阶梯[];
  priceForSecondary: 价格阶梯[];
}

const 路由器 = useRouter();
const 路由 = useRoute();
const 加载中 = ref(false);
const 错误 = ref("");
const 搜索词 = ref("");
const 当前标签 = ref<"全部" | "阶梯计价" | "区域覆盖" | "固定价">("全部");
const 产品列表 = ref<阶段9记录[]>([]);
const 选中编号 = ref("");

const 过滤后产品 = computed(() => {
  const 词 = 搜索词.value.trim().toLowerCase();
  return 产品列表.value.filter((item) => {
    const 阶梯 = 读取阶梯(item);
    const 区域 = 读取区域覆盖(item);
    if (当前标签.value === "阶梯计价" && 阶梯.length === 0) return false;
    if (当前标签.value === "区域覆盖" && 区域.length === 0) return false;
    if (当前标签.value === "固定价" && 阶梯.length > 0) return false;
    if (!词) return true;
    return [item.标题, item.编号, 字段(item, "productCode"), 字段(item, "unit")].some((value) =>
      value.toLowerCase().includes(词),
    );
  });
});
const 当前产品 = computed(
  () => 过滤后产品.value.find((item) => item.id === 选中编号.value) || 过滤后产品.value[0] || null,
);
const 基础阶梯 = computed(() => 读取阶梯(当前产品.value));
const 一级阶梯 = computed(() => 读取等级阶梯(当前产品.value, "priceForPrimary"));
const 二级阶梯 = computed(() => 读取等级阶梯(当前产品.value, "priceForSecondary"));
const 区域覆盖列表 = computed(() => 读取区域覆盖(当前产品.value));
const 一级比例 = computed(() => 数字字段(当前产品.value, "priceRatioPrimary") || 100);
const 二级比例 = computed(() => 数字字段(当前产品.value, "priceRatioSecondary") || 100);
const 固定价 = computed(() => 数字字段(当前产品.value, "priceFixed") || 当前产品.value?.金额 || 0);
const 阶梯数 = computed(() => 产品列表.value.filter((item) => 读取阶梯(item).length > 0).length);
const 区域覆盖数 = computed(
  () => 产品列表.value.filter((item) => 读取区域覆盖(item).length > 0).length,
);

onMounted(() => void 加载());

async function 加载() {
  加载中.value = true;
  错误.value = "";
  try {
    const 结果 = await 查询阶段9列表("products", { page: 1, pageSize: 500 });
    产品列表.value = 结果.数据;
    const 指定产品 = String(路由.query.productId || "");
    选中编号.value =
      产品列表.value.find((item) => item.id === 指定产品 || item.编号 === 指定产品)?.id ||
      产品列表.value[0]?.id ||
      "";
  } catch (error) {
    错误.value = error instanceof Error ? error.message : "价格规则加载失败。";
  } finally {
    加载中.value = false;
  }
}

function 读取阶梯(row: 阶段9记录 | null | undefined): 价格阶梯[] {
  const value = row?.原始数据?.tiers;
  return 规范化阶梯(value);
}

function 读取等级阶梯(row: 阶段9记录 | null | undefined, key: string): 价格阶梯[] {
  const value = row?.原始数据?.[key];
  return 规范化阶梯(value);
}

function 规范化阶梯(value: unknown): 价格阶梯[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const 记录 = item as Record<string, unknown>;
      return {
        min: Number(记录.min || 1),
        max: 记录.max === null || 记录.max === undefined ? null : Number(记录.max),
        price: Number(记录.price || 0),
      };
    })
    .filter((item) => Number.isFinite(item.min) && Number.isFinite(item.price));
}

function 读取区域覆盖(row: 阶段9记录 | null | undefined): 区域覆盖[] {
  const value = row?.原始数据?.regionPriceOverrides;
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const 记录 = item as Record<string, unknown>;
    return {
      region: String(记录.region || "未命名区域"),
      enabled: 记录.enabled !== false,
      priceRatioPrimary: Number(记录.priceRatioPrimary || 100),
      priceRatioSecondary: Number(记录.priceRatioSecondary || 100),
      priceForPrimary: 规范化阶梯(记录.priceForPrimary),
      priceForSecondary: 规范化阶梯(记录.priceForSecondary),
    };
  });
}

function 字段(row: 阶段9记录 | null, ...keys: string[]): string {
  if (!row) return "";
  for (const key of keys) {
    const 值 = row.原始数据?.[key];
    if (值 !== undefined && 值 !== null && 值 !== "") return String(值);
  }
  return "";
}

function 数字字段(row: 阶段9记录 | null, key: string): number {
  const 值 = Number(row?.原始数据?.[key] || 0);
  return Number.isFinite(值) ? 值 : 0;
}

function 金额(value: number): string {
  return `¥${numberFmt(value)}`;
}

function numberFmt(value: number): string {
  return Number(value || 0).toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}
</script>

<template>
  <section class="价格规则页">
    <header class="价格页头">
      <div>
        <button class="返回按钮" type="button" @click="路由器.push('/admin/products')">
          ← 返回产品与套餐
        </button>
        <span class="页面标签">产品与配置</span>
        <h1>模块价格规则</h1>
        <p>统一查看基础阶梯价、渠道价格比例和区域价格覆盖，报价时由服务端按规则顺序计算。</p>
      </div>
      <div class="页头提示">价格规则只读展示，正式维护由产品模块后续接入。</div>
    </header>

    <div v-if="错误" class="错误提示">{{ 错误 }}</div>
    <div class="指标条">
      <article>
        <span>产品与模块</span><strong>{{ 产品列表.length }}</strong
        ><small>来自已发布产品目录</small>
      </article>
      <article>
        <span>阶梯计价</span><strong>{{ 阶梯数 }}</strong
        ><small>按端点数量匹配</small>
      </article>
      <article>
        <span>区域覆盖</span><strong>{{ 区域覆盖数 }}</strong
        ><small>区域优先于全国默认</small>
      </article>
      <article><span>渠道比例</span><strong>2</strong><small>一级 / 二级渠道</small></article>
    </div>

    <div v-if="加载中" class="加载态">正在加载产品价格规则...</div>
    <div v-else class="价格布局">
      <aside class="产品列表面板">
        <div class="列表头">
          <strong>产品与模块</strong><span>{{ 过滤后产品.length }} 项</span>
          <div class="搜索框">
            <span>⌕</span><input v-model="搜索词" placeholder="搜索名称、编号或型号" />
          </div>
          <nav>
            <button
              v-for="标签 in ['全部', '阶梯计价', '区域覆盖', '固定价'] as const"
              :key="标签"
              type="button"
              :class="{ active: 当前标签 === 标签 }"
              @click="当前标签 = 标签"
            >
              {{ 标签 }}
            </button>
          </nav>
        </div>
        <div class="产品列表">
          <button
            v-for="产品 in 过滤后产品"
            :key="产品.id"
            type="button"
            :class="{ active: 当前产品?.id === 产品.id }"
            @click="选中编号 = 产品.id"
          >
            <strong>{{ 产品.标题 }}</strong>
            <small>{{ 产品.编号 }} · {{ 字段(产品, "unit") || "按项" }}</small>
            <span v-if="读取阶梯(产品).length">阶梯计价 · {{ 读取阶梯(产品).length }} 档</span>
            <span v-else>固定价 · {{ 金额(数字字段(产品, "priceFixed") || 产品.金额) }}</span>
            <em v-if="读取区域覆盖(产品).length">区域覆盖 {{ 读取区域覆盖(产品).length }}</em>
          </button>
          <div v-if="!过滤后产品.length" class="空态">没有匹配的产品或模块。</div>
        </div>
      </aside>

      <main class="规则主体" v-if="当前产品">
        <section class="规则面板">
          <header>
            <div>
              <h2>{{ 当前产品.标题 }} · 价格规则</h2>
              <p>{{ 当前产品.编号 }} · {{ 字段(当前产品, "productCode") || "无产品编码" }}</p>
            </div>
            <span class="发布状态">已发布</span>
          </header>
          <div class="规则摘要">
            <div>
              <span>计价方式</span><strong>{{ 基础阶梯.length ? "阶梯计价" : "固定价" }}</strong>
            </div>
            <div>
              <span>计量单位</span><strong>{{ 字段(当前产品, "unit") || "端点" }}</strong>
            </div>
            <div>
              <span>一级渠道比例</span><strong>{{ 一级比例 }}%</strong>
            </div>
            <div>
              <span>二级渠道比例</span><strong>{{ 二级比例 }}%</strong>
            </div>
          </div>
        </section>

        <section class="规则面板">
          <header>
            <div>
              <h2>基础阶梯价</h2>
              <p>全国默认阶梯，相同数量区间命中单价最低的规则由服务端确定。</p>
            </div>
          </header>
          <table v-if="基础阶梯.length">
            <thead>
              <tr>
                <th>数量区间</th>
                <th>全国基础单价</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(阶梯, index) in 基础阶梯" :key="index">
                <td>{{ 阶梯.min }} - {{ 阶梯.max || "以上" }} 点</td>
                <td>{{ 金额(阶梯.price) }}</td>
                <td>{{ index === 0 ? "最低采购量" : "数量越大单价越低" }}</td>
              </tr>
            </tbody>
          </table>
          <div v-else class="规则空态">
            当前产品使用固定价：<strong>{{ 金额(固定价) }}</strong>
          </div>
        </section>

        <div class="双栏规则">
          <section class="规则面板">
            <header>
              <div>
                <h2>渠道价格比例</h2>
                <p>基础价或区域覆盖价计算后应用渠道比例。</p>
              </div>
            </header>
            <div class="比例列表">
              <div>
                <span>一级渠道商</span><strong>标准价 × {{ 一级比例 }}%</strong>
              </div>
              <div>
                <span>二级渠道商</span><strong>标准价 × {{ 二级比例 }}%</strong>
              </div>
            </div>
          </section>
          <section class="规则面板">
            <header>
              <div>
                <h2>区域价格覆盖</h2>
                <p>命中区域后优先于全国基础阶梯价。</p>
              </div>
            </header>
            <div class="区域列表">
              <div v-for="区域 in 区域覆盖列表" :key="区域.region">
                <span>{{ 区域.region }}</span
                ><strong
                  >{{ 区域.enabled ? "已启用" : "已停用" }} · 一级
                  {{ 区域.priceRatioPrimary }}%</strong
                >
              </div>
              <div v-if="!区域覆盖列表.length" class="规则空态">当前产品没有区域价格覆盖。</div>
            </div>
          </section>
        </div>

        <section class="规则面板" v-if="区域覆盖列表.length">
          <header>
            <div>
              <h2>区域阶梯覆盖明细</h2>
              <p>区域阶梯存在时，报价按区域阶梯计算，再应用区域渠道比例。</p>
            </div>
          </header>
          <table>
            <thead>
              <tr>
                <th>区域</th>
                <th>数量区间</th>
                <th>一级渠道单价</th>
                <th>二级渠道单价</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="区域 in 区域覆盖列表" :key="区域.region">
                <tr
                  v-for="(阶梯, index) in 区域.priceForPrimary.length
                    ? 区域.priceForPrimary
                    : 区域.priceForSecondary"
                  :key="`${区域.region}-${index}`"
                >
                  <td>{{ 区域.region }}</td>
                  <td>{{ 阶梯.min }} - {{ 阶梯.max || "以上" }} 点</td>
                  <td>{{ 金额(区域.priceForPrimary[index]?.price ?? 0) }}</td>
                  <td>{{ 金额(区域.priceForSecondary[index]?.price ?? 0) }}</td>
                </tr>
              </template>
            </tbody>
          </table>
        </section>
      </main>

      <aside class="规则说明">
        <section>
          <h2>价格命中顺序</h2>
          <ol>
            <li>产品目录与发布状态</li>
            <li>区域价格覆盖</li>
            <li>渠道价格比例</li>
            <li>数量阶梯单价</li>
            <li>报价快照固化</li>
          </ol>
        </section>
        <section>
          <h2>当前命中</h2>
          <dl>
            <div>
              <dt>产品</dt>
              <dd>{{ 当前产品?.标题 || "—" }}</dd>
            </div>
            <div>
              <dt>基础价</dt>
              <dd>{{ 基础阶梯.length ? 金额(基础阶梯[0]?.price ?? 0) : 金额(固定价) }}</dd>
            </div>
            <div>
              <dt>区域覆盖</dt>
              <dd>{{ 区域覆盖列表.length ? `${区域覆盖列表.length} 个区域` : "无" }}</dd>
            </div>
            <div>
              <dt>一级附加</dt>
              <dd>{{ 一级阶梯.length ? "含一级阶梯" : "按基础阶梯" }}</dd>
            </div>
          </dl>
        </section>
        <section class="提示">
          <strong>报价结果不由前端计算</strong>
          <p>页面只展示规则和命中依据，正式报价金额、工作量和版本由服务端试算并保存快照。</p>
        </section>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.价格规则页 {
  display: grid;
  min-width: 1200px;
  gap: 18px;
  color: #172b4d;
}
.价格页头 {
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
.价格页头 h1 {
  margin: 7px 0 5px;
  font-size: 22px;
}
.价格页头 p {
  margin: 0;
  color: #60748c;
  font-size: 11px;
}
.页头提示 {
  max-width: 390px;
  padding: 10px 12px;
  border: 1px solid #cfe1ff;
  border-radius: 8px;
  color: #315f96;
  background: #eff6ff;
  font-size: 11px;
  line-height: 1.55;
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
.加载态,
.空态 {
  padding: 40px;
  color: #73849a;
  text-align: center;
  border: 1px dashed #ccd9e8;
  border-radius: 10px;
  background: #fff;
}
.价格布局 {
  display: grid;
  grid-template-columns: 310px minmax(0, 1fr) 280px;
  gap: 18px;
  align-items: start;
}
.产品列表面板,
.规则面板,
.规则说明 > section {
  overflow: hidden;
  border: 1px solid #dce7f3;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(35, 69, 115, 0.05);
}
.列表头 {
  padding: 16px;
  border-bottom: 1px solid #e8eef6;
}
.列表头 > strong {
  font-size: 16px;
}
.列表头 > span {
  float: right;
  color: #7d8ca0;
  font-size: 11px;
}
.搜索框 {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 10px;
  margin-top: 12px;
  border: 1px solid #d5e1ee;
  border-radius: 8px;
}
.搜索框 input {
  flex: 1;
  min-width: 0;
  height: 36px;
  border: 0;
  outline: 0;
  font: inherit;
}
nav {
  display: flex;
  gap: 6px;
  margin-top: 10px;
}
nav button {
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid #dbe6f2;
  border-radius: 7px;
  color: #64768c;
  background: #fff;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}
nav button.active {
  border-color: #2468d2;
  color: #fff;
  background: #2468d2;
}
.产品列表 {
  display: grid;
  max-height: 660px;
  overflow-y: auto;
}
.产品列表 > button {
  display: grid;
  gap: 5px;
  padding: 13px 16px;
  border: 0;
  border-bottom: 1px solid #edf1f6;
  color: #42576d;
  background: #fff;
  text-align: left;
  cursor: pointer;
}
.产品列表 > button.active {
  background: #eef6ff;
  box-shadow: inset 3px 0 #2367d1;
}
.产品列表 strong {
  font-size: 11px;
}
.产品列表 small {
  color: #7d8ca0;
  font-size: 11px;
}
.产品列表 span {
  color: #1f65c9;
  font-size: 11px;
  font-weight: 700;
}
.产品列表 em {
  color: #8a6218;
  font-size: 11px;
  font-style: normal;
}
.规则主体 {
  display: grid;
  gap: 18px;
  min-width: 0;
}
.规则面板 > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 16px 18px;
  border-bottom: 1px solid #e8eef6;
}
.规则面板 h2,
.规则说明 h2 {
  margin: 0;
  font-size: 16px;
}
.规则面板 header p {
  margin: 5px 0 0;
  color: #75869a;
  font-size: 11px;
}
.发布状态 {
  padding: 5px 9px;
  border-radius: 999px;
  color: #1c7854;
  background: #e5f7ee;
  font-size: 11px;
  font-weight: 700;
}
.规则摘要 {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  padding: 16px 18px;
  gap: 12px;
}
.规则摘要 div {
  padding: 12px;
  border: 1px solid #e3ebf4;
  border-radius: 8px;
  background: #f8fbff;
}
.规则摘要 span {
  display: block;
  color: #7d8ca0;
  font-size: 11px;
}
.规则摘要 strong {
  display: block;
  margin-top: 5px;
  font-size: 11px;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th {
  padding: 11px 14px;
  color: #667991;
  background: #f7f9fc;
  font-size: 11px;
  text-align: left;
  white-space: nowrap;
}
td {
  padding: 12px 14px;
  border-top: 1px solid #eaf0f7;
  color: #40556c;
  font-size: 11px;
  white-space: nowrap;
}
.双栏规则 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}
.比例列表,
.区域列表 {
  display: grid;
  gap: 10px;
  padding: 16px;
}
.比例列表 div,
.区域列表 div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 12px;
  border-radius: 8px;
  background: #f8fbff;
}
.比例列表 span,
.区域列表 span {
  color: #60748c;
  font-size: 11px;
}
.比例列表 strong,
.区域列表 strong {
  font-size: 11px;
  white-space: nowrap;
}
.规则空态 {
  padding: 28px;
  color: #74869b;
  text-align: center;
  font-size: 11px;
}
.规则说明 {
  position: sticky;
  top: 14px;
  display: grid;
  gap: 14px;
}
.规则说明 > section {
  padding: 16px;
}
.规则说明 h2 {
  margin-bottom: 12px;
}
ol {
  display: grid;
  gap: 9px;
  padding-left: 20px;
  margin: 0;
  color: #50667d;
  font-size: 11px;
}
dl {
  display: grid;
  gap: 10px;
  margin: 0;
}
dl > div {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}
dt {
  color: #7d8ca0;
  font-size: 11px;
}
dd {
  margin: 0;
  color: #34495f;
  font-size: 11px;
  font-weight: 700;
  text-align: right;
}
.提示 {
  border-color: #cfe1ff !important;
  background: #f1f7ff;
}
.提示 strong {
  color: #235eae;
}
.提示 p {
  margin: 7px 0 0;
  color: #597392;
  font-size: 11px;
  line-height: 1.65;
}
</style>
