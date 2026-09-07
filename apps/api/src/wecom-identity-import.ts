import crypto from "node:crypto";

import { 应用错误 } from "@lianruan/shared";
import * as XLSX from "xlsx";

export interface 企业微信映射导入行 {
  rowNumber: number;
  displayName: string;
  wecomUserId: string;
}

export interface 企业微信映射导入文件 {
  fileName: string;
  sourceSha256: string;
  rows: 企业微信映射导入行[];
}

export interface 企业微信映射导入用户 {
  id: string;
  username: string;
  displayName: string;
  statusCode: string;
}

export interface 企业微信有效身份 {
  id: string;
  userId: string;
  externalSubject: string;
  externalUsername: string | null;
  statusCode: "active" | "disabled";
}

export type 企业微信映射导入状态 = "ready" | "unchanged" | "waiting_for_user" | "blocked";

export interface 企业微信映射导入预览行 extends 企业微信映射导入行 {
  status: 企业微信映射导入状态;
  message: string;
  user?: Pick<企业微信映射导入用户, "id" | "username" | "displayName">;
}

export interface 企业微信映射导入预览 {
  fileName: string;
  sourceSha256: string;
  rows: 企业微信映射导入预览行[];
  summary: {
    total: number;
    ready: number;
    unchanged: number;
    waitingForUser: number;
    blocked: number;
  };
  canConfirm: boolean;
}

const 最大行数 = 5000;

/**
 * 仅解析受控文件内容；文件不会落盘，也不会在此处访问数据库。
 */
export function 解析企业微信映射文件(fileName: string, content: Buffer): 企业微信映射导入文件 {
  const 安全文件名 = 标准化上传文件名(fileName);
  if (!/\.(xlsx|csv)$/i.test(安全文件名))
    throw new 应用错误(
      "ORG_WECOM_IMPORT_FILE_TYPE_INVALID",
      "企业微信映射文件仅支持 .xlsx 或 UTF-8 .csv 格式。",
      400,
    );
  if (!content.length)
    throw new 应用错误("ORG_WECOM_IMPORT_FILE_EMPTY", "企业微信映射文件不能为空。", 400);

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(content, { type: "buffer", raw: false });
  } catch {
    throw new 应用错误(
      "ORG_WECOM_IMPORT_FILE_PARSE_FAILED",
      "企业微信映射文件无法解析，请确认文件未损坏且 CSV 使用 UTF-8 编码。",
      400,
    );
  }
  const sheetName = workbook.SheetNames[0];
  if (!sheetName || !workbook.Sheets[sheetName])
    throw new 应用错误(
      "ORG_WECOM_IMPORT_SHEET_MISSING",
      "企业微信映射文件未包含可读取的工作表。",
      400,
    );

  const table = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false,
  }) as unknown[][];
  const header = table[0];
  if (!header)
    throw new 应用错误(
      "ORG_WECOM_IMPORT_HEADER_MISSING",
      "企业微信映射文件必须包含“姓名”和“账号”表头。",
      400,
    );

  const headers = header.map(标准化单元格文本);
  const 姓名列 = 读取唯一列(headers, "姓名");
  const 账号列 = 读取唯一列(headers, "账号");
  if (姓名列 < 0 || 账号列 < 0)
    throw new 应用错误(
      "ORG_WECOM_IMPORT_HEADER_INVALID",
      "企业微信映射文件必须包含且仅包含一个“姓名”和一个“账号”表头。",
      400,
    );

  const rows = table.slice(1).map((row, index) => ({
    rowNumber: index + 2,
    displayName: 标准化单元格文本(row[姓名列]),
    wecomUserId: 标准化单元格文本(row[账号列]),
  }));
  if (!rows.length)
    throw new 应用错误("ORG_WECOM_IMPORT_ROW_EMPTY", "企业微信映射文件未包含数据行。", 400);
  if (rows.length > 最大行数)
    throw new 应用错误(
      "ORG_WECOM_IMPORT_ROW_LIMIT_EXCEEDED",
      `企业微信映射文件最多允许 ${最大行数} 条数据行。`,
      400,
    );

  return {
    fileName: 安全文件名,
    sourceSha256: crypto.createHash("sha256").update(content).digest("hex"),
    rows,
  };
}

/**
 * 某些 multipart 客户端会把 UTF-8 文件名按 latin1 传入 multer，导致中文文件名出现“ä¼...”乱码。
 * 仅在能够无损还原为 UTF-8 且还原结果仍是受支持扩展名时采用候选值，避免误改合法文件名。
 */
function 标准化上传文件名(fileName: string): string {
  const 原始文件名 = fileName.trim();
  if (!原始文件名) return 原始文件名;

  const 还原文件名 = Buffer.from(原始文件名, "latin1").toString("utf8").trim();
  if (
    还原文件名 !== 原始文件名 &&
    !还原文件名.includes("\uFFFD") &&
    /\.(xlsx|csv)$/i.test(还原文件名) &&
    /[\u4E00-\u9FFF]/.test(还原文件名)
  )
    return 还原文件名;
  return 原始文件名;
}

/**
 * 将文件行与已查询的 V3 用户、有效企业微信身份进行确定性比对，供预览和确认事务复用。
 */
