\set ON_ERROR_STOP on

-- 组织架构迁移验收：S10-001A 至 S10-011。
-- 本脚本必须在已执行全部组织迁移的独立测试库运行。
-- 全部造数包含在事务中，末尾统一回滚，不会保留账号、渠道、组织或 CRM 业务数据。

BEGIN;

DO $$
DECLARE
  验收后缀 text := replace(gen_random_uuid()::text, '-', '');
  用户甲 uuid := gen_random_uuid();
  用户乙 uuid := gen_random_uuid();
  用户丙 uuid := gen_random_uuid();
  渠道商 uuid := gen_random_uuid();
  内部组织甲 uuid := gen_random_uuid();
  内部组织乙 uuid := gen_random_uuid();
  渠道组织 uuid := gen_random_uuid();
  岗位甲 uuid := gen_random_uuid();
  岗位乙 uuid := gen_random_uuid();
  任职甲 uuid := gen_random_uuid();
  任职乙 uuid := gen_random_uuid();
  任职丙 uuid := gen_random_uuid();
  临时任职 uuid;
  渠道成员 uuid := gen_random_uuid();
  权限角色 uuid := gen_random_uuid();
  业务角色 uuid := gen_random_uuid();
  证书模板 uuid := gen_random_uuid();
  证书 uuid := gen_random_uuid();
  交接单 uuid := gen_random_uuid();
  连接器 uuid := gen_random_uuid();
  同步批次 uuid := gen_random_uuid();
  账号数 bigint;
  渠道成员数 bigint;
  组织数 bigint;
  任职数 bigint;
  IAM角色绑定数 bigint;
  变更前账号数 bigint;
  变更前渠道成员数 bigint;
  变更前组织数 bigint;
  变更前任职数 bigint;
  变更前IAM角色绑定数 bigint;
  变更前客户数 bigint;
  变更前报备数 bigint;
  变更前商机数 bigint;
  默认状态 text;
