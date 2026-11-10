-- S10.34：修复 V2 迁移映射目标缺失，并把数量守恒校验改为精确相等。
-- 本迁移只依据 migration.v2_raw_records 中的原始快照恢复历史订单，不补造金额、明细或审批结果。

BEGIN;

DO $$
BEGIN
  IF to_regclass('migration.v2_raw_records') IS NULL
     OR to_regclass('migration.v2_record_mappings') IS NULL THEN
    RAISE EXCEPTION '缺少 V2 迁移暂存表，不能执行映射守恒修复。';
  END IF;
END $$;

-- 同一来源记录可能出现在多个历史批次中，以来源更新时间最新的一条为修复依据。
-- 如果报价或订单号已经对应一张正式订单，只把映射重定向到该订单，绝不重复建单。
CREATE TEMP TABLE tmp_latest_v2_orders ON COMMIT DROP AS
WITH latest_raw AS (
  SELECT DISTINCT ON (r.source_id)
    r.batch_id,
    r.source_id,
    migration.v2_data(r.redacted_json) AS data,
    r.source_updated_at,
    r.created_at
  FROM migration.v2_raw_records r
  WHERE r.entity_name = 'orders'
  ORDER BY r.source_id, r.source_updated_at DESC NULLS LAST, r.created_at DESC, r.id DESC
),
latest_mapping AS (
  SELECT DISTINCT ON (m.source_id)
    m.id AS mapping_id,
    m.batch_id,
    m.source_id,
    m.target_id
  FROM migration.v2_record_mappings m
  WHERE m.entity_name = 'orders'
    AND m.target_table = 'crm.orders'
  ORDER BY m.source_id, m.created_at DESC, m.id DESC
),
candidate AS (
  SELECT
    latest_raw.source_id,
    latest_raw.data,
    latest_mapping.mapping_id,
    latest_mapping.target_id,
    migration.v2_existing_quote(NULLIF(latest_raw.data->>'quoteId', '')) AS quote_id,
    COALESCE(
      NULLIF(latest_raw.data->>'orderNo', ''),
      NULLIF(latest_raw.data->>'legacyBusinessNumber', ''),
      NULLIF(latest_raw.data->>'id', ''),
      latest_raw.source_id
    ) AS order_no
  FROM latest_raw
  JOIN latest_mapping USING (source_id)
  WHERE NOT EXISTS (
    SELECT 1
    FROM crm.orders existing
    WHERE existing.id = latest_mapping.target_id
       OR existing.v2_source_id = latest_raw.source_id
  )
),
resolved AS (
  SELECT
    candidate.*,
    已有订单.id AS existing_order_id,
    已有订单.v2_source_id AS existing_v2_source_id
  FROM candidate
  LEFT JOIN LATERAL (
    SELECT existing.id, existing.v2_source_id
    FROM crm.orders existing
    WHERE existing.v2_source_id = candidate.source_id
       OR (candidate.quote_id IS NOT NULL AND existing.quote_id = candidate.quote_id)
       OR existing.order_no = candidate.order_no
    ORDER BY
      CASE
        WHEN existing.v2_source_id = candidate.source_id THEN 0
        WHEN candidate.quote_id IS NOT NULL AND existing.quote_id = candidate.quote_id THEN 1
        ELSE 2
      END,
      existing.created_at,
      existing.id
    LIMIT 1
  ) AS 已有订单 ON TRUE
)
SELECT
  resolved.source_id,
  resolved.data,
  resolved.mapping_id,
  resolved.target_id,
  resolved.quote_id,
  resolved.order_no,
  resolved.existing_order_id,
  CASE
    WHEN resolved.existing_order_id IS NOT NULL
      AND resolved.existing_v2_source_id IS NOT NULL
      AND resolved.existing_v2_source_id <> resolved.source_id
      THEN '订单已关联其他V2来源：' || resolved.existing_v2_source_id
    WHEN resolved.existing_order_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM migration.v2_record_mappings 其他映射
        WHERE 其他映射.target_table = 'crm.orders'
          AND 其他映射.target_id = resolved.existing_order_id
          AND 其他映射.source_id <> resolved.source_id
      )
      THEN '订单已被其他V2来源映射'
    ELSE NULL
  END AS conflict_reason
