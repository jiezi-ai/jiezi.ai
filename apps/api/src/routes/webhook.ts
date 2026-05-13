import { Hono } from "hono";
import type { Env } from "../index";

const app = new Hono<{ Bindings: Env }>();

app.post("/github", async (c) => {
  const { cache } = c.var;
  const event = c.req.header("X-GitHub-Event");

  if (event !== "push") {
    return c.json({ ok: true, skipped: true });
  }

  const body = await c.req.json<{
    commits?: Array<{ modified?: string[]; added?: string[] }>;
  }>();

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
});

export default app;
