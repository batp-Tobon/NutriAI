"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CreditCard, Loader2 } from "lucide-react";
import { setGymPaymentDay } from "@/server/actions/profile";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function GymReminder({ currentDay }: { currentDay: number | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [value, setValue] = useState(currentDay ? String(currentDay) : "off");

  function save() {
    start(async () => {
      const day = value === "off" ? null : Number(value);
      const res = await setGymPaymentDay(day);
      if (!res.ok) {
        toast.error(res.error ?? "Error");
        return;
      }
      toast.success(
        day ? `Recordatorio activado: día ${day} 💳` : "Recordatorio desactivado",
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="off">Sin recordatorio</SelectItem>
            {Array.from({ length: 31 }, (_, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>
                Cada día {i + 1} del mes
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={save} disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CreditCard className="h-4 w-4" />
          )}
          Guardar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Te avisaremos 2 días antes y el mismo día del pago (en la app y por
        notificación push si las tienes activadas). 🔔
      </p>
    </div>
  );
}
