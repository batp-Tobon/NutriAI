"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Droplet, Minus, Plus } from "lucide-react";
import { addWater } from "@/server/actions/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export function WaterCard({
  current,
  goal,
}: {
  current: number;
  goal: number;
}) {
  const router = useRouter();
  const [ml, setMl] = useState(current);
  const seq = useRef(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sincroniza con el valor del servidor tras cada refresh
  useEffect(() => setMl(current), [current]);
  useEffect(
    () => () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    },
    [],
  );

  function scheduleRefresh() {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    // Un solo refresh cuando dejas de tocar (mantiene fluidez)
    refreshTimer.current = setTimeout(() => router.refresh(), 1500);
  }

  function add(amount: number) {
    const prev = ml;
    setMl((m) => Math.max(0, m + amount)); // optimista, sin bloquear botones
    const my = ++seq.current;
    void addWater(amount).then((res) => {
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo guardar el agua");
        setMl(prev); // revierte el optimismo si falló de verdad
        return;
      }
      // Sólo la respuesta más reciente manda (toques rápidos en vuelo)
      if (seq.current === my && res.total != null) setMl(res.total);
      scheduleRefresh();
    });
  }

  const pct = goal > 0 ? Math.min(100, Math.round((ml / goal) * 100)) : 0;
  const glasses = Math.round(ml / 250);

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Droplet className="h-4 w-4 text-primary" /> Hidratación
          </h2>
          <span className="text-sm font-bold tabular-nums">
            {ml}
            <span className="text-xs font-normal text-muted-foreground">
              {" "}
              / {goal} ml
            </span>
          </span>
        </div>
        <Progress value={pct} className="mt-2 h-2.5" />
        <div className="mt-3 flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="flex-1"
            onClick={() => add(250)}
          >
            <Plus className="h-4 w-4" /> Vaso
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="flex-1"
            onClick={() => add(500)}
          >
            <Plus className="h-4 w-4" /> Botella
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={() => add(-250)}
            disabled={ml <= 0}
            aria-label="Quitar agua"
          >
            <Minus className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          ≈ {glasses} vaso(s) de 250 ml hoy
        </p>
      </CardContent>
    </Card>
  );
}
