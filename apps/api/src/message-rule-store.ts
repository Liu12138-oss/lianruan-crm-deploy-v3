import { randomBytes } from "node:crypto";

import { 应用错误, 查找事件, 查找到期数据源 } from "@lianruan/shared";
import { Pool } from "pg";

export type 事件规则状态 = "active" | "disabled";
export type 事件规则保护级别 = "mandatory" | "configurable";
export type 规则渠道代码 = "in_app" | "wecom" | "wecom_app" | "sms" | "email";

export interface 接收人范围 {
  type?: "roles" | "users" | "org" | "region" | "partners";
  codes?: string[];
  userIds?: string[];
  partnerIds?: string[];
}

export interface 提醒接收人候选 {
  userId: string;
  username: string;
  displayName: string;
  hasWecomIdentity: boolean;
}

export interface 消息规则当前用户 {
  username: string;
  requestId: string;
}

export interface 平台事件规则 {
  subscriptionCode: string;
  eventCode: string;
  ruleName: string;
  reminderType: "event";
  templateCode: string;
  isSystem: boolean;
  protectionLevel: 事件规则保护级别;
  statusCode: 事件规则状态;
  version: number;
  recipientRule: { type: string; label: string; editable: boolean };
  recipientScope: 接收人范围;
  channelCodes: 规则渠道代码[];
  updatedAt: string;
  updatedBy: string | null;
}

export interface 事件规则更新输入 {
  statusCode: 事件规则状态;
  channelCodes?: 规则渠道代码[];
  recipientScope?: 接收人范围;
  version: number;
}

export interface 平台到期提醒规则 {
  ruleCode: string;
  reminderCode: string;
  aggregateType: string;
  ruleName: string;
  reminderType: "expiry";
  templateCode: string;
  dataSourceCode: string;
  isSystem: boolean;
  protectionLevel: 事件规则保护级别;
  statusCode: 事件规则状态;
  advanceDays: number[];
  dispatchTime: string;
  workdayOnly: boolean;
  recipientRule: { type: string; label: string; editable: boolean };
  recipientScope: 接收人范围;
  channelCodes: 规则渠道代码[];
  digestWindowMinutes: 0 | 15 | 60;
  version: number;
  updatedAt: string;
  updatedBy: string | null;
}

export interface 到期提醒规则更新输入 {
  statusCode: 事件规则状态;
  advanceDays: number[];
  dispatchTime: string;
  workdayOnly: boolean;
  recipientRule: string;
  recipientScope?: 接收人范围;
  channelCodes: 规则渠道代码[];
  digestWindowMinutes: 0 | 15 | 60;
  version: number;
}

export interface 平台消息模板 {
  templateCode: string;
  channelCode: 规则渠道代码;
  eventCode: string;
  categoryCode: string;
  priorityCode: string;
  titleTemplate: string;
  bodyTemplate: string;
  variables: Array<{ name: string; label: string }>;
  taskTemplateCode: string;
  statusCode: string;
  version: number;
  updatedAt: string;
}

export interface 模板更新输入 {
  titleTemplate: string;
  bodyTemplate: string;
  version: number;
}

export type 任务模板类型 = "expiry" | "event";

export interface 任务模板默认接收人 {
  type: string;
  scope?: Record<string, unknown>;
}

export interface 平台任务模板 {
  templateCode: string;
  templateName: string;
  reminderType: 任务模板类型;
  reminderCode: string;
  aggregateType: string | null;
  dataSourceCode: string | null;
  eventCode: string | null;
  categoryCode: string;
  priorityCode: string;
  defaultRecipientRule: 任务模板默认接收人;
  defaultChannelCodes: 规则渠道代码[];
  defaultAdvanceDays: number[];
  defaultDispatchTime: string;
  defaultWorkdayOnly: boolean;
  defaultDigestWindowMinutes: number;
  variableDefs: Array<{ name: string; label: string }>;
  titleTemplate: string;
  bodyTemplate: string;
  isSystem: boolean;
  statusCode: string;
  description: string;
  updatedAt: string;
}

export interface 任务模板创建输入 {
  templateName: string;
  reminderType: 任务模板类型;
  dataSourceCode?: string;
  eventCode?: string;
  categoryCode: string;
  priorityCode: string;
  recipientRule?: Record<string, unknown>;
  channelCodes?: 规则渠道代码[];
  advanceDays?: number[];
  dispatchTime?: string;
  workdayOnly?: boolean;
  digestWindowMinutes?: number;
  titleTemplate: string;
  bodyTemplate: string;
  description?: string;
}

export interface 任务模板更新输入 {
  templateName?: string;
  recipientRule?: Record<string, unknown>;
  channelCodes?: 规则渠道代码[];
  advanceDays?: number[];
  dispatchTime?: string;
  workdayOnly?: boolean;
  digestWindowMinutes?: number;
  titleTemplate: string;
  bodyTemplate: string;
  description?: string;
}

export interface 提醒任务创建输入 {
  templateCode: string;
  taskName?: string;
  recipientRule?: Record<string, unknown>;
  channelCodes?: 规则渠道代码[];
  advanceDays?: number[];
  dispatchTime?: string;
  workdayOnly?: boolean;
  digestWindowMinutes?: number;
  titleTemplate?: string;
  bodyTemplate?: string;
  statusCode?: 事件规则状态;
}

export interface 提醒任务更新输入 {
  taskName?: string;
  statusCode?: 事件规则状态;
  recipientRule?: Record<string, unknown>;
  channelCodes?: 规则渠道代码[];
  advanceDays?: number[];
  dispatchTime?: string;
  workdayOnly?: boolean;
  digestWindowMinutes?: number;
  titleTemplate?: string;
  bodyTemplate?: string;
  version: number;
}

export interface 消息规则数据服务 {
  查询接收人候选(用户: 消息规则当前用户): Promise<{ items: 提醒接收人候选[] }>;
  查询事件规则(用户: 消息规则当前用户): Promise<平台事件规则[]>;
  查询到期提醒规则(用户: 消息规则当前用户): Promise<平台到期提醒规则[]>;
  查询模板(用户: 消息规则当前用户): Promise<平台消息模板[]>;
  查询任务模板(用户: 消息规则当前用户): Promise<平台任务模板[]>;
  创建任务模板(用户: 消息规则当前用户, 输入: 任务模板创建输入): Promise<平台任务模板>;
  复制任务模板(
    用户: 消息规则当前用户,
    来源代码: string,
    覆盖: Partial<任务模板创建输入>,
  ): Promise<平台任务模板>;
  更新任务模板(
    用户: 消息规则当前用户,
    模板代码: string,
    输入: 任务模板更新输入,
  ): Promise<平台任务模板>;
  创建提醒任务(
    用户: 消息规则当前用户,
    输入: 提醒任务创建输入,
  ): Promise<平台事件规则 | 平台到期提醒规则>;
  更新提醒任务(
    用户: 消息规则当前用户,
    任务代码: string,
    输入: 提醒任务更新输入,
  ): Promise<平台事件规则 | 平台到期提醒规则>;
  更新事件规则(
    用户: 消息规则当前用户,
    订阅代码: string,
    输入: 事件规则更新输入,
  ): Promise<平台事件规则>;
  更新到期提醒规则(
    用户: 消息规则当前用户,
    规则代码: string,
    输入: 到期提醒规则更新输入,
  ): Promise<平台到期提醒规则>;
  更新模板(用户: 消息规则当前用户, 模板代码: string, 输入: 模板更新输入): Promise<平台消息模板>;
}

// 指定用户提醒只允许选择有效的内部任职人员，或有效的内部管理角色账号。
// 该条件同时用于候选查询和保存校验，避免前后端口径不一致。
const 有效内部提醒用户条件 = `(
  EXISTS (
    SELECT 1
      FROM org.staff_assignments assignment
      JOIN org.org_units unit ON unit.id = assignment.org_unit_id
     WHERE assignment.user_id = u.id
       AND assignment.expired_at IS NULL
       AND unit.status_code = 'active'
       AND unit.unit_type NOT LIKE 'channel_%'
  )
  OR EXISTS (
    SELECT 1
      FROM iam.user_roles user_role
      JOIN iam.roles role ON role.id = user_role.role_id
     WHERE user_role.user_id = u.id
       AND role.status_code = 'active'
       AND role.role_code IN ('superadmin', 'admin', 'region_manager')
  )
)`;

export function 创建消息规则数据服务(
  参数: { databaseUrl?: string; pool?: Pool } = {},
): 消息规则数据服务 {
  if (!参数.databaseUrl && !参数.pool) return new 未配置消息规则数据服务();
  return new PostgreSQL消息规则数据服务(
    参数.pool || new Pool({ connectionString: 参数.databaseUrl }),
  );
}

class 未配置消息规则数据服务 implements 消息规则数据服务 {
  private 不可用(): never {
    throw new 应用错误("V3_MESSAGE_RULE_DATABASE_UNAVAILABLE", "提醒规则数据库尚未配置。", 503);
  }

