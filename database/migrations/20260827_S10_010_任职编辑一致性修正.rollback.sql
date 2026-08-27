-- S10-010 安全回退：只撤销“一人一条有效任职”新增索引。
-- 保留空岗位一致性修正，避免回退应用后将已有空岗位任职变成不可编辑数据。

DROP INDEX IF EXISTS org.ux_staff_assignments_user_single_active;

DO $$
BEGIN
  RAISE NOTICE 'S10-010 已撤销唯一有效任职索引；空岗位一致性修正继续保留。';
END $$;
