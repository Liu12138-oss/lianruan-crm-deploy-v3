import crypto from "node:crypto";

import { type 应用配置, 校验消息通道配置加密密钥, 解密消息通道配置 } from "@lianruan/config";
import { Pool, type PoolClient } from "pg";

import type { 外部待投递消息, 外部投递结果 } from "./external-delivery.js";
import {
  type M1事件代码 as M1事件代码类型,
  M1事件代码集合,
  关键消息任务失败监控代码,
  关键消息任务失败聚合编号,
  应生成连续失败事件,
  消息消费者代码,
} from "./message-task.js";
import { type 模板变量字典, 渲染模板, 计算剩余天数 } from "./template-render.js";

/** 只读查询执行器：Pool 与 PoolClient 均满足，用于按规则扫描与接收人解析。 */
type 数据库查询执行器 = Pick<Pool, "query">;

export interface 已领取消息事件 {
  consumptionId: string;
  sourceEventId: string;
  eventCode: M1事件代码类型;
  aggregateType: string;
  aggregateId: string;
}

export interface 已领取外部投递 extends 外部待投递消息 {
  attemptNumber: number;
}

interface 已领取提醒计划 {
  id: string;
  reminderCode: string;
  aggregateType: string;
  aggregateId: string;
  recipientUserId: string;
  templateCode: string;
  dueOn: string;
  semanticKey: string;
  digestWindowMinutes: 0 | 15 | 60;
  dispatchAfter: string;
  channelCodes: Array<"in_app" | "wecom" | "wecom_app" | "sms" | "email">;
}

interface 到期提醒规则读取结果 {
  已配置规则表: boolean;
  规则数量: number;
}

interface 已发布站内订阅 {
  subscriptionCode: string;
  templateCode: string;
  channelCodes: Array<"in_app" | "wecom" | "wecom_app" | "sms" | "email">;
  categoryCode: "todo" | "business" | "system" | "security";
  priorityCode: "normal" | "strong" | "forced";
  targetAction: "view" | "process" | "approve";
  recipientRule: string;
  recipientScope: Record<string, unknown>;
  titleTemplate: string;
  bodyTemplate: string;
}

function 解密临时测试接收人(
  row: {
    test_recipient_cipher_text: string | null;
    test_recipient_nonce: string | null;
    test_recipient_auth_tag: string | null;
  },
  channelConfigEncryptionKey?: string,
): { type: "email" | "wecom_user"; value: string } | undefined {
  if (!row.test_recipient_cipher_text) return undefined;
  if (!row.test_recipient_nonce || !row.test_recipient_auth_tag || !channelConfigEncryptionKey) {
    throw new Error("测试接收人密文无法读取，请核对消息通道加密密钥。");
  }
  const 密钥 = 校验消息通道配置加密密钥(channelConfigEncryptionKey);
  if (!密钥) throw new Error("测试接收人密文无法读取，请核对消息通道加密密钥。");
  const value = 解密消息通道配置<{ type?: unknown; value?: unknown }>(
    {
      cipherText: row.test_recipient_cipher_text,
      nonce: row.test_recipient_nonce,
      authTag: row.test_recipient_auth_tag,
    },
    密钥,
  );
  if (
    (value.type !== "email" && value.type !== "wecom_user") ||
    typeof value.value !== "string" ||
    !value.value.trim()
  ) {
    throw new Error("测试接收人密文格式无效。");
  }
  return { type: value.type, value: value.value };
}

/**
 * 消息消费事实必须落库。Redis 清空后，关键进程会再次从本存储领取未完成事件。
 */
export class 消息消费存储 {
  private readonly 数据库连接池: Pool;
  private readonly 任务失败阈值: number;

  public constructor(config: 应用配置) {
    if (!config.database.url) {
      throw new Error("消息任务进程启动失败：未配置 DATABASE_URL。");
    }
    this.数据库连接池 = new Pool({
      connectionString: config.database.url,
      max: config.message.role === "critical" ? 3 : 2,
    });
    this.任务失败阈值 = config.message.taskFailureThreshold;
  }

  public async close(): Promise<void> {
    await this.数据库连接池.end();
  }

  /**
   * 仅枚举可投递编号，联系方式和正文均不进入 Redis 队列载荷。
   */
  public async 查询待入队外部投递(批量: number): Promise<
    Array<{
      deliveryId: string;
      channelCode: "wecom" | "wecom_app" | "sms" | "email";
      attemptNumber: number;
    }>
  > {
    const result = await this.数据库连接池.query<{
      delivery_id: string;
      channel_code: "wecom" | "wecom_app" | "sms" | "email";
      attempt_count: number;
    }>(
      `
      SELECT id::text AS delivery_id, channel_code, attempt_count
      FROM message.deliveries
      WHERE channel_code IN ('wecom', 'wecom_app', 'sms', 'email')
        AND (status_code = 'pending' OR (status_code = 'retry_wait' AND next_retry_at <= now()))
      ORDER BY created_at
      LIMIT $1
      `,
      [批量],
    );
    return result.rows.map((row) => ({
      deliveryId: row.delivery_id,
      channelCode: row.channel_code,
      attemptNumber: row.attempt_count,
    }));
  }

