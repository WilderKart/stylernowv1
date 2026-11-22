# Evidencias de la auditoría integral de StylerNow

Permiten a otra persona reproducir las conclusiones de `AUDITORIA_INTEGRAL_STYLERNOW_PRODUCTION_READINESS.md`.
Fecha: 2026-11-14. Todo fue de **solo lectura** sobre producción (consultas de catálogo, GET/OPTIONS públicos). Las pruebas que compilan o ejecutan código se hicieron en una copia temporal de `origin/main`, fuera del repositorio.

## 0. Entorno y herramientas (inventario previo)

| Elemento | Estado |
|---|---|
| Código auditado | `origin/main` @ `3386c3b` (copia con `git worktree add --detach <ruta> origin/main`), instalación limpia con `npm ci` |
| Carpeta local | `audit/produccion-integral` con 2 commits no publicados y 83 archivos sin confirmar (no representativa de producción) |
| Producción | `https://app.stylernow.com`; Supabase `wxokamgnrpyhobkqjylm`; Vercel proyecto `stylernowv1` |
| Docker | Instalado; servicio **apagado** → sin Supabase local; **no hay staging** |
| Node / npm | 24.19.0 / 11.17.0; Supabase CLI 2.106; sin `psql`, sin k6 |
| Navegador | Chrome + Playwright (`playwright-core`, `channel: "chrome"`). Claude in Chrome **no** se usó en esta auditoría (sí antes, para Sentry) |
| Base de datos | Conector de Supabase: solo `SELECT` sobre catálogos y conteos agregados |
| No instalado / no ejecutado | Lighthouse, axe, k6, `pg_stat_statements`, pruebas de carga |

## 1. Base de datos (consultas ejecutadas, todas de solo lectura)

**1.1 Migraciones** — `list_migrations` (proyecto de producción): 001–137, `091b`, `20261111040456` (139 entradas). Comparación con el repositorio:

```bash
cd <copia de origin/main> && node -e '
const fs=require("fs");const files=fs.readdirSync("supabase/migrations").filter(f=>f.endsWith(".sql"));
const prod=new Set();for(let i=1;i<=137;i++)prod.add(String(i).padStart(3,"0"));prod.add("091b");prod.add("20261111040456");
const repo=new Map();for(const f of files){const m=f.match(/^(\d+[a-z]?)_/);if(m)repo.set(m[1],f)}
console.log("repo:",repo.size,"prod:",prod.size);
console.log("en repo y NO en produccion:",[...repo.keys()].filter(k=>!prod.has(k)));
console.log("en produccion y NO en repo:",[...prod].filter(k=>!repo.has(k)));'
```
Resultado: `repo: 138  prod: 139` · solo en repo: `20261111000000` · solo en producción: `137`, `20261111040456` → **H-002**.

**1.2 RLS, políticas, funciones, vistas**
```sql
select 'tablas_public', count(*)::text from pg_tables where schemaname='public'
union all select 'tablas_sin_rls', coalesce(string_agg(c.relname, ', '),'(ninguna)') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity
union all select 'tablas_rls_sin_politicas', coalesce(string_agg(c.relname, ', '),'(ninguna)') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity and not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=c.relname)
union all select 'politicas_total', count(*)::text from pg_policies where schemaname='public'
union all select 'funciones_public', count(*)::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
union all select 'secdef_total', count(*)::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef
union all select 'secdef_sin_search_path', coalesce(string_agg(p.proname, ', '),'(ninguna)') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and (p.proconfig is null or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'))
union all select 'vistas_sin_security_invoker', coalesce(string_agg(c.relname, ', '),'(ninguna)') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='v' and not coalesce((select option_value from pg_options_to_table(c.reloptions) where option_name='security_invoker')::boolean,false);
```
Resultado: 138 tablas · sin RLS: ninguna · RLS sin políticas (11): `password_history, intento_auth, purga_storage_pendiente, anuncio_evento_dedupe, limite_tasa_evento, conexion_pago_negocio, conexion_pago_evento, oauth_estado, notificacion_outbox_evento, notificacion_evento, notificacion_plantilla` · 231 políticas · 649 funciones · 400 `SECURITY DEFINER` · sin `search_path`: ninguna · vistas sin `security_invoker`: ninguna.

