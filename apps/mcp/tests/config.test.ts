import { describe, expect, it } from "vitest";

import { McpConfigError, readMcpConfig } from "../src/config.js";

describe("MCP配置", () => {
  it("默认关闭、stdio、无需用户级白名单", () => {
    const config = readMcpConfig({}, []);

    expect(config.enabled).toBe(false);
    expect(config.transport).toBe("stdio");
    expect(config.httpEnabled).toBe(false);
    expect(config.allowedUsers).toBe("*");
    expect(config.toolsCacheTtlMs).toBe(0);
    expect(config.toolsCacheScope).toBe("private");
    expect(config.externalTlsRequired).toBe(true);
  });

  it("本地测试模式只允许固定用户", () => {
    expect(() =>
      readMcpConfig(
        {
          NODE_ENV: "test",
          V3_MCP_LOCAL_TEST_MODE: "true",
          V3_MCP_LOCAL_TEST_USER: "real-user-id",
        },
        [],
      ),
    ).toThrowError(McpConfigError);
  });

  it("生产环境禁止本地测试模式", () => {
    expect(() =>
      readMcpConfig(
        {
          NODE_ENV: "production",
          V3_MCP_LOCAL_TEST_MODE: "true",
          V3_MCP_LOCAL_TEST_USER: "internal-demo",
        },
        [],
      ),
    ).toThrow("只允许在 NODE_ENV=test 或 NODE_ENV=development");
  });

  it("外部明文HTTP在未显式允许内部代理时拒绝启动", () => {
    expect(() =>
      readMcpConfig(
        {
          V3_MCP_HTTP_ENABLED: "true",
          V3_MCP_BIND_HOST: "0.0.0.0",
        },
        [],
      ),
    ).toThrow("生产外部入口必须使用 HTTPS");
  });

  it("允许受控容器内部HTTP时必须显式配置", () => {
    const config = readMcpConfig(
      {
        V3_MCP_HTTP_ENABLED: "true",
        V3_MCP_BIND_HOST: "0.0.0.0",
        V3_MCP_ALLOW_INTERNAL_HTTP: "true",
      },
      [],
    );
    expect(config.allowInternalHttp).toBe(true);
  });

  it("用户相关工具列表禁止公共缓存", () => {
    expect(() =>
      readMcpConfig(
        {
          V3_MCP_TOOLS_CACHE_TTL_MS: "30000",
          V3_MCP_TOOLS_CACHE_SCOPE: "public",
        },
        [],
      ),
    ).toThrow("不允许公共缓存");
  });
});
