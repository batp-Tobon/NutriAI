"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock, MessageCircle, X } from "lucide-react";
import { ChatClient } from "@/components/coach/chat-client";
import { Button } from "@/components/ui/button";

type ChatMsg = { role: "user" | "assistant"; content: string };

export function CoachFab({
  aiEnabled,
  initial,
}: {
  aiEnabled: boolean;
  initial: ChatMsg[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Botón flotante (sobre la barra inferior, dentro de la columna) */}
      {!open && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 mx-auto w-full max-w-md px-4">
          <div className="flex justify-end">
            <button
              onClick={() => setOpen(true)}
              aria-label="Abrir Coach IA"
              className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-95"
            >
              <span className="relative text-2xl">🤖</span>
            </button>
          </div>
        </div>
      )}

      {/* Panel del chat (hoja inferior) */}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-center">
          {/* Fondo */}
          <button
            aria-label="Cerrar"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          {/* Hoja */}
          <div className="absolute bottom-0 flex h-[88dvh] w-full max-w-md flex-col rounded-t-2xl border border-border bg-background p-4 shadow-2xl animate-fade-in">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <span className="text-lg">🤖</span>
                </div>
                <div>
                  <h2 className="text-base font-bold leading-none">
                    NutriAI Coach
                  </h2>
                  <span className="text-xs text-primary">● Online</span>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="rounded-full border border-border p-2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {aiEnabled ? (
              <ChatClient initial={initial} className="min-h-0 flex-1" />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                  <Lock className="h-7 w-7" />
                </div>
                <p className="max-w-xs text-sm text-muted-foreground">
                  El chat con el Coach inteligente está en el <b>plan IA</b>.
                </p>
                <Button asChild onClick={() => setOpen(false)}>
                  <Link href="/subscribe">Ver planes</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Acceso accesible alternativo (oculto visualmente) */}
      <span className="sr-only">
        <MessageCircle className="h-0 w-0" />
      </span>
    </>
  );
}
