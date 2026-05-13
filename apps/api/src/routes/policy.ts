import { Hono } from "hono";
import type { Env } from "../index";
import type { PolicyInfo } from "@jiezi/shared";
import { extractTitle } from "../services/markdown";

const POLICY_FILES = [
  "eligibility.md",
  "resources.md",
  "selection.md",
  "batches.md",
  "budget.md",
  "integrity.md",
  "governance.md",
];

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  const { github, cache } = c.var;

  const cached = await cache.get<PolicyInfo[]>("policies");
  if (cached) return c.json(cached);

  const policies: PolicyInfo[] = [];
  for (const file of POLICY_FILES) {
    const content = await github.getFile(`policy/${file}`);
    if (content) {
      policies.push({
        name: file.replace(".md", ""),
        title: extractTitle(content),
        content,
      });
    }
  }

  await cache.set("policies", policies, 3600);
  return c.json(policies);
});

app.get("/:name", async (c) => {
  const { github, cache } = c.var;
  const name = c.req.param("name");

  const cacheKey = `policy:${name}`;
  const cached = await cache.get<PolicyInfo>(cacheKey);
  if (cached) return c.json(cached);

  const content = await github.getFile(`policy/${name}.md`);
  if (!content) return c.json({ error: "Policy not found" }, 404);

  const policy: PolicyInfo = {
    name,
    title: extractTitle(content),
    content,
  };

  await cache.set(cacheKey, policy, 3600);
  return c.json(policy);
});

export default app;
