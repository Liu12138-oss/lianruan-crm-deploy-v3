import crypto from "node:crypto";
import fs from "node:fs";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { readMcpConfig } from "../src/config.js";
import { V3ApiClient } from "../src/v3-client/client.js";

const 待清理: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  await Promise.all(待清理.splice(0).map((清理) => 清理()));
});

describe("MCP内部API客户端保护", () => {
  it("按用户执行限流并返回稳定错误", async () => {
    const 目录 = fs.mkdtempSync(path.join(os.tmpdir(), "v3-mcp-client-"));
    const 私钥文件 = path.join(目录, "private.pem");
    const { privateKey } = crypto.generateKeyPairSync("ed25519");
    fs.writeFileSync(私钥文件, privateKey.export({ type: "pkcs8", format: "pem" }));
    const server = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ success: true, data: { requestId: "req", toolCode: "test" } }));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("未取得客户端测试端口。");
    const config = readMcpConfig({
      NODE_ENV: "test",
      V3_MCP_ENABLED: "true",
      V3_MCP_LOCAL_TEST_MODE: "true",
      V3_MCP_LOCAL_TEST_USER: "internal-demo",
      V3_MCP_LOCAL_TEST_USER_ID: "00000000-0000-4000-8000-000000000101",
      V3_MCP_LOCAL_TEST_USERNAME: "internal-demo",
      V3_MCP_REAL_TOOLS_ENABLED: "true",
      V3_MCP_API_BASE_URL: `http://127.0.0.1:${address.port}`,
      V3_MCP_SERVICE_KEY_FILE: 私钥文件,
      V3_MCP_RATE_LIMIT_PER_USER: "1",
    });
    const client = new V3ApiClient(config);
    const principal = {
      userId: "00000000-0000-4000-8000-000000000101",
      username: "internal-demo",
      displayName: "内部测试用户",
      personType: "internal" as const,
      primaryOrganization: "测试总部",
      primaryPartner: null,
      permissionSummary: ["internal"],
    };
    await client.call("test", {}, principal);
    await expect(client.call("test", {}, principal)).rejects.toMatchObject({
      code: "V3_MCP_RATE_LIMITED",
      statusCode: 429,
    });
    待清理.push(
      async () => await new Promise<void>((resolve) => server.close(() => resolve())),
      () => fs.rmSync(目录, { recursive: true, force: true }),
    );
  });
});
