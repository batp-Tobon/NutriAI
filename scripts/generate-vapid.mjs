// Genera un par de llaves VAPID para notificaciones push.
// Uso: npm run vapid  → copia las dos llaves a tu .env.local / Vercel.
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
console.log("NEXT_PUBLIC_VAPID_PUBLIC_KEY=" + keys.publicKey);
console.log("VAPID_PRIVATE_KEY=" + keys.privateKey);
console.log("VAPID_SUBJECT=mailto:tu-email@ejemplo.com");
