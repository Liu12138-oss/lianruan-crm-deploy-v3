import { isIP } from "node:net";

export const MCP_PROTOCOL_VERSION = "2026-07-28";
export const MCP_SERVER_NAME = "lianruan-v3-mcp";
export const MCP_SERVER_VERSION = "3.0.0-stage10.20260906-prod1";

export type McpTransport = "stdio" | "streamable-http";
export type McpCacheScope = "public" | "private";

export interface McpConfig {
  enabled: boolean;
  transport: McpTransport;
  httpEnabled: boolean;
  bindHost: string;
  port: number;
  apiBaseUrl?: string;
  serviceKeyFile?: string;
  allowedClientIds: string[];
  allowedUsers: "*" | string[];
  deniedUsers: string[];
  auditRequired: boolean;
  maxPageSize: number;
  queryTimeoutMs: number;
  responseMaxBytes: number;
  rateLimitPerUser: number;
  maxConcurrency: number;
  toolsCacheTtlMs: number;
  toolsCacheScope: McpCacheScope;
  localTestMode: boolean;
  localTestUser?: "internal-demo" | "channel-demo";
  localTestUserId?: string;
  localTestUsername?: string;
  realToolsEnabled: boolean;
  externalTlsRequired: boolean;
  allowInternalHttp: boolean;
  allowedHostnames: string[];
  oauthIssuer?: string;
  oauthResource?: string;
  oauthAudience?: string;
  oauthJwksUrl?: string;
  oauthScopes: string[];
  oauthAllowedOrigins: string[];
  oauthDcrEnabled: boolean;
  oauthClientRegistration: "pre_registered" | "client_id_metadata";
}

export class McpConfigError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "McpConfigError";
  }
}

export function readMcpConfig(
  env: NodeJS.ProcessEnv = process.env,
  args: readonly string[] = process.argv.slice(2),
): McpConfig {
  const 基础配置 = 读取基础配置(env, args);
  const 安全配置 = 读取安全配置(env, 基础配置);
  const 限制配置 = 读取限制配置(env);
  const oauth配置 = 读取OAuth配置(env);
  const localTestMode = 读取布尔值(env.V3_MCP_LOCAL_TEST_MODE, false, "V3_MCP_LOCAL_TEST_MODE");
  const localTestUser = 读取本地测试用户(env.V3_MCP_LOCAL_TEST_USER, localTestMode);
  const realToolsEnabled = 读取布尔值(
    env.V3_MCP_REAL_TOOLS_ENABLED,
    false,
    "V3_MCP_REAL_TOOLS_ENABLED",
  );
  const localTestUserId = env.V3_MCP_LOCAL_TEST_USER_ID?.trim();
  const localTestUsername = env.V3_MCP_LOCAL_TEST_USERNAME?.trim();
  if (realToolsEnabled) {
    if (!env.V3_MCP_API_BASE_URL?.trim()) {
      throw new McpConfigError("启用真实MCP工具时必须配置 V3_MCP_API_BASE_URL。");
    }
    if (!env.V3_MCP_SERVICE_KEY_FILE?.trim()) {
      throw new McpConfigError("启用真实MCP工具时必须配置 V3_MCP_SERVICE_KEY_FILE。");
    }
    if (localTestMode && (!localTestUserId || !localTestUsername)) {
      throw new McpConfigError(
        "当前阶段使用受控本地测试主体，启用真实MCP工具时必须配置 V3_MCP_LOCAL_TEST_USER_ID 和 V3_MCP_LOCAL_TEST_USERNAME。",
      );
    }
    if (
      !localTestMode &&
      (!env.V3_MCP_OAUTH_ISSUER?.trim() ||
        !env.V3_MCP_OAUTH_RESOURCE?.trim() ||
        !env.V3_MCP_OAUTH_AUDIENCE?.trim() ||
        !env.V3_MCP_OAUTH_JWKS_URL?.trim())
    ) {
      throw new McpConfigError(
        "非本地测试模式启用真实MCP工具时必须配置 OAuth issuer、resource、audience 和 JWKS 地址。",
      );
    }
  }
  验证配置(env, localTestMode, 基础配置, 安全配置, 限制配置);

  return {
    ...基础配置,
    ...安全配置,
    ...限制配置,
    ...oauth配置,
    localTestMode,
    ...(localTestUser ? { localTestUser } : {}),
    ...(localTestUserId ? { localTestUserId } : {}),
    ...(localTestUsername ? { localTestUsername } : {}),
    realToolsEnabled,
  };
}

