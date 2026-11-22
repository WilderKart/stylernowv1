# 01 · Privilegio MAINTAIN (PostgreSQL 17) en `anon` y `authenticated`

**Clasificación: CORREGIDO en local (migración 145, NO aplicada en producción).** Un matiz de la hipótesis inicial quedó **NO REPRODUCIDO**: ver «Lo que MAINTAIN no hace».

## 1. Investigación (producción, solo lectura, 2026-11-16; local con la misma versión)
| Medición | Producción (PG 17.6) |
|---|---|
| Tablas de `public` | 139 |
| Con MAINTAIN para `anon` | 96 |
| Con MAINTAIN para `authenticated` | 104 |
| Tablas con MAINTAIN fuera de `public` (auth, storage, graphql, realtime…) | 0 |
| Vistas materializadas de `public` con MAINTAIN | 0 |

**Origen:** los privilegios por defecto del rol `postgres` en `public` (tablas creadas por las migraciones) incluían `arwdDxtm` para `anon`/`authenticated`. La 141 retiró `D`, `x`, `t`; quedaba `arwdm` (la `m` es MAINTAIN). Las tablas con menos privilegios son las que la instantánea de privilegios ya restringía a mano (p. ej. solo lectura).
Además existe una entrada de privilegios por defecto de **`supabase_admin`** en `public` con `arwdDxtm` para `anon`/`authenticated`: afecta solo a objetos que cree ese rol de plataforma; `postgres` no puede modificarla (requiere ese rol). **Residual aceptado, solo plataforma.**

## 2. Dependencias legítimas
- Código: búsqueda de `vacuum`, `analyze`, `reindex`, `cluster`, `refresh materialized`, `lock table` en `src/` y en las 145 migraciones: **ninguna aparición** (solo comentarios).
- PostgREST (la API) nunca emite esos comandos; autovacuum/autoanalyze corren como superusuario; las tareas programadas y migraciones corren como `postgres`, que conserva el privilegio.
- Conclusión: **ninguna operación legítima de `anon` ni `authenticated` usa MAINTAIN.**

## 3. Migración `supabase/migrations/145_quitar_maintain_a_roles_publicos.sql`
Aditiva (solo reduce privilegios, no toca filas), idempotente y protegida por versión (en Postgres < 17 no hace nada):
`revoke maintain on all tables in schema public from anon, authenticated` + dos `alter default privileges … revoke maintain` para tablas futuras.
Reversión: `grant maintain on all tables in schema public to anon, authenticated;`

## 4. Pruebas antes/después con roles reales (reproducibles)
**Suite `tests/sql/f1b_maintain_145.sql` (16/16):** dentro de una transacción con ROLLBACK emula el estado previo de producción y mide con `set local role`.

| Operación | Rol | ANTES | DESPUÉS |
|---|---|---|---|
| `REINDEX TABLE reserva` | anon | permitido | **denegado** |
| `REINDEX TABLE reserva` / `perfil` | authenticated | permitido | **denegado** |
| `CLUSTER reserva` | authenticated | permitido | **denegado** |
| `SELECT negocio` (RLS) | authenticated / anon | permitido | permitido |
| RPC de la app (`is_supersu()`) | authenticated | permitido | permitido |
| `REINDEX` | service_role | permitido | permitido |
| Tablas `public` con MAINTAIN (incluida una tabla recién creada) | — | >0 | **0** |

**VACUUM** (no corre dentro de transacción; medido en una copia aparte con comandos separados, roles reales):
- Con MAINTAIN: `authenticated` y `anon` ejecutan `VACUUM` y `VACUUM (ANALYZE)` sin aviso.
- Sin MAINTAIN: ambos reciben `WARNING: permission denied to vacuum "reserva", skipping it` (no se ejecuta); `service_role` lo ejecuta sin aviso.
- Segunda ejecución de la migración: sin error (idempotente).
- `ANALYZE` solo emite aviso (no error) cuando falta el privilegio; por eso se midió con VACUUM y REINDEX/CLUSTER.

## 5. Lo que MAINTAIN no hace (hipótesis corregida con evidencia)
Hipótesis inicial: MAINTAIN permitiría bloquear tablas con `LOCK TABLE … ACCESS EXCLUSIVE`. **NO REPRODUCIDO como efecto de MAINTAIN:** tras revocarlo, `authenticated` sigue pudiendo ejecutar `LOCK TABLE reserva IN ACCESS EXCLUSIVE MODE`, porque `UPDATE`/`DELETE` también lo habilitan. Eso no se resuelve con permisos de tabla (hay que limitarlo por `lock_timeout`/`statement_timeout` de los roles de la API) y solo es explotable si existe una vía para ejecutar SQL arbitrario como esos roles, que la API no ofrece. Queda como **PENDIENTE (bajo): fijar `statement_timeout` y `lock_timeout` a los roles `anon`/`authenticated`**; no se hizo (cambio de configuración de la base, requiere tu decisión).

## 6. Comandos para reproducir
```
docker exec -i supabase_db_stylernow-cierre psql -U postgres -d limpia -v ON_ERROR_STOP=1 < tests/sql/f1b_maintain_145.sql
```
