-- ============================================================================
-- NutriAI · 0004 · Semilla de alimentos comunes (macros por 100 g)
-- Catálogo público base. La IA y el buscador parten de aquí.
-- ============================================================================

insert into public.foods (name, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, is_public)
values
  ('Pechuga de pollo a la plancha', 165, 31.0, 0.0,  3.6, true),
  ('Arroz blanco cocido',           130,  2.7, 28.0, 0.3, true),
  ('Arroz integral cocido',         123,  2.7, 25.6, 1.0, true),
  ('Huevo entero',                  155, 13.0, 1.1, 11.0, true),
  ('Clara de huevo',                 52, 11.0, 0.7,  0.2, true),
  ('Avena en hojuelas',             389, 16.9, 66.3, 6.9, true),
  ('Banano',                         89,  1.1, 22.8, 0.3, true),
  ('Manzana',                        52,  0.3, 14.0, 0.2, true),
  ('Salmón',                        208, 20.0, 0.0, 13.0, true),
  ('Atún en agua',                  116, 26.0, 0.0,  1.0, true),
  ('Carne de res magra',            187, 26.0, 0.0,  9.0, true),
  ('Lomo de cerdo',                 242, 27.0, 0.0, 14.0, true),
  ('Lentejas cocidas',              116,  9.0, 20.0, 0.4, true),
  ('Frijoles cocidos',              127,  8.7, 22.8, 0.5, true),
  ('Brócoli',                        34,  2.8, 6.6,  0.4, true),
  ('Patata cocida',                  87,  1.9, 20.1, 0.1, true),
  ('Batata (camote)',                86,  1.6, 20.1, 0.1, true),
  ('Pan integral',                  247, 13.0, 41.0, 3.4, true),
  ('Aguacate',                      160,  2.0, 9.0, 15.0, true),
  ('Almendras',                     579, 21.2, 21.6, 49.9, true),
  ('Aceite de oliva',               884,  0.0, 0.0, 100.0, true),
  ('Leche entera',                   61,  3.2, 4.8,  3.3, true),
  ('Yogur griego natural',           59, 10.0, 3.6,  0.4, true),
  ('Queso fresco',                  264, 18.0, 3.4, 20.0, true),
  ('Proteína whey (polvo)',         400, 80.0, 8.0,  6.0, true),
  ('Pasta cocida',                  158,  5.8, 31.0, 0.9, true),
  ('Tomate',                         18,  0.9, 3.9,  0.2, true),
  ('Lechuga',                        15,  1.4, 2.9,  0.2, true),
  ('Espinaca',                       23,  2.9, 3.6,  0.4, true),
  ('Zanahoria',                      41,  0.9, 9.6,  0.2, true)
on conflict do nothing;
