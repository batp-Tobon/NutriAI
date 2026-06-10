"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { addMeasurement, addProgress } from "@/server/actions/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ProgressDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const [weight, setWeight] = useState({
    weight_kg: "",
    body_fat_pct: "",
    muscle_mass_kg: "",
    sleep_hours: "",
  });
  const [meas, setMeas] = useState({ waist_cm: "", chest_cm: "", arm_cm: "", leg_cm: "", hip_cm: "" });

  function saveWeight() {
    start(async () => {
      const res = await addProgress(weight);
      if (!res.ok) {
        toast.error(res.error ?? "Error");
        return;
      }
      toast.success("Registro guardado");
      setOpen(false);
      router.refresh();
    });
  }

  function saveMeas() {
    start(async () => {
      const res = await addMeasurement(meas);
      if (!res.ok) {
        toast.error(res.error ?? "Error");
        return;
      }
      toast.success("Medidas guardadas");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> Añadir
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo registro</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="weight">
          <TabsList className="w-full">
            <TabsTrigger value="weight" className="flex-1">
              Peso
            </TabsTrigger>
            <TabsTrigger value="meas" className="flex-1">
              Medidas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="weight" className="space-y-3">
            <NumField label="Peso (kg)" value={weight.weight_kg}
              onChange={(v) => setWeight((s) => ({ ...s, weight_kg: v }))} />
            <NumField label="Grasa corporal (%)" value={weight.body_fat_pct}
              onChange={(v) => setWeight((s) => ({ ...s, body_fat_pct: v }))} />
            <NumField label="Masa muscular (kg)" value={weight.muscle_mass_kg}
              onChange={(v) => setWeight((s) => ({ ...s, muscle_mass_kg: v }))} />
            <NumField label="Horas de sueño (anoche)" value={weight.sleep_hours}
              onChange={(v) => setWeight((s) => ({ ...s, sleep_hours: v }))} />
            <Button className="w-full" onClick={saveWeight} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
            </Button>
          </TabsContent>

          <TabsContent value="meas" className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <NumField label="Cintura (cm)" value={meas.waist_cm}
                onChange={(v) => setMeas((s) => ({ ...s, waist_cm: v }))} />
              <NumField label="Pecho (cm)" value={meas.chest_cm}
                onChange={(v) => setMeas((s) => ({ ...s, chest_cm: v }))} />
              <NumField label="Brazo (cm)" value={meas.arm_cm}
                onChange={(v) => setMeas((s) => ({ ...s, arm_cm: v }))} />
              <NumField label="Pierna (cm)" value={meas.leg_cm}
                onChange={(v) => setMeas((s) => ({ ...s, leg_cm: v }))} />
              <NumField label="Cadera (cm)" value={meas.hip_cm}
                onChange={(v) => setMeas((s) => ({ ...s, hip_cm: v }))} />
            </div>
            <Button className="w-full" onClick={saveMeas} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="—"
      />
    </div>
  );
}
