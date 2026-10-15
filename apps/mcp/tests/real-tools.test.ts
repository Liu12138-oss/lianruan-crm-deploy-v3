import crypto from "node:crypto";
import fs from "node:fs";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";

import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { afterEach, describe, expect, it } from "vitest";

import { resolveLocalTestPrincipal } from "../src/auth/local-test.js";
import { readMcpConfig } from "../src/config.js";
import { createMcpServer } from "../src/server-factory.js";

const 临时目录列表: string[] = [];
const 待关闭资源: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(待关闭资源.splice(0).map((关闭) => 关闭()));
  for (const 目录 of 临时目录列表.splice(0)) fs.rmSync(目录, { recursive: true, force: true });
});

describe("真实V3只读工具适配", () => {
  it("通过Ed25519主体断言调用内部接口并返回真实工具契约", async () => {
    const { 私钥文件, publicKey } = 创建密钥文件();
    const apiServer = await 启动桩Api(publicKey);
    const address = apiServer.address();
    if (!address || typeof address === "string") throw new Error("未取得桩API端口。");

    const config = readMcpConfig({
      NODE_ENV: "test",
      V3_MCP_ENABLED: "true",
      V3_MCP_TRANSPORT: "stdio",
      V3_MCP_LOCAL_TEST_MODE: "true",
      V3_MCP_LOCAL_TEST_USER: "internal-demo",
      V3_MCP_LOCAL_TEST_USER_ID: "00000000-0000-4000-8000-000000000101",
      V3_MCP_LOCAL_TEST_USERNAME: "internal-demo",
      V3_MCP_REAL_TOOLS_ENABLED: "true",
      V3_MCP_API_BASE_URL: `http://127.0.0.1:${address.port}/internal/mcp`,
      V3_MCP_SERVICE_KEY_FILE: 私钥文件,
    });
    const principal = resolveLocalTestPrincipal(config);
    if (!principal) throw new Error("未解析出真实测试主体。");
    const handler = createMcpHandler(() => createMcpServer(config, principal), {
      legacy: "reject",
    });
    const client = new Client(
      { name: "real-tools-adapter-test", version: "1.0.0" },
      { versionNegotiation: { mode: { pin: "2026-07-28" } } },
    );
    await client.connect(
      new StreamableHTTPClientTransport(new URL("http://test.local/mcp"), {
        fetch: (url, init) => handler.fetch(new Request(url, init)),
      }),
    );

    const { tools } = await client.listTools();
    expect(tools).toHaveLength(10);
    const 上下文 = await client.callTool({ name: "v3_current_context", arguments: {} });
    expect(上下文.structuredContent).toMatchObject({
      user: { userId: principal.userId, username: principal.username },
    });
    const 报备 = await client.callTool({
      name: "v3_registration_list",
      arguments: { limit: 5 },
    });
    expect((报备.structuredContent as { items: unknown[] }).items).toHaveLength(1);

    待关闭资源.push(async () => {
      await client.close();
      await handler.close();
      await new Promise<void>((resolve, reject) =>
        apiServer.close((error) => (error ? reject(error) : resolve())),
      );
    });
  });
});

function 创建密钥文件(): { 私钥文件: string; publicKey: crypto.KeyObject } {
  const 目录 = fs.mkdtempSync(path.join(os.tmpdir(), "v3-mcp-real-test-"));
  临时目录列表.push(目录);
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const 私钥文件 = path.join(目录, "private.pem");
  fs.writeFileSync(私钥文件, privateKey.export({ type: "pkcs8", format: "pem" }));
  return { 私钥文件, publicKey };
}

async function 启动桩Api(publicKey: crypto.KeyObject): Promise<Server> {
  const server = createServer((req, res) => {
    const pathname = new URL(req.url || "/", "http://localhost").pathname;
    const assertion = req.headers["x-v3-mcp-principal"];
    const requestId = req.headers["x-request-id"];
    if (
      typeof assertion !== "string" ||
      typeof requestId !== "string" ||
      !验证断言(assertion, requestId, publicKey)
    ) {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ success: false, error: { code: "V3_MCP_PRINCIPAL_INVALID" } }));
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ success: true, data: 桩响应(pathname, requestId) }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server;
}

function 桩响应(pathname: string, requestId: string): Record<string, unknown> {
  if (pathname.endsWith("/context")) {
    return {
      requestId,
      toolCode: "v3_current_context",
      toolVersion: "1.0.0",
      dataAsOf: new Date().toISOString(),
      user: {
        userId: "00000000-0000-4000-8000-000000000101",
        username: "internal-demo",
        displayName: "内部测试用户",
        personType: "internal",
        primaryOrganization: "测试总部",
        primaryPartner: null,
      },
      permissionSummary: ["internal"],
      source: "V3身份上下文",
    };
  }
  const item = {
    id: "registration-001",
    number: "REG-2026-001",
    type: "客户报备",
    title: "测试客户甲",
    customerName: "测试客户甲",
    partnerName: "渠道甲",
    region: "华南",
    status: "pending",
    statusName: "待处理",
    amount: "0",
    createdAt: "2026-09-18T01:00:00.000Z",
    updatedAt: "2026-09-18T01:00:00.000Z",
  };
  if (pathname.endsWith("/get")) {
    return {
      requestId,
      toolCode: "v3_registration_get",
      toolVersion: "1.0.0",
      dataAsOf: new Date().toISOString(),
      scopeSummary: "按当前V3账号权限和数据范围",
      item,
      maskedFields: ["contactPhone", "contactEmail"],
      source: "V3客户报备",
      v3Link: "/admin.html",
    };
  }
  const toolCode = pathname.endsWith("/products/search")
    ? "v3_product_search"
    : pathname.endsWith("/registrations/search")
      ? "v3_registration_list"
      : pathname.endsWith("/opportunities/search")
        ? "v3_opportunity_list"
        : pathname.endsWith("/quotes/search")
          ? "v3_quote_list"
          : "v3_order_list";
  return {
    requestId,
    toolCode,
    toolVersion: "1.0.0",
    dataAsOf: new Date().toISOString(),
    scopeSummary: "按当前V3账号权限和数据范围",
    items: [item],
    pageInfo: { nextCursor: null, hasNext: false, truncated: false },
    maskedFields: ["contactPhone", "contactEmail"],
    source: "V3业务数据",
    v3Link: "/admin.html",
  };
}

function 验证断言(value: string, requestId: string, publicKey: crypto.KeyObject): boolean {
  const [header, payload, signature] = value.split(".");
  if (!header || !payload || !signature) return false;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      requestId?: string;
    };
    return (
      claims.requestId === requestId &&
      crypto.verify(
        null,
        Buffer.from(`${header}.${payload}`, "utf8"),
        publicKey,
        Buffer.from(signature, "base64url"),
      )
    );
  } catch {
    return false;
  }
}