**1.3 Funciones ejecutables sin sesión (`anon`)** — 20 funciones `SECURITY DEFINER` (consulta por `has_function_privilege('anon', oid, 'execute')`): `calcular_sena_servicios, estado_sistema, fundador_cupos_restantes, is_barberia_de, is_guardian_de_negocio, is_guardian_de_sede, is_staff_de, is_supersu, marketplace_buscar, marketplace_buscar_filtrado, negocio_cobra_en_linea, negocio_puede_recibir_reservas, negocio_resenas_publicas, negocio_staff_publico, negocio_visible_en_mapa, registrar_visita_perfil, slots_disponibles, staff_perfil_publico, staff_resenas_publicas, tiene_acceso_interno`. Todas `STABLE` y de lectura, **salvo `registrar_visita_perfil`** (`VOLATILE`, inserta) → **H-009**. Cuerpo:
```sql
begin insert into public.negocio_visita_perfil (negocio_id, cliente_id, campana_id) values (p_negocio_id, auth.uid(), p_campana_id); end;
```

**1.4 Escrituras sin comprobación visible (heurística)**
```sql
-- funciones SECURITY DEFINER ejecutables por authenticated y no por anon, volátiles, que escriben,
-- y cuyo cuerpo no menciona auth.uid()/auth.jwt()/is_supersu/is_barberia_de/is_staff_de/is_guardian/tiene_acceso/puede_/_autorizar/_verificar...
```
Resultado: `total_auth_execute=240, volatiles=171, escriben=164, escriben_sin_chequeo_visible=0`. Limitación: detecta ausencia de comprobación, no su corrección.

**1.5 Casos críticos** — cuerpos de `cancelar_reserva` y `completar_venta_pos` (líneas relevantes): `v_actor := auth.uid(); if v_actor is null then raise exception 'NO_AUTENTICADO'` · `coalesce(v_reserva.staff_id = v_actor, false)` · `if not (v_es_cliente or v_es_negocio or public.is_supersu()) then raise exception 'NO_AUTORIZADO'` · `v_autorizado := is_barberia_de(...) or is_guardian_de_sede(...) or coalesce(v_reserva.staff_id = auth.uid(), false); if not coalesce(v_autorizado,false) then raise exception 'NO_AUTORIZADO'`.

**1.6 Integridad e índices** — 261 claves foráneas, **0 sin índice**; 121 triggers; extensiones `plpgsql, pg_stat_statements, uuid-ossp, pgcrypto, supabase_vault, pg_trgm, btree_gist`; tamaño 28 MB; conteos: `negocio 98, perfil 285, reserva 41, pago 4`.

**1.7 Advisors de Supabase** — `get_advisors(security|performance)`; resumen en `logs/supabase-advisors-resumen.tsv` (260 `authenticated_security_definer_function_executable`, 20 `anon_…`, 11 `rls_enabled_no_policy`, 2 `extension_in_public`, 1 `auth_leaked_password_protection`; rendimiento: 230 `multiple_permissive_policies`, 155 `unused_index`, 1 `no_primary_key`).

**1.8 Textos legales publicados** (`texto_legal`: tipo, versión, material, fecha, presencia de `xxxxx`/`[pendiente`, largo — sin leer el contenido completo):
`POLITICA_DATOS v2 · cambio_material=true · 2026-11-13 · nit_xxxxx=true · 8641` · `TERMINOS v2 · 2026-11-11 · 1782` → **H-003**.

## 2. Producción: comprobaciones externas (solo GET / OPTIONS / POST sin cuerpo)

