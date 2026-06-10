"use client";

import {
  Bar,
  BarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

export function CaloriesBarChart({
  data,
  target,
}: {
  data: { label: string; kcal: number }[];
  target?: number | null;
}) {
  if (data.every((d) => d.kcal === 0)) {
    return (
      <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
        Sin comidas registradas esta semana.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={170}>
      <BarChart data={data} margin={{ top: 12, right: 4, bottom: 0, left: 4 }}>
        <XAxis
          dataKey="label"
          tick={{ fill: "hsl(0 0% 62%)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ fill: "hsl(0 0% 16% / 0.5)" }}
          contentStyle={{
            background: "hsl(0 0% 8%)",
            border: "1px solid hsl(0 0% 16%)",
            borderRadius: 12,
            fontSize: 12,
          }}
          formatter={(v: number) => [`${Math.round(v)} kcal`, "Consumido"]}
        />
        {target ? (
          <ReferenceLine
            y={target}
            stroke="hsl(0 0% 50%)"
            strokeDasharray="4 4"
          />
        ) : null}
        <Bar
          dataKey="kcal"
          fill="hsl(84 81% 56%)"
          radius={[6, 6, 2, 2]}
          maxBarSize={34}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
