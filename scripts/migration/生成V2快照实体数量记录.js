#!/usr/bin/env node

const childProcess = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const 项目根目录 = path.resolve(__dirname, "../..");
const 默认期望源目录 = "/Users/liu/Documents/Codex/lianruan-crm-deploy-v2.2.0 3";
const 默认输出目录 = path.join(项目根目录, "tmp/stage8/v2-snapshot-candidate");
const 默认映射文件 = path.join(项目根目录, "database/mapping/v2-entity-mapping.yaml");

function 输出用法并退出() {
  console.log(`用法：
node scripts/migration/生成V2快照实体数量记录.js \\
  --crm-db "/源路径/crm.db" \\
  --audit-db "/源路径/audit.db" \\
  --output-dir "tmp/stage8/v2-snapshot-candidate" \\
  --label "候选V2快照" \\
  --expected-source-dir "/Users/liu/Documents/Codex/lianruan-crm-deploy-v2.2.0 3" \\
  --record-doc "docs/stage-records/阶段8.1-V2源库实体数量记录.md"

说明：
- 脚本只读打开 SQLite，不修改 V2 源库。
- 如果实际库不在 expected-source-dir 下，报告会标记为“阻断正式迁移”。
- crm.db 与 audit.db 必须显式指定，避免误拿同名候选库。`);
  process.exit(0);
}

function 解析参数(原始参数) {
  const 参数 = {};
  for (let i = 0; i < 原始参数.length; i += 1) {
    const 当前 = 原始参数[i];
    if (当前 === "--help" || 当前 === "-h") {
      输出用法并退出();
    }
    if (!当前.startsWith("--")) {
      throw new Error(`参数格式错误：${当前}`);
    }
    const 等号位置 = 当前.indexOf("=");
    if (等号位置 >= 0) {
      参数[当前.slice(2, 等号位置)] = 当前.slice(等号位置 + 1);
      continue;
    }
    const 键 = 当前.slice(2);
    const 下一个 = 原始参数[i + 1];
    if (!下一个 || 下一个.startsWith("--")) {
      参数[键] = "true";
      continue;
    }
    参数[键] = 下一个;
    i += 1;
  }
  return 参数;
}

function 要求参数(参数, 键) {
  const 值 = 参数[键];
  if (!值) {
    throw new Error(`缺少必要参数：--${键}`);
  }
  return 值;
}

function 绝对路径(输入路径) {
  return path.resolve(项目根目录, 输入路径);
}

function 文件元信息(文件路径) {
  const 元信息 = {
    路径: 文件路径,
    存在: fs.existsSync(文件路径),
    大小字节: 0,
    修改时间: null,
    SHA256: null,
  };
  if (!元信息.存在) {
    return 元信息;
  }
  const 状态 = fs.statSync(文件路径);
  元信息.大小字节 = 状态.size;
  元信息.修改时间 = 状态.mtime.toISOString();
  元信息.SHA256 = 计算文件SHA256(文件路径);
  return 元信息;
}

function 计算文件SHA256(文件路径) {
  const 哈希 = crypto.createHash("sha256");
  const 文件描述符 = fs.openSync(文件路径, "r");
  const 缓冲区 = Buffer.alloc(1024 * 1024 * 8);
  try {
    let 读取字节数 = 0;
    do {
      读取字节数 = fs.readSync(文件描述符, 缓冲区, 0, 缓冲区.length, null);
      if (读取字节数 > 0) {
        哈希.update(缓冲区.subarray(0, 读取字节数));
      }
    } while (读取字节数 > 0);
  } finally {
    fs.closeSync(文件描述符);
  }
  return 哈希.digest("hex");
}

function 执行SQLiteJson(库路径, SQL) {
  const 输出 = childProcess.execFileSync("sqlite3", ["--readonly", "-json", 库路径, SQL], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 80,
  });
  const 清理后输出 = 输出.trim();
  if (!清理后输出) {
    return [];
  }
  return JSON.parse(清理后输出);
}

