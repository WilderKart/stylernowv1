# Centro de Cumplimiento y PQRS — Fase 1 (auditoría) y Fase 3 (plan)

Fecha: 2026-11-17 · Solo lectura: no se modificó código, base de datos ni producción. Operadora: TAWILSTACK S.A.S. (NIT en trámite).

## 1. Estado real de lo que existe

| Área | Qué existe hoy (evidencia) | Brecha frente a lo pedido |
|---|---|---|
| Tickets | `ticket_soporte` + `ticket_mensaje` (mig. 029): estados ABIERTO / EN_PROCESO / RESUELTO; creación y respuesta por RPC SECURITY DEFINER; RLS solo SELECT; UI en `/panel/soporte` y `/admin/soporte`; cambio de estado auditado en `evento_auditoria` | Sin categoría jurídica, tipo (petición/queja/reclamo/datos), norma, plazo, fecha límite, SLA, prioridad, responsable asignado, canal, escalamiento, reapertura formal, ni distinción responder / resolver / cerrar. Solo lo crean usuarios con sesión: un consumidor sin cuenta no puede radicar |
| Datos personales (Ley 1581) | `solicitud_cuenta` (mig. 099): exportación y eliminación con 14 días de gracia; Centro de privacidad `/privacidad`; `consentimiento_evento` (mig. 091) | No hay radicación de consultas ni reclamos de datos (actualizar, rectificar, revocar) con plazo 10/15 días hábiles |
| Notificaciones | Outbox durable (mig. 124): EMAIL (Resend), PUSH, PANEL; idempotencia, reintentos, historial `notificacion_outbox_evento`; ENVIADO exige id del proveedor. WhatsApp en módulo propio (`src/lib/whatsapp`) | **No hay canal SMS.** El outbox solo notifica a usuarios (`usuario_id` obligatorio): no soporta destinos fijos (el celular +57 3183943465 ni el correo oficial). Sin alertas por vencimiento |
| Evidencias | Línea paralela en `stylernow-evidencias` (migs. 145–148: aceptación solo servidor, repositorio append-only con hash encadenado, centro de evidencias SuperSU). **Sin integrar a `main`** | No duplicar: el centro de evidencias de tickets debe reutilizar ese repositorio |
| Aceptación legal | `texto_legal` / `aceptacion_legal` (mig. 004); aceptación por reserva (116); textos v3 y migración 149 listas, sin aplicar | Separar consentimientos en la UI (pendiente), ver `TEXTOS_UI_CONSENTIMIENTO.md` |
| Cookies | Banner funcional (`banner-cookies.tsx`, sin premarcar, guarda elección) y `analitica.tsx` | Verificar que la analítica no cargue antes del consentimiento y documentar los SDK (Sentry, Turnstile) |
| Solo Colombia | Onboarding con referencias a otros países (12 coincidencias en wizard/page) | Auditar qué es visible y ocultarlo sin quitar la arquitectura |
| Pagos | Cobro directo al negocio, comisión 0 % (Directiva 2026-11-12) | Los documentos de pagos deben describir ese modelo; no tocar el modelo financiero |

Ya cubierto por el trabajo legal: Términos v4 y Política v3 (149 sin aplicar), auditoría normativa, estado de documentos, textos UI.

## 2. Hallazgos de riesgo (ordenados)

1. **Crítico para el lanzamiento:** no existe un canal para que un consumidor sin cuenta o un titular radique una reclamación con fecha cierta; los plazos de la Ley 1581 (consulta 10 días hábiles + 5; reclamo 15 + 8) y de la Ley 1480 corren desde la recepción y hoy nadie los controla.
2. El outbox no puede enviar a destinos fijos ni por SMS; sin eso la notificación inmediata pedida es imposible sin ampliar la infraestructura.
3. Dos líneas de trabajo se solapan: evidencias (145–148) y cierre/legal (145, 146, 149). Hay que renumerar antes de añadir migraciones nuevas.
4. Los Términos prometen PQR en 15 días hábiles (§23): es un compromiso que el sistema debe poder cumplir y demostrar.

## 3. Plazos: lo verificado y lo que no

