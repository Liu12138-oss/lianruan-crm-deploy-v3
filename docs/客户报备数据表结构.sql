-- ============================================================================
-- 联软 CRM V3 客户报备数据表结构（参考 DDL）
-- ----------------------------------------------------------------------------
-- 说明：
--   1. 本文件由 database/migrations 中的正式迁移整理而来，仅用于查阅和
--      测试库参考，不作为生产迁移执行依据。
--   2. 生产环境数据库变更必须使用 database/migrations 下的正式迁移文件，
--      由 scripts/migrate-db.sh 按 migration.schema_migrations 顺序执行。
--   3. 本文件包含报备域核心表与关联表：客户、报备、报备事件、业务编号，
--      以及区域、渠道、账号、审批等关联表。
--   4. 执行前需要 PostgreSQL 已启用 citext 扩展：
--      CREATE EXTENSION IF NOT EXISTS citext;
-- ============================================================================

BEGIN;

-- 依赖的 schema
CREATE SCHEMA IF NOT EXISTS crm;
CREATE SCHEMA IF NOT EXISTS org;
CREATE SCHEMA IF NOT EXISTS channel;
CREATE SCHEMA IF NOT EXISTS iam;
CREATE SCHEMA IF NOT EXISTS ops;

-- 扩展：citext（iam.users.username / email、channel.partners.contact_email）
CREATE EXTENSION IF NOT EXISTS citext;

-- ----------------------------------------------------------------------------
-- 一、客户主档 crm.customers
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,                              -- 客户名称
  normalized_name text NOT NULL,                            -- 归一化名称（查重依据）
  credit_code text,                                         -- 统一社会信用代码
  region_id uuid REFERENCES org.regions(id),                -- 所属区域
  city_name text,                                           -- 城市名称
  owner_user_id uuid REFERENCES iam.users(id),              -- 负责人
  owner_partner_id uuid REFERENCES channel.partners(id),    -- 归属渠道
  status_code text NOT NULL DEFAULT 'active' CHECK (status_code IN ('active','disabled','merged')),
  merged_to_customer_id uuid REFERENCES crm.customers(id),  -- 合并目标客户
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  extra_json jsonb NOT NULL DEFAULT '{}'::jsonb             -- 扩展字段
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_customers_normalized_active
  ON crm.customers(normalized_name) WHERE status_code <> 'merged';
CREATE INDEX IF NOT EXISTS idx_customers_owner_partner
  ON crm.customers(owner_partner_id, status_code);

-- ----------------------------------------------------------------------------
-- 二、客户别名 crm.customer_aliases
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm.customer_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES crm.customers(id) ON DELETE CASCADE,
  alias_name text NOT NULL,        -- 别名
  normalized_alias text NOT NULL,  -- 别名归一化
  source_code text NOT NULL,       -- 别名来源
  UNIQUE (normalized_alias, source_code)
);

