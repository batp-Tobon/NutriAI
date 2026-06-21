/** Skeleton instantáneo del panel admin mientras cargan las consultas. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-secondary/50" />
        ))}
      </div>
      <div className="h-24 animate-pulse rounded-2xl bg-secondary/50" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-28 animate-pulse rounded-2xl bg-secondary/50" />
        <div className="h-28 animate-pulse rounded-2xl bg-secondary/50" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-secondary/50" />
        ))}
      </div>
    </div>
  );
}
