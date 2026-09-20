import { randomUUID } from "node:crypto";

export const MOCK_TOOL_VERSION = "1.0.0";

export function 创建请求编号(): string {
  return `req_${randomUUID()}`;
}

export function 创建分页游标(offset: number): string {
  return Buffer.from(`offset:${offset}`, "utf8").toString("base64url");
}

export function 解析分页游标(cursor: string | undefined): number {
  if (!cursor) return 0;
  const decoded = Buffer.from(cursor, "base64url").toString("utf8");
  const match = /^offset:(\d+)$/.exec(decoded);
  if (!match?.[1]) throw new Error("分页游标无效，请重新查询。");
  const offset = Number(match[1]);
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new Error("分页游标无效，请重新查询。");
  }
  return offset;
}

export function 校验日期范围(from: string | undefined, to: string | undefined): void {
  if (from && to && from > to) throw new Error("from 不得晚于 to。");
}

export function 转换为文本内容(value: unknown): [{ type: "text"; text: string }] {
  return [{ type: "text", text: JSON.stringify(value) }];
}
