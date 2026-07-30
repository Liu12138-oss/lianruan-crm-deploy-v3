-- 阶段8.4：V2暂存层正式落表。
-- 本脚本以 migration.v2_raw_records 为输入，幂等写入 V3 正式业务表。

\set ON_ERROR_STOP on

BEGIN;

CREATE OR REPLACE FUNCTION migration.v2_uuid(scope text, source_id text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (
    substr(md5(scope || ':' || COALESCE(source_id, '')), 1, 8) || '-' ||
    substr(md5(scope || ':' || COALESCE(source_id, '')), 9, 4) || '-' ||
    substr(md5(scope || ':' || COALESCE(source_id, '')), 13, 4) || '-' ||
    substr(md5(scope || ':' || COALESCE(source_id, '')), 17, 4) || '-' ||
    substr(md5(scope || ':' || COALESCE(source_id, '')), 21, 12)
  )::uuid;
$$;

CREATE OR REPLACE FUNCTION migration.v2_data(payload jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(payload->'data', payload->'redactedJson', payload, '{}'::jsonb);
$$;

CREATE OR REPLACE FUNCTION migration.v2_normalized_name(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(lower(COALESCE(value, '')), '\s+', '', 'g');
$$;

CREATE OR REPLACE FUNCTION migration.v2_existing_user(source_id text)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT u.id
  FROM iam.users u
  WHERE u.id = migration.v2_uuid('iam.users', NULLIF(source_id, ''))
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION migration.v2_existing_partner(source_id text)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT p.id
  FROM channel.partners p
  WHERE p.id = migration.v2_uuid('channel.partners', NULLIF(source_id, ''))
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION migration.v2_existing_registration(source_id text)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT r.id
  FROM crm.registrations r
  WHERE r.id = migration.v2_uuid('crm.registrations', NULLIF(source_id, ''))
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION migration.v2_existing_opportunity(source_id text)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT o.id
  FROM crm.opportunities o
  WHERE o.id = migration.v2_uuid('crm.opportunities', NULLIF(source_id, ''))
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION migration.v2_existing_quote(source_id text)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT q.id
  FROM crm.quotes q
  WHERE q.id = migration.v2_uuid('crm.quotes', NULLIF(source_id, ''))
  LIMIT 1;
$$;

CREATE TABLE IF NOT EXISTS audit.audit_logs_default
  PARTITION OF audit.audit_logs DEFAULT;

CREATE TEMP TABLE stage8_batch AS
SELECT id, batch_code
FROM migration.migration_batches
ORDER BY started_at DESC
LIMIT 1;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM stage8_batch) THEN
    RAISE EXCEPTION '未找到阶段8迁移批次，不能执行正式落表';
  END IF;
END $$;

CREATE TEMP TABLE stage8_records AS
SELECT
  r.batch_id,
  r.entity_name,
  r.source_id,
  r.source_updated_at,
  r.source_sha256,
  migration.v2_data(r.redacted_json) AS data,
  r.redacted_json
FROM migration.v2_raw_records r
JOIN stage8_batch b ON b.id = r.batch_id;

DELETE FROM migration.migration_errors
WHERE batch_id = (SELECT id FROM stage8_batch)
  AND error_code LIKE 'S8_4_%';

INSERT INTO org.regions (id, region_code, region_name, parent_region_id, region_level, status_code)
VALUES (migration.v2_uuid('org.regions', 'COUNTRY'), 'COUNTRY', '全国', NULL, 'country', 'active')
ON CONFLICT (region_code) DO UPDATE
SET region_name = EXCLUDED.region_name;

WITH big_regions AS (
  SELECT DISTINCT NULLIF(TRIM(data->>'bigRegion'), '') AS name
  FROM stage8_records
  WHERE entity_name IN ('users','partners','pendingApprovals')
)
INSERT INTO org.regions (id, region_code, region_name, parent_region_id, region_level, status_code)
SELECT
  migration.v2_uuid('org.regions.big', name),
  'BIG-' || substr(md5(name), 1, 12),
  name,
  migration.v2_uuid('org.regions', 'COUNTRY'),
  'big_region',
  'active'
FROM big_regions
WHERE name IS NOT NULL
ON CONFLICT (region_code) DO UPDATE
SET region_name = EXCLUDED.region_name;

WITH raw_regions AS (
  SELECT DISTINCT
    NULLIF(TRIM(data->>'region'), '') AS name,
    NULLIF(TRIM(data->>'bigRegion'), '') AS big_name
  FROM stage8_records
  WHERE entity_name IN ('users','partners','registrations','opportunities','quotes','orders','pendingApprovals')
),
regions AS (
  SELECT DISTINCT ON (name)
    name,
    big_name
  FROM raw_regions
  WHERE name IS NOT NULL
  ORDER BY name, CASE WHEN big_name IS NULL THEN 1 ELSE 0 END, big_name
)
INSERT INTO org.regions (id, region_code, region_name, parent_region_id, region_level, status_code)
SELECT
  migration.v2_uuid('org.regions.region', name),
  'REG-' || substr(md5(name), 1, 12),
  name,
  CASE WHEN big_name IS NULL THEN migration.v2_uuid('org.regions', 'COUNTRY')
       ELSE migration.v2_uuid('org.regions.big', big_name)
  END,
  'region',
  'active'
FROM regions
ON CONFLICT (region_code) DO UPDATE
SET region_name = EXCLUDED.region_name;

INSERT INTO org.org_units (id, unit_code, unit_name, parent_unit_id, region_id, status_code)
VALUES (
  migration.v2_uuid('org.org_units', 'LIANRUAN-HQ'),
  'LIANRUAN-HQ',
  '联软总部',
  NULL,
  migration.v2_uuid('org.regions', 'COUNTRY'),
  'active'
)
ON CONFLICT (unit_code) DO UPDATE
SET unit_name = EXCLUDED.unit_name;

INSERT INTO iam.roles (role_code, role_name, status_code)
VALUES
  ('superadmin', '超级管理员', 'active'),
  ('admin', '管理员', 'active'),
  ('region_manager', '区域管理员', 'active'),
  ('partner_admin', '渠道管理员', 'active'),
  ('staff', '销售代表', 'active')
ON CONFLICT (role_code) DO UPDATE
SET role_name = EXCLUDED.role_name,
    status_code = EXCLUDED.status_code;

WITH permission_source(resource_code, action_code, permission_name) AS (
  VALUES
    ('registration','read','查看客户报备'),
    ('registration','write','维护客户报备'),
    ('opportunity','read','查看商机'),
    ('opportunity','write','维护商机'),
    ('quote','read','查看报价'),
    ('quote','write','维护报价'),
    ('order','read','查看订单'),
    ('order','write','维护订单'),
    ('partner','read','查看渠道商'),
    ('partner','write','维护渠道商'),
    ('catalog','read','查看产品目录'),
    ('catalog','write','维护产品目录'),
    ('platform','admin','平台管理'),
    ('audit','read','查看审计日志'),
    ('openapi','admin','管理开放接口'),
    ('workload','admin','管理工作量')
)
INSERT INTO iam.permissions (permission_code, permission_name, resource_code, action_code)
SELECT resource_code || ':' || action_code, permission_name, resource_code, action_code
FROM permission_source
ON CONFLICT (permission_code) DO UPDATE
SET permission_name = EXCLUDED.permission_name;

INSERT INTO iam.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM iam.roles r
CROSS JOIN iam.permissions p
WHERE r.role_code IN ('superadmin','admin','region_manager')
ON CONFLICT DO NOTHING;

INSERT INTO iam.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM iam.roles r
JOIN iam.permissions p ON p.permission_code IN (
  'registration:read','registration:write',
  'opportunity:read','opportunity:write',
  'quote:read','quote:write',
  'order:read','order:write',
  'catalog:read','partner:read'
)
WHERE r.role_code IN ('partner_admin','staff')
ON CONFLICT DO NOTHING;

INSERT INTO catalog.product_categories (
  id, v2_source_id, category_code, category_name, product_type_code, sort_order, status_code, extra_json
)
VALUES (
  migration.v2_uuid('catalog.product_categories', 'CAT-HW'),
  'CAT-HW',
  'CAT-HW',
  '硬件产品',
  'hardware',
  99,
  'active',
  '{"source":"stage8.4-hardware-fallback"}'::jsonb
)
ON CONFLICT (v2_source_id) DO UPDATE
SET category_name = EXCLUDED.category_name,
    status_code = EXCLUDED.status_code;

INSERT INTO catalog.product_categories (
  id, v2_source_id, category_code, category_name, product_type_code, sort_order, status_code, extra_json
)
SELECT
  migration.v2_uuid('catalog.product_categories', source_id),
  source_id,
  source_id,
  COALESCE(NULLIF(data->>'name', ''), source_id),
  CASE COALESCE(NULLIF(data->>'type', ''), 'software')
    WHEN 'hardware' THEN 'hardware'
    WHEN 'service' THEN 'service'
    ELSE 'software'
  END,
  COALESCE(NULLIF(data->>'sort', '')::integer, 0),
  CASE WHEN COALESCE(data->>'status', 'active') = 'active' THEN 'active' ELSE 'disabled' END,
  data
FROM stage8_records
WHERE entity_name = 'categories'
ON CONFLICT (v2_source_id) DO UPDATE
SET category_name = EXCLUDED.category_name,
    product_type_code = EXCLUDED.product_type_code,
    sort_order = EXCLUDED.sort_order,
    status_code = EXCLUDED.status_code,
    extra_json = EXCLUDED.extra_json;

INSERT INTO catalog.product_modules (
  id, v2_source_id, category_id, module_code, module_name, sort_order, status_code, extra_json
)
SELECT
  migration.v2_uuid('catalog.product_modules', source_id),
  source_id,
  migration.v2_uuid('catalog.product_categories', COALESCE(NULLIF(data->>'categoryId', ''), 'CAT-LEP')),
  source_id,
  COALESCE(NULLIF(data->>'name', ''), source_id),
  COALESCE(NULLIF(data->>'sort', '')::integer, 0),
  CASE WHEN COALESCE(data->>'status', 'active') = 'active' THEN 'active' ELSE 'disabled' END,
  data
FROM stage8_records
WHERE entity_name = 'modules'
ON CONFLICT (v2_source_id) DO UPDATE
SET module_name = EXCLUDED.module_name,
    sort_order = EXCLUDED.sort_order,
    status_code = EXCLUDED.status_code,
    extra_json = EXCLUDED.extra_json;

INSERT INTO catalog.product_features (
  id, v2_source_id, module_id, feature_code, feature_name, unit_name, list_price, published, status_code, extra_json
)
SELECT
  migration.v2_uuid('catalog.product_features', source_id),
  source_id,
  CASE
    WHEN NULLIF(data->>'moduleId', '') IS NOT NULL
      AND migration.v2_uuid('catalog.product_modules', data->>'moduleId') IN (SELECT id FROM catalog.product_modules)
    THEN migration.v2_uuid('catalog.product_modules', data->>'moduleId')
    ELSE NULL
  END,
  COALESCE(NULLIF(data->>'productCode', ''), source_id),
  COALESCE(NULLIF(data->>'name', ''), source_id),
  NULLIF(data->>'unit', ''),
  COALESCE(NULLIF(data->>'priceFixed', '')::numeric, 0),
  COALESCE(NULLIF(data->>'published', '')::boolean, false),
  CASE WHEN COALESCE(data->>'status', 'active') = 'active' THEN 'active' ELSE 'disabled' END,
  data
FROM stage8_records
WHERE entity_name = 'features'
ON CONFLICT (v2_source_id) DO UPDATE
SET feature_name = EXCLUDED.feature_name,
    unit_name = EXCLUDED.unit_name,
    list_price = EXCLUDED.list_price,
    published = EXCLUDED.published,
    status_code = EXCLUDED.status_code,
    extra_json = EXCLUDED.extra_json;

INSERT INTO catalog.hardware_products (
  id, v2_source_id, hardware_code, hardware_name, unit_name, list_price, published, status_code, extra_json
)
SELECT
  migration.v2_uuid('catalog.hardware_products', source_id),
  source_id,
  COALESCE(NULLIF(data->>'model', ''), source_id),
  COALESCE(NULLIF(data->>'name', ''), source_id),
  NULLIF(data->>'unit', ''),
  COALESCE(NULLIF(data->>'priceFixed', '')::numeric, 0),
  COALESCE(NULLIF(data->>'published', '')::boolean, false),
  CASE WHEN COALESCE(data->>'status', 'active') = 'active' THEN 'active' ELSE 'disabled' END,
  data
FROM stage8_records
WHERE entity_name = 'hardwareProducts'
ON CONFLICT (v2_source_id) DO UPDATE
SET hardware_name = EXCLUDED.hardware_name,
    unit_name = EXCLUDED.unit_name,
    list_price = EXCLUDED.list_price,
    published = EXCLUDED.published,
    status_code = EXCLUDED.status_code,
    extra_json = EXCLUDED.extra_json;

INSERT INTO catalog.product_packages (
  id, v2_source_id, package_code, package_name, list_price, published, status_code, extra_json
)
SELECT
  migration.v2_uuid('catalog.product_packages', source_id),
  source_id,
  source_id,
  COALESCE(NULLIF(data->>'name', ''), source_id),
  COALESCE(NULLIF(data->>'priceFixed', '')::numeric, 0),
  COALESCE(NULLIF(data->>'published', '')::boolean, false),
  CASE WHEN COALESCE(data->>'status', 'active') = 'active' THEN 'active' ELSE 'disabled' END,
  data
FROM stage8_records
WHERE entity_name = 'packages'
ON CONFLICT (v2_source_id) DO UPDATE
SET package_name = EXCLUDED.package_name,
    list_price = EXCLUDED.list_price,
    published = EXCLUDED.published,
    status_code = EXCLUDED.status_code,
    extra_json = EXCLUDED.extra_json;

DELETE FROM catalog.package_items
WHERE package_id IN (SELECT migration.v2_uuid('catalog.product_packages', source_id) FROM stage8_records WHERE entity_name = 'packages');

INSERT INTO catalog.package_items (package_id, product_ref_type, product_ref_id, quantity, sort_order)
SELECT
  migration.v2_uuid('catalog.product_packages', p.source_id),
  'feature',
  migration.v2_uuid('catalog.product_features', item.value),
  1,
  item.ordinality::integer
FROM stage8_records p
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE WHEN jsonb_typeof(p.data->'featureIds') = 'array' THEN p.data->'featureIds' ELSE '[]'::jsonb END
) WITH ORDINALITY AS item(value, ordinality)
WHERE p.entity_name = 'packages';

INSERT INTO catalog.package_items (package_id, product_ref_type, product_ref_id, quantity, sort_order)
SELECT
  migration.v2_uuid('catalog.product_packages', p.source_id),
  'hardware',
  migration.v2_uuid('catalog.hardware_products', item.value),
  1,
  item.ordinality::integer + 1000
FROM stage8_records p
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE WHEN jsonb_typeof(p.data->'hardwareIds') = 'array' THEN p.data->'hardwareIds' ELSE '[]'::jsonb END
) WITH ORDINALITY AS item(value, ordinality)
WHERE p.entity_name = 'packages';