  /**
   * 领取动作和尝试次数在同一事务内完成；重复或过期的队列任务会自然空转。
   */
  public async 领取外部投递(
    deliveryId: string,
    channelCode: "wecom" | "wecom_app" | "sms" | "email",
    channelConfigEncryptionKey?: string,
  ): Promise<已领取外部投递 | null> {
    const client = await this.数据库连接池.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<{
        delivery_id: string;
        channel_code: "wecom" | "wecom_app" | "sms" | "email";
        title: string | null;
        body: string | null;
        phone: string | null;
        email: string | null;
        template_code: string;
        attempt_number: number;
        test_recipient_cipher_text: string | null;
        test_recipient_nonce: string | null;
        test_recipient_auth_tag: string | null;
        wecom_user_id: string | null;
      }>(
        `
        WITH candidate AS (
          SELECT delivery.id,
                 notification.title,
                 notification.body,
                 NULLIF(regexp_replace(COALESCE(recipient.phone, ''), '[^0-9]+', '', 'g'), '') AS phone,
                 CASE
                   WHEN preference.email_enabled OR delivery.template_code LIKE 'platform_test_%'
                     THEN NULLIF(recipient.email::text, '')
                   ELSE NULL
                 END AS email,
                 (SELECT identity.external_subject::text
                    FROM iam.external_identities identity
                   WHERE identity.user_id = recipient.id
                     AND identity.provider_code = 'wecom'
                   ORDER BY identity.created_at
                   LIMIT 1) AS wecom_user_id,
                 delivery.test_recipient_cipher_text,
                 delivery.test_recipient_nonce,
                 delivery.test_recipient_auth_tag
          FROM message.deliveries delivery
          LEFT JOIN message.notifications notification ON notification.id = delivery.notification_id
          LEFT JOIN iam.users recipient ON recipient.id = delivery.recipient_user_id
          LEFT JOIN message.user_preferences preference ON preference.user_id = delivery.recipient_user_id
          WHERE delivery.id = $1::uuid
            AND delivery.channel_code = $2
            AND (delivery.status_code = 'pending' OR (delivery.status_code = 'retry_wait' AND delivery.next_retry_at <= now()))
          FOR UPDATE OF delivery SKIP LOCKED
        )
        UPDATE message.deliveries delivery
        SET status_code = 'sending',
            attempt_count = delivery.attempt_count + 1,
            updated_at = now(),
            error_summary = NULL
        FROM candidate
        WHERE delivery.id = candidate.id
        RETURNING delivery.id::text AS delivery_id,
                  delivery.channel_code,
                  candidate.title,
                  candidate.body,
                  candidate.phone,
                  candidate.email,
                  candidate.wecom_user_id,
                  delivery.template_code,
                  delivery.attempt_count AS attempt_number,
                  candidate.test_recipient_cipher_text,
                  candidate.test_recipient_nonce,
                  candidate.test_recipient_auth_tag
        `,
        [deliveryId, channelCode],
      );
      await client.query("COMMIT");
      const row = result.rows[0];
      if (!row) return null;
      const 临时接收人 = 解密临时测试接收人(row, channelConfigEncryptionKey);
      return {
        deliveryId: row.delivery_id,
        channelCode: row.channel_code,
        title: row.title ?? "统一消息提醒",
        body: row.body ?? "请在平台查看详情。",
        ...(row.phone ? { recipientPhone: row.phone } : {}),
        ...(临时接收人?.type === "email"
          ? { recipientEmail: 临时接收人.value }
          : row.email
            ? { recipientEmail: row.email }
            : {}),
        ...(临时接收人?.type === "wecom_user" ? { recipientWecomUserId: 临时接收人.value } : {}),
        ...(!临时接收人 && row.wecom_user_id ? { recipientWecomUserId: row.wecom_user_id } : {}),
        templateCode: row.template_code,
        attemptNumber: row.attempt_number,
      };
    } catch (错误) {
      await client.query("ROLLBACK");
      throw 错误;
    } finally {
      client.release();
    }
  }

  public async 记录外部投递结果(投递: 已领取外部投递, 结果: 外部投递结果): Promise<void> {
    const client = await this.数据库连接池.connect();
    try {
      await client.query("BEGIN");
      const 摘要 = 脱敏错误摘要(结果.summary);
      await client.query(
        `
        UPDATE message.deliveries
        SET status_code = $2,
            next_retry_at = CASE
              WHEN $2 = 'retry_wait'
                THEN now() + LEAST(30 * power(2, GREATEST(attempt_count - 1, 0)), 3600) * interval '1 second'
              ELSE NULL
            END,
            provider_message_id = $3,
            receipt_json = jsonb_build_object('providerCode', $4::text, 'httpStatus', $5::integer),
            error_summary = CASE WHEN $2 IN ('retry_wait', 'failed', 'ignored') THEN $6 ELSE NULL END,
            test_recipient_cipher_text = CASE WHEN $2 IN ('success', 'failed', 'ignored') THEN NULL ELSE test_recipient_cipher_text END,
            test_recipient_nonce = CASE WHEN $2 IN ('success', 'failed', 'ignored') THEN NULL ELSE test_recipient_nonce END,
            test_recipient_auth_tag = CASE WHEN $2 IN ('success', 'failed', 'ignored') THEN NULL ELSE test_recipient_auth_tag END,
            updated_at = now(),
            finished_at = CASE WHEN $2 IN ('success', 'failed', 'ignored') THEN now() ELSE NULL END
        WHERE id = $1::uuid AND status_code = 'sending'
        `,
        [
          投递.deliveryId,
          结果.statusCode,
          结果.providerMessageId ?? null,
          结果.providerCode,
          结果.httpStatus ?? null,
          摘要,
        ],
      );
      await client.query(
        `
        INSERT INTO message.delivery_attempts (
          delivery_id, attempt_number, channel_code, status_code, retryable,
          provider_code, http_status, provider_message_id, response_summary
        ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (delivery_id, attempt_number) DO NOTHING
        `,
        [
          投递.deliveryId,
          投递.attemptNumber,
          投递.channelCode,
          结果.statusCode,
          结果.retryable,
          结果.providerCode,
          结果.httpStatus ?? null,
          结果.providerMessageId ?? null,
          摘要,
        ],
      );
      if (投递.templateCode.startsWith("platform_test_")) {
        await client.query(
          `UPDATE message.channel_accounts
              SET last_test_status = $2, last_tested_at = now(), updated_at = now()
            WHERE channel_code = $1`,
          [投递.channelCode, 结果.statusCode],
        );
      }
      await client.query("COMMIT");
    } catch (错误) {
      await client.query("ROLLBACK");
      throw 错误;
    } finally {
      client.release();
    }
  }

  /** 网页配置存在时覆盖同通道启动参数；不存在时完整保留既有环境变量行为。 */
  public async 读取通道运行配置(
    config: 应用配置,
    channelCode: "wecom" | "wecom_app" | "sms" | "email",
    测试投递 = false,
  ): Promise<应用配置> {
    const 密钥 = config.message.channelConfigEncryptionKey
      ? 校验消息通道配置加密密钥(config.message.channelConfigEncryptionKey)
      : undefined;
    if (!密钥) return config;
    const result = await this.数据库连接池.query<{
      enabled: boolean;
      cipher_text: string;
      nonce: string;
      auth_tag: string;
    }>(
      `SELECT enabled, cipher_text, nonce, auth_tag
         FROM message.channel_accounts WHERE channel_code = $1 LIMIT 1`,
      [channelCode],
    );
    const row = result.rows[0];
    if (!row) return config;
    const 通道配置 = 解密消息通道配置<Record<string, string | number>>(
      { cipherText: row.cipher_text, nonce: row.nonce, authTag: row.auth_tag },
      密钥,
    );
    const enabled = 测试投递 || row.enabled;
    if (channelCode === "wecom") {
      return {
        ...config,
        message: {
          ...config.message,
          channels: {
            ...config.message.channels,
            wecomGroup: {
              ...config.message.channels.wecomGroup,
              enabled,
              webhook: String(通道配置.webhook || ""),
            },
          },
        },
      };
    }
    if (channelCode === "wecom_app") {
      return {
        ...config,
        message: {
          ...config.message,
          channels: {
            ...config.message.channels,
            wecomApp: {
              ...config.message.channels.wecomApp,
              enabled,
              corpId: String(通道配置.corpId || ""),
              agentId: Number(通道配置.agentId || 0),
              secret: String(通道配置.secret || ""),
            },
          },
        },
      };
    }
    if (channelCode === "sms") {
      return {
        ...config,
        message: {
          ...config.message,
          channels: {
            ...config.message.channels,
            sms: {
              ...config.message.channels.sms,
              enabled,
              endpoint: String(通道配置.endpoint || ""),
              apiKey: String(通道配置.apiKey || ""),
              apiSecret: String(通道配置.apiSecret || ""),
              templateId: String(通道配置.templateId || ""),
              ...(String(通道配置.sender || "") ? { sender: String(通道配置.sender) } : {}),
            },
          },
        },
      };
    }
    return {
      ...config,
      message: {
        ...config.message,
        channels: {
          ...config.message.channels,
          email: {
            ...config.message.channels.email,
            enabled,
            smtpHost: String(通道配置.smtpHost || ""),
            smtpPort: Number(通道配置.smtpPort || 587),
            security: 通道配置.security === "tls" ? "tls" : "starttls",
            username: String(通道配置.username || ""),
            password: String(通道配置.password || ""),
            from: String(通道配置.from || ""),
          },
        },
      },
    };
  }

  public async 处理一批站内消息(
    config: 应用配置,
    cutoverAt: string,
    批量: number,
  ): Promise<number> {
    const client = await this.数据库连接池.connect();
    try {
      await client.query("BEGIN");
      await this.登记待消费事件(client, cutoverAt);
      const 事件集合 = await this.领取待消费事件(client, 批量);
      await client.query("COMMIT");

      for (const 事件 of 事件集合) {
        await this.处理单个事件(事件, config);
      }
      await this.记录关键消息任务成功();
      return 事件集合.length;
    } catch (错误) {
      await client.query("ROLLBACK");
      await this.记录关键消息任务失败(错误);
      throw 错误;
    } finally {
      client.release();
    }
  }

  public async 重新领取过期锁(): Promise<number> {
    const result = await this.数据库连接池.query(
      `
      UPDATE message.event_consumptions
      SET status_code = 'retry_wait',
          locked_until = NULL,
          next_retry_at = now(),
          updated_at = now(),
          last_error_summary = '消息消费锁已过期，等待重新领取。'
      WHERE consumer_code = $1
        AND status_code = 'processing'
        AND locked_until < now()
      `,
      [消息消费者代码],
    );
    return result.rowCount ?? 0;
  }

  /**
   * 每次扫描只读取 CRM 主表当前负责人和到期字段，不采信协作人等尚无权威关系的数据。
   * 计划语义键在数据库唯一约束下去重，因此同一天的重复扫描、重试或多实例不会重复提醒。
   */
  public async 扫描并投递到期提醒(
    config: 应用配置,
  ): Promise<{ scheduledCount: number; notifiedCount: number }> {
    const 规则 = await this.读取到期提醒规则状态();
    const scheduledCount =
      规则.已配置规则表 && 规则.规则数量 > 0
        ? await this.按提醒规则登记到期提醒计划(config.message.reminderDigestMinutes)
        : await this.登记兼容到期提醒计划(
            config.message.reminderAdvanceDays,
            config.message.reminderDigestMinutes,
          );
    const 已领取集合 = await this.领取待投递提醒计划(config.message.reminderBatchSize);
    if (!已领取集合.length) return { scheduledCount, notifiedCount: 0 };

    let notifiedCount = 0;
    for (const 提醒组 of 分组合并提醒计划(已领取集合)) {
      try {
        await this.写入提醒通知组(提醒组, config);
        notifiedCount += 提醒组.length;
      } catch (错误) {
        await this.恢复提醒计划(
          提醒组.map((计划) => 计划.id),
          错误,
        );
        throw 错误;
      }
    }
    return { scheduledCount, notifiedCount };
  }

  /**
   * 新规则表尚未部署时保留 M3 的单一提前天数行为，避免先发 Worker 后发迁移造成提醒中断。
   */
  private async 登记兼容到期提醒计划(提前天数: number, 合并窗口分钟: 0 | 15 | 60): Promise<number> {
    const result = await this.数据库连接池.query(
      `
      WITH 配置 AS (
        SELECT $1::integer AS advance_days, $2::integer AS digest_minutes,
               timezone('Asia/Shanghai', now())::date AS today
      ), 待提醒 AS (
        SELECT 'crm.registration.expiring'::text AS reminder_code,
               'registration'::text AS aggregate_type,
               registration.id AS aggregate_id,
               registration.owner_user_id AS recipient_user_id,
               message.safe_business_date(registration.extra_json->>'expireAt') AS due_on
        FROM crm.registrations registration
        JOIN iam.users owner ON owner.id = registration.owner_user_id AND owner.status_code = 'active'
        WHERE registration.status_code = 'approved'
        UNION ALL
        SELECT 'crm.opportunity.expected_close'::text AS reminder_code,
               'opportunity'::text AS aggregate_type,
               opportunity.id AS aggregate_id,
               opportunity.owner_user_id AS recipient_user_id,
               message.safe_business_date(opportunity.extra_json->>'expectedClose') AS due_on
        FROM crm.opportunities opportunity
        JOIN iam.users owner ON owner.id = opportunity.owner_user_id AND owner.status_code = 'active'
        WHERE opportunity.status_code = 'active'
      )
      INSERT INTO message.reminder_schedules (
        reminder_code, aggregate_type, aggregate_id, recipient_user_id, due_on,
        advance_days, digest_window_minutes, dispatch_after, semantic_key
      )
      SELECT 待提醒.reminder_code,
             待提醒.aggregate_type,
             待提醒.aggregate_id,
             待提醒.recipient_user_id,
             待提醒.due_on,
             配置.advance_days,
             配置.digest_minutes,
             CASE 配置.digest_minutes
               WHEN 0 THEN now()
               WHEN 15 THEN date_trunc('hour', now())
                 + ((floor(extract(minute FROM now()) / 15)::integer + 1) * interval '15 minutes')
               ELSE date_trunc('hour', now()) + interval '1 hour'
             END,
             encode(digest(concat_ws(':', 待提醒.reminder_code, 待提醒.aggregate_id::text,
               待提醒.recipient_user_id::text, 待提醒.due_on::text, 配置.advance_days::text,
               配置.digest_minutes::text), 'sha256'), 'hex')
      FROM 待提醒
      CROSS JOIN 配置
      WHERE 待提醒.due_on = 配置.today + 配置.advance_days
      ON CONFLICT (semantic_key) DO NOTHING
      `,
      [提前天数, 合并窗口分钟],
    );
    return result.rowCount ?? 0;
  }

  /**
   * 规则停用后不再登记新的计划；已领取、已生成的提醒不撤回。
   * 已有规则记录时以该表为唯一事实，不能在“所有规则均停用”时回退到旧环境变量；
   * 规则表为空时保留旧 30 天路径，兼容先发布数据库结构、后导入规则种子的过渡期。
   */
  private async 读取到期提醒规则状态(): Promise<到期提醒规则读取结果> {
    const 表存在结果 = await this.数据库连接池.query<{ exists: boolean }>(
      "SELECT to_regclass('message.reminder_rules') IS NOT NULL AS exists",
    );
    const 已配置规则表 = 表存在结果.rows[0]?.exists === true;
    if (!已配置规则表) return { 已配置规则表: false, 规则数量: 0 };

    const 数量结果 = await this.数据库连接池.query<{ count: string }>(
      `
      SELECT count(*)::text AS count
      FROM message.reminder_rules
      `,
    );
    return {
      已配置规则表: true,
      规则数量: Number(数量结果.rows[0]?.count ?? 0),
    };
  }

  private async 按提醒规则登记到期提醒计划(_合并窗口分钟: 0 | 15 | 60): Promise<number> {
    const 本地时间 = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Shanghai" }));
    const 今天 = 本地时间.toISOString().slice(0, 10);
    const 当前时间 = `${String(本地时间.getHours()).padStart(2, "0")}:${String(本地时间.getMinutes()).padStart(2, "0")}`;
    const 星期 = 本地时间.getUTCDay();
    const 是工作日 = 星期 >= 1 && 星期 <= 5;
    const 规则结果 = await this.数据库连接池.query<{
      rule_code: string;
      reminder_code: string;
      aggregate_type: string;
      advance_days: number[];
      dispatch_time: string;
      workday_only: boolean;
      recipient_rule_json: { type?: string; scope?: Record<string, unknown> };
      channel_codes: Array<"in_app" | "wecom" | "wecom_app" | "sms" | "email">;
      digest_window_minutes: 0 | 15 | 60;
      template_code: string;
      data_source_code: string;
    }>(
      `
      SELECT rule.rule_code, rule.reminder_code, rule.aggregate_type, rule.advance_days,
             to_char(rule.dispatch_time, 'HH24:MI') AS dispatch_time, rule.workday_only,
             rule.recipient_rule_json, rule.channel_codes, rule.digest_window_minutes,
             rule.template_code, rule.data_source_code
        FROM message.reminder_rules rule
       WHERE rule.status_code = 'active'
      `,
    );
    let 登记数量 = 0;
    for (const 规则 of 规则结果.rows) {
      if (规则.workday_only && !是工作日) continue;
      if (当前时间 < 规则.dispatch_time) continue;
      const 聚合集合 = await 扫描到期聚合(this.数据库连接池, 规则.data_source_code);
      for (const 聚合 of 聚合集合) {
        for (const 天数 of 规则.advance_days) {
          if (!聚合.dueOn || 聚合.dueOn !== 加天数(今天, 天数)) continue;
          const 接收人 = await 解析到期任务接收人(
            this.数据库连接池,
            聚合,
            规则.recipient_rule_json,
          );
          for (const 接收人编号 of 接收人) {
            const 语义键 = crypto
              .createHash("sha256")
              .update(
                [
                  规则.rule_code,
                  规则.reminder_code,
                  聚合.aggregateId,
                  接收人编号,
                  聚合.dueOn,
                  天数,
                ].join(":"),
                "utf8",
              )
              .digest("hex");
            const 投递结果 = await this.数据库连接池.query(
              `
              INSERT INTO message.reminder_schedules (
                reminder_code, aggregate_type, aggregate_id, recipient_user_id, due_on,
                advance_days, digest_window_minutes, dispatch_after, semantic_key, channel_codes
              ) VALUES ($1,$2,$3::uuid,$4::uuid,$5::date,$6,$7,
                        (timezone('Asia/Shanghai', now())::date + $8::time) AT TIME ZONE 'Asia/Shanghai',
                        $9, $10::jsonb)
              ON CONFLICT (semantic_key) DO NOTHING
              `,
              [
                规则.reminder_code,
                规则.aggregate_type,
                聚合.aggregateId,
                接收人编号,
                聚合.dueOn,
                天数,
                规则.digest_window_minutes,
                `${规则.dispatch_time}:00`,
                语义键,
                JSON.stringify(规则.channel_codes),
              ],
            );
            登记数量 += 投递结果.rowCount ?? 0;
          }
        }
      }
    }
    return 登记数量;
  }

  private async 领取待投递提醒计划(批量: number): Promise<已领取提醒计划[]> {
    const result = await this.数据库连接池.query<{
      id: string;
      reminder_code: 已领取提醒计划["reminderCode"];
      aggregate_type: 已领取提醒计划["aggregateType"];
      aggregate_id: string;
      recipient_user_id: string;
      due_on: string;
      semantic_key: string;
      digest_window_minutes: 已领取提醒计划["digestWindowMinutes"];
      dispatch_after: string;
      channel_codes: 已领取提醒计划["channelCodes"];
      template_code: string;
    }>(
      `
      WITH 候选 AS (
        SELECT schedule.id, rule.template_code
        FROM message.reminder_schedules schedule
        JOIN message.reminder_rules rule ON rule.rule_code = schedule.rule_code
        WHERE schedule.status_code = 'pending' AND schedule.dispatch_after <= now()
        ORDER BY schedule.dispatch_after, schedule.created_at
        FOR UPDATE OF schedule SKIP LOCKED
        LIMIT $1
      )
      UPDATE message.reminder_schedules schedule
      SET status_code = 'processing',
          attempt_count = schedule.attempt_count + 1,
          locked_until = now() + interval '120 seconds',
          last_error_summary = NULL,
          updated_at = now()
      FROM 候选
      WHERE schedule.id = 候选.id
      RETURNING schedule.id::text, schedule.reminder_code, schedule.aggregate_type,
                schedule.aggregate_id::text, schedule.recipient_user_id::text,
                schedule.due_on::text, schedule.semantic_key,
                schedule.digest_window_minutes, schedule.dispatch_after::text,
                schedule.channel_codes, 候选.template_code
      `,
      [批量],
    );
    return result.rows.map((行) => ({
      id: 行.id,
      reminderCode: 行.reminder_code,
      aggregateType: 行.aggregate_type,
      aggregateId: 行.aggregate_id,
      recipientUserId: 行.recipient_user_id,
      templateCode: 行.template_code,
      dueOn: 行.due_on,
      semanticKey: 行.semantic_key,
      digestWindowMinutes: 行.digest_window_minutes,
      dispatchAfter: 行.dispatch_after,
      channelCodes: 行.channel_codes,
    }));
  }

  private async 写入提醒通知组(提醒组: 已领取提醒计划[], config: 应用配置): Promise<void> {
    const 首项 = 提醒组[0];
    if (!首项) return;
    const client = await this.数据库连接池.connect();
    try {
      await client.query("BEGIN");
      const 是合并提醒 = 提醒组.length > 1;
      const 模板代码 = 首项.templateCode || 首项.reminderCode;
      const 模板 = await this.查询到期提醒模板(client, 模板代码);
      const 变量集合 = await this.查询提醒业务变量(client, 提醒组);
      const 渲染结果集合 = 提醒组.map((计划, 序号) =>
        渲染模板(模板.title_template, 模板.body_template, 变量集合[序号] || {}),
      );
      const 标题 = 渲染结果集合[0]?.title || 构建到期提醒标题(首项.reminderCode, 提醒组.length);
      const 正文 = 是合并提醒
        ? 渲染结果集合.map((结果) => 结果.body).join("\n")
        : 渲染结果集合[0]?.body || 构建到期提醒正文(首项.reminderCode, false);
      const 语义键 = crypto
        .createHash("sha256")
        .update(
          提醒组
            .map((计划) => 计划.semanticKey)
            .sort()
            .join(":"),
          "utf8",
        )
        .digest("hex");
      const 站内去重键 = crypto
        .createHash("sha256")
        .update(`${语义键}:in_app`, "utf8")
        .digest("hex");
      const 通知编号 = await 写入提醒通知(client, {
        recipientUserId: 首项.recipientUserId,
        reminderCode: 首项.reminderCode,
        aggregateType: 是合并提醒 ? "reminder_digest" : 首项.aggregateType,
        aggregateId: 是合并提醒 ? null : 首项.aggregateId,
        title: 标题,
        body: 正文,
        deduplicationKey: 站内去重键,
      });
      await client.query(
        `
        INSERT INTO message.deliveries (
          notification_id, recipient_user_id, channel_code, template_code, template_version,
          semantic_key, deduplication_key, status_code, finished_at
        ) VALUES ($1::uuid, $2::uuid, 'in_app', $3, 1, $4, $5, 'success', now())
        ON CONFLICT (deduplication_key) DO NOTHING
        `,
        [通知编号, 首项.recipientUserId, `${模板代码}_in_app`, 语义键, 站内去重键],
      );
      if (config.message.channels.email.enabled && 首项.channelCodes.includes("email")) {
        const 邮箱去重键 = crypto
          .createHash("sha256")
          .update(`${语义键}:email`, "utf8")
          .digest("hex");
        await client.query(
          `
          INSERT INTO message.deliveries (
            notification_id, recipient_user_id, channel_code, template_code, template_version,
            semantic_key, deduplication_key, status_code
          )
          SELECT $1::uuid, $2::uuid, 'email', $3::text, 1, $4::text, $5::text, 'pending'
          WHERE EXISTS (
            SELECT 1
            FROM message.user_preferences preference
            JOIN iam.users recipient ON recipient.id = preference.user_id
            WHERE preference.user_id = $2::uuid
              AND preference.email_enabled
              AND recipient.status_code = 'active'
              AND NULLIF(recipient.email::text, '') IS NOT NULL
          )
          ON CONFLICT (deduplication_key) DO NOTHING
          `,
          [通知编号, 首项.recipientUserId, `${模板代码}_email`, 语义键, 邮箱去重键],
        );
      }
      if (config.message.channels.wecomApp.enabled && 首项.channelCodes.includes("wecom_app")) {
        const 企微应用去重键 = crypto
          .createHash("sha256")
          .update(`${语义键}:wecom_app`, "utf8")
          .digest("hex");
        await client.query(
          `
          INSERT INTO message.deliveries (
            notification_id, recipient_user_id, channel_code, template_code, template_version,
            semantic_key, deduplication_key, status_code
          )
          SELECT $1::uuid, $2::uuid, 'wecom_app', $3::text, 1, $4::text, $5::text, 'pending'
          WHERE EXISTS (
            SELECT 1
            FROM iam.external_identities identity
            JOIN iam.users recipient ON recipient.id = identity.user_id
            WHERE identity.user_id = $2::uuid
              AND identity.provider_code = 'wecom'
              AND NULLIF(identity.external_subject::text, '') IS NOT NULL
              AND recipient.status_code = 'active'
          )
          ON CONFLICT (deduplication_key) DO NOTHING
          `,
          [通知编号, 首项.recipientUserId, `${模板代码}_wecom_app`, 语义键, 企微应用去重键],
        );
      }
      await client.query(
        `
        UPDATE message.reminder_schedules
        SET status_code = 'succeeded', locked_until = NULL, finished_at = now(), updated_at = now()
        WHERE id = ANY($1::uuid[]) AND status_code = 'processing'
        `,
        [提醒组.map((计划) => 计划.id)],
      );
      await client.query("COMMIT");
    } catch (错误) {
      await client.query("ROLLBACK");
      throw 错误;
    } finally {
      client.release();
    }
  }

  private async 查询到期提醒模板(
    client: PoolClient,
    模板代码: string,
  ): Promise<{ title_template: string; body_template: string }> {
    const 渠道模板结果 = await client.query<{ title_template: string; body_template: string }>(
      `
      SELECT title_template, body_template
      FROM message.templates
      WHERE template_code = $1 AND status_code = 'published' AND channel_code = 'in_app'
      LIMIT 1
      `,
      [`${模板代码}_in_app`],
    );
    const 渠道模板 = 渠道模板结果.rows[0];
    if (渠道模板) return 渠道模板;
    const 目录结果 = await client.query<{ title_template: string; body_template: string }>(
      `
      SELECT title_template, body_template
      FROM message.reminder_templates
      WHERE template_code = $1
      LIMIT 1
      `,
      [模板代码],
    );
    const 目录模板 = 目录结果.rows[0];
    if (目录模板) return 目录模板;
    return {
      title_template: 构建到期提醒标题(模板代码, 1),
      body_template: 构建到期提醒正文(模板代码, false),
    };
  }

  private async 查询提醒业务变量(
    client: PoolClient,
    计划集合: 已领取提醒计划[],
  ): Promise<模板变量字典[]> {
    const 变量集合: 模板变量字典[] = [];
    for (const 计划 of 计划集合) {
      if (计划.aggregateType === "registration") {
        const result = await client.query<{
          customer_name: string | null;
          business_no: string | null;
          protect_days: string | null;
          partner_name: string | null;
          submitter_name: string | null;
        }>(
          `
          SELECT COALESCE(registration.extra_json->>'customer', customer.customer_name) AS customer_name,
                 registration.registration_no AS business_no,
                 registration.extra_json->>'protectDays' AS protect_days,
                 COALESCE(NULLIF(partner.partner_name, ''), '未绑定渠道商') AS partner_name,
                 COALESCE(NULLIF(submitter.display_name, ''), NULLIF(submitter.username, ''), '未登记提报人') AS submitter_name
          FROM crm.registrations registration
          LEFT JOIN crm.customers customer ON customer.id = registration.customer_id
          LEFT JOIN channel.partners partner ON partner.id = registration.partner_id
          LEFT JOIN iam.users submitter ON submitter.id = registration.owner_user_id
          WHERE registration.id = $1::uuid
          LIMIT 1
          `,
          [计划.aggregateId],
        );
        const 行 = result.rows[0];
        变量集合.push({
          customer_name: 行?.customer_name || "",
          business_no: 行?.business_no || "",
          due_date: 计划.dueOn,
          protect_days: 行?.protect_days || "",
          days_left: 计算剩余天数(计划.dueOn),
          partner_name: 行?.partner_name || "未绑定渠道商",
          submitter_name: 行?.submitter_name || "未登记提报人",
        });
      } else if (计划.aggregateType === "opportunity") {
        const result = await client.query<{
          customer_name: string | null;
          business_no: string | null;
          expected_amount: string | null;
          partner_name: string | null;
          submitter_name: string | null;
        }>(
          `
          SELECT opportunity.extra_json->>'customer' AS customer_name,
                 opportunity.opportunity_no AS business_no,
                 opportunity.expected_amount::text AS expected_amount,
                 COALESCE(NULLIF(partner.partner_name, ''), '未绑定渠道商') AS partner_name,
                 COALESCE(NULLIF(submitter.display_name, ''), NULLIF(submitter.username, ''), '未登记提报人') AS submitter_name
          FROM crm.opportunities opportunity
          LEFT JOIN channel.partners partner ON partner.id = opportunity.partner_id
          LEFT JOIN iam.users submitter ON submitter.id = opportunity.owner_user_id
          WHERE opportunity.id = $1::uuid
          LIMIT 1
          `,
          [计划.aggregateId],
        );
        const 行 = result.rows[0];
        变量集合.push({
          customer_name: 行?.customer_name || "",
          business_no: 行?.business_no || "",
          due_date: 计划.dueOn,
          days_left: 计算剩余天数(计划.dueOn),
          expected_amount: 行?.expected_amount || "",
          partner_name: 行?.partner_name || "未绑定渠道商",
          submitter_name: 行?.submitter_name || "未登记提报人",
        });
      } else if (计划.aggregateType === "quote") {
        const result = await client.query<{
          customer_name: string | null;
          business_no: string | null;
          total_amount: string | null;
          partner_name: string | null;
          submitter_name: string | null;
        }>(
          `
          SELECT COALESCE(quote.extra_json->>'customer', customer.customer_name) AS customer_name,
                 quote.quote_no AS business_no,
                 quote.total_amount::text AS total_amount,
                 COALESCE(NULLIF(partner.partner_name, ''), '未绑定渠道商') AS partner_name,
                 COALESCE(NULLIF(submitter.display_name, ''), NULLIF(submitter.username, ''), '未登记提报人') AS submitter_name
          FROM crm.quotes quote
          LEFT JOIN crm.customers customer ON customer.id = quote.customer_id
          LEFT JOIN channel.partners partner ON partner.id = quote.partner_id
          LEFT JOIN iam.users submitter ON submitter.id = quote.owner_user_id
          WHERE quote.id = $1::uuid
          LIMIT 1
          `,
          [计划.aggregateId],
        );
        const 行 = result.rows[0];
        变量集合.push({
          customer_name: 行?.customer_name || "",
          business_no: 行?.business_no || "",
          due_date: 计划.dueOn,
          days_left: 计算剩余天数(计划.dueOn),
          total_amount: 行?.total_amount || "",
          partner_name: 行?.partner_name || "未绑定渠道商",
          submitter_name: 行?.submitter_name || "未登记提报人",
        });
      } else if (计划.aggregateType === "order") {
        const result = await client.query<{
          customer_name: string | null;
          order_name: string | null;
          business_no: string | null;
          total_amount: string | null;
          partner_name: string | null;
          submitter_name: string | null;
        }>(
          `
          SELECT COALESCE(order_record.extra_json->>'customer', customer.customer_name) AS customer_name,
                 COALESCE(
                   NULLIF(order_record.extra_json->>'projectName', ''),
                   NULLIF(order_record.extra_json->>'project', ''),
                   NULLIF(quote.extra_json->>'projectName', ''),
                   NULLIF(quote.extra_json->>'project', ''),
                   NULLIF(opportunity.extra_json->>'name', ''),
                   NULLIF(opportunity.extra_json->>'opportunityName', ''),
                   NULLIF(opportunity.extra_json->>'projectName', ''),
                   NULLIF(opportunity.extra_json->>'project', ''),
                   '未填写订单名称'
                 ) AS order_name,
                 order_record.order_no AS business_no,
                 order_record.total_amount::text AS total_amount,
                 COALESCE(NULLIF(partner.partner_name, ''), '未绑定渠道商') AS partner_name,
                 COALESCE(NULLIF(submitter.display_name, ''), NULLIF(submitter.username, ''), '未登记提报人') AS submitter_name
          FROM crm.orders order_record
          LEFT JOIN crm.customers customer ON customer.id = order_record.customer_id
          LEFT JOIN crm.quotes quote ON quote.id = order_record.quote_id
          LEFT JOIN crm.opportunities opportunity ON opportunity.id = quote.opportunity_id
          LEFT JOIN channel.partners partner ON partner.id = order_record.partner_id
          LEFT JOIN iam.users submitter ON submitter.id = order_record.owner_user_id
          WHERE order_record.id = $1::uuid
          LIMIT 1
          `,
          [计划.aggregateId],
        );
        const 行 = result.rows[0];
        变量集合.push({
          customer_name: 行?.customer_name || "",
          order_name: 行?.order_name || "未填写订单名称",
          business_no: 行?.business_no || "",
          due_date: 计划.dueOn,
          days_left: 计算剩余天数(计划.dueOn),
          total_amount: 行?.total_amount || "",
          partner_name: 行?.partner_name || "未绑定渠道商",
          submitter_name: 行?.submitter_name || "未登记提报人",
        });
      } else {
        变量集合.push({
          due_date: 计划.dueOn,
          days_left: 计算剩余天数(计划.dueOn),
        });
      }
    }
    return 变量集合;
  }

  private async 恢复提醒计划(计划编号集合: string[], 错误: unknown): Promise<void> {
    await this.数据库连接池.query(
      `
      UPDATE message.reminder_schedules
      SET status_code = 'pending', locked_until = NULL, updated_at = now(), last_error_summary = $2
      WHERE id = ANY($1::uuid[]) AND status_code = 'processing'
      `,
      [计划编号集合, 脱敏错误摘要(错误)],
    );
  }

  private async 登记待消费事件(client: PoolClient, cutoverAt: string): Promise<void> {
    await client.query(
      `
      INSERT INTO message.event_consumptions (
        source_event_id, consumer_code, event_code, event_version, status_code
      )
      SELECT outbox.id, $1, outbox.event_type, 1, 'pending'
      FROM ops.outbox_events outbox
      WHERE outbox.created_at >= $2::timestamptz
        AND outbox.event_type = ANY($3::text[])
      ON CONFLICT (source_event_id, consumer_code) DO NOTHING
      `,
      [消息消费者代码, cutoverAt, M1事件代码集合],
    );
  }

  private async 领取待消费事件(client: PoolClient, 批量: number): Promise<已领取消息事件[]> {
    const result = await client.query<{
      consumption_id: string;
      source_event_id: string;
      event_code: string;
      aggregate_type: string;
      aggregate_id: string;
    }>(
      `
      WITH 候选 AS (
        SELECT consumption.id
        FROM message.event_consumptions consumption
        WHERE consumption.consumer_code = $1
          AND (
            consumption.status_code = 'pending'
            OR (consumption.status_code = 'retry_wait' AND consumption.next_retry_at <= now())
          )
        ORDER BY consumption.created_at
        FOR UPDATE SKIP LOCKED
        LIMIT $2
      )
      UPDATE message.event_consumptions consumption
      SET status_code = 'processing',
          attempt_count = consumption.attempt_count + 1,
          locked_until = now() + interval '120 seconds',
          updated_at = now(),
          last_error_summary = NULL
      FROM 候选, ops.outbox_events outbox
      WHERE consumption.id = 候选.id
        AND outbox.id = consumption.source_event_id
      RETURNING consumption.id::text AS consumption_id,
                consumption.source_event_id::text AS source_event_id,
                consumption.event_code,
                outbox.aggregate_type,
                outbox.aggregate_id::text AS aggregate_id
      `,
      [消息消费者代码, 批量],
    );

    return result.rows.map((行) => {
      if (!M1事件代码集合.includes(行.event_code as M1事件代码类型)) {
        throw new Error("消息事件代码不在 M1 白名单内。");
      }
      return {
        consumptionId: 行.consumption_id,
        sourceEventId: 行.source_event_id,
        eventCode: 行.event_code as M1事件代码类型,
        aggregateType: 行.aggregate_type,
        aggregateId: 行.aggregate_id,
      };
    });
  }

  private async 处理单个事件(事件: 已领取消息事件, config: 应用配置): Promise<void> {
    try {
      const client = await this.数据库连接池.connect();
      try {
        await client.query("BEGIN");
        const 订阅集合 = await this.查询已发布事件订阅(client, 事件.eventCode);
        const 变量 = await this.查询事件模板变量(client, 事件);

        for (const 订阅 of 订阅集合) {
          const 接收人编号集合 = await this.解析接收人(client, 事件, 订阅);
          if (!接收人编号集合.length) continue;
          for (const 接收人编号 of 接收人编号集合) {
            const 通知编号 = await this.写入事件通知(client, 事件, 订阅, 接收人编号, 变量);
            await this.写入事件投递事实(client, 事件, 订阅, 接收人编号, 通知编号, config);
          }
        }
        await this.标记消费成功(client, 事件.consumptionId);
        await client.query("COMMIT");
      } catch (错误) {
        await client.query("ROLLBACK");
        throw 错误;
      } finally {
        client.release();
      }
    } catch (错误) {
      if (错误 instanceof 已停用消息规则错误) {
        await this.标记消费受控跳过(事件.consumptionId, 错误.message);
      } else {
        await this.标记消费失败(事件.consumptionId, 错误);
      }
    }
  }

  private async 查询已发布事件订阅(
    client: PoolClient,
    eventCode: M1事件代码类型,
  ): Promise<已发布站内订阅[]> {
    const result = await client.query<{
      category_code: 已发布站内订阅["categoryCode"];
      priority_code: 已发布站内订阅["priorityCode"];
      channel_codes: Array<"in_app" | "wecom" | "wecom_app" | "sms" | "email">;
      recipient_rule_json: Record<string, unknown>;
      subscription_code: string;
      template_code: string;
      title_template: string;
      body_template: string;
    }>(
      `
      SELECT catalog.category_code, catalog.priority_code,
             subscription.channel_codes, subscription.recipient_rule_json,
             subscription.subscription_code, subscription.template_code,
             catalog.title_template, catalog.body_template
      FROM message.event_subscriptions subscription
      JOIN message.reminder_templates catalog
        ON catalog.template_code = subscription.template_code
      WHERE subscription.event_code = $1
        AND subscription.event_version = 1
        AND subscription.status_code = 'active'
        AND subscription.channel_codes @> '["in_app"]'::jsonb
        AND (subscription.effective_at IS NULL OR subscription.effective_at <= now())
        AND (subscription.expired_at IS NULL OR subscription.expired_at > now())
      ORDER BY subscription.created_at
      `,
      [eventCode],
    );
    if (!result.rows.length) {
      const 已停用规则 = await client.query<{ skipped: boolean }>(
        `
        SELECT EXISTS (
          SELECT 1
          FROM message.event_subscriptions subscription
          WHERE subscription.event_code = $1
            AND subscription.event_version = 1
            AND (
              subscription.status_code = 'disabled'
              OR NOT (subscription.channel_codes @> '["in_app"]'::jsonb)
            )
        ) AS skipped
        `,
        [eventCode],
      );
      if (已停用规则.rows[0]?.skipped) {
        throw new 已停用消息规则错误("消息规则已停用或未启用站内渠道，事件已受控跳过。");
      }
      throw new 不可重试消息错误("未配置有效的站内消息订阅或模板。");
    }
    return result.rows.map((行) => ({
      subscriptionCode: 行.subscription_code,
      templateCode: 行.template_code,
      channelCodes: 校验事件通道集合(行.channel_codes),
      categoryCode: 行.category_code,
      priorityCode: 行.priority_code,
      targetAction: 读取目标动作(行.recipient_rule_json),
      recipientRule: String(行.recipient_rule_json.type || ""),
      recipientScope: (行.recipient_rule_json.scope ?? {}) as Record<string, unknown>,
      titleTemplate: 行.title_template,
      bodyTemplate: 行.body_template,
    }));
  }

  private async 解析接收人(
    client: PoolClient,
    事件: 已领取消息事件,
    订阅: 已发布站内订阅,
  ): Promise<string[]> {
    const 规则 = 订阅.recipientRule;
    if (规则 === "business_owner") {
      if (事件.eventCode.startsWith("crm.order.")) return 查询订单负责人(client, 事件.aggregateId);
      if (事件.eventCode.startsWith("crm.quote."))
        return 查询业务负责人(client, "crm.quotes", 事件.aggregateId);
      if (事件.eventCode.startsWith("crm.opportunity.")) {
        return 查询业务负责人(client, "crm.opportunities", 事件.aggregateId);
      }
      if (事件.eventCode.startsWith("crm.registration.")) {
        return 查询业务负责人(client, "crm.registrations", 事件.aggregateId);
      }
    }
    if (规则 === "order_current_approver" && 事件.eventCode.startsWith("crm.order.")) {
      return 查询订单当前审批人(client, 事件.aggregateId);
    }
    if (
      规则 === "registration_creator_and_owner" &&
      事件.eventCode.startsWith("crm.registration.")
    ) {
      return 查询报备申请人与负责人(client, 事件.aggregateId);
    }
    if (
      规则 === "registration_pending_approver" &&
      事件.eventCode === "crm.registration.approval.pending"
    ) {
      return 查询报备待审批接收人(client, 事件.aggregateId, 订阅.recipientScope);
    }
    if (规则 === "platform_administrator") {
      return 查询平台管理员(client);
    }
    if (
      规则 === "roles" ||
      规则 === "users" ||
      规则 === "org" ||
      规则 === "region" ||
      规则 === "partners"
    ) {
      return 解析范围接收人(client, 规则, 订阅.recipientScope);
    }
    return [];
  }

  private async 查询事件模板变量(client: PoolClient, 事件: 已领取消息事件): Promise<模板变量字典> {
    if (事件.eventCode.startsWith("crm.registration.")) {
      const result = await client.query<{
        customer_name: string | null;
        business_no: string | null;
        due_date: string | null;
        protect_days: string | null;
        partner_name: string | null;
        submitter_name: string | null;
      }>(
        `
        SELECT COALESCE(registration.extra_json->>'customer', customer.customer_name) AS customer_name,
               registration.registration_no AS business_no,
               message.safe_business_date(registration.extra_json->>'expireAt')::text AS due_date,
               registration.extra_json->>'protectDays' AS protect_days,
               COALESCE(NULLIF(partner.partner_name, ''), '未绑定渠道商') AS partner_name,
               COALESCE(NULLIF(submitter.display_name, ''), NULLIF(submitter.username, ''), '未登记提报人') AS submitter_name
        FROM crm.registrations registration
        LEFT JOIN crm.customers customer ON customer.id = registration.customer_id
        LEFT JOIN channel.partners partner ON partner.id = registration.partner_id
        LEFT JOIN iam.users submitter ON submitter.id = registration.owner_user_id
        WHERE registration.id = $1::uuid
        LIMIT 1
        `,
        [事件.aggregateId],
      );
      const 行 = result.rows[0];
      if (!行) return {};
      return {
        customer_name: 行.customer_name || "",
        business_no: 行.business_no || "",
        due_date: 行.due_date || "",
        protect_days: 行.protect_days || "",
        partner_name: 行.partner_name || "未绑定渠道商",
        submitter_name: 行.submitter_name || "未登记提报人",
      };
    }
    if (事件.eventCode.startsWith("crm.order.")) {
      const result = await client.query<{
        customer_name: string | null;
        order_name: string | null;
        business_no: string | null;
        amount: string | null;
        partner_name: string | null;
        submitter_name: string | null;
      }>(
        `
        SELECT COALESCE(order_record.extra_json->>'customer', customer.customer_name) AS customer_name,
               COALESCE(
                 NULLIF(order_record.extra_json->>'projectName', ''),
                 NULLIF(order_record.extra_json->>'project', ''),
                 NULLIF(quote.extra_json->>'projectName', ''),
                 NULLIF(quote.extra_json->>'project', ''),
                 NULLIF(opportunity.extra_json->>'name', ''),
                 NULLIF(opportunity.extra_json->>'opportunityName', ''),
                 NULLIF(opportunity.extra_json->>'projectName', ''),
                 NULLIF(opportunity.extra_json->>'project', ''),
                 '未填写订单名称'
               ) AS order_name,
               order_record.order_no AS business_no,
               order_record.total_amount::text AS amount,
               COALESCE(NULLIF(partner.partner_name, ''), '未绑定渠道商') AS partner_name,
               COALESCE(NULLIF(submitter.display_name, ''), NULLIF(submitter.username, ''), '未登记提报人') AS submitter_name
        FROM crm.orders order_record
        LEFT JOIN crm.customers customer ON customer.id = order_record.customer_id
        LEFT JOIN crm.quotes quote ON quote.id = order_record.quote_id
        LEFT JOIN crm.opportunities opportunity ON opportunity.id = quote.opportunity_id
        LEFT JOIN channel.partners partner ON partner.id = order_record.partner_id
        LEFT JOIN iam.users submitter ON submitter.id = order_record.owner_user_id
        WHERE order_record.id = $1::uuid
        LIMIT 1
        `,
        [事件.aggregateId],
      );
      const 行 = result.rows[0];
      if (!行) return {};
      return {
        customer_name: 行.customer_name || "",
        order_name: 行.order_name || "未填写订单名称",
        business_no: 行.business_no || "",
        amount: 行.amount || "",
        partner_name: 行.partner_name || "未绑定渠道商",
        submitter_name: 行.submitter_name || "未登记提报人",
      };
    }
    if (事件.eventCode.startsWith("crm.quote.")) {
      const result = await client.query<{
        customer_name: string | null;
        business_no: string | null;
        total_amount: string | null;
        partner_name: string | null;
        submitter_name: string | null;
      }>(
        `
        SELECT COALESCE(quote.extra_json->>'customer', customer.customer_name) AS customer_name,
               quote.quote_no AS business_no,
               quote.total_amount::text AS total_amount,
               COALESCE(NULLIF(partner.partner_name, ''), '未绑定渠道商') AS partner_name,
               COALESCE(NULLIF(submitter.display_name, ''), NULLIF(submitter.username, ''), '未登记提报人') AS submitter_name
        FROM crm.quotes quote
        LEFT JOIN crm.customers customer ON customer.id = quote.customer_id
        LEFT JOIN channel.partners partner ON partner.id = quote.partner_id
        LEFT JOIN iam.users submitter ON submitter.id = quote.owner_user_id
        WHERE quote.id = $1::uuid
        LIMIT 1
        `,
        [事件.aggregateId],
      );
      const 行 = result.rows[0];
      if (!行) return {};
      return {
        customer_name: 行.customer_name || "",
        business_no: 行.business_no || "",
        total_amount: 行.total_amount || "",
        partner_name: 行.partner_name || "未绑定渠道商",
        submitter_name: 行.submitter_name || "未登记提报人",
      };
    }
    if (事件.eventCode.startsWith("crm.opportunity.")) {
      const result = await client.query<{
        customer_name: string | null;
        business_no: string | null;
        expected_amount: string | null;
        stage_name: string | null;
        partner_name: string | null;
        submitter_name: string | null;
      }>(
        `
        SELECT COALESCE(opportunity.extra_json->>'customer', customer.customer_name) AS customer_name,
               opportunity.opportunity_no AS business_no,
               opportunity.expected_amount::text AS expected_amount,
               COALESCE(opportunity.raw_stage_name, opportunity.stage_code) AS stage_name,
               COALESCE(NULLIF(partner.partner_name, ''), '未绑定渠道商') AS partner_name,
               COALESCE(NULLIF(submitter.display_name, ''), NULLIF(submitter.username, ''), '未登记提报人') AS submitter_name
        FROM crm.opportunities opportunity
        LEFT JOIN crm.customers customer ON customer.id = opportunity.customer_id
        LEFT JOIN channel.partners partner ON partner.id = opportunity.partner_id
        LEFT JOIN iam.users submitter ON submitter.id = opportunity.owner_user_id
        WHERE opportunity.id = $1::uuid
        LIMIT 1
        `,
        [事件.aggregateId],
      );
      const 行 = result.rows[0];
      if (!行) return {};
      return {
        customer_name: 行.customer_name || "",
        business_no: 行.business_no || "",
        expected_amount: 行.expected_amount || "",
        stage_name: 行.stage_name || "",
        partner_name: 行.partner_name || "未绑定渠道商",
        submitter_name: 行.submitter_name || "未登记提报人",
      };
    }
    if (
      事件.eventCode === "iam.account.approval.pending" ||
      事件.eventCode === "channel.partner.approval.pending"
    ) {
      const result = await client.query<{
        partner_name: string | null;
        submitter_name: string | null;
        target_name: string | null;
      }>(
        `
        SELECT COALESCE(NULLIF(partner.partner_name, ''), '未绑定渠道商') AS partner_name,
               COALESCE(NULLIF(submitter.display_name, ''), NULLIF(submitter.username, ''), '未登记提交人') AS submitter_name,
               COALESCE(NULLIF(target_user.display_name, ''), NULLIF(target_user.username, ''), '') AS target_name
        FROM ops.approvals approval
        LEFT JOIN channel.partners partner ON partner.id = approval.applicant_partner_id
        LEFT JOIN iam.users submitter ON submitter.id = approval.applicant_user_id
        LEFT JOIN iam.users target_user ON target_user.id = approval.target_id
        WHERE approval.id = $1::uuid
        LIMIT 1
        `,
        [事件.aggregateId],
      );
      const 行 = result.rows[0];
      if (!行) return {};
      return {
        partner_name: 行.partner_name || "未绑定渠道商",
        submitter_name: 行.submitter_name || "未登记提交人",
        target_name: 行.target_name || "未登记员工",
      };
    }
    return {};
  }

  private async 写入事件通知(
    client: PoolClient,
    事件: 已领取消息事件,
    订阅: 已发布站内订阅,
    接收人编号: string,
    变量: 模板变量字典,
  ): Promise<string> {
    const 渲染结果 = 渲染模板(订阅.titleTemplate, 订阅.bodyTemplate, 变量);
    const result = await client.query<{ id: string }>(
      `
      INSERT INTO message.notifications (
        recipient_user_id, source_event_id, event_code, category_code, priority_code,
        aggregate_type, aggregate_id, target_action, template_version, title, body, payload_snapshot
      )
      SELECT $1::uuid, $2::uuid, $3::text, $4::text, $5::text, $6::text, $7::uuid,
             $8::text, $9::int, $10::text, $11::text,
             jsonb_build_object('eventCode', $3, 'aggregateType', $6, 'aggregateId', $7)
      WHERE NOT EXISTS (
        SELECT 1 FROM message.deliveries
        WHERE deduplication_key = $12::text
      )
      RETURNING id::text AS id
      `,
      [
        接收人编号,
        事件.sourceEventId,
        事件.eventCode,
        订阅.categoryCode,
        订阅.priorityCode,
        事件.aggregateType,
        事件.aggregateId,
        订阅.targetAction,
        1,
        渲染结果.title,
        渲染结果.body,
        生成投递去重键(事件.sourceEventId, 接收人编号, "in_app"),
      ],
    );
    const 通知编号 = result.rows[0]?.id;
    if (通知编号) return 通知编号;

    const 已有 = await client.query<{ notification_id: string | null }>(
      "SELECT notification_id::text AS notification_id FROM message.deliveries WHERE deduplication_key = $1",
      [生成投递去重键(事件.sourceEventId, 接收人编号, "in_app")],
    );
    if (!已有.rows[0]?.notification_id) {
      throw new Error("站内通知去重状态异常。");
    }
    return 已有.rows[0].notification_id;
  }

  private async 写入事件投递事实(
    client: PoolClient,
    事件: 已领取消息事件,
    订阅: 已发布站内订阅,
    接收人编号: string,
    通知编号: string,
    config: 应用配置,
  ): Promise<void> {
    const 去重键 = 生成投递去重键(事件.sourceEventId, 接收人编号, "in_app");
    await client.query(
      `
      INSERT INTO message.deliveries (
        notification_id, source_event_id, recipient_user_id, channel_code, template_code,
        template_version, semantic_key, deduplication_key, status_code, finished_at
      )
      VALUES ($1::uuid, $2::uuid, $3::uuid, 'in_app', $4, $5, $6, $7, 'success', now())
      ON CONFLICT (deduplication_key) DO NOTHING
      `,
      [
        通知编号,
        事件.sourceEventId,
        接收人编号,
        `${订阅.templateCode}_in_app`,
        1,
        事件.sourceEventId,
        去重键,
      ],
    );
    if (订阅.channelCodes.includes("wecom_app") && config.message.channels.wecomApp.enabled) {
      const 外部去重键 = 生成投递去重键(事件.sourceEventId, 接收人编号, "wecom_app");
      await client.query(
        `
        INSERT INTO message.deliveries (
          notification_id, source_event_id, recipient_user_id, channel_code, template_code,
          template_version, semantic_key, deduplication_key, status_code
        )
        SELECT $1::uuid, $2::uuid, $3::uuid, 'wecom_app', $4::text, $5::int, $6::text, $7::text, 'pending'
        WHERE EXISTS (
          SELECT 1
          FROM iam.external_identities identity
          JOIN iam.users recipient ON recipient.id = identity.user_id
          WHERE identity.user_id = $3::uuid
            AND identity.provider_code = 'wecom'
            AND NULLIF(identity.external_subject::text, '') IS NOT NULL
            AND recipient.status_code = 'active'
        )
        ON CONFLICT (deduplication_key) DO NOTHING
        `,
        [
          通知编号,
          事件.sourceEventId,
          接收人编号,
          `${订阅.templateCode}_wecom_app`,
          1,
          事件.sourceEventId,
          外部去重键,
        ],
      );
    }
    if (订阅.channelCodes.includes("email") && config.message.channels.email.enabled) {
      const 邮箱去重键 = 生成投递去重键(事件.sourceEventId, 接收人编号, "email");
      await client.query(
        `
        INSERT INTO message.deliveries (
          notification_id, source_event_id, recipient_user_id, channel_code, template_code,
          template_version, semantic_key, deduplication_key, status_code
        )
        SELECT $1::uuid, $2::uuid, $3::uuid, 'email', $4::text, $5::int, $6::text, $7::text, 'pending'
        WHERE EXISTS (
          SELECT 1
          FROM message.user_preferences preference
          JOIN iam.users recipient ON recipient.id = preference.user_id
          WHERE preference.user_id = $3::uuid
            AND preference.email_enabled
            AND recipient.status_code = 'active'
            AND NULLIF(recipient.email::text, '') IS NOT NULL
        )
        ON CONFLICT (deduplication_key) DO NOTHING
        `,
        [
          通知编号,
          事件.sourceEventId,
          接收人编号,
          `${订阅.templateCode}_email`,
          1,
          事件.sourceEventId,
          邮箱去重键,
        ],
      );
    }
  }

  private async 标记消费成功(client: PoolClient, 消费编号: string): Promise<void> {
    await client.query(
      `
      UPDATE message.event_consumptions
      SET status_code = 'succeeded', locked_until = NULL, next_retry_at = NULL,
          updated_at = now(), finished_at = now(), last_error_summary = NULL
      WHERE id = $1::uuid AND status_code = 'processing'
      `,
      [消费编号],
    );
  }

  private async 标记消费受控跳过(消费编号: string, 原因: string): Promise<void> {
    await this.数据库连接池.query(
      `
      UPDATE message.event_consumptions
      SET status_code = 'succeeded', locked_until = NULL, next_retry_at = NULL,
          updated_at = now(), finished_at = now(), last_error_summary = $2
      WHERE id = $1::uuid AND status_code = 'processing'
      `,
      [消费编号, 原因],
    );
  }

  private async 标记消费失败(消费编号: string, 错误: unknown): Promise<void> {
    const 不可重试 = 错误 instanceof 不可重试消息错误;
    const 原因 = 脱敏错误摘要(错误);
    await this.数据库连接池.query(
      `
      UPDATE message.event_consumptions
      SET status_code = CASE WHEN $2 THEN 'dead' ELSE 'retry_wait' END,
          locked_until = NULL,
          next_retry_at = CASE WHEN $2 THEN NULL ELSE now() + interval '30 seconds' END,
          updated_at = now(),
          finished_at = CASE WHEN $2 THEN now() ELSE NULL END,
          last_error_summary = $3
      WHERE id = $1::uuid
      `,
      [消费编号, 不可重试, 原因],
    );
  }

  private async 记录关键消息任务成功(): Promise<void> {
    await this.数据库连接池.query(
      `
      UPDATE message.worker_failure_streaks
      SET consecutive_failure_count = 0,
          threshold_event_emitted = false,
          threshold_event_id = NULL,
          last_error_summary = NULL,
          updated_at = now()
      WHERE worker_code = $1
        AND (
          consecutive_failure_count <> 0
          OR threshold_event_emitted
          OR threshold_event_id IS NOT NULL
          OR last_error_summary IS NOT NULL
        )
      `,
      [关键消息任务失败监控代码],
    );
  }

  private async 记录关键消息任务失败(错误: unknown): Promise<void> {
    const client = await this.数据库连接池.connect();
    try {
      await client.query("BEGIN");
      const 失败状态 = await client.query<{
        consecutive_failure_count: number;
        threshold_event_emitted: boolean;
      }>(
        `
        INSERT INTO message.worker_failure_streaks (
          worker_code, consecutive_failure_count, threshold_event_emitted,
          last_error_summary, last_failure_at
        )
        VALUES ($1, 1, false, $2, now())
        ON CONFLICT (worker_code) DO UPDATE
        SET consecutive_failure_count = message.worker_failure_streaks.consecutive_failure_count + 1,
            last_error_summary = EXCLUDED.last_error_summary,
            last_failure_at = now(),
            updated_at = now()
        RETURNING consecutive_failure_count, threshold_event_emitted
        `,
        [关键消息任务失败监控代码, 脱敏错误摘要(错误)],
      );
      const 当前状态 = 失败状态.rows[0];
      if (!当前状态) throw new Error("消息任务失败状态写入失败。");

      if (
        应生成连续失败事件(
          当前状态.consecutive_failure_count,
          this.任务失败阈值,
          当前状态.threshold_event_emitted,
        )
      ) {
        const 事件 = await client.query<{ id: string }>(
          `
          INSERT INTO ops.outbox_events (
            event_type, aggregate_type, aggregate_id, payload_json, status_code, created_at
          )
          VALUES (
            'task.failed.excessive', 'message_worker', $1::uuid,
            jsonb_build_object(
              'workerCode', $2,
              'failureCount', $3,
              'threshold', $4
            ),
            'pending', now()
          )
          RETURNING id::text AS id
          `,
          [
            关键消息任务失败聚合编号,
            关键消息任务失败监控代码,
            当前状态.consecutive_failure_count,
            this.任务失败阈值,
          ],
        );
        const 事件编号 = 事件.rows[0]?.id;
        if (!事件编号) throw new Error("消息任务连续失败事件写入失败。");
        await client.query(
          `
          UPDATE message.worker_failure_streaks
          SET threshold_event_emitted = true,
              threshold_event_id = $2::uuid,
              updated_at = now()
          WHERE worker_code = $1
            AND threshold_event_emitted = false
          `,
          [关键消息任务失败监控代码, 事件编号],
        );
      }
      await client.query("COMMIT");
    } catch (记录失败) {
      await client.query("ROLLBACK");
      throw 记录失败;
    } finally {
      client.release();
    }
  }
}

