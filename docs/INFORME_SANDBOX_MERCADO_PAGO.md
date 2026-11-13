# Informe: anticipos y Mercado Pago en sandbox

**Fecha:** 2026-11-12.

**Alcance:** todo se hizo en la base local (Docker) y con credenciales de prueba.
- No hubo cobros reales.
- Producción no se tocó: no se aplicaron migraciones ni se cambiaron credenciales.
- No hubo despliegue, commit ni push de esta fase.

**Estado:** el motor de anticipos y la integración están construidos y probados con pruebas automáticas y contra el sandbox real de Mercado Pago. **El flujo de punta a punta con un negocio y un comprador de prueba todavía no se pudo ejecutar.** Faltan las cuentas de prueba y las credenciales OAuth que crea el dueño (§12).

## 1. Estado inicial de la integración

| Componente | Estado al empezar | Evidencia |
|---|---|---|
| OAuth por negocio | Construido (119): state de un solo uso, PKCE, tokens cifrados con AES-256-GCM, renovación rotativa | `src/lib/pagos/oauth-mercadopago.ts`, `conexiones.ts`, pruebas `cobro_directo_119.sql` |
| Tokens de los negocios | En `conexion_pago_negocio`, cifrados por la app. Ningún rol de API los lee. | 119 |
| Preferencias | Un solo punto (`lib/pagos/cobro.ts`), con el token del vendedor y `marketplace_fee` fijado por la base (0 %) | 119 |
| Split 1:1 | Preferencia creada con el token del vendedor y fee omitido = 0 | Doc. oficial (§6) |
| Webhook | Firma HMAC obligatoria en producción, anti-replay de 15 min, registro de duplicados, id numérico | `route.ts`, 119 |
| Devoluciones | Máquina de estados (116), solo confirmadas por la pasarela, reintentos y revisión | 116, `reembolsos.ts` |
| Libro financiero | Inmutable e idempotente (122) | `libro_122.sql` |
| **Faltaba** | Separación sandbox/producción en el servidor. Verificar que el dinero lo recibió el vendedor correcto. Excluir medios no compatibles con el split. Anticipo opcional y por servicio. Pantalla para configurar el anticipo. Evidencia del proveedor (comisión y neto) en el libro. Aviso `mp-connect`. | — |

**Errores encontrados al empezar:**
- `esEntornoDePrueba()` decidía el entorno por el prefijo del token.
- Nada impedía usar un token de prueba en producción ni aceptar un pago de producción en sandbox.
- El pago no se contrastaba con la cuenta que recibió el dinero.
- Las columnas del anticipo no tenían ninguna validación: un dueño podía guardar 500 %.
- Ningún negocio podía configurar su anticipo desde el panel.

## 2. Cambios realizados

- **Migración 129 (`129_motor_anticipos_y_entorno.sql`):**
  - Modo de anticipo `OBLIGATORIO` / `OPCIONAL` / `NINGUNO`.
  - Reglas por servicio (`servicio.anticipo_pct` / `anticipo_monto_fijo`) y `calcular_sena_servicios`, usada por `crear_reserva` y `crear_reserva_manual`.
  - Validación de los valores en la base.
  - RPC auditada `configurar_anticipo`.
  - `confirmar_reserva_sin_anticipo`.
  - `pago.entorno` inmutable.
  - Evidencia del proveedor en el libro.
  - Permiso de columna `anticipo_modo`: en producción `negocio` se lee por columnas.
- **`src/lib/pagos/entorno.ts`:** entorno decidido en el servidor, guardas de token, `live_mode` y capacidades declaradas.
- **Adaptador** (`mercadopago.ts`):
  - Valida el token contra el entorno en cada llamada.
  - Lee `live_mode`, `collector_id`, `payment_type_id`, `fee_details` y `net_received_amount`.
  - Permite excluir medios en la preferencia.
  - Agrega `estadoToken()`.
