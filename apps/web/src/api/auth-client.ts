import { 去除Sdp网关路径前缀 } from "../router/entry-target.js";

export interface 登录用户 {
  username: string;
  displayName: string;
  roleName: string;
  defaultPath: string;
  allowedPaths: string[];
  roles?: string[];
  permissions?: string[];
}

export type 业务页面角色 = "superadmin" | "admin" | "partner_admin" | "staff";

export interface 业务页面用户 {
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

export interface 业务页面会话 {
  token: string;
  user: 业务页面用户;
}

export type 单点登录入口 = "admin" | "partner";

export interface 单点登录配置 {
  enabled: boolean;
  entries: 单点登录入口[];
  requestIsaidByEntry: Record<单点登录入口, string>;
  timeoutMs: number;
}

interface 标准接口响应<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
  };
}

interface 认证结果 {
  user: 登录用户;
  pageSession: 业务页面会话;
}

export async function 登录(参数: { username: string; password: string }): Promise<登录用户> {
  const 响应 = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(参数),
  });
  const 内容 = (await 响应.json()) as 标准接口响应<认证结果>;
  if (!响应.ok || !内容.success || !内容.data) {
    throw new Error(内容.error?.message || "登录失败，请稍后重试。");
  }
  return 应用认证结果(内容.data);
}

export async function 读取单点登录配置(): Promise<单点登录配置> {
  const 响应 = await fetch("/api/auth/sso/iam/config", { credentials: "include" });
  const 内容 = (await 响应.json()) as 标准接口响应<单点登录配置>;
  if (!响应.ok || !内容.success || !内容.data) {
    throw new Error(内容.error?.message || "读取单点登录配置失败。");
  }
  return 内容.data;
}

export async function 单点登录(参数: {
  token: string;
  entry?: 单点登录入口 | null;
  clientType: string;
  provider?: "iam" | "unisdp";
}): Promise<登录用户> {
  const 请求体: { token: string; entry?: 单点登录入口; clientType: string } = {
    token: 参数.token,
    clientType: 参数.clientType,
  };
  if (参数.entry) 请求体.entry = 参数.entry;
  const 登录路径 =
    参数.provider === "unisdp" ? "/api/auth/sso/unisdp/login" : "/api/auth/sso/iam/login";
  const 响应 = await fetch(登录路径, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(请求体),
  });
  const 内容 = (await 响应.json()) as 标准接口响应<认证结果>;
  if (!响应.ok || !内容.success || !内容.data) {
    throw new Error(内容.error?.message || "单点登录失败，请重新进入。");
  }
  return 应用认证结果(内容.data);
}

export async function 读取当前用户(): Promise<登录用户> {
  const 响应 = await fetch("/api/auth/me", { credentials: "include" });
  const 内容 = (await 响应.json()) as 标准接口响应<认证结果>;
  if (!响应.ok || !内容.success || !内容.data) {
    throw new Error(内容.error?.message || "请先登录。");
  }
  return 应用认证结果(内容.data);
}

export async function 退出登录(): Promise<void> {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
  } finally {
    清理业务页面会话();
  }
}

/** 在线改密后服务端会撤销当前 Cookie 会话，页面必须回到登录页重新认证。 */
export async function 修改当前密码(输入: {
  oldPassword: string;
  newPassword: string;
}): Promise<void> {
  const 响应 = await fetch("/api/auth/password", {
    method: "PUT",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(输入),
  });
  const 内容 = (await 响应.json().catch(() => null)) as 标准接口响应<{
    changed: boolean;
    reLoginRequired: boolean;
  }> | null;
  if (响应.status === 401) {
    处理业务会话失效();
    throw new Error("登录已失效，请重新登录。");
  }
  if (!响应.ok || !内容?.success || !内容.data?.changed) {
    throw new Error(内容?.error?.message || "密码修改失败，请稍后重试。");
  }
  清理业务页面会话();
}

let 会话失效跳转中 = false;

/**
 * 业务会话失效统一出口：清理本页令牌并整页跳转登录页。
 * 多个并发请求或多个组件同时发现 401 时只执行一次，避免重复 toast 和多轮跳转。
 */
export function 处理业务会话失效(): void {
  if (typeof window === "undefined") return;
  清理业务页面会话();
  const 当前路径 = 去除Sdp网关路径前缀(window.location.pathname);
  if (会话失效跳转中 || 当前路径 === "/login") return;
  会话失效跳转中 = true;
  const 当前地址 = `${当前路径}${window.location.search}${window.location.hash}`;
  const 回跳参数 = 当前地址.startsWith("/login") ? "" : `?redirect=${encodeURIComponent(当前地址)}`;
  try {
    window.location.replace(`/login${回跳参数}`);
  } catch {
    // 部分受限浏览器会忽略 replace；继续尝试 assign，仍失败时由路由守卫兜底。
    try {
      window.location.assign(`/login${回跳参数}`);
    } catch {
      会话失效跳转中 = false;
    }
  }
}

