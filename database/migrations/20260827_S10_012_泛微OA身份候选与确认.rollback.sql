-- S10-012 安全回退：仅在从未录入候选、从未确认或停用泛微 OA 映射时允许撤销结构。
-- 一旦存在候选或泛微映射状态变更，必须保留审计和映射事实，禁止通过回退静默删除。

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM iam.external_identity_candidates) THEN
    RAISE EXCEPTION 'S10-012_ROLLBACK_BLOCKED: 已存在泛微 OA 身份候选或确认记录，禁止删除身份核验事实；请停止功能并保留数据库结构。';
  END IF;
  IF EXISTS (
    SELECT 1 FROM iam.external_identities
    WHERE provider_code = 'eteams' OR status_code <> 'active' OR row_version <> 1
  ) THEN
    RAISE EXCEPTION 'S10-012_ROLLBACK_BLOCKED: 已存在泛微 OA 映射或外部身份状态变更，禁止回退后丢失可追溯信息。';
  END IF;
END $$;

DROP TABLE IF EXISTS iam.external_identity_candidates;
DROP INDEX IF EXISTS iam.ux_external_identities_eteams_user_active;
DROP INDEX IF EXISTS iam.ux_external_identities_provider_subject_active;

ALTER TABLE iam.external_identities
  DROP CONSTRAINT IF EXISTS ck_external_identities_disabled_provider;

ALTER TABLE iam.external_identities
  DROP CONSTRAINT IF EXISTS ck_external_identities_status_code;

ALTER TABLE iam.external_identities
  ADD CONSTRAINT external_identities_provider_code_external_subject_key
  UNIQUE (provider_code, external_subject);

ALTER TABLE iam.external_identities
  DROP COLUMN IF EXISTS row_version,
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS status_code;
