import type { 应用配置 } from "@lianruan/config";
import type { 日志器 } from "@lianruan/shared";
import { Pool, type PoolClient } from "pg";

export const 组织离职交接单批最大数量 = 200;
export const 组织离职交接最大重试次数 = 8;
export const 组织离职交接未结束订单状态 = [
  "draft",
  "pending_primary_confirm",
  "primary_confirmed",
  "pending_superadmin_confirm",
  "confirmed",
  "processing",
  "shipped",
] as const;

interface 待处理事件 {
  id: string;
  handoverId: string;
  retryCount: number;
  leaseToken: string;
}

interface 交接单 {
  id: string;
  userId: string;
  replacementUserId: string | null;
  statusCode: string;
  createdByUserId: string;
  targetRoleCodes: string[];
  targetRegionId: string | null;
}

interface 业务交接规则 {
  domainCode: "customer" | "registration" | "opportunity" | "quote" | "order";
  tableName: string;
  statusCondition: string;
  hasRowVersion: boolean;
}

const 业务交接规则列表: 业务交接规则[] = [
  {
    domainCode: "customer",
    tableName: "crm.customers",
    statusCondition: "status_code='active'",
    hasRowVersion: false,
  },
  {
    domainCode: "registration",
    tableName: "crm.registrations",
    statusCondition: "status_code IN ('draft','pending','approved')",
    hasRowVersion: true,
  },
  {
    domainCode: "opportunity",
    tableName: "crm.opportunities",
    statusCondition: "status_code='active'",
    hasRowVersion: true,
  },
  {
    domainCode: "quote",
    tableName: "crm.quotes",
    statusCondition: "status_code IN ('draft','submitted','approved')",
    hasRowVersion: true,
  },
  {
    domainCode: "order",
    tableName: "crm.orders",
    statusCondition: `status_code IN (${组织离职交接未结束订单状态.map((状态) => `'${状态}'`).join(",")})`,
    hasRowVersion: true,
  },
];

export class 组织离职交接任务存储 {
  private readonly 数据库连接池: Pool;

  public constructor(databaseUrl: string) {
    this.数据库连接池 = new Pool({ connectionString: databaseUrl, max: 2 });
  }

  public async 处理下一事件(): Promise<boolean> {
    const 事件 = await this.领取事件();
    if (!事件) return false;
    try {
      const 已完成 = await this.执行交接批次(事件.handoverId);
      await this.完成事件(事件, 已完成);
      return true;
    } catch (error) {
      await this.记录事件失败(事件, error);
      return true;
    }
  }

  public async 关闭(): Promise<void> {
    await this.数据库连接池.end();
  }

  private async 领取事件(): Promise<待处理事件 | null> {
    const db = await this.数据库连接池.connect();
    try {
      await db.query("BEGIN");
      const 结果 = await db.query<待处理事件>(
        `WITH candidate AS (
           SELECT id
           FROM ops.outbox_events
           WHERE event_type='org.offboarding.scan_requested'
             AND (
               status_code='pending'
               OR (status_code='failed' AND next_retry_at IS NOT NULL AND next_retry_at<=now())
               OR (status_code='processing' AND next_retry_at IS NOT NULL AND next_retry_at<=now())
             )
           ORDER BY created_at,id
           FOR UPDATE SKIP LOCKED
           LIMIT 1
         )
         UPDATE ops.outbox_events event
         SET status_code='processing',next_retry_at=now()+interval '5 minutes',
             payload_json=event.payload_json || jsonb_build_object('leaseToken',gen_random_uuid()::text)
         FROM candidate
         WHERE event.id=candidate.id
         RETURNING event.id::text AS id,event.aggregate_id::text AS "handoverId",
                   event.retry_count AS "retryCount",event.payload_json->>'leaseToken' AS "leaseToken"`,
      );
      await db.query("COMMIT");
      return 结果.rows[0] || null;
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    } finally {
      db.release();
    }
  }

