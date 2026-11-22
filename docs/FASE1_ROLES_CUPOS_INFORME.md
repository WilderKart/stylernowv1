# FASE 1 — Roles por capacidades y cupo único de profesionales

> **Cierre de la Fase 1 (Implementado / Probado / Pendiente de decisión): ver `docs/FASE1_CIERRE.md`.**

Fecha: 2026-11-18. Rama `feat/onboarding-v2` (worktree `stylernow-onboarding`). Todo se probó SOLO contra Supabase local (Docker). No se tocó producción, no hay commits, merges ni push.

> Estado honesto: lo marcado «PASÓ» se ejecutó y se vio pasar; lo marcado «NO VERIFICADO» no se ejecutó.
> **Las secciones 0 y 10 (cierre) sustituyen a lo que digan las secciones 1–9 donde se contradigan** (p. ej. la normalización pasó a ser la migración **157** y SÍ está aplicada en la base local; el defecto de `session_version` SÍ se corrigió, en la migración 162).

---

## 0. Cierre de la Fase 1 (segunda pasada, ajustes aprobados)

Orden de migraciones: `…144` → *(evidencias 145, 146, 147, 148, de otras ramas)* → `149` límites → `150` onboarding → `151` modelo de roles → `152` cupo central → `153` perfil del propietario + configuración por plan + RPC SuperSU → `154` delegación mínima → `155` invalidación de sesión controlada → `157` normalización (la 156 no existe a propósito: la normalización se reubicó al final, tras todo lo que usa). Cada una con `*_REVERSION.sql.txt`.

1. **Normalización (157, antes «155»)** — ajustada y APLICADA en la base local: solo altas completas (`onboarding_completo`), nunca sin sede válida (se omite y se registra `NORMALIZACION_FASE1_OMITIDA`), sin borrar a nadie, sin cancelar invitaciones, sin desvincular para corregir exceso; el exceso se registra (`CUPO_EXCEDIDO_DETECTADO` con ocupados/límite) y los disparadores bloquean todo lo que lo aumente. Resultado real en la base local: 4 propietarios habilitados, 2 negocios con alta completa pero sin sede omitidos y registrados, 3 excesos registrados (Sandbox, Evidencias, Del Tano), idempotente (segunda ejecución sin eventos nuevos). `tests/sql/roles_157_normalizacion.sql` (+ `.sh`) verifica expresamente alta incompleta (incluso negocio ACTIVO) y negocio sin sede: PASÓ.
2. **session_version (155)** — causa: el trigger `perfil_proteger_columnas_sensibles` bloqueaba el cambio dentro de funciones definer. Solución sin dejar la columna escribible: `invalidar_sesion_usuario(usuario, negocio, motivo)` interna (sin grants a ningún rol de la API) que valida quién llama (propietario, administrador o SuperSU del negocio) y sobre quién (con vínculo con ese negocio; al propietario solo él mismo o SuperSU), marca la transacción, incrementa y audita (`SESION_INVALIDADA`). **Desviación honesta del encargo («trigger intacto»):** el trigger conserva todas sus reglas y recibe UNA excepción de dos factores (marca de transacción que solo escribe esa función Y `current_user` distinto de authenticated/anon); no había forma de permitir una vía autorizada sin esa cláusula. Pasan por ella: suspender, trasladar, retirar, promover/revocar Guardian y cambiar rol. PASÓ en SQL (propietario, administrador, barbero, ajeno; incluido el intento de autoponerse la marca) y por HTTP real. Los tests ya NO desactivan el trigger. Hallazgo: ningún consumidor verifica `session_version` hoy (los permisos se leen de la base en cada solicitud y cambian al instante): el contador queda como señal auditada.
3. **Suspendidos ocupan cupo** — regla solo en `_capacidad_profesional`; probado: suspender no libera cupo, no se puede invitar a otro en su lugar, reactivar es válido, y reactivar un RETIRADO por escritura directa respeta el tope.
4. **BUSINESS_ADMIN** — sin ampliar nada; probado por SQL y HTTP que suscripción/pagos/wallet/plan/propiedad/verificación/foto del negocio/configuración de planes están negados.
5. **Foto y consentimiento** — la foto profesional (`staff.foto_url`) es independiente de la fachada (`negocio.foto_principal_*`). La base ya exigía foto + consentimiento expreso (`staff_es_publicable`, evidencia inmutable encadenada con fecha, versión, actor y huella; `revocar_publicacion_staff`). **Faltaba toda la interfaz** (nada llamaba a `autorizar_staff`): se añadió `TarjetaVisibilidadPublica` (panel y `/staff/perfil`) con casillas SIN marcar, subir foto, autorizar y retirar. Pruebas SQL: sin foto/sin consentimiento solo agenda privada; solo foto no basta; fachada no publica; foto+tratamiento no basta; foto+consentimiento aparece en `negocio_staff_publico` y slots públicos; la evidencia no se edita; retirar lo oculta al instante y deja evidencia REVOCA. PASÓ.
6. **/admin/planes** — columnas únicas en `plan` (`propietario_profesional_por_defecto`, `propietario_perfil_auto_alta`, `propietario_puede_activar_perfil`, `propietario_puede_desactivar_perfil`); valores iniciales Essential por defecto+automático, resto apagado y activable. Las leen `activar_/desactivar_perfil_profesional_propietario`, `completar_onboarding_negocio`, la normalización y la interfaz (`cupo_plan_negocio.perfil_propietario`). RPC `admin_configurar_perfil_propietario_plan` (solo SuperSU, motivo ≥10, rechaza configuración incoherente, audita antes/después) + editor en `/admin/planes`. PASÓ en SQL y HTTP (admin/barbero/propietario rechazados). El editor se verifica solo por tsc/eslint/build (ver 9).
7. **Historial de migraciones** — sobre una base NUEVA (`create database` desechable en el mismo contenedor, con stubs mínimos de `auth`/`storage`; la base de pruebas no se tocó): las 154 migraciones de esta rama corren sin error; y la unión con 145/146/148 (rama `feat/centro-cumplimiento`) y 147 (worktree `stylernow-evidencias`, sin commitear) corre completa (158). Sobre la base nueva pasan limites_149, onboarding_150, roles_151 y roles_155_config…; revertir 157→151 y reaplicar también. **Hallazgos de integración:** (a) las funciones de consentimiento de staff (`autorizar_staff`, `aceptar_invitacion_staff`, `estado_autorizaciones_staff`, `evidencia_legal`) NO están en ninguna migración de esta rama: viven en 145–148 de otras ramas, así que esta rama sola NO es autosuficiente para la publicación del profesional; (b) **colisión de numeración**: `feat/centro-cumplimiento` ya usa 150–154 (cumplimiento) y esta rama usa 149–157; hay que renumerar al integrar (propuesta: mover 149–157 por encima de 154). No registré nada en `schema_migrations` (solo llega a 137; 138–148 no son todas de esta rama y 139–144 no están aplicadas): registrar sería afirmar algo falso.
8. **Pruebas adicionales** — HTTP reales contra PostgREST con JWT reales (`tests/sql/roles_http.sh`, 38 comprobaciones, PASÓ 38/38): propietario, administrador, barbero, otro negocio (IDOR), anónimo; suspender/reactivar/trasladar/cambiar rol por HTTP con invalidación de sesión comprobada; PATCH directo a `session_version` bloqueado. Correo de invitación: no distinguía rol → corregido (`texto-invitacion.ts`, 3 pruebas vitest). **Defecto hallado y corregido:** la ruta pública `/invitacion/[id]` llamaba a `responder_invitacion(aceptar=true)`, que esta base rechaza (`USA_ACEPTAR_INVITACION_STAFF`): aceptar desde el enlace estaba roto; ahora llama a `aceptar_invitacion_staff` con casilla expresa de tratamiento de datos.
9. **Cuentas de prueba** — se rotó la contraseña de las cuentas locales `ev-dueno`, `ev-supersu`, `ob-otro`, `ob-nuevo` y de las `f1-*` (más una nueva `f1-invitado-admin`); las nuevas están solo en un archivo del scratchpad; no se imprimen valores. (La cuenta `dueno-sandbox@carga.test` no estaba en el archivo y no se rotó.)
10. **Servidor 3310** — reiniciado sobre el build nuevo.

