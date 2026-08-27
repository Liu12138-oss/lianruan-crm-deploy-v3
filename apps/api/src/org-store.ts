import crypto from "node:crypto";

import { 应用错误 } from "@lianruan/shared";
import { Pool, type PoolClient } from "pg";

export interface 组织操作人 {
  username: string;
  requestId: string;
  role?: string;
}
export interface 组织幂等参数 {
  作用域: string;
  幂等键: string;
  请求哈希: string;
}
export interface 组织数据服务 {
  查询组织树(): Promise<unknown>;
  查询渠道组织树(): Promise<unknown>;
  查询渠道成员档案(id: string, actor: 组织操作人): Promise<unknown>;
  保存渠道成员档案(id: string, input: Record<string, unknown>, actor: 组织操作人): Promise<unknown>;
  查询区域列表(): Promise<unknown>;
  新建区域(input: Record<string, unknown>, actor: 组织操作人): Promise<unknown>;
  更新区域(id: string, input: Record<string, unknown>, actor: 组织操作人): Promise<unknown>;
  导入部门(input: Record<string, unknown>, actor: 组织操作人): Promise<unknown>;
  导出部门(): Promise<unknown>;
  导入成员(input: Record<string, unknown>, actor: 组织操作人): Promise<unknown>;
  导出成员(): Promise<unknown>;
  查询组织详情(id: string): Promise<unknown>;
  新建组织(input: Record<string, unknown>, actor: 组织操作人): Promise<unknown>;
  更新组织(id: string, input: Record<string, unknown>, actor: 组织操作人): Promise<unknown>;
  更新组织状态(id: string, input: Record<string, unknown>, actor: 组织操作人): Promise<unknown>;
  查询岗位(orgUnitId?: string): Promise<unknown>;
  新建岗位(input: Record<string, unknown>, actor: 组织操作人): Promise<unknown>;
  更新岗位(id: string, input: Record<string, unknown>, actor: 组织操作人): Promise<unknown>;
  更新岗位状态(id: string, input: Record<string, unknown>, actor: 组织操作人): Promise<unknown>;
  查询任职(orgUnitId?: string): Promise<unknown>;
  新建任职(userId: string, input: Record<string, unknown>, actor: 组织操作人): Promise<unknown>;
  更新任职(id: string, input: Record<string, unknown>, actor: 组织操作人): Promise<unknown>;
  结束任职(id: string, input: Record<string, unknown>, actor: 组织操作人): Promise<unknown>;
  查询负责人关系(subordinateAssignmentId?: string): Promise<unknown>;
  新建负责人关系(input: Record<string, unknown>, actor: 组织操作人): Promise<unknown>;
  更新负责人关系(id: string, input: Record<string, unknown>, actor: 组织操作人): Promise<unknown>;
  结束负责人关系(id: string, input: Record<string, unknown>, actor: 组织操作人): Promise<unknown>;
  查询业务角色(): Promise<unknown>;
  新建业务角色(input: Record<string, unknown>, actor: 组织操作人): Promise<unknown>;
  更新业务角色(id: string, input: Record<string, unknown>, actor: 组织操作人): Promise<unknown>;
  更新业务角色状态(id: string, input: Record<string, unknown>, actor: 组织操作人): Promise<unknown>;
  查询成员业务角色(筛选?: {
    businessRoleId?: string;
    staffAssignmentId?: string;
    partnerMemberId?: string;
  }): Promise<unknown>;
  指派成员业务角色(input: Record<string, unknown>, actor: 组织操作人): Promise<unknown>;
  结束成员业务角色(id: string, input: Record<string, unknown>, actor: 组织操作人): Promise<unknown>;
  查询证书模板(类别?: string): Promise<unknown>;
  新建证书模板(input: Record<string, unknown>, actor: 组织操作人): Promise<unknown>;
  查询成员证书(
    userId?: string,
    筛选?: {
      orgUnitId?: string;
      partnerId?: string;
      regionId?: string;
      category?: string;
      templateName?: string;
      partnerIds?: string[];
    },
  ): Promise<unknown>;
  颁发证书(userId: string, input: Record<string, unknown>, actor: 组织操作人): Promise<unknown>;
  延期证书(id: string, input: Record<string, unknown>, actor: 组织操作人): Promise<unknown>;
  撤销证书(id: string, input: Record<string, unknown>, actor: 组织操作人): Promise<unknown>;
  同步管理账号(actor: 组织操作人): Promise<unknown>;
  统计未归集管理账号(): Promise<unknown>;
  删除用户(userId: string, actor: 组织操作人): Promise<unknown>;
  查询数据范围(subjectType: string, subjectId: string): Promise<unknown>;
  保存数据范围(
    subjectType: string,
    subjectId: string,
    input: Record<string, unknown>,
    actor: 组织操作人,
  ): Promise<unknown>;
  停用数据范围(id: string, input: Record<string, unknown>, actor: 组织操作人): Promise<unknown>;
  查询离职交接(): Promise<unknown>;
  预览离职影响(userId: string): Promise<unknown>;
  查询离职交接详情(id: string): Promise<unknown>;
  发起离职交接(input: Record<string, unknown>, actor: 组织操作人): Promise<unknown>;
  重试离职扫描(id: string, input: Record<string, unknown>, actor: 组织操作人): Promise<unknown>;
  关闭离职交接(id: string, input: Record<string, unknown>, actor: 组织操作人): Promise<unknown>;
  预览渠道商同步(): Promise<unknown>;
  执行渠道商同步(input: Record<string, unknown>, actor: 组织操作人): Promise<unknown>;
  查询泛微OA身份(userId: string): Promise<unknown>;
  新建泛微OA身份候选(
    userId: string,
    input: Record<string, unknown>,
    actor: 组织操作人,
  ): Promise<unknown>;
  更新泛微OA身份候选(
    userId: string,
    candidateId: string,
    input: Record<string, unknown>,
    actor: 组织操作人,
  ): Promise<unknown>;
  确认泛微OA身份候选(
    userId: string,
    candidateId: string,
    input: Record<string, unknown>,
    actor: 组织操作人,
  ): Promise<unknown>;
  驳回泛微OA身份候选(
    userId: string,
    candidateId: string,
    input: Record<string, unknown>,
    actor: 组织操作人,
  ): Promise<unknown>;
  停用泛微OA身份(
    userId: string,
    input: Record<string, unknown>,
    actor: 组织操作人,
  ): Promise<unknown>;
  执行幂等<T>(参数: 组织幂等参数, 操作: () => Promise<T>): Promise<T>;
}

export function 创建组织数据服务(参数: { databaseUrl?: string }): 组织数据服务 {
  return new PostgreSQL组织数据服务(参数.databaseUrl);
}