  查询接收人候选(): Promise<{ items: 提醒接收人候选[] }> {
    return Promise.reject(this.不可用());
  }
  查询事件规则(): Promise<平台事件规则[]> {
    return Promise.reject(this.不可用());
  }
  查询到期提醒规则(): Promise<平台到期提醒规则[]> {
    return Promise.reject(this.不可用());
  }
  查询模板(): Promise<平台消息模板[]> {
    return Promise.reject(this.不可用());
  }
  查询任务模板(): Promise<平台任务模板[]> {
    return Promise.reject(this.不可用());
  }
  创建任务模板(): Promise<平台任务模板> {
    return Promise.reject(this.不可用());
  }
  复制任务模板(): Promise<平台任务模板> {
    return Promise.reject(this.不可用());
  }
  更新任务模板(): Promise<平台任务模板> {
    return Promise.reject(this.不可用());
  }
  创建提醒任务(): Promise<平台事件规则 | 平台到期提醒规则> {
    return Promise.reject(this.不可用());
  }
  更新提醒任务(): Promise<平台事件规则 | 平台到期提醒规则> {
    return Promise.reject(this.不可用());
  }
  更新事件规则(): Promise<平台事件规则> {
    return Promise.reject(this.不可用());
  }
  更新到期提醒规则(): Promise<平台到期提醒规则> {
    return Promise.reject(this.不可用());
  }
  更新模板(): Promise<平台消息模板> {
    return Promise.reject(this.不可用());
  }
}

class PostgreSQL消息规则数据服务 implements 消息规则数据服务 {
  public constructor(private readonly pool: Pool) {}

  public async 查询接收人候选(用户: 消息规则当前用户): Promise<{ items: 提醒接收人候选[] }> {
    const 操作人 = await this.读取超级管理员(用户);
    const result = await this.pool.query<提醒接收人候选>(
      `SELECT u.id::text AS "userId",
              u.username::text AS username,
              u.display_name AS "displayName",
              EXISTS (
                SELECT 1
                  FROM iam.external_identities identity
                 WHERE identity.user_id = u.id
                   AND identity.provider_code = 'wecom'
                   AND identity.status_code = 'active'
                   AND NULLIF(BTRIM(identity.external_subject), '') IS NOT NULL
              ) AS "hasWecomIdentity"
         FROM iam.users u
        WHERE u.status_code = 'active'
          AND ${有效内部提醒用户条件}
        ORDER BY u.display_name, u.username`,
    );
    await this.写入审计(操作人, 用户, "read_recipient_candidates", "提醒接收人候选", {
      count: result.rows.length,
    });
    return { items: result.rows };
  }

  public async 查询事件规则(用户: 消息规则当前用户): Promise<平台事件规则[]> {
    const 操作人 = await this.读取超级管理员(用户);
    const result = await this.pool.query<事件规则行>(查询规则语句);
    await this.写入审计(操作人, 用户, "read_event_rules", "全部事件规则", {
      count: result.rows.length,
    });
    return result.rows.map(转换规则);
  }

  public async 查询到期提醒规则(用户: 消息规则当前用户): Promise<平台到期提醒规则[]> {
    const 操作人 = await this.读取超级管理员(用户);
    const result = await this.pool.query<到期提醒规则行>(查询到期提醒规则语句);
    await this.写入审计(操作人, 用户, "read_reminder_rules", "全部到期提醒规则", {
      count: result.rows.length,
    });
    return result.rows.map(转换到期提醒规则);
  }

