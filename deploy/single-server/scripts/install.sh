#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
package_root="$(cd "${script_dir}/.." && pwd)"
install_root="${INSTALL_ROOT:-/opt/lianruan-crm-v3}"
server_host="${SERVER_HOST:-}"
version_tag="${V3_IMAGE_TAG:-3.0.0-stage9.20260727}"
build_version="${V3_BUILD_VERSION:-${version_tag}}"
build_commit="${V3_BUILD_COMMIT:-stage9-health-final}"
build_time="${V3_BUILD_TIME:-$(date -u '+%Y-%m-%dT%H:%M:%SZ')}"

if [ "$(id -u)" -ne 0 ]; then
  echo "请使用root或sudo执行安装脚本。" >&2
  exit 1
fi

if [ "$(uname -m)" != "x86_64" ]; then
  echo "当前服务器不是x86_64架构，阶段7离线包目标为Linux x86。" >&2
  exit 1
fi

if [ -f /etc/os-release ] && ! grep -Eiq 'openEuler|Euler' /etc/os-release; then
  echo "提示：当前系统不是欧拉标识，继续安装前请确认已完成兼容验证。"
fi

command -v docker >/dev/null 2>&1 || {
  echo "未找到docker，请先在欧拉服务器安装Docker。" >&2
  exit 1
}
docker compose version >/dev/null 2>&1 || {
  echo "未找到docker compose插件，请先安装Docker Compose。" >&2
  exit 1
}
command -v openssl >/dev/null 2>&1 || {
  echo "未找到openssl，请先安装openssl。" >&2
  exit 1
}

if [ -z "${server_host}" ]; then
  server_host="$(hostname -I 2>/dev/null | awk '{print $1}')"
fi
server_host="${server_host:-127.0.0.1}"

echo "开始安装联软CRM V3阶段7单机离线部署资产。"
echo "安装目录：${install_root}"
echo "访问地址：http://${server_host}"

mkdir -p \
  "${install_root}/compose" \
  "${install_root}/config/nginx" \
  "${install_root}/secrets" \
  "${install_root}/data/postgres" \
  "${install_root}/data/redis-state" \
  "${install_root}/data/redis-cache" \
  "${install_root}/data/uploads" \
  "${install_root}/data/exports" \
  "${install_root}/data/migration" \
  "${install_root}/database/migrations" \
  "${install_root}/backups/postgres-cache" \
  "${install_root}/backups/files-cache" \
  "${install_root}/logs/nginx" \
  "${install_root}/logs/api-1" \
  "${install_root}/logs/api-2" \
  "${install_root}/logs/worker" \
  "${install_root}/logs/postgres" \
  "${install_root}/releases" \
  "${install_root}/scripts"

chmod 750 "${install_root}"
chmod 700 "${install_root}/secrets"

写入文件如不存在() {
  local source_file="$1"
  local target_file="$2"

  if [ -f "${target_file}" ]; then
    cp "${source_file}" "${target_file}.new"
    echo "检测到已有 ${target_file}，跳过覆盖；新模板已写入 ${target_file}.new。"
  else
    cp "${source_file}" "${target_file}"
  fi
}

写入部署变量如不存在() {
  local target_file="$1"
  local output_file="${target_file}"

  if [ -f "${target_file}" ]; then
    output_file="${target_file}.new"
    echo "检测到已有 ${target_file}，跳过覆盖；新模板已写入 ${output_file}。"
  fi

  cp "${package_root}/config/deploy.env.example" "${output_file}"
  sed -i "s#^INSTALL_ROOT=.*#INSTALL_ROOT=${install_root}#" "${output_file}"
}

更新环境变量() {
  local target_file="$1"
  local key="$2"
  local value="$3"

  if [ ! -f "${target_file}" ]; then
    return
  fi

  if grep -q "^${key}=" "${target_file}"; then
    sed -i "s#^${key}=.*#${key}=${value}#" "${target_file}"
  else
    printf '%s=%s\n' "${key}" "${value}" >> "${target_file}"
  fi
}

补充环境变量如不存在() {
  local target_file="$1"
  local key="$2"
  local value="$3"

  if [ ! -f "${target_file}" ]; then
    return
  fi

  if ! grep -q "^${key}=" "${target_file}"; then
    printf '%s=%s\n' "${key}" "${value}" >> "${target_file}"
  fi
}

