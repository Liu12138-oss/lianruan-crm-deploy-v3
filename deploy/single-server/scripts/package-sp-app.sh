#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "${script_dir}/../../.." && pwd)"

失败() {
  echo "SP-APP 制包失败：$*" >&2
  exit 1
}

source_version="${V3_SOURCE_VERSION:-}"
target_version="${V3_IMAGE_TAG:-}"
package_id="${V3_PACKAGE_ID:-}"
source_api_image="${V3_SOURCE_API_IMAGE:-}"
source_api_image_id="${V3_SOURCE_API_IMAGE_ID:-}"
source_worker_image="${V3_SOURCE_WORKER_IMAGE:-}"
source_worker_image_id="${V3_SOURCE_WORKER_IMAGE_ID:-}"
source_nginx_image="${V3_SOURCE_NGINX_IMAGE:-}"
source_nginx_image_id="${V3_SOURCE_NGINX_IMAGE_ID:-}"
[ -n "${source_version}" ] || 失败 "必须显式设置 V3_SOURCE_VERSION。"
[ -n "${target_version}" ] || 失败 "必须显式设置 V3_IMAGE_TAG。"
[ -n "${package_id}" ] || 失败 "必须显式设置 V3_PACKAGE_ID。"
[ -n "${source_api_image}" ] || 失败 "必须显式设置 V3_SOURCE_API_IMAGE。"
[ -n "${source_api_image_id}" ] || 失败 "必须显式设置 V3_SOURCE_API_IMAGE_ID。"
[ -n "${source_worker_image}" ] || 失败 "必须显式设置 V3_SOURCE_WORKER_IMAGE。"
[ -n "${source_worker_image_id}" ] || 失败 "必须显式设置 V3_SOURCE_WORKER_IMAGE_ID。"
[ -n "${source_nginx_image}" ] || 失败 "必须显式设置 V3_SOURCE_NGINX_IMAGE。"
[ -n "${source_nginx_image_id}" ] || 失败 "必须显式设置 V3_SOURCE_NGINX_IMAGE_ID。"
[ "${source_version}" != "${target_version}" ] || 失败 "源版本与目标镜像版本不能相同。"

验证安全标识() {
  local name="$1" value="$2"
  [[ "${value}" =~ ^[0-9A-Za-z][0-9A-Za-z._+-]{0,127}$ ]] ||
    失败 "${name} 只能包含字母、数字、点、下划线、加号和连字符，且必须以字母或数字开头。"
}

验证安全标识 "V3_SOURCE_VERSION" "${source_version}"
验证安全标识 "V3_IMAGE_TAG" "${target_version}"
验证安全标识 "V3_PACKAGE_ID" "${package_id}"

验证镜像名称() {
  local name="$1" value="$2"
  [[ "${value}" =~ ^[0-9A-Za-z][0-9A-Za-z._/+:-]{0,255}$ ]] || 失败 "${name} 不是安全的镜像名称。"
}

验证镜像摘要() {
  local name="$1" value="$2"
  [[ "${value}" =~ ^sha256:[0-9a-f]{64}$ ]] || 失败 "${name} 不是有效的 SHA-256 镜像摘要。"
}

验证镜像名称 V3_SOURCE_API_IMAGE "${source_api_image}"
验证镜像名称 V3_SOURCE_WORKER_IMAGE "${source_worker_image}"
验证镜像名称 V3_SOURCE_NGINX_IMAGE "${source_nginx_image}"
验证镜像摘要 V3_SOURCE_API_IMAGE_ID "${source_api_image_id}"
验证镜像摘要 V3_SOURCE_WORKER_IMAGE_ID "${source_worker_image_id}"
验证镜像摘要 V3_SOURCE_NGINX_IMAGE_ID "${source_nginx_image_id}"

