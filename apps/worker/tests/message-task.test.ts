import { 读取应用配置 } from "@lianruan/config";
import { describe, expect, it } from "vitest";

import {
  创建关键消息任务载荷,
  启动消息任务服务,
  应生成连续失败事件,
  校验关键消息任务载荷,
  校验外部投递任务载荷,
  校验维护消息任务载荷,
} from "../src/index.js";

describe("消息任务载荷", () => {
  it("关键消息任务只传递扫描元数据，不携带业务敏感载荷", () => {
    const 载荷 = 创建关键消息任务载荷();
    expect(载荷.source).toBe("message-critical");
    expect(Object.keys(载荷)).toEqual(["requestedAt", "source"]);
    expect(校验关键消息任务载荷(载荷)).toEqual(载荷);
  });

  it("外部投递任务不接受接收人联系方式", () => {
    expect(() =>
      校验外部投递任务载荷({
        deliveryId: "00000000-0000-4000-8000-000000000001",
        channelCode: "sms",
        phone: "13800000000",
      }),
    ).toThrow("外部投递任务载荷校验失败");
    expect(() =>
      校验外部投递任务载荷({
        deliveryId: "00000000-0000-4000-8000-000000000001",
        channelCode: "email",
        email: "user@example.com",
      }),
    ).toThrow("外部投递任务载荷校验失败");
  });

  it("维护任务仅允许预定义动作", () => {
    expect(
      校验维护消息任务载荷({ taskCode: "reclaim", requestedAt: new Date().toISOString() }),
    ).toMatchObject({
      taskCode: "reclaim",
    });
    expect(() =>
      校验维护消息任务载荷({ taskCode: "delete", requestedAt: new Date().toISOString() }),
    ).toThrow();
  });

  it("默认关闭时不连接消息队列或数据库", async () => {
    await expect(启动消息任务服务(读取应用配置({ APP_ENV: "test" }))).resolves.toEqual({
      enabled: false,
    });
  });

  it("连续失败事件仅在首次达到阈值时生成，成功重置后可再次生成", () => {
    expect(应生成连续失败事件(4, 5, false)).toBe(false);
    expect(应生成连续失败事件(5, 5, false)).toBe(true);
    expect(应生成连续失败事件(6, 5, true)).toBe(false);
    expect(应生成连续失败事件(5, 5, false)).toBe(true);
  });
});
