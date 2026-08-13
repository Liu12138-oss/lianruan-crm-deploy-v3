import crypto from "node:crypto";

import type { 日志器, 日志字段, 构建信息 } from "@lianruan/shared";
import { 创建成功响应, 应用错误 } from "@lianruan/shared";
import type { Request, Router } from "express";
import { Router as createRouter } from "express";
import { Pool } from "pg";

import {
  type IamH5单点登录配置,
  type 单点登录入口,
  校验IamH5单点登录凭证,
  解析单点登录入口,
  读取IamH5单点登录配置,
} from "./iam-sso.js";
import type { 认证流程日志器 } from "./logger.js";
import {
  type UniSdp单点登录身份,
  type UniSdp单点登录配置,
  校验UniSdp单点登录凭证,
  读取UniSdp单点登录配置,
} from "./unisdp-sso.js";

interface 交付用户 {
  username: string;
  displayName: string;
  roleName: string;
  passwordHash: string;
  defaultPath: string;
  allowedPaths: string[];
  pageUser: 业务页面用户;
  roleCodes: string[];
}

type 业务页面角色 = "superadmin" | "admin" | "partner_admin" | "staff";

interface 业务页面用户 {
  [key: string]: unknown;
  id: string;
  userId: string;
  username: string;
  name: string;
  displayName: string;
  role: 业务页面角色;
  roleName: string;
  status: string;
  region: string;
  bigRegion: string;
  partnerId: string;
  partnerName: string;
}

interface 业务页面会话 {
  token: string;
  user: 业务页面用户;
}

export interface 移动端会话 {
  token: string;
  user: 业务页面用户;
}

interface 移动端会话载荷 {
  username: string;
  role: 业务页面角色;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
}

interface 会话载荷 {
  username: string;
  role?: 业务页面角色;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
}

interface 认证配置 {
  enabled: boolean;
  cookieName: string;
  cookieSecure: boolean;
  ttlSeconds: number;
  sessionSecret: string;
  users: 交付用户[];
  databaseUrl?: string | undefined;
  pool?: Pool | undefined;
  sso: IamH5单点登录配置;
  uniSdpSso: UniSdp单点登录配置;
  logger?: 日志器 | undefined;
  authFlowLogger?: 认证流程日志器 | undefined;
}

interface 数据库用户行 {
  id: string;
  v2_source_id: string | null;
  username: string;
  display_name: string;
  password_hash: string | null;
  role_code: string | null;
  role_name: string | null;
  region_name: string | null;
  extra_json: Record<string, unknown> | null;
  partner_id: string | null;
  partner_name: string | null;
  role_codes: string[] | null;
  phone: string | null;
}

interface 单点登录本地匹配结果 {
  用户: 交付用户;
  匹配方式: "username" | "partner_phone";
}

interface 认证路由参数 {
  build: 构建信息;
  sessionSecret: string;
  databaseUrl?: string | undefined;
  env?: NodeJS.ProcessEnv;
  logger?: 日志器 | undefined;
  authFlowLogger?: 认证流程日志器 | undefined;
}

interface 会话用户名读取参数 {
  sessionSecret: string;
  env?: NodeJS.ProcessEnv;
}

const 默认Cookie名称 = "lianruan_crm_v3_session";
const 默认会话秒数 = 12 * 60 * 60;

export function 创建认证路由(参数: 认证路由参数): Router {
  const router = createRouter();
  const 配置 = 读取认证配置(参数);

  注册账号密码路由(router, 配置, 参数.build);
  注册Iam单点登录路由(router, 配置, 参数.build);
  注册UniSdp单点登录路由(router, 配置, 参数.build);
  注册会话路由(router, 配置, 参数.build);

  return router;
}

export function 创建门户单点登录路由(参数: 认证路由参数): Router {
  const router = createRouter();
  const 配置 = 读取认证配置(参数);

  注册UniSdp门户单点登录路由(router, 配置);

  return router;
}

export function 读取请求会话用户名(req: Request, 参数: 会话用户名读取参数 | undefined): string {
  if (!参数?.sessionSecret) return "";
  const env = 参数.env ?? process.env;
  const cookieName = env.V3_DELIVERY_AUTH_COOKIE_NAME || 默认Cookie名称;
  const token = 读取Cookie(req, cookieName);
  if (!token) return "";
  try {
    const payload = 解析会话令牌(token, 参数.sessionSecret);
    if (payload.expiresAt <= Math.floor(Date.now() / 1000)) return "";
    return payload.username;
  } catch {
    return "";
  }
}

export function 读取请求会话角色(
  req: Request,
  参数: 会话用户名读取参数 | undefined,
): 业务页面角色 | "" {
  if (!参数?.sessionSecret) return "";
  const env = 参数.env ?? process.env;
  const cookieName = env.V3_DELIVERY_AUTH_COOKIE_NAME || 默认Cookie名称;
  const token = 读取Cookie(req, cookieName);
  if (!token) return "";
  try {
    const payload = 解析会话令牌(token, 参数.sessionSecret);
    if (payload.expiresAt <= Math.floor(Date.now() / 1000)) return "";
    return payload.role || "";
  } catch {
    return "";
  }
}

function 注册账号密码路由(router: Router, 配置: 认证配置, build: 构建信息): void {
  router.post("/login", async (req, res, next) => {
    const 诊断字段 = 读取账号密码登录诊断(req, 配置);
    记录认证事件(配置, "info", "账号密码登录开始", {
      event: "auth.password.started",
      ...读取认证请求字段(req),
      ...诊断字段,
    });
    try {
      if (!配置.enabled) throw new 应用错误("V3_AUTH_DISABLED", "登录入口未启用。", 503);
      const { username, password } = 读取登录请求(req);
      const 用户 = await 查找并校验用户(username, password, 配置);
      if (!用户) {
        throw new 应用错误("V3_AUTH_INVALID_CREDENTIALS", "用户名或密码不正确。", 401);
      }

      const token = 签发会话令牌(用户.username, 用户.pageUser.role, 配置);
      const 页面会话 = 创建业务页面会话(用户);
      const 移动端会话 = 创建移动端会话(用户, 配置);
      写入会话Cookie(res, 配置, token);
      记录认证事件(配置, "info", "账号密码登录成功", {
        event: "auth.password.succeeded",
        ...读取认证请求字段(req),
        username: 用户.username,
        displayName: 用户.displayName,
        roleName: 用户.roleName,
        defaultPath: 用户.defaultPath,
        allowedPathCount: 用户.allowedPaths.length,
        sessionTokenFingerprint: 创建认证指纹(token, 配置, "auth-session"),
        pageSessionTokenFingerprint: 创建认证指纹(页面会话.token, 配置, "page-session"),
        sessionCookieWritten: true,
        cookieSecure: 配置.cookieSecure,
        ttlSeconds: 配置.ttlSeconds,
        resultCode: "success",
      });
      res.json(
        创建成功响应({
          requestId: req.requestId,
          build,
          data: {
            user: 转换用户响应(用户),
            pageSession: 页面会话,
            mobileSession: 移动端会话,
            expiresInSeconds: 配置.ttlSeconds,
          },
        }),
      );
    } catch (error) {
      记录认证失败(配置, "password", "账号密码登录失败", req, error, 诊断字段);
      next(error);
    }
  });
}

function 注册Iam单点登录路由(router: Router, 配置: 认证配置, build: 构建信息): void {
  router.get("/sso/iam/config", (req, res, next) => {
    try {
      if (!配置.enabled) throw new 应用错误("V3_AUTH_DISABLED", "登录入口未启用。", 503);
      res.json(
        创建成功响应({
          requestId: req.requestId,
          build,
          data: {
            enabled: 配置.sso.enabled,
            entries: ["admin", "partner"],
            requestIsaidByEntry: 配置.sso.requestIsaidByEntry,
            timeoutMs: 配置.sso.timeoutMs,
          },
        }),
      );
    } catch (error) {
      next(error);
    }
  });

  router.post("/sso/iam/login", (req, res, next) => {
    处理Iam单点登录(req, res, next, 配置, build);
  });

  router.post("/sso/iam/admin-login-v2", (req, res, next) => {
    处理Iam单点登录(req, res, next, 配置, build, "admin");
  });

  router.post("/sso/iam/partner-login-v2", (req, res, next) => {
    处理Iam单点登录(req, res, next, 配置, build, "partner");
  });
}

