import type { HealthPath } from "@lianruan/contracts";

const 默认接口地址 = import.meta.env.VITE_API_BASE_URL || "";

export async function 请求健康接口(path: HealthPath): Promise<unknown> {
  const response = await fetch(默认接口地址 + path);
  if (!response.ok) throw new Error("健康检查请求失败：" + response.status);
  return response.json();
}
