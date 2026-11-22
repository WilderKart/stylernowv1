# FASE 3 — Pertenencia, licencias y prevención de compartición de cuentas: auditoría y diseño

Fecha: 2026-11-18. Rama `feat/onboarding-v2`. Alcance: SOLO lectura del repo y de la base local (SELECT), más lectura de documentación oficial pública (Supabase y texto de la Ley 1581). No se tocó código, migraciones ni base; no se consultó producción ni Vercel; no se imprimió ningún secreto.

Convenciones: **VERIFICADO** = visto en código/base local o en documentación oficial citada con URL. **NO VERIFICADO** = inferido o no comprobable aquí. **PROPUESTA** = valor o diseño recomendado, NO es una decisión del usuario.

---

## 0. Resumen ejecutivo

1. **El vínculo único ya existe y es sólido a nivel de base** (índice `vinculo_staff_unico_activo`, `002_core_tables.sql:140`; verificado en la base local). Es la única garantía de la Fase 3 que ya está cubierta de verdad.
2. **Las invitaciones NO son «de un solo uso» en la base actual.** `crear_invitacion_staff` (152:189) hace `on conflict (negocio_id,email) do update set estado='PENDIENTE', expira_at=now()+7 días, respondida_at=null`: una invitación ACEPTADA, RECHAZADA o EXPIRADA se **resucita con el mismo `id`**. El `id` del enlace es el único identificador (no hay token aparte) y la expiración de 7 días está escrita en código (no configurable).
3. **El destinatario se verifica solo por correo** (`aceptar_invitacion_staff`: correo del `auth.users` = correo de la invitación y `email_confirmed_at` no nulo). No hay verificación por teléfono (el `telefono_verificado` existe pero hoy ningún flujo lo pone en `true`).
4. **La invitación no está ligada a una licencia/lote**: solo se revisa capacidad agregada (`_capacidad_profesional`) al crear y al aceptar. Aceptable para Fase 1; insuficiente para el requisito 6 (licencia asociada a un profesional concreto).
5. **No existe nada de dispositivos ni geocerca.** Solo hay precedentes reutilizables: cookie httpOnly de dispositivo + HMAC de IP/equipo (migración 135, solo para la prueba gratuita) y `latitud/longitud` en `sede` (1 de 6 sedes locales tiene coordenadas).
6. **`session_version` es una señal, no un control**: nadie la verifica (ni proxy, ni JWT). Fase 1 ya lo dijo; aquí se propone cómo exigirla sin romper GoTrue.
7. **Supabase Auth no ofrece «una sesión operativa por profesional» con control fino**: la opción «Single session per user» es global al proyecto y requiere plan Pro o superior (VERIFICADO, doc). Se propone imponer la regla en la aplicación con una tabla de sesiones operativas + comprobación en el proxy/RPC + `auth.admin.signOut`.
8. **Recomendación**: implementar en orden 180→189 (sección 7), empezando por lo que cierra huecos reales sin tocar el login (invitaciones de un solo uso, configuración, auditoría de seguridad), luego dispositivos, luego geocerca y señales en modo «solo observar» durante 30 días antes de activar respuestas automáticas.
9. Lo que depende de acciones externas (política de tratamiento de datos, aviso, revisión legal, plan de Supabase) está en la sección 8.2.

---

## 1. Diagnóstico del modelo actual (qué cubre cada requisito)

### 1.1 Identidad, perfil, staff, vínculo (VERIFICADO en la base local)

| Objeto | Hecho | Fuente |
|---|---|---|
| `perfil` (PK = `auth.users.id`) | `session_version int default 1`, `telefono`, `telefono_verificado bool`, `pais`, `es_supersu` (índice único: un solo SuperSU) | `\d perfil` local; 081, 128 |
| `staff` | PK `usuario_id` = `auth.users.id`: **una identidad = una fila de staff**; `staff_upsert_propio` deja crear la propia fila | `\d staff` |
| `vinculo_staff_negocio` | `vinculo_staff_unico_activo UNIQUE (staff_id) WHERE estado <> 'RETIRADO'`; estados `INVITADO/ACTIVO/SUSPENDIDO/RETIRADO`; `es_admin`, `presta_servicios`, `es_guardian`, `sede_activa_id`; reingreso reutiliza la misma fila (conserva historial) | `\d`; 002:140; 015 `responder_invitacion` |
| `invitacion_staff` | `id` uuid, `negocio_id`, `email`, `estado`, `expira_at default now()+7d`, `rol_invitado`, `sede_id`, `reenvios_count`, UNIQUE `(negocio_id,email)` | `\d invitacion_staff` |
| `sede` | `latitud`, `longitud` double precision NULL, `zona_horaria`; ciudad/país validados en servidor al guardar (`formulario-sede.tsx`) | `\d sede`; `src/components/negocio/formulario-sede.tsx:141,195` |

**ADL-009 (vínculo único)**: la Biblia lo fija en `StylerNow_Project_Bible_V3/03-Business-Rules/01_Roles.md:15` («Todo Staff pertenece a una única Barbería»). Está implementado en tres capas: índice parcial único, comprobación legible en `responder_invitacion` (`YA_TIENE_VINCULO_ACTIVO`, 015) y en `_activar_perfil_propietario` (153:82). **Cubre requisito 1 (UNA vinculación activa) y «sin cuentas duplicadas» solo a nivel de `auth.users`**: no hay unicidad de teléfono verificado ni de documento entre cuentas (índices de `perfil`: solo `pkey` y `ux_perfil_supersu_unico`). Dos correos distintos para la misma persona producen dos identidades sin que la base lo vea.

### 1.2 Invitaciones (015, 149, 152, 154 y funciones vivas en la base local)

Flujo vigente (leído de `pg_get_functiondef` en la base local):
- `crear_invitacion_staff(negocio, email, sede, comisión, rol)`: autoriza propietario (cualquier rol) o administrador (solo BARBER); bloquea cupo con `_cupo_bloquear` y calcula `_capacidad_profesional(negocio,null,0,email)`; **lanza `PLAN_LIMIT_EXCEEDED` si `disponibles < 1`**; inserta con `on conflict … do update` (resucita). Audita `STAFF_INVITADO`.
- `aceptar_invitacion_staff(id, autoriza_tratamiento)` (vive en 145–148 de otra rama; en la base local existe; **no está en las migraciones de esta rama**): exige sesión, `lower(auth.users.email) = i.email`, `email_confirmed_at` no nulo, casilla de tratamiento; fija una marca de transacción y llama `responder_invitacion(id,true)`; registra evidencia legal.
- `responder_invitacion`: comprueba correo en `perfil` (no en `auth.users`), `estado='PENDIENTE'`, vencimiento, `YA_TIENE_VINCULO_ACTIVO`, cupo central, crea o reactiva el vínculo, marca `ACEPTADA`, audita `STAFF_VINCULADO`. Grants: `authenticated` y `service_role` (la guarda `USA_ACEPTAR_INVITACION_STAFF` impide aceptar sin pasar por la función externa).
- RLS: `invitacion_staff_insert_negocio` permite INSERT directo al propietario (con `invitado_por = auth.uid()`); el trigger `trg_invitacion_cupo` topa el cupo pero **no** valida rol de plan, destinatario ni un solo uso.
- Pantalla `/invitacion/[id]` y `src/app/invitacion/[id]/actions.ts`: el enlace lleva el `id` de la fila; aceptar exige sesión y mismo correo.

Cobertura vs requisito 2:

| Requisito | Estado | Evidencia |
|---|---|---|
| Individual | PARCIAL: una por (negocio,email) | UNIQUE `(negocio_id,email)` |
| Un solo uso | **NO**: la fila se resucita con el mismo `id` | 152:189 |
| Vencimiento configurable | **NO**: 7 días fijos en código | `expira_at` default y 152:189 |
| Ligada a negocio y rol | SÍ | columnas |
| Ligada a cupo/licencia | **NO** (solo conteo agregado) | `_capacidad_profesional` |
| Verificar correo antes de aceptar | SÍ (`email_confirmed_at`) | `aceptar_invitacion_staff` |
| Verificar teléfono | **NO** | sin flujo que ponga `telefono_verificado=true` |
| No aceptable por otro destinatario | SÍ por correo; el `id` por sí solo no basta | misma función |
| Aceptada no reutilizable | **NO** (ver «resucita») | 152:189 |
| Sin invitación si no hay cupo pagado, disponible y activo | SÍ en base (Fase 1) y con adicionales cuando cierre Fase 2 | 152 |
| Propietario no invita más que los cupos | SÍ (función + trigger de respaldo; concurrencia probada en Fase 1) | `roles_151_concurrencia.sh` |
| Nada depende del frontend | SÍ en cupo; **NO** en el insert directo permitido por RLS (el propietario puede crear/actualizar filas sin pasar por la RPC; solo el trigger de cupo lo frena) | política `invitacion_staff_insert_negocio` |

