# Dictamen: datos técnicos (IP, navegador, ubicación) y retención — memorando de decisión para el propietario

> **BORRADOR para validación jurídica humana.** Fecha: 2026-11-16. Elaborado por un agente de software con rol de abogado senior en derecho digital y protección de datos (Colombia) + ingeniero de software senior. Plataforma: StylerNow (TAWILSTACK S.A.S., NIT `[COMPLETAR: NIT]`). Base normativa verificada en `docs/legal/INVESTIGACION_NORMATIVA.md`. Hechos técnicos verificados por lectura del código el 2026-11-16 (rama `audit/produccion-integral` y worktree `stylernow-evidencias`, rama `feat/evidencias-legales`). **Este memorando no decide: presenta opciones y riesgos para que decida el propietario.**

---

## 0. Resumen ejecutivo (una página)

1. **Hoy StylerNow no guarda la IP ni el User-Agent en claro en ninguna tabla propia.** Lo que existe: (a) una huella de IP para límites de intentos (login/OTP/recuperación) que se borra a las 24 h; (b) huellas HMAC (IP, equipo, dispositivo, teléfono, documento, correo) para impedir pruebas gratuitas repetidas, sin fecha de borrado; (c) una huella con sal de IP+navegador para deduplicar clics de anuncios, sin fecha de borrado; (d) datos de navegador/SO que Sentry deriva al reportar errores (30–90 días en Sentry); (e) lo que los proveedores guardan por su cuenta: Supabase Auth (IP y user-agent de cada sesión y de algunos eventos de auditoría), Vercel (logs 1 h en Hobby).
2. **La decisión F (evidencias legales sin IP ni navegador) es jurídicamente sólida y probatoriamente suficiente.** La ley exige conservar prueba de la autorización por un medio consultable (Ley 1581 arts. 9 y 17 b; D. 1074 art. 2.2.2.25.2.5), y el valor probatorio depende de identificar al iniciador, la integridad y la fecha/hora (Ley 527 arts. 7, 9, 11, 12). Una sesión autenticada (OTP o contraseña), hora del servidor, texto exacto con SHA-256 y cadena de hashes (migraciones 145–146) cumplen eso. **La IP no prueba quién aceptó** (CGNAT, redes compartidas, VPN) y añade un dato personal más que proteger y borrar.
3. **Recomendación principal: MANTENER la decisión F para el repositorio de evidencias y MATIZARLA fuera de él**: permitir un registro de seguridad separado, con IP **seudonimizada con clave secreta (HMAC) o truncada**, retención corta (24 h para límites de tasa; hasta 90 días si se construye un registro de sesiones/alertas), informado en la política y **nunca copiado a la evidencia legal**.
4. En Colombia **no existe la base de «interés legítimo»** (Ley 1581 art. 10 enumera las únicas excepciones): el tratamiento de la IP «por seguridad» también debe estar **informado y autorizado**. Para visitantes sin cuenta, la única vía defendible es minimizar hasta que el dato deje de ser identificable y mostrar un **aviso de privacidad** en el punto de recolección (formularios de ingreso/registro), no un banner que diga «al continuar navegando aceptas».
5. De las cinco finalidades propuestas por el propietario, **ninguna requiere IP en claro ni User-Agent completo almacenado**; dos (geolocalización por ciudad y alertas por ubicación inusual) **no existen hoy en el código** y, si se implementaran, serían tratamientos nuevos que exigen informar, justificar necesidad y fijar retención.
6. Hay **cuatro incoherencias entre borradores y código** que deben corregirse antes de publicar (detalle en `REVISION_JURIDICA_BORRADORES.md`): la política v3 §2(h) afirma que los registros de inicio de sesión incluyen IP y User-Agent (no es así); el borrador `POLITICA_TRATAMIENTO_DATOS.md` invoca «interés legítimo» y «resolución de pantalla»; `TEXTOS_UI_CONSENTIMIENTO.md` propone un banner y una casilla que afirman recolectar IP y dispositivo; y el borrador de comercios hace al Negocio «autorizar el tratamiento de los datos del cliente», lo cual invierte los roles.
7. Hay **retenciones sin fecha de borrado** que contradicen el principio de limitación temporal (D. 1074 art. 2.2.2.25.2.8): `prueba_uso` (huellas), `intento_auth` (correo + resultado), `anuncio_evento_dedupe` (huella), `evento_auditoria`. Se proponen plazos en `POLITICA_RETENCION_BORRADOR.md`.

