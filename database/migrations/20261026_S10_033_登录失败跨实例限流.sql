-- S10.33：账号登录失败限流改为数据库固定窗口，保证多个 API 实例共享同一阈值。
-- 仅保存“来源 IP + 账号”的计数与窗口时间，不保存密码或密码摘要。

BEGIN;

CREATE TABLE IF NOT EXISTS ops.auth_login_attempts (
  attempt_key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  attempt_count integer NOT NULL CHECK (attempt_count > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_updated_at
  ON ops.auth_login_attempts (updated_at);

COMMENT ON TABLE ops.auth_login_attempts IS '账号密码登录失败固定窗口计数，供多 API 实例共享限流阈值。';

COMMIT;
