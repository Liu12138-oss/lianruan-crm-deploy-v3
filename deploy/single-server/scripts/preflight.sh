#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
package_root="$(cd "${script_dir}/.." && pwd)"
install_root="${INSTALL_ROOT:-/opt/lianruan-crm-v3}"
timestamp="$(date '+%Y%m%d-%H%M%S')"
log_dir="${install_root}/logs/install"
log_file="${log_dir}/preflight-${timestamp}.log"

if [ "$(id -u)" -ne 0 ]; then
  echo "请使用root或sudo执行检测脚本。" >&2
  exit 1
fi

mkdir -p "${log_dir}"
exec > >(tee -a "${log_file}") 2>&1

echo "阶段9安装前检测开始。"
echo "日志文件：${log_file}"

arch="$(uname -m)"
echo "服务器架构：${arch}"
if [ "${arch}" != "x86_64" ]; then
  echo "当前服务器不是x86_64架构，阶段9离线运行时只支持欧拉Linux x86_64。" >&2
  exit 1
fi

echo "内核信息：$(uname -a)"
if [ -f /etc/os-release ]; then
  echo "操作系统信息："
  cat /etc/os-release
  if ! grep -Eiq 'openEuler|Euler' /etc/os-release; then
    echo "提示：当前系统不是欧拉标识，继续安装前请确认兼容性。"
  fi
else
  echo "未找到 /etc/os-release，无法记录系统版本。"
fi

for command_name in sha256sum openssl; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "缺少命令：${command_name}" >&2
    exit 1
  fi
done

if command -v tar >/dev/null 2>&1; then
  echo "检测到tar命令：$(command -v tar)"
elif [ -d "${package_root}/runtime/docker-bin/docker" ]; then
  echo "未检测到tar命令，将使用安装包内预解压Docker二进制继续安装。"
else
  echo "缺少命令：tar，且安装包内没有 runtime/docker-bin/docker 免tar目录。" >&2
  exit 1
fi

if ! command -v systemctl >/dev/null 2>&1; then
  echo "缺少systemctl，无法注册或启动Docker服务。" >&2
  exit 1
fi

echo "安装目录磁盘："
df -h "$(dirname "${install_root}")" 2>/dev/null || df -h /

if command -v ss >/dev/null 2>&1; then
  echo "80端口占用情况："
  ss -ltnp 2>/dev/null | grep ':80 ' || echo "80端口当前未监听。"
fi

if command -v firewall-cmd >/dev/null 2>&1; then
  echo "firewalld状态："
  firewall-cmd --state 2>/dev/null || true
fi

if command -v docker >/dev/null 2>&1; then
  echo "检测到已有Docker：$(command -v docker)"
  docker version || true
else
  echo "未检测到Docker，将由install-runtime.sh尝试离线安装。"
fi

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  echo "检测到已有Docker Compose："
  docker compose version || true
else
  echo "未检测到可用Docker Compose，将由install-runtime.sh尝试离线安装。"
fi

for package_name in podman containerd runc; do
  if command -v rpm >/dev/null 2>&1 && rpm -q "${package_name}" >/dev/null 2>&1; then
    echo "提示：检测到可能和Docker运行时有边界关系的系统包：${package_name}"
  fi
done

if [ -d "${package_root}/runtime" ]; then
  echo "运行时目录存在：${package_root}/runtime"
else
  echo "未找到运行时目录：${package_root}/runtime" >&2
  exit 1
fi

echo "阶段9安装前检测完成。"