- **Conexiones:** cada conexión opera solo en su entorno. `revisarConexionPorCuenta` para `mp-connect`.
- **Cobro:** guarda el entorno del pago y excluye PSE (`bank_transfer`) y Efecty (`ticket`) en los cobros de negocios.
- **Sincronización:** antes de aplicar un pago verifica que `live_mode` corresponda al entorno y que `collector_id` sea la cuenta del negocio dueño del cobro. Si no coincide, no aplica nada y deja auditoría (`PAGO_ENTORNO_NO_COINCIDE` / `PAGO_VENDEDOR_NO_COINCIDE`). Guarda la evidencia financiera del proveedor.
- **Webhook:** atiende `mp-connect` sin creerle al aviso: consulta a Mercado Pago con el token y solo marca la conexión revocada si el proveedor la rechaza.
- **UI:**
  - `/panel/politica` pasa a llamarse "Anticipo y cancelaciones", con la configuración del anticipo.
  - La pantalla de pago ofrece "Reservar sin pagar anticipo" solo si el negocio lo permite.
  - La estimación del anticipo en la reserva usa las reglas por servicio (espejo probado).
- **Tipos:** `src/types/database.ts` se regeneró desde la base local (migraciones hasta la 129).
- **`.env.example`:** variables nuevas documentadas, sin valores.

## 3. Arquitectura final de anticipos (independiente del proveedor)

```
Reserva ──calcular_sena_servicios──> monto_sena (lo fija la base, nunca el navegador)
   │   modo NINGUNO / sin cuenta conectada → 0 → reserva CONFIRMADA sin cobro
   │   modo OPCIONAL → el cliente puede confirmar sin anticipo (RPC verificada)
   ▼
Aceptación de la política (evidencia inmutable, 116) ──> pago SENA (trigger exige aceptación)
   │   beneficiario = NEGOCIO → cuenta de cobro = conexión del negocio (119)
   ▼
Proveedor (adaptador) ──> confirmación SOLO por consulta a la API del proveedor
   │   verificación: monto, entorno (live_mode), vendedor (collector_id)
   ▼
reserva CONFIRMADA  ·  libro: PAGO_CONFIRMADO con evidencia (122/129)
Cancelación ──> reembolso (116): ELEGIBLE → SOLICITADO → PROCESANDO → REEMBOLSADO | FALLIDO → REVISIÓN
```

- Reserva y pago son estados separados.
- Una devolución solicitada no es una devolución completada.
- Idempotencia:
  - `reserva.idempotency_key`;
  - `pago` con lock por reserva (114);
  - `X-Idempotency-Key` hacia el proveedor;
  - clave única por reembolso;
  - libro con clave por hecho;
  - `webhook_evento` por `x-request-id`.

## 4. Arquitectura de integración con Mercado Pago

- **Cobros de negocios:** OAuth por negocio → token del vendedor → preferencia Checkout Pro sin `marketplace_fee` (0 %) → el dinero lo recibe la cuenta del negocio. **Nunca se usa la cuenta de StylerNow para anticipos** (lo impide un trigger de la base, 119).
- **Ingresos de StylerNow** (planes, IA, recargas): cuenta de StylerNow.
- **Webhook:** `notification_url` con `?c=<conexión>`. Se valida la firma, se re-consulta el pago con el token de esa conexión y se exige que el `pago` esté ligado a la misma conexión.

## 5. Resultados de pruebas

### Contra el sandbox real de Mercado Pago (credenciales `TEST-` de `.env.local`)

| Prueba | Resultado |
|---|---|
| `GET /users/me` con la credencial de prueba | 200. Sitio MCO. La credencial pertenece a la cuenta real del integrador, no a un usuario de prueba. |
| Medios activos en Colombia (`/v1/payment_methods`) | amex, codensa, diners, master, visa (crédito); debmaster, debvisa (débito); prepagas; `efecty:ticket`; `pse:bank_transfer` |
| Crear preferencia excluyendo `bank_transfer` y `ticket` | 201. Mercado Pago guarda la exclusión y entrega URL de sandbox. |
| Token de tarjeta de prueba (titular APRO) | 201 |
| Pago por API con esa tarjeta | **403 "Payer email forbidden"**: hace falta un **comprador de prueba** creado en Mercado Pago (§12) |
| Llamada con token inválido | 401: es lo que la app interpreta como conexión revocada |

