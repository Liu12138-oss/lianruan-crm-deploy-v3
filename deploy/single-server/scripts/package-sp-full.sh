#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "${script_dir}/../../.." && pwd)"

失败() {
  echo "SP-FULL 制包失败：$*" >&2
  exit 1
}

target_version="${V3_IMAGE_TAG:-}"
package_id="${V3_PACKAGE_ID:-}"
build_commit="${V3_BUILD_COMMIT:-$(git -C "${project_root}" rev-parse --short HEAD 2>/dev/null || echo local)}"
build_time="${V3_BUILD_TIME:-$(date -u '+%Y-%m-%dT%H:%M:%SZ')}"
output_root="${V3_SP_OUTPUT_ROOT:-${project_root}/tmp/sp-full-package}"
package_suffix="${V3_PACKAGE_SUFFIX:-}"
package_name="lianruan-crm-v3-sp-full-${target_version}${package_suffix}"
package_note="${V3_PACKAGE_NOTE:-}"
output_dir="${output_root}/${package_name}"
image_dir="${project_root}/deploy/single-server/images"
runtime_dir="${project_root}/deploy/single-server/runtime"
sp_app_dir="${project_root}/deploy/single-server/sp-app"

[ -n "${target_version}" ] || 失败 "必须显式设置 V3_IMAGE_TAG，禁止使用陈旧默认版本制包。"
[ -n "${package_id}" ] || 失败 "必须显式设置 V3_PACKAGE_ID。"

验证安全标识() {
  local name="$1" value="$2"
  [[ "${value}" =~ ^[0-9A-Za-z][0-9A-Za-z._+-]{0,127}$ ]] ||
    失败 "${name} 只能包含字母、数字、点、下划线、加号和连字符，且必须以字母或数字开头。"
}

验证安全标识 "V3_IMAGE_TAG" "${target_version}"
验证安全标识 "V3_PACKAGE_ID" "${package_id}"

for command_name in bash unzip zip sha256sum awk sed grep find xargs cp mkdir rm date git docker tar mktemp basename; do
  command -v "${command_name}" >/dev/null 2>&1 || 失败 "未找到命令：${command_name}"
done

[ -z "$(git -C "${project_root}" status --porcelain --untracked-files=all)" ] ||
  失败 "当前工作区存在未收口改动。请先形成可追溯提交基线，再按该提交构建镜像和制作升级包。"

for image_file in \
  "${image_dir}/lianruan-crm-v3-api-${target_version}.docker-image" \
  "${image_dir}/lianruan-crm-v3-worker-${target_version}.docker-image" \
  "${image_dir}/lianruan-crm-v3-nginx-${target_version}.docker-image" \
  "${image_dir}/postgres-16.4-alpine.docker-image" \
  "${image_dir}/redis-7.2.5-alpine.docker-image"; do
  [ -f "${image_file}" ] || 失败 "未找到镜像归档：${image_file}"
done
[ -f "${image_dir}/sha256sum.txt" ] || 失败 "未找到镜像归档校验文件：${image_dir}/sha256sum.txt"
[ -d "${runtime_dir}/docker-bin/docker" ] || 失败 "未找到离线 Docker 运行时目录：${runtime_dir}/docker-bin/docker"
compose_runtime_files=()
while IFS= read -r compose_runtime_file; do
  compose_runtime_files+=("${compose_runtime_file}")
done < <(find "${runtime_dir}/compose" -maxdepth 1 -type f -name 'docker-compose-linux-*' -print)
[ "${#compose_runtime_files[@]}" -eq 1 ] ||
  失败 "离线 Docker Compose 运行时文件必须且只能有一个，当前找到 ${#compose_runtime_files[@]} 个。"
compose_runtime="${compose_runtime_files[0]}"
[ -f "${runtime_dir}/sha256sum.txt" ] || 失败 "未找到离线运行时校验文件：${runtime_dir}/sha256sum.txt"

