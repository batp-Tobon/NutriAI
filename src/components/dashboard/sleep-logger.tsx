"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Moon } from "lucide-react";
import { logSleep } from "@/server/actions/progress";
import { Button } from "@/components/ui/button";

export function SleepLogger({ current }: { current: number | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [hours, setHours] = useState(current != null ? String(current) : "");

  function save() {
    if (!hours.trim()) {
      toast.error("Escribe las horas de sueño");
      return;
    }
    start(async () => {
      const res = await logSleep(hours);
      if (!res.ok) {
        toast.error(res.error ?? "Error");
        return;
      }
      toast.success("Sueño registrado 😴");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2 border-t border-border/60 pt-3">
      <Moon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">Sueño anoche:</span>
      <input
        type="number"
        step="0.5"
        min="0"
        max="24"
        value={hours}
        onChange={(e) => setHours(e.target.value)}
        placeholder="h"
        className="h-8 w-16 rounded-lg border border-input bg-background px-2 text-center text-sm"
      />
      <span className="text-xs text-muted-foreground">h</span>
      <Button
        size="sm"
        variant="secondary"
        className="ml-auto h-8"
        onClick={save}
        disabled={pending}
      >
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        Guardar
      </Button>
    </div>
  );
}
