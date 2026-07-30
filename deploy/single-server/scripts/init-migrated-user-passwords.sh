#!/usr/bin/env bash
set -euo pipefail

install_root="${INSTALL_ROOT:-/opt/lianruan-crm-v3}"
init_password="${INIT_PASSWORD:-LrCRM@2026!}"
target_scope="migrated"
dry_run=false
confirmed=false
skip_backup=false
restart_api=true

usage() {
  cat <<'EOF'
用途：
  初始化V3迁移用户登录密码，并同步更新PostgreSQL正式凭据表和V3登录配置。

默认行为：
  密码：LrCRM@2026!
  范围：仅初始化从V2迁移来的账号，即 iam.users.v2_source_id 不为空的账号。
  生效：更新 /opt/lianruan-crm-v3/config/v3.env 后重启 api-1 和 api-2。

用法：
  INSTALL_ROOT=/opt/lianruan-crm-v3 ./init-migrated-user-passwords.sh --yes

常用参数：
  --dry-run       只预览账号数量，不写入数据库、不改配置、不重启服务。
  --yes           确认执行真实修改。
  --all-users     初始化全部启用账号，包括非V2迁移账号。
  --skip-backup   跳过发布前备份，仅保留 v3.env 单文件备份。
  --no-restart    修改后不重启API，需要手动重启后才生效。
  -h, --help      查看帮助。

自定义密码：
  INIT_PASSWORD='新密码' ./init-migrated-user-passwords.sh --yes
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run)
      dry_run=true
      shift
      ;;
    --yes)
      confirmed=true
      shift
      ;;
    --all-users)
      target_scope="all"
      shift
      ;;
    --skip-backup)
      skip_backup=true
      shift
      ;;
    --no-restart)
      restart_api=false
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "未知参数：$1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [ "${dry_run}" = false ] && [ "${confirmed}" = false ]; then
  echo "为避免误操作，真实执行必须增加 --yes。先运行 --dry-run 查看影响范围。" >&2
  exit 1
fi

if [ ! -d "${install_root}/compose" ]; then
  echo "安装目录不存在或缺少compose目录：${install_root}" >&2
  exit 1
fi

compose_dir="${install_root}/compose"
config_file="${install_root}/config/v3.env"

if [ ! -f "${config_file}" ]; then
  echo "缺少V3配置文件：${config_file}" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "服务器缺少docker命令。" >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "服务器缺少python3命令，无法更新登录配置。" >&2
  exit 1
fi

cd "${compose_dir}"

echo "开始检查迁移用户密码初始化范围。"
echo "安装目录：${install_root}"
echo "目标范围：${target_scope}"

target_condition="u.v2_source_id IS NOT NULL"
if [ "${target_scope}" = "all" ]; then
  target_condition="true"
fi

target_count="$(
  docker compose exec -T postgres psql -U lianruan_app -d lianruan_crm_v3 -At <<SQL
SELECT COUNT(*)
FROM iam.users u
WHERE u.status_code = 'active'
  AND ${target_condition};
SQL
)"

existing_delivery_count="$(
  python3 - "${config_file}" <<'PY'
import json
import sys

file_path = sys.argv[1]
count = 0
with open(file_path, "r", encoding="utf-8") as file:
    for line in file:
        if line.startswith("V3_DELIVERY_AUTH_USERS_JSON="):
            try:
                users = json.loads(line.split("=", 1)[1].strip())
                count = len(users) if isinstance(users, list) else 0
            except Exception:
                count = 0
            break
print(count)
PY
)"

echo "PostgreSQL目标账号数：${target_count}"
echo "当前登录配置账号数：${existing_delivery_count}"

if [ "${target_count}" = "0" ]; then
  echo "没有找到需要初始化的启用账号，已退出。"
  exit 0
fi

if [ "${dry_run}" = true ]; then
  echo "演练完成：不会写入数据库，不会修改配置，不会重启API。"
  exit 0
fi

timestamp="$(date '+%Y%m%d-%H%M%S')"
env_backup="${install_root}/config/v3.env.${timestamp}.password-init.bak"

