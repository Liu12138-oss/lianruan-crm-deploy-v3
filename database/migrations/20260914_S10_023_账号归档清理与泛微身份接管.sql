-- S10-023：停用账号归档清理与泛微 OA 身份受控接管。
-- 账号主记录和业务历史不删除；归档记录保存被释放的登录名。

CREATE TABLE IF NOT EXISTS iam.account_archives (
  user_id uuid PRIMARY KEY REFERENCES iam.users(id) ON DELETE RESTRICT,
  original_username citext NOT NULL,
  archived_username citext NOT NULL UNIQUE,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 200),
  archived_at timestamptz NOT NULL DEFAULT now(),
  archived_by_user_id uuid NOT NULL REFERENCES iam.users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_account_archives_original_username
  ON iam.account_archives (original_username);

COMMENT ON TABLE iam.account_archives IS
  '已完成交接的停用账号归档事实。保留用户主键和历史引用，仅释放原登录名供新账号使用。';
