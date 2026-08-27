-- S10-008 回退：仅移除本版本新增的交接资格快照列。
-- 已完成的账号停用和业务交接不会被本脚本反向恢复。

ALTER TABLE org.offboarding_handover
  DROP COLUMN IF EXISTS target_region_id,
  DROP COLUMN IF EXISTS target_role_codes;
