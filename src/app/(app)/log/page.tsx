import { createClient, getCurrentUser } from "@/infrastructure/supabase/server";
import { createMealRepository } from "@/infrastructure/supabase/repositories";
import { getUserAccess } from "@/server/access";
import { LogClient } from "@/components/log/log-client";
import { MealCard } from "@/components/meals/meal-card";
import { todayISO } from "@/lib/utils";

export const metadata = { title: "Registrar" };

export default async function LogPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { access } = await getUserAccess();
  const meals = await createMealRepository(supabase).listByDate(
    user!.id,
    todayISO(),
  );

  return (
    <div className="space-y-5 py-2">
      <h1 className="text-xl font-bold">Registrar comida</h1>
      <LogClient aiEnabled={access.aiEnabled} />

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Comidas de hoy ({meals.length})
        </h2>
        {meals.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Aún no has registrado comidas hoy.
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
