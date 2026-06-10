import "server-only";
import type { FoodSearchItem } from "@/core/domain/entities";

interface OFFProduct {
  code?: string;
  product_name?: string;
  product_name_es?: string;
  nutriments?: Record<string, number | string | undefined>;
}

function num(v: number | string | undefined): number {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n as number) ? Math.round(((n as number) + Number.EPSILON) * 10) / 10 : 0;
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
