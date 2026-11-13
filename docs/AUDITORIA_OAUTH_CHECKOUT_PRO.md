# Auditoría: Mercado Pago Checkout Pro + OAuth sin Split para StylerNow

**Fecha:** 2026-11-13.

**Alcance:** auditoría del repositorio y la base local, consulta de la documentación oficial y pruebas contra el sandbox de Mercado Pago con credenciales de prueba.
- Sin cambios en producción.
- Sin despliegue, commit ni push.
- Sin dinero real.
- Sin modificar los archivos `.env`.

## Resultado

> **«Integración técnica preparada, pero liquidación directa de fondos pendiente de validación real».**
>
> Además, la viabilidad del modelo depende de una **confirmación escrita de Mercado Pago**. La documentación oficial solo describe el uso del token del vendedor dentro del producto Split 1:1 (Marketplace).
>
> Las pruebas OAuth y de cobro con un vendedor **no se pudieron ejecutar**. Faltan las credenciales OAuth de la app (Client ID y Secret), la cuenta vendedor de prueba y una URL https de pruebas (§9).

## 1. Hallazgo principal

**El sistema actual YA implementa casi exactamente la arquitectura objetivo.** El nombre "Split 1:1" del código describe el mecanismo técnico. No hay distribución de fondos.

| Requisito de la arquitectura objetivo | Estado actual en el código |
|---|---|
| Cada negocio conecta su cuenta por OAuth | Sí (`/api/pagos/mercadopago/conectar` y `callback`, migración 119) |
| Checkout Pro por reserva con el token del negocio | Sí (`lib/pagos/cobro.ts` → `crearPreferencia` con `token` del vendedor) |
| Sin `marketplace_fee` / sin comisión | Sí: la comisión por defecto es 0 % y el campo **no se envía** si es 0 (`mercadopago.ts`) |
| El dinero no pasa por StylerNow | Sí por diseño: un trigger de la base (`trg_pago_cuenta_cobro`, 119) impide crear un cobro de negocio sin su conexión. Nunca se usa el token de StylerNow para anticipos. |
| Verificación automática del pago | Sí: consulta a la API, monto, `live_mode` y `collector_id` = cuenta del negocio (`sincronizar.ts`) |
| Reembolsos con la cuenta del negocio | Sí: con el token de la conexión que cobró (`reembolsos.ts`). Sin saldo queda en revisión y StylerNow no pone fondos. |
| **PSE** | **No**: hoy se excluye PSE en los cobros de negocios porque el código asumía la restricción del Split 1:1 |

**No hay que reemplazar el sistema de pagos.** Se ajusta un solo punto (PSE), con un interruptor aislado, y queda pendiente la validación.

## 2. Inventario y clasificación de componentes

