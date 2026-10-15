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
    throw new Error(await 读取接口错误消息(响应));
  }

  return (await 响应.json()) as 响应数据;
}

// 统一提取后端结构化错误体中的可读消息（如 {error:{code,message}}），缺失时回退状态码文案。
export async function 读取接口错误消息(响应: Response): Promise<string> {
  const 兜底文案 = `接口请求失败：${响应.status}`;
  let 文本 = "";
  try {
    文本 = await 响应.clone().text();
  } catch {
    return 兜底文案;
  }
  if (!文本) return 兜底文案;
  try {
    return 读取错误值(JSON.parse(文本), 兜底文案);
  } catch {
    return 兜底文案;
  }
}

function 读取错误值(内容: unknown, 兜底文案: string): string {
  if (typeof 内容 === "string") {
    const 文本 = 内容.trim();
    return 文本 && 文本 !== "[object Object]" ? 文本 : 兜底文案;
  }
  if (内容 && typeof 内容 === "object") {
    const 记录 = 内容 as { error?: unknown; message?: unknown; msg?: unknown; detail?: unknown };
    return (
      读取错误值(记录.message, "") ||
      读取错误值(记录.error, "") ||
      读取错误值(记录.msg, "") ||
      读取错误值(记录.detail, "") ||
      兜底文案
    );
  }
  return 兜底文案;
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
