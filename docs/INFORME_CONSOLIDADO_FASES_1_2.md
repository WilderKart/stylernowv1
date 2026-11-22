# Informe consolidado — Fases 1, 2A y 2B (y diseño de la Fase 3)

Fecha: 2026-11-19. Rama `feat/onboarding-v2` (worktree `stylernow-onboarding`). Todo contra Supabase LOCAL (Docker); producción intacta; sin commits ni push. Fuentes: `FASE1_CIERRE.md`, `FASE1_ROLES_CUPOS_INFORME.md`, `FASE2_ADICIONALES_DISENO.md`, `FASE2A_ADICIONALES_INFORME.md`, `FASE2B_SUSCRIPCION_RESTRINGIDA_INFORME.md`, `FASE3_PERTENENCIA_LICENCIAS_DISENO.md`, más las corridas de cierre de esta sesión. Sin maquillar: lo que no se ejecutó figura como NO VERIFICADO.

## 1. Estado de cada fase

| Fase | Implementado | Probado (local) | Pendiente |
|---|---|---|---|
| **1** Roles por capacidades, cupo único, sesiones, publicación (migr. 149-157) | Roles derivados (OWNER/ADMIN/ADMIN_BARBER/BARBER), delegación mínima de BUSINESS_ADMIN, perfil profesional del propietario por plan, `_capacidad_profesional`, invitaciones con rol, `session_version`/invalidación, publicación con foto + consentimiento, normalización 157 | `roles_151`, `roles_155`, `roles_157`, concurrencia, HTTP 38/38, compat código↔base | Decisiones de la sección 5 (dos factores, proxy, foto, delegación, GRANT del cron, textos legales); producción sin tocar |
| **2A** Barberos adicionales con pago manual por Checkout Pro (170-178) | Lotes con precio/cantidad/periodo congelados, máquina de 11 estados, webhook/conciliación con validación completa, cron diario (avisos 7/3/1, gracia 3, suspensión), pantallas propietario y CRM, reembolsos como registro auditado | SQL (~300 aserciones), concurrencia, HTTP 48/48, integración con Mercado Pago SIMULADO 9/9, navegador (propietario, admin 403, CRM), vitest | Pago real en sandbox; ejecución real de reembolsos (solo registro); decisiones 1 y 2 de la sección 5 |
| **2B** Suscripción restringida (160-164) | Estado operativo central, 30 días en hora de Bogotá, guardia en 26 tablas y 36 RPC, banner y pantalla de cumplimiento, configuración SuperAdmin | `restringida_164` (12 bloques), HTTP 33/33, navegador, vitest | Cinco decisiones de la sección 5; cobertura no incluida (cuenta de cobro MP, verificación, WhatsApp, gift cards POS, mapa) |
| **3** Pertenencia, licencias, prevención de compartición | **NADA**: es solo diseño (`FASE3_...DISENO.md`). SIN migraciones ni bloqueos reales | — | No se implementa hasta cerrar 2A/2B y reconciliar el historial de migraciones |

## 2. Pruebas ejecutadas y resultados REALES

### 2.1 Suites SQL (`tests/run-sql-suites.sh`, secuencial, con foto de la configuración compartida antes/después de cada una)

Corrida final de esta sesión: **9 suites con falla, 0 con residuo, configuración compartida idéntica antes y después de TODAS** (planes, `plan_precio`, `adicional_*`, config de plataforma, etc.).

