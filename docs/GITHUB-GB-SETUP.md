# GitHub 推送 & Grok Bot 连接

## 1. 推送到 GitHub

GitHub **不接受账号密码**做 `git push`，需要 **Personal Access Token (PAT)**。

1. 登录 GitHub → **Settings → Developer settings → Fine-grained tokens**
2. 新建 Token，Repository access 选 **Only select** → 勾选 `gallery`（或先建空仓库再授权）
3. Permissions：`Contents` Read and write，`Metadata` Read
4. 在本机执行：

```bash
cd "/Users/lorin/Documents/ECS服务器/gallery-repo"
export GH_TOKEN="github_pat_你的token"
bash scripts/push_to_github.sh
```

默认创建 **Private** 仓库 `gallery`。改公开：

```bash
export GALLERY_GITHUB_VISIBILITY=public
```

## 2. Cursor ↔ GitHub（GB / Cloud Agent 必读）

1. 打开 https://cursor.com/dashboard → **Integrations → GitHub**
2. 用与 Grok Bot **相同的 Cursor 账号**登录
3. 安装 Cursor GitHub App，授权 `gallery` 仓库

## 3. Grok Bot GitHub 插件（可选，只读更快）

Grok Bot → **Plugins → GitHub** → 填入只读 PAT（Contents/Issues/PRs Read）。

## 4. 第一条 handoff 模板

> 读 GitHub 仓库 `<你的用户名>/gallery` 的 `main` 分支。工程根目录是展览馆服务，`demos/` 下是全部 Demo 静态包，`catalog.json` 是目录。不要重问背景，先看 README。