function 注册会话路由(router: Router, 配置: 认证配置, build: 构建信息): void {
  router.get("/me", async (req, res, next) => {
    const 会话诊断 = 读取会话诊断(req, 配置);
    记录认证事件(配置, "info", "当前会话校验开始", {
      event: "auth.session.started",
      ...读取认证请求字段(req),
      ...会话诊断,
    });
    try {
      if (!配置.enabled) throw new 应用错误("V3_AUTH_DISABLED", "登录入口未启用。", 503);
      const 用户 = await 读取当前用户(req, 配置);
      const 页面会话 = 创建业务页面会话(用户);
      const 移动端会话 = 创建移动端会话(用户, 配置);
      记录认证事件(配置, "info", "当前会话校验成功", {
        event: "auth.session.succeeded",
        ...读取认证请求字段(req),
        ...会话诊断,
        username: 用户.username,
        displayName: 用户.displayName,
        roleName: 用户.roleName,
        defaultPath: 用户.defaultPath,
        allowedPathCount: 用户.allowedPaths.length,
        pageSessionTokenFingerprint: 创建认证指纹(页面会话.token, 配置, "page-session"),
        resultCode: "success",
      });
      res.json(
        创建成功响应({
          requestId: req.requestId,
          build,
          data: {
            user: 转换用户响应(用户),
            pageSession: 页面会话,
            mobileSession: 移动端会话,
          },
        }),
      );
    } catch (error) {
      记录认证失败(配置, "session", "当前会话校验失败", req, error, 会话诊断);
      next(error);
    }
  });

  router.post("/logout", (req, res) => {
    const 会话诊断 = 读取会话诊断(req, 配置);
    清理会话Cookie(res, 配置);
    记录认证事件(配置, "info", "用户退出登录完成", {
      event: "auth.logout.completed",
      ...读取认证请求字段(req),
      ...会话诊断,
      sessionCookieCleared: true,
      resultCode: "success",
    });
    res.json(
      创建成功响应({
        requestId: req.requestId,
        build,
        data: { loggedOut: true },
      }),
    );
  });
}

function 读取认证配置(参数: 认证路由参数): 认证配置 {
  const env = 参数.env ?? process.env;
  const users = 解析交付用户(env.V3_DELIVERY_AUTH_USERS_JSON);
  return {
    enabled: env.V3_DELIVERY_AUTH_ENABLED === "true",
    cookieName: env.V3_DELIVERY_AUTH_COOKIE_NAME || 默认Cookie名称,
    cookieSecure: env.V3_DELIVERY_AUTH_COOKIE_SECURE === "true",
    ttlSeconds: 解析正整数(env.V3_DELIVERY_AUTH_TTL_SECONDS, 默认会话秒数),
    sessionSecret: 参数.sessionSecret,
    users,
    databaseUrl: 参数.databaseUrl,
    pool: 参数.databaseUrl ? new Pool({ connectionString: 参数.databaseUrl }) : undefined,
    sso: 读取IamH5单点登录配置(env),
    uniSdpSso: 读取UniSdp单点登录配置(env),
    logger: 参数.logger,
    authFlowLogger: 参数.authFlowLogger,
  };
}

function 注册UniSdp单点登录路由(router: Router, 配置: 认证配置, build: 构建信息): void {
  router.post("/sso/unisdp/login", (req, res, next) => {
    处理UniSdp单点登录(req, res, next, 配置, build);
  });
}

function 注册UniSdp门户单点登录路由(router: Router, 配置: 认证配置): void {
  router.post("/app/sso.htm", (req, res, next) => {
    处理UniSdp门户单点登录(req, res, next, 配置);
  });
  router.get("/app/sso.htm", (req, res, next) => {
    处理UniSdp门户单点登录(req, res, next, 配置);
  });
}

async function 处理Iam单点登录(
  req: Request,
  res: {
    json(body: unknown): void;
    setHeader(name: string, value: string): void;
  },
  next: (error?: unknown) => void,
  配置: 认证配置,
  build: 构建信息,
  固定入口?: 单点登录入口,
): Promise<void> {
  const 诊断字段 = 读取Iam单点登录诊断(req, 配置, 固定入口);
  let 失败阶段 = "request";
  let 校验入口: 单点登录入口 | null = null;
  记录认证事件(配置, "info", "IAM单点登录开始", {
    event: "auth.iam_sso.started",
    ...读取认证请求字段(req),
    ...诊断字段,
  });
  try {
    if (!配置.enabled) throw new 应用错误("V3_AUTH_DISABLED", "登录入口未启用。", 503);
    const { token, entry, clientType } = 读取单点登录请求(req, 固定入口);
    校验入口 = 选择单点登录校验入口(entry, 配置.sso);
    失败阶段 = "provider";
    记录认证事件(配置, "info", "IAM单点登录开始调用认证服务", {
      event: "auth.iam_sso.provider_started",
      ...读取认证请求字段(req),
      ...诊断字段,
      entry: 校验入口,
      timeoutMs: 配置.sso.timeoutMs,
      validateUrlConfigured: Boolean(配置.sso.validateUrl),
      validateIsaidFingerprint: 创建认证指纹(
        配置.sso.validateIsaidByEntry[校验入口],
        配置,
        "iam-isaid",
      ),
      validateIsaidLength: 配置.sso.validateIsaidByEntry[校验入口].length,
    });
    const iam身份 = await 校验IamH5单点登录凭证(token, 校验入口, 配置.sso);
    失败阶段 = "local_user";
    记录认证事件(配置, "info", "IAM单点登录认证服务校验通过", {
      event: "auth.iam_sso.provider_succeeded",
      ...读取认证请求字段(req),
      entry: 校验入口,
      iamUsername: iam身份.username,
      iamRawUsername: iam身份.rawUsername,
      iamDisplayName: iam身份.displayName,
      iamUserId: iam身份.userId,
      iamDeptId: iam身份.deptId,
      iamDeptName: iam身份.deptName,
      resultCode: "success",
    });
    const 本地匹配 = await 查找并匹配单点登录用户(
      { username: iam身份.username, rawUsername: iam身份.rawUsername },
      配置,
    );
    if (!本地匹配) {
      // 区分错误文案:手机号形态走 V3_AUTH_SSO_PARTNER_NOT_FOUND,管理员形态走 V3_AUTH_SSO_USER_NOT_FOUND。
      const 形态 = 判定单点登录值形态(iam身份.username);
      throw new 应用错误(
        形态 === "partner_phone"
          ? "V3_AUTH_SSO_PARTNER_NOT_FOUND"
          : "V3_AUTH_SSO_USER_NOT_FOUND",
        形态 === "partner_phone"
          ? "CRM 未开通该渠道手机号对应的账号,请联系管理员。"
          : "CRM 未开通该单点登录账号。",
        403,
      );
    }
    const 用户 = 本地匹配.用户;
    // 单点登录入口严格按形态决定:手机号→partner,username→admin。请求方传入的 entry 仅作为
    // 校验 isaid 的提示,不再作为最终入口,避免前端 redirect 把渠道用户带进 admin 入口。
    const 登录入口 = 本地匹配.匹配方式 === "partner_phone" ? "partner" : "admin";
    if (!允许进入工作区(用户, 登录入口)) {
      throw new 应用错误("V3_AUTH_SSO_FORBIDDEN", "当前账号未开通该单点登录入口。", 403);
    }

    const sessionToken = 签发会话令牌(用户.username, 用户.pageUser.role, 配置);
    const 页面会话 = 创建业务页面会话(用户);
    const 移动端会话 = 创建移动端会话(用户, 配置);
    写入会话Cookie(res, 配置, sessionToken);
    记录认证事件(配置, "info", "IAM单点登录成功", {
      event: "auth.iam_sso.succeeded",
      ...读取认证请求字段(req),
      ...诊断字段,
      username: 用户.username,
      displayName: 用户.displayName,
      roleName: 用户.roleName,
      entry: 登录入口,
      localUserMatchMode: 本地匹配.匹配方式,
      clientType,
      defaultPath: 用户.defaultPath,
      allowedPathCount: 用户.allowedPaths.length,
      sessionTokenFingerprint: 创建认证指纹(sessionToken, 配置, "auth-session"),
      pageSessionTokenFingerprint: 创建认证指纹(页面会话.token, 配置, "page-session"),
      sessionCookieWritten: true,
      cookieSecure: 配置.cookieSecure,
      ttlSeconds: 配置.ttlSeconds,
      resultCode: "success",
    });
    res.json(
      创建成功响应({
        requestId: req.requestId,
        build,
        data: {
          user: 转换用户响应(用户),
          pageSession: 页面会话,
          mobileSession: 移动端会话,
          entry: 登录入口,
          matchedBy: 本地匹配.匹配方式,
          clientType,
          expiresInSeconds: 配置.ttlSeconds,
        },
      }),
    );
  } catch (error) {
    记录认证失败(配置, "iam_sso", "IAM单点登录失败", req, error, {
      ...诊断字段,
      failedStep: 失败阶段,
      entry: 校验入口 || (诊断字段.entry as string | undefined) || "",
    });
    next(error);
  }
}

