# Publicar NutriAI en tiendas (Android / iOS) — plan y costos

> Documento de referencia para cuando se decida salir de PWA a las tiendas.
> Hoy la app funciona como **PWA** (instalable desde el navegador en Android e
> iOS, sin comisión de tienda ni cuotas anuales). Esto es solo para el futuro.

## Decisión clave: comisión de las tiendas

Si la suscripción desbloquea funciones **digitales dentro del app**, Apple y
Google **exigen su cobro in-app y se llevan 15–30%**. No permiten cobrar la
suscripción con Wompi/PSE dentro de iOS (regla 3.1.1 de Apple). Caminos:

- **A. Pago solo en la web** (el app es "companion": el usuario inicia sesión con
  una cuenta ya pagada en la web). Barato; riesgo de rechazo de Apple si todo el
  valor está tras un muro pagado por fuera.
- **B. Implementar IAP** (In-App Purchase de Apple + Google Play Billing): pierdes
  15–30% pero pasas seguro la revisión.
- **C. Quedarse en PWA**: sin comisión de tienda ni $99/año. Es lo actual.

## ¿Servidor propio? No

Arquitectura *serverless*: **Vercel** (app Next.js) + **Supabase** (BD, auth,
storage). No se administra ningún VPS. El cobro se hace con la **pasarela**
(Wompi/ePayco) por transacción.

## Cómo se convierte a app

Con **Capacitor** se envuelve el mismo código Next.js en contenedores nativos de
Android e iOS (herramienta gratuita). El costo no es licencia: son las cuentas de
tienda y, para iOS, un Mac o un CI en la nube para compilar/firmar.

## Cuadro 1 — Gastos de arranque (una vez / anual)

| Concepto | Costo (≈ COP) | Frecuencia | Nota |
|---|---|---|---|
| Cuenta Google Play | $100.000 (USD 25) | Única vez | De por vida |
| Apple Developer | $400.000 (USD 99) | Anual | Obligatorio App Store |
| Mac para compilar iOS | $2.5M–$3M (Mac mini) | Única vez | O CI en la nube |
| Convertir PWA→app (Capacitor) | $0 | Única vez | Herramienta gratis |
| Dominio propio (opcional) | $50.000 | Anual | Opcional |
| Política de privacidad + términos | $0–$1.5M | Única vez | Generador / abogado |
| RUT / registro para cobrar | bajo | Única vez | Requerido por la pasarela |

## Cuadro 2 — Mantenimiento mes a mes

| Concepto | Lean (arranque) | Producción | Nota |
|---|---|---|---|
| Hosting (Vercel) | $0 (Hobby) | $80.000 (USD 20) | Pro: sin límites |
| Base de datos (Supabase) | $0 (Free) | $100.000 (USD 25) | Pro: backups, no se duerme |
| OpenAI (IA) | $40k–$240k | $80k–$400k | Variable según uso |
| Apple Developer (prorrateado) | $33.000 | $33.000 | $400k ÷ 12 |
| CI iOS (si no hay Mac) | $0 | $0–$380.000 | Codemagic / EAS |
| Push (VAPID) | $0 | $0 | Propio |
| Pasarela | por transacción | por transacción | Sin fijo |
| **Total aprox./mes** | **$70k–$300k** | **$290k–$1M** | Sin comisión por venta |

## Comisión de la pasarela (efectiva)

Tarifa típica: **2,65% + $700 + IVA(19%)** por transacción exitosa.

| Venta | Comisión | Te queda | % real |
|---|---|---|---|
| Plan IA $20.000 | ≈ $1.464 | $18.536 | ~7,3% |
| Plan General $10.000 | ≈ $1.148 | $8.852 | ~11,5% |

El **$700 fijo** pega más fuerte en montos chicos.

## Camino recomendado (por fases)

1. **Hoy:** PWA + pago web con Wompi. Casi $0, sin comisión de tienda.
2. **Con tracción:** Vercel Pro + Supabase Pro (~$180k/mes) para estabilidad.
3. **Tiendas:** primero **Google Play** (barato). Dejar **iOS** para después por
   el Mac + $99/año + la comisión del 30%.

## Checklist antes de publicar

- Cuenta de pasarela con RUT/registro para recibir pagos.
- Política de privacidad + términos (datos de salud → Ley 1581 Habeas Data).
- Cuentas de desarrollador (Apple/Google) a nombre de la empresa o persona.
- Íconos, splash y capturas de tienda.
- (iOS) Decidir A/B/C arriba para el tema de la comisión.

> Cifras a 1 USD ≈ $4.000 COP (varía). Actualizar al momento de ejecutar.
