/**
 * 业务数据导入客户端。
 *
 * 统一对接后端 V2 兼容导入接口，上传原始文件而不是在前端拆分 CSV。
 * 这样行级校验、编码识别、BOM 处理、重复检查和错误报告都与老 UI 使用同一套业务规则。
 */

import { 响应表示业务会话失效 } from "./auth-client.js";

export type 业务导入类型 = "registrations" | "opportunities" | "partners" | "staff";
export type 业务导出类型 = 业务导入类型 | "orders";

export interface 导入预览行 {
  rowIndex: number;
  data: Record<string, unknown>;
  errors: string[];
}

export interface 导入预览结果 {
  batchId: string;
  preview: 导入预览行[];
  totalCount: number;
  previewCount: number;
  errorCount: number;
  validCount: number;
  headers: string[];
}

export interface 导入结果行 {
  row: number;
  status: "created" | "updated" | "failed";
  message: string;
  targetId?: string;
  changedFields?: string[];
}

export interface 导入执行结果 {
  success: number;
  updated: number;
  profileUpdated: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
  batchId: string;
  taskId: string;
  totalCount: number;
  errorReportUrl: string;
  rows: 导入结果行[];
}

export interface 导入执行响应 {
  成功: boolean;
  消息: string;
  结果?: 导入执行结果;
}

/** 后端预检接口兼容顶层字段和 data 包装两种历史响应。 */
type 导入预览响应 = 导入预览结果 & { data?: 导入预览结果 };

interface 标准响应<T> {
  success?: boolean;
  data?: T;
  error?: string | { message?: string; code?: string };
  message?: string;
  results?: T;
}

function 读取错误提示(错误: 标准响应<unknown>["error"] | undefined, 回退提示: string): string {
  return (typeof 错误 === "string" ? 错误 : 错误?.message) || 回退提示;
}

async function 读取响应内容<T>(响应: Response): Promise<标准响应<T> | null> {
  const 类型 = 响应.headers.get("content-type") || "";
  if (!类型.includes("application/json")) return null;
  return (await 响应.json().catch(() => null)) as 标准响应<T> | null;
}

function 读取下载文件名(响应: Response, 回退: string): string {
  const 处置 = 响应.headers.get("content-disposition") || "";
  const 编码文件名 = 处置.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  return 编码文件名 ? decodeURIComponent(编码文件名) : 回退;
}

async function 下载文件(路径: string, 回退文件名: string): Promise<{ 文件名: string; 内容: Blob }> {
  let 响应: Response;
  try {
    响应 = await fetch(路径, { credentials: "include", cache: "no-store" });
  } catch {
    throw new Error("网络连接失败，请检查网络后重试。");
  }
  if (响应表示业务会话失效(响应)) throw new Error("登录已失效，请重新登录。");
  if (!响应.ok) {
    const 内容 = await 读取响应内容<unknown>(响应);
    throw new Error(读取错误提示(内容?.error, `文件下载失败（HTTP ${响应.status}）。`));
  }
  return { 文件名: 读取下载文件名(响应, 回退文件名), 内容: await 响应.blob() };
}

/** 下载与后端模板完全一致的 Excel 文件，避免前端自造字段导致预检失败。 */
export function 下载导入模板(类型: 业务导入类型): Promise<{ 文件名: string; 内容: Blob }> {
  return 下载文件(`/api/v2/import/${类型}/template`, "导入模板.xlsx");
}

/** 导出当前业务类型的完整结果，服务端按与老 UI 相同的列白名单生成 Excel。 */
export function 导出业务数据(类型: 业务导出类型): Promise<{ 文件名: string; 内容: Blob }> {
  return 下载文件(`/api/v2/export/${类型}`, "业务数据导出.xlsx");
}

export function 下载导入错误报告(路径: string): Promise<{ 文件名: string; 内容: Blob }> {
  return 下载文件(路径, "导入错误报告.csv");
}

async function 上传文件<T>(
  路径: string,
  文件: File,
): Promise<{ 内容: 标准响应<T> | null; 状态码: number }> {
  const 表单 = new FormData();
  // 后端 multer 字段名固定为 file；文件名保留原始中文，错误报告和任务记录会用到。
  表单.append("file", 文件, 文件.name);
  let 响应: Response;
  try {
    响应 = await fetch(路径, {
      method: "POST",
      credentials: "include",
      body: 表单,
      cache: "no-store",
    });
  } catch {
    throw new Error("网络连接失败，请检查网络后重试。");
  }
  if (响应表示业务会话失效(响应)) throw new Error("登录已失效，请重新登录。");
  const 内容 = await 读取响应内容<T>(响应);
  if (!响应.ok) {
    const 错误 = 读取错误提示(内容?.error, `导入请求失败（HTTP ${响应.status}）。`);
    const 异常 = new Error(错误) as Error & { 状态码?: number; 结果?: unknown };
    异常.状态码 = 响应.status;
    异常.结果 = (内容 as { results?: unknown } | null)?.results;
    throw 异常;
  }
  if (!内容?.success) {
    throw new Error(读取错误提示(内容?.error, "导入请求失败，请稍后重试。"));
  }
  return { 内容, 状态码: 响应.status };
}

/** 预检只读取文件，不写业务表；合法行和错误行都在这里返回。 */
export async function 预览导入文件(类型: 业务导入类型, 文件: File): Promise<导入预览结果> {
  const { 内容 } = await 上传文件<导入预览响应>(`/api/v2/import/${类型}/preview`, 文件);
  const 数据 = 内容?.data || (内容 as 导入预览响应 | null);
  if (!数据 || !数据.batchId || !Array.isArray(数据.preview)) {
    throw new Error("导入预检未返回有效结果，请稍后重试。");
  }
  return 数据 as 导入预览结果;
}

/** 执行导入时后端会再次解析并校验文件，合法行写入，错误行跳过。 */
export async function 执行导入文件(类型: 业务导入类型, 文件: File): Promise<导入执行响应> {
  try {
    const { 内容 } = await 上传文件<导入执行结果>(`/api/v2/import/${类型}/execute`, 文件);
    const 结果 = 内容?.data || (内容 as { results?: 导入执行结果 } | null)?.results;
    if (!结果) throw new Error("导入执行未返回有效结果，请稍后重试。");
    return {
      成功: true,
      消息: String(内容?.message || "导入完成。"),
      结果,
    };
  } catch (异常) {
    // 422 表示全部行都未写入，但后端仍返回完整行级结果，页面需要展示而不是只弹一句错误。
    const 错误 = 异常 as Error & { 状态码?: number; 结果?: 导入执行结果 };
    if (错误.状态码 === 422 && 错误.结果) {
      return { 成功: false, 消息: 错误.message, 结果: 错误.结果 };
    }
    throw 异常;
  }
}
