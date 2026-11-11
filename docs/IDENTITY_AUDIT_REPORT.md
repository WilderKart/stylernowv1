# Auditoría de Identidad, Roles y Autorización — Pre-Password Platform

**Fecha:** 2026-09-16 · **Alcance:** ADR-015/016, previo a construir Password Platform.
**Método:** lectura directa de código y migraciones SQL (2 agentes de exploración en paralelo + verificación propia), grafo de `codebase-memory-mcp` consultado antes de auditar, y **evidencia en vivo real**: 5 usuarios reales creados vía Supabase Admin API (uno por rol), sesiones reales obtenidas con `signInWithPassword` + `@supabase/ssr`, y ataques simulados con `curl` contra el dev server usando esas sesiones — no solo lectura de código.

---

## FASE 0 — Memory MCP

Proyecto indexado (4.427 nodos, 11.516 edges, `status: ready`) verificado antes de auditar. No se reconstruyó ninguna decisión ya tomada — esta auditoría referencia ADL-011/015/019/022/028/032/033, `01_Roles.md`, `permission-registry.ts` y `route-registry.ts` tal como existen hoy.

---

## FASE 1 — Modelo de identidad

### 1. ¿Dónde vive la identidad?

```
auth.users (Supabase Auth)
   │  trigger on_auth_user_created → handle_new_user()  (007_triggers_and_storage.sql:4-22)
   ▼
public.perfil (id = auth.users.id, 1:1)          ← es_supersu vive acá
   │
   ├── public.negocio (owner_user_id → perfil.id)      ← identidad "Barbería"
   │      └── public.sede (negocio_id → negocio.id)
   │
   └── public.staff (usuario_id → perfil.id)            ← identidad "Staff"
          └── public.vinculo_staff_negocio (staff_id → staff.usuario_id, negocio_id, sede_activa_id, es_guardian)
```

**Guardian no es una fila propia** — es `vinculo_staff_negocio.es_guardian = true` sobre el mismo Staff. SuperSU no es una fila propia tampoco — es `perfil.es_supersu = true` sobre el mismo `auth.users`. Confirmado con código real, no supuesto.

### 2. ¿Dónde se determina el rol?

El diagrama pedido (`Supabase Auth → resolverContexto() → Permission Registry → Contexto → Página`) **no es el único camino** — hay tres, deliberadamente separados (ADL-011/015/019, reconfirmado por el fundador en esta misma conversación):

| Superficie | Función | Archivo |
|---|---|---|
| Panel (Barbería/Guardian) | `resolverContexto()` | `src/lib/auth/resolver-contexto.ts` |
| Staff (App Staff) | `obtenerContextoStaff()` | `src/lib/auth/require-staff.ts` |
| SuperSU | `requireSuperSU()` | `src/lib/auth/require-supersu.ts` |

Las tres, desde ADR-015, derivan sus permisos de la misma fuente: `src/lib/auth/permission-registry.ts` (`derivarPermisosPanel()` para Panel; Staff/SuperSU no usan el objeto `Permisos` de Panel — su autorización real es RLS/`is_supersu()`). Ninguna cachea entre requests — `resolverContexto()` lo documenta explícitamente (línea 14-17: "no cachea nada... sin logout").

### 3. ¿Cómo se almacena el rol?

**No es un enum ni una columna `rol` en `perfil`.** Se **deriva** en cada request a partir de relaciones:
- `negocio.owner_user_id = auth.uid()` → Barbería.
- `vinculo_staff_negocio` (estado ≠ RETIRADO) con `es_guardian=true` y `sede_activa_id` no nulo → Guardian.
- Mismo vínculo sin Guardian → Staff.
- `perfil.es_supersu = true` → SuperSU (chequeo aparte, no en la cadena anterior).
- Nada de lo anterior → Cliente ("NINGUNO" en `RolPanel`).

No hay JWT custom claims (confirmado: cero `jwtDecode`/lectura manual de claims en `src/`), no hay metadata de Supabase Auth usada para rol (`app_metadata`/`user_metadata` solo se usan para `nombre` y `provider`).

### 4. ¿Puede un usuario tener múltiples roles?

