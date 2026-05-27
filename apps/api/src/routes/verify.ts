import { Hono } from "hono";
import type { Env } from "../index";
import { GitHubClient } from "../services/github";
import { notifyBark } from "../services/bark";

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  const token = c.req.query("token");

  if (!token) {
    return c.html(renderPage("error", "缺少验证参数。"));
  }

  const record = await c.env.DB.prepare(
    "SELECT * FROM applications WHERE verify_token = ?",
  ).bind(token).first();

  if (!record) {
    return c.html(renderPage("error", "验证链接无效或已过期。"));
  }

  if (record.verified_at) {
    return c.html(renderPage("already", record.github_id as string));
  }

  const createdAt = new Date(record.created_at as string);
  const now = new Date();
  const daysDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

  if (daysDiff > 7) {
    return c.html(renderPage("expired", "验证链接已过期（7 天有效期）。请重新提交申请。"));
  }

  // 1. 标记 verified
  await c.env.DB.prepare(
    "UPDATE applications SET status = 'verified', verified_at = datetime('now') WHERE verify_token = ?",
  ).bind(token).run();

  // 2. 失效缓存
  const cache = c.var.cache;
  await cache.invalidate("students_list");
  await cache.invalidate("overview");

  if (c.env.BARK_KEY) {
    void notifyBark(c.env.BARK_KEY, "📧 邮箱已验证", [
      `**${record.name}**（${record.school}）`,
      `- GitHub: @${record.github_id}`,
      `- 邮箱: ${record.edu_email}`,
    ].join("\n")).catch(console.error);
  }

  // 3. 自动 close issue + 打 verified label
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
      `✅ 邮箱验证完成！AI 编程资源已在验证页面展示。\n\n欢迎加入解字计划交流群，和其他同学一起学习。\n\n如果觉得解字计划有帮助，给仓库点个 ⭐ 吧，让更多同学看到。`,
    );
    await github.closeIssue(issueNumber);
  }

  // 4. 自动创建 New API 账号 + Key
  let provisionResult: { apiKey?: string; password?: string; baseUrl?: string; error?: string } = {};
  if (c.env.NEWAPI_BASE_URL && c.env.NEWAPI_ADMIN_USER && c.env.NEWAPI_ADMIN_PASS) {
    try {
      provisionResult = await provisionStudent(c.env, record);
      if (provisionResult.error) {
        console.error(`[verify] provision failed for ${record.github_id}: ${provisionResult.error}`);
      } else {
        await c.env.DB.prepare(
          "UPDATE applications SET status = 'fulfilled' WHERE verify_token = ?",
        ).bind(token).run();
        console.log(`[verify] provisioned ${record.github_id}: account + key created`);

        if (c.env.BARK_KEY) {
          void notifyBark(c.env.BARK_KEY, "🎉 资源已发放", [
            `**${record.name}**（${record.school}）`,
            `- GitHub: @${record.github_id}`,
            `- 邮箱: ${record.edu_email}`,
          ].join("\n")).catch(console.error);
        }
      }
    } catch (e: any) {
      provisionResult.error = e.message;
      console.error(`[verify] provision error for ${record.github_id}:`, e);
    }
  }

  const groupQrUrl = c.env.WECHAT_GROUP_QR_URL;
  return c.html(renderPage("success", record.github_id as string, groupQrUrl, provisionResult));
});

