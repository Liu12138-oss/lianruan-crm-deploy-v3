#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "${script_dir}/../../.." && pwd)"
image_dir="${project_root}/deploy/single-server/images"
version_tag="${V3_IMAGE_TAG:-3.0.0-alpha.1}"
target_platform="${V3_PLATFORM:-linux/amd64}"

mkdir -p "${image_dir}"

echo "拉取阶段7离线包所需官方镜像。"
docker pull --platform "${target_platform}" postgres:16.4-alpine
docker pull --platform "${target_platform}" redis:7.2.5-alpine

echo "导出业务镜像和基础服务镜像。"
docker save -o "${image_dir}/lianruan-crm-v3-api-${version_tag}.tar" "lianruan-crm-v3-api:${version_tag}"
docker save -o "${image_dir}/lianruan-crm-v3-worker-${version_tag}.tar" "lianruan-crm-v3-worker:${version_tag}"
docker save -o "${image_dir}/lianruan-crm-v3-nginx-${version_tag}.tar" "lianruan-crm-v3-nginx:${version_tag}"
docker save -o "${image_dir}/postgres-16.4-alpine.tar" postgres:16.4-alpine
docker save -o "${image_dir}/redis-7.2.5-alpine.tar" redis:7.2.5-alpine

cd "${image_dir}"
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum *.tar > sha256sum.txt
else
  shasum -a 256 *.tar > sha256sum.txt
fi

echo "镜像导出完成：${image_dir}"
echo "校验文件：${image_dir}/sha256sum.txt"
