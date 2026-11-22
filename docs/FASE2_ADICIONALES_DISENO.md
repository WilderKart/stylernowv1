# FASE 2 — Barberos adicionales y su cobro: auditoría, investigación y diseño

Fecha: 2026-11-18. Rama: `feat/onboarding-v2`. Alcance de este documento: SOLO lectura del repo y de la base local (SELECT), más lectura de documentación oficial de Mercado Pago. No se tocó código, migraciones ni base. No se consultó producción ni Vercel. No se imprimió ningún secreto (solo nombres de variables).

Convenciones: **VERIFICADO** = visto en código/base local o en documentación oficial citada. **NO VERIFICADO** = inferido o no comprobable sin llamar a la API con credenciales. **PROPUESTA** = valor o diseño recomendado, no es una decisión del usuario.

---

## 0. Resumen ejecutivo

1. **Preapproval (Suscripciones) existe y Colombia figura entre los países disponibles** (VERIFICADO, doc oficial). Admite tarjeta de crédito/débito y dinero en cuenta de Mercado Pago en la página comercial de Colombia (VERIFICADO); PSE/Efecty aparecen en una tabla general de la documentación pero NO está confirmado que apliquen a suscripciones (NO VERIFICADO). Que la cuenta de StylerNow tenga el producto habilitado, y que funcione con credenciales de PRUEBA, NO está verificado: requiere el script de la sección 2.9.
2. **Hallazgo crítico en el código actual: un cobro recurrente de Preapproval, entrando por el webhook actual (`topic=payment`), sería tratado como HUÉRFANO y REEMBOLSADO automáticamente** (`sincronizar.ts:350-397`: `external_reference` que no es el UUID de un `pago` → `WEBHOOK_HUERFANO` + `reembolsar(...)` cuando la cuenta es la de StylerNow). Hay que aislar el origen de esos eventos (aplicación de Mercado Pago propia o despachador previo) antes de cobrar nada recurrente. Ver 3.9.
3. **Hallazgo crítico en la base local: `aplicar_evento_pago` rama `SUSCRIPCION` + APROBADO** hace `update suscripcion set plan_codigo = (metadata->>'plan_codigo_nuevo')::plan_codigo`. Un pago con `metadata.concepto='STAFF_EXTRA'` no trae `plan_codigo_nuevo` → `plan_codigo = NULL` viola NOT NULL → el RPC falla → el webhook responde 500 y Mercado Pago reintenta en bucle. Hay que ramificar por `concepto` en esa función (migración propia, con prueba de regresión del flujo de planes).
4. **Hallazgo: `solicitar_pago_plan` (133, líneas 85-94)** lanza `PAGO_SUSCRIPCION_EN_PROCESO` si existe CUALQUIER pago `SUSCRIPCION` pendiente: un cobro pendiente de barbero adicional bloquearía el pago del plan (y al revés si se reutiliza). Hay que acotarlo a `concepto in ('PLAN') or null`.
5. **Hallazgo: `_capacidad_profesional` ya es el punto único**, pero cuatro llamadores pasan `p_adicionales = 0` explícito (`trg_vinculo_cupo`, `trg_invitacion_cupo`, `crear_invitacion_staff`, `responder_invitacion`, 152 líneas 97, 117, 183, 214). Cambiar la función para que **ella misma** sume los adicionales activos del negocio evita tocar a los llamadores (sección 3.6).
6. **El precio 51.900 COP NO existe en la configuración actual.** Local: `plan_precio.precio_staff_extra` = 20.000 (ESSENTIAL, STUDIO) y 15.000 (PRESTIGE); `plan.staff_addon_precio` igual (SIGNATURE nulo); `addon_precio` solo tiene `MI_MARCA` (CHECK). `negocio_addon` está vacío (0 filas) y su CHECK local ya admite `STAFF_EXTRA` y `SEDE_EXTRA` (la hipótesis "solo MI_MARCA" aplica a `addon_precio`, no a `negocio_addon`). Los valores 20.000/15.000 son legado y contradicen la decisión de 51.900: se propone tabla nueva de tarifa versionada (3.1) y dejar el legado sin leer.
7. **Recomendación principal:** construir primero la **modalidad A (Checkout Pro mensual manual)** completa, con máquina de estados, tarifa editable, cron y CRM; la **modalidad B (Preapproval)** va detrás de una bandera por país y solo se activa tras pasar el script de sandbox y obtener credenciales/aplicación propia. Modelo de contratación por **lotes** (una fila por compra, con su propio ciclo, precio congelado y, en B, su propio preapproval de monto fijo): elimina el prorrateo y la dependencia de cambiar el monto de un preapproval vivo (comportamiento NO VERIFICADO).

---

## 1. Auditoría de lo existente que se reutiliza

### 1.1 Flujo de pago de plan (migración 133, `supabase/migrations/133_pago_plan_checkout_pro_y_gracia.sql`)
- `_precio_plan_ciclo` (l. 24-48): precio calculado en base desde `plan_precio`; mensual con descuento fundador (l. 43-44). Solo service_role.
- `solicitar_pago_plan(negocio, plan, ciclo)` (l. 51-109): `security definer`, exige `is_barberia_de` (propietario), bloquea CANCELADA, SUSPENDIDA por infracción, `activacion_manual`, renovación solo dentro de 7 días del vencimiento (l. 71). Idempotente: reutiliza el pago PENDIENTE igual de <2 h (l. 89-92). Inserta `pago` tipo `SUSCRIPCION` con `metadata.concepto='PLAN'` (l. 98-102) y auditoría `PAGO_PLAN_SOLICITADO`. `revoke ... from public, anon, authenticated` y luego `grant ... to authenticated, service_role` (l. 110-111): el propietario la invoca directo; el control está dentro (`is_barberia_de`).
- `trg_pago_plan_activar` (l. 114-156): AFTER UPDATE de `pago.estado`, `WHEN tipo='SUSCRIPCION' and estado='APROBADO' and concepto='PLAN'`; no pierde días pagados (l. 127-131), pone `reintentos_fallo_count=0`, audita `PLAN_PAGADO`. **No se activa para otro concepto** (bueno: un STAFF_EXTRA no lo dispara).
- `mantenimiento_suscripciones` (l. 159-215): lee `configuracion_plataforma.suscripcion_gracia_dias` (3), mueve TRIAL/ACTIVA vencidas → EN_MORA con `gracia_fin`, gracia vencida → REQUIERE_PLAN o SUSPENDIDA(IMPAGO), cierra fundadores, vence activaciones manuales.
- App: `src/app/panel/suscripcion/actions.ts` `iniciarPagoPlan` (l. ~221-250): RPC → `crearPreferenciaDePago({pagoId,...})` (`src/lib/pagos/cobro.ts`) → URL de Checkout Pro; retorno `?desde=pago`. El estado lo confirma solo webhook/conciliación.

### 1.2 `pago`, `cuenta_cobro`, beneficiario (base local, SELECT)
- `pago` (columnas): `tipo pago_tipo`, `monto`, `estado pago_estado`, `pasarela`, `id_transaccion_pasarela` (UNIQUE), `id_preferencia_pasarela`, `payload_pasarela`, `metadata jsonb`, `cuenta_cobro` (PLATAFORMA|NEGOCIO), `conexion_pago_id`, `entorno` (SANDBOX|PRODUCCION). Enums: `pago_tipo` = SENA, SALDO, PROPINA, GIFT_CARD, MEMBRESIA, PAQUETE_CREDITOS_IA, PAQUETE_CONVERSACIONES_WHATSAPP, SUSCRIPCION; `pago_estado` = PENDIENTE, APROBADO, RECHAZADO, REEMBOLSADO, REEMBOLSADO_PARCIAL, EN_DISPUTA.
- `beneficiario_pago(tipo)`: SUSCRIPCION → PLATAFORMA. `trg_pago_cuenta_cobro` (BEFORE INSERT) fija `cuenta_cobro='PLATAFORMA'` y `conexion_pago_id=null` para SUSCRIPCION. Triggers de inmutabilidad: `trg_pago_cuenta_inmutable`, `trg_pago_entorno_inmutable`, `trg_pago_proteger_historial` (monto/tipo/negocio/`id_transaccion_pasarela` inmutables salvo rol postgres/supabase_admin). Libro: `trg_libro_pago` → `_libro_desde_pago` (SUSCRIPCION cae en categoría `PAGO_A_STYLERNOW`, 122 l. 120-125). Notificación: `trg_notif_pago`.
- Consecuencia: **reutilizar `tipo='SUSCRIPCION'` + `metadata.concepto='STAFF_EXTRA'`** hereda beneficiario PLATAFORMA, cuenta_cobro, libro, entorno e inmutabilidad sin tocar esas funciones (un tipo nuevo exigiría `ALTER TYPE ... ADD VALUE` en migración aparte y editar `beneficiario_pago`, `_libro_categoria_pago`, `trg_notif_pago`, `cobro.ts`). Recomendado: mantener SUSCRIPCION + concepto.

### 1.3 Webhook, sincronización, `aplicar_evento_pago` (solo descripción)
- `src/app/api/webhooks/mercadopago/route.ts` es un envoltorio (POST → `procesarWebhookMercadoPago`); también existe `/api/webhooks/pasarela/mercadopago`.
- `src/lib/pagos/webhook-mercadopago.ts` (NO se propone modificarlo): (1) `verificarFirma` HMAC con `x-signature`, `x-request-id` (de `x-request-id-origen` puesto por el proxy), `data.id` (l. 73); 401 si inválida; 503 si falta secreto en producción; (2) `webhook_registrar(proveedor, request_id, ...)` idempotente: `insert ... on conflict (proveedor, request_id)` y devuelve `procesado_at is null` (l. 114-125); (3) consulta a Mercado Pago; (4) efecto. `normalizarTipo` (l. 31-43) solo conoce payment, merchant_order, chargebacks, claims, mp-connect, fraude, order; **todo lo demás (p. ej. `subscription_preapproval`, `subscription_authorized_payment`) cae en `default` → resultado `IGNORADO:<tópico>` y 200** (l. 199-202). O sea: hoy esos eventos se descartan en silencio, sin daño.
- Anti-replay: `VENTANA_FIRMA_MS = 15 min` (`mercadopago.ts:275`, `tsDentroDeVentana`). Mercado Pago reintenta cada 15 min si no recibe 200 (doc oficial); un reintento con `ts` viejo puede caer fuera de ventana y recibir 401. Mitigación: conciliación diaria (sección 3.11).
- `sincronizar.ts`: `sincronizarNotificacion` consulta el pago en MP, mapea por `external_reference` = UUID de `pago` (l. 324-337, 350-397); `aplicar` verifica entorno (`liveModeCoincide`) y cuenta, compara monto con `pago.monto` (tolerancia 1) y llama `aplicar_evento_pago`. `reconciliarPagosPendientes(30)` (l. 221) reconsulta pagos PENDIENTE; corre dentro del cron diario.
- `aplicar_evento_pago(p_pago_id, p_id_transaccion, p_estado, p_payload)` (base local): bloquea el pago (`for update`); si ya está APROBADO/RECHAZADO/REEMBOLSADO devuelve `YA_PROCESADO` (idempotencia); rama `SUSCRIPCION`: APROBADO → marca el pago, **actualiza `suscripcion.plan_codigo` desde `plan_codigo_nuevo` y `negocio.plan_codigo`**, audita `UPGRADE_APLICADO`; RECHAZADO → marca. El trigger `trg_pago_plan_activar` (solo concepto PLAN) hace el resto. Ver hallazgo 3 de la sección 0.

