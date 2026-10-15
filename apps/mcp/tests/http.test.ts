import { createServer } from "node:http";

import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { afterEach, describe, expect, it } from "vitest";

import { readMcpConfig } from "../src/config.js";
import { type RunningMcpHttpServer, 启动Http服务 } from "../src/transports/http.js";
import { 创建测试配置 } from "./test-config.js";

let 服务: RunningMcpHttpServer | undefined;

afterEach(async () => {
  await 服务?.close();
  服务 = undefined;
});

describe("MCP Streamable HTTP骨架", () => {
  it("只绑定本机并通过单POST端点提供现代协议", async () => {
    const config = {
      ...创建测试配置({
        V3_MCP_TRANSPORT: "streamable-http",
        V3_MCP_HTTP_ENABLED: "true",
      }),
      port: 0,
    };
    服务 = await 启动Http服务(config);
    const address = 服务.server.address();
    if (!address || typeof address === "string") throw new Error("未取得HTTP测试端口。");

    const client = new Client(
      { name: "http-protocol-test", version: "1.0.0" },
      { versionNegotiation: { mode: { pin: "2026-07-28" } } },
    );
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${address.port}/mcp`)),
    );
    const { tools } = await client.listTools();

    expect(tools).toHaveLength(3);
    await client.close();
  });

  it("健康检查可用且非MCP路径拒绝", async () => {
    const config = {
      ...创建测试配置({
        V3_MCP_TRANSPORT: "streamable-http",
        V3_MCP_HTTP_ENABLED: "true",
      }),
      port: 0,
    };
    服务 = await 启动Http服务(config);
    const address = 服务.server.address();
    if (!address || typeof address === "string") throw new Error("未取得HTTP测试端口。");

    const health = await fetch(`http://127.0.0.1:${address.port}/health/live`);
    expect(health.status).toBe(200);
    const unknown = await fetch(`http://127.0.0.1:${address.port}/unknown`);
    expect(unknown.status).toBe(404);
  });

  it("远程模式返回受保护资源元数据并拒绝匿名请求", async () => {
    const config = readMcpConfig(
      {
        NODE_ENV: "production",
        V3_MCP_TRANSPORT: "streamable-http",
        V3_MCP_HTTP_ENABLED: "true",
        V3_MCP_BIND_HOST: "0.0.0.0",
        V3_MCP_ALLOW_INTERNAL_HTTP: "true",
        V3_MCP_OAUTH_ISSUER: "https://iam.example.com",
        V3_MCP_OAUTH_RESOURCE: "https://mcp.example.com/mcp",
        V3_MCP_OAUTH_AUDIENCE: "https://mcp.example.com/mcp",
        V3_MCP_OAUTH_JWKS_URL: "https://iam.example.com/.well-known/jwks.json",
      },
      [],
    );
    服务 = await 启动Http服务({ ...config, port: 0 });
    const address = 服务.server.address();
    if (!address || typeof address === "string") throw new Error("未取得HTTP测试端口。");

    const metadata = await fetch(
      `http://127.0.0.1:${address.port}/.well-known/oauth-protected-resource`,
    );
    expect(metadata.status).toBe(200);
    expect(await metadata.json()).toMatchObject({
      resource: "https://mcp.example.com/mcp",
      authorization_servers: ["https://iam.example.com"],
    });

    const response = await fetch(`http://127.0.0.1:${address.port}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
    });
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("resource_metadata=");
  });

  it("远程模式接受由受信JWKS签发的逐用户JWT", async () => {
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    const publicJwk = await exportJWK(publicKey);
    publicJwk.kid = "test-key";
    const jwksServer = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ keys: [publicJwk] }));
    });
    await new Promise<void>((resolve) => jwksServer.listen(0, "127.0.0.1", resolve));
    const jwksAddress = jwksServer.address();
    if (!jwksAddress || typeof jwksAddress === "string") throw new Error("未取得JWKS测试端口。");

    const config = readMcpConfig(
      {
        NODE_ENV: "production",
        V3_MCP_TRANSPORT: "streamable-http",
        V3_MCP_HTTP_ENABLED: "true",
        V3_MCP_BIND_HOST: "0.0.0.0",
        V3_MCP_ALLOW_INTERNAL_HTTP: "true",
        V3_MCP_ALLOWED_CLIENTS: "test-client",
        V3_MCP_OAUTH_ISSUER: "https://iam.example.com",
        V3_MCP_OAUTH_RESOURCE: "https://mcp.example.com/mcp",
        V3_MCP_OAUTH_AUDIENCE: "https://mcp.example.com/mcp",
        V3_MCP_OAUTH_JWKS_URL: `http://127.0.0.1:${jwksAddress.port}/jwks`,
      },
      [],
    );
    服务 = await 启动Http服务({ ...config, port: 0 });
    const address = 服务.server.address();
    if (!address || typeof address === "string") throw new Error("未取得HTTP测试端口。");

    const token = await new SignJWT({
      client_id: "test-client",
      preferred_username: "alice",
      scope: "mcp:connect",
      resource: "https://mcp.example.com/mcp",
    })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer("https://iam.example.com")
      .setAudience("https://mcp.example.com/mcp")
      .setSubject("user-1")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);
    const response = await fetch(`http://127.0.0.1:${address.port}/mcp`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "mcp-protocol-version": "2026-07-28",
        "mcp-method": "tools/list",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {
          _meta: {
            "io.modelcontextprotocol/protocolVersion": "2026-07-28",
            "io.modelcontextprotocol/clientInfo": { name: "remote-test", version: "1.0.0" },
            "io.modelcontextprotocol/clientCapabilities": {},
          },
        },
      }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ result: { tools: [] } });
    await new Promise<void>((resolve) => jwksServer.close(() => resolve()));
  });
});
