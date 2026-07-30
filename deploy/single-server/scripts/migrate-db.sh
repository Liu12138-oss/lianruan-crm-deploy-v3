#!/usr/bin/env bash
set -euo pipefail

install_root="${INSTALL_ROOT:-/opt/lianruan-crm-v3}"
compose_dir="${install_root}/compose"
migration_dir="${install_root}/database/migrations"
stage8_dir="${install_root}/data/migration/stage8-official"
timestamp="$(date '+%Y%m%d-%H%M%S')"
log_dir="${install_root}/logs/install"
log_file="${log_dir}/migrate-db-${timestamp}.log"

mkdir -p "${log_dir}"
exec > >(tee -a "${log_file}") 2>&1

echo "阶段9数据库迁移开始。"
echo "安装目录：${install_root}"
echo "迁移目录：${migration_dir}"
echo "迁移日志：${log_file}"

if [ ! -d "${compose_dir}" ]; then
  echo "未找到Compose目录：${compose_dir}" >&2
  exit 1
fi

if [ ! -d "${migration_dir}" ]; then
  echo "未找到数据库迁移目录：${migration_dir}" >&2
  exit 1
fi

cd "${compose_dir}"

for _ in $(seq 1 60); do
  if docker compose exec -T postgres pg_isready -U lianruan_app -d lianruan_crm_v3 >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

docker compose exec -T postgres pg_isready -U lianruan_app -d lianruan_crm_v3 >/dev/null

执行SQL文件() {
  local sql_file="$1"
  local version
  local exists
  local checksum

  version="$(basename "${sql_file}" .sql)"
  checksum="$(sha256sum "${sql_file}" | awk '{print $1}')"
  exists="$(docker compose exec -T postgres psql -U lianruan_app -d lianruan_crm_v3 -tAc \
    "SELECT COALESCE((SELECT true FROM migration.schema_migrations WHERE version='${version}'), false)" 2>/dev/null || echo "f")"

  if [ "${exists}" = "t" ]; then
    echo "跳过已执行迁移：${version}"
    return
  fi

  echo "执行数据库迁移：${version}"
  docker compose exec -T postgres psql -U lianruan_app -d lianruan_crm_v3 -v ON_ERROR_STOP=1 -f - < "${sql_file}"
  docker compose exec -T postgres psql -U lianruan_app -d lianruan_crm_v3 -v ON_ERROR_STOP=1 -c \
    "INSERT INTO migration.schema_migrations(version, description, checksum_sha256)
     VALUES ('${version}', '${version}', '${checksum}')
     ON CONFLICT (version) DO UPDATE
     SET checksum_sha256=EXCLUDED.checksum_sha256, applied_at=now();"
}

装载阶段8暂存包() {
  local count

  if [ ! -d "${stage8_dir}" ]; then
    echo "未发现阶段8官方暂存包，跳过暂存装载。"
    return
  fi

  if [ ! -f "${stage8_dir}/sql/01-load-v2-raw-records.sql" ]; then
    echo "阶段8官方暂存包缺少装载SQL，跳过暂存装载。"
    return
  fi

  count="$(docker compose exec -T postgres psql -U lianruan_app -d lianruan_crm_v3 -tAc \
    "SELECT COUNT(*) FROM migration.v2_raw_records r JOIN migration.migration_batches b ON b.id=r.batch_id WHERE b.batch_code='S8-RUN-20260727-001'")"
  if [ "${count}" != "0" ]; then
    echo "阶段8官方暂存包已装载，记录数：${count}"
    return
  fi

  echo "开始装载阶段8官方暂存包。"
  docker compose cp "${stage8_dir}/load/." postgres:/tmp/stage8-load/
  docker compose cp "${stage8_dir}/sql/." postgres:/tmp/stage8-sql/
  docker compose exec -T postgres sh -lc \
    "cd /tmp/stage8-sql && mkdir -p load && cp /tmp/stage8-load/* load/ && psql -U lianruan_app -d lianruan_crm_v3 -v ON_ERROR_STOP=1 \
      -v stage8_batch_code='S8-RUN-20260727-001' \
      -f 00-prepare-migration-staging.sql && psql -U lianruan_app -d lianruan_crm_v3 -v ON_ERROR_STOP=1 \
      -v stage8_batch_code='S8-RUN-20260727-001' \
      -v stage8_source_snapshot_sha256='0c673f14cba14d765ba9221954463348975434b98febee078ae83d36309d1a9a' \
      -v stage8_source_taken_at='2026-07-27T02:21:47.193Z' \
      -v stage8_mapping_version='v2-entity-mapping@2026-07-23' \
      -v stage8_total_records='1091' \
      -f 01-load-v2-raw-records.sql && psql -U lianruan_app -d lianruan_crm_v3 -v ON_ERROR_STOP=1 \
      -v stage8_batch_code='S8-RUN-20260727-001' \
      -f 02-verify-staging.sql"
}

for sql_file in "${migration_dir}"/*.sql; do
  sql_name="$(basename "${sql_file}")"
  if [[ "${sql_name}" == *"S8_004"* ]] || [[ "${sql_name}" == *"S9_"* ]]; then
    continue
  fi
  执行SQL文件 "${sql_file}"
done

装载阶段8暂存包

if ls "${migration_dir}"/*S8_004*.sql >/dev/null 2>&1; then
  执行SQL文件 "$(ls "${migration_dir}"/*S8_004*.sql | head -n 1)"
fi

for sql_file in "${migration_dir}"/*S9_*.sql; do
  if [ -f "${sql_file}" ]; then
    执行SQL文件 "${sql_file}"
  fi
done

echo "阶段9数据库迁移完成。"
echo "迁移日志：${log_file}"
