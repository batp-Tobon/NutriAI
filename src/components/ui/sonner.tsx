"use client";

import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      // Arriba (debajo del notch/isla) para no tapar el menú inferior.
      position="top-center"
      offset="calc(env(safe-area-inset-top, 0px) + 12px)"
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
