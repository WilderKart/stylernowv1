# Cobertura de auditoría de los paneles administrativos (fase H)

Migración: `supabase/migrations/123_auditoria_completa.sql` (aditiva, re-ejecutable, **sin aplicar en producción**).
Pruebas: `tests/sql/auditoria_123.sql` (19 verificaciones) y `tests/auditoria.test.ts` (7).
Fecha: 2026-11-12.

## 1. Cómo funciona

| Pieza | Qué hace |
|---|---|
| `evento_auditoria.origen`, `request_id` | Columnas nuevas, nulas en las filas viejas (no se reescriben). |
| Trigger `BEFORE INSERT` en `evento_auditoria` | Corre en **toda** fila nueva, venga de una RPC antigua, de un trigger o del servidor con `service_role`. Quita de forma recursiva las claves con forma de secreto (`token`, `secret`, `password`, `hash`, `key`, `pin…`, `cifrado`, `credencial`, `metodo_pago_ref`). Llena `origen` y `request_id`. Si falta el motivo, usa el de la cabecera `x-auditoria-motivo`. |
| `_auditar(entidad, id, accion, negocio, antes, despues, motivo)` | Helper interno. Deduce `actor_id` y `actor_tipo` (SUPERSU, BARBERIA, GUARDIAN, STAFF, CLIENTE o SISTEMA) desde `auth.uid()` y `actor_tipo_soporte()`. Ningún rol de API lo ejecuta. |
| `_trg_auditar_cambio()` | Trigger `AFTER` genérico. Guarda la fila antes y después: completa o solo las columnas vigiladas, siempre sin `updated_at`, `updated_by`, `created_at` ni secretos. Si nada auditable cambió, no escribe. Atrapa también las escrituras directas que no pasan por una RPC. Hay 44 tablas cubiertas (§3). |
| `origen` | `SQL`: sin petición HTTP (psql, pg_cron). `SISTEMA`: `service_role`. `PANEL`: sesión de usuario más el `x-request-id` que pone el servidor. `API`: sesión de usuario sin ese id, o sea, una llamada directa a PostgREST. Es indicativo: una cabecera se puede fabricar. |
| `x-request-id` | Lo genera `src/proxy.ts` en cada petición y **sobrescribe** el que mande el navegador. `src/lib/supabase/server.ts` lo reenvía a PostgREST. |
| `x-auditoria-motivo` | `src/lib/auditoria/motivo.ts` (`conMotivo`, `validarMotivo`) manda el motivo en base64 UTF-8. Así las RPC antiguas registran el motivo sin cambiar su firma: no hay `drop function` ni sobrecargas. La autorización no depende de esta cabecera. |
| Lectura | `auditoria_listar(negocio, entidad, accion, desde, hasta, limite, offset)` y `auditoria_entidades(negocio)` son SECURITY DEFINER. SuperSU ve todo. Cualquier otro usuario debe pasar un negocio del que sea dueño (`coalesce(is_barberia_de(...), false)`); si no, recibe `NO_AUTORIZADO`. El dueño no recibe `request_id` ni el nombre del SuperSU que actuó. |
| RLS | `auditoria_select_negocio` se re-crea como `negocio_id is not null and coalesce(is_barberia_de(negocio_id), false)`. Se mantienen `auditoria_select_supersu` y `auditoria_select_actor`. |
| Inmutabilidad | Se mantiene el trigger de la 117 contra UPDATE y DELETE, y se agrega uno a nivel de sentencia contra TRUNCATE (los triggers de fila no lo atrapan). `anon` y `authenticated` quedan sin INSERT, UPDATE, DELETE ni TRUNCATE. `service_role` conserva **solo INSERT**, porque lo usan `src/lib/auth/identity-events.ts` y `src/lib/pagos/sincronizar.ts`. |

