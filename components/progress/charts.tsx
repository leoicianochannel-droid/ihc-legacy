/**
 * Hand-rolled SVG charts so we don't drag in a 100KB+ chart library for
 * three small visualisations. Each chart is server-renderable (no client
 * JS required) — they're just SVG.
 *
 * - WeightSparkline: a line chart of the user's weight check-ins over time
 * - WeeklyConsistencyBars: 12-week bar chart of workouts completed per week
 * - ActivityHeatmap: 90-day grid coloured by workout activity
 */
import type { WeightPoint, MeasurementPoint, WeeklyBar, DayCell } from "@/lib/insights";

// ── WeightSparkline ───────────────────────────────────────────────
export function WeightSparkline({ points }: { points: WeightPoint[] }) {
  if (points.length < 2) return null;

  const W = 600;
  const H = 180;
  const PAD_X = 28;
  const PAD_Y = 24;

  const weights = points.map((p) => p.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = Math.max(max - min, 1);

  const x = (i: number) =>
    PAD_X + (i / (points.length - 1)) * (W - 2 * PAD_X);
  const y = (w: number) =>
    H - PAD_Y - ((w - min) / range) * (H - 2 * PAD_Y);

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.weight).toFixed(1)}`)
    .join(" ");

  // Area fill
  const area = `${path} L ${x(points.length - 1).toFixed(1)} ${H - PAD_Y} L ${x(0).toFixed(1)} ${H - PAD_Y} Z`;

  const first = points[0].weight;
  const latest = points[points.length - 1].weight;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Weight over time"
      className="h-44 w-full"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="weight-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="hsl(337 97% 42%)" stopOpacity="0.30" />
          <stop offset="100%" stopColor="hsl(337 97% 42%)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Min/max guidelines */}
      <line
        x1={PAD_X}
        x2={W - PAD_X}
        y1={y(max)}
        y2={y(max)}
        stroke="hsl(0 0% 90%)"
        strokeDasharray="3 4"
      />
      <line
        x1={PAD_X}
        x2={W - PAD_X}
        y1={y(min)}
        y2={y(min)}
        stroke="hsl(0 0% 90%)"
        strokeDasharray="3 4"
      />
      <text x={4} y={y(max) + 4} fontSize={10} fill="hsl(0 0% 50%)">
        {max.toFixed(1)}
      </text>
      <text x={4} y={y(min) + 4} fontSize={10} fill="hsl(0 0% 50%)">
        {min.toFixed(1)}
      </text>

      {/* Area + line */}
      <path d={area} fill="url(#weight-grad)" />
      <path d={path} fill="none" stroke="hsl(337 97% 42%)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />

      {/* Endpoint dots */}
      <circle cx={x(0)} cy={y(first)} r={4} fill="hsl(0 0% 100%)" stroke="hsl(337 97% 42%)" strokeWidth={2} />
      <circle cx={x(points.length - 1)} cy={y(latest)} r={5} fill="hsl(337 97% 42%)" />
    </svg>
  );
}

// ── MeasurementSparkline ──────────────────────────────────────────
// Shows waist (primary) and optionally hips (secondary) over time.
export function MeasurementSparkline({ points }: { points: MeasurementPoint[] }) {
  const waistPoints = points.filter((p): p is MeasurementPoint & { waist: number } => p.waist != null);
  const hipsPoints = points.filter((p): p is MeasurementPoint & { hips: number } => p.hips != null);
  if (waistPoints.length < 2) return null;

  const W = 600;
  const H = 180;
  const PAD_X = 28;
  const PAD_Y = 24;

  // Compute combined domain so both lines share the same scale
  const allVals = [
    ...waistPoints.map((p) => p.waist),
    ...hipsPoints.map((p) => p.hips),
  ];
  const min = Math.min(...allVals);
  const max = Math.max(...allVals);
  const range = Math.max(max - min, 1);

  const xFor = (i: number, total: number) =>
    PAD_X + (i / (total - 1)) * (W - 2 * PAD_X);
  const yFor = (v: number) =>
    H - PAD_Y - ((v - min) / range) * (H - 2 * PAD_Y);

  const waistPath = waistPoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i, waistPoints.length).toFixed(1)} ${yFor(p.waist).toFixed(1)}`)
    .join(" ");
  const waistArea = `${waistPath} L ${xFor(waistPoints.length - 1, waistPoints.length).toFixed(1)} ${H - PAD_Y} L ${xFor(0, waistPoints.length).toFixed(1)} ${H - PAD_Y} Z`;

  const hipsPath = hipsPoints.length >= 2
    ? hipsPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i, hipsPoints.length).toFixed(1)} ${yFor(p.hips).toFixed(1)}`).join(" ")
    : null;

  const waistFirst = waistPoints[0].waist;
  const waistLatest = waistPoints[waistPoints.length - 1].waist;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Measurements over time"
      className="h-44 w-full"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="meas-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="hsl(337 97% 42%)" stopOpacity="0.20" />
          <stop offset="100%" stopColor="hsl(337 97% 42%)" stopOpacity="0" />
        </linearGradient>
      </defs>

      <line x1={PAD_X} x2={W - PAD_X} y1={yFor(max)} y2={yFor(max)} stroke="hsl(0 0% 90%)" strokeDasharray="3 4" />
      <line x1={PAD_X} x2={W - PAD_X} y1={yFor(min)} y2={yFor(min)} stroke="hsl(0 0% 90%)" strokeDasharray="3 4" />
      <text x={4} y={yFor(max) + 4} fontSize={10} fill="hsl(0 0% 50%)">{max.toFixed(1)}"</text>
      <text x={4} y={yFor(min) + 4} fontSize={10} fill="hsl(0 0% 50%)">{min.toFixed(1)}"</text>

      <path d={waistArea} fill="url(#meas-grad)" />
      <path d={waistPath} fill="none" stroke="hsl(337 97% 42%)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />

      {hipsPath && (
        <path d={hipsPath} fill="none" stroke="hsl(337 97% 65%)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 3" />
      )}

      <circle cx={xFor(0, waistPoints.length)} cy={yFor(waistFirst)} r={4} fill="hsl(0 0% 100%)" stroke="hsl(337 97% 42%)" strokeWidth={2} />
      <circle cx={xFor(waistPoints.length - 1, waistPoints.length)} cy={yFor(waistLatest)} r={5} fill="hsl(337 97% 42%)" />
    </svg>
  );
}

// ── WeeklyConsistencyBars ─────────────────────────────────────────
export function WeeklyConsistencyBars({ bars }: { bars: WeeklyBar[] }) {
  const W = 600;
  const H = 140;
  const PAD = 20;
  const max = Math.max(7, ...bars.map((b) => b.count));
  const barW = (W - 2 * PAD) / bars.length;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Workouts per week, last 12 weeks"
      className="h-32 w-full"
      preserveAspectRatio="none"
    >
      {bars.map((b, i) => {
        const h = (b.count / max) * (H - 2 * PAD);
        const x = PAD + i * barW + 2;
        const y = H - PAD - h;
        const w = Math.max(0, barW - 4);
        const isLatest = i === bars.length - 1;
        return (
          <g key={b.weekStart}>
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              rx={3}
              fill={isLatest ? "hsl(337 97% 42%)" : "hsl(337 97% 75%)"}
            />
            {b.count > 0 && (
              <text
                x={x + w / 2}
                y={y - 4}
                fontSize={9}
                textAnchor="middle"
                fill="hsl(0 0% 30%)"
              >
                {b.count}
              </text>
            )}
          </g>
        );
      })}
      {/* Goal line at 3/week */}
      <line
        x1={PAD}
        x2={W - PAD}
        y1={H - PAD - (3 / max) * (H - 2 * PAD)}
        y2={H - PAD - (3 / max) * (H - 2 * PAD)}
        stroke="hsl(337 97% 42%)"
        strokeOpacity={0.45}
        strokeDasharray="4 4"
      />
      <text
        x={W - PAD - 2}
        y={H - PAD - (3 / max) * (H - 2 * PAD) - 4}
        fontSize={9}
        textAnchor="end"
        fill="hsl(337 97% 35%)"
      >
        goal: 3/week
      </text>
    </svg>
  );
}

// ── ActivityHeatmap ────────────────────────────────────────────────
export function ActivityHeatmap({ cells }: { cells: DayCell[] }) {
  // 13 columns × 7 rows = 91 squares; we have 90 — pad one empty cell at the
  // start so the grid lines up with current day at the bottom right.
  const COLS = 13;
  const ROWS = 7;
  const SIZE = 14;
  const GAP = 3;
  const W = COLS * (SIZE + GAP);
  const H = ROWS * (SIZE + GAP);
  const grid: (DayCell | null)[] = [null, ...cells];

  function colorFor(count: number) {
    if (count === 0) return "hsl(40 10% 92%)";
    if (count === 1) return "hsl(337 97% 82%)";
    if (count === 2) return "hsl(337 97% 60%)";
    return "hsl(337 97% 42%)";
  }

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-md" role="img" aria-label="Workout activity in the last 90 days">
        {grid.map((cell, i) => {
          const col = Math.floor(i / ROWS);
          const row = i % ROWS;
          if (!cell) return null;
          return (
            <rect
              key={cell.date}
              x={col * (SIZE + GAP)}
              y={row * (SIZE + GAP)}
              width={SIZE}
              height={SIZE}
              rx={3}
              fill={colorFor(cell.count)}
            >
              <title>{`${cell.date}: ${cell.count} workout${cell.count === 1 ? "" : "s"}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <span>Less</span>
        {[0, 1, 2, 3].map((n) => (
          <span
            key={n}
            className="inline-block size-3 rounded-sm"
            style={{ backgroundColor: colorFor(n) }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
