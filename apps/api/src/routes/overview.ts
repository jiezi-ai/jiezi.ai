import { Hono } from "hono";
import type { Env } from "../index";
import type { Overview, BatchSummary, Milestone } from "@jiezi/shared";
import { parseMarkdownTable } from "../services/markdown";
import { generateReport } from "../services/beancount";

const TOTAL_BATCHES = 6;

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  const { github, cache } = c.var;

  const cached = await cache.get<Overview>("overview");
  if (cached) return c.json(cached);

  const [milestonesMd, batchCounts, mainBc, yearBc] = await Promise.all([
    github.getFile("records/milestones.md"),
    c.env.DB.prepare(
      "SELECT batch, status, COUNT(*) as cnt FROM applications WHERE status != 'rejected' GROUP BY batch, status",
    ).all(),
    github.getFile("ledger/main.beancount"),
    github.getFile("ledger/2026.beancount"),
  ]);

  const batchData = new Map<number, { applicants: number; approved: number }>();
  for (let i = 1; i <= TOTAL_BATCHES; i++) {
    batchData.set(i, { applicants: 0, approved: 0 });
  }

  for (const row of batchCounts.results || []) {
    const batchId = row.batch as number;
    const count = row.cnt as number;
    const status = row.status as string;
    const data = batchData.get(batchId);
    if (!data) continue;

    data.applicants += count;
    if (["approved", "emailed", "verified", "fulfilled"].includes(status)) {
      data.approved += count;
    }
  }

  const batches: BatchSummary[] = Array.from(batchData.entries()).map(
    ([id, data]) => ({
      id,
      status: data.applicants > 0 ? (data.applicants >= 100 ? "closed" : "open") : "preparing",
      applicants: data.applicants,
      approved: data.approved,
    }),
  );

  const milestoneRows = milestonesMd ? parseMarkdownTable(milestonesMd) : [];
  const milestones: Milestone[] = milestoneRows.map((row) => ({
    name: row["里程碑"],
    achievedDate: row["达成日期"] === "—" ? undefined : row["达成日期"],
  }));

  const stage1Total = batches.reduce((sum, b) => sum + b.approved, 0);

  const budget = mainBc && yearBc ? generateReport(mainBc, yearBc) : null;

  const overview: Overview = {
    totalBudget: budget?.committed ?? 150000,
    totalSpent: budget?.spent ?? 0,
    remaining: budget?.remaining ?? 150000,
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
