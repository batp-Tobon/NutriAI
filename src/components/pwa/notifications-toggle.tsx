"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, BellOff, Loader2, Share, SquarePlus } from "lucide-react";
import {
  removePushSubscription,
  savePushSubscription,
} from "@/server/actions/push";
import { Button } from "@/components/ui/button";
import { env } from "@/lib/env";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

type State = "loading" | "unsupported" | "ios-install" | "ready";

export function NotificationsToggle() {
  const [state, setState] = useState<State>("loading");
  const [subscribed, setSubscribed] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!env.vapidPublicKey) {
      setState("unsupported");
      return;
    }
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    const hasPush = "serviceWorker" in navigator && "PushManager" in window;

    if (hasPush && (!isIOS || isStandalone)) {
      setState("ready");
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((s) => setSubscribed(Boolean(s)))
        .catch(() => {});
    } else if (isIOS && !isStandalone) {
      // iOS solo permite push con la app instalada (iOS 16.4+)
      setState("ios-install");
    } else {
      setState("unsupported");
    }
  }, []);

  async function enable() {
    setWorking(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast.error(
          "Permiso denegado. Actívalo en los ajustes de notificaciones de tu teléfono.",
        );
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(env.vapidPublicKey),
      });
      const json = sub.toJSON();
      if (!json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("keys");
      }
      const res = await savePushSubscription({
        endpoint: sub.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      });
      if (!res.ok) {
        toast.error(
          "No se pudo guardar la suscripción en el servidor. Inténtalo de nuevo.",
        );
        return;
      }
      setSubscribed(true);
      toast.success("Notificaciones activadas 🔔");
    } catch {
      toast.error("No se pudo activar en este dispositivo. Inténtalo de nuevo.");
    } finally {
      setWorking(false);
    }
  }

  async function disable() {
    setWorking(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast.success("Notificaciones desactivadas");
    } catch {
      toast.error("Error al desactivar");
    } finally {
      setWorking(false);
    }
  }

  if (state === "loading" || state === "unsupported") return null;

  if (state === "ios-install") {
    return (
      <div className="space-y-2 rounded-2xl border border-border bg-secondary/30 p-3">
        <p className="text-sm font-semibold">
          En iPhone, primero instala la app 📲
        </p>
        <ol className="space-y-1.5 text-xs text-muted-foreground">
          <li className="flex items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
              1
            </span>
            Toca el botón <Share className="inline h-3.5 w-3.5" />{" "}
            <b>Compartir</b> de Safari.
          </li>
          <li className="flex items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
              2
            </span>
            Elige <SquarePlus className="inline h-3.5 w-3.5" />{" "}
            <b>Añadir a pantalla de inicio</b>.
          </li>
          <li className="flex items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
              3
            </span>
            Abre <b>NutriAI</b> desde el icono y vuelve aquí para activarlas.
          </li>
        </ol>
      </div>
    );
  }

  return (
    <Button
      variant={subscribed ? "outline" : "default"}
      className="w-full"
      onClick={subscribed ? disable : enable}
      disabled={working}
    >
      {working ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : subscribed ? (
        <BellOff className="h-4 w-4" />
      ) : (
        <Bell className="h-4 w-4" />
      )}
      {subscribed ? "Desactivar notificaciones" : "Activar notificaciones"}
    </Button>
  );
}
