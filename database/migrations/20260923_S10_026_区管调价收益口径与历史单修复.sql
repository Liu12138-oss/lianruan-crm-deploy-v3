-- S10-026 区管调价收益口径与历史单修复
-- 仅修复已受理 OA 且报价总额仍停留在调价前金额的既有订单。

BEGIN;

ALTER TABLE integration.order_preapproval_invocations
  DROP CONSTRAINT IF EXISTS order_preapproval_invocations_operation_code_check;
ALTER TABLE integration.order_preapproval_invocations
  ADD CONSTRAINT order_preapproval_invocations_operation_code_check
  CHECK (operation_code IN (
    'oa_upload_purchase',
    'oa_upload_quote',
    'oa_upload_profit',
    'oa_create',
    'oa_verify',
    'wecom_group_create',
    'wecom_group_notice'
  ));

CREATE TABLE IF NOT EXISTS migration.region_price_adjust_profit_repairs (
  order_id uuid PRIMARY KEY REFERENCES crm.orders(id) ON DELETE RESTRICT,
  quote_id uuid NOT NULL REFERENCES crm.quotes(id) ON DELETE RESTRICT,
  previous_quote_total numeric(24,6) NOT NULL,
  applied_quote_total numeric(24,6) NOT NULL,
  before_snapshot_code text NOT NULL,
  after_snapshot_code text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  CHECK (previous_quote_total <> applied_quote_total)
);

WITH 候选 AS (
  SELECT
    o.id AS order_id,
    q.id AS quote_id,
    q.total_amount AS previous_quote_total,
    o.total_amount AS applied_quote_total,
    o.extra_json->'priceAdjustments'->-1 AS latest_adjustment,
    'region-price-adjust-historical-repair:' || o.id::text || ':before' AS before_snapshot_code,
    'region-price-adjust-historical-repair:' || o.id::text || ':after' AS after_snapshot_code
  FROM crm.orders o
  JOIN crm.quotes q ON q.id = o.quote_id
  JOIN integration.order_preapproval_requests request ON request.order_id = o.id
  WHERE o.order_no = 'LP-2505018-H-smb-liuchengzhou-0512-02'
    AND request.trigger_code = 'superadmin_confirmed_after_price_adjust'
    AND request.status_code = 'accepted'
    AND jsonb_typeof(o.extra_json->'priceAdjustments') = 'array'
    AND jsonb_array_length(o.extra_json->'priceAdjustments') > 0
    AND q.total_amount <> o.total_amount
    AND NOT (q.extra_json ? 'priceAdjustment')
), 记录 AS (
  INSERT INTO migration.region_price_adjust_profit_repairs(
    order_id,quote_id,previous_quote_total,applied_quote_total,before_snapshot_code,after_snapshot_code
  )
  SELECT order_id,quote_id,previous_quote_total,applied_quote_total,before_snapshot_code,after_snapshot_code
  FROM 候选
  ON CONFLICT(order_id) DO NOTHING
  RETURNING order_id,quote_id,previous_quote_total,applied_quote_total,before_snapshot_code,after_snapshot_code
)
INSERT INTO crm.quote_snapshots(quote_id,snapshot_code,snapshot_json)
SELECT
  r.quote_id,
  r.before_snapshot_code,
  jsonb_build_object(
    'quoteId', r.quote_id,
    'previousTotal', r.previous_quote_total,
    'repair', 'S10-026'
  )
FROM 记录 r
ON CONFLICT(quote_id,snapshot_code) DO NOTHING;

WITH 修复 AS (
  SELECT
    repair.order_id,
    repair.quote_id,
    repair.applied_quote_total,
    repair.before_snapshot_code,
    repair.after_snapshot_code,
    COALESCE(o.extra_json->'priceAdjustments'->-1->>'operatorName', '') AS operator_name,
    COALESCE(o.extra_json->'priceAdjustments'->-1->>'reason', '') AS reason,
    COALESCE(NULLIF(o.extra_json->'priceAdjustments'->-1->>'newAmount','')::numeric, repair.applied_quote_total) AS product_contract_amount
  FROM migration.region_price_adjust_profit_repairs repair
  JOIN crm.orders o ON o.id = repair.order_id
)
UPDATE crm.quotes q
SET total_amount = 修复.applied_quote_total,
    updated_at = now(),
    row_version = row_version + 1,
    extra_json = extra_json || jsonb_build_object(
      'total', 修复.applied_quote_total,
      'amount', 修复.applied_quote_total,
      'priceAdjustment', jsonb_build_object(
        'mode', 'total_contract',
        'orderId', 修复.order_id::text,
        'originalTotalAmount', (SELECT previous_quote_total FROM migration.region_price_adjust_profit_repairs r WHERE r.order_id=修复.order_id),
        'productContractAmount', 修复.product_contract_amount,
        'serviceContractAmount', 0,
        'warrantyYears', 3,
        'procurementMaintenanceYears', 0,
        'reason', 修复.reason,
        'operatorName', 修复.operator_name,
        'adjustedAt', now(),
        'formulaVersion', 'weidun-v2-total-input',
        'repair', 'S10-026'
      )
    )
FROM 修复
WHERE q.id = 修复.quote_id;

WITH 修复 AS (
  SELECT repair.*, q.extra_json->'priceAdjustment' AS price_adjustment
  FROM migration.region_price_adjust_profit_repairs repair
  JOIN crm.quotes q ON q.id = repair.quote_id
)
INSERT INTO crm.quote_snapshots(quote_id,snapshot_code,snapshot_json)
SELECT
  修复.quote_id,
  修复.after_snapshot_code,
  jsonb_build_object(
    'quoteId', 修复.quote_id,
    'total', 修复.applied_quote_total,
    'priceAdjustment', 修复.price_adjustment,
    'repair', 'S10-026'
  )
FROM 修复
ON CONFLICT(quote_id,snapshot_code) DO UPDATE SET snapshot_json = EXCLUDED.snapshot_json;

UPDATE crm.orders o
SET extra_json = extra_json || jsonb_build_object(
      'profitInput',
      jsonb_build_object(
        'mode', 'total_contract',
        'productContractAmount', repair.applied_quote_total,
        'serviceContractAmount', 0,
        'warrantyYears', 3,
        'procurementMaintenanceYears', 0,
        'formulaVersion', 'weidun-v2-total-input',
        'repair', 'S10-026'
      )
    ),
    updated_at = now(),
    row_version = row_version + 1
FROM migration.region_price_adjust_profit_repairs repair
WHERE o.id = repair.order_id;

COMMIT;
