import crypto from "node:crypto";

import { 应用错误, type 构建信息 } from "@lianruan/shared";
import type { NextFunction, Request, Response, Router } from "express";
import { Router as createRouter } from "express";
import multer from "multer";
import { Pool, type PoolClient } from "pg";
import * as XLSX from "xlsx";

import {
  初始账号审批阶段,
  是账号审批目标,
  读取账号审批阶段,
  账号审批步骤名称,
  账号审批阶段名称,
} from "./account-approval.js";
import { 审计导出文件名, type 审计导出行, 生成审计导出CSV } from "./audit-export.js";
import {
  写入正式页面可信Cookie会话,
  创建密码散列,
  校验密码,
  读取请求会话用户名,
  读取请求会话角色,
} from "./auth-routes.js";
import {
  type 业务用户上下文,
  列出标准地市名称,
  创建业务数据服务,
  type 当前业务用户,
  type 阶段9模块,
  type 阶段9记录,
} from "./business-store.js";
import { 计算IPG参考价 } from "./ipg-pricing.js";
import { 校验联系电话格式, 规范化联系电话 } from "./phone-normalization.js";
import {
  标准化功能价格输入,
  规范化区域价格覆盖,
  规范化历史价格档位,
} from "./product-price-shape.js";
import { 移除产品价格字段 } from "./product-price-visibility.js";
import { 构建报价试算公开视图, 解析报价类型 } from "./quote-visibility.js";
import { 移除敏感字段 } from "./sensitive-fields.js";

interface V2兼容路由参数 {
  build: 构建信息;
  databaseUrl?: string;
  sessionSecret?: string;
  env?: NodeJS.ProcessEnv;
}

type 字典 = Record<string, unknown>;
type 数据库查询器 = Pick<Pool, "query">;

interface 数据库行 extends 字典 {
  id: string;
  v2_source_id?: string | null;
  extra_json?: 字典 | null;
}

const 默认每页 = 1000;

const 业务模块映射: Record<string, 阶段9模块> = {
  registrations: "registrations",
  opportunities: "opportunities",
  quotes: "quotes",
  orders: "orders",
  partners: "partners",
  users: "users",
  notifications: "notifications",
  "pending-approvals": "approvals",
};

const 上传Excel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const V2导入类型列表 = ["partners", "staff", "registrations", "opportunities"] as const;
type V2导入类型 = (typeof V2导入类型列表)[number];
const V2导出类型列表 = [...V2导入类型列表, "orders"] as const;
type V2导出类型 = (typeof V2导出类型列表)[number];

interface V2导入模板配置 {
  name: string;
  sheetName: string;
  headers: string[];
  keys: string[];
  required: string[];
  example: string[];
  headerAliases?: Record<string, string[]>;
}

interface V2导入行 {
  rowIndex: number;
  data: 字典;
  errors: string[];
}

interface V2导入结果 {
  success: number;
  updated: number;
  profileUpdated: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
  batchId: string;
  taskId: string;
  totalCount: number;
  errorReportUrl: string;
  rows: V2导入行结果[];
}

interface V2导入字段差异 {
  字段: string;
  更新前: unknown;
  更新后: unknown;
}

interface V2导入行结果 {
  row: number;
  status: "created" | "updated" | "failed";
  message: string;
  targetId?: string;
  changedFields?: string[];
  changes?: V2导入字段差异[];
  before?: 字典 | null;
  after?: 字典 | null;
}

interface V2导入解析结果 {
  headers: string[];
  rows: V2导入行[];
  totalCount: number;
  errorCount: number;
  validCount: number;
  batchId: string;
}

interface V2渠道商引用 {
  uuid: string;
  id: string;
  name: string;
  region: string;
  city: string;
  bigRegion: string;
  statusCode?: string;
}

interface V2用户引用 {
  uuid: string;
  id: string;
  username: string;
  name: string;
  partnerId: string;
  partnerName: string;
  region: string;
  bigRegion: string;
}

interface V2报备引用 {
  uuid: string;
  id: string;
  customerName: string;
}

const V2渠道简介列 = [
  { header: "地址", key: "address" },
  { header: "老板", key: "bossName" },
  { header: "老板联系方式", key: "bossPhone" },
  { header: "成立时间", key: "establishedAt" },
  { header: "企业员工数量", key: "employeeCount" },
  { header: "注册资本", key: "registeredCapital" },
  { header: "实缴资本", key: "paidInCapital" },
  { header: "年营收额", key: "annualRevenue" },
  { header: "社保参保人数", key: "socialInsuranceCount" },
  { header: "经营状态", key: "businessStatus" },
  { header: "开票能力", key: "invoiceCapability" },
  { header: "法定代表人", key: "legalRepresentative" },
  { header: "统一社会信用代码", key: "unifiedSocialCreditCode" },
  { header: "经营范围", key: "businessScope" },
  { header: "资料来源", key: "dataSource" },
  { header: "主要客户或行业", key: "customerIndustries" },
  { header: "主要代理品牌", key: "agencyBrands" },
  { header: "授权产品线", key: "authorizedProducts" },
  { header: "资质认证", key: "qualifications" },
  { header: "典型客户", key: "typicalCustomers" },
  { header: "服务区域", key: "serviceAreas" },
  { header: "资料是否已核验", key: "verified" },
] as const;

const V2导入模板: Record<V2导入类型, V2导入模板配置> = {
  partners: {
    name: "渠道商导入模板",
    sheetName: "渠道商导入模板",
    headers: [
      "渠道商名称*",
      "合作级别",
      "所在区域*",
      "所在城市*",
      "大区",
      "联系人",
      "联系电话",
      "邮箱",
      "技术服务商类型",
      ...V2渠道简介列.map((item) => item.header),
    ],
    keys: [
      "name",
      "level",
      "region",
      "city",
      "bigRegion",
      "contact",
      "phone",
      "email",
      "techServiceType",
      ...V2渠道简介列.map((item) => item.key),
    ],
    required: ["name", "region", "city"],
    example: [
      "示例渠道商",
      "gold",
      "北区（政府企业）",
      "北京市",
      "大北区",
      "张总",
      "13800138000",
      "example@test.com",
      "提名技术服务商",
      "北京市海淀区示例路 88 号",
      "张总",
      "13800138000",
      "2018-06-01",
      "86 人",
      "3000 万元",
      "1800 万元",
      "5000 万元",
      "72 人",
      "存续",
      "专票和普票均可",
      "张三",
      "91110000XXXXXXXXXX",
      "软件销售、技术服务、系统集成",
      "渠道导入",
      "教育、医疗、制造",
      "联软、华为",
      "终端安全、安全网关",
      "信息安全服务资质、ISO9001",
      "某教育集团、某三甲医院",
      "北京市、北区（政府企业）",
      "是",
    ],
    headerAliases: {
      techServiceType: ["技术服务类型"],
      employeeCount: ["简介员工数量", "企业人数"],
      customerIndustries: ["主要客户行业", "主要客户/行业"],
      agencyBrands: ["代理品牌"],
      authorizedProducts: ["授权产品", "授权产品线"],
      qualifications: ["资质", "认证资质"],
      typicalCustomers: ["典型客户案例"],
      verified: ["资料已核验", "是否核验", "资料是否核验"],
    },
  },
  staff: {
    name: "员工导入模板",
    sheetName: "员工导入模板",
    headers: ["登录账号*", "员工姓名*", "所属渠道商名称*", "密码*", "手机号", "邮箱", "状态"],
    keys: ["username", "name", "partnerName", "password", "phone", "email", "status"],
    required: ["username", "name", "partnerName", "password"],
    example: [
      "zhangsan",
      "张三",
      "示例渠道商",
      "LrCRM@2026!",
      "13800138000",
      "zhangsan@test.com",
      "正常",
    ],
  },
  registrations: {
    name: "客户报备导入模板",
    sheetName: "客户报备导入模板",
    headers: [
      "客户名称*",
      "统一社会信用代码",
      "行业",
      "联系人",
      "联系电话",
      "负责员工姓名*",
      "所属渠道商名称*",
      "客户地址",
    ],
    keys: [
      "customer",
      "creditCode",
      "industry",
      "contact",
      "phone",
      "assignedStaffName",
      "partnerName",
      "address",
    ],
    required: ["customer", "assignedStaffName", "partnerName"],
    example: [
      "示例客户公司",
      "91110000XXXXXXXXXX",
      "科技",
      "李经理",
      "13800138001",
      "张三",
      "示例渠道商",
      "北京市朝阳区",
    ],
  },
  opportunities: {
    name: "商机导入模板",
    sheetName: "商机导入模板",
    headers: [
      "商机名称*",
      "客户名称*",
      "商机金额",
      "预计签约日期",
      "商机阶段",
      "行业",
      "联系人",
      "联系电话",
      "负责员工姓名*",
      "所属渠道商名称*",
      "备注",
    ],
    keys: [
      "name",
      "customer",
      "amount",
      "expectedClose",
      "stage",
      "industry",
      "contact",
      "phone",
      "assignedStaffName",
      "partnerName",
      "remark",
    ],
    required: ["name", "customer", "assignedStaffName", "partnerName"],
    example: [
      "示例客户安全项目",
      "示例客户公司",
      "50000",
      "2026-06-30",
      "1% 已联系上客户",
      "科技",
      "李经理",
      "13800138001",
      "张三",
      "示例渠道商",
      "重要项目",
    ],
  },
};

const V2导出配置: Record<V2导出类型, { fileName: string; sheetName: string; headers: string[] }> = {
  partners: {
    fileName: "渠道商导出.xlsx",
    sheetName: "渠道商",
    headers: [
      "渠道商ID",
      "渠道商名称",
      "合作级别",
      "渠道分销层级",
      "所在区域",
      "所在城市",
      "大区",
      "联系人",
      "联系电话",
      "邮箱",
      "技术服务类型",
      "状态",
      "加入日期",
      "员工数量",
      "报价数",
      "订单数",
      "累计金额",
      ...V2渠道简介列.map((item) => item.header),
    ],
  },
  staff: {
    fileName: "员工账号导出.xlsx",
    sheetName: "员工账号",
    headers: [
      "用户ID",
      "登录账号",
      "姓名",
      "角色",
      "所属渠道商ID",
      "所属渠道商名称",
      "区域",
      "大区",
      "手机",
      "邮箱",
      "状态",
      "创建时间",
    ],
  },
  registrations: {
    fileName: "客户报备导出.xlsx",
    sheetName: "客户报备",
    headers: [
      "报备ID",
      "客户名称",
      "统一社会信用代码",
      "行业",
      "联系人",
      "联系电话",
      "区域",
      "渠道商ID",
      "渠道商名称",
      "跟进员工ID",
      "跟进员工姓名",
      "状态",
      "报备日期",
      "保护到期日",
      "保护天数",
      "备注",
    ],
  },
  opportunities: {
    fileName: "商机导出.xlsx",
    sheetName: "商机",
    headers: [
      "商机ID",
      "商机名称",
      "客户名称",
      "行业",
      "联系人",
      "联系电话",
      "区域",
      "渠道商ID",
      "渠道商名称",
      "跟进员工ID",
      "跟进员工姓名",
      "阶段",
      "金额",
      "预计签约日期",
      "最近跟进日期",
      "来源",
      "标签",
      "备注",
      "创建时间",
    ],
  },
  orders: {
    fileName: "订单导出.xlsx",
    sheetName: "订单",
    headers: [
      "订单ID",
      "订单编号",
      "前置编号",
      "客户名称",
      "渠道商",
      "分销层级",
      "所属区域",
      "业务类型",
      "报价类型",
      "订单状态",
      "订单金额",
      "原价",
      "出货金额",
      "负责人",
      "创建时间",
      "更新时间",
      "收货人",
      "联系电话",
      "收货地址",
    ],
  },
};