function 执行SQLite文本(库路径, SQL) {
  return childProcess
    .execFileSync("sqlite3", ["--readonly", 库路径, SQL], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 20,
    })
    .trim();
}

function 读取映射(映射文件) {
  if (!fs.existsSync(映射文件)) {
    return {};
  }
  const 内容 = fs.readFileSync(映射文件, "utf8");
  const 解析结果 = yaml.load(内容);
  return 解析结果?.entities ?? {};
}

function 取第一行数值(行, 候选键) {
  for (const 键 of 候选键) {
    if (Object.prototype.hasOwnProperty.call(行, 键)) {
      return 行[键];
    }
  }
  return null;
}

function 查询库基础信息(库路径) {
  return {
    完整性检查: 执行SQLite文本(库路径, "PRAGMA integrity_check;"),
    日志模式: 执行SQLite文本(库路径, "PRAGMA journal_mode;"),
    页面大小: 取第一行数值(执行SQLiteJson(库路径, "PRAGMA page_size;")[0] ?? {}, ["page_size"]),
    页面数量: 取第一行数值(执行SQLiteJson(库路径, "PRAGMA page_count;")[0] ?? {}, ["page_count"]),
    空闲页面数量: 取第一行数值(执行SQLiteJson(库路径, "PRAGMA freelist_count;")[0] ?? {}, [
      "freelist_count",
    ]),
    用户版本: 取第一行数值(执行SQLiteJson(库路径, "PRAGMA user_version;")[0] ?? {}, [
      "user_version",
    ]),
    表与索引: 执行SQLiteJson(
      库路径,
      "SELECT type AS 类型, name AS 名称, COALESCE(tbl_name, '') AS 所属表, COALESCE(sql, '') AS 建表语句 FROM sqlite_master WHERE type IN ('table','index','trigger','view') ORDER BY type, name;",
    ),
  };
}

function 查询实体统计(库路径, 映射) {
  const 汇总行 =
    执行SQLiteJson(
      库路径,
      `SELECT
      COUNT(*) AS 总记录数,
      COUNT(DISTINCT entity_name) AS 实体类型数,
      SUM(CASE WHEN entity_name IS NULL OR trim(entity_name) = '' THEN 1 ELSE 0 END) AS 空实体名数,
      SUM(CASE WHEN id IS NULL OR trim(id) = '' THEN 1 ELSE 0 END) AS 空编号数,
      MIN(updated_at) AS 最早更新时间,
      MAX(updated_at) AS 最晚更新时间
    FROM entities;`,
    )[0] ?? {};

  const 基础行 = 执行SQLiteJson(
    库路径,
    `SELECT
      entity_name AS 实体名,
      COUNT(*) AS 源记录数,
      COUNT(DISTINCT id) AS 唯一编号数,
      COUNT(*) - COUNT(DISTINCT id) AS 重复编号数,
      SUM(CASE WHEN id IS NULL OR trim(id) = '' THEN 1 ELSE 0 END) AS 空编号数,
      SUM(CASE WHEN data_json IS NULL OR trim(data_json) = '' OR json_valid(data_json) = 0 THEN 1 ELSE 0 END) AS 非法JSON数,
      SUM(CASE
        WHEN data_json LIKE '%"password"%'
          OR data_json LIKE '%"secret"%'
          OR data_json LIKE '%"token"%'
          OR data_json LIKE '%"apiKey"%'
          OR data_json LIKE '%"密钥"%'
        THEN 1 ELSE 0 END
      ) AS 含敏感键记录数,
      MIN(updated_at) AS 最早更新时间,
      MAX(updated_at) AS 最晚更新时间
    FROM entities
    GROUP BY entity_name
    ORDER BY entity_name;`,
  );

  const 样本行 = 执行SQLiteJson(
    库路径,
    `SELECT entity_name AS 实体名, id AS 编号
     FROM (
       SELECT entity_name, id, ROW_NUMBER() OVER (PARTITION BY entity_name ORDER BY id) AS 序号
       FROM entities
     )
     WHERE 序号 <= 3
     ORDER BY entity_name, id;`,
  );
  const 样本编号 = new Map();
  for (const 行 of 样本行) {
    const 列表 = 样本编号.get(行.实体名) ?? [];
    列表.push(行.编号);
    样本编号.set(行.实体名, 列表);
  }

  const 实体明细 = 基础行.map((行) => {
    const 映射项 = 映射[行.实体名];
    const 阻断原因 = [];
    if (!映射项) {
      阻断原因.push("缺少V2到V3迁移映射");
    }
    if (Number(行.重复编号数) > 0) {
      阻断原因.push("存在重复编号");
    }
    if (Number(行.空编号数) > 0) {
      阻断原因.push("存在空编号");
    }
    if (Number(行.非法JSON数) > 0) {
      阻断原因.push("存在非法JSON");
    }
    return {
      ...行,
      样本编号: 样本编号.get(行.实体名) ?? [],
      是否覆盖迁移映射: Boolean(映射项),
      迁移批次: 映射项?.batch ?? "",
      目标表: 映射项?.targetTables ?? [],
      处理策略: 映射项?.strategy ?? "",
      是否阻断迁移: 阻断原因.length > 0,
      异常说明: 阻断原因.join("；"),
    };
  });

  return { 汇总: 汇总行, 明细: 实体明细 };
}