| Componente | Archivo / tabla / función | Clasificación |
|---|---|---|
| Inicio de OAuth (state de un solo uso, PKCE, cifrado) | `src/app/api/pagos/mercadopago/conectar/route.ts`, `oauth_iniciar` | COMPATIBLE |
| Callback OAuth (state ligado al dueño, canje, guardado cifrado) | `src/app/api/pagos/mercadopago/callback/route.ts`, `oauth_consumir`, `conexion_guardar` | COMPATIBLE |
| Tokens del vendedor (AES-256-GCM, solo servidor, renovación, revocación) | `src/lib/pagos/cifrado.ts`, `conexiones.ts`, tabla `conexion_pago_negocio`, `conexion_renovar_tokens`, `conexion_marcar_estado`, `conexion_desconectar` | COMPATIBLE |
| Aislamiento: conexión ↔ negocio | RLS sin acceso de clientes, `conexion_pago_estado` con `is_barberia_de`, pruebas `cobro_directo_119.sql` y `aislamiento_multiempresa.sql` | COMPATIBLE |
| Creación del cobro (Preferences API) | `src/lib/pagos/cobro.ts` → `crearPreferencia` | COMPATIBLE CON AJUSTES (PSE, ver §7) |
| Orders API | No implementada. La credencial actual recibe 403 en `/v1/orders`. | INEXISTENTE / PENDIENTE DE CONFIRMACIÓN CON MERCADO PAGO (OAuth con Orders no documentado) |
| `external_reference` | = `pago.id` (único por cobro). La reserva está ligada en `pago.reserva_id`. | COMPATIBLE |
| `collector_id` | Se verifica en cada pago contra `conexion_pago_negocio.cuenta_externa_id` | COMPATIBLE (pendiente de prueba real con vendedor) |
| Webhook | `src/app/api/webhooks/pasarela/mercadopago/route.ts`: firma HMAC, anti-replay, `webhook_evento`, `?c=<conexión>`, `mp-connect` | COMPATIBLE. La firma de `mp-connect` está pendiente de prueba real. |
| Confirmación de reserva | `aplicar_evento_pago` (008/069/117/119): solo con estado APROBADO consultado a la API | COMPATIBLE |
| Reembolsos | `reembolso`, `reembolso_evento`, `reembolso_tomar_pendientes`, `reembolso_registrar_resultado` (116), `src/lib/pagos/reembolsos.ts` | COMPATIBLE |
| Libro financiero | `libro_movimiento` (122) con evidencia del proveedor (129) | COMPATIBLE |
| Motor de anticipos | `calcular_sena_servicios`, `aceptacion_politica_reserva`, `configurar_anticipo` (116/129) | COMPATIBLE |
| Suscripción SaaS de StylerNow | Cobros PLATAFORMA con el token de StylerNow (`beneficiario_pago`) | COMPATIBLE (separada) |
| **Wallet heredado** | `wallet`, `wallet_movimiento`, `revertir_comision_wallet`, `/panel/wallet` | **INCOMPATIBLE con el modelo** (representa custodia). Los cobros directos ya no lo acreditan (119). **Mantener y revisar**: hay que decidir si se oculta, porque contiene el histórico. |
| **Anuncios descontados del wallet** | `registrar_clic_patrocinado` / `registrar_impresion_patrocinada` (043): debitan `wallet_movimiento` tipo CAMPANA | **INCOMPATIBLE** a futuro: sin custodia no hay saldo del cual descontar. Debe pasar a cobro directo de StylerNow. **Revisar después.** |
| Comisión de plataforma | `negocio.comision_plataforma_pct` (0 % por defecto), `comision_cambio_programado` (117) | COMPATIBLE: en 0 no se envía fee |
| Gift cards / membresías | Cobro del negocio con su token (119) | COMPATIBLE |
| Panel `/panel/cobros` | Conectar y desconectar, estado real | COMPATIBLE |
| Clasificación "Split 1:1" en documentos y código | Comentarios y `TIPOS_EXCLUIDOS_SPLIT` | COMPATIBLE CON AJUSTES (nomenclatura; no afecta el funcionamiento) |

## 3. Arquitectura actual (y propuesta: es la misma, sin split)

```
Cliente ── reserva ──> crear_reserva ──> monto_sena (base de datos)
   │                                        │ sin conexión del negocio → 0 → reserva confirmada sin cobro
   ▼                                        ▼
acepta política (116) ──> pago SENA  (trigger 119: cuenta_cobro = NEGOCIO, conexión obligatoria)
                              │
StylerNow (servidor) ── token OAuth del NEGOCIO (descifrado en memoria) ──> POST /checkout/preferences
                              │                        (sin marketplace_fee, external_reference = pago.id)
                              ▼
Cliente paga en Mercado Pago ──> dinero a la CUENTA DEL NEGOCIO (collector = negocio)  [evidencia C pendiente]
                              │
Webhook (firma) + consulta GET /v1/payments/{id} con el token del negocio
   verifica: monto, live_mode, collector_id = negocio  ──> reserva CONFIRMADA ──> libro (evidencia)
Cancelación ──> reembolso con el token del negocio (sin fondos de StylerNow)
Suscripción SaaS ──> token de StylerNow (separado)
```

Diferencia propuesta frente a hoy:
1. Dejar de llamarlo "Split".
2. **Habilitar PSE solo si Mercado Pago confirma** que en este modelo no aplica la restricción "solo dinero en cuenta" del Split 1:1.