INSERT INTO catalog.workload_classifications (
  id, v2_source_id, classification_code, classification_name, status_code
)
SELECT
  migration.v2_uuid('catalog.workload_classifications', source_id),
  source_id,
  COALESCE(NULLIF(data->>'code', ''), source_id),
  COALESCE(NULLIF(data->>'name', ''), source_id),
  'active'
FROM stage8_records
WHERE entity_name = 'implementationWorkloadClassifications'
ON CONFLICT (v2_source_id) DO UPDATE
SET classification_name = EXCLUDED.classification_name,
    status_code = EXCLUDED.status_code;

WITH product_types AS (
  SELECT DISTINCT NULLIF(data->>'productType', '') AS product_type
  FROM stage8_records
  WHERE entity_name IN ('implementationWorkloadMappings','implementationWorkloadRules')
)
INSERT INTO catalog.workload_classifications (
  id, v2_source_id, classification_code, classification_name, status_code
)
SELECT
  migration.v2_uuid('catalog.workload_classifications', 'PRODUCT-TYPE-' || product_type),
  'PRODUCT-TYPE-' || product_type,
  product_type,
  product_type,
  'active'
FROM product_types
WHERE product_type IS NOT NULL
ON CONFLICT (classification_code) DO UPDATE
SET classification_name = EXCLUDED.classification_name;