---

## 1. Marco jurídico aplicado (verificado)

| Principio / deber | Norma | Efecto en esta decisión |
|---|---|---|
| Finalidad informada | Ley 1581 art. 4 b; art. 12 | Cada dato técnico debe tener una finalidad concreta e informada antes de recolectarlo. |
| Libertad: autorización previa, expresa e informada; el silencio no autoriza | Ley 1581 arts. 3 a, 4 c, 9; D. 1074 art. 2.2.2.25.2.4 | «Al continuar navegando aceptas» no sirve como autorización; las casillas no pueden venir marcadas; no hay «interés legítimo». |
| Pertinencia / minimización | D. 1074 art. 2.2.2.25.2.1 («datos pertinentes y adecuados») | Si una huella irreversible o una IP truncada basta, la IP completa es excesiva. |
| Limitación temporal + procedimientos documentados | D. 1074 art. 2.2.2.25.2.8 | Cada categoría necesita plazo y mecanismo de borrado documentado. |
| Prueba de la autorización | Ley 1581 art. 17 b; D. 1074 art. 2.2.2.25.2.5 | Hay que conservar prueba, pero la norma no exige IP. |
| Valor probatorio del mensaje de datos | Ley 527 arts. 7, 9, 11, 12 | Lo determinante: identificar al iniciador, integridad, fecha/hora, accesibilidad. |
| Seguridad y responsabilidad demostrada | Ley 1581 art. 4 g, 17; D. 1074 arts. 2.2.2.25.3.7, 2.2.2.25.6.1 | Medidas proporcionales al riesgo, demostrables. Guardar menos datos reduce el impacto de un incidente. |
| IP = dato personal cuando es vinculable | SIC, Concepto 15-277885 | Aplica a la IP en claro y a una huella reversible; discutible para HMAC con clave custodiada. |
| Sensibles no condicionables | Ley 1581 art. 6; D. 1074 art. 2.2.2.25.2.3; sanción Mercado Libre 2025 | No exigir biometría ni más datos de los necesarios para «verificar» a nadie. |

---

## 2. Hechos técnicos confirmados (qué se recolecta hoy y dónde queda)

Leyenda: **BD** = tabla propia en Supabase; **3º** = sistema de un proveedor; **No** = no se guarda.