class PostgreSQL组织数据服务 implements 组织数据服务 {
  private readonly pool: Pool;
  public constructor(databaseUrl?: string) {
    if (!databaseUrl)
      throw new 应用错误("ORG_DATABASE_UNAVAILABLE", "组织架构数据库尚未配置。", 503);
    this.pool = new Pool({ connectionString: databaseUrl });
  }
  async 查询组织树() {
    const { rows } = await this.pool.query(
      'SELECT id::text, unit_code AS "unitCode", unit_name AS "unitName", unit_type AS "unitType", parent_unit_id::text AS "parentUnitId", status_code AS "statusCode", sort_order AS "sortOrder", row_version AS "rowVersion" FROM org.org_units WHERE unit_type NOT LIKE \'channel_%\' AND status_code IN (\'active\',\'draft\') ORDER BY path_code, sort_order, unit_code',
    );
    const 成员 = await this.pool.query(
      'SELECT a.org_unit_id::text AS "orgUnitId", u.id::text AS "userId", u.username AS "username", u.display_name AS "displayName", a.id::text AS "assignmentId" FROM org.staff_assignments a JOIN iam.users u ON u.id=a.user_id WHERE a.expired_at IS NULL ORDER BY u.display_name',
    );
    const 成员映射 = new Map<
      string,
      Array<{ userId: string; username: string; displayName: string; assignmentId: string }>
    >();
    for (const m of 成员.rows as Array<{
      orgUnitId: string;
      userId: string;
      username: string;
      displayName: string;
      assignmentId: string;
    }>) {
      if (!成员映射.has(m.orgUnitId)) 成员映射.set(m.orgUnitId, []);
      成员映射.get(m.orgUnitId)!.push({
        userId: m.userId,
        username: m.username,
        displayName: m.displayName,
        assignmentId: m.assignmentId,
      });
    }
    return 构建树(rows, 成员映射);
  }
  async 查询渠道组织树() {
    const [区域, 商, 成员] = await Promise.all([
      this.pool.query(
        'SELECT id::text AS "id", region_code AS "regionCode", region_name AS "regionName", parent_region_id::text AS "parentRegionId", region_level AS "regionLevel", status_code AS "statusCode", row_version AS "rowVersion" FROM org.regions WHERE status_code = \'active\' ORDER BY region_name',
      ),
      this.pool.query(
        'SELECT id::text AS "id", partner_code AS "partnerCode", partner_name AS "partnerName", partner_level_code AS "partnerLevelCode", region_id::text AS "regionId", status_code AS "statusCode" FROM channel.partners ORDER BY normalized_name',
      ),
      this.pool.query(
        'SELECT pm.id::text AS "id", pm.partner_id::text AS "partnerId", pp.partner_name AS "partnerName", pp.partner_code AS "partnerCode", u.id::text AS "userId", u.username AS "username", u.display_name AS "displayName", u.phone AS "phone", u.email AS "email", pm.member_role_code AS "memberRoleCode", pm.status_code AS "statusCode", pm.started_at AS "startedAt", pm.row_version AS "rowVersion" FROM channel.partner_members pm JOIN iam.users u ON u.id=pm.user_id LEFT JOIN channel.partners pp ON pp.id=pm.partner_id WHERE pm.status_code=\'active\' AND pm.archived_at IS NULL ORDER BY u.display_name',
      ),
    ]);
    const 区域节点 = new Map<
      string,
      {
        id: string;
        name: string;
        type: string;
        regionLevel: string;
        parentRegionId: string | null;
        rowVersion: number;
        children: Array<Record<string, unknown>>;
      }
    >();
    for (const r of 区域.rows as Array<{
      id: string;
      regionName: string;
      regionLevel: string;
      parentRegionId: string | null;
      rowVersion: number;
    }>) {
      区域节点.set(r.id, {
        id: r.id,
        name: r.regionName,
        type: r.regionLevel === "big_region" ? "big_region" : "region",
        regionLevel: r.regionLevel,
        parentRegionId: r.parentRegionId,
        rowVersion: r.rowVersion,
        children: [],
      });
    }
    const 商节点 = new Map<
      string,
      {
        children: Array<Record<string, unknown>>;
        members: Array<Record<string, unknown>>;
        [key: string]: unknown;
      }
    >(
      (商.rows as Array<{ id: string }>).map((p) => [
        p.id,
        {
          ...p,
          members: [],
          children: [],
        },
      ]),
    );
    const 成员映射 = new Map<
      string,
      Array<{
        id: string;
        userId: string;
        username: string;
        displayName: string;
        phone: string;
        email: string;
        memberRoleCode: string;
        statusCode: string;
        startedAt: string;
        rowVersion: number;
        partnerName: string;
        partnerCode: string;
      }>
    >();
    for (const m of 成员.rows as Array<{
      id: string;
      partnerId: string;
      userId: string;
      username: string;
      displayName: string;
      phone: string;
      email: string;
      memberRoleCode: string;
      statusCode: string;
      startedAt: string;
      rowVersion: number;
      partnerName: string;
      partnerCode: string;
    }>) {
      if (!成员映射.has(m.partnerId)) 成员映射.set(m.partnerId, []);
      成员映射.get(m.partnerId)!.push({
        id: m.id,
        userId: m.userId,
        username: m.username,
        displayName: m.displayName,
        phone: m.phone || "",
        email: m.email || "",
        memberRoleCode: m.memberRoleCode,
        statusCode: m.statusCode,
        startedAt: m.startedAt || "",
        rowVersion: m.rowVersion,
        partnerName: m.partnerName || "",
        partnerCode: m.partnerCode || "",
      });
    }
    const 未分配渠道商: Array<Record<string, unknown>> = [];
    for (const p of 商.rows as Array<{ id: string; regionId: string | null }>) {
      const 节点 = 商节点.get(p.id)!;
      节点.members = 成员映射.get(p.id) || [];
      const 归属区域 = p.regionId ? 区域节点.get(p.regionId) : undefined;
      if (归属区域) 归属区域.children.push(节点);
      else 未分配渠道商.push(节点);
    }
    const 被引用 = new Set<string>();
    for (const r of 区域.rows as Array<{ id: string; parentRegionId: string | null }>) {
      const 父 = r.parentRegionId ? 区域节点.get(r.parentRegionId) : undefined;
      if (父 && 父.regionLevel !== "country") {
        父.children.push(区域节点.get(r.id)!);
        被引用.add(r.id);
      }
    }
    const roots: Array<Record<string, unknown>> = [];
    for (const r of 区域.rows as Array<{ id: string; regionLevel: string }>) {
      if (被引用.has(r.id)) continue;
      if (r.regionLevel === "country") continue;
      roots.push(区域节点.get(r.id)!);
    }
    if (未分配渠道商.length) {
      roots.push({
        id: "unassigned",
        name: "未分配区域",
        type: "unassigned",
        children: 未分配渠道商,
      });
    }
    return { items: roots };
  }
  async 查询渠道成员档案(id: string, _actor: 组织操作人) {
    const member = await this.pool.query(
      `SELECT pm.id::text AS id,pm.row_version AS "rowVersion",pm.user_id::text AS "userId",
         pm.partner_id::text AS "partnerId",p.partner_name AS "partnerName",
         COALESCE(p.v2_source_id,p.partner_code,p.id::text) AS "partnerExternalId",
         pm.member_role_code AS "memberRoleCode",pm.status_code AS "memberStatusCode",
         u.username::text AS username,u.display_name AS name,COALESCE(u.phone,'') AS phone,
         COALESCE(u.email::text,'') AS email,u.status_code AS "userStatusCode",
         COALESCE(effective_role.role_code,
           CASE WHEN COALESCE(u.extra_json->>'staffRole',u.extra_json->>'title','') ~ '技术'
             THEN 'channel_technical' ELSE 'channel_sales' END) AS "businessRoleCode",
         COALESCE(effective_role.role_name,
           CASE WHEN COALESCE(u.extra_json->>'staffRole',u.extra_json->>'title','') ~ '技术'
             THEN '技术' ELSE '销售' END) AS "businessRoleName"
       FROM channel.partner_members pm
       JOIN channel.partners p ON p.id=pm.partner_id
       JOIN iam.users u ON u.id=pm.user_id
       LEFT JOIN LATERAL (
         SELECT b.role_code,b.role_name
         FROM org.member_business_roles m
         JOIN org.business_roles b ON b.id=m.business_role_id
         WHERE m.partner_member_id=pm.id AND m.expired_at IS NULL
           AND b.role_code IN ('channel_sales','channel_technical')
         ORDER BY m.is_primary_display DESC,m.effective_at DESC
         LIMIT 1
       ) effective_role ON true
       WHERE pm.id=$1::uuid AND pm.archived_at IS NULL`,
      [id],
    );
    if (!member.rows[0]) throw 不存在("渠道成员");
    const userId = member.rows[0].userId as string;
    const [certifications, templates] = await Promise.all([
      this.pool.query(
        `SELECT c.id::text AS id,c.certification_template_id::text AS "certificationTemplateId",
           t.template_name AS "templateName",t.category,c.certificate_no AS "certificateNo",
           c.issued_on AS "issuedOn",c.expires_on AS "expiresOn",c.status_code AS "statusCode",
           c.row_version AS "rowVersion"
         FROM org.member_certifications c
         JOIN org.certification_templates t ON t.id=c.certification_template_id
         WHERE c.user_id=$1::uuid
         ORDER BY CASE c.status_code WHEN 'active' THEN 0 ELSE 1 END,c.expires_on NULLS LAST,c.created_at DESC`,
        [userId],
      ),
      this.pool.query(
        `SELECT id::text AS id,template_code AS "templateCode",template_name AS "templateName",
           category,issuer_name AS "issuerName",validity_months AS "validityMonths"
         FROM org.certification_templates
         WHERE status_code='active'
         ORDER BY template_name,template_code`,
      ),
    ]);
    return {
      ...member.rows[0],
      certifications: certifications.rows,
      certificationTemplates: templates.rows,
    };
  }
  async 保存渠道成员档案(id: string, input: Record<string, unknown>, actor: 组织操作人) {
    const roleCode = 枚举(input, "businessRoleCode", ["channel_sales", "channel_technical"]);
    const templateIds = 可选标识数组(input, "grantCertificationTemplateIds");
    const revokedCertificationIds = 可选标识数组(input, "revokeCertificationIds");
    await this.事务(async (db) => {
      const before = await db.query(
        `SELECT pm.id::text AS id,pm.row_version,pm.user_id::text AS user_id,
           pm.status_code,pm.archived_at,u.display_name,u.phone,u.email::text AS email,u.extra_json
         FROM channel.partner_members pm
         JOIN iam.users u ON u.id=pm.user_id
         WHERE pm.id=$1::uuid
         FOR UPDATE OF pm,u`,
        [id],
      );
      const member = before.rows[0];
      if (!member) throw 不存在("渠道成员");
      if (Number(member.row_version) !== 版本(input)) throw 冲突();
      if (member.archived_at)
        throw new 应用错误("ORG_CHANNEL_MEMBER_ARCHIVED", "已归档的渠道成员不能修改资料。", 409);
      if (member.status_code !== "active")
        throw new 应用错误(
          "ORG_CHANNEL_MEMBER_DISABLED",
          "已停用的渠道成员不能修改角色或证书。",
          409,
        );

      const name = 文本(input, "name", member.display_name);
      const phone = input.phone === undefined ? member.phone || "" : 字符串值(input, "phone");
      const email = input.email === undefined ? member.email || "" : 字符串值(input, "email");
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        throw new 应用错误("ORG_REQUEST_INVALID", "邮箱格式不正确。", 400);
      const roleName = roleCode === "channel_technical" ? "技术" : "销售";
      const actorUserId = await this.操作人(db, actor);

      const role = await db.query<{ id: string }>(
        `SELECT id::text AS id FROM org.business_roles
         WHERE role_code=$1 AND domain_code='channel' AND status_code='active'
         FOR UPDATE`,
        [roleCode],
      );
      if (!role.rows[0])
        throw new 应用错误("ORG_BUSINESS_ROLE_DISABLED", "销售或技术业务角色尚未初始化。", 409);
      if (templateIds.length) {
        const templateCount = await db.query<{ total: number }>(
          `SELECT count(*)::int AS total FROM org.certification_templates
           WHERE id=ANY($1::uuid[]) AND status_code='active'`,
          [templateIds],
        );
        if (templateCount.rows[0]?.total !== templateIds.length)
          throw new 应用错误("ORG_CERTIFICATION_TEMPLATE_INVALID", "所选证书不存在或已停用。", 409);
      }

      await db.query(
        `UPDATE iam.users
         SET display_name=$1,phone=NULLIF($2,''),email=NULLIF($3,'')::citext,updated_at=now(),
           extra_json=extra_json || jsonb_build_object(
             'name',$1::text,'phone',$2::text,'email',$3::text,
             'staffRole',$4::text,'businessRoleCode',$6::text
           )
         WHERE id=$5::uuid`,
        [name, phone, email, roleName, member.user_id, roleCode],
      );
      await db.query(
        `UPDATE org.member_business_roles m
         SET expired_at=now(),row_version=m.row_version+1
         FROM org.business_roles b
         WHERE m.business_role_id=b.id AND m.partner_member_id=$1::uuid
           AND m.expired_at IS NULL AND b.domain_code='channel' AND b.id<>$2::uuid`,
        [id, role.rows[0].id],
      );
      await db.query(
        `INSERT INTO org.member_business_roles(
           business_role_id,partner_member_id,is_primary_display,effective_at,created_by_user_id
         )
         SELECT $1::uuid,$2::uuid,true,now(),$3::uuid
         WHERE NOT EXISTS (
           SELECT 1 FROM org.member_business_roles
           WHERE business_role_id=$1::uuid AND partner_member_id=$2::uuid AND expired_at IS NULL
         )`,
        [role.rows[0].id, id, actorUserId],
      );
      await db.query(
        `UPDATE org.member_business_roles
         SET is_primary_display=true,row_version=row_version+1
         WHERE business_role_id=$1::uuid AND partner_member_id=$2::uuid
           AND expired_at IS NULL AND is_primary_display=false`,
        [role.rows[0].id, id],
      );
      if (revokedCertificationIds.length) {
        const revoked = await db.query(
          `UPDATE org.member_certifications
           SET status_code='revoked',revoke_reason='管理员在统一成员资料中取消授权',revoked_at=now(),
             updated_at=now(),row_version=row_version+1
           WHERE user_id=$1::uuid AND id=ANY($2::uuid[]) AND status_code='active'
           RETURNING id`,
          [member.user_id, revokedCertificationIds],
        );
        if (revoked.rowCount !== revokedCertificationIds.length)
          throw new 应用错误(
            "ORG_CERTIFICATION_INVALID",
            "待撤销证书不存在、已撤销或不属于该成员。",
            409,
          );
      }
      await db.query(
        `INSERT INTO org.member_certifications(
           user_id,certification_template_id,issuer_name,issued_on,expires_on,created_by_user_id
         )
         SELECT $1::uuid,t.id,t.issuer_name,current_date,
           CASE WHEN t.validity_months IS NULL THEN NULL
             ELSE (current_date + make_interval(months=>t.validity_months))::date END,
           $3::uuid
         FROM org.certification_templates t
         WHERE t.id=ANY($2::uuid[]) AND t.status_code='active'
           AND NOT EXISTS (
             SELECT 1 FROM org.member_certifications c
             WHERE c.user_id=$1::uuid AND c.certification_template_id=t.id AND c.status_code='active'
           )`,
        [member.user_id, templateIds, actorUserId],
      );
      const version = await db.query(
        `UPDATE channel.partner_members
         SET row_version=row_version+1,updated_at=now()
         WHERE id=$1::uuid AND row_version=$2
         RETURNING row_version AS "rowVersion"`,
        [id, 版本(input)],
      );
      if (!version.rows[0]) throw 冲突();
      await 审计(
        db,
        actor,
        actorUserId,
        "channel_member.profile_updated",
        id,
        {
          name,
          phone,
          email,
          businessRoleCode: roleCode,
          grantCertificationTemplateIds: templateIds,
          revokeCertificationIds: revokedCertificationIds,
          rowVersion: version.rows[0].rowVersion,
        },
        before.rows[0],
      );
    });
    return this.查询渠道成员档案(id, actor);
  }
  async 查询区域列表() {
    const { rows } = await this.pool.query(
      'SELECT id::text, region_code AS "regionCode", region_name AS "regionName", parent_region_id::text AS "parentRegionId", region_level AS "regionLevel", status_code AS "statusCode", row_version AS "rowVersion" FROM org.regions WHERE status_code=\'active\' ORDER BY region_code',
    );
    return { items: rows };
  }
  async 新建区域(input: Record<string, unknown>, actor: 组织操作人) {
    const name = 文本(input, "regionName");
    const level = 枚举(
      input,
      "regionLevel",
      ["big_region", "region", "province", "city"],
      "region",
    );
    const parent = 可选标识(input, "parentRegionId");
    const code = 可选文本(input, "regionCode") || "AUTO-" + crypto.randomBytes(6).toString("hex");
    return this.写入(
      'INSERT INTO org.regions(region_code,region_name,parent_region_id,region_level) VALUES($1,$2,$3::uuid,$4) RETURNING id::text,region_code AS "regionCode",region_name AS "regionName",parent_region_id::text AS "parentRegionId",region_level AS "regionLevel",status_code AS "statusCode",row_version AS "rowVersion"',
      [code, name, parent, level],
      actor,
      "region.created",
    );
  }
  async 更新区域(id: string, input: Record<string, unknown>, actor: 组织操作人) {
    return this.事务(async (db) => {
      const before = await 锁定(db, "org.regions", id);
      if (before.status_code !== "active")
        throw new 应用错误("ORG_REGION_DISABLED", "已停用的区域不能编辑。", 409);
      const parent = 可选标识(input, "parentRegionId") ?? before.parent_region_id;
      if (parent) {
        const 环 = await db.query(
          "SELECT 1 FROM org.regions WHERE id=$1::uuid AND parent_region_id IS NOT NULL",
          [parent],
        );
        if (环.rows.length)
          throw new 应用错误("ORG_REGION_PARENT_INVALID", "不能把区域挂到渠道商或子区域下。", 409);
      }
      const r = await db.query(
        `UPDATE org.regions SET region_name=$1,parent_region_id=$2::uuid,row_version=row_version+1
         WHERE id=$3::uuid AND row_version=$4
         RETURNING id::text,region_code AS "regionCode",region_name AS "regionName",
           parent_region_id::text AS "parentRegionId",region_level AS "regionLevel",
           status_code AS "statusCode",row_version AS "rowVersion"`,
        [文本(input, "regionName", before.region_name), parent, id, 版本(input)],
      );
      if (!r.rows[0]) throw 冲突();
      const user = await this.操作人(db, actor);
      await 审计(db, actor, user, "region.updated", id, r.rows[0], before);
      return r.rows[0];
    });
  }
  async 导入部门(input: Record<string, unknown>, actor: 组织操作人) {
    const rows = 读取行数组(input);
    if (!rows.length) throw new 应用错误("ORG_IMPORT_EMPTY", "导入内容为空。", 400);
    const 名称集合 = new Set<string>();
    for (const row of rows) {
      const name = 文本(row, "name");
      if (名称集合.has(name))
        throw new 应用错误("ORG_IMPORT_DUPLICATE_NAME", `部门名称重复：${name}`, 400);
      名称集合.add(name);
    }
    return this.事务(async (db) => {
      const user = await this.操作人(db, actor);
      // 部门全量覆盖前，先解除内部账号对旧部门的 org_unit_id 绑定（V2 遗留字段），
      // 避免外键拦截删除；成员归属以重新导入的任职为准。
      await db.query(
        "UPDATE iam.users SET org_unit_id=NULL WHERE org_unit_id IN (SELECT id FROM org.org_units WHERE unit_type NOT LIKE 'channel_%')",
      );
      await db.query(
        "DELETE FROM org.staff_assignments WHERE org_unit_id IN (SELECT id FROM org.org_units WHERE unit_type NOT LIKE 'channel_%')",
      );
      await db.query(
        "DELETE FROM org.positions WHERE org_unit_id IN (SELECT id FROM org.org_units WHERE unit_type NOT LIKE 'channel_%')",
      );
      await db.query("DELETE FROM org.org_units WHERE unit_type NOT LIKE 'channel_%'");
      const 编号映射 = new Map<string, string>();
      for (const row of rows) {
        const name = 文本(row, "name");
        const parentName = 可选文本(row, "parentName");
        const parentId = parentName ? 编号映射.get(parentName) : null;
        if (parentName && !parentId)
          throw new 应用错误(
            "ORG_IMPORT_PARENT_MISSING",
            `上级部门不存在或顺序错误：${parentName}`,
            400,
          );
        const id = crypto.randomUUID();
        const status = 枚举(row, "statusCode", ["draft", "active", "disabled"], "active");
        await db.query(
          "INSERT INTO org.org_units(id,unit_code,unit_name,unit_type,parent_unit_id,status_code,sort_order,created_by_user_id) VALUES($1,$2,$3,'department',$4::uuid,$5,$6,$7::uuid)",
          [id, 生成组织编码(), name, parentId, status, 整数(row, "sortOrder", 0), user],
        );
        编号映射.set(name, id);
      }
      await db.query("SELECT org.rebuild_unit_paths()");
      await 审计(db, actor, user, "units.imported", "", { imported: rows.length });
      return { imported: rows.length };
    });
  }
  async 导出部门() {
    const { rows } = await this.pool.query(
      'SELECT id::text, unit_name AS "name", parent_unit_id::text AS "parentUnitId", sort_order AS "sortOrder", status_code AS "statusCode" FROM org.org_units WHERE unit_type NOT LIKE \'channel_%\' ORDER BY path_code',
    );
    const 名称映射 = new Map(
      (rows as Array<{ id: string; name: string }>).map((r) => [r.id, r.name]),
    );
    return {
      items: (
        rows as Array<{
          id: string;
          name: string;
          parentUnitId: string | null;
          sortOrder: number;
          statusCode: string;
        }>
      ).map((r) => ({
        name: r.name,
        parentName: r.parentUnitId ? 名称映射.get(r.parentUnitId) || null : null,
        sortOrder: r.sortOrder,
        statusCode: r.statusCode,
      })),
    };
  }
  async 导入成员(input: Record<string, unknown>, actor: 组织操作人) {
    const rows = 读取行数组(input);
    if (!rows.length) throw new 应用错误("ORG_IMPORT_EMPTY", "导入内容为空。", 400);
    const 用户集合 = new Set<string>();
    for (const row of rows) {
      const username = 文本(row, "username");
      const 键 = username.trim().toLowerCase();
      if (用户集合.has(键))
        throw new 应用错误("ORG_IMPORT_DUPLICATE_USER", `同一用户只能出现一次：${username}`, 400);
      用户集合.add(键);
    }
    return this.事务(async (db) => {
      const user = await this.操作人(db, actor);
      await db.query(
        "DELETE FROM org.staff_assignments WHERE org_unit_id IN (SELECT id FROM org.org_units WHERE unit_type NOT LIKE 'channel_%')",
      );
      for (const row of rows) {
        const deptName = 文本(row, "departmentName");
        const username = 文本(row, "username");
        const dept = await db.query(
          "SELECT id FROM org.org_units WHERE unit_name=$1 AND unit_type NOT LIKE 'channel_%' AND status_code IN ('active','draft') LIMIT 1",
          [deptName],
        );
        if (!dept.rows[0])
          throw new 应用错误("ORG_IMPORT_DEPARTMENT_MISSING", `部门不存在：${deptName}`, 400);
        const u = await db.query(
          "SELECT id FROM iam.users WHERE lower(username)=lower($1) AND status_code='active'",
          [username],
        );
        if (!u.rows[0])
          throw new 应用错误("ORG_IMPORT_USER_MISSING", `用户不存在或不可用：${username}`, 400);
        await db.query(
          "INSERT INTO org.staff_assignments(user_id,org_unit_id,position_id,is_primary,effective_at,created_by_user_id) VALUES($1::uuid,$2::uuid,NULL,true,now(),$3::uuid)",
          [u.rows[0].id, dept.rows[0].id, user],
        );
      }
      await 审计(db, actor, user, "staff.imported", "", { imported: rows.length });
      return { imported: rows.length };
    });
  }
  async 导出成员() {
    const { rows } = await this.pool.query(
      `SELECT u.username AS "username", u.display_name AS "displayName", o.unit_name AS "departmentName", a.effective_at AS "effectiveAt"
         FROM org.staff_assignments a
         JOIN iam.users u ON u.id=a.user_id
         JOIN org.org_units o ON o.id=a.org_unit_id
        WHERE o.unit_type NOT LIKE 'channel_%' AND a.expired_at IS NULL
        ORDER BY o.path_code, u.username`,
    );
    return { items: rows };
  }
  async 查询组织详情(id: string) {
    const { rows } = await this.pool.query(
      'SELECT id::text, unit_code AS "unitCode", unit_name AS "unitName", unit_type AS "unitType", parent_unit_id::text AS "parentUnitId", status_code AS "statusCode", sort_order AS "sortOrder", row_version AS "rowVersion" FROM org.org_units WHERE id=$1::uuid',
      [id],
    );
    if (!rows[0]) throw 不存在("组织");
    return rows[0];
  }
  async 新建组织(input: Record<string, unknown>, actor: 组织操作人) {
    const name = 文本(input, "unitName"),
      parent = 可选标识(input, "parentUnitId");
    const type = 可选文本(input, "unitType") || "department";
    if (
      ![
        "headquarters",
        "division",
        "big_region",
        "region",
        "province",
        "city",
        "department",
        "team",
        "channel_company",
        "channel_department",
        "channel_team",
      ].includes(type)
    )
      throw new 应用错误("ORG_REQUEST_INVALID", "unitType不合法。", 400);
    const code = 可选文本(input, "unitCode") || 生成组织编码();
    return this.事务(async (db) => {
      const user = await this.操作人(db, actor);
      const r = await db.query(
        'INSERT INTO org.org_units(unit_code,unit_name,unit_type,parent_unit_id,status_code,sort_order,created_by_user_id) VALUES($1,$2,$3,$4::uuid,\'draft\',$5,$6::uuid) RETURNING id::text,unit_code AS "unitCode",unit_name AS "unitName",row_version AS "rowVersion"',
        [code, name, type, parent, 整数(input, "sortOrder", 0), user],
      );
      if (parent)
        await db.query("SELECT org.assert_unit_parent_compatible($1::uuid,$2::uuid)", [
          r.rows[0].id,
          parent,
        ]);
      await db.query("SELECT org.rebuild_unit_paths()");
      await 审计(db, actor, user, "unit.created", r.rows[0].id, r.rows[0]);
      return r.rows[0];
    });
  }
  async 更新组织(id: string, input: Record<string, unknown>, actor: 组织操作人) {
    return this.事务(async (db) => {
      const before = await 锁定(db, "org.org_units", id);
      const version = 版本(input);
      const parent = 可选标识(input, "parentUnitId") ?? before.parent_unit_id;
      await db.query("SELECT org.assert_no_cycle($1::uuid,$2::uuid)", [id, parent]);
      await db.query("SELECT org.assert_unit_parent_compatible($1::uuid,$2::uuid)", [id, parent]);
      const r = await db.query(
        'UPDATE org.org_units SET unit_name=$1,parent_unit_id=$2::uuid,sort_order=$3,updated_at=now(),row_version=row_version+1 WHERE id=$4::uuid AND row_version=$5 RETURNING id::text,unit_name AS "unitName",parent_unit_id::text AS "parentUnitId",row_version AS "rowVersion"',
        [
          文本(input, "unitName", before.unit_name),
          parent,
          整数(input, "sortOrder", before.sort_order),
          id,
          version,
        ],
      );
      if (!r.rows[0]) throw 冲突();
      await db.query("SELECT org.rebuild_unit_paths()");
      await 审计(db, actor, await this.操作人(db, actor), "unit.updated", id, r.rows[0], before);
      return r.rows[0];
    });
  }
  async 更新组织状态(id: string, input: Record<string, unknown>, actor: 组织操作人) {
    const status = 枚举(input, "statusCode", ["draft", "active", "disabled", "archived"]);
    return this.事务(async (db) => {
      const before = await 锁定(db, "org.org_units", id);
      if (status === "archived") await db.query("SELECT org.assert_archivable($1::uuid)", [id]);
      const r = await db.query(
        'UPDATE org.org_units SET status_code=$1,row_version=row_version+1,updated_at=now() WHERE id=$2::uuid AND row_version=$3 RETURNING id::text,status_code AS "statusCode",row_version AS "rowVersion"',
        [status, id, 版本(input)],
      );
      if (!r.rows[0]) throw 冲突();
      await 审计(
        db,
        actor,
        await this.操作人(db, actor),
        "unit.status_changed",
        id,
        r.rows[0],
        before,
      );
      return r.rows[0];
    });
  }
  async 查询岗位(orgUnitId?: string) {
    const q = await this.pool.query(
      'SELECT id::text,org_unit_id::text AS "orgUnitId",position_code AS "positionCode",position_name AS "positionName",category,status_code AS "statusCode",row_version AS "rowVersion" FROM org.positions WHERE ($1::uuid IS NULL OR org_unit_id=$1::uuid) ORDER BY position_code',
      [orgUnitId || null],
    );
    return { items: q.rows };
  }
  async 新建岗位(input: Record<string, unknown>, actor: 组织操作人) {
    const unit = 标识(input, "orgUnitId"),
      code = 文本(input, "positionCode"),
      name = 文本(input, "positionName");
    return this.写入(
      'INSERT INTO org.positions(org_unit_id,position_code,position_name,category,created_by_user_id) VALUES($1::uuid,$2,$3,$4,$5::uuid) RETURNING id::text,position_code AS "positionCode",position_name AS "positionName",row_version AS "rowVersion"',
      [
        unit,
        code,
        name,
        枚举(input, "category", ["management", "sales", "support", "functional", "other"], "other"),
      ],
      actor,
      "position.created",
    );
  }
  async 更新岗位(id: string, input: Record<string, unknown>, actor: 组织操作人) {
    return this.写入(
      'UPDATE org.positions SET position_name=$1,category=$2,updated_at=now(),row_version=row_version+1 WHERE id=$3::uuid AND row_version=$4 RETURNING id::text,position_name AS "positionName",row_version AS "rowVersion"',
      [
        文本(input, "positionName"),
        枚举(input, "category", ["management", "sales", "support", "functional", "other"]),
        id,
        版本(input),
      ],
      actor,
      "position.updated",
      id,
    );
  }
  async 更新岗位状态(id: string, input: Record<string, unknown>, actor: 组织操作人) {
    return this.写入(
      'UPDATE org.positions SET status_code=$1,updated_at=now(),row_version=row_version+1 WHERE id=$2::uuid AND row_version=$3 RETURNING id::text,status_code AS "statusCode",row_version AS "rowVersion"',
      [枚举(input, "statusCode", ["active", "disabled"]), id, 版本(input)],
      actor,
      "position.status_changed",
      id,
    );
  }
  async 查询任职(orgUnitId?: string) {
    const q = await this.pool.query(
      'SELECT a.id::text,u.display_name AS "displayName",u.username AS "username",a.user_id::text AS "userId",a.org_unit_id::text AS "orgUnitId",a.position_id::text AS "positionId",p.position_name AS "positionName",a.is_primary AS "isPrimary",a.effective_at AS "effectiveAt",a.expired_at AS "expiredAt",a.row_version AS "rowVersion" FROM org.staff_assignments a JOIN iam.users u ON u.id=a.user_id LEFT JOIN org.positions p ON p.id=a.position_id WHERE ($1::uuid IS NULL OR a.org_unit_id=$1::uuid) ORDER BY u.display_name',
      [orgUnitId || null],
    );
    return { items: q.rows };
  }
  async 新建任职(userId: string, input: Record<string, unknown>, actor: 组织操作人) {
    return this.事务(async (db) => {
      const unit = 标识(input, "orgUnitId"),
        position = 可选标识(input, "positionId");
      const user = await this.操作人(db, actor);
      await 锁定任职账号(db, userId);
      const current = await db.query(
        "SELECT 1 FROM org.staff_assignments WHERE user_id=$1::uuid AND expired_at IS NULL LIMIT 1",
        [userId],
      );
      if (current.rows[0])
        throw new 应用错误(
          "ORG_ASSIGNMENT_SINGLE_ACTIVE_ONLY",
          "当前人员已有有效任职，请直接调整现有部门或岗位。",
          409,
        );
      const r = await db.query(
        'INSERT INTO org.staff_assignments(user_id,org_unit_id,position_id,is_primary,effective_at,created_by_user_id) VALUES($1::uuid,$2::uuid,$3::uuid,true,now(),$4::uuid) RETURNING id::text,row_version AS "rowVersion"',
        [userId, unit, position, user],
      );
      await db.query("SELECT org.assert_assignment_consistent($1::uuid)", [r.rows[0].id]);
      await 审计(db, actor, user, "assignment.created", r.rows[0].id, r.rows[0]);
      return r.rows[0];
    });
  }
  async 更新任职(id: string, input: Record<string, unknown>, actor: 组织操作人) {
    const unit = 标识(input, "orgUnitId");
    const position = 可选标识(input, "positionId");
    return this.事务(async (db) => {
      const before = await 锁定(db, "org.staff_assignments", id);
      await 锁定任职账号(db, String(before.user_id));
      const r = await db.query(
        `UPDATE org.staff_assignments
         SET org_unit_id=$1::uuid,position_id=$2::uuid,is_primary=true,
             updated_at=now(),row_version=row_version+1
         WHERE id=$3::uuid AND expired_at IS NULL AND row_version=$4
         RETURNING id::text,org_unit_id::text AS "orgUnitId",position_id::text AS "positionId",
           is_primary AS "isPrimary",row_version::integer AS "rowVersion"`,
        [unit, position, id, 版本(input)],
      );
      if (!r.rows[0]) throw 冲突();
      await db.query("SELECT org.assert_assignment_consistent($1::uuid)", [id]);
      const user = await this.操作人(db, actor);
      await 审计(db, actor, user, "assignment.updated", id, r.rows[0], before);
      return r.rows[0];
    });
  }
  async 结束任职(id: string, input: Record<string, unknown>, actor: 组织操作人) {
    return this.事务(async (db) => {
      const before = await 锁定(db, "org.staff_assignments", id);
      await 锁定任职账号(db, String(before.user_id));
      const r = await db.query(
        `UPDATE org.staff_assignments
         SET expired_at=GREATEST(now(),effective_at+interval '1 millisecond'),
             updated_at=now(),row_version=row_version+1
         WHERE id=$1::uuid AND expired_at IS NULL AND row_version=$2
         RETURNING id::text,row_version AS "rowVersion"`,
        [id, 版本(input)],
      );
      if (!r.rows[0]) throw 冲突();
      const user = await this.操作人(db, actor);
      await 审计(db, actor, user, "assignment.expired", id, r.rows[0], before);
      return r.rows[0];
    });
  }
  async 查询负责人关系(subordinateAssignmentId?: string) {
    const q = await this.pool.query(
      `SELECT r.id::text AS id, r.subordinate_assignment_id::text AS "subordinateAssignmentId",
         r.manager_assignment_id::text AS "managerAssignmentId", r.relation_type AS "relationType",
         r.effective_at AS "effectiveAt", r.expired_at AS "expiredAt", r.row_version AS "rowVersion",
         subordinate_user.display_name AS "subordinateDisplayName",
         manager_user.display_name AS "managerDisplayName"
       FROM org.manager_relations r
       JOIN org.staff_assignments subordinate ON subordinate.id=r.subordinate_assignment_id
       JOIN iam.users subordinate_user ON subordinate_user.id=subordinate.user_id
       JOIN org.staff_assignments manager ON manager.id=r.manager_assignment_id
       JOIN iam.users manager_user ON manager_user.id=manager.user_id
       WHERE ($1::uuid IS NULL OR r.subordinate_assignment_id=$1::uuid)
       ORDER BY r.expired_at NULLS FIRST, r.effective_at DESC`,
      [subordinateAssignmentId || null],
    );
    return { items: q.rows };
  }
  async 新建负责人关系(input: Record<string, unknown>, actor: 组织操作人) {
    const subordinate = 标识(input, "subordinateAssignmentId");
    const manager = 标识(input, "managerAssignmentId");
    const relationType = 枚举(input, "relationType", ["direct", "matrix", "temporary"], "direct");
    const effectiveAt = 可选时间(input, "effectiveAt") || new Date().toISOString();
    const expiredAt = 可选时间(input, "expiredAt");
    return this.事务(async (db) => {
      const user = await this.操作人(db, actor);
      await 校验负责人关系(db, {
        subordinateAssignmentId: subordinate,
        managerAssignmentId: manager,
        relationType,
        effectiveAt,
        expiredAt,
      });
      const r = await db.query(
        `INSERT INTO org.manager_relations(
           subordinate_assignment_id,manager_assignment_id,relation_type,effective_at,expired_at,created_by_user_id
         ) VALUES($1::uuid,$2::uuid,$3,$4::timestamptz,$5::timestamptz,$6::uuid)
         RETURNING id::text AS id, subordinate_assignment_id::text AS "subordinateAssignmentId",
           manager_assignment_id::text AS "managerAssignmentId", relation_type AS "relationType",
           effective_at AS "effectiveAt", expired_at AS "expiredAt", row_version AS "rowVersion"`,
        [subordinate, manager, relationType, effectiveAt, expiredAt, user],
      );
      await 审计(db, actor, user, "manager_relation.created", r.rows[0].id, r.rows[0]);
      return r.rows[0];
    });
  }
  async 更新负责人关系(id: string, input: Record<string, unknown>, actor: 组织操作人) {
    return this.事务(async (db) => {
      const before = await 锁定(db, "org.manager_relations", id);
      const effectiveAt = 可选时间(input, "effectiveAt") || 时间值(before.effective_at);
      const expiredAt =
        input.expiredAt === undefined
          ? before.expired_at
            ? 时间值(before.expired_at)
            : null
          : 可选时间(input, "expiredAt");
      if (before.expired_at && expiredAt === null)
        throw new 应用错误(
          "ORG_RELATION_INVALID",
          "已结束的负责人关系不能重新启用，请新建关系。",
          409,
        );
      const subordinate = 标识默认(
        input,
        "subordinateAssignmentId",
        before.subordinate_assignment_id,
      );
      const manager = 标识默认(input, "managerAssignmentId", before.manager_assignment_id);
      const relationType = 枚举(
        input,
        "relationType",
        ["direct", "matrix", "temporary"],
        before.relation_type,
      );
      await 校验负责人关系(db, {
        subordinateAssignmentId: subordinate,
        managerAssignmentId: manager,
        relationType,
        effectiveAt,
        expiredAt,
        排除关系Id: id,
      });
      const r = await db.query(
        `UPDATE org.manager_relations
         SET subordinate_assignment_id=$1::uuid,manager_assignment_id=$2::uuid,relation_type=$3,
           effective_at=$4::timestamptz,expired_at=$5::timestamptz,row_version=row_version+1
         WHERE id=$6::uuid AND row_version=$7
         RETURNING id::text AS id, subordinate_assignment_id::text AS "subordinateAssignmentId",
           manager_assignment_id::text AS "managerAssignmentId", relation_type AS "relationType",
           effective_at AS "effectiveAt", expired_at AS "expiredAt", row_version AS "rowVersion"`,
        [subordinate, manager, relationType, effectiveAt, expiredAt, id, 版本(input)],
      );
      if (!r.rows[0]) throw 冲突();
      const user = await this.操作人(db, actor);
      await 审计(db, actor, user, "manager_relation.updated", id, r.rows[0], before);
      return r.rows[0];
    });
  }
  async 结束负责人关系(id: string, input: Record<string, unknown>, actor: 组织操作人) {
    return this.事务(async (db) => {
      const before = await 锁定(db, "org.manager_relations", id);
      if (before.expired_at) throw new 应用错误("ORG_RELATION_INVALID", "负责人关系已结束。", 409);
      const expiredAt = 可选时间(input, "expiredAt") || new Date().toISOString();
      if (时间毫秒(expiredAt) <= 时间毫秒(before.effective_at))
        throw new 应用错误("ORG_RELATION_INVALID", "结束时间必须晚于生效时间。", 409);
      const r = await db.query(
        `UPDATE org.manager_relations SET expired_at=$1::timestamptz,row_version=row_version+1
         WHERE id=$2::uuid AND expired_at IS NULL AND row_version=$3
         RETURNING id::text AS id,expired_at AS "expiredAt",row_version AS "rowVersion"`,
        [expiredAt, id, 版本(input)],
      );
      if (!r.rows[0]) throw 冲突();
      const user = await this.操作人(db, actor);
      await 审计(db, actor, user, "manager_relation.expired", id, r.rows[0], before);
      return r.rows[0];
    });
  }
  async 查询业务角色() {
    const q = await this.pool.query(
      `SELECT r.id::text,r.role_code AS "roleCode",r.role_name AS "roleName",r.domain_code AS "domainCode",
         r.category,r.status_code AS "statusCode",r.row_version AS "rowVersion",
         r.linked_certification_template_id::text AS "linkedCertificationTemplateId",
         t.template_name AS "linkedCertificationTemplateName"
       FROM org.business_roles r
       LEFT JOIN org.certification_templates t ON t.id=r.linked_certification_template_id
       ORDER BY r.role_code`,
    );
    return { items: q.rows };
  }
  async 新建业务角色(input: Record<string, unknown>, actor: 组织操作人) {
    const linkedTemplate = 可选标识(input, "linkedCertificationTemplateId");
    return this.写入(
      'INSERT INTO org.business_roles(role_code,role_name,domain_code,category,linked_certification_template_id,created_by_user_id) VALUES($1,$2,$3,$4,$5::uuid,$6::uuid) RETURNING id::text,role_code AS "roleCode",role_name AS "roleName",linked_certification_template_id::text AS "linkedCertificationTemplateId",row_version AS "rowVersion"',
      [
        文本(input, "roleCode"),
        文本(input, "roleName"),
        枚举(input, "domainCode", ["internal", "channel"]),
        枚举(
          input,
          "category",
          [
            "sales",
            "pre_sales",
            "post_sales",
            "tech_engineer",
            "business_assistant",
            "manager",
            "other",
          ],
          "other",
        ),
        linkedTemplate,
      ],
      actor,
      "business_role.created",
    );
  }
  async 更新业务角色(id: string, input: Record<string, unknown>, actor: 组织操作人) {
    return this.事务(async (db) => {
      const before = await 锁定(db, "org.business_roles", id);
      if (input.domainCode !== undefined && input.domainCode !== before.domain_code)
        throw new 应用错误(
          "ORG_BUSINESS_ROLE_DOMAIN_IMMUTABLE",
          "业务角色创建后不能变更所属域。",
          409,
        );
      const r = await db.query(
        `UPDATE org.business_roles SET role_name=$1,category=$2,description=$3,
           linked_certification_template_id=$4::uuid,updated_at=now(),row_version=row_version+1
         WHERE id=$5::uuid AND row_version=$6
         RETURNING id::text AS id,role_code AS "roleCode",role_name AS "roleName",
           domain_code AS "domainCode",category,status_code AS "statusCode",
           linked_certification_template_id::text AS "linkedCertificationTemplateId",
           row_version AS "rowVersion"`,
        [
          文本(input, "roleName", before.role_name),
          枚举(
            input,
            "category",
            [
              "sales",
              "pre_sales",
              "post_sales",
              "tech_engineer",
              "business_assistant",
              "manager",
              "other",
            ],
            before.category,
          ),
          可选文本默认(input, "description", before.description),
          标识默认(input, "linkedCertificationTemplateId", before.linked_certification_template_id),
          id,
          版本(input),
        ],
      );
      if (!r.rows[0]) throw 冲突();
      const user = await this.操作人(db, actor);
      await 审计(db, actor, user, "business_role.updated", id, r.rows[0], before);
      return r.rows[0];
    });
  }
  async 更新业务角色状态(id: string, input: Record<string, unknown>, actor: 组织操作人) {
    return this.事务(async (db) => {
      const before = await 锁定(db, "org.business_roles", id);
      const r = await db.query(
        `UPDATE org.business_roles SET status_code=$1,updated_at=now(),row_version=row_version+1
         WHERE id=$2::uuid AND row_version=$3
         RETURNING id::text AS id,status_code AS "statusCode",row_version AS "rowVersion"`,
        [枚举(input, "statusCode", ["active", "disabled"]), id, 版本(input)],
      );
      if (!r.rows[0]) throw 冲突();
      const user = await this.操作人(db, actor);
      await 审计(db, actor, user, "business_role.status_changed", id, r.rows[0], before);
      return r.rows[0];
    });
  }
  async 查询成员业务角色(
    筛选: {
      businessRoleId?: string;
      staffAssignmentId?: string;
      partnerMemberId?: string;
    } = {},
  ) {
    const q = await this.pool.query(
      `SELECT m.id::text AS id,m.business_role_id::text AS "businessRoleId",b.role_code AS "roleCode",
         b.role_name AS "roleName",b.domain_code AS "domainCode",
         m.staff_assignment_id::text AS "staffAssignmentId",m.partner_member_id::text AS "partnerMemberId",
         COALESCE(internal_user.id,channel_user.id)::text AS "userId",
         COALESCE(internal_user.display_name,channel_user.display_name) AS "displayName",
         m.is_primary_display AS "isPrimaryDisplay",m.effective_at AS "effectiveAt",
         m.expired_at AS "expiredAt",m.row_version AS "rowVersion",
         m.source_code AS "sourceCode",m.certification_id::text AS "certificationId",
         ct.template_name AS "certificationTemplateName"
       FROM org.member_business_roles m
       LEFT JOIN org.member_certifications mc ON mc.id=m.certification_id
       LEFT JOIN org.certification_templates ct ON ct.id=mc.certification_template_id
       JOIN org.business_roles b ON b.id=m.business_role_id
       LEFT JOIN org.staff_assignments assignment ON assignment.id=m.staff_assignment_id
       LEFT JOIN iam.users internal_user ON internal_user.id=assignment.user_id
       LEFT JOIN channel.partner_members member ON member.id=m.partner_member_id
       LEFT JOIN iam.users channel_user ON channel_user.id=member.user_id
       WHERE ($1::uuid IS NULL OR m.business_role_id=$1::uuid)
         AND ($2::uuid IS NULL OR m.staff_assignment_id=$2::uuid)
         AND ($3::uuid IS NULL OR m.partner_member_id=$3::uuid)
       ORDER BY b.role_code, m.expired_at NULLS FIRST, m.effective_at DESC`,
      [筛选.businessRoleId || null, 筛选.staffAssignmentId || null, 筛选.partnerMemberId || null],
    );
    return { items: q.rows };
  }
  async 指派成员业务角色(input: Record<string, unknown>, actor: 组织操作人) {
    const businessRoleId = 标识(input, "businessRoleId");
    const staffAssignmentId = 可选标识(input, "staffAssignmentId");
    const partnerMemberId = 可选标识(input, "partnerMemberId");
    if ((staffAssignmentId ? 1 : 0) + (partnerMemberId ? 1 : 0) !== 1)
      throw new 应用错误(
        "ORG_MEMBER_ROLE_TARGET_INVALID",
        "业务角色必须且只能关联一条内部任职或渠道成员关系。",
        400,
      );
    const effectiveAt = 可选时间(input, "effectiveAt") || new Date().toISOString();
    const expiredAt = 可选时间(input, "expiredAt");
    if (expiredAt && 时间毫秒(expiredAt) <= 时间毫秒(effectiveAt))
      throw new 应用错误("ORG_MEMBER_ROLE_INVALID", "成员业务角色到期时间必须晚于生效时间。", 409);
    return this.事务(async (db) => {
      const user = await this.操作人(db, actor);
      const role = await 锁定(db, "org.business_roles", businessRoleId);
      if (role.status_code !== "active")
        throw new 应用错误("ORG_BUSINESS_ROLE_DISABLED", "已停用的业务角色不能再指派。", 409);
      const member = await 锁定业务角色成员(db, staffAssignmentId, partnerMemberId);
      if (role.domain_code !== member.domainCode)
        throw new 应用错误(
          "ORG_MEMBER_ROLE_DOMAIN_MISMATCH",
          "内部与渠道业务角色不能跨域指派。",
          409,
        );
      校验关系有效期(member, effectiveAt, expiredAt, "成员关系");
      await 锁定成员业务角色范围(db, staffAssignmentId, partnerMemberId);
      if (
        ["internal_sales", "internal_technical", "channel_sales", "channel_technical"].includes(
          String(role.role_code),
        )
      ) {
        const current = await db.query<{ business_role_id: string }>(
          `SELECT m.business_role_id::text
           FROM org.member_business_roles m
           JOIN org.business_roles b ON b.id=m.business_role_id
           WHERE m.expired_at IS NULL
             AND (($1::uuid IS NOT NULL AND m.staff_assignment_id=$1::uuid)
               OR ($2::uuid IS NOT NULL AND m.partner_member_id=$2::uuid))
             AND b.role_code IN ('internal_sales','internal_technical','channel_sales','channel_technical')
           FOR UPDATE OF m`,
          [staffAssignmentId, partnerMemberId],
        );
        if (current.rows.some((item) => item.business_role_id === businessRoleId))
          throw new 应用错误("ORG_MEMBER_ROLE_UNCHANGED", "当前人员已经是所选业务角色。", 409);
        await db.query(
          `UPDATE org.member_business_roles m
           SET expired_at=GREATEST(now(),m.effective_at+interval '1 millisecond'),
               row_version=m.row_version+1
           FROM org.business_roles b
           WHERE b.id=m.business_role_id AND m.expired_at IS NULL
             AND (($1::uuid IS NOT NULL AND m.staff_assignment_id=$1::uuid)
               OR ($2::uuid IS NOT NULL AND m.partner_member_id=$2::uuid))
             AND b.role_code IN ('internal_sales','internal_technical','channel_sales','channel_technical')`,
          [staffAssignmentId, partnerMemberId],
        );
      }
      await 校验成员业务角色不重叠(db, {
        businessRoleId,
        staffAssignmentId,
        partnerMemberId,
        effectiveAt,
        expiredAt,
        isPrimaryDisplay: 布尔(input, "isPrimaryDisplay", false),
      });
      const r = await db.query(
        `INSERT INTO org.member_business_roles(
           business_role_id,staff_assignment_id,partner_member_id,is_primary_display,effective_at,expired_at,created_by_user_id
         ) VALUES($1::uuid,$2::uuid,$3::uuid,$4,$5::timestamptz,$6::timestamptz,$7::uuid)
         RETURNING id::text AS id,business_role_id::text AS "businessRoleId",
           staff_assignment_id::text AS "staffAssignmentId",partner_member_id::text AS "partnerMemberId",
           is_primary_display AS "isPrimaryDisplay",effective_at AS "effectiveAt",expired_at AS "expiredAt",
           row_version AS "rowVersion"`,
        [
          businessRoleId,
          staffAssignmentId,
          partnerMemberId,
          布尔(input, "isPrimaryDisplay", false),
          effectiveAt,
          expiredAt,
          user,
        ],
      );
      // D-02：这里只记录业务身份，绝不自动写入 IAM 权限或权限角色映射。
      await 审计(db, actor, user, "member_business_role.assigned", r.rows[0].id, r.rows[0]);
      return r.rows[0];
    });
  }
  async 结束成员业务角色(id: string, input: Record<string, unknown>, actor: 组织操作人) {
    return this.事务(async (db) => {
      const before = await 锁定(db, "org.member_business_roles", id);
      if (before.expired_at)
        throw new 应用错误("ORG_MEMBER_ROLE_INVALID", "成员业务角色已到期。", 409);
      const expiredAt = 可选时间(input, "expiredAt") || new Date().toISOString();
      if (时间毫秒(expiredAt) <= 时间毫秒(before.effective_at))
        throw new 应用错误("ORG_MEMBER_ROLE_INVALID", "到期时间必须晚于生效时间。", 409);
      const r = await db.query(
        `UPDATE org.member_business_roles SET expired_at=$1::timestamptz,row_version=row_version+1
         WHERE id=$2::uuid AND expired_at IS NULL AND row_version=$3
         RETURNING id::text AS id,expired_at AS "expiredAt",row_version AS "rowVersion"`,
        [expiredAt, id, 版本(input)],
      );
      if (!r.rows[0]) throw 冲突();
      const user = await this.操作人(db, actor);
      // D-02：到期只结束业务角色事实，不自动撤销 IAM 权限。
      await 审计(db, actor, user, "member_business_role.expired", id, r.rows[0], before);
      return r.rows[0];
    });
  }
  async 查询证书模板(类别?: string) {
    const q = await this.pool.query(
      'SELECT id::text,template_code AS "templateCode",template_name AS "templateName",category,status_code AS "statusCode",row_version AS "rowVersion" FROM org.certification_templates WHERE ($1::text IS NULL OR category=$1::text) ORDER BY template_code',
      [类别 || null],
    );
    return { items: q.rows };
  }
  async 新建证书模板(input: Record<string, unknown>, actor: 组织操作人) {
    return this.写入(
      'INSERT INTO org.certification_templates(template_code,template_name,category,issuer_name,validity_months,created_by_user_id) VALUES($1,$2,$3,$4,$5,$6::uuid) RETURNING id::text,template_code AS "templateCode",template_name AS "templateName",row_version AS "rowVersion"',
      [
        文本(input, "templateCode"),
        文本(input, "templateName"),
        文本(input, "category", "other"),
        可选文本(input, "issuerName"),
        可选正整数(input, "validityMonths"),
      ],
      actor,
      "certification_template.created",
    );
  }
  async 查询成员证书(
    userId?: string,
    筛选: {
      orgUnitId?: string;
      partnerId?: string;
      regionId?: string;
      category?: string;
      templateName?: string;
      partnerIds?: string[];
    } = {},
  ) {
    const { rows } = await this.pool.query(
      `SELECT c.id::text AS "id",c.user_id::text AS "userId",u.display_name AS "displayName",
              t.template_name AS "templateName",t.category AS "category",
              c.issued_on AS "issuedOn",c.expires_on AS "expiresOn",c.status_code AS "statusCode",
              c.row_version AS "rowVersion",
              ia.org_unit_id::text AS "orgUnitId",ou.unit_name AS "orgUnitName",
              pm.partner_id::text AS "partnerId",pp.partner_name AS "partnerName"
       FROM org.member_certifications c
       JOIN iam.users u ON u.id=c.user_id
       JOIN org.certification_templates t ON t.id=c.certification_template_id
       LEFT JOIN LATERAL (
         SELECT org_unit_id FROM org.staff_assignments WHERE user_id=c.user_id AND expired_at IS NULL
         ORDER BY is_primary DESC, effective_at DESC LIMIT 1
       ) ia ON true
       LEFT JOIN org.org_units ou ON ou.id=ia.org_unit_id
       LEFT JOIN LATERAL (
         SELECT partner_id FROM channel.partner_members
         WHERE user_id=c.user_id AND status_code='active' AND archived_at IS NULL
         ORDER BY started_at DESC LIMIT 1
       ) pm ON true
       LEFT JOIN channel.partners pp ON pp.id=pm.partner_id
       WHERE ($1::uuid IS NULL OR c.user_id=$1::uuid)
         AND ($2::uuid IS NULL OR EXISTS (
           SELECT 1
           FROM org.staff_assignments sa
           JOIN org.org_units sau ON sau.id=sa.org_unit_id
           WHERE sa.user_id=c.user_id AND sa.expired_at IS NULL
             AND sau.path_code <@ (SELECT path_code FROM org.org_units WHERE id=$2::uuid)
         ))
         AND ($3::uuid IS NULL OR EXISTS (
           SELECT 1 FROM channel.partner_members cpm
           WHERE cpm.user_id=c.user_id AND cpm.partner_id=$3::uuid
             AND cpm.status_code='active' AND cpm.archived_at IS NULL
         ))
         AND ($4::uuid IS NULL OR EXISTS (
           SELECT 1
           FROM channel.partner_members cpm
           JOIN channel.partners cp ON cp.id=cpm.partner_id
           WHERE cpm.user_id=c.user_id AND cpm.status_code='active' AND cpm.archived_at IS NULL
             AND cp.region_id IN (
               WITH RECURSIVE 子树 AS (
                 SELECT id FROM org.regions WHERE id=$4::uuid
                 UNION ALL
                 SELECT r.id FROM org.regions r JOIN 子树 ON r.parent_region_id=子树.id
               )
               SELECT id FROM 子树
             )
         ))
         AND ($5::text IS NULL OR t.category=$5::text)
         AND ($6::text IS NULL OR t.template_name ILIKE '%' || $6::text || '%')
         AND ($7::uuid[] IS NULL OR EXISTS (
           SELECT 1 FROM channel.partner_members cpm
           WHERE cpm.user_id=c.user_id AND cpm.partner_id=ANY($7::uuid[])
             AND cpm.status_code='active' AND cpm.archived_at IS NULL
         ))
       ORDER BY c.expires_on NULLS LAST`,
      [
        userId || null,
        筛选.orgUnitId || null,
        筛选.partnerId || null,
        筛选.regionId || null,
        筛选.category || null,
        筛选.templateName || null,
        筛选.partnerIds && 筛选.partnerIds.length ? 筛选.partnerIds : null,
      ],
    );
    return { items: rows };
  }
  async 颁发证书(userId: string, input: Record<string, unknown>, actor: 组织操作人) {
    const templateId = 标识(input, "certificationTemplateId");
    return this.事务(async (db) => {
      const 操作人 = await this.操作人(db, actor);
      await 校验可颁发证书(db, userId, templateId);
      const r = await db.query(
        `INSERT INTO org.member_certifications(user_id,certification_template_id,certificate_no,issuer_name,issued_on,expires_on,created_by_user_id)
         VALUES($1::uuid,$2::uuid,$3,$4,$5::date,$6::date,$7::uuid)
         RETURNING id::text,row_version AS "rowVersion"`,
        [
          userId,
          templateId,
          可选文本(input, "certificateNo"),
          可选文本(input, "issuerName"),
          日期(input, "issuedOn"),
          可选日期(input, "expiresOn"),
          操作人,
        ],
      );
      const 证书 = r.rows[0];
      await 审计(db, actor, 操作人, "certification.issued", 证书.id, 证书);
      return 证书;
    });
  }
  async 延期证书(id: string, input: Record<string, unknown>, actor: 组织操作人) {
    return this.写入(
      'UPDATE org.member_certifications SET expires_on=$1::date,updated_at=now(),row_version=row_version+1 WHERE id=$2::uuid AND status_code=\'active\' AND row_version=$3 RETURNING id::text,expires_on AS "expiresOn",row_version AS "rowVersion"',
      [日期(input, "expiresOn"), id, 版本(input)],
      actor,
      "certification.extended",
      id,
    );
  }
  async 撤销证书(id: string, input: Record<string, unknown>, actor: 组织操作人) {
    const reason = 文本(input, "reason");
    return this.事务(async (db) => {
      const 操作人 = await this.操作人(db, actor);
      const r = await db.query(
        `UPDATE org.member_certifications SET status_code='revoked',revoke_reason=$1,revoked_at=now(),updated_at=now(),row_version=row_version+1
         WHERE id=$2::uuid AND status_code='active' AND row_version=$3
         RETURNING id::text,status_code AS "statusCode",row_version AS "rowVersion"`,
        [reason, id, 版本(input)],
      );
      if (!r.rows[0]) throw 冲突();
      const 证书 = r.rows[0];
      await 审计(db, actor, 操作人, "certification.revoked", id, 证书);
      return 证书;
    });
  }
  async 统计未归集管理账号() {
    const { rows } = await this.pool.query(
      `SELECT count(*)::int AS total
       FROM iam.users u
       JOIN iam.user_roles ur ON ur.user_id=u.id
       JOIN iam.roles r ON r.id=ur.role_id
       WHERE r.role_code IN ('superadmin','region_manager','admin') AND u.status_code='active'
         AND NOT EXISTS (
           SELECT 1 FROM org.staff_assignments sa
           WHERE sa.user_id=u.id AND sa.expired_at IS NULL
         )`,
    );
    return { unassigned: rows[0]?.total || 0 };
  }
  async 同步管理账号(actor: 组织操作人) {
    return this.事务(async (db) => {
      const 操作人 = await this.操作人(db, actor);
      const 根 = await db.query(
        "SELECT id FROM org.org_units WHERE parent_unit_id IS NULL AND unit_type NOT LIKE 'channel_%' AND status_code='active' ORDER BY created_at LIMIT 1",
      );
      if (!根.rows[0])
        throw new 应用错误("ORG_ROOT_UNIT_MISSING", "组织架构缺少根部门，请先创建根组织。", 400);
      const 根Id = 根.rows[0].id;
      const 已归集 = new Set<string>(
        (
          await db.query(
            "SELECT DISTINCT user_id FROM org.staff_assignments WHERE expired_at IS NULL",
          )
        ).rows.map((r: { user_id: string }) => r.user_id),
      );
      const 角色 = new Map<string, string>();
      for (const 编码 of ["superadmin", "region_manager", "admin"]) {
        const r = await db.query("SELECT id::text AS id FROM iam.roles WHERE role_code=$1", [编码]);
        if (r.rows[0]) 角色.set(编码, r.rows[0].id);
      }
      const 统计 = { superadmin: 0, regionManager: 0, admin: 0, skipped: 0, departmentsCreated: 0 };
      // 超管归集到根部门
      if (角色.has("superadmin")) {
        const 用户 = await db.query(
          "SELECT u.id::text AS id,u.display_name AS \"displayName\" FROM iam.users u JOIN iam.user_roles ur ON ur.user_id=u.id WHERE ur.role_id=$1::uuid AND u.status_code='active'",
          [角色.get("superadmin")],
        );
        for (const 行 of 用户.rows as Array<{ id: string; displayName: string }>) {
          if (已归集.has(行.id)) {
            统计.skipped++;
            continue;
          }
          await db.query(
            "INSERT INTO org.staff_assignments(user_id,org_unit_id,position_id,is_primary,effective_at,created_by_user_id,source_code) VALUES($1::uuid,$2::uuid,NULL,true,now(),$3::uuid,'manual')",
            [行.id, 根Id, 操作人],
          );
          已归集.add(行.id);
          统计.superadmin++;
          await 审计(db, actor, 操作人, "assignment.created", null, {
            userId: 行.id,
            orgUnitId: 根Id,
            displayName: 行.displayName,
          });
        }
      }
      // 管理员（admin）归集到根部门，保证全部管理账号在组织树可见
      if (角色.has("admin")) {
        const 用户 = await db.query(
          "SELECT u.id::text AS id,u.display_name AS \"displayName\" FROM iam.users u JOIN iam.user_roles ur ON ur.user_id=u.id WHERE ur.role_id=$1::uuid AND u.status_code='active'",
          [角色.get("admin")],
        );
        for (const 行 of 用户.rows as Array<{ id: string; displayName: string }>) {
          if (已归集.has(行.id)) {
            统计.skipped++;
            continue;
          }
          await db.query(
            "INSERT INTO org.staff_assignments(user_id,org_unit_id,position_id,is_primary,effective_at,created_by_user_id,source_code) VALUES($1::uuid,$2::uuid,NULL,true,now(),$3::uuid,'manual')",
            [行.id, 根Id, 操作人],
          );
          已归集.add(行.id);
          统计.admin++;
          await 审计(db, actor, 操作人, "assignment.created", null, {
            userId: 行.id,
            orgUnitId: 根Id,
            displayName: 行.displayName,
          });
        }
      }
      // 区管按负责区域归集到内部区域部门（根 → 大区 → 区域），无区域则挂根部门
      if (角色.has("region_manager")) {
        const 区管 = await db.query(
          `SELECT u.id::text AS id,u.display_name AS "displayName",u.region_id::text AS "regionId",
                  r.region_name AS "regionName",r.parent_region_id::text AS "bigRegionId",
                  b.region_name AS "bigRegionName"
           FROM iam.users u
           JOIN iam.user_roles ur ON ur.user_id=u.id
           LEFT JOIN org.regions r ON r.id=u.region_id
           LEFT JOIN org.regions b ON b.id=r.parent_region_id
           WHERE ur.role_id=$1::uuid AND u.status_code='active'`,
          [角色.get("region_manager")],
        );
        const 部门缓存 = new Map<string, string>();
        const 取部门 = async (名称: string, 父Id: string): Promise<string> => {
          const 键 = 父Id + "|" + 名称;
          if (部门缓存.has(键)) return 部门缓存.get(键)!;
          const 已有 = await db.query(
            "SELECT id::text AS id FROM org.org_units WHERE parent_unit_id=$1::uuid AND unit_name=$2 AND unit_type NOT LIKE 'channel_%' AND status_code='active' ORDER BY created_at LIMIT 1",
            [父Id, 名称],
          );
          if (已有.rows[0]) {
            部门缓存.set(键, 已有.rows[0].id);
            return 已有.rows[0].id;
          }
          const 新建 = await db.query(
            "INSERT INTO org.org_units(unit_code,unit_name,unit_type,parent_unit_id,status_code,sort_order,created_by_user_id) VALUES($1,$2,'department',$3::uuid,'active',0,$4::uuid) RETURNING id::text AS id",
            [生成组织编码(), 名称, 父Id, 操作人],
          );
          统计.departmentsCreated++;
          部门缓存.set(键, 新建.rows[0].id);
          await 审计(db, actor, 操作人, "unit.created", null, {
            unitName: 名称,
            parentUnitId: 父Id,
          });
          return 新建.rows[0].id;
        };
        for (const 行 of 区管.rows as Array<{
          id: string;
          displayName: string;
          regionId: string | null;
          regionName: string | null;
          bigRegionId: string | null;
          bigRegionName: string | null;
        }>) {
          if (已归集.has(行.id)) {
            统计.skipped++;
            continue;
          }
          let 部门Id = 根Id;
          if (行.regionId && 行.regionName) {
            if (行.bigRegionId && 行.bigRegionName) {
              const 大区Id = await 取部门(行.bigRegionName, 根Id);
              部门Id = await 取部门(行.regionName, 大区Id);
            } else {
              部门Id = await 取部门(行.regionName, 根Id);
            }
          }
          await db.query(
            "INSERT INTO org.staff_assignments(user_id,org_unit_id,position_id,is_primary,effective_at,created_by_user_id,source_code) VALUES($1::uuid,$2::uuid,NULL,true,now(),$3::uuid,'manual')",
            [行.id, 部门Id, 操作人],
          );
          已归集.add(行.id);
          统计.regionManager++;
          await 审计(db, actor, 操作人, "assignment.created", null, {
            userId: 行.id,
            orgUnitId: 部门Id,
            displayName: 行.displayName,
          });
        }
      }
      await 审计(db, actor, 操作人, "admin_accounts.synced", null, 统计);
      return 统计;
    });
  }
  async 删除用户(userId: string, actor: 组织操作人) {
    void userId;
    void actor;
    throw new 应用错误(
      "ORG_PHYSICAL_DELETE_DISABLED",
      "业务账号不允许物理删除，请先预览影响并发起停用归档与离职交接。",
      409,
    );
  }
  async 查询数据范围(subjectType: string, subjectId: string) {
    断言数据范围主体类型(subjectType, false);
    if (subjectType === "user") return { subjectType, subjectId, runtimeApplied: false, items: [] };
    const q = await this.pool.query(
      `SELECT id::text, role_id::text AS "roleId", resource_code AS "resourceCode",
              scope_type AS "scopeType", scope_ref_id::text AS "scopeRefId",
              status_code AS "statusCode", row_version AS "rowVersion"
       FROM iam.data_scope_bindings
       WHERE role_id=$1::uuid
       ORDER BY resource_code, scope_type, created_at`,
      [subjectId],
    );
    return { subjectType, subjectId, runtimeApplied: false, items: q.rows };
  }
  async 保存数据范围(
    subjectType: string,
    subjectId: string,
    input: Record<string, unknown>,
    actor: 组织操作人,
  ) {
    断言数据范围主体类型(subjectType, true);
    const resourceCode = 枚举(input, "resourceCode", 数据范围资源代码);
    const scopeType = 枚举(input, "scopeType", 数据范围类型);
    const scopeRefId = 可选标识(input, "scopeRefId");
    校验数据范围引用(scopeType, scopeRefId);
    return this.事务(async (db) => {
      const user = await this.操作人(db, actor);
      await 断言数据范围角色有效(db, subjectId);
      await 断言数据范围引用有效(db, scopeType, scopeRefId);
      const existing = await db.query(
        `SELECT * FROM iam.data_scope_bindings
         WHERE role_id=$1::uuid AND resource_code=$2 AND scope_type=$3
           AND scope_ref_id IS NOT DISTINCT FROM $4::uuid AND status_code='active'
         FOR UPDATE`,
        [subjectId, resourceCode, scopeType, scopeRefId],
      );
      if (existing.rows[0]) {
        const before = existing.rows[0];
        const r = await db.query(
          `UPDATE iam.data_scope_bindings
           SET updated_at=now(), row_version=row_version+1, created_by_user_id=$1::uuid
           WHERE id=$2::uuid AND row_version=$3
           RETURNING id::text, role_id::text AS "roleId", resource_code AS "resourceCode",
                     scope_type AS "scopeType", scope_ref_id::text AS "scopeRefId",
                     status_code AS "statusCode", row_version AS "rowVersion"`,
          [user, before.id, 版本(input)],
        );
        if (!r.rows[0]) throw 冲突();
        await 审计(db, actor, user, "data_scope.bound", r.rows[0].id, r.rows[0], before);
        return { runtimeApplied: false, ...r.rows[0] };
      }
      if (input.rowVersion !== undefined)
        throw new 应用错误(
          "ORG_DATA_SCOPE_NOT_FOUND",
          "数据范围绑定不存在，不能使用历史版本更新。",
          404,
        );
      const r = await db.query(
        `INSERT INTO iam.data_scope_bindings(
           role_id, resource_code, scope_type, scope_ref_id, created_by_user_id
         ) VALUES($1::uuid,$2,$3,$4::uuid,$5::uuid)
         RETURNING id::text, role_id::text AS "roleId", resource_code AS "resourceCode",
                   scope_type AS "scopeType", scope_ref_id::text AS "scopeRefId",
                   status_code AS "statusCode", row_version AS "rowVersion"`,
        [subjectId, resourceCode, scopeType, scopeRefId, user],
      );
      await 审计(db, actor, user, "data_scope.bound", r.rows[0].id, r.rows[0]);
      return { runtimeApplied: false, ...r.rows[0] };
    });
  }
  async 停用数据范围(id: string, input: Record<string, unknown>, actor: 组织操作人) {
    return this.事务(async (db) => {
      const user = await this.操作人(db, actor);
      const before = await 锁定(db, "iam.data_scope_bindings", id);
      const r = await db.query(
        `UPDATE iam.data_scope_bindings
         SET status_code='disabled', updated_at=now(), row_version=row_version+1
         WHERE id=$1::uuid AND status_code='active' AND row_version=$2
         RETURNING id::text, role_id::text AS "roleId", resource_code AS "resourceCode",
                   scope_type AS "scopeType", scope_ref_id::text AS "scopeRefId",
                   status_code AS "statusCode", row_version AS "rowVersion"`,
        [id, 版本(input)],
      );
      if (!r.rows[0]) throw 冲突();
      await 审计(db, actor, user, "data_scope.unbound", id, r.rows[0], before);
      return { runtimeApplied: false, ...r.rows[0] };
    });
  }
  async 查询离职交接() {
    const q = await this.pool.query(
      'SELECT h.id::text,h.user_id::text AS "userId",u.display_name AS "displayName",h.status_code AS "statusCode",h.effective_at AS "effectiveAt",h.row_version AS "rowVersion" FROM org.offboarding_handover h JOIN iam.users u ON u.id=h.user_id ORDER BY h.created_at DESC',
    );
    return { items: q.rows };
  }
  async 发起离职交接(input: Record<string, unknown>, actor: 组织操作人) {
    return this.事务(async (db) => {
      const user = await this.操作人(db, actor),
        target = 标识(input, "userId");
      await 锁定交接目标账号(db, target);
      const 上下文 = await 查询交接上下文(db, target);
      校验可发起账号交接(上下文, actor);
      if (上下文.statusCode !== "active" || 上下文.offboardingStatus !== "active")
        throw new 应用错误("ORG_OFFBOARDING_USER_UNAVAILABLE", "该账号已停用或已在交接中。", 409);
      const 确认账号 = 文本(input, "confirmationUsername");
      if (确认账号.toLowerCase() !== 上下文.username.toLowerCase())
        throw new 应用错误(
          "ORG_OFFBOARDING_CONFIRMATION_INVALID",
          "二次确认账号与目标账号不一致。",
          400,
        );
      const 影响 = await 查询交接影响(db, 上下文);
      let 候选人 = await 查询交接候选人(db, 上下文);
      let 接收人 = 可选标识(input, "replacementUserId");
      const 必须交接管理覆盖 = 上下文.roleCodes.some((角色) =>
        ["superadmin", "admin", "region_manager"].includes(角色),
      );
      const 必须选择接收人 = 影响.totalCount > 0 || 必须交接管理覆盖;
      if (!接收人 && 必须选择接收人 && 候选人.length === 1) 接收人 = 候选人[0]!.id;
      if (接收人) {
        await 锁定交接接收账号(db, 接收人);
        候选人 = await 查询交接候选人(db, 上下文);
      }
      if (必须选择接收人 && !接收人)
        throw new 应用错误(
          "ORG_OFFBOARDING_RECIPIENT_REQUIRED",
          候选人.length
            ? "存在待交接业务，请选择符合范围的接收人。"
            : "不存在符合范围的有效接收人，请先补充同区域区管或其他超级管理员。",
          409,
        );
      if (接收人 && !候选人.some((候选) => 候选.id === 接收人))
        throw new 应用错误(
          "ORG_OFFBOARDING_RECIPIENT_INVALID",
          "接收人必须是符合目标账号角色和区域范围的有效账号。",
          409,
        );
      const 生效时间 = 时间(input, "effectiveAt");
      if (Date.parse(生效时间) > Date.now() + 60_000)
        throw new 应用错误(
          "ORG_OFFBOARDING_EFFECTIVE_AT_INVALID",
          "停用归档提交后立即生效，生效时间不能晚于当前时间。",
          400,
        );
      const r = await db.query(
        `INSERT INTO org.offboarding_handover(
           user_id,effective_at,replacement_user_id,reason,created_by_user_id,scan_requested_at,
           target_role_codes,target_region_id
         ) VALUES($1::uuid,$2::timestamptz,$3::uuid,$4,$5::uuid,now(),$6::text[],$7::uuid)
         RETURNING id::text,status_code AS "statusCode",scan_requested_at AS "scanRequestedAt",
                   row_version AS "rowVersion"`,
        [target, 生效时间, 接收人, 文本(input, "reason"), user, 上下文.roleCodes, 上下文.regionId],
      );
      await db.query(
        "UPDATE iam.users SET status_code='disabled',offboarding_status='offboarding',offboarding_handover_id=$1::uuid,updated_at=now(),row_version=row_version+1 WHERE id=$2::uuid",
        [r.rows[0].id, target],
      );
      await db.query(
        `UPDATE org.staff_assignments
         SET expired_at=GREATEST(now(),effective_at+interval '1 millisecond'),
             updated_at=now(),row_version=row_version+1
         WHERE user_id=$1::uuid AND expired_at IS NULL`,
        [target],
      );
      await db.query(
        `UPDATE org.manager_relations
         SET expired_at=GREATEST(now(),effective_at+interval '1 millisecond'),row_version=row_version+1
         WHERE expired_at IS NULL
           AND (
             subordinate_assignment_id IN (SELECT id FROM org.staff_assignments WHERE user_id=$1::uuid)
             OR manager_assignment_id IN (SELECT id FROM org.staff_assignments WHERE user_id=$1::uuid)
           )`,
        [target],
      );
      await db.query(
        `UPDATE org.member_business_roles
         SET expired_at=GREATEST(now(),effective_at+interval '1 millisecond'),row_version=row_version+1
         WHERE expired_at IS NULL
           AND (
             staff_assignment_id IN (SELECT id FROM org.staff_assignments WHERE user_id=$1::uuid)
             OR partner_member_id IN (SELECT id FROM channel.partner_members WHERE user_id=$1::uuid)
           )`,
        [target],
      );
      await db.query(
        `UPDATE channel.partner_members
         SET status_code='disabled',
             ended_at=COALESCE(ended_at,GREATEST(now(),started_at+interval '1 millisecond')),
             expired_at=COALESCE(expired_at,GREATEST(now(),effective_at+interval '1 millisecond'))
         WHERE user_id=$1::uuid AND status_code='active'`,
        [target],
      );
      await db.query(
        `INSERT INTO org.offboarding_role_snapshots(
           handover_id,user_id,role_id,role_code,role_name,captured_by_user_id
         )
         SELECT $1::uuid,$2::uuid,角色.id,角色.role_code,角色.role_name,$3::uuid
         FROM iam.user_roles 用户角色
         JOIN iam.roles 角色 ON 角色.id=用户角色.role_id
         WHERE 用户角色.user_id=$2::uuid
         ON CONFLICT (handover_id,role_id) DO NOTHING`,
        [r.rows[0].id, target, user],
      );
      await db.query("DELETE FROM iam.user_roles WHERE user_id=$1::uuid", [target]);
      await db.query(
        "INSERT INTO ops.outbox_events(event_type,aggregate_type,aggregate_id,payload_json) VALUES('org.offboarding.scan_requested','offboarding_handover',$1::uuid,$2::jsonb)",
        [r.rows[0].id, JSON.stringify({ handoverId: r.rows[0].id })],
      );
      const 结果 = {
        ...r.rows[0],
        userId: target,
        replacementUserId: 接收人 || null,
        accountDisabled: true,
        affectedCount: 影响.totalCount,
      };
      await 审计(db, actor, user, "offboarding.initiated", r.rows[0].id, 结果, {
        userId: target,
        username: 上下文.username,
        statusCode: 上下文.statusCode,
        offboardingStatus: 上下文.offboardingStatus,
      });
      return 结果;
    });
  }
  async 预览离职影响(userId: string) {
    const 用户 = await 查询交接上下文(this.pool, userId);
    const 影响 = await 查询交接影响(this.pool, 用户);
    const 候选人 = await 查询交接候选人(this.pool, 用户);
    const 必须交接管理覆盖 = 用户.roleCodes.some((角色) =>
      ["superadmin", "admin", "region_manager"].includes(角色),
    );
    return {
      user: 用户,
      readOnly: true,
      automaticChanges: [],
      totalCount: 影响.totalCount,
      requiresReplacement: 影响.totalCount > 0 || 必须交接管理覆盖,
      recommendedReplacementUserId: 候选人.length === 1 ? 候选人[0]!.id : null,
      candidates: 候选人,
      items: 影响.items.map((item) => ({
        ...item,
        handling:
          item.domainCode === "approval" ? "retain_history_dynamic_reassign" : "automatic_transfer",
      })),
    };
  }
  async 查询离职交接详情(id: string) {
    const handover = await this.pool.query(
      `SELECT h.id::text, h.user_id::text AS "userId", u.display_name AS "displayName",
              h.replacement_user_id::text AS "replacementUserId", h.reason,
              h.status_code AS "statusCode", h.effective_at AS "effectiveAt",
              h.scan_requested_at AS "scanRequestedAt", h.scan_completed_at AS "scanCompletedAt",
              h.scan_retry_count AS "scanRetryCount", h.closed_at AS "closedAt",
              h.row_version AS "rowVersion"
       FROM org.offboarding_handover h JOIN iam.users u ON u.id=h.user_id WHERE h.id=$1::uuid`,
      [id],
    );
    if (!handover.rows[0]) throw 不存在("交接单");
    const items = await this.pool.query(
      `SELECT id::text, domain_code AS "domainCode", object_id::text AS "objectId",
              status_code AS "statusCode", transfer_strategy AS "transferStrategy",
              actual_recipient_user_id::text AS "actualRecipientUserId", error_summary AS "errorSummary",
              detail_json AS "detail", scanned_at AS "scannedAt", retry_count AS "retryCount",
              row_version AS "rowVersion"
       FROM org.offboarding_handover_items WHERE handover_id=$1::uuid ORDER BY domain_code, created_at`,
      [id],
    );
    return { ...handover.rows[0], items: items.rows, automaticChanges: [] };
  }
  async 重试离职扫描(id: string, input: Record<string, unknown>, actor: 组织操作人) {
    return this.事务(async (db) => {
      const user = await this.操作人(db, actor);
      const before = await 锁定(db, "org.offboarding_handover", id);
      if (["closed", "cancelled"].includes(before.status_code))
        throw new 应用错误("ORG_OFFBOARDING_CLOSED", "已关闭或已取消的交接单不能重新扫描。", 409);
      const r = await db.query(
        `UPDATE org.offboarding_handover
         SET status_code='pending_scan', scan_requested_at=now(), scan_retry_count=scan_retry_count+1,
             row_version=row_version+1
         WHERE id=$1::uuid AND row_version=$2
         RETURNING id::text, status_code AS "statusCode", scan_requested_at AS "scanRequestedAt",
                   scan_retry_count AS "scanRetryCount", row_version AS "rowVersion"`,
        [id, 版本(input)],
      );
      if (!r.rows[0]) throw 冲突();
      await db.query(
        `INSERT INTO ops.outbox_events(event_type,aggregate_type,aggregate_id,payload_json)
         VALUES('org.offboarding.scan_requested','offboarding_handover',$1::uuid,$2::jsonb)`,
        [id, JSON.stringify({ handoverId: id, source: "manual_retry" })],
      );
      await 审计(db, actor, user, "offboarding.scan_retried", id, r.rows[0], before);
      return r.rows[0];
    });
  }
  async 关闭离职交接(id: string, input: Record<string, unknown>, actor: 组织操作人) {
    return this.事务(async (db) => {
      const user = await this.操作人(db, actor);
      const before = await 锁定(db, "org.offboarding_handover", id);
      if (before.status_code !== "scanned" && before.status_code !== "completed")
        throw new 应用错误("ORG_OFFBOARDING_NOT_READY", "交接扫描尚未完成，不能关闭交接单。", 409);
      const remaining = await db.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM org.offboarding_handover_items
         WHERE handover_id=$1::uuid AND status_code IN ('pending','transferring','failed')`,
        [id],
      );
      if (Number(remaining.rows[0]?.count || 0) > 0)
        throw new 应用错误(
          "ORG_OFFBOARDING_ITEMS_PENDING",
          "仍有未处理交接项，请完成人工处理后再关闭。",
          409,
        );
      const r = await db.query(
        `UPDATE org.offboarding_handover SET status_code='closed', closed_at=now(), row_version=row_version+1
         WHERE id=$1::uuid AND row_version=$2
         RETURNING id::text, status_code AS "statusCode", closed_at AS "closedAt", row_version AS "rowVersion"`,
        [id, 版本(input)],
      );
      if (!r.rows[0]) throw 冲突();
      await db.query(
        `INSERT INTO ops.outbox_events(event_type,aggregate_type,aggregate_id,payload_json)
         VALUES('org.offboarding.closed','offboarding_handover',$1::uuid,$2::jsonb)`,
        [id, JSON.stringify({ handoverId: id })],
      );
      await 审计(db, actor, user, "offboarding.closed", id, r.rows[0], before);
      return r.rows[0];
    });
  }

  // ---- 渠道商与组织架构同步（v1：channel.partners → org.regions 单向，差异预览 + 一键同步） ----
  // 数据一致性约束（DEC-0011）：渠道域组织必须关联唯一 channel.partners，故当前仅允许以
  // channel.partners 作为事实来源单向同步到 org.regions；反向写回留接口钩子，未启用。
  async 预览渠道商同步() {
    const 区域 = await this.pool.query(
      'SELECT id::text AS id, region_code AS "regionCode", region_name AS "regionName", region_level AS "regionLevel" FROM org.regions',
    );
    const 区域ByCode = new Map<string, { id: string; regionName: string }>();
    for (const r of 区域.rows as Array<{ regionCode: string; id: string; regionName: string }>) {
      if (!区域ByCode.has(r.regionCode))
        区域ByCode.set(r.regionCode, { id: r.id, regionName: r.regionName });
    }
    const 伙伴 = await this.pool.query(
      `SELECT id::text AS id, partner_code AS "partnerCode", partner_name AS "partnerName",
              region_id::text AS "regionId"
       FROM channel.partners WHERE status_code='active' ORDER BY partner_code`,
    );
    const 缺失 = [] as Array<{ partnerCode: string; partnerName: string }>;
    for (const p of 伙伴.rows as Array<{
      regionId: string | null;
      partnerCode: string;
      partnerName: string;
    }>) {
      if (!p.regionId) 缺失.push({ partnerCode: p.partnerCode, partnerName: p.partnerName });
    }
    return {
      orgRegionCount: 区域.rows.length,
      channelPartnerCount: 伙伴.rows.length,
      missingRegionPartners: 缺失,
      summary: `组织架构已存在 ${区域.rows.length} 个渠道区域，${伙伴.rows.length} 个渠道商中有 ${缺失.length} 个未关联区域。`,
    };
  }

  async 执行渠道商同步(input: Record<string, unknown>, actor: 组织操作人) {
    const 仅预览 = input["dryRun"] === true;
    const 操作人 = (
      await this.pool.query(
        "SELECT id::text FROM iam.users WHERE lower(username)=lower($1) AND status_code='active'",
        [actor.username],
      )
    ).rows[0]?.id as string | undefined;
    if (!操作人) throw new 应用错误("ORG_SUBJECT_INVALID", "当前组织管理员账号不可用。", 403);

    return this.事务(async (db) => {
      const 伙伴 = await db.query(
        `SELECT id::text AS id, partner_code AS "partnerCode", partner_name AS "partnerName",
                normalized_name AS "normalizedName", partner_level_code AS "partnerLevelCode",
                region_id::text AS "regionId"
         FROM channel.partners WHERE status_code='active' ORDER BY partner_code`,
      );
      let 创建区域 = 0,
        关联伙伴 = 0;
      const 详情: Array<{ partnerCode: string; regionCode: string; action: "create" | "link" }> =
        [];
      for (const p of 伙伴.rows as Array<{
        id: string;
        partnerCode: string;
        partnerName: string;
        normalizedName: string;
        partnerLevelCode: string;
        regionId: string | null;
      }>) {
        if (p.regionId) continue;
        // 以 partnerCode 作为 regionCode（已确认去重），保证 region_id 与 channel.partners 一一对应（DEC-0011）
        const 编码 = p.partnerCode;
        if (!仅预览) {
          const 已有 = await db.query(
            "SELECT id::text AS id FROM org.regions WHERE region_code=$1",
            [编码],
          );
          let 区域Id: string;
          if (已有.rows[0]) {
            区域Id = 已有.rows[0].id;
          } else {
            const 新建 = await db.query(
              `INSERT INTO org.regions(region_code, region_name, region_level, status_code, sort_order, created_by_user_id)
               VALUES ($1, $2, 'region', 'active', 0, $3::uuid) RETURNING id::text AS id`,
              [编码, p.partnerName, 操作人],
            );
            区域Id = 新建.rows[0].id;
            创建区域++;
            await 审计(db, actor, 操作人, "region.created", null, {
              regionCode: 编码,
              regionName: p.partnerName,
              source: "channel-sync",
            });
          }
          await db.query(
            "UPDATE channel.partners SET region_id=$1::uuid, updated_at=now() WHERE id=$2::uuid",
            [区域Id, p.id],
          );
          关联伙伴++;
          await 审计(db, actor, 操作人, "partner.region_linked", p.id, null, {
            regionId: 区域Id,
            regionCode: 编码,
          });
        }
        详情.push({
          partnerCode: p.partnerCode,
          regionCode: 编码,
          action: 仅预览 ? "create" : "create",
        });
      }
      return {
        dryRun: 仅预览,
        partnerScanned: 伙伴.rows.length,
        regionCreated: 仅预览 ? 详情.length : 创建区域,
        partnerLinked: 仅预览 ? 详情.length : 关联伙伴,
        details: 详情,
      };
    });
  }
  async 查询泛微OA身份(userId: string) {
    const [用户, 正式映射, 候选] = await Promise.all([
      this.pool.query(
        `SELECT id::text AS id,username::text AS username,display_name AS "displayName",status_code AS "statusCode"
         FROM iam.users WHERE id=$1::uuid`,
        [userId],
      ),
      this.pool.query(
        `SELECT id::text AS id,external_subject AS "externalSubject",external_username AS "externalUsername",
                status_code AS "statusCode",created_at AS "createdAt",updated_at AS "updatedAt",row_version AS "rowVersion"
         FROM iam.external_identities
         WHERE user_id=$1::uuid AND provider_code='eteams'
         ORDER BY CASE status_code WHEN 'active' THEN 0 ELSE 1 END,created_at DESC`,
        [userId],
      ),
      this.pool.query(
        `SELECT c.id::text AS id,c.external_subject AS "externalSubject",c.external_username AS "externalUsername",
                c.source_code AS "sourceCode",c.status_code AS "statusCode",c.verification_note AS "verificationNote",
                c.rejected_reason AS "rejectedReason",c.verified_at AS "verifiedAt",
                verifier.username::text AS "verifiedByUsername",verifier.display_name AS "verifiedByName",
                c.created_at AS "createdAt",c.updated_at AS "updatedAt",c.row_version AS "rowVersion"
         FROM iam.external_identity_candidates c
         LEFT JOIN iam.users verifier ON verifier.id=c.verified_by_user_id
         WHERE c.user_id=$1::uuid AND c.provider_code='eteams'
         ORDER BY c.created_at DESC`,
        [userId],
      ),
    ]);
    if (!用户.rows[0]) throw new 应用错误("ORG_USER_NOT_FOUND", "用户不存在。", 404);
    return {
      user: 用户.rows[0],
      formalIdentity: 正式映射.rows.find((item) => item.statusCode === "active") || null,
      inactiveFormalIdentities: 正式映射.rows.filter((item) => item.statusCode !== "active"),
      candidates: 候选.rows,
    };
  }
  async 新建泛微OA身份候选(userId: string, input: Record<string, unknown>, actor: 组织操作人) {
    const 候选 = 读取泛微OA候选输入(input);
    return this.事务(async (db) => {
      const 操作人 = await this.操作人(db, actor);
      await 校验泛微OA目标账号(db, userId);
      await 校验泛微OA候选可写入(db, userId, 候选.externalSubject);
      const 结果 = await db.query(
        `INSERT INTO iam.external_identity_candidates(
           user_id,provider_code,external_subject,external_username,source_code,created_by_user_id
         ) VALUES($1::uuid,'eteams',$2,$3,$4,$5::uuid)
         RETURNING id::text AS id,external_subject AS "externalSubject",external_username AS "externalUsername",
                   source_code AS "sourceCode",status_code AS "statusCode",created_at AS "createdAt",row_version AS "rowVersion"`,
        [userId, 候选.externalSubject, 候选.externalUsername, 候选.sourceCode, 操作人],
      );
      await 审计(
        db,
        actor,
        操作人,
        "eteams_identity.candidate_created",
        结果.rows[0].id,
        结果.rows[0],
      );
      return 结果.rows[0];
    });
  }
  async 更新泛微OA身份候选(
    userId: string,
    candidateId: string,
    input: Record<string, unknown>,
    actor: 组织操作人,
  ) {
    const 候选 = 读取泛微OA候选输入(input);
    return this.事务(async (db) => {
      const 操作人 = await this.操作人(db, actor);
      await 校验泛微OA目标账号(db, userId);
      const 原记录 = await 查询并锁定泛微OA候选(db, userId, candidateId);
      if (原记录.status_code !== "pending")
        throw new 应用错误(
          "ORG_EXTERNAL_IDENTITY_CANDIDATE_FINALIZED",
          "已完成核验的候选不能再修改。",
          409,
        );
      if (Number(原记录.row_version) !== 版本(input)) throw 冲突();
      await 校验泛微OA候选可写入(db, userId, 候选.externalSubject, candidateId);
      const 结果 = await db.query(
        `UPDATE iam.external_identity_candidates
         SET external_subject=$1,external_username=$2,source_code=$3,updated_at=now(),row_version=row_version+1
         WHERE id=$4::uuid AND row_version=$5
         RETURNING id::text AS id,external_subject AS "externalSubject",external_username AS "externalUsername",
                   source_code AS "sourceCode",status_code AS "statusCode",updated_at AS "updatedAt",row_version AS "rowVersion"`,
        [候选.externalSubject, 候选.externalUsername, 候选.sourceCode, candidateId, 版本(input)],
      );
      if (!结果.rows[0]) throw 冲突();
      await 审计(
        db,
        actor,
        操作人,
        "eteams_identity.candidate_updated",
        candidateId,
        结果.rows[0],
        原记录,
      );
      return 结果.rows[0];
    });
  }
  async 确认泛微OA身份候选(
    userId: string,
    candidateId: string,
    input: Record<string, unknown>,
    actor: 组织操作人,
  ) {
    return this.事务(async (db) => {
      const 操作人 = await this.操作人(db, actor);
      await 校验泛微OA目标账号(db, userId);
      const 候选 = await 查询并锁定泛微OA候选(db, userId, candidateId);
      if (候选.status_code !== "pending")
        throw new 应用错误(
          "ORG_EXTERNAL_IDENTITY_CANDIDATE_FINALIZED",
          "该候选已完成核验，不能重复确认。",
          409,
        );
      if (Number(候选.row_version) !== 版本(input)) throw 冲突();
      const 已有用户映射 = await db.query(
        `SELECT id::text AS id,external_subject
         FROM iam.external_identities
         WHERE user_id=$1::uuid AND provider_code='eteams' AND status_code='active'
         FOR UPDATE`,
        [userId],
      );
      if (已有用户映射.rows[0])
        throw new 应用错误(
          "ORG_EXTERNAL_IDENTITY_ALREADY_CONFIRMED",
          "该账号已有已确认的泛微 OA 身份，禁止直接覆盖；请先停用旧映射并保留核验记录。",
          409,
        );
      const 已有外部映射 = await db.query(
        `SELECT user_id::text AS "userId"
         FROM iam.external_identities
         WHERE provider_code='eteams' AND external_subject=$1 AND status_code='active'
         FOR UPDATE`,
        [候选.external_subject],
      );
      if (已有外部映射.rows[0])
        throw new 应用错误(
          "ORG_EXTERNAL_IDENTITY_SUBJECT_BOUND",
          "该泛微 OA userid 已绑定其他有效账号，不能重复确认。",
          409,
        );
      const 正式映射 = await db.query(
        `INSERT INTO iam.external_identities(
           user_id,provider_code,external_subject,external_username,status_code
         ) VALUES($1::uuid,'eteams',$2,$3,'active')
         RETURNING id::text AS id,external_subject AS "externalSubject",external_username AS "externalUsername",
                   status_code AS "statusCode",created_at AS "createdAt",updated_at AS "updatedAt",row_version AS "rowVersion"`,
        [userId, 候选.external_subject, 候选.external_username],
      );
      const 已确认候选 = await db.query(
        `UPDATE iam.external_identity_candidates
         SET status_code='confirmed',verification_note=$1,verified_by_user_id=$2::uuid,verified_at=now(),
             updated_at=now(),row_version=row_version+1
         WHERE id=$3::uuid AND row_version=$4
         RETURNING id::text AS id,status_code AS "statusCode",verification_note AS "verificationNote",
                   verified_at AS "verifiedAt",row_version AS "rowVersion"`,
        [可选受限文本(input, "verificationNote", 500), 操作人, candidateId, 版本(input)],
      );
      if (!已确认候选.rows[0]) throw 冲突();
      await 审计(
        db,
        actor,
        操作人,
        "eteams_identity.confirmed",
        正式映射.rows[0].id,
        { formalIdentity: 正式映射.rows[0], candidate: 已确认候选.rows[0] },
        候选,
      );
      return { formalIdentity: 正式映射.rows[0], candidate: 已确认候选.rows[0] };
    });
  }
  async 驳回泛微OA身份候选(
    userId: string,
    candidateId: string,
    input: Record<string, unknown>,
    actor: 组织操作人,
  ) {
    const 原因 = 受限文本(input, "rejectedReason", 200);
    return this.事务(async (db) => {
      const 操作人 = await this.操作人(db, actor);
      await 校验泛微OA目标账号(db, userId);
      const 候选 = await 查询并锁定泛微OA候选(db, userId, candidateId);
      if (候选.status_code !== "pending")
        throw new 应用错误(
          "ORG_EXTERNAL_IDENTITY_CANDIDATE_FINALIZED",
          "该候选已完成核验，不能重复驳回。",
          409,
        );
      if (Number(候选.row_version) !== 版本(input)) throw 冲突();
      const 结果 = await db.query(
        `UPDATE iam.external_identity_candidates
         SET status_code='rejected',rejected_reason=$1,verified_by_user_id=$2::uuid,verified_at=now(),
             updated_at=now(),row_version=row_version+1
         WHERE id=$3::uuid AND row_version=$4
         RETURNING id::text AS id,status_code AS "statusCode",rejected_reason AS "rejectedReason",
                   verified_at AS "verifiedAt",row_version AS "rowVersion"`,
        [原因, 操作人, candidateId, 版本(input)],
      );
      if (!结果.rows[0]) throw 冲突();
      await 审计(
        db,
        actor,
        操作人,
        "eteams_identity.candidate_rejected",
        candidateId,
        结果.rows[0],
        候选,
      );
      return 结果.rows[0];
    });
  }
  async 停用泛微OA身份(userId: string, input: Record<string, unknown>, actor: 组织操作人) {
    const 映射Id = 标识(input, "identityId");
    const 原因 = 受限文本(input, "reason", 200);
    return this.事务(async (db) => {
      const 操作人 = await this.操作人(db, actor);
      await 校验泛微OA目标账号(db, userId);
      const 原映射 = await db.query(
        `SELECT id::text AS id,user_id::text AS "userId",external_subject AS "externalSubject",
                external_username AS "externalUsername",status_code,row_version
         FROM iam.external_identities
         WHERE id=$1::uuid AND user_id=$2::uuid AND provider_code='eteams'
         FOR UPDATE`,
        [映射Id, userId],
      );
      if (!原映射.rows[0])
        throw new 应用错误("ORG_EXTERNAL_IDENTITY_NOT_FOUND", "泛微 OA 正式身份不存在。", 404);
      if (原映射.rows[0].status_code !== "active")
        throw new 应用错误("ORG_EXTERNAL_IDENTITY_DISABLED", "该泛微 OA 身份已停用。", 409);
      if (Number(原映射.rows[0].row_version) !== 版本(input)) throw 冲突();
      const 结果 = await db.query(
        `UPDATE iam.external_identities
         SET status_code='disabled',updated_at=now(),row_version=row_version+1
         WHERE id=$1::uuid AND row_version=$2
         RETURNING id::text AS id,external_subject AS "externalSubject",external_username AS "externalUsername",
                   status_code AS "statusCode",updated_at AS "updatedAt",row_version AS "rowVersion"`,
        [映射Id, 版本(input)],
      );
      if (!结果.rows[0]) throw 冲突();
      await 审计(
        db,
        actor,
        操作人,
        "eteams_identity.disabled",
        映射Id,
        { identity: 结果.rows[0], reason: 原因 },
        原映射.rows[0],
      );
      return 结果.rows[0];
    });
  }
  async 执行幂等<T>(参数: 组织幂等参数, 操作: () => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO ops.idempotency_keys(scope_code,idem_key,request_hash,status_code,expires_at)
         VALUES($1,$2,$3,'processing',now() + interval '24 hours')
         ON CONFLICT(scope_code,idem_key) DO NOTHING RETURNING id::text AS id`,
        [参数.作用域, 参数.幂等键, 参数.请求哈希],
      );
      if (!inserted.rows[0]) {
        const existing = await client.query<{
          request_hash: string;
          status_code: "processing" | "succeeded" | "failed";
          response_json: T | null;
          expires_at: Date;
        }>(
          `SELECT request_hash,status_code,response_json,expires_at FROM ops.idempotency_keys
           WHERE scope_code=$1 AND idem_key=$2 FOR UPDATE`,
          [参数.作用域, 参数.幂等键],
        );
        const record = existing.rows[0];
        if (!record || record.request_hash !== 参数.请求哈希)
          throw new 应用错误("ORG_IDEMPOTENCY_CONFLICT", "幂等键已用于不同的请求内容。", 409);
        if (record.status_code === "succeeded" && record.response_json !== null) {
          await client.query("COMMIT");
          return record.response_json;
        }
        if (record.status_code !== "failed" && new Date(record.expires_at).getTime() > Date.now())
          throw new 应用错误("ORG_IDEMPOTENCY_PROCESSING", "请求正在处理中，请稍后重试。", 409);
        await client.query(
          `UPDATE ops.idempotency_keys SET status_code='processing',response_hash=NULL,response_json=NULL,
             expires_at=now() + interval '24 hours' WHERE scope_code=$1 AND idem_key=$2`,
          [参数.作用域, 参数.幂等键],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    try {
      const response = await 操作();
      await this.pool.query(
        `UPDATE ops.idempotency_keys SET status_code='succeeded',response_hash=$3,response_json=$4::jsonb
         WHERE scope_code=$1 AND idem_key=$2 AND status_code='processing'`,
        [
          参数.作用域,
          参数.幂等键,
          crypto.createHash("sha256").update(JSON.stringify(response)).digest("hex"),
          JSON.stringify(response),
        ],
      );
      return response;
    } catch (error) {
      await this.pool.query(
        "UPDATE ops.idempotency_keys SET status_code='failed' WHERE scope_code=$1 AND idem_key=$2 AND status_code='processing'",
        [参数.作用域, 参数.幂等键],
      );
      throw error;
    }
  }
  private async 写入(
    sql: string,
    params: unknown[],
    actor: 组织操作人,
    action: string,
    id?: string,
  ) {
    return this.事务(async (db) => {
      const user = await this.操作人(db, actor);
      const 需要操作人参数 = sql.includes("$" + String(params.length + 1));
      const r = await db.query(sql, 需要操作人参数 ? [...params, user] : params);
      if (!r.rows[0]) throw 冲突();
      await 审计(db, actor, user, action, id || r.rows[0].id, r.rows[0]);
      return r.rows[0];
    });
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
  private async 操作人(db: PoolClient, actor: 组织操作人): Promise<string> {
    const r = await db.query(
      "SELECT id::text FROM iam.users WHERE lower(username)=lower($1) AND status_code='active'",
      [actor.username],
    );
    if (!r.rows[0]) throw new 应用错误("ORG_SUBJECT_INVALID", "当前组织管理员账号不可用。", 403);
    return r.rows[0].id;
  }
}
function 构建树(
  rows: any[],
  成员映射?: Map<string, Array<{ username: string; displayName: string; assignmentId: string }>>,
) {
  const map = new Map(
    rows.map((r) => [r.id, { ...r, members: 成员映射?.get(r.id) || [], children: [] as any[] }]),
  );
  const roots: any[] = [];
  for (const node of map.values()) {
    const parent = node.parentUnitId && map.get(node.parentUnitId);
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return { items: roots };
}

function 生成组织编码() {
  return `AUTO-${crypto.randomBytes(6).toString("hex")}-${Date.now().toString(36)}`;
}

function 读取行数组(v: Record<string, unknown>) {
  const rows = v["rows"];
  if (!Array.isArray(rows) || rows.some((r) => !r || typeof r !== "object" || Array.isArray(r)))
    throw new 应用错误("ORG_REQUEST_INVALID", "rows必须是对象数组。", 400);
  return rows as Record<string, unknown>[];
}
async function 锁定(db: PoolClient, table: string, id: string) {
  const r = await db.query(`SELECT * FROM ${table} WHERE id=$1::uuid FOR UPDATE`, [id]);
  if (!r.rows[0]) throw 不存在("记录");
  return r.rows[0];
}
async function 校验负责人关系(
  db: PoolClient,
  参数: {
    subordinateAssignmentId: string;
    managerAssignmentId: string;
    relationType: string;
    effectiveAt: string;
    expiredAt: string | null;
    排除关系Id?: string;
  },
) {
  if (参数.expiredAt && 时间毫秒(参数.expiredAt) <= 时间毫秒(参数.effectiveAt))
    throw new 应用错误("ORG_RELATION_INVALID", "负责人关系结束时间必须晚于生效时间。", 409);
  await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [参数.subordinateAssignmentId]);
  const assignments = await db.query<{
    id: string;
    user_id: string;
    effective_at: Date;
    expired_at: Date | null;
  }>(
    `SELECT id::text,user_id::text,effective_at,expired_at FROM org.staff_assignments
     WHERE id=ANY($1::uuid[]) FOR UPDATE`,
    [[参数.subordinateAssignmentId, 参数.managerAssignmentId]],
  );
  if (assignments.rows.length !== 2) throw 不存在("任职");
  const subordinate = assignments.rows.find((item) => item.id === 参数.subordinateAssignmentId);
  const manager = assignments.rows.find((item) => item.id === 参数.managerAssignmentId);
  if (!subordinate || !manager) throw 不存在("任职");
  if (subordinate.user_id === manager.user_id)
    throw new 应用错误(
      "ORG_RELATION_SELF_REFERENCE",
      "负责人不能是同一用户的另一条任职记录。",
      409,
    );
  校验关系有效期(subordinate, 参数.effectiveAt, 参数.expiredAt, "下属任职");
  校验关系有效期(manager, 参数.effectiveAt, 参数.expiredAt, "负责人任职");
  if (参数.relationType !== "direct") return;
  const conflict = await db.query(
    `SELECT 1 FROM org.manager_relations
     WHERE subordinate_assignment_id=$1::uuid AND relation_type='direct'
       AND ($2::uuid IS NULL OR id<>$2::uuid)
       AND tstzrange(effective_at,COALESCE(expired_at,'infinity'::timestamptz),'[)')
           && tstzrange($3::timestamptz,COALESCE($4::timestamptz,'infinity'::timestamptz),'[)')
     LIMIT 1`,
    [参数.subordinateAssignmentId, 参数.排除关系Id || null, 参数.effectiveAt, 参数.expiredAt],
  );
  if (conflict.rows[0])
    throw new 应用错误(
      "ORG_DIRECT_MANAGER_CONFLICT",
      "同一任职在同一有效期内只能有一位直属负责人。",
      409,
    );
}
async function 锁定业务角色成员(
  db: PoolClient,
  staffAssignmentId: string | null,
  partnerMemberId: string | null,
): Promise<{ domainCode: "internal" | "channel"; effective_at: Date; expired_at: Date | null }> {
  if (staffAssignmentId) {
    const r = await db.query<{ effective_at: Date; expired_at: Date | null }>(
      "SELECT effective_at,expired_at FROM org.staff_assignments WHERE id=$1::uuid FOR UPDATE",
      [staffAssignmentId],
    );
    if (!r.rows[0]) throw 不存在("内部任职");
    return { domainCode: "internal", ...r.rows[0] };
  }
  const r = await db.query<{ effective_at: Date; expired_at: Date | null; status_code: string }>(
    "SELECT effective_at,expired_at,status_code FROM channel.partner_members WHERE id=$1::uuid FOR UPDATE",
    [partnerMemberId],
  );
  if (!r.rows[0]) throw 不存在("渠道成员");
  if (r.rows[0].status_code !== "active")
    throw new 应用错误("ORG_CHANNEL_MEMBER_DISABLED", "已停用的渠道成员不能指派业务角色。", 409);
  return { domainCode: "channel", ...r.rows[0] };
}
function 校验关系有效期(
  relation: { effective_at: Date; expired_at: Date | null },
  effectiveAt: string,
  expiredAt: string | null,
  名称: string,
) {
  if (时间毫秒(effectiveAt) < 时间毫秒(relation.effective_at))
    throw new 应用错误("ORG_RELATION_TIME_INVALID", `${名称}尚未在该生效时间启用。`, 409);
  if (relation.expired_at && (!expiredAt || 时间毫秒(expiredAt) > 时间毫秒(relation.expired_at)))
    throw new 应用错误("ORG_RELATION_TIME_INVALID", `${名称}的有效期不足以覆盖该关系。`, 409);
}
async function 锁定成员业务角色范围(
  db: PoolClient,
  staffAssignmentId: string | null,
  partnerMemberId: string | null,
) {
  await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
    staffAssignmentId ? `staff:${staffAssignmentId}` : `partner:${partnerMemberId}`,
  ]);
}
async function 校验成员业务角色不重叠(
  db: PoolClient,
  参数: {
    businessRoleId: string;
    staffAssignmentId: string | null;
    partnerMemberId: string | null;
    effectiveAt: string;
    expiredAt: string | null;
    isPrimaryDisplay: boolean;
  },
) {
  const duplicate = await db.query(
    `SELECT 1 FROM org.member_business_roles
     WHERE business_role_id=$1::uuid
       AND (($2::uuid IS NOT NULL AND staff_assignment_id=$2::uuid)
         OR ($3::uuid IS NOT NULL AND partner_member_id=$3::uuid))
       AND tstzrange(effective_at,COALESCE(expired_at,'infinity'::timestamptz),'[)')
           && tstzrange($4::timestamptz,COALESCE($5::timestamptz,'infinity'::timestamptz),'[)') LIMIT 1`,
    [
      参数.businessRoleId,
      参数.staffAssignmentId,
      参数.partnerMemberId,
      参数.effectiveAt,
      参数.expiredAt,
    ],
  );
  if (duplicate.rows[0])
    throw new 应用错误(
      "ORG_MEMBER_ROLE_CONFLICT",
      "同一成员在重叠有效期内不能重复持有同一业务角色。",
      409,
    );
  if (!参数.isPrimaryDisplay) return;
  const primary = await db.query(
    `SELECT 1 FROM org.member_business_roles
     WHERE is_primary_display=true
       AND (($1::uuid IS NOT NULL AND staff_assignment_id=$1::uuid)
         OR ($2::uuid IS NOT NULL AND partner_member_id=$2::uuid))
       AND tstzrange(effective_at,COALESCE(expired_at,'infinity'::timestamptz),'[)')
           && tstzrange($3::timestamptz,COALESCE($4::timestamptz,'infinity'::timestamptz),'[)') LIMIT 1`,
    [参数.staffAssignmentId, 参数.partnerMemberId, 参数.effectiveAt, 参数.expiredAt],
  );
  if (primary.rows[0])
    throw new 应用错误(
      "ORG_PRIMARY_BUSINESS_ROLE_CONFLICT",
      "同一成员在同一有效期内只能有一个主显示业务角色。",
      409,
    );
}
async function 审计(
  db: PoolClient,
  actor: 组织操作人,
  user: string,
  action: string,
  id: string | null,
  after: unknown,
  before?: unknown,
) {
  await db.query(
    "INSERT INTO audit.audit_logs(created_at,request_id,actor_user_id,actor_username,actor_name,actor_role,module_code,action_code,target_type,target_id,result_code,message,before_json,after_json,extra_json) VALUES(now(),$1,$2::uuid,$3,$3,$4,'organization',$5,'organization',$6,'success','组织架构操作',$7::jsonb,$8::jsonb,'{}'::jsonb)",
    [
      actor.requestId,
      user,
      actor.username,
      actor.role || "superadmin",
      action,
      id,
      JSON.stringify(before || {}),
      JSON.stringify(after),
    ],
  );
}

interface 交接账号上下文 {
  id: string;
  username: string;
  displayName: string;
  statusCode: string;
  offboardingStatus: string;
  regionId: string | null;
  regionName: string | null;
  roleCodes: string[];
}

interface 交接候选人 {
  id: string;
  username: string;
  displayName: string;
  regionId: string | null;
  regionName: string | null;
  roleCodes: string[];
}

interface 交接影响项 {
  domainCode: string;
  domainName: string;
  affectedCount: number;
}

async function 查询交接上下文(db: Pool | PoolClient, userId: string): Promise<交接账号上下文> {
  const 结果 = await db.query<交接账号上下文>(
    `SELECT
       u.id::text AS id,
       u.username::text AS username,
       u.display_name AS "displayName",
       u.status_code AS "statusCode",
       u.offboarding_status AS "offboardingStatus",
       COALESCE(u.region_id, 主职.region_id)::text AS "regionId",
       region.region_name AS "regionName",
       COALESCE(角色.role_codes, ARRAY[]::text[]) AS "roleCodes"
     FROM iam.users u
     LEFT JOIN LATERAL (
       SELECT ou.region_id
       FROM org.staff_assignments sa
       JOIN org.org_units ou ON ou.id=sa.org_unit_id
       WHERE sa.user_id=u.id AND sa.expired_at IS NULL
       ORDER BY sa.is_primary DESC, sa.effective_at DESC
       LIMIT 1
     ) 主职 ON true
     LEFT JOIN org.regions region ON region.id=COALESCE(u.region_id, 主职.region_id)
     LEFT JOIN LATERAL (
       SELECT array_agg(r.role_code ORDER BY r.role_code) AS role_codes
       FROM iam.user_roles ur
       JOIN iam.roles r ON r.id=ur.role_id AND r.status_code='active'
       WHERE ur.user_id=u.id
     ) 角色 ON true
     WHERE u.id=$1::uuid`,
    [userId],
  );
  if (!结果.rows[0]) throw new 应用错误("ORG_USER_NOT_FOUND", "用户不存在。", 404);
  return 结果.rows[0];
}

async function 查询交接影响(
  db: Pool | PoolClient,
  target: 交接账号上下文,
): Promise<{ items: 交接影响项[]; totalCount: number }> {
  const 结果 = await db.query<交接影响项>(
    `SELECT domain_code AS "domainCode", domain_name AS "domainName", affected_count::int AS "affectedCount"
     FROM (
       SELECT 'customer'::text AS domain_code, '客户'::text AS domain_name, count(*) AS affected_count
       FROM crm.customers WHERE owner_user_id=$1::uuid AND status_code='active'
       UNION ALL SELECT 'registration','报备',count(*) FROM crm.registrations
         WHERE owner_user_id=$1::uuid AND status_code IN ('draft','pending','approved')
       UNION ALL SELECT 'opportunity','商机',count(*) FROM crm.opportunities
         WHERE owner_user_id=$1::uuid AND status_code='active'
       UNION ALL SELECT 'quote','报价',count(*) FROM crm.quotes
         WHERE owner_user_id=$1::uuid AND status_code IN ('draft','submitted','approved')
       UNION ALL SELECT 'order','订单',count(*) FROM crm.orders
         WHERE owner_user_id=$1::uuid AND status_code IN (
           'draft','pending_primary_confirm','primary_confirmed','pending_superadmin_confirm',
           'confirmed','processing','shipped'
         )
       UNION ALL SELECT 'approval','动态待办',count(*) FROM (
         SELECT approval.id
         FROM ops.approvals approval
         LEFT JOIN crm.registrations registration
           ON approval.target_type='registration' AND registration.id=approval.target_id
         LEFT JOIN crm.orders orders
           ON approval.target_type='order' AND orders.id=approval.target_id
         LEFT JOIN channel.partners partner
           ON partner.id=COALESCE(registration.partner_id,orders.partner_id,approval.applicant_partner_id)
         WHERE approval.status_code IN ('active','pending')
           AND (
             $2::boolean
             OR (
               $3::boolean
               AND $4::uuid IS NOT NULL
               AND COALESCE(
                 registration.region_id::text,
                 partner.region_id::text,
                 approval.extra_json->>'regionId',
                 ''
               )=$4::text
             )
           )
         UNION ALL
         SELECT registration.id
         FROM crm.registrations registration
         WHERE registration.status_code='pending'
           AND NOT EXISTS (
             SELECT 1 FROM ops.approvals approval
             WHERE approval.target_type='registration' AND approval.target_id=registration.id
           )
           AND (
             $2::boolean
             OR ($3::boolean AND $4::uuid IS NOT NULL AND registration.region_id=$4::uuid)
           )
       ) 待办
     ) affected
     ORDER BY domain_code`,
    [
      target.id,
      target.roleCodes.includes("superadmin"),
      target.roleCodes.some((角色) => ["admin", "region_manager"].includes(角色)),
      target.regionId,
    ],
  );
  const items = 结果.rows.map((item) => ({ ...item, affectedCount: Number(item.affectedCount) }));
  return { items, totalCount: items.reduce((总数, item) => 总数 + item.affectedCount, 0) };
}

async function 查询交接候选人(
  db: Pool | PoolClient,
  target: 交接账号上下文,
): Promise<交接候选人[]> {
  const 目标为超级管理员 = target.roleCodes.includes("superadmin");
  const 结果 = await db.query<交接候选人>(
    `SELECT
       u.id::text AS id,
       u.username::text AS username,
       u.display_name AS "displayName",
       COALESCE(u.region_id, 主职.region_id)::text AS "regionId",
       region.region_name AS "regionName",
       COALESCE(角色.role_codes, ARRAY[]::text[]) AS "roleCodes"
     FROM iam.users u
     LEFT JOIN LATERAL (
       SELECT ou.region_id
       FROM org.staff_assignments sa
       JOIN org.org_units ou ON ou.id=sa.org_unit_id
       WHERE sa.user_id=u.id AND sa.expired_at IS NULL
       ORDER BY sa.is_primary DESC,sa.effective_at DESC
       LIMIT 1
     ) 主职 ON true
     LEFT JOIN org.regions region ON region.id=COALESCE(u.region_id, 主职.region_id)
     LEFT JOIN LATERAL (
       SELECT array_agg(r.role_code ORDER BY r.role_code) AS role_codes
       FROM iam.user_roles ur
       JOIN iam.roles r ON r.id=ur.role_id AND r.status_code='active'
       WHERE ur.user_id=u.id
     ) 角色 ON true
     WHERE u.id<>$1::uuid
       AND u.status_code='active'
       AND u.offboarding_status IN ('active','reactivated')
       AND (
         ($2::boolean AND 'superadmin'=ANY(COALESCE(角色.role_codes,ARRAY[]::text[])))
         OR (
           NOT $2::boolean
           AND (
             'superadmin'=ANY(COALESCE(角色.role_codes,ARRAY[]::text[]))
             OR (
               COALESCE(角色.role_codes,ARRAY[]::text[]) && ARRAY['admin','region_manager']::text[]
               AND $3::uuid IS NOT NULL
               AND COALESCE(u.region_id, 主职.region_id)=$3::uuid
             )
           )
         )
       )
     ORDER BY CASE WHEN lower(u.username::text)='admin' THEN 0 ELSE 1 END,u.display_name,u.username`,
    [target.id, 目标为超级管理员, target.regionId],
  );
  return 结果.rows;
}

async function 锁定交接目标账号(db: PoolClient, userId: string): Promise<void> {
  const 结果 = await db.query("SELECT 1 FROM iam.users WHERE id=$1::uuid FOR UPDATE", [userId]);
  if (!结果.rows[0]) throw new 应用错误("ORG_USER_NOT_FOUND", "用户不存在。", 404);
}

async function 锁定任职账号(db: PoolClient, userId: string): Promise<void> {
  const 结果 = await db.query("SELECT id FROM iam.users WHERE id=$1::uuid FOR UPDATE", [userId]);
  if (!结果.rows[0]) throw new 应用错误("ORG_USER_NOT_FOUND", "用户不存在。", 404);
}

async function 锁定交接接收账号(db: PoolClient, userId: string): Promise<void> {
  const 结果 = await db.query("SELECT id FROM iam.users WHERE id=$1::uuid FOR UPDATE", [userId]);
  if (!结果.rows[0])
    throw new 应用错误("ORG_OFFBOARDING_RECIPIENT_INVALID", "接收人账号不存在。", 409);
}

function 校验可发起账号交接(target: 交接账号上下文, actor: 组织操作人) {
  if (target.username.toLowerCase() === actor.username.toLowerCase())
    throw new 应用错误("ORG_SELF_DELETE_FORBIDDEN", "不能停用并归档当前登录账号。", 400);
  if (target.username.toLowerCase() === "admin")
    throw new 应用错误(
      "ORG_ADMIN_DELETE_FORBIDDEN",
      "内置 admin 超级管理员账号不可停用归档。",
      403,
    );
}

async function 校验可颁发证书(db: PoolClient, userId: string, templateId: string): Promise<void> {
  const 用户 = await db.query<{ status_code: string }>(
    "SELECT status_code FROM iam.users WHERE id=$1::uuid FOR UPDATE",
    [userId],
  );
  if (!用户.rows[0]) throw new 应用错误("ORG_USER_NOT_FOUND", "用户不存在。", 404);
  if (用户.rows[0].status_code !== "active")
    throw new 应用错误("ORG_CERTIFICATION_MEMBER_INACTIVE", "已停用账号不能颁发证书。", 409);

  const 模板 = await db.query(
    "SELECT 1 FROM org.certification_templates WHERE id=$1::uuid AND status_code='active' FOR KEY SHARE",
    [templateId],
  );
  if (!模板.rows[0])
    throw new 应用错误("ORG_CERTIFICATION_TEMPLATE_INVALID", "所选证书不存在或已停用。", 409);

  const 有效成员关系 = await db.query(
    `SELECT EXISTS(
       SELECT 1 FROM org.staff_assignments
       WHERE user_id=$1::uuid AND expired_at IS NULL
     ) OR EXISTS(
       SELECT 1 FROM channel.partner_members
       WHERE user_id=$1::uuid AND status_code='active' AND archived_at IS NULL
     ) AS valid`,
    [userId],
  );
  if (有效成员关系.rows[0]?.valid !== true)
    throw new 应用错误(
      "ORG_CERTIFICATION_MEMBERSHIP_REQUIRED",
      "只能为具有有效内部任职或有效渠道成员关系的账号颁发证书。",
      409,
    );
}

interface 泛微OA候选输入 {
  externalSubject: string;
  externalUsername: string;
  sourceCode: "manual" | "eteams_directory";
}

function 读取泛微OA候选输入(input: Record<string, unknown>): 泛微OA候选输入 {
  return {
    externalSubject: 受限文本(input, "externalSubject", 200),
    externalUsername: 受限文本(input, "externalUsername", 200),
    sourceCode: 枚举(input, "sourceCode", ["manual", "eteams_directory"], "manual") as
      "manual" | "eteams_directory",
  };
}

async function 校验泛微OA目标账号(db: PoolClient, userId: string): Promise<void> {
  const 用户 = await db.query<{ status_code: string }>(
    "SELECT status_code FROM iam.users WHERE id=$1::uuid FOR KEY SHARE",
    [userId],
  );
  if (!用户.rows[0]) throw new 应用错误("ORG_USER_NOT_FOUND", "用户不存在。", 404);
  if (用户.rows[0].status_code !== "active")
    throw new 应用错误(
      "ORG_EXTERNAL_IDENTITY_USER_INACTIVE",
      "已停用账号不能维护泛微 OA 身份。",
      409,
    );
}

async function 查询并锁定泛微OA候选(db: PoolClient, userId: string, candidateId: string) {
  const 结果 = await db.query(
    `SELECT id::text AS id,user_id::text AS "userId",external_subject,external_username,source_code,
            status_code,row_version,verification_note,rejected_reason,verified_at
     FROM iam.external_identity_candidates
     WHERE id=$1::uuid AND user_id=$2::uuid AND provider_code='eteams'
     FOR UPDATE`,
    [candidateId, userId],
  );
  if (!结果.rows[0])
    throw new 应用错误(
      "ORG_EXTERNAL_IDENTITY_CANDIDATE_NOT_FOUND",
      "泛微 OA 身份候选不存在。",
      404,
    );
  return 结果.rows[0];
}

async function 校验泛微OA候选可写入(
  db: PoolClient,
  userId: string,
  externalSubject: string,
  排除候选Id?: string,
): Promise<void> {
  const 已确认 = await db.query(
    `SELECT 1 FROM iam.external_identities
     WHERE user_id=$1::uuid AND provider_code='eteams' AND status_code='active'
     LIMIT 1 FOR KEY SHARE`,
    [userId],
  );
  if (已确认.rows[0])
    throw new 应用错误(
      "ORG_EXTERNAL_IDENTITY_ALREADY_CONFIRMED",
      "该账号已有已确认的泛微 OA 身份，不能再新增候选。",
      409,
    );
  const 已绑定 = await db.query(
    `SELECT 1 FROM iam.external_identities
     WHERE provider_code='eteams' AND external_subject=$1 AND status_code='active'
     LIMIT 1 FOR KEY SHARE`,
    [externalSubject],
  );
  if (已绑定.rows[0])
    throw new 应用错误(
      "ORG_EXTERNAL_IDENTITY_SUBJECT_BOUND",
      "该泛微 OA userid 已绑定其他有效账号，不能登记为候选。",
      409,
    );
  const 待核验 = await db.query(
    `SELECT id::text AS id,user_id::text AS "userId"
     FROM iam.external_identity_candidates
     WHERE provider_code='eteams' AND status_code='pending'
       AND (user_id=$1::uuid OR external_subject=$2)
       AND ($3::uuid IS NULL OR id<>$3::uuid)
     LIMIT 1 FOR UPDATE`,
    [userId, externalSubject, 排除候选Id || null],
  );
  if (!待核验.rows[0]) return;
  if (待核验.rows[0].userId === userId)
    throw new 应用错误(
      "ORG_EXTERNAL_IDENTITY_CANDIDATE_PENDING",
      "该账号已有待核验的泛微 OA 身份，请先完成核验、驳回或更正。",
      409,
    );
  throw new 应用错误(
    "ORG_EXTERNAL_IDENTITY_SUBJECT_PENDING",
    "该泛微 OA userid 已作为其他账号的待核验候选，不能重复登记。",
    409,
  );
}

function 受限文本(v: Record<string, unknown>, k: string, 最大长度: number) {
  const 值 = 文本(v, k);
  if (值.length > 最大长度)
    throw new 应用错误("ORG_REQUEST_INVALID", `${k}长度不能超过${最大长度}个字符。`, 400);
  return 值;
}

function 可选受限文本(v: Record<string, unknown>, k: string, 最大长度: number) {
  const 值 = 可选文本(v, k);
  if (值 && 值.length > 最大长度)
    throw new 应用错误("ORG_REQUEST_INVALID", `${k}长度不能超过${最大长度}个字符。`, 400);
  return 值;
}

function 文本(v: Record<string, unknown>, k: string, d?: string) {
  const x = v[k];
  if (typeof x === "string" && x.trim()) return x.trim();
  if (d !== undefined) return d;
  throw new 应用错误("ORG_REQUEST_INVALID", `请填写${k}。`, 400);
}
function 可选文本(v: Record<string, unknown>, k: string) {
  const x = v[k];
  return typeof x === "string" && x.trim() ? x.trim() : null;
}
function 字符串值(v: Record<string, unknown>, k: string) {
  const x = v[k];
  if (typeof x !== "string") throw new 应用错误("ORG_REQUEST_INVALID", `${k}必须为文本。`, 400);
  return x.trim();
}
function 标识(v: Record<string, unknown>, k: string) {
  const x = 文本(v, k);
  if (!/^[0-9a-f-]{36}$/i.test(x))
    throw new 应用错误("ORG_REQUEST_INVALID", `${k}格式不合法。`, 400);
  return x;
}
function 标识默认(v: Record<string, unknown>, k: string, d: unknown) {
  if (v[k] === undefined) {
    const value = String(d);
    if (!/^[0-9a-f-]{36}$/i.test(value))
      throw new 应用错误("ORG_REQUEST_INVALID", `${k}格式不合法。`, 400);
    return value;
  }
  return 标识(v, k);
}
function 可选标识(v: Record<string, unknown>, k: string) {
  return v[k] === undefined || v[k] === null || v[k] === "" ? null : 标识(v, k);
}
function 标识数组(v: Record<string, unknown>, k: string) {
  const values = v[k];
  if (!Array.isArray(values)) throw new 应用错误("ORG_REQUEST_INVALID", `${k}必须为数组。`, 400);
  const result = [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
  if (result.some((value) => !/^[0-9a-f-]{36}$/i.test(value)))
    throw new 应用错误("ORG_REQUEST_INVALID", `${k}包含不合法的标识。`, 400);
  return result;
}
function 可选标识数组(v: Record<string, unknown>, k: string) {
  return v[k] === undefined ? [] : 标识数组(v, k);
}
function 可选文本默认(v: Record<string, unknown>, k: string, d: unknown) {
  if (v[k] === undefined) return d === null || d === undefined ? null : String(d);
  return 可选文本(v, k);
}
function 枚举(v: Record<string, unknown>, k: string, all: string[], d?: string) {
  const x = 文本(v, k, d);
  if (!all.includes(x)) throw new 应用错误("ORG_REQUEST_INVALID", `${k}不合法。`, 400);
  return x;
}
function 整数(v: Record<string, unknown>, k: string, d?: number) {
  const x = v[k] ?? d;
  if (!Number.isInteger(x)) throw new 应用错误("ORG_REQUEST_INVALID", `${k}必须为整数。`, 400);
  return x as number;
}
function 布尔(v: Record<string, unknown>, k: string, d: boolean) {
  const x = v[k] ?? d;
  if (typeof x !== "boolean") throw new 应用错误("ORG_REQUEST_INVALID", `${k}必须为布尔值。`, 400);
  return x;
}
function 版本(v: Record<string, unknown>) {
  const x = 整数(v, "rowVersion");
  if (x < 1) throw new 应用错误("ORG_REQUEST_INVALID", "rowVersion不合法。", 400);
  return x;
}
function 日期(v: Record<string, unknown>, k: string) {
  const x = 文本(v, k);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(x))
    throw new 应用错误("ORG_REQUEST_INVALID", `${k}必须为日期。`, 400);
  return x;
}
function 可选日期(v: Record<string, unknown>, k: string) {
  return v[k] === undefined || v[k] === null || v[k] === "" ? null : 日期(v, k);
}
function 可选正整数(v: Record<string, unknown>, k: string) {
  if (v[k] === undefined || v[k] === null || v[k] === "") return null;
  const x = 整数(v, k);
  if (x < 1) throw new 应用错误("ORG_REQUEST_INVALID", `${k}必须大于零。`, 400);
  return x;
}
const 数据范围资源代码 = [
  "organization",
  "customer",
  "registration",
  "opportunity",
  "quote",
  "order",
];
const 数据范围类型 = ["all", "org_subtree", "region", "partner", "self"];

function 断言数据范围主体类型(subjectType: string, 写入: boolean) {
  if (subjectType === "role") return;
  if (subjectType === "user" && 写入)
    throw new 应用错误(
      "DATA_SCOPE_USER_OVERRIDE_DISABLED",
      "首期不支持用户级数据范围写入，请维护角色级数据范围。",
      409,
    );
  if (subjectType === "user") return;
  throw new 应用错误("ORG_REQUEST_INVALID", "数据范围主体类型仅支持 role 或 user。", 400);
}
function 校验数据范围引用(scopeType: string, scopeRefId: string | null) {
  const 需要引用 = ["org_subtree", "region", "partner"].includes(scopeType);
  if (需要引用 !== Boolean(scopeRefId))
    throw new 应用错误(
      "ORG_DATA_SCOPE_REFERENCE_INVALID",
      需要引用 ? "当前范围类型必须提供范围引用。" : "当前范围类型不允许提供范围引用。",
      400,
    );
}
async function 断言数据范围角色有效(db: PoolClient, roleId: string) {
  const role = await db.query(
    "SELECT 1 FROM iam.roles WHERE id=$1::uuid AND status_code='active' FOR KEY SHARE",
    [roleId],
  );
  if (!role.rows[0])
    throw new 应用错误(
      "ORG_DATA_SCOPE_ROLE_INVALID",
      "数据范围关联的权限角色不存在或已停用。",
      409,
    );
}
async function 断言数据范围引用有效(db: PoolClient, scopeType: string, scopeRefId: string | null) {
  if (!scopeRefId) return;
  const 查询 =
    scopeType === "org_subtree"
      ? "SELECT 1 FROM org.org_units WHERE id=$1::uuid AND status_code IN ('draft','active')"
      : scopeType === "region"
        ? "SELECT 1 FROM org.regions WHERE id=$1::uuid AND status_code='active'"
        : "SELECT 1 FROM channel.partners WHERE id=$1::uuid AND status_code='active'";
  const ref = await db.query(查询, [scopeRefId]);
  if (!ref.rows[0])
    throw new 应用错误("ORG_DATA_SCOPE_REFERENCE_INVALID", "数据范围引用不存在或不可用。", 409);
}
function 时间(v: Record<string, unknown>, k: string) {
  const x = 文本(v, k);
  if (Number.isNaN(Date.parse(x)))
    throw new 应用错误("ORG_REQUEST_INVALID", `${k}必须为时间。`, 400);
  return x;
}
function 可选时间(v: Record<string, unknown>, k: string) {
  return v[k] === undefined || v[k] === null || v[k] === "" ? null : 时间(v, k);
}
function 时间值(value: unknown) {
  const text = value instanceof Date ? value.toISOString() : String(value);
  if (Number.isNaN(Date.parse(text)))
    throw new 应用错误("ORG_REQUEST_INVALID", "时间格式不合法。", 400);
  return text;
}
function 时间毫秒(value: unknown) {
  const valueText = 时间值(value);
  return Date.parse(valueText);
}
function 不存在(x: string) {
  return new 应用错误("ORG_NOT_FOUND", `${x}不存在。`, 404);
}
function 冲突() {
  return new 应用错误("ORG_VERSION_CONFLICT", "数据已被其他管理员更新，请刷新后重试。", 409);
}
function 转换数据库错误(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    String((error as { code?: unknown }).code) === "23503"
  )
    return new 应用错误(
      "ORG_USER_HAS_REFERENCE",
      "该用户仍被业务、审批、消息或配置数据引用，请先完成交接后再删除。",
      409,
    );
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    ["23505", "23P01", "23514"].includes(String((error as { code?: unknown }).code))
  )
    return new 应用错误("ORG_CONFLICT", "组织数据约束校验失败，请检查后重试。", 409);
  return error;
}
