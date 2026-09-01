import crypto from "node:crypto";

import { 应用错误 } from "@lianruan/shared";
import { Pool, type PoolClient } from "pg";

import type { Rbac操作人 } from "./rbac.js";

export interface Rbac数据服务 {
  查询角色列表(): Promise<unknown>;
  查询角色用户(
    roleId: string,
    参数: { keyword?: string; page: number; pageSize: number },
  ): Promise<unknown>;
  查询账号(keyword: string): Promise<unknown>;
  新建角色(input: Record<string, unknown>, actor: Rbac操作人): Promise<unknown>;
  更新角色(id: string, input: Record<string, unknown>, actor: Rbac操作人): Promise<unknown>;
  更新角色状态(id: string, input: Record<string, unknown>, actor: Rbac操作人): Promise<unknown>;
  查询权限字典(): Promise<unknown>;
  查询用户角色(userId: string): Promise<unknown>;
  覆盖用户角色(userId: string, input: Record<string, unknown>, actor: Rbac操作人): Promise<unknown>;
}

const 资源中文: Record<string, string> = {
  registration: "客户报备",
  opportunity: "商机",
  quote: "报价",
  order: "订单",
  report: "经营报表",
  catalog: "产品目录",
  partner: "渠道商管理",
  review: "审核中心",
  audit: "操作日志",
  message: "消息渠道",
  openapi: "开放接口",
  workload: "工作量",
  platform: "平台管理",
  organization: "组织架构",
  account: "账号管理",
};
const 动作中文: Record<string, string> = {
  read: "查看",
  create: "新建",
  edit: "编辑",
  delete: "删除",
  approve: "审批",
  admin: "管理",
};
const 范围类型 = ["all", "org_subtree", "region", "partner", "self"];

export function 创建Rbac数据服务(参数: { databaseUrl?: string }): Rbac数据服务 {
  return new PostgreSQLRbac数据服务(参数.databaseUrl);
}

class PostgreSQLRbac数据服务 implements Rbac数据服务 {
  private readonly pool: Pool;
  public constructor(databaseUrl?: string) {
    if (!databaseUrl)
      throw new 应用错误("RBAC_DATABASE_UNAVAILABLE", "角色管理数据库尚未配置。", 503);
    this.pool = new Pool({ connectionString: databaseUrl });
  }

  async 查询角色列表() {
    const { rows } = await this.pool.query(
      `
      SELECT
        r.id::text AS id,
        r.role_code AS "roleCode",
        r.role_name AS "roleName",
        r.description AS description,
        r.status_code AS "statusCode",
        COALESCE((r.extra_json->>'isSystem')::boolean, false) AS "isSystem",
        COALESCE(
          (
            SELECT array_agg(p.permission_code ORDER BY p.resource_code, p.action_code)
            FROM iam.role_permissions rp
            JOIN iam.permissions p ON p.id = rp.permission_id
            WHERE rp.role_id = r.id AND p.action_code <> 'write'
          ),
          ARRAY[]::text[]
        ) AS "permissionCodes",
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'scopeType', d.scope_type,
                'scopeRefId', d.scope_ref_id::text,
                'statusCode', d.status_code
              ) ORDER BY d.scope_type, d.scope_ref_id
            )
            FROM iam.data_scope_bindings d
            WHERE d.role_id = r.id
          ),
          '[]'::json
        ) AS scopes,
        COALESCE(
          (SELECT count(*)::int FROM iam.user_roles ur WHERE ur.role_id = r.id),
          0
        ) AS "userCount"
      FROM iam.roles r
      ORDER BY
        CASE r.role_code
          WHEN 'superadmin' THEN 1
          WHEN 'admin' THEN 2
          WHEN 'region_manager' THEN 3
          WHEN 'partner_admin' THEN 4
          ELSE 5
        END,
        r.role_name
      `,
    );
    return { items: rows.map((行) => ({ ...行, scopes: 行.scopes || [] })) };
  }