async function provisionStudent(
  env: Env,
  record: Record<string, unknown>,
): Promise<{ error?: string; apiKey?: string; password?: string; baseUrl?: string }> {
  const baseUrl = env.NEWAPI_BASE_URL!;
  const githubId = record.github_id as string;
  const email = record.edu_email as string;
  const name = record.name as string;
  const school = record.school as string;

  // 1. Admin login
  const loginResp = await fetch(`${baseUrl}/api/user/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: env.NEWAPI_ADMIN_USER,
      password: env.NEWAPI_ADMIN_PASS,
    }),
  });
  const loginData = await loginResp.json() as any;
  if (!loginData.success) return { error: `admin login failed: ${loginData.message}` };

  const adminCookie = loginResp.headers.get("set-cookie")?.split(";")[0] || "";
  const adminHeaders = {
    Cookie: adminCookie,
    "New-Api-User": "1",
    "Content-Type": "application/json",
  };

  // 2. Generate random password
  const password = Array.from(crypto.getRandomValues(new Uint8Array(9)))
    .map((b) => "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"[b % 55])
    .join("");

  // 3. Create user (skip if already exists)
  const createResp = await fetch(`${baseUrl}/api/user/`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      username: githubId,
      display_name: `${name} (${school})`,
      password,
      quota: 10000000,
      group: "default",
    }),
  });
  const createData = await createResp.json() as any;
  const userAlreadyExists = !createData.success && (createData.message || "").includes("duplicate");

  // 4. Find user ID + update email
  const usersResp = await fetch(`${baseUrl}/api/user/?p=0&size=200`, { headers: adminHeaders });
  const usersData = await usersResp.json() as any;
  const user = usersData.data?.items?.find((u: any) => u.username === githubId);
  if (!user) return { error: `create user failed: ${createData.message}` };

  if (userAlreadyExists) {
    console.log(`[provision] user ${githubId} already exists (id=${user.id}), skipping creation`);
  }

  // Add quota via manage API (PUT doesn't update zero-value fields due to GORM)
  const manageResp = await fetch(`${baseUrl}/api/user/manage`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ id: user.id, action: "add_quota", mode: "add", value: 10000000 }),
  });
  const manageData = await manageResp.json() as any;
  console.log(`[provision] add_quota ${githubId}: success=${manageData.success}`);
  if (!manageData.success) {
    console.error(`[provision] add_quota failed: ${manageData.message}`);
  }

  // 5. Login as student to create token
  const studentLoginResp = await fetch(`${baseUrl}/api/user/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: githubId, password }),
  });
  const studentLoginData = await studentLoginResp.json() as any;
  if (!studentLoginData.success) return { error: `student login failed: ${studentLoginData.message}` };

  const studentCookie = studentLoginResp.headers.get("set-cookie")?.split(";")[0] || "";
  const studentHeaders = {
    Cookie: studentCookie,
    "New-Api-User": String(user.id),
    "Content-Type": "application/json",
  };

  // 6. Create token
  const tokenResp = await fetch(`${baseUrl}/api/token/`, {
    method: "POST",
    headers: studentHeaders,
    body: JSON.stringify({
      name: "jiezi-grant",
      remain_quota: 10000000,
      unlimited_quota: false,
    }),
  });
  const tokenData = await tokenResp.json() as any;
  if (!tokenData.success) return { error: `create token failed: ${tokenData.message}` };

  // 7. Get token ID from list
  const tokenListResp = await fetch(`${baseUrl}/api/token/?p=0&size=10`, {
    headers: studentHeaders,
  });
  const tokenListData = await tokenListResp.json() as any;
  const tokenId = tokenListData.data?.items?.[0]?.id;
  if (!tokenId) return { error: "token created but not found in list" };

  // 8. Get full key via POST /api/token/{id}/key
  const keyResp = await fetch(`${baseUrl}/api/token/${tokenId}/key`, {
    method: "POST",
    headers: studentHeaders,
  });
  const keyData = await keyResp.json() as any;
  if (!keyData.success || !keyData.data?.key) return { error: "failed to retrieve full token key" };

  const apiKey = `sk-${keyData.data.key}`;

  return { apiKey, password, baseUrl: env.NEWAPI_STUDENT_URL || baseUrl };
}

