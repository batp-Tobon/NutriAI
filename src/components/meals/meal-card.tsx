"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { deleteMeal } from "@/server/actions/meals";
import { MealEditDialog } from "@/components/meals/meal-edit-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MEAL_TYPE_LABELS } from "@/lib/constants";
import type { MealType } from "@/types/database";

interface Item {
  name: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

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
    items?: Item[];
  };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  function onDelete() {
    start(async () => {
      await deleteMeal(meal.id);
      toast.success("Comida eliminada");
      router.refresh();
    });
  }

  const time = new Date(meal.consumed_at).toLocaleTimeString("es", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <>
      <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card p-3">
        <button
          onClick={() => setEditing(true)}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">
              {meal.name ?? "Comida"}
            </p>
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {MEAL_TYPE_LABELS[meal.meal_type]} · {time}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {Math.round(meal.total_kcal)} kcal · P{Math.round(meal.total_protein)}{" "}
            C{Math.round(meal.total_carbs)} G{Math.round(meal.total_fat)}
          </p>
        </button>
        <button
          onClick={() => setEditing(true)}
          className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
          aria-label="Editar"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={() => setConfirming(true)}
          disabled={pending}
          className="shrink-0 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
          aria-label="Eliminar"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <MealEditDialog
        open={editing}
        onOpenChange={setEditing}
        meal={{ id: meal.id, name: meal.name, items: meal.items ?? [] }}
        onSaved={() => router.refresh()}
      />

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle>¿Eliminar esta comida?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Se borrará «{meal.name ?? "Comida"}» ({Math.round(meal.total_kcal)}{" "}
            kcal) de este día. Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirming(false);
                onDelete();
              }}
              disabled={pending}
            >
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