class 不可重试消息错误 extends Error {}
class 已停用消息规则错误 extends Error {}

function _默认目标动作(eventCode: M1事件代码类型): 已发布站内订阅["targetAction"] {
  return eventCode === "crm.order.approval.pending" ||
    eventCode === "crm.registration.approval.pending" ||
    eventCode === "iam.account.approval.pending" ||
    eventCode === "channel.partner.approval.pending"
    ? "approve"
    : "view";
}

function 生成投递去重键(sourceEventId: string, recipientUserId: string, channel: string): string {
  return crypto
    .createHash("sha256")
    .update(`${sourceEventId}:${recipientUserId}:${channel}`)
    .digest("hex");
}

function 脱敏错误摘要(错误: unknown): string {
  const 原始消息 =
    typeof 错误 === "string"
      ? 错误
      : 错误 instanceof Error
        ? 错误.message
        : "消息处理失败，原因未知。";
  return 原始消息.replace(/https?:\/\/[^\s]+/g, "[地址已隐藏]").slice(0, 240);
}

function 分组合并提醒计划(计划集合: 已领取提醒计划[]): 已领取提醒计划[][] {
  const 分组 = new Map<string, 已领取提醒计划[]>();
  for (const 计划 of 计划集合) {
    const 分组键 =
      计划.digestWindowMinutes === 0
        ? 计划.semanticKey
        : [计划.recipientUserId, 计划.reminderCode, 计划.dispatchAfter].join(":");
    const 当前 = 分组.get(分组键) ?? [];
    当前.push(计划);
    分组.set(分组键, 当前);
  }
  return [...分组.values()];
}

