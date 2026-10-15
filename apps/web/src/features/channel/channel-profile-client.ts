export interface 渠道核心档案 {
  id: string;
  partnerId?: string;
  partnerName?: string;
  name?: string;
  level?: string;
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
  profile?: Record<string, unknown>;
  permissions?: {
    canEditProfile?: boolean;
    canManageProducts?: boolean;
  };
  matrix?: unknown[];
  [key: string]: unknown;
}

interface 标准响应<T> {
  success: boolean;
  data?: T;
  error?: { message?: string };
}

export async function 查询渠道核心档案(partnerId: string): Promise<渠道核心档案> {
  const 响应 = await fetch(`/api/v2/partners/${encodeURIComponent(partnerId)}/profile`, {
    credentials: "include",
  });
  const 内容 = (await 响应.json()) as 标准响应<渠道核心档案>;
  if (!响应.ok || !内容.success || !内容.data) {
    throw new Error(内容.error?.message || "读取渠道核心档案失败。");
  }
  return 内容.data;
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
  const 内容 = (await 响应.json()) as 标准响应<渠道核心档案>;
  if (!响应.ok || !内容.success || !内容.data) {
    throw new Error(内容.error?.message || "保存渠道核心档案失败。");
  }
  return 内容.data;
}
