/**
 * 产品目录维护客户端（新 UI）。
 * 对接 V3 已发布的 V2 兼容产品接口 /api/v2/*，与老 UI 使用同一套数据与字段口径，
 * 避免新 UI 另起一套产品模型导致价格规则、报价试算口径不一致。
 */

import { 响应表示业务会话失效 } from "../../api/auth-client.js";

export interface 阶梯档位 {
  min: number;
  max: number;
  price: number;
}

export interface 区域价格覆盖 {
  region: string;
  regions?: string[];
  enabled?: boolean;
  /** 区域价生效日期，留空表示立即生效。 */
  effectiveAt?: string;
  /** 区域价失效日期，留空表示长期有效。 */
  effectiveTo?: string;
  effectiveFrom?: string;
  effectiveFromDate?: string;
  effectiveToDate?: string;
  tiers?: 阶梯档位[];
  priceFixed?: number | null;
  priceRatioPrimary?: number | null;
  priceRatioSecondary?: number | null;
  priceForPrimary?: 阶梯档位[] | null;
  priceForSecondary?: 阶梯档位[] | null;
}

export interface 产品大类 {
  id: string;
  name: string;
  code: string;
  type: string;
  icon?: string;
  sort?: number;
  status?: string;
  published?: boolean;
  desc?: string;
}

export interface 产品模块 {
  id: string;
  categoryId: string;
  name: string;
  code: string;
  icon?: string;
  sort?: number;
  status?: string;
  published?: boolean;
  desc?: string;
}

export interface 功能产品 {
  id: string;
  name: string;
  productCode: string;
  moduleId: string;
  categoryId?: string;
  priceType: string;
  priceFixed: number;
  tiers: 阶梯档位[];
  unit: string;
  desc?: string;
  required?: boolean;
  published?: boolean;
  status?: string;
  regionPriceOverrides?: 区域价格覆盖[];
  priceRatioPrimary?: number;
  priceRatioSecondary?: number;
  priceForPrimary?: 阶梯档位[] | null;
  priceForSecondary?: 阶梯档位[] | null;
}

export interface 硬件产品 {
  id: string;
  name: string;
  model: string;
  icon?: string;
  priceFixed: number;
  unit: string;
  specs?: string;
  desc?: string;
  published?: boolean;
  status?: string;
}

export interface 产品套餐 {
  id: string;
  name: string;
  code: string;
  icon?: string;
  desc?: string;
  moduleIds?: string[];
  featureIds?: string[];
  hardwareIds?: string[];
  priceFixed?: number;
  status?: string;
  published?: boolean;
}

/** 产品树功能项：同时兼容 V2 业务编号、V3 UUID 和展示编码，供报价页稳定匹配真实产品。 */
export interface 产品树功能 {
  id: string;
  uuid?: string;
  name: string;
  productCode?: string;
  moduleId?: string;
  categoryId?: string;
  icon?: string;
  sort?: number;
  desc?: string;
  unit?: string;
  published?: boolean;
  status?: string;
}

export interface 产品树模块 extends 产品模块 {
  categoryName?: string;
  features: 产品树功能[];
}

export interface 产品树大类 extends 产品大类 {
  modules: 产品树模块[];
}

interface 标准响应<T> {
  success: boolean;
  data?: T;
  error?: { message?: string };
}

async function 请求<T>(url: string, init: RequestInit = {}): Promise<T> {
  const 响应 = await fetch(url, {
    credentials: "include",
    headers: { "content-type": "application/json", ...init.headers },
    ...init,
  });
  if (响应表示业务会话失效(响应)) throw new Error("登录已失效，请重新登录。");
  const 内容 = (await 响应.json()) as 标准响应<T>;
  if (!响应.ok || !内容.success || 内容.data === undefined) {
    throw new Error(内容.error?.message || "产品接口请求失败，请稍后重试。");
  }
  return 内容.data;
}

export async function 查询产品大类(): Promise<产品大类[]> {
  return 请求<产品大类[]>("/api/v2/categories");
}

export async function 保存产品大类(输入: Record<string, unknown>, 编号 = ""): Promise<产品大类> {
  return 请求<产品大类>(
    编号 ? `/api/v2/categories/${encodeURIComponent(编号)}` : "/api/v2/categories",
    { method: 编号 ? "PUT" : "POST", body: JSON.stringify(输入) },
  );
}

export async function 查询产品模块(): Promise<产品模块[]> {
  return 请求<产品模块[]>("/api/v2/modules");
}

export async function 保存产品模块(输入: Record<string, unknown>, 编号 = ""): Promise<产品模块> {
  return 请求<产品模块>(编号 ? `/api/v2/modules/${encodeURIComponent(编号)}` : "/api/v2/modules", {
    method: 编号 ? "PUT" : "POST",
    body: JSON.stringify(输入),
  });
}

export async function 查询功能产品(): Promise<功能产品[]> {
  return 请求<功能产品[]>("/api/v2/features");
}

export async function 保存功能产品(输入: Record<string, unknown>, 编号 = ""): Promise<功能产品> {
  return 请求<功能产品>(
    编号 ? `/api/v2/features/${encodeURIComponent(编号)}` : "/api/v2/features",
    { method: 编号 ? "PUT" : "POST", body: JSON.stringify(输入) },
  );
}

export async function 查询硬件产品(): Promise<硬件产品[]> {
  return 请求<硬件产品[]>("/api/v2/hardware");
}

export async function 保存硬件产品(输入: Record<string, unknown>, 编号 = ""): Promise<硬件产品> {
  return 请求<硬件产品>(
    编号 ? `/api/v2/hardware/${encodeURIComponent(编号)}` : "/api/v2/hardware",
    { method: 编号 ? "PUT" : "POST", body: JSON.stringify(输入) },
  );
}

export async function 查询产品套餐(): Promise<产品套餐[]> {
  return 请求<产品套餐[]>("/api/v2/packages");
}

/** 只读产品树用于报价页的大类、模块和功能排序；不可用时由报价页回退到阶段九产品字段。 */
export async function 查询产品树(): Promise<产品树大类[]> {
  return 请求<产品树大类[]>("/api/v2/product-tree");
}

export async function 保存产品套餐(输入: Record<string, unknown>, 编号 = ""): Promise<产品套餐> {
  return 请求<产品套餐>(
    编号 ? `/api/v2/packages/${encodeURIComponent(编号)}` : "/api/v2/packages",
    { method: 编号 ? "PUT" : "POST", body: JSON.stringify(输入) },
  );
}

export type 产品资源类型 = "features" | "hardware" | "packages" | "categories" | "modules";

/** 发布 / 下架：三种产品统一走各自的 publish 接口。 */
export async function 发布产品(
  资源: 产品资源类型,
  编号: string,
  已发布: boolean,
): Promise<unknown> {
  return 请求<unknown>(`/api/v2/${资源}/${encodeURIComponent(编号)}/publish`, {
    method: "PATCH",
    body: JSON.stringify({ published: 已发布 }),
  });
}

/** 归档（软删除）：归档后产品不再出现在目录与报价选择中。 */
export async function 归档产品(资源: 产品资源类型, 编号: string): Promise<unknown> {
  return 请求<unknown>(`/api/v2/${资源}/${encodeURIComponent(编号)}`, { method: "DELETE" });
}
