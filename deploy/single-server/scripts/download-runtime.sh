#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "${script_dir}/../../.." && pwd)"
runtime_dir="${project_root}/deploy/single-server/runtime"

docker_version="${V3_DOCKER_VERSION:-27.5.1}"
compose_version="${V3_COMPOSE_VERSION:-v2.32.4}"
docker_source_file="docker-${docker_version}.tgz"
compose_file="docker-compose-linux-x86_64-${compose_version}"

docker_url="${V3_DOCKER_URL:-https://download.docker.com/linux/static/stable/x86_64/${docker_source_file}}"
compose_url="${V3_COMPOSE_URL:-https://github.com/docker/compose/releases/download/${compose_version}/docker-compose-linux-x86_64}"

mkdir -p "${runtime_dir}/compose"
download_work_dir="$(mktemp -d)"
trap 'rm -rf "${download_work_dir}"' EXIT
docker_source_path="${download_work_dir}/${docker_source_file}"

echo "开始下载阶段9离线运行时。"
echo "Docker版本：${docker_version}"
echo "Compose版本：${compose_version}"

if ! command -v python3 >/dev/null 2>&1; then
  echo "缺少python3命令，无法生成Docker免解压目录。" >&2
  exit 1
fi

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
  DOCKER_FILE="${file_path}" python3 - <<'PY'
import os
import tarfile

file_path = os.environ["DOCKER_FILE"]
try:
    with tarfile.open(file_path, "r:gz") as archive:
        names = archive.getnames()
except Exception:
    raise SystemExit(1)

raise SystemExit(0 if any(name.startswith("docker/") for name in names) else 1)
PY
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

echo "下载Docker运行时临时源文件，用于生成免解压目录。"
下载文件 "${docker_url}" "${docker_source_path}" "Docker运行时"
校验Docker包 "${docker_source_path}" || {
  echo "Docker运行时下载后校验失败：${docker_source_path}" >&2
  exit 1
}

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

chmod 755 "${runtime_dir}/compose/${compose_file}"

docker_bin_dir="${runtime_dir}/docker-bin/docker"
docker_binaries=(containerd containerd-shim-runc-v2 ctr docker dockerd docker-init docker-proxy runc)

echo "生成Docker免解压目录：${docker_bin_dir}"
rm -rf "${runtime_dir}/docker-bin"
mkdir -p "${runtime_dir}/docker-bin"
DOCKER_FILE="${docker_source_path}" DOCKER_BIN_ROOT="${runtime_dir}/docker-bin" python3 - <<'PY'
import os
import pathlib
import tarfile

archive_path = pathlib.Path(os.environ["DOCKER_FILE"]).resolve()
target_dir = pathlib.Path(os.environ["DOCKER_BIN_ROOT"]).resolve()

with tarfile.open(archive_path, "r:gz") as archive:
    for member in archive.getmembers():
        target_path = (target_dir / member.name).resolve()
        if target_path != target_dir and target_dir not in target_path.parents:
            raise SystemExit(f"压缩包内路径不安全：{member.name}")
    archive.extractall(target_dir)
PY
touch "${docker_bin_dir}/.gitkeep"
for binary_name in "${docker_binaries[@]}"; do
  if [ ! -f "${docker_bin_dir}/${binary_name}" ]; then
    echo "Docker离线包缺少二进制：${binary_name}" >&2
    exit 1
  fi
  chmod 755 "${docker_bin_dir}/${binary_name}"
done

cd "${runtime_dir}"
if [ -d "${runtime_dir}/docker" ]; then
  rm -rf "${runtime_dir}/docker"
fi

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

echo "离线运行时下载完成：${runtime_dir}"
echo "运行时校验文件：${runtime_dir}/sha256sum.txt"
