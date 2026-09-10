import { 创建测试环境变量 } from "@lianruan/testing";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { 创建密码散列 } from "../src/auth-routes.js";
import { 创建应用 } from "../src/index.js";
import type {
  平台当前用户,
  平台通道代码,
  消息平台数据服务,
  通道公开配置,
} from "../src/message-platform-store.js";
import type {
  事件规则更新输入,
  任务模板创建输入,
  任务模板更新输入,
  到期提醒规则更新输入,
  平台事件规则,
  平台任务模板,
  平台到期提醒规则,
  平台消息模板,
  提醒任务创建输入,
  提醒任务更新输入,
  消息规则当前用户,
  消息规则数据服务,
} from "../src/message-rule-store.js";

const 密码散列 = 创建密码散列("LrCRM@2026!", Buffer.from("0123456789abcdef"));
const 环境变量 = 创建测试环境变量({
  V3_DELIVERY_AUTH_ENABLED: "true",
  V3_DELIVERY_AUTH_COOKIE_SECURE: "false",
  MESSAGE_WORKER_ENABLED: "true",
  MESSAGE_EVENT_CUTOVER_AT: "2026-08-17T00:00:00+08:00",
  V3_DELIVERY_AUTH_USERS_JSON: JSON.stringify([
    {
      username: "platform_superadmin",
      displayName: "平台超级管理员",
      roleName: "超级管理员",
      passwordHash: 密码散列,
      defaultPath: "/admin",
      allowedPaths: ["/admin", "/mobile"],
    },
    {
      username: "platform_admin",
      displayName: "平台管理员",
      roleName: "区域管理员",
      passwordHash: 密码散列,
      defaultPath: "/admin",
      allowedPaths: ["/admin", "/mobile"],
    },
  ]),
});

class 记录消息平台服务 implements 消息平台数据服务 {
  public 最后用户: 平台当前用户 | undefined;
  public 最后保存: { 通道: 平台通道代码; 输入: Record<string, unknown> } | undefined;
  public 最后切换: { 通道: 平台通道代码; 启用: boolean } | undefined;
  public 最后测试通道: 平台通道代码 | undefined;

  public async 查询通道(用户: 平台当前用户): Promise<通道公开配置[]> {
    this.最后用户 = 用户;
    return [{ channelCode: "wecom", configured: false, enabled: false, detail: {} }];
  }

  public async 保存通道(
    用户: 平台当前用户,
    通道: 平台通道代码,
    输入: Record<string, unknown>,
  ): Promise<通道公开配置> {
    this.最后用户 = 用户;
    this.最后保存 = { 通道, 输入 };
    return {
      channelCode: 通道,
      configured: true,
      enabled: false,
      detail: { webhookTail: "已配置" },
    };
  }

  public async 切换通道(
    用户: 平台当前用户,
    通道: 平台通道代码,
    启用: boolean,
  ): Promise<通道公开配置> {
    this.最后用户 = 用户;
    this.最后切换 = { 通道, 启用 };
    return { channelCode: 通道, configured: true, enabled: 启用, detail: {} };
  }

  public async 创建测试投递(
    用户: 平台当前用户,
    通道: 平台通道代码,
  ): Promise<{ deliveryId: string }> {
    this.最后用户 = 用户;
    this.最后测试通道 = 通道;
    return { deliveryId: "11111111-1111-4111-8111-111111111111" };
  }

  public async 查询测试投递(
    用户: 平台当前用户,
  ): Promise<{ statusCode: string; summary: string | null }> {
    this.最后用户 = 用户;
    return { statusCode: "success", summary: null };
  }

  public async 查询投递(): Promise<[]> {
    return [];
  }
}

class 记录消息规则服务 implements 消息规则数据服务 {
  public 最后用户: 消息规则当前用户 | undefined;
  public 最后更新: { 订阅代码: string; 输入: 事件规则更新输入 } | undefined;
  public 最后到期更新: { 规则代码: string; 输入: 到期提醒规则更新输入 } | undefined;

