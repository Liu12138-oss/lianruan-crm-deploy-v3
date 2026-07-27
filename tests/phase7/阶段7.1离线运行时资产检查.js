#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const childProcess = require("child_process");

const 项目根目录 = path.resolve(__dirname, "../..");

const 必需文件 = [
  "deploy/single-server/runtime/README.md",
  "deploy/single-server/runtime/docker/.gitkeep",
  "deploy/single-server/runtime/docker-bin/docker/.gitkeep",
  "deploy/single-server/runtime/compose/.gitkeep",
  "deploy/single-server/scripts/download-runtime.sh",
  "deploy/single-server/scripts/preflight.sh",
  "deploy/single-server/scripts/install-runtime.sh",
  "deploy/single-server/scripts/install-all.sh",
  "docs/stage-records/阶段7.1-欧拉x86离线运行时集成交付记录.md",
];

const 必需脚本 = [
  "deploy/single-server/scripts/download-runtime.sh",
  "deploy/single-server/scripts/preflight.sh",
  "deploy/single-server/scripts/install-runtime.sh",
  "deploy/single-server/scripts/install-all.sh",
  "deploy/single-server/scripts/package-offline.sh",
];

function 读取文本(相对路径) {
  return fs.readFileSync(path.join(项目根目录, 相对路径), "utf8");
}

function 断言(条件, 消息) {
  if (!条件) {
    console.error(`阶段7.1离线运行时资产检查失败：${消息}`);
    process.exit(1);
  }
}

function 文件存在(相对路径) {
  return fs.existsSync(path.join(项目根目录, 相对路径));
}

function 包含(相对路径, 片段) {
  return 读取文本(相对路径).includes(片段);
}

function 执行命令(命令, 参数) {
  childProcess.execFileSync(命令, 参数, {
    cwd: 项目根目录,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

for (const 文件 of 必需文件) {
  断言(文件存在(文件), `缺少文件：${文件}`);
}

for (const 脚本 of 必需脚本) {
  const 内容 = 读取文本(脚本);
  断言(内容.startsWith("#!/usr/bin/env bash\n"), `${脚本} 缺少Bash解释器声明`);
  断言(内容.includes("set -euo pipefail"), `${脚本} 未启用严格错误处理`);
  断言((fs.statSync(path.join(项目根目录, 脚本)).mode & 0o111) !== 0, `${脚本} 未设置可执行权限`);
  执行命令("bash", ["-n", 脚本]);
}

断言(
  包含("deploy/single-server/scripts/download-runtime.sh", "V3_DOCKER_VERSION:-27.5.1"),
  "运行时下载脚本未固定默认Docker 27.5.1",
);
断言(
  包含("deploy/single-server/scripts/download-runtime.sh", "V3_COMPOSE_VERSION:-v2.32.4"),
  "运行时下载脚本未固定默认Compose v2.32.4",
);
断言(包含("deploy/single-server/scripts/download-runtime.sh", "-C -"), "运行时下载脚本未启用断点续传");
断言(包含("deploy/single-server/scripts/download-runtime.sh", "50000000"), "运行时下载脚本未防止半截Compose文件进包");
断言(包含("deploy/single-server/scripts/download-runtime.sh", "docker-bin"), "运行时下载脚本未生成Docker免tar目录");
断言(包含("deploy/single-server/scripts/preflight.sh", "x86_64"), "安装前检测未限制x86_64架构");
断言(包含("deploy/single-server/scripts/preflight.sh", "docker-bin"), "安装前检测未支持Docker免tar目录");
断言(包含("deploy/single-server/scripts/preflight.sh", "logs/install"), "安装前检测未记录日志目录");
断言(包含("deploy/single-server/scripts/install-runtime.sh", "docker.socket"), "运行时安装脚本未注册Docker socket");
断言(包含("deploy/single-server/scripts/install-runtime.sh", "docker_bin_dir"), "运行时安装脚本未支持Docker免tar目录");
断言(包含("deploy/single-server/scripts/install-runtime.sh", "docker compose version"), "运行时安装脚本未验证Compose");
断言(
  包含("deploy/single-server/scripts/install-runtime.sh", "/usr/local/lib/docker/cli-plugins/docker-compose"),
  "运行时安装脚本未使用Docker CLI插件目录",
);
断言(包含("deploy/single-server/scripts/install-all.sh", "install-runtime.sh"), "一键安装脚本未串联运行时安装");
断言(包含("deploy/single-server/scripts/install-all.sh", "health-check.sh"), "一键安装脚本未串联健康检查");
断言(包含("deploy/single-server/scripts/install-all.sh", "logs/install"), "一键安装脚本未记录安装日志");
断言(包含("deploy/single-server/scripts/package-offline.sh", "runtime"), "离线打包脚本未包含运行时目录");
断言(包含("deploy/single-server/scripts/package-offline.sh", "docker-bin"), "离线打包脚本未生成Docker免tar目录");
断言(包含("deploy/single-server/scripts/package-offline.sh", "V3_PACKAGE_FORMAT:-zip"), "离线打包脚本未默认生成ZIP安装包");
断言(包含("deploy/single-server/scripts/package-offline.sh", "zip -qr -X"), "离线打包脚本未使用ZIP打包");
断言(包含("deploy/single-server/README.md", "install-all.sh"), "部署说明未给出一键安装入口");
断言(包含("deploy/single-server/docs/离线安装说明.md", "unzip"), "离线安装说明未给出ZIP解压命令");
断言(包含("deploy/single-server/docs/离线安装说明.md", "logs/install"), "离线安装说明未说明安装日志");

const 忽略规则 = 读取文本(".gitignore");
断言(忽略规则.includes("deploy/single-server/runtime/docker/*.tgz"), "Docker运行时大文件未加入忽略规则");
断言(忽略规则.includes("deploy/single-server/runtime/docker-bin/docker/*"), "Docker免tar大文件未加入忽略规则");
断言(忽略规则.includes("deploy/single-server/runtime/compose/docker-compose-linux-*"), "Compose运行时大文件未加入忽略规则");

console.log("阶段7.1离线运行时资产检查通过。");
