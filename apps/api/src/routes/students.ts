import { Hono } from "hono";
import type { Env } from "../index";

function maskName(name: string): string {
  if (!name) return "**";
  const chars = [...name];
  if (chars.length <= 1) return chars[0] + "*";
  return chars[0] + "*".repeat(chars.length - 1);
}

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  const { cache } = c.var;

  const cached = await cache.get<any>("students_list");
  if (cached) return c.json(cached);

  const result = await c.env.DB.prepare(
    "SELECT name, school, major, batch, status, verified_at FROM applications WHERE status IN ('verified', 'fulfilled') ORDER BY verified_at DESC",
  ).all();

  const students = (result.results || []).map((r: any) => ({
    name: maskName(r.name || ""),
    school: r.school,
    major: r.major,
    batch: r.batch,
    status: r.status,
    verified_at: r.verified_at,
  }));

  const response = { count: students.length, students };
  await cache.set("students_list", response, 300);
  return c.json(response);
});

export default app;
