# FASE 2A — Barberos adicionales con pago MANUAL por Checkout Pro

Fecha: 2026-11-18. Rama `feat/onboarding-v2` (worktree `stylernow-onboarding`). Todo se probó SOLO contra Supabase local (Docker, `supabase_db_stylernow`). Sin commits, sin push, sin tocar producción ni Vercel. Alcance excluido y NO implementado: Preapproval, suscripciones automáticas, tarjetas para cobros futuros, renovaciones/cobros automáticos, nueva aplicación o credenciales de Mercado Pago (la investigación sigue en `docs/FASE2_ADICIONALES_DISENO.md`).

> Estado honesto: «PASÓ» = se ejecutó y se vio pasar. «NO VERIFICADO» = no se ejecutó.

## 1. Modelo de datos (migraciones 169-177)

| Tabla | Para qué |
|---|---|
| `adicional_config` (singleton) | habilitado, máx. por establecimiento (50), máx. por lote (50 = **PROPUESTA**), periodo (30 días), gracia (3), avisos `{7,3,1}`, expiración de checkout (24 h) y de pago pendiente (7 d), vigencia máx. de excepción (366), zona `America/Bogota` |
| `adicional_precio_plan` (país, plan) | precio mensual por adicional: 51.900 COP sembrado para los 4 planes en CO; editable por plan; país sin precio = no contratable |
| `adicional_estado_def` / `adicional_transicion` | máquina de estados única: 11 estados y las transiciones permitidas con quién las dispara |
| `adicional_lote` | la contratación: negocio, cantidad, precio unitario y total CONGELADOS (`total = cantidad × precio`, CHECK), fechas de contratación/inicio/vencimiento/gracia, estado, periodos pagados, cancelación, origen (`CHECKOUT_PRO` o `MANUAL_SUPERADMIN` con tipo/motivo/responsable) |
| `adicional_cobro` | un cobro por (lote, periodo) ligado a `pago` (UNIQUE) y al id de Mercado Pago; índice único parcial = un solo cobro vivo por periodo |
| `adicional_historial` | append-only (trigger inmutable); único por (lote, evento, mp_ref) |
| `adicional_pago_revision` | cola de pagos que no cuadran (no activan ni se reembolsan solos) |
| `adicional_reembolso` | solicitud/decisión/ejecución manual de reembolsos (solo registro) |
| `adicional_mantenimiento_corrida` | una corrida del cron por día de Bogotá |

Estados (mismo vocabulario en base, backend, panel, CRM y webhooks): PENDIENTE_CONTRATACION, CHECKOUT_INICIADO, PAGO_PENDIENTE, PAGO_CONFIRMADO, ACTIVO, PROXIMO_A_RENOVAR, EN_GRACIA, SUSPENDIDO, CANCELADO (sin renovación futura), EXPIRADO_SIN_PAGO, REEMBOLSADO. Nadie escribe `estado` directo: un trigger lo impide fuera de `_adicional_transicionar`, que valida la tabla de transiciones (actores PROPIETARIO / SUPERSU / SISTEMA / WEBHOOK). Quién dispara: propietario = iniciar/cancelar; webhook = pendiente/confirmado/activo/reactivado; cron = próximo a renovar/gracia/suspendido/expirado; SuperAdmin = suspender/reactivar/cancelar/reembolsado.

Cupos fungibles: un lote aporta `cantidad` al tope; no se atan a profesionales concretos (decisión pendiente 9.3).

**Capacidad.** `_capacidad_profesional` (152) conserva su firma; ahora `limite = tope del plan + adicionales vigentes` (ACTIVO, PROXIMO_A_RENOVAR, EN_GRACIA con gracia vigente, CANCELADO con periodo pagado aún vigente). `p_adicionales` solo puede SUBIR el tope (simulación), por lo que los 4 llamadores que pasan 0 reciben los adicionales reales sin cambiarlos (no hizo falta tocarlos). Devuelve además: `tope_plan`, `adicionales_activos/en_gracia/suspendidos/en_proceso`, `adicionales_vencen_at`, `a_regularizar`. Nunca se retira a nadie: con exceso solo se bloquean altas e invitaciones; los suspendidos siguen ocupando cupo.

