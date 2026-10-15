-- S10-026 回退：只恢复本迁移修改且之后未被人工改价的报价总额。

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM integration.order_preapproval_invocations WHERE operation_code = 'oa_upload_profit'
  ) THEN
    RAISE EXCEPTION 'S10-026_ROLLBACK_BLOCKED: 已存在收益表附件上传调用，禁止回退后丢失追溯信息。';
  END IF;
END;
$$;

ALTER TABLE integration.order_preapproval_invocations
  DROP CONSTRAINT IF EXISTS order_preapproval_invocations_operation_code_check;
ALTER TABLE integration.order_preapproval_invocations
  ADD CONSTRAINT order_preapproval_invocations_operation_code_check
  CHECK (operation_code IN (
    'oa_upload_purchase',
    'oa_upload_quote',
    'oa_create',
    'oa_verify',
    'wecom_group_create',
    'wecom_group_notice'
  ));

UPDATE crm.quotes q
SET total_amount = repair.previous_quote_total,
    updated_at = now(),
    row_version = row_version + 1,
    extra_json = extra_json - 'priceAdjustment' || jsonb_build_object('total', repair.previous_quote_total, 'amount', repair.previous_quote_total)
FROM migration.region_price_adjust_profit_repairs repair
WHERE q.id = repair.quote_id
  AND q.total_amount = repair.applied_quote_total
  AND q.extra_json->'priceAdjustment'->>'repair' = 'S10-026';

UPDATE crm.orders o
SET extra_json = extra_json - 'profitInput',
    updated_at = now(),
    row_version = row_version + 1
FROM migration.region_price_adjust_profit_repairs repair
WHERE o.id = repair.order_id
  AND o.extra_json->'profitInput'->>'repair' = 'S10-026';

DELETE FROM crm.quote_snapshots snapshot
USING migration.region_price_adjust_profit_repairs repair
WHERE snapshot.quote_id = repair.quote_id
  AND snapshot.snapshot_code IN (repair.before_snapshot_code, repair.after_snapshot_code);

DROP TABLE IF EXISTS migration.region_price_adjust_profit_repairs;

COMMIT;