FROM resolved;

-- 先把已存在订单的映射改到真实订单；这一步只改映射，不修改订单业务事实。
UPDATE migration.v2_record_mappings mapping
SET target_id = 待修复.existing_order_id
FROM tmp_latest_v2_orders 待修复
WHERE mapping.id = 待修复.mapping_id
  AND 待修复.existing_order_id IS NOT NULL
  AND 待修复.conflict_reason IS NULL;

INSERT INTO crm.orders (
  id, v2_source_id, order_no, quote_id, customer_id, partner_id, owner_user_id,
  status_code, total_amount, created_at, updated_at, extra_json, business_type_code
)
SELECT
  待修复.target_id,
  待修复.source_id,
  待修复.order_no,
  待修复.quote_id,
  COALESCE(
    (
      SELECT c.id
      FROM crm.customers c
      WHERE c.status_code <> 'merged'
        AND (
          c.normalized_name = migration.v2_normalized_name(待修复.data->>'customer')
          OR c.customer_name = 待修复.data->>'customer'
        )
      ORDER BY CASE WHEN c.normalized_name = migration.v2_normalized_name(待修复.data->>'customer') THEN 0 ELSE 1 END,
               c.updated_at DESC,
               c.id
      LIMIT 1
    ),
    migration.v2_uuid('crm.customers', migration.v2_normalized_name(待修复.data->>'customer'))
  ),
  COALESCE(
    migration.v2_existing_partner(
      COALESCE(NULLIF(待修复.data->>'partnerId', ''), NULLIF(待修复.data->>'assignedPartnerId', ''))
    ),
    (
      SELECT p.id
      FROM channel.partners p
      WHERE p.v2_source_id = COALESCE(NULLIF(待修复.data->>'partnerId', ''), NULLIF(待修复.data->>'assignedPartnerId', ''))
         OR p.partner_code = COALESCE(NULLIF(待修复.data->>'partnerId', ''), NULLIF(待修复.data->>'assignedPartnerId', ''))
      ORDER BY p.updated_at DESC, p.id
      LIMIT 1
    )
  ),
  COALESCE(
    migration.v2_existing_user(
      COALESCE(NULLIF(待修复.data->>'assignedStaffId', ''), NULLIF(待修复.data->>'createdBy', ''))
    ),
    (
      SELECT u.id
      FROM iam.users u
      WHERE u.v2_source_id = COALESCE(NULLIF(待修复.data->>'assignedStaffId', ''), NULLIF(待修复.data->>'createdBy', ''))
         OR lower(u.username::text) = lower(COALESCE(NULLIF(待修复.data->>'assignedStaffId', ''), NULLIF(待修复.data->>'createdBy', '')))
      ORDER BY CASE WHEN u.v2_source_id = COALESCE(NULLIF(待修复.data->>'assignedStaffId', ''), NULLIF(待修复.data->>'createdBy', '')) THEN 0 ELSE 1 END,
               u.id
      LIMIT 1
    )
  ),
  CASE
    WHEN 待修复.data->>'status' IN (
      'draft', 'pending_primary_confirm', 'primary_confirmed', 'primary_rejected',
      'pending_superadmin_confirm', 'confirmed', 'rejected', 'cancelled',
      'processing', 'shipped', 'completed'
    ) THEN 待修复.data->>'status'
    WHEN 待修复.data->>'status' IN ('pending', 'processing') THEN 'pending_primary_confirm'
    ELSE 'confirmed'
  END,
  CASE
    WHEN btrim(COALESCE(待修复.data->>'total', '')) ~ '^[0-9]+([.][0-9]+)?$'
      THEN (待修复.data->>'total')::numeric(18, 2)
    ELSE 0
  END,
  COALESCE(NULLIF(待修复.data->>'createdAt', '')::timestamptz, now()),
  COALESCE(NULLIF(待修复.data->>'updatedAt', '')::timestamptz, now()),
  待修复.data || jsonb_build_object(
    'legacyBusinessNumber', COALESCE(NULLIF(待修复.data->>'id', ''), 待修复.source_id),
    'restoredBy', 'S10_034',
    'restoredAt', now()
  ),
  'product'
