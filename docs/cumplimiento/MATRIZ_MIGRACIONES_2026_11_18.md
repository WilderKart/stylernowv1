> **Superada por `docs/INTEGRACION_LIBERACION.md` (2026-11-22).** La numeración de esta matriz es la anterior a la renumeración: la secuencia vigente es 145–178.

# Matriz de control de migraciones — 2026-11-18

Producción: Supabase `wxokamgnrpyhobkqjylm`. Código desplegado: `main` = `6901871` (Vercel, READY).
Datos de prueba en producción al auditar: 99 negocios, 287 usuarios, 42 reservas, 0 tickets.

## Reconciliado hoy
Las migraciones 139, 141, 142, 143 y 144 estaban aplicadas por SQL pero ausentes del registro. Se verificó el efecto real en producción antes de registrarlas:
- 141: `anon` y `authenticated` sin TRUNCATE sobre `negocio`.
- 142: existe `registrar_evento_fraude`.
- 143: existen la tabla `autorizacion_datos_reserva`, su trigger de inmutabilidad y `crear_reserva_autorizada`.
- 144: `crear_reserva` directo ya no es ejecutable por `authenticated`.
- 139: aplicada y verificada en la liberación controlada anterior.
Se registraron con `created_by` explicando el origen. Ninguna se registró sin su efecto presente.

## Matriz
| Migración | Local | Producción | Dependencias | Acción |
|---|---|---|---|---|
| 001–138, 140 | en `main` | aplicadas y registradas | — | ninguna |
| 139, 141, 142, 143, 144 | en `main` | aplicadas, ahora registradas | 138 | ninguna |
| 145 aceptación legal solo servidor | evidencias (sin commit); copia en `feat/centro-cumplimiento` | NO aplicada | requiere el código de `aceptacion-legal.ts` de la rama de evidencias | aplicar junto con ese código, no antes |
| 146 repositorio de evidencias | ídem | NO aplicada | 145 | ídem |
| 147 staff, invitación y `estado_juridico` | solo en worktree de evidencias | NO aplicada | 145, 146; código de invitaciones | decidir integración (ver abajo) |
| 148 centro de evidencias SuperSU | evidencias; copia en cumplimiento | NO aplicada | 146 | tras 146, con su UI |
| 149 textos legales TAWILSTACK v4 | `legal/tawilstack-v4` (en remoto) | NO aplicada | `texto_legal`; conviene 147 (`estado_juridico`) | aplicar como BORRADOR, nunca vigente, tras 147 |
| 150–154 Centro de Cumplimiento | commit `cc93248` | NO aplicadas | 145, 146, 148 (la 153 escribe en `evidencia_legal`) | tras 145/146/148 |
| 145 cierre (MAINTAIN) | worktree cierre, sin commit | NO aplicada | — | renumerar a 155+ |
| 146 cierre (session_version) | worktree cierre, sin commit | NO aplicada | — | renumerar a 155+ |

## Conflictos de numeración
- `145` y `146` existen dos veces: evidencias (se conserva el número, no se aplicó nada) y cierre (se renumera a 155+ antes de commitear). No hay trazabilidad que perder: ninguna está aplicada.
- Orden de aplicación: 145, 146, 147, 148, 149 (borrador), 150–154, 155+.

## Dependencia que necesita decisión del propietario
El código que acompaña a 145–148 (aceptación legal solo servidor, invitación de Staff, Centro de Evidencias) está **sin commit en el worktree `stylernow-evidencias`**. Aplicar 145 sin ese código rompería la escritura de aceptaciones desde la app desplegada. Para integrarlo hay que commitear esa rama; es trabajo de otra sesión con 31 archivos modificados y no se tocó.
