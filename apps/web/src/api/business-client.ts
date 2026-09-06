export type 阶段9模块 =
  | "registrations"
  | "opportunities"
  | "quotes"
  | "orders"
  | "partners"
  | "products"
  | "users"
  | "audit"
  | "openapi"
  | "workload"
  | "importExport"
  | "approvals"
  | "notifications";

export interface 阶段9记录 {
  id: string;
  编号: string;
  类型: string;
  标题: string;
  客户名称: string;
  渠道名称: string;
  负责人: string;
  区域: string;
  状态: string;
  状态名称: string;
  金额: number;
  创建时间: string;
  更新时间: string;
  原始数据: Record<string, unknown>;
}

export interface 阶段9列表结果 {
  数据: 阶段9记录[];
  分页: {
    页码: number;
    每页: number;
    总数: number;
  };
}

export interface 阶段9概览 {
  统计: Array<{
    标题: string;
    数量: number;
    说明: string;
  }>;
  待办: 阶段9记录[];
  最近业务: 阶段9记录[];
  迁移状态: {
    批次编号: string;
    正式落表: string;
    校验结论: string;
  };
}

export interface 报价试算结果 {
  endpoints: number;
  productIds: string[];
  hardwareIds: string[];
  items: Array<{
    id: string;
    名称: string;
    类型: string;
    数量: number;
    单价: number;
    小计: number;
  }>;
  total: number;
  workloadDays: number;
  workloadSummary: string;
}

export interface 开放接口总览 {
  baseUrl: string;
  tokenEndpoint: string;
  tokenTtlSeconds: number;
  coreResources: string[];
  docs: Array<{
    id: string;
    title: string;
    description: string;
    fileName: string;
    available: boolean;
    downloadUrl?: string;
  }>;
}

export interface 开放接口客户端 {
  id: string;
  name: string;
  appKey: string;
  boundUserId: string;
  status: string;
  ipWhitelist: string[];
  allowedResources: string[];
  expiresAt: string;
  remark: string;
  secretResetRequired: boolean;
  boundUser?: { id: string; username: string; name: string; role: string };
}

export interface 开放接口密钥结果 {
  id: string;
  appKey: string;
  appSecret: string;
}

export interface 开放接口日志 {
  id: string;
  requestId: string;
  time: string;
  clientName: string;
  resultCode: number;
  method: string;
  path: string;
  ip: string;
  resultMessage: string;
}

export interface 工作量映射项 {
  featureId: string;
  featureName: string;
  itemType: "feature" | "hardware";
  moduleName: string;
  categoryName: string;
  productCode: string;
  deliveryTags: string[];
  active: boolean;
}

export interface 交付工作量规则项 {
  id: string;
  item: string;
  productTypeLabel: string;
  deliveryTag: string;
  condition: string;
  ruleType: string;
  minPoints: number | null;
  maxPoints: number | null;
  personDays: number;
  comboPersonDays: number | null;
  remark: string;
  active: boolean;
}

interface 标准响应<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
  };
}

export async function 读取阶段9概览(): Promise<阶段9概览> {
  return 请求<阶段9概览>("/api/stage9/overview");
}

