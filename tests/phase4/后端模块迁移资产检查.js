#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const 项目根目录 = path.resolve(__dirname, '../..');
const 基线文件 = path.join(项目根目录, 'docs/baseline/接口契约基线.json');
const 归属文件 = path.join(项目根目录, 'docs/stage-records/阶段4-旧接口迁移归属表.json');
const 汇总文件 = path.join(项目根目录, 'docs/stage-records/阶段4-后端模块化迁移资产.json');

const { 模块顺序, 风险顺序 } = require('../../scripts/phase4/生成后端模块迁移资产');

function 读取数据(文件) {
  if (!fs.existsSync(文件)) throw new Error(`文件不存在：${path.relative(项目根目录, 文件)}`);
  return JSON.parse(fs.readFileSync(文件, 'utf8'));
}

function 路由键(项) {
  return `${项.方法 || 项.method} ${项.旧路径 || 项.path}`;
}

function 检查() {
  const 错误 = [];
  const 基线 = 读取数据(基线文件);
  const 归属 = 读取数据(归属文件);
  const 汇总 = 读取数据(汇总文件);

  if (基线.routeCount !== 257) 错误.push(`阶段0基线接口数应为257，实际为${基线.routeCount}`);
  if (归属.length !== 基线.routes.length) 错误.push(`归属表接口数${归属.length}与基线接口数${基线.routes.length}不一致`);
  if (汇总.接口总数 !== 257) 错误.push(`汇总接口数应为257，实际为${汇总.接口总数}`);

  const 基线键集合 = new Set(基线.routes.map(路由键));
  const 归属键集合 = new Set(归属.map(路由键));
  for (const 键 of 基线键集合) if (!归属键集合.has(键)) 错误.push(`归属表缺少接口：${键}`);
  for (const 键 of 归属键集合) if (!基线键集合.has(键)) 错误.push(`归属表存在非基线接口：${键}`);

  const 编号集合 = new Set();
  for (const 项 of 归属) {
    if (编号集合.has(项.接口编号)) 错误.push(`接口编号重复：${项.接口编号}`);
    编号集合.add(项.接口编号);
    if (!模块顺序.includes(项.新模块)) 错误.push(`接口${项.接口编号}归属到非法模块：${项.新模块}`);
    if (!项.新控制器 || !项.新服务 || !项.新仓储) 错误.push(`接口${项.接口编号}缺少控制器、服务或仓储`);
    if (!Array.isArray(项.高风险类别)) 错误.push(`接口${项.接口编号}高风险类别必须是数组`);
    for (const 风险 of 项.高风险类别 || []) {
      if (!风险顺序.includes(风险)) 错误.push(`接口${项.接口编号}存在未知风险类别：${风险}`);
    }
  }

  for (const 模块 of 模块顺序) {
    const 数量 = 归属.filter(项 => 项.新模块 === 模块).length;
    if (数量 === 0) 错误.push(`目标模块没有接口归属：${模块}`);
    if (!汇总.模块统计 || 汇总.模块统计[模块] !== 数量) {
      错误.push(`汇总模块统计不一致：${模块}，归属表${数量}，汇总${汇总.模块统计?.[模块]}`);
    }
    const 计划 = 汇总.模块计划?.[模块];
    if (!计划) {
      错误.push(`缺少模块计划：${模块}`);
    } else {
      for (const 字段 of ['首批迁移顺序', '验收用例', '回退策略']) {
        if (!计划[字段] || (Array.isArray(计划[字段]) && 计划[字段].length === 0)) 错误.push(`模块${模块}缺少${字段}`);
      }
    }
  }

  for (const 风险 of 风险顺序) {
    if (!汇总.风险统计 || typeof 汇总.风险统计[风险] !== 'number') 错误.push(`汇总缺少风险统计：${风险}`);
  }

  if (错误.length) {
    console.error(`阶段4后端模块迁移资产检查未通过：\n${错误.join('\n')}`);
    process.exit(1);
  }

  console.log(`阶段4后端模块迁移资产检查通过：${归属.length}个接口已归属到${模块顺序.length}个目标模块。`);
}

检查();
