# ADR-012 — Component Registry Governance

## Estado
Aprobada por el fundador (2026-09-16). Autoriza instalar componentes de `shadcn/ui` y registries compatibles (`rare-ui`) sin pedir autorización previa, sujeto a las reglas de esta ADR.

## Contexto
Hasta este ADR, cada componente UI de StylerNow era escrito a mano (`src/components/ui/button.tsx`, `card.tsx`, `input.tsx`, `rating.tsx`). El fundador pide adoptar componentes de registries externos donde reduzcan tiempo de desarrollo o mejoren la experiencia, sin comprometer la coherencia visual ni la disciplina de "nunca un componente de adorno sin función real" ya vigente en el proyecto.

## Decisión

### Reglas obligatorias
1. El componente resuelve una necesidad ya definida en la Biblia.
2. Se integra completo con el Backend existente.
3. Respeta el diseño aprobado.
4. Funciona en modo oscuro (StylerNow es dark-only, sin toggle de tema).
5. Es accesible.
6. Es responsive.
7. Queda envuelto en `src/components/ui/` — el equivalente real de `packages/ui` en este proyecto (un único paquete Next.js, no un monorepo; ver `src/components/ui/REGISTRY.md`).
8. Nunca se usa el componente directo del registry en múltiples lugares — todo consumo pasa por el wrapper.

### Skeleton obligatorio
Implementado como `loading.tsx` de Next.js App Router en las 9 áreas mínimas pedidas (Dashboard, Agenda, Marketplace, Staff, CRM, Inventario, Reportes, Perfil, Panel SuperSU) — Suspense automático de Next.js sobre cada Server Component existente, sin tocar su lógica de datos.

### Componentes instalados
Los 12 de la lista autorizada (`skeleton`, `sonner`, `drawer`, `calendar`, `command`, `carousel`, `empty`, `progress`, `tooltip`, `popover`, `context-menu`, `input-otp`, más `dialog` como dependencia de `command`) más 5 de `rare-ui` (`duration-picker`, `otp-input`, `emoji-reaction`, `animated-counter`, `fluid-orb`) — detalle completo, origen, versión y colocación en `src/components/ui/REGISTRY.md`.

### Hallazgo real del proceso de instalación
La versión del CLI de shadcn usada (4.21.0) genera componentes con `import { cn } from "cn"` (un paquete npm real, no un alias de proyecto) y clases de Tailwind referenciando variables genéricas (`bg-primary`, `bg-accent` con semántica de hover neutro, `bg-background`, etc.) que no existen — o significan algo distinto — en el `@theme` de StylerNow. Cada componente instalado se restyleó explícitamente: import unificado a `@/lib/utils` (la utilidad `cn()` ya existente en el proyecto, evitando una segunda dependencia redundante) y cada clase de color mapeada a los tokens reales de StylerNow (mapeo completo en `REGISTRY.md`). La colisión más importante: el "accent" genérico de shadcn (fondo de hover neutro) choca de nombre con el "accent" de StylerNow (ámbar de marca) — se resolvió mapeando el primero a `bg-accent-soft` (ámbar translúcido) en vez de dejar que un hover se pintara de ámbar sólido en toda la app.

### Refactor obligatorio aplicado
`Progress` reemplazó la barra de progreso de Sellos hecha a mano en `/lealtad` (Módulo 6.5). Los demás componentes son capacidades NUEVAS (no reemplazan nada existente), así que no aplica un refactor de reemplazo — instalar `empty`, por ejemplo, no obliga a migrar las docenas de empty states ya existentes en todo el proyecto (serían una refactorización desproporcionada sin valor de negocio claro); se usa en pantallas nuevas de acá en adelante.

## Consecuencias

**Positivas:**
- El proyecto gana un vocabulario de componentes reutilizables (toasts, skeletons, progress bars, etc.) sin reinventar cada uno a mano.
- El hallazgo del import `"cn"` y la colisión de tokens queda documentado para que cualquier instalación futura de shadcn/ui repita el mismo proceso de verificación en vez de asumir que el componente generado ya está listo para usar.

**Negativas / Trade-offs aceptados:**
- `src/app/loading.tsx` (skeleton de Marketplace) es también el fallback de cualquier ruta sin su propio `loading.tsx` — un destello breve de esa forma en rutas de un solo propósito (login, favoritos). Ver detalle en `REGISTRY.md`.
- 8 de los 17 componentes instalados quedan "pendientes de colocación" — instalados y verificados (compilan, respetan el tema), pero sin un lugar de uso real todavía, siguiendo el pedido explícito del fundador de dejarlos listos para cuando aparezca el caso, sin forzar una colocación artificial.

## Checklist
- [x] Completo
- [ ] Revisado
