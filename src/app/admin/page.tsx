import { Activity, Dumbbell, UtensilsCrossed, Users } from "lucide-react";
import { createAdminClient } from "@/infrastructure/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { getAccess } from "@/core/application/subscription";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ActivateButton } from "@/components/admin/activate-button";

export const metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

async function count(
  admin: ReturnType<typeof createAdminClient>,
  table: "profiles" | "meals" | "workouts" | "ai_conversations",
): Promise<number> {
  const { count } = await admin
    .from(table)
    .select("*", { count: "exact", head: true });
  return count ?? 0;
}

export default async function AdminPage() {
  if (!isSupabaseConfigured()) {
    return (
      <p className="text-sm text-muted-foreground">
        Configura Supabase para ver las estadísticas.
      </p>
    );
  }

  const admin = createAdminClient();

  const [users, meals, workouts, chats] = await Promise.all([
    count(admin, "profiles"),
    count(admin, "meals"),
    count(admin, "workouts"),
    count(admin, "ai_conversations"),
  ]);

  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const { count: newUsers } = await admin
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .gte("created_at", since);

  const { data: recent } = await admin
    .from("profiles")
    .select("id, email, full_name, role, created_at, trial_ends_at, subscribed_until")
    .order("created_at", { ascending: false })
    .limit(15);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={Users} label="Usuarios" value={users} />
        <Stat icon={UtensilsCrossed} label="Comidas" value={meals} />
        <Stat icon={Dumbbell} label="Rutinas" value={workouts} />
        <Stat icon={Activity} label="Chats IA" value={chats} />
      </div>

      <Card>
        <CardContent className="pt-5">
          <p className="text-sm text-muted-foreground">
            Nuevos usuarios (últimos 7 días)
          </p>
          <p className="text-3xl font-extrabold text-primary">{newUsers ?? 0}</p>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
          Usuarios y suscripciones
        </h2>
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border/60">
                  <th className="p-3">Usuario</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {(recent ?? []).map((u) => {
                  const access = getAccess(u);
                  return (
                    <tr key={u.id} className="border-b border-border/40 last:border-0">
                      <td className="p-3">
                        <p className="font-medium">{u.full_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </td>
                      <td className="p-3">
                        <StatusBadge
                          state={access.state}
                          daysLeft={access.daysLeft}
                        />
                      </td>
                      <td className="p-3 text-right">
                        {access.state !== "admin" && (
                          <ActivateButton userId={u.id} />
                        )}
                      </td>
                    </tr>
                  );
                })}
                {(!recent || recent.length === 0) && (
                  <tr>
                    <td
                      colSpan={3}
                      className="p-6 text-center text-muted-foreground"
                    >
                      Sin usuarios todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatusBadge({
  state,
  daysLeft,
}: {
  state: "admin" | "trial" | "subscribed" | "expired";
  daysLeft: number;
}) {
  if (state === "admin") return <Badge variant="secondary">Admin</Badge>;
  if (state === "subscribed")
    return <Badge>Activo · {daysLeft}d</Badge>;
  if (state === "trial")
    return <Badge variant="secondary">Prueba · {daysLeft}d</Badge>;
  return <Badge variant="destructive">Vencido</Badge>;
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <Icon className="mb-2 h-5 w-5 text-primary" />
        <p className="text-2xl font-extrabold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