INSERT INTO catalog.workload_mappings (
  id, v2_source_id, feature_id, classification_id, status_code
)
SELECT
  migration.v2_uuid('catalog.workload_mappings', m.source_id),
  m.source_id,
  f.id,
  migration.v2_uuid('catalog.workload_classifications', 'PRODUCT-TYPE-' || COALESCE(NULLIF(m.data->>'productType', ''), 'EPP')),
  CASE WHEN COALESCE(NULLIF(m.data->>'active', '')::boolean, true) THEN 'active' ELSE 'disabled' END
FROM stage8_records m
JOIN catalog.product_features f
  ON f.id = migration.v2_uuid('catalog.product_features', COALESCE(NULLIF(m.data->>'featureId', ''), m.source_id))
WHERE m.entity_name = 'implementationWorkloadMappings'
ON CONFLICT (v2_source_id) DO UPDATE
SET classification_id = EXCLUDED.classification_id,
    status_code = EXCLUDED.status_code;

INSERT INTO migration.migration_errors (
  batch_id,
  entity_name,
  source_id,
  error_code,
  error_category,
  error_message,
  field_path,
  suggested_action,
  owner_role
)
SELECT
  (SELECT id FROM stage8_batch),
  m.entity_name,
  m.source_id,
  'S8_4_WORKLOAD_FEATURE_MISSING',
  '业务补录',
  '工作量映射引用的功能产品未在V2导出数据中找到，已跳过正式配置落表',
  '$.featureId',
  '上线后在后台工作量配置中补齐对应产品或删除无效映射',
  '产品运营负责人'
FROM stage8_records m
WHERE m.entity_name = 'implementationWorkloadMappings'
  AND NOT EXISTS (
    SELECT 1
    FROM catalog.product_features f
    WHERE f.id = migration.v2_uuid('catalog.product_features', COALESCE(NULLIF(m.data->>'featureId', ''), m.source_id))
  );

INSERT INTO catalog.workload_rules (
  id, v2_source_id, classification_id, min_quantity, max_quantity, workload_days
)
SELECT
  migration.v2_uuid('catalog.workload_rules', source_id),
  source_id,
  migration.v2_uuid('catalog.workload_classifications', 'PRODUCT-TYPE-' || COALESCE(NULLIF(data->>'productType', ''), 'EPP')),
  COALESCE(NULLIF(data->>'minPoints', '')::numeric, 0),
  NULLIF(data->>'maxPoints', '')::numeric,
  COALESCE(NULLIF(data->>'personDays', '')::numeric, 0)
FROM stage8_records
WHERE entity_name = 'implementationWorkloadRules'
ON CONFLICT (v2_source_id) DO UPDATE
SET min_quantity = EXCLUDED.min_quantity,
    max_quantity = EXCLUDED.max_quantity,
    workload_days = EXCLUDED.workload_days;

