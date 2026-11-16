# Plan de liberación controlada · migraciones 139, 141 y 142 + código de `cierre/fase-0`

Escrito para: el propietario de StylerNow (Wilder), que va a decidir qué autoriza y, si elige la Alternativa B, ejecutará los pasos SQL en el SQL Editor de Supabase.
Fecha: 2026-11-15 · Rama: `cierre/fase-0` (commit `f7a84be`) · **Nada de lo descrito aquí se ha ejecutado en producción, en Vercel ni en GitHub.** Todo lo que dice «probado» se probó en el Docker local de pruebas.

---

## 0. Resumen y recomendación (lee esto primero)

1. **Se puede liberar sin ninguna ventana de incompatibilidad.** La única incompatibilidad real entre el código y la base es el costo de IA (`ai_accion_costo`), y se resuelve con un paso previo de «expansión»: crear la función `ai_acciones_costo_admin()` **antes** de desplegar el código. Está demostrado con pruebas (sección 3).
2. **Orden recomendado (demostrado):** captura del estado previo → **paso 1** (crear la función) → **141** → **142** → desplegar el código → verificar → **139** (al final).
3. **139 va al final a propósito:** es la única migración que rompe el código viejo (Centro de IA del Super Admin y tarjeta ROI del dueño). Si se aplica antes de que el código nuevo esté en producción, esas dos pantallas fallan (demostrado). Y si se aplica y luego hubiera que volver al código anterior, también fallarían. Por eso 139 solo se aplica cuando el código nuevo ya lleva un rato estable.
4. **No hay respaldo recuperable de producción hoy.** Tu proyecto está en el plan Free de Supabase (sin copias automáticas) y yo nunca volqué producción (no tengo, ni debo tener, una conexión de lectura). Es una brecha real y la sección 4 explica cómo se cubre para **estas** migraciones (ninguna modifica ni borra filas: lo único que cambia son permisos, políticas y funciones, y eso sí se puede capturar y restaurar exacto — probado).
5. **`main` se movió.** Desde que subí mi rama, entraron 2 commits tuyos a `main` (`7321a19` contraseña mínima 8 y `bb5ea72` portada del Home). No tocan los mismos archivos que mi rama (fusión local de prueba: limpia), pero hay que integrarlos y repetir las pruebas antes del despliegue (sección 7).
6. **Recomendación:** **Alternativa B para los pasos SQL** (tú los ejecutas en el SQL Editor, archivo por archivo, con comprobación antes y después) **y yo me encargo del código** (integrar `main`, pruebas, push y verificación en Vercel) cuando lo autorices. Motivo: la herramienta con la que yo aplico migraciones ya rechazó la 139 una vez; el SQL Editor lo controlas tú, ves cada paso y la propia ejecución manual es la autorización expresa que pides. La Alternativa A queda descrita por completo por si prefieres que lo haga yo.

---

## 1. Estado confirmado (según lo que me dijiste y lo que apliqué antes)

| Migración | Producción | Nota |
|---|---|---|
| 138 `crear_grupo_familiar` autorización | **aplicada** | No volver a ejecutarla: 139 reescribe la misma función; correr 138 después de 139 **degradaría** la función |
| 140 tope 100 % en promociones | **aplicada** | CHECK `NOT VALID`: no revisa filas viejas (en producción hay 0 promociones) |
| 139 endurecimiento | **pendiente** | |
| 141 quitar TRUNCATE/TRIGGER/REFERENCES | **pendiente** | |
| 142 `registrar_evento_fraude` acotado | **pendiente** | |

No ejecuté, ni ejecutaré sin tu orden, SQL remoto, merge, push, despliegue, cambios en variables de Vercel, pagos ni borrados. `limpieza_total_produccion.sql` no se toca.

---

## 2. Auditoría línea por línea de las tres migraciones pendientes

Leí los tres archivos completos (`supabase/migrations/139_…`, `141_…`, `142_…`). Ninguna contiene `delete`, `truncate` (141 lo *revoca*), `drop table`, `update` de filas ni `alter table … alter column`.

### 2.1 Migración 139 — `139_endurecimiento_fase1b.sql` (cuatro correcciones independientes en un archivo)

