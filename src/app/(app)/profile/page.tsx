import { createClient, getCurrentUser } from "@/infrastructure/supabase/server";
import { ProfileForm } from "@/components/profile/profile-form";
import { Card, CardContent } from "@/components/ui/card";
import { GOAL_LABELS } from "@/lib/constants";

export const metadata = { title: "Perfil" };

export default async function ProfilePage() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single();

  return (
    <div className="space-y-5 py-2">
      <h1 className="text-xl font-bold">Perfil</h1>

      <Card>
        <CardContent className="grid grid-cols-4 gap-2 pt-5 text-center">
          <Target label="Kcal" value={profile?.daily_calorie_target} />
          <Target label="Prot" value={profile?.daily_protein_target} unit="g" />
          <Target label="Carb" value={profile?.daily_carbs_target} unit="g" />
          <Target label="Grasa" value={profile?.daily_fat_target} unit="g" />
        </CardContent>
      </Card>

      {profile?.goal && (
        <p className="text-sm text-muted-foreground">
          Objetivo actual:{" "}
          <span className="font-semibold text-foreground">
            {GOAL_LABELS[profile.goal]}
          </span>
        </p>
      )}

      <Card>
        <CardContent className="pt-5">
          <h2 className="mb-4 text-sm font-semibold text-muted-foreground">
            Editar datos
          </h2>
          <ProfileForm profile={profile} mode="edit" />
        </CardContent>
      </Card>
    </div>
  );
}

function Target({
  label,
  value,
  unit,
}: {
  label: string;
  value?: number | null;
  unit?: string;
}) {
  return (
    <div>
      <p className="text-lg font-bold text-primary">
        {value ?? "—"}
        {value != null && unit ? (
          <span className="text-xs text-muted-foreground">{unit}</span>
        ) : null}
      </p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
