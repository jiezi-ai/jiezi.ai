import { Hono } from "hono";
import type { Env } from "../index";
import type { Context } from "hono";
import { reviewApplication } from "../services/gemini";
import { sendVerificationEmail } from "../services/email";
import { GitHubClient } from "../services/github";
import { CacheService } from "../services/cache";

const app = new Hono<{ Bindings: Env }>();

app.post("/github", async (c) => {
  const event = c.req.header("X-GitHub-Event");
  const body = await c.req.json();

  if (event === "pull_request") {
    return handlePR(c, body);
  }

  if (event === "push") {
    return handlePush(c, body);
  }

  return c.json({ ok: true, skipped: true });
});

function extractApplyCode(content: string): string | null {
  const match = content.match(/JZ-[A-Z0-9]{4}/);
  return match ? match[0] : null;
}

async function handlePR(c: Context<{ Bindings: Env }>, body: any) {
  const github = c.var.github as GitHubClient;
  const action = body.action;

  if (action !== "opened" && action !== "synchronize") {
    return c.json({ ok: true, skipped: true, reason: "not opened/synchronize" });
  }

  const pr = body.pull_request;
  const prNumber: number = pr.number;
  const prUser: string = pr.user.login;

  // 找到学生提交的文件
  const files = await github.getPRFiles(prNumber);
  const studentFile = files.find(
    (f) => f.filename.match(/^students\/batch-\d+\/[^/]+\.md$/),
  );

  if (!studentFile) {
    await github.commentPR(
      prNumber,
      "⚠️ 未找到申请文件。请在 `students/batch-N/` 目录下创建以你的 GitHub 用户名命名的 `.md` 文件，内容填入你的申请码。\n\n还没有申请码？请先到 [jiezi.ai/apply](https://jiezi.ai/apply) 提交申请。",
    );
    return c.json({ ok: true, action: "no_student_file" });
  }

  // 读取文件内容，提取申请码
  const content = await github.getPRFileContent(studentFile.raw_url);
  if (!content) {
    return c.json({ ok: false, error: "Failed to fetch file content" }, 500);
  }

  const applyCode = extractApplyCode(content);
  if (!applyCode) {
    await github.commentPR(
      prNumber,
      "⚠️ 未找到有效的申请码。请确保文件中包含你的申请码（格式：`JZ-XXXX`）。\n\n还没有申请码？请先到 [jiezi.ai/apply](https://jiezi.ai/apply) 提交申请。",
    );
    return c.json({ ok: true, action: "no_apply_code" });
  }

  // 匹配 D1 记录
  const application = await c.env.DB.prepare(
    "SELECT * FROM applications WHERE apply_code = ?",
  ).bind(applyCode).first();

  if (!application) {
    await github.commentPR(
      prNumber,
      `⚠️ 申请码 \`${applyCode}\` 不存在。请检查是否正确，或到 [jiezi.ai/apply](https://jiezi.ai/apply) 重新申请。`,
    );
    return c.json({ ok: true, action: "invalid_code" });
  }

  // 检查状态：只有 draft 状态可以提交 PR
  if (application.status !== "draft") {
    const statusMsg: Record<string, string> = {
      rejected: "你的申请已被驳回，请到 [jiezi.ai/apply](https://jiezi.ai/apply) 修改信息后重新提交 PR。",
      approved: "你的申请已通过审核，PR 将自动合并。",
      merged: "你的 PR 已经合并过了，请查收验证邮件。",
      emailed: "验证邮件已发送，请查收 edu 邮箱。",
      verified: "你已完成验证。",
      fulfilled: "资源已发放。",
    };
    await github.commentPR(prNumber, statusMsg[application.status as string] || `当前状态：${application.status}`);

    if (application.status === "approved") {
      // 之前通过但还没提交 PR 的情况，补充 merge
    } else {
      return c.json({ ok: true, action: "wrong_status", status: application.status });
    }
  }

  const batchMatch = studentFile.filename.match(/batch-(\d+)/);
  const batch = batchMatch ? parseInt(batchMatch[1]) : 1;

  // 检查批次容量
  const batchCount = await c.env.DB.prepare(
    "SELECT COUNT(*) as cnt FROM applications WHERE batch = ? AND status NOT IN ('draft', 'rejected')",
  ).bind(batch).first();

  if (batchCount && (batchCount as any).cnt >= 100) {
    await github.commentPR(prNumber, `第 ${batch} 批已满 100 人，请等待下一批次开放。`);
    return c.json({ ok: true, action: "batch_full" });
  }

  // Gemini 审核（基于 D1 里的申请信息）
  if (!c.env.GEMINI_API_KEY) {
    return c.json({ ok: false, error: "GEMINI_API_KEY not configured" }, 500);
  }

  const applicationInfo = `学校: ${application.school}\n专业: ${application.major}\n年级: ${application.grade}\nedu 邮箱: ${application.edu_email}\n想用 AI 做什么: ${application.motivation}`;

  const review = await reviewApplication(c.env.GEMINI_API_KEY, applicationInfo, prUser);

  if (!review.pass) {
    await github.commentPR(
      prNumber,
      `申请未通过审核。\n\n**原因**：${review.reason}\n\n请到 [jiezi.ai/apply/${applyCode}](https://jiezi.ai/apply/${applyCode}) 修改信息后重新提交 PR。`,
    );

    await c.env.DB.prepare(
      "UPDATE applications SET status = 'rejected', github_id = ?, pr_number = ?, batch = ?, updated_at = datetime('now') WHERE apply_code = ?",
    ).bind(prUser, prNumber, batch, applyCode).run();

    return c.json({ ok: true, action: "rejected", reason: review.reason });
  }

  // 通过 → 自动 merge
  const merged = await github.mergePR(
    prNumber,
    `[申请] @${prUser} - ${application.school}`,
  );

  if (!merged) {
    await github.commentPR(prNumber, "自动合并失败，请联系管理员。");
    return c.json({ ok: false, error: "merge failed" }, 500);
  }

  // 生成验证 token
  const verifyToken = crypto.randomUUID();
  const verifyUrl = `https://api.jiezi.ai/api/verify?token=${verifyToken}`;

  await c.env.DB.prepare(
    "UPDATE applications SET status = 'merged', github_id = ?, pr_number = ?, batch = ?, verify_token = ?, updated_at = datetime('now') WHERE apply_code = ?",
  ).bind(prUser, prNumber, batch, verifyToken, applyCode).run();

  // 发验证邮件
  if (c.env.RESEND_API_KEY && application.edu_email) {
    const sent = await sendVerificationEmail(
      c.env.RESEND_API_KEY,
      application.edu_email as string,
      prUser,
      verifyUrl,
    );

    if (sent) {
      await c.env.DB.prepare(
        "UPDATE applications SET status = 'emailed' WHERE apply_code = ?",
      ).bind(applyCode).run();

      await github.commentPR(
        prNumber,
        `✅ 申请通过！验证邮件已发送到你的 edu 邮箱，请查收并完成验证。\n\n如未收到邮件，请检查垃圾邮件文件夹。`,
      );
    }
  }

  return c.json({ ok: true, action: "approved", github_id: prUser, apply_code: applyCode });
}

