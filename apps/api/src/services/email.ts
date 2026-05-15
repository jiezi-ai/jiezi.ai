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

  <p style="color: #666; font-size: 14px;">验证完成后，AI 编程资源将自动发放到你的邮箱。</p>

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

export async function sendGrantEmail(
  resendKey: string,
  to: string,
  name: string,
  githubId: string,
  password: string,
  baseUrl: string,
  apiKey: string,
  groupQrUrl?: string,
): Promise<boolean> {
  const studentApiUrl = baseUrl;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "解字计划 <grant@jiezi.ai>",
      to: [to],
      subject: "解字计划 — 你的 AI 编程资源已就绪",
      html: `
<div style="font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; color: #262626;">
  <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 24px;">🎉 ${name}，你的 AI 编程资源已就绪</h1>

  <p>恭喜你通过解字计划的审核！以下是你的配置信息，请妥善保管。</p>

  <div style="background: #f5f5f4; padding: 16px; border-left: 3px solid #4a7; margin: 24px 0; font-family: monospace; font-size: 14px; line-height: 2.2;">
    <strong>API 地址：</strong>${studentApiUrl}<br>
    <strong>API Key：</strong>${apiKey}
  </div>

  <div style="background: #f5f5f4; padding: 16px; border-left: 3px solid #666; margin: 24px 0; font-family: monospace; font-size: 14px; line-height: 2.2;">
    <strong>管理后台：</strong>${studentApiUrl}<br>
    <strong>用户名：</strong>${githubId}<br>
    <strong>密码：</strong>${password}<br>
    <span style="font-size: 12px; color: #888;">登录后可查看用量和余额，建议首次登录后修改密码。</span>
  </div>

  <h3 style="font-size: 16px; margin-top: 24px;">📖 如何使用</h3>
  <p>详细配置教程：<a href="https://learn.jiezi.ai/getting-started/setup/" style="color: #b5452a;">learn.jiezi.ai/getting-started/setup</a></p>
  <p>支持 Claude Code、Cline、Cursor 等主流 AI 编程工具，配置方式都一样：填入上面的 API 地址和 Key。</p>

  <h3 style="font-size: 16px; margin-top: 24px;">💡 额度说明</h3>
  <p>你有 <strong>$20</strong> 的 API 额度。建议日常使用 <code>deepseek/deepseek-v4-flash</code>，快且省额度。</p>

  <h3 style="font-size: 16px; margin-top: 24px;">👥 加入交流群</h3>
  <p>扫码加入解字计划交流群，和其他同学一起学习交流：</p>
  ${groupQrUrl ? `<div style="margin: 16px 0; text-align: center;"><img src="${groupQrUrl}" alt="交流群二维码" style="width: 180px; border: 1px solid #e5e2de;" /></div>` : ""}

  <p style="margin-top: 24px; font-size: 14px; text-align: center;">
    <a href="https://github.com/jiezi-ai/grant" style="color: #b5452a; text-decoration: none;">给解字计划一个 Star ⭐</a>
    <br><span style="color: #999; font-size: 12px;">让更多大学生发现这个项目</span>
  </p>

  <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 32px 0;" />

  <p style="color: #999; font-size: 12px;">
    如有问题，随时联系发起人。祝你用 AI 做出好东西！<br><br>
    解字计划 — <a href="https://jiezi.ai" style="color: #999;">jiezi.ai</a>
  </p>
</div>
      `.trim(),
    }),
  });

  return res.ok;
}