  async 查询角色用户(roleId: string, 参数: { keyword?: string; page: number; pageSize: number }) {
    const 角色 = await this.查询角色概要(roleId);
    const keyword = 参数.keyword || null;
    const [数量, 用户] = await Promise.all([
      this.pool.query<{ total: number }>(
        `
        SELECT count(*)::int AS total
        FROM iam.user_roles ur
        JOIN iam.users u ON u.id = ur.user_id
        WHERE ur.role_id = $1::uuid
          AND ($2::text IS NULL OR u.username::text ILIKE '%' || $2 || '%' OR u.display_name ILIKE '%' || $2 || '%')
        `,
        [roleId, keyword],
      ),
      this.pool.query(
        `
        SELECT
          u.id::text AS id,
          u.username::text AS username,
          u.display_name AS "displayName",
          u.status_code AS "statusCode",
          COALESCE(内部任职.summary, '') AS "internalAssignmentSummary",
          COALESCE(渠道成员.summary, '') AS "partnerMembershipSummary"
        FROM iam.user_roles ur
        JOIN iam.users u ON u.id = ur.user_id
        LEFT JOIN LATERAL (
          SELECT string_agg(DISTINCT concat_ws(' / ', ou.unit_name, p.position_name), '；') AS summary
          FROM org.staff_assignments sa
          JOIN org.org_units ou ON ou.id = sa.org_unit_id
          JOIN org.positions p ON p.id = sa.position_id
          WHERE sa.user_id = u.id AND sa.expired_at IS NULL
        ) 内部任职 ON true
        LEFT JOIN LATERAL (
          SELECT string_agg(DISTINCT concat_ws(' / ', cp.partner_name, pm.member_role_code), '；') AS summary
          FROM channel.partner_members pm
          JOIN channel.partners cp ON cp.id = pm.partner_id
          WHERE pm.user_id = u.id AND pm.status_code = 'active'
        ) 渠道成员 ON true
        WHERE ur.role_id = $1::uuid
          AND ($2::text IS NULL OR u.username::text ILIKE '%' || $2 || '%' OR u.display_name ILIKE '%' || $2 || '%')
        ORDER BY u.display_name, u.username
        LIMIT $3 OFFSET $4
        `,
        [roleId, keyword, 参数.pageSize, (参数.page - 1) * 参数.pageSize],
      ),
    ]);
    return {
      role: 角色,
      items: 用户.rows,
      page: 参数.page,
      pageSize: 参数.pageSize,
      total: 数量.rows[0]?.total || 0,
    };
  }

  async 查询账号(keyword: string) {
    const { rows } = await this.pool.query(
      `
      SELECT
        u.id::text AS id,
        u.username::text AS username,
        u.display_name AS "displayName",
        u.status_code AS "statusCode",
        u.phone AS phone,
        u.email::text AS email,
        COALESCE(系统角色.role_codes, ARRAY[]::text[]) AS "systemRoleCodes",
        COALESCE(系统角色.role_names, ARRAY[]::text[]) AS "systemRoleNames",
        COALESCE(内部任职.summary, '') AS "internalAssignmentSummary",
        COALESCE(渠道成员.summary, '') AS "partnerMembershipSummary"
      FROM iam.users u
      LEFT JOIN LATERAL (
        SELECT
          array_agg(r.role_code ORDER BY r.role_name) AS role_codes,
          array_agg(r.role_name ORDER BY r.role_name) AS role_names
        FROM iam.user_roles ur
        JOIN iam.roles r ON r.id = ur.role_id
        WHERE ur.user_id = u.id
      ) 系统角色 ON true
      LEFT JOIN LATERAL (
        SELECT string_agg(DISTINCT concat_ws(' / ', ou.unit_name, p.position_name), '；') AS summary
        FROM org.staff_assignments sa
        JOIN org.org_units ou ON ou.id = sa.org_unit_id
        JOIN org.positions p ON p.id = sa.position_id
        WHERE sa.user_id = u.id AND sa.expired_at IS NULL
      ) 内部任职 ON true
      LEFT JOIN LATERAL (
        SELECT string_agg(DISTINCT concat_ws(' / ', cp.partner_name, pm.member_role_code), '；') AS summary
        FROM channel.partner_members pm
        JOIN channel.partners cp ON cp.id = pm.partner_id
        WHERE pm.user_id = u.id AND pm.status_code = 'active'
      ) 渠道成员 ON true
      WHERE u.username::text ILIKE '%' || $1 || '%'
         OR u.display_name ILIKE '%' || $1 || '%'
      ORDER BY u.display_name, u.username
      LIMIT 20
      `,
      [keyword],
    );
    return { items: rows };
  }

