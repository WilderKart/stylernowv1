# Informe de seguridad — StylerNow

Fecha: 2026-11-11 · Alcance: app Next.js 16 + Supabase (producción compartida) · Método: pruebas reales (ataque anónimo contra la API REST de producción, ataques autenticados dentro de transacciones que se revierten, revisión de código y de funciones SQL, `npm audit`, inspección del bundle). Todo lo que aparece aquí **se ejecutó**; lo que no se pudo probar está marcado como "No verificado".

Cuentas reales (ghocho88, wildercaicedo88) no se tocaron. Los ataques con escritura se hicieron con cuentas `@stylernow.test` dentro de `DO $$ … RAISE EXCEPTION` para que nada persistiera.

---

## 1. Resumen ejecutivo

**Riesgo global: MEDIO** (antes de las correcciones de este informe: MEDIO-ALTO).

La base está bien construida: las 100+ tablas tienen RLS, las vistas usan `security_invoker`, un usuario anónimo no lee ni escribe nada sensible, un usuario autenticado no puede leer ni modificar datos de otro (33 ataques de lectura/escritura/IDOR probados, 0 exitosos), el webhook de pagos valida firma HMAC **y** vuelve a consultar a Mercado Pago, y no hay secretos ni source maps en el bundle.

Se encontraron y **corrigieron en código** 4 problemas reales (pendientes de desplegar a producción al fusionar la rama): XSS almacenado en la ficha pública del negocio, bypass de la redirección abierta, Next.js con avisos críticos publicados, y ausencia de cabeceras de seguridad. Quedan **3 hallazgos abiertos de severidad media** que requieren cambio de base de datos o decisión tuya (PIN de gift card sin bloqueo, `marketplace_buscar` sin tope para anónimos, fraude de clics en publicidad).

## 2. Tabla de hallazgos

| # | Hallazgo | Severidad (CVSS 3.1 estimado) | Estado |
|---|---|---|---|
| H1 | XSS almacenado: JSON-LD de `/negocio/[slug]` no escapaba `<` | Media-Alta · 6.1 (AV:N/AC:L/PR:L/UI:R/S:C) | **Vulnerable → corregido en código** |
| H2 | Redirección abierta con `/\dominio.com` en `?next=` | Media · 5.4 | **Vulnerable → corregido en código** |
| H3 | Next.js 16.3.5 con avisos críticos (RCE en optimización de imágenes con SVG, caché, SSRF imágenes, DoS server actions) | Crítica según avisos; explotabilidad real baja aquí (SVG no habilitado, `remotePatterns` restringido) · 9.8 nominal | **Vulnerable → actualizado a 16.4.6** |
| H4 | Sin cabeceras de seguridad (X-Frame-Options, nosniff, HSTS, Referrer-Policy, Permissions-Policy, frame-ancestors); `X-Powered-By` visible | Media-Baja · 4.3 | **Vulnerable → corregido en código** |
| H5 | `aplicar_evento_pago` no comparaba el monto cobrado con `pago.monto` | Baja-Media · 4.8 (defensa en profundidad; hoy el monto sale de `pago.monto` al crear la preferencia) | **Vulnerable → mitigado en `sincronizar.ts`** |
| H6 | Gift card: PIN de 4 dígitos sin bloqueo por intentos; PIN generado con `random()`; el registro de PIN erróneo se pierde por el `RAISE` | Media · 5.9 | **Vulnerable (abierto)** |
| H7 | `marketplace_buscar` sin tope de `p_limite` y costosa, ejecutable por anónimos | Media-Baja · 5.3 (DoS por consumo) | **Parcial:** tope de 100 filas aplicado (migración 104); falta rate limiting en el borde |
| H8 | `registrar_clic_patrocinado` / `registrar_impresion_patrocinada` escriben sin validar quién llama (fraude de clics) | Media · 5.3 | **Vulnerable (riesgo aceptado, abierto)** |
| H9 | Anónimos leen `negocio.owner_user_id`, `email_contacto`, `telefono_contacto` y `resena.cliente_id` | Baja · 3.7 | **Vulnerable (decisión de producto)** |
| H10 | Migración 100 (anonimización de cuenta) sin aplicar: la eliminación de cuenta no ejecuta | Media (cumplimiento) | **Pendiente (permiso)** |
| H11 | `uuid <11.1.1` vía `exceljs` (aviso moderado) | Baja · 3.1 | Abierto, sin explotación práctica |
| H12 | Inyección SQL (RPC, filtros REST, `.or()` de PostgREST) | — | **Seguro** |
| H13 | RLS / IDOR / escalada de privilegios (lectura y escritura entre usuarios) | — | **Seguro** |
| H14 | Webhook de pagos: firma, idempotencia, estado desde la pasarela | — | **Seguro** |
| H15 | Cron `/api/cron/diario` exige `CRON_SECRET` | — | **Seguro** |
| H16 | Secretos en bundle, source maps, `.env` en git | — | **Seguro** |
| H17 | Storage: listado anónimo, subida anónima, tipos MIME | — | **Seguro** |

