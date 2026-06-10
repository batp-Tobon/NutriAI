import { createClient, getCurrentUser } from "@/infrastructure/supabase/server";
import {
  createMeasurementRepository,
  createProgressRepository,
} from "@/infrastructure/supabase/repositories";
import { Card, CardContent } from "@/components/ui/card";
import { CompositionChart } from "@/components/charts/composition-chart";
import { ProgressDialog } from "@/components/progress/progress-dialog";

export const metadata = { title: "Progreso" };

export default async function ProgressPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const progress = await createProgressRepository(supabase).list(user!.id, 90);
  const latest = await createMeasurementRepository(supabase).latest(user!.id);

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
