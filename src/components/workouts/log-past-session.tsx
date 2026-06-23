"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dumbbell, Loader2 } from "lucide-react";
import { logQuickSession } from "@/server/actions/workouts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WORKOUT_TYPE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { WorkoutType } from "@/types/database";

const TYPES: WorkoutType[] = ["gym", "hypertrophy", "home", "cardio", "mobility"];

/** Registrar lo que se entrenó en un día anterior (sin rutina detallada). */
export function LogPastSession({ date }: { date: string }) {
  const router = useRouter();
  const [type, setType] = useState<WorkoutType>("gym");
  const [duration, setDuration] = useState(45);
  const [pending, start] = useTransition();

  function log() {
    start(async () => {
      const res = await logQuickSession(type, date, duration);
      if (!res.ok) {
        toast.error(res.error ?? "Error");
        return;
      }
      toast.success("¡Sesión registrada! 💪");
      router.refresh();
    });
  }

  return (
    <Card className="border-primary/30">
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-center gap-2">
          <Dumbbell className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Registrar lo que entrenaste</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          ¿Te faltó marcar el entreno de este día? Agrégalo aquí.
        </p>

        <div className="flex flex-wrap gap-1.5">
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-xs",
                type === t
                  ? "border-primary bg-primary/10 font-semibold"
                  : "border-border text-muted-foreground",
              )}
            >
              {WORKOUT_TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Duración</span>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="h-9 w-20 rounded-lg border border-input bg-background px-2 text-center text-base"
          />
          <span className="text-xs text-muted-foreground">min</span>
        </div>

        <Button className="w-full" onClick={log} disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Dumbbell className="h-4 w-4" />
          )}
          Registrar sesión
        </Button>
      </CardContent>
    </Card>
  );
}
