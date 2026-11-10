-- 回滚 S10.31：仅移除审计日志只读触发器，不修改任何历史审计数据。

BEGIN;

DROP TRIGGER IF EXISTS trg_audit_logs_readonly_update ON audit.audit_logs;
DROP TRIGGER IF EXISTS trg_audit_logs_readonly_delete ON audit.audit_logs;
DROP FUNCTION IF EXISTS audit.reject_audit_log_mutation();

COMMIT;