| Parte | Qué vulnerabilidad corrige | Qué modifica exactamente |
|---|---|---|
| **F1A-04** | Cualquiera, incluso anónimo, leía el monto de referidos y los niveles VIP de **cualquier** negocio (`USING (true)`) | Política `referido_config_select`: solo personal interno del negocio o Super Admin. Política `vip_nivel_select`: interno, Super Admin, o el cliente que pertenece a ese nivel |
| **F1A-05** | Cualquier usuario con sesión leía `costo_proveedor_estimado` y `margen_pct` (márgenes internos de la plataforma) | `revoke all` sobre `ai_accion_costo` a `public, anon, authenticated`; `grant select` solo de 8 columnas no sensibles a `authenticated`; **crea** `ai_acciones_costo_admin()` (security definer, solo Super Admin) |
| **F1A-06** | `agregar_miembro_familiar` permitía sumar a cualquier perfil a un grupo familiar sin su consentimiento | `revoke all … from public, anon, authenticated` (nadie con sesión la puede ejecutar; la app no la usa) |
| **F1A-07 + directriz de descuentos** | `crear_grupo_familiar` aceptaba un límite de miembros arbitrario (1000, 2 147 483 647…) y un descuento familiar que no se aplica a nada | Reescribe `crear_grupo_familiar` (descuento solo 0; límite 1–20; solo el dueño del negocio o Super Admin cambia el límite por defecto de 4); agrega CHECK `familia_grupo_limite_miembros_chk` (1–20, `NOT VALID`) |

- **Funcionalidades que pueden verse afectadas:** Centro de IA del Super Admin; tarjeta ROI de IA del dueño (solo con el código viejo); nada más (probado: lealtad, VIP, familia y fraude siguen funcionando con código viejo y nuevo).
- **Código de Next.js que depende:** `src/app/admin/ai/actions.ts` (llama a `ai_acciones_costo_admin`, líneas 37 y 242) y `src/app/panel/ia/actions.ts` (ya no lee `costo_proveedor_estimado`). El código **viejo** (producción hoy) hace `select *` y `select …costo_proveedor_estimado` sobre la tabla: falla tras 139.
- **Requiere otra migración previa:** 138 (aplicada). No requiere 140, 141 ni 142.
- **Reversible:** sí, sin pérdida de datos (no toca filas). `139_endurecimiento_fase1b_REVERSION.sql.txt` existía pero **estaba incompleta** (no quitaba el permiso por columnas ni devolvía privilegios exactos); la reemplaza `supabase/scripts/liberacion/reversion_139_141_142.sql.txt` + la captura previa. Probado: tras revertir, las huellas de privilegios, políticas, funciones y constraints son **idénticas** a las de antes (sección 5.2).
- **Riesgos sobre la base actual de producción:**
  1. *Datos que ya incumplen el CHECK:* ninguno (14 grupos familiares, 0 con descuento ≠ 0, 0 con límite fuera de 1–20; medido antes). Aun así el CHECK es `NOT VALID`: no revisa filas existentes.
  2. *Privilegios reales distintos a los que asumí:* mis pruebas locales parten de una instantánea de privilegios de producción (2026-11-15). Por eso la captura previa (sección 4) guarda los privilegios **exactos** antes de aplicar.
  3. *Función reescrita:* si alguien llamara `crear_grupo_familiar` con descuento > 0 desde fuera de la app, ahora recibe `DESCUENTO_FAMILIAR_NO_SOPORTADO` (intencional).

### 2.2 Migración 141 — `141_quitar_truncate_y_trigger_a_roles_publicos.sql`

- **Vulnerabilidad:** en producción todas las tablas de `public` concedían a `anon` y `authenticated` los privilegios TRUNCATE, REFERENCES y TRIGGER. Las políticas RLS acotan SELECT/INSERT/UPDATE/DELETE, pero **TRUNCATE no pasa por RLS**: cualquier vía que ejecute SQL con esos roles podría vaciar una tabla.
- **Qué modifica:** `revoke truncate, references, trigger on all tables in schema public from anon, authenticated` y 2 `alter default privileges` (las tablas futuras no nacen con esos privilegios). No toca políticas, funciones ni filas.
- **Qué puede verse afectado:** nada de la app: PostgREST nunca emite TRUNCATE ni crea triggers/referencias. Probado: 0 privilegios de esos tipos quedan para `anon`/`authenticated` tras aplicarla y la matriz de comportamiento no cambia.
- **Código que depende:** ninguno.
- **Requiere otra migración:** ninguna.
- **Reversible:** sí. La sentencia genérica del propio archivo re-concedería de más (no todas las tablas tenían los tres privilegios para ambos roles); la **captura previa genera las sentencias exactas** (sección A). Probado.
- **Riesgos:** (a) si alguna tabla de `public` no pertenece a `postgres`, `revoke` emite un aviso y no la cambia (la captura sección H lo detecta antes); (b) **residual:** en Postgres 17 existe el privilegio `MAINTAIN` (VACUUM/ANALYZE/LOCK) que 141 no revoca y que `anon`/`authenticated` tienen por defecto (97 de 138 tablas en el entorno local). No es una vía de borrado ni de lectura; queda anotado como seguimiento y **no** lo meto en 141 (no modifico una migración sin justificarlo; en Postgres < 17 la sentencia fallaría).