  private async 执行交接批次(handoverId: string): Promise<boolean> {
    const db = await this.数据库连接池.connect();
    try {
      await db.query("BEGIN");
      const 交接单 = await this.读取交接单(db, handoverId);
      if (["completed", "closed", "cancelled"].includes(交接单.statusCode)) {
        await db.query("COMMIT");
        return true;
      }
      await this.校验接收人(db, 交接单);
      await db.query(
        "UPDATE org.offboarding_handover SET status_code='transferring',row_version=row_version+1 WHERE id=$1::uuid AND status_code<>'transferring'",
        [handoverId],
      );

      let 剩余容量 = 组织离职交接单批最大数量;
      for (const 规则 of 业务交接规则列表) {
        if (剩余容量 <= 0) break;
        剩余容量 -= await this.转移业务对象(db, 交接单, 规则, 剩余容量);
      }
      const 尚有待处理 = await this.查询是否仍有待处理(db, 交接单);
      if (!尚有待处理) {
        await db.query(
          "UPDATE org.offboarding_handover SET status_code='completed',scan_completed_at=now(),row_version=row_version+1 WHERE id=$1::uuid",
          [handoverId],
        );
        await db.query(
          "UPDATE iam.users SET offboarding_status='offboarded',updated_at=now(),row_version=row_version+1 WHERE id=$1::uuid AND status_code='disabled'",
          [交接单.userId],
        );
        await this.写入完成审计(db, 交接单);
      }
      await db.query("COMMIT");
      return !尚有待处理;
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    } finally {
      db.release();
    }
  }

  private async 读取交接单(db: PoolClient, handoverId: string): Promise<交接单> {
    const 结果 = await db.query<交接单>(
      `SELECT id::text AS id,user_id::text AS "userId",replacement_user_id::text AS "replacementUserId",
              status_code AS "statusCode",created_by_user_id::text AS "createdByUserId",
              target_role_codes AS "targetRoleCodes",target_region_id::text AS "targetRegionId"
       FROM org.offboarding_handover WHERE id=$1::uuid FOR UPDATE`,
      [handoverId],
    );
    if (!结果.rows[0]) throw new Error("离职交接单不存在。");
    return 结果.rows[0];
  }

  private async 校验接收人(db: PoolClient, 交接单: 交接单): Promise<void> {
    const 待处理 = await this.查询是否仍有待处理(db, 交接单);
    const 需要保持管理覆盖 = 交接单.targetRoleCodes.some((角色) =>
      ["superadmin", "admin", "region_manager"].includes(角色),
    );
    if (!待处理 && !需要保持管理覆盖) return;
    if (!交接单.replacementUserId) throw new Error("离职交接缺少接收人。");
    const 结果 = await db.query<{ roleCodes: string[]; regionId: string | null }>(
      `SELECT
         COALESCE(角色.role_codes,ARRAY[]::text[]) AS "roleCodes",
         COALESCE(用户.region_id,主任职.region_id)::text AS "regionId"
       FROM iam.users 用户
       LEFT JOIN LATERAL (
         SELECT 组织.region_id
         FROM org.staff_assignments 任职
         JOIN org.org_units 组织 ON 组织.id=任职.org_unit_id
         WHERE 任职.user_id=用户.id AND 任职.expired_at IS NULL
         ORDER BY 任职.is_primary DESC,任职.effective_at DESC
         LIMIT 1
       ) 主任职 ON true
       LEFT JOIN LATERAL (
         SELECT array_agg(系统角色.role_code ORDER BY 系统角色.role_code) AS role_codes
         FROM iam.user_roles 用户角色
         JOIN iam.roles 系统角色
           ON 系统角色.id=用户角色.role_id AND 系统角色.status_code='active'
         WHERE 用户角色.user_id=用户.id
       ) 角色 ON true
       WHERE 用户.id=$1::uuid
         AND 用户.status_code='active'
         AND 用户.offboarding_status IN ('active','reactivated')
       FOR UPDATE OF 用户`,
      [交接单.replacementUserId],
    );
    const 接收人 = 结果.rows[0];
    if (!接收人) throw new Error("离职交接接收人已不可用。");
    if (!交接单.targetRoleCodes.length)
      throw new Error("离职交接缺少目标账号角色快照，请由管理员重新发起或人工处理。");
    const 目标为超级管理员 = 交接单.targetRoleCodes.includes("superadmin");
    const 接收人为超级管理员 = 接收人.roleCodes.includes("superadmin");
    const 接收人为区域管理员 = 接收人.roleCodes.some((角色) =>
      ["admin", "region_manager"].includes(角色),
    );
    const 符合资格 = 目标为超级管理员
      ? 接收人为超级管理员
      : 接收人为超级管理员 ||
        (Boolean(交接单.targetRegionId) &&
          接收人为区域管理员 &&
          接收人.regionId === 交接单.targetRegionId);
    if (!符合资格) throw new Error("离职交接接收人的角色或区域已变化，请重新指定接收人。");
  }

