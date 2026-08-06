import { describe, expect, it } from "vitest";

import { 掩码敏感配置, 读取应用配置, 配置错误 } from "../src/index.js";

describe("环境配置", () => {
  it("本地环境允许依赖暂未启动", () => {
    const 配置 = 读取应用配置({ APP_ENV: "development" });
    expect(配置.health.dependencyMode).toBe("mock");
    expect(配置.session.secret).toContain("local-dev");
    expect(配置.log.file.enabled).toBe(false);
  });

  it("生产环境缺少关键配置时输出中文错误", () => {
    expect(() => 读取应用配置({ APP_ENV: "production" })).toThrow(配置错误);
  });

  it("输出配置时会隐藏敏感值", () => {
    const 配置 = 读取应用配置({
      APP_ENV: "production",
      SESSION_SECRET: "12345678901234567890123456789012",
      DATABASE_URL: "postgres://user:password@127.0.0.1:5432/db",
      REDIS_URL: "redis://:secret@127.0.0.1:6379/0",
    });
    expect(掩码敏感配置(配置).session.secret).toBe("***已隐藏***");
  });

  it("能够读取文件日志轮转配置", () => {
    const 配置 = 读取应用配置({
      APP_ENV: "development",
      LOG_TO_FILE: "true",
      LOG_DIR: "/tmp/lianruan-logs",
      LOG_MAX_BYTES: "2048",
      LOG_MAX_FILES: "3",
      LOG_COMPRESS_ROTATED: "false",
    });

    expect(配置.log.file).toEqual({
      enabled: true,
      dir: "/tmp/lianruan-logs",
      maxBytes: 2048,
      maxFiles: 3,
      compressRotated: false,
    });
  });
});
