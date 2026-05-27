import { useState, useEffect } from "react";
import StudentTicker from "./StudentTicker";

const API_BASE =
  (import.meta as any).env?.PUBLIC_API_URL || "https://api.jieziai.cn";

interface Batch {
  id: number;
  status: "preparing" | "open" | "closed";
  applicants: number;
  approved: number;
}

interface BudgetData {
  committed: number;
  spent: number;
  remaining: number;
}

export default function Stats() {
  const [batches, setBatches] = useState<Batch[] | null>(null);
  const [budget, setBudget] = useState<BudgetData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/overview`).then((r) =>
        r.ok ? r.json() : null,
      ),
      fetch(`${API_BASE}/api/budget`).then((r) =>
        r.ok ? r.json() : null,
      ),
    ])
      .then(([overview, budgetData]) => {
        if (overview?.batches) setBatches(overview.batches);
        if (budgetData) setBudget(budgetData);
      })
      .catch(() => setError(true));
  }, []);

  const defaultBatches: Batch[] = Array.from({ length: 6 }, (_, i) => ({
    id: i + 1,
    status: "preparing" as const,
    applicants: 0,
    approved: 0,
  }));

  const displayBatches = batches || defaultBatches;
  const committed = budget?.committed ?? 150000;
  const spent = budget ? Math.round(budget.spent) : 0;
  const pct = budget ? Math.max((budget.spent / budget.committed) * 100, 0.5) : 0.5;

  return (
    <section className="mb-24 border-y-2 border-ink">
      {/* Batch progress */}
      <div className="py-6">
        <div className="flex justify-between items-baseline mb-4">
          <span className="font-mono text-sm text-ink-muted">资助进度</span>
          <span className="font-mono text-sm text-ink-muted">
            每批 100 人 · 共 600 人
          </span>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {displayBatches.map((batch) => (
            <div
              key={batch.id}
              className={`text-center py-3 border ${
                batch.status === "open"
                  ? "border-vermillion bg-vermillion/[0.05]"
                  : batch.status === "closed"
                    ? "border-ink bg-ink/[0.04]"
                    : "border-border"
              }`}
            >
              <p className="font-mono text-lg font-bold tabular-nums">
                {batch.approved || 0}
                <span className="text-ink-muted font-normal text-xs">
                  /100
                </span>
              </p>
              {batch.applicants > 0 && batch.applicants !== batch.approved && (
                <p className="text-[10px] font-mono text-ink-muted">
                  {batch.applicants} 人申请
                </p>
              )}
              <p className="text-[11px] font-mono text-ink-muted mt-0.5">
                第 {batch.id} 批
              </p>
              <p
                className={`text-[11px] font-mono mt-0.5 ${
                  batch.status === "open"
                    ? "text-vermillion"
                    : batch.status === "closed"
                      ? "text-ink"
                      : "text-ink-muted"
                }`}
              >
                {batch.status === "open"
                  ? "申请中"
                  : batch.status === "closed"
                    ? "已结束"
                    : "筹备中"}
              </p>
            </div>
          ))}
        </div>
        <p className="text-xs text-ink-muted mt-3">
          每人获得 $20 API Token，支持 Claude、Gemini、GPT、DeepSeek 等 20+ 模型
        </p>
      </div>

      {/* Student ticker */}
      <StudentTicker />

      {/* Budget progress */}
      <div className="py-5 border-t border-border">
        <div className="flex justify-between items-baseline mb-2">
          <span className="font-mono text-sm text-ink-muted">预算</span>
          <span className="font-mono text-sm">
            <span className="text-vermillion font-bold">
              {spent.toLocaleString()}
            </span>
            <span className="text-ink-muted">
              {" "}
              / {committed.toLocaleString()} CNY
            </span>
          </span>
        </div>
        <div className="w-full h-1.5 bg-ink/[0.06] overflow-hidden">
          <div
            className="h-full bg-vermillion transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {error && (
        <p className="text-xs text-ink-muted py-2 text-center">
          数据加载失败，显示为默认值
        </p>
      )}
    </section>
  );
}