### 2.3 Migración 142 — `142_registrar_evento_fraude_acotado.sql`

- **Vulnerabilidad:** cualquier usuario con sesión podía insertar eventos de fraude en el negocio de **otro** (`p_negocio_id` libre), con severidad y payload a su elección: contaminar la bandeja de fraude de dueños y Super Admin y llenar la tabla con payloads enormes.
- **Qué modifica:** `registrar_evento_fraude(text, uuid, text, jsonb)`, misma firma (`create or replace`, no crea sobrecarga): exige sesión; un negocio sin relación con quien llama se guarda como NULL; severidad fija MEDIA; payload > 4096 caracteres se reemplaza por `{"truncado": true}`; grants a `authenticated` solamente.
- **Qué puede verse afectado:** solo el registro de fraude. En el código actual la acción `registrarEventoFraude` (`src/app/lealtad/actions.ts:107`) **no tiene ningún llamador**, y es «best-effort» (un error se ignora). Impacto funcional práctico: ninguno.
- **Código que depende:** ninguno obligatorio.
- **Requiere otra migración:** ninguna.
- **Reversible:** sí (restaurar la definición previa; la captura sección D la guarda exacta). Probado.
- **Riesgos:** un cliente que reporte fraude de un negocio donde no tuvo reservas ya no lo asocia a ese negocio (por diseño). Con eventos que hoy existen (3 en local; en producción se verifica en la captura, sección G) no se cambia ninguna fila.

---

## 3. Compatibilidad código ↔ base: el orden se demuestra, no se supone

**Prueba:** `tests/sql/f1b_compat_codigo_vs_base.sql`. Con sesión real de cada rol (`set local role` + JWT) ejecuta **las mismas consultas** que hace el código de producción hoy (commit `130481e`, «VIEJO») y el de la rama (commit `f7a84be`, «NUEVO»), y reporta si funcionan. Se corrió en una base local reconstruida desde cero con exactamente el estado de producción hoy (migraciones 001–138 y 140 + privilegios de producción) y en cada estado posterior.

### 3.1 Resultados (los literales de la salida)

| Consulta | **S0** producción hoy | **Naive**: 139 completa antes del código | **S1**: paso 1 (solo crear la función) | **S2**: tras 139+141+142 |
|---|---|---|---|---|
| 1 VIEJO · Centro de IA `select *` (Super Admin) | funciona (13) | **FALLA** `permission denied for table ai_accion_costo` | funciona | **FALLA** (código viejo ya retirado) |
| 2 VIEJO · Centro de IA costos | funciona | **FALLA** | funciona | FALLA (ídem) |
| 3 NUEVO · `rpc ai_acciones_costo_admin()` | **FALLA** `function … does not exist` | funciona | **funciona** | funciona |
| 4 VIEJO · ROI del dueño (`costo_proveedor_estimado`) | funciona | **FALLA** | funciona | FALLA (ídem) |
| 5 NUEVO · ROI del dueño (`accion, categoria`) | funciona | funciona | funciona | funciona |
| 6–10 AMBOS · lealtad, VIP del dueño y del cliente, `crear_grupo_familiar(nombre)`, `registrar_evento_fraude` | funcionan | funcionan | funcionan | funcionan |

Conclusiones demostradas:

- **Desplegar el código antes de crear la función** (S0 + código nuevo): el Centro de IA falla (fila 3). Hay que migrar primero.
- **Aplicar 139 completa antes del código** (columna Naive): el Centro de IA y la tarjeta ROI **fallan** hasta que el código nuevo llegue (filas 1, 2, 4). Esta es la ventana que el informe advertía.
- **Con el paso 1 (S1) ambos códigos funcionan a la vez.** Es el punto seguro donde se hace el despliegue: **ventana de incompatibilidad = 0**.
- **Tras 139 (S2) solo el código nuevo funciona**: por eso 139 va después del despliegue y de un período de observación.
- Lo demás (lealtad, VIP, familia, fraude) es independiente del orden.
- Aclaración de lo que ve el usuario con el código viejo tras 139: el Centro de IA del Super Admin devuelve error; la tarjeta ROI del dueño ignora el error y calcularía costos en 0 (el código viejo descarta el error), es decir, muestra un dato incorrecto sin avisar.

