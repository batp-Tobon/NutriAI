import { createClient, getCurrentUser } from "@/infrastructure/supabase/server";
import { createNotificationRepository } from "@/infrastructure/supabase/repositories";
import { NotificationItem } from "@/components/notifications/notification-item";

export const metadata = { title: "Notificaciones" };

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const items = await createNotificationRepository(supabase).list(user!.id, 50);

  return (
    <div className="space-y-4 py-2">
      <h1 className="text-xl font-bold">Notificaciones</h1>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No tienes notificaciones todavía. Aquí verás recordatorios de comidas,
          entrenamientos e hidratación.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <NotificationItem key={n.id} n={n} />
          ))}
        </div>
      )}
    </div>
  );
}