| Suite | Resultado | ¿Preexistente o nuevo? | Causa |
|---|---|---|---|
| adicionales_170, **adicionales_restringida_180 (nueva)**, restringida_164, aislamiento_multiempresa, anticipos_129, cobro_directo_119, limites_plan_156, onboarding_verificacion_157, prueba_antiabuso_135, registro_pendiente_127, registro_telefono_128, rendimiento_131, seguridad_regresion, webhook_130 | PASA | — | `rendimiento_131` volvió a pasar tras indexar las 19 FK de `adicional_*` |
| roles_151, roles_162_config_sesion_publicacion, roles_163_normalizacion, roles_151_concurrencia | PASA | nuevas de Fase 1 | — |
| f1b_compat_codigo_vs_base, f1b_compat_control_negativo, hotfix_staff_nulo_verificacion | PASA | — | — |
| **suscripcion_133** | **PASA (corregida la prueba)** | era «preexistente» | Dependía de SIGNATURE/CO con precio; en la base local está en NULL desde antes de 160-178. La prueba ahora fija sus precios dentro de la transacción (ver sección 3) |
| adicionales_170_concurrencia, adicionales_http (48), roles_http (38), restringida_http (33) | PASA | — | — |
| auditoria_123, libro_122, whatsapp_120, directiva_116_118, f0_05_crear_grupo_familiar, f1b_139_endurecimiento, f1b_promociones_140 | FALLA | Preexistente | `ux_perfil_supersu_unico`: la prueba crea un 2.º SuperSU y ya existe `ev-supersu`. Pasan (auditoria_123, libro_122, directiva_116_118 comprobadas) con el SuperSU descendido en una transacción |
| f1b_141_142 | FALLA | Preexistente | «7 casos no coinciden»: migraciones 139-144 sin aplicar en la base local |
| notificaciones_124 | FALLA | Preexistente | Cliente nuevo debía encolarse (EMAIL+PANEL); el contador creció por plantillas de otros agentes |

### 2.2 Otras pruebas de esta sesión

| Prueba | Resultado | Notas |
|---|---|---|
| `adicionales_restringida_180.sql` (NUEVA) | PASA | Demuestra: plan principal restringido + adicional pagado y activo → sigue no operativa (`negocio_operativo`, `_estado_operativo_en`, sin reservas, invitar/modificar negocio bloqueados); el cron de adicionales y suspender/reactivar el adicional no tocan la principal; al pagar el plan se restaura (operativa, reservas, ya invita usando el cupo adicional); además 51.900 en los 4 planes, máximo 50 configurable, gracia 3, avisos 7/3/1, admin delegado sin acceso, periodo/precio/cantidad congelados por compra |
| `adicionales_169.sql`, `adicionales_169_concurrencia.sh`, `adicionales_http.sh` (48) | PASAN | Ver FASE2A |
| `tests/integracion/adicionales-pagos.test.ts` (`ADICIONALES_INT=1`) | PASA 9/9 | Mercado Pago SIMULADO (no sandbox real) |
| vitest (`npx vitest run`) | ver 2.3 | |
| `npx tsc --noEmit` | PASA (exit 0), también tras regenerar `database.ts` | |
| `npx eslint src tests/adicionales.test.ts tests/integracion/adicionales-pagos.test.ts` | PASA (exit 0, sin salida) | cierra el «no verificado» de eslint |
| `npx next build --webpack` | ver 2.3 | |
| Navegador (2A) | PASA propietario/admin/CRM; las rutas `/admin/*` del servidor local dieron 500 sin traza en 2B (reportado por el coordinador): las acciones del CRM quedan cubiertas por RPC, tsc y build, NO por navegador | |

### 2.3 vitest y build
`npx vitest run`: **PASA** 168 tests (18 archivos), 26 omitidos por diseño (integración con Docker y las dos suites de autorización de Server Actions que exigen la pila en el puerto 55321: NO ejecutadas aquí). Con `ADICIONALES_INT=1` los 9 de integración de 2A pasan. `npx next build --webpack`: **PASA** (exit 0) con `database.ts` actualizado; un primer intento con la regeneración completa FALLÓ por tipos de RPC ausentes en la base local y se corrigió fusionando (sección 8).

## 3. Fallos nuevos y preexistentes

**Nuevos de esta fase y ya corregidos**: 19 FK sin índice en `adicional_*` (`rendimiento_131`; índices en 170/171); zod `.uuid()` estricto rechazaba ids no estándar («Negocio inválido»); revisión con lote inexistente violaba una FK; fixture de `suscripcion_133` (ver abajo).

