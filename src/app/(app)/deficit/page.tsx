import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Dumbbell,
  Flame,
  Info,
  Scale,
  TrendingDown,
  TrendingUp,
  UtensilsCrossed,
} from "lucide-react";
import { createClient, getCurrentUser } from "@/infrastructure/supabase/server";
import { createMealRepository } from "@/infrastructure/supabase/repositories";
import { calcDeficit, caloriesBurned } from "@/core/application/nutrition";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { GOAL_LABELS } from "@/lib/constants";
import {
  dayBoundsUTC,
  shiftDateISO,
  toAppDateISO,
  todayISO,
} from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { WorkoutType } from "@/types/database";

export const metadata = { title: "Déficit" };

export default async function DeficitPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single();

  const today = todayISO();
  const weekAgo = shiftDateISO(today, -6);

  // Comidas y entrenamientos de los últimos 7 días (para hoy + tendencia)
  const mealsWeek = await createMealRepository(supabase).listBetween(
    user!.id,
    dayBoundsUTC(weekAgo).from,
    dayBoundsUTC(today).to,
  );
  const { data: workoutsWeek } = await supabase
    .from("workouts")
    .select("workout_type, duration_min, completed_at")
    .eq("user_id", user!.id)
    .not("completed_at", "is", null)
    .gte("completed_at", dayBoundsUTC(weekAgo).from)
    .lte("completed_at", dayBoundsUTC(today).to);

  // Agrupar consumo y gasto por día local
  const weightKg = profile?.current_weight_kg ?? null;
  const consumedByDay = new Map<string, number>();
  for (const m of mealsWeek) {
    const d = toAppDateISO(m.consumed_at);
    consumedByDay.set(d, (consumedByDay.get(d) ?? 0) + (m.total_kcal ?? 0));
  }
  const burnedByDay = new Map<string, number>();
  for (const w of workoutsWeek ?? []) {
    if (!w.completed_at) continue;
    const d = toAppDateISO(w.completed_at);
    const k = caloriesBurned(
      w.workout_type as WorkoutType,
      w.duration_min,
      weightKg,
    );
    burnedByDay.set(d, (burnedByDay.get(d) ?? 0) + k);
  }

  // ¿Perfil completo para calcular el metabolismo?
  const ready =
    profile?.sex != null &&
    profile?.age != null &&
    profile?.height_cm != null &&
    weightKg != null &&
    weightKg > 0 &&
    profile?.activity_level != null;

  if (!ready) {
    return (
      <div className="space-y-5 py-2">
        <Header />
        <Card className="border-primary/30">
          <CardContent className="space-y-3 p-5 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Scale className="h-7 w-7" />
            </div>
            <h2 className="text-base font-bold">Completa tu perfil</h2>
            <p className="text-sm text-muted-foreground">
              Para calcular tu déficit necesito tu <b>sexo, edad, estatura,
              peso</b> y <b>nivel de actividad</b>. Con eso estimo tu
              metabolismo y cuánto gastas al día.
            </p>
            <Button asChild className="w-full">
              <Link href="/profile">
                Ir a mi perfil <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const goal = profile.goal ?? "maintain";
  const rep = calcDeficit({
    sex: profile.sex!,
    age: profile.age!,
    heightCm: profile.height_cm!,
    weightKg: weightKg!,
    activityLevel: profile.activity_level!,
    goal,
    consumedKcal: consumedByDay.get(today) ?? 0,
    exerciseKcal: burnedByDay.get(today) ?? 0,
    targetKcal: profile.daily_calorie_target,
  });

  // Barras de la "balanza": consumido vs gasto total
  const maxBar = Math.max(rep.consumed, rep.expenditure, 1);
  const consumedW = Math.round((rep.consumed / maxBar) * 100);
  const expW = Math.round((rep.expenditure / maxBar) * 100);

  // Tendencia 7 días (balance neto por día)
  const trend = Array.from({ length: 7 }, (_, i) => {
    const d = shiftDateISO(today, -(6 - i));
    const consumed = consumedByDay.get(d) ?? 0;
    const burned = burnedByDay.get(d) ?? 0;
    const expenditure = rep.tdee + burned;
    return {
      date: d,
      balance: Math.round(consumed - expenditure),
      hasData: consumed > 0 || burned > 0,
    };
  });

  // Progreso hacia el déficit objetivo (solo si la meta es perder grasa)
  const towardGoal =
    rep.targetDeficit > 0
      ? Math.min(100, Math.round((rep.deficit / rep.targetDeficit) * 100))
      : 0;

  return (
    <div className="space-y-4 py-2 pb-6">
      <Header />

      {/* HERO: balance del día */}
      <Card
        className={cn(
          "overflow-hidden",
          rep.inDeficit ? "border-emerald-500/40" : "border-amber-500/40",
        )}
      >
        <CardContent className="p-5 text-center">
          <div
            className={cn(
              "mx-auto flex h-14 w-14 items-center justify-center rounded-full",
              rep.inDeficit
                ? "bg-emerald-500/15 text-emerald-500"
                : "bg-amber-500/15 text-amber-500",
            )}
          >
            {rep.inDeficit ? (
              <TrendingDown className="h-7 w-7" />
            ) : (
              <TrendingUp className="h-7 w-7" />
            )}
          </div>
          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {rep.inDeficit ? "Vas en déficit" : "Vas en superávit"}
          </p>
          <p
            className={cn(
              "text-4xl font-extrabold tabular-nums",
              rep.inDeficit ? "text-emerald-500" : "text-amber-500",
            )}
          >
            {rep.balance > 0 ? "+" : ""}
            {rep.balance} <span className="text-lg font-bold">kcal</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {rep.inDeficit
              ? `Gastas ${rep.deficit} kcal más de lo que comes hoy`
              : `Comes ${Math.abs(rep.balance)} kcal más de lo que gastas hoy`}
          </p>

          {/* Balanza visual */}
          <div className="mt-4 space-y-2 text-left">
            <Bar
              label="Consumido"
              icon={<UtensilsCrossed className="h-3.5 w-3.5" />}
              value={rep.consumed}
              width={consumedW}
              tone="food"
            />
            <Bar
              label="Gasto total"
              icon={<Flame className="h-3.5 w-3.5" />}
              value={rep.expenditure}
              width={expW}
              tone="burn"
            />
          </div>
        </CardContent>
      </Card>

      {/* DESGLOSE: de dónde sale cada número */}
      <Card>
        <CardContent className="p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Info className="h-4 w-4 text-primary" /> Cómo se calcula
          </h2>
          <div className="space-y-2.5 text-sm">
            <Row
              icon={<Activity className="h-4 w-4" />}
              label="Metabolismo basal"
              hint="lo que gastas en reposo (Mifflin-St Jeor)"
              value={`${rep.bmr} kcal`}
            />
            <Row
              icon={<Scale className="h-4 w-4" />}
              label="Mantenimiento (TDEE)"
              hint="basal × tu nivel de actividad"
              value={`${rep.tdee} kcal`}
            />
            <Row
              icon={<Dumbbell className="h-4 w-4" />}
              label="Ejercicio de hoy"
              hint="entrenamientos registrados"
              value={`+${rep.exercise} kcal`}
              tone="burn"
            />
            <div className="my-1 border-t border-border/60" />
            <Row
              icon={<Flame className="h-4 w-4" />}
              label="Gasto total del día"
              value={`${rep.expenditure} kcal`}
              bold
            />
            <Row
              icon={<UtensilsCrossed className="h-4 w-4" />}
              label="Consumido"
              value={`− ${rep.consumed} kcal`}
              tone="food"
            />
            <div className="my-1 border-t border-border/60" />
            <Row
              icon={
                rep.inDeficit ? (
                  <TrendingDown className="h-4 w-4" />
                ) : (
                  <TrendingUp className="h-4 w-4" />
                )
              }
              label="Balance"
              value={`${rep.balance > 0 ? "+" : ""}${rep.balance} kcal`}
              bold
              tone={rep.inDeficit ? "good" : "warn"}
            />
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Llevas el <b>{rep.pctOfMaintenance}%</b> de tu mantenimiento
            consumido hoy.
          </p>
        </CardContent>
      </Card>

      {/* META: déficit recomendado según objetivo */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Tu meta</h2>
            <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">
              {GOAL_LABELS[goal]}
            </span>
          </div>

          {goal === "lose_fat" ? (
            <>
              <p className="mt-2 text-sm text-muted-foreground">
                Para perder grasa te recomiendo comer ~
                <b className="text-foreground">{rep.targetKcal} kcal</b> (déficit
                de <b className="text-foreground">{rep.targetDeficit} kcal/día</b>
                ).
              </p>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>Déficit de hoy: {rep.deficit} kcal</span>
                <span>Meta: {rep.targetDeficit} kcal</span>
              </div>
              <Progress value={towardGoal} className="mt-1.5 h-2.5" />
              <p className="mt-2 text-xs text-muted-foreground">
                {rep.deficit >= rep.targetDeficit
                  ? "✅ Vas en el déficit recomendado. ¡Bien!"
                  : rep.inDeficit
                    ? "Vas en déficit, pero aún por debajo de tu meta del día."
                    : "Hoy todavía no estás en déficit; ajusta porciones o suma ejercicio."}
              </p>
            </>
          ) : goal === "gain_muscle" ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Tu meta es ganar músculo: buscas un ligero <b>superávit</b>. Ingesta
              recomendada ~<b className="text-foreground">{rep.targetKcal} kcal</b>
              . {rep.consumed < rep.targetKcal
                ? `Te faltan ${rep.targetKcal - rep.consumed} kcal para tu meta.`
                : "Ya alcanzaste tu meta de hoy."}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Tu meta es mantener: busca un balance cercano a <b>0</b>. Ingesta
              recomendada ~<b className="text-foreground">{rep.targetKcal} kcal</b>
              .
            </p>
          )}
        </CardContent>
      </Card>

      {/* PROYECCIÓN */}
      <Card>
        <CardContent className="p-4">
          <h2 className="mb-1 text-sm font-semibold">Si mantienes este ritmo</h2>
          <p className="text-xs text-muted-foreground">
            1 kg de grasa ≈ 7.700 kcal
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Projection label="En 1 semana" kg={rep.weeklyKg} />
            <Projection label="En 1 mes" kg={rep.monthlyKg} />
          </div>
        </CardContent>
      </Card>

      {/* TENDENCIA 7 DÍAS */}
      <Card>
        <CardContent className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Últimos 7 días</h2>
          <TrendBars data={trend} />
          <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Déficit
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> Superávit
            </span>
          </div>
        </CardContent>
      </Card>

      <p className="px-1 text-center text-[11px] leading-relaxed text-muted-foreground">
        Son estimaciones basadas en fórmulas estándar (Mifflin-St Jeor). El gasto
        real varía; úsalo como guía y ajusta según tus resultados.
      </p>
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
        <TrendingDown className="h-5 w-5" />
      </div>
      <div>
        <h1 className="text-xl font-bold leading-none">Déficit calórico</h1>
        <p className="text-xs text-muted-foreground">Tu balance de energía hoy</p>
      </div>
    </div>
  );
}

function Bar({
  label,
  icon,
  value,
  width,
  tone,
}: {
  label: string;
  icon: React.ReactNode;
  value: number;
  width: number;
  tone: "food" | "burn";
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          {icon} {label}
        </span>
        <span className="font-semibold tabular-nums">{value} kcal</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            "h-full rounded-full",
            tone === "food" ? "bg-sky-500" : "bg-orange-500",
          )}
          style={{ width: `${Math.max(2, width)}%` }}
        />
      </div>
    </div>
  );
}

