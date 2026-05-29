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

### 配置

编辑 Claude Code 配置文件：

- macOS / Linux：`~/.claude/settings.json`
- Windows：`用户目录/.claude/settings.json`

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "邮件中的 API 地址",
    "ANTHROPIC_AUTH_TOKEN": "邮件中的 API Key",
    "CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY": "1",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"
  },
  "model": "deepseek/deepseek-v4-flash",
  "effortLevel": "medium"
}
```

> **注意 JSON 格式**：每个 key 和 value 都要用英文双引号 `"` 包裹，key 之间用英文逗号 `,` 分隔，不要用中文标点。

然后编辑 `~/.claude.json`（Windows 为 `用户目录/.claude.json`），跳过首次登录引导：

```json
{
  "hasCompletedOnboarding": true
}
```

**如果之前通过 shell 配置过环境变量**，需要先清除，否则会覆盖 `settings.json` 的配置：

```bash
unset ANTHROPIC_AUTH_TOKEN
unset ANTHROPIC_BASE_URL
```

> 如果这些变量在 `~/.bashrc` 或 `~/.zshrc` 中被永久导出，请删除对应行。

### 验证配置

启动 Claude Code 后，输入 `/status` 确认 `ANTHROPIC_BASE_URL` 指向邮件中的地址。

输入 `/model` 可以看到所有可用模型列表（由 `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY` 自动从 API 拉取），按需切换。

### VS Code / JetBrains 插件

Claude Code 有 [VS Code](https://marketplace.visualstudio.com/items?itemName=anthropics.claude-code) 和 JetBrains 插件。安装后，插件会自动读取 `~/.claude/settings.json` 的配置，无需额外设置。

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

在 Claude Code 中输入 `/model` 可查看完整列表。以下是部分模型：

| 模型 | 说明 |
|------|------|
| **deepseek/deepseek-v4-flash** | 推荐日常使用，快且省额度 |
| deepseek/deepseek-v4-pro | DeepSeek 旗舰 |
| anthropic/claude-sonnet-4.6 | Claude 最新 |
| anthropic/claude-opus-4.7 | Claude 最强推理（费额度） |
| openai/gpt-5.5 | GPT 最新旗舰 |
| google/gemini-3.1-pro-preview | Gemini 最新 |

> 选择建议：日常用 `deepseek/deepseek-v4-flash`，复杂任务用 `anthropic/claude-sonnet-4.6` 或 `openai/gpt-5.5`。用 `/model` 查看全部可用模型。

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

如果有输出，说明 shell 里的环境变量覆盖了 `settings.json`。用 `unset` 清除后重启终端，或者删除 `~/.bashrc` / `~/.zshrc` 中对应的 `export` 行。

### /model 看不到模型列表

确认 `settings.json` 中有 `"CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY": "1"`。这个环境变量让 Claude Code 从 API 地址自动拉取可用模型。

### 不知道选哪个模型

先用 `deepseek/deepseek-v4-flash`，快、便宜、够用。等你熟悉了再试其他模型。用 `/model` 随时切换。

### 找不到配置邮件 / 忘记密码

访问 [jieziai.cn/apply?code=你的申请码](https://jieziai.cn/apply)，输入 edu 邮箱验证身份后，在状态页面点击「重新发送账号信息到邮箱」。

系统会重置你的密码并将新的 API Key、用户名、密码发送到你的 edu 邮箱。旧密码会立即失效。

限制：每天最多 1 次，累计最多 3 次。超过次数请联系管理员。
