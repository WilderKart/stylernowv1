# Informe Fase 1A — Validación y remediación de seguridad en entorno local aislado

Fecha: 2026-11-15 · Worktree `C:\Users\karni\Documents\stylernow-cierre` (rama `cierre/fase-0`, sin commits) · Base: Supabase local en Docker (`stylernow-cierre`, puertos 553xx), datos ficticios.
**No se tocó producción, Vercel, Supabase remoto, datos reales, pagos ni `limpieza_total_produccion.sql`. No hay commit, merge, rebase, reset ni push. La carpeta original no se modificó.**
Evidencia: `docs/plan_cierre/evidencias_1a/` · Diff consolidado: `evidencias_1a/cambios_fase1a.diff` (1 327 líneas).

## 1. Resumen

| Ítem | Resultado | Estado |
|---|---|---|
| **A · F0-01** webhook Mercado Pago | **Reproducido** en `origin/main`: una firma válida recibe **401**. La corrección de tu rama local es correcta y quedó aplicada en el worktree. Antes 3 de 7 pruebas fallaban; después **7/7**. | Corregido en local (sin desplegar) |
| **B · F0-05** `crear_grupo_familiar` | Antes **16 de 32** casos permitían lo que no debían (negocio ajeno, descuentos de −5 % y 999,99 %). Con la migración 138: **32/32** y **2/2** de escritura directa. | Corregido en local (migración 138, sin aplicar en producción) |
| **C · H-008** Server Actions de `/admin` | 69 acciones × 8 actores con **sesión real** contra la base local. Ninguna escritura no autorizada tuvo efecto (la base ya bloqueaba), pero **7 de 11 archivos no verificaban Super Admin en la aplicación**: había lecturas con cualquier sesión (incluida anónima) y una escritura de un cliente sobre su ticket por una acción de admin. Con la guardia común: **0 escrituras, 0 lecturas con datos y 0 tablas cambiadas** para los 7 actores sin privilegio; el Super Admin conserva 37 escrituras y 24 lecturas con datos. | Corregido en local |
| **D · Aislamiento 61 tablas** | Antes 28 de 89 tablas tenían datos de B; ahora **89/89**. 0 violaciones de escritura, borrado e inserción. Lecturas por terceros: 12 tablas, todas explicadas (ver §5). | Probado; 2 observaciones a decidir |

**Preparación para producción: 42 % → ≈ 47 % en el repositorio/entorno local (+5 pts).** En producción sigue en ≈ 42 % porque nada de esto está desplegado. Es una estimación mía, no una medición; el detalle del cálculo está en §9.

## 2. A · F0-01 — Mercado Pago (`x-request-id`)

**Causa.** `src/proxy.ts` sobrescribe `x-request-id` con un UUID propio (auditoría), y `procesarWebhookMercadoPago` calcula el HMAC con ese valor, no con el que firmó Mercado Pago (`id:<data.id>;request-id:<x-request-id>;ts:<ts>`).

**Prueba** (`tests/f0-01-request-id-proxy-webhook.test.ts`): petición firmada como la firma Mercado Pago → **proxy real** → encabezados que la ruta recibe de verdad (`x-middleware-request-*`) → **handler real**; la base se simula. Clave y firmas ficticias; sin red.

| Caso | `origin/main` | Con corrección |
|---|---|---|
| El proxy cambia `x-request-id` (id de MP `mp-req-0001` → UUID propio) | confirmado | confirmado, y el original viaja en `x-request-id-origen` |
| Firma **válida** (id original de MP) | **401 ✗** | 200 ✓ (llega a la base) |
| Firma manipulada (`v1` alterado) | 401 | 401, no toca la base |
| Otra clave / otro `data.id` / sin `x-signature` | 401 | 401 |
| Cliente envía `x-request-id-origen` falso con firma para ese id | pasa tal cual (el handler no lo lee) | el proxy lo **descarta** y escribe el suyo → 401 |
| Sin `x-request-id` de entrada, `x-request-id-origen` inventado | pasa tal cual | descartado (`null`) → 401 |
| Handler llamado sin proxy con origen falsificado y firma de otra clave | 401 | 401 |

Corrección: exactamente los hunks de tu rama local (`proxy.ts` +5 líneas, `webhook-mercadopago.ts` +3/−1), aplicados con `git apply` desde el diff contra `origin/main` (`f0-01_parche.diff`). El proxy corre en todas las rutas `/api/**` (matcher), así que el origen no puede llegar sin pasar por él.
Evidencia: `f0-01_ANTES_origin-main.txt`, `f0-01_DESPUES_con_correccion.txt`.
**Límite:** es una prueba sintética con Next real parcial (el `NextRequest`/`NextResponse` y el proxy son los reales; no hay servidor Next ni Mercado Pago). Falta la prueba con la clave del panel y una notificación real del simulador de MP en sandbox (no hice llamadas externas, como pediste).

