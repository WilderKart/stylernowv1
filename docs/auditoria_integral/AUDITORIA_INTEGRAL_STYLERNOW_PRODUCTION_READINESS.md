# Auditoría integral de StylerNow — Production Readiness

**Fecha de ejecución:** 2026-11-14 · **Alcance:** solo lectura (no se modificó código, base de datos, variables ni despliegues del proyecto).
**Código auditado:** `origin/main` (commit `3386c3b`, lo que corre en `app.stylernow.com`) en una copia temporal fuera del repositorio. La carpeta de trabajo local (`audit/produccion-integral`, con 2 commits no publicados y 83 archivos sin confirmar del otro agente) **no** se tomó como representativa de producción.
**Base de datos auditada:** proyecto Supabase `wxokamgnrpyhobkqjylm` (producción), solo consultas de catálogo y conteos agregados. No se leyeron filas con datos personales.
**Archivos relacionados:** `AUDITORIA_INTEGRAL_STYLERNOW_HALLAZGOS.csv` (25 hallazgos) y `AUDITORIA_INTEGRAL_STYLERNOW_EVIDENCIAS.md` (comandos, consultas, capturas).

> Convención de evidencia: **[E]** evidencia real (consulta o medición reproducible) · **[P]** resultado de prueba automatizada · **[S]** inspección estática del código · **[I]** inferencia técnica · **[D]** documentación previa del proyecto, no reproducida hoy · **[N]** no verificado.

---

## 1. Resumen ejecutivo

**Veredicto: NO LISTO PARA PRODUCCIÓN.**

| Indicador | Valor |
|---|---:|
| Porcentaje de implementación (cuánto está construido) | **≈ 71 %** |
| Porcentaje de preparación para producción (cuánto está comprobado y es seguro lanzar) | **≈ 35 %** |
| Confianza de la evaluación | **Baja–media** (ver §5) |
| Hallazgos | **P0: 1 · P1: 6 · P2: 10 · P3: 8** |
| Pantallas verificadas en ejecución | **8 de 98 (8,2 %)** |

**Lo mejor que se encontró (con evidencia):**
- Las 138 tablas públicas tienen RLS y 261 claves foráneas están indexadas [E]. Las 400 funciones `SECURITY DEFINER` fijan `search_path` y ninguna vista omite `security_invoker` [E].
- De 240 funciones solo para usuarios con sesión, 164 escriben datos y **ninguna** carece de una comprobación visible de identidad o permiso [E, heurística].
- `cancelar_reserva` y `completar_venta_pos` ya manejan el caso de profesional nulo con `coalesce` y rechazan sin sesión: la corrección de autorización **sí está aplicada en producción** [E].
- El webhook de Mercado Pago valida firma HMAC con comparación de tiempo constante y ventana de tiempo, registra de forma idempotente y comprueba vendedor, importe y `live_mode` [S, P]. Sin firma, producción responde 401 [E].
- Cabeceras de seguridad correctas (CSP aplicado con nonce, HSTS, X-Frame-Options, sin CORS abierto); las APIs sin sesión responden 401/400 [E].
- Calidad de código: tipos, lint (0 errores) y build correctos; 105 pruebas pasan [P].
- Observabilidad: Sentry funciona de extremo a extremo en el navegador de producción y filtra datos personales [E].

**Lo que impide lanzar:**
1. **H-001 (P0)** Sin copias de seguridad ni procedimiento de recuperación probado.
2. **H-002 (P1)** Historial de migraciones sin reconciliar: la 137 está en producción y no en `main`.
3. **H-003 (P1)** Política de Datos publicada con "NIT xxxxx"; términos vigentes inconsistentes con el cobro directo.
4. **H-004 (P1)** El cobro directo con Mercado Pago no puede operar en producción (faltan 3 variables).
5. **H-005 (P1)** Aislamiento entre barberías, IDOR y escalada de privilegios **sin demostrar** por falta de entorno aislado.
6. **H-006/H-007 (P1)** Plan de hosting no comercial y datos de prueba visibles públicamente.

Esta auditoría **no encontró una vulnerabilidad de autorización explotable confirmada**, pero tampoco pudo descartarla: ese es el hueco principal (H-005).

---

## 2. Estado general de la plataforma

StylerNow está **muy construida y razonablemente bien diseñada en seguridad de datos**, pero **poco verificada de punta a punta** y con **dependencias operativas sin resolver** (credenciales de pago, backups, legal, infraestructura comercial). La arquitectura de autorización (RLS + RPC con comprobaciones internas) es sólida en el catálogo; lo que falta es la prueba ejecutable que lo demuestre y la configuración de producción completa.

## 3. Porcentaje de implementación — **≈ 71 %**

