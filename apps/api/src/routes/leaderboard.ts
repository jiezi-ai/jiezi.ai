import { Hono } from "hono";
import type { Env } from "../index";
import { NewApiClient } from "../services/newapi";

function maskName(name: string): string {
  if (!name) return "**";
  const chars = [...name];
  if (chars.length <= 1) return chars[0] + "*";
  return chars[0] + "*".repeat(chars.length - 1);
}

const QUOTA_UNIT = 500_000; // 1 USD = 500,000 internal units

let newApiClient: NewApiClient | null = null;

function getClient(env: Env): NewApiClient | null {
  if (!env.NEWAPI_BASE_URL || !env.NEWAPI_ADMIN_USER || !env.NEWAPI_ADMIN_PASS)
    return null;
  if (!newApiClient) {
    newApiClient = new NewApiClient(
      env.NEWAPI_BASE_URL,
      env.NEWAPI_ADMIN_USER,
      env.NEWAPI_ADMIN_PASS,
    );
  }
  return newApiClient;
}

const app = new Hono<{ Bindings: Env }>();

/**
 * GET /api/leaderboard/summary
 * Overall stats for the leaderboard header.
 */
app.get("/summary", async (c) => {
  const { cache } = c.var;
  const cached = await cache.get<any>("lb:summary");
  if (cached) return c.json(cached);

  const client = getClient(c.env);
  if (!client) return c.json({ total_students: 0, total_used_usd: 0, total_requests: 0, schools_count: 0 });

  try {
    const [users, apps] = await Promise.all([
      client.getUsers(),
      c.env.DB.prepare(
        "SELECT DISTINCT school FROM applications WHERE status IN ('verified','fulfilled') AND school IS NOT NULL",
      ).all(),
    ]);

    const totalUsed = users.reduce((s, u) => s + u.used_quota, 0);
    const totalReqs = users.reduce((s, u) => s + (u.request_count || 0), 0);

    const summary = {
      total_students: users.length,
      total_used_usd: +(totalUsed / QUOTA_UNIT).toFixed(2),
      total_requests: totalReqs,
      schools_count: apps.results?.length || 0,
    };

    await cache.set("lb:summary", summary, 300);
    return c.json(summary);
  } catch (e) {
    return c.json({ total_students: 0, total_used_usd: 0, total_requests: 0, schools_count: 0 });
  }
});

/**
 * GET /api/leaderboard/explorers?period=all
 * Student usage ranking — names masked, no sensitive data.
 */
app.get("/explorers", async (c) => {
  const period = c.req.query("period") || "all";
  const cacheKey = `lb:explorers:${period}`;
  const { cache } = c.var;

  const cached = await cache.get<any>(cacheKey);
  if (cached) return c.json(cached);

  const client = getClient(c.env);
  if (!client) return c.json({ students: [], total: 0 });

  try {
    const [users, appsResult] = await Promise.all([
      client.getUsers(),
      c.env.DB.prepare(
        "SELECT github_id, name, school, major, batch FROM applications WHERE status IN ('verified','fulfilled') AND github_id IS NOT NULL",
      ).all(),
    ]);

    const appMap = new Map<string, any>();
    for (const a of appsResult.results || []) {
      if (a.github_id) appMap.set(a.github_id as string, a);
    }

    // If period is not "all", we'd need time-filtered data from /api/data/users
    // For now, use total used_quota from user list (works for all periods)
    let userQuotaMap: Map<string, { used: number; requests: number }>;

    if (period !== "all") {
      // Try to get time-filtered data
      const now = Math.floor(Date.now() / 1000);
      let start: number;
      switch (period) {
        case "week":
          start = now - 7 * 86400;
          break;
        case "month":
          start = now - 30 * 86400;
          break;
        default:
          start = 0;
      }
      const dataPoints = await client.getUserData(start, now);
      if (dataPoints.length > 0) {
        userQuotaMap = new Map();
        for (const dp of dataPoints) {
          const existing = userQuotaMap.get(dp.username) || { used: 0, requests: 0 };
          existing.used += dp.quota;
          existing.requests += dp.count;
          userQuotaMap.set(dp.username, existing);
        }
      } else {
        // Fallback to total data
        userQuotaMap = new Map(
          users.map((u) => [u.username, { used: u.used_quota, requests: u.request_count || 0 }]),
        );
      }
    } else {
      userQuotaMap = new Map(
        users.map((u) => [u.username, { used: u.used_quota, requests: u.request_count || 0 }]),
      );
    }

    // Default initial allocation is $20 = 10,000,000 units
    // Use max(default, quota, used_quota) since quota may have been reduced after usage
    const DEFAULT_QUOTA = 10_000_000; // $20
    const allocatedQuotaMap = new Map(
      users.map((u) => [u.username, Math.max(DEFAULT_QUOTA, u.quota, u.used_quota)]),
    );

    const students = users
      .filter((u) => u.used_quota > 0 || (userQuotaMap.get(u.username)?.used || 0) > 0)
      .map((u) => {
        const app = appMap.get(u.username);
        const periodData = userQuotaMap.get(u.username) || { used: 0, requests: 0 };
        const allocated = allocatedQuotaMap.get(u.username) || Math.max(u.quota, u.used_quota);
        return {
          name: maskName(app?.name || u.display_name?.split("(")[0]?.trim() || ""),
          school: app?.school || "",
          major: app?.major || "",
          batch: app?.batch || 0,
          used_usd: +(periodData.used / QUOTA_UNIT).toFixed(2),
          quota_usd: +(allocated / QUOTA_UNIT).toFixed(2),
          usage_pct: allocated > 0 ? +Math.min(periodData.used / allocated * 100, 100).toFixed(1) : 0,
          request_count: periodData.requests,
        };
      })
      .sort((a, b) => b.used_usd - a.used_usd);

    const result = { students, total: students.length };
    await cache.set(cacheKey, result, 300);
    return c.json(result);
  } catch (e) {
    return c.json({ students: [], total: 0 });
  }
});