async function handlePush(c: Context<{ Bindings: Env }>, body: any) {
  const cache = c.var.cache as CacheService;

  const changedFiles = new Set<string>();
  for (const commit of body.commits || []) {
    for (const f of commit.modified || []) changedFiles.add(f);
    for (const f of commit.added || []) changedFiles.add(f);
  }

  const invalidations: string[] = [];

  for (const file of changedFiles) {
    if (file.startsWith("policy/")) {
      invalidations.push("policies");
      const name = file.replace("policy/", "").replace(".md", "");
      invalidations.push(`policy:${name}`);
    }
    if (file.startsWith("stages/")) invalidations.push("stages");
    if (file.startsWith("records/batches")) invalidations.push("batches", "overview");
    if (file.startsWith("records/milestones")) invalidations.push("overview");
    if (file.startsWith("records/changelog")) invalidations.push("changelog");
    if (file.startsWith("ledger/")) invalidations.push("budget");
    if (file.startsWith("students/")) {
      invalidations.push("overview");
      const batchMatch = file.match(/students\/batch-(\d+)\//);
      if (batchMatch) invalidations.push(`batch:${batchMatch[1]}`);
    }
  }

  const unique = [...new Set(invalidations)];
  await Promise.all(unique.map((key) => cache.invalidate(key)));

  return c.json({ ok: true, invalidated: unique });
}

export default app;