Resultados finales de ejecución: ver sección 10.

---

---

## 1. Auditoría (hallazgos)

1. **Cuatro criterios distintos de «cuántos profesionales hay»**, ninguno coherente con el otro:
   - `crear_invitacion_staff` (015+149): vínculos ACTIVO/SUSPENDIDO/INVITADO + invitaciones PENDIENTE de otros correos, **aunque estuvieran vencidas**.
   - `responder_invitacion` (015): solo ACTIVO/SUSPENDIDO; ignoraba invitaciones y la capacidad que otras invitaciones ya reservaban.
   - `solicitar_downgrade_plan` / `ejecutar_downgrades_programados` (049): solo ACTIVO.
   - `src/app/panel/suscripcion/datos.ts`: solo ACTIVO, conteo propio en la interfaz.
2. **El tope de 149 se evadía escribiendo directo a las tablas.** El propietario tiene política `FOR ALL` sobre `vinculo_staff_negocio` y `INSERT` sobre `invitacion_staff`: podía crear vínculos o invitaciones sin pasar por `crear_invitacion_staff`. Corregido con triggers de respaldo (152).
3. **Sin concurrencia controlada.** Dos invitaciones simultáneas veían el mismo cupo libre. Demostrado con 6 sesiones reales (sección 6.3).
4. **`resolverContexto()` ignoraba el vínculo del propietario** (devolvía `BARBERIA` con `staffVinculoId = null`): un propietario que atiende no tenía su agenda en el Panel. (`obtenerContextoStaff()` y `/staff` ya funcionaban por separado: el hueco era el Panel.) Corregido.
5. **Visibilidad pública sin distinguir quién atiende.** `negocio_staff_publico`, `slots_disponibles`, `staff_perfil_publico`, `marketplace_buscar` (conteo de staff) y la política `staff_select_publico` tomaban cualquier vínculo ACTIVO. Con el modelo nuevo un administrador puro aparecería como profesional. Corregido.
6. **`is_barberia_de` aparece en ~110 políticas RLS y 95 funciones.** Delegar de verdad la administración exige revisar cada una: no se hizo (ver 4.5 y decisiones pendientes).
7. **DEFECTO PREEXISTENTE, no corregido:** `suspender_staff` y `trasladar_staff` (083) llaman a `incrementar_session_version()` dentro de una función definer; el trigger `perfil_proteger_columnas_sensibles` (084) lo rechaza si `auth.uid()` no es nulo y el actor no es SuperSU → **la acción falla para el propietario** («NO_AUTORIZADO: session_version no se puede modificar directamente»). Verificado en la base local con el propietario de «Barbería Sandbox». Intenté arreglarlo con un parche mínimo (`current_user in ('authenticated','anon')`) y el clasificador de permisos lo bloqueó por tocar un trigger de seguridad; **no lo apliqué** (queda como decisión pendiente, con el parche descrito en la sección 9). Mi función `cambiar_rol_equipo` NO llama a `incrementar_session_version` por esta razón, y `tests/sql/roles_158.sql` desactiva ese trigger solo dentro de su transacción (ROLLBACK) para poder probar la autorización delegada de suspender/trasladar.
8. **Suites que el encargo daba por verdes y estaban rojas en la línea base:** `auditoria_123`, `libro_122`, `whatsapp_120` fallan por `ux_perfil_supersu_unico` (un único SuperSU; los scripts intentan crear otro). Con el SuperSU descendido dentro de la transacción pasan (6.2).
9. **Publicación del propietario que atiende:** `staff_es_publicable` exige foto + consentimiento `AUTORIZACION_STAFF_PUBLICACION` (o ventana de transición hasta 2026-12-16). Un propietario Essential que activa su perfil no aparece en la reserva pública hasta que suba foto y autorice la publicación en `/staff/perfil` (que ya existe y le funciona). Es una decisión de producto pendiente: el alta de Essential podría pedirlo.