### 3.2 Estrategia expandir → desplegar → contraer

| Fase | Acción | Rompe algo | Por qué es seguro |
|---|---|---|---|
| Expandir | Paso 1: crear `ai_acciones_costo_admin()` (copia exacta de la de 139) | No | Solo agrega una función; el código viejo no la usa |
| Independientes | 141 y 142 | No | No dependen del código (filas 6–10 sin cambio) |
| Desplegar | Merge de la rama a `main` | No | El código nuevo funciona con S1 (filas 3 y 5) |
| Contraer | 139 | Solo al código viejo, que ya no existe | El código nuevo funciona en S2 |

No dividí ni modifiqué 139: el paso 1 es un archivo **nuevo y aparte** (`supabase/scripts/liberacion/paso1_expandir_ai_acciones_costo_admin.sql`) con la misma función. 139 usa `create or replace`, así que reaplicarla después es idempotente. Justificación de que exista: es la única forma de lograr ventana 0 sin tocar 139.

Tiempo de incompatibilidad con el orden recomendado: **0 s**. Con el orden «naive»: desde que se aplica 139 hasta que Vercel publica el código (minutos).

---

## 4. Respaldo y recuperación

**Qué confirmé, sin ejecutar nada remoto, y qué NO pude confirmar:**

| Pregunta | Respuesta honesta |
|---|---|
| ¿Existe un respaldo recuperable de **producción**? | **No lo puedo confirmar y, según el informe de Fase 0, no existe por mi parte.** El plan Free de Supabase no incluye copias automáticas; yo no volqué producción. Compruébalo tú en Supabase → Database → Backups (si ves copias o PITR, anota la fecha de la última). |
| ¿Está disponible la clave de cifrado? | Para los respaldos **locales** de prueba sí: `.respaldo-clave.local` existe en el worktree (48 bytes, ignorada por Git, nunca impresa). Esa clave **no** protege nada de producción: nunca se hizo un respaldo de producción con ella. |
| ¿Está documentada la restauración? | El procedimiento local está en `scripts/respaldo/respaldar.sh` y `restaurar-prueba.sh` (GPG AES-256, comprobación SHA-256, ensayo en base nueva con huellas). `docs/RESTAURACION.md` **no existe**: lo prometía el plan de Fase 0 y queda pendiente. |

**Por qué estas tres migraciones aun así se pueden aplicar con riesgo controlado:** ninguna modifica ni borra filas. Solo cambian (a) privilegios de tabla y de función, (b) dos políticas RLS, (c) la definición de dos funciones, (d) un CHECK `NOT VALID`. Eso es exactamente lo que captura `supabase/scripts/liberacion/captura_estado_previo.sql` (solo `SELECT`, no cambia nada) y que se restaura con sentencias exactas. Probado: aplicar adelante, revertir con la captura y comparar huellas → **idéntico** (tablas, columnas, políticas, definiciones y permisos de funciones, constraints, privilegios por defecto).

**Antes de aplicar nada (tú):**
1. Ejecuta `captura_estado_previo.sql` en el SQL Editor y **guarda el resultado completo fuera del proyecto** (exportar CSV o pegar en un archivo). Anota los conteos de la sección G.
2. Revisa en el panel Database → Backups. Si no hay copia, **antes de la 139 recomiendo** (no obligatorio para estas migraciones, sí para el lanzamiento) un `pg_dump` con la cadena de conexión que solo tú tienes, cifrado, o activar un plan con copias. Decisión tuya; no contraté ni cambié nada.

**Cómo comprobar que se aplicó bien:** cada paso de la sección 6.2 trae su comprobación posterior en SQL de solo lectura y su resultado esperado.

---

## 5. Pruebas locales ejecutadas

Entorno: Docker local `stylernow-cierre` (puertos 553xx) **reconstruido desde cero** con el candidato (`reiniciar.sh`: 144 archivos de migración, privilegios de producción, semilla). Nada apunta a producción.

### 5.1 Resultados

