
-- 阶段2迁移草案：账号、组织、渠道。

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

CREATE TABLE IF NOT EXISTS iam.password_credentials (
  user_id uuid PRIMARY KEY REFERENCES iam.users(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  algorithm text NOT NULL CHECK (algorithm IN ('scrypt','argon2id','bcrypt')),
  must_change_password boolean NOT NULL DEFAULT true,
  changed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE iam.password_credentials IS '本地密码凭据，只保存散列，不保存明文。';

CREATE TABLE IF NOT EXISTS iam.external_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
  provider_code text NOT NULL,
  external_subject text NOT NULL,
  external_username text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_code, external_subject)
);

CREATE TABLE IF NOT EXISTS iam.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_code text NOT NULL UNIQUE,
  role_name text NOT NULL,
  status_code text NOT NULL DEFAULT 'active' CHECK (status_code IN ('active','disabled'))
);

CREATE TABLE IF NOT EXISTS iam.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_code text NOT NULL UNIQUE,
  permission_name text NOT NULL,
  resource_code text NOT NULL,
  action_code text NOT NULL
);

CREATE TABLE IF NOT EXISTS iam.role_permissions (
  role_id uuid NOT NULL REFERENCES iam.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES iam.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS iam.user_roles (
  user_id uuid NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES iam.roles(id) ON DELETE RESTRICT,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS org.regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_code text NOT NULL UNIQUE,
  region_name text NOT NULL,
  parent_region_id uuid REFERENCES org.regions(id),
  region_level text NOT NULL CHECK (region_level IN ('country','big_region','region','province','city')),
  status_code text NOT NULL DEFAULT 'active' CHECK (status_code IN ('active','disabled'))
);

CREATE TABLE IF NOT EXISTS org.org_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_code text NOT NULL UNIQUE,
  unit_name text NOT NULL,
  parent_unit_id uuid REFERENCES org.org_units(id),
  region_id uuid REFERENCES org.regions(id),
  status_code text NOT NULL DEFAULT 'active' CHECK (status_code IN ('active','disabled'))
);

ALTER TABLE iam.users
  ADD CONSTRAINT fk_users_region FOREIGN KEY (region_id) REFERENCES org.regions(id),
  ADD CONSTRAINT fk_users_org_unit FOREIGN KEY (org_unit_id) REFERENCES org.org_units(id);

CREATE TABLE IF NOT EXISTS org.staff_profiles (
  user_id uuid PRIMARY KEY REFERENCES iam.users(id) ON DELETE CASCADE,
  employee_no text,
  title text,
  data_scope_code text NOT NULL DEFAULT 'self' CHECK (data_scope_code IN ('all','big_region','region','partner','self')),
  extra_json jsonb NOT NULL DEFAULT '{}'::jsonb
);

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

CREATE TABLE IF NOT EXISTS channel.partner_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_partner_id uuid NOT NULL REFERENCES channel.partners(id) ON DELETE RESTRICT,
  child_partner_id uuid NOT NULL REFERENCES channel.partners(id) ON DELETE RESTRICT,
  relation_code text NOT NULL CHECK (relation_code IN ('primary_secondary')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  CHECK (parent_partner_id <> child_partner_id),
  UNIQUE (child_partner_id, relation_code, ended_at)
);

CREATE TABLE IF NOT EXISTS channel.partner_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES channel.partners(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
  member_role_code text NOT NULL CHECK (member_role_code IN ('partner_admin','staff')),
  status_code text NOT NULL DEFAULT 'active' CHECK (status_code IN ('active','disabled')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  UNIQUE (partner_id, user_id)
);

CREATE TABLE IF NOT EXISTS channel.partner_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  v2_source_id text UNIQUE,
  partner_id uuid NOT NULL REFERENCES channel.partners(id) ON DELETE CASCADE,
  profile_name text NOT NULL,
  status_code text NOT NULL DEFAULT 'active' CHECK (status_code IN ('active','disabled')),
  extra_json jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS channel.partner_profile_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  v2_source_id text UNIQUE,
  partner_profile_id uuid REFERENCES channel.partner_profiles(id) ON DELETE CASCADE,
  product_ref_type text NOT NULL CHECK (product_ref_type IN ('feature','hardware','package')),
  product_ref_id uuid NOT NULL,
  status_code text NOT NULL DEFAULT 'active' CHECK (status_code IN ('active','disabled'))
);
