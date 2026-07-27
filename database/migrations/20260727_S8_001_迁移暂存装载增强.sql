-- 阶段8.3迁移暂存装载增强。
-- 本文件只允许在测试库或正式迁移窗口内按手册执行，禁止直接装载到业务正式表。

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE SCHEMA IF NOT EXISTS migration;

CREATE TABLE IF NOT EXISTS migration.schema_migrations (
  version text PRIMARY KEY,
  description text NOT NULL,
  checksum_sha256 text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  applied_by text NOT NULL DEFAULT current_user
);

CREATE TABLE IF NOT EXISTS migration.migration_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_code text NOT NULL UNIQUE,
  source_snapshot_sha256 text NOT NULL,
  source_taken_at timestamptz,
  mapping_version text NOT NULL,
  status_code text NOT NULL CHECK (status_code IN ('created','exported','imported','cleaned','loaded','validated','failed','cancelled')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  total_records bigint NOT NULL DEFAULT 0,
  failed_records bigint NOT NULL DEFAULT 0,
  note text
);

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

CREATE INDEX IF NOT EXISTS idx_v2_raw_records_entity_status
  ON migration.v2_raw_records(batch_id, entity_name, process_status);

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

CREATE INDEX IF NOT EXISTS idx_migration_errors_batch_category
  ON migration.migration_errors(batch_id, error_category, created_at DESC);

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

CREATE TABLE IF NOT EXISTS migration.v2_import_expected_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES migration.migration_batches(id) ON DELETE CASCADE,
  entity_name text NOT NULL,
  expected_records bigint NOT NULL CHECK (expected_records >= 0),
  record_group text NOT NULL CHECK (record_group IN ('crm_entity','audit_log')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, entity_name)
);

CREATE INDEX IF NOT EXISTS idx_v2_import_expected_counts_batch
  ON migration.v2_import_expected_counts(batch_id, entity_name);

INSERT INTO migration.schema_migrations (
  version, description, checksum_sha256
)
VALUES (
  '20260727_S8_001',
  '阶段8.3迁移暂存装载增强',
  '由阶段8.3交付脚本和代码审查确认'
)
ON CONFLICT (version) DO UPDATE
SET description = EXCLUDED.description;
