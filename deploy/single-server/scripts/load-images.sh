#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
package_root="$(cd "${script_dir}/.." && pwd)"
image_dir="${package_root}/images"

if [ ! -d "${image_dir}" ]; then
  echo "未找到镜像目录：${image_dir}" >&2
  exit 1
fi

if [ -f "${image_dir}/sha256sum.txt" ]; then
  echo "开始校验离线镜像包。"
  (cd "${image_dir}" && sha256sum -c sha256sum.txt)
fi

for image_tar in "${image_dir}"/*.tar; do
  [ -e "${image_tar}" ] || {
    echo "未找到任何镜像tar文件。" >&2
    exit 1
  }
  echo "加载镜像：${image_tar}"
  docker load -i "${image_tar}"
done

echo "离线镜像加载完成。"
