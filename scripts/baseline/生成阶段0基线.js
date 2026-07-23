#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');

const 项目根目录 = path.resolve(__dirname, '../..');
const 基线目录 = path.join(项目根目录, 'docs/baseline');
const 决策目录 = path.join(项目根目录, 'docs/decisions');
const 记录目录 = path.join(项目根目录, 'docs/stage-records');

function 当前时间() {
  return new Date().toISOString();
}

function 相对路径(绝对路径) {
  return path.relative(项目根目录, 绝对路径).replace(/\\/g, '/');
}

function 确保目录(目录) {
  fs.mkdirSync(目录, { recursive: true });
}

function 读取文本(相对文件) {
  return fs.readFileSync(path.join(项目根目录, 相对文件), 'utf8');
}

function 写文本(相对文件, 内容) {
  const 目标 = path.join(项目根目录, 相对文件);
  确保目录(path.dirname(目标));
  fs.writeFileSync(目标, 内容);
}

function 写JSON(相对文件, 数据) {
  写文本(相对文件, `${JSON.stringify(数据, null, 2)}\n`);
}

function 加载依赖(名称) {
  const 候选路径 = [
    path.join(项目根目录, 'backend/node_modules', 名称),
    名称,
  ];
  for (const 候选 of 候选路径) {
    try {
      return require(候选);
    } catch (错误) {
      if (候选 === 候选路径[候选路径.length - 1]) throw 错误;
    }
  }
  return null;
}

function 写工作簿(相对文件, 工作表集合) {
  const xlsx = 加载依赖('xlsx');
  const 工作簿 = xlsx.utils.book_new();
  for (const 工作表 of 工作表集合) {
    const 行 = 工作表.rows.length ? 工作表.rows : [{ 说明: '当前没有可输出数据' }];
    const 表 = xlsx.utils.json_to_sheet(行);
    xlsx.utils.book_append_sheet(工作簿, 表, 工作表.name.slice(0, 31));
  }
  const 目标 = path.join(项目根目录, 相对文件);
  确保目录(path.dirname(目标));
  xlsx.writeFile(工作簿, 目标);
}

function 建立行号索引(源码) {
  const 起点 = [0];
  for (let 下标 = 0; 下标 < 源码.length; 下标 += 1) {
    if (源码[下标] === '\n') 起点.push(下标 + 1);
  }
  return 起点;
}

function 取得行号(行号索引, 位置) {
  let 左 = 0;
  let 右 = 行号索引.length - 1;
  while (左 <= 右) {
    const 中 = Math.floor((左 + 右) / 2);
    if (行号索引[中] <= 位置) 左 = 中 + 1;
    else 右 = 中 - 1;
  }
  return 右 + 1;
}

function 读取第一个参数(源码, 开始位置) {
  let 字符串 = null;
  let 转义 = false;
  let 深度 = 0;
  let 结束位置 = 开始位置;
  for (let 下标 = 开始位置; 下标 < 源码.length; 下标 += 1) {
    const 字符 = 源码[下标];
    if (字符串) {
      if (转义) {
        转义 = false;
      } else if (字符 === '\\') {
        转义 = true;
      } else if (字符 === 字符串) {
        字符串 = null;
      }
      continue;
    }

    if (字符 === '\'' || 字符 === '"' || 字符 === '`') {
      字符串 = 字符;
      continue;
    }
    if (字符 === '[' || 字符 === '(' || 字符 === '{') 深度 += 1;
    if (字符 === ']' || 字符 === ')' || 字符 === '}') 深度 -= 1;
    if (字符 === ',' && 深度 === 0) {
      结束位置 = 下标;
      break;
    }
  }
  return 源码.slice(开始位置, 结束位置).trim();
}

function 提取字符串常量(文本) {
  const 结果 = [];
  let 下标 = 0;
  while (下标 < 文本.length) {
    const 引号 = 文本[下标];
    if (引号 !== '\'' && 引号 !== '"' && 引号 !== '`') {
      下标 += 1;
      continue;
    }
    let 内容 = '';
    下标 += 1;
    let 转义 = false;
    for (; 下标 < 文本.length; 下标 += 1) {
      const 字符 = 文本[下标];
      if (转义) {
        内容 += 字符;
        转义 = false;
      } else if (字符 === '\\') {
        转义 = true;
      } else if (字符 === 引号) {
        break;
      } else {
        内容 += 字符;
      }
    }
    结果.push(内容);
    下标 += 1;
  }
  return 结果;
}

function 解析路由路径(参数文本) {
  const 去空 = 参数文本.trim();
  if (去空.startsWith('[')) return 提取字符串常量(去空);
  const 常量 = 提取字符串常量(去空);
  if (常量.length) return [常量[0]];
  return [去空 || '未识别路径表达式'];
}

function 推断模块(路径文本) {
  const 路径 = String(路径文本);
  if (路径.includes('/mock/')) return '模拟接口';
  if (路径.includes('/auth') || 路径.includes('/sso') || 路径.includes('/oauth')) return '登录认证';
  if (路径.includes('/mobile/v2')) return '移动端二期';
  if (路径.includes('/mobile')) return '移动端一期';
  if (路径.includes('/open-api')) return '开放接口管理';
  if (路径.includes('/open/v1')) return '开放接口';
  if (路径.includes('/registrations')) return '客户报备';
  if (路径.includes('/opportunities')) return '商机管理';
  if (路径.includes('/quotes') || 路径.includes('/ipg')) return '报价管理';
  if (路径.includes('/orders')) return '订单管理';
  if (路径.includes('/partners') || 路径.includes('/channel-')) return '渠道管理';
  if (路径.includes('/users') || 路径.includes('/admin/accounts')) return '账号管理';
  if (路径.includes('/pending-approvals')) return '审批管理';
  if (路径.includes('/workload')) return '工作量配置';
  if (路径.includes('/product') || 路径.includes('/categories') || 路径.includes('/modules') || 路径.includes('/features') || 路径.includes('/hardware') || 路径.includes('/packages')) return '产品管理';
  if (路径.includes('/audit-logs')) return '审计日志';
  if (路径.includes('/import') || 路径.includes('/export')) return '导入导出';
  if (路径.includes('/dashboard') || 路径.includes('/reports') || 路径.includes('/analytics')) return '统计看板';
  if (路径.includes('/notifications')) return '通知消息';
  if (路径.includes('/company-search')) return '企业查询';
  return '待确认模块';
}

