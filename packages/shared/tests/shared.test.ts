import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  事件目录,
  创建结构化日志器,
  创建错误响应,
  判断健康状态,
  到期数据源目录,
  应用错误,
} from "../src/index.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("共享响应结构", () => {
  it("能够生成中文错误响应", () => {
    const 响应 = 创建错误响应({
      error: new 应用错误("V3_TEST", "测试错误"),
      requestId: "req-test",
      build: { 版本: "1", 提交: "abc", 构建时间: "2026-07-23T00:00:00.000Z" },
    });

    expect(响应.success).toBe(false);
    expect(响应.error.message).toBe("测试错误");
  });

  it("能够根据依赖状态判断整体健康状态", () => {
    expect(判断健康状态([])).toBe("ok");
    expect(
      判断健康状态([{ name: "redis", status: "skipped", message: "跳过", checkedAt: "now" }]),
    ).toBe("degraded");
    expect(
      判断健康状态([{ name: "redis", status: "failed", message: "失败", checkedAt: "now" }]),
    ).toBe("failed");
  });

  it("能够输出统一结构化日志并隐藏敏感字段", () => {
    const 输出 = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const logger = 创建结构化日志器({
      service: "api",
      appEnv: "test",
      minLevel: "info",
      defaultFields: { buildVersion: "测试版本" },
    });

    logger.info("接口请求完成", {
      event: "api.request.completed",
      requestId: "req-test",
      password: "明文密码",
      passwordLength: 4,
      passwordFingerprint: "abc123",
      nested: { token: "访问令牌", keep: "保留字段" },
    });

    const 日志 = JSON.parse(String(输出.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(日志.level).toBe("info");
    expect(日志.service).toBe("api");
    expect(日志.event).toBe("api.request.completed");
    expect(日志.password).toBe("***已隐藏***");
    expect(日志.passwordLength).toBe(4);
    expect(日志.passwordFingerprint).toBe("abc123");
    expect((日志.nested as Record<string, unknown>).token).toBe("***已隐藏***");
    expect((日志.nested as Record<string, unknown>).keep).toBe("保留字段");
  });

  it("能够按最小级别过滤日志", () => {
    const 输出 = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const logger = 创建结构化日志器({ service: "worker", appEnv: "test", minLevel: "warn" });

    logger.info("低级别日志不会输出");

    expect(输出).not.toHaveBeenCalled();
  });

  it("能够写入文件并按大小压缩轮转", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const 目录 = await fs.mkdtemp(path.join(os.tmpdir(), "lianruan-log-test-"));
    try {
      const logger = 创建结构化日志器({
        service: "api",
        appEnv: "test",
        minLevel: "info",
        file: {
          enabled: true,
          dir: 目录,
          fileName: "api.log",
          maxBytes: 900,
          maxFiles: 2,
          compressRotated: true,
        },
      });

      for (let index = 0; index < 8; index += 1) {
        logger.info("日志轮转测试", {
          event: "logger.rotation.test",
          index,
          payload: "x".repeat(420),
        });
      }
      await logger.flush();

      const 文件列表 = await fs.readdir(目录);
      const 压缩备份 = 文件列表.filter((文件名) => 文件名.endsWith(".log.gz"));
      expect(文件列表).toContain("api.log");
      expect(压缩备份.length).toBeGreaterThan(0);
      expect(压缩备份.length).toBeLessThanOrEqual(2);
    } finally {
      await fs.rm(目录, { recursive: true, force: true });
    }
  });
});

describe("统一提醒变量目录", () => {
  it("全部业务事件与到期提醒均声明渠道商和提报人变量", () => {
    const 业务事件 = 事件目录.filter((事件) => 事件.code.startsWith("crm."));
    expect(业务事件.length).toBeGreaterThan(0);
    for (const 事件 of 业务事件) {
      expect(事件.variables.map((变量) => 变量.name)).toEqual(
        expect.arrayContaining(["partner_name", "submitter_name"]),
      );
    }
    for (const 数据源 of 到期数据源目录) {
      expect(数据源.variables.map((变量) => 变量.name)).toEqual(
        expect.arrayContaining(["partner_name", "submitter_name"]),
      );
    }
  });

  it("订单确认提醒使用订单名称，并登记两类超管审核待办事件", () => {
    const 订单确认 = 事件目录.find((事件) => 事件.code === "crm.order.confirmed");
    expect(订单确认?.variables.map((变量) => 变量.name)).toEqual(
      expect.arrayContaining(["business_no", "order_name", "partner_name", "submitter_name"]),
    );
    expect(事件目录.map((事件) => 事件.code)).toEqual(
      expect.arrayContaining(["iam.account.approval.pending", "channel.partner.approval.pending"]),
    );
  });
});