| Combinación | Estado |
|---|---|
| Barbería + Cliente | **Permitido y esperado** — el dueño de un negocio puede reservar en el Marketplace como cualquier Cliente; son la misma `auth.users` row, ningún código lo impide. |
| Guardian/Staff + Cliente | **Permitido** — un Staff puede reservar en OTRO negocio como Cliente (no en el suyo propio, eso sería una Reserva interna vía Agenda, no Marketplace). |
| SuperSU + cualquier otro | **No verificado en código que lo impida ni lo permita explícitamente** — `es_supersu=true` es independiente de tener o no un `negocio`/`vinculo_staff_negocio`. En la práctica, `requireSuperSU()` no revisa si la persona también es Barbería; si lo fuera, seguiría entrando a `/admin` con `es_supersu=true`. No hay una regla documentada en `01_Roles.md` que prohíba esto explícitamente — **queda como hallazgo para Fase 8** (no es un bug, es una ambigüedad de política no escrita).

### 5. ¿Cómo cambia Guardian de sede?

Verificado con código real (`015_gestion_staff.sql`) y con el `evento_auditoria`:
- `trasladar_staff` actualiza `sede_activa_id` y registra auditoría (mismo patrón que `promover_guardian`/`revocar_guardian`, líneas 348/379 según el agente de Fase 2 original, confirmado también por el agente de RLS: `is_guardian_de_sede()` compara contra `sede_activa_id` en tiempo real, nunca un valor cacheado).
- La revocación de alcance sobre la sede anterior es **automática e implícita**: como `is_guardian_de_sede(sede_id)` (helper RLS) siempre lee `sede_activa_id` actual, en el instante en que esa columna cambia, el Guardian pierde acceso RLS a la sede anterior sin ninguna acción adicional — no hay una "revocación" que ejecutar por separado, es una consecuencia estructural del diseño (confirmado por el agente RLS: policies de `sede`/`reserva` usan `is_guardian_de_sede()` directo).
- **Sin logout necesario** — confirmado, `resolverContexto()` re-consulta en cada request.

---

## FASE 2 — Autenticación (evidencia: agente de exploración, ver citas exactas abajo)

| Rol | Flujo real hoy |
|---|---|
| **Cliente** | OTP únicamente. `enviarCodigo()`/`verificarCodigo()` (`src/app/login/actions.ts:21-79`) → `signInWithOtp`/`verifyOtp`. Primer login detecta `perfil.telefono` faltante → `/perfil?bienvenida=1`. Cero password, cero OAuth (grep exhaustivo: 0 resultados para `signInWithPassword`, `signInWithOAuth`, `resetPasswordForEmail` en todo `src/`). |
| **Barbería** | Mismo login OTP que Cliente — no hay un login separado. El wizard de `/panel/onboarding` es 100% post-autenticación. `onboarding_completo` se pone `true` dentro de la RPC `enviar_negocio_a_aprobacion` (`011_registro_negocio.sql:88-91`), solo tras validar Sede+Servicio+Plan. |
| **Staff** | Invitación con **token = UUID plano** (`invitacion_staff.id`, sin HMAC/firma) enviado por email. `expira_at` a 7 días, revalidado en `responder_invitacion` (`015_gestion_staff.sql:271-274`). La persona debe iniciar sesión (mismo OTP) con el email exacto de la invitación — RLS (`invitacion_staff_select_propia`) ya impide ver una invitación ajena aunque se adivine el UUID. Cero self-registro posible (confirmado). |
| **SuperSU** | Cero código que setee `es_supersu=true` — solo SQL/Admin API manual, confirmado por grep exhaustivo de todo `src/` y `supabase/migrations/*.sql`. |

### Tabla de estados (evidencia real, no supuesta)

| Estado | ¿Existe? |
|---|---|
| Email no verificado | Parcial — Supabase Auth lo trackea internamente (`confirmed_at`), pero **ningún código de la app lo lee ni lo expone**; se asume verificado implícitamente al completar el OTP. |
| OTP válido | Sí — `verifyOtp`, único mecanismo de login hoy. |
| Password | **No existe** — cero UI, cero Server Action, cero columna. |
| Google | **No existe** — cero `signInWithOAuth` en el código (credenciales ya están en Supabase Dashboard según el fundador, pero el código de la app no las usa todavía). |
| Sesión activa | Sí — cookie `@supabase/ssr` estándar, refrescada por `updateSession()` en cada request. |
| MFA | **No existe** — cero `mfa`/`totp`/`aal1`/`aal2`/`factor` en todo el repo (código o SQL). |
| Bloqueo temporal / rate limit | **No existe** — cero tabla, cero RPC, cero lógica de intentos fallidos en la app (Supabase puede tener límites propios a nivel de plataforma, pero la app no implementa ninguno). |