## 3. B · F0-05 — `crear_grupo_familiar` (migración 138)

Archivo: `supabase/migrations/138_crear_grupo_familiar_autorizacion.sql` (aditiva, idempotente, misma firma → no crea sobrecarga; `revoke` explícito de `public` y `anon`, `grant` a `authenticated`).

Reglas implementadas (decisión de **seguridad**, no regla comercial nueva):
- `negocio_id` ≠ NULL exige relación autorizada: dueño, personal del negocio (`tiene_acceso_interno`), **cliente con al menos una reserva en ese negocio**, o Super Admin. Negocio inexistente → `NO_AUTORIZADO` (o `NEGOCIO_NO_ENCONTRADO` solo si ya estaba autorizado).
- Descuento > 0 solo lo fija el **dueño de ese negocio** o el Super Admin. Profesional y guardián no.
- Descuento es porcentaje **0–100**, sin NULL (`DESCUENTO_INVALIDO`). `CHECK familia_grupo_descuento_rango_chk … NOT VALID` en la tabla (protege lo nuevo, no valida filas antiguas).
- El uso real de la interfaz (solo nombre, sin negocio, 0 %) sigue funcionando para cualquier autenticado.

**Prueba** `tests/sql/f0_05_crear_grupo_familiar.sql` (32 casos de RPC + 2 de escritura directa; cada intento se revierte): Super Admin, propietario, guardián, profesional, cliente con y sin reserva, intruso y anónimo, con negocio propio/ajeno/inexistente y descuentos 0, 15, 100, 100,01, 999,99, −5, −50 y NULL.

| | Antes | Después |
|---|---|---|
| Casos que no coinciden con lo esperado | **16** de 32 | **0** |
| Intruso en negocio ajeno | permitido | `NO_AUTORIZADO` |
| Cliente fija 15 % | permitido | `NO_AUTORIZADO` |
| −5 %, 100,01 %, 999,99 % (incluso Super Admin/dueño) | permitido | `DESCUENTO_INVALIDO` |
| INSERT/UPDATE directo a la tabla | denegado (RLS) | denegado (RLS) |

**Decisiones de negocio que asumí y debes confirmar:** (1) que «cliente del negocio» = tener una reserva ahí; (2) que solo el dueño/Super Admin ofrecen descuento. No inventé ninguna regla de cálculo: el descuento sigue sin entrar en ningún precio.
**No corregido (fuera de alcance, ver §7):** `p_limite_miembros` sin tope máximo y `agregar_miembro_familiar` que agrega a cualquier perfil sin consentimiento.

## 4. C · H-008 — Server Actions de `/admin`

**Método** (`tests/admin-actions-autorizacion.test.ts`, solo con `PRUEBAS_LOCALES_ADMIN=1` y API = `127.0.0.1:55321`): importa el **código real** de cada acción exportada de `src/app/admin/**` (69 acciones, 11 archivos), con la **sesión real** (JWT de GoTrue local) de 8 actores: anónimo, intruso, cliente, profesional, guardián, propietario A, propietario B y Super Admin (control). Solo se sustituyen las primitivas de Next (`revalidatePath`, `redirect`, el cliente Supabase por el de cada actor, el cliente admin por el de servicio local). Mide el resultado devuelto y una **huella md5 de todas las tablas de `public` + `auth.users`** antes y después de cada actor. Las acciones se invocan con objetos sembrados en el estado exacto que exige cada una (`supabase/seed_admin_acciones.sql`: negocios pendientes/activos/suspendidos, suscripciones en mora, banner, ticket, evento de fraude, cuenta víctima con UUID v4 válido), que se **reponen al inicio de cada corrida**.

| Actor | Antes: escrituras ok / lecturas con datos / tablas cambiadas | Después |
|---|---|---|
| anónimo | 0 / **4** / 0 | 0 / 0 / 0 |
| intruso, profesional, guardián, propietario A y B | 0 / **10** / 0 | 0 / 0 / 0 |
| cliente (autor del ticket) | **1** / **12** / **3 tablas (su ticket)** | 0 / 0 / 0 |
| **Super Admin (control)** | 37 / 23 | 37 / 24 (las acciones siguen funcionando) |

