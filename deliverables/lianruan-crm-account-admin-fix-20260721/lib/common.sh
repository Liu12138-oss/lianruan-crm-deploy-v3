#!/usr/bin/env bash
# 本文件仅供本升级包内部脚本加载，集中处理校验、备份和安全启停逻辑。

set -u
set -o pipefail

: "${PACKAGE_DIR:?缺少升级包目录}"

PROJECT_DIR="${PROJECT_DIR:-/home/liulonghai/lianruan-crm-deploy-v2.2.0}"
BACKUP_ROOT="${BACKUP_ROOT:-/home/liulonghai/tmp/lianruan-crm-account-admin-fix-backups}"
BACKEND_PORT="${BACKEND_PORT:-3000}"
FRONTEND_PORT="${FRONTEND_PORT:-8080}"

MANIFEST_DIR="$PACKAGE_DIR/manifest"
MANIFEST_FILE="$MANIFEST_DIR/文件清单.tsv"
PAYLOAD_SUM_FILE="$MANIFEST_DIR/SHA256SUMS"
SERVICE_SCRIPT="$PROJECT_DIR/scripts/start.sh"

readonly TARGET_FILES=(
  "backend/server.js"
  "frontend/admin-app.js"
  "frontend/admin.html"
)

log_info() {
  printf '[信息] %s\n' "$*"
}

log_warn() {
  printf '[提醒] %s\n' "$*" >&2
}

log_error() {
  printf '[错误] %s\n' "$*" >&2
}

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    log_error "缺少命令：${command_name}。请安装后重新执行。"
    return 1
  fi
}

file_sha256() {
  sha256sum "$1" | awk '{print $1}'
}

file_mode() {
  stat -c '%a' "$1" 2>/dev/null || stat -f '%Lp' "$1"
}

file_owner_uid() {
  stat -c '%u' "$1" 2>/dev/null || stat -f '%u' "$1"
}

file_group_gid() {
  stat -c '%g' "$1" 2>/dev/null || stat -f '%g' "$1"
}

canonical_dir() {
  (
    cd "$1" 2>/dev/null && pwd -P
  )
}

