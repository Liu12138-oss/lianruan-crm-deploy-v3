import type { 消息个人偏好, 消息通知摘要 } from "@lianruan/contracts";
import { 创建测试环境变量 } from "@lianruan/testing";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { 创建密码散列 } from "../src/auth-routes.js";
import { 创建应用 } from "../src/index.js";
import type {
  消息偏好更新,
  消息当前用户,
  消息数据服务,
  消息通知查询,
} from "../src/message-store.js";

const 密码散列 = 创建密码散列("LrCRM@2026!", Buffer.from("0123456789abcdef"));
const 环境变量 = 创建测试环境变量({
  V3_DELIVERY_AUTH_ENABLED: "true",
  V3_DELIVERY_AUTH_COOKIE_SECURE: "false",
  V3_DELIVERY_AUTH_USERS_JSON: JSON.stringify([
    {
      username: "message_admin",
      displayName: "消息管理员",
      roleName: "超级管理员",
      passwordHash: 密码散列,
      defaultPath: "/admin",
      allowedPaths: ["/admin", "/mobile"],
    },
  ]),
});

class 记录消息服务 implements 消息数据服务 {
  public 最后用户 = "";
  public 最后查询: 消息通知查询 | null = null;
  public 已读编号 = "";
  public 已归档编号 = "";
  public 偏好更新: 消息偏好更新 | null = null;

  public async 查询通知(用户: 消息当前用户, 查询: 消息通知查询) {
    this.最后用户 = 用户.username;
    this.最后查询 = 查询;
    return { items: [测试通知], nextCursor: null };
  }

  public async 查询未读数(用户: 消息当前用户) {
    this.最后用户 = 用户.username;
    return { unreadCount: 3 };
  }

  public async 标记已读(用户: 消息当前用户, 通知编号: string) {
    this.最后用户 = 用户.username;
    this.已读编号 = 通知编号;
    return { updated: true };
  }

  public async 标记全部已读(用户: 消息当前用户) {
    this.最后用户 = 用户.username;
    return { updatedCount: 3 };
  }

  public async 归档通知(用户: 消息当前用户, 通知编号: string) {
    this.最后用户 = 用户.username;
    this.已归档编号 = 通知编号;
    return { updated: true };
  }

  public async 查询偏好(用户: 消息当前用户): Promise<消息个人偏好> {
    this.最后用户 = 用户.username;
    return 测试偏好;
  }

  public async 更新偏好(用户: 消息当前用户, 输入: 消息偏好更新): Promise<消息个人偏好> {
    this.最后用户 = 用户.username;
    this.偏好更新 = 输入;
    return {
      inAppEnabled: true,
      wecomEnabled: 输入.wecomEnabled ?? 测试偏好.wecomEnabled,
      smsEnabled: 输入.smsEnabled ?? 测试偏好.smsEnabled,
      emailEnabled: 输入.emailEnabled ?? 测试偏好.emailEnabled,
      doNotDisturbStart: 输入.doNotDisturbStart ?? 测试偏好.doNotDisturbStart,
      doNotDisturbEnd: 输入.doNotDisturbEnd ?? 测试偏好.doNotDisturbEnd,
    };
  }
}

const 测试通知: 消息通知摘要 = {
  id: "44e17b88-f0fa-4c66-a5e1-7f5555933adb",
  eventCode: "crm.order.status.changed",
  categoryCode: "business",
  priorityCode: "strong",
  aggregateType: "order",
  aggregateId: "a4e17b88-f0fa-4c66-a5e1-7f5555933adb",
  targetAction: "view",
  title: "订单状态已更新",
  body: "请查看订单详情。",
  statusCode: "unread",
  createdAt: "2026-08-14T00:00:00.000Z",
  readAt: null,
  archivedAt: null,
  expiresAt: null,
};

const 测试偏好: 消息个人偏好 = {
  inAppEnabled: true,
  wecomEnabled: false,
  smsEnabled: false,
  emailEnabled: false,
  doNotDisturbStart: "22:00",
  doNotDisturbEnd: "08:00",
};

async function 登录并创建应用() {
  const service = new 记录消息服务();
  const app = 创建应用({ env: 环境变量, messageService: service });
  const agent = request.agent(app);
  const 登录 = await agent
    .post("/api/auth/login")
    .send({ username: "message_admin", password: "LrCRM@2026!" })
    .expect(200);
  return { app, agent, service, 移动端令牌: 登录.body.data.mobileSession.token as string };
}

describe("统一消息接口", () => {
  it("未登录和伪造旧页面令牌不能读取新消息域", async () => {
    const service = new 记录消息服务();
    const app = 创建应用({ env: 环境变量, messageService: service });

    const 未登录 = await request(app).get("/api/messages/notifications").expect(401);
    expect(未登录.body.error.code).toBe("V3_MESSAGE_AUTH_REQUIRED");
    const 伪造令牌 = await request(app)
      .get("/api/messages/notifications")
      .set("Authorization", "Bearer v2.bWVzc2FnZV9hZG1pbg.forged")
      .expect(401);
    expect(伪造令牌.body.error.code).toBe("V3_MESSAGE_AUTH_REQUIRED");
    expect(service.最后用户).toBe("");
  });

  it("只从会话主体读取通知，忽略客户端伪造用户编号", async () => {
    const { agent, service } = await 登录并创建应用();

    const response = await agent
      .get("/api/messages/notifications?category=business&limit=30&userId=other-user")
      .expect(200);

    expect(response.body.data.items).toHaveLength(1);
    expect(service.最后用户).toBe("message_admin");
    expect(service.最后查询).toMatchObject({ category: "business", limit: 30 });
  });

  it("移动端签名会话可以读取本人未读数", async () => {
    const { app, service, 移动端令牌 } = await 登录并创建应用();

    const response = await request(app)
      .get("/api/messages/notifications/unread-count")
      .set("Authorization", `Bearer ${移动端令牌}`)
      .expect(200);

    expect(response.body.data).toEqual({ unreadCount: 3 });
    expect(service.最后用户).toBe("message_admin");
  });

  it("已读、归档和全部已读均使用当前会话主体", async () => {
    const { agent, service } = await 登录并创建应用();
    const 通知编号 = "44e17b88-f0fa-4c66-a5e1-7f5555933adb";

    await agent.put(`/api/messages/notifications/${通知编号}/read`).expect(200);
    await agent.put(`/api/messages/notifications/${通知编号}/archive`).expect(200);
    const 全部已读 = await agent.put("/api/messages/notifications/read-all").expect(200);

    expect(service.已读编号).toBe(通知编号);
    expect(service.已归档编号).toBe(通知编号);
    expect(service.最后用户).toBe("message_admin");
    expect(全部已读.body.data).toEqual({ updatedCount: 3 });
  });

  it("只接受白名单内的个人偏好字段", async () => {
    const { agent, service } = await 登录并创建应用();

    const 成功 = await agent
      .put("/api/messages/preferences")
      .send({ wecomEnabled: true, doNotDisturbStart: "21:30" })
      .expect(200);
    expect(成功.body.data.wecomEnabled).toBe(true);
    expect(service.偏好更新).toEqual({ wecomEnabled: true, doNotDisturbStart: "21:30" });

    const 非法 = await agent
      .put("/api/messages/preferences")
      .send({ recipientUserId: "other-user" })
      .expect(400);
    expect(非法.body.error.code).toBe("V3_MESSAGE_PREFERENCE_INVALID");
  });
});
