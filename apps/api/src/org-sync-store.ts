import { 应用错误 } from "@lianruan/shared";
import { Pool } from "pg";

import {
  type 企业微信连接器摘要,
  type 企业微信连接测试结果,
  type 企业微信通讯录适配器,
  未配置企业微信通讯录适配器,
} from "./wecom-directory-adapter.js";

export interface 目录同步操作人 {
  username: string;
  requestId: string;
}

export interface 目录同步批次筛选 {
  page: number;
  pageSize: number;
}

export interface 目录同步差异筛选 extends 目录同步批次筛选 {
  runId?: string;
  riskLevel?: "low" | "medium" | "high";
  approvalStatus?: "pending" | "approved" | "rejected";
}

export interface 目录同步数据服务 {
  查询状态(): Promise<unknown>;
  测试连接(操作人: 目录同步操作人, connectorId?: string): Promise<企业微信连接测试结果>;
  创建只读预览(操作人: 目录同步操作人, connectorId?: string): Promise<unknown>;
  查询批次(筛选: 目录同步批次筛选): Promise<unknown>;
  查询批次详情(id: string): Promise<unknown>;
  查询差异(筛选: 目录同步差异筛选): Promise<unknown>;
}

export function 创建目录同步数据服务(参数: {
  databaseUrl?: string;
  adapter?: 企业微信通讯录适配器;
}): 目录同步数据服务 {
  if (!参数.databaseUrl) return new 未配置目录同步数据服务();
  return new PostgreSQL目录同步数据服务(
    new Pool({ connectionString: 参数.databaseUrl }),
    参数.adapter || new 未配置企业微信通讯录适配器(),
  );
}

class 未配置目录同步数据服务 implements 目录同步数据服务 {
  private 不可用(): never {
    throw new 应用错误("DIRECTORY_SYNC_DATABASE_UNAVAILABLE", "组织同步数据库尚未配置。", 503);
  }

  查询状态(): Promise<unknown> {
    return Promise.reject(this.不可用());
  }
  测试连接(): Promise<企业微信连接测试结果> {
    return Promise.reject(this.不可用());
  }
  创建只读预览(): Promise<unknown> {
    return Promise.reject(this.不可用());
  }
  查询批次(): Promise<unknown> {
    return Promise.reject(this.不可用());
  }
  查询批次详情(): Promise<unknown> {
    return Promise.reject(this.不可用());
  }
  查询差异(): Promise<unknown> {
    return Promise.reject(this.不可用());
  }
}

class PostgreSQL目录同步数据服务 implements 目录同步数据服务 {
  public constructor(
    private readonly pool: Pool,
    private readonly adapter: 企业微信通讯录适配器,
  ) {}

  async 查询状态(): Promise<unknown> {
    const 连接器 = await this.pool.query<连接器行>(
      `SELECT id::text, corp_id, agent_id, status_code, config_version,
              visible_scope_summary, updated_at
         FROM integration.directory_connectors
        ORDER BY updated_at DESC`,
    );
    const 最近批次 = await this.pool.query<批次行>(
      `SELECT id::text, connector_id::text, run_type, status_code, statistics_json, created_at, completed_at
         FROM integration.directory_sync_runs
        ORDER BY created_at DESC LIMIT 1`,
    );
    const latestRun = 最近批次.rows[0];
    return {
      connectors: 连接器.rows.map(转换连接器公开信息),
      latestRun: latestRun ? 转换批次(latestRun) : null,
      applyEnabled: false,
      mode: "readonly_preview",
    };
  }

  async 测试连接(操作人: 目录同步操作人, connectorId?: string): Promise<企业微信连接测试结果> {
    const 连接器 = await this.读取连接器(connectorId);
    const 开始时间 = Date.now();
    const 结果 = await this.adapter.测试连接(连接器);
    const 输出 = { ...结果, elapsedMs: Math.max(结果.elapsedMs, Date.now() - 开始时间) };
    await this.写入审计(操作人, "test_connection", 连接器.id, 输出);
    return 输出;
  }