Hueco adicional (por lectura de política, NO probado con escritura porque esta tarea es de solo lectura): `vinculo_write_barberia` es `FOR ALL` para el propietario. Un propietario podría insertar un vínculo para cualquier `staff_id` existente que no tenga vínculo activo (p. ej. un RETIRADO de otro negocio) **sin invitación ni consentimiento** del profesional; solo lo frenan el índice único y el trigger de cupo. Hay que cerrarlo (ver 4.3).

### 1.3 Sesiones, `session_version`, `invalidar_sesion_usuario`

- `082_incrementar_session_version.sql`: función interna, grant solo `service_role`. La usan `src/app/login/actions.ts:333` (recuperar contraseña; además hace `signOut({scope:"global"})`) y `:365` (cambiar contraseña voluntario, **sin** cerrar las demás sesiones).
- `083`/`155`: suspender, trasladar, retirar, promover/revocar Guardian y cambiar rol llaman `invalidar_sesion_usuario(usuario, negocio, motivo)` (155; autoriza propietario/administrador/SuperSU; audita `SESION_INVALIDADA`). El trigger `perfil_proteger_columnas_sensibles` conserva la regla y una excepción de dos factores (marca de transacción + `current_user` no cliente).
- **Ningún consumidor verifica `session_version`**: `src/proxy.ts` llama a `updateSession` → `supabase.auth.getUser()` (`src/lib/supabase/middleware.ts`) y solo decide público/protegido y registro pendiente; no lee `perfil`. `resolver-contexto.ts` resuelve rol/permisos desde la base en cada solicitud: los **permisos** cambian al instante, pero **la sesión de GoTrue de la persona suspendida sigue viva** (puede navegar rutas de cliente, ver su perfil, etc.).
- `config.toml` local: `jwt_expiry=3600`, rotación de refresh token activa, `refresh_token_reuse_interval=10`; `[auth.sessions]` (timebox/inactividad) y MFA están comentados/desactivados. NO VERIFICADO qué hay configurado en el proyecto remoto (no se consultó producción).
- Base local: `auth.sessions` tiene `user_id`, `ip`, `user_agent`, `not_after`, `refreshed_at`, `aal`, `tag`; `auth.refresh_tokens` tiene `session_id`, `revoked`. 101 sesiones en la base local. Es esquema interno de GoTrue: **no debe consultarse desde el cliente ni acoplar la lógica a él** (puede cambiar entre versiones); se lee solo desde funciones definer/servidor y como complemento.

### 1.4 Auditoría y privacidad

- `evento_auditoria` (123): inmutable (triggers `trg_fila_inmutable` en UPDATE/DELETE/TRUNCATE), `actor_tipo` CHECK (`CLIENTE,STAFF,GUARDIAN,BARBERIA,SUPERSU,SISTEMA`), `origen` CHECK (`PANEL,API,SISTEMA,SQL`), `request_id`, `motivo`; RLS: actor ve lo suyo, propietario lo de su negocio, SuperSU todo. **El saneador `_auditoria_limpiar` elimina recursivamente cualquier clave con segmento `hash`, `token`, `secret`, `key`, `otp`, etc.** → un `ip_hash` o `ua_hash` dentro de `payload_*` se borraría silenciosamente. Consecuencia de diseño: la evidencia de dispositivo/IP va en tablas propias (sección 4), y `evento_auditoria` lleva solo referencias (id de evento, tipo, decisión).
- `consentimiento_evento` (121): inmutable, FK a `perfil`, **propósitos cerrados por CHECK** (`analitica, personalizacion, ofertas_cercanas, beneficios_marcas, marketing_email, marketing_whatsapp`): hay que ampliar el CHECK para propósitos de seguridad (ver 4.9). `aceptacion_legal` (`src/lib/auth/aceptacion-legal.ts`) es el patrón de versión de texto.
- `intento_auth` + `verificar_rate_limit_auth`/`registrar_intento_auth` (081): rate limit por correo y tipo (`otp_envio, otp_verificacion, password_login, password_recovery`), solo `service_role`. `limite_tasa_evento` + `consumir_cupo` (`src/lib/rate-limit.ts`): ventana deslizante genérica; **fail-open** si la RPC falla (`rate-limit.ts:29-31`).
- `src/lib/rate-limit.ts:13-16` `ipDelLlamador()` toma el primer valor de `x-forwarded-for`. Si el proveedor no lo reescribe, es manipulable por el cliente. NO VERIFICADO el comportamiento exacto en Vercel (no consultado); para decisiones de seguridad hay que usar la cabecera que fija la plataforma y tratarla solo como señal.

### 1.5 Precedentes reutilizables (no crear sistema paralelo)

- **Dispositivo (135 + `src/lib/prueba/huella-dispositivo.ts` + `src/app/panel/suscripcion/prueba.ts:122-151`)**: id en `localStorage`, cookie httpOnly de 2 años fijada por el servidor, `ip_hash` = HMAC(IP), `equipo_hash` = HMAC(rasgos). Documentado en 135: «no se bloquea por IP sola: en Colombia muchos usuarios comparten IP del operador / CGNAT». **Es el patrón a reutilizar** (misma función de HMAC y misma política de nunca guardar IP en claro como identificador).
- **Geolocalización en navegador**: `aviso-distancia.tsx` (consulta `navigator.permissions` antes de pedir; solo cliente, distancia con haversine, no se envía al servidor) y `formulario-sede.tsx` (captura coordenadas de la sede con `getCurrentPosition`, timeout 10 s, y validación en servidor país/ciudad). Hay también tests `tests/geo-coherencia.test.ts`.
- **Configuración centralizada por SuperSU**: `configuracion_plataforma` (fila única, 26 columnas, p. ej. `prueba_dias`, `suscripcion_gracia_dias`), `plan` (columnas por plan, 149/153) y `/admin/planes`, `/admin/reglas` con RPC `admin_*` (motivo ≥10, auditoría antes/después, SuperSU solo). Patrón a reutilizar para el punto 7.
- **Cupo y lock**: `_capacidad_profesional`, `_cupo_bloquear` (advisory lock por negocio).
- **Suspender**: `suspender_staff` ya cambia el vínculo a SUSPENDIDO, **sigue ocupando cupo** y llama a `invalidar_sesion_usuario`.

---

## 2. Brechas por requisito

| # | Requisito | Cubierto hoy | Brecha principal |
|---|---|---|---|
| 1 | Vínculo único; cupo del negocio que lo compró; licencia no transferible; sin cambio por sí solo; sin duplicados | Vínculo único (índice), desvinculación por RPC del negocio, reingreso reutiliza fila | No hay licencia individual (solo conteo); un profesional sin invitación nueva puede quedar «re-vinculado» por el insert directo del propietario; no hay política de «enfriamiento» entre negocios; duplicados por correo/teléfono no detectados |
| 2 | Invitaciones seguras | Negocio, rol, correo verificado, no aceptable por otro correo, cupo | Un solo uso (resucita), vencimiento fijo, sin teléfono, sin ligar a licencia, insert directo permitido, `id` de fila como único secreto |
| 3 | Dispositivos y sesiones | `session_version` (señal), rate-limit de login | **Todo**: tabla de dispositivos, límite 1+1, una sesión operativa, reautenticación, revocación, registro de IP/UA/fecha |
| 4 | Geográfica | Coordenadas de sede (opcionales), captura en navegador | Sin radio, sin captura de GPS operativa, sin verificación alternativa, sin resultado de presencia, sin aviso legal/propósito |
| 5 | Compartición/reventa | Antiabuso de prueba (135), auditoría inmutable | Sin señales, sin umbrales, sin respuestas progresivas, sin historial de decisión |
| 6 | Licencias adicionales | Diseño de Fase 2 (lotes, estados, suspendido ocupa cupo) | Falta el nivel «asiento» (licencia ↔ profesional ↔ negocio), ligado a invitación y vínculo; no mover entre negocios por API |
| 7 | CRM SuperAdmin | Patrón `configuracion_plataforma` + RPC con motivo | Sin parámetros de seguridad, sin excepciones con vigencia |
| 8 | Seguridad/privacidad | Auditoría con saneado de secretos, RLS | Sin finalidad documentada de IP/dispositivo/ubicación, sin aviso/consentimiento específico, sin retención definida |
| 9 | Pruebas | Suites SQL + HTTP de Fase 1 como patrón | Las 14 pruebas del punto 9 (sección 7.2) |
| 10 | Condición | — | Ver sección 5 |

---

## 3. Qué soporta realmente Supabase Auth (GoTrue) y cómo imponer «una sesión operativa»

Fuentes oficiales consultadas hoy: `https://supabase.com/docs/guides/auth/sessions`, `https://supabase.com/docs/guides/auth/auth-mfa`, `https://supabase.com/docs/reference/javascript/auth-signout`, `https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook`.