检查Shell变量名() {
  local shell_file="$1"
  local invalid_lines
  invalid_lines="$(awk '
    {
      text = $0
      sub(/^[[:space:]]*/, "", text)
      equal_at = index(text, "=")
      if (equal_at > 1) {
        name = substr(text, 1, equal_at - 1)
        sub(/\+$/, "", name)
        if (name ~ /[[:space:].\/?*"(){}$]/) next
        if (name !~ /^[A-Za-z_][A-Za-z0-9_]*$/) print NR ":" $0
      }
    }
  ' "${shell_file}")"
  [ -z "${invalid_lines}" ] ||
    失败 "Shell 脚本存在 Bash 运行时不支持的变量名：${shell_file}：${invalid_lines}"
}

for shell_file in \
  "${project_root}/deploy/single-server/scripts/package-sp-full.sh" \
  "${project_root}/deploy/single-server/scripts/migrate-db.sh" \
  "${project_root}/deploy/single-server/scripts/install.sh" \
  "${project_root}/deploy/single-server/scripts/install-runtime.sh" \
  "${project_root}/deploy/single-server/scripts/install-all.sh" \
  "${project_root}/deploy/single-server/scripts/start.sh" \
  "${project_root}/deploy/single-server/scripts/stop.sh" \
  "${project_root}/deploy/single-server/scripts/health-check.sh" \
  "${project_root}/deploy/single-server/scripts/backup.sh" \
  "${project_root}/deploy/single-server/scripts/rollback.sh" \
  "${project_root}/deploy/single-server/scripts/collect-diagnostics.sh" \
  "${project_root}/deploy/single-server/scripts/generate-secrets.sh" \
  "${project_root}/deploy/single-server/scripts/preflight.sh" \
  "${project_root}/deploy/single-server/scripts/load-images.sh" \
  "${project_root}/deploy/single-server/sp-app/scripts/"*.sh \
  "${project_root}/deploy/single-server/sp-app/tests/"*.sh \
  "${project_root}/deploy/single-server/tests/数据库迁移顺序测试.sh"; do
  if [ -f "${shell_file}" ]; then
    检查Shell变量名 "${shell_file}"
    bash -n "${shell_file}"
  fi
done

bash "${project_root}/deploy/single-server/tests/数据库迁移顺序测试.sh"

验证镜像归档与本地镜像一致() {
  local image_name image_file image_tag archive_index archive_config_path archive_image_sha local_image_id
  for image_name in api worker nginx; do
    image_file="${image_dir}/lianruan-crm-v3-${image_name}-${target_version}.docker-image"
    image_tag="lianruan-crm-v3-${image_name}:${target_version}"
    archive_index="$(tar -xOf "${image_file}" index.json 2>/dev/null || true)"
    if [ -n "${archive_index}" ]; then
      archive_image_sha="$(printf '%s' "${archive_index}" | tr -d '\n' | sed -n 's/.*"digest":"sha256:\([0-9a-f]\{64\}\)".*/\1/p')"
    else
      archive_config_path="$(tar -xOf "${image_file}" manifest.json 2>/dev/null | tr -d '\n' | sed -n 's/.*"Config"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
      [ -n "${archive_config_path}" ] || 失败 "镜像归档缺少 OCI 索引或 Docker Config 信息：${image_file}"
      archive_image_sha="${archive_config_path##*/}"
      archive_image_sha="${archive_image_sha%.json}"
    fi
    [ "${#archive_image_sha}" -eq 64 ] || 失败 "镜像归档摘要格式无效：${image_file}"
    case "${archive_image_sha}" in
      *[!0-9a-f]*) 失败 "镜像归档摘要格式无效：${image_file}" ;;
    esac
    local_image_id="$(docker image inspect --format '{{.Id}}' "${image_tag}" 2>/dev/null || true)"
    [ -n "${local_image_id}" ] || 失败 "本地不存在目标镜像：${image_tag}"
    [ "${local_image_id#sha256:}" = "${archive_image_sha}" ] ||
      失败 "镜像归档与本地同标签镜像不一致：${image_tag}"
  done
}

验证Web镜像静态资源() {
  local container_id static_dir workspace_asset source_workspace_asset workspace_candidate
  local source_admin_html source_admin_app source_admin_style
  local dist_admin_html dist_admin_app dist_admin_style
  local -a source_workspace_assets image_workspace_assets
  source_admin_html="${project_root}/apps/web/public/admin.html"
  source_admin_app="${project_root}/apps/web/public/admin-app.js"
  source_admin_style="${project_root}/apps/web/public/style.css"
  dist_admin_html="${project_root}/apps/web/dist/admin.html"
  dist_admin_app="${project_root}/apps/web/dist/admin-app.js"
  dist_admin_style="${project_root}/apps/web/dist/style.css"
  for required_file in \
    "${source_admin_html}" "${source_admin_app}" "${source_admin_style}" \
    "${dist_admin_html}" "${dist_admin_app}" "${dist_admin_style}"; do
    [ -f "${required_file}" ] || 失败 "缺少 Web 源码或构建产物：${required_file}"
  done
  grep -Fq 'admin-app.js?v=156' "${source_admin_html}" &&
    grep -Fq 'admin-app.js?v=156' "${dist_admin_html}" ||
    失败 "正式 admin.html 未使用 admin-app.js?v=156。"
  grep -Fq 'style.css?v=16' "${source_admin_html}" &&
    grep -Fq 'style.css?v=16' "${dist_admin_html}" ||
    失败 "正式 admin.html 未使用 style.css?v=16。"
  [ "$(sha256sum "${source_admin_html}" | awk '{print $1}')" = "$(sha256sum "${dist_admin_html}" | awk '{print $1}')" ] ||
    失败 "Web 源码 admin.html 与构建产物不一致。"
  [ "$(sha256sum "${source_admin_app}" | awk '{print $1}')" = "$(sha256sum "${dist_admin_app}" | awk '{print $1}')" ] ||
    失败 "Web 源码 admin-app.js 与构建产物不一致。"
  [ "$(sha256sum "${source_admin_style}" | awk '{print $1}')" = "$(sha256sum "${dist_admin_style}" | awk '{print $1}')" ] ||
    失败 "Web 源码 style.css 与构建产物不一致。"

  source_workspace_assets=()
  while IFS= read -r workspace_candidate; do
    source_workspace_assets+=("${workspace_candidate}")
  done < <(find "${project_root}/apps/web/dist/assets" -maxdepth 1 -type f -name 'OrganizationWorkspacePage-*.js' -print)
  [ "${#source_workspace_assets[@]}" -eq 1 ] ||
    失败 "本地 Web 构建产物中的组织架构工作区资源必须且只能有一个，当前找到 ${#source_workspace_assets[@]} 个。"
  source_workspace_asset="${source_workspace_assets[0]}"

  static_dir="$(mktemp -d "${output_root}/.sp-full-web.XXXXXX")"
  container_id="$(docker create "lianruan-crm-v3-nginx:${target_version}")" || {
    rm -rf "${static_dir}"
    失败 "无法创建目标 Nginx 镜像临时容器。"
  }
  清理Web镜像检查() {
    docker rm -f "${container_id}" >/dev/null 2>&1 || true
    rm -rf "${static_dir}"
  }
  if ! docker cp "${container_id}:/usr/share/nginx/html/." "${static_dir}/"; then
    清理Web镜像检查
    失败 "无法读取目标 Nginx 镜像中的静态资源。"
  fi
  for required_file in admin.html admin-app.js style.css index.html; do
    if [ ! -f "${static_dir}/${required_file}" ]; then
      清理Web镜像检查
      失败 "目标 Nginx 镜像缺少静态文件：${required_file}"
    fi
  done
  if ! grep -Fq 'admin-app.js?v=156' "${static_dir}/admin.html" ||
    ! grep -Fq 'style.css?v=16' "${static_dir}/admin.html"; then
    清理Web镜像检查
    失败 "目标 admin.html 未同时使用 admin-app.js?v=156 和 style.css?v=16。"
  fi
  if ! grep -Fq '组织架构' "${static_dir}/admin-app.js" ||
    ! grep -Fq "router.push('/organization/units')" "${static_dir}/admin-app.js" ||
    ! grep -Fq "{ path: 'organization/units', component: OrganizationWorkspace }" "${static_dir}/admin-app.js"; then
    清理Web镜像检查
    失败 "目标 admin-app.js 缺少组织架构内嵌入口与路由。"
  fi
  image_workspace_assets=()
  while IFS= read -r workspace_candidate; do
    image_workspace_assets+=("${workspace_candidate}")
  done < <(find "${static_dir}/assets" -maxdepth 1 -type f -name 'OrganizationWorkspacePage-*.js' -print)
  if [ "${#image_workspace_assets[@]}" -ne 1 ]; then
    清理Web镜像检查
    失败 "目标 Nginx 镜像中的组织架构工作区资源必须且只能有一个，当前找到 ${#image_workspace_assets[@]} 个。"
  fi
  workspace_asset="${image_workspace_assets[0]}"
  if ! grep -R -Fq 'workspace/admin/platform-admin/organization' "${static_dir}/assets" ||
    ! grep -Fq '组织架构功能尚未启用' "${workspace_asset}"; then
    清理Web镜像检查
    失败 "目标 Nginx 镜像未包含组织架构工作区构建产物。"
  fi

  web_admin_html_sha256="$(sha256sum "${static_dir}/admin.html" | awk '{print $1}')"
  web_admin_app_sha256="$(sha256sum "${static_dir}/admin-app.js" | awk '{print $1}')"
  web_admin_style_sha256="$(sha256sum "${static_dir}/style.css" | awk '{print $1}')"
  web_workspace_asset_name="$(basename "${workspace_asset}")"
  web_workspace_asset_sha256="$(sha256sum "${workspace_asset}" | awk '{print $1}')"
  if [ "${web_admin_html_sha256}" != "$(sha256sum "${dist_admin_html}" | awk '{print $1}')" ] ||
    [ "${web_admin_app_sha256}" != "$(sha256sum "${dist_admin_app}" | awk '{print $1}')" ] ||
    [ "${web_admin_style_sha256}" != "$(sha256sum "${dist_admin_style}" | awk '{print $1}')" ] ||
    [ "${web_workspace_asset_name}" != "$(basename "${source_workspace_asset}")" ] ||
    [ "${web_workspace_asset_sha256}" != "$(sha256sum "${source_workspace_asset}" | awk '{print $1}')" ]; then
    清理Web镜像检查
    失败 "目标 Nginx 镜像与当前 Web 构建产物不一致。"
  fi
  清理Web镜像检查
}

mkdir -p "${output_root}"
验证镜像归档与本地镜像一致
验证Web镜像静态资源

rm -rf "${output_dir}"
mkdir -p "${output_dir}/compose" \
  "${output_dir}/config/nginx" \
  "${output_dir}/database/migrations" \
  "${output_dir}/images" \
  "${output_dir}/runtime/docker-bin" \
  "${output_dir}/runtime/compose" \
  "${output_dir}/scripts" \
  "${output_dir}/files/compose" \
  "${output_dir}/files/config/nginx" \
  "${output_dir}/files/scripts" \
  "${output_dir}/tests" \
  "${output_dir}/manifest" \
  "${output_dir}/docs"

cp "${project_root}/deploy/single-server/compose/docker-compose.yml" "${output_dir}/compose/"
cp "${project_root}/deploy/single-server/config/deploy.env.example" "${output_dir}/config/"
cp "${project_root}/deploy/single-server/config/v3.env.template" "${output_dir}/config/"
cp "${project_root}/deploy/single-server/config/nginx/default.conf" "${output_dir}/config/nginx/"

cp "${image_dir}/lianruan-crm-v3-api-${target_version}.docker-image" "${output_dir}/images/"
cp "${image_dir}/lianruan-crm-v3-worker-${target_version}.docker-image" "${output_dir}/images/"
cp "${image_dir}/lianruan-crm-v3-nginx-${target_version}.docker-image" "${output_dir}/images/"
cp "${image_dir}/postgres-16.4-alpine.docker-image" "${output_dir}/images/"
cp "${image_dir}/redis-7.2.5-alpine.docker-image" "${output_dir}/images/"
cp "${image_dir}/sha256sum.txt" "${output_dir}/images/"

cp -R "${runtime_dir}/docker-bin/." "${output_dir}/runtime/docker-bin/"
cp "${compose_runtime}" "${output_dir}/runtime/compose/"
cp "${runtime_dir}/sha256sum.txt" "${output_dir}/runtime/"

cp "${project_root}/database/migrations/"*.sql "${output_dir}/database/migrations/"

for name in install.sh install-all.sh install-runtime.sh load-images.sh generate-secrets.sh preflight.sh migrate-db.sh start.sh stop.sh health-check.sh backup.sh rollback.sh collect-diagnostics.sh message-observability.sh message-data-retention.sh; do
  [ -f "${project_root}/deploy/single-server/scripts/${name}" ] && cp "${project_root}/deploy/single-server/scripts/${name}" "${output_dir}/scripts/"
done

cp "${project_root}/deploy/single-server/compose/docker-compose.yml" "${output_dir}/files/compose/"
cp "${project_root}/deploy/single-server/config/nginx/default.conf" "${output_dir}/files/config/nginx/"
for name in health-check.sh start.sh stop.sh migrate-db.sh backup.sh rollback.sh collect-diagnostics.sh message-observability.sh message-data-retention.sh; do
  [ -f "${project_root}/deploy/single-server/scripts/${name}" ] && cp "${project_root}/deploy/single-server/scripts/${name}" "${output_dir}/files/scripts/"
done
cp "${sp_app_dir}/scripts/precheck-sp-full.sh" "${output_dir}/files/scripts/" 2>/dev/null || true
cp "${sp_app_dir}/scripts/upgrade-sp-full.sh" "${output_dir}/files/scripts/" 2>/dev/null || true
cp "${sp_app_dir}/scripts/verify-sp-full.sh" "${output_dir}/files/scripts/" 2>/dev/null || true
cp "${sp_app_dir}/scripts/rollback-sp-full.sh" "${output_dir}/files/scripts/" 2>/dev/null || true

cp "${sp_app_dir}/scripts/"*.sh "${output_dir}/scripts/"
cp "${sp_app_dir}/README-sp-full.md" "${output_dir}/README.md"
cp "${sp_app_dir}/变更说明-sp-full.md" "${output_dir}/变更说明.md"
cp "${sp_app_dir}/tests/"* "${output_dir}/tests/"
cp "${project_root}/deploy/single-server/docs/"*.md "${output_dir}/docs/" 2>/dev/null || true

{
  printf 'ADMIN_HTML_SHA256=%s\n' "${web_admin_html_sha256}"
  printf 'ADMIN_APP_SHA256=%s\n' "${web_admin_app_sha256}"
  printf 'ADMIN_STYLE_SHA256=%s\n' "${web_admin_style_sha256}"
  printf 'ORGANIZATION_WORKSPACE_ASSET=%s\n' "${web_workspace_asset_name}"
  printf 'ORGANIZATION_WORKSPACE_ASSET_SHA256=%s\n' "${web_workspace_asset_sha256}"
} > "${output_dir}/manifest/WEB静态资源证据.env"

for text_file in "${output_dir}/README.md" "${output_dir}/变更说明.md"; do
  text_temp_file="${text_file}.tmp.$$"
  sed \
    -e "s#__SOURCE_VERSION__#none#g" \
    -e "s#__TARGET_VERSION__#${target_version}#g" \
    -e "s#__PACKAGE_ID__#${package_id}#g" \
    -e "s#__PACKAGE_FILE__#${package_name}.zip#g" \
    -e "s#__PACKAGE_NAME__#${package_name}#g" \
    -e "s#__SOURCE_API_IMAGE__#lianruan-crm-v3-api:${target_version}#g" \
    -e "s#__SOURCE_WORKER_IMAGE__#lianruan-crm-v3-worker:${target_version}#g" \
    -e "s#__SOURCE_NGINX_IMAGE__#lianruan-crm-v3-nginx:${target_version}#g" \
    -e "s#__PACKAGE_NOTE__#${package_note}#g" \
    "${text_file}" > "${text_temp_file}"
  mv "${text_temp_file}" "${text_file}"
done

写入包内版本号() {
  local target_file="$1"
  local temp_file="${target_file}.tmp.$$"
  awk -v version_tag="${target_version}" '
    /^V3_IMAGE_TAG=/ {
      print "V3_IMAGE_TAG=" version_tag
      next
    }
    /^V3_BUILD_VERSION=/ {
      print "V3_BUILD_VERSION=" version_tag
      next
    }
    /^version_tag="\$\{V3_IMAGE_TAG:-/ {
      print "version_tag=\"${V3_IMAGE_TAG:-" version_tag "}\""
      next
    }
    { print }
  ' "${target_file}" > "${temp_file}"
  mv "${temp_file}" "${target_file}"
}

