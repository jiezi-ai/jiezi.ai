export async function sendVerificationEmail(
  apiKey: string,
  to: string,
  githubId: string,
  verifyUrl: string,
): Promise<boolean> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "解字计划 <grant@jieziai.cn>",
      to: [to],
      subject: "解字计划 — 请验证你的 edu 邮箱",
      html: `
<div style="font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; color: #262626;">
  <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 24px;">解字计划</h1>

  <p>你好 <strong>@${githubId}</strong>，</p>

  <p>你的申请已通过初审。请点击下方链接验证你的 edu 邮箱，完成最后一步：</p>

  <div style="margin: 32px 0; text-align: center;">
    <a href="${verifyUrl}"
       style="display: inline-block; background: #b5452a; color: #fff; text-decoration: none; padding: 12px 32px; font-size: 16px; font-weight: 600;">
      验证邮箱
    </a>
  </div>

  <p style="color: #666; font-size: 14px;">验证完成后，页面将展示你的 API Key 和配置信息（仅显示一次，请立即保存）。</p>

  <p style="color: #666; font-size: 14px;">此链接 7 天内有效。</p>

  <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 32px 0;" />

  <p style="color: #999; font-size: 12px;">
    解字计划 — 资助大学生获得 AI token<br/>
    <a href="https://github.com/jiezi-ai/grant" style="color: #999;">github.com/jiezi-ai/grant</a>
  </p>
</div>
      `.trim(),
    }),
  });

  return res.ok;
}

export async function sendCredentialsEmail(
  resendApiKey: string,
  to: string,
  githubId: string,
  baseUrl: string,
  apiKey: string,
  password: string,
): Promise<boolean> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "解字计划 <grant@jieziai.cn>",
      to: [to],
      subject: "解字计划 — 你的 AI 编程资源凭据（重发）",
      html: `
<div style="font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; color: #262626;">
  <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 24px;">解字计划</h1>

  <p>你好 <strong>@${githubId}</strong>，</p>

  <p>应你的要求，我们重新发送你的 AI 编程资源凭据。请妥善保存以下信息：</p>

  <div style="background: #f5f5f4; padding: 16px 20px; margin: 24px 0; border-left: 3px solid #b5452a; line-height: 2; font-size: 14px;">
    <strong>API 地址：</strong><code>${baseUrl}</code><br>
    <strong>API Key：</strong><code style="word-break: break-all;">${apiKey}</code><br>
    <hr style="border: none; border-top: 1px solid #e5e2de; margin: 8px 0;">
    <strong>管理后台：</strong><code>${baseUrl}</code><br>
    <strong>用户名：</strong><code>${githubId}</code><br>
    <strong>密码：</strong><code>${password}</code>
  </div>

  <p style="color: #b5452a; font-size: 13px;">密码已重置为上方新密码，旧密码不再有效。</p>

  <p style="color: #666; font-size: 14px;">配置教程：<a href="https://learn.jieziai.cn/getting-started/setup/" style="color: #b5452a;">learn.jieziai.cn</a></p>

  <p style="color: #999; font-size: 13px; margin-top: 24px;">如非本人操作，请忽略此邮件。</p>

  <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 32px 0;" />

  <p style="color: #999; font-size: 12px;">
    解字计划 — 资助大学生获得 AI token<br/>
    <a href="https://github.com/jiezi-ai/grant" style="color: #999;">github.com/jiezi-ai/grant</a>
  </p>
</div>
      `.trim(),
    }),
  });

  return res.ok;
}

