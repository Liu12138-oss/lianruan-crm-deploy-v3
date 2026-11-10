-- S10-027：修复历史客户报备已终态但审批单仍残留为待处理的问题。
-- 只同步明确已经完成审核的报备，不影响真实处于待审核状态的审批单。

UPDATE ops.approvals AS a
SET
  status_code = r.status_code,
  updated_at = now(),
  extra_json = a.extra_json || jsonb_build_object(
    'status', r.status_code,
    'reviewedByName', COALESCE(r.extra_json->>'reviewedByName', r.extra_json->>'approvedBy', '历史审批记录'),
    'reviewedAt', COALESCE(r.extra_json->>'reviewedAt', r.approved_at::text, r.updated_at::text),
    'reviewRemark', COALESCE(r.extra_json->>'reviewRemark', '历史报备审批记录同步'),
    'reconcileReason', 'S10-027 报备审批记录同步修复'
  )
FROM crm.registrations AS r
WHERE a.approval_type_code = 'registration'
  AND a.target_type = 'registration'
  AND a.target_id = r.id
  AND a.status_code = 'pending'
  AND r.status_code IN ('approved', 'rejected');

-- 为本次真实回填补一条可追溯的审批事件；已存在修复标记时不会重复写入。
INSERT INTO ops.approval_events (
  approval_id,
  event_code,
  from_status_code,
  to_status_code,
  actor_user_id,
  event_at,
  reason,
  extra_json
)
SELECT
  a.id,
  CASE WHEN a.status_code = 'approved' THEN 'approve' ELSE 'reject' END,
  'pending',
  a.status_code,
  NULL,
  COALESCE(
    NULLIF(a.extra_json->>'reviewedAt', '')::timestamptz,
    COALESCE(r.approved_at, r.updated_at, now())
  ),
  COALESCE(a.extra_json->>'reviewRemark', '历史报备审批记录同步'),
  jsonb_build_object(
    'actorName', COALESCE(a.extra_json->>'reviewedByName', '历史审批记录'),
    'reconcileReason', 'S10-027 报备审批记录同步修复'
  )
FROM ops.approvals AS a
JOIN crm.registrations AS r ON r.id = a.target_id
WHERE a.approval_type_code = 'registration'
  AND a.target_type = 'registration'
  AND a.extra_json->>'reconcileReason' = 'S10-027 报备审批记录同步修复'
  AND NOT EXISTS (
    SELECT 1
    FROM ops.approval_events AS e
    WHERE e.approval_id = a.id
      AND e.extra_json->>'reconcileReason' = 'S10-027 报备审批记录同步修复'
  );
