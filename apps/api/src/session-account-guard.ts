import { 应用错误 } from "@lianruan/shared";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { Pool } from "pg";

import {
  读取移动端会话身份,
  读取请求会话授权版本,
  读取请求会话用户名,
  读取请求会话角色,
} from "./auth-routes.js";

export interface 会话账号状态服务 {
  查询账号状态(username: string): Promise<{
    statusCode: string;
    offboardingStatus: string;
    authorizationVersion?: number;
  } | null>;
  /**
   * 查询数据库中的有效系统角色。返回 null 表示数据库中不存在该账号，
   * 空数组表示账号存在但当前没有有效角色。
   */
  查询账号角色?(username: string): Promise<{ roleCodes: string[] } | null>;
  关闭?(): Promise<void>;
}

export function 创建会话账号状态服务(databaseUrl: string): 会话账号状态服务 {
  const pool = new Pool({ connectionString: databaseUrl, max: 5 });
  return {
    async 查询账号状态(username) {
      const 结果 = await pool.query<{
        statusCode: string;
        offboardingStatus: string;
        authorizationVersion: number;
      }>(
        `SELECT status_code AS "statusCode",offboarding_status AS "offboardingStatus",
                row_version::int AS "authorizationVersion"
         FROM iam.users
         WHERE username=$1::citext OR v2_source_id=$1
         ORDER BY CASE WHEN username=$1::citext THEN 0 ELSE 1 END
         LIMIT 1`,
        [username],
      );
      return 结果.rows[0] || null;
    },
    async 查询账号角色(username) {
      const 结果 = await pool.query<{ roleCodes: string[] }>(
        `SELECT
           COALESCE(
             array_agg(DISTINCT r.role_code ORDER BY r.role_code)
               FILTER (WHERE r.role_code IS NOT NULL),
             ARRAY[]::text[]
           ) AS "roleCodes"
         FROM iam.users u
         LEFT JOIN iam.user_roles ur ON ur.user_id = u.id
         LEFT JOIN iam.roles r ON r.id = ur.role_id AND r.status_code = 'active'
         WHERE u.username=$1::citext OR u.v2_source_id=$1
         GROUP BY u.id, u.username
         ORDER BY CASE WHEN u.username=$1::citext THEN 0 ELSE 1 END
         LIMIT 1`,
        [username],
      );
      return 结果.rows[0] || null;
    },
    async 关闭() {
      await pool.end();
    },
  };
}

/**
 * 组织架构和 RBAC 使用 Cookie 中的超级管理员标记作为快速路由判断，
 * 但角色调整后旧 Cookie 不能继续保留管理权限。因此对这两个高权限域
 * 额外按请求实时读取数据库角色；查询失败时失效关闭，不放行旧会话。
 */
export function 创建会话角色实时防护(参数: {
  sessionSecret: string;
  env?: NodeJS.ProcessEnv;
  service?: 会话账号状态服务;
}): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!是高权限角色校验路径(req)) {
      next();
      return;
    }
    const 会话参数 = {
      sessionSecret: 参数.sessionSecret,
      ...(参数.env ? { env: 参数.env } : {}),
    };
    const username = 读取请求会话用户名(req, 会话参数);
    const role = 读取请求会话角色(req, 会话参数);
    if (!username || role !== "superadmin") {
      next();
      return;
    }
    if (!参数.service?.查询账号角色) {
      // 没有数据库角色服务时，组织/RBAC 路由自身仍会执行签名和角色判断；
      // 交付配置账号可能没有数据库记录，保留其既有登录能力。
      next();
      return;
    }
    try {
      const 数据库角色 = await 参数.service.查询账号角色(username);
      if (!数据库角色) {
        if (是交付配置账号(username, 参数.env)) {
          next();
          return;
        }
        throw new 应用错误("V3_AUTH_ROLE_CHANGED", "账号授权已发生变化，请重新登录后重试。", 401);
      }
      if (!数据库角色.roleCodes.includes("superadmin"))
        throw new 应用错误("V3_AUTH_ROLE_CHANGED", "账号授权已发生变化，请重新登录后重试。", 401);
      next();
    } catch (error) {
      next(
        error instanceof 应用错误
          ? error
          : new 应用错误(
              "V3_AUTH_ROLE_CHECK_UNAVAILABLE",
              "账号授权检查暂不可用，请稍后重试。",
              503,
            ),
      );
    }
  };
}

