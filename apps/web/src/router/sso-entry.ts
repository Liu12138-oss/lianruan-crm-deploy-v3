import type { LocationQueryRaw, RouteLocationNormalizedLoaded, RouteLocationRaw } from "vue-router";

export type 单点登录提供方 = "iam" | "unisdp";

export const 单点登录路径 = "/login/singlesignonlogin/login.do";
export const Iam平台单点登录路径 = "/sso/iam";
export const UniSdp平台单点登录路径 = "/sso/unisdp";
export const UniSdp门户单点登录路径 = "/app/sso.htm";

const UniSdp凭证标准参数名 = new Set(["ssotoken"]);

type 路由片段 = Pick<RouteLocationNormalizedLoaded, "path" | "query" | "hash">;

interface 单点登录跳转参数 {
  自动尝试?: boolean;
  失败回登录?: boolean;
}

export function 需要转入单点登录(路由: 路由片段): boolean {
  if (是单点登录处理路径(路由.path)) return false;
  if (需要转入UniSdp单点登录(路由)) return false;
  return (
    查询包含单点标记(路由.query) ||
    查询包含Iam单点标记(路由.query) ||
    Hash包含单点标记(路由.hash) ||
    Hash包含Iam单点标记(路由.hash)
  );
}

export function 需要转入UniSdp单点登录(路由: 路由片段): boolean {
  if (是单点登录处理路径(路由.path)) return false;
  return 查询包含UniSdp单点凭证(路由.query) || Hash包含UniSdp单点凭证(路由.hash);
}

export function 构建单点登录跳转(路由: 路由片段, 参数: 单点登录跳转参数 = {}): RouteLocationRaw {
  const query: LocationQueryRaw = { ...路由.query };
  if (参数.自动尝试) query.autoSso = "1";
  if (参数.失败回登录) query.fallback = "login";
  return {
    path: Iam平台单点登录路径,
    query,
    hash: 路由.hash,
  };
}

export function 构建UniSdp单点登录跳转(路由: 路由片段): RouteLocationRaw {
  const query: LocationQueryRaw = { ...路由.query, provider: "unisdp", fallback: "login" };
  return {
    path: UniSdp平台单点登录路径,
    query,
    hash: 路由.hash,
  };
}

export function 识别单点登录提供方(路由: 路由片段): 单点登录提供方 {
  if (路由.path === Iam平台单点登录路径) return "iam";
  if (路由.path === UniSdp平台单点登录路径 || 路由.path === UniSdp门户单点登录路径) {
    return "unisdp";
  }
  return 读取查询文本(路由.query, "provider").toLowerCase() === "unisdp" ? "unisdp" : "iam";
}

export function 是平台专属单点登录路径(path: string): boolean {
  return path === Iam平台单点登录路径 || path === UniSdp平台单点登录路径;
}

function 是单点登录处理路径(path: string): boolean {
  return path === 单点登录路径 || path === UniSdp门户单点登录路径 || 是平台专属单点登录路径(path);
}

function 查询包含单点标记(query: 路由片段["query"]): boolean {
  return 读取查询文本(query, "source").toLowerCase() === "emm";
}

function 查询包含Iam单点标记(query: 路由片段["query"]): boolean {
  return 读取查询文本(query, "needtransfer") === "1";
}

function 查询包含UniSdp单点凭证(query: 路由片段["query"]): boolean {
  return Object.entries(query).some(
    ([name, value]) => 是UniSdp凭证参数名(name) && 读取查询值(value),
  );
}

function Hash包含单点标记(hash: string): boolean {
  const query = 读取Hash查询(hash);
  if (!query) return false;
  return 读取Hash参数文本(query, "source").toLowerCase() === "emm";
}

function Hash包含Iam单点标记(hash: string): boolean {
  const query = 读取Hash查询(hash);
  if (!query) return false;
  return 读取Hash参数文本(query, "needtransfer") === "1";
}

function Hash包含UniSdp单点凭证(hash: string): boolean {
  const query = 读取Hash查询(hash);
  if (!query) return false;
  for (const [name, value] of query.entries()) {
    if (是UniSdp凭证参数名(name) && value.trim()) return true;
  }
  return false;
}

function 读取查询文本(query: 路由片段["query"], name: string): string {
  const 标准名称 = 标准化参数名(name);
  const entry = Object.entries(query).find(([key]) => 标准化参数名(key) === 标准名称);
  return entry ? 读取查询值(entry[1]) : "";
}

function 读取查询值(value: 路由片段["query"][string]): string {
  if (Array.isArray(value)) return String(value[0] || "").trim();
  return String(value || "").trim();
}

function 读取Hash参数文本(query: URLSearchParams, name: string): string {
  const 标准名称 = 标准化参数名(name);
  for (const [key, value] of query.entries()) {
    if (标准化参数名(key) === 标准名称) return value.trim();
  }
  return "";
}

function 是UniSdp凭证参数名(name: string): boolean {
  return UniSdp凭证标准参数名.has(标准化参数名(name));
}

function 标准化参数名(name: string): string {
  return name.replace(/[_-]/g, "").toLowerCase();
}

function 读取Hash查询(hash: string): URLSearchParams | null {
  const text = hash.replace(/^#/, "");
  const queryIndex = text.indexOf("?");
  const queryText =
    queryIndex >= 0 ? text.slice(queryIndex + 1) : text.startsWith("?") ? text.slice(1) : "";
  return queryText ? new URLSearchParams(queryText) : null;
}
