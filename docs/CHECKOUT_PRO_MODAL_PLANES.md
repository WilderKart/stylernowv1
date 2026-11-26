# Checkout Pro en modal — cobros de la barbería a StylerNow

Rama: `feat/checkout-pro-modal-planes` (desde `main`). **Sin push ni cambios en producción.** No se tocó `next.config.ts`.

## 1. Auditoría (qué había)

**Cobros barbería → StylerNow (cuenta de la plataforma, token `MERCADOPAGO_ACCESS_TOKEN`)**

| Concepto | Entrada (Server Action) | Pantalla |
|---|---|---|
| Plan (primer pago / renovación) | `iniciarPagoPlan` (`panel/suscripcion/actions.ts`, RPC `solicitar_pago_plan`) | `/panel/suscripcion` |
| Upgrade de plan | `iniciarUpgrade` (RPC `solicitar_upgrade_plan`) | `/panel/suscripcion` |
| Barberos adicionales (contratar y renovar) | `contratarAdicionales`, `renovarAdicional` | `/panel/staff/adicionales` |
| Paquetes de créditos de IA | `comprarPaqueteIa` | `/panel/ia` |

Todos pasan por un único punto: `lib/pagos/cobro.ts → crearPreferenciaDePago`. Monto y cuenta de cobro salen de la fila `pago` que fija la base de datos; el navegador solo recibe el resultado.

**Confirmación del pago:** webhook `POST /api/webhooks/mercadopago` (y `/api/webhooks/pasarela/mercadopago` para la `notification_url` de cada preferencia) → `lib/pagos/webhook-mercadopago.ts`: verifica la firma HMAC (con anti-replay de 15 min), re-consulta el pago a la API de Mercado Pago (nunca cree al cuerpo del webhook), compara `live_mode` con el entorno y aplica el efecto de forma idempotente con `aplicar_evento_pago`. Existe además conciliación por consulta (`sincronizarPago`).

**Entorno:** `lib/pagos/entorno.ts`. Sandbox por defecto; producción exige `MERCADOPAGO_ENTORNO=produccion` **y** `VERCEL_ENV=production`; un token `TEST-` se rechaza en producción.

**Marketplace / split — residuos:**
- En los cobros de **plan, adicionales e IA no hay split ni comisión**: la cuenta de cobro es la de la plataforma (`cuenta_cobro` distinto de `NEGOCIO`) y `crearPreferencia` solo envía `marketplace_fee` cuando el cobro usa el token OAuth de un negocio *y* la comisión es > 0. Queda cubierto con una prueba (un cobro de la plataforma nunca envía `marketplace_fee`).
- El código OAuth/Marketplace (`oauth-mercadopago.ts`, `conexiones.ts`, `/api/pagos/mercadopago/*`) pertenece a los **anticipos de reservas del cliente al negocio**, un flujo distinto. No se tocó ni se mezcla con los cobros a StylerNow.

**Variables que el código espera hoy:** `MERCADOPAGO_ENTORNO`, `MERCADOPAGO_ACCESS_TOKEN`, `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`, `MERCADOPAGO_WEBHOOK_SECRET`, `NEXT_PUBLIC_SITE_URL` (y `MERCADOPAGO_CLIENT_ID/SECRET/OAUTH_PKCE` solo para los anticipos de reservas).