async function 处理UniSdp单点登录(
  req: Request,
  res: {
    json(body: unknown): void;
    setHeader(name: string, value: string): void;
  },
  next: (error?: unknown) => void,
  配置: 认证配置,
  build: 构建信息,
): Promise<void> {
  const 诊断字段 = 读取UniSdp单点登录诊断(req, 配置);
  let 失败阶段 = "request";
  记录认证事件(配置, "info", "UniSDP单点登录开始", {
    event: "auth.unisdp_sso.started",
    ...读取认证请求字段(req),
    ...诊断字段,
  });
  try {
    if (!配置.enabled) throw new 应用错误("V3_AUTH_DISABLED", "登录入口未启用。", 503);
    const token = 读取UniSdp单点凭证(req);
    失败阶段 = "provider";
    记录认证事件(配置, "info", "UniSDP单点登录开始调用认证服务", {
      event: "auth.unisdp_sso.provider_started",
      ...读取认证请求字段(req),
      ...诊断字段,
      timeoutMs: 配置.uniSdpSso.timeoutMs,
      validateUrlConfigured: Boolean(配置.uniSdpSso.validateUrl),
      isaidFingerprint: 创建认证指纹(配置.uniSdpSso.isaid, 配置, "unisdp-isaid"),
      isaidLength: 配置.uniSdpSso.isaid.length,
    });
    const uniSdp身份 = await 校验UniSdp单点登录凭证(token, 配置.uniSdpSso);
    失败阶段 = "local_user";
    记录认证事件(配置, "info", "UniSDP单点登录认证服务校验通过", {
      event: "auth.unisdp_sso.provider_succeeded",
      ...读取认证请求字段(req),
      ...读取UniSdp身份日志字段(uniSdp身份, 配置),
      resultCode: "success",
    });
    const 本地匹配 = await 查找并匹配单点登录用户(
      { username: uniSdp身份.username, rawUsername: uniSdp身份.rawUsername, mobile: uniSdp身份.mobile },
      配置,
    );
    if (!本地匹配) {
      // 区分错误文案:手机号形态走 V3_AUTH_SSO_PARTNER_NOT_FOUND,管理员形态走 V3_AUTH_SSO_USER_NOT_FOUND。
      const 形态 = 判定单点登录值形态(uniSdp身份.mobile || uniSdp身份.username);
      throw new 应用错误(
        形态 === "partner_phone"
          ? "V3_AUTH_SSO_PARTNER_NOT_FOUND"
          : "V3_AUTH_SSO_USER_NOT_FOUND",
        形态 === "partner_phone"
          ? "CRM 未开通该渠道手机号对应的账号,请联系管理员。"
          : "CRM 未开通该单点登录账号。",
        403,
      );
    }
    const 用户 = 本地匹配.用户;
    // UniSDP 入口同样严格按形态决定。识别用户单点登录入口不再作为唯一决定因素。
    const 登录入口 = 本地匹配.匹配方式 === "partner_phone" ? "partner" : "admin";
    const sessionToken = 签发会话令牌(用户.username, 用户.pageUser.role, 配置);
    const 页面会话 = 创建业务页面会话(用户);
    const 移动端会话 = 创建移动端会话(用户, 配置);
    写入会话Cookie(res, 配置, sessionToken);
    记录认证事件(配置, "info", "UniSDP单点登录成功", {
      event: "auth.unisdp_sso.succeeded",
      ...读取认证请求字段(req),
      ...诊断字段,
      username: 用户.username,
      displayName: 用户.displayName,
      roleName: 用户.roleName,
      uniSdpLocalUserMatchMode: 本地匹配.匹配方式,
      entry: 登录入口,
      clientType: "pc",
      defaultPath: 用户.defaultPath,
      allowedPathCount: 用户.allowedPaths.length,
      sessionTokenFingerprint: 创建认证指纹(sessionToken, 配置, "auth-session"),
      pageSessionTokenFingerprint: 创建认证指纹(页面会话.token, 配置, "page-session"),
      sessionCookieWritten: true,
      cookieSecure: 配置.cookieSecure,
      ttlSeconds: 配置.ttlSeconds,
      ...读取UniSdp手机号日志字段(uniSdp身份, 配置),
      resultCode: "success",
    });
    res.json(
      创建成功响应({
        requestId: req.requestId,
        build,
        data: {
          user: 转换用户响应(用户),
          pageSession: 页面会话,
          mobileSession: 移动端会话,
          entry: 登录入口,
          matchedBy: 本地匹配.匹配方式,
          clientType: "pc",
          provider: "unisdp",
          expiresInSeconds: 配置.ttlSeconds,
        },
      }),
    );
  } catch (error) {
    记录认证失败(配置, "unisdp_sso", "UniSDP单点登录失败", req, error, {
      ...诊断字段,
      failedStep: 失败阶段,
    });
    next(error);
  }
}

async function 处理UniSdp门户单点登录(
  req: Request,
  res: {
    setHeader(name: string, value: string): void;
    redirect(status: number, url: string): void;
    send(body: string): void;
  },
  next: (error?: unknown) => void,
  配置: 认证配置,
): Promise<void> {
  const 诊断字段 = 读取UniSdp单点登录诊断(req, 配置);
  let 失败阶段 = "request";
  记录认证事件(配置, "info", "UniSDP门户单点登录开始", {
    event: "auth.unisdp_portal_sso.started",
    ...读取认证请求字段(req),
    ...诊断字段,
  });
  try {
    if (!配置.enabled) throw new 应用错误("V3_AUTH_DISABLED", "登录入口未启用。", 503);
    const token = 读取UniSdp单点凭证(req);
    失败阶段 = "provider";
    记录认证事件(配置, "info", "UniSDP门户单点登录开始调用认证服务", {
      event: "auth.unisdp_portal_sso.provider_started",
      ...读取认证请求字段(req),
      ...诊断字段,
      timeoutMs: 配置.uniSdpSso.timeoutMs,
      validateUrlConfigured: Boolean(配置.uniSdpSso.validateUrl),
      isaidFingerprint: 创建认证指纹(配置.uniSdpSso.isaid, 配置, "unisdp-isaid"),
      isaidLength: 配置.uniSdpSso.isaid.length,
    });
    const uniSdp身份 = await 校验UniSdp单点登录凭证(token, 配置.uniSdpSso);
    失败阶段 = "local_user";
    记录认证事件(配置, "info", "UniSDP门户单点登录认证服务校验通过", {
      event: "auth.unisdp_portal_sso.provider_succeeded",
      ...读取认证请求字段(req),
      ...读取UniSdp身份日志字段(uniSdp身份, 配置),
      resultCode: "success",
    });
    const 本地匹配 = await 查找并匹配单点登录用户(
      { username: uniSdp身份.username, rawUsername: uniSdp身份.rawUsername, mobile: uniSdp身份.mobile },
      配置,
    );
    if (!本地匹配) {
      const 形态 = 判定单点登录值形态(uniSdp身份.mobile || uniSdp身份.username);
      throw new 应用错误(
        形态 === "partner_phone"
          ? "V3_AUTH_SSO_PARTNER_NOT_FOUND"
          : "V3_AUTH_SSO_USER_NOT_FOUND",
        形态 === "partner_phone"
          ? "CRM 未开通该渠道手机号对应的账号,请联系管理员。"
          : "CRM 未开通该单点登录账号。",
        403,
      );
    }
    const 用户 = 本地匹配.用户;

    const sessionToken = 签发会话令牌(用户.username, 用户.pageUser.role, 配置);
    const 页面会话 = 创建业务页面会话(用户);
    // 门户落点严格按形态:手机号→partner 入口,username→admin 入口。
    const 目标路径 = 本地匹配.匹配方式 === "partner_phone" ? "/partner.html" : "/admin.html";
    写入会话Cookie(res, 配置, sessionToken);
    记录认证事件(配置, "info", "UniSDP门户单点登录成功", {
      event: "auth.unisdp_portal_sso.succeeded",
      ...读取认证请求字段(req),
      ...诊断字段,
      username: 用户.username,
      displayName: 用户.displayName,
      roleName: 用户.roleName,
      uniSdpLocalUserMatchMode: 本地匹配.匹配方式,
      targetPath: 目标路径,
      defaultPath: 用户.defaultPath,
      allowedPathCount: 用户.allowedPaths.length,
      sessionTokenFingerprint: 创建认证指纹(sessionToken, 配置, "auth-session"),
      pageSessionTokenFingerprint: 创建认证指纹(页面会话.token, 配置, "page-session"),
      sessionCookieWritten: true,
      cookieSecure: 配置.cookieSecure,
      ttlSeconds: 配置.ttlSeconds,
      ...读取UniSdp手机号日志字段(uniSdp身份, 配置),
      resultCode: "success",
    });
    发送门户登录完成页(res, 页面会话, 目标路径);
  } catch (error) {
    if (error instanceof 应用错误) {
      记录认证失败(配置, "unisdp_portal_sso", "UniSDP门户单点登录失败", req, error, {
        ...诊断字段,
        failedStep: 失败阶段,
        fallbackRedirect: "/login?ssoFallback=1&provider=unisdp",
        sessionCookieCleared: true,
      });
      清理会话Cookie(res, 配置);
      res.redirect(302, "/login?ssoFallback=1&provider=unisdp");
      return;
    }
    记录认证失败(配置, "unisdp_portal_sso", "UniSDP门户单点登录异常", req, error, {
      ...诊断字段,
      failedStep: 失败阶段,
    });
    next(error);
  }
}

