import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { 应用错误, 清理日志字段 } from "@lianruan/shared";
import { Pool, type PoolClient } from "pg";

export type 阶段9模块 =
  | "registrations"
  | "opportunities"
  | "quotes"
  | "orders"
  | "partners"
  | "products"
  | "users"
  | "audit"
  | "openapi"
  | "workload"
  | "importExport"
  | "approvals"
  | "notifications";

export interface 当前业务用户 {
  requestId?: string;
  userId?: string;
  externalUserId?: string;
  username: string;
  displayName: string;
  roleCode?: string;
  roleName: string;
  dataScopeCode?: string;
  regionId?: string;
  regionName?: string;
  partnerIds?: string[];
  partnerExternalIds?: string[];
  partnerName?: string;
}

interface 业务用户上下文 {
  userId: string;
  externalUserId: string;
  username: string;
  displayName: string;
  roleCode: string;
  roleName: string;
  dataScopeCode: string;
  regionId: string;
  regionName: string;
  partnerIds: string[];
  partnerExternalIds: string[];
  partnerName: string;
}

interface 业务归属结果 {
  partnerId: string | null;
  partnerName: string;
  ownerUserId: string | null;
  ownerUserName: string;
  regionId: string | null;
  regionName: string;
}

export interface 阶段9查询参数 {
  keyword?: string | undefined;
  status?: string | undefined;
  level?: string | undefined;
  region?: string | undefined;
  userId?: string | undefined;
  partnerId?: string | undefined;
  operatorId?: string | undefined;
  productType?: "feature" | "hardware" | "package" | undefined;
  page: number;
  pageSize: number;
}

export interface 阶段9记录 {
  id: string;
  编号: string;
  类型: string;
  标题: string;
  客户名称: string;
  渠道名称: string;
  负责人: string;
  区域: string;
  状态: string;
  状态名称: string;
  金额: number;
  创建时间: string;
  更新时间: string;
  原始数据: Record<string, unknown>;
}

export interface 阶段9列表结果 {
  数据: 阶段9记录[];
  分页: {
    页码: number;
    每页: number;
    总数: number;
  };
}

export interface 阶段9概览 {
  统计: Array<{
    标题: string;
    数量: number;
    说明: string;
  }>;
  待办: 阶段9记录[];
  最近业务: 阶段9记录[];
  迁移状态: {
    批次编号: string;
    正式落表: string;
    校验结论: string;
  };
}

export interface 报价试算结果 {
  endpoints: number;
  productIds: string[];
  hardwareIds: string[];
  items: Array<{
    id: string;
    名称: string;
    类型: string;
    数量: number;
    单价: number;
    小计: number;
  }>;
  total: number;
  workloadDays: number;
  workloadSummary: string;
}

export interface 开放接口总览 {
  baseUrl: string;
  tokenEndpoint: string;
  tokenTtlSeconds: number;
  coreResources: string[];
  docs: Array<{
    id: string;
    title: string;
    description: string;
    fileName: string;
    available: boolean;
  }>;
}

export interface 开放接口客户端 {
  id: string;
  name: string;
  appKey: string;
  boundUserId: string;
  status: string;
  ipWhitelist: string[];
  allowedResources: string[];
  expiresAt: string;
  remark: string;
  secretResetRequired: boolean;
  boundUser?: { id: string; username: string; name: string; role: string } | undefined;
}

export interface 开放接口密钥结果 {
  id: string;
  appKey: string;
  appSecret: string;
}

export interface 开放接口日志 {
  id: string;
  requestId: string;
  time: string;
  clientName: string;
  resultCode: number;
  method: string;
  path: string;
  ip: string;
  resultMessage: string;
}

export interface 开放接口令牌 {
  accessToken: string;
  tokenType: "Bearer";
  expiresInSeconds: number;
  allowedResources: string[];
}

export interface 开放接口身份 {
  clientId: string;
  clientName: string;
  appKey: string;
  allowedResources: string[];
  boundUserId: string;
  boundUserName: string;
}

export interface 工作量映射项 {
  featureId: string;
  featureName: string;
  itemType: "feature" | "hardware";
  moduleName: string;
  categoryName: string;
  productCode: string;
  deliveryTags: string[];
  active: boolean;
}

export interface 交付工作量规则项 {
  id: string;
  item: string;
  productTypeLabel: string;
  deliveryTag: string;
  condition: string;
  ruleType: string;
  minPoints: number | null;
  maxPoints: number | null;
  personDays: number;
  comboPersonDays: number | null;
  remark: string;
  active: boolean;
}

export interface 业务数据服务 {
  读取概览(): Promise<阶段9概览>;
  查询列表(
    模块: 阶段9模块,
    查询: 阶段9查询参数,
    用户?: 当前业务用户 | null,
  ): Promise<阶段9列表结果>;
  查询到期提醒(用户: 当前业务用户 | null): Promise<到期提醒项[]>;
  查询详情(模块: 阶段9模块, id: string, 用户?: 当前业务用户 | null): Promise<阶段9记录>;
  创建报备(输入: Record<string, unknown>, 用户: 当前业务用户 | null): Promise<阶段9记录>;
  更新报备(
    id: string,
    输入: Record<string, unknown>,
    用户: 当前业务用户 | null,
  ): Promise<阶段9记录>;
  更新报备状态(
    id: string,
    输入: Record<string, unknown>,
    用户: 当前业务用户 | null,
  ): Promise<阶段9记录>;
  审核移动端报备状态(
    id: string,
    输入: Record<string, unknown>,
    用户: 当前业务用户,
  ): Promise<阶段9记录>;
  执行移动端幂等<T>(参数: 移动端幂等参数, 操作: () => Promise<T>): Promise<T>;
  创建商机(输入: Record<string, unknown>, 用户: 当前业务用户 | null): Promise<阶段9记录>;
  更新商机(
    id: string,
    输入: Record<string, unknown>,
    用户: 当前业务用户 | null,
  ): Promise<阶段9记录>;
  试算报价(输入: Record<string, unknown>): Promise<报价试算结果>;
  创建报价(输入: Record<string, unknown>, 用户: 当前业务用户 | null): Promise<阶段9记录>;
  更新报价(
    id: string,
    输入: Record<string, unknown>,
    用户: 当前业务用户 | null,
  ): Promise<阶段9记录>;
  更新报价状态(
    id: string,
    输入: Record<string, unknown>,
    用户: 当前业务用户 | null,
  ): Promise<阶段9记录>;
  创建订单(输入: Record<string, unknown>, 用户: 当前业务用户 | null): Promise<阶段9记录>;
  更新订单状态(
    id: string,
    输入: Record<string, unknown>,
    用户: 当前业务用户 | null,
  ): Promise<阶段9记录>;
  更新渠道商状态(
    id: string,
    输入: Record<string, unknown>,
    用户: 当前业务用户 | null,
  ): Promise<阶段9记录>;
  更新待审批状态(
    id: string,
    输入: Record<string, unknown>,
    用户: 当前业务用户 | null,
  ): Promise<阶段9记录>;
  读取开放接口总览(baseUrl: string): Promise<开放接口总览>;
  查询开放接口客户端(): Promise<开放接口客户端[]>;
  创建开放接口客户端(
    输入: Record<string, unknown>,
    用户: 当前业务用户 | null,
  ): Promise<开放接口密钥结果>;
  更新开放接口客户端(
    id: string,
    输入: Record<string, unknown>,
    用户: 当前业务用户 | null,
  ): Promise<开放接口客户端>;
  重置开放接口密钥(id: string, 用户: 当前业务用户 | null): Promise<开放接口密钥结果>;
  查询开放接口日志(limit: number): Promise<开放接口日志[]>;
  签发开放接口令牌(
    输入: Record<string, unknown>,
    ip: string,
    requestId?: string,
  ): Promise<开放接口令牌>;
  读取开放接口身份(token: string): Promise<开放接口身份>;
  记录开放接口调用(输入: {
    clientId?: string;
    requestId?: string;
    resourceCode: string;
    actionCode: string;
    resultCode: string;
    statusCode: number;
    durationMs: number;
    method: string;
    path: string;
    ip: string;
    message: string;
    extra?: Record<string, unknown>;
  }): Promise<void>;
  查询工作量映射(keyword?: string): Promise<工作量映射项[]>;
  保存工作量映射(
    productId: string,
    输入: Record<string, unknown>,
    用户: 当前业务用户 | null,
  ): Promise<工作量映射项>;
  查询交付工作量规则(): Promise<交付工作量规则项[]>;
  保存交付工作量规则(
    id: string,
    输入: Record<string, unknown>,
    用户: 当前业务用户 | null,
  ): Promise<交付工作量规则项>;
}

export interface 移动端幂等参数 {
  作用域: string;
  幂等键: string;
  请求哈希: string;
}

export interface 到期提醒项 {
  type: "registration" | "opportunity";
  targetId: string;
  targetName: string;
  customer: string;
  dueDate: string;
  daysLeft: number;
}

const 状态中文: Record<string, string> = {
  active: "启用",
  disabled: "停用",
  draft: "草稿",
  pending: "待审核",
  approved: "已通过",
  rejected: "已驳回",
  cancelled: "已取消",
  converted: "已转订单",
  submitted: "已提交",
  won: "已赢单",
  lost: "已丢单",
  pending_primary_confirm: "待一级确认",
  primary_confirmed: "一级已确认",
  primary_rejected: "一级已驳回",
  pending_superadmin_confirm: "待超管确认",
  confirmed: "已确认",
  processing: "处理中",
  shipped: "已发货",
  completed: "已完成",
  unread: "未读",
  read: "已读",
  queued: "排队中",
  running: "执行中",
  succeeded: "已成功",
  failed: "已失败",
};

function 校验超级管理员(用户: 当前业务用户 | null): void {
  if (!用户 || 用户.roleCode !== "superadmin") {
    throw new 应用错误("V3_PERMISSION_DENIED", "只有超级管理员可以处理该审核事项。", 403);
  }
}

function 校验超级管理员上下文(用户: 业务用户上下文 | null): void {
  if (!用户 || 用户.roleCode !== "superadmin") {
    throw new 应用错误("V3_PERMISSION_DENIED", "只有超级管理员可以处理该审核事项。", 403);
  }
}

function 校验移动端审核管理员(用户: 当前业务用户): void {
  if (用户.roleCode !== "admin" && 用户.roleCode !== "superadmin") {
    throw new 应用错误("V3_PERMISSION_DENIED", "只有管理角色可以处理移动端审核。", 403);
  }
}

function 规范渠道审核状态(value: string): "active" | "disabled" {
  if (value === "active") return "active";
  if (value === "rejected" || value === "disabled") return "disabled";
  throw new 应用错误("V3_PARTNER_STATUS_INVALID", "渠道商审核状态不正确。", 400);
}

export function 创建业务数据服务(参数: { databaseUrl?: string }): 业务数据服务 {
  if (参数.databaseUrl) return new PostgreSQL业务数据服务(参数.databaseUrl);
  return new 内存业务数据服务();
}

class 内存业务数据服务 implements 业务数据服务 {
  private readonly 数据: Record<string, Record<string, unknown>[]>;
  private readonly 记录: Map<阶段9模块, 阶段9记录[]>;
  private readonly 移动端幂等记录 = new Map<
    string,
    {
      请求哈希: string;
      状态: "处理中" | "成功";
      响应: unknown;
    }
  >();

  public constructor() {
    this.数据 = 读取阶段8导出数据();
    this.记录 = new Map([
      ["registrations", this.取原始集合("registrations").map((项) => 转报备记录(项))],
      ["opportunities", this.取原始集合("opportunities").map((项) => 转商机记录(项))],
      ["quotes", this.取原始集合("quotes").map((项) => 转报价记录(项))],
      ["orders", this.取原始集合("orders").map((项) => 转订单记录(项))],
      ["partners", this.取原始集合("partners").map((项) => 转渠道记录(项))],
      ["products", this.读取内存产品记录()],
      ["users", this.取原始集合("users").map((项) => 转账号记录(项))],
      ["audit", this.取原始集合("audit_logs").map((项) => 转审计记录(项))],
      ["openapi", this.取原始集合("openApiClients").map((项) => 转开放接口记录(项))],
      ["workload", this.读取内存工作量记录()],
      ["importExport", []],
      ["approvals", this.取原始集合("pendingApprovals").map((项) => 转审核记录(项))],
      ["notifications", this.取原始集合("notifications").map((项) => 转通知记录(项))],
    ]);
  }

  public async 读取概览(): Promise<阶段9概览> {
    const 待办 = this.取记录集合("registrations")
      .filter((项) => 项.状态 === "pending")
      .slice(0, 8);
    const 最近业务 = [
      ...this.取记录集合("registrations"),
      ...this.取记录集合("opportunities"),
      ...this.取记录集合("quotes"),
      ...this.取记录集合("orders"),
    ]
      .sort((左, 右) => 右.创建时间.localeCompare(左.创建时间))
      .slice(0, 8);
    return {
      统计: [
        this.统计项("渠道商", "partners", "阶段8正式源库渠道体系"),
        this.统计项("客户报备", "registrations", "迁移客户保护记录"),
        this.统计项("商机", "opportunities", "迁移销售机会记录"),
        this.统计项("报价单", "quotes", "报价与工作量快照"),
        this.统计项("订单", "orders", "报价转订单结果"),
        this.统计项("产品", "products", "软件、硬件、套餐"),
      ],
      待办,
      最近业务,
      迁移状态: {
        批次编号: "S8-RUN-20260727-001",
        正式落表: "本地样本模式",
        校验结论: "用于阶段9本地验证，生产以PostgreSQL正式表为准",
      },
    };
  }

  public async 查询列表(
    模块: 阶段9模块,
    查询: 阶段9查询参数,
    _用户?: 当前业务用户 | null,
  ): Promise<阶段9列表结果> {
    return 分页列表(this.取记录集合(模块), 查询);
  }

  public async 查询到期提醒(_用户: 当前业务用户 | null): Promise<到期提醒项[]> {
    return [];
  }

  public async 查询详情(
    模块: 阶段9模块,
    id: string,
    _用户?: 当前业务用户 | null,
  ): Promise<阶段9记录> {
    const 记录 = this.取记录集合(模块).find((项) => 项.id === id || 项.编号 === id);
    if (!记录) throw new 应用错误("V3_STAGE9_NOT_FOUND", "未找到业务记录。", 404);
    return 记录;
  }

  public async 创建报备(
    输入: Record<string, unknown>,
    用户: 当前业务用户 | null,
  ): Promise<阶段9记录> {
    const 渠道 = this.读取渠道(输入);
    const 客户名称 = 读取文本(输入, ["customer", "customerName", "客户名称"], "阶段9测试客户");
    const now = new Date().toISOString();
    const 原始数据 = {
      id: "REG-V3-" + Date.now(),
      customer: 客户名称,
      creditCode: 读取文本(输入, ["creditCode", "统一社会信用代码"], ""),
      contact: 读取文本(输入, ["contact", "联系人"], ""),
      phone: 读取文本(输入, ["phone", "联系电话"], ""),
      assignedStaffName: 用户?.displayName || "阶段9测试账号",
      partnerId: 渠道.id,
      partnerName: 渠道.name,
      region: 渠道.region,
      status: "pending",
      createdByName: 用户?.displayName || "阶段9测试账号",
      createdAt: now,
      updatedAt: now,
    };
    const 记录 = 转报备记录(原始数据);
    this.取记录集合("registrations").unshift(记录);
    this.取记录集合("approvals").unshift(
      转审核记录({
        id: `APP-${记录.id}`,
        type: "registration",
        targetType: "registration",
        targetId: 记录.id,
        targetName: 客户名称,
        customerName: 客户名称,
        targetPartnerName: 渠道.name,
        region: 渠道.region,
        contact: 读取文本(输入, ["contact", "联系人"], ""),
        phone: 读取文本(输入, ["phone", "联系电话"], ""),
        industry: 读取文本(输入, ["industry", "行业"], ""),
        status: "pending",
        createdBy: 用户?.displayName || "阶段9测试账号",
        createdAt: now,
        updatedAt: now,
      }),
    );
    return 记录;
  }

  public async 更新报备状态(
    id: string,
    输入: Record<string, unknown>,
    用户: 当前业务用户 | null,
  ): Promise<阶段9记录> {
    const 记录 = await this.查询详情("registrations", id);
    const 状态 = 读取文本(输入, ["status", "状态"], "approved");
    记录.状态 = 规范报备状态(状态);
    记录.状态名称 = 状态中文[记录.状态] || 记录.状态;
    记录.更新时间 = new Date().toISOString();
    记录.原始数据 = {
      ...记录.原始数据,
      status: 记录.状态,
      updatedAt: 记录.更新时间,
      updatedByName: 用户?.displayName || "阶段9测试账号",
      reviewRemark: 读取文本(输入, ["reason", "remark", "审核意见"], ""),
    };
    const 审批记录 = this.取记录集合("approvals").find(
      (项) => 读取记录文本(项, ["targetId"]) === 记录.id || 项.id === `APP-${记录.id}`,
    );
    if (审批记录) {
      审批记录.状态 = 记录.状态;
      审批记录.状态名称 = 状态中文[记录.状态] || 记录.状态;
      审批记录.更新时间 = 记录.更新时间;
      审批记录.原始数据 = {
        ...审批记录.原始数据,
        status: 记录.状态,
        updatedAt: 记录.更新时间,
        updatedByName: 用户?.displayName || "阶段9测试账号",
      };
    }
    return 记录;
  }

  public async 审核移动端报备状态(
    id: string,
    输入: Record<string, unknown>,
    用户: 当前业务用户,
  ): Promise<阶段9记录> {
    校验移动端审核管理员(用户);
    return this.更新报备状态(id, 输入, 用户);
  }

  public async 执行移动端幂等<T>(参数: 移动端幂等参数, 操作: () => Promise<T>): Promise<T> {
    const 编号 = `${参数.作用域}:${参数.幂等键}`;
    const 已有记录 = this.移动端幂等记录.get(编号);
    if (已有记录) {
      if (已有记录.请求哈希 !== 参数.请求哈希) {
        throw new 应用错误("V3_MOBILE_IDEMPOTENCY_CONFLICT", "幂等键已用于不同的请求内容。", 409);
      }
      if (已有记录.状态 === "处理中") {
        throw new 应用错误("V3_MOBILE_IDEMPOTENCY_PROCESSING", "请求正在处理中，请稍后重试。", 409);
      }
      return 已有记录.响应 as T;
    }
    this.移动端幂等记录.set(编号, { 请求哈希: 参数.请求哈希, 状态: "处理中", 响应: null });
    try {
      const 响应 = await 操作();
      this.移动端幂等记录.set(编号, { 请求哈希: 参数.请求哈希, 状态: "成功", 响应 });
      return 响应;
    } catch (error) {
      this.移动端幂等记录.delete(编号);
      throw error;
    }
  }

  public async 更新报备(
    id: string,
    输入: Record<string, unknown>,
    用户: 当前业务用户 | null,
  ): Promise<阶段9记录> {
    const 记录 = await this.查询详情("registrations", id);
    const now = new Date().toISOString();
    const 渠道名称 = 读取文本(输入, ["partnerName", "assignedPartnerName"], 记录.渠道名称);
    const 负责人 = 读取文本(输入, ["assignedStaffName", "ownerName"], 记录.负责人);
    记录.渠道名称 = 渠道名称;
    记录.负责人 = 负责人;
    记录.更新时间 = now;
    记录.原始数据 = {
      ...记录.原始数据,
      ...输入,
      partnerName: 渠道名称,
      assignedPartnerName: 渠道名称,
      assignedStaffName: 负责人,
      updatedAt: now,
      updatedByName: 用户?.displayName || "阶段9测试账号",
    };
    return 记录;
  }

  public async 更新渠道商状态(
    id: string,
    输入: Record<string, unknown>,
    用户: 当前业务用户 | null,
  ): Promise<阶段9记录> {
    校验超级管理员(用户);
    const 记录 = await this.查询详情("partners", id);
    const 状态 = 规范渠道审核状态(读取文本(输入, ["status"], "active"));
    const now = new Date().toISOString();
    记录.状态 = 状态;
    记录.状态名称 = 状态中文[状态] || 状态;
    记录.更新时间 = now;
    记录.原始数据 = {
      ...记录.原始数据,
      status: 状态,
      reviewRemark: 读取文本(输入, ["remark", "reason"], ""),
      reviewedByName: 用户?.displayName || "",
      reviewedAt: now,
      updatedAt: now,
    };
    return 记录;
  }

  public async 更新待审批状态(
    id: string,
    输入: Record<string, unknown>,
    用户: 当前业务用户 | null,
  ): Promise<阶段9记录> {
    校验超级管理员(用户);
    const 记录 = await this.查询详情("approvals", id);
    const 状态 = 读取文本(输入, ["action"], "approve") === "reject" ? "rejected" : "approved";
    const now = new Date().toISOString();
    记录.状态 = 状态;
    记录.状态名称 = 状态中文[状态] || 状态;
    记录.更新时间 = now;
    记录.原始数据 = {
      ...记录.原始数据,
      status: 状态,
      reviewRemark: 读取文本(输入, ["remark", "reason"], ""),
      reviewedByName: 用户?.displayName || "",
      reviewedAt: now,
      updatedAt: now,
    };
    return 记录;
  }

  public async 创建商机(
    输入: Record<string, unknown>,
    用户: 当前业务用户 | null,
  ): Promise<阶段9记录> {
    const 报备编号 = 读取文本(输入, ["registrationId", "regId", "报备编号"], "");
    const 报备 = 报备编号
      ? this.取记录集合("registrations").find((项) => 项.id === 报备编号)
      : null;
    if (报备 && 报备.状态 !== "approved") {
      throw new 应用错误(
        "V3_STAGE9_REGISTRATION_NOT_APPROVED",
        "报备未通过审核，不能创建商机。",
        409,
      );
    }
    const 渠道 = this.读取渠道(输入, 报备?.原始数据);
    const 客户名称 =
      读取文本(输入, ["customer", "customerName", "客户名称"], "") ||
      报备?.客户名称 ||
      "阶段9测试客户";
    const now = new Date().toISOString();
    const 原始数据 = {
      id: 生成内存商机编号(this.取记录集合("opportunities")),
      name: 读取文本(输入, ["name", "opportunityName", "商机名称"], 客户名称 + "商机"),
      customer: 客户名称,
      regId: 报备?.id || 报备编号,
      amount: 读取数字(输入, ["amount", "预计金额"], 0),
      stage: "registered",
      assignedStaffName: 用户?.displayName || "阶段9测试账号",
      partnerId: 渠道.id,
      partnerName: 渠道.name,
      region: 渠道.region,
      createdByName: 用户?.displayName || "阶段9测试账号",
      createdAt: now,
      updatedAt: now,
      followups: [],
    };
    const 记录 = 转商机记录(原始数据);
    this.取记录集合("opportunities").unshift(记录);
    return 记录;
  }

  public async 更新商机(
    id: string,
    输入: Record<string, unknown>,
    用户: 当前业务用户 | null,
  ): Promise<阶段9记录> {
    const 记录 = await this.查询详情("opportunities", id);
    const now = new Date().toISOString();
    const 阶段 = 读取文本(输入, ["stage", "阶段"], 记录.状态);
    记录.状态 = 规范商机状态(阶段);
    记录.状态名称 = 状态中文[记录.状态] || 阶段;
    记录.更新时间 = now;
    const 跟进 = 读取文本(输入, ["followup", "content", "跟进内容"], "");
    const 历史 = Array.isArray(记录.原始数据.followups) ? 记录.原始数据.followups : [];
    记录.原始数据 = {
      ...记录.原始数据,
      stage: 阶段,
      updatedAt: now,
      updatedByName: 用户?.displayName || "阶段9测试账号",
      followups: 跟进
        ? [
            ...历史,
            { content: 跟进, actorName: 用户?.displayName || "阶段9测试账号", createdAt: now },
          ]
        : 历史,
    };
    return 记录;
  }

  public async 试算报价(输入: Record<string, unknown>): Promise<报价试算结果> {
    return this.内存试算报价(输入);
  }

  public async 创建报价(
    输入: Record<string, unknown>,
    用户: 当前业务用户 | null,
  ): Promise<阶段9记录> {
    const 商机编号 = 读取文本(输入, ["opportunityId", "oppId", "商机编号"], "");
    const 商机 = 商机编号
      ? this.取记录集合("opportunities").find((项) => 项.id === 商机编号)
      : null;
    const 试算 = await this.内存试算报价(输入);
    const now = new Date().toISOString();
    const 原始数据 = {
      id: "QT-V3-" + Date.now(),
      customer: 读取文本(
        输入,
        ["customer", "customerName", "客户名称"],
        商机?.客户名称 || "阶段9测试客户",
      ),
      oppId: 商机?.id || 商机编号,
      total: 试算.total,
      products: 试算.productIds,
      hardwareIds: 试算.hardwareIds,
      quoteMode: 读取文本(输入, ["quoteMode", "报价模式"], "custom"),
      status: "draft",
      partnerId: 读取文本(输入, ["partnerId"], String(商机?.原始数据.partnerId || "")),
      partnerName: 读取文本(输入, ["partnerName"], 商机?.渠道名称 || ""),
      region: 读取文本(输入, ["region"], 商机?.区域 || ""),
      assignedStaffName: 用户?.displayName || "阶段9测试账号",
      createdByName: 用户?.displayName || "阶段9测试账号",
      createdAt: now,
      updatedAt: now,
      workloadSummary: 试算.workloadSummary,
      workloadSnapshot: 试算,
    };
    const 记录 = 转报价记录(原始数据);
    this.取记录集合("quotes").unshift(记录);
    return 记录;
  }

  public async 更新报价(
    id: string,
    输入: Record<string, unknown>,
    用户: 当前业务用户 | null,
  ): Promise<阶段9记录> {
    const 记录 = await this.查询详情("quotes", id);
    const 试算 = await this.内存试算报价(输入);
    记录.金额 = 试算.total || 记录.金额;
    记录.更新时间 = new Date().toISOString();
    记录.原始数据 = {
      ...记录.原始数据,
      total: 记录.金额,
      updatedAt: 记录.更新时间,
      updatedByName: 用户?.displayName || "阶段9测试账号",
      workloadSnapshot: 试算,
    };
    return 记录;
  }

  public async 更新报价状态(
    id: string,
    输入: Record<string, unknown>,
    用户: 当前业务用户 | null,
  ): Promise<阶段9记录> {
    const 记录 = await this.查询详情("quotes", id);
    const 状态 = 规范报价状态(读取文本(输入, ["status", "状态"], "approved"));
    记录.状态 = 状态;
    记录.状态名称 = 状态中文[状态] || 状态;
    记录.更新时间 = new Date().toISOString();
    记录.原始数据 = {
      ...记录.原始数据,
      status: 状态,
      updatedAt: 记录.更新时间,
      updatedByName: 用户?.displayName || "阶段9测试账号",
    };
    return 记录;
  }

  public async 创建订单(
    输入: Record<string, unknown>,
    用户: 当前业务用户 | null,
  ): Promise<阶段9记录> {
    const 报价编号 = 读取文本(输入, ["quoteId", "报价编号"], "");
    const 已有订单 = this.取记录集合("orders").find((项) => 项.原始数据.quoteId === 报价编号);
    if (已有订单) return 已有订单;
    const 报价 = 报价编号 ? this.取记录集合("quotes").find((项) => 项.id === 报价编号) : null;
    if (!报价) throw new 应用错误("V3_STAGE9_QUOTE_NOT_FOUND", "报价单不存在，不能创建订单。", 404);
    const now = new Date().toISOString();
    const 一级渠道编号 = 读取文本(
      输入,
      ["parentPartnerId", "assignedPartnerId", "primaryPartnerId"],
      "",
    );
    const 初始状态 = 一级渠道编号 ? "pending_primary_confirm" : "primary_confirmed";
    const 原始数据 = {
      id: "ORD-V3-" + Date.now(),
      quoteId: 报价.id,
      customer: 报价.客户名称,
      total: 报价.金额,
      status: 初始状态,
      partnerId: 报价.原始数据.partnerId,
      partnerName: 报价.渠道名称,
      parentPartnerId: 一级渠道编号,
      region: 报价.区域,
      assignedStaffName: 用户?.displayName || "阶段9测试账号",
      createdByName: 用户?.displayName || "阶段9测试账号",
      createdAt: now,
      updatedAt: now,
      statusHistory: [],
    };
    报价.状态 = "converted";
    报价.状态名称 = 状态中文.converted || "已转订单";
    const 订单 = 转订单记录(原始数据);
    this.取记录集合("orders").unshift(订单);
    return 订单;
  }

  public async 更新订单状态(
    id: string,
    输入: Record<string, unknown>,
    用户: 当前业务用户 | null,
  ): Promise<阶段9记录> {
    const 记录 = await this.查询详情("orders", id);
    const 状态 = 推导订单下一状态(
      记录.状态,
      规范订单状态(读取文本(输入, ["status", "状态"], "confirmed")),
    );
    记录.状态 = 状态;
    记录.状态名称 = 状态中文[状态] || 状态;
    记录.更新时间 = new Date().toISOString();
    记录.原始数据 = {
      ...记录.原始数据,
      status: 状态,
      updatedAt: 记录.更新时间,
      lastOperatorName: 用户?.displayName || "阶段9测试账号",
    };
    return 记录;
  }

  public async 读取开放接口总览(baseUrl: string): Promise<开放接口总览> {
    return 构建开放接口总览(baseUrl);
  }

  public async 查询开放接口客户端(): Promise<开放接口客户端[]> {
    return this.取记录集合("openapi").map((记录) => ({
      id: 记录.id,
      name: 记录.标题,
      appKey: 读取记录文本(记录, ["appKey"]) || 记录.编号,
      boundUserId: 读取记录文本(记录, ["boundUserId"]),
      status: 记录.状态,
      ipWhitelist: 读取记录数组(记录.原始数据, ["ipWhitelist"]),
      allowedResources: 读取记录数组(记录.原始数据, ["allowedResources"], ["*"]),
      expiresAt: 读取记录文本(记录, ["expiresAt"]),
      remark: 读取记录文本(记录, ["remark"]),
      secretResetRequired: true,
    }));
  }

  public async 创建开放接口客户端(
    输入: Record<string, unknown>,
    用户: 当前业务用户 | null,
  ): Promise<开放接口密钥结果> {
    const now = new Date().toISOString();
    const id = "OAC-V3-" + Date.now();
    const appKey = "oak_" + crypto.randomBytes(16).toString("hex");
    const appSecret = "osk_" + crypto.randomBytes(24).toString("base64url");
    this.取记录集合("openapi").unshift(
      转开放接口记录({
        id,
        name: 读取文本(输入, ["name", "clientName"], "OpenAPI Client"),
        appKey,
        boundUserId: 读取文本(输入, ["boundUserId"], ""),
        status: 读取文本(输入, ["status"], "active"),
        ipWhitelist: 读取文本数组(输入, ["ipWhitelist"]),
        allowedResources: 读取文本数组(输入, ["allowedResources", "resources"]).length
          ? 读取文本数组(输入, ["allowedResources", "resources"])
          : ["*"],
        expiresAt: 读取文本(输入, ["expiresAt"], ""),
        remark: 读取文本(输入, ["remark"], ""),
        createdByName: 用户?.displayName || "阶段9测试账号",
        createdAt: now,
        updatedAt: now,
      }),
    );
    return { id, appKey, appSecret };
  }

  public async 更新开放接口客户端(id: string): Promise<开放接口客户端> {
    const 客户端 = (await this.查询开放接口客户端()).find((项) => 项.id === id);
    if (!客户端) throw new 应用错误("V3_OPEN_API_CLIENT_NOT_FOUND", "OpenAPI Client不存在。", 404);
    return 客户端;
  }

