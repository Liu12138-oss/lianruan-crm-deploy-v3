-- S10.31：操作审计日志只允许追加，禁止业务账号修改历史记录。
-- 说明：删除仅允许显式进入会话级维护模式后执行，供测试库清理与经授权的数据重置使用；
-- 普通业务会话未设置该开关，DELETE 会被直接拒绝，UPDATE 在任何会话中均被拒绝。
-- PostgreSQL 会为分区父表上的行级触发器自动创建对应分区触发器。

BEGIN;

CREATE OR REPLACE FUNCTION audit.reject_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND current_setting('lianruan.audit_maintenance', true) = 'on' THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION USING
    ERRCODE = '42501',
    MESSAGE = CASE
      WHEN TG_OP = 'DELETE' THEN '操作审计日志为只读记录，禁止删除；仅显式维护会话可清理测试数据。'
      ELSE '操作审计日志为只读记录，禁止修改。'
    END;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_logs_readonly_update ON audit.audit_logs;
DROP TRIGGER IF EXISTS trg_audit_logs_readonly_delete ON audit.audit_logs;

CREATE TRIGGER trg_audit_logs_readonly_update
BEFORE UPDATE ON audit.audit_logs
FOR EACH ROW
EXECUTE FUNCTION audit.reject_audit_log_mutation();

CREATE TRIGGER trg_audit_logs_readonly_delete
BEFORE DELETE ON audit.audit_logs
FOR EACH ROW
EXECUTE FUNCTION audit.reject_audit_log_mutation();

COMMIT;
