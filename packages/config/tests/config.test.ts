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
      MESSAGE_CHANNEL_CONFIG_ENCRYPTION_KEY: "MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI=",
    });
    expect(掩码敏感配置(配置).session.secret).toBe("***已隐藏***");
    expect(掩码敏感配置(配置).message.channelConfigEncryptionKey).toBe("***已隐藏***");
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

  it("消息任务默认关闭，显式启用必须固定启用时间", () => {
    expect(读取应用配置({ APP_ENV: "development" }).message.enabled).toBe(false);
    expect(() => 读取应用配置({ APP_ENV: "development", MESSAGE_WORKER_ENABLED: "true" })).toThrow(
      "MESSAGE_EVENT_CUTOVER_AT",
    );
  });

  it("订单预审任务只校验泛微应用配置，企微建群复用提醒平台应用", () => {
    const 配置 = 读取应用配置({
      APP_ENV: "development",
      ORDER_PREAPPROVAL_WORKER_ENABLED: "true",
      ORDER_PREAPPROVAL_EVENT_CUTOVER_AT: "2026-08-27T00:00:00.000Z",
      ORDER_PREAPPROVAL_ETEAMS_ORIGIN: "https://oa.example.com",
      ORDER_PREAPPROVAL_ETEAMS_CORP_ID: "test-corp",
      ORDER_PREAPPROVAL_ETEAMS_APP_KEY: "test-app-key",
      ORDER_PREAPPROVAL_ETEAMS_APP_SECRET: "test-app-secret-value",
      MESSAGE_CHANNEL_CONFIG_ENCRYPTION_KEY: "MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI=",
    });

    expect(配置.orderPreapproval.enabled).toBe(true);
    expect(配置.orderPreapproval.eteams).toEqual({
      origin: "https://oa.example.com",
      corpId: "test-corp",
      appKey: "test-app-key",
      appSecret: "test-app-secret-value",
    });
    expect(配置.message.channels.wecomApp.enabled).toBe(false);
  });

  it("账号停用归档任务默认关闭，轮询间隔受边界约束", () => {
    expect(读取应用配置({ APP_ENV: "development" }).organization).toEqual({
      channelPhoneEditEnabled: false,
      accountStatusCheckEnabled: false,
      offboardingEnabled: false,
      offboardingPollIntervalMs: 5000,
    });
    expect(
      读取应用配置({
        APP_ENV: "development",
        V3_AUTH_ACCOUNT_STATUS_CHECK_ENABLED: "true",
        V3_ORGANIZATION_CHANNEL_PHONE_EDIT_ENABLED: "true",
        V3_ORGANIZATION_OFFBOARDING_ENABLED: "true",
        V3_ORGANIZATION_OFFBOARDING_POLL_INTERVAL_MS: "3000",
      }).organization,
    ).toEqual({
      channelPhoneEditEnabled: true,
      accountStatusCheckEnabled: true,
      offboardingEnabled: true,
      offboardingPollIntervalMs: 3000,
    });
    expect(() =>
      读取应用配置({
        APP_ENV: "development",
        V3_ORGANIZATION_OFFBOARDING_ENABLED: "true",
      }),
    ).toThrow("V3_AUTH_ACCOUNT_STATUS_CHECK_ENABLED");
    expect(() =>
      读取应用配置({
        APP_ENV: "development",
        V3_ORGANIZATION_OFFBOARDING_POLL_INTERVAL_MS: "100",
      }),
    ).toThrow();
  });

  it("企微群机器人地址仅接受指定 HTTPS 接口且日志隐藏凭据", () => {
    const webhook = "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=secret-key";
    const 配置 = 读取应用配置({
      APP_ENV: "development",
      MESSAGE_WECOM_GROUP_ENABLED: "true",
      MESSAGE_WECOM_GROUP_WEBHOOK: webhook,
    });
    expect(掩码敏感配置(配置).message.channels.wecomGroup.webhook).toBe("***已隐藏***");
    expect(() =>
      读取应用配置({
        APP_ENV: "development",
        MESSAGE_WECOM_GROUP_ENABLED: "true",
        MESSAGE_WECOM_GROUP_WEBHOOK: "http://example.com/webhook",
      }),
    ).toThrow("企微群机器人 HTTPS 地址");
  });

  it("短信供应商密钥仅在运行时读取，输出配置时必须隐藏", () => {
    const 配置 = 读取应用配置({
      APP_ENV: "development",
      MESSAGE_SMS_ENABLED: "true",
      MESSAGE_SMS_ENDPOINT: "https://sms.example.com/v1/send",
      MESSAGE_SMS_API_KEY: "test-api-key",
      MESSAGE_SMS_API_SECRET: "test-api-secret-value",
      MESSAGE_SMS_TEMPLATE_ID: "template-001",
    });

    expect(掩码敏感配置(配置).message.channels.sms.apiKey).toBe("***已隐藏***");
    expect(掩码敏感配置(配置).message.channels.sms.apiSecret).toBe("***已隐藏***");
  });

  it("邮箱默认关闭，启用时必须提供 SMTP 参数且掩码凭据", () => {
    expect(() => 读取应用配置({ APP_ENV: "development", MESSAGE_EMAIL_ENABLED: "true" })).toThrow(
      "MESSAGE_EMAIL_SMTP_HOST",
    );
    const 配置 = 读取应用配置({
      APP_ENV: "development",
      MESSAGE_EMAIL_ENABLED: "true",
      MESSAGE_EMAIL_SMTP_HOST: "smtp.example.com",
      MESSAGE_EMAIL_SMTP_USERNAME: "message-user",
      MESSAGE_EMAIL_SMTP_PASSWORD: "message-password",
      MESSAGE_EMAIL_FROM: "no-reply@example.com",
      MESSAGE_REMINDER_ADVANCE_DAYS: "30",
      MESSAGE_REMINDER_DIGEST_MINUTES: "15",
    });
    const 已掩码 = 掩码敏感配置(配置);
    expect(已掩码.message.channels.email.username).toBe("***已隐藏***");
    expect(已掩码.message.channels.email.password).toBe("***已隐藏***");
    expect(配置.message.reminderDigestMinutes).toBe(15);
  });
});
