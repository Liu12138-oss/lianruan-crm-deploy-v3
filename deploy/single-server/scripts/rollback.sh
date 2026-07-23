#!/usr/bin/env bash
set -euo pipefail

install_root="${INSTALL_ROOT:-/opt/lianruan-crm-v3}"
target_version=""
dry_run=false

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run)
      dry_run=true
      shift
      ;;
    --to)
      target_version="${2:-}"
      shift 2
      ;;
    *)
      echo "未知参数：$1" >&2
      exit 1
      ;;
  esac
done

if [ -z "${target_version}" ]; then
  echo "请使用 --to 指定要回退的版本目录，或使用 --dry-run 查看说明。" >&2
  if [ "${dry_run}" = true ]; then
    echo "回退目录约定：${install_root}/releases/版本号/"
    exit 0
  fi
  exit 1
fi

release_dir="${install_root}/releases/${target_version}"
if [ ! -d "${release_dir}" ]; then
  echo "未找到回退版本目录：${release_dir}" >&2
  exit 1
fi

echo "准备回退到版本：${target_version}"
echo "注意：本脚本只回退应用镜像和配置，不自动回滚数据库。"

if [ "${dry_run}" = true ]; then
  echo "演练模式：将检查目录但不替换文件。"
  test -f "${release_dir}/compose/docker-compose.yml"
  test -f "${release_dir}/config/v3.env"
  exit 0
fi

cp "${release_dir}/compose/docker-compose.yml" "${install_root}/compose/docker-compose.yml"
cp "${release_dir}/config/v3.env" "${install_root}/config/v3.env"

cd "${install_root}/compose"
docker compose up -d api-1 api-2 worker nginx

echo "回退命令执行完成，请立即运行健康检查：${install_root}/scripts/health-check.sh"
