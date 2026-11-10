<script setup lang="ts">
import type { 阶段9记录 } from "../../api/business-client.js";
import { 文本, 渠道等级文本 as 读取渠道等级文本 } from "../../shared/format/business-format.js";
import GenericWarModulePage, { type 模块配置 } from "../common/GenericWarModulePage.vue";

function 取(行: 阶段9记录, ...键列表: string[]): string {
  const 数据 = (行.原始数据 as Record<string, unknown>) || {};
  return 文本(...键列表.map((键) => 数据[键]), ...键列表.map((键) => (行 as never)?.[键]));
}

function 成员数(行: 阶段9记录): number {
  const 成员 = (行.原始数据 as Record<string, unknown>)?.staff;
  return Array.isArray(成员) ? 成员.length : 0;
}

function 分销层级代码(行: 阶段9记录): string {
  return 取(行, "partnerLevel").toLowerCase();
}

function 合作级别代码(行: 阶段9记录): string {
  const 代码 = 取(行, "cooperationLevel", "level").toLowerCase();
  return ["lep", "diamond", "gold", "silver", "bronze", "industry"].includes(代码) ? 代码 : "none";
}

/** 与渠道列表保持一致：同时展示分销层级和合作级别，避免报表丢失铜牌/金牌等信息。 */
function 等级文本(行: 阶段9记录): string {
  const 分销层级代码值 = 分销层级代码(行);
  const 合作级别 = 合作级别代码(行);
  const 分销层级 =
    分销层级代码值 === "primary" || 分销层级代码值 === "secondary"
      ? 读取渠道等级文本(分销层级代码值)
      : "未分级";
  const 合作级别名称 = 合作级别 === "none" ? "" : 读取渠道等级文本(合作级别);
  return (
    [分销层级, 合作级别名称]
      .filter((值, 下标, 列表) => 值 && 值 !== "未分级" && 列表.indexOf(值) === 下标)
      .join(" · ") || "未分级"
  );
}

function 经营摘要(行: 阶段9记录): Record<string, number> {
  const 摘要 = (行.原始数据 as Record<string, unknown>)?.经营摘要;
  return 摘要 && typeof 摘要 === "object" && !Array.isArray(摘要)
    ? (摘要 as Record<string, number>)
    : {};
}

function 经营数字(行: 阶段9记录, 键: string): number {
  return Number(经营摘要(行)[键] || 0);
}

function 金额文本(金额: number): string {
  return `¥${Number(金额 || 0).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
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
      分销层级代码(行) === "primary" || 合作级别代码(行) === "lep"
        ? "blue"
        : 合作级别代码(行) === "gold"
          ? "amber"
          : "gray",
    归属: (行) => `负责人：${文本(取(行, "contact", "bossName"), "未维护")}`,
    金额: (行) => `订单 ${金额文本(经营数字(行, "订单金额"))}`,
    标签: (行) => [
      { text: `成员 ${成员数(行)} 人`, hot: 成员数(行) > 0 },
      { text: `客户 ${经营数字(行, "客户数")}`, hot: 经营数字(行, "客户数") > 0 },
      { text: `商机 ${经营数字(行, "商机数")}`, hot: 经营数字(行, "商机数") > 0 },
      { text: `报价 ${经营数字(行, "报价单数")}`, hot: 经营数字(行, "报价单数") > 0 },
      { text: `订单 ${经营数字(行, "订单数")}`, hot: 经营数字(行, "订单数") > 0 },
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
    { 标签: "客户（去重）", 取值: (行) => `${经营数字(行, "客户数")} 家` },
    { 标签: "在管商机", 取值: (行) => `${经营数字(行, "商机数")} 条` },
    { 标签: "有效报价", 取值: (行) => `${经营数字(行, "报价单数")} 条` },
    { 标签: "有效订单", 取值: (行) => `${经营数字(行, "订单数")} 条` },
    { 标签: "有效商机金额", 取值: (行) => 金额文本(经营数字(行, "商机金额")) },
    { 标签: "有效订单金额", 取值: (行) => 金额文本(经营数字(行, "订单金额")) },
    { 标签: "全链路转化率", 取值: (行) => `${经营数字(行, "全链路转化率")}%` },
    { 标签: "代理品牌", 取值: (行) => 文本(取(行, "agencyBrands"), "未维护") },
    { 标签: "年营收规模", 取值: (行) => 文本(取(行, "annualRevenue"), "未维护") },
    { 标签: "加入日期", 取值: (行) => 文本(取(行, "joinDate"), "—") },
  ],
  指标: [
    {
      标签: "渠道商总数",
      单位: "家",
      说明: "当前数据范围",
      取值: (行列表) => String(行列表.length),
    },
    {
      标签: "核心渠道",
      单位: "家",
      说明: "合作层级较高",
      取值: (行列表) =>
        String(
          行列表.filter((行) => 分销层级代码(行) === "primary" || 合作级别代码(行) === "lep")
            .length,
        ),
    },
    {
      标签: "金牌渠道",
      单位: "家",
      说明: "金牌级别",
      取值: (行列表) => String(行列表.filter((行) => 合作级别代码(行) === "gold").length),
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
    {
      标签: "有效商机金额",
      单位: "元",
      说明: "排除取消与驳回商机",
      取值: (行列表) => String(行列表.reduce((合计, 行) => 合计 + 经营数字(行, "商机金额"), 0)),
    },
    {
      标签: "有效订单金额",
      单位: "元",
      说明: "排除取消、驳回与替换订单",
      取值: (行列表) => String(行列表.reduce((合计, 行) => 合计 + 经营数字(行, "订单金额"), 0)),
    },
  ],
  说明: "渠道报表按当前账号数据范围统计渠道层级、区域覆盖、成员规模与有效经营数据；经营摘要与渠道列表、核心档案共用服务端口径。",
};
</script>

<template>
  <GenericWarModulePage :配置="配置" />
</template>
