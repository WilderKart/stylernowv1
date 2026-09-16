# Registry de Componentes UI — ADR-012

> **Nota de arquitectura**: ADR-012 pide que los componentes queden envueltos
> en `packages/ui`. StylerNow es hoy un único paquete Next.js, no un
> monorepo — `src/components/ui/` es el equivalente real de `packages/ui`
> en esta estructura (ya era, antes de este ADR, la carpeta compartida de
> UI del proyecto). Migrar a un monorepo real es un cambio estructural de
> alto riesgo para una app ya en producción y no aporta nada que esta
> carpeta no dé ya — se documenta acá en vez de crear una carpeta
> `packages/` vacía que nadie más usaría.

Cada componente instalado vía `npx shadcn@latest add ...` se restyleó para
usar los tokens de diseño de StylerNow (`src/app/globals.css`, tema
`@theme`) en vez de las variables genéricas de shadcn (`--background`,
`--primary`, etc., que no existen en este proyecto) — ver el mapeo de
tokens al final de este documento.

## Componentes shadcn/ui (registry oficial)

| Componente | Origen | Versión (CLI) | Uso | Módulos |
|---|---|---|---|---|
| `skeleton` | shadcn/ui | shadcn@4.21.0 | Placeholder de carga (`bg-surface-2`, no el ámbar de marca) | `loading.tsx` de las 9 áreas obligatorias (ver abajo) |
| `sonner` | shadcn/ui | shadcn@4.21.0 | Toasts globales — restyleado sin `next-themes` (app dark-only) | `src/app/layout.tsx` (Toaster global) |
| `drawer` | shadcn/ui | shadcn@4.21.0 | Panel deslizante inferior (mobile) | Instalado, pendiente de colocación |
| `calendar` | shadcn/ui | shadcn@4.21.0 | Selector de fecha | Instalado, pendiente de colocación |
| `command` | shadcn/ui | shadcn@4.21.0 | Command palette (cmd+k) | Instalado, pendiente de colocación |
| `carousel` | shadcn/ui | shadcn@4.21.0 | Carrusel (Embla) | Instalado, pendiente de colocación |
| `empty` | shadcn/ui | shadcn@4.21.0 | Empty state | Instalado — no reemplaza los empty states existentes (docenas en todo el proyecto); usar en pantallas NUEVAS de acá en adelante |
| `progress` | shadcn/ui | shadcn@4.21.0 | Barra de progreso | `src/app/lealtad/vista-lealtad.tsx` (progreso de Sellos, reemplazó una barra hecha a mano) |
| `tooltip` | shadcn/ui | shadcn@4.21.0 | Tooltip | Instalado, pendiente de colocación |
| `popover` | shadcn/ui | shadcn@4.21.0 | Popover | Instalado, pendiente de colocación |
| `context-menu` | shadcn/ui | shadcn@4.21.0 | Menú contextual (click derecho) | Instalado, pendiente de colocación |
| `input-otp` | shadcn/ui | shadcn@4.21.0 | Input de código OTP | Instalado — sin caso de uso hoy (no hay verificación OTP en el proyecto); ver también `otp-input` de rare-ui abajo, evaluar cuál usar si surge el caso |
| `dialog` | shadcn/ui (dependencia de `command`) | shadcn@4.21.0 | Modal | Instalado como dependencia, pendiente de colocación directa |

## Componentes rare-ui (`swamimalode07/rare-ui`)

| Componente | Uso | Módulos |
|---|---|---|
| `duration-picker` | Selector visual de duración (horas/minutos) | Instalado, pendiente — candidato natural: `duracion_minutos` de Servicios (`/panel/servicios/nuevo`) |
| `otp-input` | Input de código OTP (alternativa a `input-otp`) | Instalado, pendiente — mismo caso que `input-otp` |
| `emoji-reaction` | Reacciones con emoji | Instalado, pendiente — sin caso de uso definido en la Biblia todavía |
| `animated-counter` | Contador numérico animado | `/admin/lealtad` (métricas de plataforma — saldo Wallets, Gift Cards, etc.) |
| `fluid-orb` | Orbe animado decorativo | Instalado, pendiente — decorativo puro, sin función; se instala por pedido explícito del fundador, se coloca solo si aparece un lugar genuino (nunca "porque es bonito" sin más) |

