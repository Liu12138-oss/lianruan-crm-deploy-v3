<script setup lang="ts">
import type { 阶段9记录 } from "../../api/business-client.js";
import GenericWarModulePage, {
  type 模块配置,
} from "../common/GenericWarModulePage.vue";
import { 金额文本, 日期文本, 文本 } from "../../shared/format/business-format.js";

function 取(行: 阶段9记录, ...键列表: string[]): string {
  const 数据 = (行.原始数据 as Record<string, unknown>) || {};
  return 文本(...键列表.map((键) => 数据[键]), ...键列表.map((键) => (行 as never)?.[键]));
}

function 状态文本(行: 阶段9记录): string {
  // 账号状态以服务端 status_code（接口「状态」字段）为准；
  // 原始数据里的 status 是历史迁移遗留字段，可能与正式状态不一致。
  const 代码 = 文本(行.状态, 取(行, "status", "statusCode"));
  if (代码 === "active") return "启用";
  if (代码 === "disabled" || 代码 === "inactive") return "停用";
  return 文本(行.状态名称, 代码, "未知状态");
}

/** 角色中文名：历史数据里可能存后端角色代码，统一翻译成用户能看懂的角色名称。 */
const 角色中文映射: Record<string, string> = {
  superadmin: "超级管理员",
  admin: "管理员",
  region_admin: "区域管理员",
  region_manager: "区域管理员",
  partner_admin: "渠道管理员",
  partner_user: "渠道用户",
  channel_sales: "渠道销售",
  staff: "内部员工",
  sales: "销售代表",
};

function 角色文本(行: 阶段9记录): string {
  const 原值 = 文本(取(行, "staffRole", "businessRoleCode", "role", "roleName"));
  if (!原值) return "未设置角色";
  return 角色中文映射[原值] || (/[\u4e00-\u9fa5]/.test(原值) ? 原值 : "其他角色");
}

/** 所属渠道：优先展示渠道名称，取不到名称时不再展示内部渠道编号。 */
function 渠道文本(行: 阶段9记录): string {
  const 名称 = 取(行, "partnerName");
  if (名称) return 名称;
  return 取(行, "partnerId") ? "渠道账号" : "内部账号";
}

const 配置: 模块配置 = {
  模块: "users",
  列表标题: "账号列表",
  搜索占位: "搜索用户名、姓名、角色或区域",
  标签: ["全部", "总部账号", "区域账号", "渠道账号"],
  卡片: {
    标题: (行) => 文本(取(行, "displayName", "name"), 行.标题, 取(行, "username"), "未命名账号"),
    说明: (行) =>
      `${角色文本(行)} · ${文本(
        取(行, "region", "regionName"),
        "总部账号",
      )}`,
    徽标: 状态文本,
    色调: (行) => (状态文本(行) === "启用" ? "green" : "gray"),
    归属: (行) =>
      `角色：${角色文本(行)}`,
    金额: (行) => 文本(取(行, "region", "regionName"), "总部"),
    标签: (行) => [
      { text: `账号 ${文本(取(行, "username"), "—")}` },
      {
        text: 取(行, "partnerName")
          ? `渠道：${取(行, "partnerName")}`
          : 取(行, "partnerId")
            ? "渠道账号"
            : "内部账号",
      },
      { text: 状态文本(行), hot: 状态文本(行) === "启用" },
    ],
  },
  详情: [
    { 标签: "用户名", 取值: (行) => 文本(取(行, "username"), "—") },
    { 标签: "姓名", 取值: (行) => 文本(取(行, "displayName", "name"), "—") },
    {
      标签: "角色",
      取值: (行) => 角色文本(行),
    },
    { 标签: "账号状态", 取值: 状态文本 },
    {
      标签: "所属渠道",
      取值: (行) => 渠道文本(行),
    },
    { 标签: "所属区域", 取值: (行) => 文本(取(行, "region", "regionName"), "总部") },
    { 标签: "邮箱", 取值: (行) => 文本(取(行, "email"), "未维护") },
    { 标签: "手机号", 取值: (行) => 文本(取(行, "phone", "mobile"), "未维护") },
    { 标签: "创建时间", 取值: (行) => 日期文本(行.创建时间) },
    { 标签: "数据范围", 取值: (行) => 文本(取(行, "dataScope", "scope"), "按角色默认") },
  ],
  指标: [
    { 标签: "账号总数", 单位: "个", 说明: "当前数据范围内账号", 取值: (行列表) => String(行列表.length) },
    {
      标签: "启用中",
      单位: "个",
      说明: "状态为启用",
      取值: (行列表) => String(行列表.filter((行) => 状态文本(行) === "启用").length),
    },
    {
      标签: "已停用",
      单位: "个",
      说明: "状态为停用",
      取值: (行列表) => String(行列表.filter((行) => 状态文本(行) === "停用").length),
    },
    {
      标签: "总部 / 区域",
      单位: "个",
      说明: "无区域的为总部账号，其余为区域账号",
      取值: (行列表) =>
        `${行列表.filter((行) => !取(行, "region")).length} / ${
          行列表.filter((行) => Boolean(取(行, "region"))).length
        }`,
    },
    {
      标签: "渠道账号",
      单位: "个",
      说明: "绑定了渠道商的账号",
      取值: (行列表) => String(行列表.filter((行) => Boolean(取(行, "partnerId"))).length),
    },
    {
      标签: "未维护手机",
      单位: "个",
      说明: "需要补齐联系方式",
      取值: (行列表) => String(行列表.filter((行) => !取(行, "phone", "mobile")).length),
    },
  ],
  说明:
    "账号与数据范围由「组织与账号」统一维护：新建用户、调整组织架构、岗位与权限范围请进入组织工作区操作；本页用于集中查看与核对。",
  维护入口: { 文案: "前往组织与账号维护", 路径: "/admin/organization" },
};

void 金额文本;
</script>

<template>
  <GenericWarModulePage :配置="配置" />
</template>
