"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dumbbell, Loader2, Plus, Replace, Search, Trash2, X } from "lucide-react";
import { saveManualWorkout } from "@/server/actions/workouts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GOAL_LABELS, WORKOUT_TYPE_LABELS } from "@/lib/constants";
import type { Goal, WorkoutType } from "@/types/database";
import type { Workout } from "@/core/domain/entities";

type Difficulty = "principiante" | "intermedio" | "avanzado";
type Ex = {
  name: string;
  sets: string;
  reps: string;
  rest_sec: string;
  gif_url?: string;
  target?: string;
  block: string;
};
type SearchResult = {
  name: string;
  gif_url: string;
  target: string;
  equipment: string;
};

const DIFFICULTIES: Difficulty[] = ["principiante", "intermedio", "avanzado"];

function gifSrc(url: string) {
  return `/api/exercise-gif?u=${encodeURIComponent(url)}`;
}

export function RoutineBuilder({ initial }: { initial?: Workout | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [title, setTitle] = useState(initial?.title ?? "");
  const [workoutType, setWorkoutType] = useState<WorkoutType>(
    initial?.workout_type ?? "gym",
  );
  const [goal, setGoal] = useState<Goal>(initial?.goal ?? "gain_muscle");
  const [durationMin, setDurationMin] = useState(
    initial?.duration_min?.toString() ?? "45",
  );
  const [difficulty, setDifficulty] = useState<Difficulty>(
    DIFFICULTIES.includes(initial?.difficulty as Difficulty)
      ? (initial?.difficulty as Difficulty)
      : "intermedio",
  );
  const [exercises, setExercises] = useState<Ex[]>(() =>
    (initial?.plan ?? []).flatMap((b) =>
      b.exercises.map((e) => ({
        name: e.name,
        sets: String(e.sets),
        reps: e.reps,
        rest_sec: String(e.rest_sec),
        gif_url: e.gif_url,
        target: e.target,
        block: b.block || "Principal",
      })),
    ),
  );

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  // índice del ejercicio que se está reemplazando (null = añadir nuevo)
  const [swapIndex, setSwapIndex] = useState<number | null>(null);

  function addBlank() {
    setExercises((x) => [
      ...x,
      { name: "", sets: "4", reps: "10", rest_sec: "60", block: "Principal" },
    ]);
  }
  function addFromCatalog(r: SearchResult) {
    if (swapIndex !== null) {
      setExercises((x) =>
        x.map((e, i) =>
          i === swapIndex
            ? { ...e, name: r.name, gif_url: r.gif_url, target: r.target }
            : e,
        ),
      );
      setSwapIndex(null);
      setResults([]);
      setQuery("");
      toast.success("Ejercicio reemplazado");
      return;
    }
    setExercises((x) => [
      ...x,
      {
        name: r.name,
        sets: "4",
        reps: "10",
        rest_sec: "60",
        gif_url: r.gif_url,
        target: r.target,
        block: "Principal",
      },
    ]);
    toast.success("Ejercicio añadido");
  }

  function startSwap(i: number) {
    setSwapIndex(i);
    setResults([]);
    setQuery("");
    toast("Busca arriba el ejercicio para reemplazarlo");
  }
  function updateEx(i: number, key: keyof Ex, val: string) {
    setExercises((x) => x.map((e, idx) => (idx === i ? { ...e, [key]: val } : e)));
  }
  function removeEx(i: number) {
    setExercises((x) => x.filter((_, idx) => idx !== i));
  }

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `/api/exercises/search?q=${encodeURIComponent(query)}`,
      );
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
      if (Array.isArray(data) && data.length === 0)
        toast("Sin resultados. Puedes añadirlo manual abajo.");
    } catch {
      toast.error("Error al buscar");
    } finally {
      setSearching(false);
    }
  }

  function save() {
    if (!title.trim()) return toast.error("Ponle un nombre a la rutina");
    if (exercises.length === 0)
      return toast.error("Agrega al menos un ejercicio");
    if (exercises.some((e) => !e.name.trim()))
      return toast.error("Hay ejercicios sin nombre");

    start(async () => {
      const res = await saveManualWorkout({
        id: initial?.id,
        title: title.trim(),
        workoutType,
        goal,
        durationMin: Number(durationMin) || 45,
        difficulty,
        exercises: exercises.map((e) => ({
          name: e.name.trim(),
          sets: Number(e.sets) || 1,
          reps: e.reps.trim() || "10",
          rest_sec: Number(e.rest_sec) || 0,
          gif_url: e.gif_url,
          target: e.target,
          block: e.block,
        })),
      });
      if (!res.ok) {
        toast.error(res.error ?? "Error");
        return;
      }
      toast.success(initial ? "Rutina actualizada" : "Rutina creada");
      router.push("/plan");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Nombre de la rutina</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ej: Mi rutina de pecho y brazo"
        />
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-3 pt-5">
          <Field label="Lugar">
            <Select
              value={workoutType}
              onValueChange={(v) => setWorkoutType(v as WorkoutType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(WORKOUT_TYPE_LABELS).map(([k, l]) => (
                  <SelectItem key={k} value={k}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Objetivo">
            <Select value={goal} onValueChange={(v) => setGoal(v as Goal)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(GOAL_LABELS).map(([k, l]) => (
                  <SelectItem key={k} value={k}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Duración (min)">
            <Input
              type="number"
              inputMode="numeric"
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
            />
          </Field>
          <Field label="Nivel">
            <Select
              value={difficulty}
              onValueChange={(v) => setDifficulty(v as Difficulty)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIFFICULTIES.map((d) => (
                  <SelectItem key={d} value={d} className="capitalize">
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      {/* Buscador del catálogo (con GIF) */}
      <Card>
        <CardContent className="space-y-3 pt-5">
          <Label>Buscar ejercicio en el catálogo (con GIF)</Label>
          {swapIndex !== null && (
            <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2 text-xs">
              <span className="min-w-0 truncate">
                Reemplazando:{" "}
                <b>{exercises[swapIndex]?.name || "ejercicio"}</b>
              </span>
              <button
                onClick={() => setSwapIndex(null)}
                className="shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Cancelar reemplazo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="Ej: press inclinado mancuerna, sentadilla, curl bíceps…"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={search}
              disabled={searching}
            >
              {searching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
          {results.length > 0 && (
            <div className="space-y-2">
              {results.map((r, i) => (
                <button
                  key={i}
                  onClick={() => addFromCatalog(r)}
                  className="flex w-full items-center gap-3 rounded-xl bg-secondary/40 p-2 text-left transition-colors hover:bg-secondary"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={gifSrc(r.gif_url)}
                    alt={r.name}
                    loading="lazy"
                    className="h-12 w-12 shrink-0 rounded-lg bg-white object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium capitalize">
                      {r.name}
                    </p>
                    <p className="truncate text-xs capitalize text-muted-foreground">
                      {r.target} · {r.equipment}
                    </p>
                  </div>
                  <Plus className="h-4 w-4 shrink-0 text-primary" />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de ejercicios */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Ejercicios ({exercises.length})
          </h2>
          <Button type="button" size="sm" variant="outline" onClick={addBlank}>
            <Plus className="h-4 w-4" /> Manual
          </Button>
        </div>

        {exercises.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Busca arriba o añade un ejercicio manual.
          </p>
        )}

        {exercises.map((ex, i) => (
          <Card key={i}>
            <CardContent className="space-y-2 p-3">
              <div className="flex items-center gap-2">
                {ex.gif_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={gifSrc(ex.gif_url)}
                    alt={ex.name}
                    loading="lazy"
                    className="h-12 w-12 shrink-0 rounded-lg bg-white object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                    <Dumbbell className="h-5 w-5" />
                  </div>
                )}
                <Input
                  value={ex.name}
                  onChange={(e) => updateEx(i, "name", e.target.value)}
                  placeholder="Nombre del ejercicio"
                  className="h-10 flex-1"
                />
                <button
                  onClick={() => startSwap(i)}
                  aria-label="Reemplazar ejercicio"
                  className={
                    swapIndex === i
                      ? "shrink-0 p-2 text-primary"
                      : "shrink-0 p-2 text-muted-foreground hover:text-primary"
                  }
                >
                  <Replace className="h-4 w-4" />
                </button>
                <button
                  onClick={() => removeEx(i)}
                  aria-label="Quitar"
                  className="shrink-0 p-2 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <MiniField label="Series">
                  <Input
                    type="number"
                    value={ex.sets}
                    onChange={(e) => updateEx(i, "sets", e.target.value)}
                    className="h-9"
                  />
                </MiniField>
                <MiniField label="Reps">
                  <Input
                    value={ex.reps}
                    onChange={(e) => updateEx(i, "reps", e.target.value)}
                    placeholder="8-10"
                    className="h-9"
                  />
                </MiniField>
                <MiniField label="Descanso (s)">
                  <Input
                    type="number"
                    value={ex.rest_sec}
                    onChange={(e) => updateEx(i, "rest_sec", e.target.value)}
                    className="h-9"
                  />
                </MiniField>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-2 pb-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => router.push("/plan")}
        >
          Cancelar
        </Button>
        <Button className="flex-1" onClick={save} disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {initial ? "Guardar cambios" : "Crear rutina"}
        </Button>
      </div>
    </div>
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

function MiniField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px]">{label}</Label>
      {children}
    </div>
  );
}