| # | Dato | Dónde se toma | Forma almacenada | Dónde queda | Retención real hoy | Archivo / migración |
|---|---|---|---|---|---|---|
| 1 | IP del llamador en envío de OTP, login con contraseña y recuperación | `x-forwarded-for` / `x-real-ip` | `sha256("otp-ip:"+ip)` → clave `otp-ip:<32 hex>`; **sin sal** | BD `limite_tasa_evento(clave, creado_at)` | Borrado diario de filas > 1 día (cron) | `src/lib/rate-limit.ts`; `supabase/migrations/112_limite_de_tasa.sql`; `src/app/api/cron/diario/route.ts` |
| 2 | Correo, tipo y resultado del intento de autenticación | Server Action | Correo en claro (minúsculas), tipo, `exitoso` | BD `intento_auth` | **Sin borrado** (ventana usada: 15 min) | `src/lib/auth/rate-limit-auth.ts`; `081_password_platform.sql` |
| 3 | IP + User-Agent para clics/impresiones de anuncios (visitante anónimo) o id de usuario | Server | `sha256(sal_secreta|"a:"+ip+"|"+ua)` | BD `anuncio_evento_dedupe(huella, dia)` | **Sin borrado** encontrado | `src/lib/ads/registrar-evento.ts`; `111_anuncios_validar_llamador.sql` |
| 4 | Prueba gratuita del Negocio: teléfono, documento, correo, id de dispositivo, **IP**, rasgos del equipo (navegador, pantalla, zona horaria, idioma) | Server Action + cookie `sn_disp` (httpOnly, 730 días) | HMAC-SHA256 con `PRUEBA_HASH_PEPPER` | BD `prueba_uso` | **Sin borrado**; reglas usan 365 días (IP+equipo) y 30 días (3 pruebas por IP) | `src/app/panel/suscripcion/prueba.ts`; `086`, `118`, `135_prueba_antiabuso_red_y_equipo.sql` |
| 5 | Aceptación de Términos/Política, autorización por reserva, política de cancelación, consentimientos, solicitudes de derechos | Server (RPC) | usuario, documento, versión, texto y SHA-256, origen/canal, EXPRESA/TÁCITA, hora del servidor, hash encadenado. **Sin IP ni UA** | BD `aceptacion_legal`, `autorizacion_datos_reserva`, `aceptacion_politica_reserva`, `consentimiento_evento`, `evidencia_legal` | Indefinida (inmutable) | `src/lib/auth/aceptacion-legal.ts`; `091`, `116`, `143`, `145`, `146` |
| 6 | Auditoría administrativa | Trigger BD | actor, entidad, acción, payload sin secretos, `request_id` (UUID del servidor), origen. **Sin IP ni UA** | BD `evento_auditoria` | **Sin borrado** | `123_auditoria_completa.sql`; `src/proxy.ts` |
| 7 | Errores de aplicación | Sentry SDK (cliente y servidor), túnel `/api/monitoring` | Se eliminan cookies, **todas** las cabeceras y el cuerpo; usuario solo `id`; correos/JWT enmascarados. El SDK del navegador sí deriva **navegador y SO** (nombre/versión) del `navigator.userAgent` en `contexts` | 3º Sentry | 30 días (Developer) / 90 días (Team/Business); `docs/SENTRY.md` afirma que la organización está configurada para **no guardar IP** (no verificable desde el código) | `src/lib/sentry/comun.ts`; `sentry.*.config.ts`; `docs/SENTRY.md` |
| 8 | Logs de ejecución (ruta, método, estado, **query string**) | Vercel | Texto | 3º Vercel | **1 h en Hobby** (plan actual según `docs/COSTOS_INFRAESTRUCTURA.md`); 1 día en Pro; 30 días con Observability Plus | — |
| 9 | Sesiones y eventos de Auth (login, OTP, refresh) | Supabase Auth | `auth.sessions.ip`, `user_agent`; audit logs con `ip_address` (algunos eventos) y `user_agent` | 3º Supabase (panel) y, si está activado, `auth.audit_log_entries` en el propio Postgres | Sesión: hasta que expira o se revoca (JWT 1 h, refresh rotativo; el admin puede borrar sesiones, migración 137). Logs del panel: según plan (no verificado en días). `auth.audit_log_entries`: **sin retención** si el interruptor está activo `[VERIFICAR en el panel de Supabase]` | `supabase/config.toml`; `137_admin_crm_usuarios_reportes_sistema.sql` |
| 10 | Analítica web (visitas, rendimiento) | Vercel Analytics / Speed Insights | Solo se cargan si la persona eligió «Aceptar» en el banner | 3º Vercel | Según Vercel | `src/components/privacidad/analitica.tsx` |
| 11 | Elección de cookies | Navegador | `localStorage["stylernow_cookies_v1"]` (`{analitica, en}`); con sesión también `consentimiento_evento('analitica')` | Navegador + BD | Hasta que la persona la cambie | `banner-cookies.tsx`; `acciones-cookies.ts` |
| 12 | Cookies | Navegador | `sb-*` (sesión Supabase), `sn_idioma` (idioma), `sn_disp` (id de dispositivo, 730 días, solo prueba gratuita) | Navegador | Sesión / 730 días | `src/lib/i18n/servidor.ts`; `prueba.ts` |
| 13 | Ubicación del navegador | `navigator.geolocation.getCurrentPosition` **solo tras acción explícita** («Cerca de mí», «Usar mi ubicación»); en la pantalla de reserva solo si el permiso ya estaba concedido | lat/lng con 4 decimales en la **URL** (`?lat=&lng=`) → RPC `marketplace_buscar(p_lat, p_lng)` | **No se guarda** en BD. Puede quedar en el historial del navegador y en los logs de Vercel (1 h) por ir en la query string | — | `src/components/marketplace/filtros.tsx`; `src/app/ofertas/usar-ubicacion.tsx`; `aviso-distancia.tsx`; `033_marketplace_score.sql` |
| 14 | Geocodificación inversa de la **sede del Negocio** | Server → Nominatim (OpenStreetMap) | Solo coordenadas; exige sesión | 3º OSM (coordenadas de la sede, no del usuario) | — | `src/lib/geo/direccion-desde-coordenadas.ts` |
| 15 | Geolocalización por IP (ciudad) | — | — | **No existe** en el código | — | — |
| 16 | Alertas por navegador/ubicación inusual | — | — | **No existe** en el código | — | — |
| 17 | Mosaicos de mapa | Navegador → `tile.openstreetmap.org` directamente | — | 3º OSM recibe la IP del visitante (ya informado en política v3 §5) | Según OSM | `src/proxy.ts` (CSP) |

