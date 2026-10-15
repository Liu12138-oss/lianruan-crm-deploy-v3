-- S10-025 区域重复归并与唯一约束
-- 1. 将 V2 导入产生的 IMP-REG-* 同名重复区域归并到唯一启用正式区域。
-- 2. 同步该区域下已存在的渠道商引用，保留完整映射用于审计和回退。
-- 3. 停用重复区域，并约束启用区域名称唯一，避免兼容导入再次制造重复数据。

BEGIN;

CREATE TABLE IF NOT EXISTS migration.region_duplicate_merges (
  duplicate_region_id uuid PRIMARY KEY REFERENCES org.regions(id) ON DELETE RESTRICT,
  canonical_region_id uuid NOT NULL REFERENCES org.regions(id) ON DELETE RESTRICT,
  region_name text NOT NULL,
  duplicate_region_code text NOT NULL,
  canonical_region_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (duplicate_region_id <> canonical_region_id)
);

CREATE TABLE IF NOT EXISTS migration.partner_region_duplicate_repairs (
  partner_id uuid PRIMARY KEY REFERENCES channel.partners(id) ON DELETE RESTRICT,
  previous_region_id uuid NOT NULL REFERENCES org.regions(id) ON DELETE RESTRICT,
  applied_region_id uuid NOT NULL REFERENCES org.regions(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (previous_region_id <> applied_region_id)
);

-- 每个导入重复区域必须且只能匹配一个启用正式区域，否则整体回滚。
DO $$
DECLARE
  bad record;
BEGIN
  FOR bad IN
    SELECT d.id, d.region_name, COUNT(c.id) AS candidate_count
    FROM org.regions d
    LEFT JOIN org.regions c
      ON c.region_name = d.region_name
     AND c.region_level = 'region'
     AND c.status_code = 'active'
     AND c.region_code NOT LIKE 'IMP-REG-%'
     AND c.id <> d.id
    WHERE d.region_code LIKE 'IMP-REG-%'
      AND d.region_level = 'region'
      AND d.status_code = 'active'
    GROUP BY d.id, d.region_name
    HAVING COUNT(c.id) <> 1
  LOOP
    RAISE EXCEPTION 'S10-025_PREFLIGHT_FAILED: 重复区域 % (%) 可匹配正式区域数量为 %，要求恰好为 1。',
      bad.region_name, bad.id, bad.candidate_count;
  END LOOP;
END;
$$;

INSERT INTO migration.region_duplicate_merges (
  duplicate_region_id,
  canonical_region_id,
  region_name,
  duplicate_region_code,
  canonical_region_code
)
SELECT
  duplicate.id,
  canonical.id,
  duplicate.region_name,
  duplicate.region_code,
  canonical.region_code
FROM org.regions duplicate
JOIN org.regions canonical
  ON canonical.region_name = duplicate.region_name
 AND canonical.region_level = 'region'
 AND canonical.status_code = 'active'
 AND canonical.region_code NOT LIKE 'IMP-REG-%'
 AND canonical.id <> duplicate.id
WHERE duplicate.region_code LIKE 'IMP-REG-%'
  AND duplicate.region_level = 'region'
  AND duplicate.status_code = 'active'
ON CONFLICT (duplicate_region_id) DO NOTHING;

-- 当前已确认重复区域只被渠道商引用；出现其他表引用时立即阻断，避免遗漏业务数据。
DO $$
DECLARE
  ref record;
  reference_count bigint;
BEGIN
  FOR ref IN
    SELECT
      namespace.nspname AS schema_name,
      relation.relname AS table_name,
      attribute.attname AS column_name
    FROM pg_constraint constraint_record
    JOIN pg_class relation ON relation.oid = constraint_record.conrelid
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    JOIN pg_attribute attribute
      ON attribute.attrelid = relation.oid
     AND attribute.attnum = constraint_record.conkey[1]
    WHERE constraint_record.contype = 'f'
      AND constraint_record.confrelid = 'org.regions'::regclass
      AND cardinality(constraint_record.conkey) = 1
      AND constraint_record.conrelid NOT IN (
        'channel.partners'::regclass,
        'migration.region_duplicate_merges'::regclass,
        'migration.partner_region_duplicate_repairs'::regclass
      )
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM %I.%I target WHERE target.%I IN (SELECT duplicate_region_id FROM migration.region_duplicate_merges)',
      ref.schema_name,
      ref.table_name,
      ref.column_name
    ) INTO reference_count;
    IF reference_count > 0 THEN
      RAISE EXCEPTION 'S10-025_PREFLIGHT_FAILED: 重复区域仍被 %s.%s.%s 引用 %s 条。',
        ref.schema_name, ref.table_name, ref.column_name, reference_count;
    END IF;
  END LOOP;
END;
$$;

INSERT INTO migration.partner_region_duplicate_repairs (
  partner_id,
  previous_region_id,
  applied_region_id
)
SELECT
  partner.id,
  partner.region_id,
  merge.canonical_region_id
FROM channel.partners partner
JOIN migration.region_duplicate_merges merge ON merge.duplicate_region_id = partner.region_id
ON CONFLICT (partner_id) DO NOTHING;

UPDATE channel.partners partner
SET region_id = merge.canonical_region_id,
    updated_at = now(),
    row_version = partner.row_version + 1
FROM migration.region_duplicate_merges merge
WHERE partner.region_id = merge.duplicate_region_id;

UPDATE org.regions region
SET status_code = 'disabled'
FROM migration.region_duplicate_merges merge
WHERE region.id = merge.duplicate_region_id
  AND region.status_code = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS uq_regions_active_region_name
  ON org.regions(region_name)
  WHERE status_code = 'active'
    AND region_level = 'region';

COMMIT;