## 3. Detalle técnico y PoC

### H1 — XSS almacenado en JSON-LD (corregido)
`src/app/negocio/[slug]/page.tsx` insertaba `JSON.stringify(jsonLd)` en un `<script type="application/ld+json">` con `dangerouslySetInnerHTML`. `JSON.stringify` no escapa `<`, y el nombre, la dirección y los servicios los escribe el negocio.
PoC (ejecutado): un negocio llamado `</script><script>alert(document.domain)</script>` produce `{"name":"</script><script>alert(document.domain)</script>"}` → el navegador cierra el script y ejecuta el siguiente en el origen de la app, para cualquier visitante de la ficha.
Corrección: `.replace(/</g, "\\u003c")`. Verificado: el resultado ya no contiene `<` y `JSON.parse` devuelve el mismo dato.

### H2 — Redirección abierta (corregido)
`destinoSeguro` solo rechazaba `//`. Los navegadores normalizan `\` a `/` y descartan tabuladores/saltos de línea, así que `/\evil.com`, `/\t/evil.com` terminan en `//evil.com` justo después de iniciar sesión.
Corrección (`src/lib/auth/destino-seguro.ts`): rechaza `\` y caracteres de control, y resuelve el destino contra un origen ficticio exigiendo que el origen no cambie. 9 casos probados (rutas legítimas pasan; `//x`, `/\x`, `/\t/x`, `/\n/x`, `https://x`, `javascript:` → `/`).

### H3 — Dependencias (corregido)
`npm audit --omit=dev`: 7 hallazgos (1 crítico: `next`; 4 altos: `next`, `zod`, `sharp`, `source-map-js`, `brace-expansion`). Se actualizó `next` 16.3.5 → 16.4.6 y se aplicó `npm audit fix` sin cambios incompatibles. Queda `uuid` (moderado, vía `exceljs`; el arreglo forzado rebajaría `exceljs` a 3.4.0 y rompería la exportación). Tras la actualización: `tsc` y `eslint` sin errores, `build` correcto, suite de 56 pantallas autenticadas y 13 pruebas del mapa sin fallos.

### H4 — Cabeceras (corregido)
`next.config.ts` ahora envía: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors 'none'; base-uri 'self'; object-src 'none'`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security` (2 años), `Permissions-Policy` (geolocalización solo propia; cámara, micrófono y pagos desactivados) y `poweredByHeader: false`. Verificado con `curl -I`.
**Limitación honesta:** no hay CSP de `script-src` (requiere nonces en Next y probar MapLibre, Mercado Pago y Google). Es la mejor defensa adicional contra XSS; ver recomendación R7.

### H5 — Monto del cobro (mitigado)
`aplicar_evento_pago` aprueba por `external_reference` sin comparar `transaction_amount`. No es explotable hoy porque la preferencia se crea en servidor con `pago.monto` y el estado se lee de la API de MP, pero cualquier fallo futuro lo volvería crítico. `sincronizar.ts` ahora compara contra `pago.monto` (tolerancia 1 por redondeo), no aprueba si no coincide y deja `PAGO_MONTO_NO_COINCIDE` en `evento_auditoria`.

### H6 — Gift card (abierto)
`redimir_gift_card` y `_validar_gift_card_para_canje`: el código tiene 40 bits (no adivinable), pero el PIN son 4 dígitos (10.000 combinaciones; en lotes corporativos se genera con `random()`, no criptográfico; en compras individuales el mínimo es 4 caracteres). No hay bloqueo por intentos: quien conozca el código (p. ej. lo vio en un mensaje) puede probar PINs sin límite. `_validar_gift_card_para_canje` inserta en `lealtad_fraude_evento` y luego hace `RAISE`, lo que **revierte ese insert**, así que el intento fallido no queda registrado.
Control positivo: `redimir_gift_card` usa `FOR UPDATE`, por lo que dos canjes simultáneos no cobran dos veces (revisión de código; no ejecuté prueba de carrera real).