**Pantallas:**
- `/admin/auditoria`: filtros por negocio (buscador), entidad, acción y fechas (hora de Colombia), paginación de 50 en 50 y detalle campo a campo (antes → después) con motivo, origen y petición.
- `/panel/auditoria`: lo mismo, pero el negocio sale de la sesión en el servidor (`resolverContexto`), nunca del navegador, y la RPC lo vuelve a verificar.
- `/admin/planes`: pide el **motivo obligatorio** (mínimo 5 caracteres; se valida en el cliente y en la server action).

## 2. Matriz de cobertura

Leyenda:
- **COMPLETA**: antes, después y motivo.
- **ANTES/DESPUÉS**: con valor anterior y nuevo, pero sin motivo porque la acción no lo pide.
- **PARCIAL**: solo el nombre de la acción, o falta el antes.
- **NINGUNA**: no deja fila.
- **SIN CAMBIO**: se dejó como estaba, por diseño.
- **PENDIENTE**: sigue faltando.

### 2.1 Super Admin (`src/app/admin/**`)

| # | Ruta y acción | RPC o tabla | Antes de la 123 | Qué se hizo | Ahora |
|---|---|---|---|---|---|
| S1 | `/admin` aprobar | `aprobar_negocio` | PARCIAL (antes y después del estado, sin motivo) | Trigger `negocio` (fila completa) | ANTES/DESPUÉS |
| S2 | `/admin` rechazar | `rechazar_negocio` | COMPLETA | Trigger `negocio` | COMPLETA |
| S3 | `/admin` suspender | `suspender_negocio` | COMPLETA | Trigger `negocio` | COMPLETA |
| S4 | `/admin` reactivar | `reactivar_negocio_supersu` | PARCIAL | Trigger `negocio` | ANTES/DESPUÉS |
| S5 | `/admin` cancelar | `cancelar_negocio_supersu` | COMPLETA | Trigger `negocio` y `suscripcion` | COMPLETA |
| S6 | `/admin` marcar en mora | `marcar_negocio_en_mora` | COMPLETA | Trigger `suscripcion` | COMPLETA |
| S7 | `/admin` forzar reactivación | `forzar_reactivacion_pago_externo` | PARCIAL (motivo, sin antes) | Trigger `suscripcion` y `negocio` | COMPLETA |
| S8 | `/admin/negocios` activación manual | `admin_activar_negocio_manual` | COMPLETA | Trigger `suscripcion` | COMPLETA |
| S9 | `/admin/moderacion` | `moderar_resena` | PARCIAL (motivo) | Trigger `resena` (estado) | COMPLETA |
| S10 | `/admin/planes` país | `admin_set_pais` | PARCIAL (solo acción) | Trigger `pais` y motivo obligatorio en la UI | COMPLETA |
| S11 | `/admin/planes` precio | `admin_set_plan_precio` | PARCIAL | Triggers `plan` y `plan_precio`, motivo | COMPLETA |
| S12 | `/admin/planes` Mi Marca | `admin_set_addon_precio` | PARCIAL | Trigger `addon_precio`, motivo | COMPLETA |
| S13 | `/admin/planes` características | `admin_set_plan_caracteristica` | PARCIAL | Trigger `plan_caracteristica`, motivo | COMPLETA |
| S14 | `/admin/configuracion` plan | `actualizar_plan` | PARCIAL | Trigger `plan` | ANTES/DESPUÉS |
| S15 | `/admin/configuracion` tarifas de ads | `actualizar_tarifas_ads` | PARCIAL | Trigger `configuracion_plataforma` | ANTES/DESPUÉS |
| S16 | `/admin/configuracion` y `/admin/reglas` comisión global | `actualizar_comision_plataforma_global` | PARCIAL (antes, sin motivo) | Trigger `configuracion_plataforma` | ANTES/DESPUÉS |
| S17 | `/admin/configuracion` ciudades | `actualizar_ciudad_habilitada` | PARCIAL | Trigger `ciudad_habilitada` | ANTES/DESPUÉS |
| S18 | `/admin/configuracion` banners | `crear_banner_home`, `actualizar_banner_home`, `eliminar_banner_home` | PARCIAL | Trigger `banner_home` | ANTES/DESPUÉS |
| S19 | `/admin/configuracion` texto legal | `publicar_texto_legal` | PARCIAL | Trigger `texto_legal` (sin `contenido`, que es enorme; queda tipo, versión y cambio material) | ANTES/DESPUÉS |
| S20 | `/admin/ai` modelos | `actualizar_modelo_config_ia` | NINGUNA | Trigger `ai_modelo_config` | ANTES/DESPUÉS |
| S21 | `/admin/ai` paquetes | `actualizar_paquete_creditos_ia` | NINGUNA | Trigger `ai_paquete_creditos` | ANTES/DESPUÉS |
| S22 | `/admin/ai` funciones por plan | `configurar_funcion_plan_ia` | NINGUNA | Trigger `plan_funcion_ia` | ANTES/DESPUÉS |
| S23 | `/admin/ai` costo por acción | `actualizar_accion_costo_ia` | PARCIAL | Trigger `ai_accion_costo` | ANTES/DESPUÉS |
| S24 | Sin UI (SQL directo) | `feature_flag` | NINGUNA | Trigger `feature_flag` (origen SQL, actor SISTEMA) | ANTES/DESPUÉS |
| S25 | Sin UI (SQL directo) | `perfil.es_supersu` | NINGUNA | Trigger `update of es_supersu` (escalamiento de privilegios) | ANTES/DESPUÉS |
| S26 | `/admin/reglas` prueba | `admin_set_config_prueba` | COMPLETA | Trigger `configuracion_plataforma` | COMPLETA |
| S27 | `/admin/reglas` límites de la política | `admin_set_limites_politica` | COMPLETA | Trigger `configuracion_plataforma` | COMPLETA |
| S28 | `/admin/reglas` comisión programada | `admin_programar_comision`, `admin_anular_comision_programada` | COMPLETA | Trigger `negocio` cuando se aplica | COMPLETA |
| S29 | `/admin/reglas` reintentar reembolso | `admin_reintentar_reembolso` | NINGUNA | Trigger `reembolso` (estado) | ANTES/DESPUÉS (el `p_motivo` de la RPC no llega a la fila; ver §4) |
| S30 | `/admin/lealtad` fraude | `marcar_fraude_revisado` | NINGUNA | Trigger `lealtad_fraude_evento` (`revisado`) | ANTES/DESPUÉS |
| S31 | `/admin/soporte` estado | `actualizar_estado_ticket` | PARCIAL (antes) | Trigger `ticket_soporte` (estado) | ANTES/DESPUÉS |
| S32 | `/admin/whatsapp` (5 acciones) | RPC de la 120 | COMPLETA | — | COMPLETA |
| — | `/admin/soporte` responder | `responder_ticket_soporte` | — | No aplica: es conversación y queda en el propio ticket | — |