echo "备份当前V3登录配置：${env_backup}"
cp "${config_file}" "${env_backup}"

if [ "${skip_backup}" = false ]; then
  if [ -x "${install_root}/scripts/backup.sh" ]; then
    echo "执行发布前本机备份。"
    INSTALL_ROOT="${install_root}" "${install_root}/scripts/backup.sh" --type password-init-preupdate
  else
    echo "未找到 ${install_root}/scripts/backup.sh，已跳过完整备份，仅保留v3.env备份。" >&2
  fi
else
  echo "已按参数跳过完整备份，仅保留v3.env备份。"
fi

password_hash="$(
  docker compose exec -T api-1 env INIT_PASSWORD="${init_password}" node <<'NODE'
const crypto = require("node:crypto");
const password = process.env.INIT_PASSWORD || "";
if (!password) {
  console.error("初始化密码不能为空。");
  process.exit(1);
}
const n = 16384;
const r = 8;
const p = 1;
const salt = crypto.randomBytes(16);
const key = crypto.scryptSync(password, salt, 64, { N: n, r, p, maxmem: 64 * 1024 * 1024 });
console.log(["scrypt", "v1", String(n), String(r), String(p), salt.toString("base64url"), key.toString("base64url")].join("$"));
NODE
)"

temp_dir="$(mktemp -d)"
trap 'rm -rf "${temp_dir}"' EXIT
db_users_json_file="${temp_dir}/db-users.json"
merged_users_json_file="${temp_dir}/delivery-users.json"

echo "更新PostgreSQL正式凭据表。"
docker compose exec -T postgres psql -U lianruan_app -d lianruan_crm_v3 \
  -v ON_ERROR_STOP=1 \
  -v password_hash="${password_hash}" <<SQL
INSERT INTO iam.password_credentials (
  user_id, password_hash, algorithm, must_change_password, changed_at
)
SELECT
  u.id,
  :'password_hash',
  'scrypt',
  true,
  now()
FROM iam.users u
WHERE u.status_code = 'active'
  AND ${target_condition}
ON CONFLICT (user_id) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    algorithm = 'scrypt',
    must_change_password = true,
    changed_at = now();
SQL

echo "生成V3登录配置账号清单。"
docker compose exec -T postgres psql -U lianruan_app -d lianruan_crm_v3 \
  -v ON_ERROR_STOP=1 \
  -v password_hash="${password_hash}" \
  -At <<SQL > "${db_users_json_file}"
WITH user_role AS (
  SELECT
    u.username::text AS username,
    u.display_name::text AS display_name,
    COALESCE(
      (
        array_agg(r.role_code ORDER BY
          CASE r.role_code
            WHEN 'superadmin' THEN 1
            WHEN 'region_manager' THEN 2
            WHEN 'partner_admin' THEN 3
            ELSE 4
          END
        ) FILTER (WHERE r.role_code IS NOT NULL)
      )[1],
      'staff'
    ) AS role_code
  FROM iam.users u
  LEFT JOIN iam.user_roles ur ON ur.user_id = u.id
  LEFT JOIN iam.roles r ON r.id = ur.role_id
  WHERE u.status_code = 'active'
    AND ${target_condition}
  GROUP BY u.id, u.username, u.display_name
)
SELECT COALESCE(
  jsonb_agg(
    jsonb_build_object(
      'username', username,
      'displayName', display_name,
      'roleName', CASE role_code
        WHEN 'superadmin' THEN '超级管理员'
        WHEN 'region_manager' THEN '区域管理员'
        WHEN 'partner_admin' THEN '渠道管理员'
        ELSE '渠道用户'
      END,
      'passwordHash', :'password_hash',
      'defaultPath', CASE
        WHEN role_code IN ('partner_admin', 'staff') THEN '/partner/dashboard'
        ELSE '/unified'
      END,
      'allowedPaths', CASE
        WHEN role_code IN ('superadmin', 'region_manager') THEN jsonb_build_array('/unified', '/admin', '/partner', '/mobile')
        ELSE jsonb_build_array('/unified', '/partner', '/mobile')
      END
    )
    ORDER BY username
  )::text,
  '[]'
)
FROM user_role;
SQL

