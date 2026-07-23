import type { 应用配置 } from "@lianruan/config";
import type { RedisOptions } from "ioredis";

export function 创建Redis连接配置(config: 应用配置): RedisOptions {
  const 地址 = new URL(config.redis.url ?? "redis://127.0.0.1:6379/0");
  const 数据库编号 = 地址.pathname.replace("/", "");
  const 选项: RedisOptions = {
    connectionName: "lianruan-crm-v3-worker",
    db: 数据库编号 ? Number(数据库编号) : 0,
    enableReadyCheck: true,
    host: 地址.hostname,
    lazyConnect: true,
    maxRetriesPerRequest: null,
    port: 地址.port ? Number(地址.port) : 6379,
  };

  if (地址.username) {
    选项.username = decodeURIComponent(地址.username);
  }

  if (地址.password) {
    选项.password = decodeURIComponent(地址.password);
  }

  if (地址.protocol === "rediss:") {
    选项.tls = {};
  }

  return 选项;
}
