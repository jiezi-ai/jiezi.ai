# jiezi.ai

[解字计划](https://github.com/jiezi-ai/grant)的官网和后端服务。

- **官网**：[jieziai.cn](https://jieziai.cn) — 项目介绍、申请入口、数据展示
- **学堂**：[learn.jieziai.cn](https://learn.jieziai.cn) — AI 编程教程和学习资源
- **API**：[api.jieziai.cn](https://api.jieziai.cn) — 申请、审核、验证、资源发放

> 旧域名 jiezi.ai / learn.jiezi.ai 已 301 跳转到 jieziai.cn / learn.jieziai.cn。

## 架构

```
apps/
├── web/       Astro SSG → 腾讯云 COS + CDN (jieziai.cn)
├── learn/     Astro Starlight → 腾讯云 COS + CDN (learn.jieziai.cn)
└── api/       Hono + Bun → jiezi-api 服务器 :3100 (api.jieziai.cn)

packages/
└── shared/    共享 TypeScript 类型
```

## 技术栈

- **前端**：Astro + React islands + Tailwind CSS v4
- **学堂**：Astro Starlight
- **API**：Hono + Bun + SQLite（运行在 jiezi-api 服务器，Caddy 反代）
- **邮件**：Resend
- **LLM 审核**：OpenRouter (Gemini)
- **资源发放**：New API (LLM 网关) + OpenRouter

## 申请流程（全自动）

```
学生填表 (jieziai.cn/apply)
  → 提交 GitHub Issue (申请码)
  → webhook 触发 → Gemini 审核
  → 验证邮件 → 学生点击链接
  → 自动创建 API 账号 + Key
  → 配置邮件发送到 edu 邮箱
```

零人工介入。

## 开发

```bash
pnpm install

# API（需要 Bun 运行时）
pnpm --filter api dev        # 本地开发（bun --watch）
pnpm --filter api test       # 运行测试（vitest）

# 官网
pnpm --filter web dev        # 本地开发
pnpm --filter web build      # 构建

# 学堂
pnpm --filter learn dev      # 本地开发
pnpm --filter learn build    # 构建
```

## 部署

```bash
# API（Bun — 同步到 jiezi-api 服务器后重启）
ssh jiezi-api "cd /opt/jiezi-api && git pull && sudo systemctl restart jiezi-api"

# 主站（腾讯云 COS + CDN）
cd apps/web && pnpm build
coscmd -c /tmp/cos-jiezi-web.conf upload -rs dist/ /
tccli cdn PurgePathCache --cli-unfold-argument --Paths 'https://jieziai.cn/' --FlushType flush

# 学堂（腾讯云 COS + CDN）
cd apps/learn && pnpm build
coscmd -c /tmp/cos-jiezi-learn.conf upload -rs dist/ /
tccli cdn PurgePathCache --cli-unfold-argument --Paths 'https://learn.jieziai.cn/' --FlushType flush
```

## 相关仓库

| 仓库 | 说明 |
|------|------|
| [jiezi-ai/grant](https://github.com/jiezi-ai/grant) | 政策、预算、账本（数据源） |
| [jiezi-ai/jiezi-admin-clip](https://github.com/jiezi-ai/jiezi-admin-clip) | Pinix 管理 Clip |

## License

MIT
