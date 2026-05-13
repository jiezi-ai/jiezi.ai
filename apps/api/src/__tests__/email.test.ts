import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendVerificationEmail } from "../services/email";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("sendVerificationEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends email with correct parameters", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    const result = await sendVerificationEmail(
      "test-api-key",
      "zhangsan@pku.edu.cn",
      "zhangsan",
      "https://api.jiezi.ai/api/verify?token=abc123",
    );

    expect(result).toBe(true);

    const call = mockFetch.mock.calls[0];
    expect(call[0]).toBe("https://api.resend.com/emails");
    expect(call[1].method).toBe("POST");

    const body = JSON.parse(call[1].body);
    expect(body.from).toContain("jiezi.ai");
    expect(body.to).toEqual(["zhangsan@pku.edu.cn"]);
    expect(body.subject).toContain("解字计划");
    expect(body.html).toContain("zhangsan");
    expect(body.html).toContain("abc123");
  });

  it("returns false on API failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 422 });

    const result = await sendVerificationEmail(
      "test-key",
      "bad@email",
      "user",
      "https://example.com/verify",
    );

    expect(result).toBe(false);
  });

  it("includes verify URL in email body", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await sendVerificationEmail(
      "key",
      "test@test.edu.cn",
      "testuser",
      "https://api.jiezi.ai/api/verify?token=xyz",
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.html).toContain("https://api.jiezi.ai/api/verify?token=xyz");
  });
});