## Skeleton — cobertura de las 9 áreas obligatorias (ADR-012)

Implementado como `loading.tsx` de Next.js App Router (Suspense automático
de Next.js sobre el Server Component de cada página — no requiere tocar
la lógica de datos existente de ninguna página):

| Área | Archivo |
|---|---|
| Dashboard | `src/app/panel/loading.tsx` |
| Agenda | `src/app/panel/agenda/loading.tsx` |
| Marketplace | `src/app/loading.tsx` (Home = `app/page.tsx`, raíz de `app/`) |
| Staff | `src/app/panel/staff/loading.tsx` |
| CRM | `src/app/panel/crm/loading.tsx` |
| Inventario | `src/app/panel/inventario/loading.tsx` |
| Reportes | `src/app/panel/reportes/loading.tsx` |
| Perfil | `src/app/perfil/loading.tsx` |
| Panel SuperSU | `src/app/admin/loading.tsx` |

**Trade-off aceptado**: `src/app/loading.tsx` (Marketplace) es el
`loading.tsx` de la raíz de `app/`, así que también sirve de fallback para
cualquier ruta SIN su propio `loading.tsx` (ej. `/login`, `/favoritos`,
`/mis-reservas`) durante su primera carga — un destello breve de la forma
de Marketplace en vez de un genérico. Se acepta este trade-off en vez de
crear 10+ archivos `loading.tsx` genéricos solo para evitarlo; ninguna de
esas rutas es una de las 9 áreas obligatorias.

## Mapeo de tokens (shadcn genérico → StylerNow)

| Token shadcn | Token StylerNow | Nota |
|---|---|---|
| `bg-background` / `text-foreground` | `bg-bg` / `text-text` | |
| `bg-card`, `bg-popover` | `bg-surface` | |
| `text-card-foreground`, `text-popover-foreground` | `text-text` | |
| `bg-primary` | `bg-accent` | Coincide semánticamente (ámbar de marca) |
| `text-primary-foreground` | `text-bg` | Igual que `Button` variant="primary" |
| `bg-secondary`, `bg-muted` | `bg-surface-2` | |
| `text-muted-foreground` | `text-text-muted` | |
| `bg-accent` (genérico de shadcn, hover) | `bg-accent-soft` | **Colisión de nombre real**: el "accent" de shadcn es un hover neutro, el de StylerNow es el ámbar de marca — se mapea a la versión translúcida para no pintar cada hover de ámbar sólido |
| `text-accent-foreground` | `text-accent` | |
| `bg-destructive` / `text-destructive` | `bg-danger-soft` / `text-danger` | |
| `border-input`, `border-ring` | `border-border`, `border-accent` | |

## Reglas de gobernanza (ADR-012)

1. Todo componente resuelve una necesidad ya definida en la Biblia.
2. Se integra completo con el backend existente antes de darse por
   colocado (nunca un componente "de adorno" sin datos reales detrás).
3. Respeta el diseño aprobado — ver mapeo de tokens arriba.
4. Funciona en modo oscuro — StylerNow es dark-only por diseño (sin
   toggle de tema), así que "funcionar en oscuro" es la única superficie
   que existe; no se agregó un `ThemeProvider` que no tendría otro uso.
5. Accesible — se mantiene la semántica ARIA que cada primitivo (Radix UI
   /Base UI) ya trae de fábrica.
6. Responsive — se probó en el ancho mínimo (~400px) de las convenciones
   ya vigentes del proyecto.
7. Envuelto en `src/components/ui/` (equivalente de `packages/ui`, ver nota arriba).
8. Nunca se importa un componente directo del registry en múltiples
   lugares sin pasar por este wrapper — todo consumo es vía
   `@/components/ui/<nombre>`.
