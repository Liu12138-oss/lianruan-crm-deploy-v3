import type { 应用配置 } from "@lianruan/config";
import type { 健康依赖状态 } from "@lianruan/shared";
import { Redis } from "ioredis";

export interface 依赖检查器 {
  check(): Promise<健康依赖状态[]>;
}

type 依赖名称 = 健康依赖状态["name"];

export function 创建依赖检查器(config: 应用配置): 依赖检查器 {
  return {
    async check() {
      if (config.health.dependencyMode === "mock") {
        return [
          创建依赖状态("config", "ok", "配置已通过校验"),
          创建依赖状态("postgres", "skipped", "本地骨架默认跳过PostgreSQL连通性检查"),
          创建依赖状态("redis", "skipped", "本地骨架默认跳过Redis连通性检查"),
          创建依赖状态("migration", "skipped", "阶段1尚未引入正式数据库迁移"),
        ];
      }

      const 结果: 健康依赖状态[] = [创建依赖状态("config", "ok", "配置已通过校验")];
      结果.push(await 检查Postgres(config.database.url));
      结果.push(await 检查Redis(config.redis.url));
      结果.push(创建依赖状态("migration", "skipped", "阶段1尚未引入正式数据库迁移"));
      return 结果;
    },
  };
}

export function 创建依赖状态(
  name: 依赖名称,
  status: 健康依赖状态["status"],
  message: string,
  latencyMs?: number,
): 健康依赖状态 {
  const 状态: 健康依赖状态 = {
    name,
    status,
    message,
    checkedAt: new Date().toISOString(),
  };

  if (latencyMs !== undefined) {
    状态.latencyMs = latencyMs;
  }

  return 状态;
}

async function 检查Postgres(url: string | undefined): Promise<健康依赖状态> {
  if (!url) return 创建依赖状态("postgres", "failed", "未配置DATABASE_URL");
  const startedAt = performance.now();
  try {
    const { Client } = await import("pg");
    const client = new Client({ connectionString: url, connectionTimeoutMillis: 1500 });
    await client.connect();
    await client.query("select 1");
    await client.end();
    return 创建依赖状态(
      "postgres",
      "ok",
      "PostgreSQL连接正常",
      Math.round(performance.now() - startedAt),
    );
  } catch (error) {
    return 创建依赖状态("postgres", "failed", "PostgreSQL连接失败：" + 获取错误消息(error));
  }
}

async function 检查Redis(url: string | undefined): Promise<健康依赖状态> {
  if (!url) return 创建依赖状态("redis", "failed", "未配置REDIS_URL");
  const startedAt = performance.now();
  let client: Redis | null = null;
  try {
    client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 0, connectTimeout: 1500 });
    await client.connect();
    await client.ping();
    return 创建依赖状态("redis", "ok", "Redis连接正常", Math.round(performance.now() - startedAt));
  } catch (error) {
    return 创建依赖状态("redis", "failed", "Redis连接失败：" + 获取错误消息(error));
  } finally {
    client?.disconnect();
  }
}

function 获取错误消息(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
