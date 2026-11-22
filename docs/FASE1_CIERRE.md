# FASE 1 — Cierre (roles, cupos, sesiones, publicación)

Complementa a `docs/FASE1_ROLES_CUPOS_INFORME.md`. Todo contra Supabase LOCAL (Docker); producción intacta; sin commits. Tres secciones: Implementado, Probado, Pendiente de decisión. Fechas de ejecución: 2026-11-18 a 2026-11-19.

---

## A. IMPLEMENTADO

### A.1 Roles y permisos (migraciones 158, 161)
- Roles derivados de capacidades en `vinculo_staff_negocio` (`es_admin`, `presta_servicios`): BUSINESS_OWNER (derivado de `negocio.owner_user_id`), BUSINESS_ADMIN, ADMIN_BARBER, BARBER; SUPER_ADMIN sin cambios; no existe «OWNER». Guardian queda intacto (alcance por sede).
- `is_admin_de(negocio)`, `rol_equipo(...)`. `is_barberia_de` / `is_staff_de` no cambian. Aplicación: resolver con `RolPanel = "ADMIN"` opt-in, registro `PERMISOS_ADMIN_DELEGADO` (lista cerrada).
- Delegación MÍNIMA a administradores: ver equipo/invitaciones, invitar BARBER, cancelar/reenviar invitaciones a BARBER, suspender/reactivar/retirar/trasladar profesionales que no son administradores. Negado y probado: suscripción, pagos, plan, propiedad, verificación, configuración de planes, cambiar roles, Guardian, perfil del propietario.

### A.2 Perfil profesional del propietario por plan (151, 153)
- Configuración única en `plan`: `propietario_profesional_por_defecto`, `propietario_perfil_auto_alta`, `propietario_puede_activar_perfil`, `propietario_puede_desactivar_perfil`. Iniciales: Essential por defecto + automático; Studio/Prestige/Signature apagados y activables.
- La leen `activar_/desactivar_perfil_profesional_propietario`, `completar_onboarding_negocio`, la normalización 157 y la interfaz. RPC SuperSU `admin_configurar_perfil_propietario_plan` (motivo ≥ 10, rechaza configuración incoherente, audita antes/después) + editor en `/admin/planes`.
- Sin sede operativa no se crea vínculo (`SIN_SEDE`). Desactivar se bloquea con reservas futuras.

### A.3 Capacidad y concurrencia (152)
- UNA función central `_capacidad_profesional` (incluidos, adicionales como parámetro, activos, suspendidos, pendientes, invitaciones vigentes, ocupados, disponibles, exceso). SUSPENDIDO sigue ocupando cupo; invitaciones a BUSINESS_ADMIN no ocupan; vencidas/canceladas/rechazadas no cuentan.
- Unifica invitar, aceptar, `cupo_plan_negocio`, downgrade y `datos.ts`. Candado por negocio (`pg_advisory_xact_lock`) y disparadores de respaldo sobre `vinculo_staff_negocio` e `invitacion_staff` (para clientes `authenticated`/`anon`; sesiones de confianza no pasan, cada RPC valida de forma explícita).
- Exceso preexistente: se registra, no se corrige; se bloquea lo que lo aumente.

