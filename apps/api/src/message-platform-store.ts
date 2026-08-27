import crypto from "node:crypto";

import { 加密消息通道配置, 解密消息通道配置 } from "@lianruan/config";
import { 应用错误 } from "@lianruan/shared";
import { Pool } from "pg";

export type 平台通道代码 = "wecom" | "wecom_app" | "sms" | "email";

export interface 平台当前用户 {
  username: string;
  requestId: string;
}

export interface 通道公开配置 {
  channelCode: 平台通道代码;
  configured: boolean;
  enabled: boolean;
  configVersion?: number;
  configuredAt?: string;
  configuredBy?: string;
  lastTestStatus?: string;
  lastTestedAt?: string;
  detail: Record<string, string | number | boolean>;
}

export interface 消息平台数据服务 {
  查询通道(用户: 平台当前用户): Promise<通道公开配置[]>;
  保存通道(
    用户: 平台当前用户,
    通道: 平台通道代码,
    输入: Record<string, unknown>,
  ): Promise<通道公开配置>;
  切换通道(用户: 平台当前用户, 通道: 平台通道代码, 启用: boolean): Promise<通道公开配置>;
  创建测试投递(
    用户: 平台当前用户,
    通道: 平台通道代码,
    输入: Record<string, unknown>,
  ): Promise<{ deliveryId: string }>;
  查询测试投递(
    用户: 平台当前用户,
    deliveryId: string,
  ): Promise<{ statusCode: string; summary: string | null }>;
  查询投递(
    用户: 平台当前用户,
    通道: 平台通道代码 | undefined,
    limit: number,
  ): Promise<消息投递摘要[]>;
}

export interface 消息投递摘要 {
  id: string;
  channelCode: 平台通道代码;
  statusCode: string;
  attemptCount: number;
  isTest: boolean;
  createdAt: string;
  finishedAt: string | null;
  summary: string | null;
}

export function 创建消息平台数据服务(参数: {
  databaseUrl?: string;
  encryptionKey?: Buffer;
  pool?: Pool;
}): 消息平台数据服务 {
  if (!参数.databaseUrl && !参数.pool) return new 未配置消息平台数据服务();
  if (!参数.encryptionKey) return new 未配置加密密钥消息平台数据服务();
  return new PostgreSQL消息平台数据服务(
    参数.pool || new Pool({ connectionString: 参数.databaseUrl }),
    参数.encryptionKey,
  );
}

class 未配置消息平台数据服务 implements 消息平台数据服务 {
  protected 不可用(): never {
    throw new 应用错误("V3_MESSAGE_PLATFORM_DATABASE_UNAVAILABLE", "消息平台数据库尚未配置。", 503);
  }
  查询通道(): Promise<通道公开配置[]> {
    return Promise.reject(this.不可用());
  }
  保存通道(): Promise<通道公开配置> {
    return Promise.reject(this.不可用());
  }
  切换通道(): Promise<通道公开配置> {
    return Promise.reject(this.不可用());
  }
  创建测试投递(): Promise<{ deliveryId: string }> {
    return Promise.reject(this.不可用());
  }
  查询测试投递(): Promise<{ statusCode: string; summary: string | null }> {
    return Promise.reject(this.不可用());
  }
  查询投递(): Promise<消息投递摘要[]> {
    return Promise.reject(this.不可用());
  }
}

class 未配置加密密钥消息平台数据服务 extends 未配置消息平台数据服务 {
  protected override 不可用(): never {
    throw new 应用错误(
      "V3_MESSAGE_PLATFORM_ENCRYPTION_KEY_REQUIRED",
      "消息通道配置加密密钥尚未配置，当前不能保存或测试外部通道。",
      503,
    );
  }
}

class PostgreSQL消息平台数据服务 implements 消息平台数据服务 {
  public constructor(
    private readonly pool: Pool,
    private readonly encryptionKey: Buffer,
  ) {}

  public async 查询通道(用户: 平台当前用户): Promise<通道公开配置[]> {
    const 操作人 = await this.读取超级管理员(用户);
    const result = await this.pool.query<通道行>(
      `SELECT channel_code, enabled, config_version, cipher_text, nonce, auth_tag, configured_at,
              last_test_status, last_tested_at, actor.username AS configured_by
         FROM message.channel_accounts account
         JOIN iam.users actor ON actor.id = account.configured_by_user_id
        ORDER BY channel_code`,
    );
    const 映射 = new Map(result.rows.map((row) => [row.channel_code, this.转换公开配置(row)]));
    await this.写入审计(操作人, 用户, "read_channel_config", "全部通道", {
      count: result.rows.length,
    });
    return (["wecom", "wecom_app", "sms", "email"] as const).map(
      (通道) => 映射.get(通道) || 默认公开配置(通道),
    );
  }

