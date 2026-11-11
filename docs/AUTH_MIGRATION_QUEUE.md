# Cola de Migración de Autorización (ADR-016)

Inventario de qué usa la capa de compatibilidad (`verificarAccesoPanel()`,
`RolPanel` en mayúscula) vs. qué ya está en el `Contexto` unificado de
ADR-015 (`requireRole()`, minúscula). Se actualiza cada vez que una
superficie migra de una columna a la otra — ver `ADR_016_Authorization_Refactor.md`
para el contrato de cierre.

**Total:** 30 superficies · **Migradas a `requireRole()`:** 1 (`/admin/**`, vía `requireSuperSU()` ya compatible con `Contexto`) · **En capa de compatibilidad:** 27 · **Estructura propia (no migra a este patrón):** 2 (`/panel`, `/panel/onboarding` — dispatchers, ver más abajo)

## Panel (Barbería/Guardian) — capa de compatibilidad (`verificarAccesoPanel`)

| Estado | Ruta | Prioridad |
|---|---|---|
| ⏳ | `/panel/agenda` | Media |
| ⏳ | `/panel/servicios` | Media |
| ⏳ | `/panel/servicios/[id]` | Media |
| ⏳ | `/panel/servicios/nuevo` | Media |
| ⏳ | `/panel/servicios/combos/[id]` | Baja |
| ⏳ | `/panel/servicios/combos/nuevo` | Baja |
| ⏳ | `/panel/crm` | Media |
| ⏳ | `/panel/crm/[clienteId]` | Media |
| ⏳ | `/panel/crm/segmentos` | Baja |
| ⏳ | `/panel/soporte` | Baja |
| ⏳ | `/panel/soporte/[id]` | Baja |
| ⏳ | `/panel/inventario` | Media |
| ⏳ | `/panel/inventario/consumo` | Baja |
| ⏳ | `/panel/pos` | Media |
| ⏳ | `/panel/pos/caja` | Baja |
| ⏳ | `/panel/pos/productos` | Baja |
| ⏳ | `/panel/staff` | Media |
| ⏳ | `/panel/staff/[id]` | Media |
| ⏳ | `/panel/staff/nuevo` | Media |
| ⏳ | `/panel/sedes` | Media |
| ⏳ | `/panel/sedes/[id]` | Media |
| ⏳ | `/panel/ads` | Baja |
| ⏳ | `/panel/suscripcion` | Media |
| ⏳ | `/panel/wallet` | Media |
| ⏳ | `/panel/lealtad` | Baja |
| ⏳ | `/panel/ia` | Baja |
| ⏳ | `/panel/auditoria` | Baja |
| ⏳ | `/panel/reportes` | Media |

## Ya en el contrato unificado (`requireRole()` / `Contexto`)

| Estado | Ruta | Guard |
|---|---|---|
| ✅ | `/admin/**` (vía `admin/layout.tsx`) | `requireSuperSU()` — compatible con `Contexto` desde ADR-015 |

## Fuera de este patrón por diseño (dispatchers, no páginas de feature)

| Ruta | Motivo |
|---|---|
| `/panel` | Landing dinámico por rol (redirige Staff→`/staff`, resuelve Guardian/Barbería inline) — no protege UNA feature, decide a dónde ir. |
| `/panel/onboarding` | Guard propio de una sola vía (solo Barbería, chequea `onboarding_completo`) — no es una página de feature repetible. |
| `/staff/**` | `obtenerContextoStaff()` ya compatible con `Contexto`; las páginas todavía leen `ContextoStaff` directo — migración de Staff queda en el mismo ADR-016, no listada línea por línea acá (6 páginas: `/staff`, `/staff/agenda`, `/staff/nivel`, `/staff/clientes`, `/staff/perfil`, `/staff/lealtad`). |

## Dependencias antes de migrar cada fila a `requireRole()`

1. `PanelNav` (`src/components/panel/panel-nav.tsx`) debe aceptar `rol: Rol` (minúscula) — hoy tipado por `RolPanel`.
2. Todo `contexto.sedeId`/`contexto.rol === "GUARDIAN"` en el cuerpo de la página debe pasar a `contexto.rol === "guardian"` en el mismo cambio (no puede migrarse el guard sin migrar el cuerpo — ver riesgo documentado en ADR-016).
3. Ejecutar `tsc --noEmit` tras cada archivo migrado, no en lote al final.

Prioridad = impacto de negocio si un role-check tuviera un bug, no dificultad técnica (todas usan el mismo patrón).
