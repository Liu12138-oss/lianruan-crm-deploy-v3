import crypto from "node:crypto";

import { 应用错误 } from "@lianruan/shared";

export interface McpPrincipalAssertion {
  iss: "v3-mcp";
  aud: "v3-api-mcp-internal";
  sub: string;
  username: string;
  clientId: string;
  authorizationVersion?: number;
  issuedAt: number;
  expiresAt: number;
  requestId: string;
  jti: string;
}

const 已使用断言 = new Map<string, number>();

export function 验证Mcp主体断言(
  value: string,
  publicKey: crypto.KeyObject,
  requestId: string,
): McpPrincipalAssertion {
  const parts = value.split(".");
  if (parts.length !== 3) throw 未授权("主体断言格式无效。");
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  if (!encodedHeader || !encodedPayload || !encodedSignature) throw 未授权("主体断言不完整。");
  let header: { alg?: string; typ?: string };
  let payload: McpPrincipalAssertion;
  try {
    header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8")) as {
      alg?: string;
      typ?: string;
    };
    payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as McpPrincipalAssertion;
  } catch {
    throw 未授权("主体断言无法解析。");
  }
  if (header.alg !== "Ed25519" || header.typ !== "JWT") throw 未授权("主体断言算法不受支持。");
  const valid = crypto.verify(
    null,
    Buffer.from(`${encodedHeader}.${encodedPayload}`, "utf8"),
    publicKey,
    Buffer.from(encodedSignature, "base64url"),
  );
  if (!valid) throw 未授权("主体断言签名无效。");

  const now = Math.floor(Date.now() / 1000);
  if (payload.iss !== "v3-mcp" || payload.aud !== "v3-api-mcp-internal") {
    throw 未授权("主体断言签发方或受众无效。");
  }
  if (!payload.sub || !payload.username || !payload.clientId || !payload.jti) {
    throw 未授权("主体断言缺少必要字段。");
  }
  if (payload.requestId !== requestId) throw 未授权("主体断言请求编号不一致。");
  if (!Number.isInteger(payload.issuedAt) || !Number.isInteger(payload.expiresAt)) {
    throw 未授权("主体断言时间字段无效。");
  }
  if (payload.expiresAt <= now || payload.expiresAt - payload.issuedAt > 60) {
    throw 未授权("主体断言已过期或有效期过长。");
  }
  if (payload.issuedAt > now + 5) throw 未授权("主体断言签发时间无效。");
  清理已使用断言(now);
  if (已使用断言.has(payload.jti)) throw 未授权("主体断言已重复使用。");
  已使用断言.set(payload.jti, payload.expiresAt);
  return payload;
}

function 清理已使用断言(now: number): void {
  for (const [jti, expiresAt] of 已使用断言) {
    if (expiresAt <= now) 已使用断言.delete(jti);
  }
}

function 未授权(message: string): 应用错误 {
  return new 应用错误("V3_MCP_PRINCIPAL_INVALID", message, 401);
}
