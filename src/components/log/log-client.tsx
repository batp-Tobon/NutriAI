"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Loader2, Sparkles, Trash2, Type } from "lucide-react";
import { createClient } from "@/infrastructure/supabase/client";
import { saveMeal } from "@/server/actions/meals";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MEAL_TYPE_LABELS } from "@/lib/constants";
import { round } from "@/lib/utils";
import type { MealType } from "@/types/database";

type Item = {
  name: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

function defaultMealType(): MealType {
  const h = new Date().getHours();
  if (h < 11) return "breakfast";
  if (h < 16) return "lunch";
  if (h < 21) return "dinner";
  return "snack";
}

export function LogClient() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<"photo" | "text">("photo");
  const [mealType, setMealType] = useState<MealType>(defaultMealType());
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
    setItems(null);
  }

  async function analyze() {
    setAnalyzing(true);
    setItems(null);
    try {
      const res = await fetch("/api/meals/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          tab === "photo"
            ? { imageDataUrl: preview, description: description || undefined }
            : { description },
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al analizar");
      setName(data.name);
      setConfidence(data.confidence ?? null);
      setItems(
        data.items.map((i: Item) => ({
          name: i.name,
          grams: round(i.grams),
          kcal: round(i.kcal),
          protein: round(i.protein, 1),
          carbs: round(i.carbs, 1),
          fat: round(i.fat, 1),
        })),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al analizar");
    } finally {
      setAnalyzing(false);
    }
  }

  function updateGrams(idx: number, grams: number) {
    setItems((prev) => {
      if (!prev) return prev;
      const it = prev[idx];
      const ratio = it.grams > 0 ? grams / it.grams : 1;
      const next = [...prev];
      next[idx] = {
        ...it,
        grams,
        kcal: round(it.kcal * ratio),
        protein: round(it.protein * ratio, 1),
        carbs: round(it.carbs * ratio, 1),
        fat: round(it.fat * ratio, 1),
      };
      return next;
    });
  }

  function removeItem(idx: number) {
    setItems((prev) => (prev ? prev.filter((_, i) => i !== idx) : prev));
  }

  const totals = (items ?? []).reduce(
    (a, i) => ({
      kcal: a.kcal + i.kcal,
      protein: a.protein + i.protein,
      carbs: a.carbs + i.carbs,
      fat: a.fat + i.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );

  async function save() {
    if (!items || items.length === 0) return;
    setSaving(true);
    try {
      let image_url: string | null = null;
      if (tab === "photo" && file) {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const path = `${user.id}/${Date.now()}.jpg`;
          const { error } = await supabase.storage
            .from("meal-images")
            .upload(path, file, { upsert: false });
          if (!error) image_url = path;
        }
      }

      const res = await saveMeal({
        name: name || "Comida",
        meal_type: mealType,
        source: tab === "photo" ? "photo" : "text",
        image_url,
        ai_confidence: confidence,
        items,
      });
      if (!res.ok) throw new Error(res.error);
      toast.success("Comida registrada");
      // reset
      setItems(null);
      setFile(null);
      setPreview(null);
      setDescription("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "photo" | "text")}>
          <TabsList>
            <TabsTrigger value="photo">
              <Camera className="mr-1 h-4 w-4" /> Foto
            </TabsTrigger>
            <TabsTrigger value="text">
              <Type className="mr-1 h-4 w-4" /> Texto
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={mealType} onValueChange={(v) => setMealType(v as MealType)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(MEAL_TYPE_LABELS).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {tab === "photo" ? (
        <Card>
          <CardContent className="pt-5">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={onPickFile}
            />
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Comida"
                className="mb-3 aspect-video w-full rounded-xl object-cover"
              />
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="mb-3 flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-muted-foreground"
              >
                <Camera className="h-8 w-8" />
                <span className="text-sm">Toma o sube una foto</span>
              </button>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => fileRef.current?.click()}
              >
                {preview ? "Cambiar foto" : "Elegir foto"}
              </Button>
              <Button
                className="flex-1"
                onClick={analyze}
                disabled={!preview || analyzing}
              >
                {analyzing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Analizar
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-3 pt-5">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: 150g de pechuga de pollo, taza de arroz y ensalada"
              rows={4}
            />
            <Button
              className="w-full"
              onClick={analyze}
              disabled={!description.trim() || analyzing}
            >
              {analyzing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Analizar con IA
            </Button>
          </CardContent>
        </Card>
      )}

      {items && (
        <Card className="animate-fade-in">
          <CardContent className="space-y-3 pt-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{name || "Comida"}</h3>
              {confidence != null && (
                <Badge>{Math.round(confidence * 100)}% confianza</Badge>
              )}
            </div>

            <div className="space-y-2">
              {items.map((it, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded-xl bg-secondary/40 p-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{it.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {it.kcal} kcal · P{it.protein} C{it.carbs} G{it.fat}
                    </p>
                  </div>
                  <input
                    type="number"
                    value={it.grams}
                    onChange={(e) => updateGrams(idx, Number(e.target.value))}
                    className="h-9 w-16 rounded-lg border border-input bg-background px-2 text-right text-sm"
                  />
                  <span className="text-xs text-muted-foreground">g</span>
                  <button
                    onClick={() => removeItem(idx)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between rounded-xl bg-primary/10 p-3 text-sm">
              <span className="font-semibold">Total</span>
              <span className="font-bold">
                {Math.round(totals.kcal)} kcal · P{Math.round(totals.protein)} C
                {Math.round(totals.carbs)} G{Math.round(totals.fat)}
              </span>
            </div>

            <Button className="w-full" onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Registrar comida
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
