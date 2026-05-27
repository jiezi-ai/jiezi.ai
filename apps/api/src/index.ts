import { Hono } from "hono";
import { cors } from "hono/cors";
import { Database } from "bun:sqlite";
import { GitHubClient } from "./services/github";
import { CacheService } from "./services/cache";
import { SqliteDatabase } from "./services/database";
import overview from "./routes/overview";
import budget from "./routes/budget";
import stages from "./routes/stages";
import batches from "./routes/batches";
import policy from "./routes/policy";
import changelog from "./routes/changelog";
import projects from "./routes/projects";
import webhook from "./routes/webhook";
import verify from "./routes/verify";
import apply from "./routes/apply";
import students from "./routes/students";
import admin from "./routes/admin";
import sponsors from "./routes/sponsors";
import design from "./routes/design";

export interface Env {
  DB: SqliteDatabase;
  CACHE: CacheService;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  GITHUB_TOKEN?: string;
  RESEND_API_KEY?: string;
  GEMINI_API_KEY?: string;
  WECHAT_GROUP_QR_URL?: string;
  ADMIN_TOKEN?: string;
  BARK_KEY?: string;
  NEWAPI_BASE_URL?: string;
  NEWAPI_STUDENT_URL?: string;
  NEWAPI_ADMIN_USER?: string;
  NEWAPI_ADMIN_PASS?: string;
}

declare module "hono" {
  interface ContextVariableMap {
    github: GitHubClient;
    cache: CacheService;
  }
}

// Initialize singletons
const dbPath = process.env.DB_PATH || "./data/jiezi.db";
const sqliteDb = new Database(dbPath, { create: true });
sqliteDb.exec("PRAGMA journal_mode=WAL;");
const db = new SqliteDatabase(sqliteDb);
const cache = new CacheService();

const env: Env = {
  DB: db,
  CACHE: cache,
  GITHUB_OWNER: process.env.GITHUB_OWNER || "jiezi-ai",
  GITHUB_REPO: process.env.GITHUB_REPO || "grant",
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  WECHAT_GROUP_QR_URL: process.env.WECHAT_GROUP_QR_URL,
  ADMIN_TOKEN: process.env.ADMIN_TOKEN,
  BARK_KEY: process.env.BARK_KEY,
  NEWAPI_BASE_URL: process.env.NEWAPI_BASE_URL,
  NEWAPI_STUDENT_URL: process.env.NEWAPI_STUDENT_URL,
  NEWAPI_ADMIN_USER: process.env.NEWAPI_ADMIN_USER,
  NEWAPI_ADMIN_PASS: process.env.NEWAPI_ADMIN_PASS,
};

const app = new Hono<{ Bindings: Env }>();

app.use("*", cors());

app.use("/api/*", async (c, next) => {
  // Inject env bindings
  Object.assign(c.env, env);

  const github = new GitHubClient(
    env.GITHUB_OWNER,
    env.GITHUB_REPO,
    env.GITHUB_TOKEN,
  );
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
app.route("/api/apply", apply);
app.route("/api/students", students);
app.route("/api/admin", admin);
app.route("/api/sponsors", sponsors);
app.route("/api/design", design);

app.get("/", (c) => c.json({ name: "jiezi-api", status: "ok" }));

const port = Number(process.env.API_PORT) || 3100;
console.log(`jiezi-api listening on :${port}`);

export default {
  port,
  fetch: app.fetch,
};