  public async 重置开放接口密钥(id: string): Promise<开放接口密钥结果> {
    const 客户端 = (await this.查询开放接口客户端()).find((项) => 项.id === id);
    if (!客户端) throw new 应用错误("V3_OPEN_API_CLIENT_NOT_FOUND", "OpenAPI Client不存在。", 404);
    return {
      id,
      appKey: 客户端.appKey,
      appSecret: "osk_" + crypto.randomBytes(24).toString("base64url"),
    };
  }

  public async 查询开放接口日志(): Promise<开放接口日志[]> {
    return [];
  }

  public async 签发开放接口令牌(
    _输入?: Record<string, unknown>,
    _ip?: string,
    _requestId?: string,
  ): Promise<开放接口令牌> {
    throw new 应用错误(
      "V3_OPEN_API_POSTGRES_REQUIRED",
      "开放接口令牌必须使用PostgreSQL正式表签发。",
      500,
    );
  }

  public async 读取开放接口身份(): Promise<开放接口身份> {
    throw new 应用错误(
      "V3_OPEN_API_POSTGRES_REQUIRED",
      "开放接口身份必须使用PostgreSQL正式表校验。",
      500,
    );
  }

  public async 记录开放接口调用(): Promise<void> {
    return;
  }

  public async 查询工作量映射(keyword = ""): Promise<工作量映射项[]> {
    const 产品 = this.读取内存产品记录();
    const 查询词 = keyword.trim().toLowerCase();
    return 产品
      .filter(
        (项) => !查询词 || `${项.标题} ${项.编号} ${项.负责人}`.toLowerCase().includes(查询词),
      )
      .map((项) => ({
        featureId: 项.id,
        featureName: 项.标题,
        itemType: 是否内存硬件产品(项) ? "hardware" : "feature",
        moduleName: 项.负责人,
        categoryName: 项.类型,
        productCode: 读取记录文本(项, ["productCode", "hardwareCode", "featureCode"]),
        deliveryTags: 读取记录数组(项.原始数据, ["deliveryTags"]),
        active: 项.状态 !== "disabled",
      }));
  }

  public async 保存工作量映射(productId: string): Promise<工作量映射项> {
    const 映射 = (await this.查询工作量映射()).find((项) => 项.featureId === productId);
    if (!映射) throw new 应用错误("V3_WORKLOAD_MAPPING_NOT_FOUND", "工作量映射产品不存在。", 404);
    return 映射;
  }

  public async 查询交付工作量规则(): Promise<交付工作量规则项[]> {
    return this.取原始集合("implementationDeliveryWorkloadRules").map((项) =>
      转内存交付工作量规则(项),
    );
  }

  public async 保存交付工作量规则(id: string): Promise<交付工作量规则项> {
    const 规则 = (await this.查询交付工作量规则()).find((项) => 项.id === id);
    if (!规则) throw new 应用错误("V3_WORKLOAD_RULE_NOT_FOUND", "交付工作量规则不存在。", 404);
    return 规则;
  }

  private 统计项(标题: string, 模块: 阶段9模块, 说明: string) {
    return { 标题, 数量: this.取记录集合(模块).length, 说明 };
  }

  private 取记录集合(模块: 阶段9模块): 阶段9记录[] {
    return this.记录.get(模块) || [];
  }

  private 取原始集合(名称: string): Record<string, unknown>[] {
    return this.数据[名称] || [];
  }

  private 读取渠道(...来源集合: Array<Record<string, unknown> | undefined>): {
    id: string;
    name: string;
    region: string;
  } {
    const 默认渠道 = this.取记录集合("partners")[0];
    for (const 来源 of 来源集合) {
      if (!来源) continue;
      const partnerId = 读取文本(来源, ["partnerId", "渠道编号"], "");
      const partnerName = 读取文本(来源, ["partnerName", "渠道名称"], "");
      const 匹配 = this.取记录集合("partners").find(
        (项) => 项.id === partnerId || 项.标题 === partnerName,
      );
      if (匹配) return { id: 匹配.id, name: 匹配.标题, region: 匹配.区域 };
    }
    return {
      id: 默认渠道?.id || "",
      name: 默认渠道?.标题 || "",
      region: 默认渠道?.区域 || "",
    };
  }

  private 读取内存产品记录(): 阶段9记录[] {
    return [
      ...this.取原始集合("features").map((项) => 转产品记录(项, "功能模块")),
      ...this.取原始集合("hardwareProducts").map((项) => 转产品记录(项, "硬件产品")),
      ...this.取原始集合("packages").map((项) => 转产品记录(项, "产品套餐")),
    ];
  }

  private 读取内存工作量记录(): 阶段9记录[] {
    return [
      ...this.取原始集合("implementationWorkloadRules").map((项) => 转工作量记录(项, "实施工作量")),
      ...this.取原始集合("implementationDeliveryWorkloadRules").map((项) =>
        转工作量记录(项, "交付工作量"),
      ),
      ...this.取原始集合("implementationWorkloadMappings").map((项) =>
        转工作量记录(项, "功能映射"),
      ),
    ];
  }

  private 内存试算报价(输入: Record<string, unknown>): 报价试算结果 {
    const endpoints = 读取数字(输入, ["endpoints", "端点数"], 100);
    const productIds = 读取文本数组(输入, ["productIds", "products", "featureIds", "产品编号"]);
    const hardwareIds = 读取文本数组(输入, ["hardwareIds", "硬件编号"]);
    const 产品源 = [
      ...this.取原始集合("features"),
      ...this.取原始集合("packages"),
      ...this.取原始集合("hardwareProducts"),
    ];
    const 已选编号 = [...productIds, ...hardwareIds];
    const items = 已选编号
      .map((id) =>
        产品源.find((项) => String(项.id || "") === id || String(项.productCode || "") === id),
      )
      .filter((项): 项 is Record<string, unknown> => Boolean(项))
      .map((项) => {
        const 单价 = 读取产品单价(项, endpoints);
        const 数量 = String(项.unit || "").includes("端点") ? endpoints : 1;
        return {
          id: String(项.id || ""),
          名称: String(项.name || "未命名产品"),
          类型: 项.featureIds ? "产品套餐" : 项.model ? "硬件产品" : "功能模块",
          数量,
          单价,
          小计: 单价 * 数量,
        };
      });
    const total =
      读取数字(输入, ["total", "金额"], 0) || items.reduce((合计, 项) => 合计 + 项.小计, 0);
    const workloadDays = Math.max(2.5, Math.round((endpoints / 100) * 2.5 * 10) / 10);
    return {
      endpoints,
      productIds,
      hardwareIds,
      items,
      total,
      workloadDays,
      workloadSummary: `${endpoints}点，建议 ${workloadDays} 人天`,
    };
  }
}

class PostgreSQL业务数据服务 implements 业务数据服务 {
  private readonly pool: Pool;