  public async 保存通道(
    用户: 平台当前用户,
    通道: 平台通道代码,
    输入: Record<string, unknown>,
  ): Promise<通道公开配置> {
    const 操作人 = await this.读取超级管理员(用户);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const 当前 = await client.query<通道行>(
        `SELECT channel_code, enabled, config_version, cipher_text, nonce, auth_tag, configured_at,
                last_test_status, last_tested_at, actor.username AS configured_by
           FROM message.channel_accounts account
           JOIN iam.users actor ON actor.id = account.configured_by_user_id
          WHERE channel_code = $1 FOR UPDATE`,
        [通道],
      );
      const 旧配置 = 当前.rows[0] ? 解密通道配置(当前.rows[0], this.encryptionKey) : {};
      const 新配置 = 校验并合并通道配置(通道, 旧配置, 输入);
      const 密文 = 加密消息通道配置(新配置, this.encryptionKey);
      const 摘要 = crypto.createHash("sha256").update(JSON.stringify(新配置)).digest("hex");
      const result = await client.query<通道行>(
        `INSERT INTO message.channel_accounts (
           channel_code, enabled, config_version, cipher_text, nonce, auth_tag, config_digest,
           configured_by_user_id, configured_at, updated_at
         ) VALUES ($1, false, 1, $2, $3, $4, $5, $6::uuid, now(), now())
         ON CONFLICT (channel_code) DO UPDATE
           SET config_version = message.channel_accounts.config_version + 1,
               cipher_text = EXCLUDED.cipher_text, nonce = EXCLUDED.nonce, auth_tag = EXCLUDED.auth_tag,
               config_digest = EXCLUDED.config_digest, configured_by_user_id = EXCLUDED.configured_by_user_id,
               configured_at = now(), updated_at = now()
         RETURNING channel_code, enabled, config_version, cipher_text, nonce, auth_tag, configured_at,
                   last_test_status, last_tested_at, $7::text AS configured_by`,
        [通道, 密文.cipherText, 密文.nonce, 密文.authTag, 摘要, 操作人.id, 操作人.username],
      );
      await this.写入审计(
        操作人,
        用户,
        "save_channel_config",
        通道,
        {
          channelCode: 通道,
          configuredFields: Object.keys(新配置).sort(),
          enabled: result.rows[0]?.enabled || false,
          configVersion: result.rows[0]?.config_version || 1,
        },
        client,
      );
      await client.query("COMMIT");
      return this.转换公开配置(result.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async 切换通道(
    用户: 平台当前用户,
    通道: 平台通道代码,
    启用: boolean,
  ): Promise<通道公开配置> {
    const 操作人 = await this.读取超级管理员(用户);
    if (启用) {
      const 测试结果 = await this.pool.query<{ last_test_status: string | null }>(
        "SELECT last_test_status FROM message.channel_accounts WHERE channel_code = $1",
        [通道],
      );
      if (测试结果.rows[0]?.last_test_status !== "success") {
        throw new 应用错误(
          "V3_MESSAGE_CHANNEL_TEST_REQUIRED",
          "通道须先完成一次成功的测试发送后才能启用。",
          409,
        );
      }
    }
    const result = await this.pool.query<通道行>(
      `UPDATE message.channel_accounts
          SET enabled = $2, updated_at = now()
        WHERE channel_code = $1
        RETURNING channel_code, enabled, config_version, cipher_text, nonce, auth_tag, configured_at,
                  last_test_status, last_tested_at, $3::text AS configured_by`,
      [通道, 启用, 操作人.username],
    );
    if (!result.rows[0])
      throw new 应用错误("V3_MESSAGE_CHANNEL_NOT_CONFIGURED", "请先保存通道配置。", 409);
    await this.写入审计(操作人, 用户, 启用 ? "enable_channel" : "disable_channel", 通道, {
      channelCode: 通道,
      enabled: 启用,
    });
    return this.转换公开配置(result.rows[0]);
  }

  public async 创建测试投递(
    用户: 平台当前用户,
    通道: 平台通道代码,
    输入: Record<string, unknown>,
  ): Promise<{ deliveryId: string }> {
    const 操作人 = await this.读取超级管理员(用户);
    const 存在 = await this.pool.query(
      "SELECT 1 FROM message.channel_accounts WHERE channel_code = $1",
      [通道],
    );
    if (!存在.rowCount)
      throw new 应用错误("V3_MESSAGE_CHANNEL_NOT_CONFIGURED", "请先保存通道配置。", 409);
    const 测试接收人 = 读取测试接收人(通道, 输入);
    const 临时接收人密文 = 测试接收人
      ? 加密消息通道配置(测试接收人, this.encryptionKey)
      : undefined;
    const result = await this.pool.query<{ id: string }>(
      `WITH notification AS (
         INSERT INTO message.notifications (
           recipient_user_id, event_code, category_code, priority_code, aggregate_type,
           target_action, template_version, title, body, payload_snapshot
         ) VALUES ($1::uuid, 'message.channel.test', 'system', 'strong', 'message_channel',
                   'view', 1, '消息通道测试', '这是一条由超级管理员发起的脱敏测试消息，不包含业务数据。', '{}'::jsonb)
         RETURNING id
       )
       INSERT INTO message.deliveries (
         notification_id, recipient_user_id, channel_code, template_code, template_version,
         semantic_key, deduplication_key, status_code,
         test_recipient_cipher_text, test_recipient_nonce, test_recipient_auth_tag
       ) SELECT notification.id, $1::uuid, $2, 'platform_test_' || $2, 1,
                'platform-test:' || $2 || ':' || gen_random_uuid()::text,
                encode(digest(gen_random_uuid()::text, 'sha256'), 'hex'), 'pending',
                $3, $4, $5
           FROM notification
       RETURNING id::text AS id`,
      [
        操作人.id,
        通道,
        临时接收人密文?.cipherText ?? null,
        临时接收人密文?.nonce ?? null,
        临时接收人密文?.authTag ?? null,
      ],
    );
    const deliveryId = result.rows[0]?.id;
    if (!deliveryId)
      throw new 应用错误("V3_MESSAGE_CHANNEL_TEST_CREATE_FAILED", "测试投递创建失败。", 500);
    await this.写入审计(操作人, 用户, "test_channel", 通道, {
      channelCode: 通道,
      deliveryId,
      hasTemporaryRecipient: Boolean(测试接收人),
    });
    return { deliveryId };
  }

  public async 查询测试投递(
    用户: 平台当前用户,
    deliveryId: string,
  ): Promise<{ statusCode: string; summary: string | null }> {
    const 操作人 = await this.读取超级管理员(用户);
    const result = await this.pool.query<{ status_code: string; error_summary: string | null }>(
      `SELECT status_code, error_summary
         FROM message.deliveries
        WHERE id = $1::uuid AND recipient_user_id = $2::uuid AND template_code LIKE 'platform_test_%'`,
      [deliveryId, 操作人.id],
    );
    const row = result.rows[0];
    if (!row) throw new 应用错误("V3_MESSAGE_CHANNEL_TEST_NOT_FOUND", "测试投递不存在。", 404);
    return { statusCode: row.status_code, summary: row.error_summary };
  }

  public async 查询投递(
    用户: 平台当前用户,
    通道: 平台通道代码 | undefined,
    limit: number,
  ): Promise<消息投递摘要[]> {
    const 操作人 = await this.读取超级管理员(用户);
    const result = await this.pool.query<{
      id: string;
      channel_code: 平台通道代码;
      status_code: string;
      attempt_count: number;
      is_test: boolean;
      created_at: Date;
      finished_at: Date | null;
      error_summary: string | null;
    }>(
      `SELECT id::text, channel_code, status_code, attempt_count,
              template_code LIKE 'platform_test_%' AS is_test,
              created_at, finished_at, error_summary
         FROM message.deliveries
        WHERE channel_code <> 'in_app'
          AND ($1::text IS NULL OR channel_code = $1)
        ORDER BY created_at DESC, id DESC
        LIMIT $2`,
      [通道 ?? null, limit],
    );
    await this.写入审计(操作人, 用户, "read_delivery_status", 通道 || "全部通道", {
      channelCode: 通道 ?? null,
      count: result.rows.length,
    });
    return result.rows.map((row) => ({
      id: row.id,
      channelCode: row.channel_code,
      statusCode: row.status_code,
      attemptCount: row.attempt_count,
      isTest: row.is_test,
      createdAt: row.created_at.toISOString(),
      finishedAt: row.finished_at?.toISOString() ?? null,
      summary: row.error_summary ? row.error_summary.slice(0, 240) : null,
    }));
  }

  private async 读取超级管理员(用户: 平台当前用户): Promise<{ id: string; username: string }> {
    const result = await this.pool.query<{ id: string; username: string }>(
      "SELECT id::text, username FROM iam.users WHERE lower(username) = lower($1) AND status_code = 'active' LIMIT 1",
      [用户.username],
    );
    if (!result.rows[0])
      throw new 应用错误("V3_MESSAGE_PLATFORM_SUBJECT_INVALID", "当前超级管理员账号不可用。", 403);
    return result.rows[0];
  }

  private async 写入审计(
    操作人: { id: string; username: string },
    用户: 平台当前用户,
    动作: string,
    目标: string,
    after: Record<string, unknown>,
    db: Pick<Pool, "query"> = this.pool,
  ): Promise<void> {
    await db.query(
      `INSERT INTO audit.audit_logs (
         created_at, request_id, actor_user_id, actor_username, actor_name, actor_role,
         module_code, action_code, target_type, target_name, result_code, message, after_json, extra_json
       ) VALUES (now(), $1, $2::uuid, $3, $3, 'superadmin', 'message_platform', $4,
                 'message_channel', $5, 'success', '消息通道平台操作', $6::jsonb, '{}'::jsonb)`,
      [用户.requestId, 操作人.id, 操作人.username, 动作, 目标, JSON.stringify(after)],
    );
  }

  private 转换公开配置(row: 通道行 | undefined): 通道公开配置 {
    if (!row)
      throw new 应用错误("V3_MESSAGE_CHANNEL_CONFIG_UNAVAILABLE", "通道配置读取失败。", 500);
    const 配置 = 解密通道配置(row, this.encryptionKey);
    return {
      channelCode: row.channel_code,
      configured: true,
      enabled: row.enabled,
      configVersion: row.config_version,
      configuredAt: row.configured_at.toISOString(),
      configuredBy: row.configured_by,
      ...(row.last_test_status ? { lastTestStatus: row.last_test_status } : {}),
      ...(row.last_tested_at ? { lastTestedAt: row.last_tested_at.toISOString() } : {}),
      detail: 构建公开详情(row.channel_code, 配置),
    };
  }
}

interface 通道行 {
  channel_code: 平台通道代码;
  enabled: boolean;
  config_version: number;
  cipher_text: string;
  nonce: string;
  auth_tag: string;
  configured_at: Date;
  configured_by: string;
  last_test_status: string | null;
  last_tested_at: Date | null;
}

function 解密通道配置(row: 通道行, key: Buffer): Record<string, string | number> {
  return 解密消息通道配置<Record<string, string | number>>(
    { cipherText: row.cipher_text, nonce: row.nonce, authTag: row.auth_tag },
    key,
  );
}

function 默认公开配置(channelCode: 平台通道代码): 通道公开配置 {
  return { channelCode, configured: false, enabled: false, detail: {} };
}

function 校验并合并通道配置(
  channel: 平台通道代码,
  oldValue: Record<string, string | number>,
  input: Record<string, unknown>,
): Record<string, string | number> {
  const 读取 = (key: string, required = false): string => {
    const value = typeof input[key] === "string" ? input[key].trim() : "";
    const merged = value || String(oldValue[key] || "");
    if (required && !merged)
      throw new 应用错误("V3_MESSAGE_CHANNEL_CONFIG_INVALID", `请填写${key}。`, 400);
    return merged;
  };
  if (channel === "wecom") {
    const webhook = 读取("webhook", true);
    if (
      !/^https:\/\/qyapi\.weixin\.qq\.com\/cgi-bin\/webhook\/send\?key=[A-Za-z0-9_-]+$/.test(
        webhook,
      )
    ) {
      throw new 应用错误("V3_MESSAGE_CHANNEL_CONFIG_INVALID", "企微 Webhook 地址不合法。", 400);
    }
    return { webhook };
  }
  if (channel === "wecom_app") {
    const corpId = 读取("corpId", true);
    const agentId = Number(input.agentId || oldValue.agentId || 0);
    if (!/^ww[A-Za-z0-9]{8,64}$/.test(corpId)) {
      throw new 应用错误("V3_MESSAGE_CHANNEL_CONFIG_INVALID", "企业 ID 格式不合法。", 400);
    }
    if (!Number.isInteger(agentId) || agentId < 1 || agentId > 9_999_999_999) {
      throw new 应用错误("V3_MESSAGE_CHANNEL_CONFIG_INVALID", "应用 AgentId 不合法。", 400);
    }
    return { corpId, agentId, secret: 读取("secret", true) };
  }
  if (channel === "sms") {
    const endpoint = 读取("endpoint", true);
    if (!/^https:\/\//.test(endpoint) || /localhost|127\.0\.0\.1|\[::1\]/i.test(endpoint)) {
      throw new 应用错误(
        "V3_MESSAGE_CHANNEL_CONFIG_INVALID",
        "短信网关必须是受信任的 HTTPS 地址。",
        400,
      );
    }
    return {
      endpoint,
      apiKey: 读取("apiKey", true),
      apiSecret: 读取("apiSecret", true),
      templateId: 读取("templateId", true),
      sender: 读取("sender"),
    };
  }
  const smtpHost = 读取("smtpHost", true);
  if (!/^[A-Za-z0-9.-]+$/.test(smtpHost) || /localhost|\.local$/i.test(smtpHost)) {
    throw new 应用错误("V3_MESSAGE_CHANNEL_CONFIG_INVALID", "SMTP 主机不合法。", 400);
  }
  const smtpPort = Number(input.smtpPort || oldValue.smtpPort || 587);
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535)
    throw new 应用错误("V3_MESSAGE_CHANNEL_CONFIG_INVALID", "SMTP 端口不合法。", 400);
  const security =
    input.security === "tls"
      ? "tls"
      : input.security === "starttls"
        ? "starttls"
        : String(oldValue.security || "starttls");
  if (smtpPort === 465 && security !== "tls") {
    throw new 应用错误(
      "V3_MESSAGE_CHANNEL_CONFIG_INVALID",
      "SMTP 端口 465 必须使用 tls；请将安全方式改为 tls 后重新保存。",
      400,
    );
  }
  const from = 读取("from", true);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from))
    throw new 应用错误("V3_MESSAGE_CHANNEL_CONFIG_INVALID", "发件人邮箱不合法。", 400);
  return {
    smtpHost,
    smtpPort,
    security,
    username: 读取("username", true),
    password: 读取("password", true),
    from,
  };
}

