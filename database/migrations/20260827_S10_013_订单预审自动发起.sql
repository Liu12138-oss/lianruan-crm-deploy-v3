-- S10-013：渠道产品订单预审自动发起。
-- 只创建可追溯的配置、请求、调用和建群事实；不预置人员、部门、区域或外部身份映射。

CREATE TABLE IF NOT EXISTS integration.order_preapproval_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_code text NOT NULL,
  environment_code text NOT NULL DEFAULT 'shared',
  template_version text NOT NULL,
  workflow_id text NOT NULL,
  form_id text NOT NULL,
  status_code text NOT NULL DEFAULT 'active'
    CHECK (status_code IN ('active', 'disabled', 'invalid')),
  field_mapping_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  CHECK (length(btrim(template_code)) BETWEEN 1 AND 100),
  CHECK (length(btrim(template_version)) BETWEEN 1 AND 100),
  CHECK (length(btrim(workflow_id)) BETWEEN 1 AND 100),
  CHECK (length(btrim(form_id)) BETWEEN 1 AND 100),
  CHECK (jsonb_typeof(field_mapping_json) = 'object'),
  UNIQUE (template_code, environment_code, template_version)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_order_preapproval_templates_active
  ON integration.order_preapproval_templates(template_code, environment_code)
  WHERE status_code = 'active';

COMMENT ON TABLE integration.order_preapproval_templates IS
  '订单预审泛微模板的版本化字段映射。字段变更必须新增或停用版本，不得改写已发起请求快照。';

INSERT INTO integration.order_preapproval_templates (
  template_code, environment_code, template_version, workflow_id, form_id, status_code, field_mapping_json
)
VALUES (
  'channel_product_order_precheck',
  'shared',
  '2026-08-27-v1',
  '7412314682719324051',
  '7412314682719324051',
  'active',
  '{
    "productTypeValue": "EPP渠道产品",
    "purchaseContentValue": "详见采购订单上传处的报价单",
    "fields": {
      "region": {"fieldId": "1475873629259637057", "controlType": "select"},
      "orderNo": {"fieldId": "4742314689772812364", "controlType": "text"},
      "contractPartner": {"fieldId": "4742314689772812365", "controlType": "text"},
      "endUser": {"fieldId": "4742314689772812366", "controlType": "text"},
      "productType": {"fieldId": "1297557904233988097", "controlType": "checkbox"},
      "purchaseContent": {"fieldId": "4742314689772812367", "controlType": "textarea"},
      "purchaseAttachment": {"fieldId": "4742314795739512449", "controlType": "file"},
      "quoteAttachment": {"fieldId": "1150265436892569601", "controlType": "file"}
    }
  }'::jsonb
)
ON CONFLICT (template_code, environment_code, template_version) DO NOTHING;

