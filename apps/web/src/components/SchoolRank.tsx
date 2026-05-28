import { useState, useEffect } from "react";

const API =
  (import.meta as any).env?.PUBLIC_API_URL || "https://api.jieziai.cn";

interface School {
  name: string;
  student_count: number;
  total_used_usd: number;
  total_requests: number;
}

const SORT_OPTIONS = [
  { key: "quota", label: "按消耗" },
  { key: "count", label: "按人数" },
  { key: "requests", label: "按请求" },
] as const;

export default function SchoolRank() {
  const [sort, setSort] = useState("quota");
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/leaderboard/schools?sort=${sort}`)
      .then((r) => (r.ok ? r.json() : { schools: [] }))
      .then((d) => setSchools(d.schools || []))
      .catch(() => setSchools([]))
      .finally(() => setLoading(false));
  }, [sort]);

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-ink-muted font-mono">
        加载中...
      </div>
    );
  }

  if (schools.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-ink-muted">暂无学校数据</p>
      </div>
    );
  }

  // Get max value for bar scaling
  const maxVal = (() => {
    switch (sort) {
      case "count":
        return Math.max(...schools.map((s) => s.student_count));
      case "requests":
        return Math.max(...schools.map((s) => s.total_requests));
      default:
        return Math.max(...schools.map((s) => s.total_used_usd));
    }
  })();

  function getBarPct(s: School) {
    const val =
      sort === "count"
        ? s.student_count
        : sort === "requests"
          ? s.total_requests
          : s.total_used_usd;
    return maxVal > 0 ? (val / maxVal) * 100 : 0;
  }

  return (
    <div>
      {/* Sort selector */}
      <div className="flex justify-end gap-4 mb-4">
        {SORT_OPTIONS.map((o) => (
          <button
            key={o.key}
            onClick={() => setSort(o.key)}
            className={`text-xs font-mono border-0 bg-transparent cursor-pointer transition-colors ${
              sort === o.key
                ? "text-vermillion"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* School list — compact */}
      <div className="border-t-2 border-ink">
        {schools.map((s, i) => (
          <div key={s.name} className="flex items-center gap-3 py-2.5 border-b border-border/50 text-sm">
            <span className="font-mono text-ink-muted w-5 text-right shrink-0 text-xs">
              {i + 1}
            </span>
            <span className="font-medium flex-1 min-w-0 truncate">{s.name}</span>

            <div className="w-20 md:w-28 h-1.5 bg-ink/[0.06] shrink-0">
              <div
                className="h-full bg-vermillion"
                style={{ width: `${getBarPct(s)}%` }}
              />
            </div>

            <span className="font-mono text-xs text-ink-muted shrink-0">{s.student_count} 人</span>
            <span className="font-mono text-xs text-vermillion font-bold w-14 text-right shrink-0">
              ${s.total_used_usd.toFixed(2)}
            </span>
            <span className="font-mono text-[11px] text-ink-muted w-14 text-right shrink-0 hidden md:block">
              {s.total_requests.toLocaleString()} 次
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-border text-xs font-mono text-ink-muted text-center">
        共 {schools.length} 所学校参与
      </div>
    </div>
  );
}
