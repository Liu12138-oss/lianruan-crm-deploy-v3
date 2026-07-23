const fs = require('fs');
const path = require('path');
const net = require('net');
const childProcess = require('child_process');

const 项目根目录 = path.resolve(__dirname, '../..');

function 睡眠(毫秒) {
  return new Promise((resolve) => setTimeout(resolve, 毫秒));
}

function 确保目录(目录) {
  fs.mkdirSync(目录, { recursive: true });
}

function 写文本(相对文件, 内容) {
  const 目标 = path.join(项目根目录, 相对文件);
  确保目录(path.dirname(目标));
  fs.writeFileSync(目标, 内容);
}

function 当前时间() {
  return new Date().toISOString();
}

function 取得可用端口() {
  return new Promise((resolve, reject) => {
    const 服务 = net.createServer();
    服务.listen(0, '127.0.0.1', () => {
      const 地址 = 服务.address();
      服务.close(() => resolve(地址.port));
    });
    服务.on('error', reject);
  });
}

function 复制文件(来源, 目标) {
  if (!fs.existsSync(来源)) return false;
  确保目录(path.dirname(目标));
  fs.copyFileSync(来源, 目标);
  return true;
}

async function 请求(基础地址, 用例) {
  const 开始 = process.hrtime.bigint();
  try {
    const 响应 = await fetch(`${基础地址}${用例.path}`, {
      method: 用例.method || 'GET',
      headers: 用例.body ? { 'content-type': 'application/json' } : undefined,
      body: 用例.body ? JSON.stringify(用例.body) : undefined,
    });
    const 文本 = await 响应.text();
    const 耗时 = Number(process.hrtime.bigint() - 开始) / 1000000;
    let 数据 = null;
    try {
      数据 = 文本 ? JSON.parse(文本) : null;
    } catch (错误) {
      数据 = null;
    }
    return {
      name: 用例.name,
      method: 用例.method || 'GET',
      path: 用例.path,
      status: 响应.status,
      ok: 响应.status < 500,
      durationMs: Math.round(耗时),
      bodySize: 文本.length,
      successField: 数据 && Object.prototype.hasOwnProperty.call(数据, 'success') ? 数据.success : '',
      message: 数据 && 数据.message ? 数据.message : '',
    };
  } catch (错误) {
    const 耗时 = Number(process.hrtime.bigint() - 开始) / 1000000;
    return {
      name: 用例.name,
      method: 用例.method || 'GET',
      path: 用例.path,
      status: 0,
      ok: false,
      durationMs: Math.round(耗时),
      bodySize: 0,
      successField: '',
      message: 错误.message,
    };
  }
}

async function 启动临时后端() {
  const 端口 = await 取得可用端口();
  const 临时目录 = path.join(项目根目录, 'tmp/stage0-runtime');
  确保目录(临时目录);
  const 业务库 = path.join(临时目录, `crm-${端口}.db`);
  const 审计库 = path.join(临时目录, `audit-${端口}.db`);
  复制文件(path.join(项目根目录, 'backend/crm.db'), 业务库);
  复制文件(path.join(项目根目录, 'backend/audit.db'), 审计库);

  const 日志 = [];
  const 进程 = childProcess.spawn(process.execPath, ['server.js'], {
    cwd: path.join(项目根目录, 'backend'),
    env: {
      ...process.env,
      PORT: String(端口),
      DB_PATH: 业务库,
      AUDIT_DB_PATH: 审计库,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  进程.stdout.on('data', (数据) => 日志.push(String(数据)));
  进程.stderr.on('data', (数据) => 日志.push(String(数据)));

  const 基础地址 = `http://127.0.0.1:${端口}`;
  const 截止 = Date.now() + 15000;
  while (Date.now() < 截止) {
    if (进程.exitCode !== null) {
      return { ok: false, 基础地址, 进程, 日志: 日志.join(''), reason: '后端进程提前退出' };
    }
    const 检查 = await 请求(基础地址, { name: '启动检查', path: '/api/product-tree?published=true' });
    if (检查.status > 0) return { ok: true, 基础地址, 进程, 日志: 日志.join(''), reason: '' };
    await 睡眠(500);
  }
  return { ok: false, 基础地址, 进程, 日志: 日志.join(''), reason: '后端启动超时' };
}

function 停止临时后端(进程) {
  if (!进程 || 进程.exitCode !== null) return;
  进程.kill('SIGTERM');
}

module.exports = {
  项目根目录,
  当前时间,
  写文本,
  请求,
  启动临时后端,
  停止临时后端,
};