export function 创建V2兼容路由(参数: V2兼容路由参数): Router {
  const router = createRouter();
  const pool = 参数.databaseUrl ? new Pool({ connectionString: 参数.databaseUrl, max: 10 }) : null;
  const service = 参数.databaseUrl ? 创建业务数据服务({ databaseUrl: 参数.databaseUrl }) : null;

  // 正式环境只信任服务端签发的 HttpOnly Cookie。历史 V2 令牌、
  // operatorId 查询参数和兼容请求头只能用于隔离测试环境，不能作为线上身份来源。
  router.use((req, _res, next) => {
    if (是V2公开接口(req) || 读取当前V2业务用户(req, 参数)) {
      next();
      return;
    }
    next(new 应用错误("V3_AUTH_REQUIRED", "请先登录后再访问业务接口。", 401));
  });

  // 审计、产品、账号等管理配置只允许超管；渠道维护仅额外放行本区域的区管。
  router.use(async (req, _res, next) => {
    try {
      if (!是V2管理配置接口(req)) {
        next();
        return;
      }
      const 用户 = 读取当前V2业务用户(req, 参数);
      const 上下文 = await 需要服务(service).读取当前用户上下文(用户);
      if (上下文?.roleCode === "superadmin") {
        next();
        return;
      }
      if (上下文?.roleCode === "region_manager" && 是区域管理员渠道维护接口(req)) {
        next();
        return;
      }
      if (上下文?.roleCode === "partner_admin" && 是渠道成员维护接口(req)) {
        next();
        return;
      }
      if (上下文?.roleCode !== "superadmin") {
        await 记录管理配置越权(pool, req, 用户, 上下文?.roleCode || "");
        throw new 应用错误("V3_ADMIN_CONFIG_FORBIDDEN", "当前账号无权访问该管理配置。", 403);
      }
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/auth/login",
    捕获(async (req, res) => {
      const db = 需要数据库(pool);
      const username = 读取正文文本(req.body, ["username"], "");
      const password = 读取正文文本(req.body, ["password"], "");
      if (!username || !password) {
        res.status(400).json(失败("请输入用户名和密码。"));
        return;
      }

      const 用户 = await 查询并校验V2用户(db, username, password);
      if (!用户) {
        res.status(401).json(失败("用户名或密码不正确。"));
        return;
      }

      const token = 签发V2令牌(用户.username, 用户.authorizationVersion);
      const dueReminders = await 需要服务(service).查询到期提醒({
        username: 用户.username,
        displayName: 用户.name || 用户.username,
        roleName: 用户.roleName || "历史业务用户",
      });
      写入正式页面可信Cookie会话(
        res,
        {
          username: 用户.username,
          role: 用户.role,
          authorizationVersion: 用户.authorizationVersion,
        },
        {
          sessionSecret: 参数.sessionSecret || "",
          ...(参数.env ? { env: 参数.env } : {}),
        },
      );
      res.json({
        success: true,
        user: 移除敏感字段(用户),
        token,
        notifications: [],
        dueReminders,
        build: 参数.build,
      });
    }),
  );

  router.get(
    "/auth/me",
    捕获(async (req, res) => {
      const db = 需要数据库(pool);
      const 当前用户 = 读取当前V2业务用户(req, 参数);
      const 用户 = 当前用户 ? await 查询V2用户(db, 当前用户.username) : null;
      if (!用户) {
        res.status(401).json(失败("请先登录。"));
        return;
      }
      const { passwordHash: _passwordHash, ...安全用户 } = 用户;
      res.json({
        success: true,
        user: 移除敏感字段(安全用户),
        token: 签发V2令牌(安全用户.username, 安全用户.authorizationVersion),
      });
    }),
  );

  router.put(
    "/auth/password",
    捕获(async (req, res) => {
      const db = 需要数据库(pool);
      const body = 读取正文(req);
      const oldPassword = 读取正文文本(body, ["oldPassword"], "");
      const newPassword = 读取正文文本(body, ["newPassword", "password"], "");
      if (!newPassword || newPassword.length < 6) {
        res.status(400).json(失败("新密码长度不能少于6位。"));
        return;
      }

      const 当前用户 = 读取当前V2业务用户(req, 参数);
      const 用户 = 当前用户 ? await 查询V2用户(db, 当前用户.username) : null;
      if (!用户?.id) {
        res.status(401).json(失败("请先登录。"));
        return;
      }
      if (oldPassword && 用户.passwordHash && !(await 校验密码(oldPassword, 用户.passwordHash))) {
        res.status(400).json(失败("当前密码不正确。"));
        return;
      }

      await 保存用户密码(db, 用户.id, newPassword, false);
      res.json(成功({ updated: true }));
    }),
  );

  router.get(
    "/oauth/config",
    捕获(async (_req, res) => {
      res.json({
        success: true,
        enabled: false,
        data: {
          enabled: false,
          provider: "disabled",
          authorizationUrl: "",
          clientId: "",
          redirectUri: "",
        },
      });
    }),
  );

  router.get(
    "/oauth/authorize",
    捕获(async (req, res) => {
      const returnUrl = 读取查询文本(req, "return") || "/login.html";
      res.redirect(returnUrl);
    }),
  );

  router.get(
    "/oauth/callback",
    捕获(async (_req, res) => {
      res.redirect("/login.html");
    }),
  );

  router.get(
    "/oauth/userinfo",
    捕获(async (req, res) => {
      const db = 需要数据库(pool);
      const 当前用户 = 读取当前V2业务用户(req, 参数);
      const 用户 = 当前用户 ? await 查询V2用户(db, 当前用户.username) : null;
      if (!用户) {
        res.status(401).json(失败("请先登录。"));
        return;
      }
      const { passwordHash: _passwordHash, ...安全用户 } = 用户;
      res.json(成功(移除敏感字段(安全用户)));
    }),
  );

  router.post(
    "/oauth/logout",
    捕获(async (_req, res) => {
      res.json(成功({ loggedOut: true }));
    }),
  );

  router.post(
    "/sso/iam/admin-login",
    捕获(async (req, res) => {
      res.json(await 单点登录降级响应(需要数据库(pool), req));
    }),
  );
  router.post(
    "/sso/iam/admin-login-v2",
    捕获(async (req, res) => {
      res.json(await 单点登录降级响应(需要数据库(pool), req));
    }),
  );
  router.post(
    "/sso/iam/partner-login-v2",
    捕获(async (req, res) => {
      res.json(await 单点登录降级响应(需要数据库(pool), req));
    }),
  );

  router.get(
    "/dashboard/stats",
    捕获(async (req, res) => {
      // V2 仪表盘与 V3 工作台必须使用同一套账号数据范围。
      // 历史实现直接对正式表做全量计数，区管和渠道账号会读到全国数据。
      const 用户 = 读取当前V2业务用户(req, 参数);
      const 概览 = await 需要服务(service).读取概览(用户);
      const 业务数量 = Object.fromEntries(概览.统计.map((项) => [项.标题, 项.数量])) as Record<
        string,
        number
      >;
      const [账号列表, 待审批列表] = await Promise.all([
        需要服务(service).查询列表("users", { page: 1, pageSize: 1 }, 用户),
        需要服务(service).查询列表("approvals", { status: "pending", page: 1, pageSize: 1 }, 用户),
      ]);
      res.json(
        成功({
          registrations: 业务数量["客户报备"] || 0,
          opportunities: 业务数量["商机"] || 0,
          quotes: 业务数量["报价单"] || 0,
          orders: 业务数量["订单"] || 0,
          partners: 业务数量["渠道商"] || 0,
          users: 账号列表.分页.总数,
          pendingApprovals: 待审批列表.分页.总数,
        }),
      );
    }),
  );

  注册审计日志路由(router, pool);

  router.use(["/approvals", "/pending-approvals"], (req, _res, next) => {
    const 用户 = 读取当前V2可信Cookie用户(req, 参数) || 读取当前V2业务用户(req, 参数);
    if (用户?.roleCode === "partner_admin" || 用户?.roleCode === "staff") {
      next(new 应用错误("V3_APPROVAL_CENTER_FORBIDDEN", "渠道账号不能访问审核中心。", 403));
      return;
    }
    next();
  });

  for (const [路径, 模块] of Object.entries(业务模块映射)) {
    router.get(
      `/${路径}`,
      捕获(async (req, res) => {
        const 当前用户 =
          模块 === "notifications" ? 读取当前V2认证用户(req, 参数) : 读取当前V2业务用户(req, 参数);
        if (模块 === "notifications" && !当前用户) {
          res.json(成功([]));
          return;
        }
        const 查询条件 = 读取阶段9查询(req);
        // 「待审批」入口只返回待办；已通过、已驳回记录只能从历史筛选或详情追溯。
        if (路径 === "pending-approvals") 查询条件.status = "pending";
        const 结果 = await 需要服务(service).查询列表(模块, 查询条件, 当前用户);
        res.json(成功(结果.数据.map((记录) => 转V2业务记录(模块, 记录))));
      }),
    );

    router.get(
      `/${路径}/:id`,
      捕获(async (req, res) => {
        const 当前用户 =
          模块 === "notifications" ? 读取当前V2认证用户(req, 参数) : 读取当前V2业务用户(req, 参数);
        if (模块 === "notifications" && !当前用户)
          throw new 应用错误("V3_MESSAGE_AUTH_REQUIRED", "请先登录后再查看消息。", 401);
        const 记录 = await 需要服务(service).查询详情(模块, 读取路由参数(req, "id"), 当前用户);
        res.json(成功(转V2业务记录(模块, 记录)));
      }),
    );
  }

  router.get(
    "/quotes/:id/pdf",
    捕获(async (req, res) => {
      const 文件 = await 需要服务(service).生成正式报价单(
        读取路由参数(req, "id"),
        读取当前V2业务用户(req, 参数),
      );
      res
        .status(200)
        .setHeader("Content-Type", "application/pdf")
        .setHeader("Content-Length", String(文件.内容.length))
        .setHeader(
          "Content-Disposition",
          `attachment; filename*=UTF-8''${encodeURIComponent(文件.文件名)}`,
        )
        .send(文件.内容);
    }),
  );

  router.post(
    "/registrations",
    捕获(async (req, res) => {
      const 记录 = await 需要服务(service).创建报备(读取正文(req), 读取当前V2业务用户(req, 参数));
      res.json(成功(转V2业务记录("registrations", 记录)));
    }),
  );

  router.put(
    "/registrations/:id/status",
    捕获(async (req, res) => {
      const 记录 = await 需要服务(service).更新报备状态(
        读取路由参数(req, "id"),
        读取正文(req),
        读取当前V2业务用户(req, 参数),
      );
      res.json(成功(转V2业务记录("registrations", 记录)));
    }),
  );

  router.put(
    "/registrations/:id",
    捕获(async (req, res) => {
      const 记录 = await 需要服务(service).更新报备(
        读取路由参数(req, "id"),
        读取正文(req),
        读取当前V2业务用户(req, 参数),
      );
      res.json(成功(转V2业务记录("registrations", 记录)));
    }),
  );

  router.delete(
    "/registrations/:id",
    捕获(async (req, res) => {
      await 软归档业务记录(需要数据库(pool), "crm.registrations", 读取路由参数(req, "id"));
      res.json(成功({ id: 读取路由参数(req, "id"), deleted: true }));
    }),
  );

  router.post(
    "/opportunities",
    捕获(async (req, res) => {
      const 记录 = await 需要服务(service).创建商机(读取正文(req), 读取当前V2业务用户(req, 参数));
      res.json(成功(转V2业务记录("opportunities", 记录)));
    }),
  );

  router.put(
    "/opportunities/:id",
    捕获(async (req, res) => {
      const 记录 = await 需要服务(service).更新商机(
        读取路由参数(req, "id"),
        读取正文(req),
        读取当前V2业务用户(req, 参数),
      );
      res.json(成功(转V2业务记录("opportunities", 记录)));
    }),
  );

  router.post(
    "/quotes/workload-preview",
    捕获(async (req, res) => {
      const 输入 = 读取正文(req);
      const 报价类型 = 解析报价类型(输入.quoteTypeCode ?? 输入.报价类型);
      const 试算 = 构建报价试算公开视图(await 需要服务(service).试算报价(输入), 报价类型);
      res.json(
        成功({
          ...试算,
          available: true,
          standardPersonDays: 试算.workloadDays,
          workloadEndpoints: 试算.endpoints,
          workloadClassifications: { matchedFeatureNames: 试算.items.map((项) => 项.名称) },
        }),
      );
    }),
  );

  router.post(
    "/ipg/quote-preview",
    捕获(async (req, res) => {
      const 输入 = 读取正文(req);
      const 报价类型 = 解析报价类型(输入.quoteTypeCode ?? 输入.报价类型);
      const features = await 查询IPG功能列表(需要数据库(pool), 输入);
      const preview = 计算IPG参考价({
        ...输入,
        features,
        featureIds: 读取IPG功能编号(输入),
        hardwareIds: 读取对象字符串数组(输入, "hardwareIds"),
      });
      res.json(成功(构建报价试算公开视图(preview, 报价类型)));
    }),
  );

  router.post(
    "/quotes",
    捕获(async (req, res) => {
      const 记录 = await 需要服务(service).创建报价(读取正文(req), 读取当前V2业务用户(req, 参数));
      res.json(成功(转V2业务记录("quotes", 记录)));
    }),
  );

  router.put(
    "/quotes/:id",
    捕获(async (req, res) => {
      const 记录 = await 需要服务(service).更新报价(
        读取路由参数(req, "id"),
        读取正文(req),
        读取当前V2业务用户(req, 参数),
      );
      res.json(成功(转V2业务记录("quotes", 记录)));
    }),
  );

  router.put(
    "/quotes/:id/status",
    捕获(async (req, res) => {
      const 记录 = await 需要服务(service).更新报价状态(
        读取路由参数(req, "id"),
        读取正文(req),
        读取当前V2业务用户(req, 参数),
      );
      res.json(成功(转V2业务记录("quotes", 记录)));
    }),
  );

  router.delete(
    "/quotes/:id",
    捕获(async (req, res) => {
      await 软归档业务记录(需要数据库(pool), "crm.quotes", 读取路由参数(req, "id"));
      res.json(成功({ id: 读取路由参数(req, "id"), deleted: true }));
    }),
  );

  router.post(
    "/orders",
    捕获(async (req, res) => {
      const 记录 = await 需要服务(service).创建订单(读取正文(req), 读取当前V2业务用户(req, 参数));
      res.json(成功(转V2业务记录("orders", 记录)));
    }),
  );

  router.put(
    "/orders/:id/status",
    捕获(async (req, res) => {
      const 记录 = await 需要服务(service).更新订单状态(
        读取路由参数(req, "id"),
        读取正文(req),
        读取当前V2业务用户(req, 参数),
      );
      res.json(成功(转V2业务记录("orders", 记录)));
    }),
  );
  router.put(
    "/orders/:id/resubmit",
    捕获(async (req, res) => {
      const 记录 = await 需要服务(service).重新提交订单(
        读取路由参数(req, "id"),
        读取正文(req),
        读取当前V2业务用户(req, 参数),
      );
      res.json(成功(转V2业务记录("orders", 记录)));
    }),
  );
  router.delete(
    "/orders/:id",
    捕获(async (req, res) => {
      await 软归档业务记录(需要数据库(pool), "crm.orders", 读取路由参数(req, "id"));
      res.json(成功({ id: 读取路由参数(req, "id"), deleted: true }));
    }),
  );
  router.put(
    "/orders/:id/price-adjust",
    捕获(async (req, res) => {
      const 记录 = await 需要服务(service).更新订单状态(
        读取路由参数(req, "id"),
        { ...读取正文(req), status: "pending_superadmin_confirm", action: "price_adjust" },
        读取当前V2可信Cookie用户(req, 参数),
      );
      res.json(成功(转V2业务记录("orders", 记录)));
    }),
  );

  router.put(
    "/orders/:id/primary-confirm",
    捕获(async (req, res) => {
      const 记录 = await 需要服务(service).更新订单状态(
        读取路由参数(req, "id"),
        { ...读取正文(req), status: "confirmed" },
        读取当前V2业务用户(req, 参数),
      );
      res.json(成功(转V2业务记录("orders", 记录)));
    }),
  );

  router.put(
    "/orders/:id/primary-reject",
    捕获(async (req, res) => {
      const 记录 = await 需要服务(service).更新订单状态(
        读取路由参数(req, "id"),
        { ...读取正文(req), status: "returned_to_secondary", returnTarget: "secondary" },
        读取当前V2业务用户(req, 参数),
      );
      res.json(成功(转V2业务记录("orders", 记录)));
    }),
  );

  注册产品路由(router, pool, service, 参数);
  注册工作量路由(router, pool, service, 参数);
  注册OpenApi路由(router, service, 参数);
  注册后台维护路由(router, pool, service, 参数);
  注册导入导出路由(router, pool, service, 参数);
  注册企业搜索路由(router, pool);
  注册移动兼容路由(router, pool, service, 参数);

  return router;
}

export function 创建V2导入导出兼容路由(参数: V2兼容路由参数): Router {
  const router = createRouter();
  const pool = 参数.databaseUrl ? new Pool({ connectionString: 参数.databaseUrl, max: 5 }) : null;
  const service = 参数.databaseUrl ? 创建业务数据服务({ databaseUrl: 参数.databaseUrl }) : null;
  注册导入导出路由(router, pool, service, 参数);
  return router;
}

function 注册审计日志路由(router: Router, pool: Pool | null) {
  router.get(
    "/audit-logs",
    捕获(async (req, res) => {
      const 查询 = 读取审计查询(req);
      const 结果 = await 查询V2审计日志列表(需要数据库(pool), 查询);
      res.json({ success: true, ...结果 });
    }),
  );

  router.get(
    "/audit-logs/export",
    捕获(async (req, res) => {
      const 查询 = 读取审计导出查询(req);
      const 结果 = await 查询V2审计日志列表(需要数据库(pool), 查询);
      const buffer = 生成审计导出CSV(结果.data.map(转审计导出行));
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(审计导出文件名())}`,
      );
      res.send(buffer);
    }),
  );

  router.get(
    "/audit-logs/:id",
    捕获(async (req, res) => {
      const 记录 = await 查询V2审计日志详情(需要数据库(pool), 读取路由参数(req, "id"));
      if (!记录) {
        res.status(404).json(失败("操作日志不存在。"));
        return;
      }
      res.json(成功(记录));
    }),
  );
}

function 注册产品路由(
  router: Router,
  pool: Pool | null,
  service: ReturnType<typeof 创建业务数据服务> | null,
  参数: V2兼容路由参数,
) {
  // 产品目录属于管理配置：读取按现有角色脱敏，所有写入只允许超级管理员。
  router.use(async (req, _res, next) => {
    try {
      const 是产品写接口 =
        !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
        /^\/(?:categories|modules|features|hardware|packages)(?:\/|$)/.test(req.path);
      if (!是产品写接口) {
        next();
        return;
      }
      const 用户 = 读取当前V2可信Cookie用户(req, 参数);
      const 上下文 = await 需要服务(service).读取当前用户上下文(用户);
      if (上下文?.roleCode !== "superadmin") {
        throw new 应用错误(
          "V3_PRODUCT_MAINTENANCE_FORBIDDEN",
          "只有超级管理员可以维护产品目录。",
          403,
        );
      }
      next();
    } catch (error) {
      next(error);
    }
  });
  router.get(
    "/product-tree",
    捕获(async (req, res) => {
      const 数据 = await 查询V2产品树(需要数据库(pool));
      res.json(成功(await 渠道用户隐藏产品价格(req, 参数, service, 数据)));
    }),
  );

  router.get(
    "/categories",
    捕获(async (_req, res) => {
      res.json(成功(await 查询V2产品大类(需要数据库(pool))));
    }),
  );
  router.get(
    "/categories/:id",
    捕获(async (req, res) => {
      const item = (await 查询V2产品大类(需要数据库(pool))).find(
        (row) => row.id === 读取路由参数(req, "id") || row.code === 读取路由参数(req, "id"),
      );
      if (!item) {
        res.status(404).json(失败("产品大类不存在。"));
        return;
      }
      res.json(成功(item));
    }),
  );
  router.post(
    "/categories",
    捕获(async (req, res) => {
      res.json(成功(await 保存V2产品大类(需要数据库(pool), "", 读取正文(req))));
    }),
  );
  router.put(
    "/categories/:id",
    捕获(async (req, res) => {
      res.json(
        成功(await 保存V2产品大类(需要数据库(pool), 读取路由参数(req, "id"), 读取正文(req))),
      );
    }),
  );
  router.delete(
    "/categories/:id",
    捕获(async (req, res) => {
      await 软归档产品记录(需要数据库(pool), "catalog.product_categories", 读取路由参数(req, "id"));
      res.json(成功({ id: 读取路由参数(req, "id"), deleted: true }));
    }),
  );

  router.get(
    "/modules",
    捕获(async (_req, res) => {
      res.json(成功(await 查询V2产品模块(需要数据库(pool))));
    }),
  );
  router.get(
    "/modules/:id",
    捕获(async (req, res) => {
      const item = (await 查询V2产品模块(需要数据库(pool))).find(
        (row) => row.id === 读取路由参数(req, "id") || row.code === 读取路由参数(req, "id"),
      );
      if (!item) {
        res.status(404).json(失败("产品模块不存在。"));
        return;
      }
      res.json(成功(item));
    }),
  );
  router.post(
    "/modules",
    捕获(async (req, res) => {
      res.json(成功(await 保存V2产品模块(需要数据库(pool), "", 读取正文(req))));
    }),
  );
  router.put(
    "/modules/:id",
    捕获(async (req, res) => {
      res.json(
        成功(await 保存V2产品模块(需要数据库(pool), 读取路由参数(req, "id"), 读取正文(req))),
      );
    }),
  );
  router.delete(
    "/modules/:id",
    捕获(async (req, res) => {
      await 软归档产品记录(需要数据库(pool), "catalog.product_modules", 读取路由参数(req, "id"));
      res.json(成功({ id: 读取路由参数(req, "id"), deleted: true }));
    }),
  );

  router.get(
    "/features",
    捕获(async (req, res) => {
      const 数据 = await 查询V2功能产品(需要数据库(pool));
      res.json(成功(await 渠道用户隐藏产品价格(req, 参数, service, 数据)));
    }),
  );
  router.get(
    "/features/:id",
    捕获(async (req, res) => {
      const item = (await 查询V2功能产品(需要数据库(pool))).find(
        (row) =>
          row.id === 读取路由参数(req, "id") ||
          row.uuid === 读取路由参数(req, "id") ||
          row.productCode === 读取路由参数(req, "id"),
      );
      if (!item) {
        res.status(404).json(失败("功能产品不存在。"));
        return;
      }
      res.json(成功(await 渠道用户隐藏产品价格(req, 参数, service, item)));
    }),
  );
  router.post(
    "/features",
    捕获(async (req, res) => {
      res.json(成功(await 保存V2功能产品(需要数据库(pool), "", 读取正文(req))));
    }),
  );
  router.put(
    "/features/:id",
    捕获(async (req, res) => {
      res.json(
        成功(await 保存V2功能产品(需要数据库(pool), 读取路由参数(req, "id"), 读取正文(req))),
      );
    }),
  );
  router.patch(
    "/features/:id/publish",
    捕获(async (req, res) => {
      const data = await 发布产品(
        需要数据库(pool),
        "catalog.product_features",
        读取路由参数(req, "id"),
        读取正文布尔(req.body, "published", true),
      );
      res.json(成功(data));
    }),
  );
  router.post(
    "/features/:id/publish",
    捕获(async (req, res) => {
      const data = await 发布产品(
        需要数据库(pool),
        "catalog.product_features",
        读取路由参数(req, "id"),
        读取正文布尔(req.body, "published", true),
      );
      res.json(成功(data));
    }),
  );
  router.put(
    "/features/:id/publish",
    捕获(async (req, res) => {
      const data = await 发布产品(
        需要数据库(pool),
        "catalog.product_features",
        读取路由参数(req, "id"),
        读取正文布尔(req.body, "published", true),
      );
      res.json(成功(data));
    }),
  );
  router.delete(
    "/features/:id",
    捕获(async (req, res) => {
      await 软归档产品记录(需要数据库(pool), "catalog.product_features", 读取路由参数(req, "id"));
      res.json(成功({ id: 读取路由参数(req, "id"), deleted: true }));
    }),
  );

  router.get(
    "/hardware",
    捕获(async (req, res) => {
      const 数据 = await 查询V2硬件产品(需要数据库(pool));
      res.json(成功(await 渠道用户隐藏产品价格(req, 参数, service, 数据)));
    }),
  );
  router.get(
    "/hardware/:id",
    捕获(async (req, res) => {
      const item = (await 查询V2硬件产品(需要数据库(pool))).find(
        (row) => row.id === 读取路由参数(req, "id") || row.model === 读取路由参数(req, "id"),
      );
      if (!item) {
        res.status(404).json(失败("硬件产品不存在。"));
        return;
      }
      res.json(成功(await 渠道用户隐藏产品价格(req, 参数, service, item)));
    }),
  );
  router.post(
    "/hardware",
    捕获(async (req, res) => {
      res.json(成功(await 保存V2硬件产品(需要数据库(pool), "", 读取正文(req))));
    }),
  );
  router.put(
    "/hardware/:id",
    捕获(async (req, res) => {
      res.json(
        成功(await 保存V2硬件产品(需要数据库(pool), 读取路由参数(req, "id"), 读取正文(req))),
      );
    }),
  );
  router.patch(
    "/hardware/:id/publish",
    捕获(async (req, res) => {
      const data = await 发布产品(
        需要数据库(pool),
        "catalog.hardware_products",
        读取路由参数(req, "id"),
        读取正文布尔(req.body, "published", true),
      );
      res.json(成功(data));
    }),
  );
  router.post(
    "/hardware/:id/publish",
    捕获(async (req, res) => {
      const data = await 发布产品(
        需要数据库(pool),
        "catalog.hardware_products",
        读取路由参数(req, "id"),
        读取正文布尔(req.body, "published", true),
      );
      res.json(成功(data));
    }),
  );
  router.put(
    "/hardware/:id/publish",
    捕获(async (req, res) => {
      const data = await 发布产品(
        需要数据库(pool),
        "catalog.hardware_products",
        读取路由参数(req, "id"),
        读取正文布尔(req.body, "published", true),
      );
      res.json(成功(data));
    }),
  );
  router.delete(
    "/hardware/:id",
    捕获(async (req, res) => {
      await 软归档产品记录(需要数据库(pool), "catalog.hardware_products", 读取路由参数(req, "id"));
      res.json(成功({ id: 读取路由参数(req, "id"), deleted: true }));
    }),
  );

  router.get(
    "/packages",
    捕获(async (req, res) => {
      const 数据 = await 查询V2产品套餐(需要数据库(pool));
      res.json(成功(await 渠道用户隐藏产品价格(req, 参数, service, 数据)));
    }),
  );
  router.get(
    "/packages/:id",
    捕获(async (req, res) => {
      const item = (await 查询V2产品套餐(需要数据库(pool))).find(
        (row) => row.id === 读取路由参数(req, "id") || row.code === 读取路由参数(req, "id"),
      );
      if (!item) {
        res.status(404).json(失败("产品套餐不存在。"));
        return;
      }
      res.json(成功(await 渠道用户隐藏产品价格(req, 参数, service, item)));
    }),
  );
  router.post(
    "/packages",
    捕获(async (req, res) => {
      res.json(成功(await 保存V2产品套餐(需要数据库(pool), "", 读取正文(req))));
    }),
  );
  router.put(
    "/packages/:id",
    捕获(async (req, res) => {
      res.json(
        成功(await 保存V2产品套餐(需要数据库(pool), 读取路由参数(req, "id"), 读取正文(req))),
      );
    }),
  );
  router.patch(
    "/packages/:id/publish",
    捕获(async (req, res) => {
      const data = await 发布产品(
        需要数据库(pool),
        "catalog.product_packages",
        读取路由参数(req, "id"),
        读取正文布尔(req.body, "published", true),
      );
      res.json(成功(data));
    }),
  );
  router.post(
    "/packages/:id/publish",
    捕获(async (req, res) => {
      const data = await 发布产品(
        需要数据库(pool),
        "catalog.product_packages",
        读取路由参数(req, "id"),
        读取正文布尔(req.body, "published", true),
      );
      res.json(成功(data));
    }),
  );
  router.put(
    "/packages/:id/publish",
    捕获(async (req, res) => {
      const data = await 发布产品(
        需要数据库(pool),
        "catalog.product_packages",
        读取路由参数(req, "id"),
        读取正文布尔(req.body, "published", true),
      );
      res.json(成功(data));
    }),
  );
  router.delete(
    "/packages/:id",
    捕获(async (req, res) => {
      await 软归档产品记录(需要数据库(pool), "catalog.product_packages", 读取路由参数(req, "id"));
      res.json(成功({ id: 读取路由参数(req, "id"), deleted: true }));
    }),
  );

  router.get(
    "/products/stats",
    捕获(async (_req, res) => {
      const db = 需要数据库(pool);
      const [categories, modules, features, hardware, packages] = await Promise.all([
        查询V2产品大类(db),
        查询V2产品模块(db),
        查询V2功能产品(db),
        查询V2硬件产品(db),
        查询V2产品套餐(db),
      ]);
      res.json(
        成功({
          categories: categories.length,
          modules: modules.length,
          features: features.length,
          hardware: hardware.length,
          packages: packages.length,
          total: features.length + hardware.length + packages.length,
        }),
      );
    }),
  );
}

function 注册工作量路由(
  router: Router,
  pool: Pool | null,
  service: ReturnType<typeof 创建业务数据服务> | null,
  参数: V2兼容路由参数,
) {
  router.get(
    "/workload/mappings",
    捕获(async (req, res) => {
      const data = await 需要服务(service).查询工作量映射(读取查询文本(req, "keyword") || "");
      res.json(成功(data));
    }),
  );
  router.post(
    "/workload/mappings",
    捕获(async (req, res) => {
      const productId = 读取正文文本(req.body, ["productId", "产品编号"], "");
      if (!productId) {
        throw new 应用错误("V3_WORKLOAD_PRODUCT_REQUIRED", "请选择需要维护工作量映射的产品。", 400);
      }
      const data = await 需要服务(service).保存工作量映射(
        productId,
        读取正文(req),
        读取当前V2业务用户(req, 参数),
      );
      res.json(成功(data));
    }),
  );
  router.put(
    "/workload/mappings/:id",
    捕获(async (req, res) => {
      const data = await 需要服务(service).保存工作量映射(
        读取路由参数(req, "id"),
        读取正文(req),
        读取当前V2业务用户(req, 参数),
      );
      res.json(成功(data));
    }),
  );
  router.delete(
    "/workload/mappings/:id",
    捕获(async (req, res) => {
      const data = await 需要服务(service).保存工作量映射(
        读取路由参数(req, "id"),
        { deleteMode: true, active: false },
        读取当前V2业务用户(req, 参数),
      );
      res.json(成功(data));
    }),
  );
  router.get(
    "/workload/delivery-rules",
    捕获(async (_req, res) => {
      res.json(成功(await 需要服务(service).查询交付工作量规则()));
    }),
  );
  router.put(
    "/workload/delivery-rules/:id",
    捕获(async (req, res) => {
      const data = await 需要服务(service).保存交付工作量规则(
        读取路由参数(req, "id"),
        读取正文(req),
        读取当前V2业务用户(req, 参数),
      );
      res.json(成功(data));
    }),
  );
  router.get(
    "/workload/rules",
    捕获(async (_req, res) => {
      res.json(成功(await 查询旧版工作量规则(需要数据库(pool))));
    }),
  );
  router.post(
    "/workload/rules",
    捕获(async (req, res) => {
      const data = await 保存旧版工作量规则(需要数据库(pool), "", 读取正文(req));
      res.json(成功(data));
    }),
  );
  router.put(
    "/workload/rules/:id",
    捕获(async (req, res) => {
      const data = await 保存旧版工作量规则(
        需要数据库(pool),
        读取路由参数(req, "id"),
        读取正文(req),
      );
      res.json(成功(data));
    }),
  );
  router.delete(
    "/workload/rules/:id",
    捕获(async (req, res) => {
      await 删除旧版工作量规则(需要数据库(pool), 读取路由参数(req, "id"));
      res.json(成功({ id: 读取路由参数(req, "id"), deleted: true }));
    }),
  );
}

function 注册OpenApi路由(
  router: Router,
  service: ReturnType<typeof 创建业务数据服务> | null,
  参数: V2兼容路由参数,
) {
  router.get(
    "/open-api/overview",
    捕获(async (req, res) => {
      res.json(成功(await 需要服务(service).读取开放接口总览(读取接口基准地址(req))));
    }),
  );
  router.get(
    "/open-api/clients",
    捕获(async (_req, res) => {
      res.json(成功(await 需要服务(service).查询开放接口客户端()));
    }),
  );
  router.get(
    "/open-api/logs",
    捕获(async (req, res) => {
      res.json(成功(await 需要服务(service).查询开放接口日志(读取正整数(req, "limit", 80))));
    }),
  );
  router.post(
    "/open-api/clients",
    捕获(async (req, res) => {
      res.json(
        成功(
          await 需要服务(service).创建开放接口客户端(读取正文(req), 读取当前V2业务用户(req, 参数)),
        ),
      );
    }),
  );
  router.put(
    "/open-api/clients/:id",
    捕获(async (req, res) => {
      const data = await 需要服务(service).更新开放接口客户端(
        读取路由参数(req, "id"),
        读取正文(req),
        读取当前V2业务用户(req, 参数),
      );
      res.json(成功(data));
    }),
  );
  router.post(
    "/open-api/clients/:id/reset-secret",
    捕获(async (req, res) => {
      const data = await 需要服务(service).重置开放接口密钥(
        读取路由参数(req, "id"),
        读取当前V2业务用户(req, 参数),
      );
      res.json(成功(data));
    }),
  );
}

function 注册后台维护路由(
  router: Router,
  pool: Pool | null,
  service: ReturnType<typeof 创建业务数据服务> | null,
  参数: V2兼容路由参数,
) {
  router.post(
    "/partners",
    捕获(async (req, res) => {
      const 维护身份 = await 读取渠道维护身份(service, req, 参数);
      res.json(
        成功(
          await 保存V2渠道商(
            需要数据库(pool),
            "",
            读取正文(req),
            读取当前V2业务用户(req, 参数),
            维护身份,
            req,
          ),
        ),
      );
    }),
  );
  router.put(
    "/partners/:id",
    捕获(async (req, res) => {
      res.json(
        成功(
          await 保存V2渠道商(
            需要数据库(pool),
            读取路由参数(req, "id"),
            读取正文(req),
            读取当前V2业务用户(req, 参数),
          ),
        ),
      );
    }),
  );
  router.delete(
    "/partners/:id",
    捕获(async (req, res) => {
      await 更新渠道商状态(
        需要数据库(pool),
        读取路由参数(req, "id"),
        "archived",
        读取正文(req),
        读取当前V2业务用户(req, 参数),
      );
      res.json(成功({ id: 读取路由参数(req, "id"), deleted: true }));
    }),
  );
  router.put(
    "/partners/:id/status",
    捕获(async (req, res) => {
      res.json(
        成功(
          await 更新渠道商状态(
            需要数据库(pool),
            读取路由参数(req, "id"),
            读取正文文本(读取正文(req), ["status"], "active"),
            读取正文(req),
            读取当前V2业务用户(req, 参数),
          ),
        ),
      );
    }),
  );

  router.post(
    "/partners/:id/staff",
    捕获(async (req, res) => {
      const data = await 保存渠道商员工(
        需要数据库(pool),
        读取路由参数(req, "id"),
        "",
        读取正文(req),
        读取当前V2业务用户(req, 参数),
      );
      res.json(成功(data));
    }),
  );
  router.put(
    "/partners/:id/level",
    捕获(async (req, res) => {
      const 维护身份 = await 读取渠道维护身份(service, req, 参数);
      const data = await 保存渠道商分销层级(
        需要数据库(pool),
        读取路由参数(req, "id"),
        读取正文(req),
        维护身份,
        req,
      );
      res.json(成功(data));
    }),
  );
  router.get(
    "/partners/:id/business-summary",
    捕获(async (req, res) => {
      const id = 读取路由参数(req, "id");
      const 当前用户 = 读取当前V2业务用户(req, 参数);
      const 用户上下文 = await 需要服务(service).读取当前用户上下文(当前用户);
      await 校验渠道自身经营数据范围(需要数据库(pool), id, 用户上下文);
      const 摘要 = await 需要服务(service).查询渠道经营摘要(id, 当前用户);
      res.json(成功(摘要));
    }),
  );
  router.get(
    "/partners/:id/order-target",
    捕获(async (req, res) => {
      const id = 读取路由参数(req, "id");
      const 当前用户 = 读取当前V2业务用户(req, 参数);
      const 用户上下文 = await 需要服务(service).读取当前用户上下文(当前用户);
      await 校验渠道自身经营数据范围(需要数据库(pool), id, 用户上下文);
      const 可编辑 = await 是否可维护渠道商(需要数据库(pool), 需要服务(service), req, 参数, id);
      const 目标 = await 查询渠道年度订单目标(需要数据库(pool), id, req.query.year);
      const 实际订单金额 = await 查询渠道实际订单金额(需要数据库(pool), id, 目标.year);
      res.json(
        成功({
          ...目标,
          actualOrderAmount: 查询目标实际完成金额(实际订单金额),
          canEdit: 可编辑,
        }),
      );
    }),
  );
  router.put(
    "/partners/:id/order-target",
    捕获(async (req, res) => {
      const 维护身份 = await 读取渠道维护身份(service, req, 参数);
      res.json(
        成功(
          await 保存渠道年度订单目标(
            需要数据库(pool),
            读取路由参数(req, "id"),
            读取正文(req),
            维护身份,
            req,
          ),
        ),
      );
    }),
  );
  router.get(
    "/partners/:id/profile",
    捕获(async (req, res) => {
      const id = 读取路由参数(req, "id");
      const 当前用户 = 读取当前V2业务用户(req, 参数);
      const 用户上下文 = await 需要服务(service).读取当前用户上下文(当前用户);
      // 区管只能读取本区域渠道档案；不能通过猜编号绕过列表范围。
      if (用户上下文?.roleCode === "region_manager") {
        await 校验渠道商维护范围(需要数据库(pool), id, 用户上下文);
      }
      const 档案关系 = 用户上下文
        ? await 解析渠道档案关系(需要数据库(pool), id, 用户上下文)
        : "internal";
      const 是上下级只读 = 档案关系 === "parent" || 档案关系 === "child";
      const 可编辑 = await 是否可维护渠道商(需要数据库(pool), 需要服务(service), req, 参数, id);
      const [简介, 经营摘要, 订单目标] = await Promise.all([
        查询渠道商简介(需要数据库(pool), id, {
          canEditProfile: 可编辑,
          canMaintainLevel: 可编辑,
          relationship: 档案关系,
        }),
        是上下级只读 ? Promise.resolve(null) : 需要服务(service).查询渠道经营摘要(id, 当前用户),
        是上下级只读
          ? Promise.resolve({
              year: new Date().getFullYear(),
              targetAmount: 0,
              remark: "",
              updatedAt: "",
            })
          : 查询渠道年度订单目标(需要数据库(pool), id),
      ]);
      const 实际订单金额 = 是上下级只读
        ? 0
        : await 查询渠道实际订单金额(需要数据库(pool), id, 订单目标.year);
      res.json(
        成功({
          ...简介,
          businessSummary: 经营摘要,
          ...订单目标,
          actualOrderAmount: 查询目标实际完成金额(实际订单金额),
          canEditOrderTarget: 可编辑 && !是上下级只读,
        }),
      );
    }),
  );
  router.put(
    "/partners/:id/profile",
    捕获(async (req, res) => {
      const 维护身份 = await 读取渠道维护身份(service, req, 参数);
      res.json(
        成功(
          await 保存渠道商简介(
            需要数据库(pool),
            读取路由参数(req, "id"),
            读取正文(req),
            维护身份,
            req,
          ),
        ),
      );
    }),
  );
  router.put(
    "/partners/:partnerId/staff/:staffId",
    捕获(async (req, res) => {
      const data = await 保存渠道商员工(
        需要数据库(pool),
        读取路由参数(req, "partnerId"),
        读取路由参数(req, "staffId"),
        读取正文(req),
        读取当前V2业务用户(req, 参数),
      );
      res.json(成功(data));
    }),
  );
  router.put(
    "/partners/:partnerId/staff/:staffId/status",
    捕获(async (req, res) => {
      const data = await 更新渠道商员工状态(
        需要数据库(pool),
        读取路由参数(req, "partnerId"),
        读取路由参数(req, "staffId"),
        读取正文文本(读取正文(req), ["status"], "active"),
        读取当前V2业务用户(req, 参数),
      );
      res.json(成功(data));
    }),
  );
  router.put(
    "/partners/:partnerId/staff/:staffId/password",
    捕获(async (req, res) => {
      const data = await 更新用户密码(
        需要数据库(pool),
        读取路由参数(req, "staffId"),
        读取正文文本(读取正文(req), ["password", "newPassword"], "LrCRM@2026!"),
        读取路由参数(req, "partnerId"),
        读取当前V2业务用户(req, 参数),
      );
      res.json(成功(data));
    }),
  );
  router.delete(
    "/partners/:partnerId/staff/:staffId",
    捕获(async (req, res) => {
      const data = await 删除渠道商员工(
        需要数据库(pool),
        读取路由参数(req, "partnerId"),
        读取路由参数(req, "staffId"),
        读取当前V2业务用户(req, 参数),
      );
      res.json(成功(data));
    }),
  );

  router.post(
    "/users",
    捕获(async (req, res) => {
      res.json(
        成功(
          await 保存内部账号(
            需要数据库(pool),
            "",
            读取正文(req),
            读取请求会话用户名(req, {
              sessionSecret: 参数.sessionSecret || "",
              ...(参数.env ? { env: 参数.env } : {}),
            }),
          ),
        ),
      );
    }),
  );
  router.post(
    "/admin/accounts",
    捕获(async (req, res) => {
      res.json(
        成功(
          await 保存内部账号(
            需要数据库(pool),
            "",
            读取正文(req),
            读取请求会话用户名(req, {
              sessionSecret: 参数.sessionSecret || "",
              ...(参数.env ? { env: 参数.env } : {}),
            }),
            { 同步管理组织: true },
          ),
        ),
      );
    }),
  );
  router.put(
    "/users/:id",
    捕获(async (req, res) => {
      res.json(成功(await 保存V2用户(需要数据库(pool), 读取路由参数(req, "id"), 读取正文(req))));
    }),
  );
  router.put(
    "/users/:id/status",
    捕获(async (req, res) => {
      res.json(
        成功(
          await 更新用户状态(
            需要数据库(pool),
            读取路由参数(req, "id"),
            读取正文文本(读取正文(req), ["status"], "active"),
          ),
        ),
      );
    }),
  );
  router.put(
    "/users/:id/password",
    捕获(async (req, res) => {
      res.json(
        成功(
          await 更新用户密码(
            需要数据库(pool),
            读取路由参数(req, "id"),
            读取正文文本(读取正文(req), ["password", "newPassword"], "LrCRM@2026!"),
          ),
        ),
      );
    }),
  );
  router.delete(
    "/users/:id",
    捕获(async (req, res) => {
      await 更新用户状态(需要数据库(pool), 读取路由参数(req, "id"), "disabled");
      res.json(成功({ id: 读取路由参数(req, "id"), deleted: true }));
    }),
  );

  router.put(
    "/pending-approvals/:id",
    捕获(async (req, res) => {
      const action = 读取正文文本(读取正文(req), ["action"], "approve");
      const status =
        action === "reject" ? "rejected" : action === "resubmit" ? "pending" : "approved";
      const data = await 更新待审批状态(
        需要数据库(pool),
        读取路由参数(req, "id"),
        status,
        读取正文(req),
        读取当前V2业务用户(req, 参数),
      );
      res.json(成功(data));
    }),
  );

  router.get(
    "/open-api/docs",
    捕获(async (req, res) => {
      res.json(成功(构建开放接口文档清单(读取接口基准地址(req))));
    }),
  );
  router.get(
    "/open-api/docs/:id/download",
    捕获(async (req, res) => {
      发送开放接口文档(res, 读取路由参数(req, "id"), 读取接口基准地址(req));
    }),
  );

  router.get(
    "/workload/classifications",
    捕获(async (_req, res) => {
      res.json(成功(await 查询工作量分类(需要数据库(pool))));
    }),
  );

  router.get(
    "/partner-profile-products",
    捕获(async (_req, res) => {
      res.json(成功(await 查询简介产品配置(需要数据库(pool))));
    }),
  );
  router.post(
    "/partner-profile-products",
    捕获(async (req, res) => {
      res.json(成功(await 保存简介产品配置(需要数据库(pool), "", 读取正文(req))));
    }),
  );
  router.put(
    "/partner-profile-products/:id",
    捕获(async (req, res) => {
      res.json(
        成功(await 保存简介产品配置(需要数据库(pool), 读取路由参数(req, "id"), 读取正文(req))),
      );
    }),
  );
  router.delete(
    "/partner-profile-products/:id",
    捕获(async (req, res) => {
      await 删除简介产品配置(需要数据库(pool), 读取路由参数(req, "id"));
      res.json(成功({ id: 读取路由参数(req, "id"), deleted: true }));
    }),
  );

  router.get(
    "/meta/prefecture-cities",
    捕获(async (_req, res) => {
      res.json(成功(await 查询地市元数据(需要数据库(pool))));
    }),
  );

  router.get(
    "/meta/city-options",
    捕获(async (_req, res) => {
      res.json(成功({ items: 列出标准地市名称() }));
    }),
  );

  router.get(
    "/approvals",
    捕获(async (req, res) => {
      const 结果 = await 需要服务(service).查询列表(
        "approvals",
        读取阶段9查询(req),
        读取当前V2业务用户(req, 参数),
      );
      res.json(成功(结果.数据.map((记录) => 转V2业务记录("approvals", 记录))));
    }),
  );

  router.get(
    "/approvals/:id",
    捕获(async (req, res) => {
      // 审批历史与待审批入口必须都能按业务编号追溯详情，避免列表有记录但详情 404。
      const 记录 = await 需要服务(service).查询详情(
        "approvals",
        读取路由参数(req, "id"),
        读取当前V2业务用户(req, 参数),
      );
      res.json(成功(转V2业务记录("approvals", 记录)));
    }),
  );
}

function 注册导入导出路由(
  router: Router,
  pool: Pool | null,
  service: ReturnType<typeof 创建业务数据服务> | null,
  参数: V2兼容路由参数,
) {
  router.get(
    "/export/audit",
    捕获(async (req, res) => {
      const 查询 = 读取审计导出查询(req);
      const 结果 = await 查询V2审计日志列表(需要数据库(pool), 查询);
      const buffer = 生成审计导出CSV(结果.data.map(转审计导出行));
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(审计导出文件名())}`,
      );
      res.send(buffer);
    }),
  );
  router.get(
    "/export/:type",
    捕获(async (req, res) => {
      const type = 读取导出类型(读取路由参数(req, "type"));
      const data = await 查询导出数据(需要服务(service), type, req, 参数);
      const config = V2导出配置[type];
      const buffer = 生成ExcelBuffer(
        config.sheetName,
        config.headers,
        data.map((item) => 构建导出行(type, item)),
      );
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(config.fileName)}`,
      );
      res.send(buffer);
    }),
  );
  router.get(
    "/import/:type/template",
    捕获(async (req, res) => {
      const type = 读取导入类型(读取路由参数(req, "type"));
      const buffer = 生成导入模板Excel(type);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(V2导入模板[type].name + ".xlsx")}`,
      );
      res.send(buffer);
    }),
  );
  router.post(
    "/import/:type/preview",
    上传Excel.single("file"),
    捕获(async (req, res) => {
      const type = 读取导入类型(读取路由参数(req, "type"));
      const file = 读取上传文件(req);
      const 结果 = await 解析导入Excel(需要数据库(pool), type, file);
      res.json({
        success: true,
        batchId: 结果.batchId,
        preview: 结果.rows.slice(0, 50),
        totalCount: 结果.totalCount,
        previewCount: Math.min(结果.rows.length, 50),
        errorCount: 结果.errorCount,
        validCount: 结果.validCount,
        headers: 结果.headers,
      });
    }),
  );
  router.post(
    "/import/:type/execute",
    上传Excel.single("file"),
    捕获(async (req, res) => {
      const type = 读取导入类型(读取路由参数(req, "type"));
      const file = 读取上传文件(req);
      const 结果 = await 执行导入Excel(
        需要数据库(pool),
        type,
        file,
        读取当前V2业务用户(req, 参数)?.username || "",
        读取当前V2业务用户(req, 参数),
      );
      const 成功条数 = 结果.success + 结果.updated;
      if (成功条数 === 0) {
        res.status(422).json({
          success: false,
          error: "本次导入没有任何有效数据写入，请根据错误报告修正后重新导入。",
          code: "V2_IMPORT_ALL_FAILED",
          results: 结果,
        });
        return;
      }
      res.json({
        success: true,
        message: `导入完成：新增 ${结果.success} 条，更新 ${结果.updated} 条，失败 ${结果.failed} 条`,
        results: 结果,
      });
    }),
  );
  router.get(
    "/import/tasks/:id",
    捕获(async (req, res) => {
      const 任务 = await 查询导入任务(需要数据库(pool), 读取路由参数(req, "id"));
      if (!任务) throw Object.assign(new Error("导入任务不存在。"), { statusCode: 404 });
      res.json({ success: true, task: 任务 });
    }),
  );
  router.get(
    "/import/tasks/:id/errors.csv",
    捕获(async (req, res) => {
      const 任务 = await 查询导入任务(需要数据库(pool), 读取路由参数(req, "id"));
      if (!任务) throw Object.assign(new Error("导入任务不存在。"), { statusCode: 404 });
      const buffer = 生成导入错误报告Csv(任务);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(`导入错误报告-${任务.batchId}.csv`)}`,
      );
      res.send(buffer);
    }),
  );
}

function 注册企业搜索路由(router: Router, pool: Pool | null) {
  router.get(
    "/company-search",
    捕获(async (req, res) => {
      const keyword = 读取查询文本(req, "keyword") || 读取查询文本(req, "q");
      if (!keyword || keyword.length < 2) {
        res.json(成功([]));
        return;
      }
      res.json(成功(await 查询本地企业(需要数据库(pool), keyword)));
    }),
  );
}

function 注册移动兼容路由(
  router: Router,
  pool: Pool | null,
  service: ReturnType<typeof 创建业务数据服务> | null,
  参数: V2兼容路由参数,
) {
  router.get(
    "/mobile/v2/me",
    捕获(async (_req, res) => {
      res.json(成功({ id: "mobile", name: "移动端用户", role: "staff" }));
    }),
  );
  router.get(
    "/mobile/v2/feature-flags",
    捕获(async (_req, res) => {
      res.json(成功({ registration: true, opportunity: true, quote: true, order: true }));
    }),
  );
  router.get(
    "/mobile/v2/dashboard",
    捕获(async (req, res) => {
      res.json(成功(await 需要服务(service).读取概览(读取当前V2业务用户(req, 参数))));
    }),
  );
  router.get(
    "/mobile/v2/notifications",
    捕获(async (req, res) => {
      const 结果 = await 需要服务(service).查询列表(
        "notifications",
        读取阶段9查询(req),
        读取当前V2业务用户(req, 参数),
      );
      res.json(成功(结果.数据.map((记录) => 转V2业务记录("notifications", 记录))));
    }),
  );
  router.get(
    "/mobile/v2/catalog",
    捕获(async (req, res) => {
      void req;
      const db = 需要数据库(pool);
      const [features, hardware, packages, productTree] = await Promise.all([
        查询V2功能产品(db),
        查询V2硬件产品(db),
        查询V2产品套餐(db),
        查询V2产品树(db),
      ]);
      res.json(
        成功(
          await 渠道用户隐藏产品价格(req, 参数, service, {
            features,
            hardware,
            packages,
            productTree,
          }),
        ),
      );
    }),
  );
  router.post(
    "/mobile/v2/logout",
    捕获(async (_req, res) => {
      res.json(成功({ loggedOut: true }));
    }),
  );
  router.get(
    "/mobile/company-search",
    捕获(async (req, res) => {
      const keyword = 读取查询文本(req, "keyword") || 读取查询文本(req, "q");
      if (!keyword) {
        res.json(成功([]));
        return;
      }
      res.json(成功(await 查询本地企业(需要数据库(pool), keyword)));
    }),
  );

  for (const module of [
    "registrations",
    "opportunities",
    "quotes",
    "orders",
    "partners",
  ] as const) {
    router.get(
      `/mobile/v2/${module}`,
      捕获(async (req, res) => {
        const 结果 = await 需要服务(service).查询列表(
          module,
          读取阶段9查询(req),
          读取当前V2业务用户(req, 参数),
        );
        res.json(成功(结果.数据.map((记录) => 转V2业务记录(module, 记录))));
      }),
    );
    router.get(
      `/mobile/v2/${module}/:id`,
      捕获(async (req, res) => {
        const 记录 = await 需要服务(service).查询详情(
          module,
          读取路由参数(req, "id"),
          读取当前V2业务用户(req, 参数),
        );
        res.json(成功(转V2业务记录(module, 记录)));
      }),
    );
    router.get(
      `/mobile/${module}`,
      捕获V2移动端兼容(async (req, res) => {
        const 结果 = await 需要服务(service).查询列表(
          module,
          读取阶段9查询(req),
          读取当前V2业务用户(req, 参数),
        );
        res.json(成功(结果.数据.map((记录) => 转V2业务记录(module, 记录))));
      }),
    );
    router.get(
      `/mobile/${module}/:id`,
      捕获V2移动端兼容(async (req, res) => {
        const 记录 = await 需要服务(service).查询详情(
          module,
          读取路由参数(req, "id"),
          读取当前V2业务用户(req, 参数),
        );
        res.json(成功(转V2业务记录(module, 记录)));
      }),
    );
  }
}

// 新移动端使用 v3m 会话令牌，旧兼容接口只接受 V2 会话或 V2 令牌。
// 命中新移动端令牌时交给后续业务路由处理，避免旧路由先注册后把请求截获为 404。
function 捕获V2移动端兼容(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (/^Bearer\s+v3m\./i.test(req.headers.authorization || "")) {
      next();
      return;
    }
    捕获(handler)(req, res, next);
  };
}

function 捕获(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, _next?: NextFunction) => {
    handler(req, res).catch((error: unknown) => {
      const record = error as { message?: string; statusCode?: number };
      res
        .status(record.statusCode || 500)
        .json(失败(record.message || "系统处理失败，请联系管理员。"));
    });
  };
}

function 成功<T>(data: T) {
  return { success: true, data: 移除敏感字段(data) };
}

function 失败(error: string) {
  return { success: false, error };
}

function 需要数据库(pool: Pool | null): Pool {
  if (!pool) throw Object.assign(new Error("V2兼容接口必须连接PostgreSQL。"), { statusCode: 503 });
  return pool;
}

function 需要服务<T>(service: T | null): T {
  if (!service)
    throw Object.assign(new Error("V2兼容业务服务必须连接PostgreSQL。"), { statusCode: 503 });
  return service;
}

async function 查询并校验V2用户(pool: Pool, username: string, password: string) {
  const 用户 = await 查询V2用户(pool, username);
  if (!用户?.passwordHash || !(await 校验密码(password, 用户.passwordHash))) return null;
  const { passwordHash: _passwordHash, ...安全用户 } = 用户;
  return 安全用户;
}

async function 查询V2用户(pool: 数据库查询器, username: string, 包含停用账号 = false) {
  const result = await pool.query<{
    id: string;
    v2_source_id: string | null;
    username: string;
    display_name: string | null;
    password_hash: string | null;
    status_code: string;
    role_code: string | null;
    role_name: string | null;
    region_name: string | null;
    extra_json: 字典 | null;
    partner_id: string | null;
    partner_name: string | null;
    row_version: number;
    role_codes: string[] | null;
  }>(
    `
    SELECT
      u.id::text AS id,
      u.v2_source_id,
      u.username::text AS username,
      u.display_name,
      pc.password_hash,
      u.status_code,
      u.row_version::int AS row_version,
      ARRAY_REMOVE(ARRAY_AGG(DISTINCT r.role_code) FILTER (WHERE r.role_code IS NOT NULL), NULL) AS role_codes,
      COALESCE((array_agg(r.role_code ORDER BY
        CASE r.role_code
          WHEN 'superadmin' THEN 1
          WHEN 'admin' THEN 2
          WHEN 'region_manager' THEN 3
          WHEN 'partner_admin' THEN 4
          ELSE 5
        END
      ) FILTER (WHERE r.role_code IS NOT NULL))[1], u.extra_json->>'role', 'staff') AS role_code,
      COALESCE((array_agg(r.role_name ORDER BY
        CASE r.role_code
          WHEN 'superadmin' THEN 1
          WHEN 'admin' THEN 2
          WHEN 'region_manager' THEN 3
          WHEN 'partner_admin' THEN 4
          ELSE 5
        END
      ) FILTER (WHERE r.role_name IS NOT NULL))[1], '') AS role_name,
      reg.region_name,
      u.extra_json,
      COALESCE((u.extra_json->>'partnerId'), p.v2_source_id, p.partner_code, p.id::text) AS partner_id,
      COALESCE((u.extra_json->>'partnerName'), p.partner_name) AS partner_name
    FROM iam.users u
    LEFT JOIN iam.password_credentials pc ON pc.user_id = u.id
    LEFT JOIN iam.user_roles ur ON ur.user_id = u.id
    LEFT JOIN iam.roles r ON r.id = ur.role_id AND r.status_code = 'active'
    LEFT JOIN org.regions reg ON reg.id = u.region_id
    LEFT JOIN channel.partner_members pm ON pm.user_id = u.id AND pm.archived_at IS NULL
    LEFT JOIN channel.partners p ON p.id = pm.partner_id
    WHERE lower(u.username::text) = lower($1)
      AND ($2 OR u.status_code = 'active')
    GROUP BY u.id, u.v2_source_id, u.username, u.display_name, pc.password_hash, u.status_code, u.row_version,
      reg.region_name, u.extra_json, p.v2_source_id, p.partner_code, p.id, p.partner_name
    LIMIT 1
    `,
    [username, 包含停用账号],
  );
  const row = result.rows[0];
  if (!row) return null;
  const extra = row.extra_json || {};
  const role = 转V2角色(row.role_code || 读取对象文本(extra, "role") || "staff");
  const id = 读取对象文本(extra, "id") || row.v2_source_id || row.id;
  return {
    ...extra,
    id,
    userId: id,
    username: row.username,
    name: 读取对象文本(extra, "name") || row.display_name || row.username,
    displayName: row.display_name || 读取对象文本(extra, "name") || row.username,
    role,
    roleName: row.role_name || 转V2角色名称(role),
    roleCodes: Array.isArray(row.role_codes) ? row.role_codes : [],
    status: extra.status || row.status_code,
    region: 读取对象文本(extra, "region") || row.region_name || "",
    bigRegion: 读取对象文本(extra, "bigRegion"),
    partnerId: 读取对象文本(extra, "partnerId") || row.partner_id || "",
    partnerName: 读取对象文本(extra, "partnerName") || row.partner_name || "",
    authorizationVersion: row.row_version,
    passwordHash: row.password_hash || "",
  };
}

async function 查询首个管理员(pool: Pool) {
  const result = await pool.query<{ username: string }>(
    `
    SELECT u.username::text AS username
    FROM iam.users u
    LEFT JOIN iam.user_roles ur ON ur.user_id = u.id
    LEFT JOIN iam.roles r ON r.id = ur.role_id
    WHERE u.status_code = 'active'
      AND (r.role_code IN ('superadmin','admin','region_manager') OR u.extra_json->>'role' IN ('superadmin','admin'))
    ORDER BY CASE WHEN u.username = 'admin' THEN 0 ELSE 1 END, u.username
    LIMIT 1
    `,
  );
  const username = result.rows[0]?.username;
  return username ? 查询V2用户(pool, username) : null;
}

function 转V2角色(roleCode: string): string {
  if (roleCode === "superadmin") return "superadmin";
  if (roleCode === "admin" || roleCode === "region_manager") return "admin";
  if (roleCode === "partner_admin") return "partner_admin";
  return "staff";
}

function 转V2角色名称(role: string): string {
  const 映射: Record<string, string> = {
    superadmin: "超级管理员",
    admin: "管理员",
    partner_admin: "渠道管理员",
    staff: "渠道用户",
  };
  return 映射[role] || "渠道用户";
}

function 签发V2令牌(username: string, authorizationVersion?: number): string {
  return [
    "v2",
    Buffer.from(username, "utf8").toString("base64url"),
    ...(是有效授权版本(authorizationVersion) ? [String(authorizationVersion)] : []),
    crypto.randomBytes(24).toString("base64url"),
  ].join(".");
}

function 是有效授权版本(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function 读取Bearer用户名(req: Request): string {
  const header = req.headers.authorization || "";
  const match = /^Bearer\s+v2\.([^.]+)\./i.exec(header);
  if (!match?.[1]) return "";
  try {
    return Buffer.from(match[1], "base64url").toString("utf8");
  } catch {
    return "";
  }
}

function 读取当前V2业务用户(req: Request, 参数: V2兼容路由参数): 当前业务用户 | null {
  const 可信Cookie用户 = 读取当前V2可信Cookie用户(req, 参数);
  if (可信Cookie用户) return 可信Cookie用户;

  // 仅隔离测试环境保留历史身份兼容，生产环境不得从请求参数、请求头
  // 或未签名页面令牌推断用户，否则会形成可伪造的认证旁路。
  const 是测试兼容环境 =
    (参数.env?.NODE_ENV === "test" || 参数.env?.APP_ENV === "test") &&
    参数.env?.V3_BUSINESS_LEGACY_IDENTITY_ENABLED === "true";
  if (!是测试兼容环境) return null;

  const 会话参数 = {
    sessionSecret: 参数.sessionSecret || "",
    ...(参数.env ? { env: 参数.env } : {}),
  };
  const bearer用户名 = 读取Bearer用户名(req);
  if (bearer用户名) {
    const 会话角色 = 读取请求会话角色(req, 会话参数);
    return {
      username: bearer用户名,
      displayName: bearer用户名,
      ...(会话角色 ? { roleCode: 会话角色 } : {}),
      roleName: 角色显示名称(会话角色),
    };
  }

  // 自动化测试沿用统一测试身份；生产环境绝不根据环境变量回退为管理员。
  const 是测试环境 = 参数.env?.NODE_ENV === "test" || 参数.env?.APP_ENV === "test";
  const 测试默认用户 = 参数.env?.V3_BUSINESS_LEGACY_DEFAULT_USER?.trim();
  if (是测试环境 && 参数.env?.V3_BUSINESS_LEGACY_IDENTITY_ENABLED === "true" && 测试默认用户) {
    return { username: 测试默认用户, displayName: "测试兼容用户", roleName: "兼容测试用户" };
  }

  const body = 读取正文(req);
  const operatorId =
    读取查询文本(req, "operatorId") ||
    读取正文文本(body, ["operatorId", "username", "createdBy"], "");
  if (!operatorId) return null;
  const displayName = 读取正文文本(
    body,
    ["operatorName", "createdByName", "approvedBy"],
    operatorId,
  );
  const roleName = 读取正文文本(body, ["operatorRole", "role"], "V2兼容用户");
  return { username: operatorId, externalUserId: operatorId, displayName, roleName };
}

function 读取当前V2可信Cookie用户(req: Request, 参数: V2兼容路由参数): 当前业务用户 | null {
  const username = 读取请求会话用户名(req, {
    sessionSecret: 参数.sessionSecret || "",
    ...(参数.env ? { env: 参数.env } : {}),
  });
  const roleCode = 读取请求会话角色(req, {
    sessionSecret: 参数.sessionSecret || "",
    ...(参数.env ? { env: 参数.env } : {}),
  });
  return username
    ? {
        username,
        displayName: username,
        ...(roleCode ? { roleCode } : {}),
        roleName: 角色显示名称(roleCode),
      }
    : null;
}

/** 消息中心只接受签名 Cookie 或已签发的 V2 页面令牌，不接受查询参数自报身份。 */
function 读取当前V2认证用户(req: Request, 参数: V2兼容路由参数): 当前业务用户 | null {
  const cookie用户 = 读取当前V2可信Cookie用户(req, 参数);
  if (cookie用户) return cookie用户;
  const bearer用户名 = 读取Bearer用户名(req);
  if (!bearer用户名) return null;
  return {
    username: bearer用户名,
    displayName: bearer用户名,
    roleName: "V2页面用户",
  };
}

function 角色显示名称(roleCode: string): string {
  return (
    {
      superadmin: "超级管理员",
      admin: "管理员",
      region_manager: "区域管理员",
      region_admin: "区域管理员",
      partner_admin: "渠道管理员",
      staff: "内部员工",
      auditor: "审计员",
    }[roleCode] || "内部用户"
  );
}

async function 渠道用户隐藏产品价格<T>(
  req: Request,
  参数: V2兼容路由参数,
  service: ReturnType<typeof 创建业务数据服务> | null,
  数据: T,
): Promise<T> {
  // 产品价格默认按不可见处理：未登录、会话失效或无法解析角色时都不能回退为明文价格。
  if (!service) return 移除产品价格字段(数据);
  const 用户 = 读取当前V2业务用户(req, 参数);
  const 上下文 = await service.读取当前用户上下文(用户);
  if (!上下文) return 移除产品价格字段(数据);
  const 是渠道用户 =
    上下文?.roleCode === "partner_admin" ||
    上下文?.roleCode === "staff" ||
    上下文?.dataScopeCode === "partner";
  return 是渠道用户 ? 移除产品价格字段(数据) : 数据;
}

function 是V2管理配置接口(req: Request): boolean {
  const path = req.path;
  const 只读方法 = ["GET", "HEAD", "OPTIONS"].includes(req.method);
  if (
    ["/audit-logs", "/workload", "/open-api", "/users", "/import", "/export"].some(
      (前缀) => path === 前缀 || path.startsWith(`${前缀}/`),
    )
  ) {
    return true;
  }
  if (!只读方法) {
    return [
      "/partners",
      "/partner-profile-products",
      "/categories",
      "/modules",
      "/features",
      "/hardware",
      "/packages",
    ].some((前缀) => path === 前缀 || path.startsWith(`${前缀}/`));
  }
  return false;
}

/** 登录、单点登录和公开元数据不依赖业务会话，其余 V2 接口统一先过认证门禁。 */
function 是V2公开接口(req: Request): boolean {
  const path = req.path;
  if (req.method === "POST" && ["/auth/login", "/oauth/logout"].includes(path)) return true;
  if (
    req.method === "GET" &&
    ["/oauth/config", "/oauth/authorize", "/oauth/callback"].includes(path)
  )
    return true;
  if (req.method === "POST" && /^\/sso\/iam\/.+login/.test(path)) return true;
  if (path.startsWith("/mobile/")) return true;
  if (path.startsWith("/meta/")) return true;
  if (
    ["/product-tree", "/categories", "/modules", "/features", "/hardware", "/packages"].some(
      (前缀) => path === 前缀 || path.startsWith(`${前缀}/`),
    )
  )
    return true;
  return false;
}

/** 区域管理员可维护本区域渠道主档与成员账号；删除成员仍只允许超管。 */
function 是区域管理员渠道维护接口(req: Request): boolean {
  if (req.method === "POST" && req.path === "/partners") return true;
  if (是渠道成员维护接口(req)) return true;
  if (req.method !== "PUT") return false;
  return /^\/partners\/[^/]+\/(profile|level|order-target)$/.test(req.path);
}

/** 企业管理员只能维护本渠道成员；具体渠道归属由服务端逐次校验。 */
function 是渠道成员维护接口(req: Request): boolean {
  if (req.method === "POST" && /^\/partners\/[^/]+\/staff$/.test(req.path)) return true;
  if (req.method !== "PUT") return false;
  return /^\/partners\/[^/]+\/staff\/[^/]+(?:\/(?:status|password))?$/.test(req.path);
}

/** 越权访问管理配置时记录失败审计；审计写入失败不得掩盖原始 403。 */
async function 记录管理配置越权(
  pool: Pool | null,
  req: Request,
  用户: 当前业务用户 | null,
  实际角色: string,
): Promise<void> {
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO audit.audit_logs(
         created_at,request_id,actor_username,actor_name,actor_role,module_code,
         action_code,target_type,target_id,result_code,message,extra_json
       ) VALUES(now(),$1,$2,$3,$4,'authorization','admin_config.forbidden',
         'api',$5,'failure','非超级管理员尝试访问管理配置',$6::jsonb)`,
      [
        req.requestId || "",
        用户?.username || "anonymous",
        用户?.displayName || "未识别用户",
        实际角色 || "unknown",
        req.originalUrl.slice(0, 500),
        JSON.stringify({ method: req.method, path: req.path }),
      ],
    );
  } catch {
    // 审计旁路失败时仍返回明确的权限拒绝，不泄露数据库内部错误。
  }
}

