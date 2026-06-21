import Link from "next/link";
import { Lock } from "lucide-react";
import { getCurrentProfile } from "@/infrastructure/supabase/server";
import { getUserAccess } from "@/server/access";
import { MealPlanClient } from "@/components/meal-plan/meal-plan-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Plan de comidas" };

export default async function MealPlanPage() {
  const [profile, { access }] = await Promise.all([
    getCurrentProfile(),
    getUserAccess(),
  ]);

  const targetKcal = profile?.daily_calorie_target ?? 2000;
  const proteinTarget =
    profile?.daily_protein_target ??
    (profile?.current_weight_kg
      ? Math.round(Number(profile.current_weight_kg) * 2)
      : 130);

  return (
    <div className="space-y-4 py-2">
      <div>
        <h1 className="text-xl font-bold">Plan de comidas</h1>
        <p className="text-xs text-muted-foreground">
          La IA arma tu menú del día y la lista de mercado
        </p>
      </div>

      {access.aiEnabled ? (
        <MealPlanClient
          defaultKcal={Math.round(targetKcal)}
          defaultProtein={proteinTarget}
        />
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
            <Lock className="h-7 w-7 text-muted-foreground" />
            <p className="text-sm font-semibold">Función del plan IA</p>
            <p className="text-xs text-muted-foreground">
              El generador de plan de comidas está disponible en el plan IA.
            </p>
            <Button asChild size="sm" className="mt-1">
              <Link href="/subscribe">Ver planes</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