output_root="${V3_SP_OUTPUT_ROOT:-${project_root}/tmp/sp-app-package}"
package_name="lianruan-crm-v3-sp-app-${target_version}"
output_dir="${output_root}/${package_name}"
build_commit="${V3_BUILD_COMMIT:-$(git -C "${project_root}" rev-parse --short HEAD 2>/dev/null || echo local)}"
build_time="${V3_BUILD_TIME:-$(date -u '+%Y-%m-%dT%H:%M:%SZ')}"
mkdir -p "${output_root}"

for command_name in zip unzip sha256sum docker tar git; do
  command -v "${command_name}" >/dev/null 2>&1 || 失败 "未找到命令：${command_name}"
done

[ -z "$(git -C "${project_root}" status --porcelain --untracked-files=all)" ] ||
  失败 "当前工作区存在未收口改动。请先形成可追溯提交基线，再按该提交构建镜像和制作升级包。"

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
        if (name ~ /[[:space:].\/?*"(){}$]/) next
        if (name !~ /^[A-Za-z_][A-Za-z0-9_]*$/) print NR ":" $0
      }
    }
  ' "${shell_file}")"
  [ -z "${invalid_lines}" ] ||
    失败 "Shell 脚本存在 Bash 运行时不支持的变量名：${shell_file}：${invalid_lines}"
}

for shell_file in \
  "${project_root}/deploy/single-server/scripts/package-sp-app.sh" \
  "${project_root}/deploy/single-server/scripts/migrate-db.sh" \
  "${project_root}/deploy/single-server/sp-app/scripts/"*.sh \
  "${project_root}/deploy/single-server/sp-app/tests/"*.sh \
  "${project_root}/deploy/single-server/tests/数据库迁移顺序测试.sh"; do
  检查Shell变量名 "${shell_file}"
done

for image_name in api worker nginx; do
  image_file="${project_root}/deploy/single-server/images/lianruan-crm-v3-${image_name}-${target_version}.docker-image"
  [ -f "${image_file}" ] || 失败 "未找到目标镜像归档：${image_file}"
done

验证镜像归档与本地镜像一致() {
  local image_name image_file image_tag archive_config_path archive_config_sha local_image_id
  for image_name in api worker nginx; do
    image_file="${project_root}/deploy/single-server/images/lianruan-crm-v3-${image_name}-${target_version}.docker-image"
    image_tag="lianruan-crm-v3-${image_name}:${target_version}"
    archive_config_path="$(tar -xOf "${image_file}" manifest.json 2>/dev/null | tr -d '\n' | sed -n 's/.*"Config"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
    [ -n "${archive_config_path}" ] || 失败 "镜像归档缺少 Config 信息：${image_file}"
    archive_config_sha="${archive_config_path##*/}"
    archive_config_sha="${archive_config_sha%.json}"
    [ "${#archive_config_sha}" -eq 64 ] || 失败 "镜像归档 Config 格式无效：${image_file}"
    case "${archive_config_sha}" in
      *[!0-9a-f]*) 失败 "镜像归档 Config 格式无效：${image_file}" ;;
    esac
    local_image_id="$(docker image inspect --format '{{.Id}}' "${image_tag}" 2>/dev/null || true)"
    [ -n "${local_image_id}" ] || 失败 "本地不存在目标镜像：${image_tag}"
    [ "${local_image_id#sha256:}" = "${archive_config_sha}" ] ||
      失败 "镜像归档与本地同标签镜像不一致：${image_tag}"
  done
}

