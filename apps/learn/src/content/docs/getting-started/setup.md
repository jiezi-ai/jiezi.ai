---
title: 环境配置
description: 将解字计划的 AI 资源接入你的开发环境
---

获得解字计划的资助后，你会收到一封邮件，包含 **API 地址**（Base URL）和你的 **API Key**。本指南帮你把它们接入编程工具。

## 前置准备

1. 查收你的 edu 邮箱，找到解字计划发送的配置邮件
2. 邮件中包含：**API 地址**、**API Key**、**管理后台地址**（可查看用量和余额）

## Claude Code（推荐）

Claude Code 是 Anthropic 出品的终端 AI 编程 Agent，也是解字计划最推荐的工具。

### 安装

参考 [Claude Code 官方文档](https://docs.anthropic.com/en/docs/claude-code) 安装。

**macOS / Linux：**

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

**Windows：**

需要先安装 [Node.js](https://nodejs.org/)（LTS 版本）和 [Git](https://git-scm.com/downloads/win)，然后在 PowerShell 中运行：

```powershell
npm install -g @anthropic-ai/claude-code
```

验证安装：

```bash
claude --version
```

### 方式一：cc-switch（推荐）

[cc-switch](https://github.com/nicepkg/cc-switch) 可以一键管理 Claude Code 的 API 配置，支持多个配置之间快速切换。

**macOS / Linux：**

```bash
brew tap nicepkg/tap
brew install --cask cc-switch
```

**Windows：**

前往 [cc-switch Releases](https://github.com/nicepkg/cc-switch/releases) 下载安装包。

安装后：

1. 启动 cc-switch，点击右上角 "+"
2. 选择 **自定义** 供应商
3. Base URL 填邮件中的 API 地址
4. API Key 填邮件中的 Key
5. 模型名称按需选择（推荐先用 `deepseek/deepseek-v4-flash`）
6. 点击 "添加"，回首页点击 "启用"

### 方式二：手动配置

**第 1 步**：先清除可能冲突的环境变量：

```bash
unset ANTHROPIC_AUTH_TOKEN
unset ANTHROPIC_BASE_URL
```

> 如果这些变量在 `~/.bashrc` 或 `~/.zshrc` 中被永久导出，请删除对应行。

**第 2 步**：编辑 Claude Code 配置文件：

- macOS / Linux：`~/.claude/settings.json`
- Windows：`用户目录/.claude/settings.json`

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "邮件中的 API 地址",
    "ANTHROPIC_AUTH_TOKEN": "邮件中的 API Key",
    "API_TIMEOUT_MS": "3000000",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"
  }
}
```

**第 3 步**：编辑 `~/.claude.json`（Windows 为 `用户目录/.claude.json`）：

```json
{
  "hasCompletedOnboarding": true
}
```

### 验证配置

启动 Claude Code 后，输入以下命令验证：

```
/status
```

确认 `ANTHROPIC_BASE_URL` 指向邮件中的地址。

```
/model
```

确认当前模型显示正常。

### VS Code 插件

如果你用 VS Code，可以安装 [Claude Code for VS Code](https://marketplace.visualstudio.com/items?itemName=anthropics.claude-code) 插件：

1. 安装插件
2. 如果已配置好 `~/.claude/settings.json`，插件会自动读取环境变量，无需额外设置
3. 如果没有，点击 `Edit in settings.json`，添加：

```json
{
  "claudeCode.environmentVariables": [
    { "name": "ANTHROPIC_BASE_URL", "value": "邮件中的 API 地址" },
    { "name": "ANTHROPIC_AUTH_TOKEN", "value": "邮件中的 API Key" },
    { "name": "API_TIMEOUT_MS", "value": "3000000" },
    { "name": "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC", "value": "1" }
  ]
}
```

## 其他支持的工具

解字计划的 API 兼容 OpenAI 格式，以下工具都可以使用：

| 工具 | 类型 | 配置方式 |
|------|------|----------|
| [Cline](https://github.com/cline/cline) | VS Code 插件 | API Provider 选 OpenAI Compatible，填入 Base URL + Key |
| [Roo Code](https://github.com/RooVetGit/Roo-Code) | VS Code 插件 | 同 Cline |
| [Cursor](https://cursor.com) | 独立编辑器 | Settings → Models → 添加自定义模型，填入 Base URL + Key |
| [Windsurf](https://codeium.com/windsurf) | 独立编辑器 | 设置中配置自定义 API |

配置方式都是一样的：填入邮件中的 **API 地址** 和 **API Key**，选择模型。

## 可用模型

| 模型 | 说明 |
|------|------|
| minimax/minimax-m2.7 | MiniMax 最新模型，编程能力强 |
| minimax/minimax-m2.5 | MiniMax 上一代，性价比高 |
| deepseek/deepseek-v4-pro | DeepSeek 最新旗舰 |
| deepseek/deepseek-v4-flash | DeepSeek 快速版，推荐日常使用 |
| z-ai/glm-5.1 | 智谱 GLM 最新模型 |

> 选择建议：日常编程用 `deepseek/deepseek-v4-flash`（快且便宜），复杂任务用 `deepseek/deepseek-v4-pro` 或 `minimax/minimax-m2.7`。

## 查看用量

登录邮件中提供的管理后台地址，用你的用户名和密码登录，可以查看：

- 剩余额度
- 使用记录（每次调用的模型、token 数、耗时）
- 创建和管理你的 API Key

## 常见问题

### 报错 "API Key 无效"

确认 Key 复制完整，没有多余空格。如果仍然报错，联系发起人。

### 响应很慢或超时

- 检查网络连接，校园网可能需要切换热点
- 确认 `API_TIMEOUT_MS` 设置为 `3000000`（50 分钟）
- 尝试切换到更快的模型（如 `deepseek/deepseek-v4-flash`）

### Claude Code 启动后还是用的 Anthropic 官方

检查是否有残留的环境变量：

```bash
echo $ANTHROPIC_AUTH_TOKEN
echo $ANTHROPIC_BASE_URL
```

如果有输出，说明还有旧变量未清除。用 `unset` 清除后重启终端。或者检查 `~/.bashrc` / `~/.zshrc` 中是否有旧的导出语句。

### 不知道选哪个模型

先用 `deepseek/deepseek-v4-flash`，快、便宜、够用。等你熟悉了再试其他模型。
