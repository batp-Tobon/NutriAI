"use client";

/**
 * Escáner de código de barras con la cámara (ZXing). Abre la cámara trasera,
 * detecta el código EAN/UPC en vivo y devuelve el número por `onDetected`.
 * Funciona en iOS Safari y Android Chrome (requiere HTTPS y permiso de cámara).
 */

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { Loader2, X } from "lucide-react";

export function BarcodeScanner({
  onDetected,
  onClose,
}: {
  onDetected: (code: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Guardamos el callback en un ref para arrancar la cámara UNA sola vez
  // (si dependiéramos de `onDetected` se reiniciaría en cada render del padre).
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let stopped = false;
    let controls: { stop: () => void } | undefined;

    reader
      .decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
        if (result && !stopped) {
          stopped = true;
          try {
            navigator.vibrate?.(80);
          } catch {
            /* no soportado */
          }
          controls?.stop();
          onDetectedRef.current(result.getText());
        }
      })
      .then((c) => {
        controls = c;
        setReady(true);
      })
      .catch(() => {
        setError("No se pudo abrir la cámara. Revisa los permisos y usa HTTPS.");
      });

    return () => {
      stopped = true;
      try {
        controls?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 pt-safe pb-2 text-white">
        <p className="text-sm font-medium">Escanea el código de barras</p>
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="rounded-full bg-white/15 p-2"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
        />

        {/* Marco guía */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-32 w-72 max-w-[80%] rounded-xl border-2 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
        </div>

        {!ready && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Abriendo cámara…</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center text-white">
            <p className="text-sm">{error}</p>
            <button
              onClick={onClose}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>

      <p
        className="px-6 pt-3 text-center text-xs text-white/70"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
      >
        Centra el código dentro del recuadro. Se detecta solo.
      </p>
    </div>
  );
}
