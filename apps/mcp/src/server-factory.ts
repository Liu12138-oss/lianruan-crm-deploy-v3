import { type AuthInfo, McpServer } from "@modelcontextprotocol/server";

import { resolveLocalTestPrincipal } from "./auth/local-test.js";
import { 从OAuth主体创建MCP主体 } from "./auth/oauth.js";
import type { McpPrincipal } from "./auth/principal.js";
import { MCP_SERVER_NAME, MCP_SERVER_VERSION, type McpConfig } from "./config.js";
import { 注册模拟工具 } from "./tools/registry.js";
import { 注册真实只读工具 } from "./tools/v3-read-tools.js";

export function createMcpServer(config: McpConfig, principal: McpPrincipal | null): McpServer {
  const server = new McpServer(
    {
      name: MCP_SERVER_NAME,
      version: MCP_SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
      instructions: "该服务仅提供 V3 受控只读工具。所有业务权限、数据范围和字段策略仍由 V3 决定。",
      cacheHints: {
        "server/discover": { ttlMs: 300_000, cacheScope: "public" },
        "tools/list": {
          ttlMs: config.toolsCacheTtlMs,
          cacheScope: config.toolsCacheScope,
        },
      },
    },
  );

  if (config.enabled && config.realToolsEnabled && principal) {
    注册真实只读工具(server, principal, config);
  } else if (config.enabled && config.localTestMode && principal) {
    注册模拟工具(server, principal, config);
  }

  return server;
}

export function resolveMcpPrincipal(config: McpConfig, authInfo?: AuthInfo): McpPrincipal | null {
  if (config.localTestMode) return resolveLocalTestPrincipal(config);
  if (authInfo) return 从OAuth主体创建MCP主体(authInfo);
  return null;
}
