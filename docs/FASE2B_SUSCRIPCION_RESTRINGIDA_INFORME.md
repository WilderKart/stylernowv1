# FASE 2B — Suscripción principal y estado centralizado «suscripción restringida»

Fecha: 2026-11-18. Rama `feat/onboarding-v2` (worktree `stylernow-onboarding`). Todo se probó SOLO contra Supabase local (Docker, `supabase_db_stylernow`). No se tocó producción, no hay commits ni push. Migraciones **160 a 164**, sin commitear.

> Estado honesto: lo marcado «PASÓ» se ejecutó y se vio pasar; lo marcado «NO VERIFICADO» no se ejecutó. Las contradicciones con decisiones anteriores están marcadas con **CONTRADICCIÓN**.

---

## 1. Qué se construyó (resumen)

1. **Una sola función SQL** decide si un negocio puede operar: `negocio_estado_operativo(negocio)` (y `negocio_operativo`, `negocio_acepta_reservas`, la interna `_estado_operativo_en(negocio, instante)`). El estado se **deriva de las fechas** (hora de Colombia), no de que el cron diario ya haya movido el estado: a las 00:00 de Bogotá del día de bloqueo el negocio queda restringido aunque el cron corra horas después.
2. **Una sola función central de fechas** (`suscripcion_dia`, `suscripcion_inicio_dia`, `suscripcion_fecha_limite`, `suscripcion_numero_dia`, zona `America/Bogota`). Ningún frontend ni Server Action calcula fechas de suscripción; el espejo TypeScript (`src/lib/suscripcion/estado-operativo*.ts`) solo llama a la RPC y da forma a la respuesta (hay una prueba vitest que impide aritmética de fechas ahí).
3. **El bloqueo se impone en la base**, en tres capas reutilizables: (a) guardia `_exigir_operativo*` llamada al inicio de 36 RPC por parche de ancla (163); (b) disparadores genéricos en 26 tablas (162) que cubren escrituras directas con el JWT del usuario Y las RPC definer que escriban ahí; (c) la guardia de `reserva` (087) reapuntada a la función central (160), que además frena al `service_role`.
4. **Pantallas**: aviso (banner) en todo el panel y en `/staff`; `/panel` abre en la nueva **pantalla de cumplimiento de citas pendientes** (`/panel/cumplimiento`) cuando está restringido; página pública del negocio y flujo de reserva muestran «Este establecimiento no está aceptando nuevas reservas temporalmente»; `/admin/negocios` muestra el estado operativo de cada negocio; `/admin/reglas` edita el ciclo.

## 2. Modelo

### 2.1 Reglas (decisiones del propietario, 2026-11-18)

| Caso | Regla implementada |
|---|---|
| Prueba | Día 1 = día de inicio (hora Colombia). Días 1..14 operativos. Día 15 sin pago confirmado → restringido. `prueba_dias` (14) editable; `prueba_gracia_dias` = 0 (nuevo, editable). |
| Pago confirmado | Periodo de `suscripcion_periodo_dias` = 30 días (nuevo, editable). Día 1 = día del pago; día 30 último pagado; **día 31 = gracia** (`suscripcion_gracia_dias` = 1); **día 32 restringido** si no hay nuevo pago. ANUAL = 365 días (ver pendiente). |
| Gracia | Por defecto **opera con aviso de renovación** (`gracia_permite_operar` = true, nuevo). Si SuperAdmin lo apaga, la gracia ya restringe y solo permite pagar. Interpretación mía de «tolerancia para renovar, no un día completo de servicio comercial»: ver decisión pendiente 2. |
| Activación manual de SuperAdmin (090) | Opera mientras `manual_hasta` (o sin fecha); no depende de `fecha_proximo_cobro`/`prueba_fin`. La vigencia manual y el fin de prueba usan ahora la función central de fechas. |
| Renovación manual | Pago aprobado → `trg_pago_plan_activar` (133) pone ACTIVA y `fecha_proximo_cobro = suscripcion_fecha_limite(desde, 30)`. «No se pierden días»: si aún queda periodo pagado o de prueba, el nuevo empieza al terminar; en gracia o restringido empieza el día del pago. |

### 2.2 Mapeo de estados existentes → estado operativo (no se eliminó ningún estado)

