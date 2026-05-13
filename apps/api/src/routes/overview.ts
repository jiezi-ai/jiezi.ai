import { Hono } from "hono";
import type { Env } from "../index";
import type { Overview, BatchSummary, Milestone } from "@jiezi/shared";
import { parseMarkdownTable } from "../services/markdown";

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  const { github, cache } = c.var;

  const cached = await cache.get<Overview>("overview");
  if (cached) return c.json(cached);

  const [batchesMd, milestonesMd] = await Promise.all([
    github.getFile("records/batches.md"),
    github.getFile("records/milestones.md"),
  ]);

  const batchRows = batchesMd ? parseMarkdownTable(batchesMd) : [];
  const batches: BatchSummary[] = batchRows.map((row, i) => ({
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

  const milestoneRows = milestonesMd ? parseMarkdownTable(milestonesMd) : [];
  const milestones: Milestone[] = milestoneRows.map((row) => ({
    name: row["里程碑"],
    achievedDate:
      row["达成日期"] === "—" ? undefined : row["达成日期"],
  }));

  const stage1Total = batches.reduce((sum, b) => sum + b.approved, 0);

  const overview: Overview = {
    totalBudget: 150000,
    totalSpent: 0,
    remaining: 150000,
    currency: "CNY",
    batches,
    funnel: {
      stage1: stage1Total,
      stage2: 0,
      stage3: 0,
    },
    milestones,
  };

  await cache.set("overview", overview, 300);
  return c.json(overview);
});

export default app;
