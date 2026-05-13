import { useState, useEffect } from "react";

const API_BASE =
  (import.meta as any).env?.PUBLIC_API_URL || "https://jiezi-api.lueco-x.workers.dev";

interface BudgetData {
  committed: number;
  spent: number;
  remaining: number;
}

export default function Ledger() {
  const [budget, setBudget] = useState<BudgetData | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/budget`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setBudget(data);
      })
      .catch(() => {});
  }, []);

  const committed = budget?.committed ?? 150000;
  const spent = budget ? Math.round(budget.spent) : 0;
  const remaining = budget ? Math.round(budget.remaining) : 150000;

  return (
    <div className="mt-12 bg-ink/[0.02] p-6 font-mono text-sm border border-border/50">
      <div className="flex justify-between items-baseline mb-3">
        <span className="text-ink-muted">承诺注资</span>
        <span className="tabular-nums font-medium">
          {committed.toLocaleString()} CNY
        </span>
      </div>
      <div className="flex justify-between items-baseline mb-3">
        <span className="text-ink-muted">已支出</span>
        <span className="tabular-nums font-medium">
          {spent.toLocaleString()} CNY
        </span>
      </div>
      <div className="flex justify-between items-baseline border-t border-ink/10 pt-3 mt-3">
        <span className="font-bold">余额</span>
        <span className="font-bold tabular-nums text-lg text-vermillion">
          {remaining.toLocaleString()} CNY
        </span>
      </div>
      <p className="text-[10px] text-ink-muted mt-4 uppercase tracking-widest">
        数据来自 beancount 账本，每日更新
      </p>
    </div>
  );
}
