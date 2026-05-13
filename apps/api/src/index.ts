import { Hono } from "hono";
import { cors } from "hono/cors";
import { GitHubClient } from "./services/github";
import { CacheService } from "./services/cache";
import overview from "./routes/overview";
import budget from "./routes/budget";
import stages from "./routes/stages";
import batches from "./routes/batches";
import policy from "./routes/policy";
import changelog from "./routes/changelog";
import projects from "./routes/projects";
import webhook from "./routes/webhook";
import verify from "./routes/verify";

export interface Env {
  CACHE: KVNamespace;
  DB: D1Database;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  GITHUB_TOKEN?: string;
  RESEND_API_KEY?: string;
  GEMINI_API_KEY?: string;
  WECHAT_QR_URL?: string;
}

declare module "hono" {
  interface ContextVariableMap {
    github: GitHubClient;
    cache: CacheService;
  }
}

const app = new Hono<{ Bindings: Env }>();

app.use("*", cors());

app.use("/api/*", async (c, next) => {
  const github = new GitHubClient(
    c.env.GITHUB_OWNER,
    c.env.GITHUB_REPO,
    c.env.GITHUB_TOKEN,
  );
  const cache = new CacheService(c.env.CACHE);
  c.set("github", github);
  c.set("cache", cache);
  await next();
});

app.route("/api/overview", overview);
app.route("/api/budget", budget);
app.route("/api/stages", stages);
app.route("/api/batches", batches);
app.route("/api/policy", policy);
app.route("/api/changelog", changelog);
app.route("/api/projects", projects);
app.route("/api/webhook", webhook);
app.route("/api/verify", verify);

app.get("/", (c) => c.json({ name: "jiezi-api", status: "ok" }));

export default app;