| Prueba | Resultado |
|---|---|
| 21 suites SQL (`sql-tests.sh`, incluye la orquestada del hotfix): aislamiento multiempresa, RLS, seguridad_regresion, anticipos, cobro directo, auditoría, libro, notificaciones, prueba antiabuso, registro, rendimiento, suscripción, webhook, whatsapp, hotfix staff, `f0_05`, `f1b_139` (38/38), `f1b_141_142` (9/9), `f1b_promociones_140` (22/22), `f1b_compat_codigo_vs_base` | **20 OK · 1 FALLA**: `directiva_116_118` (caso «prueba vencida debe pasar a REQUIERE_PLAN»; el sistema hoy la deja en `EN_MORA` por el diseño de la migración 133). Es una prueba **obsoleta anterior a esta liberación**, no tocada por 139–142; la dejo marcada, no la declaro aprobada |
| Matriz de aislamiento por HTTP real (89 tablas, 9 actores, `tests/aislamiento/matriz.mjs`) | `referido_config` y `vip_nivel` **ya no** aparecen legibles por ajenos (antes sí). Quedan visibles: `cashback_regla` (pública por diseño, residual F1A-04) y `oferta_negocio` (promociones vigentes para usuarios con sesión, por diseño). Control positivo: el dueño B ve sus 73 tablas y el Super Admin 77. Evidencia: `docs/plan_cierre/evidencias_1b/matriz_aislamiento_candidato_liberacion.json` |
| Vitest completo (`npx vitest run`) | 112 pasaron · 17 omitidas (las que requieren entorno local explícito) |
| `tsc --noEmit` | 0 errores |
| ESLint (`src` y `tests`, solo errores) | sin hallazgos |
| Arnés dinámico de Server Actions (sesión real por actor, 9 actores) | **Corrida completa (268 acciones): NO terminó** — agotó su límite de 50 min con el equipo ocupado en otras pruebas y no escribió resultados; **no la marco como aprobada**. En su lugar corrí **por tramos los 5 archivos que tocan 139–142** (66 acciones: `app/lealtad`, `panel/lealtad`, `panel/ia`, `negocio/[slug]`, `panel/crm`): **43 limpias con control válido, 22 inconclusas (no demostradas), 1 señalada** = `alternarFavorito`, falso positivo ya explicado (cada usuario escribe **sus propios** favoritos). `registrarEventoFraude`, que antes de 142 salía como fuga real, ya **no** sale señalada. Evidencia: `docs/plan_cierre/evidencias_1b/server_actions_candidato_*.json`. Las otras ~200 acciones no se volvieron a correr contra este candidato; la corrida completa anterior (previa a 139) está en `server_actions_antes_139_codigo_actual*.json` |
| Compatibilidad código ↔ base (4 estados) | ver sección 3.1 |
| Reversión (adelante → revertir con la captura → huellas) | idéntico a la base original |

**Lo que NO se ejecutó** (no lo marco como aprobado): `next build` local (en el worktree falla por el junction de `node_modules`; la vista previa de Vercel de `f7a84be` compiló en READY, pero **hay que repetirlo** tras integrar `main`), pruebas de punta a punta con navegador del Centro de IA y de la tarjeta ROI (cubiertas aquí por las consultas exactas del código y por el arnés, no por clics reales; la verificación visual en producción está en la lista del paso 5), y las pruebas de carga (prohibidas contra producción).

### 5.2 Prueba de reversión (lo que respalda el plan de contingencia)

Procedimiento: base local con el estado de producción hoy → paso 1 + 139 + 141 + 142 → ejecutar `reversion_139_141_142.sql.txt` + las sentencias de la captura tomada **antes** → comparar huellas MD5 de: privilegios de las 138 tablas (por rol y privilegio), privilegios por columna, todas las políticas de `public`, definiciones de las 3 funciones tocadas, permisos de ejecución de esas funciones, constraints, privilegios por defecto. Resultado: **idénticas**. (La única diferencia que dejó la reversión es la función `ai_acciones_costo_admin()`, que se conserva a propósito porque es inocua y mantiene al código nuevo funcionando.)

---

## 6. Las dos alternativas

Los dos caminos usan **el mismo orden** (sección 6.1). Cambia quién ejecuta el SQL.

### 6.1 Orden exacto

| # | Paso | Quién | Reversible | Rompe algo |
|---|---|---|---|---|
| 0 | Captura del estado previo (solo lectura) + revisar backups | Tú | n/a | No |
| 0b | Integrar `main` (2 commits nuevos) en la rama, repetir pruebas | Yo (con tu orden) | sí | No |
| 1 | Paso 1: crear `ai_acciones_costo_admin()` | SQL | sí (`drop function`) | No |
| 2 | **141** | SQL | sí | No |
| 3 | **142** | SQL | sí | No |
| 4 | Merge a `main` → Vercel despliega | Yo (con tu orden) | sí (rollback de Vercel) | No (con S1 ambos códigos funcionan) |
| 5 | Verificación en producción + período de observación | Ambos | n/a | n/a |
| 6 | **139** | SQL | sí (captura) | Solo al código viejo (ya retirado) |
| 7 | Verificación final + informe | Yo | n/a | n/a |