同步版本变量() {
  local target_file="$1"

  更新环境变量 "${target_file}" "V3_IMAGE_TAG" "${version_tag}"
}

同步单点登录变量() {
  local target_file="$1"

  更新环境变量 "${target_file}" "V3_IAM_H5_SSO_ENABLED" "true"
  更新环境变量 "${target_file}" "V3_IAM_H5_SSO_VALIDATE_URL" "http://10.10.2.62:8192/emm-cgi/oidc/getUserFromSsoToken"
  更新环境变量 "${target_file}" "V3_IAM_H5_SSO_VALIDATE_ISAID" "QdCRMguanlyuan123"
  更新环境变量 "${target_file}" "V3_IAM_H5_SSO_ADMIN_VALIDATE_ISAID" ""
  更新环境变量 "${target_file}" "V3_IAM_H5_SSO_PARTNER_VALIDATE_ISAID" ""
  更新环境变量 "${target_file}" "V3_IAM_H5_SSO_ADMIN_REQUEST_ISAID" "QdCRMguanlyuan123"
  更新环境变量 "${target_file}" "V3_IAM_H5_SSO_PARTNER_REQUEST_ISAID" "QdCRMguanlyuan123"
  更新环境变量 "${target_file}" "V3_UNISDP_SSO_ENABLED" "true"
  更新环境变量 "${target_file}" "V3_UNISDP_SSO_VALIDATE_URL" "https://portal.leagsoft.com/UniSSO/auth/sso_token.json"
  更新环境变量 "${target_file}" "V3_UNISDP_SSO_ISAID" "QdCRMguanlyuan123"
  更新环境变量 "${target_file}" "V3_UNISDP_SSO_TIMEOUT_MS" "8000"
}

同步Nginx单点登录入口() {
  local target_file="$1"

  if [ ! -f "${target_file}" ]; then
    return
  fi

  local add_app=0
  local add_iam=0
  local add_unisdp=0
  if ! grep -q "location = /app/sso.htm" "${target_file}"; then
    add_app=1
  fi
  if ! grep -q "location = /sso/iam" "${target_file}"; then
    add_iam=1
  fi
  if ! grep -q "location = /sso/unisdp" "${target_file}"; then
    add_unisdp=1
  fi
  if [ "${add_app}" = "0" ] && [ "${add_iam}" = "0" ] && [ "${add_unisdp}" = "0" ]; then
    return
  fi

  local backup_file="${target_file}.bak.$(date +%Y%m%d%H%M%S)"
  local temp_file="${target_file}.tmp.$$"
  cp "${target_file}" "${backup_file}"
  awk -v add_app="${add_app}" -v add_iam="${add_iam}" -v add_unisdp="${add_unisdp}" '
    function print_app_sso() {
      print "    location = /app/sso.htm {";
      print "        proxy_pass http://v3_api/app/sso.htm;"
      print "        proxy_set_header Host $host;"
      print "        proxy_set_header X-Request-Id $request_id;"
      print "        proxy_set_header X-Real-IP $remote_addr;"
      print "        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;"
      print "        proxy_set_header X-Forwarded-Proto $scheme;"
      print "    }";
    }
    function print_front_sso(path) {
      print "    location = " path " {";
      print "        try_files /index.html =404;";
      print "        add_header Cache-Control \"no-store, no-cache, must-revalidate, max-age=0\" always;";
      print "        add_header Pragma \"no-cache\" always;";
      print "        add_header Expires \"0\" always;";
      print "    }";
    }
    BEGIN { inserted_app = 0; inserted_front = 0 }
    add_app == "1" && !inserted_app && $0 ~ /^[[:space:]]*location = \/$/ {
      print_app_sso();
      print "";
      inserted_app = 1;
    }
    (add_iam == "1" || add_unisdp == "1") && !inserted_front && $0 ~ /^[[:space:]]*location = \/admin/ {
      if (add_iam == "1") {
        print_front_sso("/sso/iam");
        print "";
      }
      if (add_unisdp == "1") {
        print_front_sso("/sso/unisdp");
        print "";
      }
      inserted_front = 1;
    }
    { print }
    END {
      if (add_app == "1" && !inserted_app) exit 2;
      if ((add_iam == "1" || add_unisdp == "1") && !inserted_front) exit 2;
    }
  ' "${target_file}" > "${temp_file}" || {
    rm -f "${temp_file}"
    echo "未能自动写入 ${target_file} 的单点登录入口，请手工比对 ${install_root}/config/nginx.new/default.conf。" >&2
    exit 1
  }
  mv "${temp_file}" "${target_file}"
  echo "已同步单点登录 Nginx 入口，原配置备份：${backup_file}"
}

