"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Apple, Bell, Droplet, Dumbbell } from "lucide-react";
import { markNotificationRead } from "@/server/actions/notifications";
import { cn } from "@/lib/utils";
import type { Notification } from "@/core/domain/entities";

const ICONS = {
  meal: Apple,
  workout: Dumbbell,
  hydration: Droplet,
  system: Bell,
} as const;

export function NotificationItem({ n }: { n: Notification }) {
  const router = useRouter();
  const [, start] = useTransition();
  const Icon = ICONS[n.type] ?? Bell;
  const unread = !n.read_at;

  function onClick() {
    if (!unread) return;
    start(async () => {
      await markNotificationRead(n.id);
      router.refresh();
    });
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
        unread
          ? "border-primary/30 bg-primary/5"
          : "border-border/60 bg-card opacity-70",
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{n.title}</p>
        {n.body && (
          <p className="text-xs text-muted-foreground">{n.body}</p>
        )}
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {new Date(n.created_at).toLocaleString("es", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
      {unread && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}
    </button>
  );
}
