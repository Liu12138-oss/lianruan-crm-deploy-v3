-- S10-012：泛微 OA／eteams 身份候选与人工确认。
-- 仅建立维护能力和约束，不预置、不导入、不自动匹配任何候选或正式映射。

-- 1. 外部身份增加受控停用能力。
-- 历史身份默认均为有效；本迁移不会修改既有主体、用户名或登录匹配行为。
ALTER TABLE iam.external_identities
  ADD COLUMN IF NOT EXISTS status_code text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS row_version bigint NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_external_identities_status_code'
      AND conrelid = 'iam.external_identities'::regclass
  ) THEN
    ALTER TABLE iam.external_identities
      ADD CONSTRAINT ck_external_identities_status_code
      CHECK (status_code IN ('active', 'disabled'));
  END IF;
END $$;

-- 停用只对本次泛微 OA 映射开放，避免无关外部身份被错误复用。
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_external_identities_disabled_provider'
      AND conrelid = 'iam.external_identities'::regclass
  ) THEN
    ALTER TABLE iam.external_identities
      ADD CONSTRAINT ck_external_identities_disabled_provider
      CHECK (status_code = 'active' OR provider_code = 'eteams');
  END IF;
END $$;

-- 已停用的泛微编号可在人工核验后重新绑定给正确人员；仍严格保证有效映射唯一。
ALTER TABLE iam.external_identities
  DROP CONSTRAINT IF EXISTS external_identities_provider_code_external_subject_key;

CREATE UNIQUE INDEX IF NOT EXISTS ux_external_identities_provider_subject_active
  ON iam.external_identities(provider_code, external_subject)
  WHERE status_code = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS ux_external_identities_eteams_user_active
  ON iam.external_identities(user_id)
  WHERE provider_code = 'eteams' AND status_code = 'active';

COMMENT ON COLUMN iam.external_identities.status_code IS
  '外部身份有效状态；当前仅泛微 OA 映射由组织架构受控停用，其他既有身份保持默认有效。';

-- 2. 候选与正式映射分表保存。候选永远不能作为 OA 发起人身份。
CREATE TABLE IF NOT EXISTS iam.external_identity_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES iam.users(id) ON DELETE RESTRICT,
  provider_code text NOT NULL,
  external_subject text NOT NULL,
  external_username text NOT NULL,
  source_code text NOT NULL CHECK (source_code IN ('manual', 'eteams_directory')),
  status_code text NOT NULL DEFAULT 'pending'
    CHECK (status_code IN ('pending', 'confirmed', 'rejected', 'superseded')),
  verification_note text,
  rejected_reason text,
  verified_by_user_id uuid REFERENCES iam.users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  created_by_user_id uuid NOT NULL REFERENCES iam.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  CHECK (length(btrim(external_subject)) BETWEEN 1 AND 200),
  CHECK (length(btrim(external_username)) BETWEEN 1 AND 200),
  CHECK (verification_note IS NULL OR length(verification_note) <= 500),
  CHECK (rejected_reason IS NULL OR length(rejected_reason) <= 200)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_external_identity_candidates_pending_user_provider
  ON iam.external_identity_candidates(user_id, provider_code)
  WHERE status_code = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS ux_external_identity_candidates_pending_subject_provider
  ON iam.external_identity_candidates(provider_code, external_subject)
  WHERE status_code = 'pending';

CREATE INDEX IF NOT EXISTS idx_external_identity_candidates_user_provider_created
  ON iam.external_identity_candidates(user_id, provider_code, created_at DESC);

COMMENT ON TABLE iam.external_identity_candidates IS
  '外部身份人工核验候选。候选仅供超级管理员核验，只有确认后才会原子写入 iam.external_identities。';
COMMENT ON COLUMN iam.external_identity_candidates.external_subject IS
  '对方系统人员稳定编号；泛微 OA／eteams 场景保存 userid。';
COMMENT ON COLUMN iam.external_identity_candidates.external_username IS
  '对方系统显示姓名或登录名，仅作人工交叉核验，不作为 V3 登录匹配依据。';
