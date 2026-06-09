"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, Loader2 } from "lucide-react";
import { loadBaseWeek } from "@/server/actions/workouts";
import { Button } from "@/components/ui/button";

export function LoadBaseWeekButton() {
  const router = useRouter();
  const [pending, start] = useTransition();

  function load() {
    start(async () => {
      const res = await loadBaseWeek();
      if (!res.ok) {
        toast.error(res.error ?? "Error");
        return;
      }
      toast.success(`Semana base cargada (${res.count} rutinas) 💪`);
      router.refresh();
    });
  }

  return (
    <Button
      variant="secondary"
      className="mt-2 w-full"
      onClick={load}
      disabled={pending}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <CalendarDays className="h-4 w-4" />
      )}
      Cargar semana base recomendada
    </Button>
  );
}