---

## 2. Informe de normalización PREVIO a aplicar la migración de datos (155)

Generado con consulta de solo lectura sobre la base local (9 negocios, todos plan ESSENTIAL) y con una simulación de 155 dentro de `BEGIN … ROLLBACK` (resultado verificado, nada se escribió). Regla: Essential → el propietario queda habilitado como profesional (solo negocios con alta completa o `ACTIVO`); planes superiores → propietario solo administra (ninguno de los 9 es de plan superior); **nadie se borra ni se retira por exceso**.

| Negocio | Datos actuales | Problema | Cambio propuesto | Resultado esperado |
|---|---|---|---|---|
| Barbería Sandbox (ACTIVO, alta completa) | Essential; 1 vínculo ACTIVO (empleado); dueño sin fila `staff`; 1 sede | El propietario no figura como profesional | Crear `staff` + vínculo ACTIVO del propietario (`presta_servicios`) en la sede principal | 2 ocupados / límite 1 → **exceso 1**; empleado intacto; evento `CUPO_EXCEDIDO_DETECTADO` |
| QA Negocio 1794797385481 (PENDIENTE, alta incompleta) | Essential; sin vínculos ni sedes | — | Ninguno (lo recibe al completar el alta, 153) | Sin cambio |
| QA Negocio 1794797449738 (PENDIENTE, alta incompleta) | Ídem | — | Ninguno | Sin cambio |
| QA Negocio bis 1794797588597 (PENDIENTE, alta incompleta) | Ídem | — | Ninguno | Sin cambio |
| QA Negocio bis 1794797715574 (PENDIENTE, alta completa, 0 sedes) | Essential; sin vínculos; **0 sedes** | Propietario no figura como profesional | Vínculo del propietario con `sede_activa_id = NULL` (no hay sede) | 1/1, sin exceso |
| QA Negocio bis 1794797874094 (PENDIENTE, alta completa, 0 sedes) | Ídem | Ídem | Ídem | 1/1 |
| Barbería Evidencias (ACTIVO, alta incompleta) | Essential; 1 vínculo ACTIVO + 1 invitación vigente (2 invitaciones en total, una no vigente). **Ya estaba en 2/1** antes de cambiar nada | Propietario sin perfil; exceso previo | Vínculo del propietario (por estar ACTIVO) | 3 ocupados / 1 → **exceso 2**; nadie retirado; evento de exceso |
| Negocio Ajeno (PENDIENTE, alta completa, 1 sede) | Essential; sin vínculos | Propietario sin perfil | Vínculo del propietario | 1/1 |
| Del Tano (PENDIENTE, alta completa, 1 sede) | Essential; 0 vínculos + 1 invitación vigente | Propietario sin perfil | Vínculo del propietario | 2 ocupados / 1 → **exceso 1** (invitación vigente + propietario); evento de exceso |