**`suscripcion_133` — `PLAN_SIN_PRECIO`: investigado.** La prueba pide `solicitar_pago_plan(..., 'SIGNATURE')` y espera `PLAN_REQUIERE_COTIZACION`. `_precio_plan_ciclo` lanza primero `PLAN_SIN_PRECIO` si `precio_mensual` es NULL. La migración 109 deja SIGNATURE/CO en 599000 con `es_desde = true`; en la base local esa fila tiene `precio_mensual = NULL` (la auditoría muestra un `PLAN_PRECIO_ACTUALIZADO` de 599000 → NULL el 2026-11-17, ANTERIOR a 160-164 y a 170-178). Verificado: con 599000 la suite PASA. Es **deriva de datos locales preexistente** (el fixture dependía de un valor de catálogo, no de un residuo de 2A/2B). **Corregida la PRUEBA sin debilitarla**: ahora fija, dentro de su transacción con rollback, SIGNATURE/CO = 599000 `es_desde` y STUDIO/CO = 139900; las aserciones no cambiaron. La base local NO se modificó (SIGNATURE/CO sigue NULL). Observación de producto: con precio NULL el mensaje es «sin precio» en lugar de «requiere cotización»; no se tocó la función.
Además la fila STUDIO/CO 139900 está presente (el agente 2B la borró por error y la repuso); `adicionales_170` y `adicionales_restringida_180` fijan sus precios dentro de la transacción y no dependen de residuos.

**Preexistentes declarados** (misma causa antes de 149-178; ver FASE1_CIERRE B.1): `auditoria_123`, `libro_122`, `whatsapp_120`, `directiva_116_118`, `f0_05_crear_grupo_familiar`, `f1b_139_endurecimiento`, `f1b_promociones_140` (todas por `ux_perfil_supersu_unico`: la prueba crea un 2.º SuperSU; pasan con el SuperSU descendido en copia temporal); `f1b_141_142` (migraciones 139-144 sin aplicar en la base local); `notificaciones_124` (el contador creció con plantillas de otros agentes: 6→8, la causa original es la misma); `hotfix_staff_nulo_posterior`. Con mis migraciones revertidas `roles_157`, `suscripcion_133` y `f1b_141_142` fallaban igual (comprobado en 2A).

**Brecha de GRANT del cron (hallazgo de Fase 1, NO corregido, solo documentado).** `ejecutar_downgrades_programados`, `expirar_reservas_vencidas`, `generar_roi_snapshot_mensual` y `otorgar_creditos_plan_mensual` tienen ACL `{postgres=X/postgres}` en la base local, pero el cron diario las llama con `service_role`. Revisión de las migraciones (049:401, 008:728, 042:32, 079:144, 067:102): cada una solo hace `revoke ... from public, anon, authenticated`; **ninguna migración hace GRANT a `service_role`** (ni `alter default privileges` para ello). Por tanto: en local la brecha es real y se explica porque `supabase/config.toml` no activa `auto_expose_new_tables` (el CLI local no otorga privilegios por defecto); **el repositorio tampoco las concede**, así que en producción el permiso depende de los privilegios por defecto del proyecto cloud, que NO está verificado (ver paso de verificación P7). Si producción no los tuviera, el cron fallaría silenciosamente en esas cuatro tareas (cada una va en su try/catch). Mis RPC `*_srv` de 2A sí hacen GRANT explícito a `service_role`.

## 4. Decisiones ya aprobadas (no se vuelven a preguntar)
Adicionales en TODOS los planes; 51.900 COP por adicional y mismo precio inicial en los 4 planes, configurable por plan desde SuperAdmin; máximo 50 por negocio (configurable); precio, cantidad y periodo congelados por compra; solo BUSINESS_OWNER contrata y paga; Checkout Pro manual, SIN Preapproval ni cobros automáticos; periodo 30 días desde el pago confirmado (America/Bogota); avisos 7/3/1; gracia 3 días; suspensión al terminar la gracia sin eliminar profesionales, citas, historial ni datos; sin expiración a los 60 días; reembolsos solo por revisión individual (sin automáticos); un adicional pagado NO reactiva ni desbloquea una suscripción principal bloqueada; exceso de capacidad: no se retira a nadie, solo se bloquean altas; SuperAdmin único con excepciones con motivo y auditoría; cobro directo al negocio, comisión 0 %; prueba sin tarjeta; la Fase 3 solo como diseño.

## 5. Matriz de decisiones que REALMENTE faltan

