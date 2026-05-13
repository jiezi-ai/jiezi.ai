import { Hono } from "hono";
import type { Env } from "../index";
import type { BatchSummary } from "@jiezi/shared";
import { parseMarkdownTable } from "../services/markdown";

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  const { github, cache } = c.var;

  const cached = await cache.get<BatchSummary[]>("batches");
  if (cached) return c.json(cached);

  const md = await github.getFile("records/batches.md");
  if (!md) return c.json([]);

  const rows = parseMarkdownTable(md);
  const batches: BatchSummary[] = rows.map((row, i) => ({
    id: i + 1,
    status:
      row["状态"] === "筹备中"
        ? "preparing"
        : row["状态"] === "未开始"
          ? "preparing"
          : "open",
    applicants: row["申请数"] === "—" ? 0 : parseInt(row["申请数"]) || 0,
    approved: row["通过数"] === "—" ? 0 : parseInt(row["通过数"]) || 0,
    openDate: row["开放时间"] === "待定" ? undefined : row["开放时间"],
  }));

  await cache.set("batches", batches, 300);
  return c.json(batches);
});

app.get("/:id", async (c) => {
  const { github, cache } = c.var;
  const batchId = parseInt(c.req.param("id"));

  const cacheKey = `batch:${batchId}`;
  const cached = await cache.get<BatchSummary & { students: string[] }>(
    cacheKey,
  );
  if (cached) return c.json(cached);

  const dir = `students/batch-${batchId}`;
  const files = await github.listDir(dir);
  const students = files
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .map((f) => f.replace(".md", ""));

  const result = {
    id: batchId,
    status: "preparing" as const,
    applicants: students.length,
    approved: 0,
    students,
  };

  await cache.set(cacheKey, result, 300);
  return c.json(result);
});

export default app;
