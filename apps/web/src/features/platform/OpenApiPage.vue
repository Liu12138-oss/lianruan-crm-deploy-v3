<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import {
  查询开放接口客户端,
  查询开放接口日志,
  type 开放接口客户端,
  type 开放接口日志,
} from "../../api/business-client.js";
import WarKpis from "../../components/war/WarKpis.vue";
import type { 指标项 } from "../../components/war/types.js";
import { 日期时间文本, 文本 } from "../../shared/format/business-format.js";

const 加载中 = ref(false);
const 错误 = ref("");
const 客户端列表 = ref<开放接口客户端[]>([]);
const 日志列表 = ref<开放接口日志[]>([]);
const 搜索词 = ref("");
const 展开编号 = ref("");

function 状态文本(客户端: 开放接口客户端): string {
  if (客户端.status === "active") return "启用";
  if (客户端.status === "disabled") return "停用";
  return 文本(客户端.status, "未知");
}

function 授权文本(客户端: 开放接口客户端): string {
  const 资源 = 客户端.allowedResources || [];
  if (!资源.length) return "未设置";
  return 资源.includes("*") ? "全部资源" : 资源.join(" / ");
}

function 白名单文本(客户端: 开放接口客户端): string {
  const 白名单 = 客户端.ipWhitelist || [];
  return 白名单.length ? 白名单.join(", ") : "未限制";
}

function 距今天数(时间值: string): number | null {
  if (!时间值) return null;
  const 时间 = new Date(时间值);
  if (Number.isNaN(时间.getTime())) return null;
  return Math.ceil((时间.getTime() - Date.now()) / 86400000);
}

const 过滤后客户端 = computed(() => {
  const 关键词 = 搜索词.value.trim().toLowerCase();
  if (!关键词) return 客户端列表.value;
  return 客户端列表.value.filter((客户端) =>
    [客户端.name, 客户端.appKey, 客户端.boundUser?.name, 客户端.boundUser?.username]
      .filter(Boolean)
      .some((值) => String(值).toLowerCase().includes(关键词)),
  );
});

const 今日日志 = computed(() =>
  日志列表.value.filter((日志) => {
    const 时间 = new Date(日志.time);
    return !Number.isNaN(时间.getTime()) && 时间.toDateString() === new Date().toDateString();
  }),
);

const 指标 = computed<指标项[]>(() => {
  const 客户端 = 客户端列表.value;
  const 启用中 = 客户端.filter((项) => 项.status === "active").length;
  const 异常请求 = 日志列表.value.filter((日志) => Number(日志.resultCode) >= 400).length;
  const 密钥临近到期 = 客户端.filter((项) => {
    const 天数 = 距今天数(项.expiresAt);
    return 天数 !== null && 天数 >= 0 && 天数 <= 90;
  }).length;
  return [
    { label: "客户端总数", value: String(客户端.length), unit: "个", note: "已登记的 OpenAPI 客户端" },
    { label: "启用中", value: String(启用中), unit: "个", note: `停用 ${客户端.length - 启用中} 个` },
    {
      label: "今日调用",
      value: String(今日日志.value.length),
      unit: "次",
      note: 日志列表.value.length ? `已记录 ${日志列表.value.length} 条日志` : "暂无调用日志",
    },
    { label: "平均响应", value: "—", unit: "ms", note: "调用日志未记录耗时" },
    { label: "异常请求", value: String(异常请求), unit: "次", note: "结果码 ≥ 400" },
    { label: "密钥剩余", value: String(密钥临近到期), unit: "个", note: "90 天内到期" },
  ];
});

onMounted(() => void 加载());

async function 加载() {
  加载中.value = true;
  错误.value = "";
  try {
    const [客户端结果, 日志结果] = await Promise.all([
      查询开放接口客户端(),
      查询开放接口日志(100).catch(() => []),
    ]);
    客户端列表.value = 客户端结果;
    日志列表.value = 日志结果;
  } catch (异常) {
    错误.value = 异常 instanceof Error ? 异常.message : "开放接口数据加载失败。";
  } finally {
    加载中.value = false;
  }
}

function 切换展开(客户端: 开放接口客户端) {
  展开编号.value = 展开编号.value === 客户端.id ? "" : 客户端.id;
}

function 结果文本(日志: 开放接口日志): string {
  return Number(日志.resultCode) >= 400 ? String(日志.resultCode) : "成功";
}
</script>