  async 新建角色(input: Record<string, unknown>, actor: Rbac操作人) {
    const roleName = 必填文本(input, "roleName", "角色名称");
    const description = 可选文本(input, "description");
    const permissionCodes = 权限点数组(input);
    const scopes = 范围数组(input);
    const roleCode = "role_" + crypto.randomBytes(6).toString("hex");
    return this.事务(async (db) => {
      const 操作人Id = await this.操作人(db, actor);
      const result = await db.query<{ id: string }>(
        `
        INSERT INTO iam.roles (role_code, role_name, status_code, description, extra_json)
        VALUES ($1, $2, 'active', $3, '{"isSystem":false}'::jsonb)
        RETURNING id::text AS id
        `,
        [roleCode, roleName, description],
      );
      const id = result.rows[0]!.id;
      await this.绑定权限(db, id, permissionCodes);
      await this.绑定范围(db, id, scopes);
      await 审计Rbac(db, 操作人Id, actor, "rbac.role.created", id, {
        roleCode,
        roleName,
        permissionCodes,
        scopes,
      });
      return {
        id,
        roleCode,
        roleName,
        description,
        statusCode: "active",
        isSystem: false,
        permissionCodes,
        scopes,
        userCount: 0,
      };
    });
  }

  async 更新角色(id: string, input: Record<string, unknown>, actor: Rbac操作人) {
    const 现有 = await this.读取角色(id);
    const roleName = 必填文本(input, "roleName", "角色名称");
    const description = 可选文本(input, "description");
    const permissionCodes = 权限点数组(input);
    const scopes = 范围数组(input);
    const statusCode = 可选枚举(input, "statusCode", ["active", "disabled"], 现有.status_code);
    return this.事务(async (db) => {
      const 操作人Id = await this.操作人(db, actor);
      await db.query(
        `
        UPDATE iam.roles
        SET role_name = $2, description = $3, status_code = $4, extra_json = extra_json || '{"isSystem":false}'::jsonb
        WHERE id = $1::uuid
        `,
        [id, roleName, description, statusCode],
      );
      await this.绑定权限(db, id, permissionCodes);
      await this.绑定范围(db, id, scopes);
      await 审计Rbac(db, 操作人Id, actor, "rbac.role.updated", id, {
        roleName,
        description,
        statusCode,
        permissionCodes,
        scopes,
      });
      return {
        id,
        roleCode: 现有.role_code,
        roleName,
        description,
        statusCode,
        isSystem: false,
        permissionCodes,
        scopes,
        userCount: 现有.userCount,
      };
    });
  }

  async 更新角色状态(id: string, input: Record<string, unknown>, actor: Rbac操作人) {
    const 现有 = await this.读取角色(id);
    const statusCode = 枚举(input, "statusCode", ["active", "disabled"]);
    return this.事务(async (db) => {
      const 操作人Id = await this.操作人(db, actor);
      await db.query("UPDATE iam.roles SET status_code = $2 WHERE id = $1::uuid", [id, statusCode]);
      await 审计Rbac(db, 操作人Id, actor, "rbac.role.status.updated", id, {
        statusCode,
      });
      return { id, roleCode: 现有.role_code, roleName: 现有.role_name, statusCode };
    });
  }

