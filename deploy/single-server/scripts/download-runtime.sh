#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "${script_dir}/../../.." && pwd)"
runtime_dir="${project_root}/deploy/single-server/runtime"

docker_version="${V3_DOCKER_VERSION:-27.5.1}"
compose_version="${V3_COMPOSE_VERSION:-v2.32.4}"
docker_file="docker-${docker_version}.tgz"
compose_file="docker-compose-linux-x86_64-${compose_version}"

docker_url="${V3_DOCKER_URL:-https://download.docker.com/linux/static/stable/x86_64/${docker_file}}"
compose_url="${V3_COMPOSE_URL:-https://github.com/docker/compose/releases/download/${compose_version}/docker-compose-linux-x86_64}"

mkdir -p "${runtime_dir}/docker" "${runtime_dir}/compose"

echo "开始下载阶段7.1离线运行时。"
echo "Docker版本：${docker_version}"
echo "Compose版本：${compose_version}"

下载文件() {
  local url="$1"
  local output_file="$2"
  local name="$3"
  local part_file="${output_file}.part"

  echo "准备下载${name}：${output_file}"
  if [ ! -f "${part_file}" ] && [ -f "${output_file}" ]; then
    echo "检测到既有${name}文件需要重新校验下载，先转为临时文件：${part_file}"
    mv "${output_file}" "${part_file}"
  fi

  curl \
    -L \
    --fail \
    -C - \
    --retry 5 \
    --retry-delay 3 \
    --retry-all-errors \
    --connect-timeout 30 \
    --max-time 3600 \
    --speed-limit 1024 \
    --speed-time 120 \
    -o "${part_file}" \
    "${url}"
  mv "${part_file}" "${output_file}"
}

校验Docker包() {
  local file_path="$1"
  if [ ! -f "${file_path}" ]; then
    return 1
  fi
  tar -tzf "${file_path}" >/dev/null 2>&1
}

校验Compose文件() {
  local file_path="$1"
  local file_size
  if [ ! -f "${file_path}" ]; then
    return 1
  fi
  file_size="$(wc -c < "${file_path}" | tr -d ' ')"
  if [ "${file_size}" -lt 50000000 ]; then
    return 1
  fi
  chmod 755 "${file_path}"
  if "${file_path}" version >/dev/null 2>&1; then
    return 0
  fi
  file "${file_path}" 2>/dev/null | grep -q 'ELF 64-bit'
}

if 校验Docker包 "${runtime_dir}/docker/${docker_file}"; then
  echo "Docker运行时已存在且可读取，跳过下载：${runtime_dir}/docker/${docker_file}"
else
  echo "Docker运行时不存在或文件不完整，将下载或断点续传。"
  下载文件 "${docker_url}" "${runtime_dir}/docker/${docker_file}" "Docker运行时"
  校验Docker包 "${runtime_dir}/docker/${docker_file}" || {
    echo "Docker运行时下载后校验失败：${runtime_dir}/docker/${docker_file}" >&2
    exit 1
  }
fi

if 校验Compose文件 "${runtime_dir}/compose/${compose_file}"; then
  echo "Docker Compose插件已存在且可执行，跳过下载：${runtime_dir}/compose/${compose_file}"
else
  echo "Docker Compose插件不存在或文件不完整，将下载或断点续传。"
  下载文件 "${compose_url}" "${runtime_dir}/compose/${compose_file}" "Docker Compose插件"
  校验Compose文件 "${runtime_dir}/compose/${compose_file}" || {
    echo "Docker Compose插件下载后校验失败：${runtime_dir}/compose/${compose_file}" >&2
    exit 1
  }
fi

chmod 644 "${runtime_dir}/docker/${docker_file}"
chmod 755 "${runtime_dir}/compose/${compose_file}"

cd "${runtime_dir}"
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "docker/${docker_file}" "compose/${compose_file}" > sha256sum.txt
else
  shasum -a 256 "docker/${docker_file}" "compose/${compose_file}" > sha256sum.txt
fi

echo "离线运行时下载完成：${runtime_dir}"
echo "运行时校验文件：${runtime_dir}/sha256sum.txt"