| Afirmación | Estado | Fuente / nota |
|---|---|---|
| Una sesión nace al iniciar sesión; por defecto dura indefinidamente y puede haber muchas en varios dispositivos | VERIFICADO | sessions |
| Access token (JWT) de vida corta + refresh token de un solo uso con rotación; reutilización fuera de la ventana (10 s por defecto) revoca la sesión | VERIFICADO | sessions. Protege contra robo del refresh token, **no** contra el robo del dispositivo (lo dice la doc) |
| «Single session per user» (solo la más reciente) | VERIFICADO que existe; requiere plan **Pro o superior**; es **global al proyecto**, no por rol ni por «sesión operativa» | sessions. Para staff operativo no sirve tal cual (también afectaría a clientes y propietarios) |
| Timebox e inactivity timeout | VERIFICADO; plan Pro o superior; se aplican en el siguiente refresco, no cierran al instante | sessions; local en `config.toml [auth.sessions]` |
| `signOut` scope `global` (todas), `local` (actual), `others` (las demás) | VERIFICADO | auth-signout. Son llamadas hechas **con la sesión del propio usuario** |
| Revocar sesiones de OTRO usuario desde el servidor | **NO VERIFICADO con URL**: la doc de `signOut` menciona `auth.api.signOut(JWT)` (necesita el JWT del usuario), pero no pude confirmar un método de administración «por user_id». Alternativa disponible y verificada en la base local: `auth.sessions`/`auth.refresh_tokens` con `session_id`, que una función `security definer` puede borrar (esquema interno; probar contra la versión de GoTrue en uso antes de depender de ello) | auth-signout; `\d auth.sessions` local |
| El access token JWT **no se puede revocar** antes de expirar | VERIFICADO | auth-signout y sessions. Con `jwt_expiry=3600` (local) una sesión revocada puede seguir sirviendo hasta 1 h salvo que el servidor compruebe la sesión |
| Para acciones muy sensibles, comprobar que el claim `session_id` del JWT exista en `auth.sessions` | VERIFICADO (recomendación de la doc de sesiones) | sessions |
| Custom Access Token Hook: se ejecuta antes de emitir cada token (incluye `token_refresh`), puede añadir claims y puede **rechazar la emisión** con error 403 | VERIFICADO | hook. Claims obligatorios incluyen `session_id` (no quitarlo) |
| MFA: TOTP y teléfono; `aal1`/`aal2` en el JWT; claim `amr` con método y marca de tiempo (sirve para exigir «login reciente») | VERIFICADO | auth-mfa. La doc no describe un endpoint de «reautenticación» genérico |
| Límites de plan de MFA | NO VERIFICADO | la página no los menciona |

### 3.1 Cómo imponer «una sesión operativa» con lo que existe

Principio: **GoTrue sigue siendo el único mecanismo de autenticación**; no se crea un sistema paralelo. La regla «una sesión operativa por profesional» es una regla de **autorización de la aplicación** sobre el rol operativo, no sobre la identidad.

1. **Registro de sesión operativa** (tabla `sesion_operativa`, 4.2): al entrar a rutas/acciones operativas de staff (`/staff/**`, `/panel/**` con `presta_servicios`) el servidor toma `session_id` del JWT (claim verificado con `getClaims`/`getUser`; el claim lo firma GoTrue) y lo registra con dispositivo, IP (HMAC + versión truncada), UA y `ultimo_uso`. Si ya hay otra sesión operativa **activa** (último uso < umbral configurable), se aplica la política configurada: `REEMPLAZAR` (la nueva gana y se revoca la anterior; **PROPUESTA por defecto**, porque la víctima de un robo recupera control al volver a entrar) o `BLOQUEAR_NUEVA`.
2. **Comprobación en el servidor, no en el JWT**: una función `sesion_operativa_valida(session_id)` (definer) que el proxy/`resolverContexto` llama **solo en rutas operativas** (no en cada recurso estático ni en `/api/webhooks`). Coste: una consulta indexada por solicitud operativa. Si la sesión fue revocada, se llama `signOut` en el servidor para esa sesión y se redirige a login. Esto cierra la brecha de «JWT vivo hasta 1 h» **para lo operativo**; para el resto de la app, el JWT sigue su vida normal (decisión de producto: el riesgo es operar a nombre del negocio, no navegar como cliente).
3. **Revocación efectiva**: (a) marcar la fila `REVOCADA` (efecto inmediato en lo operativo por el punto 2); (b) borrar la sesión en GoTrue desde una función servidor con service_role (NO VERIFICADO el método admin exacto; fallback: borrar filas de `auth.sessions` por `session_id` dentro de una función definer, probado en local) para que el refresh token deje de funcionar.
4. **`session_version`** se usa como segundo factor de invalidación **masiva** (cambio de contraseña, suspensión, retiro): se copia a la fila de `sesion_operativa` al registrarse (`sv_al_registrar`); si `perfil.session_version > sv_al_registrar` la sesión operativa es inválida. Así deja de ser «solo una señal». No se pone en el JWT (evitar hook obligatorio en login en esta fase); sí se evalúa **Custom Access Token Hook** como mejora opcional (rechazar refresco si la sesión está revocada) — queda como decisión abierta porque toca el camino de login de todos los usuarios (requisito 10: no romper la autenticación).
5. **Reautenticación para registrar otro dispositivo**: exigir contraseña actual (patrón ya existente en `cambiarContrasena`, `login/actions.ts`: `signInWithPassword` con la contraseña actual) **más** un código de un solo uso enviado al correo o al teléfono verificado. Si MFA TOTP se habilita en el proyecto, el claim `amr`/`aal` sirve para comprobar «segundo factor reciente»; no se asume que esté habilitado.
6. **Cookie de dispositivo** (patrón 135): httpOnly, firmada, 2 años, se vincula a `dispositivo.id`. **Nunca autentica**: sin sesión GoTrue válida no sirve de nada; es solo una pista para distinguir «mismo equipo» de «equipo nuevo».
7. **No se activa «Single session per user» de Supabase** (global; afectaría a clientes y propietarios; requiere Pro). Queda anotado como alternativa si el usuario prefiere simplicidad a precisión.

---

## 4. Modelo de datos propuesto (todo PROPUESTA hasta que el usuario apruebe)

Reglas transversales (patrón del repo y memorias del proyecto): toda tabla con RLS activada y **sin** políticas de escritura para `authenticated` (todo por RPC definer); funciones `security definer set search_path = public`, validación de autorización DENTRO con `coalesce(...,false)`, y `revoke all … from public, anon, authenticated` (los tres roles) seguido del grant mínimo; si cambia una firma, `drop function` explícito de la anterior; vistas con `security_invoker=true`; **nunca registrar-y-lanzar en la misma transacción** (los intentos rechazados se registran con una llamada servidor separada, patrón de `registrar_intento_auth`); verificación posterior con `aclexplode`.

### 4.1 Licencia por profesional («asiento»)

Fase 2 define **lotes** (cantidad). Fase 3 necesita **asignación nominal** sin duplicar el cobro:

**`licencia_asiento`** (una fila por cupo ocupado que proviene de un lote adicional, y opcionalmente por cupo incluido en el plan):
`id`, `negocio_id` (NOT NULL, inmutable), `origen` (`PLAN_INCLUIDO|ADICIONAL_LOTE`), `contrato_id` (FK a `adicional_barbero_contrato`, NULL si `PLAN_INCLUIDO`), `vinculo_id` (FK única parcial, NULL = asiento libre), `estado` (`LIBRE|RESERVADO|ASIGNADO|SUSPENDIDO|LIBERADO`), `invitacion_id` (reserva mientras hay invitación vigente), `asignado_at`, `liberado_at`, `motivo_liberacion`, `created_at`.
- Restricciones: `UNIQUE (vinculo_id) WHERE estado IN ('ASIGNADO','SUSPENDIDO')` (**una licencia ↔ un profesional**, y un profesional no ocupa dos asientos); trigger BEFORE UPDATE que **rechaza cambiar `negocio_id`** (no mover entre negocios, ni por API ni por SQL de cliente); trigger que exige `vinculo.negocio_id = asiento.negocio_id`.
- `SUSPENDIDO` ocupa capacidad (regla Fase 1/2): al vencer el lote el asiento pasa a `SUSPENDIDO`, el vínculo **no se borra**, citas/historial/evidencias intactos; la reactivación del pago devuelve el asiento a `ASIGNADO` mediante la transición de Fase 2 (`_adicional_transicionar`), no por escritura directa.
- **Decisión de compatibilidad**: la función central `_capacidad_profesional` sigue siendo la **única** fuente del conteo agregado (no se reemplaza). `licencia_asiento` es una capa nominal encima, que se **concilia** con ella: una comprobación (`licencia_conciliar(negocio)`) cuenta asientos ocupados vs. ocupados de la función central y registra discrepancias en `evento_auditoria` (no corrige en silencio).
- Para no bloquear Fase 2, la creación de asientos es **perezosa**: se generan al activarse un lote (hook en `_adicional_transicionar`, migración posterior a que Fase 2 cierre) y para el plan incluido se crean al asignar. Hasta entonces el control sigue siendo el agregado (comportamiento actual).

