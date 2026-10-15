-- S10-025 回退：仅恢复本次迁移修改且之后未再变更的渠道商区域引用。

BEGIN;

DROP INDEX IF EXISTS org.uq_regions_active_region_name;

UPDATE channel.partners partner
SET region_id = repair.previous_region_id,
    updated_at = now(),
    row_version = partner.row_version + 1
FROM migration.partner_region_duplicate_repairs repair
WHERE partner.id = repair.partner_id
  AND partner.region_id = repair.applied_region_id;

UPDATE org.regions region
SET status_code = 'active'
FROM migration.region_duplicate_merges merge
WHERE region.id = merge.duplicate_region_id
  AND region.status_code = 'disabled';

DROP TABLE IF EXISTS migration.partner_region_duplicate_repairs;
DROP TABLE IF EXISTS migration.region_duplicate_merges;

COMMIT;