| `suscripcion.estado` | Estado operativo | Opera |
|---|---|---|
| TRIAL, `now < prueba_fin` | PRUEBA | sí |
| TRIAL, vencida | RESTRINGIDO (PRUEBA_VENCIDA); GRACIA solo si `prueba_gracia_dias` > 0 | no |
| ACTIVA, `now < fecha_proximo_cobro` | PAGADO | sí |
| ACTIVA vencida, dentro de gracia | GRACIA (PERIODO_VENCIDO) | según `gracia_permite_operar` (sí) |
| ACTIVA vencida, fuera de gracia | RESTRINGIDO (PERIODO_VENCIDO) | no |
| EN_MORA | GRACIA si `now < gracia_fin`; si no, RESTRINGIDO | según config / no |
| REQUIERE_PLAN, SUSPENDIDA, CANCELADA | RESTRINGIDO (con su motivo). Solo REQUIERE_PLAN, EN_MORA y SUSPENDIDA por IMPAGO pueden pagar (`puede_pagar`); la suspensión por infracción no | no |
| activacion_manual (TRIAL/ACTIVA) | PRUEBA/PAGADO hasta `manual_hasta`; vencida → RESTRINGIDO (ACTIVACION_MANUAL_VENCIDA) | sí / no |
| Negocio en alta (`PENDIENTE_APROBACION`) | EN_CONFIGURACION | **sí**: el alta guiada no se rompe |
| Negocio `SUSPENDIDO/RECHAZADO/CANCELADO` | RESTRINGIDO (NEGOCIO_NO_ACTIVO) | no |
| Negocio ACTIVO **sin fila** de suscripción | SIN_SUSCRIPCION | **sí** (compatibilidad; ver riesgo 1) |

`mantenimiento_suscripciones` (cron diario, sin cambiar frecuencia) solo **sincroniza el estado visible**: prueba vencida → `REQUIERE_PLAN` (sin gracia de prueba); periodo vencido → `EN_MORA` con `gracia_fin = fecha_proximo_cobro + gracia` (determinista); gracia vencida → `SUSPENDIDA (IMPAGO)`. Lo operativo no depende de él.

### 2.3 Diferencias con lo anterior (documentadas)

- **CONTRADICCIÓN con 133 (decisión del 2026-11-14):** 133 pasaba la prueba vencida a `EN_MORA` con gracia y «sigue recibiendo reservas». Con la regla nueva (día 15 sin pago = bloqueo) eso cambió: ya no hay gracia de prueba. Se actualizó `tests/sql/suscripcion_133.sql` bloque 1 (y la comparación de renovación a `suscripcion_fecha_limite(fin, 30)` en el bloque 4) y `tests/sql/directiva_116_118.sql` (el fin de prueba es la medianoche de Bogotá del día 15, no `now()+14 días` exactos). Son consecuencia directa de la regla aprobada.
- **Gracia de la suscripción principal: de 3 a 1 día** (valor en `configuracion_plataforma.suscripcion_gracia_dias`, defecto 3 → 1; **se actualiza la fila existente** de 3 a 1 solo si valía 3). Antes la compartían la prueba y el periodo pagado; ahora la de la prueba es `prueba_gracia_dias` (0). Sigue editable en `/admin/reglas` («Gracia por impago» = periodo pagado).
- Periodo: de «1 mes calendario» (133) a **30 días de calendario de Bogotá**. ANUAL pasa de «12 meses» a 365 días.
- `trg_reserva_exige_plan` (087) lanzaba `NEGOCIO_REQUIERE_PLAN`; ahora lanza `SUSCRIPCION_RESTRINGIDA` (la interfaz reconoce ambos).
- `negocio_puede_recibir_reservas` (086/087, también usada por WhatsApp 120) ahora delega en la función central.

## 3. Migraciones, dependencias y reversión

Todas con `*_REVERSION.sql.txt`. **Probado: aplicar → revertir → reaplicar** (cadena completa 164→160 y 160→164, repetida varias veces; las funciones parcheadas por ancla quedan **idénticas byte a byte** tras revertir: `mantenimiento_suscripciones` y las 36 RPC; reaplicar da el mismo md5 que aplicar). Archivos en LF (los `.sql` del repo están en CRLF; los parchadores normalizan `chr(13)` por si una función quedó con CR).

