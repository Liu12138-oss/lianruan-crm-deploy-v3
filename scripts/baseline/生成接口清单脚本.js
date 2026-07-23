#!/usr/bin/env node

const { 生成阶段0基线 } = require('./生成阶段0基线');

const 结果 = 生成阶段0基线();
console.log(`接口清单已生成，当前后端接口路由 ${结果.routeCount} 个。`);