**Fechas.** Una sola función central: `adicional_fin_periodo` (inicio + N días en hora de Bogotá), `adicional_fecha_bogota`, `adicional_dias_para`. Frontend y backend solo muestran lo que calcula la base.

## 2. Migraciones y dependencias (para renumerar al integrar)

| Mig. | Contenido | Depende de |
|---|---|---|
| 170 | config, precio por plan, funciones de fecha | `pais`, `plan`, `_trg_auditar_cambio` |
| 171 | estados, transiciones, lote, cobro, historial, revisión, reembolso, corrida, índices de FK | 170 (fechas), `negocio`, `pago`, `is_barberia_de`, `is_supersu`, `trg_fila_inmutable` |
| 172 | eventos y plantillas es/en del outbox + `_adicional_notificar` | 171, 124 |
| 173 | `_adicional_transicionar`, `_adicional_historial`, `_adicionales_activos/_resumen`, parche de `_capacidad_profesional` | 171, 172, **152** (`_cupo_bloquear`, `_capacidad_profesional`) |
| 174 | RPC del propietario + `*_srv` | 170-173, `pago`, **133** no (independiente) |
| 175 | `_adicional_aplicar_pago`; parches ancla-guardada de `aplicar_evento_pago`, `solicitar_pago_plan` (133), `solicitar_upgrade_plan` (049) | 171-174, 133, 049 |
| 176 | `adicional_mantenimiento_srv` (cron) | 170-173 |
| 177 | RPC SuperAdmin (config, precio, listar, detalle, acciones, activación manual) | 170-173 |
| 178 | reembolsos y cola de revisión (RPC admin) | 171, 173, 177 (`_adicional_exige_supersu`) |

Todas con reversión `*_REVERSION.sql.txt`. **PASÓ** la cadena completa: revertir 178→170 y reaplicar 170→178 (dos veces); además las reversiones de 175 restauran `aplicar_evento_pago`, `solicitar_pago_plan` y `solicitar_upgrade_plan` byte a byte (comparado con `pg_get_functiondef`). Las migraciones 164-168 del otro agente no se tocaron. `database.ts` no se regeneró (las RPC se llaman con casts, como las de 130/133).

## 3. RPC y permisos

Propietario (`authenticated`, autoriza `is_barberia_de` con `coalesce(...,false)`): `adicional_cotizar`, `adicional_iniciar(negocio, cantidad, total_esperado)`, `adicional_renovar`, `adicional_cancelar_renovacion`, `adicional_mis_lotes`. BUSINESS_ADMIN, otros propietarios y SuperAdmin-como-propietario reciben `NO_AUTORIZADO`. Servidor (solo `service_role`): `adicional_checkout_fallido_srv(lote, p_actor)` (verifica que p_actor sea el propietario), `adicional_marcar_pago_pendiente_srv`, `adicional_mantenimiento_srv`. SuperAdmin (`is_supersu()` dentro, motivo ≥5 caracteres): `admin_adicional_config_obtener/guardar`, `_precio_guardar`, `_listar`, `_detalle`, `_accion` (SUSPENDER, REACTIVAR con vigencia, CANCELAR, AJUSTAR), `_activar_manual`, `_reembolso_solicitar/decidir/listar`, `_revision_listar/resolver`. Internas sin acceso de API: `_adicional_*`, `_adicionales_*`. REVOKE de `public`, `anon` Y `authenticated` verificado función por función (SQL) y por HTTP.

## 4. Flujo Checkout Pro (manual) tal como quedó

