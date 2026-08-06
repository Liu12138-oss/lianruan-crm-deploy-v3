-- KB-20260804-006/KB-20260804-007：订单审批状态机修复。
-- 目标：二级分销商转订单先由一级分销商确认，之后区管确认或调价，最后超管确认。

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'crm.orders'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status_code%'
  LOOP
    EXECUTE format('ALTER TABLE crm.orders DROP CONSTRAINT IF EXISTS %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE crm.orders
  ADD CONSTRAINT ck_orders_status_code_v3_order_approval
  CHECK (
    status_code IN (
      'draft',
      'pending_primary_confirm',
      'primary_confirmed',
      'primary_rejected',
      'pending_superadmin_confirm',
      'confirmed',
      'rejected',
      'cancelled',
      'processing',
      'shipped',
      'completed'
    )
  );

WITH 待修正 AS (
  SELECT
    o.id,
    CASE
      WHEN p.partner_level_code = 'secondary' THEN 'pending_primary_confirm'
      ELSE 'primary_confirmed'
    END AS target_status
  FROM crm.orders o
  LEFT JOIN channel.partners p ON p.id = o.partner_id
  WHERE o.status_code = 'pending_primary_confirm'
)
UPDATE crm.orders o
SET status_code = 待修正.target_status,
    updated_at = now(),
    extra_json = o.extra_json || jsonb_build_object('status', 待修正.target_status)
FROM 待修正
WHERE o.id = 待修正.id
  AND o.status_code <> 待修正.target_status;

INSERT INTO crm.order_status_history (order_id, from_status_code, to_status_code, changed_at, reason)
SELECT o.id, NULL, o.status_code, now(), '升级补齐订单审批状态机初始记录'
FROM crm.orders o
WHERE o.status_code IN ('pending_primary_confirm','primary_confirmed','pending_superadmin_confirm')
  AND NOT EXISTS (
    SELECT 1
    FROM crm.order_status_history h
    WHERE h.order_id = o.id
  );

INSERT INTO ops.approvals (
  v2_source_id, approval_type_code, target_type, target_id, applicant_user_id,
  applicant_partner_id, status_code, created_at, updated_at, extra_json
)
SELECT
  'order:' ||
    CASE o.status_code
      WHEN 'pending_primary_confirm' THEN 'primary_confirm'
      WHEN 'primary_confirmed' THEN 'region_confirm'
      ELSE 'superadmin_confirm'
    END ||
    ':' || o.id::text,
  'order',
  'order',
  o.id,
  o.owner_user_id,
  o.partner_id,
  'pending',
  now(),
  now(),
  jsonb_build_object(
    'status', 'pending',
    'type', 'order',
    'step',
      CASE o.status_code
        WHEN 'pending_primary_confirm' THEN 'primary_confirm'
        WHEN 'primary_confirmed' THEN 'region_confirm'
        ELSE 'superadmin_confirm'
      END,
    'stepName',
      CASE o.status_code
        WHEN 'pending_primary_confirm' THEN '一级分销商确认'
        WHEN 'primary_confirmed' THEN '区管确认'
        ELSE '超管确认'
      END,
    'targetName', COALESCE(c.customer_name, o.order_no, o.id::text),
    'customerName', COALESCE(c.customer_name, ''),
    'targetNo', COALESCE(o.order_no, ''),
    'targetPartnerName', COALESCE(p.partner_name, ''),
    'region', COALESCE(r.region_name, o.extra_json->>'region', ''),
    'amount', o.total_amount,
    'total', o.total_amount,
    'orderStatus', o.status_code,
    'reason', '升级补齐订单审批待办'
  )
FROM crm.orders o
LEFT JOIN crm.customers c ON c.id = o.customer_id
LEFT JOIN channel.partners p ON p.id = o.partner_id
LEFT JOIN org.regions r ON r.id = p.region_id
WHERE o.status_code IN ('pending_primary_confirm','primary_confirmed','pending_superadmin_confirm')
ON CONFLICT (v2_source_id) DO UPDATE
SET status_code = 'pending',
    updated_at = now(),
    extra_json = ops.approvals.extra_json || EXCLUDED.extra_json;
