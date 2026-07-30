#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
package_root="$(cd "${script_dir}/.." && pwd)"
install_root="${INSTALL_ROOT:-/opt/lianruan-crm-v3}"
runtime_root="${package_root}/runtime"
timestamp="$(date '+%Y%m%d-%H%M%S')"
log_dir="${install_root}/logs/install"
log_file="${log_dir}/install-runtime-${timestamp}.log"

docker_version="${V3_DOCKER_VERSION:-27.5.1}"
compose_version="${V3_COMPOSE_VERSION:-v2.32.4}"
docker_bin_dir="${runtime_root}/docker-bin/docker"
compose_file="${runtime_root}/compose/docker-compose-linux-x86_64-${compose_version}"
docker_data_root="${DOCKER_DATA_ROOT:-${install_root}/runtime/docker-data}"
docker_binaries=(containerd containerd-shim-runc-v2 ctr docker dockerd docker-init docker-proxy runc)

if [ "$(id -u)" -ne 0 ]; then
  echo "请使用root或sudo执行运行时安装脚本。" >&2
  exit 1
fi

mkdir -p "${log_dir}"
exec > >(tee -a "${log_file}") 2>&1

echo "阶段9离线运行时安装开始。"
echo "日志文件：${log_file}"
echo "安装目录：${install_root}"
echo "Docker数据目录：${docker_data_root}"

if [ "$(uname -m)" != "x86_64" ]; then
  echo "当前服务器不是x86_64架构，阶段9运行时只支持Linux x86_64。" >&2
  exit 1
fi

if [ -f "${runtime_root}/sha256sum.txt" ]; then
  echo "开始校验离线运行时文件。"
  (cd "${runtime_root}" && sha256sum -c sha256sum.txt)
else
  echo "未找到运行时校验文件：${runtime_root}/sha256sum.txt" >&2
  exit 1
fi

校验运行时文件() {
  local binary_name
  local compose_size

  if [ -d "${docker_bin_dir}" ]; then
    for binary_name in "${docker_binaries[@]}"; do
      if [ ! -f "${docker_bin_dir}/${binary_name}" ]; then
        echo "Docker免解压目录缺少二进制：${binary_name}" >&2
        exit 1
      fi
    done
    echo "Docker免解压目录校验通过：${docker_bin_dir}"
  else
    echo "安装包内缺少Docker免解压目录：${docker_bin_dir}" >&2
    echo "请重新使用最新打包脚本生成ZIP离线安装包。" >&2
    exit 1
  fi

  if [ ! -f "${compose_file}" ]; then
    echo "未找到Docker Compose离线文件：${compose_file}" >&2
    exit 1
  fi
  compose_size="$(wc -c < "${compose_file}" | tr -d ' ')"
  if [ "${compose_size}" -lt 50000000 ]; then
    echo "Docker Compose离线文件体积异常，疑似下载不完整：${compose_file}" >&2
    exit 1
  fi
  if command -v file >/dev/null 2>&1; then
    file "${compose_file}" | grep -q 'ELF 64-bit' || {
      echo "Docker Compose离线文件不是Linux x86_64可执行文件：${compose_file}" >&2
      exit 1
    }
  fi
}

安装Docker静态运行时() {
  local binary_name
  local docker_source_dir="${docker_bin_dir}"

  if command -v docker >/dev/null 2>&1; then
    echo "检测到已有Docker，跳过Docker二进制安装：$(command -v docker)"
    return
  fi

  if [ -d "${docker_source_dir}" ]; then
    echo "使用安装包内预解压Docker二进制：${docker_source_dir}"
  else
    echo "安装包内缺少Docker免解压目录：${docker_bin_dir}" >&2
    echo "请重新使用最新打包脚本生成ZIP离线安装包。" >&2
    exit 1
  fi

  for binary_name in "${docker_binaries[@]}"; do
    if [ ! -f "${docker_source_dir}/${binary_name}" ]; then
      echo "Docker离线包缺少二进制：${binary_name}" >&2
      exit 1
    fi
    install -m 755 "${docker_source_dir}/${binary_name}" "/usr/local/bin/${binary_name}"
  done

  if ! getent group docker >/dev/null 2>&1; then
    groupadd --system docker
  fi

  mkdir -p /etc/docker "${docker_data_root}"
  if [ ! -f /etc/docker/daemon.json ]; then
    cat > /etc/docker/daemon.json <<EOF
{
  "data-root": "${docker_data_root}",
  "storage-driver": "overlay2",
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "100m",
    "max-file": "5"
  }
}
EOF
  else
    echo "检测到已有 /etc/docker/daemon.json，跳过覆盖。"
  fi

  cat > /etc/systemd/system/docker.service <<'EOF'
[Unit]
Description=Docker Application Container Engine
Documentation=https://docs.docker.com
After=network-online.target firewalld.service containerd.service
Wants=network-online.target
Requires=docker.socket

[Service]
Type=notify
ExecStart=/usr/local/bin/dockerd -H fd://
ExecReload=/bin/kill -s HUP $MAINPID
TimeoutStartSec=0
RestartSec=2
Restart=always
StartLimitBurst=3
StartLimitInterval=60s
LimitNOFILE=infinity
LimitNPROC=infinity
LimitCORE=infinity
TasksMax=infinity
Delegate=yes
KillMode=process
OOMScoreAdjust=-500

[Install]
WantedBy=multi-user.target
EOF

  cat > /etc/systemd/system/docker.socket <<'EOF'
[Unit]
Description=Docker Socket for the API

[Socket]
ListenStream=/var/run/docker.sock
SocketMode=0660
SocketUser=root
SocketGroup=docker

[Install]
WantedBy=sockets.target
EOF

  systemctl daemon-reload
  systemctl enable docker.socket docker.service
}

安装Compose插件() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    echo "检测到已有Docker Compose，跳过安装。"
    docker compose version
    return
  fi

  if [ ! -f "${compose_file}" ]; then
    echo "未找到Docker Compose离线文件：${compose_file}" >&2
    exit 1
  fi

  mkdir -p /usr/local/lib/docker/cli-plugins
  install -m 755 "${compose_file}" /usr/local/lib/docker/cli-plugins/docker-compose
  echo "Docker Compose插件已安装到 /usr/local/lib/docker/cli-plugins/docker-compose"
}

校验运行时文件
安装Docker静态运行时
安装Compose插件

echo "启动Docker服务。"
systemctl daemon-reload
systemctl enable docker.socket docker.service
systemctl start docker

echo "验证Docker。"
docker version
docker info

echo "验证Docker Compose。"
docker compose version

echo "阶段9离线运行时安装完成。"
