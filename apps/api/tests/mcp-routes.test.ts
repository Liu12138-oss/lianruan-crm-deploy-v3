import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { 创建测试环境变量 } from "@lianruan/testing";
import { Pool } from "pg";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import { 创建应用 } from "../src/index.js";

const 临时目录列表: string[] = [];
const 应用列表: Array<ReturnType<typeof 创建应用>> = [];

afterEach(async () => {
  await Promise.all(
    应用列表.splice(0).map(async (app) => {
      await app.locals.关闭资源?.();
    }),
  );
  for (const 目录 of 临时目录列表.splice(0)) fs.rmSync(目录, { recursive: true, force: true });
});

describe("MCP内部只读接口", () => {
  it("验证Ed25519主体断言、防重放并返回真实用户上下文", async () => {
    const { 公钥文件, 私钥 } = 创建密钥文件();
    const pool = new Pool({ connectionString: 创建测试环境变量().DATABASE_URL });
    const 用户 = await pool.query<{ id: string; username: string }>(
      `
      SELECT u.id::text AS id, u.username::text AS username
      FROM iam.users u
      JOIN iam.user_roles ur ON ur.user_id = u.id
      JOIN iam.roles r ON r.id = ur.role_id
      WHERE u.status_code = 'active' AND r.role_code = 'superadmin'
      ORDER BY u.created_at
      LIMIT 1
      `,
    );
    await pool.end();
    const principal = 用户.rows[0];
    if (!principal) throw new Error("未找到MCP接口测试用户。");

    const app = 创建应用({
      env: 创建测试环境变量({
        V3_MCP_API_ENABLED: "true",
        V3_MCP_API_PUBLIC_KEY_FILE: 公钥文件,
        V3_MCP_AUDIT_REQUIRED: "true",
      }),
    });
    应用列表.push(app);
    const requestId = "mcp-internal-context-001";
    const assertion = 签发断言(私钥, {
      sub: principal.id,
      username: principal.username,
      clientId: "redclaw-local",
      requestId,
    });

    const 上下文 = await request(app)
      .post("/internal/mcp/context")
      .set("x-request-id", requestId)
      .set("x-v3-mcp-principal", assertion)
      .send({})
      .expect(200);
    expect(上下文.body.data.user.username).toBe(principal.username);
    expect(上下文.body.data.permissionSummary).toContain("superadmin");

    await request(app)
      .post("/internal/mcp/context")
      .set("x-request-id", requestId)
      .set("x-v3-mcp-principal", assertion)
      .send({})
      .expect(401);
  });

  it("拒绝伪造主体断言", async () => {
    const { 公钥文件 } = 创建密钥文件();
    const app = 创建应用({
      env: 创建测试环境变量({
        V3_MCP_API_ENABLED: "true",
        V3_MCP_API_PUBLIC_KEY_FILE: 公钥文件,
      }),
    });
    应用列表.push(app);

    const 响应 = await request(app)
      .post("/internal/mcp/context")
      .set("x-request-id", "mcp-internal-forged-001")
      .set("x-v3-mcp-principal", "forged.assertion.value")
      .send({})
      .expect(401);
    expect(响应.body.error.code).toBe("V3_MCP_PRINCIPAL_INVALID");
  });
});

function 创建密钥文件(): { 公钥文件: string; 私钥: crypto.KeyObject } {
  const 目录 = fs.mkdtempSync(path.join(os.tmpdir(), "v3-mcp-test-"));
  临时目录列表.push(目录);
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const 公钥文件 = path.join(目录, "mcp-public.pem");
  fs.writeFileSync(公钥文件, publicKey.export({ type: "spki", format: "pem" }));
  return { 公钥文件, 私钥: privateKey };
}

function 签发断言(
  私钥: crypto.KeyObject,
  input: { sub: string; username: string; clientId: string; requestId: string },
): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "Ed25519", typ: "JWT" }), "utf8").toString(
    "base64url",
  );
  const payload = Buffer.from(
    JSON.stringify({
      iss: "v3-mcp",
      aud: "v3-api-mcp-internal",
      sub: input.sub,
      username: input.username,
      clientId: input.clientId,
      issuedAt: now,
      expiresAt: now + 60,
      requestId: input.requestId,
      jti: crypto.randomUUID(),
    }),
    "utf8",
  ).toString("base64url");
  const signature = crypto
    .sign(null, Buffer.from(`${header}.${payload}`, "utf8"), 私钥)
    .toString("base64url");
  return `${header}.${payload}.${signature}`;
}
