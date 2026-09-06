-- S10-015 安全回退：仅在从未发生任何严格自动匹配判定时允许撤销。
-- 一旦产生自动绑定或明确跳过事件，必须保留参考、事件和审计事实；应关闭后续功能而非删除历史。

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM iam.eteams_identity_auto_match_events) THEN
    RAISE EXCEPTION 'S10-015_ROLLBACK_BLOCKED: 已存在泛微 OA 自动匹配事件，禁止删除参考映射、自动绑定或审计追溯事实。';
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_iam_users_eteams_auto_match ON iam.users;
DROP FUNCTION IF EXISTS iam.自动匹配泛微OA身份();
DROP TABLE IF EXISTS iam.eteams_identity_auto_match_events;
DROP TABLE IF EXISTS iam.eteams_account_reference_mappings;
