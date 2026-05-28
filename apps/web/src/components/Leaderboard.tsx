import { useState, useEffect } from "react";
import ExplorerRank from "./ExplorerRank";
import ModelHeat from "./ModelHeat";
import SchoolRank from "./SchoolRank";
import UsageTrend from "./UsageTrend";

const API =
  (import.meta as any).env?.PUBLIC_API_URL || "https://api.jieziai.cn";

interface Summary {
  total_students: number;
  total_used_usd: number;
  total_requests: number;
  schools_count: number;
}

const TABS = [
  { key: "explorers", label: "探索者" },
  { key: "models", label: "模型" },
  { key: "schools", label: "学校" },
  { key: "trends", label: "趋势" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function Leaderboard() {
  const [tab, setTab] = useState<TabKey>("explorers");
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    fetch(`${API}/api/leaderboard/summary`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setSummary(d))
      .catch(() => {});
  }, []);

  return (
    <div>
      {/* Summary bar */}
      {summary && summary.total_students > 0 && (
        <div className="border-y-2 border-ink py-3 mb-8 font-mono text-sm flex flex-wrap gap-x-8 gap-y-1">
          <span>
            <span className="font-bold">{summary.total_students}</span>
            <span className="text-ink-muted"> 位同学</span>
          </span>
          <span>
            <span className="text-vermillion font-bold">
              ${summary.total_used_usd.toFixed(2)}
            </span>
            <span className="text-ink-muted"> 消耗</span>
          </span>
          <span>
            <span className="font-bold">
              {summary.total_requests.toLocaleString()}
            </span>
            <span className="text-ink-muted"> 次请求</span>
          </span>
          <span>
            <span className="font-bold">{summary.schools_count}</span>
            <span className="text-ink-muted"> 所学校</span>
          </span>
        </div>
      )}

      {/* Tabs — pure text, no border/bg on buttons */}
      <div className="flex gap-6 mb-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-sm font-serif font-bold border-0 bg-transparent cursor-pointer pb-1 transition-colors ${
              tab === t.key
                ? "text-vermillion border-b-2 border-vermillion"
                : "text-ink-muted hover:text-ink border-b-2 border-transparent"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "explorers" && <ExplorerRank />}
      {tab === "models" && <ModelHeat />}
      {tab === "schools" && <SchoolRank />}
      {tab === "trends" && <UsageTrend />}
    </div>
  );
}
