# Centro de Cumplimiento y PQRS — informe de implementación local

Fecha: 2026-11-18 · Rama `feat/centro-cumplimiento` (worktree `stylernow-cumplimiento`, base `main` 6901871) · **Solo entorno local. Producción no se tocó** (únicamente se leyó el listado de migraciones aplicadas, en modo lectura).
Sin commit: todo está en el árbol de trabajo para revisión.

## 1. Estado inicial y qué se reutilizó
- `ticket_soporte` / `ticket_mensaje` (mig. 029), sus RPC, RLS y la auditoría de estado: **se amplían, no se reemplazan**. Los tickets existentes se completan (número, tipo `OPE_OTRO`, canal, plazo) sin perder contenido; `crear_ticket_soporte`, `cliente_crear_ticket` y `responder_ticket_soporte` siguen funcionando (probado).
- Outbox de notificaciones (124) y su adaptador de Resend: se reutiliza el adaptador de correo. No hay segunda infraestructura de correo. La cola nueva (`cumplimiento_notificacion`) existe porque el outbox exige `usuario_id` y no puede escribir a destinos fijos.
- `consumir_cupo` (112, límite de tasa), Turnstile (`verificarTurnstile`), `autorizarSuperSU`, `trg_fila_inmutable`, repositorio de evidencias (146).
- La pantalla antigua `/admin/soporte` sigue existiendo (tickets heredados); el Centro la complementa.

## 2. Migraciones preparadas (no aplicadas en producción)
| N.º | Archivo | Contenido |
|---|---|---|
| 145, 146, 148 | copiadas **tal cual** de la rama de evidencias | aceptación legal solo servidor, repositorio de evidencias con hash encadenado, centro de evidencias SuperSU |
| 150 | `cumplimiento_catalogos_y_calendario` | 45 tipos de caso, catálogo de plazos versionado con estado de verificación, calendario de días hábiles de Colombia |
| 151 | `cumplimiento_casos` | ampliación del ticket, radicación pública, seguimiento por token, máquina de estados, historial append-only, acciones del SuperAdmin |
| 152 | `cumplimiento_notificaciones_y_sla` | configuración editable, cola de notificaciones (correo, CRM, SMS apagado), motor de SLA |
| 153 | `cumplimiento_evidencias` | eventos del caso → repositorio de evidencias (ajuste mínimo y aditivo) |
| 154 | `cumplimiento_adjuntos_y_consultas` | bucket privado, adjuntos, dashboard, bandejas, detalle |

### Numeración (verificada contra el historial real)
- `main` llega a la **144**. Producción tiene registradas hasta 140 (las 139/141/142 se aplicaron por el editor SQL y no figuran en `list_migrations`; 143 y 144 no figuran).
- La rama `feat/evidencias-legales` **no tiene commits propios** (está en el mismo commit que `main`): su trabajo (145–148) está **sin commitear** en su worktree. Por eso «integrar la rama» se hizo copiando 145/146/148 sin modificarlas (mismo contenido y mismo número: no habrá conflicto cuando se confirmen). **La 147** (invitación de Staff) es otra funcionalidad y no se trajo; las pruebas de evidencias (≈110 comprobaciones) pasan con y sin ella.
- La rama legal usa la **149** (textos legales). Mis migraciones empiezan en **150**.
- **Conflicto abierto:** el worktree `stylernow-cierre` tiene dos migraciones SIN commitear también numeradas **145** (MAINTAIN) y **146** (session_version) que chocan con las de evidencias. Deben renumerarse a **155 en adelante** antes de integrarse. No lo toqué.
- Orden de aplicación recomendado cuando llegue el momento: 143, 144, 145, 146, (147 si se decide), 148, 149 (solo con decisión legal), 150–154, y las de cierre renumeradas.

