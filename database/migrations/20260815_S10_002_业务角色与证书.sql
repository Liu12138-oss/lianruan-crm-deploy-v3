-- S10-002：业务角色和证书。业务角色不直接赋予 IAM 权限；证书到期只告警。

CREATE TABLE IF NOT EXISTS org.business_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_code text NOT NULL UNIQUE,
  role_name text NOT NULL,
  domain_code text NOT NULL CHECK (domain_code IN ('internal','channel')),
  category text NOT NULL DEFAULT 'other' CHECK (category IN ('sales','pre_sales','post_sales','tech_engineer','business_assistant','manager','other')),
  status_code text NOT NULL DEFAULT 'active' CHECK (status_code IN ('active','disabled')),
  description text,
  row_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES iam.users(id)
);

CREATE TABLE IF NOT EXISTS org.member_business_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_role_id uuid NOT NULL REFERENCES org.business_roles(id) ON DELETE RESTRICT,
  staff_assignment_id uuid REFERENCES org.staff_assignments(id) ON DELETE CASCADE,
  partner_member_id uuid REFERENCES channel.partner_members(id) ON DELETE CASCADE,
  is_primary_display boolean NOT NULL DEFAULT false,
  effective_at timestamptz NOT NULL DEFAULT now(),
  expired_at timestamptz,
  row_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES iam.users(id),
  CHECK ((staff_assignment_id IS NOT NULL)::int + (partner_member_id IS NOT NULL)::int = 1),
  CHECK (expired_at IS NULL OR expired_at > effective_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_member_business_role_active_internal
  ON org.member_business_roles(business_role_id, staff_assignment_id) WHERE expired_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_member_business_role_active_channel
  ON org.member_business_roles(business_role_id, partner_member_id) WHERE expired_at IS NULL;

CREATE TABLE IF NOT EXISTS org.certification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_code text NOT NULL UNIQUE,
  template_name text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  issuer_name text,
  validity_months int CHECK (validity_months IS NULL OR validity_months > 0),
  status_code text NOT NULL DEFAULT 'active' CHECK (status_code IN ('active','disabled')),
  description text,
  row_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES iam.users(id)
);

CREATE TABLE IF NOT EXISTS org.member_certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES iam.users(id) ON DELETE RESTRICT,
  certification_template_id uuid NOT NULL REFERENCES org.certification_templates(id) ON DELETE RESTRICT,
  certificate_no text,
  issuer_name text,
  issued_on date NOT NULL,
  expires_on date,
  status_code text NOT NULL DEFAULT 'active' CHECK (status_code IN ('active','expired','revoked')),
  attachment_url text,
  revoke_reason text,
  row_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES iam.users(id),
  revoked_at timestamptz,
  CHECK (expires_on IS NULL OR expires_on >= issued_on),
  CHECK (status_code <> 'revoked' OR revoke_reason IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_member_certifications_expiry
  ON org.member_certifications(expires_on) WHERE status_code = 'active' AND expires_on IS NOT NULL;

CREATE TABLE IF NOT EXISTS org.certification_expiry_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certification_id uuid NOT NULL REFERENCES org.member_certifications(id) ON DELETE CASCADE,
  expires_on date NOT NULL,
  threshold_days int NOT NULL CHECK (threshold_days IN (30,15,7,0)),
  detected_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (certification_id, expires_on, threshold_days)
);