/** 非标准请求（下载、上传、V2 兼容接口）复用它，确保 401 与普通业务请求走同一出口。 */
export function 响应表示业务会话失效(响应: Response): boolean {
  if (响应.status !== 401) return false;
  处理业务会话失效();
  return true;
}

/** 监听其他标签页退出或清理会话，当前标签页不再继续展示失效业务页面。 */
export function 安装业务会话同步监听(): void {
  if (typeof window === "undefined") return;
  window.addEventListener("storage", (事件) => {
    const 会话键 = new Set([
      "admin_auth_token",
      "admin_user_info",
      "admin_api_user",
      "partner_auth_token",
      "partner_user_info",
      "partner_api_user",
      "api_user",
    ]);
    if (事件.key !== null && !会话键.has(事件.key)) return;
    if (!存在业务页面会话()) 处理业务会话失效();
  });
}

/** 浏览器从前进/后退缓存恢复页面时复核服务端会话；失效则清理本地页面会话。 */
export async function 校验页面会话有效(): Promise<boolean> {
  try {
    const 响应 = await fetch("/api/auth/me", {
      credentials: "include",
      cache: "no-store",
    });
    const 内容 = (await 响应.json().catch(() => null)) as 标准接口响应<认证结果> | null;
    if (响应.ok && 内容?.success && 内容.data?.user) {
      // 新标签页可能只有 HttpOnly Cookie，没有本页 localStorage 会话。
      // 服务端确认有效后立即补写页面会话，后续路由和业务页面即可正常恢复。
      if (内容.data.pageSession?.token && 内容.data.pageSession.user) {
        try {
          保存业务页面会话(内容.data.pageSession);
        } catch {
          // 存储不可用时仍以服务端会话为准，避免误跳登录页。
        }
      }
      return true;
    }
  } catch {
    // 网络异常时也不能继续展示可能已失效的业务页面。
  }
  处理业务会话失效();
  return false;
}

export function 保存业务页面会话(页面会话: 业务页面会话): void {
  if (typeof window === "undefined") return;
  const prefix = 读取业务页面存储前缀(页面会话.user.role);
  const 页面用户 = { ...页面会话.user, _storagePrefix: prefix };

  try {
    // 只清理另一套角色的页面会话，不能在“同角色恢复会话”时先删除本页令牌。
    // 否则浏览器会向其他标签页广播 storage 删除事件，误触发它们的会话失效跳转。
    const 另一套前缀 = prefix === "admin_" ? "partner_" : "admin_";
    for (const key of ["auth_token", "user_info", "api_user"]) {
      window.localStorage.removeItem(`${另一套前缀}${key}`);
    }
    写入页面会话键(`${prefix}auth_token`, 页面会话.token);
    写入页面会话键(`${prefix}user_info`, JSON.stringify(页面用户));
    写入页面会话键(`${prefix}api_user`, JSON.stringify({ user: 页面用户, token: 页面会话.token }));
    if (prefix === "partner_") {
      写入页面会话键("api_user", JSON.stringify({ user: 页面用户, token: 页面会话.token }));
    } else {
      window.localStorage.removeItem("api_user");
    }
  } catch {
    清理业务页面会话();
    throw new Error("浏览器无法保存登录状态，请检查隐私模式或存储权限后重试。");
  }
}

/** 同值不重复写入，避免多标签页恢复同一会话时产生无意义的 storage 广播。 */
function 写入页面会话键(key: string, value: string): void {
  if (window.localStorage.getItem(key) === value) return;
  window.localStorage.setItem(key, value);
}

export function 清理业务页面会话(): void {
  if (typeof window === "undefined") return;
  for (const key of [
    "admin_auth_token",
    "admin_user_info",
    "admin_api_user",
    "partner_auth_token",
    "partner_user_info",
    "partner_api_user",
    "api_user",
  ]) {
    window.localStorage.removeItem(key);
  }
}

export function 存在业务页面会话(): boolean {
  if (typeof window === "undefined") return false;
  return ["admin_auth_token", "partner_auth_token"].some((key) =>
    Boolean(window.localStorage.getItem(key)),
  );
}

function 应用认证结果(结果: 认证结果): 登录用户 {
  if (!结果.pageSession?.token || !结果.pageSession.user) {
    throw new Error("登录响应缺少业务页面会话，请联系管理员更新服务。");
  }
  保存业务页面会话(结果.pageSession);
  return 结果.user;
}

function 读取业务页面存储前缀(role: 业务页面角色): "admin_" | "partner_" {
  if (role === "admin" || role === "superadmin") return "admin_";
  if (role === "partner_admin" || role === "staff") return "partner_";
  throw new Error("当前账号角色无法匹配业务页面。");
}