### Automatizadas (base local limpia, migraciones 001→129)

| Suite | Resultado |
|---|---|
| `anticipos_129.sql` (nueva) | 9 OK: cálculo por negocio y por servicio, máximo, aislamiento entre negocios, modo NINGUNO, validación, autorización, opcional/obligatorio, entorno inmutable, evidencia en el libro |
| Suites previas 116–128, aislamiento y seguridad | 132 OK y verificación del hotfix |
| `tests/pagos-sandbox.test.ts` (nueva) | 12 OK: entornos, token de prueba en producción, `live_mode`, firma válida/manipulada/antigua/sin secreto, evidencia del proveedor, espejo del anticipo |
| `vitest` total | 96/96 |
| `tsc`, `eslint src tests`, `check-auth-coverage`, `next build` | Sin errores |

### Escenarios de la etapa 9

| Escenario | Estado |
|---|---|
| Pago rechazado, pendiente, expirado | Lógica probada en SQL (116/119/122). **Falta en sandbox real** (comprador de prueba). |
| Webhook repetido / firma inválida / antiguo | Probados (unitarias y `webhook_evento`) |
| Importe incorrecto | Lógica existente (`PAGO_MONTO_NO_COINCIDE`). Falta en sandbox real. |
| Pago de otra cuenta o de otro entorno | Nuevo: `PAGO_VENDEDOR_NO_COINCIDE` / `PAGO_ENTORNO_NO_COINCIDE`. Falta en sandbox real. |
| Devolución total, parcial, sin saldo | Máquina probada en SQL. **Falta en sandbox real.** Sin saldo, Mercado Pago rechaza: queda FALLIDO y luego REVISIÓN. StylerNow no pone fondos. |
| Token revocado / vencido | Probado en SQL (119) y 401 real del sandbox |
| Acceso entre negocios | Probado (`aislamiento_multiempresa.sql`, `anticipos_129.sql`) |
| Cliente manipulando el anticipo | El monto lo fija la base. Probado en la 116/119. |
| Reservas o cobros duplicados | Idempotencia probada (114/116/122) |
| Errores de conexión con el proveedor | Reintentos con backoff (116) |

## 6. Limitaciones reales de Mercado Pago (documentación oficial)

- **Split 1:1:** "sólo permite realizar pagos con dinero en cuenta entre cuentas de Mercado Pago. No se permiten transferencias de instituciones financieras externas." (developers MCO, split-1-1/integrate-marketplace).
- **Reembolsos con split:** el marketplace "no podrá realizar el reembolso total si el vendedor no tuviera dinero en la cuenta". Sin saldo, el reembolso no se realiza. No hay código de error documentado.
- **No verificado en la documentación (preguntar a Mercado Pago):**
  - qué prefijo tiene el token con `test_token=true` (las páginas se contradicen);
  - si el secreto del webhook cambia entre prueba y producción;
  - si los reembolsos funcionan en sandbox;
  - los nombres de `action` de `mp-connect`.

## 7. Compatibilidad por medio de pago (anticipos de negocios)

| Medio | Checkout Pro CO | Split 1:1 | Decisión |
|---|---|---|---|
| Tarjeta crédito/débito nacional | Sí | Sí (con dinero en cuenta MP) | **Habilitado** |
| Dinero en cuenta Mercado Pago | Sí | Sí | **Habilitado** (no se puede excluir) |
| Tarjetas internacionales | No verificado | No verificado | Habilitadas solo si las acepta Checkout Pro. Confirmar. |
| PSE (`pse:bank_transfer`) | Sí | **Probablemente no** (transferencia de entidad externa) | **Excluido** hasta confirmación escrita |
| Efecty (`efecty:ticket`) | Sí | No verificado | **Excluido** |
| Nequi / Bre-B | No aparecen como medio propio | — | No disponibles |

## 8. Estado de las devoluciones

