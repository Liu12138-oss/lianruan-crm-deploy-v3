#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const 项目根目录 = path.resolve(__dirname, '../..');

const 必需文件 = [
  'docs/phase-5-frontend-migration/阶段5前端工程化迁移落地包.md',
  'docs/phase-5-frontend-migration/旧前端组件拆分边界建议.md',
  'docs/phase-5-frontend-migration/API客户端分层与异常页面规范.md',
  'docs/phase-5-frontend-migration/迁移验收用例与回退策略.md',
];

const 必需关键词 = [
  ['docs/phase-5-frontend-migration/阶段5前端工程化迁移落地包.md', ['批次一', '批次二', '批次三', '批次四', '批次五', '管理端', '渠道电脑版', '移动端一期', '移动端二期']],
  ['docs/phase-5-frontend-migration/旧前端组件拆分边界建议.md', ['admin-app.js', 'partner-app.js', 'mobile-app.js', 'mobile-v2-app.js', 'useServerList']],
  ['docs/phase-5-frontend-migration/API客户端分层与异常页面规范.md', ['401', '403', '409', '维护页', '请求编号', '同源安全 Cookie']],
  ['docs/phase-5-frontend-migration/迁移验收用例与回退策略.md', ['FE-B1-001', 'FE-B2-001', 'FE-B3-001', 'FE-B4-001', 'FE-B5-001', '页面级']],
];

function 读取文本(相对路径) {
  return fs.readFileSync(path.join(项目根目录, 相对路径), 'utf8');
}

function 执行命令(命令, 参数) {
  return childProcess.execFileSync(命令, 参数, {
    cwd: 项目根目录,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function 检查文件存在() {
  const 缺失 = 必需文件.filter((文件) => !fs.existsSync(path.join(项目根目录, 文件)));
  return 缺失.map((文件) => `缺少文件：${文件}`);
}

function 检查关键词() {
  const 错误 = [];
  for (const [文件, 关键词集合] of 必需关键词) {
    const 内容 = 读取文本(文件);
    for (const 关键词 of 关键词集合) {
      if (!内容.includes(关键词)) 错误.push(`文件 ${文件} 缺少关键词：${关键词}`);
    }
  }
  return 错误;
}

function 检查历史前端未改动() {
  const 输出 = 执行命令('git', ['status', '--short']);
  const 改动文件 = 输出.split('\n')
    .map((行) => 行.trim())
    .filter(Boolean)
    .map((行) => 行.replace(/^.. /, ''));
  const 违规 = 改动文件.filter((文件) => /^frontend\/(admin-app|partner-app|mobile-app|mobile-v2-app|app|api-client|mobile-v2-api)\.js$/.test(文件));
  return 违规.map((文件) => `本阶段禁止修改历史前端业务文件：${文件}`);
}

function 主函数() {
  const 错误 = [
    ...检查文件存在(),
    ...检查关键词(),
    ...检查历史前端未改动(),
  ];

  if (错误.length) {
    console.error('阶段5前端迁移资产检查未通过：');
    for (const 项 of 错误) console.error(`- ${项}`);
    process.exit(1);
  }

  console.log('阶段5前端迁移资产检查通过：文档齐全，历史前端业务文件未改动。');
}

主函数();
