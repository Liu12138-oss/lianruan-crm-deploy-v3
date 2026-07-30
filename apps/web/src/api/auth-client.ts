export interface 登录用户 {
  username: string;
  displayName: string;
  roleName: string;
  defaultPath: string;
  allowedPaths: string[];
}

interface 标准接口响应<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
  };
}

export async function 登录(参数: { username: string; password: string }): Promise<登录用户> {
  const 响应 = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(参数),
  });
  const 内容 = (await 响应.json()) as 标准接口响应<{ user: 登录用户 }>;
  if (!响应.ok || !内容.success || !内容.data) {
    throw new Error(内容.error?.message || "登录失败，请稍后重试。");
  }
  return 内容.data.user;
}

export async function 读取当前用户(): Promise<登录用户> {
  const 响应 = await fetch("/api/auth/me", { credentials: "include" });
  const 内容 = (await 响应.json()) as 标准接口响应<{ user: 登录用户 }>;
  if (!响应.ok || !内容.success || !内容.data) {
    throw new Error(内容.error?.message || "请先登录。");
  }
  return 内容.data.user;
}

export async function 退出登录(): Promise<void> {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });
}