### A.4 session_version (155) — explicación precisa para aprobar o rechazar
**Defecto:** el trigger `perfil_proteger_columnas_sensibles` (084) rechaza cambiar `perfil.session_version` si `auth.uid()` no es nulo y el actor no es SuperSU. `suspender_staff`, `trasladar_staff` y `revocar_guardian` lo cambiaban dentro de una función definer llamada por el propietario (con `auth.uid()` = propietario): el trigger lo rechazaba y la acción entera fallaba para el propietario.
**Solución:** función interna `invalidar_sesion_usuario(usuario, negocio, motivo)`, SIN grants para ningún rol de la API. Valida QUIÉN llama (propietario, administrador delegado o SuperSU del negocio) y SOBRE QUIÉN (alguien con vínculo con ese negocio; al propietario solo él o SuperSU), incrementa y deja evento `SESION_INVALIDADA`. La usan suspender, trasladar, retirar, promover/revocar Guardian y cambiar rol.
**Cambio al trigger (la parte que debe aprobar):** la regla original queda idéntica; se le añade UNA excepción. El UPDATE de `session_version` solo se permite si se cumplen A LA VEZ: (1) la marca de transacción `stylernow.sv_autorizado = 'on'`, que solo escribe `invalidar_sesion_usuario` con `set_config(..., true)` justo antes del UPDATE y vuelve a limpiar justo después; y (2) `current_user` NO es `authenticated` ni `anon`. Un cliente de la API siempre ejecuta como `authenticated`/`anon`, así que aunque se escribiera él mismo la marca el factor (2) lo bloquea (probado: «marca autoescrita + UPDATE directo»). Solo código que corre como dueño de la función (definer) puede satisfacer ambos, y la única función que pone la marca es la dedicada. **Desviación del encargo:** pedía «trigger intacto»; no existe forma de abrir una vía autorizada sin esa cláusula (alternativas como borrar `request.jwt.claims` dentro de la función serían peor).
**Riesgo residual:** una futura función definer que escriba la marca por su cuenta abriría la vía; se mitiga porque solo `invalidar_sesion_usuario` la usa y la función no es invocable por la API. Hallazgo: ningún consumidor exige hoy `session_version` (los permisos se leen de la base en cada solicitud y cambian al instante): el contador es una señal auditada.
Rollback: `155_..._REVERSION.sql.txt` (restaura el defecto).

### A.5 Invitaciones de Staff (152, app)
Rol en la invitación (`rol_invitado`); correo que dice el rol (`texto-invitacion.ts`); un administrador solo invita BARBER; aceptar desde `/invitacion/[id]` ahora usa `aceptar_invitacion_staff` con casilla expresa de tratamiento de datos (antes llamaba a `responder_invitacion(true)`, que la base rechaza: estaba roto).

### A.6 Publicación y consentimiento
La foto profesional (`staff.foto_url`) es independiente de la fachada/galería del negocio. Para aparecer en `negocio_staff_publico`/slots públicos la base exige foto + consentimiento expreso (`staff_es_publicable`, evidencia inmutable encadenada con fecha, versión del texto, actor y huella) y permite retirarlo (`revocar_publicacion_staff`, efecto inmediato). Nada en la interfaz llamaba a `autorizar_staff`: se añadió `TarjetaVisibilidadPublica` (panel y `/staff/perfil`) con casillas sin marcar, subir foto, autorizar y retirar. Sin foto o sin consentimiento el profesional usa su agenda privada pero no aparece.

### A.7 Migraciones y compatibilidad
- Orden: `…144` → (145, 146, 147, 148 de OTRAS ramas) → `149` límites → `150` onboarding → `151` modelo → `152` cupo → `153` perfil propietario → `154` delegación → `155` sesión controlada → `157` normalización (no hay 156 a propósito). Cada una con reversión `.sql.txt`; parches de funciones por ancla con `pg_get_functiondef`, idempotentes.
- **Dependencias:** la publicación y aceptar invitaciones dependen de `autorizar_staff`, `aceptar_invitacion_staff`, `estado_autorizaciones_staff`, `evidencia_legal` y `_registrar_evidencia`, que NO están en ninguna migración de esta rama: viven en 145/146/148 (`feat/centro-cumplimiento`) y 147 (worktree `stylernow-evidencias`, sin commitear). Esta rama sola no es autosuficiente.
- **Colisión de numeración:** `feat/centro-cumplimiento` usa 145, 146, 148 y **150–154** (cumplimiento); esta rama usa 149–157. Además el worktree de cierre (`cierre/fase-0`) llega hasta 142 y la rama de autorización de reserva hasta 144, sin 145. Hay que renumerar al integrar (propuesta: poner 149–157 por encima de la mayor numeración de las otras ramas, p. ej. 160+, y traer 145–148 antes). Las migraciones posteriores de otros agentes (160–164, 170–178) ya ocupan esos rangos locales.
- Base nueva: las 154 migraciones de la rama corren; la unión con 145–148 corre (158). `schema_migrations` local llega a 137: no se registró nada (sería afirmar algo falso).

