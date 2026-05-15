import { describe, it, expect, vi, beforeEach } from "vitest";
import app from "../index";

const mockDB = {
  prepare: vi.fn(),
};

const mockKV = {
  get: vi.fn().mockResolvedValue(null),
  put: vi.fn(),
  delete: vi.fn(),
  list: vi.fn().mockResolvedValue({ keys: [] }),
};

function createMockEnv(dbResult: any = null) {
  const stmt = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(dbResult),
    run: vi.fn().mockResolvedValue({}),
  };
  mockDB.prepare.mockReturnValue(stmt);

  return {
    CACHE: mockKV as unknown as KVNamespace,
    DB: mockDB as unknown as D1Database,
    GITHUB_OWNER: "jiezi-ai",
    GITHUB_REPO: "grant",
    WECHAT_GROUP_QR_URL: "https://example.com/group-qr.png",
  };
}

describe("verify endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error page when no token provided", async () => {
    const res = await app.request("/api/verify", {}, createMockEnv());
    const html = await res.text();
    expect(html).toContain("缺少验证参数");
  });

  it("returns error page for invalid token", async () => {
    const res = await app.request(
      "/api/verify?token=invalid",
      {},
      createMockEnv(null),
    );
    const html = await res.text();
    expect(html).toContain("验证链接无效");
  });

  it("returns success page and shows QR code for valid token", async () => {
    const record = {
      github_id: "zhangsan",
      verify_token: "valid-token",
      verified_at: null,
      created_at: new Date().toISOString(),
    };

    const env = createMockEnv(record);
    const res = await app.request("/api/verify?token=valid-token", {}, env);
    const html = await res.text();

    expect(html).toContain("验证成功");
    expect(html).toContain("zhangsan");
    expect(html).toContain("AI 编程资源");
  });

  it("returns already-verified page for re-verification", async () => {
    const record = {
      github_id: "zhangsan",
      verify_token: "used-token",
      verified_at: "2026-05-13T08:00:00Z",
      created_at: new Date().toISOString(),
    };

    const res = await app.request(
      "/api/verify?token=used-token",
      {},
      createMockEnv(record),
    );
    const html = await res.text();
    expect(html).toContain("已验证");
  });

  it("returns expired page for old token", async () => {
    const eightDaysAgo = new Date();
    eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

    const record = {
      github_id: "zhangsan",
      verify_token: "old-token",
      verified_at: null,
      created_at: eightDaysAgo.toISOString(),
    };

    const res = await app.request(
      "/api/verify?token=old-token",
      {},
      createMockEnv(record),
    );
    const html = await res.text();
    expect(html).toContain("已过期");
  });
});
