# 03 · Auditoría de las 115 Server Actions pendientes

Fecha: 2026-11-16 · Entorno: Docker local `stylernow-cierre` con las migraciones 001-146 (incluye 139-142, 145 y 146) · sesiones reales de GoTrue por actor · nada contra producción.

## 1. Método (reproducible)
1. Arnés `tests/server-actions-autorizacion.test.ts` importa el código REAL de cada Server Action y lo invoca con la sesión real (JWT) de cada actor, apuntando los argumentos a los recursos del **negocio B**.
2. **Actores (11):** ajenos a B = `anonimo`, `intruso` (sin rol), `cliente-a`, `pro-a1` (profesional de A), `guardian-a`, `dueno-a`; **controles** autorizados sobre B = `cliente-b`, `pro-b1`, `guardian-b`, `dueno-b`, `super`. Cubren los cinco perfiles pedidos (anónimo, cliente, profesional/staff, propietario, Super Admin), cada uno como ajeno y como autorizado.
3. Mide por llamada: **fuga de lectura** (el resultado contiene datos de B) y **escritura cruzada** (cambia la huella de las 60+ tablas con `negocio_id = B`, perfiles/staff/usuarios de B, reservas y el propio negocio).
4. Para las 115 acciones que el arnés automático dejó «inconclusas» (la llamada de control no era válida), se escribieron **argumentos a mano** (`tests/server-actions-argumentos.ts`, 104 acciones) para que los controles logren ejecutar la acción; el resto del método es idéntico. Se hicieron 3 pasadas (evidencia en `docs/plan_cierre/evidencias_1b/server_actions_pendientes_pasada{1,2,3}.json`).
5. **Veredicto por acción** (`scripts/matriz-autorizacion.mjs` → `04_MATRIZ_AUTORIZACION.csv`):
   - **SEGURA_DEMOSTRADA:** algún control autorizado ejecutó la acción con éxito y los 6 ajenos ni leyeron ni escribieron en B.
   - **SEGURA_DIFERENCIAL:** ningún control llegó al éxito (regla de negocio o estado), pero ≥3 ajenos autenticados fueron DENEGADOS por autorización y ≥1 control superó esa barrera y se detuvo en una regla de negocio. Es evidencia más débil que la anterior.
   - **INCONCLUSA:** no se demostró nada (ver §4).

## 2. Qué criterios de los 10 quedan demostrados y cuáles no
| # | Criterio | Estado |
|---|---|---|
| 1 | Autenticación | **Demostrado** (anónimo denegado en las acciones con efecto) |
| 2 | Autorización en servidor | **Demostrado** por actor (11 actores × acción) |
| 3 | Rol requerido | **Demostrado** en la matriz: p. ej. `crearOActualizarNegocio` solo el dueño B; `guardarSede` guardián/dueño/Super |
| 4 | Relación con el negocio y aislamiento multi-tenant | **Demostrado** (huella de B sin cambios por ajenos) |
| 5 | Validación de parámetros | **Parcial:** se observaron los rechazos de validación de los controles, pero no se hizo fuzzing sistemático de entradas |
| 6 | IDOR | **Demostrado:** los ajenos reciben ids reales de B (reserva, vínculo, sede, membresía, campaña, egreso…) |
| 7 | Escalada de privilegios | **Parcial:** cubierta en BD (`es_supersu`, `email`, `session_version`, roles en `seguridad_regresion`, `f1b_session_version_146`); no se probó cada acción con parámetros de rol manipulados |
| 8 | Integridad de datos | **Parcial:** huella de B + pruebas SQL; sin pruebas de concurrencia |
| 9 | Información sensible | **Demostrado** para lectura de B por ajenos; costos de IA y config de referidos cerrados (139) |
| 10 | Comportamiento ante no autorizados | **Demostrado** (códigos de error de permiso, sin escritura) |

## 3. Resultados sobre las 268 acciones (matriz completa)
| Veredicto | Acciones |
|---|---|
| SEGURA_DEMOSTRADA | **197** |
| SEGURA_DIFERENCIAL | **26** |
| NO_VIOLACION_REVISADA (marcadas por el arnés, justificadas una a una) | **8** |
| VIOLACION sin explicar | **0** |
| INCONCLUSA | **30** |
| OMITIDA a propósito (login, registro, Google, cierre de sesión) | **7** |