## 3. Auditoría de la rama de evidencias (145–148)
- Append-only: trigger de inmutabilidad (`trg_fila_inmutable`) + sin permisos de escritura para los roles de la API; **`service_role` solo lee**; escribe únicamente por funciones SECURITY DEFINER.
- Hash SHA-256 encadenado con candado asesor; `verificar_cadena_evidencias()` exige SuperSU, `service_role` o sesión directa del DBA.
- **Probado ahora:** alteré una fila como DBA y la verificación devolvió `CONTENIDO_ALTERADO`. Limitación declarada por esa rama y vigente: un DBA *puede* alterar; la cadena lo **detecta**, no lo impide.
- Compatibilidad con `main`: aplica sobre 144 sin errores. Mis cambios (153) relajan `usuario_id` (para solicitantes sin cuenta) y amplían tres CHECK (`categoria`, `rol`, `accion`); los hashes previos no cambian.
- Pendiente que esa rama ya reportó (decisión suya): el cron de registros abandonados no puede borrar cuentas con filas en `aceptacion_legal` tras 145.

## 4. Catálogo de casos
45 tipos en 6 categorías (A datos personales ×10, B consumidor ×11, C PQRS ×5, D seguridad ×6, E legal ×6, F operativo ×6). Cada uno: público o no, si pide documento (minimización), crítico, prioridad base, plazo interno, revisión jurídica pendiente. `LEGAL_AUTORIDAD` no es radicable por el público.

## 5. Catálogo de plazos y fuentes
| Tipo | Plazo | Estado | Fuente |
|---|---|---|---|
| Consulta de datos | 10 días hábiles, +5 | **Verificado** | Ley 1581/2012 art. 14 (lectura literal 2026-11-17, Función Pública) |
| Reclamo, actualización, rectificación, supresión, revocatoria, incumplimiento (datos) | 15 días hábiles, +8; subsanación a los 5 días; desistimiento a los 2 meses; «reclamo en trámite» en 2 días hábiles; traslado en 2 días hábiles | **Verificado** (la unidad de los «5 días» de subsanación se interpreta hábil — Ley 4/1913 art. 62 — y está marcada para confirmar con abogado) | Ley 1581 art. 15 |
| Copia de información / información sobre el tratamiento | 10 días hábiles | **Provisional** (asimilado a consulta) | Ley 1581 art. 14 por analogía |
| Consumidor (11 tipos) | 15 días hábiles | **Provisional**: no se confirmó que StylerNow sea el destinatario obligado frente al establecimiento | Ley 1480/2011 art. 58 (indicado por el propietario, no verificado literalmente) |
| Petición, queja, reclamo, sugerencia, legal, seguridad, operativo | sin plazo legal cargado | **Pendiente**: rige el plazo **interno** (incidentes 24–48 h) y la pantalla lo rotula «plazo interno (no es ley)» | — |

Los plazos son filas editables (versionadas); una regla «verificada» exige norma, artículo, URL, fecha y verificador (restricción en la base). La pantalla y los correos distinguen verificado / provisional / interno.
**Calendario:** festivos 2026–2035 calculados (Pascua + Ley Emiliani) y comparados a mano con 2026 y 2027; **no verificados contra el calendario oficial** (`verificado=false`, editables). Función única en la base (`sumar_dias_habiles`, `calcular_fecha_limite`); el frontend no recalcula plazos.