1 el propietario elige cantidad → 2 la base calcula el precio (`_adicional_cotizacion`) → 3 pantalla con cantidad, unitario, total, periodo, vencimiento, gracia y condiciones → 4 confirma (casilla) → 5 `adicional_iniciar` crea lote CHECKOUT_INICIADO + `pago` SUSCRIPCION `metadata.concepto='STAFF_EXTRA'` (beneficiario PLATAFORMA) + cobro; si el total mostrado no coincide con el de la base: `PRECIO_CAMBIO`; es idempotente (reutiliza el checkout abierto <2 h del mismo tamaño y precio, cierra los otros) → 6 la server action llama `crearPreferenciaDePago` (el mismo flujo del plan; `external_reference = pago.id`); si falla, `adicional_checkout_fallido_srv` cierra lo abierto → 7 el usuario paga → 8 el webhook / retorno / conciliación reconsulta el estado REAL con Mercado Pago (`obtenerPago`/`buscarPagoPorReferencia`) → 9-11 `aplicar_evento_pago` → `_adicional_aplicar_pago`: valida y activa SOLO ese lote, registra periodo → 12 confirmación por outbox → 13 vencimiento programado. Pendiente/rechazado no activan; el retorno del navegador no activa nada.

## 5. Cambios en `sincronizar.ts` / `aplicar_evento_pago` (autorizados)

- `aplicar_evento_pago`: antes del chequeo de «ya procesado», STAFF_EXTRA va por `_adicional_aplicar_pago` (ruta propia); la rama PLAN/UPGRADE queda intacta. Un concepto desconocido en SUSCRIPCION no se aplica ni se reembolsa (auditoría `PAGO_CONCEPTO_DESCONOCIDO`).
- `_adicional_aplicar_pago` NO se apoya en el prefijo de la referencia. Valida: lote existente, del mismo negocio, cobro/periodo que corresponden al pago, importe pago = cobro = lote, importe informado por Mercado Pago (±1), id de transacción presente y no usado por otro pago, cobro pendiente, estado del lote compatible, suscripción principal no cancelada. Cualquier fallo → fila en `adicional_pago_revision` + auditoría, `procesado:false`, sin activar y sin reembolso. Duplicado con otro id de MP → revisión `COBRO_DUPLICADO`; aprobado tardío sobre un cobro ya cerrado → `PAGO_TARDIO_SOBRE_COBRO_CERRADO`. Un rechazo NO cierra el cobro (Checkout Pro permite reintentar sobre la misma preferencia; un aprobado posterior sí activa).
- `solicitar_pago_plan` y `solicitar_upgrade_plan` ignoran los pagos STAFF_EXTRA pendientes (un adicional pendiente ya no bloquea pagar o mejorar el plan).
- `sincronizar.ts`: (a) pendiente de un STAFF_EXTRA → `adicional_marcar_pago_pendiente_srv`; (b) `ADICIONAL_EN_REVISION` se devuelve como `REQUIERE_REVISION`; (c) un huérfano cuya referencia NO tiene forma de UUID (p. ej. `ADIC-…`) ya no se reembolsa a ciegas: queda registrado (`WEBHOOK_HUERFANO`) y en revisión. Los huérfanos con forma de UUID conservan la regla histórica (reembolso automático) — **decisión pendiente 9.1**. `webhook-mercadopago.ts` no se modificó.
- `listarPagosSuscripcion` y la vista del plan distinguen «Barberos adicionales» de «Upgrade».

## 6. Cron (`/api/cron/diario`, una vez al día)

`adicional_mantenimiento_srv`, tras la conciliación de pagos y antes del outbox, en su propio try/catch. Atómico e idempotente; una corrida por día de Bogotá (repetirla el mismo día = `omitido`). Pasos: activaciones manuales vencidas → CANCELADO; vencidos → EN_GRACIA (`gracia_fin = vencimiento + 3 días`, contada desde el vencimiento) y SUSPENDIDO solo cuando `gracia_fin` ya pasó; ACTIVO que entra a la ventana → PROXIMO_A_RENOVAR; avisos 7/3/1 por el outbox (umbral más cercano aún no enviado; si se salta un día se envía el pendiente; sin repetir); checkouts abandonados → EXPIRADO_SIN_PAGO (su pago pendiente pasa a RECHAZADO). Registra el resultado en tabla y auditoría. No toca suscripciones principales. **Sin expiración a los 60 días.**

