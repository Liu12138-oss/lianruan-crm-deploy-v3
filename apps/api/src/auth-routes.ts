import crypto from "node:crypto";

import type { 构建信息 } from "@lianruan/shared";
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

interface 交付用户 {
  username: string;
  displayName: string;
  roleName: string;
  passwordHash: string;
  defaultPath: string;
  allowedPaths: string[];
  pageUser: 业务页面用户;
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

interface 会话载荷 {
  username: string;
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
}

interface 认证路由参数 {
  build: 构建信息;
  sessionSecret: string;
  databaseUrl?: string | undefined;
  env?: NodeJS.ProcessEnv;
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
  注册会话路由(router, 配置, 参数.build);

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

function 注册账号密码路由(router: Router, 配置: 认证配置, build: 构建信息): void {
  router.post("/login", async (req, res, next) => {
    try {
      if (!配置.enabled) throw new 应用错误("V3_AUTH_DISABLED", "登录入口未启用。", 503);
      const { username, password } = 读取登录请求(req);
      const 用户 = await 查找并校验用户(username, password, 配置);
      if (!用户) {
        throw new 应用错误("V3_AUTH_INVALID_CREDENTIALS", "用户名或密码不正确。", 401);
      }

      const token = 签发会话令牌(用户.username, 配置);
      写入会话Cookie(res, 配置, token);
      res.json(
        创建成功响应({
          requestId: req.requestId,
          build,
          data: {
            user: 转换用户响应(用户),
            pageSession: 创建业务页面会话(用户),
            expiresInSeconds: 配置.ttlSeconds,
          },
        }),
      );
    } catch (error) {
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
    try {
      if (!配置.enabled) throw new 应用错误("V3_AUTH_DISABLED", "登录入口未启用。", 503);
      const 用户 = await 读取当前用户(req, 配置);
      res.json(
        创建成功响应({
          requestId: req.requestId,
          build,
          data: {
            user: 转换用户响应(用户),
            pageSession: 创建业务页面会话(用户),
          },
        }),
      );
    } catch (error) {
      next(error);
    }
  });

  router.post("/logout", (req, res) => {
    清理会话Cookie(res, 配置);
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
  };
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
  try {
    if (!配置.enabled) throw new 应用错误("V3_AUTH_DISABLED", "登录入口未启用。", 503);
    const { token, entry, clientType } = 读取单点登录请求(req, 固定入口);
    const iam身份 = await 校验IamH5单点登录凭证(token, entry, 配置.sso);
    const 用户 = await 查找可登录用户(iam身份.username, 配置);
    if (!用户) {
      throw new 应用错误("V3_AUTH_SSO_USER_NOT_FOUND", "CRM 未开通该单点登录账号。", 403);
    }
    if (!允许进入工作区(用户, entry)) {
      throw new 应用错误("V3_AUTH_SSO_FORBIDDEN", "当前账号未开通该单点登录入口。", 403);
    }

    const sessionToken = 签发会话令牌(用户.username, 配置);
    写入会话Cookie(res, 配置, sessionToken);
    res.json(
      创建成功响应({
        requestId: req.requestId,
        build,
        data: {
          user: 转换用户响应(用户),
          pageSession: 创建业务页面会话(用户),
          entry,
          clientType,
          expiresInSeconds: 配置.ttlSeconds,
        },
      }),
    );
  } catch (error) {
    next(error);
  }
}

function 读取单点登录请求(
  req: Request,
  固定入口?: 单点登录入口,
): { token: string; entry: 单点登录入口; clientType: string } {
  const body = req.body as Record<string, unknown>;
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const entry = 固定入口 || 解析单点登录入口(body.entry || body.scope || body.入口);
  const clientType = typeof body.clientType === "string" ? body.clientType.trim() : "";
  if (!token) {
    throw new 应用错误("V3_AUTH_SSO_BAD_REQUEST", "缺少单点登录凭证。", 400);
  }
  if (!entry) {
    throw new 应用错误("V3_AUTH_SSO_BAD_REQUEST", "缺少单点登录入口。", 400);
  }
  return { token, entry, clientType };
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

function 解析交付用户(value: string | undefined): 交付用户[] {
  if (!value) return [];
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed))
    throw new 应用错误("V3_AUTH_CONFIG_INVALID", "交付账号配置格式不正确。", 500);
  return parsed.map((item) => {
    const 用户 = item as Partial<交付用户>;
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
    const 标准用户 = {
      username: 用户.username,
      displayName: 用户.displayName,
      roleName: 用户.roleName,
      passwordHash: 用户.passwordHash,
      defaultPath: 用户.defaultPath,
      allowedPaths: 用户.allowedPaths,
    };
    return { ...标准用户, pageUser: 创建配置业务页面用户(标准用户) };
  });
}

function 解析正整数(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function 签发会话令牌(username: string, 配置: 认证配置): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: 会话载荷 = {
    username,
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
    const result = await 配置.pool.query<{
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
    }>(
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
      WHERE lower(u.username::text) = lower($1)
        AND u.status_code = 'active'
      GROUP BY u.id, u.v2_source_id, u.username, u.display_name, pc.password_hash,
        reg.region_name, u.extra_json
      LIMIT 1
      `,
      [username],
    );
    const row = result.rows[0];
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
    };
  } catch {
    return null;
  }
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
