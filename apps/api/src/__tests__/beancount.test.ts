import { describe, it, expect } from "vitest";
import { parseBeancount, generateReport } from "../services/beancount";

const SAMPLE_MAIN = `
option "title" "解字计划 / Jiezi Grant"
option "operating_currency" "CNY"
option "operating_currency" "USD"
`;

const SAMPLE_YEAR = `
2026-05-12 * "发起人第一年注资承诺" "含资助预算及运营成本"
  Assets:Receivable:Founder          150,000 CNY
  Income:Founder:Committed

2026-05-13 * "域名 jiezi.ai" "年付"
  Expenses:Ops:Domain                185.96 USD @@ 1339 CNY
  Assets:Receivable:Founder

2026-07-01 * "第 1 批 Coding Plan" "MiniMax Plus × 100 人"
  Expenses:Grant:Stage1:CodingPlan   9,800 CNY
  Assets:Receivable:Founder
`;

describe("parseBeancount", () => {
  it("parses transactions from beancount text", () => {
    const txs = parseBeancount(SAMPLE_YEAR);
    expect(txs).toHaveLength(3);
    expect(txs[0].payee).toBe("发起人第一年注资承诺");
    expect(txs[1].payee).toBe("域名 jiezi.ai");
    expect(txs[2].payee).toBe("第 1 批 Coding Plan");
  });

  it("extracts posting amounts and currencies", () => {
    const txs = parseBeancount(SAMPLE_YEAR);
    const commitPosting = txs[0].postings.find(
      (p) => p.account === "Assets:Receivable:Founder",
    );
    expect(commitPosting).toBeDefined();
    expect(commitPosting!.amount).toBe(150000);
    expect(commitPosting!.currency).toBe("CNY");
  });

  it("parses USD amounts", () => {
    const txs = parseBeancount(SAMPLE_YEAR);
    const domainPosting = txs[1].postings.find((p) =>
      p.account.startsWith("Expenses:"),
    );
    expect(domainPosting).toBeDefined();
    expect(domainPosting!.amount).toBe(185.96);
    expect(domainPosting!.currency).toBe("USD");
  });

  it("ignores options and non-transaction lines", () => {
    const txs = parseBeancount(SAMPLE_MAIN);
    expect(txs).toHaveLength(0);
  });
});

describe("generateReport", () => {
  it("calculates committed amount from Income:Founder:Committed", () => {
    const report = generateReport(SAMPLE_MAIN, SAMPLE_YEAR);
    expect(report.committed).toBe(150000);
  });

  it("calculates total spent across all expenses", () => {
    const report = generateReport(SAMPLE_MAIN, SAMPLE_YEAR);
    // 域名: 185.96 USD * 7.2 = 1338.912 ≈ 1338.91
    // Coding Plan: 9800 CNY
    // Total: ~11138.91
    expect(report.spent).toBeGreaterThan(11000);
    expect(report.spent).toBeLessThan(11200);
  });

  it("calculates remaining = committed - spent", () => {
    const report = generateReport(SAMPLE_MAIN, SAMPLE_YEAR);
    expect(report.remaining).toBe(report.committed - report.spent);
  });

  it("groups expenses by stage", () => {
    const report = generateReport(SAMPLE_MAIN, SAMPLE_YEAR);
    expect(report.byStage["Stage1"]).toBe(9800);
    expect(report.byStage["Ops"]).toBeGreaterThan(1300);
  });

  it("lists individual transactions", () => {
    const report = generateReport(SAMPLE_MAIN, SAMPLE_YEAR);
    expect(report.transactions).toHaveLength(2);
    expect(report.transactions[0].payee).toBe("域名 jiezi.ai");
    expect(report.transactions[1].payee).toBe("第 1 批 Coding Plan");
  });

  it("returns CNY as currency", () => {
    const report = generateReport(SAMPLE_MAIN, SAMPLE_YEAR);
    expect(report.currency).toBe("CNY");
  });
});
