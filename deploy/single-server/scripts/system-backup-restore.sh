#!/usr/bin/env bash
set -euo pipefail

install_root="${INSTALL_ROOT:-/opt/lianruan-crm-v3}"
backup_root="/home/lianruan-crm-v3-system-backups"
backup_path=""
confirm_value=""
skip_pre_restore_backup=false
mode="${1:-help}"
backup_format_version=""
compose_override_file=""
image_reconciliation_status="未判断"
running_business_services=()
running_business_container_ids=()

business_service_list=(
  nginx
  api-1
  api-2
  worker
  worker-message-critical
  worker-message-maintenance
  worker-message-integration
  worker-order-preapproval
)

all_service_list=(
  nginx
  api-1
  api-2
  worker
  worker-message-critical
  worker-message-maintenance
  worker-message-integration
  worker-order-preapproval
  postgres
  redis-state
  redis-cache
)

compose_profile_args=(
  --profile message
  --profile message-external
  --profile order-preapproval
)

显示帮助() {
  cat <<'EOF'
联软 CRM V3 单机系统手工备份与还原脚本

用法：
  system-backup-restore.sh backup
  system-backup-restore.sh verify --backup /home/lianruan-crm-v3-system-backups/备份目录
  system-backup-restore.sh restore --backup /home/lianruan-crm-v3-system-backups/备份目录 --confirm RESTORE

说明：
  1. 备份固定写入 /home/lianruan-crm-v3-system-backups。
  2. 备份包含 PostgreSQL 逻辑备份、Redis 落盘数据、安装目录、Docker 镜像、配置和密钥。
  3. 备份时会短暂停止入口、接口和任务进程，以确保数据库与业务文件一致；完成后按原运行状态恢复。
  4. 还原会停止服务，并将当前安装目录重命名为带时间戳的回退目录，不会自动删除该目录。
  5. 默认还原前会先备份当前环境；当前环境无法正常备份时，可明确传入 --skip-pre-restore-backup。

可选参数：
  --backup 目录                    指定用于校验或还原的备份目录。
  --confirm RESTORE                还原操作的强制确认参数。
  --skip-pre-restore-backup        跳过还原前的当前环境备份，仅允许 restore 使用。
  --help                           显示本帮助。
EOF
}

错误退出() {
  echo "错误：$1" >&2
  exit 1
}

检查命令() {
  local command_name
  for command_name in docker zip unzip sha256sum find sort xargs awk date; do
    command -v "${command_name}" >/dev/null 2>&1 || 错误退出 "未找到必需命令：${command_name}"
  done
  docker compose version >/dev/null 2>&1 || 错误退出 "未找到 Docker Compose 插件。"
}

检查执行权限() {
  if [ "$(id -u)" -ne 0 ]; then
    错误退出 "请使用 root 或 sudo 执行本脚本，以便读取数据目录、密钥并安全还原文件权限。"
  fi
}

检查安装目录() {
  [ -d "${install_root}" ] || 错误退出 "未找到 V3 安装目录：${install_root}"
  [ -f "${install_root}/compose/docker-compose.yml" ] || 错误退出 "未找到 Compose 编排文件：${install_root}/compose/docker-compose.yml"
  [ -f "${install_root}/config/v3.env" ] || 错误退出 "未找到生产配置文件：${install_root}/config/v3.env"
}

进入编排目录() {
  cd "${install_root}/compose"
}

运行Compose() {
  local -a compose_args=(
    --project-directory "${install_root}/compose"
    -f "${install_root}/compose/docker-compose.yml"
  )

  if [ -n "${compose_override_file}" ]; then
    compose_args+=( -f "${compose_override_file}" )
  fi

  env -u V3_IMAGE_TAG -u COMPOSE_FILE -u COMPOSE_PROJECT_NAME -u COMPOSE_PROFILES \
    INSTALL_ROOT="${install_root}" \
    docker compose "${compose_args[@]}" "$@"
}

服务是否为业务服务() {
  local service="$1"
  local candidate
  for candidate in "${business_service_list[@]}"; do
    [ "${candidate}" = "${service}" ] && return 0
  done
  return 1
}

生成校验清单() {
  local target_dir="$1"
  (
    cd "${target_dir}"
    find . -type f ! -name 'SHA256SUMS' -print0 | LC_ALL=C sort -z | xargs -0 sha256sum
  ) > "${target_dir}/SHA256SUMS"
}