- Lógica completa y probada en SQL: total, parcial, por ventana, por el negocio, no-show (0 %), estados ELEGIBLE / SOLICITADO / PROCESANDO / REEMBOLSADO / FALLIDO / REQUIERE_REVISION, reintentos y revisión manual.
- Si el vendedor retiró el dinero o no tiene saldo, Mercado Pago rechaza y el caso queda en revisión. **No se inventa recuperación ni se usa dinero de StylerNow.**
- Falta ejecutarlo en el sandbox real con un pago aprobado de prueba.

## 9. Webhooks

Firma HMAC, anti-replay, id numérico, duplicados (`webhook_evento`), cuenta de la conexión, verificación de entorno y vendedor, y `mp-connect`.

Pendiente: probar con una notificación real del sandbox. Hace falta una URL pública con https; ver §12.

## 10. Libro financiero

Registra, por hecho y sin duplicar:
- reserva, negocio beneficiario, pago, proveedor, medio, valor bruto;
- comisión del proveedor y neto informados por Mercado Pago;
- comisión de StylerNow (0 %);
- devolución, estado, id externo y fechas;
- entorno y cuenta que recibió el dinero (evidencia).

No calcula saldos ni representa como de StylerNow el dinero de los negocios.

## 11. Variables de entorno

No tengo acceso a tu proyecto en Vercel (403), así que el estado en Vercel no se puede verificar desde aquí. "Local" indica si existe en `.env.local`.

| Variable (nombre exacto en código) | Finalidad | Dónde obtenerla | Entorno Vercel | Estado local | Sandbox ≠ producción |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SECRET_KEY` | Base de datos y Auth | Supabase → Project Settings → API | Dev / Preview / Prod | Existente | Mismo proyecto hoy |
| `NEXT_PUBLIC_SITE_URL` | URL pública (retornos, OAuth, webhook). **Debe ser https para OAuth.** | Tu dominio / URL de Vercel | Dev / Preview / Prod | Existente (http local) | Sí |
| `MERCADOPAGO_ENTORNO` | `sandbox` (defecto) o `produccion` | — | Preview: `sandbox`. Prod: `sandbox` hasta autorizar. | **Pendiente** (defecto sandbox) | Sí |
| `MERCADOPAGO_ACCESS_TOKEN` | Cuenta de StylerNow (planes, IA, recargas). No cobra anticipos. | MP → Tus integraciones → app → Credenciales | Dev / Preview / Prod | Existente (`TEST-`) | **Sí** |
| `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | Clave pública (tokenizar tarjeta) | Mismo lugar | Dev / Preview / Prod | Existente (`TEST-`) | **Sí** |
| `MERCADOPAGO_CLIENT_ID` | OAuth de los negocios (app modelo Marketplace) | MP → Tus integraciones → app → Detalles | Dev / Preview / Prod | **Pendiente** | Sí (app o credenciales de prueba) |
| `MERCADOPAGO_CLIENT_SECRET` | OAuth (secreto) | Mismo lugar | Dev / Preview / Prod | **Pendiente** | Sí |
| `MERCADOPAGO_OAUTH_PKCE` | Vacío = PKCE activo | — | Opcional | Opcional | No |
| `MERCADOPAGO_WEBHOOK_SECRET` | Firma de notificaciones | MP → Tus integraciones → app → Webhooks | Preview / Prod | Existente | **Sí** (una URL por modo) |
| `PAGOS_CIFRADO_CLAVE` | Cifrado de tokens de los negocios (32 bytes base64) | `openssl rand -base64 32` | Dev / Preview / Prod | **Pendiente** | **Sí, distinta por entorno** |
| `CRON_SECRET` | Protege `/api/cron/diario` | Generar (≥32 caracteres) | Prod / Preview | Existente | Sí |
| `PRUEBA_HASH_PEPPER` | Huellas antiabuso de la prueba gratis | Generar | Dev / Preview / Prod | **Pendiente** (usa la clave de Supabase si falta) | Sí |
| `RESEND_API_KEY` | Correo de la app | Resend → API Keys | Prod / Preview | Existente | Opcional |
| `NOTIFICACIONES_EMAIL_REMITENTE` | Remitente de notificaciones | Dominio verificado en Resend | Prod / Preview | Opcional | No |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web push | Generar un par VAPID P-256 | Prod / Preview | Pendiente (opcional) | Sí |
| `CSP_ENFORCE` | 1 = CSP en bloqueo | — | Prod | Configurada por ti en Vercel (según nos dijiste) | No |
| `VERCEL_ENV` | Lo pone Vercel; habilita producción de pagos solo en el despliegue de producción | Automática | — | — | — |
| IA (`OPENROUTER_*`, `NEMOTRON_*`, `GEMINI_*`) | Funciones de IA | Proveedores | Opcional | Parcial | — |

