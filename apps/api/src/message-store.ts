import type { 消息个人偏好, 消息通知摘要 } from "@lianruan/contracts";
import { 应用错误 } from "@lianruan/shared";
import { Pool } from "pg";

export interface 消息当前用户 {
  username: string;
}

export interface 消息通知查询 {
  category?: string | undefined;
  status?: string | undefined;
  cursor?: string | undefined;
  limit: number;
}

export interface 消息通知列表 {
  items: 消息通知摘要[];
  nextCursor: string | null;
}

export interface 消息偏好更新 {
  wecomEnabled?: boolean | undefined;
  smsEnabled?: boolean | undefined;
  emailEnabled?: boolean | undefined;
  doNotDisturbStart?: string | undefined;
  doNotDisturbEnd?: string | undefined;
}

export interface 消息数据服务 {
  查询通知(用户: 消息当前用户, 查询: 消息通知查询): Promise<消息通知列表>;
  查询未读数(用户: 消息当前用户): Promise<{ unreadCount: number }>;
  标记已读(用户: 消息当前用户, 通知编号: string): Promise<{ updated: boolean }>;
  标记全部已读(用户: 消息当前用户): Promise<{ updatedCount: number }>;
  归档通知(用户: 消息当前用户, 通知编号: string): Promise<{ updated: boolean }>;
  查询偏好(用户: 消息当前用户): Promise<消息个人偏好>;
  更新偏好(用户: 消息当前用户, 输入: 消息偏好更新): Promise<消息个人偏好>;
}

interface 消息服务参数 {
  databaseUrl?: string | undefined;
  pool?: Pool | undefined;
}

interface 通知行 {
  id: string;
  event_code: string;
  category_code: "todo" | "business" | "system" | "security";
  priority_code: "normal" | "strong" | "forced";
  aggregate_type: string;
  aggregate_id: string | null;
  target_action: "view" | "process" | "approve";
  title: string;
  body: string;
  status_code: "unread" | "read" | "archived";
  created_at: Date;
  read_at: Date | null;
  archived_at: Date | null;
  expires_at: Date | null;
}

interface 偏好行 {
  in_app_enabled: boolean;
  wecom_enabled: boolean;
  sms_enabled: boolean;
  email_enabled: boolean;
  do_not_disturb_start: string;
  do_not_disturb_end: string;
}

interface 游标 {
  createdAt: string;
  id: string;
}

const 允许分类 = new Set(["todo", "business", "system", "security"]);
const 允许状态 = new Set(["unread", "read", "archived"]);
const 时间格式 = /^([01]\d|2[0-3]):[0-5]\d$/;

export function 创建消息数据服务(参数: 消息服务参数 = {}): 消息数据服务 {
  if (!参数.databaseUrl && !参数.pool) return new 未配置数据库消息服务();
  return new PostgreSQL消息数据服务(参数.pool || new Pool({ connectionString: 参数.databaseUrl }));
}

class 未配置数据库消息服务 implements 消息数据服务 {
  private 不可用(): never {
    throw new 应用错误("V3_MESSAGE_DATABASE_UNAVAILABLE", "消息服务数据库尚未配置。", 503);
  }

  查询通知(): Promise<消息通知列表> {
    return Promise.reject(this.不可用());
  }

  查询未读数(): Promise<{ unreadCount: number }> {
    return Promise.reject(this.不可用());
  }

  标记已读(): Promise<{ updated: boolean }> {
    return Promise.reject(this.不可用());
  }

  标记全部已读(): Promise<{ updatedCount: number }> {
    return Promise.reject(this.不可用());
  }

  归档通知(): Promise<{ updated: boolean }> {
    return Promise.reject(this.不可用());
  }

  查询偏好(): Promise<消息个人偏好> {
    return Promise.reject(this.不可用());
  }

  更新偏好(): Promise<消息个人偏好> {
    return Promise.reject(this.不可用());
  }
}

class PostgreSQL消息数据服务 implements 消息数据服务 {
  public constructor(private readonly pool: Pool) {}