function 读取阶段9查询(req: Request) {
  return {
    keyword: 读取查询文本(req, "keyword") || 读取查询文本(req, "q"),
    status: 读取查询文本(req, "status"),
    type: 读取查询文本(req, "type"),
    level: 读取查询文本(req, "level"),
    region: 读取查询文本(req, "region"),
    userId: 读取查询文本(req, "userId"),
    partnerId: 读取查询文本(req, "partnerId") || 读取查询文本(req, "assignedPartnerId"),
    operatorId: 读取查询文本(req, "operatorId"),
    page: 读取正整数(req, "page", 1),
    pageSize: Math.min(读取正整数(req, "pageSize", 默认每页), 默认每页),
  };
}

function 转V2业务记录(模块: 阶段9模块, 记录: 阶段9记录): 字典 {
  const 原始 = 记录.原始数据 || {};
  const 使用正式业务编号 = ["registrations", "opportunities", "quotes", "orders"].includes(模块);
  const id = 使用正式业务编号
    ? 记录.编号 || 记录.id
    : 读取对象文本(原始, "id") || 记录.编号 || 记录.id;
  const common = {
    ...原始,
    id,
    uuid: 记录.id,
    code: 记录.编号,
    customer: 读取对象文本(原始, "customer") || 读取对象文本(原始, "customerName") || 记录.客户名称,
    customerName:
      读取对象文本(原始, "customerName") || 读取对象文本(原始, "customer") || 记录.客户名称,
    partnerName: 记录.渠道名称 || 读取对象文本(原始, "partnerName"),
    legacyV2Order: Boolean(原始.legacyV2Order),
    assignedStaffName: 读取对象文本(原始, "assignedStaffName") || 记录.负责人,
    ownerName: 读取对象文本(原始, "ownerName") || 记录.负责人,
    region: 读取对象文本(原始, "region") || 记录.区域,
    status: 记录.状态,
    statusName: 记录.状态名称,
    amount: 读取对象数字(原始, "amount", 记录.金额),
    total: 读取对象数字(原始, "total", 记录.金额),
    createdAt: 读取对象文本(原始, "createdAt") || 记录.创建时间,
    updatedAt: 读取对象文本(原始, "updatedAt") || 记录.更新时间,
  };
  if (模块 === "users") {
    return {
      ...common,
      username: 读取对象文本(原始, "username") || 记录.负责人,
      name: 读取对象文本(原始, "name") || 记录.标题,
      role: 转V2角色(读取对象文本(原始, "role") || "staff"),
      phone: 读取对象文本(原始, "phone") || "",
      email: 读取对象文本(原始, "email") || "",
    };
  }
  if (模块 === "partners") {
    return {
      ...common,
      name: 读取对象文本(原始, "name") || 记录.标题,
      partnerName: 记录.渠道名称 || 记录.标题,
      level: 读取对象文本(原始, "level") || 读取对象文本(原始, "partnerLevel"),
    };
  }
  if (模块 === "approvals") {
    return {
      ...common,
      targetName: 记录.客户名称 || 记录.标题,
      type: 读取对象文本(原始, "type") || 读取对象文本(原始, "targetType") || "registration",
    };
  }
  return common;
}

function 读取IPG功能编号(输入: 字典): string[] {
  return Array.from(
    new Set([
      ...读取对象字符串数组(输入, "featureIds"),
      ...读取对象字符串数组(输入, "productIds"),
      ...读取对象字符串数组(输入, "products"),
    ]),
  ).filter(Boolean);
}

async function 查询IPG功能列表(pool: Pool, 输入: 字典): Promise<字典[]> {
  const ids = 读取IPG功能编号(输入);
  if (!ids.length) return [];
  const result = await pool.query<{
    id: string;
    v2_source_id: string | null;
    feature_code: string | null;
    feature_name: string;
  }>(
    `
    SELECT id::text, v2_source_id, feature_code, feature_name
    FROM catalog.product_features
    WHERE id::text = ANY($1)
       OR v2_source_id = ANY($1)
       OR feature_code = ANY($1)
    `,
    [ids],
  );
  const byKey = new Map<string, 字典>();
  for (const row of result.rows) {
    const feature = {
      id: row.v2_source_id || row.feature_code || row.id,
      name: row.feature_name,
      productCode: row.feature_code || row.v2_source_id || row.id,
    };
    [row.id, row.v2_source_id, row.feature_code].filter(Boolean).forEach((key) => {
      byKey.set(String(key), feature);
    });
  }
  return ids.map((id) => byKey.get(id) || { id, name: id });
}

interface 审计查询参数 {
  page: number;
  pageSize: number;
  module: string;
  action: string;
  result: string;
  keyword: string;
  dateFrom: string;
  dateTo: string;
}

interface V2审计日志行 extends 字典 {
  id: string;
  created_at: string;
  request_id: string | null;
  actor_user_id: string | null;
  actor_username: string | null;
  actor_name: string | null;
  actor_role: string | null;
  module: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  result: string;
  message: string | null;
  ip: string | null;
  user_agent: string | null;
  before_json: unknown;
  after_json: unknown;
  extra_json: unknown;
}

function 读取审计查询(req: Request): 审计查询参数 {
  return {
    page: 读取正整数(req, "page", 1),
    pageSize: Math.min(读取正整数(req, "pageSize", 20), 100),
    module: 读取查询文本(req, "module"),
    action: 读取查询文本(req, "action"),
    result: 读取查询文本(req, "result"),
    keyword: 读取查询文本(req, "keyword"),
    dateFrom: 读取查询文本(req, "dateFrom") || 读取查询文本(req, "from"),
    dateTo: 读取查询文本(req, "dateTo") || 读取查询文本(req, "to"),
  };
}

function 读取审计导出查询(req: Request): 审计查询参数 {
  return { ...读取审计查询(req), page: 1, pageSize: 100000 };
}

function 转审计导出行(行: V2审计日志行): 审计导出行 {
  return {
    时间: 行.created_at || "",
    操作人账号: 行.actor_username || "",
    操作人姓名: 行.actor_name || "",
    角色: 行.actor_role || "",
    审计分类: 行.module || "",
    模块编码: 行.module || "",
    动作编码: 行.action || "",
    对象类型: 行.target_type || "",
    对象编号: 行.target_id || "",
    对象名称: 行.target_name || "",
    结果: 行.result || "",
    说明: 行.message || "",
    IP: 行.ip || "",
    请求编号: 行.request_id || "",
  };
}

async function 查询V2审计日志列表(pool: Pool, 查询: 审计查询参数) {
  const { where, params } = await 构建审计条件(pool, 查询);
  const totalResult = await pool.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM audit.audit_logs a WHERE ${where}`,
    params,
  );
  const total = Number(totalResult.rows[0]?.total) || 0;
  const listParams = [...params, 查询.pageSize, (查询.page - 1) * 查询.pageSize];
  const listResult = await pool.query<V2审计日志行>(
    `
    SELECT
      COALESCE(a.v2_source_id, a.id::text) AS id,
      a.created_at::text AS created_at,
      a.request_id,
      a.actor_user_id::text AS actor_user_id,
      a.actor_username,
      a.actor_name,
      a.actor_role,
      a.module_code AS module,
      a.action_code AS action,
      a.target_type,
      a.target_id,
      a.target_name,
      a.result_code AS result,
      a.message,
      a.ip::text AS ip,
      a.user_agent,
      a.before_json,
      a.after_json,
      COALESCE(a.extra_json, '{}'::jsonb) AS extra_json
    FROM audit.audit_logs a
    WHERE ${where}
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT $${listParams.length - 1}
    OFFSET $${listParams.length}
    `,
    listParams,
  );
  return { data: listResult.rows, total, page: 查询.page, pageSize: 查询.pageSize };
}

async function 查询V2审计日志详情(pool: Pool, id: string): Promise<V2审计日志行 | null> {
  const result = await pool.query<V2审计日志行>(
    `
    SELECT
      COALESCE(a.v2_source_id, a.id::text) AS id,
      a.created_at::text AS created_at,
      a.request_id,
      a.actor_user_id::text AS actor_user_id,
      a.actor_username,
      a.actor_name,
      a.actor_role,
      a.module_code AS module,
      a.action_code AS action,
      a.target_type,
      a.target_id,
      a.target_name,
      a.result_code AS result,
      a.message,
      a.ip::text AS ip,
      a.user_agent,
      a.before_json,
      a.after_json,
      COALESCE(a.extra_json, '{}'::jsonb) AS extra_json
    FROM audit.audit_logs a
    WHERE a.id::text = $1 OR a.v2_source_id = $1 OR a.request_id = $1
    LIMIT 1
    `,
    [id],
  );
  return result.rows[0] || null;
}

async function 解析审计业务编号目标(pool: Pool, 关键词: string): Promise<string[]> {
  const 模式 = `%${关键词}%`;
  const 结果 = await pool.query<{ id: string }>(
    `
    SELECT id::text AS id
      FROM crm.registrations
     WHERE COALESCE(registration_no, '') ILIKE $1
        OR COALESCE(v2_source_id, '') ILIKE $1
    UNION
    SELECT v2_source_id AS id
      FROM crm.registrations
     WHERE v2_source_id IS NOT NULL
       AND (COALESCE(registration_no, '') ILIKE $1 OR v2_source_id ILIKE $1)
    UNION
    SELECT id::text AS id
      FROM crm.opportunities
     WHERE COALESCE(opportunity_no, '') ILIKE $1
        OR COALESCE(v2_source_id, '') ILIKE $1
    UNION
    SELECT v2_source_id AS id
      FROM crm.opportunities
     WHERE v2_source_id IS NOT NULL
       AND (COALESCE(opportunity_no, '') ILIKE $1 OR v2_source_id ILIKE $1)
    UNION
    SELECT id::text AS id
      FROM crm.quotes
     WHERE COALESCE(quote_no, '') ILIKE $1
        OR COALESCE(v2_source_id, '') ILIKE $1
    UNION
    SELECT v2_source_id AS id
      FROM crm.quotes
     WHERE v2_source_id IS NOT NULL
       AND (COALESCE(quote_no, '') ILIKE $1 OR v2_source_id ILIKE $1)
    UNION
    SELECT id::text AS id
      FROM crm.orders
     WHERE COALESCE(order_no, '') ILIKE $1
        OR COALESCE(pre_region_order_no, '') ILIKE $1
        OR COALESCE(v2_source_id, '') ILIKE $1
    UNION
    SELECT v2_source_id AS id
      FROM crm.orders
     WHERE v2_source_id IS NOT NULL
       AND (
         COALESCE(order_no, '') ILIKE $1
         OR COALESCE(pre_region_order_no, '') ILIKE $1
         OR v2_source_id ILIKE $1
       )
    `,
    [模式],
  );
  const 业务目标编号 = [...new Set(结果.rows.map((行) => 行.id).filter(Boolean))];
  if (!业务目标编号.length) return 业务目标编号;
  // 历史审批审计的 target_id 保存审批主键。按业务编号检索时先反查审批主键，
  // 否则旧记录只能按审批编号找到，无法从订单号、商机号串起完整链路。
  const 审批结果 = await pool.query<{ id: string }>(
    `SELECT id::text AS id
       FROM ops.approvals
      WHERE target_id::text = ANY($1::text[])
      UNION
      SELECT v2_source_id AS id
       FROM ops.approvals
      WHERE v2_source_id IS NOT NULL
        AND target_id::text = ANY($1::text[])`,
    [业务目标编号],
  );
  return [...new Set([...业务目标编号, ...审批结果.rows.map((行) => 行.id).filter(Boolean)])];
}

async function 构建审计条件(
  pool: Pool,
  查询: 审计查询参数,
): Promise<{ where: string; params: unknown[] }> {
  const 条件 = ["true"];
  const params: unknown[] = [];
  if (查询.module) {
    params.push(查询.module);
    条件.push(`a.module_code = $${params.length}`);
  }
  if (查询.action) {
    params.push(查询.action);
    条件.push(`a.action_code = $${params.length}`);
  }
  if (查询.result) {
    params.push(查询.result);
    条件.push(`a.result_code = $${params.length}`);
  }
  if (查询.keyword) {
    // 先解析业务编号对应的目标 ID，避免审计表逐行执行四个业务表关联子查询并被 JIT 放大耗时。
    const 业务目标编号 = await 解析审计业务编号目标(pool, 查询.keyword);
    params.push(`%${查询.keyword}%`);
    const 关键词条件 = [
      `(
      COALESCE(a.actor_username, '') ILIKE $${params.length}
      OR COALESCE(a.actor_name, '') ILIKE $${params.length}
      OR COALESCE(a.target_name, '') ILIKE $${params.length}
      OR COALESCE(a.target_id, '') ILIKE $${params.length}
      OR COALESCE(a.request_id, '') ILIKE $${params.length}
      OR COALESCE(a.message, '') ILIKE $${params.length}
      OR COALESCE(a.extra_json::text, '') ILIKE $${params.length}
    )`,
    ];
    if (业务目标编号.length > 0) {
      params.push(业务目标编号);
      关键词条件.push(`a.target_id = ANY($${params.length}::text[])`);
    }
    条件.push(`(${关键词条件.join(" OR ")})`);
  }
  if (查询.dateFrom) {
    params.push(查询.dateFrom);
    条件.push(`a.created_at >= $${params.length}::timestamptz`);
  }
  if (查询.dateTo) {
    params.push(查询.dateTo);
    // 页面日期筛选以自然日为单位：纯日期结束日必须覆盖当天 23:59:59，而不是当天零点。
    条件.push(
      /^\d{4}-\d{2}-\d{2}$/.test(查询.dateTo)
        ? `a.created_at < ($${params.length}::date + interval '1 day')`
        : `a.created_at <= $${params.length}::timestamptz`,
    );
  }
  return { where: 条件.join(" AND "), params };
}

async function 单点登录降级响应(pool: Pool, req: Request) {
  const body = 读取正文(req);
  const clientType = 读取正文文本(body, ["clientType"], "");
  if (clientType !== "mobile") {
    return 失败("当前单点登录请求不受支持，请使用统一登录页。");
  }
  const username = 读取正文文本(body, ["username", "account", "operatorId"], "");
  const 用户 = username ? await 查询V2用户(pool, username) : await 查询首个管理员(pool);
  if (!用户) return 失败("当前未配置单点登录，请使用账号密码登录。");
  const { passwordHash: _passwordHash, ...安全用户 } = 用户;
  return {
    success: true,
    user: 安全用户,
    token: 签发V2令牌(安全用户.username, 安全用户.authorizationVersion),
    ssoFallback: true,
  };
}

async function 保存用户密码(
  pool: 数据库查询器,
  userId: string,
  password: string,
  mustChangePassword: boolean,
) {
  const passwordHash = 创建密码散列(password);
  const result = await pool.query<{ user_id: string }>(
    `
    WITH target_user AS (
      SELECT id
      FROM iam.users
      WHERE id::text = $1
         OR v2_source_id = $1
         OR username::text = $1
         OR extra_json->>'id' = $1
         OR extra_json->>'userId' = $1
      LIMIT 1
    )
    INSERT INTO iam.password_credentials (
      user_id, password_hash, algorithm, must_change_password, changed_at
    )
    SELECT id, $2, 'scrypt', $3, now()
    FROM target_user
    ON CONFLICT (user_id) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        algorithm = EXCLUDED.algorithm,
        must_change_password = EXCLUDED.must_change_password,
        changed_at = EXCLUDED.changed_at
    RETURNING user_id::text AS user_id
    `,
    [userId, passwordHash, mustChangePassword],
  );
  if (!result.rows[0]) throw Object.assign(new Error("用户不存在。"), { statusCode: 404 });
  await pool.query(
    "UPDATE iam.users SET row_version=row_version+1,updated_at=now() WHERE id=$1::uuid",
    [result.rows[0].user_id],
  );
}

async function _调整订单价格(
  pool: Pool,
  id: string,
  输入: 字典,
  用户: 当前业务用户 | null,
): Promise<字典> {
  const newAmount = 读取正文数字(输入, ["newAmount", "amount", "total"], -1);
  if (newAmount < 0)
    throw Object.assign(new Error("请输入有效的调整后价格。"), { statusCode: 400 });
  const reason = 读取正文文本(输入, ["adjustmentReason", "reason", "remark"], "");
  if (!reason) throw Object.assign(new Error("请填写价格调整原因。"), { statusCode: 400 });

  const result = await pool.query<{
    id: string;
    customer_name: string | null;
    partner_name: string | null;
    status_code: string;
    total_amount: string | number;
    extra_json: 字典 | null;
    updated_at: string;
  }>(
    `
    UPDATE crm.orders
    SET total_amount = $2,
        updated_at = now(),
        extra_json = extra_json || $3::jsonb
    WHERE id::text = $1 OR v2_source_id = $1 OR order_no = $1
    RETURNING
      COALESCE(v2_source_id, order_no, id::text) AS id,
      (SELECT customer_name FROM crm.customers c WHERE c.id = crm.orders.customer_id) AS customer_name,
      (SELECT partner_name FROM channel.partners p WHERE p.id = crm.orders.partner_id) AS partner_name,
      status_code,
      total_amount,
      extra_json,
      updated_at::text
    `,
    [
      id,
      newAmount,
      JSON.stringify({
        amount: newAmount,
        total: newAmount,
        priceAdjustments: [
          {
            newAmount,
            reason,
            operatorName: 用户?.displayName || 读取正文文本(输入, ["operatorName"], ""),
            adjustedAt: new Date().toISOString(),
          },
        ],
      }),
    ],
  );
  const row = result.rows[0];
  if (!row) throw Object.assign(new Error("订单不存在。"), { statusCode: 404 });
  const extra = row.extra_json || {};
  return {
    ...extra,
    id: row.id,
    customer: 读取对象文本(extra, "customer") || row.customer_name || "",
    customerName: 读取对象文本(extra, "customerName") || row.customer_name || "",
    partnerName: 读取对象文本(extra, "partnerName") || row.partner_name || "",
    status: 读取对象文本(extra, "status") || row.status_code,
    amount: Number(row.total_amount) || newAmount,
    total: Number(row.total_amount) || newAmount,
    updatedAt: row.updated_at,
  };
}

async function 保存V2用户(
  pool: 数据库查询器,
  id: string,
  输入: 字典,
  选项: { 同步渠道成员?: boolean; 允许复用启用账号?: boolean } = {},
) {
  const 已有账号 = id ? await 查询V2账号保存快照(pool, id) : null;
  if (id && !已有账号) throw Object.assign(new Error("用户不存在。"), { statusCode: 404 });

  const username = 读取正文文本(
    输入,
    ["username", "account", "loginName"],
    已有账号?.username || id || "",
  );
  if (!username) throw Object.assign(new Error("请输入登录账号。"), { statusCode: 400 });
  const code = id || 读取正文文本(输入, ["id", "userId"], username);
  const name = 读取正文文本(输入, ["name", "displayName"], 已有账号?.displayName || username);
  const 角色输入 = 读取正文文本(输入, ["role"], "");
  const role = 角色输入 ? 转V3角色(角色输入) : id ? "" : "staff";
  const 是否区域管理员 =
    role === "region_manager" || (!角色输入 && Boolean(id) && (await 是已保存区域管理员(pool, id)));
  const 区域字段已提供 = 是否包含正文键(输入, ["region", "区域"]);
  const 展示区域名称 = 区域字段已提供
    ? 读取正文文本(输入, ["region", "区域"], "").trim()
    : 读取对象文本(已有账号?.extra || {}, "region");
  const 正式区域编号 = 是否区域管理员
    ? !区域字段已提供 && 已有账号?.regionId
      ? 已有账号.regionId
      : await 解析区域管理员正式区域(pool, {
          regionName: 展示区域名称,
          required: !id || 区域字段已提供 || Boolean(展示区域名称),
        })
    : null;
  const 应同步正式区域 =
    是否区域管理员 && (区域字段已提供 || (!已有账号?.regionId && Boolean(正式区域编号)));
  // 显式传入 status 时必须以本次请求为准：历史实现无条件沿用快照状态，
  // 会导致「编辑渠道成员并把状态改为停用」不生效，出现成员已停用、登录账号仍可登录的矛盾。
  const 显式状态 = 是否包含正文键(输入, ["status"])
    ? 读取正文文本(输入, ["status"], "").trim()
    : "";
  const 待转状态 = 显式状态 || (已有账号?.status ? String(已有账号.status) : "active");
  const status = 转V3账号状态(待转状态);
  const phone = 是否包含正文键(输入, ["phone", "mobile"])
    ? 读取正文文本(输入, ["phone", "mobile"], "")
    : 已有账号?.phone || "";
  const 电话错误 = 校验联系电话格式(phone);
  if (电话错误) throw Object.assign(new Error(电话错误), { statusCode: 400 });
  const email = 是否包含正文键(输入, ["email"])
    ? 读取正文文本(输入, ["email"], "")
    : 已有账号?.email || "";
  const extra = {
    ...(已有账号?.extra || {}),
    ...输入,
    id: code,
    userId: code,
    username,
    name,
    ...(role ? { role: 转V2角色(role) } : {}),
  };

  await 校验账号联系电话唯一(pool, phone, { id: id || code, username });

  let 复用已有启用账号 = false;
  try {
    if (id) {
      const result = await pool.query<{ username: string }>(
        `
        UPDATE iam.users
        SET username = $2::citext,
            display_name = $3,
            status_code = $4,
            phone = NULLIF($5, ''),
            email = NULLIF($6, '')::citext,
            region_id = CASE WHEN $8 THEN $9::uuid ELSE region_id END,
            updated_at = now(),
            row_version = row_version + CASE WHEN status_code IS DISTINCT FROM $4 THEN 1 ELSE 0 END,
            extra_json = extra_json || $7::jsonb
        WHERE id::text = $1 OR v2_source_id = $1 OR username::text = $1 OR extra_json->>'id' = $1
        RETURNING username::text AS username
        `,
        [
          id,
          username,
          name,
          status,
          phone,
          email,
          JSON.stringify(extra),
          应同步正式区域,
          正式区域编号,
        ],
      );
      if (!result.rows[0]) throw Object.assign(new Error("用户不存在。"), { statusCode: 404 });
    } else {
      const 已存在 = await pool.query<{
        status_code: string;
        offboarding_status: string;
        display_name: string;
        phone: string | null;
      }>(
        `SELECT status_code,offboarding_status,display_name,phone
           FROM iam.users
          WHERE username=$1::citext
          LIMIT 1`,
        [username],
      );
      const 已有 = 已存在.rows[0];
      if (
        已有 &&
        选项.允许复用启用账号 &&
        已有.status_code === "active" &&
        ["active", "reactivated"].includes(已有.offboarding_status) &&
        已有.display_name === name &&
        规范化账号联系电话(已有.phone || "") === 规范化账号联系电话(phone)
      ) {
        复用已有启用账号 = true;
      } else if (已有)
        throw Object.assign(
          new Error(
            已有.status_code === "disabled"
              ? "该登录账号已归档，请恢复账号并重新授权，或使用新的登录账号。"
              : 选项.允许复用启用账号
                ? "该登录账号已存在。如需将现有账号加入本渠道，请确认姓名和手机号与原账号一致；否则请使用新的登录账号。"
                : "该登录账号已存在，请使用其他登录账号或编辑原账号。",
          ),
          { statusCode: 409 },
        );
      if (!复用已有启用账号)
        await pool.query(
          `
          INSERT INTO iam.users (
            v2_source_id, username, display_name, status_code, phone, email, region_id, extra_json
          )
          VALUES (
            $1, $2::citext, $3, $4, NULLIF($5, ''), NULLIF($6, '')::citext, $7::uuid, $8::jsonb
          )
          `,
          [code, username, name, status, phone, email, 正式区域编号, JSON.stringify(extra)],
        );
    }
  } catch (error) {
    抛出账号联系电话冲突错误(error);
    throw error;
  }

  if (role) {
    await 绑定用户角色(pool, username, role);
    if (选项.同步渠道成员 !== false) {
      await 同步用户渠道成员绑定(pool, username, role, 读取正文文本(输入, ["partnerId"], ""));
    }
  }
  const password = 读取正文文本(输入, ["password"], "");
  if (password && !复用已有启用账号) await 保存用户密码(pool, username, password, true);
  const 用户 = await 查询V2用户(pool, username, true);
  if (!用户) throw Object.assign(new Error("用户保存失败。"), { statusCode: 500 });
  return 用户;
}

async function 保存内部账号(
  pool: Pool,
  id: string,
  输入: 字典,
  当前会话用户名?: string,
  选项: { 同步管理组织?: boolean } = {},
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const 账号 = await 保存V2用户(client, id, 输入);
    if (!id) {
      const userId = await 查找用户UUID(client, 账号.id || 账号.username);
      if (!userId)
        throw Object.assign(new Error("用户保存失败，未找到用户标识。"), { statusCode: 500 });
      const partnerId = 读取正文文本(输入, ["partnerId"], "");
      if (!partnerId) {
        await 维护新建用户外部身份(
          client,
          userId,
          输入,
          当前会话用户名 || 读取正文文本(输入, ["createdBy"], ""),
        );
        if (选项.同步管理组织) {
          const 角色 = 转V3角色(读取正文文本(输入, ["role"], "staff"));
          if (["region_manager", "superadmin", "admin"].includes(角色)) {
            const 区域 = await client.query<{ region_id: string | null }>(
              "SELECT region_id::text AS region_id FROM iam.users WHERE id=$1::uuid",
              [userId],
            );
            await 同步新建管理账号组织归属(client, userId, 角色, 区域.rows[0]?.region_id || null);
          }
        }
      }
    }
    await client.query("COMMIT");
    return 账号;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function 维护新建用户外部身份(
  pool: 数据库查询器,
  userId: string,
  输入: 字典,
  操作人标识: string,
) {
  const 泛微编号 = 读取正文文本(
    输入,
    ["eteamsUserId", "eteamsUserid", "eteamsExternalSubject"],
    "",
  );
  const 企微编号 = 读取正文文本(输入, ["wecomUserId", "wecomUserid", "wecomExternalSubject"], "");
  if (!泛微编号 && !企微编号) return;
  const 操作人 = 操作人标识 ? await 查找用户UUID(pool, 操作人标识) : "";
  if (泛微编号 && !操作人)
    throw Object.assign(new Error("填写泛微 OA userid 时必须提供有效的创建人账号。"), {
      statusCode: 400,
    });
  if (泛微编号) {
    const 泛微姓名或登录名 = 读取正文文本(输入, ["eteamsUsername", "eteamsName"], "");
    if (!泛微姓名或登录名)
      throw Object.assign(new Error("填写泛微 OA userid 时必须同时填写泛微姓名或登录名。"), {
        statusCode: 400,
      });
    const 已占用 = await pool.query(
      "SELECT 1 FROM iam.external_identities WHERE provider_code='eteams' AND external_subject=$1 AND status_code='active' UNION ALL SELECT 1 FROM iam.external_identity_candidates WHERE provider_code='eteams' AND external_subject=$1 AND status_code='pending' LIMIT 1",
      [泛微编号],
    );
    if (已占用.rows[0])
      throw Object.assign(new Error("该泛微 OA userid 已被占用，请先核对外部身份映射。"), {
        statusCode: 409,
      });
    await pool.query(
      "INSERT INTO iam.external_identity_candidates(user_id,provider_code,external_subject,external_username,source_code,created_by_user_id) VALUES($1::uuid,'eteams',$2,$3,'manual',$4::uuid)",
      [userId, 泛微编号, 泛微姓名或登录名, 操作人],
    );
  }
  if (企微编号) {
    const 已占用 = await pool.query(
      "SELECT 1 FROM iam.external_identities WHERE provider_code='wecom' AND external_subject=$1 AND status_code='active'",
      [企微编号],
    );
    if (已占用.rows[0])
      throw Object.assign(new Error("该企业微信 userid 已被占用，请先核对外部身份映射。"), {
        statusCode: 409,
      });
    await pool.query(
      "INSERT INTO iam.external_identities(user_id,provider_code,external_subject,external_username,status_code) VALUES($1::uuid,'wecom',$2,$3,'active')",
      [
        userId,
        企微编号,
        读取正文文本(
          输入,
          ["wecomUsername", "wecomName"],
          读取正文文本(输入, ["name", "displayName"], ""),
        ),
      ],
    );
  }
}

async function 同步新建管理账号组织归属(
  pool: 数据库查询器,
  userId: string,
  role: string,
  regionId: string | null,
) {
  const 根 = await pool.query(
    "SELECT id::text AS id FROM org.org_units WHERE parent_unit_id IS NULL AND unit_type NOT LIKE 'channel_%' AND status_code='active' ORDER BY created_at LIMIT 1",
  );
  if (!根.rows[0])
    throw Object.assign(new Error("组织架构缺少根部门，无法同步新建管理员。"), { statusCode: 400 });
  let 组织Id = 根.rows[0].id as string;
  if (role === "region_manager" && regionId) {
    const 区域 = await pool.query(
      "SELECT r.region_name AS name,b.region_name AS big_name FROM org.regions r LEFT JOIN org.regions b ON b.id=r.parent_region_id WHERE r.id=$1::uuid",
      [regionId],
    );
    const 取部门 = async (名称: string, 父Id: string) => {
      const 已有 = await pool.query(
        "SELECT id::text AS id FROM org.org_units WHERE parent_unit_id=$1::uuid AND unit_name=$2 AND unit_type NOT LIKE 'channel_%' AND status_code='active' ORDER BY created_at LIMIT 1",
        [父Id, 名称],
      );
      if (已有.rows[0]) return 已有.rows[0].id as string;
      const 新建 = await pool.query(
        "INSERT INTO org.org_units(unit_code,unit_name,unit_type,parent_unit_id,status_code,sort_order) VALUES($1,$2,'department',$3::uuid,'active',0) RETURNING id::text AS id",
        [`auto-${crypto.randomUUID()}`, 名称, 父Id],
      );
      return 新建.rows[0].id as string;
    };
    if (区域.rows[0]?.big_name) 组织Id = await 取部门(区域.rows[0].big_name, 组织Id);
    if (区域.rows[0]?.name) 组织Id = await 取部门(区域.rows[0].name, 组织Id);
  }
  const 已有任职 = await pool.query(
    "SELECT 1 FROM org.staff_assignments WHERE user_id=$1::uuid AND expired_at IS NULL LIMIT 1",
    [userId],
  );
  if (!已有任职.rows[0])
    await pool.query(
      "INSERT INTO org.staff_assignments(user_id,org_unit_id,position_id,is_primary,effective_at,source_code) VALUES($1::uuid,$2::uuid,NULL,true,now(),'manual')",
      [userId, 组织Id],
    );
}

async function 是已保存区域管理员(pool: 数据库查询器, id: string): Promise<boolean> {
  const result = await pool.query<{ is_region_manager: boolean }>(
    `
    SELECT EXISTS (
      SELECT 1
      FROM iam.users u
      JOIN iam.user_roles ur ON ur.user_id = u.id
      JOIN iam.roles r ON r.id = ur.role_id
      WHERE r.role_code = 'region_manager'
        AND r.status_code = 'active'
        AND (
          u.id::text = $1
          OR u.v2_source_id = $1
          OR u.username::text = $1
          OR u.extra_json->>'id' = $1
          OR u.extra_json->>'userId' = $1
        )
    ) AS is_region_manager
    `,
    [id],
  );
  return result.rows[0]?.is_region_manager === true;
}

async function 解析区域管理员正式区域(
  pool: 数据库查询器,
  参数: { regionName: string; required: boolean },
): Promise<string | null> {
  if (!参数.regionName) {
    if (参数.required)
      throw Object.assign(new Error("区域管理员必须选择有效的负责区域。"), { statusCode: 400 });
    return null;
  }
  const result = await pool.query<{ id: string }>(
    `
    SELECT id::text AS id
    FROM org.regions
    WHERE region_name = $1
      AND region_level = 'region'
      AND status_code = 'active'
    ORDER BY id
    LIMIT 2
    `,
    [参数.regionName],
  );
  if (result.rows.length !== 1) {
    throw Object.assign(
      new Error(
        result.rows.length
          ? "负责区域存在重复配置，请先由超级管理员完成区域治理。"
          : "负责区域不存在或已停用，请重新选择有效区域。",
      ),
      { statusCode: 400 },
    );
  }
  return result.rows[0]!.id;
}

async function 查询V2账号保存快照(pool: 数据库查询器, id: string) {
  const result = await pool.query<{
    username: string;
    display_name: string | null;
    status_code: string;
    phone: string | null;
    email: string | null;
    region_id: string | null;
    extra_json: 字典 | null;
  }>(
    `
    SELECT
      username::text AS username,
      display_name,
      status_code,
      phone,
      email::text AS email,
      region_id::text AS region_id,
      extra_json
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
  if (!row) return null;
  return {
    username: row.username,
    displayName: row.display_name || row.username,
    status: row.extra_json?.status || row.status_code,
    phone: row.phone || "",
    email: row.email || "",
    regionId: row.region_id || "",
    extra: row.extra_json || {},
  };
}

async function 校验账号联系电话唯一(
  pool: 数据库查询器,
  phone: string,
  当前账号: { id: string; username: string },
) {
  const normalizedPhone = 规范化账号联系电话(phone);
  if (!normalizedPhone) return;
  const result = await pool.query<{ username: string; display_name: string }>(
    `
    SELECT username::text AS username, display_name
    FROM iam.users
    WHERE iam.normalize_phone(phone) = $1
      AND NOT (
        lower(username::text) = lower($2)
        OR ($3 <> '' AND (
          id::text = $3
          OR v2_source_id = $3
          OR extra_json->>'id' = $3
          OR extra_json->>'userId' = $3
        ))
      )
    LIMIT 1
    `,
    [normalizedPhone, 当前账号.username, 当前账号.id || ""],
  );
  const 冲突账号 = result.rows[0];
  if (冲突账号) {
    throw Object.assign(
      new Error(`联系电话已被账号「${冲突账号.display_name || 冲突账号.username}」使用，请更换。`),
      { statusCode: 409 },
    );
  }
}

function 抛出账号联系电话冲突错误(error: unknown): void {
  const record = error as { code?: string; constraint?: string; message?: string };
  if (
    record.code === "23505" &&
    (record.constraint === "ux_users_phone_normalized_unique" ||
      /ux_users_phone_normalized_unique|phone/i.test(record.message || ""))
  ) {
    throw Object.assign(new Error("联系电话已被其他账号使用，请更换。"), { statusCode: 409 });
  }
}

function 规范化账号联系电话(phone: string): string {
  return 规范化联系电话(phone);
}

function 是否包含正文键(来源: 字典, keys: string[]): boolean {
  return keys.some((key) => Object.prototype.hasOwnProperty.call(来源, key));
}

async function 同步用户渠道成员绑定(
  pool: 数据库查询器,
  username: string,
  role: string,
  partnerId: string,
): Promise<void> {
  if (!partnerId || (role !== "partner_admin" && role !== "staff")) return;
  const partnerUuid = await 查找渠道商UUID(pool, partnerId);
  const userUuid = await 查找用户UUID(pool, username);
  if (!partnerUuid || !userUuid) return;
  await pool.query(
    `
    INSERT INTO channel.partner_members (partner_id, user_id, member_role_code, status_code)
    VALUES ($1::uuid, $2::uuid, $3, 'active')
    ON CONFLICT (partner_id, user_id) DO UPDATE
    SET member_role_code = EXCLUDED.member_role_code,
        status_code = EXCLUDED.status_code,
        ended_at = NULL,
        archived_at = NULL,
        archive_reason = NULL,
        updated_at = now(),
        row_version = channel.partner_members.row_version + 1
    `,
    [partnerUuid, userUuid, role === "partner_admin" ? "partner_admin" : "staff"],
  );
}

async function 更新用户状态(pool: Pool, id: string, status: string) {
  const result = await pool.query<{ username: string }>(
    `
    UPDATE iam.users
    SET status_code = $2,
        updated_at = now(),
        row_version = row_version + 1,
        extra_json = extra_json || $3::jsonb
    WHERE id::text = $1 OR v2_source_id = $1 OR username::text = $1 OR extra_json->>'id' = $1
    RETURNING username::text AS username
    `,
    [id, 转V3账号状态(status), JSON.stringify({ status })],
  );
  const username = result.rows[0]?.username;
  if (!username) throw Object.assign(new Error("用户不存在。"), { statusCode: 404 });
  if (status === "pending") {
    const userUuid = await 查找用户UUID(pool, username);
    const 成员 = userUuid ? await 查询账号首个渠道成员(pool, userUuid) : null;
    if (userUuid && 成员) {
      await 写入账号审批待办(pool, {
        账号UUID: userUuid,
        账号角色: 成员.role,
        渠道UUID: 成员.partnerUuid,
        渠道编号: 成员.partnerExternalId,
        申请人UUID: null,
        输入: { status: "pending" },
        当前用户: null,
      });
    }
  }
  return 查询V2用户(pool, username);
}

async function 更新用户密码(
  pool: Pool,
  id: string,
  password: string,
  partnerId = "",
  当前用户: 当前业务用户 | null = null,
) {
  if (partnerId) {
    const partnerUuid = await 查找渠道商UUID(pool, partnerId);
    if (!partnerUuid) throw Object.assign(new Error("渠道商不存在。"), { statusCode: 404 });
    const 目标角色 = await 查询渠道成员账号角色(pool, partnerUuid, id);
    await 校验渠道成员维护范围(pool, partnerUuid, 当前用户, 目标角色);
  }
  if (!password || password.length < 6)
    throw Object.assign(new Error("密码长度不能少于6位。"), { statusCode: 400 });
  await 保存用户密码(pool, id, password, true);
  return { id, updated: true };
}

function 是账号角色(role: string): boolean {
  return ["superadmin", "admin", "region_manager", "partner_admin", "staff"].includes(role);
}

function 读取显式账号角色(输入: 字典): string {
  const explicitRole = 读取正文文本(输入, ["accountRole", "userRole", "memberRole"], "");
  if (explicitRole) return 转V3角色(explicitRole);
  const role = 读取正文文本(输入, ["role"], "");
  return 是账号角色(role) ? 转V3角色(role) : "";
}

