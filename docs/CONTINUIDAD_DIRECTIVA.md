# Registro de continuidad: Directiva Única Integral

> **Actualización 2026-11-12 (directiva de continuidad, "independiente del proveedor de pagos").**
>
> **Nuevas migraciones** (verificadas en local, sin aplicar en producción):
> - 122: libro financiero
> - 123: auditoría completa
> - 124: notificaciones con outbox
> - 125: 13 correcciones de autorización (1 P0) e índices
> - 126: comparaciones seguras ante NULL y repone la 091b
>
> **Pruebas:** 8 suites SQL con 120 OK sobre una base limpia, `vitest` 81/81, `eslint` y `next build` en verde.
>
> **Fuera de alcance por decisión del dueño:** anticipos, devoluciones, split, proveedor, comisiones masivas y renovación automática.
>
> **No se borran datos de prueba** hasta que el dueño diga "listo".
>
> Estado, riesgos, orden de despliegue y reversión: **`docs/INFORME_AVANCE_INDEPENDIENTE_PAGOS.md`**. Auditoría: `docs/AUDITORIA_COBERTURA.md`.
>
> Para reanudar las pruebas:
> ```
> for f in directiva_116_118 cobro_directo_119 whatsapp_120 libro_122 auditoria_123 notificaciones_124 aislamiento_multiempresa seguridad_regresion; do
>   docker exec -i supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < tests/sql/$f.sql
> done
> bash tests/sql/hotfix_staff_nulo_verificacion.sh
> ```

Fuente: *StylerNow — Directiva Única Integral* (entregada el 2026-11-12). Este archivo es el punto de reanudación y se actualiza al cerrar cada fase.

**Regla nº 1 del dueño: cero confianza.**
- Nunca confiar en el navegador.
- Toda autorización, monto, cuenta de cobro y estado se decide en el servidor o en la base de datos.
- Nada de SQL armado concatenando texto.

## 1. Estado al 2026-11-12, fin de sesión

| Ítem | Valor |
|---|---|
| Fases con avance verificado en local | 0 Auditoría · C Cancelaciones y reembolsos · D Cobro directo (sin credenciales reales) · E parcial (libro inmutable, comisión con vigencia) · F Prueba gratuita · G WhatsApp interno · H parcial (`/admin/reglas`) · J Términos v3 y Privacidad v2 |
| Fases pendientes | E Libro contable por entidad y exportaciones · H Auditoría antes/después en las RPC de admin antiguas · I Revisión de UX · K Pruebas E2E y preparación de producción (ver §6) |
| Migraciones nuevas, **sin aplicar en producción** | 116, 117, 118, 119, 120, 121. La 115 se regeneró y queda con candado. |
| Script urgente, **sin aplicar** | `supabase/scripts/hotfix_2026_11_12_autorizacion_staff_nulo.sql` (P0, ver §4) |
| Verificación | Supabase local desde cero (001→121) más 3 suites SQL, **51 verificaciones**, todas OK. `tsc`, `eslint` de los archivos tocados y `check-auth-coverage` limpios. `vitest`: 52/52. `next build`: OK. |

### Cómo reanudar

1. `npx supabase start` (o `npx supabase db reset --local`).
2. Correr las tres suites SQL:
   ```
   for f in directiva_116_118 cobro_directo_119 whatsapp_120; do
     docker exec -i supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < tests/sql/$f.sql
   done
   ```
3. Correr las verificaciones del código: `npx tsc --noEmit && npx vitest run && node tools/check-auth-coverage.mjs`.
4. Seguir en §6.

### Orden de despliegue (obligatorio)

**Primero la base de datos, después el código.** El código nuevo usa tablas y funciones de 116–121.

1. Pegar en el SQL editor de Supabase, en este orden:
   1. el hotfix (ya mismo);
   2. 116;
   3. 117;
   4. 118;
   5. 119;
   6. 120;
   7. 121, cuando haya NIT y revisión legal;
   8. 115 al final: solo publica cuando la tabla de la 119 existe y haya negocios conectados.
