import { describe, it, expect, vi, beforeEach } from "vitest";
import { reviewApplication, type ReviewResult } from "../services/gemini";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function mockOpenRouterResponse(result: ReviewResult) {
  return {
    ok: true,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify(result) } }],
    }),
  };
}

describe("reviewApplication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const GOOD_APPLICATION = `# 申请信息

## 基本信息

- **GitHub ID**: zhangsan
- **学校**: 北京大学
- **专业**: 计算机科学
- **年级**: 大三
- **edu 邮箱**: zhangsan at pku.edu.cn

## 你想用 AI 做什么？

我想用 AI 帮我自动化数据分析流程`;

  it("returns pass for a valid application", async () => {
    mockFetch.mockResolvedValueOnce(
      mockOpenRouterResponse({
        pass: true,
        github_id: "zhangsan",
        school: "北京大学",
        major: "计算机科学",
        grade: "大三",
        edu_email: "zhangsan@pku.edu.cn",
        motivation: "用 AI 帮我自动化数据分析流程",
        reason: "信息完整，动机明确",
      }),
    );

    const result = await reviewApplication("fake-key", GOOD_APPLICATION, "zhangsan");
    expect(result.pass).toBe(true);
    expect(result.edu_email).toBe("zhangsan@pku.edu.cn");
    expect(result.school).toBe("北京大学");
  });

  it("returns reject for incomplete application", async () => {
    mockFetch.mockResolvedValueOnce(
      mockOpenRouterResponse({
        pass: false,
        github_id: "baduser",
        school: "",
        major: "",
        grade: "",
        edu_email: "",
        motivation: "",
        reason: "缺少学校和邮箱信息",
      }),
    );

    const result = await reviewApplication("fake-key", "随便写的", "baduser");
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("缺少");
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => "rate limited",
    });

    await expect(
      reviewApplication("fake-key", GOOD_APPLICATION, "zhangsan"),
    ).rejects.toThrow("LLM API error");
  });

  it("sends correct request to OpenRouter", async () => {
    mockFetch.mockResolvedValueOnce(
      mockOpenRouterResponse({
        pass: true,
        github_id: "test",
        school: "",
        major: "",
        grade: "",
        edu_email: "",
        motivation: "",
        reason: "",
      }),
    );

    await reviewApplication("test-key", "content", "testuser");

    const call = mockFetch.mock.calls[0];
    expect(call[0]).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(call[1].headers.Authorization).toBe("Bearer test-key");

    const body = JSON.parse(call[1].body);
    expect(body.model).toContain("gemini");
    expect(body.messages[0].content).toContain("解字计划");
    expect(body.messages[1].content).toContain("testuser");
    expect(body.response_format.type).toBe("json_object");
  });
});