```bash
curl -sI https://app.stylernow.com/                           # cabeceras
curl -s -o /dev/null -D - -X OPTIONS -H "Origin: https://evil.example" -H "Access-Control-Request-Method: GET" https://app.stylernow.com/api/crm/exportar
for u in "/api/crm/exportar?negocioId=0000…" /api/libro/exportar /api/cron/diario /api/reportes/exportar "/reserva/0000…/ics"; do curl -s -o /dev/null -w "%{http_code}\n" "https://app.stylernow.com$u"; done
curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "content-type: application/json" -d '{}' https://app.stylernow.com/api/webhooks/mercadopago
```
Resultados: cabeceras `Content-Security-Policy` (nonce, aplicado), `Strict-Transport-Security: max-age=63072000; includeSubDomains`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Cache-Control: private, no-store`; **sin** `Access-Control-Allow-Origin`; APIs: `crm 400 · libro 401 · cron 401 · reportes 400 · ics 307`; webhook sin firma **401**; `/robots.txt`, `/sitemap.xml`, `/manifest.json`, `/sw.js` → 200; `/.well-known/security.txt` → 307 (H-024).

**Variables de Vercel (solo nombres; no se descifró ningún valor)** — `filter_project_envs` (proyecto `stylernowv1`, target production): `SENTRY_AUTH_TOKEN, NEXT_PUBLIC_SENTRY_DSN, MERCADOPAGO_WEBHOOK_SECRET, CSP_ENFORCE, RESEND_API_KEY, PRUEBA_HASH_PEPPER, CRON_SECRET, NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY, MERCADOPAGO_ACCESS_TOKEN, NEXT_PUBLIC_SITE_URL, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. **No existen:** `MERCADOPAGO_CLIENT_ID, MERCADOPAGO_CLIENT_SECRET, PAGOS_CIFRADO_CLAVE, MERCADOPAGO_ENTORNO, OPENROUTER_*, NEMOTRON_*, GEMINI_API_KEY, claves VAPID, credenciales de WhatsApp` → H-004, H-015.

## 3. Pruebas de calidad (copia de `origin/main`)

| Comando | Resultado | Registro |
|---|---|---|
| `npm ci` | exit 0 | — |
| `npx eslint .` | 0 errores, 1 aviso | `logs/audit-eslint.log` |
| `npx vitest run` | 11 archivos pasan, 1 omitido; 105 pasan, 15 omitidas | `logs/audit-vitest.log` |
| `npx next build` | exit 0 | `logs/audit-build-tail.log` |
| `npx tsc --noEmit -p .` (después del build) | exit 0 | `logs/audit-tsc.log` |
| `npm audit --omit=dev --json` | 2 moderadas: `exceljs`, `uuid` | `logs/npm-audit-prod.json` |

Los 15 tests de integración del webhook (`tests/integracion/webhook-mercadopago.test.ts`) requieren `WEBHOOK_INT=1` y Supabase local en Docker (apagado) → omitidos.

## 4. Inspección estática (rutas y comandos)

```bash
find src/app -name route.ts                                    # 12 route handlers
grep -rl '"use server"' src | wc -l                            # 67
grep -rln "SUPABASE_SECRET_KEY\|createAdminClient" src         # usos de la clave de servicio
grep -rn "dangerouslySetInnerHTML\|eval(\|new Function" src    # 1 uso (JSON-LD con '<' escapado) en src/app/negocio/[slug]/page.tsx:203
grep -rhoE "NEXT_PUBLIC_[A-Z_]+" src | sort | uniq -c           # variables expuestas
```
Archivos citados: `src/app/api/cron/diario/route.ts:31-35` (falla cerrado), `src/app/api/libro/exportar/route.ts`, `src/app/auth/callback/route.ts` (destino validado), `src/app/admin/actions.ts:10-16` y `admin/layout.tsx:22` (**H-008**), `src/lib/pagos/{mercadopago,sincronizar,webhook-mercadopago,entorno,oauth-mercadopago,cifrado}.ts` (§12 del informe), `src/lib/auth/{tipos,permission-registry}.ts` (roles y 92 permisos), `src/app/layout.tsx:63-64` y `src/components/pwa/bloquear-zoom.tsx` (**H-020**), `vercel.json` (cron único), `public/sw.js` (no cachea datos).

