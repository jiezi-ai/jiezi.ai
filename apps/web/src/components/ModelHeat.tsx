import { useState, useEffect } from "react";
import { Pie } from "@visx/shape";
import { Group } from "@visx/group";
import { scaleOrdinal } from "@visx/scale";

const API =
  (import.meta as any).env?.PUBLIC_API_URL || "https://api.jieziai.cn";

interface Model {
  rank: number;
  name: string;
  vendor: string;
  tokens: number;
  share: number; // percentage, e.g. 38.2
  growth_pct: number;
  rank_delta: number;
}

const PERIODS = [
  { key: "week", label: "本周" },
  { key: "month", label: "本月" },
  { key: "all", label: "全部" },
] as const;

// Vermillion-based color palette with decreasing lightness
const COLORS = [
  "oklch(0.60 0.18 30)", // vermillion
  "oklch(0.55 0.14 50)",
  "oklch(0.50 0.10 70)",
  "oklch(0.58 0.12 20)",
  "oklch(0.45 0.08 90)",
  "oklch(0.52 0.06 110)",
  "oklch(0.48 0.04 130)",
  "oklch(0.55 0.02 150)",
];

function RankDelta({ delta }: { delta: number }) {
  if (delta > 0) return <span className="text-vermillion text-[11px]">↑{delta}</span>;
  if (delta < 0) return <span className="text-ink-muted text-[11px]">↓{Math.abs(delta)}</span>;
  return <span className="text-ink-muted text-[11px]">—</span>;
}

export default function ModelHeat() {
  const [period, setPeriod] = useState("week");
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/leaderboard/models?period=${period}`)
      .then((r) => (r.ok ? r.json() : { models: [] }))
      .then((d) => setModels(d.models || []))
      .catch(() => setModels([]))
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-ink-muted font-mono">
        加载中...
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-ink-muted">暂无模型数据</p>
        <p className="text-xs text-ink-muted mt-2">
          排名数据需要 New API 启用 rankings 模块
        </p>
      </div>
    );
  }

  const colorScale = scaleOrdinal({
    domain: models.map((m) => m.name),
    range: COLORS,
  });

  const pieSize = 160;
  const innerRadius = 45;
  const outerRadius = pieSize / 2;

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

      {/* Donut + Legend */}
      <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-8">
        {/* Donut chart */}
        <div className="shrink-0">
          <svg width={pieSize} height={pieSize}>
            <Group top={pieSize / 2} left={pieSize / 2}>
              <Pie
                data={models.slice(0, 6)}
                pieValue={(d) => d.share}
                outerRadius={outerRadius}
                innerRadius={innerRadius}
                padAngle={0.02}
              >
                {(pie) =>
                  pie.arcs.map((arc, i) => (
                    <g key={i}>
                      <path
                        d={pie.path(arc) || ""}
                        fill={colorScale(arc.data.name)}
                      />
                    </g>
                  ))
                }
              </Pie>
              {/* Center text */}
              <text
                textAnchor="middle"
                dy=".1em"
                fontSize={11}
                fontFamily="var(--font-mono)"
                fill="oklch(0.38 0.01 85)"
              >
                {models.length} 模型
              </text>
            </Group>
          </svg>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-2">
          {models.slice(0, 6).map((m, i) => (
            <div key={m.name} className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 shrink-0"
                style={{ backgroundColor: colorScale(m.name) }}
              />
              <span className="text-sm flex-1 truncate">{m.name}</span>
              <span className="font-mono text-xs text-ink-muted">
                {m.share}%
              </span>
            </div>
          ))}
          {models.length > 6 && (
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 shrink-0 bg-ink/[0.1]" />
              <span className="text-sm text-ink-muted">
                其他 {models.length - 6} 个模型
              </span>
              <span className="font-mono text-xs text-ink-muted">
                {(100 - models.slice(0, 6).reduce((s, m) => s + m.share, 0)).toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Model rank table */}
      <div className="border-t border-border pt-6">
        <h3 className="font-serif font-bold text-sm mb-4">模型排行</h3>
        <div className="space-y-3">
          {models.map((m) => {
            const maxShare = models[0]?.share || 1;
            const barPct = (m.share / maxShare) * 100;

            return (
              <div key={m.name}>
                <div className="flex items-baseline gap-3 mb-1">
                  <span className="font-mono text-xs text-ink-muted w-4 text-right shrink-0">
                    {m.rank}
                  </span>
                  <span className="text-sm flex-1 truncate">{m.name}</span>
                  <span className="font-mono text-xs text-ink-muted">
                    {m.vendor}
                  </span>
                  <span className="font-mono text-xs font-bold w-12 text-right">
                    {m.share}%
                  </span>
                  <span className="w-8 text-right">
                    <RankDelta delta={m.rank_delta} />
                  </span>
                </div>
                <div className="ml-7 h-1.5 bg-ink/[0.04] overflow-hidden">
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${barPct}%`,
                      backgroundColor: colorScale(m.name),
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