## 7. Pantallas

- Propietario: `/panel/staff/adicionales` (solo BARBERIA; botón «Agregar barberos adicionales» en Equipo y en el aviso de cupo lleno; el administrador ve el texto «pídele al propietario» y no el botón): capacidad (incluidos, adicionales activos/en gracia/suspendidos, usados, límite, disponibles, exceso y cuánto regularizar), aviso de exceso, cotización con condiciones, pago, lista de lotes con estado/vencimiento/gracia/pagos, renovar, cancelar renovación, «Actualizar estado» y reconsulta al volver de Mercado Pago. Estilo brutalista del repo.
- SuperAdmin: `/admin/adicionales` (menú «Ingresos y producto»): precio por plan y país, reglas generales, lotes con filtros y acciones con motivo, activación manual, cola de pagos en revisión, cola de reembolsos y catálogo de estados/transiciones. Cada acción: sesión SuperSU en la acción + `is_supersu()` y motivo en la RPC + auditoría.

## 8. Resultados REALES de las pruebas

| Prueba | Resultado |
|---|---|
| `tests/sql/adicionales_169.sql` (≈290 aserciones, transacción con rollback) | **PASÓ** (una corrida inicial falló con `PLAN_SIN_PRECIO` en el paso «un adicional pendiente no bloquea pagar el plan»; no se reprodujo en 5 corridas posteriores; causa: el agente de la Fase 2B borró por error la fila plan_precio STUDIO/CO y la repuso; verificado ahora: STUDIO/CO = 139900 presente y mi suite no depende de residuos, solo de ese precio de catálogo) |
| `tests/sql/adicionales_169_concurrencia.sh` (sesiones simultáneas reales) | **PASÓ**: 6 invitaciones con tope 3 → 3 creadas / 3 `PLAN_LIMIT_EXCEEDED`; 5 webhooks duplicados del mismo pago → 1 activación, 4 `YA_PROCESADO`, periodo 1; 5 contrataciones simultáneas → 1 lote y 1 pago. Limpia sus fixtures |
| `tests/sql/adicionales_http.sh` (JWT reales contra PostgREST) | **PASÓ 48/48**: propietario, admin delegado (NO cotiza/inicia/consulta/renueva/cancela), IDOR con otro propietario y anónimo, escrituras directas bloqueadas (403), funciones de servidor/internas bloqueadas, pendiente/rechazado no suben el tope, aprobado confirmado en servidor sube +3, cancelar conserva cupo, SuperAdmin (excepción con motivo, auditada) |
| `tests/integracion/adicionales-pagos.test.ts` (`ADICIONALES_INT=1`) | **PASÓ 9/9**: webhook firmado real + `sincronizar.ts` + `crearPreferenciaDePago` + BD local; aprobado, duplicado, pendiente, rechazado→aprobado, fuera de orden, importe distinto, referencia `ADIC-…` sin reembolso, lote ajeno/inexistente, webhook tardío (401) y conciliación, plan + adicional conviviendo |
| `tests/adicionales.test.ts` | **PASÓ 7/7** (vocabulario único, reversiones, REVOKE y search_path en el código SQL, sin precios en el código) |
| vitest completo | **PASÓ**: 18 archivos / 167 tests; 26 omitidos por diseño (integración y los dos de autorización de Server Actions exigen la pila local en el puerto 55321: **NO ejecutados**) |
| tsc, eslint (archivos tocados) | **PASÓ** sin salida |
| `next build --webpack` | ver 8.1 |
| Suites SQL previas | ver 8.2 |

Cubierto: contratar 1 y varios; aprobado/pendiente/rechazado; webhook duplicado, fuera de orden y tardío; pago de plan vs adicional (el plan sigue activándose, el adicional solo activa su lote); vencimiento; avisos 7/3/1; gracia (no suspende a 2 d 23 h); suspensión; reactivación pagando; renovación anticipada sin perder días; cancelación; exceso (nadie retirado, invitación bloqueada); Signature (50+3); cambio de precio sin afectar lotes; cambio de plan; plan principal bloqueado; propietario sí / administrador no (SQL y HTTP); excepción SuperAdmin; IDOR; REVOKE; cupos concurrentes; reembolsos y cola de revisión; máquina de estados (updates directos, precio congelado, transiciones y actores inválidos).

