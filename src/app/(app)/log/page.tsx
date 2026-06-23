import Link from "next/link";
import { ChefHat, ChevronRight } from "lucide-react";
import { createClient, getCurrentUser } from "@/infrastructure/supabase/server";
import { createMealRepository } from "@/infrastructure/supabase/repositories";
import { getUserAccess } from "@/server/access";
import { sumMacros } from "@/core/application/nutrition";
import { LogClient } from "@/components/log/log-client";
import { DayNav } from "@/components/log/day-nav";
import { MealCard } from "@/components/meals/meal-card";
import { Card, CardContent } from "@/components/ui/card";
import { todayISO } from "@/lib/utils";

export const metadata = { title: "Comidas" };

export default async function LogPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: qd } = await searchParams;
  const today = todayISO();
  const date =
    qd && /^\d{4}-\d{2}-\d{2}$/.test(qd) && qd <= today ? qd : today;
  const isToday = date === today;

  const user = await getCurrentUser();
  const supabase = await createClient();
  const { access } = await getUserAccess();
  const meals = await createMealRepository(supabase).listByDate(user!.id, date);

  const totals = sumMacros(
    meals.map((m) => ({
      kcal: m.total_kcal,
      protein: m.total_protein,
      carbs: m.total_carbs,
      fat: m.total_fat,
    })),
  );

  return (
    <div className="space-y-5 py-2">
      <h1 className="text-xl font-bold">
        {isToday ? "Registrar comida" : "Historial de comidas"}
      </h1>

      <DayNav date={date} today={today} />

      {isToday && (
        <Link
          href="/meal-plan"
          className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-3 transition-colors hover:border-primary/60"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <ChefHat className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight">
              Plan de comidas con IA
            </p>
            <p className="text-xs text-muted-foreground">
              Genera tu menú del día y la lista de mercado
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      )}

      {!isToday && (
        <p className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-center text-xs text-muted-foreground">
          Registrando para un <b className="text-foreground">día anterior</b>. Si
          te faltó alguna comida, agrégala aquí.
        </p>
      )}

      <LogClient aiEnabled={access.aiEnabled} date={date} today={today} />

      {/* Resumen del día */}
      {meals.length > 0 && (
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-2xl font-extrabold leading-none">
                {Math.round(totals.kcal)}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  kcal
                </span>
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Total del día
              </p>
            </div>
            <div className="flex gap-3 text-center text-xs">
              <Macro label="Prot" value={totals.protein} />
              <Macro label="Carb" value={totals.carbs} />
              <Macro label="Grasa" value={totals.fat} />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          {isToday ? "Comidas de hoy" : "Comidas del día"} ({meals.length})
        </h2>
        {meals.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {isToday
              ? "Aún no has registrado comidas hoy."
              : "No registraste comidas este día."}
          </p>
        ) : (
          <div className="space-y-2">
            {meals.map((m) => (
              <MealCard key={m.id} meal={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Macro({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="font-bold text-primary">{Math.round(value)}g</p>
      <p className="text-muted-foreground">{label}</p>
    </div>
  );
}
