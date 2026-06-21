"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  CheckCircle2,
  ChefHat,
  Loader2,
  Lock,
  RefreshCw,
  ShoppingCart,
  Sparkles,
} from "lucide-react";
import { generateMealPlanAction } from "@/server/actions/meal-plan";
import { saveMeal } from "@/server/actions/meals";
import { BASE_MEAL_PLANS, pickBasePlan } from "@/lib/base-meals";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type MealType = "breakfast" | "lunch" | "dinner" | "snack";
interface PlanItem {
  name: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}
interface PlanMeal {
  meal: string;
  meal_type: MealType;
  items: PlanItem[];
}
interface MealPlan {
  title: string;
  meals: PlanMeal[];
  shopping_list: { name: string; amount: string }[];
}

const STORAGE = "nutriai-meal-plan";

export function MealPlanClient({
  defaultKcal,
  defaultProtein,
  aiEnabled,
}: {
  defaultKcal: number;
  defaultProtein: number;
  aiEnabled: boolean;
}) {
  const [kcal, setKcal] = useState(defaultKcal);
  const [protein, setProtein] = useState(defaultProtein);
  const [mealsCount, setMealsCount] = useState(4);
  const [diet, setDiet] = useState<"omnivoro" | "vegetariano" | "vegano">(
    "omnivoro",
  );
  const [budget, setBudget] = useState<"economico" | "medio" | "alto">("medio");
  const [avoid, setAvoid] = useState("");

  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [logged, setLogged] = useState<Record<number, boolean>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [generating, startGen] = useTransition();
  const [loggingIdx, setLoggingIdx] = useState<number | null>(null);

  // Recupera el último plan generado.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) {
        const p = JSON.parse(raw) as { plan: MealPlan; checked?: Record<string, boolean> };
        if (p.plan) setPlan(p.plan);
        if (p.checked) setChecked(p.checked);
      }
    } catch {
      /* ignore */
    }
  }, []);

  function persist(nextPlan: MealPlan | null, nextChecked = checked) {
    try {
      if (nextPlan)
        localStorage.setItem(
          STORAGE,
          JSON.stringify({ plan: nextPlan, checked: nextChecked }),
        );
    } catch {
      /* ignore */
    }
  }

  function loadBasePlan(p: MealPlan) {
    setPlan(p);
    setLogged({});
    setChecked({});
    persist(p, {});
    toast.success("Plan base cargado 🍽️");
  }

  function generate() {
    startGen(async () => {
      const res = await generateMealPlanAction({
        targetKcal: kcal,
        proteinTarget: protein,
        mealsCount,
        diet,
        avoid: avoid || undefined,
        budget,
      });
      if (!res.ok || !res.plan) {
        toast.error(res.error ?? "No se pudo generar el plan");
        return;
      }
      const p = res.plan as MealPlan;
      setPlan(p);
      setLogged({});
      setChecked({});
      persist(p, {});
      toast.success("¡Plan listo! 🍽️");
    });
  }

  function logMeal(meal: PlanMeal, idx: number) {
    setLoggingIdx(idx);
    void saveMeal({
      name: meal.meal,
      meal_type: meal.meal_type,
      source: "manual",
      items: meal.items.map((i) => ({
        name: i.name,
        grams: i.grams,
        kcal: i.kcal,
        protein: i.protein,
        carbs: i.carbs,
        fat: i.fat,
      })),
    })
      .then((res) => {
        if (!res.ok) {
          toast.error(res.error ?? "No se pudo registrar");
          return;
        }
        setLogged((l) => ({ ...l, [idx]: true }));
        toast.success(`${meal.meal} registrado en tu diario`);
      })
      .finally(() => setLoggingIdx(null));
  }

  function toggleCheck(name: string) {
    setChecked((c) => {
      const n = { ...c, [name]: !c[name] };
      persist(plan, n);
      return n;
    });
  }

  const total = plan
    ? plan.meals.reduce(
        (a, m) => {
          for (const it of m.items) {
            a.kcal += it.kcal;
            a.protein += it.protein;
          }
          return a;
        },
        { kcal: 0, protein: 0 },
      )
    : null;

  const recommendedBase = pickBasePlan(defaultKcal);

  return (
    <div className="space-y-4">
      {/* Planes base (sin IA) — disponibles para todos */}
      <Card>
        <CardContent className="space-y-2 pt-5">
          <h2 className="text-sm font-semibold">Planes base (sin IA)</h2>
          <p className="text-xs text-muted-foreground">
            Menús balanceados listos. Elige el más cercano a tu objetivo
            ({defaultKcal} kcal).
          </p>
          <div className="grid gap-2">
            {BASE_MEAL_PLANS.map((p) => (
              <button
                key={p.level}
                onClick={() => loadBasePlan(p)}
                className={cn(
                  "flex items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-colors",
                  p.level === recommendedBase.level
                    ? "border-primary/50 bg-primary/5"
                    : "border-border hover:border-primary/40",
                )}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{p.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.meals.length} comidas
                  </p>
                </div>
                {p.level === recommendedBase.level && (
                  <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    Recomendado
                  </span>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Generador con IA (plan IA) o invitación a mejorar */}
      {aiEnabled ? (
      <Card>
        <CardContent className="space-y-3 pt-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" /> A tu medida con IA
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Calorías objetivo">
              <input
                type="number"
                value={kcal}
                onChange={(e) => setKcal(Number(e.target.value))}
                className="h-10 w-full rounded-lg border border-input bg-background px-2 text-base"
              />
            </Field>
            <Field label="Proteína (g)">
              <input
                type="number"
                value={protein}
                onChange={(e) => setProtein(Number(e.target.value))}
                className="h-10 w-full rounded-lg border border-input bg-background px-2 text-base"
              />
            </Field>
          </div>

          <Field label="Número de comidas">
            <div className="flex gap-1.5">
              {[2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  onClick={() => setMealsCount(n)}
                  className={cn(
                    "h-9 flex-1 rounded-lg border text-sm",
                    mealsCount === n
                      ? "border-primary bg-primary/10 font-semibold"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Dieta">
            <div className="flex gap-1.5">
              {(
                [
                  ["omnivoro", "Omnívora"],
                  ["vegetariano", "Vegetariana"],
                  ["vegano", "Vegana"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setDiet(v)}
                  className={cn(
                    "h-9 flex-1 rounded-lg border text-xs",
                    diet === v
                      ? "border-primary bg-primary/10 font-semibold"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Presupuesto">
            <div className="flex gap-1.5">
              {(
                [
                  ["economico", "Económico"],
                  ["medio", "Medio"],
                  ["alto", "Alto"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setBudget(v)}
                  className={cn(
                    "h-9 flex-1 rounded-lg border text-xs",
                    budget === v
                      ? "border-primary bg-primary/10 font-semibold"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Evitar (opcional)">
            <input
              value={avoid}
              onChange={(e) => setAvoid(e.target.value)}
              placeholder="Ej: lactosa, maní, cerdo…"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-base"
            />
          </Field>

          <Button className="w-full" onClick={generate} disabled={generating}>
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Generando…
              </>
            ) : (
              <>
                {plan ? (
                  <RefreshCw className="h-4 w-4" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {plan ? "Generar otro" : "Generar plan con IA"}
              </>
            )}
          </Button>
        </CardContent>
      </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
            <Lock className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-semibold">Plan a tu medida con IA</p>
            <p className="text-xs text-muted-foreground">
              Genera menús personalizados según tus calorías, dieta y presupuesto
              con el <b>plan IA</b>.
            </p>
            <Button asChild size="sm" className="mt-1">
              <Link href="/subscribe">Ver planes</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Plan generado */}
      {plan && total && (
        <>
          <Card className="border-primary/30">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-bold">
                  <ChefHat className="h-4 w-4 text-primary" /> {plan.title}
                </h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Total del día:{" "}
                <b className="text-foreground">{Math.round(total.kcal)} kcal</b> ·{" "}
                <b className="text-foreground">{Math.round(total.protein)} g</b>{" "}
                proteína
              </p>
            </CardContent>
          </Card>

          {plan.meals.map((m, idx) => {
            const mealKcal = m.items.reduce((s, i) => s + i.kcal, 0);
            const mealProt = m.items.reduce((s, i) => s + i.protein, 0);
            return (
              <Card key={idx}>
                <CardContent className="space-y-2 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{m.meal}</p>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(mealKcal)} kcal · {Math.round(mealProt)} g P
                    </span>
                  </div>
                  <ul className="space-y-0.5">
                    {m.items.map((it, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-foreground">
                          {it.name}{" "}
                          <span className="text-muted-foreground">
                            ({Math.round(it.grams)} g)
                          </span>
                        </span>
                        <span className="text-muted-foreground">
                          {Math.round(it.kcal)} kcal
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    size="sm"
                    variant={logged[idx] ? "secondary" : "outline"}
                    className="w-full"
                    onClick={() => logMeal(m, idx)}
                    disabled={loggingIdx === idx || logged[idx]}
                  >
                    {loggingIdx === idx ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : logged[idx] ? (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    ) : null}
                    {logged[idx] ? "Registrado ✓" : "Registrar en mi diario"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}

          {/* Lista de mercado */}
          {plan.shopping_list.length > 0 && (
            <Card>
              <CardContent className="space-y-2 pt-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <ShoppingCart className="h-4 w-4 text-primary" /> Lista de
                  mercado
                </h2>
                <ul className="space-y-1">
                  {plan.shopping_list.map((s, i) => (
                    <li key={i}>
                      <button
                        onClick={() => toggleCheck(s.name)}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-secondary/40"
                      >
                        <span
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                            checked[s.name]
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border",
                          )}
                        >
                          {checked[s.name] && <CheckCircle2 className="h-3 w-3" />}
                        </span>
                        <span
                          className={cn(
                            "flex-1",
                            checked[s.name] &&
                              "text-muted-foreground line-through",
                          )}
                        >
                          {s.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {s.amount}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