## 6. Qué hace el sistema
- **Radicación pública sin cuenta** (`/solicitudes`): Turnstile (falla cerrado en producción), honeypot, límite de tasa por IP (6/h) y por correo (4/día), validación, idempotencia, política confirmada y ligada a la versión, adjuntos (PDF/PNG/JPG por firma binaria, 5 MB, 3 archivos, PDF sin contenido activo, bucket privado). Devuelve número `SN-AAAA-NNNNNN`, plazo rotulado y enlace personal.
- **Seguimiento** (`/solicitudes/seguimiento`): token de 256 bits en el *fragmento* del enlace (no viaja al servidor ni al Referer); en la base solo su SHA-256; el número solo **no** basta; error idéntico para número inexistente o token errado; límites por IP y por número; «perdí mi enlace» responde siempre igual y rota el token.
- **Máquina de estados:** responder ≠ resolver ≠ cerrar. Un acuse nunca es respuesta de fondo (restricción en la base); resolver exige respuesta de fondo previa; cerrar exige resuelto, y los críticos exigen nota de cierre. Reapertura con plazo interno nuevo. Subsanación: el plazo de la norma se cuenta desde el reclamo completo; sin respuesta en 2 meses → desistimiento automático.
- **Prioridad:** CRÍTICA/ALTA/NORMAL/BAJA por tipo, avance del plazo y vencimiento; solo sube.
- **SLA / escalamiento** (`cumplimiento_evaluar_sla`, idempotente): 50 %, 75 %, T-24 h, T-4 h, vencido (+ recordatorio cada 24 h), sin asignar (60 min), sin movimiento (5 días), escalamiento automático al vencer; todo configurable.
- **Responsables:** el SuperSU es responsable y supervisor; un caso sin responsable aparece en «Sin asignar» y en «Todos»; un crítico sin responsable también en «Críticos». Responsables secundarios/equipos: la estructura admite `responsable_id` y `supervisor_id`; la UI de equipos queda para después.
- **Centro** `/admin/centro-cumplimiento`: tablero (abiertos, sin asignar, críticos, próximos, vencidos, pendientes, en investigación, por resolver/cerrar, por categoría/responsable/canal/mes), 11 bandejas, filtros, detalle con solicitante, fundamento del plazo, conversación (notas internas ocultas al solicitante), historial, adjuntos (enlace firmado de 60 s, descarga auditada), notificaciones y evidencias; acciones: asignar, estado, responder, pedir información, ampliar plazo, trasladar, escalar, resolver, cerrar, reabrir, nota. Al abrirlo evalúa el SLA.

## 7. Notificaciones y SMS
- Destinos en `cumplimiento_config` (editables desde el CRM, con validación y auditoría): **alertas** → `equipo@stylernow.com`; **remitente**, **atención al usuario** y **correo operativo** son claves separadas; **celular** `+57 3183943465` también es configuración (no está en el código). `cumplimiento@stylernow.com` se activa cambiando el valor, sin tocar código.
- **SMS: preparado y DESHABILITADO.** Hay adaptador por proveedor, plantillas, registro, reintentos, idempotencia y estado; el registro de proveedores está vacío y la base no deja encender `sms_habilitado` sin proveedor y referencia de credenciales (el secreto va en variable de entorno, no en la base). Mientras tanto cada alerta SMS queda registrada como **CANAL_NO_HABILITADO** (probado: cero SMS «enviados»). Las alertas críticas salen por correo y por el CRM.
- Alertas con datos mínimos (número, tipo, prioridad, fechas, estado, responsable, enlace): sin nombre, correo, documento ni contenido (probado).
- Correo: «ENVIADO» solo con id de Resend; reintentos con espera creciente hasta 5 y luego FALLIDO; el correo al solicitante (acuse, respuesta, prórroga, requerimiento, traslado) queda registrado y entra a evidencias.

## 8. Evidencias
Cada hecho relevante (radicación, acuse/envíos, respuesta de fondo con su texto, subsanación, prórroga, traslado, desistimiento, resuelto, cerrado, reabierto, adjuntos) se copia al repositorio hash-encadenado por trigger. **No se guarda el contenido de la solicitud ni datos del solicitante** (probado); el solicitante sin cuenta figura con rol `EXTERNO`. Aviso de retención: la política de conservación sigue pendiente y estas evidencias no se borran en cascada.