写入包内版本号 "${output_dir}/config/deploy.env.example"
写入包内版本号 "${output_dir}/config/v3.env.template"
写入包内版本号 "${output_dir}/scripts/install.sh"
写入包内版本号 "${output_dir}/scripts/package-offline.sh" 2>/dev/null || true

{
  printf 'PACKAGE_ID=%s\n' "${package_id}"
  printf 'PACKAGE_FAMILY=SP\n'
  printf 'PACKAGE_MODE=SP-FULL\n'
  printf 'SOURCE_VERSION=none\n'
  printf 'ALLOWED_FROM_VERSIONS=recognized-v3-migration-lineage\n'
  printf 'UPGRADE_SOURCE_POLICY=existing-v3-install-and-migration-lineage\n'
  printf 'TARGET_VERSION=%s\n' "${target_version}"
  printf 'AFFECTED_COMPONENTS=api,worker,nginx,postgres,redis,docker,compose,config,scripts,database,runtime\n'
  printf 'REQUIRES_DB_MIGRATION=true\n'
  printf 'DATABASE_CHANGE_MODE=expand\n'
  printf 'AUTO_ROLLBACK_SCOPE=app\n'
  printf 'REQUIRES_MAINTENANCE_WINDOW=true\n'
  printf 'BUILD_COMMIT=%s\n' "${build_commit}"
  printf 'BUILD_TIME=%s\n' "${build_time}"
  printf 'DEFAULT_INSTALL_ROOT=/opt/lianruan-crm-v3\n'
  printf 'API_IMAGE=lianruan-crm-v3-api:%s\n' "${target_version}"
  printf 'WORKER_IMAGE=lianruan-crm-v3-worker:%s\n' "${target_version}"
  printf 'NGINX_IMAGE=lianruan-crm-v3-nginx:%s\n' "${target_version}"
  printf 'POSTGRES_IMAGE=postgres:16.4-alpine\n'
  printf 'REDIS_IMAGE=redis:7.2.5-alpine\n'
} > "${output_dir}/manifest/包元数据.env"

