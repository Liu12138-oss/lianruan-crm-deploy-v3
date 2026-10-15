-- S10-027：修复历史遗留的报备审批记录不同步。
-- 背景：R41 之前报备状态流转未同步 ops.approvals，报备已通过或已驳回后，
-- 审批记录仍停留在 pending，审核中心会持续显示幽灵待办。
-- 处理：按报备当前状态回填审批记录，并补一条审批事件留存；
-- 仅处理「审批 pending 且报备已终态」的记录，幂等可重复执行。

WITH 需要修复 AS (
  UPDATE ops.approvals a
  SET
    status_code = r.status_code,
    updated_at = now(),
    extra_json = COALESCE(a.extra_json, '{}'::jsonb)
      || jsonb_build_object('status', r.status_code, 'reconcileReason', 'S10-027 报备审批记录同步修复')
  FROM crm.registrations r
  WHERE a.approval_type_code = 'registration'
    AND a.target_type = 'registration'
    AND a.target_id = r.id
    AND a.status_code = 'pending'
    AND r.status_code IN ('approved', 'rejected')
  RETURNING a.id, r.status_code AS to_status
)
INSERT INTO ops.approval_events (approval_id, event_code, from_status_code, to_status_code, reason)
SELECT
  id,
  CASE WHEN to_status = 'approved' THEN 'approve' ELSE 'reject' END,
  'pending',
  to_status,
  'S10-027 报备审批记录同步修复'
FROM 需要修复;
