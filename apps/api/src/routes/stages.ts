import { Hono } from "hono";
import type { Env } from "../index";
import type { StageInfo } from "@jiezi/shared";
import { extractTitle } from "../services/markdown";

const STAGE_FILES = ["stage-1.md", "stage-2.md", "stage-3.md"];

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  const { github, cache } = c.var;

  const cached = await cache.get<StageInfo[]>("stages");
  if (cached) return c.json(cached);

  const stages: StageInfo[] = [];
  for (const file of STAGE_FILES) {
    const content = await github.getFile(`stages/${file}`);
    if (content) {
      stages.push({
        id: file.replace(".md", ""),
        title: extractTitle(content),
        content,
      });
    }
  }

  await cache.set("stages", stages, 3600);
  return c.json(stages);
});

export default app;