function 构建到期提醒标题(reminderCode: 已领取提醒计划["reminderCode"], 数量: number): string {
  const 名称 =
    reminderCode === "crm.registration.expiring"
      ? "客户报备保护期即将到期"
      : "商机预计成交日即将到期";
  return 数量 > 1 ? `${名称}（共 ${数量} 项）` : 名称;
}

function 构建到期提醒正文(
  reminderCode: 已领取提醒计划["reminderCode"],
  是合并提醒: boolean,
): string {
  if (reminderCode === "crm.registration.expiring") {
    return 是合并提醒
      ? "请在平台查看即将到期的客户报备，并安排后续处理。"
      : "请在平台查看客户报备，并安排后续处理。";
  }
  return 是合并提醒
    ? "请在平台查看即将到期的商机，并及时更新进展。"
    : "请在平台查看商机，并及时更新进展。";
}

async function 写入提醒通知(
  client: PoolClient,
  参数: {
    recipientUserId: string;
    reminderCode: 已领取提醒计划["reminderCode"];
    aggregateType: string;
    aggregateId: string | null;
    title: string;
    body: string;
    deduplicationKey: string;
  },
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `
    INSERT INTO message.notifications (
      recipient_user_id, event_code, category_code, priority_code, aggregate_type, aggregate_id,
      target_action, template_version, title, body, payload_snapshot
    )
    SELECT $1::uuid, $2::text, 'business', 'strong', $3::text, $4::uuid, 'view', 1, $5::text, $6::text,
           jsonb_build_object('eventCode', $2, 'aggregateType', $3, 'aggregateId', $4)
    WHERE NOT EXISTS (
      SELECT 1 FROM message.deliveries WHERE deduplication_key = $7
    )
    RETURNING id::text AS id
    `,
    [
      参数.recipientUserId,
      参数.reminderCode,
      参数.aggregateType,
      参数.aggregateId,
      参数.title,
      参数.body,
      参数.deduplicationKey,
    ],
  );
  if (result.rows[0]?.id) return result.rows[0].id;
  const 已有 = await client.query<{ notification_id: string | null }>(
    "SELECT notification_id::text AS notification_id FROM message.deliveries WHERE deduplication_key = $1",
    [参数.deduplicationKey],
  );
  if (!已有.rows[0]?.notification_id) throw new Error("到期提醒通知去重状态异常。");
  return 已有.rows[0].notification_id;
}

