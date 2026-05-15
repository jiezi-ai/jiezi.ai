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

  if (event === "issues") {
    return handleIssue(c, body);
  }

  if (event === "push") {
    return handlePush(c, body);
  }

  return c.json({ ok: true, skipped: true });
});

function extractApplyCode(text: string): string | null {
  const match = text.match(/JZ-[A-Z0-9]{4}/);
  return match ? match[0] : null;
}

export async function processIssue(c: Context<{ Bindings: Env }>, body: any) {
  return handleIssue(c, body);
}

async function handleIssue(c: Context<{ Bindings: Env }>, body: any) {
  const github = c.var.github as GitHubClient;
  const action = body.action;

  if (action !== "opened") {
    return c.json({ ok: true, skipped: true, reason: "not opened" });
  }

  const issue = body.issue;
  const issueNumber: number = issue.number;
  const issueUser: string = issue.user.login;
  const issueBody: string = (issue.body || "") + " " + (issue.title || "");

  const applyCode = extractApplyCode(issueBody);
  if (!applyCode) {
    console.warn(`[issue:${issueNumber}] no apply code found`);
    await github.commentIssue(
      issueNumber,
      "⚠️ 未找到有效的申请码（格式：`JZ-XXXX`）。\n\n还没有申请码？请先到 [jiezi.ai/apply](https://jiezi.ai/apply) 提交申请。",
    );
    return c.json({ ok: true, action: "no_apply_code" });
  }

  try {
    const application = await c.env.DB.prepare(
      "SELECT * FROM applications WHERE apply_code = ?",
    ).bind(applyCode).first();

    if (!application) {
      console.warn(`[issue:${issueNumber}] apply code ${applyCode} not found in DB`);
      await github.commentIssue(
        issueNumber,
        `⚠️ 申请码 \`${applyCode}\` 不存在。请检查是否正确，或到 [jiezi.ai/apply](https://jiezi.ai/apply) 重新申请。`,
      );
      return c.json({ ok: true, action: "invalid_code" });
    }

    if (application.status !== "draft") {
      const statusMsg: Record<string, string> = {
        rejected: "你的申请已被驳回，请到 [jiezi.ai/apply](https://jiezi.ai/apply) 修改信息后重新提交 Issue。",
        approved: "你的申请正在处理中。",
        emailed: "验证邮件已发送，请查收 edu 邮箱。",
        verified: "你已完成验证。",
        fulfilled: "资源已发放。",
      };
      await github.commentIssue(
        issueNumber,
        statusMsg[application.status as string] || `当前状态：${application.status}`,
      );
      return c.json({ ok: true, action: "wrong_status", status: application.status });
    }

    const batch = application.batch as number || 1;
    await github.addLabels(issueNumber, ["reviewing", `batch-${batch}`]);
    console.log(`[issue:${issueNumber}] ${applyCode} by ${issueUser}, reviewing`);

    const batchCount = await c.env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM applications WHERE batch = ? AND status NOT IN ('draft', 'rejected')",
    ).bind(batch).first();

    if (batchCount && (batchCount as any).cnt >= 100) {
      await github.commentIssue(issueNumber, `第 ${batch} 批已满 100 人，请等待下一批次开放。`);
      await github.addLabels(issueNumber, ["rejected"]);
      await github.removeLabel(issueNumber, "reviewing");
      console.log(`[issue:${issueNumber}] batch ${batch} full, rejected`);
      return c.json({ ok: true, action: "batch_full" });
    }

    if (!c.env.GEMINI_API_KEY) {
      console.error(`[issue:${issueNumber}] GEMINI_API_KEY not configured`);
      return c.json({ ok: false, error: "GEMINI_API_KEY not configured" }, 500);
    }

    const applicationInfo = `学校: ${application.school}\n专业: ${application.major}\n年级: ${application.grade}\nedu 邮箱: ${application.edu_email}\n想用 AI 做什么: ${application.motivation}`;

    let review: { pass: boolean; reason: string };
    try {
      review = await reviewApplication(c.env.GEMINI_API_KEY, applicationInfo, issueUser);
      console.log(`[issue:${issueNumber}] gemini review: pass=${review.pass}, reason=${review.reason}`);
    } catch (e: any) {
      console.error(`[issue:${issueNumber}] gemini review failed:`, e);
      await github.commentIssue(
        issueNumber,
        "⚠️ 自动审核暂时不可用，管理员将手动处理你的申请。请稍等。",
      );
      return c.json({ ok: false, error: `gemini review failed: ${e.message}` }, 500);
    }

    if (!review.pass) {
      await github.commentIssue(
        issueNumber,
        `申请未通过审核。\n\n**原因**：${review.reason}\n\n请到 [jiezi.ai/apply](https://jiezi.ai/apply?code=${applyCode}) 修改信息后重新提交 Issue。`,
      );
      await github.removeLabel(issueNumber, "reviewing");
      await github.addLabels(issueNumber, ["rejected"]);

      await c.env.DB.prepare(
        "UPDATE applications SET status = 'rejected', github_id = ?, updated_at = datetime('now') WHERE apply_code = ?",
      ).bind(issueUser, applyCode).run();

      return c.json({ ok: true, action: "rejected", reason: review.reason });
    }

    await github.removeLabel(issueNumber, "reviewing");
    await github.addLabels(issueNumber, ["approved"]);

    const verifyToken = crypto.randomUUID();
    const verifyUrl = `https://api.jiezi.ai/api/verify?token=${verifyToken}`;

    await c.env.DB.prepare(
      "UPDATE applications SET status = 'approved', github_id = ?, verify_token = ?, updated_at = datetime('now') WHERE apply_code = ?",
    ).bind(issueUser, verifyToken, applyCode).run();

    if (c.env.RESEND_API_KEY && application.edu_email) {
      try {
        const sent = await sendVerificationEmail(
          c.env.RESEND_API_KEY,
          application.edu_email as string,
          issueUser,
          verifyUrl,
        );

        if (sent) {
          await c.env.DB.prepare(
            "UPDATE applications SET status = 'emailed' WHERE apply_code = ?",
          ).bind(applyCode).run();

          await github.commentIssue(
            issueNumber,
            `✅ 审核通过！验证邮件已发送到你的 edu 邮箱，请查收并完成验证。\n\n如未收到邮件，请检查垃圾邮件文件夹。\n\n验证完成后本 Issue 将自动关闭。`,
          );
          console.log(`[issue:${issueNumber}] ${applyCode} approved, email sent`);
        } else {
          console.error(`[issue:${issueNumber}] ${applyCode} approved but email send returned false`);
        }
      } catch (e: any) {
        console.error(`[issue:${issueNumber}] email send failed:`, e);
        await github.commentIssue(
          issueNumber,
          `✅ 审核通过！但验证邮件发送失败，管理员将手动处理。`,
        );
      }
    }

    await c.env.DB.prepare(
      "UPDATE applications SET pr_number = ? WHERE apply_code = ?",
    ).bind(issueNumber, applyCode).run();

    return c.json({ ok: true, action: "approved", github_id: issueUser, apply_code: applyCode });
  } catch (e: any) {
    console.error(`[issue:${issueNumber}] unhandled error:`, e);
    return c.json({ ok: false, error: e.message }, 500);
  }
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
    if (file.startsWith("records/sponsors")) invalidations.push("sponsors");
    if (file.startsWith("ledger/")) invalidations.push("budget");
  }

  const unique = [...new Set(invalidations)];
  await Promise.all(unique.map((key) => cache.invalidate(key)));

  console.log(`[push] invalidated: ${unique.join(", ") || "none"}`);

  return c.json({ ok: true, invalidated: unique });
}

export default app;
