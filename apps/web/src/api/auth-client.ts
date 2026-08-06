export interface 登录用户 {
  username: string;
  displayName: string;
  roleName: string;
  defaultPath: string;
  allowedPaths: string[];
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

export function 保存业务页面会话(页面会话: 业务页面会话): void {
  if (typeof window === "undefined") return;
  const prefix = 读取业务页面存储前缀(页面会话.user.role);
  const 页面用户 = { ...页面会话.user, _storagePrefix: prefix };

  try {
    清理业务页面会话();
    window.localStorage.setItem(`${prefix}auth_token`, 页面会话.token);
    window.localStorage.setItem(`${prefix}user_info`, JSON.stringify(页面用户));
    window.localStorage.setItem(
      `${prefix}api_user`,
      JSON.stringify({ user: 页面用户, token: 页面会话.token }),
    );
    if (prefix === "partner_") {
      window.localStorage.setItem(
        "api_user",
        JSON.stringify({ user: 页面用户, token: 页面会话.token }),
      );
    }
  } catch {
    清理业务页面会话();
    throw new Error("浏览器无法保存登录状态，请检查隐私模式或存储权限后重试。");
  }
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
