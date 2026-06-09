"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
import { saveProfile, type SaveProfileInput } from "@/server/actions/profile";
import { ACTIVITY_LABELS, GOAL_LABELS } from "@/lib/constants";
import type { Profile } from "@/core/domain/entities";

export function ProfileForm({
  profile,
  mode,
}: {
  profile: Partial<Profile> | null;
  mode: "onboarding" | "edit";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    full_name: profile?.full_name ?? "",
    age: profile?.age?.toString() ?? "",
    sex: profile?.sex ?? "male",
    height_cm: profile?.height_cm?.toString() ?? "",
    current_weight_kg: profile?.current_weight_kg?.toString() ?? "",
    target_weight_kg: profile?.target_weight_kg?.toString() ?? "",
    activity_level: profile?.activity_level ?? "moderate",
    goal: profile?.goal ?? "maintain",
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveProfile(form as unknown as SaveProfileInput);
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo guardar");
        return;
      }
      toast.success("Perfil guardado");
      if (mode === "onboarding") {
        router.push("/dashboard");
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Nombre">
        <Input
          value={form.full_name}
          onChange={(e) => set("full_name", e.target.value)}
          placeholder="Tu nombre"
          required
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Edad">
          <Input
            type="number"
            inputMode="numeric"
            value={form.age}
            onChange={(e) => set("age", e.target.value)}
            placeholder="años"
            required
          />
        </Field>
        <Field label="Sexo">
          <Select value={form.sex} onValueChange={(v) => set("sex", v as never)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Hombre</SelectItem>
              <SelectItem value="female">Mujer</SelectItem>
              <SelectItem value="other">Otro</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Altura (cm)">
          <Input
            type="number"
            inputMode="decimal"
            value={form.height_cm}
            onChange={(e) => set("height_cm", e.target.value)}
            required
          />
        </Field>
        <Field label="Peso (kg)">
          <Input
            type="number"
            inputMode="decimal"
            value={form.current_weight_kg}
            onChange={(e) => set("current_weight_kg", e.target.value)}
            required
          />
        </Field>
        <Field label="Meta (kg)">
          <Input
            type="number"
            inputMode="decimal"
            value={form.target_weight_kg}
            onChange={(e) => set("target_weight_kg", e.target.value)}
            required
          />
        </Field>
      </div>

      <Field label="Nivel de actividad">
        <Select
          value={form.activity_level}
          onValueChange={(v) => set("activity_level", v as never)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ACTIVITY_LABELS).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Objetivo">
        <Select value={form.goal} onValueChange={(v) => set("goal", v as never)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(GOAL_LABELS).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {mode === "onboarding" ? "Continuar" : "Guardar cambios"}
      </Button>
    </form>
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
