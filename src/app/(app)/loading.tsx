/**
 * Skeleton que se muestra al instante mientras carga cada pantalla (mejora la
 * velocidad PERCIBIDA: el usuario ve estructura en vez de una pantalla en blanco).
 */
export default function Loading() {
  return (
    <div className="space-y-4 py-2" aria-hidden>
      <div className="h-7 w-40 animate-pulse rounded-lg bg-secondary/60" />
      <div className="h-44 animate-pulse rounded-2xl bg-secondary/50" />
      <div className="grid grid-cols-3 gap-3">
        <div className="h-20 animate-pulse rounded-2xl bg-secondary/50" />
        <div className="h-20 animate-pulse rounded-2xl bg-secondary/50" />
        <div className="h-20 animate-pulse rounded-2xl bg-secondary/50" />
      </div>
      <div className="h-32 animate-pulse rounded-2xl bg-secondary/50" />
      <div className="h-24 animate-pulse rounded-2xl bg-secondary/50" />
    </div>
  );
}
