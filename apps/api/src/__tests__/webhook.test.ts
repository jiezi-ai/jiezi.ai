import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDelete = vi.fn();
const mockKV = {
  get: vi.fn(),
  put: vi.fn(),
  delete: mockDelete,
  list: vi.fn().mockResolvedValue({ keys: [] }),
};

const mockEnv = {
  CACHE: mockKV as unknown as KVNamespace,
  GITHUB_OWNER: "jiezi-ai",
  GITHUB_REPO: "grant",
};

import app from "../index";

describe("webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips non-push events", async () => {
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
          commits: [
            {
              modified: ["policy/selection.md"],
              added: [],
            },
          ],
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
