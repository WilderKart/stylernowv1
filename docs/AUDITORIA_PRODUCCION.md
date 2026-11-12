# Auditoría de salida a producción — StylerNow

Fecha: 2026-11-11 · Método: 4 auditorías en paralelo (cliente, panel/staff/admin, seguridad y BD, calidad y operación) con pruebas reales contra el servidor local, la BD compartida y `stylernowv1.vercel.app`, más el grafo de código (memory MCP). Cada cifra sale de una prueba o de un conteo; lo que no se pudo verificar está en la sección 6.

## 1. Porcentaje de avance hacia producción: ~66 %

| Zona | Estimación | Peso | Aporte |
|---|---|---|---|
| Seguridad y base de datos | 78 % | 25 % | 19,5 |
| Cliente (app pública y con sesión) | 72 % | 25 % | 18,0 |
| Panel de negocio, staff y admin | 60 % | 20 % | 12,0 |
| Calidad de código y operación | 55 % (código 75 %, operación 40 %) | 30 % | 16,5 |
| **Total** | | | **≈ 66 %** |

Las estimaciones por zona son juicio de cada auditor con la evidencia que cita; la ponderación es mía. Con los bloqueantes de la sección 2 y lo prioritario de la 3 cerrados (1 a 2 semanas de trabajo) se llega a ~85 %.

## 2. Bloqueantes (P0): no salir sin esto

| # | Pendiente | Evidencia | Quién |
|---|---|---|---|
| 1 | **Las funciones por plan se saltan con las RPC.** Con el negocio en ESSENTIAL, el dueño ejecutó por REST `crear_plan_membresia`, `crear_campana_sellos`, `crear_regla_cashback`, `crear_regla_recompensa` y `sembrar_niveles_vip_default` (200). La migración 110 solo cubre INSERT/UPDATE/DELETE directos; esas RPC solo validan `is_barberia_de` | Panel #1 | Migración nueva: `negocio_tiene_funcion` dentro de esas RPC (y de actualizar/alternar) |
| 2 | **La UI no bloquea nada por plan.** Un ESSENTIAL ve Membresías, Sellos, Cashback, Club VIP y "Nuevo plan" en `/panel/lealtad` sin aviso de upgrade | Panel #2 | Código |
| 3 | **`congelar_membresia` sin `FOR UPDATE`**: 8 llamadas en paralelo movieron `fecha_proximo_cobro` 120 días en vez de 15; un cliente puede evitar el cobro de su membresía | Seguridad N1 | Migración nueva |
| 4 | **`crear_pago_sena` no es idempotente bajo concurrencia**: 6 llamadas paralelas dejaron 4 pagos PENDIENTE | Seguridad N2 | Migración nueva (lock o índice único parcial) |
| 5 | **`negocio` legible por anónimos con todas las columnas** (`identificacion_fiscal`/NIT, `owner_user_id`, `email_contacto`, `telefono_contacto`, `comision_plataforma_pct`, `plan_codigo`). Hoy vacíos en datos de prueba; con negocios reales se filtrarían | Panel #3 | Vista pública con columnas mínimas o REVOKE por columna |
| 6 | **`MERCADOPAGO_WEBHOOK_SECRET` casi seguro sin configurar en Vercel** (el webhook respondió 200 sin firma). El estado igual se relee de Mercado Pago, pero debe responder 401 sin firma | Seguridad N3 | Configurar en Vercel + endurecer el código |
| 7 | **Variables de entorno de producción sin confirmar**: `NEXT_PUBLIC_SITE_URL` (si falta, los retornos de pago caen a `localhost:3000`), `CRON_SECRET`, `MERCADOPAGO_ACCESS_TOKEN`, `RESEND_API_KEY`, `PRUEBA_HASH_PEPPER`, `CSP_ENFORCE` | Calidad | Tú en Vercel |
| 8 | **Políticas RLS de `familia_grupo` y `familia_miembro` con recursión infinita** (error 500): la función de familias está rota | Seguridad N4 | Migración nueva |
| 9 | **Higiene de la BD de producción**: 277 de 283 usuarios y los 17 perfiles `es_supersu` son de prueba; 93 negocios QA (visibles en la home pública y en el mapa); 37 notificaciones sin leer en la cuenta de prueba | Seguridad N9, Cliente B3 | Purga + crear el SuperSU real + MFA |
| 10 | **Cero pruebas automáticas y cero CI** para un sistema con pagos, RLS y cron | Calidad | Código (propuesta en la sección 5) |
| 11 | **Sin observabilidad**: solo `console.error`; no hay forma de enterarse de errores en producción | Calidad | Sentry o Vercel Analytics + Speed Insights |
| 12 | **Textos legales en borrador** (sin revisión de abogado colombiano) y **BannerCookies sin montar** | Calidad | Tú + código |
| 13 | **Zoom bloqueado** (`userScalable:false`, `maximumScale:1`): incumple WCAG 1.4.4 | Calidad | Código |
| 14 | **Registrar las migraciones 100 y 107–113 en `schema_migrations`** (están aplicadas pero no registradas; un `supabase db push` intentaría reaplicarlas) | Seguridad | Tú / yo con permiso |