mkdir -p "${output_dir}/manifest"
(
  cd "${output_dir}"
  while IFS= read -r file_path; do
    file_size="$(wc -c < "${file_path}" | tr -d ' ')"
    printf '%s\t%s\n' "${file_path}" "${file_size}"
  done < <(find . -type f ! -path './manifest/SHA256SUMS' ! -path './manifest/文件清单.tsv' -print | LC_ALL=C sort) > manifest/文件清单.tsv
  find . -type f ! -path './manifest/SHA256SUMS' -print | LC_ALL=C sort | xargs sha256sum > manifest/SHA256SUMS
)

mkdir -p "${output_root}"
rm -f "${output_root}/${package_name}.zip" "${output_root}/${package_name}.zip.sha256"
(
  cd "${output_root}"
  zip -qr -X "${package_name}.zip" "${package_name}"
  sha256sum "${package_name}.zip" > "${package_name}.zip.sha256"
)

(
  cd "${output_root}"
  sha256sum -c "${package_name}.zip.sha256"
)

check_dir="$(mktemp -d "${output_root}/.sp-full-check.XXXXXX")"
trap 'rm -rf "${check_dir}"' EXIT
(
  cd "${check_dir}"
  unzip -q "${output_root}/${package_name}.zip"
  cd "${package_name}"
  sha256sum -c manifest/SHA256SUMS
  for script_file in scripts/*.sh files/scripts/*.sh tests/*.sh; do
    bash -n "${script_file}"
  done
  set -a
  # shellcheck disable=SC1091
  . manifest/包元数据.env
  set +a
  [ "${PACKAGE_MODE}" = "SP-FULL" ]
  [ "${TARGET_VERSION}" = "${target_version}" ]
  [ "${SOURCE_VERSION}" = "none" ]
)

echo "SP-FULL 升级包已生成：${output_root}/${package_name}.zip"
echo "外层校验文件：${output_root}/${package_name}.zip.sha256"