  async 查询权限字典() {
    const { rows } = await this.pool.query<{
      permission_code: string;
      permission_name: string;
      resource_code: string;
      action_code: string;
    }>(
      `
      SELECT permission_code, permission_name, resource_code, action_code
      FROM iam.permissions
      WHERE action_code <> 'write'
      ORDER BY resource_code, action_code
      `,
    );
    const 分组 = new Map<string, Array<Record<string, unknown>>>();
    for (const 行 of rows) {
      const 列表 = 分组.get(行.resource_code) || [];
      列表.push({
        permissionCode: 行.permission_code,
        permissionName: 行.permission_name,
        actionCode: 行.action_code,
        actionName: 动作中文[行.action_code] || 行.action_code,
      });
      分组.set(行.resource_code, 列表);
    }
    return {
      resources: Array.from(分组.entries()).map(([resourceCode, permissions]) => ({
        resourceCode,
        resourceName: 资源中文[resourceCode] || resourceCode,
        permissions,
      })),
    };
  }

  async 查询用户角色(userId: string) {
    const { rows } = await this.pool.query(
      `
      SELECT
        r.id::text AS id,
        r.role_code AS "roleCode",
        r.role_name AS "roleName",
        r.status_code AS "statusCode",
        COALESCE((r.extra_json->>'isSystem')::boolean, false) AS "isSystem"
      FROM iam.roles r
      JOIN iam.user_roles ur ON ur.role_id = r.id
      WHERE ur.user_id = $1::uuid
      ORDER BY
        CASE r.role_code
          WHEN 'superadmin' THEN 1
          WHEN 'admin' THEN 2
          WHEN 'region_manager' THEN 3
          WHEN 'partner_admin' THEN 4
          ELSE 5
        END,
        r.role_name
      `,
      [userId],
    );
    return {
      roleIds: rows.map((行) => 行.id),
      roles: rows,
    };
  }

  async 覆盖用户角色(userId: string, input: Record<string, unknown>, actor: Rbac操作人) {
    const roleIds = 标识数组(input, "roleIds");
    await this.事务(async (db) => {
      const 操作人Id = await this.操作人(db, actor);
      const 用户 = await db.query<{ username: string }>(
        "SELECT username::text AS username FROM iam.users WHERE id=$1::uuid FOR UPDATE",
        [userId],
      );
      if (!用户.rows[0])
        throw new 应用错误("RBAC_USER_NOT_FOUND", "用户不存在，无法分配角色。", 404);
      const 现有超级角色 = await db.query<{ id: string }>(
        `SELECT r.id::text AS id
         FROM iam.user_roles ur
         JOIN iam.roles r ON r.id=ur.role_id
         WHERE ur.user_id=$1::uuid AND r.role_code='superadmin'`,
        [userId],
      );
      const 是内置Admin账号 = 用户.rows[0].username.trim().toLowerCase() === "admin";
      if (现有超级角色.rows[0] && !roleIds.includes(现有超级角色.rows[0].id) && 是内置Admin账号)
        throw new 应用错误(
          "RBAC_SUPERADMIN_ROLE_PROTECTED",
          "内置 admin 超级管理员角色不可被移除，以保证系统账号安全。",
          409,
        );
      const 目标角色 = await db.query<{ id: string }>(
        `SELECT id::text AS id
         FROM iam.roles
         WHERE id::text=ANY($1::text[]) AND status_code='active'`,
        [roleIds],
      );
      if (目标角色.rows.length !== roleIds.length)
        throw new 应用错误("RBAC_ROLE_INVALID", "存在无效或已停用的角色，请刷新后重试。", 400);
      await db.query("DELETE FROM iam.user_roles WHERE user_id = $1::uuid", [userId]);
      for (const roleId of roleIds) {
        await db.query(
          `
          INSERT INTO iam.user_roles (user_id, role_id)
          VALUES ($1::uuid, $2::uuid)
          ON CONFLICT DO NOTHING
          `,
          [userId, roleId],
        );
      }
      await 审计Rbac(db, 操作人Id, actor, "rbac.user.roles.updated", userId, {
        roleIds,
        username: 用户.rows[0].username,
      });
    });
    return this.查询用户角色(userId);
  }

