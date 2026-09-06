/**
 * 组织架构与企业微信目录同步接口客户端。
 *
 * 本模块只使用签名 Cookie 会话，不读取或写入业务页面本地令牌，避免影响既有业务。
 */

export type 接口对象 = Record<string, unknown>;

export interface 接口元数据 {
  requestId?: string;
  [key: string]: unknown;
}

interface 标准响应<T> {
  success: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
  };
  meta?: 接口元数据;
}

export class 组织接口错误 extends Error {
  public readonly 状态码: number;
  public readonly 错误码: string;
  public readonly 请求编号: string | undefined;

  public constructor(参数: {
    状态码: number;
    错误码?: string | undefined;
    消息?: string | undefined;
    请求编号?: string | undefined;
  }) {
    super(参数.消息 || "组织架构接口请求失败，请稍后重试。");
    this.name = "组织接口错误";
    this.状态码 = 参数.状态码;
    this.错误码 = 参数.错误码 || "ORG_REQUEST_FAILED";
    this.请求编号 = 参数.请求编号;
  }
}

export interface 写入选项 {
  /** 并发修改对象时必须传入当前行版本。 */
  rowVersion?: number;
  /** 写操作的去重标识；网络超时后应使用原值查询结果，不要生成新值重试。 */
  幂等键?: string;
}

export interface 分页参数 {
  page?: number;
  pageSize?: number;
}

export interface 组织状态 {
  enabled: boolean;
  writeEnabled: boolean;
  directorySyncEnabled: boolean;
  accountEntryMerged: boolean;
  accountStatusCheckEnabled: boolean;
  offboardingEnabled: boolean;
}

export interface 组织单元 {
  id: string;
  unitCode: string;
  unitName: string;
  unitType: string;
  parentUnitId: string | null;
  statusCode: string;
  sortOrder: number;
  rowVersion: number;
  children?: 组织单元[];
}

export interface 组织树结果 {
  items: 组织单元[];
}

export interface 岗位 {
  id: string;
  orgUnitId?: string;
  positionCode: string;
  positionName: string;
  category: string;
  statusCode?: string;
  rowVersion: number;
}

export interface 任职 {
  id: string;
  userId?: string;
  displayName?: string;
  orgUnitId?: string;
  positionId?: string | null;
  positionName?: string;
  isPrimary?: boolean;
  effectiveAt?: string;
  expiredAt?: string | null;
  rowVersion: number;
}

export interface 业务角色 {
  id: string;
  roleCode: string;
  roleName: string;
  domainCode: "internal" | "channel";
  category: string;
  statusCode?: string;
  rowVersion: number;
}

/** 任职之间的直属、矩阵或临时负责人关系；不以岗位名称推导权限。 */
export interface 负责人关系 {
  id: string;
  subordinateAssignmentId: string;
  managerAssignmentId: string;
  relationType: "direct" | "matrix" | "temporary";
  subordinateDisplayName?: string;
  managerDisplayName?: string;
  effectiveAt?: string;
  expiredAt?: string | null;
  rowVersion: number;
}

/** 成员业务角色事实，内部任职与渠道成员二选一。 */
export interface 成员业务角色 {
  id: string;
  businessRoleId: string;
  roleCode?: string;
  roleName?: string;
  domainCode?: "internal" | "channel";
  staffAssignmentId?: string | null;
  partnerMemberId?: string | null;
  userId?: string;
  displayName?: string;
  isPrimaryDisplay: boolean;
  effectiveAt?: string;
  expiredAt?: string | null;
  rowVersion: number;
}

export interface 证书模板 {
  id: string;
  templateCode: string;
  templateName: string;
  category: string;
  statusCode?: string;
  rowVersion: number;
}

export interface 成员证书 {
  id: string;
  userId: string;
  displayName: string;
  templateName: string;
  issuedOn: string;
  expiresOn: string | null;
  statusCode: string;
  rowVersion: number;
}

export interface 离职交接单 {
  id: string;
  userId: string;
  displayName?: string;
  statusCode: string;
  effectiveAt: string;
  rowVersion: number;
}