Otros hechos relevantes para el dictamen:
- El registro tiene **una sola casilla** que cubre Términos y Política (`CasillaLegal`, `src/app/login/_componentes/campos.tsx`, usada por `src/app/registro/formulario-registro.tsx` con `useState(false)`: **no premarcada**). La aceptación de cambios **no materiales** se registra sin acción de la persona y se marca `TACITA` (migración 145; `aceptacion-legal.ts`).
- La **casilla de autorización por reserva** (migración 143) y su interfaz existen solo en el worktree `feat/evidencias-legales`, no en `main`.
- El **banner de cookies** (`banner-cookies.tsx`) ofrece «Aceptar» y «Solo necesarias» con el mismo peso visual, sin preselección; sin elección = solo necesarias. No existe banner sobre IP/navegador.
- Enlaces legales: solo la página `/para-negocios` tiene pie con Términos y Política; el encabezado general no los enlaza.
- Las funciones de WhatsApp de marketing solo llegan a clientes con consentimiento `marketing_whatsapp` (migración 120); **no se encontró** en el código un control de franjas horarias (Ley 2300 art. 3/5).

---

## 3. Análisis por finalidad propuesta

Para cada finalidad: ¿es necesaria y proporcional? ¿Qué nivel de dato basta? ¿Qué retención? ¿Relación con la decisión F?

### 3.1 Prevención de reservas falsas y anti-spam
- **Hecho**: para reservar hay que tener cuenta verificada (OTP o contraseña) y, en la rama de evidencias, marcar la autorización por reserva; el límite de intentos ya opera por huella de IP (24 h) y por correo; la base limita eventos por huella. Las reservas falsas, si existen, vienen de **cuentas**, no de IPs anónimas: la trazabilidad útil es el `usuario_id`.
- **Necesidad/proporcionalidad**: el límite de tasa es necesario y proporcional. La IP en claro **no aporta** nada que la huella no dé para esta finalidad. Lo que sí aporta valor es que la huella no sea reversible: `sha256` sin sal de una IPv4 se invierte en segundos (espacio de 2^32); hoy ese registro es, en la práctica, la IP.
- **Suficiente con**: huella **HMAC con clave secreta** (como ya hace `prueba.ts`), retención **24 h** (o hasta 7 días si se quiere investigar un ataque reciente), sin vínculo con la evidencia legal.
- **Relación con F**: compatible. Es «registro de seguridad», no evidencia.
- **Cambio técnico sugerido (no ejecutado)**: pasar `limitar()` a HMAC con `PRUEBA_HASH_PEPPER` o una clave propia. Es un cambio de una línea; no requiere decisión jurídica, pero sí anotarlo.

