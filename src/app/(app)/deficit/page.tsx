import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Droplet,
  Dumbbell,
  Flame,
  Info,
  Moon,
  Scale,
  TrendingDown,
  TrendingUp,
  UtensilsCrossed,
  Beef,
} from "lucide-react";
import { createClient, getCurrentUser } from "@/infrastructure/supabase/server";
import {
  createMealRepository,
  createProgressRepository,
} from "@/infrastructure/supabase/repositories";
import {
  calcDeficit,
  caloriesBurned,
  energyStatus,
  proteinStatus,
  sleepStatus,
  type StatusLevel,
} from "@/core/application/nutrition";
import { waterGoalMl } from "@/core/application/insights";
import { GoalSelector } from "@/components/dashboard/goal-selector";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

  const mealsWeek = await createMealRepository(supabase).listBetween(
    user!.id,
    dayBoundsUTC(weekAgo).from,
    dayBoundsUTC(today).to,
  );
  const progressWeek = await createProgressRepository(supabase).list(
    user!.id,
    14,
  );
  const { data: workoutsWeek } = await supabase
    .from("workouts")
    .select("workout_type, duration_min, completed_at")
    .eq("user_id", user!.id)
    .not("completed_at", "is", null)
    .gte("completed_at", dayBoundsUTC(weekAgo).from)
    .lte("completed_at", dayBoundsUTC(today).to);

  const weightKg = profile?.current_weight_kg ?? null;

  // Consumo (kcal + macros) por día local
  const consumedByDay = new Map<
    string,
    { kcal: number; protein: number; carbs: number; fat: number }
  >();
  for (const m of mealsWeek) {
    const d = toAppDateISO(m.consumed_at);
    const cur = consumedByDay.get(d) ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    cur.kcal += m.total_kcal ?? 0;
    cur.protein += m.total_protein ?? 0;
    cur.carbs += m.total_carbs ?? 0;
    cur.fat += m.total_fat ?? 0;
    consumedByDay.set(d, cur);
  }
  const burnedByDay = new Map<string, number>();
  const trainedDays = new Set<string>();
  for (const w of workoutsWeek ?? []) {
    if (!w.completed_at) continue;
    const d = toAppDateISO(w.completed_at);
    trainedDays.add(d);
    burnedByDay.set(
      d,
      (burnedByDay.get(d) ?? 0) +
        caloriesBurned(w.workout_type as WorkoutType, w.duration_min, weightKg),
    );
  }

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
  const todayConsumed = consumedByDay.get(today) ?? {
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  };
  const rep = calcDeficit({
    sex: profile.sex!,
    age: profile.age!,
    heightCm: profile.height_cm!,
    weightKg: weightKg!,
    activityLevel: profile.activity_level!,
    goal,
    consumedKcal: todayConsumed.kcal,
    exerciseKcal: burnedByDay.get(today) ?? 0,
    targetKcal: profile.daily_calorie_target,
  });

  // Objetivos de macros (perfil o fallback)
  const kcalTarget = profile.daily_calorie_target ?? rep.targetKcal;
  const proteinTarget = profile.daily_protein_target ?? Math.round(weightKg! * 2);
  const carbsTarget = profile.daily_carbs_target ?? null;
  const fatTarget = profile.daily_fat_target ?? null;

  // Agua y sueño de hoy (sueño: 8 h por defecto si no se registró)
  const todayProgress = progressWeek.find((p) => p.recorded_at === today);
  const waterMl = todayProgress?.water_ml ?? 0;
  const waterGoal = waterGoalMl(weightKg);
  const sleepRaw = todayProgress?.sleep_hours ?? null;
  const sleepEstimated = sleepRaw == null;
  const sleepHours = sleepRaw != null ? Number(sleepRaw) : 8;

  // Estados (recomposición)
  const energy = energyStatus(rep);
  const protein = proteinStatus(todayConsumed.protein, weightKg!);
  const sleep = sleepStatus(sleepHours);
  const trainedToday = trainedDays.has(today);
  const trainingDaysWeek = trainedDays.size;

  // Balanza visual
  const maxBar = Math.max(rep.consumed, rep.expenditure, 1);
  const consumedW = Math.round((rep.consumed / maxBar) * 100);
  const expW = Math.round((rep.expenditure / maxBar) * 100);

  // Tendencia 7 días
  const trend = Array.from({ length: 7 }, (_, i) => {
    const d = shiftDateISO(today, -(6 - i));
    const consumed = consumedByDay.get(d)?.kcal ?? 0;
    const burned = burnedByDay.get(d) ?? 0;
    return {
      date: d,
      balance: Math.round(consumed - (rep.tdee + burned)),
      hasData: consumed > 0 || burned > 0,
    };
  });

  // Recomendaciones dinámicas para bajar grasa hoy
  const recs: string[] = [];
  if (todayConsumed.protein < proteinTarget)
    recs.push(
      `Te faltan ${Math.round(proteinTarget - todayConsumed.protein)} g de proteína. Suma pollo, huevo, atún, yogur griego o claras.`,
    );
  if (rep.balance > 150)
    recs.push(
      `Hoy vas +${rep.balance} kcal (superávit). Aligera la cena o suma una caminata para volver a déficit.`,
    );
  if (energy.level === "bad")
    recs.push(
      "Tu déficit es muy agresivo: comer tan poco puede costarte músculo. Sube un poco las calorías con proteína.",
    );
  if (!trainedToday)
    recs.push(
      "Entrena fuerza hoy: es lo que conserva (y gana) músculo mientras pierdes grasa.",
    );
  if (waterMl < waterGoal)
    recs.push(
      `Bebe ${waterGoal - waterMl} ml más de agua; ayuda a controlar el hambre.`,
    );
  if (sleepHours < 7 && !sleepEstimated)
    recs.push("Dormir menos de 7 h frena la pérdida de grasa y la recuperación.");

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
          <p className="mt-1 text-sm text-muted-foreground">{energy.message}</p>

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

      {/* OBJETIVO */}
      <Card>
        <CardContent className="p-4">
          <GoalSelector current={goal} />
        </CardContent>
      </Card>

      {/* ¿CÓMO VAS HOY? — comida, proteína, agua, sueño, entreno */}
      <Card>
        <CardContent className="p-4">
          <h2 className="mb-3 text-sm font-semibold">¿Cómo vas hoy?</h2>
          <div className="space-y-3">
            <MetricBar
              icon={<UtensilsCrossed className="h-4 w-4" />}
              label="Calorías"
              value={Math.round(todayConsumed.kcal)}
              target={Math.round(kcalTarget)}
              unit="kcal"
              over={todayConsumed.kcal > kcalTarget}
            />
            <MetricBar
              icon={<Beef className="h-4 w-4" />}
              label="Proteína"
              sub={`${protein.perKg} g/kg · ${protein.message}`}
              value={Math.round(todayConsumed.protein)}
              target={proteinTarget}
              unit="g"
              tone={protein.level}
              highlight
            />
            {carbsTarget != null && (
              <MetricBar
                icon={<Activity className="h-4 w-4" />}
                label="Carbohidratos"
                value={Math.round(todayConsumed.carbs)}
                target={carbsTarget}
                unit="g"
              />
            )}
            {fatTarget != null && (
              <MetricBar
                icon={<Activity className="h-4 w-4" />}
                label="Grasas"
                value={Math.round(todayConsumed.fat)}
                target={fatTarget}
                unit="g"
              />
            )}
            <MetricBar
              icon={<Droplet className="h-4 w-4" />}
              label="Agua"
              value={waterMl}
              target={waterGoal}
              unit="ml"
            />
            <StatusRow
              icon={<Moon className="h-4 w-4" />}
              label="Sueño"
              level={sleep.level}
              value={`${sleepHours} h${sleepEstimated ? " (est.)" : ""}`}
              sub={sleepEstimated ? "Registra tus horas reales" : sleep.message}
            />
            <StatusRow
              icon={<Dumbbell className="h-4 w-4" />}
              label="Entrenamiento"
              level={trainedToday ? "good" : "warn"}
              value={trainedToday ? "Hecho ✓" : "Pendiente"}
              sub={`${trainingDaysWeek} día(s) esta semana`}
            />
          </div>
        </CardContent>
      </Card>

      {/* RECOMPOSICIÓN: los 4 pilares */}
      <Card className="border-primary/25">
        <CardContent className="p-4">
          <h2 className="text-sm font-semibold">
            Recomposición: perder grasa + ganar músculo
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            No es solo comer menos. Para lograr ambas cosas a la vez necesitas:
          </p>
          <ul className="mt-2 space-y-1.5 text-xs">
            <Pillar ok={energy.level !== "bad" && rep.balance <= 150}>
              <b>Déficit moderado</b> (ni pasarte ni quedarte muy corto)
            </Pillar>
            <Pillar ok={protein.level === "good"}>
              <b>Proteína alta</b> (~2 g/kg): {Math.round(todayConsumed.protein)}/
              {proteinTarget} g hoy
            </Pillar>
            <Pillar ok={trainingDaysWeek >= 3}>
              <b>Fuerza 3–5 días/semana</b>: {trainingDaysWeek} esta semana
            </Pillar>
            <Pillar ok={sleep.level === "good"}>
              <b>Dormir 7–9 h</b> para recuperar y rendir
            </Pillar>
          </ul>
        </CardContent>
      </Card>

      {/* DESGLOSE del cálculo */}
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
            Meta «{GOAL_LABELS[goal]}». Para <b>recomponer</b> (grasa↓ músculo↑)
            apunta a ~<b className="text-foreground">{rep.recompKcal} kcal</b>:
            déficit <b>suave</b> de {rep.recompDeficit} kcal/día que conserva
            músculo.
          </p>
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

      {/* RECOMENDACIONES PARA BAJAR GRASA */}
      <Card>
        <CardContent className="p-4">
          <h2 className="mb-2 text-sm font-semibold">
            Recomendaciones para bajar grasa
          </h2>
          {recs.length > 0 && (
            <ul className="mb-3 space-y-1.5">
              {recs.map((r, i) => (
                <li
                  key={i}
                  className="flex gap-2 rounded-lg bg-primary/10 p-2 text-xs text-foreground"
                >
                  <span className="text-primary">→</span>
                  {r}
                </li>
              ))}
            </ul>
          )}
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            {[
              "Llena medio plato de vegetales: sacian con muy pocas calorías.",
              "Proteína en cada comida: conserva músculo y reduce el hambre.",
              "Evita calorías líquidas (gaseosa, jugos, alcohol).",
              "Prefiere a la plancha/horno en vez de frito.",
              "Toma agua antes de comer; a veces es sed, no hambre.",
              "Cuida las porciones de la noche y cocina tú cuando puedas.",
            ].map((t, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-emerald-500">•</span>
                {t}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <p className="px-1 text-center text-[11px] leading-relaxed text-muted-foreground">
        Estimaciones con fórmulas estándar (Mifflin-St Jeor). El gasto real varía;
        úsalo como guía y ajusta según tus resultados.
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
        <p className="text-xs text-muted-foreground">
          Grasa abajo, músculo arriba
        </p>
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

const TONE_BAR: Record<StatusLevel, string> = {
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  bad: "bg-red-500",
};
const TONE_TEXT: Record<StatusLevel, string> = {
  good: "text-emerald-500",
  warn: "text-amber-500",
  bad: "text-red-500",
};

function MetricBar({
  icon,
  label,
  sub,
  value,
  target,
  unit,
  over,
  tone,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  value: number;
  target: number;
  unit: string;
  over?: boolean;
  tone?: StatusLevel;
  highlight?: boolean;
}) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  const reached = value >= target;
  const barColor = over
    ? "bg-amber-500"
    : tone
      ? TONE_BAR[tone]
      : reached
        ? "bg-emerald-500"
        : "bg-primary";
  const remaining = Math.max(0, target - value);
  return (
    <div className={cn(highlight && "rounded-xl bg-primary/5 p-2 -mx-2")}>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5">
          <span className="text-muted-foreground">{icon}</span>
          <span className="font-medium">{label}</span>
        </span>
        <span className="tabular-nums text-muted-foreground">
          <b className="text-foreground">{value}</b> / {target} {unit}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn("h-full rounded-full", barColor)}
          style={{ width: `${Math.max(2, pct)}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {sub
          ? sub
          : over
            ? `Te pasaste ${value - target} ${unit}`
            : reached
              ? "Meta alcanzada ✓"
              : `Faltan ${remaining} ${unit}`}
      </p>
    </div>
  );
}

function StatusRow({
  icon,
  label,
  level,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  level: StatusLevel;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", TONE_BAR[level])} />
        <span className="text-muted-foreground">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          {sub && (
            <p className="truncate text-[11px] text-muted-foreground">{sub}</p>
          )}
        </div>
      </div>
      <span className={cn("shrink-0 text-sm font-semibold", TONE_TEXT[level])}>
        {value}
      </span>
    </div>
  );
}

function Pillar({
  ok,
  children,
}: {
  ok: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2">
      <span
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
          ok
            ? "bg-emerald-500/20 text-emerald-500"
            : "bg-muted text-muted-foreground",
        )}
      >
        {ok ? "✓" : "•"}
      </span>
      <span className="text-muted-foreground">{children}</span>
    </li>
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
