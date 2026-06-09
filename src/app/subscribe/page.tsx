import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { createClient, getCurrentUser } from "@/infrastructure/supabase/server";
import { getAccess } from "@/core/application/subscription";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubscribeActions } from "@/components/subscription/subscribe-actions";
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

  const access = getAccess(profile);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-10">
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

          {/* Datos de pago Nequi */}
          <div className="rounded-2xl bg-secondary/40 p-4 text-left">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Pago por Nequi
            </p>
            <div className="mt-2 space-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">Número Nequi:</span>{" "}
                <span className="font-bold">
                  {env.nequiNumber || "(configura tu número)"}
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">Mensualidad:</span>{" "}
                <span className="font-bold">
                  {env.monthlyPrice || "(configura el precio)"}
                </span>
              </p>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Realiza el pago por Nequi al número indicado y luego envíanos el
              comprobante para activar tu mes. La activación es manual (24 h máx).
            </p>
          </div>

          <SubscribeActions userEmail={user.email} />
        </CardContent>
      </Card>
    </div>
  );
}
