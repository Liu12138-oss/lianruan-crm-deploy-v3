-- S10.29：客户报备查重、订单质保与维保日期。
-- 历史客户级质保字段保留不迁移，新 UI 不再读取客户级质保。

BEGIN;

ALTER TABLE crm.orders
  ADD COLUMN IF NOT EXISTS warranty_start_date date,
  ADD COLUMN IF NOT EXISTS warranty_end_date date,
  ADD COLUMN IF NOT EXISTS maintenance_start_date date,
  ADD COLUMN IF NOT EXISTS maintenance_end_date date,
  ADD COLUMN IF NOT EXISTS warranty_manual_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS warranty_updated_by_user_id uuid REFERENCES iam.users(id),
  ADD COLUMN IF NOT EXISTS warranty_updated_at timestamptz;

ALTER TABLE crm.orders
  DROP CONSTRAINT IF EXISTS orders_warranty_date_order_check;
ALTER TABLE crm.orders
  ADD CONSTRAINT orders_warranty_date_order_check
  CHECK (
    (warranty_start_date IS NULL OR warranty_end_date IS NULL OR warranty_end_date >= warranty_start_date)
    AND (maintenance_start_date IS NULL OR maintenance_end_date IS NULL OR maintenance_end_date >= maintenance_start_date)
    AND (
      maintenance_start_date IS NULL
      OR warranty_end_date IS NULL
      OR maintenance_start_date > warranty_end_date
    )
  );

CREATE INDEX IF NOT EXISTS idx_orders_customer_warranty_end
  ON crm.orders(customer_id, warranty_end_date)
  WHERE status_code <> 'cancelled';

-- 用规范化表达式做查询索引。存量信用代码可能重复，不能直接创建唯一索引阻断迁移；
-- 报备写入时由服务端事务锁和查重逻辑保证不新增重复客户。
CREATE INDEX IF NOT EXISTS idx_customers_normalized_credit_code
  ON crm.customers(
    (UPPER(REGEXP_REPLACE(BTRIM(COALESCE(credit_code, '')), '\s+', '', 'g')))
  )
  WHERE status_code <> 'merged'
    AND NULLIF(BTRIM(COALESCE(credit_code, '')), '') IS NOT NULL;

-- 存量订单按最近一次收益计算记录回填。确认时间优先取订单状态历史，
-- 没有确认历史时退回订单更新时间，避免把所有历史订单错误归到今天。
WITH 期限来源 AS (
  SELECT
    o.id AS order_id,
    COALESCE(calc.warranty_years, 3) AS warranty_years,
    COALESCE(calc.procurement_maintenance_years, 0) AS procurement_maintenance_years,
    COALESCE(
      (
        SELECT h.changed_at
        FROM crm.order_status_history h
        WHERE h.order_id = o.id AND h.to_status_code = 'confirmed'
        ORDER BY h.changed_at ASC
        LIMIT 1
      ),
      o.updated_at,
      o.created_at
    ) AS confirmed_at
  FROM crm.orders o
  LEFT JOIN LATERAL (
    SELECT qpc.warranty_years, qpc.procurement_maintenance_years
    FROM crm.quote_profit_calculations qpc
    WHERE qpc.quote_id = o.quote_id
    ORDER BY qpc.calculation_version DESC, qpc.created_at DESC
    LIMIT 1
  ) calc ON true
  WHERE o.warranty_start_date IS NULL
    AND o.status_code NOT IN ('draft', 'cancelled')
)
UPDATE crm.orders o
SET
  warranty_start_date = (期限来源.confirmed_at AT TIME ZONE 'Asia/Shanghai')::date,
  warranty_end_date = (
    ((期限来源.confirmed_at AT TIME ZONE 'Asia/Shanghai')::date + make_interval(years => 期限来源.warranty_years))
    - interval '1 day'
  )::date,
  maintenance_start_date = CASE
    WHEN 期限来源.procurement_maintenance_years > 0 THEN (
      ((期限来源.confirmed_at AT TIME ZONE 'Asia/Shanghai')::date
        + make_interval(years => 期限来源.warranty_years))
    )::date
    ELSE NULL
  END,
  maintenance_end_date = CASE
    WHEN 期限来源.procurement_maintenance_years > 0 THEN (
      ((期限来源.confirmed_at AT TIME ZONE 'Asia/Shanghai')::date
        + make_interval(years => 期限来源.warranty_years + 期限来源.procurement_maintenance_years))
      - interval '1 day'
    )::date
    ELSE NULL
  END,
  warranty_manual_override = false,
  warranty_updated_at = now()
FROM 期限来源
WHERE o.id = 期限来源.order_id;

COMMIT;
