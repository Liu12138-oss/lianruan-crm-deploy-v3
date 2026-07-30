# GitHub更新操作说明

本文档用于说明如何把本地 `lianruan-crm-deploy-v3` 项目更新到 GitHub 仓库，供后续接手人员按步骤操作。

## 一、核心思路

1. 只在 V3 项目目录中操作，不在旧 V2 目录中提交或推送。
2. 每次更新前先检查当前分支、远端仓库和待提交文件。
3. 确认没有 `.env`、数据库、日志、依赖目录、压缩包等本地运行文件后再提交。
4. 使用清晰的中文提交信息记录本次更新内容。
5. 推送到 V3 仓库的 `main` 分支，并在推送后再次确认远端提交。

## 二、项目固定信息

本地项目目录：

```bash
cd "/Users/liu/Documents/Codex/lianruan-crm-deploy-v3"
```

GitHub仓库地址：

```bash
git@github.com:Liu12138-oss/lianruan-crm-deploy-v3.git
```

主分支：

```bash
main
```

## 三、首次配置远端仓库

如果本地仓库还没有远端地址，执行：

```bash
git remote add origin git@github.com:Liu12138-oss/lianruan-crm-deploy-v3.git
```

如果已经存在远端地址，但不是 V3 仓库，执行：

```bash
git remote set-url origin git@github.com:Liu12138-oss/lianruan-crm-deploy-v3.git
```

检查远端地址：

```bash
git remote -v
```

期望看到：

```text
origin  git@github.com:Liu12138-oss/lianruan-crm-deploy-v3.git (fetch)
origin  git@github.com:Liu12138-oss/lianruan-crm-deploy-v3.git (push)
```

## 四、每次更新到 GitHub 的完整流程

进入 V3 项目目录：

```bash
cd "/Users/liu/Documents/Codex/lianruan-crm-deploy-v3"
```

确认当前分支：

```bash
git branch --show-current
```

如果不是 `main`，切换到 `main`：

```bash
git switch main
```

查看本地改动：

```bash
git status --short --branch
```

查看改动摘要：

```bash
git diff --stat
```

检查远端地址：

```bash
git remote -v
```

暂存所有非忽略文件：

```bash
git add -A
```

再次查看即将提交的文件：

```bash
git status --short
```

提交本次更新，提交信息按实际内容修改：

```bash
git commit -m "更新 V3 项目内容"
```

推送到 GitHub：

```bash
git push -u origin main
```

推送后确认本地和远端一致：

```bash
git status --short --branch
```

查看最新提交：

```bash
git log -1 --oneline --decorate
```

确认远端 `main` 分支存在最新提交：

```bash
git ls-remote --heads origin main
```

## 五、上传前必须排除的文件

以下内容不应该进入 GitHub：

- `.env` 和 `.env.*` 真实环境配置。
- 数据库文件，例如 `.db`、`.sqlite`、`.db-wal`。
- 日志文件，例如 `.log`。
- 依赖目录，例如 `node_modules/`。
- 临时目录，例如 `tmp/`、`output/`、`.cache/`。
- 备份目录和压缩包，例如 `backups/`、`backup*/`、`.zip`、`.tar.gz`。
- 真实密码、真实密钥、访问令牌、私钥文件。

当前项目的 `.gitignore` 已经覆盖上述大多数内容。提交前仍建议执行：

```bash
git status --short
```

如果发现不该上传的文件已经被暂存，先取消暂存：

```bash
git restore --staged 文件路径
```

如果文件本身也不应该保留在工作区，请人工确认后再删除，不要直接批量删除未知文件。

## 六、常见问题处理

### 1. 提示没有远端仓库

先配置 V3 远端：

```bash
git remote add origin git@github.com:Liu12138-oss/lianruan-crm-deploy-v3.git
```

### 2. 提示远端地址不是 V3 仓库

改回 V3 远端：

```bash
git remote set-url origin git@github.com:Liu12138-oss/lianruan-crm-deploy-v3.git
```

### 3. 提示没有可提交内容

说明本地内容已经和当前提交一致。可以直接检查状态：

```bash
git status --short --branch
```

如果显示 `main...origin/main` 且没有文件列表，说明本地没有未提交改动。

### 4. 推送时要求认证

优先使用本机已经配置好的 SSH 密钥。不要把账号密码写进命令、脚本或文档。

检查是否能访问远端：

```bash
git ls-remote git@github.com:Liu12138-oss/lianruan-crm-deploy-v3.git
```

如果无法访问，需要在 GitHub 账号中配置 SSH 公钥，或者使用 GitHub 访问令牌完成认证。

### 5. 推送被拒绝

先拉取远端最新内容并合并：

```bash
git pull --rebase origin main
```

如果出现冲突，先人工解决冲突，再执行：

```bash
git add -A
git rebase --continue
git push origin main
```

## 七、推荐提交信息格式

提交信息使用中文，简短说明本次更新目标，例如：

```bash
git commit -m "更新 V3 生产迁移演练文档"
```

```bash
git commit -m "修复 V3 离线安装脚本"
```

```bash
git commit -m "补充 V3 页面与部署说明"
```

## 八、最终确认清单

推送完成后确认以下结果：

1. 本地目录是 `lianruan-crm-deploy-v3`。
2. 当前分支是 `main`。
3. 远端地址是 `git@github.com:Liu12138-oss/lianruan-crm-deploy-v3.git`。
4. `git status --short --branch` 没有未提交文件。
5. GitHub 页面能看到最新提交。

