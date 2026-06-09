"use client";

import { useRouter } from "next/navigation";
import { MessageCircle, LogOut } from "lucide-react";
import { createClient } from "@/infrastructure/supabase/client";
import { Button } from "@/components/ui/button";
import { env } from "@/lib/env";

export function SubscribeActions({ userEmail }: { userEmail?: string }) {
  const router = useRouter();

  const waText = encodeURIComponent(
    `Hola, soy ${userEmail ?? "un usuario"} de NutriAI. Ya hice el pago de la mensualidad por Nequi y quiero activar mi mes.`,
  );
  const waLink = env.supportWhatsapp
    ? `https://wa.me/${env.supportWhatsapp.replace(/\D/g, "")}?text=${waText}`
    : null;

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {waLink && (
        <Button asChild className="w-full">
          <a href={waLink} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-4 w-4" /> Ya pagué — enviar comprobante
          </a>
        </Button>
      )}
      <Button variant="outline" className="w-full" onClick={signOut}>
        <LogOut className="h-4 w-4" /> Cerrar sesión
      </Button>
    </div>
  );
}