### 8.1 Build
**PASÓ** `next build --webpack` (exit 0; rutas `/panel/staff/adicionales` y `/admin/adicionales` compiladas), repetido tras el último cambio de código.

### 8.2 Línea base de suites SQL
Rojas previas conocidas: directiva_116_118, f0_05, f1b_139, f1b_141_142, f1b_promociones_140, hotfix_staff_nulo_posterior, notificaciones_124, suscripcion_133. Con el único SuperSU local descendido dentro de la transacción: auditoria_123, directiva_116_118 y libro_122 **PASAN**. Sin cambios respecto a la base: f0_05, f1b_139, f1b_141_142, f1b_promociones_140, hotfix_staff_nulo_posterior, notificaciones_124, suscripcion_133 siguen rojas por sus causas previas. Verdes: aislamiento_multiempresa, anticipos_129, cobro_directo_119, hotfix_staff_nulo_previo, limites_plan_156, onboarding_verificacion_157, prueba_antiabuso_135, registro_pendiente_127, registro_telefono_128, restringida_164, roles_151, roles_155, seguridad_regresion, webhook_130, whatsapp_120. Dos hallazgos:
- `rendimiento_131` falló al principio por MIS 19 claves foráneas sin índice: corregido (índices en 170/171); ahora **PASA**.
- `roles_163_normalizacion` (FALLA L1) y `f1b_compat_codigo_vs_base` (`ai_acciones_costo_admin` inexistente) están rojas, y se comprobó que `roles_157`, `suscripcion_133` y `f1b_141_142` fallan IGUAL con mis migraciones revertidas: no las causo yo (la primera no figuraba en la lista de rojas previas).

## 9. Auditoría de seguridad, riesgos y decisiones pendientes

Seguridad: precio solo de la base; el total del navegador solo se compara; propietario único autorizado (con `coalesce`); SECURITY DEFINER con `search_path` fijo; RLS en todas las tablas, lectura de lotes/cobros/historial solo propietario y SuperAdmin (el administrador delegado ve 0 filas), sin escritura directa para `authenticated`; guardia de trigger sobre estado, precio, negocio y cantidad; historial inmutable; ningún dato de tarjeta; sin reembolsos automáticos; pagos dudosos a revisión humana; auditoría con motivo en toda acción de SuperAdmin; recordatorio: los triggers `trg_fila_inmutable` dejan pasar a `postgres`, igual que en el resto del proyecto.

Riesgos y pendientes (decisión del usuario):
1. **Huérfanos con forma de UUID** siguen reembolsándose solos (regla histórica). ¿Pasar TODO huérfano a revisión?
2. **Precio en renovaciones**: hoy se renueva al precio congelado del lote; la alternativa es el precio vigente. Pendiente.
3. Cupos fungibles (no atados a profesionales concretos); si el exceso aparece, el propietario decide a quién regularizar.
4. Máximo por lote = 50 es PROPUESTA; límite por establecimiento 50.
5. Se permite contratar con suscripción en TRIAL o ACTIVA; renovar cualquier lote mientras el plan no esté CANCELADO. Con el plan bloqueado no se contrata más, pero los lotes pagados siguen en el tope (las restricciones generales las impone el plan).
6. Un cambio de plan (también downgrade) conserva los adicionales vigentes sumados al tope del plan destino.
7. Periodo inactivo reactivado desde suspensión/gracia empieza en el pago (no desde el vencimiento antiguo).
8. El rechazo de MP no cierra el cobro; los cobros pendientes abandonados se cierran a las 24 h (checkout) o 7 d (pago pendiente), configurables.
9. Posible interbloqueo raro entre `adicional_iniciar` y un webhook simultáneo del mismo negocio (orden de locks pago/cupo); PostgreSQL lo detecta y reintenta MP. No se observó en las pruebas de concurrencia.
10. `admin_reporte` suma los pagos SUSCRIPCION aprobados como «suscripciones»: los adicionales aparecerán ahí (no se tocó).

