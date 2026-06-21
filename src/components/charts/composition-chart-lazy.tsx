"use client";

import dynamic from "next/dynamic";

/** Carga diferida de la gráfica de composición (Recharts). */
export const CompositionChart = dynamic(
  () => import("./composition-chart").then((m) => m.CompositionChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-56 w-full animate-pulse rounded-xl bg-secondary/40" />
    ),
  },
);