| # | Pregunta exacta | Por qué es necesaria | Alternativa recomendada | Consecuencia de cada alternativa | ¿Bloquea? |
|---|---|---|---|---|---|
| 1 | Un pago aprobado cuya referencia tiene forma de UUID pero no corresponde a ningún `pago` (huérfano): ¿pasa SIEMPRE a revisión en vez de reembolsarse solo? | Hoy los huérfanos UUID se reembolsan solos (regla histórica 05-API/06_Webhooks); los no-UUID ya van a revisión | Todo a revisión | (a) Todo a revisión: nunca se devuelve dinero por error, pero un cobro huérfano real queda sin devolver hasta que alguien lo revise; (b) mantener el reembolso automático: el cliente recupera su dinero sin intervención, con riesgo de devolver un cobro legítimo mal correlacionado | No |
| 2 | La renovación de un lote de adicionales, ¿se cobra al precio congelado del lote o al precio vigente del plan? | Hoy renueva al congelado; define si un cambio de precio llega alguna vez a lotes antiguos | Congelado mientras el lote no se cancele (coherente con «precio congelado por compra») | (a) Congelado: previsible, pero el precio nuevo solo aplica a lotes nuevos y puede haber precios distintos para el mismo plan; (b) vigente: un solo precio, pero cambia lo que el cliente aceptó y exige aviso previo | No (hay valor por defecto) |
| 3 | Gracia de la suscripción principal: ¿«opera con aviso» (implementado) o un tercer nivel «opera solo cumplimiento, sin ventas nuevas»? | 2B interpretó la gracia como operar con aviso y dejó un interruptor | Dejar «opera con aviso» con el interruptor | (a) Con aviso: sin fricción, pero no hay presión comercial en el día 31; (b) tercer nivel: requiere nuevo estado, guardias y pruebas | No |
| 4 | ¿La renovación anticipada sigue limitada a los 7 días previos al vencimiento (`AUN_NO_TOCA_RENOVAR`) o se amplía? | Con renovación manual de 30 días, no se puede pagar el día 10 | Ampliar a toda la ventana (o permitir siempre sumando días sin perder los pagados) | (a) Mantener 7 días: simple, pero el cliente que quiere pagar antes no puede; (b) ampliar: más flexible, exige regla de «no perder días» (ya existe en 133) | No |
| 5 | ¿Se envía aviso de fin del periodo pagado de la suscripción principal a 7/3/1 días (por el outbox)? | Hay avisos de fin de prueba y de adicionales, pero NINGUNO del fin del plan principal; con pago manual el propietario puede enterarse tarde | Sí, 7/3/1 igual que adicionales | (a) Sí: menos bloqueos sorpresa, una migración pequeña; (b) no: más restricciones por olvido y más soporte | No |
| 6 | Alcance del bloqueo: ¿se cubren también la conexión de la cuenta de cobro de Mercado Pago, la verificación del negocio, las campañas de WhatsApp, las gift cards del POS y el mapa/búsqueda (¿listar o no negocios restringidos?) | 2B dejó estas superficies fuera por decisión; un negocio restringido las sigue usando y aparece en búsquedas | Bloquear WhatsApp y gift cards; permitir conexión de cobro y verificación; ocultar del mapa los REQUIERE_PLAN/prueba vencida | (a) Bloquear todo: máxima coherencia, pero puede impedir regularizar (conectar cobro, verificar); (b) bloquear solo lo comercial: regulariza fácil, deja ventas por esos canales; (c) mapa: ocultar evita reservas fallidas, listar mantiene visibilidad | No (parcial) |
| 7 | Ciclo ANUAL: ¿365 días y sin gracia propia? | El encargo solo definió 30 días; 2B asumió 365 | 365 días con la misma gracia | (a) 365: simple; (b) otra duración/gracia: nueva configuración y pruebas | No |
| 8 | ¿Se aprueba la excepción de dos factores del trigger de `perfil` (marca `session_version` desde funciones definer)? | Sin ella, invalidar sesión no puede ejecutarse desde las RPC de equipo | Aprobar, acotada y auditada | (a) Aprobar: invalidación inmediata al suspender/cambiar rol; (b) rechazar: hay que rediseñar con otra vía (p. ej. RPC `service_role`) | **Sí** (Fase 1 en producción) |
| 9 | ¿Se exige `session_version` en el proxy/JWT para que invalidar sesión corte las sesiones ya abiertas? | Hoy el rol se resuelve en cada solicitud, pero el token vivo sigue siendo válido para el resto | Exigirlo en el proxy | (a) Exigir: corte real, un chequeo más por solicitud; (b) no: sesiones abiertas sobreviven hasta expirar | No |
| 10 | La foto del propietario/profesional: ¿Cloudinary (resto del onboarding) o Supabase Storage (`avatars`, hoy)? | Dos pilas de archivos con reglas distintas | Unificar en Cloudinary | (a) Cloudinary: una sola política y evidencia; migración de lo ya subido; (b) Storage: sin cambio, dos sistemas | No |
| 11 | ¿Se amplía la delegación de BUSINESS_ADMIN más allá del equipo? (~110 políticas y 95 funciones usan `is_barberia_de`) | Hoy el administrador solo opera equipo/invitaciones | No ampliar hasta tener casos de uso concretos | (a) No ampliar: seguro; el administrador no puede ver pagos ni reservas; (b) ampliar: más útil pero cada política debe revisarse | No |
| 12 | ¿Se aprueba conceder EXECUTE a `service_role` en `ejecutar_downgrades_programados`, `expirar_reservas_vencidas`, `generar_roi_snapshot_mensual` y `otorgar_creditos_plan_mensual`? | El cron las llama con `service_role` y ninguna migración se lo concede (sección 3) | Conceder, en una migración pequeña con reversión, y verificar antes en producción (P7) | (a) Conceder: el cron funciona en local y se asegura en producción; (b) no: depende de los defaults del proyecto cloud, sin garantía | No, pero conviene antes de desplegar |
| 13 | Textos legales de autorización de publicación/tratamiento de datos (hoy BORRADOR) y condiciones comerciales de adicionales (borrador en FASE2A §12): ¿quién y cuándo los aprueba? | La publicación de profesionales exige consentimiento con texto vigente; sin texto aprobado no se debe publicar | Revisión legal antes de producción | (a) Aprobar: se activa la publicación y se pueden mostrar condiciones; (b) no: el flujo funciona pero con texto provisional | **Sí** (para producción) |
| 14 | Cupos fungibles (lote anónimo) vs licencia nominal por profesional: ¿hace falta nominal ya? | Solo importa si la Fase 3 (licencias por persona) se aprueba | Mantener fungibles hasta decidir la Fase 3 | (a) Fungibles: simple, la Fase 3 tendría que migrar; (b) nominal ahora: rediseña 2A antes de cerrarla | No |