export function 构建企业微信映射导入预览(
  file: 企业微信映射导入文件,
  users: 企业微信映射导入用户[],
  identities: 企业微信有效身份[],
): 企业微信映射导入预览 {
  const 用户按姓名 = 按键分组(users, (item) => item.displayName);
  const 有效身份 = identities.filter((item) => item.statusCode === "active");
  const 身份按用户 = 按键分组(有效身份, (item) => item.userId);
  const 身份按企微账号 = 按键分组(有效身份, (item) => item.externalSubject);
  const 停用身份按企微账号 = 按键分组(
    identities.filter((item) => item.statusCode === "disabled"),
    (item) => item.externalSubject,
  );
  const 重复姓名 = 重复键(file.rows.map((item) => item.displayName));
  const 重复账号 = 重复键(file.rows.map((item) => item.wecomUserId));

  const rows = file.rows.map<企业微信映射导入预览行>((row) => {
    const 基础 = { ...row };
    const 行错误 = 校验文件行(row);
    if (行错误) return { ...基础, status: "blocked", message: 行错误 };
    if (重复姓名.has(row.displayName))
      return {
        ...基础,
        status: "blocked",
        message: "文件内“姓名”重复，无法严格匹配唯一 V3 账号。",
      };
    if (重复账号.has(row.wecomUserId))
      return { ...基础, status: "blocked", message: "文件内企业微信 UserId 重复。" };

    const 同名用户 = 用户按姓名.get(row.displayName) || [];
    const 启用用户 = 同名用户.filter((item) => item.statusCode === "active");
    if (!启用用户.length)
      return {
        ...基础,
        status: "waiting_for_user",
        message: 同名用户.length
          ? "V3 同名账号当前未启用；账号启用后请重新上传全量文件。"
          : "当前未找到同名启用 V3 账号；账号创建后请重新上传全量文件。",
      };
    if (启用用户.length > 1)
      return { ...基础, status: "blocked", message: "存在多个同名启用 V3 账号，无法严格匹配。" };

    const user = 启用用户[0];
    if (!user) return { ...基础, status: "blocked", message: "无法确定唯一的启用 V3 账号。" };
    const 用户已有身份 = 身份按用户.get(user.id) || [];
    if (用户已有身份.length > 1)
      return {
        ...基础,
        status: "blocked",
        message: "当前 V3 账号存在多条有效企业微信身份，需先人工核对。",
        user: 用户摘要(user),
      };
    if (用户已有身份[0]) {
      if (用户已有身份[0].externalSubject === row.wecomUserId)
        return {
          ...基础,
          status: "unchanged",
          message: "当前 V3 账号已存在相同有效企业微信身份。",
          user: 用户摘要(user),
        };
      return {
        ...基础,
        status: "blocked",
        message: "当前 V3 账号已绑定不同的有效企业微信 UserId，禁止直接覆盖。",
        user: 用户摘要(user),
      };
    }

    const 账号已绑定身份 = 身份按企微账号.get(row.wecomUserId) || [];
    if (账号已绑定身份.length)
      return {
        ...基础,
        status: "blocked",
        message: "企业微信 UserId 已绑定其他有效 V3 账号。",
        user: 用户摘要(user),
      };
    if (停用身份按企微账号.has(row.wecomUserId))
      return {
        ...基础,
        status: "blocked",
        message: "企业微信 UserId 存在历史停用映射，不能自动复用。",
        user: 用户摘要(user),
      };
    return {
      ...基础,
      status: "ready",
      message: "可在确认后新增有效企业微信身份。",
      user: 用户摘要(user),
    };
  });

  const summary = {
    total: rows.length,
    ready: rows.filter((item) => item.status === "ready").length,
    unchanged: rows.filter((item) => item.status === "unchanged").length,
    waitingForUser: rows.filter((item) => item.status === "waiting_for_user").length,
    blocked: rows.filter((item) => item.status === "blocked").length,
  };
  return { ...file, rows, summary, canConfirm: summary.blocked === 0 && summary.ready > 0 };
}

function 标准化单元格文本(value: unknown): string {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim();
}

function 读取唯一列(headers: string[], name: string): number {
  const indexes = headers.reduce<number[]>((all, header, index) => {
    if (header === name) all.push(index);
    return all;
  }, []);
  return indexes.length === 1 ? (indexes[0] ?? -1) : -1;
}

function 校验文件行(row: 企业微信映射导入行): string | undefined {
  if (!row.displayName) return "姓名不能为空。";
  if (row.displayName.length > 200 || 包含控制字符(row.displayName)) return "姓名格式不合法。";
  if (!row.wecomUserId) return "企业微信 UserId 不能为空。";
  if (row.wecomUserId.length > 128 || /\s/.test(row.wecomUserId) || 包含控制字符(row.wecomUserId))
    return "企业微信 UserId 格式不合法。";
  return undefined;
}

function 包含控制字符(value: string): boolean {
  return [...value].some((character) => {
    const code = character.codePointAt(0) || 0;
    return code <= 31 || code === 127;
  });
}

function 按键分组<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const item of items) {
    const groupKey = key(item);
    result.set(groupKey, [...(result.get(groupKey) || []), item]);
  }
  return result;
}

function 重复键(values: string[]): Set<string> {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return new Set([...counts].filter(([, count]) => count > 1).map(([value]) => value));
}

function 用户摘要(user: 企业微信映射导入用户) {
  return { id: user.id, username: user.username, displayName: user.displayName };
}