| # | Archivo | Contenido | Depende de (numeración actual) | Tras renumerar |
|---|---|---|---|---|
| 160 | `160_estado_operativo_suscripcion` | Config (`suscripcion_periodo_dias`, `prueba_gracia_dias`, `gracia_permite_operar`), fechas centrales, `_estado_operativo_en`, `negocio_estado_operativo/operativo/acepta_reservas`, guardias `_exigir_operativo*`, rewire de `negocio_puede_recibir_reservas` y `trg_reserva_exige_plan`, gracia 3→1 | 087 (disparador de reserva), 086/118 (config, columnas), 090, 133 (`pago.metadata.concepto='PLAN'`) | Va después de 133 y 118 |
| 161 | `161_suscripcion_ciclo_30_dias_bogota` | Parches por ancla: `trg_pago_plan_activar` (30 días), `mantenimiento_suscripciones` (prueba sin gracia, gracia determinista), `iniciar_prueba_negocio_srv/srv2`, `admin_activar_negocio_manual` | 160, 133, 118, 090 | Idem |
| 162 | `162_guardia_operativa_tablas` | Disparadores en 26 tablas + `negocio` + `vinculo_staff_negocio` + `reserva` (mover cita) | 160 | Idem |
| 163 | `163_guardia_operativa_rpc` | Línea de guardia en 36 RPC + `slots_disponibles` (vacío si no acepta reservas) | 160, 162; **151** (firma de `crear_invitacion_staff` con `p_rol`), 129/144 (`crear_reserva`), 149 (invitación con cupo) | **Después de 151** |
| 164 | `164_config_suscripcion_superadmin` | `config_suscripcion()`, `admin_set_config_suscripcion(...)`, `admin_estado_operativo_negocios(ids)` | 160 | Idem |

Orden de reversión: 164, 163, 162, 161, 160. 160–164 no tocan nada de las migraciones 170–179 (otro agente); ambos comparten la base local (ver «Hallazgos»).

## 4. Función central de fechas

`suscripcion_fecha_limite(inicio, dias)` = 00:00 de Bogotá del día (`día(inicio) + dias`). Pago el día 1 con 30 días → límite = 00:00 del día 31. Probado en los bordes de medianoche UTC-5: 04:59:59Z del día N sigue siendo el día N−1 local; 05:00:00Z ya es el día N; un pago a las 21:00 de Bogotá (02:00Z del día siguiente) cuenta como del mismo día. Bogotá no tiene horario de verano. Los consumidores (disparador de pago, iniciar prueba, activación manual) la llaman; no hay `now() + interval` de suscripción fuera de ella.

## 5. Inventario y decisión por operación

514 funciones en `public` ejecutables por `anon`/`authenticated`, ~200 de escritura (volátiles). Superficie TypeScript: Server Actions de `src/app/panel/*`, `src/app/negocio/*`, `src/app/reserva/*`, `src/app/staff/*`, `src/app/admin/*` y 11 rutas `/api/*`. **Decisión + dónde se impone:**

**Reservas**

| Operación | Decisión | Dónde |
|---|---|---|
| `crear_reserva` (interna, cerrada a `authenticated` desde 144) | BLOQUEAR | 163 + disparador de `reserva` |
| `crear_reserva_autorizada` (cliente / marketplace) | BLOQUEAR | vía `crear_reserva` + disparador |
| `crear_reserva_manual` (agenda del negocio) | BLOQUEAR | 163 + disparador |
| INSERT directo en `reserva` (incluido `service_role`) | BLOQUEAR | disparador 087→160 |
| `slots_disponibles` | devuelve vacío | 163 (ninguna pantalla ofrece horarios) |
| `reprogramar_reserva`; UPDATE de hora/sede/recurso de una cita | BLOQUEAR (**evasión**: mover una cita confirmada a otra fecha) | 163 + disparador `trg_guardia_reprogramacion` (cualquier llamador salvo SuperSU) |
| `confirmar_reserva_sin_anticipo`, `crear_pago_sena` | BLOQUEAR (una reserva pendiente de pago no es «cita confirmada previa») | 163 |
| `reasignar_staff_reserva` | PERMITIR solo citas previas (cambia profesional, no la fecha) | sin cambio |
| `cancelar_reserva`, `marcar_no_show`, `marcar_llegada`, `iniciar_atencion_reserva`, `finalizar_atencion_reserva` | PERMITIR (solo pueden actuar sobre citas que ya existen) | sin cambio |
| `completar_venta_pos` | PERMITIR solo citas previas; **sin venta de productos nueva** | 163 (`_exigir_operativo_reserva_sin_productos`) |
| `aceptar_politica_reserva`, `calificar_visita`, `registrar_uso_membresia`, reseñas | PERMITIR | — |
| `reserva_servicio` (agregar/quitar servicios a una cita) | BLOQUEAR | disparador `reserva` |