**Hallazgos**
- **F1A-01 (P2, corregido en local).** Siete archivos de acciones (`admin/actions.ts`, `ai`, `configuracion`, `lealtad`, `planes`, `soporte` y `barra-actions.ts`) solo comprobaban *sesión iniciada* (o nada), no *Super Admin*: la autorización dependía de la base. La base sí bloqueó **todas** las escrituras (por eso no hubo cambios), pero con una sola capa. Además, 10 lecturas devolvían datos a cualquier sesión; **la mayoría ya es pública por RLS** (planes, textos legales, ciudades, banners vigentes, negocios activos), y la excepción relevante son los costos de IA (`ai_accion_costo` con `costo_proveedor_estimado` y `margen_pct`, ver F1A-04). Además, `responderTicketAdmin`/`listarTicketsAdmin`/`obtenerHiloTicketAdmin` dejaban a un **cliente operar su propio ticket por una acción de admin** (no es escalada de privilegios, pero es una superficie que no corresponde a esa ruta).
- **Corrección:** `src/lib/auth/autorizar-supersu.ts` (nuevo) decide en el servidor con `perfil.es_supersu` (misma fuente que `is_supersu()`) y rechaza cuentas autenticadas con Google (igual que `requireSuperSU` en las páginas). Se aplica en los 7 archivos (4 sustituyendo su `usuarioActual()`, `ai` y `lealtad` al inicio de cada acción —13 acciones—, y `barra-actions`). Las otras 4 (`auditoria`, `reglas`, `whatsapp`, `usuarios`) ya tenían guardia en la aplicación y se mantienen. Nadie fuera de `/admin` importa estas acciones.
- **Residual (P3):** 16 de 19 páginas de `/admin` no llaman a `requireSuperSU()` por sí mismas; dependen del `layout`. Como todos los datos que muestran pasan por estas acciones o por RPC con `is_supersu()`, hoy no hay exposición, pero conviene la guardia por página (defensa en profundidad). No lo toqué: algunas de esas páginas tienen cambios sin confirmar en tu carpeta.
- **Ordenamiento autorización-antes-de-validación:** en las acciones con validación `zod` previa a la sesión (`reglas`, `whatsapp`, `planes`) una entrada inválida responde «revisa los valores» antes que «sin permiso». No filtra datos ni cambia nada, pero un no-Super Admin puede inferir el esquema; P3.
- 5 controles del Super Admin no llegaron al camino feliz (reseña reportada, comisión programada, reembolso, estado de conexión, paquete WhatsApp ya existente): para esas acciones la evidencia es «el no-Super Admin recibe `NO_AUTORIZADO` y no hay cambios», no «y el Super Admin sí puede».
Evidencia: `admin_actions_ANTES.json` / `_DESPUES.json` / `_DESPUES_final.json` (esta última sobre la base reconstruida desde cero y con `barra-actions` ya guardada), `admin_actions_salida_*.txt`, `h008_parche_guardia.diff`, resumen con `node scripts/resumen-admin-actions.mjs <json>`.
**Límite importante:** no se pasó por el servidor HTTP de Next, así que **no se probó** la verificación de origen/CSRF de las Server Actions ni el enrutamiento por ID de acción; se probó que *el código de cada acción* decide bien con una sesión real. Las ~55 Server Actions **fuera de `/admin`** (panel, staff, cliente, pagos…) **no se auditaron** (propuesta para otra fase).

## 5. D · Aislamiento multi-tenant: 61 tablas

**Datos.** `supabase/seed_tablas_sin_datos.sql` siembra una fila representativa del negocio B en cada una de las 61 tablas leyendo el catálogo (columnas obligatorias, llaves foráneas resueltas a filas de B, enums, valores permitidos por CHECK); 59 salieron solas y 2 con un override documentado (`disponibilidad`, `oferta_negocio`). Registro por tabla en `public._sembrado` (61 OK, 0 error). `ai_prompt` se ajustó a `PROPIO` (un negocio no puede crear `OFICIAL`, que es público por diseño). `reiniciar.sh` ya la ejecuta.

**Matriz HTTP** (PostgREST + JWT real; 7 actores sin relación con B + dueño B y Super Admin de control), `tests/aislamiento/matriz.mjs` ampliado para probar **inserción en las 89 tablas** (antes 74): lectura, PATCH, DELETE e INSERT.

| Resultado | Fase 0 | Fase 1A |
|---|---|---|
| Tablas con datos de B | 28 / 89 | **89 / 89** |
| Violaciones de escritura / borrado / inserción | 0 / 0 / 0 | **0 / 0 / 0** |
| Inserción probada | 27 | **89** |
| Control positivo: dueño B ve filas en … tablas · Super Admin | — | 73 · 77 |

