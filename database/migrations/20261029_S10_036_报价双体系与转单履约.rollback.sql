-- S10.36 回滚：保留既有报价、订单、渠道和审计数据。

BEGIN;

DROP TABLE IF EXISTS channel.partner_order_targets;
DROP TABLE IF EXISTS crm.order_contract_attachments;

DROP INDEX IF EXISTS crm.idx_orders_pricing_status;
ALTER TABLE crm.orders
  DROP CONSTRAINT IF EXISTS orders_pricing_status_code_check,
  DROP CONSTRAINT IF EXISTS orders_shipment_amount_check,
  DROP CONSTRAINT IF EXISTS orders_quote_type_code_check,
  DROP COLUMN IF EXISTS pricing_status_code,
  DROP COLUMN IF EXISTS delivery_address,
  DROP COLUMN IF EXISTS recipient_phone,
  DROP COLUMN IF EXISTS recipient_name,
  DROP COLUMN IF EXISTS shipment_amount,
  DROP COLUMN IF EXISTS original_amount,
  DROP COLUMN IF EXISTS quote_type_code;

DROP INDEX IF EXISTS crm.idx_quotes_quote_type_status;
ALTER TABLE crm.quotes
  DROP CONSTRAINT IF EXISTS quotes_quote_type_code_check,
  DROP COLUMN IF EXISTS quote_type_code;

COMMIT;
