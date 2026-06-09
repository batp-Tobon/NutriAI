"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, X } from "lucide-react";
import { env } from "@/lib/env";
import type { AccessState } from "@/core/application/subscription";

export function SupportBanner({
  state,
  daysLeft,
}: {
  state: AccessState;
  daysLeft: number;
}) {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    // Se oculta máximo 1 vez al día
    const today = new Date().toISOString().slice(0, 10);
    setHidden(localStorage.getItem("nutriai-support-dismissed") === today);
  }, []);

  // No molestar a admins ni a quien ya paga
  if (state === "admin" || state === "subscribed" || hidden) return null;

  function dismiss() {
    localStorage.setItem(
      "nutriai-support-dismissed",
      new Date().toISOString().slice(0, 10),
    );
    setHidden(true);
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-primary/10 p-4">
      <button
        onClick={dismiss}
        aria-label="Cerrar"
        className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
          <Heart className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {state === "trial"
              ? `Prueba gratis: ${daysLeft} día(s) restantes`
              : "Apoya el desarrollo de NutriAI"}
          </p>
          <p className="text-xs text-muted-foreground">
            Mantén la app viva por solo{" "}
            <span className="font-semibold text-foreground">
              {env.monthlyPrice || "una mensualidad"}
            </span>
            {env.paymentKey ? (
              <>
                {" "}
                · Bre-B{" "}
                <span className="font-semibold text-foreground">
                  {env.paymentKey}
                </span>
              </>
            ) : null}
          </p>
          <Link
            href="/subscribe"
            className="mt-1 inline-block text-xs font-semibold text-primary"
          >
            Apoyar / ver planes →
          </Link>
        </div>
      </div>
    </div>
  );
}
