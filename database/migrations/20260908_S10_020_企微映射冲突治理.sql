-- S10-020：允许企业微信身份按受控流程逻辑停用并重新绑定。
-- 不修改、删除或回填任何已有身份记录；有效身份唯一约束继续生效。

ALTER TABLE iam.external_identities
  DROP CONSTRAINT IF EXISTS ck_external_identities_disabled_provider;

ALTER TABLE iam.external_identities
  ADD CONSTRAINT ck_external_identities_disabled_provider
  CHECK (status_code = 'active' OR provider_code IN ('eteams', 'wecom'));

COMMENT ON COLUMN iam.external_identities.status_code IS
  '外部身份有效状态；泛微 OA 与企业微信映射可由组织架构受控停用，历史记录保留。';