function 读取UniSdp单点凭证(req: Request): string {
  const body = 转为请求对象(req.body);
  const query = 转为请求对象(req.query);
  const token =
    读取请求文本(body, ["sso_token", "ssoToken", "ssotoken", "token", "code"]) ||
    读取请求文本(query, ["sso_token", "ssoToken", "ssotoken", "token", "code"]);
  if (!token) {
    throw new 应用错误("V3_AUTH_UNISDP_SSO_BAD_REQUEST", "缺少 UniSDP 单点登录凭证。", 400);
  }
  return token;
}

function 读取单点登录请求(
  req: Request,
  固定入口?: 单点登录入口,
): { token: string; entry: 单点登录入口 | null; clientType: string } {
  const body = req.body as Record<string, unknown>;
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const entry = 固定入口 || 解析单点登录入口(body.entry || body.scope || body.入口);
  const clientType = typeof body.clientType === "string" ? body.clientType.trim() : "";
  if (!token) {
    throw new 应用错误("V3_AUTH_SSO_BAD_REQUEST", "缺少单点登录凭证。", 400);
  }
  return { token, entry, clientType };
}

function 选择单点登录校验入口(entry: 单点登录入口 | null, 配置: IamH5单点登录配置): 单点登录入口 {
  if (entry) return entry;
  const 管理员标识 = 配置.validateIsaidByEntry.admin.trim();
  const 渠道标识 = 配置.validateIsaidByEntry.partner.trim();
  if (管理员标识 && 渠道标识 && 管理员标识 !== 渠道标识) {
    throw new 应用错误(
      "V3_AUTH_SSO_BAD_REQUEST",
      "统一单点登录缺少入口，且管理员/渠道 IAM 校验标识不一致。",
      400,
    );
  }
  return 管理员标识 ? "admin" : "partner";
}

function 允许进入工作区(用户: 交付用户, entry: 单点登录入口): boolean {
  const prefix = entry === "admin" ? "/admin" : "/partner";
  return 用户.allowedPaths.some((path) => path === prefix || path.startsWith(prefix + "/"));
}

function 读取登录请求(req: Request): { username: string; password: string } {
  const body = req.body as Record<string, unknown>;
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!username || !password) {
    throw new 应用错误("V3_AUTH_BAD_REQUEST", "请输入用户名和密码。", 400);
  }
  return { username, password };
}

function 转为请求对象(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function 读取请求文本(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim())
      return value[0].trim();
  }
  return "";
}

function 记录认证事件(
  配置: 认证配置,
  level: "info" | "warn" | "error",
  message: string,
  fields: 日志字段,
): void {
  配置.logger?.[level](message, fields);
  记录认证流程摘要(配置, message, fields);
}

function 记录认证流程摘要(配置: 认证配置, message: string, fields: 日志字段): void {
  if (!配置.authFlowLogger) return;
  const line = 创建认证流程摘要行(message, fields);
  if (!line) return;
  try {
    配置.authFlowLogger.write(line);
  } catch {
    // 摘要日志只用于排障，写入失败不能影响认证主流程。
  }
}

function 创建认证流程摘要行(message: string, fields: 日志字段): string {
  const event = 读取日志字段文本(fields, "event");
  if (!event.startsWith("auth.")) return "";
  const 时间 = 格式化本地日志时间(new Date());
  const 流程 = 读取认证流程名称(event);
  const 端 = 读取认证端名称(event, fields);
  const 阶段 = 读取认证阶段名称(event, fields);
  const 摘要 = 创建认证摘要文本(event, message, fields);
  const 详情 = JSON.stringify(创建认证摘要字段(fields));
  return `[${时间}] [${流程}] [全流程] [${端}] [${阶段}] ${摘要} ${详情}`;
}

function 读取认证流程名称(event: string): string {
  if (event.startsWith("auth.iam_sso.")) return "IAM-SSO";
  if (event.startsWith("auth.unisdp_portal_sso.")) return "UNISDP-PORTAL-SSO";
  if (event.startsWith("auth.unisdp_sso.")) return "UNISDP-SSO";
  if (event.startsWith("auth.password.")) return "PASSWORD";
  if (event.startsWith("auth.session.")) return "SESSION";
  if (event.startsWith("auth.logout.")) return "LOGOUT";
  if (event.startsWith("auth.open_api_token.")) return "OPENAPI-AUTH";
  if (event.startsWith("auth.open_api_session.")) return "OPENAPI-SESSION";
  return "AUTH";
}

function 读取认证端名称(event: string, fields: 日志字段): string {
  const entry = 读取日志字段文本(fields, "entry");
  if (entry === "admin") return "管理端";
  if (entry === "partner") return "渠道端";
  if (读取日志字段文本(fields, "clientType") === "mobile") return "移动端";
  const path = 读取日志字段文本(fields, "path");
  if (path === "/app/sso.htm") return "门户入口";
  if (path.includes("/sso/")) return "统一登录";
  const roleName = 读取日志字段文本(fields, "roleName");
  if (/超管|超级|管理员|区管/.test(roleName)) return "管理端";
  if (/渠道|销售|伙伴|员工/.test(roleName)) return "渠道端";
  if (event.startsWith("auth.open_api_")) return "开放接口";
  return "认证";
}

function 读取认证阶段名称(event: string, fields: 日志字段): string {
  if (event.endsWith(".provider_started")) return "调用认证服务";
  if (event.endsWith(".provider_succeeded")) return "认证服务校验通过";
  if (event.endsWith(".failed")) return 读取失败阶段名称(读取日志字段文本(fields, "failedStep"));
  if (event === "auth.session.started") return "会话校验开始";
  if (event === "auth.session.succeeded") return "会话校验成功";
  if (event === "auth.password.started") return "账号密码登录开始";
  if (event === "auth.password.succeeded") return "账号密码登录成功";
  if (event === "auth.logout.completed") return "退出完成";
  if (event.endsWith(".started")) return "开始";
  if (event.endsWith(".succeeded")) return "登录成功";
  return "过程";
}

function 读取失败阶段名称(failedStep: string): string {
  const 映射: Record<string, string> = {
    request: "请求参数失败",
    provider: "第三方认证失败",
    local_user: "本地账号匹配失败",
    client_lookup: "客户端查询失败",
    client_status: "客户端状态失败",
    ip_whitelist: "IP白名单失败",
    secret_verify: "密钥校验失败",
    issue_token: "令牌签发失败",
    session: "会话校验失败",
  };
  return 映射[failedStep] || "认证失败";
}

