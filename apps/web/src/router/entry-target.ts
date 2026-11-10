import type { 登录用户 } from "../api/auth-client.js";
import { Iam平台单点登录路径, UniSdp平台单点登录路径 } from "./sso-entry.js";

const 登录页 = "/login";
const 无权限页 = "/403";
const 已下线测试页 = "/unified";
const 管理端页面 = "/admin";
const 管理移动端页面 = "/admin-mobile.html";
const 渠道端页面 = "/partner";
const 渠道移动端页面 = "/partner-mobile.html";
const 管理移动端首页 = `${管理移动端页面}#/admin/home`;
const 渠道移动端首页 = `${渠道移动端页面}#/partner/home`;
const Sdp网关应用前缀 = /^\/[0-9a-fA-F]{32}(?=\/|$)/;
const 跳过会话复核路径 = new Set([
  登录页,
  "/login/singlesignonlogin/login.do",
  Iam平台单点登录路径,
  UniSdp平台单点登录路径,
]);

export interface 登录后路径参数 {
  移动访问: boolean;
  候选路径?: string;
}

export function 选择登录后路径(用户: 登录用户 | null | undefined, 参数: 登录后路径参数): string {
  if (!用户) return 登录页;

  const allowedPaths = 规范化路径列表(用户.allowedPaths).filter((path) => path !== 已下线测试页);
  const 原始默认路径 = 读取路径名(用户.defaultPath);
  const defaultPath = 原始默认路径 === 已下线测试页 ? "" : 原始默认路径;
  const 候选地址 = 解析本地地址(参数.候选路径 || "");

  if (候选地址 && 用户可进入路径(候选地址.pathname, allowedPaths)) {
    return 转换为实际页面(候选地址);
  }

  const 工作区 = 选择账号工作区(defaultPath, allowedPaths);
  if (!工作区) {
    if (defaultPath && 用户可进入路径(defaultPath, allowedPaths)) return defaultPath;
    return 无权限页;
  }

  if (参数.移动访问 && 可进入移动端(allowedPaths)) {
    return 工作区 === "admin" ? 管理移动端首页 : 渠道移动端首页;
  }
  return 工作区 === "admin" ? 管理端页面 : 渠道端页面;
}

export function 是否业务页面路径(path: string): boolean {
  const 地址 = 解析本地地址(path);
  return 地址 ? 是实际业务页面(地址.pathname) : false;
}

/**
 * 单点登录回调页必须先完成凭证交换，不能提前用 Cookie 会话探测覆盖登录流程。
 * 否则回调请求尚未返回时会被全局会话复核跳转到登录页，导致 Cookie 未落地。
 */
export function 是否跳过页面会话复核(path: string): boolean {
  const 规范路径 = 去除Sdp网关路径前缀(String(path || "")).replace(/\/+$/, "") || "/";
  return 跳过会话复核路径.has(规范路径);
}

export function 是否移动访问(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const userAgent = navigator.userAgent.toLowerCase();
  const 是移动设备 = /iphone|ipad|ipod|android|webos|blackberry|windows phone/i.test(userAgent);
  const 是触摸设备 = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const 是小屏 = window.innerWidth < 768;
  return 是移动设备 || (是小屏 && 是触摸设备);
}

/** 去除 SDP 网关注入的 32 位应用前缀，避免前端把网关地址误判为 404。 */
export function 去除Sdp网关路径前缀(pathname: string): string {
  const 原始路径 = String(pathname || "");
  if (!Sdp网关应用前缀.test(原始路径)) return 原始路径;
  const 去除前缀 = 原始路径.replace(Sdp网关应用前缀, "");
  return 去除前缀 || "/";
}

/** 在应用挂载前归一化当前地址，确保首次打开不会先渲染 404 页面。 */
export function 归一化Sdp网关入口(): void {
  if (typeof window === "undefined") return;
  const 当前路径 = window.location.pathname;
  const 规范路径 = 去除Sdp网关路径前缀(当前路径);
  if (规范路径 === 当前路径) return;
  const 目标地址 = `${规范路径}${window.location.search}${window.location.hash}`;
  window.history.replaceState(window.history.state, "", 目标地址);
}

function 选择账号工作区(defaultPath: string, allowedPaths: string[]): "admin" | "partner" | "" {
  if (是管理端路径(defaultPath) && 可进入管理端(allowedPaths)) return "admin";
  if (是渠道端路径(defaultPath) && 可进入渠道端(allowedPaths)) return "partner";
  if (可进入管理端(allowedPaths)) return "admin";
  if (可进入渠道端(allowedPaths)) return "partner";
  return "";
}

