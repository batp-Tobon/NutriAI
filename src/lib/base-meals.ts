/**
 * Planes de comida BASE (sin IA), disponibles para todos los planes — incluido
 * el General. Son menús colombianos balanceados a 3 niveles de calorías; se elige
 * el más cercano al objetivo del usuario. Estructura compatible con el visor del
 * plan de comidas (mismas claves que el plan generado por IA).
 */

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export interface BasePlanItem {
  name: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}
export interface BasePlanMeal {
  meal: string;
  meal_type: MealType;
  items: BasePlanItem[];
}
export interface BaseMealPlan {
  level: number; // calorías aproximadas del plan
  title: string;
  meals: BasePlanMeal[];
  shopping_list: { name: string; amount: string }[];
}

export const BASE_MEAL_PLANS: BaseMealPlan[] = [
  {
    level: 1400,
    title: "Plan base ligero (~1400 kcal)",
    meals: [
      {
        meal: "Desayuno",
        meal_type: "breakfast",
        items: [
          { name: "Huevos revueltos (2)", grams: 100, kcal: 155, protein: 13, carbs: 1, fat: 11 },
          { name: "Arepa", grams: 70, kcal: 154, protein: 3, carbs: 32, fat: 1 },
        ],
      },
      {
        meal: "Almuerzo",
        meal_type: "lunch",
        items: [
          { name: "Pechuga de pollo a la plancha", grams: 120, kcal: 198, protein: 37, carbs: 0, fat: 4 },
          { name: "Arroz blanco cocido", grams: 150, kcal: 195, protein: 4, carbs: 42, fat: 0 },
          { name: "Frijoles", grams: 100, kcal: 130, protein: 8, carbs: 20, fat: 1 },
          { name: "Ensalada (lechuga y tomate)", grams: 100, kcal: 20, protein: 1, carbs: 4, fat: 0 },
        ],
      },
      {
        meal: "Snack",
        meal_type: "snack",
        items: [
          { name: "Yogur griego", grams: 150, kcal: 90, protein: 15, carbs: 6, fat: 0 },
          { name: "Banano", grams: 100, kcal: 89, protein: 1, carbs: 23, fat: 0 },
        ],
      },
      {
        meal: "Cena",
        meal_type: "dinner",
        items: [
          { name: "Atún en agua", grams: 100, kcal: 116, protein: 26, carbs: 0, fat: 1 },
          { name: "Tostadas integrales", grams: 50, kcal: 188, protein: 6, carbs: 35, fat: 2 },
          { name: "Aguacate", grams: 50, kcal: 80, protein: 1, carbs: 4, fat: 7 },
        ],
      },
    ],
    shopping_list: [
      { name: "Huevos", amount: "6 unidades" },
      { name: "Arepas", amount: "paquete" },
      { name: "Pechuga de pollo", amount: "500 g" },
      { name: "Arroz", amount: "500 g" },
      { name: "Frijoles", amount: "500 g" },
      { name: "Lechuga y tomate", amount: "al gusto" },
      { name: "Yogur griego", amount: "1 envase" },
      { name: "Banano", amount: "racimo" },
      { name: "Atún en agua", amount: "2 latas" },
      { name: "Pan integral", amount: "paquete" },
      { name: "Aguacate", amount: "1 unidad" },
    ],
  },
  {
    level: 1900,
    title: "Plan base moderado (~1900 kcal)",
    meals: [
      {
        meal: "Desayuno",
        meal_type: "breakfast",
        items: [
          { name: "Huevos revueltos (3)", grams: 150, kcal: 233, protein: 20, carbs: 2, fat: 16 },
          { name: "Arepa", grams: 90, kcal: 198, protein: 4, carbs: 41, fat: 2 },
          { name: "Café con leche", grams: 150, kcal: 60, protein: 3, carbs: 6, fat: 2 },
        ],
      },
      {
        meal: "Almuerzo",
        meal_type: "lunch",
        items: [
          { name: "Pechuga de pollo", grams: 150, kcal: 248, protein: 46, carbs: 0, fat: 5 },
          { name: "Arroz blanco cocido", grams: 180, kcal: 234, protein: 5, carbs: 50, fat: 0 },
          { name: "Frijoles", grams: 120, kcal: 156, protein: 10, carbs: 24, fat: 1 },
          { name: "Aguacate", grams: 50, kcal: 80, protein: 1, carbs: 4, fat: 7 },
          { name: "Ensalada", grams: 100, kcal: 20, protein: 1, carbs: 4, fat: 0 },
        ],
      },
      {
        meal: "Snack",
        meal_type: "snack",
        items: [
          { name: "Yogur griego", grams: 170, kcal: 102, protein: 17, carbs: 7, fat: 0 },
          { name: "Banano", grams: 120, kcal: 107, protein: 1, carbs: 27, fat: 0 },
          { name: "Almendras", grams: 20, kcal: 116, protein: 4, carbs: 4, fat: 10 },
        ],
      },
      {
        meal: "Cena",
        meal_type: "dinner",
        items: [
          { name: "Atún en agua", grams: 120, kcal: 139, protein: 31, carbs: 0, fat: 1 },
          { name: "Papa cocida", grams: 150, kcal: 130, protein: 3, carbs: 30, fat: 0 },
          { name: "Vegetales salteados", grams: 120, kcal: 40, protein: 2, carbs: 8, fat: 0 },
        ],
      },
    ],
    shopping_list: [
      { name: "Huevos", amount: "1 docena" },
      { name: "Arepas", amount: "paquete" },
      { name: "Leche", amount: "1 litro" },
      { name: "Pechuga de pollo", amount: "600 g" },
      { name: "Arroz", amount: "500 g" },
      { name: "Frijoles", amount: "500 g" },
      { name: "Aguacate", amount: "2 unidades" },
      { name: "Yogur griego", amount: "1 envase" },
      { name: "Banano", amount: "racimo" },
      { name: "Almendras", amount: "bolsa pequeña" },
      { name: "Atún en agua", amount: "2 latas" },
      { name: "Papa", amount: "500 g" },
      { name: "Vegetales (mezcla)", amount: "500 g" },
    ],
  },
  {
    level: 2400,
    title: "Plan base alto (~2400 kcal)",
    meals: [
      {
        meal: "Desayuno",
        meal_type: "breakfast",
        items: [
          { name: "Huevos revueltos (3)", grams: 150, kcal: 233, protein: 20, carbs: 2, fat: 16 },
          { name: "Avena en hojuelas", grams: 60, kcal: 228, protein: 8, carbs: 40, fat: 4 },
          { name: "Leche", grams: 200, kcal: 124, protein: 7, carbs: 10, fat: 5 },
          { name: "Banano", grams: 100, kcal: 89, protein: 1, carbs: 23, fat: 0 },
        ],
      },
      {
        meal: "Almuerzo",
        meal_type: "lunch",
        items: [
          { name: "Carne magra de res", grams: 150, kcal: 250, protein: 38, carbs: 0, fat: 10 },
          { name: "Arroz blanco cocido", grams: 200, kcal: 260, protein: 5, carbs: 56, fat: 0 },
          { name: "Frijoles", grams: 130, kcal: 169, protein: 11, carbs: 26, fat: 1 },
          { name: "Aguacate", grams: 60, kcal: 96, protein: 1, carbs: 5, fat: 9 },
          { name: "Ensalada", grams: 100, kcal: 20, protein: 1, carbs: 4, fat: 0 },
        ],
      },
      {
        meal: "Snack",
        meal_type: "snack",
        items: [
          { name: "Yogur griego", grams: 200, kcal: 120, protein: 20, carbs: 8, fat: 0 },
          { name: "Granola", grams: 40, kcal: 180, protein: 4, carbs: 30, fat: 6 },
          { name: "Manzana", grams: 150, kcal: 78, protein: 0, carbs: 20, fat: 0 },
        ],
      },
      {
        meal: "Cena",
        meal_type: "dinner",
        items: [
          { name: "Pechuga de pollo", grams: 150, kcal: 248, protein: 46, carbs: 0, fat: 5 },
          { name: "Pasta cocida", grams: 180, kcal: 279, protein: 10, carbs: 54, fat: 2 },
          { name: "Vegetales salteados", grams: 120, kcal: 40, protein: 2, carbs: 8, fat: 0 },
        ],
      },
    ],
    shopping_list: [
      { name: "Huevos", amount: "1 docena" },
      { name: "Avena", amount: "500 g" },
      { name: "Leche", amount: "1 litro" },
      { name: "Banano", amount: "racimo" },
      { name: "Carne magra de res", amount: "600 g" },
      { name: "Arroz", amount: "1 kg" },
      { name: "Frijoles", amount: "500 g" },
      { name: "Aguacate", amount: "2 unidades" },
      { name: "Yogur griego", amount: "1 envase grande" },
      { name: "Granola", amount: "bolsa" },
      { name: "Manzana", amount: "4 unidades" },
      { name: "Pechuga de pollo", amount: "600 g" },
      { name: "Pasta", amount: "500 g" },
      { name: "Vegetales (mezcla)", amount: "500 g" },
    ],
  },
];

/** Devuelve el plan base cuyo nivel de calorías es el más cercano al objetivo. */
export function pickBasePlan(targetKcal: number): BaseMealPlan {
  return BASE_MEAL_PLANS.reduce((best, p) =>
    Math.abs(p.level - targetKcal) < Math.abs(best.level - targetKcal) ? p : best,
  );
}