## 4. Viabilidad según la documentación oficial (fase 2)

| # | Pregunta | Documentación oficial | Comprobado por API | Requiere confirmación de Mercado Pago |
|---|---|---|---|---|
| 1 | ¿OAuth sin configurar Marketplace? | La guía de OAuth solo pide configurar URLs de redirección. **No documenta** que exija Marketplace ni que se permita sin él. El panel nuevo muestra "URL de redireccionamiento si tu integración se realiza con OAuth" en una app Checkout Pro, sin opción marketplace (lo vimos en tu pantalla). | No (faltan credenciales OAuth) | **Sí** |
| 2 | ¿Preferencia solo con el token del vendedor? | Documentado **solo dentro de la guía de marketplace**: "utilizando necesariamente el token de acceso para cada vendedor". | No | **Sí** |
| 3 | ¿El vendedor es el `collector_id`? | `collector_id` identifica "al cobrador" (Cust ID). No está documentado de forma explícita para OAuth. | No | Sí |
| 4 | ¿Omitir `marketplace_fee`? | El ejemplo usa `marketplace_fee: 0`. **No documentado** si omitirlo cambia la clasificación. | No | **Sí** |
| 5 | ¿PSE en este Checkout Pro? | Checkout Pro CO ofrece PSE. **El Split 1:1 "sólo permite pagos con dinero en cuenta… no transferencias de instituciones financieras externas".** No se sabe si aplica sin fee. | `/v1/payment_methods` lista `pse:bank_transfer` activo en CO | **Sí (bloqueante para PSE)** |
| 6 | ¿Vendedor persona natural? | **No documentado.** El Split exige KYC nivel 6. | — | **Sí** |
| 7 | Permisos | `read`, `write`, `offline_access`. `offline_access` es necesario para renovar. | Configurados en tu app | No |
| 8 | Producción | Activar credenciales (formulario y sitio web), SSL obligatorio, calidad opcional. **No documentada** una aprobación para apps OAuth. | — | Sí |
| 9 | Tokens | Access token de 180 días. Código de autorización de 10 min y un solo uso. El refresh se renueva en cada uso. La revocación borra los tokens. `mp-connect` envía `application.authorized` / `application.deauthorized`. | 401 con un token inválido (sandbox) | Si el refresh anterior queda inválido |
| 10 | Reembolsos | `POST /payments/{id}/refunds`, plazo de 180 días. **Sin saldo, "la transacción será rechazada".** No documenta qué token usar. | No (sin pago aprobado) | Sí |

**Mercado Pago no exige Marketplace en lo documentado, pero tampoco lo descarta.** No se detuvo la preparación técnica porque es la misma integración existente. Lo que no se hace es habilitar PSE en producción ni declarar el modelo aprobado.

## 5. Conflictos detectados

1. **PSE y Split 1:1:** si Mercado Pago considera este flujo como Split 1:1, PSE no estaría disponible. Hoy está excluido. Solo se habilita para la prueba en sandbox con un interruptor (§7).
2. **Orders API:** tu app nueva está en "API de Orders", pero el código usa Preferences, verificado y documentado con el token del vendedor. Para OAuth con Orders no hay documentación, y la credencial actual recibe 403 en `/v1/orders`. **Se mantiene Preferences** hasta confirmar Orders + OAuth.
3. **Wallet y anuncios** (§2): hay que revisarlos por la regla de no custodiar dinero de los negocios. No se tocaron.
4. **Las credenciales locales no son de la app nueva:** las `TEST-` de `.env.local` son de tu cuenta real, no de un usuario de prueba, y no tienen Orders.
5. **Preview y producción comparten la base de datos:** las pruebas OAuth de punta a punta requieren una base de pruebas separada o aplicar la 129 (aditiva).

## 6. Pruebas realmente ejecutadas (evidencias)

