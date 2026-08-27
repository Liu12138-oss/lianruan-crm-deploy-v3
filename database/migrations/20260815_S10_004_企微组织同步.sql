-- S10-004：企业微信组织单向受控同步。默认只生成差异，绝不自动改写业务主体。

CREATE SCHEMA IF NOT EXISTS integration;

CREATE TABLE IF NOT EXISTS integration.directory_connectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_code text NOT NULL CHECK (provider_code IN ('wecom')),
  connector_name text NOT NULL,
  corp_id text NOT NULL,
  agent_id text NOT NULL,
  secret_ciphertext text NOT NULL,
  secret_nonce text NOT NULL,
  secret_auth_tag text NOT NULL,
  status_code text NOT NULL DEFAULT 'disabled' CHECK (status_code IN ('disabled','readonly','enabled','degraded')),
  config_version bigint NOT NULL DEFAULT 1,
  visible_scope_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES iam.users(id),
  UNIQUE (provider_code, corp_id, agent_id)
);

CREATE TABLE IF NOT EXISTS integration.directory_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id uuid NOT NULL REFERENCES integration.directory_connectors(id) ON DELETE RESTRICT,
  run_type text NOT NULL CHECK (run_type IN ('preview','full','incremental','reconcile','apply')),
  status_code text NOT NULL DEFAULT 'queued' CHECK (status_code IN ('queued','running','previewed','awaiting_approval','applying','completed','failed','paused')),
  source_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  statistics_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_by_user_id uuid REFERENCES iam.users(id)
);

CREATE TABLE IF NOT EXISTS integration.directory_sync_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES integration.directory_sync_runs(id) ON DELETE CASCADE,
  object_type text NOT NULL CHECK (object_type IN ('department','member')),
  external_id text NOT NULL,
  change_type text NOT NULL CHECK (change_type IN ('create','update','move','disable','delete')),
  risk_level text NOT NULL CHECK (risk_level IN ('low','medium','high')),
  before_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  row_version bigint NOT NULL DEFAULT 1,
  approval_status text NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending','approved','rejected')),
  apply_status text NOT NULL DEFAULT 'not_applied' CHECK (apply_status IN ('not_applied','applied','skipped','failed')),
  approved_by_user_id uuid REFERENCES iam.users(id),
  approved_at timestamptz,
  applied_at timestamptz,
  UNIQUE (run_id, object_type, external_id, change_type)
);

CREATE TABLE IF NOT EXISTS integration.directory_callback_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id uuid REFERENCES integration.directory_connectors(id) ON DELETE SET NULL,
  dedupe_key text NOT NULL UNIQUE,
  event_type text NOT NULL,
  payload_hash text NOT NULL,
  status_code text NOT NULL DEFAULT 'received' CHECK (status_code IN ('received','queued','processed','failed','ignored')),
  received_count int NOT NULL DEFAULT 1,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  error_summary text
);

CREATE TABLE IF NOT EXISTS integration.directory_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id uuid NOT NULL REFERENCES integration.directory_connectors(id) ON DELETE CASCADE,
  object_type text NOT NULL CHECK (object_type IN ('department','member')),
  external_id text NOT NULL,
  local_object_id uuid,
  status_code text NOT NULL DEFAULT 'active' CHECK (status_code IN ('active','inactive','conflict')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connector_id, object_type, external_id)
);