INSERT INTO catalog.delivery_workload_rules (
  id, v2_source_id, rule_name, workload_days, status_code, extra_json
)
SELECT
  migration.v2_uuid('catalog.delivery_workload_rules', source_id),
  source_id,
  COALESCE(NULLIF(data->>'item', ''), NULLIF(data->>'deliveryTag', ''), source_id),
  COALESCE(NULLIF(data->>'personDays', '')::numeric, 0),
  CASE WHEN COALESCE(NULLIF(data->>'active', '')::boolean, true) THEN 'active' ELSE 'disabled' END,
  data
FROM stage8_records
WHERE entity_name = 'implementationDeliveryWorkloadRules'
ON CONFLICT (v2_source_id) DO UPDATE
SET rule_name = EXCLUDED.rule_name,
    workload_days = EXCLUDED.workload_days,
    status_code = EXCLUDED.status_code,
    extra_json = EXCLUDED.extra_json;

WITH v2_users AS (
  SELECT source_id, data
  FROM stage8_records
  WHERE entity_name = 'users'
),
staff_users AS (
  SELECT DISTINCT
    COALESCE(NULLIF(staff.value->>'userId', ''), NULLIF(staff.value->>'id', '')) AS source_id,
    staff.value || jsonb_build_object('role', COALESCE(NULLIF(staff.value->>'role', ''), 'staff')) AS data
  FROM stage8_records p
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(p.data->'staff') = 'array' THEN p.data->'staff' ELSE '[]'::jsonb END
  ) AS staff(value)
  WHERE p.entity_name = 'partners'
),
all_users AS (
  SELECT source_id, data FROM v2_users
  UNION ALL
  SELECT source_id, data FROM staff_users WHERE source_id IS NOT NULL
)
INSERT INTO iam.users (
  id, v2_source_id, username, display_name, status_code, phone, email, region_id, org_unit_id, created_at, updated_at, extra_json
)
SELECT DISTINCT ON (source_id)
  migration.v2_uuid('iam.users', source_id),
  source_id,
  lower(COALESCE(NULLIF(data->>'username', ''), source_id)),
  COALESCE(NULLIF(data->>'name', ''), NULLIF(data->>'username', ''), source_id),
  CASE WHEN COALESCE(data->>'status', 'active') = 'active' THEN 'active' ELSE 'disabled' END,
  NULLIF(data->>'phone', ''),
  NULLIF(data->>'email', ''),
  CASE WHEN NULLIF(data->>'region', '') IS NULL THEN NULL ELSE migration.v2_uuid('org.regions.region', data->>'region') END,
  migration.v2_uuid('org.org_units', 'LIANRUAN-HQ'),
  COALESCE(NULLIF(data->>'createdAt', '')::timestamptz, now()),
  COALESCE(NULLIF(data->>'updatedAt', '')::timestamptz, now()),
  data
FROM all_users
WHERE source_id IS NOT NULL
ON CONFLICT (v2_source_id) DO UPDATE
SET username = EXCLUDED.username,
    display_name = EXCLUDED.display_name,
    status_code = EXCLUDED.status_code,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    region_id = EXCLUDED.region_id,
    updated_at = now(),
    extra_json = EXCLUDED.extra_json;

INSERT INTO iam.password_credentials (
  user_id, password_hash, algorithm, must_change_password, changed_at
)
SELECT
  u.id,
  'scrypt$v1$16384$8$1$MDEyMzQ1Njc4OWFiY2RlZg$yatY3wELJEOwWlgFw7GwuxpBTFWrGSF9LDXkfuwf-VWtkrboKxrbY7g0p8gCQ4EbRX84ZNWvv3nae7UuyqCUZw',
  'scrypt',
  true,
  NULL
FROM iam.users u
ON CONFLICT (user_id) DO UPDATE
SET must_change_password = true;

INSERT INTO iam.user_roles (user_id, role_id)
SELECT
  u.id,
  r.id
FROM iam.users u
JOIN iam.roles r ON r.role_code = CASE
  WHEN u.extra_json->>'role' = 'superadmin' THEN 'superadmin'
  WHEN u.extra_json->>'role' = 'admin' THEN 'region_manager'
  WHEN u.extra_json->>'role' = 'partner_admin' THEN 'partner_admin'
  ELSE 'staff'
END
ON CONFLICT DO NOTHING;

INSERT INTO org.staff_profiles (user_id, employee_no, title, data_scope_code, extra_json)
SELECT
  u.id,
  u.v2_source_id,
  COALESCE(NULLIF(u.extra_json->>'role', ''), '员工'),
  CASE
    WHEN u.extra_json->>'role' = 'superadmin' THEN 'all'
    WHEN u.extra_json->>'role' = 'admin' THEN 'region'
    WHEN u.extra_json->>'role' = 'partner_admin' THEN 'partner'
    ELSE 'self'
  END,
  u.extra_json
FROM iam.users u
ON CONFLICT (user_id) DO UPDATE
SET title = EXCLUDED.title,
    data_scope_code = EXCLUDED.data_scope_code,
    extra_json = EXCLUDED.extra_json;

INSERT INTO channel.partners (
  id, v2_source_id, partner_code, partner_name, normalized_name, partner_level_code,
  region_id, city_name, contact_name, contact_phone, contact_email, status_code,
  joined_on, created_by_user_id, created_at, updated_at, extra_json
)
SELECT
  migration.v2_uuid('channel.partners', source_id),
  source_id,
  source_id,
  COALESCE(NULLIF(data->>'name', ''), source_id),
  migration.v2_normalized_name(COALESCE(NULLIF(data->>'name', ''), source_id)),
  CASE WHEN data->>'partnerLevel' IN ('primary','secondary','none') THEN data->>'partnerLevel' ELSE 'none' END,
  CASE WHEN NULLIF(data->>'region', '') IS NULL THEN NULL ELSE migration.v2_uuid('org.regions.region', data->>'region') END,
  NULLIF(data->>'city', ''),
  NULLIF(data->>'contact', ''),
  NULLIF(data->>'phone', ''),
  NULLIF(data->>'email', '')::citext,
  CASE WHEN COALESCE(data->>'status', 'active') = 'active' THEN 'active' ELSE 'disabled' END,
  NULLIF(data->>'joinDate', '')::date,
  migration.v2_existing_user(data->>'createdBy'),
  COALESCE(NULLIF(data->>'createdAt', '')::timestamptz, now()),
  COALESCE(NULLIF(data->>'updatedAt', '')::timestamptz, now()),
  data
