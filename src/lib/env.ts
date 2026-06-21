/** Acceso centralizado a variables de entorno + comprobaciones de configuración. */

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  openaiKey: process.env.OPENAI_API_KEY ?? "",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  openaiVisionModel: process.env.OPENAI_VISION_MODEL ?? "gpt-4o",
  rapidApiKey: process.env.RAPIDAPI_KEY ?? "",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  adminEmails: (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
  // Suscripción / apoyo (Bre-B · Nequi / Bancolombia)
  paymentKey: process.env.NEXT_PUBLIC_PAYMENT_KEY ?? "",
  priceGeneral: process.env.NEXT_PUBLIC_PRICE_GENERAL ?? "",
  priceAi: process.env.NEXT_PUBLIC_PRICE_AI ?? "",
  supportWhatsapp: process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "",
  cronSecret: process.env.CRON_SECRET ?? "",
  // Límite mensual de usos de IA por usuario (control de costos)
  aiMonthlyLimit: Number(process.env.AI_MONTHLY_LIMIT ?? "200"),
  // Notificaciones push (Web Push / VAPID)
  vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? "",
  vapidSubject: process.env.VAPID_SUBJECT ?? "mailto:admin@nutriai.app",
  // Pasarela de pagos Wompi (Bancolombia). Inerte hasta que se configuren.
  wompiPublicKey: process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY ?? "",
  wompiIntegritySecret: process.env.WOMPI_INTEGRITY_SECRET ?? "",
  wompiEventsSecret: process.env.WOMPI_EVENTS_SECRET ?? "",
};

/** Wompi está listo si hay llave pública (checkout) y secreto de integridad (firma). */
export const isWompiConfigured = () =>
  Boolean(env.wompiPublicKey && env.wompiIntegritySecret);

export const isPushConfigured = () =>
  Boolean(env.vapidPublicKey && env.vapidPrivateKey);

export const isSupabaseConfigured = () =>
  Boolean(env.supabaseUrl && env.supabaseAnonKey);

export const isOpenAIConfigured = () => Boolean(env.openaiKey);

export const isExerciseDBConfigured = () => Boolean(env.rapidApiKey);
