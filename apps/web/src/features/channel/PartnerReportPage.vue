<script setup lang="ts">
import type { 阶段9记录 } from "../../api/business-client.js";
import GenericWarModulePage, {
  type 模块配置,
} from "../common/GenericWarModulePage.vue";
import { 文本 } from "../../shared/format/business-format.js";

function 取(行: 阶段9记录, ...键列表: string[]): string {
  const 数据 = (行.原始数据 as Record<string, unknown>) || {};
  return 文本(...键列表.map((键) => 数据[键]), ...键列表.map((键) => (行 as never)?.[键]));
}

function 成员数(行: 阶段9记录): number {
  const 成员 = (行.原始数据 as Record<string, unknown>)?.staff;
  return Array.isArray(成员) ? 成员.length : 0;
}

function 等级文本(行: 阶段9记录): string {
  const 代码 = 取(行, "partnerLevel", "level");
  const 映射: Record<string, string> = {
    none: "未分级",
    silver: "银牌",
    gold: "金牌",
    primary: "一级渠道",
    secondary: "二级渠道",
    lep: "核心渠道",
  };
  return 映射[代码] || (代码 ? 代码 : "未分级");
}

const 配置: 模块配置 = {
  模块: "partners",
  列表标题: "渠道经营报表",
  搜索占位: "搜索渠道商、区域或负责人",
  标签: ["全部"],
  卡片: {
    标题: (行) => 文本(行.标题, 行.渠道名称, "未命名渠道商"),
    说明: (行) => `${等级文本(行)} · ${文本(取(行, "region"), "未填写区域")}`,
    徽标: 等级文本,
    色调: (行) =>
      ["一级渠道", "核心渠道"].includes(等级文本(行))
        ? "blue"
        : 等级文本(行) === "金牌"
          ? "amber"
          : "gray",
    归属: (行) => `负责人：${文本(取(行, "contact", "bossName"), "未维护")}`,
    金额: (行) => `${成员数(行)} 人`,
    标签: (行) => [
      { text: `成员 ${成员数(行)} 人`, hot: 成员数(行) > 0 },
      { text: `服务区域 ${文本(取(行, "serviceAreas"), "未维护")}` },
    ],
  },
  详情: [
    { 标签: "渠道商名称", 取值: (行) => 文本(行.标题, 行.渠道名称, "—") },
    { 标签: "渠道等级", 取值: 等级文本 },
    { 标签: "所属区域", 取值: (行) => 文本(取(行, "region"), "未填写") },
    { 标签: "归属大区", 取值: (行) => 文本(取(行, "bigRegion"), "未填写") },
    { 标签: "负责人", 取值: (行) => 文本(取(行, "contact", "bossName"), "未维护") },
    { 标签: "联系电话", 取值: (行) => 文本(取(行, "phone", "bossPhone"), "未维护") },
    { 标签: "成员账号", 取值: (行) => `${成员数(行)} 人` },
    { 标签: "代理品牌", 取值: (行) => 文本(取(行, "agencyBrands"), "未维护") },
    { 标签: "年营收规模", 取值: (行) => 文本(取(行, "annualRevenue"), "未维护") },
    { 标签: "加入日期", 取值: (行) => 文本(取(行, "joinDate"), "—") },
  ],
  指标: [
    { 标签: "渠道商总数", 单位: "家", 说明: "当前数据范围", 取值: (行列表) => String(行列表.length) },
    {
      标签: "核心渠道",
      单位: "家",
      说明: "合作层级较高",
      取值: (行列表) =>
        String(行列表.filter((行) => ["一级渠道", "核心渠道"].includes(等级文本(行))).length),
    },
    {
      标签: "金牌渠道",
      单位: "家",
      说明: "金牌级别",
      取值: (行列表) => String(行列表.filter((行) => 等级文本(行) === "金牌").length),
    },
    {
      标签: "已维护成员",
      单位: "家",
      说明: "有渠道成员账号",
      取值: (行列表) => String(行列表.filter((行) => 成员数(行) > 0).length),
    },
    {
      标签: "成员总数",
      单位: "人",
      说明: "渠道成员合计",
      取值: (行列表) => String(行列表.reduce((合计, 行) => 合计 + 成员数(行), 0)),
    },
    {
      标签: "覆盖区域数",
      单位: "个",
      说明: "去重后的区域数量",
      取值: (行列表) => String(new Set(行列表.map((行) => 取(行, "region")).filter(Boolean)).size),
    },
  ],
  说明: "渠道报表按当前账号数据范围统计渠道层级、区域覆盖与成员规模；业务贡献与回款口径待业务确认后补充。",
};
</script>

<template>
  <GenericWarModulePage :配置="配置" />
</template>
