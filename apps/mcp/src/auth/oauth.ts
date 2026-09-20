import {
  type AuthInfo,
  OAuthError,
  OAuthErrorCode,
  type OAuthTokenVerifier,
} from "@modelcontextprotocol/server";
import { createRemoteJWKSet, type JWTPayload, jwtVerify } from "jose";

import type { McpConfig } from "../config.js";
import type { McpPrincipal } from "./principal.js";

export function 创建OAuth令牌校验器(config: McpConfig): OAuthTokenVerifier | null {
  const issuer = config.oauthIssuer;
  const audience = config.oauthAudience;
  const jwksUrl = config.oauthJwksUrl;
  if (!issuer || !audience || !jwksUrl) return null;
  const jwks = createRemoteJWKSet(new URL(jwksUrl));
  return {
    async verifyAccessToken(token: string): Promise<AuthInfo> {
      let payload: JWTPayload;
      try {
        const result = await jwtVerify(token, jwks, {
          issuer,
          audience,
          algorithms: ["RS256", "ES256", "EdDSA"],
          clockTolerance: 5,
        });
        payload = result.payload;
      } catch {
        throw new OAuthError(OAuthErrorCode.InvalidToken, "MCP访问令牌无效或已过期。");
      }
      const resource = 读取文本声明(payload.resource);
      if (config.oauthResource && resource && resource !== config.oauthResource) {
        throw new OAuthError(OAuthErrorCode.InvalidToken, "MCP访问令牌资源受众不匹配。");
      }
      const sub = 读取文本声明(payload.sub);
      if (!sub) throw new OAuthError(OAuthErrorCode.InvalidToken, "MCP访问令牌缺少用户主体。");
      const username =
        读取文本声明(payload.preferred_username) ||
        读取文本声明(payload.username) ||
        读取文本声明(payload.email) ||
        sub;
      const clientId = 读取文本声明(payload.client_id) || 读取文本声明(payload.azp) || "mcp-client";
      const scopes = 读取范围声明(payload.scope, payload.scp);
      return {
        token,
        clientId,
        scopes,
        ...(typeof payload.exp === "number" ? { expiresAt: payload.exp } : {}),
        ...(config.oauthResource ? { resource: new URL(config.oauthResource) } : {}),
        extra: { userId: sub, username },
      };
    },
  };
}

export function 从OAuth主体创建MCP主体(authInfo: AuthInfo): McpPrincipal | null {
  const userId = 读取文本声明(authInfo.extra?.userId);
  const username = 读取文本声明(authInfo.extra?.username);
  if (!userId || !username) return null;
  return {
    userId,
    username,
    displayName: username,
    personType: "internal",
    primaryOrganization: "",
    primaryPartner: null,
    permissionSummary: authInfo.scopes,
  };
}

function 读取文本声明(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function 读取范围声明(scope: unknown, scp: unknown): string[] {
  if (typeof scope === "string") return scope.split(/\s+/).filter(Boolean);
  if (Array.isArray(scp)) return scp.filter((value): value is string => typeof value === "string");
  return [];
}
