"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, TrendingDown, Minus, TrendingUp } from "lucide-react";
import { setGoal } from "@/server/actions/profile";
import { cn } from "@/lib/utils";
import type { Goal } from "@/types/database";

const OPTIONS: {
  value: Goal;
  label: string;
  hint: string;
  icon: typeof TrendingDown;
}[] = [
  {
    value: "lose_fat",
    label: "Perder grasa",
    hint: "Déficit moderado, baja de peso conservando músculo",
    icon: TrendingDown,
  },
  {
    value: "maintain",
    label: "Mantener",
    hint: "Equilibrio: ni subes ni bajas de peso",
    icon: Minus,
  },
  {
    value: "gain_muscle",
    label: "Ganar músculo",
    hint: "Ligero superávit para crecer",
    icon: TrendingUp,
  },
];

export function GoalSelector({ current }: { current: Goal }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function pick(g: Goal) {
    if (g === current) return;
    start(async () => {
      const res = await setGoal(g);
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo cambiar");
        return;
      }
      toast.success("Objetivo actualizado");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">¿Cuál es tu objetivo?</h2>
        {pending && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
      </div>
      <div className="grid gap-2">
        {OPTIONS.map(({ value, label, hint, icon: Icon }) => {
          const active = value === current;
          return (
            <button
              key={value}
              onClick={() => pick(value)}
              disabled={pending}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors disabled:opacity-60",
                active
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-primary/50",
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-semibold", active && "text-primary")}>
                  {label}
                </p>
                <p className="text-[11px] text-muted-foreground">{hint}</p>
              </div>
              {active && (
                <span className="shrink-0 text-xs font-bold text-primary">✓</span>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Al cambiarlo, recalculo tus objetivos diarios de calorías y macros.
      </p>
    </div>
  );
}
