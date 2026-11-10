import { 响应表示业务会话失效 } from "../../api/auth-client.js";
import type { 渠道经营摘要 } from "../../api/business-client.js";

export interface 渠道核心档案 {
  id: string;
  partnerId?: string;
  partnerName?: string;
  name?: string;
  level?: string;
  partnerLevel?: string;
  cooperationLevel?: string;
  parentPartnerIds?: string[];
  parentPartnerNames?: string[];
  childPartnerIds?: string[];
  childPartnerNames?: string[];
  childPartnerCount?: number;
  relationship?: "self" | "parent" | "child" | "internal";
  region?: string;
  city?: string;
  status?: string;
  contact?: string;
  phone?: string;
  email?: string;
  address?: string;
  agreementNo?: string;
  countryCallingCode?: string;
  techServiceType?: string;
  bigRegion?: string;
  memberCount?: number;
  businessSummary?: 渠道经营摘要;
  year?: number;
  targetAmount?: number;
  remark?: string;
  updatedAt?: string;
  actualOrderAmount?: number;
  canEditOrderTarget?: boolean;
  profile?: Record<string, unknown>;
  permissions?: {
    canEditProfile?: boolean;
    canMaintainLevel?: boolean;
    canManageProducts?: boolean;
  };
  matrix?: unknown[];
  [key: string]: unknown;
}

interface 标准响应<T> {
  success: boolean;
  data?: T;
  error?: string | { message?: string };
}

/** V2 兼容接口错误可能是字符串，也可能是带 message 的对象，两种都要原样显示。 */
function 读取错误提示(内容: 标准响应<unknown>, 回退提示: string): string {
  const 错误 = 内容.error;
  if (typeof 错误 === "string" && 错误.trim()) return 错误.trim();
  if (错误 && typeof 错误 === "object" && typeof 错误.message === "string") {
    const 提示 = 错误.message.trim();
    if (提示) return 提示;
  }
  return 回退提示;
}

export async function 查询渠道核心档案(partnerId: string): Promise<渠道核心档案> {
  const 响应 = await fetch(`/api/v2/partners/${encodeURIComponent(partnerId)}/profile`, {
    credentials: "include",
  });
  if (响应表示业务会话失效(响应)) throw new Error("登录已失效，请重新登录。");
  const 内容 = (await 响应.json()) as 标准响应<渠道核心档案>;
  if (!响应.ok || !内容.success || !内容.data) {
    throw new Error(读取错误提示(内容, "读取渠道核心档案失败。"));
  }
  return 内容.data;
}

/** 标准地市选项用于新建渠道的城市检索，前端在此列表基础上生成拼音和首字母别名。 */
export async function 查询标准城市选项(): Promise<string[]> {
  const 响应 = await fetch("/api/v2/meta/city-options", { credentials: "include" });
  if (响应表示业务会话失效(响应)) throw new Error("登录已失效，请重新登录。");
  const 内容 = (await 响应.json()) as 标准响应<{ items?: string[] }>;
  if (!响应.ok || !内容.success || !Array.isArray(内容.data?.items)) {
    throw new Error(读取错误提示(内容, "读取标准城市选项失败。"));
  }
  return 内容.data.items.filter((item) => Boolean(String(item || "").trim()));
}

export async function 保存渠道核心档案(
  partnerId: string,
  输入: Record<string, unknown>,
): Promise<渠道核心档案> {
  const 响应 = await fetch(`/api/v2/partners/${encodeURIComponent(partnerId)}/profile`, {
    method: "PUT",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(输入),
  });
  if (响应表示业务会话失效(响应)) throw new Error("登录已失效，请重新登录。");
  const 内容 = (await 响应.json()) as 标准响应<渠道核心档案>;
  if (!响应.ok || !内容.success || !内容.data) {
    throw new Error(读取错误提示(内容, "保存渠道核心档案失败。"));
  }
  return 内容.data;
}

export async function 创建渠道商(输入: Record<string, unknown>): Promise<渠道核心档案> {
  const 响应 = await fetch("/api/v2/partners", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(输入),
  });
  if (响应表示业务会话失效(响应)) throw new Error("登录已失效，请重新登录。");
  const 内容 = (await 响应.json()) as 标准响应<渠道核心档案>;
  if (!响应.ok || !内容.success || !内容.data) {
    throw new Error(读取错误提示(内容, "新建渠道商失败。"));
  }
  return 内容.data;
}

export async function 保存渠道商层级(
  partnerId: string,
  输入: Record<string, unknown>,
): Promise<{
  id: string;
  partnerLevel: string;
  cooperationLevel: string;
  parentPartnerIds: string[];
  parentPartnerId: string;
}> {
  const 响应 = await fetch(`/api/v2/partners/${encodeURIComponent(partnerId)}/level`, {
    method: "PUT",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(输入),
  });
  if (响应表示业务会话失效(响应)) throw new Error("登录已失效，请重新登录。");
  const 内容 = (await 响应.json()) as 标准响应<{
    id: string;
    partnerLevel: string;
    cooperationLevel: string;
    parentPartnerIds: string[];
    parentPartnerId: string;
  }>;
  if (!响应.ok || !内容.success || !内容.data) {
    throw new Error(读取错误提示(内容, "保存渠道商层级失败。"));
  }
  return 内容.data;
}
