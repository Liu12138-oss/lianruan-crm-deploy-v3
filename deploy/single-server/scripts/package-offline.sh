#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "${script_dir}/../../.." && pwd)"
version_tag="${V3_IMAGE_TAG:-3.0.0-alpha.1}"
package_name="lianruan-crm-v3-offline-${version_tag}"
output_root="${project_root}/tmp/phase7-package"
output_dir="${output_root}/${package_name}"

if ! ls "${project_root}/deploy/single-server/images/"*.tar >/dev/null 2>&1; then
  echo "未找到离线镜像tar文件，请先执行 deploy/single-server/scripts/save-images.sh。" >&2
  exit 1
fi

rm -rf "${output_dir}"
mkdir -p "${output_dir}"

cp -R "${project_root}/deploy/single-server/compose" "${output_dir}/compose"
cp -R "${project_root}/deploy/single-server/config" "${output_dir}/config"
cp -R "${project_root}/deploy/single-server/images" "${output_dir}/images"
cp -R "${project_root}/deploy/single-server/scripts" "${output_dir}/scripts"
cp -R "${project_root}/deploy/single-server/docs" "${output_dir}/docs" 2>/dev/null || mkdir -p "${output_dir}/docs"
cp "${project_root}/deploy/single-server/README.md" "${output_dir}/README.md"
cp "${project_root}/docs/deployment/V3版本生产部署文档.md" "${output_dir}/docs/V3版本生产部署文档.md"

find "${output_dir}/scripts" -type f -name "*.sh" -exec chmod 750 {} \;

cd "${output_root}"
tar -czf "${package_name}.tar.gz" "${package_name}"

if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "${package_name}.tar.gz" > "${package_name}.tar.gz.sha256"
else
  shasum -a 256 "${package_name}.tar.gz" > "${package_name}.tar.gz.sha256"
fi

echo "离线安装包已生成：${output_root}/${package_name}.tar.gz"
echo "安装包校验文件：${output_root}/${package_name}.tar.gz.sha256"
