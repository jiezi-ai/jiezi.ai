# jiezi.ai

[解字计划](https://github.com/jiezi-ai/grant)的官网和后端服务。

- **官网**：[jiezi.ai](https://jiezi.ai) — 项目介绍、申请入口、数据展示
- **学堂**：[learn.jiezi.ai](https://learn.jiezi.ai) — AI 编程教程和学习资源
- **API**：[api.jiezi.ai](https://api.jiezi.ai) — 申请、审核、验证、资源发放

## 架构

```
apps/
├── web/       Astro SSG → Cloudflare Pages (jiezi.ai)
├── learn/     Astro Starlight → Cloudflare Pages (learn.jiezi.ai)
└── api/       Hono → Cloudflare Workers (api.jiezi.ai)

packages/
└── shared/    共享 TypeScript 类型
```

## 技术栈

- **前端**：Astro + React islands + Tailwind CSS v4
- **学堂**：Astro Starlight
- **API**：Hono (Cloudflare Workers) + D1 (SQLite) + KV (缓存) + R2 (静态资源)
- **邮件**：Resend
- **LLM 审核**：OpenRouter (Gemini)
- **资源发放**：New API (LLM 网关) + OpenRouter

## 申请流程（全自动）

```
学生填表 (jiezi.ai/apply)
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

# API
pnpm --filter api dev        # 本地开发
pnpm --filter api test       # 运行测试

# 官网
pnpm --filter web dev        # 本地开发
pnpm --filter web build      # 构建

# 学堂
pnpm --filter learn dev      # 本地开发
pnpm --filter learn build    # 构建
```

## 部署

```bash
# API (Cloudflare Workers)
cd apps/api && npx wrangler deploy

# 官网 (Cloudflare Pages)
cd apps/web && pnpm build && npx wrangler pages deploy dist --project-name jiezi-web

# 学堂 (Cloudflare Pages)
cd apps/learn && pnpm build && npx wrangler pages deploy dist --project-name jiezi-learn
```

## 相关仓库

| 仓库 | 说明 |
|------|------|
| [jiezi-ai/grant](https://github.com/jiezi-ai/grant) | 政策、预算、账本（数据源） |
| [jiezi-ai/jiezi-admin-clip](https://github.com/jiezi-ai/jiezi-admin-clip) | Pinix 管理 Clip |

## License

MIT