## 3. Prioridad alta (P1)

**Cliente**
- **Inglés inexistente:** con `locale=en` toda la interfaz sigue en español y `<html lang="es">`; solo cambia el formato de moneda. Con país US los precios siguen en COP sin etiqueta (B1).
- **Mosaicos "UÑAS" y "ESTÉTICA" de la home devuelven 0 resultados** (categorías `unas` y `estetica` no existen en la BD; los chips sí funcionan) (B2).
- **La home solo muestra 24 negocios** sin "ver más" ni paginación (B3).
- **Voseo en toda la app** ("tenés", "podés", "Ingresá", "Elegí", "Reintentá"): 124 líneas en 71 archivos según el barrido de código. Mezclado con tuteo. Incluye mensajes de error, `forbidden.tsx`, `error.tsx` y el resumen de reserva.

**Panel / admin**
- **Rendimiento:** `/panel` 22,7 s en la primera carga (4–5 s después), `/panel/agenda` 4–8 s, `/panel/crm` ~3 s. Medido con otros scripts corriendo; hay que remedir en frío y en producción.
- **`/api/ia/exportar` deja pasar a staff y guardián** y `/api/crm/exportar` da 403 al SuperSU: confirmar si es lo deseado.

**Seguridad**
- **CSP con `script-src` solo en modo reporte** (`CSP_ENFORCE=1` pendiente de probar con Google, Mercado Pago y mapa).
- **Rate limit en el borde** (Vercel Firewall) para `/rest/v1/*` y `marketplace_buscar`: lecturas anónimas costosas (`sede_horario_excepcion` 5,7 s con timeout, `servicio_producto_consumo` 5,4 s).
- **Advisors de rendimiento:** 69 `auth_rls_initplan`, 230 `multiple_permissive_policies`, 101 FKs sin índice.
- **Leaked password protection desactivada**; 3 funciones con `search_path` mutable; extensiones en `public`.
- **Bucket `avatars` con listado anónimo** (devuelve los UUID de usuario) y **`soporte-adjuntos` sin lista de MIME**.

**Calidad**
- **Contrastes del tema claro:** texto blanco sobre naranja (3,33), `text-faint` sobre superficie (4,06) y rojo danger (3,84) no llegan a 4,5.
- **SEO base ausente:** no hay `robots`, `sitemap` ni `og:image`; `canonical` solo en 2 páginas.
- **Bundle compartido ~560–710 KB** sin comprimir hasta en la landing.
- **`.env.example` desactualizado.**
- **Archivo basura `({` en la raíz** y 14 componentes `ui/` sin usar.

## 4. Prioridad media y baja (P2)