async function 查询订单负责人(client: PoolClient, 订单编号: string): Promise<string[]> {
  const result = await client.query<{ user_id: string }>(
    `
    SELECT owner_user_id::text AS user_id
    FROM crm.orders
    WHERE id = $1::uuid AND owner_user_id IS NOT NULL
    `,
    [订单编号],
  );
  return result.rows.map((行) => 行.user_id);
}

/**
 * 审批接收人只根据订单当前待审批步骤和正式组织、渠道关系解析；解析不到时由调用方写失败事实，
 * 不向业务负责人或任意管理员扩大投递范围。
 */
async function 查询订单当前审批人(client: PoolClient, 订单编号: string): Promise<string[]> {
  const result = await client.query<{ user_id: string }>(
    `
    WITH 当前审批 AS (
      SELECT approval.extra_json->>'step' AS step, approval.applicant_partner_id
      FROM ops.approvals approval
      WHERE approval.target_type = 'order'
        AND approval.target_id = $1::uuid
        AND approval.status_code = 'pending'
      ORDER BY approval.updated_at DESC
      LIMIT 1
    )
    SELECT DISTINCT user_account.id::text AS user_id
    FROM 当前审批 approval
    JOIN crm.orders order_record ON order_record.id = $1::uuid
    JOIN iam.users user_account ON user_account.status_code = 'active'
    LEFT JOIN channel.partner_relations relation
      ON relation.child_partner_id = order_record.partner_id
     AND relation.relation_code = 'primary_secondary'
     AND relation.ended_at IS NULL
    LEFT JOIN channel.partner_members partner_member
      ON partner_member.partner_id = relation.parent_partner_id
     AND partner_member.user_id = user_account.id
     AND partner_member.member_role_code = 'partner_admin'
     AND partner_member.status_code = 'active'
     AND partner_member.ended_at IS NULL
    LEFT JOIN iam.user_roles user_role ON user_role.user_id = user_account.id
    LEFT JOIN iam.roles role ON role.id = user_role.role_id AND role.status_code = 'active'
    LEFT JOIN channel.partners partner ON partner.id = order_record.partner_id
    WHERE (approval.step = 'primary_confirm' AND partner_member.user_id IS NOT NULL)
       OR (approval.step = 'region_confirm'
           AND role.role_code IN ('admin', 'region_manager')
           AND user_account.region_id = partner.region_id)
       OR (approval.step = 'superadmin_confirm' AND role.role_code = 'superadmin')
    `,
    [订单编号],
  );
  return result.rows.map((行) => 行.user_id);
}

