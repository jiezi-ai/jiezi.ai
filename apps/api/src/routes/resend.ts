import { Hono } from "hono";
import type { Env } from "../index";
import { sendCredentialsEmail } from "../services/email";

const app = new Hono<{ Bindings: Env }>();

const MAX_RESEND_COUNT = 3;

app.post("/", async (c) => {
  const body = await c.req.json<{ apply_code?: string; edu_email?: string }>();
  const { apply_code, edu_email } = body;

  if (!apply_code || !edu_email) {
    return c.json({ error: "请提供申请码和 edu 邮箱" }, 400);
  }

  // 1. Look up application
  const record = await c.env.DB.prepare(
    "SELECT * FROM applications WHERE apply_code = ?",
  ).bind(apply_code).first();

  if (!record) {
    return c.json({ error: "申请码不存在" }, 404);
  }

  if ((record.edu_email as string).toLowerCase() !== edu_email.toLowerCase()) {
    return c.json({ error: "邮箱与申请记录不匹配" }, 400);
  }

  if (record.status !== "fulfilled") {
    return c.json({ error: "资源尚未发放，无法重发" }, 403);
  }

  const githubId = record.github_id as string;
  if (!githubId) {
    return c.json({ error: "缺少 GitHub ID，无法重发" }, 400);
  }

  // 2. Rate limiting: max 3 total
  const resendCount = (record.resend_count as number) || 0;
  if (resendCount >= MAX_RESEND_COUNT) {
    return c.json({ error: "已达到最大重发次数（3 次），请联系管理员" }, 403);
  }

  // 3. Rate limiting: 1 per day (memory cache)
  const cache = c.var.cache;
  const rateKey = `rate:resend:${apply_code}`;
  const rateLimited = await cache.get<boolean>(rateKey);
  if (rateLimited) {
    return c.json({ error: "今天已发送过，请明天再试" }, 429);
  }

  // 4. Verify New API env
  const baseUrl = c.env.NEWAPI_BASE_URL;
  const studentUrl = c.env.NEWAPI_STUDENT_URL || baseUrl;
  if (!baseUrl || !c.env.NEWAPI_ADMIN_USER || !c.env.NEWAPI_ADMIN_PASS) {
    return c.json({ error: "服务配置不完整，请联系管理员" }, 500);
  }

  // 5. Reset password + get API key from New API
  let result: { apiKey?: string; password?: string; error?: string };
  try {
    result = await resetAndRetrieve(baseUrl, c.env.NEWAPI_ADMIN_USER!, c.env.NEWAPI_ADMIN_PASS!, githubId);
  } catch (e: any) {
    console.error(`[resend] error for ${githubId}:`, e);
    return c.json({ error: "凭据重置失败，请联系管理员" }, 500);
  }

  if (result.error) {
    console.error(`[resend] failed for ${githubId}: ${result.error}`);
    return c.json({ error: "凭据重置失败，请联系管理员" }, 500);
  }

  // 6. Send email
  if (!c.env.RESEND_API_KEY) {
    return c.json({ error: "邮件服务未配置" }, 500);
  }

  const sent = await sendCredentialsEmail(
    c.env.RESEND_API_KEY,
    edu_email,
    githubId,
    studentUrl!,
    result.apiKey!,
    result.password!,
  );

  if (!sent) {
    return c.json({ error: "邮件发送失败，请稍后重试" }, 500);
  }

  // 7. Update DB: increment resend_count
  await c.env.DB.prepare(
    "UPDATE applications SET resend_count = resend_count + 1, last_resend_at = datetime('now') WHERE apply_code = ?",
  ).bind(apply_code).run();

  // 8. Set daily rate limit (TTL until end of day)
  const now = new Date();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const ttlSeconds = Math.ceil((endOfDay.getTime() - now.getTime()) / 1000);
  await cache.set(rateKey, true, ttlSeconds);

  console.log(`[resend] credentials sent to ${githubId} (${edu_email}), count: ${resendCount + 1}`);

  return c.json({
    message: "凭据已发送到你的 edu 邮箱，请查收",
    resend_count: resendCount + 1,
  });
});