  /**
   * 本阶段只创建 integration 域的预览批次和审计记录。
   * 绝不访问 org、iam、channel、crm 表，也不创建应用任务。
   */
  async 创建只读预览(操作人: 目录同步操作人, connectorId?: string): Promise<unknown> {
    const db = await this.pool.connect();
    try {
      await db.query("BEGIN");
      const 操作人编号 = await this.读取操作人编号(db, 操作人.username);
      const 连接器 = await this.读取连接器(connectorId, db);
      if (连接器.statusCode !== "readonly") {
        throw new 应用错误(
          "DIRECTORY_SYNC_READONLY_REQUIRED",
          "连接器必须处于只读连接状态后才能创建预览。",
          409,
        );
      }
      const result = await db.query<批次行>(
        `INSERT INTO integration.directory_sync_runs (
           connector_id, run_type, status_code, source_snapshot, statistics_json, created_by_user_id,
           started_at, completed_at
         ) VALUES ($1::uuid, 'preview', 'previewed',
           jsonb_build_object('mode', 'readonly_preview', 'connectorConfigVersion', $2::bigint),
           jsonb_build_object('departmentCount', 0, 'memberCount', 0, 'changeCount', 0),
           $3::uuid, now(), now())
         RETURNING id::text, connector_id::text, run_type, status_code, statistics_json, created_at, completed_at`,
        [连接器.id, 连接器.configVersion, 操作人编号],
      );
      const 预览行 = result.rows[0];
      if (!预览行)
        throw new 应用错误("DIRECTORY_SYNC_PREVIEW_CREATE_FAILED", "只读预览批次创建失败。", 500);
      const 批次 = 转换批次(预览行);
      await this.写入审计(操作人, "preview_created", 批次.id, 批次, db, 操作人编号);
      await db.query("COMMIT");
      return { ...批次, writeScope: "integration_only", applyEnabled: false };
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    } finally {
      db.release();
    }
  }