function 判断路由风险(路由, 片段) {
  const 风险 = [];
  const 路径 = 路由.path;
  if (路径.startsWith('/api/') && !片段.includes('requireOpenApiAuth') && !片段.includes('requireOpenApiManager') && !路径.includes('/auth/') && !路径.includes('/oauth/authorize')) {
    风险.push('未发现统一服务端鉴权中间件，需要阶段3重建');
  }
  if (/operator(Role|Id|Name)|userRole|userId|role|region|partnerId/.test(片段) && /req\.(body|query|headers)/.test(片段)) {
    风险.push('存在从请求读取操作者、角色或数据范围的逻辑，需要核对是否信任前端');
  }
  if (/password/.test(片段) && !路径.includes('/auth/password')) {
    风险.push('接口片段涉及密码字段，需要迁移为哈希和最小返回');
  }
  if (路由.method === 'GET' && /(registrations|opportunities|quotes|orders|partners|users|products|audit-logs)/.test(路径) && !/pageSize|limit|offset/.test(片段)) {
    风险.push('列表接口未明显发现强制分页或上限');
  }
  if (/upload\.single|multer|XLSX|writeFileSync|createWriteStream/.test(片段)) {
    风险.push('包含文件、导入导出或同步写入操作，需要任务化和资源限制');
  }
  if (路径.includes('${')) {
    风险.push('动态注册路由，需要在阶段4展开为明确契约');
  }
  return 风险.length ? 风险 : ['阶段0未识别到明显风险，仍需人工复核'];
}

function 生成路由清单() {
  const 源码 = 读取文本('backend/server.js');
  const 行号索引 = 建立行号索引(源码);
  const 匹配正则 = /app\.(get|post|put|delete|patch|all)\s*\(/g;
  const 匹配集合 = [];
  let 匹配;
  while ((匹配 = 匹配正则.exec(源码)) !== null) {
    匹配集合.push({
      method: 匹配[1].toUpperCase(),
      index: 匹配.index,
      argStart: 匹配.index + 匹配[0].length,
      line: 取得行号(行号索引, 匹配.index),
    });
  }

  const 路由 = [];
  for (let 下标 = 0; 下标 < 匹配集合.length; 下标 += 1) {
    const 当前 = 匹配集合[下标];
    const 下一个 = 匹配集合[下标 + 1];
    const 参数文本 = 读取第一个参数(源码, 当前.argStart);
    const 片段 = 源码.slice(当前.index, 下一个 ? 下一个.index : Math.min(源码.length, 当前.index + 5000));
    const 路径集合 = 解析路由路径(参数文本);
    for (const 路径文本 of 路径集合) {
      const 条目 = {
        id: `API-${String(路由.length + 1).padStart(4, '0')}`,
        method: 当前.method,
        path: 路径文本,
        sourceFile: 'backend/server.js',
        sourceLine: 当前.line,
        targetModule: 推断模块(路径文本),
        firstArgument: 参数文本,
        frontendCallers: [],
      };
      条目.risks = 判断路由风险(条目, 片段);
      路由.push(条目);
    }
  }
  return 路由;
}

function 读取前端文件() {
  const 前端目录 = path.join(项目根目录, 'frontend');
  return fs.readdirSync(前端目录)
    .filter((文件) => /\.(js|html)$/.test(文件))
    .sort()
    .map((文件) => path.join('frontend', 文件));
}

function 标准化前端接口路径(文件, 原始文本) {
  let 文本 = 原始文本.trim();
  if (!文本 || 文本.includes('<') || 文本.includes(' ') || 文本.startsWith('/#')) return null;
  if (/\.(html|css|js|png|jpg|jpeg|svg|ico)(\?|$)/i.test(文本)) return null;
  文本 = 文本.replace(/\$\{[^}]*API_BASE[^}]*\}/g, '');
  文本 = 文本.replace(/\$\{[^}]*API_BASE_URL[^}]*\}/g, '');
  文本 = 文本.replace(/\$\{[^}]*MOBILE_V2_API_BASE[^}]*\}/g, '');
  文本 = 文本.replace(/^https?:\/\/[^/]+\/api/, '/api');
  文本 = 文本.replace(/^https?:\/\/[^/]+/, '');
  文本 = 文本.replace(/\$\{[^}]+\}/g, '__动态__');
  文本 = 文本.replace(/__动态____动态__/g, '__动态__');
  if (!文本.startsWith('/')) return null;
  if (文本 === '/api' || 文本 === '/') return null;

  if (文件.includes('mobile-v2') && !文本.startsWith('/api/mobile/v2')) {
    文本 = `/api/mobile/v2${文本}`;
  } else if (文件.includes('mobile-app') && !文本.startsWith('/api/mobile')) {
    文本 = `/api/mobile${文本}`;
  } else if (!文本.startsWith('/api/')) {
    文本 = `/api${文本}`;
  }
  return 文本.replace(/\/+/g, '/');
}

