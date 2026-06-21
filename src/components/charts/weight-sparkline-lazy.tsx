"use client";

import dynamic from "next/dynamic";

/**
 * Versión de carga diferida: Recharts (pesado) solo se descarga cuando la
 * gráfica entra en pantalla, no en el bundle inicial de la página.
 */
export const WeightSparkline = dynamic(
  () => import("./weight-sparkline").then((m) => m.WeightSparkline),
  {
    ssr: false,
    loading: () => (
      <div className="h-12 w-full animate-pulse rounded-lg bg-secondary/40" />
    ),
  },
);