### 1.4 `entorno.ts` (`src/lib/pagos/entorno.ts`)
`entornoPagos()`: SANDBOX por defecto; PRODUCCION solo con `MERCADOPAGO_ENTORNO=produccion` Y `VERCEL_ENV=production` (l. 17-26). `validarTokenParaEntorno` rechaza `TEST-` en producción. `liveModeCoincide`. `CAPACIDADES_MERCADOPAGO_CO` (l. ~74-86) declara medios VERIFICADOS para Checkout Pro (credit/debit/account_money) y PSE/Efecty `NO_VERIFICADO_EXCLUIDO`. Variables (solo nombres): `MERCADOPAGO_ACCESS_TOKEN` (`mercadopago.ts:20`), `MERCADOPAGO_WEBHOOK_SECRET`, `MERCADOPAGO_ENTORNO`, `MERCADOPAGO_PSE_NEGOCIOS`, `CRON_SECRET`, `RESEND_API_KEY`.

### 1.5 Mantenimiento y cron
- `src/app/api/cron/diario/route.ts`: Bearer `CRON_SECRET`; ejecuta en orden expirar reservas, downgrades, créditos IA, ROI, **`ejecutarCicloSuscripciones()` (l. 54)**, limpieza, recordatorios, eliminación de cuentas, comisiones, WhatsApp, **`reconciliarPagosPendientes(30)` (l. 99)**, reembolsos, **`procesarOutbox(200)` (l. 114)**, registros abandonados.
- **Frecuencia real: `vercel.json` → una sola entrada `{ "path": "/api/cron/diario", "schedule": "0 8 * * *" }` = 1 vez al día, 08:00 UTC (03:00 hora Colombia).** Implicaciones: la gracia, los reintentos y los avisos tienen granularidad de 1 día; avisos "N días antes" funcionan; reintentos "cada X horas" no son posibles con este cron (PROPUESTA: reintentos medidos en días).
- `src/lib/planes/ciclo-suscripciones.ts`: avisos de prueba por Resend directo (`enviarCorreo`, l. 17-31) + `mantenimiento_suscripciones` (l. 125). Cobro automático de pruebas **apagado** con `COBRO_AUTOMATICO_HABILITADO = false` (l. 119); `cobrarPruebasVencidas` y `proveedorDe(...).cobrarSuscripcion` son un camino legado por tarjeta guardada (todos los adaptadores devuelven `soportaCobroRecurrente: () => false`, `proveedores/adaptadores.ts`). No es reutilizable tal cual: apunta a la suscripción del plan, no a adicionales.
- `registrar_resultado_cobro(negocio, exito, motivo)` y `suscripcion.reintentos_fallo_count` pertenecen al camino legado del plan; el diseño de adicionales usa sus propias columnas.

### 1.6 Notificaciones y correos
- Outbox transaccional (124): tablas `notificacion_evento` (código, categoría, audiencia, `esencial`, descripciones es/en), plantillas por idioma (`es`/`en`), `_notif_encolar_canales(evento, usuario, negocio, datos, clave_idempotencia, canales[])` → `_encolar_notificacion`; cola con `idempotency_key`, `intentos`, `max_intentos`, `proximo_intento_at`; el worker `procesarOutbox` (`src/lib/notificaciones/worker.ts`) corre en el cron diario. Canales EMAIL/PUSH/PANEL. Ejemplo a imitar: `trg_notif_suscripcion` (envuelve en `exception when others then null` para que un fallo de aviso nunca revierta el cambio de estado) con eventos `SUSCRIPCION_VENCIDA`, `SUSCRIPCION_SUSPENDIDA`, `SUSCRIPCION_REACTIVADA`, `SUSCRIPCION_PRUEBA_POR_TERMINAR`.
- Conclusión: los avisos de adicionales deben usar este outbox (eventos nuevos sembrados por migración con plantillas es/en), no el `enviarCorreo` directo.

### 1.7 CRM SuperAdmin: `admin/planes` y `admin/reglas`
- `src/app/admin/planes/actions.ts`: `guardarPrecioPlan` (l. 202), `guardarPrecioAddon(pais, precio, motivo)` (l. 231) → RPC `admin_set_addon_precio(addon, pais, precio)` (hoy solo `MI_MARCA` por el CHECK de `addon_precio`; audita sin payload ni motivo: acción `ADDON_PRECIO_<addon>_<pais>`), `guardarAjustesPais` con `p_cobro_recurrente`/`cobro_recurrente_habilitado` por país (l. 161-185). UI `editor-planes.tsx` (Switch "Cobro recurrente").
- `src/app/admin/reglas/actions.ts`: `guardarConfigPrueba` (l. 192) escribe `configuracion_plataforma` (prueba_dias, `suscripcion_gracia_dias`, avisos); rechaza todo lo que no sea `SIN_TARJETA` (l. 195-197). Patrón: server action + zod + motivo + auditoría por trigger `_trg_auditar_cambio`.
- `configuracion_plataforma` (singleton, `id boolean`): ya tiene `suscripcion_gracia_dias`, `prueba_aviso_dias_1/2`, `staff_transicion_inicio/fin` (Fase 1). Es del plan, global, sin país: **no mezclar** la configuración de adicionales aquí (ver 3.1).
- Legado del precio de staff extra: `plan.staff_addon_precio` y `plan_precio.precio_staff_extra` se leen en `admin/configuracion/actions.ts:273-317`, `admin/planes/actions.ts:137,217`, `lib/planes/catalogo.ts:84`. Hoy NO se cobra a nadie (confirmado en el comentario de 152 l. 16-17).

### 1.8 Activación manual (090, `supabase/migrations/090_activacion_manual_supersu.sql`)
`admin_activar_negocio_manual(negocio, estado, plan, tipo, motivo, dias, referencia)`: solo `is_supersu()`, motivo ≥5 caracteres, tipos TRANSFERENCIA/CORTESIA/CONTINGENCIA_PASARELA, referencia obligatoria en transferencia, vigencia opcional, columnas `activacion_manual/manual_tipo/manual_hasta/manual_referencia` en `suscripcion`; auditoría. Es del PLAN, no de adicionales. Se replica el patrón (motivo + responsable + vigencia + auditoría) en una RPC propia para adicionales.

### 1.9 `negocio_addon` / `addon_precio` (base local)
- `negocio_addon(negocio_id, addon_codigo, cantidad>=1, activo, desde, hasta)`, UNIQUE `(negocio_id, addon_codigo)`, CHECK local: `MI_MARCA|STAFF_EXTRA|SEDE_EXTRA`, 0 filas, política SELECT propietario/SuperSU, escritura solo vía `activar_addon_negocio` (service_role/postgres; no expuesta a `authenticated`). `addon_precio`: CHECK `addon_codigo = 'MI_MARCA'`, precio por país (CO 29.900).
- No sirve como modelo de contratación: UNIQUE por (negocio, código) impide lotes, no guarda precio congelado, estado, pagos, preapproval ni historial. Se mantiene para MI_MARCA; los adicionales de barbero usan tablas propias (3.1) y NO se escribe en `negocio_addon` (evita doble fuente de verdad).

### 1.10 `cupo.ts`, `AvisoPlan`, función central (Fase 1, 151-153)
- `src/lib/planes/cupo.ts`: solo lee `cupo_plan_negocio` (RPC) → `staffTope`, `staffUsado`, `capacidad{limite, ocupados, disponibles, exceso, adicionales_contratados}`; `textoTopeStaff` dice "Para sumar más, actualiza a <plan siguiente> o habla con ventas" (l. 67-73): Fase 2 debe ofrecer "Contratar barbero adicional" aquí.
- `src/components/planes/aviso-plan.tsx`: aviso con botón a `/panel/suscripcion` (props `titulo, detalle, accion, href`). Se usa en `src/app/panel/staff/nuevo/page.tsx`. Reutilizable cambiando `accion`/`href` hacia la pantalla de adicionales.
- `_capacidad_profesional(p_negocio_id, p_plan_codigo, p_adicionales, p_excluir_email)` (152 l. 34-70): `limite = plan.staff_tope_absoluto + greatest(p_adicionales,0)`; ocupan cupo ACTIVO/SUSPENDIDO/INVITADO con `presta_servicios` + invitaciones PENDIENTE vigentes de BARBER/ADMIN_BARBER; `exceso = max(ocupados - limite, 0)`. Triggers `trg_vinculo_cupo` y `trg_invitacion_cupo` hacen cumplir el tope aunque se escriba directo (solo para roles `authenticated/anon`). Locks: `_cupo_bloquear` (advisory por negocio). Local: `staff_tope_absoluto` ESSENTIAL 1, STUDIO 5, PRESTIGE 15, SIGNATURE 50.

---

## 2. Investigación oficial de Mercado Pago Colombia (cobro recurrente)

Fuentes consultadas (todas `mercadopago.com.co/developers` salvo indicación):
- [S1] Visión general de Suscripciones: `/es/docs/subscriptions/overview`
- [S2] Referencia crear preapproval: `/es/reference/online-payments/subscriptions/create-preapproval/post`
- [S3] Sin plan, pago autorizado: `/es/docs/subscriptions/integration-configuration/subscription-no-associated-plan/authorized-payments` (y versión `/en/`)
- [S4] Sin plan, pago pendiente: `.../subscription-no-associated-plan/pending-payments`
- [S5] Con plan asociado: `/es/docs/subscriptions/integration-configuration/subscription-associated-plan`
- [S6] Gestión de suscripciones: `/es/docs/subscriptions/subscription-management` (y espejo `mercadopago.com.br/developers/en/docs/subscriptions/subscription-management.md`)
- [S7] Webhooks de suscripciones: `/en/docs/subscriptions/additional-content/your-integrations/notifications/webhooks`
- [S8] Card token: `/es/docs/subscriptions/additional-content/cardtoken`
- [S9] Cuentas de prueba: `/es/docs/subscriptions/additional-content/your-integrations/test/accounts`
- [S10] Referencia actualizar preapproval: `/en/reference/online-payments/subscriptions/update-preapproval/put`
- [S11] Referencia obtener pago autorizado: `/es/reference/online-payments/subscriptions/get-authorized-payment/get`
- [S12] Página comercial Colombia: `https://www.mercadopago.com.co/herramientas-para-vender/suscripciones`
- [S13] Tarjetas de prueba Colombia (ruta Adobe Commerce): `/en/docs/adobe-commerce/additional-content/your-integrations/test/cards`

