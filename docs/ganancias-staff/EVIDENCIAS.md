# Evidencias de verificación — ganancias del staff

Registro de las verificaciones ejecutadas el 2026-11-26 sobre el working tree local. No sustituye la verificación en producción con servicios reales (ver `PROGRESO.md`).

## Comandos y resultados

| Verificación | Comando | Resultado |
|---|---|---|
| SQL de ganancias | `cmd /c "docker exec -i supabase_db_stylernow psql -U postgres -v ON_ERROR_STOP=1 < tests\sql\ganancias_staff.sql"` | `OK ganancias_staff` (transacción con `ROLLBACK`) |
| Unitarias | `npm test` | 48 archivos, 367 pruebas OK; 30 omitidas (integraciones condicionadas por entorno) |
| Unitaria del módulo | `npx vitest run tests/ganancias-lib.test.ts` | 6/6 OK |
| Lint | `npm run lint` | 0 errores, 14 avisos preexistentes (ninguno en `ganancias-*`) |
| Tipos | `npm run typecheck` | OK |
| Build | `npm run build` | OK; 127 páginas + 4 handlers auditados, 117 páginas generadas |

El build se ejecutó con el cambio local sin commitear en `next.config.ts` (`serverActions.bodySizeLimit: "4mb"`); las rutas `/panel/ganancias`, `/panel/ganancias/exportar` y `/staff/ganancias*` se generaron correctamente.

## Revisión de la superficie (auditoría complementaria)

- `src/app/panel/ganancias/actions.ts`: `negocioDeSesion()` deriva el negocio de `resolverContexto()`; Zod valida todos los UUID, montos, fechas y enums antes de llamar a la RPC.
- `src/app/panel/ganancias/exportar/route.ts`: exige rol y capacidad `exportar`, reutiliza `ganancias_listar` con el negocio de la sesión, topa 5.000 filas, registra la auditoría y devuelve `Cache-Control: no-store`.
- `src/app/staff/ganancias/actions.ts`: el profesional solo solicita revisiones sobre objetos propios; la base responde `NO_ENCONTRADO` para objetos ajenos.
- Migración 201: `security definer` con `search_path = public`; `revoke all` a `public, anon, authenticated` y `grant execute` solo a `authenticated` para las funciones del panel; los helpers internos no son invocables.
- `_gan_permiso` con `p_sede is null` solo acepta permisos de negocio completo (`gp.sede_id is null`), cerrando el escalamiento de administrador de sede.
- `_trg_reserva_ganancia` captura `when others`, audita `GANANCIA_GENERACION_FALLIDA` y no propaga el error al POS.