function renderPage(status: string, info: string, groupQrUrl?: string, provisionResult?: { error?: string; apiKey?: string; password?: string; baseUrl?: string }): string {
  const title = status === "success" ? "验证成功" :
    status === "already" ? "已验证" :
    status === "expired" ? "链接已过期" : "验证失败";

  const showQR = status === "success" || status === "already";

  let bodyHtml = `<p>${info}</p>`;
  if (showQR) {
    if (!provisionResult?.error && provisionResult?.apiKey) {
      const baseUrl = provisionResult.baseUrl || "";
      const apiKey = provisionResult.apiKey || "";
      const password = provisionResult.password || "";
      const qrHtml = groupQrUrl
        ? `<div class="qr"><img src="${groupQrUrl}" alt="交流群二维码" /></div>`
        : "";
      bodyHtml = `
      <p>@${info}，你的 edu 邮箱已验证。</p>

      <div class="info-box" style="border-left-color: #b5452a; text-align: left;">
        <h3 style="font-size: 15px; font-weight: 600; margin-bottom: 12px; text-align: center;">⚠️ 以下信息只会显示一次，请立即保存</h3>
        <hr style="border: none; border-top: 1px solid #e5e2de; margin: 12px 0;">
        <strong>API 地址：</strong><code style="word-break: break-all;">${baseUrl}</code><br>
        <strong>API Key：</strong><code style="word-break: break-all;">${apiKey}</code><br>
        <hr style="border: none; border-top: 1px solid #e5e2de; margin: 12px 0;">
        <strong>管理后台：</strong><code style="word-break: break-all;">${baseUrl}</code><br>
        <strong>用户名：</strong><code>${info}</code><br>
        <strong>密码：</strong><code>${password}</code>
      </div>

      <p><a href="https://learn.jieziai.cn/getting-started/setup/" style="color: #b5452a;">📖 配置教程 → learn.jieziai.cn</a></p>

      <p style="margin-top: 24px;">扫码加入解字计划交流群</p>
      ${qrHtml}
      <p class="hint">和其他同学一起交流 AI 编程</p>

      <p style="margin-top: 24px;"><a href="https://github.com/jiezi-ai/grant" style="color: #b5452a; text-decoration: none; font-size: 14px;">⭐ 给项目一个 Star</a> <span style="color: #999; font-size: 13px;">— 帮助更多大学生发现解字计划</span></p>
      `;
    } else {
      const errorHtml = provisionResult?.error
        ? `<p>AI 资源自动发放遇到问题，管理员将手动处理。</p><p class="hint">${provisionResult.error}</p>`
        : `<div class="info-box" style="border-left-color: #b5452a;">
            ✅ AI 编程资源已自动发放<br>
            请使用申请时填写的凭据登录。<br>
            📖 配置教程：<a href="https://learn.jieziai.cn/getting-started/setup/">learn.jieziai.cn</a>
          </div>`;
      const qrHtml = groupQrUrl
        ? `<div class="qr"><img src="${groupQrUrl}" alt="交流群二维码" /></div>`
        : "";
      bodyHtml = `
      <p>@${info}，你的 edu 邮箱已验证。</p>

      ${errorHtml}

      <p>扫码加入解字计划交流群</p>
      ${qrHtml}
      <p class="hint">和其他同学一起交流 AI 编程</p>

      <p style="margin-top: 24px;"><a href="https://github.com/jiezi-ai/grant" style="color: #b5452a; text-decoration: none; font-size: 14px;">⭐ 给项目一个 Star</a> <span style="color: #999; font-size: 13px;">— 帮助更多大学生发现解字计划</span></p>
      `;
    }
  }

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
    .info-box { background: #f5f5f4; padding: 12px 16px; text-align: left; font-size: 14px; margin: 16px 0; border-left: 3px solid #4a7; line-height: 1.8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="status">${status === "success" ? "✓" : status === "already" ? "✓" : status === "expired" ? "⏰" : "✕"}</div>
    <h1${status === "error" || status === "expired" ? ' class="error"' : ""}>${title}</h1>

    ${bodyHtml}

    <p class="brand">解字计划 JIEZI GRANT</p>
  </div>
</body>
</html>`;
}

export default app;
