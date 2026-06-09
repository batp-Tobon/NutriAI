import { Activity, Dumbbell, UtensilsCrossed, Users } from "lucide-react";
import { createAdminClient } from "@/infrastructure/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { getAccess } from "@/core/application/subscription";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ActivateButton } from "@/components/admin/activate-button";
import { DeleteUserButton } from "@/components/admin/delete-user-button";

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

  // select("*") es robusto: si aún no aplicaste las migraciones de planes,
  // la lista sigue mostrando los usuarios (las columnas nuevas llegan vacías).
  const { data: recent } = await admin
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

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
                  <th className="p-3">Vigencia</th>
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
                          plan={access.plan}
                          daysLeft={access.daysLeft}
                        />
                      </td>
                      <td className="p-3">
                        <PeriodCell
                          state={access.state}
                          startsAt={u.subscription_started_at}
                          endsAt={u.subscribed_until}
                          trialEndsAt={u.trial_ends_at}
                        />
                      </td>
                      <td className="p-3">
                        {access.state !== "admin" && (
                          <div className="flex items-center justify-end gap-1.5">
                            <ActivateButton
                              userId={u.id}
                              plan="general"
                              label="General"
                            />
                            <ActivateButton userId={u.id} plan="ai" label="IA" />
                            <DeleteUserButton userId={u.id} email={u.email} />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {(!recent || recent.length === 0) && (
                  <tr>
                    <td
                      colSpan={4}
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
  plan,
  daysLeft,
}: {
  state: "admin" | "trial" | "subscribed" | "expired";
  plan: "general" | "ai";
  daysLeft: number;
}) {
  if (state === "admin") return <Badge variant="secondary">Admin</Badge>;
  if (state === "subscribed")
    return (
      <Badge>
        Activo {plan === "ai" ? "IA" : "Gen"} · {daysLeft}d
      </Badge>
    );
  if (state === "trial")
    return <Badge variant="secondary">Prueba · {daysLeft}d</Badge>;
  return <Badge variant="destructive">Vencido</Badge>;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function PeriodCell({
  state,
  startsAt,
  endsAt,
  trialEndsAt,
}: {
  state: "admin" | "trial" | "subscribed" | "expired";
  startsAt: string | null;
  endsAt: string | null;
  trialEndsAt: string | null;
}) {
  if (state === "admin") {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  if (state === "trial") {
    return (
      <span className="text-xs text-muted-foreground">
        Prueba hasta {fmtDate(trialEndsAt)}
      </span>
    );
  }
  if (state === "subscribed") {
    return (
      <div className="text-xs leading-tight text-muted-foreground">
        <p>
          Inicio: <span className="text-foreground">{fmtDate(startsAt)}</span>
        </p>
        <p>
          Fin: <span className="text-foreground">{fmtDate(endsAt)}</span>
        </p>
      </div>
    );
  }
  return (
    <span className="text-xs text-muted-foreground">
      {endsAt ? `Venció ${fmtDate(endsAt)}` : "—"}
    </span>
  );
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