### 2.2 Panel del negocio (`src/app/panel/**`) y app de staff

| # | Ruta y acción | RPC o tabla | Antes de la 123 | Qué se hizo | Ahora |
|---|---|---|---|---|---|
| P1 | `/panel/staff` invitaciones | `crear_invitacion_staff`, `reenviar_invitacion`, `cancelar_invitacion` | PARCIAL (acción) | Nada: la tabla guarda el email del invitado y la acción basta | SIN CAMBIO |
| P2 | `/panel/staff` Guardian | `promover_guardian`, `revocar_guardian` | PARCIAL (antes) | Trigger `vinculo_staff_negocio` | ANTES/DESPUÉS |
| P3 | `/panel/staff` suspender o retirar | `suspender_staff`, `retirar_staff` | PARCIAL (motivo) | Trigger `vinculo_staff_negocio` | COMPLETA |
| P4 | `/panel/staff` reactivar | `reactivar_staff` | PARCIAL | Trigger `vinculo_staff_negocio` | ANTES/DESPUÉS |
| P5 | `/panel/sedes` trasladar staff | `trasladar_staff` | PARCIAL (antes) | Trigger `vinculo_staff_negocio` (`sede_activa_id`) | ANTES/DESPUÉS |
| P6 | `/panel/servicios` CRUD (directo) | `servicio` | NINGUNA | Trigger `servicio` | ANTES/DESPUÉS |
| P7 | `/panel/servicios` combos (directo) | `servicio_combo` | NINGUNA | Trigger `servicio_combo` | ANTES/DESPUÉS |
| P8 | `/panel/servicios` ítems del combo | `servicio_combo_item` | NINGUNA | — | PENDIENTE (sin `negocio_id`) |
| P9 | `/panel/servicios` asignar staff | `staff_servicio` | NINGUNA | — | PENDIENTE (sin `negocio_id`) |
| P10 | `/panel/sedes` crear, editar (directo), principal, reabrir | `crear_sede`, `sede`, `establecer_sede_principal`, `reabrir_sede` | PARCIAL | Trigger `sede` | ANTES/DESPUÉS |
| P11 | `/panel/sedes` cerrar | `cerrar_sede` | PARCIAL (motivo) | Trigger `sede` | COMPLETA |
| P12 | `/panel/sedes` excepciones de horario | `sede_horario_excepcion` | NINGUNA | — | PENDIENTE (sin `negocio_id`) |
| P13 | `/panel/pos` productos (directo) | `producto` | NINGUNA | Trigger `producto` | ANTES/DESPUÉS |
| P14 | `/panel/inventario` stock | `ajustar_stock`, `configurar_stock_minimo`, `registrar_movimiento_inventario`, `atender_solicitud_reposicion` | NINGUNA | — | PENDIENTE (la traza es el libro `movimiento_inventario`; `producto_stock` es de alto volumen) |
| P15 | `/panel/inventario` solicitudes y consumo (directo) | `solicitud_reposicion`, `servicio_producto_consumo` | NINGUNA | — | PENDIENTE |
| P16 | `/panel/crm` notas y etiquetas | `cliente_nota`, `cliente_etiqueta` | NINGUNA | Triggers (sin el texto libre de la nota, que es dato personal) | ANTES/DESPUÉS |
| P17 | `/panel/crm` fotos | `reserva_foto` | NINGUNA | Trigger (sin la URL) | ANTES/DESPUÉS |
| P18 | `/panel/lealtad` configuración | `crear_campana_sellos`, `alternar_campana_sellos`, `crear_regla_cashback`, `alternar_regla_cashback`, `crear_plan_membresia`, `alternar_plan_membresia`, `crear_regla_recompensa`, `configurar_referidos`, `sembrar_niveles_vip_default` | NINGUNA (salvo membresía, que registraba la acción) | Triggers `sello_campana`, `cashback_regla`, `membresia_plan`, `recompensa_regla`, `referido_config`, `vip_nivel` | ANTES/DESPUÉS |
| P19 | `/panel/lealtad` bloquear gift card | `bloquear_gift_card` | PARCIAL (motivo) | Trigger `gift_card` (estado; sin `pin_hash`) | COMPLETA |
| P20 | `/panel/lealtad` cuenta corporativa | `crear_cuenta_corporativa` | PARCIAL | Trigger `corporativo_cuenta` | ANTES/DESPUÉS |
| P21 | `/panel/lealtad` sugerencias IA | `crear_sugerencia_recompensa`, `confirmar_sugerencia_recompensa`, `descartar_sugerencia_recompensa`, `consumir_creditos_ia` | NINGUNA o PARCIAL | — | PENDIENTE (operativo; los créditos tienen su libro) |
| P22 | `/panel/ads` | `crear_campana_publicitaria`, `activar_campana`, `pausar_campana`, `finalizar_campana` | PARCIAL | Trigger `campana_publicitaria` (estado, presupuesto y fin; no los contadores de gasto) | ANTES/DESPUÉS |
| P23 | `/panel/agenda` cancelar y no-show | `cancelar_reserva`, `marcar_no_show` | PARCIAL (motivo) | Trigger `reserva` (solo estado) | COMPLETA |
| P24 | `/panel/agenda` reprogramar y reasignar | `reprogramar_reserva`, `reasignar_staff_reserva` | COMPLETA | — | COMPLETA |
| P25 | `/panel/agenda` reserva manual | `crear_reserva_manual` | PARCIAL (acción) | Nada: la creación de reservas no se audita fila a fila | SIN CAMBIO |
| P26 | `/panel/agenda` bloqueos | `bloqueo_ausencia` | NINGUNA | — | PENDIENTE (sin `negocio_id`) |
| P27 | `/panel/pos` cerrar venta | `completar_venta_pos` | NINGUNA | Triggers `reserva` y `pago` (estado) | ANTES/DESPUÉS |
| P28 | `/panel/pos` caja menor | `registrar_egreso_caja`, `anular_egreso_caja` | COMPLETA | — | COMPLETA |
| P29 | `/panel/pos` redimir gift card | `redimir_gift_card_pos` | PARCIAL | Trigger `gift_card` (cambio de estado al agotarse) | ANTES/DESPUÉS |
| P30 | `/panel/politica` | `configurar_politica_cancelacion` | COMPLETA | Trigger `negocio` | COMPLETA |
| P31 | `/panel/suscripcion` | `solicitar_upgrade_plan`, `solicitar_downgrade_plan`, `cancelar_downgrade_programado`, `crear_suscripcion_inicial`, `iniciar_prueba_negocio_srv`, `elegir_pais_negocio` | PARCIAL | Triggers `suscripcion` y `negocio` | ANTES/DESPUÉS |
| P32 | `/panel/suscripcion` cancelar cuenta | `cancelar_negocio_propio` | COMPLETA | Triggers | COMPLETA |
| P33 | `/panel/cobros` desconectar | `conexion_desconectar` | PARCIAL (motivo) | Trigger `conexion_pago_negocio` (sin tokens; probado) | COMPLETA |
| P34 | `/panel/marca` | `guardar_marca_negocio`, `negocio.logo_url` | NINGUNA | Triggers `negocio_marca` y `negocio` | ANTES/DESPUÉS |
| P35 | `/panel/onboarding` | `negocio` y `sede` (directo), `enviar_negocio_a_aprobacion` | NINGUNA o PARCIAL | Triggers `negocio` y `sede` | ANTES/DESPUÉS |
| P36 | `/panel/ia` | memoria, prompts y compra de créditos | NINGUNA o PARCIAL | — | PENDIENTE (la memoria tiene su propio historial de versiones) |
| P37 | `/panel/reportes` reseñas | `resena.respuesta_negocio` (directo), `reportar_resena` | NINGUNA o PARCIAL | Trigger `resena` | ANTES/DESPUÉS |
| P38 | `/panel/whatsapp` | RPC de la 120 | COMPLETA | — | COMPLETA |
| P39 | `/staff/perfil` | `disponibilidad`, `bloqueo_ausencia`, `staff` | NINGUNA | — | PENDIENTE (autogestión del staff; sin `negocio_id`) |
| — | `/panel/soporte`, `/panel/marca` tickets | `crear_ticket_soporte`, `responder_ticket_soporte` | — | No aplica | — |