async function 查询报备申请人与负责人(client: PoolClient, 报备编号: string): Promise<string[]> {
  const result = await client.query<{ user_id: string }>(
    `
    SELECT DISTINCT user_id::text AS user_id
    FROM (
      SELECT registration.owner_user_id AS user_id
      FROM crm.registrations registration
      WHERE registration.id = $1::uuid
      UNION
      SELECT approval.applicant_user_id AS user_id
      FROM ops.approvals approval
      WHERE approval.target_type = 'registration' AND approval.target_id = $1::uuid
    ) recipient
    JOIN iam.users user_account ON user_account.id = recipient.user_id
    WHERE recipient.user_id IS NOT NULL AND user_account.status_code = 'active'
    `,
    [报备编号],
  );
  return result.rows.map((行) => 行.user_id);
}

export async function 查询报备待审批接收人(
  client: PoolClient,
  报备编号: string,
  scope: 已发布站内订阅["recipientScope"],
): Promise<string[]> {
  const 报备 = await client.query<{ region_id: string | null }>(
    `
    SELECT region_id::text AS region_id
    FROM crm.registrations
    WHERE id = $1::uuid
    LIMIT 1
    `,
    [报备编号],
  );
  const 区域编号 = 报备.rows[0]?.region_id ?? null;
  if (scope.type === "users" && Array.isArray(scope.userIds) && scope.userIds.length > 0) {
    const 用户结果 = await client.query<{ user_id: string }>(
      `
      SELECT user_account.id::text AS user_id
      FROM iam.users user_account
      WHERE user_account.id = ANY($1::uuid[])
        AND user_account.status_code = 'active'
      `,
      [scope.userIds],
    );
    return 用户结果.rows.map((行) => 行.user_id);
  }
  if (scope.type === "org" && Array.isArray(scope.codes) && scope.codes.length > 0) {
    const 组织结果 = await client.query<{ user_id: string }>(
      `
      SELECT user_account.id::text AS user_id
      FROM iam.users user_account
      JOIN iam.user_roles user_role ON user_role.user_id = user_account.id
      JOIN iam.roles role ON role.id = user_role.role_id AND role.status_code = 'active'
      WHERE user_account.status_code = 'active'
        AND user_account.region_id = ANY($1::uuid[])
        AND role.role_code IN ('region_manager', 'admin', 'superadmin')
      `,
      [scope.codes],
    );
    return 组织结果.rows.map((行) => 行.user_id);
  }
  const 角色集合 =
    Array.isArray(scope.codes) && scope.codes.length > 0
      ? scope.codes
      : ["region_manager", "superadmin"];
  const 角色结果 = await client.query<{ user_id: string }>(
    `
    SELECT DISTINCT user_account.id::text AS user_id
    FROM iam.users user_account
    JOIN iam.user_roles user_role ON user_role.user_id = user_account.id
    JOIN iam.roles role ON role.id = user_role.role_id AND role.status_code = 'active'
    WHERE user_account.status_code = 'active'
      AND role.role_code = ANY($1::text[])
      AND (
        role.role_code = 'superadmin'
        OR (user_account.region_id IS NOT NULL AND user_account.region_id = $2::uuid)
      )
    `,
    [角色集合, 区域编号 || "00000000-0000-0000-0000-000000000000"],
  );
  const 指定用户 = Array.isArray(scope.userIds) ? scope.userIds.filter(是UUID) : [];
  if (!指定用户.length) return 角色结果.rows.map((行) => 行.user_id);
  const 指定用户结果 = await client.query<{ user_id: string }>(
    `
    SELECT user_account.id::text AS user_id
    FROM iam.users user_account
    WHERE user_account.id = ANY($1::uuid[])
      AND user_account.status_code = 'active'
    `,
    [指定用户],
  );
  return [...new Set([...角色结果.rows, ...指定用户结果.rows].map((行) => 行.user_id))];
}