Resumen simulado: 6 vínculos de propietario creados (`NORMALIZACION_FASE1_PERFIL_PROPIETARIO`), 3 eventos de exceso (Sandbox 1, Evidencias 2, Del Tano 1), 0 propietarios de plan superior desvinculados, 0 huérfanos, 2.ª ejecución sin cambios (idempotente). Para negocios con propietario-barbero de plan superior y con reservas futuras la migración **no** lo desvincula y avisa (`RAISE NOTICE`).

Decisiones que le dejo al usuario antes de aplicar 155: (a) ¿se incluye «Barbería Evidencias» (ACTIVO pero con alta incompleta)? hoy sí, por estar ACTIVO; (b) los 3 negocios en exceso: ¿se cancela alguna invitación pendiente o se deja el exceso? hoy no se toca nada; (c) los negocios con 0 sedes reciben un vínculo sin sede.

---

## 3. Diseño de roles y permisos

### 3.1 Modelo
Roles derivados de **capacidades** en `vinculo_staff_negocio` (no un enum rígido):

| Rol | Cómo se deriva | Ocupa cupo | Panel | `/staff` (agenda) | Público |
|---|---|---|---|---|---|
| `BUSINESS_OWNER` | `negocio.owner_user_id` (no se guarda en el vínculo) | Solo si activa su perfil profesional | Todo | Si tiene perfil profesional | Solo con perfil profesional |
| `BUSINESS_ADMIN` | `es_admin` y no `presta_servicios` | **No** | Equipo (mínimo delegado) | No | **No** |
| `ADMIN_BARBER` | `es_admin` y `presta_servicios` | Sí | Equipo (mínimo delegado) | Sí | Sí |
| `BARBER` | `presta_servicios` sin `es_admin` | Sí | No | Sí | Sí |
| `SUPER_ADMIN` | `perfil.es_supersu` (sin cambios) | — | Plataforma | — | — |

No existe «OWNER». Check `vinculo_capacidad_minima`: `es_admin OR presta_servicios`. Una misma cuenta puede administrar y atender sin duplicar correo, celular ni identidad. `es_propietario` **no** se añadió como columna: derivarlo de `negocio.owner_user_id` evita desfases (mejora justificada sobre el diseño sugerido).

**Guardian** (`es_guardian`, alcance por SEDE, ADR-006) queda intacto y ortogonal: un Guardian es un BARBER con permisos de sede; BUSINESS_ADMIN es la delegación a nivel de NEGOCIO. Un administrador que además es Guardian conserva el flag, pero el alcance negocio prima.

Configurable, no hardcodeado: `plan.propietario_profesional_por_defecto` (hoy `true` solo en ESSENTIAL) decide qué planes activan el perfil del propietario al completar el alta; los límites siguen en `plan.staff_tope_absoluto`/`staff_incluido` (149).

### 3.2 Cupo — una sola función
`_capacidad_profesional(negocio, plan_destino?, adicionales=0, excluir_email?)` devuelve: incluidos, adicionales contratados (parámetro listo para la Fase 3; hoy siempre 0, nada lo cobra), límite, activos, suspendidos, pendientes de activación (INVITADO), invitaciones pendientes **vigentes**, operativos, ocupados, disponibles y exceso.
- **Ocupa:** vínculo `presta_servicios` en ACTIVO/SUSPENDIDO/INVITADO (incluido el del propietario) + invitaciones PENDIENTE no vencidas a BARBER/ADMIN_BARBER.
- **No ocupa:** propietario/administrador sin perfil profesional, invitaciones a BUSINESS_ADMIN, retirados, y invitaciones vencidas/canceladas/rechazadas/aceptadas.
- **SUSPENDIDO sigue ocupando** (decisión mía: si liberara cupo, suspender → invitar → reactivar evadiría el tope). Confirmar.
- Lock por negocio (`pg_advisory_xact_lock`) en toda escritura que consuma cupo.
- Unificados: `crear_invitacion_staff`, `responder_invitacion`, `cupo_plan_negocio`, downgrade (`solicitar_*` y `ejecutar_*`), `datos.ts` (vía `obtenerCupoPlan`), y triggers de respaldo para escrituras directas.

### 3.3 Permisos del Panel
- `src/lib/auth/permission-registry.ts`: `PERMISOS_ADMIN_DELEGADO` (lista cerrada, denegado por defecto) y `derivarPermisosPanel("admin")`. El registro de 5 roles no cambia; Barbería/Guardian se derivan igual (probado).
- `src/lib/auth/resolver-contexto.ts`: nuevo `RolPanel = "ADMIN"`; el propietario con perfil profesional conserva `BARBERIA` **y** recibe `staffVinculoId`, `prestaServicios` y `rolEquipo`; un administrador ACTIVO recibe `ADMIN` con los permisos delegados.
- `verificarAccesoPanel` es **opt-in** para `ADMIN`: las ~27 páginas existentes piden `["BARBERIA","GUARDIAN"]`, así que un administrador recibe 403 en todas salvo `/panel/staff`, `/panel/staff/nuevo`, `/panel/staff/[id]`.
- `/staff` (App Staff): un propietario con perfil profesional y un ADMIN_BARBER acceden indistintamente a `/panel` y `/staff`; un BUSINESS_ADMIN ve «Tu rol es administrativo» con enlace al equipo (`src/app/staff/layout.tsx`).