### 3.2 Geolocalización por ciudad
- **Hecho**: no hay geolocalización por IP; la ciudad la elige la persona (filtro) o la calcula el navegador con su permiso, y las coordenadas no se guardan.
- **Necesidad**: mostrar negocios de la ciudad **no requiere** IP: el filtro de ciudad y el botón «Cerca de mí» ya resuelven el caso de uso con un dato que la persona entrega voluntariamente en el momento y que no se conserva. Deducir la ciudad desde la IP sería un **tratamiento nuevo** (finalidad nueva → informar; cambio de finalidad → nueva autorización, art. 2.2.2.25.2.2), con precisión pobre en Colombia (IP de operadores móviles con CGNAT ubican mal la ciudad).
- **Suficiente con**: lo actual. Si algún día se quiere «sugerir» ciudad por IP: hacerlo en memoria, a nivel de **país o ciudad**, sin guardar la IP ni la deducción, e informarlo en la política. La ubicación precisa del navegador debe seguir siendo opcional, no almacenada y, si se almacena una preferencia, solo un booleano («usar mi ubicación»), como hoy en `ajustes/permisos`.
- **Matiz técnico a decidir**: las coordenadas viajan en la URL; para que no queden en logs/historial, podrían ir en el cuerpo de una petición POST o en estado de cliente. `[DECISIÓN DEL PROPIETARIO: cambiar lat/lng de query string a estado/POST]` (bajo impacto, mejora de minimización).
- **Relación con F**: no la afecta.

### 3.3 Seguridad de cuentas (alertas por navegador o ubicación inusual)
- **Hecho**: no existe. Supabase ya guarda IP y user-agent de **cada sesión activa** (`auth.sessions`) y eventos de Auth; el admin puede cerrar sesiones (137).
- **Necesidad**: la finalidad es legítima (art. 4 g, art. 17 d: seguridad) pero **no es necesaria hoy** para operar; es una funcionalidad futura. Si se construye, lo mínimo es: familia de navegador/SO (no el UA completo), **IP truncada** (IPv4 /24, IPv6 /48) o HMAC, país/ciudad aproximada calculada en memoria, hora, `usuario_id`; retención **≤ 90 días** o mientras la sesión esté activa; acceso solo del titular («Sesiones activas») y del Super Admin con auditoría.
- **Alternativa sin nuevo almacenamiento**: apoyarse en `auth.sessions` de Supabase (ya existe, ya está informado como proveedor) para mostrar «sesiones activas» al titular, sin copiar nada a tablas propias.
- **Relación con F**: compatible si el registro de sesiones vive **fuera** del repositorio de evidencias y nunca se enlaza a él.
- **Deberes añadidos** si se implementa: informar en la política (dato, finalidad, plazo), incluirlo en la matriz de retención y en el plan de incidentes.

### 3.4 Prueba de aceptación de citas y políticas (IP + fecha/hora como evidencia)
- **Hecho**: hoy la evidencia es: usuario autenticado (OTP/contraseña o Google), **hora del servidor** (`clock_timestamp()`), texto exacto y su SHA-256, versión, canal/origen, tipo EXPRESA/TÁCITA, cadena de hashes verificable (`verificar_cadena_evidencias`), filas inmutables, sin FK en cascada, copia independiente al repositorio (146). Para reservas: autorización en la **misma transacción** que crea la reserva (143).
- **Análisis probatorio**: la Ley 527 valora la confiabilidad de la generación y conservación, la integridad y **la forma de identificar al iniciador** (art. 11). El iniciador se identifica por la **sesión autenticada**, que exige algo que solo el titular tiene (código al correo, contraseña, cuenta Google). La IP **no identifica al iniciador**: en Colombia miles de personas comparten una IP pública (CGNAT móvil), las IP cambian por sesión y una VPN la altera a voluntad. En una disputa, la IP solo sirve para corroborar «desde dónde» y es fácilmente rebatible; un perito valorará más la cadena de hashes, el sello de tiempo del servidor y el vínculo con la cuenta verificada.
- **Costo de añadir IP/UA a la evidencia**: la evidencia es **inmutable e indefinida**; meter ahí IP y UA crea un dato personal adicional que **nunca se podrá borrar ni anonimizar** sin romper la cadena, lo que choca con la limitación temporal (2.2.2.25.2.8) y con la supresión a solicitud (2.2.2.25.2.6). Además amplía el impacto de un incidente (art. 17 n).
- **Conclusión**: **la decisión F es correcta**. La IP no es necesaria ni proporcional para esta finalidad. Lo que sí conviene reforzar (sin IP): (a) que el `aceptado_at` de `autorizacion_datos_reserva` use `clock_timestamp()` como las demás (hoy `default now()`); (b) guardar en la evidencia el **método de autenticación** de la sesión (`otp`, `password`, `google`) y el `request_id`, que ya existe en auditoría; (c) sello de tiempo externo opcional (p. ej. publicar periódicamente el hash de cabecera de la cadena en un lugar independiente) `[DECISIÓN DEL PROPIETARIO: anclaje externo de la cadena]`.