### H7 — `marketplace_buscar` (abierto)
Ejecutable por `anon` (necesario para la home). `p_limite=999999999` se acepta. Tras la migración 103 el coste bajó de ~2,7 s a ~0,4 s y la migración 104 limita la respuesta a 100 filas, pero el cómputo sigue siendo costoso y sin rate limit: un anónimo puede encadenar llamadas (falta la regla de Firewall de R2).

### H8 — Publicidad (abierto, ya conocido)
Las dos funciones de registro están en la lista permitida para `anon` y no validan al llamador: se puede inflar el gasto de la campaña de un competidor.

### H9 — Exposición menor (decisión de producto)
`negocio_select_publico` permite leer todas las columnas del negocio activo. `owner_user_id` y `resena.cliente_id` son UUID (no abren datos porque `perfil` está protegido), pero permiten correlacionar. `email_contacto`/`telefono_contacto` son de contacto público por diseño; confirma que nadie guarda ahí datos privados.

### Pruebas que NO encontraron fallos (evidencia)
- **Anónimo contra REST de producción:** `perfil, reserva, pago, wallet, lealtad_wallet, gift_card, suscripcion, evento_auditoria, ticket_soporte, reserva_foto, configuracion_plataforma` → `[]`; `notificacion_usuario, solicitud_cuenta, cliente_preferencia, consentimiento_evento, solicitud_devolucion_saldo, chat_mensaje` → `42501 permission denied`. Escrituras: POST `resena`/`reserva`/`pago` rechazados (`RESERVA_NO_ENCONTRADA`, `RESERVA_SOLO_POR_FUNCION`, RLS); `crear_pago_sena` → `permission denied`; PATCH/DELETE sobre filas inexistentes no afectan nada.
- **RLS:** consulta de catálogo: 0 tablas sin RLS en `public`, 0 vistas sin `security_invoker`. Los permisos de tabla para `anon` son los de Supabase por defecto (todos); la seguridad descansa por completo en RLS, que se verificó tabla por tabla.
- **Autenticado (cuenta de cliente de prueba contra otra):** leer reservas, perfil, pagos, wallet, notificaciones, preferencias, consentimientos, solicitudes, auditoría, suscripciones, config y fotos de otro → 0 filas. Escrituras: cancelar reserva ajena, editar perfil ajeno, editar negocio ajeno, suscripción, `es_supersu=true`, cambiar `cliente_id`/`estado` de la propia reserva (`RESERVA_EDICION_DIRECTA_NO_PERMITIDA`), `lealtad_wallet.saldo`, `lealtad_movimiento`, `wallet_movimiento`, `pago` (insertar/aprobar), favorito/aceptación legal a nombre de otro, reseña sin reserva propia, auto-vincularse como staff, código de referido propio → todo bloqueado o 0 filas. Único cambio permitido: `perfil.pais` propio (legítimo).
- **Funciones SECURITY DEFINER ejecutables por `authenticated` sin chequeo de actor:** las 22 restantes son públicas por diseño (búsqueda, slots, reseñas públicas) o triggers; `dashboard_ranking_staff_semana` de otro negocio → `NO_AUTORIZADO`.
- **SQLi:** todas las consultas usan el cliente de Supabase (parametrizado); en los 3 `.or(...ilike...)` con texto libre se eliminan `% _ , ( )` antes de interpolar; `marketplace_buscar` con `' or 1=1 --` y `'); drop table perfil;--` → sin efecto. (Los payloads por URL fueron bloqueados por el WAF de Cloudflare antes de llegar a PostgREST: no sirven como evidencia, pero el parámetro está parametrizado de todas formas.)
- **SSRF:** todos los `fetch` del servidor van a hosts fijos (MP, Resend, HIBP, proveedor de IA configurado); ninguno usa una URL del usuario.
- **Webhook MP:** firma HMAC con `timingSafeEqual`; el estado se lee de la API de MP, nunca del cuerpo; pago huérfano → auditoría + reembolso; idempotencia por `YA_PROCESADO` con `FOR UPDATE`.
- **Bundle:** 0 archivos `.map`, 0 apariciones de `service_role` ni JWT en `.next/static`; `.env.local` ignorado por git.
- **Storage:** listado anónimo de `avatars, crm-fotos, soporte-adjuntos, negocio-media` → `[]`; subida anónima de `text/plain` → `415`.

## 4. Recomendaciones con código

