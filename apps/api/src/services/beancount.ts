import type { Transaction, BudgetReport } from "@jiezi/shared";

interface ParsedTransaction {
  date: string;
  flag: string;
  payee: string;
  narration: string;
  postings: Array<{
    account: string;
    amount: number;
    currency: string;
  }>;
}

export function parseBeancount(content: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  const lines = content.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const txMatch = line.match(
      /^(\d{4}-\d{2}-\d{2})\s+([*!])\s+"([^"]*)"\s*"?([^"]*)"?/,
    );

    if (txMatch) {
      const tx: ParsedTransaction = {
        date: txMatch[1],
        flag: txMatch[2],
        payee: txMatch[3],
        narration: txMatch[4] || "",
        postings: [],
      };

      i++;
      while (i < lines.length && lines[i].match(/^\s+\S/)) {
        const postingLine = lines[i].trim();
        if (postingLine.startsWith(";") || postingLine.includes(":")) {
          const postingMatch = postingLine.match(
            /^(\S+(?::\S+)+)\s+(-?[\d,.]+)\s+(\w+)/,
          );
          if (postingMatch) {
            tx.postings.push({
              account: postingMatch[1],
              amount: parseFloat(postingMatch[2].replace(",", "")),
              currency: postingMatch[3],
            });
          } else {
            const metaMatch = postingLine.match(/^(\w+):/);
            if (!metaMatch || postingLine.match(/^(\S+(?::\S+){2,})/)) {
              const accountOnly = postingLine.match(/^(\S+(?::\S+)+)\s*$/);
              if (accountOnly) {
                tx.postings.push({
                  account: accountOnly[1],
                  amount: 0,
                  currency: "",
                });
              }
            }
          }
        }
        i++;
      }

      transactions.push(tx);
    } else {
      i++;
    }
  }

  return transactions;
}

export function generateReport(
  mainContent: string,
  yearContent: string,
): BudgetReport {
  const allContent = mainContent + "\n" + yearContent;
  const transactions = parseBeancount(allContent);

  let committed = 0;
  let spent = 0;
  const byStage: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const txList: Transaction[] = [];

  for (const tx of transactions) {
    const hasCommittedIncome = tx.postings.some(
      (p) => p.account.startsWith("Income:Founder:Committed"),
    );

    for (const posting of tx.postings) {
      if (
        hasCommittedIncome &&
        posting.account.startsWith("Assets:Receivable:Founder") &&
        posting.amount > 0
      ) {
        committed += posting.amount;
      }

      if (posting.account.startsWith("Expenses:")) {
        const parts = posting.account.split(":");
        const amount =
          posting.currency === "USD" ? posting.amount * 7.2 : posting.amount;

        spent += amount;

        const stage = parts[1] === "Grant" ? parts[2] : "Ops";
        byStage[stage] = (byStage[stage] || 0) + amount;

        const category =
          parts[1] === "Grant" ? parts.slice(2).join(":") : parts.slice(1).join(":");
        byCategory[category] = (byCategory[category] || 0) + amount;

        txList.push({
          date: tx.date,
          payee: tx.payee,
          narration: tx.narration,
          account: posting.account,
          amount: posting.amount,
          currency: posting.currency,
        });
      }
    }
  }

  return {
    committed,
    spent: Math.round(spent * 100) / 100,
    remaining: Math.round((committed - spent) * 100) / 100,
    currency: "CNY",
    byStage,
    byCategory,
    transactions: txList,
  };
}