2. Variables de entorno en Vercel:
   - `PAGOS_CIFRADO_CLAVE` (32 bytes en base64: `openssl rand -base64 32`)
   - `MERCADOPAGO_CLIENT_ID`, `MERCADOPAGO_CLIENT_SECRET`
   - `MERCADOPAGO_WEBHOOK_SECRET` (sin él, el webhook responde 503 en producción)
   - `PRUEBA_HASH_PEPPER`
   - `NEXT_PUBLIC_SITE_URL` con https
   - Opcionales: `MERCADOPAGO_OAUTH_TEST=1` para el sandbox y `MERCADOPAGO_OAUTH_PKCE=0` si la app no tiene PKCE activo.
3. En la app de Mercado Pago:
   - modelo "Marketplace";
   - Redirect URL `https://<dominio>/api/pagos/mercadopago/callback`;
   - PKCE activado;
   - webhooks hacia `/api/webhooks/pasarela/mercadopago`.
4. Desplegar el código.

## 2. Decisiones tomadas

Las decisiones de negocio vienen de la Directiva. Las técnicas son mías y se pueden revisar.

| # | Decisión | Origen |
|---|---|---|
| D1 | Cada cobro cuyo beneficiario es el negocio (anticipo, saldo, propina, gift card, membresía) se crea con el token OAuth DE SU cuenta de Mercado Pago. Lo hace cumplir un trigger: sin conexión, el pago no nace (`NEGOCIO_SIN_CUENTA_PAGO`). Planes, IA y recargas de WhatsApp van a la cuenta de StylerNow. Sin cuenta conectada, el anticipo es 0 y la reserva nace confirmada. | Directiva §7 |
| D2 | La comisión es 0 % por defecto. Se cobra como `marketplace_fee`, fijado por la base. Los 95 negocios existentes conservan su 8–10 % hasta que se programe un cambio con vigencia. | §7.4 |
| D3 | Política de cancelación por negocio dentro de los límites de Super Admin. Por defecto: con 24 h o más, 100 %; de 2 h a menos de 24 h, 50 %; con menos de 2 h, 0 %; no-show, 0 %; si cancela el negocio, 100 %. Aceptación expresa con evidencia inmutable. **Rige la política aceptada.** | §8 |
| D4 | Prueba gratuita sin tarjeta por defecto y con modalidad configurable. Al vencer sin tarjeta, REQUIERE_PLAN. | §10 |
| D5 | WhatsApp: módulo interno completo, sin envíos simulados. Primero la cuota del plan y luego las recargas, en orden de vencimiento. | §9 |
| D6 | Mercado Pago Point fuera de alcance; la documentación oficial indica que no está disponible en Colombia. | §2.8 |
| T1 | Inmutabilidad por triggers frente a los roles de API, incluido service_role. Las funciones DEFINER son la única vía de escritura. | Técnica |
| T2 | Los Términos v3 solo se publican cuando existe el cobro directo (candado en la 115). | §37 |
| T3 | No se cancela una reserva EN_CURSO. | Técnica |
| T4 | Los tokens de los vendedores se cifran en la aplicación con AES-256-GCM. Ningún rol de API puede leer la tabla de credenciales. | Técnica |
| T5 | El webhook se identifica con `?c=<conexion>` en `notification_url`. Aun así, solo se acepta si la transacción se encuentra con el token de esa cuenta y el `pago` está ligado a ella. | Técnica (la documentación no garantiza `user_id`) |
| T6 | Los pagos históricos cobrados en custodia se marcan `cuenta_cobro = PLATAFORMA`, que es lo que ocurrió. Sus reembolsos salen de la cuenta de StylerNow. | §12 |

## 3. Matriz de trazabilidad