/**
 * GET /api/leaderboard/models?period=week
 * Model popularity ranking — from New API rankings endpoint.
 */
app.get("/models", async (c) => {
  const period = c.req.query("period") || "week";
  const cacheKey = `lb:models:${period}`;
  const { cache } = c.var;

  const cached = await cache.get<any>(cacheKey);
  if (cached) return c.json(cached);

  const client = getClient(c.env);
  if (!client) return c.json({ models: [], vendors: [] });

  try {
    const rankings = await client.getRankings(period);
    if (!rankings) return c.json({ models: [], vendors: [] });

    const models = (rankings.models || []).map((m) => ({
      rank: m.rank,
      name: m.model_name,
      vendor: m.vendor,
      tokens: m.total_tokens,
      share: +(m.share * 100).toFixed(1),
      growth_pct: +m.growth_pct.toFixed(1),
      rank_delta: m.previous_rank > 0 ? m.previous_rank - m.rank : 0,
    }));

    const vendors = (rankings.vendors || []).map((v) => ({
      rank: v.rank,
      name: v.vendor,
      tokens: v.total_tokens,
      share: +(v.share * 100).toFixed(1),
      models_count: v.models_count,
      top_model: v.top_model,
    }));

    const result = { models, vendors };
    await cache.set(cacheKey, result, 300);
    return c.json(result);
  } catch {
    return c.json({ models: [], vendors: [] });
  }
});

/**
 * GET /api/leaderboard/schools?sort=quota
 * School aggregation ranking.
 */
app.get("/schools", async (c) => {
  const sort = c.req.query("sort") || "quota";
  const cacheKey = `lb:schools:${sort}`;
  const { cache } = c.var;

  const cached = await cache.get<any>(cacheKey);
  if (cached) return c.json(cached);

  const client = getClient(c.env);
  if (!client) return c.json({ schools: [] });

  try {
    const [users, appsResult] = await Promise.all([
      client.getUsers(),
      c.env.DB.prepare(
        "SELECT github_id, school FROM applications WHERE status IN ('verified','fulfilled') AND github_id IS NOT NULL AND school IS NOT NULL",
      ).all(),
    ]);

    const userMap = new Map(users.map((u) => [u.username, u]));
    const schoolMap = new Map<
      string,
      { count: number; used: number; requests: number }
    >();

    for (const app of appsResult.results || []) {
      const githubId = app.github_id as string;
      const school = app.school as string;
      if (!school) continue;

      const user = userMap.get(githubId);
      const entry = schoolMap.get(school) || { count: 0, used: 0, requests: 0 };
      entry.count++;
      if (user) {
        entry.used += user.used_quota;
        entry.requests += user.request_count || 0;
      }
      schoolMap.set(school, entry);
    }

    let schools = Array.from(schoolMap.entries()).map(([name, data]) => ({
      name,
      student_count: data.count,
      total_used_usd: +(data.used / QUOTA_UNIT).toFixed(2),
      total_requests: data.requests,
    }));

    // Sort
    switch (sort) {
      case "count":
        schools.sort((a, b) => b.student_count - a.student_count);
        break;
      case "requests":
        schools.sort((a, b) => b.total_requests - a.total_requests);
        break;
      default: // quota
        schools.sort((a, b) => b.total_used_usd - a.total_used_usd);
    }

    const result = { schools };
    await cache.set(cacheKey, result, 300);
    return c.json(result);
  } catch {
    return c.json({ schools: [] });
  }
});

/**
 * GET /api/leaderboard/trends?range=7
 * Daily usage trend data.
 */
app.get("/trends", async (c) => {
  const range = parseInt(c.req.query("range") || "7", 10);
  const cacheKey = `lb:trends:${range}`;
  const { cache } = c.var;

  const cached = await cache.get<any>(cacheKey);
  if (cached) return c.json(cached);

  const client = getClient(c.env);
  if (!client) return c.json({ points: [], summary: {} });

  try {
    const now = Math.floor(Date.now() / 1000);
    const start = range > 0 ? now - range * 86400 : 0;
    const dataPoints = await client.getUserData(start, now);

    // Aggregate by day
    const dayMap = new Map<
      string,
      { used: number; requests: number; users: Set<string> }
    >();

    for (const dp of dataPoints) {
      const date = new Date(dp.created_at * 1000).toISOString().split("T")[0];
      const entry = dayMap.get(date) || {
        used: 0,
        requests: 0,
        users: new Set(),
      };
      entry.used += dp.quota;
      entry.requests += dp.count;
      entry.users.add(dp.username);
      dayMap.set(date, entry);
    }

    const points = Array.from(dayMap.entries())
      .map(([date, data]) => ({
        date,
        used_usd: +(data.used / QUOTA_UNIT).toFixed(2),
        requests: data.requests,
        active_users: data.users.size,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Summary
    const totalUsed = points.reduce((s, p) => s + p.used_usd, 0);
    const totalReqs = points.reduce((s, p) => s + p.requests, 0);
    const days = points.length || 1;

    const result = {
      points,
      summary: {
        avg_daily_usd: +(totalUsed / days).toFixed(2),
        avg_daily_requests: Math.round(totalReqs / days),
        total_days: days,
      },
    };

    await cache.set(cacheKey, result, 300);
    return c.json(result);
  } catch {
    return c.json({ points: [], summary: {} });
  }
});

export default app;
