import { Hono } from "hono";
import type { Env } from "../index";
import { parseMarkdownTable } from "../services/markdown";

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  const { github, cache } = c.var;
  const cacheKey = "sponsors";

  const cached = await cache.get<unknown>(cacheKey);
  if (cached) return c.json(cached);

  const content = await github.getFile("records/sponsors.md");
  if (!content) return c.json({ sponsors: [] });

  const rows = parseMarkdownTable(content);
  const sponsors = rows.map((row) => ({
    name: row["名称"] || "",
    amount: row["金额"] || "",
    date: row["日期"] || "",
    bio: row["简介"] || "",
    avatar: row["头像"] || "",
    link: row["链接"] || "",
  }));

  const result = { sponsors };
  await cache.set(cacheKey, result, 3600);
  return c.json(result);
});

export default app;