python3 - "${config_file}" "${db_users_json_file}" "${merged_users_json_file}" "${password_hash}" <<'PY'
import json
import sys

config_file, db_users_file, output_file, password_hash = sys.argv[1:5]
current_users = []

with open(config_file, "r", encoding="utf-8") as file:
    for line in file:
        if line.startswith("V3_DELIVERY_AUTH_USERS_JSON="):
            try:
                parsed = json.loads(line.split("=", 1)[1].strip())
                if isinstance(parsed, list):
                    current_users.extend(parsed)
            except Exception as error:
                raise SystemExit(f"当前V3_DELIVERY_AUTH_USERS_JSON无法解析：{error}")
            break

with open(db_users_file, "r", encoding="utf-8") as file:
    db_users = json.load(file)
if not isinstance(db_users, list):
    raise SystemExit("数据库账号清单不是数组。")

merged = {}

def normalize_user(user):
    username = str(user.get("username", "")).strip()
    if not username:
        return None
    allowed_paths = user.get("allowedPaths")
    if not isinstance(allowed_paths, list) or not allowed_paths:
        allowed_paths = ["/unified"]
    return {
        "username": username,
        "displayName": str(user.get("displayName") or username),
        "roleName": str(user.get("roleName") or "用户"),
        "passwordHash": password_hash,
        "defaultPath": str(user.get("defaultPath") or "/unified"),
        "allowedPaths": allowed_paths,
    }

for item in current_users:
    if isinstance(item, dict):
        normalized = normalize_user(item)
        if normalized:
            merged[normalized["username"]] = normalized

for item in db_users:
    if isinstance(item, dict):
        normalized = normalize_user(item)
        if normalized:
            merged[normalized["username"]] = normalized

users = [merged[key] for key in sorted(merged)]
with open(output_file, "w", encoding="utf-8") as file:
    json.dump(users, file, ensure_ascii=False, separators=(",", ":"))
print(f"合并后登录配置账号数：{len(users)}")
PY

merged_count="$(python3 - "${merged_users_json_file}" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as file:
    print(len(json.load(file)))
PY
)"

echo "写入V3登录配置，账号数：${merged_count}"
python3 - "${config_file}" "${merged_users_json_file}" <<'PY'
import sys

config_file, users_file = sys.argv[1:3]
key = "V3_DELIVERY_AUTH_USERS_JSON"
with open(users_file, "r", encoding="utf-8") as file:
    users_json = file.read().strip().replace("$", "$$")
with open(config_file, "r", encoding="utf-8") as file:
    lines = file.read().splitlines()

replaced = False
next_lines = []
for line in lines:
    if line.startswith(f"{key}="):
        next_lines.append(f"{key}={users_json}")
        replaced = True
    else:
        next_lines.append(line)
if not replaced:
    next_lines.append(f"{key}={users_json}")

with open(config_file, "w", encoding="utf-8") as file:
    file.write("\n".join(next_lines).rstrip() + "\n")
PY

if [ "${restart_api}" = true ]; then
  echo "重启API服务使登录配置生效。"
  docker compose up -d api-1 api-2
else
  echo "已按参数跳过API重启，请手动执行：cd ${compose_dir} && docker compose up -d api-1 api-2"
fi

echo "执行健康检查。"
if [ -x "${install_root}/scripts/health-check.sh" ]; then
  INSTALL_ROOT="${install_root}" "${install_root}/scripts/health-check.sh"
else
  curl -fsS "http://127.0.0.1/health/ready" >/dev/null
fi

echo "迁移用户密码初始化完成。"
echo "初始化账号数：${target_count}"
echo "登录配置账号数：${merged_count}"
echo "默认密码已完成设置，日志不输出明文。"
echo "配置备份文件：${env_backup}"
