-- S10-022 安全回退：存在新审批轮次事实时禁止回退，避免丢失追溯数据。

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM integration.order_preapproval_requests
    WHERE approval_round > 1
  ) THEN
    RAISE EXCEPTION
      'S10-022_ROLLBACK_BLOCKED: 已存在审批轮次大于1的订单预审事实，禁止回退后丢失追溯信息。';
  END IF;
END $$;

DROP INDEX IF EXISTS integration.ux_order_preapproval_requests_order_round;
ALTER TABLE integration.order_preapproval_requests
  DROP CONSTRAINT IF EXISTS ck_order_preapproval_requests_approval_round_positive;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'integration.order_preapproval_requests'::regclass
      AND conname = 'order_preapproval_requests_order_id_key'
  ) THEN
    ALTER TABLE integration.order_preapproval_requests
      ADD CONSTRAINT order_preapproval_requests_order_id_key UNIQUE (order_id);
  END IF;
END $$;

ALTER TABLE integration.order_preapproval_requests
  DROP COLUMN IF EXISTS approval_round;

COMMIT;