**Servicios, disponibilidad, sedes (tablas con disparador 162; cubren Server Actions y RPC)**

`servicio`, `servicio_combo`, `servicio_combo_item`, `staff_servicio`, `servicio_producto_consumo` (incluye **precio**), `disponibilidad`, `bloqueo_ausencia`, `sede_horario_excepcion`, `recurso`, `sede` (`crear_sede`, `cerrar_sede`, `reabrir_sede`, `establecer_sede_principal`): **BLOQUEAR**. `crear_sede` además por 163.

**Equipo y comisiones**: `crear_invitacion_staff` (163 + `invitacion_staff`), `reenviar_invitacion`, `cancelar_invitacion` (`invitacion_staff`), `aceptar_invitacion_staff`, `responder_invitacion`, `activar_perfil_profesional_propietario` (INSERT de vínculo), `cambiar_rol_equipo`, `suspender_staff`, `reactivar_staff`, `retirar_staff`, `trasladar_staff`, `promover_guardian`, `revocar_guardian`, **comisión** (`vinculo_staff_negocio.comision_pct`): **BLOQUEAR** (disparador de vínculo: crear siempre bloqueado; cambiar/borrar bloqueado salvo que el vínculo sea del propio usuario). `desactivar_perfil_profesional_propietario` (dejar de atender): PERMITIR.

**Precios, políticas y datos del negocio**: `configurar_anticipo`, `configurar_politica_cancelacion` (163) y cualquier UPDATE de `negocio` salvo estado/plan/país/propietario/alta (disparador): **BLOQUEAR**. `oferta_negocio`: BLOQUEAR (tabla). `guardar_marca_negocio` → `negocio_marca`: BLOQUEAR (tabla); `fijar_foto_principal_negocio`: BLOQUEAR (163).

**Funciones comerciales**: campañas (`campana_publicitaria`, `sello_campana`, `crear_campana_*`, `activar_/pausar_/finalizar_campana`, `alternar_campana_sellos`), membresías (`membresia_plan`, `crear_plan_membresia`, `alternar_plan_membresia`, `suscribirse_membresia` por 163), gift cards (`crear_gift_card`, `crear_lote_gift_cards_corporativo`), cashback/recompensas/VIP (`cashback_regla`, `recompensa_regla`, `vip_nivel`, `crear_nivel_vip`, `asignar_vip`, `sembrar_niveles_vip_default`, `crear_sugerencia_recompensa`), referidos (`referido_config`, `configurar_referidos`, `registrar_referido_staff`), corporativo y familia (`corporativo_cuenta`, `familia_grupo`, `crear_cuenta_corporativa`, `crear_grupo_familiar`), WhatsApp (`whatsapp_campana_crear`, `whatsapp_plantilla_guardar`, `whatsapp_solicitar_recarga`), IA del negocio (`ai_prompt`, `ai_memoria_negocio`, `comprar_paquete_creditos_ia`): **BLOQUEAR**. Del cliente (cancelar/congelar/reactivar su membresía, canjear sellos, wallet, favoritos, referidos propios, `mi_*`): PERMITIR.

**Inventario y caja**: `ajustar_stock`, `registrar_movimiento_inventario`, `configurar_stock_minimo`, `atender_solicitud_reposicion`, `registrar_egreso_caja`, `producto`: **BLOQUEAR**. `anular_egreso_caja`, `cierre_caja_dia`, `libro_registrar_ajuste`, exportaciones del libro: PERMITIR (histórico y cierre). El consumo de insumos que ocurre al completar una cita **no se bloquea** (movimiento/stock no tienen disparador de bloqueo, a propósito).

