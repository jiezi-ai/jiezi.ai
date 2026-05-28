import { useState, useEffect } from "react";

const API =
  (import.meta as any).env?.PUBLIC_API_URL || "https://api.jieziai.cn";

interface Student {
  name: string;
  school: string;
  used_usd: number;
  quota_usd: number;
  usage_pct: number;
  request_count: number;
}

interface Summary {
  total_students: number;
  total_used_usd: number;
  total_requests: number;
}

export default function HomeRank() {
  const [students, setStudents] = useState<Student[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/leaderboard/explorers?period=all`)
        .then((r) => (r.ok ? r.json() : null)),
      fetch(`${API}/api/leaderboard/summary`)
        .then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([exp, sum]) => {
        if (exp?.students) setStudents(exp.students.slice(0, 5));
        if (sum) setSummary(sum);
      })
      .catch(() => {});
  }, []);

  if (students.length === 0) return null;

  return (
    <section className="mb-24">
      <div className="mb-6 flex justify-between items-baseline">
        <h2 className="text-xl font-bold font-serif">探索者</h2>
        <a
          href="/leaderboard"
          className="text-xs font-mono text-ink-muted hover:text-vermillion transition-colors"
        >
          查看完整排行 →
        </a>
      </div>

      {/* Compact top 5 table */}
      <div className="border-y-2 border-ink">
        <div className="divide-y divide-dashed divide-border/50">
          {students.map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-3 py-2 font-mono text-sm"
            >
              <span className="text-ink-muted text-xs w-4 text-right">{i + 1}</span>
              <span className="font-sans font-medium min-w-0 truncate flex-1">
                {s.name}
                <span className="font-normal text-ink-muted text-xs ml-1.5">{s.school}</span>
              </span>
              <div className="w-16 h-1 bg-ink/[0.06] shrink-0">
                <div
                  className="h-full bg-vermillion"
                  style={{ width: `${Math.min(s.usage_pct, 100)}%` }}
                />
              </div>
              <span className="text-vermillion font-bold text-xs w-14 text-right">
                ${s.used_usd.toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        {/* Summary row */}
        {summary && (
          <div className="flex justify-between items-center py-2 border-t border-ink text-[11px] font-mono text-ink-muted">
            <span>
              共 {summary.total_students} 位同学 · {summary.total_requests.toLocaleString()} 次请求
            </span>
            <span>
              累计 <span className="text-vermillion font-bold">${summary.total_used_usd.toFixed(2)}</span>
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