function 创建认证摘要文本(event: string, message: string, fields: 日志字段): string {
  if (event.endsWith(".failed")) {
    return 清理摘要文本(`${message}：${读取日志字段文本(fields, "errorMessage") || "原因未知"}`);
  }
  if (event.startsWith("auth.iam_sso.") && event.endsWith(".provider_succeeded")) {
    const username = 创建账号展示文本(读取日志字段文本(fields, "iamUsername")) || "未知账号";
    const displayName = 读取日志字段文本(fields, "iamDisplayName");
    return 清理摘要文本(`IAM返回账号：${username}${displayName ? "，姓名：" + displayName : ""}`);
  }
  if (
    (event.startsWith("auth.unisdp_sso.") || event.startsWith("auth.unisdp_portal_sso.")) &&
    event.endsWith(".provider_succeeded")
  ) {
    const username = 创建账号展示文本(读取日志字段文本(fields, "uniSdpUsername")) || "未知账号";
    const mobile = 读取日志字段布尔(fields, "uniSdpMobilePresent")
      ? 读取日志字段文本(fields, "uniSdpMobileMasked") || "已返回"
      : "未返回";
    return 清理摘要文本(`UniSDP返回账号：${username}，手机号：${mobile}`);
  }
  if (event.endsWith(".succeeded")) {
    const username = 创建账号展示文本(读取日志字段文本(fields, "username"));
    const roleName = 读取日志字段文本(fields, "roleName");
    const entry = 读取日志字段文本(fields, "entry");
    const matchMode = 读取日志字段文本(fields, "uniSdpLocalUserMatchMode");
    const parts = [
      username ? `本地账号：${username}` : "",
      roleName ? `角色：${roleName}` : "",
      entry ? `入口：${entry}` : "",
      matchMode ? `匹配方式：${matchMode}` : "",
    ].filter(Boolean);
    return 清理摘要文本(parts.length ? parts.join("，") : message);
  }
  if (event.endsWith(".started")) {
    const hasToken = 读取日志字段布尔(fields, "ssoTokenPresent");
    const tokenText = "ssoTokenPresent" in fields ? `，凭证：${hasToken ? "已带" : "未带"}` : "";
    const source = 读取日志字段文本(fields, "inputSource");
    return 清理摘要文本(`${message}${tokenText}${source ? "，来源：" + source : ""}`);
  }
  return 清理摘要文本(message);
}

function 创建认证摘要字段(fields: 日志字段): 日志字段 {
  const keys = [
    "requestId",
    "event",
    "method",
    "path",
    "route",
    "queryKeys",
    "bodyKeys",
    "entry",
    "clientType",
    "provider",
    "inputSource",
    "failedStep",
    "errorCode",
    "errorMessage",
    "statusCode",
    "resultCode",
    "username",
    "usernamePresent",
    "displayName",
    "roleName",
    "passwordPresent",
    "passwordLength",
    "passwordFingerprint",
    "iamUsername",
    "iamRawUsername",
    "iamDisplayName",
    "uniSdpUsername",
    "uniSdpRawUsername",
    "uniSdpUsernameLooksLikePhone",
    "uniSdpMobilePresent",
    "uniSdpMobileLength",
    "uniSdpMobileMasked",
    "uniSdpMobileFingerprint",
    "uniSdpLocalUserMatchMode",
    "ssoTokenPresent",
    "ssoTokenLength",
    "ssoTokenFingerprint",
    "sessionCookiePresent",
    "sessionTokenLength",
    "sessionTokenFingerprint",
    "sessionCookieWritten",
    "sessionCookieCleared",
    "pageSessionTokenFingerprint",
    "cookieSecure",
    "ttlSeconds",
    "defaultPath",
    "targetPath",
    "fallbackRedirect",
    "allowedPathCount",
    "timeoutMs",
    "validateUrlConfigured",
    "validateIsaidFingerprint",
    "validateIsaidLength",
    "isaidFingerprint",
    "isaidLength",
    "appKey",
    "appKeyPresent",
    "appSecretPresent",
    "appSecretLength",
    "appSecretFingerprint",
    "accessTokenLength",
    "accessTokenFingerprint",
    "expiresInSeconds",
    "allowedResourceCount",
    "durationMs",
    "ip",
    "userAgent",
  ];
  const 详情: 日志字段 = {};
  for (const key of keys) {
    if (!(key in fields)) continue;
    const value = fields[key];
    if (typeof value === "string") 详情[key] = 清理摘要字段文本(key, value);
    else if (typeof value === "number" || typeof value === "boolean") 详情[key] = value;
    else if (Array.isArray(value)) 详情[key] = value.map((项) => 清理摘要文本(String(项), 120));
  }
  return 详情;
}

function 清理摘要字段文本(key: string, value: string): string {
  const 文本 = 清理摘要文本(value, 300);
  return 是账号摘要字段(key) ? 创建账号展示文本(文本) : 文本;
}

const 账号摘要字段 = new Set([
  "username",
  "displayName",
  "iamUsername",
  "iamRawUsername",
  "iamDisplayName",
  "uniSdpUsername",
  "uniSdpRawUsername",
]);

function 是账号摘要字段(key: string): boolean {
  return 账号摘要字段.has(key);
}

function 创建账号展示文本(value: string): string {
  const 手机号 = 规范中国大陆手机号(value);
  return 手机号 ? 脱敏手机号(手机号) : value;
}

function 读取日志字段文本(fields: 日志字段, key: string): string {
  const value = fields[key];
  return typeof value === "string" ? value : "";
}

function 读取日志字段布尔(fields: 日志字段, key: string): boolean {
  return fields[key] === true;
}

function 清理摘要文本(value: string, maxLength = 500): string {
  const 文本 = value.replace(/[\r\n\t]+/g, " ").trim();
  return 文本.length > maxLength ? 文本.slice(0, maxLength) + "..." : 文本;
}