**Suscripción y pago (deben seguir accesibles)**: `solicitar_pago_plan`, `solicitar_upgrade_plan`, `solicitar_downgrade_plan`, `cancelar_downgrade_programado`, `cancelar_negocio_propio`, pantalla `/panel/suscripcion`, webhook de pago, `aplicar_evento_pago`: **PERMITIR / sin cambios**. Probado por HTTP real con el negocio restringido.

**Cuenta e identidad** (perfil, privacidad, exportar mis datos, eliminar cuenta, notificaciones, tickets de soporte): PERMITIR. **SuperAdmin** (`admin_*`, `supersu_*`, `actualizar_*` de catálogos): fuera de alcance; el SuperSU queda exento de las guardias.

**Server Actions / API (TypeScript)**

| Acción / ruta | Decisión | Cómo |
|---|---|---|
| `panel/servicios`, `panel/staff`, `panel/sedes`, `panel/agenda` (crear cita, bloqueos), `panel/inventario`, `panel/pos`, `panel/lealtad` (RPC), `negocio/[slug]/reservar` | BLOQUEAR | usan el JWT del usuario → disparadores/RPC; el error `SUSCRIPCION_RESTRINGIDA` se traduce a un mensaje claro |
| `panel/lealtad` → `generarSugerenciasAction` (usa **clave de servicio**, consume créditos de IA) | BLOQUEAR | guardia `exigirOperativo(negocioId)` en la acción (el JWT del usuario no la frena) |
| `panel/cumplimiento` (nuevo): completar en caja SIN productos, no-show, cancelar | PERMITIR solo citas previas | RPC existentes |
| `panel/suscripcion` | PERMITIR | — |
| `api/reportes|crm|libro|ia/exportar` | PERMITIR (consulta histórica) | — |
| `api/cron/diario`, `api/webhooks/*` | sistema | — |
| `api/pagos/mercadopago/conectar|callback` (conexión de la cuenta de cobro, clave de servicio), `api/verificacion/documento` | **NO TOCADAS** (decisión pendiente 5) | — |

## 6. Pantallas

- **Banner** (`BannerSuscripcion`) en `/panel/*` y `/staff/*`: en gracia (aviso de renovar) y en restricción (qué se puede y no, enlace a «Ver citas pendientes» y «Pagar y reactivar» solo para el propietario). Solo muestra lo que decidió la base.
- **`/panel/cumplimiento`** (ruta registrada en `route-registry`): citas CONFIRMADA/EN_CURSO (completar en caja sin productos, no-show, cancelar), histórico reciente, mensaje claro y botón de pago. No oculta ni elimina nada. `/panel` redirige aquí cuando está restringido (propietario y Guardian).
- **Página pública** `/negocio/[slug]`: banner «Este establecimiento no está aceptando nuevas reservas temporalmente» y CTA deshabilitado; `/negocio/[slug]/reservar` muestra el mismo mensaje en lugar del flujo (i18n es/en). El visitante anónimo solo recibe un sí/no (`negocio_acepta_reservas`), sin fechas ni motivo.
- **SuperAdmin**: `/admin/negocios` muestra por negocio `OPERATIVO/RESTRINGIDO · fase · motivo · día N · manual`; `/admin/reglas` tiene la tarjeta «Ciclo de la suscripción» (periodo pagado, gracia de la prueba, ¿la gracia deja operar?) con motivo obligatorio y auditoría (`CONFIG_SUSCRIPCION_ACTUALIZADA`); la gracia por impago y los días de prueba siguen en la tarjeta de prueba existente.

## 7. Configuración desde SuperAdmin (sin tocar código)

| Parámetro | Dónde | Valor |
|---|---|---|
| Días de prueba | `/admin/reglas` → Prueba (`admin_set_config_prueba`, sin cambios) | 14 |
| Gracia del periodo pagado | idem («Gracia por impago») | **1** (antes 3) |
| Periodo pagado | `/admin/reglas` → Ciclo | 30 |
| Gracia tras la prueba | idem | 0 |
| ¿La gracia deja operar? | idem | sí |

## 8. Resultados REALES de pruebas

### 8.1 SQL (base local)