/** 泛微 OA／eteams 正式身份；仅 active 状态可作为流程发起人。 */
export interface 泛微OA正式身份 {
  id: string;
  externalSubject: string;
  externalUsername: string;
  statusCode: "active" | "disabled";
  createdAt?: string;
  updatedAt?: string;
  rowVersion: number;
}

/** 泛微 OA 身份候选。pending 仅用于人工核验，绝不能用于流程发起。 */
export interface 泛微OA身份候选 {
  id: string;
  externalSubject: string;
  externalUsername: string;
  sourceCode: "manual" | "eteams_directory";
  statusCode: "pending" | "confirmed" | "rejected" | "superseded";
  verificationNote?: string | null;
  rejectedReason?: string | null;
  verifiedAt?: string | null;
  verifiedByUsername?: string | null;
  verifiedByName?: string | null;
  createdAt?: string;
  updatedAt?: string;
  rowVersion: number;
}

export interface 泛微OA身份详情 {
  user: { id: string; username: string; displayName: string; statusCode: string };
  formalIdentity: 泛微OA正式身份 | null;
  inactiveFormalIdentities: 泛微OA正式身份[];
  candidates: 泛微OA身份候选[];
  wecomIdentities?: 企业微信身份[];
}

/** 企业微信正式身份；仅用于组织架构账号详情只读展示。 */
export interface 企业微信身份 {
  id: string;
  externalSubject: string;
  externalUsername: string | null;
  statusCode: "active" | "disabled";
  createdAt?: string;
  updatedAt?: string;
  rowVersion: number;
}

export interface 企业微信同步状态 extends 接口对象 {
  enabled: boolean;
  applyEnabled: false;
  mode: "readonly_preview" | "disabled";
  connectors?: 接口对象[];
  latestRun?: 同步批次;
  requestedBy?: string;
}

export interface 同步批次 extends 接口对象 {
  id: string;
  connectorId?: string;
  runType?: string;
  statusCode?: string;
  statistics?: 接口对象;
  createdAt?: string;
  completedAt?: string | null;
  errorSummary?: string;
  writeScope?: "integration_only";
  applyEnabled?: false;
}

export interface 同步差异 extends 接口对象 {
  id: string;
  runId: string;
  objectType: string;
  externalId: string;
  changeType: string;
  riskLevel: string;
  approvalStatus: string;
  applyStatus: string;
  rowVersion: number;
  before?: 接口对象;
  after?: 接口对象;
  /** 保留给审批应用阶段的差异版本；只读预览阶段由 rowVersion 表示版本。 */
  changeVersion?: string | number;
}

export interface 已审批同步差异 {
  id: string;
  rowVersion: number;
  changeVersion?: string | number;
}

export interface 分页结果<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

function 编码路径参数(value: string): string {
  return encodeURIComponent(value);
}

function 构建查询参数(参数: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [键, 值] of Object.entries(参数)) {
    if (值 !== undefined && 值 !== "") query.set(键, String(值));
  }
  const text = query.toString();
  return text ? `?${text}` : "";
}

function 构建写入内容(内容: 接口对象, 选项: 写入选项 = {}): 接口对象 {
  return {
    ...内容,
    ...(选项.rowVersion === undefined ? {} : { rowVersion: 选项.rowVersion }),
  };
}

