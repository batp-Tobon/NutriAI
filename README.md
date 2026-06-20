# NutriAI 🥗💪

PWA de **nutrición y entrenamiento con IA**: controla tu déficit calórico, analiza
comidas por foto (OpenAI Vision), genera rutinas, sigue tu progreso corporal y
habla con un coach inteligente. Instalable en iPhone, Android, Windows y Mac.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, TailwindCSS, ShadCN UI |
| Backend / DB / Auth | Supabase (PostgreSQL + Auth + Storage + RLS) |
| IA | OpenAI GPT (coach, rutinas) + OpenAI Vision (análisis de comida) |
| Gráficas | Recharts |
| PWA | @ducanh2912/next-pwa (service worker + manifest) |
| Deploy | Vercel |

## Arquitectura (Clean Architecture / DDD / SOLID)

```
src/
├── core/                      # Dominio + aplicación (sin framework, lógica pura)
│   ├── domain/
│   │   ├── entities.ts        # Entidades de dominio (tipos derivados de la BD)
│   │   └── repositories.ts    # Contratos (puertos) de los repositorios
│   └── application/
│       ├── nutrition.ts       # BMR/TDEE/macros, déficit y estados (recomposición)
│       ├── insights.ts        # Recomendaciones del día + meta de hidratación
│       └── subscription.ts    # Reglas de acceso (prueba, planes, vencimiento)
├── infrastructure/            # Adaptadores (implementan los puertos)
│   ├── supabase/              # Clientes (ssr/admin) + repositorios + middleware
│   ├── openai/                # Vision de comida y ejercicio, coach, rutinas
│   ├── exercisedb/            # Catálogo de ejercicios con GIF (RapidAPI)
│   ├── wger/                  # wger open source (español nativo + imágenes)
│   ├── freedb/                # Free Exercise DB (fotos, 3ª fuente)
│   └── openfoodfacts/         # Búsqueda de alimentos sin IA
├── server/actions/            # Server Actions (casos de uso de escritura)
├── app/                       # Rutas (App Router)
│   ├── (auth)/                # login, registro, recuperación
│   ├── (app)/                 # dashboard, log, deficit, plan, progress,
│   │                          #   profile, notifications  (Coach = FAB flotante)
│   ├── admin/                 # panel administrativo
│   └── api/                   # análisis comida, identificar ejercicio, coach, cron
├── components/                # UI por feature (dashboard, meals, workouts, coach…)
│   └── ui/                    # Primitivas ShadCN
├── lib/                       # utils (zona horaria), env, constantes, semana base
└── types/                     # tipos de la BD (formato Supabase)
```

La UI depende de **interfaces** de repositorio (`core/domain/repositories.ts`),
no de Supabase directamente → fácil de testear y de cambiar el backend. La lógica
de negocio (`core/application`) es **pura** (sin I/O) y por tanto trivial de probar.

## Módulos

1. **Autenticación** — email/contraseña, Google, Apple, recuperación, sesiones.
2. **Perfil / Onboarding** — datos + cálculo automático de objetivos calóricos.
3. **Dashboard** — calorías restantes, macros, peso, hidratación, sueño.
4. **Análisis de comidas IA** — foto o texto → alimentos, porciones y macros,
   **editables y revisables** antes de guardar (corrige nombre/gramos/macros,
   añade o quita alimentos). Nunca devuelve 0 kcal en alimentos reales.
5. **Comidas / Historial** — registro del día y de **días anteriores**, con
   edición y borrado (con confirmación) por comida. Incluye **escáner de código
   de barras** (Open Food Facts, sin IA) y búsqueda por nombre.
6. **Déficit calórico** — balance del día (BMR/TDEE Mifflin-St Jeor), desglose,
   selector de objetivo (perder grasa / mantener / ganar músculo), enfoque de
   **recomposición** (déficit suave) y estado de comida, agua, sueño y entreno.
7. **Seguimiento corporal** — peso, % grasa, masa muscular, medidas, gráficas.
8. **Entrenamiento** — rutinas (manual o IA), modo entrenamiento con cronómetro,
   **peso por serie y récords (PRs)**, **cardio por minutos** (caminadora, trote…),
   cambiar/añadir/eliminar ejercicio en caliente e **identificar máquina por foto**.