  async 查询批次(筛选: 目录同步批次筛选): Promise<unknown> {
    const offset = (筛选.page - 1) * 筛选.pageSize;
    const [总数, 结果] = await Promise.all([
      this.pool.query<{ total: string }>(
        "SELECT count(*)::text AS total FROM integration.directory_sync_runs",
      ),
      this.pool.query<批次行>(
        `SELECT id::text, connector_id::text, run_type, status_code, statistics_json, created_at, completed_at
           FROM integration.directory_sync_runs
          ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        [筛选.pageSize, offset],
      ),
    ]);
    return {
      items: 结果.rows.map(转换批次),
      page: 筛选.page,
      pageSize: 筛选.pageSize,
      total: Number(总数.rows[0]?.total || 0),
    };
  }

  async 查询批次详情(id: string): Promise<unknown> {
    const 结果 = await this.pool.query<批次行 & { error_summary: string | null }>(
      `SELECT id::text, connector_id::text, run_type, status_code, statistics_json, created_at, completed_at, error_summary
         FROM integration.directory_sync_runs WHERE id = $1::uuid`,
      [id],
    );
    if (!结果.rows[0])
      throw new 应用错误("DIRECTORY_SYNC_RUN_NOT_FOUND", "同步预览批次不存在。", 404);
    return 转换批次(结果.rows[0]);
  }

  async 查询差异(筛选: 目录同步差异筛选): Promise<unknown> {
    const conditions: string[] = ["true"];
    const values: unknown[] = [];
    const 参数 = (value: unknown) => {
      values.push(value);
      return `$${values.length}`;
    };
    if (筛选.runId) conditions.push(`run_id = ${参数(筛选.runId)}::uuid`);
    if (筛选.riskLevel) conditions.push(`risk_level = ${参数(筛选.riskLevel)}`);
    if (筛选.approvalStatus) conditions.push(`approval_status = ${参数(筛选.approvalStatus)}`);
    const offset = (筛选.page - 1) * 筛选.pageSize;
    const where = conditions.join(" AND ");
    const 筛选参数 = [...values];
    const 分页参数 = [筛选.pageSize, offset];
    const [总数, 结果] = await Promise.all([
      this.pool.query<{ total: string }>(
        `SELECT count(*)::text AS total FROM integration.directory_sync_changes WHERE ${where}`,
        筛选参数,
      ),
      this.pool.query<差异行>(
        `SELECT id::text, run_id::text, object_type, external_id, change_type, risk_level,
                approval_status, apply_status, row_version, before_json, after_json
           FROM integration.directory_sync_changes WHERE ${where}
          ORDER BY id LIMIT $${筛选参数.length + 1} OFFSET $${筛选参数.length + 2}`,
        [...筛选参数, ...分页参数],
      ),
    ]);
    return {
      items: 结果.rows.map(转换差异),
      page: 筛选.page,
      pageSize: 筛选.pageSize,
      total: Number(总数.rows[0]?.total || 0),
    };
  }

  private async 读取连接器(
    connectorId?: string,
    db: Pick<Pool, "query"> = this.pool,
  ): Promise<内部连接器> {
    const result = await db.query<连接器行>(
      `SELECT id::text, corp_id, agent_id, status_code, config_version, visible_scope_summary, updated_at
         FROM integration.directory_connectors
        WHERE ($1::uuid IS NULL OR id = $1::uuid)
        ORDER BY updated_at DESC LIMIT 1`,
      [connectorId || null],
    );
    const row = result.rows[0];
    if (!row)
      throw new 应用错误(
        "DIRECTORY_SYNC_CONNECTOR_NOT_FOUND",
        "未找到企业微信组织同步连接器。",
        404,
      );
    return {
      id: row.id,
      corpId: row.corp_id,
      agentId: row.agent_id,
      statusCode: row.status_code,
      configVersion: row.config_version,
    };
  }

  private async 读取操作人编号(db: Pick<Pool, "query">, username: string): Promise<string> {
    const result = await db.query<{ id: string }>(
      "SELECT id::text FROM iam.users WHERE lower(username) = lower($1) AND status_code = 'active' LIMIT 1",
      [username],
    );
    if (!result.rows[0])
      throw new 应用错误("DIRECTORY_SYNC_SUBJECT_INVALID", "当前超级管理员账号不可用。", 403);
    return result.rows[0].id;
  }

  private async 写入审计(
    操作人: 目录同步操作人,
    action: string,
    targetId: string,
    after: unknown,
    db: Pick<Pool, "query"> = this.pool,
    actorUserId?: string,
  ): Promise<void> {
    const 用户编号 = actorUserId || (await this.读取操作人编号(db, 操作人.username));
    await db.query(
      `INSERT INTO audit.audit_logs (
         created_at, request_id, actor_user_id, actor_username, actor_name, actor_role,
         module_code, action_code, target_type, target_id, result_code, message, after_json, extra_json
       ) VALUES (now(), $1, $2::uuid, $3, $3, 'superadmin', 'directory_sync', $4,
                 'directory_sync', $5, 'success', '企微组织同步只读操作', $6::jsonb, '{}'::jsonb)`,
      [操作人.requestId, 用户编号, 操作人.username, action, targetId, JSON.stringify(after)],
    );
  }
}

interface 连接器行 {
  id: string;
  corp_id: string;
  agent_id: string;
  status_code: "disabled" | "readonly" | "enabled" | "degraded";
  config_version: number;
  visible_scope_summary: Record<string, unknown>;
  updated_at: Date;
}

interface 批次行 {
  id: string;
  connector_id: string;
  run_type: string;
  status_code: string;
  statistics_json: Record<string, unknown>;
  created_at: Date;
  completed_at: Date | null;
}

interface 差异行 {
  id: string;
  run_id: string;
  object_type: string;
  external_id: string;
  change_type: string;
  risk_level: string;
  approval_status: string;
  apply_status: string;
  row_version: number;
  before_json: Record<string, unknown>;
  after_json: Record<string, unknown>;
}

interface 内部连接器 extends 企业微信连接器摘要 {
  configVersion: number;
}

function 转换连接器公开信息(row: 连接器行) {
  return {
    id: row.id,
    corpId: 掩码企业编号(row.corp_id),
    agentId: 掩码应用编号(row.agent_id),
    statusCode: row.status_code,
    configVersion: row.config_version,
    visibleScopeSummary: row.visible_scope_summary,
    updatedAt: row.updated_at.toISOString(),
  };
}

function 转换批次(row: 批次行 & { error_summary?: string | null }) {
  return {
    id: row.id,
    connectorId: row.connector_id,
    runType: row.run_type,
    statusCode: row.status_code,
    statistics: row.statistics_json,
    createdAt: row.created_at.toISOString(),
    completedAt: row.completed_at?.toISOString() || null,
    ...(row.error_summary ? { errorSummary: row.error_summary } : {}),
  };
}

function 转换差异(row: 差异行) {
  return {
    id: row.id,
    runId: row.run_id,
    objectType: row.object_type,
    externalId: row.external_id,
    changeType: row.change_type,
    riskLevel: row.risk_level,
    approvalStatus: row.approval_status,
    applyStatus: row.apply_status,
    rowVersion: row.row_version,
    before: row.before_json,
    after: row.after_json,
  };
}

function 掩码企业编号(value: string): string {
  return value.length <= 4 ? "****" : `${value.slice(0, 2)}****${value.slice(-2)}`;
}

function 掩码应用编号(value: string): string {
  return value.length <= 2 ? "**" : `${value.slice(0, 1)}***${value.slice(-1)}`;
}
