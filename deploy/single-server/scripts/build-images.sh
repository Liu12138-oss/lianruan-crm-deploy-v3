#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "${script_dir}/../../.." && pwd)"
version_tag="${V3_IMAGE_TAG:-3.0.0-alpha.1}"
target_platform="${V3_PLATFORM:-linux/amd64}"
build_commit="${V3_BUILD_COMMIT:-$(git -C "${project_root}" rev-parse --short HEAD 2>/dev/null || echo local)}"
build_time="${V3_BUILD_TIME:-$(date -u '+%Y-%m-%dT%H:%M:%SZ')}"

echo "开始构建V3离线部署镜像。"
echo "版本：${version_tag}"
echo "平台：${target_platform}"
echo "提交：${build_commit}"
echo "时间：${build_time}"

cd "${project_root}"

docker build \
  --platform "${target_platform}" \
  --label "org.opencontainers.image.title=联软CRM V3 API" \
  --label "org.opencontainers.image.version=${version_tag}" \
  --label "org.opencontainers.image.revision=${build_commit}" \
  --label "org.opencontainers.image.created=${build_time}" \
  -f deploy/single-server/docker/api.Dockerfile \
  -t "lianruan-crm-v3-api:${version_tag}" \
  .

docker build \
  --platform "${target_platform}" \
  --label "org.opencontainers.image.title=联软CRM V3 Worker" \
  --label "org.opencontainers.image.version=${version_tag}" \
  --label "org.opencontainers.image.revision=${build_commit}" \
  --label "org.opencontainers.image.created=${build_time}" \
  -f deploy/single-server/docker/worker.Dockerfile \
  -t "lianruan-crm-v3-worker:${version_tag}" \
  .

docker build \
  --platform "${target_platform}" \
  --label "org.opencontainers.image.title=联软CRM V3 Nginx" \
  --label "org.opencontainers.image.version=${version_tag}" \
  --label "org.opencontainers.image.revision=${build_commit}" \
  --label "org.opencontainers.image.created=${build_time}" \
  -f deploy/single-server/docker/web.Dockerfile \
  -t "lianruan-crm-v3-nginx:${version_tag}" \
  .

echo "V3业务镜像构建完成。"