### 3.4 Conjunto mínimo delegado (BUSINESS_ADMIN / ADMIN_BARBER)
**Puede** (en SU negocio; lo hace cumplir la base): ver equipo e invitaciones; invitar **solo BARBER**; reenviar/cancelar invitaciones a BARBER; suspender, reactivar, retirar y trasladar de sede a profesionales **que no son administradores**.
**No puede:** facturación/suscripción/plan, pagos y cobros, verificación, propiedad; cambiar roles; invitar o crear administradores; promover/revocar Guardian; activar/desactivar el perfil profesional del propietario; tocar a otro administrador, al propietario ni a sí mismo; escribir directo en `vinculo_staff_negocio`.
**No delegado en esta fase (pendiente de revisión política por política):** servicios, sedes, agenda completa, clientes, reportes, caja, inventario, marketing.

### 3.5 RLS
Nuevo `is_admin_de(negocio)` (propietario o administrador ACTIVO; `coalesce(…, false)` para NULL). `is_barberia_de` / `is_staff_de` no cambian. Políticas modificadas: `vinculo_select_interno`, `invitacion_staff_select_negocio` (lectura para administradores), `staff_select_publico` (solo `presta_servicios`). `is_admin_de` tiene grant a `anon` y `authenticated` porque aparece en políticas evaluadas con el rol del llamador (con `auth.uid()` nulo devuelve false; probado que anon no ve ni falla). Triggers: `trg_staff_servicio_solo_profesionales` y `trg_reserva_solo_profesionales` (un administrador puro no recibe servicios ni citas aunque se escriba directo).

---

## 4. Migraciones (cada una con su reversión, probada: aplicar → revertir → reaplicar)

| # | Archivo | Qué hace | Reversión |
|---|---|---|---|
| 151 | `158_modelo_roles_capacidades.sql` | columnas `es_admin`, `presta_servicios`, `rol_invitado`, `plan.propietario_profesional_por_defecto`; `is_admin_de`, `rol_equipo`; triggers de visibilidad/asignación; parches por ancla de `negocio_staff_publico`, `slots_disponibles`, `staff_perfil_publico`, `marketplace_buscar`; vista con capacidades; auditoría del vínculo ampliada | `151_…_REVERSION.sql.txt` |
| 152 | `159_funcion_central_de_cupo.sql` | `_capacidad_profesional`, `_cupo_bloquear`, `capacidad_profesional_negocio`, triggers de respaldo, `cupo_plan_negocio`, `crear_invitacion_staff` (firma nueva con rol; **DROP** de la firma vieja), `responder_invitacion`, downgrade, `cambiar_rol_equipo` | `152_…_REVERSION.sql.txt` |
| 153 | `160_perfil_profesional_del_propietario.sql` | `_activar_perfil_propietario`, `activar_/desactivar_perfil_profesional_propietario`, parche de `completar_onboarding_negocio` | `153_…_REVERSION.sql.txt` |
| 154 | `161_delegacion_administrativa_minima.sql` | `_puede_gestionar_vinculo/_invitacion`; parches de `suspender/reactivar/retirar/trasladar_staff`, `cancelar/reenviar_invitacion`; lectura del equipo para administradores | `154_…_REVERSION.sql.txt` |
| 155 | `162_normalizacion_roles_existentes.sql` | Normalización de datos. **NO APLICADA** | `155_…_REVERSION.sql.txt` (probada en transacción) |

Todas las funciones nuevas: `SECURITY DEFINER` con `search_path` fijo; `REVOKE` de `public, anon, authenticated` y `GRANT` solo a quien corresponde (internas: a nadie); parches con `pg_get_functiondef` + `replace` con ancla exacta que lanza excepción si no existe, e idempotentes; CREATE OR REPLACE con parámetros nuevos → `DROP` explícito de la firma vieja. La base local registra `schema_migrations` solo hasta 137: 151–154 se aplicaron a mano. Las migraciones 159 y 160 dependen de las anclas de 149 y 150 (sin commitear en esta rama).

Prueba de reversión: tras revertir 154→151, las **16 funciones parcheadas quedaron idénticas** al texto original (`diff` contra el volcado previo), las 3 políticas y el trigger de auditoría idénticos, y desaparecieron los objetos nuevos; reaplicadas 151→154 las pruebas vuelven a pasar. Con la reversión de 155 en transacción: 8 → 2 vínculos activos (el estado inicial).

---

## 5. Archivos modificados / creados

