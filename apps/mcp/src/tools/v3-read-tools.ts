import type { McpServer } from "@modelcontextprotocol/server";

import type { McpPrincipal } from "../auth/principal.js";
import type { McpConfig } from "../config.js";
import { V3ApiClient } from "../v3-client/client.js";
import { 转换为文本内容 } from "./common.js";
import { 列表输入结构, 当前身份输出结构, 空对象输入结构, 详情输入结构 } from "./contracts.js";
import { 真实列表输出结构, 真实详情输出结构 } from "./real-contracts.js";

const 只读标注 = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

interface 列表工具配置 {
  toolCode: string;
  pathname: string;
  title: string;
  description: string;
}

interface 详情工具配置 {
  toolCode: string;
  pathname: string;
  title: string;
  description: string;
}

const 列表工具: 列表工具配置[] = [
  {
    toolCode: "v3_product_search",
    pathname: "products/search",
    title: "查询产品目录",
    description: "查询当前用户有权查看的已发布产品和套餐摘要。",
  },
  {
    toolCode: "v3_registration_list",
    pathname: "registrations/search",
    title: "查询客户报备列表",
    description: "按当前用户权限和数据范围查询客户报备摘要。",
  },
  {
    toolCode: "v3_opportunity_list",
    pathname: "opportunities/search",
    title: "查询商机列表",
    description: "按当前用户权限和数据范围查询商机摘要。",
  },
  {
    toolCode: "v3_quote_list",
    pathname: "quotes/search",
    title: "查询报价列表",
    description: "按当前用户权限和数据范围查询报价摘要。",
  },
  {
    toolCode: "v3_order_list",
    pathname: "orders/search",
    title: "查询订单列表",
    description: "按当前用户权限和数据范围查询订单摘要。",
  },
];

const 详情工具: 详情工具配置[] = [
  {
    toolCode: "v3_registration_get",
    pathname: "registrations/get",
    title: "查询单条客户报备",
    description: "按编号查询当前用户有权查看的单条客户报备摘要。",
  },
  {
    toolCode: "v3_opportunity_get",
    pathname: "opportunities/get",
    title: "查询单条商机",
    description: "按编号查询当前用户有权查看的单条商机摘要。",
  },
  {
    toolCode: "v3_quote_get",
    pathname: "quotes/get",
    title: "查询单条报价",
    description: "按编号查询当前用户有权查看的单条报价摘要。",
  },
  {
    toolCode: "v3_order_get",
    pathname: "orders/get",
    title: "查询单条订单",
    description: "按编号查询当前用户有权查看的单条订单摘要。",
  },
];

export function 注册真实只读工具(
  server: McpServer,
  principal: McpPrincipal,
  config: McpConfig,
): void {
  const client = new V3ApiClient(config);
  server.registerTool(
    "v3_current_context",
    {
      title: "读取当前身份摘要",
      description: "读取当前MCP用户在V3中的唯一主身份和权限摘要。",
      inputSchema: 空对象输入结构,
      outputSchema: 当前身份输出结构,
      annotations: 只读标注,
    },
    async () => {
      const data = 当前身份输出结构.parse(await client.call("context", {}, principal));
      return { content: 转换为文本内容(data), structuredContent: data };
    },
  );

  for (const tool of 列表工具) {
    server.registerTool(
      tool.toolCode,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: 列表输入结构,
        outputSchema: 真实列表输出结构,
        annotations: 只读标注,
      },
      async (input) => {
        const data = 真实列表输出结构.parse(await client.call(tool.pathname, input, principal));
        return { content: 转换为文本内容(data), structuredContent: data };
      },
    );
  }

  for (const tool of 详情工具) {
    server.registerTool(
      tool.toolCode,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: 详情输入结构,
        outputSchema: 真实详情输出结构,
        annotations: 只读标注,
      },
      async (input) => {
        const data = 真实详情输出结构.parse(
          await client.call(tool.pathname, { id: input.id }, principal),
        );
        return { content: 转换为文本内容(data), structuredContent: data };
      },
    );
  }
}
