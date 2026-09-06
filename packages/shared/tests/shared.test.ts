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
  生成正式报价单PDF,
  生成订单预审采购内容,
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

describe("正式报价单 PDF", () => {
  it("生成 A4 PDF 并固化中文字体、产品分组和金额汇总", () => {
    const 内容 = 生成正式报价单PDF({
      订单编号: "LS-2026-0001",
      报价编号: "BJ-2026-0001",
      合同对方: "渠道商甲",
      最终用户: "客户乙",
      所属区域: "南区-湖南MBU",
      明细: [
        { 名称: "终端管理许可", 数量: "200", 单价: "270", 金额: "54000", 类型: "软件产品" },
        { 名称: "实施服务", 数量: "1", 单价: "0", 金额: "0", 类型: "服务项" },
      ],
      合计金额: "54000",
      生成时间: "2026-08-27T00:00:00.000Z",
    });

    const 文本 = 内容.toString("binary");
    expect(内容.subarray(0, 8).toString("binary")).toBe("%PDF-1.7");
    expect(文本).toContain("/STSong-Light");
    expect(文本).toContain("/Helvetica");
    expect(文本).toContain("/Helvetica-Bold");
    expect(文本).toContain("xref");
    expect(文本).toContain("/MediaBox [0 0 595 842]");
    expect(文本).toContain(
      "终端管理许可"
        .split("")
        .map((字符) => Buffer.from(字符, "utf16le").swap16().toString("hex").toUpperCase())
        .join(""),
    );
  });

  it("采购内容只输出软件产品和服务项明细", () => {
    const 内容 = 生成订单预审采购内容([
      { 名称: "终端管理许可", 数量: "200", 单价: "270", 金额: "54000", 类型: "软件产品" },
      { 名称: "硬件网关", 数量: "1", 单价: "1000", 金额: "1000", 类型: "硬件设备" },
    ]);
    expect(内容).toContain("软件产品：");
    expect(内容).toContain("授权端点数：200 点");
    expect(内容).toContain("小计：¥54,000");
    expect(内容).toContain("服务项：");
    expect(内容).not.toContain("硬件网关");
  });
});
