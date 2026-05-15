import { Hono } from "hono";
import type { Env } from "../index";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "JZ-";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

const app = new Hono<{ Bindings: Env }>();

// 提交申请表单
app.post("/", async (c) => {
  // IP 限频
  const ip = c.req.header("cf-connecting-ip") || "unknown";
  const rateKey = `rate:apply:${ip}`;
  const { cache } = c.var;
  const count = await cache.get<number>(rateKey);
  if (count && count >= 5) {
    return c.json({ error: "提交过于频繁，请稍后再试" }, 429);
  }

  const body = await c.req.json<{
    name?: string;
    school?: string;
    major?: string;
    grade?: string;
    edu_email?: string;
    motivation?: string;
  }>();

  if (!body.edu_email || !body.school || !body.name) {
    return c.json({ error: "姓名、学校和 edu 邮箱为必填项" }, 400);
  }

  const emailLower = body.edu_email.toLowerCase().trim();

  if (!emailLower.endsWith(".edu.cn") && !emailLower.endsWith(".edu")) {
    return c.json({ error: "请使用 edu 邮箱（以 .edu.cn 或 .edu 结尾）" }, 400);
  }

  // 检查邮箱是否已有有效申请
  const existing = await c.env.DB.prepare(
    "SELECT apply_code, status FROM applications WHERE edu_email = ? AND status != 'rejected'",
  ).bind(emailLower).first();

  if (existing) {
    return c.json({
      error: "该邮箱已有申请记录",
      apply_code: existing.apply_code,
      status: existing.status,
    }, 409);
  }

  // 生成唯一申请码
  let applyCode = generateCode();
  for (let retry = 0; retry < 5; retry++) {
    const dup = await c.env.DB.prepare(
      "SELECT id FROM applications WHERE apply_code = ?",
    ).bind(applyCode).first();
    if (!dup) break;
    applyCode = generateCode();
  }

  await c.env.DB.prepare(
    "INSERT INTO applications (apply_code, name, school, major, grade, edu_email, motivation, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft')",
  ).bind(applyCode, body.name, body.school, body.major || "", body.grade || "", emailLower, body.motivation || "").run();

  // 更新限频计数
  await cache.set(rateKey, (count || 0) + 1, 3600);

  return c.json({
    apply_code: applyCode,
    status: "draft",
    message: "申请码已生成，请在 GitHub 提交 Issue 完成申请",
  });
});

// 查看申请状态（需要邮箱验证身份）
app.post("/:code", async (c) => {
  const code = c.req.param("code").toUpperCase();
  const body = await c.req.json<{ edu_email: string }>();

  if (!body.edu_email) {
    return c.json({ error: "请提供 edu 邮箱验证身份" }, 400);
  }

  const record = await c.env.DB.prepare(
    "SELECT * FROM applications WHERE apply_code = ? AND edu_email = ?",
  ).bind(code, body.edu_email.toLowerCase().trim()).first();

  if (!record) {
    return c.json({ error: "申请码不存在或邮箱不匹配" }, 404);
  }

  return c.json({
    apply_code: record.apply_code,
    status: record.status,
    name: record.name,
    school: record.school,
    major: record.major,
    grade: record.grade,
    motivation: record.motivation,
    github_id: record.github_id,
    created_at: record.created_at,
  });
});

// 修改申请信息（仅 draft/rejected 状态可改）
app.put("/:code", async (c) => {
  const code = c.req.param("code").toUpperCase();
  const body = await c.req.json<{
    edu_email: string;
    name?: string;
    school?: string;
    major?: string;
    grade?: string;
    motivation?: string;
  }>();

  if (!body.edu_email) {
    return c.json({ error: "请提供 edu 邮箱验证身份" }, 400);
  }

  const record = await c.env.DB.prepare(
    "SELECT id, status FROM applications WHERE apply_code = ? AND edu_email = ?",
  ).bind(code, body.edu_email.toLowerCase().trim()).first();

  if (!record) {
    return c.json({ error: "申请码不存在或邮箱不匹配" }, 404);
  }

  if (record.status !== "draft" && record.status !== "rejected") {
    return c.json({ error: "申请已通过审核，信息不可修改" }, 403);
  }

  await c.env.DB.prepare(
    "UPDATE applications SET name = COALESCE(?, name), school = COALESCE(?, school), major = COALESCE(?, major), grade = COALESCE(?, grade), motivation = COALESCE(?, motivation), status = 'draft', updated_at = datetime('now') WHERE id = ?",
  ).bind(body.name || null, body.school || null, body.major || null, body.grade || null, body.motivation || null, record.id).run();

  return c.json({ ok: true, status: "draft" });
});

export default app;