---

## B. PROBADO

Comandos reales (sin tokens ni contraseñas; credenciales de pruebas en archivos del scratchpad):
- SQL: `docker exec -i supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < tests/sql/<suite>.sql`; con inyección de la migración: `bash tests/sql/roles_157_normalizacion.sh`.
- Todo junto, secuencial y con foto de configuración compartida: `CUENTAS=<archivo> ANON_DESDE=<archivo> bash tests/run-sql-suites.sh`.
- Frontend: `npx tsc --noEmit`, `npx eslint src …`, `npx vitest run`, `npx next build --webpack`.

Cobertura funcional y de seguridad (suites propias de esta fase): `roles_151` (roles, cupos 1/5/15/50, invitaciones vigentes/vencidas/canceladas/rechazadas, cambio de rol sin evadir tope, exceso, administrador puro fuera de público y slots, IDOR, REVOKE por `aclexplode`), `roles_155_config_sesion_publicacion` (session_version con propietario/administrador/barbero/ajeno, intento de autoponerse la marca, suspender/trasladar/retirar/cambiar rol que invalidan y revocan permisos al instante, suspendidos ocupan cupo, alcance mínimo de BUSINESS_ADMIN, configuración por plan, foto + consentimiento + retiro + evidencia inmutable), `roles_157_normalizacion` (alta incompleta, negocio sin sede, exceso, huérfanos, idempotencia), `roles_151_concurrencia.sh` (6 sesiones: 2 creadas con candado; 6 sin candado), `roles_http.sh` (HTTP real con JWT: propietario, administrador, barbero, otro negocio, anónimo).
Estabilidad de pruebas: roles_157 ahora fija la configuración de planes dentro de su transacción (antes fallaba si alguien dejaba `ESSENTIAL.propietario_profesional_por_defecto=false`: se encontró un cambio temporal de 2 s en `evento_auditoria`). `f1b_compat_codigo_vs_base.sql` ya no es un «exit 0» sin aserciones: levanta excepción si falla la matriz esperada (estado S0) o si alguna llamada `.rpc(...)` de `src/` (230 contratos generados con `tests/sql/gen_contratos_rpc.cjs`) no tiene función, argumentos o permiso de ejecución; control negativo `f1b_compat_control_negativo.sh` (borra función, quita argumento, retira permiso: la suite falla en los 4 casos). **Hallazgo real que esa suite destapó:** `ejecutar_downgrades_programados`, `expirar_reservas_vencidas`, `generar_roi_snapshot_mensual` y `otorgar_creditos_plan_mensual` las llama el cron diario con el cliente de servidor pero su ACL solo incluye `postgres` (nadie de la API puede ejecutarlas): el cron fallaría. Se deja como «BRECHA CONOCIDA» explícita (aviso en cada corrida), no se arregla aquí. Y `ai_acciones_costo_admin` (migración 139) no existe en la base local (estado S0).

### B.1 Corrida final (2026-11-19), secuencial, con foto de la configuración compartida antes/después de CADA suite
Comando: `CUENTAS=<archivo> ANON_DESDE=<archivo> bash tests/run-sql-suites.sh`. Resultado: **configuración compartida idéntica antes y después de todas las suites; 0 suites con residuo** (se comparan hashes de `plan`, `plan_precio`, `plan_caracteristica`, `plan_funcion_ia`, `configuracion_plataforma`, `pais`, `addon_precio`, `adicional_config`, `adicional_estado_def`, `adicional_precio_plan`, `adicional_transicion`, `ai_modelo_config`, `referido_config`, `texto_legal`, `whatsapp_config`). Auditoría previa de scripts: todas las suites `.sql` ya corrían dentro de `begin … rollback`; los `.sh` solo tocan datos de sus propios negocios de prueba (y `restringida_http.sh` restaura la suscripción y el precio con `trap … EXIT`).