Pantallas por área (conteo de `page.tsx`): `panel 36 · admin 13 · staff 6 · cliente/públicas 43 · total 98`. Páginas con guarda de rol directa: `panel 35/36`, `admin` solo `layout`+3 archivos, `staff` `layout`+2.

## 5. Recorrido visual y de rendimiento (Playwright, producción, solo GET)

- Script: `scripts/ux-audit.mjs` (12 rutas × 390×844, 768×1024, 1440×900 = 36 mediciones). Resultado completo: `ux-resultados.json`.
- Rutas: `/`, `/login`, `/registro`, `/para-negocios`, `/legal/terminos`, `/legal/politica-de-datos`, `/negocio/<slug de un negocio de prueba>`, `/mantenimiento` y 4 protegidas sin sesión (`/panel`, `/admin`, `/mis-reservas`, `/staff`, que redirigen a `/login?next=…`).
- Medido por página: estado HTTP, tiempo de carga, desborde horizontal, `h1`, `alt`, botones/campos sin nombre, objetivos < 40 px, `user-scalable`, errores de consola/página.
- **Resultado:** 36/36 con HTTP 200 final, sin desborde, sin errores; `zoomBloqueado=true` en 36/36; objetivos pequeños: `/registro 3`, `/para-negocios 4`, `/ 1`.
- Rendimiento de la home: `scripts/perf-home.mjs` (TTFB 571 ms, LCP 1,4 s, 1,1 MB, 26 peticiones, todo del mismo origen) y `scripts/perf-rep.mjs` (9 repeticiones: carga completa 4,0–6,0 s en `/`, 1,0–2,2 s en `/login`; `x-vercel-cache: MISS` en todas). En la pasada de 36 mediciones la primera visita a `/` tardó 11,9–15,8 s → **H-014**.
- Capturas (`evidencias/`): `movil-*.jpg`, `tablet-*.jpg`, `escritorio-*.jpg` (páginas públicas) y `movil-protegida-*.jpg` (redirecciones).

## 5.1 Verificación de Sentry (hecha el mismo día, antes de esta auditoría)
Evento de navegador provocado en `app.stylernow.com/login` → llegó a Sentry con `environment=production`, correo enmascarado, sin IP ni cookies y con el código original (source maps); se borró la incidencia de prueba. Ver `docs/SENTRY.md`. La captura de **errores de servidor** se verificó en local, no en producción.

## 6. Lo que NO se ejecutó y por qué

| Prueba | Motivo |
|---|---|
| Aislamiento multi-tenant, IDOR, escalada, doble reserva, concurrencia | No hay entorno aislado (Docker apagado, sin staging); escribir en producción está prohibido |
| Recorridos autenticados de los 5 perfiles | Iniciar sesión en producción crea sesiones y eventos de auditoría; sin entorno aislado |
| Pagos, OAuth, reembolsos, webhooks reales | Prohibido realizar transacciones; OAuth sin credenciales |
| Correo, WhatsApp, push | Prohibido enviar mensajes reales |
| Lighthouse, axe, carga (k6) | No se instalan herramientas; la carga se reserva a staging |
| `pg_stat_statements`, N+1, huérfanos/duplicados | No ejecutado en esta pasada |
| Restauración de backup | No existe backup configurado |

## 7. Limpieza posterior
La copia temporal de `origin/main` y su `.env.local` (copiado solo para compilar) se eliminaron al terminar. No se creó ningún commit, push, despliegue, migración ni cambio en Vercel, Supabase o Sentry durante esta auditoría; los únicos archivos nuevos son los de `docs/auditoria_integral/`.