## 6. Dependencias entre fases
- **1 → todo**: 149-157 definen `_capacidad_profesional` (152), `is_admin_de`/roles (151) y la invitación con cupo. La publicación y aceptar invitaciones dependen además de `autorizar_staff`, `aceptar_invitacion_staff`, `evidencia_legal`, `_registrar_evidencia`, que NO están en esta rama (viven en 145/146/148 de `feat/centro-cumplimiento` y 147 del worktree de evidencias). **Esta rama sola no es autosuficiente.**
- **2A → 1**: 173 parchea `_capacidad_profesional` (152) y usa `_cupo_bloquear`; 175 parchea `aplicar_evento_pago`, `solicitar_pago_plan` (133) y `solicitar_upgrade_plan` (049).
- **2B → 1**: 163 requiere la firma de `crear_invitacion_staff` de 151/152 (va después de 151) y las guardias de 162/163 afectan RPC de 2A solo por la tabla `negocio`/`vinculo_staff_negocio`; 2B no depende de 170-178 ni al revés (se probó que un adicional pagado no desbloquea la principal: `adicionales_restringida_180`).
- **2A ↔ 2B**: comparten la base y `plan_precio`; la prueba cruzada anterior es obligatoria al integrar.
- **3 → 1, 2A, 2B**: reutiliza `session_version` (155), invitaciones (152), `_capacidad_profesional` y el estado operativo; propone migraciones desde la 180. No se implementa hasta cerrar 2A/2B y reconciliar el historial.

## 7. Integración: orden recomendado

