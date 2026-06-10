import Link from "next/link";
import { Flame, ShieldCheck, Sparkles, UtensilsCrossed } from "lucide-react";
import { createClient, getCurrentUser } from "@/infrastructure/supabase/server";
import {
  createMealRepository,
  createProgressRepository,
} from "@/infrastructure/supabase/repositories";
import { caloriesBurned, sumMacros } from "@/core/application/nutrition";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { MacroRing } from "@/components/dashboard/macro-ring";
import { SleepLogger } from "@/components/dashboard/sleep-logger";
import { WaterCard } from "@/components/dashboard/water-card";
import { InsightsCard } from "@/components/dashboard/insights-card";
import { WeightSparkline } from "@/components/charts/weight-sparkline";
import { SupportBanner } from "@/components/subscription/support-banner";
import { getAccess } from "@/core/application/subscription";
import { dailyInsights, waterGoalMl } from "@/core/application/insights";
import { env } from "@/lib/env";
import { dayBoundsUTC, todayISO } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single();

  const today = todayISO();
  const meals = await createMealRepository(supabase).listByDate(user!.id, today);
  const progress = await createProgressRepository(supabase).list(user!.id, 30);

  // Entrenamientos completados hoy (día local) → calorías gastadas
  const bounds = dayBoundsUTC(today);
  const { data: doneWorkouts } = await supabase
    .from("workouts")
    .select("workout_type, duration_min")
    .eq("user_id", user!.id)
    .not("completed_at", "is", null)
    .gte("completed_at", bounds.from)
    .lte("completed_at", bounds.to);

  const consumed = sumMacros(
    meals.map((m) => ({
      kcal: m.total_kcal,
      protein: m.total_protein,
      carbs: m.total_carbs,
      fat: m.total_fat,
    })),
  );

  const burned = (doneWorkouts ?? []).reduce(
    (s, w) =>
      s + caloriesBurned(w.workout_type, w.duration_min, profile?.current_weight_kg ?? null),
    0,
  );
  const net = Math.round(consumed.kcal - burned);

  const target = {
    kcal: profile?.daily_calorie_target ?? 2000,
    protein: profile?.daily_protein_target ?? 140,
    carbs: profile?.daily_carbs_target ?? 200,
    fat: profile?.daily_fat_target ?? 60,
  };

  const todayProgress = progress.find((p) => p.recorded_at === today);
  const sleepLast =
    todayProgress?.sleep_hours ?? progress.at(-1)?.sleep_hours ?? null;
  const waterMl = todayProgress?.water_ml ?? 0;
  const wGoal = waterGoalMl(profile?.current_weight_kg ?? null);

  const tips = dailyInsights({
    goal: profile?.goal ?? null,
    consumedKcal: consumed.kcal,
    targetKcal: target.kcal,
    burned,
    proteinConsumed: consumed.protein,
    proteinTarget: target.protein,
    sleepHours: sleepLast != null ? Number(sleepLast) : null,
    waterMl,
    waterGoalMl: wGoal,
    hour: new Date().getHours(),
    mealsCount: meals.length,
  });

  const weight =
    profile?.current_weight_kg ??
    progress.at(-1)?.weight_kg ??
    null;

  const weightData = progress
    .filter((p) => p.weight_kg != null)
    .map((p) => ({ date: p.recorded_at, weight: Number(p.weight_kg) }));

  const isAdmin = env.adminEmails.includes((user!.email ?? "").toLowerCase());
  const access = getAccess(profile, isAdmin);

  return (
    <div className="space-y-4 animate-fade-in">
      <SupportBanner state={access.state} daysLeft={access.daysLeft} />

      {isAdmin && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center gap-3 pt-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-tight">
                Panel de administración
              </p>
              <p className="text-xs text-muted-foreground">
                Activa y gestiona las suscripciones de tus usuarios.
              </p>
            </div>
            <Button asChild size="sm">
              <Link href="/admin">Abrir</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Nutrición diaria */}
      <Card className="bg-gradient-to-b from-card to-secondary/20">
        <CardContent className="pt-5">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
            Nutrición de hoy
          </h2>
          <MacroRing consumed={consumed.kcal} target={target.kcal} />
          <div className="mt-5 grid grid-cols-3 gap-3">
            <MacroStat
              label="Proteína"
              consumed={consumed.protein}
              target={target.protein}
            />
            <MacroStat
              label="Carbs"
              consumed={consumed.carbs}
              target={target.carbs}
            />
            <MacroStat label="Grasa" consumed={consumed.fat} target={target.fat} />
          </div>
        </CardContent>
      </Card>

      {/* Balance del día */}
      <Card>
        <CardContent className="pt-5">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
            Balance de hoy
          </h2>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="flex items-center justify-center gap-1 text-xl font-extrabold">
                <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
                {Math.round(consumed.kcal)}
              </p>
              <p className="text-[11px] text-muted-foreground">Consumido</p>
            </div>
            <div>
              <p className="flex items-center justify-center gap-1 text-xl font-extrabold text-primary">
                <Flame className="h-4 w-4" />-{burned}
              </p>
              <p className="text-[11px] text-muted-foreground">Ejercicio</p>
            </div>
            <div>
              <p className="text-xl font-extrabold">{net}</p>
              <p className="text-[11px] text-muted-foreground">Neto (kcal)</p>
            </div>
          </div>
          <SleepLogger current={sleepLast != null ? Number(sleepLast) : null} />
        </CardContent>
      </Card>

      {/* Hidratación */}
      <WaterCard current={waterMl} goal={wGoal} />

      {/* Recomendaciones del día */}
      <InsightsCard tips={tips} />

      {/* Peso actual */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-muted-foreground">
              Peso actual
            </span>
            <Link href="/progress" className="text-xs text-primary">
              Ver progreso
            </Link>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-3xl font-extrabold">
              {weight ? Number(weight).toFixed(1) : "--"}
            </span>
            <span className="text-sm text-muted-foreground">kg</span>
          </div>
          <div className="mt-2">
            <WeightSparkline data={weightData} />
          </div>
        </CardContent>
      </Card>

      {/* Recomendación IA */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-5">
          <Badge className="mb-2 gap-1">
            <Sparkles className="h-3 w-3" /> Recomendación IA
          </Badge>
          <h3 className="font-semibold">Tu coach personal</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Pregúntale a NutriAI Coach cómo ajustar tus comidas y entrenamientos
            según tu objetivo de hoy.
          </p>
          <Button asChild className="mt-3 w-full">
            <Link href="/coach">Hablar con el Coach</Link>
          </Button>
        </CardContent>
      </Card>

      <Button asChild variant="secondary" className="w-full">
        <Link href="/log">
          <UtensilsCrossed className="h-4 w-4" /> Registrar comida
        </Link>
      </Button>
    </div>
  );
}

function MacroStat({
  label,
  consumed,
  target,
}: {
  label: string;
  consumed: number;
  target: number;
}) {
  const pct = target > 0 ? Math.min((consumed / target) * 100, 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="text-sm font-bold">
        {Math.round(consumed)}
        <span className="text-xs font-normal text-muted-foreground">
          /{Math.round(target)}g
        </span>
      </div>
      <Progress value={pct} className="h-1.5" />
    </div>
  );
}
