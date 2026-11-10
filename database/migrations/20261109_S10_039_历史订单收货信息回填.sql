-- S10.39：回填历史订单收货信息。
-- 老版报价转订单把收货地址写入 extra_json.deliveryAddr，
-- 把收货人和电话合并写入 extra_json.contacts（格式：姓名 手机号）。
-- 新版订单表拆分为 delivery_address / recipient_name / recipient_phone。
-- 本迁移只填补空字段，不覆盖新版页面已经写入的数据。

BEGIN;

UPDATE crm.orders o
SET delivery_address = 来源.地址
FROM (
  SELECT
    id,
    COALESCE(
      NULLIF(btrim(extra_json->>'deliveryAddress'), ''),
      NULLIF(btrim(extra_json->>'deliveryAddr'), '')
    ) AS 地址
  FROM crm.orders
) 来源
WHERE 来源.id = o.id
  AND COALESCE(btrim(o.delivery_address), '') = ''
  AND 来源.地址 IS NOT NULL;

UPDATE crm.orders o
SET recipient_name = 来源.收货人,
    recipient_phone = 来源.电话
FROM (
  SELECT
    id,
    NULLIF(
      btrim(regexp_replace(联系人, '[[:space:]]*[0-9+()-]{6,}[[:space:]]*$', '')),
      ''
    ) AS 收货人,
    NULLIF(
      btrim(substring(联系人 from '([0-9+()-]{6,})[[:space:]]*$')),
      ''
    ) AS 电话
  FROM (
    SELECT
      id,
      NULLIF(btrim(COALESCE(extra_json->>'contacts', '')), '') AS 联系人
    FROM crm.orders
  ) 联系人来源
  WHERE 联系人 IS NOT NULL
) 来源
WHERE 来源.id = o.id
  AND COALESCE(btrim(o.recipient_name), '') = ''
  AND COALESCE(btrim(o.recipient_phone), '') = ''
  AND 来源.收货人 IS NOT NULL
  AND 来源.电话 IS NOT NULL;

COMMIT;