Período de observación entre 4 y 6: al menos unas horas con tráfico normal y sin errores en los registros de ejecución. Motivo único: tras 139, volver al despliegue anterior de Vercel rompería de nuevo esas dos pantallas.

### 6.2 Alternativa B — tú aplicas el SQL (recomendada)

Reglas para todos los pasos: pega **el contenido exacto del archivo**, sin cambiar nada; envuélvelo en `begin;` … `commit;` (así si algo falla no queda a medias); ejecuta un paso, verifica y solo entonces el siguiente.

**Paso 0 — Captura previa** · Archivo `supabase/scripts/liberacion/captura_estado_previo.sql` (solo SELECT).
- Resultado esperado: filas de las secciones A–I. Sección H (tablas con dueño distinto de `postgres`) **debe salir vacía**; si trae filas, detente y avísame. Sección F debe mostrar los dos CHECK (`familia_grupo_limite_miembros_chk` **no** debe aparecer aún; `oferta_negocio_porcentaje_max_chk` sí). Sección G: anota los conteos.
- Si hay error: no es una escritura; avísame con el texto.

**Paso 1 — Expandir** · Archivo `supabase/scripts/liberacion/paso1_expandir_ai_acciones_costo_admin.sql`.
- Antes: `select to_regprocedure('public.ai_acciones_costo_admin()');` → `NULL`.
- Después: `select to_regprocedure('public.ai_acciones_costo_admin()')::text, (select proacl::text from pg_proc where oid = 'public.ai_acciones_costo_admin()'::regprocedure);` → la función existe y el ACL incluye `authenticated=X` y **no** incluye `anon` ni un ACL público (`=X`).
- Si hay error: nada quedó aplicado (transacción); avísame. Reversión: `drop function if exists public.ai_acciones_costo_admin();`

**Paso 2 — 141** · Archivo `supabase/migrations/141_quitar_truncate_y_trigger_a_roles_publicos.sql`.
- Antes: `select count(*) from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated') and privilege_type in ('TRUNCATE','TRIGGER','REFERENCES');` → número > 0 (en local fueron 586).
- Después: la misma consulta → **0**. Navega la app (inicio, un negocio, reservar) para confirmar que todo carga.
- Si hay error o aviso «no privileges could be revoked»: avísame antes de seguir. Reversión: sentencias de la sección A de la captura.

**Paso 3 — 142** · Archivo `supabase/migrations/142_registrar_evento_fraude_acotado.sql`.
- Antes: `select pg_get_functiondef('public.registrar_evento_fraude(text,uuid,text,jsonb)'::regprocedure) like '%NO_AUTENTICADO%';` → `false`.
- Después: misma consulta → `true`; `select proacl::text from pg_proc where oid='public.registrar_evento_fraude(text,uuid,text,jsonb)'::regprocedure;` → sin `anon`.
- Reversión: la definición de la sección D de la captura + sección E.

**Paso 4 — Despliegue** (yo, con tu orden expresa). Ver sección 7. Tú no ejecutas SQL aquí.

**Paso 5 — Verificación en producción** (después de que Vercel marque READY). Con tu sesión de Super Admin: `/admin/ai` carga la lista de acciones con sus costos y márgenes. Con una sesión de dueño de pruebas: `/panel/ia` carga la tarjeta ROI y `/panel/promociones` abre. Con una cuenta de cliente de pruebas: la página de un negocio muestra «tu nivel VIP» si lo tiene y `/lealtad` permite crear un grupo familiar solo con nombre. Yo reviso en paralelo los errores de ejecución de Vercel. **No uses las cuentas reales** `ghocho88@…` ni `wildercaicedo88@…` para pruebas destructivas.