### 4.2 Dispositivos y sesiones operativas

**`dispositivo_usuario`**: `id`, `usuario_id` (FK `perfil`), `negocio_id` (NULL para clientes; se fija al vincularse como staff), `rol_dispositivo` (`PRINCIPAL|SECUNDARIO`), `estado` (`PENDIENTE_VERIFICACION|ACTIVO|REVOCADO|BLOQUEADO`), `cookie_hash` (HMAC de la cookie de dispositivo; **no** la cookie), `equipo_hash` (HMAC de rasgos, patrón 135), `etiqueta` (nombre que el usuario le pone, ≤40), `ua_resumen` (navegador + SO en texto corto, derivado), `primer_uso_at`, `ultimo_uso_at`, `verificado_at`, `verificado_por` (`CORREO|TELEFONO|SUPERSU`), `revocado_at`, `revocado_por`, `motivo_revocacion`, `creado_por_sesion` (session_id).
- Índices: `UNIQUE (usuario_id, cookie_hash) WHERE estado IN ('PENDIENTE_VERIFICACION','ACTIVO')`; `UNIQUE (usuario_id) WHERE rol_dispositivo='PRINCIPAL' AND estado='ACTIVO'`; `(usuario_id, estado)`.
- Límite de dispositivos activos por usuario: **no** en CHECK sino en la RPC de alta, leyendo `seguridad_config` (4.6) bajo `pg_advisory_xact_lock(usuario)` (misma técnica que `_cupo_bloquear`) + trigger de respaldo.

**`sesion_operativa`**: `id`, `usuario_id`, `negocio_id`, `session_id` (uuid de GoTrue; UNIQUE), `dispositivo_id`, `estado` (`ACTIVA|REEMPLAZADA|REVOCADA|EXPIRADA`), `sv_al_registrar int`, `ip_hash`, `ip_prefijo` (/24 IPv4 o /48 IPv6, para detectar mismo proveedor sin guardar la IP completa), `asn_o_proveedor` (NULL; solo si el usuario aprueba usar un servicio de geolocalización por IP, NO VERIFICADO/fuera de alcance), `ua_resumen`, `inicio_at`, `ultimo_uso_at`, `fin_at`, `motivo_fin`.
- `UNIQUE (usuario_id) WHERE estado='ACTIVA'` → **una sesión operativa simultánea por profesional garantizada por esquema**; el valor «1» sale de `seguridad_config.sesiones_operativas_max` y, si el SuperAdmin lo sube, la restricción se sustituye por la comprobación en RPC (ver riesgo R-11: el índice parcial único solo sirve para el valor 1; para N>1 se usa trigger con conteo bajo lock).
- No se almacena contraseña, refresh token, access token ni cookie en claro (la columna `session_id` es un identificador, no una credencial).

**`evento_seguridad`** (append-only, inmutable con `trg_fila_inmutable`; **no** usa `evento_auditoria` para la evidencia técnica porque el saneador borraría hashes): `id bigint identity`, `usuario_id`, `negocio_id`, `tipo` (catálogo cerrado: `DISPOSITIVO_NUEVO_SOLICITADO`, `DISPOSITIVO_ACTIVADO`, `DISPOSITIVO_REVOCADO`, `SESION_REEMPLAZADA`, `SESION_REVOCADA`, `REAUTENTICACION_OK`, `REAUTENTICACION_FALLIDA`, `GPS_CAPTURADO`, `GPS_DENEGADO`, `GPS_FUERA_DE_RADIO`, `INVITACION_REUSO_INTENTADO`, `INVITACION_DESTINATARIO_INCORRECTO`, `CAMBIO_IP`, `CAMBIO_UA`, `SENAL_ANOMALIA`, `DECISION_RIESGO`, `EXCEPCION_CREADA`, …), `gravedad` (`INFO|BAJA|MEDIA|ALTA`), `dispositivo_id`, `sesion_id`, `ip_hash`, `ip_prefijo`, `ua_resumen`, `detalle jsonb` (lista blanca de claves; sin tokens/contraseñas), `request_id`, `created_at`.
- RLS: SELECT para el propio usuario (sus eventos), SuperSU (todos) y propietario **solo de su negocio y solo columnas no técnicas** (vista `security_invoker` sin `ip_hash`/`ip_prefijo`); sin escritura de cliente. Índices `(usuario_id, created_at desc)`, `(negocio_id, tipo, created_at desc)`, `(tipo, created_at)` para retención.
- Retención: `seguridad_config.retencion_evento_dias` (PROPUESTA 180 d para INFO/BAJA, 12 meses para MEDIA/ALTA y decisiones) con job de purga que **no** borra filas referenciadas por una decisión de riesgo abierta; la purga no puede ser por `DELETE` normal (el trigger inmutable la bloquea): se usa función definer con marca de transacción (patrón 155) y queda un registro de agregado en `evento_auditoria` («purgados N eventos tipo X»).

### 4.3 Invitaciones seguras (rediseño sin romper 015/152)

Cambios sobre `invitacion_staff` (aditivos; NO se crea tabla paralela):
- Columnas: `token_hash text` (HMAC-SHA256 del secreto de un solo uso; el secreto viaja solo en el enlace y **no** se guarda), `canal_destino` (`EMAIL|TELEFONO`), `telefono_destino text` (E.164, NULL si es por correo), `asiento_id uuid` (reserva de licencia), `usada_at`, `usada_por uuid`, `intentos_fallidos int default 0`, `bloqueada_hasta`, `generacion int default 1`, `expira_at` (sigue; ahora lo fija la RPC desde `seguridad_config.invitacion_vigencia_horas`).
- **Un solo uso real**: reinvitar al mismo correo **crea una fila nueva** y marca la anterior `REEMPLAZADA` (nuevo valor de `invitacion_staff_estado`, requiere migración de enum aparte; `alter type … add value` no puede usarse en la misma transacción) en lugar de `on conflict do update`. Se reemplaza `UNIQUE (negocio_id,email)` por `UNIQUE (negocio_id, email) WHERE estado='PENDIENTE'`. Las filas históricas **no** se borran ni se reescriben.
- La aceptación toma el secreto, calcula el HMAC y busca por `token_hash` (comparación en tiempo constante); transiciona `PENDIENTE→ACEPTADA` con `update … where id=… and estado='PENDIENTE' returning` (condición atómica: dos aceptaciones simultáneas → solo una gana).
- **Verificación del destinatario**: (1) la sesión debe corresponder al correo de la invitación **con `email_confirmed_at`** (ya existe) **o** (2) si `canal_destino='TELEFONO'`, a un teléfono verificado por código de un solo uso (OTP de Supabase Auth por SMS o el flujo de verificación por WhatsApp previsto en 128; NO VERIFICADO cuál estará disponible: hoy `telefono_verificado` no lo pone nadie). El enlace solo es **necesario**, nunca **suficiente**.
- **Cierre del insert directo**: eliminar `invitacion_staff_insert_negocio` y `vinculo_write_barberia` FOR ALL; reemplazar por SELECT + RPC. Antes de quitarlas, inventariar los llamadores (`grep` de `.from("invitacion_staff")` / `.from("vinculo_staff_negocio")` con `insert/update/delete` en `src/`) — NO hecho aquí; es tarea de la migración 183.
- **Sin cupo, sin invitación**: la RPC reserva un asiento (`RESERVADO`) bajo `_cupo_bloquear`; si no hay asiento libre con lote ACTIVO/vigente → `PLAN_LIMIT_EXCEEDED`. Vencer/cancelar/rechazar libera la reserva (job + transición).
- **Aceptación** (`aceptar_invitacion_segura`, definer, `authenticated`): sesión; `auth.uid()` y no un parámetro; fila `for update`; `estado='PENDIENTE'` y `expira_at>now()`; destinatario; `YA_TIENE_VINCULO_ACTIVO`; **enfriamiento** entre negocios (4.5); casilla de tratamiento (reusa `autorizar_staff`); asiento `RESERVADO→ASIGNADO` ligado al vínculo; marca `usada_at/usada_por`; invalida invitaciones pendientes del mismo correo en otros negocios (**PROPUESTA**: no, solo informar; evita que alguien cancele invitaciones ajenas — decisión abierta); crea la sesión operativa/dispositivo principal con la reautenticación recién hecha.
- **Fuerza bruta/repetición**: `intentos_fallidos` + `bloqueada_hasta` por invitación; `consumir_cupo` por IP y por `usuario` (fail-**closed** para esta ruta: si el limitador falla, se rechaza, a diferencia del `fail-open` actual de `rate-limit.ts:29-31`); los intentos rechazados se registran en `evento_seguridad` por llamada servidor separada (no se pierden por rollback).
- Compatibilidad: `aceptar_invitacion_staff` (de 145–148) y `responder_invitacion` se mantienen durante la transición y delegan; el enlace antiguo `/invitacion/[id]` sigue funcionando hasta `expira_at` de las invitaciones ya enviadas (migración de datos: `token_hash` NULL = invitación heredada, aceptable una vez, con vigencia máxima 7 d).