| Prueba | Resultado real |
|---|---|
| Sandbox: identidad de la credencial `TEST-` local | 200, sitio MCO, **no es usuario de prueba** (cuenta real del integrador) |
| Sandbox: medios activos en CO | Incluye `pse:bank_transfer` y `efecty:ticket` |
| Sandbox: crear preferencia con exclusión de PSE y Efecty | 201. Mercado Pago guarda la exclusión. |
| Sandbox: pago por API con tarjeta de prueba | **403 "Payer email forbidden"**: requiere un comprador de prueba |
| Sandbox: `/v1/orders` (3 variantes) | **403 "At least one policy returned UNAUTHORIZED"** |
| Sandbox: token inválido | 401 |
| Script `verificar-checkout-vendedor.mjs` con la credencial local | **Rechazado por diseño**: no es usuario de prueba |
| Automatizadas | Ver §10 |

**No ejecutadas, bloqueadas (no simuladas):** OAuth con vendedor de prueba, preferencia con el token del vendedor, `collector_id` = vendedor, PSE, webhook real, confirmación de reserva con pago real de sandbox, reembolso de sandbox.

## 7. Cambios realizados en esta auditoría (mínimos y aislados)

- `src/lib/pagos/entorno.ts`: `tiposExcluidosCobroNegocio()`. Por defecto excluye PSE y Efecty, igual que antes. Con `MERCADOPAGO_PSE_NEGOCIOS=probar` habilita PSE **solo en SANDBOX**; en producción no cambia nada. Probado en `tests/pagos-sandbox.test.ts`.
- `src/lib/pagos/cobro.ts`: usa esa función.
- `tests/sandbox/verificar-checkout-vendedor.mjs`: script de evidencias A y B con una **cuenta vendedor de prueba**. Se niega a operar con cuentas que no sean de prueba y no imprime tokens.
- No se modificaron `.env`, producción, datos, otras integraciones ni migraciones aplicadas.

(La fase anterior dejó, también sin commit: la migración 129 y la separación sandbox/producción. Ver `docs/INFORME_SANDBOX_MERCADO_PAGO.md`.)

## 8. Procedimientos

### Validar PSE
1. Confirmación escrita de Mercado Pago (preguntas en §11).
2. En sandbox, con el vendedor de prueba:
   ```
   VENDEDOR_TOKEN_PRUEBA=… node tests/sandbox/verificar-checkout-vendedor.mjs preparar --con-pse
   ```
   Abrir la URL en incógnito y comprobar si **aparece PSE** en el checkout. Si no aparece o falla, **PSE no está validado**: no se reemplaza por una tarjeta para darlo por bueno.
3. Si el sandbox no permite completar PSE (es un medio diferido), queda pendiente de la prueba real controlada (abajo).

### Liquidación real (evidencia C). **No ejecutar sin tu autorización expresa.**
1. Un negocio real que autorice por escrito la prueba y conecte su cuenta (verificada) por OAuth en producción.
2. Un importe mínimo acordado (por ejemplo, el mínimo que permita Mercado Pago).
3. Tu aprobación explícita antes de iniciar.
4. Un pago real con el medio acordado (tarjeta y, si Mercado Pago lo confirmó, PSE).
5. El negocio comprueba en **su** cuenta de Mercado Pago el movimiento acreditado; StylerNow comprueba en la **suya** que **no** entró nada.
6. Evidencia: id del pago, `collector_id`, captura del movimiento en la cuenta del negocio, registro en `/admin/libro`.
7. Reembolso de prueba solo si está autorizado.

## 9. Bloqueos (qué falta y quién lo provee)

| Falta | Para qué | Quién |
|---|---|---|
| `MERCADOPAGO_CLIENT_ID` / `MERCADOPAGO_CLIENT_SECRET` de prueba de la app "stylernow Marketplace" | OAuth | Tú: Tus integraciones → Credenciales. Ponerlos en tu entorno, no en el chat. |
| Cuenta **vendedor** de prueba (Colombia) y su access token | Pruebas A y B, OAuth | Tú: Tus integraciones → Cuentas de prueba |
| Cuenta **comprador** de prueba | Pagar en Checkout Pro | Tú |
| URL https de pruebas registrada en la app (Redirect y Webhook) | OAuth y webhook reales | Tú (`pruebas.stylernow.com` u otra) |
| Base de datos de pruebas, o aplicar la 129 | Correr la app con la integración nueva | Decisión tuya |
| Respuestas escritas de Mercado Pago (§11) | PSE y legitimidad del modelo | Tú, con soporte o un asesor comercial |

