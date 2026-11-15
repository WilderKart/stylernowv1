# Informe Fase 1B (parcial) · Server Actions fuera de /admin, hallazgos F1A-04..07, promociones del dueño

Diseño pendiente de aprobación: `DISENO_FASE1B.md` (soporte administrativo, autorización del Super Admin, trazabilidad: **no construido**).

## 1. Auditoría de Server Actions (fuera de /admin)
Método: inventario estático con el compilador de TypeScript (`scripts/inventario-server-actions.mjs` → 268 acciones exportadas en 58 archivos; no ~55) y prueba dinámica (`tests/server-actions-autorizacion.test.ts`): importa el código real de cada acción, la invoca con sesión real (GoTrue local) de 11 actores contra datos del negocio B, y mide fuga de lectura y escritura cruzada por huella del contenido de B. `fetch` a hosts no locales bloqueado. Evidencia: `evidencias_1b/server_actions_antes_139_codigo_actual*.json`.

| Resultado | Acciones |
|---|---|
| Limpias, con control válido (algún actor de B o el Super Admin ejecutó la acción con éxito) | 140 |
| Marcadas | 6 → **1 real**, 5 falsos positivos explicados |
| **Inconclusas** (ningún actor autorizado logró ejecutarla con los argumentos generados automáticamente: validaciones, sesión, datos faltantes) | 115 |
| No ejecutadas a propósito (login, registro, Google, cerrar sesión) | 7 |

**Marcadas:** `registrarEventoFraude` → **real, corregido en 142** (cualquier usuario insertaba eventos de fraude en el negocio de otro, con severidad y payload libres). Falsos positivos: `alternarFavorito` (favorito propio de un negocio público), `exportarDatosAccion` (datos propios, incluye ese favorito), `listarServiciosActivos` (servicios activos, públicos), `listarAuditoriaNegocio` (solo eventos del negocio propio; el detector coincidió con un id de ticket), `listarMisTickets` (solo los del usuario).

**Lo que NO está demostrado:** las 115 inconclusas no se pueden dar por aprobadas con esta prueba. Evidencia estática de apoyo: 263 de 268 acciones no usan el cliente de servicio dentro de su propio archivo (RLS/RPC deciden; no se rastreó el uso indirecto por librerías compartidas); las 5 que sí lo usan directamente se revisaron a mano (login ×2, `generarSugerenciasAction`, `cancelarReservaAction`, `iniciarPrueba`) y derivan los ids de resultados de RPC ya autorizadas. Falta una pasada dirigida con argumentos hechos a mano para las 115, la prueba por HTTP real de Next (origen/CSRF) y la revisión de transacciones y registro de auditoría por acción.

## 2. Migraciones (todas aditivas, sin borrar datos; reversión en cada archivo)
| # | Contenido | Prueba local |
|---|---|---|
| 138 | `crear_grupo_familiar` con autorización por negocio (Fase 1A) | f0_05: 32/32 + 2/2 |
| 139 | F1A-04 referido_config / vip_nivel; F1A-05 costos de IA solo Super Admin (`ai_acciones_costo_admin()`); F1A-06 `agregar_miembro_familiar` revocada; F1A-07 límite de miembros; grupos familiares sin descuento | f1b_139: 38/38 |
| 140 | PORCENTAJE ≤ 100 en `oferta_negocio` | f1b_promociones_140: 22/22 |
| 141 | quitar TRUNCATE/TRIGGER/REFERENCES a anon y authenticated en todas las tablas de `public` (TRUNCATE no pasa por RLS; la API no lo usa) | f1b_141_142: 9/9 |
| 142 | `registrar_evento_fraude` acotado | f1b_141_142: 9/9 |

Regresión SQL: 19/20 suites (solo falla `directiva_116_118`, obsoleta y ya conocida). Vitest 112/112. TypeScript y ESLint sin errores nuevos.

## 3. Código
`src/app/panel/promociones/*` (pantalla de promociones del dueño; guardian/profesional no entran), `src/lib/auth/autorizar-supersu.ts` y guardia en acciones de /admin (Fase 1A), cambios en `src/app/admin/ai`, `src/app/panel/ia` (el dueño ya no recibe el costo del proveedor).

## 4. Decisiones pendientes del propietario
Ver `DISENO_FASE1B.md` §6: matriz de permisos, ampliación de tickets y flujo de autorización del Super Admin, qué hacer con `descuento_familiar_pct` (hoy inerte; 0 filas ≠ 0 en producción), límite definitivo de miembros (hoy techo técnico provisional de 20), flujo con consentimiento para miembros de un grupo familiar, tabla de promociones generales de StylerNow, y si las promociones deben rebajar precios automáticamente (hoy solo se muestran).

## 5. Estado de producción al escribir esto
Producción tenía hasta la 137. Datos verificados antes de aplicar: 14 grupos familiares (0 con descuento ≠ 0, 0 con límite fuera de 1–20), 0 promociones, costos de IA todos en 0.