- Verificado (2026-11-17, Función Pública): Ley 1581 art. 14 consulta 10 días hábiles prorrogables 5; art. 15 reclamo 15 días hábiles prorrogables 8, subsanación a los 5 días, desistimiento a los 2 meses, leyenda «reclamo en trámite» en 2 días hábiles.
- NO verificado y por tanto **no se implementa como dato fijo**: plazos de la Ley 1480 (petición/queja/reclamo de consumidor, garantía, retracto arts. 47 y ss.), derecho de petición (Ley 1755/2015), solicitudes de autoridad. Se cargan como configuración con campo «fuente verificada = no» hasta que un abogado o una lectura literal los confirme. Los plazos viven en una tabla configurable, no en el código.

## 4. Diseño propuesto (por grupos, migraciones pequeñas)

Todo extiende lo existente; no se crea un segundo sistema de tickets.

- **Grupo A — Catálogo y plazos (mig. 150):** `tipo_caso_pqrs` (código, nombre, norma, artículo, fuente, plazo, unidad hábil/calendario, inicio de conteo, prórroga, verificado, prioridad base). Solo lectura salvo SuperSU vía RPC auditada.
- **Grupo B — Extensión del ticket (mig. 151):** columnas nuevas en `ticket_soporte`: tipo_caso, canal, prioridad, responsable, fecha_recepcion, fecha_limite, estado_legal (RECIBIDO … RESPONDIDO, RESUELTO, CERRADO, REABIERTO), `respondido_at`, `resuelto_at`, `cerrado_at`. Historial append-only de transiciones. Radicación pública por RPC con Turnstile y limitación de tasa para quien no tiene cuenta; consecutivo legible (ej. PQ-2026-000123).
- **Grupo C — Calendario hábil Colombia (mig. 152):** tabla de festivos y función de suma de días hábiles; prueba contra casos conocidos.
- **Grupo D — SLA y escalamiento (job en el cron diario/horario):** alertas configurables al crear, 50 %, 75 %, 24 h, 4 h, vencimiento; subir prioridad automática; escalar sin asignar; cada acción al historial.
- **Grupo E — Notificaciones:** ampliar el outbox para destinos fijos (tabla de destinatarios de cumplimiento configurable, sin inventar correo: se toma de variable de entorno y queda «pendiente de configuración» si falta) y canal SMS detrás de adaptador «no habilitado» hasta elegir proveedor. Mensaje sin datos personales: ID, tipo, prioridad, vencimiento y enlace seguro. Reintentos y resultado ya existen.
- **Grupo F — Evidencias:** vincular adjuntos y eventos del ticket al repositorio append-only de la rama de evidencias (esperar su integración).
- **Grupo G — UI «Centro de Cumplimiento y PQRS» en `/admin`:** tarjetas Tickets abiertos, Próximos vencimientos, Vencidos, Cumplimiento (documentos, evidencias, obligaciones); filtros; asignar; escalar; responder; cerrar.
- **Grupo H — Pruebas y seguridad:** harness de autorización existente (actores intruso/cliente/dueño/super), RLS, vencimientos, idempotencia, reintentos.

Orden: A → C → B → G (lectura) → D → E → F → H. Cada grupo reversible; sin tocar producción.

## 5. Decisiones que necesito del propietario (no las asumo)

1. ¿SMS: qué proveedor? (hoy no hay ninguno; el código puede quedar listo y deshabilitado).
2. ¿Correo oficial de cumplimiento? Hoy el remitente es notificaciones@mail.stylernow.com y los textos legales usan equipo@stylernow.com.
3. ¿Quién es el responsable y el supervisor de escalamiento? (hoy solo hay un SuperSU).
4. ¿Integrar primero la rama de evidencias (145–148) a `main` y renumerar las migraciones, o construir los tickets sobre la estructura actual y enlazar después?
5. Autorización para empezar por el Grupo A–C (solo base de datos local y pruebas, sin producción).

## 6. Pendientes que requieren abogado o información empresarial

Plazos de la Ley 1480 y de derecho de petición; qué casos son «reclamo de consumidor» frente a «petición»; retención de tickets; NIT; manual interno de datos (art. 17 k).
