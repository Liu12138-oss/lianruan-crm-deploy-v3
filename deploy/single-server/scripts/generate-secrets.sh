#!/usr/bin/env bash
set -euo pipefail

install_root="${INSTALL_ROOT:-/opt/lianruan-crm-v3}"
secrets_dir="${install_root}/secrets"

if [ "$(id -u)" -ne 0 ]; then
  echo "请使用root或sudo执行密钥生成脚本。" >&2
  exit 1
fi

mkdir -p "${secrets_dir}"
chmod 700 "${secrets_dir}"

create_secret_file() {
  local file_path="$1"
  local byte_count="$2"
  if [ -f "${file_path}" ]; then
    echo "已存在，跳过：${file_path}"
    return
  fi
  openssl rand -hex "${byte_count}" > "${file_path}"
  chmod 600 "${file_path}"
  echo "已生成：${file_path}"
}

create_secret_file "${secrets_dir}/postgres_password" 24
create_secret_file "${secrets_dir}/redis_password" 24
create_secret_file "${secrets_dir}/session_secret" 48
create_secret_file "${secrets_dir}/backup_encryption_key" 32

echo "密钥生成完成。请勿把 ${secrets_dir} 内容复制到代码仓库或普通日志。"