验证镜像归档与本地镜像一致
bash "${project_root}/deploy/single-server/tests/数据库迁移顺序测试.sh"

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
  if ! grep -Fq 'admin-app.js?v=156' "${source_admin_html}" ||
    ! grep -Fq 'admin-app.js?v=156' "${dist_admin_html}"; then
    失败 "正式 admin.html 未使用 admin-app.js?v=156。"
  fi
  if ! grep -Fq 'style.css?v=16' "${source_admin_html}" ||
    ! grep -Fq 'style.css?v=16' "${dist_admin_html}"; then
    失败 "正式 admin.html 未使用 style.css?v=16。"
  fi
  source_workspace_assets=()
  while IFS= read -r workspace_candidate; do
    source_workspace_assets+=("${workspace_candidate}")
  done < <(find "${project_root}/apps/web/dist/assets" -maxdepth 1 -type f -name 'OrganizationWorkspacePage-*.js' -print)
  [ "${#source_workspace_assets[@]}" -eq 1 ] ||
    失败 "本地 Web 构建产物中的组织架构工作区资源必须且只能有一个，当前找到 ${#source_workspace_assets[@]} 个。"
  source_workspace_asset="${source_workspace_assets[0]}"
  [ "$(sha256sum "${source_admin_html}" | awk '{print $1}')" = "$(sha256sum "${dist_admin_html}" | awk '{print $1}')" ] ||
    失败 "Web 源码 admin.html 与构建产物不一致。"
  [ "$(sha256sum "${source_admin_app}" | awk '{print $1}')" = "$(sha256sum "${dist_admin_app}" | awk '{print $1}')" ] ||
    失败 "Web 源码 admin-app.js 与构建产物不一致。"
  [ "$(sha256sum "${source_admin_style}" | awk '{print $1}')" = "$(sha256sum "${dist_admin_style}" | awk '{print $1}')" ] ||
    失败 "Web 源码 style.css 与构建产物不一致。"
  static_dir="$(mktemp -d "${output_root}/.sp-app-web.XXXXXX")"
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
  if ! grep -Fq 'admin-app.js?v=156' "${static_dir}/admin.html"; then
    清理Web镜像检查
    失败 "目标 admin.html 未使用 admin-app.js?v=156。"
  fi
  if ! grep -Fq 'style.css?v=16' "${static_dir}/admin.html"; then
    清理Web镜像检查
    失败 "目标 admin.html 未使用 style.css?v=16。"
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
  if
    ! grep -R -Fq 'workspace/admin/platform-admin/organization' "${static_dir}/assets" ||
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
    失败 "目标 Nginx 镜像与当前 Web 源码构建产物不一致。"
  fi
  清理Web镜像检查
}

验证Web镜像静态资源

rm -rf "${output_dir}"
mkdir -p "${output_dir}/images" "${output_dir}/files/compose" "${output_dir}/files/config/nginx" "${output_dir}/files/scripts" "${output_dir}/database" "${output_dir}/manifest" "${output_dir}/scripts" "${output_dir}/tests"

cp "${project_root}/deploy/single-server/images/lianruan-crm-v3-api-${target_version}.docker-image" "${output_dir}/images/"
cp "${project_root}/deploy/single-server/images/lianruan-crm-v3-worker-${target_version}.docker-image" "${output_dir}/images/"
cp "${project_root}/deploy/single-server/images/lianruan-crm-v3-nginx-${target_version}.docker-image" "${output_dir}/images/"
cp "${project_root}/deploy/single-server/compose/docker-compose.yml" "${output_dir}/files/compose/"
cp "${project_root}/deploy/single-server/config/nginx/default.conf" "${output_dir}/files/config/nginx/"
for name in health-check.sh start.sh stop.sh migrate-db.sh backup.sh rollback.sh collect-diagnostics.sh message-observability.sh message-data-retention.sh; do
  [ -f "${project_root}/deploy/single-server/scripts/${name}" ] && cp "${project_root}/deploy/single-server/scripts/${name}" "${output_dir}/files/scripts/"
done
cp -R "${project_root}/database/migrations" "${output_dir}/database/"
cp "${project_root}/deploy/single-server/sp-app/scripts/"*.sh "${output_dir}/scripts/"
cp "${project_root}/deploy/single-server/sp-app/tests/"* "${output_dir}/tests/"
cp "${project_root}/deploy/single-server/sp-app/README.md" "${output_dir}/README.md"
cp "${project_root}/deploy/single-server/sp-app/变更说明.md" "${output_dir}/变更说明.md"

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
    -e "s#__SOURCE_VERSION__#${source_version}#g" \
    -e "s#__TARGET_VERSION__#${target_version}#g" \
    -e "s#__PACKAGE_ID__#${package_id}#g" \
    -e "s#__PACKAGE_FILE__#${package_name}.zip#g" \
    -e "s#__PACKAGE_NAME__#${package_name}#g" \
    -e "s#__SOURCE_API_IMAGE__#${source_api_image}#g" \
    -e "s#__SOURCE_WORKER_IMAGE__#${source_worker_image}#g" \
    -e "s#__SOURCE_NGINX_IMAGE__#${source_nginx_image}#g" \
    "${text_file}" > "${text_temp_file}"
  mv "${text_temp_file}" "${text_file}"