`tests/sql/restringida_160.sql` — **PASÓ** (12 bloques, transacción con ROLLBACK): 1) función central y bordes UTC-5; 2) prueba día 1/14/15 y pago día 30/31/32 con instantes exactos (incl. 04:59:59Z/05:00:00Z), gracia configurable (0/1/3 días, no opera, gracia de prueba); 3) los **4 planes** (Essential, Studio, Prestige, Signature) día 1, 14, 15 sin pago, pagado 30/31/32, estados que nunca operan, negocio en alta/suspendido; 4) cron diario (prueba→REQUIERE_PLAN, periodo→EN_MORA con `gracia_fin` determinista→SUSPENDIDA, antes y después del cron, manual vigente/vencida); 5) **pago confirmado restaura** (desde bloqueo, suspendida y gracia; periodo configurable a 28 días); 6) citas previas creadas operativo + slots; 7) **bloqueado** con el negocio restringido: crear/modificar/borrar servicio, **precio**, asignar servicios, disponibilidad, ausencias, sede, `crear_sede`, invitar (RPC y tabla), **comisión**, suspender/retirar/vincular equipo, datos del negocio, anticipo/política, campaña de sellos, gift card, referidos, egreso, stock, cita manual, **reprogramar** (RPC y UPDATE directo, evasión), y como **cliente con su JWT** `crear_reserva_autorizada` (marketplace), `crear_reserva` (cerrada), INSERT directo en `reserva` y reprogramar, y como `service_role` el INSERT en `reserva`; slots vacíos; 8) **permitido** restringido: histórico y suscripción del dueño, estado detallado para dueño y profesional, `solicitar_pago_plan` (200), iniciar/finalizar atención de una cita previa, completar en caja una cita previa, POS con productos nuevo → bloqueado, cancelar cita previa, ninguna cita borrada, la cita 4 sigue en su fecha; **IDOR** (intruso solo recibe operativo/estado, sin motivo ni fechas; anónimo solo el sí/no; funciones internas sin permiso); 9) aislamiento entre negocios; 10) **activación manual de SuperAdmin** (ACTIVA y TRIAL): desbloquea, vence con la función central, el dueño no puede activarse; 11) configuración SuperAdmin (permisos, motivo, auditoría, periodo aplicado); 12) privilegios (ningún rol de la API ejecuta las internas).
Controles negativos: sin 162 falla en «crear servicio» (esperaba bloqueo, obtuvo éxito); sin 163 falla en «crear sede (RPC)».

`tests/sql/restringida_http.sh` (HTTP REAL contra PostgREST con JWT reales, sin imprimir tokens) — **PASÓ 33/33**: día 30 opera, día 31 gracia opera, día 32 bloqueos (servicio, precio, borrar, negocio, disponibilidad, invitar, `crear_sede`, anticipo, gift card, cita manual, reserva de cliente por marketplace, slots vacíos), permitido (histórico, suscripción, profesional ve el estado, `solicitar_pago_plan` 200), IDOR (otro negocio sin motivo ni fechas, anónimo solo el sí/no, 401/403 en internas, dueño sin acceso a la configuración), renovación restaura. La suscripción de NS (`f1-studio`) se restaura al terminar.

**Comparación de TODAS las suites SQL contra la línea base** (primer error, una a una; línea base = antes de aplicar 160–164):

| Suite | Línea base | Ahora |
|---|---|---|
| aislamiento_multiempresa, anticipos_129, cobro_directo_119, limites_plan_149, onboarding_verificacion_150, prueba_antiabuso_135, registro_pendiente_127, registro_telefono_128, roles_151, roles_155_config_sesion_publicacion, seguridad_regresion, webhook_130 | PASA | **PASA** |
| roles_157_normalizacion (.sh) | PASA | **PASA** |
| roles_http.sh (38 comprobaciones de la Fase 1) | PASA 38/38 | **PASA 38/38** |
| restringida_160 | — | **PASA** |
| auditoria_123, libro_122, whatsapp_120 (SuperSU único) | roja | roja (mismo error); **PASAN descendiendo al SuperSU existente** antes y después |
| directiva_116_118 | roja (SuperSU) | roja (SuperSU); descendiendo al SuperSU: antes fallaba en «vencida debe pasar a REQUIERE_PLAN: EN_MORA» (efecto de 133); **ahora PASA** (la regla nueva lo cumple) |
| f0_05, f1b_139, f1b_promociones_140 (SuperSU) | roja | roja, **mismos conteos** (19 / 28 / 3 casos) con y sin 160–164 |
| f1b_compat_codigo_vs_base | roja (SuperSU) | roja; descendiendo al SuperSU **PASA** antes y después |
| f1b_141_142, hotfix_staff_nulo_posterior, notificaciones_124 | roja | roja, mismo error |
| suscripcion_133 | roja (`PLAN_SIN_PRECIO`) | roja en el mismo punto (`PLAN_SIN_PRECIO`, bloque 2: falta el precio de Signature en CO local); el bloque 1 se actualizó a la regla nueva y **pasa** |
| rendimiento_131 | roja (2 FK sin índice) | roja (19): las 17 nuevas son `adicional_*` del otro agente (170–179), **no** de 160–164 |
| adicionales_170 (otro agente) | — | PASA (con el precio STUDIO/CO presente, ver Hallazgos) |

