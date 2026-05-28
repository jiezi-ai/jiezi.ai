import { useState, useEffect, useCallback } from "react";
import { AreaClosed, LinePath, Bar } from "@visx/shape";
import { Group } from "@visx/group";
import { scaleLinear, scaleTime } from "@visx/scale";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { useTooltip, TooltipWithBounds } from "@visx/tooltip";
import { localPoint } from "@visx/event";
import { bisector } from "d3-array";

const API =
  (import.meta as any).env?.PUBLIC_API_URL || "https://api.jieziai.cn";

interface TrendPoint {
  date: string;
  used_usd: number;
  requests: number;
  active_users: number;
}

interface TrendSummary {
  avg_daily_usd: number;
  avg_daily_requests: number;
  total_days: number;
}

const RANGES = [
  { key: "7", label: "7 天" },
  { key: "30", label: "30 天" },
  { key: "0", label: "全部" },
] as const;

const getDate = (d: TrendPoint) => new Date(d.date);
const getValue = (d: TrendPoint) => d.used_usd;
const bisectDate = bisector<TrendPoint, Date>((d) => new Date(d.date)).left;

const MARGIN = { top: 16, right: 16, bottom: 40, left: 48 };

export default function UsageTrend() {
  const [range, setRange] = useState("7");
  const [points, setPoints] = useState<TrendPoint[]>([]);
  const [summary, setSummary] = useState<TrendSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const {
    tooltipData,
    tooltipLeft,
    tooltipTop,
    tooltipOpen,
    showTooltip,
    hideTooltip,
  } = useTooltip<TrendPoint>();

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/leaderboard/trends?range=${range}`)
      .then((r) => (r.ok ? r.json() : { points: [], summary: {} }))
      .then((d) => {
        setPoints(d.points || []);
        setSummary(d.summary || null);
      })
      .catch(() => {
        setPoints([]);
        setSummary(null);
      })
      .finally(() => setLoading(false));
  }, [range]);

  // Chart dimensions
  const width = 640;
  const height = 240;
  const innerWidth = width - MARGIN.left - MARGIN.right;
  const innerHeight = height - MARGIN.top - MARGIN.bottom;

  // Scales
  const xScale = scaleTime({
    domain: [
      points.length > 0 ? getDate(points[0]) : new Date(),
      points.length > 0 ? getDate(points[points.length - 1]) : new Date(),
    ],
    range: [0, innerWidth],
  });

  const yScale = scaleLinear({
    domain: [0, Math.max(...points.map(getValue), 1) * 1.15],
    range: [innerHeight, 0],
    nice: true,
  });

  const handleTooltip = useCallback(
    (event: React.TouchEvent<SVGRectElement> | React.MouseEvent<SVGRectElement>) => {
      const coords = localPoint(event);
      if (!coords || points.length === 0) return;

      const x0 = xScale.invert(coords.x - MARGIN.left);
      const index = bisectDate(points, x0, 1);
      const d0 = points[index - 1];
      const d1 = points[index];
      let d = d0;
      if (d1) {
        d =
          x0.getTime() - getDate(d0).getTime() >
          getDate(d1).getTime() - x0.getTime()
            ? d1
            : d0;
      }

      showTooltip({
        tooltipData: d,
        tooltipLeft: xScale(getDate(d)) + MARGIN.left,
        tooltipTop: yScale(getValue(d)) + MARGIN.top,
      });
    },
    [xScale, yScale, points, showTooltip],
  );

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-ink-muted font-mono">
        加载中...
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-ink-muted">暂无趋势数据</p>
        <p className="text-xs text-ink-muted mt-2">
          需要 New API 开启 DataExportEnabled 配置
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Range selector */}
      <div className="flex justify-end gap-4 mb-4">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`text-xs font-mono border-0 bg-transparent cursor-pointer transition-colors ${
              range === r.key
                ? "text-vermillion"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="overflow-x-auto">
        <div className="relative min-w-[480px]" style={{ width: "100%", maxWidth: width }}>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            width="100%"
            height="auto"
            style={{ overflow: "visible" }}
          >
            <Group left={MARGIN.left} top={MARGIN.top}>
              {/* Grid lines */}
              <GridRows
                scale={yScale}
                width={innerWidth}
                stroke="oklch(0.15 0.01 85 / 0.06)"
                strokeDasharray="2,4"
                numTicks={4}
              />

              {/* Area */}
              <AreaClosed
                data={points}
                x={(d) => xScale(getDate(d))}
                y={(d) => yScale(getValue(d))}
                yScale={yScale}
                fill="oklch(0.6 0.18 30 / 0.18)"
              />

              {/* Line */}
              <LinePath
                data={points}
                x={(d) => xScale(getDate(d))}
                y={(d) => yScale(getValue(d))}
                stroke="oklch(0.6 0.18 30)"
                strokeWidth={1.5}
              />

              {/* Data dots */}
              {points.map((d, i) => (
                <circle
                  key={i}
                  cx={xScale(getDate(d))}
                  cy={yScale(getValue(d))}
                  r={2}
                  fill="oklch(0.6 0.18 30)"
                />
              ))}

              {/* X axis */}
              <AxisBottom
                top={innerHeight}
                scale={xScale}
                numTicks={Math.min(points.length, 7)}
                tickFormat={(d) => {
                  const date = d as Date;
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
                stroke="oklch(0.85 0.01 85)"
                tickStroke="oklch(0.85 0.01 85)"
                tickLabelProps={() => ({
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                  fill: "oklch(0.38 0.01 85)",
                  textAnchor: "middle" as const,
                  dy: "0.5em",
                })}
              />

              {/* Y axis */}
              <AxisLeft
                scale={yScale}
                numTicks={4}
                tickFormat={(v) => `$${v}`}
                stroke="oklch(0.85 0.01 85)"
                tickStroke="oklch(0.85 0.01 85)"
                tickLabelProps={() => ({
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                  fill: "oklch(0.38 0.01 85)",
                  textAnchor: "end" as const,
                  dx: "-0.4em",
                  dy: "0.25em",
                })}
              />

              {/* Tooltip hover area */}
              <Bar
                width={innerWidth}
                height={innerHeight}
                fill="transparent"
                onTouchStart={handleTooltip}
                onTouchMove={handleTooltip}
                onMouseMove={handleTooltip}
                onMouseLeave={hideTooltip}
              />

              {/* Tooltip crosshair */}
              {tooltipData && tooltipOpen && (
                <g>
                  <line
                    x1={xScale(getDate(tooltipData))}
                    x2={xScale(getDate(tooltipData))}
                    y1={0}
                    y2={innerHeight}
                    stroke="oklch(0.38 0.01 85)"
                    strokeWidth={1}
                    strokeDasharray="3,3"
                    pointerEvents="none"
                  />
                  <circle
                    cx={xScale(getDate(tooltipData))}
                    cy={yScale(getValue(tooltipData))}
                    r={4}
                    fill="oklch(0.6 0.18 30)"
                    stroke="white"
                    strokeWidth={2}
                    pointerEvents="none"
                  />
                </g>
              )}
            </Group>
          </svg>

          {/* Tooltip */}
          {tooltipData && tooltipOpen && (
            <TooltipWithBounds
              left={tooltipLeft}
              top={(tooltipTop || 0) - 12}
              style={{
                backgroundColor: "oklch(0.15 0.01 85)",
                color: "oklch(0.97 0.01 85)",
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                padding: "6px 10px",
                borderRadius: 0,
                boxShadow: "none",
                border: "1px solid oklch(0.3 0.01 85)",
                lineHeight: 1.6,
                pointerEvents: "none" as const,
              }}
            >
              <div>{tooltipData.date}</div>
              <div>消耗: ${tooltipData.used_usd.toFixed(2)}</div>
              <div>请求: {tooltipData.requests.toLocaleString()}</div>
              <div>活跃: {tooltipData.active_users} 人</div>
            </TooltipWithBounds>
          )}
        </div>
      </div>

      {/* Summary stats */}
      {summary && (
        <div className="mt-6 pt-4 border-t border-border flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs text-ink-muted justify-center">
          <span>
            日均消耗{" "}
            <span className="text-vermillion font-bold">
              ${summary.avg_daily_usd.toFixed(2)}
            </span>
          </span>
          <span>
            日均请求{" "}
            <span className="text-ink font-bold">
              {summary.avg_daily_requests.toLocaleString()}
            </span>
          </span>
          <span>
            共{" "}
            <span className="text-ink font-bold">{summary.total_days}</span> 天
          </span>
        </div>
      )}
    </div>
  );
}