### 4.4 Geocerca

**`sede`**: añadir (aditivo) `geocerca_radio_m int NULL` (NULL = usa el valor global; CHECK 20..2000), `coordenadas_verificadas_at`, `coordenadas_origen` (`DIRECCION|PIN_MANUAL|GPS_PROPIETARIO`). Múltiples sedes ya soportadas (una fila por sede). Las sedes sin coordenadas **no** pueden exigir presencia: la política cae a verificación alternativa (4.7).

**`verificacion_presencia`** (append-only): `id`, `usuario_id`, `negocio_id`, `sede_id` (la sede declarada/autorizada), `motivo` (`REGISTRO_DISPOSITIVO|SESION_SOSPECHOSA|ACCION_PRESENCIAL|CAMBIO_SEDE`), `resultado` (`DENTRO|FUERA|SIN_GPS|DENEGADO|NO_EVALUADO|VERIFICACION_ALTERNATIVA_OK|VERIFICACION_ALTERNATIVA_PENDIENTE`), `distancia_m` int (redondeada a múltiplos de 10), `precision_m` int, `lat_aprox`/`lng_aprox` **NO se guardan** (PROPUESTA de minimización: solo se guarda distancia y precisión, no la posición del profesional), `sede_evaluada_id`, `radio_aplicado_m`, `evento_seguridad_id`, `created_at`.
- **Cómo se calcula**: el navegador obtiene la posición **una sola vez** por evento (nunca `watchPosition`), la envía a una Server Action que llama a la RPC `presencia_evaluar(sede_id, lat, lng, precision_m, motivo)`; la RPC calcula la distancia con haversine **en la base** contra la sede (no confía en que el cliente diga «estoy dentro»), guarda el resultado y descarta lat/lng. Se rechaza `precision_m` mayor que el umbral configurable (`precision_max_m`, PROPUESTA 100) tratándolo como `SIN_GPS` con verificación alternativa.
- **«Posible suplantación»**: es una señal, no una prueba. Indicios (todos configurables, sin certeza): `precision_m = 0` exacta repetida, coordenadas idénticas a la sede al metro en eventos distintos, salto de ubicación incompatible con la velocidad máxima física entre dos eventos, GPS «dentro» + IP/zona horaria/idioma incompatibles. La interfaz **nunca** dice «ubicación falsa»; dice «no pudimos confirmar tu presencia, usa la verificación alternativa». El SuperAdmin ve el indicio como «posible», no como «confirmado».
- **Eventos con GPS (lista cerrada)**: (1) registrar un dispositivo nuevo; (2) resolver una sesión marcada sospechosa; (3) acciones configuradas como presenciales (PROPUESTA: iniciar turno / cerrar caja / cobro en efectivo mayor a un umbral) — la lista vive en `seguridad_config.acciones_presenciales text[]`; (4) cambio de sede de trabajo. **Sin** consulta periódica ni en segundo plano; el permiso se solicita en el momento y el rechazo nunca bloquea por sí solo.

### 4.5 Reglas de cambio de negocio (requisito 1 y 5)

- El usuario **no** puede cambiar de negocio por sí solo: no existe RPC de «cambiar». Flujo único: el negocio actual retira (`retirar_staff`, 155) → vínculo `RETIRADO` → recién entonces `aceptar_invitacion_segura` de otro negocio es posible (el índice ya lo exige).
- **Enfriamiento** `seguridad_config.enfriamiento_cambio_negocio_dias` (PROPUESTA 0 = solo registrar; recomendado subir a 7 solo si los datos locales muestran abuso): se cuenta, no se bloquea de entrada. «Cambios frecuentes» (señal S5, 5.1) = más de N vínculos distintos en M días.
- Licencias: el asiento de un negocio **nunca** se reasigna a otro negocio (trigger de `negocio_id` inmutable). Un profesional que se va libera el asiento **de su negocio** (que puede asignarlo a otra persona de ese mismo negocio): eso es lo que el usuario permite («licencia no transferible» = entre negocios y entre personas ajenas al negocio; reasignar dentro del mismo negocio es operación normal y queda auditada).
- Duplicados de cuenta: señal S6 por mismo teléfono verificado o mismo `equipo_hash` en 2+ identidades staff con vínculos en negocios distintos. No bloquea automáticamente.

### 4.6 Configuración centralizada y excepciones (requisito 7)

**`seguridad_config`** (fila única `id boolean primary key default true check (id)`, patrón `configuracion_plataforma`) con CHECKs de rango y auditoría antes/después vía `_trg_auditar_cambio`. Columnas y **valores PROPUESTA**:

| Parámetro | PROPUESTA | Rango |
|---|---|---|
| `dispositivos_max` | 2 (1 PRINCIPAL + 1 SECUNDARIO) | 1..5 |
| `sesiones_operativas_max` | 1 | 1..3 |
| `politica_sesion_nueva` | `REEMPLAZAR` | `REEMPLAZAR|BLOQUEAR_NUEVA` |
| `sesion_operativa_inactividad_min` | 30 | 5..1440 |
| `invitacion_vigencia_horas` | 72 | 1..720 |
| `invitacion_intentos_max` | 5 | 3..10 |
| `geocerca_radio_m` | 150 | 20..2000 |
| `precision_max_m` | 100 | 10..500 |
| `verificacion_alta_dispositivo` | `PASSWORD+CODIGO` | `CODIGO|PASSWORD+CODIGO` |
| `gps_en_alta_dispositivo` | `SOLICITAR` (no obliga) | `NO|SOLICITAR|EXIGIR_O_ALTERNATIVA` |
| `acciones_presenciales` | `{}` (vacío; se activan por decisión) | catálogo cerrado |
| `modo_motor` | `OBSERVAR` | `APAGADO|OBSERVAR|ACTIVO` |
| `umbral_*` por señal | ver 5.1 | |
| `acciones_por_nivel` | ver 5.2 | |
| `retencion_evento_dias` | 180 / 365 | 30..730 |
| `enfriamiento_cambio_negocio_dias` | 0 (solo registrar) | 0..90 |

**`seguridad_excepcion`**: `id`, `alcance` (`USUARIO|NEGOCIO|SEDE|GLOBAL`), `usuario_id/negocio_id/sede_id` según alcance, `parametro` (catálogo cerrado: `dispositivos_max`, `sesiones_operativas_max`, `geocerca_radio_m`, `exigir_gps`, `senal_ignorar`, …), `valor jsonb`, `motivo text NOT NULL (≥15 caracteres)`, `creada_por`, `creada_at`, `vigente_hasta timestamptz NOT NULL` (**sin vigencia infinita**; PROPUESTA máximo 90 días, renovable con nuevo motivo), `revocada_at`, `revocada_por`, `motivo_revocacion`. Inmutable salvo los campos de revocación (trigger). Cada alta/revocación escribe `evento_seguridad` (`EXCEPCION_CREADA/REVOCADA`) **y** `evento_auditoria` con `motivo`, `payload_antes/después` (quién, cuándo, qué cambió). Una función `_seguridad_param(usuario, negocio, sede, parametro)` resuelve el valor efectivo (excepción vigente más específica > config global) y es **la única** que leen el resto de RPC.
- RPC SuperAdmin (grant `authenticated`, primera línea `if not coalesce(public.is_supersu(), false) then raise exception 'NO_AUTORIZADO'`): `admin_seguridad_set_config(p_config jsonb, p_motivo)`, `admin_seguridad_crear_excepcion(...)`, `admin_seguridad_revocar_excepcion(id, motivo)`, `admin_seguridad_listar(...)`, `admin_seguridad_revisar_caso(caso_id, decision, motivo)`. UI: sección nueva en `/admin` (patrón `/admin/planes`), con editor y bandeja de casos. **Ningún cambio de rol `SUPER_ADMIN` por API** (136: SuperSU solo desde base; no se toca).

### 4.7 Verificación alternativa sin GPS

