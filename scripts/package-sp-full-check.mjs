// SP-FULL 升级包本地校验脚本：只读校验，不改动任何环境。
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const projectRoot = process.cwd();
const targetVersion = process.env.V3_IMAGE_TAG || "3.0.0-stage10.03.20260825-sp001";
const outputRoot = path.join(projectRoot, "tmp", "sp-full-package");
const packageSuffix = process.env.V3_PACKAGE_SUFFIX || "";
const packageName = `lianruan-crm-v3-sp-full-${targetVersion}${packageSuffix}`;
const zipPath = path.join(outputRoot, `${packageName}.zip`);
const shaPath = `${zipPath}.sha256`;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: options.cwd || projectRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.error) throw result.error;
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function fail(message) {
  console.error(`SP-FULL 校验失败：${message}`);
  process.exit(1);
}

for (const file of [zipPath, shaPath]) {
  if (!fs.existsSync(file)) fail(`缺少 ${file}`);
}

console.log("1. 外层 SHA-256 校验。");
const checkOuter = run("shasum", ["-a", "256", "-c", shaPath], { cwd: outputRoot });
if (checkOuter.status !== 0) fail(`外层 SHA-256 校验失败：${checkOuter.stderr || checkOuter.stdout}`);

console.log("2. 独立目录解压。");
const checkDir = fs.mkdtempSync(path.join(os.tmpdir(), "sp-full-check-"));
let unzipResult;
try {
  unzipResult = run("unzip", ["-q", zipPath, "-d", checkDir]);
  if (unzipResult.status !== 0) fail(`unzip 解压失败：${unzipResult.stderr || unzipResult.stdout}`);
  const extractedRoot = path.join(checkDir, packageName);
  if (!fs.existsSync(extractedRoot)) fail("解压后未找到单一顶层目录。");

  console.log("3. 包内 SHA256SUMS 校验。");
  const innerCheck = run("shasum", ["-a", "256", "-c", "manifest/SHA256SUMS"], { cwd: extractedRoot });
  if (innerCheck.status !== 0) fail(`包内 SHA256SUMS 校验失败：${innerCheck.stderr || innerCheck.stdout}`);

  console.log("4. 包元数据读取与断言。");
  const metaText = fs.readFileSync(path.join(extractedRoot, "manifest", "包元数据.env"), "utf8");
  const meta = {};
  for (const line of metaText.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)="?([^"\n]*)"?$/);
    if (m) meta[m[1]] = m[2];
  }
  if (meta.PACKAGE_FAMILY !== "SP") fail("PACKAGE_FAMILY 不是 SP。");
  if (meta.PACKAGE_MODE !== "SP-FULL") fail("PACKAGE_MODE 不是 SP-FULL。");
  if (meta.TARGET_VERSION !== targetVersion) fail(`TARGET_VERSION 不是 ${targetVersion}。`);
  if (meta.SOURCE_VERSION !== "none") fail("SP-FULL 的 SOURCE_VERSION 应为 none。");
  if (meta.ALLOWED_FROM_VERSIONS !== "recognized-v3-migration-lineage") fail("SP-FULL 缺少受控的升级来源范围。");
  if (meta.UPGRADE_SOURCE_POLICY !== "existing-v3-install-and-migration-lineage") fail("SP-FULL 缺少升级来源策略。");

  console.log("5. 关键脚本 bash -n 语法检查。");
  const scripts = [
    "scripts/install-all.sh", "scripts/install.sh", "scripts/install-runtime.sh",
    "scripts/precheck.sh", "scripts/upgrade.sh", "scripts/verify.sh", "scripts/rollback.sh",
    "scripts/start.sh", "scripts/stop.sh", "scripts/migrate-db.sh", "scripts/health-check.sh",
    "scripts/backup.sh", "scripts/load-images.sh", "scripts/generate-secrets.sh",
    "files/scripts/migrate-db.sh", "files/scripts/start.sh", "files/scripts/health-check.sh",
    "tests/smoke.sh",
  ];
  for (const script of scripts) {
    const scriptPath = path.join(extractedRoot, script);
    if (!fs.existsSync(scriptPath)) fail(`包内缺少脚本：${script}`);
    const syntax = run("bash", ["-n", scriptPath]);
    if (syntax.status !== 0) fail(`脚本语法检查失败：${script}`);
  }

  console.log("6. 镜像归档与运行时资产检查。");
  const expectedImages = [
    `images/lianruan-crm-v3-api-${targetVersion}.docker-image`,
    `images/lianruan-crm-v3-worker-${targetVersion}.docker-image`,
    `images/lianruan-crm-v3-nginx-${targetVersion}.docker-image`,
    "images/postgres-16.4-alpine.docker-image",
    "images/redis-7.2.5-alpine.docker-image",
  ];
  for (const image of expectedImages) {
    if (!fs.existsSync(path.join(extractedRoot, image))) fail(`缺少镜像归档：${image}`);
  }
  const 镜像摘要 = path.join(extractedRoot, "images", "sha256sum.txt");
  if (!fs.existsSync(镜像摘要)) fail("缺少镜像归档校验文件。");
  const 校验镜像摘要 = run("shasum", ["-a", "256", "-c", "sha256sum.txt"], { cwd: path.dirname(镜像摘要) });
  if (校验镜像摘要.status !== 0) fail(`镜像归档校验失败：${校验镜像摘要.stderr || 校验镜像摘要.stdout}`);
  for (const name of ["containerd", "containerd-shim-runc-v2", "ctr", "docker", "dockerd", "docker-init", "docker-proxy", "runc"]) {
    if (!fs.existsSync(path.join(extractedRoot, "runtime", "docker-bin", "docker", name))) fail(`缺少 Docker 运行时二进制：${name}`);
  }
  const composeBinaries = fs.readdirSync(path.join(extractedRoot, "runtime", "compose")).filter((name) => name.startsWith("docker-compose-linux-"));
  if (composeBinaries.length === 0) fail("缺少 Docker Compose 离线运行时。");

  console.log("7. 迁移文件与模板版本检查。");
  const migrations = fs.readdirSync(path.join(extractedRoot, "database", "migrations")).filter((name) => name.endsWith(".sql"));
  const rollbackMigrations = migrations.filter((name) => name.endsWith(".rollback.sql") || name.endsWith(".down.sql"));
  const forwardMigrations = migrations.filter((name) => !rollbackMigrations.includes(name));
  if (forwardMigrations.length === 0) fail("未找到任何正向迁移 SQL。");
  console.log(`    正向迁移 ${forwardMigrations.length} 个，回退迁移 ${rollbackMigrations.length} 个。`);
  const expectedForward = fs.readdirSync(path.join(projectRoot, "database", "migrations")).filter((name) => name.endsWith(".sql") && !name.endsWith(".rollback.sql") && !name.endsWith(".down.sql"));
  if (forwardMigrations.length !== expectedForward.length) fail("包内正向迁移数量与仓库不一致。");
  for (const name of expectedForward) {
    if (!migrations.includes(name)) fail(`包内缺少正向迁移：${name}`);
  }
  const deployTemplate = fs.readFileSync(path.join(extractedRoot, "config", "deploy.env.example"), "utf8");
  if (!deployTemplate.includes(`V3_IMAGE_TAG=${targetVersion}`)) fail("config/deploy.env.example 未写入目标版本。");
  const v3Template = fs.readFileSync(path.join(extractedRoot, "config", "v3.env.template"), "utf8");
  if (!v3Template.includes(`V3_BUILD_VERSION=${targetVersion}`)) fail("config/v3.env.template 未写入目标版本。");
  const installScript = fs.readFileSync(path.join(extractedRoot, "scripts", "install.sh"), "utf8");
  if (!installScript.includes(`version_tag="\${V3_IMAGE_TAG:-${targetVersion}}"`)) fail("scripts/install.sh 未写入目标版本默认值。");

  console.log("8. 元数据与 README 模板替换检查。");
  const readme = fs.readFileSync(path.join(extractedRoot, "README.md"), "utf8");
  if (readme.includes("__TARGET_VERSION__") || readme.includes("__PACKAGE_ID__")) fail("README.md 仍有未替换模板占位符。");
  const changeLog = fs.readFileSync(path.join(extractedRoot, "变更说明.md"), "utf8");
  if (changeLog.includes("__TARGET_VERSION__") || changeLog.includes("__PACKAGE_ID__")) fail("变更说明.md 仍有未替换模板占位符。");

  console.log("9. 禁止格式与敏感信息检查。");
  const allFiles = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else allFiles.push(full);
    }
  })(extractedRoot);
  for (const file of allFiles) {
    const relative = path.relative(extractedRoot, file);
    if (/\.(tar|tar\.gz|tgz|7z|rar|gz)$/i.test(relative)) fail(`包内存在禁止格式：${relative}`);
  }
  const sensitivePatterns = [
    [/^[^#\n]*MESSAGE_WECOM_APP_SECRET=[^_][^\n]*/, "v3.env.template 出现企微应用密钥明文"],
    [/^[^#\n]*MESSAGE_WECOM_GROUP_WEBHOOK=[^_][^\n]*/, "v3.env.template 出现企微群机器人明文地址"],
    [/^[^#\n]*MESSAGE_EMAIL_SMTP_PASSWORD=[^_][^\n]*/, "v3.env.template 出现 SMTP 明文密码"],
  ];
  for (const file of allFiles) {
    const relative = path.relative(extractedRoot, file);
    if (!/\.(env|template|example|sh|md)$/.test(relative)) continue;
    const content = fs.readFileSync(file, "utf8");
    for (const [pattern, message] of sensitivePatterns) {
      if (pattern.test(content)) fail(`${message}：${relative}`);
    }
  }

  console.log("10. 文件清单可读性检查。");
  const manifestList = fs.readFileSync(path.join(extractedRoot, "manifest", "文件清单.tsv"), "utf8");
  const manifestLines = manifestList.split("\n").filter((line) => line.trim().length > 0);
  if (manifestLines.length === 0) fail("文件清单为空。");

  console.log(`SP-FULL 本地校验通过：${packageName}（${allFiles.length} 个文件）。`);
} finally {
  fs.rmSync(checkDir, { recursive: true, force: true });
}
