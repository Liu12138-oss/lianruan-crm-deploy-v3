import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { afterEach, describe, expect, it } from "vitest";

let 客户端: Client | undefined;

afterEach(async () => {
  await 客户端?.close();
  客户端 = undefined;
});

describe("RedClaw本地兼容骨架", () => {
  it("stdio进程可被现代协议客户端发现和调用", async () => {
    客户端 = new Client(
      { name: "redclaw-simulator", version: "0.5.17" },
      { versionNegotiation: { mode: { pin: "2026-07-28" } } },
    );
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["dist/server.js", "--transport", "stdio"],
      cwd: process.cwd(),
      env: 读取测试环境变量({
        V3_MCP_ENABLED: "true",
        V3_MCP_TRANSPORT: "stdio",
        V3_MCP_LOCAL_TEST_MODE: "true",
        V3_MCP_LOCAL_TEST_USER: "internal-demo",
      }),
      stderr: "pipe",
    });
    await 客户端.connect(transport);
    const { tools } = await 客户端.listTools();
    const result = await 客户端.callTool({ name: "v3_current_context", arguments: {} });

    expect(tools).toHaveLength(3);
    expect(result.structuredContent).toMatchObject({
      user: { username: "internal-demo", personType: "internal" },
    });
  });

  it("RedClaw 0.5.22 的 2025 协议握手兼容", async () => {
    客户端 = new Client(
      { name: "redclaw-0.5.22", version: "0.5.22" },
      { versionNegotiation: { mode: "legacy" } },
    );
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["dist/server.js", "--transport", "stdio"],
      cwd: process.cwd(),
      env: 读取测试环境变量({
        V3_MCP_ENABLED: "true",
        V3_MCP_TRANSPORT: "stdio",
        V3_MCP_LOCAL_TEST_MODE: "true",
        V3_MCP_LOCAL_TEST_USER: "internal-demo",
      }),
      stderr: "pipe",
    });
    await 客户端.connect(transport);
    const { tools } = await 客户端.listTools();
    const result = await 客户端.callTool({ name: "v3_current_context", arguments: {} });

    expect(客户端.getProtocolEra()).toBe("legacy");
    expect(tools.map((tool) => tool.name)).toEqual([
      "v3_current_context",
      "v3_product_search",
      "v3_registration_list",
    ]);
    expect(result.structuredContent).toMatchObject({
      user: { username: "internal-demo", personType: "internal" },
    });
  });
});

function 读取测试环境变量(overrides: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = { NODE_ENV: "test" };
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") env[key] = value;
  }
  return { ...env, ...overrides };
}
