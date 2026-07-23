#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
  项目根目录,
  当前时间,
  写文本,
} = require('./阶段0测试工具');
const {
  生成路由清单,
  提取前端接口引用,
  关联前端调用方,
} = require('../../scripts/baseline/生成阶段0基线');

function 路由键(路由) {
  return `${路由.method} ${路由.path}`;
}

const 快照文件 = path.join(项目根目录, 'docs/baseline/接口契约基线.json');
if (!fs.existsSync(快照文件)) {
  console.error('未找到接口契约基线，请先运行 node scripts/baseline/生成阶段0基线.js');
  process.exit(1);
}

const 快照 = JSON.parse(fs.readFileSync(快照文件, 'utf8'));
const 当前路由 = 生成路由清单();
const 前端引用 = 提取前端接口引用();
关联前端调用方(当前路由, 前端引用);

const 快照键 = new Set(快照.routes.map(路由键));
const 当前键 = new Set(当前路由.map(路由键));
const 缺失 = Array.from(快照键).filter((键) => !当前键.has(键)).sort();
const 新增 = Array.from(当前键).filter((键) => !快照键.has(键)).sort();
const 结果 = 缺失.length === 0 && 新增.length === 0;

写文本('docs/baseline/接口契约校验结果.md', [
  '# 接口契约校验结果',
  '',
  `执行时间：${当前时间()}`,
  '',
  '| 项目 | 数量 |',
  '| --- | ---: |',
  `| 基线接口数 | ${快照.routes.length} |`,
  `| 当前接口数 | ${当前路由.length} |`,
  `| 缺失接口数 | ${缺失.length} |`,
  `| 新增接口数 | ${新增.length} |`,
  '',
  `结论：${结果 ? '通过，当前接口契约与阶段0基线一致。' : '未通过，存在接口契约变化。'}`,
  '',
  '## 缺失接口',
  '',
  ...(缺失.length ? 缺失.map((项) => `- ${项}`) : ['- 无']),
  '',
  '## 新增接口',
  '',
  ...(新增.length ? 新增.map((项) => `- ${项}`) : ['- 无']),
  '',
].join('\n'));

if (!结果) {
  console.error('接口契约校验未通过，详见 docs/baseline/接口契约校验结果.md');
  process.exit(1);
}

console.log(`接口契约校验通过：${当前路由.length} 个接口与基线一致。`);