  public async 查询接收人候选(用户: 消息规则当前用户) {
    this.最后用户 = 用户;
    return {
      items: [
        {
          userId: "6f2fd9ae-1200-b247-9018-27de1ca8515c",
          username: "liulonghai",
          displayName: "刘龙海",
          hasWecomIdentity: true,
        },
      ],
    };
  }

  public async 查询事件规则(用户: 消息规则当前用户): Promise<平台事件规则[]> {
    this.最后用户 = 用户;
    return [测试事件规则];
  }

  public async 更新事件规则(
    用户: 消息规则当前用户,
    订阅代码: string,
    输入: 事件规则更新输入,
  ): Promise<平台事件规则> {
    this.最后用户 = 用户;
    this.最后更新 = { 订阅代码, 输入 };
    return { ...测试事件规则, statusCode: 输入.statusCode, version: 输入.version + 1 };
  }

  public async 查询到期提醒规则(用户: 消息规则当前用户): Promise<平台到期提醒规则[]> {
    this.最后用户 = 用户;
    return [测试到期提醒规则];
  }

  public async 更新到期提醒规则(
    用户: 消息规则当前用户,
    规则代码: string,
    输入: 到期提醒规则更新输入,
  ): Promise<平台到期提醒规则> {
    this.最后用户 = 用户;
    this.最后到期更新 = { 规则代码, 输入 };
    return {
      ...测试到期提醒规则,
      statusCode: 输入.statusCode,
      advanceDays: 输入.advanceDays,
      dispatchTime: 输入.dispatchTime,
      workdayOnly: 输入.workdayOnly,
      recipientRule: { type: "business_owner", label: "当前业务负责人", editable: true },
      channelCodes: 输入.channelCodes,
      digestWindowMinutes: 输入.digestWindowMinutes,
      version: 输入.version + 1,
    };
  }

  public async 查询模板(): Promise<平台消息模板[]> {
    return [];
  }

  public async 查询任务模板(): Promise<平台任务模板[]> {
    return [];
  }

  public async 创建任务模板(
    用户: 消息规则当前用户,
    _输入: 任务模板创建输入,
  ): Promise<平台任务模板> {
    this.最后用户 = 用户;
    return 测试任务模板;
  }

  public async 复制任务模板(
    用户: 消息规则当前用户,
    来源代码: string,
    覆盖: Partial<任务模板创建输入>,
  ): Promise<平台任务模板> {
    this.最后用户 = 用户;
    return {
      ...测试任务模板,
      templateCode: "t_copy",
      templateName: 覆盖.templateName || "复制模板",
    };
  }

  public async 更新任务模板(
    用户: 消息规则当前用户,
    模板代码: string,
    输入: 任务模板更新输入,
  ): Promise<平台任务模板> {
    this.最后用户 = 用户;
    return { ...测试任务模板, titleTemplate: 输入.titleTemplate, bodyTemplate: 输入.bodyTemplate };
  }

  public async 创建提醒任务(
    用户: 消息规则当前用户,
    输入: 提醒任务创建输入,
  ): Promise<平台事件规则 | 平台到期提醒规则> {
    this.最后用户 = 用户;
    return {
      ...测试到期提醒规则,
      ruleCode: "t_task",
      ruleName: 输入.taskName || 测试到期提醒规则.ruleName,
    };
  }

  public async 更新提醒任务(
    用户: 消息规则当前用户,
    任务代码: string,
    输入: 提醒任务更新输入,
  ): Promise<平台事件规则 | 平台到期提醒规则> {
    this.最后用户 = 用户;
    return {
      ...测试到期提醒规则,
      ruleCode: 任务代码,
      ruleName: 输入.taskName || 测试到期提醒规则.ruleName,
    };
  }

  public async 更新模板(
    用户: 消息规则当前用户,
    模板代码: string,
    输入: { titleTemplate: string; bodyTemplate: string; version: number },
  ): Promise<平台消息模板> {
    this.最后用户 = 用户;
    return {
      templateCode: 模板代码,
      channelCode: "in_app",
      eventCode: "crm.registration.expiring",
      categoryCode: "business",
      priorityCode: "strong",
      titleTemplate: 输入.titleTemplate,
      bodyTemplate: 输入.bodyTemplate,
      variables: [],
      taskTemplateCode: 模板代码,
      statusCode: "published",
      version: 输入.version + 1,
      updatedAt: "2026-08-21T00:00:00.000Z",
    };
  }
}

