import crypto from "node:crypto";
import fs from "node:fs";

import type { McpPrincipal } from "../auth/principal.js";
import type { McpConfig } from "../config.js";
import { 创建请求编号 } from "../tools/common.js";

export class V3McpApiError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  public constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.name = "V3McpApiError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class V3ApiClient {
  private readonly apiBaseUrl: string;
  private readonly privateKey: crypto.KeyObject;
  private readonly timeoutMs: number;
  private readonly responseMaxBytes: number;
  private readonly rateLimitPerUser: number;
  private readonly maxConcurrency: number;
  private readonly 用户调用时间 = new Map<string, number[]>();
  private 当前并发 = 0;

  public constructor(config: McpConfig) {
    if (!config.apiBaseUrl || !config.serviceKeyFile) {
      throw new Error("真实MCP工具缺少API地址或主体断言私钥。");
    }
    this.apiBaseUrl = config.apiBaseUrl.replace(/\/$/, "");
    this.privateKey = crypto.createPrivateKey(fs.readFileSync(config.serviceKeyFile, "utf8"));
    this.timeoutMs = config.queryTimeoutMs;
    this.responseMaxBytes = config.responseMaxBytes;
    this.rateLimitPerUser = config.rateLimitPerUser;
    this.maxConcurrency = config.maxConcurrency;
  }

  public async call(
    pathname: string,
    body: Record<string, unknown>,
    principal: McpPrincipal,
  ): Promise<Record<string, unknown>> {
    this.获取调用配额(principal.userId);
    const requestId = 创建请求编号();
    const assertion = this.签发主体断言(requestId, principal);
    this.当前并发 += 1;
    try {
      const response = await fetch(`${this.apiBaseUrl}/${pathname.replace(/^\//, "")}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-request-id": requestId,
          "x-v3-mcp-principal": assertion,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      const text = await response.text();
      if (Buffer.byteLength(text, "utf8") > this.responseMaxBytes) {
        throw new V3McpApiError(
          "V3_MCP_RESPONSE_TOO_LARGE",
          "V3内部只读接口响应超过MCP大小限制。",
          502,
        );
      }
      const payload = 解析响应(text);
      if (!response.ok || payload?.success !== true || !payload.data) {
        throw new V3McpApiError(
          payload?.error?.code || "V3_MCP_API_CALL_FAILED",
          payload?.error?.message || `V3内部只读接口返回HTTP ${response.status}`,
          response.status,
        );
      }
      return payload.data;
    } finally {
      this.当前并发 -= 1;
    }
  }

  private 获取调用配额(userId: string): void {
    if (this.当前并发 >= this.maxConcurrency) {
      throw new V3McpApiError("V3_MCP_SERVICE_BUSY", "MCP服务繁忙，请稍后重试。", 503);
    }
    const now = Date.now();
    const windowStart = now - 60_000;
    const timestamps = (this.用户调用时间.get(userId) || []).filter((time) => time >= windowStart);
    if (timestamps.length >= this.rateLimitPerUser) {
      this.用户调用时间.set(userId, timestamps);
      throw new V3McpApiError("V3_MCP_RATE_LIMITED", "MCP调用频率超过限制。", 429);
    }
    timestamps.push(now);
    this.用户调用时间.set(userId, timestamps);
  }

  private 签发主体断言(requestId: string, principal: McpPrincipal): string {
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: "Ed25519", typ: "JWT" }), "utf8").toString(
      "base64url",
    );
    const payload = Buffer.from(
      JSON.stringify({
        iss: "v3-mcp",
        aud: "v3-api-mcp-internal",
        sub: principal.userId,
        username: principal.username,
        clientId: "redclaw-local",
        authorizationVersion: 1,
        issuedAt: now,
        expiresAt: now + 60,
        requestId,
        jti: crypto.randomUUID(),
      }),
      "utf8",
    ).toString("base64url");
    const signature = crypto
      .sign(null, Buffer.from(`${header}.${payload}`, "utf8"), this.privateKey)
      .toString("base64url");
    return `${header}.${payload}.${signature}`;
  }
}

function 解析响应(text: string): {
  success?: boolean;
  data?: Record<string, unknown>;
  error?: { code?: string; message?: string };
} | null {
  try {
    return JSON.parse(text) as {
      success?: boolean;
      data?: Record<string, unknown>;
      error?: { code?: string; message?: string };
    };
  } catch {
    return null;
  }
}
