import { spawn } from "node:child_process";

const services = [
  ["接口服务", ["--workspace", "@lianruan/api", "run", "dev"]],
  ["任务进程", ["--workspace", "@lianruan/worker", "run", "dev"]],
  ["前端服务", ["--workspace", "@lianruan/web", "run", "dev"]],
];

const children = services.map(([name, args]) => {
  const child = spawn("npm", args, { stdio: "inherit", shell: false });
  child.on("exit", (code) => {
    if (code && code !== 0) console.error(name + " 已异常退出，退出码：" + code);
  });
  return child;
});

function stop(signal) {
  console.warn("收到停止信号，正在停止阶段1开发进程：" + signal);
  for (const child of children) child.kill(signal);
}

process.once("SIGINT", stop);
process.once("SIGTERM", stop);
