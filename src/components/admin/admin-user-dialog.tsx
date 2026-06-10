"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus, Loader2, Pencil, RotateCcw } from "lucide-react";
import { resetUserData, updateUserByAdmin } from "@/server/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

  const daysLeft = endDate
    ? Math.max(
        0,
        Math.ceil(
          (new Date(`${endDate}T23:59:59`).getTime() - Date.now()) / 86_400_000,
        ),
      )
    : 0;

  function addMonth() {
    const base = startDate ? new Date(`${startDate}T12:00:00`) : new Date();
    base.setDate(base.getDate() + 30);
    if (!startDate) setStartDate(new Date().toISOString().slice(0, 10));
    setEndDate(base.toISOString().slice(0, 10));
  }

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

          <div className="space-y-4">
            <Field label="Nombre">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>

            <Field label="Correo">
              <Input
                type="email"
                inputMode="email"
                value={mail}
                onChange={(e) => setMail(e.target.value)}
              />
            </Field>

            {/* Plan y vigencia */}
            <div className="space-y-3 rounded-2xl border border-border bg-secondary/30 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Plan y vigencia
                </p>
                {daysLeft > 0 && (
                  <Badge variant="secondary">{daysLeft} días restantes</Badge>
                )}
              </div>

              <Field label="Plan">
                <Select
                  value={planValue}
                  onValueChange={(v) => setPlanValue(v as "general" | "ai")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General ($10.000)</SelectItem>
                    <SelectItem value="ai">IA ($20.000)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Inicio">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </Field>
                <Field label="Fin">
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </Field>
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={addMonth}
              >
                <CalendarPlus className="h-4 w-4" /> +1 mes desde{" "}
                {startDate ? "el inicio" : "hoy"}
              </Button>
            </div>

            <Button className="w-full" onClick={save} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar cambios
            </Button>

            <Button
              variant="outline"
              className="w-full text-destructive hover:text-destructive"
              onClick={reset}
              disabled={pending}
            >
              <RotateCcw className="h-4 w-4" /> Reiniciar datos (empezar de 0)
            </Button>
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
