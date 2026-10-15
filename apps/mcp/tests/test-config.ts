import { type McpConfig, readMcpConfig } from "../src/config.js";

export function 创建测试配置(
  overrides: Record<string, string> = {},
  args: readonly string[] = [],
): McpConfig {
  return readMcpConfig(
    {
      NODE_ENV: "test",
      V3_MCP_ENABLED: "true",
      V3_MCP_TRANSPORT: "stdio",
      V3_MCP_LOCAL_TEST_MODE: "true",
      V3_MCP_LOCAL_TEST_USER: "internal-demo",
      ...overrides,
    },
    args,
  );
}
