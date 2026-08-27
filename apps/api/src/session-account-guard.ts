import { 应用错误 } from "@lianruan/shared";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { Pool } from "pg";

import { 读取移动端会话身份, 读取请求会话用户名 } from "./auth-routes.js";

export interface 会话账号状态服务 {
  查询账号状态(username: string): Promise<{ statusCode: string; offboardingStatus: string } | null>;
  关闭?(): Promise<void>;
}

export function 创建会话账号状态服务(databaseUrl: string): 会话账号状态服务 {
  const pool = new Pool({ connectionString: databaseUrl, max: 5 });
  return {
    async 查询账号状态(username) {
      const 结果 = await pool.query<{ statusCode: string; offboardingStatus: string }>(
        `SELECT status_code AS "statusCode",offboarding_status AS "offboardingStatus"
         FROM iam.users
         WHERE username=$1::citext OR v2_source_id=$1
         ORDER BY CASE WHEN username=$1::citext THEN 0 ELSE 1 END
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
      const 用户名集合 = new Set<string>();
      const Cookie用户名 = 读取请求会话用户名(req, 会话参数);
      if (Cookie用户名) 用户名集合.add(Cookie用户名);
      const 移动端用户名 = 读取移动端会话身份(req, 会话参数)?.username || "";
      if (移动端用户名) 用户名集合.add(移动端用户名);
      const V2用户名 = 读取V2页面令牌用户名(req);
      if (V2用户名 && !用户名集合.has(V2用户名))
        if (用户名集合.size)
          throw new 应用错误(
            "V3_AUTH_SESSION_MISMATCH",
            "正式页面令牌与当前登录账号不一致，请重新登录。",
            401,
          );
        else 用户名集合.add(V2用户名);
      if (!用户名集合.size && 存在不可信兼容身份(req))
        throw new 应用错误(
          "V3_AUTH_TRUSTED_SESSION_REQUIRED",
          "当前操作必须使用签名会话，不能使用客户端自报身份。",
          401,
        );

      for (const username of 用户名集合) {
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

function 读取V2页面令牌用户名(req: Request): string {
  const header = req.headers.authorization || "";
  const match = /^Bearer\s+v2\.([^.]+)\./i.exec(header);
  if (!match?.[1]) return "";
  try {
    return Buffer.from(match[1], "base64url").toString("utf8").trim();
  } catch {
    return "";
  }
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
