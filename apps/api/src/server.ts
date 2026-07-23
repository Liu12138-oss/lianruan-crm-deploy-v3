import type { Server } from "node:http";
import { pathToFileURL } from "node:url";

import { type 应用配置, 掩码敏感配置, 读取应用配置 } from "@lianruan/config";

import { 创建应用 } from "./create-app.js";

export function 启动接口服务(config: 应用配置 = 读取应用配置()): Server {
  const app = 创建应用({ config });
  const 服务 = app.listen(config.api.port, config.api.host, () => {
    console.log(
      JSON.stringify({
        事件: "接口服务已启动",
        地址: config.api.host,
        端口: config.api.port,
        配置: 掩码敏感配置(config),
      }),
    );
  });

  注册优雅停止(服务);
  return 服务;
}

function 注册优雅停止(服务: Server) {
  let 正在停止 = false;

  const 停止 = (信号: NodeJS.Signals) => {
    if (正在停止) {
      return;
    }

    正在停止 = true;
    console.log(`接口服务收到停止信号：${信号}。`);
    const 强制退出计时器 = setTimeout(() => {
      console.error("接口服务停止超时，执行强制退出。");
      process.exit(1);
    }, 10000);

    服务.close((错误) => {
      clearTimeout(强制退出计时器);
      if (错误) {
        console.error(`接口服务停止失败：${错误.message}`);
        process.exit(1);
      }

      console.log("接口服务已优雅停止。");
      process.exit(0);
    });
  };

  process.once("SIGINT", 停止);
  process.once("SIGTERM", 停止);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    启动接口服务();
  } catch (错误) {
    const 消息 = 错误 instanceof Error ? 错误.message : "接口服务启动失败，原因未知。";
    console.error(消息);
    process.exit(1);
  }
}
