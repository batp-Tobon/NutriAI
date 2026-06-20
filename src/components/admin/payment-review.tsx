"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Check, Loader2, X } from "lucide-react";
import { confirmPayment, rejectPayment } from "@/server/actions/admin";
import { Button } from "@/components/ui/button";

/** Confirmar (activa el mes) o rechazar un pago pendiente. */
export function PaymentReview({ paymentId }: { paymentId: string }) {
  const [pending, start] = useTransition();

  function onConfirm() {
    start(async () => {
      const res = await confirmPayment(paymentId);
      toast[res.ok ? "success" : "error"](
        res.ok ? "Pago confirmado y mes activado ✓" : res.error ?? "Error",
      );
    });
  }

  function onReject() {
    if (!confirm("¿Rechazar este pago? El usuario seguirá sin activarse.")) return;
    start(async () => {
      const res = await rejectPayment(paymentId);
      toast[res.ok ? "success" : "error"](
        res.ok ? "Pago rechazado" : res.error ?? "Error",
      );
    });
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" className="flex-1" onClick={onConfirm} disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Confirmar
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={onReject}
        disabled={pending}
        className="text-destructive"
      >
        <X className="h-4 w-4" /> Rechazar
      </Button>
    </div>
  );
}