function 查询审计统计(库路径) {
  const 汇总 =
    执行SQLiteJson(
      库路径,
      `SELECT
      COUNT(*) AS 审计总数,
      COUNT(DISTINCT id) AS 唯一审计编号数,
      COUNT(*) - COUNT(DISTINCT id) AS 重复审计编号数,
      SUM(CASE WHEN id IS NULL OR trim(id) = '' THEN 1 ELSE 0 END) AS 空审计编号数,
      MIN(created_at) AS 最早审计时间,
      MAX(created_at) AS 最晚审计时间,
      SUM(CASE WHEN result = 'success' THEN 1 ELSE 0 END) AS 成功数量,
      SUM(CASE WHEN result <> 'success' THEN 1 ELSE 0 END) AS 非成功数量,
      SUM(CASE WHEN before_json IS NOT NULL AND trim(before_json) <> '' AND json_valid(before_json) = 0 THEN 1 ELSE 0 END) AS before_json非法数,
      SUM(CASE WHEN after_json IS NOT NULL AND trim(after_json) <> '' AND json_valid(after_json) = 0 THEN 1 ELSE 0 END) AS after_json非法数,
      SUM(CASE WHEN extra_json IS NOT NULL AND trim(extra_json) <> '' AND json_valid(extra_json) = 0 THEN 1 ELSE 0 END) AS extra_json非法数
    FROM audit_logs;`,
    )[0] ?? {};

  const 模块统计 = 执行SQLiteJson(
    库路径,
    "SELECT module AS 模块, COUNT(*) AS 数量 FROM audit_logs GROUP BY module ORDER BY module;",
  );
  const 动作统计 = 执行SQLiteJson(
    库路径,
    "SELECT action AS 动作, COUNT(*) AS 数量 FROM audit_logs GROUP BY action ORDER BY action;",
  );
  const 结果统计 = 执行SQLiteJson(
    库路径,
    "SELECT result AS 结果, COUNT(*) AS 数量 FROM audit_logs GROUP BY result ORDER BY result;",
  );
  const 模块动作结果统计 = 执行SQLiteJson(
    库路径,
    "SELECT module AS 模块, action AS 动作, result AS 结果, COUNT(*) AS 数量 FROM audit_logs GROUP BY module, action, result ORDER BY module, action, result;",
  );

  return { 汇总, 模块统计, 动作统计, 结果统计, 模块动作结果统计 };
}