**No confundir:** `MERCADOPAGO_ACCESS_TOKEN` es la cuenta de StylerNow. Los tokens de los negocios **no son variables de entorno**: se obtienen por OAuth y se guardan cifrados en la base.

## 12. Configurar las credenciales de PRUEBA (lo que necesito de ti)

1. **App de Mercado Pago** (Tus integraciones → crear o usar una app) con modelo de integración **Marketplace**.
   - Redirect URL: `https://<tu-preview>.vercel.app/api/pagos/mercadopago/callback`, o tu dominio de pruebas.
   - Activa **PKCE** en "Detalles de aplicación".
2. **Cuentas de prueba** (Tus integraciones → Cuentas de prueba, país Colombia):
   - una de **vendedor**, que será la barbería de prueba;
   - una de **comprador**, que hace el pago;
   - opcionalmente una de **integrador**.

   Guarda usuario y contraseña de cada una. **No me los envíes por chat.**
3. **Webhook de prueba** en la app (modo prueba), hacia `https://<tu-preview>/api/webhooks/pasarela/mercadopago`, con los eventos **Pagos** y **Vinculación de aplicaciones (mp-connect)**. Copia la clave secreta.
4. **En Vercel → Settings → Environment Variables, entorno _Preview_:**
   - `MERCADOPAGO_ENTORNO=sandbox`;
   - `MERCADOPAGO_CLIENT_ID` y `MERCADOPAGO_CLIENT_SECRET` (los de la app);
   - `MERCADOPAGO_ACCESS_TOKEN` y `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` de prueba;
   - `MERCADOPAGO_WEBHOOK_SECRET` de prueba;
   - `PAGOS_CIFRADO_CLAVE` (nueva, solo para Preview);
   - `NEXT_PUBLIC_SITE_URL` con la URL https del Preview.
5. **Verificación:** con la sesión de un negocio de prueba, en `/panel/cobros` debe verse "Conectar mi cuenta de Mercado Pago" habilitado, y tras conectar con la cuenta **vendedor de prueba**, el estado "Conectada · Modo de prueba". El pago se hace iniciando sesión en Mercado Pago con la cuenta **comprador de prueba** (tarjeta 4013 5406 8274 6260, CVV 123, 11/30, titular APRO = aprobado, CONT = pendiente, OTHE = rechazado).
6. **Las migraciones 129 en adelante deben estar en la base que use el Preview.** Hoy el Preview apunta a la misma base de producción. Por eso el sandbox de punta a punta requiere aplicar la 129 allí (es aditiva y no cambia cobros) o usar un proyecto de Supabase separado para pruebas, que es lo recomendado.

Con eso ejecuto la lista de la etapa 9 de punta a punta y actualizo este informe con los resultados reales.

## 13. Riesgos y pendientes

- **Bloqueante para cerrar la fase:** las credenciales y cuentas de prueba de §12, más una URL https de Preview.
- **Recomendado:** un proyecto de Supabase separado para pruebas. Hoy Preview y producción comparten base.
- **Confirmar con Mercado Pago por escrito:** PSE con Split 1:1, prefijo del token de prueba, secreto del webhook por modo, reembolsos en sandbox.
- La UI para reglas de anticipo **por servicio** está pendiente: la base y el cálculo ya lo soportan.
- La firma de `mp-connect` no está verificada con un aviso real. Si Mercado Pago no envía `data.id`, la firma fallará; hay que confirmarlo en sandbox.

## 14. Pasos para pasar a producción (requiere tu autorización)

Ver `docs/GUIA_MERCADO_PAGO_PRODUCCION.md`. Nada de eso está activado.