export function 创建停用账号会话防护(参数: {
  enabled: boolean;
  sessionSecret: string;
  env?: NodeJS.ProcessEnv;
  service?: 会话账号状态服务;
}): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!参数.enabled) {
      next();
      return;
    }
    if (是开放接口请求(req)) {
      // 开放接口使用独立的服务端签名访问令牌，账号状态和资源范围由原开放接口鉴权链路校验。
      next();
      return;
    }
    if (!参数.service) {
      next(
        new 应用错误(
          "V3_AUTH_ACCOUNT_CHECK_UNAVAILABLE",
          "账号状态检查服务未配置，当前拒绝继续访问。",
          503,
        ),
      );
      return;
    }
    try {
      const 会话参数 = {
        sessionSecret: 参数.sessionSecret,
        ...(参数.env ? { env: 参数.env } : {}),
      };
      const 会话身份集合 = new Map<string, number | null>();
      const Cookie用户名 = 读取请求会话用户名(req, 会话参数);
      if (Cookie用户名) 会话身份集合.set(Cookie用户名, 读取请求会话授权版本(req, 会话参数));
      const 移动端身份 = 读取移动端会话身份(req, 会话参数);
      if (移动端身份)
        会话身份集合.set(
          移动端身份.username,
          是有效授权版本(移动端身份.authorizationVersion) ? 移动端身份.authorizationVersion : null,
        );
      const V2页面身份 = 读取V2页面令牌身份(req);
      if (V2页面身份 && !会话身份集合.has(V2页面身份.username))
        if (会话身份集合.size)
          throw new 应用错误(
            "V3_AUTH_SESSION_MISMATCH",
            "正式页面令牌与当前登录账号不一致，请重新登录。",
            401,
          );
        else 会话身份集合.set(V2页面身份.username, V2页面身份.authorizationVersion);
      if (!会话身份集合.size && 存在不可信兼容身份(req))
        throw new 应用错误(
          "V3_AUTH_TRUSTED_SESSION_REQUIRED",
          "当前操作必须使用签名会话，不能使用客户端自报身份。",
          401,
        );

      for (const [username, 会话授权版本] of 会话身份集合) {
        const 状态 = await 参数.service.查询账号状态(username);
        if (!状态) {
          if (是交付配置账号(username, 参数.env)) continue;
          throw new 应用错误(
            "V3_AUTH_ACCOUNT_UNAVAILABLE",
            "账号不存在或已不可用，请重新登录。",
            401,
          );
        }
        if (
          状态.statusCode !== "active" ||
          !["active", "reactivated"].includes(状态.offboardingStatus)
        ) {
          throw new 应用错误(
            "V3_AUTH_ACCOUNT_DISABLED",
            "账号已停用或正在离职交接，请联系管理员。",
            401,
          );
        }
        if (
          是有效授权版本(状态.authorizationVersion) &&
          (会话授权版本 !== 状态.authorizationVersion ||
            (状态.offboardingStatus === "reactivated" && 会话授权版本 === null))
        )
          throw new 应用错误(
            "V3_AUTH_AUTHORIZATION_CHANGED",
            "账号授权已发生变化，请重新登录。",
            401,
          );
      }
      next();
    } catch (error) {
      next(
        error instanceof 应用错误
          ? error
          : new 应用错误(
              "V3_AUTH_ACCOUNT_CHECK_UNAVAILABLE",
              "账号状态检查暂不可用，请稍后重试。",
              503,
            ),
      );
    }
  };
}

function 是开放接口请求(req: Request): boolean {
  return req.path === "/open/v1" || req.path.startsWith("/open/v1/");
}

function 是高权限角色校验路径(req: Request): boolean {
  return req.path === "/rbac" || req.path.startsWith("/rbac/") || req.path.startsWith("/org/");
}

function 存在不可信兼容身份(req: Request): boolean {
  if (typeof req.headers["x-v3-delivery-user"] === "string") return true;
  const 查询身份 = req.query.operatorId;
  if (typeof 查询身份 === "string" && 查询身份.trim()) return true;
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) return false;
  const 正文 = req.body as Record<string, unknown>;
  return ["operatorId", "createdBy"].some(
    (字段) => typeof 正文[字段] === "string" && String(正文[字段]).trim(),
  );
}

function 读取V2页面令牌身份(
  req: Request,
): { username: string; authorizationVersion: number | null } | null {
  const header = req.headers.authorization || "";
  const match = /^Bearer\s+v2\.([^.]+)\.([^.]+)(?:\.([^.]+))?/i.exec(header);
  if (!match?.[1]) return null;
  try {
    const username = Buffer.from(match[1], "base64url").toString("utf8").trim();
    if (!username) return null;
    const version = match[3] ? Number(match[2]) : Number.NaN;
    return {
      username,
      authorizationVersion: 是有效授权版本(version) ? version : null,
    };
  } catch {
    return null;
  }
}

function 是有效授权版本(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function 是交付配置账号(username: string, env: NodeJS.ProcessEnv | undefined): boolean {
  const value = (env || process.env).V3_DELIVERY_AUTH_USERS_JSON;
  if (!value) return false;
  try {
    const users = JSON.parse(value) as Array<{ username?: unknown }>;
    return users.some(
      (用户) =>
        typeof 用户.username === "string" && 用户.username.toLowerCase() === username.toLowerCase(),
    );
  } catch {
    return false;
  }
}