-- ----------------------------------------------------------------------------
-- 三、客户报备 crm.registrations
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm.registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  v2_source_id text UNIQUE,                              -- V2 迁移来源 ID
  registration_no text UNIQUE,                           -- 报备编号 BB-账号-YYYYMMDD-流水
  customer_id uuid NOT NULL REFERENCES crm.customers(id) ON DELETE RESTRICT,
  partner_id uuid REFERENCES channel.partners(id) ON DELETE RESTRICT,
  owner_user_id uuid REFERENCES iam.users(id),           -- 报备负责人
  region_id uuid REFERENCES org.regions(id),             -- 报备区域
  status_code text NOT NULL CHECK (status_code IN
    ('draft','pending','approved','rejected','cancelled','converted')),
  submitted_at timestamptz,                              -- 提交时间
  approved_at timestamptz,                               -- 审批通过时间
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,                 -- 乐观锁
  extra_json jsonb NOT NULL DEFAULT '{}'::jsonb          -- 扩展字段
);
CREATE INDEX IF NOT EXISTS idx_registrations_partner_status
  ON crm.registrations(partner_id, status_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_registrations_region_status
  ON crm.registrations(region_id, status_code, created_at DESC);

-- ----------------------------------------------------------------------------
-- 四、报备事件 crm.registration_events
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm.registration_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES crm.registrations(id) ON DELETE CASCADE,
  event_code text NOT NULL,          -- 事件编码
  from_status_code text,             -- 变更前状态
  to_status_code text,               -- 变更后状态
  actor_user_id uuid REFERENCES iam.users(id),  -- 操作人
  event_at timestamptz NOT NULL DEFAULT now(),
  reason text,                       -- 原因
  extra_json jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- ----------------------------------------------------------------------------
-- 五、业务编号计数器 crm.business_number_counters
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm.business_number_counters (
  document_type text NOT NULL CHECK (document_type IN ('registration','quote','order','opportunity')),
  submitter_username text NOT NULL,  -- 提报账号（商机固定为 global）
  business_date date NOT NULL,       -- 业务日期（上海时区自然日）
  current_value integer NOT NULL CHECK (current_value > 0),
  PRIMARY KEY (document_type, submitter_username, business_date)
);
COMMENT ON TABLE crm.business_number_counters
  IS '报备、报价、订单、商机按提报账号与自然日递增的业务编号计数器。';

-- ----------------------------------------------------------------------------
-- 六、报备编号生成函数 crm.next_business_number
--    报备编号示例：BB-zhangsan-20260819-0001
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION crm.next_business_number(
  p_document_type text,
  p_submitter_username text
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_document_type text := btrim(COALESCE(p_document_type, ''));
  v_submitter_username text := btrim(COALESCE(p_submitter_username, ''));
  v_counter_username text;
  v_business_date date := (now() AT TIME ZONE 'Asia/Shanghai')::date;
  v_current_value integer;
  v_prefix text;
  v_business_number text;
  v_已占用 boolean;
BEGIN
  IF v_document_type NOT IN ('registration', 'quote', 'order', 'opportunity') THEN
    RAISE EXCEPTION '不支持的业务编号类型：%', v_document_type;
  END IF;

  IF v_document_type IN ('registration', 'quote', 'order') AND v_submitter_username = '' THEN
    RAISE EXCEPTION '生成业务编号时缺少提报账号。';
  END IF;

  v_counter_username := CASE
    WHEN v_document_type = 'opportunity' THEN 'global'
    ELSE lower(v_submitter_username)
  END;
  v_prefix := CASE v_document_type
    WHEN 'registration' THEN 'BB'
    WHEN 'quote' THEN 'BJ'
    WHEN 'order' THEN 'LS'
    ELSE 'SJ'
  END;

  LOOP
    INSERT INTO crm.business_number_counters (
      document_type, submitter_username, business_date, current_value
    )
    VALUES (v_document_type, v_counter_username, v_business_date, 1)
    ON CONFLICT (document_type, submitter_username, business_date)
    DO UPDATE SET current_value = crm.business_number_counters.current_value + 1
    RETURNING current_value INTO v_current_value;

    IF v_current_value > 9999 THEN
      RAISE EXCEPTION '业务编号日流水已超过四位上限：类型 %，账号 %，日期 %。',
        v_document_type,
        v_counter_username,
        to_char(v_business_date, 'YYYYMMDD');
    END IF;

    v_business_number := CASE
      WHEN v_document_type = 'opportunity'
        THEN v_prefix || '-' || to_char(v_business_date, 'YYYYMMDD') || '-' || lpad(v_current_value::text, 4, '0')
      ELSE v_prefix || '-' || v_submitter_username || '-' || to_char(v_business_date, 'YYYYMMDD') || '-' || lpad(v_current_value::text, 4, '0')
    END;

    v_已占用 := CASE v_document_type
      WHEN 'registration' THEN EXISTS (
        SELECT 1 FROM crm.registrations WHERE registration_no = v_business_number
      )
      WHEN 'opportunity' THEN EXISTS (
        SELECT 1 FROM crm.opportunities WHERE opportunity_no = v_business_number
      )
      WHEN 'quote' THEN EXISTS (
        SELECT 1 FROM crm.quotes WHERE quote_no = v_business_number
      )
      ELSE EXISTS (
        SELECT 1 FROM crm.orders WHERE order_no = v_business_number
      )
    END;

    IF NOT v_已占用 THEN
      RETURN v_business_number;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION crm.next_business_number(text, text)
  IS '生成报备、报价、订单或商机业务编号；报备、报价、订单按提报账号递增，商机按自然日全局递增。';

-- ----------------------------------------------------------------------------
-- 七、关联表（报备依赖的参考结构）
-- ----------------------------------------------------------------------------

-- 7.1 区域 org.regions
CREATE TABLE IF NOT EXISTS org.regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_code text NOT NULL UNIQUE,
  region_name text NOT NULL,
  parent_region_id uuid REFERENCES org.regions(id),
  region_level text NOT NULL CHECK (region_level IN ('country','big_region','region','province','city')),
  status_code text NOT NULL DEFAULT 'active' CHECK (status_code IN ('active','disabled'))
);

-- 7.2 账号主档 iam.users（需要 citext 扩展）
CREATE TABLE IF NOT EXISTS iam.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  v2_source_id text UNIQUE,
  username citext NOT NULL UNIQUE,
  display_name text NOT NULL,
  status_code text NOT NULL CHECK (status_code IN ('active','disabled','locked')),
  phone text,
  email citext,
  region_id uuid,
  org_unit_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  extra_json jsonb NOT NULL DEFAULT '{}'::jsonb
);
COMMENT ON TABLE iam.users IS '账号主档，迁移自V2 users实体。';

