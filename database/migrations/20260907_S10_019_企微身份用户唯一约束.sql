-- S10-019：保证一个 V3 用户只有一条有效企业微信身份。
-- 企微 UserId 的有效唯一性已由 S10-012 的通用外部身份索引保证；本迁移补齐用户侧约束，防止并发导入绕过服务层校验。

DO $$
BEGIN
  IF EXISTS (
    SELECT user_id
    FROM iam.external_identities
    WHERE provider_code = 'wecom' AND status_code = 'active'
    GROUP BY user_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'S10-019 阻断：存在同一用户的多条有效企业微信身份，请先人工核对。';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_external_identities_wecom_user_active
  ON iam.external_identities(user_id)
  WHERE provider_code = 'wecom' AND status_code = 'active';

COMMENT ON INDEX iam.ux_external_identities_wecom_user_active IS
  '一个 V3 用户只能绑定一条有效企业微信 UserId。';
