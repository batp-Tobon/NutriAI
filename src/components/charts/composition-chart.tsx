"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function CompositionChart({
  data,
}: {
  data: { date: string; weight: number | null; fat: number | null }[];
}) {
  if (data.length < 2) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        Registra al menos dos días para ver tu evolución.
      </div>
    );
  }

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("es", { day: "2-digit", month: "short" });

  return (
    <ResponsiveContainer width="100%" height={224}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid stroke="hsl(0 0% 16%)" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={fmt}
          tick={{ fill: "hsl(0 0% 62%)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fill: "hsl(0 0% 62%)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip
          contentStyle={{
            background: "hsl(0 0% 8%)",
            border: "1px solid hsl(0 0% 16%)",
            borderRadius: 12,
            fontSize: 12,
          }}
          labelFormatter={fmt}
        />
        <Line
          type="monotone"
          dataKey="weight"
          name="Peso (kg)"
          stroke="hsl(84 81% 56%)"
          strokeWidth={2.5}
          dot={false}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="fat"
          name="Grasa (%)"
          stroke="hsl(0 0% 70%)"
          strokeWidth={2}
          strokeDasharray="4 4"
          dot={false}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