  public async 查询通知(用户: 消息当前用户, 查询: 消息通知查询): Promise<消息通知列表> {
    校验通知查询(查询);
    const 用户编号 = await this.查询有效用户编号(用户);
    const 参数: unknown[] = [用户编号];
    const 条件 = [
      "n.recipient_user_id = $1::uuid",
      "(n.expires_at IS NULL OR n.expires_at > now())",
    ];
    if (查询.category) {
      参数.push(查询.category);
      条件.push(`n.category_code = $${参数.length}`);
    }
    if (查询.status) {
      参数.push(查询.status);
      条件.push(`n.status_code = $${参数.length}`);
    } else {
      条件.push("n.status_code <> 'archived'");
    }
    const 游标 = 解析游标(查询.cursor);
    if (游标) {
      参数.push(游标.createdAt, 游标.id);
      条件.push(`(n.created_at, n.id) < ($${参数.length - 1}::timestamptz, $${参数.length}::uuid)`);
    }
    参数.push(查询.limit + 1);
    const result = await this.pool.query<通知行>(
      `
      SELECT n.id::text, n.event_code, n.category_code, n.priority_code, n.aggregate_type,
             n.aggregate_id::text, n.target_action, n.title, n.body, n.status_code,
             n.created_at, n.read_at, n.archived_at, n.expires_at
      FROM message.notifications n
      WHERE ${条件.join(" AND ")}
      ORDER BY n.created_at DESC, n.id DESC
      LIMIT $${参数.length}
      `,
      参数,
    );
    const hasMore = result.rows.length > 查询.limit;
    const rows = hasMore ? result.rows.slice(0, 查询.limit) : result.rows;
    const last = rows.at(-1);
    return {
      items: rows.map(转换通知),
      nextCursor: hasMore && last ? 编码游标(last.created_at, last.id) : null,
    };
  }

  public async 查询未读数(用户: 消息当前用户): Promise<{ unreadCount: number }> {
    const 用户编号 = await this.查询有效用户编号(用户);
    const result = await this.pool.query<{ count: string }>(
      `
      SELECT count(*)::text AS count
      FROM message.notifications
      WHERE recipient_user_id = $1::uuid
        AND status_code = 'unread'
        AND (expires_at IS NULL OR expires_at > now())
      `,
      [用户编号],
    );
    return { unreadCount: Number(result.rows[0]?.count || 0) };
  }

  public async 标记已读(用户: 消息当前用户, 通知编号: string): Promise<{ updated: boolean }> {
    const 用户编号 = await this.查询有效用户编号(用户);
    await this.必须属于当前用户(用户编号, 通知编号);
    const result = await this.pool.query(
      `
      UPDATE message.notifications
      SET status_code = CASE WHEN status_code = 'unread' THEN 'read' ELSE status_code END,
          read_at = CASE WHEN status_code = 'unread' THEN now() ELSE read_at END,
          updated_at = now()
      WHERE id = $1::uuid AND recipient_user_id = $2::uuid
      `,
      [通知编号, 用户编号],
    );
    return { updated: result.rowCount === 1 };
  }

  public async 标记全部已读(用户: 消息当前用户): Promise<{ updatedCount: number }> {
    const 用户编号 = await this.查询有效用户编号(用户);
    const result = await this.pool.query(
      `
      UPDATE message.notifications
      SET status_code = 'read', read_at = now(), updated_at = now()
      WHERE recipient_user_id = $1::uuid AND status_code = 'unread'
      `,
      [用户编号],
    );
    return { updatedCount: result.rowCount || 0 };
  }

  public async 归档通知(用户: 消息当前用户, 通知编号: string): Promise<{ updated: boolean }> {
    const 用户编号 = await this.查询有效用户编号(用户);
    await this.必须属于当前用户(用户编号, 通知编号);
    const result = await this.pool.query(
      `
      UPDATE message.notifications
      SET status_code = 'archived', archived_at = COALESCE(archived_at, now()), updated_at = now()
      WHERE id = $1::uuid AND recipient_user_id = $2::uuid
      `,
      [通知编号, 用户编号],
    );
    return { updated: result.rowCount === 1 };
  }

  public async 查询偏好(用户: 消息当前用户): Promise<消息个人偏好> {
    const 用户编号 = await this.查询有效用户编号(用户);
    const result = await this.pool.query<偏好行>(
      `
      INSERT INTO message.user_preferences (user_id)
      VALUES ($1::uuid)
      ON CONFLICT (user_id) DO UPDATE SET updated_at = message.user_preferences.updated_at
      RETURNING in_app_enabled, wecom_enabled, sms_enabled, email_enabled,
                to_char(do_not_disturb_start, 'HH24:MI') AS do_not_disturb_start,
                to_char(do_not_disturb_end, 'HH24:MI') AS do_not_disturb_end
      `,
      [用户编号],
    );
    return 转换偏好(result.rows[0]);
  }