### 3.5 Compatibilidad móvil (User-Agent)
- **Hecho**: el UA se usa de forma transitoria para servir la página (responsive) y Sentry deriva navegador/SO al reportar un error. No se guarda el UA completo en BD. Para la prueba gratuita se guarda un HMAC de rasgos del equipo.
- **Necesidad**: para compatibilidad **no hace falta almacenar nada**; el navegador adapta la página. Para diagnóstico de errores basta nombre y versión de navegador/SO en Sentry (ya ocurre, 30–90 días), que debe **informarse** en la política (Sentry no aparece en la lista de proveedores de la v3).
- **Suficiente con**: lo actual + informar a Sentry como proveedor.
- **Relación con F**: no la afecta.

---

## 4. Sobre la decisión F: mantener, matizar o cambiar

| Opción | Qué implica | Fundamento | Recomendación |
|---|---|---|---|
| **Mantener F** (evidencias sin IP/UA) | Nada cambia en 145–147. | §3.4: suficiencia probatoria sin IP; minimización; evidencia inmutable no debe contener datos que haya que borrar. | **Sí**, para el repositorio de evidencias. |
| **Matizar F** | F sigue en evidencias; **fuera** de ellas se admite un registro de seguridad con IP seudonimizada (HMAC/truncada) y retención corta, informado en la política. | Art. 4 g y 17 d (seguridad); proporcionalidad; 2.2.2.25.2.8 (plazo). | **Sí**: formalizar lo que ya existe (límite de tasa 24 h, huellas antiabuso) y dejar la puerta abierta a «sesiones activas» ≤ 90 días. |
| **Cambiar F** (IP/UA en claro en evidencias, 90 días–6 meses) | Añadir columnas a `evidencia_legal` o tabla paralela enlazada. | Propuesta del propietario (prueba, antispam). | **No recomendado**: no mejora la prueba (§3.4), contradice la inmutabilidad (no se podría cumplir el plazo de borrado sin romper la cadena) y aumenta el riesgo. Si el propietario insiste, la única forma coherente es una tabla **separada y borrable** (ver opción C). |

---

## 5. Retención propuesta por finalidad (datos técnicos y logs de terceros)

Plazos justificados; el detalle por categoría de dato está en `POLITICA_RETENCION_BORRADOR.md`.

| Finalidad / dato | Hoy | Propuesta | Justificación |
|---|---|---|---|
| Límite de tasa (huella de IP, correo) | 24 h | **24 h** (máx. 7 días) con HMAC | Ventanas de 10 min; un día basta para detectar ráfagas. |
| Intentos de autenticación (`intento_auth`: correo, tipo, resultado) | indefinido | **30 días**, luego borrar | Ventana usada: 15 min; 30 días permite investigar un ataque de credenciales. |
| Huellas antiabuso de prueba gratuita (`prueba_uso`) | indefinido | **365 días** desde `created_at` para `ip_hash`/`equipo_hash` (ponerlos a NULL); las demás huellas mientras exista el Negocio + 12 meses | Las reglas solo miran 365 y 30 días; más allá no sirven. Teléfono/documento: la regla «una prueba por Negocio» es permanente → `[DECISIÓN DEL PROPIETARIO: ¿una sola prueba de por vida o una cada N años?]` |
| Cookie `sn_disp` | 730 días | **≤ 365 días**, alineada con la regla de 365 días | Proporcionalidad: una cookie que dura el doble de lo que la regla necesita es excesiva. |
| Huellas de clics de anuncios (`anuncio_evento_dedupe`) | indefinido | **35 días** (el dedupe es por día; la facturación de campañas es mensual) | Limitación temporal. |
| Registro de sesiones/alertas (si se construye) | no existe | **≤ 90 días** o fin de sesión | Suficiente para alertar y para que el titular revise «sesiones activas». |
| Sentry (errores con navegador/SO, id de usuario) | 30–90 días (plan) | Mantener; **documentar** en política; conservar «no guardar IP» en la organización | Diagnóstico; plazo del proveedor. |
| Vercel logs | 1 h (Hobby) | Si se pasa a Pro: 1 día; evitar Observability Plus (30 días) salvo necesidad, o excluir rutas con query string sensible | Minimización; coherente con el P0 de pasar a Pro por uso comercial. |
| Supabase Auth: sesiones | vida de la sesión | Mantener; revisar si `auth.audit_log_entries` está activado y, si lo está, purgar > 90 días o desactivarlo | Es la copia que vive en la **propia** base: responsabilidad directa de TAWILSTACK. |
| Coordenadas del navegador | no se guardan | Mantener sin guardar; sacar lat/lng de la URL | Minimización. |