  private async 读取角色(id: string) {
    const result = await this.pool.query<{
      role_code: string;
      role_name: string;
      status_code: string;
      isSystem: boolean;
      userCount: number;
    }>(
      `
      SELECT
        r.role_code,
        r.role_name,
        r.status_code,
        COALESCE((r.extra_json->>'isSystem')::boolean, false) AS "isSystem",
        COALESCE((SELECT count(*)::int FROM iam.user_roles ur WHERE ur.role_id = r.id), 0) AS "userCount"
      FROM iam.roles r
      WHERE r.id = $1::uuid
      `,
      [id],
    );
    const 行 = result.rows[0];
    if (!行) throw new 应用错误("RBAC_ROLE_NOT_FOUND", "角色不存在。", 404);
    if (行.isSystem)
      throw new 应用错误("RBAC_SYSTEM_ROLE_PROTECTED", "系统内置角色不可编辑或停用。", 403);
    return 行;
  }

  private async 查询角色概要(id: string) {
    const result = await this.pool.query<{
      id: string;
      roleCode: string;
      roleName: string;
    }>(
      `
      SELECT id::text AS id, role_code AS "roleCode", role_name AS "roleName"
      FROM iam.roles
      WHERE id = $1::uuid
      `,
      [id],
    );
    if (!result.rows[0]) throw new 应用错误("RBAC_ROLE_NOT_FOUND", "角色不存在。", 404);
    return result.rows[0];
  }

  private async 绑定权限(db: PoolClient, roleId: string, permissionCodes: string[]) {
    await db.query("DELETE FROM iam.role_permissions WHERE role_id = $1::uuid", [roleId]);
    if (!permissionCodes.length) return;
    const 有效 = await db.query<{ id: string }>(
      `
      SELECT id::text AS id FROM iam.permissions
      WHERE permission_code = ANY($1::text[])
      `,
      [permissionCodes],
    );
    if (有效.rows.length !== permissionCodes.length)
      throw new 应用错误("RBAC_PERMISSION_INVALID", "存在无效的权限点，请刷新后重试。", 400);
    for (const 行 of 有效.rows) {
      await db.query(
        `
        INSERT INTO iam.role_permissions (role_id, permission_id)
        VALUES ($1::uuid, $2::uuid)
        ON CONFLICT DO NOTHING
        `,
        [roleId, 行.id],
      );
    }
  }

  private async 绑定范围(
    db: PoolClient,
    roleId: string,
    scopes: Array<{ scopeType: string; scopeRefId?: string }>,
  ) {
    await db.query("DELETE FROM iam.data_scope_bindings WHERE role_id = $1::uuid", [roleId]);
    for (const 项 of scopes) {
      await db.query(
        `
        INSERT INTO iam.data_scope_bindings (role_id, scope_type, scope_ref_id, status_code)
        VALUES ($1::uuid, $2, $3::uuid, 'active')
        `,
        [roleId, 项.scopeType, 项.scopeRefId || null],
      );
    }
  }

  private async 操作人(db: PoolClient, actor: Rbac操作人): Promise<string> {
    const r = await db.query(
      "SELECT id::text FROM iam.users WHERE lower(username) = lower($1) AND status_code = 'active'",
      [actor.username],
    );
    if (!r.rows[0]) throw new 应用错误("RBAC_SUBJECT_INVALID", "当前超级管理员账号不可用。", 403);
    return r.rows[0].id;
  }

  private async 事务<T>(action: (db: PoolClient) => Promise<T>): Promise<T> {
    const db = await this.pool.connect();
    try {
      await db.query("BEGIN");
      const v = await action(db);
      await db.query("COMMIT");
      return v;
    } catch (e) {
      await db.query("ROLLBACK");
      throw 转换数据库错误(e);
    } finally {
      db.release();
    }
  }
}

