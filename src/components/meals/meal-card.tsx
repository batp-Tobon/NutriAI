"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { deleteMeal } from "@/server/actions/meals";
import { MEAL_TYPE_LABELS } from "@/lib/constants";
import type { MealType } from "@/types/database";

export function MealCard({
  meal,
}: {
  meal: {
    id: string;
    name: string | null;
    meal_type: MealType;
    total_kcal: number;
    total_protein: number;
    total_carbs: number;
    total_fat: number;
    consumed_at: string;
  };
}) {
  const [pending, start] = useTransition();

  function onDelete() {
    start(async () => {
      await deleteMeal(meal.id);
      toast.success("Comida eliminada");
    });
  }

  const time = new Date(meal.consumed_at).toLocaleTimeString("es", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold">
            {meal.name ?? "Comida"}
          </p>
          <span className="text-[10px] text-muted-foreground">
            {MEAL_TYPE_LABELS[meal.meal_type]} · {time}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {Math.round(meal.total_kcal)} kcal · P{Math.round(meal.total_protein)} C
          {Math.round(meal.total_carbs)} G{Math.round(meal.total_fat)}
        </p>
      </div>
      <button
        onClick={onDelete}
        disabled={pending}
        className="text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
        aria-label="Eliminar"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