is_path_in_directory() {
  local path="$1"
  local directory="$2"
  case "$path" in
    "$directory"|"$directory"/*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

manifest_value() {
  local relative_path="$1"
  local column="$2"
  awk -F '\t' -v target="$relative_path" -v column="$column" \
    '$1 == target { print $column; exit }' "$MANIFEST_FILE"
}

validate_package_layout() {
  local relative_path
  local count

  if [ ! -f "$MANIFEST_FILE" ] || [ ! -f "$PAYLOAD_SUM_FILE" ]; then
    log_error "升级包清单文件缺失。"
    return 1
  fi

  count="$(awk -F '\t' 'NF >= 3 && $1 !~ /^#/ { count += 1 } END { print count + 0 }' "$MANIFEST_FILE")"
  if [ "$count" -ne "${#TARGET_FILES[@]}" ]; then
    log_error "升级包文件清单数量异常，已拒绝继续。"
    return 1
  fi

  for relative_path in "${TARGET_FILES[@]}"; do
    if [ ! -f "$PACKAGE_DIR/payload/$relative_path" ]; then
      log_error "升级包缺少文件：payload/${relative_path}"
      return 1
    fi
    if [ -z "$(manifest_value "$relative_path" 2)" ] || [ -z "$(manifest_value "$relative_path" 3)" ]; then
      log_error "升级包清单缺少文件：${relative_path}"
      return 1
    fi
  done

  while IFS=$'\t' read -r relative_path _ _; do
    [ -z "$relative_path" ] && continue
    case "$relative_path" in
      \#*)
        continue
        ;;
    esac
    case "$relative_path" in
      "backend/server.js"|"frontend/admin-app.js"|"frontend/admin.html")
        ;;
      *)
        log_error "升级包包含未授权目标文件：${relative_path}"
        return 1
        ;;
    esac
  done < "$MANIFEST_FILE"

  return 0
}

verify_payload_checksums() {
  if ! (
    cd "$PACKAGE_DIR" && sha256sum -c "manifest/SHA256SUMS" >/dev/null
  ); then
    log_error "升级包文件校验失败，文件可能损坏或被篡改。"
    return 1
  fi
  return 0
}

verify_payload_syntax() {
  if ! node --check "$PACKAGE_DIR/payload/backend/server.js" >/dev/null 2>&1; then
    log_error "升级包中的后端脚本语法校验失败。"
    return 1
  fi
  if ! node --check "$PACKAGE_DIR/payload/frontend/admin-app.js" >/dev/null 2>&1; then
    log_error "升级包中的前端脚本语法校验失败。"
    return 1
  fi
  return 0
}

validate_project_layout() {
  local relative_path

  if [ ! -d "$PROJECT_DIR" ]; then
    log_error "项目目录不存在：${PROJECT_DIR}"
    return 1
  fi
  if [ ! -f "$SERVICE_SCRIPT" ]; then
    log_error "未找到项目启停脚本：${SERVICE_SCRIPT}"
    return 1
  fi
  for relative_path in "${TARGET_FILES[@]}"; do
    if [ ! -f "$PROJECT_DIR/$relative_path" ]; then
      log_error "项目缺少目标文件：${PROJECT_DIR}/${relative_path}"
      return 1
    fi
  done
  for relative_path in "backend/crm.db" "backend/audit.db"; do
    if [ ! -f "$PROJECT_DIR/$relative_path" ]; then
      log_error "项目缺少业务数据库：${PROJECT_DIR}/${relative_path}"
      return 1
    fi
  done
  return 0
}

validate_required_commands() {
  local command_name
  for command_name in node sqlite3 sha256sum curl lsof df du stat awk sed find sort cp mv chmod chown id date sleep grep; do
    if ! require_command "$command_name"; then
      return 1
    fi
  done
  return 0
}

target_state() {
  local relative_path
  local baseline_hash
  local upgraded_hash
  local actual_hash
  local baseline_count=0
  local upgraded_count=0
  local mismatch_count=0

  for relative_path in "${TARGET_FILES[@]}"; do
    baseline_hash="$(manifest_value "$relative_path" 2)"
    upgraded_hash="$(manifest_value "$relative_path" 3)"
    actual_hash="$(file_sha256 "$PROJECT_DIR/$relative_path")" || return 1
    if [ "$actual_hash" = "$baseline_hash" ]; then
      baseline_count=$((baseline_count + 1))
    elif [ "$actual_hash" = "$upgraded_hash" ]; then
      upgraded_count=$((upgraded_count + 1))
    else
      mismatch_count=$((mismatch_count + 1))
    fi
  done

  if [ "$baseline_count" -eq "${#TARGET_FILES[@]}" ]; then
    printf 'baseline\n'
  elif [ "$upgraded_count" -eq "${#TARGET_FILES[@]}" ]; then
    printf 'upgraded\n'
  elif [ "$mismatch_count" -gt 0 ]; then
    printf 'mismatch\n'
  else
    printf 'mixed\n'
  fi
}

show_target_hashes() {
  local relative_path
  local actual_hash
  for relative_path in "${TARGET_FILES[@]}"; do
    actual_hash="$(file_sha256 "$PROJECT_DIR/$relative_path")" || return 1
    printf '  %s：%s\n' "$relative_path" "$actual_hash" >&2
  done
}

assert_target_state() {
  local expected_state="$1"
  local current_state

  current_state="$(target_state)" || {
    log_error "无法计算项目文件校验和。"
    return 1
  }

  if [ "$current_state" = "$expected_state" ]; then
    return 0
  fi

  case "$current_state" in
    upgraded)
      log_error "当前项目已是本补丁版本，拒绝重复覆盖。"
      ;;
    baseline)
      log_error "当前项目仍是升级前版本，不能执行本次代码还原。"
      ;;
    mixed)
      log_error "三个目标文件版本不一致，可能存在未完成升级，已拒绝覆盖。"
      ;;
    *)
      log_error "项目文件校验和与本补丁基线均不一致，可能已存在其他变更，已拒绝覆盖。"
      ;;
  esac
  show_target_hashes || true
  return 1
}

validate_target_syntax() {
  if ! node --check "$PROJECT_DIR/backend/server.js" >/dev/null 2>&1; then
    log_error "当前后端脚本语法校验失败。"
    return 1
  fi
  if ! node --check "$PROJECT_DIR/frontend/admin-app.js" >/dev/null 2>&1; then
    log_error "当前前端脚本语法校验失败。"
    return 1
  fi
  return 0
}

validate_target_metadata_permissions() {
  local relative_path
  local owner_uid
  local current_uid

  current_uid="$(id -u)"
  for relative_path in "${TARGET_FILES[@]}"; do
    owner_uid="$(file_owner_uid "$PROJECT_DIR/$relative_path")" || {
      log_error "无法读取文件属主：${PROJECT_DIR}/${relative_path}"
      return 1
    }
    if [ "$current_uid" != "0" ] && [ "$owner_uid" != "$current_uid" ]; then
      log_error "当前用户不是目标文件属主，无法安全保持权限：${PROJECT_DIR}/${relative_path}"
      return 1
    fi
    if [ "$current_uid" != "0" ]; then
      local group_gid
      group_gid="$(file_group_gid "$PROJECT_DIR/$relative_path")" || return 1
      case " $(id -G) " in
        *" ${group_gid} "*)
          ;;
        *)
          log_error "当前用户不属于目标文件属组，无法安全保持权限：${PROJECT_DIR}/${relative_path}"
          return 1
          ;;
      esac
    fi
  done
  return 0
}

ensure_backup_root_capacity() {
  local source_size_kb
  local required_size_kb
  local available_size_kb

  if ! mkdir -p "$BACKUP_ROOT"; then
    log_error "无法创建备份目录：${BACKUP_ROOT}"
    return 1
  fi

  source_size_kb="$(du -sk \
    "$PROJECT_DIR/backend/crm.db" \
    "$PROJECT_DIR/backend/audit.db" \
    "$PROJECT_DIR/backend/server.js" \
    "$PROJECT_DIR/frontend/admin-app.js" \
    "$PROJECT_DIR/frontend/admin.html" 2>/dev/null | awk '{ total += $1 } END { print total + 0 }')"
  required_size_kb=$((source_size_kb * 3 + 10240))
  available_size_kb="$(df -Pk "$BACKUP_ROOT" | awk 'END { print $4 }')"

  if [ -z "$available_size_kb" ] || [ "$available_size_kb" -lt "$required_size_kb" ]; then
    log_error "备份目录可用空间不足，至少需要 ${required_size_kb}KB：${BACKUP_ROOT}"
    return 1
  fi
  return 0
}

create_backup_directory() {
  local prefix="$1"
  local timestamp
  local attempt=0

  timestamp="$(date '+%Y%m%d_%H%M%S')"
  BACKUP_DIR="$BACKUP_ROOT/${prefix}-${timestamp}"
  while [ -e "$BACKUP_DIR" ]; do
    attempt=$((attempt + 1))
    BACKUP_DIR="$BACKUP_ROOT/${prefix}-${timestamp}-${attempt}"
  done

  if ! mkdir -p "$BACKUP_DIR/files/backend" "$BACKUP_DIR/files/frontend" "$BACKUP_DIR/database" "$BACKUP_DIR/metadata" "$BACKUP_DIR/logs"; then
    log_error "无法创建本次备份目录：${BACKUP_DIR}"
    return 1
  fi
  return 0
}

validate_sqlite_integrity() {
  local database_file="$1"
  local database_name="$2"
  local result

  result="$(sqlite3 "$database_file" 'PRAGMA integrity_check;' 2>&1)" || {
    log_error "无法校验${database_name}完整性：${result}"
    return 1
  }
  if [ "$result" != 'ok' ]; then
    log_error "${database_name}完整性校验失败：${result}"
    return 1
  fi
  return 0
}

create_sqlite_snapshot() {
  local source_database="$1"
  local target_database="$2"
  local database_name="$3"

  if ! validate_sqlite_integrity "$source_database" "$database_name"; then
    return 1
  fi
  if ! sqlite3 "$source_database" <<EOF >"$BACKUP_DIR/logs/${database_name}快照日志.txt" 2>&1
.timeout 15000
.backup '$target_database'
EOF
  then
    log_error "${database_name}一致性快照创建失败。"
    return 1
  fi
  if ! validate_sqlite_integrity "$target_database" "${database_name}快照"; then
    return 1
  fi
  return 0
}

backup_databases() {
  if ! create_sqlite_snapshot "$PROJECT_DIR/backend/crm.db" "$BACKUP_DIR/database/crm.db" '主业务库'; then
    return 1
  fi
  if ! create_sqlite_snapshot "$PROJECT_DIR/backend/audit.db" "$BACKUP_DIR/database/audit.db" '审计库'; then
    return 1
  fi
  return 0
}

backup_target_files() {
  local relative_path
  local source_file
  local target_file

  for relative_path in "${TARGET_FILES[@]}"; do
    source_file="$PROJECT_DIR/$relative_path"
    target_file="$BACKUP_DIR/files/$relative_path"
    if ! cp -p "$source_file" "$target_file"; then
      log_error "无法备份文件：${source_file}"
      return 1
    fi
  done
  return 0
}

write_backup_metadata() {
  local backup_purpose="$1"
  local relative_path
  local source_file

  {
    printf '备份用途\t%s\n' "$backup_purpose"
    printf '创建时间\t%s\n' "$(date '+%Y-%m-%d %H:%M:%S %z')"
    printf '项目目录\t%s\n' "$PROJECT_DIR"
    printf '备份目录\t%s\n' "$BACKUP_DIR"
    printf '后端端口\t%s\n' "$BACKEND_PORT"
    printf '前端端口\t%s\n' "$FRONTEND_PORT"
    printf '数据库处理\t仅创建一致性快照，不执行数据库恢复\n'
  } > "$BACKUP_DIR/metadata/备份信息.tsv"

  : > "$BACKUP_DIR/metadata/文件属性.tsv"
  for relative_path in "${TARGET_FILES[@]}"; do
    source_file="$PROJECT_DIR/$relative_path"
    printf '%s\t%s\t%s\t%s:%s\n' \
      "$relative_path" \
      "$(file_sha256 "$source_file")" \
      "$(file_mode "$source_file")" \
      "$(file_owner_uid "$source_file")" \
      "$(file_group_gid "$source_file")" >> "$BACKUP_DIR/metadata/文件属性.tsv"
  done

  if ! (
    cd "$BACKUP_DIR" && sha256sum \
      'files/backend/server.js' \
      'files/frontend/admin-app.js' \
      'files/frontend/admin.html' \
      'database/crm.db' \
      'database/audit.db'
  ) > "$BACKUP_DIR/metadata/备份文件校验和.txt"; then
    log_error "无法生成备份文件校验清单。"
    return 1
  fi

  return 0
}

verify_backup_integrity() {
  local backup_directory="$1"
  local relative_path

  if [ ! -d "$backup_directory" ] || [ ! -f "$backup_directory/metadata/备份文件校验和.txt" ]; then
    log_error "备份目录或校验清单不存在：${backup_directory}"
    return 1
  fi
  for relative_path in "${TARGET_FILES[@]}"; do
    if [ ! -f "$backup_directory/files/$relative_path" ]; then
      log_error "备份缺少代码文件：${relative_path}"
      return 1
    fi
  done
  if [ ! -f "$backup_directory/database/crm.db" ] || [ ! -f "$backup_directory/database/audit.db" ]; then
    log_error "备份缺少数据库一致性快照。"
    return 1
  fi
  if ! (
    cd "$backup_directory" && sha256sum -c 'metadata/备份文件校验和.txt' >/dev/null
  ); then
    log_error "备份文件校验失败，已拒绝使用该备份。"
    return 1
  fi
  return 0
}

verify_backup_baseline_hashes() {
  local backup_directory="$1"
  local relative_path
  local expected_hash
  local actual_hash

  for relative_path in "${TARGET_FILES[@]}"; do
    expected_hash="$(manifest_value "$relative_path" 2)"
    actual_hash="$(file_sha256 "$backup_directory/files/$relative_path")" || return 1
    if [ "$actual_hash" != "$expected_hash" ]; then
      log_error "备份中的${relative_path}不是本次升级前基线，已拒绝还原。"
      return 1
    fi
  done
  return 0
}

verify_backup_upgraded_hashes() {
  local backup_directory="$1"
  local relative_path
  local expected_hash
  local actual_hash

  for relative_path in "${TARGET_FILES[@]}"; do
    expected_hash="$(manifest_value "$relative_path" 3)"
    actual_hash="$(file_sha256 "$backup_directory/files/$relative_path")" || return 1
    if [ "$actual_hash" != "$expected_hash" ]; then
      log_error "备份中的${relative_path}不是本补丁版本，已拒绝用于自动恢复。"
      return 1
    fi
  done
  return 0
}

copy_file_atomically() {
  local source_file="$1"
  local target_file="$2"
  local target_directory
  local temporary_file
  local mode
  local owner_uid
  local group_gid
  local current_uid

  target_directory="$(dirname "$target_file")"
  mode="$(file_mode "$target_file")" || return 1
  owner_uid="$(file_owner_uid "$target_file")" || return 1
  group_gid="$(file_group_gid "$target_file")" || return 1
  current_uid="$(id -u)"
  temporary_file="$target_directory/.$(basename "$target_file").account-admin-fix-$$-${RANDOM}.tmp"

  if ! cp "$source_file" "$temporary_file"; then
    log_error "无法写入临时文件：${target_file}"
    return 1
  fi
  if ! chmod "$mode" "$temporary_file"; then
    rm -f "$temporary_file"
    log_error "无法保持文件权限：${target_file}"
    return 1
  fi
  if [ "$current_uid" = '0' ]; then
    if ! chown "${owner_uid}:${group_gid}" "$temporary_file"; then
      rm -f "$temporary_file"
      log_error "无法保持文件属主：${target_file}"
      return 1
    fi
  else
    if [ "$(file_owner_uid "$temporary_file")" != "$owner_uid" ]; then
      rm -f "$temporary_file"
      log_error "无法保持文件属主：${target_file}"
      return 1
    fi
    if [ "$(file_group_gid "$temporary_file")" != "$group_gid" ]; then
      if ! chgrp "$group_gid" "$temporary_file"; then
        rm -f "$temporary_file"
        log_error "无法保持文件属组：${target_file}"
        return 1
      fi
    fi
  fi
  if ! mv -f "$temporary_file" "$target_file"; then
    rm -f "$temporary_file"
    log_error "无法原子替换文件：${target_file}"
    return 1
  fi
  return 0
}

replace_target_files() {
  local source_root="$1"
  local relative_path

  for relative_path in "${TARGET_FILES[@]}"; do
    if ! copy_file_atomically "$source_root/$relative_path" "$PROJECT_DIR/$relative_path"; then
      return 1
    fi
  done
  return 0
}

verify_target_hashes_against_payload() {
  local relative_path
  local expected_hash
  local actual_hash

  for relative_path in "${TARGET_FILES[@]}"; do
    expected_hash="$(manifest_value "$relative_path" 3)"
    actual_hash="$(file_sha256 "$PROJECT_DIR/$relative_path")" || return 1
    if [ "$actual_hash" != "$expected_hash" ]; then
      log_error "替换后的文件校验失败：${relative_path}"
      return 1
    fi
  done
  return 0
}

listener_pids() {
  lsof -nP -t -iTCP:"$1" -sTCP:LISTEN 2>/dev/null | sort -u || true
}

process_cwd() {
  lsof -a -p "$1" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -n 1
}

assert_pid_file_safe() {
  local pid_file="$1"
  local expected_directory="$2"
  local process_id
  local process_directory
  local expected_physical_directory

  [ -f "$pid_file" ] || return 0
  process_id="$(< "$pid_file")"
  process_id="${process_id//[$'\t\r\n ']/}"
  if [[ ! "$process_id" =~ ^[0-9]+$ ]]; then
    log_error "进程编号文件内容异常，已拒绝调用启停脚本：${pid_file}"
    return 1
  fi
  if ! kill -0 "$process_id" 2>/dev/null; then
    return 0
  fi

  process_directory="$(process_cwd "$process_id")"
  expected_physical_directory="$(canonical_dir "$expected_directory")" || return 1
  if [ -z "$process_directory" ] || ! is_path_in_directory "$(canonical_dir "$process_directory")" "$expected_physical_directory"; then
    log_error "进程编号文件指向的进程不属于本项目，已拒绝调用启停脚本：${pid_file}"
    return 1
  fi
  return 0
}

assert_listener_safe() {
  local service_name="$1"
  local port="$2"
  local expected_directory="$3"
  local allow_absent="$4"
  local process_id
  local process_directory
  local expected_physical_directory
  local pids

  pids="$(listener_pids "$port")"
  if [ -z "$pids" ]; then
    if [ "$allow_absent" = 'yes' ]; then
      return 0
    fi
    log_error "${service_name}未监听预期端口 ${port}，已拒绝在未知状态下升级。"
    return 1
  fi

  expected_physical_directory="$(canonical_dir "$expected_directory")" || {
    log_error "无法解析${service_name}目录：${expected_directory}"
    return 1
  }
  while IFS= read -r process_id; do
    [ -n "$process_id" ] || continue
    process_directory="$(process_cwd "$process_id")"
    if [ -z "$process_directory" ] || ! is_path_in_directory "$(canonical_dir "$process_directory")" "$expected_physical_directory"; then
      log_error "端口 ${port} 的进程 ${process_id} 不属于本项目，已拒绝停止服务。"
      return 1
    fi
  done <<< "$pids"
  return 0
}

assert_service_ownership() {
  local allow_absent="$1"

  if ! assert_pid_file_safe "$PROJECT_DIR/scripts/backend.pid" "$PROJECT_DIR/backend"; then
    return 1
  fi
  if ! assert_pid_file_safe "$PROJECT_DIR/scripts/frontend.pid" "$PROJECT_DIR/frontend"; then
    return 1
  fi
  if ! assert_listener_safe '后端服务' "$BACKEND_PORT" "$PROJECT_DIR/backend" "$allow_absent"; then
    return 1
  fi
  if ! assert_listener_safe '前端服务' "$FRONTEND_PORT" "$PROJECT_DIR/frontend" "$allow_absent"; then
    return 1
  fi
  return 0
}

ports_are_free() {
  local port
  local pids
  for port in "$BACKEND_PORT" "$FRONTEND_PORT"; do
    pids="$(listener_pids "$port")"
    if [ -n "$pids" ]; then
      log_error "端口 ${port} 仍被进程占用：${pids}"
      return 1
    fi
  done
  return 0
}

wait_for_ports_free() {
  local attempt
  for attempt in $(seq 1 20); do
    if ports_are_free >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  ports_are_free
}

stop_project_services() {
  local output_file="$1"
  local exit_code=0

  BACKEND_PORT="$BACKEND_PORT" FRONTEND_PORT="$FRONTEND_PORT" BACKUP_ROOT="$BACKUP_ROOT" \
    /bin/bash "$SERVICE_SCRIPT" stop > "$output_file" 2>&1 || exit_code=$?

  if ! wait_for_ports_free; then
    log_error "启停脚本执行后服务仍未完全停止，请检查：${output_file}"
    return 1
  fi
  if [ "$exit_code" -ne 0 ]; then
    log_warn "停服脚本返回非零，但端口已确认释放，按实际停服结果继续。"
  fi
  return 0
}

backend_healthy() {
  curl --connect-timeout 2 --max-time 5 -fsS -o /dev/null \
    "http://127.0.0.1:${BACKEND_PORT}/api/meta/prefecture-cities" >/dev/null 2>&1 \
    && curl --connect-timeout 2 --max-time 5 -fsS -o /dev/null \
      "http://127.0.0.1:${BACKEND_PORT}/api/users" >/dev/null 2>&1
}

frontend_healthy() {
  local page_content
  page_content="$(curl --connect-timeout 2 --max-time 5 -fsS "http://127.0.0.1:${FRONTEND_PORT}/admin.html" 2>/dev/null)" || return 1
  printf '%s' "$page_content" | grep -Fq 'admin-app.js?v='
}

wait_for_health() {
  local attempt
  for attempt in $(seq 1 30); do
    if backend_healthy && frontend_healthy; then
      return 0
    fi
    sleep 1
  done
  return 1
}

start_project_services() {
  local output_file="$1"
  local exit_code=0

  if ! ports_are_free; then
    return 1
  fi
  BACKEND_PORT="$BACKEND_PORT" FRONTEND_PORT="$FRONTEND_PORT" BACKUP_ROOT="$BACKUP_ROOT" \
    /bin/bash "$SERVICE_SCRIPT" start > "$output_file" 2>&1 || exit_code=$?

  if ! wait_for_health; then
    log_error "服务启动后健康检查失败，请检查：${output_file}"
    return 1
  fi
  if [ "$exit_code" -ne 0 ]; then
    log_warn "启动脚本返回非零，但服务健康检查通过，按实际启动结果继续。"
  fi
  return 0
}

validate_post_replace_syntax() {
  if ! node --check "$PROJECT_DIR/backend/server.js" >/dev/null 2>&1; then
    log_error "替换后的后端脚本语法校验失败。"
    return 1
  fi
  if ! node --check "$PROJECT_DIR/frontend/admin-app.js" >/dev/null 2>&1; then
    log_error "替换后的前端脚本语法校验失败。"
    return 1
  fi
  return 0
}