### 2.3 Totales

Son 71 filas; se excluyen las dos que no aplican.

| | Antes de la 123 | Después de la 123 |
|---|---|---|
| COMPLETA | 14 | **25** |
| ANTES/DESPUÉS | — | **35** |
| PARCIAL | 31 | — |
| NINGUNA | 26 | — |
| SIN CAMBIO (por diseño) | — | 2 |
| PENDIENTE | — | **9** |

## 3. Tablas con trigger de auditoría (44)

- **Configuración global, fila completa:** `pais`, `plan`, `plan_precio`, `plan_caracteristica`, `addon_precio`, `feature_flag`, `configuracion_plataforma`, `ai_modelo_config`, `ai_paquete_creditos`, `ai_accion_costo`, `plan_funcion_ia`, `ciudad_habilitada`, `banner_home`, `texto_legal` (sin `contenido`).
- **Privilegios:** `perfil` (`es_supersu`).
- **Negocio y comerciales:**
  - `negocio`;
  - `suscripcion` (estado, plan, ciclo, prueba, gracia, activación manual; sin `metodo_pago_ref`);
  - `vinculo_staff_negocio` (rol, estado, comisión, sede);
  - `conexion_pago_negocio` (estado y cuenta; nunca tokens).
- **Solo cambios de estado:** `reserva`, `pago`, `gift_card`, `resena`, `reembolso`, `campana_publicitaria`, `lealtad_fraude_evento`, `ticket_soporte`.
- **Configuración del negocio:** `servicio`, `servicio_combo`, `producto`, `sede`, `membresia_plan`, `referido_config`, `cashback_regla`, `sello_campana`, `recompensa_regla`, `vip_nivel`, `negocio_addon`, `negocio_marca`, `oferta_negocio`, `corporativo_cuenta`, `reserva_foto`, `cliente_nota` (sin texto), `cliente_etiqueta`.

