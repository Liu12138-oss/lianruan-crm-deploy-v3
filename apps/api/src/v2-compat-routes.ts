import crypto from "node:crypto";

import type { 构建信息 } from "@lianruan/shared";
import type { Request, Response, Router } from "express";
import { Router as createRouter } from "express";
import multer from "multer";
import { Pool, type PoolClient } from "pg";
import * as XLSX from "xlsx";

import { 创建密码散列, 校验密码, 读取请求会话用户名 } from "./auth-routes.js";
import {
  创建业务数据服务,
  type 当前业务用户,
  type 阶段9模块,
  type 阶段9记录,
} from "./business-store.js";
import { 计算IPG参考价 } from "./ipg-pricing.js";

interface V2兼容路由参数 {
  build: 构建信息;
  databaseUrl?: string;
  sessionSecret?: string;
  env?: NodeJS.ProcessEnv;
}

type 字典 = Record<string, unknown>;

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
}

interface V2渠道商引用 {
  uuid: string;
  id: string;
  name: string;
  region: string;
  city: string;
  bigRegion: string;
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

const V2导出配置: Record<V2导入类型, { fileName: string; sheetName: string; headers: string[] }> = {
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
};

export function 创建V2兼容路由(参数: V2兼容路由参数): Router {
  const router = createRouter();
  const pool = 参数.databaseUrl ? new Pool({ connectionString: 参数.databaseUrl, max: 10 }) : null;
  const service = 参数.databaseUrl ? 创建业务数据服务({ databaseUrl: 参数.databaseUrl }) : null;

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

      const token = 签发V2令牌(用户.username);
      res.json({ success: true, user: 用户, token, notifications: [], build: 参数.build });
    }),
  );

  router.get(
    "/auth/me",
    捕获(async (req, res) => {
      const db = 需要数据库(pool);
      const username = 读取Bearer用户名(req) || 读取查询文本(req, "username");
      const 用户 = username ? await 查询V2用户(db, username) : await 查询首个管理员(db);
      if (!用户) {
        res.status(401).json(失败("请先登录。"));
        return;
      }
      const { passwordHash: _passwordHash, ...安全用户 } = 用户;
      res.json({ success: true, user: 安全用户, token: 签发V2令牌(安全用户.username) });
    }),
  );

  router.put(
    "/auth/password",
    捕获(async (req, res) => {
      const db = 需要数据库(pool);
      const body = 读取正文(req);
      const username = 读取Bearer用户名(req);
      const userId = 读取正文文本(body, ["userId", "id"], "");
      const oldPassword = 读取正文文本(body, ["oldPassword"], "");
      const newPassword = 读取正文文本(body, ["newPassword", "password"], "");
      if (!newPassword || newPassword.length < 6) {
        res.status(400).json(失败("新密码长度不能少于6位。"));
        return;
      }

      const 用户 = username ? await 查询V2用户(db, username) : await 查询V2用户按标识(db, userId);
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
      const username = 读取Bearer用户名(req) || 读取查询文本(req, "username");
      const 用户 = username ? await 查询V2用户(db, username) : null;
      if (!用户) {
        res.status(401).json(失败("请先登录。"));
        return;
      }
      const { passwordHash: _passwordHash, ...安全用户 } = 用户;
      res.json(成功(安全用户));
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
    捕获(async (_req, res) => {
      const db = 需要数据库(pool);
      const counts = await 查询V2数量(db);
      res.json(
        成功({
          registrations: counts.registrations,
          opportunities: counts.opportunities,
          quotes: counts.quotes,
          orders: counts.orders,
          partners: counts.partners,
          users: counts.users,
          pendingApprovals: counts.pendingApprovals,
        }),
      );
    }),
  );

  注册审计日志路由(router, pool);

  for (const [路径, 模块] of Object.entries(业务模块映射)) {
    router.get(
      `/${路径}`,
      捕获(async (req, res) => {
        const 结果 = await 需要服务(service).查询列表(
          模块,
          读取阶段9查询(req),
          读取当前V2业务用户(req, 参数),
        );
        res.json(成功(结果.数据.map((记录) => 转V2业务记录(模块, 记录))));
      }),
    );

    router.get(
      `/${路径}/:id`,
      捕获(async (req, res) => {
        const 记录 = await 需要服务(service).查询详情(
          模块,
          读取路由参数(req, "id"),
          读取当前V2业务用户(req, 参数),
        );
        res.json(成功(转V2业务记录(模块, 记录)));
      }),
    );
  }

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
      const 试算 = await 需要服务(service).试算报价(读取正文(req));
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
      const features = await 查询IPG功能列表(需要数据库(pool), 输入);
      const preview = 计算IPG参考价({
        ...输入,
        features,
        featureIds: 读取IPG功能编号(输入),
        hardwareIds: 读取对象字符串数组(输入, "hardwareIds"),
      });
      res.json(成功(preview));
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
      const 记录 = await 调整订单价格(
        需要数据库(pool),
        读取路由参数(req, "id"),
        读取正文(req),
        读取当前V2业务用户(req, 参数),
      );
      res.json(成功(记录));
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
        { ...读取正文(req), status: "rejected" },
        读取当前V2业务用户(req, 参数),
      );
      res.json(成功(转V2业务记录("orders", 记录)));
    }),
  );

  注册产品路由(router, pool);
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