SQL: `supabase/migrations/151…155` (+ 5 reversiones `.sql.txt`).
Pruebas: `tests/sql/roles_158.sql`, `tests/sql/roles_151_concurrencia.sh`, `tests/sql/roles_155_normalizacion.sql` + `.sh`, `tests/roles-equipo.test.ts`.
Código nuevo: `src/lib/auth/roles-equipo.ts`, `src/components/panel/tarjeta-perfil-profesional.tsx`.
Código modificado: `src/lib/auth/permission-registry.ts`, `src/lib/auth/resolver-contexto.ts`, `src/lib/auth/verificar-acceso-panel.ts`, `src/lib/auth/require-staff.ts`, `src/lib/planes/cupo.ts`, `src/app/panel/suscripcion/datos.ts`, `src/app/panel/staff/actions.ts`, `src/app/panel/staff/lista-staff.tsx`, `src/app/panel/staff/page.tsx`, `src/app/panel/staff/nuevo/page.tsx`, `src/app/panel/staff/nuevo/formulario-invitacion.tsx`, `src/app/panel/staff/[id]/page.tsx`, `src/app/panel/staff/[id]/detalle-staff.tsx`, `src/app/panel/page.tsx`, `src/components/panel/panel-nav.tsx`, `src/app/staff/layout.tsx`, `src/types/database.ts` (editado a mano: columnas, vista y RPC nuevas; `cupo_plan_negocio` ya no se llama con un cast).

---

## 6. Resultados reales de las pruebas

### 6.1 Línea base (antes de cambiar nada) y después
Mismas suites, mismo resultado antes y después de 151–154. **Verdes:** aislamiento_multiempresa, seguridad_regresion, registro_pendiente_127, registro_telefono_128, anticipos_129, webhook_130, rendimiento_131, prueba_antiabuso_135, cobro_directo_119, limites_plan_149, onboarding_verificacion_150. **Rojas ya en la línea base** (mismo primer error antes y después, comparado): directiva_116_118, f0_05, f1b_139, f1b_141_142, f1b_promociones_140, hotfix_staff_nulo_posterior, notificaciones_124, suscripcion_133 (migraciones 139–144 sin aplicar), **más auditoria_123, libro_122 y whatsapp_120** (no previstas: `ux_perfil_supersu_unico`).
`npx tsc --noEmit`: sin errores (antes y después). `npx eslint` sobre lo tocado (lib/auth, lib/planes, panel/staff, panel/page, suscripcion/datos, components/panel, staff/layout): sin avisos. `npx vitest run`: línea base 14 archivos / 127 pruebas; ahora 15 archivos / **139 pruebas, todas pasan** (+12 de `roles-equipo.test.ts`).

### 6.2 Suites rojas por SuperSU
Copias temporales (no versionadas) con el SuperSU descendido dentro de la transacción: **auditoria_123, libro_122, whatsapp_120 PASAN con 151–154 aplicadas.** directiva_116_118, f0_05, f1b_139 y f1b_promociones_140 siguen fallando con el mismo mensaje con y sin mis migraciones (comparado revirtiendo 151–154): su causa es ajena.

### 6.3 `tests/sql/roles_158.sql` — PASÓ completa
Cubre: Essential con propietario que atiende (activar, idempotencia, reactivar reutiliza la misma fila, desactivar, bloqueo por reservas futuras, alta automática); Studio con propietario solo administrador; propietario de Prestige que atiende de forma opcional; BUSINESS_ADMIN, ADMIN_BARBER, BARBER; cupos 1/5/15/50 (+ parámetro de adicionales 5 → 55); invitaciones vigentes, vencidas, canceladas, rechazadas y aceptadas (la aceptación no cuenta doble); cambio de rol que no evade el tope (RPC y escritura directa); exceso (Essential 2/1: nadie retirado, no se puede agregar); un suspendido sigue ocupando; downgrade con el mismo criterio; el administrador puro no aparece en `negocio_staff_publico`, `slots_disponibles`, perfil público ni recibe servicios/reservas; IDOR (16 casos contra el negocio ajeno); `REVOKE` verificado con `aclexplode` para public/anon/authenticated en internas y RPC (más llamadas reales como anon con «permission denied»); la firma vieja de `crear_invitacion_staff` ya no existe.
`tests/sql/roles_155_normalizacion.sql` — PASÓ (antes/después, sin huérfanos en reservas/staff_servicio/vínculos/disponibilidad/bloqueos/niveles/puntajes, exceso 2/1 marcado, propietario con reservas futuras no se toca, idempotente).

### 6.4 Concurrencia real — PASÓ
`tests/sql/roles_151_concurrencia.sh`: Studio (límite 5, 3 invitaciones vigentes), 6 sesiones simultáneas reteniendo su transacción 2 s: **con candado: 2 creadas, 4 `PLAN_LIMIT_EXCEEDED`, 5 ocupados.** **Control negativo** (se vacía `_cupo_bloquear` solo en la prueba y se restaura): **6 creadas, 9 ocupados con límite 5** → sin el candado el tope se rompe; la prueba sí detecta el fallo. Los fixtures confirmados (prefijo `000b-`) se eliminan al final; la primera versión del script dejó una fila `wallet` huérfana (la limpiaba mal): la detecté, borré solo esa fila propia y corregí el script; hoy 9 negocios, igual que al empezar.

### 6.5 Build y navegador
Ver sección 7.

---

## 7. Verificación de build y navegador

**`npx next build --webpack`: PASÓ** (compiló sin errores; repetido tras los últimos cambios de código). `npx tsc --noEmit` y `npx eslint` (ver 6.1): limpios.