Estados: VALIDADO (local) · INCOMPLETO · DEFECTO · NO IMPL. · SIN INTEGRACIÓN EXTERNA · BLOQUEADO EXT. · DECISIÓN.

| Req. | Módulo | Estado | Dónde | Pruebas | Falta |
|---|---|---|---|---|---|
| §8 Política configurable dentro de los límites | Reservas | VALIDADO | 116; `/panel/politica` | directiva_116_118 | Aplicar en producción |
| §8 Límites exactos de 24 h y 2 h | Reservas | VALIDADO | 116 `cancelar_reserva` | sí | — |
| §8 Aceptación expresa e inmutable | Reservas | VALIDADO | 116; casilla en `/reserva/[id]/pago` | sí | — |
| §8 No-show | Reservas | VALIDADO | 116 `marcar_no_show`; botón en la agenda | sí | — |
| §8 y §21 Reembolsos con estados y confirmación de la pasarela | Pagos | VALIDADO, SIN INTEGRACIÓN EXTERNA | 116; `lib/pagos/reembolsos.ts`; cron | sí | Probar en el sandbox de Mercado Pago |
| §8 Cierre o suspensión del negocio: reembolsos | Reservas | INCOMPLETO | Las cascadas 024/049 y la eliminación de cuenta encolan reembolsos | parcial | DECISIÓN: la suspensión por impago no cancela citas ya pagadas |
| §7.1 y §18 Separación de beneficiarios | Pagos | VALIDADO, SIN INTEGRACIÓN EXTERNA | 119 (trigger y matriz), `lib/pagos/cobro.ts` | cobro_directo_119 | Credenciales y app Marketplace |
| §7.2 OAuth por negocio y tokens separados | Pagos | VALIDADO, SIN INTEGRACIÓN EXTERNA | 119; `oauth-mercadopago.ts`, `conexiones.ts`, `/api/pagos/mercadopago/*`, `/panel/cobros` | sí, más `cifrado.test.ts` | Prueba real de OAuth en el sandbox |
| §7.2 Renovación y revocación | Pagos | INCOMPLETO | Renovación automática si faltan menos de 15 días; 401/403 marca REVOCADA | sí (revocación) | Webhook `mp-connect` (desvinculación) |
| §7.3 Medios de pago del Split 1:1 en Colombia | Pagos | BLOQUEADO EXT. | — | — | **Confirmar con Mercado Pago.** La documentación dice "solo dinero en cuenta, sin transferencias externas": PSE podría quedar fuera |
| §21 Webhook: firma, anti-replay, duplicados | Pagos | VALIDADO | `route.ts`, 119 `webhook_evento` | sí (duplicado) | — |
| §7.4 Comisión 0 % con vigencia | Finanzas | VALIDADO | 117; `/admin/reglas` | sí | DECISIÓN sobre los 95 negocios de QA |
| §11 y §19 Libro inmutable | Finanzas | INCOMPLETO | 117 | sí | Libro de doble partida por entidad, exportación Excel/CSV/PDF, conciliación, datos para información exógena (fase E) |
| §10 Prueba con o sin tarjeta | Suscripciones | VALIDADO | 118; `/panel/suscripcion`; `/admin/reglas` | sí | Cobro recurrente real (preapproval; disponible en CO según la documentación) |
| §10 Renovación de suscripciones ACTIVA | Suscripciones | NO IMPL. | Solo se cobra la prueba con tarjeta | — | Fase F2 |
| §9 WhatsApp | WhatsApp | IMPL. SIN INTEGRACIÓN EXTERNA | 120; `/panel/whatsapp`; `/admin/whatsapp`; consentimiento en Privacidad | whatsapp_120 (20) y vitest (27) | API de Meta; checkout de recargas (usar `crearPreferenciaDePago`, beneficiario PLATAFORMA) |
| §6 y §24 Auditoría de configuración | Super Admin | INCOMPLETO | Lo nuevo audita antes, después y motivo | — | `admin_set_pais`, `admin_set_plan_precio`, IA y feature flags |
| §37 Términos alineados | Legal | VALIDADO (texto), con candado | `TERMINOS_v3_texto.txt` → 115 | — | Abogado, NIT |
| §37.1 Privacidad alineada | Legal | VALIDADO (texto) | `POLITICA_DATOS_v2_texto.txt` → 121 | publicada en local | Abogado, NIT |
| §5 y §25 Aislamiento entre negocios | Seguridad | P0 corregido (local) | Ver §4 | sí | Aplicar el hotfix |
| §4.6 Push y email de recordatorios | Notificaciones | NO IMPL. | Solo dentro de la app | — | Fase G2 |
| Mayoría de edad | Cuentas | NO IMPL. | Los términos y la política dicen 18+, pero no hay verificación | — | DECISIÓN: ¿declaración en el registro? |

