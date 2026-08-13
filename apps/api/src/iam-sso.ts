import { 应用错误 } from "@lianruan/shared";

export type 单点登录入口 = "admin" | "partner";

export interface IamH5单点登录配置 {
  enabled: boolean;
  validateUrl: string;
  timeoutMs: number;
  validateIsaidByEntry: Record<单点登录入口, string>;
  requestIsaidByEntry: Record<单点登录入口, string>;
}

export interface IamH5单点登录身份 {
  username: string;
  rawUsername: string;
  displayName: string;
  userId: string;
  deptId: string;
  deptName: string;
}

const 默认超时毫秒 = 8000;
const 默认校验地址 = "http://10.10.2.62:8192/emm-cgi/oidc/getUserFromSsoToken";
const 默认校验标识 = "QdCRMguanlyuan123";
const 默认管理员请求标识 = "QdCRMguanlyuan123";
const 默认渠道请求标识 = "QdCRMguanlyuan123";

const Iam错误映射: Record<number, string> = {
  6010: "当前设备待审核，暂无法登录。",
  6005: "IAM 用户不存在。",
  6035: "单点凭证已过期，请从 IAM 入口重新进入。",
  6036: "IAM 用户已离职，禁止登录。",
  6041: "IAM 用户已被禁用，禁止登录。",
  6042: "单点凭证无效，请重新发起登录。",
  6048: "IAM 用户设备未绑定。",
  6610: "当前设备在黑名单中，无法登录。",
  8095: "IAM 认证服务异常，请稍后重试。",
};

export function 读取IamH5单点登录配置(env: NodeJS.ProcessEnv = process.env): IamH5单点登录配置 {
  const 统一校验标识 =
    读取环境文本(env, ["V3_IAM_H5_SSO_VALIDATE_ISAID", "IAM_H5_SSO_ISAID"]) || 默认校验标识;
  return {
    enabled: 解析启用开关(env),
    validateUrl:
      读取环境文本(env, ["V3_IAM_H5_SSO_VALIDATE_URL", "IAM_H5_SSO_VALIDATE_URL"]) || 默认校验地址,
    timeoutMs: 解析正整数(
      读取环境文本(env, ["V3_IAM_H5_SSO_TIMEOUT_MS", "IAM_H5_SSO_TIMEOUT"]),
      默认超时毫秒,
    ),
    validateIsaidByEntry: {
      admin: 读取环境文本(env, ["V3_IAM_H5_SSO_ADMIN_VALIDATE_ISAID"]) || 统一校验标识,
      partner: 读取环境文本(env, ["V3_IAM_H5_SSO_PARTNER_VALIDATE_ISAID"]) || 统一校验标识,
    },
    requestIsaidByEntry: {
      admin: 读取环境文本(env, ["V3_IAM_H5_SSO_ADMIN_REQUEST_ISAID"]) || 默认管理员请求标识,
      partner: 读取环境文本(env, ["V3_IAM_H5_SSO_PARTNER_REQUEST_ISAID"]) || 默认渠道请求标识,
    },
  };
}

function 解析启用开关(env: NodeJS.ProcessEnv): boolean {
  const value = 读取环境文本(env, ["V3_IAM_H5_SSO_ENABLED", "IAM_H5_SSO_ENABLED"]);
  return value ? value === "true" : true;
}

export async function 校验IamH5单点登录凭证(
  token: string,
  entry: 单点登录入口,
  配置: IamH5单点登录配置,
): Promise<IamH5单点登录身份> {
  if (!配置.enabled) {
    throw new 应用错误("V3_AUTH_SSO_DISABLED", "单点登录未启用。", 503);
  }
  if (!配置.validateUrl || !配置.validateIsaidByEntry[entry]) {
    throw new 应用错误("V3_AUTH_SSO_CONFIG_INVALID", "单点登录配置不完整。", 500);
  }

  const requestUrl = new URL(配置.validateUrl);
  requestUrl.searchParams.set("isaid", 配置.validateIsaidByEntry[entry]);
  requestUrl.searchParams.set("sso_token", token);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 配置.timeoutMs);
  try {
    const response = await fetch(requestUrl.toString(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
    });
    const payload = await 读取Json响应(response);
    if (!response.ok) {
      throw new 应用错误("V3_AUTH_SSO_PROVIDER_ERROR", "IAM 认证服务响应异常。", 502);
    }
    return 解析Iam身份(payload);
  } catch (error) {
    if (error instanceof 应用错误) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new 应用错误("V3_AUTH_SSO_TIMEOUT", "IAM 认证请求超时。", 504);
    }
    throw new 应用错误("V3_AUTH_SSO_PROVIDER_ERROR", "IAM 认证服务暂不可用。", 502);
  } finally {
    clearTimeout(timeout);
  }
}

export function 解析单点登录入口(value: unknown): 单点登录入口 | null {
  const text = String(value || "")
    .trim()
    .toLowerCase();
  if (text === "admin" || text === "厂商" || text === "管理端") return "admin";
  if (text === "partner" || text === "渠道" || text === "渠道端") return "partner";
  return null;
}

async function 读取Json响应(response: Response): Promise<unknown> {
  const rawText = await response.text();
  try {
    return rawText ? JSON.parse(rawText) : {};
  } catch {
    throw new 应用错误("V3_AUTH_SSO_PROVIDER_ERROR", "IAM 返回数据格式异常。", 502);
  }
}

function 解析Iam身份(payload: unknown): IamH5单点登录身份 {
  const status = Number(读取对象值(payload, ["status"]) || 8095);
  if (status !== 2000) {
    const 已知文案 = Iam错误映射[status];
    const 原始msg = 读取对象文本(payload, ["msg"]);
    // 透出 IAM 原始 msg,避免 IAM 报错(如"校验码编号不存在")被错误映射为"凭证过期"。
    const 文案 = 已知文案
      ? 原始msg
        ? `${已知文案}(${原始msg})`
        : 已知文案
      : 原始msg || "IAM 验证失败。";
    throw new 应用错误("V3_AUTH_SSO_REJECTED", 文案, 401);
  }

  const username = 标准化用户名(读取Iam用户名(payload));
  if (!username) {
    throw new 应用错误("V3_AUTH_SSO_PROVIDER_ERROR", "IAM 返回缺少 username。", 502);
  }

  return {
    username,
    rawUsername: 读取Iam用户名(payload) || username,
    displayName: 读取Iam用户字段(payload, "struserdes"),
    userId: 读取Iam用户字段(payload, "userid"),
    deptId: 读取Iam用户字段(payload, "deptid"),
    deptName: 读取Iam用户字段(payload, "deptname"),
  };
}

function 读取Iam用户名(payload: unknown): string {
  return 读取Iam用户字段(payload, "username") || 读取对象文本(payload, ["username"]);
}

function 读取Iam用户字段(payload: unknown, field: string): string {
  return (
    读取对象文本(payload, ["data", "mailuser", field]) || 读取对象文本(payload, ["mailuser", field])
  );
}

function 读取对象文本(source: unknown, path: string[]): string {
  const value = 读取对象值(source, path);
  return typeof value === "string" ? value.trim() : "";
}

function 读取对象值(source: unknown, path: string[]): unknown {
  let current = source;
  for (const key of path) {
    if (!current || typeof current !== "object" || !(key in current)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function 标准化用户名(username: string): string {
  return username.trim().toLowerCase();
}

function 读取环境文本(env: NodeJS.ProcessEnv, keys: string[]): string {
  for (const key of keys) {
    const value = env[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function 解析正整数(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