async function 审计Rbac(
  db: PoolClient,
  actorUserId: string,
  actor: Rbac操作人,
  action: string,
  targetId: string | null,
  after: unknown,
) {
  await db.query(
    `
    INSERT INTO audit.audit_logs(
      created_at, request_id, actor_user_id, actor_username, actor_name, actor_role,
      module_code, action_code, target_type, target_id, result_code, message,
      before_json, after_json, extra_json
    )
    VALUES (now(), $1, $2::uuid, $3, $3, 'superadmin', 'rbac', $4, 'rbac', $5, 'success', '角色权限操作', '{}'::jsonb, $6::jsonb, '{}'::jsonb)
    `,
    [actor.requestId, actorUserId, actor.username, action, targetId, JSON.stringify(after)],
  );
}

function 必填文本(v: Record<string, unknown>, k: string, 中文名: string): string {
  const x = v[k];
  if (typeof x !== "string" || !x.trim())
    throw new 应用错误("RBAC_REQUEST_INVALID", `请填写${中文名}。`, 400);
  return x.trim();
}
function 可选文本(v: Record<string, unknown>, k: string): string | null {
  const x = v[k];
  return typeof x === "string" && x.trim() ? x.trim() : null;
}
function 枚举(v: Record<string, unknown>, k: string, all: string[]): string {
  const x = 必填文本(v, k, k);
  if (!all.includes(x)) throw new 应用错误("RBAC_REQUEST_INVALID", `${k}不合法。`, 400);
  return x;
}
function 可选枚举(v: Record<string, unknown>, k: string, all: string[], d: string): string {
  if (v[k] === undefined || v[k] === null || v[k] === "") return d;
  return 枚举(v, k, all);
}
function 权限点数组(v: Record<string, unknown>): string[] {
  return 字符串数组(v, "permissionCodes");
}
function 标识数组(v: Record<string, unknown>, k: string): string[] {
  const 列表 = 字符串数组(v, k);
  for (const 项 of 列表) {
    if (!/^[0-9a-f-]{36}$/i.test(项))
      throw new 应用错误("RBAC_REQUEST_INVALID", `${k}包含不合法标识。`, 400);
  }
  return 列表;
}
function 字符串数组(v: Record<string, unknown>, k: string): string[] {
  const x = v[k];
  if (x === undefined || x === null) return [];
  if (!Array.isArray(x) || x.some((项) => typeof 项 !== "string"))
    throw new 应用错误("RBAC_REQUEST_INVALID", `${k}必须为字符串数组。`, 400);
  return (x as string[]).map((项) => 项.trim()).filter(Boolean);
}
function 范围数组(v: Record<string, unknown>): Array<{ scopeType: string; scopeRefId?: string }> {
  const x = v["scopes"];
  if (x === undefined || x === null) return [];
  if (!Array.isArray(x)) throw new 应用错误("RBAC_REQUEST_INVALID", "scopes必须为数组。", 400);
  return x.map((项) => {
    const 对象 = 项 as Record<string, unknown>;
    const scopeType = 必填文本(对象, "scopeType", "范围类型");
    if (!范围类型.includes(scopeType))
      throw new 应用错误("RBAC_REQUEST_INVALID", "范围类型不合法。", 400);
    const scopeRefId = 对象.scopeRefId;
    if (scopeRefId === undefined || scopeRefId === null || scopeRefId === "") {
      if (scopeType !== "all" && scopeType !== "self")
        throw new 应用错误("RBAC_REQUEST_INVALID", "该范围类型必须指定范围标识。", 400);
      return { scopeType };
    }
    if (typeof scopeRefId !== "string" || !/^[0-9a-f-]{36}$/i.test(scopeRefId))
      throw new 应用错误("RBAC_REQUEST_INVALID", "范围标识不合法。", 400);
    return { scopeType, scopeRefId };
  });
}
function 转换数据库错误(error: unknown): unknown {
  if (error instanceof 应用错误) return error;
  const 消息 = error instanceof Error ? error.message : String(error);
  if (/unique/i.test(消息))
    return new 应用错误("RBAC_DUPLICATE_ROLE", "角色编码重复，请重试。", 409);
  return error;
}