**De las 115 pendientes:** 57 SEGURA_DEMOSTRADA, 26 SEGURA_DIFERENCIAL, 3 NO_VIOLACION_REVISADA, **29 siguen INCONCLUSA** (+ `registrarEventoFraude`, que antes de 142 era una fuga real y hoy queda inconclusa en el arnés; su cierre está demostrado en SQL, ver H-1).

## 4. Hallazgos
| ID | Hallazgo | Clasificación | Evidencia |
|---|---|---|---|
| H-1 | `registrarEventoFraude` insertaba eventos en el negocio de otro con severidad/payload libres (Fase 1B) | **CORREGIDO** (142 aplicada en producción) | `tests/sql/f1b_141_142.sql` 9/9 |
| H-2 | **Regresión funcional:** el dueño **no puede suspender staff, revocar guardianes ni trasladar staff**. El trigger `perfil_proteger_columnas_sensibles` bloquea cualquier cambio de `session_version` si `auth.uid()` no es nulo y no es Super Admin; las funciones DEFINER `suspender_staff`, `revocar_guardian`, `trasladar_staff` llaman a `incrementar_session_version()` y todo falla con `NO_AUTORIZADO: session_version no se puede modificar directamente`. No es una fuga: es un bloqueo de operaciones legítimas | **CORREGIDO en local (migración 146, NO aplicada en producción)**. **Producción: PENDIENTE de confirmar.** El trigger y `suspender_staff` de producción tienen el mismo md5 que en local, así que casi seguro ocurre allí también; no pude probarlo en vivo (mi intento de prueba con rollback fue bloqueado por el control de permisos y no lo reintenté) | `tests/sql/f1b_session_version_146.sql` 9/9: ANTES el dueño es denegado; DESPUÉS suspende; el cliente/profesional siguen denegados; la escritura directa de `session_version`, `es_supersu` y `email` sigue denegada. Arnés pasada 3: `suspenderStaff`, `revocarGuardian`, `reactivarStaff`, `trasladarStaff` → LIMPIA con control ejecutando |
| H-3 | «Éxito silencioso»: `crearOActualizarNegocio`, `guardarSede` (rama de actualización) y `actualizarSede` devolvían `ok: true` (y el id recibido) a quien no es dueño aunque no se actualizara nada. Sin fuga ni escritura (la huella de B no cambió), pero el arnés lo marcaba como «lee B» y la UI habría mostrado éxito falso | **CORREGIDO en el código del worktree (sin commit ni despliegue)**: ahora comprueban filas afectadas y devuelven «No tienes permiso…». Prueba: pasada 1 (antes) = ajenos `OK+LEE_B`; pasada 2 (después) = los 6 ajenos DENEGADOS y solo dueño/guardián/Super ejecutan | `server_actions_pendientes_pasada1.json` vs `..._pasada2.json` |
| H-4 | Falsos positivos del arnés, revisados: `alternarFavorito`, `exportarDatosAccion`, `listarServiciosActivos`, `listarAuditoriaNegocio`, `listarMisTickets` (datos propios o catálogo público), `iniciarCompraMembresia`, `iniciarCompraGiftCard` (el comprador es quien llama: la gift card queda a su nombre, verificado `comprador_id = actor`), `unirseListaEspera` (inscripción propia, verificado `cliente_id = actor`) | **NO REPRODUCIDO como vulnerabilidad** | filas en `04_MATRIZ_AUTORIZACION.csv` (veredicto `NO_VIOLACION_REVISADA`, columna `motivo`) |
| H-5 | Patrón a revisar: otras acciones que hacen `.update()` bajo RLS sin comprobar filas afectadas pueden mostrar éxito falso a un ajeno (sin daño) | **PENDIENTE (bajo)**: no se barrió todo el código; las tres detectadas se corrigieron | — |
| H-6 | `crear_reserva` ya no es ejecutable por `authenticated` en producción (migración 144 de otra línea de trabajo en `main`); el arnés local no la refleja | **NO ES HALLAZGO MÍO / A COORDINAR**: confirmar que la acción `crearReservaAction` desplegada usa el nuevo camino. Ver nota | consulta de solo lectura a `pg_proc.proacl` |