Suites con cambio de expectativa por la regla aprobada (únicas modificadas): `suscripcion_133.sql` (bloque 1 y comparación del bloque 4), `directiva_116_118.sql` (línea del fin de prueba). Ninguna otra prueba existente se tocó.

### 8.2 TypeScript

`npx tsc --noEmit`: limpio. `npx eslint src tests/estado-operativo.test.ts`: limpio. `vitest`: 167 pasan, 26 omitidas, 0 fallan (18 archivos; 7 pruebas nuevas en `tests/estado-operativo.test.ts` sobre el espejo TypeScript, falla cerrado ante respuestas inválidas y ausencia de aritmética de fechas fuera de la base). `npx next build --webpack`: PASÓ dos veces (sin variables de entorno y con las locales, código final), ruta `/panel/cumplimiento` generada.

## 9. No verificado

- **Producción**: nada (prohibido). Las migraciones 160–164 no se probaron contra la base de producción ni una copia de sus datos; el orden de despliegue respecto de 139–157 está sin decidir. Antes de producción hay que contar los negocios ACTIVO sin fila de suscripción (operan por compatibilidad) y revisar los EN_MORA vigentes (conservan el `gracia_fin` que calculó el cron antiguo con 3 días; no se recalculan).
- **Navegador** (build de producción local en :3311 contra Supabase local, sesión inyectada porque Turnstile no es automatizable). PASÓ: página pública `/negocio/f1-studio` muestra «no está aceptando nuevas reservas temporalmente» y no ofrece enlace a reservar; `/panel` del propietario restringido redirige a `/panel/cumplimiento` con banner, botón «Pagar y reactivar» y la cita confirmada; «Cobrar y completar» dejó la cita COMPLETADA y la lista se refrescó; crear un servicio desde la interfaz mostró «Tu suscripción está restringida…» y no creó nada. **NO VERIFICADO en navegador**: `/negocio/[slug]/reservar` como cliente (la sesión del cliente no se pudo inyectar a tiempo), `/admin/negocios` y `/admin/reglas` (todas las rutas `/admin/*` devolvieron 500 en este servidor local sin traza en el log; no determiné la causa ni si es previa a mis cambios; la lógica de esas pantallas solo está cubierta por tsc/build y por las RPC probadas en SQL/HTTP). Quedan en la base local, sin borrar (la cita tiene un pago del POS): 1 cita COMPLETADA y 1 servicio «Corte navegador 2B» en f1-studio; la suscripción de f1-studio se restauró.
- **Pago real**: el flujo de Checkout Pro/Mercado Pago real no se ejercitó (se simuló la confirmación con `aplicar_evento_pago` como service_role, igual que el webhook).
- **Frecuencia del cron**: es diario; no se simuló nada más frecuente. Efecto: el estado *visible* (EN_MORA/SUSPENDIDA/REQUIERE_PLAN) puede ir hasta 24 h atrás; lo operativo no.
- **Concurrencia** del cambio de estado durante una reserva en curso (la reserva toma el estado al insertar; no se probó una carrera real).
- Server Actions no probadas por ejecución directa (se probaron por la base y por HTTP real sobre PostgREST con el mismo JWT); se verifican por tsc/eslint/build.

## 10. Riesgos y decisiones pendientes