function 读取员工职位(输入: 字典, accountRole: string): string {
  // 企业管理员是账号角色，不是销售/技术业务角色，不能走渠道业务角色映射。
  if (accountRole === "partner_admin") {
    return 读取正文文本(输入, ["staffRole", "title"], "") || "企业管理员";
  }
  const businessRoleCode = 读取渠道业务角色代码(输入);
  if (businessRoleCode) return businessRoleCode === "channel_technical" ? "技术" : "销售";
  const staffRole = 读取正文文本(输入, ["staffRole", "title"], "");
  if (staffRole) return staffRole;
  const role = 读取正文文本(输入, ["role"], "");
  if (role && !是账号角色(role)) return role;
  return accountRole === "partner_admin" ? "企业管理员" : "销售代表";
}

function 读取渠道业务角色代码(输入: 字典): string {
  const value = 读取正文文本(输入, ["businessRoleCode", "businessRoleType"], "");
  if (value) {
    const mapping: Record<string, string> = {
      sales: "channel_sales",
      technical: "channel_technical",
      channel_sales: "channel_sales",
      channel_technical: "channel_technical",
    };
    const result = mapping[value];
    if (!result) throw Object.assign(new Error("业务角色仅支持销售或技术。"), { statusCode: 400 });
    return result;
  }
  const legacy = 读取正文文本(输入, ["staffRole", "title"], "");
  if (legacy.includes("技术")) return "channel_technical";
  if (legacy.includes("销售")) return "channel_sales";
  return "";
}

async function 查询渠道成员账号角色(
  pool: 数据库查询器,
  partnerUuid: string,
  staffId: string,
): Promise<string> {
  if (!staffId) return "";
  const result = await pool.query<{ member_role_code: string }>(
    `
    SELECT pm.member_role_code
    FROM channel.partner_members pm
    JOIN iam.users u ON u.id = pm.user_id
    WHERE pm.partner_id = $1::uuid
      AND pm.archived_at IS NULL
      AND (
        u.id::text = $2
        OR u.v2_source_id = $2
        OR u.username::text = $2
        OR u.extra_json->>'id' = $2
        OR u.extra_json->>'userId' = $2
      )
    LIMIT 1
    `,
    [partnerUuid, staffId],
  );
  return result.rows[0]?.member_role_code || "";
}

async function 绑定用户角色(pool: 数据库查询器, username: string, roleCode: string) {
  await pool.query(
    `
    INSERT INTO iam.roles (role_code, role_name, status_code)
    VALUES ($1, $2, 'active')
    ON CONFLICT (role_code) DO UPDATE
    SET role_name = EXCLUDED.role_name,
        status_code = EXCLUDED.status_code
    `,
    [roleCode, 转V3角色名称(roleCode)],
  );
  await pool.query(
    `
    WITH target_user AS (
      SELECT id FROM iam.users WHERE lower(username::text) = lower($1) LIMIT 1
    ),
    target_role AS (
      SELECT id FROM iam.roles WHERE role_code = $2 LIMIT 1
    )
    INSERT INTO iam.user_roles (user_id, role_id)
    SELECT target_user.id, target_role.id
    FROM target_user CROSS JOIN target_role
    ON CONFLICT DO NOTHING
    `,
    [username, roleCode],
  );
  await pool.query(
    "UPDATE iam.users SET row_version=row_version+1,updated_at=now() WHERE lower(username::text)=lower($1)",
    [username],
  );
}

interface 渠道商维护目标 {
  partnerUuid: string;
  partnerId: string;
  partnerName: string;
  regionId: string;
  regionName: string;
  level: string;
  cooperationLevel: string;
}

interface 渠道商审计参数 {
  action:
    | "partner.create"
    | "partner.profile.update"
    | "partner.status.update"
    | "partner.level.update"
    | "partner.order_target.update";
  actor: {
    userId?: string;
    username: string;
    displayName: string;
    roleName: string;
    requestId?: string;
  } | null;
  partnerId: string;
  partnerName: string;
  before?: unknown;
  after?: unknown;
  request?: Request | undefined;
  message: string;
}

async function 读取渠道维护身份(
  service: ReturnType<typeof 创建业务数据服务> | null,
  req: Request,
  参数: V2兼容路由参数,
): Promise<业务用户上下文> {
  const 上下文 = await 需要服务(service).读取当前用户上下文(读取当前V2业务用户(req, 参数));
  if (!上下文 || !["superadmin", "region_manager"].includes(上下文.roleCode)) {
    throw new 应用错误("V3_CHANNEL_MAINTENANCE_FORBIDDEN", "当前账号无权维护渠道商。", 403);
  }
  if (上下文.roleCode === "region_manager" && !上下文.regionId && !上下文.regionName) {
    throw new 应用错误("V3_CHANNEL_REGION_REQUIRED", "区域管理员未绑定有效区域。", 403);
  }
  return 上下文;
}

async function 是否可维护渠道商(
  pool: Pool,
  service: ReturnType<typeof 创建业务数据服务>,
  req: Request,
  参数: V2兼容路由参数,
  partnerId: string,
): Promise<boolean> {
  try {
    const 上下文 = await service.读取当前用户上下文(读取当前V2业务用户(req, 参数));
    if (!上下文 || !["superadmin", "region_manager"].includes(上下文.roleCode)) return false;
    await 校验渠道商维护范围(pool, partnerId, 上下文);
    return true;
  } catch {
    return false;
  }
}

type 渠道档案关系 = "self" | "parent" | "child" | "internal";

function 是渠道账号上下文(上下文: 业务用户上下文 | null): boolean {
  if (!上下文) return false;
  return (
    ["partner_admin", "staff"].includes(上下文.roleCode) ||
    ["partner", "self"].includes(上下文.dataScopeCode)
  );
}

/** 渠道账号只可读取自身及直属上下级档案，返回值用于前端收敛只读展示。 */
async function 解析渠道档案关系(
  pool: 数据库查询器,
  id: string,
  上下文: 业务用户上下文 | null,
): Promise<渠道档案关系> {
  if (!是渠道账号上下文(上下文)) return "internal";
  const 目标 = await 校验渠道商维护范围(pool, id, null);
  if (!上下文 || !上下文.partnerIds.length) {
    throw new 应用错误(
      "V3_CHANNEL_SCOPE_FORBIDDEN",
      "当前账号未绑定渠道商，不能查看渠道档案。",
      403,
    );
  }
  if (上下文.partnerIds.includes(目标.partnerUuid)) return "self";
  const result = await pool.query<{ relationship: "parent" | "child" }>(
    `
    SELECT CASE
      WHEN relation.parent_partner_id = ANY($1::uuid[]) THEN 'child'
      ELSE 'parent'
    END AS relationship
    FROM channel.partner_relations relation
    WHERE relation.relation_code = 'primary_secondary'
      AND relation.ended_at IS NULL
      AND (
        (relation.parent_partner_id = ANY($1::uuid[]) AND relation.child_partner_id = $2::uuid)
        OR (relation.child_partner_id = ANY($1::uuid[]) AND relation.parent_partner_id = $2::uuid)
      )
    LIMIT 1
    `,
    [上下文.partnerIds, 目标.partnerUuid],
  );
  const 关系 = result.rows[0]?.relationship;
  if (!关系) {
    throw new 应用错误(
      "V3_CHANNEL_SCOPE_FORBIDDEN",
      "仅可查看当前渠道及其直属上下级渠道档案。",
      403,
    );
  }
  return 关系;
}

async function 校验渠道自身经营数据范围(
  pool: 数据库查询器,
  id: string,
  上下文: 业务用户上下文 | null,
): Promise<void> {
  if (!是渠道账号上下文(上下文)) return;
  const 关系 = await 解析渠道档案关系(pool, id, 上下文);
  if (关系 !== "self") {
    throw new 应用错误(
      "V3_CHANNEL_RELATED_SUMMARY_FORBIDDEN",
      "直属上下级渠道仅可查看基础档案，不可查看经营摘要和年度目标。",
      403,
    );
  }
}

async function 校验渠道商维护范围(
  pool: 数据库查询器,
  id: string,
  上下文: 业务用户上下文 | null,
): Promise<渠道商维护目标> {
  const result = await pool.query<{
    partner_uuid: string;
    partner_id: string;
    partner_name: string;
    region_id: string | null;
    region_name: string | null;
    extra_region: string | null;
    level: string;
    cooperation_level: string | null;
  }>(
    `
    SELECT
      p.id::text AS partner_uuid,
      COALESCE(p.v2_source_id, p.partner_code, p.id::text) AS partner_id,
      p.partner_name,
      p.region_id::text AS region_id,
      reg.region_name,
      p.extra_json->>'region' AS extra_region,
      p.partner_level_code AS level,
      COALESCE(p.extra_json->>'cooperationLevel', p.extra_json->>'level', '') AS cooperation_level
    FROM channel.partners p
    LEFT JOIN org.regions reg ON reg.id = p.region_id
    WHERE p.id::text = $1 OR p.v2_source_id = $1 OR p.partner_code = $1
    LIMIT 1
    `,
    [id],
  );
  const row = result.rows[0];
  if (!row) throw Object.assign(new Error("渠道商不存在。"), { statusCode: 404 });
  if (上下文?.roleCode === "region_manager") {
    const 同区域 =
      (Boolean(上下文.regionId) && row.region_id === 上下文.regionId) ||
      (Boolean(上下文.regionName) &&
        [row.region_name, row.extra_region].filter(Boolean).includes(上下文.regionName));
    if (!同区域) {
      throw new 应用错误("V3_CHANNEL_REGION_FORBIDDEN", "区域管理员只能维护本区域渠道商。", 403);
    }
  }
  return {
    partnerUuid: row.partner_uuid,
    partnerId: row.partner_id,
    partnerName: row.partner_name,
    regionId: row.region_id || "",
    regionName: row.region_name || row.extra_region || "",
    level: row.level || "none",
    cooperationLevel: row.cooperation_level || "none",
  };
}

async function 写入渠道商审计(db: Pool | PoolClient, 参数信息: 渠道商审计参数): Promise<void> {
  await db.query(
    `
    INSERT INTO audit.audit_logs(
      created_at, request_id, actor_user_id, actor_username, actor_name, actor_role,
      module_code, action_code, target_type, target_id, target_name, result_code,
      message, ip, user_agent, before_json, after_json, extra_json
    ) VALUES(
      now(), $1, $2::uuid, $3, $4, $5,
      'channel', $6, 'partner', $7, $8, 'success',
      $9, $10::inet, $11, $12::jsonb, $13::jsonb, $14::jsonb
    )
    `,
    [
      参数信息.request?.requestId || "",
      参数信息.actor?.userId || null,
      参数信息.actor?.username || "system",
      参数信息.actor?.displayName || 参数信息.actor?.username || "系统",
      参数信息.actor?.roleName || "兼容入口",
      参数信息.action,
      参数信息.partnerId,
      参数信息.partnerName,
      参数信息.message,
      参数信息.request?.ip || null,
      参数信息.request?.headers["user-agent"] || "",
      JSON.stringify(参数信息.before ?? null),
      JSON.stringify(参数信息.after ?? null),
      JSON.stringify({
        method: 参数信息.request?.method || "",
        path: 参数信息.request?.path || "",
      }),
    ],
  );
}

interface 渠道成员审计参数 {
  action:
    | "channel_member.created"
    | "channel_member.updated"
    | "channel_member.enabled"
    | "channel_member.disabled"
    | "channel_member.archived";
  actor: 当前业务用户 | null;
  partnerId: string;
  memberId: string;
  memberName: string;
  message: string;
  before?: unknown;
  after?: unknown;
}

/** 渠道成员属于渠道域，审计分类必须使用 channel_member，而不是 organization。 */
async function 写入渠道成员审计(db: Pool | PoolClient, 参数信息: 渠道成员审计参数): Promise<void> {
  await db.query(
    `
    INSERT INTO audit.audit_logs(
      created_at, request_id, actor_user_id, actor_username, actor_name, actor_role,
      module_code, action_code, target_type, target_id, target_name, result_code,
      message, before_json, after_json, extra_json
    ) VALUES(
      now(), $1, NULLIF($2, '')::uuid, $3, $4, $5,
      'channel_member', $6, 'channel_member', $7, $8, 'success',
      $9, $10::jsonb, $11::jsonb, $12::jsonb
    )
    `,
    [
      参数信息.actor?.requestId || "",
      参数信息.actor?.userId || "",
      参数信息.actor?.username || "system",
      参数信息.actor?.displayName || 参数信息.actor?.username || "系统",
      参数信息.actor?.roleName || "兼容入口",
      参数信息.action,
      参数信息.memberId,
      参数信息.memberName,
      参数信息.message,
      JSON.stringify(参数信息.before ?? null),
      JSON.stringify(参数信息.after ?? null),
      JSON.stringify({ partnerId: 参数信息.partnerId, source: "v2-compat" }),
    ],
  );
}

interface 审批审计参数 {
  actor: 当前业务用户 | null;
  approvalId: string;
  targetType: string;
  targetId: string;
  targetName: string;
  status: string;
  reason: string;
  approvalStage?: string;
  resubmitted?: boolean;
}

/** 审批留痕按实际业务域归集，保证客户、订单、渠道和后台管理分类都能检索到。 */
async function 写入审批审计(db: Pool | PoolClient, 参数信息: 审批审计参数): Promise<void> {
  const 模块 =
    参数信息.targetType === "registration"
      ? "registration"
      : ["order", "order_revision"].includes(参数信息.targetType)
        ? "order"
        : 参数信息.targetType === "partner"
          ? "partner"
          : "channel_account";
  const 动作 = 参数信息.resubmitted
    ? "approval.resubmitted"
    : 参数信息.status === "pending"
      ? "approval.region_approved"
      : 参数信息.status === "approved"
        ? "approval.approved"
        : "approval.rejected";
  await db.query(
    `
    INSERT INTO audit.audit_logs(
      created_at, request_id, actor_user_id, actor_username, actor_name, actor_role,
      module_code, action_code, target_type, target_id, target_name, result_code,
      message, before_json, after_json, extra_json
    ) VALUES(
      now(), $1, NULLIF($2, '')::uuid, $3, $4, $5,
      $6, $7, $8, $9, $10, 'success',
      $11, '{}'::jsonb, $12::jsonb, $13::jsonb
    )
    `,
    [
      参数信息.actor?.requestId || "",
      参数信息.actor?.userId || "",
      参数信息.actor?.username || "system",
      参数信息.actor?.displayName || 参数信息.actor?.username || "系统",
      参数信息.actor?.roleName || "兼容入口",
      模块,
      动作,
      参数信息.targetType,
      参数信息.approvalId,
      参数信息.targetName || 参数信息.targetId || "审批事项",
      参数信息.resubmitted
        ? "审批事项已重新提交"
        : 参数信息.status === "pending"
          ? "区管初审通过，进入下一审批阶段"
          : 参数信息.status === "approved"
            ? "审批已通过"
            : "审批已驳回",
      JSON.stringify({
        status: 参数信息.status,
        reason: 参数信息.reason,
        approvalStage: 参数信息.approvalStage || "",
      }),
      JSON.stringify({
        approvalId: 参数信息.approvalId,
        businessTargetId: 参数信息.targetId,
        businessTargetType: 参数信息.targetType,
        source: "v2-compat",
      }),
    ],
  );
}

interface 渠道年度订单目标 {
  year: number;
  targetAmount: number;
  remark: string;
  updatedAt: string;
}

async function 查询渠道年度订单目标(
  db: 数据库查询器,
  partnerId: string,
  yearInput?: unknown,
): Promise<渠道年度订单目标> {
  const 目标 = await 校验渠道商维护范围(db, partnerId, null);
  const 年份结果 = await db.query<{ year: number }>(
    "SELECT EXTRACT(YEAR FROM now() AT TIME ZONE 'Asia/Shanghai')::integer AS year",
  );
  const 当前年份 = Number(年份结果.rows[0]?.year) || new Date().getFullYear();
  const 请求年份 = Number(Array.isArray(yearInput) ? yearInput[0] : yearInput);
  const year =
    Number.isInteger(请求年份) && 请求年份 >= 2000 && 请求年份 <= 9999 ? 请求年份 : 当前年份;
  const result = await db.query<{
    target_amount: string | number;
    remark: string;
    updated_at: Date;
  }>(
    `
    SELECT target_amount, remark, updated_at
    FROM channel.partner_order_targets
    WHERE partner_id = $1::uuid AND target_year = $2
    LIMIT 1
    `,
    [目标.partnerUuid, year],
  );
  const 行 = result.rows[0];
  return {
    year,
    targetAmount: Number(行?.target_amount || 0),
    remark: 行?.remark || "",
    updatedAt: 行?.updated_at?.toISOString() || "",
  };
}

function 查询目标实际完成金额(订单金额: number): number {
  return Math.round(Number(订单金额 || 0) * 100) / 100;
}

async function 保存渠道年度订单目标(
  pool: Pool,
  partnerId: string,
  输入: 字典,
  维护身份: 业务用户上下文,
  req: Request,
): Promise<渠道年度订单目标 & { actualOrderAmount: number }> {
  const 目标 = await 校验渠道商维护范围(pool, partnerId, 维护身份);
  const 年份结果 = await pool.query<{ year: number }>(
    "SELECT EXTRACT(YEAR FROM now() AT TIME ZONE 'Asia/Shanghai')::integer AS year",
  );
  const 当前年份 = Number(年份结果.rows[0]?.year) || new Date().getFullYear();
  const 年份原始值 = 读取正文数字(输入, ["year", "targetYear", "年度"], 0);
  const year =
    Number.isInteger(年份原始值) && 年份原始值 >= 2000 && 年份原始值 <= 9999
      ? 年份原始值
      : 当前年份;
  const 目标金额 = 读取正文数字(输入, ["targetAmount", "orderTargetAmount", "订单目标金额"], -1);
  if (目标金额 < 0 || 目标金额 > 999_999_999_999.99) {
    throw new 应用错误("V3_CHANNEL_ORDER_TARGET_INVALID", "请输入有效的年度订单目标金额。", 400);
  }
  const 备注 = 读取正文文本(输入, ["remark", "备注"], "");
  if (备注.length > 500) {
    throw new 应用错误(
      "V3_CHANNEL_ORDER_TARGET_REMARK_INVALID",
      "目标备注不能超过500个字符。",
      400,
    );
  }
  const 原目标 = await 查询渠道年度订单目标(pool, 目标.partnerUuid, year);
  const result = await pool.query<{ updated_at: Date }>(
    `
    INSERT INTO channel.partner_order_targets (
      partner_id, target_year, target_amount, remark, updated_by_user_id, updated_at
    )
    VALUES ($1::uuid, $2, $3, $4, $5::uuid, now())
    ON CONFLICT (partner_id, target_year) DO UPDATE
    SET target_amount = EXCLUDED.target_amount,
        remark = EXCLUDED.remark,
        updated_by_user_id = EXCLUDED.updated_by_user_id,
        updated_at = now()
    RETURNING updated_at
    `,
    [目标.partnerUuid, year, 目标金额, 备注, 维护身份.userId || null],
  );
  const 新目标 = {
    year,
    targetAmount: 目标金额,
    remark: 备注,
    updatedAt: result.rows[0]?.updated_at?.toISOString() || new Date().toISOString(),
  };
  await 写入渠道商审计(pool, {
    action: "partner.order_target.update",
    actor: 维护身份,
    partnerId: 目标.partnerId,
    partnerName: 目标.partnerName,
    before: 原目标,
    after: 新目标,
    request: req,
    message: `维护渠道商「${目标.partnerName}」${year} 年订单目标金额。`,
  });
  const 实际订单金额 = await 查询渠道实际订单金额(pool, 目标.partnerId, year);
  return { ...新目标, actualOrderAmount: 查询目标实际完成金额(实际订单金额) };
}

async function 查询渠道实际订单金额(
  db: 数据库查询器,
  partnerId: string,
  year: number,
): Promise<number> {
  const result = await db.query<{
    order_amount: string | number;
  }>(
    `
    SELECT COALESCE(SUM(o.total_amount), 0) AS order_amount
    FROM crm.orders o
    JOIN channel.partners p ON p.id = o.partner_id
    WHERE (p.id::text = $1 OR p.v2_source_id = $1 OR p.partner_code = $1)
      AND o.status_code IN ('confirmed', 'processing', 'shipped', 'completed')
      AND EXTRACT(YEAR FROM o.created_at AT TIME ZONE 'Asia/Shanghai') = $2
    `,
    [partnerId, year],
  );
  return Number(result.rows[0]?.order_amount || 0);
}