function 格式化本地日志时间(date: Date): string {
  const year = date.getFullYear();
  const month = 补零(date.getMonth() + 1);
  const day = 补零(date.getDate());
  const hour = 补零(date.getHours());
  const minute = 补零(date.getMinutes());
  const second = 补零(date.getSeconds());
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function 补零(value: number): string {
  return String(value).padStart(2, "0");
}

function 记录认证失败(
  配置: 认证配置,
  流程: string,
  message: string,
  req: Request,
  error: unknown,
  fields: 日志字段 = {},
): void {
  const 应用级错误 = error instanceof 应用错误 ? error : null;
  const statusCode = 应用级错误?.statusCode || 500;
  记录认证事件(配置, statusCode >= 500 ? "error" : "warn", message, {
    event: "auth." + 流程 + ".failed",
    ...读取认证请求字段(req),
    ...fields,
    errorCode: 应用级错误?.code || "V3_AUTH_INTERNAL_ERROR",
    errorMessage: error instanceof Error ? error.message : "认证失败，原因未知。",
    statusCode,
    resultCode: "failed",
  });
}

function 读取认证请求字段(req: Request): 日志字段 {
  return {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    route: 读取认证匹配路由(req),
    queryKeys: Object.keys(req.query).sort(),
    bodyKeys: Object.keys(转为请求对象(req.body)).sort(),
    ip: 读取客户端IP(req),
    userAgent: req.get("user-agent") || "",
    referer: req.get("referer") || "",
  };
}

function 读取账号密码登录诊断(req: Request, 配置: 认证配置): 日志字段 {
  const body = 转为请求对象(req.body);
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  return {
    authEnabled: 配置.enabled,
    username,
    usernamePresent: Boolean(username),
    passwordPresent: Boolean(password),
    passwordLength: password.length,
    passwordFingerprint: 创建认证指纹(password, 配置, "password"),
  };
}

function 读取Iam单点登录诊断(req: Request, 配置: 认证配置, 固定入口?: 单点登录入口): 日志字段 {
  const body = 转为请求对象(req.body);
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const entry = 固定入口 || 解析单点登录入口(body.entry || body.scope || body.入口);
  const clientType = typeof body.clientType === "string" ? body.clientType.trim() : "";
  return {
    authEnabled: 配置.enabled,
    ssoEnabled: 配置.sso.enabled,
    entry: entry || "",
    fixedEntry: 固定入口 || "",
    clientType,
    ssoTokenPresent: Boolean(token),
    ssoTokenLength: token.length,
    ssoTokenFingerprint: 创建认证指纹(token, 配置, "iam-sso-token"),
  };
}

function 读取UniSdp单点登录诊断(req: Request, 配置: 认证配置): 日志字段 {
  const 凭证 = 读取UniSdp单点凭证诊断(req);
  return {
    authEnabled: 配置.enabled,
    ssoEnabled: 配置.uniSdpSso.enabled,
    provider: "unisdp",
    inputSource: 凭证.source,
    ssoTokenPresent: Boolean(凭证.token),
    ssoTokenLength: 凭证.token.length,
    ssoTokenFingerprint: 创建认证指纹(凭证.token, 配置, "unisdp-sso-token"),
  };
}

function 读取UniSdp身份日志字段(身份: UniSdp单点登录身份, 配置: 认证配置): 日志字段 {
  const 原始用户名 = 身份.rawUsername || 身份.username;
  const 用户名手机号 = 规范中国大陆手机号(原始用户名);
  return {
    uniSdpUsername: 用户名手机号 ? 脱敏手机号(用户名手机号) : 身份.username,
    uniSdpRawUsername: 用户名手机号 ? 脱敏手机号(用户名手机号) : 身份.rawUsername,
    uniSdpUsernameLooksLikePhone: Boolean(用户名手机号),
    uniSdpUsernameFingerprint: 创建认证指纹(原始用户名, 配置, "unisdp-username"),
    ...读取UniSdp手机号日志字段(身份, 配置),
  };
}

function 读取UniSdp手机号日志字段(身份: UniSdp单点登录身份, 配置: 认证配置): 日志字段 {
  const mobile = 身份.mobile || 身份.rawMobile;
  return {
    uniSdpMobilePresent: Boolean(mobile),
    uniSdpMobileLength: mobile.length,
    uniSdpMobileMasked: 脱敏手机号(mobile),
    uniSdpMobileFingerprint: 创建认证指纹(mobile, 配置, "unisdp-mobile"),
  };
}

function 读取UniSdp单点凭证诊断(req: Request): { token: string; source: string } {
  const body = 转为请求对象(req.body);
  const query = 转为请求对象(req.query);
  const bodyToken = 读取请求文本(body, ["sso_token", "ssoToken", "ssotoken", "token", "code"]);
  if (bodyToken) return { token: bodyToken, source: "body" };
  const queryToken = 读取请求文本(query, ["sso_token", "ssoToken", "ssotoken", "token", "code"]);
  if (queryToken) return { token: queryToken, source: "query" };
  return { token: "", source: "" };
}

function 读取会话诊断(req: Request, 配置: 认证配置): 日志字段 {
  const token = 读取Cookie(req, 配置.cookieName) || "";
  return {
    authEnabled: 配置.enabled,
    sessionCookiePresent: Boolean(token),
    sessionTokenLength: token.length,
    sessionTokenFingerprint: 创建认证指纹(token, 配置, "auth-session"),
  };
}

function 创建认证指纹(value: string, 配置: 认证配置, purpose: string): string {
  if (!value) return "";
  return crypto
    .createHmac("sha256", 配置.sessionSecret)
    .update("log-fingerprint:")
    .update(purpose)
    .update(":")
    .update(value)
    .digest("hex")
    .slice(0, 16);
}

function 脱敏手机号(value: string): string {
  if (!value) return "";
  if (value.length <= 4) return "*".repeat(value.length);
  if (value.length <= 7) return value.slice(0, 1) + "****" + value.slice(-2);
  return value.slice(0, 3) + "****" + value.slice(-4);
}

function 读取客户端IP(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim())
    return forwarded.split(",")[0]?.trim() || "";
  return req.ip || req.socket.remoteAddress || "";
}

function 读取认证匹配路由(req: Request): string {
  const 路由 = req.route as { path?: string } | undefined;
  if (!路由?.path) return "";
  if (typeof 路由.path === "string") return 路由.path;
  return "";
}

function 解析交付用户(value: string | undefined): 交付用户[] {
  if (!value) return [];
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed))
    throw new 应用错误("V3_AUTH_CONFIG_INVALID", "交付账号配置格式不正确。", 500);
  return parsed.map((item) => {
    const 用户 = item as Partial<交付用户> & { phone?: string };
    if (
      !用户.username ||
      !用户.displayName ||
      !用户.roleName ||
      !用户.passwordHash ||
      !用户.defaultPath ||
      !Array.isArray(用户.allowedPaths)
    ) {
      throw new 应用错误("V3_AUTH_CONFIG_INVALID", "交付账号配置字段不完整。", 500);
    }
    // 应急账号未声明 roleCodes 时,按 allowedPaths 推断主身份:
    // 含 /admin 视为管理员,否则视为渠道用户。保留旧调用方不感知。
    const 显式角色 = Array.isArray(用户.roleCodes) ? 用户.roleCodes.filter(Boolean) : null;
    const 推断角色 = 用户.allowedPaths.some((p) => p === "/admin" || p.startsWith("/admin/"))
      ? ["admin"]
      : ["staff"];
    const roleCodes = 显式角色 && 显式角色.length > 0 ? 显式角色 : 推断角色;
    const 标准用户 = {
      username: 用户.username,
      displayName: 用户.displayName,
      roleName: 用户.roleName,
      passwordHash: 用户.passwordHash,
      defaultPath: 用户.defaultPath,
      allowedPaths: 用户.allowedPaths,
      roleCodes,
    };
    return { ...标准用户, pageUser: 创建配置业务页面用户(标准用户) };
  });
}

