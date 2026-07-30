#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "${script_dir}/../../.." && pwd)"
version_tag="${V3_IMAGE_TAG:-3.0.0-stage9.20260727}"
target_platform="${V3_PLATFORM:-linux/amd64}"
node_image="${V3_NODE_IMAGE:-node:22.13.1-bookworm-slim}"
nginx_image="${V3_NGINX_IMAGE:-nginx:1.27-alpine}"
web_fallback_enabled="${V3_WEB_FALLBACK_ENABLED:-1}"
build_commit="${V3_BUILD_COMMIT:-$(git -C "${project_root}" rev-parse --short HEAD 2>/dev/null || echo local)}"
build_time="${V3_BUILD_TIME:-$(date -u '+%Y-%m-%dT%H:%M:%SZ')}"

echo "开始构建V3离线部署镜像。"
echo "版本：${version_tag}"
echo "平台：${target_platform}"
echo "Node基础镜像：${node_image}"
echo "Nginx基础镜像：${nginx_image}"
echo "Web镜像应急构建：${web_fallback_enabled}"
echo "提交：${build_commit}"
echo "时间：${build_time}"

cd "${project_root}"

docker build \
  --platform "${target_platform}" \
  --build-arg "TARGET_PLATFORM=${target_platform}" \
  --build-arg "NODE_IMAGE=${node_image}" \
  --label "org.opencontainers.image.title=联软CRM V3 API" \
  --label "org.opencontainers.image.version=${version_tag}" \
  --label "org.opencontainers.image.revision=${build_commit}" \
  --label "org.opencontainers.image.created=${build_time}" \
  -f deploy/single-server/docker/api.Dockerfile \
  -t "lianruan-crm-v3-api:${version_tag}" \
  .

docker build \
  --platform "${target_platform}" \
  --build-arg "TARGET_PLATFORM=${target_platform}" \
  --build-arg "NODE_IMAGE=${node_image}" \
  --label "org.opencontainers.image.title=联软CRM V3 Worker" \
  --label "org.opencontainers.image.version=${version_tag}" \
  --label "org.opencontainers.image.revision=${build_commit}" \
  --label "org.opencontainers.image.created=${build_time}" \
  -f deploy/single-server/docker/worker.Dockerfile \
  -t "lianruan-crm-v3-worker:${version_tag}" \
  .

if ! docker build \
  --platform "${target_platform}" \
  --build-arg "TARGET_PLATFORM=${target_platform}" \
  --build-arg "NODE_IMAGE=${node_image}" \
  --build-arg "NGINX_IMAGE=${nginx_image}" \
  --label "org.opencontainers.image.title=联软CRM V3 Nginx" \
  --label "org.opencontainers.image.version=${version_tag}" \
  --label "org.opencontainers.image.revision=${build_commit}" \
  --label "org.opencontainers.image.created=${build_time}" \
  -f deploy/single-server/docker/web.Dockerfile \
  -t "lianruan-crm-v3-nginx:${version_tag}" \
  .; then
  if [[ "${web_fallback_enabled}" != "1" ]]; then
    echo "Web镜像标准构建失败，且已关闭应急构建。" >&2
    exit 1
  fi

  echo "Web镜像标准构建失败，开始使用Nginx容器基底应急构建。"
  npm --workspace @lianruan/web run build

  web_container_name="lianruan-crm-v3-web-build-tmp"
  docker rm -f "${web_container_name}" >/dev/null 2>&1 || true
  web_container_id="$(docker create --platform "${target_platform}" --name "${web_container_name}" "${nginx_image}")"
  docker cp deploy/single-server/config/nginx/default.conf "${web_container_id}:/etc/nginx/conf.d/default.conf"
  docker cp apps/web/dist/. "${web_container_id}:/usr/share/nginx/html"
  docker commit \
    --change "EXPOSE 80" \
    --change 'CMD ["nginx", "-g", "daemon off;"]' \
    --change 'LABEL org.opencontainers.image.title="联软CRM V3 Nginx"' \
    --change "LABEL org.opencontainers.image.version=${version_tag}" \
    --change "LABEL org.opencontainers.image.revision=${build_commit}" \
    --change "LABEL org.opencontainers.image.created=${build_time}" \
    "${web_container_id}" "lianruan-crm-v3-nginx:${version_tag}" >/dev/null
  docker rm -f "${web_container_name}" >/dev/null
fi

echo "V3业务镜像构建完成。"
