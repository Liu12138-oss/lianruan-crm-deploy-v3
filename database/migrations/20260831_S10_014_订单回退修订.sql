-- S10-014：订单回退修订。
-- 旧订单和旧外部流程只保留事实，新订单版本重新走审批链；不要求人工确认旧 OA 已撤回或作废。

ALTER TABLE crm.orders
  ADD COLUMN IF NOT EXISTS replaces_order_id uuid REFERENCES crm.orders(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS superseded_by_order_id uuid REFERENCES crm.orders(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS revision_no integer NOT NULL DEFAULT 1;

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'crm.orders'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status_code%'
  LOOP
    EXECUTE format('ALTER TABLE crm.orders DROP CONSTRAINT IF EXISTS %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE crm.orders
  ADD CONSTRAINT ck_orders_status_code_v3_order_approval
  CHECK (
    status_code IN (
      'draft', 'pending_primary_confirm', 'primary_confirmed', 'primary_rejected',
      'pending_superadmin_confirm', 'confirmed', 'rejected', 'cancelled', 'revision_requested', 'replaced',
      'processing', 'shipped', 'completed'
    )
  ),
  ADD CONSTRAINT ck_orders_revision_no_positive CHECK (revision_no > 0),
  ADD CONSTRAINT ck_orders_not_self_replacement CHECK (id <> replaces_order_id AND id <> superseded_by_order_id);

CREATE INDEX IF NOT EXISTS idx_orders_replaces_order_id ON crm.orders(replaces_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_superseded_by_order_id ON crm.orders(superseded_by_order_id);

CREATE TABLE IF NOT EXISTS crm.order_revision_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES crm.orders(id) ON DELETE RESTRICT,
  requested_by_user_id uuid NOT NULL REFERENCES iam.users(id) ON DELETE RESTRICT,
  requested_partner_id uuid REFERENCES channel.partners(id) ON DELETE RESTRICT,
  reason text NOT NULL,
  change_snapshot_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status_code text NOT NULL DEFAULT 'pending'
    CHECK (status_code IN ('pending', 'approved', 'rejected', 'cancelled', 'applied')),
  reviewed_by_user_id uuid REFERENCES iam.users(id) ON DELETE RESTRICT,
  reviewed_at timestamptz,
  review_reason text,
  result_order_id uuid REFERENCES crm.orders(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  CHECK (length(btrim(reason)) BETWEEN 1 AND 500),
  CHECK (jsonb_typeof(change_snapshot_json) = 'object'),
  CHECK (review_reason IS NULL OR length(btrim(review_reason)) <= 500)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_order_revision_requests_pending
  ON crm.order_revision_requests(order_id)
  WHERE status_code = 'pending';
CREATE INDEX IF NOT EXISTS idx_order_revision_requests_status_created
  ON crm.order_revision_requests(status_code, created_at DESC);

COMMENT ON TABLE crm.order_revision_requests IS
  '订单回退修改申请。申请、审批、生成新版本和重新走审批链均保留事实；不删除原订单。';

COMMENT ON COLUMN crm.orders.revision_no IS
  '订单版本号，从 1 开始；修订生成新订单版本，原订单通过 superseded_by_order_id 关联。';