写入文件如不存在 "${package_root}/compose/docker-compose.yml" "${install_root}/compose/docker-compose.yml"
if [ -f "${install_root}/config/nginx/default.conf" ]; then
  rm -rf "${install_root}/config/nginx.new"
  mkdir -p "${install_root}/config/nginx.new"
  cp -R "${package_root}/config/nginx/." "${install_root}/config/nginx.new/"
  echo "检测到已有 ${install_root}/config/nginx/default.conf，跳过覆盖；新模板目录已写入 ${install_root}/config/nginx.new。"
  同步Nginx单点登录入口 "${install_root}/config/nginx/default.conf"
else
  cp -R "${package_root}/config/nginx/." "${install_root}/config/nginx/"
fi
写入部署变量如不存在 "${install_root}/config/deploy.env"
写入部署变量如不存在 "${install_root}/compose/.env"
同步版本变量 "${install_root}/config/deploy.env"
同步版本变量 "${install_root}/compose/.env"
补充环境变量如不存在 "${install_root}/config/deploy.env" "POSTGRES_BIND_HOST" "0.0.0.0"
补充环境变量如不存在 "${install_root}/config/deploy.env" "POSTGRES_PUBLISHED_PORT" "15432"
补充环境变量如不存在 "${install_root}/compose/.env" "POSTGRES_BIND_HOST" "0.0.0.0"
补充环境变量如不存在 "${install_root}/compose/.env" "POSTGRES_PUBLISHED_PORT" "15432"
cp "${package_root}/scripts/"*.sh "${install_root}/scripts/"
chmod 750 "${install_root}/scripts/"*.sh

if [ -d "${package_root}/database/migrations" ]; then
  cp "${package_root}/database/migrations/"*.sql "${install_root}/database/migrations/"
fi

if [ -d "${package_root}/migration/stage8-official" ]; then
  rm -rf "${install_root}/data/migration/stage8-official"
  mkdir -p "${install_root}/data/migration/stage8-official"
  cp -R "${package_root}/migration/stage8-official/." "${install_root}/data/migration/stage8-official/"
fi

INSTALL_ROOT="${install_root}" "${install_root}/scripts/generate-secrets.sh"

postgres_password="$(cat "${install_root}/secrets/postgres_password")"
redis_password="$(cat "${install_root}/secrets/redis_password")"
session_secret="$(cat "${install_root}/secrets/session_secret")"

if [ ! -f "${install_root}/config/v3.env" ]; then
  sed \
    -e "s#__SERVER_HOST__#${server_host}#g" \
    -e "s#__POSTGRES_PASSWORD__#${postgres_password}#g" \
    -e "s#__REDIS_PASSWORD__#${redis_password}#g" \
    -e "s#__SESSION_SECRET__#${session_secret}#g" \
    -e "s#^V3_BUILD_VERSION=.*#V3_BUILD_VERSION=${build_version}#" \
    -e "s#__BUILD_COMMIT__#${build_commit}#g" \
    -e "s#__BUILD_TIME__#${build_time}#g" \
    "${package_root}/config/v3.env.template" > "${install_root}/config/v3.env"
  chmod 600 "${install_root}/config/v3.env"
else
  echo "检测到已有 ${install_root}/config/v3.env，保留敏感配置并同步版本字段。"
fi
更新环境变量 "${install_root}/config/v3.env" "V3_BUILD_VERSION" "${build_version}"
更新环境变量 "${install_root}/config/v3.env" "V3_BUILD_COMMIT" "${build_commit}"
更新环境变量 "${install_root}/config/v3.env" "V3_BUILD_TIME" "${build_time}"
同步单点登录变量 "${install_root}/config/v3.env"

"${package_root}/scripts/load-images.sh"

echo "安装完成。下一步执行："
echo "sudo ${install_root}/scripts/start.sh"
echo "${install_root}/scripts/health-check.sh"
