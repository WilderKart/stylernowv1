# 08 — QA: Notifications

## Objetivo
Casos de prueba del catálogo completo de notificaciones — disparador, destinatario, canal — y sus reglas de frecuencia/consentimiento.

## Alcance
Pruebas de disparo, contenido y canal de cada notificación de `02-UX/11_Notifications.md`. Formato: ID | Caso | Resultado esperado | Fuente.

## Reglas — Casos de prueba

### Notificaciones al Cliente (QA-NOT-001 a 035)
| ID | Caso | Resultado esperado | Fuente |
|---|---|---|---|
| QA-NOT-001 | Reserva confirmada (pago aprobado) | Push + email enviados | `02-UX/11_Notifications.md` |
| QA-NOT-002 | Recordatorio 24h antes | Push + WhatsApp si habilitado | `02-UX/11_Notifications.md` |
| QA-NOT-003 | Recordatorio 24h, Negocio sin WhatsApp habilitado | Solo push | `02-UX/11_Notifications.md` |
| QA-NOT-004 | Recordatorio 2h antes | Solo push | `02-UX/11_Notifications.md` |
| QA-NOT-005 | Reserva cancelada por el Negocio | Push + WhatsApp + email | `02-UX/11_Notifications.md` |
| QA-NOT-006 | Reserva reprogramada | Push | `02-UX/11_Notifications.md` |
| QA-NOT-007 | No-show marcado (Cliente) | Push informativo con detalle de retención de Seña | `02-UX/11_Notifications.md` |
| QA-NOT-008 | No-show marcado (Staff) | Push + WhatsApp con opción de reagendar sin costo | `02-UX/11_Notifications.md` |
| QA-NOT-009 | Cupo de Lista de espera liberado | Push + WhatsApp, ventana de 15 min visible | `03-Business-Rules/10_Waitlist_System.md` |
| QA-NOT-010 | Puntos a 30 días de expirar | Push enviado exactamente a los 30 días | `03-Business-Rules/04_Lealtad.md` |
| QA-NOT-011 | Puntos a 29 o 31 días de expirar | No se envía (solo a los 30 exactos) | `03-Business-Rules/04_Lealtad.md` |
| QA-NOT-012 | Cliente desactiva notificaciones promocionales | Transaccionales siguen llegando | `02-UX/11_Notifications.md` |
| QA-NOT-013 | Cliente intenta desactivar notificación transaccional | No disponible en configuración | `02-UX/11_Notifications.md` |
| QA-NOT-014 | Cliente sin permiso de push | Eventos caen a centro de notificaciones in-app | `02-UX/11_Notifications.md` |
| QA-NOT-015 | Evento crítico sin push habilitado | Cae también a email | `02-UX/11_Notifications.md` |
| QA-NOT-016 | Canal WhatsApp sin consentimiento del Cliente | No se usa ese canal | `02-UX/11_Notifications.md` |
| QA-NOT-017 | Canal WhatsApp con consentimiento y Plan Jarl+ | Se usa correctamente | `02-UX/11_Notifications.md` |
| QA-NOT-018 | Negocio Plan Raven intenta usar WhatsApp | No disponible (funcionalidad de Jarl+) | `01-PRD/03_Monetization.md` |
| QA-NOT-019 | Fallo de entrega de push en ventana de Lista de espera | WhatsApp como canal secundario mitiga | `02-UX/11_Notifications.md` |
| QA-NOT-020 | Recomendación de IA enviada como campaña | Requiere confirmación previa de la Barbería | `09-CRM-Intelligence/04_AI_Business.md` |
| QA-NOT-021 | Cliente con Membresía suspendida por impago | Notificado el mismo día del fallo | `08-Growth-Monetization/05_Billing_Failures.md` |
| QA-NOT-022 | Notificación de cumpleaños del Cliente | Enviada en el mes correspondiente | `03-Business-Rules/04_Lealtad.md` |
| QA-NOT-023 | Notificación duplicada por reintento de evento | No se envía dos veces (idempotencia) | `05-API/06_Webhooks.md` |
| QA-NOT-024 | Cliente cambia de teléfono | Notificaciones siguen llegando al nuevo canal verificado | `03-Business-Rules/07_CRM.md` |
| QA-NOT-025 | Cliente con dos Negocios activos recibe notificaciones cruzadas | Cada notificación indica el Negocio correspondiente sin mezclar | `03-Business-Rules/01_Roles.md` |
| QA-NOT-026 | Reserva confirmada, Cliente sin email registrado | Solo push, sin error silencioso | `02-UX/11_Notifications.md` |
| QA-NOT-027 | Propina disponible tras Reserva completada | Notificación con acceso directo a agregarla | `02-UX/06_Payments.md` |
| QA-NOT-028 | Cliente en riesgo de bloqueo por 3er strike | Notificado del cambio de condición de pago | `03-Business-Rules/09_No_Show_Policy.md` |
| QA-NOT-029 | Notificación con contenido dinámico de IA (recomendación) | Contenido corresponde a la instancia del Cliente correcta | `09-CRM-Intelligence/02_AI_Client.md` |
| QA-NOT-030 | Notificación enviada fuera de horario razonable (ej. 3am) | Reglas de horario de envío respetadas (Decisión abierta si no definida, se documenta) | `02-UX/11_Notifications.md` |
| QA-NOT-031 | Cliente revoca consentimiento de marketing | Excluido de campañas subsiguientes de inmediato | `06-Security/04_Compliance_Colombia.md` |
| QA-NOT-032 | Recordatorio 24h para Reserva creada con menos de 24h de anticipación | No se duplica un recordatorio que ya no aplica | `02-UX/11_Notifications.md` |
| QA-NOT-033 | Reserva reprogramada a un horario con menos de 2h | Recordatorio de 2h se reprograma correctamente | `02-UX/11_Notifications.md` |
| QA-NOT-034 | Fallo del proveedor de push (caída general) | Se registra, fallback a email para eventos críticos | `02-UX/11_Notifications.md` |
| QA-NOT-035 | Notificación con texto sensible (ej. monto de reembolso) | Solo visible al destinatario correcto | `06-Security/01_Security_Model.md` |