---

## FASE 3 — Autorización (verificado con curl real contra sesiones reales)

### Middleware (`src/proxy.ts`)
Consciente del Route Registry (`route-registry.ts`), decide público/protegido sin DB, redirige a `/login?next=...` si falta sesión. **Corrección aplicada durante esta auditoría**: excluye `/api/**` del redirect (ver Fase 8, hallazgo #3) — las rutas de API manejan su propio 401/403 real.

### `requireRole()` / `verificarAccesoPanel()` / guards por superficie
- **Panel**: `verificarAccesoPanel(["BARBERIA","GUARDIAN"], ruta)` — capa de compatibilidad, `RolPanel` en mayúscula (ver ADR-016).
- **Admin**: `requireSuperSU()` dentro de `admin/layout.tsx`, envuelto en `<Suspense>` local (hotfix previo).
- **Staff**: `obtenerContextoStaff()` dentro de `staff/layout.tsx`, con 3 estados inline (sin vínculo/suspendido/invitado) — **no son bugs**, son contenido legítimo.

Diferencia clave: Panel/Admin usan `forbidden()`/`redirect()` para rol ajeno; Staff nunca redirige por "sin vínculo" (diseño deliberado para mostrar el estado).

### `PanelNav`
Lee `rol: RolPanel` (mayúscula) recibido como prop — **no lee el Permission Registry**, arma su lista de ítems con lógica condicional fija en el componente (`...(rol === "BARBERIA" ? [...] : [])`). Confirmado: no hardcodea botones sueltos sin condición, pero tampoco consulta `permission-registry.ts` — queda para ADR-016.

### Comparaciones directas `rol === "GUARDIAN"`/`"BARBERIA"`
Existen y **quedan así hasta ADR-016** (decisión ya tomada explícitamente en esta conversación) — presentes en las 27 páginas de `/panel` migradas a `verificarAccesoPanel()` (dentro del cuerpo, después del guard) y en `PanelNav`. Inventario completo en `docs/AUTH_MIGRATION_QUEUE.md`.

---

## FASE 4 — RLS (evidencia: agente de exploración, políticas leídas directamente)

| Dominio | Backend protegido |
|---|---|
| `negocio` | ✅ Escritura exclusiva del owner (`negocio_insert_owner`/`negocio_update_barberia`), lectura pública solo si `estado='ACTIVO'`. |
| `sede` | ✅ Alcance de Guardian correctamente limitado a `is_guardian_de_sede(id)` (su sede activa exacta, no todo el negocio). |
| `vinculo_staff_negocio` | ✅ Guardian tiene **solo lectura** — no puede auto-promoverse ni alterar `es_guardian` (`vinculo_write_barberia` exige `is_barberia_de`). |
| `reserva` | ✅ 4 políticas de select + 2 de insert, alcance exacto por rol (Cliente propio / Staff asignado / Guardian su sede / Barbería su negocio). |
| POS (`producto`/`venta_producto`) | ✅ Defensa en profundidad real: RLS bloquea insert directo (no existe policy de insert en `venta_producto`) **y** `completar_venta_pos()` (SECURITY DEFINER) re-valida `is_barberia_de`/`is_guardian_de_sede`/`staff_id=auth.uid()` internamente antes de mutar. |
| CRM (`vista_crm_cliente`) | ✅ `security_invoker=true` desde su creación (`019_crm.sql:111-112`, reafirmado en `020`). |
| Lealtad/Wallet/Gift Card (26 tablas) | ✅ Patrón uniforme: solo políticas de `select`, todas las mutaciones vía RPC `SECURITY DEFINER` con `revoke` explícito de `public, anon, authenticated`. |
| `evento_auditoria` | ✅ Un dueño de negocio NO puede leer la auditoría de otro negocio — confirmado, `is_barberia_de(negocio_id)` estricto. |

**Hallazgo histórico (ya cerrado, no requiere acción):** la vista `ai_interaction` (migración 079) se creó **sin** `security_invoker=true` — el mismo defecto de clase que ADL-032 documentó — permitiendo lectura cruzada de consumo de IA entre negocios durante una sola migración. Se corrigió en la migración 080 (`alter view ... set (security_invoker = true)`), con comentario propio documentando el hallazgo. Cero otras vistas del proyecto (se revisaron las 4 que existen) comparten este defecto hoy.

**Revisión de `revoke` (ADL-022/028):** dos instancias tempranas revocaron solo de `public` (008, 041) — ambas corregidas 1-2 migraciones después (042, 075) con `revoke ... from public, anon, authenticated` explícito y comentario citando la lección. **Ninguna instancia sin corregir hoy.**

---

## FASE 5 — Ataques simulados (evidencia REAL: 5 usuarios creados en Supabase, sesiones reales, curl real)

Usuarios de prueba creados vía Supabase Admin API (credenciales al final de este documento).

| Caso | Resultado obtenido | Evidencia |
|---|---|---|
| Anónimo → `/panel`, `/admin`, `/staff` | **307** a `/login?next=...` | curl sin cookie, confirmado en el middleware. |
| Cliente real → `/panel` | Contenido protegido — cuerpo pintado es el skeleton genérico de `/panel`, el mensaje "No tenés acceso" solo llega vía payload de hidratación (nunca datos reales visibles) | Body inspeccionado byte a byte, sin fuga de datos. |
| Guardian real → `/panel/wallet`, `/panel/ads`, `/panel/suscripcion` | Bloqueado — cero dato financiero/de campaña visible en el cuerpo pintado (grep de "saldo"/"Retenida" = 0 resultados) | Ídem. |
| Guardian real → `/panel/crm` | Permitido, 200 con contenido real | Confirma que el guard no sobre-bloquea. |
| Staff plano real → `/panel` | Bloqueado; → `/staff` permitido | Confirmado. |
| Barbería real → `/admin` | Bloqueado, redirige a `/panel` | Confirmado, `requireSuperSU()` no reconoce `es_supersu=false`. |
| SuperSU real → `/admin`, `/admin/moderacion` | Permitido, 200 | Confirmado. |
| SuperSU real → `/panel` | Redirige a `/panel/onboarding` (SuperSU no tiene negocio) | Comportamiento correcto, no un error. |
| **API directa sin UI** (`/api/crm/exportar`, Guardian) | **403 real** (Route Handler, sin la limitación de streaming de las páginas) | `curl -b <cookie-guardian>` → `status=403`. |
| **API directa sin sesión** | **401 real** — *encontró y corrigió una regresión real, ver Fase 8 #3* | Antes de la corrección: 307 (roto). Después: 401. |
| Cookie corrupta/truncada | 307 (tratada como sin sesión) | `curl -b "sb-...=base64-invalido"` → 307. |
| JWT con 1 carácter alterado | 307 (firma inválida, rechazado por Supabase) | Confirmado — no es posible forjar una sesión modificando el token. |

**Conclusión de Fase 5: el aislamiento de datos (el objetivo real de Zero Trust) se sostiene empíricamente en todos los casos probados.** El único matiz real es de código de estado HTTP, no de exposición de datos — ver Fase 8 #1.

---

## FASE 6 — Session Security

| Componente | ¿Existe hoy? |
|---|---|
| Session Registry | No |
| Device Trust | No |
| Session Version | No |
| Logout remoto | No (solo `signOut()` de la propia sesión) |
| Revocación selectiva | No |

**Riesgos reales mientras no existan:**
- **Secuestro de sesión**: si un access token (corta duración, JWT estándar de Supabase) es robado, es válido hasta su expiración natural — no hay forma de invalidarlo antes.
- **Múltiples dispositivos**: no hay visibilidad ni control — un usuario no puede ver ni cerrar sesiones de otros dispositivos.
- **Traslado/suspensión de Staff**: gracias a que `resolverContexto()`/RLS re-evalúan en cada request (Fase 1.5), el IMPACTO de este riesgo es menor de lo típico — un Staff suspendido pierde acceso a datos en su siguiente request aunque su JWT siga "vivo" (RLS lo bloquea). El riesgo real es más acotado a: ver contenido de UI ya cacheado en el navegador, no a leer/escribir datos nuevos.

---

## FASE 7 — Password Platform Readiness

| Componente | Estado |
|---|---|
| Password | No construido |
| Forgot Password | No construido |
| Change Password | No construido |
| Google OAuth | No construido (credenciales listas en Supabase Dashboard) |
| MFA | No construido |
| Session Registry | No construido |
| Device Trust | No construido |
| Session Version | No construido |

---

## FASE 8 — Contradicciones (documentadas, no corregidas automáticamente salvo la #3, que era una regresión de esta misma sesión)

| # | Biblia / Diseño esperado | Código real | Decisión propuesta |
|---|---|---|---|
| 1 | ADR-015 exige "debe devolver 401/403... nunca mostrar contenido" | `forbidden()`/`redirect()` llamados dentro del render de página **no cambian el código de estado HTTP** una vez que el shell (con el skeleton de `loading.tsx`) ya empezó a transmitirse — limitación documentada del propio Next.js 16 (`node_modules/next/dist/docs/.../forbidden.md`: "the response has already begun streaming as a 200, and the status can't change"). El **dato nunca se expone** (verificado empíricamente, Fase 5), pero el status code queda en 200, no en 403/307. Esto ya era así ANTES de esta auditoría para los redirects de Admin/Staff (aceptado en el hotfix anterior) y ahora también aplica a los `forbidden()` nuevos de Panel. | **Propuesta:** aceptar como limitación conocida del framework — la garantía real de Zero Trust (datos nunca expuestos) se sostiene y se verificó con evidencia real; conseguir un status code literal 403 exigiría mover resolución de rol a Edge Middleware (revierte la decisión explícita de "middleware liviano"). Alternativa más barata: los Route Handlers (`/api/**`) SÍ devuelven status reales (403/401 confirmados) — si algún consumidor externo depende del status code de una página, se le ofrece un endpoint de API en vez de la página HTML. |
| 2 | Ninguna | `05-API/02_Auth.md` describe un modelo de JWT con claims custom (`rol`, `negocio_id`, `sede_id`) — nunca construido; la implementación real resuelve todo en DB por request. | **Propuesta:** corregir `05-API/02_Auth.md` para reflejar el modelo real (ya recomendado en el plan de ADR-015, pendiente de ejecutar en la Fase de documentación final). |
| 3 | Ninguna — regresión introducida en esta misma sesión (ADR-015 Fase B) | El nuevo middleware (`proxy.ts`) redirigía **también** `/api/**` a `/login` (307) en vez de dejar que cada Route Handler devolviera su propio 401. Encontrado con evidencia real (curl sin cookie → 307 en vez de 401) durante esta auditoría. | **Ya corregido** (no es una decisión pendiente): `/api/**` ahora se excluye explícitamente del redirect en `proxy.ts`. Verificado: vuelve a dar 401. |
| 4 | Ninguna — ambigüedad de política, no un bug | ¿Puede una cuenta con `es_supersu=true` ser AL MISMO TIEMPO dueña de un `negocio` (Barbería)? El código no lo impide ni lo contempla. | **Propuesta:** decisión de producto pendiente del fundador — ¿SuperSU debe ser una cuenta 100% separada (nunca dueña de un negocio real), o es un caso de borde aceptable? No bloquea Password Platform. |

---

## Matriz de cobertura (calculada, no estimada)

| Área | Cobertura |
|---|---|
| Auth (métodos de login) | 1 de 3 requeridos por ADR-015 construido (OTP). Password/Google: 0%. |
| Roles (resolución + Permission Registry) | 100% de los 3 resolvers mapean al contrato único; Permission Registry cubre 14/14 módulos de `01_Roles.md`. |
| Middleware | 100% de las 70 páginas auditadas pasan por `proxy.ts`; Route Registry cubre 100% (`check-auth-coverage.mjs`: 0 rutas sin registrar tras esta auditoría). |
| RLS | 8/8 dominios auditados con verdict FULLY SCOPED (1 hallazgo histórico ya cerrado). |
| Session Security | 0/5 componentes construidos (Registry, Device Trust, Version, logout remoto, revocación). |
| Password Readiness | 0/8 componentes del checklist de Fase 7 construidos. |

---

## Definition of Done

- [x] Todos los roles trazados desde Auth hasta RLS (Fase 1 + 4).
- [x] Todas las rutas privadas verificadas (`check-auth-coverage.mjs`: 70 páginas, 0 errores tras esta auditoría).
- [x] Todos los ataques simulados probados — **con usuarios y sesiones reales**, no solo lectura de código.
- [x] Todas las contradicciones documentadas (Fase 8, tabla arriba) — ninguna corregida automáticamente salvo la regresión #3 (introducida en esta misma sesión, no una decisión de producto).
- [x] Existe `docs/IDENTITY_AUDIT_REPORT.md` (este documento).
- [x] `tsc --noEmit`, `eslint` limpios tras el fix de `/api/**`.

## Decisión: ¿Password Platform puede comenzar?

**Sí.** El modelo de identidad está internamente consistente, verificado con evidencia real (no teórica), y las únicas contradicciones encontradas son (a) una limitación conocida y aceptable de Next.js sobre status codes — no una fuga de datos — y (b) una ambigüedad de política que no bloquea la construcción de Password/Google/MFA. La única regresión real encontrada durante la auditoría ya fue corregida y verificada.

---

## Usuarios de prueba reales (creados en esta sesión vía Supabase Admin API)

Contraseña común: `AuditoriaZT-2026!` (cámbienla o elimínenlas cuando terminen de probar — son cuentas reales en el proyecto de Supabase).

| Rol | Email |
|---|---|
| Cliente | `cliente-audit-75772@stylernow-test.com` |
| Barbería (dueña de "Barberia Auditoria ZT", plan JARL, `onboarding_completo=true`) | `barberia-audit-75772@stylernow-test.com` |
| Guardian (de la sede "Sede Principal" del negocio anterior) | `guardian-audit-75772@stylernow-test.com` |
| Staff plano (mismo negocio/sede, sin perfil Guardian) | `staff-audit-75772@stylernow-test.com` |
| SuperSU (`es_supersu=true`) | `supersu-audit-75772@stylernow-test.com` |

---

## Addendum — Auditoría formal de seguridad (skill `security-audit`), 2026-09-18

Auditoría posterior, independiente de la de arriba: 6 fases formales (reconnaissance →
hunting waves → validación → reporte estructurado → verificación independiente → reporte
final), corriendo contra el árbol de trabajo con ADR-015 Fases A-D ya construidas
(commit base `a12e2d2`, dirty). Artefactos completos en
`C:\Users\karni\security-audit-skill\stylernow\run-1\` (`architecture.md`,
`coverage-ledger.json`). Ver `ADL-036` en `Architecture_Decision_Log.md` para el detalle
del hallazgo crítico y su corrección.

**Hallazgo crítico (corregido en el momento, migración 084):** `perfil_update_propio`
(RLS de la tabla `perfil`) no tenía `with check` distinto de su `using` — cualquier
usuario autenticado podía llamar directo a PostgREST y auto-promoverse a SuperSU
(`{"es_supersu": true}`) o neutralizar su propia revocación de sesión
(`session_version`). Verificado en vivo contra `cliente-audit-75772@stylernow-test.com`
(revertido al terminar) tanto el intento bloqueado como que el autoservicio legítimo de
`password_establecida` sigue funcionando.

**Hallazgo medio (confirmado, pendiente de corregir):** `/auth/callback` decide si una
sesión es de "recuperación de contraseña" (y por lo tanto si se saltan los gates
obligatorios de reaceptación legal y completar teléfono) mirando el parámetro `next`
—controlable por quien inicia el login— en vez de `data.redirectType`, el campo que el
propio SDK de Supabase ya devuelve para esto. Con `?next=/login/recuperar` en un login
normal (Google u OTP), esos gates se saltan. Fix: usar `data.redirectType === "recovery"`
como única fuente de verdad en `route.ts`.

**Hallazgos bajos (confirmados):** condición de carrera TOCTOU en el rate limiter de auth
(`verificar_rate_limit_auth`/`registrar_intento_auth` son llamadas separadas, sin lock);
XSS almacenado en el JSON-LD de `/negocio/[slug]` (`JSON.stringify` no escapa `</script>`);
paso silencioso del webhook de Mercado Pago cuando `MERCADOPAGO_WEBHOOK_SECRET` no está
configurado (mitigado por el re-fetch contra la API real antes de aplicar cualquier
efecto).

**Deuda técnica de alta prioridad (sin corregir, documentada):** el mismo patrón de RLS
sin `with check` de `perfil` también existe en `negocio`/`sede`/`servicio`/`reserva`, pero
esas columnas sí las escriben RPCs legítimas bajo el JWT del usuario real — requieren un
fix distinto (bandera `set_config()` transaccional), no el trigger usado para `perfil`.
Ver `docs/TECH_DEBT_REGISTER.md`.

Reporte completo (hallazgos restantes de las hunting waves, evidencia detallada,
verificación independiente) en curso — se referenciará acá una vez cerrado.