---

## 6. Tabla de opciones para el propietario

| | **Opción A — F estricta** | **Opción B — F matizada (recomendada)** | **Opción C — Propuesta original (IP/UA en claro)** |
|---|---|---|---|
| Evidencias legales | Sin IP/UA. | Sin IP/UA. | IP y UA en una **tabla separada** enlazada por `evidencia_id`, borrable a los 90 días/6 meses (nunca dentro de `evidencia_legal`). |
| Límite de tasa / antiabuso | Solo huellas HMAC, 24 h / 365 días. | Igual que A. | IP en claro 90 días–6 meses. |
| Seguridad de cuentas | Solo lo que ya guarda Supabase en `auth.sessions`. | A + registro propio opcional de sesiones con IP truncada/HMAC ≤ 90 días, visible al titular. | Registro con IP y UA completos 6 meses + alertas por ciudad deducida de IP. |
| Geolocalización | Solo por acción del usuario, sin guardar. | Igual que A. | Ciudad por IP en cada visita. |
| Textos legales | Política: datos técnicos = huellas y plazos cortos. Casilla única de datos (sin mencionar IP). | A + cláusula de «registro de seguridad» con plazos. | Política y casilla deben mencionar IP, UA, ciudad y plazos; el banner no basta como autorización. |
| Riesgo jurídico | **Bajo**: minimización máxima; fácil de demostrar. Riesgo residual: que un abogado contrario alegue falta de «rastro de conexión» (rebatible con la cadena de hashes y la sesión autenticada). | **Bajo-medio**: añade un dato personal seudonimizado con plazo corto; exige documentar y cumplir el borrado. | **Medio-alto**: dato personal en claro sin necesidad demostrable (2.2.2.25.2.1), sin base para visitantes anónimos (art. 10), mayor superficie de incidente (art. 17 n), carga de supresión a solicitud (2.2.2.25.2.6), y la geolocalización por IP es un tratamiento nuevo de precisión dudosa. |
| Riesgo operativo | Mínimo cambio de código: HMAC en `limitar()`, purgas en cron. | A + diseño de «sesiones activas» (trabajo nuevo). | Cambios en proxy/acciones, nuevas tablas, cron de purga, revisión de todos los textos; posible fricción de usuarios ante un banner de IP. |
| Beneficio real contra fraude | Igual que hoy (ya funciona por huella + cuenta). | Alertas de sesión útiles para el titular. | Marginal frente a B; la IP en claro no detiene a un atacante con VPN. |
| Valor probatorio | Alto (cadena + sesión + hora de servidor). | Igual que A. | Igual que A; la IP añade un indicio débil. |

`[DECISIÓN DEL PROPIETARIO: elegir A, B o C]`

---

## 7. Contradicciones y puntos que debe decidir el propietario (no resueltos aquí)

