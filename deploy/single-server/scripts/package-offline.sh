#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "${script_dir}/../../.." && pwd)"
version_tag="${V3_IMAGE_TAG:-3.0.0-alpha.1}"
package_name="lianruan-crm-v3-offline-${version_tag}"
output_root="${project_root}/tmp/phase7-package"
output_dir="${output_root}/${package_name}"
include_runtime="${V3_INCLUDE_RUNTIME:-1}"

if ! ls "${project_root}/deploy/single-server/images/"*.tar >/dev/null 2>&1; then
  echo "未找到离线镜像tar文件，请先执行 deploy/single-server/scripts/save-images.sh。" >&2
  exit 1
fi

if [[ "${include_runtime}" = "1" ]]; then
  if ! ls "${project_root}/deploy/single-server/runtime/docker/"*.tgz >/dev/null 2>&1; then
    echo "未找到Docker离线运行时文件，请先执行 deploy/single-server/scripts/download-runtime.sh。" >&2
    exit 1
  fi
  if ! ls "${project_root}/deploy/single-server/runtime/compose/docker-compose-linux-"* >/dev/null 2>&1; then
    echo "未找到Docker Compose离线运行时文件，请先执行 deploy/single-server/scripts/download-runtime.sh。" >&2
    exit 1
  fi
  if [ ! -f "${project_root}/deploy/single-server/runtime/sha256sum.txt" ]; then
    echo "未找到运行时校验文件，请先执行 deploy/single-server/scripts/download-runtime.sh。" >&2
    exit 1
  fi
fi

校验运行时资产() {
  local runtime_root="${project_root}/deploy/single-server/runtime"
  local docker_file
  local compose_file
  local compose_size

  if [[ "${include_runtime}" != "1" ]]; then
    return
  fi

  echo "开始校验阶段7.1离线运行时资产。"
  if command -v sha256sum >/dev/null 2>&1; then
    (cd "${runtime_root}" && sha256sum -c sha256sum.txt)
  else
    (cd "${runtime_root}" && shasum -a 256 -c sha256sum.txt)
  fi

  docker_file="$(find "${runtime_root}/docker" -maxdepth 1 -type f -name '*.tgz' | head -n 1)"
  if [ -z "${docker_file}" ]; then
    echo "未找到Docker离线运行时文件。" >&2
    exit 1
  fi
  tar -tzf "${docker_file}" >/dev/null || {
    echo "Docker离线运行时文件无法读取或已损坏：${docker_file}" >&2
    exit 1
  }

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
}

校验运行时资产

rm -rf "${output_dir}"
mkdir -p "${output_dir}"

cp -R "${project_root}/deploy/single-server/compose" "${output_dir}/compose"
cp -R "${project_root}/deploy/single-server/config" "${output_dir}/config"
cp -R "${project_root}/deploy/single-server/images" "${output_dir}/images"
cp -R "${project_root}/deploy/single-server/scripts" "${output_dir}/scripts"
if [[ "${include_runtime}" = "1" ]]; then
  cp -R "${project_root}/deploy/single-server/runtime" "${output_dir}/runtime"
fi
cp -R "${project_root}/deploy/single-server/docs" "${output_dir}/docs" 2>/dev/null || mkdir -p "${output_dir}/docs"
cp "${project_root}/deploy/single-server/README.md" "${output_dir}/README.md"
cp "${project_root}/docs/deployment/V3版本生产部署文档.md" "${output_dir}/docs/V3版本生产部署文档.md"

find "${output_dir}/scripts" -type f -name "*.sh" -exec chmod 750 {} \;

cd "${output_root}"
tar -czf "${package_name}.tar.gz" "${package_name}"

if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "${package_name}.tar.gz" > "${package_name}.tar.gz.sha256"
else
  shasum -a 256 "${package_name}.tar.gz" > "${package_name}.tar.gz.sha256"
fi

echo "离线安装包已生成：${output_root}/${package_name}.tar.gz"
echo "安装包校验文件：${output_root}/${package_name}.tar.gz.sha256"
