"use client";

/**
 * Botón flotante (FAB) del Coach IA, disponible en toda la app.
 *
 * - Es ARRASTRABLE: el usuario puede moverlo a cualquier parte de la pantalla
 *   para que no tape contenido. Al soltarlo se imanta al borde izquierdo o
 *   derecho más cercano y la posición se guarda en localStorage.
 * - Un toque (sin arrastre) abre la hoja de chat inferior.
 * - Respeta el área segura (notch / barra inferior) al limitar su posición.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Lock, X } from "lucide-react";
import { ChatClient } from "@/components/coach/chat-client";
import { Button } from "@/components/ui/button";

type ChatMsg = { role: "user" | "assistant"; content: string };
type Pos = { x: number; y: number };

const STORAGE_KEY = "nutriai-coach-fab";
const SIZE = 56; // diámetro del botón en px
const MARGIN = 16; // separación mínima con los bordes
const TOP_GAP = 72; // alto aproximado del header
const BOTTOM_GAP = 96; // alto aproximado de la barra inferior + safe-area
const DRAG_THRESHOLD = 6; // px para distinguir "tap" de "arrastre"

export function CoachFab({
  aiEnabled,
  initial,
}: {
  aiEnabled: boolean;
  initial: ChatMsg[];
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);

  const dragging = useRef(false);
  const moved = useRef(false);
  const grab = useRef<Pos>({ x: 0, y: 0 }); // offset puntero→esquina del botón
  const startPointer = useRef<Pos>({ x: 0, y: 0 });

  /** Mantiene el botón dentro de los límites visibles (header / nav / bordes). */
  const clamp = useCallback((p: Pos): Pos => {
    const maxX = window.innerWidth - SIZE - MARGIN;
    const maxY = window.innerHeight - SIZE - BOTTOM_GAP;
    return {
      x: Math.min(maxX, Math.max(MARGIN, p.x)),
      y: Math.min(maxY, Math.max(TOP_GAP, p.y)),
    };
  }, []);

  // Posición inicial: la guardada o, por defecto, abajo a la derecha.
  useEffect(() => {
    let saved: Pos | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) saved = JSON.parse(raw) as Pos;
    } catch {
      /* ignore */
    }
    setPos(
      clamp(
        saved ?? {
          x: window.innerWidth - SIZE - MARGIN,
          y: window.innerHeight - SIZE - BOTTOM_GAP - 24,
        },
      ),
    );
  }, [clamp]);

  // Recoloca si cambia el tamaño/orientación de la ventana.
  useEffect(() => {
    const onResize = () => setPos((p) => (p ? clamp(p) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clamp]);

  function onPointerDown(e: React.PointerEvent) {
    if (!pos) return;
    dragging.current = true;
    moved.current = false;
    startPointer.current = { x: e.clientX, y: e.clientY };
    grab.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    if (
      Math.abs(e.clientX - startPointer.current.x) > DRAG_THRESHOLD ||
      Math.abs(e.clientY - startPointer.current.y) > DRAG_THRESHOLD
    ) {
      moved.current = true;
    }
    setPos(clamp({ x: e.clientX - grab.current.x, y: e.clientY - grab.current.y }));
  }

  function onPointerUp() {
    if (!dragging.current) return;
    dragging.current = false;

    if (!moved.current) {
      // Fue un toque, no un arrastre → abrir el chat.
      setOpen(true);
      return;
    }
    // Imantar al borde izquierdo o derecho más cercano y guardar.
    setPos((p) => {
      if (!p) return p;
      const center = p.x + SIZE / 2;
      const snapX =
        center < window.innerWidth / 2 ? MARGIN : window.innerWidth - SIZE - MARGIN;
      const snapped = clamp({ x: snapX, y: p.y });
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapped));
      } catch {
        /* ignore */
      }
      return snapped;
    });
  }

  return (
    <>
      {/* Botón flotante arrastrable */}
      {!open && pos && (
        <button
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          aria-label="Abrir Coach IA (mantén pulsado para mover)"
          style={{ left: pos.x, top: pos.y }}
          className="fixed z-40 flex h-14 w-14 touch-none items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-colors active:scale-95 active:cursor-grabbing cursor-grab"
        >
          <span className="text-2xl">🤖</span>
        </button>
      )}

      {/* Hoja de chat */}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-center">
          <button
            aria-label="Cerrar"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <div
            className="absolute bottom-0 flex h-[88dvh] w-full max-w-md flex-col rounded-t-2xl border border-border bg-background p-4 shadow-2xl animate-fade-in"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
          >
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
    </>
  );
}