function 是UUID(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

async function 查询平台管理员(client: PoolClient): Promise<string[]> {
  const result = await client.query<{ user_id: string }>(
    `
    SELECT DISTINCT user_role.user_id::text AS user_id
    FROM iam.user_roles user_role
    JOIN iam.roles role ON role.id = user_role.role_id
    JOIN iam.users user_account ON user_account.id = user_role.user_id
    WHERE role.role_code IN ('superadmin', 'admin', 'region_manager')
      AND role.status_code = 'active'
      AND user_account.status_code = 'active'
    `,
  );
  return result.rows.map((行) => 行.user_id);
}

function 加天数(日期: string, 天数: number): string {
  const 值 = new Date(`${日期}T00:00:00Z`);
  值.setUTCDate(值.getUTCDate() + 天数);
  return 值.toISOString().slice(0, 10);
}

function 校验事件通道集合(
  value: unknown,
): Array<"in_app" | "wecom" | "wecom_app" | "sms" | "email"> {
  const 允许 = new Set<"in_app" | "wecom" | "wecom_app" | "sms" | "email">([
    "in_app",
    "wecom",
    "wecom_app",
    "sms",
    "email",
  ]);
  const 集合 = Array.isArray(value)
    ? value.filter((通道): 通道 is "in_app" | "wecom" | "wecom_app" | "sms" | "email" =>
        允许.has(通道 as "in_app" | "wecom" | "wecom_app" | "sms" | "email"),
      )
    : [];
  if (!集合.includes("in_app")) {
    throw new 不可重试消息错误("消息订阅必须保留站内渠道。");
  }
  return [...new Set(集合)];
}

function 读取目标动作(value: Record<string, unknown>): "view" | "process" | "approve" {
  const 动作 = value.targetAction;
  if (动作 === "process" || 动作 === "approve") return 动作;
  return "view";
}

async function 查询业务负责人(
  client: PoolClient,
  表名: "crm.quotes" | "crm.opportunities" | "crm.registrations",
  业务编号: string,
): Promise<string[]> {
  const 映射: Record<string, string> = {
    "crm.quotes": "FROM crm.quotes business_record WHERE business_record.id = $1::uuid",
    "crm.opportunities":
      "FROM crm.opportunities business_record WHERE business_record.id = $1::uuid",
    "crm.registrations":
      "FROM crm.registrations business_record WHERE business_record.id = $1::uuid",
  };
  const 片段 = 映射[表名];
  if (!片段) return [];
  const result = await client.query<{ user_id: string }>(
    `
    SELECT DISTINCT business_record.owner_user_id::text AS user_id
    ${片段}
      AND business_record.owner_user_id IS NOT NULL
    `,
    [业务编号],
  );
  return result.rows.map((行) => 行.user_id);
}

async function 解析范围接收人(
  client: PoolClient,
  类型: string,
  范围: Record<string, unknown>,
): Promise<string[]> {
  if (类型 === "users") {
    const 用户 = Array.isArray(范围.userIds) ? (范围.userIds as string[]) : [];
    if (!用户.length) return [];
    const 结果 = await client.query<{ user_id: string }>(
      `
      SELECT user_account.id::text AS user_id
      FROM iam.users user_account
      WHERE user_account.id = ANY($1::uuid[]) AND user_account.status_code = 'active'
      `,
      [用户],
    );
    return 结果.rows.map((行) => 行.user_id);
  }
  if (类型 === "org") {
    const 组织 = Array.isArray(范围.codes) ? (范围.codes as string[]) : [];
    if (!组织.length) return [];
    const 结果 = await client.query<{ user_id: string }>(
      `
      SELECT user_account.id::text AS user_id
      FROM iam.users user_account
      WHERE user_account.org_unit_id = ANY($1::uuid[]) AND user_account.status_code = 'active'
      `,
      [组织],
    );
    return 结果.rows.map((行) => 行.user_id);
  }
  if (类型 === "region") {
    const 区域 = Array.isArray(范围.codes) ? (范围.codes as string[]) : [];
    if (!区域.length) return [];
    const 结果 = await client.query<{ user_id: string }>(
      `
      SELECT user_account.id::text AS user_id
      FROM iam.users user_account
      WHERE user_account.region_id = ANY($1::uuid[]) AND user_account.status_code = 'active'
      `,
      [区域],
    );
    return 结果.rows.map((行) => 行.user_id);
  }
  if (类型 === "partners") {
    const 渠道商 = Array.isArray(范围.partnerIds) ? (范围.partnerIds as string[]) : [];
    if (!渠道商.length) return [];
    const 结果 = await client.query<{ user_id: string }>(
      `
      SELECT DISTINCT member.user_id::text AS user_id
      FROM channel.partner_members member
      JOIN iam.users user_account ON user_account.id = member.user_id
      WHERE member.partner_id = ANY($1::uuid[])
        AND member.status_code = 'active'
        AND member.ended_at IS NULL
        AND user_account.status_code = 'active'
      `,
      [渠道商],
    );
    return 结果.rows.map((行) => 行.user_id);
  }
  if (类型 === "roles") {
    const 角色 = Array.isArray(范围.codes) ? (范围.codes as string[]) : ["superadmin"];
    const 结果 = await client.query<{ user_id: string }>(
      `
      SELECT DISTINCT user_account.id::text AS user_id
      FROM iam.users user_account
      JOIN iam.user_roles user_role ON user_role.user_id = user_account.id
      JOIN iam.roles role ON role.id = user_role.role_id AND role.status_code = 'active'
      WHERE user_account.status_code = 'active'
        AND role.role_code = ANY($1::text[])
      `,
      [角色],
    );
    return 结果.rows.map((行) => 行.user_id);
  }
  return [];
}

interface 到期聚合上下文 {
  aggregateId: string;
  ownerUserId: string | null;
  regionId: string | null;
  partnerId: string | null;
  dueOn: string | null;
}

/**
 * 到期数据源白名单映射。只允许在受控 SQL 清单中选择数据源，禁止任意表名或表达式。
 * 新数据源必须先在此登记 SQL 并评审，再开放到提醒任务模板目录。
 */
async function 扫描到期聚合(
  client: 数据库查询执行器,
  数据源代码: string,
): Promise<到期聚合上下文[]> {
  const 映射: Record<string, () => Promise<到期聚合上下文[]>> = {
    registration_expiring: async () =>
      (
        await client.query<{
          aggregate_id: string;
          owner_user_id: string | null;
          region_id: string | null;
          partner_id: string | null;
          due_on: string | null;
        }>(
          `
          SELECT registration.id AS aggregate_id, registration.owner_user_id,
                 registration.region_id, registration.partner_id,
                 message.safe_business_date(registration.extra_json->>'expireAt') AS due_on
            FROM crm.registrations registration
           WHERE registration.status_code = 'approved'
          `,
        )
      ).rows.map((行) => ({
        aggregateId: 行.aggregate_id,
        ownerUserId: 行.owner_user_id,
        regionId: 行.region_id,
        partnerId: 行.partner_id,
        dueOn: 行.due_on,
      })),
    opportunity_expected_close: async () =>
      (
        await client.query<{
          aggregate_id: string;
          owner_user_id: string | null;
          region_id: string | null;
          partner_id: string | null;
          due_on: string | null;
        }>(
          `
          SELECT opportunity.id AS aggregate_id, opportunity.owner_user_id,
                 opportunity.region_id, opportunity.partner_id,
                 message.safe_business_date(opportunity.extra_json->>'expectedClose') AS due_on
            FROM crm.opportunities opportunity
           WHERE opportunity.status_code = 'active'
          `,
        )
      ).rows.map((行) => ({
        aggregateId: 行.aggregate_id,
        ownerUserId: 行.owner_user_id,
        regionId: 行.region_id,
        partnerId: 行.partner_id,
        dueOn: 行.due_on,
      })),
    opportunity_next_action: async () =>
      (
        await client.query<{
          aggregate_id: string;
          owner_user_id: string | null;
          region_id: string | null;
          partner_id: string | null;
          due_on: string | null;
        }>(
          `
          SELECT opportunity.id AS aggregate_id, opportunity.owner_user_id,
                 opportunity.region_id, opportunity.partner_id,
                 message.safe_business_date(opportunity.extra_json->>'nextFollowUp') AS due_on
            FROM crm.opportunities opportunity
           WHERE opportunity.status_code = 'active'
          `,
        )
      ).rows.map((行) => ({
        aggregateId: 行.aggregate_id,
        ownerUserId: 行.owner_user_id,
        regionId: 行.region_id,
        partnerId: 行.partner_id,
        dueOn: 行.due_on,
      })),
    quote_valid_until: async () =>
      (
        await client.query<{
          aggregate_id: string;
          owner_user_id: string | null;
          region_id: string | null;
          partner_id: string | null;
          due_on: string | null;
        }>(
          `
          SELECT quote.id AS aggregate_id, quote.owner_user_id, partner.region_id,
                 quote.partner_id,
                 message.safe_business_date(quote.extra_json->>'validUntil') AS due_on
            FROM crm.quotes quote
            LEFT JOIN channel.partners partner ON partner.id = quote.partner_id
           WHERE quote.status_code IN ('submitted', 'approved')
          `,
        )
      ).rows.map((行) => ({
        aggregateId: 行.aggregate_id,
        ownerUserId: 行.owner_user_id,
        regionId: 行.region_id,
        partnerId: 行.partner_id,
        dueOn: 行.due_on,
      })),
    order_delivery_date: async () =>
      (
        await client.query<{
          aggregate_id: string;
          owner_user_id: string | null;
          region_id: string | null;
          partner_id: string | null;
          due_on: string | null;
        }>(
          `
          SELECT order_record.id AS aggregate_id, order_record.owner_user_id,
                 partner.region_id, order_record.partner_id,
                 message.safe_business_date(order_record.extra_json->>'deliveryDate') AS due_on
            FROM crm.orders order_record
            LEFT JOIN channel.partners partner ON partner.id = order_record.partner_id
           WHERE order_record.status_code IN ('confirmed', 'completed')
          `,
        )
      ).rows.map((行) => ({
        aggregateId: 行.aggregate_id,
        ownerUserId: 行.owner_user_id,
        regionId: 行.region_id,
        partnerId: 行.partner_id,
        dueOn: 行.due_on,
      })),
  };
  const 执行 = 映射[数据源代码];
  if (!执行) {
    throw new 不可重试消息错误(`到期数据源不在受控扫描清单中：${数据源代码}`);
  }
  return 执行();
}

/**
 * 到期任务的接收人解析：支持业务动态负责人、角色、指定用户、组织、区域与渠道商。
 * 解析结果必须经过启用账号过滤，越权或失效账号一律不投递。
 */
async function 解析到期任务接收人(
  client: 数据库查询执行器,
  聚合: 到期聚合上下文,
  规则: { type?: string; scope?: Record<string, unknown> },
): Promise<string[]> {
  const 类型 = 规则.type || "";
  const 范围 = (规则.scope && typeof 规则.scope === "object" ? 规则.scope : {}) as Record<
    string,
    unknown
  >;
  if (类型 === "business_owner") {
    if (!聚合.ownerUserId) return [];
    const 结果 = await client.query<{ user_id: string }>(
      `
      SELECT user_account.id::text AS user_id
      FROM iam.users user_account
      WHERE user_account.id = $1::uuid AND user_account.status_code = 'active'
      `,
      [聚合.ownerUserId],
    );
    return 结果.rows.map((行) => 行.user_id);
  }
  if (类型 === "users") {
    const 用户 = Array.isArray(范围.userIds) ? (范围.userIds as string[]) : [];
    if (!用户.length) return [];
    const 结果 = await client.query<{ user_id: string }>(
      `
      SELECT user_account.id::text AS user_id
      FROM iam.users user_account
      WHERE user_account.id = ANY($1::uuid[]) AND user_account.status_code = 'active'
      `,
      [用户],
    );
    return 结果.rows.map((行) => 行.user_id);
  }
  if (类型 === "org") {
    const 组织 = Array.isArray(范围.codes) ? (范围.codes as string[]) : [];
    if (!组织.length) return [];
    const 结果 = await client.query<{ user_id: string }>(
      `
      SELECT user_account.id::text AS user_id
      FROM iam.users user_account
      WHERE user_account.org_unit_id = ANY($1::uuid[]) AND user_account.status_code = 'active'
      `,
      [组织],
    );
    return 结果.rows.map((行) => 行.user_id);
  }
  if (类型 === "region") {
    const 区域 = Array.isArray(范围.codes) ? (范围.codes as string[]) : [];
    if (!区域.length) return [];
    const 结果 = await client.query<{ user_id: string }>(
      `
      SELECT user_account.id::text AS user_id
      FROM iam.users user_account
      WHERE user_account.region_id = ANY($1::uuid[]) AND user_account.status_code = 'active'
      `,
      [区域],
    );
    return 结果.rows.map((行) => 行.user_id);
  }
  if (类型 === "partners") {
    const 渠道商 = Array.isArray(范围.partnerIds) ? (范围.partnerIds as string[]) : [];
    if (!渠道商.length) return [];
    const 结果 = await client.query<{ user_id: string }>(
      `
      SELECT DISTINCT member.user_id::text AS user_id
      FROM channel.partner_members member
      JOIN iam.users user_account ON user_account.id = member.user_id
      WHERE member.partner_id = ANY($1::uuid[])
        AND member.status_code = 'active'
        AND member.ended_at IS NULL
        AND user_account.status_code = 'active'
      `,
      [渠道商],
    );
    return 结果.rows.map((行) => 行.user_id);
  }
  if (类型 === "roles") {
    const 角色 = Array.isArray(范围.codes) ? (范围.codes as string[]) : ["superadmin"];
    const 区域编号 = 聚合.regionId ?? null;
    const 结果 = await client.query<{ user_id: string }>(
      `
      SELECT DISTINCT user_account.id::text AS user_id
      FROM iam.users user_account
      JOIN iam.user_roles user_role ON user_role.user_id = user_account.id
      JOIN iam.roles role ON role.id = user_role.role_id AND role.status_code = 'active'
      WHERE user_account.status_code = 'active'
        AND role.role_code = ANY($1::text[])
        AND (
          role.role_code = 'superadmin'
          OR (
            $2::uuid IS NOT NULL
            AND user_account.region_id = $2::uuid
          )
        )
      `,
      [角色, 区域编号 || "00000000-0000-0000-0000-000000000000"],
    );
    return 结果.rows.map((行) => 行.user_id);
  }
  return [];
}