export async function 查询阶段9列表(
  模块: 阶段9模块,
  参数: {
    keyword?: string;
    status?: string;
    level?: string;
    region?: string;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<阶段9列表结果> {
  const search = new URLSearchParams();
  if (参数.keyword) search.set("keyword", 参数.keyword);
  if (参数.status) search.set("status", 参数.status);
  if (参数.level) search.set("level", 参数.level);
  if (参数.region) search.set("region", 参数.region);
  search.set("page", String(参数.page || 1));
  search.set("pageSize", String(参数.pageSize || 20));
  return 请求<阶段9列表结果>(`/api/stage9/${模块}?${search.toString()}`);
}

export async function 标记通知已读(): Promise<void> {
  await 请求<{ updated: boolean; message: string }>("/api/notifications/read", {
    method: "PUT",
    body: JSON.stringify({}),
  });
}

export async function 创建报备(输入: Record<string, unknown>): Promise<阶段9记录> {
  return 请求<阶段9记录>("/api/registrations", {
    method: "POST",
    body: JSON.stringify(输入),
  });
}

export async function 更新报备状态(id: string, 输入: Record<string, unknown>): Promise<阶段9记录> {
  return 请求<阶段9记录>(`/api/registrations/${encodeURIComponent(id)}/status`, {
    method: "PUT",
    body: JSON.stringify(输入),
  });
}

export async function 创建商机(输入: Record<string, unknown>): Promise<阶段9记录> {
  return 请求<阶段9记录>("/api/opportunities", {
    method: "POST",
    body: JSON.stringify(输入),
  });
}

export async function 更新商机(id: string, 输入: Record<string, unknown>): Promise<阶段9记录> {
  return 请求<阶段9记录>(`/api/opportunities/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(输入),
  });
}

export async function 试算报价(输入: Record<string, unknown>): Promise<报价试算结果> {
  return 请求<报价试算结果>("/api/quotes/workload-preview", {
    method: "POST",
    body: JSON.stringify(输入),
  });
}

export async function 创建报价(输入: Record<string, unknown>): Promise<阶段9记录> {
  return 请求<阶段9记录>("/api/quotes", {
    method: "POST",
    body: JSON.stringify(输入),
  });
}

export async function 更新报价状态(id: string, 输入: Record<string, unknown>): Promise<阶段9记录> {
  return 请求<阶段9记录>(`/api/quotes/${encodeURIComponent(id)}/status`, {
    method: "PUT",
    body: JSON.stringify(输入),
  });
}

export async function 下载报价PDF(id: string): Promise<{ 文件名: string; 内容: Blob }> {
  const 响应 = await fetch(`/api/quotes/${encodeURIComponent(id)}/pdf`, {
    credentials: "include",
  });
  if (!响应.ok) {
    const 文本 = await 响应.text();
    try {
      const 数据 = JSON.parse(文本) as 标准响应<unknown>;
      throw new Error(数据.error?.message || "报价单 PDF 下载失败，请稍后重试。");
    } catch (错误) {
      if (错误 instanceof Error && 错误.message !== "报价单 PDF 下载失败，请稍后重试。") throw 错误;
      throw new Error("报价单 PDF 下载失败，请稍后重试。");
    }
  }
  const 处置 = 响应.headers.get("content-disposition") || "";
  const 编码文件名 = 处置.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const 文件名 = 编码文件名 ? decodeURIComponent(编码文件名) : `报价单-${id}.pdf`;
  return { 文件名, 内容: await 响应.blob() };
}

export async function 创建订单(输入: Record<string, unknown>): Promise<阶段9记录> {
  return 请求<阶段9记录>("/api/orders", {
    method: "POST",
    body: JSON.stringify(输入),
  });
}

export async function 更新订单状态(id: string, status: string): Promise<阶段9记录> {
  return 请求<阶段9记录>(`/api/orders/${encodeURIComponent(id)}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

export async function 读取开放接口总览(): Promise<开放接口总览> {
  return 请求<开放接口总览>("/api/open-api/overview");
}

export async function 查询开放接口客户端(): Promise<开放接口客户端[]> {
  return 请求<开放接口客户端[]>("/api/open-api/clients");
}

export async function 创建开放接口客户端(输入: Record<string, unknown>): Promise<开放接口密钥结果> {
  return 请求<开放接口密钥结果>("/api/open-api/clients", {
    method: "POST",
    body: JSON.stringify(输入),
  });
}

export async function 更新开放接口客户端(
  id: string,
  输入: Record<string, unknown>,
): Promise<开放接口客户端> {
  return 请求<开放接口客户端>(`/api/open-api/clients/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(输入),
  });
}

export async function 重置开放接口密钥(id: string): Promise<开放接口密钥结果> {
  return 请求<开放接口密钥结果>(`/api/open-api/clients/${encodeURIComponent(id)}/reset-secret`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function 查询开放接口日志(limit = 80): Promise<开放接口日志[]> {
  return 请求<开放接口日志[]>(`/api/open-api/logs?limit=${encodeURIComponent(String(limit))}`);
}

export async function 查询工作量映射(keyword = ""): Promise<工作量映射项[]> {
  const search = new URLSearchParams();
  if (keyword.trim()) search.set("keyword", keyword.trim());
  const query = search.toString();
  return 请求<工作量映射项[]>(`/api/workload/mappings${query ? `?${query}` : ""}`);
}

export async function 保存工作量映射(
  productId: string,
  输入: Record<string, unknown>,
): Promise<工作量映射项> {
  return 请求<工作量映射项>(`/api/workload/mappings/${encodeURIComponent(productId)}`, {
    method: "PUT",
    body: JSON.stringify(输入),
  });
}

export async function 查询交付工作量规则(): Promise<交付工作量规则项[]> {
  return 请求<交付工作量规则项[]>("/api/workload/delivery-rules");
}

export async function 保存交付工作量规则(
  id: string,
  输入: Record<string, unknown>,
): Promise<交付工作量规则项> {
  return 请求<交付工作量规则项>(`/api/workload/delivery-rules/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(输入),
  });
}

async function 请求<T>(url: string, init: RequestInit = {}): Promise<T> {
  const 响应 = await fetch(url, {
    credentials: "include",
    headers: { "content-type": "application/json", ...init.headers },
    ...init,
  });
  const 内容 = (await 响应.json()) as 标准响应<T>;
  if (!响应.ok || !内容.success || 内容.data === undefined) {
    throw new Error(内容.error?.message || "接口请求失败，请稍后重试。");
  }
  return 内容.data;
}
