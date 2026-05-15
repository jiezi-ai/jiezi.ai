import { Hono } from "hono";
import type { Env } from "../index";

const app = new Hono<{ Bindings: Env }>();

app.use("*", async (c, next) => {
  const token = c.req.header("authorization")?.replace("Bearer ", "");
  if (!token || token !== c.env.ADMIN_TOKEN) {
    return c.json({ error: "unauthorized" }, 401);
  }
  await next();
});

app.get("/applications", async (c) => {
  const status = c.req.query("status");
  const batch = c.req.query("batch");

  let sql = "SELECT * FROM applications";
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (status) {
    conditions.push("status = ?");
    params.push(status);
  }
  if (batch) {
    conditions.push("batch = ?");
    params.push(Number(batch));
  }

  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }
  sql += " ORDER BY id DESC";

  const stmt = c.env.DB.prepare(sql);
  const { results } = await (params.length > 0
    ? stmt.bind(...params)
    : stmt
  ).all();

  const stats = await c.env.DB.prepare(
    "SELECT status, COUNT(*) as count FROM applications GROUP BY status",
  ).all();

  return c.json({
    total: results.length,
    stats: stats.results,
    applications: results,
  });
});

app.post("/retry-issue/:number", async (c) => {
  const issueNumber = Number(c.req.param("number"));

  const ghHeaders: HeadersInit = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "jiezi-api",
  };
  if (c.env.GITHUB_TOKEN) ghHeaders["Authorization"] = `Bearer ${c.env.GITHUB_TOKEN}`;

  const issue = await fetch(
    `https://api.github.com/repos/${c.env.GITHUB_OWNER}/${c.env.GITHUB_REPO}/issues/${issueNumber}`,
    { headers: ghHeaders },
  ).then((r) => r.json()) as any;

  if (!issue || issue.message) {
    return c.json({ error: `Issue #${issueNumber} not found`, detail: issue?.message }, 404);
  }

  const { processIssue } = await import("./webhook");
  const result = await processIssue(c, {
    action: "opened",
    issue: {
      number: issueNumber,
      title: issue.title,
      body: issue.body,
      user: { login: issue.user.login },
    },
  });

  return result;
});

export default app;
