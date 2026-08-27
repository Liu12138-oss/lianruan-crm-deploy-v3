-- S10-003：数据范围和离职交接。离职仅创建受控交接单，不自动处理既有业务。

CREATE TABLE IF NOT EXISTS iam.data_scope_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES iam.roles(id) ON DELETE CASCADE,
  scope_type text NOT NULL CHECK (scope_type IN ('all','org_subtree','region','partner','self')),
  scope_ref_id uuid,
  status_code text NOT NULL DEFAULT 'active' CHECK (status_code IN ('active','disabled')),
  row_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES iam.users(id),
  CHECK (scope_type IN ('all','self') OR scope_ref_id IS NOT NULL),
  CHECK (scope_type NOT IN ('all','self') OR scope_ref_id IS NULL)
);

CREATE TABLE IF NOT EXISTS org.offboarding_handover (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES iam.users(id) ON DELETE RESTRICT,
  status_code text NOT NULL DEFAULT 'pending_scan' CHECK (status_code IN ('pending_scan','transferring','partial_failed','completed','closed','cancelled')),
  effective_at timestamptz NOT NULL,
  replacement_user_id uuid REFERENCES iam.users(id) ON DELETE RESTRICT,
  reason text NOT NULL,
  row_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid NOT NULL REFERENCES iam.users(id),
  closed_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_offboarding_open_user
  ON org.offboarding_handover(user_id) WHERE status_code NOT IN ('closed','cancelled');

CREATE TABLE IF NOT EXISTS org.offboarding_handover_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handover_id uuid NOT NULL REFERENCES org.offboarding_handover(id) ON DELETE CASCADE,
  domain_code text NOT NULL CHECK (domain_code IN ('customer','registration','opportunity','quote','order','approval')),
  object_id uuid,
  status_code text NOT NULL DEFAULT 'pending' CHECK (status_code IN ('pending','transferring','completed','failed','skipped')),
  transfer_strategy text NOT NULL DEFAULT 'manual' CHECK (transfer_strategy IN ('manual','transfer','retain')),
  error_summary text,
  row_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (handover_id, domain_code, object_id)
);

ALTER TABLE iam.users DROP CONSTRAINT IF EXISTS fk_users_offboarding_handover;
ALTER TABLE iam.users ADD CONSTRAINT fk_users_offboarding_handover
  FOREIGN KEY (offboarding_handover_id) REFERENCES org.offboarding_handover(id) ON DELETE SET NULL;
