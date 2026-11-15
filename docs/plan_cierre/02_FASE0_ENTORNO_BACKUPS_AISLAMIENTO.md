# Fase 0 — Entorno aislado, copias de seguridad y estrategia de aislamiento

Estado: **plan, sin ejecutar**. Resuelve H-001, H-005 y H-016.

## 1. Estado de partida verificado
- Docker 29.8.1 instalado; `docker info` solo respondió el cliente, es decir, **el demonio está apagado** y hay que iniciarlo (Docker Desktop).
- Supabase CLI 2.106.0 disponible con `npx`. `supabase/config.toml` con Postgres 17 y `seed` activo.
- Proyectos Supabase de la organización: `Stylernowv1` (producción, `ACTIVE_HEALTHY`, ca-central-1) y 4 más `INACTIVE` (Stylernow, Appstylernow, Brivia, technoultra). Los inactivos **no se usarán** ni se restauran sin tu autorización (pueden contener datos antiguos y generar gasto).
- Ya existen pruebas SQL de aislamiento: `tests/sql/aislamiento_multiempresa.sql` más 10 scripts por migración. Se reutilizan.

## 2. H-005 — Entorno aislado
**Opción A (recomendada, sin coste): Supabase local en Docker.**
1. Iniciar Docker Desktop.
2. En el worktree nuevo `stylernow-cierre`: `npx supabase start` (Postgres + Auth + Studio locales; Storage no se usará, ver Cloudinary).
3. `npx supabase db reset` aplica **las migraciones del repositorio desde cero**. Esto además es la prueba de H-002: si una base nueva no se reconstruye, el historial está roto. Se espera como mínimo el desajuste de la migración `20261111…`.
4. `.env.local` apuntando a `127.0.0.1:54321`, claves locales de demostración, `MERCADOPAGO_*` de sandbox, `NEXT_PUBLIC_SENTRY_DSN` vacío.
5. **Salvaguardas**: variable `ENTORNO_PRUEBAS=1` y una comprobación al arrancar que aborta si `NEXT_PUBLIC_SUPABASE_URL` no es `127.0.0.1`/`localhost`, para que ninguna prueba escriba en producción por error.

**Opción B (alternativa): staging en Supabase** (rama o proyecto nuevo). Genera coste y requiere tu autorización; solo si Docker no es viable.

**Datos de prueba (sin datos personales reales)** — semilla `supabase/seed_pruebas.sql` (nueva, solo local), con correos `@example.test`:
| Rol | Cuenta |
|---|---|
| Cliente A, Cliente B | dos clientes con reservas en negocios distintos |
| Negocio A, Negocio B | cada uno con sede, servicios, 2 profesionales y plan activo |
| Propietario A / B | dueños |
| Profesional A1, A2, B1 | staff |
| Guardian A | administrador por sede de A |
| Super Admin | asignado desde la base, como ya exige la migración 136 (Super Admin solo desde base) |

## 3. Estrategia de pruebas de aislamiento (multi-tenant, IDOR, escalada)
Tres capas, cada rechazo probado en backend **y** en interfaz:

**Capa 1 — SQL/RLS (rápida, sin navegador).** Para cada tabla con `negocio_id` o `usuario_id`: autenticar como cada actor con `set local role authenticated; set local request.jwt.claims …` e intentar `select/insert/update/delete` sobre filas del otro tenant. Se genera una matriz **tabla × operación × actor** (138 tablas) automáticamente desde `pg_policies`. Resultado esperado: 0 filas visibles / 0 filas afectadas / error de política.

**Capa 2 — RPC y funciones.** Las 164 funciones `SECURITY DEFINER` que escriben y ejecuta `authenticated`: invocarlas con identificadores del tenant ajeno (UUIDs de B estando autenticado como A), con `p_negocio_id` manipulado, con id de staff nulo (patrón del hotfix ya documentado), y como `anon`. Además, intento de llamar las funciones solo de propietario como Guardian y las de Super Admin como cliente y propietario.

**Capa 3 — HTTP (Server Actions y rutas).** Playwright contra el servidor local: con la sesión de A, repetir las peticiones de acciones de B (IDOR por `id`, `slug`, `negocio_id` en el cuerpo), `/api/*` sin sesión, `/admin/*` con cada rol, y las acciones de `admin/usuarios/actions.ts` (código nuevo, H-008).

