# ADR-016 — Migración completa a Contexto unificado (Authorization Refactor)

> **Estado:** Aprobado, NO ejecutado — contrato de ingeniería para trabajo futuro.
> **Depende de:** ADR-015 (Sistema de Identidad Zero Trust).
> **No ejecutar hasta:** que la infraestructura de identidad de ADR-015
> (Password Platform, Google OAuth, MFA, Session Registry/Version) esté
> completamente estabilizada y probada con usuarios reales.

## Contexto

ADR-015 introdujo un contrato único (`Contexto`, `src/lib/auth/tipos.ts`) y
un Permission Registry ejecutable (`permission-registry.ts`), pero **no**
migró las ~27 páginas de `/panel` ni `PanelNav` a ese contrato de punta a
punta — habría exigido reescribir, en el mismo cambio, todas las
comparaciones `contexto.rol === "GUARDIAN"`/`"BARBERIA"` (mayúscula,
`RolPanel`) dispersas en el cuerpo de cada página, más el tipo de prop de
`PanelNav`. Ese es un refactor de alto riesgo en código de autorización que
no debía competir por tiempo con Password/OAuth/MFA/Session Registry, que sí
son capacidades nuevas sin ese riesgo de regresión.

En su lugar, ADR-015 entregó una **capa de compatibilidad**:
`verificarAccesoPanel()` (`src/lib/auth/verificar-acceso-panel.ts`) centraliza
la decisión de acceso (sesión → login, `NINGUNO` → onboarding, rol ajeno →
`forbidden()`) pero sigue devolviendo `ContextoUsuario` con `RolPanel` en
MAYÚSCULA — exactamente lo que cada página ya consumía. Cero cambios en
`PanelNav` ni en la lógica de negocio de cada archivo.

## Objetivo de este ADR

Eliminar completamente esa capa de compatibilidad cuando llegue su momento:

- `RolPanel` (`"BARBERIA"|"GUARDIAN"|"STAFF"|"NINGUNO"`) deja de existir —
  todo el código lee `Contexto.rol` (`"barberia"|"guardian"|...`, minúscula,
  ADR-015).
- Ninguna página compara `contexto.rol === "GUARDIAN"` directamente — las
  decisiones de alcance (sede/negocio) se consultan contra
  `permission-registry.ts` (`alcanceDe(rol, modulo, accion)`), no contra un
  `if` repetido.
- `PanelNav` (y `StaffNav`/`AdminNav`) reciben sus ítems ya filtrados por el
  Permission Registry, no una lista fija con `...(rol === "BARBERIA" ? [...] : [])`.
- `verificarAccesoPanel()` se elimina; toda página llama `requireRole()`
  (`src/lib/auth/require-role.ts`, ya existe desde ADR-015 Fase A/B) como
  único punto de entrada, real de punta a punta.

## Estado actual (al momento de escribir este ADR)

- Capa de compatibilidad activa: `verificarAccesoPanel()` en las 27 páginas
  de `/panel`. Ver `docs/AUTH_MIGRATION_QUEUE.md` para el inventario exacto
  de qué falta migrar.
- `PanelNav` sigue tipado por `RolPanel` (`src/components/panel/panel-nav.tsx`).
- `requireRole()` existe y funciona para Admin (`requireSuperSU`) y como
  diseño de referencia, pero el Panel no lo usa todavía de punta a punta.

## Estado objetivo

```
Route
 ↓
Middleware (proxy.ts + route-registry.ts)
 ↓
requireRole([...]) ← único guard, sin capa de compatibilidad
 ↓
Contexto (minúscula, único shape)
 ↓
Permission Registry (permission-registry.ts) ← PanelNav consulta acá, no un if fijo
 ↓
Página
```

## Alcance de la migración futura

- Panel (27 páginas + `PanelNav`).
- Staff (`obtenerContextoStaff()` ya compatible con `Contexto` desde ADR-015;
  falta que las páginas de `/staff` dejen de leer `ContextoStaff` directo).
- SuperSU (ya usa `requireSuperSU()` vía `admin/layout.tsx`; falta que
  consuma `Contexto` en vez de `{ userId, nombre }`).
- Guardian: no gana código propio — sigue siendo Staff con `rol: "guardian"`
  en el mismo `Contexto`, nunca una rama de código separada.

## Qué se elimina cuando esto se ejecute

- `RolPanel`, `PermisosPanel` como alias suelto (ya es `= Permisos` desde
  ADR-015, se elimina el alias y se usa `Permisos` directo).
- Los `if (contexto.rol === "...")` repetidos en cuerpos de página.
- `verificarAccesoPanel()` y este mismo ADR (se marca como Ejecutado).

## Beneficios esperados

- Un permiso nuevo se agrega en `permission-registry.ts` (y su fila en
  `01_Roles.md`) sin tocar ninguna página.
- Navegación (`PanelNav`) generada, no mantenida a mano por rol.
- Agregar un rol nuevo (si StylerNow lo necesitara) no implica tocar 27
  archivos — solo el registro y los resolvers.

## Criterio de cierre

- [ ] Cero ocurrencias de `RolPanel` fuera de este ADR y su changelog.
- [ ] Cero comparaciones `contexto.rol === "GUARDIAN"`/`"BARBERIA"` literales
      en `src/app/panel/**`.
- [ ] `PanelNav` recibe sus ítems del Permission Registry.
- [ ] `verificarAccesoPanel()` eliminado del repositorio.
- [ ] `docs/AUTH_MIGRATION_QUEUE.md` en 100%.
- [ ] `tsc --noEmit`, `eslint`, `next build` limpios; E2E de ADR-015 siguen
      pasando sin regresión.
