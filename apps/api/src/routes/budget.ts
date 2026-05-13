import { Hono } from "hono";
import type { Env } from "../index";
import type { BudgetReport } from "@jiezi/shared";
import { generateReport } from "../services/beancount";

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  const { github, cache } = c.var;
  const refresh = c.req.query("refresh") === "true";

  if (!refresh) {
    const cached = await cache.get<BudgetReport>("budget");
    if (cached) return c.json(cached);
  }

  const [mainBc, yearBc] = await Promise.all([
    github.getFile("ledger/main.beancount"),
    github.getFile("ledger/2026.beancount"),
  ]);

  if (!mainBc || !yearBc) {
    return c.json({ error: "Failed to fetch ledger files" }, 500);
  }

  const report = generateReport(mainBc, yearBc);
  await cache.set("budget", report, 300);
  return c.json(report);
});

export default app;