function 解析正整数(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function 签发会话令牌(username: string, role: 业务页面角色, 配置: 认证配置): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: 会话载荷 = {
    username,
    role,
    issuedAt: now,
    expiresAt: now + 配置.ttlSeconds,
    nonce: crypto.randomBytes(16).toString("base64url"),
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return body + "." + 签名(body, 配置.sessionSecret);
}

async function 读取当前用户(req: Request, 配置: 认证配置): Promise<交付用户> {
  const token = 读取Cookie(req, 配置.cookieName);
  if (!token) throw new 应用错误("V3_AUTH_REQUIRED", "请先登录。", 401);
  const payload = 解析会话令牌(token, 配置.sessionSecret);
  if (payload.expiresAt <= Math.floor(Date.now() / 1000)) {
    throw new 应用错误("V3_AUTH_EXPIRED", "登录已过期，请重新登录。", 401);
  }
  const 用户 = await 查找可登录用户(payload.username, 配置);
  if (!用户) throw new 应用错误("V3_AUTH_REQUIRED", "请先登录。", 401);
  return 用户;
}

async function 查找可登录用户(username: string, 配置: 认证配置): Promise<交付用户 | null> {
  const 数据库用户 = await 查询数据库用户(username, 配置);
  if (数据库用户) return 数据库用户;
  return 配置.users.find((项) => 项.username.toLowerCase() === username.toLowerCase()) || null;
}

type 单点登录值形态 = "partner_phone" | "admin_username" | "unknown";

function 判定单点登录值形态(value: string): 单点登录值形态 {
  const 数字串 = String(value || "").replace(/\D+/g, "");
  if (/^1\d{10}$/.test(数字串)) return "partner_phone";
  if (String(value || "").trim()) return "admin_username";
  return "unknown";
}

function 是管理员账号(用户: 交付用户): boolean {
  const 角色 = Array.isArray(用户.roleCodes) ? 用户.roleCodes : [];
  return 角色.includes("superadmin") || 角色.includes("admin");
}

async function 查找并匹配单点登录用户(
  身份: { username: string; rawUsername?: string; mobile?: string },
  配置: 认证配置,
): Promise<单点登录本地匹配结果 | null> {
  // UniSDP 同时给 mobile 与 username;IAM 只给 username。形态判定统一用 mobile 优先(更精确),
  // 否则回退到 username。IAM/UniSDP 对渠道用户的 username 即手机号本身,因此形态为 partner_phone。
  const 候选 = (身份.mobile && String(身份.mobile).trim()) || 身份.username;
  const 形态 = 判定单点登录值形态(候选);
  if (形态 === "unknown") return null;

  if (形态 === "partner_phone") {
    const 渠道手机号用户 = await 查询渠道手机号用户(规范中国大陆手机号(候选) || 候选, 配置);
    if (渠道手机号用户) return { 用户: 渠道手机号用户, 匹配方式: "partner_phone" };
    return null;
  }

  // admin_username:必须命中且具备管理员角色(超管/admin)。严格切分避免渠道账号 username 撞管理员。
  const 用户名用户 = await 查找可登录用户(身份.username, 配置);
  if (!用户名用户) return null;
  if (!是管理员账号(用户名用户)) return null;
  return { 用户: 用户名用户, 匹配方式: "username" };
}


async function 查找并校验用户(
  username: string,
  password: string,
  配置: 认证配置,
): Promise<交付用户 | null> {
  const 数据库用户 = await 查询数据库用户(username, 配置);
  if (数据库用户 && (await 校验密码(password, 数据库用户.passwordHash))) return 数据库用户;
  const 应急用户 =
    配置.users.find((项) => 项.username.toLowerCase() === username.toLowerCase()) || null;
  if (应急用户 && (await 校验密码(password, 应急用户.passwordHash))) return 应急用户;
  return null;
}

async function 查询数据库用户(username: string, 配置: 认证配置): Promise<交付用户 | null> {
  if (!配置.pool) return null;
  try {
    const rows = await 查询数据库用户行(配置, "lower(u.username::text) = lower($1)", [username], 1);
    return 从数据库行创建交付用户(rows[0]);
  } catch {
    return null;
  }
}

async function 查询渠道手机号用户(mobile: string, 配置: 认证配置): Promise<交付用户 | null> {
  if (!配置.pool) return null;
  // KB-022:sso-optimize
  // 优先匹配 iam.users.phone(走 ux_users_phone_normalized_unique 唯一索引,生产期间一致);
  // 当 phone 为空时,按历史兼容顺序回退到 extra_json.phone / extra_json.mobile /
  // extra_json.mobilePhone / extra_json.phoneNumber,覆盖迁移期账号。
  // 注意:extra_json 兜底不享有数据库唯一约束;若命中多条(脏数据),由下方
  // V3_AUTH_SSO_PARTNER_PHONE_NOT_UNIQUE 抛错兜底,等同于运行时自检。
  const 手机候选 = `
    COALESCE(
      NULLIF(u.phone, ''),
      NULLIF(u.extra_json->>'phone', ''),
      NULLIF(u.extra_json->>'mobile', ''),
      NULLIF(u.extra_json->>'mobilePhone', ''),
      NULLIF(u.extra_json->>'phoneNumber', ''),
      ''
    )
  `;
  try {
    const rows = await 查询数据库用户行(
      配置,
      `
      length(${手机候选}) >= 11
        AND right(regexp_replace(${手机候选}, '\\D+', '', 'g'), 11) = $1
        AND (
          EXISTS (
            SELECT 1
            FROM iam.user_roles ur2
            JOIN iam.roles r2 ON r2.id = ur2.role_id AND r2.status_code = 'active'
            WHERE ur2.user_id = u.id
              AND r2.role_code IN ('partner_admin', 'staff')
          )
          OR EXISTS (
            SELECT 1
            FROM channel.partner_members pm2
            WHERE pm2.user_id = u.id
              AND pm2.status_code = 'active'
          )
        )
      `,
      [mobile],
      2,
    );
    const 可登录用户 = rows.map(从数据库行创建交付用户).filter((用户) => 用户 !== null);
    if (可登录用户.length > 1) {
      throw new 应用错误(
        "V3_AUTH_SSO_PARTNER_PHONE_NOT_UNIQUE",
        "CRM 中存在多个渠道账号使用同一手机号，请先处理账号手机号唯一性。",
        409,
      );
    }
    return 可登录用户[0] || null;
  } catch (error) {
    if (error instanceof 应用错误) throw error;
    return null;
  }
}


async function 查询数据库用户行(
  配置: 认证配置,
  whereSql: string,
  params: unknown[],
  limit: 1 | 2,
): Promise<数据库用户行[]> {
  if (!配置.pool) return [];
  const result = await 配置.pool.query<数据库用户行>(
    `
    SELECT
      u.id::text AS id,
      u.v2_source_id,
      u.username::text AS username,
      u.display_name::text AS display_name,
      pc.password_hash,
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
        '渠道用户'
      ) AS role_name,
      array_agg(DISTINCT r.role_code) FILTER (WHERE r.role_code IS NOT NULL) AS role_codes,
      u.phone,
      reg.region_name,
      u.extra_json,
      COALESCE(
        u.extra_json->>'partnerId',
        (array_agg(COALESCE(p.v2_source_id, p.partner_code, p.id::text))
          FILTER (WHERE p.id IS NOT NULL))[1],
        ''
      ) AS partner_id,
      COALESCE(
        u.extra_json->>'partnerName',
        (array_agg(p.partner_name) FILTER (WHERE p.partner_name IS NOT NULL))[1],
        ''
      ) AS partner_name
    FROM iam.users u
    LEFT JOIN iam.password_credentials pc ON pc.user_id = u.id
    LEFT JOIN iam.user_roles ur ON ur.user_id = u.id
    LEFT JOIN iam.roles r ON r.id = ur.role_id AND r.status_code = 'active'
    LEFT JOIN org.regions reg ON reg.id = u.region_id
    LEFT JOIN channel.partner_members pm ON pm.user_id = u.id
    LEFT JOIN channel.partners p ON p.id = pm.partner_id
    WHERE (${whereSql})
      AND u.status_code = 'active'
    GROUP BY u.id, u.v2_source_id, u.username, u.display_name, pc.password_hash,
      reg.region_name, u.extra_json, u.phone
    LIMIT ${limit}
    `,
    params,
  );
  return result.rows;
}

function 从数据库行创建交付用户(row: 数据库用户行 | undefined): 交付用户 | null {
  if (!row?.password_hash) return null;
  const roleCode = row.role_code || "staff";
  const pageUser = 创建数据库业务页面用户(row, roleCode);
  return {
    username: row.username,
    displayName: row.display_name || row.username,
    roleName: row.role_name || 转角色名称(roleCode),
    passwordHash: row.password_hash,
    defaultPath: 角色默认路径(roleCode),
    allowedPaths: 角色允许路径(roleCode),
    pageUser,
    roleCodes: Array.isArray(row.role_codes) ? row.role_codes.filter(Boolean) : [],
  };
}

function 规范中国大陆手机号(value: string): string {
  const digits = value.replace(/\D+/g, "");
  const 手机号 = digits.length === 13 && digits.startsWith("86") ? digits.slice(2) : digits;
  return /^1\d{10}$/.test(手机号) ? 手机号 : "";
}


function 创建配置业务页面用户(用户: {
  username: string;
  displayName: string;
  roleName: string;
  defaultPath: string;
  allowedPaths: string[];
}): 业务页面用户 {
  const role = 识别配置业务页面角色(用户);
  return {
    id: 用户.username,
    userId: 用户.username,
    username: 用户.username,
    name: 用户.displayName,
    displayName: 用户.displayName,
    role,
    roleName: 用户.roleName,
    status: "active",
    region: "",
    bigRegion: "",
    partnerId: "",
    partnerName: "",
  };
}

function 创建数据库业务页面用户(
  row: {
    id: string;
    v2_source_id: string | null;
    username: string;
    display_name: string;
    role_name: string | null;
    region_name: string | null;
    extra_json: Record<string, unknown> | null;
    partner_id: string | null;
    partner_name: string | null;
  },
  roleCode: string,
): 业务页面用户 {
  const extra = row.extra_json || {};
  const id = 读取扩展文本(extra, "id") || row.v2_source_id || row.id;
  const name = 读取扩展文本(extra, "name") || row.display_name || row.username;
  const role = 转业务页面角色(roleCode);
  return {
    ...extra,
    id,
    userId: id,
    username: row.username,
    name,
    displayName: row.display_name || name,
    role,
    roleName: row.role_name || 转业务页面角色名称(role),
    status: "active",
    region: 读取扩展文本(extra, "region") || row.region_name || "",
    bigRegion: 读取扩展文本(extra, "bigRegion"),
    partnerId: 读取扩展文本(extra, "partnerId") || row.partner_id || "",
    partnerName: 读取扩展文本(extra, "partnerName") || row.partner_name || "",
  };
}

function 创建业务页面会话(用户: 交付用户): 业务页面会话 {
  return {
    token: 签发业务页面令牌(用户.username),
    user: 用户.pageUser,
  };
}

function 创建移动端会话(用户: 交付用户, 配置: 认证配置): 移动端会话 {
  return {
    token: 签发移动端会话令牌(用户.pageUser, 配置),
    user: 用户.pageUser,
  };
}

function 签发移动端会话令牌(用户: 业务页面用户, 配置: 认证配置): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: 移动端会话载荷 = {
    username: 用户.username,
    role: 用户.role,
    issuedAt: now,
    expiresAt: now + 配置.ttlSeconds,
    nonce: crypto.randomBytes(16).toString("base64url"),
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return ["v3m", body, 签名(`v3m.${body}`, 配置.sessionSecret)].join(".");
}

export function 读取移动端会话身份(
  req: Request,
  参数: 会话用户名读取参数 | undefined,
): Pick<移动端会话载荷, "username" | "role"> | null {
  if (!参数?.sessionSecret) return null;
  const header = req.headers.authorization || "";
  const token = /^Bearer\s+(.+)$/i.exec(header)?.[1]?.trim();
  if (!token) return null;
  try {
    const payload = 解析移动端会话令牌(token, 参数.sessionSecret);
    if (payload.expiresAt <= Math.floor(Date.now() / 1000)) return null;
    return { username: payload.username, role: payload.role };
  } catch {
    return null;
  }
}

export function 读取移动端会话用户名(req: Request, 参数: 会话用户名读取参数 | undefined): string {
  return 读取移动端会话身份(req, 参数)?.username || "";
}

function 解析移动端会话令牌(token: string, secret: string): 移动端会话载荷 {
  const [version, body, signature] = token.split(".");
  if (
    version !== "v3m" ||
    !body ||
    !signature ||
    !安全比较(signature, 签名(`v3m.${body}`, secret))
  ) {
    throw new 应用错误("V3_AUTH_REQUIRED", "请先登录。", 401);
  }
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as 移动端会话载荷;
  if (
    !payload.username ||
    !payload.expiresAt ||
    !["superadmin", "admin", "partner_admin", "staff"].includes(payload.role)
  ) {
    throw new 应用错误("V3_AUTH_REQUIRED", "请先登录。", 401);
  }
  return payload;
}

function 签发业务页面令牌(username: string): string {
  return [
    "v2",
    Buffer.from(username, "utf8").toString("base64url"),
    crypto.randomBytes(24).toString("base64url"),
  ].join(".");
}

function 识别配置业务页面角色(用户: {
  roleName: string;
  defaultPath: string;
  allowedPaths: string[];
}): 业务页面角色 {
  const 默认管理端 = 用户.defaultPath === "/admin" || 用户.defaultPath.startsWith("/admin/");
  const 可进入管理端 = 用户.allowedPaths.some(
    (path) => path === "/admin" || path.startsWith("/admin/"),
  );
  if (默认管理端 || 可进入管理端) {
    return 用户.roleName.includes("超级") ? "superadmin" : "admin";
  }
  return 用户.roleName.includes("管理") ? "partner_admin" : "staff";
}

function 转业务页面角色(roleCode: string): 业务页面角色 {
  if (roleCode === "superadmin") return "superadmin";
  if (roleCode === "admin" || roleCode === "region_manager") return "admin";
  if (roleCode === "partner_admin") return "partner_admin";
  return "staff";
}

function 转业务页面角色名称(role: 业务页面角色): string {
  const 映射: Record<业务页面角色, string> = {
    superadmin: "超级管理员",
    admin: "管理员",
    partner_admin: "渠道管理员",
    staff: "渠道用户",
  };
  return 映射[role];
}

function 读取扩展文本(extra: Record<string, unknown>, key: string): string {
  const value = extra[key];
  return typeof value === "string" ? value.trim() : "";
}

function 转角色名称(roleCode: string): string {
  const 映射: Record<string, string> = {
    superadmin: "超级管理员",
    admin: "管理员",
    region_manager: "区域管理员",
    partner_admin: "渠道管理员",
    staff: "渠道用户",
  };
  return 映射[roleCode] || "渠道用户";
}

function 角色默认路径(roleCode: string): string {
  if (roleCode === "partner_admin" || roleCode === "staff") return "/partner/dashboard";
  return "/admin/dashboard";
}

function 角色允许路径(roleCode: string): string[] {
  if (roleCode === "partner_admin" || roleCode === "staff")
    return ["/unified", "/partner", "/mobile"];
  return ["/unified", "/admin", "/partner", "/mobile"];
}

function 解析会话令牌(token: string, secret: string): 会话载荷 {
  const [body, signature] = token.split(".");
  if (!body || !signature || !安全比较(signature, 签名(body, secret))) {
    throw new 应用错误("V3_AUTH_REQUIRED", "请先登录。", 401);
  }
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as 会话载荷;
  if (!payload.username || !payload.expiresAt) {
    throw new 应用错误("V3_AUTH_REQUIRED", "请先登录。", 401);
  }
  if (payload.role && !["superadmin", "admin", "partner_admin", "staff"].includes(payload.role)) {
    throw new 应用错误("V3_AUTH_REQUIRED", "请先登录。", 401);
  }
  return payload;
}

function 读取Cookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const item of header.split(";")) {
    const [key, ...rest] = item.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

function 签名(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("base64url");
}

export async function 校验密码(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split("$");
  if (parts.length !== 7 || parts[0] !== "scrypt" || parts[1] !== "v1") return false;
  const [, , nText, rText, pText, salt, expected] = parts;
  if (!nText || !rText || !pText || !salt || !expected) return false;
  const key = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(
      password,
      Buffer.from(salt, "base64url"),
      Buffer.from(expected, "base64url").length,
      { N: Number(nText), r: Number(rText), p: Number(pText), maxmem: 64 * 1024 * 1024 },
      (error, derivedKey) => (error ? reject(error) : resolve(derivedKey)),
    );
  });
  return 安全比较(key.toString("base64url"), expected);
}

