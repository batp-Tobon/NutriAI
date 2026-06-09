"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from "recharts";

export function WeightSparkline({
  data,
}: {
  data: { date: string; weight: number }[];
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
        Aún no hay registros de peso.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={96}>
      <AreaChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
        <defs>
          <linearGradient id="wsg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(84 81% 56%)" stopOpacity={0.4} />
            <stop offset="100%" stopColor="hsl(84 81% 56%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
        <Tooltip
          contentStyle={{
            background: "hsl(0 0% 8%)",
            border: "1px solid hsl(0 0% 16%)",
            borderRadius: 12,
            fontSize: 12,
          }}
          labelStyle={{ color: "hsl(0 0% 62%)" }}
          formatter={(v: number) => [`${v} kg`, "Peso"]}
        />
        <Area
          type="monotone"
          dataKey="weight"
          stroke="hsl(84 81% 56%)"
          strokeWidth={2.5}
          fill="url(#wsg)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
