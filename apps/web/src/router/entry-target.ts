import type { 登录用户 } from "../api/auth-client.js";

const 登录页 = "/login";
const 统一入口页 = "/unified";
const 管理端页面 = "/admin.html";
const 管理移动端页面 = "/admin-mobile.html";
const 渠道端页面 = "/partner.html";
const 渠道移动端页面 = "/partner-mobile.html";
const 管理移动端首页 = `${管理移动端页面}#/admin/home`;
const 渠道移动端首页 = `${渠道移动端页面}#/partner/home`;

export interface 登录后路径参数 {
  移动访问: boolean;
  候选路径?: string;
}

export function 选择登录后路径(用户: 登录用户 | null | undefined, 参数: 登录后路径参数): string {
  if (!用户) return 登录页;

  const allowedPaths = 规范化路径列表(用户.allowedPaths);
  const defaultPath = 读取路径名(用户.defaultPath);
  const 候选地址 = 解析本地地址(参数.候选路径 || "");

  if (候选地址 && 用户可进入路径(候选地址.pathname, allowedPaths)) {
    return 转换为实际页面(候选地址);
  }

  const 工作区 = 选择账号工作区(defaultPath, allowedPaths);
  if (!工作区) {
    if (defaultPath && 用户可进入路径(defaultPath, allowedPaths)) return defaultPath;
    return 统一入口页;
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

export function 是否移动访问(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const userAgent = navigator.userAgent.toLowerCase();
  const 是移动设备 = /iphone|ipad|ipod|android|webos|blackberry|windows phone/i.test(userAgent);
  const 是触摸设备 = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const 是小屏 = window.innerWidth < 768;
  return 是移动设备 || (是小屏 && 是触摸设备);
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
  return [管理端页面, 管理移动端页面, 渠道端页面, 渠道移动端页面].includes(path);
}

function 转换为实际页面(地址: URL): string {
  const 原地址 = `${地址.pathname}${地址.search}${地址.hash}`;
  if (地址.pathname === 管理移动端页面 && !地址.hash) {
    return `${地址.pathname}${地址.search}#/admin/home`;
  }
  if (地址.pathname === 渠道移动端页面 && !地址.hash) {
    return `${地址.pathname}${地址.search}#/partner/home`;
  }
  if (是实际业务页面(地址.pathname)) return 原地址;

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

function 构建桌面页面地址(页面: string, 地址: URL, 前缀: string): string {
  const 子路径 = 地址.pathname.slice(前缀.length).replace(/^\//, "");
  if (!子路径 && !地址.search) return 页面;
  return `${页面}#/${子路径}${地址.search}`;
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
