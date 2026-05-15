import { Hono } from "hono";
import type { Env } from "../index";

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  const { github, cache } = c.var;

  const cached = await cache.get<{ content: string }>("design");
  if (cached) return c.json(cached);

  const readme = await github.getFile("README.md");
  if (!readme) return c.json({ error: "README not found" }, 404);

  const section = extractSection(readme, "为什么这样设计");
  if (!section) return c.json({ error: "Section not found" }, 404);

  const result = { content: section };
  await cache.set("design", result, 3600);
  return c.json(result);
});

function extractSection(markdown: string, heading: string): string | null {
  const lines = markdown.split("\n");
  let start = -1;
  let end = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (start === -1) {
      if (line.match(new RegExp(`^##\\s+${heading}`))) {
        start = i + 1;
      }
    } else if (line.match(/^## /)) {
      end = i;
      break;
    }
  }

  if (start === -1) return null;
  return lines.slice(start, end).join("\n").trim();
}

export default app;
