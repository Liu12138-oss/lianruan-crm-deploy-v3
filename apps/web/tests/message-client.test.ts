import { afterEach, describe, expect, it, vi } from "vitest";

import {
  查询统一消息全部,
  标记统一消息已读,
  统一消息转列表记录,
} from "../src/api/message-client.js";

const 通知 = {
  id: "notification-1",
  eventCode: "iam.account.approval.pending",
  categoryCode: "todo" as const,
  priorityCode: "normal" as const,
  aggregateType: "approval",
  aggregateId: "approval-1",
  targetAction: "approve" as const,
  title: "员工账号待审核",
  body: "员工姓名：测试员工",
  statusCode: "unread" as const,
  createdAt: "2026-11-05T12:00:00.000Z",
  readAt: null,
  archivedAt: null,
  expiresAt: null,
};

describe("统一消息客户端", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("把统一消息转换为新 UI 列表记录并保留审批动作", () => {
    const 记录 = 统一消息转列表记录(通知);

    expect(记录.id).toBe("notification-1");
    expect(记录.标题).toBe("员工账号待审核");
    expect(记录.状态).toBe("unread");
    expect(记录.状态名称).toBe("未读");
    expect(记录.原始数据).toMatchObject({
      type: "approval_pending",
      desc: "员工姓名：测试员工",
      eventCode: "iam.account.approval.pending",
      aggregateId: "approval-1",
      targetAction: "approve",
    });
  });

  it("按游标读取统一消息，不重复合并分页", async () => {
    const 调用 = vi.fn(async (地址: string | URL | Request) => {
      const 游标 = new URL(String(地址), "http://localhost").searchParams.get("cursor");
      const 数据 = 游标
        ? { items: [{ ...通知, id: "notification-2" }], nextCursor: null }
        : { items: [通知], nextCursor: "cursor-2" };
      return new Response(JSON.stringify({ success: true, data: 数据 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", 调用);

    const 结果 = await 查询统一消息全部(3);

    expect(结果.总数).toBe(2);
    expect(结果.数据.map((项) => 项.id)).toEqual(["notification-1", "notification-2"]);
    expect(调用).toHaveBeenCalledTimes(2);
  });

  it("单条已读和全部已读均写入统一消息接口", async () => {
    const 调用 = vi.fn(async (地址: string | URL | Request, 选项?: RequestInit) => {
      const 路径 = new URL(String(地址), "http://localhost").pathname;
      const 数据 = 路径.endsWith("/read-all") ? { updatedCount: 2 } : { updated: true };
      expect(选项?.method).toBe("PUT");
      return new Response(JSON.stringify({ success: true, data: 数据 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", 调用);

    await expect(标记统一消息已读("notification-1")).resolves.toMatchObject({ updated: true });
    await expect(标记统一消息已读()).resolves.toMatchObject({ updated: true });
    expect(String(调用.mock.calls[0]?.[0])).toContain(
      "/api/messages/notifications/notification-1/read",
    );
    expect(String(调用.mock.calls[1]?.[0])).toContain("/api/messages/notifications/read-all");
  });
});
