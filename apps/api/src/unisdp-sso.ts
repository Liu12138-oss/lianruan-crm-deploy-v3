import { 应用错误 } from "@lianruan/shared";

export interface UniSdp单点登录配置 {
  enabled: boolean;
  validateUrl: string;
  isaid: string;
  timeoutMs: number;
}

export interface UniSdp单点登录身份 {
  username: string;
  rawUsername: string;
  mobile: string;
  rawMobile: string;
}

const 默认超时毫秒 = 8000;
const 默认校验地址 = "https://portal.leagsoft.com/UniSSO/auth/sso_token.json";
const 默认应用标识 = "QdCRMguanlyuan123";

const UniSdp错误映射: Record<number, string> = {
  6001: "UniSDP 单点登录参数为空。",
  6003: "UniSDP 单点凭证无效，请重新发起登录。",
  6010: "UniSDP 单点凭证已过期，请从门户重新进入。",
};

export function 读取UniSdp单点登录配置(env: NodeJS.ProcessEnv = process.env): UniSdp单点登录配置 {
  return {
    enabled: 解析启用开关(env),
    validateUrl: 读取环境文本(env, ["V3_UNISDP_SSO_VALIDATE_URL"]) || 默认校验地址,
    isaid: 读取环境文本(env, ["V3_UNISDP_SSO_ISAID"]) || 默认应用标识,
    timeoutMs: 解析正整数(读取环境文本(env, ["V3_UNISDP_SSO_TIMEOUT_MS"]), 默认超时毫秒),
  };
}

export async function 校验UniSdp单点登录凭证(
  token: string,
  配置: UniSdp单点登录配置,
): Promise<UniSdp单点登录身份> {
  if (!配置.enabled) {
    throw new 应用错误("V3_AUTH_UNISDP_SSO_DISABLED", "UniSDP 单点登录未启用。", 503);
  }
  if (!配置.validateUrl || !配置.isaid) {
    throw new 应用错误("V3_AUTH_UNISDP_SSO_CONFIG_INVALID", "UniSDP 单点登录配置不完整。", 500);
  }

  const requestUrl = new URL(配置.validateUrl);
  requestUrl.searchParams.set("sso_token", token);
  requestUrl.searchParams.set("isaid", 配置.isaid);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 配置.timeoutMs);
  try {
    const response = await fetch(requestUrl.toString(), {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded",
      },
      signal: controller.signal,
    });
    const payload = await 读取Json响应(response);
    if (!response.ok) {
      throw new 应用错误("V3_AUTH_UNISDP_SSO_PROVIDER_ERROR", "UniSDP 认证服务响应异常。", 502);
    }
    return 解析UniSdp身份(payload);
  } catch (error) {
    if (error instanceof 应用错误) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new 应用错误("V3_AUTH_UNISDP_SSO_TIMEOUT", "UniSDP 认证请求超时。", 504);
    }
    throw new 应用错误("V3_AUTH_UNISDP_SSO_PROVIDER_ERROR", "UniSDP 认证服务暂不可用。", 502);
  } finally {
    clearTimeout(timeout);
  }
}

async function 读取Json响应(response: Response): Promise<unknown> {
  const rawText = await response.text();
  try {
    return rawText ? JSON.parse(rawText) : {};
  } catch {
    throw new 应用错误("V3_AUTH_UNISDP_SSO_PROVIDER_ERROR", "UniSDP 返回数据格式异常。", 502);
  }
}

function 解析UniSdp身份(payload: unknown): UniSdp单点登录身份 {
  const status = Number(读取对象值(payload, ["status"]) || 6003);
  const isLogin = 读取对象值(payload, ["isLogin"]) === true;
  if (status !== 2000 || !isLogin) {
    throw new 应用错误(
      "V3_AUTH_UNISDP_SSO_REJECTED",
      UniSdp错误映射[status] || 读取对象文本(payload, ["errmsg"]) || "UniSDP 验证失败。",
      401,
    );
  }

  const rawUsername = 读取对象文本(payload, ["username"]);
  const username = 标准化用户名(rawUsername);
  if (!username) {
    throw new 应用错误("V3_AUTH_UNISDP_SSO_PROVIDER_ERROR", "UniSDP 返回缺少 username。", 502);
  }

  const rawMobile = 读取UniSdp手机号(payload);
  const mobile = 标准化手机号(rawMobile);

  return { username, rawUsername, mobile, rawMobile };
}

function 读取对象文本(source: unknown, path: string[]): string {
  const value = 读取对象值(source, path);
  return typeof value === "string" ? value.trim() : "";
}

function 读取UniSdp手机号(payload: unknown): string {
  return 读取第一个对象文本(payload, [
    ["mobile"],
    ["mobilePhone"],
    ["mobileNo"],
    ["phone"],
    ["phoneNumber"],
    ["phoneNo"],
    ["telephone"],
    ["tel"],
    ["cellphone"],
    ["cellPhone"],
    ["userMobile"],
    ["userPhone"],
    ["手机号"],
    ["data", "mobile"],
    ["data", "mobilePhone"],
    ["data", "phone"],
    ["data", "phoneNumber"],
    ["data", "userMobile"],
    ["data", "userPhone"],
    ["user", "mobile"],
    ["user", "mobilePhone"],
    ["user", "phone"],
    ["userInfo", "mobile"],
    ["userInfo", "mobilePhone"],
    ["userInfo", "phone"],
    ["userinfo", "mobile"],
    ["userinfo", "mobilePhone"],
    ["userinfo", "phone"],
  ]);
}

function 读取第一个对象文本(source: unknown, paths: string[][]): string {
  for (const path of paths) {
    const value = 读取对象文本(source, path);
    if (value) return value;
  }
  return "";
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

function 标准化手机号(mobile: string): string {
  return mobile.replace(/\D+/g, "");
}

function 读取环境文本(env: NodeJS.ProcessEnv, keys: string[]): string {
  for (const key of keys) {
    const value = env[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function 解析启用开关(env: NodeJS.ProcessEnv): boolean {
  const value = 读取环境文本(env, ["V3_UNISDP_SSO_ENABLED"]);
  return value ? value === "true" : false;
}

function 解析正整数(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
