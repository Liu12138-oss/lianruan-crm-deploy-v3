import type { 登录用户 } from "../../api/auth-client.js";
import { 可访问管理配置 } from "../permission/role.js";

export interface 顶部导航子项 {
  名称: string;
  路径: string;
  描述: string;
}

export interface 顶部导航项 {
  名称: string;
  简称: string;
  路径: string;
  权限: "all_admin" | "superadmin";
  /** 管理配置类一级菜单的二级菜单；业务模块一级菜单不配置。 */
  子项?: 顶部导航子项[];
}

export const 管理端顶部导航: 顶部导航项[] = [
  { 名称: "业务全景", 简称: "业务全景", 路径: "/admin/platform-admin", 权限: "superadmin" },
  { 名称: "工作台", 简称: "工作台", 路径: "/admin/dashboard", 权限: "all_admin" },
  { 名称: "客户管理", 简称: "客户", 路径: "/admin/registration", 权限: "all_admin" },
  { 名称: "线索管理", 简称: "线索", 路径: "/admin/leads", 权限: "all_admin" },
  { 名称: "商机作战", 简称: "商机", 路径: "/admin/opportunity", 权限: "all_admin" },
  { 名称: "订单中心", 简称: "订单", 路径: "/admin/order", 权限: "all_admin" },
  { 名称: "审核中心", 简称: "审核", 路径: "/admin/admin-review", 权限: "all_admin" },
  { 名称: "产品目录", 简称: "产品", 路径: "/admin/products", 权限: "all_admin" },
  { 名称: "消息中心", 简称: "消息", 路径: "/admin/notifications", 权限: "all_admin" },
  { 名称: "渠道管理", 简称: "渠道", 路径: "/admin/partners", 权限: "all_admin" },
  {
    名称: "管理配置",
    简称: "配置",
    路径: "/admin/organization",
    权限: "superadmin",
    子项: [
      {
        名称: "组织与账号",
        路径: "/admin/organization",
        描述: "组织架构、岗位、成员、角色、权限范围与账号生命周期。",
      },
      {
        名称: "角色与权限",
        路径: "/admin/organization/business-roles",
        描述: "业务角色、角色成员和维护权限。",
      },
      {
        名称: "数据范围",
        路径: "/admin/organization/data-scopes",
        描述: "总部、区域、渠道与个人数据的可见范围。",
      },
      {
        名称: "证书与风险",
        路径: "/admin/certifications",
        描述: "证书模板、员工持证、延期、撤销和到期风险。",
      },
      {
        名称: "审核与业务规则",
        路径: "/admin/admin-review",
        描述: "客户报备、渠道商、成员账号和订单审批入口。",
      },
      {
        名称: "消息与提醒",
        路径: "/admin/notifications/platform",
        描述: "站内通知、提醒规则、外部渠道和投递状态。",
      },
      {
        名称: "操作审计",
        路径: "/admin/audit-logs",
        描述: "关键业务动作、接口调用和风险事件追踪。",
      },
      {
        名称: "开放接口",
        路径: "/admin/openapi-integration",
        描述: "OpenAPI 客户端、密钥、IP 白名单和资源范围。",
      },
      {
        名称: "工作量配置",
        路径: "/admin/workload-config",
        描述: "工作量映射、交付规则、产品类别和人天试算。",
      },
      {
        名称: "数据导入导出",
        路径: "/admin/data-import-export",
        描述: "客户、商机、渠道、员工和组织数据的批量导入入口。",
      },
      {
        名称: "系统版本与服务状态",
        路径: "/admin/system-status",
        描述: "运行版本、服务存活、依赖组件、数据库迁移与构建信息。",
      },
    ],
  },
];

/** 管理配置二级菜单的归属路径：含组织工作区与账号管理页。 */
const 管理配置归属路径 = [
  "/admin/organization",
  "/admin/account-manage",
  "/workspace/admin/platform-admin/organization",
];

export function 可见管理端顶部导航(用户: 登录用户 | null | undefined): 顶部导航项[] {
  return 管理端顶部导航.filter((项目) => 项目.权限 !== "superadmin" || 可访问管理配置(用户));
}

/** 判断某个二级菜单项是否处于激活态。 */
export function 判断子项激活(路径: string, 子项: 顶部导航子项): boolean {
  // 审核中心已经升级为独立一级入口（见「审核中心」导航项），
  // 配置菜单里的「审核与业务规则」仅保留跳转能力，不参与激活，避免两个一级菜单同时高亮。
  if (子项.路径 === "/admin/admin-review") return false;
  if (子项.路径 === "/admin/notifications/platform") {
    // 「消息与提醒」同时覆盖渠道配置和提醒规则；两条路径保持同一二级导航上下文，
    // 返回按钮才不会因二级导航条出现与否产生 42px 的纵向错位。
    return ["/admin/notifications/platform", "/admin/notifications/rules"].some(
      (当前路径) => 路径 === 当前路径 || 路径.startsWith(`${当前路径}/`),
    );
  }
  if (子项.路径 === "/admin/organization") {
    // 「组织与账号」是管理配置的总入口；角色与权限、数据范围也有 /admin/organization/* 子路径。
    // 这些子路径必须只高亮自己的二级菜单，否则会出现两个菜单同时选中。
    const 其他子项路径 = ["/admin/organization/business-roles", "/admin/organization/data-scopes"];
    if (其他子项路径.some((其他) => 路径 === 其他 || 路径.startsWith(`${其他}/`))) return false;
    return 管理配置归属路径.some((归属) => 路径 === 归属 || 路径.startsWith(`${归属}/`));
  }
  return 路径 === 子项.路径 || 路径.startsWith(`${子项.路径}/`);
}

export function 判断导航激活(路径: string, 项目: 顶部导航项): boolean {
  if (项目.路径 === "/admin/platform-admin") {
    return 路径 === "/admin/platform-admin";
  }
  if (项目.路径 === "/admin/opportunity") {
    return ["/admin/opportunity", "/admin/quote"].some(
      (当前路径) => 路径 === 当前路径 || 路径.startsWith(`${当前路径}/`),
    );
  }
  if (项目.路径 === "/admin/products") {
    // 工作量配置同时是管理配置的正式入口，避免一级菜单重复高亮。
    return 路径 === "/admin/products" || 路径.startsWith("/admin/products/");
  }
  if (项目.路径 === "/admin/notifications") {
    // 消息渠道配置与提醒规则属于管理配置，不再归属消息中心一级菜单。
    if (
      ["/admin/notifications/platform", "/admin/notifications/rules"].some(
        (子路径) => 路径 === 子路径 || 路径.startsWith(`${子路径}/`),
      )
    ) {
      return false;
    }
    return 路径 === 项目.路径 || 路径.startsWith(`${项目.路径}/`);
  }
  if (项目.子项?.length) {
    return 项目.子项.some((子项) => 判断子项激活(路径, 子项));
  }
  return 路径 === 项目.路径 || 路径.startsWith(`${项目.路径}/`);
}

/** 取当前路径命中的一级菜单；用于渲染该菜单的二级菜单条。 */
export function 取当前一级导航(路径: string, 导航项列表: 顶部导航项[]): 顶部导航项 | undefined {
  return 导航项列表.find((项目) => 项目.子项?.length && 判断导航激活(路径, 项目));
}
