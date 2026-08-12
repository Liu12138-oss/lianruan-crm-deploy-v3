-- 阶段9.24：保存移动端写入的成功响应，支持网络重试时安全回放结果。

BEGIN;

ALTER TABLE ops.idempotency_keys
  ADD COLUMN IF NOT EXISTS response_json jsonb;

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at
  ON ops.idempotency_keys (expires_at);

COMMIT;
