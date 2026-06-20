"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Camera,
  Image as ImageIcon,
  Loader2,
  Lock,
  Pencil,
  Plus,
  ScanBarcode,
  Search,
  Sparkles,
  Trash2,
  Type,
} from "lucide-react";
import dynamic from "next/dynamic";
import { createClient } from "@/infrastructure/supabase/client";
import { lookupBarcode, saveMeal, searchFoods } from "@/server/actions/meals";

// Carga diferida: la librería de escaneo (ZXing) solo se descarga al usarla.
const BarcodeScanner = dynamic(
  () => import("@/components/log/barcode-scanner").then((m) => m.BarcodeScanner),
  { ssr: false },
);
import { macrosForGrams } from "@/core/application/nutrition";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
import type { FoodSearchItem } from "@/core/domain/entities";

type Item = {
  name: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};
type Tab = "photo" | "text" | "manual";

function defaultMealType(): MealType {
  const h = new Date().getHours();
  if (h < 11) return "breakfast";
  if (h < 16) return "lunch";
  if (h < 21) return "dinner";
  return "snack";
}

/**
 * Comprime la foto en el dispositivo (máx 1280px, JPEG) para no superar el
 * límite del servidor (4.5 MB) y abaratar el análisis con IA.
 */
async function compressImage(file: File, maxDim = 1280, quality = 0.82): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  if (scale === 1 && file.size < 800_000) return dataUrl;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(",");
  const mime = /data:(.*?);/.exec(head)?.[1] ?? "image/jpeg";
  const bin = atob(body);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export function LogClient({ aiEnabled }: { aiEnabled: boolean }) {
  const router = useRouter();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<Tab>(aiEnabled ? "photo" : "manual");
  const [mealType, setMealType] = useState<MealType>(defaultMealType());
  const [preview, setPreview] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);

  // Registro manual (catálogo)
  const [foodQuery, setFoodQuery] = useState("");
  const [foodResults, setFoodResults] = useState<FoodSearchItem[]>([]);
  const [searchingFood, setSearchingFood] = useState(false);

  // Escáner de código de barras
  const [scanning, setScanning] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);

  // Edición del resultado (IA o manual): macros por ítem + añadir componentes
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [addQuery, setAddQuery] = useState("");
  const [addResults, setAddResults] = useState<FoodSearchItem[]>([]);
  const [addSearching, setAddSearching] = useState(false);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ""; // permite elegir la misma foto de nuevo
    if (!f) return;
    setItems(null);
    try {
      setPreview(await compressImage(f));
    } catch {
      toast.error("No se pudo leer la imagen. Intenta con otra.");
    }
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
      const text = await res.text();
      let data: { error?: string; name?: string; confidence?: number; items?: Item[] };
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          res.status === 413
            ? "La imagen es demasiado grande. Intenta con otra foto."
            : "El servidor no respondió correctamente. Inténtalo de nuevo.",
        );
      }
      if (!res.ok) throw new Error(data.error ?? "Error al analizar");
      setName(data.name ?? "Comida");
      setConfidence(data.confidence ?? null);
      setItems(
        (data.items ?? []).map((i: Item) => ({
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

  async function findFoods() {
    if (!foodQuery.trim()) return;
    setSearchingFood(true);
    try {
      setFoodResults(await searchFoods(foodQuery));
    } catch {
      toast.error("Error al buscar");
    } finally {
      setSearchingFood(false);
    }
  }

  function addFood(f: FoodSearchItem) {
    const m = macrosForGrams(f, 100);
    setConfidence(null);
    setItems((prev) => [
      ...(prev ?? []),
      { name: f.name, grams: 100, kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat },
    ]);
    if (!name) setName("Comida");
    toast.success("Alimento añadido");
  }

  /** Llega un código del escáner → busca el producto y lo añade. */
  async function onBarcode(code: string) {
    setScanning(false);
    setLookingUp(true);
    try {
      const res = await lookupBarcode(code);
      if (!res.ok || !res.item) {
        toast.error(res.error ?? "Producto no encontrado. Búscalo por nombre.");
        return;
      }
      addFood(res.item);
      setName(res.item.name);
    } catch {
      toast.error("No se pudo consultar el producto.");
    } finally {
      setLookingUp(false);
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
    setEditIdx(null);
    setItems((prev) => (prev ? prev.filter((_, i) => i !== idx) : prev));
  }

  function updateItemField(idx: number, patch: Partial<Item>) {
    setItems((prev) =>
      prev ? prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)) : prev,
    );
  }

  function addBlankItem() {
    setItems((prev) => {
      const next = [
        ...(prev ?? []),
        { name: "", grams: 100, kcal: 0, protein: 0, carbs: 0, fat: 0 },
      ];
      setEditIdx(next.length - 1);
      return next;
    });
    if (!name) setName("Comida");
  }

  async function searchToAdd() {
    if (!addQuery.trim()) return;
    setAddSearching(true);
    try {
      setAddResults(await searchFoods(addQuery));
    } catch {
      toast.error("Error al buscar");
    } finally {
      setAddSearching(false);
    }
  }

  function addFromSearch(f: FoodSearchItem) {
    addFood(f);
    setAddResults([]);
    setAddQuery("");
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
    if (items.some((i) => !i.name.trim())) {
      toast.error("Hay alimentos sin nombre. Complétalos o quítalos.");
      return;
    }
    setSaving(true);
    try {
      let image_url: string | null = null;
      if (tab === "photo" && preview) {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const path = `${user.id}/${Date.now()}.jpg`;
          const { error } = await supabase.storage
            .from("meal-images")
            .upload(path, dataUrlToBlob(preview), {
              upsert: false,
              contentType: "image/jpeg",
            });
          if (!error) image_url = path;
        }
      }

      const res = await saveMeal({
        name: name || "Comida",
        meal_type: mealType,
        source: tab === "photo" ? "photo" : tab === "text" ? "text" : "manual",
        image_url,
        ai_confidence: confidence,
        items,
      });
      if (!res.ok) throw new Error(res.error);
      toast.success("Comida registrada");
      setItems(null);
      setPreview(null);
      setDescription("");
      setFoodResults([]);
      setFoodQuery("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            <TabsTrigger value="photo">
              {aiEnabled ? (
                <Camera className="mr-1 h-4 w-4" />
              ) : (
                <Lock className="mr-1 h-4 w-4" />
              )}{" "}
              Foto
            </TabsTrigger>
            <TabsTrigger value="text">
              {aiEnabled ? (
                <Type className="mr-1 h-4 w-4" />
              ) : (
                <Lock className="mr-1 h-4 w-4" />
              )}{" "}
              Texto
            </TabsTrigger>
            <TabsTrigger value="manual">
              <Search className="mr-1 h-4 w-4" /> Manual
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

      {/* IA bloqueada en plan General */}
      {(tab === "photo" || tab === "text") && !aiEnabled && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
            <Lock className="h-7 w-7 text-muted-foreground" />
            <p className="text-sm font-semibold">Análisis con IA</p>
            <p className="text-xs text-muted-foreground">
              Disponible en el plan IA. Con tu plan General usa la pestaña
              <b> Manual</b> para registrar tus comidas.
            </p>
            <Button size="sm" className="mt-1" onClick={() => setTab("manual")}>
              Ir a Manual
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === "photo" && aiEnabled && (
        <Card>
          <CardContent className="pt-5">
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={onPickFile}
            />
            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
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
                onClick={() => galleryRef.current?.click()}
                className="mb-3 flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-muted-foreground"
              >
                <Camera className="h-8 w-8" />
                <span className="text-sm">Toma o sube una foto</span>
              </button>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => cameraRef.current?.click()}
              >
                <Camera className="h-4 w-4" /> Cámara
              </Button>
              <Button
                variant="outline"
                onClick={() => galleryRef.current?.click()}
              >
                <ImageIcon className="h-4 w-4" /> Galería
              </Button>
            </div>
            <div className="mt-2">
              <Button
                className="w-full"
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
      )}

      {tab === "text" && aiEnabled && (
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

      {tab === "manual" && (
        <Card>
          <CardContent className="space-y-3 pt-5">
            {/* Escanear código de barras (sin IA, disponible en todos los planes) */}
            <Button
              variant="default"
              className="w-full"
              onClick={() => setScanning(true)}
              disabled={lookingUp}
            >
              {lookingUp ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ScanBarcode className="h-4 w-4" />
              )}
              {lookingUp ? "Buscando producto…" : "Escanear código de barras"}
            </Button>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> o busca por nombre
              <span className="h-px flex-1 bg-border" />
            </div>

            <div className="flex gap-2">
              <Input
                value={foodQuery}
                onChange={(e) => setFoodQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && findFoods()}
                placeholder="Busca un alimento (pollo, arroz…)"
              />
              <Button variant="secondary" onClick={findFoods} disabled={searchingFood}>
                {searchingFood ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
            {foodResults.length > 0 && (
              <div className="space-y-1.5">
                {foodResults.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => addFood(f)}
                    className="flex w-full items-center justify-between rounded-lg bg-secondary/40 px-3 py-2 text-left text-sm transition-colors hover:bg-secondary"
                  >
                    <span className="truncate">{f.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {f.kcal_per_100g} kcal/100g
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {items && items.length > 0 && (
        <Card className="animate-fade-in">
          <CardContent className="space-y-3 pt-5">
            <div className="flex items-center justify-between">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre de la comida"
                className="h-9 flex-1"
              />
              {confidence != null && (
                <Badge
                  className="ml-2"
                  variant={confidence >= 0.66 ? "default" : "secondary"}
                >
                  {confidence >= 0.66 ? "Alta" : confidence >= 0.4 ? "Media" : "Baja"}{" "}
                  {Math.round(confidence * 100)}%
                </Badge>
              )}
            </div>
            {confidence != null && (
              <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
                ⚠️ La IA estima; <b>revisa cada alimento y sus gramos/calorías</b>{" "}
                antes de guardar. Toca el lápiz para corregir macros o añade lo
                que falte.
              </p>
            )}

            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="rounded-xl bg-secondary/40 p-2.5">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <input
                        value={it.name}
                        onChange={(e) =>
                          updateItemField(idx, { name: e.target.value })
                        }
                        placeholder="Nombre del alimento"
                        className="w-full bg-transparent text-sm font-medium placeholder:text-muted-foreground focus:outline-none"
                      />
                      <p className="text-xs text-muted-foreground">
                        {Math.round(it.kcal)} kcal · P{it.protein} C{it.carbs} G
                        {it.fat}
                      </p>
                    </div>
                    <input
                      type="number"
                      value={it.grams}
                      onChange={(e) => updateGrams(idx, Number(e.target.value))}
                      className="h-9 w-16 rounded-lg border border-input bg-background px-2 text-right text-base"
                    />
                    <span className="text-xs text-muted-foreground">g</span>
                    <button
                      onClick={() =>
                        setEditIdx((cur) => (cur === idx ? null : idx))
                      }
                      aria-label="Editar macros"
                      className={
                        editIdx === idx
                          ? "text-primary"
                          : "text-muted-foreground hover:text-primary"
                      }
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => removeItem(idx)}
                      aria-label="Quitar alimento"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Corregir lo que trajo la IA (o lo manual) */}
                  {editIdx === idx && (
                    <div className="mt-2 grid grid-cols-4 gap-1.5 border-t border-border/60 pt-2 animate-fade-in">
                      <MacroInput
                        label="Kcal"
                        value={it.kcal}
                        onChange={(v) => updateItemField(idx, { kcal: v })}
                      />
                      <MacroInput
                        label="Prot (g)"
                        value={it.protein}
                        onChange={(v) => updateItemField(idx, { protein: v })}
                      />
                      <MacroInput
                        label="Carb (g)"
                        value={it.carbs}
                        onChange={(v) => updateItemField(idx, { carbs: v })}
                      />
                      <MacroInput
                        label="Grasa (g)"
                        value={it.fat}
                        onChange={(v) => updateItemField(idx, { fat: v })}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Añadir componentes a la comida */}
            <div className="space-y-2 rounded-xl border border-dashed border-border p-2.5">
              <div className="flex gap-2">
                <input
                  value={addQuery}
                  onChange={(e) => setAddQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchToAdd()}
                  placeholder="Añadir alimento (pollo, arroz…)"
                  className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-base"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-10"
                  onClick={searchToAdd}
                  disabled={addSearching}
                >
                  {addSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-10"
                  onClick={addBlankItem}
                >
                  <Plus className="h-4 w-4" /> Manual
                </Button>
              </div>
              {addResults.length > 0 && (
                <div className="space-y-1">
                  {addResults.slice(0, 6).map((f) => (
                    <button
                      key={f.id}
                      onClick={() => addFromSearch(f)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg bg-secondary/40 px-3 py-2 text-left text-sm transition-colors hover:bg-secondary"
                    >
                      <span className="min-w-0 truncate">{f.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {f.kcal_per_100g} kcal/100g
                      </span>
                    </button>
                  ))}
                </div>
              )}
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

      {/* Escáner de código de barras (pantalla completa) */}
      {scanning && (
        <BarcodeScanner
          onDetected={onBarcode}
          onClose={() => setScanning(false)}
        />
      )}
    </div>
  );
}

function MacroInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <p className="mb-0.5 text-[10px] text-muted-foreground">{label}</p>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="h-9 w-full rounded-lg border border-input bg-background px-1 text-center text-base"
      />
    </div>
  );
}