export function 创建密码散列(password: string, salt = crypto.randomBytes(16)): string {
  const n = 16384;
  const r = 8;
  const p = 1;
  const key = crypto.scryptSync(password, salt, 64, { N: n, r, p, maxmem: 64 * 1024 * 1024 });
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

function 安全比较(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function 转换用户响应(用户: 交付用户) {
  return {
    username: 用户.username,
    displayName: 用户.displayName,
    roleName: 用户.roleName,
    defaultPath: 用户.defaultPath,
    allowedPaths: 用户.allowedPaths,
  };
}

function 写入会话Cookie(
  res: { setHeader(name: string, value: string): void },
  配置: 认证配置,
  token: string,
): void {
  const parts = [
    `${配置.cookieName}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${配置.ttlSeconds}`,
  ];
  if (配置.cookieSecure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function 清理会话Cookie(
  res: { setHeader(name: string, value: string): void },
  配置: 认证配置,
): void {
  const parts = [`${配置.cookieName}=`, "HttpOnly", "Path=/", "SameSite=Lax", "Max-Age=0"];
  if (配置.cookieSecure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function 发送门户登录完成页(
  res: { setHeader(name: string, value: string): void; send(body: string): void },
  页面会话: 业务页面会话,
  目标路径: string,
): void {
  const prefix = 读取业务页面存储前缀(页面会话.user.role);
  const 页面用户 = { ...页面会话.user, _storagePrefix: prefix };
  const payload = {
    prefix,
    token: 页面会话.token,
    user: 页面用户,
    targetPath: 目标路径,
    fallbackPath: "/login?ssoFallback=1&provider=unisdp&storage=1",
  };
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.send(`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>正在完成单点登录</title>
</head>
<body>
  <p>正在完成 UniSDP 单点登录，请稍候...</p>
  <script>
    (function () {
      var data = ${序列化脚本Json(payload)};
      try {
        [
          "admin_auth_token",
          "admin_user_info",
          "admin_api_user",
          "partner_auth_token",
          "partner_user_info",
          "partner_api_user",
          "api_user"
        ].forEach(function (key) { window.localStorage.removeItem(key); });
        window.localStorage.setItem(data.prefix + "auth_token", data.token);
        window.localStorage.setItem(data.prefix + "user_info", JSON.stringify(data.user));
        window.localStorage.setItem(
          data.prefix + "api_user",
          JSON.stringify({ user: data.user, token: data.token })
        );
        if (data.prefix === "partner_") {
          window.localStorage.setItem("api_user", JSON.stringify({ user: data.user, token: data.token }));
        }
        window.location.replace(data.targetPath);
      } catch (error) {
        window.location.replace(data.fallbackPath);
      }
    })();
  </script>
</body>
</html>`);
}

function 读取业务页面存储前缀(role: 业务页面角色): "admin_" | "partner_" {
  if (role === "admin" || role === "superadmin") return "admin_";
  return "partner_";
}

function 序列化脚本Json(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