  public async 更新偏好(用户: 消息当前用户, 输入: 消息偏好更新): Promise<消息个人偏好> {
    校验偏好更新(输入);
    const 用户编号 = await this.查询有效用户编号(用户);
    const 当前 = await this.查询偏好(用户);
    const 下一项 = {
      wecomEnabled: 输入.wecomEnabled ?? 当前.wecomEnabled,
      smsEnabled: 输入.smsEnabled ?? 当前.smsEnabled,
      emailEnabled: 输入.emailEnabled ?? 当前.emailEnabled,
      doNotDisturbStart: 输入.doNotDisturbStart ?? 当前.doNotDisturbStart,
      doNotDisturbEnd: 输入.doNotDisturbEnd ?? 当前.doNotDisturbEnd,
    };
    const result = await this.pool.query<偏好行>(
      `
      UPDATE message.user_preferences
      SET wecom_enabled = $2, sms_enabled = $3, email_enabled = $4,
          do_not_disturb_start = $5::time, do_not_disturb_end = $6::time, updated_at = now()
      WHERE user_id = $1::uuid
      RETURNING in_app_enabled, wecom_enabled, sms_enabled, email_enabled,
                to_char(do_not_disturb_start, 'HH24:MI') AS do_not_disturb_start,
                to_char(do_not_disturb_end, 'HH24:MI') AS do_not_disturb_end
      `,
      [
        用户编号,
        下一项.wecomEnabled,
        下一项.smsEnabled,
        下一项.emailEnabled,
        下一项.doNotDisturbStart,
        下一项.doNotDisturbEnd,
      ],
    );
    return 转换偏好(result.rows[0]);
  }

  private async 查询有效用户编号(用户: 消息当前用户): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `
      SELECT id::text
      FROM iam.users
      WHERE lower(username) = lower($1) AND status_code = 'active'
      LIMIT 1
      `,
      [用户.username],
    );
    if (!result.rows[0]?.id) {
      throw new 应用错误(
        "V3_MESSAGE_SESSION_SUBJECT_INVALID",
        "当前登录账号不可使用消息服务。",
        403,
      );
    }
    return result.rows[0].id;
  }

  private async 必须属于当前用户(用户编号: string, 通知编号: string): Promise<void> {
    if (!是UUID(通知编号))
      throw new 应用错误("V3_MESSAGE_NOTIFICATION_NOT_FOUND", "通知不存在。", 404);
    const result = await this.pool.query(
      "SELECT 1 FROM message.notifications WHERE id = $1::uuid AND recipient_user_id = $2::uuid LIMIT 1",
      [通知编号, 用户编号],
    );
    if (result.rowCount !== 1) {
      throw new 应用错误("V3_MESSAGE_NOTIFICATION_NOT_FOUND", "通知不存在。", 404);
    }
  }
}

function 转换通知(row: 通知行): 消息通知摘要 {
  return {
    id: row.id,
    eventCode: row.event_code,
    categoryCode: row.category_code,
    priorityCode: row.priority_code,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    targetAction: row.target_action,
    title: row.title,
    body: row.body,
    statusCode: row.status_code,
    createdAt: row.created_at.toISOString(),
    readAt: row.read_at?.toISOString() || null,
    archivedAt: row.archived_at?.toISOString() || null,
    expiresAt: row.expires_at?.toISOString() || null,
  };
}

function 转换偏好(row: 偏好行 | undefined): 消息个人偏好 {
  if (!row) throw new 应用错误("V3_MESSAGE_PREFERENCE_UNAVAILABLE", "消息偏好读取失败。", 500);
  return {
    inAppEnabled: row.in_app_enabled,
    wecomEnabled: row.wecom_enabled,
    smsEnabled: row.sms_enabled,
    emailEnabled: row.email_enabled,
    doNotDisturbStart: row.do_not_disturb_start,
    doNotDisturbEnd: row.do_not_disturb_end,
  };
}

function 校验通知查询(查询: 消息通知查询): void {
  if (查询.category && !允许分类.has(查询.category)) {
    throw new 应用错误("V3_MESSAGE_CATEGORY_INVALID", "通知分类无效。", 400);
  }
  if (查询.status && !允许状态.has(查询.status)) {
    throw new 应用错误("V3_MESSAGE_STATUS_INVALID", "通知状态无效。", 400);
  }
}

function 校验偏好更新(输入: 消息偏好更新): void {
  if (输入.doNotDisturbStart && !时间格式.test(输入.doNotDisturbStart)) {
    throw new 应用错误("V3_MESSAGE_PREFERENCE_INVALID", "免打扰开始时间必须为 HH:mm。", 400);
  }
  if (输入.doNotDisturbEnd && !时间格式.test(输入.doNotDisturbEnd)) {
    throw new 应用错误("V3_MESSAGE_PREFERENCE_INVALID", "免打扰结束时间必须为 HH:mm。", 400);
  }
}

function 解析游标(value: string | undefined): 游标 | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as 游标;
    if (!parsed.createdAt || !是UUID(parsed.id) || Number.isNaN(Date.parse(parsed.createdAt)))
      throw new Error();
    return parsed;
  } catch {
    throw new 应用错误("V3_MESSAGE_CURSOR_INVALID", "通知游标无效。", 400);
  }
}

function 编码游标(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), id }), "utf8").toString(
    "base64url",
  );
}

function 是UUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
