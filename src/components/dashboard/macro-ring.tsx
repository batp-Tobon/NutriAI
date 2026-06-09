import { formatNumber } from "@/lib/utils";

/** Anillo de progreso de calorías (SVG puro). */
export function MacroRing({
  consumed,
  target,
}: {
  consumed: number;
  target: number;
}) {
  const size = 224;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = target > 0 ? Math.min(consumed / target, 1) : 0;
  const remaining = Math.max(Math.round(target - consumed), 0);

  return (
    <div
      className="relative mx-auto"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="hsl(var(--secondary))"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-extrabold tabular-nums">
          {formatNumber(remaining)}
        </span>
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          kcal restantes
        </span>
      </div>
    </div>
  );
}
