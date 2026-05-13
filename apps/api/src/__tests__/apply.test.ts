import { describe, it, expect, vi, beforeEach } from "vitest";
import app from "../index";

const mockKV = {
  get: vi.fn().mockResolvedValue(null),
  put: vi.fn(),
  delete: vi.fn(),
  list: vi.fn().mockResolvedValue({ keys: [] }),
};

let dbRecords: any[] = [];

const mockStmt = {
  bind: vi.fn().mockReturnThis(),
  first: vi.fn(async () => {
    return dbRecords.length > 0 ? dbRecords[0] : null;
  }),
  run: vi.fn(async () => ({})),
  all: vi.fn(async () => ({ results: [] })),
};

const mockDB = {
  prepare: vi.fn().mockReturnValue(mockStmt),
};

const mockEnv = {
  CACHE: mockKV as unknown as KVNamespace,
  DB: mockDB as unknown as D1Database,
  GITHUB_OWNER: "jiezi-ai",
  GITHUB_REPO: "grant",
};

describe("apply API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbRecords = [];
  });

  it("creates application and returns apply code", async () => {
    const res = await app.request(
      "/api/apply",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "张三",
          school: "北京大学",
          major: "计算机科学",
          grade: "大三",
          edu_email: "zhangsan@pku.edu.cn",
          motivation: "用 AI 做数据分析",
        }),
      },
      mockEnv,
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.apply_code).toMatch(/^JZ-[A-Z0-9]{4}$/);
    expect(data.status).toBe("draft");
  });

  it("rejects when school is missing", async () => {
    const res = await app.request(
      "/api/apply",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          edu_email: "test@test.edu.cn",
        }),
      },
      mockEnv,
    );

    expect(res.status).toBe(400);
  });

  it("rejects when edu_email is missing", async () => {
    const res = await app.request(
      "/api/apply",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          school: "北京大学",
        }),
      },
      mockEnv,
    );

    expect(res.status).toBe(400);
  });

  it("returns 409 when email already has an active application", async () => {
    dbRecords = [{ apply_code: "JZ-ABCD", status: "draft" }];

    const res = await app.request(
      "/api/apply",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "张三",
          school: "北京大学",
          edu_email: "zhangsan@pku.edu.cn",
        }),
      },
      mockEnv,
    );

    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.apply_code).toBe("JZ-ABCD");
  });

  it("returns application status with correct email", async () => {
    dbRecords = [{
      apply_code: "JZ-TEST",
      status: "draft",
      school: "北京大学",
      major: "计算机",
      grade: "大三",
      motivation: "AI 研究",
      github_id: null,
      created_at: "2026-05-13",
    }];

    const res = await app.request(
      "/api/apply/JZ-TEST",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edu_email: "zhangsan@pku.edu.cn" }),
      },
      mockEnv,
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("draft");
    expect(data.school).toBe("北京大学");
  });

  it("returns 404 with wrong email", async () => {
    dbRecords = [];

    const res = await app.request(
      "/api/apply/JZ-TEST",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edu_email: "wrong@other.edu.cn" }),
      },
      mockEnv,
    );

    expect(res.status).toBe(404);
  });

  it("allows modification when status is draft", async () => {
    dbRecords = [{ id: 1, status: "draft" }];

    const res = await app.request(
      "/api/apply/JZ-TEST",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          edu_email: "zhangsan@pku.edu.cn",
          motivation: "改了动机",
        }),
      },
      mockEnv,
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it("blocks modification when status is approved", async () => {
    dbRecords = [{ id: 1, status: "approved" }];

    const res = await app.request(
      "/api/apply/JZ-TEST",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          edu_email: "zhangsan@pku.edu.cn",
          motivation: "想改",
        }),
      },
      mockEnv,
    );

    expect(res.status).toBe(403);
  });
});
