# 05 · Resultados de pruebas · cierre de hallazgos pendientes de Fase 1B

Fecha: 2026-11-16 · Worktree `stylernow-cierre` (rama `cierre/fase-0`) con cambios **sin commitear** · Entorno local Docker (nada contra producción). Lo que no se ejecutó se dice expresamente.

## 1. Estado de cada hallazgo
| Hallazgo | Clasificación | Evidencia reproducible |
|---|---|---|
| MAINTAIN en `anon`/`authenticated` (migración 145) | **CORREGIDO en local** (no aplicado en producción) | `tests/sql/f1b_maintain_145.sql` 16/16; VACUUM medido con roles reales (ver `01_MAINTAIN.md`) |
| Efecto de MAINTAIN sobre `LOCK TABLE` | **NO REPRODUCIDO** (LOCK lo habilitan UPDATE/DELETE, no MAINTAIN) | misma suite, caso «residual» |
| `statement_timeout`/`lock_timeout` para roles de la API | **PENDIENTE** (decisión de configuración tuya) | `01_MAINTAIN.md` §5 |
| Suite `directiva_116_118` obsoleta | **CORREGIDA** (prueba actualizada a la regla de la 133; sin cambio de código ni de negocio) | suite OK; `02_DIRECTIVA_116_118.md` |
| «`EN_MORA` permite reservar» (afirmación de la 133) | **PENDIENTE** de prueba específica | `02_DIRECTIVA_116_118.md` §4 |
| Regresión: el dueño no puede suspender/revocar/trasladar staff (nuevo, migración 146) | **CORREGIDO en local** (no aplicado); **producción PENDIENTE de confirmar** | `tests/sql/f1b_session_version_146.sql` 9/9 + arnés pasada 3 |
| «Éxito silencioso» en `crearOActualizarNegocio`, `guardarSede`, `actualizarSede` | **CORREGIDO en el código** (sin commit) | arnés pasada 1 (antes) vs 2 (después) |
| 115 Server Actions pendientes | **PARCIAL:** 57 demostradas + 26 diferenciales + 3 revisadas; **29 siguen PENDIENTES** | `03_AUDITORIA_SERVER_ACTIONS.md`, `04_MATRIZ_AUTORIZACION.csv` |

## 2. Validación final (rama con los cambios sin commitear)
| Prueba | Resultado |
|---|---|
| TypeScript `tsc --noEmit` | **0 errores** |
| ESLint (`src`, `tests`, `scripts`, solo errores) | **sin hallazgos** |
| Vitest completo | **112 pasaron · 17 omitidas** (las que requieren entorno local explícito) |
| Suites SQL (`scripts/entorno-local/sql-tests.sh`, base `limpia` con migraciones hasta 146) | **23 de 23 OK**, incluida `directiva_116_118`, `f1b_maintain_145`, `f1b_session_version_146`, `f1b_139`, `f1b_141_142`, `f1b_promociones_140`, `f1b_compat_codigo_vs_base`, aislamiento multiempresa, seguridad_regresion |
| `tools/check-auth-coverage.mjs` | sin problemas |
| `next build --webpack` | **compiló** (101 páginas generadas). Turbopack (el de Vercel) no corre en este worktree por el enlace de `node_modules` |
| Matriz de aislamiento HTTP real (89 tablas, 9 actores) | `referido_config` y `vip_nivel` no visibles para ajenos. Visibles a no autorizados: catálogo público por diseño (sede, servicio, recurso, reseña, membresía, campañas de sellos, cashback, oferta). **`gift_card` y `lista_espera` aparecen para los actores que las generaron en las pasadas del arnés (cada uno ve las suyas; `anon` y `pro-a2` no): contaminación de la prueba, no fuga**. Evidencia: `matriz_aislamiento_fase1b_cierre.json` |
| Arnés dinámico (pruebas de autorización y aislamiento por actor) | 268 acciones: 197 demostradas, 26 diferenciales, 8 revisadas, 0 violaciones sin explicar, 30 inconclusas, 7 omitidas |
| Pruebas de regresión de lo afectado | `f1b_compat_codigo_vs_base`, panel de promociones (140), grupos familiares (139), fraude (142): OK |

## 3. Lo que NO se hizo o NO se pudo demostrar
- **No** se aplicó ninguna migración en producción, no hubo commits, push ni despliegue. Las migraciones **145** y **146** y los cambios de código (`panel/onboarding/actions.ts`, `panel/sedes/actions.ts`) existen solo en el worktree.
- La confirmación en producción del defecto de `session_version` (H-2) quedó **sin probar**: el intento con transacción revertida fue bloqueado por el control de permisos y no se reintentó. La evidencia es el mismo md5 de las definiciones y la reproducción local.
- 30 Server Actions siguen sin demostración (ver `03_…` §5).
- Sin pruebas de concurrencia, de fuzzing de parámetros ni de carga (esta última prohibida contra producción).
- La corrida completa de 268 acciones del arnés no cabe en su tiempo límite: la matriz se fusiona de 9 corridas.

## 4. Cambios en el worktree de esta fase (sin commit)
Nuevos: `supabase/migrations/145_quitar_maintain_a_roles_publicos.sql`, `supabase/migrations/146_session_version_desde_funciones_definer.sql`, `tests/sql/f1b_maintain_145.sql`, `tests/sql/f1b_session_version_146.sql`, `tests/server-actions-argumentos.ts`, `scripts/matriz-autorizacion.mjs`, `scripts/resumen-controles.mjs`, `docs/plan_cierre/fase1b_cierre/*`, evidencias `server_actions_pendientes_pasada{1,2,3}*.json`.
Modificados: `tests/sql/directiva_116_118.sql`, `tests/server-actions-autorizacion.test.ts` (acepta argumentos a mano y filtros), `src/app/panel/onboarding/actions.ts`, `src/app/panel/sedes/actions.ts`.
**Ajenos a esta fase (otra sesión de trabajo, no tocados):** `src/app/login/*`, `src/app/registro/*`, `src/app/para-negocios/page.tsx`, `src/lib/i18n/diccionario.ts`, `src/lib/planes/*`, `src/lib/auth/destino-inicial.ts`, `public/img/negocios/`, `supabase/config.toml`, `docs/auditoria_integral/`.

## 5. Antes de producción (nada de esto se ha hecho)
1. Integrar `main` (trae las migraciones 143 y 144 de reservas) y repetir este plan de pruebas.
2. Decidir sobre 145 y 146; la 146 corrige una funcionalidad que probablemente hoy falla.
3. Confirmar H-2 en producción con una cuenta de dueño de pruebas (suspender un profesional de prueba).
4. Respaldo de producción sigue sin confirmarse (plan Free).