校验备份目录() {
  local candidate="$1"

  [ -n "${candidate}" ] || 错误退出 "请通过 --backup 指定备份目录。"
  [ -d "${candidate}" ] || 错误退出 "未找到备份目录：${candidate}"
  backup_path="$(cd "${candidate}" && pwd -P)"

  case "${backup_path}" in
    "${backup_root}"/*) ;;
    *) 错误退出 "备份目录必须位于 ${backup_root} 下：${backup_path}" ;;
  esac

  [ -f "${backup_path}/BACKUP_INFO" ] || 错误退出 "备份目录缺少 BACKUP_INFO，拒绝使用。"
  [ -f "${backup_path}/SHA256SUMS" ] || 错误退出 "备份目录缺少 SHA256SUMS，拒绝使用。"
  [ -s "${backup_path}/database/postgres.dump" ] || 错误退出 "备份目录缺少 PostgreSQL 逻辑备份。"
  [ -s "${backup_path}/system.zip" ] || 错误退出 "备份目录缺少系统归档。"
  [ -s "${backup_path}/redis.zip" ] || 错误退出 "备份目录缺少 Redis 归档。"
  [ -s "${backup_path}/docker-images.tar" ] || 错误退出 "备份目录缺少 Docker 镜像归档。"

  backup_format_version="$(awk -F= '$1 == "备份格式版本" { print $2; exit }' "${backup_path}/BACKUP_INFO")"
  case "${backup_format_version}" in
    V3单机系统备份v1|V3单机系统备份v2) ;;
    *) 错误退出 "备份格式版本不受支持：${backup_format_version:-未记录}" ;;
  esac

  if [ "${backup_format_version}" = "V3单机系统备份v2" ]; then
    [ -s "${backup_path}/metadata/container-snapshot.tsv" ] || 错误退出 "备份缺少容器快照清单。"
    [ -s "${backup_path}/metadata/actual-images.override.yml" ] || 错误退出 "备份缺少实际镜像覆盖文件。"
  fi
}

执行校验() {
  校验备份目录 "${backup_path}"
  echo "校验备份完整性：${backup_path}"
  (
    cd "${backup_path}"
    sha256sum -c SHA256SUMS
  )
  echo "备份完整性校验通过。"
}

读取运行中的业务服务() {
  running_business_services=()
  running_business_container_ids=()
  local service
  local container_id

  for service in "${business_service_list[@]}"; do
    container_id="$(运行Compose "${compose_profile_args[@]}" ps -q "${service}" 2>/dev/null | awk 'NF { print; exit }' || true)"
    if [ -n "${container_id}" ] && [ "$(docker inspect -f '{{.State.Status}}' "${container_id}" 2>/dev/null || true)" = "running" ]; then
      running_business_services+=("${service}")
      running_business_container_ids+=("${container_id}")
    fi
  done
}

停止业务服务() {
  echo "暂停入口、接口和任务进程，准备创建一致性备份。"
  local service
  for service in "${business_service_list[@]}"; do
    运行Compose "${compose_profile_args[@]}" stop "${service}" || true
  done
}

恢复原业务服务() {
  if [ "${#running_business_container_ids[@]}" -eq 0 ]; then
    return
  fi

  echo "恢复备份前正在运行的业务容器，不重建容器且不访问镜像仓库。"
  local container_id
  for container_id in "${running_business_container_ids[@]}"; do
    docker start "${container_id}" >/dev/null
  done
}

等待PostgreSQL就绪() {
  local attempt
  for attempt in $(seq 1 60); do
    if 运行Compose exec -T postgres pg_isready -U lianruan_app -d lianruan_crm_v3 >/dev/null 2>&1; then
      return
    fi
    sleep 2
  done
  错误退出 "PostgreSQL 未在预期时间内就绪。"
}

保存Redis数据() {
  echo "请求 Redis 将内存数据同步至磁盘。"
  运行Compose exec -T redis-state sh -c 'REDISCLI_AUTH="$(cat /run/secrets/redis_password)" redis-cli SAVE' | grep -qx 'OK'
  运行Compose exec -T redis-cache sh -c 'REDISCLI_AUTH="$(cat /run/secrets/redis_password)" redis-cli SAVE' | grep -qx 'OK'
}

写入运行元数据() {
  local target_dir="$1"
  local migration_version
  local service
  local container_id
  local container_name
  local config_image
  local image_digest
  local state
  local health
  local snapshot_file="${target_dir}/metadata/container-snapshot.tsv"
  local running_file="${target_dir}/metadata/running-containers.tsv"
  local seen_container_ids=""

  mkdir -p "${target_dir}/metadata"
  docker --version > "${target_dir}/metadata/docker-version.txt"
  docker compose version > "${target_dir}/metadata/docker-compose-version.txt"
  运行Compose "${compose_profile_args[@]}" ps --all > "${target_dir}/metadata/services-before-backup.txt"
  运行Compose "${compose_profile_args[@]}" config > "${target_dir}/metadata/docker-compose.rendered.yml"
  运行Compose "${compose_profile_args[@]}" config --images | LC_ALL=C sort -u > "${target_dir}/metadata/docker-images.txt"

  printf '服务名\t容器名\t容器ID\t声明镜像\t实际镜像摘要\t运行状态\t健康状态\n' > "${snapshot_file}"
  printf '服务名\t容器名\t容器ID\n' > "${running_file}"
  : > "${target_dir}/metadata/docker-images-actual.txt"

  for service in "${all_service_list[@]}"; do
    while IFS= read -r container_id; do
      [ -n "${container_id}" ] || continue
      case $'\n'"${seen_container_ids}"$'\n' in
        *$'\n'"${container_id}"$'\n'*) continue ;;
      esac
      seen_container_ids="${seen_container_ids}${container_id}"$'\n'

      container_name="$(docker inspect -f '{{.Name}}' "${container_id}" | sed 's#^/##')"
      config_image="$(docker inspect -f '{{.Config.Image}}' "${container_id}")"
      image_digest="$(docker inspect -f '{{.Image}}' "${container_id}")"
      state="$(docker inspect -f '{{.State.Status}}' "${container_id}")"
      health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}未配置{{end}}' "${container_id}")"
      printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
        "${service}" "${container_name}" "${container_id}" "${config_image}" "${image_digest}" "${state}" "${health}" \
        >> "${snapshot_file}"
      printf '%s\n' "${config_image}" >> "${target_dir}/metadata/docker-images-actual.txt"

      if [ "${state}" = "running" ] && 服务是否为业务服务 "${service}"; then
        printf '%s\t%s\t%s\n' "${service}" "${container_name}" "${container_id}" >> "${running_file}"
      fi
    done < <(运行Compose "${compose_profile_args[@]}" ps -aq "${service}" 2>/dev/null || true)
  done

  LC_ALL=C sort -u -o "${target_dir}/metadata/docker-images-actual.txt" "${target_dir}/metadata/docker-images-actual.txt"
  awk -F '\t' 'NR > 1 && $6 == "running" { print $1 }' "${snapshot_file}" | LC_ALL=C sort -u > "${target_dir}/metadata/running-services.txt"
  生成实际镜像覆盖文件 "${target_dir}"
  生成镜像对账 "${target_dir}"
  migration_version="$(运行Compose exec -T postgres psql -X -tAc 'SELECT COALESCE(MAX(version), '\''未记录'\'') FROM migration.schema_migrations' -U lianruan_app -d lianruan_crm_v3 2>/dev/null || true)"
  printf '%s\n' "${migration_version:-无法读取}" > "${target_dir}/metadata/database-migration-version.txt"
}

生成实际镜像覆盖文件() {
  local target_dir="$1"
  local service
  local config_image
  local snapshot_file="${target_dir}/metadata/container-snapshot.tsv"
  local output_file="${target_dir}/metadata/actual-images.override.yml"
  local written_services=""

  {
    echo 'services:'
    while IFS=$'\t' read -r service _container_name _container_id config_image _image_digest _state _health; do
      [ "${service}" != "服务名" ] || continue
      [ -n "${config_image}" ] || continue
      case $'\n'"${written_services}"$'\n' in
        *$'\n'"${service}"$'\n'*) continue ;;
      esac
      written_services="${written_services}${service}"$'\n'
      printf '  %s:\n    image: "%s"\n' "${service}" "${config_image}"
    done < "${snapshot_file}"
  } > "${output_file}"
}

生成镜像对账() {
  local target_dir="$1"
  local service
  local container_name
  local container_id
  local config_image
  local image_digest
  local state
  local health
  local expected_image
  local mismatch=false
  local snapshot_file="${target_dir}/metadata/container-snapshot.tsv"
  local expected_file="${target_dir}/metadata/docker-images.txt"
  local output_file="${target_dir}/metadata/image-reconciliation.tsv"

  printf '服务名\t容器名\t容器ID\t声明镜像\t实际镜像摘要\t运行状态\t健康状态\tCompose期望是否包含\n' > "${output_file}"
  while IFS=$'\t' read -r service container_name container_id config_image image_digest state health; do
    [ "${service}" != "服务名" ] || continue
    expected_image="否"
    if grep -Fxq "${config_image}" "${expected_file}"; then
      expected_image="是"
    else
      mismatch=true
    fi
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
      "${service}" "${container_name}" "${container_id}" "${config_image}" "${image_digest}" "${state}" "${health}" "${expected_image}" \
      >> "${output_file}"
  done < "${snapshot_file}"
  if [ "${mismatch}" = true ]; then
    image_reconciliation_status="存在不一致"
  else
    image_reconciliation_status="一致"
  fi
  printf '%s\n' "${image_reconciliation_status}" > "${target_dir}/metadata/image-reconciliation-status.txt"
}

打包系统文件() {
  local target_dir="$1"
  local install_parent
  local install_name

  install_parent="$(dirname "${install_root}")"
  install_name="$(basename "${install_root}")"
  echo "归档 V3 安装目录、配置、密钥和业务文件。"
  (
    cd "${install_parent}"
    zip -qr -X "${target_dir}/system.zip" "${install_name}" \
      -x "${install_name}/data/postgres/*" \
      -x "${install_name}/data/redis-state/*" \
      -x "${install_name}/data/redis-cache/*" \
      -x "${install_name}/backups/*" \
      -x "${install_name}/logs/*" \
      -x "${install_name}/runtime/docker-data/*"
  )
}

打包Redis数据() {
  local target_dir="$1"

  echo "归档 Redis 持久化数据。"
  (
    cd "${install_root}"
    zip -qr -X "${target_dir}/redis.zip" data/redis-state data/redis-cache
  )
}

导出PostgreSQL() {
  local target_dir="$1"

  echo "导出 PostgreSQL 一致性逻辑备份。"
  运行Compose exec -T postgres pg_dump \
    -U lianruan_app \
    -d lianruan_crm_v3 \
    --format=custom \
    --no-owner \
    --no-acl > "${target_dir}/database/postgres.dump"
  [ -s "${target_dir}/database/postgres.dump" ] || 错误退出 "PostgreSQL 逻辑备份为空。"
}

导出Docker镜像() {
  local target_dir="$1"
  local -a images=()
  local image

  while IFS= read -r image; do
    [ -n "${image}" ] || continue
    docker image inspect "${image}" >/dev/null 2>&1 || 错误退出 "实际运行容器引用的镜像不存在，无法创建可离线恢复的备份：${image}"
    images+=("${image}")
  done < "${target_dir}/metadata/docker-images-actual.txt"

  [ "${#images[@]}" -gt 0 ] || 错误退出 "未读取到实际容器镜像清单。"
  echo "导出实际容器使用的 Docker 镜像。"
  docker save --output "${target_dir}/docker-images.tar" "${images[@]}"
}

执行备份() {
  local backup_type="${1:-manual}"

  (
    local timestamp
    local target_dir
    local quiesced=false
    local status=0

    清理备份过程() {
      status="$?"
      if [ "${quiesced}" = true ]; then
        set +e
        恢复原业务服务
      fi
      exit "${status}"
    }

    trap 清理备份过程 EXIT
    检查安装目录
    进入编排目录
    运行Compose exec -T postgres pg_isready -U lianruan_app -d lianruan_crm_v3 >/dev/null || 错误退出 "PostgreSQL 未运行，无法创建一致性备份。"

    timestamp="$(date '+%Y%m%d-%H%M%S')"
    target_dir="${backup_root}/${timestamp}-${backup_type}"
    mkdir -p "${backup_root}"
    chmod 700 "${backup_root}"
    [ ! -e "${target_dir}" ] || 错误退出 "备份目录已存在：${target_dir}"
    umask 077
    mkdir -p "${target_dir}/database"
    chmod 700 "${target_dir}" "${target_dir}/database"

    echo "开始创建 V3 系统备份：${target_dir}"
    读取运行中的业务服务
    写入运行元数据 "${target_dir}"
    导出Docker镜像 "${target_dir}"
    停止业务服务
    quiesced=true
    等待PostgreSQL就绪
    保存Redis数据
    导出PostgreSQL "${target_dir}"
    打包Redis数据 "${target_dir}"
    打包系统文件 "${target_dir}"
    恢复原业务服务
    quiesced=false

    cat > "${target_dir}/BACKUP_INFO" <<EOF
备份格式版本=V3单机系统备份v2
备份时间=$(date '+%Y-%m-%d %H:%M:%S %z')
安装目录=${install_root}
备份类型=${backup_type}
系统归档=system.zip
Redis归档=redis.zip
数据库归档=database/postgres.dump
Docker镜像归档=docker-images.tar
实际容器镜像覆盖文件=metadata/actual-images.override.yml
容器快照清单=metadata/container-snapshot.tsv
镜像对账状态=${image_reconciliation_status}
说明=系统归档不包含PostgreSQL原始目录、Redis原始目录、历史备份、运行日志和Docker运行时数据；前两者由独立一致性归档替代。备份后的原机恢复直接启动原容器，不重建容器且不访问镜像仓库；跨机器还原使用实际容器镜像覆盖文件并禁止拉取镜像。
EOF
    生成校验清单 "${target_dir}"
    echo "系统备份完成：${target_dir}"
    echo "请妥善保管该目录；其中包含生产配置和密钥，目录权限已限制为仅 root 可访问。"
  )
}

停止全部服务() {
  echo "停止 V3 全部服务。"
  local service
  for service in "${business_service_list[@]}"; do
    运行Compose "${compose_profile_args[@]}" stop "${service}" || true
  done
  运行Compose stop redis-cache redis-state || true
  运行Compose stop postgres || true
}

恢复系统文件() {
  local restore_timestamp="$1"
  local install_parent
  local rollback_dir

  install_parent="$(dirname "${install_root}")"
  rollback_dir="${install_root}.pre-restore-${restore_timestamp}"
  [ ! -e "${rollback_dir}" ] || 错误退出 "当前环境回退目录已存在，拒绝覆盖：${rollback_dir}"

  echo "保留当前安装目录：${rollback_dir}"
  mv "${install_root}" "${rollback_dir}"
  echo "恢复安装目录归档。"
  unzip -q "${backup_path}/system.zip" -d "${install_parent}"
  [ -d "${install_root}" ] || 错误退出 "系统归档解压后未生成安装目录：${install_root}"
  echo "恢复 Redis 持久化数据。"
  unzip -q "${backup_path}/redis.zip" -d "${install_root}"
  printf '%s\n' "${rollback_dir}" > "${install_root}/RESTORE_ROLLBACK_DIRECTORY"
}

恢复PostgreSQL() {
  进入编排目录
  echo "启动 PostgreSQL 以恢复逻辑备份。"
  运行Compose up -d --pull never postgres
  等待PostgreSQL就绪
  echo "恢复 PostgreSQL 数据库对象与数据。"
  运行Compose exec -T postgres pg_restore \
    -U lianruan_app \
    -d lianruan_crm_v3 \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    --exit-on-error < "${backup_path}/database/postgres.dump"
}

读取备份前运行服务() {
  local snapshot_file="${backup_path}/metadata/container-snapshot.tsv"
  local service

  running_business_services=()
  if [ "${backup_format_version}" != "V3单机系统备份v2" ]; then
    running_business_services=(api-1 api-2 worker nginx)
    return
  fi
  while IFS=$'\t' read -r service _container_name _container_id _config_image _image_digest state _health; do
    [ "${service}" != "服务名" ] || continue
    [ "${state}" = "running" ] || continue
    服务是否为业务服务 "${service}" || continue
    running_business_services+=("${service}")
  done < "${snapshot_file}"
}

启动还原后服务() {
  local snapshot_file="${backup_path}/metadata/running-containers.tsv"
  local container_id
  local service
  local all_original_containers_exist=true
  local start_failed=false
  local -a original_container_ids=()

  echo "启动还原后的 Redis 服务，不访问镜像仓库。"
  运行Compose up -d --pull never redis-state redis-cache
  读取备份前运行服务
  if [ "${#running_business_services[@]}" -eq 0 ]; then
    echo "备份前没有运行中的入口、接口或任务进程，保持其停止状态。"
    return
  fi

  if [ "${backup_format_version}" = "V3单机系统备份v2" ] && [ -s "${snapshot_file}" ]; then
    while IFS=$'\t' read -r service _container_name container_id; do
      [ "${service}" != "服务名" ] || continue
      [ -n "${container_id}" ] || continue
      original_container_ids+=("${container_id}")
      if ! docker inspect "${container_id}" >/dev/null 2>&1; then
        all_original_containers_exist=false
      fi
    done < "${snapshot_file}"

    if [ "${all_original_containers_exist}" = true ] && [ "${#original_container_ids[@]}" -gt 0 ]; then
      echo "优先启动备份前的原业务容器，避免重新创建容器。"
      for container_id in "${original_container_ids[@]}"; do
        if ! docker start "${container_id}" >/dev/null 2>&1; then
          start_failed=true
        fi
      done
      if [ "${start_failed}" = false ]; then
        return
      fi
      echo "部分原业务容器无法启动，改用实际镜像覆盖文件重新创建。" >&2
    fi
  fi

  echo "按备份前运行状态启动入口、接口和任务进程，不执行数据库迁移。"
  运行Compose "${compose_profile_args[@]}" up -d --pull never "${running_business_services[@]}"
}

执行还原() {
  local restore_timestamp

  [ "${confirm_value}" = "RESTORE" ] || 错误退出 "还原会覆盖当前系统和数据库，请追加 --confirm RESTORE。"
  校验备份目录 "${backup_path}"
  执行校验
  检查安装目录

  if [ "${skip_pre_restore_backup}" = false ]; then
    echo "先创建当前环境的回退备份。"
    执行备份 "restore-pre"
  else
    echo "已明确跳过还原前备份；请确认已有可用的当前环境回退方案。"
  fi

  restore_timestamp="$(date '+%Y%m%d-%H%M%S')"
  进入编排目录
  停止全部服务
  echo "加载备份中的 Docker 镜像。"
  docker load --input "${backup_path}/docker-images.tar"
  恢复系统文件 "${restore_timestamp}"
  if [ "${backup_format_version}" = "V3单机系统备份v2" ]; then
    compose_override_file="${backup_path}/metadata/actual-images.override.yml"
  else
    compose_override_file=""
    echo "警告：该备份为 v1 格式，未记录实际容器镜像；还原将按归档内 Compose 配置并使用 --pull never 启动。" >&2
  fi
  恢复PostgreSQL

  echo "启动还原后的 V3 服务。"
  启动还原后服务
  if [ "${#running_business_services[@]}" -gt 0 ]; then
    INSTALL_ROOT="${install_root}" "${install_root}/scripts/health-check.sh"
  else
    echo "备份前业务容器未运行，跳过 HTTP 健康检查。"
  fi
  echo "系统还原完成。当前环境的目录回退副本：${install_root}.pre-restore-${restore_timestamp}"
}

if [ "${SYSTEM_BACKUP_RESTORE_SOURCE_ONLY:-false}" != true ]; then
  if [ "$#" -gt 0 ]; then
    shift
  fi

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --backup)
        backup_path="${2:-}"
        shift 2
        ;;
      --confirm)
        confirm_value="${2:-}"
        shift 2
        ;;
      --skip-pre-restore-backup)
        skip_pre_restore_backup=true
        shift
        ;;
      --help|-h)
        mode="help"
        shift
        ;;
      *)
        错误退出 "未知参数：$1"
        ;;
    esac
  done

  case "${mode}" in
    backup)
      检查执行权限
      检查命令
      执行备份 "manual"
      ;;
    verify)
      检查执行权限
      检查命令
      执行校验
      ;;
    restore)
      检查执行权限
      检查命令
      执行还原
      ;;
    help|--help|-h|"")
      显示帮助
      ;;
    *)
      错误退出 "未知命令：${mode}，可用命令为 backup、verify、restore。"
      ;;
  esac
fi
