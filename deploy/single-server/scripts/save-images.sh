#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "${script_dir}/../../.." && pwd)"
image_dir="${project_root}/deploy/single-server/images"
version_tag="${V3_IMAGE_TAG:-3.0.0-stage9.20260727}"
target_platform="${V3_PLATFORM:-linux/amd64}"
postgres_image="${V3_POSTGRES_IMAGE:-postgres:16.4-alpine}"
redis_image="${V3_REDIS_IMAGE:-redis:7.2.5-alpine}"
postgres_image_source="${V3_POSTGRES_IMAGE_SOURCE:-${postgres_image}}"
redis_image_source="${V3_REDIS_IMAGE_SOURCE:-${redis_image}}"
skip_pull="${V3_SKIP_PULL:-0}"

mkdir -p "${image_dir}"

if [[ "${skip_pull}" = "1" ]]; then
  echo "跳过基础服务镜像拉取，直接使用本地已有镜像。"
else
  echo "拉取阶段9离线包所需基础服务镜像。"
  docker pull --platform "${target_platform}" "${postgres_image_source}"
  docker pull --platform "${target_platform}" "${redis_image_source}"

  if [[ "${postgres_image_source}" != "${postgres_image}" ]]; then
    docker tag "${postgres_image_source}" "${postgres_image}"
  fi

  if [[ "${redis_image_source}" != "${redis_image}" ]]; then
    docker tag "${redis_image_source}" "${redis_image}"
  fi
fi

echo "导出业务镜像和基础服务镜像。"
docker save -o "${image_dir}/lianruan-crm-v3-api-${version_tag}.tar" "lianruan-crm-v3-api:${version_tag}"
docker save -o "${image_dir}/lianruan-crm-v3-worker-${version_tag}.tar" "lianruan-crm-v3-worker:${version_tag}"
docker save -o "${image_dir}/lianruan-crm-v3-nginx-${version_tag}.tar" "lianruan-crm-v3-nginx:${version_tag}"
docker save -o "${image_dir}/postgres-16.4-alpine.tar" "${postgres_image}"
docker save -o "${image_dir}/redis-7.2.5-alpine.tar" "${redis_image}"

cd "${image_dir}"
image_files=(
  "lianruan-crm-v3-api-${version_tag}.tar"
  "lianruan-crm-v3-worker-${version_tag}.tar"
  "lianruan-crm-v3-nginx-${version_tag}.tar"
  "postgres-16.4-alpine.tar"
  "redis-7.2.5-alpine.tar"
)
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "${image_files[@]}" > sha256sum.txt
else
  shasum -a 256 "${image_files[@]}" > sha256sum.txt
fi

echo "镜像导出完成：${image_dir}"
echo "校验文件：${image_dir}/sha256sum.txt"
