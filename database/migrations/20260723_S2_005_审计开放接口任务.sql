
-- 阶段2迁移草案：通知、审批、任务、开放接口、审计。

CREATE TABLE IF NOT EXISTS ops.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  v2_source_id text UNIQUE,
  recipient_user_id uuid REFERENCES iam.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  content text,
  status_code text NOT NULL DEFAULT 'unread' CHECK (status_code IN ('unread','read','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  extra_json jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS ops.approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  v2_source_id text UNIQUE,
  approval_type_code text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  applicant_user_id uuid REFERENCES iam.users(id),
  applicant_partner_id uuid REFERENCES channel.partners(id),
  status_code text NOT NULL CHECK (status_code IN ('active','pending','approved','rejected','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  extra_json jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_approvals_type_status ON ops.approvals(approval_type_code, status_code, created_at DESC);

CREATE TABLE IF NOT EXISTS ops.approval_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id uuid NOT NULL REFERENCES ops.approvals(id) ON DELETE CASCADE,
  event_code text NOT NULL,
  from_status_code text,
  to_status_code text,
  actor_user_id uuid REFERENCES iam.users(id),
  event_at timestamptz NOT NULL DEFAULT now(),
  reason text,
  extra_json jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS ops.files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_key text NOT NULL UNIQUE,
  original_name text NOT NULL,
  mime_type text,
  file_size bigint NOT NULL CHECK (file_size >= 0),
  sha256 text NOT NULL,
  storage_path text NOT NULL,
  owner_user_id uuid REFERENCES iam.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

CREATE TABLE IF NOT EXISTS ops.import_export_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type_code text NOT NULL CHECK (task_type_code IN ('import','export','migration','report')),
  business_type_code text NOT NULL,
  status_code text NOT NULL CHECK (status_code IN ('queued','running','succeeded','failed','cancelled')),
  requested_by_user_id uuid REFERENCES iam.users(id),
  input_file_id uuid REFERENCES ops.files(id),
  output_file_id uuid REFERENCES ops.files(id),
  progress_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  extra_json jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS ops.idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_code text NOT NULL,
  idem_key text NOT NULL,
  request_hash text NOT NULL,
  response_hash text,
  status_code text NOT NULL CHECK (status_code IN ('processing','succeeded','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  UNIQUE (scope_code, idem_key)
);

CREATE TABLE IF NOT EXISTS ops.outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  payload_json jsonb NOT NULL,
  status_code text NOT NULL DEFAULT 'pending' CHECK (status_code IN ('pending','processing','sent','failed','cancelled')),
  retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  next_retry_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON ops.outbox_events(status_code, next_retry_at, created_at);

CREATE TABLE IF NOT EXISTS integration.open_api_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  v2_source_id text UNIQUE,
  client_code text NOT NULL UNIQUE,
  client_name text NOT NULL,
  status_code text NOT NULL CHECK (status_code IN ('active','disabled')),
  allowed_ip_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by_user_id uuid REFERENCES iam.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  extra_json jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS integration.open_api_client_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES integration.open_api_clients(id) ON DELETE CASCADE,
  secret_hash text NOT NULL,
  algorithm text NOT NULL CHECK (algorithm IN ('scrypt','sha256_hmac')),
  status_code text NOT NULL DEFAULT 'active' CHECK (status_code IN ('active','disabled','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

CREATE TABLE IF NOT EXISTS integration.open_api_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES integration.open_api_clients(id) ON DELETE CASCADE,
  resource_code text NOT NULL,
  action_code text NOT NULL DEFAULT 'read',
  UNIQUE (client_id, resource_code, action_code)
);

CREATE TABLE IF NOT EXISTS integration.open_api_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES integration.open_api_clients(id) ON DELETE SET NULL,
  request_id text,
  resource_code text,
  action_code text,
  result_code text NOT NULL,
  status_code integer,
  duration_ms integer CHECK (duration_ms IS NULL OR duration_ms >= 0),
  requested_at timestamptz NOT NULL DEFAULT now(),
  extra_json jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_open_api_access_client_time ON integration.open_api_access_logs(client_id, requested_at DESC);

CREATE TABLE IF NOT EXISTS audit.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  v2_source_id text,
  created_at timestamptz NOT NULL,
  request_id text,
  actor_user_id uuid,
  actor_username text,
  actor_name text,
  actor_role text,
  module_code text NOT NULL,
  action_code text NOT NULL,
  target_type text,
  target_id text,
  target_name text,
  result_code text NOT NULL,
  message text,
  ip inet,
  user_agent text,
  before_json jsonb,
  after_json jsonb,
  extra_json jsonb,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
COMMENT ON TABLE audit.audit_logs IS '操作审计日志，按created_at分区。';

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_time ON audit.audit_logs(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module_action ON audit.audit_logs(module_code, action_code, created_at DESC);