function 转CSV值(值) {
  if (Array.isArray(值)) {
    return 转CSV值(值.join("；"));
  }
  const 字符串 = 值 === null || 值 === undefined ? "" : String(值);
  if (/[",\n\r]/.test(字符串)) {
    return `"${字符串.replace(/"/g, '""')}"`;
  }
  return 字符串;
}

function 写CSV(文件路径, 表头, 行列表) {
  const 内容 = [
    表头.join(","),
    ...行列表.map((行) => 表头.map((列) => 转CSV值(行[列])).join(",")),
  ].join("\n");
  fs.writeFileSync(文件路径, 内容 + "\n", "utf8");
}

function Markdown表格(表头, 行列表) {
  const 行转文本 = (行) =>
    `| ${表头.map((列) => String(行[列] ?? "").replace(/\|/g, "\\|")).join(" | ")} |`;
  return [
    `| ${表头.join(" | ")} |`,
    `| ${表头.map(() => "---").join(" | ")} |`,
    ...行列表.map(行转文本),
  ].join("\n");
}

function 生成Markdown报告(报告) {
  const 实体表 = 报告.CRM库.实体统计.明细.map((行) => ({
    实体名: 行.实体名,
    源记录数: 行.源记录数,
    唯一编号数: 行.唯一编号数,
    非法JSON数: 行.非法JSON数,
    最早更新时间: 行.最早更新时间,
    最晚更新时间: 行.最晚更新时间,
    映射覆盖: 行.是否覆盖迁移映射 ? "是" : "否",
    迁移批次: 行.迁移批次,
    阻断: 行.是否阻断迁移 ? "是" : "否",
  }));
  const 模块表 = 报告.审计库.审计统计.模块统计.map((行) => ({
    模块: 行.模块,
    数量: 行.数量,
  }));
  const 阻断项文本 = 报告.阶段结论.阻断正式迁移原因.length
    ? 报告.阶段结论.阻断正式迁移原因.map((项) => `- ${项}`).join("\n")
    : "- 暂无正式迁移阻断项。";

  return `# 阶段8.1 V2源库实体数量记录

生成时间：${报告.生成时间}

## 1. 记录结论

| 项目 | 结果 |
| --- | --- |
| 记录标签 | ${报告.记录标签} |
| 源库确认状态 | ${报告.阶段结论.源库确认状态} |
| 候选演练状态 | ${报告.阶段结论.候选演练状态} |
| 期望源目录 | \`${报告.期望源目录}\` |
| 实际CRM库 | \`${报告.CRM库.文件.路径}\` |
| 实际审计库 | \`${报告.审计库.文件.路径}\` |
| CRM完整性检查 | ${报告.CRM库.基础信息.完整性检查} |
| 审计完整性检查 | ${报告.审计库.基础信息.完整性检查} |
| CRM实体总数 | ${报告.CRM库.实体统计.汇总.总记录数 ?? 0} |
| 审计日志总数 | ${报告.审计库.审计统计.汇总.审计总数 ?? 0} |

正式迁移阻断项：

${阻断项文本}

## 2. 源文件指纹

| 文件 | 存在 | 大小字节 | 修改时间 | SHA256 |
| --- | --- | --- | --- | --- |
| crm.db | ${报告.CRM库.文件.存在 ? "是" : "否"} | ${报告.CRM库.文件.大小字节} | ${报告.CRM库.文件.修改时间 ?? ""} | \`${报告.CRM库.文件.SHA256 ?? ""}\` |
| crm.db-wal | ${报告.CRM库.WAL文件.存在 ? "是" : "否"} | ${报告.CRM库.WAL文件.大小字节} | ${报告.CRM库.WAL文件.修改时间 ?? ""} | \`${报告.CRM库.WAL文件.SHA256 ?? ""}\` |
| crm.db-shm | ${报告.CRM库.SHM文件.存在 ? "是" : "否"} | ${报告.CRM库.SHM文件.大小字节} | ${报告.CRM库.SHM文件.修改时间 ?? ""} | \`${报告.CRM库.SHM文件.SHA256 ?? ""}\` |
| audit.db | ${报告.审计库.文件.存在 ? "是" : "否"} | ${报告.审计库.文件.大小字节} | ${报告.审计库.文件.修改时间 ?? ""} | \`${报告.审计库.文件.SHA256 ?? ""}\` |
| audit.db-wal | ${报告.审计库.WAL文件.存在 ? "是" : "否"} | ${报告.审计库.WAL文件.大小字节} | ${报告.审计库.WAL文件.修改时间 ?? ""} | \`${报告.审计库.WAL文件.SHA256 ?? ""}\` |
| audit.db-shm | ${报告.审计库.SHM文件.存在 ? "是" : "否"} | ${报告.审计库.SHM文件.大小字节} | ${报告.审计库.SHM文件.修改时间 ?? ""} | \`${报告.审计库.SHM文件.SHA256 ?? ""}\` |

## 3. CRM实体数量

${Markdown表格(["实体名", "源记录数", "唯一编号数", "非法JSON数", "最早更新时间", "最晚更新时间", "映射覆盖", "迁移批次", "阻断"], 实体表)}

## 4. 审计日志统计

| 项目 | 数量或时间 |
| --- | --- |
| 审计总数 | ${报告.审计库.审计统计.汇总.审计总数 ?? 0} |
| 唯一审计编号数 | ${报告.审计库.审计统计.汇总.唯一审计编号数 ?? 0} |
| 重复审计编号数 | ${报告.审计库.审计统计.汇总.重复审计编号数 ?? 0} |
| 空审计编号数 | ${报告.审计库.审计统计.汇总.空审计编号数 ?? 0} |
| 成功数量 | ${报告.审计库.审计统计.汇总.成功数量 ?? 0} |
| 非成功数量 | ${报告.审计库.审计统计.汇总.非成功数量 ?? 0} |
| 最早审计时间 | ${报告.审计库.审计统计.汇总.最早审计时间 ?? ""} |
| 最晚审计时间 | ${报告.审计库.审计统计.汇总.最晚审计时间 ?? ""} |
| before_json非法数 | ${报告.审计库.审计统计.汇总.before_json非法数 ?? 0} |
| after_json非法数 | ${报告.审计库.审计统计.汇总.after_json非法数 ?? 0} |
| extra_json非法数 | ${报告.审计库.审计统计.汇总.extra_json非法数 ?? 0} |

${Markdown表格(["模块", "数量"], 模块表)}

## 5. 交付文件

| 文件 | 说明 |
| --- | --- |
| \`${报告.输出文件.manifest}\` | 机器可读完整记录 |
| \`${报告.输出文件.entityCountsCsv}\` | CRM实体数量明细 |
| \`${报告.输出文件.auditCountsCsv}\` | 审计模块动作结果统计 |
| \`${报告.输出文件.markdown}\` | 本Markdown报告副本 |
| \`${报告.输出文件.sha256sum}\` | 本次输出文件校验摘要 |

## 6. 阶段8.1后续动作

1. 由用户确认正式源库路径。如果正式源库确实是候选路径，需要书面确认后重新生成“正式源库快照记录”。
2. 停写后重新执行本脚本，确认实体数量和最后更新时间不再变化。
3. 继续开发 V2 只读导出、PostgreSQL 暂存装载、数量守恒校验和迁移演练报告。
4. 在第一轮测试迁移通过前，不得执行正式切换或对生产库装载业务数据。
`;
}

function 生成报告(配置) {
  const 映射 = 读取映射(配置.映射文件);
  const 期望CRM库 = path.join(配置.期望源目录, "crm.db");
  const 期望审计库 = path.join(配置.期望源目录, "audit.db");
  const 阻断正式迁移原因 = [];

  if (!fs.existsSync(期望CRM库)) {
    阻断正式迁移原因.push(`期望源目录未找到 crm.db：${期望CRM库}`);
  }
  if (!fs.existsSync(期望审计库)) {
    阻断正式迁移原因.push(`期望源目录未找到 audit.db：${期望审计库}`);
  }
  if (path.resolve(配置.CRM库路径) !== path.resolve(期望CRM库)) {
    阻断正式迁移原因.push("实际CRM库不在用户指定的期望源目录，本次只能作为候选源库记录");
  }
  if (path.resolve(配置.审计库路径) !== path.resolve(期望审计库)) {
    阻断正式迁移原因.push("实际审计库不在用户指定的期望源目录，本次只能作为候选源库记录");
  }

  for (const [名称, 文件路径] of [
    ["CRM库", 配置.CRM库路径],
    ["审计库", 配置.审计库路径],
  ]) {
    if (!fs.existsSync(文件路径)) {
      throw new Error(`${名称}不存在：${文件路径}`);
    }
  }

  const CRM基础信息 = 查询库基础信息(配置.CRM库路径);
  const 审计基础信息 = 查询库基础信息(配置.审计库路径);
  const 实体统计 = 查询实体统计(配置.CRM库路径, 映射);
  const 审计统计 = 查询审计统计(配置.审计库路径);

  if (CRM基础信息.完整性检查 !== "ok") {
    阻断正式迁移原因.push(`CRM库完整性检查未通过：${CRM基础信息.完整性检查}`);
  }
  if (审计基础信息.完整性检查 !== "ok") {
    阻断正式迁移原因.push(`审计库完整性检查未通过：${审计基础信息.完整性检查}`);
  }
  const 实体阻断项 = 实体统计.明细.filter((行) => 行.是否阻断迁移);
  if (实体阻断项.length > 0) {
    阻断正式迁移原因.push(`存在 ${实体阻断项.length} 类CRM实体有迁移阻断项`);
  }
  const 审计汇总 = 审计统计.汇总;
  if (Number(审计汇总.重复审计编号数 ?? 0) > 0 || Number(审计汇总.空审计编号数 ?? 0) > 0) {
    阻断正式迁移原因.push("审计日志存在空编号或重复编号");
  }
  if (
    Number(审计汇总.before_json非法数 ?? 0) > 0 ||
    Number(审计汇总.after_json非法数 ?? 0) > 0 ||
    Number(审计汇总.extra_json非法数 ?? 0) > 0
  ) {
    阻断正式迁移原因.push("审计日志JSON字段存在非法内容");
  }

  const 输出文件 = {
    manifest: path.join(配置.输出目录, "manifest.json"),
    entityCountsCsv: path.join(配置.输出目录, "entity-counts.csv"),
    auditCountsCsv: path.join(配置.输出目录, "audit-module-action-counts.csv"),
    markdown: path.join(配置.输出目录, "V2源库实体数量记录.md"),
    sha256sum: path.join(配置.输出目录, "sha256sum.txt"),
  };
  if (配置.记录文档) {
    输出文件.recordDoc = 配置.记录文档;
  }

  const 候选演练可继续 =
    CRM基础信息.完整性检查 === "ok" &&
    审计基础信息.完整性检查 === "ok" &&
    实体阻断项.length === 0 &&
    Number(审计汇总.重复审计编号数 ?? 0) === 0 &&
    Number(审计汇总.空审计编号数 ?? 0) === 0 &&
    Number(审计汇总.before_json非法数 ?? 0) === 0 &&
    Number(审计汇总.after_json非法数 ?? 0) === 0 &&
    Number(审计汇总.extra_json非法数 ?? 0) === 0;

  return {
    生成时间: new Date().toISOString(),
    记录标签: 配置.标签,
    期望源目录: 配置.期望源目录,
    映射文件: 配置.映射文件,
    阶段结论: {
      源库确认状态: 阻断正式迁移原因.length > 0 ? "阻断正式迁移" : "已确认正式源库",
      候选演练状态: 候选演练可继续 ? "可继续候选演练" : "候选演练也需先处理异常",
      阻断正式迁移原因,
    },
    CRM库: {
      文件: 文件元信息(配置.CRM库路径),
      WAL文件: 文件元信息(`${配置.CRM库路径}-wal`),
      SHM文件: 文件元信息(`${配置.CRM库路径}-shm`),
      基础信息: CRM基础信息,
      实体统计,
    },
    审计库: {
      文件: 文件元信息(配置.审计库路径),
      WAL文件: 文件元信息(`${配置.审计库路径}-wal`),
      SHM文件: 文件元信息(`${配置.审计库路径}-shm`),
      基础信息: 审计基础信息,
      审计统计,
    },
    输出文件,
  };
}

function 写报告(报告) {
  fs.mkdirSync(path.dirname(报告.输出文件.manifest), { recursive: true });
  if (报告.输出文件.recordDoc) {
    fs.mkdirSync(path.dirname(报告.输出文件.recordDoc), { recursive: true });
  }

  const 实体CSV行 = 报告.CRM库.实体统计.明细.map((行) => ({
    ...行,
    是否覆盖迁移映射: 行.是否覆盖迁移映射 ? "是" : "否",
    是否阻断迁移: 行.是否阻断迁移 ? "是" : "否",
  }));

  写CSV(
    报告.输出文件.entityCountsCsv,
    [
      "实体名",
      "源记录数",
      "唯一编号数",
      "重复编号数",
      "空编号数",
      "非法JSON数",
      "含敏感键记录数",
      "最早更新时间",
      "最晚更新时间",
      "样本编号",
      "是否覆盖迁移映射",
      "迁移批次",
      "目标表",
      "处理策略",
      "是否阻断迁移",
      "异常说明",
    ],
    实体CSV行,
  );
  写CSV(
    报告.输出文件.auditCountsCsv,
    ["模块", "动作", "结果", "数量"],
    报告.审计库.审计统计.模块动作结果统计,
  );

  const Markdown内容 = 生成Markdown报告(报告);
  fs.writeFileSync(报告.输出文件.markdown, Markdown内容, "utf8");
  if (报告.输出文件.recordDoc) {
    fs.writeFileSync(报告.输出文件.recordDoc, Markdown内容, "utf8");
  }
  fs.writeFileSync(报告.输出文件.manifest, JSON.stringify(报告, null, 2) + "\n", "utf8");

  const 校验文件列表 = [
    报告.输出文件.manifest,
    报告.输出文件.entityCountsCsv,
    报告.输出文件.auditCountsCsv,
    报告.输出文件.markdown,
  ];
  if (报告.输出文件.recordDoc) {
    校验文件列表.push(报告.输出文件.recordDoc);
  }
  const 校验内容 = 校验文件列表
    .map(
      (文件路径) =>
        `${文件元信息(文件路径).SHA256}  ${path.relative(报告.输出文件.manifest ? path.dirname(报告.输出文件.manifest) : 项目根目录, 文件路径)}`,
    )
    .join("\n");
  fs.writeFileSync(报告.输出文件.sha256sum, 校验内容 + "\n", "utf8");
}

function 主函数() {
  const 参数 = 解析参数(process.argv.slice(2));
  const 配置 = {
    CRM库路径: 绝对路径(要求参数(参数, "crm-db")),
    审计库路径: 绝对路径(要求参数(参数, "audit-db")),
    输出目录: 绝对路径(参数["output-dir"] ?? 默认输出目录),
    标签: 参数.label ?? "V2源库快照",
    期望源目录: path.resolve(参数["expected-source-dir"] ?? 默认期望源目录),
    映射文件: 绝对路径(参数["mapping-file"] ?? 默认映射文件),
    记录文档: 参数["record-doc"] ? 绝对路径(参数["record-doc"]) : null,
  };
  const 报告 = 生成报告(配置);
  写报告(报告);
  console.log(`阶段8.1源库实体数量记录已生成：${报告.输出文件.markdown}`);
  if (报告.输出文件.recordDoc) {
    console.log(`阶段记录已同步：${报告.输出文件.recordDoc}`);
  }
  console.log(`源库确认状态：${报告.阶段结论.源库确认状态}`);
  if (报告.阶段结论.阻断正式迁移原因.length > 0) {
    console.log("正式迁移阻断项：");
    for (const 原因 of 报告.阶段结论.阻断正式迁移原因) {
      console.log(`- ${原因}`);
    }
  }
}

try {
  主函数();
} catch (错误) {
  console.error(`阶段8.1源库实体数量记录生成失败：${错误.message}`);
  process.exit(1);
}