-- 7.3 渠道商主档 channel.partners
CREATE TABLE IF NOT EXISTS channel.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  v2_source_id text UNIQUE,
  partner_code text UNIQUE,
  partner_name text NOT NULL,
  normalized_name text NOT NULL,
  partner_level_code text NOT NULL CHECK (partner_level_code IN ('none','primary','secondary')),
  region_id uuid REFERENCES org.regions(id),
  city_name text,
  contact_name text,
  contact_phone text,
  contact_email citext,
  status_code text NOT NULL CHECK (status_code IN ('active','disabled','archived')),
  joined_on date,
  created_by_user_id uuid REFERENCES iam.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  extra_json jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_partners_region_status ON channel.partners(region_id, status_code);
CREATE INDEX IF NOT EXISTS idx_partners_normalized_name ON channel.partners(normalized_name);

-- 7.4 审批主档 ops.approvals（报备审批 target_type = 'registration'）
CREATE TABLE IF NOT EXISTS ops.approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  v2_source_id text UNIQUE,
  approval_type_code text NOT NULL,       -- 审批类型编码
  target_type text NOT NULL,              -- 目标类型，报备为 registration
  target_id uuid,                         -- 目标 ID
  applicant_user_id uuid REFERENCES iam.users(id),       -- 申请人
  applicant_partner_id uuid REFERENCES channel.partners(id),  -- 申请渠道
  status_code text NOT NULL CHECK (status_code IN ('active','pending','approved','rejected','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  extra_json jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_approvals_type_status
  ON ops.approvals(approval_type_code, status_code, created_at DESC);

-- 7.5 审批事件 ops.approval_events
CREATE TABLE IF NOT EXISTS ops.approval_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id uuid NOT NULL REFERENCES ops.approvals(id) ON DELETE CASCADE,
  event_code text NOT NULL,
  from_status_code text,
  to_status_code text,
  actor_user_id uuid REFERENCES iam.users(id),
  event_at timestamptz NOT NULL DEFAULT now(),
  reason text,
  extra_json jsonb NOT NULL DEFAULT '{}'::jsonb
);

COMMIT;