function 验证配置(
  env: NodeJS.ProcessEnv,
  localTestMode: boolean,
  基础配置: Pick<McpConfig, "transport" | "httpEnabled" | "bindHost">,
  安全配置: Pick<McpConfig, "externalTlsRequired" | "allowInternalHttp">,
  限制配置: Pick<McpConfig, "toolsCacheScope" | "toolsCacheTtlMs">,
): void {
  const nodeEnv = env.NODE_ENV?.trim().toLowerCase();
  if (localTestMode && nodeEnv !== "test" && nodeEnv !== "development") {
    throw new McpConfigError(
      "V3_MCP_LOCAL_TEST_MODE 只允许在 NODE_ENV=test 或 NODE_ENV=development 时启用。",
    );
  }
  if (基础配置.transport === "streamable-http" && !基础配置.httpEnabled) {
    throw new McpConfigError("选择 streamable-http 传输时必须显式设置 V3_MCP_HTTP_ENABLED=true。");
  }
  if (!是否允许Http绑定(基础配置, 安全配置)) {
    throw new McpConfigError(
      "外部 MCP 未启用 HTTPS，且当前绑定地址不是回环地址。生产外部入口必须使用 HTTPS；仅容器内部明文 HTTP 时才允许设置 V3_MCP_ALLOW_INTERNAL_HTTP=true。",
    );
  }
  if (限制配置.toolsCacheScope === "public" && 限制配置.toolsCacheTtlMs > 0) {
    throw new McpConfigError(
      "用户相关 tools/list 不允许公共缓存。V3_MCP_TOOLS_CACHE_SCOPE 必须为 private，或将 TTL 设为 0。",
    );
  }
}

function 是否允许Http绑定(
  基础配置: Pick<McpConfig, "httpEnabled" | "bindHost">,
  安全配置: Pick<McpConfig, "externalTlsRequired" | "allowInternalHttp">,
): boolean {
  if (!基础配置.httpEnabled || isLoopbackHost(基础配置.bindHost)) return true;
  if (!安全配置.externalTlsRequired || 安全配置.allowInternalHttp) return true;
  return false;
}

function 读取基础配置(
  env: NodeJS.ProcessEnv,
  args: readonly string[],
): Pick<
  McpConfig,
  | "enabled"
  | "transport"
  | "httpEnabled"
  | "bindHost"
  | "port"
  | "allowedClientIds"
  | "allowedUsers"
> & { apiBaseUrl?: string; serviceKeyFile?: string } {
  const localTestMode = 读取布尔值(env.V3_MCP_LOCAL_TEST_MODE, false, "V3_MCP_LOCAL_TEST_MODE");
  const allowedClientIds = 读取文本列表(env.V3_MCP_ALLOWED_CLIENTS);
  if (localTestMode && allowedClientIds.length === 0) allowedClientIds.push("redclaw-local");
  return {
    enabled: 读取布尔值(env.V3_MCP_ENABLED, false, "V3_MCP_ENABLED"),
    transport: 读取传输方式(args, env.V3_MCP_TRANSPORT),
    httpEnabled: 读取布尔值(env.V3_MCP_HTTP_ENABLED, false, "V3_MCP_HTTP_ENABLED"),
    bindHost: env.V3_MCP_BIND_HOST?.trim() || "127.0.0.1",
    port: 读取范围整数(env.V3_MCP_PORT, 3307, 1, 65_535, "V3_MCP_PORT"),
    allowedClientIds,
    allowedUsers: 读取用户列表(env.V3_MCP_ALLOWED_USERS),
    ...(env.V3_MCP_API_BASE_URL?.trim() ? { apiBaseUrl: env.V3_MCP_API_BASE_URL.trim() } : {}),
    ...(env.V3_MCP_SERVICE_KEY_FILE?.trim()
      ? { serviceKeyFile: env.V3_MCP_SERVICE_KEY_FILE.trim() }
      : {}),
  };
}

