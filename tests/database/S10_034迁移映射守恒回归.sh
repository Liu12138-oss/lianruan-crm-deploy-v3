#!/usr/bin/env bash
set -euo pipefail

# 在事务内验证 S10_034：可恢复订单、已有订单只重定向映射、冲突来源不自动改写。
# 默认连接本地测试容器；末尾统一回滚，不保留客户、报价、订单或迁移测试数据。

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
migration_file="${repo_root}/database/migrations/20261026_S10_034_V2迁移映射守恒与历史订单修复.sql"
container_name="${S10034_PG_CONTAINER:-lianruan-crm-v3-postgres}"
database_user="${S10034_PG_USER:-lianruan}"
database_name="${S10034_PG_DATABASE:-lianruan_crm_v3_test}"
tmp_dir="$(mktemp -d /tmp/s10034-regression.XXXXXX)"

if [[ ! -f "${migration_file}" ]]; then
  echo "未找到迁移文件：${migration_file}" >&2
  exit 1
fi

awk '/^BEGIN;$/{next} /^COMMIT;$/{next} {print}' "${migration_file}" > "${tmp_dir}/02-migration.sql"

cat > "${tmp_dir}/01-setup.sql" <<'SQL'
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE tmp_s10034_fixture (
  用例 text PRIMARY KEY,
  source_id text NOT NULL,
  quote_source text NOT NULL,
  quote_id uuid NOT NULL,
  customer_name text NOT NULL,
  customer_id uuid NOT NULL,
  order_no text NOT NULL,
  target_id uuid NOT NULL,
  existing_order_id uuid,
  existing_source text
) ON COMMIT DROP;
WITH 后缀 AS (
  SELECT substr(replace(gen_random_uuid()::text, '-', ''), 1, 12) AS 值
)
INSERT INTO tmp_s10034_fixture
SELECT
  用例,
  'S10-034-' || 用例 || '-' || 后缀.值,
  'Q-' || 用例 || '-' || 后缀.值,
  gen_random_uuid(),
  'S10-034回归客户' || 用例 || 后缀.值,
  gen_random_uuid(),
  'ORD-S10034-' || 用例 || '-' || 后缀.值,
  gen_random_uuid(),
  NULL,
  NULL
FROM 后缀
CROSS JOIN (VALUES ('A'), ('B'), ('C')) AS 值(用例);
UPDATE tmp_s10034_fixture
SET quote_id = migration.v2_uuid('crm.quotes', quote_source);
INSERT INTO crm.customers (id, customer_name, normalized_name)
SELECT customer_id, customer_name, migration.v2_normalized_name(customer_name)
FROM tmp_s10034_fixture;
INSERT INTO crm.quotes (id, quote_no, status_code, total_amount)
SELECT quote_id, 'QT-S10034-' || 用例 || '-' || substr(quote_id::text, 1, 8), 'converted', 100
FROM tmp_s10034_fixture;
UPDATE tmp_s10034_fixture
SET existing_order_id = gen_random_uuid(),
    existing_source = 'S10-034-EXISTING-' || substr(gen_random_uuid()::text, 1, 12)
WHERE 用例 = 'C';
INSERT INTO crm.orders (
  id, v2_source_id, order_no, quote_id, customer_id, status_code, total_amount, business_type_code
)
SELECT existing_order_id, existing_source, order_no || '-C现有', quote_id, customer_id, 'confirmed', 100, 'product'
FROM tmp_s10034_fixture
WHERE 用例 = 'C';
UPDATE tmp_s10034_fixture
SET existing_order_id = gen_random_uuid()
WHERE 用例 = 'B';
INSERT INTO crm.orders (
  id, v2_source_id, order_no, quote_id, customer_id, status_code, total_amount, business_type_code
)
SELECT existing_order_id, NULL, order_no || '-B现有', quote_id, customer_id, 'confirmed', 100, 'product'
FROM tmp_s10034_fixture
WHERE 用例 = 'B';
INSERT INTO migration.v2_raw_records (
  batch_id, entity_name, source_id, source_updated_at, source_sha256, raw_json, redacted_json
)
SELECT b.id, 'orders', f.source_id, now(), 's10-034-regression',
       jsonb_build_object('data', jsonb_build_object(
         'quoteId', f.quote_source,
         'customer', f.customer_name,
         'orderNo', f.order_no,
         'total', 100,
         'status', 'confirmed'
       )),
       jsonb_build_object(
         'quoteId', f.quote_source,
         'customer', f.customer_name,
         'orderNo', f.order_no,
         'total', 100,
         'status', 'confirmed'
       )
