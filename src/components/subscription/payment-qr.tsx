"use client";

import { useState } from "react";

/**
 * Muestra el QR de pago SOLO si existe `public/payment-qr.png`.
 * Mientras no cargue (o si no existe) permanece oculto: nada de imagen rota.
 */
export function PaymentQR() {
  const [loaded, setLoaded] = useState(false);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/payment-qr.png"
      alt="QR de pago Bre-B"
      onLoad={() => setLoaded(true)}
      onError={() => setLoaded(false)}
      className={
        loaded
          ? "mx-auto h-44 w-44 rounded-xl bg-white object-contain p-2"
          : "hidden"
      }
    />
  );
}