### 2.1 Modalidades de integración
| Afirmación | Estado | Fuente |
|---|---|---|
| Existe la API de Suscripciones (Preapproval) con dos modalidades: con plan asociado (`POST /preapproval_plan` + `POST /preapproval` con `preapproval_plan_id`) y sin plan asociado (`POST /preapproval`) | VERIFICADO | S1, S5, S2 |
| Colombia está en la lista de países (AR, BR, CL, CO, MX, PE, UY) | VERIFICADO | S1 |
| Sin plan: `reason` y `external_reference` solo se exigen sin plan; `payer_email` es obligatorio siempre | VERIFICADO | S2 |
| Sin plan hay dos variantes: **pago autorizado** (`status=authorized` + `card_token_id`) y **pago pendiente** (`status=pending`, sin medio de pago; luego se actualiza con medio de pago por `PUT /preapproval/{id}` o se comparte un link de pago) | VERIFICADO | S3, S4 |
| Con plan: la suscripción "siempre deberá ser creada con su `card_token_id` y en status `authorized`" | VERIFICADO | S5 |
| Ejemplo de request usa `auto_recurring{frequency, frequency_type:"months", start_date, end_date, transaction_amount, currency_id:"COP"}`, `back_url`, `payer_email` | VERIFICADO (ejemplo, no descripción formal de campos) | S2 |
| El campo exacto que contiene la URL del checkout alojado (`init_point`) se devuelve en la respuesta | VERIFICADO (aparece en respuesta de ejemplo) | S2 |
| Qué medios acepta el checkout alojado de `init_point` en Colombia | NO VERIFICADO | S4 no lo dice |
| Existencia del campo `notification_url` en el body de `POST /preapproval` | NO VERIFICADO (no aparece en la referencia de Colombia) | S2 |

### 2.2 Medios de pago
- VERIFICADO (S12, página comercial Colombia): "Tus clientes pueden usar tarjeta de crédito y débito o dinero en Mercado Pago"; el cliente no necesita cuenta de Mercado Pago para pagar. Logos Visa, Mastercard, American Express, Diners, Codensa.
- VERIFICADO (S1): tabla comparativa general lista "Dinero en cuenta, tarjeta de crédito o débito, PSE, Efecty" pero la fila se repite igual para tres productos y no es específica de Colombia ni de cobro recurrente automático. **PSE para cobro recurrente: NO VERIFICADO (y por naturaleza un débito bancario por redirección no es tokenizable; no asumir).**
- Cuotas: no aplican a suscripciones (el soporte dice ignorar `installments`, dato del buscador sobre la guía de card token; NO VERIFICADO textual).

### 2.3 Tokenización
- VERIFICADO (S8): el `card_token` se genera en el frontend con MercadoPago.js (`mp.cardForm`) usando la clave pública; los datos de tarjeta nunca pasan por el servidor de StylerNow; el token "puede ser utilizado solo una vez y caduca en un plazo de 7 días". Implicación PCI: con el formulario de MercadoPago.js (campos alojados/seguros) StylerNow no almacena PAN ni CVV; solo guarda `preapproval_id`, marca y últimos 4 (obtenidos de la respuesta de MP; el campo exacto de últimos 4 en `preapproval`/`authorized_payment` es NO VERIFICADO: se espera `card_id`/`payment_method_id` en el preapproval y `card.last_four_digits` en el pago, por confirmar con el script).
- NO VERIFICADO: si la guía de card token de suscripciones exige credenciales productivas para la clave pública (un resumen de búsqueda lo sugiere; la página S8 no distingue). Debe probarse con la clave pública de prueba.

### 2.4 Cobros, reintentos propios, cancelación automática
VERIFICADO (S3 en/es):
- Para validar la tarjeta Mercado Pago hace un cobro de monto mínimo que luego devuelve; el monto varía según el país.
- Las cuotas (cobros) las programa el motor de suscripciones; la primera cuota se acredita ~1 hora después de suscribirse.
- Estados de cuota: `processed`, `waiting for gateway`, `recycling` (rechazada, en reintentos).
- **Reintentos de Mercado Pago:** hasta **4 reintentos dentro de una ventana de 10 días** (o hasta la fecha de expiración de la cuota).
- **Tras 3 cuotas rechazadas, la suscripción se cancela automáticamente** y el vendedor recibe un correo.
- El resultado de una cuota no afecta a las demás.
Consecuencia de diseño: el motor de reintentos de MP ya cubre ~10 días; la gracia propia de StylerNow debe contarse **desde la primera notificación de rechazo** y no sumar encima sin decidirlo (3.7). La cancelación automática por 3 rechazos debe mapearse a estado `PAGO_FALLIDO/EN_GRACIA` → `SUSPENDIDO` o `CANCELADO` con causa `CANCELADO_POR_MP`, nunca ignorarse.
NO VERIFICADO: calendario exacto de los 4 reintentos (días), si los rechazos "duros" (tarjeta robada/inválida) saltan los reintentos, y si el emisor de débito en Colombia permite reintentos.