**Riesgos / bloqueos detectados**
1. Antes el pago redirigía fuera de la app (`window.location.href`) y la pantalla sondeaba el estado por su cuenta, repetido en 3 pantallas.
2. **Un cobro de plan pendiente bloqueaba al usuario** (`UPGRADE_YA_EN_PROCESO` / `PAGO_SUSCRIPCION_EN_PROCESO`): si cerraba la ventana sin pagar no podía volver a intentarlo.
3. **`auto_return` con URL `http://localhost` hace que Mercado Pago responda 400** (`auto_return invalid`): imposible probar localmente y, si el sitio no es https, el cobro fallaba dejando el cobro pendiente.
4. **Recargas de WhatsApp (pendiente):** hoy crean la solicitud `PENDIENTE_PAGO` y dicen "el pago en línea todavía no está habilitado". La función que acredita (`whatsapp_acreditar_recarga`) solo está anunciada en un comentario de la migración 120; no existe. Habilitarla exige migración (crear el cobro y acreditar al aprobarse) y parchear `aplicar_evento_pago`. No se hizo en esta entrega.
5. **Destacar negocio / publicidad:** no hay un flujo de cobro implementado todavía; cuando exista debe reutilizar `crearPreferenciaDePago` y este modal.
6. CSP en modo solo-reporte (`CSP_ENFORCE`): se añadieron los hosts de Mercado Pago para que, al activarla en serio, el modal no se bloquee.

## 2. Qué se implementó

- **Modal de pago** (`components/pagos/modal-pago-mercadopago.tsx`): abre el Checkout Pro de Mercado Pago (SDK oficial MercadoPago.js v2, `mp.checkout({ preference, autoOpen })`) sobre la pantalla actual. Detrás queda una ventana de StylerNow con los estados: preparando, esperando el pago, **pendiente** (PSE / efectivo / Nequi en proceso), **aprobado**, **rechazado/cancelado** (botón "Intentar de nuevo") y respaldo si el SDK no carga. Se cierra con Esc o con el botón; no usa `window.confirm`.
- **Estado real** (`app/pagos/modal-actions.ts → consultarEstadoPagoModal`): lectura por RLS con la sesión de la persona + reconciliación contra Mercado Pago en el servidor. El navegador nunca decide el estado.
- **Pantallas conectadas:** plan/upgrade, barberos adicionales (contratar y renovar) y paquetes de IA. Al aprobarse, la pantalla se refresca sin salir del panel.
- **Reanudar cobro pendiente:** si ya hay un cobro de plan pendiente se reabre la misma preferencia (idempotente) en vez de bloquear.
- **`auto_return` solo con https.**
- **CSP:** `src/proxy.ts` permite el SDK, los iframes y las imágenes de Mercado Pago.

## 3. Archivos

Nuevos: `src/components/pagos/modal-pago-mercadopago.tsx`, `src/app/pagos/modal-actions.ts`, `tests/checkout-modal-planes.test.ts`, este documento.
Modificados: `src/lib/pagos/mercadopago.ts`, `src/proxy.ts`, `src/app/panel/suscripcion/{actions,vista-suscripcion}.ts(x)`, `src/app/panel/staff/adicionales/{actions,vista-adicionales}.ts(x)`, `src/app/panel/ia/{actions,vista-ai-workspace}.ts(x)`. (`.env.example` está ignorado por git: la variable pública se documentó ahí solo localmente.)

## 4. Variables de entorno (valores en `.env.local` y en Vercel; **nunca en el repositorio**)

| Variable | Qué es | Dónde |
|---|---|---|
| `MERCADOPAGO_ACCESS_TOKEN` | Access Token de la aplicación (servidor). | `.env.local` + Vercel (secreto) |
| `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | Public Key **de la misma aplicación** (se publica al navegador; se incrusta al compilar, hay que redesplegar al cambiarla). | `.env.local` + Vercel |
| `MERCADOPAGO_ENTORNO` | `sandbox` (por defecto) o `produccion` (solo con `VERCEL_ENV=production`). Con credenciales de prueba, `sandbox`. | `.env.local` + Vercel |
| `MERCADOPAGO_WEBHOOK_SECRET` | Clave secreta del webhook (panel de la aplicación → Webhooks). Sin ella el endpoint igual re-consulta el pago, pero no verifica firma. | Vercel (secreto) |
| `NEXT_PUBLIC_SITE_URL` | URL https pública del sitio (retornos y `notification_url`). | Vercel |

Webhook en el panel de Mercado Pago: URL `https://<tu-dominio>/api/webhooks/mercadopago`, eventos de **Pagos** (y órdenes comerciales).

## 5. Prueba hecha (sandbox, entorno local)

