-- S10-022：订单预审按订单审批轮次幂等，允许明确失败轮次在退回修改后重新发起。
-- 仅扩展预审请求事实和约束，不删除任何历史请求、调用、附件或外部流程编号。

BEGIN;

ALTER TABLE integration.order_preapproval_requests
  ADD COLUMN IF NOT EXISTS approval_round integer NOT NULL DEFAULT 1;

UPDATE integration.order_preapproval_requests
SET approval_round = 1
WHERE approval_round IS NULL OR approval_round < 1;

ALTER TABLE integration.order_preapproval_requests
  ALTER COLUMN approval_round SET DEFAULT 1,
  ALTER COLUMN approval_round SET NOT NULL;

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'integration.order_preapproval_requests'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) = 'UNIQUE (order_id)'
  LOOP
    EXECUTE format(
      'ALTER TABLE integration.order_preapproval_requests DROP CONSTRAINT IF EXISTS %I',
      constraint_name
    );
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'integration.order_preapproval_requests'::regclass
      AND conname = 'ck_order_preapproval_requests_approval_round_positive'
  ) THEN
    ALTER TABLE integration.order_preapproval_requests
      ADD CONSTRAINT ck_order_preapproval_requests_approval_round_positive
      CHECK (approval_round > 0);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_order_preapproval_requests_order_round
  ON integration.order_preapproval_requests(order_id, approval_round);

COMMENT ON COLUMN integration.order_preapproval_requests.approval_round IS
  '订单预审审批轮次，从1开始；同一订单不同退回重提轮次分别保留请求事实。';

COMMENT ON TABLE integration.order_preapproval_requests IS
  '订单预审发起事实，按订单与审批轮次幂等；明确失败且无外部流程编号的旧轮次允许新轮次重试，已受理或结果不确定不得自动重发。';

COMMIT;