### 7.1 Condición previa (NO existe)
**No hay respaldo verificable de producción.** Hasta que exista uno restaurable y probado (con prueba de restauración), no se aplica ninguna migración remota. Tampoco hay aprobación para tocar producción; el `schema_migrations` local llega a 137 y NO se registró nada (sería afirmar algo falso).

### 7.2 Tabla de TODAS las migraciones locales relevantes

| Núm. actual | Archivo / origen | Depende de | Reversión | Colisión / nota |
|---|---|---|---|---|
| 138-144 | `138_crear_grupo_familiar…` a `144_cerrar_crear_reserva_directo` (varias ramas) | — | no auditada aquí | 139-144 SIN aplicar en la base local (`f1b_141_142` roja por eso) |
| 145, 146, 148 | `feat/centro-cumplimiento` y `feat/evidencias-legales` (aceptación legal solo servidor, repositorio de evidencias, centro de evidencias SuperSU) | 144 | no auditada aquí | **145 y 146 también existen en el worktree de cierre con OTRO contenido** (`146_quitar_maintain_a_roles_publicos`, `147_session_version_desde_funciones_definer`): colisión de numeración |
| 147 | `stylernow-evidencias` (staff invitación y autorizaciones), SIN commitear | 145, 146 | no auditada | Aporta `autorizar_staff`/`aceptar_invitacion_staff` que Fase 1 necesita |
| 149 | `156_limites_de_plan_servidor` (esta rama) | 049, 144 | sí (`.sql.txt` según FASE1) | **Colisión**: `stylernow-legal` usa `156_textos_legales_tawilstack` |
| 150 | `157_onboarding_v2_y_verificacion` (esta rama) | 149 | sí | **Colisión** con `157_cumplimiento_catalogos_y_calendario` (cumplimiento) |
| 151 | `158_modelo_roles_capacidades` | 149 | sí | **Colisión** con `158_cumplimiento_casos` |
| 152 | `159_funcion_central_de_cupo` | 151 | sí | **Colisión** con `159_cumplimiento_notificaciones_y_sla` |
| 153 | `160_perfil_profesional_del_propietario` | 151, 152 | sí | **Colisión** con `160_cumplimiento_evidencias` |
| 154 | `161_delegacion_administrativa_minima` | 151 | sí | **Colisión** con `161_cumplimiento_adjuntos_y_consultas` |
| 155 | `162_invalidar_sesion_controlada` | 151; **146 de cierre** (`session_version` desde funciones definer) | sí | Pendiente de decisión 8 |
| 157 | `163_normalizacion_roles_existentes` (datos) | 151-155 | sí | Solo aplicada en LOCAL; no hay 156 a propósito |
| 160 | `164_estado_operativo_suscripcion` | 133, 118, 090 | sí | — |
| 161 | `165_suscripcion_ciclo_30_dias_bogota` | 160, 133 | sí | — |
| 162 | `166_guardia_operativa_tablas` | 160 | sí | — |
| 163 | `167_guardia_operativa_rpc` | 160, 162, **151**, 129/144, 149 | sí | Va después de 151 |
| 164 | `168_config_suscripcion_superadmin` | 160 | sí | — |
| 170 | `169_adicionales_config_precios_fechas` | `pais`, `plan`, 123 | sí | — |
| 171 | `170_adicionales_modelo_lotes` | 170 | sí | — |
| 172 | `171_adicionales_notificaciones` | 171, 124 | sí | — |
| 173 | `172_adicionales_motor_estados_y_capacidad` | 171, 172, **152** | sí | — |
| 174 | `173_adicionales_rpc_propietario` | 170-173 | sí | — |
| 175 | `174_adicionales_integracion_pagos` | 171-174, 133, 049 | sí (restaura byte a byte) | — |
| 176 | `175_adicionales_mantenimiento_diario` | 170-173 | sí | — |
| 177 | `176_adicionales_rpc_superadmin` | 170-173 | sí | — |
| 178 | `177_adicionales_reembolsos_y_revision_admin` | 171, 173, 177 | sí | — |
| 20261111000000 | `…marketplace_buscar_texto_ciudad_categoria` | — | n/d | Prefijo por fecha, ya existía |