FROM tmp_latest_v2_orders 待修复
WHERE 待修复.existing_order_id IS NULL
  AND 待修复.conflict_reason IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM crm.orders existing
    WHERE existing.order_no = 待修复.order_no
  )
  AND NOT EXISTS (
    SELECT 1
    FROM crm.orders existing
    WHERE existing.quote_id = 待修复.quote_id
      AND existing.quote_id IS NOT NULL
  );

CREATE TEMP TABLE tmp_v2_order_targets ON COMMIT DROP AS
SELECT source_id, order_id, data
FROM (
  SELECT source_id, existing_order_id AS order_id, data
  FROM tmp_latest_v2_orders
  WHERE existing_order_id IS NOT NULL
    AND conflict_reason IS NULL
  UNION ALL
  SELECT source_id, target_id AS order_id, data
  FROM tmp_latest_v2_orders
  WHERE existing_order_id IS NULL
    AND conflict_reason IS NULL
) resolved_orders;

CREATE INDEX ON tmp_v2_order_targets(source_id);

INSERT INTO crm.order_items (order_id, quote_item_id, item_name, quantity, unit_price, line_amount)
SELECT
  o.id,
  qi.id,
  qi.item_name,
  qi.quantity,
  qi.unit_price,
  qi.line_amount
FROM tmp_v2_order_targets 待修复
JOIN crm.orders o ON o.id = 待修复.order_id
JOIN crm.quote_items qi ON qi.quote_id = o.quote_id
WHERE NOT EXISTS (
  SELECT 1 FROM crm.order_items oi WHERE oi.order_id = o.id
);

INSERT INTO crm.order_status_history (
  order_id, from_status_code, to_status_code, actor_user_id, changed_at, reason
)
SELECT
  o.id,
  NULLIF(历史.记录->>'from', ''),
  COALESCE(NULLIF(历史.记录->>'to', ''), o.status_code),
  COALESCE(
    migration.v2_existing_user(NULLIF(历史.记录->>'operatorId', '')),
    (
      SELECT u.id
      FROM iam.users u
      WHERE u.v2_source_id = NULLIF(历史.记录->>'operatorId', '')
         OR lower(u.username::text) = lower(NULLIF(历史.记录->>'operatorId', ''))
      ORDER BY CASE WHEN u.v2_source_id = NULLIF(历史.记录->>'operatorId', '') THEN 0 ELSE 1 END,
               u.id
      LIMIT 1
    )
  ),
  COALESCE(NULLIF(历史.记录->>'timestamp', '')::timestamptz, o.created_at),
  NULLIF(历史.记录->>'remark', '')
FROM tmp_v2_order_targets 待修复
JOIN crm.orders o ON o.id = 待修复.order_id
CROSS JOIN LATERAL jsonb_array_elements(
  CASE
    WHEN jsonb_typeof(待修复.data->'statusHistory') = 'array' THEN 待修复.data->'statusHistory'
    ELSE '[]'::jsonb
  END
) AS 历史(记录)
WHERE NOT EXISTS (
  SELECT 1
  FROM crm.order_status_history existing
  WHERE existing.order_id = o.id
    AND COALESCE(existing.from_status_code, '') = COALESCE(历史.记录->>'from', '')
    AND existing.to_status_code = COALESCE(历史.记录->>'to', o.status_code)
    AND COALESCE(existing.reason, '') = COALESCE(历史.记录->>'remark', '')
    AND existing.changed_at = COALESCE(NULLIF(历史.记录->>'timestamp', '')::timestamptz, o.created_at)
);