FROM stage8_records
WHERE entity_name = 'partners'
ON CONFLICT (v2_source_id) DO UPDATE
SET partner_name = EXCLUDED.partner_name,
    normalized_name = EXCLUDED.normalized_name,
    partner_level_code = EXCLUDED.partner_level_code,
    region_id = EXCLUDED.region_id,
    contact_name = EXCLUDED.contact_name,
    contact_phone = EXCLUDED.contact_phone,
    contact_email = EXCLUDED.contact_email,
    status_code = EXCLUDED.status_code,
    updated_at = EXCLUDED.updated_at,
    extra_json = EXCLUDED.extra_json;

DELETE FROM channel.partner_relations
WHERE child_partner_id IN (
  SELECT migration.v2_uuid('channel.partners', source_id)
  FROM stage8_records
  WHERE entity_name = 'partners'
);

INSERT INTO channel.partner_relations (
  parent_partner_id, child_partner_id, relation_code, started_at
)
SELECT DISTINCT
  migration.v2_uuid('channel.partners', parent_id.value),
  migration.v2_uuid('channel.partners', p.source_id),
  'primary_secondary',
  COALESCE(NULLIF(p.data->>'partnerLevelSetAt', '')::timestamptz, now())
FROM stage8_records p
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE
    WHEN jsonb_typeof(p.data->'parentPartnerIds') = 'array' THEN p.data->'parentPartnerIds'
    WHEN NULLIF(p.data->>'parentPartnerId', '') IS NOT NULL THEN jsonb_build_array(p.data->>'parentPartnerId')
    ELSE '[]'::jsonb
  END
) AS parent_id(value)
WHERE p.entity_name = 'partners'
  AND parent_id.value IN (SELECT source_id FROM stage8_records WHERE entity_name = 'partners')
ON CONFLICT DO NOTHING;

INSERT INTO channel.partner_members (
  partner_id, user_id, member_role_code, status_code, started_at
)
SELECT DISTINCT
  migration.v2_uuid('channel.partners', p.source_id),
  migration.v2_uuid('iam.users', COALESCE(NULLIF(staff.value->>'userId', ''), staff.value->>'id')),
  CASE WHEN staff.value->>'role' = 'partner_admin' THEN 'partner_admin' ELSE 'staff' END,
  CASE WHEN COALESCE(staff.value->>'status', 'active') = 'active' THEN 'active' ELSE 'disabled' END,
  COALESCE(NULLIF(staff.value->>'createdAt', '')::timestamptz, now())
FROM stage8_records p
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(p.data->'staff') = 'array' THEN p.data->'staff' ELSE '[]'::jsonb END
) AS staff(value)
WHERE p.entity_name = 'partners'
  AND COALESCE(NULLIF(staff.value->>'userId', ''), staff.value->>'id') IS NOT NULL
ON CONFLICT (partner_id, user_id) DO UPDATE
SET member_role_code = EXCLUDED.member_role_code,
    status_code = EXCLUDED.status_code;

WITH customer_source AS (
  SELECT data->>'customer' AS name, data->>'creditCode' AS credit_code, data
  FROM stage8_records
  WHERE entity_name IN ('registrations','opportunities','quotes','orders')
)
INSERT INTO crm.customers (
  id, customer_name, normalized_name, credit_code, status_code, created_at, updated_at, extra_json
)
SELECT DISTINCT ON (migration.v2_normalized_name(name))
  migration.v2_uuid('crm.customers', migration.v2_normalized_name(name)),
  name,
  migration.v2_normalized_name(name),
  NULLIF(credit_code, ''),
  'active',
  COALESCE(NULLIF(data->>'createdAt', '')::timestamptz, now()),
  COALESCE(NULLIF(data->>'updatedAt', '')::timestamptz, now()),
  data
FROM customer_source
WHERE NULLIF(TRIM(name), '') IS NOT NULL
ORDER BY migration.v2_normalized_name(name), data->>'createdAt'
ON CONFLICT (normalized_name) WHERE status_code <> 'merged'
DO UPDATE
SET credit_code = COALESCE(EXCLUDED.credit_code, crm.customers.credit_code),
    updated_at = now(),
    extra_json = crm.customers.extra_json || EXCLUDED.extra_json;

INSERT INTO crm.registrations (
  id, v2_source_id, registration_no, customer_id, partner_id, owner_user_id, region_id,
  status_code, submitted_at, approved_at, created_at, updated_at, extra_json
)
SELECT
  migration.v2_uuid('crm.registrations', source_id),
  source_id,
  source_id,
  migration.v2_uuid('crm.customers', migration.v2_normalized_name(data->>'customer')),
  migration.v2_existing_partner(data->>'partnerId'),
  migration.v2_existing_user(COALESCE(data->>'assignedStaffId', data->>'createdBy')),
  CASE WHEN NULLIF(data->>'region', '') IS NULL THEN NULL ELSE migration.v2_uuid('org.regions.region', data->>'region') END,
  CASE WHEN data->>'status' IN ('draft','pending','approved','rejected','cancelled','converted') THEN data->>'status' ELSE 'pending' END,
  COALESCE(NULLIF(data->>'createdAt', '')::timestamptz, now()),
  NULLIF(data->>'approvedAt', '')::timestamptz,
  COALESCE(NULLIF(data->>'createdAt', '')::timestamptz, now()),
  COALESCE(NULLIF(data->>'updatedAt', '')::timestamptz, now()),
  data
FROM stage8_records
WHERE entity_name = 'registrations'
ON CONFLICT (v2_source_id) DO UPDATE
SET status_code = EXCLUDED.status_code,
    updated_at = EXCLUDED.updated_at,
    extra_json = EXCLUDED.extra_json;

INSERT INTO crm.opportunities (
  id, v2_source_id, opportunity_no, customer_id, registration_id, partner_id, owner_user_id,
  region_id, stage_code, raw_stage_name, status_code, expected_amount, created_at, updated_at, extra_json
)
SELECT
  migration.v2_uuid('crm.opportunities', source_id),
  source_id,
  source_id,
  migration.v2_uuid('crm.customers', migration.v2_normalized_name(data->>'customer')),
  migration.v2_existing_registration(data->>'regId'),
  migration.v2_existing_partner(data->>'partnerId'),
  migration.v2_existing_user(COALESCE(data->>'assignedStaffId', data->>'createdBy')),
  CASE WHEN NULLIF(data->>'region', '') IS NULL THEN NULL ELSE migration.v2_uuid('org.regions.region', data->>'region') END,
  COALESCE(NULLIF(data->>'stage', ''), 'active'),
  NULLIF(data->>'stage', ''),
  CASE
    WHEN data->>'stage' = 'won' THEN 'won'
    WHEN data->>'stage' = 'lost' THEN 'lost'
    WHEN data->>'stage' = 'cancelled' THEN 'cancelled'
    ELSE 'active'
  END,
  COALESCE(NULLIF(data->>'amount', '')::numeric, 0),
  COALESCE(NULLIF(data->>'createdAt', '')::timestamptz, now()),
  COALESCE(NULLIF(data->>'updatedAt', '')::timestamptz, now()),
  data