CREATE TABLE IF NOT EXISTS integration.order_preapproval_region_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES integration.order_preapproval_templates(id) ON DELETE RESTRICT,
  region_id uuid NOT NULL REFERENCES org.regions(id) ON DELETE RESTRICT,
  external_value text NOT NULL,
  status_code text NOT NULL DEFAULT 'active' CHECK (status_code IN ('active', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  CHECK (length(btrim(external_value)) BETWEEN 1 AND 200)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_order_preapproval_region_mapping_active
  ON integration.order_preapproval_region_mappings(template_id, region_id)
  WHERE status_code = 'active';

COMMENT ON TABLE integration.order_preapproval_region_mappings IS
  'V3 区域与泛微所属区域真实选项的显式映射。未维护时任务必须转人工，禁止按名称猜测。';

CREATE TABLE IF NOT EXISTS integration.order_preapproval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES crm.orders(id) ON DELETE RESTRICT,
  template_id uuid REFERENCES integration.order_preapproval_templates(id) ON DELETE RESTRICT,
  template_version text NOT NULL,
  trigger_code text NOT NULL CHECK (trigger_code IN ('region_confirmed', 'superadmin_confirmed_after_price_adjust')),
  region_manager_user_id uuid REFERENCES iam.users(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL,
  status_code text NOT NULL DEFAULT 'pending'
    CHECK (status_code IN ('pending', 'processing', 'accepted', 'failed', 'manual_confirmation_required', 'stopped')),
  external_request_id text,
  failure_code text,
  failure_summary text,
  template_snapshot_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_snapshot_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  accepted_at timestamptz,
  stopped_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  CHECK (length(btrim(idempotency_key)) BETWEEN 1 AND 200),
  CHECK (external_request_id IS NULL OR length(btrim(external_request_id)) BETWEEN 1 AND 200),
  CHECK (failure_code IS NULL OR length(btrim(failure_code)) <= 100),
  CHECK (failure_summary IS NULL OR length(failure_summary) <= 500),
  CHECK (jsonb_typeof(template_snapshot_json) = 'object'),
  CHECK (jsonb_typeof(request_snapshot_json) = 'object'),
  UNIQUE (order_id),
  UNIQUE (idempotency_key),
  UNIQUE (external_request_id)
);

CREATE INDEX IF NOT EXISTS idx_order_preapproval_requests_status_created
  ON integration.order_preapproval_requests(status_code, created_at);

COMMENT ON TABLE integration.order_preapproval_requests IS
  '每个订单唯一的一次渠道产品订单预审发起事实；失败、停止和待人工确认均不允许自动重发。';

CREATE TABLE IF NOT EXISTS integration.order_preapproval_invocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES integration.order_preapproval_requests(id) ON DELETE RESTRICT,
  operation_code text NOT NULL
    CHECK (operation_code IN ('oa_upload_purchase', 'oa_upload_quote', 'oa_create', 'oa_verify', 'wecom_group_create', 'wecom_group_notice')),
  outcome_code text NOT NULL CHECK (outcome_code IN ('started', 'accepted', 'failed', 'manual_confirmation_required', 'stopped')),
  duration_ms integer CHECK (duration_ms IS NULL OR duration_ms >= 0),
  http_status integer CHECK (http_status IS NULL OR http_status BETWEEN 100 AND 599),
  request_summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_code text,
  error_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(request_summary_json) = 'object'),
  CHECK (jsonb_typeof(response_summary_json) = 'object'),
  CHECK (error_code IS NULL OR length(btrim(error_code)) <= 100),
  CHECK (error_summary IS NULL OR length(error_summary) <= 500)
);

CREATE INDEX IF NOT EXISTS idx_order_preapproval_invocations_request_created
  ON integration.order_preapproval_invocations(request_id, created_at DESC);

COMMENT ON TABLE integration.order_preapproval_invocations IS
  '订单预审外部调用的脱敏事实，不保存令牌、附件链接、文件内容或完整外部响应。';

CREATE TABLE IF NOT EXISTS integration.order_preapproval_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE REFERENCES integration.order_preapproval_requests(id) ON DELETE RESTRICT,
  owner_user_id uuid REFERENCES iam.users(id) ON DELETE RESTRICT,
  member_user_ids_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  chat_id text,
  status_code text NOT NULL DEFAULT 'pending'
    CHECK (status_code IN ('pending', 'processing', 'created', 'failed', 'manual_confirmation_required', 'stopped')),
  failure_code text,
  failure_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  CHECK (jsonb_typeof(member_user_ids_json) = 'array'),
  CHECK (chat_id IS NULL OR length(btrim(chat_id)) BETWEEN 1 AND 200),
  CHECK (failure_code IS NULL OR length(btrim(failure_code)) <= 100),
  CHECK (failure_summary IS NULL OR length(failure_summary) <= 500),
  UNIQUE (chat_id)
);

CREATE INDEX IF NOT EXISTS idx_order_preapproval_groups_status_created
  ON integration.order_preapproval_groups(status_code, created_at);

COMMENT ON TABLE integration.order_preapproval_groups IS
  '泛微订单预审已受理后创建的唯一企微应用群事实；群失败不影响订单或已受理 OA。';