**Navegador** (servidor de producción local en el puerto 3311, Supabase local, Cloudinary simulado; el puerto 3310 ya lo ocupaba un servidor de una sesión anterior (PID 21440) que NO toqué, pero cuyo `.next` se reconstruyó debajo: conviene reiniciarlo). El login real exige Cloudflare Turnstile, que no se puede resolver con automatización; entré inyectando la sesión de GoTrue local (cookie `sb-127-auth-token`) con cuentas de prueba nuevas `f1-*@stylernow.test`. Recorrido real (capturas en el scratchpad de la sesión):
- **Propietario Studio:** el Resumen muestra la tarjeta «Activar mi perfil profesional»; al pulsarla pasa a «Atiendes clientes» y en la base `ocupados` sube de 1 a 2. La lista de equipo muestra roles (PROPIETARIO / ADMINISTRADOR / PROFESIONAL). El formulario de invitación ofrece los 3 roles con su descripción; invitar «Administrador» crea la invitación `BUSINESS_ADMIN` sin consumir cupo (ocupados sin cambio). En el detalle, «Cambiar rol» pasó a un barbero a `BUSINESS_ADMIN` (ocupados 2 → 1, evento `STAFF_ROL_CAMBIADO` auditado).
- **BUSINESS_ADMIN:** `/panel` lo lleva a `/panel/staff`; `/panel/servicios` y `/panel/suscripcion` dan «NO TIENES ACCESO A ESTA SECCIÓN»; `/staff` muestra «Tu rol es administrativo»; el formulario de invitación solo ofrece sede (no hay selector de rol: solo BARBER); en el detalle de otro administrador no aparece ningún botón de gestión.
- **Propietario Essential con perfil profesional:** el menú muestra «MI AGENDA»; `/staff` lo lleva a `/staff/agenda`; el Resumen dice «Atiendes clientes»; con el cupo lleno `/panel/staff/nuevo` muestra el aviso de plan y deja invitar solo un administrador.
- Dos defectos de interfaz encontrados en esa pasada y corregidos después (verificados solo por build/tsc, no en navegador): la tarea «Invita a tu equipo» del asistente se marcaba completa solo por el perfil del propietario, y el texto «1 cupo de los 1».
- Efecto de mis pruebas de reversión: revertir 151 elimina las columnas, así que el administrador de prueba volvió a ser BARBER y hubo que restaurarlo a mano; además la primera versión de la reversión dejó la vista `vista_staff_negocio` sin SELECT para `authenticated` (la lista de equipo salía vacía). Lo vi en el navegador, repuse el privilegio, corregí la reversión (guarda y repone el ACL exacto) y añadí una comprobación de privilegio real a `roles_158.sql`. Reversión y reaplicación se repitieron y pasan.
- **Datos de prueba que quedan en la base local** (no se borran hasta que el usuario diga «listo»): 4 cuentas `f1-dueno-studio`, `f1-dueno-essential`, `f1-admin`, `f1-barbero` (@stylernow.test), 2 negocios `f1-studio` y `f1-essential` con sus sedes/suscripciones/vínculos y 1 invitación a `f1-invitado-admin@stylernow.test`.

---

## 8. Qué NO se verificó

- Producción: nada (prohibido). Las migraciones 158–162 no se probaron contra la base de producción ni contra una copia de sus datos; el orden de despliegue respecto de 139–150 está sin decidir.
- El camino HTTP real de PostgREST/RLS: las pruebas SQL emulan al usuario con `set role` + claims; no se llamó a la API HTTP con JWT reales para cada RPC.
- Aceptar una invitación de administrador desde la pantalla pública `/invitacion/[id]` (que no muestra el rol) ni el texto del correo de invitación (no distingue rol).
- Las pantallas con planes Studio/Prestige/Signature en el navegador (ver 7 para lo que sí se recorrió).
- Que `suspender_staff`/`trasladar_staff` funcionen para el propietario en la base local: **no funcionan** por el defecto preexistente (hallazgo 7).
- El cobro de «barberos adicionales» (Fase 3): solo existe el parámetro.
- En el navegador no se probaron: «Dejar de atender» (solo SQL), aceptar una invitación de administrador desde el enlace, ni los mensajes de error de cupo en pantalla (solo el aviso de equipo completo). Tampoco se probaron las pantallas con una sesión Signature/Prestige.
- Estado de la base local al terminar: migraciones 158–161 **aplicadas a mano** (no registradas en `schema_migrations`); 155 **sin aplicar**.

## 9. Riesgos y decisiones pendientes