| Suite | Resultado | ¿Preexistente o nuevo? | Causa |
|---|---|---|---|
| adicionales_170, restringida_160, aislamiento_multiempresa, anticipos_129, cobro_directo_119, limites_plan_149, onboarding_verificacion_150, prueba_antiabuso_135, registro_pendiente_127, registro_telefono_128, rendimiento_131, seguridad_regresion, webhook_130 | PASA | — | — |
| roles_151, roles_155_config_sesion_publicacion, roles_157_normalizacion, roles_151_concurrencia | PASA | — (nuevas de esta fase) | — |
| f1b_compat_codigo_vs_base (con aserciones) y f1b_compat_control_negativo (4 casos) | PASA | — | La suite antes imprimía una matriz y salía 0; falla si se quita una función/argumento/permiso (control negativo demostrado) |
| hotfix_staff_nulo_verificacion (previo+hotfix+posterior) | PASA | — | — |
| adicionales_170_concurrencia, roles_http (38 comprobaciones), adicionales_http, restringida_http | PASA | — | — |
| auditoria_123, libro_122, whatsapp_120, directiva_116_118, f0_05_crear_grupo_familiar, f1b_139_endurecimiento, f1b_promociones_140 | FALLA | Preexistente (línea base antes de cambiar nada) | `ux_perfil_supersu_unico`: la prueba intenta crear un 2.º SuperSU. Auditoria_123, libro_122 y whatsapp_120 pasan con el SuperSU descendido en copia temporal (verificado en la Fase 1) |
| f1b_141_142 | FALLA | Preexistente | «7 casos no coinciden»: migraciones 139–144 sin aplicar en la base local |
| notificaciones_124 | FALLA | Preexistente (mismo mensaje; el contador pasó de 6 a 8 por plantillas de otros agentes) | Cliente nuevo debía encolarse (EMAIL+PANEL) |
| suscripcion_133 | FALLA | Preexistente | `PLAN_SIN_PRECIO` |

No se debilitó ninguna restricción de la base de datos para pasar pruebas; las suites rojas siguen rojas por su causa original y se muestran como FALLA.

### B.2 Frontend (2026-11-19)
`npx tsc --noEmit`: exit 0. `npx eslint src tests/roles-equipo.test.ts tests/texto-invitacion.test.ts`: exit 0 sin avisos. `npx vitest run`: 167 pasan, 26 omitidas (la línea base de esta rama era 127). `npx next build --webpack`: compila y genera páginas; servidor local del puerto 3310 reiniciado con ese build.

### B.3 No verificado
Producción; subir una foto real por la interfaz (usa Storage); correo real de invitación (sin clave válida de Resend: solo el texto); la matriz de `f1b_compat` solo tiene expectativas para el estado S0 (las de S1/S2 no se pudieron verificar localmente).

---

## C. PENDIENTE DE DECISIÓN
1. **Aprobar o rechazar la excepción de dos factores** del trigger de `perfil` (A.4).
2. Renumerar 149–157 al integrar y traer 145–148 antes (A.7).
3. ¿Exigir `session_version` en proxy/JWT para que invalidar sesión corte sesiones abiertas?
4. Brecha del cron diario (4 funciones sin permiso para `service_role`): decidir el GRANT (cambia seguridad de otra área).
5. Ampliar la delegación de BUSINESS_ADMIN más allá del equipo (~110 políticas y 95 funciones usan `is_barberia_de`).
6. La foto profesional se sube a Supabase Storage (`avatars`), el resto del onboarding usa Cloudinary: unificar.
7. Textos legales de autorización de publicación/tratamiento siguen en BORRADOR en la base local.
8. SUSPENDIDO ocupa cupo (aplicado según lo aprobado); revisar con negocio el efecto comercial.
9. Normalización 157 aplicada solo en LOCAL; producción: no tocada (la decisión y el orden de despliegue quedan abiertos).
