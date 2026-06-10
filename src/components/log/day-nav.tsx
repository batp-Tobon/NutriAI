import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { shiftDateISO } from "@/lib/utils";

function label(date: string, today: string): string {
  if (date === today) return "Hoy";
  if (date === shiftDateISO(today, -1)) return "Ayer";
  return new Date(`${date}T12:00:00`).toLocaleDateString("es", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

/** Navegador de días para revisar el historial (← fecha →). */
export function DayNav({ date, today }: { date: string; today: string }) {
  const prev = shiftDateISO(date, -1);
  const next = shiftDateISO(date, 1);
  const hasNext = date < today;

  return (
    <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card p-1">
      <Link
        href={`/log?date=${prev}`}
        aria-label="Día anterior"
        className="rounded-xl p-2.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <ChevronLeft className="h-5 w-5" />
      </Link>
      <span className="text-sm font-semibold capitalize">
        {label(date, today)}
      </span>
      {hasNext ? (
        <Link
          href={`/log?date=${next}`}
          aria-label="Día siguiente"
          className="rounded-xl p-2.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <ChevronRight className="h-5 w-5" />
        </Link>
      ) : (
        <span className="p-2.5 text-muted-foreground/30">
          <ChevronRight className="h-5 w-5" />
        </span>
      )}
    </div>
  );
}