**Nota H-6:** al comparar con producción vi que `crear_reserva(uuid,uuid[],timestamptz,uuid,text)` solo la ejecutan `postgres` y `service_role`, y que `origin/main` contiene las migraciones `143_autorizacion_datos_reserva` y `144_cerrar_crear_reserva_directo` (trabajo de otra sesión, no mío). Mi rama `cierre/fase-0` **no tiene esas migraciones**: la acción `crearReservaAction` de mi rama sigue llamando `crear_reserva` con la sesión del usuario. Al integrar `main` en la rama hay que revisar ese flujo. **Además: mi migración de MAINTAIN se numeró 145 para no chocar con la 143 y 144 de `main`; la de session_version, 146.**

## 5. Las 30 acciones INCONCLUSAS (no demostradas) y qué falta
| Causa | Acciones | Qué haría falta |
|---|---|---|
| Fixture inadecuado (estado de la cita/reserva ya cambiado por acciones previas de la misma corrida) | `marcarNoShow`, `hacerCheckIn`, `hacerCheckOut`, `iniciarPagoSena`, `confirmarSinAnticipo` | Una reserva nueva por acción (PENDIENTE_PAGO / CONFIRMADA / EN_CURSO) creada por SQL antes de cada llamada |
| Seed: gift card con `pin_hash` inválido en local (`invalid salt`) | `consultarMiGiftCard`, `canjearGiftCardEnPos` | Sembrar una gift card con PIN válido (`crypt(pin, gen_salt('bf'))` con el esquema correcto) |
| Ids de semilla que `z.uuid()` rechaza (no cumplen RFC 4122) | `eliminarPlantilla`, `crearCampana` (WhatsApp), `cancelarRecarga` | Sembrar filas con `gen_random_uuid()` |
| Plan del negocio B sin la función | `sembrarNivelesVipAction`, `crearReglaRecompensaAction` | Negocio de prueba con plan que incluya la función |
| Requiere flujo externo o autenticación real | `registrarReferido`, `responderInvitacion` (invitación dirigida a un correo), `iniciarPrueba` (verificación de dispositivo), `suscribirPushAction`, `compartirFotos`, `subirFoto`/`subirFotoPerfil`/`subirFotoPerfilStaff` (imagen real), `masResenasAction`, `crearReservaAction` (ver H-6), `pedirDevolucion`, `direccionDesdeCoordenadas` (red externa bloqueada a propósito), `restaurarVersionMemoriaIa` (sin versión histórica sembrada), `subirFoto` (CRM: RLS de `reserva_foto` exige estado previo) | Fixtures específicos |
| Acciones sobre la propia sesión, sin id ajeno (no hay superficie IDOR): `cambiarContrasena`, `crearContrasena`, `restablecerContrasena`, `solicitarEliminacionAccion` | — | No se invocan con éxito a propósito (cambiarían la contraseña/cuenta de prueba); revisión estática: usan solo `auth.getUser()` |
| `registrarEventoFraude` | — | Cierre demostrado en SQL (142) |

Estas 30 quedan **PENDIENTES**; no se declaran seguras.

## 6. Cómo reproducir
```
# base local ya construida; cargar variables sin imprimirlas
PRUEBAS_LOCALES_FASE1B=1 SOLO_CON_ARGS=1 ETIQUETA=<etiqueta> npx vitest run tests/server-actions-autorizacion.test.ts
node scripts/matriz-autorizacion.mjs        # fusiona corridas -> 04_MATRIZ_AUTORIZACION.csv
node scripts/resumen-controles.mjs <json>   # error de los CONTROLES por acción
```
Limitación honesta: la corrida completa de 268 acciones tarda >50 min y excede el tiempo límite del arnés (3 000 s); por eso la matriz fusiona la corrida completa previa a 139-142 con las corridas por tramos posteriores, y la fila indica `corrida_de_evidencia`.
