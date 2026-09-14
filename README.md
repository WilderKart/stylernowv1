# StylerNow

Plataforma de reservas para negocios de belleza, cuidado personal y bienestar en Colombia:
barberías, salones, spas, uñas y estética. Una sola app para que el Cliente descubra un
negocio, reserve su turno y pague la seña, y para que el negocio opere su agenda.

## Stack

- **Next.js 16** (App Router, Turbopack) · React 19 · TypeScript
- **Tailwind v4** con tokens de diseño en `src/app/globals.css`
- **Supabase** — Postgres, Auth (OTP por email), Storage y RLS
- **Mercado Pago** (Checkout Pro) para el cobro de la seña

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # completar con los valores reales
npm run dev
```

### Variables de entorno

Todas están documentadas en `.env.example`. `.env.local` está en `.gitignore` —
nunca commitear credenciales.

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente de Supabase en navegador y servidor |
| `SUPABASE_SECRET_KEY` | Operaciones de sistema que saltan RLS (pagos, auditoría) |
| `DATABASE_URL` | Solo para correr migraciones |
| `NEXT_PUBLIC_SITE_URL` | `back_urls` y `notification_url` de la pasarela |
| `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` / `MERCADOPAGO_ACCESS_TOKEN` | Checkout Pro |
| `MERCADOPAGO_WEBHOOK_SECRET` | Firma HMAC del webhook (se obtiene al registrar la URL en el panel) |

### Base de datos

Las migraciones son la fuente de verdad del esquema y se aplican en orden:

```bash
supabase db push --db-url "$DATABASE_URL"
supabase gen types typescript --db-url "$DATABASE_URL" > src/types/database.ts
```

`src/types/database.ts` es generado: no se edita a mano, se regenera después de cada
migración.

## Estructura

```
src/
  app/                    Rutas (App Router)
    negocio/[slug]/       Perfil público + flujo de reserva
    reserva/[id]/         Pago, confirmación y descarga .ics
    api/webhooks/         Entrada de la pasarela de pago
  components/             UI y layout compartidos
  lib/
    supabase/             Clientes de navegador, servidor y service_role
    pagos/                Adaptador de Mercado Pago y reconciliación
  types/database.ts       Tipos generados desde el esquema
supabase/migrations/      Esquema, RLS y RPC
StylerNow_Project_Bible_V3/  Especificación normativa del producto
```

## Cómo trabajar acá

**La especificación manda.** `StylerNow_Project_Bible_V3/` define las reglas de negocio,
la UX y los contratos de API. El código la cita por ruta en los comentarios: si una regla
cambia, cambia primero ahí.

**Las decisiones de autorización son del servidor.** Ningún precio, monto, `staff_id` ni
estado de pago se acepta del cliente. Las RPC de `supabase/migrations/008_booking_engine.sql`
recalculan todo desde la base con la identidad de `auth.uid()`, y el estado de un pago
siempre se re-consulta contra la API de la pasarela — nunca se lee del cuerpo del webhook
ni de la URL de retorno.

**La disponibilidad se garantiza en la base, no en la app.** El solape de reservas lo
impide un `EXCLUDE USING gist` sobre `(staff_id, rango)`, no una validación en TypeScript.

**Antes de dar algo por terminado:**

```bash
npx tsc --noEmit
npx eslint src --max-warnings=0
npx next build
```

> Este repo corre una versión de Next.js con cambios de API respecto de lo habitual.
> Las docs de la versión exacta viven en `node_modules/next/dist/docs/` — conviene
> consultarlas antes de escribir código de framework.
