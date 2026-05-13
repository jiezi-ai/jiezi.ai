import { Hono } from "hono";
import type { Env } from "../index";
import { GitHubClient } from "../services/github";

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  const token = c.req.query("token");

  if (!token) {
    return c.html(renderPage("error", "缺少验证参数。", c.env.WECHAT_QR_URL));
  }

  const record = await c.env.DB.prepare(
    "SELECT * FROM applications WHERE verify_token = ?",
  ).bind(token).first();

  if (!record) {
    return c.html(renderPage("error", "验证链接无效或已过期。", c.env.WECHAT_QR_URL));
  }

  if (record.verified_at) {
    return c.html(renderPage("already", record.github_id as string, c.env.WECHAT_QR_URL));
  }

  const createdAt = new Date(record.created_at as string);
  const now = new Date();
  const daysDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

  if (daysDiff > 7) {
    return c.html(renderPage("expired", "验证链接已过期（7 天有效期）。请重新提交申请。", c.env.WECHAT_QR_URL));
  }

  await c.env.DB.prepare(
    "UPDATE applications SET status = 'verified', verified_at = datetime('now') WHERE verify_token = ?",
  ).bind(token).run();

  // 自动 close issue + 打 verified label
  if (record.pr_number && c.env.GITHUB_TOKEN) {
    const github = new GitHubClient(
      c.env.GITHUB_OWNER,
      c.env.GITHUB_REPO,
      c.env.GITHUB_TOKEN,
    );
    const issueNumber = record.pr_number as number;
    await github.addLabels(issueNumber, ["verified"]);
    await github.removeLabel(issueNumber, "approved");
    await github.commentIssue(
      issueNumber,
      `✅ 邮箱验证完成！欢迎加入解字计划。\n\n请添加发起人微信领取 AI Coding Plan。`,
    );
    await github.closeIssue(issueNumber);
  }

  return c.html(renderPage("success", record.github_id as string, c.env.WECHAT_QR_URL));
});

function renderPage(status: string, info: string, qrUrl?: string): string {
  const title = status === "success" ? "验证成功" :
    status === "already" ? "已验证" :
    status === "expired" ? "链接已过期" : "验证失败";

  const showQR = status === "success" || status === "already";

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} — 解字计划</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
      background: #f8f6f3;
      color: #262626;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      max-width: 420px;
      width: 100%;
      background: #fff;
      border: 1px solid #e5e2de;
      padding: 48px 32px;
      text-align: center;
    }
    h1 { font-size: 24px; font-weight: 700; margin-bottom: 16px; }
    .status { font-size: 48px; margin-bottom: 16px; }
    p { color: #666; line-height: 1.6; margin-bottom: 16px; }
    .qr { margin: 24px auto; max-width: 200px; }
    .qr img { width: 100%; border: 1px solid #e5e2de; }
    .hint { font-size: 13px; color: #999; }
    .brand { font-size: 12px; color: #bbb; margin-top: 32px; letter-spacing: 2px; }
    .error { color: #b5452a; }
  </style>
</head>
<body>
  <div class="card">
    <div class="status">${status === "success" ? "✓" : status === "already" ? "✓" : status === "expired" ? "⏰" : "✕"}</div>
    <h1${status === "error" || status === "expired" ? ' class="error"' : ""}>${title}</h1>

    ${showQR ? `
      <p>@${info}，你的 edu 邮箱已验证。</p>
      <p>请扫码添加发起人微信，添加后即可领取 <strong>AI Coding Plan</strong>。</p>
      ${qrUrl ? `<div class="qr"><img src="${qrUrl}" alt="微信二维码" /></div>` : ""}
      <p class="hint">添加时请备注你的 GitHub ID</p>
    ` : `
      <p>${info}</p>
    `}

    <p class="brand">解字计划 JIEZI GRANT</p>
  </div>
</body>
</html>`;
}

export default app;
