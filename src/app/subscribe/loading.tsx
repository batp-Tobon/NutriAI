/** Skeleton instantáneo de la pantalla de suscripción. */
export default function Loading() {
  return (
    <div
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-6"
      aria-hidden
    >
      <div className="mx-auto h-8 w-28 animate-pulse rounded-lg bg-secondary/60" />
      <div className="h-[28rem] animate-pulse rounded-2xl bg-secondary/50" />
    </div>
  );
}
