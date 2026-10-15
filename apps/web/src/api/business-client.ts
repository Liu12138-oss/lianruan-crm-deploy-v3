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

/** 单项取价过程：原型「软件模块」表要求逐项展示标准价 / 区域覆盖 / 渠道比例 / 最终单价。 */
export interface 产品定价明细 {
  标准单价: number;
  区域覆盖单价: number | null;
  渠道比例: number | null;
  最终单价: number;
  命中说明: string[];
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
    定价明细?: 产品定价明细;
  }>;
  total: number;
  workloadDays: number;
  workloadSummary: string;
  定价上下文?: {
    区域: string;
    渠道层级: string;
    渠道层级名称: string;
    /** 等级价系数（百分比）：一级为 100（基准），二级为 110（一级上浮 10%）。 */
    等级价系数: number | null;
  };
  渠道价格参考?: {
    标准价: number;
    区域覆盖价: number;
    一级: number;
    二级: number;
  };
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

export interface 渠道成员记录 {
  id: string;
  name: string;
  username: string;
  phone: string;
  email: string;
  role: string;
  staffRole?: string;
  status: string;
  partnerId: string;
  partnerName: string;
  partnerMemberId?: string;
  accountRole?: string;
  businessRoleCode?: string;
  certifications?: Array<Record<string, unknown>>;
  rowVersion?: number;
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
    /** 审计分类筛选（仅 audit 模块）：客户/线索/商机/渠道/订单/后台管理操作。 */
    module?: string;
    status?: string;
    level?: string;
    region?: string;
    partnerId?: string;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<阶段9列表结果> {
  const search = new URLSearchParams();
  if (参数.keyword) search.set("keyword", 参数.keyword);
  if (参数.module) search.set("module", 参数.module);
  if (参数.status) search.set("status", 参数.status);
  if (参数.level) search.set("level", 参数.level);
  if (参数.region) search.set("region", 参数.region);
  if (参数.partnerId) search.set("partnerId", 参数.partnerId);
  search.set("page", String(参数.page || 1));
  search.set("pageSize", String(参数.pageSize || 20));
  return 请求<阶段9列表结果>(`/api/stage9/${模块}?${search.toString()}`);
}

/** 渠道经营摘要：按渠道主档过滤客户、商机、报价单、订单的正式记录总数。 */
export interface 渠道经营摘要 {
  客户数: number;
  商机数: number;
  报价单数: number;
  订单数: number;
}

/**
 * 读取单个渠道商的合作经营摘要。
 * 直接复用各业务模块的正式列表接口，服务端会按当前账号的数据范围过滤，
 * 因此渠道账号只会统计到本渠道自己的数据。
 */
export async function 查询渠道经营摘要(渠道编号: string): Promise<渠道经营摘要> {
  const 编号 = String(渠道编号 || "").trim();
  if (!编号) return { 客户数: 0, 商机数: 0, 报价单数: 0, 订单数: 0 };
  const 取总数 = async (模块: 阶段9模块): Promise<number> => {
    const 结果 = await 查询阶段9列表(模块, { partnerId: 编号, page: 1, pageSize: 1 });
    return Number(结果.分页?.总数 || 0);
  };
  const [客户数, 商机数, 报价单数, 订单数] = await Promise.all([
    取总数("registrations"),
    取总数("opportunities"),
    取总数("quotes"),
    取总数("orders"),
  ]);
  return { 客户数, 商机数, 报价单数, 订单数 };
}

/**
 * 分页读取全部记录。
 * 服务端 pageSize 上限为 100，列表页 KPI 与检索必须覆盖全量数据，
 * 因此这里按页拉取直到取满「总数」，并返回服务端给出的真实总数。
 */
export async function 查询阶段9全部(
  模块: 阶段9模块,
  参数: {
    keyword?: string;
    status?: string;
    level?: string;
    region?: string;
    partnerId?: string;
    最大页数?: number;
  } = {},
): Promise<{ 数据: 阶段9记录[]; 总数: number }> {
  const 每页 = 100;
  const 最大页数 = 参数.最大页数 ?? 20;
  const 收集: 阶段9记录[] = [];
  let 页码 = 1;
  let 总数 = 0;
  while (页码 <= 最大页数) {
    const 结果 = await 查询阶段9列表(模块, {
      ...(参数.keyword ? { keyword: 参数.keyword } : {}),
      ...(参数.status ? { status: 参数.status } : {}),
      ...(参数.level ? { level: 参数.level } : {}),
      ...(参数.region ? { region: 参数.region } : {}),
      ...(参数.partnerId ? { partnerId: 参数.partnerId } : {}),
      page: 页码,
      pageSize: 每页,
    });
    总数 = Number(结果.分页?.总数 || 结果.数据.length);
    收集.push(...结果.数据);
    if (结果.数据.length < 每页 || 收集.length >= 总数) break;
    页码 += 1;
  }
  return { 数据: 收集, 总数: 总数 || 收集.length };
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

export async function 更新报备资料(id: string, 输入: Record<string, unknown>): Promise<阶段9记录> {
  return 请求<阶段9记录>(`/api/registrations/${encodeURIComponent(id)}`, {
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

export async function 更新报价(id: string, 输入: Record<string, unknown>): Promise<阶段9记录> {
  return 请求<阶段9记录>(`/api/quotes/${encodeURIComponent(id)}`, {
    method: "PUT",
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

export async function 更新订单状态(
  id: string,
  statusOrInput: string | Record<string, unknown>,
): Promise<阶段9记录> {
  const 输入 = typeof statusOrInput === "string" ? { status: statusOrInput } : statusOrInput;
  return 请求<阶段9记录>(`/api/orders/${encodeURIComponent(id)}/status`, {
    method: "PUT",
    body: JSON.stringify(输入),
  });
}

export async function 调整订单价格(id: string, amount: number, reason: string): Promise<阶段9记录> {
  return 请求<阶段9记录>(`/api/orders/${encodeURIComponent(id)}/price-adjust`, {
    method: "PUT",
    body: JSON.stringify({ amount, reason, action: "price_adjust" }),
  });
}

export async function 确认订单一级(id: string, reason = "一级渠道商确认订单"): Promise<阶段9记录> {
  return 请求<阶段9记录>(`/api/orders/${encodeURIComponent(id)}/primary-confirm`, {
    method: "PUT",
    body: JSON.stringify({ reason }),
  });
}

export async function 驳回订单一级(id: string, reason: string): Promise<阶段9记录> {
  return 请求<阶段9记录>(`/api/orders/${encodeURIComponent(id)}/primary-reject`, {
    method: "PUT",
    body: JSON.stringify({ reason }),
  });
}

export async function 重新提交订单(id: string, input: Record<string, unknown>): Promise<阶段9记录> {
  return 请求<阶段9记录>(`/api/orders/${encodeURIComponent(id)}/resubmit`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function 申请订单修订(
  id: string,
  reason: string,
  changeSnapshot: Record<string, unknown> = {},
): Promise<阶段9记录> {
  return 请求<阶段9记录>(`/api/orders/${encodeURIComponent(id)}/revision-requests`, {
    method: "POST",
    body: JSON.stringify({ reason, changeSnapshot }),
  });
}

export async function 保存渠道成员(
  partnerId: string,
  input: Record<string, unknown>,
  staffId = "",
): Promise<Record<string, unknown>> {
  const path = staffId
    ? `/api/v2/partners/${encodeURIComponent(partnerId)}/staff/${encodeURIComponent(staffId)}`
    : `/api/v2/partners/${encodeURIComponent(partnerId)}/staff`;
  return 请求<Record<string, unknown>>(path, {
    method: staffId ? "PUT" : "POST",
    body: JSON.stringify(input),
  });
}

export async function 更新渠道成员状态(
  partnerId: string,
  staffId: string,
  status: string,
): Promise<Record<string, unknown>> {
  return 请求<Record<string, unknown>>(
    `/api/v2/partners/${encodeURIComponent(partnerId)}/staff/${encodeURIComponent(staffId)}/status`,
    {
      method: "PUT",
      body: JSON.stringify({ status }),
    },
  );
}

export async function 执行订单动作(
  id: string,
  action:
    | "primary_confirm"
    | "primary_reject"
    | "region_confirm"
    | "region_price_adjust"
    | "superadmin_confirm"
    | "superadmin_return"
    | "region_return"
    | "resubmit"
    | "legacy_confirm"
    | "ship"
    | "complete"
    | "cancel"
    | "fulfillment",
  输入: Record<string, unknown> = {},
): Promise<阶段9记录> {
  const 映射: Record<typeof action, { path: string; payload: Record<string, unknown> }> = {
    primary_confirm: { path: "primary-confirm", payload: { status: "confirmed", ...输入 } },
    primary_reject: {
      path: "primary-reject",
      payload: { status: "returned_to_secondary", returnTarget: "secondary", ...输入 },
    },
    region_confirm: {
      path: "status",
      payload: { status: "pending_superadmin_confirm", action: "region_confirm", ...输入 },
    },
    region_price_adjust: {
      path: "price-adjust",
      payload: { status: "pending_superadmin_confirm", action: "price_adjust", ...输入 },
    },
    superadmin_confirm: {
      path: "status",
      payload: { status: "confirmed", action: "superadmin_confirm", ...输入 },
    },
    superadmin_return: {
      path: "status",
      payload: { status: "returned_to_region", action: "return", ...输入 },
    },
    // 区管驳回：退回一级或二级渠道商（返回目标由页面传入，默认退回二级）
    region_return: {
      path: "status",
      payload: { status: "returned_to_secondary", action: "return", returnTarget: "secondary", ...输入 },
    },
    resubmit: { path: "resubmit", payload: { ...输入 } },
    // V2 历史订单：待确认阶段直接确认并进入处理中，与老 UI 口径一致
    legacy_confirm: { path: "status", payload: { status: "processing", action: "legacy_confirm", ...输入 } },
    ship: { path: "status", payload: { status: "shipped", action: "fulfillment", ...输入 } },
    complete: { path: "status", payload: { status: "completed", action: "fulfillment", ...输入 } },
    cancel: { path: "status", payload: { status: "cancelled", action: "fulfillment", ...输入 } },
    fulfillment: { path: "status", payload: { ...输入 } },
  };
  const 对应动作 = 映射[action];
  return 请求<阶段9记录>(`/api/orders/${encodeURIComponent(id)}/${对应动作.path}`, {
    method: "PUT",
    body: JSON.stringify(对应动作.payload),
  });
}

export async function 查询渠道成员(partnerId: string): Promise<渠道成员记录[]> {
  const 渠道 = await 请求<Record<string, unknown>>(
    `/api/v2/partners/${encodeURIComponent(partnerId)}`,
  );
  const 原始成员 = Array.isArray(渠道.staff) ? 渠道.staff : [];
  const 渠道名称 = String(渠道.partnerName || 渠道.name || partnerId);
  return 原始成员.map((成员) => {
    const 记录 = 成员 as Record<string, unknown>;
    return {
      id: String(记录.id || 记录.userId || 记录.username || ""),
      name: String(记录.name || 记录.displayName || 记录.username || ""),
      username: String(记录.username || 记录.userId || ""),
      phone: String(记录.phone || ""),
      email: String(记录.email || ""),
      role: String(记录.staffRole || 记录.role || 记录.accountRole || "员工"),
      staffRole: String(记录.staffRole || 记录.role || ""),
      status: String(记录.status || "active"),
      partnerId: String(记录.partnerId || 渠道.id || partnerId),
      partnerName: String(记录.partnerName || 渠道名称),
      partnerMemberId: String(记录.partnerMemberId || 记录.memberId || ""),
      accountRole: String(记录.accountRole || ""),
      businessRoleCode: String(记录.businessRoleCode || ""),
      certifications: Array.isArray(记录.certifications)
        ? (记录.certifications as Array<Record<string, unknown>>)
        : [],
      ...(Number(记录.rowVersion || 0) ? { rowVersion: Number(记录.rowVersion) } : {}),
    };
  });
}

export async function 重置渠道成员密码(
  partnerId: string,
  staffId: string,
  password = "123456",
): Promise<{ id: string; passwordUpdated: boolean }> {
  return 请求<{ id: string; passwordUpdated: boolean }>(
    `/api/v2/partners/${encodeURIComponent(partnerId)}/staff/${encodeURIComponent(staffId)}/password`,
    {
      method: "PUT",
      body: JSON.stringify({ password }),
    },
  );
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

/**
 * 账号目录：把订单里的用户名（负责区管、提报人等）映射为姓名展示。
 * 服务端每页最多 100 条，按分页读取，最多取 3 页，失败时由调用方回退显示用户名。
 */
export async function 查询账号目录(): Promise<Array<{ username: string; name: string }>> {
  const 结果: Array<{ username: string; name: string }> = [];
  for (let 页码 = 1; 页码 <= 3; 页码 += 1) {
    const 页 = await 请求<{
      数据: Array<Record<string, unknown>>;
      分页?: { 总数?: number };
    }>(`/api/users?page=${页码}&pageSize=100`);
    const 列表 = Array.isArray(页?.数据) ? 页.数据 : [];
    for (const 项 of 列表) {
      const 原始 = (项.原始数据 as Record<string, unknown>) || {};
      const username = String(原始.username || 项.编号 || "").trim();
      const name = String(原始.name || 项.标题 || "").trim();
      if (username && name) 结果.push({ username, name });
    }
    const 总数 = Number(页?.分页?.总数 || 结果.length);
    if (!列表.length || 结果.length >= 总数) break;
  }
  return 结果;
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

export async function 请求<T>(url: string, init: RequestInit = {}): Promise<T> {
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
