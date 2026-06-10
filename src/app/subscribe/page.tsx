import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, Sparkles } from "lucide-react";
import { createClient, getCurrentUser } from "@/infrastructure/supabase/server";
import { getAccess } from "@/core/application/subscription";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubscribeActions } from "@/components/subscription/subscribe-actions";
import { PaymentQR } from "@/components/subscription/payment-qr";
import { env } from "@/lib/env";

export const metadata = { title: "Suscripción" };

export default async function SubscribePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = env.adminEmails.includes((user.email ?? "").toLowerCase());
  const access = getAccess(profile, isAdmin);

  return (
    <div
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 2.5rem)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 2.5rem)",
      }}
    >
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">
          Nutri<span className="text-primary">AI</span>
        </h1>
      </div>

      <Card className="border-primary/30">
        <CardContent className="space-y-5 pt-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Sparkles className="h-7 w-7" />
          </div>

          {access.hasAccess ? (
            <>
              <h2 className="text-xl font-bold">
                {access.state === "trial"
                  ? `Tu prueba gratuita: ${access.daysLeft} día(s) restantes`
                  : "Tu suscripción está activa"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {access.state === "trial"
                  ? "Disfruta NutriAI. Cuando termine la prueba, apóyanos con la mensualidad para seguir usándola."
                  : `Acceso activo por ${access.daysLeft} día(s) más. ¡Gracias por tu apoyo! 💚`}
              </p>
              <Button asChild className="w-full">
                <Link href="/dashboard">Ir a la app</Link>
              </Button>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold">Tu prueba gratuita terminó</h2>
              <p className="text-sm text-muted-foreground">
                Apoya el desarrollo de NutriAI con una mensualidad y sigue
                controlando tu nutrición y entrenamientos. 💪
              </p>
            </>
          )}

          {/* Planes */}
          <div className="grid gap-3 text-left">
            <PlanCard
              name="General"
              price={env.priceGeneral}
              features={[
                "Registro de comidas manual",
                "Constructor de rutinas + semana base",
                "Peso, medidas y progreso",
              ]}
            />
            <PlanCard
              name="IA"
              highlight
              price={env.priceAi}
              features={[
                "Todo lo del plan General",
                "Análisis de comida por foto (IA)",
                "Coach IA + generador de rutinas",
              ]}
            />
          </div>

          {/* Pago Bre-B */}
          <div className="rounded-2xl bg-secondary/40 p-4 text-left">
            <p className="text-center text-xs font-semibold uppercase tracking-wide text-primary">
              Pago por Bre-B (Nequi / Bancolombia)
            </p>
            <div className="my-3">
              <PaymentQR />
            </div>
            <p className="text-sm">
              <span className="text-muted-foreground">Llave Bre-B:</span>{" "}
              <span className="font-bold">
                {env.paymentKey || "(configura tu llave)"}
              </span>
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Paga a la llave el plan que quieras y envíanos el comprobante
              (indica el plan elegido) para activarlo. Activación manual (24 h
              máx).
              {env.adminEmails[0] && (
                <>
                  {" "}
                  Contacto:{" "}
                  <span className="text-foreground">{env.adminEmails[0]}</span>.
                </>
              )}
            </p>
          </div>

          <SubscribeActions userEmail={user.email} />
        </CardContent>
      </Card>
    </div>
  );
}

function PlanCard({
  name,
  price,
  features,
  highlight,
}: {
  name: string;
  price: string;
  features: string[];
  highlight?: boolean;
}) {
  return (
    <div
      className={
        highlight
          ? "rounded-2xl border border-primary/40 bg-primary/5 p-4"
          : "rounded-2xl border border-border bg-card p-4"
      }
    >
      <div className="flex items-baseline justify-between">
        <p className="font-bold">
          Plan {name}
          {highlight && <span className="ml-1 text-primary">★</span>}
        </p>
        <p className="text-lg font-extrabold">
          {price || "—"}
          <span className="text-xs font-normal text-muted-foreground">/mes</span>
        </p>
      </div>
      <ul className="mt-2 space-y-1">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}