- Texto "HASTA NULL MIEMBROS" en `/lealtad` cuando no hay límite (B5); nombre de perfil sin límite de 300 caracteres y códigos de país de teléfono fuera de CO/US/MX/ES (B6); "Ingresá tu contraseña para ." con correo vacío (B7); `/legal` y `/negocio` dan 404 aunque el registro los lista (B8); páginas 404 con HTTP 200 (B9); mezcla de inglés ("My Look", "Gift cards") (B10).
- `registrar_egreso_caja` con categoría inválida devuelve un error crudo; `prompt()` nativo en reportes; panel/staff bloqueados devuelven 200 con pantalla de "sin acceso" en vez de 403; texto de cara al usuario sobre el ROI de IA sin fuente de datos.
- Bloqueo de PIN de gift card permite DoS dirigido (conociendo el código); PIN aún de 4 dígitos.
- `uuid <11.1.1` vía `exceljs` (2 moderados).
- Reducir los 78 `as unknown as`; dividir archivos de 600–970 líneas.
- Deuda del registro (TECH_DEBT): reintentos de cobro, rollover de temporada, impersonación SuperSU, StylerWallet en el POS, uso de membresía en la reserva, etc.

## 5. Funciones del plan competitivo: estado real

| Función | Estado |
|---|---|
| 4.1 enlace de reservas (puente) | Hecho. **Reservar con Google real**: sin empezar |
| 4.2 Datáfono Mercado Pago Point | No existe |
| 4.3 Caja menor | Hecho y probado de punta a punta (dueño y guardián sí; staff, cliente y negocio ajeno no) |
| 4.4 Push nativo | No existe |
| 4.5 Recargas de WhatsApp | No existe |
| 5.1 Importación CSV | No existe |
| 5.2 Reportes | Parcial (faltan retención, ocupación y ausencias) |
| 5.3 Política de cancelación | Parcial (falta aceptación explícita y penalización automática) |
| 5.4 Perfil público + JSON-LD | Hecho (sin XSS); falta `og:image` |
| 5.5 Marketplace | Existe (falta paginación y sanear datos de prueba) |
| 5.6 Lista de espera / DIAN / PSE-Nequi / recepcionista IA | Parcial / no existe |
| 7.1 a 7.3, 7.6 | Hechos |
| 7.4 filtros en hoja inferior | Hecho con componente propio |
| 7.5 pin negro | No verificado |
| Planes v3 | Código y BD migrados; precios 69.900 / 139.900 / 279.900 / desde 599.000 |

**Tests mínimos propuestos:** Vitest para lógica pura (`sena`, `planes`, `route-registry`, validadores); SQL de pruebas negativas de RLS por rol y por plan; 3 flujos Playwright (login OTP, reservar, pagar anticipo en sandbox); prueba del webhook (firma inválida, idempotencia); GitHub Actions con tsc, eslint, `check:auth`, build y lo anterior.

## 6. Lo que NO se pudo verificar

- Variables de entorno de Vercel, backups/PITR, firewall de Vercel/Cloudflare y MFA de las cuentas: ningún MCP los expone.
- Flags de cookies de sesión (por defecto de `@supabase/ssr`, no HttpOnly), flujo real de OTP, login con Google y checkout/webhook de Mercado Pago de punta a punta, CSRF de server actions.
- Pantallas sin datos reales: Llegué con geolocalización, calificar con cita completada, subir foto, eliminar cuenta, membresías/My Look/ofertas con datos, gating de My Look.
- **No se pulsó cada botón de cada pantalla**: se cubrieron rutas, flujos principales y muestreo. Quedan sin recorrer botón por botón `/panel`, `/staff` y `/admin`, y la activación manual de plan.
- Aislamiento con la cuenta "intruso" en esta ronda (se alcanzó el límite de sesiones de auth); sí se probó en auditorías anteriores.

## 7. Seguro (probado)

114 tablas con RLS y 0 vistas sin `security_invoker`; 27 tablas leídas como otro cliente con 0 filas ajenas; escalada de privilegios, pagos, wallet, gift card, puntos, anuncios y funciones internas bloqueados; carreras que resisten (gift card ×10, PIN ×30, mismo slot ×7, canje de wallet ×8, reactivar ×8); XSS almacenado y open redirect cerrados en producción; CORS sin cabeceras; sin secretos ni source maps en el bundle; cabeceras de seguridad correctas; matriz de acceso por rol (43 rutas × 5 roles) sin fugas; 215 cargas a 390 px y 215 a 1280 px sin errores de consola ni desborde.


