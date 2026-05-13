import { describe, it, expect, vi, beforeEach } from "vitest";
import app from "../index";

const mockKV = {
  get: vi.fn().mockResolvedValue(null),
  put: vi.fn(),
  delete: vi.fn(),
  list: vi.fn().mockResolvedValue({ keys: [] }),
};

const mockStmt = {
  bind: vi.fn().mockReturnThis(),
  first: vi.fn().mockResolvedValue(null),
  run: vi.fn().mockResolvedValue({}),
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

describe("webhook - push events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips non-push/non-PR events", async () => {
    const res = await app.request(
      "/api/webhook/github",
      {
        method: "POST",
        headers: {
          "X-GitHub-Event": "star",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      },
      mockEnv,
    );
    const data = await res.json();
    expect(data.skipped).toBe(true);
  });

  it("invalidates correct cache keys for policy changes", async () => {
    const res = await app.request(
      "/api/webhook/github",
      {
        method: "POST",
        headers: {
          "X-GitHub-Event": "push",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          commits: [{ modified: ["policy/selection.md"], added: [] }],
        }),
      },
      mockEnv,
    );
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.invalidated).toContain("policies");
    expect(data.invalidated).toContain("policy:selection");
  });

  it("invalidates budget cache for ledger changes", async () => {
    const res = await app.request(
      "/api/webhook/github",
      {
        method: "POST",
        headers: {
          "X-GitHub-Event": "push",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          commits: [{ modified: ["ledger/2026.beancount"], added: [] }],
        }),
      },
      mockEnv,
    );
    const data = await res.json();
    expect(data.invalidated).toContain("budget");
  });

  it("invalidates batch cache for student submissions", async () => {
    const res = await app.request(
      "/api/webhook/github",
      {
        method: "POST",
        headers: {
          "X-GitHub-Event": "push",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          commits: [{ modified: [], added: ["students/batch-1/zhangsan.md"] }],
        }),
      },
      mockEnv,
    );
    const data = await res.json();
    expect(data.invalidated).toContain("overview");
    expect(data.invalidated).toContain("batch:1");
  });
});

describe("webhook - PR events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips PR events that are not opened/synchronize", async () => {
    const res = await app.request(
      "/api/webhook/github",
      {
        method: "POST",
        headers: {
          "X-GitHub-Event": "pull_request",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "closed",
          pull_request: { number: 1, user: { login: "test" } },
        }),
      },
      mockEnv,
    );
    const data = await res.json();
    expect(data.skipped).toBe(true);
  });
});