<template>
  <div class="vui war-artboard war-artboard-flow 开放接口页">
    <WarKpis :items="指标" />

    <section class="panel">
      <header class="panel-head">
        <div>
          <h2>客户端列表</h2>
          <p>密钥只允许在创建或重置时展示一次，本页不回显密钥明文。</p>
        </div>
      </header>
      <div class="panel-body flush">
        <div class="toolbar">
          <div class="filters">
            <div class="field search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              <input v-model="搜索词" placeholder="搜索客户端名称、AppKey 或绑定用户" />
            </div>
          </div>
          <div class="button-row">
            <span class="war-count">共 {{ 过滤后客户端.length }} 个客户端</span>
          </div>
        </div>

        <div v-if="加载中" class="war-empty">正在加载开放接口数据…</div>
        <div v-else-if="错误" class="war-empty">{{ 错误 }}</div>
        <div v-else class="table-wrap">
          <table class="data-table 客户端表">
            <thead>
              <tr>
                <th>客户端</th>
                <th>绑定用户</th>
                <th>授权资源</th>
                <th>来源白名单</th>
                <th>状态</th>
                <th>到期时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="客户端 in 过滤后客户端" :key="客户端.id">
                <tr @click="切换展开(客户端)">
                  <td><span class="record-title">{{ 文本(客户端.name, "未命名客户端") }}</span></td>
                  <td>{{ 文本(客户端.boundUser?.name, 客户端.boundUser?.username, "—") }}</td>
                  <td>{{ 授权文本(客户端) }}</td>
                  <td>{{ 白名单文本(客户端) }}</td>
                  <td>
                    <span class="status" :class="客户端.status === 'active' ? 'green' : 'gray'">
                      {{ 状态文本(客户端) }}
                    </span>
                  </td>
                  <td>{{ 客户端.expiresAt ? 日期时间文本(客户端.expiresAt) : "未设置" }}</td>
                  <td>
                    <span class="table-actions">
                      <button type="button" class="link" @click.stop="切换展开(客户端)">
                        {{ 展开编号 === 客户端.id ? "收起" : "查看" }}
                      </button>
                    </span>
                  </td>
                </tr>
                <tr v-if="展开编号 === 客户端.id" :key="`${客户端.id}-详情`" class="客户端详情行">
                  <td colspan="7">
                    <div class="info-grid">
                      <div class="info-item"><span>AppKey</span><strong>{{ 文本(客户端.appKey, "—") }}</strong></div>
                      <div class="info-item">
                        <span>需重签密钥</span><strong>{{ 客户端.secretResetRequired ? "是" : "否" }}</strong>
                      </div>
                      <div class="info-item"><span>授权资源</span><strong>{{ 授权文本(客户端) }}</strong></div>
                      <div class="info-item"><span>IP 白名单</span><strong>{{ 白名单文本(客户端) }}</strong></div>
                    </div>
                    <p class="war-note">{{ 文本(客户端.remark, "无备注。") }}</p>
                  </td>
                </tr>
              </template>
              <tr v-if="!过滤后客户端.length">
                <td colspan="7" class="war-empty">没有符合条件的客户端。</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section class="panel">
      <header class="panel-head">
        <div>
          <h2>调用日志</h2>
          <p>定位 401、403、404 和数据范围问题。</p>
        </div>
      </header>
      <div class="panel-body flush">
        <div v-if="加载中" class="war-empty">正在加载调用日志…</div>
        <div v-else-if="!日志列表.length" class="war-empty">暂无调用日志。</div>
        <div v-else class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>客户端</th>
                <th>资源</th>
                <th>结果</th>
                <th>来源 IP</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="日志 in 日志列表.slice(0, 20)" :key="日志.id">
                <td>{{ 日期时间文本(日志.time) }}</td>
                <td>{{ 文本(日志.clientName, "—") }}</td>
                <td>{{ 文本(日志.method, "GET") }} {{ 文本(日志.path, "—") }}</td>
                <td>
                  <span class="status" :class="Number(日志.resultCode) >= 400 ? 'red' : 'green'">
                    {{ 结果文本(日志) }}
                  </span>
                </td>
                <td>{{ 文本(日志.ip, "—") }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.客户端表 tbody tr {
  cursor: pointer;
}

.客户端详情行 {
  cursor: default;
}

.客户端详情行 td {
  padding: 12px 13px;
  background: #f8fbff;
}

.客户端详情行 .war-note {
  margin: 10px 0 0;
  color: var(--text-3);
  font-size: 11px;
  line-height: 1.6;
}

.war-count {
  color: var(--text-3);
  font-size: 11px;
  font-weight: 700;
}

.war-empty {
  display: grid;
  place-items: center;
  min-height: 80px;
  padding: 16px;
  color: var(--text-3);
  font-size: 11px;
}
</style>