const 测试任务模板: 平台任务模板 = {
  templateCode: "m3_registration_expiring",
  templateName: "客户报备保护期到期",
  reminderType: "expiry",
  reminderCode: "crm.registration.expiring",
  aggregateType: "registration",
  dataSourceCode: "registration_expiring",
  eventCode: null,
  categoryCode: "business",
  priorityCode: "strong",
  defaultRecipientRule: { type: "business_owner", scope: {} },
  defaultChannelCodes: ["in_app", "wecom_app", "email"],
  defaultAdvanceDays: [30, 7, 1],
  defaultDispatchTime: "09:00",
  defaultWorkdayOnly: true,
  defaultDigestWindowMinutes: 0,
  variableDefs: [{ name: "customer_name", label: "客户名称" }],
  titleTemplate: "客户报备保护期即将到期",
  bodyTemplate: "报备【{{customer_name}}】即将到期。",
  isSystem: true,
  statusCode: "active",
  description: "",
  updatedAt: "2026-08-21T00:00:00.000Z",
};

const 测试事件规则: 平台事件规则 = {
  subscriptionCode: "m1_order_status_in_app",
  eventCode: "crm.order.status.changed",
  ruleName: "订单状态变化",
  reminderType: "event",
  templateCode: "m1_order_status_changed",
  isSystem: true,
  protectionLevel: "configurable",
  statusCode: "active",
  version: 1,
  recipientRule: { type: "business_owner", label: "当前业务负责人", editable: false },
  recipientScope: {},
  channelCodes: ["in_app"],
  updatedAt: "2026-08-14T00:00:00.000Z",
  updatedBy: null,
};

const 测试到期提醒规则: 平台到期提醒规则 = {
  ruleCode: "m3_registration_expiring",
  reminderCode: "crm.registration.expiring",
  aggregateType: "registration",
  ruleName: "客户报备保护期到期",
  reminderType: "expiry",
  templateCode: "m3_registration_expiring",
  dataSourceCode: "registration_expiring",
  isSystem: true,
  protectionLevel: "configurable",
  statusCode: "active",
  advanceDays: [30, 7, 1],
  dispatchTime: "09:00",
  workdayOnly: true,
  recipientRule: { type: "business_owner", label: "当前业务负责人", editable: true },
  recipientScope: {},
  channelCodes: ["in_app"],
  digestWindowMinutes: 0,
  version: 1,
  updatedAt: "2026-08-14T00:00:00.000Z",
  updatedBy: null,
};

async function 登录(username: string) {
  const service = new 记录消息平台服务();
  const ruleService = new 记录消息规则服务();
  const app = 创建应用({
    env: 环境变量,
    messagePlatformService: service,
    messageRuleService: ruleService,
  });
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ username, password: "LrCRM@2026!" }).expect(200);
  return { agent, service, ruleService };
}