Mide cuánto existe construido, por dimensión (detalle y fórmula en el Anexo A).

| Dimensión | Peso | Implementación | Aporte |
|---|---:|---:|---:|
| Funcionalidad de los cinco perfiles | 20 % | 70 | 14,0 |
| Seguridad y autorización | 20 % | 83 | 16,7 |
| Base de datos e integridad | 15 % | 55 | 8,3 |
| Pagos e integraciones | 15 % | 78 | 11,7 |
| Calidad del código y pruebas | 10 % | 75 | 7,5 |
| UX/UI y experiencia móvil | 8 % | 70 | 5,6 |
| Infraestructura y despliegue | 7 % | 70 | 4,9 |
| Observabilidad, operación y legal | 5 % | 50 | 2,5 |
| **Total** | **100 %** | | **≈ 71,1** |

## 4. Porcentaje de preparación para producción — **≈ 35 %**

Mide cuánto está **comprobado** y es seguro lanzar. Lo no verificado cuenta 0 (regla de la auditoría).

| Dimensión | Peso | Preparación | Aporte |
|---|---:|---:|---:|
| Funcionalidad de los cinco perfiles | 20 % | 20 | 4,0 |
| Seguridad y autorización | 20 % | 50 | 10,0 |
| Base de datos e integridad | 15 % | 25 | 3,8 |
| Pagos e integraciones | 15 % | 25 | 3,8 |
| Calidad del código y pruebas | 10 % | 63 | 6,3 |
| UX/UI y experiencia móvil | 8 % | 35 | 2,8 |
| Infraestructura y despliegue | 7 % | 40 | 2,8 |
| Observabilidad, operación y legal | 5 % | 25 | 1,3 |
| **Total** | **100 %** | | **≈ 34,6** |

Aunque el número fuera mayor, **los hallazgos P0/P1 bloquean** la recomendación de lanzamiento (§18 de la solicitud).

## 5. Nivel de confianza de la evaluación — **Baja–media**

- **Alta confianza** en: catálogo de la base, cabeceras, rutas API sin sesión, calidad de código, lógica de pagos (estática), UX de páginas públicas.
- **Sin confianza (no ejecutado)**: recorridos autenticados de los 5 perfiles, aislamiento multi-tenant, concurrencia, pagos reales, envíos de correo/WhatsApp, Lighthouse, planes de consultas lentas (`pg_stat_statements`), integridad de datos (huérfanos/duplicados), restauración de backup.
- La falta de evidencia **reduce** el porcentaje de preparación; no se rellenó con suposiciones.

---

## 6. Arquitectura encontrada

| Elemento | Hallazgo | Fuente |
|---|---|---|
| Framework | Next.js 16.4.6, App Router, React 19.2.8, TypeScript, Tailwind v4 | `package.json` [S] |
| Proxy | `src/proxy.ts`: CSP con nonce, redirección a `/login` en rutas protegidas, `x-request-id` | [S] |
| Base de datos | Supabase PostgreSQL: 138 tablas, 231 políticas RLS, 649 funciones (400 `SECURITY DEFINER`), 121 triggers, 28 MB | [E] |
| **ORM** | **No hay Prisma** (sin carpeta ni dependencia). El esquema vive en 138 migraciones SQL. El prompt asumía Prisma. | [S] |
| Autenticación | Supabase Auth: código OTP, Google, magic link, recuperación; `requireRole`, `requireStaff`, `requireSuperSU` | [S] |
| Roles | 5: `cliente`, `staff` (profesional), `guardian` (admin por sede), `barberia` (propietario), `supersu`. **No hay rol recepcionista separado.** | `src/lib/auth/tipos.ts:9` [S] |
| Permisos | 92 permisos con alcance (ninguno/propio/sede/negocio/total) | `permission-registry.ts` [S] |
| Rutas | 98 páginas (36 panel, 13 admin, 6 staff, 43 cliente/públicas), 12 route handlers (incluye `monitoring`), 67 archivos de Server Actions | [S] |
| Pagos | Mercado Pago (Checkout Pro, OAuth por negocio, webhooks), cifrado AES-256-GCM de tokens | `src/lib/pagos/` [S] |
| Correo / push / WhatsApp | Resend, Web Push (VAPID), módulo WhatsApp (sin proveedor conectado) | [S] |
| IA | OpenRouter / Nemotron / Gemini mediante variables | `src/lib/ia` [S] |
| Cloudinary | **No se usa** (sin referencias en el código) | [S] |
| PWA | `manifest.json` + `sw.js` (solo cachea el shell; nunca `/api/`, `/auth/` ni Supabase) | [E] |
| Monitoreo | Sentry (`stylernow-app`), túnel `/api/monitoring` | [E] |
| Hosting | Vercel (proyecto `stylernowv1`, rama `main`) | [E] |
| Cron | 1 tarea diaria `0 8 * * *` → `/api/cron/diario` | `vercel.json` [S] |