  public async 更新事件规则(
    用户: 消息规则当前用户,
    订阅代码: string,
    输入: 事件规则更新输入,
  ): Promise<平台事件规则> {
    const 操作人 = await this.读取超级管理员(用户);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const 当前结果 = await client.query<事件规则行>(
        `${查询规则字段语句} WHERE subscription.subscription_code = $1 FOR UPDATE OF subscription`,
        [订阅代码],
      );
      const 当前 = 当前结果.rows[0];
      if (!当前) throw new 应用错误("V3_MESSAGE_RULE_NOT_FOUND", "提醒规则不存在。", 404);
      if (当前.rule_version !== 输入.version) {
        throw new 应用错误(
          "V3_MESSAGE_RULE_VERSION_CONFLICT",
          "提醒规则已被其他管理员更新，请刷新后重试。",
          409,
        );
      }
      if (当前.protection_level === "mandatory" && 输入.statusCode !== "active") {
        throw new 应用错误(
          "V3_MESSAGE_RULE_MANDATORY",
          "该强制提醒不可关闭，且必须保留站内渠道。",
          409,
        );
      }
      const 通道集合 = 校验通道集合(输入.channelCodes ?? ["in_app"]);
      if (当前.protection_level === "mandatory" && !通道集合.includes("in_app")) {
        throw new 应用错误("V3_MESSAGE_RULE_MANDATORY", "强制提醒必须保留站内渠道。", 409);
      }
      const 范围 =
        输入.recipientScope === undefined
          ? (当前.recipient_rule_json.scope ?? {})
          : 校验接收人范围(输入.recipientScope);
      await this.校验指定用户有效(client, 提取指定用户编号(范围));
      const 更新结果 = await client.query<事件规则行>(
        `UPDATE message.event_subscriptions
            SET status_code = $2,
                channel_codes = $3::jsonb,
                recipient_rule_json = jsonb_set(
                  recipient_rule_json,
                  '{scope}',
                  $4::jsonb,
                  true
                ),
                rule_version = rule_version + 1,
                updated_by_user_id = $5::uuid,
                rule_updated_at = now(),
                updated_at = now()
          WHERE subscription_code = $1
          RETURNING subscription_code, event_code, rule_name, rule_protection_code AS protection_level,
                    status_code, rule_version, recipient_rule_json, channel_codes,
                    rule_updated_at, $6::text AS updated_by`,
        [
          订阅代码,
          输入.statusCode,
          JSON.stringify(通道集合),
          JSON.stringify(范围),
          操作人.id,
          操作人.username,
        ],
      );
      const 更新后 = 更新结果.rows[0];
      if (!更新后) throw new 应用错误("V3_MESSAGE_RULE_NOT_FOUND", "提醒规则不存在。", 404);
      await this.写入审计(
        操作人,
        用户,
        "update_event_rule",
        当前.rule_name,
        {
          before: 审计规则快照(当前),
          after: 审计规则快照(更新后),
        },
        client,
        当前.subscription_code,
      );
      await client.query("COMMIT");
      return 转换规则(更新后);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async 更新到期提醒规则(
    用户: 消息规则当前用户,
    规则代码: string,
    输入: 到期提醒规则更新输入,
  ): Promise<平台到期提醒规则> {
    const 操作人 = await this.读取超级管理员(用户);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const 当前结果 = await client.query<到期提醒规则行>(
        `${查询到期提醒规则字段语句} WHERE rule.rule_code = $1 FOR UPDATE OF rule`,
        [规则代码],
      );
      const 当前 = 当前结果.rows[0];
      if (!当前)
        throw new 应用错误("V3_MESSAGE_REMINDER_RULE_NOT_FOUND", "到期提醒规则不存在。", 404);
      if (当前.rule_version !== 输入.version) {
        throw new 应用错误(
          "V3_MESSAGE_REMINDER_RULE_VERSION_CONFLICT",
          "到期提醒规则已被其他管理员更新，请刷新后重试。",
          409,
        );
      }
      const 通道集合 = 校验通道集合(输入.channelCodes ?? ["in_app"]);
      const 接收人 = 校验接收人规则({
        type: 输入.recipientRule,
        ...(输入.recipientScope ? { scope: 输入.recipientScope } : {}),
      });
      await this.校验指定用户有效(client, 提取指定用户编号(接收人));
      const 更新结果 = await client.query<到期提醒规则行>(
        `UPDATE message.reminder_rules
            SET status_code = $2,
                advance_days = $3::integer[],
                dispatch_time = $4::time,
                workday_only = $5,
                recipient_rule_json = $6::jsonb,
                channel_codes = $7::jsonb,
                digest_window_minutes = $8,
                rule_version = rule_version + 1,
                updated_by_user_id = $9::uuid,
                rule_updated_at = now(),
                updated_at = now()
          WHERE rule_code = $1
          RETURNING rule_code, reminder_code, aggregate_type, rule_name, reminder_type,
                    template_code, data_source_code,
                    COALESCE(
                      (SELECT catalog.is_system
                         FROM message.reminder_templates catalog
                        WHERE catalog.template_code = message.reminder_rules.template_code),
                      false
                    ) AS is_system,
                    rule_protection_code AS protection_level, status_code, advance_days,
                    to_char(dispatch_time, 'HH24:MI') AS dispatch_time,
                    workday_only, recipient_rule_json, channel_codes,
                    digest_window_minutes, rule_version, rule_updated_at, $10::text AS updated_by`,
        [
          规则代码,
          输入.statusCode,
          输入.advanceDays,
          `${输入.dispatchTime}:00`,
          输入.workdayOnly,
          JSON.stringify(接收人),
          JSON.stringify(通道集合),
          输入.digestWindowMinutes,
          操作人.id,
          操作人.username,
        ],
      );
      const 更新后 = 更新结果.rows[0];
      if (!更新后)
        throw new 应用错误("V3_MESSAGE_REMINDER_RULE_NOT_FOUND", "到期提醒规则不存在。", 404);
      await this.写入审计(
        操作人,
        用户,
        "update_reminder_rule",
        当前.rule_name,
        {
          before: 审计到期提醒规则快照(当前),
          after: 审计到期提醒规则快照(更新后),
        },
        client,
        当前.rule_code,
      );
      await client.query("COMMIT");
      return 转换到期提醒规则(更新后);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async 查询模板(用户: 消息规则当前用户): Promise<平台消息模板[]> {
    await this.读取超级管理员(用户);
    const result = await this.pool.query<消息模板行>(
      `SELECT template_code, channel_code, event_code, category_code, priority_code,
              title_template, body_template, variables_json, status_code, version, updated_at
         FROM message.templates
        WHERE template_code = ANY($1::text[])
          AND status_code = 'published'
        ORDER BY template_code, channel_code`,
      [[...受管模板代码]],
    );
    return result.rows.map(转换模板);
  }

  public async 查询任务模板(用户: 消息规则当前用户): Promise<平台任务模板[]> {
    const 操作人 = await this.读取超级管理员(用户);
    const result = await this.pool.query<任务模板行>(查询任务模板语句);
    await this.写入审计(操作人, 用户, "read_task_templates", "全部提醒任务模板", {
      count: result.rows.length,
    });
    return result.rows.map(转换任务模板);
  }

  public async 创建任务模板(用户: 消息规则当前用户, 输入: 任务模板创建输入): Promise<平台任务模板> {
    const 操作人 = await this.读取超级管理员(用户);
    const 参数 = 归一化任务模板输入(输入);
    const 到期数据源 = 参数.类型 === "expiry" ? 查找到期数据源(参数.数据源代码 || "") : undefined;
    const 提醒代码 = 到期数据源?.reminderCode ?? null;
    const 聚合类型 = 到期数据源?.aggregateType ?? null;
    校验模板引用(参数.标题, 参数.正文, 参数.变量);
    const 模板代码 = 生成任务代码();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await this.校验指定用户有效(client, 提取指定用户编号(参数.接收人));
      await client.query(
        `INSERT INTO message.reminder_templates (
           template_code, template_name, reminder_type, reminder_code, aggregate_type,
           data_source_code, event_code,
           category_code, priority_code, default_recipient_rule_json, default_channel_codes,
           default_advance_days, default_dispatch_time, default_workday_only,
           default_digest_window_minutes, variable_defs, title_template, body_template,
           is_system, status_code, description
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::integer[],$13::time,$14,$15,$16::jsonb,$17,$18,false,'active',$19)`,
        [
          模板代码,
          参数.名称,
          参数.类型,
          提醒代码,
          聚合类型,
          参数.数据源代码,
          参数.事件代码,
          参数.类别,
          参数.优先级,
          JSON.stringify(参数.接收人),
          JSON.stringify(参数.渠道),
          参数.提前天数,
          `${参数.执行时间}:00`,
          参数.仅工作日,
          参数.汇总窗口,
          JSON.stringify(参数.变量),
          参数.标题,
          参数.正文,
          参数.描述,
        ],
      );
      await this.写入审计(
        操作人,
        用户,
        "create_task_template",
        参数.名称,
        { templateCode: 模板代码 },
        client,
        模板代码,
      );
      await client.query("COMMIT");
      const 结果 = await client.query<任务模板行>(
        `${查询任务模板字段语句} WHERE template_code = $1`,
        [模板代码],
      );
      return 转换任务模板(结果.rows[0]!);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async 复制任务模板(
    用户: 消息规则当前用户,
    来源代码: string,
    覆盖: Partial<任务模板创建输入>,
  ): Promise<平台任务模板> {
    const 操作人 = await this.读取超级管理员(用户);
    const 来源 = await this.读取目录模板(来源代码);
    const 变量 = 解析模板变量(来源.variable_defs);
    const 参数 = {
      名称: String(覆盖.templateName ?? "").trim() || `${来源.template_name}（副本）`,
      类型: 来源.reminder_type,
      数据源代码: 来源.data_source_code,
      事件代码: 来源.event_code,
      类别: 来源.category_code,
      优先级: 来源.priority_code,
      接收人: 校验接收人规则(
        覆盖.recipientRule ?? 解析接收人规则(来源.default_recipient_rule_json),
      ),
      渠道: 校验通道集合(覆盖.channelCodes ?? 来源.default_channel_codes),
      提前天数: 校验提前天数(覆盖.advanceDays ?? 来源.default_advance_days),
      执行时间: String(覆盖.dispatchTime ?? 来源.default_dispatch_time).trim(),
      仅工作日:
        typeof 覆盖.workdayOnly === "boolean" ? 覆盖.workdayOnly : 来源.default_workday_only,
      汇总窗口: 校验汇总窗口(覆盖.digestWindowMinutes ?? 来源.default_digest_window_minutes),
      标题: String(覆盖.titleTemplate ?? 来源.title_template).trim(),
      正文: String(覆盖.bodyTemplate ?? 来源.body_template).trim(),
      描述: String(覆盖.description ?? 来源.description ?? "").trim(),
      变量,
    };
    校验模板引用(参数.标题, 参数.正文, 变量);
    const 新代码 = 生成任务代码();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await this.校验指定用户有效(client, 提取指定用户编号(参数.接收人));
      await client.query(
        `INSERT INTO message.reminder_templates (
           template_code, template_name, reminder_type, reminder_code, aggregate_type,
           data_source_code, event_code,
           category_code, priority_code, default_recipient_rule_json, default_channel_codes,
           default_advance_days, default_dispatch_time, default_workday_only,
           default_digest_window_minutes, variable_defs, title_template, body_template,
           is_system, status_code, description
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::integer[],$13::time,$14,$15,$16::jsonb,$17,$18,false,'active',$19)`,
        [
          新代码,
          参数.名称,
          参数.类型,
          来源.reminder_code,
          来源.aggregate_type,
          参数.数据源代码,
          参数.事件代码,
          参数.类别,
          参数.优先级,
          JSON.stringify(参数.接收人),
          JSON.stringify(参数.渠道),
          参数.提前天数,
          `${参数.执行时间}:00`,
          参数.仅工作日,
          参数.汇总窗口,
          JSON.stringify(变量),
          参数.标题,
          参数.正文,
          参数.描述,
        ],
      );
      await this.写入审计(
        操作人,
        用户,
        "copy_task_template",
        参数.名称,
        { 来源代码, templateCode: 新代码 },
        client,
        新代码,
      );
      await client.query("COMMIT");
      const 结果 = await client.query<任务模板行>(
        `${查询任务模板字段语句} WHERE template_code = $1`,
        [新代码],
      );
      return 转换任务模板(结果.rows[0]!);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async 更新任务模板(
    用户: 消息规则当前用户,
    模板代码: string,
    输入: 任务模板更新输入,
  ): Promise<平台任务模板> {
    const 操作人 = await this.读取超级管理员(用户);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const 当前结果 = await client.query<任务模板行>(
        `${查询任务模板字段语句} WHERE template_code = $1 FOR UPDATE`,
        [模板代码],
      );
      const 当前 = 当前结果.rows[0];
      if (!当前)
        throw new 应用错误("V3_MESSAGE_TASK_TEMPLATE_NOT_FOUND", "提醒任务模板不存在。", 404);
      const 变量 = 解析模板变量(当前.variable_defs);
      const 标题 = String(输入.titleTemplate ?? "").trim();
      const 正文 = String(输入.bodyTemplate ?? "").trim();
      if (!标题 || !正文) {
        throw new 应用错误("V3_MESSAGE_TASK_TEMPLATE_INVALID", "模板标题与正文不能为空。", 400);
      }
      校验模板引用(标题, 正文, 变量);
      const 名称 = String(输入.templateName ?? 当前.template_name).trim();
      if (!名称) throw new 应用错误("V3_MESSAGE_TASK_TEMPLATE_INVALID", "模板名称不能为空。", 400);
      const 可改默认 = !当前.is_system;
      const 接收人 =
        可改默认 && 输入.recipientRule
          ? 校验接收人规则(输入.recipientRule)
          : 当前.default_recipient_rule_json;
      await this.校验指定用户有效(client, 提取指定用户编号(接收人));
      const 渠道 =
        可改默认 && 输入.channelCodes
          ? 校验通道集合(输入.channelCodes)
          : 当前.default_channel_codes;
      const 提前天数 =
        可改默认 && 输入.advanceDays ? 校验提前天数(输入.advanceDays) : 当前.default_advance_days;
      const 执行时间 =
        可改默认 && 输入.dispatchTime
          ? String(输入.dispatchTime).trim()
          : 当前.default_dispatch_time;
      const 仅工作日 =
        可改默认 && typeof 输入.workdayOnly === "boolean"
          ? 输入.workdayOnly
          : 当前.default_workday_only;
      const 汇总窗口 =
        可改默认 && 输入.digestWindowMinutes !== undefined
          ? 校验汇总窗口(输入.digestWindowMinutes)
          : 当前.default_digest_window_minutes;
      await client.query(
        `UPDATE message.reminder_templates
            SET template_name = $2,
                default_recipient_rule_json = $3::jsonb,
                default_channel_codes = $4::jsonb,
                default_advance_days = $5::integer[],
                default_dispatch_time = $6::time,
                default_workday_only = $7,
                default_digest_window_minutes = $8,
                title_template = $9,
                body_template = $10,
                description = $11,
                updated_at = now()
          WHERE template_code = $1`,
        [
          模板代码,
          名称,
          JSON.stringify(接收人),
          JSON.stringify(渠道),
          提前天数,
          `${执行时间}:00`,
          仅工作日,
          汇总窗口,
          标题,
          正文,
          String(输入.description ?? 当前.description ?? "").trim(),
        ],
      );
      await this.写入审计(
        操作人,
        用户,
        "update_task_template",
        名称,
        { templateCode: 模板代码 },
        client,
        模板代码,
      );
      await client.query("COMMIT");
      const 结果 = await client.query<任务模板行>(
        `${查询任务模板字段语句} WHERE template_code = $1`,
        [模板代码],
      );
      return 转换任务模板(结果.rows[0]!);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async 创建提醒任务(
    用户: 消息规则当前用户,
    输入: 提醒任务创建输入,
  ): Promise<平台事件规则 | 平台到期提醒规则> {
    const 操作人 = await this.读取超级管理员(用户);
    const 模板 = await this.读取目录模板(输入.templateCode);
    const 变量 = 解析模板变量(模板.variable_defs);
    const 标题 = String(输入.titleTemplate ?? 模板.title_template).trim();
    const 正文 = String(输入.bodyTemplate ?? 模板.body_template).trim();
    if (!标题 || !正文) {
      throw new 应用错误("V3_MESSAGE_TASK_INVALID", "提醒任务标题与正文不能为空。", 400);
    }
    校验模板引用(标题, 正文, 变量);
    const 任务名称 = String(输入.taskName ?? 模板.template_name).trim();
    if (!任务名称) throw new 应用错误("V3_MESSAGE_TASK_INVALID", "提醒任务名称不能为空。", 400);
    const 接收人 = 校验接收人规则(
      输入.recipientRule ?? 解析接收人规则(模板.default_recipient_rule_json),
    );
    const 渠道 = 校验通道集合(输入.channelCodes ?? 模板.default_channel_codes);
    const 提前天数 = 校验提前天数(输入.advanceDays ?? 模板.default_advance_days);
    const 执行时间 = String(输入.dispatchTime ?? 模板.default_dispatch_time).trim();
    const 仅工作日 =
      typeof 输入.workdayOnly === "boolean" ? 输入.workdayOnly : 模板.default_workday_only;
    const 汇总窗口 = 校验汇总窗口(输入.digestWindowMinutes ?? 模板.default_digest_window_minutes);
    const 状态 = 输入.statusCode === "disabled" ? "disabled" : "active";
    const 任务代码 = 生成任务代码();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await this.校验指定用户有效(client, 提取指定用户编号(接收人));
      await client.query(
        `INSERT INTO message.reminder_templates (
           template_code, template_name, reminder_type, reminder_code, aggregate_type,
           data_source_code, event_code, category_code, priority_code,
           default_recipient_rule_json, default_channel_codes,
           default_advance_days, default_dispatch_time, default_workday_only,
           default_digest_window_minutes, variable_defs, title_template, body_template,
           is_system, status_code, description
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::integer[],$13::time,$14,$15,$16::jsonb,$17,$18,false,'active',$19)`,
        [
          任务代码,
          任务名称,
          模板.reminder_type,
          模板.reminder_code,
          模板.aggregate_type,
          模板.data_source_code,
          模板.event_code,
          模板.category_code,
          模板.priority_code,
          JSON.stringify(接收人),
          JSON.stringify(渠道),
          提前天数,
          `${执行时间}:00`,
          仅工作日,
          汇总窗口,
          JSON.stringify(变量),
          标题,
          正文,
          String(模板.description ?? ""),
        ],
      );
      let 结果: 平台事件规则 | 平台到期提醒规则;
      if (模板.reminder_type === "expiry") {
        await client.query(
          `INSERT INTO message.reminder_rules (
             rule_code, reminder_code, aggregate_type, rule_name, template_code,
             data_source_code, reminder_type, advance_days, dispatch_time, workday_only,
             recipient_rule_json, channel_codes, digest_window_minutes, status_code,
             rule_protection_code
           ) VALUES ($1,$2,$3,$4,$5,$6,'expiry',$7::integer[],$8::time,$9,$10::jsonb,$11::jsonb,$12,$13,'configurable')`,
          [
            任务代码,
            模板.reminder_code,
            模板.aggregate_type,
            任务名称,
            任务代码,
            模板.data_source_code,
            提前天数,
            `${执行时间}:00`,
            仅工作日,
            JSON.stringify(接收人),
            JSON.stringify(渠道),
            汇总窗口,
            状态,
          ],
        );
        await this.写入审计(
          操作人,
          用户,
          "create_reminder_task",
          任务名称,
          { 任务代码, 来源模板: 模板.template_code },
          client,
          任务代码,
        );
        await client.query("COMMIT");
        const 查询 = await client.query<到期提醒规则行>(
          `${查询到期提醒规则字段语句} WHERE rule.rule_code = $1`,
          [任务代码],
        );
        结果 = 转换到期提醒规则(查询.rows[0]!);
      } else {
        await client.query(
          `INSERT INTO message.event_subscriptions (
             subscription_code, event_code, event_version, template_code, recipient_rule_json,
             channel_codes, status_code, rule_name, rule_protection_code
           ) VALUES ($1,$2,1,$3,$4::jsonb,$5::jsonb,$6,$7,'configurable')`,
          [
            任务代码,
            模板.event_code,
            任务代码,
            JSON.stringify(接收人),
            JSON.stringify(渠道),
            状态,
            任务名称,
          ],
        );
        await this.写入审计(
          操作人,
          用户,
          "create_event_task",
          任务名称,
          { 任务代码, 来源模板: 模板.template_code },
          client,
          任务代码,
        );
        await client.query("COMMIT");
        const 查询 = await client.query<事件规则行>(
          `${查询规则字段语句} WHERE subscription.subscription_code = $1`,
          [任务代码],
        );
        结果 = 转换规则(查询.rows[0]!);
      }
      return 结果;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async 更新提醒任务(
    用户: 消息规则当前用户,
    任务代码: string,
    输入: 提醒任务更新输入,
  ): Promise<平台事件规则 | 平台到期提醒规则> {
    const 操作人 = await this.读取超级管理员(用户);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const 到期行 = await client.query<到期提醒规则行>(
        `${查询到期提醒规则字段语句} WHERE rule.rule_code = $1 FOR UPDATE OF rule`,
        [任务代码],
      );
      if (到期行.rows[0]) {
        const 当前 = 到期行.rows[0];
        if (当前.rule_version !== 输入.version) {
          throw new 应用错误(
            "V3_MESSAGE_TASK_VERSION_CONFLICT",
            "提醒任务已被其他管理员更新，请刷新后重试。",
            409,
          );
        }
        const 标题 =
          String(输入.titleTemplate ?? "").trim() || 当前目录标题(当前.template_code, client) || "";
        const 正文 =
          String(输入.bodyTemplate ?? "").trim() || 当前目录正文(当前.template_code, client) || "";
        const 任务名称 = String(输入.taskName ?? 当前.rule_name).trim();
        const 接收人 = 输入.recipientRule
          ? 校验接收人规则(输入.recipientRule)
          : 当前.recipient_rule_json;
        await this.校验指定用户有效(client, 提取指定用户编号(接收人));
        const 渠道 = 输入.channelCodes ? 校验通道集合(输入.channelCodes) : 当前.channel_codes;
        const 提前天数 = 输入.advanceDays ? 校验提前天数(输入.advanceDays) : 当前.advance_days;
        const 执行时间 = String(输入.dispatchTime ?? 当前.dispatch_time).trim();
        const 仅工作日 =
          typeof 输入.workdayOnly === "boolean" ? 输入.workdayOnly : 当前.workday_only;
        const 汇总窗口 =
          输入.digestWindowMinutes !== undefined
            ? 校验汇总窗口(输入.digestWindowMinutes)
            : 当前.digest_window_minutes;
        const 状态 =
          输入.statusCode === "disabled"
            ? "disabled"
            : 输入.statusCode === "active"
              ? "active"
              : 当前.status_code;
        await client.query(
          `UPDATE message.reminder_rules
              SET rule_name = $2,
                  advance_days = $3::integer[],
                  dispatch_time = $4::time,
                  workday_only = $5,
                  recipient_rule_json = $6::jsonb,
                  channel_codes = $7::jsonb,
                  digest_window_minutes = $8,
                  status_code = $9,
                  rule_version = rule_version + 1,
                  updated_by_user_id = $10::uuid,
                  rule_updated_at = now(),
                  updated_at = now()
            WHERE rule_code = $1`,
          [
            任务代码,
            任务名称,
            提前天数,
            `${执行时间}:00`,
            仅工作日,
            JSON.stringify(接收人),
            JSON.stringify(渠道),
            汇总窗口,
            状态,
            操作人.id,
          ],
        );
        await client.query(
          `UPDATE message.reminder_templates
              SET template_name = $2,
                  title_template = $3,
                  body_template = $4,
                  updated_at = now()
            WHERE template_code = $1`,
          [任务代码, 任务名称, 标题, 正文],
        );
        await this.写入审计(
          操作人,
          用户,
          "update_reminder_task",
          任务名称,
          { 任务代码 },
          client,
          任务代码,
        );
        await client.query("COMMIT");
        const 查询 = await client.query<到期提醒规则行>(
          `${查询到期提醒规则字段语句} WHERE rule.rule_code = $1`,
          [任务代码],
        );
        return 转换到期提醒规则(查询.rows[0]!);
      }
      const 事件行 = await client.query<事件规则行>(
        `${查询规则字段语句} WHERE subscription.subscription_code = $1 FOR UPDATE OF subscription`,
        [任务代码],
      );
      const 当前 = 事件行.rows[0];
      if (!当前) throw new 应用错误("V3_MESSAGE_TASK_NOT_FOUND", "提醒任务不存在。", 404);
      if (当前.rule_version !== 输入.version) {
        throw new 应用错误(
          "V3_MESSAGE_TASK_VERSION_CONFLICT",
          "提醒任务已被其他管理员更新，请刷新后重试。",
          409,
        );
      }
      const 标题 =
        String(输入.titleTemplate ?? "").trim() || 当前目录标题(当前.template_code, client) || "";
      const 正文 =
        String(输入.bodyTemplate ?? "").trim() || 当前目录正文(当前.template_code, client) || "";
      const 任务名称 = String(输入.taskName ?? 当前.rule_name).trim();
      const 接收人 = 输入.recipientRule
        ? 校验接收人规则(输入.recipientRule)
        : 当前.recipient_rule_json;
      await this.校验指定用户有效(client, 提取指定用户编号(接收人));
      const 渠道 = 输入.channelCodes ? 校验通道集合(输入.channelCodes) : 当前.channel_codes;
      const 状态 =
        输入.statusCode === "disabled"
          ? "disabled"
          : 输入.statusCode === "active"
            ? "active"
            : 当前.status_code;
      await client.query(
        `UPDATE message.event_subscriptions
            SET rule_name = $2,
                recipient_rule_json = $3::jsonb,
                channel_codes = $4::jsonb,
                status_code = $5,
                rule_version = rule_version + 1,
                updated_by_user_id = $6::uuid,
                rule_updated_at = now(),
                updated_at = now()
          WHERE subscription_code = $1`,
        [任务代码, 任务名称, JSON.stringify(接收人), JSON.stringify(渠道), 状态, 操作人.id],
      );
      await client.query(
        `UPDATE message.reminder_templates
            SET template_name = $2,
                title_template = $3,
                body_template = $4,
                updated_at = now()
          WHERE template_code = $1`,
        [任务代码, 任务名称, 标题, 正文],
      );
      await this.写入审计(
        操作人,
        用户,
        "update_event_task",
        任务名称,
        { 任务代码 },
        client,
        任务代码,
      );
      await client.query("COMMIT");
      const 查询 = await client.query<事件规则行>(
        `${查询规则字段语句} WHERE subscription.subscription_code = $1`,
        [任务代码],
      );
      return 转换规则(查询.rows[0]!);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async 读取目录模板(模板代码: string): Promise<{
    template_code: string;
    template_name: string;
    reminder_type: 任务模板类型;
    reminder_code: string;
    aggregate_type: string | null;
    data_source_code: string | null;
    event_code: string | null;
    category_code: string;
    priority_code: string;
    default_recipient_rule_json: Record<string, unknown>;
    default_channel_codes: unknown;
    default_advance_days: number[];
    default_dispatch_time: string;
    default_workday_only: boolean;
    default_digest_window_minutes: number;
    variable_defs: unknown;
    title_template: string;
    body_template: string;
    description: string | null;
  }> {
    const result = await this.pool.query<{
      template_code: string;
      template_name: string;
      reminder_type: 任务模板类型;
      reminder_code: string;
      aggregate_type: string | null;
      data_source_code: string | null;
      event_code: string | null;
      category_code: string;
      priority_code: string;
      default_recipient_rule_json: Record<string, unknown>;
      default_channel_codes: unknown;
      default_advance_days: number[];
      default_dispatch_time: string;
      default_workday_only: boolean;
      default_digest_window_minutes: number;
      variable_defs: unknown;
      title_template: string;
      body_template: string;
      description: string | null;
    }>(
      `SELECT template_code, template_name, reminder_type, reminder_code, aggregate_type,
              data_source_code, event_code, category_code, priority_code,
              default_recipient_rule_json, default_channel_codes,
              default_advance_days, to_char(default_dispatch_time, 'HH24:MI') AS default_dispatch_time,
              default_workday_only, default_digest_window_minutes,
              variable_defs, title_template, body_template, description
         FROM message.reminder_templates
        WHERE template_code = $1 AND status_code = 'active'`,
      [模板代码],
    );
    const 模板 = result.rows[0];
    if (!模板)
      throw new 应用错误("V3_MESSAGE_TASK_TEMPLATE_NOT_FOUND", "提醒任务模板不存在或已停用。", 404);
    return 模板;
  }

  public async 更新模板(
    用户: 消息规则当前用户,
    模板代码: string,
    输入: 模板更新输入,
  ): Promise<平台消息模板> {
    if (!受管模板代码.has(模板代码)) {
      throw new 应用错误("V3_MESSAGE_TEMPLATE_NOT_FOUND", "消息模板不存在。", 404);
    }
    const 操作人 = await this.读取超级管理员(用户);
    const 标题 = String(输入.titleTemplate || "").trim();
    const 正文 = String(输入.bodyTemplate || "").trim();
    if (!标题 || !正文) {
      throw new 应用错误("V3_MESSAGE_TEMPLATE_INVALID", "模板标题与正文不能为空。", 400);
    }
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const 当前结果 = await client.query<消息模板行>(
        `SELECT template_code, channel_code, event_code, category_code, priority_code,
                title_template, body_template, variables_json, status_code, version, updated_at
           FROM message.templates
          WHERE template_code = $1 AND status_code = 'published'
          FOR UPDATE`,
        [模板代码],
      );
      const 当前 = 当前结果.rows[0];
      if (!当前) throw new 应用错误("V3_MESSAGE_TEMPLATE_NOT_FOUND", "消息模板不存在。", 404);
      if (当前.version !== 输入.version) {
        throw new 应用错误(
          "V3_MESSAGE_TEMPLATE_VERSION_CONFLICT",
          "消息模板已被其他管理员更新，请刷新后重试。",
          409,
        );
      }
      const 变量清单 = 解析模板变量(当前.variables_json);
      校验模板引用(标题, 正文, 变量清单);
      const 更新结果 = await client.query<消息模板行>(
        `UPDATE message.templates
            SET title_template = $2,
                body_template = $3,
                version = version + 1,
                updated_at = now()
          WHERE template_code = $1 AND status_code = 'published'
          RETURNING template_code, channel_code, event_code, category_code, priority_code,
                    title_template, body_template, variables_json, status_code, version, updated_at`,
        [模板代码, 标题, 正文],
      );
      const 更新后 = 更新结果.rows[0];
      if (!更新后) throw new 应用错误("V3_MESSAGE_TEMPLATE_NOT_FOUND", "消息模板不存在。", 404);
      await this.写入审计(
        操作人,
        用户,
        "update_message_template",
        更新后.template_code,
        {
          before: { title: 当前.title_template, body: 当前.body_template, version: 当前.version },
          after: {
            title: 更新后.title_template,
            body: 更新后.body_template,
            version: 更新后.version,
          },
        },
        client,
        更新后.template_code,
      );
      await client.query("COMMIT");
      return 转换模板(更新后);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async 读取超级管理员(用户: 消息规则当前用户): Promise<{ id: string; username: string }> {
    const result = await this.pool.query<{ id: string; username: string }>(
      "SELECT id::text, username FROM iam.users WHERE lower(username) = lower($1) AND status_code = 'active' LIMIT 1",
      [用户.username],
    );
    if (!result.rows[0]) {
      throw new 应用错误("V3_MESSAGE_RULE_SUBJECT_INVALID", "当前超级管理员账号不可用。", 403);
    }
    return result.rows[0];
  }

  private async 校验指定用户有效(db: Pick<Pool, "query">, 用户编号: string[]): Promise<void> {
    const 去重编号 = [...new Set(用户编号)];
    if (去重编号.length === 0) return;
    const result = await db.query<{ id: string }>(
      `SELECT u.id::text AS id
         FROM iam.users u
        WHERE u.id::text = ANY($1::text[])
          AND u.status_code = 'active'
          AND ${有效内部提醒用户条件}`,
      [去重编号],
    );
    if (result.rows.length !== 去重编号.length) {
      throw new 应用错误(
        "V3_MESSAGE_RULE_RECIPIENT_UNAVAILABLE",
        "指定接收人中存在无效、已停用或不属于内部提醒范围的账号，请刷新候选列表后重试。",
        409,
      );
    }
  }

  private async 写入审计(
    操作人: { id: string; username: string },
    用户: 消息规则当前用户,
    动作: string,
    目标名称: string,
    内容: Record<string, unknown>,
    db: Pick<Pool, "query"> = this.pool,
    目标编号?: string,
  ): Promise<void> {
    await db.query(
      `INSERT INTO audit.audit_logs (
         created_at, request_id, actor_user_id, actor_username, actor_name, actor_role,
         module_code, action_code, target_type, target_id, target_name, result_code, message, after_json, extra_json
       ) VALUES (now(), $1, $2::uuid, $3, $3, 'superadmin', 'message_platform', $4,
                 'message_event_rule', $5, $6, 'success', '提醒规则平台操作', $7::jsonb, '{}'::jsonb)`,
      [
        用户.requestId,
        操作人.id,
        操作人.username,
        动作,
        目标编号 || null,
        目标名称,
        JSON.stringify(内容),
      ],
    );
  }
}

interface 事件规则行 {
  subscription_code: string;
  event_code: string;
  rule_name: string;
  reminder_type: "event";
  template_code: string;
  is_system: boolean;
  protection_level: 事件规则保护级别;
  status_code: 事件规则状态;
  rule_version: number;
  recipient_rule_json: {
    type?: string;
    scope?: { type?: "roles" | "users" | "org"; codes?: string[]; userIds?: string[] };
  };
  channel_codes: unknown;
  rule_updated_at: Date;
  updated_by: string | null;
}

interface 到期提醒规则行 {
  rule_code: string;
  reminder_code: "crm.registration.expiring" | "crm.opportunity.expected_close";
  aggregate_type: "registration" | "opportunity";
  rule_name: string;
  reminder_type: "expiry";
  template_code: string;
  data_source_code: string;
  is_system: boolean;
  protection_level: 事件规则保护级别;
  status_code: 事件规则状态;
  advance_days: number[];
  dispatch_time: string;
  workday_only: boolean;
  recipient_rule_json: { type?: string; scope?: Record<string, unknown> };
  channel_codes: unknown;
  digest_window_minutes: number;
  rule_version: number;
  rule_updated_at: Date;
  updated_by: string | null;
}

const _受管订阅代码 = new Set([
  "m1_order_approval_in_app",
  "m1_order_status_in_app",
  "m1_order_confirmed_in_app",
  "m1_registration_approved_in_app",
  "m1_registration_rejected_in_app",
  "m1_registration_approval_pending",
  "m1_account_approval_pending",
  "m1_partner_approval_pending",
  "m1_message_task_failure_in_app",
]);

const _受管到期提醒规则代码 = new Set([
  "m3_registration_expiring",
  "m3_opportunity_expected_close",
]);

const 受管模板代码 = new Set([
  "m1_order_approval_in_app",
  "m1_order_approval_wecom_app",
  "m1_order_approval_email",
  "m1_order_confirmed_in_app",
  "m1_order_confirmed_wecom_app",
  "m1_order_confirmed_email",
  "m1_order_event_in_app",
  "m1_order_event_wecom_app",
  "m1_order_event_email",
  "m1_registration_approved_in_app",
  "m1_registration_approved_wecom_app",
  "m1_registration_approved_email",
  "m1_registration_rejected_in_app",
  "m1_registration_rejected_wecom_app",
  "m1_registration_rejected_email",
  "m1_registration_approval_pending_in_app",
  "m1_registration_approval_pending_wecom_app",
  "m1_registration_approval_pending_email",
  "m1_account_approval_pending_in_app",
  "m1_account_approval_pending_wecom_app",
  "m1_account_approval_pending_email",
  "m1_partner_approval_pending_in_app",
  "m1_partner_approval_pending_wecom_app",
  "m1_partner_approval_pending_email",
  "m1_task_failure_in_app",
  "m3_registration_expiring_in_app",
  "m3_registration_expiring_wecom_app",
  "m3_registration_expiring_email",
  "m3_opportunity_expected_close_in_app",
  "m3_opportunity_expected_close_wecom_app",
  "m3_opportunity_expected_close_email",
]);

const 接收人规则名称: Record<string, string> = {
  order_current_approver: "当前审批人",
  business_owner: "当前业务负责人",
  registration_creator_and_owner: "报备创建人和当前负责人",
  registration_pending_approver: "报备待审批人（可配置范围）",
  platform_administrator: "全部平台管理员",
  roles: "按角色",
  users: "按指定用户",
  org: "按组织（部门）",
  region: "按区域",
  partners: "按渠道商",
};

const 查询规则字段语句 = `
  SELECT subscription.subscription_code, subscription.event_code, subscription.rule_name,
         subscription.reminder_type, subscription.template_code,
         COALESCE(catalog.is_system, false) AS is_system,
         subscription.rule_protection_code AS protection_level, subscription.status_code,
         subscription.rule_version, subscription.recipient_rule_json, subscription.channel_codes,
         subscription.rule_updated_at, actor.username::text AS updated_by
    FROM message.event_subscriptions subscription
    LEFT JOIN iam.users actor ON actor.id = subscription.updated_by_user_id
    LEFT JOIN message.reminder_templates catalog ON catalog.template_code = subscription.template_code
`;

const 查询规则语句 = `${查询规则字段语句}
   ORDER BY subscription.subscription_code`;

const 查询到期提醒规则字段语句 = `
  SELECT rule.rule_code, rule.reminder_code, rule.aggregate_type, rule.rule_name,
         rule.reminder_type, rule.template_code, rule.data_source_code,
         COALESCE(catalog.is_system, false) AS is_system,
         rule.rule_protection_code AS protection_level, rule.status_code, rule.advance_days,
         to_char(rule.dispatch_time, 'HH24:MI') AS dispatch_time, rule.workday_only,
         rule.recipient_rule_json, rule.channel_codes, rule.digest_window_minutes,
         rule.rule_version, rule.rule_updated_at, actor.username::text AS updated_by
    FROM message.reminder_rules rule
    LEFT JOIN iam.users actor ON actor.id = rule.updated_by_user_id
    LEFT JOIN message.reminder_templates catalog ON catalog.template_code = rule.template_code
`;

const 查询到期提醒规则语句 = `${查询到期提醒规则字段语句}
   ORDER BY rule.rule_code`;

const 查询任务模板字段语句 = `
  SELECT template_code, template_name, reminder_type, reminder_code, aggregate_type,
         data_source_code, event_code, category_code, priority_code,
         default_recipient_rule_json, default_channel_codes,
         default_advance_days, to_char(default_dispatch_time, 'HH24:MI') AS default_dispatch_time,
         default_workday_only, default_digest_window_minutes,
         variable_defs, title_template, body_template, is_system, status_code, description,
         updated_at
    FROM message.reminder_templates
`;

const 查询任务模板语句 = `${查询任务模板字段语句}
   WHERE status_code = 'active'
   ORDER BY reminder_type, template_code`;

interface 任务模板行 {
  template_code: string;
  template_name: string;
  reminder_type: 任务模板类型;
  reminder_code: string;
  aggregate_type: string | null;
  data_source_code: string | null;
  event_code: string | null;
  category_code: string;
  priority_code: string;
  default_recipient_rule_json: Record<string, unknown>;
  default_channel_codes: unknown;
  default_advance_days: number[];
  default_dispatch_time: string;
  default_workday_only: boolean;
  default_digest_window_minutes: number;
  variable_defs: unknown;
  title_template: string;
  body_template: string;
  is_system: boolean;
  status_code: string;
  description: string | null;
  updated_at: Date;
}

function 转换任务模板(row: 任务模板行): 平台任务模板 {
  return {
    templateCode: row.template_code,
    templateName: row.template_name,
    reminderType: row.reminder_type,
    reminderCode: row.reminder_code,
    aggregateType: row.aggregate_type,
    dataSourceCode: row.data_source_code,
    eventCode: row.event_code,
    categoryCode: row.category_code,
    priorityCode: row.priority_code,
    defaultRecipientRule: 解析接收人规则(row.default_recipient_rule_json),
    defaultChannelCodes: 校验通道集合(row.default_channel_codes),
    defaultAdvanceDays: [...(row.default_advance_days || [])].sort((a, b) => b - a),
    defaultDispatchTime: row.default_dispatch_time,
    defaultWorkdayOnly: row.default_workday_only,
    defaultDigestWindowMinutes: row.default_digest_window_minutes,
    variableDefs: 解析模板变量(row.variable_defs),
    titleTemplate: row.title_template,
    bodyTemplate: row.body_template,
    isSystem: row.is_system,
    statusCode: row.status_code,
    description: row.description || "",
    updatedAt: row.updated_at.toISOString(),
  };
}

function 生成任务代码(): string {
  return `t_${randomBytes(5).toString("hex")}`;
}

interface 归一化任务模板参数 {
  名称: string;
  类型: 任务模板类型;
  数据源代码: string | null;
  事件代码: string | null;
  类别: string;
  优先级: string;
  接收人: Record<string, unknown>;
  渠道: 规则渠道代码[];
  提前天数: number[];
  执行时间: string;
  仅工作日: boolean;
  汇总窗口: number;
  标题: string;
  正文: string;
  描述: string;
  变量: Array<{ name: string; label: string }>;
}

function 归一化任务模板输入(输入: 任务模板创建输入): 归一化任务模板参数 {
  const 名称 = String(输入.templateName ?? "").trim();
  if (!名称) throw new 应用错误("V3_MESSAGE_TASK_TEMPLATE_INVALID", "模板名称不能为空。", 400);
  if (输入.reminderType !== "expiry" && 输入.reminderType !== "event") {
    throw new 应用错误("V3_MESSAGE_TASK_TEMPLATE_INVALID", "提醒任务类型不合法。", 400);
  }
  const 类别 = String(输入.categoryCode ?? "").trim();
  const 优先级 = String(输入.priorityCode ?? "").trim();
  if (!["todo", "business", "system", "security"].includes(类别)) {
    throw new 应用错误("V3_MESSAGE_TASK_TEMPLATE_INVALID", "提醒类别不合法。", 400);
  }
  if (!["normal", "strong", "forced"].includes(优先级)) {
    throw new 应用错误("V3_MESSAGE_TASK_TEMPLATE_INVALID", "提醒优先级不合法。", 400);
  }
  let 数据源代码: string | null = null;
  let 事件代码: string | null = null;
  let 变量: Array<{ name: string; label: string }> = [];
  if (输入.reminderType === "expiry") {
    数据源代码 = String(输入.dataSourceCode ?? "").trim();
    const 数据源 = 查找到期数据源(数据源代码);
    if (!数据源)
      throw new 应用错误("V3_MESSAGE_TASK_TEMPLATE_INVALID", "到期数据源不在受控目录中。", 400);
    变量 = 数据源.variables;
  } else {
    事件代码 = String(输入.eventCode ?? "").trim();
    const 事件 = 查找事件(事件代码);
    if (!事件)
      throw new 应用错误("V3_MESSAGE_TASK_TEMPLATE_INVALID", "业务事件不在受控目录中。", 400);
    变量 = 事件.variables;
  }
  const 标题 = String(输入.titleTemplate ?? "").trim();
  const 正文 = String(输入.bodyTemplate ?? "").trim();
  if (!标题 || !正文)
    throw new 应用错误("V3_MESSAGE_TASK_TEMPLATE_INVALID", "模板标题与正文不能为空。", 400);
  const 执行时间 = String(输入.dispatchTime ?? "09:00").trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(执行时间)) {
    throw new 应用错误("V3_MESSAGE_TASK_TEMPLATE_INVALID", "执行时间格式应为 HH:MM。", 400);
  }
  return {
    名称,
    类型: 输入.reminderType,
    数据源代码,
    事件代码,
    类别,
    优先级,
    接收人: 校验接收人规则(输入.recipientRule ?? { type: "business_owner" }),
    渠道: 校验通道集合(输入.channelCodes ?? ["in_app"]),
    提前天数: 校验提前天数(输入.advanceDays ?? [30, 7, 1]),
    执行时间,
    仅工作日: typeof 输入.workdayOnly === "boolean" ? 输入.workdayOnly : true,
    汇总窗口: 校验汇总窗口(输入.digestWindowMinutes ?? 0),
    标题,
    正文,
    描述: String(输入.description ?? "").trim(),
    变量,
  };
}

function 解析接收人规则(value: unknown): 任务模板默认接收人 {
  const 规则 = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    type: typeof 规则.type === "string" && 规则.type ? 规则.type : "",
    scope:
      规则.scope && typeof 规则.scope === "object" ? (规则.scope as Record<string, unknown>) : {},
  };
}

function 校验接收人规则(输入: unknown): Record<string, unknown> {
  if (!输入 || typeof 输入 !== "object" || Array.isArray(输入)) {
    throw new 应用错误("V3_MESSAGE_RULE_SCOPE_INVALID", "接收人规则格式无效。", 400);
  }
  const 输入对象 = 输入 as Record<string, unknown>;
  const 类型 = String(输入对象.type || "");
  const 动态类型 = new Set([
    "business_owner",
    "order_current_approver",
    "registration_creator_and_owner",
    "registration_pending_approver",
    "platform_administrator",
  ]);
  if (动态类型.has(类型)) {
    return { type: 类型, scope: 输入对象.scope ?? {} };
  }
  const 范围 = (
    输入对象.scope && typeof 输入对象.scope === "object" ? 输入对象.scope : {}
  ) as Record<string, unknown>;
  if (类型 === "roles") {
    const 角色 = Array.isArray(输入对象.codes)
      ? 输入对象.codes
      : Array.isArray(范围.codes)
        ? 范围.codes
        : [];
    if (!角色.length || !角色.every((item) => typeof item === "string")) {
      throw new 应用错误("V3_MESSAGE_RULE_SCOPE_INVALID", "按角色范围必须选择至少一个角色。", 400);
    }
    return { type: "roles", scope: { type: "roles", codes: [...角色] } };
  }
  if (类型 === "users") {
    const 用户 = Array.isArray(输入对象.userIds)
      ? 输入对象.userIds
      : Array.isArray(范围.userIds)
        ? 范围.userIds
        : [];
    if (!用户.length || !用户.every((item) => typeof item === "string")) {
      throw new 应用错误(
        "V3_MESSAGE_RULE_SCOPE_INVALID",
        "指定用户范围必须选择至少一个用户。",
        400,
      );
    }
    return { type: "users", scope: { type: "users", userIds: [...用户] } };
  }
  if (类型 === "org") {
    const 组织 = Array.isArray(输入对象.codes)
      ? 输入对象.codes
      : Array.isArray(范围.codes)
        ? 范围.codes
        : [];
    if (!组织.length || !组织.every((item) => typeof item === "string")) {
      throw new 应用错误(
        "V3_MESSAGE_RULE_SCOPE_INVALID",
        "指定组织范围必须选择至少一个组织。",
        400,
      );
    }
    return { type: "org", scope: { type: "org", codes: [...组织] } };
  }
  if (类型 === "region") {
    const 区域 = Array.isArray(输入对象.codes)
      ? 输入对象.codes
      : Array.isArray(范围.codes)
        ? 范围.codes
        : [];
    if (!区域.length || !区域.every((item) => typeof item === "string")) {
      throw new 应用错误(
        "V3_MESSAGE_RULE_SCOPE_INVALID",
        "指定区域范围必须选择至少一个区域。",
        400,
      );
    }
    return { type: "region", scope: { type: "region", codes: [...区域] } };
  }
  if (类型 === "partners") {
    const 渠道商 = Array.isArray(输入对象.partnerIds)
      ? 输入对象.partnerIds
      : Array.isArray(范围.partnerIds)
        ? 范围.partnerIds
        : [];
    if (!渠道商.length || !渠道商.every((item) => typeof item === "string")) {
      throw new 应用错误(
        "V3_MESSAGE_RULE_SCOPE_INVALID",
        "指定渠道商范围必须选择至少一个渠道商。",
        400,
      );
    }
    return { type: "partners", scope: { type: "partners", partnerIds: [...渠道商] } };
  }
  throw new 应用错误("V3_MESSAGE_RULE_SCOPE_INVALID", "接收人规则类型不支持。", 400);
}

function 提取指定用户编号(输入: unknown): string[] {
  if (!输入 || typeof 输入 !== "object" || Array.isArray(输入)) return [];
  const 对象 = 输入 as Record<string, unknown>;
  const 范围 =
    对象.scope && typeof 对象.scope === "object" && !Array.isArray(对象.scope)
      ? (对象.scope as Record<string, unknown>)
      : 对象;
  return Array.isArray(范围.userIds)
    ? 范围.userIds.filter((编号): 编号 is string => typeof 编号 === "string")
    : [];
}

function 校验提前天数(value: unknown): number[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > 10 ||
    new Set(value).size !== value.length ||
    !value.every((day) => [1, 3, 7, 14, 30, 60, 90].includes(day as number))
  ) {
    throw new 应用错误(
      "V3_MESSAGE_REMINDER_RULE_INVALID",
      "到期提前天数只能从 1、3、7、14、30、60、90 中选择且不能重复。",
      400,
    );
  }
  return [...(value as number[])].sort((a, b) => b - a);
}

function 校验汇总窗口(value: unknown): number {
  if (value !== 0 && value !== 15 && value !== 60) {
    throw new 应用错误(
      "V3_MESSAGE_REMINDER_RULE_INVALID",
      "汇总窗口只能为即时、15 分钟或 60 分钟。",
      400,
    );
  }
  return value as number;
}

interface 模板查询执行器 {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Array<{ title_template: string | null; body_template: string | null }> }>;
}

async function 当前目录标题(templateCode: string, db: 模板查询执行器): Promise<string | null> {
  const result = await db.query(
    "SELECT title_template, body_template FROM message.reminder_templates WHERE template_code = $1",
    [templateCode],
  );
  return result.rows[0]?.title_template ?? null;
}

async function 当前目录正文(templateCode: string, db: 模板查询执行器): Promise<string | null> {
  const result = await db.query(
    "SELECT title_template, body_template FROM message.reminder_templates WHERE template_code = $1",
    [templateCode],
  );
  return result.rows[0]?.body_template ?? null;
}

function 转换规则(row: 事件规则行): 平台事件规则 {
  const 接收人类型 = row.recipient_rule_json.type || "";
  if (!接收人规则名称[接收人类型]) {
    throw new 应用错误("V3_MESSAGE_RULE_RECIPIENT_INVALID", "提醒规则接收人配置无效。", 500);
  }
  const 通道集合 = 校验通道集合(row.channel_codes);
  return {
    subscriptionCode: row.subscription_code,
    eventCode: row.event_code,
    ruleName: row.rule_name,
    reminderType: "event",
    templateCode: row.template_code,
    isSystem: row.is_system,
    protectionLevel: row.protection_level,
    statusCode: row.status_code,
    version: row.rule_version,
    recipientRule: {
      type: 接收人类型,
      label: 接收人规则名称[接收人类型],
      editable: row.protection_level !== "mandatory",
    },
    recipientScope: row.recipient_rule_json.scope ?? {},
    channelCodes: 通道集合,
    updatedAt: row.rule_updated_at.toISOString(),
    updatedBy: row.updated_by,
  };
}

function 审计规则快照(row: 事件规则行): Record<string, unknown> {
  return {
    subscriptionCode: row.subscription_code,
    statusCode: row.status_code,
    version: row.rule_version,
    protectionLevel: row.protection_level,
  };
}

function 转换到期提醒规则(row: 到期提醒规则行): 平台到期提醒规则 {
  const 接收人类型 = row.recipient_rule_json.type || "";
  if (!接收人规则名称[接收人类型] || !是受控汇总窗口(row.digest_window_minutes)) {
    throw new 应用错误("V3_MESSAGE_REMINDER_RULE_INVALID", "到期提醒规则配置无效。", 500);
  }
  return {
    ruleCode: row.rule_code,
    reminderCode: row.reminder_code,
    aggregateType: row.aggregate_type,
    ruleName: row.rule_name,
    reminderType: "expiry",
    templateCode: row.template_code,
    dataSourceCode: row.data_source_code,
    isSystem: row.is_system,
    protectionLevel: row.protection_level,
    statusCode: row.status_code,
    advanceDays: [...row.advance_days].sort((a, b) => b - a),
    dispatchTime: row.dispatch_time,
    workdayOnly: row.workday_only,
    recipientRule: {
      type: 接收人类型,
      label: 接收人规则名称[接收人类型],
      editable: row.protection_level !== "mandatory",
    },
    recipientScope: row.recipient_rule_json.scope ?? {},
    channelCodes: 校验通道集合(row.channel_codes),
    digestWindowMinutes: row.digest_window_minutes,
    version: row.rule_version,
    updatedAt: row.rule_updated_at.toISOString(),
    updatedBy: row.updated_by,
  };
}

function 审计到期提醒规则快照(row: 到期提醒规则行): Record<string, unknown> {
  return {
    ruleCode: row.rule_code,
    statusCode: row.status_code,
    advanceDays: row.advance_days,
    digestWindowMinutes: row.digest_window_minutes,
    version: row.rule_version,
  };
}

function _是受控提前天数(value: number[]): value is Array<1 | 7 | 30> {
  return (
    value.length > 0 &&
    value.length <= 3 &&
    new Set(value).size === value.length &&
    value.every((day) => day === 1 || day === 7 || day === 30)
  );
}

function 是受控汇总窗口(value: number): value is 0 | 15 | 60 {
  return value === 0 || value === 15 || value === 60;
}

function 校验通道集合(value: unknown): 规则渠道代码[] {
  const 允许 = new Set<规则渠道代码>(["in_app", "wecom", "wecom_app", "sms", "email"]);
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    !value.every((通道) => typeof 通道 === "string" && 允许.has(通道 as 规则渠道代码))
  ) {
    throw new 应用错误(
      "V3_MESSAGE_RULE_CHANNEL_INVALID",
      "提醒渠道仅支持站内、企微应用、企微群机器人、短信与邮件组合。",
      400,
    );
  }
  return [...new Set(value as string[])] as 规则渠道代码[];
}

function 校验接收人范围(
  输入: NonNullable<事件规则更新输入["recipientScope"]>,
): Record<string, unknown> {
  const 范围 = 输入;
  if (范围.type === "users") {
    if (!Array.isArray(范围.userIds) || 范围.userIds.length === 0) {
      throw new 应用错误(
        "V3_MESSAGE_RULE_SCOPE_INVALID",
        "指定用户范围必须选择至少一个用户。",
        400,
      );
    }
    return { type: "users", userIds: [...范围.userIds] };
  }
  if (范围.type === "org") {
    if (!Array.isArray(范围.codes) || 范围.codes.length === 0) {
      throw new 应用错误(
        "V3_MESSAGE_RULE_SCOPE_INVALID",
        "指定组织范围必须选择至少一个组织。",
        400,
      );
    }
    return { type: "org", codes: [...范围.codes] };
  }
  if (范围.type === "region") {
    if (!Array.isArray(范围.codes) || 范围.codes.length === 0) {
      throw new 应用错误(
        "V3_MESSAGE_RULE_SCOPE_INVALID",
        "指定区域范围必须选择至少一个区域。",
        400,
      );
    }
    return { type: "region", codes: [...范围.codes] };
  }
  if (范围.type === "partners") {
    if (!Array.isArray(范围.partnerIds) || 范围.partnerIds.length === 0) {
      throw new 应用错误(
        "V3_MESSAGE_RULE_SCOPE_INVALID",
        "指定渠道商范围必须选择至少一个渠道商。",
        400,
      );
    }
    return { type: "partners", partnerIds: [...范围.partnerIds] };
  }
  if (范围.type === "roles" || 范围.type === undefined) {
    const 角色 = Array.isArray(范围.codes) ? 范围.codes : [];
    const 用户 = Array.isArray(范围.userIds) ? 范围.userIds : [];
    if (!角色.every((角色代码) => typeof 角色代码 === "string")) {
      throw new 应用错误("V3_MESSAGE_RULE_SCOPE_INVALID", "角色范围格式无效。", 400);
    }
    if (!用户.every((用户编号) => typeof 用户编号 === "string")) {
      throw new 应用错误("V3_MESSAGE_RULE_SCOPE_INVALID", "指定用户范围格式无效。", 400);
    }
    if (角色.length === 0 && 用户.length === 0) {
      throw new 应用错误(
        "V3_MESSAGE_RULE_SCOPE_INVALID",
        "请至少选择一个提醒角色或指定用户。",
        400,
      );
    }
    return {
      type: "roles",
      codes: [...角色],
      ...(用户.length > 0 ? { userIds: [...用户] } : {}),
    };
  }
  throw new 应用错误("V3_MESSAGE_RULE_SCOPE_INVALID", "提醒范围类型不支持。", 400);
}

interface 消息模板行 {
  template_code: string;
  channel_code: 规则渠道代码;
  event_code: string;
  category_code: string;
  priority_code: string;
  title_template: string;
  body_template: string;
  variables_json: unknown;
  task_template_code: string;
  status_code: string;
  version: number;
  updated_at: Date;
}

function 转换模板(row: 消息模板行): 平台消息模板 {
  return {
    templateCode: row.template_code,
    channelCode: row.channel_code,
    eventCode: row.event_code,
    categoryCode: row.category_code,
    priorityCode: row.priority_code,
    titleTemplate: row.title_template,
    bodyTemplate: row.body_template,
    variables: 解析模板变量(row.variables_json),
    taskTemplateCode: row.task_template_code,
    statusCode: row.status_code,
    version: row.version,
    updatedAt: row.updated_at.toISOString(),
  };
}

function 解析模板变量(value: unknown): Array<{ name: string; label: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is { name: string; label?: string } =>
      Boolean(item && typeof item === "object"),
    )
    .map((item) => ({
      name: String(item.name || ""),
      label: String(item.label || item.name || ""),
    }))
    .filter((item) => /^[a-z][a-z0-9_]*$/.test(item.name));
}

const 允许函数名 = new Set(["days_left", "format_date"]);

function 校验模板引用(
  标题: string,
  正文: string,
  变量清单: Array<{ name: string; label: string }>,
): void {
  const 允许变量 = new Set(变量清单.map((item) => item.name));
  const 全文 = `${标题}\n${正文}`;
  const 变量引用 = [...全文.matchAll(/\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g)].map(
    (match) => match[1] ?? "",
  );
  const 函数调用 = [...全文.matchAll(/\{\{\s*([a-z][a-z0-9_]*)\s*\(/g)].map(
    (match) => match[1] ?? "",
  );
  for (const 变量 of 变量引用) {
    if (!允许变量.has(变量)) {
      throw new 应用错误(
        "V3_MESSAGE_TEMPLATE_VARIABLE_INVALID",
        `模板引用了不支持的变量：${变量}`,
        400,
      );
    }
  }
  for (const 函数 of 函数调用) {
    if (!允许函数名.has(函数)) {
      throw new 应用错误(
        "V3_MESSAGE_TEMPLATE_FUNCTION_INVALID",
        `模板引用了不支持的函数：${函数}`,
        400,
      );
    }
  }
}