describe("消息渠道配置接口", () => {
  it("仅允许超级管理员读取和保存，服务端使用会话主体", async () => {
    const { agent, service } = await 登录("platform_superadmin");

    await agent.get("/api/messages/platform/channels").expect(200);
    await agent
      .put("/api/messages/platform/channels/wecom")
      .set("Origin", "http://127.0.0.1:5173")
      .send({ webhook: "https://example.invalid", username: "伪造主体" })
      .expect(200);

    expect(service.最后用户?.username).toBe("platform_superadmin");
    expect(service.最后保存).toEqual({
      通道: "wecom",
      输入: { webhook: "https://example.invalid", username: "伪造主体" },
    });
  });

  it("普通管理员不能读取、保存、试发或启用通道", async () => {
    const { agent, service } = await 登录("platform_admin");

    await agent.get("/api/messages/platform/channels").expect(403);
    await agent.put("/api/messages/platform/channels/sms").send({}).expect(403);
    await agent
      .post("/api/messages/platform/channels/email/test")
      .send({ confirm: "确认" })
      .expect(403);
    await agent
      .post("/api/messages/platform/channels/wecom/enable")
      .send({ confirm: "确认" })
      .expect(403);

    expect(service.最后用户).toBeUndefined();
  });

  it("启用和试发均要求二次确认，且仅调用受控通道", async () => {
    const { agent, service } = await 登录("platform_superadmin");

    await agent
      .post("/api/messages/platform/channels/email/test")
      .send({ confirm: "错误" })
      .expect(400);
    await agent
      .post("/api/messages/platform/channels/email/test")
      .send({ confirm: "确认" })
      .expect(200);
    await agent
      .post("/api/messages/platform/channels/email/enable")
      .send({ confirm: "确认" })
      .expect(200);

    expect(service.最后测试通道).toBe("email");
    expect(service.最后切换).toEqual({ 通道: "email", 启用: true });
  });

  it("仅允许读取受控投递状态，企微应用试发使用会话主体", async () => {
    const { agent, service } = await 登录("platform_superadmin");
    await agent.get("/api/messages/platform/deliveries?channelCode=wecom_app&limit=20").expect(200);
    await agent
      .post("/api/messages/platform/channels/wecom_app/test")
      .send({ confirm: "确认", testWecomUserId: "test_user" })
      .expect(200);
    expect(service.最后测试通道).toBe("wecom_app");
    expect(service.最后用户?.username).toBe("platform_superadmin");
  });

  it("只接受同源或部署配置中允许的前端来源", async () => {
    const { agent, service } = await 登录("platform_superadmin");

    await agent
      .put("/api/messages/platform/channels/wecom")
      .set("Origin", "https://untrusted.example")
      .send({ webhook: "https://example.invalid" })
      .expect(403);

    expect(service.最后保存).toBeUndefined();
  });
});

