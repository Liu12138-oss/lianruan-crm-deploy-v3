
-- 阶段2迁移草案：客户、报备、商机、报价、订单。

CREATE TABLE IF NOT EXISTS crm.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  normalized_name text NOT NULL,
  credit_code text,
  region_id uuid REFERENCES org.regions(id),
  city_name text,
  owner_user_id uuid REFERENCES iam.users(id),
  owner_partner_id uuid REFERENCES channel.partners(id),
  status_code text NOT NULL DEFAULT 'active' CHECK (status_code IN ('active','disabled','merged')),
  merged_to_customer_id uuid REFERENCES crm.customers(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  extra_json jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_customers_normalized_active ON crm.customers(normalized_name) WHERE status_code <> 'merged';
CREATE INDEX IF NOT EXISTS idx_customers_owner_partner ON crm.customers(owner_partner_id, status_code);

CREATE TABLE IF NOT EXISTS crm.customer_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES crm.customers(id) ON DELETE CASCADE,
  alias_name text NOT NULL,
  normalized_alias text NOT NULL,
  source_code text NOT NULL,
  UNIQUE (normalized_alias, source_code)
);

CREATE TABLE IF NOT EXISTS crm.registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  v2_source_id text UNIQUE,
  registration_no text UNIQUE,
  customer_id uuid NOT NULL REFERENCES crm.customers(id) ON DELETE RESTRICT,
  partner_id uuid REFERENCES channel.partners(id) ON DELETE RESTRICT,
  owner_user_id uuid REFERENCES iam.users(id),
  region_id uuid REFERENCES org.regions(id),
  status_code text NOT NULL CHECK (status_code IN ('draft','pending','approved','rejected','cancelled','converted')),
  submitted_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  extra_json jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_registrations_partner_status ON crm.registrations(partner_id, status_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_registrations_region_status ON crm.registrations(region_id, status_code, created_at DESC);

CREATE TABLE IF NOT EXISTS crm.registration_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES crm.registrations(id) ON DELETE CASCADE,
  event_code text NOT NULL,
  from_status_code text,
  to_status_code text,
  actor_user_id uuid REFERENCES iam.users(id),
  event_at timestamptz NOT NULL DEFAULT now(),
  reason text,
  extra_json jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS crm.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  v2_source_id text UNIQUE,
  opportunity_no text UNIQUE,
  customer_id uuid NOT NULL REFERENCES crm.customers(id) ON DELETE RESTRICT,
  registration_id uuid REFERENCES crm.registrations(id) ON DELETE SET NULL,
  partner_id uuid REFERENCES channel.partners(id) ON DELETE RESTRICT,
  owner_user_id uuid REFERENCES iam.users(id),
  region_id uuid REFERENCES org.regions(id),
  stage_code text NOT NULL,
  raw_stage_name text,
  status_code text NOT NULL DEFAULT 'active' CHECK (status_code IN ('active','won','lost','cancelled')),
  expected_amount numeric(18,2) CHECK (expected_amount IS NULL OR expected_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  extra_json jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_opportunities_partner_stage ON crm.opportunities(partner_id, stage_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_opportunities_region_stage ON crm.opportunities(region_id, stage_code, created_at DESC);

CREATE TABLE IF NOT EXISTS crm.opportunity_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES crm.opportunities(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES iam.users(id),
  followup_at timestamptz NOT NULL DEFAULT now(),
  content text NOT NULL,
  next_action_at timestamptz,
  extra_json jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS crm.opportunity_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES crm.opportunities(id) ON DELETE CASCADE,
  from_stage_code text,
  to_stage_code text NOT NULL,
  raw_stage_name text,
  actor_user_id uuid REFERENCES iam.users(id),
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  v2_source_id text UNIQUE,
  quote_no text UNIQUE,
  opportunity_id uuid REFERENCES crm.opportunities(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES crm.customers(id) ON DELETE RESTRICT,
  partner_id uuid REFERENCES channel.partners(id) ON DELETE RESTRICT,
  owner_user_id uuid REFERENCES iam.users(id),
  status_code text NOT NULL CHECK (status_code IN ('draft','submitted','approved','rejected','converted','cancelled')),
  total_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  discount_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  extra_json jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_quotes_partner_status ON crm.quotes(partner_id, status_code, created_at DESC);

CREATE TABLE IF NOT EXISTS crm.quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES crm.quotes(id) ON DELETE CASCADE,
  product_ref_type text NOT NULL CHECK (product_ref_type IN ('feature','hardware','package','manual')),
  product_ref_id uuid,
  item_name text NOT NULL,
  quantity numeric(18,4) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(18,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  discount_rate numeric(9,4) NOT NULL DEFAULT 1 CHECK (discount_rate >= 0),
  line_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (line_amount >= 0),
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS crm.quote_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES crm.quotes(id) ON DELETE CASCADE,
  snapshot_code text NOT NULL,
  snapshot_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quote_id, snapshot_code)
);

CREATE TABLE IF NOT EXISTS crm.quote_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES crm.quotes(id) ON DELETE CASCADE,
  from_status_code text,
  to_status_code text NOT NULL,
  actor_user_id uuid REFERENCES iam.users(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  reason text
);

CREATE TABLE IF NOT EXISTS crm.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  v2_source_id text UNIQUE,
  order_no text UNIQUE,
  quote_id uuid REFERENCES crm.quotes(id) ON DELETE RESTRICT,
  customer_id uuid REFERENCES crm.customers(id) ON DELETE RESTRICT,
  partner_id uuid REFERENCES channel.partners(id) ON DELETE RESTRICT,
  owner_user_id uuid REFERENCES iam.users(id),
  status_code text NOT NULL CHECK (status_code IN ('draft','pending_primary_confirm','confirmed','rejected','cancelled','completed')),
  total_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  extra_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (quote_id)
);
CREATE INDEX IF NOT EXISTS idx_orders_partner_status ON crm.orders(partner_id, status_code, created_at DESC);

CREATE TABLE IF NOT EXISTS crm.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES crm.orders(id) ON DELETE CASCADE,
  quote_item_id uuid REFERENCES crm.quote_items(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  quantity numeric(18,4) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(18,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  line_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (line_amount >= 0)
);

CREATE TABLE IF NOT EXISTS crm.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES crm.orders(id) ON DELETE CASCADE,
  from_status_code text,
  to_status_code text NOT NULL,
  actor_user_id uuid REFERENCES iam.users(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  reason text
);