Si el GPS se deniega, no está disponible o es impreciso: **no se bloquea**. Alternativas (en este orden, configurable): (1) código de un solo uso al correo/teléfono verificado del profesional + (2) confirmación del propietario/administrador del negocio (botón «confirmo que está en la sede», queda en `verificacion_presencia` como `VERIFICACION_ALTERNATIVA_OK` con `actor`), (3) revisión manual de SuperSU. La **ausencia** de GPS genera como mucho una señal informativa, nunca una suspensión.

### 4.8 IP compartida / CGNAT / falsos positivos

- La IP **no es identidad**: se guarda `ip_hash` y `ip_prefijo`, nunca como único criterio. Cambios de IP dentro del mismo `ip_prefijo` o del mismo dispositivo conocido son `INFO` y **no suman puntaje**. Cambio de IP con el mismo `cookie_hash` y mismo UA: se registra y no puntúa (red móvil/CGNAT en Colombia ya documentada en 135).
- Dos profesionales del mismo negocio detrás de la misma IP (misma barbería) es **lo normal**: la señal «misma IP, usuarios distintos» solo puntúa entre negocios distintos y con umbral alto, y nunca por sí sola.
- Falsos positivos: modo `OBSERVAR` por 30 días mínimo con revisión manual de los casos antes de activar acciones automáticas; cada decisión tiene `falso_positivo` marcable por el SuperAdmin que alimenta el ajuste de umbrales; toda acción automática es reversible (alerta → reautenticación → revocar sesión; el bloqueo preventivo exige revisión humana en ≤N horas).

### 4.9 Privacidad: finalidad, aviso, consentimiento, retención

| Dato | Finalidad (PROPUESTA de redacción, a validar por abogado) | Base | Retención |
|---|---|---|---|
| IP (HMAC + prefijo) | seguridad de la cuenta y detección de uso compartido | aviso + autorización en el aceptar-invitación/alta de dispositivo | 180 d (INFO/BAJA), 12 m (casos) |
| Dispositivo (HMAC de cookie y de rasgos, UA resumido) | limitar dispositivos autorizados, revocar | ídem | mientras el dispositivo esté activo + 12 m |
| Ubicación en eventos puntuales | confirmar presencia en la sede autorizada en eventos operativos | **autorización expresa e informada**, casilla no premarcada, facultativa con alternativa | solo distancia/precisión/resultado; **no se guardan coordenadas del profesional** |
| Decisiones de riesgo | trazabilidad y defensa de derechos del profesional y del negocio | interés legítimo documentado + información | 12 m tras cierre |

- Nuevo propósito de consentimiento: ampliar el CHECK de `consentimiento_evento.proposito` con `seguridad_ubicacion_presencia` y `seguridad_dispositivo` (migración 181) y versionar el texto con el patrón de `aceptacion-legal.ts`. El aviso es **informado antes** de pedir el permiso del navegador (pantalla previa), indica finalidad, que es facultativo, la alternativa sin GPS, retención y cómo revocar (centro de privacidad existente: `consentimiento_evento.origen='centro_privacidad'`).
- Revocar el consentimiento de ubicación **no** invalida la cuenta: pasa a verificación alternativa. Revocar el de dispositivo/IP no es posible sin renunciar a operar con uso compartido controlado: se informa que es condición del servicio operativo de staff (decisión legal abierta, 8.2).
- Ley 1581 de 2012 — VERIFICADO en `https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=49981`: art. 4 (principios: finalidad legítima informada, libertad = consentimiento previo, expreso e informado, transparencia, acceso restringido, seguridad con medidas técnicas, humanas y administrativas); art. 5 (datos sensibles: los que afectan la intimidad o cuyo uso indebido puede generar discriminación; **la lista que vi menciona salud, vida sexual y biométricos; no encontré que la ubicación esté listada como sensible**: clasificación NO VERIFICADA, tratarla con cautela); art. 9 (autorización previa e informada); art. 12 (deber de informar finalidad, carácter facultativo, derechos del titular e identificación del responsable). Decreto reglamentario, contenido de la política de tratamiento, registro de bases de datos (RNBD) y transferencias internacionales (proveedores en la nube): **NO VERIFICADO**, no se cita número de artículo ni decreto; es acción legal externa. La «huella» de dispositivo con rasgos del navegador **no** es biométrica; no se capturan datos biométricos.

---

## 5. Motor de señales y respuestas progresivas

### 5.1 Señales (todas configurables en `seguridad_config`; PROPUESTA de peso y umbral; el puntaje se calcula por ventana deslizante)

| Id | Señal | Peso (PROPUESTA) | Ventana | Notas |
|---|---|---|---|---|
| S1 | Mismo usuario con sesiones/dispositivos distintos activos a la vez | 3 | 24 h | solo si hay >1 sesión operativa intentada |
| S2 | Ubicaciones incompatibles (velocidad implícita > 300 km/h entre dos presencias) | 4 | 24 h | requiere 2 eventos con GPS; con tolerancia por precisión |
| S3 | Reutilización de invitación (token usado/expirado/ajeno) | 2 por intento, 5 si es destinatario distinto | 7 d | |
| S4 | Dispositivo nuevo registrado | 1 | 30 d | |
| S5 | Cambios de barbería frecuentes (≥3 vínculos distintos) | 3 | 90 d | |
| S6 | Mismo equipo/teléfono en 2+ identidades staff de negocios distintos | 4 | 30 d | |
| S7 | Sesión concurrente que reaparece tras reemplazo | 2 | 24 h | |
| S8 | GPS fuera de radio de la sede autorizada | 2 | 24 h | **nunca** puntúa si la verificación alternativa fue OK |
| S9 | Ausencia/denegación de GPS | 0 (solo registra) | — | explícito: no puntúa |
| S10 | Cambio de IP | 0 si mismo prefijo/dispositivo; 1 si prefijo y dispositivo nuevos a la vez | 24 h | |

Reglas de higiene: una señal repetida cuenta máximo 2 veces por ventana (evita escalar por ruido); las señales de una excepción vigente (`senal_ignorar`) no puntúan; **ninguna** señal sola alcanza el nivel de bloqueo; para llegar a bloqueo preventivo deben concurrir **al menos 2 señales distintas de peso ≥3** y evidencia de 2 eventos separados en el tiempo.

### 5.2 Niveles y acciones (PROPUESTA; configurables por nivel)

| Nivel | Puntaje (PROPUESTA) | Acción automática | Quién revisa |
|---|---|---|---|
| 0 Normal | 0–2 | ninguna | — |
| 1 Alerta | 3–5 | aviso al profesional («detectamos un acceso nuevo») y evento visible para el propietario | — |
| 2 Reautenticación | 6–8 | pedir contraseña + código antes de la siguiente acción operativa | — |
| 3 Revocar sesión | 9–11 | revocar la sesión operativa sospechosa (la más reciente o la que no es del dispositivo principal) y notificar | SuperAdmin ve el caso |
| 4 Bloqueo preventivo | ≥12 **y** regla de evidencia (arriba) | marcar `BLOQUEO_PREVENTIVO` en el acceso **operativo** (la cuenta de cliente y el historial no se tocan; no se borra ni retira el vínculo; sigue ocupando cupo) | **revisión humana obligatoria en ≤ 24 h PROPUESTA**; si no hay revisión, el bloqueo caduca solo a las 72 h |

**`riesgo_caso`**: `id`, `usuario_id`, `negocio_id`, `nivel`, `puntaje`, `estado` (`ABIERTO|EN_REVISION|CERRADO_SIN_ACCION|CERRADO_CON_ACCION|FALSO_POSITIVO`), `senales jsonb` (lista de ids de `evento_seguridad`), `accion_aplicada`, `modo` (`OBSERVAR|ACTIVO`: en `OBSERVAR` se calcula y se guarda lo que **habría** pasado, sin aplicar), `decidido_por` (`SISTEMA|SUPERSU:uid`), `motivo`, `created_at`, `cerrado_at`. **`riesgo_decision`** (append-only): una fila por cada cambio de nivel/acción con puntaje, señales y regla; es el «historial auditable de cada decisión» y se espeja en `evento_auditoria` con `actor_tipo='SISTEMA'` y `origen='SISTEMA'`.

Cálculo: función `riesgo_evaluar(usuario)` (definer, solo `service_role`) invocada (a) al registrar un evento de seguridad relevante y (b) por el cron diario existente (`/api/cron/diario`, patrón Fase 2) para decaimiento y caducidad de bloqueos. Idempotente por `(usuario, ventana)`. **Nunca suspende por una única anomalía** (regla de evidencia). **Suspensión de la licencia/vínculo no la decide el motor**: solo la RPC humana `admin_riesgo_aplicar` o el propietario por `suspender_staff`.

---

## 6. Compatibilidad con Fase 1 y Fase 2 (puntos de contacto y orden)

