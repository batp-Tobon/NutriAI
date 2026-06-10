import { createClient, getCurrentUser } from "@/infrastructure/supabase/server";
import {
  createMealRepository,
  createMeasurementRepository,
  createProgressRepository,
} from "@/infrastructure/supabase/repositories";
import { Card, CardContent } from "@/components/ui/card";
import { CompositionChart } from "@/components/charts/composition-chart";
import { CaloriesBarChart } from "@/components/charts/calories-bar-chart";
import { ProgressDialog } from "@/components/progress/progress-dialog";
import {
  dayBoundsUTC,
  shiftDateISO,
  toAppDateISO,
  todayISO,
} from "@/lib/utils";

export const metadata = { title: "Progreso" };

export default async function ProgressPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const progress = await createProgressRepository(supabase).list(user!.id, 90);
  const latest = await createMeasurementRepository(supabase).latest(user!.id);

  // Calorías consumidas por día (últimos 7 días locales)
  const today = todayISO();
  const weekDays = Array.from({ length: 7 }, (_, i) =>
    shiftDateISO(today, i - 6),
  );
  const weekMeals = await createMealRepository(supabase).listBetween(
    user!.id,
    dayBoundsUTC(weekDays[0]).from,
    dayBoundsUTC(today).to,
  );
  const kcalByDay = new Map<string, number>(weekDays.map((d) => [d, 0]));
  for (const m of weekMeals) {
    const d = toAppDateISO(m.consumed_at);
    if (kcalByDay.has(d)) kcalByDay.set(d, (kcalByDay.get(d) ?? 0) + m.total_kcal);
  }
  const weekData = weekDays.map((d) => ({
    label: new Date(`${d}T12:00:00`).toLocaleDateString("es", {
      weekday: "short",
    }),
    kcal: kcalByDay.get(d) ?? 0,
  }));

  const { data: prof } = await supabase
    .from("profiles")
    .select("daily_calorie_target")
    .eq("id", user!.id)
    .maybeSingle();

  const chartData = progress.map((p) => ({
    date: p.recorded_at,
    weight: p.weight_kg != null ? Number(p.weight_kg) : null,
    fat: p.body_fat_pct != null ? Number(p.body_fat_pct) : null,
  }));

  const last = progress.at(-1);

  return (
    <div className="space-y-4 py-2">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Composición corporal</h1>
        <ProgressDialog />
      </div>

      <Card>
        <CardContent className="pt-5">
          <div className="mb-4 flex gap-6">
            <Stat
              label="Masa muscular"
              value={last?.muscle_mass_kg != null ? `${Number(last.muscle_mass_kg)} kg` : "—"}
              accent
            />
            <Stat
              label="Grasa corporal"
              value={last?.body_fat_pct != null ? `${Number(last.body_fat_pct)} %` : "—"}
            />
            <Stat
              label="Sueño"
              value={last?.sleep_hours != null ? `${Number(last.sleep_hours)} h` : "—"}
            />
          </div>
          <CompositionChart data={chartData} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">
              Calorías · últimos 7 días
            </h2>
            {prof?.daily_calorie_target && (
              <span className="text-xs text-muted-foreground">
                Meta: {prof.daily_calorie_target} kcal
              </span>
            )}
          </div>
          <CaloriesBarChart
            data={weekData}
            target={prof?.daily_calorie_target}
          />
        </CardContent>
      </Card>

      <h2 className="text-sm font-semibold text-muted-foreground">
        Medidas perimetrales
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <Measure label="Cintura" value={latest?.waist_cm} />
        <Measure label="Brazo" value={latest?.arm_cm} />
        <Measure label="Pecho" value={latest?.chest_cm} />
        <Measure label="Pierna" value={latest?.leg_cm} />
        <Measure label="Cadera" value={latest?.hip_cm} />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${accent ? "text-primary" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function Measure({ label, value }: { label: string; value?: number | null }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">
          {value != null ? `${Number(value)}` : "—"}
          <span className="ml-0.5 text-xs font-normal text-muted-foreground">
            cm
          </span>
        </p>
      </CardContent>
    </Card>
  );
}