1. **Aceptación tácita de cambios no materiales** (`aceptacion-legal.ts`; nota 1 de `PROGRESO.md`). Jurídicamente, un cambio sin nueva finalidad no exige nueva autorización (2.2.2.25.2.2 a contrario), pero registrarlo como «ACEPTA_TACITA» a nombre de la persona puede leerse como atribuirle una conducta que no realizó (el silencio no es conducta inequívoca). Opciones: (a) mantener y renombrar en la evidencia a «VERSION_APLICADA» con `accion = MODIFICA` del sistema; (b) mostrar un aviso no bloqueante «Actualizamos la redacción; vigente desde…» y registrar la notificación; (c) exigir clic siempre. `[DECISIÓN DEL PROPIETARIO]`
2. **Transición de 30 días del Staff** (migración 147, decisión D): durante 30 días se publica nombre y foto de profesionales **sin autorización registrada**. El vínculo previo y la publicación anterior pueden sustentarlo como continuidad, pero es el punto más débil frente a una queja. Alternativa: publicar solo nombre e inicial, u ocultar la foto hasta autorizar. `[DECISIÓN DEL PROPIETARIO]`
3. **Retenciones indefinidas** en `prueba_uso`, `intento_auth`, `anuncio_evento_dedupe`, `evento_auditoria` y posible `auth.audit_log_entries`: contradicen 2.2.2.25.2.8 y el propio texto de la v3 («solo durante el período necesario»). Plazos propuestos en §5 y en la política de retención. `[DECISIÓN DEL PROPIETARIO: aprobar plazos]`
4. **Huella sin sal en el límite de tasa**: la política dice «huella», pero técnicamente equivale a la IP. Cambio técnico menor pendiente de aprobación.
5. **Cuentas con registro abandonado que ya aceptaron textos** (nota 2 de `PROGRESO.md`): la FK de `aceptacion_legal` impide el borrado de la cuenta de acceso. Opciones: borrar la cuenta conservando la evidencia en `evidencia_legal` (ya sin FK) y permitir el borrado de `aceptacion_legal` por el sistema; o conservar la cuenta. `[DECISIÓN DEL PROPIETARIO]`
6. **Una casilla o dos** en el registro: hoy una. La ley no obliga a dos casillas, pero sí a que la autorización de datos sea **expresa, informada y distinguible** de la aceptación contractual. Dos casillas desmarcadas (Términos / Autorización de datos) es la práctica más defendible y coincide con lo que el propietario propone. Impacto: la base registra hoy ambos textos con el mismo origen; habría que diferenciar el `documento` en la evidencia (ya se hace: TERMINOS vs POLITICA_DATOS). `[DECISIÓN DEL PROPIETARIO: implementar dos casillas]`
7. **Banner «al continuar navegando aceptas»** (propuesto en `TEXTOS_UI_CONSENTIMIENTO.md`): no constituye autorización y no debe usarse para datos técnicos. Lo que sí procede es un **aviso de privacidad** breve en los formularios de ingreso/registro (ver texto en la revisión). `[DECISIÓN DEL PROPIETARIO: sustituir el banner propuesto por el aviso]`
8. **Dos juegos de términos paralelos** (`TERMINOS_v4_borrador.txt` vs `TERMINOS_CONDICIONES_USUARIOS.md` + `TERMINOS_COMERCIOS_ALIADOS.md`) con contradicciones (p. ej. cobro «en nombre del negocio»). Hay que elegir un conjunto canónico. `[DECISIÓN DEL PROPIETARIO + abogado]`
9. **Ley 2300**: no hay control de franjas horarias en el envío de campañas de WhatsApp. Es un requisito legal, no una opción; la decisión es **cómo** (bloquear en el servidor fuera de L–V 7–19 / sáb 8–15 y domingos/festivos de Colombia; y por país si se opera fuera).
10. **Sentry como proveedor** no figura en la política v3 §5; debe añadirse (es una transmisión internacional a un encargado).

---

## 8. Recomendación final (resumen para firmar)

- Mantener la decisión F en el repositorio de evidencias.
- Adoptar la **Opción B**: registro de seguridad separado, seudonimizado (HMAC o truncado), con plazos cortos y documentados; sin geolocalización por IP; alertas de sesión como funcionalidad futura opcional.
- Corregir los textos para que describan **exactamente** lo que hace el código (ver `REVISION_JURIDICA_BORRADORES.md`), con dos casillas desmarcadas en el registro y un aviso de privacidad en los formularios de acceso.
- Aprobar la política de retención (`POLITICA_RETENCION_BORRADOR.md`) y programar las purgas que hoy faltan.
- Someter todo a revisión de un abogado colombiano antes de publicar (migración 138 pendiente).