**Paso 6 — 139** · Archivo `supabase/migrations/139_endurecimiento_fase1b.sql`.
- Antes (todos deben cumplirse): el paso 5 sin errores; `select has_table_privilege('authenticated','public.ai_accion_costo','SELECT');` → `true`.
- Después: `has_table_privilege('authenticated','public.ai_accion_costo','SELECT')` → **false**; `has_column_privilege('authenticated','public.ai_accion_costo','costo_creditos','SELECT')` → **true**; `has_column_privilege('authenticated','public.ai_accion_costo','margen_pct','SELECT')` → **false**; `select pg_get_constraintdef(oid) from pg_constraint where conname='familia_grupo_limite_miembros_chk';` → `CHECK … <= 20 NOT VALID`; `has_function_privilege('authenticated','public.agregar_miembro_familiar(uuid,uuid,text)','EXECUTE')` → **false**; `select qual from pg_policies where policyname='referido_config_select';` → ya no es `true`.
- Luego repite las verificaciones del paso 5 (en especial `/admin/ai` y `/panel/ia`).
- Si hay error: avísame con el texto; reversión con la captura + `reversion_139_141_142.sql.txt`.

**Qué NO debes ejecutar bajo ninguna circunstancia**
- `138_…sql` (ya aplicada; correrla después de 139 degradaría `crear_grupo_familiar`) ni `140_…sql`.
- `limpieza_total_produccion.sql`, `supabase db reset`, `supabase db push` (intentaría aplicar migraciones fuera de orden), `reiniciar.sh`, ninguna semilla (`seed_*.sql`), ni `paridad_privilegios_*.sql` (son solo del entorno local).
- `139_endurecimiento_fase1b_REVERSION.sql.txt` (versión antigua incompleta); usa `reversion_139_141_142.sql.txt` + la captura.
- La reversión **sin** haber guardado la captura previa.
- 139 antes del paso 4 y del paso 5.
- Cualquier migración con número de paso cambiado de orden.

### 6.3 Alternativa A — liberación coordinada por mí

Igual que B, pero yo aplico los pasos 1, 2, 3 y 6 con la herramienta de migraciones de Supabase y hago el despliegue. **Requisitos y límites:** (a) la herramienta rechazó la 139 la vez anterior y puede volver a hacerlo: se necesita que apruebes cada aplicación en el aviso de permisos; (b) cada paso la ejecutaría yo inmediatamente después de la anterior, sin tu revisión visual intermedia (la verificación sería por mis consultas de solo lectura); (c) la captura previa la tendrías que ejecutar igualmente tú (yo no leo producción sin tu orden). Ventaja: menos pasos manuales. Desventaja: menos control tuyo y un posible bloqueo a mitad de camino. **Mi recomendación sigue siendo B.**

---

## 7. Git y Vercel (antes de cualquier merge o despliegue)

**Commits que entrarían a `main`:** `f7a84be` `fix(seguridad): fases 1A y 1B — guardia Super Admin, grupos familiares, costos de IA, promociones del dueño, migraciones 138-142` (único commit propio sobre `130481e`).
**`origin/main` hoy:** `bb5ea72` (tuyo). Entraron desde mi base `130481e`: `7321a19` (contraseña mínima 8) y `bb5ea72` (nueva portada del Home). **Ningún archivo en común** con mi commit; `git merge-tree` local → fusión limpia (no se ejecutó merge).

**Diff propio** (`git diff 130481e f7a84be`, la base común con `main`): **51 archivos de código, migraciones, pruebas y herramientas (+2 836 / −52)** y **38 archivos de documentación y evidencia** (+84 718, casi todo JSON/CSV de evidencias). Nota: contra el `origin/main` actual el diff aparentaría «borrar» la portada nueva (porque mi rama aún no la tiene); por eso el diff real se mide contra la base común. El diff completo se obtiene con ese comando; por área:

| Área | Archivos |
|---|---|
| Migraciones | 138, 139 (+ reversión), 140, 141, 142 |
| Guardias del Super Admin | `src/lib/auth/autorizar-supersu.ts` + guardias en 6 archivos de acciones de `/admin` (`ai`, `barra-actions`, `configuracion`, `lealtad`, `planes`, `soporte`) |
| Correcciones Fase 0/1A | `src/proxy.ts`, `src/lib/pagos/webhook-mercadopago.ts` |
| Costos de IA | `src/app/admin/ai/actions.ts`, `src/app/panel/ia/actions.ts`, `src/types/database.ts` |
| Pantalla nueva | `src/app/panel/promociones/*`, `route-registry.ts`, `panel-nav.tsx` |
| Pruebas y herramientas | `tests/*`, `scripts/*`, `supabase/seed_*`, `supabase/scripts/paridad_*`, `.gitignore`, `.gitattributes` |