**Sin trigger, a propósito:**
- Creación de reservas y otras tablas de alto volumen: `producto_stock`, contadores de ads y libros que ya son traza (`movimiento_inventario`, `wallet_movimiento`, `credito_ia_consumo`).
- Tablas de WhatsApp: la 120 ya audita antes, después y motivo.

## 4. Pendiente y por qué

1. **Motivo en `/admin/configuracion` y `/admin/ai`.** Ya tienen antes y después, pero sus formularios no piden motivo. La infraestructura existe: basta con `conMotivo(supabase.rpc(...), motivo)` y un campo de motivo como el de `/admin/planes`. No se hizo para no tocar dos UIs grandes (528 y 362 líneas) sin revisión de diseño.
2. **`admin_reintentar_reembolso`.** Recibe `p_motivo`, pero no lo escribe en la auditoría. El trigger registra el cambio de estado sin motivo. Corregirlo exige reescribir la RPC de la 116 dentro de una migración nueva.
3. **Tablas sin `negocio_id`:** `servicio_combo_item`, `staff_servicio`, `sede_horario_excepcion`, `bloqueo_ausencia`, `disponibilidad`, `servicio_producto_consumo`. Para auditarlas hay que derivar el negocio con un join (combo, sede, vínculo) en un trigger específico. Riesgo bajo: son configuraciones operativas.
4. **Inventario, IA del panel y sugerencias de recompensa.** Tienen libros propios (`movimiento_inventario`, historial de memoria, `credito_ia_consumo`). Falta decidir si además deben ir a `evento_auditoria`.
5. **`origen` es indicativo.** `PANEL` y `API` se distinguen por una cabecera que un tercero con sesión puede fabricar. Para hacerlo inviolable, habría que firmarla con un secreto del servidor.
6. **Producción.**
   - Aplicar la 123 después de la 121.
   - Verificar que PostgREST publique `request.headers`. Las versiones actuales de Supabase lo hacen; en local se emuló con `set_config`.
   - Al desplegar el código, `x-request-id` se llena solo.

## 5. Cómo verificar

```
docker exec -i supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -1 < supabase/migrations/123_auditoria_completa.sql
docker exec -i supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < tests/sql/auditoria_123.sql
npx vitest run tests/auditoria.test.ts
```
