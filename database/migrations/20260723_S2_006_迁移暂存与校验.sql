
-- 阶段2迁移草案：迁移暂存、错误和校验表。

CREATE TABLE IF NOT EXISTS migration.v2_raw_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES migration.migration_batches(id) ON DELETE CASCADE,
  entity_name text NOT NULL,
  source_id text NOT NULL,
  source_updated_at timestamptz,
  source_sha256 text NOT NULL,
  raw_json jsonb NOT NULL,
  redacted_json jsonb NOT NULL,
  process_status text NOT NULL DEFAULT 'pending' CHECK (process_status IN ('pending','mapped','loaded','isolated','failed')),
  error_code text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, entity_name, source_id)
);
CREATE INDEX IF NOT EXISTS idx_v2_raw_records_entity_status ON migration.v2_raw_records(batch_id, entity_name, process_status);

CREATE TABLE IF NOT EXISTS migration.v2_record_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES migration.migration_batches(id) ON DELETE CASCADE,
  entity_name text NOT NULL,
  source_id text NOT NULL,
  target_table text NOT NULL,
  target_id uuid NOT NULL,
  mapping_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, entity_name, source_id, target_table),
  UNIQUE (target_table, target_id)
);

CREATE TABLE IF NOT EXISTS migration.migration_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES migration.migration_batches(id) ON DELETE CASCADE,
  entity_name text NOT NULL,
  source_id text,
  error_code text NOT NULL,
  error_category text NOT NULL CHECK (error_category IN ('自动映射','业务补录','隔离','阻断迁移')),
  error_message text NOT NULL,
  field_path text,
  suggested_action text,
  owner_role text,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_migration_errors_batch_category ON migration.migration_errors(batch_id, error_category, created_at DESC);

CREATE TABLE IF NOT EXISTS migration.validation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES migration.migration_batches(id) ON DELETE CASCADE,
  check_code text NOT NULL,
  check_name text NOT NULL,
  result_code text NOT NULL CHECK (result_code IN ('passed','failed','warning','skipped')),
  expected_value text,
  actual_value text,
  detail_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, check_code)
);

-- 迁移验收必须包含以下校验项：数量守恒、唯一字段、外键、状态、金额、权限样本。
INSERT INTO migration.validation_results (
  batch_id, check_code, check_name, result_code, expected_value, actual_value
)
SELECT id, 'S2-CHECK-TEMPLATE', '阶段2校验项模板占位', 'skipped', '正式演练时写入', '当前为SQL草案'
FROM migration.migration_batches
WHERE false;
