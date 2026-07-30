#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "${script_dir}/../../.." && pwd)"
version_tag="${V3_IMAGE_TAG:-3.0.0-stage9.20260727}"
package_name="lianruan-crm-v3-offline-${version_tag}"
output_root="${project_root}/tmp/phase7-package"
output_dir="${output_root}/${package_name}"
include_runtime="${V3_INCLUDE_RUNTIME:-1}"
package_format="${V3_PACKAGE_FORMAT:-zip}"

if ! ls "${project_root}/deploy/single-server/images/"*.tar >/dev/null 2>&1; then
  echo "未找到离线镜像tar文件，请先执行 deploy/single-server/scripts/save-images.sh。" >&2
  exit 1
fi

if [[ "${include_runtime}" = "1" ]]; then
  if [ ! -d "${project_root}/deploy/single-server/runtime/docker-bin/docker" ]; then
    echo "未找到Docker免解压运行时目录，请先执行 deploy/single-server/scripts/download-runtime.sh。" >&2
    exit 1
  fi
  if ! ls "${project_root}/deploy/single-server/runtime/compose/docker-compose-linux-"* >/dev/null 2>&1; then
    echo "未找到Docker Compose离线运行时文件，请先执行 deploy/single-server/scripts/download-runtime.sh。" >&2
    exit 1
  fi
fi

校验运行时资产() {
  local runtime_root="${project_root}/deploy/single-server/runtime"
  local docker_bin_dir="${runtime_root}/docker-bin/docker"
  local binary_name
  local compose_file
  local compose_size
  local docker_binaries=(containerd containerd-shim-runc-v2 ctr docker dockerd docker-init docker-proxy runc)

  if [[ "${include_runtime}" != "1" ]]; then
    return
  fi

  echo "开始校验阶段9离线运行时资产。"

  if [ ! -d "${docker_bin_dir}" ]; then
    echo "未找到Docker免解压运行时目录：${docker_bin_dir}" >&2
    exit 1
  fi

  for binary_name in "${docker_binaries[@]}"; do
    if [ ! -f "${docker_bin_dir}/${binary_name}" ]; then
      echo "Docker免解压目录缺少二进制：${binary_name}" >&2
      exit 1
    fi
    chmod 755 "${docker_bin_dir}/${binary_name}"
  done

  compose_file="$(find "${runtime_root}/compose" -maxdepth 1 -type f -name 'docker-compose-linux-*' | head -n 1)"
  if [ -z "${compose_file}" ]; then
    echo "未找到Docker Compose离线运行时文件。" >&2
    exit 1
  fi

  compose_size="$(wc -c < "${compose_file}" | tr -d ' ')"
  if [ "${compose_size}" -lt 50000000 ]; then
    echo "Docker Compose离线运行时文件体积异常，疑似下载不完整：${compose_file}" >&2
    exit 1
  fi

  if command -v file >/dev/null 2>&1; then
    file "${compose_file}" | grep -q 'ELF 64-bit' || {
      echo "Docker Compose离线运行时文件不是Linux x86_64可执行文件：${compose_file}" >&2
      exit 1
    }
  fi

  (
    cd "${runtime_root}"
    if command -v sha256sum >/dev/null 2>&1; then
      {
        find docker-bin/docker -maxdepth 1 -type f | sort
        find compose -maxdepth 1 -type f | sort
      } | while IFS= read -r file_path; do
        sha256sum "${file_path}"
      done > sha256sum.txt
    else
      {
        find docker-bin/docker -maxdepth 1 -type f | sort
        find compose -maxdepth 1 -type f | sort
      } | while IFS= read -r file_path; do
        shasum -a 256 "${file_path}"
      done > sha256sum.txt
    fi
  )
}

校验运行时资产

rm -rf "${output_dir}"
mkdir -p "${output_dir}"

cp -R "${project_root}/deploy/single-server/compose" "${output_dir}/compose"
cp -R "${project_root}/deploy/single-server/config" "${output_dir}/config"
mkdir -p "${output_dir}/images"
cp "${project_root}/deploy/single-server/images/lianruan-crm-v3-api-${version_tag}.tar" "${output_dir}/images/"
cp "${project_root}/deploy/single-server/images/lianruan-crm-v3-worker-${version_tag}.tar" "${output_dir}/images/"
cp "${project_root}/deploy/single-server/images/lianruan-crm-v3-nginx-${version_tag}.tar" "${output_dir}/images/"
cp "${project_root}/deploy/single-server/images/postgres-16.4-alpine.tar" "${output_dir}/images/"
cp "${project_root}/deploy/single-server/images/redis-7.2.5-alpine.tar" "${output_dir}/images/"
if command -v sha256sum >/dev/null 2>&1; then
  (cd "${output_dir}/images" && sha256sum *.tar > sha256sum.txt)
else
  (cd "${output_dir}/images" && shasum -a 256 *.tar > sha256sum.txt)
fi
cp -R "${project_root}/deploy/single-server/scripts" "${output_dir}/scripts"
mkdir -p "${output_dir}/database"
cp -R "${project_root}/database/migrations" "${output_dir}/database/migrations"
if [ -d "${project_root}/tmp/stage8/v2-postgres-staging-official" ]; then
  mkdir -p "${output_dir}/migration"
  cp -R "${project_root}/tmp/stage8/v2-postgres-staging-official" "${output_dir}/migration/stage8-official"
fi
if [[ "${include_runtime}" = "1" ]]; then
  cp -R "${project_root}/deploy/single-server/runtime" "${output_dir}/runtime"
  rm -rf "${output_dir}/runtime/docker"
fi
cp -R "${project_root}/deploy/single-server/docs" "${output_dir}/docs" 2>/dev/null || mkdir -p "${output_dir}/docs"
cp "${project_root}/deploy/single-server/README.md" "${output_dir}/README.md"
cp "${project_root}/docs/deployment/V3版本生产部署文档.md" "${output_dir}/docs/V3版本生产部署文档.md"

find "${output_dir}/scripts" -type f -name "*.sh" -exec chmod 750 {} \;

cd "${output_root}"

生成校验文件() {
  local package_file="$1"

  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "${package_file}" > "${package_file}.sha256"
  else
    shasum -a 256 "${package_file}" > "${package_file}.sha256"
  fi
}

case "${package_format}" in
  zip)
    if ! command -v zip >/dev/null 2>&1; then
      if ! command -v python3 >/dev/null 2>&1; then
        echo "未找到zip或python3命令，无法生成ZIP离线安装包。" >&2
        exit 1
      fi
      rm -f "${package_name}.zip" "${package_name}.zip.sha256"
      PACKAGE_NAME="${package_name}" PACKAGE_FILE="${package_name}.zip" python3 - <<'PY'
import os
import pathlib
import zipfile

package_name = os.environ["PACKAGE_NAME"]
package_file = pathlib.Path(os.environ["PACKAGE_FILE"])
package_dir = pathlib.Path(package_name)

with zipfile.ZipFile(package_file, "w", compression=zipfile.ZIP_DEFLATED) as zip_file:
    for item in package_dir.rglob("*"):
        if item.is_file():
            zip_file.write(item, item)
PY
    else
      rm -f "${package_name}.zip" "${package_name}.zip.sha256"
      zip -qr -X "${package_name}.zip" "${package_name}"
    fi
    生成校验文件 "${package_name}.zip"
    echo "离线安装包已生成：${output_root}/${package_name}.zip"
    echo "安装包校验文件：${output_root}/${package_name}.zip.sha256"
    ;;
  *)
    echo "不支持的安装包格式：${package_format}，当前只支持zip。" >&2
    exit 1
    ;;
esac
