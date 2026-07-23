import { spawnSync } from "node:child_process";

const command = process.argv[2];
if (!command) {
  console.error("缺少要执行的工作区命令。");
  process.exit(1);
}

const workspaces = [
  "@lianruan/shared",
  "@lianruan/config",
  "@lianruan/contracts",
  "@lianruan/testing",
  "@lianruan/api",
  "@lianruan/worker",
  "@lianruan/web",
];

for (const workspace of workspaces) {
  console.log("开始执行：" + workspace + " -> " + command);
  const result = spawnSync("npm", ["--workspace", workspace, "run", command, "--if-present"], {
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) {
    console.error("工作区命令失败：" + workspace + " -> " + command);
    process.exit(result.status ?? 1);
  }
}