**Lecturas por terceros (12 tablas) — todas explicadas:**
- Catálogo público **solo con negocio ACTIVO**: `sede`, `servicio`, `servicio_combo`, `recurso`, `recurso_tipo`, `sede_horario_excepcion`, `oferta_negocio` (solo `authenticated`, vigente). **Verificado** con B en ACTIVO / PENDIENTE / SUSPENDIDO / CANCELADO: terceros ven 0 filas en los tres últimos; el dueño B ve las suyas (`visibilidad_negocio_inactivo.sql`).
- Público por diseño: `resena` (solo `VISIBLE`).
- **F1A-04 (P3, a decidir):** `referido_config` y `vip_nivel` tienen `USING (true)` — cualquiera, incluso anónimo, lee los montos de referido y los umbrales/beneficios VIP de **cualquier** negocio, activo o no. `cashback_regla` y `sello_campana` son públicas por estado de la regla pero no condicionan al estado del negocio. Propuesta: exigir negocio ACTIVO o acceso interno, como en el resto del catálogo. No lo cambié (módulo de lealtad, requiere tu decisión).
- Aparte: las tablas de IA (`ai_accion_costo`, `ai_paquete_creditos`, `plan_funcion_ia`) son legibles por anónimos y `ai_accion_costo` incluye `costo_proveedor_estimado` y `margen_pct`. En la base local son 0; **verifica en producción** si tienen valores reales (no lo consulté).

**Inserción en `reserva` y `resena`** (la matriz devolvía un error de trigger antes de evaluar la RLS): prueba dirigida con filas completas (`tests/aislamiento/insercion_reserva_resena.sql`): **26/26** — `reserva` directa la bloquea el trigger `RESERVA_SOLO_POR_FUNCION` para **todos** (incluido el dueño: solo por función); `resena` la bloquea la RLS salvo el cliente con reserva COMPLETADA propia (control).
**Veredicto por tabla** (89 filas): `evidencias_1a/tablas_veredicto.tsv` — 89 APROBADAS (77 «aisladas», 12 «lectura pública» justificada), 0 NO APROBADAS.

**Limitaciones que debes tener presentes (D):** cada una de las 61 tablas tiene **una** fila sintética, no un conjunto con estados variados; el PATCH prueba la llave primaria (no cada columna); una celda «0 filas» significa que la RLS ocultó la fila, no que exista un UPDATE denegado explícitamente; no se probó el rol *guardián/profesional de B* como actor autorizado con permisos finos (solo dueño B y Super Admin como control); y las ≈ 443 celdas de RPC con argumentos ficticios de la Fase 0 siguen inconclusas. «Aprobada» significa «sin violación detectada con estos datos y estas pruebas», no una prueba formal.

## 6. Regresiones

- Suites SQL: **16 de 17 OK** (`evidencias_1a/sql_tests_fase1a.tsv`; la 17.ª es la nueva `f0_05`). Falla solo `directiva_116_118` (la prueba 118 está desactualizada respecto a la migración 133; igual que en la Fase 0, no la toqué porque refleja regla de negocio).
- Vitest completo: **12 archivos / 112 pruebas OK**, 2 archivos omitidos a propósito (admin y webhook de integración, que exigen entorno local). `tsc`: sin errores en lo tocado (los únicos son los tipos globales `PageProps`/`RouteContext` que genera `next typegen` y que ya faltaban en `origin/main`). ESLint: sin hallazgos en los archivos modificados.
- Todo se volvió a ejecutar sobre una **base reconstruida desde cero** (`reiniciar.sh`: 140 migraciones aplicadas, 3 min 35 s).

## 7. Hallazgos que requieren otra fase / tu decisión

| Id | Sev. | Qué | Por qué no lo corregí |
|---|---|---|---|
| F1A-04 | P3 | `referido_config`, `vip_nivel` legibles por cualquiera; `cashback_regla`/`sello_campana` no condicionan a negocio ACTIVO; tablas de IA legibles por anónimos | Cambio de política en el módulo de lealtad/IA: decisión de producto |
| F1A-05 | P3 | `agregar_miembro_familiar` agrega a cualquier perfil (uuid) sin consentimiento; `p_limite_miembros` sin tope | Regla comercial / flujo de consentimiento |
| F1A-06 | P3 | 16 páginas de `/admin` sin guardia propia | Hay cambios sin confirmar tuyos en esas páginas |
| F1A-07 | P3 | `zod` antes que la sesión en `reglas`/`whatsapp`/`planes` | Cosmético, no filtra datos |
| — | P2 | Las ~55 Server Actions fuera de `/admin` no se han auditado | Fuera de alcance; propuesta: Fase 1B |
| — | P2 | F0-06 (`anon`/`authenticated` con DML+TRUNCATE a nivel de tabla), F0-07 (chequeo de plan antes de autorización en 11 funciones), H-009/H-010 | No autorizados en esta fase |
| — | — | `is_supersu()` ejecutable por anónimos | Inocuo: devuelve `false` |