### 7.3 Orden recomendado
1. Cerrar las decisiones que bloquean (8, 13) y, si se quiere, 12.
2. Obtener y PROBAR un respaldo restaurable de producción.
3. Reconciliar numeración: traer primero 145-148 (cierre/cumplimiento/evidencias, resolviendo que 145/146 chocan en contenido), luego **renumerar nuestras 149-157 por encima de la mayor numeración de las otras ramas** (propuesta: bloque 200+) manteniendo el orden relativo; después 160-164 (2B, tras 151) y 170-178 (2A, tras 152 y 133), y por último la Fase 3 si se aprueba (desde 180).
4. En una base DESECHABLE (`create database` desde la base local con todas las migraciones renumeradas): aplicar de cero, correr TODAS las suites (`tests/run-sql-suites.sh`), revertir en orden inverso y reaplicar.
5. Desplegar primero la BASE (migraciones), luego el CÓDIGO (el código nuevo llama RPC nuevas; el código viejo no rompe con la base nueva salvo los cambios de plan/pago ya probados).
6. Aplicar 157 (datos) solo después de revisar el informe de normalización previo; Fase 1 antes que 2B antes que 2A es compatible, pero 2A y 2B deben aprobarse juntas por compartir `plan_precio` y el cron.
7. Verificación posterior igual que en 7.4, esta vez comparando contra lo previo.

### 7.4 Verificaciones de SOLO LECTURA contra producción a ejecutar ANTES (lista; NO ejecutada)
- P1. `select max(version) from supabase_migrations.schema_migrations` y la lista de versiones: ¿qué hay realmente aplicado (139-144? 145-148?).
- P2. Existencia de `autorizar_staff`, `aceptar_invitacion_staff`, `evidencia_legal`, `_registrar_evidencia`, `is_admin_de`, `_capacidad_profesional`.
- P3. Conteo de negocios ACTIVO sin fila de `suscripcion` (operarían por compatibilidad con 160) y de suscripciones EN_MORA vigentes.
- P4. `plan`, `plan_precio` (¿SIGNATURE/CO con precio?), `addon_precio`, `negocio_addon`, `configuracion_plataforma`, `pais`: valores reales frente a los supuestos de las pruebas.
- P5. Datos que 157 normalizaría: vínculos y roles actuales, negocios por encima de su tope (exceso), invitaciones PENDIENTE.
- P6. Número de SuperSU (`ux_perfil_supersu_unico`) y existencia del índice/restricción.
- P7. ACL de las cuatro funciones del cron (`proacl`) y privilegios por defecto del esquema `public` para `service_role`; programación real de `vercel.json`/cron y nombres de variables (`CRON_SECRET`, `MERCADOPAGO_*`) sin leer valores.
- P8. Pagos `SUSCRIPCION`: valores de `metadata->>'concepto'` presentes (¿alguno distinto de PLAN/UPGRADE/NULL?) y pagos PENDIENTE abiertos.
- P9. Triggers existentes sobre `perfil`, `pago`, `negocio` y `vinculo_staff_negocio` (conflicto con 151/155/162).
- P10. Estado del respaldo (último, restaurable, retención) y de PITR, solo consultando la consola/metadata.
- P11. Tamaño y filas de las tablas tocadas y `pg_stat_activity` para elegir la ventana de despliegue.

## 8. Cambios de cierre de esta sesión
Corregida la prueba `suscripcion_133.sql` (fija sus precios dentro de la transacción); nueva `adicionales_restringida_180.sql` (la regla «un adicional pagado no desbloquea la principal» y las reglas aprobadas) y una prueba vitest de que 170-178 no contienen Preapproval/tokens de tarjeta; `src/types/database.ts` actualizado con `supabase gen types typescript --local` pero FUSIONADO, no reemplazado (56 funciones y 14 tablas de 149-178 añadidas, 7 funciones cambiadas, enums nuevos; los duplicados ya presentes se conservaron): un reemplazo total rompía `next build` porque el código usa ~decenas de RPC que la base local no tiene (p. ej. `ai_acciones_costo_admin`, `admin_dashboard_resumen`), que es otra señal de que la base local está desfasada de producción (copia anterior en el scratchpad); eslint completo de `src` sin salida pendiente. NO se modificó ninguna función de base de datos ni se corrigió la brecha de GRANT.
