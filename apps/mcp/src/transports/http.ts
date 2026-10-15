import { createServer, type Server, type ServerResponse } from "node:http";

import { hostHeaderValidation, originValidation, toNodeHandler } from "@modelcontextprotocol/node";
import {
  type AuthInfo,
  createMcpHandler,
  OAuthError,
  verifyBearerToken,
} from "@modelcontextprotocol/server";

import { 创建OAuth令牌校验器 } from "../auth/oauth.js";
import type { McpConfig } from "../config.js";
import { createMcpServer, resolveMcpPrincipal } from "../server-factory.js";

export interface RunningMcpHttpServer {
  server: Server;
  close(): Promise<void>;
}

export async function 启动Http服务(config: McpConfig): Promise<RunningMcpHttpServer> {
  const oauthVerifier = 创建OAuth令牌校验器(config);
  const handler = createMcpHandler(
    (ctx) => createMcpServer(config, resolveMcpPrincipal(config, ctx.authInfo)),
    {
      legacy: "reject",
      onerror(error) {
        console.error(`[mcp] HTTP处理错误：${error.message}`);
      },
    },
  );
  const nodeMcpHandler = toNodeHandler(handler, {
    onerror(error) {
      console.error(`[mcp] HTTP适配错误：${error.message}`);
    },
  });
  const validateHost = hostHeaderValidation(config.allowedHostnames);
  const allowedOriginHostnames = config.oauthAllowedOrigins.flatMap((origin) => {
    try {
      return [new URL(origin).hostname];
    } catch {
      return [];
    }
  });
  const validateOrigin = originValidation(
    Array.from(new Set([...config.allowedHostnames, ...allowedOriginHostnames])),
  );

  const server = createServer(async (req, res) => {
    const pathname = new URL(req.url || "/", "http://localhost").pathname;
    if (pathname === "/health/live" || pathname === "/health/ready") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify({
          success: true,
          data: {
            status: config.enabled ? "ok" : "disabled",
            service: "mcp",
          },
        }),
      );
      return;
    }

    if (pathname === "/.well-known/oauth-protected-resource") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify({
          resource: config.oauthResource,
          authorization_servers: config.oauthIssuer ? [config.oauthIssuer] : [],
          scopes_supported: config.oauthScopes,
        }),
      );
      return;
    }

    if (pathname !== "/mcp") {
      res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify({ jsonrpc: "2.0", error: { code: -32601, message: "Not found" }, id: null }),
      );
      return;
    }

    if (req.method !== "POST") {
      res.writeHead(405, { "content-type": "application/json; charset=utf-8", allow: "POST" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32600, message: "Method not allowed" },
          id: null,
        }),
      );
      return;
    }

    if (!validateHost(req, res) || !validateOrigin(req, res)) return;
    if (!config.localTestMode) {
      if (!oauthVerifier) {
        写入OAuth挑战(res, req.headers.authorization, config);
        return;
      }
      try {
        const authInfo = await verifyBearerToken(req.headers.authorization, {
          verifier: oauthVerifier,
          requiredScopes: config.oauthScopes.includes("mcp:connect") ? ["mcp:connect"] : [],
        });
        if (!是允许的客户端(config, authInfo)) {
          写入拒绝响应(res, 403, "MCP_CLIENT_NOT_ALLOWED", "当前MCP客户端未获授权。");
          return;
        }
        const username = 读取Auth文本(authInfo, "username");
        if (!是允许的用户(config, username)) {
          写入拒绝响应(res, 403, "MCP_USER_NOT_ALLOWED", "当前账号未获MCP接入权限。");
          return;
        }
        (req as typeof req & { auth?: AuthInfo }).auth = authInfo;
      } catch (error) {
        if (error instanceof OAuthError) {
          写入OAuth挑战(res, req.headers.authorization, config);
          return;
        }
        res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32603, message: "MCP认证服务异常" },
            id: null,
          }),
        );
        return;
      }
    }
    void nodeMcpHandler(req as Parameters<typeof nodeMcpHandler>[0], res);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, config.bindHost, () => {
      server.off("error", reject);
      resolve();
    });
  });

  return {
    server,
    async close() {
      await handler.close();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

function 是允许的客户端(config: McpConfig, authInfo: AuthInfo): boolean {
  return config.allowedClientIds.length > 0 && config.allowedClientIds.includes(authInfo.clientId);
}

function 是允许的用户(config: McpConfig, username: string): boolean {
  if (!username) return false;
  if (config.deniedUsers.includes(username)) return false;
  return config.allowedUsers === "*" || config.allowedUsers.includes(username);
}

function 读取Auth文本(authInfo: AuthInfo, key: string): string {
  const value = authInfo.extra?.[key];
  return typeof value === "string" ? value : "";
}

function 写入OAuth挑战(
  res: ServerResponse,
  authorization: string | string[] | undefined,
  config: McpConfig,
): void {
  const resourceMetadata = new URL(
    "/.well-known/oauth-protected-resource",
    config.oauthResource || "https://mcp.invalid",
  ).toString();
  res.writeHead(401, {
    "content-type": "application/json; charset=utf-8",
    "www-authenticate": `Bearer resource_metadata="${resourceMetadata}", scope="mcp:connect"`,
  });
  res.end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32001,
        message: authorization ? "MCP访问令牌无效或已过期" : "需要MCP授权",
      },
      id: null,
    }),
  );
}

function 写入拒绝响应(
  res: ServerResponse,
  statusCode: number,
  code: string,
  message: string,
): void {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(
    JSON.stringify({ jsonrpc: "2.0", error: { code: -32003, message, data: { code } }, id: null }),
  );
}
