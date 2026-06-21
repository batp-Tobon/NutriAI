"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2,
  CreditCard,
  ImagePlus,
  Loader2,
  LogOut,
  MessageCircle,
} from "lucide-react";
import { createClient } from "@/infrastructure/supabase/client";
import {
  createWompiCheckout,
  submitPaymentProof,
} from "@/server/actions/payments";
import { Button } from "@/components/ui/button";
import { env } from "@/lib/env";

/** Comprime una imagen a JPEG en el dispositivo (evita subir archivos enormes). */
async function compressImage(file: File, maxDim = 1280, quality = 0.8): Promise<Blob> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result as string);
    fr.onerror = () => rej(new Error("read"));
    fr.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error("img"));
    im.src = dataUrl;
  });
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob>((res) =>
    canvas.toBlob((b) => res(b!), "image/jpeg", quality),
  );
}

export function SubscribeActions({
  userId,
  userEmail,
  hasPending = false,
  wompiEnabled = false,
}: {
  userId: string;
  userEmail?: string;
  hasPending?: boolean;
  wompiEnabled?: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [plan, setPlan] = useState<"general" | "ai">("ai");
  const [reference, setReference] = useState("");
  const [proofPath, setProofPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, startSubmit] = useTransition();
  const [paying, startPay] = useTransition();

  function payOnline() {
    startPay(async () => {
      const res = await createWompiCheckout(plan);
      if (!res.ok || !res.url) {
        toast.error(res.error ?? "No se pudo iniciar el pago");
        return;
      }
      window.location.href = res.url; // redirige al checkout de Wompi
    });
  }

  const waText = encodeURIComponent(
    `Hola, soy ${userEmail ?? "un usuario"} de NutriAI. Ya hice el pago por Bre-B y envío mi comprobante.`,
  );
  const waLink = env.supportWhatsapp
    ? `https://wa.me/${env.supportWhatsapp.replace(/\D/g, "")}?text=${waText}`
    : null;

  async function onPickProof(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setUploading(true);
    try {
      const blob = await compressImage(f);
      const supabase = createClient();
      const path = `${userId}/${Date.now()}.jpg`;
      const { error } = await supabase.storage
        .from("payment-proofs")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (error) {
        toast.error("No se pudo subir el comprobante. Intenta de nuevo.");
        return;
      }
      setProofPath(path);
      toast.success("Comprobante adjunto");
    } catch {
      toast.error("No se pudo procesar la imagen.");
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    startSubmit(async () => {
      const res = await submitPaymentProof({
        plan,
        reference,
        proofPath: proofPath ?? undefined,
      });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo enviar");
        return;
      }
      toast.success("¡Recibido! Confirmaremos tu pago pronto.");
      router.refresh();
    });
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (hasPending) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-4 text-left">
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
          <div>
            <p className="text-sm font-semibold">Pago en revisión</p>
            <p className="text-xs text-muted-foreground">
              Recibimos tu comprobante. Lo confirmaremos pronto (máx. 24 h).
            </p>
          </div>
        </div>
        <Button variant="outline" className="w-full" onClick={signOut}>
          <LogOut className="h-4 w-4" /> Cerrar sesión
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-left">
      {/* Plan elegido (compartido por el pago en línea y el manual) */}
      <div className="grid grid-cols-2 gap-2">
        {(["general", "ai"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPlan(p)}
            className={
              plan === p
                ? "rounded-xl border border-primary bg-primary/10 px-3 py-2 text-sm font-semibold"
                : "rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground"
            }
          >
            Plan {p === "ai" ? "IA" : "General"}
          </button>
        ))}
      </div>

      {/* Pago en línea (Wompi) — sólo si está configurado */}
      {wompiEnabled && (
        <>
          <Button className="w-full" onClick={payOnline} disabled={paying}>
            {paying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CreditCard className="h-4 w-4" />
            )}
            Pagar plan {plan === "ai" ? "IA" : "General"} en línea
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            Tarjeta · Nequi · PSE · Bancolombia · se activa automáticamente
          </p>
          <div className="flex items-center gap-2 pt-1 text-[11px] text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> o envía tu comprobante
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      <p className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Confirmar pago manual (Bre-B)
      </p>

      <input
        value={reference}
        onChange={(e) => setReference(e.target.value)}
        placeholder="Referencia o nombre de quien pagó (opcional)"
        className="h-11 w-full rounded-xl border border-input bg-secondary/40 px-3 text-base"
      />

      {/* Comprobante (opcional) */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPickProof}
      />
      <Button
        variant="outline"
        className="w-full"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : proofPath ? (
          <CheckCircle2 className="h-4 w-4 text-primary" />
        ) : (
          <ImagePlus className="h-4 w-4" />
        )}
        {proofPath ? "Comprobante adjunto ✓" : "Adjuntar comprobante (foto)"}
      </Button>

      <Button className="w-full" onClick={submit} disabled={submitting || uploading}>
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Enviar para confirmación
      </Button>

      {waLink && (
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <MessageCircle className="h-3.5 w-3.5" /> o envíalo por WhatsApp
        </a>
      )}

      <Button variant="ghost" className="w-full" onClick={signOut}>
        <LogOut className="h-4 w-4" /> Cerrar sesión
      </Button>
    </div>
  );
}
