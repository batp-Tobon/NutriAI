"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil, RotateCcw } from "lucide-react";
import { resetUserData, updateUserByAdmin } from "@/server/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function dateVal(iso: string | null) {
  return iso ? iso.slice(0, 10) : "";
}

export function AdminUserDialog({
  userId,
  fullName,
  startsAt,
  endsAt,
  email,
}: {
  userId: string;
  fullName: string | null;
  startsAt: string | null;
  endsAt: string | null;
  email: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [name, setName] = useState(fullName ?? "");
  const [startDate, setStartDate] = useState(dateVal(startsAt));
  const [endDate, setEndDate] = useState(dateVal(endsAt));

  function save() {
    start(async () => {
      const res = await updateUserByAdmin(userId, {
        fullName: name,
        startsAt: startDate || null,
        endsAt: endDate || null,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Error");
        return;
      }
      toast.success("Usuario actualizado");
      setOpen(false);
      router.refresh();
    });
  }

  function reset() {
    if (
      !window.confirm(
        `¿Reiniciar TODOS los datos de ${email ?? "este usuario"}? (comidas, rutinas, progreso). La cuenta se mantiene.`,
      )
    )
      return;
    start(async () => {
      const res = await resetUserData(userId);
      if (!res.ok) {
        toast.error(res.error ?? "Error");
        return;
      }
      toast.success("Datos reiniciados");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Editar usuario"
        className="rounded-lg p-2 text-muted-foreground transition-colors hover:text-primary"
      >
        <Pencil className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
            <DialogDescription>{email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input value={name} onChange={(ev) => setName(ev.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Inicio plan</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(ev) => setStartDate(ev.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Fin plan</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(ev) => setEndDate(ev.target.value)}
                />
              </div>
            </div>
            <Button className="w-full" onClick={save} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar cambios
            </Button>
            <div className="border-t border-border/60 pt-3">
              <Button
                variant="outline"
                className="w-full text-destructive"
                onClick={reset}
                disabled={pending}
              >
                <RotateCcw className="h-4 w-4" /> Reiniciar datos (empezar de 0)
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