## 10. Reembolsos (qué NO se hizo)

Proceso administrable y auditado: solicitud (causas: cobro duplicado, incorrecto, error técnico, pago no reconocido, obligación legal, otro), decisión con motivo (en revisión / aprobado / rechazado) y «ejecución manual» con la referencia del reembolso de Mercado Pago. **No se ejecuta el reembolso real**: el worker existente (116) opera sobre la tabla `reembolso` de reservas (CHECK de motivo/origen y efectos sobre wallet/reserva) y extenderlo queda fuera de la Fase 2A. Cancelar nunca reembolsa.

## 11. Evidencia de pagos de prueba

Fue un **SIMULADOR de la API de Mercado Pago** (mismo patrón que `webhook-mercadopago.test.ts`), NO sandbox real: no hay comprador/credenciales de prueba utilizables aquí. Real: firma HMAC, manejador del webhook, `sincronizar.ts`, RPC, triggers y BD local. No hubo ningún pago real ni llamada a Mercado Pago.

## 12. Condiciones comerciales (borrador para revisión legal)

Barberos adicionales: cupos de profesional adicionales a los del plan, en cualquier plan. Precio por barbero y por mes (hoy 51.900 COP, editable por plan) fijado al contratar para ese grupo; un cambio posterior no lo afecta. Pago único por periodo de 30 días por Mercado Pago, sin tarjeta guardada ni cobros automáticos; sin descuento Founder. Avisos 7, 3 y 1 día antes; 3 días de gracia al vencer; si no se renueva se suspende solo el cupo adicional (no se eliminan profesionales, citas, historial, evidencias ni datos) y se reactiva al pagar. Con exceso de capacidad no se retira a nadie, pero no se pueden sumar profesionales hasta regularizar. Cancelar la renovación futura no reembolsa el periodo pagado y el cupo dura hasta su vencimiento. Sin reembolsos automáticos; cobros duplicados o incorrectos, errores técnicos, pagos no reconocidos u obligaciones legales se revisan individualmente. Solo el propietario contrata y paga. Pendiente de revisión legal y de publicación en los términos.

## 13. No verificado

Pago real en sandbox con comprador de prueba; navegador (ver 14); `server-actions-autorizacion` y `admin-actions-autorizacion` (requieren la pila en 55321); ejecución real de reembolsos; comportamiento en producción (no se tocó); regeneración de `database.ts`; carga/rendimiento del cron con muchos lotes.

## 14. Navegador y build
Recorrido real en Chromium (Playwright) contra `next start` local con Supabase local y la API de Mercado Pago simulada (mock en el proceso; sin red). El formulario de login exige Cloudflare Turnstile (sin red), así que la sesión real de GoTrue local se entregó como cookie `sb-127-auth-token`; no se imprimió ningún secreto. **PASÓ**: propietario ve «Agregar barberos adicionales» en Equipo, abre la pantalla, cotiza 3 (155.700, gracia 3 días), «Pagar» queda deshabilitado hasta confirmar, al pagar el lote queda CHECKOUT_INICIADO (el retorno no activa), tras confirmar el pago en el servidor y «Actualizar estado» aparece Activo; el administrador delegado recibe 403 y no ve el botón; SuperAdmin ve `/admin/adicionales` con precios, lotes y reembolsos. Capturas en el scratchpad (`f2a/capturas`). Hallazgo corregido en este recorrido: el zod `.uuid()` estricto rechazaba ids no estándar («Negocio inválido»); ahora valida la forma del UUID. Los lotes de prueba se eliminaron al terminar. Sin pago real. **NO verificado** en navegador: pantallas de acciones del CRM (suspender, reactivar, reembolsos), cubiertas por RPC (SQL y HTTP), tsc y build; el viewport móvil.
