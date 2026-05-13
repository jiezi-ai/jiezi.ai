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

async function handlePR(c: Context<{ Bindings: Env }>, body: any) {
  const github = c.var.github as GitHubClient;
  const action = body.action;

  if (action !== "opened" && action !== "synchronize") {
    return c.json({ ok: true, skipped: true, reason: "not opened/synchronize" });
  }

  const pr = body.pull_request;
  const prNumber: number = pr.number;
  const prUser: string = pr.user.login;

  const files = await github.getPRFiles(prNumber);
  const studentFile = files.find(
    (f) => f.filename.match(/^students\/batch-\d+\/[^/]+\.md$/),
  );

  if (!studentFile) {
    await github.commentPR(
      prNumber,
      "⚠️ 未找到申请文件。请在 `students/batch-N/` 目录下创建以你的 GitHub 用户名命名的 `.md` 文件。\n\n参考 [申请指南](https://github.com/jiezi-ai/grant/blob/main/docs/apply-guide.md)。",
    );
    return c.json({ ok: true, action: "no_student_file" });
  }

  const batchMatch = studentFile.filename.match(/batch-(\d+)/);
  const batch = batchMatch ? parseInt(batchMatch[1]) : 1;

  const existing = await c.env.DB.prepare(
    "SELECT id, status FROM applications WHERE github_id = ?",
  ).bind(prUser).first();

  if (existing && existing.status !== "rejected") {
    await github.commentPR(
      prNumber,
      `你已经提交过申请（当前状态：${existing.status}），不需要重复申请。`,
    );
    return c.json({ ok: true, action: "duplicate" });
  }

  const batchCount = await c.env.DB.prepare(
    "SELECT COUNT(*) as cnt FROM applications WHERE batch = ? AND status NOT IN ('rejected')",
  ).bind(batch).first();

  if (batchCount && (batchCount as any).cnt >= 100) {
    await github.commentPR(
      prNumber,
      `第 ${batch} 批已满 100 人，请等待下一批次开放。`,
    );
    return c.json({ ok: true, action: "batch_full" });
  }

  const content = await github.getPRFileContent(studentFile.raw_url);
  if (!content) {
    return c.json({ ok: false, error: "Failed to fetch file content" }, 500);
  }

  if (!c.env.GEMINI_API_KEY) {
    return c.json({ ok: false, error: "GEMINI_API_KEY not configured" }, 500);
  }

  const review = await reviewApplication(c.env.GEMINI_API_KEY, content, prUser);

  if (!review.pass) {
    await github.commentPR(
      prNumber,
      `申请未通过初审。\n\n**原因**：${review.reason}\n\n请修改后重新提交（直接 push 到你的 PR 分支即可，无需重开 PR）。`,
    );

    if (existing) {
      await c.env.DB.prepare(
        "UPDATE applications SET status = 'rejected', pr_number = ? WHERE github_id = ?",
      ).bind(prNumber, prUser).run();
    } else {
      await c.env.DB.prepare(
        "INSERT INTO applications (github_id, batch, school, major, grade, edu_email, motivation, pr_number, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'rejected')",
      ).bind(prUser, batch, review.school, review.major, review.grade, review.edu_email, review.motivation, prNumber).run();
    }

    return c.json({ ok: true, action: "rejected", reason: review.reason });
  }

  const merged = await github.mergePR(
    prNumber,
    `[申请] @${prUser} - ${review.school}`,
  );

  if (!merged) {
    await github.commentPR(prNumber, "自动合并失败，请联系管理员。");
    return c.json({ ok: false, error: "merge failed" }, 500);
  }

  const verifyToken = crypto.randomUUID();
  const verifyUrl = `https://api.jiezi.ai/api/verify?token=${verifyToken}`;

  if (existing) {
    await c.env.DB.prepare(
      "UPDATE applications SET status = 'approved', batch = ?, school = ?, major = ?, grade = ?, edu_email = ?, motivation = ?, pr_number = ?, verify_token = ? WHERE github_id = ?",
    ).bind(batch, review.school, review.major, review.grade, review.edu_email, review.motivation, prNumber, verifyToken, prUser).run();
  } else {
    await c.env.DB.prepare(
      "INSERT INTO applications (github_id, batch, school, major, grade, edu_email, motivation, pr_number, verify_token, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved')",
    ).bind(prUser, batch, review.school, review.major, review.grade, review.edu_email, review.motivation, prNumber, verifyToken).run();
  }

  if (c.env.RESEND_API_KEY && review.edu_email) {
    const sent = await sendVerificationEmail(
      c.env.RESEND_API_KEY,
      review.edu_email,
      prUser,
      verifyUrl,
    );

    if (sent) {
      await c.env.DB.prepare(
        "UPDATE applications SET status = 'emailed' WHERE github_id = ?",
      ).bind(prUser).run();

      await github.commentPR(
        prNumber,
        `✅ 申请通过！验证邮件已发送到你的 edu 邮箱，请查收并完成验证。\n\n如未收到邮件，请检查垃圾邮件文件夹。`,
      );
    }
  }

  return c.json({ ok: true, action: "approved", github_id: prUser });
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