## 4. Hallazgos de seguridad

1. **P0, vigente en producción.** En `cancelar_reserva` y `completar_venta_pos`, la autorización se evalúa a NULL cuando la reserva no tiene staff. Cualquier usuario autenticado podía cancelar reservas ajenas o cerrar su venta POS. Se reprodujo y se verificó la corrección en local. → Hotfix y 116.
2. **P1.** `anon` y `authenticated` tienen INSERT/UPDATE/DELETE sobre las tablas de dinero; hoy solo los frena la RLS. → 117 los revoca.
3. **P1.** `iniciar_prueba_negocio` estaba abierta a `authenticated`: se podían inventar las huellas antiabuso. → 118 la deja solo para el servidor.
4. **P1.** El webhook aceptaba notificaciones sin firma si faltaba el secreto, no tenía anti-replay ni registro de duplicados, e interpolaba en la URL de la API un id sin validar. → Corregido.
5. **P2.** Con anticipo 0, la reserva quedaba PENDIENTE_PAGO y expiraba. → 119.
6. **P2.** Con cobro directo, acreditar el wallet habría duplicado el saldo del negocio. → 119 no acredita los pagos con cuenta NEGOCIO.

## 5. Bloqueos externos y decisiones del dueño

- **Mercado Pago:**
  - app Marketplace y KYC nivel 6 de los vendedores;
  - `client_id` y `client_secret`;
  - **confirmar qué medios de pago admite el Split 1:1 en Colombia (PSE, Nequi)**;
  - sandbox para probar de punta a punta.
- **WhatsApp Business API:** proveedor y número, y plantillas aprobadas por Meta.
- **Aplicar migraciones en producción:** lo hace el dueño (ver el orden de despliegue en §1).
- **Abogado** (Términos v3 y Privacidad v2), **contador** (información exógena, comisión) y **NIT**.
- **Decisiones pendientes:**
  1. ¿Programar comisión 0 % para los 95 negocios existentes?
  2. Suspensión por impago: ¿cancelar o no las citas ya pagadas?
  3. Verificación de mayoría de edad.

## 6. Próxima acción exacta

1. **Fase E.** Libro contable por entidad (StylerNow / negocio / tercero) con doble partida para los pagos, reembolsos y comisiones nuevos; vistas `security_invoker`; exportación CSV/Excel por periodo y entidad desde `/panel/reportes` y `/admin`; conciliación contra Mercado Pago.
2. **Fase H.** Antes, después y motivo en `admin_set_pais`, `admin_set_plan_precio`, `admin_set_addon_precio`, `admin_set_plan_caracteristica`, `actualizar_plan`, IA y feature flags.
3. **Fase F2.** Renovación de suscripciones ACTIVA con preapproval, cuando haya credenciales.
4. **Fase G2.** Correos de reserva y recordatorio por Resend; push con VAPID.
5. **Fase K.** Pruebas E2E con Playwright de reserva, pago en el sandbox, cancelación y reembolso, cuando haya credenciales de sandbox.