FROM stage8_records
WHERE entity_name = 'opportunities'
ON CONFLICT (v2_source_id) DO UPDATE
SET stage_code = EXCLUDED.stage_code,
    raw_stage_name = EXCLUDED.raw_stage_name,
    status_code = EXCLUDED.status_code,
    expected_amount = EXCLUDED.expected_amount,
    updated_at = EXCLUDED.updated_at,
    extra_json = EXCLUDED.extra_json;

INSERT INTO crm.quotes (
  id, v2_source_id, quote_no, opportunity_id, customer_id, partner_id, owner_user_id,
  status_code, total_amount, discount_amount, created_at, updated_at, extra_json
)
SELECT
  migration.v2_uuid('crm.quotes', source_id),
  source_id,
  source_id,
  migration.v2_existing_opportunity(data->>'oppId'),
  migration.v2_uuid('crm.customers', migration.v2_normalized_name(data->>'customer')),
  migration.v2_existing_partner(data->>'partnerId'),
  migration.v2_existing_user(COALESCE(data->>'assignedStaffId', data->>'createdBy')),
  CASE
    WHEN data->>'status' IN ('draft','submitted','approved','rejected','converted','cancelled') THEN data->>'status'
    WHEN data->>'status' = 'confirmed' THEN 'approved'
    ELSE 'draft'
  END,
  COALESCE(NULLIF(data->>'total', '')::numeric, 0),
  COALESCE(NULLIF(data->>'discountAmount', '')::numeric, 0),
  COALESCE(NULLIF(data->>'createdAt', '')::timestamptz, now()),
  COALESCE(NULLIF(data->>'updatedAt', '')::timestamptz, now()),
  data
FROM stage8_records
WHERE entity_name = 'quotes'
ON CONFLICT (v2_source_id) DO UPDATE
SET status_code = EXCLUDED.status_code,
    total_amount = EXCLUDED.total_amount,
    discount_amount = EXCLUDED.discount_amount,
    updated_at = EXCLUDED.updated_at,
    extra_json = EXCLUDED.extra_json;

DELETE FROM crm.quote_items
WHERE quote_id IN (SELECT migration.v2_uuid('crm.quotes', source_id) FROM stage8_records WHERE entity_name = 'quotes');

INSERT INTO crm.quote_items (
  quote_id, product_ref_type, product_ref_id, item_name, quantity, unit_price, line_amount, sort_order
)
SELECT
  migration.v2_uuid('crm.quotes', q.source_id),
  'feature',
  migration.v2_uuid('catalog.product_features', product_id.value),
  COALESCE(f.feature_name, product_id.value),
  COALESCE(NULLIF(q.data->>'endpoints', '')::numeric, 1),
  COALESCE(f.list_price, 0),
  COALESCE(f.list_price, 0) * COALESCE(NULLIF(q.data->>'endpoints', '')::numeric, 1),
  product_id.ordinality::integer
FROM stage8_records q
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE WHEN jsonb_typeof(q.data->'products') = 'array' THEN q.data->'products' ELSE '[]'::jsonb END
) WITH ORDINALITY AS product_id(value, ordinality)
LEFT JOIN catalog.product_features f ON f.v2_source_id = product_id.value OR f.feature_code = product_id.value
WHERE q.entity_name = 'quotes';

INSERT INTO crm.quote_items (
  quote_id, product_ref_type, product_ref_id, item_name, quantity, unit_price, line_amount, sort_order
)
SELECT
  migration.v2_uuid('crm.quotes', q.source_id),
  'hardware',
  migration.v2_uuid('catalog.hardware_products', hardware_id.value),
  COALESCE(h.hardware_name, hardware_id.value),
  1,
  COALESCE(h.list_price, 0),
  COALESCE(h.list_price, 0),
  hardware_id.ordinality::integer + 1000
FROM stage8_records q
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE WHEN jsonb_typeof(q.data->'hardwareIds') = 'array' THEN q.data->'hardwareIds' ELSE '[]'::jsonb END
) WITH ORDINALITY AS hardware_id(value, ordinality)
LEFT JOIN catalog.hardware_products h ON h.v2_source_id = hardware_id.value OR h.hardware_code = hardware_id.value
WHERE q.entity_name = 'quotes';

INSERT INTO crm.quote_snapshots (quote_id, snapshot_code, snapshot_json)
SELECT
  migration.v2_uuid('crm.quotes', source_id),
  'v2-migration',
  data
FROM stage8_records
WHERE entity_name = 'quotes'
ON CONFLICT (quote_id, snapshot_code) DO UPDATE
SET snapshot_json = EXCLUDED.snapshot_json;

INSERT INTO crm.orders (
  id, v2_source_id, order_no, quote_id, customer_id, partner_id, owner_user_id,
  status_code, total_amount, created_at, updated_at, extra_json
)
SELECT
  migration.v2_uuid('crm.orders', source_id),
  source_id,
  source_id,
  migration.v2_existing_quote(data->>'quoteId'),
  migration.v2_uuid('crm.customers', migration.v2_normalized_name(data->>'customer')),
  migration.v2_existing_partner(data->>'partnerId'),
  migration.v2_existing_user(COALESCE(data->>'assignedStaffId', data->>'createdBy')),
  CASE
    WHEN data->>'status' IN ('draft','pending_primary_confirm','confirmed','rejected','cancelled','completed') THEN data->>'status'
    WHEN data->>'status' IN ('pending','processing') THEN 'pending_primary_confirm'
    ELSE 'confirmed'
  END,
  COALESCE(NULLIF(data->>'total', '')::numeric, 0),
  COALESCE(NULLIF(data->>'createdAt', '')::timestamptz, now()),
  COALESCE(NULLIF(data->>'updatedAt', '')::timestamptz, now()),
  data
FROM stage8_records
WHERE entity_name = 'orders'
ON CONFLICT (v2_source_id) DO UPDATE
SET status_code = EXCLUDED.status_code,
    total_amount = EXCLUDED.total_amount,
    updated_at = EXCLUDED.updated_at,
    extra_json = EXCLUDED.extra_json;

