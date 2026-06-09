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
├── core/                      # Dominio (sin dependencias de framework)
│   ├── domain/
│   │   ├── entities.ts        # Entidades de dominio
│   │   └── repositories.ts    # Contratos (puertos)
│   └── application/
│       └── nutrition.ts       # Lógica de negocio pura (BMR/TDEE/macros)
├── infrastructure/            # Adaptadores
│   ├── supabase/              # Clientes + repositorios (Repository Pattern)
│   └── openai/                # Vision, coach, generador de rutinas
├── server/actions/            # Server Actions (casos de uso de escritura)
├── app/                       # Rutas (App Router)
│   ├── (auth)/                # login, registro, recuperación
│   ├── (app)/                 # dashboard, log, plan, progress, coach, profile
│   ├── admin/                 # panel administrativo
│   └── api/                   # análisis de comida, coach
├── components/                # UI (ShadCN + features)
├── lib/                       # utils, env, constantes
└── types/                     # tipos de BD
```

La UI depende de **interfaces** de repositorio (`core/domain/repositories.ts`),
no de Supabase directamente → fácil de testear y de cambiar el backend.

## Módulos

1. **Autenticación** — email/contraseña, Google, Apple, recuperación, sesiones.
2. **Perfil / Onboarding** — datos + cálculo automático de objetivos calóricos.
3. **Dashboard** — calorías restantes, macros, peso, progreso.
4. **Análisis de comidas IA** — foto o texto → alimentos, porciones, macros.
5. **Historial** — comidas del día (diario/semanal/mensual vía consultas).
6. **Seguimiento corporal** — peso, % grasa, masa muscular, medidas, gráficas.
7. **Entrenamiento** — rutinas IA (casa, gym, cardio, hipertrofia).
8. **Coach IA** — chat especializado en nutrición y entrenamiento.
9. **Notificaciones** — comidas, entrenamientos, hidratación.
10. **Panel admin** — usuarios, actividad, estadísticas.

## Puesta en marcha rápida

```bash
# 1. Dependencias
npm install

# 2. Variables de entorno
cp .env.example .env.local   # y rellena los valores (ver abajo)

# 3. Base de datos (ver supabase/README.md)
#    Aplica las migraciones en tu proyecto Supabase.

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
