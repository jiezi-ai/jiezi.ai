import { Hono } from "hono";
import type { Env } from "../index";
import type { ProjectInfo } from "@jiezi/shared";

const EXCLUDED_REPOS = ["grant", ".github"];

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  const { github, cache } = c.var;

  const cached = await cache.get<ProjectInfo[]>("projects");
  if (cached) return c.json(cached);

  const repos = await github.listOrgRepos();
  const projects: ProjectInfo[] = repos
    .filter((r) => !EXCLUDED_REPOS.includes(r.name))
    .map((r) => ({
      name: r.name,
      description: r.description || "",
      url: r.html_url,
      stars: r.stargazers_count,
      owner: r.owner.login,
      language: r.language || undefined,
    }));

  await cache.set("projects", projects, 1800);
  return c.json(projects);
});

export default app;
