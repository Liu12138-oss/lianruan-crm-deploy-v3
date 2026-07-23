import { pathToFileURL } from "node:url";

import { type 应用配置, 掩码敏感配置, 读取应用配置 } from "@lianruan/config";

import { 创建健康任务工作器, 创建健康任务队列 } from "./queue.js";

export async function 启动任务服务(config: 应用配置 = 读取应用配置()) {
  const 队列 = 创建健康任务队列(config);
  const 工作器 = 创建健康任务工作器(config);

  工作器.on("completed", (任务) => {
    console.log(JSON.stringify({ 事件: "健康任务完成", 任务编号: 任务.id }));
  });

  工作器.on("failed", (任务, 错误) => {
    console.error(
      JSON.stringify({
        事件: "健康任务失败",
        任务编号: 任务?.id ?? "未知",
        消息: 错误.message,
      }),
    );
  });

  await 队列.waitUntilReady();
  await 工作器.waitUntilReady();
  console.log(JSON.stringify({ 事件: "任务服务已启动", 配置: 掩码敏感配置(config) }));

  注册优雅停止(async () => {
    await 工作器.close();
    await 队列.close();
  });

  return { 队列, 工作器 };
}

function 注册优雅停止(关闭: () => Promise<void>) {
  let 正在停止 = false;
  const 停止 = async (信号: NodeJS.Signals) => {
    if (正在停止) {
      return;
    }

    正在停止 = true;
    console.log(`任务服务收到停止信号：${信号}。`);
    try {
      await 关闭();
      console.log("任务服务已优雅停止。");
      process.exit(0);
    } catch (错误) {
      const 消息 = 错误 instanceof Error ? 错误.message : "任务服务停止失败，原因未知。";
      console.error(消息);
      process.exit(1);
    }
  };

  process.once("SIGINT", 停止);
  process.once("SIGTERM", 停止);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  启动任务服务().catch((错误) => {
    const 消息 = 错误 instanceof Error ? 错误.message : "任务服务启动失败，原因未知。";
    console.error(`任务服务启动失败：${消息}`);
    process.exit(1);
  });
}