| Escenario | Esperado |
|---|---|
| Cliente A lee/edita reserva, perfil o pago de Cliente B | denegado |
| Barbería A lee/edita servicios, clientes, ventas de B | denegado |
| Profesional A1 ve agenda/comisiones de A2 | denegado (salvo permiso explícito) |
| Guardian ejecuta funciones exclusivas del propietario | denegado |
| Cliente/propietario invoca acciones de Super Admin | denegado en acción **y** en la base |
| `anon` ejecuta cualquier operación protegida | 401/denegado |
| Subida/borrado de archivo ajeno (Cloudinary, cuando exista) | denegado |

Criterio de cierre de H-005: matriz completa en verde, con el SQL y los scripts versionados y repetibles (`npm run test:aislamiento`), y un hallazgo abierto por cada celda en rojo.

## 4. H-001 — Copias de seguridad y recuperación
**Lo que sé y lo que no.** La auditoría dejó constancia de que la base está en plan **Free** y no encontré copias gestionadas ni un procedimiento de restauración probado. **No he contratado nada.** Las capacidades exactas de cada plan se confirmarán en el panel antes de decidir (los planes de Supabase cambian; no las doy por sentadas aquí).

**Objetivos propuestos (a validar contigo, son decisiones de negocio):**
| Dato | RPO propuesto | RTO propuesto |
|---|---|---|
| Reservas, pagos y suscripciones | ≤ 15 min (ideal: PITR) → mínimo aceptable ≤ 24 h | ≤ 4 h |
| Resto del catálogo/CRM | ≤ 24 h | ≤ 8 h |

**Estrategia en capas:**
1. **Gestionada**: pasar a un plan con copias diarias y, si el RPO lo exige, recuperación a un punto en el tiempo. **Requiere tu autorización y genera gasto.**
2. **Independiente (coste ~0)**: `pg_dump` lógico programado (esquema + datos, formato custom) desde un equipo/CI tuyo con la cadena de conexión de solo lectura, **cifrado con `age`/`gpg`** y guardado fuera de Supabase y fuera de Cloudinary (almacén frío de tu elección, p. ej. un bucket de otro proveedor o un disco cifrado). Retención 7 diarias + 4 semanales + 3 mensuales.
3. **Configuración**: las migraciones ya están en git (vuelve reproducible el esquema); los secretos se respaldan en tu gestor de contraseñas, no en el repositorio.
4. **Archivos**: Cloudinary conserva los activos; los metadatos van en la tabla `archivo` y se respaldan con la base.

**Procedimiento de restauración (a ensayar):** crear base vacía local → restaurar el volcado → aplicar migraciones pendientes → ejecutar `tests/sql/*` y la prueba de aislamiento → comparar conteos de tablas críticas con la fuente. **Ensayo en base aislada local**, nunca sobre producción. Se mide el RTO real y se documenta en `docs/RESTAURACION.md`.

Criterio de cierre de H-001: restauración demostrada y cronometrada, volcados cifrados automáticos, RPO/RTO acordados por escrito. Hasta que el plan de pago esté decidido, H-001 **no se declara resuelto**: solo mitigado si se instala la capa 2.

## 5. H-016 — Ramas
Ver `00_RECONCILIACION_GIT.md`. Resumen: bundle de respaldo → worktree `cierre/fase-0` desde `origin/main` → portar por archivo → push lo haces tú.

## 6. Entregables de la Fase 0 y riesgos
Entregables: worktree limpio, `supabase start/reset` reproducible con script (`scripts/entorno-local.ps1`), semilla de prueba, suite de aislamiento (3 capas) con informe, volcado cifrado + restauración ensayada, `docs/RESTAURACION.md`, informe de reconstrucción de base nueva (insumo de la Fase 2).

| Riesgo | Mitigación |
|---|---|
| El reset local falla por el historial de migraciones | Es un hallazgo, no un bloqueo: se documenta y pasa a Fase 2 |
| Docker Desktop consume recursos / no inicia | Plan B: staging con autorización |
| Escribir en producción por error | Verificación de host al arrancar y claves distintas |
| Datos personales en volcados | Los volcados de producción están cifrados y **no** se cargan en el entorno de pruebas; se usa semilla sintética |
| Costes ocultos de backups | Ninguna contratación sin tu aprobación |

Porcentaje de preparación esperado tras la Fase 0 (estimación, no compromiso): 35 % → ~45 % si backup y aislamiento quedan demostrados.
