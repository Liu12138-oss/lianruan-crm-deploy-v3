-- S10-020 回退：已存在企业微信停用映射时禁止收紧约束，避免丢失可追溯状态。

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM iam.external_identities
    WHERE provider_code = 'wecom' AND status_code = 'disabled'
  ) THEN
    RAISE EXCEPTION 'S10-020_ROLLBACK_BLOCKED: 已存在企业微信身份停用记录，禁止回退后丢失可追溯状态。';
  END IF;
END $$;

ALTER TABLE iam.external_identities
  DROP CONSTRAINT IF EXISTS ck_external_identities_disabled_provider;

ALTER TABLE iam.external_identities
  ADD CONSTRAINT ck_external_identities_disabled_provider
  CHECK (status_code = 'active' OR provider_code = 'eteams');
