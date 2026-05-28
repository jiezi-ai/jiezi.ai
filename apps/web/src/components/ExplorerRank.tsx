import { useState, useEffect } from "react";

const API =
  (import.meta as any).env?.PUBLIC_API_URL || "https://api.jieziai.cn";

interface Student {
  name: string;
  school: string;
  major: string;
  batch: number;
  used_usd: number;
  quota_usd: number;
  usage_pct: number;
  request_count: number;
}

const PERIODS = [
  { key: "week", label: "本周" },
  { key: "month", label: "本月" },
  { key: "all", label: "全部" },
] as const;

export default function ExplorerRank() {
  const [period, setPeriod] = useState("all");
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/leaderboard/explorers?period=${period}`)
      .then((r) => (r.ok ? r.json() : { students: [] }))
      .then((d) => setStudents(d.students || []))
      .catch(() => setStudents([]))
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-ink-muted font-mono">
        ...
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="py-12 text-center text-ink-muted text-sm">
        暂无数据
      </div>
    );
  }

  return (
    <div>
      {/* Period selector */}
      <div className="flex justify-end gap-4 mb-4">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`text-xs font-mono border-0 bg-transparent cursor-pointer transition-colors ${
              period === p.key
                ? "text-vermillion"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Student list — compact table style */}
      <div className="border-t-2 border-ink">
        {students.map((s, i) => (
          <div
            key={i}
            className="flex items-center gap-3 py-2.5 border-b border-border/50 text-sm"
          >
            {/* Rank */}
            <span className="font-mono text-ink-muted w-5 text-right shrink-0 text-xs">
              {i + 1}
            </span>

            {/* Name + school */}
            <div className="min-w-0 flex-1">
              <span className="font-medium">{s.name}</span>
              <span className="text-ink-muted text-xs ml-2">
                {s.school}{s.major ? ` · ${s.major}` : ""}
              </span>
            </div>

            {/* Progress bar — inline */}
            <div className="w-24 md:w-32 h-1.5 bg-ink/[0.06] shrink-0">
              <div
                className="h-full bg-vermillion"
                style={{ width: `${Math.min(s.usage_pct, 100)}%` }}
              />
            </div>

            {/* Amount */}
            <span className="font-mono text-xs text-vermillion font-bold w-14 text-right shrink-0">
              ${s.used_usd.toFixed(2)}
            </span>

            {/* Requests */}
            <span className="font-mono text-[11px] text-ink-muted w-16 text-right shrink-0 hidden md:block">
              {s.request_count.toLocaleString()} 次
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-3 text-[11px] font-mono text-ink-muted text-center">
        {students.length} 位同学 · $
        {students.reduce((s, st) => s + st.used_usd, 0).toFixed(2)} · {students.reduce((s, st) => s + st.request_count, 0).toLocaleString()} 次
      </div>
    </div>
  );
}
