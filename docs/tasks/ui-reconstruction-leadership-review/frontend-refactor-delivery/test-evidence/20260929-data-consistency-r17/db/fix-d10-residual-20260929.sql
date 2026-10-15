-- D-10 余量修复：历史「停用渠道成员」未生效导致的账号/成员状态矛盾
-- 处理范围：全部渠道成员关系均已停用或归档，但登录账号仍为 active 的账号（均为业务流程回归产生的账号）
BEGIN;

\echo '--- 修复前 ---'
SELECT u.username, u.status_code AS 账号状态, u.extra_json->>'status' AS 快照状态
  FROM iam.users u
  JOIN channel.partner_members pm ON pm.user_id = u.id
 WHERE u.status_code = 'active'
 GROUP BY u.username, u.status_code, u.extra_json->>'status'
HAVING count(*) FILTER (WHERE pm.status_code='active' AND pm.archived_at IS NULL) = 0
 ORDER BY u.username;

UPDATE iam.users u
   SET status_code = 'disabled',
       extra_json = jsonb_set(u.extra_json, '{status}', to_jsonb('disabled'::text), true),
       updated_at = now(),
       row_version = u.row_version + 1
 WHERE u.status_code = 'active'
   AND EXISTS (
     SELECT 1 FROM channel.partner_members pm
      WHERE pm.user_id = u.id
        AND NOT (pm.status_code='active' AND pm.archived_at IS NULL)
   )
   AND NOT EXISTS (
     SELECT 1 FROM channel.partner_members pm2
      WHERE pm2.user_id = u.id
        AND pm2.status_code='active' AND pm2.archived_at IS NULL
   );

\echo '--- 修复后：账号/成员状态矛盾数量（应为 0） ---'
SELECT count(*) AS 矛盾数 FROM iam.users u
 WHERE u.status_code='active'
   AND EXISTS (SELECT 1 FROM channel.partner_members pm WHERE pm.user_id=u.id)
   AND NOT EXISTS (SELECT 1 FROM channel.partner_members pm WHERE pm.user_id=u.id AND pm.status_code='active' AND pm.archived_at IS NULL);

COMMIT;
