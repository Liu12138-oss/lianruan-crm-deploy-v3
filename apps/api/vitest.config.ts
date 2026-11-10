import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 接口测试共用同一个 PostgreSQL 测试库，必须按文件串行执行，避免夹具互相删除或覆盖。
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