| Punto de contacto | Qué se hace | Espera a |
|---|---|---|
| `_capacidad_profesional` / `_cupo_bloquear` (152) | Se **reutilizan sin cambiar firma**; `licencia_asiento` se concilia con ella | Cierre de Fase 2 (158/159 modifican la función) |
| `adicional_barbero_contrato` y `_adicional_transicionar` (Fase 2, 156–163 en su plan; **ojo: 157 ya está tomada por la normalización de Fase 1**, y hay otros agentes con 160–164 y 170–179) | `licencia_asiento` se engancha **después** de que existan; hasta entonces, solo el nivel agregado | Que Fase 2 cierre y fije su numeración |
| `crear_invitacion_staff` (152, 154) y `aceptar_invitacion_staff` (145–148 de otra rama) | Rediseño **aditivo**: RPC nuevas `crear_invitacion_segura`/`aceptar_invitacion_segura`; las viejas delegan y luego se retiran | Que 145–148 se integren a esta rama (hallazgo de Fase 1: esta rama sola no es autosuficiente) |
| `invalidar_sesion_usuario` (155) | Se **reutiliza**; se le añade (parche por ancla) la revocación de `sesion_operativa` del mismo usuario | Nada |
| `perfil_proteger_columnas_sensibles` | **No se modifica** | — |
| `suspender_staff`/`retirar_staff` | Siguen siendo la única vía; el bloqueo preventivo del motor **no** cambia `vinculo.estado` | — |
| `evento_auditoria` / `_auditoria_limpiar` | Se reutilizan; la evidencia técnica va en `evento_seguridad` (el saneador borraría hashes) | — |
| `resolverContexto` (`src/lib/auth/resolver-contexto.ts`) y proxy | Se añade la comprobación de sesión operativa **solo para rutas operativas**; no se toca el login ni `updateSession` | Revisión de la lista de rutas con el `route-registry` |
| Roles de Fase 1 | Propietario con perfil profesional y ADMIN_BARBER **sí** operan y quedan sujetos a la sesión operativa; BUSINESS_ADMIN puro (no presta servicios) está **fuera** de la regla de «una sesión operativa» (PROPUESTA; decisión abierta) | — |

**Orden de despliegue** (memoria del proyecto: base primero, luego código; probar en Supabase local; nada remoto sin aprobación): 180 → 181 → … → código → activar `modo_motor=OBSERVAR` → 30 días → decidir `ACTIVO`.

---

## 7. Plan de migraciones y de pruebas

### 7.1 Migraciones (desde la 180; pequeñas; cada una con `NNN_..._REVERSION.sql.txt`; guardas por ancla en funciones editadas; aplicar → revertir → reaplicar en base local; no se registran en `schema_migrations` si no es cierto)

| N.º | Contenido | Rollback |
|---|---|---|
| 180 | `seguridad_config` (fila única, valores PROPUESTA con `modo_motor=APAGADO`), `seguridad_excepcion`, helper `_seguridad_param`, RPC `admin_seguridad_*` de config/excepciones, auditoría, RLS, grants | drop tablas/funciones |
| 181 | Ampliar CHECK de `consentimiento_evento.proposito`; tabla `evento_seguridad` (inmutable) y vista `security_invoker`; función interna `_seguridad_evento(...)` (sin grants de API) | restaurar CHECK; drop |
| 182 | Enum `invitacion_staff_estado` + `REPLACE`ADA (migración **sola**, por la limitación de `add value`) | no reversible en el enum; la reversión deja el valor sin usar |
| 183 | `invitacion_staff`: columnas nuevas, índice único parcial por PENDIENTE, `crear_invitacion_segura`/`aceptar_invitacion_segura`, rate-limit fail-closed, retirada de políticas de INSERT/ALL directas **tras** inventariar llamadores; las funciones viejas delegan | restaurar políticas y funciones guardadas en el `.txt` |
| 184 | `dispositivo_usuario`, `sesion_operativa`, RPC `dispositivo_solicitar/activar/revocar`, `sesion_operativa_registrar/validar/revocar`, locks, triggers de límite; parche por ancla de `invalidar_sesion_usuario` | drop tablas/funciones; restaurar 155 |
| 185 | Geocerca: columnas de `sede`, `verificacion_presencia`, `presencia_evaluar` (haversine en base), verificación alternativa | drop; columnas |
| 186 | `licencia_asiento` + triggers (negocio inmutable, vínculo del mismo negocio, único por vínculo) + `licencia_conciliar` | drop |
| 187 | Motor: `riesgo_caso`, `riesgo_decision`, `riesgo_evaluar`, caducidad de bloqueos, `admin_riesgo_*`; mantenimiento en el cron diario (una línea en `route.ts`) | drop |
| 188 | Retención/purga controlada de `evento_seguridad` y agregados | drop función |
| 189 | Normalización/backfill: dispositivos del usuario no se crean retroactivamente (se registran al primer uso); `licencia_asiento` para negocios con lotes activos; informe previo de excepciones | reversión por transacción |

Código (no migración): captura de GPS puntual + pantalla de aviso previo, registro de dispositivo en `/staff` y `/panel`, comprobación de sesión operativa en rutas operativas, pantallas «Mis dispositivos y sesiones», sección `/admin/seguridad`, textos legales, tipos `database.ts`, `route-registry`.

### 7.2 Plan de pruebas (SQL con `set role` + claims, HTTP real con JWT como `roles_http.sh`, concurrencia con varias sesiones, vitest para cálculo y acciones de servidor)

| # | Caso del punto 9 | Prueba concreta y resultado esperado |
|---|---|---|
| 1 | Reutilización de invitación | Aceptar → intentar aceptar de nuevo (misma y otra cuenta) → rechazo `INVITACION_NO_PENDIENTE`; reinvitar al mismo correo crea fila nueva (distinto `id` y `token_hash`), la anterior queda `REEMPLAZADA`; se registra `INVITACION_REUSO_INTENTADO`; 2 aceptaciones simultáneas → solo 1 vínculo |
| 2 | Invitación a otro destinatario | Cuenta B con correo/teléfono distinto usa el enlace de A → `NO_AUTORIZADO`, intento contado, tras N intentos la invitación se bloquea temporalmente |
| 3 | Vencida | Con `expira_at` pasado → `INVITACION_EXPIRADA`, asiento reservado liberado; vigencia leída de `seguridad_config` (cambiarla a 1 h y comprobarlo) |
| 4 | Sin licencia pagada | Lote ausente, suspendido o vencido → `PLAN_LIMIT_EXCEEDED` al crear **y** al aceptar; insert directo en `invitacion_staff` por el propietario → denegado (RLS retirada); con un lote activo → pasa; concurrencia: más invitaciones que asientos → exactamente N pasan |
| 5 | Profesional vinculado a otro negocio | Aceptar con vínculo no RETIRADO en otro negocio → `YA_TIENE_VINCULO_ACTIVO`; insertar vínculo directo por el propietario para un staff ajeno → denegado |
| 6 | Manipulación de `business_id` | Cliente pasa `negocio_id` ajeno a cada RPC nueva y a las Server Actions → `NO_AUTORIZADO`; el negocio se deriva del vínculo/invitación en base, no del parámetro; `UPDATE licencia_asiento set negocio_id` → rechazo del trigger |
| 7 | Dos sesiones simultáneas | Con `sesiones_operativas_max=1`: 2.ª sesión operativa → `REEMPLAZAR` revoca la 1.ª (su siguiente ruta operativa redirige a login, comprobado por HTTP) o `BLOQUEAR_NUEVA`; el índice único impide 2 `ACTIVA`; 6 sesiones simultáneas → 1 activa (patrón de concurrencia de Fase 1) |
| 8 | Cambio de dispositivo | Dispositivo nuevo → `PENDIENTE_VERIFICACION`; sin reautenticación/código no se activa; con límite 2 el 3.º → rechazo; revocar uno libera el cupo; cookie de dispositivo sin sesión GoTrue **no** autentica (comprobado) |
| 9 | GPS denegado | `DENEGADO/SIN_GPS` → **no** bloquea ni puntúa (S9=0); ofrece verificación alternativa; con confirmación del propietario → `VERIFICACION_ALTERNATIVA_OK` |
| 10 | Cambio legítimo de IP | Misma sesión/dispositivo con IP y prefijo nuevos → solo `INFO`, puntaje 0, sin acción; IP compartida entre 2 profesionales del mismo negocio → sin señal |
| 11 | Trabajo desde otra sede autorizada | Profesional con sede A que opera en sede B del mismo negocio (cambio de sede autorizado): presencia evaluada contra B → `DENTRO`, sin señal; en sede de otro negocio → `FUERA`/rechazo de acción |
| 12 | Usar cupo de un negocio en otro | Asiento del negocio X asignado a un vínculo del negocio Y → rechazo del trigger; reasignar vía API → rechazo; el cupo de X no aumenta la capacidad de Y (`_capacidad_profesional`) |
| 13 | Suspensión y reactivación de licencia | Vence el lote → EN_GRACIA → SUSPENDIDO: asiento `SUSPENDIDO` sigue ocupando capacidad, profesional/citas/historial/evidencias intactos, acceso operativo restringido según suscripción; pago confirmado → `ASIGNADO` y acceso recuperado; **nunca** se borra ni retira |
| 14 | Excepciones administrativas y auditoría | Solo SuperSU; sin motivo (<15) → rechazo; sin vigencia → rechazo; propietario/admin/barbero/anónimo → `NO_AUTORIZADO`; cada alta/revocación deja `evento_seguridad` + `evento_auditoria` (quién/cuándo/qué antes→después); expira sola; `EXCEPCION_CREADA` no editable (trigger inmutable) |

