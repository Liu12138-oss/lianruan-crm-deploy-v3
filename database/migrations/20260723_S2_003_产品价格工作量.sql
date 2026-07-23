
-- 阶段2迁移草案：产品、价格、工作量。

CREATE TABLE IF NOT EXISTS catalog.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  v2_source_id text UNIQUE,
  category_code text UNIQUE,
  category_name text NOT NULL,
  product_type_code text NOT NULL CHECK (product_type_code IN ('software','hardware','service','mixed')),
  sort_order integer NOT NULL DEFAULT 0,
  status_code text NOT NULL CHECK (status_code IN ('active','disabled','archived')),
  extra_json jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS catalog.product_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  v2_source_id text UNIQUE,
  category_id uuid NOT NULL REFERENCES catalog.product_categories(id) ON DELETE RESTRICT,
  module_code text UNIQUE,
  module_name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  status_code text NOT NULL CHECK (status_code IN ('active','disabled','archived')),
  extra_json jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS catalog.product_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  v2_source_id text UNIQUE,
  module_id uuid REFERENCES catalog.product_modules(id) ON DELETE RESTRICT,
  feature_code text UNIQUE,
  feature_name text NOT NULL,
  unit_name text,
  list_price numeric(18,2) NOT NULL DEFAULT 0 CHECK (list_price >= 0),
  published boolean NOT NULL DEFAULT false,
  status_code text NOT NULL CHECK (status_code IN ('active','disabled','archived')),
  extra_json jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS catalog.hardware_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  v2_source_id text UNIQUE,
  hardware_code text UNIQUE,
  hardware_name text NOT NULL,
  unit_name text,
  list_price numeric(18,2) NOT NULL DEFAULT 0 CHECK (list_price >= 0),
  published boolean NOT NULL DEFAULT false,
  status_code text NOT NULL CHECK (status_code IN ('active','disabled','archived')),
  extra_json jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS catalog.product_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  v2_source_id text UNIQUE,
  package_code text UNIQUE,
  package_name text NOT NULL,
  list_price numeric(18,2) NOT NULL DEFAULT 0 CHECK (list_price >= 0),
  published boolean NOT NULL DEFAULT false,
  status_code text NOT NULL CHECK (status_code IN ('active','disabled','archived')),
  extra_json jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS catalog.package_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES catalog.product_packages(id) ON DELETE CASCADE,
  product_ref_type text NOT NULL CHECK (product_ref_type IN ('feature','hardware')),
  product_ref_id uuid NOT NULL,
  quantity numeric(18,4) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS catalog.price_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_ref_type text NOT NULL CHECK (product_ref_type IN ('feature','hardware','package')),
  product_ref_id uuid NOT NULL,
  partner_level_code text NOT NULL DEFAULT 'default',
  price_type_code text NOT NULL CHECK (price_type_code IN ('list','discount','fixed')),
  price_value numeric(18,4) NOT NULL CHECK (price_value >= 0),
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);
CREATE INDEX IF NOT EXISTS idx_price_rules_lookup ON catalog.price_rules(product_ref_type, product_ref_id, partner_level_code, effective_from DESC);

CREATE TABLE IF NOT EXISTS catalog.workload_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  v2_source_id text UNIQUE,
  classification_code text UNIQUE,
  classification_name text NOT NULL,
  status_code text NOT NULL DEFAULT 'active' CHECK (status_code IN ('active','disabled'))
);

CREATE TABLE IF NOT EXISTS catalog.workload_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  v2_source_id text UNIQUE,
  feature_id uuid REFERENCES catalog.product_features(id) ON DELETE CASCADE,
  classification_id uuid REFERENCES catalog.workload_classifications(id) ON DELETE RESTRICT,
  status_code text NOT NULL DEFAULT 'active' CHECK (status_code IN ('active','disabled')),
  UNIQUE (feature_id, classification_id)
);

CREATE TABLE IF NOT EXISTS catalog.workload_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  v2_source_id text UNIQUE,
  classification_id uuid REFERENCES catalog.workload_classifications(id) ON DELETE RESTRICT,
  min_quantity numeric(18,4) NOT NULL DEFAULT 0 CHECK (min_quantity >= 0),
  max_quantity numeric(18,4),
  workload_days numeric(18,4) NOT NULL DEFAULT 0 CHECK (workload_days >= 0),
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  CHECK (max_quantity IS NULL OR max_quantity >= min_quantity)
);

CREATE TABLE IF NOT EXISTS catalog.delivery_workload_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  v2_source_id text UNIQUE,
  rule_name text NOT NULL,
  workload_days numeric(18,4) NOT NULL DEFAULT 0 CHECK (workload_days >= 0),
  status_code text NOT NULL DEFAULT 'active' CHECK (status_code IN ('active','disabled')),
  extra_json jsonb NOT NULL DEFAULT '{}'::jsonb
);
