-- 阶段9.14：V2等价兼容字段补齐。
-- 目的：保留 V2 工作量规则维护页提交的原始字段，保证新增、编辑、删除规则均落入 PostgreSQL 正式表。

ALTER TABLE catalog.workload_rules
  ADD COLUMN IF NOT EXISTS extra_json jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE catalog.workload_rules
SET extra_json = '{}'::jsonb
WHERE extra_json IS NULL;
