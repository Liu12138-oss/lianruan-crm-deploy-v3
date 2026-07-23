#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
  项目根目录,
  当前时间,
  写文本,
} = require('../legacy-contract/阶段0测试工具');

const 入口文件 = [
  'frontend/index.html',
  'frontend/login.html',
  'frontend/admin.html',
  'frontend/partner.html',
  'frontend/mobile.html',
  'frontend/mobile-v2.html',
];

function 提取资源(内容) {
  const 资源 = [];
  const 正则集合 = [
    /<script[^>]+src=["']([^"']+)["']/g,
    /<link[^>]+href=["']([^"']+)["']/g,
  ];
  for (const 正则 of 正则集合) {
    let 匹配;
    while ((匹配 = 正则.exec(内容)) !== null) {
      资源.push(匹配[1].split('?')[0]);
    }
  }
  return 资源.filter((项) => {
    if (/^https?:\/\//.test(项) || 项.startsWith('//')) return false;
    if (/^(data:|mailto:|tel:|#)/.test(项)) return false;
    return true;
  });
}

const 检查结果 = [];
for (const 入口 of 入口文件) {
  const 绝对入口 = path.join(项目根目录, 入口);
  if (!fs.existsSync(绝对入口)) {
    检查结果.push({ 入口, 资源: 入口, 状态: '失败', 说明: '入口文件不存在' });
    continue;
  }
  const 内容 = fs.readFileSync(绝对入口, 'utf8');
  检查结果.push({ 入口, 资源: 入口, 状态: '通过', 说明: '入口文件存在' });
  for (const 资源 of 提取资源(内容)) {
    const 资源路径 = path.join(path.dirname(绝对入口), 资源);
    检查结果.push({
      入口,
      资源,
      状态: fs.existsSync(资源路径) ? '通过' : '失败',
      说明: fs.existsSync(资源路径) ? '本地资源存在' : '本地资源缺失',
    });
  }
}

const 失败 = 检查结果.filter((项) => 项.状态 !== '通过');
写文本('docs/baseline/浏览器入口静态检查结果.md', [
  '# 浏览器入口静态检查结果',
  '',
  `执行时间：${当前时间()}`,
  '',
  '| 入口 | 资源 | 状态 | 说明 |',
  '| --- | --- | --- | --- |',
  ...检查结果.map((项) => `| ${项.入口} | ${项.资源} | ${项.状态} | ${项.说明} |`),
  '',
  `结论：${失败.length ? `未通过，发现 ${失败.length} 个缺失项。` : '通过，所有入口和本地资源存在。'}`,
  '',
].join('\n'));

if (失败.length) {
  console.error('浏览器入口静态检查未通过，详见 docs/baseline/浏览器入口静态检查结果.md');
  process.exit(1);
}

console.log(`浏览器入口静态检查通过：${入口文件.length} 个入口已检查。`);
