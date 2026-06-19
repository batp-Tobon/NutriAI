"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { searchFoods, updateMeal } from "@/server/actions/meals";
import { macrosForGrams } from "@/core/application/nutrition";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FoodSearchItem } from "@/core/domain/entities";

interface Item {
  name: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function MealEditDialog({
  open,
  onOpenChange,
  meal,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  meal: {
    id: string;
    name: string | null;
    items: Item[];
  };
  onSaved: () => void;
}) {
  const [name, setName] = useState(meal.name ?? "Comida");
  const [items, setItems] = useState<Item[]>(meal.items);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [addQuery, setAddQuery] = useState("");
  const [addResults, setAddResults] = useState<FoodSearchItem[]>([]);
  const [addSearching, setAddSearching] = useState(false);
  const [saving, startSave] = useTransition();

  function patch(idx: number, p: Partial<Item>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...p } : it)));
  }

  function setGrams(idx: number, grams: number) {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const old = it.grams || 1;
        const k = grams / old;
        return {
          ...it,
          grams,
          kcal: Math.round(it.kcal * k),
          protein: Math.round(it.protein * k * 10) / 10,
          carbs: Math.round(it.carbs * k * 10) / 10,
          fat: Math.round(it.fat * k * 10) / 10,
        };
      }),
    );
  }

  function removeItem(idx: number) {
    setEditIdx(null);
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function search() {
    if (!addQuery.trim()) return;
    setAddSearching(true);
    try {
      setAddResults(await searchFoods(addQuery));
    } catch {
      toast.error("Error al buscar");
    } finally {
      setAddSearching(false);
    }
  }

  function addFromSearch(f: FoodSearchItem) {
    const m = macrosForGrams(f, 100);
    setItems((prev) => [...prev, { name: f.name, grams: 100, ...m }]);
    setAddResults([]);
    setAddQuery("");
  }

  function addBlank() {
    setItems((prev) => {
      const next = [
        ...prev,
        { name: "", grams: 100, kcal: 0, protein: 0, carbs: 0, fat: 0 },
      ];
      setEditIdx(next.length - 1);
      return next;
    });
  }

  const totals = items.reduce(
    (a, i) => ({
      kcal: a.kcal + i.kcal,
      protein: a.protein + i.protein,
      carbs: a.carbs + i.carbs,
      fat: a.fat + i.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );

  function save() {
    if (items.length === 0) {
      toast.error("Deja al menos un alimento o elimina la comida.");
      return;
    }
    if (items.some((i) => !i.name.trim())) {
      toast.error("Hay alimentos sin nombre.");
      return;
    }
    startSave(async () => {
      const res = await updateMeal({ id: meal.id, name, items });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo guardar");
        return;
      }
      toast.success("Comida actualizada");
      onOpenChange(false);
      onSaved();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88dvh] w-[calc(100%-1.5rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar comida</DialogTitle>
        </DialogHeader>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre de la comida"
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-base font-medium"
        />

        <div className="space-y-2">
          {items.map((it, idx) => (
            <div key={idx} className="rounded-xl bg-secondary/40 p-2.5">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <input
                    value={it.name}
                    onChange={(e) => patch(idx, { name: e.target.value })}
                    placeholder="Nombre del alimento"
                    className="w-full bg-transparent text-sm font-medium focus:outline-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    {Math.round(it.kcal)} kcal · P{Math.round(it.protein)} C
                    {Math.round(it.carbs)} G{Math.round(it.fat)}
                  </p>
                </div>
                <input
                  type="number"
                  value={it.grams}
                  onChange={(e) => setGrams(idx, Number(e.target.value))}
                  className="h-9 w-16 rounded-lg border border-input bg-background px-2 text-right text-base"
                />
                <span className="text-xs text-muted-foreground">g</span>
                <button
                  onClick={() => setEditIdx((c) => (c === idx ? null : idx))}
                  aria-label="Editar macros"
                  className={
                    editIdx === idx
                      ? "text-primary"
                      : "text-muted-foreground hover:text-primary"
                  }
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => removeItem(idx)}
                  aria-label="Quitar"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {editIdx === idx && (
                <div className="mt-2 grid grid-cols-4 gap-1.5 border-t border-border/60 pt-2">
                  <Macro label="Kcal" value={it.kcal} onChange={(v) => patch(idx, { kcal: v })} />
                  <Macro label="Prot" value={it.protein} onChange={(v) => patch(idx, { protein: v })} />
                  <Macro label="Carb" value={it.carbs} onChange={(v) => patch(idx, { carbs: v })} />
                  <Macro label="Grasa" value={it.fat} onChange={(v) => patch(idx, { fat: v })} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Añadir alimento */}
        <div className="space-y-2 rounded-xl border border-dashed border-border p-2.5">
          <div className="flex gap-2">
            <input
              value={addQuery}
              onChange={(e) => setAddQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="Añadir alimento…"
              className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-base"
            />
            <Button size="sm" variant="secondary" className="h-10" onClick={search} disabled={addSearching}>
              {addSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
            <Button size="sm" variant="outline" className="h-10" onClick={addBlank}>
              <Plus className="h-4 w-4" /> Manual
            </Button>
          </div>
          {addResults.length > 0 && (
            <div className="space-y-1">
              {addResults.slice(0, 6).map((f) => (
                <button
                  key={f.id}
                  onClick={() => addFromSearch(f)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg bg-secondary/40 px-3 py-2 text-left text-sm hover:bg-secondary"
                >
                  <span className="min-w-0 truncate">{f.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {f.kcal_per_100g} kcal/100g
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between rounded-xl bg-secondary/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Total</span>
          <span className="font-bold">
            {Math.round(totals.kcal)} kcal · P{Math.round(totals.protein)} C
            {Math.round(totals.carbs)} G{Math.round(totals.fat)}
          </span>
        </div>

        <Button className="w-full" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Guardar cambios
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function Macro({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <p className="mb-0.5 text-[10px] text-muted-foreground">{label}</p>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="h-9 w-full rounded-lg border border-input bg-background px-1 text-center text-base"
      />
    </div>
  );
}
