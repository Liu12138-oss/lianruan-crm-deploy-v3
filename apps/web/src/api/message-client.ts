import { 处理业务会话失效 } from "./auth-client.js";
import type { 阶段9记录 } from "./business-client.js";

interface 标准响应<T> {
  success: boolean;
  data?: T;
  error?: string | { code?: string; message?: string };
}

interface 统一消息通知 {
  id: string;
  eventCode: string;
  categoryCode: "todo" | "business" | "system" | "security";
  priorityCode: "normal" | "strong" | "forced";
  aggregateType: string;
  aggregateId: string | null;
  targetAction: "view" | "process" | "approve";
  title: string;
  body: string;
  statusCode: "unread" | "read" | "archived";
  createdAt: string;
  readAt: string | null;
  archivedAt: string | null;
  expiresAt: string | null;
}

interface 统一消息列表 {
  items: 统一消息通知[];
  nextCursor: string | null;
}

const 状态名称: Record<统一消息通知["statusCode"], string> = {
  unread: "未读",
  read: "已读",
  archived: "归档",
};

const 类型名称: Record<统一消息通知["categoryCode"], string> = {
  todo: "approval_pending",
  business: "business_reminder",
  system: "system",
  security: "security",
};

function 读取错误提示(错误: 标准响应<unknown>["error"], 回退提示: string): string {
  return (typeof 错误 === "string" ? 错误 : 错误?.message) || 回退提示;
}

async function 请求<T>(路径: string, 选项: RequestInit = {}): Promise<T> {
  let 响应: Response;
  try {
    响应 = await fetch(路径, {
      credentials: "include",
      headers: { "content-type": "application/json", ...(选项.headers || {}) },
      ...选项,
    });
  } catch {
    throw new Error("网络连接失败，请检查网络后重试。");
  }
  const 内容 = (await 响应.json().catch(() => null)) as 标准响应<T> | null;
  if (响应.status === 401) {
    处理业务会话失效();
    throw new Error(读取错误提示(内容?.error, "登录已失效，请重新登录。"));
  }
  if (!响应.ok || !内容?.success || 内容.data === undefined) {
    throw new Error(读取错误提示(内容?.error, "消息请求失败，请稍后重试。"));
  }
  return 内容.data;
}

/** 把统一消息通知转换为新 UI 现有的列表记录结构。 */
export function 统一消息转列表记录(通知: 统一消息通知): 阶段9记录 {
  return {
    id: 通知.id,
    编号: 通知.id,
    类型: "通知",
    标题: 通知.title,
    客户名称: "",
    渠道名称: "",
    负责人: "",
    区域: "",
    状态: 通知.statusCode,
    状态名称: 状态名称[通知.statusCode],
    金额: 0,
    创建时间: 通知.createdAt,
    更新时间: 通知.readAt || 通知.createdAt,
    原始数据: {
      type: 类型名称[通知.categoryCode],
      desc: 通知.body,
      content: 通知.body,
      eventCode: 通知.eventCode,
      aggregateType: 通知.aggregateType,
      aggregateId: 通知.aggregateId,
      targetAction: 通知.targetAction,
      categoryCode: 通知.categoryCode,
      priorityCode: 通知.priorityCode,
    },
  };
}

export async function 查询统一消息列表(
  参数: {
    limit?: number;
    cursor?: string;
    status?: string;
    category?: string;
    keyword?: string;
  } = {},
): Promise<{ 数据: 阶段9记录[]; 下一页游标: string | null }> {
  const 查询 = new URLSearchParams();
  查询.set("limit", String(Math.min(100, Math.max(1, 参数.limit || 20))));
  if (参数.cursor) 查询.set("cursor", 参数.cursor);
  if (参数.status) 查询.set("status", 参数.status);
  if (参数.category) 查询.set("category", 参数.category);
  if (参数.keyword) 查询.set("keyword", 参数.keyword);
  const 结果 = await 请求<统一消息列表>(`/api/messages/notifications?${查询.toString()}`);
  return {
    数据: 结果.items.map(统一消息转列表记录),
    下一页游标: 结果.nextCursor,
  };
}

/** 按游标读取统一消息，最多读取指定页数，避免消息中心一次性拉取无限历史。 */
export async function 查询统一消息全部(
  最大页数 = 5,
  状态?: string,
): Promise<{ 数据: 阶段9记录[]; 总数: number }> {
  const 数据: 阶段9记录[] = [];
  let 游标: string | null = null;
  for (let 页码 = 0; 页码 < Math.max(1, 最大页数); 页码 += 1) {
    const 结果 = await 查询统一消息列表({
      limit: 100,
      ...(游标 ? { cursor: 游标 } : {}),
      ...(状态 ? { status: 状态 } : {}),
    });
    数据.push(...结果.数据);
    游标 = 结果.下一页游标;
    if (!游标) break;
  }
  return { 数据, 总数: 数据.length };
}

/** 归档只改变消息在列表中的可见状态，不删除审计和业务记录。 */
export async function 归档统一消息(id: string): Promise<{ updated: boolean; message: string }> {
  const 结果 = await 请求<{ updated: boolean }>(
    `/api/messages/notifications/${encodeURIComponent(id)}/archive`,
    { method: "PUT" },
  );
  return { ...结果, message: 结果.updated ? "消息已归档。" : "该消息已归档。" };
}

export async function 标记统一消息已读(id = ""): Promise<{ updated: boolean; message: string }> {
  if (id) {
    const 结果 = await 请求<{ updated: boolean }>(
      `/api/messages/notifications/${encodeURIComponent(id)}/read`,
      { method: "PUT" },
    );
    return { ...结果, message: 结果.updated ? "消息已标记为已读。" : "该消息已是已读状态。" };
  }
  const 结果 = await 请求<{ updatedCount: number }>("/api/messages/notifications/read-all", {
    method: "PUT",
  });
  return {
    updated: 结果.updatedCount > 0,
    message:
      结果.updatedCount > 0 ? `已标记 ${结果.updatedCount} 条消息为已读。` : "暂无未读消息。",
  };
}

export interface 消息分类偏好 {
  inAppEnabled: boolean;
  wecomEnabled: boolean;
  smsEnabled: boolean;
  emailEnabled: boolean;
}

export interface 消息个人偏好 {
  inAppEnabled: boolean;
  wecomEnabled: boolean;
  smsEnabled: boolean;
  emailEnabled: boolean;
  doNotDisturbStart: string;
  doNotDisturbEnd: string;
  categoryPreferences: Partial<Record<"todo" | "business" | "system" | "security", 消息分类偏好>>;
}

export function 查询消息偏好(): Promise<消息个人偏好> {
  return 请求<消息个人偏好>("/api/messages/preferences");
}

export function 更新消息偏好(内容: Partial<消息个人偏好>): Promise<消息个人偏好> {
  return 请求<消息个人偏好>("/api/messages/preferences", {
    method: "PUT",
    body: JSON.stringify(内容),
  });
}