BEGIN
  -- 表和关键函数必须齐全；任一缺失代表迁移链不可用于组织功能开发。
  IF to_regclass('org.business_roles') IS NULL
     OR to_regclass('org.member_business_roles') IS NULL
     OR to_regclass('org.certification_templates') IS NULL
     OR to_regclass('org.member_certifications') IS NULL
     OR to_regclass('org.offboarding_handover') IS NULL
     OR to_regclass('org.offboarding_role_snapshots') IS NULL
     OR to_regclass('iam.data_scope_bindings') IS NULL
     OR to_regclass('integration.directory_connectors') IS NULL
     OR to_regclass('integration.directory_sync_runs') IS NULL
     OR to_regclass('integration.directory_sync_changes') IS NULL
     OR to_regclass('integration.directory_callback_events') IS NULL
     OR to_regclass('integration.directory_mappings') IS NULL THEN
    RAISE EXCEPTION 'ORG_SCHEMA_MISSING: S10-001A 至 S10-005 表结构未完整落地';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'iam' AND table_name = 'data_scope_bindings' AND column_name = 'resource_code'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'org' AND table_name = 'offboarding_handover' AND column_name = 'scan_requested_at'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'org' AND table_name = 'offboarding_handover_items' AND column_name = 'detail_json'
  ) THEN
    RAISE EXCEPTION 'ORG_SAFETY_CLOSURE_SCHEMA_MISSING: S10-005 安全闭环字段缺失';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'channel' AND table_name = 'partner_members' AND column_name = 'row_version'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'channel' AND table_name = 'partner_members' AND column_name = 'archived_at'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'channel' AND table_name = 'partner_members' AND column_name = 'archive_reason'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'org' AND indexname = 'ux_staff_assignments_user_single_active'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'org' AND indexname = 'ux_member_certifications_user_template_active'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'org.staff_assignments'::regclass
      AND tgname = 'trg_staff_assignments_consistency'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'ORG_UNIFIED_MEMBER_SCHEMA_MISSING: S10-009、S10-010 或 S10-011 未完整落地';
  END IF;

  IF (
    SELECT count(*)
    FROM org.business_roles
    WHERE (role_code, role_name, domain_code, category, status_code) IN (
      ('internal_sales', '销售', 'internal', 'sales', 'active'),
      ('internal_technical', '技术', 'internal', 'tech_engineer', 'active'),
      ('channel_sales', '销售', 'channel', 'sales', 'active'),
      ('channel_technical', '技术', 'channel', 'tech_engineer', 'active')
    )
  ) <> 4 THEN
    RAISE EXCEPTION 'ORG_FIXED_BUSINESS_ROLE_INVALID: 销售或技术固定角色缺失或语义不一致';
  END IF;

  IF to_regprocedure('org.assert_unit_parent_compatible(uuid,uuid)') IS NULL
     OR to_regprocedure('org.assert_assignment_consistent(uuid)') IS NULL
     OR to_regprocedure('org.rebuild_unit_paths()') IS NULL THEN
    RAISE EXCEPTION 'ORG_CONSTRAINT_FUNCTION_MISSING: S10-001A 关键校验函数缺失';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'org.org_units'::regclass
      AND conname = 'org_units_domain_partner_check'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'org' AND indexname = 'uq_manager_relations_direct_active'
  ) THEN
    RAISE EXCEPTION 'ORG_CONSTRAINT_MISSING: 组织域或直属关系约束缺失';
  END IF;

  -- 独立验收用户。后续测试只引用这些用户，绝不改动存量账号。
  INSERT INTO iam.users (id, username, display_name, status_code)
  VALUES
    (用户甲, 'org_acceptance_a_' || 验收后缀, '组织验收甲', 'active'),
    (用户乙, 'org_acceptance_b_' || 验收后缀, '组织验收乙', 'active'),
    (用户丙, 'org_acceptance_c_' || 验收后缀, '组织验收丙', 'active');

  INSERT INTO channel.partners (
    id, partner_code, partner_name, normalized_name, partner_level_code, status_code, created_by_user_id
  ) VALUES (
    渠道商, 'ORG-ACCEPT-' || 验收后缀, '组织验收渠道商', '组织验收渠道商' || 验收后缀,
    'primary', 'active', 用户甲
  );

  INSERT INTO org.org_units (id, unit_code, unit_name, unit_type, status_code, channel_partner_id)
  VALUES
    (内部组织甲, 'ORG-ACCEPT-I-A-' || 验收后缀, '组织验收内部甲', 'department', 'active', NULL),
    (内部组织乙, 'ORG-ACCEPT-I-B-' || 验收后缀, '组织验收内部乙', 'department', 'active', NULL),
    (渠道组织, 'ORG-ACCEPT-C-' || 验收后缀, '组织验收渠道', 'channel_company', 'active', 渠道商);

  -- NOT VALID 约束仍必须约束迁移后的新写入：内部组织不能绑定渠道商。
  BEGIN
    UPDATE org.org_units SET channel_partner_id = 渠道商 WHERE id = 内部组织甲;
    RAISE EXCEPTION 'ORG_DOMAIN_CHECK_NOT_ENFORCED';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
  BEGIN
    INSERT INTO iam.data_scope_bindings (role_id, resource_code, scope_type, created_by_user_id)
    VALUES (权限角色, 'unsupported_resource', 'self', 用户甲);
    RAISE EXCEPTION 'ORG_DATA_SCOPE_RESOURCE_CHECK_NOT_ENFORCED';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  -- 内部与渠道组织不得互为父子。
  BEGIN
    PERFORM org.assert_unit_parent_compatible(内部组织甲, 渠道组织);
    RAISE EXCEPTION 'ORG_DOMAIN_PARENT_NOT_BLOCKED';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  INSERT INTO org.positions (id, org_unit_id, position_code, position_name, created_by_user_id)
  VALUES
    (岗位甲, 内部组织甲, 'ORG-ACCEPT-P-A-' || 验收后缀, '组织验收岗位甲', 用户甲),
    (岗位乙, 内部组织乙, 'ORG-ACCEPT-P-B-' || 验收后缀, '组织验收岗位乙', 用户甲);

  INSERT INTO org.staff_assignments (id, user_id, org_unit_id, position_id, is_primary, created_by_user_id)
  VALUES
    (任职甲, 用户甲, 内部组织甲, 岗位甲, true, 用户甲),
    (任职乙, 用户乙, 内部组织甲, 岗位甲, true, 用户甲),
    (任职丙, 用户丙, 内部组织甲, 岗位甲, true, 用户甲);

  -- 当前业务一人只能有一条有效任职，不允许通过非主职记录绕开。
  BEGIN
    INSERT INTO org.staff_assignments (user_id, org_unit_id, position_id, is_primary, created_by_user_id)
    VALUES (用户甲, 内部组织乙, 岗位乙, false, 用户甲);
    RAISE EXCEPTION 'ORG_SINGLE_ACTIVE_ASSIGNMENT_NOT_ENFORCED';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  -- 岗位为空时允许保存；历史已结束记录不参与唯一有效任职约束。
  INSERT INTO org.staff_assignments (
    user_id, org_unit_id, position_id, is_primary, effective_at, expired_at, created_by_user_id
  ) VALUES (用户甲, 内部组织甲, NULL, false, now() - interval '1 day', now(), 用户甲)
  RETURNING id INTO 临时任职;
  PERFORM org.assert_assignment_consistent(临时任职);

  -- 岗位与任职组织不一致，必须拒绝。
  INSERT INTO org.staff_assignments (
    user_id, org_unit_id, position_id, is_primary, effective_at, expired_at, created_by_user_id
  ) VALUES (用户甲, 内部组织乙, 岗位甲, false, now() - interval '1 day', now(), 用户甲)
  RETURNING id INTO 临时任职;
  BEGIN
    PERFORM org.assert_assignment_consistent(临时任职);
    RAISE EXCEPTION 'ORG_ASSIGNMENT_UNIT_NOT_BLOCKED';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  -- 同一任职只能有一个有效直属负责人。
  INSERT INTO org.manager_relations (subordinate_assignment_id, manager_assignment_id, relation_type, created_by_user_id)
  VALUES (任职甲, 任职乙, 'direct', 用户甲);
  BEGIN
    INSERT INTO org.manager_relations (subordinate_assignment_id, manager_assignment_id, relation_type, created_by_user_id)
    VALUES (任职甲, 任职丙, 'direct', 用户甲);
    RAISE EXCEPTION 'ORG_DIRECT_MANAGER_UNIQUE_NOT_ENFORCED';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  INSERT INTO channel.partner_members (id, partner_id, user_id, member_role_code)
  VALUES (渠道成员, 渠道商, 用户乙, 'staff');
  SELECT source_code || '/' || sync_status_code || '/' || is_primary::text
    INTO 默认状态 FROM channel.partner_members WHERE id = 渠道成员;
  IF 默认状态 <> 'manual/manual/false' THEN
    RAISE EXCEPTION 'ORG_CHANNEL_MEMBER_DEFAULT_INVALID: %', 默认状态;
  END IF;

  -- 业务角色只是业务语义，不得隐式写入 IAM 角色或权限。
  SELECT count(*) INTO IAM角色绑定数 FROM iam.user_roles;
  INSERT INTO org.business_roles (id, role_code, role_name, domain_code, created_by_user_id)
  VALUES (业务角色, 'ORG-ACCEPT-ROLE-' || 验收后缀, '组织验收业务角色', 'internal', 用户甲);
  INSERT INTO org.member_business_roles (business_role_id, staff_assignment_id, is_primary_display, created_by_user_id)
  VALUES (业务角色, 任职甲, true, 用户甲);
  IF (SELECT count(*) FROM iam.user_roles) <> IAM角色绑定数 THEN
    RAISE EXCEPTION 'ORG_BUSINESS_ROLE_MUTATED_IAM_ROLE';
  END IF;

  INSERT INTO org.certification_templates (id, template_code, template_name, created_by_user_id)
  VALUES (证书模板, 'ORG-ACCEPT-CERT-' || 验收后缀, '组织验收证书模板', 用户甲);
  INSERT INTO org.member_certifications (
    id, user_id, certification_template_id, issued_on, expires_on, created_by_user_id
  ) VALUES (证书, 用户甲, 证书模板, current_date, current_date + 30, 用户甲);
  BEGIN
    INSERT INTO org.member_certifications (
      user_id, certification_template_id, issued_on, expires_on, created_by_user_id
    ) VALUES (用户甲, 证书模板, current_date, current_date + 30, 用户甲);
    RAISE EXCEPTION 'ORG_CERTIFICATE_ACTIVE_UNIQUE_NOT_ENFORCED';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
  BEGIN
    INSERT INTO org.member_certifications (user_id, certification_template_id, issued_on, expires_on, created_by_user_id)
    VALUES (用户乙, 证书模板, current_date, current_date - 1, 用户甲);
    RAISE EXCEPTION 'ORG_CERTIFICATE_DATE_CHECK_NOT_ENFORCED';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  -- 数据范围绑定和离职交接均为新增受控对象，不得自动修改账号状态。
  INSERT INTO iam.roles (id, role_code, role_name)
  VALUES (权限角色, 'ORG-ACCEPT-IAM-' || 验收后缀, '组织验收权限角色');
  BEGIN
    INSERT INTO iam.data_scope_bindings (role_id, scope_type, scope_ref_id, created_by_user_id)
    VALUES (权限角色, 'org_subtree', NULL, 用户甲);
    RAISE EXCEPTION 'ORG_DATA_SCOPE_REFERENCE_CHECK_NOT_ENFORCED';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
  INSERT INTO org.offboarding_handover (
    id, user_id, replacement_user_id, effective_at, reason, created_by_user_id
  ) VALUES (交接单, 用户丙, 用户乙, now(), '组织验收', 用户甲);
  SELECT status_code INTO 默认状态 FROM org.offboarding_handover WHERE id = 交接单;
  IF 默认状态 <> 'pending_scan' THEN
    RAISE EXCEPTION 'ORG_OFFBOARDING_DEFAULT_INVALID: %', 默认状态;
  END IF;
  IF (SELECT scan_retry_count FROM org.offboarding_handover WHERE id = 交接单) <> 0 THEN
    RAISE EXCEPTION 'ORG_OFFBOARDING_SCAN_RETRY_DEFAULT_INVALID';
  END IF;
  IF (SELECT status_code FROM iam.users WHERE id = 用户丙) <> 'active' THEN
    RAISE EXCEPTION 'ORG_OFFBOARDING_MUTATED_USER_STATUS';
  END IF;

  -- 企微同步必须默认关闭；创建连接、预览和回调记录均不得写组织、账号、渠道或 IAM 角色。
  SELECT count(*) INTO 变更前账号数 FROM iam.users;
  SELECT count(*) INTO 变更前渠道成员数 FROM channel.partner_members;
  SELECT count(*) INTO 变更前组织数 FROM org.org_units;
  SELECT count(*) INTO 变更前任职数 FROM org.staff_assignments;
  SELECT count(*) INTO 变更前IAM角色绑定数 FROM iam.user_roles;
  SELECT count(*) INTO 变更前客户数 FROM crm.customers;
  SELECT count(*) INTO 变更前报备数 FROM crm.registrations;
  SELECT count(*) INTO 变更前商机数 FROM crm.opportunities;

  INSERT INTO integration.directory_connectors (
    id, provider_code, connector_name, corp_id, agent_id, secret_ciphertext, secret_nonce, secret_auth_tag, created_by_user_id
  ) VALUES (
    连接器, 'wecom', '组织验收企微连接器', 'org-accept-corp-' || 验收后缀, '1000001', 'ciphertext', 'nonce', 'auth-tag', 用户甲
  );
  SELECT status_code INTO 默认状态 FROM integration.directory_connectors WHERE id = 连接器;
  IF 默认状态 <> 'disabled' THEN
    RAISE EXCEPTION 'ORG_DIRECTORY_CONNECTOR_DEFAULT_NOT_DISABLED: %', 默认状态;
  END IF;
  INSERT INTO integration.directory_sync_runs (id, connector_id, run_type, created_by_user_id)
  VALUES (同步批次, 连接器, 'preview', 用户甲);
  INSERT INTO integration.directory_sync_changes (run_id, object_type, external_id, change_type, risk_level)
  VALUES (同步批次, 'department', 'wecom-dept-' || 验收后缀, 'create', 'low');
  INSERT INTO integration.directory_callback_events (connector_id, dedupe_key, event_type, payload_hash)
  VALUES (连接器, 'wecom-event-' || 验收后缀, 'change_contact', 'sha256-test');
  INSERT INTO integration.directory_mappings (connector_id, object_type, external_id)
  VALUES (连接器, 'department', 'wecom-dept-' || 验收后缀);

  SELECT count(*) INTO 账号数 FROM iam.users;
  SELECT count(*) INTO 渠道成员数 FROM channel.partner_members;
  SELECT count(*) INTO 组织数 FROM org.org_units;
  SELECT count(*) INTO 任职数 FROM org.staff_assignments;
  SELECT count(*) INTO IAM角色绑定数 FROM iam.user_roles;
  IF 账号数 <> 变更前账号数
     OR 渠道成员数 <> 变更前渠道成员数
     OR 组织数 <> 变更前组织数
     OR 任职数 <> 变更前任职数
     OR IAM角色绑定数 <> 变更前IAM角色绑定数
     OR (SELECT count(*) FROM crm.customers) <> 变更前客户数
     OR (SELECT count(*) FROM crm.registrations) <> 变更前报备数
     OR (SELECT count(*) FROM crm.opportunities) <> 变更前商机数 THEN
    RAISE EXCEPTION 'ORG_DIRECTORY_PREVIEW_MUTATED_EXISTING_BUSINESS';
  END IF;

  IF EXISTS (
    SELECT 1 FROM integration.directory_sync_changes
    WHERE run_id = 同步批次 AND (approval_status <> 'pending' OR apply_status <> 'not_applied')
  ) THEN
    RAISE EXCEPTION 'ORG_DIRECTORY_CHANGE_DEFAULT_NOT_SAFE';
  END IF;
END $$;

ROLLBACK;

\echo '组织架构 S10-001A 至 S10-011 数据库验收通过（事务已回滚）'
