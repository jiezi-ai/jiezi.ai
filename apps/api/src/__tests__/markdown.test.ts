import { describe, it, expect } from "vitest";
import { extractTitle, parseMarkdownTable } from "../services/markdown";

describe("extractTitle", () => {
  it("extracts h1 title", () => {
    expect(extractTitle("# Hello World\n\nSome content")).toBe("Hello World");
  });

  it("returns empty string when no h1", () => {
    expect(extractTitle("## Not h1\n\nContent")).toBe("");
  });

  it("handles title with special characters", () => {
    expect(extractTitle("# 第一阶段：体验期")).toBe("第一阶段：体验期");
  });
});

describe("parseMarkdownTable", () => {
  it("parses a standard markdown table", () => {
    const md = `
| 批次 | 状态 | 申请数 | 通过数 |
|------|------|--------|--------|
| 第 1 批 | 筹备中 | — | — |
| 第 2 批 | 未开始 | — | — |
`;
    const rows = parseMarkdownTable(md);
    expect(rows).toHaveLength(2);
    expect(rows[0]["批次"]).toBe("第 1 批");
    expect(rows[0]["状态"]).toBe("筹备中");
    expect(rows[1]["批次"]).toBe("第 2 批");
  });

  it("handles table with alignment markers", () => {
    const md = `
| Name | Value |
|:-----|------:|
| foo  | 123   |
`;
    const rows = parseMarkdownTable(md);
    expect(rows).toHaveLength(1);
    expect(rows[0]["Name"]).toBe("foo");
    expect(rows[0]["Value"]).toBe("123");
  });

  it("returns empty array for non-table content", () => {
    expect(parseMarkdownTable("Just some text")).toEqual([]);
  });

  it("parses changelog table", () => {
    const md = `
| 编号 | 日期 | 变更内容 | 原因 | 影响范围 | 生效时间 |
|------|------|----------|------|----------|----------|
| C000 | 2026-05-12 | 项目初始化 | — | — | 立即 |
| C001 | 2026-05-12 | 50 star 改为申请资格线 | 社区反馈 | 所有人 | 立即 |
`;
    const rows = parseMarkdownTable(md);
    expect(rows).toHaveLength(2);
    expect(rows[0]["编号"]).toBe("C000");
    expect(rows[1]["变更内容"]).toBe("50 star 改为申请资格线");
  });
});
