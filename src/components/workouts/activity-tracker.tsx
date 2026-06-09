"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Flame, Loader2 } from "lucide-react";
import { logQuickSession } from "@/server/actions/workouts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WORKOUT_TYPE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { WorkoutType } from "@/types/database";

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function computeStreak(set: Set<string>): number {
  let streak = 0;
  const cur = new Date();
  if (!set.has(iso(cur))) cur.setDate(cur.getDate() - 1);
  while (set.has(iso(cur))) {
    streak++;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

const WEEK = ["L", "M", "X", "J", "V", "S", "D"];

export function ActivityTracker({ dates }: { dates: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [type, setType] = useState<WorkoutType>("gym");

  const set = new Set(dates);
  const streak = computeStreak(set);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthCount = dates.filter((d) => {
    const [y, m] = d.split("-").map(Number);
    return y === year && m === month + 1;
  }).length;

  // Calendario del mes (lunes primero)
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // 0 = lunes
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const todayStr = iso(now);

  function logToday() {
    start(async () => {
      const res = await logQuickSession(type);
      if (!res.ok) {
        toast.error(res.error ?? "Error");
        return;
      }
      toast.success("¡Sesión registrada! 💪");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-extrabold leading-none">{streak}</p>
              <p className="text-xs text-muted-foreground">
                {streak === 1 ? "día seguido" : "días seguidos"}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-extrabold leading-none text-primary">
              {monthCount}
            </p>
            <p className="text-xs text-muted-foreground">este mes</p>
          </div>
        </div>

        {/* Calendario */}
        <div>
          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
            {WEEK.map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (day === null) return <span key={i} />;
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(
                day,
              ).padStart(2, "0")}`;
              const trained = set.has(dateStr);
              const isToday = dateStr === todayStr;
              return (
                <div
                  key={i}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-md text-xs",
                    trained
                      ? "bg-primary font-bold text-primary-foreground"
                      : "bg-secondary/40 text-muted-foreground",
                    isToday && !trained && "ring-1 ring-primary",
                  )}
                >
                  {day}
                </div>
              );
            })}
          </div>
        </div>

        {/* Registrar hoy */}
        <div className="flex gap-2">
          <Select value={type} onValueChange={(v) => setType(v as WorkoutType)}>
            <SelectTrigger className="w-36">
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
          <Button className="flex-1" onClick={logToday} disabled={pending}>
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Flame className="h-4 w-4" />
            )}
            Entrené hoy
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
