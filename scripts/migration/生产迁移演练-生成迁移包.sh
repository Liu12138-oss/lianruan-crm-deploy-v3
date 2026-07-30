#!/usr/bin/env bash
set -Eeuo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
project_root="$(cd "${script_dir}/../.." && pwd)"

source_dir=""
version_label=""
output_root="tmp/stage8"
page_size="500"
assume_yes="false"
force_overwrite="false"

show_help() {
  cat <<'EOF'
用途：
  从 V2 最终源库 crm.db、audit.db 生成 V3 迁移演练包。

最简单用法：
  cd "/Users/liu/Documents/Codex/lianruan-crm-deploy-v3"
  bash scripts/migration/生产迁移演练-生成迁移包.sh

常用参数：
  --source-dir 路径     V2源库目录，里面必须有 crm.db 和 audit.db。
  --version 标识        本次演练版本号，例如 20260730-001。
  --yes                 不再二次确认，适合明确参数后执行。
  --force               允许覆盖同名批次输出目录。
  -h, --help            查看帮助。

输出：
  tmp/stage8/S8-RUN-版本号/
    stage8-official-S8-RUN-版本号.zip
    生产迁移演练-导入核对.sh
    logs/

说明：
  本脚本只读读取 V2 SQLite 源库，不修改 crm.db、audit.db。
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --source-dir)
      source_dir="${2:-}"
      shift 2
      ;;
    --version)
      version_label="${2:-}"
      shift 2
      ;;
    --yes)
      assume_yes="true"
      shift
      ;;
    --force)
      force_overwrite="true"
      shift
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    *)
      echo "未知参数：$1" >&2
      show_help >&2
      exit 1
      ;;
  esac
done

prompt_value() {
  local prompt_text="$1"
  local default_value="$2"
  local input_value=""

  if [ -t 0 ]; then
    read -r -p "${prompt_text} [默认：${default_value}]：" input_value || true
  fi
  if [ -n "${input_value}" ]; then
    printf '%s' "${input_value}"
  else
    printf '%s' "${default_value}"
  fi
}

