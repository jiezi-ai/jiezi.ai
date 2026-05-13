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
      from: "解字计划 <grant@jiezi.ai>",
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

  <p style="color: #666; font-size: 14px;">验证完成后，你将看到发起人的微信二维码。添加微信后即可领取 AI Coding Plan。</p>

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
