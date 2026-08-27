-- S10-005：组织数据范围与离职交接的安全闭环。
-- 本迁移只扩展组织域事实和事务发件箱登记；绝不修改既有 CRM、账号、任职或渠道归属。

ALTER TABLE iam.data_scope_bindings
  ADD COLUMN IF NOT EXISTS resource_code text NOT NULL DEFAULT 'organization',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE iam.data_scope_bindings
  DROP CONSTRAINT IF EXISTS data_scope_bindings_resource_code_check;
ALTER TABLE iam.data_scope_bindings
  ADD CONSTRAINT data_scope_bindings_resource_code_check
  CHECK (resource_code IN ('organization', 'customer', 'registration', 'opportunity', 'quote', 'order'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_data_scope_binding_active
  ON iam.data_scope_bindings(role_id, resource_code, scope_type, (COALESCE(scope_ref_id, '00000000-0000-0000-0000-000000000000'::uuid)))
  WHERE status_code = 'active';

CREATE INDEX IF NOT EXISTS idx_data_scope_bindings_role_resource
  ON iam.data_scope_bindings(role_id, resource_code)
  WHERE status_code = 'active';

ALTER TABLE org.offboarding_handover
  ADD COLUMN IF NOT EXISTS scan_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS scan_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS scan_retry_count integer NOT NULL DEFAULT 0
    CHECK (scan_retry_count >= 0);

ALTER TABLE org.offboarding_handover
  DROP CONSTRAINT IF EXISTS offboarding_handover_status_code_check;
ALTER TABLE org.offboarding_handover
  ADD CONSTRAINT offboarding_handover_status_code_check
  CHECK (status_code IN (
    'pending_scan', 'scanned', 'transferring', 'partial_failed',
    'completed', 'awaiting_task_queue', 'closed', 'cancelled'
  ));

ALTER TABLE org.offboarding_handover_items
  ADD COLUMN IF NOT EXISTS detail_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS actual_recipient_user_id uuid REFERENCES iam.users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS scanned_at timestamptz,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0);

CREATE INDEX IF NOT EXISTS idx_offboarding_handover_items_status
  ON org.offboarding_handover_items(handover_id, status_code);

COMMENT ON COLUMN iam.data_scope_bindings.resource_code IS
  '范围适用资源。当前仅供组织模块配置和审计，未接入既有业务运行时权限判定。';
COMMENT ON COLUMN org.offboarding_handover.scan_requested_at IS
  '最近一次只读影响扫描登记时间；扫描只固化交接项，不自动变更任何业务归属。';
