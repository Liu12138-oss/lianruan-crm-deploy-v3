-- 回滚 S10.33：仅移除限流计数表，不影响账号、会话和审计记录。

BEGIN;

DROP TABLE IF EXISTS ops.auth_login_attempts;

COMMIT;
