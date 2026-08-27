#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "${script_dir}/../../.." && pwd)"
migration_script="${project_root}/deploy/single-server/scripts/migrate-db.sh"
temp_dir="$(mktemp -d)"
install_dir="${temp_dir}/install"
bin_dir="${temp_dir}/bin"
output_file="${temp_dir}/迁移输出.log"

清理() {
  rm -rf "${temp_dir}"
}
trap 清理 EXIT

失败() {
  echo "数据库迁移顺序测试失败：$*" >&2
  exit 1
}

[ -f "${migration_script}" ] || 失败 "未找到正式部署迁移脚本。"
mkdir -p "${install_dir}/compose" "${install_dir}/database/migrations" "${bin_dir}"

for file_name in \
  20260723_S2_001_基础.sql \
  20260727_S8_004_正式落表.sql \
  20260811_S9_001_后置.sql \
  20260813_S10_001_组织架构.sql \
  20260827_S10_009_渠道成员统一业务角色.sql \
  20260827_S10_010_任职编辑一致性修正.sql \
  20260827_S10_011_组织成员一致性与交接授权留痕.sql; do
  printf 'SELECT 1;\n' > "${install_dir}/database/migrations/${file_name}"
done

printf '%s\n' \
  '#!/usr/bin/env bash' \
  'set -euo pipefail' \
  'if [[ "$*" == *"psql"*"-tAc"* ]]; then' \
  '  printf "f\n"' \
  'fi' \
  'exit 0' > "${bin_dir}/docker"
chmod 750 "${bin_dir}/docker"

PATH="${bin_dir}:${PATH}" INSTALL_ROOT="${install_dir}" bash "${migration_script}" > "${output_file}"

读取行号() {
  local migration_name="$1"
  awk -v migration_name="${migration_name}" 'index($0, "执行数据库迁移：" migration_name) { print NR; exit }' "${output_file}"
}

base_line="$(读取行号 '20260723_S2_001_基础')"
stage8_line="$(读取行号 '20260727_S8_004_正式落表')"
stage9_line="$(读取行号 '20260811_S9_001_后置')"
stage10_line="$(读取行号 '20260813_S10_001_组织架构')"
stage10_009_line="$(读取行号 '20260827_S10_009_渠道成员统一业务角色')"
stage10_010_line="$(读取行号 '20260827_S10_010_任职编辑一致性修正')"
stage10_011_line="$(读取行号 '20260827_S10_011_组织成员一致性与交接授权留痕')"

for line_number in \
  "${base_line}" "${stage8_line}" "${stage9_line}" "${stage10_line}" \
  "${stage10_009_line}" "${stage10_010_line}" "${stage10_011_line}"; do
  [ -n "${line_number}" ] || 失败 "存在未执行的测试迁移。"
done

if ! [ "${base_line}" -lt "${stage8_line}" ] ||
  ! [ "${stage8_line}" -lt "${stage9_line}" ] ||
  ! [ "${stage9_line}" -lt "${stage10_line}" ] ||
  ! [ "${stage10_line}" -lt "${stage10_009_line}" ] ||
  ! [ "${stage10_009_line}" -lt "${stage10_010_line}" ] ||
  ! [ "${stage10_010_line}" -lt "${stage10_011_line}" ]; then
  sed -n '1,160p' "${output_file}" >&2
  失败 "迁移顺序不是基础迁移、阶段8正式落表、S9、既有 S10、S10_009、S10_010、S10_011。"
fi

echo "数据库迁移顺序测试通过。"