absolute_path() {
  local input_path="$1"
  if [ -d "${input_path}" ]; then
    (cd "${input_path}" && pwd)
    return
  fi
  case "${input_path}" in
    /*)
      printf '%s\n' "${input_path}"
      ;;
    *)
      printf '%s\n' "${project_root}/${input_path}"
      ;;
  esac
}

sanitize_label() {
  local raw_label="$1"
  local safe_label

  safe_label="$(printf '%s' "${raw_label}" | tr -c 'A-Za-z0-9_.-' '-')"
  safe_label="$(printf '%s' "${safe_label}" | sed -E 's/-+/-/g; s/^-//; s/-$//')"
  if [ -z "${safe_label}" ]; then
    safe_label="$(date +%Y%m%d-%H%M%S)"
  fi
  printf '%s' "${safe_label}"
}

choose_node() {
  if command -v node >/dev/null 2>&1; then
    local major_version
    major_version="$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo "")"
    if [ "${major_version}" = "22" ]; then
      NODE_CMD=(node)
      return
    fi
  fi

  if command -v npx >/dev/null 2>&1; then
    NODE_CMD=(npx -y -p node@22 node)
    return
  fi

  echo "未找到 Node 22，也未找到 npx，无法生成迁移包。" >&2
  exit 1
}

verify_sha_list() {
  local target_dir="$1"
  if [ ! -f "${target_dir}/sha256sum.txt" ]; then
    echo "未找到校验清单：${target_dir}/sha256sum.txt" >&2
    exit 1
  fi
  if command -v sha256sum >/dev/null 2>&1; then
    (cd "${target_dir}" && sha256sum -c sha256sum.txt)
  else
    (cd "${target_dir}" && shasum -a 256 -c sha256sum.txt)
  fi
}

create_zip_package() {
  local package_file="$1"
  local base_dir="$2"
  local staging_name="$3"
  local server_script_name="$4"

  if command -v zip >/dev/null 2>&1; then
    (cd "${base_dir}" && zip -qr -X "${package_file}" "${staging_name}" "${server_script_name}")
    return
  fi

  if command -v python3 >/dev/null 2>&1; then
    PACKAGE_FILE="${package_file}" \
    BASE_DIR="${base_dir}" \
    STAGING_NAME="${staging_name}" \
    SERVER_SCRIPT_NAME="${server_script_name}" \
      python3 - <<'PY'
import os
import pathlib
import zipfile

package_file = pathlib.Path(os.environ["PACKAGE_FILE"])
base_dir = pathlib.Path(os.environ["BASE_DIR"])
names = [os.environ["STAGING_NAME"], os.environ["SERVER_SCRIPT_NAME"]]

with zipfile.ZipFile(package_file, "w", compression=zipfile.ZIP_DEFLATED) as zip_file:
    for name in names:
        path = base_dir / name
        if path.is_file():
            zip_file.write(path, path.relative_to(base_dir))
            continue
        for item in path.rglob("*"):
            if item.is_file():
                zip_file.write(item, item.relative_to(base_dir))
PY
    return
  fi

  echo "未找到 zip 或 python3，无法生成 ZIP 迁移包。" >&2
  exit 1
}

default_source_dir="/Users/liu/Documents/Codex/v2-final-source/backend"
if [ -z "${source_dir}" ]; then
  source_dir="$(prompt_value "请输入 V2 源库目录，目录里要有 crm.db 和 audit.db" "${default_source_dir}")"
fi
source_dir="$(absolute_path "${source_dir}")"

if [ -z "${version_label}" ]; then
  version_label="$(prompt_value "请输入本次演练版本号，只用字母数字点横线下划线，例如 20260730-001" "$(date +%Y%m%d-%H%M%S)")"
fi
version_label="$(sanitize_label "${version_label}")"

if [[ "${version_label}" == S8-RUN-* ]]; then
  batch_code="${version_label}"
else
  batch_code="S8-RUN-${version_label}"
fi

run_dir="${project_root}/${output_root}/${batch_code}"
snapshot_dir="${run_dir}/v2-snapshot"
export_dir="${run_dir}/v2-export"
staging_dir="${run_dir}/v2-postgres-staging"
log_dir="${run_dir}/logs"
log_file="${log_dir}/本地生成迁移包-$(date +%Y%m%d-%H%M%S).log"

if [ -e "${run_dir}" ] && [ "${force_overwrite}" != "true" ]; then
  echo "输出目录已存在，为避免覆盖旧演练记录已停止：${run_dir}" >&2
  echo "请换一个版本号，或确认后增加 --force。" >&2
  exit 1
fi

if [ "${force_overwrite}" = "true" ]; then
  rm -rf "${run_dir}"
fi
mkdir -p "${log_dir}"
exec > >(tee -a "${log_file}") 2>&1

trap 'echo "执行失败：第 ${LINENO} 行。请查看日志：${log_file}" >&2' ERR

echo "生产迁移演练包生成开始。"
echo "项目根目录：${project_root}"
echo "V2源库目录：${source_dir}"
echo "批次编号：${batch_code}"
echo "日志文件：${log_file}"

if [ ! -f "${source_dir}/crm.db" ]; then
  echo "未找到 crm.db：${source_dir}/crm.db" >&2
  exit 1
fi
if [ ! -f "${source_dir}/audit.db" ]; then
  echo "未找到 audit.db：${source_dir}/audit.db" >&2
  exit 1
fi
if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "未找到 sqlite3，无法读取 V2 源库。" >&2
  exit 1
fi
choose_node

echo "Node命令：${NODE_CMD[*]}"
echo "sqlite3版本：$(sqlite3 --version | awk '{print $1}')"
echo "V2源库文件："
ls -lh "${source_dir}/crm.db" "${source_dir}/audit.db"
for extra_file in crm.db-wal crm.db-shm audit.db-wal audit.db-shm; do
  if [ -f "${source_dir}/${extra_file}" ]; then
    ls -lh "${source_dir}/${extra_file}"
  fi
done

if [ "${assume_yes}" != "true" ]; then
  confirm_value="$(prompt_value "确认开始只读导出并生成迁移包吗？输入 YES 继续" "NO")"
  if [ "${confirm_value}" != "YES" ]; then
    echo "用户取消执行。"
    exit 0
  fi
fi

cd "${project_root}"

echo "步骤1：生成 V2 源库实体数量记录。"
"${NODE_CMD[@]}" scripts/migration/生成V2快照实体数量记录.js \
  --crm-db "${source_dir}/crm.db" \
  --audit-db "${source_dir}/audit.db" \
  --output-dir "${snapshot_dir}" \
  --label "生产迁移演练V2最终源库数量记录" \
  --expected-source-dir "${source_dir}" \
  --record-doc "docs/stage-records/生产迁移演练-${batch_code}-V2源库实体数量记录.md"

echo "步骤2：只读导出 V2 迁移批次。"
"${NODE_CMD[@]}" scripts/migration/导出V2只读迁移批次.js \
  --crm-db "${source_dir}/crm.db" \
  --audit-db "${source_dir}/audit.db" \
  --output-dir "${export_dir}" \
  --label "生产迁移演练V2只读导出" \
  --batch-id "${batch_code}" \
  --page-size "${page_size}" \
  --record-doc "docs/stage-records/生产迁移演练-${batch_code}-V2只读导出报告.md"

echo "步骤3：校验 V2 导出文件摘要。"
verify_sha_list "${export_dir}"

echo "步骤4：生成 PostgreSQL 暂存装载包。"
"${NODE_CMD[@]}" scripts/migration/生成PostgreSQL暂存装载包.js \
  --export-manifest "${export_dir}/manifest.json" \
  --output-dir "${staging_dir}" \
  --batch-code "${batch_code}" \
  --record-doc "docs/stage-records/生产迁移演练-${batch_code}-PostgreSQL暂存装载包报告.md" \
  --force

echo "步骤5：校验 PostgreSQL 暂存装载包摘要。"
verify_sha_list "${staging_dir}"

server_script_source="${project_root}/deploy/single-server/scripts/生产迁移演练-导入核对.sh"
server_script_copy="${run_dir}/生产迁移演练-导入核对.sh"
if [ -f "${server_script_source}" ]; then
  cp "${server_script_source}" "${server_script_copy}"
  chmod 750 "${server_script_copy}"
fi

package_file="${run_dir}/stage8-official-${batch_code}.zip"
echo "步骤6：打包上传文件。"
create_zip_package "${package_file}" "${run_dir}" "$(basename "${staging_dir}")" "$(basename "${server_script_copy}")"

if command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "${package_file}" > "${package_file}.sha256"
else
  sha256sum "${package_file}" > "${package_file}.sha256"
fi

instruction_file="${run_dir}/上传到服务器后执行.txt"
{
  echo "本次批次编号：${batch_code}"
  echo "迁移包：${package_file}"
  echo "迁移包校验：${package_file}.sha256"
  echo "服务器执行命令示例："
  echo "sudo bash /tmp/生产迁移演练-导入核对.sh --package /tmp/stage8-official-${batch_code}.zip"
  echo "如果脚本已经放入 /opt/lianruan-crm-v3/scripts，也可以执行："
  echo "sudo /opt/lianruan-crm-v3/scripts/生产迁移演练-导入核对.sh --package /tmp/stage8-official-${batch_code}.zip"
} > "${instruction_file}"

echo "生产迁移演练包生成完成。"
echo "批次编号：${batch_code}"
echo "迁移包：${package_file}"
echo "校验文件：${package_file}.sha256"
echo "服务器脚本：${server_script_copy}"
echo "操作说明：${instruction_file}"
echo "日志文件：${log_file}"
echo
echo "下一步：把下面两个文件上传到 V3 测试服务器 /tmp/ 目录："
echo "1. ${package_file}"
echo "2. ${server_script_copy}"
echo
echo "服务器执行："
echo "sudo bash /tmp/生产迁移演练-导入核对.sh --package /tmp/stage8-official-${batch_code}.zip"
