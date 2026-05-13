import { describe, it, expect } from "vitest";

describe("maskName", () => {
  function maskName(name: string): string {
    if (!name) return "**";
    const chars = [...name];
    if (chars.length <= 1) return chars[0] + "*";
    return chars[0] + "*".repeat(chars.length - 1);
  }

  it("masks two-char name", () => {
    expect(maskName("张三")).toBe("张*");
  });

  it("masks three-char name", () => {
    expect(maskName("许长鹏")).toBe("许**");
  });

  it("masks single-char name", () => {
    expect(maskName("李")).toBe("李*");
  });

  it("handles empty name", () => {
    expect(maskName("")).toBe("**");
  });

  it("masks English name", () => {
    expect(maskName("Zhang")).toBe("Z****");
  });
});