function 读取安全配置(
  env: NodeJS.ProcessEnv,
  _基础配置: Pick<McpConfig, "bindHost" | "httpEnabled">,
): Pick<
  McpConfig,
  "deniedUsers" | "auditRequired" | "externalTlsRequired" | "allowInternalHttp" | "allowedHostnames"
> {
  const allowedHostnames = 读取文本列表(env.V3_MCP_ALLOWED_HOSTS);
  return {
    deniedUsers: 读取文本列表(env.V3_MCP_DENIED_USERS),
    auditRequired: 读取布尔值(env.V3_MCP_AUDIT_REQUIRED, true, "V3_MCP_AUDIT_REQUIRED"),
    externalTlsRequired: 读取布尔值(
      env.V3_MCP_EXTERNAL_TLS_REQUIRED,
      true,
      "V3_MCP_EXTERNAL_TLS_REQUIRED",
    ),
    allowInternalHttp: 读取布尔值(
      env.V3_MCP_ALLOW_INTERNAL_HTTP,
      false,
      "V3_MCP_ALLOW_INTERNAL_HTTP",
    ),
    allowedHostnames: allowedHostnames.length
      ? allowedHostnames
      : ["localhost", "127.0.0.1", "[::1]"],
  };
}

function 读取OAuth配置(
  env: NodeJS.ProcessEnv,
): Pick<
  McpConfig,
  | "oauthIssuer"
  | "oauthResource"
  | "oauthAudience"
  | "oauthJwksUrl"
  | "oauthScopes"
  | "oauthAllowedOrigins"
  | "oauthDcrEnabled"
  | "oauthClientRegistration"
> {
  return {
    ...(env.V3_MCP_OAUTH_ISSUER?.trim() ? { oauthIssuer: env.V3_MCP_OAUTH_ISSUER.trim() } : {}),
    ...(env.V3_MCP_OAUTH_RESOURCE?.trim()
      ? { oauthResource: env.V3_MCP_OAUTH_RESOURCE.trim() }
      : {}),
    ...(env.V3_MCP_OAUTH_AUDIENCE?.trim()
      ? { oauthAudience: env.V3_MCP_OAUTH_AUDIENCE.trim() }
      : {}),
    ...(env.V3_MCP_OAUTH_JWKS_URL?.trim()
      ? { oauthJwksUrl: env.V3_MCP_OAUTH_JWKS_URL.trim() }
      : {}),
    oauthScopes: 读取文本列表(env.V3_MCP_OAUTH_SCOPES).length
      ? 读取文本列表(env.V3_MCP_OAUTH_SCOPES)
      : ["mcp:connect"],
    oauthAllowedOrigins: 读取文本列表(env.V3_MCP_OAUTH_ALLOWED_ORIGINS),
    oauthDcrEnabled: 读取布尔值(env.V3_MCP_OAUTH_DCR_ENABLED, false, "V3_MCP_OAUTH_DCR_ENABLED"),
    oauthClientRegistration:
      env.V3_MCP_OAUTH_CLIENT_REGISTRATION === "client_id_metadata"
        ? "client_id_metadata"
        : "pre_registered",
  };
}

function 读取限制配置(
  env: NodeJS.ProcessEnv,
): Pick<
  McpConfig,
  | "maxPageSize"
  | "queryTimeoutMs"
  | "responseMaxBytes"
  | "rateLimitPerUser"
  | "maxConcurrency"
  | "toolsCacheTtlMs"
  | "toolsCacheScope"
