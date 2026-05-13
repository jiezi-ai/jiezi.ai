import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}), text: async () => "" });
vi.stubGlobal("fetch", mockFetch);

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
  all: vi.fn().mockResolvedValue({ results: [] }),
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

  it("skips non-push/non-issue events", async () => {
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
});

describe("webhook - issue events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips issue events that are not opened", async () => {
    const res = await app.request(
      "/api/webhook/github",
      {
        method: "POST",
        headers: {
          "X-GitHub-Event": "issues",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "closed",
          issue: { number: 1, user: { login: "test" }, body: "", title: "" },
        }),
      },
      mockEnv,
    );
    const data = await res.json();
    expect(data.skipped).toBe(true);
  });

  it("returns no_apply_code when issue has no code", async () => {
    const res = await app.request(
      "/api/webhook/github",
      {
        method: "POST",
        headers: {
          "X-GitHub-Event": "issues",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "opened",
          issue: {
            number: 1,
            user: { login: "test" },
            body: "no code here",
            title: "test",
          },
        }),
      },
      mockEnv,
    );
    const data = await res.json();
    expect(data.action).toBe("no_apply_code");
  });

  it("returns invalid_code when code not in DB", async () => {
    const res = await app.request(
      "/api/webhook/github",
      {
        method: "POST",
        headers: {
          "X-GitHub-Event": "issues",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "opened",
          issue: {
            number: 1,
            user: { login: "test" },
            body: "JZ-XXXX",
            title: "[申请]",
          },
        }),
      },
      mockEnv,
    );
    const data = await res.json();
    expect(data.action).toBe("invalid_code");
  });
});