-- 目标存在性快照必须在恢复完成后重建，否则新恢复的订单仍会被判为缺失。
CREATE TEMP TABLE tmp_existing_v2_targets ON COMMIT DROP AS
SELECT 'users'::text AS entity_name, id AS target_id FROM iam.users
UNION ALL
SELECT 'partners', id FROM channel.partners
UNION ALL
SELECT 'registrations', id FROM crm.registrations
UNION ALL
SELECT 'opportunities', id FROM crm.opportunities
UNION ALL
SELECT 'quotes', id FROM crm.quotes
UNION ALL
SELECT 'orders', id FROM crm.orders;

CREATE INDEX ON tmp_existing_v2_targets(entity_name, target_id);

-- 只把“映射目标真实存在”的原始记录标记为 loaded；缺失目标必须保留失败状态。
WITH target_batch AS (
  SELECT id FROM migration.migration_batches ORDER BY started_at DESC, id DESC LIMIT 1
)
UPDATE migration.v2_raw_records r
SET process_status = 'loaded', error_code = NULL, error_message = NULL
FROM migration.v2_record_mappings m
JOIN tmp_existing_v2_targets t
  ON t.entity_name = m.entity_name AND t.target_id = m.target_id
WHERE r.batch_id = m.batch_id
  AND r.entity_name = m.entity_name
  AND r.source_id = m.source_id
  AND r.batch_id = (SELECT id FROM target_batch);

WITH target_batch AS (
  SELECT id FROM migration.migration_batches ORDER BY started_at DESC, id DESC LIMIT 1
)
UPDATE migration.v2_raw_records r
SET process_status = 'failed',
    error_code = 'S8_4_TARGET_MISSING',
    error_message = 'V2原始记录已存在，但映射目标记录缺失。'
WHERE r.batch_id = (SELECT id FROM target_batch)
  AND r.entity_name IN ('users', 'partners', 'registrations', 'opportunities', 'quotes', 'orders')
  AND NOT EXISTS (
    SELECT 1
    FROM migration.v2_record_mappings m
    JOIN tmp_existing_v2_targets t
      ON t.entity_name = m.entity_name AND t.target_id = m.target_id
    WHERE m.batch_id = r.batch_id
      AND m.entity_name = r.entity_name
      AND m.source_id = r.source_id
  );

-- 最新批次的六类核心实体采用“原始去重数量 = 实际映射目标数量”的精确守恒校验。
WITH target_batch AS (
  SELECT id FROM migration.migration_batches ORDER BY started_at DESC, id DESC LIMIT 1
),
expected AS (
  SELECT entity_name, COUNT(DISTINCT source_id)::text AS expected_count
  FROM migration.v2_raw_records
  WHERE batch_id = (SELECT id FROM target_batch)
    AND entity_name IN ('users', 'partners', 'registrations', 'opportunities', 'quotes', 'orders')
  GROUP BY entity_name
),
actual AS (
  SELECT m.entity_name, COUNT(DISTINCT m.target_id)::text AS actual_count
  FROM migration.v2_record_mappings m
  JOIN tmp_existing_v2_targets t
    ON t.entity_name = m.entity_name AND t.target_id = m.target_id
  WHERE m.batch_id = (SELECT id FROM target_batch)
    AND m.entity_name IN ('users', 'partners', 'registrations', 'opportunities', 'quotes', 'orders')
  GROUP BY m.entity_name
),
check_rows AS (
  SELECT
    e.entity_name,
    'S8_4_COUNT_' || e.entity_name AS check_code,
    '阶段8.4正式落表数量守恒：' || e.entity_name AS check_name,
    CASE WHEN e.expected_count = COALESCE(a.actual_count, '0') THEN 'passed' ELSE 'failed' END AS result_code,
    e.expected_count AS expected_value,
    COALESCE(a.actual_count, '0') AS actual_value,
    jsonb_build_object('targetTable', e.entity_name, 'exactMatch', true) AS detail_json
  FROM expected e
  LEFT JOIN actual a USING (entity_name)
)
INSERT INTO migration.validation_results (
  batch_id, check_code, check_name, result_code, expected_value, actual_value, detail_json
)
SELECT
  (SELECT id FROM target_batch), check_code, check_name, result_code,
  expected_value, actual_value, detail_json