Pruebas transversales: `REVOKE` verificado con `aclexplode` para `public/anon/authenticated` en todas las RPC internas y de servidor (más llamada real como `anon`); ninguna columna/auditoría con tokens o contraseñas (grep de claves sobre `evento_seguridad.detalle` y `evento_auditoria.payload_*`); motor en `OBSERVAR` no aplica acciones; regla «una anomalía no suspende» (S8 sola ×5 no pasa de nivel 3); migraciones aplicar/revertir/reaplicar; regresión de suites de Fase 1 y 2; `tsc`, `eslint`, `vitest`, `next build`.

---

## 8. Matriz de riesgos y decisiones abiertas

### 8.1 Riesgos

| Id | Riesgo | Tipo | Mitigación |
|---|---|---|---|
| R-1 | Cambiar `on conflict` rompe flujos de reenvío/`reenvios_count` y enlaces ya enviados | Técnico | Compatibilidad: invitaciones heredadas (`token_hash` NULL) aceptables una vez hasta su vencimiento; pruebas del reenvío |
| R-2 | Retirar políticas de escritura directa rompe pantallas que escriben directo | Técnico | Inventario previo de llamadores (no hecho aquí) y migración con reversión |
| R-3 | Comprobación de sesión por solicitud agrega latencia/fallo del proxy | Técnico | Solo rutas operativas, consulta indexada, fail-**open para lectura / fail-closed para acciones de cobro** (decisión); métricas |
| R-4 | Dependencia del esquema interno `auth.sessions` | Técnico | Lectura/borrado solo en funciones aisladas; test de contrato contra la versión de GoTrue; no exponerlo |
| R-5 | JWT sigue válido tras revocar (hasta `jwt_expiry`) | Técnico | Comprobación server-side en rutas operativas; evaluar acortar expiración o Custom Access Token Hook (decisión abierta) |
| R-6 | Orden/numeración de migraciones con otros agentes (160–164, 170–179) y colisión Fase 2 (157 ocupada) | Técnico | Usar 180+; verificar `ls` antes de crear; coordinar renumeración |
| R-7 | Falsos positivos por CGNAT/IP móvil/compartida de barbería | Falso positivo | IP nunca sola, prefijo/dispositivo, `OBSERVAR` 30 d, revisión humana para bloqueo |
| R-8 | GPS impreciso en interiores / PC sin GPS penaliza al profesional | Falso positivo | Umbral de precisión, S9=0, verificación alternativa, sin bloqueo por GPS |
| R-9 | Reintegro de un profesional legítimo con dispositivo nuevo se interpreta como compartición | Falso positivo | Reautenticación + código; el propietario puede reiniciar dispositivos; excepciones con vigencia |
| R-10 | Recolección excesiva de ubicación/IP (reclamo de privacidad) | Privacidad | Solo eventos puntuales, no se guardan coordenadas, aviso previo, retención corta, purga controlada |
| R-11 | Índice único parcial solo vale para «1 sesión»; subir el máximo exige trigger | Técnico | Documentado; trigger con lock cuando `max>1` |
| R-12 | Propietario/administrador usa la evidencia para vigilar o presionar a un profesional | Privacidad/abuso | El propietario ve eventos no técnicos (sin IP ni distancia exacta); acceso del SuperAdmin auditado |
| R-13 | Atacante dispara reintentos de invitación para bloquear a un profesional (DoS) | Abuso | Bloqueo por invitación, no por cuenta; límite por IP y por usuario; sin efectos sobre el vínculo |
| R-14 | Abuso por el propio SuperAdmin (excepciones sin motivo) | Abuso | Motivo obligatorio, vigencia obligatoria, inmutabilidad, revisión periódica en el CRM |
| R-15 | Clasificación legal de IP/ubicación (sensible o no) y base de legitimación mal elegida | Legal | **No asumir**; revisión por abogado antes de activar GPS (8.2) |
| R-16 | Rate-limit actual es fail-open (`rate-limit.ts:29-31`) | Técnico | Para rutas de invitación/dispositivo, variante fail-closed |
| R-17 | `ipDelLlamador` usa `x-forwarded-for` (manipulable si la plataforma no lo reescribe) | Técnico | NO VERIFICADO en la plataforma; usar la cabecera que la plataforma garantiza y tratar la IP solo como señal |

### 8.2 Decisiones abiertas (valores PROPUESTA) y acciones externas/legales

Decisiones para el usuario:
1. ¿Se acepta `REEMPLAZAR` (la sesión nueva expulsa a la anterior) o `BLOQUEAR_NUEVA`? PROPUESTA: `REEMPLAZAR`.
2. ¿1 principal + 1 secundario, confirmado? PROPUESTA: sí; el SuperAdmin puede ampliar con excepción.
3. Vigencia de invitación: PROPUESTA 72 h (hoy 7 días fijos). ¿Y el límite de intentos (5)?
4. Radio de geocerca: 150 m (dado por el usuario). Precisión máxima aceptada: PROPUESTA 100 m.
5. ¿GPS **solicitado** en el alta de dispositivo pero no obligatorio (PROPUESTA), o exigido con alternativa?
6. Acciones «presenciales» concretas (iniciar turno, cobro en efectivo…): PROPUESTA ninguna activa hasta decidir.
7. Verificación por teléfono: ¿proveedor SMS de Supabase (requiere configurar proveedor y su costo, NO VERIFICADO), WhatsApp previsto en 128, o solo correo en esta fase? PROPUESTA: correo ahora, teléfono cuando exista verificación.
8. ¿La suspensión preventiva puede aplicarla el sistema con revisión posterior (PROPUESTA: sí, solo acceso operativo, caduca a 72 h) o solo humanos?
9. Enfriamiento entre negocios: PROPUESTA 0 días (solo registrar) hasta tener datos.
10. ¿BUSINESS_ADMIN puro queda fuera de «una sesión operativa»? PROPUESTA: sí.
11. Custom Access Token Hook / acortar `jwt_expiry` / plan Pro de Supabase para timebox e inactividad: decisión con costo y riesgo sobre el login de todos.
12. Retención: 180 d / 12 m (PROPUESTA).
13. Modo inicial del motor: `OBSERVAR` 30 días.

Acciones externas/legales (no las puede hacer el código):
- **Abogado de protección de datos**: política de tratamiento y aviso de privacidad actualizados con IP, dispositivo y ubicación puntual; base de legitimación; si la ubicación debe tratarse como dato sensible (NO VERIFICADO); transferencias internacionales por proveedores de nube; encargados; registro ante la autoridad (RNBD) si aplica (NO VERIFICADO); procedimiento de consultas y reclamos.
- **Términos de uso / contrato con el negocio y con el profesional**: cláusula de licencia no transferible, de dispositivos y sesiones, de consecuencias de uso compartido (con proceso de revisión humana).
- **Supabase**: confirmar el plan del proyecto y la configuración remota de `[auth.sessions]`, expiración del JWT y MFA (NO consultado); confirmar método admin para revocar sesiones de otro usuario con la versión de GoTrue desplegada.
- **Vercel/plataforma**: confirmar qué cabecera de IP es confiable (NO consultado).
- **Aprobación explícita del usuario** antes de aplicar cualquier migración fuera de la base local o activar el motor en modo `ACTIVO`.

---

## Apéndice A — Hechos consultados en la base local (solo SELECT)

`\d` de `invitacion_staff`, `vinculo_staff_negocio`, `sede`, `staff`, `perfil`, `evento_auditoria`, `intento_auth`, `consentimiento_evento`, `verificacion_evento`, `limite_tasa_evento`, `auth.sessions`, `auth.refresh_tokens`; `pg_get_functiondef` de `aceptar_invitacion_staff`, `responder_invitacion`, `crear_invitacion_staff`; `routine_privileges` de las RPC de invitación y de sesión; conteos: 6 sedes (1 con coordenadas), invitaciones: 2 PENDIENTE y 2 ACEPTADA, 35 perfiles con teléfono, 101 filas en `auth.sessions`. Migraciones existentes hasta 157 en esta rama (no hay 156 ni 158+; otros agentes escriben 160–164 y 170–179).