### 2.5 Notificaciones / webhooks
VERIFICADO (S7):
- Tópicos de suscripciones: `subscription_preapproval` (alta/actualización de la suscripción; consulta `GET /preapproval/search`), `subscription_authorized_payment` (cobro recurrente; consulta `GET /authorized_payments/{id}`), `subscription_preapproval_plan` (planes), más `payment` (consulta `GET /v1/payments/{id}`) y `topic_claims_integration_wh`.
- URL configurada en "Tus integraciones > Webhooks > Configurar notificaciones", por aplicación, una URL de prueba y una de producción. Firma en `x-signature` (`ts=...,v1=...`) con clave secreta de la aplicación; responder 200/201 en ≤22 s; reintento cada 15 minutos hasta recibir respuesta (después de tres intentos se espacian pero siguen).
- La misma página dice: "Subscriptions integrations can't use this method. Use configuration during payment creation instead." **Su significado exacto es ambiguo** (¿no aplica el método de URL por panel con parámetro `?cliente=`? ¿se debe fijar la URL al crear la suscripción?). NO VERIFICADO; el script (2.9) debe averiguar si el panel entrega `subscription_*` y si `notification_url` se acepta al crear.
- NO VERIFICADO: formato del manifiesto de firma para `subscription_*` (se asume igual que pagos: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`, como ya implementa `verificarFirma`), el contenido exacto del cuerpo (`type`/`topic`, `data.id`, `action`), y si hay evento al cancelar/pausar.
- Un consejo del buscador (no verificado en la página): las notificaciones de pagos creados con credenciales de PRUEBA podrían no enviarse; probar recepción desde el simulador del panel ("Tus integraciones").

### 2.4b Cambio de estado, monto y medio de pago
VERIFICADO (S6, y S10 parcialmente):
- Pausar: `PUT /preapproval/{id}` con `status=paused`. Cancelar: `status=canceled`. Reactivar solo una suscripción en pausa (puede fijarse fecha límite). **Actualizar monto: `auto_recurring.transaction_amount` y `currency_id` por PUT.** Cambiar tarjeta: PUT con nuevo `card_token_id`. Medio secundario: `card_token_id_secondary` + `payment_method_id_secondary`. Búsqueda `GET /preapproval/search` (cualquier estado). En mensuales se puede fijar el día del mes de cobro; existe opción de monto proporcional para una suscripción.
- NO VERIFICADO (la doc dice "no describe restricciones"): desde qué estados se puede cambiar el monto, desde cuándo rige (¿próxima cuota o inmediata?), si exige re-autorización del pagador, si cambia el comportamiento de cuotas ya programadas, valores completos de `status`, y si "cancelado" se escribe `canceled` o `cancelled` en la respuesta (la doc usa `canceled`; el buscador dijo `cancelled` en otro punto: verificar). Si el cancelado es irreversible (suele serlo) → reactivar = nueva suscripción.
- NO VERIFICADO: si cancelar interrumpe de inmediato el cobro o si mantiene la cuota ya generada; el periodo ya pagado lo controla StylerNow con `vigente_hasta`, no Mercado Pago.

### 2.6 Facturas / pagos autorizados
VERIFICADO (S11): `GET /authorized_payments/{id}` devuelve `id`, `type:"scheduled"`, `preapproval_id`, `reason`, `external_reference`, `currency_id` (COP), `transaction_amount`, `debit_date`, `retry_attempt`, `status` (ejemplo `scheduled`; no enumera el resto), `summarized`, `payment{id,status,status_detail}`; hay búsqueda de facturas (`authorized-payment-search`). NO VERIFICADO: lista completa de `status`, y si `payment.id` es consultable por `GET /v1/payments/{id}` con el mismo token (probable).

### 2.7 Requisitos de cuenta y credenciales
- VERIFICADO (S1): cuenta de vendedor, una aplicación en el panel de integraciones y sus credenciales.
- NO VERIFICADO: si Suscripciones requiere activación/aprobación comercial adicional en la cuenta (los docs del repo `docs/PENDING_DECISIONS.md` l. 86-90 afirman "requiere habilitarlo en la cuenta comercial" sin fuente; no se encontró página oficial que lo confirme ni lo niegue — la página `/subscriptions/requirements` devolvió 404). Acción externa: preguntar a soporte/ejecutivo de Mercado Pago.
- NO VERIFICADO: si se puede crear una segunda aplicación para suscripciones bajo la misma cuenta (es la práctica habitual pero no se confirmó en las fuentes consultadas).

### 2.8 Pruebas con credenciales de PRUEBA
- VERIFICADO (S9): cuentas de prueba (hasta 15, país fijo al crearlas); se pueden usar credenciales de prueba de la aplicación; comprador y vendedor del mismo país. Tarjetas de prueba de Colombia: Visa/Mastercard/Amex, el **nombre del titular fija el resultado** (APRO aprobado, FUND fondos insuficientes, SECU código inválido...) (S13, ruta de Adobe Commerce; aplicabilidad a suscripciones NO VERIFICADA).
- S3 usa un access token `TEST-...` y el header `X-scope: stage` en su ejemplo de suscripción: **indicio de que existe un modo de pruebas para suscripciones; NO VERIFICADO para Colombia ni para `init_point`.** `entorno.ts` ya advierte que la documentación es contradictoria sobre el prefijo `TEST-`/`APP_USR-` de los tokens de prueba.
- NO VERIFICADO: si los cobros recurrentes se ejecutan en sandbox (se necesita esperar al motor de cobros; puede no correr), y si hay forma de forzar un cobro/rechazo.

### 2.9 Script de verificación inofensivo en sandbox (NO ejecutar aquí)
Archivo propuesto: `scripts/verificar-preapproval-sandbox.mjs` (no creado). Requisitos: variable `MP_PRUEBA_ACCESS_TOKEN` con credencial de PRUEBA (nunca producción; el script aborta si el token no cumple `validarTokenParaEntorno` en SANDBOX o si `VERCEL_ENV=production`), `MP_PRUEBA_PUBLIC_KEY`, correo de un comprador de PRUEBA. Nunca imprime tokens; solo estados, códigos HTTP y nombres de campos.
Pasos y resultado esperado (cada uno independiente; el script continúa y reporta tabla PASA/FALLA/NO CONCLUYENTE):
1. `GET /users/me` con el token → 200 y que el `site_id` sea `MCO` (confirma país/cuenta; no se imprime el id).
2. `POST /preapproval` sin plan, `status=pending`, `reason`, `external_reference=ADIC-<uuid de prueba>`, `payer_email` de prueba, `auto_recurring{1, months, transaction_amount: 1000, COP}`, `back_url`: esperado 201 con `id`, `init_point`, `status=pending`. Si responde 403/401 con mensaje de producto no habilitado → **Preapproval no está activo en la cuenta** (acción externa). Anota si acepta `notification_url` (enviar un segundo intento con ese campo; esperado: 201 sin error, o 400 "campo desconocido").
3. `GET /preapproval/{id}` y `GET /preapproval/search?external_reference=...`: esperado 200; anotar campos presentes (`card_id`, `payment_method_id`, `next_payment_date`, últimos 4 si existen).
4. Tokenizar una tarjeta de prueba con titular `APRO` mediante MercadoPago.js (requiere navegador; el script solo documenta el paso o usa `POST /v1/card_tokens` con la clave pública de prueba) y `POST /preapproval` con `status=authorized` + `card_token_id` y monto 1.000 COP: esperado 201 `status=authorized`. Probar también titular `FUND`: esperado rechazo o estado `pending`.
5. `PUT /preapproval/{id}` con `auto_recurring.transaction_amount: 2000`: esperado 200 y `GET` refleja el nuevo monto; **registrar si se exige estado o nueva autorización** (resuelve la duda monto variable vs lotes).
6. `PUT status=paused` → `PUT status=authorized` (reactivar) → `PUT status=canceled`: esperado 200 cada uno; luego intentar reactivar el cancelado: esperado error (si no, anotar). Confirmar la grafía exacta de `canceled`.
7. `GET /authorized_payments/search?preapproval_id=...`: esperado 200 con lista (puede estar vacía en sandbox).
8. Webhooks: crear una suscripción con `notification_url` apuntando a una URL de captura de prueba (p. ej. un endpoint local expuesto o un servicio de inspección sin datos sensibles) y verificar si llegan `subscription_preapproval`/`subscription_authorized_payment`, con qué cuerpo y cabeceras `x-signature`; verificar el manifiesto con el secreto de la aplicación de prueba.
9. Limpieza: cancelar todas las suscripciones creadas.
Resultado: documento `docs/FASE2_VERIFICACION_PREAPPROVAL.md` (futuro) con la tabla; hasta entonces todo lo "NO VERIFICADO" de arriba sigue así.

### 2.10 Monto variable vs un preapproval por adicional
| Criterio | Un preapproval por negocio, monto variable | Un preapproval por lote (monto fijo) |
|---|---|---|
| Depende de comportamiento NO VERIFICADO (PUT de monto, desde cuándo rige, re-autorización) | Sí, de forma central | No: nunca se cambia el monto |
| Precio congelado ("no cambiar en silencio") | Hay que impedir que un cambio de cantidad cambie también el precio unitario | Automático: cada lote conserva su tarifa y su autorización |
| Agregar barbero a mitad de ciclo | Requiere prorrateo y cobro puntual aparte | El lote nuevo empieza su ciclo hoy; sin prorrateo |
| Cancelar | Reducir monto o cancelar todo; más lógica | Cancelar un lote concreto; "tan fácil como contratar" |
| Cargos en la tarjeta | Uno mensual | Uno por lote (varios cargos si hay varios lotes) |
| Costo de validación de tarjeta y autorizaciones | Una | Una por lote (mitigable reutilizando `card_id`: NO VERIFICADO) |
| Complejidad de conciliación | Media | Media-baja (1 lote = 1 preapproval = 1 ciclo) |

**Recomendación:** lotes, con `cantidad` por lote (p. ej. comprar 3 a la vez = un lote de 3 por 3 × precio). Consolidar a monto variable queda como optimización futura solo si el script demuestra que el PUT de monto es seguro. Costo asumido: un negocio con varias compras a lo largo del tiempo ve varias renovaciones en fechas distintas.

### 2.11 Alternativas si Preapproval no sirve (o no está habilitado)
1. **Solo modalidad A** (Checkout Pro mensual manual) con recordatorios del outbox 7/3/1 días antes y renovación con un clic. Ya soportada por el 100 % del código de pagos actual. Es el camino de menor riesgo y debe estar completo y probado primero.
2. Preapproval **con pago pendiente** + `init_point` (checkout alojado de MP): si el checkout alojado de Colombia acepta tarjeta, StylerNow ni siquiera toca MercadoPago.js ni card tokens (menos superficie PCI). Condicionado al script, paso 2.
3. Tarjeta tokenizada mediante `POST /v1/customers` + `cards` (otra API, NO investigada aquí) y cobros por `POST /v1/payments` iniciados por StylerNow: fuera de alcance, requeriría su propia investigación de cumplimiento (cobros "merchant-initiated").

---

## 3. Diseño

### 3.1 Modelo de datos (todo con RLS activada, `security_invoker` en vistas)
Principio: nada de precios, plazos ni textos en código; todo en tablas editables por SuperAdmin con auditoría. No se reutiliza `negocio_addon` ni el legado `precio_staff_extra`.

**`adicional_barbero_config`** (una fila por país; PK `pais_codigo`): `habilitado boolean`, `modalidad_manual_habilitada`, `modalidad_automatica_habilitada`, `periodicidad_meses int default 1`, `max_por_lote int`, `max_total_por_negocio int` (nullable), `gracia_dias int`, `reintentos_max int`, `reintento_cada_dias int`, `avisos_dias_antes int[]` (p. ej. {7,3,1}), `dias_suspension_tras_gracia int`, `cancelacion_efecto text check ('FIN_PERIODO')`, `aviso_cambio_precio_dias int`, `promo_activa boolean`, `promo_descuento_pct`, `promo_hasta`, `texto_legal_version_id`, `updated_at/by`. CHECKs de rango (gracia 0..30, reintentos 0..10, etc.) como `prueba_config_valida`.

**`adicional_barbero_tarifa`** (inmutable, versionada): `id`, `pais_codigo`, `precio_mensual numeric(12,2) check > 0`, `moneda`, `vigente_desde`, `vigente_hasta`, `creado_por`, `motivo`. Índice único parcial `(pais_codigo) where vigente_hasta is null`. Sembrado inicial: **51.900 COP, país CO** (PROPUESTA de valor ya decidida por el usuario; US/MX/ES sin tarifa = no contratable hasta que SuperAdmin la defina; no se inventan otros valores). Cambiar el precio = cerrar la tarifa vigente e insertar otra (RPC SuperAdmin con motivo), nunca `update`.

**`adicional_barbero_contrato`** (un "lote"): `id`, `negocio_id`, `modalidad ('MANUAL'|'AUTOMATICA')`, `estado adicional_estado` (enum, 3.2), `cantidad int check (cantidad >= 1)`, `tarifa_id` (FK), `precio_unitario numeric(12,2)` y `moneda` **congelados**, `periodicidad_meses`, `monto_ciclo` (= cantidad × precio_unitario × (1 - promo), congelado), `inicio_at`, `vigente_hasta` (fin del periodo pagado; define el cupo), `proxima_renovacion_at`, `ciclo_n int`, `renovacion_automatica boolean` (solo B), `cancelacion_solicitada_at`, `cancelar_al_fin boolean`, `gracia_fin`, `reintentos_count`, `ultimo_fallo_at`, `ultimo_fallo_motivo`, `preapproval_id text` (UNIQUE parcial), `mp_status_ultimo`, `metodo_marca text`, `metodo_ultimos4 char(4)` (sin PAN/CVV/token), `activacion_manual boolean`, `manual_motivo`, `manual_responsable`, `manual_hasta`, `entorno` (SANDBOX/PRODUCCION), `created_by`, `created_at`, `updated_at`. Índices: `(negocio_id, estado)`, `(estado, proxima_renovacion_at)`, `(estado, gracia_fin)`, UNIQUE parcial `preapproval_id`. Restricción: como máximo N lotes no terminales por negocio (trigger leyendo `max_total_por_negocio`).
 - "Cupo vigente" del lote = `cantidad` si estado ∈ {ACTIVO, PROXIMO_A_RENOVAR, PAGO_FALLIDO, EN_GRACIA} **y** `vigente_hasta > now()`, o si está CANCELADO con `cancelar_al_fin` y `vigente_hasta > now()`. SUSPENDIDO, EXPIRADO y CANCELADO vencido aportan 0. (PROPUESTA: PAGO_FALLIDO y EN_GRACIA conservan el cupo mientras `vigente_hasta`/`gracia_fin` no venza.)

**`adicional_barbero_cobro`** (un cobro por periodo; es el puente con `pago`): `id`, `contrato_id`, `periodo_n`, `periodo_desde`, `periodo_hasta`, `monto`, `origen ('CHECKOUT_PRO'|'PREAPPROVAL'|'MANUAL_SUPERADMIN')`, `pago_id uuid` (FK, UNIQUE), `mp_authorized_payment_id text` (UNIQUE), `mp_payment_id text` (UNIQUE), `estado ('PENDIENTE'|'APROBADO'|'RECHAZADO'|'REEMBOLSADO')`, `retry_attempt`, `created_at`. UNIQUE `(contrato_id, periodo_n)`: **la idempotencia de un periodo se garantiza por esquema**.

**`adicional_barbero_autorizacion`** (inmutable; trigger que bloquea UPDATE/DELETE): `id`, `contrato_id`, `usuario_id`, `modalidad`, `texto_version`, `texto_hash`, `texto_snapshot text`, `valor`, `moneda`, `periodicidad_meses`, `cantidad`, `inicio_at`, `renovacion_automatica`, `como_cancelar text`, `condicion_fallo text`, `acepto_at`, `ip_hash`, `user_agent_hash`, `verificada_mp_at`, `mp_preapproval_id`, `mp_status_verificado`. Para B, `verificada_mp_at` se llena solo cuando el servidor confirma con `GET /preapproval/{id}` que está `authorized` con el monto/frecuencia esperados (nunca por lo que diga el frontend). Reutilizar el patrón de `aceptacion_legal` (`src/lib/auth/aceptacion-legal.ts`) para la versión del texto.

**`adicional_barbero_historial`** (inmutable, append-only): `id`, `contrato_id`, `negocio_id`, `evento`, `estado_antes`, `estado_despues`, `cantidad_antes/despues`, `actor_tipo ('PROPIETARIO'|'SISTEMA'|'WEBHOOK'|'SUPERSU')`, `actor_id`, `motivo`, `pago_id`, `mp_ref`, `request_id`, `created_at`. Además de `evento_auditoria` (que ya usa todo el proyecto).

**RLS**: `adicional_barbero_config`/`tarifa`: SELECT para `authenticated` solo de la tarifa vigente y `habilitado` del propio país (vía RPC o vista `security_invoker`), escritura solo SuperSU y solo por RPC. `contrato`/`cobro`/`autorizacion`/`historial`: SELECT `is_barberia_de(negocio_id) or is_supersu()` (patrón `addon_select_propio`); **sin** INSERT/UPDATE/DELETE para `authenticated` (todo por RPC `security definer`); un administrador delegado (BUSINESS_ADMIN) NO ve ni contrata (decisión de Fase 1: lo comercial es del propietario; PROPUESTA, confirmar). Sin políticas FOR ALL.

Todas con `trg_auditar_*` vía `_trg_auditar_cambio` para config/tarifa/contrato.

### 3.2 Máquina de estados (única, en base)
Estados de contratación (enum `adicional_estado`), tal como pidió el usuario:
`PENDIENTE_CONTRATACION`, `CHECKOUT_INICIADO`, `PAGO_PENDIENTE`, `PAGO_CONFIRMADO`, `ACTIVO`, `PROXIMO_A_RENOVAR`, `PAGO_FALLIDO`, `EN_GRACIA`, `SUSPENDIDO`, `CANCELADO`, `EXPIRADO`.

Notas: `PAGO_CONFIRMADO` es transitorio (el pago está verificado y el lote se activa en la misma transacción; se conserva para historial y trazabilidad). `PROXIMO_A_RENOVAR` se materializa por el cron al entrar en la ventana `avisos_dias_antes[0]` (derivable, pero se guarda para que CRM y frontend filtren sin lógica duplicada). `CANCELADO` con `cancelar_al_fin=true` y `vigente_hasta` futura = "cancelación programada": conserva cupo hasta el fin (el estado visible es `CANCELADO` con etiqueta derivada "cupo hasta <fecha>").

Transiciones permitidas y quién las dispara (todas por funciones `_adicional_transicionar(contrato, a, evento, actor, ...)` que validan la tabla de transiciones y escriben historial + auditoría; ningún `update estado` directo):

| Desde | Hacia | Disparador | Condición |
|---|---|---|---|
| (nuevo) | PENDIENTE_CONTRATACION | Propietario (`adicional_iniciar`) | tarifa vigente, país habilitado, modalidad habilitada, sin exceder máximos, suscripción del plan vigente |
| PENDIENTE_CONTRATACION | CHECKOUT_INICIADO | Servidor (`*_srv`) tras crear preferencia (A) o preapproval pending (B) | |
| CHECKOUT_INICIADO | PAGO_PENDIENTE | Webhook/conciliación: MP informa `pending`/`in_process` | |
| CHECKOUT_INICIADO / PAGO_PENDIENTE | PAGO_CONFIRMADO → ACTIVO | Solo webhook/conciliación tras verificar con MP (`aplicar_evento_pago`) o SuperAdmin (activación manual) | monto igual al congelado, entorno coincide |
| CHECKOUT_INICIADO / PAGO_PENDIENTE | PENDIENTE_CONTRATACION (abandono) o EXPIRADO | Cron: checkout sin pago en N horas (PROPUESTA 24 h) | nunca ocupó cupo |
| ACTIVO | PROXIMO_A_RENOVAR | Cron al entrar a la ventana de aviso | |
| ACTIVO/PROXIMO_A_RENOVAR | ACTIVO (ciclo+1) | Pago del siguiente periodo confirmado (A: nuevo Checkout Pro; B: authorized_payment aprobado) | |
| ACTIVO/PROXIMO_A_RENOVAR | PAGO_FALLIDO | B: rechazo de cuota informado por MP; A: llegó `vigente_hasta` sin pago | |
| PAGO_FALLIDO | EN_GRACIA | Cron/servidor al agotar el primer ciclo de reintentos o al abrirse la gracia | |
| PAGO_FALLIDO/EN_GRACIA | ACTIVO | Pago confirmado (reactivación automática; periodo nuevo desde el pago o desde `vigente_hasta` sin perder días pagados, mismo criterio de `trg_pago_plan_activar`) | |
| EN_GRACIA | SUSPENDIDO | Cron al vencer `gracia_fin` (+ `dias_suspension_tras_gracia` si se configura) | |
| SUSPENDIDO | ACTIVO | Pago confirmado o SuperAdmin | |
| SUSPENDIDO | EXPIRADO | Cron tras N días sin pago (PROPUESTA 60) | |
| cualquiera no terminal | CANCELADO | Propietario (`adicional_cancelar`, efecto fin de periodo), SuperAdmin, o MP (B: `cancelled`/3 rechazos) | |
| CANCELADO (programada) | EXPIRADO | Cron al llegar `vigente_hasta` | libera cupo |

Terminales: EXPIRADO; CANCELADO una vez vencido el periodo. Reactivar un lote terminal = contratar uno nuevo (con la tarifa vigente y nueva autorización: no se reabre un precio viejo).
La transición hacia ACTIVO/EN_GRACIA/SUSPENDIDO/EXPIRADO dispara `_cupo_bloquear(negocio)` para serializar con altas de staff.

### 3.3 RPC y permisos
Patrón del repo: `create or replace ... security definer set search_path = public`, validación de autorización **dentro** de la función, y siempre `revoke all ... from public, anon, authenticated` (los tres roles, lección de memoria) seguido del `grant` mínimo. Verificación posterior con consulta a `information_schema.routine_privileges`.

Propietario (grant `authenticated`; autoriza con `is_barberia_de(negocio)`, que es propietario; `coalesce(..., false)` para evitar NULL en autorización):
- `adicional_cotizar(p_negocio_id, p_cantidad, p_modalidad)` → jsonb (precio vigente, total, texto legal vigente, qué se mostrará). Sin efectos.
- `adicional_iniciar(p_negocio_id, p_cantidad, p_modalidad, p_texto_version, p_confirmacion jsonb)` → contrato. La modalidad **no tiene valor por defecto** (parámetro obligatorio; la UI no preselecciona B; la base rechaza `NULL`). En A: crea el `pago` SUSCRIPCION `concepto='STAFF_EXTRA'` (`monto` calculado en base, nunca del cliente) y `adicional_barbero_cobro`. Idempotente: reutiliza contrato `CHECKOUT_INICIADO` igual de <2 h (mismo criterio de 133).
- `adicional_cancelar(p_contrato_id, p_motivo text default null)`: propone cancelación al fin del periodo; en B pide al servidor cancelar el preapproval (la acción de red la hace el server action con service_role, ver `_srv`). Un solo paso, sin pantallas intermedias de retención.
- `adicional_renovar_manual(p_contrato_id)` (A): crea el pago del siguiente periodo si falta ≤ `avisos_dias_antes[0]` días o está en gracia/fallido.
- `adicional_mis_contratos(p_negocio_id)` → jsonb de lotes, cobros, próxima renovación, método (marca/últimos 4), cupo efectivo. Lectura.

Servidor (`*_srv`, grant solo `service_role`; no se llaman desde el navegador):
- `adicional_registrar_checkout_srv(contrato, id_preferencia | preapproval_id, init_point_hash)`.
- `adicional_aplicar_pago_srv(contrato/pago, estado, ids MP, monto, entorno, payload)`: usada por el handler de suscripciones; idempotente por `(contrato_id, periodo_n)` y por `mp_payment_id`/`mp_authorized_payment_id`.
- `adicional_aplicar_preapproval_srv(preapproval_id, status_mp, monto_mp, ...)`: reconcilia estado del preapproval (authorized/paused/cancelled), verifica monto/frecuencia congelados; si difiere → no activa, audita `ADICIONAL_MONTO_NO_COINCIDE`.
- `adicional_mantenimiento_srv()`: cron (3.8).
- `adicional_cupo_activo(p_negocio_id)` (interna `_adicionales_activos`): suma de cupos vigentes.

SuperAdmin (grant `authenticated`, primera línea `if not coalesce(public.is_supersu(), false) then raise exception 'NO_AUTORIZADO'`; motivo ≥5 caracteres obligatorio; auditoría con `evento_auditoria.motivo`):
- `admin_adicional_set_config(p_pais, p_config jsonb, p_motivo)`; `admin_adicional_set_tarifa(p_pais, p_precio, p_motivo)` (cierra la vigente, crea nueva, programa aviso a contratos recurrentes que **no** cambian: precio congelado por lote).
- `admin_adicional_activar_manual(p_negocio_id, p_cantidad, p_vigente_hasta, p_tipo, p_motivo, p_referencia)`: crea lote con `activacion_manual=true`, responsable = `auth.uid()`, vigencia obligatoria (PROPUESTA: máximo 366 días; sin vigencia infinita, a diferencia de 090) y auditoría. Expira solo por cron.
- `admin_adicional_forzar_estado(p_contrato_id, p_estado, p_motivo)`: solo transiciones permitidas por la tabla.
- `admin_adicional_listar(filtros jsonb)` y `admin_adicional_detalle(p_contrato_id)`: lectura del CRM con paginación; solo referencias de MP (ids), nunca datos de tarjeta.
Grants: `admin_*` a `authenticated` (control dentro de la función), `*_srv` y `mantenimiento` solo `service_role`.

### 3.4 Flujo A — pago mensual manual por Checkout Pro
1. Propietario en `/panel/suscripcion` (sección "Barberos adicionales"), ve precio vigente (desde base), cantidad, total y elige **expresamente** entre "Pagar cada mes yo mismo" y "Renovación automática con tarjeta" (ninguna preseleccionada; botón deshabilitado hasta elegir).
2. `adicional_iniciar(modalidad='MANUAL')` → `pago` (SUSCRIPCION, PENDIENTE, `metadata={concepto:'STAFF_EXTRA', contrato_id, periodo_n, cantidad, precio_unitario}`) → server action crea preferencia con `crearPreferenciaDePago({pagoId,...})` (monto desde `pago.monto`), retorno `?desde=adicional`.
3. Webhook existente `payment` → `sincronizarNotificacion` (sin cambios) → `aplicar_evento_pago` (rama ampliada por concepto, 3.5) → `adicional_aplicar_pago_srv` → contrato ACTIVO, `vigente_hasta = max(vigente_hasta, now()) + periodicidad`, historial, notificación `ADICIONAL_ACTIVADO`.
4. Renovación: aviso por outbox a 7/3/1 días (configurable); botón "Renovar" crea el pago del siguiente periodo; el periodo nuevo empieza al terminar el vigente (no se pierden días). Si llega `vigente_hasta` sin pago → PAGO_FALLIDO → EN_GRACIA → SUSPENDIDO.
5. Sin tarjetas almacenadas ni datos de pago en StylerNow.

### 3.5 Integración con `aplicar_evento_pago` y `solicitar_pago_plan` (cambios mínimos y probados)
- Migración propia (ancla-guardada, patrón 152) que ramifica la rama `SUSCRIPCION` de `aplicar_evento_pago`: `if v_pago.metadata->>'concepto' = 'STAFF_EXTRA' then` marcar el pago (APROBADO/RECHAZADO), llamar `adicional_aplicar_pago_srv` y retornar `{procesado:true, requiere_reembolso:false}`; **`else`** conserva EXACTAMENTE el código actual (UPGRADE/PLAN). Prueba de regresión: pago PLAN/UPGRADE aprobado y rechazado produce los mismos resultados que antes (SQL fixtures de 133).
- `solicitar_pago_plan` (l. 85-94 de 133): el `select ... tipo='SUSCRIPCION' and estado='PENDIENTE'` debe agregar `and coalesce(metadata->>'concepto','PLAN') = 'PLAN'`. Un STAFF_EXTRA pendiente no bloquea el pago del plan ni lo reutiliza.
- `trg_pago_plan_activar` no cambia (su `WHEN` ya exige concepto PLAN). `mantenimiento_suscripciones` consulta pagos aprobados concepto PLAN: sin cambio.
- Lista de pagos del panel (`PagoSuscripcion.concepto: "PLAN" | "UPGRADE"`, `actions.ts`): ampliar el tipo a `"ADICIONAL"` para no mezclarlos.
- Reembolsos: una devolución de un STAFF_EXTRA ya aprobado sigue el flujo de `reembolso` existente; política en 5 (decisión abierta).

### 3.6 Integración con la función central de capacidad (Fase 1)
- Crear `_adicionales_activos(p_negocio_id) → int` = suma de `cantidad` de lotes con cupo vigente (3.1), `security definer`, `stable`, sin grants a `public/anon/authenticated`.
- Modificar `_capacidad_profesional` **sin cambiar su firma** (evita el problema de sobrecargas de memoria): `v_adic := greatest(coalesce(p_adicionales,0), public._adicionales_activos(p_negocio_id))`; el resto igual. Así los cuatro llamadores que pasan 0 reciben automáticamente los adicionales reales, y `p_adicionales` queda como "simulación mínima" (útil para pruebas y proyecciones). Rutas que cambian de comportamiento: invitar, aceptar invitación, activar profesional, cambiar rol, downgrade (el plan destino sigue sumando los adicionales vigentes; PROPUESTA y a confirmar: un downgrade valida contra tope_destino + adicionales).
- `limite = staff_tope_absoluto + adicionales activos`. Respuesta jsonb ya incluye `adicionales_contratados`; añadir `adicionales_en_gracia`, `adicionales_vencen_at` para la interfaz.
- Cupo se libera solo por desvinculación definitiva o liberación válida de invitación (regla Fase 1) — no cambia. Un profesional SUSPENDIDO sigue ocupando cupo aunque su lote se suspenda; nadie es retirado por la caída del tope: solo se impide agregar (`exceso > 0`), como ya hace `textoExcesoStaff`.
- Concurrencia: toda transición que cambia el cupo vigente llama `_cupo_bloquear(negocio)` primero (el mismo advisory lock que usan las invitaciones).
- Invitación tras activar: sin cambio de código en `crear_invitacion_staff`; al estar ACTIVO el lote, `disponibles` sube y la invitación pasa. Prueba explícita.
- UI: `cupo.ts` ya expone el tope; `textoTopeStaff` y `AvisoPlan` (`panel/staff/nuevo/page.tsx`) añaden acción "Contratar barbero adicional" (href a la sección) cuando el plan permite adicionales (no aplica a SIGNATURE sin tarifa; PROPUESTA: permitir adicionales solo si el plan tiene `staff_tope_absoluto` no nulo).

### 3.7 Pagos fallidos, gracia, suspensión, reactivación (todo en `adicional_barbero_config`)
- **Distinguir transitorio de definitivo**: un rechazo no suspende. Se registra `ultimo_fallo_motivo` (status_detail de MP: fondos insuficientes, tarjeta vencida, error del emisor...). Solo EN_GRACIA vencida suspende.
- Modalidad B: MP reintenta (hasta 4 veces en 10 días, VERIFICADO); StylerNow no inicia reintentos propios de cobro (sería duplicar). Su `gracia_dias` cuenta desde la primera cuota rechazada (PROPUESTA: 10 días en B para coincidir con la ventana de MP + 3 de margen = **13**; en A, 3 días como el plan). Si MP cancela por 3 rechazos → estado CANCELADO (causa `CANCELADO_POR_MP`), se ofrece "actualizar tarjeta" que crea un lote nuevo o un preapproval nuevo.
- Modalidad A: "reintento" = recordatorios (outbox) a las fechas `avisos_dias_antes` negativas (+1, +3 días tras vencer, configurables) y botón de pago siempre disponible.
- Notificaciones (outbox, es/en, al propietario): `ADICIONAL_ACTIVADO`, `ADICIONAL_POR_RENOVAR`, `ADICIONAL_RENOVADO`, `ADICIONAL_PAGO_FALLIDO`, `ADICIONAL_EN_GRACIA`, `ADICIONAL_SUSPENDIDO`, `ADICIONAL_REACTIVADO`, `ADICIONAL_CANCELADO`, `ADICIONAL_EXPIRADO`, `ADICIONAL_PRECIO_CAMBIA`. Claves de idempotencia `adicional:<contrato>:<evento>:<periodo_n>`.
- Reactivación: automática al confirmarse el pago de cualquier estado no terminal (PAGO_FALLIDO/EN_GRACIA/SUSPENDIDO → ACTIVO) con periodo contado sin perder días pagados.
- Cancelar renovación no quita el cupo ya pagado: `cancelar_al_fin=true`, cupo hasta `vigente_hasta`; en B se cancela el preapproval en MP para que no cobre más.

### 3.8 Cron (`adicional_mantenimiento_srv`, invocado desde `/api/cron/diario` en su propio try/catch)
Se agrega UNA llamada nueva en `route.ts` (cambio de una línea; el cron ya es diario, 08:00 UTC). La función hace, en orden y de forma idempotente: (1) marcar `PROXIMO_A_RENOVAR`; (2) encolar avisos (`avisos_dias_antes`) sin repetir (clave idempotente); (3) `vigente_hasta` vencido sin pago → PAGO_FALLIDO; (4) PAGO_FALLIDO que debe abrir gracia → EN_GRACIA con `gracia_fin`; (5) gracia vencida → SUSPENDIDO; (6) SUSPENDIDO largo y CANCELADO vencido → EXPIRADO; (7) CHECKOUT_INICIADO abandonado → cierre; (8) activaciones manuales vencidas → EXPIRADO; (9) toma `_cupo_bloquear` por negocio antes de cada cambio de cupo. Para B además: conciliación contra Mercado Pago (3.11), en TypeScript (`src/lib/pagos/suscripciones/conciliar.ts`, nuevo).
Limitación real: cron diario ⇒ cualquier "reintento cada X horas" es imposible; PROPUESTA: dejar todo en días enteros.

### 3.9 Flujo B — renovación automática con tarjeta (Preapproval) y aislamiento de webhooks
1. **Pantalla de autorización expresa** (no preseleccionada) con: valor por periodo y total, periodicidad, cantidad, fecha de inicio, "se renovará automáticamente cada mes hasta que canceles", **cómo cancelar** (botón en la misma pantalla de contratación y en "Mis adicionales", un paso), condiciones de pago fallido (reintentos de Mercado Pago, gracia, suspensión), y casilla separada. Se registra `adicional_barbero_autorizacion` con snapshot del texto y su hash.
2. Servidor (`service_role`, token de la aplicación de suscripciones): crea `POST /preapproval` sin plan (`external_reference = 'ADIC-' || contrato_id`, `reason`, `payer_email` del propietario, `auto_recurring` mensual COP con el `monto_ciclo` congelado, `back_url`, y según el script, `status=pending` con `init_point` o `status=authorized` + `card_token_id`). Recomendado primero `pending`+`init_point` (el pagador teclea la tarjeta en el checkout de Mercado Pago, no en StylerNow) si el script confirma que acepta tarjeta; si no, tokenización con MercadoPago.js (formulario seguro) y `authorized`.
3. Retorno del navegador **no activa nada**. El contrato pasa a ACTIVO solo cuando el servidor verifica con `GET /preapproval/{id}` (`status=authorized`, `auto_recurring.transaction_amount/frequency/currency` = lo congelado, `external_reference` coincide) **y** se confirma el primer cobro (`authorized_payment`/`payment` aprobado); se llena `verificada_mp_at`. (NO VERIFICADO: si en `authorized` el primer cobro tarda hasta 1 hora, VERIFICADO en S3 → el contrato queda PAGO_PENDIENTE hasta entonces.)
4. Tarjeta: se guarda solo marca y últimos 4 si MP los devuelve; el token (`card_token_id`) nunca se persiste ni se loguea.
5. Cambio de precio de tarifa: **no** afecta lotes existentes (precio congelado en el lote). Subir el precio de un lote vigente exigiría aviso con antelación (`aviso_cambio_precio_dias`) y nueva autorización (cancelar el preapproval y crear otro); no se hace por defecto.
6. **Aislamiento del webhook (decisión de diseño, requisito de seguridad).** Opción preferida: **una segunda aplicación de Mercado Pago "StylerNow Suscripciones"** con sus propias credenciales y su propio secreto, cuya URL de webhook es **`/api/webhooks/mercadopago/suscripciones`** (ruta nueva) y cuyos tópicos son `subscription_preapproval`, `subscription_authorized_payment` y `payment`. Los pagos creados por esos preapprovals notifican a ESA aplicación, no a la URL del Checkout Pro de planes: **el webhook actual no los ve y no los reembolsa como huérfanos**. Variables nuevas (solo nombres, propuestas): `MERCADOPAGO_SUSCRIPCIONES_ACCESS_TOKEN`, `MERCADOPAGO_SUSCRIPCIONES_PUBLIC_KEY`, `MERCADOPAGO_SUSCRIPCIONES_WEBHOOK_SECRET`. NO VERIFICADO: que la misma cuenta pueda crear una segunda aplicación y que el pago hijo del preapproval notifique a la aplicación dueña del preapproval. Alternativa si no es posible: despachador en `src/app/api/webhooks/mercadopago/route.ts` (el envoltorio; NO el archivo lib prohibido) que clona la petición, valida la firma, consulta el recurso y, si `external_reference` empieza por `ADIC-` o el tópico es `subscription_*`, atiende con el handler nuevo; si no, delega al original intacto. Como `webhook_registrar` es idempotente por `(proveedor, request_id)`, el despachador **no debe registrar** antes de delegar. Defensa en profundidad opcional (requiere aprobación porque toca `sincronizar.ts`): en `sincronizarConPago`, no reembolsar huérfanos cuyo `external_reference` empiece por `ADIC-` y auditarlos como `WEBHOOK_ADICIONAL_FUERA_DE_RUTA`.
7. **Handler aislado** `src/lib/pagos/suscripciones/webhook.ts` (nuevo): reutiliza `verificarFirma` (se exporta una variante `verificarFirmaConSecreto(args, secreto)` aditiva en `mercadopago.ts`, sin alterar la existente), `webhook_registrar`/`webhook_registrar_resultado` con `p_proveedor='MERCADOPAGO_SUSCRIPCIONES'` (la clave `(proveedor, request_id)` evita colisión con el flujo de planes), `liveModeCoincide`, el patrón 200/401/500 de `clasificarError` y los helpers `obtener*` (nuevos: `obtenerPreapproval`, `obtenerPagoAutorizado`, `buscarPreapprovals`) en un módulo nuevo `src/lib/pagos/suscripciones/mercadopago.ts`. Regla: **el cuerpo nunca es fuente de verdad**; siempre se re-consulta a MP con el token de la app de suscripciones y se aplica por `adicional_aplicar_*_srv`.

### 3.10 Idempotencia y eventos desordenados/duplicados/tardíos
- Duplicados: `webhook_registrar` (por request_id) + `UNIQUE(contrato_id, periodo_n)` + `UNIQUE(mp_payment_id)` + `UNIQUE(mp_authorized_payment_id)`; reaplicar un pago ya APROBADO devuelve `YA_PROCESADO`.
- Fuera de orden: la verdad se re-consulta a MP en cada evento (no se confía en el orden de llegada). Se compara `mp_status` consultado contra `mp_status_ultimo` con una "versión" (`last_modified`/`date_last_updated` si existe, NO VERIFICADO) y se descarta el más viejo; las transiciones inválidas por la tabla de 3.2 se registran en historial como `TRANSICION_IGNORADA` sin error (200).
- Tardíos: un pago aprobado que llega después de que el lote se SUSPENDIÓ/EXPIRÓ reactiva si el estado es no terminal; si el lote ya es terminal, queda `REQUIERE_REVISION` (auditoría `ADICIONAL_PAGO_TARDIO`) y se ofrece reembolso o crear lote nuevo (decisión de 5). Un pago tardío dentro de la gracia reactiva sin pérdida.
- Cobro aprobado que no coincide en monto/entorno: no activa (`PAGO_MONTO_NO_COINCIDE`, `PAGO_ENTORNO_NO_COINCIDE`).
- 500 solo ante fallos transitorios; 200 ante lo irreparable (mismo contrato que el webhook actual).

### 3.11 Conciliación
`reconciliarAdicionales()` en el cron diario: (A) pagos `STAFF_EXTRA` PENDIENTE >N minutos → reconsulta MP (reutiliza `sincronizarPago`/`reconciliarPagosPendientes`; hoy ya consulta todos los pagos PENDIENTE sin filtrar por concepto, VERIFICABLE en `sincronizar.ts:221`, así que los STAFF_EXTRA de A quedan cubiertos sin código nuevo); (B) por cada contrato AUTOMATICA no terminal: `GET /preapproval/{id}` y `GET /authorized_payments/search?preapproval_id=` → corregir diferencias (autorizado/pausado/cancelado, cuotas faltantes) y detectar preapprovals en MP sin contrato local (huérfanos: alerta, no acción automática). Cubre también la ventana anti-replay de 15 min de la firma.

### 3.12 CRM SuperAdmin
Nueva pantalla `/admin/adicionales` (ruta a registrar en `src/lib/routing/route-registry.ts` y en la barra lateral, como las demás `admin/*`):
- **Configuración** (formulario → `admin_adicional_set_config` / `set_tarifa`): precio por país, periodicidad, modalidades habilitadas (manual/automática), gracia, reintentos, días de aviso, suspensión, efecto de cancelación, promociones, máximos. Cada guardado exige motivo y deja auditoría con diff.
- **Consulta** (tabla paginada con filtros, `admin_adicional_listar`): negocio, cantidad, modalidad, estado, próxima renovación, último pago, fallos, cancelaciones, referencias de Mercado Pago (preapproval id, payment id; con enlace al panel de MP), historial por contrato (`admin_adicional_detalle`).
- **Acciones**: activación manual con motivo/responsable/vigencia, forzar estado dentro de la tabla de transiciones, ver y reintentar una conciliación. Todo por RPC SuperSU.
- El Fundador (30 % x 3 mensualidades pagadas) **no** interviene: ni `_precio_plan_ciclo` ni `suscripcion_fundador` se consultan para adicionales; prueba que lo verifique (`descuento_pct` activo no altera `monto_ciclo`).

### 3.13 Convivencia con Checkout Pro de planes (sin romperlo)
1. Mismo `tipo=SUSCRIPCION`, `concepto` distinto; tabla de puente propia; trigger de activación de plan intacto.
2. Cambios en funciones existentes: solo dos y ambos mínimos (rama por concepto en `aplicar_evento_pago` y filtro por concepto en `solicitar_pago_plan`), cada uno con prueba de regresión que replica casos de 133 (`tests/sql/suscripcion_133.sql` descrito en el encabezado de 133; verificar su existencia al implementar).
3. Webhook de planes sin tocar; el de suscripciones, ruta y secreto propios.
4. El cron llama la nueva función en un `try/catch` independiente: un fallo de adicionales no afecta el ciclo del plan.
5. Bandera por país `habilitado` y por modalidad: apagar = cero efecto en el resto.

---

## 4. Plan de migraciones (desde la 156; la 155 está pendiente de aplicar por el otro agente) y pruebas

Convención del repo: cada migración con su `NNN_..._REVERSION.sql.txt`, escritas para aplicar primero en local; guardas por ancla en funciones editadas (patrón 152). Ninguna se aplica a producción sin autorización (memoria: orden base→código, probar en Supabase local).

| N.º | Contenido | Rollback |
|---|---|---|
| 156 | Enum `adicional_estado`; tablas `adicional_barbero_config`, `adicional_barbero_tarifa` (+ seed CO 51.900, config inicial con valores PROPUESTA y `habilitado=false`); RLS; auditoría; RPC `admin_adicional_set_config/set_tarifa`; grants | drop tablas/tipo |
| 157 | `adicional_barbero_contrato`, `adicional_barbero_cobro`, `adicional_barbero_historial`, `adicional_barbero_autorizacion` (+ triggers de inmutabilidad); índices; RLS; `_adicional_transicionar` y tabla de transiciones | drop tablas |
| 158 | `_adicionales_activos` y modificación de `_capacidad_profesional` (misma firma) + extensión del jsonb; prueba de cupos | restaurar la 152 |
| 159 | `aplicar_evento_pago` rama por concepto + filtro en `solicitar_pago_plan` (regresión de planes); `adicional_aplicar_pago_srv` | restaurar versiones previas (guardadas en el .txt) |
| 160 | RPC propietario (`adicional_cotizar/iniciar/cancelar/renovar_manual/mis_contratos`), flujo A completo; eventos de notificación + plantillas es/en | drop funciones |
| 161 | `adicional_mantenimiento_srv` + enlaces al cron (cambio en `route.ts`) | drop función |
| 162 | RPC SuperAdmin (activación manual, forzar estado, listar/detalle) | drop funciones |
| 163 | Preparación de B (columnas/índices de preapproval ya están en 157; aquí solo `adicional_aplicar_preapproval_srv`, `adicional_registrar_checkout_srv`, constraint de entorno) **solo si el script de sandbox aprobó** | drop funciones |

Código (no es migración): UI del propietario (`/panel/suscripcion`, `/panel/staff`), server actions, `/admin/adicionales`, módulo `src/lib/pagos/suscripciones/*`, ruta `/api/webhooks/mercadopago/suscripciones`, ajustes de `cupo.ts`/`AvisoPlan`, tipos (`database.ts` regenerado), entrada en route-registry.

### 4.1 Plan de pruebas
**SQL** (carpeta `tests/sql/`, estilo `limites_plan_156.sql`, sobre la base local; limpiar solo lo creado y respetar memoria: borrar wallet/venta_producto antes de borrar un negocio de prueba; no borrar datos QA sin "listo"):
1. Pago aprobado (A): contrato → ACTIVO, `vigente_hasta` correcto, cupo +cantidad, historial y auditoría, libro (`PAGO_A_STYLERNOW`).
2. Rechazado: contrato permanece sin cupo; reintento permitido.
3. Pendiente: PAGO_PENDIENTE sin cupo.
4. Duplicado: reaplicar el mismo `mp_payment_id` y mismo `periodo_n` → sin doble periodo, sin doble cupo.
5. Tardío: aprobado después de gracia vencida (SUSPENDIDO) reactiva; tras EXPIRADO queda en revisión.
6. Fuera de orden: aprobado antes que pendiente; cancelado antes que autorizado.
7. Renovación sin perder días; renovación anticipada dentro de ventana.
8. Cancelación: conserva cupo hasta `vigente_hasta`; luego EXPIRADO y cupo -N; nadie es retirado, `exceso` correcto, no se puede agregar.
9. Mora: A (vence sin pago) y B (rechazo); gracia con valores de configuración distintos a los por defecto (prueba de que sale de la tabla).
10. Suspensión y reactivación al pagar.
11. Activación manual SuperAdmin: motivo/responsable/vigencia obligatorios; sin vigencia falla; expira por cron.
12. Auditoría: cada transición deja historial y `evento_auditoria`; las tablas inmutables rechazan UPDATE/DELETE (incluido como `postgres` vía trigger de usuario normal).
13. Permisos: `has_function_privilege` de `public`, `anon`, `authenticated` para cada RPC (`*_srv`: solo service_role; `admin_*`: autorizado pero lanza NO_AUTORIZADO a no SuperSU; incluir caso `is_supersu()` NULL).
14. IDOR: propietario A no puede cotizar/iniciar/cancelar/listar contratos del negocio B; BUSINESS_ADMIN no contrata; cliente final no ve nada; `contrato_id` ajeno rechazado.
15. Cupos: `_capacidad_profesional` con 0, 1, N lotes, lotes en gracia, suspendidos, cancelados programados; un profesional SUSPENDIDO sigue ocupando; trigger `trg_vinculo_cupo` y `trg_invitacion_cupo` con tope ampliado; dos invitaciones concurrentes con 1 cupo adicional (advisory lock).
16. Invitación tras activar: sin adicional → `PLAN_LIMIT_EXCEEDED`; tras activar → éxito; tras expirar → de nuevo bloquea.
17. Fundador: `suscripcion_fundador` ACTIVO no cambia el monto del lote.
18. Precio congelado: cambiar tarifa no cambia `monto_ciclo` de lotes existentes ni el `pago` pendiente.
19. **Regresión de Checkout Pro de planes**: casos de 133 (solicitar, idempotencia 2 h, PLAN pagado activa, upgrade, rechazado) con un STAFF_EXTRA pendiente simultáneo; `solicitar_pago_plan` no se bloquea; `aplicar_evento_pago` de PLAN idéntico al previo; mantenimiento de planes idéntico.

**vitest** (`tests/*.test.ts`, estilo `pagos-sandbox.test.ts`): módulo `suscripciones/webhook` con firma válida/ inválida/ sin secreto en producción (503)/ replay fuera de ventana; despacho por tópico (`subscription_preapproval`, `subscription_authorized_payment`, `payment` con `ADIC-`); mapeo de estados MP → estados locales; clasificación de errores (reintentar vs no); que el handler nunca lee estado del cuerpo; que **ningún token/PAN/CVV** aparece en logs ni payload persistido (test de limpieza como `sentry-limpieza.test.ts`); que `normalizarTipo` actual sigue sin tratar `subscription_*` (no cambia) y que `webhook-mercadopago.ts` no fue modificado (hash o `git diff --stat` en CI); autorización de server actions (`server-actions-autorizacion.test.ts`: ninguna acepta `negocio_id` sin verificar propiedad, ninguna acepta precio/monto/cantidad máxima del cliente).

**HTTP / extremo a extremo** (build de producción local, según memoria de pruebas en worktree; Supabase local; sandbox de MP con credenciales de PRUEBA): `POST /api/webhooks/mercadopago/suscripciones` con firmas de prueba (200/401/503); duplicado → 200 `duplicado`; el handler actual de `/api/webhooks/mercadopago` sigue respondiendo igual para payment de plan (regresión); flujo A completo en sandbox con tarjeta `APRO` y `FUND`; flujo B según el script (pospuesto si no hay Preapproval).

---

## 5. Riesgos, preguntas abiertas y acciones externas

### 5.1 Riesgos
| # | Riesgo | Mitigación |
|---|---|---|
| R1 | Cobro recurrente reembolsado como huérfano por el webhook actual | Aplicación MP propia / despachador previo; prueba HTTP; no habilitar B antes |
| R2 | `aplicar_evento_pago` falla para STAFF_EXTRA y el webhook entra en bucle de 500 | Migración 159 antes de exponer el flujo A; prueba de regresión |
| R3 | `PAGO_SUSCRIPCION_EN_PROCESO` bloquea pago del plan | Filtro por concepto (159) |
| R4 | Preapproval no habilitado o no operable en sandbox para Colombia | Script 2.9; A funciona sola; bandera por modalidad |
| R5 | Comportamiento no documentado del PUT de monto | Modelo por lotes; no se usa PUT de monto |
| R6 | Firma/anti-replay (15 min) rechaza reintentos viejos | Conciliación diaria B y A |
| R7 | Cron diario: gracia/aviso con granularidad de día | Todo en días enteros; documentar |
| R8 | Interpretación legal de "autorización expresa" y de renovación automática (SIC, Estatuto del Consumidor, retracto) | Texto versionado y revisado por abogado; no es asesoría legal (pendiente de revisión legal; no se verificó normativa en esta tarea) |
| R9 | Quien contrata es un propietario; un BUSINESS_ADMIN no debe | RLS + RPC con `is_barberia_de` + prueba IDOR |
| R10 | Doble fuente de verdad entre `negocio_addon`, `plan.staff_addon_precio` y las tablas nuevas | Dejar el legado sin lectura; decidir su retiro en una limpieza posterior |
| R11 | Lotes múltiples confunden al usuario | UI agrupa por negocio mostrando "N adicionales" y desglose por fecha de renovación |
| R12 | Dato de tarjeta en logs/errores de MP | Nunca registrar cuerpo de petición de preapproval; test de limpieza |
| R13 | Cobro duplicado entre A y B (el cliente cambia de modalidad) | Un lote tiene una sola modalidad; cambiar = cancelar al fin + lote nuevo con nueva autorización |

### 5.2 Decisiones comerciales abiertas (valores PROPUESTA; no son decisiones)
| Tema | PROPUESTA |
|---|---|
| ¿El 51.900 aplica igual a todos los planes y a todos los países? Hoy el legado es 20.000/15.000 por plan | Un precio por país (CO 51.900); US/MX/ES no contratables hasta definir; retirar el legado |
| ¿Se permite adicionales en SIGNATURE (tope 50, sin precio de legado)? | Sí si `staff_tope_absoluto` no es nulo, mismo precio |
| Gracia (días) | A: 3 (como el plan); B: 13 (10 de reintentos de MP + 3) |
| Reintentos | B: los de MP (4 en 10 días, verificado); A: recordatorios en +1 y +3 días |
| Avisos antes de renovar | 7, 3 y 1 día |
| Suspensión tras gracia | inmediata al vencer `gracia_fin`; expiración definitiva a los 60 días |
| Prorrateo a mitad de ciclo | No hay: cada compra es un lote con su propio ciclo (decisión de diseño por lotes; alternativa: prorrateo por días) |
| Barbero N+1 al suspender/expirar un lote | Conservar al profesional (nadie se retira), bloquear altas y activaciones nuevas, avisar al propietario; PROPUESTA de endurecimiento opcional: tras X días de exceso, impedir que el profesional excedente reciba reservas nuevas (requiere decisión y trabajo en reservas; NO incluido) |
| Reembolsos | Sin reembolso del periodo en curso al cancelar (cupo hasta fin de periodo); reembolso total solo por cobro duplicado/erróneo o en las primeras 48 horas sin uso del cupo (requiere decisión legal) |
| Cambio de modalidad A↔B | Solo al renovar, con nueva autorización |
| Cantidad máxima por lote / por negocio | 10 por lote; total máximo por negocio sin tope inicial (a decidir) |
| Promociones | Campo previsto en config, desactivado; sin valor inventado |
| Quién puede contratar | Solo el propietario (no administrador delegado) |
| Retención de datos de autorización | Mínimo 5 años (PROPUESTA; confirmar con legal) |
| Texto legal exacto, nuevo documento de Términos y política de cobro recurrente | A redactar con revisión legal |

### 5.3 Acciones externas requeridas (no las puede hacer el código)
1. Confirmar con Mercado Pago que **Suscripciones/Preapproval está habilitado** en la cuenta de StylerNow Colombia y si necesita aprobación.
2. Crear la **aplicación de Mercado Pago "StylerNow Suscripciones"** (o confirmar alternativa); obtener credenciales de prueba y de producción; configurar la **URL de webhook** `https://<dominio>/api/webhooks/mercadopago/suscripciones` (prueba y producción por separado) con tópicos `subscription_preapproval`, `subscription_authorized_payment`, `payment`; guardar el secreto. Variables nuevas en Vercel (solo nombres): `MERCADOPAGO_SUSCRIPCIONES_ACCESS_TOKEN`, `MERCADOPAGO_SUSCRIPCIONES_PUBLIC_KEY`, `MERCADOPAGO_SUSCRIPCIONES_WEBHOOK_SECRET`.
3. Ejecutar el script de la sección 2.9 con credenciales de PRUEBA y un usuario comprador de PRUEBA; archivar el resultado.
4. Revisión legal del texto de autorización y de la política de cancelación/reembolso (Colombia).
5. Decidir las preguntas de 5.2 antes de la migración 156 (los valores iniciales de configuración pueden ir con `habilitado=false`).
6. Aprobación del usuario para el único cambio opcional en `sincronizar.ts` (defensa de huérfanos `ADIC-`) y para el cambio de una línea en `/api/cron/diario/route.ts`.
7. Nada de lo anterior se aplica a producción sin autorización; orden base primero, luego código (estado de despliegue conocido: 114-121 y hotfix P0 sin aplicar en producción).

---

## Apéndice A — Hechos de la base local consultados (solo SELECT)
- `plan`: ESSENTIAL (incl. 1, tope 1, addon 20.000), STUDIO (5/5, 20.000), PRESTIGE (15/15, 15.000), SIGNATURE (50/50, sin precio).
- `plan_precio` CO: ESSENTIAL 69.900, STUDIO 139.900, PRESTIGE 279.900, SIGNATURE "desde"; `precio_staff_extra` 20.000/20.000/15.000/NULL.
- `addon_precio`: solo MI_MARCA (CO 29.900, US 9, ES 9, MX 149). `negocio_addon`: 0 filas.
- `configuracion_plataforma`: `suscripcion_gracia_dias`=3 (check 0..30), `prueba_dias`=14, avisos 3 y 1, `staff_transicion_inicio/fin`. Singleton `id boolean`.
- Enums: `suscripcion_estado` = ACTIVA, EN_MORA, SUSPENDIDA, CANCELADA, TRIAL, REQUIERE_PLAN.
- `webhook_evento`: `(proveedor, request_id)` único; columnas `data_id, topico, resultado, firma, negocio_id, pago_id, estado_proveedor, live_mode, intentos`.
- `notificacion_outbox` con `idempotency_key`, `max_intentos`, `proximo_intento_at`.
- `activar_addon_negocio`: solo `postgres` y `service_role` (no `authenticated`).