**R1 (H6) — Bloqueo de PIN de gift card.** Migración aditiva: columna `intentos_pin int default 0, bloqueada_hasta timestamptz`. Como un `RAISE` revierte el contador, hay que **devolver** un código en lugar de lanzar la excepción para el caso de PIN erróneo:
```sql
-- dentro de redimir_gift_card, antes de comparar el PIN
if v_gift_card.bloqueada_hasta is not null and v_gift_card.bloqueada_hasta > now() then
  raise exception 'DEMASIADOS_INTENTOS';
end if;
if v_gift_card.pin_hash <> extensions.crypt(p_pin, v_gift_card.pin_hash) then
  update public.gift_card
     set intentos_pin = intentos_pin + 1,
         bloqueada_hasta = case when intentos_pin + 1 >= 5 then now() + interval '30 minutes' end
   where id = v_gift_card.id;
  return null;            -- la app interpreta null como PIN incorrecto (el UPDATE sí persiste)
end if;
update public.gift_card set intentos_pin = 0, bloqueada_hasta = null where id = v_gift_card.id;
```
Además: PIN mínimo de 6 dígitos y generarlo con `extensions.gen_random_bytes` en vez de `random()`.

**R2 (H7) — Tope y límite de tasa.** `p_limite := least(greatest(coalesce(p_limite, 24), 1), 100)` al inicio de `marketplace_buscar` y `_filtrado`; reglas de rate limiting en el Firewall de Vercel/Cloudflare para `/rest/v1/rpc/marketplace_buscar` (p. ej. 30 req/min por IP).

**R3 (H8) — Fraude de clics.** Registrar el clic desde un Route Handler del servidor (no desde el cliente) con tabla de deduplicación `(campana_id, hash(ip+ua), día)` y retirar el `grant … to anon` de las dos funciones.

**R4 (H10) — Aplicar la migración 100.** Está en `supabase/migrations/100_anonimizar_cuenta_cron.sql`. Aplícala desde el panel de Supabase (SQL editor) o con `supabase db push`; mientras no esté, el cron reporta el error y las cuentas solicitadas no se anonimizan.

**R5 (H9)** Si no quieres exponer `owner_user_id`, crea una vista pública `negocio_publico` con solo las columnas necesarias y quita el `select` anónimo directo a `negocio`.

**R6 (H11)** Sustituir `exceljs` por una librería sin `uuid` vulnerable o fijar `overrides: { "uuid": "^11.1.1" }` y probar la exportación a Excel.

**R7 — CSP completa (defensa en profundidad contra XSS).** Añadir en `proxy.ts` un nonce por petición y `script-src 'self' 'nonce-…' 'strict-dynamic'; connect-src 'self' https://*.supabase.co https://api.mercadopago.com; img-src 'self' data: blob: https://*.supabase.co https://*.tile.openstreetmap.org; worker-src 'self' blob:` — probar mapa, login con Google y checkout antes de activarla (empezar en `Content-Security-Policy-Report-Only`).

**R8 — Verificar fuera del repositorio:** MFA obligatorio en las cuentas de Supabase, Vercel y GitHub; rotación de `SUPABASE_SERVICE_ROLE_KEY` y `MERCADOPAGO_*` si alguna vez se compartieron; `MERCADOPAGO_WEBHOOK_SECRET` configurado en producción (sin él, la firma no se verifica, aunque el estado igual se relee de la API); confirmar en Supabase Auth: confirmación de correo, longitud mínima de contraseña y protección contra contraseñas filtradas.

## 5. No verificado (límites de este informe)
- **Carreras reales** (canje simultáneo de gift card, saldo de wallet, cashback): solo revisión de código (`FOR UPDATE` presente), sin prueba concurrente.
- **Fuerza bruta de login/OTP:** existen `registrar_intento_auth` / `verificar_rate_limit_auth`; no se midió el bloqueo en vivo.
- **Flags de cookies de sesión** (`HttpOnly`/`Secure`/`SameSite`): `@supabase/ssr` no las marca `HttpOnly` por defecto (necesario para que el cliente lea la sesión). No inspeccionado en producción.
- **CSRF de server actions:** se apoya en la comprobación de `Origin` integrada de Next; no se probó con un origen falso.
- **Flujo de pago real en sandbox de Mercado Pago** y políticas de storage por usuario (solo se probó el acceso anónimo).
- **Configuración de Vercel/Cloudflare/Supabase** (firewall, retención de logs, backups, MFA).
- **Producción:** las correcciones H1–H5 están en la rama `feat/cliente-17-pantallas`; no están en producción hasta fusionar a `main`.
