#!/usr/bin/env node

const childProcess = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const 项目根目录 = path.resolve(__dirname, "../..");
const 默认映射文件 = path.join(项目根目录, "database/mapping/v2-entity-mapping.yaml");
const 默认输出目录 = path.join(项目根目录, "tmp/stage8/v2-export-run");
const 敏感键模式 =
  /(password|passwd|pwd|secret|token|apikey|api_key|clientsecret|accesskey|authorization|密码|密钥|令牌)/i;
const 脱敏占位值 = "[已脱敏]";

function 输出用法并退出() {
  console.log(`用法：
node scripts/migration/导出V2只读迁移批次.js \\
  --crm-db "/正式源库/backend/crm.db" \\
  --audit-db "/正式源库/backend/audit.db" \\
  --output-dir "tmp/stage8/v2-export-official" \\
  --label "第一次正式源库只读导出" \\
  --batch-id "S8-RUN-20260727-001" \\
  --page-size 500 \\
  --record-doc "docs/stage-records/阶段8.2-V2只读导出报告.md"

说明：
- 脚本只读打开 SQLite，不修改 V2 源库。
- 导出文件为 NDJSON，一行一条记录。
- 导出内容会对密码、密钥、令牌等敏感字段脱敏。
- 输出目录已存在 manifest.json 时默认停止；需要覆盖时显式增加 --force。`);
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

function SQL文本(值) {
  return `'${String(值).replace(/'/g, "''")}'`;
}

function 执行SQLiteJson(库路径, SQL) {
  const 输出 = childProcess.execFileSync("sqlite3", ["--readonly", "-json", 库路径, SQL], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 200,
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

function 计算文本SHA256(文本) {
  return crypto
    .createHash("sha256")
    .update(文本 ?? "", "utf8")
    .digest("hex");
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

function 读取映射(映射文件) {
  if (!fs.existsSync(映射文件)) {
    return {};
  }
  const 内容 = fs.readFileSync(映射文件, "utf8");
  const 解析结果 = yaml.load(内容);
  return 解析结果?.entities ?? {};
}

function 生成批次编号() {
  const 时间 = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  return `S8-RUN-${时间}`;
}

function 准备输出目录(输出目录, 是否强制) {
  const 清单路径 = path.join(输出目录, "manifest.json");
  if (fs.existsSync(清单路径) && !是否强制) {
    throw new Error(
      `输出目录已有 manifest.json，为避免覆盖演练记录请换目录或增加 --force：${清单路径}`,
    );
  }
  fs.mkdirSync(path.join(输出目录, "exported"), { recursive: true });
  fs.mkdirSync(path.join(输出目录, "reports"), { recursive: true });
  fs.mkdirSync(path.join(输出目录, "logs"), { recursive: true });
  if (是否强制) {
    for (const 文件 of fs.readdirSync(path.join(输出目录, "exported"))) {
      fs.rmSync(path.join(输出目录, "exported", 文件), { force: true });
    }
    for (const 文件 of fs.readdirSync(path.join(输出目录, "reports"))) {
      fs.rmSync(path.join(输出目录, "reports", 文件), { force: true });
    }
  }
}

function 安全文件名(名称) {
  return String(名称).replace(/[^a-zA-Z0-9_.-]/g, "_");
}

function 脱敏JSON(值, 当前路径 = "$") {
  let 脱敏字段数 = 0;
  const 脱敏路径 = [];

  function 处理(节点, 节点路径) {
    if (Array.isArray(节点)) {
      return 节点.map((子项, 下标) => 处理(子项, `${节点路径}[${下标}]`));
    }
    if (!节点 || typeof 节点 !== "object") {
      return 节点;
    }
    const 输出 = {};
    for (const [键, 子值] of Object.entries(节点)) {
      const 字段路径 = `${节点路径}.${键}`;
      if (敏感键模式.test(键)) {
        输出[键] = 脱敏占位值;
        脱敏字段数 += 1;
        脱敏路径.push(字段路径);
        continue;
      }
      输出[键] = 处理(子值, 字段路径);
    }
    return 输出;
  }

  return {
    脱敏后JSON: 处理(值, 当前路径),
    脱敏字段数,
    脱敏路径,
  };
}

function 解析JSON字段(文本, 字段说明) {
  if (文本 === null || 文本 === undefined || String(文本).trim() === "") {
    return null;
  }
  try {
    return JSON.parse(文本);
  } catch (错误) {
    throw new Error(`${字段说明} JSON解析失败：${错误.message}`);
  }
}

function 创建写入器(文件路径) {
  fs.mkdirSync(path.dirname(文件路径), { recursive: true });
  const 文件描述符 = fs.openSync(文件路径, "w");
  return {
    写行(对象) {
      fs.writeSync(文件描述符, JSON.stringify(对象) + "\n", undefined, "utf8");
    },
    关闭() {
      fs.closeSync(文件描述符);
    },
  };
}

function 查询实体清单(CRM库路径) {
  return 执行SQLiteJson(
    CRM库路径,
    "SELECT entity_name AS entityName, COUNT(*) AS sourceCount FROM entities GROUP BY entity_name ORDER BY entity_name;",
  );
}

function 导出CRM实体(配置, 映射) {
  const 实体清单 = 查询实体清单(配置.CRM库路径);
  const 导出文件列表 = [];
  const 实体统计 = [];

  for (const 实体 of 实体清单) {
    const 实体名 = 实体.entityName;
    const 文件路径 = path.join(配置.输出目录, "exported", `entities-${安全文件名(实体名)}.ndjson`);
    const 写入器 = 创建写入器(文件路径);
    let 最后编号 = "";
    let 导出数量 = 0;
    let 脱敏记录数 = 0;
    let 脱敏字段总数 = 0;
    let 最早更新时间 = null;
    let 最晚更新时间 = null;

    try {
      while (true) {
        const 行列表 = 执行SQLiteJson(
          配置.CRM库路径,
          `SELECT id, data_json AS dataJson, updated_at AS updatedAt
           FROM entities
           WHERE entity_name = ${SQL文本(实体名)} AND id > ${SQL文本(最后编号)}
           ORDER BY id
           LIMIT ${配置.页大小};`,
        );
        if (行列表.length === 0) {
          break;
        }

        for (const 行 of 行列表) {
          const 原始文本 = 行.dataJson ?? "";
          const 原始JSON = 解析JSON字段(原始文本, `实体 ${实体名}/${行.id}`);
          const 脱敏结果 = 脱敏JSON(原始JSON);
          if (脱敏结果.脱敏字段数 > 0) {
            脱敏记录数 += 1;
            脱敏字段总数 += 脱敏结果.脱敏字段数;
          }
          写入器.写行({
            batchId: 配置.批次编号,
            recordType: "crm_entity",
            entityName: 实体名,
            sourceId: 行.id,
            sourceUpdatedAt: 行.updatedAt,
            sourceJsonSha256: 计算文本SHA256(原始文本),
            redactedJson: 脱敏结果.脱敏后JSON,
            redactionPaths: 脱敏结果.脱敏路径,
            mapping: {
              covered: Boolean(映射[实体名]),
              batch: 映射[实体名]?.batch ?? "",
              targetTables: 映射[实体名]?.targetTables ?? [],
              strategy: 映射[实体名]?.strategy ?? "",
            },
          });
          导出数量 += 1;
          最后编号 = 行.id;
          最早更新时间 =
            最早更新时间 === null || String(行.updatedAt) < String(最早更新时间)
              ? 行.updatedAt
              : 最早更新时间;
          最晚更新时间 =
            最晚更新时间 === null || String(行.updatedAt) > String(最晚更新时间)
              ? 行.updatedAt
              : 最晚更新时间;
        }
      }
    } finally {
      写入器.关闭();
    }

    const 文件信息 = 文件元信息(文件路径);
    const 映射项 = 映射[实体名];
    导出文件列表.push({
      类型: "CRM实体",
      实体名,
      路径: 文件路径,
      相对路径: path.relative(配置.输出目录, 文件路径),
      记录数: 导出数量,
      大小字节: 文件信息.大小字节,
      SHA256: 文件信息.SHA256,
    });
    实体统计.push({
      实体名,
      源记录数: Number(实体.sourceCount),
      导出记录数: 导出数量,
      数量一致: Number(实体.sourceCount) === 导出数量,
      脱敏记录数,
      脱敏字段数: 脱敏字段总数,
      最早更新时间,
      最晚更新时间,
      映射覆盖: Boolean(映射项),
      迁移批次: 映射项?.batch ?? "",
      目标表: 映射项?.targetTables ?? [],
    });
  }

  return { 实体统计, 导出文件列表 };
}

function 导出审计日志(配置) {
  const 文件路径 = path.join(配置.输出目录, "exported", "audit-logs.ndjson");
  const 写入器 = 创建写入器(文件路径);
  const 汇总 = 执行SQLiteJson(
    配置.审计库路径,
    "SELECT COUNT(*) AS sourceCount, MIN(created_at) AS minCreatedAt, MAX(created_at) AS maxCreatedAt FROM audit_logs;",
  )[0] ?? { sourceCount: 0, minCreatedAt: null, maxCreatedAt: null };
  let 最后编号 = "";
  let 导出数量 = 0;
  let 脱敏记录数 = 0;
  let 脱敏字段总数 = 0;

  try {
    while (true) {
      const 行列表 = 执行SQLiteJson(
        配置.审计库路径,
        `SELECT
          id, created_at AS createdAt, request_id AS requestId,
          actor_user_id AS actorUserId, actor_username AS actorUsername,
          actor_name AS actorName, actor_role AS actorRole,
          module, action, target_type AS targetType, target_id AS targetId,
          target_name AS targetName, result, message, ip, user_agent AS userAgent,
          before_json AS beforeJson, after_json AS afterJson, extra_json AS extraJson
        FROM audit_logs
        WHERE id > ${SQL文本(最后编号)}
        ORDER BY id
        LIMIT ${配置.页大小};`,
      );
      if (行列表.length === 0) {
        break;
      }

      for (const 行 of 行列表) {
        const beforeJson = 解析JSON字段(行.beforeJson, `审计 ${行.id}/before_json`);
        const afterJson = 解析JSON字段(行.afterJson, `审计 ${行.id}/after_json`);
        const extraJson = 解析JSON字段(行.extraJson, `审计 ${行.id}/extra_json`);
        const before脱敏 = 脱敏JSON(beforeJson, "$.beforeJson");
        const after脱敏 = 脱敏JSON(afterJson, "$.afterJson");
        const extra脱敏 = 脱敏JSON(extraJson, "$.extraJson");
        const 脱敏字段数 = before脱敏.脱敏字段数 + after脱敏.脱敏字段数 + extra脱敏.脱敏字段数;
        if (脱敏字段数 > 0) {
          脱敏记录数 += 1;
          脱敏字段总数 += 脱敏字段数;
        }

        写入器.写行({
          batchId: 配置.批次编号,
          recordType: "audit_log",
          sourceId: 行.id,
          createdAt: 行.createdAt,
          requestId: 行.requestId,
          actorUserId: 行.actorUserId,
          actorUsername: 行.actorUsername,
          actorName: 行.actorName,
          actorRole: 行.actorRole,
          module: 行.module,
          action: 行.action,
          targetType: 行.targetType,
          targetId: 行.targetId,
          targetName: 行.targetName,
          result: 行.result,
          message: 行.message,
          ip: 行.ip,
          userAgent: 行.userAgent,
          sourceJsonSha256: 计算文本SHA256(
            [行.beforeJson, 行.afterJson, 行.extraJson].map((值) => 值 ?? "").join("\n"),
          ),
          beforeJson: before脱敏.脱敏后JSON,
          afterJson: after脱敏.脱敏后JSON,
          extraJson: extra脱敏.脱敏后JSON,
          redactionPaths: [...before脱敏.脱敏路径, ...after脱敏.脱敏路径, ...extra脱敏.脱敏路径],
        });
        导出数量 += 1;
        最后编号 = 行.id;
      }
    }
  } finally {
    写入器.关闭();
  }

  const 文件信息 = 文件元信息(文件路径);
  return {
    审计统计: {
      源记录数: Number(汇总.sourceCount),
      导出记录数: 导出数量,
      数量一致: Number(汇总.sourceCount) === 导出数量,
      脱敏记录数,
      脱敏字段数: 脱敏字段总数,
      最早审计时间: 汇总.minCreatedAt,
      最晚审计时间: 汇总.maxCreatedAt,
    },
    导出文件: {
      类型: "审计日志",
      实体名: "audit_logs",
      路径: 文件路径,
      相对路径: path.relative(配置.输出目录, 文件路径),
      记录数: 导出数量,
      大小字节: 文件信息.大小字节,
      SHA256: 文件信息.SHA256,
    },
  };
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

function 写CSV值(值) {
  if (Array.isArray(值)) {
    return 写CSV值(值.join("；"));
  }
  if (typeof 值 === "boolean") {
    return 值 ? "是" : "否";
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
    ...行列表.map((行) => 表头.map((列) => 写CSV值(行[列])).join(",")),
  ].join("\n");
  fs.writeFileSync(文件路径, 内容 + "\n", "utf8");
}

function 生成Markdown报告(清单) {
  const 实体行 = 清单.CRM实体统计.map((行) => ({
    实体名: 行.实体名,
    源记录数: 行.源记录数,
    导出记录数: 行.导出记录数,
    数量一致: 行.数量一致 ? "是" : "否",
    脱敏记录数: 行.脱敏记录数,
    脱敏字段数: 行.脱敏字段数,
    映射覆盖: 行.映射覆盖 ? "是" : "否",
    迁移批次: 行.迁移批次,
  }));
  const 文件行 = 清单.导出文件.map((行) => ({
    类型: 行.类型,
    实体名: 行.实体名,
    记录数: 行.记录数,
    大小字节: 行.大小字节,
    SHA256: `\`${行.SHA256}\``,
    相对路径: `\`${行.相对路径}\``,
  }));
  const 阻断项文本 = 清单.阶段结论.阻断项.length
    ? 清单.阶段结论.阻断项.map((项) => `- ${项}`).join("\n")
    : "- 暂无导出阻断项。";

  return `# 阶段8.2 V2只读导出报告

生成时间：${清单.生成时间}

## 1. 导出结论

| 项目 | 结果 |
| --- | --- |
| 导出标签 | ${清单.导出标签} |
| 批次编号 | ${清单.批次编号} |
| 导出状态 | ${清单.阶段结论.导出状态} |
| CRM源库 | \`${清单.源库.CRM库.路径}\` |
| 审计源库 | \`${清单.源库.审计库.路径}\` |
| CRM完整性检查 | ${清单.源库.CRM库.完整性检查} |
| 审计完整性检查 | ${清单.源库.审计库.完整性检查} |
| CRM源记录总数 | ${清单.汇总.CRM源记录总数} |
| CRM导出记录总数 | ${清单.汇总.CRM导出记录总数} |
| 审计源记录总数 | ${清单.汇总.审计源记录总数} |
| 审计导出记录总数 | ${清单.汇总.审计导出记录总数} |
| 脱敏字段总数 | ${清单.汇总.脱敏字段总数} |

导出阻断项：

${阻断项文本}

## 2. CRM实体导出数量

${Markdown表格(["实体名", "源记录数", "导出记录数", "数量一致", "脱敏记录数", "脱敏字段数", "映射覆盖", "迁移批次"], 实体行)}

## 3. 审计导出数量

| 项目 | 值 |
| --- | --- |
| 源记录数 | ${清单.审计统计.源记录数} |
| 导出记录数 | ${清单.审计统计.导出记录数} |
| 数量一致 | ${清单.审计统计.数量一致 ? "是" : "否"} |
| 脱敏记录数 | ${清单.审计统计.脱敏记录数} |
| 脱敏字段数 | ${清单.审计统计.脱敏字段数} |
| 最早审计时间 | ${清单.审计统计.最早审计时间 ?? ""} |
| 最晚审计时间 | ${清单.审计统计.最晚审计时间 ?? ""} |

## 4. 导出文件

${Markdown表格(["类型", "实体名", "记录数", "大小字节", "SHA256", "相对路径"], 文件行)}

## 5. 安全说明

- 导出 NDJSON 不保存源库明文密码、开放接口密钥、令牌和授权字段。
- 每条记录保留源 JSON SHA256，后续可用于确认源记录未漂移。
- 用户密码和开放接口密钥不能从 V2 明文迁移到 V3，正式迁移时应采用初始化密码、强制改密或重新签发密钥策略。
- 本导出只完成阶段8.2源数据落盘和校验，不代表已经装载到 PostgreSQL。
`;
}

function 写清单和报告(清单, 输出目录) {
  const 报告路径 = path.join(输出目录, "reports", "阶段8.2-V2只读导出报告.md");
  const CSV路径 = path.join(输出目录, "reports", "export-counts.csv");
  const 清单路径 = path.join(输出目录, "manifest.json");
  const SHA路径 = path.join(输出目录, "sha256sum.txt");

  写CSV(
    CSV路径,
    [
      "实体名",
      "源记录数",
      "导出记录数",
      "数量一致",
      "脱敏记录数",
      "脱敏字段数",
      "映射覆盖",
      "迁移批次",
      "目标表",
    ],
    清单.CRM实体统计,
  );
  const Markdown报告 = 生成Markdown报告(清单);
  fs.writeFileSync(报告路径, Markdown报告, "utf8");
  清单.输出文件 = {
    manifest: 清单路径,
    report: 报告路径,
    countCsv: CSV路径,
    sha256sum: SHA路径,
  };
  if (清单.记录文档) {
    fs.mkdirSync(path.dirname(清单.记录文档), { recursive: true });
    fs.writeFileSync(清单.记录文档, Markdown报告, "utf8");
    清单.输出文件.recordDoc = 清单.记录文档;
  }
  fs.writeFileSync(清单路径, JSON.stringify(清单, null, 2) + "\n", "utf8");

  const 校验文件 = [清单路径, 报告路径, CSV路径, ...清单.导出文件.map((文件) => 文件.路径)];
  if (清单.记录文档) {
    校验文件.push(清单.记录文档);
  }
  const 校验内容 = 校验文件
    .map((文件路径) => `${计算文件SHA256(文件路径)}  ${path.relative(输出目录, 文件路径)}`)
    .join("\n");
  fs.writeFileSync(SHA路径, 校验内容 + "\n", "utf8");
}

function 导出批次(配置) {
  准备输出目录(配置.输出目录, 配置.是否强制);
  const 映射 = 读取映射(配置.映射文件);

  for (const [名称, 文件路径] of [
    ["CRM库", 配置.CRM库路径],
    ["审计库", 配置.审计库路径],
  ]) {
    if (!fs.existsSync(文件路径)) {
      throw new Error(`${名称}不存在：${文件路径}`);
    }
  }

  const CRM完整性检查 = 执行SQLite文本(配置.CRM库路径, "PRAGMA integrity_check;");
  const 审计完整性检查 = 执行SQLite文本(配置.审计库路径, "PRAGMA integrity_check;");
  const CRM结果 = 导出CRM实体(配置, 映射);
  const 审计结果 = 导出审计日志(配置);
  const 导出文件 = [...CRM结果.导出文件列表, 审计结果.导出文件];
  const 阻断项 = [];

  if (CRM完整性检查 !== "ok") {
    阻断项.push(`CRM库完整性检查未通过：${CRM完整性检查}`);
  }
  if (审计完整性检查 !== "ok") {
    阻断项.push(`审计库完整性检查未通过：${审计完整性检查}`);
  }
  for (const 行 of CRM结果.实体统计) {
    if (!行.数量一致) {
      阻断项.push(`实体 ${行.实体名} 导出数量不一致：源 ${行.源记录数}，导出 ${行.导出记录数}`);
    }
    if (!行.映射覆盖) {
      阻断项.push(`实体 ${行.实体名} 缺少迁移映射`);
    }
  }
  if (!审计结果.审计统计.数量一致) {
    阻断项.push(
      `审计日志导出数量不一致：源 ${审计结果.审计统计.源记录数}，导出 ${审计结果.审计统计.导出记录数}`,
    );
  }

  const 汇总 = {
    CRM源记录总数: CRM结果.实体统计.reduce((合计, 行) => 合计 + 行.源记录数, 0),
    CRM导出记录总数: CRM结果.实体统计.reduce((合计, 行) => 合计 + 行.导出记录数, 0),
    审计源记录总数: 审计结果.审计统计.源记录数,
    审计导出记录总数: 审计结果.审计统计.导出记录数,
    脱敏字段总数:
      CRM结果.实体统计.reduce((合计, 行) => 合计 + 行.脱敏字段数, 0) + 审计结果.审计统计.脱敏字段数,
  };

  return {
    生成时间: new Date().toISOString(),
    导出标签: 配置.标签,
    批次编号: 配置.批次编号,
    页大小: 配置.页大小,
    映射文件: 配置.映射文件,
    阶段结论: {
      导出状态: 阻断项.length === 0 ? "导出通过" : "导出存在阻断项",
      阻断项,
    },
    源库: {
      CRM库: {
        ...文件元信息(配置.CRM库路径),
        WAL文件: 文件元信息(`${配置.CRM库路径}-wal`),
        SHM文件: 文件元信息(`${配置.CRM库路径}-shm`),
        完整性检查: CRM完整性检查,
      },
      审计库: {
        ...文件元信息(配置.审计库路径),
        WAL文件: 文件元信息(`${配置.审计库路径}-wal`),
        SHM文件: 文件元信息(`${配置.审计库路径}-shm`),
        完整性检查: 审计完整性检查,
      },
    },
    汇总,
    CRM实体统计: CRM结果.实体统计,
    审计统计: 审计结果.审计统计,
    导出文件,
    记录文档: 配置.记录文档,
  };
}

function 主函数() {
  const 参数 = 解析参数(process.argv.slice(2));
  const 配置 = {
    CRM库路径: 绝对路径(要求参数(参数, "crm-db")),
    审计库路径: 绝对路径(要求参数(参数, "audit-db")),
    输出目录: 绝对路径(参数["output-dir"] ?? 默认输出目录),
    标签: 参数.label ?? "V2只读导出批次",
    批次编号: 参数["batch-id"] ?? 生成批次编号(),
    页大小: Number.parseInt(参数["page-size"] ?? "500", 10),
    映射文件: 绝对路径(参数["mapping-file"] ?? 默认映射文件),
    是否强制: 参数.force === "true",
    记录文档: 参数["record-doc"] ? 绝对路径(参数["record-doc"]) : null,
  };
  if (!Number.isInteger(配置.页大小) || 配置.页大小 < 1 || 配置.页大小 > 5000) {
    throw new Error("--page-size 必须是 1 到 5000 的整数");
  }

  const 清单 = 导出批次(配置);
  写清单和报告(清单, 配置.输出目录);
  console.log(`阶段8.2只读导出完成：${清单.输出文件.report}`);
  console.log(`批次编号：${清单.批次编号}`);
  console.log(`导出状态：${清单.阶段结论.导出状态}`);
  console.log(`CRM导出记录：${清单.汇总.CRM导出记录总数}`);
  console.log(`审计导出记录：${清单.汇总.审计导出记录总数}`);
}

try {
  主函数();
} catch (错误) {
  console.error(`阶段8.2只读导出失败：${错误.message}`);
  process.exit(1);
}
