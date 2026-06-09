"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Lock, Sparkles } from "lucide-react";
import { createWorkout } from "@/server/actions/workouts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GOAL_LABELS,
  MUSCLE_FOCUS_LABELS,
  WORKOUT_TYPE_LABELS,
  type MuscleFocus,
} from "@/lib/constants";
import type { Goal, WorkoutType } from "@/types/database";

export function WorkoutGenerator({ aiEnabled }: { aiEnabled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    workoutType: "gym" as WorkoutType,
    goal: "gain_muscle" as Goal,
    focus: "full" as MuscleFocus,
    durationMin: "45",
    level: "intermedio" as "principiante" | "intermedio" | "avanzado",
  });

  function generate() {
    start(async () => {
      const res = await createWorkout({
        ...form,
        durationMin: Number(form.durationMin),
      });
      if (!res.ok) {
        toast.error(res.error ?? "Error");
        return;
      }
      toast.success("Rutina generada");
      router.refresh();
    });
  }

  if (!aiEnabled) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
          <Lock className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-semibold">Generador con IA</p>
          <p className="text-xs text-muted-foreground">
            Disponible en el plan IA. Con tu plan General puedes crear rutinas
            manuales y usar la semana base recomendada.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Lugar</Label>
            <Select
              value={form.workoutType}
              onValueChange={(v) => setForm((s) => ({ ...s, workoutType: v as WorkoutType }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(WORKOUT_TYPE_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Objetivo</Label>
            <Select
              value={form.goal}
              onValueChange={(v) => setForm((s) => ({ ...s, goal: v as Goal }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(GOAL_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Duración</Label>
            <Select
              value={form.durationMin}
              onValueChange={(v) => setForm((s) => ({ ...s, durationMin: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["20", "30", "45", "60", "90"].map((d) => (
                  <SelectItem key={d} value={d}>
                    {d} min
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Nivel</Label>
            <Select
              value={form.level}
              onValueChange={(v) => setForm((s) => ({ ...s, level: v as typeof form.level }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="principiante">Principiante</SelectItem>
                <SelectItem value="intermedio">Intermedio</SelectItem>
                <SelectItem value="avanzado">Avanzado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Enfoque muscular</Label>
          <Select
            value={form.focus}
            onValueChange={(v) => setForm((s) => ({ ...s, focus: v as MuscleFocus }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(MUSCLE_FOCUS_LABELS).map(([k, label]) => (
                <SelectItem key={k} value={k}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button className="w-full" onClick={generate} disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Generar rutina con IA
        </Button>
      </CardContent>
    </Card>
  );
}