async function 保存V2渠道商(
  pool: Pool,
  id: string,
  输入: 字典,
  当前用户: 当前业务用户 | null = null,
  维护身份: 业务用户上下文 | null = null,
  请求: Request | null = null,
) {
  const name = 读取正文文本(输入, ["name", "partnerName"], "");
  if (!name) throw Object.assign(new Error("请输入渠道商名称。"), { statusCode: 400 });
  const code = id || 读取正文文本(输入, ["id", "partnerId", "code"], `PARTNER-V3-${Date.now()}`);
  const 分销层级已提供 = ["partnerLevel", "分销层级"].some((key) =>
    Object.prototype.hasOwnProperty.call(输入, key),
  );
  const 合作级别已提供 = ["cooperationLevel", "合作级别", "level"].some((key) =>
    Object.prototype.hasOwnProperty.call(输入, key),
  );
  const 分销层级 = 规范分销层级(读取正文文本(输入, ["partnerLevel", "分销层级"], "none"));
  if (分销层级 === null) {
    throw Object.assign(new Error("渠道分销层级只能为未设置、一级或二级。"), { statusCode: 400 });
  }
  const 合作级别 = 规范合作级别(
    读取正文文本(输入, ["cooperationLevel", "合作级别", "level"], "none"),
  );
  const 状态已提供 = ["status", "状态"].some((key) =>
    Object.prototype.hasOwnProperty.call(输入, key),
  );
  const 输入状态 = 读取正文文本(输入, ["status", "状态"], "");
  const 已登录账号 = 当前用户?.username ? await 查询V2用户(pool, 当前用户.username, true) : null;
  const 是否新建 = !id;
  const 目标状态 = 是否新建
    ? 维护身份?.roleCode === "region_manager"
      ? "pending"
      : 维护身份?.roleCode === "superadmin"
        ? 输入状态 || "active"
        : 输入状态 || (已登录账号?.role === "admin" ? "pending" : "active")
    : 输入状态 || "active";
  const 协议编号已提供 = ["agreementNo", "agreement_no", "协议编号"].some((key) =>
    Object.prototype.hasOwnProperty.call(输入, key),
  );
  const 国家电话区号已提供 = ["countryCallingCode", "country_calling_code", "国家电话区号"].some(
    (key) => Object.prototype.hasOwnProperty.call(输入, key),
  );
  const agreementNo = 读取正文文本(输入, ["agreementNo", "agreement_no", "协议编号"], "").trim();
  const countryCallingCode = 读取正文文本(
    输入,
    ["countryCallingCode", "country_calling_code", "国家电话区号"],
    "86",
  ).trim();
  if (countryCallingCode && !/^[0-9]{2,4}$/.test(countryCallingCode)) {
    throw Object.assign(new Error("地市区号必须为 2 至 4 位数字。"), { statusCode: 400 });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const 维护目标 = id && 维护身份 ? await 校验渠道商维护范围(client, id, 维护身份) : null;
    if (agreementNo) {
      const existing = await client.query<{ id: string }>(
        `
      SELECT id::text AS id
      FROM channel.partners
      WHERE agreement_no = $1
        AND NOT (id::text = $2 OR v2_source_id = $2 OR partner_code = $2)
      LIMIT 1
      `,
        [agreementNo, id],
      );
      if (existing.rows[0]) {
        throw Object.assign(new Error("协议编号已被其他渠道商使用。"), { statusCode: 409 });
      }
    }
    const extra = {
      ...输入,
      id: code,
      name,
      partnerName: name,
      ...(合作级别已提供 ? { level: 合作级别, cooperationLevel: 合作级别 } : {}),
      ...(分销层级已提供 ? { partnerLevel: 分销层级 } : {}),
      ...(是否新建 ? { status: 目标状态 } : {}),
      agreementNo,
      countryCallingCode: countryCallingCode || "",
    };
    const 输入区域名称 = 读取正文文本(输入, ["region", "区域"], "").trim();
    const 受控区域名称 =
      维护身份?.roleCode === "region_manager" ? 维护身份.regionName.trim() : 输入区域名称;
    const regionName = 受控区域名称 || 维护目标?.regionName || "";
    Object.assign(extra, {
      region: regionName,
      ...(是否新建 ? { partnerLevel: 分销层级, level: 合作级别, cooperationLevel: 合作级别 } : {}),
    });
    const 受控区域编号 = 维护身份?.roleCode === "region_manager" ? 维护身份.regionId.trim() : "";
    if (维护身份?.roleCode === "region_manager" && !受控区域编号 && !regionName) {
      throw new 应用错误("V3_CHANNEL_REGION_REQUIRED", "区域管理员未绑定有效区域。", 403);
    }
    const regionResult = 受控区域编号
      ? await client.query<{ id: string }>("SELECT $1::uuid::text AS id", [受控区域编号])
      : regionName
        ? await client.query<{ id: string }>(
            `SELECT id::text AS id FROM org.regions WHERE region_name = $1 OR region_code = $1 LIMIT 1`,
            [regionName],
          )
        : { rows: [] as Array<{ id: string }> };
    const regionUuid = regionResult.rows[0]?.id || null;
    if (维护身份?.roleCode === "region_manager" && !regionUuid) {
      throw new 应用错误("V3_CHANNEL_REGION_NOT_FOUND", "未找到区域管理员所属区域。", 403);
    }
    const params = [
      code,
      name,
      migrationNormalizedName(name),
      分销层级,
      读取正文文本(输入, ["city"], ""),
      读取正文文本(输入, ["contact", "contactName"], ""),
      读取正文文本(输入, ["phone", "contactPhone"], ""),
      读取正文文本(输入, ["email", "contactEmail"], ""),
      转V3伙伴状态(目标状态),
      JSON.stringify(extra),
      agreementNo,
      countryCallingCode,
      协议编号已提供,
      国家电话区号已提供,
      regionUuid,
      状态已提供,
      分销层级已提供,
    ];

    let 渠道UUID = "";
    let 当前状态 = 目标状态;
    if (id) {
      const result = await client.query<{ id: string; status_code: string }>(
        `
      UPDATE channel.partners
      SET partner_name = $2,
          normalized_name = $3,
          partner_level_code = CASE WHEN $17 THEN $4 ELSE partner_level_code END,
          city_name = NULLIF($5, ''),
          contact_name = NULLIF($6, ''),
          contact_phone = NULLIF($7, ''),
          contact_email = NULLIF($8, '')::citext,
          status_code = CASE WHEN $16 THEN $9 ELSE status_code END,
          region_id = COALESCE($15::uuid, region_id),
          agreement_no = CASE WHEN $13 THEN NULLIF($11, '') ELSE agreement_no END,
          country_calling_code = CASE WHEN $14 THEN NULLIF($12, '') ELSE country_calling_code END,
          updated_at = now(),
          extra_json = extra_json || $10::jsonb
      WHERE id::text = $1 OR v2_source_id = $1 OR partner_code = $1
      RETURNING id::text AS id, status_code
      `,
        params,
      );
      if (!result.rows[0]) throw Object.assign(new Error("渠道商不存在。"), { statusCode: 404 });
      渠道UUID = result.rows[0].id;
      当前状态 = result.rows[0].status_code;
    } else {
      // 新建只能插入新记录，不能通过请求体里的历史编号覆盖其他渠道商。
      const 已有编号 = await client.query<{ id: string }>(
        `
        SELECT id::text AS id
        FROM channel.partners
        WHERE id::text = $1 OR v2_source_id = $1 OR partner_code = $1 OR extra_json->>'id' = $1
        LIMIT 1
        `,
        [code],
      );
      if (已有编号.rows[0]) {
        throw Object.assign(new Error("渠道商编号已存在，请使用新的渠道商编号。"), {
          statusCode: 409,
        });
      }
      const 新建参数 = [...params.slice(0, 12), regionUuid];
      try {
        const result = await client.query<{ id: string; status_code: string }>(
          `
        INSERT INTO channel.partners (
          v2_source_id, partner_code, partner_name, normalized_name, partner_level_code,
          city_name, contact_name, contact_phone, contact_email, status_code, region_id, extra_json,
          agreement_no, country_calling_code
        )
        VALUES ($1, $1, $2, $3, $4, NULLIF($5, ''), NULLIF($6, ''), NULLIF($7, ''), NULLIF($8, '')::citext, $9, $13::uuid, $10::jsonb, NULLIF($11, ''), NULLIF($12, ''))
        RETURNING id::text AS id, status_code
        `,
          新建参数,
        );
        渠道UUID = result.rows[0]?.id || "";
        当前状态 = result.rows[0]?.status_code || 当前状态;
      } catch (错误) {
        if ((错误 as { code?: string }).code === "23505") {
          throw Object.assign(new Error("渠道商编号已存在，请使用新的渠道商编号。"), {
            statusCode: 409,
          });
        }
        throw 错误;
      }
    }

    const 需要创建审批待办 =
      (是否新建 && 当前状态 === "pending") || (!是否新建 && 输入状态 === "pending");
    if (需要创建审批待办 && 渠道UUID) {
      const 申请人UUID = 当前用户?.username ? await 查找用户UUID(client, 当前用户.username) : null;
      await 写入渠道商审批待办(client, {
        渠道UUID,
        渠道编号: code,
        申请人UUID,
        输入,
        当前用户,
      });
    }

    if (渠道UUID && 分销层级已提供) {
      const 关系目标 = await 校验渠道商维护范围(client, 渠道UUID, 维护身份);
      await 保存渠道商层级关系(client, {
        目标: 关系目标,
        分销层级,
        上级渠道编号: 读取对象字符串数组(输入, "parentPartnerIds"),
      });
    }

    if (维护身份 && 渠道UUID) {
      await 写入渠道商审计(client, {
        action: 是否新建 ? "partner.create" : "partner.profile.update",
        actor: 维护身份,
        partnerId: code,
        partnerName: name,
        before: 维护目标,
        after: { ...extra, status: 当前状态, partnerLevel: 分销层级 },
        request: 请求 || undefined,
        message: 是否新建 ? "新建渠道商" : "更新渠道商主档",
      });
    }

    await client.query("COMMIT");
    return {
      ...extra,
      id: code,
      name,
      partnerName: name,
      region: regionName,
      partnerLevel: 分销层级,
      cooperationLevel: 合作级别,
      status: 当前状态,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function 规范分销层级(value: string): "none" | "primary" | "secondary" | null {
  const 代码 = value.trim().toLowerCase();
  const 映射: Record<string, "none" | "primary" | "secondary"> = {
    none: "none",
    "": "none",
    未设置: "none",
    无: "none",
    primary: "primary",
    一级: "primary",
    一级渠道: "primary",
    一级渠道商: "primary",
    secondary: "secondary",
    二级: "secondary",
    二级渠道: "secondary",
    二级渠道商: "secondary",
  };
  return 映射[代码] || null;
}

function 规范合作级别(value: string): string {
  const 代码 = value.trim().toLowerCase();
  const 映射: Record<string, string> = {
    none: "none",
    "": "none",
    未设置: "none",
    lep: "lep",
    核心渠道: "lep",
    diamond: "diamond",
    钻石: "diamond",
    gold: "gold",
    金牌: "gold",
    silver: "silver",
    银牌: "silver",
    bronze: "bronze",
    铜牌: "bronze",
    industry: "industry",
    行业总代: "industry",
  };
  return 映射[代码] || "none";
}

async function 保存渠道商层级关系(
  db: Pool | PoolClient,
  参数信息: {
    目标: 渠道商维护目标;
    分销层级: "none" | "primary" | "secondary";
    上级渠道编号: string[];
  },
): Promise<string[]> {
  const 上级编号 = Array.from(
    new Set(参数信息.上级渠道编号.map((item) => item.trim()).filter(Boolean)),
  );
  if (参数信息.分销层级 !== "primary") {
    const 已有下级 = await db.query<{ exists: boolean }>(
      `
      SELECT EXISTS(
        SELECT 1
        FROM channel.partner_relations relation
        JOIN channel.partners child ON child.id = relation.child_partner_id
        WHERE relation.parent_partner_id = $1::uuid
          AND relation.ended_at IS NULL
          AND child.status_code <> 'archived'
      ) AS exists
      `,
      [参数信息.目标.partnerUuid],
    );
    if (已有下级.rows[0]?.exists) {
      throw Object.assign(new Error("该渠道商仍绑定有下级渠道商，不能改为非一级渠道商。"), {
        statusCode: 409,
      });
    }
  }
  if (参数信息.分销层级 !== "secondary") {
    await db.query("DELETE FROM channel.partner_relations WHERE child_partner_id = $1::uuid", [
      参数信息.目标.partnerUuid,
    ]);
    return [];
  }
  if (!上级编号.length) {
    throw Object.assign(new Error("二级渠道商必须至少绑定一个一级渠道商。"), { statusCode: 400 });
  }

  const 已确认上级: Array<{ partnerUuid: string; partnerId: string }> = [];
  for (const 上级编号项 of 上级编号) {
    const result = await db.query<{
      partner_uuid: string;
      partner_id: string;
      partner_name: string;
      level: string;
      status: string;
      region_id: string | null;
      region_name: string | null;
      extra_region: string | null;
      has_children: boolean;
    }>(
      `
      SELECT
        p.id::text AS partner_uuid,
        COALESCE(p.v2_source_id, p.partner_code, p.id::text) AS partner_id,
        p.partner_name,
        p.partner_level_code AS level,
        p.status_code AS status,
        p.region_id::text AS region_id,
        reg.region_name,
        p.extra_json->>'region' AS extra_region,
        EXISTS(
          SELECT 1
          FROM channel.partner_relations child_relation
          JOIN channel.partners child ON child.id = child_relation.child_partner_id
          WHERE child_relation.parent_partner_id = p.id
            AND child_relation.ended_at IS NULL
            AND child.status_code <> 'archived'
        ) AS has_children
      FROM channel.partners p
      LEFT JOIN org.regions reg ON reg.id = p.region_id
      WHERE p.id::text = $1 OR p.v2_source_id = $1 OR p.partner_code = $1
      LIMIT 1
      `,
      [上级编号项],
    );
    const 上级 = result.rows[0];
    if (!上级) {
      throw Object.assign(new Error(`上级渠道商不存在：${上级编号项}。`), { statusCode: 400 });
    }
    if (上级.partner_uuid === 参数信息.目标.partnerUuid) {
      throw Object.assign(new Error("渠道商不能绑定自身为上级渠道商。"), { statusCode: 400 });
    }
    if ((上级.level !== "primary" && !上级.has_children) || 上级.status !== "active") {
      throw Object.assign(new Error("上级渠道商必须是生效中的一级渠道商。"), { statusCode: 400 });
    }
    const 同区域 =
      (Boolean(参数信息.目标.regionId) && 上级.region_id === 参数信息.目标.regionId) ||
      (Boolean(参数信息.目标.regionName) &&
        [上级.region_name, 上级.extra_region].filter(Boolean).includes(参数信息.目标.regionName));
    if (!同区域) {
      throw Object.assign(new Error("二级渠道商只能绑定同区域的一级渠道商。"), { statusCode: 400 });
    }
    const 环 = await db.query<{ exists: boolean }>(
      `
      WITH RECURSIVE 下级 AS (
        SELECT child_partner_id
        FROM channel.partner_relations
        WHERE parent_partner_id = $1::uuid AND ended_at IS NULL
        UNION ALL
        SELECT relation.child_partner_id
        FROM channel.partner_relations relation
        JOIN 下级 ON relation.parent_partner_id = 下级.child_partner_id
        WHERE relation.ended_at IS NULL
      )
      SELECT EXISTS(SELECT 1 FROM 下级 WHERE child_partner_id = $2::uuid) AS exists
      `,
      [参数信息.目标.partnerUuid, 上级.partner_uuid],
    );
    if (环.rows[0]?.exists) {
      throw Object.assign(new Error("渠道分销关系不能形成循环。"), { statusCode: 400 });
    }
    已确认上级.push({ partnerUuid: 上级.partner_uuid, partnerId: 上级.partner_id });
  }

  await db.query("DELETE FROM channel.partner_relations WHERE child_partner_id = $1::uuid", [
    参数信息.目标.partnerUuid,
  ]);
  for (const 上级 of 已确认上级) {
    await db.query(
      `
      INSERT INTO channel.partner_relations (parent_partner_id, child_partner_id, relation_code)
      VALUES ($1::uuid, $2::uuid, 'primary_secondary')
      ON CONFLICT DO NOTHING
      `,
      [上级.partnerUuid, 参数信息.目标.partnerUuid],
    );
  }
  return 已确认上级.map((上级) => 上级.partnerId);
}

async function 更新渠道商状态(
  pool: Pool,
  id: string,
  status: string,
  输入: 字典,
  当前用户: 当前业务用户 | null = null,
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const 变更前结果 = await client.query<{
      id: string;
      external_id: string;
      partner_name: string;
      status_code: string;
      partner_level_code: string | null;
    }>(
      `
      SELECT id::text AS id,
             COALESCE(v2_source_id, partner_code, id::text) AS external_id,
             partner_name,
             status_code,
             partner_level_code
      FROM channel.partners
      WHERE id::text = $1 OR v2_source_id = $1 OR partner_code = $1
      FOR UPDATE
      `,
      [id],
    );
    const 变更前 = 变更前结果.rows[0];
    if (!变更前) throw Object.assign(new Error("渠道商不存在。"), { statusCode: 404 });
    const result = await client.query<{ id: string; external_id: string; partner_name: string }>(
      `
      UPDATE channel.partners
      SET status_code = $2,
          updated_at = now(),
          extra_json = extra_json || $3::jsonb
      WHERE id::text = $1 OR v2_source_id = $1 OR partner_code = $1
      RETURNING id::text AS id, COALESCE(v2_source_id, partner_code, id::text) AS external_id, partner_name
      `,
      [id, 转V3伙伴状态(status), JSON.stringify({ ...输入, status })],
    );
    const row = result.rows[0];
    if (!row) throw Object.assign(new Error("渠道商不存在。"), { statusCode: 404 });
    if (status === "pending") {
      const 申请人UUID = 当前用户?.username ? await 查找用户UUID(client, 当前用户.username) : null;
      await 写入渠道商审批待办(client, {
        渠道UUID: row.id,
        渠道编号: row.external_id,
        申请人UUID,
        输入,
        当前用户,
      });
    } else if (status === "active" || status === "rejected") {
      const 审批 = await client.query<{ id: string; status_code: string }>(
        `
        SELECT id::text AS id, status_code
        FROM ops.approvals
        WHERE target_type = 'partner' AND target_id = $1::uuid
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE
        `,
        [row.id],
      );
      const 审批记录 = 审批.rows[0];
      if (审批记录 && 审批记录.status_code === "pending") {
        const 审批状态 = status === "active" ? "approved" : "rejected";
        const 原因 = 读取对象文本(输入, "remark") || 读取对象文本(输入, "reason");
        await client.query(
          `
          UPDATE ops.approvals
          SET status_code = $2, updated_at = now(), extra_json = extra_json || $3::jsonb
          WHERE id = $1::uuid
          `,
          [
            审批记录.id,
            审批状态,
            JSON.stringify({
              status: 审批状态,
              reviewRemark: 原因,
              reviewedByName: 当前用户?.displayName || "",
            }),
          ],
        );
        await client.query(
          `
          INSERT INTO ops.approval_events (approval_id, event_code, from_status_code, to_status_code, reason, extra_json)
          VALUES ($1::uuid, $2, $3, $4, $5, $6::jsonb)
          `,
          [
            审批记录.id,
            审批状态 === "approved" ? "approve" : "reject",
            审批记录.status_code,
            审批状态,
            原因,
            JSON.stringify({ actorName: 当前用户?.displayName || "" }),
          ],
        );
        await 写入审批审计(client, {
          actor: 当前用户,
          approvalId: 审批记录.id,
          targetType: "partner",
          targetId: row.id,
          targetName: row.partner_name,
          status: 审批状态,
          reason: 原因,
        });
      }
    }
    await 写入渠道商审计(client, {
      action: "partner.status.update",
      actor: 当前用户,
      partnerId: row.external_id,
      partnerName: row.partner_name,
      before: {
        status: 变更前.status_code,
        partnerLevel: 变更前.partner_level_code || "none",
      },
      after: {
        status: 转V3伙伴状态(status),
        requestStatus: status,
      },
      message: "更新渠道商状态",
    });
    await client.query("COMMIT");
    return { id: row.external_id, name: row.partner_name, partnerName: row.partner_name, status };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function 保存渠道商分销层级(
  pool: Pool,
  id: string,
  输入: 字典,
  维护身份: 业务用户上下文,
  请求?: Request,
) {
  const 分销层级 = 规范分销层级(读取正文文本(输入, ["partnerLevel", "分销层级"], "none"));
  if (分销层级 === null) {
    throw Object.assign(new Error("渠道分销层级只能为未设置、一级或二级。"), { statusCode: 400 });
  }
  const parentPartnerIds = 读取对象字符串数组(输入, "parentPartnerIds");
  const 合作级别已提供 = ["cooperationLevel", "合作级别"].some((key) =>
    Object.prototype.hasOwnProperty.call(输入, key),
  );
  const 合作级别 = 规范合作级别(读取正文文本(输入, ["cooperationLevel", "合作级别"], "none"));
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const 目标 = await 校验渠道商维护范围(client, id, 维护身份);
    const 已保存上级 = await 保存渠道商层级关系(client, {
      目标,
      分销层级,
      上级渠道编号: parentPartnerIds,
    });
    const extra = {
      partnerLevel: 分销层级,
      parentPartnerIds: 已保存上级,
      ...(合作级别已提供 ? { cooperationLevel: 合作级别, level: 合作级别 } : {}),
    };
    await client.query(
      `
      UPDATE channel.partners
      SET partner_level_code = $2,
          updated_at = now(),
          extra_json = extra_json || $3::jsonb
      WHERE id = $1::uuid
      `,
      [目标.partnerUuid, 分销层级, JSON.stringify(extra)],
    );
    await 写入渠道商审计(client, {
      action: "partner.level.update",
      actor: 维护身份,
      partnerId: 目标.partnerId,
      partnerName: 目标.partnerName,
      before: {
        partnerLevel: 目标.level,
        cooperationLevel: 目标.cooperationLevel,
      },
      after: {
        partnerLevel: 分销层级,
        cooperationLevel: 合作级别已提供 ? 合作级别 : 目标.cooperationLevel,
        parentPartnerIds: 已保存上级,
      },
      request: 请求,
      message: "维护渠道商合作级别与分销层级",
    });
    await client.query("COMMIT");
    return {
      id: 目标.partnerId,
      partnerLevel: 分销层级,
      cooperationLevel: 合作级别已提供 ? 合作级别 : 目标.cooperationLevel,
      parentPartnerIds: 已保存上级,
      parentPartnerId: 已保存上级[0] || "",
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function 查询渠道商简介(
  pool: Pool,
  id: string,
  权限: {
    canEditProfile?: boolean;
    canMaintainLevel?: boolean;
    canManageProducts?: boolean;
    relationship?: 渠道档案关系;
  } = {},
) {
  const partnerUuid = await 查找渠道商UUID(pool, id);
  if (!partnerUuid) throw Object.assign(new Error("渠道商不存在。"), { statusCode: 404 });
  const result = await pool.query<{
    partner_id: string;
    partner_code: string | null;
    partner_name: string;
    agreement_no: string | null;
    country_calling_code: string | null;
    profile_id: string | null;
    member_count: number;
    extra_json: 字典 | null;
    partner_extra_json: 字典 | null;
    level: string;
    cooperation_level: string | null;
    status: string;
    region_name: string | null;
    city_name: string | null;
    parent_partner_ids: string[];
    parent_partner_names: string[];
    child_partner_ids: string[];
    child_partner_names: string[];
  }>(
    `
    SELECT
      p.id::text AS partner_id,
      COALESCE(p.v2_source_id, p.partner_code) AS partner_code,
      p.partner_name,
      p.agreement_no,
      p.country_calling_code,
      p.partner_level_code AS level,
      COALESCE(p.extra_json->>'cooperationLevel', p.extra_json->>'level', 'none') AS cooperation_level,
      p.status_code AS status,
      reg.region_name,
      p.city_name,
      COALESCE((
        SELECT jsonb_agg(COALESCE(parent.v2_source_id, parent.partner_code, parent.id::text) ORDER BY parent.partner_name)
        FROM channel.partner_relations relation
        JOIN channel.partners parent ON parent.id = relation.parent_partner_id
        WHERE relation.child_partner_id = p.id
          AND relation.relation_code = 'primary_secondary'
          AND relation.ended_at IS NULL
          AND parent.status_code <> 'archived'
      ), '[]'::jsonb) AS parent_partner_ids,
      COALESCE((
        SELECT jsonb_agg(parent.partner_name ORDER BY parent.partner_name)
        FROM channel.partner_relations relation
        JOIN channel.partners parent ON parent.id = relation.parent_partner_id
        WHERE relation.child_partner_id = p.id
          AND relation.relation_code = 'primary_secondary'
          AND relation.ended_at IS NULL
          AND parent.status_code <> 'archived'
      ), '[]'::jsonb) AS parent_partner_names,
      COALESCE((
        SELECT jsonb_agg(COALESCE(child.v2_source_id, child.partner_code, child.id::text) ORDER BY child.partner_name)
        FROM channel.partner_relations relation
        JOIN channel.partners child ON child.id = relation.child_partner_id
        WHERE relation.parent_partner_id = p.id
          AND relation.relation_code = 'primary_secondary'
          AND relation.ended_at IS NULL
          AND child.status_code <> 'archived'
      ), '[]'::jsonb) AS child_partner_ids,
      COALESCE((
        SELECT jsonb_agg(child.partner_name ORDER BY child.partner_name)
        FROM channel.partner_relations relation
        JOIN channel.partners child ON child.id = relation.child_partner_id
        WHERE relation.parent_partner_id = p.id
          AND relation.relation_code = 'primary_secondary'
          AND relation.ended_at IS NULL
          AND child.status_code <> 'archived'
      ), '[]'::jsonb) AS child_partner_names,
      pp.id::text AS profile_id,
      (
        SELECT COUNT(*)::integer
        FROM channel.partner_members pm
        WHERE pm.partner_id = p.id AND pm.archived_at IS NULL
      ) AS member_count,
      pp.extra_json,
      p.extra_json AS partner_extra_json
    FROM channel.partners p
    LEFT JOIN org.regions reg ON reg.id = p.region_id
    LEFT JOIN LATERAL (
      SELECT id, extra_json
      FROM channel.partner_profiles
      WHERE partner_id = p.id AND status_code = 'active'
      ORDER BY id
      LIMIT 1
    ) pp ON true
    WHERE p.id = $1::uuid
    `,
    [partnerUuid],
  );
  const row = result.rows[0];
  if (!row) throw Object.assign(new Error("渠道商不存在。"), { statusCode: 404 });
  const profile = row.extra_json || {};
  const partnerExtra = row.partner_extra_json || {};
  const 档案权限 = 读取对象字典(profile, "permissions") || {};
  const 上级渠道编号 = Array.isArray(row.parent_partner_ids) ? row.parent_partner_ids : [];
  const 下级渠道编号 = Array.isArray(row.child_partner_ids) ? row.child_partner_ids : [];
  // 历史一级渠道可能未回填 partner_level_code，但有效下级关系已足以证明其一级身份。
  const 有效分销层级 = 下级渠道编号.length > 0 ? "primary" : row.level || "none";
  return {
    ...partnerExtra,
    ...profile,
    id: row.profile_id || row.partner_code || row.partner_id,
    partnerId: row.partner_code || row.partner_id,
    partnerName: row.partner_name,
    agreementNo: row.agreement_no || "",
    countryCallingCode: row.country_calling_code || "",
    level: 有效分销层级,
    partnerLevel: 有效分销层级,
    cooperationLevel: row.cooperation_level || "none",
    status: row.status || "",
    parentPartnerIds: 上级渠道编号,
    parentPartnerNames: Array.isArray(row.parent_partner_names) ? row.parent_partner_names : [],
    childPartnerIds: 下级渠道编号,
    childPartnerNames: Array.isArray(row.child_partner_names) ? row.child_partner_names : [],
    childPartnerCount: 下级渠道编号.length,
    relationship: 权限.relationship || "internal",
    region: row.region_name || 读取对象文本(partnerExtra, "region"),
    city: row.city_name || 读取对象文本(partnerExtra, "city"),
    memberCount: Number(row.member_count) || 0,
    permissions: {
      ...档案权限,
      canEditProfile: 权限.canEditProfile === true,
      canMaintainLevel: 权限.canMaintainLevel === true,
      canManageProducts: 权限.canManageProducts === true,
    },
    matrix: 读取对象数组(profile, "matrix"),
  };
}

async function 保存渠道商简介(
  pool: Pool,
  id: string,
  输入: 字典,
  维护身份: 业务用户上下文 | null = null,
  请求?: Request,
) {
  const 协议编号已提供 = ["agreementNo", "agreement_no", "协议编号"].some((key) =>
    Object.prototype.hasOwnProperty.call(输入, key),
  );
  const 联系人已提供 = ["contact", "contactName"].some((key) =>
    Object.prototype.hasOwnProperty.call(输入, key),
  );
  const 电话已提供 = ["phone", "contactPhone"].some((key) =>
    Object.prototype.hasOwnProperty.call(输入, key),
  );
  if (电话已提供) {
    const 电话错误 = 校验联系电话格式(读取正文文本(输入, ["phone", "contactPhone"], ""));
    if (电话错误) throw new 应用错误("V3_PARTNER_PHONE_INVALID", 电话错误, 400);
  }
  if (Object.prototype.hasOwnProperty.call(输入, "bossPhone")) {
    const 决策人电话错误 = 校验联系电话格式(读取正文文本(输入, ["bossPhone"], ""));
    if (决策人电话错误) throw new 应用错误("V3_PARTNER_BOSS_PHONE_INVALID", 决策人电话错误, 400);
  }
  const 邮箱已提供 = ["email", "contactEmail"].some((key) =>
    Object.prototype.hasOwnProperty.call(输入, key),
  );
  const 合作级别已提供 = ["cooperationLevel", "合作级别", "level"].some((key) =>
    Object.prototype.hasOwnProperty.call(输入, key),
  );
  const 合作级别 = 规范合作级别(
    读取正文文本(输入, ["cooperationLevel", "合作级别", "level"], "none"),
  );
  const 技术服务商类型已提供 = ["techServiceType", "技术服务类型"].some((key) =>
    Object.prototype.hasOwnProperty.call(输入, key),
  );
  const 技术服务商类型 = 读取正文文本(输入, ["techServiceType", "技术服务类型"], "")
    .trim()
    .toLowerCase();
  if (技术服务商类型已提供 && !["none", "full", "developing"].includes(技术服务商类型)) {
    throw new 应用错误(
      "V3_PARTNER_TECH_SERVICE_TYPE_INVALID",
      "技术服务商类型仅支持签约技术服务商或提名技术服务商。",
      400,
    );
  }
  const agreementNo = 读取正文文本(输入, ["agreementNo", "agreement_no", "协议编号"], "").trim();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const 目标 = await 校验渠道商维护范围(client, id, 维护身份);
    const partnerUuid = 目标.partnerUuid;
    if (协议编号已提供 && agreementNo) {
      const existing = await client.query<{ id: string }>(
        `
        SELECT id::text AS id
        FROM channel.partners
        WHERE agreement_no = $1
          AND NOT (id::text = $2 OR v2_source_id = $2 OR partner_code = $2)
        LIMIT 1
        `,
        [agreementNo, partnerUuid],
      );
      if (existing.rows[0]) {
        throw Object.assign(new Error("协议编号已被其他渠道商使用。"), { statusCode: 409 });
      }
    }
    if (协议编号已提供) {
      await client.query(
        "UPDATE channel.partners SET agreement_no = NULLIF($2, ''), updated_at = now() WHERE id::text = $1",
        [partnerUuid, agreementNo],
      );
    }
    const extra = {
      ...输入,
      partnerId: id,
      updatedAt: new Date().toISOString(),
      ...(合作级别已提供 ? { cooperationLevel: 合作级别, level: 合作级别 } : {}),
      ...(技术服务商类型已提供
        ? {
            techServiceType: 技术服务商类型 || "none",
            isTechService: 技术服务商类型 === "full",
          }
        : {}),
    };
    await client.query(
      `
      UPDATE channel.partners
      SET contact_name = CASE WHEN $2 THEN NULLIF($3, '') ELSE contact_name END,
          contact_phone = CASE WHEN $4 THEN NULLIF($5, '') ELSE contact_phone END,
          contact_email = CASE WHEN $6 THEN NULLIF($7, '')::citext ELSE contact_email END,
          extra_json = extra_json || $8::jsonb,
          updated_at = now()
      WHERE id = $1::uuid
      `,
      [
        partnerUuid,
        联系人已提供,
        读取正文文本(输入, ["contact", "contactName"], ""),
        电话已提供,
        规范化联系电话(读取正文文本(输入, ["phone", "contactPhone"], "")),
        邮箱已提供,
        读取正文文本(输入, ["email", "contactEmail"], ""),
        JSON.stringify(合作级别已提供 ? { cooperationLevel: 合作级别, level: 合作级别 } : {}),
      ],
    );
    await client.query(
      `
      INSERT INTO channel.partner_profiles (v2_source_id, partner_id, profile_name, status_code, extra_json)
      VALUES ($1, $2::uuid, '渠道商信息简介', 'active', $3::jsonb)
      ON CONFLICT (v2_source_id) DO UPDATE
      SET profile_name = EXCLUDED.profile_name,
          status_code = EXCLUDED.status_code,
          extra_json = channel.partner_profiles.extra_json || EXCLUDED.extra_json
      `,
      [`PROFILE-${partnerUuid}`, partnerUuid, JSON.stringify(extra)],
    );
    if (维护身份) {
      await 写入渠道商审计(client, {
        action: "partner.profile.update",
        actor: 维护身份,
        partnerId: 目标.partnerId,
        partnerName: 目标.partnerName,
        before: 目标,
        after: 输入,
        request: 请求,
        message: "维护渠道核心档案",
      });
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return 查询渠道商简介(pool, id, { canEditProfile: true, canMaintainLevel: true });
}

async function 查询账号首个渠道成员(
  db: Pool,
  userUuid: string,
): Promise<{ role: string; partnerUuid: string; partnerExternalId: string } | null> {
  const result = await db.query<{
    member_role_code: string;
    partner_id: string;
    partner_external_id: string;
  }>(
    `
    SELECT pm.member_role_code,
      pm.partner_id::text AS partner_id,
      COALESCE(p.v2_source_id, p.partner_code, p.id::text) AS partner_external_id
    FROM channel.partner_members pm
    JOIN channel.partners p ON p.id = pm.partner_id
    WHERE pm.user_id = $1::uuid
      AND pm.archived_at IS NULL
    ORDER BY pm.started_at DESC
    LIMIT 1
    `,
    [userUuid],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    role: row.member_role_code,
    partnerUuid: row.partner_id,
    partnerExternalId: row.partner_external_id,
  };
}

async function 写入账号审批待办(
  db: Pool | PoolClient,
  参数: {
    账号UUID: string;
    账号角色: string;
    渠道UUID: string;
    渠道编号: string;
    申请人UUID: string | null;
    输入: 字典;
    当前用户: 当前业务用户 | null;
  },
): Promise<void> {
  const 快照 = await db.query<{
    partner_name: string | null;
    region_id: string | null;
    region_name: string | null;
  }>(
    `
    SELECT p.partner_name, p.region_id::text AS region_id, reg.region_name
    FROM channel.partners p
    LEFT JOIN org.regions reg ON reg.id = p.region_id
    WHERE p.id = $1::uuid
    LIMIT 1
    `,
    [参数.渠道UUID],
  );
  const row = 快照.rows[0];
  const 姓名 = 读取正文文本(参数.输入, ["name", "displayName"], "");
  const 用户名 = 读取正文文本(参数.输入, ["username"], "");
  const 提交范围 = 参数.当前用户?.username ? await 查询账号创建范围(db, 参数.当前用户) : null;
  const 提交人角色 = 参数.当前用户?.roleCode || 提交范围?.roleCode || "";
  const 审批阶段 = 初始账号审批阶段(提交人角色);
  const result = await db.query<{ id: string }>(
    `
    INSERT INTO ops.approvals (
      v2_source_id, approval_type_code, target_type, target_id, applicant_user_id,
      applicant_partner_id, status_code, created_at, updated_at, extra_json
    )
    VALUES ($1, $2, 'user', $3::uuid, $4::uuid, $5::uuid, 'pending', now(), now(), $6::jsonb)
    ON CONFLICT (v2_source_id) DO UPDATE
    SET status_code = 'pending',
        updated_at = now(),
        extra_json = (ops.approvals.extra_json - 'regionReviewedByName' - 'regionReviewedAt' - 'reviewRemark' - 'reviewedByName' - 'reviewedAt') || EXCLUDED.extra_json
    RETURNING id::text AS id
    `,
    [
      `account:${参数.账号UUID}`,
      参数.账号角色 === "partner_admin" ? "partner_admin" : "staff",
      参数.账号UUID,
      参数.申请人UUID,
      参数.渠道UUID,
      JSON.stringify({
        status: "pending",
        approvalStage: 审批阶段,
        approvalStageName: 账号审批阶段名称(审批阶段),
        stepName: 账号审批阶段名称(审批阶段),
        type: 参数.账号角色,
        targetType: "user",
        targetName: 姓名,
        username: 用户名,
        targetPartnerId: 参数.渠道编号,
        partnerId: 参数.渠道编号,
        partnerUuid: 参数.渠道UUID,
        targetPartnerName: row?.partner_name || 读取正文文本(参数.输入, ["partnerName"], ""),
        region: 读取正文文本(参数.输入, ["region"], row?.region_name || ""),
        regionId: row?.region_id || "",
        createdBy: 参数.当前用户?.displayName || 读取正文文本(参数.输入, ["createdBy"], ""),
        createdByRole: 参数.当前用户?.roleName || 读取正文文本(参数.输入, ["createdByRole"], ""),
        createdByRoleCode: 提交人角色,
        staffRole: 读取正文文本(参数.输入, ["staffRole"], ""),
        phone: 读取正文文本(参数.输入, ["phone"], ""),
        email: 读取正文文本(参数.输入, ["email"], ""),
      }),
    ],
  );
  const approvalId = result.rows[0]?.id || "";
  await db.query(
    `
    INSERT INTO ops.approval_events (approval_id, event_code, to_status_code, reason, extra_json)
    VALUES ($1::uuid, 'submit', 'pending', $2, $3::jsonb)
    `,
    [
      approvalId,
      初始账号审批阶段(提交人角色) === "region_review"
        ? "企业管理员提交员工账号，等待区管初审"
        : "账号已提交，等待超管终审",
      JSON.stringify({ actorName: 参数.当前用户?.displayName || "" }),
    ],
  );
  await 写入统一提醒发件箱事件(db, {
    事件类型: "iam.account.approval.pending",
    聚合编号: approvalId,
    聚合类型: "approval",
    载荷: { approvalId, accountId: 参数.账号UUID, partnerId: 参数.渠道UUID },
  });
}

async function 写入渠道商审批待办(
  db: Pool | PoolClient,
  参数: {
    渠道UUID: string;
    渠道编号: string;
    申请人UUID: string | null;
    输入: 字典;
    当前用户: 当前业务用户 | null;
  },
): Promise<void> {
  const 渠道快照 = await db.query<{
    partner_name: string;
    region_id: string | null;
    region_name: string | null;
  }>(
    `
    SELECT p.partner_name, p.region_id::text AS region_id, r.region_name
    FROM channel.partners p
    LEFT JOIN org.regions r ON r.id = p.region_id
    WHERE p.id = $1::uuid
    LIMIT 1
    `,
    [参数.渠道UUID],
  );
  const 渠道 = 渠道快照.rows[0];
  const result = await db.query<{ id: string }>(
    `
    INSERT INTO ops.approvals (
      v2_source_id, approval_type_code, target_type, target_id, applicant_user_id,
      applicant_partner_id, status_code, created_at, updated_at, extra_json
    )
    VALUES ($1, 'partner', 'partner', $2::uuid, $3::uuid, $2::uuid, 'pending', now(), now(), $4::jsonb)
    ON CONFLICT (v2_source_id) DO UPDATE
    SET status_code = 'pending',
        applicant_user_id = EXCLUDED.applicant_user_id,
        updated_at = now(),
        extra_json = ops.approvals.extra_json || EXCLUDED.extra_json
    RETURNING id::text AS id
    `,
    [
      `partner:${参数.渠道UUID}`,
      参数.渠道UUID,
      参数.申请人UUID,
      JSON.stringify({
        status: "pending",
        type: "partner",
        targetType: "partner",
        targetPartnerId: 参数.渠道编号,
        targetName: 渠道?.partner_name || 读取正文文本(参数.输入, ["name", "partnerName"], ""),
        targetPartnerName:
          渠道?.partner_name || 读取正文文本(参数.输入, ["name", "partnerName"], ""),
        regionId: 渠道?.region_id || "",
        region: 渠道?.region_name || 读取正文文本(参数.输入, ["region", "区域"], ""),
        createdBy: 参数.当前用户?.displayName || 读取正文文本(参数.输入, ["createdBy"], ""),
      }),
    ],
  );
  const approvalId = result.rows[0]?.id || "";
  await db.query(
    `
    INSERT INTO ops.approval_events (approval_id, event_code, to_status_code, reason, extra_json)
    VALUES ($1::uuid, 'submit', 'pending', '提交渠道商审核', $2::jsonb)
    `,
    [approvalId, JSON.stringify({ actorName: 参数.当前用户?.displayName || "" })],
  );
  await 写入统一提醒发件箱事件(db, {
    事件类型: "channel.partner.approval.pending",
    聚合编号: approvalId,
    聚合类型: "approval",
    载荷: { approvalId, partnerId: 参数.渠道UUID },
  });
}

async function 写入统一提醒发件箱事件(
  db: Pool | PoolClient,
  参数: { 事件类型: string; 聚合类型: string; 聚合编号: string; 载荷: 字典 },
): Promise<void> {
  await db.query(
    `
    INSERT INTO ops.outbox_events (
      event_type, aggregate_type, aggregate_id, payload_json, status_code, created_at
    ) VALUES ($1, $2, $3::uuid, $4::jsonb, 'pending', now())
    `,
    [参数.事件类型, 参数.聚合类型, 参数.聚合编号, JSON.stringify(参数.载荷)],
  );
}

async function 保存渠道商员工(
  pool: Pool,
  partnerId: string,
  staffId: string,
  输入: 字典,
  当前用户?: 当前业务用户 | null,
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const partnerUuid = await 查找渠道商UUID(client, partnerId);
    if (!partnerUuid) throw Object.assign(new Error("渠道商不存在。"), { statusCode: 404 });
    const 已有账号角色 = staffId ? await 查询渠道成员账号角色(client, partnerUuid, staffId) : "";
    const 账号角色 = 读取显式账号角色(输入) || 已有账号角色 || "staff";
    const 维护范围 = await 校验渠道成员维护范围(
      client,
      partnerUuid,
      当前用户 || null,
      已有账号角色,
      账号角色,
    );
    const 已有账号快照 = staffId ? await 查询V2账号保存快照(client, staffId) : null;
    const 显式状态 = 读取正文文本(输入, ["status"], "");
    // 非超管不能通过新建或编辑直接启用账号：新建一律待审批，待审批/已驳回账号继续保持待审批。
    const 成员状态文本 =
      维护范围.roleCode === "superadmin"
        ? 显式状态 || String(已有账号快照?.status || "active")
        : staffId
          ? ["pending", "rejected"].includes(String(已有账号快照?.status || ""))
            ? "pending"
            : String(已有账号快照?.status || "pending")
          : "pending";
    if (!staffId && 维护范围.roleCode === "partner_admin" && 账号角色 !== "staff") {
      throw Object.assign(new Error("企业管理员只能新建普通员工账号。"), { statusCode: 403 });
    }
    const 员工职位 = 读取员工职位(输入, 账号角色);
    const 用户 = await 保存V2用户(
      client,
      staffId,
      {
        ...输入,
        role: 账号角色,
        staffRole: 员工职位,
        partnerId,
        status: 成员状态文本,
      },
      { 同步渠道成员: false, 允许复用启用账号: true },
    );
    const userUuid = await 查找用户UUID(client, 用户.id || 用户.username);
    if (!userUuid) throw Object.assign(new Error("员工账号保存失败。"), { statusCode: 500 });
    await client.query(
      `
      INSERT INTO channel.partner_members (partner_id, user_id, member_role_code, status_code)
      VALUES ($1::uuid, $2::uuid, $3, $4)
      ON CONFLICT (partner_id, user_id) DO UPDATE
      SET member_role_code = EXCLUDED.member_role_code,
          status_code = EXCLUDED.status_code,
          ended_at = NULL,
          archived_at = NULL,
          archive_reason = NULL,
          updated_at = now(),
          row_version = channel.partner_members.row_version + 1
      `,
      [
        partnerUuid,
        userUuid,
        账号角色 === "partner_admin" ? "partner_admin" : "staff",
        转V3账号状态(成员状态文本),
      ],
    );
    // 企业管理员只维护账号角色，不绑定销售/技术业务角色，否则会被误判为非法角色。
    const 业务角色代码 = 账号角色 === "partner_admin" ? "" : 读取渠道业务角色代码(输入);
    if (业务角色代码) {
      await 同步渠道成员业务角色(client, partnerUuid, userUuid, 业务角色代码, 当前用户 || null);
    }
    if (成员状态文本 === "pending") {
      const 申请人UUID = 当前用户?.username ? await 查找用户UUID(client, 当前用户.username) : null;
      await 写入账号审批待办(client, {
        账号UUID: userUuid,
        账号角色,
        渠道UUID: partnerUuid,
        渠道编号: partnerId,
        申请人UUID,
        输入,
        当前用户: 当前用户 || null,
      });
    }
    await 写入渠道成员审计(client, {
      action: staffId ? "channel_member.updated" : "channel_member.created",
      actor: 当前用户 || null,
      partnerId: partnerUuid,
      memberId: userUuid,
      memberName:
        读取对象文本(用户, "name") || 读取对象文本(用户, "displayName") || 用户.username || "",
      message: staffId ? "渠道成员资料已更新" : "渠道成员已新增",
      before: 已有账号快照,
      after: {
        username: 用户.username || "",
        name: 读取对象文本(用户, "name") || 读取对象文本(用户, "displayName") || "",
        role: 账号角色,
        status: 成员状态文本,
      },
    });
    await client.query("COMMIT");
    return 用户;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function 同步渠道成员业务角色(
  db: 数据库查询器,
  partnerUuid: string,
  userUuid: string,
  roleCode: string,
  actor: 当前业务用户 | null,
): Promise<void> {
  const member = await db.query<{ id: string }>(
    `SELECT id::text AS id FROM channel.partner_members
       WHERE partner_id=$1::uuid AND user_id=$2::uuid AND archived_at IS NULL
       FOR UPDATE`,
    [partnerUuid, userUuid],
  );
  if (!member.rows[0]) {
    return;
  }
  const role = await db.query<{ id: string; role_name: string }>(
    `SELECT id::text AS id,role_name FROM org.business_roles
       WHERE role_code=$1 AND domain_code='channel' AND status_code='active'
       FOR UPDATE`,
    [roleCode],
  );
  if (!role.rows[0])
    throw Object.assign(new Error("销售或技术业务角色尚未初始化。"), { statusCode: 409 });
  await db.query(
    `UPDATE org.member_business_roles m
       SET expired_at=now(),row_version=m.row_version+1
       FROM org.business_roles b
       WHERE m.business_role_id=b.id AND m.partner_member_id=$1::uuid
         AND m.expired_at IS NULL AND b.domain_code='channel' AND b.id<>$2::uuid`,
    [member.rows[0].id, role.rows[0].id],
  );
  const actorUser = actor?.username
    ? await db.query<{ id: string }>(
        "SELECT id::text AS id FROM iam.users WHERE lower(username::text)=lower($1) LIMIT 1",
        [actor.username],
      )
    : null;
  await db.query(
    `INSERT INTO org.member_business_roles(
         business_role_id,partner_member_id,is_primary_display,effective_at,created_by_user_id
       )
       SELECT $1::uuid,$2::uuid,true,now(),$3::uuid
       WHERE NOT EXISTS (
         SELECT 1 FROM org.member_business_roles
         WHERE business_role_id=$1::uuid AND partner_member_id=$2::uuid AND expired_at IS NULL
       )`,
    [role.rows[0].id, member.rows[0].id, actorUser?.rows[0]?.id || null],
  );
  await db.query(
    `UPDATE iam.users
       SET extra_json=extra_json || jsonb_build_object(
         'staffRole',$1::text,'businessRoleCode',$2::text
       ),updated_at=now()
       WHERE id=$3::uuid`,
    [role.rows[0].role_name, roleCode, userUuid],
  );
  await db.query(
    `INSERT INTO audit.audit_logs(
         created_at,request_id,actor_user_id,actor_username,actor_name,actor_role,module_code,
         action_code,target_type,target_id,result_code,message,before_json,after_json,extra_json
       ) VALUES(now(),$1,$2::uuid,$3,$4,$5,'channel_member','channel_member.business_role_synced',
         'channel_member',$6,'success','兼容入口同步渠道成员业务角色','{}'::jsonb,$7::jsonb,'{}'::jsonb)`,
    [
      actor?.requestId || "",
      actorUser?.rows[0]?.id || null,
      actor?.username || "system",
      actor?.displayName || actor?.username || "系统",
      actor?.roleName || "兼容入口",
      member.rows[0].id,
      JSON.stringify({ businessRoleCode: roleCode, businessRoleName: role.rows[0].role_name }),
    ],
  );
}

/** 渠道成员维护必须同时校验操作人角色、渠道归属和区域归属，不能只依赖前端入口。 */
async function 校验渠道成员维护范围(
  pool: 数据库查询器,
  partnerUuid: string,
  当前用户: 当前业务用户 | null,
  目标现有角色 = "",
  提交账号角色 = "",
): Promise<{ roleCode: string; regionId: string; regionName: string }> {
  if (!当前用户?.username) {
    throw Object.assign(new Error("请先登录后再维护渠道成员。"), { statusCode: 401 });
  }
  const 范围 = await 查询账号创建范围(pool, 当前用户);
  if (!范围) {
    throw Object.assign(new Error("当前账号不存在或已停用。"), { statusCode: 403 });
  }
  if (范围.roleCode === "superadmin") return 范围;
  if (!["region_manager", "partner_admin"].includes(范围.roleCode)) {
    throw Object.assign(new Error("当前账号无权维护渠道成员。"), { statusCode: 403 });
  }
  if (范围.roleCode === "partner_admin" && 范围.partnerIds.length === 0) {
    throw Object.assign(new Error("企业管理员未绑定渠道商，不能维护成员。"), { statusCode: 403 });
  }
  if (范围.roleCode === "partner_admin" && !范围.partnerIds.includes(partnerUuid)) {
    throw Object.assign(new Error("企业管理员只能维护本渠道成员。"), { statusCode: 403 });
  }
  if (
    范围.roleCode === "partner_admin" &&
    (目标现有角色 === "partner_admin" || 提交账号角色 === "partner_admin")
  ) {
    throw Object.assign(new Error("企业管理员不能创建、编辑或提权企业管理员账号。"), {
      statusCode: 403,
    });
  }
  if (范围.roleCode === "region_manager") {
    const result = await pool.query<{ region_id: string | null; region_name: string | null }>(
      `
      SELECT p.region_id::text AS region_id,
        COALESCE(r.region_name, p.extra_json->>'region') AS region_name
      FROM channel.partners p
      LEFT JOIN org.regions r ON r.id = p.region_id
      WHERE p.id = $1::uuid
      LIMIT 1
      `,
      [partnerUuid],
    );
    const row = result.rows[0];
    const 同区域 =
      (Boolean(范围.regionId) && row?.region_id === 范围.regionId) ||
      (Boolean(范围.regionName) && row?.region_name === 范围.regionName);
    if (!同区域) {
      throw Object.assign(new Error("区域管理员只能维护本区域渠道成员。"), { statusCode: 403 });
    }
  }
  return 范围;
}

async function 查询账号创建范围(
  pool: 数据库查询器,
  用户: 当前业务用户,
): Promise<{
  roleCode: string;
  regionId: string;
  regionName: string;
  userId: string;
  partnerIds: string[];
} | null> {
  const result = await pool.query<{
    user_id: string;
    role_code: string | null;
    region_id: string | null;
    region_name: string | null;
    partner_ids: string[] | null;
  }>(
    `
    SELECT
      COALESCE((array_agg(r.role_code ORDER BY
        CASE r.role_code
          WHEN 'superadmin' THEN 1
          WHEN 'admin' THEN 2
          WHEN 'region_manager' THEN 3
          WHEN 'partner_admin' THEN 4
          ELSE 5
        END
      ) FILTER (WHERE r.role_code IS NOT NULL))[1], u.extra_json->>'role', 'staff') AS role_code,
      u.id::text AS user_id,
      u.region_id::text AS region_id,
      COALESCE(reg.region_name, u.extra_json->>'region') AS region_name,
      ARRAY(
        SELECT DISTINCT pm.partner_id::text
        FROM channel.partner_members pm
        WHERE pm.user_id = u.id
          AND pm.status_code = 'active'
          AND pm.archived_at IS NULL
      ) AS partner_ids
    FROM iam.users u
    LEFT JOIN iam.user_roles ur ON ur.user_id = u.id
    LEFT JOIN iam.roles r ON r.id = ur.role_id AND r.status_code = 'active'
    LEFT JOIN org.regions reg ON reg.id = u.region_id
    WHERE u.status_code = 'active'
      AND (
        ($1 <> '' AND lower(u.username::text) = lower($1))
        OR ($2 <> '' AND (u.id::text = $2 OR u.v2_source_id = $2 OR u.extra_json->>'id' = $2 OR u.extra_json->>'userId' = $2))
      )
    GROUP BY u.id, u.extra_json, reg.region_name
    LIMIT 1
    `,
    [用户.username || "", 用户.externalUserId || 用户.userId || ""],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    roleCode: row.role_code || "staff",
    regionId: row.region_id || "",
    regionName: row.region_name || "",
    userId: row.user_id,
    partnerIds: Array.isArray(row.partner_ids) ? row.partner_ids.filter(Boolean) : [],
  };
}

async function 更新渠道商员工状态(
  pool: Pool,
  partnerId: string,
  staffId: string,
  status: string,
  当前用户: 当前业务用户 | null = null,
) {
  const partnerUuid = await 查找渠道商UUID(pool, partnerId);
  const userUuid = await 查找用户UUID(pool, staffId);
  if (!partnerUuid || !userUuid)
    throw Object.assign(new Error("渠道商或员工不存在。"), { statusCode: 404 });
  const 目标角色 = await 查询渠道成员账号角色(pool, partnerUuid, staffId);
  const 维护范围 = await 校验渠道成员维护范围(pool, partnerUuid, 当前用户, 目标角色);
  const 变更前 = await 查询V2账号保存快照(pool, staffId);
  const 目标状态 = 转V3账号状态(status);
  if (目标状态 === "active" && 维护范围.roleCode !== "superadmin") {
    const 账号快照 = await 查询V2账号保存快照(pool, staffId);
    if (["pending", "rejected"].includes(String(账号快照?.status || ""))) {
      throw Object.assign(new Error("待审批或已驳回账号不能直接启用，请完成区管、超管审批。"), {
        statusCode: 409,
      });
    }
  }
  const updated = await pool.query(
    `
    UPDATE channel.partner_members
    SET status_code = $3,
        ended_at = CASE WHEN $3 = 'disabled' THEN now() ELSE NULL END,
        updated_at = now(),
        row_version = row_version + 1
    WHERE partner_id = $1::uuid AND user_id = $2::uuid AND archived_at IS NULL
    RETURNING id
    `,
    [partnerUuid, userUuid, 目标状态],
  );
  if (!updated.rows[0])
    throw Object.assign(new Error("渠道商员工关系不存在或已归档。"), { statusCode: 404 });
  const 更新结果 = await 更新用户状态(pool, staffId, status);
  await 写入渠道成员审计(pool, {
    action: 目标状态 === "active" ? "channel_member.enabled" : "channel_member.disabled",
    actor: 当前用户,
    partnerId: partnerUuid,
    memberId: userUuid,
    memberName:
      读取对象文本(变更前 || {}, "displayName") ||
      读取对象文本(变更前 || {}, "username") ||
      staffId,
    message: 目标状态 === "active" ? "渠道成员已启用" : "渠道成员已停用",
    before: { status: 变更前?.status || "" },
    after: { status: 目标状态 },
  });
  return 更新结果;
}

async function 删除渠道商员工(
  pool: Pool,
  partnerId: string,
  staffId: string,
  当前用户: 当前业务用户 | null,
) {
  const 范围 = 当前用户?.username ? await 查询账号创建范围(pool, 当前用户) : null;
  if (!范围 || 范围.roleCode !== "superadmin") {
    throw Object.assign(new Error("只有超级管理员可以删除渠道成员。"), { statusCode: 403 });
  }
  const partnerUuid = await 查找渠道商UUID(pool, partnerId);
  const userUuid = await 查找用户UUID(pool, staffId);
  if (!partnerUuid || !userUuid)
    throw Object.assign(new Error("渠道商或员工不存在。"), { statusCode: 404 });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const removed = await client.query<{ id: string; member_role_code: string }>(
      `
      UPDATE channel.partner_members
      SET status_code = 'disabled',
          ended_at = COALESCE(ended_at, now()),
          archived_at = now(),
          archive_reason = '渠道商管理移除成员',
          updated_at = now(),
          row_version = row_version + 1
      WHERE partner_id = $1::uuid AND user_id = $2::uuid AND archived_at IS NULL
      RETURNING id::text AS id, member_role_code
      `,
      [partnerUuid, userUuid],
    );
    if (!removed.rows[0])
      throw Object.assign(new Error("渠道商员工关系不存在。"), { statusCode: 404 });

    const remaining = await client.query<{
      partner_external_id: string;
      partner_name: string;
    }>(
      `
      SELECT COALESCE(p.v2_source_id,p.partner_code,p.id::text) AS partner_external_id,
        p.partner_name
      FROM channel.partner_members pm
      JOIN channel.partners p ON p.id=pm.partner_id AND p.status_code='active'
      WHERE pm.user_id = $1::uuid AND pm.status_code = 'active' AND pm.archived_at IS NULL
      ORDER BY CASE pm.member_role_code WHEN 'partner_admin' THEN 0 ELSE 1 END,pm.started_at DESC
      LIMIT 1
      `,
      [userUuid],
    );
    const archivedAt = new Date().toISOString();
    const extra = {
      lastArchivedPartnerId: partnerId,
      lastArchivedAt: archivedAt,
    };
    const remainingMembership = remaining.rows[0];
    if (!remainingMembership) {
      await client.query(
        `
        UPDATE iam.users
        SET status_code = 'disabled',
            updated_at = now(),
            row_version = row_version + 1,
            extra_json = (extra_json - 'partnerId' - 'partnerName') || $2::jsonb
        WHERE id = $1::uuid
        `,
        [userUuid, JSON.stringify({ ...extra, status: "deleted" })],
      );
    } else {
      await client.query(
        `
        UPDATE iam.users
        SET status_code = 'active',
            updated_at = now(),
            row_version = row_version + 1,
            extra_json = (extra_json - 'partnerId' - 'partnerName') || $2::jsonb
        WHERE id = $1::uuid
        `,
        [
          userUuid,
          JSON.stringify({
            ...extra,
            status: "active",
            partnerId: remainingMembership.partner_external_id,
            partnerName: remainingMembership.partner_name,
          }),
        ],
      );
    }
    const actorUser = 当前用户?.username
      ? await client.query<{ id: string }>(
          "SELECT id::text AS id FROM iam.users WHERE lower(username::text)=lower($1) LIMIT 1",
          [当前用户.username],
        )
      : null;
    await client.query(
      `INSERT INTO audit.audit_logs(
         created_at,request_id,actor_user_id,actor_username,actor_name,actor_role,module_code,
         action_code,target_type,target_id,result_code,message,before_json,after_json,extra_json
       ) VALUES(now(),$1,$2::uuid,$3,$4,$5,'channel_member','channel_member.archived',
         'channel_member',$6,'success','渠道成员已从当前团队停用归档',$7::jsonb,$8::jsonb,'{}'::jsonb)`,
      [
        当前用户?.requestId || "",
        actorUser?.rows[0]?.id || null,
        当前用户?.username || "system",
        当前用户?.displayName || 当前用户?.username || "系统",
        当前用户?.roleName || "兼容入口",
        removed.rows[0].id,
        JSON.stringify({
          partnerId,
          userId: userUuid,
          memberRoleCode: removed.rows[0].member_role_code,
        }),
        JSON.stringify({
          statusCode: "disabled",
          archived: true,
          accountDisabled: !remainingMembership,
          replacementPartnerId: remainingMembership?.partner_external_id || null,
        }),
      ],
    );
    await client.query("COMMIT");
    return { id: staffId, userId: userUuid, partnerId, deleted: true };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function 更新待审批状态(
  pool: Pool,
  id: string,
  status: string,
  输入: 字典,
  当前用户: 当前业务用户 | null = null,
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const 当前 = await client.query<{
      id: string;
      v2_source_id: string | null;
      status_code: string;
      approval_type_code: string;
      target_type: string;
      target_id: string | null;
      applicant_partner_id: string | null;
      extra_json: 字典 | null;
    }>(
      `
      SELECT id::text AS id, v2_source_id, status_code, approval_type_code, target_type, target_id::text AS target_id,
        applicant_partner_id::text AS applicant_partner_id, extra_json
      FROM ops.approvals
      WHERE id::text = $1 OR v2_source_id = $1
      FOR UPDATE
      `,
      [id],
    );
    const row = 当前.rows[0];
    if (!row) throw Object.assign(new Error("审批记录不存在。"), { statusCode: 404 });
    const 是重新提交 = status === "pending";
    const 允许的当前状态 = 是重新提交 ? "rejected" : "pending";
    if (row.status_code !== 允许的当前状态) {
      throw Object.assign(
        new Error(
          是重新提交 ? "仅已驳回的审批事项可以重新提交。" : "该审批事项已处理，请刷新列表后重试。",
        ),
        { statusCode: 409 },
      );
    }

    // 审批留痕以当前登录账号为准；请求体中的 approvedBy 仅作为无会话兼容调用兜底。
    const 当前审批人 = 当前用户?.displayName
      ? `${当前用户.displayName}${当前用户.username ? ` / ${当前用户.username}` : ""}`
      : "";
    const 审批人 = 当前审批人 || 读取对象文本(输入, "approvedBy") || "系统审批";
    const 原因 = 读取对象文本(输入, "remark") || 读取对象文本(输入, "reason");
    const 审批范围 = 当前用户?.username ? await 查询账号创建范围(client, 当前用户) : null;
    const 实际角色 = 审批范围?.roleCode || 当前用户?.roleCode || "";
    const 是账号审批 = 是账号审批目标(row.target_type);
    const 当前阶段 = 读取账号审批阶段(row.extra_json);
    let 最终状态 = status;
    let 下一阶段: ReturnType<typeof 读取账号审批阶段> | null = null;

    if (!是重新提交) {
      if (是账号审批) {
        if (!["superadmin", "region_manager"].includes(实际角色)) {
          throw new 应用错误("V3_APPROVAL_FORBIDDEN", "当前账号无权处理该账号审批。", 403);
        }
        if (当前阶段 === "region_review") {
          if (实际角色 !== "region_manager") {
            throw new 应用错误(
              "V3_ACCOUNT_APPROVAL_REGION_REQUIRED",
              "该账号尚待区域管理员初审，超级管理员不能越级处理。",
              409,
            );
          }
          const 渠道UUID =
            row.applicant_partner_id || 读取对象文本(row.extra_json || {}, "partnerUuid");
          if (!渠道UUID) {
            throw new 应用错误(
              "V3_ACCOUNT_APPROVAL_PARTNER_REQUIRED",
              "账号审批缺少所属渠道。",
              409,
            );
          }
          const 渠道区域 = await client.query<{
            region_id: string | null;
            region_name: string | null;
          }>(
            `
            SELECT p.region_id::text AS region_id,
              COALESCE(reg.region_name, p.extra_json->>'region') AS region_name
            FROM channel.partners p
            LEFT JOIN org.regions reg ON reg.id = p.region_id
            WHERE p.id = $1::uuid
            LIMIT 1
            `,
            [渠道UUID],
          );
          const 区域 = 渠道区域.rows[0];
          const 同区域 =
            (Boolean(审批范围?.regionId) && 区域?.region_id === 审批范围?.regionId) ||
            (Boolean(审批范围?.regionName) && 区域?.region_name === 审批范围?.regionName);
          if (!同区域) {
            throw new 应用错误(
              "V3_ACCOUNT_APPROVAL_REGION_FORBIDDEN",
              "区域管理员只能审批本区域渠道账号。",
              403,
            );
          }
          if (status === "approved") {
            最终状态 = "pending";
            下一阶段 = "superadmin_review";
          }
        } else if (实际角色 !== "superadmin") {
          throw new 应用错误(
            "V3_ACCOUNT_APPROVAL_SUPERADMIN_REQUIRED",
            "该账号已进入超管终审，区域管理员不能处理。",
            403,
          );
        }
      } else if (实际角色 !== "superadmin") {
        throw new 应用错误("V3_PERMISSION_DENIED", "只有超级管理员可以处理该审核事项。", 403);
      }
    }

    if (最终状态 === "rejected" && !原因.trim()) {
      throw new 应用错误("V3_APPROVAL_REASON_REQUIRED", "驳回时必须填写驳回原因。", 400);
    }
    if (原因.length > 500) {
      throw new 应用错误("V3_APPROVAL_REASON_TOO_LONG", "驳回原因不能超过 500 个字符。", 400);
    }
    const 原始提交角色 = 读取对象文本(row.extra_json || {}, "createdByRoleCode");
    const 结果阶段 = 是重新提交
      ? 原始提交角色
        ? 初始账号审批阶段(原始提交角色)
        : 当前阶段
      : 下一阶段 || 当前阶段;
    const 结果步骤名称 = 是账号审批
      ? 账号审批步骤名称(
          结果阶段,
          是重新提交 || 下一阶段 ? "pending" : 最终状态 === "approved" ? "approved" : "rejected",
        )
      : "";
    const 审批更新 = {
      ...输入,
      status: 最终状态,
      reviewRemark: 原因,
      reviewedByName: 审批人,
      reviewedAt: new Date().toISOString(),
      ...(是账号审批
        ? {
            approvalStage: 结果阶段,
            approvalStageName: 结果步骤名称,
            stepName: 结果步骤名称,
            ...(下一阶段 === "superadmin_review"
              ? {
                  regionReviewedByName: 审批人,
                  regionReviewedAt: new Date().toISOString(),
                }
              : {}),
          }
        : {}),
    };
    await client.query(
      `
      UPDATE ops.approvals
      SET status_code = $2,
          updated_at = now(),
          extra_json = CASE
            WHEN $4::boolean
            THEN extra_json || $3::jsonb
            ELSE (extra_json - 'reviewRemark' - 'reviewedByName' - 'reviewedAt' - 'regionReviewedByName' - 'regionReviewedAt') || $3::jsonb
          END
      WHERE id = $1::uuid
      `,
      [row.id, 最终状态, JSON.stringify(审批更新), !是重新提交],
    );
    await client.query(
      `
      INSERT INTO ops.approval_events (
        approval_id, event_code, from_status_code, to_status_code, reason, extra_json
      )
      VALUES ($1::uuid, $2, $3, $4, $5, $6::jsonb)
      `,
      [
        row.id,
        是重新提交
          ? "resubmit"
          : 下一阶段
            ? "region_approve"
            : 最终状态 === "approved"
              ? "approve"
              : "reject",
        row.status_code,
        最终状态,
        原因,
        JSON.stringify({ actorName: 审批人, approvalStage: 结果阶段 }),
      ],
    );

    const 渠道UUID =
      row.applicant_partner_id || 读取对象文本(row.extra_json || {}, "partnerUuid") || null;
    if (row.target_id) {
      if (["user", "staff", "account"].includes(row.target_type)) {
        // 区管初审通过和重新提交都保持待审批；只有最终审批结果才启用或停用账号。
        const 目标状态 =
          下一阶段 || 是重新提交 ? "disabled" : 最终状态 === "approved" ? "active" : "disabled";
        await client.query(
          `
    UPDATE iam.users
    SET status_code = $2,
        updated_at = now(),
        row_version = row_version + 1,
        extra_json = extra_json || $3::jsonb
    WHERE id = $1::uuid
          `,
          [
            row.target_id,
            目标状态,
            JSON.stringify({
              status:
                下一阶段 || 是重新提交 ? "pending" : 目标状态 === "active" ? "active" : "rejected",
              reviewRemark: 原因,
              reviewedByName: 审批人,
              reviewedAt: new Date().toISOString(),
              approvalStage: 结果阶段,
              approvalStageName: 结果步骤名称,
            }),
          ],
        );
        if (渠道UUID) {
          await client.query(
            `
            UPDATE channel.partner_members
            SET status_code = $2,
                ended_at = CASE WHEN $2 = 'disabled' THEN now() ELSE NULL END,
                updated_at = now(),
                row_version = row_version + 1
            WHERE user_id = $1::uuid AND partner_id = $3::uuid AND archived_at IS NULL
            `,
            [row.target_id, 目标状态, 渠道UUID],
          );
        }
      }
      if (row.target_type === "partner") {
        await client.query(
          `UPDATE channel.partners
              SET status_code = $2,
                  updated_at = now(),
                  row_version = row_version + 1,
                  extra_json = extra_json || $3::jsonb
            WHERE id = $1::uuid`,
          [
            row.target_id,
            最终状态 === "approved" ? "active" : 最终状态 === "pending" ? "pending" : "rejected",
            JSON.stringify({
              status:
                最终状态 === "approved"
                  ? "active"
                  : 最终状态 === "pending"
                    ? "pending"
                    : "rejected",
              reviewRemark: 原因,
              reviewedByName: 审批人,
              reviewedAt: new Date().toISOString(),
            }),
          ],
        );
      }
      if (row.target_type === "registration") {
        await client.query(
          `
          UPDATE crm.registrations
          SET status_code = $2,
              approved_at = CASE WHEN $2 = 'approved' THEN now() ELSE approved_at END,
              updated_at = now(),
              extra_json = extra_json || $3::jsonb
          WHERE id = $1::uuid
          `,
          [
            row.target_id,
            最终状态,
            JSON.stringify({
              status: 最终状态,
              reviewRemark: 原因,
              updatedByName: 审批人,
            }),
          ],
        );
      }
    }
    await 写入审批审计(client, {
      actor: 当前用户,
      approvalId: row.id,
      targetType: row.target_type,
      targetId: row.target_id || "",
      targetName:
        读取对象文本(row.extra_json || {}, "targetName") ||
        读取对象文本(row.extra_json || {}, "customerName") ||
        读取对象文本(row.extra_json || {}, "title") ||
        row.target_id ||
        "审批事项",
      status: 最终状态,
      reason: 原因,
      approvalStage: 是账号审批 ? 结果阶段 : "",
      resubmitted: 是重新提交,
    });
    if ((是重新提交 || 下一阶段) && row.target_id) {
      const 事件类型 =
        row.target_type === "partner"
          ? "channel.partner.approval.pending"
          : ["user", "staff", "account"].includes(row.target_type)
            ? "iam.account.approval.pending"
            : "";
      if (事件类型) {
        await 写入统一提醒发件箱事件(client, {
          事件类型,
          聚合类型: "approval",
          聚合编号: row.id,
          载荷: {
            approvalId: row.id,
            targetId: row.target_id,
            approvalType: row.approval_type_code,
          },
        });
      }
    }
    await client.query("COMMIT");
    return {
      ...(row.extra_json || {}),
      id: row.v2_source_id || row.id,
      approvalId: row.id,
      status: 最终状态,
      approvalStage: 是账号审批 ? 结果阶段 : "",
      approvalStageName: 是账号审批 ? 结果步骤名称 : "",
      stepName: 结果步骤名称,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function 查询工作量分类(pool: Pool) {
  const result = await pool.query<{
    id: string;
    v2_source_id: string | null;
    classification_code: string | null;
    classification_name: string;
    status_code: string;
  }>(
    `
    SELECT id::text, v2_source_id, classification_code, classification_name, status_code
    FROM catalog.workload_classifications
    WHERE status_code <> 'disabled'
    ORDER BY classification_name
    `,
  );
  return result.rows.map((row) => ({
    id: row.v2_source_id || row.classification_code || row.id,
    code: row.classification_code || row.v2_source_id || row.id,
    name: row.classification_name,
    status: row.status_code,
  }));
}

async function 查询简介产品配置(pool: Pool) {
  const [features, modules] = await Promise.all([查询V2功能产品(pool), 查询V2产品模块(pool)]);
  const products = features.map((feature, index) => ({
    id: feature.id,
    code: feature.productCode || feature.id,
    name: feature.name,
    productLine: feature.categoryId || "",
    moduleIds: feature.moduleId ? [feature.moduleId] : [],
    status: feature.status || "active",
    sort: index + 1,
  }));
  return { products, modules };
}

async function 保存简介产品配置(pool: Pool, id: string, 输入: 字典) {
  const moduleId = 读取对象字符串数组(输入, "moduleIds")[0] || "";
  const modules = await 查询V2产品模块(pool);
  const targetModule = modules.find((item) => item.id === moduleId) || modules[0];
  if (!targetModule) throw Object.assign(new Error("请先维护产品模块。"), { statusCode: 400 });
  return 保存V2功能产品(pool, id, {
    id: id || 读取正文文本(输入, ["id", "code"], `PROFILE-FEAT-${Date.now()}`),
    name: 读取正文文本(输入, ["name"], "未命名矩阵产品"),
    productCode: 读取正文文本(输入, ["code"], id || `PROFILE-FEAT-${Date.now()}`),
    moduleId: targetModule.id,
    status: 读取正文文本(输入, ["status"], "active"),
    published: 读取正文文本(输入, ["status"], "active") !== "disabled",
    profileProduct: true,
    productLine: 读取正文文本(输入, ["productLine"], ""),
    moduleIds: 读取对象字符串数组(输入, "moduleIds"),
    sort: 读取正文数字(输入, ["sort"], 0),
  });
}

async function 删除简介产品配置(pool: Pool, id: string) {
  await 软归档产品记录(pool, "catalog.product_features", id);
}

async function 查询地市元数据(pool: Pool) {
  const result = await pool.query<{ region_name: string; city_name: string | null }>(
    `
    SELECT DISTINCT COALESCE(r.region_name, p.extra_json->>'region', '') AS region_name,
      COALESCE(NULLIF(p.city_name, ''), p.extra_json->>'city') AS city_name
    FROM channel.partners p
    LEFT JOIN org.regions r ON r.id = p.region_id
    WHERE p.status_code <> 'archived'
    ORDER BY region_name, city_name
    `,
  );
  const map = new Map<string, string[]>();
  for (const row of result.rows) {
    const region = row.region_name || "未分区";
    const city = row.city_name || "";
    if (!map.has(region)) map.set(region, []);
    if (city && !map.get(region)?.includes(city)) map.get(region)?.push(city);
  }
  return Array.from(map.entries()).map(([region, cities]) => ({ region, cities }));
}

async function 查询V2产品大类(pool: Pool) {
  const result = await pool.query<
    数据库行 & {
      category_code: string | null;
      category_name: string;
      product_type_code: string;
      sort_order: number;
      status_code: string;
    }
  >(
    `
    SELECT id::text, v2_source_id, category_code, category_name, product_type_code, sort_order, status_code, extra_json
    FROM catalog.product_categories
    WHERE status_code <> 'archived'
    ORDER BY sort_order, category_name
    `,
  );
  return result.rows.map((row) => {
    const extra = row.extra_json || {};
    return {
      ...extra,
      id: 取V2编号(row),
      name: 读取对象文本(extra, "name") || row.category_name,
      code: row.category_code || row.v2_source_id || row.id,
      type: 读取对象文本(extra, "type") || row.product_type_code,
      icon: 读取对象文本(extra, "icon") || "",
      sort: 读取对象数字(extra, "sort", row.sort_order),
      status: 读取对象文本(extra, "status") || row.status_code,
      published: 读取对象布尔(extra, "published", row.status_code === "active"),
      desc: 读取对象文本(extra, "desc"),
    };
  });
}

async function 查询V2产品模块(pool: Pool) {
  const result = await pool.query<
    数据库行 & {
      module_code: string | null;
      module_name: string;
      sort_order: number;
      status_code: string;
      category_id: string;
      category_v2_id: string | null;
    }
  >(
    `
    SELECT m.id::text, m.v2_source_id, m.module_code, m.module_name, m.sort_order, m.status_code, m.extra_json,
      COALESCE(c.v2_source_id, c.category_code, c.id::text) AS category_v2_id,
      c.id::text AS category_id
    FROM catalog.product_modules m
    JOIN catalog.product_categories c ON c.id = m.category_id
    WHERE m.status_code <> 'archived'
      AND c.status_code <> 'archived'
    ORDER BY m.sort_order, m.module_name
    `,
  );
  return result.rows.map((row) => {
    const extra = row.extra_json || {};
    return {
      ...extra,
      id: 取V2编号(row),
      categoryId: 读取对象文本(extra, "categoryId") || row.category_v2_id || row.category_id,
      name: 读取对象文本(extra, "name") || row.module_name,
      code: row.module_code || row.v2_source_id || row.id,
      icon: 读取对象文本(extra, "icon") || "",
      sort: 读取对象数字(extra, "sort", row.sort_order),
      status: 读取对象文本(extra, "status") || row.status_code,
      published: 读取对象布尔(extra, "published", row.status_code === "active"),
      desc: 读取对象文本(extra, "desc"),
    };
  });
}

async function 查询V2功能产品(pool: Pool) {
  const result = await pool.query<
    数据库行 & {
      feature_code: string | null;
      feature_name: string;
      unit_name: string | null;
      list_price: string | number;
      published: boolean;
      status_code: string;
      module_id: string | null;
      module_v2_id: string | null;
      category_v2_id: string | null;
    }
  >(
    `
    SELECT f.id::text, f.v2_source_id, f.feature_code, f.feature_name, f.unit_name, f.list_price,
      f.published, f.status_code, f.extra_json,
      m.id::text AS module_id,
      COALESCE(m.v2_source_id, m.module_code, m.id::text) AS module_v2_id,
      COALESCE(c.v2_source_id, c.category_code, c.id::text) AS category_v2_id
    FROM catalog.product_features f
    LEFT JOIN catalog.product_modules m ON m.id = f.module_id
    LEFT JOIN catalog.product_categories c ON c.id = m.category_id
    WHERE f.status_code <> 'archived'
      AND COALESCE(m.status_code, '') <> 'archived'
      AND COALESCE(c.status_code, '') <> 'archived'
    ORDER BY COALESCE((f.extra_json->>'sort')::integer, 999), f.feature_name
    `,
  );
  return result.rows.map((row) => {
    const extra = row.extra_json || {};
    return {
      ...extra,
      id: 取V2编号(row),
      uuid: row.id,
      moduleId: 读取对象文本(extra, "moduleId") || row.module_v2_id || row.module_id || "",
      categoryId: 读取对象文本(extra, "categoryId") || row.category_v2_id || "",
      name: 读取对象文本(extra, "name") || row.feature_name,
      productCode:
        读取对象文本(extra, "productCode") || row.feature_code || row.v2_source_id || row.id,
      priceType: 读取对象文本(extra, "priceType") || "fixed",
      priceFixed: 读取对象数字(extra, "priceFixed", Number(row.list_price) || 0),
      tiers: 规范化历史价格档位(extra.tiers),
      priceForPrimary: 规范化历史价格档位(extra.priceForPrimary, "primary"),
      priceForSecondary: 规范化历史价格档位(extra.priceForSecondary, "secondary"),
      priceRatioPrimary: 读取对象可空数字(extra, "priceRatioPrimary"),
      priceRatioSecondary: 读取对象可空数字(extra, "priceRatioSecondary"),
      unit: 读取对象文本(extra, "unit") || row.unit_name || "端点",
      desc: 读取对象文本(extra, "desc"),
      required: 读取对象布尔(extra, "required", false),
      published: 读取对象布尔(extra, "published", row.published),
      status: 读取对象文本(extra, "status") || row.status_code,
      regionPriceOverrides: 规范化区域价格覆盖(extra.regionPriceOverrides),
      maintenanceModuleRates: 读取对象数组(extra, "maintenanceModuleRates"),
      maintenanceFeatureOverrides: 读取对象数组(extra, "maintenanceFeatureOverrides"),
    };
  });
}

async function 查询V2硬件产品(pool: Pool) {
  const result = await pool.query<
    数据库行 & {
      hardware_code: string | null;
      hardware_name: string;
      unit_name: string | null;
      list_price: string | number;
      published: boolean;
      status_code: string;
    }
  >(
    `
    SELECT id::text, v2_source_id, hardware_code, hardware_name, unit_name, list_price, published, status_code, extra_json
    FROM catalog.hardware_products
    WHERE status_code <> 'archived'
    ORDER BY COALESCE((extra_json->>'sort')::integer, 999), hardware_name
    `,
  );
  return result.rows.map((row) => {
    const extra = row.extra_json || {};
    return {
      ...extra,
      id: 取V2编号(row),
      name: 读取对象文本(extra, "name") || row.hardware_name,
      model: 读取对象文本(extra, "model") || row.hardware_code || "",
      icon: 读取对象文本(extra, "icon") || "",
      priceFixed: 读取对象数字(extra, "priceFixed", Number(row.list_price) || 0),
      unit: 读取对象文本(extra, "unit") || row.unit_name || "台",
      specs: 读取对象文本(extra, "specs"),
      desc: 读取对象文本(extra, "desc"),
      published: 读取对象布尔(extra, "published", row.published),
      status: 读取对象文本(extra, "status") || row.status_code,
    };
  });
}

async function 查询V2产品套餐(pool: Pool) {
  const result = await pool.query<
    数据库行 & {
      package_code: string | null;
      package_name: string;
      list_price: string | number;
      published: boolean;
      status_code: string;
    }
  >(
    `
    SELECT id::text, v2_source_id, package_code, package_name, list_price, published, status_code, extra_json
    FROM catalog.product_packages
    WHERE status_code <> 'archived'
    ORDER BY COALESCE((extra_json->>'sort')::integer, 999), package_name
    `,
  );
  return result.rows.map((row) => {
    const extra = row.extra_json || {};
    return {
      ...extra,
      id: 取V2编号(row),
      name: 读取对象文本(extra, "name") || row.package_name,
      code: row.package_code || row.v2_source_id || row.id,
      icon: 读取对象文本(extra, "icon") || "",
      desc: 读取对象文本(extra, "desc"),
      moduleIds: 读取对象字符串数组(extra, "moduleIds"),
      featureIds: 读取对象字符串数组(extra, "featureIds"),
      hardwareIds: 读取对象字符串数组(extra, "hardwareIds"),
      priceFixed: 读取对象数字(extra, "priceFixed", Number(row.list_price) || 0),
      status: 读取对象文本(extra, "status") || row.status_code,
      published: 读取对象布尔(extra, "published", row.published),
    };
  });
}

async function 查询V2产品树(pool: Pool) {
  const [categories, modules, features] = await Promise.all([
    查询V2产品大类(pool),
    查询V2产品模块(pool),
    查询V2功能产品(pool),
  ]);
  return categories.map((category) => ({
    ...category,
    modules: modules
      .filter((module) => module.categoryId === category.id)
      .map((module) => ({
        ...module,
        categoryName: category.name,
        features: features.filter((feature) => feature.moduleId === module.id),
      })),
  }));
}

async function 保存V2产品大类(pool: Pool, id: string, 输入: 字典) {
  const name = 读取正文文本(输入, ["name"], "未命名大类");
  const code = id || 读取正文文本(输入, ["id", "code"], `CAT-V3-${Date.now()}`);
  const extra = { ...输入, id: code, name };
  if (!id) {
    await pool.query(
      `
      INSERT INTO catalog.product_categories (v2_source_id, category_code, category_name, product_type_code, sort_order, status_code, extra_json)
      VALUES ($1, $1, $2, $3, $4, 'active', $5::jsonb)
      `,
      [
        code,
        name,
        读取正文文本(输入, ["type"], "software"),
        读取正文数字(输入, ["sort"], 0),
        JSON.stringify(extra),
      ],
    );
  } else {
    await pool.query(
      `
      UPDATE catalog.product_categories
      SET category_name = $2, product_type_code = $3, sort_order = $4, status_code = 'active', extra_json = extra_json || $5::jsonb
      WHERE id::text = $1 OR v2_source_id = $1 OR category_code = $1
      `,
      [
        id,
        name,
        读取正文文本(输入, ["type"], "software"),
        读取正文数字(输入, ["sort"], 0),
        JSON.stringify(extra),
      ],
    );
  }
  return (await 查询V2产品大类(pool)).find((item) => item.id === code || item.id === id) || extra;
}

async function 保存V2产品模块(pool: Pool, id: string, 输入: 字典) {
  const name = 读取正文文本(输入, ["name"], "未命名模块");
  const code = id || 读取正文文本(输入, ["id", "code"], `MOD-V3-${Date.now()}`);
  const categoryId = await 查找产品大类UUID(pool, 读取正文文本(输入, ["categoryId"], ""));
  const extra = { ...输入, id: code, name };
  if (!categoryId) throw Object.assign(new Error("请选择产品大类。"), { statusCode: 400 });
  if (!id) {
    await pool.query(
      `
      INSERT INTO catalog.product_modules (v2_source_id, category_id, module_code, module_name, sort_order, status_code, extra_json)
      VALUES ($1, $2::uuid, $1, $3, $4, 'active', $5::jsonb)
      `,
      [code, categoryId, name, 读取正文数字(输入, ["sort"], 0), JSON.stringify(extra)],
    );
  } else {
    await pool.query(
      `
      UPDATE catalog.product_modules
      SET category_id = $2::uuid, module_name = $3, sort_order = $4, status_code = 'active', extra_json = extra_json || $5::jsonb
      WHERE id::text = $1 OR v2_source_id = $1 OR module_code = $1
      `,
      [id, categoryId, name, 读取正文数字(输入, ["sort"], 0), JSON.stringify(extra)],
    );
  }
  return (await 查询V2产品模块(pool)).find((item) => item.id === code || item.id === id) || extra;
}

async function 保存V2功能产品(pool: Pool, id: string, 输入: 字典) {
  const name = 读取正文文本(输入, ["name"], "未命名功能");
  const code = id || 读取正文文本(输入, ["id", "productCode"], `FEAT-V3-${Date.now()}`);
  const moduleId = await 查找产品模块UUID(pool, 读取正文文本(输入, ["moduleId"], ""));
  const 标准化输入 = 标准化功能价格输入(输入);
  const extra = { ...标准化输入, id: code, name };
  if (!moduleId) throw Object.assign(new Error("请选择产品模块。"), { statusCode: 400 });
  校验功能价格规则(标准化输入);
  if (!id) {
    await pool.query(
      `
      INSERT INTO catalog.product_features (v2_source_id, module_id, feature_code, feature_name, unit_name, list_price, published, status_code, extra_json)
      VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, 'active', $8::jsonb)
      `,
      [
        code,
        moduleId,
        读取正文文本(输入, ["productCode"], code),
        name,
        读取正文文本(输入, ["unit"], "端点"),
        读取正文数字(输入, ["priceFixed"], 0),
        读取正文布尔(输入, "published", true),
        JSON.stringify(extra),
      ],
    );
  } else {
    await pool.query(
      `
      UPDATE catalog.product_features
      SET module_id = $2::uuid, feature_code = $3, feature_name = $4, unit_name = $5,
          list_price = $6, published = $7, status_code = 'active', extra_json = extra_json || $8::jsonb
      WHERE id::text = $1 OR v2_source_id = $1 OR feature_code = $1
      `,
      [
        id,
        moduleId,
        读取正文文本(输入, ["productCode"], code),
        name,
        读取正文文本(输入, ["unit"], "端点"),
        读取正文数字(输入, ["priceFixed"], 0),
        读取正文布尔(输入, "published", true),
        JSON.stringify(extra),
      ],
    );
  }
  return (await 查询V2功能产品(pool)).find((item) => item.id === code || item.id === id) || extra;
}

async function 保存V2硬件产品(pool: Pool, id: string, 输入: 字典) {
  const name = 读取正文文本(输入, ["name"], "未命名硬件");
  const code = id || 读取正文文本(输入, ["id", "model"], `HW-V3-${Date.now()}`);
  const extra = { ...输入, id: code, name };
  if (!id) {
    await pool.query(
      `
      INSERT INTO catalog.hardware_products (v2_source_id, hardware_code, hardware_name, unit_name, list_price, published, status_code, extra_json)
      VALUES ($1, $2, $3, $4, $5, $6, 'active', $7::jsonb)
      `,
      [
        code,
        读取正文文本(输入, ["model"], code),
        name,
        读取正文文本(输入, ["unit"], "台"),
        读取正文数字(输入, ["priceFixed"], 0),
        读取正文布尔(输入, "published", true),
        JSON.stringify(extra),
      ],
    );
  } else {
    await pool.query(
      `
      UPDATE catalog.hardware_products
      SET hardware_code = $2, hardware_name = $3, unit_name = $4, list_price = $5,
          published = $6, status_code = 'active', extra_json = extra_json || $7::jsonb
      WHERE id::text = $1 OR v2_source_id = $1 OR hardware_code = $1
      `,
      [
        id,
        读取正文文本(输入, ["model"], code),
        name,
        读取正文文本(输入, ["unit"], "台"),
        读取正文数字(输入, ["priceFixed"], 0),
        读取正文布尔(输入, "published", true),
        JSON.stringify(extra),
      ],
    );
  }
  return (await 查询V2硬件产品(pool)).find((item) => item.id === code || item.id === id) || extra;
}

async function 保存V2产品套餐(pool: Pool, id: string, 输入: 字典) {
  const name = 读取正文文本(输入, ["name"], "未命名套餐");
  const code = id || 读取正文文本(输入, ["id", "code"], `PKG-V3-${Date.now()}`);
  const extra = { ...输入, id: code, name };
  await 校验套餐组合(pool, 输入);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let packageUuid = "";
    if (!id) {
      const result = await client.query<{ id: string }>(
        `
        INSERT INTO catalog.product_packages (v2_source_id, package_code, package_name, list_price, published, status_code, extra_json)
        VALUES ($1, $1, $2, $3, $4, 'active', $5::jsonb)
        RETURNING id::text AS id
        `,
        [
          code,
          name,
          读取正文数字(输入, ["priceFixed"], 0),
          读取正文布尔(输入, "published", true),
          JSON.stringify(extra),
        ],
      );
      packageUuid = result.rows[0]?.id || "";
    } else {
      const result = await client.query<{ id: string }>(
        `
        UPDATE catalog.product_packages
        SET package_name = $2, list_price = $3, published = $4, status_code = 'active', extra_json = extra_json || $5::jsonb
        WHERE id::text = $1 OR v2_source_id = $1 OR package_code = $1
        RETURNING id::text AS id
        `,
        [
          id,
          name,
          读取正文数字(输入, ["priceFixed"], 0),
          读取正文布尔(输入, "published", true),
          JSON.stringify(extra),
        ],
      );
      packageUuid = result.rows[0]?.id || "";
    }
    if (packageUuid) await 重写套餐明细(client, packageUuid, 输入);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return (await 查询V2产品套餐(pool)).find((item) => item.id === code || item.id === id) || extra;
}

/** 价格档位必须为整数闭区间且互不重叠；价格允许 0（表示待配置），但不允许负数或非有限数。 */
function 校验价格档位组(值: unknown, 标签: string): void {
  if (值 === undefined || 值 === null) return;
  if (!Array.isArray(值)) {
    throw new 应用错误("V3_PRICE_TIER_INVALID", `${标签}必须是档位数组。`, 400);
  }
  const 档位 = 值.map((项, 序号) => {
    if (!项 || typeof 项 !== "object") {
      throw new 应用错误("V3_PRICE_TIER_INVALID", `${标签}第 ${序号 + 1} 档格式不正确。`, 400);
    }
    const 记录 = 项 as 字典;
    const 起始 = Number(记录.min);
    const 结束 = Number(记录.max);
    const 价格 = Number(记录.price);
    if (
      !Number.isInteger(起始) ||
      !Number.isInteger(结束) ||
      起始 < 1 ||
      结束 < 起始 ||
      !Number.isFinite(价格) ||
      价格 < 0
    ) {
      throw new 应用错误(
        "V3_PRICE_TIER_INVALID",
        `${标签}第 ${序号 + 1} 档必须填写有效的起始点、结束点和非负价格。`,
        400,
      );
    }
    return { 起始, 结束 };
  });
  档位.sort((左, 右) => 左.起始 - 右.起始);
  for (let 序号 = 1; 序号 < 档位.length; 序号 += 1) {
    const 当前档 = 档位[序号];
    const 前一档 = 档位[序号 - 1];
    if (当前档 && 前一档 && 当前档.起始 <= 前一档.结束) {
      throw new 应用错误("V3_PRICE_TIER_OVERLAP", `${标签}存在重叠档位，请调整区间。`, 400);
    }
  }
}

function 校验价格日期(值: unknown, 标签: string): void {
  if (值 === undefined || 值 === null || 值 === "") return;
  const 文本值 = String(值).trim();
  if (!/^\d{4}-\d{2}-\d{2}(?:[T\s].*)?$/.test(文本值) || Number.isNaN(new Date(文本值).getTime())) {
    throw new 应用错误("V3_PRICE_EFFECTIVE_DATE_INVALID", `${标签}格式不正确，应为有效日期。`, 400);
  }
}

function 校验区域价格规则(值: unknown): void {
  if (值 === undefined || 值 === null) return;
  if (!Array.isArray(值)) {
    throw new 应用错误("V3_REGION_PRICE_INVALID", "区域覆盖价必须是数组。", 400);
  }
  const 已存在区域 = new Set<string>();
  const 有效期列表: Array<{
    区域: string;
    开始: number;
    结束: number;
    序号: number;
  }> = [];
  for (const [序号, 项] of 值.entries()) {
    if (!项 || typeof 项 !== "object") {
      throw new 应用错误("V3_REGION_PRICE_INVALID", `区域覆盖价第 ${序号 + 1} 项格式不正确。`, 400);
    }
    const 记录 = 项 as 字典;
    const 区域数组 = 记录.regions;
    if (区域数组 !== undefined && 区域数组 !== null && !Array.isArray(区域数组)) {
      throw new 应用错误(
        "V3_REGION_PRICE_INVALID",
        `区域覆盖价第 ${序号 + 1} 项的 regions 必须是数组。`,
        400,
      );
    }
    const 区域列表: string[] = [];
    for (const [区域序号, 区域项] of (Array.isArray(区域数组) ? 区域数组 : []).entries()) {
      if (typeof 区域项 !== "string" || !区域项.trim()) {
        throw new 应用错误(
          "V3_REGION_PRICE_REGION_REQUIRED",
          `区域覆盖价第 ${序号 + 1} 项的第 ${区域序号 + 1} 个区域为空或格式不正确。`,
          400,
        );
      }
      if (!区域列表.includes(区域项.trim())) 区域列表.push(区域项.trim());
    }
    const 单项区域 = String(记录.region || "").trim();
    if (单项区域 && !区域列表.includes(单项区域)) 区域列表.unshift(单项区域);
    if (!区域列表.length) {
      throw new 应用错误(
        "V3_REGION_PRICE_REGION_REQUIRED",
        `区域覆盖价第 ${序号 + 1} 项缺少区域。`,
        400,
      );
    }
    const 区域标签 = 区域列表.join("、");
    const 开始 = 记录.effectiveAt ?? 记录.effectiveFrom ?? 记录.effectiveFromDate;
    const 结束 = 记录.effectiveTo ?? 记录.effectiveToDate;
    校验价格日期(开始, `${区域标签}区域价开始日期`);
    校验价格日期(结束, `${区域标签}区域价结束日期`);
    const 开始时间 = 开始 ? 解析价格边界(开始, false) : Number.NEGATIVE_INFINITY;
    const 结束时间 = 结束 ? 解析价格边界(结束, true) : Number.POSITIVE_INFINITY;
    if (开始 && 结束 && 开始时间 > 结束时间) {
      throw new 应用错误(
        "V3_PRICE_EFFECTIVE_DATE_INVALID",
        `${区域标签}区域价结束日期不能早于开始日期。`,
        400,
      );
    }
    for (const 区域 of 区域列表) {
      const 区域键 = `${区域}|${String(记录.effectiveAt ?? 记录.effectiveFrom ?? "")}|${String(记录.effectiveTo ?? "")}`;
      if (已存在区域.has(区域键)) {
        throw new 应用错误("V3_REGION_PRICE_DUPLICATED", `区域覆盖价存在重复区域：${区域}`, 400);
      }
      已存在区域.add(区域键);
      for (const 已有 of 有效期列表) {
        if (已有.区域 !== 区域) continue;
        if (开始时间 <= 已有.结束 && 已有.开始 <= 结束时间) {
          throw new 应用错误(
            "V3_REGION_PRICE_PERIOD_OVERLAP",
            `${区域}区域价第 ${已有.序号 + 1} 项与第 ${序号 + 1} 项有效期重叠，请调整起止日期。`,
            400,
          );
        }
      }
      有效期列表.push({ 区域, 开始: 开始时间, 结束: 结束时间, 序号 });
    }
    校验价格档位组(记录.tiers, `${区域标签}区域阶梯价`);
    校验价格档位组(记录.priceForPrimary, `${区域标签}一级渠道价`);
    校验价格档位组(记录.priceForSecondary, `${区域标签}二级渠道价`);
  }
}

/** 纯日期按自然日处理：开始取当天零点，结束取当天最后一毫秒。 */
function 解析价格边界(值: unknown, 结束边界: boolean): number {
  const 文本值 = String(值).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(文本值)) {
    return Date.parse(`${文本值}T${结束边界 ? "23:59:59.999" : "00:00:00.000"}+08:00`);
  }
  return Date.parse(文本值);
}

function 校验功能价格规则(输入: 字典): void {
  const 计价方式 = String(输入.priceType || "fixed").trim();
  const 标准档位 = 输入.tiers;
  if (计价方式 === "tiered" && (!Array.isArray(标准档位) || 标准档位.length === 0)) {
    throw new 应用错误("V3_PRICE_TIER_REQUIRED", "阶梯计价至少需要一档价格。", 400);
  }
  校验价格档位组(标准档位, "标准阶梯价");
  校验价格档位组(输入.priceForPrimary, "一级渠道价");
  校验价格档位组(输入.priceForSecondary, "二级渠道价");
  校验区域价格规则(输入.regionPriceOverrides);
}

async function 校验套餐组合(pool: Pick<Pool, "query">, 输入: 字典): Promise<void> {
  const 功能编号 = 读取对象字符串数组(输入, "featureIds")
    .map((项) => 项.trim())
    .filter(Boolean);
  const 硬件编号 = 读取对象字符串数组(输入, "hardwareIds")
    .map((项) => 项.trim())
    .filter(Boolean);
  if (!功能编号.length && !硬件编号.length) {
    throw new 应用错误("V3_PACKAGE_ITEMS_REQUIRED", "套餐至少需要包含一个功能或硬件。", 400);
  }
  if (new Set(功能编号).size !== 功能编号.length) {
    throw new 应用错误("V3_PACKAGE_FEATURE_DUPLICATED", "套餐不能包含重复功能。", 400);
  }
  if (new Set(硬件编号).size !== 硬件编号.length) {
    throw new 应用错误("V3_PACKAGE_HARDWARE_DUPLICATED", "套餐不能包含重复硬件。", 400);
  }
  for (const 编号 of 功能编号) {
    if (!(await 查找功能UUID(pool, 编号))) {
      throw new 应用错误("V3_PACKAGE_FEATURE_NOT_FOUND", `套餐功能不存在：${编号}`, 400);
    }
  }
  for (const 编号 of 硬件编号) {
    if (!(await 查找硬件UUID(pool, 编号))) {
      throw new 应用错误("V3_PACKAGE_HARDWARE_NOT_FOUND", `套餐硬件不存在：${编号}`, 400);
    }
  }
}

async function 重写套餐明细(client: PoolClient, packageUuid: string, 输入: 字典) {
  await client.query("DELETE FROM catalog.package_items WHERE package_id = $1::uuid", [
    packageUuid,
  ]);
  let sort = 1;
  for (const featureId of 读取对象字符串数组(输入, "featureIds")) {
    const uuid = await 查找功能UUID(client, featureId);
    if (!uuid)
      throw new 应用错误("V3_PACKAGE_FEATURE_NOT_FOUND", `套餐功能不存在：${featureId}`, 400);
    await client.query(
      "INSERT INTO catalog.package_items (package_id, product_ref_type, product_ref_id, quantity, sort_order) VALUES ($1::uuid, 'feature', $2::uuid, 1, $3)",
      [packageUuid, uuid, sort++],
    );
  }
  for (const hardwareId of 读取对象字符串数组(输入, "hardwareIds")) {
    const uuid = await 查找硬件UUID(client, hardwareId);
    if (!uuid)
      throw new 应用错误("V3_PACKAGE_HARDWARE_NOT_FOUND", `套餐硬件不存在：${hardwareId}`, 400);
    await client.query(
      "INSERT INTO catalog.package_items (package_id, product_ref_type, product_ref_id, quantity, sort_order) VALUES ($1::uuid, 'hardware', $2::uuid, 1, $3)",
      [packageUuid, uuid, sort++],
    );
  }
}

async function 发布产品(pool: Pool, table: string, id: string, published: boolean) {
  await pool.query(
    `UPDATE ${table} SET published = $2, status_code = CASE WHEN $2 THEN 'active' ELSE 'disabled' END, extra_json = extra_json || $3::jsonb WHERE id::text = $1 OR v2_source_id = $1`,
    [id, published, JSON.stringify({ published, status: published ? "active" : "disabled" })],
  );
  if (table.endsWith("product_features")) {
    return (await 查询V2功能产品(pool)).find((item) => item.id === id) || { id, published };
  }
  if (table.endsWith("hardware_products")) {
    return (await 查询V2硬件产品(pool)).find((item) => item.id === id) || { id, published };
  }
  return (await 查询V2产品套餐(pool)).find((item) => item.id === id) || { id, published };
}

async function 查询旧版工作量规则(pool: Pool) {
  const result = await pool.query<
    数据库行 & {
      classification_name: string | null;
      min_quantity: string | number;
      max_quantity: string | number | null;
      workload_days: string | number;
    }
  >(
    `
    SELECT r.id::text, r.v2_source_id, r.min_quantity, r.max_quantity, r.workload_days,
      jsonb_build_object(
        'productType', COALESCE(c.classification_code, r.v2_source_id),
        'productTypeLabel', COALESCE(c.classification_name, c.classification_code, r.v2_source_id),
        'minPoints', r.min_quantity,
        'maxPoints', r.max_quantity,
        'personDays', r.workload_days,
        'active', true
      ) AS extra_json,
      c.classification_name
    FROM catalog.workload_rules r
    LEFT JOIN catalog.workload_classifications c ON c.id = r.classification_id
    ORDER BY c.classification_name, r.min_quantity
    `,
  );
  return result.rows.map((row) => ({
    ...(row.extra_json || {}),
    id: 取V2编号(row),
    minPoints: Number(row.min_quantity) || 0,
    maxPoints: row.max_quantity === null ? null : Number(row.max_quantity),
    personDays: Number(row.workload_days) || 0,
  }));
}

async function 保存旧版工作量规则(pool: Pool, id: string, 输入: 字典) {
  const productType = 读取正文文本(输入, ["productType"], "EPP").toUpperCase();
  const classificationId = await 确保工作量分类(pool, productType);
  const code = id || 读取正文文本(输入, ["id"], `IWR-V3-${Date.now()}`);
  const minPoints = 读取正文数字(输入, ["minPoints"], 0);
  const maxPointsValue = 输入.maxPoints;
  const maxPoints =
    maxPointsValue === null || maxPointsValue === undefined || maxPointsValue === ""
      ? null
      : 读取正文数字(输入, ["maxPoints"], minPoints);
  const personDays = 读取正文数字(输入, ["personDays"], 0);
  if (minPoints < 0 || personDays < 0 || (maxPoints !== null && maxPoints < minPoints)) {
    throw Object.assign(new Error("工作量规则参数不合法。"), { statusCode: 400 });
  }
  const extra = {
    ...输入,
    id: code,
    productType,
    productTypeLabel: 读取正文文本(输入, ["productTypeLabel"], productType),
    minPoints,
    maxPoints,
    personDays,
    active: 读取正文布尔(输入, "active", true),
  };

  if (id) {
    const result = await pool.query<{ id: string }>(
      `
      UPDATE catalog.workload_rules
      SET classification_id = $2::uuid,
          min_quantity = $3,
          max_quantity = $4,
          workload_days = $5,
          effective_to = CASE WHEN $6 THEN NULL ELSE now() END,
          extra_json = COALESCE(extra_json, '{}'::jsonb) || $7::jsonb
      WHERE id::text = $1 OR v2_source_id = $1
      RETURNING id::text AS id
      `,
      [id, classificationId, minPoints, maxPoints, personDays, extra.active, JSON.stringify(extra)],
    );
    if (!result.rows[0]) throw Object.assign(new Error("工作量规则不存在。"), { statusCode: 404 });
  } else {
    await pool.query(
      `
      INSERT INTO catalog.workload_rules (
        v2_source_id, classification_id, min_quantity, max_quantity, workload_days, effective_from, effective_to, extra_json
      )
      VALUES ($1, $2::uuid, $3, $4, $5, now(), CASE WHEN $6 THEN NULL ELSE now() END, $7::jsonb)
      ON CONFLICT (v2_source_id) DO UPDATE
      SET classification_id = EXCLUDED.classification_id,
          min_quantity = EXCLUDED.min_quantity,
          max_quantity = EXCLUDED.max_quantity,
          workload_days = EXCLUDED.workload_days,
          effective_to = EXCLUDED.effective_to,
          extra_json = catalog.workload_rules.extra_json || EXCLUDED.extra_json
      `,
      [
        code,
        classificationId,
        minPoints,
        maxPoints,
        personDays,
        extra.active,
        JSON.stringify(extra),
      ],
    );
  }

  return (
    (await 查询旧版工作量规则(pool)).find((item) => item.id === code || item.id === id) || extra
  );
}

async function 删除旧版工作量规则(pool: Pool, id: string) {
  await pool.query(
    `
    UPDATE catalog.workload_rules
    SET effective_to = now(),
        extra_json = extra_json || $2::jsonb
    WHERE id::text = $1 OR v2_source_id = $1
    `,
    [id, JSON.stringify({ active: false, deleted: true, deletedAt: new Date().toISOString() })],
  );
}

async function 确保工作量分类(pool: Pool, code: string): Promise<string> {
  const normalized = code || "EPP";
  const result = await pool.query<{ id: string }>(
    `
    INSERT INTO catalog.workload_classifications (
      v2_source_id, classification_code, classification_name, status_code
    )
    VALUES ($1, $1, $2, 'active')
    ON CONFLICT (classification_code) DO UPDATE
    SET classification_name = EXCLUDED.classification_name,
        status_code = EXCLUDED.status_code
    RETURNING id::text AS id
    `,
    [normalized, normalized],
  );
  return result.rows[0]?.id || "";
}

async function 软归档业务记录(pool: Pool, table: string, id: string) {
  await pool.query(
    `UPDATE ${table} SET status_code = 'cancelled', updated_at = now(), extra_json = extra_json || $2::jsonb WHERE id::text = $1 OR v2_source_id = $1`,
    [id, JSON.stringify({ deleted: true, deletedAt: new Date().toISOString() })],
  );
}

async function 软归档产品记录(pool: Pool, table: string, id: string) {
  const 编号列 =
    table === "catalog.product_categories"
      ? "category_code"
      : table === "catalog.product_modules"
        ? "module_code"
        : table === "catalog.product_features"
          ? "feature_code"
          : table === "catalog.hardware_products"
            ? "hardware_code"
            : "package_code";
  const 产品 = await pool.query<{ id: string }>(
    `SELECT id::text AS id FROM ${table}
      WHERE id::text = $1 OR v2_source_id = $1 OR ${编号列} = $1
      LIMIT 1`,
    [id],
  );
  const 产品编号 = 产品.rows[0]?.id;
  if (!产品编号) throw new 应用错误("V3_PRODUCT_NOT_FOUND", "产品目录记录不存在。", 404);
  const 引用查询: Record<string, { sql: string; 名称: string }> = {
    "catalog.product_categories": {
      sql: `SELECT count(*)::int AS total FROM catalog.product_modules WHERE category_id = $1::uuid AND status_code <> 'archived'`,
      名称: "产品模块",
    },
    "catalog.product_modules": {
      sql: `SELECT count(*)::int AS total FROM catalog.product_features WHERE module_id = $1::uuid AND status_code <> 'archived'`,
      名称: "功能产品",
    },
    "catalog.product_features": {
      sql: `SELECT (
              SELECT count(*) FROM catalog.package_items pi
              JOIN catalog.product_packages p ON p.id = pi.package_id
              WHERE pi.product_ref_type = 'feature' AND pi.product_ref_id = $1::uuid AND p.status_code <> 'archived'
            ) + (
              SELECT count(*) FROM crm.quote_items qi
              WHERE qi.product_ref_type = 'feature' AND qi.product_ref_id = $1::uuid
            ) AS total`,
      名称: "产品套餐或报价单",
    },
    "catalog.hardware_products": {
      sql: `SELECT (
              SELECT count(*) FROM catalog.package_items pi
              JOIN catalog.product_packages p ON p.id = pi.package_id
              WHERE pi.product_ref_type = 'hardware' AND pi.product_ref_id = $1::uuid AND p.status_code <> 'archived'
            ) + (
              SELECT count(*) FROM crm.quote_items qi
              WHERE qi.product_ref_type = 'hardware' AND qi.product_ref_id = $1::uuid
            ) AS total`,
      名称: "产品套餐或报价单",
    },
    "catalog.product_packages": {
      sql: `SELECT count(*)::int AS total FROM crm.quote_items WHERE product_ref_type = 'package' AND product_ref_id = $1::uuid`,
      名称: "报价单",
    },
  };
  const 引用 = 引用查询[table];
  if (引用) {
    const result = await pool.query<{ total: number }>(引用.sql, [产品编号]);
    if (Number(result.rows[0]?.total || 0) > 0) {
      throw new 应用错误(
        "V3_PRODUCT_IN_USE",
        `该记录已被${引用.名称}引用，不能删除；请先解除引用或停用。`,
        409,
      );
    }
  }
  await pool.query(
    `UPDATE ${table} SET status_code = 'archived', extra_json = extra_json || $2::jsonb WHERE id::text = $1 OR v2_source_id = $1`,
    [产品编号, JSON.stringify({ deleted: true, deletedAt: new Date().toISOString() })],
  );
}

async function 查找产品大类UUID(pool: Pool, id: string): Promise<string> {
  const result = await pool.query<{ id: string }>(
    "SELECT id::text AS id FROM catalog.product_categories WHERE id::text = $1 OR v2_source_id = $1 OR category_code = $1 LIMIT 1",
    [id],
  );
  return result.rows[0]?.id || "";
}

async function 查找产品模块UUID(pool: Pool, id: string): Promise<string> {
  const result = await pool.query<{ id: string }>(
    "SELECT id::text AS id FROM catalog.product_modules WHERE id::text = $1 OR v2_source_id = $1 OR module_code = $1 LIMIT 1",
    [id],
  );
  return result.rows[0]?.id || "";
}

async function 查找功能UUID(db: Pick<Pool, "query">, id: string): Promise<string> {
  const result = await db.query<{ id: string }>(
    "SELECT id::text AS id FROM catalog.product_features WHERE (id::text = $1 OR v2_source_id = $1 OR feature_code = $1) AND status_code <> 'archived' LIMIT 1",
    [id],
  );
  return result.rows[0]?.id || "";
}

async function 查找硬件UUID(db: Pick<Pool, "query">, id: string): Promise<string> {
  const result = await db.query<{ id: string }>(
    "SELECT id::text AS id FROM catalog.hardware_products WHERE (id::text = $1 OR v2_source_id = $1 OR hardware_code = $1) AND status_code <> 'archived' LIMIT 1",
    [id],
  );
  return result.rows[0]?.id || "";
}

function 取V2编号(row: 数据库行): string {
  const extra = row.extra_json || {};
  return 读取对象文本(extra, "id") || row.v2_source_id || row.id;
}

async function 查找渠道商UUID(pool: Pick<Pool, "query">, id: string): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `
    SELECT id::text AS id
    FROM channel.partners
    WHERE id::text = $1 OR v2_source_id = $1 OR partner_code = $1 OR extra_json->>'id' = $1
    LIMIT 1
    `,
    [id],
  );
  return result.rows[0]?.id || "";
}

async function 查找用户UUID(pool: Pick<Pool, "query">, id: string): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `
    SELECT id::text AS id
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
  return result.rows[0]?.id || "";
}

async function 查询本地企业(pool: Pool, keyword: string) {
  const like = `%${keyword}%`;
  const result = await pool.query<{
    customer_name: string;
    credit_code: string | null;
    city_name: string | null;
    extra_json: 字典 | null;
  }>(
    `
    SELECT customer_name, credit_code, city_name, extra_json
    FROM crm.customers
    WHERE customer_name ILIKE $1
       OR credit_code ILIKE $1
       OR extra_json->>'customer' ILIKE $1
       OR extra_json->>'customerName' ILIKE $1
    ORDER BY updated_at DESC
    LIMIT 20
    `,
    [like],
  );
  return result.rows.map((row) => {
    const extra = row.extra_json || {};
    return {
      name: row.customer_name,
      creditCode: row.credit_code || 读取对象文本(extra, "creditCode"),
      legalPerson: 读取对象文本(extra, "legalPerson"),
      address: 读取对象文本(extra, "address") || 读取对象文本(extra, "city") || row.city_name || "",
      province: 读取对象文本(extra, "province"),
      city: 读取对象文本(extra, "city") || row.city_name || "",
      companyStatus: 读取对象文本(extra, "companyStatus") || "在营",
      industry: 读取对象文本(extra, "industry"),
      source: "local",
    };
  });
}

async function 查询导出数据(
  service: ReturnType<typeof 创建业务数据服务>,
  type: V2导出类型,
  req: Request,
  参数: V2兼容路由参数,
) {
  const module: 阶段9模块 = type === "staff" ? "users" : type;
  const result = await service.查询列表(
    module,
    { ...读取阶段9查询(req), pageSize: 1000 },
    读取当前V2业务用户(req, 参数),
  );
  return result.数据
    .map((记录) => 转V2业务记录(module, 记录))
    .filter(
      (item) => type !== "staff" || ["staff", "partner_admin"].includes(读取对象文本(item, "role")),
    );
}

function 读取导入类型(type: string): V2导入类型 {
  if ((V2导入类型列表 as readonly string[]).includes(type)) return type as V2导入类型;
  throw Object.assign(new Error("不支持的导入导出类型。"), { statusCode: 400 });
}

/** 订单只导出、不允许 Excel 导入，避免绕过报价、价格、收货与审批链路。 */
function 读取导出类型(type: string): V2导出类型 {
  if ((V2导出类型列表 as readonly string[]).includes(type)) return type as V2导出类型;
  throw Object.assign(new Error("不支持的导出类型。"), { statusCode: 400 });
}

function 读取上传文件(req: Request): Express.Multer.File {
  const file = req.file;
  if (!file) throw Object.assign(new Error("请上传Excel文件。"), { statusCode: 400 });
  return file;
}

function 生成导入模板Excel(type: V2导入类型): Buffer {
  const template = V2导入模板[type];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([template.headers, template.example]);
  ws["!cols"] = template.headers.map(() => ({ wch: 20 }));
  XLSX.utils.book_append_sheet(wb, ws, template.sheetName);

  if (type === "partners") {
    const guide = XLSX.utils.aoa_to_sheet([
      ["渠道商导入填写说明"],
      ["1. 兼容旧模板：只保留主档字段也可以导入，新增简介字段全部为选填。"],
      ["2. 已存在渠道商按“渠道商名称”更新；不存在则新增。"],
      ["3. 简介字段空白时不覆盖已有资料；如需清空简介字段，请填写“清空”或“__CLEAR__”。"],
      ["4. 多值字段可用顿号、逗号、分号或换行分隔。"],
      ["5. 资料是否已核验请填写：是 或 否。"],
    ]);
    guide["!cols"] = [{ wch: 90 }];
    XLSX.utils.book_append_sheet(wb, guide, "填写说明");
  }

  if (type === "opportunities") {
    const stages = XLSX.utils.aoa_to_sheet([
      ["商机阶段可选值"],
      ["1% 已联系上客户"],
      ["10% 商机明确并报备"],
      ["20% 正式报价"],
      ["30% 明确预算"],
      ["40% 技术交流/方案设计"],
      ["50% 产品测试"],
      ["70% 招投标/商务谈判"],
      ["100% 赢单"],
      ["项目取消"],
      ["输单"],
    ]);
    stages["!cols"] = [{ wch: 36 }];
    XLSX.utils.book_append_sheet(wb, stages, "阶段选项说明");
  }

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function 生成ExcelBuffer(sheetName: string, headers: string[], rows: unknown[][]): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = headers.map((header) => ({ wch: Math.max(14, Math.min(30, header.length + 8)) }));
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function 构建导出行(type: V2导出类型, item: 字典): unknown[] {
  if (type === "partners") {
    return [
      读取对象文本(item, "id"),
      读取对象文本(item, "name") || 读取对象文本(item, "partnerName"),
      导出合作级别标签(读取对象文本(item, "level")),
      导出渠道层级标签(读取对象文本(item, "partnerLevel")),
      读取对象文本(item, "region"),
      读取对象文本(item, "city"),
      读取对象文本(item, "bigRegion"),
      读取对象文本(item, "contact"),
      读取对象文本(item, "phone"),
      读取对象文本(item, "email"),
      导出技术服务类型标签(读取对象文本(item, "techServiceType")),
      导出状态标签(读取对象文本(item, "status")),
      读取对象文本(item, "joinDate") || 读取对象文本(item, "createdAt"),
      读取对象数组(item, "staff").length,
      读取对象数字(item, "quoteCount", 0),
      读取对象数字(item, "orderCount", 0),
      读取对象数字(item, "totalAmt", 0),
      ...V2渠道简介列.map((column) => 导出简介字段(item, column.key)),
    ];
  }
  if (type === "staff") {
    return [
      读取对象文本(item, "id"),
      读取对象文本(item, "username"),
      读取对象文本(item, "name"),
      读取对象文本(item, "role") === "partner_admin" ? "企业管理员" : "员工",
      读取对象文本(item, "partnerId"),
      读取对象文本(item, "partnerName"),
      读取对象文本(item, "region"),
      读取对象文本(item, "bigRegion"),
      读取对象文本(item, "phone"),
      读取对象文本(item, "email"),
      导出状态标签(读取对象文本(item, "status")),
      读取对象文本(item, "createdAt"),
    ];
  }
  if (type === "registrations") {
    return [
      读取对象文本(item, "id"),
      读取对象文本(item, "customer"),
      读取对象文本(item, "creditCode"),
      读取对象文本(item, "industry"),
      读取对象文本(item, "contact"),
      读取对象文本(item, "phone"),
      读取对象文本(item, "region"),
      读取对象文本(item, "assignedPartnerId") || 读取对象文本(item, "partnerId"),
      读取对象文本(item, "assignedPartnerName") || 读取对象文本(item, "partnerName"),
      读取对象文本(item, "assignedStaffId"),
      读取对象文本(item, "assignedStaffName"),
      导出状态标签(读取对象文本(item, "status")),
      读取对象文本(item, "createdAt"),
      读取对象文本(item, "expireAt"),
      读取对象文本(item, "protectDays"),
      读取对象文本(item, "notes") || 读取对象文本(item, "remark"),
    ];
  }
  if (type === "orders") {
    return [
      读取对象文本(item, "id"),
      读取对象文本(item, "code") || 读取对象文本(item, "orderNo"),
      读取对象文本(item, "preRegionOrderNo"),
      读取对象文本(item, "customer") || 读取对象文本(item, "customerName"),
      读取对象文本(item, "partnerName"),
      导出渠道层级标签(读取对象文本(item, "partnerLevel")),
      读取对象文本(item, "region"),
      读取对象文本(item, "businessTypeName") || 读取对象文本(item, "businessType"),
      读取对象文本(item, "quoteTypeName") || 读取对象文本(item, "quoteType"),
      导出状态标签(读取对象文本(item, "status")),
      读取对象数字(item, "amount", 0),
      读取对象数字(item, "originalAmount", 0),
      读取对象文本(item, "shipmentAmount"),
      读取对象文本(item, "assignedStaffName") || 读取对象文本(item, "ownerName"),
      读取对象文本(item, "createdAt"),
      读取对象文本(item, "updatedAt"),
      读取对象文本(item, "recipientName"),
      读取对象文本(item, "recipientPhone"),
      读取对象文本(item, "deliveryAddr"),
    ];
  }
  return [
    读取对象文本(item, "id"),
    读取对象文本(item, "name"),
    读取对象文本(item, "customer"),
    读取对象文本(item, "industry"),
    读取对象文本(item, "contact"),
    读取对象文本(item, "phone"),
    读取对象文本(item, "region"),
    读取对象文本(item, "assignedPartnerId") || 读取对象文本(item, "partnerId"),
    读取对象文本(item, "assignedPartnerName") || 读取对象文本(item, "partnerName"),
    读取对象文本(item, "assignedStaffId"),
    读取对象文本(item, "assignedStaffName") || 读取对象文本(item, "owner"),
    导出商机阶段标签(读取对象文本(item, "stage")),
    读取对象数字(item, "amount", 0),
    读取对象文本(item, "expectedClose"),
    读取对象文本(item, "lastFollowAt"),
    读取对象文本(item, "source"),
    读取对象字符串数组(item, "tags").join("、"),
    读取对象文本(item, "notes") || 读取对象文本(item, "remark"),
    读取对象文本(item, "createdAt"),
  ];
}

async function 解析导入Excel(
  pool: Pool,
  type: V2导入类型,
  file: Express.Multer.File,
): Promise<V2导入解析结果> {
  const template = V2导入模板[type];
  const 文件内容 = 校验并读取导入文件(file);
  const workbook = XLSX.read(文件内容.payload, {
    type: 文件内容.readType,
    cellDates: true,
    ...(文件内容.readType === "buffer" ? { codepage: 65001 } : {}),
  });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName)
    throw Object.assign(new Error("Excel文件内容为空或格式不正确。"), { statusCode: 400 });
  const sheet = workbook.Sheets[sheetName];
  if (!sheet)
    throw Object.assign(new Error("Excel文件内容为空或格式不正确。"), { statusCode: 400 });
  const table = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][];
  if (table.length < 2) {
    throw Object.assign(new Error("Excel文件内容为空或格式不正确。"), { statusCode: 400 });
  }
  const headerRow = table[0] || [];
  const rows = table.slice(1).filter((row) => row.some((cell) => 标准化导入单元格(cell)));
  const headerMap = 构建导入表头映射(template);
  const headers = 获取导入显示表头(headerRow, headerMap);
  const parsedRows: V2导入行[] = [];
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index] || [];
    const data = 解析导入行(headerRow, row, headerMap);
    const errors = await 校验导入行(pool, type, data);
    parsedRows.push({ rowIndex: index + 2, data, errors });
  }
  校验导入同文件重复(type, parsedRows);
  return {
    headers,
    rows: parsedRows,
    totalCount: rows.length,
    errorCount: parsedRows.filter((row) => row.errors.length > 0).length,
    validCount: parsedRows.filter((row) => row.errors.length === 0).length,
    batchId: crypto.randomUUID(),
  };
}

async function 执行导入Excel(
  pool: Pool,
  type: V2导入类型,
  file: Express.Multer.File,
  导入账号: string,
  导入用户: 当前业务用户 | null,
): Promise<V2导入结果> {
  const parsed = await 解析导入Excel(pool, type, file);
  const taskId = await 创建导入任务(pool, type, parsed, file, 导入账号);
  const results: V2导入结果 = {
    success: 0,
    updated: 0,
    profileUpdated: 0,
    failed: 0,
    errors: [],
    batchId: parsed.batchId,
    taskId,
    totalCount: parsed.totalCount,
    errorReportUrl: `/api/v2/import/tasks/${taskId}/errors.csv`,
    rows: [],
  };

  for (const row of parsed.rows) {
    if (row.errors.length) {
      results.failed++;
      results.errors.push({ row: row.rowIndex, message: row.errors.join("；") });
      results.rows.push({ row: row.rowIndex, status: "failed", message: row.errors.join("；") });
      continue;
    }
    try {
      const 写入前 = await 读取导入行快照(pool, type, row.data);
      const result = await 写入导入行(pool, type, row.data, 导入用户);
      const 写入后 = await 读取导入行快照(pool, type, row.data);
      const 差异 = 构建导入行差异(写入前, 写入后);
      const 结果附加字段 = {
        targetId: 差异.targetId,
        changedFields: 差异.changedFields,
        changes: 差异.changes,
        before: 差异.before,
        after: 差异.after,
      };
      if (result === "updated") {
        results.updated++;
        results.rows.push({
          row: row.rowIndex,
          status: "updated",
          message: "已更新",
          ...结果附加字段,
        });
      } else if (result === "created") {
        results.success++;
        results.rows.push({
          row: row.rowIndex,
          status: "created",
          message: "已新增",
          ...结果附加字段,
        });
      } else if (result === "profile-updated") {
        results.updated++;
        results.profileUpdated++;
        results.rows.push({
          row: row.rowIndex,
          status: "updated",
          message: "已更新简介资料",
          ...结果附加字段,
        });
      } else {
        results.success++;
        results.profileUpdated++;
        results.rows.push({
          row: row.rowIndex,
          status: "created",
          message: "已新增并写入简介资料",
          ...结果附加字段,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "导入失败";
      results.failed++;
      results.errors.push({ row: row.rowIndex, message });
      results.rows.push({ row: row.rowIndex, status: "failed", message });
    }
  }

  await 更新导入任务(pool, taskId, parsed, file, 导入账号, results);

  return results;
}

interface V2导入行快照 {
  targetId: string;
  values: 字典;
}

/**
 * 读取导入目标的可比较业务快照。
 * 只保留模板业务字段，不把密码、内部行版本和审计元数据写入差异记录。
 */
async function 读取导入行快照(
  pool: Pool,
  type: V2导入类型,
  item: 字典,
): Promise<V2导入行快照 | null> {
  const 客户名称 = 读取对象文本(item, "customer");
  const 信用代码 = 读取对象文本(item, "creditCode").replace(/\s+/g, "").toUpperCase();
  const 登录账号 = 读取对象文本(item, "username");
  const 商机名称 = 读取对象文本(item, "name");

  if (type === "partners") {
    const result = await pool.query<{
      target_id: string;
      partner_name: string;
      partner_code: string | null;
      city_name: string | null;
      contact_name: string | null;
      contact_phone: string | null;
      contact_email: string | null;
      status_code: string;
      region_name: string | null;
      big_region_name: string | null;
      extra_json: 字典 | null;
      profile_json: 字典 | null;
    }>(
      `
      SELECT
        p.id::text AS target_id,
        p.partner_name,
        COALESCE(p.v2_source_id, p.partner_code, p.id::text) AS partner_code,
        p.city_name,
        p.contact_name,
        p.contact_phone,
        p.contact_email::text AS contact_email,
        p.status_code,
        r.region_name,
        big.region_name AS big_region_name,
        p.extra_json,
        pp.extra_json AS profile_json
      FROM channel.partners p
      LEFT JOIN org.regions r ON r.id = p.region_id
      LEFT JOIN org.regions big ON big.id = r.parent_region_id
      LEFT JOIN LATERAL (
        SELECT extra_json
        FROM channel.partner_profiles
        WHERE partner_id = p.id AND status_code = 'active'
        ORDER BY updated_at DESC NULLS LAST, id
        LIMIT 1
      ) pp ON true
      WHERE p.status_code <> 'archived'
        AND (
          p.normalized_name = $1
          OR p.partner_name = $2
          OR p.extra_json->>'name' = $2
        )
      ORDER BY p.updated_at DESC
      LIMIT 1
      `,
      [migrationNormalizedName(读取对象文本(item, "name")), 读取对象文本(item, "name")],
    );
    const row = result.rows[0];
    if (!row) return null;
    return 构建导入快照(type, row.target_id, {
      ...(row.extra_json || {}),
      ...(row.profile_json || {}),
      id: row.partner_code || row.target_id,
      name: row.partner_name,
      partnerName: row.partner_name,
      region: row.region_name || "",
      city: row.city_name || "",
      bigRegion: row.big_region_name || "",
      contact: row.contact_name || "",
      phone: row.contact_phone || "",
      email: row.contact_email || "",
      status: row.status_code,
    });
  }

  if (type === "staff") {
    const result = await pool.query<{
      target_id: string;
      username: string;
      display_name: string;
      phone: string | null;
      email: string | null;
      status_code: string;
      member_role_code: string | null;
      partner_name: string | null;
      region_name: string | null;
      big_region_name: string | null;
      extra_json: 字典 | null;
    }>(
      `
      SELECT
        u.id::text AS target_id,
        u.username::text AS username,
        u.display_name,
        u.phone,
        u.email::text AS email,
        u.status_code,
        pm.member_role_code,
        p.partner_name,
        r.region_name,
        big.region_name AS big_region_name,
        u.extra_json
      FROM iam.users u
      LEFT JOIN channel.partner_members pm
        ON pm.user_id = u.id AND pm.archived_at IS NULL
      LEFT JOIN channel.partners p ON p.id = pm.partner_id AND p.status_code <> 'archived'
      LEFT JOIN org.regions r ON r.id = p.region_id
      LEFT JOIN org.regions big ON big.id = r.parent_region_id
      WHERE lower(u.username::text) = lower($1)
      ORDER BY pm.updated_at DESC NULLS LAST, pm.is_primary DESC
      LIMIT 1
      `,
      [登录账号],
    );
    const row = result.rows[0];
    if (!row) return null;
    return 构建导入快照(type, row.target_id, {
      ...(row.extra_json || {}),
      username: row.username,
      name: row.display_name,
      phone: row.phone || "",
      email: row.email || "",
      status: row.status_code,
      role: row.member_role_code || "",
      partnerName: row.partner_name || "",
      region: row.region_name || "",
      bigRegion: row.big_region_name || "",
    });
  }

  if (type === "registrations") {
    const result = await pool.query<{
      target_id: string;
      customer_name: string;
      credit_code: string | null;
      status_code: string;
      partner_name: string | null;
      assigned_staff_name: string | null;
      region_name: string | null;
      extra_json: 字典 | null;
    }>(
      `
      SELECT
        r.id::text AS target_id,
        c.customer_name,
        c.credit_code,
        r.status_code,
        p.partner_name,
        u.display_name AS assigned_staff_name,
        reg.region_name,
        r.extra_json
      FROM crm.registrations r
      JOIN crm.customers c ON c.id = r.customer_id
      LEFT JOIN channel.partners p ON p.id = r.partner_id
      LEFT JOIN iam.users u ON u.id = r.owner_user_id
      LEFT JOIN org.regions reg ON reg.id = r.region_id
      WHERE c.status_code <> 'merged'
        AND (
          ($1 <> '' AND c.normalized_name = $1)
          OR ($2 <> '' AND c.customer_name = $2)
          OR ($3 <> '' AND upper(regexp_replace(COALESCE(c.credit_code, ''), '\\s+', '', 'g')) = $3)
        )
      ORDER BY r.updated_at DESC
      LIMIT 1
      `,
      [migrationNormalizedName(客户名称), 客户名称, 信用代码],
    );
    const row = result.rows[0];
    if (!row) return null;
    return 构建导入快照(type, row.target_id, {
      ...(row.extra_json || {}),
      customer: row.customer_name,
      creditCode: row.credit_code || "",
      partnerName: row.partner_name || "",
      assignedStaffName: row.assigned_staff_name || "",
      region: row.region_name || "",
      status: row.status_code,
    });
  }

  const result = await pool.query<{
    target_id: string;
    opportunity_name: string;
    customer_name: string;
    expected_amount: string | number | null;
    stage_code: string;
    status_code: string;
    partner_name: string | null;
    assigned_staff_name: string | null;
    region_name: string | null;
    extra_json: 字典 | null;
  }>(
    `
    SELECT
      o.id::text AS target_id,
      COALESCE(o.extra_json->>'name', o.opportunity_no, o.id::text) AS opportunity_name,
      c.customer_name,
      o.expected_amount,
      o.stage_code,
      o.status_code,
      p.partner_name,
      u.display_name AS assigned_staff_name,
      reg.region_name,
      o.extra_json
    FROM crm.opportunities o
    JOIN crm.customers c ON c.id = o.customer_id
    LEFT JOIN channel.partners p ON p.id = o.partner_id
    LEFT JOIN iam.users u ON u.id = o.owner_user_id
    LEFT JOIN org.regions reg ON reg.id = o.region_id
    WHERE c.status_code <> 'merged'
      AND COALESCE(o.extra_json->>'name', o.opportunity_no, o.id::text) = $1
      AND (
        ($2 <> '' AND c.normalized_name = $2)
        OR ($3 <> '' AND c.customer_name = $3)
      )
    ORDER BY o.updated_at DESC
    LIMIT 1
    `,
    [商机名称, migrationNormalizedName(客户名称), 客户名称],
  );
  const row = result.rows[0];
  if (!row) return null;
  return 构建导入快照(type, row.target_id, {
    ...(row.extra_json || {}),
    name: row.opportunity_name,
    customer: row.customer_name,
    amount: Number(row.expected_amount || 0),
    stage: row.stage_code,
    status: row.status_code,
    partnerName: row.partner_name || "",
    assignedStaffName: row.assigned_staff_name || "",
    region: row.region_name || "",
  });
}

function 构建导入快照(type: V2导入类型, targetId: string, values: 字典): V2导入行快照 {
  return {
    targetId,
    values: Object.fromEntries(
      V2导入模板[type].keys
        .filter((key) => key !== "password")
        .map((key) => [key, values[key] ?? ""]),
    ),
  };
}

function 归一化导入比较值(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map((item) => 归一化导入比较值(item)).join("、");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value).trim();
}

function 构建导入行差异(
  写入前: V2导入行快照 | null,
  写入后: V2导入行快照 | null,
): {
  targetId: string;
  changedFields: string[];
  changes: V2导入字段差异[];
  before: 字典 | null;
  after: 字典 | null;
} {
  const 前值 = 写入前?.values || null;
  const 后值 = 写入后?.values || null;
  const 字段集合 = [...new Set([...Object.keys(前值 || {}), ...Object.keys(后值 || {})])];
  const 变更 = 字段集合
    .filter((字段) => 归一化导入比较值(前值?.[字段]) !== 归一化导入比较值(后值?.[字段]))
    .map((字段) => ({
      字段: 导入字段名称(字段),
      更新前: 前值?.[字段] ?? "",
      更新后: 后值?.[字段] ?? "",
    }));
  return {
    targetId: 写入后?.targetId || 写入前?.targetId || "",
    changedFields: 变更.map((项) => 项.字段),
    changes: 变更,
    before: 前值,
    after: 后值,
  };
}

/** 导入文件必须先校验扩展名、文件头与编码，再由解析器读取内容。 */
function 校验并读取导入文件(file: Express.Multer.File): {
  payload: Buffer | string;
  readType: "buffer" | "string";
} {
  const fileName = String(file.originalname || "").trim();
  const extension = (fileName.toLowerCase().match(/\.[^.]+$/)?.[0] || "") as string;
  if (![".xlsx", ".xls", ".csv"].includes(extension)) {
    throw Object.assign(new Error("仅支持导入 .xlsx、.xls 或 UTF-8 编码的 .csv 文件。"), {
      statusCode: 400,
    });
  }
  const mime = String(file.mimetype || "").toLowerCase();
  const allowedMime = new Set([
    "",
    "application/octet-stream",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "text/csv",
    "application/csv",
    "text/plain",
  ]);
  if (!allowedMime.has(mime) || /executable|javascript|html/.test(mime)) {
    throw Object.assign(new Error("上传文件类型与扩展名不匹配，请重新选择文件。"), {
      statusCode: 400,
    });
  }
  const buffer = file.buffer;
  if (!buffer?.length) {
    throw Object.assign(new Error("上传文件为空，请重新选择文件。"), { statusCode: 400 });
  }
  if (extension === ".xlsx") {
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
      throw Object.assign(new Error("文件扩展名为 .xlsx，但文件内容不是有效的 Excel 文件。"), {
        statusCode: 400,
      });
    }
    return { payload: buffer, readType: "buffer" };
  }
  if (extension === ".xls") {
    const oleHeader = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
    if (!oleHeader.every((byte, index) => buffer[index] === byte)) {
      throw Object.assign(new Error("文件扩展名为 .xls，但文件内容不是有效的 Excel 文件。"), {
        statusCode: 400,
      });
    }
    return { payload: buffer, readType: "buffer" };
  }
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    return { payload: text.replace(/^\uFEFF/, ""), readType: "string" };
  } catch {
    throw Object.assign(
      new Error("CSV 文件必须使用 UTF-8 编码，检测到 GBK 或其他编码，请另存为 UTF-8 后再导入。"),
      { statusCode: 400 },
    );
  }
}

/** 同文件重复按业务唯一键在预检阶段标记，避免整批写入后才暴露重复数据。 */
function 校验导入同文件重复(type: V2导入类型, rows: V2导入行[]): void {
  const firstRow = new Map<string, number>();
  for (const row of rows) {
    const keys = 读取导入同文件唯一键(type, row.data);
    if (!keys.length) continue;
    const 重复来源 = keys.map((key) => firstRow.get(key)).find(Boolean);
    if (重复来源) {
      row.errors.push(`与第 ${重复来源} 行数据重复，同一文件内不能重复导入。`);
      continue;
    }
    for (const key of keys) firstRow.set(key, row.rowIndex);
  }
}

function 读取导入同文件唯一键(type: V2导入类型, data: 字典): string[] {
  const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("zh-CN");
  if (type === "partners") {
    const name = normalize(读取对象文本(data, "name"));
    return name ? [`name:${name}`] : [];
  }
  if (type === "staff") {
    const username = normalize(读取对象文本(data, "username"));
    return username ? [`username:${username}`] : [];
  }
  if (type === "registrations") {
    const customer = normalize(读取对象文本(data, "customer"));
    const creditCode = 读取对象文本(data, "creditCode").replace(/\s+/g, "").toUpperCase();
    return [
      ...(customer ? [`customer:${customer}`] : []),
      ...(creditCode ? [`credit:${creditCode}`] : []),
    ];
  }
  const name = normalize(读取对象文本(data, "name"));
  const customer = normalize(读取对象文本(data, "customer"));
  return name && customer ? [`opportunity:${name}\u0000${customer}`] : [];
}

const 导入字段最大长度: Record<string, number> = {
  id: 80,
  name: 200,
  username: 64,
  password: 128,
  region: 80,
  city: 80,
  bigRegion: 80,
  contact: 60,
  phone: 40,
  email: 120,
  customer: 200,
  creditCode: 32,
  industry: 80,
  assignedStaffName: 80,
  partnerName: 200,
  address: 240,
  notes: 2000,
  remark: 2000,
  serviceAreas: 1000,
  customerIndustries: 1000,
};

function 校验导入字段长度(data: 字典, errors: string[]): void {
  for (const [key, value] of Object.entries(data)) {
    const max = 导入字段最大长度[key] ?? 2000;
    if (String(value ?? "").length > max) {
      errors.push(`字段「${导入字段名称(key)}」长度不能超过 ${max} 个字符。`);
    }
  }
}

async function 创建导入任务(
  pool: Pool,
  type: V2导入类型,
  parsed: V2导入解析结果,
  file: Express.Multer.File,
  导入账号: string,
): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `
    INSERT INTO ops.import_export_tasks (
      task_type_code, business_type_code, status_code, requested_by_user_id,
      progress_percent, started_at, extra_json
    )
    VALUES (
      'import', $1, 'running',
      (SELECT id FROM iam.users WHERE lower(username::text)=lower($2) LIMIT 1),
      0, now(), $3::jsonb
    )
    RETURNING id::text AS id
    `,
    [
      type,
      导入账号,
      JSON.stringify({
        batchId: parsed.batchId,
        fileName: file.originalname || "",
        fileSize: file.size || file.buffer.length,
        uploadedBy: 导入账号,
        headers: parsed.headers,
        totalCount: parsed.totalCount,
        rows: parsed.rows,
      }),
    ],
  );
  const taskId = result.rows[0]?.id;
  if (!taskId) throw new Error("导入任务创建失败。");
  return taskId;
}

async function 更新导入任务(
  pool: Pool,
  taskId: string,
  parsed: V2导入解析结果,
  file: Express.Multer.File,
  导入账号: string,
  results: V2导入结果,
): Promise<void> {
  const 是否成功 = results.success + results.updated > 0;
  await pool.query(
    `
    UPDATE ops.import_export_tasks
    SET status_code = $2,
        progress_percent = 100,
        finished_at = now(),
        error_message = $3,
        extra_json = extra_json || $4::jsonb
    WHERE id = $1::uuid
    `,
    [
      taskId,
      是否成功 ? "succeeded" : "failed",
      是否成功 ? null : "全部数据行均未通过校验或写入失败。",
      JSON.stringify({
        batchId: parsed.batchId,
        fileName: file.originalname || "",
        fileSize: file.size || file.buffer.length,
        uploadedBy: 导入账号,
        headers: parsed.headers,
        totalCount: parsed.totalCount,
        successCount: results.success,
        updatedCount: results.updated,
        failedCount: results.failed,
        rows: results.rows.map((row) => ({
          ...row,
          data: parsed.rows.find((parsedRow) => parsedRow.rowIndex === row.row)?.data || {},
        })),
        errorReportUrl: results.errorReportUrl,
      }),
    ],
  );
}

async function 查询导入任务(pool: Pool, id: string): Promise<字典 | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const result = await pool.query<{
    id: string;
    type: string;
    status: string;
    created_at: Date;
    finished_at: Date | null;
    error_message: string | null;
    extra_json: 字典 | null;
  }>(
    `
    SELECT id::text AS id, business_type_code AS type, status_code AS status,
      created_at, finished_at, error_message, extra_json
    FROM ops.import_export_tasks
    WHERE id = $1::uuid AND task_type_code = 'import'
    LIMIT 1
    `,
    [id],
  );
  const row = result.rows[0];
  if (!row) return null;
  const extra = row.extra_json || {};
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
    errorMessage: row.error_message,
    batchId: String(extra.batchId || ""),
    fileName: String(extra.fileName || ""),
    totalCount: Number(extra.totalCount || 0),
    successCount: Number(extra.successCount || 0),
    updatedCount: Number(extra.updatedCount || 0),
    failedCount: Number(extra.failedCount || 0),
    rows: Array.isArray(extra.rows) ? extra.rows : [],
    errorReportUrl: String(extra.errorReportUrl || `/api/v2/import/tasks/${row.id}/errors.csv`),
  };
}

function 生成导入错误报告Csv(任务: 字典): Buffer {
  const rows = Array.isArray(任务.rows) ? (任务.rows as Array<Record<string, unknown>>) : [];
  const failedRows = rows.filter((row) => row.status === "failed");
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const lines = [
    ["行号", "错误信息", "客户/名称", "登录账号", "渠道商"].map(escape).join(","),
    ...failedRows.map((row) => {
      const data = (row.data && typeof row.data === "object" ? row.data : {}) as 字典;
      return [
        row.row,
        row.message,
        读取对象文本(data, "customer") || 读取对象文本(data, "name"),
        读取对象文本(data, "username"),
        读取对象文本(data, "partnerName"),
      ]
        .map(escape)
        .join(",");
    }),
  ];
  return Buffer.from(`\uFEFF${lines.join("\r\n")}`, "utf8");
}

function 构建导入表头映射(template: V2导入模板配置): Record<string, string> {
  const map: Record<string, string> = {};
  template.headers.forEach((header, index) => {
    const key = template.keys[index];
    if (!key) return;
    for (const alias of [header, header.replace(/\*$/, ""), `${header.replace(/\*$/, "")}*`]) {
      map[标准化导入表头(alias)] = key;
    }
  });
  for (const [key, aliases] of Object.entries(template.headerAliases || {})) {
    for (const alias of aliases) {
      map[标准化导入表头(alias)] = key;
      map[标准化导入表头(alias.replace(/\*$/, ""))] = key;
      map[标准化导入表头(`${alias.replace(/\*$/, "")}*`)] = key;
    }
  }
  return map;
}

function 获取导入显示表头(headers: unknown[], headerMap: Record<string, string>) {
  return headers
    .map((header) => 标准化导入表头(header))
    .filter((header) => header && headerMap[header]);
}

function 解析导入行(headers: unknown[], row: unknown[], headerMap: Record<string, string>): 字典 {
  const item: 字典 = {};
  headers.forEach((header, index) => {
    const key = headerMap[标准化导入表头(header)];
    if (!key) return;
    item[key] = 标准化导入单元格(row[index]);
  });
  return item;
}

async function 校验导入行(pool: Pool, type: V2导入类型, item: 字典) {
  const template = V2导入模板[type];
  const errors: string[] = [];
  校验导入字段长度(item, errors);
  for (const key of template.required) {
    if (!读取对象文本(item, key)) errors.push(`缺少必填字段：${导入字段名称(key)}`);
  }
  if (type === "partners") {
    item.level = 规范导入合作级别(读取对象文本(item, "level"));
    item.techServiceType = 规范导入技术服务类型(读取对象文本(item, "techServiceType"));
    if (读取对象文本(item, "invoiceCapability")) {
      const invoice = 规范导入开票能力(读取对象文本(item, "invoiceCapability"));
      if (!invoice) errors.push("开票能力无效。");
      else item.invoiceCapability = invoice;
    }
    if (读取对象文本(item, "verified")) {
      const verified = 规范导入布尔(读取对象文本(item, "verified"));
      if (verified === null) errors.push("资料是否已核验无效，请填写 是/否。");
      else item.verified = verified;
    }
    return errors;
  }

  const partnerName = 读取对象文本(item, "partnerName");
  const partner = partnerName ? await 查询渠道商按名称(pool, partnerName, { 仅生效: true }) : null;
  if (partnerName && !partner) errors.push(`渠道商“${partnerName}”不存在。`);
  if (type === "staff") {
    item.status = 规范导入员工状态(读取对象文本(item, "status"));
    const username = 读取对象文本(item, "username");
    const existing = username ? await 查询V2用户(pool, username, true) : null;
    if (existing) {
      const 同一渠道 =
        Boolean(partner) &&
        [partner?.id, partner?.uuid].includes(读取对象文本(existing, "partnerId"));
      const 是渠道员工 = existing.role === "staff";
      if (!同一渠道 || !是渠道员工) {
        errors.push(`登录账号“${username}”已被其他账号使用，请更换登录账号。`);
      }
    }
    const phone = 规范化联系电话(读取对象文本(item, "phone"));
    if (phone) {
      const phoneConflict = await pool.query<{ username: string; display_name: string | null }>(
        `
        SELECT username::text AS username, display_name
        FROM iam.users
        WHERE iam.normalize_phone(phone) = $1
          AND lower(username::text) <> lower($2)
        LIMIT 1
        `,
        [phone, username],
      );
      const conflict = phoneConflict.rows[0];
      if (conflict) {
        errors.push(
          `联系电话已被账号“${conflict.display_name || conflict.username}”使用，请更换。`,
        );
      }
    }
    return errors;
  }

  const staffName = 读取对象文本(item, "assignedStaffName");
  const staff =
    partner && staffName ? await 查询员工按姓名和渠道(pool, staffName, partner.uuid) : null;
  if (partner && staffName && !staff) {
    errors.push(`渠道商“${partner.name}”下不存在员工“${staffName}”。`);
  }
  if (type === "opportunities") {
    item.stage = 规范导入商机阶段(读取对象文本(item, "stage"));
    const customer = 读取对象文本(item, "customer");
    const registration = customer ? await 查询已通过报备(pool, customer) : null;
    if (customer && !registration) {
      errors.push(`客户“${customer}”尚未报备或报备未通过审批。`);
    }
  }
  return errors;
}

async function 写入导入行(
  pool: Pool,
  type: V2导入类型,
  item: 字典,
  当前用户: 当前业务用户 | null,
): Promise<"created" | "updated" | "profile-created" | "profile-updated"> {
  if (type === "partners") return 写入导入渠道商(pool, item);
  if (type === "staff") return 写入导入员工(pool, item, 当前用户);
  if (type === "registrations") return 写入导入报备(pool, item);
  return 写入导入商机(pool, item);
}

async function 写入导入渠道商(
  pool: Pool,
  item: 字典,
): Promise<"created" | "updated" | "profile-created" | "profile-updated"> {
  const name = 读取对象文本(item, "name");
  const existing = await 查询渠道商按名称(pool, name);
  const code = existing?.id || 生成导入编号("P");
  const 保留状态 =
    existing && ["pending", "rejected"].includes(existing.statusCode || "")
      ? existing.statusCode
      : "active";
  const regionId = await 确保区域(pool, 读取对象文本(item, "region"));
  const extra = {
    ...item,
    id: code,
    name,
    partnerName: name,
    level: 读取对象文本(item, "level"),
    partnerLevel: 读取对象文本(item, "partnerLevel") || "none",
    status: 保留状态,
    joinDate: new Date().toISOString().slice(0, 10),
    isTechService: 读取对象文本(item, "techServiceType") === "full",
  };
  if (existing) {
    await pool.query(
      `
      UPDATE channel.partners
      SET partner_name = $2,
          normalized_name = $3,
          region_id = $4::uuid,
          city_name = NULLIF($5, ''),
          contact_name = NULLIF($6, ''),
          contact_phone = NULLIF($7, ''),
          contact_email = NULLIF($8, '')::citext,
          status_code = $10,
          updated_at = now(),
          extra_json = extra_json || $9::jsonb
      WHERE id = $1::uuid
      `,
      [
        existing.uuid,
        name,
        migrationNormalizedName(name),
        regionId,
        读取对象文本(item, "city"),
        读取对象文本(item, "contact"),
        读取对象文本(item, "phone"),
        读取对象文本(item, "email"),
        JSON.stringify(extra),
        保留状态,
      ],
    );
  } else {
    await pool.query(
      `
      INSERT INTO channel.partners (
        v2_source_id, partner_code, partner_name, normalized_name, partner_level_code,
        region_id, city_name, contact_name, contact_phone, contact_email, status_code,
        joined_on, extra_json
      )
      VALUES ($1, $1, $2, $3, 'none', $4::uuid, NULLIF($5, ''), NULLIF($6, ''), NULLIF($7, ''), NULLIF($8, '')::citext, $10, now()::date, $9::jsonb)
      `,
      [
        code,
        name,
        migrationNormalizedName(name),
        regionId,
        读取对象文本(item, "city"),
        读取对象文本(item, "contact"),
        读取对象文本(item, "phone"),
        读取对象文本(item, "email"),
        JSON.stringify(extra),
        保留状态,
      ],
    );
  }

  const profile = 构建导入渠道简介(item);
  if (Object.keys(profile).length > 0) {
    await 保存渠道商简介(pool, code, profile);
    return existing ? "profile-updated" : "profile-created";
  }
  return existing ? "updated" : "created";
}

async function 写入导入员工(
  pool: Pool,
  item: 字典,
  当前用户: 当前业务用户 | null,
): Promise<"created" | "updated"> {
  const partner = await 查询渠道商按名称(pool, 读取对象文本(item, "partnerName"), {
    仅生效: true,
  });
  if (!partner) throw new Error("渠道商不存在。");
  const existing = await 查询V2用户(pool, 读取对象文本(item, "username"));
  await 保存渠道商员工(
    pool,
    partner.id,
    existing?.id || "",
    {
      ...item,
      role: "staff",
      partnerId: partner.id,
      partnerName: partner.name,
      region: partner.region,
      bigRegion: partner.bigRegion,
      status: 读取对象文本(item, "status") || "active",
    },
    当前用户,
  );
  return existing ? "updated" : "created";
}

async function 写入导入报备(pool: Pool, item: 字典): Promise<"created" | "updated"> {
  const partner = await 查询渠道商按名称(pool, 读取对象文本(item, "partnerName"), {
    仅生效: true,
  });
  if (!partner) throw new Error("渠道商不存在。");
  const staff = await 查询员工按姓名和渠道(
    pool,
    读取对象文本(item, "assignedStaffName"),
    partner.uuid,
  );
  if (!staff) throw new Error("负责员工不存在。");
  const customerId = await 确保客户(pool, item, partner, staff);
  const regionId = await 确保区域(pool, partner.region || 读取对象文本(item, "region"));
  const existing = await 查询报备按客户(
    pool,
    读取对象文本(item, "customer"),
    读取对象文本(item, "creditCode"),
  );
  const code = existing?.id || 生成导入编号("REG");
  const 报备业务编号 = existing ? "" : await 生成导入业务编号(pool, "registration", staff.username);
  const now = new Date().toISOString();
  const extra = {
    ...item,
    id: 报备业务编号 || code,
    registrationNo: 报备业务编号 || code,
    legacyBusinessNumber: existing ? undefined : code,
    customer: 读取对象文本(item, "customer"),
    customerName: 读取对象文本(item, "customer"),
    partnerId: partner.id,
    partnerName: partner.name,
    assignedPartnerId: partner.id,
    assignedPartnerName: partner.name,
    assignedStaffId: staff.id,
    assignedStaffName: staff.name,
    region: partner.region,
    status: "approved",
    approvedAt: now,
    approvedBy: "import",
    createdBy: staff.id,
    createdByName: staff.name,
    expireAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
  };
  if (existing) {
    await pool.query(
      `
      UPDATE crm.registrations
      SET customer_id = $2::uuid,
          partner_id = $3::uuid,
          owner_user_id = $4::uuid,
          region_id = $5::uuid,
          status_code = 'approved',
          approved_at = COALESCE(approved_at, now()),
          updated_at = now(),
          extra_json = extra_json || $6::jsonb
      WHERE id = $1::uuid
      `,
      [existing.uuid, customerId, partner.uuid, staff.uuid, regionId, JSON.stringify(extra)],
    );
    return "updated";
  }
  await pool.query(
    `
    INSERT INTO crm.registrations (
      v2_source_id, registration_no, customer_id, partner_id, owner_user_id, region_id,
      status_code, submitted_at, approved_at, created_at, updated_at, extra_json
    )
    VALUES ($1, $2, $3::uuid, $4::uuid, $5::uuid, $6::uuid, 'approved', now(), now(), now(), now(), $7::jsonb)
    `,
    [code, 报备业务编号, customerId, partner.uuid, staff.uuid, regionId, JSON.stringify(extra)],
  );
  return "created";
}

async function 写入导入商机(pool: Pool, item: 字典): Promise<"created" | "updated"> {
  const partner = await 查询渠道商按名称(pool, 读取对象文本(item, "partnerName"), {
    仅生效: true,
  });
  if (!partner) throw new Error("渠道商不存在。");
  const staff = await 查询员工按姓名和渠道(
    pool,
    读取对象文本(item, "assignedStaffName"),
    partner.uuid,
  );
  if (!staff) throw new Error("负责员工不存在。");
  const registration = await 查询已通过报备(pool, 读取对象文本(item, "customer"));
  if (!registration) throw new Error("客户尚未报备或报备未通过审批。");
  const customerId = await 确保客户(pool, item, partner, staff);
  const regionId = await 确保区域(pool, partner.region || 读取对象文本(item, "region"));
  const existing = await 查询商机按名称客户(
    pool,
    读取对象文本(item, "name"),
    读取对象文本(item, "customer"),
  );
  const code = existing?.id || 生成导入编号("OPP");
  const 商机业务编号 = existing ? "" : await 生成导入业务编号(pool, "opportunity");
  const stage = 读取对象文本(item, "stage") || "contacted";
  const extra = {
    ...item,
    id: code,
    name: 读取对象文本(item, "name"),
    customer: 读取对象文本(item, "customer"),
    customerName: 读取对象文本(item, "customer"),
    regId: registration.id,
    registrationId: registration.id,
    partnerId: partner.id,
    partnerName: partner.name,
    assignedPartnerId: partner.id,
    assignedPartnerName: partner.name,
    assignedStaffId: staff.id,
    assignedStaffName: staff.name,
    owner: staff.name,
    region: partner.region,
    amount: 读取对象数字(item, "amount", 0),
    stage,
    tags: [],
    source: "导入",
    legacyBusinessNumber: code,
  };
  if (existing) {
    await pool.query(
      `
      UPDATE crm.opportunities
      SET customer_id = $2::uuid,
          registration_id = $3::uuid,
          partner_id = $4::uuid,
          owner_user_id = $5::uuid,
          region_id = $6::uuid,
          stage_code = $7,
          raw_stage_name = $7,
          status_code = $8,
          expected_amount = $9,
          updated_at = now(),
          extra_json = extra_json || $10::jsonb
      WHERE id = $1::uuid
      `,
      [
        existing.uuid,
        customerId,
        registration.uuid,
        partner.uuid,
        staff.uuid,
        regionId,
        stage,
        规范商机状态码(stage),
        读取对象数字(item, "amount", 0),
        JSON.stringify(extra),
      ],
    );
    return "updated";
  }
  await pool.query(
    `
    INSERT INTO crm.opportunities (
      v2_source_id, opportunity_no, customer_id, registration_id, partner_id, owner_user_id,
      region_id, stage_code, raw_stage_name, status_code, expected_amount, created_at, updated_at, extra_json
    )
    VALUES ($1, $2, $3::uuid, $4::uuid, $5::uuid, $6::uuid, $7::uuid, $8, $8, $9, $10, now(), now(), $11::jsonb)
    `,
    [
      code,
      商机业务编号,
      customerId,
      registration.uuid,
      partner.uuid,
      staff.uuid,
      regionId,
      stage,
      规范商机状态码(stage),
      读取对象数字(item, "amount", 0),
      JSON.stringify(extra),
    ],
  );
  return "created";
}

function 构建导入渠道简介(item: 字典): 字典 {
  const profile: 字典 = {};
  for (const column of V2渠道简介列) {
    const value = item[column.key];
    if (value === undefined || value === null || value === "") continue;
    if (
      [
        "customerIndustries",
        "agencyBrands",
        "authorizedProducts",
        "qualifications",
        "typicalCustomers",
        "serviceAreas",
      ].includes(column.key)
    ) {
      profile[column.key] = 拆分导入列表(value);
    } else {
      profile[column.key] = value;
    }
  }
  return profile;
}

async function 查询渠道商按名称(
  pool: Pool,
  name: string,
  选项: { 仅生效?: boolean } = {},
): Promise<V2渠道商引用 | null> {
  if (!name) return null;
  const result = await pool.query<V2渠道商引用>(
    `
    SELECT
      p.id::text AS uuid,
      COALESCE(p.v2_source_id, p.partner_code, p.id::text) AS id,
      p.partner_name AS name,
      COALESCE(r.region_name, p.extra_json->>'region', '') AS region,
      COALESCE(p.city_name, p.extra_json->>'city', '') AS city,
      COALESCE(big.region_name, p.extra_json->>'bigRegion', '') AS "bigRegion",
      p.status_code AS "statusCode"
    FROM channel.partners p
    LEFT JOIN org.regions r ON r.id = p.region_id
    LEFT JOIN org.regions big ON big.id = r.parent_region_id
    WHERE p.status_code <> 'archived'
      AND (NOT $3::boolean OR p.status_code = 'active')
      AND (p.normalized_name = $1 OR p.partner_name = $2 OR p.extra_json->>'name' = $2)
    ORDER BY p.updated_at DESC
    LIMIT 1
    `,
    [migrationNormalizedName(name), name, Boolean(选项.仅生效)],
  );
  return result.rows[0] || null;
}

async function 查询员工按姓名和渠道(
  pool: Pool,
  name: string,
  partnerUuid: string,
): Promise<V2用户引用 | null> {
  if (!name || !partnerUuid) return null;
  const result = await pool.query<V2用户引用>(
    `
    SELECT
      u.id::text AS uuid,
      COALESCE(u.v2_source_id, u.extra_json->>'id', u.id::text) AS id,
      u.username::text AS username,
      COALESCE(u.display_name, u.extra_json->>'name', u.username::text) AS name,
      COALESCE(p.v2_source_id, p.partner_code, p.id::text) AS "partnerId",
      p.partner_name AS "partnerName",
      COALESCE(r.region_name, u.extra_json->>'region', p.extra_json->>'region', '') AS region,
      COALESCE(big.region_name, u.extra_json->>'bigRegion', p.extra_json->>'bigRegion', '') AS "bigRegion"
    FROM iam.users u
    JOIN channel.partner_members pm ON pm.user_id = u.id AND pm.status_code = 'active' AND pm.archived_at IS NULL
    JOIN channel.partners p ON p.id = pm.partner_id
    LEFT JOIN org.regions r ON r.id = COALESCE(u.region_id, p.region_id)
    LEFT JOIN org.regions big ON big.id = r.parent_region_id
    WHERE p.id = $2::uuid
      AND u.status_code = 'active'
      AND (
        u.display_name = $1
        OR u.extra_json->>'name' = $1
        OR u.username::text = $1
      )
    LIMIT 1
    `,
    [name, partnerUuid],
  );
  return result.rows[0] || null;
}

async function 查询已通过报备(pool: Pool, customerName: string): Promise<V2报备引用 | null> {
  if (!customerName) return null;
  const result = await pool.query<V2报备引用>(
    `
    SELECT
      r.id::text AS uuid,
      COALESCE(r.registration_no, r.v2_source_id, r.id::text) AS id,
      c.customer_name AS "customerName"
    FROM crm.registrations r
    JOIN crm.customers c ON c.id = r.customer_id
    WHERE c.normalized_name = $1
      AND r.status_code IN ('approved', 'converted')
    ORDER BY r.updated_at DESC
    LIMIT 1
    `,
    [migrationNormalizedName(customerName)],
  );
  return result.rows[0] || null;
}

async function 查询报备按客户(
  pool: Pool,
  customerName: string,
  creditCode: string,
): Promise<V2报备引用 | null> {
  const result = await pool.query<V2报备引用>(
    `
    SELECT
      r.id::text AS uuid,
      COALESCE(r.registration_no, r.v2_source_id, r.id::text) AS id,
      c.customer_name AS "customerName"
    FROM crm.registrations r
    JOIN crm.customers c ON c.id = r.customer_id
    WHERE c.normalized_name = $1
      AND ($2 = '' OR c.credit_code = $2 OR c.credit_code IS NULL)
    ORDER BY r.updated_at DESC
    LIMIT 1
    `,
    [migrationNormalizedName(customerName), creditCode],
  );
  return result.rows[0] || null;
}

async function 查询商机按名称客户(
  pool: Pool,
  name: string,
  customerName: string,
): Promise<V2报备引用 | null> {
  const result = await pool.query<V2报备引用>(
    `
    SELECT
      o.id::text AS uuid,
      COALESCE(o.v2_source_id, o.opportunity_no, o.id::text) AS id,
      c.customer_name AS "customerName"
    FROM crm.opportunities o
    JOIN crm.customers c ON c.id = o.customer_id
    WHERE COALESCE(o.extra_json->>'name', o.opportunity_no, '') = $1
      AND c.normalized_name = $2
    ORDER BY o.updated_at DESC
    LIMIT 1
    `,
    [name, migrationNormalizedName(customerName)],
  );
  return result.rows[0] || null;
}

async function 确保客户(
  pool: Pool,
  item: 字典,
  partner: V2渠道商引用,
  staff: V2用户引用,
): Promise<string> {
  const name = 读取对象文本(item, "customer");
  const normalized = migrationNormalizedName(name);
  const creditCode = 读取对象文本(item, "creditCode");
  const existing = await pool.query<{ id: string }>(
    `
    SELECT id::text AS id
    FROM crm.customers
    WHERE normalized_name = $1 AND status_code <> 'merged'
    LIMIT 1
    `,
    [normalized],
  );
  const extra = {
    ...item,
    customer: name,
    customerName: name,
    partnerId: partner.id,
    partnerName: partner.name,
    assignedStaffId: staff.id,
    assignedStaffName: staff.name,
    region: partner.region,
  };
  if (existing.rows[0]?.id) {
    await pool.query(
      `
      UPDATE crm.customers
      SET customer_name = $2,
          credit_code = COALESCE(NULLIF($3, ''), credit_code),
          owner_user_id = $4::uuid,
          owner_partner_id = $5::uuid,
          updated_at = now(),
          extra_json = extra_json || $6::jsonb
      WHERE id = $1::uuid
      `,
      [existing.rows[0].id, name, creditCode, staff.uuid, partner.uuid, JSON.stringify(extra)],
    );
    return existing.rows[0].id;
  }
  const inserted = await pool.query<{ id: string }>(
    `
    INSERT INTO crm.customers (
      customer_name, normalized_name, credit_code, owner_user_id, owner_partner_id, status_code, extra_json
    )
    VALUES ($1, $2, NULLIF($3, ''), $4::uuid, $5::uuid, 'active', $6::jsonb)
    RETURNING id::text AS id
    `,
    [name, normalized, creditCode, staff.uuid, partner.uuid, JSON.stringify(extra)],
  );
  return inserted.rows[0]?.id || "";
}

async function 确保区域(pool: Pool, regionName: string): Promise<string | null> {
  if (!regionName) return null;
  const code = "IMP-REG-" + crypto.createHash("sha1").update(regionName).digest("hex").slice(0, 12);
  try {
    const result = await pool.query<{ id: string }>(
      `
      INSERT INTO org.regions (region_code, region_name, region_level, status_code)
      VALUES ($1, $2, 'region', 'active')
      ON CONFLICT (region_code) DO UPDATE
      SET region_name = EXCLUDED.region_name,
          status_code = EXCLUDED.status_code
      RETURNING id::text AS id
      `,
      [code, regionName],
    );
    return result.rows[0]?.id || null;
  } catch (错误) {
    // 同名活跃区域已存在但编号不同（历史数据或人工维护）：直接复用，避免导入整行失败。
    if ((错误 as { code?: string }).code !== "23505") throw 错误;
    const 已有 = await pool.query<{ id: string }>(
      `
      SELECT id::text AS id
      FROM org.regions
      WHERE region_name = $1 AND status_code = 'active' AND region_level = 'region'
      LIMIT 1
      `,
      [regionName],
    );
    return 已有.rows[0]?.id || null;
  }
}

function 标准化导入表头(value: unknown): string {
  return String(value ?? "").trim();
}

function 标准化导入单元格(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return String(value ?? "").trim();
}

function 导入字段名称(key: string): string {
  for (const template of Object.values(V2导入模板)) {
    const index = template.keys.indexOf(key);
    if (index >= 0) return template.headers[index]?.replace(/\*$/, "") || key;
  }
  const map: Record<string, string> = {
    name: "名称",
    contact: "联系人",
    phone: "联系电话",
    email: "邮箱",
    creditCode: "统一社会信用代码",
    address: "客户地址",
    notes: "备注",
    region: "所在区域",
    city: "所在城市",
    username: "登录账号",
    partnerName: "所属渠道商名称",
    password: "密码",
    customer: "客户名称",
    assignedStaffName: "负责员工姓名",
  };
  return map[key] || key;
}

function 规范导入合作级别(level: string): string {
  const value = level.trim().toLowerCase();
  const map: Record<string, string> = {
    lep: "lep",
    diamond: "diamond",
    钻石: "diamond",
    gold: "gold",
    金牌: "gold",
    silver: "silver",
    银牌: "silver",
    bronze: "bronze",
    铜牌: "bronze",
    industry: "industry",
    行业总代: "industry",
  };
  return map[value] || "";
}

function 规范导入技术服务类型(type: string): string {
  const value = type.trim().toLowerCase();
  const map: Record<string, string> = {
    developing: "developing",
    full: "full",
    提名技术服务商: "developing",
    发展中技术服务商: "developing",
    签约技术服务商: "full",
    正式技术服务商: "full",
  };
  return map[value] || "none";
}

function 规范导入员工状态(status: string): string {
  if (["停用", "禁用", "disabled", "inactive"].includes(status.trim().toLowerCase()))
    return "disabled";
  return "active";
}

function 规范导入开票能力(value: string): string {
  const text = value.replace(/\s+/g, "");
  const map: Record<string, string> = {
    可开增值税专用发票: "可开增值税专用发票",
    增值税专用发票: "可开增值税专用发票",
    专票: "可开增值税专用发票",
    可开专票: "可开增值税专用发票",
    可开增值税普通发票: "可开增值税普通发票",
    增值税普通发票: "可开增值税普通发票",
    普票: "可开增值税普通发票",
    可开普票: "可开增值税普通发票",
    专票和普票均可: "专票和普票均可",
    专普票均可: "专票和普票均可",
    均可: "专票和普票均可",
    暂不支持开票: "暂不支持开票",
    不支持开票: "暂不支持开票",
    待确认: "待确认",
  };
  return map[text] || "";
}

function 规范导入布尔(value: string): boolean | null {
  const text = value.trim().toLowerCase();
  if (["是", "已核验", "已验证", "true", "1", "yes", "y"].includes(text)) return true;
  if (["否", "未核验", "未验证", "false", "0", "no", "n"].includes(text)) return false;
  return null;
}

function 规范导入商机阶段(stage: string): string {
  const text = stage.trim();
  const map: Record<string, string> = {
    "1% 已联系上客户": "contacted",
    已联系上客户: "contacted",
    "10% 商机明确并报备": "registered",
    商机明确并报备: "registered",
    "20% 正式报价": "quoted",
    正式报价: "quoted",
    "30% 明确预算": "budget",
    明确预算: "budget",
    "40% 技术交流/方案设计": "design",
    "技术交流/方案设计": "design",
    "50% 产品测试": "testing",
    产品测试: "testing",
    "70% 招投标/商务谈判": "negotiation",
    "招投标/商务谈判": "negotiation",
    "100% 赢单": "won",
    赢单: "won",
    项目取消: "cancelled",
    输单: "lost",
  };
  return map[text] || text || "contacted";
}

function 规范商机状态码(stage: string): string {
  if (stage === "won") return "won";
  if (stage === "lost") return "lost";
  if (stage === "cancelled") return "cancelled";
  return "active";
}

function 生成导入编号(prefix: string): string {
  return `${prefix}-IMP-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

async function 生成导入业务编号(
  pool: Pool,
  类型: "registration" | "opportunity",
  提报账号 = "",
): Promise<string> {
  const result = await pool.query<{ 编号: string }>(
    'SELECT crm.next_business_number($1, $2) AS "编号"',
    [类型, 提报账号],
  );
  const 编号 = result.rows[0]?.编号;
  if (!编号) throw new Error("导入业务编号生成失败。");
  return 编号;
}

function 拆分导入列表(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value ?? "")
    .split(/[、,，;；\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function 导出简介字段(item: 字典, key: string): string {
  const value = item[key];
  if (Array.isArray(value)) return value.map((part) => String(part)).join("、");
  if (typeof value === "boolean") return value ? "是" : "否";
  return 读取对象文本(item, key);
}

function 导出合作级别标签(level: string): string {
  const map: Record<string, string> = {
    lep: "LEP",
    diamond: "钻石",
    gold: "金牌",
    silver: "银牌",
    bronze: "铜牌",
    industry: "行业总代",
  };
  return map[level] || level || "";
}

function 导出渠道层级标签(level: string): string {
  const map: Record<string, string> = {
    primary: "一级渠道商",
    secondary: "二级渠道商",
    none: "无层级",
  };
  return map[level] || level || "";
}

function 导出状态标签(status: string): string {
  const map: Record<string, string> = {
    active: "正常",
    inactive: "停用",
    disabled: "停用",
    pending: "待审批",
    reviewing: "审核中",
    approved: "已通过",
    converted: "已转商机",
    expired: "已过期",
    rejected: "已拒绝",
    cancelled: "已取消",
  };
  return map[status] || status || "";
}

function 导出技术服务类型标签(type: string): string {
  const map: Record<string, string> = {
    none: "",
    developing: "提名技术服务商",
    full: "签约技术服务商",
  };
  return map[type] || type || "";
}

function 导出商机阶段标签(stage: string): string {
  const map: Record<string, string> = {
    contacted: "1% 已联系上客户",
    registered: "10% 商机明确并报备",
    quoted: "20% 正式报价",
    budget: "30% 明确预算",
    design: "40% 技术交流/方案设计",
    testing: "50% 产品测试",
    negotiation: "70% 招投标/商务谈判",
    won: "100% 赢单",
    cancelled: "项目取消",
    lost: "输单",
  };
  return map[stage] || stage || "";
}

function 构建开放接口文档清单(baseUrl: string) {
  return [
    {
      id: "openapi-guide",
      title: "OpenAPI对接说明",
      fileName: "联软CRM-OpenAPI对接说明.md",
      downloadUrl: `${baseUrl}/open-api/docs/openapi-guide/download`,
    },
    {
      id: "openapi-contract",
      title: "OpenAPI资源清单",
      fileName: "联软CRM-OpenAPI资源清单.md",
      downloadUrl: `${baseUrl}/open-api/docs/openapi-contract/download`,
    },
  ];
}

function 发送开放接口文档(res: Response, id: string, baseUrl: string) {
  const title = id === "openapi-contract" ? "OpenAPI资源清单" : "OpenAPI对接说明";
  const body = [
    `# ${title}`,
    "",
    "本接口由 V3 PostgreSQL 正式业务表提供，兼容 V2 管理后台 OpenAPI 页面。",
    "",
    `接口基准地址：${baseUrl}/open/v1`,
    "",
    "可用资源包括 users、partners、registrations、opportunities、quotes、orders、products、product-tree、workload-mappings 等。",
    "",
  ].join("\n");
  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename*=UTF-8''${encodeURIComponent(title + ".md")}`,
  );
  res.send(body);
}

function migrationNormalizedName(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "");
}

function 转V3角色(role: string): string {
  if (role === "superadmin") return "superadmin";
  if (role === "admin" || role === "region_manager") return "region_manager";
  if (role === "partner_admin") return "partner_admin";
  return "staff";
}

function 转V3角色名称(role: string): string {
  const 映射: Record<string, string> = {
    superadmin: "超级管理员",
    region_manager: "区域管理员",
    partner_admin: "渠道管理员",
    staff: "销售代表",
  };
  return 映射[role] || "销售代表";
}

function 转V3账号状态(status: string): string {
  if (["disabled", "inactive", "rejected", "archived", "cancelled", "pending"].includes(status))
    return "disabled";
  if (status === "locked") return "locked";
  return "active";
}

function 转V3伙伴状态(status: string): string {
  if (status === "archived") return "archived";
  if (["pending", "rejected", "disabled", "cancelled"].includes(status)) {
    return status === "cancelled" ? "disabled" : status;
  }
  return "active";
}

function 读取正文(req: Request): 字典 {
  return req.body && typeof req.body === "object" && !Array.isArray(req.body)
    ? (req.body as 字典)
    : {};
}

function 读取路由参数(req: Request, key: string): string {
  const value = req.params[key];
  return typeof value === "string" ? value : "";
}

function 读取查询文本(req: Request, key: string): string {
  const value = req.query[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function 读取正整数(req: Request, key: string, fallback: number): number {
  const parsed = Number(req.query[key]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function 读取正文文本(来源: unknown, keys: string[], fallback: string): string {
  if (!来源 || typeof 来源 !== "object" || Array.isArray(来源)) return fallback;
  const record = 来源 as 字典;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return fallback;
}

function 读取正文数字(来源: 字典, keys: string[], fallback: number): number {
  for (const key of keys) {
    const value = 来源[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value)))
      return Number(value);
  }
  return fallback;
}

function 读取正文布尔(来源: unknown, key: string, fallback: boolean): boolean {
  if (!来源 || typeof 来源 !== "object" || Array.isArray(来源)) return fallback;
  const value = (来源 as 字典)[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true";
  return fallback;
}

function 读取对象文本(来源: 字典, key: string): string {
  const value = 来源[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function 读取对象数字(来源: 字典, key: string, fallback: number): number {
  const value = 来源[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value)))
    return Number(value);
  return fallback;
}

function 读取对象可空数字(来源: 字典, key: string): number | null {
  const value = 来源[key];
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function 读取对象布尔(来源: 字典, key: string, fallback: boolean): boolean {
  const value = 来源[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true";
  return fallback;
}

function 读取对象数组(来源: 字典, key: string): unknown[] {
  const value = 来源[key];
  return Array.isArray(value) ? value : [];
}

function 读取对象字典(来源: 字典, key: string): 字典 | null {
  const value = 来源[key];
  return value && typeof value === "object" && !Array.isArray(value) ? (value as 字典) : null;
}

function 读取对象字符串数组(来源: 字典, key: string): string[] {
  const value = 来源[key];
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  if (typeof value === "string" && value.trim())
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  return [];
}

function 读取接口基准地址(req: Request): string {
  const proto =
    typeof req.headers["x-forwarded-proto"] === "string"
      ? req.headers["x-forwarded-proto"]
      : req.protocol;
  const host =
    typeof req.headers["x-forwarded-host"] === "string"
      ? req.headers["x-forwarded-host"]
      : req.headers.host;
  return `${proto}://${host || "localhost"}/api/v2`;
}