function 用户可进入路径(path: string, allowedPaths: string[]): boolean {
  if (!path) return false;
  if (path === "/admin.html") return 可进入管理端(allowedPaths);
  if (path === "/partner.html") return 可进入渠道端(allowedPaths);
  if (path === 管理移动端页面 || 是移动管理端路径(path)) {
    return 可进入管理端(allowedPaths) && 可进入移动端(allowedPaths);
  }
  if (path === 渠道移动端页面 || 是移动渠道端路径(path)) {
    return 可进入渠道端(allowedPaths) && 可进入移动端(allowedPaths);
  }
  if (path === 管理端页面 || 是管理端路径(path)) return 可进入管理端(allowedPaths);
  if (path === 渠道端页面 || 是渠道端路径(path)) return 可进入渠道端(allowedPaths);
  return allowedPaths.some((allowedPath) => 路径匹配(path, allowedPath));
}

function 可进入管理端(allowedPaths: string[]): boolean {
  return allowedPaths.some((path) => 路径匹配("/admin", path));
}

function 可进入渠道端(allowedPaths: string[]): boolean {
  return allowedPaths.some((path) => 路径匹配("/partner", path));
}

function 可进入移动端(allowedPaths: string[]): boolean {
  return allowedPaths.some((path) => 路径匹配("/mobile", path));
}

function 是管理端路径(path: string): boolean {
  return path === "/admin" || path.startsWith("/admin/");
}

function 是渠道端路径(path: string): boolean {
  return path === "/partner" || path.startsWith("/partner/");
}

function 是移动管理端路径(path: string): boolean {
  return path === "/mobile/admin" || path.startsWith("/mobile/admin/");
}

function 是移动渠道端路径(path: string): boolean {
  return path === "/mobile/partner" || path.startsWith("/mobile/partner/");
}

function 是实际业务页面(path: string): boolean {
  return (
    [管理端页面, 管理移动端页面, 渠道端页面, 渠道移动端页面].includes(path) ||
    path.startsWith(`${管理端页面}/`) ||
    path.startsWith(`${渠道端页面}/`) ||
    path === "/admin.html" ||
    path === "/partner.html"
  );
}

function 转换为实际页面(地址: URL): string {
  const 原地址 = `${地址.pathname}${地址.search}${地址.hash}`;
  const 旧管理深链 = 转换旧哈希深链(地址, "/admin.html", 管理端页面);
  if (旧管理深链) return 旧管理深链;
  const 旧渠道深链 = 转换旧哈希深链(地址, "/partner.html", 渠道端页面);
  if (旧渠道深链) return 旧渠道深链;
  if (地址.pathname === 管理移动端页面 && !地址.hash) {
    return `${地址.pathname}${地址.search}#/admin/home`;
  }
  if (地址.pathname === 渠道移动端页面 && !地址.hash) {
    return `${地址.pathname}${地址.search}#/partner/home`;
  }
  if (是实际业务页面(地址.pathname)) return `${地址.pathname}${地址.search}`;

  if (是移动管理端路径(地址.pathname)) {
    return 构建移动页面地址(管理移动端页面, 地址, "/mobile/");
  }
  if (是移动渠道端路径(地址.pathname)) {
    return 构建移动页面地址(渠道移动端页面, 地址, "/mobile/");
  }
  if (是管理端路径(地址.pathname)) {
    return 构建桌面页面地址(管理端页面, 地址, "/admin");
  }
  if (是渠道端路径(地址.pathname)) {
    return 构建桌面页面地址(渠道端页面, 地址, "/partner");
  }
  return 原地址;
}

function 转换旧哈希深链(地址: URL, 旧页面: string, 新页面: string): string {
  if (地址.pathname !== 旧页面) return "";
  const 哈希路径 = 地址.hash.startsWith("#/") ? 地址.hash.slice(2) : "";
  if (!哈希路径) return `${新页面}${地址.search}`;
  return `${新页面}/${哈希路径}${地址.search}`.replace(/\/+/g, "/");
}

function 构建桌面页面地址(页面: string, 地址: URL, 前缀: string): string {
  const 子路径 = 地址.pathname.slice(前缀.length).replace(/^\//, "");
  if (!子路径 && !地址.search) return 页面;
  return `${页面}/${子路径}${地址.search}`.replace(/\/+/g, "/");
}

function 构建移动页面地址(页面: string, 地址: URL, 前缀: string): string {
  const 子路径 = 地址.pathname.slice(前缀.length).replace(/^\//, "");
  if (!子路径 && !地址.search) return 页面;
  return `${页面}#/${子路径}${地址.search}`;
}

function 路径匹配(path: string, allowedPath: string): boolean {
  return path === allowedPath || path.startsWith(allowedPath + "/");
}

function 规范化路径列表(paths: string[] | undefined): string[] {
  return (Array.isArray(paths) ? paths : []).map(读取路径名).filter(Boolean);
}

function 读取路径名(path: string | undefined): string {
  return 解析本地地址(path || "")?.pathname || "";
}

function 解析本地地址(path: string): URL | null {
  const text = String(path || "").trim();
  if (!text.startsWith("/") || text.startsWith("//")) return null;
  try {
    return new URL(text, "https://v3-entry.local");
  } catch {
    return null;
  }
}