1. **Aplicar 155** (sección 2) — necesita OK del usuario.
2. **Defecto del trigger `session_version`** (hallazgo 7). Parche mínimo propuesto, no aplicado: en `perfil_proteger_columnas_sensibles`, condicionar la rama de `session_version` a `current_user in ('authenticated','anon')`, igual que ya hace la rama de `es_supersu`. Hasta entonces suspender/trasladar fallan en la práctica.
3. **Alcance de la delegación a BUSINESS_ADMIN:** hoy solo equipo. Ampliarlo (servicios, agenda, clientes…) exige revisar ~110 políticas y 95 funciones que usan `is_barberia_de`. Recomiendo hacerlo módulo por módulo.
4. **SUSPENDIDO ocupa cupo** (decisión mía, confirmar).
5. **Publicación del propietario que atiende** (hallazgo 9): ¿el alta de Essential debe pedir foto y consentimiento de publicación?
6. **Edición del flag `propietario_profesional_por_defecto`** desde el administrador de planes: existe la columna pero no se añadió a la pantalla de SuperSU (`/admin/planes`).
7. **Triggers de respaldo** actúan solo para sesiones con rol `authenticated`/`anon`; migraciones, `service_role` y fixtures no pasan por ellos (cada RPC valida de forma explícita). Si algún día el servidor escribe vínculos con `service_role` sin pasar por una RPC, ese camino no topa el cupo.
8. **Exceso preexistente** (p. ej. «Barbería Evidencias» ya estaba 2/1): se marca, no se corrige.
9. **Dependencias de la rama:** 149 y 150 están sin commitear; 152 y 153 las parchean por ancla.
10. **Ventana de rol:** al cambiar un rol no se invalida la sesión (no se llama `incrementar_session_version`, ver hallazgo 7); el resolver consulta la base en cada solicitud, así que el cambio rige en la siguiente petición.

---

## 10. Resultados finales (cierre)

**PASÓ (ejecutado):**
- Suites SQL en la base de pruebas: verdes aislamiento_multiempresa, seguridad_regresion, 127, 128, 129, 130, 131, 135, 119, 149, 150, **roles_151**, **roles_155_config_sesion_publicacion**. Rojas con el MISMO primer error que en la línea base (comparado una a una): auditoria_123, libro_122, whatsapp_120 (SuperSU único), directiva_116_118, f0_05, f1b_139, f1b_141_142, f1b_promociones_140, hotfix_staff_nulo_posterior, notificaciones_124, suscripcion_133. Con el SuperSU descendido en copia temporal, auditoria_123, libro_122 y whatsapp_120 PASAN con todos mis cambios.
- `roles_157_normalizacion` (alta incompleta, negocio sin sede, exceso, huérfanos, idempotencia), concurrencia real (6 sesiones: 2 creadas/4 rechazadas con candado; sin candado 6 creadas), HTTP real `roles_http.sh` 38/38.
- Base nueva desechable: 154 migraciones de la rama OK; unión con 145–148 de otras ramas OK (158); suites 149/150/151/155 pasan allí; revertir 157→151 y reaplicar OK.
- `tsc --noEmit` limpio; `vitest` 142 pasan (línea base 127); `next build --webpack` OK (compilación, tipos y páginas); eslint ver nota abajo.
- Navegador (build en el puerto 3310, sesión inyectada porque Turnstile no es automatizable): aceptar invitación de administrador desde el enlace público (casilla de tratamiento obligatoria; vínculo BUSINESS_ADMIN activo + evidencia ACEPTA; antes estaba roto); tarjeta de visibilidad: sin foto aunque haya consentimiento = no visible, con foto+consentimiento = visible, «Retirar» la oculta al instante (verificado con `staff_es_publicable`); «Dejar de atender» (ocupados 1→0) y reactivar (0→1); `/admin/planes`: guardar la configuración de Studio con motivo cambió la base y dejó evento de auditoría con motivo (luego restauré el valor inicial por SQL).
- Servidor 3310 reiniciado con el build nuevo.

**FALLÓ / se corrigió durante la pasada:** el parche de `session_version` fue bloqueado por el clasificador la primera vez (apliqué la solución con función dedicada tras la aprobación del usuario); un error mío en `_activar_perfil_propietario` (`FOUND` pisado por otro SELECT) lo atrapó la prueba de 157; la ruta pública de aceptar invitación estaba rota; la reversión de 151 dejaba la vista sin privilegios (corregida).

**NO VERIFICADO:** producción (prohibido) y su orden de despliegue; subir foto real por la interfaz (usa Storage `avatars`, no Cloudinary; probé la regla con la foto puesta por SQL); eslint sobre todo `src` en esta última pasada depende de la salida de /tmp (si no terminó, en la pasada anterior estaba limpio sobre lo tocado); el texto legal de publicación está en BORRADOR en la base local; correo real de invitación (no hay clave de Resend válida: solo se probó el texto).

**Decisiones que aún requieren autorización:** (1) renumerar 149–157 al integrar con `feat/centro-cumplimiento` (colisión 150–154) y traer 145–148 antes; (2) confirmar la excepción de dos factores en el trigger de `perfil` (desviación del «trigger intacto»); (3) que ningún consumidor exija `session_version` todavía: ¿se exige en proxy/JWT?; (4) ampliar la delegación de BUSINESS_ADMIN más allá del equipo; (5) la foto profesional usa Storage mientras el resto usa Cloudinary; (6) SUSPENDIDO ocupa cupo (aplicado según el encargo); (7) textos legales en BORRADOR.
