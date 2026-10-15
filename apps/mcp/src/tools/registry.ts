import type { McpServer } from "@modelcontextprotocol/server";

import type { McpPrincipal } from "../auth/principal.js";
import type { McpConfig } from "../config.js";
import {
  MOCK_TOOL_VERSION,
  创建分页游标,
  创建请求编号,
  校验日期范围,
  解析分页游标,
  转换为文本内容,
} from "./common.js";
import {
  产品搜索输出结构,
  type 列表输入,
  列表输入结构,
  当前身份输出结构,
  报备列表输出结构,
  空对象输入结构,
} from "./contracts.js";
import { 过滤模拟产品, 过滤模拟报备 } from "./mock-data.js";

const 只读标注 = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export function 注册模拟工具(server: McpServer, principal: McpPrincipal, config: McpConfig): void {
  注册当前身份工具(server, principal);
  注册产品搜索工具(server, principal, config);
  注册报备列表工具(server, principal, config);
}

function 注册当前身份工具(server: McpServer, principal: McpPrincipal): void {
  server.registerTool(
    "v3_current_context",
    {
      title: "读取当前身份摘要",
      description: "读取当前 MCP 用户的显示名、人员类型、主组织和主渠道摘要。",
      inputSchema: 空对象输入结构,
      outputSchema: 当前身份输出结构,
      annotations: 只读标注,
    },
    async () => {
      const structuredContent = {
        requestId: 创建请求编号(),
        toolCode: "v3_current_context" as const,
        toolVersion: MOCK_TOOL_VERSION,
        dataAsOf: new Date().toISOString(),
        user: {
          userId: principal.userId,
          username: principal.username,
          displayName: principal.displayName,
          personType: principal.personType,
          primaryOrganization: principal.primaryOrganization,
          primaryPartner: principal.primaryPartner,
        },
        permissionSummary: principal.permissionSummary,
        source: "V3身份上下文" as const,
      };
      return {
        content: 转换为文本内容(structuredContent),
        structuredContent,
      };
    },
  );
}

function 注册产品搜索工具(server: McpServer, principal: McpPrincipal, config: McpConfig): void {
  server.registerTool(
    "v3_product_search",
    {
      title: "查询产品目录",
      description: "查询已发布产品、功能、硬件和套餐的模拟公开字段。",
      inputSchema: 列表输入结构,
      outputSchema: 产品搜索输出结构,
      annotations: 只读标注,
    },
    async (input) => {
      const 输入 = 规范化列表输入(input, config.maxPageSize);
      const items = 过滤模拟产品(输入.keyword, 输入.status, 输入.from, 输入.to);
      const 分页结果 = 分页(items, 输入.cursor, 输入.limit);
      const structuredContent = {
        requestId: 创建请求编号(),
        toolCode: "v3_product_search" as const,
        toolVersion: MOCK_TOOL_VERSION,
        dataAsOf: new Date().toISOString(),
        scopeSummary: principal.personType === "channel" ? "已发布产品公开范围" : "全部已发布产品",
        items: 分页结果.items,
        pageInfo: 分页结果.pageInfo,
        maskedFields: [],
        source: "V3产品目录",
        v3Link: principal.personType === "channel" ? "/partner.html" : "/admin.html",
      };
      return {
        content: 转换为文本内容(structuredContent),
        structuredContent,
      };
    },
  );
}

function 注册报备列表工具(server: McpServer, principal: McpPrincipal, config: McpConfig): void {
  server.registerTool(
    "v3_registration_list",
    {
      title: "查询客户报备列表",
      description: "查询当前模拟用户可见的客户报备摘要。",
      inputSchema: 列表输入结构,
      outputSchema: 报备列表输出结构,
      annotations: 只读标注,
    },
    async (input) => {
      const 输入 = 规范化列表输入(input, config.maxPageSize);
      const items = 过滤模拟报备(principal, 输入.keyword, 输入.status, 输入.from, 输入.to);
      const 分页结果 = 分页(items, 输入.cursor, 输入.limit);
      const structuredContent = {
        requestId: 创建请求编号(),
        toolCode: "v3_registration_list" as const,
        toolVersion: MOCK_TOOL_VERSION,
        dataAsOf: new Date().toISOString(),
        scopeSummary: principal.personType === "channel" ? "本渠道模拟范围" : "内部模拟范围",
        items: 分页结果.items.map(({ visibleToChannel: _visibleToChannel, ...item }) => item),
        pageInfo: 分页结果.pageInfo,
        maskedFields: principal.personType === "channel" ? ["contactPhone", "contactEmail"] : [],
        source: "V3客户报备",
        v3Link: principal.personType === "channel" ? "/partner.html" : "/admin.html",
      };
      return {
        content: 转换为文本内容(structuredContent),
        structuredContent,
      };
    },
  );
}

function 规范化列表输入(input: 列表输入, maxPageSize: number): 列表输入 {
  const 规范化输入 = { ...input, limit: Math.min(input.limit, maxPageSize) };
  校验日期范围(规范化输入.from, 规范化输入.to);
  return 规范化输入;
}

function 分页<T>(
  items: readonly T[],
  cursor: string | undefined,
  limit: number,
): {
  items: T[];
  pageInfo: { nextCursor: string | null; hasNext: boolean; truncated: boolean };
} {
  const offset = 解析分页游标(cursor);
  const pageItems = items.slice(offset, offset + limit);
  const nextOffset = offset + pageItems.length;
  const hasNext = nextOffset < items.length;
  return {
    items: pageItems,
    pageInfo: {
      nextCursor: hasNext ? 创建分页游标(nextOffset) : null,
      hasNext,
      truncated: hasNext,
    },
  };
}