/**
 * Reset a student's password on New API and retrieve their API key.
 * Uses GET user info -> PUT with all fields to avoid GORM zero-value clearing.
 */
async function resetAndRetrieve(
  baseUrl: string,
  adminUser: string,
  adminPass: string,
  githubId: string,
): Promise<{ apiKey?: string; password?: string; error?: string }> {
  // 1. Admin login
  const loginResp = await fetch(`${baseUrl}/api/user/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: adminUser, password: adminPass }),
  });
  const loginData = await loginResp.json() as any;
  if (!loginData.success) return { error: `admin login failed: ${loginData.message}` };

  const adminCookie = loginResp.headers.get("set-cookie")?.split(";")[0] || "";
  const adminHeaders = {
    Cookie: adminCookie,
    "New-Api-User": "1",
    "Content-Type": "application/json",
  };

  // 2. Find user by username
  const usersResp = await fetch(`${baseUrl}/api/user/?p=0&size=500`, { headers: adminHeaders });
  const usersData = await usersResp.json() as any;
  const items = usersData.data?.items || usersData.data || [];
  const user = items.find((u: any) => u.username === githubId);
  if (!user) return { error: `user ${githubId} not found in New API` };

  // 3. Generate new password
  const password = Array.from(crypto.getRandomValues(new Uint8Array(9)))
    .map((b) => "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"[b % 55])
    .join("");

  // 4. PUT /api/user/ with all existing fields + new password
  //    Edit() in New API updates: username, display_name, group, remark, password
  //    We must pass ALL of them to avoid GORM zero-value clearing
  const putResp = await fetch(`${baseUrl}/api/user/`, {
    method: "PUT",
    headers: adminHeaders,
    body: JSON.stringify({
      id: user.id,
      username: user.username,
      display_name: user.display_name || "",
      group: user.group || "default",
      remark: user.remark || "",
      password,
    }),
  });
  const putData = await putResp.json() as any;
  if (!putData.success) return { error: `password reset failed: ${putData.message}` };

  // 5. Login as student with new password
  const studentLoginResp = await fetch(`${baseUrl}/api/user/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: githubId, password }),
  });
  const studentLoginData = await studentLoginResp.json() as any;
  if (!studentLoginData.success) return { error: `student login failed: ${studentLoginData.message}` };

  const studentCookie = studentLoginResp.headers.get("set-cookie")?.split(";")[0] || "";
  const studentHeaders = {
    Cookie: studentCookie,
    "New-Api-User": String(user.id),
    "Content-Type": "application/json",
  };

  // 6. Get existing token
  const tokenListResp = await fetch(`${baseUrl}/api/token/?p=0&size=10`, {
    headers: studentHeaders,
  });
  const tokenListData = await tokenListResp.json() as any;
  const tokenItems = tokenListData.data?.items || [];

  let tokenId: number | undefined;
  if (tokenItems.length > 0) {
    tokenId = tokenItems[0].id;
  } else {
    // No token exists, create one
    const tokenResp = await fetch(`${baseUrl}/api/token/`, {
      method: "POST",
      headers: studentHeaders,
      body: JSON.stringify({
        name: "jiezi-grant",
        remain_quota: 10000000,
        unlimited_quota: false,
      }),
    });
    const tokenData = await tokenResp.json() as any;
    if (!tokenData.success) return { error: `create token failed: ${tokenData.message}` };

    const newListResp = await fetch(`${baseUrl}/api/token/?p=0&size=10`, {
      headers: studentHeaders,
    });
    const newListData = await newListResp.json() as any;
    tokenId = newListData.data?.items?.[0]?.id;
  }

  if (!tokenId) return { error: "failed to find token" };

  // 7. Get full token key
  const keyResp = await fetch(`${baseUrl}/api/token/${tokenId}/key`, {
    method: "POST",
    headers: studentHeaders,
  });
  const keyData = await keyResp.json() as any;
  if (!keyData.success || !keyData.data?.key) return { error: "failed to retrieve token key" };

  const apiKey = `sk-${keyData.data.key}`;

  return { apiKey, password };
}

export default app;
