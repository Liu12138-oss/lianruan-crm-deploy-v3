-- 阶段9.13：工作量映射维护兼容迁移。
-- 目的：让 V3 后台可同时维护软件功能和硬件产品的交付工作量映射。

ALTER TABLE catalog.workload_mappings
  ADD COLUMN IF NOT EXISTS product_ref_type text,
  ADD COLUMN IF NOT EXISTS product_ref_id uuid,
  ADD COLUMN IF NOT EXISTS delivery_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS extra_json jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE catalog.workload_mappings
  DROP CONSTRAINT IF EXISTS chk_workload_mappings_product_ref_type;

ALTER TABLE catalog.workload_mappings
  ADD CONSTRAINT chk_workload_mappings_product_ref_type
  CHECK (product_ref_type IS NULL OR product_ref_type IN ('feature','hardware'));

UPDATE catalog.workload_mappings m
SET
  product_ref_type = 'feature',
  product_ref_id = feature_id,
  delivery_tags = CASE
    WHEN jsonb_array_length(delivery_tags) > 0 THEN delivery_tags
    WHEN c.classification_code IS NOT NULL THEN jsonb_build_array(c.classification_code)
    WHEN c.classification_name IS NOT NULL THEN jsonb_build_array(c.classification_name)
    ELSE '[]'::jsonb
  END,
  extra_json = COALESCE(m.extra_json, '{}'::jsonb) || jsonb_build_object(
    'itemType', 'feature',
    'featureId', feature_id::text,
    'classificationName', COALESCE(c.classification_name, ''),
    'deliveryTags', CASE
      WHEN jsonb_array_length(delivery_tags) > 0 THEN delivery_tags
      WHEN c.classification_code IS NOT NULL THEN jsonb_build_array(c.classification_code)
      WHEN c.classification_name IS NOT NULL THEN jsonb_build_array(c.classification_name)
      ELSE '[]'::jsonb
    END
  )
FROM catalog.workload_classifications c
WHERE m.classification_id = c.id
  AND m.feature_id IS NOT NULL
  AND (m.product_ref_type IS NULL OR m.product_ref_id IS NULL);

WITH raw_mappings AS (
  SELECT
    source_id,
    raw_json->'data' AS data,
    COALESCE(NULLIF(raw_json->'data'->>'itemType', ''), 'feature') AS item_type,
    raw_json->'data'->>'featureId' AS product_source_id,
    CASE
      WHEN jsonb_typeof(raw_json->'data'->'deliveryTags') = 'array'
        THEN raw_json->'data'->'deliveryTags'
      WHEN NULLIF(raw_json->'data'->>'productType', '') IS NOT NULL
        THEN jsonb_build_array(raw_json->'data'->>'productType')
      ELSE '[]'::jsonb
    END AS delivery_tags
  FROM migration.v2_raw_records
  WHERE entity_name = 'implementationWorkloadMappings'
),
resolved AS (
  SELECT
    r.*,
    f.id AS feature_product_id,
    h.id AS hardware_product_id
  FROM raw_mappings r
  LEFT JOIN catalog.product_features f
    ON f.id = migration.v2_uuid('catalog.product_features', COALESCE(NULLIF(r.product_source_id, ''), r.source_id))
    OR f.v2_source_id = r.product_source_id
    OR f.feature_code = r.product_source_id
  LEFT JOIN catalog.hardware_products h
    ON h.id = migration.v2_uuid('catalog.hardware_products', COALESCE(NULLIF(r.product_source_id, ''), r.source_id))
    OR h.v2_source_id = r.product_source_id
    OR h.hardware_code = r.product_source_id
)
UPDATE catalog.workload_mappings m
SET
  product_ref_type = CASE WHEN r.item_type = 'hardware' THEN 'hardware' ELSE 'feature' END,
  product_ref_id = CASE WHEN r.item_type = 'hardware' THEN r.hardware_product_id ELSE r.feature_product_id END,
  delivery_tags = r.delivery_tags,
  extra_json = COALESCE(m.extra_json, '{}'::jsonb) || r.data || jsonb_build_object(
    'itemType', CASE WHEN r.item_type = 'hardware' THEN 'hardware' ELSE 'feature' END,
    'productRefId', COALESCE(r.hardware_product_id, r.feature_product_id)::text,
    'deliveryTags', r.delivery_tags
  )
FROM resolved r
WHERE m.v2_source_id = r.source_id
  AND (
    (r.item_type = 'hardware' AND r.hardware_product_id IS NOT NULL)
    OR (r.item_type <> 'hardware' AND r.feature_product_id IS NOT NULL)
  );

WITH raw_mappings AS (
  SELECT
    source_id,
    raw_json->'data' AS data,
    raw_json->'data'->>'featureId' AS product_source_id,
    CASE
      WHEN jsonb_typeof(raw_json->'data'->'deliveryTags') = 'array'
        THEN raw_json->'data'->'deliveryTags'
      WHEN NULLIF(raw_json->'data'->>'productType', '') IS NOT NULL
        THEN jsonb_build_array(raw_json->'data'->>'productType')
      ELSE '[]'::jsonb
    END AS delivery_tags,
    CASE WHEN COALESCE(NULLIF(raw_json->'data'->>'active', '')::boolean, true) THEN 'active' ELSE 'disabled' END AS status_code
  FROM migration.v2_raw_records
  WHERE entity_name = 'implementationWorkloadMappings'
    AND COALESCE(NULLIF(raw_json->'data'->>'itemType', ''), 'feature') = 'hardware'
),
resolved AS (
  SELECT r.*, h.id AS hardware_product_id
  FROM raw_mappings r
  JOIN catalog.hardware_products h
    ON h.id = migration.v2_uuid('catalog.hardware_products', COALESCE(NULLIF(r.product_source_id, ''), r.source_id))
    OR h.v2_source_id = r.product_source_id
    OR h.hardware_code = r.product_source_id
)
INSERT INTO catalog.workload_mappings (
  id, v2_source_id, feature_id, classification_id, status_code,
  product_ref_type, product_ref_id, delivery_tags, extra_json
)
SELECT
  migration.v2_uuid('catalog.workload_mappings', source_id),
  source_id,
  NULL,
  NULL,
  status_code,
  'hardware',
  hardware_product_id,
  delivery_tags,
  data || jsonb_build_object(
    'itemType', 'hardware',
    'productRefId', hardware_product_id::text,
    'deliveryTags', delivery_tags
  )
FROM resolved
ON CONFLICT (v2_source_id) DO UPDATE
SET
  status_code = EXCLUDED.status_code,
  product_ref_type = EXCLUDED.product_ref_type,
  product_ref_id = EXCLUDED.product_ref_id,
  delivery_tags = EXCLUDED.delivery_tags,
  extra_json = EXCLUDED.extra_json;

DELETE FROM migration.migration_errors e
WHERE e.error_code = 'S8_4_WORKLOAD_FEATURE_MISSING'
  AND EXISTS (
    SELECT 1
    FROM catalog.workload_mappings m
    WHERE m.v2_source_id = e.source_id
      AND m.product_ref_type IS NOT NULL
      AND m.product_ref_id IS NOT NULL
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_workload_mappings_ref_classification
  ON catalog.workload_mappings(product_ref_type, product_ref_id, classification_id)
  WHERE product_ref_type IS NOT NULL AND product_ref_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workload_mappings_ref
  ON catalog.workload_mappings(product_ref_type, product_ref_id);