function 注册产品路由(router: Router, pool: Pool | null) {
  router.get(
    "/product-tree",
    捕获(async (_req, res) => {
      res.json(成功(await 查询V2产品树(需要数据库(pool))));
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
    捕获(async (_req, res) => {
      res.json(成功(await 查询V2功能产品(需要数据库(pool))));
    }),
  );
  router.get(
    "/features/:id",
    捕获(async (req, res) => {
      const item = (await 查询V2功能产品(需要数据库(pool))).find(
        (row) => row.id === 读取路由参数(req, "id") || row.productCode === 读取路由参数(req, "id"),
      );
      if (!item) {
        res.status(404).json(失败("功能产品不存在。"));
        return;
      }
      res.json(成功(item));
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
    捕获(async (_req, res) => {
      res.json(成功(await 查询V2硬件产品(需要数据库(pool))));
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
      res.json(成功(item));
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
    捕获(async (_req, res) => {
      res.json(成功(await 查询V2产品套餐(需要数据库(pool))));
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
      res.json(成功(item));
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
      res.json(成功(await 保存V2渠道商(需要数据库(pool), "", 读取正文(req))));
    }),
  );
  router.put(
    "/partners/:id",
    捕获(async (req, res) => {
      res.json(成功(await 保存V2渠道商(需要数据库(pool), 读取路由参数(req, "id"), 读取正文(req))));
    }),
  );
  router.delete(
    "/partners/:id",
    捕获(async (req, res) => {
      await 更新渠道商状态(需要数据库(pool), 读取路由参数(req, "id"), "archived", 读取正文(req));
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
      const data = await 保存渠道商分销层级(
        需要数据库(pool),
        读取路由参数(req, "id"),
        读取正文(req),
      );
      res.json(成功(data));
    }),
  );
  router.get(
    "/partners/:id/profile",
    捕获(async (req, res) => {
      res.json(成功(await 查询渠道商简介(需要数据库(pool), 读取路由参数(req, "id"))));
    }),
  );
  router.put(
    "/partners/:id/profile",
    捕获(async (req, res) => {
      res.json(
        成功(await 保存渠道商简介(需要数据库(pool), 读取路由参数(req, "id"), 读取正文(req))),
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
      );
      res.json(成功(data));
    }),
  );

  router.post(
    "/users",
    捕获(async (req, res) => {
      res.json(成功(await 保存V2用户(需要数据库(pool), "", 读取正文(req))));
    }),
  );
  router.post(
    "/admin/accounts",
    捕获(async (req, res) => {
      res.json(成功(await 保存V2用户(需要数据库(pool), "", 读取正文(req))));
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
      const status = action === "reject" ? "rejected" : "approved";
      const data = await 更新待审批状态(
        需要数据库(pool),
        读取路由参数(req, "id"),
        status,
        读取正文(req),
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
}

function 注册导入导出路由(
  router: Router,
  pool: Pool | null,
  service: ReturnType<typeof 创建业务数据服务> | null,
  参数: V2兼容路由参数,
) {
  router.get(
    "/export/:type",
    捕获(async (req, res) => {
      const type = 读取导入类型(读取路由参数(req, "type"));
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
        preview: 结果.rows.slice(0, 50),
        totalCount: 结果.totalCount,
        previewCount: Math.min(结果.rows.length, 50),
        errorCount: 结果.errorCount,
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
      const 结果 = await 执行导入Excel(需要数据库(pool), type, file);
      res.json({
        success: true,
        message: `导入完成：新增 ${结果.success} 条，更新 ${结果.updated} 条，失败 ${结果.failed} 条`,
        results: 结果,
      });
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
    捕获(async (_req, res) => {
      res.json(成功(await 需要服务(service).读取概览()));
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
      res.json(成功({ features, hardware, packages, productTree }));
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
      `/mobile/${module}/:id`,
      捕获(async (req, res) => {
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

function 捕获(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    handler(req, res).catch((error: unknown) => {
      const record = error as { message?: string; statusCode?: number };
      res
        .status(record.statusCode || 500)
        .json(失败(record.message || "系统处理失败，请联系管理员。"));
    });
  };
}

function 成功<T>(data: T) {
  return { success: true, data };
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

async function 查询V2用户(pool: Pool, username: string) {
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
  }>(
    `
    SELECT
      u.id::text AS id,
      u.v2_source_id,
      u.username::text AS username,
      u.display_name,
      pc.password_hash,
      u.status_code,
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
    LEFT JOIN channel.partner_members pm ON pm.user_id = u.id
    LEFT JOIN channel.partners p ON p.id = pm.partner_id
    WHERE lower(u.username::text) = lower($1)
      AND u.status_code = 'active'
    GROUP BY u.id, u.v2_source_id, u.username, u.display_name, pc.password_hash, u.status_code,
      reg.region_name, u.extra_json, p.v2_source_id, p.partner_code, p.id, p.partner_name
    LIMIT 1
    `,
    [username],
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
    status: row.status_code,
    region: 读取对象文本(extra, "region") || row.region_name || "",
    bigRegion: 读取对象文本(extra, "bigRegion"),
    partnerId: 读取对象文本(extra, "partnerId") || row.partner_id || "",
    partnerName: 读取对象文本(extra, "partnerName") || row.partner_name || "",
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

function 签发V2令牌(username: string): string {
  return [
    "v2",
    Buffer.from(username, "utf8").toString("base64url"),
    crypto.randomBytes(24).toString("base64url"),
  ].join(".");
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
  const 会话用户名 = 读取请求会话用户名(req, {
    sessionSecret: 参数.sessionSecret || "",
    ...(参数.env ? { env: 参数.env } : {}),
  });
  if (会话用户名) {
    return { username: 会话用户名, displayName: 会话用户名, roleName: "V3登录用户" };
  }
  const bearer用户名 = 读取Bearer用户名(req);
  if (bearer用户名) {
    return { username: bearer用户名, displayName: bearer用户名, roleName: "V2页面用户" };
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

function 读取阶段9查询(req: Request) {
  return {
    keyword: 读取查询文本(req, "keyword") || 读取查询文本(req, "q"),
    status: 读取查询文本(req, "status"),
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
  const id = 读取对象文本(原始, "id") || 记录.编号 || 记录.id;
  const common = {
    ...原始,
    id,
    uuid: 记录.id,
    code: 记录.编号,
    customer: 读取对象文本(原始, "customer") || 读取对象文本(原始, "customerName") || 记录.客户名称,
    customerName:
      读取对象文本(原始, "customerName") || 读取对象文本(原始, "customer") || 记录.客户名称,
    partnerName: 读取对象文本(原始, "partnerName") || 记录.渠道名称,
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

async function 查询V2数量(pool: Pool) {
  const result = await pool.query<{ key: string; count: string }>(
    `
    SELECT 'users' AS key, COUNT(*)::text AS count FROM iam.users WHERE v2_source_id IS NOT NULL
    UNION ALL SELECT 'partners', COUNT(*)::text FROM channel.partners WHERE v2_source_id IS NOT NULL
    UNION ALL SELECT 'registrations', COUNT(*)::text FROM crm.registrations WHERE v2_source_id IS NOT NULL
    UNION ALL SELECT 'opportunities', COUNT(*)::text FROM crm.opportunities WHERE v2_source_id IS NOT NULL
    UNION ALL SELECT 'quotes', COUNT(*)::text FROM crm.quotes WHERE v2_source_id IS NOT NULL
    UNION ALL SELECT 'orders', COUNT(*)::text FROM crm.orders WHERE v2_source_id IS NOT NULL
    UNION ALL SELECT 'pendingApprovals', COUNT(*)::text FROM ops.approvals WHERE status_code IN ('active','pending')
    `,
  );
  return result.rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.key] = Number(row.count) || 0;
    return acc;
  }, {});
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
    dateFrom: 读取查询文本(req, "dateFrom"),
    dateTo: 读取查询文本(req, "dateTo"),
  };
}

async function 查询V2审计日志列表(pool: Pool, 查询: 审计查询参数) {
  const { where, params } = 构建审计条件(查询);
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
    ORDER BY a.created_at DESC
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

function 构建审计条件(查询: 审计查询参数): { where: string; params: unknown[] } {
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
    params.push(`%${查询.keyword}%`);
    条件.push(`(
      COALESCE(a.actor_username, '') ILIKE $${params.length}
      OR COALESCE(a.actor_name, '') ILIKE $${params.length}
      OR COALESCE(a.target_name, '') ILIKE $${params.length}
      OR COALESCE(a.message, '') ILIKE $${params.length}
    )`);
  }
  if (查询.dateFrom) {
    params.push(查询.dateFrom);
    条件.push(`a.created_at >= $${params.length}::timestamptz`);
  }
  if (查询.dateTo) {
    params.push(查询.dateTo);
    条件.push(`a.created_at <= $${params.length}::timestamptz`);
  }
  return { where: 条件.join(" AND "), params };
}

async function 查询V2用户按标识(pool: Pool, id: string) {
  if (!id) return null;
  const result = await pool.query<{ username: string }>(
    `
    SELECT username::text AS username
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
  const username = result.rows[0]?.username;
  return username ? 查询V2用户(pool, username) : null;
}

async function 单点登录降级响应(pool: Pool, req: Request) {
  const username = 读取正文文本(读取正文(req), ["username", "account", "operatorId"], "");
  const 用户 = username ? await 查询V2用户(pool, username) : await 查询首个管理员(pool);
  if (!用户) return 失败("当前未配置单点登录，请使用账号密码登录。");
  const { passwordHash: _passwordHash, ...安全用户 } = 用户;
  return { success: true, user: 安全用户, token: 签发V2令牌(安全用户.username), ssoFallback: true };
}

async function 保存用户密码(
  pool: Pool,
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
}

async function 调整订单价格(
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

async function 保存V2用户(pool: Pool, id: string, 输入: 字典) {
  const username = 读取正文文本(输入, ["username", "account", "loginName"], id || "");
  if (!username) throw Object.assign(new Error("请输入登录账号。"), { statusCode: 400 });
  const code = id || 读取正文文本(输入, ["id", "userId"], username);
  const name = 读取正文文本(输入, ["name", "displayName"], username);
  const role = 转V3角色(读取正文文本(输入, ["role"], "staff"));
  const status = 转V3账号状态(读取正文文本(输入, ["status"], "active"));
  const phone = 读取正文文本(输入, ["phone", "mobile"], "");
  const email = 读取正文文本(输入, ["email"], "");
  const extra = { ...输入, id: code, userId: code, username, name, role: 转V2角色(role) };

  await 校验账号联系电话唯一(pool, phone, { id: id || code, username });

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
            updated_at = now(),
            extra_json = extra_json || $7::jsonb
        WHERE id::text = $1 OR v2_source_id = $1 OR username::text = $1 OR extra_json->>'id' = $1
        RETURNING username::text AS username
        `,
        [id, username, name, status, phone, email, JSON.stringify(extra)],
      );
      if (!result.rows[0]) throw Object.assign(new Error("用户不存在。"), { statusCode: 404 });
    } else {
      await pool.query(
        `
        INSERT INTO iam.users (
          v2_source_id, username, display_name, status_code, phone, email, extra_json
        )
        VALUES ($1, $2::citext, $3, $4, NULLIF($5, ''), NULLIF($6, '')::citext, $7::jsonb)
        ON CONFLICT (username) DO UPDATE
        SET display_name = EXCLUDED.display_name,
            status_code = EXCLUDED.status_code,
            phone = EXCLUDED.phone,
            email = EXCLUDED.email,
            updated_at = now(),
            extra_json = iam.users.extra_json || EXCLUDED.extra_json
        `,
        [code, username, name, status, phone, email, JSON.stringify(extra)],
      );
    }
  } catch (error) {
    抛出账号联系电话冲突错误(error);
    throw error;
  }

  await 绑定用户角色(pool, username, role);
  await 同步用户渠道成员绑定(pool, username, role, 读取正文文本(输入, ["partnerId"], ""));
  const password = 读取正文文本(输入, ["password"], "");
  if (password) await 保存用户密码(pool, username, password, true);
  const 用户 = await 查询V2用户(pool, username);
  if (!用户) throw Object.assign(new Error("用户保存失败。"), { statusCode: 500 });
  return 用户;
}

async function 校验账号联系电话唯一(
  pool: Pool,
  phone: string,
  当前账号: { id: string; username: string },
) {
  const normalizedPhone = 规范化账号联系电话(phone);
  if (!normalizedPhone) return;
  const result = await pool.query<{ username: string; display_name: string }>(
    `
    SELECT username::text AS username, display_name
    FROM iam.users
    WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]+', '', 'g') = $1
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
  return phone.replace(/[^0-9]+/g, "");
}

async function 同步用户渠道成员绑定(
  pool: Pool,
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
        ended_at = NULL
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
        extra_json = extra_json || $3::jsonb
    WHERE id::text = $1 OR v2_source_id = $1 OR username::text = $1 OR extra_json->>'id' = $1
    RETURNING username::text AS username
    `,
    [id, 转V3账号状态(status), JSON.stringify({ status })],
  );
  const username = result.rows[0]?.username;
  if (!username) throw Object.assign(new Error("用户不存在。"), { statusCode: 404 });
  return 查询V2用户(pool, username);
}

async function 更新用户密码(pool: Pool, id: string, password: string) {
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
  const staffRole = 读取正文文本(输入, ["staffRole", "title"], "");
  if (staffRole) return staffRole;
  const role = 读取正文文本(输入, ["role"], "");
  if (role && !是账号角色(role)) return role;
  return accountRole === "partner_admin" ? "企业管理员" : "销售代表";
}

async function 查询渠道成员账号角色(
  pool: Pool,
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

async function 绑定用户角色(pool: Pool, username: string, roleCode: string) {
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
}

async function 保存V2渠道商(pool: Pool, id: string, 输入: 字典) {
  const name = 读取正文文本(输入, ["name", "partnerName"], "");
  if (!name) throw Object.assign(new Error("请输入渠道商名称。"), { statusCode: 400 });
  const code = id || 读取正文文本(输入, ["id", "partnerId", "code"], `PARTNER-V3-${Date.now()}`);
  const level = 读取正文文本(输入, ["partnerLevel", "level"], "none");
  const extra = { ...输入, id: code, name, partnerName: name, level };
  const params = [
    code,
    name,
    migrationNormalizedName(name),
    转V3渠道级别(level),
    读取正文文本(输入, ["city"], ""),
    读取正文文本(输入, ["contact", "contactName"], ""),
    读取正文文本(输入, ["phone", "contactPhone"], ""),
    读取正文文本(输入, ["email", "contactEmail"], ""),
    转V3伙伴状态(读取正文文本(输入, ["status"], "active")),
    JSON.stringify(extra),
  ];

  if (id) {
    const result = await pool.query<{ id: string }>(
      `
      UPDATE channel.partners
      SET partner_name = $2,
          normalized_name = $3,
          partner_level_code = $4,
          city_name = NULLIF($5, ''),
          contact_name = NULLIF($6, ''),
          contact_phone = NULLIF($7, ''),
          contact_email = NULLIF($8, '')::citext,
          status_code = $9,
          updated_at = now(),
          extra_json = extra_json || $10::jsonb
      WHERE id::text = $1 OR v2_source_id = $1 OR partner_code = $1
      RETURNING id::text AS id
      `,
      params,
    );
    if (!result.rows[0]) throw Object.assign(new Error("渠道商不存在。"), { statusCode: 404 });
  } else {
    await pool.query(
      `
      INSERT INTO channel.partners (
        v2_source_id, partner_code, partner_name, normalized_name, partner_level_code,
        city_name, contact_name, contact_phone, contact_email, status_code, extra_json
      )
      VALUES ($1, $1, $2, $3, $4, NULLIF($5, ''), NULLIF($6, ''), NULLIF($7, ''), NULLIF($8, '')::citext, $9, $10::jsonb)
      ON CONFLICT (v2_source_id) DO UPDATE
      SET partner_name = EXCLUDED.partner_name,
          normalized_name = EXCLUDED.normalized_name,
          partner_level_code = EXCLUDED.partner_level_code,
          city_name = EXCLUDED.city_name,
          contact_name = EXCLUDED.contact_name,
          contact_phone = EXCLUDED.contact_phone,
          contact_email = EXCLUDED.contact_email,
          status_code = EXCLUDED.status_code,
          updated_at = now(),
          extra_json = channel.partners.extra_json || EXCLUDED.extra_json
      `,
      params,
    );
  }

  return { ...extra, status: 读取正文文本(输入, ["status"], "active") };
}

async function 更新渠道商状态(pool: Pool, id: string, status: string, 输入: 字典) {
  const result = await pool.query<{ id: string; partner_name: string }>(
    `
    UPDATE channel.partners
    SET status_code = $2,
        updated_at = now(),
        extra_json = extra_json || $3::jsonb
    WHERE id::text = $1 OR v2_source_id = $1 OR partner_code = $1
    RETURNING COALESCE(v2_source_id, partner_code, id::text) AS id, partner_name
    `,
    [id, 转V3伙伴状态(status), JSON.stringify({ ...输入, status })],
  );
  const row = result.rows[0];
  if (!row) throw Object.assign(new Error("渠道商不存在。"), { statusCode: 404 });
  return { id: row.id, name: row.partner_name, partnerName: row.partner_name, status };
}

async function 保存渠道商分销层级(pool: Pool, id: string, 输入: 字典) {
  const level = 读取正文文本(输入, ["partnerLevel", "level"], "none");
  const parentPartnerIds = 读取对象字符串数组(输入, "parentPartnerIds");
  const partnerUuid = await 查找渠道商UUID(pool, id);
  if (!partnerUuid) throw Object.assign(new Error("渠道商不存在。"), { statusCode: 404 });

  await pool.query(
    `
    UPDATE channel.partners
    SET partner_level_code = $2,
        updated_at = now(),
        extra_json = extra_json || $3::jsonb
    WHERE id = $1::uuid
    `,
    [partnerUuid, 转V3渠道级别(level), JSON.stringify({ partnerLevel: level, parentPartnerIds })],
  );

  await pool.query("DELETE FROM channel.partner_relations WHERE child_partner_id = $1::uuid", [
    partnerUuid,
  ]);
  if (转V3渠道级别(level) === "secondary") {
    for (const parentId of parentPartnerIds) {
      const parentUuid = await 查找渠道商UUID(pool, parentId);
      if (!parentUuid || parentUuid === partnerUuid) continue;
      await pool.query(
        `
        INSERT INTO channel.partner_relations (parent_partner_id, child_partner_id, relation_code)
        VALUES ($1::uuid, $2::uuid, 'primary_secondary')
        ON CONFLICT DO NOTHING
        `,
        [parentUuid, partnerUuid],
      );
    }
  }

  return {
    id,
    partnerLevel: level,
    parentPartnerIds,
    parentPartnerId: parentPartnerIds[0] || "",
  };
}

async function 查询渠道商简介(pool: Pool, id: string) {
  const partnerUuid = await 查找渠道商UUID(pool, id);
  if (!partnerUuid) throw Object.assign(new Error("渠道商不存在。"), { statusCode: 404 });
  const result = await pool.query<{
    partner_id: string;
    partner_code: string | null;
    partner_name: string;
    profile_id: string | null;
    extra_json: 字典 | null;
    partner_extra_json: 字典 | null;
  }>(
    `
    SELECT
      p.id::text AS partner_id,
      COALESCE(p.v2_source_id, p.partner_code) AS partner_code,
      p.partner_name,
      pp.id::text AS profile_id,
      pp.extra_json,
      p.extra_json AS partner_extra_json
    FROM channel.partners p
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
  return {
    ...partnerExtra,
    ...profile,
    id: row.profile_id || row.partner_code || row.partner_id,
    partnerId: row.partner_code || row.partner_id,
    partnerName: row.partner_name,
    permissions: {
      canEditProfile: true,
      canManageProducts: true,
      ...(读取对象字典(profile, "permissions") || {}),
    },
    matrix: 读取对象数组(profile, "matrix"),
  };
}

async function 保存渠道商简介(pool: Pool, id: string, 输入: 字典) {
  const partnerUuid = await 查找渠道商UUID(pool, id);
  if (!partnerUuid) throw Object.assign(new Error("渠道商不存在。"), { statusCode: 404 });
  const extra = {
    ...输入,
    partnerId: id,
    updatedAt: new Date().toISOString(),
    permissions: { canEditProfile: true, canManageProducts: true },
  };
  await pool.query(
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
  return 查询渠道商简介(pool, id);
}

async function 保存渠道商员工(
  pool: Pool,
  partnerId: string,
  staffId: string,
  输入: 字典,
  当前用户?: 当前业务用户 | null,
) {
  const partnerUuid = await 查找渠道商UUID(pool, partnerId);
  if (!partnerUuid) throw Object.assign(new Error("渠道商不存在。"), { statusCode: 404 });
  const 已有账号角色 = staffId ? await 查询渠道成员账号角色(pool, partnerUuid, staffId) : "";
  const 账号角色 = 读取显式账号角色(输入) || 已有账号角色 || "staff";
  await 校验企业管理员渠道范围(pool, partnerUuid, 账号角色, 当前用户 || null);
  const 员工职位 = 读取员工职位(输入, 账号角色);
  const 用户 = await 保存V2用户(pool, staffId, {
    ...输入,
    role: 账号角色,
    staffRole: 员工职位,
    partnerId,
  });
  const userUuid = await 查找用户UUID(pool, 用户.id || 用户.username);
  if (!userUuid) throw Object.assign(new Error("员工账号保存失败。"), { statusCode: 500 });
  await pool.query(
    `
    INSERT INTO channel.partner_members (partner_id, user_id, member_role_code, status_code)
    VALUES ($1::uuid, $2::uuid, $3, $4)
    ON CONFLICT (partner_id, user_id) DO UPDATE
    SET member_role_code = EXCLUDED.member_role_code,
        status_code = EXCLUDED.status_code,
        ended_at = NULL
    `,
    [
      partnerUuid,
      userUuid,
      账号角色 === "partner_admin" ? "partner_admin" : "staff",
      转V3账号状态(读取正文文本(输入, ["status"], "active")),
    ],
  );
  return 用户;
}

async function 校验企业管理员渠道范围(
  pool: Pool,
  partnerUuid: string,
  accountRole: string,
  当前用户: 当前业务用户 | null,
): Promise<void> {
  if (accountRole !== "partner_admin" || !当前用户?.username) return;
  const 范围 = await 查询账号创建范围(pool, 当前用户);
  if (!范围 || 范围.roleCode !== "region_manager") return;
  if (!范围.regionId && !范围.regionName) {
    throw Object.assign(new Error("区域管理员未绑定区域，不能创建企业管理员。"), {
      statusCode: 403,
    });
  }
  const result = await pool.query<{ region_id: string | null; region_name: string | null }>(
    `
    SELECT p.region_id::text AS region_id, COALESCE(r.region_name, p.extra_json->>'region') AS region_name
    FROM channel.partners p
    LEFT JOIN org.regions r ON r.id = p.region_id
    WHERE p.id = $1::uuid
    LIMIT 1
    `,
    [partnerUuid],
  );
  const row = result.rows[0];
  const 区域匹配 =
    (范围.regionId && row?.region_id === 范围.regionId) ||
    (范围.regionName && row?.region_name === 范围.regionName);
  if (!区域匹配) {
    throw Object.assign(new Error("只能为本区域渠道商创建企业管理员。"), { statusCode: 403 });
  }
}

async function 查询账号创建范围(
  pool: Pool,
  用户: 当前业务用户,
): Promise<{ roleCode: string; regionId: string; regionName: string } | null> {
  const result = await pool.query<{
    role_code: string | null;
    region_id: string | null;
    region_name: string | null;
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
      u.region_id::text AS region_id,
      COALESCE(reg.region_name, u.extra_json->>'region') AS region_name
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
  };
}

async function 更新渠道商员工状态(pool: Pool, partnerId: string, staffId: string, status: string) {
  const partnerUuid = await 查找渠道商UUID(pool, partnerId);
  const userUuid = await 查找用户UUID(pool, staffId);
  if (!partnerUuid || !userUuid)
    throw Object.assign(new Error("渠道商或员工不存在。"), { statusCode: 404 });
  await pool.query(
    `
    UPDATE channel.partner_members
    SET status_code = $3,
        ended_at = CASE WHEN $3 = 'disabled' THEN now() ELSE NULL END
    WHERE partner_id = $1::uuid AND user_id = $2::uuid
    `,
    [partnerUuid, userUuid, 转V3账号状态(status)],
  );
  return 更新用户状态(pool, staffId, status);
}

async function 删除渠道商员工(pool: Pool, partnerId: string, staffId: string) {
  const partnerUuid = await 查找渠道商UUID(pool, partnerId);
  const userUuid = await 查找用户UUID(pool, staffId);
  if (!partnerUuid || !userUuid)
    throw Object.assign(new Error("渠道商或员工不存在。"), { statusCode: 404 });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const removed = await client.query<{ member_role_code: string }>(
      `
      DELETE FROM channel.partner_members
      WHERE partner_id = $1::uuid AND user_id = $2::uuid
      RETURNING member_role_code
      `,
      [partnerUuid, userUuid],
    );
    if (!removed.rows[0])
      throw Object.assign(new Error("渠道商员工关系不存在。"), { statusCode: 404 });

    const remaining = await client.query<{ count: string }>(
      `
      SELECT COUNT(*)::text AS count
      FROM channel.partner_members
      WHERE user_id = $1::uuid
      `,
      [userUuid],
    );
    const extra = {
      status: "deleted",
      deletedFromPartnerId: partnerId,
      deletedAt: new Date().toISOString(),
    };
    if (Number(remaining.rows[0]?.count || 0) === 0) {
      await client.query(
        `
        UPDATE iam.users
        SET status_code = 'disabled',
            updated_at = now(),
            extra_json = extra_json || $2::jsonb
        WHERE id = $1::uuid
        `,
        [userUuid, JSON.stringify(extra)],
      );
    } else {
      await client.query(
        `
        UPDATE iam.users
        SET updated_at = now(),
            extra_json = extra_json || $2::jsonb
        WHERE id = $1::uuid
        `,
        [userUuid, JSON.stringify(extra)],
      );
    }
    await client.query("COMMIT");
    return { id: staffId, userId: userUuid, partnerId, deleted: true };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function 更新待审批状态(pool: Pool, id: string, status: string, 输入: 字典) {
  const result = await pool.query<{
    id: string;
    target_type: string;
    target_id: string | null;
    extra_json: 字典 | null;
  }>(
    `
    UPDATE ops.approvals
    SET status_code = $2,
        updated_at = now(),
        extra_json = extra_json || $3::jsonb
    WHERE id::text = $1 OR v2_source_id = $1
    RETURNING COALESCE(v2_source_id, id::text) AS id, target_type, target_id::text AS target_id, extra_json
    `,
    [id, status, JSON.stringify({ ...输入, status })],
  );
  const row = result.rows[0];
  if (!row) throw Object.assign(new Error("审批记录不存在。"), { statusCode: 404 });
  if (row.target_id) {
    if (
      row.target_type === "user" ||
      row.target_type === "staff" ||
      row.target_type === "account"
    ) {
      await pool.query(
        "UPDATE iam.users SET status_code = $2, updated_at = now() WHERE id = $1::uuid",
        [row.target_id, status === "approved" ? "active" : "disabled"],
      );
    }
    if (row.target_type === "partner") {
      await pool.query(
        "UPDATE channel.partners SET status_code = $2, updated_at = now() WHERE id = $1::uuid",
        [row.target_id, status === "approved" ? "active" : "disabled"],
      );
    }
    if (row.target_type === "registration") {
      await pool.query(
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
          status,
          JSON.stringify({
            status,
            reviewRemark: 读取对象文本(输入, "remark") || 读取对象文本(输入, "reason"),
            updatedByName: 读取对象文本(输入, "approvedBy") || "V2兼容审批",
          }),
        ],
      );
    }
  }
  return { ...(row.extra_json || {}), id: row.id, status };
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
    ORDER BY COALESCE((f.extra_json->>'sort')::integer, 999), f.feature_name
    `,
  );
  return result.rows.map((row) => {
    const extra = row.extra_json || {};
    return {
      ...extra,
      id: 取V2编号(row),
      moduleId: 读取对象文本(extra, "moduleId") || row.module_v2_id || row.module_id || "",
      categoryId: 读取对象文本(extra, "categoryId") || row.category_v2_id || "",
      name: 读取对象文本(extra, "name") || row.feature_name,
      productCode:
        读取对象文本(extra, "productCode") || row.feature_code || row.v2_source_id || row.id,
      priceType: 读取对象文本(extra, "priceType") || "fixed",
      priceFixed: 读取对象数字(extra, "priceFixed", Number(row.list_price) || 0),
      tiers: 读取对象数组(extra, "tiers"),
      unit: 读取对象文本(extra, "unit") || row.unit_name || "端点",
      desc: 读取对象文本(extra, "desc"),
      required: 读取对象布尔(extra, "required", false),
      published: 读取对象布尔(extra, "published", row.published),
      status: 读取对象文本(extra, "status") || row.status_code,
      regionPriceOverrides: 读取对象数组(extra, "regionPriceOverrides"),
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
  const extra = { ...输入, id: code, name };
  if (!moduleId) throw Object.assign(new Error("请选择产品模块。"), { statusCode: 400 });
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

async function 重写套餐明细(client: PoolClient, packageUuid: string, 输入: 字典) {
  await client.query("DELETE FROM catalog.package_items WHERE package_id = $1::uuid", [
    packageUuid,
  ]);
  let sort = 1;
  for (const featureId of 读取对象字符串数组(输入, "featureIds")) {
    const uuid = await 查找功能UUID(client, featureId);
    if (!uuid) continue;
    await client.query(
      "INSERT INTO catalog.package_items (package_id, product_ref_type, product_ref_id, quantity, sort_order) VALUES ($1::uuid, 'feature', $2::uuid, 1, $3)",
      [packageUuid, uuid, sort++],
    );
  }
  for (const hardwareId of 读取对象字符串数组(输入, "hardwareIds")) {
    const uuid = await 查找硬件UUID(client, hardwareId);
    if (!uuid) continue;
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
  await pool.query(
    `UPDATE ${table} SET status_code = 'archived', extra_json = extra_json || $2::jsonb WHERE id::text = $1 OR v2_source_id = $1`,
    [id, JSON.stringify({ deleted: true, deletedAt: new Date().toISOString() })],
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

async function 查找功能UUID(db: PoolClient, id: string): Promise<string> {
  const result = await db.query<{ id: string }>(
    "SELECT id::text AS id FROM catalog.product_features WHERE id::text = $1 OR v2_source_id = $1 OR feature_code = $1 LIMIT 1",
    [id],
  );
  return result.rows[0]?.id || "";
}

async function 查找硬件UUID(db: PoolClient, id: string): Promise<string> {
  const result = await db.query<{ id: string }>(
    "SELECT id::text AS id FROM catalog.hardware_products WHERE id::text = $1 OR v2_source_id = $1 OR hardware_code = $1 LIMIT 1",
    [id],
  );
  return result.rows[0]?.id || "";
}

function 取V2编号(row: 数据库行): string {
  const extra = row.extra_json || {};
  return 读取对象文本(extra, "id") || row.v2_source_id || row.id;
}

async function 查找渠道商UUID(pool: Pool, id: string): Promise<string> {
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

async function 查找用户UUID(pool: Pool, id: string): Promise<string> {
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
  type: V2导入类型,
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

function 构建导出行(type: V2导入类型, item: 字典): unknown[] {
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

async function 解析导入Excel(pool: Pool, type: V2导入类型, file: Express.Multer.File) {
  const template = V2导入模板[type];
  const workbook = XLSX.read(file.buffer, { type: "buffer", cellDates: true });
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
  return {
    headers,
    rows: parsedRows,
    totalCount: rows.length,
    errorCount: parsedRows.filter((row) => row.errors.length > 0).length,
  };
}

async function 执行导入Excel(
  pool: Pool,
  type: V2导入类型,
  file: Express.Multer.File,
): Promise<V2导入结果> {
  const parsed = await 解析导入Excel(pool, type, file);
  const results: V2导入结果 = {
    success: 0,
    updated: 0,
    profileUpdated: 0,
    failed: 0,
    errors: [],
  };

  for (const row of parsed.rows) {
    if (row.errors.length) {
      results.failed++;
      results.errors.push({ row: row.rowIndex, message: row.errors.join("；") });
      continue;
    }
    try {
      const result = await 写入导入行(pool, type, row.data);
      if (result === "updated") {
        results.updated++;
      } else if (result === "created") {
        results.success++;
      } else if (result === "profile-updated") {
        results.updated++;
        results.profileUpdated++;
      } else {
        results.success++;
        results.profileUpdated++;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "导入失败";
      results.failed++;
      results.errors.push({ row: row.rowIndex, message });
    }
  }

  return results;
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
  const partner = partnerName ? await 查询渠道商按名称(pool, partnerName) : null;
  if (partnerName && !partner) errors.push(`渠道商“${partnerName}”不存在。`);
  if (type === "staff") {
    item.status = 规范导入员工状态(读取对象文本(item, "status"));
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
): Promise<"created" | "updated" | "profile-created" | "profile-updated"> {
  if (type === "partners") return 写入导入渠道商(pool, item);
  if (type === "staff") return 写入导入员工(pool, item);
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
  const regionId = await 确保区域(pool, 读取对象文本(item, "region"));
  const extra = {
    ...item,
    id: code,
    name,
    partnerName: name,
    level: 读取对象文本(item, "level"),
    partnerLevel: 读取对象文本(item, "partnerLevel") || "none",
    status: "active",
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
          status_code = 'active',
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
      VALUES ($1, $1, $2, $3, 'none', $4::uuid, NULLIF($5, ''), NULLIF($6, ''), NULLIF($7, ''), NULLIF($8, '')::citext, 'active', now()::date, $9::jsonb)
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

async function 写入导入员工(pool: Pool, item: 字典): Promise<"created" | "updated"> {
  const partner = await 查询渠道商按名称(pool, 读取对象文本(item, "partnerName"));
  if (!partner) throw new Error("渠道商不存在。");
  const existing = await 查询V2用户(pool, 读取对象文本(item, "username"));
  await 保存渠道商员工(pool, partner.id, existing?.id || "", {
    ...item,
    role: "staff",
    partnerId: partner.id,
    partnerName: partner.name,
    region: partner.region,
    bigRegion: partner.bigRegion,
    status: 读取对象文本(item, "status") || "active",
  });
  return existing ? "updated" : "created";
}

async function 写入导入报备(pool: Pool, item: 字典): Promise<"created" | "updated"> {
  const partner = await 查询渠道商按名称(pool, 读取对象文本(item, "partnerName"));
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
  const now = new Date().toISOString();
  const extra = {
    ...item,
    id: code,
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
    VALUES ($1, $1, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'approved', now(), now(), now(), now(), $6::jsonb)
    `,
    [code, customerId, partner.uuid, staff.uuid, regionId, JSON.stringify(extra)],
  );
  return "created";
}

async function 写入导入商机(pool: Pool, item: 字典): Promise<"created" | "updated"> {
  const partner = await 查询渠道商按名称(pool, 读取对象文本(item, "partnerName"));
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
    VALUES ($1, $1, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid, $7, $7, $8, $9, now(), now(), $10::jsonb)
    `,
    [
      code,
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

async function 查询渠道商按名称(pool: Pool, name: string): Promise<V2渠道商引用 | null> {
  if (!name) return null;
  const result = await pool.query<V2渠道商引用>(
    `
    SELECT
      p.id::text AS uuid,
      COALESCE(p.v2_source_id, p.partner_code, p.id::text) AS id,
      p.partner_name AS name,
      COALESCE(r.region_name, p.extra_json->>'region', '') AS region,
      COALESCE(p.city_name, p.extra_json->>'city', '') AS city,
      COALESCE(big.region_name, p.extra_json->>'bigRegion', '') AS "bigRegion"
    FROM channel.partners p
    LEFT JOIN org.regions r ON r.id = p.region_id
    LEFT JOIN org.regions big ON big.id = r.parent_region_id
    WHERE p.status_code <> 'archived'
      AND (p.normalized_name = $1 OR p.partner_name = $2 OR p.extra_json->>'name' = $2)
    ORDER BY p.updated_at DESC
    LIMIT 1
    `,
    [migrationNormalizedName(name), name],
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
    JOIN channel.partner_members pm ON pm.user_id = u.id AND pm.status_code = 'active'
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
      COALESCE(r.v2_source_id, r.registration_no, r.id::text) AS id,
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
      COALESCE(r.v2_source_id, r.registration_no, r.id::text) AS id,
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
  const map: Record<string, string> = {
    name: "名称",
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
  if (["disabled", "inactive", "rejected", "archived", "cancelled"].includes(status))
    return "disabled";
  if (status === "locked") return "locked";
  return "active";
}

function 转V3渠道级别(level: string): string {
  if (level === "primary" || level === "一级渠道商") return "primary";
  if (level === "secondary" || level === "二级渠道商") return "secondary";
  return "none";
}

function 转V3伙伴状态(status: string): string {
  if (status === "archived") return "archived";
  if (["disabled", "rejected", "cancelled"].includes(status)) return "disabled";
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