  public constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl, max: 10 });
  }

  private async 解析当前用户上下文(用户: 当前业务用户 | null): Promise<业务用户上下文 | null> {
    if (!用户?.username && !用户?.userId && !用户?.externalUserId) return null;
    const 伙伴编号 = Array.isArray(用户.partnerIds) ? 用户.partnerIds.filter(Boolean) : [];
    const 伙伴外部编号 = Array.isArray(用户.partnerExternalIds)
      ? 用户.partnerExternalIds.filter(Boolean)
      : [];
    const result = await this.pool.query<{
      user_id: string;
      external_user_id: string | null;
      username: string;
      display_name: string;
      role_code: string | null;
      role_name: string | null;
      data_scope_code: string | null;
      region_id: string | null;
      region_name: string | null;
      partner_ids: string[] | null;
      partner_external_ids: string[] | null;
      partner_names: string[] | null;
      extra_partner_id: string | null;
      extra_partner_name: string | null;
      extra_region_name: string | null;
    }>(
      `
      SELECT
        u.id::text AS user_id,
        u.v2_source_id AS external_user_id,
        u.username::text AS username,
        u.display_name::text AS display_name,
        COALESCE(
          (
            array_agg(r.role_code ORDER BY
              CASE r.role_code
                WHEN 'superadmin' THEN 1
                WHEN 'admin' THEN 2
                WHEN 'region_manager' THEN 3
                WHEN 'partner_admin' THEN 4
                ELSE 5
              END
            ) FILTER (WHERE r.role_code IS NOT NULL)
          )[1],
          $4,
          'staff'
        ) AS role_code,
        COALESCE(
          (
            array_agg(r.role_name ORDER BY
              CASE r.role_code
                WHEN 'superadmin' THEN 1
                WHEN 'admin' THEN 2
                WHEN 'region_manager' THEN 3
                WHEN 'partner_admin' THEN 4
                ELSE 5
              END
            ) FILTER (WHERE r.role_name IS NOT NULL)
          )[1],
          $5,
          '渠道用户'
        ) AS role_name,
        COALESCE(sp.data_scope_code, $6) AS data_scope_code,
        u.region_id::text AS region_id,
        reg.region_name,
        COALESCE(
          array_agg(DISTINCT p.id::text) FILTER (WHERE p.id IS NOT NULL AND pm.status_code = 'active'),
          ARRAY[]::text[]
        ) || CASE WHEN p_extra.id IS NULL THEN ARRAY[]::text[] ELSE ARRAY[p_extra.id::text] END AS partner_ids,
        COALESCE(
          array_agg(DISTINCT COALESCE(p.v2_source_id, p.partner_code, p.id::text))
            FILTER (WHERE p.id IS NOT NULL AND pm.status_code = 'active'),
          ARRAY[]::text[]
        ) || CASE
          WHEN p_extra.id IS NULL THEN ARRAY[]::text[]
          ELSE ARRAY[COALESCE(p_extra.v2_source_id, p_extra.partner_code, p_extra.id::text)]
        END AS partner_external_ids,
        COALESCE(
          array_agg(DISTINCT p.partner_name)
            FILTER (WHERE p.partner_name IS NOT NULL AND pm.status_code = 'active'),
          ARRAY[]::text[]
        ) || CASE WHEN p_extra.partner_name IS NULL THEN ARRAY[]::text[] ELSE ARRAY[p_extra.partner_name] END AS partner_names,
        u.extra_json->>'partnerId' AS extra_partner_id,
        u.extra_json->>'partnerName' AS extra_partner_name,
        u.extra_json->>'region' AS extra_region_name
      FROM iam.users u
      LEFT JOIN iam.user_roles ur ON ur.user_id = u.id
      LEFT JOIN iam.roles r ON r.id = ur.role_id AND r.status_code = 'active'
      LEFT JOIN org.staff_profiles sp ON sp.user_id = u.id
      LEFT JOIN org.regions reg ON reg.id = u.region_id
      LEFT JOIN channel.partner_members pm ON pm.user_id = u.id AND pm.archived_at IS NULL
      LEFT JOIN channel.partners p ON p.id = pm.partner_id AND p.status_code = 'active'
      LEFT JOIN channel.partners p_extra ON p_extra.status_code = 'active'
        AND NULLIF(u.extra_json->>'partnerId', '') IS NOT NULL
        AND (
          p_extra.id::text = u.extra_json->>'partnerId'
          OR p_extra.v2_source_id = u.extra_json->>'partnerId'
          OR p_extra.partner_code = u.extra_json->>'partnerId'
        )
      WHERE u.status_code = 'active'
        AND (
          ($1 <> '' AND u.id::text = $1)
          OR ($2 <> '' AND (u.v2_source_id = $2 OR u.extra_json->>'id' = $2 OR u.extra_json->>'userId' = $2))
          OR ($3 <> '' AND lower(u.username::text) = lower($3))
        )
      GROUP BY
        u.id, u.v2_source_id, u.username, u.display_name, sp.data_scope_code,
        reg.region_name, p_extra.id, p_extra.v2_source_id, p_extra.partner_code, p_extra.partner_name
      LIMIT 1
      `,
      [
        用户.userId || "",
        用户.externalUserId || "",
        用户.username || "",
        用户.roleCode || "",
        用户.roleName || "",
        用户.dataScopeCode || "",
      ],
    );
    const row = result.rows[0];
    if (!row) return null;
    const roleCode = row.role_code || 用户.roleCode || "staff";
    const dataScopeCode =
      row.data_scope_code || 用户.dataScopeCode || 推断数据范围(roleCode) || "self";
    return {
      userId: row.user_id,
      externalUserId: row.external_user_id || 用户.externalUserId || "",
      username: row.username,
      displayName: row.display_name || 用户.displayName || row.username,
      roleCode,
      roleName: row.role_name || 用户.roleName || 转角色显示名称(roleCode),
      dataScopeCode,
      regionId: row.region_id || 用户.regionId || "",
      regionName: row.region_name || row.extra_region_name || 用户.regionName || "",
      partnerIds: 去重文本([...(row.partner_ids || []), ...伙伴编号]),
      partnerExternalIds: 去重文本([
        ...(row.partner_external_ids || []),
        row.extra_partner_id || "",
        ...伙伴外部编号,
      ]),
      partnerName: row.partner_names?.[0] || row.extra_partner_name || 用户.partnerName || "",
    };
  }

  private 构建数据范围条件(模块: 阶段9模块, 用户: 业务用户上下文 | null, 参数: unknown[]): string {
    if (!用户) return 模块 === "notifications" ? "false" : "true";
    if (模块 === "partners") return 构建渠道商数据范围条件(用户, 参数);
    if (模块 === "users") return 构建账号数据范围条件(用户, 参数);
    if (模块 === "approvals") return 构建审核数据范围条件(用户, 参数);
    if (模块 === "notifications") {
      参数.push(用户.userId);
      return `n.recipient_user_id = $${参数.length}::uuid`;
    }
    const alias = 数据范围表别名(模块);
    if (!alias) return "true";
    if (用户.roleCode === "superadmin" || 用户.dataScopeCode === "all") return "true";

    if (用户.roleCode === "partner_admin" || 用户.dataScopeCode === "partner") {
      if (!用户.partnerIds.length) return "false";
      参数.push(用户.partnerIds);
      return `${alias}.partner_id = ANY($${参数.length}::uuid[])`;
    }

    if (用户.roleCode === "staff" || 用户.dataScopeCode === "self") {
      参数.push(用户.userId);
      return `${alias}.owner_user_id = $${参数.length}::uuid`;
    }

    if (用户.roleCode === "region_manager" || 用户.dataScopeCode === "region") {
      if (用户.regionId) {
        if (模块 === "quotes" || 模块 === "orders") {
          return 构建渠道区域关联条件(模块, 用户, 参数);
        }
        参数.push(用户.regionId);
        return `${alias}.region_id = $${参数.length}::uuid`;
      }
      if (用户.regionName) {
        if (模块 === "quotes" || 模块 === "orders") {
          return 构建渠道区域关联条件(模块, 用户, 参数);
        }
        参数.push("%" + 用户.regionName + "%");
        return `${alias}.extra_json->>'region' ILIKE $${参数.length}`;
      }
      return "false";
    }

    if (用户.roleCode === "admin") return "true";
    return "false";
  }

  public async 读取概览(): Promise<阶段9概览> {
    const 统计 = await Promise.all([
      this.统计表("渠道商", "channel.partners", "正式渠道主档"),
      this.统计表("客户报备", "crm.registrations", "正式客户报备"),
      this.统计表("商机", "crm.opportunities", "正式商机"),
      this.统计表("报价单", "crm.quotes", "正式报价"),
      this.统计表("订单", "crm.orders", "正式订单"),
      this.统计表("产品", "catalog.product_features", "正式产品功能"),
    ]);
    const 待办 = (await this.查询列表("registrations", { status: "pending", page: 1, pageSize: 8 }))
      .数据;
    const 最近业务 = (
      await this.查询通用列表(
        `
        SELECT * FROM (
          ${报备查询SQL("true")}
          UNION ALL
          ${商机查询SQL("true")}
          UNION ALL
          ${报价查询SQL("true")}
          UNION ALL
          ${订单查询SQL("true")}
        ) t
        ORDER BY "创建时间" DESC
        LIMIT 8
        `,
        [],
      )
    ).数据;
    const 迁移状态 = await this.查询迁移状态();
    return { 统计, 待办, 最近业务, 迁移状态 };
  }

  public async 查询列表(
    模块: 阶段9模块,
    查询: 阶段9查询参数,
    用户?: 当前业务用户 | null,
  ): Promise<阶段9列表结果> {
    const 上下文 = await this.解析当前用户上下文(用户 || null);
    const 条件: string[] = ["true"];
    const 参数: unknown[] = [];
    if (查询.keyword) {
      参数.push("%" + 查询.keyword + "%");
      条件.push(
        `("标题" ILIKE $${参数.length} OR "客户名称" ILIKE $${参数.length} OR "渠道名称" ILIKE $${参数.length}${模块 === "orders" ? ` OR "原始数据"->>'preRegionOrderNo' ILIKE $${参数.length}` : ""})`,
      );
    }
    if (查询.status) {
      参数.push(查询.status);
      条件.push(`"状态" = $${参数.length}`);
    }
    if (查询.level) {
      参数.push(查询.level.toLowerCase());
      条件.push(
        `LOWER(COALESCE("原始数据"->>'level', "原始数据"->>'级别', "原始数据"->>'等级', '')) = $${参数.length}`,
      );
    }
    if (查询.region) {
      参数.push("%" + 查询.region + "%");
      条件.push(`("区域" ILIKE $${参数.length} OR "原始数据"->>'region' ILIKE $${参数.length})`);
    }
    if (查询.partnerId && 应使用渠道兼容过滤(上下文)) {
      参数.push(查询.partnerId);
      条件.push(
        `("原始数据"->>'partnerUuid' = $${参数.length} OR "原始数据"->>'partnerId' = $${参数.length} OR "原始数据"->>'assignedPartnerId' = $${参数.length})`,
      );
    }
    const 兼容用户过滤 = 读取兼容用户过滤值(模块, 查询, 上下文);
    if (兼容用户过滤) {
      参数.push(兼容用户过滤);
      条件.push(
        `("原始数据"->>'ownerUserUuid' = $${参数.length} OR "原始数据"->>'assignedStaffId' = $${参数.length} OR "原始数据"->>'assignedStaffUserId' = $${参数.length})`,
      );
    }
    if (模块 === "products" && 查询.productType) {
      参数.push(产品类型名称(查询.productType));
      条件.push(`"类型" = $${参数.length}`);
    }
    const where = 条件.join(" AND ");
    const baseSql = this.模块查询SQL(模块, this.构建数据范围条件(模块, 上下文, 参数));
    return this.查询通用列表(`SELECT * FROM (${baseSql}) s WHERE ${where}`, 参数, 查询);
  }

  public async 查询到期提醒(用户: 当前业务用户 | null): Promise<到期提醒项[]> {
    const 上下文 = await this.解析当前用户上下文(用户);
    const 报备参数: unknown[] = [];
    const 商机参数: unknown[] = [];
    const 报备范围 = this.构建数据范围条件("registrations", 上下文, 报备参数);
    const 商机范围 = this.构建数据范围条件("opportunities", 上下文, 商机参数);
    const [报备结果, 商机结果] = await Promise.all([
      this.pool.query<{
        id: string;
        编号: string;
        标题: string;
        客户名称: string;
        到期日: string;
        剩余天数: number;
      }>(
        `
        SELECT "id", "编号", "标题", "客户名称",
          substring("原始数据"->>'expireAt' FROM 1 FOR 10) AS "到期日",
          (substring("原始数据"->>'expireAt' FROM 1 FOR 10)::date - CURRENT_DATE)::integer AS "剩余天数"
        FROM (${报备查询SQL(报备范围)}) s
        WHERE "状态" = 'approved'
          AND COALESCE("原始数据"->>'expireAt', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
          AND substring("原始数据"->>'expireAt' FROM 1 FOR 10)::date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
        ORDER BY "到期日", "标题"
        `,
        报备参数,
      ),
      this.pool.query<{
        id: string;
        编号: string;
        标题: string;
        客户名称: string;
        到期日: string;
        剩余天数: number;
      }>(
        `
        SELECT "id", "编号", "标题", "客户名称",
          substring("原始数据"->>'expectedClose' FROM 1 FOR 10) AS "到期日",
          (substring("原始数据"->>'expectedClose' FROM 1 FOR 10)::date - CURRENT_DATE)::integer AS "剩余天数"
        FROM (${商机查询SQL(商机范围)}) s
        WHERE "状态" = 'active'
          AND COALESCE("原始数据"->>'expectedClose', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
          AND substring("原始数据"->>'expectedClose' FROM 1 FOR 10)::date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
        ORDER BY "到期日", "标题"
        `,
        商机参数,
      ),
    ]);
    return [
      ...报备结果.rows.map((row) => ({
        type: "registration" as const,
        targetId: row.编号 || row.id,
        targetName: row.标题,
        customer: row.客户名称,
        dueDate: row.到期日,
        daysLeft: Number(row.剩余天数),
      })),
      ...商机结果.rows.map((row) => ({
        type: "opportunity" as const,
        targetId: row.编号 || row.id,
        targetName: row.标题,
        customer: row.客户名称,
        dueDate: row.到期日,
        daysLeft: Number(row.剩余天数),
      })),
    ].sort(
      (left, right) =>
        left.daysLeft - right.daysLeft || left.targetName.localeCompare(right.targetName, "zh-CN"),
    );
  }

  public async 查询详情(
    模块: 阶段9模块,
    id: string,
    用户?: 当前业务用户 | null,
  ): Promise<阶段9记录> {
    const 上下文 = await this.解析当前用户上下文(用户 || null);
    const where = `"id" = $1 OR "编号" = $1${模块 === "orders" ? ` OR "原始数据"->>'preRegionOrderNo' = $1` : ""}`;
    const 参数: unknown[] = [id];
    const baseSql = this.模块查询SQL(模块, this.构建数据范围条件(模块, 上下文, 参数));
    const 列表 = await this.查询通用列表(`SELECT * FROM (${baseSql}) s WHERE ${where}`, 参数, {
      page: 1,
      pageSize: 1,
    });
    const 记录 = 列表.数据[0];
    if (!记录) throw new 应用错误("V3_STAGE9_NOT_FOUND", "未找到业务记录。", 404);
    return 记录;
  }

  public async 创建报备(
    输入: Record<string, unknown>,
    用户: 当前业务用户 | null,
  ): Promise<阶段9记录> {
    const 上下文 = await this.解析当前用户上下文(用户);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const 客户名称 = 读取文本(输入, ["customer", "customerName", "客户名称"], "阶段9测试客户");
      const customerId = await 查询或创建客户(client, 客户名称, 输入);
      const 归属 = await 解析业务归属(client, 输入, 上下文);
      const 初始状态 = 规范报备初始状态(读取文本(输入, ["status", "状态"], "pending"), 上下文);
      const now = new Date().toISOString();
      const protectDays = 读取报备保护天数(输入);
      const expireAt = 初始状态 === "approved" ? 计算报备保护到期日(now, protectDays) : "";
      const 提报账号 = 读取提报账号(
        await 查询业务负责人账号(client, 归属.ownerUserId),
        上下文?.username,
        用户?.username,
      );
      const 报备编号 = await 生成业务编号(client, "registration", 提报账号);
      const result = await client.query<{ id: string }>(
        `
        INSERT INTO crm.registrations (
          registration_no, customer_id, partner_id, owner_user_id, region_id,
          status_code, submitted_at, approved_at, created_at, updated_at, extra_json
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, now(), CASE WHEN $6 = 'approved' THEN now() ELSE NULL END, now(), now(), $7::jsonb
        )
        RETURNING id
        `,
        [
          报备编号,
          customerId,
          归属.partnerId,
          归属.ownerUserId,
          归属.regionId,
          初始状态,
          JSON.stringify({
            ...输入,
            customer: 客户名称,
            customerName: 客户名称,
            partnerId: 归属.partnerId || "",
            assignedPartnerId: 归属.partnerId || "",
            partnerName: 归属.partnerName,
            assignedPartnerName: 归属.partnerName,
            ownerUserId: 归属.ownerUserId || "",
            assignedStaffId: 归属.ownerUserId || "",
            assignedStaffName: 归属.ownerUserName,
            region: 归属.regionName || 读取文本(输入, ["region", "区域"], ""),
            submittedByUsername: 提报账号,
            status: 初始状态,
            createdByName: 用户?.displayName || "阶段9测试账号",
            approvedBy:
              初始状态 === "approved"
                ? 读取文本(输入, ["approvedBy"], 用户?.displayName || "阶段9测试账号")
                : 读取文本(输入, ["approvedBy"], ""),
            approvedAt:
              初始状态 === "approved"
                ? 读取文本(输入, ["approvedAt"], now)
                : 读取文本(输入, ["approvedAt"], ""),
            protectDays,
            expireAt,
            createdAt: now,
            updatedAt: now,
          }),
        ],
      );
      const id = 读取返回编号(result.rows[0]);
      await 写入报备审批待办(client, {
        报备编号: id,
        状态: 初始状态,
        申请人编号: 归属.ownerUserId,
        渠道编号: 归属.partnerId,
        客户名称,
        输入,
        用户,
      });
      await client.query("COMMIT");
      return this.查询详情("registrations", id, 用户);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async 更新报备状态(
    id: string,
    输入: Record<string, unknown>,
    用户: 当前业务用户 | null,
  ): Promise<阶段9记录> {
    await this.查询详情("registrations", id, 用户);
    const 状态 = 规范报备状态(读取文本(输入, ["status", "状态"], "approved"));
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const 当前 = await client.query<{
        status_code: string;
        approved_at: Date | null;
        extra_json: Record<string, unknown>;
      }>(
        `
        SELECT status_code, approved_at, extra_json
        FROM crm.registrations
        WHERE id::text = $1 OR v2_source_id = $1 OR registration_no = $1
        LIMIT 1
        FOR UPDATE
        `,
        [id],
      );
      const 当前报备 = 当前.rows[0];
      if (!当前报备) throw new 应用错误("V3_STAGE9_NOT_FOUND", "未找到业务记录。", 404);
      const result = await client.query<{
        id: string;
        customer_id: string;
        partner_id: string | null;
        owner_user_id: string | null;
      }>(
        `
        UPDATE crm.registrations
        SET
          status_code = $2,
          approved_at = CASE WHEN $2 = 'approved' THEN now() ELSE approved_at END,
          updated_at = now(),
          row_version = row_version + 1,
          extra_json = extra_json || $3::jsonb
        WHERE id::text = $1 OR v2_source_id = $1 OR registration_no = $1
        RETURNING id::text AS id, customer_id::text AS customer_id, partner_id::text AS partner_id, owner_user_id::text AS owner_user_id
        `,
        [
          id,
          状态,
          JSON.stringify({
            status: 状态,
            reviewRemark: 读取文本(输入, ["reason", "remark", "审核意见"], ""),
            updatedByName: 用户?.displayName || "阶段9测试账号",
            ...(状态 === "approved"
              ? {
                  protectDays: 读取报备保护天数(当前报备.extra_json),
                  expireAt: 计算报备保护到期日(
                    当前报备.approved_at?.toISOString() || new Date().toISOString(),
                    读取报备保护天数(当前报备.extra_json),
                  ),
                }
              : {}),
          }),
        ],
      );
      const 报备 = result.rows[0];
      if (!报备) throw new 应用错误("V3_STAGE9_NOT_FOUND", "未找到业务记录。", 404);
      await 同步报备审批状态(client, {
        报备编号: 报备.id,
        状态,
        原因: 读取文本(输入, ["reason", "remark", "审核意见"], ""),
        用户,
      });
      if (状态 !== 当前报备.status_code && (状态 === "approved" || 状态 === "rejected")) {
        await 写入报备发件箱事件(client, 报备.id, `crm.registration.${状态}`, {
          fromStatus: 当前报备.status_code,
          toStatus: 状态,
          ownerUserId: 报备.owner_user_id || "",
          partnerId: 报备.partner_id || "",
        });
      }
      await client.query("COMMIT");
      return this.查询详情("registrations", 报备.id, 用户);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async 审核移动端报备状态(
    id: string,
    输入: Record<string, unknown>,
    用户: 当前业务用户,
  ): Promise<阶段9记录> {
    校验移动端审核管理员(用户);
    return this.更新报备状态(id, 输入, 用户);
  }

  public async 执行移动端幂等<T>(参数: 移动端幂等参数, 操作: () => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const 新记录 = await client.query<{ id: string }>(
        `
        INSERT INTO ops.idempotency_keys (
          scope_code, idem_key, request_hash, status_code, expires_at
        )
        VALUES ($1, $2, $3, 'processing', now() + interval '24 hours')
        ON CONFLICT (scope_code, idem_key) DO NOTHING
        RETURNING id::text AS id
        `,
        [参数.作用域, 参数.幂等键, 参数.请求哈希],
      );
      if (!新记录.rows[0]) {
        const 已有记录 = await client.query<{
          request_hash: string;
          status_code: "processing" | "succeeded" | "failed";
          response_json: T | null;
          expires_at: Date;
        }>(
          `
          SELECT request_hash, status_code, response_json, expires_at
          FROM ops.idempotency_keys
          WHERE scope_code = $1 AND idem_key = $2
          FOR UPDATE
          `,
          [参数.作用域, 参数.幂等键],
        );
        const 记录 = 已有记录.rows[0];
        if (!记录 || 记录.request_hash !== 参数.请求哈希) {
          throw new 应用错误("V3_MOBILE_IDEMPOTENCY_CONFLICT", "幂等键已用于不同的请求内容。", 409);
        }
        if (记录.status_code === "succeeded" && 记录.response_json !== null) {
          await client.query("COMMIT");
          return 记录.response_json;
        }
        const 可以接管 =
          记录.status_code === "failed" || new Date(记录.expires_at).getTime() <= Date.now();
        if (!可以接管) {
          throw new 应用错误(
            "V3_MOBILE_IDEMPOTENCY_PROCESSING",
            "请求正在处理中，请稍后重试。",
            409,
          );
        }
        await client.query(
          `
          UPDATE ops.idempotency_keys
          SET status_code = 'processing', response_hash = NULL, response_json = NULL,
            expires_at = now() + interval '24 hours'
          WHERE scope_code = $1 AND idem_key = $2
          `,
          [参数.作用域, 参数.幂等键],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    try {
      const 响应 = await 操作();
      await this.pool.query(
        `
        UPDATE ops.idempotency_keys
        SET status_code = 'succeeded', response_hash = $3, response_json = $4::jsonb
        WHERE scope_code = $1 AND idem_key = $2 AND status_code = 'processing'
        `,
        [参数.作用域, 参数.幂等键, 创建响应哈希(响应), JSON.stringify(响应)],
      );
      return 响应;
    } catch (error) {
      await this.pool.query(
        `
        UPDATE ops.idempotency_keys
        SET status_code = 'failed'
        WHERE scope_code = $1 AND idem_key = $2 AND status_code = 'processing'
        `,
        [参数.作用域, 参数.幂等键],
      );
      throw error;
    }
  }

  public async 更新渠道商状态(
    id: string,
    输入: Record<string, unknown>,
    用户: 当前业务用户 | null,
  ): Promise<阶段9记录> {
    const 上下文 = await this.解析当前用户上下文(用户);
    校验超级管理员上下文(上下文);
    const 状态 = 规范渠道审核状态(读取文本(输入, ["status"], "active"));
    const 原因 = 读取文本(输入, ["remark", "reason"], "");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<{ id: string; partner_name: string }>(
        `
        UPDATE channel.partners
        SET status_code = $2, updated_at = now(), row_version = row_version + 1,
          extra_json = extra_json || $3::jsonb
        WHERE id::text = $1 OR v2_source_id = $1 OR partner_code = $1
        RETURNING id::text AS id, partner_name
        `,
        [
          id,
          状态,
          JSON.stringify({
            status: 状态,
            reviewRemark: 原因,
            reviewedByName: 用户?.displayName || "",
            reviewedAt: new Date().toISOString(),
          }),
        ],
      );
      const 渠道商 = result.rows[0];
      if (!渠道商) throw new 应用错误("V3_PARTNER_NOT_FOUND", "渠道商不存在。", 404);
      await 写入审计日志(client, {
        用户,
        模块: "partners",
        动作: "review_partner",
        对象类型: "partner",
        对象编号: 渠道商.id,
        对象名称: 渠道商.partner_name,
        结果: "success",
        说明: 状态 === "active" ? "移动端审核通过渠道商" : "移动端驳回渠道商",
        变更后: { status: 状态, remark: 原因 },
      });
      await client.query("COMMIT");
      return this.查询详情("partners", 渠道商.id, 用户);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async 更新待审批状态(
    id: string,
    输入: Record<string, unknown>,
    用户: 当前业务用户 | null,
  ): Promise<阶段9记录> {
    const 上下文 = await this.解析当前用户上下文(用户);
    校验超级管理员上下文(上下文);
    const 状态 = 读取文本(输入, ["action"], "approve") === "reject" ? "rejected" : "approved";
    const 原因 = 读取文本(输入, ["remark", "reason"], "");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const 当前 = await client.query<{
        id: string;
        status_code: string;
        target_type: string;
        target_id: string | null;
        applicant_partner_id: string | null;
        title: string;
      }>(
        `
        SELECT id::text AS id, status_code, target_type, target_id::text AS target_id,
          applicant_partner_id::text AS applicant_partner_id,
          COALESCE(extra_json->>'targetName', target_type) AS title
        FROM ops.approvals
        WHERE id::text = $1 OR v2_source_id = $1 OR target_id::text = $1
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [id],
      );
      const 审批 = 当前.rows[0];
      if (!审批) throw new 应用错误("V3_APPROVAL_NOT_FOUND", "待审批事项不存在。", 404);
      await client.query(
        `
        UPDATE ops.approvals
        SET status_code = $2, updated_at = now(), extra_json = extra_json || $3::jsonb
        WHERE id::text = $1
        `,
        [
          审批.id,
          状态,
          JSON.stringify({
            status: 状态,
            reviewRemark: 原因,
            reviewedByName: 用户?.displayName || "",
            reviewedAt: new Date().toISOString(),
          }),
        ],
      );
      await client.query(
        `
        INSERT INTO ops.approval_events (
          approval_id, event_code, from_status_code, to_status_code, reason, extra_json
        )
        VALUES ($1::uuid, $2, $3, $4, $5, $6::jsonb)
        `,
        [
          审批.id,
          状态 === "approved" ? "approve" : "reject",
          审批.status_code,
          状态,
          原因,
          JSON.stringify({ actorName: 用户?.displayName || "" }),
        ],
      );
      if (
        (审批.target_type === "user" ||
          审批.target_type === "staff" ||
          审批.target_type === "account") &&
        审批.target_id
      ) {
        const 目标状态 = 状态 === "approved" ? "active" : "disabled";
        await client.query(
          `
          UPDATE iam.users
          SET status_code = $2,
              updated_at = now(),
              extra_json = extra_json || $3::jsonb
          WHERE id = $1::uuid
          `,
          [
            审批.target_id,
            目标状态,
            JSON.stringify({ status: 状态 === "approved" ? "active" : "rejected" }),
          ],
        );
        if (审批.applicant_partner_id) {
          await client.query(
            `
            UPDATE channel.partner_members
            SET status_code = $2,
                ended_at = CASE WHEN $2 = 'disabled' THEN now() ELSE NULL END
            WHERE user_id = $1::uuid AND partner_id = $3::uuid
            `,
            [审批.target_id, 目标状态, 审批.applicant_partner_id],
          );
        }
      }
      await 写入审计日志(client, {
        用户,
        模块: "approvals",
        动作: "review_pending_approval",
        对象类型: 审批.target_type,
        对象编号: 审批.id,
        对象名称: 审批.title,
        结果: "success",
        说明: 状态 === "approved" ? "移动端审核通过待审批事项" : "移动端驳回待审批事项",
        变更后: { status: 状态, remark: 原因 },
      });
      await client.query("COMMIT");
      return this.查询详情("approvals", 审批.id, 用户);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async 更新报备(
    id: string,
    输入: Record<string, unknown>,
    用户: 当前业务用户 | null,
  ): Promise<阶段9记录> {
    const 上下文 = await this.解析当前用户上下文(用户);
    await this.查询详情("registrations", id, 用户);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const 当前 = await client.query<{
        id: string;
        customer_id: string;
        partner_id: string | null;
        owner_user_id: string | null;
        region_id: string | null;
        status_code: string;
        approved_at: Date | null;
        extra_json: Record<string, unknown>;
      }>(
        `
        SELECT id::text AS id, customer_id::text AS customer_id, partner_id::text AS partner_id,
          owner_user_id::text AS owner_user_id, region_id::text AS region_id, status_code, approved_at, extra_json
        FROM crm.registrations
        WHERE id::text = $1 OR v2_source_id = $1 OR registration_no = $1
        LIMIT 1
        FOR UPDATE
        `,
        [id],
      );
      const row = 当前.rows[0];
      if (!row) throw new 应用错误("V3_STAGE9_NOT_FOUND", "未找到业务记录。", 404);
      const 客户名称 = 读取文本(输入, ["customer", "customerName", "客户名称"], "");
      const customerId = 客户名称 ? await 查询或创建客户(client, 客户名称, 输入) : row.customer_id;
      const 归属 = await 解析业务归属(client, 输入, 上下文, {
        partnerId: row.partner_id,
        ownerUserId: row.owner_user_id,
        regionId: row.region_id,
      });
      const 状态 = 读取文本(输入, ["status", "状态"], "")
        ? 规范报备状态(读取文本(输入, ["status", "状态"], row.status_code))
        : row.status_code;
      const protectDays = 读取报备保护天数(输入, 读取报备保护天数(row.extra_json));
      const extra = {
        ...输入,
        ...(客户名称 ? { customer: 客户名称, customerName: 客户名称 } : {}),
        partnerId: 归属.partnerId || "",
        assignedPartnerId: 归属.partnerId || "",
        partnerName: 归属.partnerName,
        assignedPartnerName: 归属.partnerName,
        ownerUserId: 归属.ownerUserId || "",
        assignedStaffId: 归属.ownerUserId || "",
        assignedStaffName: 归属.ownerUserName,
        region: 归属.regionName || 读取文本(输入, ["region", "区域"], ""),
        status: 状态,
        protectDays,
        ...(状态 === "approved"
          ? {
              expireAt: 计算报备保护到期日(
                row.approved_at?.toISOString() || new Date().toISOString(),
                protectDays,
              ),
            }
          : {}),
        updatedByName: 用户?.displayName || "阶段9测试账号",
      };
      const result = await client.query<{ id: string }>(
        `
        UPDATE crm.registrations
        SET customer_id = $2::uuid,
            partner_id = $3::uuid,
            owner_user_id = $4::uuid,
            region_id = $5::uuid,
            status_code = $6,
            updated_at = now(),
            row_version = row_version + 1,
            extra_json = extra_json || $7::jsonb
        WHERE id::text = $1 OR v2_source_id = $1 OR registration_no = $1
        RETURNING id::text AS id
        `,
        [
          id,
          customerId,
          归属.partnerId,
          归属.ownerUserId,
          归属.regionId,
          状态,
          JSON.stringify(extra),
        ],
      );
      const 报备编号 = result.rows[0]?.id;
      if (!报备编号) throw new 应用错误("V3_STAGE9_NOT_FOUND", "未找到业务记录。", 404);
      if (状态 !== row.status_code && (状态 === "approved" || 状态 === "rejected")) {
        await 写入报备发件箱事件(client, 报备编号, `crm.registration.${状态}`, {
          fromStatus: row.status_code,
          toStatus: 状态,
          ownerUserId: 归属.ownerUserId || row.owner_user_id || "",
          partnerId: 归属.partnerId || row.partner_id || "",
        });
      }
      await client.query("COMMIT");
      return this.查询详情("registrations", 报备编号, 用户);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async 创建商机(
    输入: Record<string, unknown>,
    用户: 当前业务用户 | null,
  ): Promise<阶段9记录> {
    const 上下文 = await this.解析当前用户上下文(用户);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const registrationId = 读取文本(输入, ["registrationId", "regId", "报备编号"], "");
      if (registrationId) await this.查询详情("registrations", registrationId, 用户);
      const reg = registrationId
        ? await client.query<{
            id: string;
            customer_id: string;
            partner_id: string | null;
            owner_user_id: string | null;
            region_id: string | null;
            status_code: string;
          }>(
            `
            SELECT id, customer_id, partner_id, owner_user_id, region_id, status_code
            FROM crm.registrations
            WHERE id::text = $1 OR v2_source_id = $1 OR registration_no = $1
            LIMIT 1
            `,
            [registrationId],
          )
        : { rows: [] };
      const 报备 = reg.rows[0];
      if (报备 && 报备.status_code !== "approved") {
        throw new 应用错误(
          "V3_STAGE9_REGISTRATION_NOT_APPROVED",
          "报备未通过审核，不能创建商机。",
          409,
        );
      }
      const 客户名称 = 读取文本(输入, ["customer", "customerName", "客户名称"], "阶段9测试客户");
      const customerId = 报备?.customer_id || (await 查询或创建客户(client, 客户名称, 输入));
      const 归属 = await 解析业务归属(client, 输入, 上下文, {
        partnerId: 报备?.partner_id || null,
        ownerUserId: 报备?.owner_user_id || null,
        regionId: 报备?.region_id || null,
      });
      const 阶段 = 读取文本(输入, ["stage", "阶段"], "registered");
      const 商机编号 = await 生成业务编号(client, "opportunity");
      const result = await client.query<{ id: string }>(
        `
        INSERT INTO crm.opportunities (
          opportunity_no, customer_id, registration_id, partner_id, owner_user_id,
          region_id, stage_code, raw_stage_name, status_code, expected_amount,
          created_at, updated_at, extra_json
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9, now(), now(), $10::jsonb)
        RETURNING id
        `,
        [
          商机编号,
          customerId,
          报备?.id || null,
          归属.partnerId,
          归属.ownerUserId,
          归属.regionId,
          阶段,
          阶段,
          读取数字(输入, ["amount", "预计金额"], 0),
          JSON.stringify({
            ...输入,
            customer: 客户名称,
            customerName: 客户名称,
            partnerId: 归属.partnerId || "",
            assignedPartnerId: 归属.partnerId || "",
            partnerName: 归属.partnerName,
            assignedPartnerName: 归属.partnerName,
            ownerUserId: 归属.ownerUserId || "",
            assignedStaffId: 归属.ownerUserId || "",
            assignedStaffName: 归属.ownerUserName,
            region: 归属.regionName || 读取文本(输入, ["region", "区域"], ""),
            createdByName: 用户?.displayName || "阶段9测试账号",
            stage: 阶段,
          }),
        ],
      );
      const id = 读取返回编号(result.rows[0]);
      if (报备?.id) {
        await client.query(
          `
          UPDATE crm.registrations
          SET updated_at = now(), row_version = row_version + 1,
              extra_json = extra_json || $2::jsonb
          WHERE id = $1
          `,
          [
            报备.id,
            JSON.stringify({
              convertedOpportunityId: id,
              convertedAt: new Date().toISOString(),
              updatedByName: 用户?.displayName || "阶段9测试账号",
            }),
          ],
        );
        await client.query(
          `
          INSERT INTO crm.registration_events (
            registration_id, event_code, from_status_code, to_status_code, actor_user_id, reason, extra_json
          )
          VALUES ($1::uuid, 'opportunity_created', 'approved', 'approved', $2::uuid, '已关联商机', $3::jsonb)
          `,
          [
            报备.id,
            用户?.userId || null,
            JSON.stringify({
              opportunityId: id,
              opportunityName: 读取文本(输入, ["name", "商机名称"], ""),
            }),
          ],
        );
      }
      await client.query("COMMIT");
      return this.查询详情("opportunities", id, 用户);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async 更新商机(
    id: string,
    输入: Record<string, unknown>,
    用户: 当前业务用户 | null,
  ): Promise<阶段9记录> {
    const 上下文 = await this.解析当前用户上下文(用户);
    await this.查询详情("opportunities", id, 用户);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const 当前 = await client.query<{
        id: string;
        stage_code: string;
        raw_stage_name: string | null;
        partner_id: string | null;
        owner_user_id: string | null;
        region_id: string | null;
        customer_id: string;
      }>(
        `
        SELECT id::text AS id, stage_code, raw_stage_name, partner_id::text AS partner_id,
          owner_user_id::text AS owner_user_id, region_id::text AS region_id, customer_id::text AS customer_id
        FROM crm.opportunities
        WHERE id::text = $1 OR v2_source_id = $1 OR opportunity_no = $1
        LIMIT 1
        `,
        [id],
      );
      const row = 当前.rows[0];
      if (!row) throw new 应用错误("V3_STAGE9_NOT_FOUND", "未找到业务记录。", 404);
      const 归属 = await 解析业务归属(client, 输入, 上下文, {
        partnerId: row.partner_id,
        ownerUserId: row.owner_user_id,
        regionId: row.region_id,
      });
      const 阶段 = 读取文本(输入, ["stage", "阶段"], row.raw_stage_name || row.stage_code);
      const 状态 = 规范商机状态(阶段);
      const content = 读取文本(输入, ["followup", "content", "跟进内容"], "");
      const 客户名称 = 读取文本(输入, ["customer", "customerName", "客户名称"], "");
      const customerId = 客户名称 ? await 查询或创建客户(client, 客户名称, 输入) : row.customer_id;
      await client.query(
        `
        UPDATE crm.opportunities
        SET
          customer_id = $2::uuid,
          partner_id = $3::uuid,
          owner_user_id = $4::uuid,
          region_id = $5::uuid,
          stage_code = $6,
          raw_stage_name = $7,
          status_code = $8,
          updated_at = now(),
          row_version = row_version + 1,
          extra_json = extra_json || $9::jsonb
        WHERE id::text = $1 OR v2_source_id = $1 OR opportunity_no = $1
        `,
        [
          id,
          customerId,
          归属.partnerId,
          归属.ownerUserId,
          归属.regionId,
          阶段,
          阶段,
          状态,
          JSON.stringify({
            ...输入,
            ...(客户名称 ? { customer: 客户名称, customerName: 客户名称 } : {}),
            partnerId: 归属.partnerId || "",
            assignedPartnerId: 归属.partnerId || "",
            partnerName: 归属.partnerName,
            assignedPartnerName: 归属.partnerName,
            ownerUserId: 归属.ownerUserId || "",
            assignedStaffId: 归属.ownerUserId || "",
            assignedStaffName: 归属.ownerUserName,
            region: 归属.regionName || 读取文本(输入, ["region", "区域"], ""),
            stage: 阶段,
            followup: content,
            updatedByName: 用户?.displayName || "阶段9测试账号",
          }),
        ],
      );
      if (content) {
        await client.query(
          `
          INSERT INTO crm.opportunity_followups (opportunity_id, content, extra_json)
          VALUES ($1::uuid, $2, $3::jsonb)
          `,
          [row.id, content, JSON.stringify({ actorName: 用户?.displayName || "阶段9测试账号" })],
        );
      }
      await client.query("COMMIT");
      return this.查询详情("opportunities", id, 用户);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async 试算报价(输入: Record<string, unknown>): Promise<报价试算结果> {
    const endpoints = 读取数字(输入, ["endpoints", "端点数"], 100);
    const productIds = 读取文本数组(输入, ["productIds", "products", "产品编号"]);
    const hardwareIds = 读取文本数组(输入, ["hardwareIds", "硬件编号"]);
    const ids = [...productIds, ...hardwareIds];
    const rows =
      ids.length > 0
        ? await this.pool.query<{
            id: string;
            名称: string;
            类型: string;
            单价: string | number;
            unit_name: string | null;
          }>(
            `
            SELECT id::text, feature_name AS "名称", '功能模块' AS "类型", list_price AS "单价", unit_name
            FROM catalog.product_features
            WHERE id::text = ANY($1) OR v2_source_id = ANY($1) OR feature_code = ANY($1)
            UNION ALL
            SELECT id::text, hardware_name AS "名称", '硬件产品' AS "类型", list_price AS "单价", unit_name
            FROM catalog.hardware_products
            WHERE id::text = ANY($1) OR v2_source_id = ANY($1) OR hardware_code = ANY($1)
            UNION ALL
            SELECT id::text, package_name AS "名称", '产品套餐' AS "类型", list_price AS "单价", NULL AS unit_name
            FROM catalog.product_packages
            WHERE id::text = ANY($1) OR v2_source_id = ANY($1) OR package_code = ANY($1)
            `,
            [ids],
          )
        : { rows: [] };
    const items = rows.rows.map((项) => {
      const 单价 = Number(项.单价) || 0;
      const 数量 = String(项.unit_name || "").includes("端点") ? endpoints : 1;
      return { id: 项.id, 名称: 项.名称, 类型: 项.类型, 数量, 单价, 小计: 单价 * 数量 };
    });
    const total =
      读取数字(输入, ["total", "金额"], 0) || items.reduce((合计, 项) => 合计 + 项.小计, 0);
    const 工作量 = await this.计算数据库工作量(ids, endpoints);
    return {
      endpoints,
      productIds,
      hardwareIds,
      items,
      total,
      workloadDays: 工作量.workloadDays,
      workloadSummary: 工作量.workloadSummary,
    };
  }

  public async 创建报价(
    输入: Record<string, unknown>,
    用户: 当前业务用户 | null,
  ): Promise<阶段9记录> {
    const 当前用户上下文 = await this.解析当前用户上下文(用户);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const opportunityId = 读取文本(输入, ["opportunityId", "oppId", "商机编号"], "");
      const opp = await client.query<{
        id: string;
        customer_id: string | null;
        partner_id: string | null;
        owner_user_id: string | null;
        owner_username: string | null;
      }>(
        `
        SELECT o.id, o.customer_id, o.partner_id, o.owner_user_id, u.username::text AS owner_username
        FROM crm.opportunities o
        LEFT JOIN iam.users u ON u.id = o.owner_user_id
        WHERE o.id::text = $1 OR o.v2_source_id = $1 OR o.opportunity_no = $1
        LIMIT 1
        `,
        [opportunityId],
      );
      const 商机 = opp.rows[0];
      const 试算 = await this.试算报价(输入);
      const 提报账号 = 读取提报账号(当前用户上下文?.username, 用户?.username, 商机?.owner_username);
      const 报价编号 = await 生成业务编号(client, "quote", 提报账号);
      const result = await client.query<{ id: string }>(
        `
        INSERT INTO crm.quotes (
          quote_no, opportunity_id, customer_id, partner_id, owner_user_id, status_code,
          total_amount, discount_amount, created_at, updated_at, extra_json
        )
        VALUES ($1, $2, $3, $4, $5, 'draft', $6, 0, now(), now(), $7::jsonb)
        RETURNING id
        `,
        [
          报价编号,
          商机?.id || null,
          商机?.customer_id || null,
          商机?.partner_id || null,
          商机?.owner_user_id || null,
          试算.total,
          JSON.stringify({
            ...输入,
            total: 试算.total,
            workloadSnapshot: 试算,
            workloadSummary: 试算.workloadSummary,
            submittedByUsername: 提报账号,
            createdByName: 用户?.displayName || "阶段9测试账号",
          }),
        ],
      );
      const id = 读取返回编号(result.rows[0]);
      for (const item of 试算.items) {
        await client.query(
          `
          INSERT INTO crm.quote_items (
            quote_id, product_ref_type, product_ref_id, item_name, quantity, unit_price, line_amount
          )
          VALUES ($1, 'manual', NULL, $2, $3, $4, $5)
          `,
          [id, item.名称, item.数量, item.单价, item.小计],
        );
      }
      await client.query("COMMIT");
      return this.查询详情("quotes", id);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async 更新报价(
    id: string,
    输入: Record<string, unknown>,
    用户: 当前业务用户 | null,
  ): Promise<阶段9记录> {
    const 试算 = await this.试算报价(输入);
    await this.pool.query(
      `
      UPDATE crm.quotes
      SET total_amount = $2, updated_at = now(), row_version = row_version + 1, extra_json = extra_json || $3::jsonb
      WHERE id::text = $1 OR v2_source_id = $1 OR quote_no = $1
      `,
      [
        id,
        试算.total,
        JSON.stringify({
          total: 试算.total,
          workloadSnapshot: 试算,
          updatedByName: 用户?.displayName || "阶段9测试账号",
        }),
      ],
    );
    return this.查询详情("quotes", id);
  }

  public async 更新报价状态(
    id: string,
    输入: Record<string, unknown>,
    用户: 当前业务用户 | null,
  ): Promise<阶段9记录> {
    const 状态 = 规范报价状态(读取文本(输入, ["status", "状态"], "approved"));
    await this.pool.query(
      `
      UPDATE crm.quotes
      SET status_code = $2, updated_at = now(), row_version = row_version + 1, extra_json = extra_json || $3::jsonb
      WHERE id::text = $1 OR v2_source_id = $1 OR quote_no = $1
      `,
      [
        id,
        状态,
        JSON.stringify({ status: 状态, updatedByName: 用户?.displayName || "阶段9测试账号" }),
      ],
    );
    return this.查询详情("quotes", id);
  }

  public async 创建订单(
    输入: Record<string, unknown>,
    用户: 当前业务用户 | null,
  ): Promise<阶段9记录> {
    const 当前用户上下文 = await this.解析当前用户上下文(用户);
    const quoteId = 读取文本(输入, ["quoteId", "报价编号"], "");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query<{ id: string }>(
        `
        SELECT o.id::text AS id
        FROM crm.orders o
        JOIN crm.quotes q ON q.id = o.quote_id
        WHERE q.id::text = $1 OR q.v2_source_id = $1 OR q.quote_no = $1
        LIMIT 1
        `,
        [quoteId],
      );
      const 已有 = existing.rows[0];
      if (已有) {
        await client.query("COMMIT");
        return this.查询详情("orders", 已有.id);
      }
      const quote = await client.query<{
        id: string;
        quote_no: string | null;
        v2_source_id: string | null;
        customer_id: string | null;
        customer_name: string | null;
        partner_id: string | null;
        partner_external_id: string | null;
        partner_name: string | null;
        partner_level_code: string | null;
        owner_user_id: string | null;
        owner_user_name: string | null;
        owner_username: string | null;
        region_name: string | null;
        total_amount: string | number;
        extra_json: Record<string, unknown> | null;
        parent_partner_id: string | null;
        parent_partner_external_id: string | null;
        parent_partner_name: string | null;
      }>(
        `
        SELECT
          q.id::text AS id,
          q.quote_no,
          q.v2_source_id,
          q.customer_id::text AS customer_id,
          c.customer_name,
          q.partner_id::text AS partner_id,
          COALESCE(p.v2_source_id, p.partner_code, p.id::text) AS partner_external_id,
          p.partner_name,
          p.partner_level_code,
          q.owner_user_id::text AS owner_user_id,
          u.display_name AS owner_user_name,
          u.username::text AS owner_username,
          COALESCE(q.extra_json->>'region', '') AS region_name,
          q.total_amount,
          q.extra_json,
          parent_rel.parent_partner_id,
          parent_rel.parent_partner_external_id,
          parent_rel.parent_partner_name
        FROM crm.quotes q
        LEFT JOIN crm.customers c ON c.id = q.customer_id
        LEFT JOIN channel.partners p ON p.id = q.partner_id
        LEFT JOIN iam.users u ON u.id = q.owner_user_id
        LEFT JOIN LATERAL (
          SELECT
            parent.id::text AS parent_partner_id,
            COALESCE(parent.v2_source_id, parent.partner_code, parent.id::text) AS parent_partner_external_id,
            parent.partner_name AS parent_partner_name
          FROM channel.partner_relations rel
          JOIN channel.partners parent ON parent.id = rel.parent_partner_id
          WHERE rel.child_partner_id = q.partner_id
            AND rel.relation_code = 'primary_secondary'
            AND rel.ended_at IS NULL
            AND parent.status_code = 'active'
          ORDER BY rel.started_at DESC
          LIMIT 1
        ) parent_rel ON true
        WHERE q.id::text = $1 OR q.v2_source_id = $1 OR q.quote_no = $1
        LIMIT 1
        `,
        [quoteId],
      );
      const 报价 = quote.rows[0];
      if (!报价)
        throw new 应用错误("V3_STAGE9_QUOTE_NOT_FOUND", "报价单不存在，不能创建订单。", 404);
      const 一级渠道 = await 解析订单一级渠道(client, {
        子渠道编号: 报价.partner_id,
        子渠道层级: 报价.partner_level_code || "",
        默认一级渠道编号: 报价.parent_partner_id,
        默认一级渠道外部编号: 报价.parent_partner_external_id,
        默认一级渠道名称: 报价.parent_partner_name,
        输入,
      });
      const 初始状态 = 一级渠道 ? "pending_primary_confirm" : "primary_confirmed";
      const now = new Date().toISOString();
      const 提报账号 = 读取提报账号(当前用户上下文?.username, 用户?.username, 报价.owner_username);
      const 订单编号 = await 生成业务编号(client, "order", 提报账号);
      const 金额 = Number(报价.total_amount) || 0;
      const 操作人 = 用户?.displayName || "阶段9测试账号";
      const result = await client.query<{ id: string }>(
        `
        INSERT INTO crm.orders (
          order_no, quote_id, customer_id, partner_id, owner_user_id, status_code,
          total_amount, created_at, updated_at, extra_json
        )
        VALUES ($1, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6, $7, now(), now(), $8::jsonb)
        RETURNING id
        `,
        [
          订单编号,
          报价.id,
          报价.customer_id,
          报价.partner_id,
          报价.owner_user_id,
          初始状态,
          金额,
          JSON.stringify({
            ...输入,
            id: 订单编号,
            quoteId: 报价.quote_no || 报价.v2_source_id || quoteId || 报价.id,
            quoteUuid: 报价.id,
            customer: 报价.customer_name || 读取文本(输入, ["customer", "customerName"], ""),
            customerName: 报价.customer_name || 读取文本(输入, ["customer", "customerName"], ""),
            partnerId: 报价.partner_external_id || 读取文本(输入, ["partnerId"], ""),
            partnerName: 报价.partner_name || 读取文本(输入, ["partnerName"], ""),
            partnerLevel: 报价.partner_level_code || "",
            parentPartnerId: 一级渠道?.externalId || "",
            parentPartnerUuid: 一级渠道?.id || "",
            parentPartnerName: 一级渠道?.name || "",
            assignedPartnerId: 一级渠道?.externalId || 报价.partner_external_id || "",
            assignedPartnerName: 一级渠道?.name || 报价.partner_name || "",
            ownerUserId: 报价.owner_user_id || "",
            assignedStaffId: 报价.owner_user_id || 读取文本(输入, ["assignedStaffId"], ""),
            assignedStaffName: 报价.owner_user_name || 读取文本(输入, ["assignedStaffName"], ""),
            region: 报价.region_name || 读取文本(输入, ["region", "区域"], ""),
            total: 金额,
            amount: 金额,
            status: 初始状态,
            submittedByUsername: 提报账号,
            createdByName: 操作人,
            createdAt: now,
            updatedAt: now,
          }),
        ],
      );
      const id = 读取返回编号(result.rows[0]);
      await client.query(
        `
        INSERT INTO crm.order_items (order_id, quote_item_id, item_name, quantity, unit_price, line_amount)
        SELECT $1::uuid, qi.id, qi.item_name, qi.quantity, qi.unit_price, qi.line_amount
        FROM crm.quote_items qi
        WHERE qi.quote_id = $2::uuid
        ON CONFLICT DO NOTHING
        `,
        [id, 报价.id],
      );
      await client.query(
        "UPDATE crm.quotes SET status_code = 'converted', updated_at = now() WHERE id = $1",
        [报价.id],
      );
      await 写入订单状态历史(client, {
        订单编号: id,
        原状态: "",
        新状态: 初始状态,
        原因:
          初始状态 === "pending_primary_confirm"
            ? "报价转订单，提交一级确认"
            : "报价转订单，提交区管确认",
        用户,
      });
      await 写入订单审批待办(client, {
        订单编号: id,
        步骤: 初始状态 === "pending_primary_confirm" ? "primary_confirm" : "region_confirm",
        原因: 初始状态 === "pending_primary_confirm" ? "等待一级分销商确认" : "等待区管确认",
        用户,
      });
      await 写入订单发件箱事件(client, id, "crm.order.approval.pending", {
        status: 初始状态,
        step: 初始状态 === "pending_primary_confirm" ? "primary_confirm" : "region_confirm",
      });
      await client.query("COMMIT");
      return this.查询详情("orders", id, 用户);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async 更新订单状态(
    id: string,
    输入: Record<string, unknown>,
    用户: 当前业务用户 | null,
  ): Promise<阶段9记录> {
    const 当前用户上下文 = await this.解析当前用户上下文(用户);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const 当前 = await client.query<{
        id: string;
        status_code: string;
        total_amount: string | number;
        extra_json: Record<string, unknown> | null;
        order_no: string;
        pre_region_order_no: string | null;
        region_confirmed_by_user_id: string | null;
        region_confirmed_at: Date | null;
        v2_source_id: string | null;
        legacy_v2_status: string | null;
        is_legacy_v2_initial: boolean;
      }>(
        `
        SELECT
          o.id::text AS id,
          o.status_code,
          o.total_amount,
          o.extra_json,
          o.order_no,
          o.pre_region_order_no,
          o.region_confirmed_by_user_id::text AS region_confirmed_by_user_id,
          o.region_confirmed_at,
          o.v2_source_id,
          COALESCE(
            NULLIF(migration.v2_data(v2_raw.redacted_json)->>'status', ''),
            NULLIF(o.extra_json->>'status', '')
          ) AS legacy_v2_status,
          o.v2_source_id IS NOT NULL
            AND NOT EXISTS (
              SELECT 1
              FROM crm.order_status_history h
              WHERE h.order_id = o.id
                AND COALESCE(h.reason, '') <> '升级补齐订单审批状态机初始记录'
            ) AS is_legacy_v2_initial
        FROM crm.orders o
        LEFT JOIN LATERAL (
          SELECT r.redacted_json
          FROM migration.v2_raw_records r
          WHERE r.entity_name = 'orders'
            AND r.source_id = o.v2_source_id
          ORDER BY r.source_updated_at DESC NULLS LAST, r.created_at DESC
          LIMIT 1
        ) v2_raw ON true
        WHERE o.id::text = $1 OR o.v2_source_id = $1 OR o.order_no = $1 OR o.pre_region_order_no = $1
        LIMIT 1
        FOR UPDATE OF o
        `,
        [id],
      );
      const 订单 = 当前.rows[0];
      if (!订单) throw new 应用错误("V3_STAGE9_NOT_FOUND", "未找到业务记录。", 404);
      const 请求状态 = 规范订单状态(读取文本(输入, ["status", "状态"], "confirmed"));
      const 调价金额 = 读取订单调整金额(输入);
      const 是否调价 = 调价金额 !== null || 读取文本(输入, ["action"], "") === "price_adjust";
      if (是否调价) {
        await 校验订单所属区域区管(client, 订单.id, 当前用户上下文);
      }
      const V2历史初始状态 = 规范V2历史订单状态(订单.legacy_v2_status || "");
      const 按V2历史流程 = Boolean(
        订单.v2_source_id && 订单.is_legacy_v2_initial && V2历史初始状态,
      );
      const 状态 = 按V2历史流程
        ? 推导V2历史订单下一状态(V2历史初始状态, 请求状态)
        : 是否调价
          ? "pending_superadmin_confirm"
          : 推导订单下一状态(订单.status_code, 请求状态);
      if (!是否调价 && 订单.status_code === "pending_superadmin_confirm" && 状态 === "confirmed") {
        校验超级管理员上下文(当前用户上下文);
      }
      const 原因 = 读取文本(输入, ["reason", "remark", "adjustmentReason", "审核意见"], "");
      const 操作人 = 用户?.displayName || 读取文本(输入, ["operatorName"], "阶段9测试账号");
      const 旧金额 = Number(订单.total_amount) || 0;
      const extra = 订单.extra_json || {};
      const 调价记录 = 是否调价
        ? [
            ...(Array.isArray(extra.priceAdjustments) ? extra.priceAdjustments : []),
            {
              oldAmount: 旧金额,
              newAmount: 调价金额 ?? 旧金额,
              reason: 原因,
              operatorName: 操作人,
              timestamp: new Date().toISOString(),
              adjustedAt: new Date().toISOString(),
            },
          ]
        : undefined;
      const 需要生成正式编号 =
        !按V2历史流程 &&
        !订单.region_confirmed_at &&
        (是否调价 ||
          (订单.status_code === "primary_confirmed" && 状态 === "pending_superadmin_confirm"));
      const 正式编号结果 = 需要生成正式编号
        ? await 生成区管正式订单编号(client, 订单.id, 当前用户上下文)
        : null;
      await client.query(
        `
        UPDATE crm.orders
        SET status_code = $2,
            total_amount = COALESCE($4::numeric, total_amount),
            order_no = COALESCE($5, order_no),
            pre_region_order_no = COALESCE($6, pre_region_order_no),
            region_confirmed_by_user_id = COALESCE($7::uuid, region_confirmed_by_user_id),
            region_confirmed_at = CASE WHEN $5 IS NULL THEN region_confirmed_at ELSE now() END,
            region_confirmed_email_prefix = COALESCE($8, region_confirmed_email_prefix),
            region_confirmed_username = COALESCE($9, region_confirmed_username),
            agreement_no_snapshot = COALESCE($10, agreement_no_snapshot),
            country_calling_code_snapshot = COALESCE($11, country_calling_code_snapshot),
            contract_sequence = COALESCE($12::integer, contract_sequence),
            contract_year = COALESCE($13::integer, contract_year),
            updated_at = now(),
            row_version = row_version + 1,
            extra_json = extra_json || $3::jsonb
        WHERE id = $1::uuid
        `,
        [
          订单.id,
          状态,
          JSON.stringify({
            status: 状态,
            amount: 调价金额 ?? undefined,
            total: 调价金额 ?? undefined,
            priceAdjustments: 调价记录,
            reviewRemark: 原因,
            lastOperatorName: 操作人,
            updatedByName: 操作人,
            id: 正式编号结果?.订单编号,
            formalOrderNo: 正式编号结果?.订单编号,
            preRegionOrderNo: 正式编号结果?.前置订单编号,
            agreementNo: 正式编号结果?.协议编号,
            countryCallingCode: 正式编号结果?.国家电话区号,
            contractSequence: 正式编号结果?.合同流水号,
            contractYear: 正式编号结果?.合同年份,
            regionConfirmedByUsername: 正式编号结果?.区管账号,
            regionConfirmedEmailPrefix: 正式编号结果?.邮箱前缀,
            numberNotice: 正式编号结果?.邮箱缺失提示 || undefined,
          }),
          调价金额,
          正式编号结果?.订单编号 || null,
          正式编号结果?.前置订单编号 || null,
          正式编号结果?.区管用户编号 || null,
          正式编号结果?.邮箱前缀 || null,
          正式编号结果?.区管账号 || null,
          正式编号结果?.协议编号 || null,
          正式编号结果?.国家电话区号 || null,
          正式编号结果?.合同流水号 || null,
          正式编号结果?.合同年份 || null,
        ],
      );
      await 写入订单状态历史(client, {
        订单编号: 订单.id,
        原状态: 按V2历史流程 ? V2历史初始状态 : 订单.status_code,
        新状态: 状态,
        原因:
          原因 ||
          (按V2历史流程
            ? "V2历史订单按原流程流转"
            : 是否调价
              ? "区管调价后提交超管确认"
              : "订单状态流转"),
        用户,
      });
      if (按V2历史流程) {
        await 关闭V2历史订单审批待办(client, 订单.id, 用户);
      } else {
        await 同步订单审批链路(client, {
          订单编号: 订单.id,
          原状态: 订单.status_code,
          新状态: 状态,
          是否调价,
          原因,
          用户,
        });
        await 写入订单预审自动发起事件(client, {
          订单编号: 订单.id,
          订单编号文本: 正式编号结果?.订单编号 || 订单.order_no,
          原状态: 订单.status_code,
          新状态: 状态,
          是否当前调价: 是否调价,
          是否存在调价记录: Array.isArray(订单.extra_json?.priceAdjustments),
          区管用户编号: 正式编号结果?.区管用户编号 || 订单.region_confirmed_by_user_id,
          用户,
        });
      }
      await 写入订单发件箱事件(client, 订单.id, "crm.order.status.changed", {
        fromStatus: 订单.status_code,
        toStatus: 状态,
        priceAdjusted: 是否调价,
      });
      await client.query("COMMIT");
      return this.查询详情("orders", 订单.id, 用户);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async 读取开放接口总览(baseUrl: string): Promise<开放接口总览> {
    return 构建开放接口总览(baseUrl);
  }

  public async 查询开放接口客户端(): Promise<开放接口客户端[]> {
    const result = await this.pool.query<SQL开放接口客户端>(
      `
      SELECT
        c.id::text AS id,
        c.client_name AS name,
        c.client_code AS app_key,
        c.status_code,
        c.allowed_ip_json,
        c.extra_json,
        u.id::text AS bound_user_id,
        u.username AS bound_username,
        u.display_name AS bound_display_name,
        COALESCE(sp.extra_json->>'role', u.extra_json->>'role', '') AS bound_role,
        COALESCE(array_agg(p.resource_code ORDER BY p.resource_code) FILTER (WHERE p.resource_code IS NOT NULL), ARRAY[]::text[]) AS resources,
        EXISTS (
          SELECT 1
          FROM integration.open_api_client_secrets s
          WHERE s.client_id = c.id AND s.status_code = 'active'
        ) AS has_active_secret
      FROM integration.open_api_clients c
      LEFT JOIN iam.users u
        ON u.id::text = COALESCE(c.extra_json->>'boundUserId', '')
        OR u.v2_source_id = COALESCE(c.extra_json->>'boundUserId', '')
        OR u.username::text = COALESCE(c.extra_json->>'boundUserId', '')
      LEFT JOIN org.staff_profiles sp ON sp.user_id = u.id
      LEFT JOIN integration.open_api_permissions p ON p.client_id = c.id
      GROUP BY c.id, c.client_name, c.client_code, c.status_code, c.allowed_ip_json, c.extra_json,
        u.id, u.username, u.display_name, sp.extra_json
      ORDER BY c.created_at DESC
      `,
    );
    return result.rows.map(转换开放接口客户端);
  }

  public async 创建开放接口客户端(
    输入: Record<string, unknown>,
    用户: 当前业务用户 | null,
  ): Promise<开放接口密钥结果> {
    const 名称 = 读取文本(输入, ["name", "clientName"], "");
    if (!名称) throw new 应用错误("V3_OPEN_API_CLIENT_NAME_REQUIRED", "请填写 Client 名称。", 400);
    const boundUserId = 读取文本(输入, ["boundUserId"], "");
    if (!boundUserId)
      throw new 应用错误("V3_OPEN_API_BOUND_USER_REQUIRED", "请选择绑定 CRM 用户。", 400);
    const appKey = "oak_" + crypto.randomBytes(16).toString("hex");
    const appSecret = "osk_" + crypto.randomBytes(32).toString("base64url");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const userId = await 查询账号编号(client, boundUserId);
      if (!userId)
        throw new 应用错误("V3_OPEN_API_BOUND_USER_NOT_FOUND", "绑定 CRM 用户不存在。", 404);
      const result = await client.query<{ id: string }>(
        `
        INSERT INTO integration.open_api_clients (
          client_code, client_name, status_code, allowed_ip_json, created_by_user_id, extra_json
        )
        VALUES ($1, $2, $3, $4::jsonb, $5::uuid, $6::jsonb)
        RETURNING id::text AS id
        `,
        [
          appKey,
          名称,
          规范开放接口状态(读取文本(输入, ["status"], "active")),
          JSON.stringify(读取文本数组(输入, ["ipWhitelist"])),
          (await 查询账号编号(client, 用户?.username || "")) || userId,
          JSON.stringify({
            boundUserId: userId,
            allowedResources: 读取开放接口资源(输入),
            expiresAt: 读取文本(输入, ["expiresAt"], ""),
            remark: 读取文本(输入, ["remark"], ""),
            secretResetRequired: false,
            createdByName: 用户?.displayName || "阶段9测试账号",
          }),
        ],
      );
      const id = 读取返回编号(result.rows[0]);
      await 写入开放接口密钥(client, id, appSecret, 读取文本(输入, ["expiresAt"], ""));
      await 重写开放接口权限(client, id, 读取开放接口资源(输入));
      await 写入审计日志(client, {
        用户,
        模块: "openapi",
        动作: "create_client",
        对象类型: "open_api_client",
        对象编号: id,
        对象名称: 名称,
        结果: "success",
        说明: "新增 OpenAPI Client",
        变更后: { name: 名称, appKey, boundUserId: userId },
      });
      await client.query("COMMIT");
      return { id, appKey, appSecret };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async 更新开放接口客户端(
    id: string,
    输入: Record<string, unknown>,
    用户: 当前业务用户 | null,
  ): Promise<开放接口客户端> {
    const 名称 = 读取文本(输入, ["name", "clientName"], "");
    if (!名称) throw new 应用错误("V3_OPEN_API_CLIENT_NAME_REQUIRED", "请填写 Client 名称。", 400);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const userId = await 查询账号编号(client, 读取文本(输入, ["boundUserId"], ""));
      if (!userId)
        throw new 应用错误("V3_OPEN_API_BOUND_USER_NOT_FOUND", "绑定 CRM 用户不存在。", 404);
      const resources = 读取开放接口资源(输入);
      const result = await client.query<{ id: string }>(
        `
        UPDATE integration.open_api_clients
        SET
          client_name = $2,
          status_code = $3,
          allowed_ip_json = $4::jsonb,
          updated_at = now(),
          extra_json = extra_json || $5::jsonb
        WHERE id::text = $1 OR client_code = $1 OR v2_source_id = $1
        RETURNING id::text AS id
        `,
        [
          id,
          名称,
          规范开放接口状态(读取文本(输入, ["status"], "active")),
          JSON.stringify(读取文本数组(输入, ["ipWhitelist"])),
          JSON.stringify({
            boundUserId: userId,
            allowedResources: resources,
            expiresAt: 读取文本(输入, ["expiresAt"], ""),
            remark: 读取文本(输入, ["remark"], ""),
            updatedByName: 用户?.displayName || "阶段9测试账号",
          }),
        ],
      );
      const updatedId = 读取返回编号(result.rows[0]);
      await 重写开放接口权限(client, updatedId, resources);
      await 写入审计日志(client, {
        用户,
        模块: "openapi",
        动作: "update_client",
        对象类型: "open_api_client",
        对象编号: updatedId,
        对象名称: 名称,
        结果: "success",
        说明: "编辑 OpenAPI Client",
        变更后: 输入,
      });
      await client.query("COMMIT");
      const 列表 = await this.查询开放接口客户端();
      return 列表.find((项) => 项.id === updatedId) as 开放接口客户端;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async 重置开放接口密钥(id: string, 用户: 当前业务用户 | null): Promise<开放接口密钥结果> {
    const appSecret = "osk_" + crypto.randomBytes(32).toString("base64url");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const 当前 = await client.query<{
        id: string;
        app_key: string;
        name: string;
        expires_at: string;
      }>(
        `
        SELECT
          id::text AS id,
          client_code AS app_key,
          client_name AS name,
          COALESCE(extra_json->>'expiresAt', '') AS expires_at
        FROM integration.open_api_clients
        WHERE id::text = $1 OR client_code = $1 OR v2_source_id = $1
        LIMIT 1
        `,
        [id],
      );
      const row = 当前.rows[0];
      if (!row) throw new 应用错误("V3_OPEN_API_CLIENT_NOT_FOUND", "OpenAPI Client不存在。", 404);
      await client.query(
        `
        UPDATE integration.open_api_client_secrets
        SET status_code = 'expired'
        WHERE client_id = $1::uuid AND status_code = 'active'
        `,
        [row.id],
      );
      await 写入开放接口密钥(client, row.id, appSecret, row.expires_at || "");
      await client.query(
        `
        UPDATE integration.open_api_clients
        SET updated_at = now(), extra_json = extra_json || $2::jsonb
        WHERE id = $1::uuid
        `,
        [
          row.id,
          JSON.stringify({ secretResetRequired: false, updatedByName: 用户?.displayName || "" }),
        ],
      );
      await 写入审计日志(client, {
        用户,
        模块: "openapi",
        动作: "reset_secret",
        对象类型: "open_api_client",
        对象编号: row.id,
        对象名称: row.name,
        结果: "success",
        说明: "重置 OpenAPI Client 密钥",
      });
      await client.query("COMMIT");
      return { id: row.id, appKey: row.app_key, appSecret };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async 查询开放接口日志(limit: number): Promise<开放接口日志[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    const result = await this.pool.query<{
      id: string;
      request_id: string | null;
      time: Date;
      client_name: string | null;
      result_code: string;
      method: string | null;
      path: string | null;
      ip: string | null;
      message: string | null;
      status_code: number | null;
    }>(
      `
      SELECT
        l.id::text AS id,
        l.request_id,
        l.requested_at AS time,
        c.client_name,
        l.result_code,
        l.extra_json->>'method' AS method,
        l.extra_json->>'path' AS path,
        l.extra_json->>'ip' AS ip,
        l.extra_json->>'message' AS message,
        l.status_code
      FROM integration.open_api_access_logs l
      LEFT JOIN integration.open_api_clients c ON c.id = l.client_id
      ORDER BY l.requested_at DESC
      LIMIT $1
      `,
      [safeLimit],
    );
    return result.rows.map((row) => ({
      id: row.id,
      requestId: row.request_id || "",
      time: 格式化时间(row.time),
      clientName: row.client_name || "-",
      resultCode: row.status_code || (row.result_code === "success" ? 0 : 1),
      method: row.method || "GET",
      path: row.path || "-",
      ip: row.ip || "",
      resultMessage: row.message || row.result_code,
    }));
  }

  public async 签发开放接口令牌(
    输入: Record<string, unknown>,
    ip: string,
    requestId?: string,
  ): Promise<开放接口令牌> {
    const appKey = 读取文本(输入, ["appKey", "clientId"], "");
    const appSecret = 读取文本(输入, ["appSecret", "clientSecret"], "");
    const startedAt = performance.now();
    let clientId = "";
    let 失败阶段 = "request";
    const 认证诊断 = {
      appKey,
      appKeyPresent: Boolean(appKey),
      appSecretPresent: Boolean(appSecret),
      appSecretLength: appSecret.length,
      appSecretFingerprint: 创建开放接口日志指纹(appSecret, "openapi-app-secret"),
    };
    try {
      if (!appKey || !appSecret)
        throw new 应用错误("V3_OPEN_API_BAD_TOKEN_REQUEST", "请填写 AppKey 和 AppSecret。", 400);
      失败阶段 = "client_lookup";
      const result = await this.pool.query<SQL开放接口密钥校验>(
        `
        SELECT
          c.id::text AS client_id,
          c.client_name,
          c.client_code,
          c.status_code,
          c.allowed_ip_json,
          c.extra_json,
          s.secret_hash,
          s.expires_at,
          u.id::text AS bound_user_id,
          u.display_name AS bound_user_name,
          COALESCE(array_agg(p.resource_code ORDER BY p.resource_code) FILTER (WHERE p.resource_code IS NOT NULL), ARRAY[]::text[]) AS resources
        FROM integration.open_api_clients c
        JOIN integration.open_api_client_secrets s ON s.client_id = c.id AND s.status_code = 'active'
        LEFT JOIN integration.open_api_permissions p ON p.client_id = c.id
        LEFT JOIN iam.users u
          ON u.id::text = COALESCE(c.extra_json->>'boundUserId', '')
          OR u.v2_source_id = COALESCE(c.extra_json->>'boundUserId', '')
          OR u.username::text = COALESCE(c.extra_json->>'boundUserId', '')
        WHERE c.client_code = $1
        GROUP BY c.id, c.client_name, c.client_code, c.status_code, c.allowed_ip_json, c.extra_json, s.secret_hash, s.expires_at, s.created_at, u.id, u.display_name
        ORDER BY s.created_at DESC
        LIMIT 1
        `,
        [appKey],
      );
      const row = result.rows[0];
      if (!row) throw new 应用错误("V3_OPEN_API_TOKEN_DENIED", "AppKey 或 AppSecret 不正确。", 401);
      clientId = row.client_id;
      失败阶段 = "client_status";
      if (row.status_code !== "active")
        throw new 应用错误("V3_OPEN_API_CLIENT_DISABLED", "OpenAPI Client 已停用。", 403);
      if (row.expires_at && row.expires_at.getTime() <= Date.now())
        throw new 应用错误("V3_OPEN_API_CLIENT_EXPIRED", "OpenAPI Client 已过期。", 403);
      失败阶段 = "ip_whitelist";
      const ipWhitelist = 解析JSON数组(row.allowed_ip_json);
      if (ipWhitelist.length && !ipWhitelist.includes("*") && !ipWhitelist.includes(ip)) {
        throw new 应用错误("V3_OPEN_API_IP_DENIED", "当前访问 IP 不在白名单内。", 403);
      }
      失败阶段 = "secret_verify";
      if (!校验开放接口密钥(appSecret, row.secret_hash)) {
        throw new 应用错误("V3_OPEN_API_TOKEN_DENIED", "AppKey 或 AppSecret 不正确。", 401);
      }
      失败阶段 = "issue_token";
      const ttl = 2 * 60 * 60;
      const allowedResources = row.resources.length
        ? row.resources
        : 解析JSON数组(row.extra_json?.allowedResources);
      const accessToken = 签发开放接口访问令牌({
        clientId: row.client_id,
        clientName: row.client_name,
        appKey: row.client_code,
        allowedResources: allowedResources.length ? allowedResources : ["*"],
        boundUserId: row.bound_user_id || "",
        boundUserName: row.bound_user_name || "",
        ttl,
      });
      await this.记录开放接口调用({
        clientId,
        ...(requestId ? { requestId } : {}),
        resourceCode: "auth",
        actionCode: "token",
        resultCode: "success",
        statusCode: 200,
        durationMs: Math.round(performance.now() - startedAt),
        method: "POST",
        path: "/api/open/v1/auth/token",
        ip,
        message: "签发 OpenAPI 访问令牌",
        extra: {
          ...认证诊断,
          clientId: row.client_id,
          clientName: row.client_name,
          clientCode: row.client_code,
          allowedResourceCount: allowedResources.length,
          accessTokenFingerprint: 创建开放接口日志指纹(accessToken, "openapi-access-token"),
          accessTokenLength: accessToken.length,
          expiresInSeconds: ttl,
        },
      });
      return { accessToken, tokenType: "Bearer", expiresInSeconds: ttl, allowedResources };
    } catch (error) {
      await this.记录开放接口调用({
        clientId,
        ...(requestId ? { requestId } : {}),
        resourceCode: "auth",
        actionCode: "token",
        resultCode: "failed",
        statusCode: error instanceof 应用错误 ? error.statusCode : 500,
        durationMs: Math.round(performance.now() - startedAt),
        method: "POST",
        path: "/api/open/v1/auth/token",
        ip,
        message: error instanceof Error ? error.message : "签发令牌失败",
        extra: {
          ...认证诊断,
          failedStep: 失败阶段,
          errorCode: error instanceof 应用错误 ? error.code : "V3_OPEN_API_TOKEN_INTERNAL_ERROR",
          errorMessage: error instanceof Error ? error.message : "签发令牌失败",
        },
      });
      throw error;
    }
  }

  public async 读取开放接口身份(token: string): Promise<开放接口身份> {
    const payload = 解析开放接口访问令牌(token);
    const result = await this.pool.query<{ status_code: string; name: string }>(
      `
      SELECT status_code, client_name AS name
      FROM integration.open_api_clients
      WHERE id::text = $1 AND client_code = $2
      LIMIT 1
      `,
      [payload.clientId, payload.appKey],
    );
    const row = result.rows[0];
    if (!row || row.status_code !== "active") {
      throw new 应用错误("V3_OPEN_API_TOKEN_INVALID", "OpenAPI 访问令牌无效。", 401);
    }
    return payload;
  }

  public async 记录开放接口调用(输入: {
    clientId?: string;
    requestId?: string;
    resourceCode: string;
    actionCode: string;
    resultCode: string;
    statusCode: number;
    durationMs: number;
    method: string;
    path: string;
    ip: string;
    message: string;
    extra?: Record<string, unknown>;
  }): Promise<void> {
    await this.pool.query(
      `
      INSERT INTO integration.open_api_access_logs (
        client_id, request_id, resource_code, action_code, result_code, status_code,
        duration_ms, extra_json
      )
      VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8::jsonb)
      `,
      [
        输入.clientId || null,
        输入.requestId || null,
        输入.resourceCode,
        输入.actionCode,
        输入.resultCode,
        输入.statusCode,
        输入.durationMs,
        JSON.stringify({
          method: 输入.method,
          path: 输入.path,
          ip: 输入.ip,
          message: 输入.message,
          ...(清理日志字段(输入.extra || {}) as Record<string, unknown>),
        }),
      ],
    );
  }

  public async 查询工作量映射(keyword = ""): Promise<工作量映射项[]> {
    const 查询词 = "%" + keyword.trim() + "%";
    const result = await this.pool.query<SQL工作量映射项>(
      `
      WITH product_items AS (
        SELECT
          f.id,
          'feature'::text AS item_type,
          f.feature_name AS item_name,
          COALESCE(f.feature_code, f.v2_source_id, '') AS product_code,
          COALESCE(m.module_name, '') AS module_name,
          COALESCE(c.category_name, '') AS category_name,
          f.status_code
        FROM catalog.product_features f
        LEFT JOIN catalog.product_modules m ON m.id = f.module_id
        LEFT JOIN catalog.product_categories c ON c.id = m.category_id
        UNION ALL
        SELECT
          h.id,
          'hardware'::text,
          h.hardware_name,
          COALESCE(h.hardware_code, h.v2_source_id, ''),
          '硬件产品',
          '硬件产品',
          h.status_code
        FROM catalog.hardware_products h
      ),
      mapping_tags AS (
        SELECT
          p.id,
          p.item_type,
          COALESCE(
            jsonb_agg(DISTINCT tag.value) FILTER (WHERE tag.value IS NOT NULL),
            '[]'::jsonb
          ) AS delivery_tags,
          COALESCE(bool_or(wm.status_code = 'active'), true) AS active
        FROM product_items p
        LEFT JOIN catalog.workload_mappings wm
          ON (
            wm.product_ref_type = p.item_type
            AND wm.product_ref_id = p.id
          )
          OR (
            p.item_type = 'feature'
            AND wm.feature_id = p.id
          )
        LEFT JOIN catalog.workload_classifications wc ON wc.id = wm.classification_id
        LEFT JOIN LATERAL jsonb_array_elements_text(
          CASE
            WHEN jsonb_typeof(wm.delivery_tags) = 'array' THEN wm.delivery_tags
            WHEN wc.classification_code IS NOT NULL THEN jsonb_build_array(wc.classification_code)
            ELSE '[]'::jsonb
          END
        ) AS tag(value) ON true
        GROUP BY p.id, p.item_type
      )
      SELECT
        p.id::text AS feature_id,
        p.item_name AS feature_name,
        p.item_type,
        p.module_name,
        p.category_name,
        p.product_code,
        COALESCE(t.delivery_tags, '[]'::jsonb) AS delivery_tags,
        COALESCE(t.active, p.status_code = 'active') AS active
      FROM product_items p
      LEFT JOIN mapping_tags t ON t.id = p.id AND t.item_type = p.item_type
      WHERE $1 = '%%'
        OR p.item_name ILIKE $1
        OR p.product_code ILIKE $1
        OR p.module_name ILIKE $1
        OR p.category_name ILIKE $1
      ORDER BY p.item_type, p.item_name
      `,
      [查询词],
    );
    return result.rows.map((row) => ({
      featureId: row.feature_id,
      featureName: row.feature_name,
      itemType: row.item_type,
      moduleName: row.module_name || "",
      categoryName: row.category_name || "",
      productCode: row.product_code || "",
      deliveryTags: 解析JSON数组(row.delivery_tags),
      active: row.active,
    }));
  }

  public async 保存工作量映射(
    productId: string,
    输入: Record<string, unknown>,
    用户: 当前业务用户 | null,
  ): Promise<工作量映射项> {
    const deliveryTags = 读取文本数组(输入, ["deliveryTags", "产品类型"]);
    const active = 读取布尔(输入, ["active"], true);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const product = await 查询工作量产品(client, productId);
      if (!product)
        throw new 应用错误("V3_WORKLOAD_PRODUCT_NOT_FOUND", "工作量映射产品不存在。", 404);
      await client.query(
        `
        UPDATE catalog.workload_mappings
        SET status_code = 'disabled', delivery_tags = '[]'::jsonb
        WHERE (product_ref_type = $1 AND product_ref_id = $2::uuid)
           OR ($1 = 'feature' AND feature_id = $2::uuid)
        `,
        [product.itemType, product.id],
      );
      for (const tag of deliveryTags) {
        const classificationId = await 查询或创建工作量分类(client, tag);
        const existing = await client.query<{ id: string }>(
          `
          SELECT id::text AS id
          FROM catalog.workload_mappings
          WHERE product_ref_type = $1 AND product_ref_id = $2::uuid AND classification_id = $3::uuid
          LIMIT 1
          `,
          [product.itemType, product.id, classificationId],
        );
        if (existing.rows[0]) {
          await client.query(
            `
            UPDATE catalog.workload_mappings
            SET status_code = $2, delivery_tags = $3::jsonb, extra_json = extra_json || $4::jsonb
            WHERE id::text = $1
            `,
            [
              existing.rows[0].id,
              active ? "active" : "disabled",
              JSON.stringify([tag]),
              JSON.stringify({
                itemType: product.itemType,
                productRefId: product.id,
                deliveryTags,
                updatedByName: 用户?.displayName || "阶段9测试账号",
              }),
            ],
          );
        } else {
          await client.query(
            `
            INSERT INTO catalog.workload_mappings (
              v2_source_id, feature_id, classification_id, status_code,
              product_ref_type, product_ref_id, delivery_tags, extra_json
            )
            VALUES ($1, $2::uuid, $3::uuid, $4, $5, $6::uuid, $7::jsonb, $8::jsonb)
            `,
            [
              `V3-WM-${product.itemType}-${product.id}-${tag}`,
              product.itemType === "feature" ? product.id : null,
              classificationId,
              active ? "active" : "disabled",
              product.itemType,
              product.id,
              JSON.stringify([tag]),
              JSON.stringify({
                itemType: product.itemType,
                productRefId: product.id,
                deliveryTags,
                createdByName: 用户?.displayName || "阶段9测试账号",
              }),
            ],
          );
        }
      }
      await 写入审计日志(client, {
        用户,
        模块: "workload",
        动作: "update_mapping",
        对象类型: "workload_mapping",
        对象编号: product.id,
        对象名称: product.name,
        结果: "success",
        说明: "保存工作量产品映射",
        变更后: { deliveryTags, active },
      });
      await client.query("COMMIT");
      return (await this.查询工作量映射(product.name)).find(
        (项) => 项.featureId === product.id,
      ) as 工作量映射项;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async 查询交付工作量规则(): Promise<交付工作量规则项[]> {
    const result = await this.pool.query<SQL交付工作量规则项>(
      `
      SELECT
        id::text AS id,
        rule_name,
        workload_days,
        status_code,
        extra_json
      FROM catalog.delivery_workload_rules
      ORDER BY COALESCE((extra_json->>'sortOrder')::integer, 999), rule_name
      `,
    );
    return result.rows.map(转换交付工作量规则);
  }

  public async 保存交付工作量规则(
    id: string,
    输入: Record<string, unknown>,
    用户: 当前业务用户 | null,
  ): Promise<交付工作量规则项> {
    const 当前 = await this.pool.query<{
      id: string;
      rule_name: string;
      extra_json: Record<string, unknown>;
    }>(
      `
      SELECT id::text AS id, rule_name, extra_json
      FROM catalog.delivery_workload_rules
      WHERE id::text = $1 OR v2_source_id = $1
      LIMIT 1
      `,
      [id],
    );
    const row = 当前.rows[0];
    if (!row) throw new 应用错误("V3_WORKLOAD_RULE_NOT_FOUND", "交付工作量规则不存在。", 404);
    const extra = row.extra_json || {};
    const merged = {
      ...extra,
      minPoints: 读取可空数字(输入, ["minPoints"], 读取可空数字(extra, ["minPoints"], null)),
      maxPoints: 读取可空数字(输入, ["maxPoints"], 读取可空数字(extra, ["maxPoints"], null)),
      personDays: 读取数字(
        输入,
        ["personDays", "workloadDays"],
        读取数字(extra, ["personDays"], 0),
      ),
      comboPersonDays: 读取可空数字(
        输入,
        ["comboPersonDays"],
        读取可空数字(extra, ["comboPersonDays"], null),
      ),
      remark: 读取文本(输入, ["remark"], 读取对象文本(extra, "remark")),
      active: 读取布尔(输入, ["active"], 读取对象布尔(extra, "active", true)),
    };
    await this.pool.query(
      `
      UPDATE catalog.delivery_workload_rules
      SET workload_days = $2, status_code = $3, extra_json = $4::jsonb
      WHERE id = $1::uuid
      `,
      [
        row.id,
        Number(merged.personDays) || 0,
        merged.active ? "active" : "disabled",
        JSON.stringify(merged),
      ],
    );
    await 写入审计日志(this.pool, {
      用户,
      模块: "workload",
      动作: "update_delivery_rule",
      对象类型: "delivery_workload_rule",
      对象编号: row.id,
      对象名称: row.rule_name,
      结果: "success",
      说明: "保存新版交付工作量规则",
      变更后: merged,
    });
    const 规则 = (await this.查询交付工作量规则()).find((项) => 项.id === row.id);
    if (!规则) throw new 应用错误("V3_WORKLOAD_RULE_NOT_FOUND", "交付工作量规则不存在。", 404);
    return 规则;
  }

  private async 统计表(标题: string, 表名: string, 说明: string) {
    const result = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM ${表名}`,
    );
    return { 标题, 数量: Number(result.rows[0]?.count || 0), 说明 };
  }

  private async 计算数据库工作量(
    productIds: string[],
    endpoints: number,
  ): Promise<{ workloadDays: number; workloadSummary: string }> {
    const tags = await this.查询报价交付标签(productIds);
    if (!tags.length) {
      const fallback = Math.max(2.5, Math.round((endpoints / 100) * 2.5 * 10) / 10);
      return {
        workloadDays: fallback,
        workloadSummary: `${endpoints}点，未命中产品工作量映射，按基础公式建议 ${fallback} 人天`,
      };
    }
    const rules = await this.查询交付工作量规则();
    const 应用项: Array<{ 标签: string; 名称: string; 人天: number }> = [];
    for (const tag of tags) {
      const 候选规则 = rules.filter(
        (rule) => rule.active && rule.deliveryTag === tag && this.规则命中点数(rule, endpoints),
      );
      const 命中规则 =
        候选规则.find((rule) => rule.ruleType === "base") ||
        候选规则.find((rule) => rule.ruleType === "addon") ||
        候选规则[0];
      if (!命中规则) continue;
      const 人天 =
        命中规则.ruleType === "fixed" && tags.length > 1 && 命中规则.comboPersonDays !== null
          ? 命中规则.comboPersonDays
          : 命中规则.personDays;
      应用项.push({ 标签: tag, 名称: 命中规则.productTypeLabel || tag, 人天 });
    }
    if (!应用项.length) {
      const fallback = Math.max(2.5, Math.round((endpoints / 100) * 2.5 * 10) / 10);
      return {
        workloadDays: fallback,
        workloadSummary: `${endpoints}点，工作量规则未命中，按基础公式建议 ${fallback} 人天`,
      };
    }
    const workloadDays = Math.round(应用项.reduce((合计, 项) => 合计 + 项.人天, 0) * 10) / 10;
    const 标签说明 = 应用项.map((项) => `${项.名称}${项.人天}人天`).join("、");
    return {
      workloadDays,
      workloadSummary: `${endpoints}点，${标签说明}，建议 ${workloadDays} 人天`,
    };
  }

  private async 查询报价交付标签(productIds: string[]): Promise<string[]> {
    if (!productIds.length) return [];
    const result = await this.pool.query<{ tag: string }>(
      `
      WITH selected AS (
        SELECT id, 'feature'::text AS item_type
        FROM catalog.product_features
        WHERE id::text = ANY($1) OR v2_source_id = ANY($1) OR feature_code = ANY($1)
        UNION ALL
        SELECT id, 'hardware'::text AS item_type
        FROM catalog.hardware_products
        WHERE id::text = ANY($1) OR v2_source_id = ANY($1) OR hardware_code = ANY($1)
        UNION ALL
        SELECT item.product_ref_id AS id, item.product_ref_type AS item_type
        FROM catalog.package_items item
        JOIN catalog.product_packages pkg ON pkg.id = item.package_id
        WHERE pkg.id::text = ANY($1) OR pkg.v2_source_id = ANY($1) OR pkg.package_code = ANY($1)
      ),
      tags AS (
        SELECT DISTINCT tag.value AS tag
        FROM selected s
        JOIN catalog.workload_mappings wm
          ON wm.status_code = 'active'
         AND (
              (wm.product_ref_type = s.item_type AND wm.product_ref_id = s.id)
              OR (s.item_type = 'feature' AND wm.feature_id = s.id)
            )
        LEFT JOIN catalog.workload_classifications wc ON wc.id = wm.classification_id
        LEFT JOIN LATERAL jsonb_array_elements_text(
          CASE
            WHEN jsonb_typeof(wm.delivery_tags) = 'array' AND jsonb_array_length(wm.delivery_tags) > 0
              THEN wm.delivery_tags
            WHEN wc.classification_code IS NOT NULL THEN jsonb_build_array(wc.classification_code)
            ELSE '[]'::jsonb
          END
        ) AS tag(value) ON true
      )
      SELECT tag
      FROM tags
      WHERE tag <> ''
      ORDER BY tag
      `,
      [productIds],
    );
    return result.rows.map((row) => row.tag).filter(Boolean);
  }

  private 规则命中点数(rule: 交付工作量规则项, endpoints: number): boolean {
    if (rule.ruleType === "fixed") return true;
    const min = rule.minPoints ?? 1;
    const max = rule.maxPoints ?? Number.MAX_SAFE_INTEGER;
    return endpoints >= min && endpoints <= max;
  }

  private async 查询迁移状态() {
    const result = await this.pool.query<{
      批次编号: string | null;
      正式落表: string | null;
      校验结论: string | null;
    }>(
      `
      SELECT
        COALESCE(batch_code, '未发现阶段8批次') AS "批次编号",
        COALESCE(status_code, 'unknown') AS "正式落表",
        COALESCE((
          SELECT CASE WHEN COUNT(*) FILTER (WHERE result_code = 'failed') = 0 THEN '通过' ELSE '存在失败项' END
          FROM migration.validation_results v
          WHERE v.batch_id = b.id AND v.check_code LIKE 'S8_4_%'
        ), '未执行阶段8.4校验') AS "校验结论"
      FROM migration.migration_batches b
      ORDER BY started_at DESC
      LIMIT 1
      `,
    );
    return {
      批次编号: result.rows[0]?.批次编号 || "未发现阶段8批次",
      正式落表: result.rows[0]?.正式落表 || "unknown",
      校验结论: result.rows[0]?.校验结论 || "未执行阶段8.4校验",
    };
  }

  private 模块查询SQL(模块: 阶段9模块, where: string): string {
    switch (模块) {
      case "registrations":
        return 报备查询SQL(where);
      case "opportunities":
        return 商机查询SQL(where);
      case "quotes":
        return 报价查询SQL(where);
      case "orders":
        return 订单查询SQL(where);
      case "partners":
        return 渠道查询SQL(where);
      case "products":
        return 产品查询SQL(where);
      case "users":
        return 账号查询SQL(where);
      case "audit":
        return 审计查询SQL(where);
      case "openapi":
        return 开放接口查询SQL(where);
      case "workload":
        return 工作量查询SQL(where);
      case "approvals":
        return 审核查询SQL(where);
      case "notifications":
        return 通知查询SQL(where);
      case "importExport":
        return 导入导出查询SQL(where);
    }
  }

  private async 查询通用列表(
    baseSql: string,
    参数: unknown[],
    查询: 阶段9查询参数 = { page: 1, pageSize: 20 },
  ): Promise<阶段9列表结果> {
    const offset = (查询.page - 1) * 查询.pageSize;
    const countSql = `SELECT COUNT(*)::text AS count FROM (${baseSql}) t`;
    const listSql = `SELECT * FROM (${baseSql}) t ORDER BY "创建时间" DESC NULLS LAST LIMIT $${参数.length + 1} OFFSET $${参数.length + 2}`;
    const [countResult, listResult] = await Promise.all([
      this.pool.query<{ count: string }>(countSql, 参数),
      this.pool.query<SQL阶段9记录>(listSql, [...参数, 查询.pageSize, offset]),
    ]);
    return {
      数据: listResult.rows.map(转SQL记录),
      分页: { 页码: 查询.page, 每页: 查询.pageSize, 总数: Number(countResult.rows[0]?.count || 0) },
    };
  }
}

interface SQL阶段9记录 {
  id: string;
  编号: string | null;
  类型: string;
  标题: string | null;
  客户名称: string | null;
  渠道名称: string | null;
  负责人: string | null;
  区域: string | null;
  状态: string | null;
  状态名称: string | null;
  金额: string | number | null;
  创建时间: string | Date | null;
  更新时间: string | Date | null;
  原始数据: Record<string, unknown> | null;
}

interface SQL开放接口客户端 {
  id: string;
  name: string;
  app_key: string;
  status_code: string;
  allowed_ip_json: unknown;
  extra_json: Record<string, unknown> | null;
  bound_user_id: string | null;
  bound_username: string | null;
  bound_display_name: string | null;
  bound_role: string | null;
  resources: string[];
  has_active_secret: boolean;
}

interface SQL开放接口密钥校验 {
  client_id: string;
  client_name: string;
  client_code: string;
  status_code: string;
  allowed_ip_json: unknown;
  extra_json: Record<string, unknown> | null;
  secret_hash: string;
  expires_at: Date | null;
  bound_user_id: string | null;
  bound_user_name: string | null;
  resources: string[];
}

interface SQL工作量映射项 {
  feature_id: string;
  feature_name: string;
  item_type: "feature" | "hardware";
  module_name: string | null;
  category_name: string | null;
  product_code: string | null;
  delivery_tags: unknown;
  active: boolean;
}

interface SQL交付工作量规则项 {
  id: string;
  rule_name: string;
  workload_days: string | number;
  status_code: string;
  extra_json: Record<string, unknown> | null;
}

interface 数据库执行器 {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: T[] }>;
}

function 构建开放接口总览(baseUrl: string): 开放接口总览 {
  const cleanBase = baseUrl.replace(/\/$/, "");
  return {
    baseUrl: `${cleanBase}/open/v1`,
    tokenEndpoint: `${cleanBase}/open/v1/auth/token`,
    tokenTtlSeconds: 2 * 60 * 60,
    coreResources: ["users", "partners", "registrations", "opportunities", "quotes", "orders"],
    docs: [
      {
        id: "openapi-quickstart",
        title: "OpenAPI 对接说明",
        description: "AppKey、AppSecret、Token 和核心资源调用说明。",
        fileName: "OpenAPI对接说明.md",
        available: true,
      },
      {
        id: "workload-openapi",
        title: "工作量接口说明",
        description: "产品映射、交付规则和报价工作量预览接口说明。",
        fileName: "工作量接口说明.md",
        available: true,
      },
    ],
  };
}

function 转换开放接口客户端(row: SQL开放接口客户端): 开放接口客户端 {
  const extra = row.extra_json || {};
  const boundUserId = row.bound_user_id || 读取对象文本(extra, "boundUserId");
  const allowedResources = row.resources.length
    ? row.resources
    : 解析JSON数组(extra.allowedResources, ["*"]);
  const 客户端: 开放接口客户端 = {
    id: row.id,
    name: row.name,
    appKey: row.app_key,
    boundUserId,
    status: row.status_code,
    ipWhitelist: 解析JSON数组(row.allowed_ip_json),
    allowedResources,
    expiresAt: 读取对象文本(extra, "expiresAt"),
    remark: 读取对象文本(extra, "remark"),
    secretResetRequired:
      读取对象布尔(extra, "secretResetRequired", false) || !row.has_active_secret,
  };
  if (row.bound_user_id || row.bound_username || row.bound_display_name) {
    客户端.boundUser = {
      id: row.bound_user_id || boundUserId,
      username: row.bound_username || "",
      name: row.bound_display_name || "",
      role: row.bound_role || "",
    };
  }
  return 客户端;
}

function 转换交付工作量规则(row: SQL交付工作量规则项): 交付工作量规则项 {
  const extra = row.extra_json || {};
  const minPoints = 读取可空数字(extra, ["minPoints"], null);
  const maxPoints = 读取可空数字(extra, ["maxPoints"], null);
  return {
    id: row.id,
    item: 读取对象文本(extra, "item") || row.rule_name,
    productTypeLabel: 读取对象文本(extra, "productTypeLabel") || row.rule_name,
    deliveryTag:
      读取对象文本(extra, "deliveryTag") || 读取对象文本(extra, "productType") || row.rule_name,
    condition:
      读取对象文本(extra, "condition") ||
      (读取对象文本(extra, "ruleType") === "fixed"
        ? "独立项目"
        : `${minPoints ?? 1}-${maxPoints ?? 5000}点`),
    ruleType: 读取对象文本(extra, "ruleType") || "base",
    minPoints,
    maxPoints,
    personDays: 读取数字(extra, ["personDays", "workloadDays"], Number(row.workload_days) || 0),
    comboPersonDays: 读取可空数字(extra, ["comboPersonDays"], null),
    remark: 读取对象文本(extra, "remark"),
    active: row.status_code === "active" && 读取对象布尔(extra, "active", true),
  };
}

function 转内存交付工作量规则(原始数据: Record<string, unknown>): 交付工作量规则项 {
  return {
    id: 读取文本(原始数据, ["id"], ""),
    item: 读取文本(原始数据, ["item", "name"], "工作量规则"),
    productTypeLabel: 读取文本(原始数据, ["productTypeLabel", "item"], "工作量规则"),
    deliveryTag: 读取文本(原始数据, ["deliveryTag", "productType"], ""),
    condition: 读取文本(原始数据, ["condition"], ""),
    ruleType: 读取文本(原始数据, ["ruleType"], "base"),
    minPoints: 读取可空数字(原始数据, ["minPoints"], null),
    maxPoints: 读取可空数字(原始数据, ["maxPoints"], null),
    personDays: 读取数字(原始数据, ["personDays", "workloadDays"], 0),
    comboPersonDays: 读取可空数字(原始数据, ["comboPersonDays"], null),
    remark: 读取文本(原始数据, ["remark"], ""),
    active: 读取布尔(原始数据, ["active"], true),
  };
}

function 规范开放接口状态(value: string): string {
  return value === "disabled" ? "disabled" : "active";
}

function 读取开放接口资源(输入: Record<string, unknown>): string[] {
  const resources = 读取文本数组(输入, ["allowedResources", "resources"]);
  if (!resources.length || resources.includes("*")) return ["*"];
  return Array.from(new Set(resources));
}

async function 写入开放接口密钥(
  client: PoolClient,
  clientId: string,
  appSecret: string,
  expiresAt: string,
): Promise<void> {
  await client.query(
    `
    INSERT INTO integration.open_api_client_secrets (
      client_id, secret_hash, algorithm, status_code, expires_at
    )
    VALUES ($1::uuid, $2, 'scrypt', 'active', $3::timestamptz)
    `,
    [clientId, 创建开放接口密钥散列(appSecret), expiresAt || null],
  );
}

async function 重写开放接口权限(
  client: PoolClient,
  clientId: string,
  resources: string[],
): Promise<void> {
  await client.query("DELETE FROM integration.open_api_permissions WHERE client_id = $1::uuid", [
    clientId,
  ]);
  for (const resource of resources.length ? resources : ["*"]) {
    await client.query(
      `
      INSERT INTO integration.open_api_permissions (client_id, resource_code, action_code)
      VALUES ($1::uuid, $2, 'read')
      ON CONFLICT DO NOTHING
      `,
      [clientId, resource],
    );
  }
}

function 创建开放接口密钥散列(secret: string, salt = crypto.randomBytes(16)): string {
  const n = 16384;
  const r = 8;
  const p = 1;
  const key = crypto.scryptSync(secret, salt, 64, { N: n, r, p, maxmem: 64 * 1024 * 1024 });
  return [
    "scrypt",
    "v1",
    String(n),
    String(r),
    String(p),
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
}

function 校验开放接口密钥(secret: string, storedHash: string): boolean {
  const parts = storedHash.split("$");
  if (parts.length !== 7 || parts[0] !== "scrypt" || parts[1] !== "v1") return false;
  const [, , nText, rText, pText, salt, expected] = parts;
  if (!nText || !rText || !pText || !salt || !expected) return false;
  const derived = crypto.scryptSync(
    secret,
    Buffer.from(salt, "base64url"),
    Buffer.from(expected, "base64url").length,
    {
      N: Number(nText),
      r: Number(rText),
      p: Number(pText),
      maxmem: 64 * 1024 * 1024,
    },
  );
  return 安全比较文本(derived.toString("base64url"), expected);
}

function 创建开放接口日志指纹(value: string, purpose: string): string {
  if (!value) return "";
  return crypto
    .createHmac("sha256", 开放接口令牌密钥())
    .update("log-fingerprint:")
    .update(purpose)
    .update(":")
    .update(value)
    .digest("hex")
    .slice(0, 16);
}

function 签发开放接口访问令牌(输入: 开放接口身份 & { ttl: number }): string {
  const payload = {
    clientId: 输入.clientId,
    clientName: 输入.clientName,
    appKey: 输入.appKey,
    allowedResources: 输入.allowedResources,
    boundUserId: 输入.boundUserId,
    boundUserName: 输入.boundUserName,
    expiresAt: Math.floor(Date.now() / 1000) + 输入.ttl,
    nonce: crypto.randomBytes(16).toString("base64url"),
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return (
    body + "." + crypto.createHmac("sha256", 开放接口令牌密钥()).update(body).digest("base64url")
  );
}

function 解析开放接口访问令牌(token: string): 开放接口身份 {
  const [body, signature] = token.split(".");
  if (!body || !signature)
    throw new 应用错误("V3_OPEN_API_TOKEN_INVALID", "OpenAPI 访问令牌无效。", 401);
  const expected = crypto.createHmac("sha256", 开放接口令牌密钥()).update(body).digest("base64url");
  if (!安全比较文本(signature, expected)) {
    throw new 应用错误("V3_OPEN_API_TOKEN_INVALID", "OpenAPI 访问令牌无效。", 401);
  }
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as 开放接口身份 & {
    expiresAt: number;
  };
  if (!payload.clientId || !payload.appKey || payload.expiresAt <= Math.floor(Date.now() / 1000)) {
    throw new 应用错误("V3_OPEN_API_TOKEN_INVALID", "OpenAPI 访问令牌无效。", 401);
  }
  return {
    clientId: payload.clientId,
    clientName: payload.clientName,
    appKey: payload.appKey,
    allowedResources: payload.allowedResources,
    boundUserId: payload.boundUserId,
    boundUserName: payload.boundUserName,
  };
}

function 开放接口令牌密钥(): string {
  return process.env.SESSION_SECRET || "local-dev-session-secret-change-me";
}

async function 查询工作量产品(
  client: PoolClient,
  productId: string,
): Promise<{ id: string; itemType: "feature" | "hardware"; name: string } | null> {
  const result = await client.query<{
    id: string;
    item_type: "feature" | "hardware";
    name: string;
  }>(
    `
    SELECT id::text, 'feature'::text AS item_type, feature_name AS name
    FROM catalog.product_features
    WHERE id::text = $1 OR v2_source_id = $1 OR feature_code = $1
    UNION ALL
    SELECT id::text, 'hardware'::text AS item_type, hardware_name AS name
    FROM catalog.hardware_products
    WHERE id::text = $1 OR v2_source_id = $1 OR hardware_code = $1
    LIMIT 1
    `,
    [productId],
  );
  const row = result.rows[0];
  return row ? { id: row.id, itemType: row.item_type, name: row.name } : null;
}

async function 查询或创建工作量分类(client: PoolClient, tag: string): Promise<string> {
  const result = await client.query<{ id: string }>(
    `
    INSERT INTO catalog.workload_classifications (
      classification_code, classification_name, status_code
    )
    VALUES ($1, $2, 'active')
    ON CONFLICT (classification_code) DO UPDATE
    SET classification_name = EXCLUDED.classification_name, status_code = 'active'
    RETURNING id::text AS id
    `,
    [tag, 工作量标签名称(tag)],
  );
  return 读取返回编号(result.rows[0]);
}

function 工作量标签名称(tag: string): string {
  const 映射: Record<string, string> = {
    EPP_BASE: "EPP（仅DLP基础）",
    SENSITIVE_DATA: "敏感数据梳理",
    UNIDES: "UniDES",
    UNIAV: "UniAV",
    NXG_NO_DLP: "NXG（不含DLP）",
    NXG_WITH_DLP: "NXG（含DLP）",
  };
  return 映射[tag] || tag;
}

async function 写入审计日志(
  db: 数据库执行器,
  输入: {
    用户: 当前业务用户 | null;
    模块: string;
    动作: string;
    对象类型: string;
    对象编号: string;
    对象名称: string;
    结果: string;
    说明: string;
    变更后?: unknown;
  },
): Promise<void> {
  await db.query(
    `
    INSERT INTO audit.audit_logs (
      created_at, request_id, actor_username, actor_name, actor_role,
      module_code, action_code, target_type, target_id, target_name,
      result_code, message, after_json, extra_json
    )
    VALUES (now(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb)
    `,
    [
      输入.用户?.requestId || "stage9.13-" + crypto.randomBytes(8).toString("hex"),
      输入.用户?.username || "system",
      输入.用户?.displayName || "系统",
      输入.用户?.roleName || "system",
      输入.模块,
      输入.动作,
      输入.对象类型,
      输入.对象编号,
      输入.对象名称,
      输入.结果,
      输入.说明,
      JSON.stringify(输入.变更后 || {}),
      JSON.stringify({ source: "stage9.13" }),
    ],
  );
}

function 解析JSON数组(value: unknown, fallback: string[] = []): string[] {
  if (Array.isArray(value)) return value.map((项) => String(项)).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return parsed.map((项) => String(项)).filter(Boolean);
    } catch {
      return value
        .split(",")
        .map((项) => 项.trim())
        .filter(Boolean);
    }
  }
  return fallback;
}

function 读取记录数组(
  来源: Record<string, unknown>,
  keys: string[],
  fallback: string[] = [],
): string[] {
  for (const key of keys) {
    const value = 来源[key];
    const list = 解析JSON数组(value);
    if (list.length) return list;
  }
  return fallback;
}

function 读取对象文本(来源: Record<string, unknown>, key: string): string {
  const value = 来源[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function 读取对象布尔(来源: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = 来源[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true";
  return fallback;
}

function 读取可空数字(
  来源: Record<string, unknown>,
  keys: string[],
  fallback: number | null,
): number | null {
  for (const key of keys) {
    const value = 来源[key];
    if (value === null || value === "") return null;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return fallback;
}

function 安全比较文本(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function 创建响应哈希(响应: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(响应), "utf8").digest("hex");
}

function 去重文本(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function 构建渠道商数据范围条件(用户: 业务用户上下文, 参数: unknown[]): string {
  if (是否全量数据范围(用户)) return "true";
  if (
    用户.roleCode === "partner_admin" ||
    用户.roleCode === "staff" ||
    用户.dataScopeCode === "partner" ||
    用户.dataScopeCode === "self"
  ) {
    if (!用户.partnerIds.length) return "false";
    参数.push(用户.partnerIds);
    return `p.id = ANY($${参数.length}::uuid[])`;
  }
  if (用户.roleCode === "region_manager" || 用户.dataScopeCode === "region") {
    if (用户.regionId) {
      参数.push(用户.regionId);
      return `p.region_id = $${参数.length}::uuid`;
    }
    if (用户.regionName) {
      参数.push("%" + 用户.regionName + "%");
      return `p.extra_json->>'region' ILIKE $${参数.length}`;
    }
    return "false";
  }
  if (用户.roleCode === "admin") return "true";
  return "false";
}

function 构建账号数据范围条件(用户: 业务用户上下文, 参数: unknown[]): string {
  if (是否全量数据范围(用户)) return "true";
  if (用户.roleCode === "partner_admin" || 用户.dataScopeCode === "partner") {
    if (!用户.partnerIds.length) return "false";
    参数.push(用户.partnerIds);
    return `EXISTS (
      SELECT 1
      FROM channel.partner_members pm_scope
      WHERE pm_scope.user_id = u.id
        AND pm_scope.partner_id = ANY($${参数.length}::uuid[])
        AND pm_scope.status_code = 'active'
        AND pm_scope.archived_at IS NULL
    )`;
  }
  if (用户.roleCode === "staff" || 用户.dataScopeCode === "self") {
    参数.push(用户.userId);
    return `u.id = $${参数.length}::uuid`;
  }
  if (用户.roleCode === "region_manager" || 用户.dataScopeCode === "region") {
    if (用户.regionId) {
      参数.push(用户.regionId);
      return `u.region_id = $${参数.length}::uuid`;
    }
    if (用户.regionName) {
      参数.push("%" + 用户.regionName + "%");
      return `u.extra_json->>'region' ILIKE $${参数.length}`;
    }
    return "false";
  }
  if (用户.roleCode === "admin") return "true";
  return "false";
}

function 是否全量数据范围(用户: 业务用户上下文): boolean {
  return 用户.roleCode === "superadmin" || 用户.dataScopeCode === "all";
}

function 应使用渠道兼容过滤(用户: 业务用户上下文 | null): boolean {
  if (!用户) return true;
  return !(
    用户.roleCode === "partner_admin" ||
    用户.roleCode === "staff" ||
    用户.dataScopeCode === "partner" ||
    用户.dataScopeCode === "self"
  );
}

function 读取兼容用户过滤值(
  模块: 阶段9模块,
  查询: 阶段9查询参数,
  用户: 业务用户上下文 | null,
): string {
  if (!支持负责人兼容过滤(模块)) return "";
  if (!用户) return 查询.userId || 查询.operatorId || "";
  if (用户.roleCode === "staff" || 用户.dataScopeCode === "self") {
    return 查询.userId || 查询.operatorId || "";
  }
  return "";
}

function 支持负责人兼容过滤(模块: 阶段9模块): boolean {
  return ["registrations", "opportunities", "quotes", "orders"].includes(模块);
}

function 推断数据范围(roleCode: string): string {
  if (roleCode === "superadmin" || roleCode === "admin") return "all";
  if (roleCode === "region_manager") return "region";
  if (roleCode === "partner_admin") return "partner";
  return "self";
}

function 转角色显示名称(roleCode: string): string {
  const 映射: Record<string, string> = {
    superadmin: "超级管理员",
    admin: "管理员",
    region_manager: "区域管理员",
    partner_admin: "渠道管理员",
    staff: "渠道用户",
  };
  return 映射[roleCode] || "渠道用户";
}

function 数据范围表别名(模块: 阶段9模块): string {
  if (模块 === "registrations") return "r";
  if (模块 === "opportunities") return "o";
  if (模块 === "quotes") return "q";
  if (模块 === "orders") return "o";
  return "";
}

function 构建渠道区域关联条件(模块: 阶段9模块, 用户: 业务用户上下文, 参数: unknown[]): string {
  const alias = 模块 === "quotes" ? "q" : "o";
  if (用户.regionId) {
    参数.push(用户.regionId);
    return `EXISTS (
      SELECT 1
      FROM channel.partners p_scope
      WHERE p_scope.id = ${alias}.partner_id
        AND p_scope.region_id = $${参数.length}::uuid
    )`;
  }
  if (用户.regionName) {
    参数.push("%" + 用户.regionName + "%");
    return `EXISTS (
      SELECT 1
      FROM channel.partners p_scope
      LEFT JOIN org.regions reg_scope ON reg_scope.id = p_scope.region_id
      WHERE p_scope.id = ${alias}.partner_id
        AND (
          reg_scope.region_name ILIKE $${参数.length}
          OR p_scope.extra_json->>'region' ILIKE $${参数.length}
          OR ${alias}.extra_json->>'region' ILIKE $${参数.length}
        )
    )`;
  }
  return "false";
}

function 构建审核数据范围条件(用户: 业务用户上下文, 参数: unknown[]): string {
  if (用户.roleCode === "superadmin" || 用户.roleCode === "admin" || 用户.dataScopeCode === "all") {
    return "true";
  }

  if (用户.roleCode === "region_manager" || 用户.dataScopeCode === "region") {
    if (用户.regionId) {
      参数.push(用户.regionId);
      return `"原始数据"->>'regionId' = $${参数.length}`;
    }
    if (用户.regionName) {
      参数.push("%" + 用户.regionName + "%");
      return `("区域" ILIKE $${参数.length} OR "原始数据"->>'region' ILIKE $${参数.length})`;
    }
    return "false";
  }

  if (用户.roleCode === "partner_admin" || 用户.dataScopeCode === "partner") {
    const 条件: string[] = [];
    if (用户.partnerIds.length) {
      参数.push(用户.partnerIds);
      条件.push(`"原始数据"->>'partnerUuid' = ANY($${参数.length}::text[])`);
    }
    if (用户.partnerExternalIds.length) {
      参数.push(用户.partnerExternalIds);
      条件.push(
        `("原始数据"->>'partnerId' = ANY($${参数.length}::text[]) OR "原始数据"->>'assignedPartnerId' = ANY($${参数.length}::text[]))`,
      );
    }
    return 条件.length ? `(${条件.join(" OR ")})` : "false";
  }

  if (用户.roleCode === "staff" || 用户.dataScopeCode === "self") {
    参数.push(用户.userId);
    const 用户编号参数 = 参数.length;
    参数.push([用户.externalUserId, 用户.username].filter(Boolean));
    const 外部编号参数 = 参数.length;
    return `(
      "原始数据"->>'ownerUserUuid' = $${用户编号参数}
      OR "原始数据"->>'assignedStaffId' = ANY($${外部编号参数}::text[])
      OR "原始数据"->>'assignedStaffUserId' = ANY($${外部编号参数}::text[])
    )`;
  }

  return "false";
}

function 是否内存硬件产品(项: 阶段9记录): boolean {
  return /硬件|hardware/i.test(`${项.类型} ${项.负责人} ${项.标题}`);
}

function 报备查询SQL(where: string): string {
  return `
    SELECT
      r.id::text AS "id",
      COALESCE(r.registration_no, r.v2_source_id, r.id::text) AS "编号",
      '客户报备' AS "类型",
      COALESCE(c.customer_name, r.extra_json->>'customer') AS "标题",
      COALESCE(c.customer_name, r.extra_json->>'customer') AS "客户名称",
      COALESCE(p.partner_name, r.extra_json->>'partnerName') AS "渠道名称",
      COALESCE(u.display_name, r.extra_json->>'assignedStaffName', r.extra_json->>'createdByName') AS "负责人",
      COALESCE(reg.region_name, r.extra_json->>'region') AS "区域",
      r.status_code AS "状态",
      CASE r.status_code
        WHEN 'pending' THEN '待审核'
        WHEN 'approved' THEN '已通过'
        WHEN 'rejected' THEN '已驳回'
        WHEN 'converted' THEN '已转商机'
        WHEN 'cancelled' THEN '已取消'
        ELSE '草稿'
      END AS "状态名称",
      0::numeric AS "金额",
      r.created_at AS "创建时间",
      r.updated_at AS "更新时间",
      r.extra_json || jsonb_build_object(
        'creditCode', COALESCE(NULLIF(c.credit_code, ''), r.extra_json->>'creditCode', r.extra_json->>'统一社会信用代码', ''),
        'partnerUuid', COALESCE(r.partner_id::text, ''),
        'partnerId', COALESCE(p.v2_source_id, p.partner_code, r.partner_id::text, r.extra_json->>'partnerId', ''),
        'assignedPartnerId', COALESCE(p.v2_source_id, p.partner_code, r.partner_id::text, r.extra_json->>'assignedPartnerId', ''),
        'partnerName', COALESCE(p.partner_name, r.extra_json->>'partnerName', ''),
        'assignedPartnerName', COALESCE(p.partner_name, r.extra_json->>'assignedPartnerName', ''),
        'ownerUserUuid', COALESCE(r.owner_user_id::text, ''),
        'assignedStaffId', COALESCE(u.v2_source_id, u.username::text, r.owner_user_id::text, r.extra_json->>'assignedStaffId', ''),
        'assignedStaffUserId', COALESCE(u.v2_source_id, u.username::text, r.owner_user_id::text, r.extra_json->>'assignedStaffUserId', ''),
        'assignedStaffName', COALESCE(u.display_name, r.extra_json->>'assignedStaffName', ''),
        'regionId', COALESCE(r.region_id::text, ''),
        'region', COALESCE(reg.region_name, r.extra_json->>'region', '')
      ) AS "原始数据"
    FROM crm.registrations r
    JOIN crm.customers c ON c.id = r.customer_id
    LEFT JOIN channel.partners p ON p.id = r.partner_id
    LEFT JOIN iam.users u ON u.id = r.owner_user_id
    LEFT JOIN org.regions reg ON reg.id = r.region_id
    WHERE ${where}
  `;
}

function 商机查询SQL(where: string): string {
  return `
    SELECT
      o.id::text AS "id",
      COALESCE(o.opportunity_no, o.v2_source_id, o.id::text) AS "编号",
      '商机' AS "类型",
      COALESCE(o.extra_json->>'name', c.customer_name || '商机') AS "标题",
      COALESCE(c.customer_name, o.extra_json->>'customer') AS "客户名称",
      COALESCE(p.partner_name, o.extra_json->>'partnerName') AS "渠道名称",
      COALESCE(u.display_name, o.extra_json->>'assignedStaffName', o.extra_json->>'createdByName') AS "负责人",
      COALESCE(reg.region_name, o.extra_json->>'region') AS "区域",
      o.status_code AS "状态",
      CASE o.status_code
        WHEN 'won' THEN '已赢单'
        WHEN 'lost' THEN '已丢单'
        WHEN 'cancelled' THEN '已取消'
        ELSE COALESCE(o.raw_stage_name, o.stage_code, '推进中')
      END AS "状态名称",
      COALESCE(o.expected_amount, 0) AS "金额",
      o.created_at AS "创建时间",
      o.updated_at AS "更新时间",
      o.extra_json || jsonb_build_object(
        'partnerUuid', COALESCE(o.partner_id::text, ''),
        'partnerId', COALESCE(p.v2_source_id, p.partner_code, o.partner_id::text, o.extra_json->>'partnerId', ''),
        'assignedPartnerId', COALESCE(p.v2_source_id, p.partner_code, o.partner_id::text, o.extra_json->>'assignedPartnerId', ''),
        'partnerName', COALESCE(p.partner_name, o.extra_json->>'partnerName', ''),
        'assignedPartnerName', COALESCE(p.partner_name, o.extra_json->>'assignedPartnerName', ''),
        'ownerUserUuid', COALESCE(o.owner_user_id::text, ''),
        'assignedStaffId', COALESCE(u.v2_source_id, u.username::text, o.owner_user_id::text, o.extra_json->>'assignedStaffId', ''),
        'assignedStaffUserId', COALESCE(u.v2_source_id, u.username::text, o.owner_user_id::text, o.extra_json->>'assignedStaffUserId', ''),
        'assignedStaffName', COALESCE(u.display_name, o.extra_json->>'assignedStaffName', ''),
        'regionId', COALESCE(o.region_id::text, ''),
        'region', COALESCE(reg.region_name, o.extra_json->>'region', ''),
        'registrationUuid', COALESCE(report.id::text, ''),
        'registrationNo', COALESCE(report.registration_no, report.v2_source_id, report.id::text, ''),
        'quoteUuid', COALESCE(linked_quote.id::text, ''),
        'quoteNo', COALESCE(linked_quote.quote_no, linked_quote.v2_source_id, linked_quote.id::text, '')
      ) AS "原始数据"
    FROM crm.opportunities o
    LEFT JOIN crm.customers c ON c.id = o.customer_id
    LEFT JOIN channel.partners p ON p.id = o.partner_id
    LEFT JOIN iam.users u ON u.id = o.owner_user_id
    LEFT JOIN org.regions reg ON reg.id = o.region_id
    LEFT JOIN crm.registrations report ON report.id = o.registration_id
    LEFT JOIN LATERAL (
      SELECT q.id, q.v2_source_id, q.quote_no
      FROM crm.quotes q
      WHERE q.opportunity_id = o.id
      ORDER BY q.created_at DESC, q.id DESC
      LIMIT 1
    ) linked_quote ON true
    WHERE ${where}
  `;
}

function 报价查询SQL(where: string): string {
  return `
    SELECT
      q.id::text AS "id",
      COALESCE(q.quote_no, q.v2_source_id, q.id::text) AS "编号",
      '报价单' AS "类型",
      COALESCE(q.extra_json->>'customer', c.customer_name, q.quote_no, q.id::text) AS "标题",
      COALESCE(c.customer_name, q.extra_json->>'customer') AS "客户名称",
      COALESCE(p.partner_name, q.extra_json->>'partnerName') AS "渠道名称",
      COALESCE(u.display_name, q.extra_json->>'assignedStaffName', q.extra_json->>'createdByName') AS "负责人",
      COALESCE(reg.region_name, q.extra_json->>'region', p.extra_json->>'region', '') AS "区域",
      q.status_code AS "状态",
      CASE q.status_code
        WHEN 'draft' THEN '草稿'
        WHEN 'submitted' THEN '已提交'
        WHEN 'approved' THEN '已确认'
        WHEN 'rejected' THEN '已驳回'
        WHEN 'converted' THEN '已转订单'
        ELSE '已取消'
      END AS "状态名称",
      q.total_amount AS "金额",
      q.created_at AS "创建时间",
      q.updated_at AS "更新时间",
      q.extra_json || jsonb_build_object(
        'partnerUuid', COALESCE(q.partner_id::text, ''),
        'partnerId', COALESCE(p.v2_source_id, p.partner_code, q.partner_id::text, q.extra_json->>'partnerId', ''),
        'assignedPartnerId', COALESCE(p.v2_source_id, p.partner_code, q.partner_id::text, q.extra_json->>'assignedPartnerId', ''),
        'partnerName', COALESCE(p.partner_name, q.extra_json->>'partnerName', ''),
        'assignedPartnerName', COALESCE(p.partner_name, q.extra_json->>'assignedPartnerName', ''),
        'ownerUserUuid', COALESCE(q.owner_user_id::text, ''),
        'assignedStaffId', COALESCE(u.v2_source_id, u.username::text, q.owner_user_id::text, q.extra_json->>'assignedStaffId', ''),
        'assignedStaffUserId', COALESCE(u.v2_source_id, u.username::text, q.owner_user_id::text, q.extra_json->>'assignedStaffUserId', ''),
        'assignedStaffName', COALESCE(u.display_name, q.extra_json->>'assignedStaffName', ''),
        'regionId', COALESCE(p.region_id::text, ''),
        'region', COALESCE(reg.region_name, q.extra_json->>'region', p.extra_json->>'region', ''),
        'opportunityUuid', COALESCE(related_opportunity.id::text, ''),
        'opportunityNo', COALESCE(related_opportunity.opportunity_no, related_opportunity.v2_source_id, related_opportunity.id::text, ''),
        'registrationUuid', COALESCE(report.id::text, ''),
        'registrationNo', COALESCE(report.registration_no, report.v2_source_id, report.id::text, '')
      ) AS "原始数据"
    FROM crm.quotes q
    LEFT JOIN crm.customers c ON c.id = q.customer_id
    LEFT JOIN channel.partners p ON p.id = q.partner_id
    LEFT JOIN iam.users u ON u.id = q.owner_user_id
    LEFT JOIN org.regions reg ON reg.id = p.region_id
    LEFT JOIN crm.opportunities related_opportunity ON related_opportunity.id = q.opportunity_id
    LEFT JOIN crm.registrations report ON report.id = related_opportunity.registration_id
    WHERE ${where}
  `;
}

function 订单查询SQL(where: string): string {
  return `
    SELECT
      o.id::text AS "id",
      COALESCE(o.order_no, o.v2_source_id, o.id::text) AS "编号",
      '订单' AS "类型",
      COALESCE(c.customer_name, o.extra_json->>'customer', o.order_no, o.id::text) AS "标题",
      COALESCE(c.customer_name, o.extra_json->>'customer') AS "客户名称",
      COALESCE(legacy.display_partner_name, p.partner_name, o.extra_json->>'partnerName') AS "渠道名称",
      COALESCE(u.display_name, o.extra_json->>'assignedStaffName', o.extra_json->>'createdByName') AS "负责人",
      COALESCE(reg.region_name, o.extra_json->>'region', p.extra_json->>'region', '') AS "区域",
      legacy.display_status AS "状态",
      CASE legacy.display_status
        WHEN 'pending' THEN '待确认'
        WHEN 'pending_primary_confirm' THEN '待一级确认'
        WHEN 'primary_confirmed' THEN '一级已确认'
        WHEN 'primary_rejected' THEN '一级已驳回'
        WHEN 'pending_superadmin_confirm' THEN '待超管确认'
        WHEN 'confirmed' THEN '已确认'
        WHEN 'processing' THEN '处理中'
        WHEN 'shipped' THEN '已发货'
        WHEN 'completed' THEN '已完成'
        WHEN 'rejected' THEN '已驳回'
        WHEN 'cancelled' THEN '已取消'
        ELSE '草稿'
      END AS "状态名称",
      o.total_amount AS "金额",
      o.created_at AS "创建时间",
      o.updated_at AS "更新时间",
      o.extra_json || jsonb_build_object(
        'partnerUuid', COALESCE(o.partner_id::text, ''),
        'partnerId', COALESCE(p.v2_source_id, p.partner_code, o.partner_id::text, o.extra_json->>'partnerId', ''),
        'assignedPartnerId', COALESCE(o.extra_json->>'assignedPartnerId', p.v2_source_id, p.partner_code, o.partner_id::text, ''),
        'partnerName', COALESCE(legacy.display_partner_name, p.partner_name, o.extra_json->>'partnerName', ''),
        'assignedPartnerName', COALESCE(o.extra_json->>'assignedPartnerName', p.partner_name, ''),
        'formalOrderNo', o.order_no,
        'preRegionOrderNo', COALESCE(o.pre_region_order_no, o.extra_json->>'preRegionOrderNo', ''),
        'agreementNo', COALESCE(o.agreement_no_snapshot, o.extra_json->>'agreementNo', ''),
        'countryCallingCode', COALESCE(o.country_calling_code_snapshot, o.extra_json->>'countryCallingCode', ''),
        'contractSequence', o.contract_sequence,
        'contractYear', o.contract_year,
        'regionConfirmedByUsername', COALESCE(o.region_confirmed_username, o.extra_json->>'regionConfirmedByUsername', ''),
        'regionConfirmedEmailPrefix', COALESCE(o.region_confirmed_email_prefix, o.extra_json->>'regionConfirmedEmailPrefix', ''),
        'legacyV2Order', legacy.is_v2_order,
        'legacyV2InitialStatus', legacy.source_status,
        'legacyV2PartnerName', legacy.display_partner_name,
        'partnerLevel', COALESCE(p.partner_level_code, o.extra_json->>'partnerLevel', ''),
        'parentPartnerId', COALESCE(o.extra_json->>'parentPartnerId', parent_rel.parent_partner_external_id, ''),
        'parentPartnerUuid', COALESCE(o.extra_json->>'parentPartnerUuid', parent_rel.parent_partner_id, ''),
        'parentPartnerName', COALESCE(o.extra_json->>'parentPartnerName', parent_rel.parent_partner_name, ''),
        'ownerUserUuid', COALESCE(o.owner_user_id::text, ''),
        'assignedStaffId', COALESCE(u.v2_source_id, u.username::text, o.owner_user_id::text, o.extra_json->>'assignedStaffId', ''),
        'assignedStaffUserId', COALESCE(u.v2_source_id, u.username::text, o.owner_user_id::text, o.extra_json->>'assignedStaffUserId', ''),
        'assignedStaffName', COALESCE(u.display_name, o.extra_json->>'assignedStaffName', ''),
        'regionId', COALESCE(p.region_id::text, ''),
        'region', COALESCE(reg.region_name, o.extra_json->>'region', p.extra_json->>'region', ''),
        'quoteUuid', COALESCE(related_quote.id::text, ''),
        'quoteNo', COALESCE(related_quote.quote_no, related_quote.v2_source_id, related_quote.id::text, ''),
        'opportunityUuid', COALESCE(related_opportunity.id::text, ''),
        'opportunityNo', COALESCE(related_opportunity.opportunity_no, related_opportunity.v2_source_id, related_opportunity.id::text, ''),
        'registrationUuid', COALESCE(report.id::text, ''),
        'registrationNo', COALESCE(report.registration_no, report.v2_source_id, report.id::text, ''),
        'statusHistory', COALESCE(order_history.status_history, '[]'::jsonb)
      ) AS "原始数据"
    FROM crm.orders o
    LEFT JOIN crm.customers c ON c.id = o.customer_id
    LEFT JOIN channel.partners p ON p.id = o.partner_id
    LEFT JOIN iam.users u ON u.id = o.owner_user_id
    LEFT JOIN org.regions reg ON reg.id = p.region_id
    LEFT JOIN crm.quotes related_quote ON related_quote.id = o.quote_id
    LEFT JOIN crm.opportunities related_opportunity ON related_opportunity.id = related_quote.opportunity_id
    LEFT JOIN crm.registrations report ON report.id = related_opportunity.registration_id
    LEFT JOIN LATERAL (
      SELECT r.redacted_json
      FROM migration.v2_raw_records r
      WHERE r.entity_name = 'orders'
        AND r.source_id = o.v2_source_id
      ORDER BY r.source_updated_at DESC NULLS LAST, r.created_at DESC
      LIMIT 1
    ) v2_raw ON true
    LEFT JOIN LATERAL (
      SELECT
        o.v2_source_id IS NOT NULL AS is_v2_order,
        COALESCE(
          NULLIF(migration.v2_data(v2_raw.redacted_json)->>'status', ''),
          NULLIF(o.extra_json->>'status', '')
        ) AS source_status,
        COALESCE(
          NULLIF(migration.v2_data(v2_raw.redacted_json)->>'assignedPartnerName', ''),
          NULLIF(o.extra_json->>'assignedPartnerName', '')
        ) AS display_partner_name,
        CASE
          WHEN o.v2_source_id IS NOT NULL
            AND COALESCE(
              NULLIF(migration.v2_data(v2_raw.redacted_json)->>'status', ''),
              NULLIF(o.extra_json->>'status', '')
            ) IN ('draft', 'pending', 'confirmed', 'rejected', 'cancelled', 'processing', 'shipped', 'completed')
            AND NOT EXISTS (
              SELECT 1
              FROM crm.order_status_history h
              WHERE h.order_id = o.id
                AND COALESCE(h.reason, '') <> '升级补齐订单审批状态机初始记录'
            )
          THEN COALESCE(
            NULLIF(migration.v2_data(v2_raw.redacted_json)->>'status', ''),
            NULLIF(o.extra_json->>'status', ''),
            o.status_code
          )
          ELSE o.status_code
        END AS display_status
    ) legacy ON true
    LEFT JOIN LATERAL (
      SELECT
        parent.id::text AS parent_partner_id,
        COALESCE(parent.v2_source_id, parent.partner_code, parent.id::text) AS parent_partner_external_id,
        parent.partner_name AS parent_partner_name
      FROM channel.partner_relations rel
      JOIN channel.partners parent ON parent.id = rel.parent_partner_id
      WHERE rel.child_partner_id = o.partner_id
        AND rel.relation_code = 'primary_secondary'
        AND rel.ended_at IS NULL
        AND parent.status_code = 'active'
      ORDER BY rel.started_at DESC
      LIMIT 1
    ) parent_rel ON true
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(
        jsonb_build_object(
          'from', CASE
            WHEN legacy.is_v2_order
              AND h.from_status_code IN ('pending_primary_confirm', 'primary_confirmed', 'pending_superadmin_confirm')
              AND legacy.source_status IN ('draft', 'pending', 'confirmed', 'rejected', 'cancelled', 'processing', 'shipped', 'completed')
            THEN legacy.source_status
            ELSE h.from_status_code
          END,
          'to', h.to_status_code,
          'operatorName', COALESCE(actor.display_name, ''),
          'timestamp', h.changed_at,
          'remark', COALESCE(h.reason, '')
        )
        ORDER BY h.changed_at
      ) AS status_history
      FROM crm.order_status_history h
      LEFT JOIN iam.users actor ON actor.id = h.actor_user_id
      WHERE h.order_id = o.id
        AND (NOT legacy.is_v2_order OR COALESCE(h.reason, '') <> '升级补齐订单审批状态机初始记录')
    ) order_history ON true
    WHERE ${where}
  `;
}

function 渠道查询SQL(where: string): string {
  return `
    SELECT
      p.id::text AS "id",
      COALESCE(p.partner_code, p.v2_source_id, p.id::text) AS "编号",
      '渠道商' AS "类型",
      p.partner_name AS "标题",
      '' AS "客户名称",
      p.partner_name AS "渠道名称",
      COALESCE(p.contact_name, '') AS "负责人",
      COALESCE(r.region_name, p.extra_json->>'region') AS "区域",
      p.status_code AS "状态",
      CASE p.status_code WHEN 'active' THEN '启用' WHEN 'disabled' THEN '停用' ELSE '归档' END AS "状态名称",
      0::numeric AS "金额",
      p.created_at AS "创建时间",
      p.updated_at AS "更新时间",
      COALESCE(p.extra_json, '{}'::jsonb) || jsonb_build_object(
        'id', COALESCE(p.partner_code, p.v2_source_id, p.id::text),
        'uuid', p.id::text,
        'name', p.partner_name,
        'partnerName', p.partner_name,
        'level', COALESCE(NULLIF(p.extra_json->>'level', ''), p.partner_level_code),
        'partnerLevel', COALESCE(NULLIF(p.extra_json->>'partnerLevel', ''), p.partner_level_code),
        'region', COALESCE(r.region_name, p.extra_json->>'region', ''),
        'city', COALESCE(NULLIF(p.city_name, ''), p.extra_json->>'city', ''),
        'contact', COALESCE(NULLIF(p.contact_name, ''), p.extra_json->>'contact', ''),
        'phone', COALESCE(NULLIF(p.contact_phone, ''), p.extra_json->>'phone', ''),
        'email', COALESCE(p.contact_email::text, p.extra_json->>'email', ''),
        'agreementNo', COALESCE(p.agreement_no, p.extra_json->>'agreementNo', ''),
        'countryCallingCode', COALESCE(p.country_calling_code, p.extra_json->>'countryCallingCode', '86'),
        'status', CASE p.status_code WHEN 'disabled' THEN 'inactive' ELSE p.status_code END,
        'staff', COALESCE(
          成员.staff,
          CASE
            WHEN jsonb_typeof(p.extra_json->'staff') = 'array' THEN p.extra_json->'staff'
            ELSE '[]'::jsonb
          END
        )
      ) AS "原始数据"
    FROM channel.partners p
    LEFT JOIN org.regions r ON r.id = p.region_id
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', COALESCE(u.v2_source_id, u.extra_json->>'id', u.username::text, u.id::text),
          'partnerMemberId', pm.id::text,
          'rowVersion', pm.row_version,
          'uuid', u.id::text,
          'userId', COALESCE(u.v2_source_id, u.extra_json->>'userId', u.id::text),
          'username', u.username::text,
          'name', COALESCE(NULLIF(u.display_name, ''), u.extra_json->>'name', u.username::text),
          'role', COALESCE(member_role.role_name,
            CASE WHEN COALESCE(u.extra_json->>'staffRole',u.extra_json->>'title','') LIKE '%技术%'
              THEN '技术' ELSE '销售' END),
          'staffRole', COALESCE(member_role.role_name,
            CASE WHEN COALESCE(u.extra_json->>'staffRole',u.extra_json->>'title','') LIKE '%技术%'
              THEN '技术' ELSE '销售' END),
          'businessRoleType', COALESCE(member_role.business_role_type,
            CASE WHEN COALESCE(u.extra_json->>'staffRole',u.extra_json->>'title','') LIKE '%技术%'
              THEN 'technical' ELSE 'sales' END),
          'businessRoleCode', COALESCE(member_role.role_code,
            CASE WHEN COALESCE(u.extra_json->>'staffRole',u.extra_json->>'title','') LIKE '%技术%'
              THEN 'channel_technical' ELSE 'channel_sales' END),
          'accountRole', pm.member_role_code,
          'phone', COALESCE(NULLIF(u.phone, ''), u.extra_json->>'phone', u.extra_json->>'mobile', ''),
          'email', COALESCE(u.email::text, u.extra_json->>'email', ''),
          'status', CASE
            WHEN u.extra_json->>'status' = 'pending' THEN 'pending'
            WHEN pm.status_code = 'active' AND u.status_code = 'active' THEN 'active'
            ELSE 'inactive'
          END,
          'createdAt', COALESCE(u.extra_json->>'createdAt', u.created_at::text),
          'createdByRole', COALESCE(u.extra_json->>'createdByRole', ''),
          'approvedBy', COALESCE(u.extra_json->>'approvedBy', ''),
          'certifications', COALESCE(member_cert.certifications,'[]'::jsonb)
        )
        ORDER BY pm.member_role_code, u.display_name, u.username::text
      ) AS staff
      FROM channel.partner_members pm
      JOIN iam.users u ON u.id = pm.user_id
      LEFT JOIN LATERAL (
        SELECT b.role_code,b.role_name,
          CASE WHEN b.role_code='channel_technical' OR b.category IN ('pre_sales','post_sales','tech_engineer')
            THEN 'technical' ELSE 'sales' END AS business_role_type
        FROM org.member_business_roles m
        JOIN org.business_roles b ON b.id=m.business_role_id
        WHERE m.partner_member_id=pm.id AND m.expired_at IS NULL AND b.domain_code='channel'
        ORDER BY m.is_primary_display DESC,m.effective_at DESC
        LIMIT 1
      ) member_role ON true
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object(
          'id',c.id::text,'certificationTemplateId',c.certification_template_id::text,
          'templateName',t.template_name,'category',t.category,'certificateNo',COALESCE(c.certificate_no,''),
          'issuedOn',c.issued_on,'expiresOn',c.expires_on,'statusCode',c.status_code,'rowVersion',c.row_version
        ) ORDER BY CASE c.status_code WHEN 'active' THEN 0 ELSE 1 END,c.expires_on NULLS LAST) AS certifications
        FROM org.member_certifications c
        JOIN org.certification_templates t ON t.id=c.certification_template_id
        WHERE c.user_id=u.id
      ) member_cert ON true
      WHERE pm.partner_id = p.id AND pm.archived_at IS NULL
    ) 成员 ON true
    WHERE ${where}
  `;
}

function 产品查询SQL(where: string): string {
  return `
    SELECT * FROM (
      SELECT
        f.id::text AS "id",
        COALESCE(f.feature_code, f.v2_source_id, f.id::text) AS "编号",
        '功能模块' AS "类型",
        f.feature_name AS "标题",
        '' AS "客户名称",
        '' AS "渠道名称",
        COALESCE(m.module_name, '') AS "负责人",
        '' AS "区域",
        f.status_code AS "状态",
        CASE WHEN f.published THEN '已发布' ELSE '未发布' END AS "状态名称",
        f.list_price AS "金额",
        now() AS "创建时间",
        now() AS "更新时间",
        f.extra_json AS "原始数据"
      FROM catalog.product_features f
      LEFT JOIN catalog.product_modules m ON m.id = f.module_id
      UNION ALL
      SELECT
        h.id::text, COALESCE(h.hardware_code, h.v2_source_id, h.id::text), '硬件产品',
        h.hardware_name, '', '', COALESCE(h.unit_name, ''), '', h.status_code,
        CASE WHEN h.published THEN '已发布' ELSE '未发布' END, h.list_price, now(), now(), h.extra_json
      FROM catalog.hardware_products h
      UNION ALL
      SELECT
        p.id::text, COALESCE(p.package_code, p.v2_source_id, p.id::text), '产品套餐',
        p.package_name, '', '', '', '', p.status_code,
        CASE WHEN p.published THEN '已发布' ELSE '未发布' END, p.list_price, now(), now(), p.extra_json
      FROM catalog.product_packages p
    ) x
    WHERE ${where}
  `;
}

function 产品类型名称(type: "feature" | "hardware" | "package"): string {
  if (type === "feature") return "功能模块";
  if (type === "hardware") return "硬件产品";
  return "产品套餐";
}

function 账号查询SQL(where: string): string {
  return `
    SELECT
      u.id::text AS "id",
      COALESCE(u.v2_source_id, u.id::text) AS "编号",
      '账号' AS "类型",
      u.display_name AS "标题",
      '' AS "客户名称",
      '' AS "渠道名称",
      u.username AS "负责人",
      COALESCE(r.region_name, u.extra_json->>'region') AS "区域",
      u.status_code AS "状态",
      CASE u.status_code WHEN 'active' THEN '启用' WHEN 'locked' THEN '锁定' ELSE '停用' END AS "状态名称",
      0::numeric AS "金额",
      u.created_at AS "创建时间",
      u.updated_at AS "更新时间",
      jsonb_set(
        COALESCE(u.extra_json, '{}'::jsonb),
        '{phone}',
        to_jsonb(COALESCE(u.phone, ''))
      ) || jsonb_build_object('email', COALESCE(u.email::text, '')) AS "原始数据"
    FROM iam.users u
    LEFT JOIN org.regions r ON r.id = u.region_id
    WHERE ${where}
  `;
}

function 审计查询SQL(where: string): string {
  return `
    SELECT
      a.id::text AS "id",
      COALESCE(a.v2_source_id, a.request_id, a.id::text) AS "编号",
      '审计日志' AS "类型",
      COALESCE(a.message, a.module_code || '/' || a.action_code) AS "标题",
      '' AS "客户名称",
      '' AS "渠道名称",
      COALESCE(a.actor_name, a.actor_username, '') AS "负责人",
      '' AS "区域",
      a.result_code AS "状态",
      a.result_code AS "状态名称",
      0::numeric AS "金额",
      a.created_at AS "创建时间",
      a.created_at AS "更新时间",
      COALESCE(a.extra_json, '{}'::jsonb) AS "原始数据"
    FROM audit.audit_logs a
    WHERE ${where}
  `;
}

function 开放接口查询SQL(where: string): string {
  return `
    SELECT
      c.id::text AS "id",
      COALESCE(c.client_code, c.v2_source_id, c.id::text) AS "编号",
      '开放接口' AS "类型",
      c.client_name AS "标题",
      '' AS "客户名称",
      '' AS "渠道名称",
      '' AS "负责人",
      '' AS "区域",
      c.status_code AS "状态",
      CASE c.status_code WHEN 'active' THEN '启用' ELSE '停用' END AS "状态名称",
      0::numeric AS "金额",
      c.created_at AS "创建时间",
      c.updated_at AS "更新时间",
      c.extra_json AS "原始数据"
    FROM integration.open_api_clients c
    WHERE ${where}
  `;
}

function 工作量查询SQL(where: string): string {
  return `
    SELECT * FROM (
      SELECT
        r.id::text AS "id",
        COALESCE(r.v2_source_id, r.id::text) AS "编号",
        '实施工作量' AS "类型",
        COALESCE(c.classification_name, r.v2_source_id) AS "标题",
        '' AS "客户名称",
        '' AS "渠道名称",
        COALESCE(c.classification_name, '') AS "负责人",
        '' AS "区域",
        'active' AS "状态",
        '启用' AS "状态名称",
        r.workload_days AS "金额",
        r.effective_from AS "创建时间",
        COALESCE(r.effective_to, r.effective_from) AS "更新时间",
        jsonb_build_object(
          'v2SourceId', r.v2_source_id,
          'classificationName', c.classification_name,
          'minQuantity', r.min_quantity,
          'maxQuantity', r.max_quantity,
          'workloadDays', r.workload_days
        ) AS "原始数据"
      FROM catalog.workload_rules r
      LEFT JOIN catalog.workload_classifications c ON c.id = r.classification_id
      UNION ALL
      SELECT
        d.id::text, COALESCE(d.v2_source_id, d.id::text), '交付工作量', d.rule_name,
        '', '', '', '', d.status_code,
        CASE d.status_code WHEN 'active' THEN '启用' ELSE '停用' END,
        d.workload_days, now(), now(), d.extra_json
      FROM catalog.delivery_workload_rules d
    ) x
    WHERE ${where}
  `;
}

function 审核查询SQL(where: string): string {
  return `
    SELECT * FROM (
      SELECT
        COALESCE(a.target_id::text, a.id::text) AS "id",
        COALESCE(r.registration_no, o.order_no, a.v2_source_id, a.id::text) AS "编号",
        CASE
          WHEN a.target_type = 'registration' THEN '客户报备'
          WHEN a.target_type = 'order' THEN '订单审批'
          ELSE '审核任务'
        END AS "类型",
        COALESCE(c.customer_name, oc.customer_name, a.extra_json->>'targetName', a.target_type) AS "标题",
        COALESCE(c.customer_name, oc.customer_name, a.extra_json->>'customerName', '') AS "客户名称",
        COALESCE(p.partner_name, op.partner_name, a.extra_json->>'targetPartnerName') AS "渠道名称",
        COALESCE(u.display_name, a.extra_json->>'createdBy') AS "负责人",
        COALESCE(reg.region_name, oreg.region_name, a.extra_json->>'region', '') AS "区域",
        a.status_code AS "状态",
        CASE a.status_code WHEN 'approved' THEN '已通过' WHEN 'rejected' THEN '已驳回' ELSE '待审核' END AS "状态名称",
        COALESCE(o.total_amount, 0::numeric) AS "金额",
        a.created_at AS "创建时间",
        a.updated_at AS "更新时间",
        a.extra_json || jsonb_build_object(
          'approvalId', a.id::text,
          'targetType', a.target_type,
          'targetId', COALESCE(a.target_id::text, ''),
          'step', COALESCE(a.extra_json->>'step', ''),
          'stepName', COALESCE(a.extra_json->>'stepName', ''),
          'industry', COALESCE(r.extra_json->>'industry', a.extra_json->>'industry', ''),
          'contact', COALESCE(r.extra_json->>'contact', a.extra_json->>'contact', ''),
          'phone', COALESCE(r.extra_json->>'phone', a.extra_json->>'phone', ''),
          'orderStatus', COALESCE(o.status_code, a.extra_json->>'orderStatus', ''),
          'amount', COALESCE(o.total_amount, 0::numeric),
          'total', COALESCE(o.total_amount, 0::numeric),
          'partnerUuid', COALESCE(r.partner_id::text, o.partner_id::text, a.applicant_partner_id::text, ''),
          'partnerId', COALESCE(p.v2_source_id, p.partner_code, op.v2_source_id, op.partner_code, r.partner_id::text, o.partner_id::text, a.applicant_partner_id::text, ''),
          'assignedPartnerId', COALESCE(p.v2_source_id, p.partner_code, op.v2_source_id, op.partner_code, r.partner_id::text, o.partner_id::text, a.applicant_partner_id::text, ''),
          'ownerUserUuid', COALESCE(r.owner_user_id::text, o.owner_user_id::text, a.applicant_user_id::text, ''),
          'assignedStaffId', COALESCE(u.v2_source_id, u.username::text, r.owner_user_id::text, o.owner_user_id::text, a.applicant_user_id::text, ''),
          'assignedStaffUserId', COALESCE(u.v2_source_id, u.username::text, r.owner_user_id::text, o.owner_user_id::text, a.applicant_user_id::text, ''),
          'regionId', COALESCE(r.region_id::text, op.region_id::text, p.region_id::text, a.extra_json->>'regionId', ''),
          'region', COALESCE(reg.region_name, oreg.region_name, a.extra_json->>'region', '')
        ) AS "原始数据"
      FROM ops.approvals a
      LEFT JOIN crm.registrations r ON a.target_type = 'registration' AND r.id = a.target_id
      LEFT JOIN crm.customers c ON c.id = r.customer_id
      LEFT JOIN crm.orders o ON a.target_type = 'order' AND o.id = a.target_id
      LEFT JOIN crm.customers oc ON oc.id = o.customer_id
      LEFT JOIN iam.users u ON u.id = a.applicant_user_id
      LEFT JOIN channel.partners p ON p.id = COALESCE(r.partner_id, a.applicant_partner_id)
      LEFT JOIN channel.partners op ON op.id = o.partner_id
      LEFT JOIN org.regions reg ON reg.id = r.region_id
      LEFT JOIN org.regions oreg ON oreg.id = op.region_id
      UNION ALL
      SELECT
        r.id::text AS "id",
        COALESCE(r.registration_no, r.v2_source_id, r.id::text) AS "编号",
        '客户报备' AS "类型",
        COALESCE(c.customer_name, r.extra_json->>'customer') AS "标题",
        COALESCE(c.customer_name, r.extra_json->>'customer') AS "客户名称",
        COALESCE(p.partner_name, r.extra_json->>'partnerName') AS "渠道名称",
        COALESCE(u.display_name, r.extra_json->>'assignedStaffName', r.extra_json->>'createdByName') AS "负责人",
        COALESCE(reg.region_name, r.extra_json->>'region') AS "区域",
        r.status_code AS "状态",
        CASE r.status_code
          WHEN 'pending' THEN '待审核'
          WHEN 'approved' THEN '已通过'
          WHEN 'rejected' THEN '已驳回'
          WHEN 'converted' THEN '已转商机'
          ELSE '待审核'
        END AS "状态名称",
        0::numeric AS "金额",
        r.created_at AS "创建时间",
        r.updated_at AS "更新时间",
        r.extra_json || jsonb_build_object(
          'targetType', 'registration',
          'targetId', r.id::text,
          'industry', COALESCE(r.extra_json->>'industry', ''),
          'contact', COALESCE(r.extra_json->>'contact', ''),
          'phone', COALESCE(r.extra_json->>'phone', ''),
          'partnerUuid', COALESCE(r.partner_id::text, ''),
          'partnerId', COALESCE(p.v2_source_id, p.partner_code, r.partner_id::text, r.extra_json->>'partnerId', ''),
          'assignedPartnerId', COALESCE(p.v2_source_id, p.partner_code, r.partner_id::text, r.extra_json->>'assignedPartnerId', ''),
          'ownerUserUuid', COALESCE(r.owner_user_id::text, ''),
          'assignedStaffId', COALESCE(u.v2_source_id, u.username::text, r.owner_user_id::text, r.extra_json->>'assignedStaffId', ''),
          'assignedStaffUserId', COALESCE(u.v2_source_id, u.username::text, r.owner_user_id::text, r.extra_json->>'assignedStaffUserId', ''),
          'regionId', COALESCE(r.region_id::text, ''),
          'region', COALESCE(reg.region_name, r.extra_json->>'region', '')
        ) AS "原始数据"
      FROM crm.registrations r
      JOIN crm.customers c ON c.id = r.customer_id
      LEFT JOIN channel.partners p ON p.id = r.partner_id
      LEFT JOIN iam.users u ON u.id = r.owner_user_id
      LEFT JOIN org.regions reg ON reg.id = r.region_id
      WHERE r.status_code = 'pending'
        AND NOT EXISTS (
          SELECT 1 FROM ops.approvals a
          WHERE a.target_type = 'registration' AND a.target_id = r.id
        )
    ) x
    WHERE ${where}
  `;
}

function 通知查询SQL(where: string): string {
  return `
    SELECT
      n.id::text AS "id",
      COALESCE(n.v2_source_id, n.id::text) AS "编号",
      '通知' AS "类型",
      n.title AS "标题",
      '' AS "客户名称",
      '' AS "渠道名称",
      COALESCE(u.display_name, '') AS "负责人",
      '' AS "区域",
      n.status_code AS "状态",
      CASE n.status_code WHEN 'unread' THEN '未读' WHEN 'read' THEN '已读' ELSE '归档' END AS "状态名称",
      0::numeric AS "金额",
      n.created_at AS "创建时间",
      COALESCE(n.read_at, n.created_at) AS "更新时间",
      n.extra_json AS "原始数据"
    FROM ops.notifications n
    LEFT JOIN iam.users u ON u.id = n.recipient_user_id
    WHERE ${where}
  `;
}

function 导入导出查询SQL(where: string): string {
  return `
    SELECT
      t.id::text AS "id",
      t.id::text AS "编号",
      '导入导出' AS "类型",
      t.business_type_code || '/' || t.task_type_code AS "标题",
      '' AS "客户名称",
      '' AS "渠道名称",
      COALESCE(u.display_name, '') AS "负责人",
      '' AS "区域",
      t.status_code AS "状态",
      CASE t.status_code
        WHEN 'queued' THEN '排队中'
        WHEN 'running' THEN '执行中'
        WHEN 'succeeded' THEN '已成功'
        WHEN 'failed' THEN '已失败'
        ELSE '已取消'
      END AS "状态名称",
      t.progress_percent AS "金额",
      t.created_at AS "创建时间",
      COALESCE(t.finished_at, t.started_at, t.created_at) AS "更新时间",
      t.extra_json AS "原始数据"
    FROM ops.import_export_tasks t
    LEFT JOIN iam.users u ON u.id = t.requested_by_user_id
    WHERE ${where}
  `;
}

async function 写入报备审批待办(
  client: PoolClient,
  参数: {
    报备编号: string;
    状态: string;
    申请人编号: string | null;
    渠道编号: string | null;
    客户名称: string;
    输入: Record<string, unknown>;
    用户: 当前业务用户 | null;
  },
): Promise<void> {
  const 快照 = await client.query<{
    registration_no: string | null;
    partner_name: string | null;
    region_name: string | null;
  }>(
    `
    SELECT r.registration_no, p.partner_name, reg.region_name
    FROM crm.registrations r
    LEFT JOIN channel.partners p ON p.id = r.partner_id
    LEFT JOIN org.regions reg ON reg.id = r.region_id
    WHERE r.id::text = $1
    LIMIT 1
    `,
    [参数.报备编号],
  );
  const row = 快照.rows[0];
  const result = await client.query<{ id: string }>(
    `
    INSERT INTO ops.approvals (
      v2_source_id, approval_type_code, target_type, target_id, applicant_user_id,
      applicant_partner_id, status_code, created_at, updated_at, extra_json
    )
    VALUES ($1, 'registration', 'registration', $2::uuid, $3::uuid, $4::uuid, $5, now(), now(), $6::jsonb)
    ON CONFLICT (v2_source_id) DO UPDATE
    SET status_code = EXCLUDED.status_code,
        updated_at = now(),
        extra_json = ops.approvals.extra_json || EXCLUDED.extra_json
    RETURNING id::text AS id
    `,
    [
      `registration:${参数.报备编号}`,
      参数.报备编号,
      参数.申请人编号,
      参数.渠道编号,
      参数.状态,
      JSON.stringify({
        status: 参数.状态,
        targetName: 参数.客户名称,
        customerName: 参数.客户名称,
        targetNo: row?.registration_no || "",
        targetPartnerName:
          row?.partner_name || 读取文本(参数.输入, ["partnerName", "渠道名称"], ""),
        region: row?.region_name || 读取文本(参数.输入, ["region", "区域", "city"], ""),
        industry: 读取文本(参数.输入, ["industry", "行业"], ""),
        contact: 读取文本(参数.输入, ["contact", "联系人"], ""),
        phone: 读取文本(参数.输入, ["phone", "联系电话"], ""),
        createdBy: 参数.用户?.displayName || "阶段9测试账号",
        approvedBy:
          参数.状态 === "approved"
            ? 读取文本(参数.输入, ["approvedBy"], 参数.用户?.displayName || "阶段9测试账号")
            : "",
        approvedAt:
          参数.状态 === "approved"
            ? 读取文本(参数.输入, ["approvedAt"], new Date().toISOString())
            : "",
      }),
    ],
  );
  const approvalId = 读取返回编号(result.rows[0]);
  await client.query(
    `
    INSERT INTO ops.approval_events (approval_id, event_code, to_status_code, reason, extra_json)
    VALUES ($1::uuid, $2, $3, $4, $5::jsonb)
    `,
    [
      approvalId,
      参数.状态 === "approved" ? "approve" : "submit",
      参数.状态,
      参数.状态 === "approved" ? "管理员提交报备自动通过" : "客户报备提交审核",
      JSON.stringify({ actorName: 参数.用户?.displayName || "阶段9测试账号" }),
    ],
  );
  if (参数.状态 === "pending") {
    await 写入报备发件箱事件(client, 参数.报备编号, "crm.registration.approval.pending", {
      fromStatus: "pending",
      toStatus: "pending",
      ownerUserId: 参数.申请人编号 || "",
      partnerId: 参数.渠道编号 || "",
    });
  }
}

async function 同步报备审批状态(
  client: PoolClient,
  参数: {
    报备编号: string;
    状态: string;
    原因: string;
    用户: 当前业务用户 | null;
  },
): Promise<void> {
  const 当前 = await client.query<{ id: string; status_code: string }>(
    `
    SELECT id::text AS id, status_code
    FROM ops.approvals
    WHERE target_type = 'registration' AND target_id::text = $1
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [参数.报备编号],
  );
  const approval = 当前.rows[0];
  if (!approval) return;
  await client.query(
    `
    UPDATE ops.approvals
    SET status_code = $2, updated_at = now(), extra_json = extra_json || $3::jsonb
    WHERE id::text = $1
    `,
    [
      approval.id,
      参数.状态,
      JSON.stringify({
        status: 参数.状态,
        reviewRemark: 参数.原因,
        updatedByName: 参数.用户?.displayName || "阶段9测试账号",
      }),
    ],
  );
  await client.query(
    `
    INSERT INTO ops.approval_events (
      approval_id, event_code, from_status_code, to_status_code, reason, extra_json
    )
    VALUES ($1::uuid, $2, $3, $4, $5, $6::jsonb)
    `,
    [
      approval.id,
      参数.状态 === "approved" ? "approve" : 参数.状态 === "rejected" ? "reject" : "update",
      approval.status_code,
      参数.状态,
      参数.原因,
      JSON.stringify({ actorName: 参数.用户?.displayName || "阶段9测试账号" }),
    ],
  );
}

type 订单审批步骤 = "primary_confirm" | "region_confirm" | "superadmin_confirm";

async function 解析订单一级渠道(
  client: PoolClient,
  参数: {
    子渠道编号: string | null;
    子渠道层级: string;
    默认一级渠道编号: string | null;
    默认一级渠道外部编号: string | null;
    默认一级渠道名称: string | null;
    输入: Record<string, unknown>;
  },
): Promise<{ id: string; externalId: string; name: string } | null> {
  if (参数.子渠道层级 !== "secondary") return null;
  if (!参数.子渠道编号) {
    throw new 应用错误("V3_ORDER_SECONDARY_PARTNER_REQUIRED", "二级渠道订单缺少渠道商信息。", 400);
  }
  const 指定一级 = 读取文本(
    参数.输入,
    ["parentPartnerId", "primaryPartnerId", "assignedParentPartnerId", "assignedPartnerId"],
    "",
  );
  if (指定一级) {
    const 指定一级编号 = await 查询渠道编号(client, 指定一级);
    if (!指定一级编号) {
      throw new 应用错误("V3_ORDER_PRIMARY_PARTNER_NOT_FOUND", "选择的一级分销商不存在。", 400);
    }
    const 指定关系 = await 查询一级渠道关系(client, 参数.子渠道编号, 指定一级编号);
    if (!指定关系) {
      throw new 应用错误(
        "V3_ORDER_PRIMARY_PARTNER_SCOPE_FORBIDDEN",
        "选择的一级分销商未绑定当前二级分销商。",
        400,
      );
    }
    return 指定关系;
  }
  if (参数.默认一级渠道编号 && 参数.默认一级渠道外部编号 && 参数.默认一级渠道名称) {
    return {
      id: 参数.默认一级渠道编号,
      externalId: 参数.默认一级渠道外部编号,
      name: 参数.默认一级渠道名称,
    };
  }
  const 默认关系 = await 查询一级渠道关系(client, 参数.子渠道编号);
  if (!默认关系) {
    throw new 应用错误(
      "V3_ORDER_PRIMARY_PARTNER_BINDING_REQUIRED",
      "二级分销商未绑定一级分销商，不能转订单。",
      400,
    );
  }
  return 默认关系;
}

async function 查询一级渠道关系(
  client: PoolClient,
  子渠道编号: string,
  指定一级编号?: string,
): Promise<{ id: string; externalId: string; name: string } | null> {
  const 参数: string[] = [子渠道编号];
  const 指定条件 = 指定一级编号 ? "AND parent.id::text = $2" : "";
  if (指定一级编号) 参数.push(指定一级编号);
  const result = await client.query<{ id: string; external_id: string; name: string }>(
    `
    SELECT
      parent.id::text AS id,
      COALESCE(parent.v2_source_id, parent.partner_code, parent.id::text) AS external_id,
      parent.partner_name AS name
    FROM channel.partner_relations rel
    JOIN channel.partners parent ON parent.id = rel.parent_partner_id
    WHERE rel.child_partner_id = $1::uuid
      AND rel.relation_code = 'primary_secondary'
      AND rel.ended_at IS NULL
      AND parent.status_code = 'active'
      ${指定条件}
    ORDER BY rel.started_at DESC
    LIMIT 1
    `,
    参数,
  );
  const row = result.rows[0];
  return row ? { id: row.id, externalId: row.external_id, name: row.name } : null;
}

async function 写入订单审批待办(
  client: PoolClient,
  参数: { 订单编号: string; 步骤: 订单审批步骤; 原因: string; 用户: 当前业务用户 | null },
): Promise<void> {
  const 快照 = await client.query<{
    id: string;
    order_no: string | null;
    customer_name: string | null;
    partner_name: string | null;
    parent_partner_name: string | null;
    region_name: string | null;
    status_code: string;
    total_amount: string | number;
    owner_user_id: string | null;
    partner_id: string | null;
  }>(
    `
    SELECT
      o.id::text AS id,
      o.order_no,
      c.customer_name,
      p.partner_name,
      COALESCE(o.extra_json->>'parentPartnerName', o.extra_json->>'assignedPartnerName', '') AS parent_partner_name,
      COALESCE(reg.region_name, o.extra_json->>'region', '') AS region_name,
      o.status_code,
      o.total_amount,
      o.owner_user_id::text AS owner_user_id,
      o.partner_id::text AS partner_id
    FROM crm.orders o
    LEFT JOIN crm.customers c ON c.id = o.customer_id
    LEFT JOIN channel.partners p ON p.id = o.partner_id
    LEFT JOIN org.regions reg ON reg.id = p.region_id
    WHERE o.id::text = $1
    LIMIT 1
    `,
    [参数.订单编号],
  );
  const row = 快照.rows[0];
  if (!row) return;
  const result = await client.query<{ id: string }>(
    `
    INSERT INTO ops.approvals (
      v2_source_id, approval_type_code, target_type, target_id, applicant_user_id,
      applicant_partner_id, status_code, created_at, updated_at, extra_json
    )
    VALUES ($1, 'order', 'order', $2::uuid, $3::uuid, $4::uuid, 'pending', now(), now(), $5::jsonb)
    ON CONFLICT (v2_source_id) DO UPDATE
    SET status_code = 'pending',
        updated_at = now(),
        extra_json = ops.approvals.extra_json || EXCLUDED.extra_json
    RETURNING id::text AS id
    `,
    [
      `order:${参数.步骤}:${row.id}`,
      row.id,
      row.owner_user_id,
      row.partner_id,
      JSON.stringify({
        status: "pending",
        type: "order",
        step: 参数.步骤,
        stepName: 订单审批步骤名称(参数.步骤),
        targetName: row.customer_name || row.order_no || row.id,
        customerName: row.customer_name || "",
        targetNo: row.order_no || "",
        targetPartnerName: row.partner_name || "",
        parentPartnerName: row.parent_partner_name || "",
        region: row.region_name || "",
        amount: Number(row.total_amount) || 0,
        total: Number(row.total_amount) || 0,
        orderStatus: row.status_code,
        createdBy: 参数.用户?.displayName || "阶段9测试账号",
        reason: 参数.原因,
      }),
    ],
  );
  const approvalId = 读取返回编号(result.rows[0]);
  await client.query(
    `
    INSERT INTO ops.approval_events (approval_id, event_code, to_status_code, reason, extra_json)
    VALUES ($1::uuid, 'submit', 'pending', $2, $3::jsonb)
    `,
    [
      approvalId,
      参数.原因,
      JSON.stringify({
        actorName: 参数.用户?.displayName || "阶段9测试账号",
        step: 参数.步骤,
      }),
    ],
  );
}

async function 同步订单审批状态(
  client: PoolClient,
  参数: {
    订单编号: string;
    步骤: 订单审批步骤;
    状态: "approved" | "rejected" | "cancelled";
    原因: string;
    用户: 当前业务用户 | null;
  },
): Promise<void> {
  const 当前 = await client.query<{ id: string; status_code: string }>(
    `
    SELECT id::text AS id, status_code
    FROM ops.approvals
    WHERE target_type = 'order'
      AND target_id::text = $1
      AND extra_json->>'step' = $2
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [参数.订单编号, 参数.步骤],
  );
  const approval = 当前.rows[0];
  if (!approval) return;
  await client.query(
    `
    UPDATE ops.approvals
    SET status_code = $2, updated_at = now(), extra_json = extra_json || $3::jsonb
    WHERE id::text = $1
    `,
    [
      approval.id,
      参数.状态,
      JSON.stringify({
        status: 参数.状态,
        reviewRemark: 参数.原因,
        updatedByName: 参数.用户?.displayName || "阶段9测试账号",
      }),
    ],
  );
  await client.query(
    `
    INSERT INTO ops.approval_events (
      approval_id, event_code, from_status_code, to_status_code, reason, extra_json
    )
    VALUES ($1::uuid, $2, $3, $4, $5, $6::jsonb)
    `,
    [
      approval.id,
      参数.状态 === "approved" ? "approve" : 参数.状态 === "rejected" ? "reject" : "cancel",
      approval.status_code,
      参数.状态,
      参数.原因,
      JSON.stringify({
        actorName: 参数.用户?.displayName || "阶段9测试账号",
        step: 参数.步骤,
      }),
    ],
  );
}

async function 关闭V2历史订单审批待办(
  client: PoolClient,
  订单编号: string,
  用户: 当前业务用户 | null,
): Promise<void> {
  const 原因 = "V2历史订单按原流程确认，关闭迁移生成的审批待办";
  const result = await client.query<{ id: string }>(
    `
    UPDATE ops.approvals
    SET status_code = 'cancelled',
        updated_at = now(),
        extra_json = extra_json || $2::jsonb
    WHERE target_type = 'order'
      AND target_id::text = $1
      AND status_code = 'pending'
    RETURNING id::text AS id
    `,
    [
      订单编号,
      JSON.stringify({
        status: "cancelled",
        reviewRemark: 原因,
        updatedByName: 用户?.displayName || "阶段9测试账号",
      }),
    ],
  );
  for (const approval of result.rows) {
    await client.query(
      `
      INSERT INTO ops.approval_events (
        approval_id, event_code, from_status_code, to_status_code, reason, extra_json
      )
      VALUES ($1::uuid, 'cancel', $2, 'cancelled', $3, $4::jsonb)
      `,
      [
        approval.id,
        "pending",
        原因,
        JSON.stringify({
          actorName: 用户?.displayName || "阶段9测试账号",
          source: "v2-legacy-order",
        }),
      ],
    );
  }
}

async function 同步订单审批链路(
  client: PoolClient,
  参数: {
    订单编号: string;
    原状态: string;
    新状态: string;
    是否调价: boolean;
    原因: string;
    用户: 当前业务用户 | null;
  },
): Promise<void> {
  const 原因 = 参数.原因 || 订单状态默认原因(参数.新状态, 参数.是否调价);
  if (参数.新状态 === "primary_confirmed") {
    await 同步订单审批状态(client, {
      订单编号: 参数.订单编号,
      步骤: "primary_confirm",
      状态: "approved",
      原因,
      用户: 参数.用户,
    });
    await 写入订单审批待办(client, {
      订单编号: 参数.订单编号,
      步骤: "region_confirm",
      原因: "一级已确认，等待区管确认",
      用户: 参数.用户,
    });
    await 写入订单发件箱事件(client, 参数.订单编号, "crm.order.approval.pending", {
      status: "primary_confirmed",
      step: "region_confirm",
    });
    return;
  }
  if (参数.新状态 === "pending_superadmin_confirm") {
    if (参数.原状态 !== "pending_superadmin_confirm") {
      const 步骤 = 订单状态审批步骤(参数.原状态) || "region_confirm";
      await 同步订单审批状态(client, {
        订单编号: 参数.订单编号,
        步骤,
        状态: "approved",
        原因,
        用户: 参数.用户,
      });
    }
    await 写入订单审批待办(client, {
      订单编号: 参数.订单编号,
      步骤: "superadmin_confirm",
      原因: 参数.是否调价 ? "区管调价后等待超管确认" : "区管已确认，等待超管确认",
      用户: 参数.用户,
    });
    await 写入订单发件箱事件(client, 参数.订单编号, "crm.order.approval.pending", {
      status: "pending_superadmin_confirm",
      step: "superadmin_confirm",
    });
    return;
  }
  if (参数.新状态 === "confirmed") {
    await 同步订单审批状态(client, {
      订单编号: 参数.订单编号,
      步骤: "superadmin_confirm",
      状态: "approved",
      原因,
      用户: 参数.用户,
    });
    await 写入订单发件箱事件(client, 参数.订单编号, "crm.order.confirmed", {
      status: "confirmed",
    });
    return;
  }
  if (["primary_rejected", "rejected", "cancelled"].includes(参数.新状态)) {
    const 步骤 = 订单状态审批步骤(参数.原状态) || "region_confirm";
    await 同步订单审批状态(client, {
      订单编号: 参数.订单编号,
      步骤,
      状态: 参数.新状态 === "cancelled" ? "cancelled" : "rejected",
      原因,
      用户: 参数.用户,
    });
  }
}

async function 写入订单状态历史(
  client: PoolClient,
  参数: {
    订单编号: string;
    原状态: string;
    新状态: string;
    原因: string;
    用户: 当前业务用户 | null;
  },
): Promise<void> {
  const 操作人编号 = await 查询操作人编号(client, 参数.用户);
  await client.query(
    `
    INSERT INTO crm.order_status_history (
      order_id, from_status_code, to_status_code, actor_user_id, changed_at, reason
    )
    VALUES ($1::uuid, $2, $3, $4::uuid, now(), $5)
    `,
    [参数.订单编号, 参数.原状态 || null, 参数.新状态, 操作人编号, 参数.原因],
  );
}

async function 写入订单发件箱事件(
  client: PoolClient,
  订单编号: string,
  事件类型: string,
  载荷: Record<string, unknown>,
): Promise<void> {
  await client.query(
    `
    INSERT INTO ops.outbox_events (
      event_type, aggregate_type, aggregate_id, payload_json, status_code, created_at
    )
    VALUES ($1, 'order', $2::uuid, $3::jsonb, 'pending', now())
    `,
    [事件类型, 订单编号, JSON.stringify({ orderId: 订单编号, ...载荷 })],
  );
}

/**
 * 自动预审只由订单状态机调用：普通订单在区管确认后投递；调价订单仅在超管确认后投递。
 * 订单唯一约束是最终幂等门禁，重复流转、并发请求和后续调价均不得生成第二条 OA 发起记录。
 */
async function 写入订单预审自动发起事件(
  client: PoolClient,
  参数: {
    订单编号: string;
    订单编号文本: string;
    原状态: string;
    新状态: string;
    是否当前调价: boolean;
    是否存在调价记录: boolean;
    区管用户编号: string | null;
    用户: 当前业务用户 | null;
  },
): Promise<void> {
  const 普通订单区管确认 =
    !参数.是否当前调价 &&
    参数.原状态 === "primary_confirmed" &&
    参数.新状态 === "pending_superadmin_confirm";
  const 调价订单超管确认 =
    !参数.是否当前调价 &&
    参数.原状态 === "pending_superadmin_confirm" &&
    参数.新状态 === "confirmed" &&
    参数.是否存在调价记录;
  if (!普通订单区管确认 && !调价订单超管确认) return;

  const 触发代码 = 普通订单区管确认
    ? "region_confirmed"
    : "superadmin_confirmed_after_price_adjust";
  const 模板查询 = await client.query<{
    id: string;
    template_version: string;
    workflow_id: string;
    form_id: string;
    field_mapping_json: Record<string, unknown>;
  }>(
    `
    SELECT id::text AS id, template_version, workflow_id, form_id, field_mapping_json
    FROM integration.order_preapproval_templates
    WHERE template_code = 'channel_product_order_precheck'
      AND environment_code = 'shared'
      AND status_code = 'active'
    ORDER BY updated_at DESC, id
    LIMIT 1
    `,
  );
  const 模板 = 模板查询.rows[0];
  const 幂等键 = `order-preapproval:${参数.订单编号}:2026-08-27-v1`;
  const 发起结果 = await client.query<{ id: string }>(
    `
    INSERT INTO integration.order_preapproval_requests (
      order_id, template_id, template_version, trigger_code, region_manager_user_id,
      idempotency_key, status_code, failure_code, failure_summary, template_snapshot_json, request_snapshot_json
    )
    VALUES (
      $1::uuid, $2::uuid, $3, $4, $5::uuid,
      $6, $7, $8, $9, $10::jsonb, $11::jsonb
    )
    ON CONFLICT (order_id) DO NOTHING
    RETURNING id::text AS id
    `,
    [
      参数.订单编号,
      模板?.id || null,
      模板?.template_version || "unconfigured",
      触发代码,
      参数.区管用户编号,
      幂等键,
      模板 ? "pending" : "stopped",
      模板 ? null : "ORDER_PREAPPROVAL_TEMPLATE_UNAVAILABLE",
      模板 ? null : "订单预审模板未启用，已停止自动发起，请由超级管理员核验模板配置。",
      JSON.stringify(
        模板
          ? {
              templateId: 模板.id,
              templateVersion: 模板.template_version,
              workflowId: 模板.workflow_id,
              formId: 模板.form_id,
              fieldMapping: 模板.field_mapping_json,
            }
          : {},
      ),
      JSON.stringify({
        orderNo: 参数.订单编号文本,
        triggerCode: 触发代码,
        regionManagerUserId: 参数.区管用户编号 || "",
      }),
    ],
  );
  const 发起编号 = 发起结果.rows[0]?.id;
  if (!发起编号) return;

  if (模板) {
    await client.query(
      `
      INSERT INTO ops.outbox_events (
        event_type, aggregate_type, aggregate_id, payload_json, status_code, created_at
      )
      VALUES ($1, 'order_preapproval', $2::uuid, $3::jsonb, 'pending', now())
      `,
      [
        "crm.order.preapproval.requested",
        发起编号,
        JSON.stringify({ orderPreapprovalRequestId: 发起编号, triggerCode: 触发代码 }),
      ],
    );
  }
  await 写入审计日志(client, {
    用户: 参数.用户,
    模块: "order_preapproval",
    动作: "auto_requested",
    对象类型: "order",
    对象编号: 参数.订单编号,
    对象名称: 参数.订单编号文本,
    结果: 模板 ? "queued" : "stopped",
    说明: 模板
      ? "订单状态机已自动创建渠道产品订单预审发起请求。"
      : "订单状态机已创建停止的预审记录，等待模板配置恢复。",
    变更后: { requestId: 发起编号, triggerCode: 触发代码 },
  });
}

async function 写入报备发件箱事件(
  client: PoolClient,
  报备编号: string,
  事件类型:
    "crm.registration.approved" | "crm.registration.rejected" | "crm.registration.approval.pending",
  载荷: Record<string, unknown>,
): Promise<void> {
  await client.query(
    `
    INSERT INTO ops.outbox_events (
      event_type, aggregate_type, aggregate_id, payload_json, status_code, created_at
    )
    VALUES ($1, 'registration', $2::uuid, $3::jsonb, 'pending', now())
    `,
    [事件类型, 报备编号, JSON.stringify({ registrationId: 报备编号, ...载荷 })],
  );
}

async function 查询操作人编号(
  client: PoolClient,
  用户: 当前业务用户 | null,
): Promise<string | null> {
  if (!用户) return null;
  const 候选 = [用户.userId || "", 用户.externalUserId || "", 用户.username || ""].filter(Boolean);
  for (const 编号 of 候选) {
    const 用户编号 = await 查询账号编号(client, 编号);
    if (用户编号) return 用户编号;
  }
  return null;
}

function 订单审批步骤名称(步骤: 订单审批步骤): string {
  const 映射: Record<订单审批步骤, string> = {
    primary_confirm: "一级分销商确认",
    region_confirm: "区管确认",
    superadmin_confirm: "超管确认",
  };
  return 映射[步骤];
}

function 订单状态审批步骤(status: string): 订单审批步骤 | null {
  if (status === "pending_primary_confirm") return "primary_confirm";
  if (status === "primary_confirmed") return "region_confirm";
  if (status === "pending_superadmin_confirm") return "superadmin_confirm";
  return null;
}

function 订单状态默认原因(status: string, 是否调价: boolean): string {
  if (status === "primary_confirmed") return "一级分销商确认通过";
  if (status === "pending_superadmin_confirm")
    return 是否调价 ? "区管调价后提交超管确认" : "区管确认通过";
  if (status === "confirmed") return "超管确认通过";
  if (status === "primary_rejected") return "一级分销商驳回";
  if (status === "rejected") return "订单驳回";
  if (status === "cancelled") return "订单取消";
  return "订单状态流转";
}

function 读取订单调整金额(输入: Record<string, unknown>): number | null {
  for (const key of ["newAmount", "amount", "total"]) {
    if (!Object.prototype.hasOwnProperty.call(输入, key)) continue;
    const value = 输入[key];
    if (value === null || value === undefined || value === "") continue;
    const number = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(number) || number < 0) {
      throw new 应用错误("V3_ORDER_PRICE_ADJUST_INVALID", "请输入有效的调整后价格。", 400);
    }
    return number;
  }
  return null;
}

async function 解析业务归属(
  client: PoolClient,
  输入: Record<string, unknown>,
  用户: 业务用户上下文 | null,
  当前: {
    partnerId: string | null;
    ownerUserId: string | null;
    regionId: string | null;
  } = { partnerId: null, ownerUserId: null, regionId: null },
): Promise<业务归属结果> {
  const 请求渠道 = 读取文本(输入, ["partnerId", "assignedPartnerId", "渠道编号"], "");
  const 请求员工 = 读取文本(
    输入,
    ["ownerUserId", "assignedStaffId", "assignedStaffUserId", "跟进员工编号"],
    "",
  );
  let partnerId = 当前.partnerId;
  let ownerUserId = 当前.ownerUserId;
  let regionId = 当前.regionId;

  if (!用户) {
    partnerId = 请求渠道 ? await 必须查询渠道编号(client, 请求渠道) : partnerId;
    ownerUserId = 请求员工 ? await 必须查询账号编号(client, 请求员工) : ownerUserId;
    if (!partnerId && ownerUserId)
      partnerId = (await 查询账号首个渠道(client, ownerUserId))?.id || null;
  } else if (用户.roleCode === "staff" || 用户.dataScopeCode === "self") {
    ownerUserId = 用户.userId;
    partnerId = 用户.partnerIds[0] || partnerId;
    if (!partnerId) {
      throw new 应用错误(
        "V3_BUSINESS_PARTNER_BINDING_REQUIRED",
        "当前渠道员工未绑定渠道商，不能提交业务记录。",
        403,
      );
    }
  } else if (用户.roleCode === "partner_admin" || 用户.dataScopeCode === "partner") {
    const 指定渠道 = 请求渠道 ? await 必须查询渠道编号(client, 请求渠道) : "";
    partnerId = 指定渠道 || 用户.partnerIds[0] || partnerId;
    if (!partnerId || !用户.partnerIds.includes(partnerId)) {
      throw new 应用错误(
        "V3_BUSINESS_PARTNER_SCOPE_FORBIDDEN",
        "只能操作当前渠道企业范围内的业务记录。",
        403,
      );
    }
    ownerUserId = 请求员工 ? await 必须查询账号编号(client, 请求员工) : ownerUserId || 用户.userId;
    if (ownerUserId && !(await 是否渠道成员(client, partnerId, ownerUserId))) {
      throw new 应用错误(
        "V3_BUSINESS_STAFF_SCOPE_FORBIDDEN",
        "请选择当前渠道企业下的跟进员工。",
        403,
      );
    }
  } else {
    if (请求渠道) partnerId = await 必须查询渠道编号(client, 请求渠道);
    if (请求员工) ownerUserId = await 必须查询账号编号(client, 请求员工);
    if (!partnerId && ownerUserId)
      partnerId = (await 查询账号首个渠道(client, ownerUserId))?.id || null;
    if (partnerId && ownerUserId && !(await 是否渠道成员(client, partnerId, ownerUserId))) {
      throw new 应用错误(
        "V3_BUSINESS_STAFF_PARTNER_MISMATCH",
        "跟进员工不属于所选渠道商，请重新选择。",
        400,
      );
    }
  }

  const partner = partnerId ? await 查询渠道快照(client, partnerId) : null;
  if (
    用户 &&
    (用户.roleCode === "region_manager" || 用户.dataScopeCode === "region") &&
    partner?.regionId &&
    用户.regionId &&
    partner.regionId !== 用户.regionId
  ) {
    throw new 应用错误("V3_BUSINESS_REGION_SCOPE_FORBIDDEN", "只能指派本区域范围内的渠道商。", 403);
  }

  if (!regionId) {
    regionId = partner?.regionId || null;
  }
  if (!regionId) {
    regionId = await 查询区域编号(client, 读取文本(输入, ["region", "区域"], ""));
  }
  if (!regionId && 用户?.regionId) regionId = 用户.regionId;

  const owner = ownerUserId ? await 查询账号快照(client, ownerUserId) : null;
  const region = regionId ? await 查询区域快照(client, regionId) : null;
  return {
    partnerId: partner?.id || partnerId || null,
    partnerName: partner?.name || 读取文本(输入, ["partnerName", "assignedPartnerName"], ""),
    ownerUserId: owner?.id || ownerUserId || null,
    ownerUserName: owner?.name || 读取文本(输入, ["assignedStaffName", "ownerName"], ""),
    regionId: region?.id || regionId || null,
    regionName: region?.name || 读取文本(输入, ["region", "区域"], ""),
  };
}

async function 查询或创建客户(
  client: PoolClient,
  客户名称: string,
  输入: Record<string, unknown>,
): Promise<string> {
  const normalized = 归一化名称(客户名称);
  const result = await client.query<{ id: string }>(
    `
    INSERT INTO crm.customers (customer_name, normalized_name, credit_code, status_code, extra_json)
    VALUES ($1, $2, $3, 'active', $4::jsonb)
    ON CONFLICT (normalized_name) WHERE status_code <> 'merged'
    DO UPDATE SET updated_at = now(), extra_json = crm.customers.extra_json || EXCLUDED.extra_json
    RETURNING id
    `,
    [
      客户名称,
      normalized,
      读取文本(输入, ["creditCode", "统一社会信用代码"], ""),
      JSON.stringify(输入),
    ],
  );
  return 读取返回编号(result.rows[0]);
}

async function 查询渠道编号(client: PoolClient, 输入编号: string): Promise<string | null> {
  if (!输入编号.trim()) return null;
  const result = await client.query<{ id: string }>(
    `
    SELECT id::text AS id
    FROM channel.partners
    WHERE id::text = $1
       OR v2_source_id = $1
       OR partner_code = $1
       OR partner_name = $1
       OR extra_json->>'id' = $1
       OR extra_json->>'partnerId' = $1
    ORDER BY created_at
    LIMIT 1
    `,
    [输入编号],
  );
  return result.rows[0]?.id || null;
}

async function 查询账号编号(client: PoolClient, 输入编号: string): Promise<string | null> {
  if (!输入编号.trim()) return null;
  const result = await client.query<{ id: string }>(
    `
    SELECT id::text AS id
    FROM iam.users
    WHERE id::text = $1
       OR v2_source_id = $1
       OR username::text = $1
       OR display_name = $1
       OR extra_json->>'id' = $1
       OR extra_json->>'userId' = $1
    ORDER BY created_at
    LIMIT 1
    `,
    [输入编号],
  );
  return result.rows[0]?.id || null;
}

async function 必须查询渠道编号(client: PoolClient, 输入编号: string): Promise<string> {
  const id = await 查询渠道编号(client, 输入编号);
  if (!id) throw new 应用错误("V3_BUSINESS_PARTNER_NOT_FOUND", "所选渠道商不存在。", 400);
  return id;
}

async function 必须查询账号编号(client: PoolClient, 输入编号: string): Promise<string> {
  const id = await 查询账号编号(client, 输入编号);
  if (!id) throw new 应用错误("V3_BUSINESS_USER_NOT_FOUND", "所选跟进员工不存在。", 400);
  return id;
}

async function 查询渠道快照(
  client: PoolClient,
  id: string,
): Promise<{ id: string; name: string; regionId: string; regionName: string } | null> {
  const result = await client.query<{
    id: string;
    name: string;
    region_id: string | null;
    region_name: string | null;
  }>(
    `
    SELECT p.id::text AS id, p.partner_name AS name,
      p.region_id::text AS region_id, reg.region_name
    FROM channel.partners p
    LEFT JOIN org.regions reg ON reg.id = p.region_id
    WHERE p.id::text = $1 OR p.v2_source_id = $1 OR p.partner_code = $1 OR p.extra_json->>'id' = $1
    LIMIT 1
    `,
    [id],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    regionId: row.region_id || "",
    regionName: row.region_name || "",
  };
}

async function 查询账号快照(
  client: PoolClient,
  id: string,
): Promise<{ id: string; name: string } | null> {
  const result = await client.query<{ id: string; display_name: string }>(
    `
    SELECT id::text AS id, display_name
    FROM iam.users
    WHERE id::text = $1
       OR v2_source_id = $1
       OR username::text = $1
       OR extra_json->>'id' = $1
       OR extra_json->>'userId' = $1
    LIMIT 1
    `,
    [id],
  );
  const row = result.rows[0];
  return row ? { id: row.id, name: row.display_name } : null;
}

async function 查询账号首个渠道(
  client: PoolClient,
  userId: string,
): Promise<{ id: string; name: string } | null> {
  const result = await client.query<{ id: string; name: string }>(
    `
    SELECT p.id::text AS id, p.partner_name AS name
    FROM channel.partner_members pm
    JOIN channel.partners p ON p.id = pm.partner_id
    WHERE pm.user_id = $1::uuid
      AND pm.status_code = 'active'
      AND pm.archived_at IS NULL
      AND p.status_code = 'active'
    ORDER BY pm.started_at DESC
    LIMIT 1
    `,
    [userId],
  );
  return result.rows[0] || null;
}

async function 是否渠道成员(
  client: PoolClient,
  partnerId: string,
  userId: string,
): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `
    SELECT EXISTS (
      SELECT 1
      FROM channel.partner_members
      WHERE partner_id = $1::uuid
        AND user_id = $2::uuid
        AND status_code = 'active'
        AND archived_at IS NULL
    ) AS exists
    `,
    [partnerId, userId],
  );
  return Boolean(result.rows[0]?.exists);
}

async function 查询区域快照(
  client: PoolClient,
  id: string,
): Promise<{ id: string; name: string } | null> {
  const result = await client.query<{ id: string; region_name: string }>(
    `
    SELECT id::text AS id, region_name
    FROM org.regions
    WHERE id::text = $1 OR region_code = $1 OR region_name = $1
    LIMIT 1
    `,
    [id],
  );
  const row = result.rows[0];
  return row ? { id: row.id, name: row.region_name } : null;
}

async function 查询区域编号(client: PoolClient, 输入名称: string): Promise<string | null> {
  if (!输入名称.trim()) return null;
  const result = await client.query<{ id: string }>(
    `
    SELECT id::text AS id
    FROM org.regions
    WHERE region_name = $1 OR region_code = $1 OR id::text = $1
    ORDER BY region_level DESC
    LIMIT 1
    `,
    [输入名称],
  );
  return result.rows[0]?.id || null;
}

function 分页列表(记录集合: 阶段9记录[], 查询: 阶段9查询参数): 阶段9列表结果 {
  const keyword = (查询.keyword || "").trim().toLowerCase();
  const level = (查询.level || "").trim().toLowerCase();
  const region = (查询.region || "").trim().toLowerCase();
  const filtered = 记录集合.filter((记录) => {
    const 命中关键词 =
      !keyword ||
      [记录.标题, 记录.客户名称, 记录.渠道名称, 记录.负责人, 记录.编号]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    const 命中状态 = !查询.status || 记录.状态 === 查询.status;
    const 记录级别 = 读取记录文本(记录, ["level", "级别", "等级"]).toLowerCase();
    const 记录区域 = 读取记录文本(记录, ["region", "区域", "city", "城市"]).toLowerCase();
    const 命中级别 = !level || 记录级别 === level;
    const 命中区域 = !region || 记录区域.includes(region);
    return 命中关键词 && 命中状态 && 命中级别 && 命中区域;
  });
  const start = (查询.page - 1) * 查询.pageSize;
  return {
    数据: filtered.slice(start, start + 查询.pageSize),
    分页: {
      页码: 查询.page,
      每页: 查询.pageSize,
      总数: filtered.length,
    },
  };
}

function 读取记录文本(记录: 阶段9记录, keys: string[]): string {
  const source = 记录 as unknown as Record<string, unknown>;
  for (const key of keys) {
    const value = source[key] ?? 记录.原始数据[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function 读取阶段8导出数据(): Record<string, Record<string, unknown>[]> {
  const 根目录 = 查找项目根目录();
  const 导出目录 = path.join(根目录, "tmp/stage8/v2-export-official/exported");
  const 实体 = [
    "audit_logs",
    "users",
    "partners",
    "registrations",
    "opportunities",
    "quotes",
    "orders",
    "features",
    "hardwareProducts",
    "packages",
    "implementationWorkloadRules",
    "implementationDeliveryWorkloadRules",
    "implementationWorkloadMappings",
    "pendingApprovals",
    "notifications",
    "openApiClients",
  ];
  return Object.fromEntries(实体.map((名称) => [名称, 读取实体文件(导出目录, 名称)]));
}

function 查找项目根目录(): string {
  let current = process.cwd();
  const 当前文件目录 = path.dirname(fileURLToPath(import.meta.url));
  const 候选目录 = [current, path.resolve(当前文件目录, "../../..")];
  for (const 起点 of 候选目录) {
    current = 起点;
    for (let 次数 = 0; 次数 < 8; 次数 += 1) {
      if (fs.existsSync(path.join(current, "tmp/stage8/v2-export-official/exported"))) {
        return current;
      }
      const packageJson = path.join(current, "package.json");
      if (fs.existsSync(packageJson)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(packageJson, "utf8")) as {
            workspaces?: unknown;
          };
          if (Array.isArray(parsed.workspaces)) return current;
        } catch {
          return current;
        }
      }
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  return process.cwd();
}

function 读取实体文件(导出目录: string, 名称: string): Record<string, unknown>[] {
  const 文件名 = 名称 === "audit_logs" ? "audit-logs.ndjson" : `entities-${名称}.ndjson`;
  const 文件路径 = path.join(导出目录, 文件名);
  if (!fs.existsSync(文件路径)) return [];
  return fs
    .readFileSync(文件路径, "utf8")
    .split("\n")
    .map((行) => 行.trim())
    .filter(Boolean)
    .map((行) => {
      const record = JSON.parse(行) as {
        redactedJson?: Record<string, unknown>;
        data?: Record<string, unknown>;
      };
      return record.redactedJson || record.data || {};
    });
}

function 转报备记录(原始数据: Record<string, unknown>): 阶段9记录 {
  return 基础记录("客户报备", 原始数据, {
    标题: 读取文本(原始数据, ["customer", "customerName"], "未命名客户"),
    客户名称: 读取文本(原始数据, ["customer", "customerName"], "未命名客户"),
    渠道名称: 读取文本(原始数据, ["partnerName"], ""),
    负责人: 读取文本(原始数据, ["assignedStaffName", "createdByName"], ""),
    区域: 读取文本(原始数据, ["region"], ""),
    状态: 规范报备状态(读取文本(原始数据, ["status"], "draft")),
    金额: 0,
  });
}

function 转商机记录(原始数据: Record<string, unknown>): 阶段9记录 {
  const 阶段 = 读取文本(原始数据, ["stage"], "active");
  return 基础记录("商机", 原始数据, {
    标题: 读取文本(原始数据, ["name"], 读取文本(原始数据, ["customer"], "未命名商机")),
    客户名称: 读取文本(原始数据, ["customer"], ""),
    渠道名称: 读取文本(原始数据, ["partnerName", "assignedPartnerName"], ""),
    负责人: 读取文本(原始数据, ["assignedStaffName", "owner", "createdByName"], ""),
    区域: 读取文本(原始数据, ["region"], ""),
    状态: 规范商机状态(阶段),
    状态名称: 状态中文[规范商机状态(阶段)] || 阶段,
    金额: 读取数字(原始数据, ["amount"], 0),
  });
}

function 转报价记录(原始数据: Record<string, unknown>): 阶段9记录 {
  return 基础记录("报价单", 原始数据, {
    标题: 读取文本(原始数据, ["customer"], "未命名报价"),
    客户名称: 读取文本(原始数据, ["customer"], ""),
    渠道名称: 读取文本(原始数据, ["partnerName", "assignedPartnerName"], ""),
    负责人: 读取文本(原始数据, ["assignedStaffName", "createdByName"], ""),
    区域: 读取文本(原始数据, ["region"], ""),
    状态: 规范报价状态(读取文本(原始数据, ["status"], "draft")),
    金额: 读取数字(原始数据, ["total", "originalTotal"], 0),
  });
}

function 转订单记录(原始数据: Record<string, unknown>): 阶段9记录 {
  return 基础记录("订单", 原始数据, {
    标题: 读取文本(原始数据, ["customer"], "未命名订单"),
    客户名称: 读取文本(原始数据, ["customer"], ""),
    渠道名称: 读取文本(原始数据, ["partnerName", "assignedPartnerName"], ""),
    负责人: 读取文本(原始数据, ["assignedStaffName", "createdByName", "lastOperatorName"], ""),
    区域: 读取文本(原始数据, ["region"], ""),
    状态: 规范订单状态(读取文本(原始数据, ["status"], "draft")),
    金额: 读取数字(原始数据, ["total"], 0),
  });
}

function 转渠道记录(原始数据: Record<string, unknown>): 阶段9记录 {
  return 基础记录("渠道商", 原始数据, {
    标题: 读取文本(原始数据, ["name"], "未命名渠道"),
    渠道名称: 读取文本(原始数据, ["name"], ""),
    负责人: 读取文本(原始数据, ["contact"], ""),
    区域: 读取文本(原始数据, ["region"], ""),
    状态: 读取文本(原始数据, ["status"], "active"),
    金额: 读取数字(原始数据, ["totalAmt"], 0),
  });
}

function 转产品记录(原始数据: Record<string, unknown>, 类型: string): 阶段9记录 {
  return 基础记录(类型, 原始数据, {
    标题: 读取文本(原始数据, ["name"], "未命名产品"),
    负责人: 读取文本(原始数据, ["moduleName", "unit", "model"], ""),
    状态: 读取文本(原始数据, ["status"], "active"),
    状态名称: 读取布尔(原始数据, ["published"], false) ? "已发布" : "未发布",
    金额: 读取产品单价(原始数据, 100),
  });
}

function 转账号记录(原始数据: Record<string, unknown>): 阶段9记录 {
  return 基础记录("账号", 原始数据, {
    标题: 读取文本(原始数据, ["name", "username"], "未命名账号"),
    负责人: 读取文本(原始数据, ["username"], ""),
    区域: 读取文本(原始数据, ["region", "bigRegion"], ""),
    状态: 读取文本(原始数据, ["status"], "active"),
    状态名称: 读取文本(原始数据, ["role"], ""),
  });
}

function 转审计记录(原始数据: Record<string, unknown>): 阶段9记录 {
  return 基础记录("审计日志", 原始数据, {
    标题: 读取文本(原始数据, ["message", "action", "module"], "审计记录"),
    负责人: 读取文本(原始数据, ["actorName", "operatorName", "username"], ""),
    状态: 读取文本(原始数据, ["result", "resultCode"], "success"),
    状态名称: 读取文本(原始数据, ["result", "resultCode"], "success"),
  });
}

function 转开放接口记录(原始数据: Record<string, unknown>): 阶段9记录 {
  return 基础记录("开放接口", 原始数据, {
    标题: 读取文本(原始数据, ["name", "appKey"], "开放接口客户端"),
    负责人: 读取文本(原始数据, ["createdByName", "boundUserId"], ""),
    状态: 读取文本(原始数据, ["status"], "active"),
  });
}

function 转工作量记录(原始数据: Record<string, unknown>, 类型: string): 阶段9记录 {
  return 基础记录(类型, 原始数据, {
    标题: 读取文本(原始数据, ["name", "ruleName", "featureName", "item"], "工作量配置"),
    负责人: 读取文本(原始数据, ["productType", "deliveryTag", "moduleName"], ""),
    状态: 读取布尔(原始数据, ["active"], true) ? "active" : "disabled",
    金额: 读取数字(原始数据, ["personDays", "workloadDays"], 0),
  });
}

function 转审核记录(原始数据: Record<string, unknown>): 阶段9记录 {
  return 基础记录("审核任务", 原始数据, {
    标题: 读取文本(原始数据, ["targetName", "type"], "审核任务"),
    客户名称: 读取文本(原始数据, ["customerName", "targetName"], ""),
    渠道名称: 读取文本(原始数据, ["targetPartnerName"], ""),
    负责人: 读取文本(原始数据, ["createdBy"], ""),
    区域: 读取文本(原始数据, ["region", "bigRegion"], ""),
    状态: 规范报备状态(读取文本(原始数据, ["status"], "pending")),
  });
}

function 转通知记录(原始数据: Record<string, unknown>): 阶段9记录 {
  return 基础记录("通知", 原始数据, {
    标题: 读取文本(原始数据, ["title"], "通知"),
    负责人: 读取文本(原始数据, ["userId"], ""),
    状态: 读取布尔(原始数据, ["unread"], false) ? "unread" : "read",
  });
}

function 基础记录(
  类型: string,
  原始数据: Record<string, unknown>,
  覆盖: Partial<阶段9记录>,
): 阶段9记录 {
  const 状态 = 覆盖.状态 || 读取文本(原始数据, ["status"], "active");
  const id = 读取文本(原始数据, ["id"], "");
  return {
    id,
    编号: id,
    类型,
    标题: 覆盖.标题 || id || 类型,
    客户名称: 覆盖.客户名称 || "",
    渠道名称: 覆盖.渠道名称 || "",
    负责人: 覆盖.负责人 || "",
    区域: 覆盖.区域 || "",
    状态,
    状态名称: 覆盖.状态名称 || 状态中文[状态] || 状态,
    金额: 覆盖.金额 || 0,
    创建时间: 读取文本(原始数据, ["createdAt", "time"], ""),
    更新时间: 读取文本(原始数据, ["updatedAt", "createdAt", "time"], ""),
    原始数据,
  };
}

function 转SQL记录(row: SQL阶段9记录): 阶段9记录 {
  const 状态 = row.状态 || "";
  return {
    id: row.id,
    编号: row.编号 || row.id,
    类型: row.类型,
    标题: row.标题 || row.编号 || row.id,
    客户名称: row.客户名称 || "",
    渠道名称: row.渠道名称 || "",
    负责人: row.负责人 || "",
    区域: row.区域 || "",
    状态,
    状态名称: row.状态名称 || 状态中文[状态] || 状态,
    金额: Number(row.金额) || 0,
    创建时间: 格式化时间(row.创建时间),
    更新时间: 格式化时间(row.更新时间),
    原始数据: row.原始数据 || {},
  };
}

function 读取文本(来源: Record<string, unknown>, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = 来源[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return fallback;
}

function 读取数字(来源: Record<string, unknown>, keys: string[], fallback: number): number {
  for (const key of keys) {
    const value = 来源[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return fallback;
}

function 读取报备保护天数(来源: Record<string, unknown>, fallback = 180): number {
  const value = 读取数字(来源, ["protectDays", "protectionDays", "保护天数"], fallback);
  if (!Number.isInteger(value) || value < 1 || value > 3650) return fallback;
  return value;
}

function 计算报备保护到期日(开始时间: string, protectDays: number): string {
  const 开始日期 = new Date(开始时间);
  if (Number.isNaN(开始日期.getTime())) return "";
  开始日期.setUTCDate(开始日期.getUTCDate() + protectDays);
  return 开始日期.toISOString().slice(0, 10);
}

function 读取布尔(来源: Record<string, unknown>, keys: string[], fallback: boolean): boolean {
  for (const key of keys) {
    const value = 来源[key];
    if (typeof value === "boolean") return value;
  }
  return fallback;
}

function 读取文本数组(来源: Record<string, unknown>, keys: string[]): string[] {
  for (const key of keys) {
    const value = 来源[key];
    if (Array.isArray(value)) return value.map((项) => String(项)).filter(Boolean);
    if (typeof value === "string" && value.trim()) {
      return value
        .split(",")
        .map((项) => 项.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function 读取产品单价(产品: Record<string, unknown>, endpoints: number): number {
  const fixed = 读取数字(产品, ["priceFixed", "listPrice"], 0);
  if (fixed > 0) return fixed;
  const tiers = 产品.tiers;
  if (Array.isArray(tiers)) {
    const 命中 = tiers.find((项) => {
      if (!项 || typeof 项 !== "object") return false;
      const record = 项 as Record<string, unknown>;
      const min = 读取数字(record, ["min"], 0);
      const max = 读取数字(record, ["max"], Number.MAX_SAFE_INTEGER);
      return endpoints >= min && endpoints <= max;
    }) as Record<string, unknown> | undefined;
    if (命中) return 读取数字(命中, ["price"], 0);
  }
  return 0;
}

function 规范报备状态(status: string): string {
  if (["approved", "pending", "rejected", "cancelled", "converted", "draft"].includes(status)) {
    return status;
  }
  return "pending";
}

function 规范报备初始状态(status: string, 用户: 业务用户上下文 | null): string {
  if (
    用户 &&
    (用户.roleCode === "staff" ||
      用户.roleCode === "partner_admin" ||
      用户.dataScopeCode === "self" ||
      用户.dataScopeCode === "partner")
  ) {
    return "pending";
  }
  return 规范报备状态(status);
}

function 规范商机状态(stage: string): string {
  if (stage === "won") return "won";
  if (stage === "lost") return "lost";
  if (stage === "cancelled") return "cancelled";
  return "active";
}

function 规范报价状态(status: string): string {
  if (["draft", "submitted", "approved", "rejected", "converted", "cancelled"].includes(status)) {
    return status;
  }
  if (status === "confirmed") return "approved";
  return "draft";
}

function 规范订单状态(status: string): string {
  if (
    [
      "draft",
      "pending_primary_confirm",
      "primary_confirmed",
      "primary_rejected",
      "pending_superadmin_confirm",
      "confirmed",
      "rejected",
      "cancelled",
      "processing",
      "shipped",
      "completed",
    ].includes(status)
  ) {
    return status;
  }
  if (status === "pending") return "pending_primary_confirm";
  if (status === "pending_region_confirm" || status === "pending_region_review")
    return "primary_confirmed";
  if (status === "superadmin_confirm" || status === "pending_superadmin_review")
    return "pending_superadmin_confirm";
  if (status === "approved") return "confirmed";
  return "confirmed";
}

function 规范V2历史订单状态(status: string): string {
  return [
    "draft",
    "pending",
    "confirmed",
    "rejected",
    "cancelled",
    "processing",
    "shipped",
    "completed",
  ].includes(status)
    ? status
    : "";
}

function 推导V2历史订单下一状态(当前状态: string, 请求状态: string): string {
  if (["rejected", "cancelled", "shipped", "completed"].includes(请求状态)) return 请求状态;
  if (当前状态 === "pending" && ["confirmed", "processing"].includes(请求状态)) return "processing";
  if (当前状态 === "processing" && 请求状态 === "confirmed") return "processing";
  return 请求状态;
}

function 推导订单下一状态(当前状态: string, 请求状态: string): string {
  if (["rejected", "primary_rejected", "cancelled", "shipped", "completed"].includes(请求状态)) {
    return 请求状态;
  }
  if (
    当前状态 === "pending_primary_confirm" &&
    ["primary_confirmed", "confirmed", "processing", "pending_superadmin_confirm"].includes(
      请求状态,
    )
  ) {
    return "primary_confirmed";
  }
  if (
    当前状态 === "primary_confirmed" &&
    ["confirmed", "processing", "pending_superadmin_confirm"].includes(请求状态)
  ) {
    return "pending_superadmin_confirm";
  }
  if (当前状态 === "pending_superadmin_confirm" && ["confirmed", "processing"].includes(请求状态)) {
    return "confirmed";
  }
  if (当前状态 === "confirmed" && 请求状态 === "processing") return "processing";
  return 请求状态;
}

function 读取返回编号(row: { id?: string } | undefined): string {
  if (!row?.id) throw new 应用错误("V3_STAGE9_WRITE_FAILED", "业务记录写入失败。", 500);
  return row.id;
}

function 读取提报账号(...候选账号: Array<string | null | undefined>): string {
  const 提报账号 = 候选账号.find((账号) => typeof 账号 === "string" && 账号.trim())?.trim();
  if (提报账号) return 提报账号;
  return "system";
}

function 生成内存商机编号(商机列表: 阶段9记录[]): string {
  const 日期格式化器 = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const 日期 = Object.fromEntries(
    日期格式化器
      .formatToParts(new Date())
      .filter((项) => 项.type !== "literal")
      .map((项) => [项.type, 项.value]),
  );
  const 日期编号 = `${日期.year}${日期.month}${日期.day}`;
  const 编号正则 = new RegExp(`^SJ-${日期编号}-(\\d{4})$`);
  const 当前最大流水 = 商机列表.reduce((最大值, 商机) => {
    const 匹配 = 商机.编号.match(编号正则);
    return Math.max(最大值, Number(匹配?.[1] || 0));
  }, 0);
  return `SJ-${日期编号}-${String(当前最大流水 + 1).padStart(4, "0")}`;
}

async function 生成业务编号(
  client: PoolClient,
  类型: "registration" | "quote" | "order" | "opportunity",
  提报账号 = "",
): Promise<string> {
  const result = await client.query<{ 编号: string }>(
    'SELECT crm.next_business_number($1, $2) AS "编号"',
    [类型, 提报账号],
  );
  const 编号 = result.rows[0]?.编号;
  if (!编号) throw new 应用错误("V3_BUSINESS_NUMBER_GENERATE_FAILED", "业务编号生成失败。", 500);
  return 编号;
}

async function 生成区管正式订单编号(
  client: PoolClient,
  订单编号: string,
  当前用户: 业务用户上下文 | null,
): Promise<{
  订单编号: string;
  前置订单编号: string;
  区管用户编号: string;
  区管账号: string;
  邮箱前缀: string;
  邮箱缺失提示: string;
  协议编号: string;
  国家电话区号: string;
  合同流水号: number;
  合同年份: number;
}> {
  if (!当前用户?.userId) {
    throw new 应用错误(
      "V3_ORDER_REGION_MANAGER_REQUIRED",
      "区管确认或调价必须由已登录的区管账号执行。",
      403,
    );
  }
  const 订单结果 = await client.query<{
    order_no: string;
    pre_region_order_no: string | null;
    region_confirmed_at: Date | null;
    agreement_no: string | null;
    country_calling_code: string | null;
  }>(
    `
    SELECT o.order_no, o.pre_region_order_no, o.region_confirmed_at,
      p.agreement_no, p.country_calling_code
    FROM crm.orders o
    JOIN channel.partners p ON p.id = o.partner_id
    WHERE o.id = $1::uuid
    FOR UPDATE OF o, p
    `,
    [订单编号],
  );
  const 订单 = 订单结果.rows[0];
  if (!订单) throw new 应用错误("V3_STAGE9_NOT_FOUND", "未找到关联渠道商的订单。", 404);
  if (订单.pre_region_order_no || 订单.region_confirmed_at) {
    throw new 应用错误(
      "V3_ORDER_FORMAL_NUMBER_EXISTS",
      "该订单已经生成正式编号，不能重复取号。",
      409,
    );
  }
  const 协议编号 = (订单.agreement_no || "").trim();
  if (!协议编号) {
    throw new 应用错误(
      "V3_ORDER_AGREEMENT_NO_REQUIRED",
      "渠道商未维护协议编号，不能执行区管确认或调价。",
      422,
    );
  }
  const 区管结果 = await client.query<{
    user_id: string;
    username: string;
    email: string | null;
  }>(
    `
    SELECT u.id::text AS user_id, u.username::text AS username, u.email::text AS email
    FROM iam.users u
    JOIN iam.user_roles ur ON ur.user_id = u.id
    JOIN iam.roles r ON r.id = ur.role_id AND r.status_code = 'active'
    JOIN crm.orders o ON o.id = $1::uuid
    JOIN channel.partners p ON p.id = o.partner_id
    WHERE u.id = $2::uuid
      AND u.status_code = 'active'
      AND r.role_code IN ('admin', 'region_manager')
      AND u.region_id IS NOT NULL
      AND u.region_id = p.region_id
    LIMIT 1
    `,
    [订单编号, 当前用户.userId],
  );
  const 区管 = 区管结果.rows[0];
  if (!区管) {
    throw new 应用错误(
      "V3_ORDER_REGION_MANAGER_REQUIRED",
      "仅订单所属区域的区管账号可以确认或调价。",
      403,
    );
  }
  const 邮箱 = (区管.email || "").trim();
  const 有效邮箱前缀 = 邮箱.match(/^([^@\s]+)@[^@\s]+$/)?.[1] || "";
  const 邮箱前缀 = 有效邮箱前缀 || 区管.username.trim();
  if (!邮箱前缀) {
    throw new 应用错误(
      "V3_ORDER_REGION_MANAGER_ACCOUNT_REQUIRED",
      "区管账号不能为空，不能生成正式订单编号。",
      422,
    );
  }
  const 邮箱缺失提示 = 有效邮箱前缀
    ? ""
    : `区管邮箱缺失，正式订单编号已使用账号“${区管.username}”代替邮箱前缀。`;
  const 原始区号 = (订单.country_calling_code || "").replace(/\D/g, "");
  if (!/^[0-9]{1,3}$/.test(原始区号)) {
    throw new 应用错误(
      "V3_ORDER_COUNTRY_CALLING_CODE_INVALID",
      "渠道商国家电话区号必须为 1 至 3 位数字。",
      422,
    );
  }
  const 国家电话区号 = 原始区号.padStart(3, "0");
  const 年份结果 = await client.query<{ year: number }>(
    "SELECT EXTRACT(YEAR FROM now() AT TIME ZONE 'Asia/Shanghai')::integer AS year",
  );
  const 合同年份 = 年份结果.rows[0]?.year;
  if (!合同年份) throw new 应用错误("V3_ORDER_CONTRACT_YEAR_FAILED", "无法确定合同编号年份。", 500);
  const 流水结果 = await client.query<{ current_value: number }>(
    `
    INSERT INTO crm.region_manager_contract_counters (
      region_manager_user_id, contract_year, current_value
    )
    VALUES ($1::uuid, $2, 1)
    ON CONFLICT (region_manager_user_id, contract_year) DO UPDATE
    SET current_value = crm.region_manager_contract_counters.current_value + 1
    RETURNING current_value
    `,
    [区管.user_id, 合同年份],
  );
  const 合同流水号 = Number(流水结果.rows[0]?.current_value);
  if (!Number.isInteger(合同流水号) || 合同流水号 < 1) {
    throw new 应用错误("V3_ORDER_CONTRACT_SEQUENCE_FAILED", "合同编号流水生成失败。", 500);
  }
  return {
    订单编号: `${协议编号}-smb-${邮箱前缀}-${国家电话区号}-${String(合同流水号).padStart(2, "0")}`,
    前置订单编号: 订单.order_no,
    区管用户编号: 区管.user_id,
    区管账号: 区管.username,
    邮箱前缀,
    邮箱缺失提示,
    协议编号,
    国家电话区号,
    合同流水号,
    合同年份,
  };
}

async function 校验订单所属区域区管(
  client: PoolClient,
  订单编号: string,
  当前用户: 业务用户上下文 | null,
): Promise<void> {
  if (!当前用户?.userId) {
    throw new 应用错误(
      "V3_ORDER_REGION_MANAGER_REQUIRED",
      "区管确认或调价必须由已登录的区管账号执行。",
      403,
    );
  }
  const result = await client.query<{ allowed: boolean }>(
    `
    SELECT true AS allowed
    FROM iam.users u
    JOIN iam.user_roles ur ON ur.user_id = u.id
    JOIN iam.roles r ON r.id = ur.role_id AND r.status_code = 'active'
    JOIN crm.orders o ON o.id = $1::uuid
    JOIN channel.partners p ON p.id = o.partner_id
    WHERE u.id = $2::uuid
      AND u.status_code = 'active'
      AND r.role_code IN ('admin', 'region_manager')
      AND u.region_id IS NOT NULL
      AND u.region_id = p.region_id
    LIMIT 1
    `,
    [订单编号, 当前用户.userId],
  );
  if (!result.rows[0]?.allowed) {
    throw new 应用错误(
      "V3_ORDER_REGION_MANAGER_REQUIRED",
      "仅订单所属区域的区管账号可以确认或调价。",
      403,
    );
  }
}

async function 查询业务负责人账号(client: PoolClient, userId: string | null): Promise<string> {
  if (!userId) return "";
  const result = await client.query<{ username: string }>(
    "SELECT username::text AS username FROM iam.users WHERE id = $1::uuid LIMIT 1",
    [userId],
  );
  return result.rows[0]?.username?.trim() || "";
}

function 归一化名称(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "");
}

function 格式化时间(value: string | Date | null): string {
  if (!value) return "";
  return value instanceof Date ? value.toISOString() : String(value);
}