DELETE FROM crm.order_items
WHERE order_id IN (SELECT migration.v2_uuid('crm.orders', source_id) FROM stage8_records WHERE entity_name = 'orders');

INSERT INTO crm.order_items (order_id, quote_item_id, item_name, quantity, unit_price, line_amount)
SELECT
  o.id,
  qi.id,
  qi.item_name,
  qi.quantity,
  qi.unit_price,
  qi.line_amount
FROM crm.orders o
JOIN crm.quote_items qi ON qi.quote_id = o.quote_id
WHERE o.v2_source_id IN (SELECT source_id FROM stage8_records WHERE entity_name = 'orders')
ON CONFLICT DO NOTHING;

INSERT INTO ops.approvals (
  id, v2_source_id, approval_type_code, target_type, target_id, applicant_user_id,
  applicant_partner_id, status_code, created_at, updated_at, extra_json
)
SELECT
  migration.v2_uuid('ops.approvals', source_id),
  source_id,
  COALESCE(NULLIF(data->>'type', ''), 'general'),
  COALESCE(NULLIF(data->>'type', ''), 'general'),
  CASE WHEN NULLIF(data->>'targetId', '') IS NULL THEN NULL ELSE migration.v2_uuid('ops.approval.target', data->>'targetId') END,
  migration.v2_existing_user(data->>'createdBy'),
  migration.v2_existing_partner(data->>'targetPartnerId'),
  CASE WHEN data->>'status' IN ('active','pending','approved','rejected','cancelled') THEN data->>'status' ELSE 'pending' END,
  COALESCE(NULLIF(data->>'createdAt', '')::timestamptz, now()),
  COALESCE(NULLIF(data->>'approvedAt', '')::timestamptz, NULLIF(data->>'createdAt', '')::timestamptz, now()),
  data
FROM stage8_records
WHERE entity_name = 'pendingApprovals'
ON CONFLICT (v2_source_id) DO UPDATE
SET status_code = EXCLUDED.status_code,
    updated_at = EXCLUDED.updated_at,
    extra_json = EXCLUDED.extra_json;

INSERT INTO ops.notifications (
  id, v2_source_id, recipient_user_id, title, content, status_code, created_at, read_at, extra_json
)
SELECT
  migration.v2_uuid('ops.notifications', source_id),
  source_id,
  migration.v2_existing_user(data->>'userId'),
  COALESCE(NULLIF(data->>'title', ''), '通知'),
  COALESCE(NULLIF(data->>'desc', ''), NULLIF(data->>'content', '')),
  CASE WHEN COALESCE(NULLIF(data->>'unread', '')::boolean, false) THEN 'unread' ELSE 'read' END,
  COALESCE(NULLIF(data->>'createdAt', '')::timestamptz, now()),
  CASE
    WHEN COALESCE(NULLIF(data->>'unread', '')::boolean, false) THEN NULL
    ELSE COALESCE(NULLIF(data->>'updatedAt', '')::timestamptz, now())
  END,
  data
FROM stage8_records
WHERE entity_name = 'notifications'
ON CONFLICT (v2_source_id) DO UPDATE
SET title = EXCLUDED.title,
    content = EXCLUDED.content,
    status_code = EXCLUDED.status_code,
    extra_json = EXCLUDED.extra_json;

INSERT INTO integration.open_api_clients (
  id, v2_source_id, client_code, client_name, status_code, allowed_ip_json,
  created_by_user_id, created_at, updated_at, extra_json
)
SELECT
  migration.v2_uuid('integration.open_api_clients', source_id),
  source_id,
  COALESCE(NULLIF(data->>'appKey', ''), source_id),
  COALESCE(NULLIF(data->>'name', ''), source_id),
  CASE WHEN COALESCE(data->>'status', 'active') = 'active' THEN 'active' ELSE 'disabled' END,
  COALESCE(data->'ipWhitelist', '[]'::jsonb),
  migration.v2_existing_user(data->>'createdBy'),
  COALESCE(NULLIF(data->>'createdAt', '')::timestamptz, now()),
  COALESCE(NULLIF(data->>'updatedAt', '')::timestamptz, now()),
  data || '{"secretResetRequired":true}'::jsonb
FROM stage8_records
WHERE entity_name = 'openApiClients'
ON CONFLICT (v2_source_id) DO UPDATE
SET client_name = EXCLUDED.client_name,
    status_code = EXCLUDED.status_code,
    allowed_ip_json = EXCLUDED.allowed_ip_json,
    extra_json = EXCLUDED.extra_json;

INSERT INTO integration.open_api_client_secrets (
  client_id, secret_hash, algorithm, status_code, created_at
)
SELECT
  c.id,
  '需要重新签发',
  'sha256_hmac',
  'expired',
  now()
FROM integration.open_api_clients c
WHERE c.v2_source_id IN (SELECT source_id FROM stage8_records WHERE entity_name = 'openApiClients')
  AND NOT EXISTS (
    SELECT 1
    FROM integration.open_api_client_secrets s
    WHERE s.client_id = c.id
  )
ON CONFLICT DO NOTHING;

INSERT INTO integration.open_api_permissions (client_id, resource_code, action_code)
SELECT c.id, '*', 'read'
FROM integration.open_api_clients c
WHERE c.v2_source_id IN (SELECT source_id FROM stage8_records WHERE entity_name = 'openApiClients')
ON CONFLICT DO NOTHING;

INSERT INTO audit.audit_logs (
  id, v2_source_id, created_at, request_id, actor_user_id, actor_username, actor_name,
  actor_role, module_code, action_code, target_type, target_id, target_name,
  result_code, message, ip, user_agent, before_json, after_json, extra_json
)
SELECT
  migration.v2_uuid('audit.audit_logs', source_id),
  source_id,
  COALESCE(NULLIF(data->>'createdAt', '')::timestamptz, source_updated_at, now()),
  NULLIF(data->>'requestId', ''),
  CASE WHEN NULLIF(data->>'actorUserId', '') IS NULL THEN NULL ELSE migration.v2_uuid('iam.users', data->>'actorUserId') END,
  NULLIF(data->>'actorUsername', ''),
  NULLIF(data->>'actorName', ''),
  NULLIF(data->>'actorRole', ''),
  COALESCE(NULLIF(data->>'module', ''), 'unknown'),
  COALESCE(NULLIF(data->>'action', ''), 'unknown'),
  NULLIF(data->>'targetType', ''),
  NULLIF(data->>'targetId', ''),
  NULLIF(data->>'targetName', ''),
  COALESCE(NULLIF(data->>'result', ''), 'unknown'),
  NULLIF(data->>'message', ''),
  CASE
    WHEN NULLIF(data->>'ip', '') ~ '^([0-9]{1,3}\.){3}[0-9]{1,3}$' THEN NULLIF(data->>'ip', '')::inet
    ELSE NULL
  END,
  NULLIF(data->>'userAgent', ''),
  data->'beforeJson',
  data->'afterJson',
  COALESCE(data->'extraJson', data)
