/**
 * Hand-rolled SVG charts for the admin section. Same approach as the
 * member-side charts — no chart library dep.
 */

export function BarSeries({
  data,
  height = 140,
  label,
  emptyLabel = "No data yet",
}: {
  data: { date: string; count: number }[];
  height?: number;
  label?: string;
  emptyLabel?: string;
}) {
  const W = 600;
  const PAD = 24;
  const max = Math.max(1, ...data.map((d) => d.count));
  const colW = (W - 2 * PAD) / Math.max(data.length, 1);
  const total = data.reduce((sum, d) => sum + d.count, 0);

  if (total === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div>
      {label && (
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
      )}
      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={label ?? "Bar chart"}
      >
        {data.map((d, i) => {
          const h = (d.count / max) * (height - 2 * PAD);
          const x = PAD + i * colW + 1.5;
          const y = height - PAD - h;
          return (
            <rect
              key={d.date}
              x={x}
              y={y}
              width={Math.max(0, colW - 3)}
              height={h}
              rx={2}
              fill="hsl(337 97% 42%)"
            >
              <title>
                {d.date}: {d.count}
              </title>
            </rect>
          );
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{data[0]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}

export function HorizontalBars({
  rows,
  emptyLabel = "Nothing yet",
}: {
  rows: { label: string; count: number }[];
  emptyLabel?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }
  const max = Math.max(...rows.map((r) => r.count));
  return (
    <ul className="space-y-2">
      {rows.map((r) => {
        const pct = (r.count / max) * 100;
        return (
          <li key={r.label} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="font-semibold">{r.label}</span>
              <span className="text-muted-foreground">{r.count}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
