"use client";

import { useState } from "react";

/**
 * Muestra el QR de pago si existe `public/payment-qr.png`.
 * Si no está, no renderiza nada (se oculta solo).
 */
export function PaymentQR() {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/payment-qr.png"
      alt="QR de pago Bre-B"
      onError={() => setOk(false)}
      className="mx-auto h-44 w-44 rounded-xl bg-white object-contain p-2"
    />
  );
}