FROM check_rows
ON CONFLICT (batch_id, check_code) DO UPDATE SET
  check_name = EXCLUDED.check_name,
  result_code = EXCLUDED.result_code,
  expected_value = EXCLUDED.expected_value,
  actual_value = EXCLUDED.actual_value,
  detail_json = EXCLUDED.detail_json,
  created_at = now();

WITH target_batch AS (
  SELECT id FROM migration.migration_batches ORDER BY started_at DESC, id DESC LIMIT 1
),
missing AS (
  SELECT m.batch_id, m.entity_name, m.source_id, m.target_table, m.target_id
  FROM migration.v2_record_mappings m
  LEFT JOIN tmp_existing_v2_targets t
    ON t.entity_name = m.entity_name AND t.target_id = m.target_id
  WHERE m.batch_id = (SELECT id FROM target_batch)
    AND t.target_id IS NULL
)
INSERT INTO migration.validation_results (
  batch_id, check_code, check_name, result_code, expected_value, actual_value, detail_json
)
SELECT
  (SELECT id FROM target_batch),
  'S8_4_MAPPING_TARGETS',
  '阶段8.4映射目标存在性校验',
  CASE WHEN COUNT(*) = 0 THEN 'passed' ELSE 'failed' END,
  '0',
  COUNT(*)::text,
  jsonb_build_object(
    'missingCount', COUNT(*),
    'missing', COALESCE(jsonb_agg(to_jsonb(missing) ORDER BY entity_name, source_id), '[]'::jsonb)
  )
FROM missing
ON CONFLICT (batch_id, check_code) DO UPDATE SET
  result_code = EXCLUDED.result_code,
  expected_value = EXCLUDED.expected_value,
  actual_value = EXCLUDED.actual_value,
  detail_json = EXCLUDED.detail_json,
  created_at = now();

WITH target_batch AS (
  SELECT id FROM migration.migration_batches ORDER BY started_at DESC, id DESC LIMIT 1
),
failed_checks AS (
  SELECT COUNT(*)::integer AS failed_count
  FROM migration.validation_results
  WHERE batch_id = (SELECT id FROM target_batch)
    AND check_code LIKE 'S8_4_%'
    AND result_code = 'failed'
)
UPDATE migration.migration_batches b
SET failed_records = failed_checks.failed_count,
    status_code = CASE WHEN failed_checks.failed_count = 0 THEN 'validated' ELSE 'failed' END,
    finished_at = COALESCE(b.finished_at, now())
FROM failed_checks
WHERE b.id = (SELECT id FROM target_batch);

INSERT INTO audit.audit_logs(
  created_at, request_id, actor_username, actor_name, actor_role, module_code,
  action_code, target_type, target_id, target_name, result_code, message, extra_json
)
VALUES(
  now(),
  'S10_034-' || gen_random_uuid()::text,
  'system',
  '迁移修复任务',
  'system',
  'migration',
  'migration.mapping_reconciled',
  'migration_batch',
  (SELECT id::text FROM migration.migration_batches ORDER BY started_at DESC, id DESC LIMIT 1),
  'V2迁移映射守恒与历史订单修复',
  'success',
  '已按原始迁移快照恢复缺失映射目标，并执行精确数量与映射存在性校验。',
  jsonb_build_object(
    'restoredOrders', (
      SELECT COUNT(*)
      FROM tmp_latest_v2_orders
      WHERE existing_order_id IS NULL AND conflict_reason IS NULL
    ),
    'redirectedMappings', (
      SELECT COUNT(*)
      FROM tmp_latest_v2_orders
      WHERE existing_order_id IS NOT NULL AND conflict_reason IS NULL
    ),
    'conflicts', (
      SELECT COUNT(*)
      FROM tmp_latest_v2_orders
      WHERE conflict_reason IS NOT NULL
    ),
    'migrationVersion', 'S10_034'
  )
);

COMMIT;