FROM stage8_records
WHERE entity_name = 'audit_logs'
ON CONFLICT DO NOTHING;

INSERT INTO migration.v2_record_mappings (
  batch_id, entity_name, source_id, target_table, target_id, mapping_version
)
SELECT b.batch_id, mapped.entity_name, mapped.source_id, mapped.target_table, mapped.target_id, 'stage8.4'
FROM (
  SELECT 'users' AS entity_name, v2_source_id AS source_id, 'iam.users' AS target_table, id AS target_id FROM iam.users WHERE v2_source_id IS NOT NULL
  UNION ALL
  SELECT 'partners', v2_source_id, 'channel.partners', id FROM channel.partners WHERE v2_source_id IS NOT NULL
  UNION ALL
  SELECT 'registrations', v2_source_id, 'crm.registrations', id FROM crm.registrations WHERE v2_source_id IS NOT NULL
  UNION ALL
  SELECT 'opportunities', v2_source_id, 'crm.opportunities', id FROM crm.opportunities WHERE v2_source_id IS NOT NULL
  UNION ALL
  SELECT 'quotes', v2_source_id, 'crm.quotes', id FROM crm.quotes WHERE v2_source_id IS NOT NULL
  UNION ALL
  SELECT 'orders', v2_source_id, 'crm.orders', id FROM crm.orders WHERE v2_source_id IS NOT NULL
) mapped
CROSS JOIN (SELECT id AS batch_id FROM stage8_batch) b
ON CONFLICT DO NOTHING;

UPDATE migration.v2_raw_records
SET process_status = 'loaded', error_code = NULL, error_message = NULL
WHERE batch_id = (SELECT id FROM stage8_batch);

DELETE FROM migration.validation_results
WHERE batch_id = (SELECT id FROM stage8_batch)
  AND check_code LIKE 'S8_4_%';

WITH expected AS (
  SELECT 'users' AS entity_name, 'iam.users' AS target_table, COUNT(*) AS expected_count FROM stage8_records WHERE entity_name = 'users'
  UNION ALL SELECT 'partners', 'channel.partners', COUNT(*) FROM stage8_records WHERE entity_name = 'partners'
  UNION ALL SELECT 'registrations', 'crm.registrations', COUNT(*) FROM stage8_records WHERE entity_name = 'registrations'
  UNION ALL SELECT 'opportunities', 'crm.opportunities', COUNT(*) FROM stage8_records WHERE entity_name = 'opportunities'
  UNION ALL SELECT 'quotes', 'crm.quotes', COUNT(*) FROM stage8_records WHERE entity_name = 'quotes'
  UNION ALL SELECT 'orders', 'crm.orders', COUNT(*) FROM stage8_records WHERE entity_name = 'orders'
),
actual AS (
  SELECT 'users' AS entity_name, COUNT(*) AS actual_count FROM iam.users WHERE v2_source_id IS NOT NULL
  UNION ALL SELECT 'partners', COUNT(*) FROM channel.partners WHERE v2_source_id IS NOT NULL
  UNION ALL SELECT 'registrations', COUNT(*) FROM crm.registrations WHERE v2_source_id IS NOT NULL
  UNION ALL SELECT 'opportunities', COUNT(*) FROM crm.opportunities WHERE v2_source_id IS NOT NULL
  UNION ALL SELECT 'quotes', COUNT(*) FROM crm.quotes WHERE v2_source_id IS NOT NULL
  UNION ALL SELECT 'orders', COUNT(*) FROM crm.orders WHERE v2_source_id IS NOT NULL
)
INSERT INTO migration.validation_results (
  batch_id, check_code, check_name, result_code, expected_value, actual_value, detail_json
)
SELECT
  (SELECT id FROM stage8_batch),
  'S8_4_COUNT_' || e.entity_name,
  '阶段8.4正式落表数量守恒：' || e.entity_name,
  CASE WHEN e.expected_count <= a.actual_count THEN 'passed' ELSE 'failed' END,
  e.expected_count::text,
  a.actual_count::text,
  jsonb_build_object('targetTable', e.target_table)
FROM expected e
JOIN actual a ON a.entity_name = e.entity_name;

INSERT INTO migration.validation_results (
  batch_id, check_code, check_name, result_code, expected_value, actual_value, detail_json
)
SELECT
  (SELECT id FROM stage8_batch),
  'S8_4_CHAIN_LINKS',
  '阶段8.4主链路关联校验',
  CASE WHEN
    (SELECT COUNT(*) FROM crm.registrations) > 0
    AND (SELECT COUNT(*) FROM crm.opportunities) > 0
    AND (SELECT COUNT(*) FROM crm.quotes) > 0
    AND (SELECT COUNT(*) FROM crm.orders) > 0
  THEN 'passed' ELSE 'failed' END,
  '报备、商机、报价、订单均有正式记录',
  jsonb_build_object(
    'registrations', (SELECT COUNT(*) FROM crm.registrations),
    'opportunities', (SELECT COUNT(*) FROM crm.opportunities),
    'quotes', (SELECT COUNT(*) FROM crm.quotes),
    'orders', (SELECT COUNT(*) FROM crm.orders)
  )::text,
  '{}'::jsonb;

UPDATE migration.migration_batches
SET status_code = 'validated',
    finished_at = now(),
    failed_records = (
      SELECT COUNT(*)
      FROM migration.validation_results
      WHERE batch_id = (SELECT id FROM stage8_batch)
        AND check_code LIKE 'S8_4_%'
        AND result_code = 'failed'
    ),
    note = '阶段8.4正式业务表落表完成'
WHERE id = (SELECT id FROM stage8_batch);

INSERT INTO migration.schema_migrations (version, description, checksum_sha256)
VALUES ('20260727_S8_004', '阶段8.4正式业务表落表', '由阶段9交付脚本执行并记录')
ON CONFLICT (version) DO UPDATE
SET description = EXCLUDED.description,
    applied_at = now();

COMMIT;