  private async 转移业务对象(
    db: PoolClient,
    交接单: 交接单,
    规则: 业务交接规则,
    limit: number,
  ): Promise<number> {
    if (!交接单.replacementUserId) return 0;
    const 目标 = await db.query<{ id: string }>(
      `SELECT id::text AS id
       FROM ${规则.tableName}
       WHERE owner_user_id=$1::uuid AND ${规则.statusCondition}
       ORDER BY id
       FOR UPDATE SKIP LOCKED
       LIMIT $2`,
      [交接单.userId, limit],
    );
    const ids = 目标.rows.map((item) => item.id);
    if (!ids.length) return 0;
    await db.query(
      `INSERT INTO org.offboarding_handover_items(
         handover_id,domain_code,object_id,status_code,transfer_strategy,
         actual_recipient_user_id,detail_json,scanned_at
       )
       SELECT $1::uuid,$2,object_id,'pending','transfer',$3::uuid,
              jsonb_build_object('previousOwnerUserId',$4::text),now()
       FROM unnest($5::uuid[]) AS object_id
       ON CONFLICT (handover_id,domain_code,object_id) DO NOTHING`,
      [交接单.id, 规则.domainCode, 交接单.replacementUserId, 交接单.userId, ids],
    );
    const 更新结果 = await db.query<{ id: string }>(
      `UPDATE ${规则.tableName}
       SET owner_user_id=$1::uuid,updated_at=now(),
           ${规则.hasRowVersion ? "row_version=row_version+1," : ""}
           extra_json=COALESCE(extra_json,'{}'::jsonb) || jsonb_build_object(
             'offboardingPreviousOwnerUserId',$2::text,
             'offboardingHandoverId',$3::text,
             'offboardingTransferredAt',now()
           )
       WHERE id=ANY($4::uuid[]) AND owner_user_id=$2::uuid
       RETURNING id::text AS id`,
      [交接单.replacementUserId, 交接单.userId, 交接单.id, ids],
    );
    const 已更新编号 = 更新结果.rows.map((item) => item.id);
    if (已更新编号.length !== ids.length)
      throw new Error(`离职交接更新${规则.domainCode}负责人时发生并发变化，已回滚本批次，请重试。`);
    await db.query(
      `UPDATE org.offboarding_handover_items
       SET status_code='completed',actual_recipient_user_id=$1::uuid,
           detail_json=detail_json || jsonb_build_object('transferredAt',now()),
           row_version=row_version+1,updated_at=now()
       WHERE handover_id=$2::uuid AND domain_code=$3 AND object_id=ANY($4::uuid[])`,
      [交接单.replacementUserId, 交接单.id, 规则.domainCode, 已更新编号],
    );
    await this.写入领域转移审计(db, 交接单, 规则.domainCode, 已更新编号);
    return 已更新编号.length;
  }