## 10. Pruebas automatizadas e instrucciones locales

```
npx supabase db reset --local          # base local limpia (001→129)
for f in tests/sql/*.sql; do docker exec -i supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < $f; done
bash tests/sql/hotfix_staff_nulo_verificacion.sh
npx vitest run                          # incluye tests/pagos-sandbox.test.ts (entornos, firma, PSE, evidencia)
npx tsc --noEmit && npx eslint src tests && npx next build
```

Cobertura relevante, con mocks solo en unitarias:
- OAuth (state de un solo uso y ligado al dueño, CSRF, formato de cuenta);
- renovación y revocación;
- aislamiento entre negocios;
- cuenta de cobro inmutable;
- cobro sin conexión prohibido;
- webhook duplicado, firma inválida y antigua;
- entorno y vendedor del pago;
- reembolsos (pendiente, fallido, confirmado una sola vez);
- libro.

## 11. Preguntas para Mercado Pago (enviar por escrito)

1. ¿Una app de Checkout Pro puede usar OAuth para crear preferencias con el access token del vendedor, **sin `marketplace_fee`**, quedando **fuera** del producto Split 1:1? ¿Cambia algo si se envía `marketplace_fee: 0`?
2. En ese caso, ¿aplica la restricción "sólo dinero en cuenta / sin transferencias de instituciones externas"? ¿**PSE**, tarjetas y Efecty quedan habilitados?
3. ¿El `collector_id` es el vendedor y el dinero se acredita íntegramente en su cuenta?
4. ¿Qué nivel de KYC necesita el vendedor? ¿Una **persona natural** puede recibir PSE y tarjetas por esta vía? ¿Con qué límites?
5. ¿La app OAuth o la figura de integrador requieren aprobación, homologación o contrato antes de producción?
6. ¿Los reembolsos con el token del vendedor se descuentan solo de su saldo? ¿Qué pasa si no tiene saldo?
7. ¿OAuth funciona con la **API de Orders** de Checkout Pro en Colombia?
8. ¿El refresh token anterior queda invalidado tras cada renovación?

## 12. Matriz de riesgos

| Riesgo | Impacto | Control actual |
|---|---|---|
| Mercado Pago clasifica el flujo como Split y prohíbe PSE | Medio: solo tarjetas y dinero en cuenta | PSE excluido por defecto; confirmación pendiente |
| El dinero llega a StylerNow por error de configuración | Alto (tributario) | Trigger de la base (sin conexión no hay cobro); verificación de `collector_id`; prueba de liquidación real (§8) |
| Token del vendedor expuesto | Alto | Cifrado AES-256-GCM, solo servidor, sin logs, tabla sin acceso de clientes |
| Pago de otro negocio o de otro entorno aplicado a una reserva | Alto | `collector_id`, `live_mode` y conexión del webhook verificados |
| Reembolso sin saldo del vendedor | Medio | Queda en revisión; StylerNow no financia |
| Token revocado o vencido | Medio | Renovación automática, `mp-connect` y estado real en el panel |
| Credenciales de prueba en producción o al revés | Alto | `entorno.ts` y conexiones atadas al entorno |
| Wallet o anuncios heredados con lógica de custodia | Medio | Los cobros directos no los acreditan; revisión pendiente |

## 13. Recomendación final

**Integración técnica preparada, pero liquidación directa de fondos pendiente de validación real.** No se puede declarar APROBADA ni APROBADA CON RESTRICCIONES todavía, porque no se ejecutaron:
- OAuth con un vendedor de prueba;
- la comprobación de `collector_id` = vendedor;
- PSE;
- la liquidación real.

Además falta la confirmación escrita de Mercado Pago sobre el modelo sin split. La arquitectura existente **sí se reutiliza íntegra**: no hay que reemplazar el sistema de pagos, solo cerrar estas validaciones.