> {
  return {
    maxPageSize: 读取范围整数(env.V3_MCP_MAX_PAGE_SIZE, 50, 1, 50, "V3_MCP_MAX_PAGE_SIZE"),
    queryTimeoutMs: 读取正整数(env.V3_MCP_QUERY_TIMEOUT_MS, 3_000, "V3_MCP_QUERY_TIMEOUT_MS"),
    responseMaxBytes: 读取正整数(
      env.V3_MCP_RESPONSE_MAX_BYTES,
      524_288,
      "V3_MCP_RESPONSE_MAX_BYTES",
    ),
    rateLimitPerUser: 读取正整数(env.V3_MCP_RATE_LIMIT_PER_USER, 60, "V3_MCP_RATE_LIMIT_PER_USER"),
    maxConcurrency: 读取正整数(env.V3_MCP_MAX_CONCURRENCY, 20, "V3_MCP_MAX_CONCURRENCY"),
    toolsCacheTtlMs: 读取非负整数(env.V3_MCP_TOOLS_CACHE_TTL_MS, 0, "V3_MCP_TOOLS_CACHE_TTL_MS"),
    toolsCacheScope: 读取缓存范围(env.V3_MCP_TOOLS_CACHE_SCOPE),
  };
}

function 读取传输方式(args: readonly string[], value: string | undefined): McpTransport {
  let selected = value?.trim() || "stdio";
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--transport") {
      selected = args[index + 1]?.trim() || "";
    } else if (arg?.startsWith("--transport=")) {
      selected = arg.slice("--transport=".length).trim();
    }
  }
  if (selected !== "stdio" && selected !== "streamable-http") {
    throw new McpConfigError("V3_MCP_TRANSPORT 只能是 stdio 或 streamable-http。");
  }
  return selected;
}

function 读取本地测试用户(
  value: string | undefined,
  localTestMode: boolean,
): "internal-demo" | "channel-demo" | undefined {
  const user = value?.trim();
  if (!localTestMode) {
    if (user) {
      throw new McpConfigError("未启用 V3_MCP_LOCAL_TEST_MODE 时不得设置 V3_MCP_LOCAL_TEST_USER。");
    }
    return undefined;
  }
  if (user !== "internal-demo" && user !== "channel-demo") {
    throw new McpConfigError(
      "V3_MCP_LOCAL_TEST_USER 只能是固定测试用户 internal-demo 或 channel-demo。",
    );
  }
  return user;
}

function 读取用户列表(value: string | undefined): "*" | string[] {
  const text = value?.trim();
  if (!text || text === "*") return "*";
  return 读取文本列表(text);
}

function 读取缓存范围(value: string | undefined): McpCacheScope {
  const text = value?.trim() || "private";
  if (text !== "public" && text !== "private") {
    throw new McpConfigError("V3_MCP_TOOLS_CACHE_SCOPE 只能是 public 或 private。");
  }
  return text;
}

function 读取文本列表(value: string | undefined): string[] {
  return Array.from(
    new Set(
      (value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function 读取布尔值(value: string | undefined, fallback: boolean, name: string): boolean {
  const text = value?.trim().toLowerCase();
  if (!text) return fallback;
  if (text === "true") return true;
  if (text === "false") return false;
  throw new McpConfigError(`${name} 只能是 true 或 false。`);
}

function 读取正整数(value: string | undefined, fallback: number, name: string): number {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new McpConfigError(`${name} 必须是正整数。`);
  }
  return parsed;
}

function 读取非负整数(value: string | undefined, fallback: number, name: string): number {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new McpConfigError(`${name} 必须是非负整数。`);
  }
  return parsed;
}

function 读取范围整数(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  name: string,
): number {
  const parsed = 读取正整数(value, fallback, name);
  if (parsed < minimum || parsed > maximum) {
    throw new McpConfigError(`${name} 必须在 ${minimum} 到 ${maximum} 之间。`);
  }
  return parsed;
}

function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  if (normalized === "localhost") return true;
  const ipVersion = isIP(normalized);
  return ipVersion === 4 ? normalized.startsWith("127.") : normalized === "::1";
}