  private async 查询是否仍有待处理(db: PoolClient, 交接单: 交接单): Promise<boolean> {
    const 结果 = await db.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM (
         SELECT id FROM crm.customers WHERE owner_user_id=$1::uuid AND status_code='active'
         UNION ALL SELECT id FROM crm.registrations WHERE owner_user_id=$1::uuid AND status_code IN ('draft','pending','approved')
         UNION ALL SELECT id FROM crm.opportunities WHERE owner_user_id=$1::uuid AND status_code='active'
         UNION ALL SELECT id FROM crm.quotes WHERE owner_user_id=$1::uuid AND status_code IN ('draft','submitted','approved')
         UNION ALL SELECT id FROM crm.orders WHERE owner_user_id=$1::uuid
           AND status_code IN (${组织离职交接未结束订单状态.map((状态) => `'${状态}'`).join(",")})
       ) remaining`,
      [交接单.userId],
    );
    return Number(结果.rows[0]?.count || 0) > 0;
  }

  private async 写入完成审计(db: PoolClient, 交接单: 交接单): Promise<void> {
    const 统计 = await db.query(
      `SELECT domain_code AS "domainCode",count(*)::int AS count
       FROM org.offboarding_handover_items WHERE handover_id=$1::uuid GROUP BY domain_code ORDER BY domain_code`,
      [交接单.id],
    );
    await db.query(
      `INSERT INTO audit.audit_logs(
         created_at,request_id,actor_user_id,actor_username,actor_name,actor_role,module_code,action_code,
         target_type,target_id,result_code,message,after_json,extra_json
       ) VALUES(now(),$1,NULL,'system','组织交接任务','system','organization','offboarding.completed',
                'offboarding_handover',$2,'success','账号停用归档与业务交接完成',$3::jsonb,$4::jsonb)`,
      [
        `org-offboarding-worker:${交接单.id}`,
        交接单.id,
        JSON.stringify({ items: 统计.rows }),
        JSON.stringify({ initiatedByUserId: 交接单.createdByUserId }),
      ],
    );
  }

  private async 写入领域转移审计(
    db: PoolClient,
    交接单: 交接单,
    domainCode: string,
    objectIds: string[],
  ): Promise<void> {
    await db.query(
      `INSERT INTO audit.audit_logs(
         created_at,request_id,actor_user_id,actor_username,actor_name,actor_role,module_code,action_code,
         target_type,target_id,result_code,message,before_json,after_json,extra_json
       ) VALUES(now(),$1,NULL,'system','组织交接任务','system','organization','offboarding.owner_transferred',
                $2,$3,'success','离职交接批次已转移业务负责人',$4::jsonb,$5::jsonb,$6::jsonb)`,
      [
        `org-offboarding-worker:${交接单.id}`,
        domainCode,
        交接单.id,
        JSON.stringify({ ownerUserId: 交接单.userId }),
        JSON.stringify({ ownerUserId: 交接单.replacementUserId, count: objectIds.length }),
        JSON.stringify({ objectIds, initiatedByUserId: 交接单.createdByUserId }),
      ],
    );
  }

  private async 完成事件(事件: 待处理事件, completed: boolean): Promise<void> {
    await this.数据库连接池.query(
      `UPDATE ops.outbox_events
       SET status_code=$2,next_retry_at=CASE WHEN $2='pending' THEN now() ELSE NULL END
       WHERE id=$1::uuid AND status_code='processing' AND payload_json->>'leaseToken'=$3`,
      [事件.id, completed ? "sent" : "pending", 事件.leaseToken],
    );
  }

  private async 记录事件失败(事件: 待处理事件, error: unknown): Promise<void> {
    const 摘要 = error instanceof Error ? error.message.slice(0, 300) : "交接任务失败，原因未知。";
    const 本次重试次数 = 事件.retryCount + 1;
    const 进入人工处理 = 本次重试次数 >= 组织离职交接最大重试次数;
    const 退避秒数 = Math.min(300, 2 ** Math.min(本次重试次数, 8));
    const db = await this.数据库连接池.connect();
    try {
      await db.query("BEGIN");
      const 更新 = await db.query(
        `UPDATE ops.outbox_events
         SET status_code='failed',retry_count=retry_count+1,
             next_retry_at=CASE WHEN $2::boolean THEN NULL ELSE now()+make_interval(secs=>$3) END,
             payload_json=payload_json || jsonb_build_object(
               'lastError',$4::text,'lastFailedAt',now(),'manualActionRequired',$2::boolean,
               'deadLetteredAt',CASE WHEN $2::boolean THEN now() ELSE NULL END
             )
         WHERE id=$1::uuid AND status_code='processing' AND payload_json->>'leaseToken'=$5
         RETURNING id`,
        [事件.id, 进入人工处理, 退避秒数, 摘要, 事件.leaseToken],
      );
      if (更新.rows[0] && 进入人工处理) {
        await db.query(
          `UPDATE org.offboarding_handover
           SET status_code='partial_failed',row_version=row_version+1
           WHERE id=$1::uuid AND status_code NOT IN ('completed','closed','cancelled')`,
          [事件.handoverId],
        );
        await db.query(
          `INSERT INTO audit.audit_logs(
             created_at,request_id,actor_user_id,actor_username,actor_name,actor_role,module_code,
             action_code,target_type,target_id,result_code,message,after_json,extra_json
           ) VALUES(now(),$1,NULL,'system','组织交接任务','system','organization',
                    'offboarding.transfer_failed','offboarding_handover',$2,'failed',
                    '离职交接达到最大重试次数，已转人工处理',$3::jsonb,$4::jsonb)`,
          [
            `org-offboarding-worker:${事件.handoverId}`,
            事件.handoverId,
            JSON.stringify({ retryCount: 本次重试次数, errorSummary: 摘要 }),
            JSON.stringify({ outboxEventId: 事件.id }),
          ],
        );
      }
      await db.query("COMMIT");
    } catch (记录错误) {
      await db.query("ROLLBACK");
      throw 记录错误;
    } finally {
      db.release();
    }
  }
}

export interface 组织离职交接任务服务 {
  enabled: boolean;
  close(): Promise<void>;
}

export async function 启动组织离职交接任务服务(
  config: 应用配置,
  logger: 日志器,
): Promise<组织离职交接任务服务> {
  if (!config.organization.offboardingEnabled) {
    logger.info("组织离职交接任务保持关闭", { event: "worker.organization_offboarding.disabled" });
    return { enabled: false, close: async () => undefined };
  }
  if (!config.database.url) throw new Error("组织离职交接任务启动失败：未配置 DATABASE_URL。");
  const 存储 = new 组织离职交接任务存储(config.database.url);
  let 正在执行 = false;
  const 执行 = async () => {
    if (正在执行) return;
    正在执行 = true;
    try {
      while (await 存储.处理下一事件()) {
        // 单次唤醒持续清空当前可领取事件；每项内部仍限制为小批量短事务。
      }
    } catch (error) {
      logger.error("组织离职交接任务轮询失败", {
        event: "worker.organization_offboarding.poll_failed",
        errorMessage: error instanceof Error ? error.message : "原因未知",
      });
    } finally {
      正在执行 = false;
    }
  };
  const 定时器 = setInterval(() => void 执行(), config.organization.offboardingPollIntervalMs);
  void 执行();
  logger.info("组织离职交接任务已启动", {
    event: "worker.organization_offboarding.started",
    pollIntervalMs: config.organization.offboardingPollIntervalMs,
  });
  return {
    enabled: true,
    close: async () => {
      clearInterval(定时器);
      await 存储.关闭();
    },
  };
}
