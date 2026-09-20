import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { afterEach, describe, expect, it } from "vitest";

import { LOCAL_TEST_PRINCIPALS } from "../src/auth/local-test.js";
import { createMcpServer } from "../src/server-factory.js";
import { 创建测试配置 } from "./test-config.js";

const 待关闭资源: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(待关闭资源.splice(0).map((关闭) => 关闭()));
});

async function 创建客户端(user: "internal-demo" | "channel-demo") {
  const config = 创建测试配置({ V3_MCP_LOCAL_TEST_USER: user });
  const principal = LOCAL_TEST_PRINCIPALS[user];
  const handler = createMcpHandler(() => createMcpServer(config, principal), {
    legacy: "reject",
  });
  const client = new Client(
    { name: `protocol-test-${user}`, version: "1.0.0" },
    { versionNegotiation: { mode: { pin: "2026-07-28" } } },
  );
  const transport = new StreamableHTTPClientTransport(new URL("http://test.local/mcp"), {
    fetch: (url, init) => handler.fetch(new Request(url, init)),
  });
  await client.connect(transport);
  待关闭资源.push(async () => {
    await client.close();
    await handler.close();
  });
  return { client, handler };
}

describe("MCP 2026-07-28协议骨架", () => {
  it("固定到现代协议并返回三个只读模拟工具", async () => {
    const { client } = await 创建客户端("internal-demo");
    const discover = client.getDiscoverResult();
    const listResult = await client.listTools();
    const { tools } = listResult;

    expect(client.getProtocolEra()).toBe("modern");
    expect(discover?.supportedVersions).toContain("2026-07-28");
    expect((listResult as { ttlMs?: number }).ttlMs).toBe(0);
    expect((listResult as { cacheScope?: string }).cacheScope).toBe("private");
    expect(tools.map((tool) => tool.name)).toEqual([
      "v3_current_context",
      "v3_product_search",
      "v3_registration_list",
    ]);
    for (const tool of tools) {
      expect(tool.annotations).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      });
      expect(tool.inputSchema).toBeDefined();
      expect(tool.outputSchema).toBeDefined();
    }
  });

  it("当前身份工具返回唯一测试身份", async () => {
    const { client } = await 创建客户端("channel-demo");
    const result = await client.callTool({ name: "v3_current_context", arguments: {} });

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      toolCode: "v3_current_context",
      toolVersion: "1.0.0",
      user: {
        username: "channel-demo",
        personType: "channel",
        primaryPartner: "渠道甲",
      },
    });
  });

  it("产品搜索只返回已发布产品", async () => {
    const { client } = await 创建客户端("internal-demo");
    const result = await client.callTool({
      name: "v3_product_search",
      arguments: { limit: 20 },
    });
    const structured = result.structuredContent as {
      items: Array<{ status: string }>;
    };

    expect(result.isError).not.toBe(true);
    expect(structured.items.length).toBeGreaterThan(0);
    expect(structured.items.every((item) => item.status === "published")).toBe(true);
  });

  it("渠道模拟用户只返回本渠道可见报备", async () => {
    const { client } = await 创建客户端("channel-demo");
    const result = await client.callTool({
      name: "v3_registration_list",
      arguments: { limit: 20 },
    });
    const structured = result.structuredContent as {
      items: Array<{ partnerName: string | null }>;
      maskedFields: string[];
    };

    expect(result.isError).not.toBe(true);
    expect(structured.items.length).toBe(2);
    expect(structured.items.every((item) => item.partnerName === "渠道甲")).toBe(true);
    expect(structured.maskedFields).toContain("contactPhone");
  });

  it("未知输入字段被SDK拒绝为工具执行错误", async () => {
    const { client } = await 创建客户端("internal-demo");
    const result = await client.callTool({
      name: "v3_product_search",
      arguments: { unknownField: true },
    });

    expect(result.isError).toBe(true);
    expect(
      String(result.content[0] && "text" in result.content[0] ? result.content[0].text : ""),
    ).toContain("unknownField");
  });

  it("总开关关闭时不注册任何业务工具", async () => {
    const config = 创建测试配置({ V3_MCP_ENABLED: "false" });
    const handler = createMcpHandler(
      () => createMcpServer(config, LOCAL_TEST_PRINCIPALS["internal-demo"]),
      { legacy: "reject" },
    );
    const client = new Client(
      { name: "disabled-test", version: "1.0.0" },
      { versionNegotiation: { mode: { pin: "2026-07-28" } } },
    );
    const transport = new StreamableHTTPClientTransport(new URL("http://test.local/mcp"), {
      fetch: (url, init) => handler.fetch(new Request(url, init)),
    });
    await client.connect(transport);

    const { tools } = await client.listTools();
    expect(tools).toEqual([]);

    await client.close();
    await handler.close();
  });
});