function 提取前端接口引用() {
  const 引用 = [];
  for (const 文件 of 读取前端文件()) {
    const 源码 = 读取文本(文件);
    const 行号索引 = 建立行号索引(源码);
    const 字符串正则 = /(['"`])((?:\\.|[\s\S])*?)\1/g;
    let 匹配;
    while ((匹配 = 字符串正则.exec(源码)) !== null) {
      const 原始文本 = 匹配[2];
      if (!原始文本.includes('/') && !原始文本.includes('API_BASE')) continue;
      const 路径文本 = 标准化前端接口路径(文件, 原始文本);
      if (!路径文本) continue;
      引用.push({
        file: 文件,
        line: 取得行号(行号索引, 匹配.index),
        raw: 原始文本.length > 240 ? `${原始文本.slice(0, 240)}...` : 原始文本,
        normalizedPath: 路径文本,
        pathWithoutQuery: 路径文本.split('?')[0],
      });
    }
  }

  const 去重 = new Map();
  for (const 项 of 引用) {
    const 键 = `${项.file}:${项.line}:${项.normalizedPath}`;
    if (!去重.has(键)) 去重.set(键, 项);
  }
  return Array.from(去重.values()).sort((a, b) => `${a.file}:${a.line}`.localeCompare(`${b.file}:${b.line}`));
}

function 路由转正则(路径文本) {
  if (路径文本.includes('${')) return null;
  const 转义 = 路径文本
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\:([A-Za-z0-9_]+)/g, '[^/]+');
  return new RegExp(`^${转义}$`);
}

function 关联前端调用方(路由清单, 前端引用) {
  const 路由正则 = 路由清单.map((路由) => ({ 路由, 正则: 路由转正则(路由.path) }));
  for (const 引用 of 前端引用) {
    const 路径 = 引用.pathWithoutQuery.replace(/__动态__/g, '动态值');
    for (const 项 of 路由正则) {
      if (项.正则 && 项.正则.test(路径)) {
        项.路由.frontendCallers.push(`${引用.file}:${引用.line}`);
      }
    }
  }
}

function 未匹配前端引用(路由清单, 前端引用) {
  const 路由正则 = 路由清单.map((路由) => 路由转正则(路由.path)).filter(Boolean);
  return 前端引用.filter((引用) => {
    const 路径 = 引用.pathWithoutQuery.replace(/__动态__/g, '动态值');
    return !路由正则.some((正则) => 正则.test(路径));
  });
}

function yaml字符串(值) {
  return JSON.stringify(String(值));
}

function 写接口基线(路由清单) {
  const 模块统计 = {};
  for (const 路由 of 路由清单) {
    模块统计[路由.targetModule] = (模块统计[路由.targetModule] || 0) + 1;
  }
  const 行 = [
    `generatedAt: ${yaml字符串(当前时间())}`,
    `source: ${yaml字符串('backend/server.js')}`,
    `routeCount: ${路由清单.length}`,
    'moduleSummary:',
    ...Object.entries(模块统计).sort().map(([名称, 数量]) => `  ${yaml字符串(名称)}: ${数量}`),
    'routes:',
  ];
  for (const 路由 of 路由清单) {
    行.push(`  - id: ${yaml字符串(路由.id)}`);
    行.push(`    method: ${yaml字符串(路由.method)}`);
    行.push(`    path: ${yaml字符串(路由.path)}`);
    行.push(`    sourceFile: ${yaml字符串(路由.sourceFile)}`);
    行.push(`    sourceLine: ${路由.sourceLine}`);
    行.push(`    targetModule: ${yaml字符串(路由.targetModule)}`);
    行.push('    frontendCallers:');
    for (const 调用方 of 路由.frontendCallers.length ? 路由.frontendCallers : ['待确认']) {
      行.push(`      - ${yaml字符串(调用方)}`);
    }
    行.push('    risks:');
    for (const 风险 of 路由.risks) {
      行.push(`      - ${yaml字符串(风险)}`);
    }
  }
  写文本('docs/baseline/接口契约基线.yaml', `${行.join('\n')}\n`);
  写JSON('docs/baseline/接口契约基线.json', {
    generatedAt: 当前时间(),
    source: 'backend/server.js',
    routeCount: 路由清单.length,
    routes: 路由清单,
  });
  写工作簿('docs/baseline/接口风险与迁移归属.xlsx', [
    {
      name: '接口风险',
      rows: 路由清单.map((路由) => ({
        接口编号: 路由.id,
        方法: 路由.method,
        路径: 路由.path,
        源码行: 路由.sourceLine,
        目标模块: 路由.targetModule,
        前端调用方: 路由.frontendCallers.join('\n') || '待确认',
        风险标记: 路由.risks.join('\n'),
        阶段4迁移结论: '待开发阶段确认',
      })),
    },
  ]);
}

function 写页面和接口依赖(路由清单, 前端引用) {
  const 入口 = [
    { 页面编号: 'PAGE-0001', 端: '统一入口', 入口文件: 'frontend/index.html', 入口地址: '/index.html', 当前状态: '代码存在，生产使用待确认', 允许角色: '待确认', 主要操作: '统一入口跳转' },
    { 页面编号: 'PAGE-0002', 端: '登录页', 入口文件: 'frontend/login.html', 入口地址: '/login.html', 当前状态: '代码存在，生产使用待确认', 允许角色: '全部登录用户', 主要操作: '账号密码登录、入口分流' },
    { 页面编号: 'PAGE-0003', 端: '管理端', 入口文件: 'frontend/admin.html', 入口地址: '/admin.html', 当前状态: '代码存在，生产使用待确认', 允许角色: 'superadmin、admin、历史角色待确认', 主要操作: '账号、渠道、报备、商机、报价、订单、产品、开放接口管理' },
    { 页面编号: 'PAGE-0004', 端: '渠道电脑版', 入口文件: 'frontend/partner.html', 入口地址: '/partner.html', 当前状态: '代码存在，生产使用待确认', 允许角色: 'partner_admin、staff、历史角色待确认', 主要操作: '渠道业务办理、报备、商机、报价、订单' },
    { 页面编号: 'PAGE-0005', 端: '渠道移动端一期', 入口文件: 'frontend/mobile.html', 入口地址: '/mobile.html', 当前状态: '代码存在，生产使用待确认', 允许角色: '渠道体系用户', 主要操作: '移动端历史业务入口' },
    { 页面编号: 'PAGE-0006', 端: '移动端二期', 入口文件: 'frontend/mobile-v2.html', 入口地址: '/mobile-v2.html', 当前状态: '代码存在，生产使用待确认', 允许角色: '渠道体系用户', 主要操作: '移动端二期报备、商机、报价、订单' },
  ];

  const 未匹配 = 未匹配前端引用(路由清单, 前端引用);
  写工作簿('docs/baseline/现有功能范围清单.xlsx', [
    { name: '页面入口', rows: 入口 },
    {
      name: '模块范围',
      rows: Object.entries(路由清单.reduce((结果, 路由) => {
        结果[路由.targetModule] = (结果[路由.targetModule] || 0) + 1;
        return 结果;
      }, {})).sort().map(([模块, 数量]) => ({
        模块,
        接口数量: 数量,
        本轮结论: '只保持当前能力，不新增功能',
        责任人: '待任命',
      })),
    },
  ]);
  写工作簿('docs/baseline/页面与接口依赖清单.xlsx', [
    {
      name: '前端接口引用',
      rows: 前端引用.map((引用) => ({
        文件: 引用.file,
        行号: 引用.line,
        归一化接口: 引用.normalizedPath,
        去查询参数路径: 引用.pathWithoutQuery,
        原始文本: 引用.raw,
      })),
    },
    {
      name: '未匹配引用',
      rows: 未匹配.map((引用) => ({
        文件: 引用.file,
        行号: 引用.line,
        归一化接口: 引用.normalizedPath,
        原始文本: 引用.raw,
        处理建议: '人工确认是否为动态路径、历史废弃调用或后端缺失接口',
      })),
    },
    {
      name: '后端接口调用方',
      rows: 路由清单.map((路由) => ({
        接口编号: 路由.id,
        方法: 路由.method,
        路径: 路由.path,
        模块: 路由.targetModule,
        调用方: 路由.frontendCallers.join('\n') || '待确认',
      })),
    },
  ]);
}

function 解析实体名称() {
  const 源码 = 读取文本('backend/db-layer.js');
  const 匹配 = 源码.match(/const ENTITY_NAMES = \[([\s\S]*?)\];/);
  if (!匹配) return [];
  return 提取字符串常量(匹配[1]);
}

function 安全JSON解析(文本) {
  try {
    return JSON.parse(文本);
  } catch (错误) {
    return null;
  }
}

function 值类型(值) {
  if (值 === null) return 'null';
  if (Array.isArray(值)) return 'array';
  return typeof 值;
}

function 简短值(值) {
  if (值 === null || 值 === undefined) return '';
  const 文本 = typeof 值 === 'string' ? 值 : JSON.stringify(值);
  return 文本.length > 120 ? `${文本.slice(0, 120)}...` : 文本;
}

function 读取实体数据库() {
  const 数据库文件 = path.join(项目根目录, 'backend/crm.db');
  const 结果 = { exists: fs.existsSync(数据库文件), entities: {}, rows: [], errors: [] };
  if (!结果.exists) return 结果;

  const 行 = 查询SqliteJson(数据库文件, 'SELECT entity_name, id, data_json, updated_at FROM entities ORDER BY entity_name, rowid;');
  结果.rows = 行;
  for (const 项 of 行) {
    if (!结果.entities[项.entity_name]) 结果.entities[项.entity_name] = [];
    const 数据 = 安全JSON解析(项.data_json);
    if (!数据) {
      结果.errors.push({ entity: 项.entity_name, id: 项.id, error: 'JSON解析失败' });
    } else {
      结果.entities[项.entity_name].push({ ...数据, __baseline_id: 项.id, __updated_at: 项.updated_at });
    }
  }
  return 结果;
}

function 查询SqliteJson(数据库文件, SQL) {
  try {
    const 输出 = childProcess.execFileSync('sqlite3', ['-readonly', '-json', 数据库文件, SQL], {
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    }).trim();
    return 输出 ? JSON.parse(输出) : [];
  } catch (错误) {
    throw new Error(`SQLite只读查询失败：${错误.message}`);
  }
}

function 字段统计(实体名称, 数据集合) {
  const 字段 = new Map();
  for (const 记录 of 数据集合) {
    for (const [键, 值] of Object.entries(记录)) {
      if (键.startsWith('__')) continue;
      if (!字段.has(键)) 字段.set(键, { entity: 实体名称, field: 键, present: 0, nullish: 0, types: new Set(), samples: [] });
      const 统计 = 字段.get(键);
      统计.present += 1;
      if (值 === null || 值 === undefined || 值 === '') 统计.nullish += 1;
      统计.types.add(值类型(值));
      if (统计.samples.length < 3 && 值 !== null && 值 !== undefined && 值 !== '') 统计.samples.push(简短值(值));
    }
  }
  return Array.from(字段.values()).map((统计) => ({
    实体: 统计.entity,
    字段: 统计.field,
    出现记录数: 统计.present,
    空值记录数: 统计.nullish,
    空值比例: 统计.present ? `${((统计.nullish / 统计.present) * 100).toFixed(2)}%` : '0.00%',
    类型: Array.from(统计.types).sort().join(', '),
    示例值: 统计.samples.join(' | '),
  }));
}

function 按字段计数(数据集合, 字段) {
  const 计数 = new Map();
  for (const 记录 of 数据集合) {
    const 值 = 记录[字段] === undefined || 记录[字段] === null || 记录[字段] === '' ? '空值' : String(记录[字段]);
    计数.set(值, (计数.get(值) || 0) + 1);
  }
  return Array.from(计数.entries()).sort((a, b) => b[1] - a[1]);
}

function 检查重复(数据集合, 字段) {
  const 计数 = new Map();
  for (const 记录 of 数据集合) {
    const 值 = 记录[字段];
    if (!值) continue;
    if (!计数.has(String(值))) 计数.set(String(值), []);
    计数.get(String(值)).push(记录.id || 记录.__baseline_id || '');
  }
  return Array.from(计数.entries())
    .filter((项) => 项[1].length > 1)
    .map(([值, 编号集合]) => ({ 字段, 值, 数量: 编号集合.length, 编号集合: 编号集合.join(', ') }));
}

function 生成数据质量(实体数据) {
  const 异常 = [];
  const 用户 = 实体数据.users || [];
  const 渠道 = 实体数据.partners || [];
  const 渠道编号 = new Set(渠道.map((项) => String(项.id || 项.__baseline_id)));

  for (const 重复 of 检查重复(用户, 'username')) {
    异常.push({ 类型: '重复用户名', 实体: 'users', 原始编号: 重复.编号集合, 详情: `${重复.值} 出现 ${重复.数量} 次`, 建议责任人: '产品负责人、后端负责人' });
  }
  for (const 用户项 of 用户) {
    if (用户项.password && !/^\$2[aby]\$/.test(String(用户项.password))) {
      异常.push({ 类型: '疑似明文密码', 实体: 'users', 原始编号: 用户项.id || 用户项.__baseline_id, 详情: `用户名 ${用户项.username || ''} 存在非哈希密码字段`, 建议责任人: '架构负责人、后端负责人' });
    }
  }
  for (const 渠道项 of 渠道) {
    if (渠道项.parentPartnerId && !渠道编号.has(String(渠道项.parentPartnerId))) {
      异常.push({ 类型: '断裂上级渠道', 实体: 'partners', 原始编号: 渠道项.id || 渠道项.__baseline_id, 详情: `上级渠道 ${渠道项.parentPartnerId} 不存在`, 建议责任人: '产品负责人、数据负责人' });
    }
  }

  for (const 实体名 of ['registrations', 'opportunities', 'quotes', 'orders']) {
    for (const 记录 of (实体数据[实体名] || [])) {
      if (!记录.partnerId && !记录.partnerName && !记录.createdBy) {
        异常.push({ 类型: '缺失渠道来源', 实体: 实体名, 原始编号: 记录.id || 记录.__baseline_id, 详情: '未发现 partnerId、partnerName 或 createdBy', 建议责任人: '产品负责人、数据负责人' });
      }
    }
  }
  return 异常;
}

function 读取审计统计() {
  const 审计文件 = path.join(项目根目录, 'backend/audit.db');
  const 结果 = { exists: fs.existsSync(审计文件), summary: [], groups: [] };
  if (!结果.exists) return 结果;
  const 表存在 = 查询SqliteJson(审计文件, "SELECT name FROM sqlite_master WHERE type='table' AND name='audit_logs';");
  if (!表存在.length) return 结果;
  结果.summary = 查询SqliteJson(审计文件, 'SELECT COUNT(*) AS total, MIN(created_at) AS firstAt, MAX(created_at) AS lastAt FROM audit_logs;');
  结果.groups = 查询SqliteJson(审计文件, `
      SELECT module, action, result, COUNT(*) AS total
      FROM audit_logs
      GROUP BY module, action, result
      ORDER BY total DESC
      LIMIT 200
    ;`);
  return 结果;
}

function 生成关系图(实体数据) {
  const 行 = ['# V2实体关系图', '', `生成时间：${当前时间()}`, '', '```mermaid', 'flowchart LR'];
  const 关系 = new Map();
  for (const [实体名, 记录集合] of Object.entries(实体数据)) {
    行.push(`  ${实体名}[${实体名}]`);
    for (const 记录 of 记录集合) {
      for (const [字段, 值] of Object.entries(记录)) {
        if (!字段.endsWith('Id') && !字段.endsWith('Ids')) continue;
        if (!值) continue;
        const 目标 = 字段.replace(/Ids?$/, 's');
        const 键 = `${实体名}->${目标}:${字段}`;
        关系.set(键, (关系.get(键) || 0) + 1);
      }
    }
  }
  for (const [键, 数量] of Array.from(关系.entries()).sort()) {
    const [左右, 字段] = 键.split(':');
    const [来源, 目标] = 左右.split('->');
    行.push(`  ${来源} -->|${字段} ${数量}| ${目标}`);
  }
  行.push('```', '', '说明：本图基于字段名自动推断，只作为阶段0关系发现线索，正式关系以阶段2 PostgreSQL模型为准。');
  return `${行.join('\n')}\n`;
}

function 写数据基线() {
  const 实体名称 = 解析实体名称();
  const 数据读取 = 读取实体数据库();
  const 实体数据 = 数据读取.entities;
  const 实体统计 = 实体名称.map((名称) => ({
    实体: 名称,
    记录数: (实体数据[名称] || []).length,
    是否在数据库出现: Object.prototype.hasOwnProperty.call(实体数据, 名称) ? '是' : '否',
  }));
  const 未登记实体 = Object.keys(实体数据)
    .filter((名称) => !实体名称.includes(名称))
    .map((名称) => ({ 实体: 名称, 记录数: 实体数据[名称].length, 是否在数据库出现: '是，未登记在ENTITY_NAMES' }));
  const 字段 = [];
  for (const [名称, 记录集合] of Object.entries(实体数据)) 字段.push(...字段统计(名称, 记录集合));
  const 异常 = 生成数据质量(实体数据);
  const 审计 = 读取审计统计();

  写工作簿('docs/baseline/V2数据字典.xlsx', [
    { name: '实体统计', rows: [...实体统计, ...未登记实体] },
    { name: '字段统计', rows: 字段 },
    { name: '审计统计', rows: 审计.groups.map((项) => ({ 模块: 项.module, 动作: 项.action, 结果: 项.result, 数量: 项.total })) },
    { name: '数据异常', rows: 异常 },
  ]);

  const 状态统计 = [];
  for (const [名称, 记录集合] of Object.entries(实体数据)) {
    for (const 字段名 of ['status', 'stage', 'approvalStatus', 'partnerLevel']) {
      const 计数 = 按字段计数(记录集合, 字段名).filter(([值]) => 值 !== '空值');
      for (const [值, 数量] of 计数) 状态统计.push({ 实体: 名称, 字段: 字段名, 值, 数量 });
    }
  }

  写文本('docs/baseline/V2数据质量报告.md', [
    '# V2数据质量报告',
    '',
    `生成时间：${当前时间()}`,
    '',
    '## 数据库状态',
    '',
    `- 业务库：${数据读取.exists ? '已读取 backend/crm.db，只读分析' : '未找到 backend/crm.db'}`,
    `- 审计库：${审计.exists ? '已读取 backend/audit.db，只读分析' : '未找到 backend/audit.db'}`,
    `- 通用实体记录数：${数据读取.rows.length}`,
    `- JSON解析异常数：${数据读取.errors.length}`,
    `- 数据质量异常数：${异常.length}`,
    '',
    '## 实体记录数',
    '',
    '| 实体 | 记录数 |',
    '| --- | ---: |',
    ...[...实体统计, ...未登记实体].map((项) => `| ${项.实体} | ${项.记录数} |`),
    '',
    '## 角色分布',
    '',
    '| 角色 | 数量 |',
    '| --- | ---: |',
    ...按字段计数(实体数据.users || [], 'role').map(([值, 数量]) => `| ${值} | ${数量} |`),
    '',
    '## 状态字段分布',
    '',
    '| 实体 | 字段 | 值 | 数量 |',
    '| --- | --- | --- | ---: |',
    ...状态统计.map((项) => `| ${项.实体} | ${项.字段} | ${项.值} | ${项.数量} |`),
    '',
    '## 异常清单',
    '',
    '| 类型 | 实体 | 原始编号 | 详情 | 建议责任人 |',
    '| --- | --- | --- | --- | --- |',
    ...(异常.length ? 异常.map((项) => `| ${项.类型} | ${项.实体} | ${项.原始编号} | ${String(项.详情).replace(/\|/g, ' ')} | ${项.建议责任人} |`) : ['| 无自动识别异常 | - | - | - | - |']),
    '',
    '## 处理原则',
    '',
    '- 本报告只读分析当前样本库，不修改任何业务数据。',
    '- 疑似异常不等于错误，必须由产品负责人、业务代表和数据负责人确认处理方式。',
    '- 阶段2迁移前，异常处理结论必须分类为自动映射、业务补录、隔离或阻断迁移。',
    '',
  ].join('\n'));

  写文本('docs/baseline/V2实体关系图.md', 生成关系图(实体数据));

  const 价格样本 = {
    generatedAt: 当前时间(),
    note: '阶段0从现有样本库抽取，后续需要业务负责人确认金额逐分一致。',
    quotes: (实体数据.quotes || []).slice(0, 20).map((项) => ({
      id: 项.id,
      quoteNo: 项.quoteNo,
      customerName: 项.customerName,
      status: 项.status,
      totalAmount: 项.totalAmount || 项.amount || 项.total,
      discount: 项.discount,
      items: Array.isArray(项.items) ? 项.items.slice(0, 5) : [],
    })),
    orders: (实体数据.orders || []).slice(0, 20).map((项) => ({
      id: 项.id,
      orderNo: 项.orderNo,
      customerName: 项.customerName,
      status: 项.status,
      totalAmount: 项.totalAmount || 项.amount || 项.total,
      quoteId: 项.quoteId,
    })),
    workloadRules: {
      classifications: (实体数据.implementationWorkloadClassifications || []).length,
      mappings: (实体数据.implementationWorkloadMappings || []).length,
      rules: (实体数据.implementationWorkloadRules || []).length,
      deliveryRules: (实体数据.implementationDeliveryWorkloadRules || []).length,
    },
  };
  写JSON('docs/baseline/价格与工作量计算样本.json', 价格样本);

  return { 实体统计, 字段, 异常, 审计, 实体数据 };
}

function 提取角色(实体数据) {
  const 角色 = new Set((实体数据.users || []).map((用户) => 用户.role).filter(Boolean));
  const 源码 = 读取文本('backend/server.js');
  const 正则 = /role\s*(?:===|!==|:)\s*['"]([A-Za-z0-9_]+)['"]/g;
  let 匹配;
  while ((匹配 = 正则.exec(源码)) !== null) 角色.add(匹配[1]);
  return Array.from(角色).sort();
}

function 写权限与状态基线(实体数据) {
  const 角色 = 提取角色(实体数据);
  const 模块 = ['账号管理', '渠道管理', '客户报备', '商机管理', '报价管理', '订单管理', '产品管理', '审批管理', '开放接口管理', '审计日志'];
  const 动作 = ['列表', '详情', '创建', '修改', '删除', '审批', '导入', '导出', '下载'];
  写工作簿('docs/baseline/现有角色权限矩阵.xlsx', [
    {
      name: '角色权限矩阵',
      rows: 角色.flatMap((角色名) => 模块.flatMap((模块名) => 动作.map((动作名) => ({
        角色: 角色名,
        模块: 模块名,
        动作: 动作名,
        当前实现来源: '阶段0自动建表，待人工按样本账号实测',
        数据范围来源字段: 'region、bigRegion、partnerId、createdBy、owner、assignedStaffId，详见数据范围来源清单',
        允许样本: '待测试负责人补充',
        拒绝样本: '待测试负责人补充',
        阶段3目标: '服务端统一校验',
      })))),
    },
    {
      name: '角色来源',
      rows: 角色.map((角色名) => ({
        角色: 角色名,
        来源: (实体数据.users || []).some((用户) => 用户.role === 角色名) ? '样本用户和代码' : '代码分支',
        说明: '阶段0只冻结现状，阶段3再重建权限模型',
      })),
    },
  ]);

  写文本('docs/baseline/数据范围来源与异常清单.md', [
    '# 数据范围来源与异常清单',
    '',
    `生成时间：${当前时间()}`,
    '',
    '## 当前来源字段',
    '',
    '| 范围类型 | 当前字段或逻辑 | 风险 |',
    '| --- | --- | --- |',
    '| 总部范围 | superadmin | 需要阶段3拆分业务权限和系统管理权限 |',
    '| 区域范围 | region、bigRegion | 需要确认区域字典和历史名称映射 |',
    '| 渠道范围 | partnerId、partnerName、parentPartnerId | 需要确认一级、二级、无层级渠道的数据边界 |',
    '| 本人范围 | createdBy、owner、assignedStaffId、approvedBy | 字段含义不统一，迁移前需定稿 |',
    '| 前端传参 | operatorId、operatorRole、userId、role | 需要阶段3改为服务端会话身份 |',
    '',
    '## 当前自动识别异常',
    '',
    '- 已在 `V2数据质量报告.md` 中列出缺失渠道来源、断裂上级渠道和疑似明文密码。',
    '- 权限允许和拒绝样本需要测试负责人按核心流程补齐。',
    '',
  ].join('\n'));

  const 状态行 = [];
  for (const [实体名, 记录集合] of Object.entries(实体数据)) {
    for (const 字段名 of ['status', 'stage', 'approvalStatus', 'partnerLevel']) {
      for (const [值, 数量] of 按字段计数(记录集合, 字段名).filter(([值]) => 值 !== '空值')) {
        状态行.push(`| ${实体名} | ${字段名} | ${值} | ${数量} | 待产品确认合法迁移 |`);
      }
    }
  }
  写文本('docs/baseline/现有业务状态机.md', [
    '# 现有业务状态机',
    '',
    `生成时间：${当前时间()}`,
    '',
    '## 阶段0结论',
    '',
    '当前文件为状态字段和值的冻结清单。合法迁移动作需要产品负责人和业务代表在阶段0退出会议确认，确认后才允许阶段2和阶段4落库实现。',
    '',
    '| 实体 | 字段 | 当前值 | 样本数量 | 迁移结论 |',
    '| --- | --- | --- | ---: | --- |',
    ...(状态行.length ? 状态行 : ['| 未发现状态样本 | - | - | 0 | 待确认 |']),
    '',
    '## 待补充合法迁移动作',
    '',
    '- 报备：草稿、提交、审核通过、驳回、复制、转商机。',
    '- 商机：创建、阶段推进、跟进、关闭、转报价。',
    '- 报价：创建、预览、提交、审批、驳回、转订单。',
    '- 订单：创建、一级确认、一级驳回、价格调整、状态变更。',
    '',
  ].join('\n'));
}

function 写外部依赖基线(路由清单) {
  const 依赖 = [
    { 编号: 'DEP-001', 名称: '统一身份认证', 类型: '登录认证', 当前证据: 'server.js 中存在 /api/sso/iam/* 和 /api/oauth/*', 生产地址来源: '待运维确认', 认证方式: '待确认', 超时上限: '阶段3设定', 降级方式: '本地应急管理员' },
    { 编号: 'DEP-002', 名称: '企业信息查询', 类型: '外部查询', 当前证据: 'server.js 中存在 /api/company-search 和 /api/open/v1/company-search', 生产地址来源: '待运维确认', 认证方式: '待确认', 超时上限: '阶段6设定', 降级方式: '返回明确失败，不阻断其他业务' },
    { 编号: 'DEP-003', 名称: 'OpenAPI调用方', 类型: '开放接口', 当前证据: `${路由清单.filter((路由) => 路由.path.includes('/open/v1')).length} 个开放接口路由`, 生产地址来源: '待产品确认调用方', 认证方式: '客户端凭据', 超时上限: '阶段4设定', 降级方式: '按调用方权限返回错误码' },
    { 编号: 'DEP-004', 名称: '模拟CRM开放接口', 类型: '模拟接口', 当前证据: 'server.js 中存在 /api/mock/crm-open-api/*', 生产地址来源: '不得进入生产依赖', 认证方式: '模拟', 超时上限: '不适用', 降级方式: '生产禁用' },
  ];
  写工作簿('docs/baseline/外部依赖与集成清单.xlsx', [{ name: '外部依赖', rows: 依赖 }]);
  写文本('docs/baseline/外部依赖降级基线.md', [
    '# 外部依赖降级基线',
    '',
    `生成时间：${当前时间()}`,
    '',
    '| 依赖 | 当前表现 | V3目标降级行为 | 阶段责任 |',
    '| --- | --- | --- | --- |',
    '| 统一身份认证 | 当前存在多套登录入口，统一身份生产参数待确认 | 优先统一身份；统一身份不可用时允许受控本地应急管理员登录 | 阶段3 |',
    '| 企业信息查询 | 当前接口存在，超时、重试和缓存策略待确认 | 设置超时、重试上限、缓存和明确错误，不拖垮主业务 | 阶段6 |',
    '| OpenAPI调用方 | 已有开放接口和客户端管理，调用方清单待确认 | 保持兼容期，按客户端权限、限流和审计执行 | 阶段4 |',
    '| 模拟CRM开放接口 | 当前代码存在模拟路径 | 标记为开发测试用途，生产镜像禁用 | 阶段7 |',
    '',
  ].join('\n'));
}

function 写本轮不做清单() {
  写文本('docs/baseline/本轮明确不做清单.md', [
    '# 本轮明确不做清单',
    '',
    `生成时间：${当前时间()}`,
    '',
    '## 已确认边界',
    '',
    '- 本轮只服务联软总部及其渠道体系，不建设面向多厂商的通用SaaS多租户平台。',
    '- 本轮基于当前功能和当前业务做架构改造，不新增公海池、复杂工作流、营销自动化等新能力。',
    '- V2不维护、不继续重构；V3完成后在停机窗口迁移V2数据。',
    '- PostgreSQL作为唯一业务数据库，Redis承担会话、缓存、限流和任务队列。',
    '- 首发生产优先一台服务器部署，可使用容器；单机不能消除整机单点，必须配异机备份和外部监控。',
    '',
    '## 后续需求池',
    '',
    '| 需求 | 当前结论 | 重新启动条件 |',
    '| --- | --- | --- |',
    '| 公海池 | 本轮不做 | V3核心链路稳定并完成数据迁移后单独立项 |',
    '| 新增渠道运营功能 | 本轮不做 | 现有渠道、报备、商机、报价、订单全部迁移验收后 |',
    '| 新增开放接口资源 | 本轮不做 | 阶段4完成现有开放接口兼容后 |',
    '| 微服务拆分 | 本轮不做 | 单体容量或组织协作成为明确瓶颈后 |',
    '',
  ].join('\n'));
}

function 写生产与迁移模板() {
  写文本('docs/baseline/生产环境确认单.md', [
    '# 生产环境确认单',
    '',
    `生成时间：${当前时间()}`,
    '',
    '| 项目 | 当前值 | 负责人 | 最晚确认时间 |',
    '| --- | --- | --- | --- |',
    '| 操作系统 | 待运维确认 | 运维负责人 | 阶段0退出前 |',
    '| 处理器架构 | 待运维确认 | 运维负责人 | 阶段0退出前 |',
    '| 处理器 | 待运维确认 | 运维负责人 | 阶段0退出前 |',
    '| 内存 | 待运维确认 | 运维负责人 | 阶段0退出前 |',
    '| 磁盘类型和容量 | 待运维确认 | 运维负责人 | 阶段0退出前 |',
    '| 网络带宽 | 待运维确认 | 运维负责人 | 阶段0退出前 |',
    '| 域名和证书 | 待运维确认 | 运维负责人 | 阶段0退出前 |',
    '| 容器版本 | 待运维确认 | 运维负责人 | 阶段0退出前 |',
    '| 异机备份位置 | 待运维确认 | 运维负责人 | 阶段0退出前 |',
    '| 备用服务器 | 待确认是否具备30分钟接管条件 | 产品负责人、运维负责人 | 阶段0退出前 |',
    '',
    '验收说明：不能使用“与现有相同”代替具体参数。没有备用服务器时，必须登记可用性例外和恢复预案。',
    '',
  ].join('\n'));

  写文本('docs/baseline/迁移窗口与联系人清单.md', [
    '# 迁移窗口与联系人清单',
    '',
    `生成时间：${当前时间()}`,
    '',
    '| 项目 | 当前结论 | 负责人 | 备注 |',
    '| --- | --- | --- | --- |',
    '| 允许停机窗口 | 5至8小时 | 产品总负责人 | 用户已确认 |',
    '| 正式日期 | 待阶段8确认 | 产品总负责人 | 至少提前一周通知 |',
    '| V2停写方式 | 待确认 | 运维负责人、后端负责人 | 需要保证一致性快照 |',
    '| 数据快照方式 | 待确认 | 数据负责人 | 阶段2开始演练 |',
    '| 业务通知范围 | 待确认 | 产品负责人 | 联软总部和渠道体系 |',
    '| 迁移总指挥 | 待任命 | 产品总负责人 | 阶段8必须明确 |',
    '| 业务值守人 | 待任命 | 业务代表 | 阶段8必须明确 |',
    '| 回退决策人 | 待任命 | 产品总负责人 | 阶段8必须明确 |',
    '',
  ].join('\n'));
}

function 列出基线文件() {
  const 排除目录 = new Set(['.git', 'node_modules', 'backups', 'upgrade_logs', 'tmp', 'logs']);
  const 排除前缀 = [/^backup/, /^backend\/node_modules$/, /^scripts\/logs$/];
  const 排除后缀 = ['.db', '.db-shm', '.db-wal', '.log', '.zip', '.tar.gz', '.tgz', '.pid'];
  const 排除文件 = new Set([
    'docs/baseline/基线文件摘要.txt',
    'docs/baseline/版本与文件基线.md',
    'docs/baseline/接口契约校验结果.md',
    'docs/baseline/浏览器入口静态检查结果.md',
    'docs/baseline/现有系统回归结果.md',
    'docs/baseline/现有系统性能与资源基线.md',
    'backend/customer-ledger.csv',
  ]);
  const 起点集合 = ['backend', 'frontend', 'scripts', 'docs', 'deploy'];
  const 文件集合 = [];

  function 应排除(相对) {
    if (排除文件.has(相对)) return true;
    const 片段 = 相对.split('/');
    if (片段.some((项) => 排除目录.has(项))) return true;
    if (排除前缀.some((正则) => 正则.test(相对))) return true;
    if (排除后缀.some((后缀) => 相对.endsWith(后缀))) return true;
    if (相对.includes('/uploads/') || 相对.includes('/exports/')) return true;
    return false;
  }

  function 遍历(绝对) {
    const 相对 = 相对路径(绝对);
    if (应排除(相对)) return;
    const 状态 = fs.statSync(绝对);
    if (状态.isDirectory()) {
      for (const 名称 of fs.readdirSync(绝对).sort()) 遍历(path.join(绝对, 名称));
    } else if (状态.isFile()) {
      文件集合.push({ absolute: 绝对, relative: 相对, size: 状态.size });
    }
  }

  for (const 起点 of 起点集合) {
    const 绝对 = path.join(项目根目录, 起点);
    if (fs.existsSync(绝对)) 遍历(绝对);
  }
  for (const 根文件 of ['README.md', 'install.sh', '功能验证测试指南.md', '项目检查报告.md']) {
    const 绝对 = path.join(项目根目录, 根文件);
    if (fs.existsSync(绝对) && !应排除(根文件)) {
      const 状态 = fs.statSync(绝对);
      文件集合.push({ absolute: 绝对, relative: 根文件, size: 状态.size });
    }
  }
  return 文件集合.sort((a, b) => a.relative.localeCompare(b.relative));
}

function 写文件摘要() {
  const 文件集合 = 列出基线文件();
  const 行 = 文件集合.map((文件) => {
    const 摘要 = crypto.createHash('sha256').update(fs.readFileSync(文件.absolute)).digest('hex');
    return `${摘要}  ${String(文件.size).padStart(10, ' ')}  ${文件.relative}`;
  });
  写文本('docs/baseline/基线文件摘要.txt', `${行.join('\n')}\n`);
  return 文件集合;
}

function 读取Git状态() {
  try {
    return childProcess.execSync('git status --short --branch', {
      cwd: 项目根目录,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (错误) {
    return '尚未建立Git仓库';
  }
}

function 写版本文档(文件集合, 路由清单, 数据结果) {
  const 核心文件 = ['backend/server.js', 'backend/db-layer.js', 'backend/audit-db.js', 'frontend/admin-app.js', 'frontend/partner-app.js', 'frontend/mobile-v2-app.js'];
  const 摘要行 = [];
  for (const 文件 of 核心文件) {
    const 绝对 = path.join(项目根目录, 文件);
    if (!fs.existsSync(绝对)) continue;
    const 内容 = fs.readFileSync(绝对);
    摘要行.push(`| ${文件} | ${内容.toString('utf8').split('\n').length} | ${crypto.createHash('sha256').update(内容).digest('hex')} |`);
  }
  写文本('docs/baseline/版本与文件基线.md', [
    '# 版本与文件基线',
    '',
    `生成时间：${当前时间()}`,
    '',
    '## 基线结论',
    '',
    '- V3目录与V2生产目录独立，本阶段不维护、不修改V2。',
    '- 本阶段只新增基线、测试、验收和交接资料，不改业务运行代码。',
    '- Git基线标签建议使用 `v3-legacy-baseline`，标签创建后作为后续改造比较源。',
    '- 数据库、日志、备份包、临时文件、上传导出文件和密钥不纳入版本库。',
    '',
    '## 当前Git状态',
    '',
    '```text',
    读取Git状态() || '无输出',
    '```',
    '',
    '## 核心文件摘要',
    '',
    '| 文件 | 行数 | SHA256 |',
    '| --- | ---: | --- |',
    ...摘要行,
    '',
    '## 总量统计',
    '',
    `- 纳入摘要文件数：${文件集合.length}`,
    `- 后端接口路由数：${路由清单.length}`,
    `- 业务实体种类数：${数据结果.实体统计.length}`,
    `- 自动识别数据异常数：${数据结果.异常.length}`,
    '',
    '## 验收口径',
    '',
    '- 从全新目录检出后，应能还原源码、文档、基线脚本和测试脚本。',
    '- 检出结果不得包含业务数据库、审计库、日志、备份包和生产密钥。',
    '- 后续改造如改变接口、页面、状态、权限或数据字段，必须更新对应基线或形成决策记录。',
    '',
  ].join('\n'));
}

function 写项目团队与交接记录() {
  写文本('docs/stage-records/V3项目团队与职责确认.md', [
    '# V3项目团队与职责确认',
    '',
    `生成时间：${当前时间()}`,
    '',
    '| 角色 | 阶段0责任 | 当前负责人 | 交接资料 | 状态 |',
    '| --- | --- | --- | --- | --- |',
    '| 产品交付总监 | 范围冻结、阶段验收、风险和决策推进 | Codex临时承担，真实负责人待任命 | 阶段0交付记录、待确认业务决策 | 待任命 |',
    '| 架构负责人 | 技术基线、接口契约、版本管理和阶段质量门槛 | Codex临时承担，真实负责人待任命 | 版本与文件基线、接口契约基线 | 待任命 |',
    '| 后端负责人 | 路由、数据读写、外部依赖和接口风险 | 待任命 | 接口风险与迁移归属、V2数据字典 | 待任命 |',
    '| 前端负责人 | 页面入口、接口依赖和端侧范围 | 待任命 | 功能范围清单、页面与接口依赖清单 | 待任命 |',
    '| 测试负责人 | 回归、冒烟、浏览器入口和性能基线 | 待任命 | 现有系统回归结果、测试脚本 | 待任命 |',
    '| 运维负责人 | 生产条件、备份、恢复、迁移窗口 | 待任命 | 生产环境确认单、迁移窗口清单 | 待任命 |',
    '| 业务代表 | 角色、状态、金额和迁移抽样确认 | 待任命 | 业务状态机、价格与工作量样本 | 待任命 |',
    '',
    '说明：Codex在阶段0先以架构师、开发团队和产品交付总监身份建立交付资产；真实组织人员进入后，应在本表补齐姓名、联系方式和验收签字。',
    '',
  ].join('\n'));

  写文本('docs/stage-records/阶段0-交付记录.md', [
    '# 阶段0交付记录',
    '',
    `生成时间：${当前时间()}`,
    '',
    '## 已完成',
    '',
    '- 建立 `.gitignore`，排除数据库、日志、依赖、备份、临时文件和密钥。',
    '- 建立阶段0基线自动生成脚本。',
    '- 生成接口契约、接口风险、页面入口、前端接口依赖、数据字典、数据质量、状态、权限、外部依赖、生产条件和迁移窗口资料。',
    '- 建立阶段0静态契约、浏览器入口、接口冒烟和轻量性能测试脚本。',
    '',
    '## 待人工确认',
    '',
    '- 生产服务器具体配置、备用服务器和异机备份条件。',
    '- 会话闲置时间、最长登录时间和并发设备数。',
    '- 应急管理员保管人、允许来源和启用流程。',
    '- 审计、访问日志、导入文件和导出文件保留期限。',
    '- 开放接口实际调用方和兼容期限。',
    '- 角色权限允许样本、拒绝样本和业务状态合法迁移。',
    '',
    '## 下一步建议',
    '',
    '阶段0退出会先确认待人工事项。确认后进入阶段1工程化骨架，不提前重写报备、报价、订单或前端页面。',
    '',
  ].join('\n'));
}

function 写待确认业务决策() {
  写文本('docs/decisions/待确认业务决策.md', [
    '# 待确认业务决策',
    '',
    `生成时间：${当前时间()}`,
    '',
    '| 编号 | 事项 | 默认建议 | 责任人 | 最晚确认阶段 | 状态 |',
    '| --- | --- | --- | --- | --- | --- |',
    '| DEC-0001 | 生产服务器处理器、内存、磁盘、网络、域名和证书 | 按阶段7单机容器部署目标核对 | 运维负责人 | 阶段0 | 待确认 |',
    '| DEC-0002 | 是否准备30分钟内可接管的备用服务器 | 建议准备备用服务器；没有则登记可用性例外 | 产品负责人、运维负责人 | 阶段0 | 待确认 |',
    '| DEC-0003 | 会话闲置时间、最长登录时间和并发设备数 | 建议闲置2小时、最长12小时、并发设备数按角色控制 | 产品负责人、架构负责人 | 阶段3 | 待确认 |',
    '| DEC-0004 | 应急管理员启用流程、来源地址和双人保管人 | 建议双人保管、白名单来源、全量审计 | 产品负责人、运维负责人 | 阶段3 | 待确认 |',
    '| DEC-0005 | 审计、访问日志、导入文件和导出文件保留期 | 建议审计不少于3年，访问日志不少于180天，文件按合规确认 | 产品负责人、运维负责人 | 阶段2、阶段7 | 待确认 |',
    '| DEC-0006 | V2未知状态、角色、区域和渠道异常处理 | 建议分类为自动映射、业务补录、隔离、阻断迁移 | 产品负责人、数据负责人 | 阶段2 | 待确认 |',
    '| DEC-0007 | 开放接口实际调用方和兼容期限 | 建议建立调用方清单和最少一个版本兼容期 | 产品负责人、后端负责人 | 阶段4 | 待确认 |',
    '| DEC-0008 | 正式迁移日期、停机通知和业务值守人 | 已确认允许停机5至8小时，具体日期阶段8决定 | 产品总负责人 | 阶段8 | 待确认 |',
    '',
  ].join('\n'));
}

function 生成阶段0基线() {
  确保目录(基线目录);
  确保目录(决策目录);
  确保目录(记录目录);

  const 路由清单 = 生成路由清单();
  const 前端引用 = 提取前端接口引用();
  关联前端调用方(路由清单, 前端引用);

  写接口基线(路由清单);
  写页面和接口依赖(路由清单, 前端引用);
  const 数据结果 = 写数据基线();
  写权限与状态基线(数据结果.实体数据);
  写外部依赖基线(路由清单);
  写本轮不做清单();
  写生产与迁移模板();
  写待确认业务决策();
  写项目团队与交接记录();
  const 文件集合 = 写文件摘要();
  写版本文档(文件集合, 路由清单, 数据结果);

  return {
    routeCount: 路由清单.length,
    frontendReferenceCount: 前端引用.length,
    baselineFileCount: 文件集合.length,
    dataIssueCount: 数据结果.异常.length,
  };
}

if (require.main === module) {
  const 结果 = 生成阶段0基线();
  console.log(`阶段0基线生成完成：接口${结果.routeCount}个，前端接口引用${结果.frontendReferenceCount}处，摘要文件${结果.baselineFileCount}个，数据异常${结果.dataIssueCount}项。`);
}

module.exports = {
  项目根目录,
  当前时间,
  生成路由清单,
  提取前端接口引用,
  关联前端调用方,
  未匹配前端引用,
  生成阶段0基线,
};
