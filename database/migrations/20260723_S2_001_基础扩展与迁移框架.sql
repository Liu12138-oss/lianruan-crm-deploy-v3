
-- 阶段2迁移草案：基础扩展与迁移框架。
-- 本文件只用于评审和测试环境，禁止直接在生产库手工执行。

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE SCHEMA IF NOT EXISTS migration;
CREATE SCHEMA IF NOT EXISTS iam;
CREATE SCHEMA IF NOT EXISTS org;
CREATE SCHEMA IF NOT EXISTS channel;
CREATE SCHEMA IF NOT EXISTS catalog;
CREATE SCHEMA IF NOT EXISTS crm;
CREATE SCHEMA IF NOT EXISTS ops;
CREATE SCHEMA IF NOT EXISTS integration;
CREATE SCHEMA IF NOT EXISTS audit;

CREATE TABLE IF NOT EXISTS migration.schema_migrations (
  version text PRIMARY KEY,
  description text NOT NULL,
  checksum_sha256 text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  applied_by text NOT NULL DEFAULT current_user
);

CREATE TABLE IF NOT EXISTS migration.migration_locks (
  lock_key text PRIMARY KEY,
  locked_at timestamptz NOT NULL DEFAULT now(),
  locked_by text NOT NULL DEFAULT current_user,
  note text
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
