#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "${script_dir}/../../.." && pwd)"
backup_script="${project_root}/deploy/single-server/scripts/system-backup-restore.sh"
temp_dir="$(mktemp -d)"
install_root="${temp_dir}/install"
bin_dir="${temp_dir}/bin"
mock_log="${temp_dir}/docker.log"
target_dir="${temp_dir}/backup"

清理() {
  rm -rf "${temp_dir}"
}
trap 清理 EXIT

失败() {
  echo "系统全量备份离线恢复测试失败：$*" >&2
  exit 1
}

断言包含() {
  local expected="$1"
  local file="$2"
  grep -Fqx "${expected}" "${file}" || 失败 "未找到预期内容：${expected}"
}

[ -f "${backup_script}" ] || 失败 "未找到全量备份脚本。"
bash -n "${backup_script}" || 失败 "全量备份脚本语法错误。"
if rg -n 'docker compose up' "${backup_script}" >/dev/null 2>&1; then
  失败 "全量备份脚本存在未通过统一封装的 Compose 启动调用。"
fi
if rg -n '运行Compose[^\n]* up' "${backup_script}" | rg -v -- '--pull never' >/dev/null 2>&1; then
  失败 "存在未显式禁止拉取镜像的 Compose 启动调用。"
fi

mkdir -p "${install_root}/compose" "${install_root}/config" "${bin_dir}" "${target_dir}/metadata"
printf '%s\n' 'services: {}' > "${install_root}/compose/docker-compose.yml"
printf '%s\n' 'V3_IMAGE_TAG=3.0.0-stage9.40.20260820-kb026' > "${install_root}/compose/.env"
printf '%s\n' 'V3_TEST=true' > "${install_root}/config/v3.env"

MOCK_DOCKER_LOG="${mock_log}" MOCK_INSTALL_ROOT="${install_root}" MOCK_TARGET_DIR="${target_dir}" BACKUP_SCRIPT="${backup_script}" \
  bash <<'EOF'
set -euo pipefail

docker() {
  local argument
  local compose_command=""
  local last_argument=""
  local format=""
  local container_id=""
  local service=""

  容器ID() {
    case "$1" in
      nginx) printf '%s\n' nginx-id ;;
      api-1) printf '%s\n' api-1-id ;;
      api-2) printf '%s\n' api-2-id ;;
      worker) printf '%s\n' worker-id ;;
      worker-order-preapproval) printf '%s\n' worker-order-preapproval-id ;;
      postgres) printf '%s\n' postgres-id ;;
      redis-state) printf '%s\n' redis-state-id ;;
      redis-cache) printf '%s\n' redis-cache-id ;;
    esac
  }

  服务名() {
    case "$1" in
      nginx-id) printf '%s\n' nginx ;;
      api-1-id) printf '%s\n' api-1 ;;
      api-2-id) printf '%s\n' api-2 ;;
      worker-id) printf '%s\n' worker ;;
      worker-order-preapproval-id) printf '%s\n' worker-order-preapproval ;;
      postgres-id) printf '%s\n' postgres ;;
      redis-state-id) printf '%s\n' redis-state ;;
      redis-cache-id) printf '%s\n' redis-cache ;;
    esac
  }

  声明镜像() {
    case "$1" in
      nginx) printf '%s\n' 'lianruan-crm-v3-nginx:3.0.0-stage9.40.20260820-kb026' ;;
      api-1|api-2) printf '%s\n' 'lianruan-crm-v3-api:3.0.0-stage9.40.20260820-kb026' ;;
      worker|worker-order-preapproval) printf '%s\n' 'lianruan-crm-v3-worker:3.0.0-stage9.40.20260813-kb022' ;;
      postgres) printf '%s\n' 'postgres:16.4-alpine' ;;
      redis-state|redis-cache) printf '%s\n' 'redis:7.2.5-alpine' ;;
    esac
  }

  if [ "${1:-}" = "--version" ]; then
    printf '%s\n' 'Docker version 27.0.0, build simulated'
    return
  fi

  if [ "${1:-}" = "compose" ]; then
    shift
    printf 'compose:%s\n' "$*" >> "${MOCK_DOCKER_LOG}"
    for argument in "$@"; do
      case "${argument}" in
        version|ps|config|stop|up|exec)
          compose_command="${argument}"
          break
          ;;
      esac
    done
    case "${compose_command}" in
      version)
        printf '%s\n' 'Docker Compose version v2.32.4'
        ;;
      config)
        case " $* " in
          *' --images '*)
            printf '%s\n' \
              'lianruan-crm-v3-nginx:3.0.0-stage9.40.20260820-kb026' \
              'lianruan-crm-v3-api:3.0.0-stage9.40.20260820-kb026' \
              'lianruan-crm-v3-worker:3.0.0-stage9.40.20260820-kb026' \
              'postgres:16.4-alpine' \
              'redis:7.2.5-alpine'
            ;;
          *) printf '%s\n' 'services:' ;;
        esac
        ;;
      ps)
        for argument in "$@"; do
          last_argument="${argument}"
        done
        case "${last_argument}" in
          --all) printf '%s\n' '模拟容器状态' ;;
          *) 容器ID "${last_argument}" ;;
        esac
        ;;
      exec)
        case " $* " in
          *' psql '*) printf '%s\n' '20260903_S10_017' ;;
          *) printf '%s\n' 'OK' ;;
        esac
        ;;
      stop|up) ;;
      *)
        echo "未识别的模拟 Compose 命令：$*" >&2
        return 1
        ;;
    esac
    return
  fi

  case "${1:-}" in
    inspect)
      if [ "$#" -eq 2 ]; then
        服务名 "$2" >/dev/null
        return
      fi
      format="${3:-}"
      container_id="${4:-}"
      service="$(服务名 "${container_id}")"
      case "${format}" in
        *'.Name'*) printf '/%s\n' "lianruan-crm-v3-${service}" ;;
        *'.Config.Image'*) 声明镜像 "${service}" ;;
        *'.Image'*) printf 'sha256:%s-image\n' "${service}" ;;
        *'.State.Status'*) printf '%s\n' running ;;
        *'.State.Health'*) printf '%s\n' healthy ;;
        *) [ -n "${service}" ] ;;
      esac
      ;;
    image)
      [ "${2:-}" = "inspect" ]
      ;;
    start)
      printf 'start:%s\n' "${2:-}" >> "${MOCK_DOCKER_LOG}"
      ;;
    save)
      printf 'save:%s\n' "$*" >> "${MOCK_DOCKER_LOG}"
      ;;
    *)
      echo "未识别的模拟 Docker 命令：$*" >&2
      return 1
      ;;
  esac
}