function Row({
  icon,
  label,
  hint,
  value,
  bold,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  value: string;
  bold?: boolean;
  tone?: "food" | "burn" | "good" | "warn";
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-500"
      : tone === "warn"
        ? "text-amber-500"
        : tone === "burn"
          ? "text-orange-500"
          : tone === "food"
            ? "text-sky-500"
            : "";
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <div className="min-w-0">
          <p className={cn("truncate", bold && "font-semibold")}>{label}</p>
          {hint && (
            <p className="truncate text-[11px] text-muted-foreground">{hint}</p>
          )}
        </div>
      </div>
      <span
        className={cn(
          "shrink-0 tabular-nums",
          bold ? "font-bold" : "font-medium",
          toneClass,
        )}
      >
        {value}
      </span>
    </div>
  );
}

function Projection({ label, kg }: { label: string; kg: number }) {
  const losing = kg < 0;
  const gaining = kg > 0;
  return (
    <div className="rounded-xl border border-border bg-secondary/40 p-3 text-center">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-xl font-extrabold tabular-nums",
          losing
            ? "text-emerald-500"
            : gaining
              ? "text-amber-500"
              : "text-foreground",
        )}
      >
        {kg > 0 ? "+" : ""}
        {kg} kg
      </p>
      <p className="text-[11px] text-muted-foreground">
        {losing ? "perderías" : gaining ? "ganarías" : "te mantienes"}
      </p>
    </div>
  );
}

function TrendBars({
  data,
}: {
  data: { date: string; balance: number; hasData: boolean }[];
}) {
  const max = Math.max(1, ...data.map((d) => Math.abs(d.balance)));
  const dayLabel = (iso: string) =>
    ["D", "L", "M", "M", "J", "V", "S"][new Date(`${iso}T12:00:00`).getDay()];

  return (
    <div className="flex items-end justify-between gap-1.5">
      {data.map((d) => {
        const h = Math.round((Math.abs(d.balance) / max) * 56) + 4;
        const deficit = d.balance < 0;
        return (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-[68px] w-full items-end justify-center">
              {d.hasData ? (
                <div
                  className={cn(
                    "w-full max-w-[24px] rounded-md",
                    deficit ? "bg-emerald-500" : "bg-amber-500",
                  )}
                  style={{ height: `${h}px` }}
                  title={`${d.balance > 0 ? "+" : ""}${d.balance} kcal`}
                />
              ) : (
                <div className="h-1 w-full max-w-[24px] rounded-md bg-border" />
              )}
            </div>
            <span className="text-[10px] text-muted-foreground">
              {dayLabel(d.date)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