FROM tmp_s10034_fixture f
CROSS JOIN LATERAL (
  SELECT id FROM migration.migration_batches ORDER BY started_at DESC, id DESC LIMIT 1
) b;
INSERT INTO migration.v2_record_mappings (
  batch_id, entity_name, source_id, target_table, target_id, mapping_version
)
SELECT b.id, 'orders', f.source_id, 'crm.orders', f.target_id, 's10-034-regression'
FROM tmp_s10034_fixture f
CROSS JOIN LATERAL (
  SELECT id FROM migration.migration_batches ORDER BY started_at DESC, id DESC LIMIT 1
) b;
SQL

cat > "${tmp_dir}/03-assert.sql" <<'SQL'
\set ON_ERROR_STOP on
DO $$
DECLARE
  A源 text; B源 text; C源 text;
  B目标 uuid; C目标 uuid;
  B现有 uuid; C现有 uuid;
  B报价 uuid; C报价 uuid;
  A订单数 int; B订单数 int; C订单数 int; C目标订单数 int;
BEGIN
  SELECT source_id INTO A源 FROM tmp_s10034_fixture WHERE 用例='A';
  SELECT source_id, target_id, existing_order_id, quote_id INTO B源, B目标, B现有, B报价
  FROM tmp_s10034_fixture WHERE 用例='B';
  SELECT source_id, target_id, existing_order_id, quote_id INTO C源, C目标, C现有, C报价
  FROM tmp_s10034_fixture WHERE 用例='C';

  SELECT count(*) INTO A订单数 FROM crm.orders WHERE v2_source_id=A源;
  IF A订单数 <> 1 THEN RAISE EXCEPTION 'A场景未恢复订单：%', A订单数; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM migration.v2_record_mappings WHERE source_id=B源 AND target_id=B现有
  ) THEN
    RAISE EXCEPTION 'B场景映射未重定向到现有订单';
  END IF;
  IF EXISTS (SELECT 1 FROM crm.orders WHERE id=B目标) THEN
    RAISE EXCEPTION 'B场景错误创建第二张订单';
  END IF;
  SELECT count(*) INTO B订单数 FROM crm.orders WHERE quote_id=B报价;
  IF B订单数 <> 1 THEN RAISE EXCEPTION 'B场景报价订单数量不为1：%', B订单数; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM migration.v2_record_mappings WHERE source_id=C源 AND target_id=C目标
  ) THEN
    RAISE EXCEPTION 'C场景冲突映射被错误改写';
  END IF;
  SELECT count(*) INTO C目标订单数 FROM crm.orders WHERE id=C目标;
  IF C目标订单数 <> 0 THEN RAISE EXCEPTION 'C场景冲突目标被错误恢复'; END IF;
  SELECT count(*) INTO C订单数 FROM crm.orders WHERE quote_id=C报价;
  IF C订单数 <> 1 THEN RAISE EXCEPTION 'C场景关联订单数量异常：%', C订单数; END IF;

  RAISE NOTICE 'S10_034回归通过：A恢复、B重定向、C保留冲突';
END $$;
SQL

printf 'ROLLBACK;\n' > "${tmp_dir}/04-rollback.sql"

{
  cat "${tmp_dir}/01-setup.sql"
  cat "${tmp_dir}/02-migration.sql"
  cat "${tmp_dir}/03-assert.sql"
  cat "${tmp_dir}/04-rollback.sql"
} | docker exec -i "${container_name}" psql -U "${database_user}" -d "${database_name}" -v ON_ERROR_STOP=1 -f -

echo "S10_034 迁移回归完成，事务已回滚。测试中间文件：${tmp_dir}"
