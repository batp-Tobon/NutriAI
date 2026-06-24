"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { dismissWelcome } from "@/server/actions/account";
import { Button } from "@/components/ui/button";

/**
 * Tarjeta de bienvenida que aparece UNA SOLA VEZ cuando se aprueba un pago
 * (manual o Wompi) y la suscripción queda activa. Se descarta en el servidor
 * (welcome_seen_at) y, como respaldo, en localStorage por periodo.
 */
export function WelcomeSubscription({
  show,
  daysLeft,
  plan,
  startedAt,
}: {
  show: boolean;
  daysLeft: number;
  plan: "general" | "ai";
  startedAt: string | null;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!show) return;
    try {
      const key = `nutriai-welcome-${startedAt ?? ""}`;
      if (localStorage.getItem(key)) return; // ya la vio en este equipo
    } catch {
      /* ignore */
    }
    setOpen(true);
  }, [show, startedAt]);

  function close() {
    try {
      localStorage.setItem(`nutriai-welcome-${startedAt ?? ""}`, "1");
    } catch {
      /* ignore */
    }
    void dismissWelcome();
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-primary/40 bg-card p-6 text-center shadow-2xl glow-primary animate-fade-in">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Sparkles className="h-8 w-8" />
        </div>
        <h2 className="mt-3 text-xl font-extrabold">¡Suscripción activa! 🎉</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu pago fue aprobado. Disfruta tu{" "}
          <b className="text-foreground">
            plan {plan === "ai" ? "IA" : "General"}
          </b>{" "}
          por <b className="text-foreground">{daysLeft} días</b> con todo NutriAI.
          ¡A darle! 💪
        </p>
        <Button className="mt-4 w-full" onClick={close}>
          ¡Empezar!
        </Button>
      </div>
    </div>
  );
}
