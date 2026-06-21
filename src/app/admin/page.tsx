import {
  Activity,
  Clock,
  Dumbbell,
  DollarSign,
  Sparkles,
  TrendingUp,
  UtensilsCrossed,
  Users,
} from "lucide-react";
import { createAdminClient } from "@/infrastructure/supabase/admin";
import { env, isSupabaseConfigured } from "@/lib/env";
import { getAccess } from "@/core/application/subscription";
import { PLAN_PRICE_COP } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ActivateButton } from "@/components/admin/activate-button";
import { DeleteUserButton } from "@/components/admin/delete-user-button";
import { AdminUserDialog } from "@/components/admin/admin-user-dialog";
import { PaymentReview } from "@/components/admin/payment-review";

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

  // Consumo por usuario (comidas registradas en los últimos 30 días): una sola
  // consulta para evitar N+1; se agrupa en memoria.
  const since30 = new Date(Date.now() - 30 * 864e5).toISOString();
  const { data: recentMeals } = await admin
    .from("meals")
    .select("user_id, consumed_at")
    .gte("consumed_at", since30);

  const mealStats = new Map<string, { count: number; last: string }>();
  for (const m of recentMeals ?? []) {
    const cur = mealStats.get(m.user_id);
    if (!cur) mealStats.set(m.user_id, { count: 1, last: m.consumed_at });
    else {
      cur.count += 1;
      if (m.consumed_at > cur.last) cur.last = m.consumed_at;
    }
  }

  // ---- Ingresos / SaaS (defensivo: si no existe la tabla `payments`, queda en 0)
  const nowISO = new Date().toISOString();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartISO = monthStart.toISOString();

  const { data: payRows, error: payErr } = await admin
    .from("payments")
    .select(
      "id, amount, plan, status, method, created_at, user_email, reference, proof_url",
    )
    .order("created_at", { ascending: false });
  const payments = payErr ? [] : (payRows ?? []);
  const confirmed = payments.filter((p) => p.status === "confirmed");
  const pendingPayments = payments.filter((p) => p.status === "pending");
  const sum = (rows: { amount: number }[]) =>
    rows.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  // Los ingresos sólo cuentan pagos CONFIRMADOS.
  const monthIncome = sum(confirmed.filter((p) => p.created_at >= monthStartISO));
  const totalIncome = sum(confirmed);
  const recentPayments = confirmed.slice(0, 12);

  // Enlaces firmados (1 h) para ver los comprobantes pendientes.
  const proofLinks = new Map<string, string>();
  for (const p of pendingPayments) {
    if (!p.proof_url) continue;
    const { data: signed } = await admin.storage
      .from("payment-proofs")
      .createSignedUrl(p.proof_url, 3600);
    if (signed?.signedUrl) proofLinks.set(p.id, signed.signedUrl);
  }

  // Suscriptores pagos activos por plan (para MRR estimado)
  const [{ count: activeAi }, { count: activeGeneral }] = await Promise.all([
    admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gt("subscribed_until", nowISO)
      .eq("plan", "ai"),
    admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gt("subscribed_until", nowISO)
      .eq("plan", "general"),
  ]);
  const mrr =
    (activeGeneral ?? 0) * PLAN_PRICE_COP.general +
    (activeAi ?? 0) * PLAN_PRICE_COP.ai;

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

      {/* Pagos por confirmar */}
      {pendingPayments.length > 0 && (
        <div>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-500">
            <Clock className="h-4 w-4" /> Pagos por confirmar (
            {pendingPayments.length})
          </h2>
          <div className="space-y-2">
            {pendingPayments.map((p) => (
              <Card key={p.id} className="border-amber-500/40">
                <CardContent className="space-y-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {p.user_email ?? "—"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {fmtDate(p.created_at)} ·{" "}
                        {p.plan === "ai" ? "Plan IA" : "Plan General"}
                        {p.reference ? ` · Ref: ${p.reference}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 font-bold text-primary">
                      {cop(Number(p.amount ?? 0))}
                    </span>
                  </div>
                  {proofLinks.get(p.id) ? (
                    <a
                      href={proofLinks.get(p.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-xs font-medium text-primary underline"
                    >
                      Ver comprobante →
                    </a>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Sin comprobante adjunto (verifica por tu cuenta).
                    </p>
                  )}
                  <PaymentReview paymentId={p.id} />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Ingresos / SaaS */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
          Ingresos
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="pt-5">
              <DollarSign className="mb-2 h-5 w-5 text-primary" />
              <p className="text-2xl font-extrabold">{cop(monthIncome)}</p>
              <p className="text-xs text-muted-foreground">Este mes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <TrendingUp className="mb-2 h-5 w-5 text-primary" />
              <p className="text-2xl font-extrabold">{cop(mrr)}</p>
              <p className="text-xs text-muted-foreground">
                MRR estimado · {activeGeneral ?? 0} Gen / {activeAi ?? 0} IA
              </p>
            </CardContent>
          </Card>
        </div>
        <p className="mt-2 px-1 text-xs text-muted-foreground">
          Ingresos totales registrados: <b>{cop(totalIncome)}</b>
          {payErr && " · (corre la migración 0014 para registrar pagos)"}
        </p>

        {recentPayments.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <h3 className="text-xs font-semibold text-muted-foreground">
              Pagos recientes
            </h3>
            {recentPayments.map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 rounded-lg bg-secondary/40 px-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="truncate">{p.user_email ?? "—"}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {fmtDate(p.created_at)} · {p.plan === "ai" ? "IA" : "General"}{" "}
                    · {methodLabel(p.method)}
                  </p>
                </div>
                <span className="shrink-0 font-bold text-primary">
                  {cop(Number(p.amount ?? 0))}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
          Usuarios y suscripciones
        </h2>
        <div className="space-y-2">
          {(recent ?? []).map((u) => {
            const access = getAccess(u);
            return (
              <Card key={u.id}>
                <CardContent className="space-y-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {u.full_name ?? "—"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {u.email}
                      </p>
                    </div>
                    <StatusBadge
                      state={access.state}
                      plan={access.plan}
                      daysLeft={access.daysLeft}
                    />
                  </div>

                  <PeriodCell
                    state={access.state}
                    startsAt={u.subscription_started_at}
                    endsAt={u.subscribed_until}
                    trialEndsAt={u.trial_ends_at}
                  />

                  <ConsumptionCell
                    meals={mealStats.get(u.id)}
                    aiUses={u.ai_uses ?? 0}
                    aiEnabled={access.aiEnabled}
                  />

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {access.state !== "admin" && (
                      <>
                        <ActivateButton
                          userId={u.id}
                          plan="general"
                          label="General"
                        />
                        <ActivateButton userId={u.id} plan="ai" label="IA" />
                      </>
                    )}
                    <div className="ml-auto flex items-center gap-1">
                      <AdminUserDialog
                        userId={u.id}
                        fullName={u.full_name}
                        email={u.email}
                        plan={u.plan ?? "general"}
                        startsAt={u.subscription_started_at}
                        endsAt={u.subscribed_until}
                      />
                      {access.state !== "admin" && (
                        <DeleteUserButton userId={u.id} email={u.email} />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {(!recent || recent.length === 0) && (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Sin usuarios todavía.
            </p>
          )}
        </div>
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

/** Etiqueta legible del método de pago. */
function methodLabel(method: string | null): string {
  if (method === "wompi") return "En línea (Wompi)";
  if (method === "bre-b") return "Manual (Bre-B)";
  return method ?? "—";
}

/** Formatea un monto en pesos colombianos (sin decimales). */
function cop(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
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
      <p className="text-xs text-muted-foreground">
        Inicio <span className="text-foreground">{fmtDate(startsAt)}</span> · Fin{" "}
        <span className="text-foreground">{fmtDate(endsAt)}</span>
      </p>
    );
  }
  return (
    <span className="text-xs text-muted-foreground">
      {endsAt ? `Venció ${fmtDate(endsAt)}` : "—"}
    </span>
  );
}

function ConsumptionCell({
  meals,
  aiUses,
  aiEnabled,
}: {
  meals?: { count: number; last: string };
  aiUses: number;
  aiEnabled: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-secondary/40 px-2.5 py-1.5 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1">
        <UtensilsCrossed className="h-3 w-3" />
        <b className="text-foreground">{meals?.count ?? 0}</b> comidas (30d)
      </span>
      {meals?.last && (
        <span>· última {fmtDate(meals.last)}</span>
      )}
      {aiEnabled && (
        <span className="flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-primary" /> IA{" "}
          <b className="text-foreground">{aiUses}</b>/{env.aiMonthlyLimit}
        </span>
      )}
    </div>
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