/** 在页面发起新的写操作时生成一次；重试必须复用原幂等键。 */
export function 生成组织幂等键(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `org-${crypto.randomUUID()}`;
  }
  return `org-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function 发送请求<T>(
  路径: string,
  初始化: RequestInit = {},
  选项: Pick<写入选项, "幂等键"> = {},
): Promise<T> {
  const headers = new Headers(初始化.headers);
  if (初始化.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (选项.幂等键) headers.set("Idempotency-Key", 选项.幂等键);

  let 响应: Response;
  try {
    响应 = await fetch(路径, { ...初始化, credentials: "include", headers });
  } catch {
    throw new 组织接口错误({
      状态码: 0,
      错误码: "ORG_NETWORK_ERROR",
      消息: "网络连接失败，请检查网络后重试。",
    });
  }

  let 内容: 标准响应<T> | undefined;
  try {
    内容 = (await 响应.json()) as 标准响应<T>;
  } catch {
    throw new 组织接口错误({
      状态码: 响应.status,
      错误码: "ORG_RESPONSE_INVALID",
      消息: "组织架构服务返回内容异常，请稍后重试。",
    });
  }

  if (!响应.ok || !内容.success || 内容.data === undefined) {
    throw new 组织接口错误({
      状态码: 响应.status,
      错误码: 内容.error?.code,
      消息: 内容.error?.message || `组织架构接口请求失败（HTTP ${响应.status}）。`,
      请求编号: 内容.meta?.requestId,
    });
  }
  return 内容.data;
}

function 读取<T>(路径: string): Promise<T> {
  return 发送请求<T>(路径);
}

function 写入<T>(
  路径: string,
  method: "POST" | "PUT",
  内容: 接口对象,
  选项: 写入选项 = {},
): Promise<T> {
  return 发送请求<T>(路径, { method, body: JSON.stringify(构建写入内容(内容, 选项)) }, 选项);
}

export function 读取组织状态(): Promise<组织状态> {
  return 读取<组织状态>("/api/org/status");
}

export function 读取组织树(): Promise<组织树结果> {
  return 读取<组织树结果>("/api/org/units/tree");
}

export function 读取渠道组织树(): Promise<{ items: 接口对象[] }> {
  return 读取<{ items: 接口对象[] }>("/api/org/channel-tree");
}

export function 导入部门(rows: 接口对象[], 选项: 写入选项 = {}): Promise<{ imported: number }> {
  return 写入<{ imported: number }>("/api/org/units/import", "POST", { rows }, 选项);
}

export function 导出部门(): Promise<{
  items: Array<{ name: string; parentName: string | null; sortOrder: number; statusCode: string }>;
}> {
  return 读取<{
    items: Array<{
      name: string;
      parentName: string | null;
      sortOrder: number;
      statusCode: string;
    }>;
  }>("/api/org/units/export");
}

export function 导入成员(rows: 接口对象[], 选项: 写入选项 = {}): Promise<{ imported: number }> {
  return 写入<{ imported: number }>("/api/org/staff/import", "POST", { rows }, 选项);
}

export function 导出成员(): Promise<{
  items: Array<{
    username: string;
    displayName: string;
    departmentName: string;
    effectiveAt?: string;
  }>;
}> {
  return 读取<{ items: Array<{ username: string; displayName: string; departmentName: string }> }>(
    "/api/org/staff/export",
  );
}

export function 读取组织详情(id: string): Promise<组织单元> {
  return 读取<组织单元>(`/api/org/units/${编码路径参数(id)}`);
}

export function 创建组织(内容: 接口对象, 选项: 写入选项 = {}): Promise<组织单元> {
  return 写入<组织单元>("/api/org/units", "POST", 内容, 选项);
}

export function 更新组织(id: string, 内容: 接口对象, 选项: 写入选项): Promise<组织单元> {
  return 写入<组织单元>(`/api/org/units/${编码路径参数(id)}`, "PUT", 内容, 选项);
}

export function 更新组织状态(id: string, 内容: 接口对象, 选项: 写入选项): Promise<组织单元> {
  return 写入<组织单元>(`/api/org/units/${编码路径参数(id)}/status`, "PUT", 内容, 选项);
}

export function 查询岗位(orgUnitId?: string): Promise<{ items: 岗位[] }> {
  return 读取<{ items: 岗位[] }>(`/api/org/positions${构建查询参数({ orgUnitId })}`);
}

export function 创建岗位(内容: 接口对象, 选项: 写入选项 = {}): Promise<岗位> {
  return 写入<岗位>("/api/org/positions", "POST", 内容, 选项);
}

export function 更新岗位(id: string, 内容: 接口对象, 选项: 写入选项): Promise<岗位> {
  return 写入<岗位>(`/api/org/positions/${编码路径参数(id)}`, "PUT", 内容, 选项);
}

export function 更新岗位状态(id: string, 内容: 接口对象, 选项: 写入选项): Promise<岗位> {
  return 写入<岗位>(`/api/org/positions/${编码路径参数(id)}/status`, "PUT", 内容, 选项);
}

export function 查询任职(orgUnitId?: string): Promise<{ items: 任职[] }> {
  return 读取<{ items: 任职[] }>(`/api/org/staff${构建查询参数({ orgUnitId })}`);
}

export function 创建任职(userId: string, 内容: 接口对象, 选项: 写入选项 = {}): Promise<任职> {
  return 写入<任职>(`/api/org/staff/${编码路径参数(userId)}/assignments`, "POST", 内容, 选项);
}

export function 更新任职(id: string, 内容: 接口对象, 选项: 写入选项): Promise<任职> {
  return 写入<任职>(`/api/org/assignments/${编码路径参数(id)}`, "PUT", 内容, 选项);
}

export function 结束任职(id: string, 内容: 接口对象, 选项: 写入选项): Promise<任职> {
  return 写入<任职>(`/api/org/assignments/${编码路径参数(id)}/expire`, "PUT", 内容, 选项);
}

export function 查询负责人关系(
  参数: { subordinateAssignmentId?: string } = {},
): Promise<{ items: 负责人关系[] }> {
  return 读取<{ items: 负责人关系[] }>(`/api/org/manager-relations${构建查询参数(参数)}`);
}

export function 创建负责人关系(内容: 接口对象, 选项: 写入选项 = {}): Promise<负责人关系> {
  return 写入<负责人关系>("/api/org/manager-relations", "POST", 内容, 选项);
}

export function 更新负责人关系(id: string, 内容: 接口对象, 选项: 写入选项): Promise<负责人关系> {
  return 写入<负责人关系>(`/api/org/manager-relations/${编码路径参数(id)}`, "PUT", 内容, 选项);
}

export function 结束负责人关系(id: string, 内容: 接口对象, 选项: 写入选项): Promise<负责人关系> {
  return 写入<负责人关系>(
    `/api/org/manager-relations/${编码路径参数(id)}/expire`,
    "PUT",
    内容,
    选项,
  );
}

export function 查询业务角色(): Promise<{ items: 业务角色[] }> {
  return 读取<{ items: 业务角色[] }>("/api/org/business-roles");
}

export function 创建业务角色(内容: 接口对象, 选项: 写入选项 = {}): Promise<业务角色> {
  return 写入<业务角色>("/api/org/business-roles", "POST", 内容, 选项);
}

export function 更新业务角色(id: string, 内容: 接口对象, 选项: 写入选项): Promise<业务角色> {
  return 写入<业务角色>(`/api/org/business-roles/${编码路径参数(id)}`, "PUT", 内容, 选项);
}

export function 更新业务角色状态(id: string, 内容: 接口对象, 选项: 写入选项): Promise<业务角色> {
  return 写入<业务角色>(`/api/org/business-roles/${编码路径参数(id)}/status`, "PUT", 内容, 选项);
}

export function 查询成员业务角色(
  参数: {
    businessRoleId?: string;
    staffAssignmentId?: string;
    partnerMemberId?: string;
  } = {},
): Promise<{ items: 成员业务角色[] }> {
  return 读取<{ items: 成员业务角色[] }>(`/api/org/member-business-roles${构建查询参数(参数)}`);
}

export function 指派成员业务角色(内容: 接口对象, 选项: 写入选项 = {}): Promise<成员业务角色> {
  return 写入<成员业务角色>("/api/org/member-business-roles", "POST", 内容, 选项);
}

export function 结束成员业务角色(
  id: string,
  内容: 接口对象,
  选项: 写入选项,
): Promise<成员业务角色> {
  return 写入<成员业务角色>(
    `/api/org/member-business-roles/${编码路径参数(id)}/expire`,
    "PUT",
    内容,
    选项,
  );
}

export function 查询证书模板(): Promise<{ items: 证书模板[] }> {
  return 读取<{ items: 证书模板[] }>("/api/org/certification-templates");
}

export function 创建证书模板(内容: 接口对象, 选项: 写入选项 = {}): Promise<证书模板> {
  return 写入<证书模板>("/api/org/certification-templates", "POST", 内容, 选项);
}

export function 查询成员证书(userId?: string): Promise<{ items: 成员证书[] }> {
  return 读取<{ items: 成员证书[] }>(`/api/org/member-certifications${构建查询参数({ userId })}`);
}

export function 颁发证书(userId: string, 内容: 接口对象, 选项: 写入选项 = {}): Promise<成员证书> {
  return 写入<成员证书>(
    `/api/org/users/${编码路径参数(userId)}/certifications`,
    "POST",
    内容,
    选项,
  );
}

export function 延期证书(id: string, 内容: 接口对象, 选项: 写入选项): Promise<成员证书> {
  return 写入<成员证书>(
    `/api/org/member-certifications/${编码路径参数(id)}/extend`,
    "PUT",
    内容,
    选项,
  );
}

export function 撤销证书(id: string, 内容: 接口对象, 选项: 写入选项): Promise<成员证书> {
  return 写入<成员证书>(
    `/api/org/member-certifications/${编码路径参数(id)}/revoke`,
    "PUT",
    内容,
    选项,
  );
}

export function 查询离职交接(): Promise<{ items: 离职交接单[] }> {
  return 读取<{ items: 离职交接单[] }>("/api/org/offboarding");
}

export function 发起离职交接(内容: 接口对象, 选项: 写入选项 = {}): Promise<离职交接单> {
  return 写入<离职交接单>("/api/org/offboarding", "POST", 内容, 选项);
}

export function 读取企微同步状态(): Promise<企业微信同步状态> {
  return 读取<企业微信同步状态>("/api/integrations/directory-sync/status");
}

export function 测试企微同步连接(内容: 接口对象 = {}, 选项: 写入选项 = {}): Promise<接口对象> {
  return 写入<接口对象>("/api/integrations/directory-sync/test-connection", "POST", 内容, 选项);
}

export function 生成企微同步预览(内容: 接口对象 = {}, 选项: 写入选项 = {}): Promise<同步批次> {
  return 写入<同步批次>("/api/integrations/directory-sync/preview", "POST", 内容, 选项);
}

export function 创建企微同步批次(内容: 接口对象, 选项: 写入选项 = {}): Promise<同步批次> {
  return 写入<同步批次>("/api/integrations/directory-sync/runs", "POST", 内容, 选项);
}

export function 查询企微同步批次(参数: 分页参数 = {}): Promise<分页结果<同步批次>> {
  return 读取<分页结果<同步批次>>(
    `/api/integrations/directory-sync/runs${构建查询参数({
      page: 参数.page,
      pageSize: 参数.pageSize,
    })}`,
  );
}

export function 读取企微同步批次(id: string): Promise<同步批次> {
  return 读取<同步批次>(`/api/integrations/directory-sync/runs/${编码路径参数(id)}`);
}

export function 查询企微同步差异(
  参数: {
    runId?: string;
    riskLevel?: string;
    approvalStatus?: string;
  } = {},
): Promise<分页结果<同步差异>> {
  return 读取<分页结果<同步差异>>(`/api/integrations/directory-sync/changes${构建查询参数(参数)}`);
}

/**
 * 仅提交明确批准且版本匹配的差异，禁止提供“应用全部差异”的客户端能力。
 */
export function 应用已审批企微同步差异(
  runId: string,
  差异: 已审批同步差异[],
  选项: 写入选项,
): Promise<同步批次> {
  return 写入<同步批次>(
    `/api/integrations/directory-sync/runs/${编码路径参数(runId)}/apply`,
    "POST",
    {
      changes: 差异.map(({ id, rowVersion, changeVersion }) => ({
        id,
        rowVersion,
        ...(changeVersion === undefined ? {} : { changeVersion }),
      })),
    },
    选项,
  );
}

export function 暂停企微同步批次(
  runId: string,
  内容: 接口对象 = {},
  选项: 写入选项 = {},
): Promise<同步批次> {
  return 写入<同步批次>(
    `/api/integrations/directory-sync/runs/${编码路径参数(runId)}/pause`,
    "POST",
    内容,
    选项,
  );
}

export function 读取泛微OA身份(userId: string): Promise<泛微OA身份详情> {
  return 读取<泛微OA身份详情>(`/api/org/users/${编码路径参数(userId)}/eteams-identity`);
}

export function 创建泛微OA身份候选(
  userId: string,
  内容: {
    externalSubject: string;
    externalUsername: string;
    sourceCode: "manual" | "eteams_directory";
  },
  选项: 写入选项 = {},
): Promise<泛微OA身份候选> {
  return 写入<泛微OA身份候选>(
    `/api/org/users/${编码路径参数(userId)}/eteams-identity-candidates`,
    "POST",
    内容,
    选项,
  );
}

export function 更新泛微OA身份候选(
  userId: string,
  candidateId: string,
  内容: {
    externalSubject: string;
    externalUsername: string;
    sourceCode: "manual" | "eteams_directory";
  },
  选项: 写入选项,
): Promise<泛微OA身份候选> {
  return 写入<泛微OA身份候选>(
    `/api/org/users/${编码路径参数(userId)}/eteams-identity-candidates/${编码路径参数(candidateId)}`,
    "PUT",
    内容,
    选项,
  );
}

export function 确认泛微OA身份候选(
  userId: string,
  candidateId: string,
  内容: { verificationNote?: string },
  选项: 写入选项,
): Promise<{ formalIdentity: 泛微OA正式身份; candidate: 泛微OA身份候选 }> {
  return 写入<{ formalIdentity: 泛微OA正式身份; candidate: 泛微OA身份候选 }>(
    `/api/org/users/${编码路径参数(userId)}/eteams-identity-candidates/${编码路径参数(candidateId)}/confirm`,
    "POST",
    内容,
    选项,
  );
}

export function 驳回泛微OA身份候选(
  userId: string,
  candidateId: string,
  内容: { rejectedReason: string },
  选项: 写入选项,
): Promise<泛微OA身份候选> {
  return 写入<泛微OA身份候选>(
    `/api/org/users/${编码路径参数(userId)}/eteams-identity-candidates/${编码路径参数(candidateId)}/reject`,
    "POST",
    内容,
    选项,
  );
}

export function 停用泛微OA身份(
  userId: string,
  内容: { identityId: string; reason: string },
  选项: 写入选项,
): Promise<泛微OA正式身份> {
  return 写入<泛微OA正式身份>(
    `/api/org/users/${编码路径参数(userId)}/eteams-identity/disable`,
    "POST",
    内容,
    选项,
  );
}

/** 账号台账行（组织架构统一维护内部账号；账号本身仍由 IAM 与既有登录链路管理）。 */
export interface 账号台账行 {
  id: string;
  username: string;
  name: string;
  role: string;
  status: string;
  phone?: string;
  email?: string;
  bigRegion?: string;
  region?: string;
  remark?: string;
  createdAt?: string;
  [键: string]: unknown;
}

export function 读取用户列表(): Promise<{ 数据: 接口对象[]; 分页: 接口对象 }> {
  return 发送请求<{ 数据: 接口对象[]; 分页: 接口对象 }>("/api/users?pageSize=1000");
}

export function 创建用户(内容: 接口对象): Promise<接口对象> {
  return 发送请求<接口对象>("/api/users", { method: "POST", body: JSON.stringify(内容) });
}

export function 更新用户(id: string, 内容: 接口对象): Promise<接口对象> {
  return 发送请求<接口对象>(`/api/users/${编码路径参数(id)}`, {
    method: "PUT",
    body: JSON.stringify(内容),
  });
}

export function 更新用户状态(id: string, 状态: string): Promise<接口对象> {
  return 发送请求<接口对象>(`/api/users/${编码路径参数(id)}/status`, {
    method: "PUT",
    body: JSON.stringify({ status: 状态 }),
  });
}

export function 重置用户密码(id: string, 密码: string): Promise<接口对象> {
  return 发送请求<接口对象>(`/api/users/${编码路径参数(id)}/password`, {
    method: "PUT",
    body: JSON.stringify({ password: 密码 }),
  });
}