1. **Negocio ACTIVO sin fila de suscripción opera** (compatibilidad con el contrato anterior y con fixtures de las suites). Sin fila no hay fechas que vencer. El alta siempre crea la fila (`crear_suscripcion_inicial`), pero un ACTIVO heredado sin fila no se bloquea nunca. Recomiendo, en producción, contar esos casos y luego pasar a «falla cerrado». Marcado como contradicción con «cero confianza».
2. **Qué significa «gracia ≠ día completo de servicio comercial»**: implementé gracia = opera con aviso, y un interruptor (`gracia_permite_operar`) que la convierte en restricción. Si la intención era un tercer nivel (opera solo cumplimiento, sin ventas nuevas), hay que definirlo.
3. **Renovación anticipada**: `solicitar_pago_plan` (133) solo deja pagar dentro de los 7 días previos al vencimiento (`AUN_NO_TOCA_RENOVAR`). Con renovación manual y 30 días, un negocio no puede pagar el día 10. No se cambió (no es parte de este encargo): decidir si se amplía.
4. **Avisos de renovación**: hay avisos de fin de prueba (`avisos_prueba_pendientes`) pero **ninguno para el fin del periodo pagado**; con renovación manual el propietario podría enterarse tarde. No se implementó (WhatsApp/correo están fuera de alcance); recomendado.
5. **No cubiertas** (decisión): conexión de la cuenta de cobro (`/api/pagos/mercadopago/conectar|callback`, `conexion_guardar/desconectar`), verificación del negocio (`/api/verificacion/documento`), `whatsapp_campana_programar/cancelar`, `redimir_gift_card_pos` (sin negocio en los parámetros), `lista_espera`, respuestas a reseñas, tablas `ai_*` de sistema y el motor de IA con clave de servicio (solo se guardó `generarSugerenciasAction`). Cualquier ruta futura con clave de servicio debe llamar a `exigirOperativo`.
6. **Marketplace/mapa**: `negocio_visible_en_mapa` no cambió: un negocio restringido por `REQUIERE_PLAN` o prueba vencida sigue apareciendo en la búsqueda (ya no se puede reservar y su página lo dice). Decidir si se oculta.
7. **ANUAL = 365 días** y sin descuento de gracia propio; el encargo solo definió 30 días. Confirmar.
8. **Citas `PENDIENTE_PAGO` previas** (retención de 10 minutos) no se pueden confirmar/pagar tras el bloqueo (`confirmar_reserva_sin_anticipo`, `crear_pago_sena` bloqueadas): un cliente con una retención abierta pierde el horario; es un caso de minutos.
9. **Reasignar profesional** sobre una cita previa queda permitido (mismo horario). Si se considera «operar el equipo», bloquear.
10. **Reglas de evasión**: bloqueado mover una cita a otra fecha/sede/recurso y agregar/quitar servicios; permitido cancelar, no-show y completar. Una cita lejana confirmada antes del bloqueo se puede completar cuando le llegue su hora; no hay regla de caducidad de citas «previas».
11. **CONTRADICCIÓN con 133**: ver 2.3 (prueba vencida ya no sigue recibiendo reservas).
12. El SuperSU está exento de las guardias (puede operar un negocio restringido, p. ej. para soporte). Founder no se tocó.
13. `solicitar_upgrade_plan` queda permitido en restricción (es una vía de pago); si se paga un plan mayor mientras está restringido, el cobro sigue su flujo normal.

## 11. Hallazgos de la sesión (entorno)

- **Base local compartida**: otro agente aplicó 17x (`adicional_*`) en la misma base. Hizo rojo `rendimiento_131` (FK sin índice) y comparte `plan_precio`. Mis cadenas de revertir/aplicar solo tocan objetos de 160–164.
- **Precio de STUDIO/CO**: durante mi sesión borré por error una fila `plan_precio` STUDIO/CO 139900 creyendo que era residuo de mi script HTTP (el script la inserta y la borra al terminar solo si la creó). Hizo fallar `adicionales_170` y `directiva_116_118` (descendiendo al SuperSU) con `PLAN_SIN_PRECIO`; **la repuse** (mismo valor 139900, `activo`) y vuelven a pasar. No sé si esa fila era de otro agente o del script; el estado final de la base tiene la fila.
- Los `.sql` del repo están en CRLF: las funciones aplicadas desde ellos guardan `\r`. Los parchadores de 161 y 163 normalizan `chr(13)`; mis archivos nuevos van en LF.
- `crear_reserva` ya estaba cerrada a `authenticated` (144): el marketplace entra por `crear_reserva_autorizada`.
