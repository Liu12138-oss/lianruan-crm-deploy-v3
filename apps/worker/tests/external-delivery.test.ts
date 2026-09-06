import net from "node:net";

import { 读取应用配置 } from "@lianruan/config";
import { describe, expect, it, vi } from "vitest";

import { 投递外部消息 } from "../src/external-delivery.js";

const 消息 = {
  deliveryId: "00000000-0000-4000-8000-000000000001",
  channelCode: "wecom" as const,
  title: "消息任务运行异常",
  body: "请管理员在平台排查。",
  templateCode: "m2_wecom_system",
};

describe("外部消息投递器", () => {
  it("默认关闭企微通道时不发起网络请求", async () => {
    const 请求 = vi.fn();
    const 结果 = await 投递外部消息(读取应用配置({ APP_ENV: "test" }), 消息, 请求);

    expect(结果.statusCode).toBe("ignored");
    expect(请求).not.toHaveBeenCalled();
  });

  it("默认关闭邮箱通道时不建立 SMTP 连接", async () => {
    const 请求 = vi.fn();
    const 结果 = await 投递外部消息(
      读取应用配置({ APP_ENV: "test" }),
      { ...消息, channelCode: "email", recipientEmail: "receiver@example.com" },
      请求,
    );

    expect(结果.statusCode).toBe("ignored");
    expect(请求).not.toHaveBeenCalled();
  });

  it("SMTP 端口 465 使用 starttls 时快速拒绝，避免任务长期停留在发送中", async () => {
    const 请求 = vi.fn();
    const 配置 = 读取应用配置({
      APP_ENV: "test",
      MESSAGE_EMAIL_ENABLED: "true",
      MESSAGE_EMAIL_SMTP_HOST: "mail.example.com",
      MESSAGE_EMAIL_SMTP_PORT: "465",
      MESSAGE_EMAIL_SMTP_SECURITY: "starttls",
      MESSAGE_EMAIL_SMTP_USERNAME: "message-user",
      MESSAGE_EMAIL_SMTP_PASSWORD: "message-password",
      MESSAGE_EMAIL_FROM: "message@example.com",
    });

    await expect(
      投递外部消息(
        配置,
        { ...消息, channelCode: "email", recipientEmail: "receiver@example.com" },
        请求,
      ),
    ).resolves.toMatchObject({ statusCode: "failed", providerCode: "smtp_generic" });
    expect(请求).not.toHaveBeenCalled();
  });

  it("SMTP 服务立即发送欢迎语时仍能继续发送 EHLO", async () => {
    const 已收到命令: string[] = [];
    const 服务 = net.createServer((连接) => {
      连接.write("220 本地测试 SMTP 已就绪\r\n");
      连接.on("data", (数据) => {
        const 命令 = 数据.toString("utf8").trim();
        已收到命令.push(命令);
        if (命令.startsWith("EHLO ")) {
          连接.write("250 本地测试 SMTP\r\n");
          return;
        }
        if (命令 === "STARTTLS") 连接.destroy();
      });
    });
    await new Promise<void>((resolve, reject) => {
      服务.once("error", reject);
      服务.listen(0, "127.0.0.1", resolve);
    });
    const 地址 = 服务.address();
    if (!地址 || typeof 地址 === "string") throw new Error("本地 SMTP 测试服务未获得端口。");

    try {
      const 配置 = 读取应用配置({
        APP_ENV: "test",
        MESSAGE_EMAIL_ENABLED: "true",
        MESSAGE_EMAIL_SMTP_HOST: "127.0.0.1",
        MESSAGE_EMAIL_SMTP_PORT: String(地址.port),
        MESSAGE_EMAIL_SMTP_SECURITY: "starttls",
        MESSAGE_EMAIL_SMTP_USERNAME: "message-user",
        MESSAGE_EMAIL_SMTP_PASSWORD: "message-password",
        MESSAGE_EMAIL_FROM: "message@example.com",
        MESSAGE_EXTERNAL_REQUEST_TIMEOUT_MS: "1000",
      });
      await expect(
        投递外部消息(配置, {
          ...消息,
          channelCode: "email",
          recipientEmail: "receiver@example.com",
        }),
      ).resolves.toMatchObject({ statusCode: "retry_wait", providerCode: "smtp_generic" });
      expect(已收到命令.some((命令) => 命令.startsWith("EHLO "))).toBe(true);
    } finally {
      await new Promise<void>((resolve) => 服务.close(() => resolve()));
    }
  });

  it("企微机器人仅发送文本载荷，成功只记录脱敏结果", async () => {
    const 请求 = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ errcode: 0, errmsg: "ok" }), { status: 200 }),
      );
    const 配置 = 读取应用配置({
      APP_ENV: "test",
      MESSAGE_WECOM_GROUP_ENABLED: "true",
      MESSAGE_WECOM_GROUP_WEBHOOK: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test-key",
    });
    const 结果 = await 投递外部消息(配置, 消息, 请求);

    expect(结果).toMatchObject({
      statusCode: "success",
      providerCode: "wecom_group",
      httpStatus: 200,
    });
    expect(请求).toHaveBeenCalledTimes(1);
    expect(请求.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
  });

  it("企微限流响应会进入可重试状态", async () => {
    const 请求 = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ errcode: 45009 }), { status: 200 }));
    const 配置 = 读取应用配置({
      APP_ENV: "test",
      MESSAGE_WECOM_GROUP_ENABLED: "true",
      MESSAGE_WECOM_GROUP_WEBHOOK: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test-key",
    });

    await expect(投递外部消息(配置, 消息, 请求)).resolves.toMatchObject({
      statusCode: "retry_wait",
      retryable: true,
    });
  });

  it("企微自建应用先获取令牌，再向指定成员发送测试消息", async () => {
    const 请求 = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ errcode: 0, access_token: "test-token", expires_in: 7200 }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ errcode: 0 }), { status: 200 }));
    const 配置 = 读取应用配置({
      APP_ENV: "test",
      MESSAGE_WECOM_APP_ENABLED: "true",
      MESSAGE_WECOM_APP_CORP_ID: "wwffffffffffffffff",
      MESSAGE_WECOM_APP_AGENT_ID: "1000003",
      MESSAGE_WECOM_APP_SECRET: "test-secret-at-least-16-diff",
    });
    const 结果 = await 投递外部消息(
      配置,
      {
        ...消息,
        channelCode: "wecom_app",
        title: "订单待审批",
        body: "订单待审批。订单号：ORD-001；**订单名称：**演示项目；订单渠道商：联软渠道商；提交人：张三。请及时审批。",
        recipientWecomUserId: "test_user",
      },
      请求,
    );

    expect(结果).toMatchObject({ statusCode: "success", providerCode: "wecom_app" });
    expect(请求).toHaveBeenCalledTimes(2);
    expect(String(请求.mock.calls[0]?.[0])).toContain("/cgi-bin/gettoken");
    expect(String(请求.mock.calls[1]?.[0])).toContain("/cgi-bin/message/send");
    const 请求参数 = 请求.mock.calls[1]?.[1] as RequestInit;
    const 请求体 = JSON.parse(String(请求参数.body)) as Record<string, unknown>;
    expect(请求体.msgtype).toBe("markdown");
    expect(请求体.markdown).toMatchObject({
      content: expect.stringContaining("状态：待处理"),
    });
    const 内容 = (请求体.markdown as { content: string }).content;
    expect(内容).toContain("> **订单号：**ORD-001");
    expect(内容).toContain("> **订单名称：**演示项目");
    expect(内容).not.toContain("\\*\\*订单名称");
    expect(Buffer.byteLength(内容, "utf8")).toBeLessThanOrEqual(2_048);
  });

  it("企微自建应用将待审核提醒标为待处理并清理模板中的旧加粗标记", async () => {
    const 请求 = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ errcode: 0, access_token: "test-token", expires_in: 7200 }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ errcode: 0 }), { status: 200 }));
    const 配置 = 读取应用配置({
      APP_ENV: "test",
      MESSAGE_WECOM_APP_ENABLED: "true",
      MESSAGE_WECOM_APP_CORP_ID: "wwffffffffffffffff",
      MESSAGE_WECOM_APP_AGENT_ID: "1000003",
      MESSAGE_WECOM_APP_SECRET: "test-secret-at-least-16-diff-2",
    });

    await 投递外部消息(
      配置,
      {
        ...消息,
        channelCode: "wecom_app",
        title: "员工账号待审核",
        body: "员工姓名：**张三**；渠道商名称：联软渠道商；提交人：李四。",
        recipientWecomUserId: "test_user",
      },
      请求,
    );

    const 请求体 = JSON.parse(String((请求.mock.calls[1]?.[1] as RequestInit).body)) as {
      markdown: { content: string };
    };
    expect(请求体.markdown.content).toContain("状态：待处理");
    expect(请求体.markdown.content).toContain("> **员工姓名：**张三");
    expect(请求体.markdown.content).not.toContain("\\*\\*");
  });

  it("企微自建应用被拒时摘要包含企微返回的错误码和脱敏错误文本", async () => {
    const 请求 = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ errcode: 0, access_token: "test-token", expires_in: 7200 }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            errcode: 81013,
            errmsg: "user & party & tag all invalid, hint: [abc123], from ip: 1.2.3.4",
          }),
          { status: 200 },
        ),
      );
    const 配置 = 读取应用配置({
      APP_ENV: "test",
      MESSAGE_WECOM_APP_ENABLED: "true",
      MESSAGE_WECOM_APP_CORP_ID: "ww1234567890abcdef",
      MESSAGE_WECOM_APP_AGENT_ID: "1000002",
      MESSAGE_WECOM_APP_SECRET: "test-secret-at-least-16",
    });
    const 结果 = await 投递外部消息(
      配置,
      { ...消息, channelCode: "wecom_app", recipientWecomUserId: "bad_user" },
      请求,
    );

    expect(结果.statusCode).toBe("failed");
    expect(结果.summary).toContain("81013");
    expect(结果.summary).toContain("接收人 UserId 无效");
    expect(结果.summary).not.toContain("hint:");
    expect(结果.summary).not.toContain("1.2.3.4");
  });

  it("企微自建应用令牌失效时清除缓存并重新获取令牌重试一次", async () => {
    const 请求 = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ errcode: 0, access_token: "token-a", expires_in: 7200 }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ errcode: 40014, errmsg: "invalid access_token" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ errcode: 0, access_token: "token-b", expires_in: 7200 }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ errcode: 0 }), { status: 200 }));
    const 配置 = 读取应用配置({
      APP_ENV: "test",
      MESSAGE_WECOM_APP_ENABLED: "true",
      MESSAGE_WECOM_APP_CORP_ID: "wwcccccccccccccccc",
      MESSAGE_WECOM_APP_AGENT_ID: "1000004",
      MESSAGE_WECOM_APP_SECRET: "test-secret-at-least-16-retry",
    });
    const 结果 = await 投递外部消息(
      配置,
      { ...消息, channelCode: "wecom_app", recipientWecomUserId: "test_user" },
      请求,
    );

    expect(结果).toMatchObject({ statusCode: "success", providerCode: "wecom_app" });
    expect(请求).toHaveBeenCalledTimes(4);
    expect(String(请求.mock.calls[1]?.[0])).toContain("/cgi-bin/message/send");
    expect(String(请求.mock.calls[2]?.[0])).toContain("/cgi-bin/gettoken");
    expect(String(请求.mock.calls[3]?.[0])).toContain("/cgi-bin/message/send");
  });

  it("企微自建应用使用完整长 access_token 发送，不截断到 128 字符", async () => {
    const 长令牌 = "x".repeat(214);
    const 请求 = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ errcode: 0, access_token: 长令牌, expires_in: 7200 }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ errcode: 0 }), { status: 200 }));
    const 配置 = 读取应用配置({
      APP_ENV: "test",
      MESSAGE_WECOM_APP_ENABLED: "true",
      MESSAGE_WECOM_APP_CORP_ID: "wwdddddddddddddddd",
      MESSAGE_WECOM_APP_AGENT_ID: "1000005",
      MESSAGE_WECOM_APP_SECRET: "test-secret-at-least-16-long-token",
    });
    const 结果 = await 投递外部消息(
      配置,
      { ...消息, channelCode: "wecom_app", recipientWecomUserId: "test_user" },
      请求,
    );

    expect(结果).toMatchObject({ statusCode: "success", providerCode: "wecom_app" });
    const 发送地址 = String(请求.mock.calls[1]?.[0]);
    expect(发送地址).toContain(`access_token=${encodeURIComponent(长令牌)}`);
    expect(发送地址).not.toContain("access_token=x".repeat(128));
  });

  it("企微群机器人拒绝客户、合同、金额和联系方式等敏感内容", async () => {
    const 请求 = vi.fn();
    const 配置 = 读取应用配置({
      APP_ENV: "test",
      MESSAGE_WECOM_GROUP_ENABLED: "true",
      MESSAGE_WECOM_GROUP_WEBHOOK: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test-key",
    });
    const 结果 = await 投递外部消息(配置, { ...消息, title: "客户合同金额提醒" }, 请求);

    expect(结果.statusCode).toBe("ignored");
    expect(请求).not.toHaveBeenCalled();
  });

  it("短信通道没有供应商参数时默认拒绝启用", () => {
    expect(() => 读取应用配置({ APP_ENV: "test", MESSAGE_SMS_ENABLED: "true" })).toThrow(
      "MESSAGE_SMS_ENDPOINT",
    );
  });
});
