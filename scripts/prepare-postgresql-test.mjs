import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const 项目根目录 = process.cwd();
const compose文件 = path.join(项目根目录, "deploy/local-dev/docker-compose.yml");
const 迁移目录 = path.join(项目根目录, "database/migrations");
const 阶段8暂存包目录 = path.join(项目根目录, "tmp/stage8/v2-postgres-staging-official");
const 测试库名 = process.env.V3_TEST_DATABASE_NAME || "lianruan_crm_v3_test";
const 数据库用户 = process.env.V3_TEST_DATABASE_USER || "lianruan";
const 测试库地址 =
  process.env.V3_TEST_DATABASE_URL ||
  `postgresql://${数据库用户}:lianruan_dev_password@127.0.0.1:5432/${测试库名}`;
const 使用本地Compose = process.env.V3_TEST_USE_LOCAL_COMPOSE !== "false";
const 容器暂存目录 = `/tmp/lianruan-crm-v3-test-${Date.now()}`;

if (!fs.existsSync(迁移目录)) {
  失败("未找到数据库迁移目录：" + 迁移目录);
}

if (!fs.existsSync(阶段8暂存包目录)) {
  失败("未找到阶段8 PostgreSQL 暂存装载包：" + 阶段8暂存包目录);
}

if (使用本地Compose) {
  检查文件(compose文件, "本地 Compose 文件");
  执行("启动本地 PostgreSQL 和 Redis", [
    "docker",
    "compose",
    "-f",
    compose文件,
    "up",
    "-d",
    "postgres",
    "redis",
  ]);
  等待本地PostgreSQL();
  重建本地测试库();
  执行本地容器迁移();
} else {
  失败("当前脚本尚未启用远程 PostgreSQL 自动装载，请使用本地 Compose 或补充 psql 客户端路径。");
}

console.log("PostgreSQL测试库准备完成。");
console.log("V3_TEST_DATABASE_URL=" + 测试库地址);

