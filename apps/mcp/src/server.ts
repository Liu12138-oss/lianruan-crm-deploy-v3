import { pathToFileURL } from "node:url";

import { serveStdio } from "@modelcontextprotocol/server/stdio";

import { resolveLocalTestPrincipal } from "./auth/local-test.js";
import { readMcpConfig } from "./config.js";
import { createMcpServer } from "./server-factory.js";
import { 启动Http服务 } from "./transports/http.js";

async function main(): Promise<void> {
  const config = readMcpConfig();
  const principal = resolveLocalTestPrincipal(config);

  if (config.transport === "stdio") {
    const handle = serveStdio(() => createMcpServer(config, principal), {
      legacy: "serve",
      onerror(error) {
        console.error(`[mcp] stdio错误：${error.message}`);
      },
    });
    const 停止 = async (signal: string) => {
      console.error(`[mcp] 收到 ${signal}，正在停止。`);
      await handle.close();
      process.exit(0);
    };
    process.once("SIGINT", () => void 停止("SIGINT"));
    process.once("SIGTERM", () => void 停止("SIGTERM"));
    console.error(`[mcp] stdio服务已启动，enabled=${String(config.enabled)}`);
    return;
  }

  const httpServer = await 启动Http服务(config);
  const 地址 = `http://${config.bindHost}:${config.port}/mcp`;
  console.error(`[mcp] HTTP服务已启动：${地址}，enabled=${String(config.enabled)}`);
  const 停止 = async (signal: string) => {
    console.error(`[mcp] 收到 ${signal}，正在停止。`);
    await httpServer.close();
    process.exit(0);
  };
  process.once("SIGINT", () => void 停止("SIGINT"));
  process.once("SIGTERM", () => void 停止("SIGTERM"));
}

const 入口 = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (入口 === import.meta.url) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[mcp] 启动失败：${message}`);
    process.exitCode = 1;
  });
}