## 9. Cookies, analítica y solo Colombia
- Cookies: el banner no premarca nada («solo necesarias» tiene el mismo peso que «aceptar»); la analítica de Vercel y SpeedInsights **no se montan** sin elección afirmativa (`analitica.tsx`) y reaccionan al evento de elección. Sin cambios: ya cumplía. **No verificado:** que revocar en `/privacidad` apague de inmediato lo ya cargado en la sesión; que Sentry y Turnstile (necesarios/seguridad) estén descritos en la política (están en la Política v3 §2).
- Solo Colombia: nuevo `paises-habilitados.ts` (defecto `CO`, ampliable por `NEXT_PUBLIC_PAISES_HABILITADOS`). Se filtra `listarPaisesActivos()` (onboarding y página comercial) y el selector de ajustes. La arquitectura multipaís, la validación del servidor y el panel de planes del SuperAdmin se mantienen. No se cambió ningún dato de producción.

## 10. Pruebas (locales)
- SQL `tests/sql/cumplimiento_150_155.sql`: **139 comprobaciones** (calendario y festivos, plazos, permisos/ACL, radicación con y sin cuenta, idempotencia, validaciones, minimización, token, consulta y enumeración, RLS con intruso/cliente/SuperSU, flujo completo responder/resolver/cerrar/reabrir, críticos, prórroga, traslado, subsanación y desistimiento, SLA e idempotencia, escalamiento, cola y reintentos, configuración, compatibilidad con tickets existentes, notas internas, dashboard/bandejas, adjuntos, inmutabilidad, evidencias y cadena).
- Suite de evidencias de esa rama (≈110) pasa sobre mis migraciones (con 147 aplicada en una copia).
- Suites previas sobre la base con todo aplicado: 20 de 22 OK. **Fallan 2 por causas ajenas a este trabajo:** `directiva_116_118` (la prueba de `main` espera el estado anterior a la mora con gracia; el worktree de cierre ya la actualizó) y la de evidencias sin 147 (columna de 147). Dos regresiones **que yo había causado** (índices de llaves foráneas y dos funciones internas expuestas) se corrigieron y las suites `rendimiento_131` y `seguridad_regresion` pasan.
- TypeScript: `tsc` sin errores; ESLint limpio en lo nuevo; Vitest 126 pasan (16 nuevas: token, número, archivos maliciosos, SMS apagado, plantillas, solo Colombia); `check-auth-coverage` OK; `next build --webpack` OK; servidor de producción local: `/solicitudes` y `/solicitudes/seguimiento` responden 200 sin sesión y `/admin/centro-cumplimiento` redirige al login; contrato de 44 llamadas RPC contra las firmas de la base: 0 diferencias.
- **No se hizo** (declarado): prueba de extremo a extremo con Turnstile, Resend y Storage reales; prueba de carga; antivirus; el arnés dinámico de autorización de Server Actions no se re-ejecutó con las acciones nuevas.

## 11. Riesgos y pendientes
- **Cron diario:** `vercel.json` solo permite ejecutar una vez al día en el plan actual; las alertas T-24 h/T-4 h dependen de que el SuperAdmin abra el Centro (evalúa al abrir) o de pasar a un cron más frecuente con Vercel Pro.
- Sin antivirus para adjuntos (reducción de superficie, no escaneo).
- Límite de tasa **falla abierto** si la base de límites falla (para no impedir un reclamo legítimo); Turnstile sí falla cerrado en producción.
- Radicación con cuenta: queda ligada al usuario, pero la pantalla de «mis solicitudes» del cliente sigue siendo la antigua.
- Plazos de Ley 1480, derecho de petición, incidentes ante la SIC y festivos: **revisión de abogado / fuente oficial**.
- Tipo `SEG_*`/`LEGAL_AUTORIDAD`: la notificación a la SIC (política v3 §10) y los plazos de incidentes no están automatizados.
- Equipos, sustituciones temporales y supervisores múltiples: estructura lista, administración pendiente.
- Producción: **nada aplicado.** Antes: respaldo verificable (el plan Free no lo tiene; Supabase Pro), análisis de impacto, reversión (cada migración trae su bloque de reversión local) y autorización expresa.
- Las migraciones 151–155 y las de evidencias **no se aplican a producción sin autorización**; las de cierre (145/146) deben renumerarse a 155+.
