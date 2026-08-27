-- ============================================================
-- M5-002 统一提醒平台：到期提醒规则
-- 提醒计划生成器在接入前只读此表；本迁移不修改既有 reminder_schedules。
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS message.reminder_rules (
  rule_code text PRIMARY KEY,
  reminder_code text NOT NULL CHECK (reminder_code IN ('crm.registration.expiring', 'crm.opportunity.expected_close')),
  aggregate_type text NOT NULL CHECK (aggregate_type IN ('registration', 'opportunity')),
  rule_name text NOT NULL,
  advance_days integer[] NOT NULL CHECK (
    cardinality(advance_days) BETWEEN 1 AND 10
    AND advance_days <@ ARRAY[1, 3, 7, 14, 30, 60, 90]::integer[]
  ),
  dispatch_time time NOT NULL DEFAULT '09:00:00',
  workday_only boolean NOT NULL DEFAULT true,
  recipient_rule_json jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(recipient_rule_json) = 'object'),
  channel_codes jsonb NOT NULL DEFAULT '["in_app"]'::jsonb CHECK (jsonb_typeof(channel_codes) = 'array'),
  digest_window_minutes integer NOT NULL DEFAULT 0 CHECK (digest_window_minutes IN (0, 15, 60)),
  status_code text NOT NULL DEFAULT 'active' CHECK (status_code IN ('active', 'disabled')),
  rule_protection_code text NOT NULL DEFAULT 'configurable' CHECK (rule_protection_code IN ('mandatory', 'configurable')),
  rule_version integer NOT NULL DEFAULT 1 CHECK (rule_version > 0),
  updated_by_user_id uuid REFERENCES iam.users(id) ON DELETE SET NULL,
  rule_updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reminder_code, aggregate_type),
  CHECK (channel_codes = '["in_app"]'::jsonb)
);

ALTER TABLE message.reminder_schedules
  ADD COLUMN IF NOT EXISTS channel_codes jsonb NOT NULL DEFAULT '["in_app"]'::jsonb
    CHECK (jsonb_typeof(channel_codes) = 'array' AND channel_codes = '["in_app"]'::jsonb);

INSERT INTO message.reminder_rules (
  rule_code, reminder_code, aggregate_type, rule_name, advance_days, dispatch_time,
  workday_only, recipient_rule_json, channel_codes, status_code, rule_protection_code
) VALUES
  ('m3_registration_expiring', 'crm.registration.expiring', 'registration', '客户报备保护期到期',
   ARRAY[30, 7, 1], '09:00:00', true, '{"type":"business_owner"}'::jsonb, '["in_app"]'::jsonb, 'active', 'configurable'),
  ('m3_opportunity_expected_close', 'crm.opportunity.expected_close', 'opportunity', '商机预计成交日到期',
   ARRAY[30, 7, 1], '09:00:00', true, '{"type":"business_owner"}'::jsonb, '["in_app"]'::jsonb, 'active', 'configurable')
ON CONFLICT (rule_code) DO NOTHING;

COMMENT ON TABLE message.reminder_rules IS
  '超管维护的到期提醒受控规则；首期仅支持固定站内渠道与已实现的负责人解析。';

COMMIT;
