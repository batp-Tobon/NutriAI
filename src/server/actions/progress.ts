"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCurrentUser } from "@/infrastructure/supabase/server";
import {
  createMeasurementRepository,
  createProgressRepository,
} from "@/infrastructure/supabase/repositories";
import { todayISO } from "@/lib/utils";

/** Convierte texto de formulario a número o null. */
function toNum(s: string | undefined | null): number | null {
  if (s == null) return null;
  const t = String(s).trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export interface ProgressInput {
  weight_kg: string;
  body_fat_pct: string;
  muscle_mass_kg: string;
  sleep_hours: string;
}

export async function addProgress(
  input: ProgressInput,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const weight = toNum(input.weight_kg);
  const supabase = await createClient();
  try {
    await createProgressRepository(supabase).upsert({
      user_id: user.id,
      weight_kg: weight,
      body_fat_pct: toNum(input.body_fat_pct),
      muscle_mass_kg: toNum(input.muscle_mass_kg),
      sleep_hours: toNum(input.sleep_hours),
      recorded_at: todayISO(),
    });
    if (weight != null) {
      await supabase
        .from("profiles")
        .update({ current_weight_kg: weight })
        .eq("id", user.id);
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }

  revalidatePath("/progress");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Registro rápido de horas de sueño de hoy. */
export async function logSleep(
  hours: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const supabase = await createClient();
  try {
    await createProgressRepository(supabase).upsert({
      user_id: user.id,
      sleep_hours: toNum(hours),
      recorded_at: todayISO(),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }

  revalidatePath("/dashboard");
  revalidatePath("/progress");
  return { ok: true };
}

export interface MeasurementInput {
  waist_cm: string;
  chest_cm: string;
  arm_cm: string;
  leg_cm: string;
  hip_cm: string;
}

export async function addMeasurement(
  input: MeasurementInput,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const supabase = await createClient();
  try {
    await createMeasurementRepository(supabase).upsert({
      user_id: user.id,
      waist_cm: toNum(input.waist_cm),
      chest_cm: toNum(input.chest_cm),
      arm_cm: toNum(input.arm_cm),
      leg_cm: toNum(input.leg_cm),
      hip_cm: toNum(input.hip_cm),
      recorded_at: todayISO(),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }

  revalidatePath("/progress");
  return { ok: true };
}
