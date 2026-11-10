-- S10.36：报价双体系、订单区管补价、转单收货与合同附件、渠道订单目标。

BEGIN;

ALTER TABLE crm.quotes
  ADD COLUMN IF NOT EXISTS quote_type_code text;

UPDATE crm.quotes q
SET quote_type_code = CASE
  WHEN q.partner_id IS NOT NULL
    OR COALESCE(q.extra_json->>'partnerId', '') <> ''
    OR COALESCE(q.extra_json->'workloadSnapshot'->'定价上下文'->>'渠道层级', '') <> ''
  THEN 'channel_distribution'
  ELSE 'standard'
END
WHERE q.quote_type_code IS NULL;

ALTER TABLE crm.quotes
  ALTER COLUMN quote_type_code SET DEFAULT 'channel_distribution',
  ALTER COLUMN quote_type_code SET NOT NULL;

ALTER TABLE crm.quotes
  DROP CONSTRAINT IF EXISTS quotes_quote_type_code_check;
ALTER TABLE crm.quotes
  ADD CONSTRAINT quotes_quote_type_code_check
  CHECK (quote_type_code IN ('standard', 'channel_distribution'));

CREATE INDEX IF NOT EXISTS idx_quotes_quote_type_status
  ON crm.quotes(quote_type_code, status_code, created_at DESC);

ALTER TABLE crm.orders
  ADD COLUMN IF NOT EXISTS quote_type_code text,
  ADD COLUMN IF NOT EXISTS original_amount numeric(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipment_amount numeric(18,2),
  ADD COLUMN IF NOT EXISTS recipient_name text,
  ADD COLUMN IF NOT EXISTS recipient_phone text,
  ADD COLUMN IF NOT EXISTS delivery_address text,
  ADD COLUMN IF NOT EXISTS pricing_status_code text NOT NULL DEFAULT 'priced';

UPDATE crm.orders o
SET quote_type_code = COALESCE(q.quote_type_code, 'channel_distribution')
FROM crm.quotes q
WHERE q.id = o.quote_id
  AND o.quote_type_code IS NULL;

UPDATE crm.orders
SET quote_type_code = 'channel_distribution'
WHERE quote_type_code IS NULL;

ALTER TABLE crm.orders
  ALTER COLUMN quote_type_code SET DEFAULT 'channel_distribution',
  ALTER COLUMN quote_type_code SET NOT NULL;

ALTER TABLE crm.orders
  DROP CONSTRAINT IF EXISTS orders_quote_type_code_check;
ALTER TABLE crm.orders
  ADD CONSTRAINT orders_quote_type_code_check
  CHECK (quote_type_code IN ('standard', 'channel_distribution'));

ALTER TABLE crm.orders
  DROP CONSTRAINT IF EXISTS orders_shipment_amount_check;
ALTER TABLE crm.orders
  ADD CONSTRAINT orders_shipment_amount_check
  CHECK (shipment_amount IS NULL OR shipment_amount >= 0);

ALTER TABLE crm.orders
  DROP CONSTRAINT IF EXISTS orders_pricing_status_code_check;
ALTER TABLE crm.orders
  ADD CONSTRAINT orders_pricing_status_code_check
  CHECK (pricing_status_code IN ('pending_region_price', 'priced'));

UPDATE crm.orders o
SET original_amount = COALESCE(
  NULLIF(q.extra_json->>'originalAmount', '')::numeric,
  (
    SELECT NULLIF(
      SUM(
        COALESCE(NULLIF(item->'定价明细'->>'标准单价', '')::numeric, 0)
        * COALESCE(NULLIF(item->>'数量', '')::numeric, 0)
      ),
      0
    )
    FROM jsonb_array_elements(
      COALESCE(q.extra_json->'workloadSnapshot'->'items', '[]'::jsonb)
    ) AS item
  ),
  o.total_amount,
  0
)
FROM crm.quotes q
WHERE q.id = o.quote_id
  AND o.original_amount = 0;

UPDATE crm.orders
SET pricing_status_code = CASE
  WHEN quote_type_code = 'standard'
    AND COALESCE(total_amount, 0) = 0
    AND status_code NOT IN ('confirmed', 'processing', 'shipped', 'completed', 'cancelled', 'replaced')
  THEN 'pending_region_price'
  ELSE 'priced'
END;

CREATE INDEX IF NOT EXISTS idx_orders_pricing_status
  ON crm.orders(pricing_status_code, status_code, created_at DESC);

CREATE TABLE IF NOT EXISTS crm.order_contract_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES crm.orders(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_name text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 20971520),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  status_code text NOT NULL DEFAULT 'active' CHECK (status_code IN ('active', 'deleted')),
  uploaded_by_user_id uuid REFERENCES iam.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_contract_attachments_order
  ON crm.order_contract_attachments(order_id, status_code, created_at);

CREATE TABLE IF NOT EXISTS channel.partner_order_targets (
  partner_id uuid NOT NULL REFERENCES channel.partners(id) ON DELETE CASCADE,
  target_year integer NOT NULL CHECK (target_year BETWEEN 2000 AND 9999),
  target_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (target_amount >= 0),
  remark text NOT NULL DEFAULT '',
  updated_by_user_id uuid REFERENCES iam.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (partner_id, target_year)
);

CREATE INDEX IF NOT EXISTS idx_partner_order_targets_year
  ON channel.partner_order_targets(target_year, partner_id);

COMMIT;
