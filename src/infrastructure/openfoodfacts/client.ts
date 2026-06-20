import "server-only";
import type { FoodSearchItem } from "@/core/domain/entities";

interface OFFProduct {
  code?: string;
  product_name?: string;
  product_name_es?: string;
  brands?: string;
  nutriments?: Record<string, number | string | undefined>;
}

function num(v: number | string | undefined): number {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n as number) ? Math.round(((n as number) + Number.EPSILON) * 10) / 10 : 0;
}

/**
 * Busca un producto por su código de barras (EAN/UPC) en Open Food Facts.
 * Devuelve sus macros por 100 g o `null` si no existe / no tiene calorías.
 */
export async function getProductByBarcode(
  code: string,
): Promise<FoodSearchItem | null> {
  const clean = code.replace(/\D/g, "");
  if (!clean) return null;

  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${clean}.json?fields=code,product_name,product_name_es,brands,nutriments`,
      {
        headers: { "User-Agent": "NutriAI/1.0 (nutrition app)" },
        next: { revalidate: 86400 },
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { status?: number; product?: OFFProduct };
    const p = data.product;
    if (data.status !== 1 || !p) return null;

    const base = (p.product_name_es || p.product_name || "").trim();
    const brand = (p.brands || "").split(",")[0]?.trim();
    const name = [brand, base].filter(Boolean).join(" — ") || base;
    const kcal = num(p.nutriments?.["energy-kcal_100g"]);
    if (!name || kcal <= 0) return null;

    return {
      id: `off-${p.code ?? clean}`,
      name,
      kcal_per_100g: kcal,
      protein_per_100g: num(p.nutriments?.["proteins_100g"]),
      carbs_per_100g: num(p.nutriments?.["carbohydrates_100g"]),
      fat_per_100g: num(p.nutriments?.["fat_100g"]),
    };
  } catch {
    return null;
  }
}

/**
 * Busca alimentos en Open Food Facts (gratis, sin llave, en español).
 * Devuelve macros por 100 g. Filtra productos sin nombre o sin calorías.
 */
export async function searchOpenFoodFacts(
  query: string,
  limit = 12,
): Promise<FoodSearchItem[]> {
  if (!query.trim()) return [];
  const url =
    "https://world.openfoodfacts.org/cgi/search.pl?" +
    new URLSearchParams({
      search_terms: query.trim(),
      search_simple: "1",
      action: "process",
      json: "1",
      page_size: "30",
      fields: "code,product_name,product_name_es,nutriments",
    }).toString();

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "NutriAI/1.0 (nutrition app)" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { products?: OFFProduct[] };

    const items: FoodSearchItem[] = [];
    const seen = new Set<string>();
    for (const p of data.products ?? []) {
      const name = (p.product_name_es || p.product_name || "").trim();
      const kcal = num(p.nutriments?.["energy-kcal_100g"]);
      if (!name || kcal <= 0) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        id: `off-${p.code ?? key}`,
        name,
        kcal_per_100g: kcal,
        protein_per_100g: num(p.nutriments?.["proteins_100g"]),
        carbs_per_100g: num(p.nutriments?.["carbohydrates_100g"]),
        fat_per_100g: num(p.nutriments?.["fat_100g"]),
      });
      if (items.length >= limit) break;
    }
    return items;
  } catch {
    return [];
  }
}