Con las credenciales de prueba: la API respondió (cuenta de Colombia, activa), se creó una preferencia, y en la app local el botón *Hacer upgrade* abrió el modal de StylerNow y el checkout de Mercado Pago (`mercadopago.com.co/checkout/v1/modal?preference-id=…`). No se completó un pago real de prueba: lo harás tú. Para probar el webhook en local hace falta un túnel https (Mercado Pago no puede llamar a `localhost`); sin él, el estado se reconcilia por consulta cada 4 s mientras el modal está abierto.

---

## 6. Actualización: todo lo que la barbería paga a StylerNow, por Mercado Pago (cobro directo, sin split)

**Split eliminado:** `crearPreferencia` ya no acepta ni envía `marketplace_fee`; `cobro.ts` no lo lee; se quitaron las banderas `split_1_1` / `marketplace_fee_cero` y el nombre `TIPOS_EXCLUIDOS_SPLIT` pasó a `TIPOS_EXCLUIDOS_COBRO_NEGOCIO`. Lo que se conserva y NO es split: la conexión OAuth del negocio con su propia cuenta de Mercado Pago (los anticipos de reservas se cobran directo al negocio con el token del vendedor, comisión 0). La columna `pago.marketplace_fee` queda en la base (sin uso desde el código; no se borra para no tocar datos).

**Qué puede pagar la barbería ahora, todo por el mismo modal:**

| Concepto | Estado |
|---|---|
| Plan (primer pago y renovación) y upgrade | ya existía; ahora en modal |
| Barberos adicionales (contratar y renovar) | ya existía; ahora en modal |
| Créditos de IA | ya existía; ahora en modal |
| **Recargas de conversaciones de WhatsApp** | **nuevo** (botón «Comprar recarga» y «Pagar» en solicitudes pendientes) |
| **Add-on Mi Marca (mensual)** | **nuevo** («Activar Mi Marca» / «Renovar un mes»); se activa un mes al aprobarse y vence a los 30 días |

**Migración 199 (`supabase/migrations/199_pagos_whatsapp_y_mi_marca.sql`) — obligatoria para WhatsApp y Mi Marca.** Crea `whatsapp_iniciar_pago_recarga`, `mi_marca_iniciar_pago`, las funciones internas que aplican el pago (idempotentes, solo desde `aplicar_evento_pago`) y parchea `aplicar_evento_pago` con ruta propia para esos dos conceptos. Probada en la base local con `tests/sql/pagos_whatsapp_mi_marca.sql` (rechazo, reintento, aprobación una sola vez, webhook repetido, otro negocio no puede cobrar, Mi Marca no bloquea el upgrade, funciones internas no ejecutables por `authenticated`). **Sin la 199 aplicada, el código nuevo no rompe nada**: los botones muestran «se está activando» y el resto de pagos sigue igual. Orden: aplicar 199 → desplegar (o desplegar primero, es seguro).

**No existen todavía como cobro (no hay producto que cobrar):** sedes adicionales (solo hay precio configurado, sin flujo ni límite), publicidad/destacado (se descuenta del Wallet de comisiones; no hay recarga del Wallet por Mercado Pago).

### Pasar a producción: lo único que hay que hacer en Vercel
1. `MERCADOPAGO_ACCESS_TOKEN` = Access Token **de producción** (secreto).
2. `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` = Public Key **de producción** de la misma aplicación (redesplegar para que se incruste).
3. `MERCADOPAGO_ENTORNO` = `produccion` (solo funciona en el despliegue de producción de Vercel; con `sandbox` o sin la variable se queda en pruebas).
4. `MERCADOPAGO_WEBHOOK_SECRET` = clave secreta del webhook de esa aplicación.
5. En el panel de Mercado Pago (aplicación de producción): webhook `https://app.stylernow.com/api/webhooks/mercadopago`, eventos de Pagos.
`NEXT_PUBLIC_SITE_URL` debe ser `https://app.stylernow.com`. `/admin/sistema` muestra qué variables faltan.
