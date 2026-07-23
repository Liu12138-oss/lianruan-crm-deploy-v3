import type { 契约路径 } from "@lianruan/contracts";

export interface 契约请求选项 extends RequestInit {
  路径: 契约路径;
}

export async function 发送契约请求<响应数据>(选项: 契约请求选项): Promise<响应数据> {
  const { 路径, ...请求初始化 } = 选项;
  const 响应 = await fetch(`${读取接口根路径()}${路径}`, {
    headers: {
      "content-type": "application/json",
      ...请求初始化.headers,
    },
    ...请求初始化,
  });

  if (!响应.ok) {
    throw new Error(`接口请求失败：${响应.status}`);
  }

  return (await 响应.json()) as 响应数据;
}

export function 读取接口根路径(): string {
  const 配置值 = import.meta.env.VITE_API_BASE_URL?.trim();
  if (!配置值) {
    return "";
  }

  if (配置值.startsWith("/")) {
    return 配置值.replace(/\/$/, "");
  }

  const 地址 = new URL(配置值);
  if (地址.origin !== window.location.origin) {
    throw new Error("前端接口地址必须使用同源或相对路径。");
  }

  return 地址.pathname.replace(/\/$/, "");
}