---

## 8. Estado tras la ronda de correcciones (2026-11-12)

Migración **114** aplicada y validada (gating de RPC por plan, `congelar_membresia` con `FOR UPDATE`, `crear_pago_sena` con candado por reserva, columnas sensibles de `negocio` fuera de anon, familias sin recursión, `avatars` sin listado público, MIME en `soporte-adjuntos`, `search_path` fijo). Migraciones 100 y 107–114 registradas en `schema_migrations`.

| # | Bloqueante / prioridad | Estado |
|---|---|---|
| 1 | Funciones por plan saltadas por RPC | **Cerrado** (Essential recibe `FUNCION_NO_INCLUIDA` en 4/4 RPC; Prestige pasa) |
| 2 | La interfaz no bloquea por plan | **Cerrado** en Lealtad (pestañas con candado + aviso de mejora); falta el mismo tratamiento en otras pantallas |
| 3 | Carrera en `congelar_membresia` | **Cerrado** (8 simultáneas: 1 éxito, cobro +15 días) |
| 4 | `crear_pago_sena` no idempotente | **Cerrado** (8 simultáneas: 1 pago pendiente) |
| 5 | `negocio` legible por anónimos | **Cerrado** (NIT, comisión, owner y contacto privado sin acceso anon; NIT y comisión sin acceso authenticated) |
| 6 | `MERCADOPAGO_WEBHOOK_SECRET` | **Pendiente (Vercel)** |
| 7 | Variables de producción | **Documentadas** en `.env.example`; **pendiente confirmarlas en Vercel** |
| 8 | Familias (recursión RLS) | **Cerrado** (lectura sin error 500) |
| 9 | Datos de prueba en producción | **Script listo** (`supabase/scripts/limpiar_datos_prueba.sql`), **sin ejecutar**; exige promover antes un SuperSU real |
| 10 | Sin pruebas ni CI | **Cerrado en lo básico**: 21 pruebas unitarias (Vitest) + `.github/workflows/ci.yml` (tipos, lint, auth, pruebas, build, audit) |
| 11 | Sin observabilidad | **Parcial**: Vercel Analytics y Speed Insights (solo con consentimiento de cookies). Falta captura de errores (Sentry) |
| 12 | Legal y cookies | **Parcial**: banner de cookies montado; el texto legal sigue pendiente de revisión |
| 13 | Zoom bloqueado | **No se toca (decisión del propietario)** |
| 14 | Migraciones sin registrar | **Cerrado** |
| P1 | Voseo | **Cerrado** en el código y el diccionario (más de 280 correcciones) |
| P1 | Inglés | **Hecho** para pantallas de cliente (1.076 claves nuevas); sin traducir: legal, `/para-negocios`, panel, staff, admin, mensajes de servidor y textos de `lib/` |
| P1 | Mosaicos de la home | **Cerrado** (Uñas, Spa y estética, Barbería, Peluquería devuelven resultados) |
| P1 | Paginación | **Cerrado** (24 por página, "Ver más", páginas fuera de rango no rompen) |
| P1 | SEO | **Hecho**: `robots.txt`, `sitemap.xml` (negocios activos), Open Graph y `apple-touch-icon` |
| P1 | Contraste | **Parcial**: `text-faint` y texto sobre naranja corregidos; falta el rojo de error sobre blanco |
| P1 | Rendimiento `/panel` | Re-medido: 2,5 a 3,0 s en carga estable (el 22 s era carga concurrente). Sigue sobre el objetivo de 2 s |
| P1 | CSP estricta, límite de tasa del buscador, contraseñas filtradas | **Pendiente** (Vercel/Supabase) |

Pendientes que NO dependen del código: variables de Vercel, firewall, Sentry (DSN), MFA, revisión legal, activar `CSP_ENFORCE=1`, protección de contraseñas filtradas en Supabase Auth, código OTP de 6 dígitos en Supabase Auth, ejecutar la limpieza de datos de prueba.
