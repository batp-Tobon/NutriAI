"use client";

import dynamic from "next/dynamic";

/** Carga diferida de la gráfica de calorías (Recharts). */
export const CaloriesBarChart = dynamic(
  () => import("./calories-bar-chart").then((m) => m.CaloriesBarChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-48 w-full animate-pulse rounded-xl bg-secondary/40" />
    ),
  },
);