function 构建公开详情(
  channel: 平台通道代码,
  value: Record<string, string | number>,
): Record<string, string | number | boolean> {
  if (channel === "wecom") return { webhookTail: 掩码尾部(String(value.webhook || ""), 6) };
  if (channel === "wecom_app") {
    return {
      corpIdTail: 掩码尾部(String(value.corpId || ""), 6),
      agentId: Number(value.agentId || 0),
      secretConfigured: Boolean(value.secret),
    };
  }
  if (channel === "sms")
    return {
      endpoint: 安全地址摘要(String(value.endpoint || "")),
      apiKeyTail: 掩码尾部(String(value.apiKey || ""), 4),
      templateId: String(value.templateId || ""),
      sender: String(value.sender || ""),
    };
  return {
    smtpHost: String(value.smtpHost || ""),
    smtpPort: Number(value.smtpPort || 587),
    security: String(value.security || "starttls"),
    usernameTail: 掩码尾部(String(value.username || ""), 3),
    from: String(value.from || ""),
    passwordConfigured: Boolean(value.password),
  };
}

function 掩码尾部(value: string, tail: number): string {
  return value ? `已配置（末${tail}位：${value.slice(-tail)}）` : "未配置";
}
function 安全地址摘要(value: string): string {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return "";
  }
}

function 读取测试接收人(
  通道: 平台通道代码,
  输入: Record<string, unknown>,
): { type: "email" | "wecom_user"; value: string } | undefined {
  if (通道 === "email") {
    const value = typeof 输入.testEmail === "string" ? 输入.testEmail.trim() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.length > 320) {
      throw new 应用错误("V3_MESSAGE_TEST_RECIPIENT_INVALID", "请填写合法的测试收件邮箱。", 400);
    }
    return { type: "email", value };
  }
  if (通道 === "wecom_app") {
    const value = typeof 输入.testWecomUserId === "string" ? 输入.testWecomUserId.trim() : "";
    if (!/^[A-Za-z0-9_.@-]{1,128}$/.test(value)) {
      throw new 应用错误(
        "V3_MESSAGE_TEST_RECIPIENT_INVALID",
        "请填写合法的企微测试成员 UserId。",
        400,
      );
    }
    return { type: "wecom_user", value };
  }
  return undefined;
}
