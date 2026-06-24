"use client";

import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      // Arriba para no tapar el menú inferior. Mínimo 64px garantizado para que
      // SIEMPRE quede debajo de la isla dinámica/notch, y respeta el área segura
      // cuando es mayor (PWA instalada en iPhone con isla).
      position="top-center"
      offset="max(64px, calc(env(safe-area-inset-top, 0px) + 16px))"
      mobileOffset="max(64px, calc(env(safe-area-inset-top, 0px) + 16px))"
      // Se cierran solas en ~2.5 s y se pueden cerrar a mano.
      duration={2500}
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "group rounded-xl border border-border bg-card text-card-foreground shadow-lg",
          description: "text-muted-foreground",
          actionButton: "bg-primary text-primary-foreground",
        },
      }}
      {...props}
    />
  );
}
