import { Hono } from "hono";
import type { Env } from "../index";
import type { ChangelogEntry } from "@jiezi/shared";
import { parseMarkdownTable } from "../services/markdown";

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  const { github, cache } = c.var;

  const cached = await cache.get<ChangelogEntry[]>("changelog");
  if (cached) return c.json(cached);

  const md = await github.getFile("records/changelog.md");
  if (!md) return c.json([]);

  const rows = parseMarkdownTable(md);
  const entries: ChangelogEntry[] = rows.map((row) => ({
    id: row["编号"],
    date: row["日期"],
    change: row["变更内容"],
    reason: row["原因"],
    scope: row["影响范围"],
    effective: row["生效时间"],
  }));

  await cache.set("changelog", entries, 3600);
  return c.json(entries);
});

export default app;