---

## 7. Matriz de cobertura por perfil

"Módulo" = pantalla (`page.tsx`). "Revisado" = inspección estática. "Aprobado" = verificado **en ejecución**.

| Perfil | Módulos | Revisados (estático) | Aprobados (ejecución) | Parciales / bloqueados | Fallidos | No verificados | Cobertura de ejecución |
|---|---:|---:|---:|---:|---:|---:|---:|
| Cliente + público | 43 | 43 | 8 | 1 (cobro online) | 0 | 34 | 19 % |
| Super Admin | 13 | 13 | 0 | 2 (WhatsApp, IA) | 0 | 11 | 0 % |
| Propietario / barbería | 36 | 36 | 0 | 4 (cobros, WhatsApp, IA, plan) | 0 | 32 | 0 % |
| Profesional (staff) | 6 | 6 | 0 | 0 | 0 | 6 | 0 % |
| Recepción / guardian | comparte las 36 del panel con alcance por sede | permisos revisados | 0 | 0 | 0 | todas | 0 % |

Notas: los 8 aprobados son páginas públicas (carga, responsive, sin errores de consola) y, además, 4 rutas protegidas se comprobaron como redirección a `/login` sin sesión. No se mezclaron módulos de otros perfiles.

---

## 8. Auditoría de cada panel

### A. Cliente
- **Verificado [E]:** inicio, login, registro, perfil público de negocio, legales, `/para-negocios`, `/mantenimiento` cargan (200), sin desbordes ni errores de consola en 390/768/1440 px. `/mis-reservas` sin sesión → `/login?next=…`.
- **Estático [S]:** 19 rutas protegidas solo para `cliente` (favoritos, reservas, lealtad, referidos, gift cards, membresías, notificaciones, cuenta, privacidad…); la reserva se crea por RPC; cancelación exige actor autenticado y ser cliente de la reserva, del negocio o supersu [E].
- **No verificado [N]:** registro/OTP/Google de punta a punta, reserva, anticipo, reprogramación, reseñas, cupones, notificaciones. Que un cliente no acceda a datos de otro: depende de RLS (catálogo OK, efectividad no probada → H-005).
- **Bloqueado [D/E]:** anticipo online por H-004.

### B. Super Admin
- 13 pantallas (`ai`, `auditoria`, `configuracion`, `lealtad`, `libro`, `moderacion`, `negocios`, `planes`, `reglas`, `soporte`, `whatsapp`…). Guarda por `requireSuperSU()` en `admin/layout.tsx:22`; **las acciones de servidor solo autentican** y delegan en RLS/RPC (**H-008**).
- Las RPC de escritura administrativas validan `is_supersu` (mensaje `NO_AUTORIZADO`) [S]; `/admin` sin sesión redirige a login [E].
- WhatsApp e IA Center: existen pero **sin credenciales en producción** (BLOQUEADA POR DEPENDENCIA EXTERNA, H-015).
- Cuentas de prueba/duplicadas: 285 perfiles y 98 negocios en total; no se listaron ni modificaron. La regla vigente es "Super Admin solo desde la base" (migración 136) [D/S].
- Exportaciones, filtros, paginación y estadísticas con datos reales: **[N]**.

### C. Propietario / barbería
- 36 pantallas: agenda, servicios/combos, staff, sedes, CRM y segmentos, POS/caja/productos, inventario, reportes, lealtad, wallet, marca, políticas, suscripción, cobros, WhatsApp, IA, ads, auditoría, libro, soporte.
- 35 de 36 páginas con guarda de rol directa; 22 archivos de Server Actions [S].
- Aislamiento por negocio: RLS (catálogo OK) y exportaciones (`libro`, `crm`, `ia`, `reportes`) obtienen el alcance de la sesión [S]. **No demostrado en ejecución (H-005).**
- Cobros (Mercado Pago/OAuth): **inoperante en producción** (H-004). Suscripción: pago del plan por Checkout Pro implementado; no verificado.

### D. Profesional (staff)
- 6 pantallas (`agenda`, `clientes`, `lealtad`, `nivel`, `perfil`). El `layout` usa `obtenerContextoStaff()`; permisos "propio" en el registro [S].
- Que no acceda a agenda/ingresos de otro profesional: depende de RLS/RPC (`staff_id = auth.uid()` con `coalesce`) [E parcial]; ejecución **[N]**.

### E. Staff / recepción / guardian
- `guardian` = administrador por sede (alcance "sede"). No existe "recepcionista" aparte (**H-025**). El registro de permisos separa `staff`, `guardian`, `barberia`, `supersu` [S]; no son equivalentes.
- Acciones que requieren al propietario (precio, crear sede, facturación, promover guardian…) están restringidas en el registro [S]; verificación en ejecución **[N]**.