function 等待本地PostgreSQL() {
  for (let 次数 = 0; 次数 < 60; 次数 += 1) {
    const result = spawnSync(
      "docker",
      [
        "compose",
        "-f",
        compose文件,
        "exec",
        "-T",
        "postgres",
        "pg_isready",
        "-U",
        数据库用户,
        "-d",
        "postgres",
      ],
      { stdio: "ignore" },
    );
    if (result.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }
  失败("本地 PostgreSQL 启动超时。");
}

function 重建本地测试库() {
  const 安全库名 = 校验数据库标识符(测试库名);
  执行("重建 PostgreSQL 测试库", [
    "docker",
    "compose",
    "-f",
    compose文件,
    "exec",
    "-T",
    "postgres",
    "psql",
    "-U",
    数据库用户,
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    `DROP DATABASE IF EXISTS ${安全库名} WITH (FORCE);`,
    "-c",
    `CREATE DATABASE ${安全库名};`,
  ]);
}

function 执行本地容器迁移() {
  执行("准备容器内阶段8装载目录", [
    "docker",
    "compose",
    "-f",
    compose文件,
    "exec",
    "-T",
    "postgres",
    "sh",
    "-lc",
    `rm -rf '${容器暂存目录}' && mkdir -p '${容器暂存目录}/load' '${容器暂存目录}/sql'`,
  ]);
  执行("复制阶段8装载数据", [
    "docker",
    "compose",
    "-f",
    compose文件,
    "cp",
    path.join(阶段8暂存包目录, "load") + "/.",
    `postgres:${容器暂存目录}/load/`,
  ]);
  执行("复制阶段8装载SQL", [
    "docker",
    "compose",
    "-f",
    compose文件,
    "cp",
    path.join(阶段8暂存包目录, "sql") + "/.",
    `postgres:${容器暂存目录}/sql/`,
  ]);

  const 所有迁移 = fs
    .readdirSync(迁移目录)
    .filter(
      (文件名) =>
        文件名.endsWith(".sql") &&
        !文件名.endsWith(".rollback.sql") &&
        !文件名.endsWith(".down.sql"),
    )
    .sort((左, 右) => 左.localeCompare(右, "zh-CN"));
  const 正式落表 = 所有迁移.find((文件名) => 文件名.includes("S8_004"));
  // R 系列依赖 S10 建表（R02 需要 org.business_roles / org.certification_templates）；
  // M11 依赖阶段8导入的启用超管账号。两者必须后置于阶段8暂存装载与正式落表之后执行，且不得重复进入前置列表。
  const 后置迁移 = 所有迁移.filter((文件名) => /(S9_|S10_|R\d{2}_|M11_)/.test(文件名));
  const 前置迁移 = 所有迁移.filter((文件名) => !/(S8_004|S9_|S10_|R\d{2}_|M11_)/.test(文件名));

  for (const 文件名 of 前置迁移) 执行迁移文件(文件名);
  执行阶段8暂存装载();
  if (正式落表) 执行迁移文件(正式落表);
  for (const 文件名 of 后置迁移) 执行迁移文件(文件名);
}

function 执行迁移文件(文件名) {
  const 文件路径 = path.join(迁移目录, 文件名);
  const sql = fs.readFileSync(文件路径, "utf8");
  执行标准输入(
    "执行数据库迁移：" + 文件名,
    [
      "docker",
      "compose",
      "-f",
      compose文件,
      "exec",
      "-T",
      "postgres",
      "psql",
      "-U",
      数据库用户,
      "-d",
      测试库名,
      "-v",
      "ON_ERROR_STOP=1",
      "-f",
      "-",
    ],
    sql,
  );
}

function 执行阶段8暂存装载() {
  const 变量 = [
    "-v",
    "stage8_batch_code=S8-RUN-20260727-001",
    "-v",
    "stage8_source_snapshot_sha256=0c673f14cba14d765ba9221954463348975434b98febee078ae83d36309d1a9a",
    "-v",
    "stage8_source_taken_at=2026-07-27T02:21:47.193Z",
    "-v",
    "stage8_mapping_version=v2-entity-mapping@2026-07-23",
    "-v",
    "stage8_total_records=1091",
  ];
  for (const 文件名 of [
    "00-prepare-migration-staging.sql",
    "01-load-v2-raw-records.sql",
    "02-verify-staging.sql",
  ]) {
    执行("执行阶段8暂存装载：" + 文件名, [
      "docker",
      "compose",
      "-f",
      compose文件,
      "exec",
      "-T",
      "postgres",
      "sh",
      "-lc",
      [
        `cd '${容器暂存目录}'`,
        `psql -U '${数据库用户}' -d '${测试库名}' -v ON_ERROR_STOP=1 ${变量.map(安全Shell参数).join(" ")} -f 'sql/${文件名}'`,
      ].join(" && "),
    ]);
  }
}

function 执行(说明, 命令) {
  console.log("开始：" + 说明);
  const result = spawnSync(命令[0], 命令.slice(1), { stdio: "inherit", shell: false });
  if (result.status !== 0) 失败("失败：" + 说明);
}

function 执行标准输入(说明, 命令, 输入) {
  console.log("开始：" + 说明);
  const result = spawnSync(命令[0], 命令.slice(1), {
    input: 输入,
    stdio: ["pipe", "inherit", "inherit"],
    shell: false,
  });
  if (result.status !== 0) 失败("失败：" + 说明);
}

function 检查文件(文件路径, 名称) {
  if (!fs.existsSync(文件路径)) 失败(`未找到${名称}：${文件路径}`);
}

function 校验数据库标识符(value) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    失败("测试数据库名称不合法：" + value);
  }
  return value;
}

function 安全Shell参数(value) {
  return "'" + String(value).replaceAll("'", "'\\''") + "'";
}

function 失败(message) {
  console.error(message);
  process.exit(1);
}