describe("提醒规则管理接口", () => {
  it("接收人候选仅超级管理员可读，并使用会话主体", async () => {
    const { agent, ruleService } = await 登录("platform_superadmin");

    const 查询 = await agent
      .get("/api/messages/platform/rules/recipient-candidates")
      .query({ username: "伪造主体" })
      .expect(200);
    expect(查询.body.data.items).toEqual([
      {
        userId: "6f2fd9ae-1200-b247-9018-27de1ca8515c",
        username: "liulonghai",
        displayName: "刘龙海",
        hasWecomIdentity: true,
      },
    ]);
    expect(ruleService.最后用户?.username).toBe("platform_superadmin");

    const 普通管理员 = await 登录("platform_admin");
    await 普通管理员.agent.get("/api/messages/platform/rules/recipient-candidates").expect(403);

    const 未登录应用 = 创建应用({
      env: 环境变量,
      messageRuleService: new 记录消息规则服务(),
    });
    await request(未登录应用).get("/api/messages/platform/rules/recipient-candidates").expect(401);
  });

  it("仅超级管理员可读取和更新，且使用会话主体", async () => {
    const { agent, ruleService } = await 登录("platform_superadmin");

    const 查询 = await agent.get("/api/messages/platform/rules").expect(200);
    expect(查询.body.data.items).toEqual([测试事件规则]);
    expect(查询.body.data.reminderItems).toEqual([测试到期提醒规则]);
    await agent
      .put("/api/messages/platform/rules/m1_order_status_in_app")
      .set("Origin", "http://127.0.0.1:5173")
      .send({ statusCode: "disabled", version: 1, confirm: "确认", username: "伪造主体" })
      .expect(400);
    await agent
      .put("/api/messages/platform/rules/m1_order_status_in_app")
      .set("Origin", "http://127.0.0.1:5173")
      .send({ statusCode: "disabled", version: 1, confirm: "确认" })
      .expect(200);

    expect(ruleService.最后用户?.username).toBe("platform_superadmin");
    expect(ruleService.最后更新).toEqual({
      订阅代码: "m1_order_status_in_app",
      输入: { statusCode: "disabled", version: 1 },
    });

    await agent
      .put("/api/messages/platform/rules/m1_order_status_in_app")
      .set("Origin", "http://127.0.0.1:5173")
      .send({
        statusCode: "active",
        version: 2,
        confirm: "确认",
        recipientScope: { type: "users", userIds: ["6f2fd9ae-1200-b247-9018-27de1ca8515c"] },
      })
      .expect(200);
    expect(ruleService.最后更新).toEqual({
      订阅代码: "m1_order_status_in_app",
      输入: {
        statusCode: "active",
        version: 2,
        recipientScope: { type: "users", userIds: ["6f2fd9ae-1200-b247-9018-27de1ca8515c"] },
      },
    });

    await agent
      .put("/api/messages/platform/rules/m1_registration_approval_pending")
      .set("Origin", "http://127.0.0.1:5173")
      .send({
        statusCode: "active",
        version: 3,
        channelCodes: ["in_app", "wecom_app", "email"],
        recipientScope: {
          type: "roles",
          codes: ["superadmin", "region_manager"],
          userIds: ["6f2fd9ae-1200-b247-9018-27de1ca8515c"],
        },
        confirm: "确认",
      })
      .expect(200);
    expect(ruleService.最后更新).toEqual({
      订阅代码: "m1_registration_approval_pending",
      输入: {
        statusCode: "active",
        version: 3,
        channelCodes: ["in_app", "wecom_app", "email"],
        recipientScope: {
          type: "roles",
          codes: ["superadmin", "region_manager"],
          userIds: ["6f2fd9ae-1200-b247-9018-27de1ca8515c"],
        },
      },
    });
  });

  it("普通管理员、跨域、缺少确认均不能更新规则", async () => {
    const 普通管理员 = await 登录("platform_admin");
    await 普通管理员.agent.get("/api/messages/platform/rules").expect(403);
    await 普通管理员.agent
      .put("/api/messages/platform/rules/m1_order_status_in_app")
      .set("Origin", "http://127.0.0.1:5173")
      .send({ statusCode: "disabled", version: 1, confirm: "确认" })
      .expect(403);
    expect(普通管理员.ruleService.最后用户).toBeUndefined();

    const 超管 = await 登录("platform_superadmin");
    await 超管.agent
      .put("/api/messages/platform/rules/m1_order_status_in_app")
      .set("Origin", "https://untrusted.example")
      .send({ statusCode: "disabled", version: 1, confirm: "确认" })
      .expect(403);
    await 超管.agent
      .put("/api/messages/platform/rules/m1_order_status_in_app")
      .set("Origin", "http://127.0.0.1:5173")
      .send({ statusCode: "disabled", version: 1, confirm: "错误" })
      .expect(400);
    expect(超管.ruleService.最后更新).toBeUndefined();
  });

  it("到期提醒规则仅接受受控字段并传递版本", async () => {
    const { agent, ruleService } = await 登录("platform_superadmin");

    await agent
      .put("/api/messages/platform/rules/reminders/m3_registration_expiring")
      .set("Origin", "http://127.0.0.1:5173")
      .send({
        statusCode: "active",
        advanceDays: [30, 7, 1],
        dispatchTime: "09:00",
        workdayOnly: true,
        recipientRule: "business_owner",
        channelCodes: ["in_app"],
        digestWindowMinutes: 15,
        version: 1,
        confirm: "确认",
      })
      .expect(200);
    expect(ruleService.最后到期更新).toEqual({
      规则代码: "m3_registration_expiring",
      输入: {
        statusCode: "active",
        advanceDays: [30, 7, 1],
        dispatchTime: "09:00",
        workdayOnly: true,
        recipientRule: "business_owner",
        channelCodes: ["in_app"],
        digestWindowMinutes: 15,
        version: 1,
      },
    });

    await agent
      .put("/api/messages/platform/rules/reminders/m3_registration_expiring")
      .set("Origin", "http://127.0.0.1:5173")
      .send({
        statusCode: "active",
        advanceDays: [2],
        dispatchTime: "09:00",
        workdayOnly: true,
        recipientRule: "business_owner",
        channelCodes: ["in_app"],
        digestWindowMinutes: 0,
        version: 1,
        confirm: "确认",
      })
      .expect(400);
  });
});
