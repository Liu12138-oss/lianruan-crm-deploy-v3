-- KB016：回填报备保护期，并修复历史“已通过报备创建商机后被错误标记为 converted”的记录。
-- 仅处理存在关联商机的 converted 报备；其他历史状态保持不变。

BEGIN;

WITH 已转商机报备 AS (
  SELECT
    r.id,
    COALESCE(r.approved_at, r.updated_at, r.created_at) AS 审批通过时间,
    CASE
      WHEN COALESCE(r.extra_json->>'protectDays', '') ~ '^[1-9][0-9]{0,3}$'
        THEN LEAST((r.extra_json->>'protectDays')::integer, 3650)
      ELSE 180
    END AS 保护天数
  FROM crm.registrations r
  WHERE r.status_code = 'converted'
    AND EXISTS (
      SELECT 1
      FROM crm.opportunities o
      WHERE o.registration_id = r.id
    )
)
UPDATE crm.registrations r
SET
  status_code = 'approved',
  approved_at = COALESCE(r.approved_at, c.审批通过时间),
  updated_at = now(),
  row_version = r.row_version + 1,
  extra_json = r.extra_json || jsonb_build_object(
    'status', 'approved',
    'protectDays', c.保护天数,
    'expireAt', COALESCE(
      NULLIF(r.extra_json->>'expireAt', ''),
      ((c.审批通过时间::date + c.保护天数)::date)::text
    ),
    'statusRepair', 'KB016'
  )
FROM 已转商机报备 c
WHERE r.id = c.id;

WITH 缺失保护期报备 AS (
  SELECT
    r.id,
    COALESCE(r.approved_at, r.updated_at, r.created_at) AS 审批通过时间,
    CASE
      WHEN COALESCE(r.extra_json->>'protectDays', '') ~ '^[1-9][0-9]{0,3}$'
        THEN LEAST((r.extra_json->>'protectDays')::integer, 3650)
      ELSE 180
    END AS 保护天数
  FROM crm.registrations r
  WHERE r.status_code = 'approved'
    AND COALESCE(r.extra_json->>'expireAt', '') = ''
)
UPDATE crm.registrations r
SET
  updated_at = now(),
  row_version = r.row_version + 1,
  extra_json = r.extra_json || jsonb_build_object(
    'status', 'approved',
    'protectDays', c.保护天数,
    'expireAt', ((c.审批通过时间::date + c.保护天数)::date)::text,
    'protectionBackfilledBy', 'KB016'
  )
FROM 缺失保护期报备 c
WHERE r.id = c.id;

COMMIT;