---

## 9. Auditoría de cada módulo (clasificación)

Clasificación aplicada con la regla "no confundir código con funcionamiento". Una pantalla que carga **no** equivale a un flujo verificado.

| Módulo | Clasificación | Motivo |
|---|---|---|
| Páginas públicas (inicio, login, registro, legal, perfil de negocio) | **COMPLETA Y VERIFICADA** (carga/responsive) | 36 mediciones sin errores |
| Autenticación (OTP, Google, recuperación, verificación) | **IMPLEMENTADA PERO NO VERIFICADA** | Google verificado por el propietario en sesiones previas [D]; no reproducido hoy |
| Reservas / disponibilidad / cancelación | **IMPLEMENTADA PERO NO VERIFICADA** | RPC y reglas revisadas [E/S]; sin ejecución |
| Anticipos y cobro online al negocio | **BLOQUEADA POR DEPENDENCIA EXTERNA** | H-004 |
| Pago del plan SaaS (Checkout Pro, gracia) | **IMPLEMENTADA PERO NO VERIFICADA** | Código y migración 133 aplicada [E]; sin pago real |
| Suscripciones / prueba sin tarjeta | **IMPLEMENTADA PERO NO VERIFICADA** | Migraciones 118/135 aplicadas [E] |
| CRM, agenda, servicios, staff, sedes, inventario, POS, reportes | **IMPLEMENTADA PERO NO VERIFICADA** | Guardas y RPC revisadas |
| Lealtad, wallet, referidos, gift cards, membresías | **IMPLEMENTADA PERO NO VERIFICADA** | Migraciones 051–062 aplicadas |
| Libro financiero | **IMPLEMENTADA PERO NO VERIFICADA** | Exportación con sesión/RLS [S] |
| Notificaciones (outbox) | **PARCIAL** | Sin claves VAPID/Resend verificadas → `CANAL_NO_HABILITADO` |
| WhatsApp | **BLOQUEADA POR DEPENDENCIA EXTERNA** | Sin proveedor/credenciales |
| IA Center | **BLOQUEADA POR DEPENDENCIA EXTERNA** | Sin claves en producción |
| Ads / marketplace score | **IMPLEMENTADA PERO NO VERIFICADA** | Ver H-009 |
| Soporte, auditoría, moderación | **IMPLEMENTADA PERO NO VERIFICADA** | |
| Legal / consentimientos | **PARCIALMENTE IMPLEMENTADA** | H-003 |
| Mockups / solo interfaz | **Sin evidencia de ninguno** | No se hallaron marcas explícitas; la ausencia de marcas no prueba que no existan |

---

## 10. Auditoría de seguridad