### Notificaciones a Staff, Negocio y SuperSU (QA-NOT-036 a 075)
| ID | Caso | Resultado esperado | Fuente |
|---|---|---|---|
| QA-NOT-036 | Nueva cita asignada al Staff | Push enviado | `02-UX/11_Notifications.md` |
| QA-NOT-037 | Cambio/cancelación de una cita propia del Staff | Push enviado | `02-UX/11_Notifications.md` |
| QA-NOT-038 | Staff alcanza Nivel EXPERT | Push enviado | `02-UX/11_Notifications.md` |
| QA-NOT-039 | Staff alcanza Nivel MASTER | Push enviado | `02-UX/11_Notifications.md` |
| QA-NOT-040 | Staff degradado al cierre de temporada | Notificado del nuevo nivel de arranque | `03-Business-Rules/05_Staff_Rewards.md` |
| QA-NOT-041 | Evento especial de doble puntos anunciado | Staff notificado con 3+ días de anticipación | `03-Business-Rules/05_Staff_Rewards.md` |
| QA-NOT-042 | Fallo de cobro de suscripción (Día 1) | Barbería notificado por email + push | `08-Growth-Monetization/05_Billing_Failures.md` |
| QA-NOT-043 | Fallo de cobro (Día 7) con advertencia de suspensión | Notificación distinta de la del Día 1 | `08-Growth-Monetization/05_Billing_Failures.md` |
| QA-NOT-044 | Negocio suspendido | Barbería notificado por email + push | `08-Growth-Monetization/04_Subscriptions_Lifecycle.md` |
| QA-NOT-045 | Negocio reactivado | Barbería notificado | `08-Growth-Monetization/04_Subscriptions_Lifecycle.md` |
| QA-NOT-046 | Nueva solicitud de Negocio pendiente | SuperSU notificado (email + panel interno) | `02-UX/10_Super_Admin.md` |
| QA-NOT-047 | Reseña reportada | SuperSU notificado en panel interno | `02-UX/10_Super_Admin.md` |
| QA-NOT-048 | Cupo de Lista de espera no confirmado a tiempo | Barbería ve el cupo liberado de nuevo | `03-Business-Rules/10_Waitlist_System.md` |
| QA-NOT-049 | Cierre de caja con discrepancia | Registro visible, sin notificación automática innecesaria | `02-UX/09_Business_Panel.md` |
| QA-NOT-050 | Campaña publicitaria agota presupuesto | Barbería notificado | `08-Growth-Monetization/06_Advertising_System.md` |
| QA-NOT-051 | Insight de IA de negocio generado (ocupación/riesgo) | Visible en panel, no como push intrusivo | `09-CRM-Intelligence/04_AI_Business.md` |
| QA-NOT-052 | Ningún rol de producto envía notificación fuera del catálogo | Verificado — bloqueado a nivel de API | `02-UX/11_Notifications.md` |
| QA-NOT-053 | Guardian recibe notificaciones solo de su Sede | Alcance correcto | `03-Business-Rules/01_Roles.md` |
| QA-NOT-054 | Barbería recibe notificaciones de todas sus Sedes | Alcance correcto | `03-Business-Rules/01_Roles.md` |
| QA-NOT-055 | Staff recibe notificación de reincidencia de No-show propio | Visible como alerta en su panel de rendimiento (si aplica) | `03-Business-Rules/09_No_Show_Policy.md` |
| QA-NOT-056 | Ticket de soporte cambia de estado | Notificación al Negocio que lo creó | `02-UX/10_Super_Admin.md` |
| QA-NOT-057 | Cierre de Sede con Staff sin reasignar | Alerta a la Barbería antes de los 30 días de plazo | `08-Growth-Monetization/04_Subscriptions_Lifecycle.md` |
| QA-NOT-058 | Webhook huérfano detectado | Alerta interna a soporte técnico | `05-API/06_Webhooks.md` |
| QA-NOT-059 | Incidente de disponibilidad detectado | Banner en Panel Negocio/App Staff dentro de 30 min | `10-Operations/03_Disaster_Recovery.md` |
| QA-NOT-060 | Incidente resuelto | Banner se retira, notificación de cierre | `10-Operations/03_Disaster_Recovery.md` |
| QA-NOT-061 | Nuevo texto legal publicado | Notificación de re-aceptación requerida | `06-Security/04_Compliance_Colombia.md` |
| QA-NOT-062 | Feature flag activado por ciudad | Comunicado en la UI, no como spam de notificación | `10-Operations/01_Feature_Flags.md` |
| QA-NOT-063 | Comisión global modificada por SuperSU | No genera notificación directa al Negocio (visible en Configuración) | `02-UX/10_Super_Admin.md` |
| QA-NOT-064 | Staff invitado no acepta en 7 días | Sin notificación de "expiración" innecesaria más allá del recordatorio inicial | `02-UX/02_Onboarding.md` |
| QA-NOT-065 | Reintento de webhook saliente fallido (Allfather) | Expuesto en panel de eventos no entregados | `05-API/06_Webhooks.md` |
| QA-NOT-066 | Notificación de aprobación de Negocio | Enviada inmediatamente tras la decisión de SuperSU | `02-UX/10_Super_Admin.md` |
| QA-NOT-067 | Notificación de rechazo de Negocio | Enviada con motivo | `02-UX/10_Super_Admin.md` |
| QA-NOT-068 | Correlación de notificación con `request_id` del evento origen | Rastreable en logs técnicos | `10-Operations/04_Logs_Policy.md` |
| QA-NOT-069 | Notificación enviada a un usuario con sesión cerrada | Se entrega igual vía canal push/email fuera de sesión activa | `02-UX/11_Notifications.md` |
| QA-NOT-070 | Volumen alto de notificaciones simultáneas (ej. cierre de Sede masivo) | Todas se entregan sin pérdida | `08-Growth-Monetization/04_Subscriptions_Lifecycle.md` |
| QA-NOT-071 | Notificación con datos de otro Negocio filtrados por error | Nunca ocurre, verificado con prueba de aislamiento | `06-Security/02_RLS.md` |
| QA-NOT-072 | Plantilla de notificación con variable faltante (ej. nombre de Staff) | Nunca se envía con placeholder roto visible | `02-UX/11_Notifications.md` |
| QA-NOT-073 | Notificación de Evento especial retirada antes de tiempo | Comunicado si el evento se cancela | `03-Business-Rules/05_Staff_Rewards.md` |
| QA-NOT-074 | Consentimiento de datos sensibles capturado en el momento de una notificación con foto | Registrado explícitamente | `03-Business-Rules/07_CRM.md` |
| QA-NOT-075 | Auditoría de todo envío de notificación transaccional | Trazable a su disparador de origen | `04-Data-Model/04_Audit.md` |

## Estados
No aplica una máquina de estados propia — se valida el disparo correcto sobre transiciones ya definidas en `04-Data-Model/03_State_Machines.md`.

## Permisos
Casos verifican que ningún rol reciba una notificación fuera de su propio alcance de datos.

## Dependencias
Depende de `02-UX/11_Notifications.md` y de todo documento fuente de cada disparador.

## Casos límite
Derivados directamente de las fuentes citadas.

## Criterios de aceptación
- [ ] 100% de los 75 casos tienen Fuente verificable.
- [ ] Ninguna notificación transaccional se pierde bajo volumen alto simultáneo.

## Checklist
- [x] Completo (75 casos)
- [ ] Revisado