env() {
  while [ "$#" -gt 0 ]; do
    case "$1" in
      -u)
        shift 2
        ;;
      *=*)
        shift
        ;;
      *)
        break
        ;;
    esac
  done
  "$@"
}

SYSTEM_BACKUP_RESTORE_SOURCE_ONLY=true INSTALL_ROOT="${MOCK_INSTALL_ROOT}" source "${BACKUP_SCRIPT}"
写入运行元数据 "${MOCK_TARGET_DIR}"
读取运行中的业务服务
恢复原业务服务

backup_path="${MOCK_TARGET_DIR}"
backup_format_version="V3单机系统备份v2"
compose_override_file="${MOCK_TARGET_DIR}/metadata/actual-images.override.yml"
: > "${MOCK_DOCKER_LOG}"
启动还原后服务
EOF

断言包含 'lianruan-crm-v3-worker:3.0.0-stage9.40.20260813-kb022' "${target_dir}/metadata/docker-images-actual.txt"
断言包含 '  worker:' "${target_dir}/metadata/actual-images.override.yml"
断言包含 '    image: "lianruan-crm-v3-worker:3.0.0-stage9.40.20260813-kb022"' "${target_dir}/metadata/actual-images.override.yml"

if ! awk -F '\t' '$1 == "worker" && $4 == "lianruan-crm-v3-worker:3.0.0-stage9.40.20260813-kb022" && $8 == "否" { found=1 } END { exit(found ? 0 : 1) }' "${target_dir}/metadata/image-reconciliation.tsv"; then
  失败 "未记录 Worker 实际镜像与 Compose 声明镜像不一致。"
fi

if ! grep -Fq 'compose:' "${mock_log}" || ! grep -Fq 'up -d --pull never redis-state redis-cache' "${mock_log}"; then
  失败 "还原 Redis 时未显式禁止拉取镜像。"
fi
for container_id in nginx-id api-1-id api-2-id worker-id worker-order-preapproval-id; do
  grep -Fqx "start:${container_id}" "${mock_log}" || 失败 "未优先启动原业务容器：${container_id}"
done
if grep -Fq 'up -d --pull never api-1' "${mock_log}" || grep -Fq 'up -d --pull never worker' "${mock_log}"; then
  失败 "原业务容器仍存在时不应使用 Compose 重建。"
fi

echo "系统全量备份离线恢复测试通过。"