| Área | Resultado | Evidencia |
|---|---|---|
| RLS | 138/138 tablas con RLS, 231 políticas. 11 tablas sin políticas (solo `service_role`, diseño aparente). | [E] |
| `SECURITY DEFINER` | 400 funciones, todas con `search_path` fijo. 20 ejecutables por `anon`: lecturas públicas del marketplace + ayudantes de permisos + **`registrar_visita_perfil`** (H-009). | [E] |
| Autorización en funciones | 240 solo-autenticado; 164 escriben; 0 sin comprobación visible (heurística). | [E] |
| Casos críticos del prompt | `cancelar_reserva`: actor nulo rechazado; cliente/negocio/guardian/profesional/supersu con `coalesce`. `completar_venta_pos`: `coalesce(v_reserva.staff_id = auth.uid(), false)` y `NO_AUTORIZADO`. **Caso "sin profesional asignado" cubierto.** | [E] |
| Rutas API | `cron/diario` falla cerrado sin secreto; `libro`, `crm`, `ia`, `reportes`, `ics` exigen sesión; webhooks sin firma → 401; sin CORS abierto. | [E][S] |
| Autenticación | Redirección de destino validada (`destinoSeguro`); límite de tasa en login y prueba. Contraseñas filtradas: protección **desactivada** (H-010). | [S][E] |
| XSS / inyección | 1 `dangerouslySetInnerHTML` (JSON-LD con `<` escapado). Sin `eval`. Consultas vía cliente Supabase/RPC. | [S] |
| Secretos | Variables sensibles marcadas "sensitive" en Vercel; `NEXT_PUBLIC_*` solo URL del sitio, anon key, DSN de Sentry y versión. | [E][S] |
| Subidas | Límite de tamaño y MIME en buckets y en las acciones. | [S] |
| Cabeceras | CSP aplicado con nonce, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Permissions-Policy`. | [E] |
| Service worker | Nunca cachea `/api/`, `/auth/` ni Supabase. | [E] |
| Dependencias | `npm audit` producción: 2 moderadas (exceljs→uuid) (H-022). | [P] |
| **Aislamiento multi-tenant, IDOR, escalada** | **NO VERIFICADO** (H-005). | — |

**Defensa en profundidad pendiente:** las acciones de `/admin` solo autentican (H-008).

---

## 11. Auditoría de base de datos

- **Esquema:** 138 tablas, 261 claves foráneas **todas indexadas**, 121 triggers, extensiones: `pgcrypto`, `pg_trgm` (en `public`, H-019), `btree_gist`, `pg_stat_statements`, `supabase_vault`.
- **Historial de migraciones (riesgo conocido):** producción registra 001–137, 091b y `20261111040456`. `origin/main` tiene 138 archivos: **falta 137** y la migración de marketplace figura como `20261111000000` (**H-002**). Las 115–130, antes sin registrar, **ahora sí figuran** en el historial [E].
- **Prisma:** no aplica (no existe). "Prisma valida el esquema" no se usó como prueba de nada.
- **Rendimiento (advisors):** 230 políticas permisivas múltiples y 155 índices sin uso (esperable sin tráfico), `limite_tasa_evento` sin PK (H-018).
- **No ejecutado:** huérfanos y duplicados, concurrencia/bloqueos, `pg_stat_statements`, plan de ejecución de consultas, conexiones.
- **Datos:** 98 negocios, 285 perfiles, 41 reservas, 4 pagos (conteos agregados).
- **Backups:** sin copias automáticas (H-001).

## 12. Auditoría de pagos (estática, sin transacciones)

| Control | Estado | Evidencia |
|---|---|---|
| Firma HMAC | Implementada (`createHmac`, `timingSafeEqual`, ventana de tiempo) | `mercadopago.ts:291-330` [S] |
| Idempotencia | Registro idempotente; duplicados se ignoran | `webhook-mercadopago.ts:111-123` [S] |
| Vendedor | `collector_id` debe coincidir con la cuenta del negocio; "pago ajeno a StylerNow" rechazado | `sincronizar.ts:47-51, 310-317` [S] |
| Importe | Se compara con `pago.monto` creado por el servidor (tolerancia 1) | `sincronizar.ts:126-139` [S] |
| `live_mode` | `liveModeCoincide` intacto, sin excepciones | `entorno.ts:38-42` [S] |
| Entorno | Sin `MERCADOPAGO_ENTORNO` → SANDBOX (seguro); producción solo con `VERCEL_ENV=production`; rechaza `TEST-` en producción | `entorno.ts:18-35` [S] |
| Token en reposo | AES-256-GCM, clave en `PAGOS_CIFRADO_CLAVE` | `cifrado.ts` [S] |
| Contracargos/reembolsos | Registro de disputas; reembolso externo auditado; rechazos → soporte manual | `sincronizar.ts:69-120` [S] |
| Reservas vs suscripciones | Flujos separados (cobro directo al negocio frente a Checkout Pro de StylerNow) | [S][D] |
| No custodia anticipos | Diseño de cobro directo por OAuth; **no probado** (OAuth sin credenciales) | H-004 |
| Webhook sin firma | 401 en producción | [E] |

**Requieren confirmación oficial de Mercado Pago (H-017):** PSE/Nequi/Efecty en cobro OAuth sin split, reembolsos desde la cuenta del negocio, contracargos y comportamiento en producción real.

## 13. Auditoría de integraciones

| Integración | Implementada | Credencial en producción | Conexión verificada | Estado |
|---|---|---|---|---|
| Supabase | Sí | Presente | Sí (consultas hoy) | Operativa |
| Mercado Pago (token, webhook) | Sí | Token, clave pública y secreto de webhook presentes | Webhook rechaza sin firma [E]; pago real **[N]** | Parcial |
| Mercado Pago OAuth (cobro directo) | Sí | **Faltan CLIENT_ID, CLIENT_SECRET, PAGOS_CIFRADO_CLAVE** | No | **Bloqueada** (H-004) |
| Resend | Sí | Clave presente | **[N]** dominio/envío | No verificada |
| Cloudinary | **No existe** | — | — | No aplica |
| Google OAuth | Sí | En Supabase | Verificada por el propietario [D] | Operativa [D] |
| IA Center (OpenRouter/Nemotron/Gemini) | Sí | **Ausentes** | No | Bloqueada |
| WhatsApp Business | Parcial (módulo y reglas) | **Ausentes** | No | Bloqueada |
| Web Push (VAPID) | Sí | **Ausentes** | No | Bloqueada |
| Sentry | Sí | DSN y token presentes | **Sí**, evento real de navegador en producción, filtrado y con source maps [E] | Operativa (ver H-013) |
| Vercel / dominio / CSP | Sí | — | Sí | Operativa (plan, H-006) |
| PWA | Sí | — | Manifest y SW servidos (200) | Parcial: instalación **[N]** |
| Mapas (OpenStreetMap) | Sí | — | Permitido por CSP | No verificada |
| Cron | Sí | `CRON_SECRET` presente | 401 sin secreto [E]; ejecución real **[N]** | Parcial (H-012) |

## 14. Auditoría UX/UI (Playwright con Chrome; Claude in Chrome **no** se usó en este tramo)

- **Cobertura:** 12 rutas × 3 tamaños (390×844, 768×1024, 1440×900) = **36 mediciones** sin sesión, solo GET. Capturas en `evidencias/`.
- **Resultados [E]:** sin desborde horizontal; sin errores de consola ni de página; 1 `h1` por página; sin imágenes sin `alt`; sin botones ni campos sin nombre; rutas protegidas redirigen a login.
- **Identidad:** el sistema brutalista (tipografía condensada, naranja/negro, bordes y sombras duras) es consistente entre páginas; no se propone rediseño.
- **Hallazgos:** zoom bloqueado (H-020, decisión previa del propietario, no se toca); objetivos táctiles < 40 px en `/registro` (3), `/para-negocios` (4) e inicio (1) (H-021); aviso de cookies cubre ~1/3 de la pantalla móvil en la primera visita (aceptable, **informativo**).
- **Rendimiento percibido (H-014):** la home tarda 1,4–16 s en completar la carga (mediana ~5 s) con TTFB ~0,5 s; todas las páginas son `MISS` en la caché de Vercel.
- **No ejecutado:** paneles autenticados (Cliente, Propietario, Profesional, Staff, Super Admin) en los tres tamaños; contraste medido, lector de pantalla, Lighthouse.

## 15. Resultados de pruebas

| Prueba | Resultado | Evidencia |
|---|---|---|
| TypeScript (`tsc --noEmit`) | **Pasa** (tras generar tipos del build) | `logs/audit-tsc.log` |
| ESLint | **0 errores, 1 aviso** (`react-hooks/exhaustive-deps`, `admin/barra-lateral.tsx:197`) | `logs/audit-eslint.log` |
| Vitest | **105 pasan, 15 omitidas** (integración del webhook, requiere Docker) | `logs/audit-vitest.log` |
| Build de producción | **Pasa** (119 líneas de rutas) | `logs/audit-build-tail.log` |
| `npm audit` (producción) | 2 moderadas (exceljs → uuid) | `logs/npm-audit-prod.json` |
| Advisors Supabase | 260 `authenticated_security_definer_function_executable`, 20 `anon_…`, 11 `rls_enabled_no_policy`, 2 `extension_in_public`, 1 `auth_leaked_password_protection`; rendimiento: 230, 155, 1 | `logs/supabase-advisors-resumen.tsv` |
| Pruebas E2E | **No existen en el repositorio** | — |
| Pruebas RLS / aislamiento | **No existen ni se ejecutaron** | — |
| Lighthouse, pruebas de carga, consultas lentas | **No ejecutados** (no se instalaron herramientas; las pruebas de carga se reservaron a staging) | — |

---

## 16. Hallazgos (detalle en el CSV)

**P0**
- **H-001** Sin backups ni recuperación probada.

**P1**
- **H-002** Migraciones sin reconciliar (137 falta en `main`; versión 20261111 divergente).
- **H-003** Política de Datos publicada con "NIT xxxxx"; términos vigentes inconsistentes.
- **H-004** Cobro directo (OAuth) inoperante en producción.
- **H-005** Aislamiento multi-tenant / IDOR / escalada **no demostrados**.
- **H-006** Vercel Hobby (no comercial).
- **H-007** Datos y negocios de prueba visibles públicamente.

**P2** H-008 acciones de `/admin` sin comprobación de rol propia · H-009 `registrar_visita_perfil` anónimo sin límite · H-010 contraseñas filtradas · H-011 sin E2E/RLS y 15 pruebas omitidas · H-012 cron único diario · H-013 sin health check ni alertas específicas · H-014 rendimiento de la home y sin caché · H-015 integraciones sin credenciales · H-016 rama local divergente · H-017 puntos pendientes con Mercado Pago.

**P3** H-018 advisors de rendimiento · H-019 tablas RLS sin políticas y `pg_trgm` · H-020 zoom bloqueado · H-021 objetivos táctiles · H-022 `exceljs/uuid` · H-023 aviso de lint · H-024 `security.txt`/canonical · H-025 rol recepcionista.

## 17. Funcionalidades incompletas
- Cobro directo con Mercado Pago (credenciales). Términos v3/v4 sin publicar. Recepcionista como rol propio. Health checks. Pruebas E2E/RLS en el repositorio. Registro de la migración 137 en el repositorio.

## 18. Funcionalidades simuladas
- No se hallaron mockups explícitos. Hay 176 coincidencias de `TODO|FIXME|XXX` **sin clasificar** (no se revisaron una a una). `SimuladorCosto` del IA Center es una calculadora administrativa legítima. WhatsApp e IA Center están construidos pero **no conectados**.

## 19. Dependencias externas pendientes
Credenciales de Mercado Pago (OAuth y entorno de producción), plan de Supabase con backups, plan de Vercel Pro, datos de la empresa (razón social/NIT) y abogado, claves de IA, proveedor de WhatsApp, VAPID, dominio de Resend, respuestas oficiales de Mercado Pago.

## 20. Riesgos para el lanzamiento
1. Pérdida de datos sin backup (H-001). 2. Despliegue o reconstrucción con migraciones desalineadas (H-002). 3. Consentimiento sobre un documento legal incompleto (H-003). 4. Fuga entre inquilinos no descartada (H-005). 5. Anticipos online imposibles (H-004). 6. Operar comercialmente en un plan no comercial (H-006). 7. Clientes reales viendo negocios ficticios (H-007).

## 21. Recomendaciones priorizadas
1. Backups/PITR y un ensayo de restauración (H-001). 2. Base aislada (Docker/staging) + suite de aislamiento por rol (H-005). 3. Reconciliar migraciones (H-002). 4. Credenciales de Mercado Pago y recorrido completo (H-004, H-017). 5. Corregir y publicar los documentos legales con revisión de abogado (H-003). 6. Validar rol dentro de cada acción de `/admin` (H-008) y proteger `registrar_visita_perfil` (H-009). 7. Plan Pro de Vercel/Supabase (H-006, H-010, H-012). 8. Observabilidad operativa (H-013). 9. Limpieza de datos de prueba con backup previo (H-007).

## 22. Plan de remediación por fases (no se implementó nada)

| Fase | Resuelve | Prioridad | Dependencias | Riesgo | Esfuerzo | Aceptación | Pruebas |
|---|---|---|---|---|---|---|---|
| **0 · Bloqueantes de seguridad y datos** | H-001, H-005, H-008, H-009, H-010 | Crítica | Plan con backups; base aislada | Alto si se omite | 1–2 semanas | Restauración ensayada; suite de aislamiento (A/B, cliente, staff, supersu) en verde; acciones `/admin` rechazan no-supersu | Suite RLS/IDOR; prueba de restauración |
| **1 · Funciones críticas del marketplace** | H-002, H-007, H-016 | Alta | Autorización del propietario | Medio | 3–5 días | Historial reconciliado; datos de prueba retirados; una sola línea de despliegue | Diff de migraciones; verificación de conteos |
| **2 · Pagos, reservas e integraciones** | H-004, H-015, H-017, H-012 | Alta | Credenciales y respuesta de Mercado Pago | Alto | 1–2 semanas | Recorrido completo en sandbox (conectar → reservar → anticipo → webhook → reembolso); credenciales cargadas | E2E de pago; 15 pruebas de integración activas |
| **3 · Calidad funcional de los 5 perfiles** | H-011 | Alta | Fase 0 | Medio | 2 semanas | E2E por perfil sin fallos; matriz de cobertura ≥ 90 % verificada | E2E Playwright por rol |
| **4 · UX/UI, rendimiento y accesibilidad** | H-014, H-020, H-021, H-023, H-024 | Media | Decisión del propietario sobre zoom | Bajo | 1 semana | Home < 3 s de carga completa; objetivos ≥ 44 px; Lighthouse ≥ umbral acordado | Lighthouse móvil, auditoría con lector de pantalla |
| **5 · Observabilidad y documentación** | H-013, H-018, H-019, H-022, H-025 | Media | Fase 2 | Bajo | 3–5 días | Health check, uptime, alertas por pagos/webhook/cron, runbook de incidentes | Simulacro de incidente |
| **6 · Validación final de lanzamiento** | H-003, H-006 + revisión global | Crítica | Todas | Alto | 3–5 días | Sin P0/P1; legal publicado y revisado; plan comercial; ensayo general | Repetir esta auditoría completa |

## 23. Criterios de aceptación para producción
- Cero hallazgos P0/P1 abiertos. Suite de aislamiento y E2E por perfil en verde, ejecutadas contra una base aislada. Restauración de backup ensayada con RPO/RTO definidos. Historial de migraciones idéntico entre repositorio y producción. Documentos legales completos y revisados por un abogado. Pago real de punta a punta en entorno de pruebas y confirmación de Mercado Pago de los puntos de H-017. Plan de Vercel/Supabase apto para uso comercial. Datos de prueba retirados.

## 24. Verificaciones que requieren pruebas adicionales
Aislamiento A/B, cliente↔cliente, profesional↔profesional, escalada a supersu · concurrencia en reservas (doble reserva, exclusión de solape) · flujo completo de pago/reembolso/contracargo · OTP, límite de tasa y Google · recorridos autenticados de los 5 perfiles en 3 tamaños · exportaciones, filtros y paginación del admin · integridad de datos (huérfanos/duplicados) · `pg_stat_statements` y N+1 · Lighthouse y carga · envíos de correo/push/WhatsApp · instalación PWA y modo sin conexión · restauración de backup · ejecución real del cron.

---

## Anexo A — Cálculo del puntaje

Escala por ítem: 100 implementado, probado y aprobado · 75 implementado y funcional, faltan pruebas · 50 parcial · 25 inicial no operativo · 0 ausente, falla o sin evidencia. Cada dimensión es el promedio simple de sus ítems. **Implementación** = qué existe construido. **Preparación** = qué está comprobado (lo no verificado puntúa 0 o 25 según haya inspección estática/catálogo).

| Dimensión | Ítems (implementación / preparación) |
|---|---|
| **Funcionalidad 5 perfiles** | Cliente 75/25 · Super Admin 75/25 · Propietario 75/25 · Profesional 75/25 · Staff-guardian 50/0 → **70 / 20** |
| **Seguridad** | RLS 100/50 · SECURITY DEFINER 75/50 · Auth/sesión/cabeceras 75/50 · Aislamiento multi-tenant 75/0 · Rutas API y webhooks 100/75 · Dependencias y secretos 75/75 → **83 / 50** |
| **Base de datos** | Esquema/FK/índices 100/75 · Historial de migraciones 50/25 · Integridad de datos 75/0 · Concurrencia/rendimiento 50/25 · Backups 0/0 → **55 / 25** |
| **Pagos e integraciones** | Lógica de pagos 100/50 · OAuth 75/0 · Pago del plan 75/25 · Resend 75/0 · IA 75/0 · WhatsApp 50/0 · Google 100/75 · PWA/push/mapas/cron 75/50 → **78 / 25** |
| **Calidad y pruebas** | tsc+lint+build 100/100 · Unitarias 75/75 · Integración/E2E/RLS 25/0 · Dependencias 100/75 → **75 / 63** |
| **UX/UI** | Responsive públicas 100/75 · Paneles autenticados 75/0 · Accesibilidad 50/25 · Rendimiento percibido 50/25 · PWA 75/50 → **70 / 35** |
| **Infraestructura** | Hosting 75/25 · Cabeceras/CSP/HSTS 100/100 · Variables de producción 50/25 · Reconciliación main↔producción 50/25 · Cron 75/25 → **70 / 40** |
| **Observabilidad, operación, legal** | Sentry 100/75 · Health/uptime/alertas 25/0 · Recuperación de incidentes 0/0 · Legal 50/0 · Cookies/consentimientos 75/50 → **50 / 25** |

Ponderación: 0,20·70 + 0,20·83,3 + 0,15·55 + 0,15·78,1 + 0,10·75 + 0,08·70 + 0,07·70 + 0,05·50 = **71,1** (implementación) y 0,20·20 + 0,20·50 + 0,15·25 + 0,15·25 + 0,10·62,5 + 0,08·35 + 0,07·40 + 0,05·25 = **34,6** (preparación).

## Anexo B — Condiciones de lanzamiento (§18 de la solicitud)

| Condición bloqueante | ¿Se cumple? |
|---|---|
| Hallazgos P0 sin resolver | **Sí** (H-001) |
| Vulnerabilidades de autorización | No confirmadas; **no descartadas** (H-005, H-008) |
| Fallos de aislamiento entre barberías | **No determinable** por falta de evidencia |
| Operaciones financieras inconsistentes | No halladas en la revisión estática |
| Reservas confirmadas sin validar el pago | No halladas (webhook valida firma, vendedor, importe, entorno) |
| Pérdida de datos posible | **Sí** (H-001) |
| Migraciones no reconciliadas con riesgo de despliegue | **Sí** (H-002) |
| Funciones críticas solo simuladas | No halladas; sí **no conectadas** (cobro OAuth, WhatsApp, IA) |
| Fallos de autenticación | No hallados; sin recorrido completo ejecutado |
| Secretos expuestos | No hallados |
| Ausencia de procedimiento de recuperación | **Sí** |

**Veredicto final: NO LISTO PARA PRODUCCIÓN**, y en el aislamiento entre inquilinos **NO SE PUEDE DETERMINAR POR FALTA DE EVIDENCIA**.