**Preservación de correcciones previas:** el commit `f7a84be` contiene las correcciones de Fase 0 (request-id/proxy/webhook, `crear_grupo_familiar` 138) y de Fase 1A (guardia Super Admin, aislamiento, semillas); sus pruebas (`f0_05`, `f0-01`, `admin-actions-autorizacion`, `aislamiento`) corrieron verdes en este candidato.

**Cambios ajenos a esta liberación:** ninguno en el commit. En el worktree hay dos elementos **sin commitear que no deben entrar**: `supabase/config.toml` (puertos locales 553xx) y `docs/auditoria_integral/`. Los archivos nuevos de este plan (`supabase/scripts/liberacion/*`, `tests/sql/f1b_compat_codigo_vs_base.sql`, este documento y `docs/plan_cierre/evidencias_1b/matriz_aislamiento_candidato_liberacion.json`) están **sin commitear a propósito** hasta que lo ordenes.

**Antes del merge (con tu orden):** (1) integrar `main` en la rama (sin conflictos), (2) repetir las pruebas de la sección 5 sobre el resultado, (3) esperar la vista previa de Vercel en READY, (4) un solo push.

---

## 8. Plan de contingencia

| Falla | Qué hacer |
|---|---|
| Error al ejecutar el paso 1, 141 o 142 | Con `begin/commit` no queda nada a medias. Avísame con el texto exacto; no avances |
| 141 parece afectar algo (error de permisos en la app) | Reversión: sección A de la captura. Los afectados serían todos los usuarios, por eso se verifica la app justo después |
| El despliegue de Vercel falla (build) | Producción sigue con el despliegue anterior (Vercel no promueve un build fallido). Corregir en la rama; no hay efecto en la base (paso 1/141/142 son compatibles con el código viejo — S1) |
| Error en producción tras el despliegue, **antes** de 139 | Rollback de Vercel al despliegue previo (`dpl_55LnDhH7dyc7wp2yagKoLmf5Lapx` o el vigente antes de mi push). Seguro porque S1 admite código viejo |
| Error tras 139 | **No** hacer rollback de Vercel (el código viejo rompe con 139). Opciones: arreglar hacia adelante, o revertir 139 con `reversion_139_141_142.sql.txt` + captura y entonces sí hacer rollback del código |
| Una migración deja datos mal (no debería: no toca filas) | Compara conteos de la sección G de la captura. Si difieren, detén todo; restauración desde el respaldo que hayas confirmado (sección 4) |
| Los registros de Vercel muestran errores nuevos de `permission denied` | Pegar la línea; casi seguro apunta a código viejo sirviéndose tras 139 o a una consulta que seleccionó columnas sensibles de `ai_accion_costo` |

---

## 9. Riesgos que quedan (honestos)

1. **Sin respaldo de producción confirmado** (sección 4). Mitigado para estas migraciones por la captura + reversión probada, no resuelto en general.
2. **Mis pruebas parten de una instantánea de privilegios de producción** de hoy y no de producción en vivo. Por eso los comprobaciones previas y la captura son obligatorias: si producción difiere, las sentencias de la captura recuperan lo **real**.
3. **`MAINTAIN` (PG 17)** sigue concedido a `anon`/`authenticated` por defecto: seguimiento.
4. **`directiva_116_118`** sigue fallando (prueba obsoleta, no regresión de esta liberación); necesita actualizarse o retirarse.
5. **`main` seguirá moviéndose**: cualquier commit nuevo obliga a repetir la fusión y las pruebas.
6. **El arnés dinámico deja 115 acciones «inconclusas»** (no demostradas), anotadas en `INFORME_FASE1B.md`; no son parte de esta liberación pero siguen pendientes.
7. **Pendientes de decisión comercial** (no bloquean la liberación): ver `DISENO_FASE1B.md` §6.

---

## 10. Lo que estarías autorizando

Marca lo que apruebas expresamente, en orden:

- [ ] **A.** Integrar `main` en `cierre/fase-0`, repetir pruebas y hacer **un** push de la rama (sin desplegar a producción).
- [ ] **B.** Tú ejecutas el paso 0 (captura) y me compartes (o no) los resultados de las secciones F, G, H.
- [ ] **C.** Pasos 1, 2 y 3 (crear función, 141, 142), ejecutados por ti (Alternativa B) o por mí (Alternativa A).
- [ ] **D.** Merge a `main` y despliegue a producción, con verificación posterior.
- [ ] **E.** Después de la observación, paso 6 (139).

Detengo aquí. No haré nada remoto hasta tu aprobación expresa.
