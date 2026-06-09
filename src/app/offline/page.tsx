import { WifiOff } from "lucide-react";

export const metadata = { title: "Sin conexión" };

export default function OfflinePage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-primary">
        <WifiOff className="h-7 w-7" />
      </div>
      <h1 className="text-xl font-bold">Sin conexión</h1>
      <p className="text-sm text-muted-foreground">
        No tienes conexión a internet. Algunas funciones de NutriAI no están
        disponibles sin conexión. Vuelve a intentarlo cuando te reconectes.
      </p>
    </div>
  );
}