9. **Coach IA** — chat especializado, como **botón flotante arrastrable** en toda la app.
10. **Hidratación / sueño / recordatorio de gym** y **notificaciones push** (web push).
11. **Suscripción** — prueba de 5 días → planes General/IA, cuota mensual de IA.
12. **Panel admin** — usuarios, fechas de suscripción, activación y estadísticas.

## Puesta en marcha rápida

```bash
# 1. Dependencias
npm install

# 2. Variables de entorno
cp .env.example .env.local   # y rellena los valores (ver abajo)

# 3. Base de datos (Supabase → SQL Editor)
#    Pega y ejecuta supabase/schema.sql (esquema completo). Para actualizar
#    una instancia ya creada, corre supabase/EJECUTAR_EN_SUPABASE.sql.

# 4. Iconos PWA (opcional, requiere sharp ya incluido)
npm run icons

# 5. Desarrollo
npm run dev   # http://localhost:3000
```

## Variables de entorno

Ver `.env.example`. Resumen:

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima (pública) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave service role (sólo servidor, panel admin) |
| `OPENAI_API_KEY` | Clave de OpenAI |
| `OPENAI_MODEL` | Modelo de chat (por defecto `gpt-4o-mini`) |
| `OPENAI_VISION_MODEL` | Modelo con visión (por defecto `gpt-4o`) |
| `NEXT_PUBLIC_APP_URL` | URL pública (para callbacks OAuth) |
| `ADMIN_EMAILS` | Emails con acceso al panel admin (coma-separados) |

> La app **compila y arranca** aunque las variables estén vacías; el login y la
> IA se activan al rellenarlas.

## Manuales

- 📦 [Instalación](docs/INSTALACION.md)
- 🚀 [Despliegue (Vercel)](docs/DESPLIEGUE.md)
- 🔧 [Mantenimiento](docs/MANTENIMIENTO.md)
- 🗄️ [Base de datos](supabase/README.md)

## Scripts

| Comando | Acción |
|---|---|
| `npm run dev` | Desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Servir build |
| `npm run lint` | Linter |
| `npm run type-check` | Comprobación de tipos |
| `npm run icons` | Genera los PNG de la PWA desde el SVG |

## Convenciones de desarrollo

Pautas para mantener el proyecto ordenado y predecible:

- **Capas (Clean Architecture).** El dominio y la aplicación (`core/`) no importan
  nada de `next`, `supabase` ni de la UI. La infraestructura implementa los
  puertos de `core/domain/repositories.ts`. La UI y los Server Actions hablan con
  el dominio a través de esas interfaces, nunca con detalles del backend.
- **Lectura vs. escritura.** Las **lecturas** se hacen en Server Components (las
  páginas `app/.../page.tsx`); las **escrituras** en Server Actions
  (`server/actions/*`) con `"use server"`, validando la entrada con `zod` y
  devolviendo `{ ok, error? }`.
- **Tipos.** Estricto, sin `any`. Los tipos de BD viven en `types/database.ts` y
  las entidades se derivan de ahí (`core/domain/entities.ts`). Mantén
  `Relationships: []` en cada tabla y parches de update con campos concretos.
- **Zona horaria.** El "día" de la app es la medianoche en `America/Bogota`. Usa
  siempre los helpers de `lib/utils.ts` (`todayISO`, `dayBoundsUTC`,
  `toAppDateISO`, `shiftDateISO`); no uses `new Date()` para límites de día.
- **Seguridad.** Toda tabla tiene RLS por `user_id`. El cliente `service_role`
  (`infrastructure/supabase/admin`) es **solo de servidor** y exclusivo del admin.
  Las claves nunca se exponen al cliente.
- **IA.** El acceso se controla por plan (`aiEnabled`) y por cuota mensual
  (`consume_ai_credit`). Las imágenes se **comprimen en el dispositivo** antes de
  subirlas para no exceder el límite de Vercel ni encarecer el análisis.
- **UI.** Móvil primero, dentro de `max-w-md`. Inputs a 16px para evitar el zoom
  en iOS. Respeta el área segura con `pt-safe` / `pb-safe` / `px-safe`. Textos en
  español.
- **Antes de commitear.** `npm run type-check` y `npm run build` deben pasar sin
  errores; el linter, sin warnings.
