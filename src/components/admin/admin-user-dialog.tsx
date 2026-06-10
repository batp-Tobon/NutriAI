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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function dateVal(iso: string | null) {
  return iso ? iso.slice(0, 10) : "";
}

export function AdminUserDialog({
  userId,
  fullName,
  email,
  plan,
  startsAt,
  endsAt,
}: {
  userId: string;
  fullName: string | null;
  email: string | null;
  plan: "general" | "ai";
  startsAt: string | null;
  endsAt: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [name, setName] = useState(fullName ?? "");
  const [mail, setMail] = useState(email ?? "");
  const [planValue, setPlanValue] = useState<"general" | "ai">(plan);
  const [startDate, setStartDate] = useState(dateVal(startsAt));
  const [endDate, setEndDate] = useState(dateVal(endsAt));

  function save() {
    start(async () => {
      const res = await updateUserByAdmin(userId, {
        fullName: name,
        email: mail,
        plan: planValue,
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
          </DialogHeader>

          <div className="space-y-3">
            <Field label="Nombre">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>

            <Field label="Correo">
              <Input
                type="email"
                value={mail}
                onChange={(e) => setMail(e.target.value)}
              />
            </Field>

            <Field label="Plan">
              <Select
                value={planValue}
                onValueChange={(v) => setPlanValue(v as "general" | "ai")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="ai">IA</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Inicio plan">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </Field>
              <Field label="Fin plan">
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </Field>
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
