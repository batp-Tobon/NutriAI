import { getCurrentProfile } from "@/infrastructure/supabase/server";
import { getUserAccess } from "@/server/access";
import { MealPlanClient } from "@/components/meal-plan/meal-plan-client";

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
          Elige un plan base o genera uno a tu medida con IA
        </p>
      </div>

      <MealPlanClient
        defaultKcal={Math.round(targetKcal)}
        defaultProtein={proteinTarget}
        aiEnabled={access.aiEnabled}
      />
    </div>
  );
}
