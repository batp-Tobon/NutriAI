import Link from "next/link";
import { Sparkles, UtensilsCrossed } from "lucide-react";
import { createClient, getCurrentUser } from "@/infrastructure/supabase/server";
import {
  createMealRepository,
  createProgressRepository,
} from "@/infrastructure/supabase/repositories";
import { sumMacros } from "@/core/application/nutrition";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { MacroRing } from "@/components/dashboard/macro-ring";
import { WeightSparkline } from "@/components/charts/weight-sparkline";
import { SupportBanner } from "@/components/subscription/support-banner";
import { getAccess } from "@/core/application/subscription";
import { env } from "@/lib/env";
import { todayISO } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single();

  const meals = await createMealRepository(supabase).listByDate(
    user!.id,
    todayISO(),
  );
  const progress = await createProgressRepository(supabase).list(user!.id, 30);

  const consumed = sumMacros(
    meals.map((m) => ({
      kcal: m.total_kcal,
      protein: m.total_protein,
      carbs: m.total_carbs,
      fat: m.total_fat,
    })),
  );

  const target = {
    kcal: profile?.daily_calorie_target ?? 2000,
    protein: profile?.daily_protein_target ?? 140,
    carbs: profile?.daily_carbs_target ?? 200,
    fat: profile?.daily_fat_target ?? 60,
  };

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