## 8. Riesgos residuales y pasos para llevarlo a producción (no ejecutados)

1. **Nada de esto está desplegado.** Hasta entonces producción conserva F0-01 (webhook que rechaza firmas legítimas), F0-05 y la ausencia de guardia en 7 archivos de acciones de `/admin`.
2. Orden sugerido (como en tu regla «base primero, luego código»): aplicar la migración 138 (aditiva) y después desplegar el código. La 138 se puede aplicar sola sin riesgo para el código actual: la interfaz solo manda el nombre del grupo.
3. El código de F0-01 ya está en tus archivos locales sin confirmar; al confirmarlos quedan idénticos a lo probado aquí.
4. Antes de producción conviene una prueba de firma con una notificación real del simulador de Mercado Pago en sandbox y la clave del panel (no hecha).
5. `.env.local`: tiene `CLOUDINARY_ENV` **dos veces** (`dev` y `prod`); con dotenv gana la última, o sea `prod` en tu máquina. Deja solo `dev`. No hay API key/secret ahí (están en Vercel, como indicaste).

## 9. Preparación para producción (solo con evidencia nueva)

Estimación 42 % → ≈ 47 % (repositorio/local). Suma: F0-01 validado con prueba de firma y corrección lista (+2), F0-05 cerrado con 34 casos (+1), H-008 con segunda capa y evidencia por actor (+1), cobertura de aislamiento 28 → 89 tablas (+1). **En producción: sin cambio (≈ 42 %)** hasta desplegar y repetir la prueba allí con datos de sandbox. No sube por: lo no auditado (acciones fuera de `/admin`), F0-06/F0-07, Cloudinary/almacenamiento, legal, pruebas E2E, infraestructura y respaldos.

## 10. Reproducción

```bash
cd C:\Users\karni\Documents\stylernow-cierre
bash scripts/entorno-local/reiniciar.sh                 # base desde cero + semillas (~3,5 min)
npx vitest run tests/f0-01-request-id-proxy-webhook.test.ts        # A
bash scripts/entorno-local/sql-tests.sh                              # B y regresión SQL (incluye f0_05)
set -a; eval "$(supabase status -o env | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"; . ./.credenciales-pruebas.local; set +a
PRUEBAS_LOCALES_ADMIN=1 ETIQUETA=x npx vitest run tests/admin-actions-autorizacion.test.ts    # C
node tests/aislamiento/matriz.mjs                                    # D (HTTP)
# SQL dirigidos (D): contra la base `postgres` sembrada
tr -d '\r' < tests/aislamiento/insercion_reserva_resena.sql | docker exec -i supabase_db_stylernow-cierre psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q
tr -d '\r' < tests/aislamiento/visibilidad_negocio_inactivo.sql | docker exec -i supabase_db_stylernow-cierre psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q
```
Estas pruebas escriben en la base **local** (PATCH/DELETE reales y acciones administrativas): después de correrlas conviene `reiniciar.sh`. Se niegan a correr contra cualquier API que no sea `127.0.0.1:55321`.

## 11. Archivos

Modificados: `src/proxy.ts`, `src/lib/pagos/webhook-mercadopago.ts` (F0-01); `src/app/admin/{actions,barra-actions,ai/actions,configuracion/actions,lealtad/actions,planes/actions,soporte/actions}.ts` (H-008); `scripts/entorno-local/reiniciar.sh`, `tests/aislamiento/matriz.mjs`.
Nuevos: `src/lib/auth/autorizar-supersu.ts`; `supabase/migrations/138_crear_grupo_familiar_autorizacion.sql`; `supabase/seed_tablas_sin_datos.sql`, `supabase/seed_admin_acciones.sql`; `tests/f0-01-request-id-proxy-webhook.test.ts`, `tests/admin-actions-autorizacion.test.ts`, `tests/sql/f0_05_crear_grupo_familiar.sql`, `tests/aislamiento/{insercion_reserva_resena,visibilidad_negocio_inactivo}.sql`; `scripts/resumen-admin-actions.mjs`; `docs/plan_cierre/evidencias_1a/*`.