done

for script_file in "${output_dir}/scripts/"*.sh "${output_dir}/files/scripts/"*.sh "${output_dir}/tests/"*.sh; do
  bash -n "${script_file}"
  chmod 750 "${script_file}"
done

api_digest="$(docker image inspect --format '{{index .RepoDigests 0}}' "lianruan-crm-v3-api:${target_version}" 2>/dev/null || true)"
worker_digest="$(docker image inspect --format '{{index .RepoDigests 0}}' "lianruan-crm-v3-worker:${target_version}" 2>/dev/null || true)"
nginx_digest="$(docker image inspect --format '{{index .RepoDigests 0}}' "lianruan-crm-v3-nginx:${target_version}" 2>/dev/null || true)"
{
  printf 'PACKAGE_ID=%s\n' "${package_id}"
  printf 'PACKAGE_FAMILY=SP\n'
  printf 'PACKAGE_MODE=SP-APP\n'
  printf 'SOURCE_VERSION=%s\n' "${source_version}"
  printf 'ALLOWED_FROM_VERSIONS=%s\n' "${source_version}"
  printf 'TARGET_VERSION=%s\n' "${target_version}"
  printf 'AFFECTED_COMPONENTS=api,worker,nginx,config,scripts,database\n'
  printf 'REQUIRES_DB_MIGRATION=true\n'
  printf 'DATABASE_CHANGE_MODE=expand\n'
  printf 'AUTO_ROLLBACK_SCOPE=app\n'
  printf 'REQUIRES_MAINTENANCE_WINDOW=true\n'
  printf 'BUILD_COMMIT=%s\n' "${build_commit}"
  printf 'BUILD_TIME=%s\n' "${build_time}"
  printf 'DEFAULT_INSTALL_ROOT=/opt/lianruan-crm-v3\n'
  printf 'SOURCE_API_IMAGE=%s\n' "${source_api_image}"
  printf 'SOURCE_API_IMAGE_ID=%s\n' "${source_api_image_id}"
  printf 'SOURCE_WORKER_IMAGE=%s\n' "${source_worker_image}"
  printf 'SOURCE_WORKER_IMAGE_ID=%s\n' "${source_worker_image_id}"
  printf 'SOURCE_NGINX_IMAGE=%s\n' "${source_nginx_image}"
  printf 'SOURCE_NGINX_IMAGE_ID=%s\n' "${source_nginx_image_id}"
  printf 'API_IMAGE_DIGEST=%s\n' "${api_digest}"
  printf 'WORKER_IMAGE_DIGEST=%s\n' "${worker_digest}"
  printf 'NGINX_IMAGE_DIGEST=%s\n' "${nginx_digest}"
} > "${output_dir}/manifest/包元数据.env"

(
  cd "${output_dir}"
  while IFS= read -r file_path; do
    file_size="$(wc -c < "${file_path}" | tr -d ' ')"
    printf '%s\t%s\n' "${file_path}" "${file_size}"
  done < <(find . -type f ! -path './manifest/SHA256SUMS' -print | LC_ALL=C sort) > manifest/文件清单.tsv
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

check_dir="$(mktemp -d "${output_root}/.sp-app-check.XXXXXX")"
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
  . manifest/包元数据.env
  set +a
  [ "${PACKAGE_MODE}" = "SP-APP" ]
  [ "${TARGET_VERSION}" = "${target_version}" ]
)

echo "SP-APP 升级包已生成：${output_root}/${package_name}.zip"
echo "外层校验文件：${output_root}/${package_name}.zip.sha256"
