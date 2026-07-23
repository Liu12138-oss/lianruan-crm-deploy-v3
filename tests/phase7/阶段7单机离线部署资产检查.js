#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const 项目根目录 = path.resolve(__dirname, '../..');

const 必需文件 = [
  '.dockerignore',
  'deploy/single-server/README.md',
  'deploy/single-server/docker/api.Dockerfile',
  'deploy/single-server/docker/worker.Dockerfile',
  'deploy/single-server/docker/web.Dockerfile',
  'deploy/single-server/compose/docker-compose.yml',
  'deploy/single-server/config/nginx/default.conf',
  'deploy/single-server/config/deploy.env.example',
  'deploy/single-server/config/v3.env.template',
  'deploy/single-server/docs/离线安装说明.md',
  'docs/stage-records/阶段7-单机离线部署资产交付记录.md',
];

const 必需脚本 = [
  'deploy/single-server/scripts/build-images.sh',
  'deploy/single-server/scripts/save-images.sh',
  'deploy/single-server/scripts/package-offline.sh',
  'deploy/single-server/scripts/generate-secrets.sh',
  'deploy/single-server/scripts/load-images.sh',
  'deploy/single-server/scripts/install.sh',
  'deploy/single-server/scripts/start.sh',
  'deploy/single-server/scripts/stop.sh',
  'deploy/single-server/scripts/health-check.sh',
  'deploy/single-server/scripts/backup.sh',
  'deploy/single-server/scripts/rollback.sh',
  'deploy/single-server/scripts/collect-diagnostics.sh',
];

function 读取文本(相对路径) {
  return fs.readFileSync(path.join(项目根目录, 相对路径), 'utf8');
}

function 断言(条件, 消息) {
  if (!条件) {
    console.error(`阶段7部署资产检查失败：${消息}`);
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
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

for (const 文件 of [...必需文件, ...必需脚本]) {
  断言(文件存在(文件), `缺少文件：${文件}`);
}

for (const 脚本 of 必需脚本) {
  const 内容 = 读取文本(脚本);
  断言(内容.startsWith('#!/usr/bin/env bash\n'), `${脚本} 缺少Bash解释器声明`);
  断言(内容.includes('set -euo pipefail'), `${脚本} 未启用严格错误处理`);
  断言((fs.statSync(path.join(项目根目录, 脚本)).mode & 0o111) !== 0, `${脚本} 未设置可执行权限`);
  执行命令('bash', ['-n', 脚本]);
}

for (const 文件 of [
  'deploy/single-server/docker/api.Dockerfile',
  'deploy/single-server/docker/worker.Dockerfile',
  'deploy/single-server/docker/web.Dockerfile',
]) {
  断言(包含(文件, 'node:22.13.1'), `${文件} 未固定Node 22.13.1`);
}

断言(
  包含('deploy/single-server/scripts/build-images.sh', 'linux/amd64'),
  '构建脚本未固定默认linux/amd64平台',
);
断言(
  包含('deploy/single-server/scripts/save-images.sh', 'postgres:16.4-alpine') &&
    包含('deploy/single-server/scripts/save-images.sh', 'redis:7.2.5-alpine'),
  '离线镜像导出脚本未覆盖PostgreSQL和Redis官方镜像',
);

const 编排文件 = 读取文本('deploy/single-server/compose/docker-compose.yml');
断言(编排文件.includes('api-1') && 编排文件.includes('api-2'), 'Compose未配置双API实例');
断言(编排文件.includes('worker'), 'Compose未配置Worker');
断言(编排文件.includes('postgres:16.4-alpine'), 'Compose未配置PostgreSQL 16.4');
断言(编排文件.includes('redis:7.2.5-alpine'), 'Compose未配置Redis 7.2.5');
断言(编排文件.includes('internal: true'), 'Compose数据网络未设置为内部网络');
断言(!/"5432:5432"/.test(编排文件), 'Compose不允许暴露PostgreSQL宿主端口');
断言(!/"6379:6379"/.test(编排文件), 'Compose不允许暴露Redis宿主端口');
断言(编排文件.includes('${HTTP_PORT:-80}:80'), 'Compose未按IP访问暴露HTTP入口');
断言(!编排文件.includes('POSTGRES_PASSWORD='), 'Compose不应写入明文PostgreSQL密码');
断言(!编排文件.includes('REDIS_PASSWORD='), 'Compose不应写入明文Redis密码');

const 环境模板 = 读取文本('deploy/single-server/config/v3.env.template');
断言(环境模板.includes('APP_ENV=production'), '环境模板未设置生产环境');
断言(环境模板.includes('HEALTH_DEPENDENCY_MODE=real'), '环境模板未启用真实依赖健康检查');
断言(环境模板.includes('CORS_ORIGIN=http://__SERVER_HOST__'), '环境模板未支持IP访问');
断言(环境模板.includes('__SESSION_SECRET__'), '环境模板未保留会话密钥占位符');

const 部署变量 = 读取文本('deploy/single-server/config/deploy.env.example');
断言(部署变量.includes('INSTALL_ROOT=/opt/lianruan-crm-v3'), '部署变量未固定推荐安装目录');
断言(部署变量.includes('BACKUP_REMOTE_ENABLED=false'), '部署变量未保留异机备份开关');
断言(部署变量.includes('BACKUP_REMOTE_TARGET='), '部署变量未保留异机备份目标');

const nginx配置 = 读取文本('deploy/single-server/config/nginx/default.conf');
断言(nginx配置.includes('upstream v3_api'), 'Nginx未配置API上游');
断言(nginx配置.includes('api-1:3100') && nginx配置.includes('api-2:3100'), 'Nginx未代理双API实例');
断言(nginx配置.includes('location /health/'), 'Nginx未代理健康检查');
断言(nginx配置.includes('location /assets/'), 'Nginx未配置静态资源缓存');

const 敏感扫描文件 = [...必需文件, ...必需脚本];
const 禁止正则 = [
  /POSTGRES_PASSWORD\s*=\s*['"]?[A-Za-z0-9+/=]{20,}/,
  /REDIS_PASSWORD\s*=\s*['"]?[A-Za-z0-9+/=]{20,}/,
  /SESSION_SECRET\s*=\s*['"]?[A-Za-z0-9+/=]{32,}/,
  /BACKUP_ENCRYPTION_KEY\s*=\s*['"]?[A-Za-z0-9+/=]{20,}/,
];
for (const 文件 of 敏感扫描文件) {
  const 内容 = 读取文本(文件);
  for (const 正则 of 禁止正则) {
    断言(!正则.test(内容), `${文件} 疑似包含不应入库的初始化密钥`);
  }
}

console.log('阶段7单机离线部署资产检查通过。');
