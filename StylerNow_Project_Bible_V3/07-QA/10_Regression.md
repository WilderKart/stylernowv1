# 10 — QA: Regression Suite

## Objetivo
Suite de regresión transversal: aislamiento multi-tenant, transiciones de estado inválidas, journeys E2E cross-superficie, versionado de API, seguridad, rendimiento, resiliencia, PWA/offline, consistencia de KPIs, smoke test de release, cumplimiento normativo, genericidad multi-vertical, auditoría y condiciones de carrera. Es la suite que se ejecuta completa antes de cualquier release (`10-Operations/05_Release_Process.md`) y en versión reducida (smoke) inmediatamente después.

## Alcance
Casos que cruzan más de un documento de dominio o más de una superficie. Formato: ID | Caso | Resultado esperado | Fuente.

## Reglas — Casos de prueba

### Aislamiento multi-tenant / RLS (QA-REG-001 a 025)
| ID | Caso | Resultado esperado | Fuente |
|---|---|---|---|
| QA-REG-001 | Barbería A consulta `reserva` de Negocio B por id directo | Acceso denegado | `06-Security/02_RLS.md` |
| QA-REG-002 | Staff de Negocio A consulta CRM de Negocio B | Acceso denegado | `06-Security/02_RLS.md` |
| QA-REG-003 | Cliente consulta `pago` de otro Cliente | Acceso denegado | `06-Security/02_RLS.md` |
| QA-REG-004 | Guardian consulta datos de otra Sede del mismo Negocio | Acceso denegado según alcance | `03-Business-Rules/01_Roles.md` |
| QA-REG-005 | Negocio A intenta modificar `servicio` de Negocio B vía API | `403 FORBIDDEN` | `06-Security/02_RLS.md` |
| QA-REG-006 | Token con `negocio_id` manipulado en el payload (no en el JWT) | Rechazado, se usa el del token verificado | `05-API/02_Auth.md` |
| QA-REG-007 | Staff consulta `puntaje_staff_evento` de otro Staff del mismo Negocio | Acceso denegado | `06-Security/02_RLS.md` |
| QA-REG-008 | Barbería consulta configuración de plataforma (comisión global) en modo escritura | Acceso denegado, solo SuperSU | `06-Security/02_RLS.md` |
| QA-REG-009 | Tabla nueva desplegada sin política de RLS declarada | Bloqueada de acceso hasta declarar política | `06-Security/02_RLS.md` |
| QA-REG-010 | Migración de mantenimiento cross-tenant vía rol de servicio de infraestructura | Ejecutada auditada, nunca con credenciales de usuario de producto | `06-Security/02_RLS.md` |
| QA-REG-011 | Cliente consulta `evento_auditoria` de un Negocio | Acceso denegado | `06-Security/02_RLS.md` |
| QA-REG-012 | SuperSU sin modo impersonación activo consulta datos internos de un Negocio | Acceso denegado (requiere impersonación auditada) | `03-Business-Rules/01_Roles.md` |
| QA-REG-013 | Negocio A consulta reseñas de Negocio B (privadas si aplica) | Solo `VISIBLE` públicas accesibles, resto denegado | `06-Security/02_RLS.md` |
| QA-REG-014 | Staff con vínculo a 2 Negocios, sesión en contexto A, intenta leer datos de B | Denegado sin cambiar de contexto | `05-API/02_Auth.md` |
| QA-REG-015 | Cliente consulta `wallet` de un Negocio | Acceso denegado | `06-Security/02_RLS.md` |
| QA-REG-016 | Barbería consulta `puntaje_staff_evento` de Staff de otro Negocio | Acceso denegado | `06-Security/02_RLS.md` |
| QA-REG-017 | Query de reportes agregados de plataforma ejecutada como Barbería | Retorna solo su propio alcance, nunca agregado global | `06-Security/02_RLS.md` |
| QA-REG-018 | Fuga de datos vía mensaje de error verboso (ej. reference a otro `negocio_id`) | Ningún error expone datos de otro tenant | `05-API/01_Standards.md` |
| QA-REG-019 | Cliente consulta perfil CRM completo de un Negocio como si fuera Barbería | Acceso denegado | `03-Business-Rules/07_CRM.md` |
| QA-REG-020 | Prueba de fuzzing de `negocio_id` secuenciales sobre endpoints protegidos | Ninguno filtra datos ajenos | `06-Security/02_RLS.md` |
| QA-REG-021 | Staff intenta modificar `comision_pct` de su propio vínculo | Acceso denegado (solo Barbería) | `03-Business-Rules/01_Roles.md` |
| QA-REG-022 | Cliente intenta modificar el estado de una Reserva ajena | Acceso denegado | `06-Security/02_RLS.md` |
| QA-REG-023 | Verificación de aislamiento tras un cambio de esquema reciente | Política de RLS sigue activa post-migración | `10-Operations/02_Migration_Strategy.md` |
| QA-REG-024 | Acceso de un rol degradado (Staff `RETIRADO`) a la agenda de su antiguo Negocio | Denegado | `04-Data-Model/03_State_Machines.md` |
| QA-REG-025 | Acceso de un Negocio `CANCELADO` a su propio Panel | Solo lectura histórica, sin operación nueva | `08-Growth-Monetization/04_Subscriptions_Lifecycle.md` |

### Transiciones de estado inválidas (QA-REG-026 a 055)
| ID | Caso | Resultado esperado | Fuente |
|---|---|---|---|
| QA-REG-026 | Reserva `COMPLETADA` → `CONFIRMADA` | Rechazado | `04-Data-Model/03_State_Machines.md` |
| QA-REG-027 | Reserva `CANCELADA` → `EN_CURSO` | Rechazado | `04-Data-Model/03_State_Machines.md` |
| QA-REG-028 | Reserva `NO_SHOW` → `COMPLETADA` | Rechazado | `04-Data-Model/03_State_Machines.md` |
| QA-REG-029 | Pago `RECHAZADO` → `APROBADO` sin nuevo intento de cobro | Rechazado | `04-Data-Model/03_State_Machines.md` |
| QA-REG-030 | Pago `REEMBOLSADO` → `APROBADO` | Rechazado | `04-Data-Model/03_State_Machines.md` |
| QA-REG-031 | Vínculo Staff-Negocio `RETIRADO` → `ACTIVO` directo | Rechazado, requiere nuevo vínculo | `04-Data-Model/03_State_Machines.md` |
| QA-REG-032 | Negocio `RECHAZADO` → `ACTIVO` directo | Rechazado, requiere nueva solicitud | `04-Data-Model/03_State_Machines.md` |
| QA-REG-033 | Negocio `CANCELADO` → `ACTIVO` | Rechazado (terminal) | `04-Data-Model/03_State_Machines.md` |
| QA-REG-034 | Suscripción `CANCELADA` → `ACTIVA` directo | Rechazado, requiere nueva suscripción | `04-Data-Model/03_State_Machines.md` |
| QA-REG-035 | Campaña `FINALIZADA` → `ACTIVA` | Rechazado | `04-Data-Model/03_State_Machines.md` |
| QA-REG-036 | Campaña `AGOTADA` → `ACTIVA` sin recarga de presupuesto | Rechazado | `04-Data-Model/03_State_Machines.md` |
| QA-REG-037 | Lista de espera `CONVERTIDA` → `ACTIVA` | Rechazado (terminal) | `04-Data-Model/03_State_Machines.md` |
| QA-REG-038 | Lista de espera `EXPIRADA_FECHA` → `NOTIFICADA` | Rechazado | `04-Data-Model/03_State_Machines.md` |
| QA-REG-039 | Temporada `CONSOLIDADA` → `EN_CURSO` | Rechazado (terminal) | `04-Data-Model/03_State_Machines.md` |
| QA-REG-040 | Reseña `ELIMINADA` → `VISIBLE` sin decisión de SuperSU | Rechazado | `04-Data-Model/03_State_Machines.md` |
| QA-REG-041 | Todas las transiciones válidas de Reserva ejecutadas en secuencia correcta | Cada una exitosa en orden | `04-Data-Model/03_State_Machines.md` |
| QA-REG-042 | Todas las transiciones válidas de Pago ejecutadas en secuencia correcta | Cada una exitosa en orden | `04-Data-Model/03_State_Machines.md` |
| QA-REG-043 | Transición forzada vía escritura directa a base de datos (bypass de API) | Bloqueada por constraint/trigger a nivel de esquema | `04-Data-Model/03_State_Machines.md` |
| QA-REG-044 | Reserva con dos transiciones simultáneas válidas en condición de carrera (check-in vs. corte de No-show) | Gana la que se procesa primero en la cola de eventos | `04-Data-Model/03_State_Machines.md` |
| QA-REG-045 | Pago `EN_DISPUTA` → `REEMBOLSADO` por resolución de SuperSU | Válido, con auditoría | `04-Data-Model/03_State_Machines.md` |
| QA-REG-046 | Pago `EN_DISPUTA` → `APROBADO` por resolución de SuperSU | Válido, con auditoría | `04-Data-Model/03_State_Machines.md` |
| QA-REG-047 | Suscripción `ACTIVA` → `EN_MORA` → `ACTIVA` (pago recuperado antes de suspensión) | Secuencia válida completa | `08-Growth-Monetization/05_Billing_Failures.md` |
| QA-REG-048 | Suscripción `EN_MORA` → `SUSPENDIDA` → `ACTIVA` (reactivación) | Secuencia válida completa | `08-Growth-Monetization/04_Subscriptions_Lifecycle.md` |
| QA-REG-049 | Membresía `ACTIVA` → `SUSPENDIDA_POR_IMPAGO` → `CANCELADA` | Secuencia válida completa | `08-Growth-Monetization/05_Billing_Failures.md` |
| QA-REG-050 | Vínculo Staff-Negocio `INVITADO` → `ACTIVO` → `SUSPENDIDO` → `ACTIVO` | Secuencia válida completa | `03-Business-Rules/01_Roles.md` |
| QA-REG-051 | Todo estado terminal verificado sin arista de salida en el código | Ninguna transición posterior | `04-Data-Model/03_State_Machines.md` |
| QA-REG-052 | Reserva `PENDIENTE_PAGO` → `CANCELADA` por expiración vs. por rechazo de pago | Ambos caminos llevan al mismo estado final correctamente | `04-Data-Model/03_State_Machines.md` |
| QA-REG-053 | Campaña `BORRADOR` → `ACTIVA` sin presupuesto | Rechazado | `08-Growth-Monetization/06_Advertising_System.md` |
| QA-REG-054 | Negocio `PENDIENTE_APROBACION` → `SUSPENDIDO` directo | Rechazado (debe pasar por `ACTIVO` primero) | `04-Data-Model/03_State_Machines.md` |
| QA-REG-055 | Reserva con Recurso: transición bloqueada si el Recurso pasa a `FUERA_DE_SERVICIO` a mitad de proceso | Comportamiento consistente con caso límite documentado | `04-Data-Model/02_Relationships.md` |

### Journeys E2E cross-superficie (QA-REG-056 a 080)
| ID | Caso | Resultado esperado | Fuente |
|---|---|---|---|
| QA-REG-056 | Cliente reserva → Staff check-in → check-out → Barbería ve reporte actualizado | Consistente en las 3 superficies | `02-UX/01_User_Journeys.md` |
| QA-REG-057 | Cliente cancela → Staff ve agenda actualizada → Barbería ve reembolso en reportes | Consistente | `02-UX/01_User_Journeys.md` |
| QA-REG-058 | Barbería invita Staff → Staff acepta → aparece en selección de Staff del Cliente | Consistente | `02-UX/01_User_Journeys.md` |
| QA-REG-059 | SuperSU aprueba Negocio → aparece en Marketplace del Cliente | Consistente, sin retraso de caché | `02-UX/01_User_Journeys.md` |
| QA-REG-060 | SuperSU suspende Negocio → desaparece del Marketplace → Staff ve Panel en solo lectura | Consistente en las 3 superficies | `02-UX/01_User_Journeys.md` |
| QA-REG-061 | Cliente deja reseña → aparece en perfil público → Barbería puede responder | Consistente | `02-UX/04_Marketplace.md` |
| QA-REG-062 | Cliente reporta reseña → SuperSU modera → cambio reflejado en Score | Consistente | `06-Security/03_Fraud.md` |
| QA-REG-063 | Staff alcanza MASTER → Cliente ve badge en selección de Staff → Score de Marketplace sube | Consistente | `03-Business-Rules/05_Staff_Rewards.md` |
| QA-REG-064 | Cliente se une a Lista de espera → cupo se libera → notificado → confirma → Reserva creada | Flujo E2E completo exitoso | `03-Business-Rules/10_Waitlist_System.md` |
| QA-REG-065 | Barbería crea campaña → aparece en Marketplace → Cliente hace clic → Reserva atribuida en reportes | Flujo E2E completo | `08-Growth-Monetization/06_Advertising_System.md` |
| QA-REG-066 | Fallo de cobro de suscripción → Negocio suspendido → Reservas futuras canceladas → Clientes notificados | Flujo E2E completo | `08-Growth-Monetization/05_Billing_Failures.md` |
| QA-REG-067 | Cliente paga Seña → webhook confirma → notificación → aparece en agenda del Staff | Flujo E2E completo | `05-API/06_Webhooks.md` |
| QA-REG-068 | No-show de Staff → reembolso automático → Cliente reagenda sin costo → nueva Reserva confirmada | Flujo E2E completo | `03-Business-Rules/09_No_Show_Policy.md` |
| QA-REG-069 | Cierre de temporada → nivel consolidado → siguiente temporada arranca con degradación correcta | Flujo E2E completo | `03-Business-Rules/05_Staff_Rewards.md` |
| QA-REG-070 | Cliente solicita eliminación de datos → CRM del Negocio anonimizado → registros fiscales preservados | Flujo E2E completo | `04-Data-Model/05_Data_Retention.md` |
| QA-REG-071 | Onboarding completo de un Negocio nuevo hasta su primera Reserva completada | Flujo E2E sin intervención manual fuera de la aprobación | `02-UX/02_Onboarding.md` |
| QA-REG-072 | Staff cambia de Sede → Barbería reasigna disponibilidad → Cliente ve nueva disponibilidad reflejada | Flujo E2E completo | `10-Operations/02_Migration_Strategy.md` |
| QA-REG-073 | Cliente compra Gift Card → la usa en una Reserva futura → saldo se descuenta correctamente | Flujo E2E completo | `03-Business-Rules/03_Payment_Rules.md` |
| QA-REG-074 | Insight de IA de horario muerto → Barbería activa Flash → Cliente reserva por la promoción | Flujo E2E completo | `09-CRM-Intelligence/04_AI_Business.md` |
| QA-REG-075 | Fraude de reseñas detectado → Score recalculado → Negocio pierde elegibilidad de Ads → SuperSU resuelve | Flujo E2E completo | `06-Security/03_Fraud.md` |
| QA-REG-076 | Cliente en riesgo de bloqueo por No-show → tercer strike → Reservas subsiguientes exigen pago total | Flujo E2E completo | `03-Business-Rules/09_No_Show_Policy.md` |
| QA-REG-077 | Negocio multi-sede cierra una Sede → cascada completa (Reservas, Lista de espera, Staff) | Flujo E2E completo | `08-Growth-Monetization/04_Subscriptions_Lifecycle.md` |
| QA-REG-078 | Upgrade de Plan → nuevas funcionalidades disponibles de inmediato en Panel Negocio | Flujo E2E completo | `08-Growth-Monetization/04_Subscriptions_Lifecycle.md` |
| QA-REG-079 | Propina agregada por Cliente → acreditada al Staff → visible en su App Staff | Flujo E2E completo | `08-Growth-Monetization/03_Tips_Distribution.md` |
| QA-REG-080 | Impersonación de SuperSU → resuelve un problema → sesión expira → auditoría completa visible a la Barbería afectado | Flujo E2E completo | `03-Business-Rules/01_Roles.md` |

### Versionado y compatibilidad de API (QA-REG-081 a 095)
| ID | Caso | Resultado esperado | Fuente |
|---|---|---|---|
| QA-REG-081 | Cliente app en versión de API anterior sigue funcionando durante periodo de transición | Sin ruptura | `05-API/01_Standards.md` |
| QA-REG-082 | Cambio aditivo (campo opcional nuevo) no requiere nueva versión | Verificado | `05-API/01_Standards.md` |
| QA-REG-083 | Cambio breaking requiere nueva versión | Verificado con prueba de contrato | `05-API/01_Standards.md` |
| QA-REG-084 | Versión retirada tras 12 meses responde `410 GONE` | Verificado | `05-API/01_Standards.md` |
| QA-REG-085 | Header `Deprecation`/`Sunset` presente antes del retiro | Verificado | `05-API/01_Standards.md` |
| QA-REG-086 | Formato de error estándar consistente en 100% de endpoints | Verificado por muestreo amplio | `05-API/01_Standards.md` |
| QA-REG-087 | Paginación por cursor consistente en toda colección | Verificado, sin `offset`/`page` | `05-API/01_Standards.md` |
| QA-REG-088 | Rate limit por rol aplicado correctamente | Verificado con carga simulada | `05-API/01_Standards.md` |
| QA-REG-089 | `429` incluye header `Retry-After` | Verificado | `05-API/01_Standards.md` |
| QA-REG-090 | Fechas transmitidas en ISO 8601 con offset explícito | Verificado en 100% de endpoints | `05-API/01_Standards.md` |
| QA-REG-091 | Montos transmitidos como enteros en pesos | Verificado | `05-API/01_Standards.md` |
| QA-REG-092 | Dos versiones de API coexistiendo durante rollout | Ambas responden correctamente | `10-Operations/05_Release_Process.md` |
| QA-REG-093 | Cliente Allfather con webhook saliente durante cambio de versión de API | Sin interrupción del webhook | `05-API/06_Webhooks.md` |
| QA-REG-094 | Elevación manual de rate limit para un Negocio específico | Aplicada correctamente | `05-API/01_Standards.md` |
| QA-REG-095 | Endpoints públicos de Marketplace sin autenticación respetan su propio límite | Verificado | `05-API/01_Standards.md` |

### Seguridad transversal (QA-REG-096 a 115)
| ID | Caso | Resultado esperado | Fuente |
|---|---|---|---|
| QA-REG-096 | Contraseña nunca aparece en logs técnicos | Verificado por escaneo | `10-Operations/04_Logs_Policy.md` |
| QA-REG-097 | Token completo nunca aparece en logs técnicos | Verificado | `10-Operations/04_Logs_Policy.md` |
| QA-REG-098 | Número de tarjeta completo nunca se almacena/loguea | Verificado | `06-Security/01_Security_Model.md` |
| QA-REG-099 | TLS 1.2+ forzado en todo tránsito | Verificado | `06-Security/01_Security_Model.md` |
| QA-REG-100 | Cifrado en reposo de campos sensibles | Verificado | `06-Security/01_Security_Model.md` |
| QA-REG-101 | Rotación de refresh token en cada uso | Verificado | `05-API/02_Auth.md` |
| QA-REG-102 | Robo detectado invalida toda la cadena de sesión | Verificado | `05-API/02_Auth.md` |
| QA-REG-103 | 2FA obligatorio para SuperSU sin excepción | Verificado | `05-API/02_Auth.md` |
| QA-REG-104 | Firma HMAC de webhook validada antes de cualquier procesamiento | Verificado | `05-API/06_Webhooks.md` |
| QA-REG-105 | Secretos no presentes en código ni en documentación | Verificado por auditoría de repositorio | `06-Security/01_Security_Model.md` |
| QA-REG-106 | Incidente de seguridad simulado, contención en menos de 1h de proceso | Verificado en simulacro | `06-Security/01_Security_Model.md` |
| QA-REG-107 | Intento de acceso de soporte de nivel 1 sin impersonación | Denegado | `06-Security/01_Security_Model.md` |
| QA-REG-108 | Prueba de inyección SQL sobre endpoints de búsqueda | Sin vulnerabilidad | `06-Security/01_Security_Model.md` |
| QA-REG-109 | Prueba de XSS sobre campos de texto libre (notas, reseñas) | Sin ejecución de script | `06-Security/01_Security_Model.md` |
| QA-REG-110 | Prueba de CSRF sobre acciones de escritura críticas | Mitigada | `06-Security/01_Security_Model.md` |
| QA-REG-111 | Enumeración de usuarios vía mensajes de error de login | No revela si el usuario existe | `05-API/02_Auth.md` |
| QA-REG-112 | Rate limit de intentos de login fallidos | Aplicado, previene fuerza bruta | `06-Security/01_Security_Model.md` |
| QA-REG-113 | Card testing detectado y bloqueado automáticamente | Verificado | `06-Security/03_Fraud.md` |
| QA-REG-114 | Sesión de impersonación no accesible tras expirar | Verificado | `03-Business-Rules/01_Roles.md` |
| QA-REG-115 | Cabeceras de seguridad estándar presentes (CSP, HSTS, etc.) | Verificado | `06-Security/01_Security_Model.md` |

### Rendimiento y resiliencia (QA-REG-116 a 145)
| ID | Caso | Resultado esperado | Fuente |
|---|---|---|---|
| QA-REG-116 | Latencia de `GET .../disponibilidad` bajo carga normal | Dentro de SLA definido | `10-Operations/06_Analytics_Definitions.md` |
| QA-REG-117 | Webhook responde en menos de 3 segundos en p99 | Verificado bajo carga | `05-API/06_Webhooks.md` |
| QA-REG-118 | Shell de la PWA carga en menos de 2s en 3G simulada (2ª visita) | Verificado | `02-UX/03_Client_PWA.md` |
| QA-REG-119 | Restauración de respaldo cumple RPO de 15 min | Verificado en simulacro trimestral | `10-Operations/03_Disaster_Recovery.md` |
| QA-REG-120 | Recuperación de sistemas críticos cumple RTO de 4h | Verificado en simulacro (game day) | `10-Operations/03_Disaster_Recovery.md` |
| QA-REG-121 | Respaldo probado con restauración real trimestral | Evidencia documentada | `10-Operations/03_Disaster_Recovery.md` |
| QA-REG-122 | Falla catastrófica durante procesamiento de webhooks | Sin duplicados tras restauración | `10-Operations/03_Disaster_Recovery.md` |
| QA-REG-123 | Rollout progresivo (canary) con aumento de errores | Pausa y revierte automáticamente | `10-Operations/05_Release_Process.md` |
| QA-REG-124 | Rollback ejecutable en menos de 15 min | Verificado | `10-Operations/05_Release_Process.md` |
| QA-REG-125 | Migración de esquema aditiva sin downtime perceptible | Verificado | `10-Operations/02_Migration_Strategy.md` |
| QA-REG-126 | Migración destructiva sin ciclo de deprecación previo | Bloqueada por proceso | `10-Operations/02_Migration_Strategy.md` |
| QA-REG-127 | Carga concurrente alta sobre creación de Reservas | Sin condición de carrera que rompa el lock | `03-Business-Rules/02_Booking_Rules.md` |
| QA-REG-128 | Carga concurrente alta sobre webhooks duplicados | Idempotencia se sostiene bajo carga | `05-API/06_Webhooks.md` |
| QA-REG-129 | Caída de un proveedor externo (pasarela) | Calendario de reintentos pausable, sin suspensiones injustas | `08-Growth-Monetization/05_Billing_Failures.md` |
| QA-REG-130 | Comunicación de incidente dentro de 30 min | Verificado en simulacro | `10-Operations/03_Disaster_Recovery.md` |
| QA-REG-131 | Actualizaciones de estado de incidente cada hora | Verificado en simulacro | `10-Operations/03_Disaster_Recovery.md` |
| QA-REG-132 | Prioridad de recuperación respetada (crítico antes que bajo) | Verificado en simulacro | `10-Operations/03_Disaster_Recovery.md` |
| QA-REG-133 | Logs retenidos exactamente 90 días, purgados después | Verificado | `10-Operations/04_Logs_Policy.md` |
| QA-REG-134 | Logs de seguridad retenidos 12 meses | Verificado | `10-Operations/04_Logs_Policy.md` |
| QA-REG-135 | `request_id` propagado a través de llamadas internas | Verificado con traza completa | `10-Operations/04_Logs_Policy.md` |
| QA-REG-136 | Dato sensible expuesto accidentalmente en log de depuración | Purgado retroactivamente tras detección | `10-Operations/04_Logs_Policy.md` |
| QA-REG-137 | Feature flag activo sin fecha de revisión | Marcado como hallazgo de gobierno | `10-Operations/01_Feature_Flags.md` |
| QA-REG-138 | Flag por Negocio piloto persiste tras activación global | Limpiado como parte del retiro | `10-Operations/01_Feature_Flags.md` |
| QA-REG-139 | Escalabilidad de búsqueda de Marketplace con alto volumen de Negocios | Tiempos de respuesta dentro de SLA | `08-Growth-Monetization/01_Marketplace_Algorithm.md` |
| QA-REG-140 | Escalabilidad de cálculo de puntaje Staff con alto volumen de eventos | Sin degradación perceptible | `03-Business-Rules/05_Staff_Rewards.md` |
| QA-REG-141 | Notificaciones masivas (cierre de Sede) sin pérdida | Verificado bajo volumen | `02-UX/11_Notifications.md` |
| QA-REG-142 | KPI recalculado consistente entre dashboard en vivo y reporte de lote nocturno | Convergen al cierre del día | `10-Operations/06_Analytics_Definitions.md` |
| QA-REG-143 | Reconstrucción de un KPI cuestionado desde las tablas de origen | Reproducible exactamente | `10-Operations/06_Analytics_Definitions.md` |
| QA-REG-144 | App Capacitor no degrada disponibilidad de la PWA | Verificado (coexistencia) | `10-Operations/05_Release_Process.md` |
| QA-REG-145 | Revisión de tienda de apps rechaza la versión Capacitor | No bloquea operación de la PWA | `10-Operations/05_Release_Process.md` |

### PWA / Offline / genericidad multi-vertical / cumplimiento (QA-REG-146 a 175)
| ID | Caso | Resultado esperado | Fuente |
|---|---|---|---|
| QA-REG-146 | Instalar PWA y usarla sin conexión (shell) | Carga correctamente | `02-UX/03_Client_PWA.md` |
| QA-REG-147 | Datos transaccionales nunca servidos desde caché offline | Verificado | `02-UX/03_Client_PWA.md` |
| QA-REG-148 | Actualización de Service Worker no interrumpe pago en curso | Verificado | `02-UX/03_Client_PWA.md` |
| QA-REG-149 | Componente de UI sin equivalente en WebView | No existe ninguno (auditoría de código) | `02-UX/03_Client_PWA.md` |
| QA-REG-150 | Almacenamiento local portable a Capacitor | Usa `localStorage`/IndexedDB, no solo cookies | `02-UX/03_Client_PWA.md` |
| QA-REG-151 | Negocio de vertical "spa" opera sin ninguna referencia a "barbero" en su UI | Verificado | `01-PRD/01_Product_Vision.md` |
| QA-REG-152 | Negocio de vertical "tatuajes" usa Recurso "cabina" correctamente | Verificado | `04-Data-Model/01_Entities.md` |
| QA-REG-153 | Negocio multi-servicio combina 3+ verticales sin error estructural | Verificado | `01-PRD/01_Product_Vision.md` |
| QA-REG-154 | Ningún endpoint, tabla o estado usa "barbero" como nombre técnico | Verificado por auditoría de código | ADL-001 |
| QA-REG-155 | Servicio de "masaje" con Recurso "camilla" válida el cuello de botella correcto | Verificado | ADL-002 |
| QA-REG-156 | Consentimiento de datos capturado antes de cualquier dato personal | Verificado en el 100% de los flujos de registro | `06-Security/04_Compliance_Colombia.md` |
| QA-REG-157 | Derecho de acceso (ARCO) resuelto vía flujo de producto | Verificado, no solo correo | `06-Security/04_Compliance_Colombia.md` |
| QA-REG-158 | Derecho de rectificación ejercido por un Cliente | Datos actualizados correctamente | `06-Security/04_Compliance_Colombia.md` |
| QA-REG-159 | Derecho de cancelación (supresión) con datos fiscales retenidos | Anonimización correcta | `04-Data-Model/05_Data_Retention.md` |
| QA-REG-160 | Derecho de oposición a marketing sin afectar reservas | Verificado | `06-Security/04_Compliance_Colombia.md` |
| QA-REG-161 | Dato sensible (salud) capturado con consentimiento separado | Verificado | `06-Security/04_Compliance_Colombia.md` |
| QA-REG-162 | Menor de edad bloqueado como titular de cuenta | Verificado | `06-Security/04_Compliance_Colombia.md` |
| QA-REG-163 | Retención de 5 años de datos transaccionales/fiscales | Verificado, sin borrado prematuro | `04-Data-Model/05_Data_Retention.md` |
| QA-REG-164 | Portabilidad de datos entregada en 15 días hábiles | Verificado | `04-Data-Model/05_Data_Retention.md` |
| QA-REG-165 | Facturación electrónica DIAN de StylerNow hacia el Negocio (suscripción/comisión) | Emitida correctamente | `06-Security/04_Compliance_Colombia.md` |
| QA-REG-166 | Negocio nuevo presenta declaración de responsabilidad Encargado del Tratamiento | Registrada con timestamp | `10-Operations/02_Migration_Strategy.md` |
| QA-REG-167 | Texto legal versionado, cambio material exige re-aceptación | Verificado | `06-Security/04_Compliance_Colombia.md` |
| QA-REG-168 | Ningún documento de la Biblia contiene la frase "se definirá después" | Verificado por auditoría documental | `Documentation_Standards.md` |
| QA-REG-169 | Todo término usado está en `Glossary.md` o es estándar técnico | Verificado por auditoría documental | `Glossary.md` |
| QA-REG-170 | Toda decisión transversal tiene entrada en el ADL | Verificado | `Architecture_Decision_Log.md` |
| QA-REG-171 | Ningún documento de la Biblia queda huérfano (sin referencia desde el índice) | Verificado contra `README.md` | `Documentation_Standards.md` |
| QA-REG-172 | Ninguna carpeta de la Biblia queda con cobertura incompleta | Verificado contra `00_AUDIT_REPORT.md` | `00_AUDIT_REPORT.md` |
| QA-REG-173 | Trazabilidad UX → Negocio → API → QA para el flujo de Reserva | Verificada de punta a punta | `Business_Rules_Bible.md` |
| QA-REG-174 | Trazabilidad UX → Negocio → API → QA para el flujo de Pago | Verificada de punta a punta | `Business_Rules_Bible.md` |
| QA-REG-175 | Trazabilidad UX → Negocio → API → QA para el Sistema PRO/EXPERT/MASTER | Verificada de punta a punta | `03-Business-Rules/05_Staff_Rewards.md` |

### Smoke test crítico post-release (QA-REG-176 a 200)
| ID | Caso | Resultado esperado | Fuente |
|---|---|---|---|
| QA-REG-176 | Login de Cliente | Exitoso | `05-API/02_Auth.md` |
| QA-REG-177 | Login de Staff | Exitoso | `05-API/02_Auth.md` |
| QA-REG-178 | Login de Barbería | Exitoso | `05-API/02_Auth.md` |
| QA-REG-179 | Login de SuperSU con 2FA | Exitoso | `05-API/02_Auth.md` |
| QA-REG-180 | Búsqueda básica en Marketplace | Resultados correctos | `05-API/05_Marketplace.md` |
| QA-REG-181 | Crear una Reserva completa hasta pago aprobado | Exitoso de punta a punta | `05-API/03_Bookings.md` |
| QA-REG-182 | Check-in y check-out de una cita | Exitoso | `05-API/03_Bookings.md` |
| QA-REG-183 | Cancelar una Reserva con reembolso | Exitoso | `05-API/04_Payments.md` |
| QA-REG-184 | Webhook de pasarela procesado correctamente | Exitoso | `05-API/06_Webhooks.md` |
| QA-REG-185 | Ver Dashboard de Panel Negocio | Datos correctos | `02-UX/09_Business_Panel.md` |
| QA-REG-186 | Ver Dashboard de SuperSU | Datos correctos | `02-UX/10_Super_Admin.md` |
| QA-REG-187 | Aprobar un Negocio nuevo | Exitoso | `02-UX/10_Super_Admin.md` |
| QA-REG-188 | Enviar una notificación transaccional | Entregada | `02-UX/11_Notifications.md` |
| QA-REG-189 | Crear y activar una campaña publicitaria | Exitoso | `08-Growth-Monetization/06_Advertising_System.md` |
| QA-REG-190 | Consultar KPI de MRR | Valor correcto | `01-PRD/05_KPIs.md` |
| QA-REG-191 | Ver Nivel PRO/EXPERT/MASTER de un Staff | Valor correcto | `03-Business-Rules/05_Staff_Rewards.md` |
| QA-REG-192 | Generar un insight de IA de Negocio | Generado sin error | `09-CRM-Intelligence/04_AI_Business.md` |
| QA-REG-193 | Exportar datos de un Cliente (portabilidad) | Exitoso | `04-Data-Model/05_Data_Retention.md` |
| QA-REG-194 | Todos los endpoints críticos responden `2xx` en su camino feliz | Verificado | `05-API/01_Standards.md` |
| QA-REG-195 | Ningún endpoint crítico responde `5xx` en el smoke test | Verificado | `05-API/01_Standards.md` |
| QA-REG-196 | Tiempo total del smoke test dentro de un umbral aceptable | Verificado | `10-Operations/05_Release_Process.md` |
| QA-REG-197 | Rollback ejecutado exitosamente en ambiente de prueba | Verificado | `10-Operations/05_Release_Process.md` |
| QA-REG-198 | Verificación de versión desplegada coincide con la esperada | Verificado | `10-Operations/05_Release_Process.md` |
| QA-REG-199 | Alertas de monitoreo activas post-release | Verificado | `10-Operations/04_Logs_Policy.md` |
| QA-REG-200 | Ningún dato de prueba contamina el ambiente de producción | Verificado | `10-Operations/05_Release_Process.md` |

### Auditoría transversal y concurrencia (QA-REG-201 a 265)
| ID | Caso | Resultado esperado | Fuente |
|---|---|---|---|
| QA-REG-201 | Toda transición de Reserva genera evento de auditoría | Verificado al 100% | `04-Data-Model/04_Audit.md` |
| QA-REG-202 | Toda transición de Pago genera evento de auditoría | Verificado al 100% | `04-Data-Model/04_Audit.md` |
| QA-REG-203 | Todo evento de puntaje de Staff genera fila inmutable | Verificado, nunca editado en sitio | `04-Data-Model/04_Audit.md` |
| QA-REG-204 | Corrección técnica de un dato se registra como `CORRECCION_TECNICA` | Nunca un `UPDATE` silencioso | `04-Data-Model/04_Audit.md` |
| QA-REG-205 | Auditoría de moderación de reseña incluye el SuperSU responsable | Verificado | `04-Data-Model/04_Audit.md` |
| QA-REG-206 | Auditoría de cambio de configuración de plataforma incluye el SuperSU responsable | Verificado | `04-Data-Model/04_Audit.md` |
| QA-REG-207 | Log de auditoría retenido 5 años sin excepción | Verificado | `04-Data-Model/05_Data_Retention.md` |
| QA-REG-208 | Anonimización de Cliente no borra filas de auditoría | Solo anonimiza referencias personales | `04-Data-Model/04_Audit.md` |
| QA-REG-209 | Dos eventos de auditoría aparentemente contradictorios | Ambos permanecen visibles en orden cronológico | `04-Data-Model/04_Audit.md` |
| QA-REG-210 | Archivo a almacenamiento frío tras 12 meses sigue siendo consultable | Verificado con mayor latencia aceptable | `04-Data-Model/04_Audit.md` |
| QA-REG-211 | Dos Clientes confirman el mismo slot en el mismo milisegundo (prueba de carga dirigida) | Solo uno gana consistentemente | `03-Business-Rules/02_Booking_Rules.md` |
| QA-REG-212 | Dos webhooks duplicados llegan en paralelo exacto | Un solo efecto de negocio, sin condición de carrera | `05-API/06_Webhooks.md` |
| QA-REG-213 | Dos solicitudes de reembolso parcial simultáneas sobre el mismo `pago` | Se serializan, ninguna excede el disponible | `05-API/04_Payments.md` |
| QA-REG-214 | Dos check-in simultáneos sobre la misma Reserva (doble tap en dos dispositivos) | Solo una transición válida se aplica | `04-Data-Model/03_State_Machines.md` |
| QA-REG-215 | Dos campañas activándose simultáneamente sobre el mismo Pin patrocinado | Gana la primera en completar la activación | `08-Growth-Monetization/06_Advertising_System.md` |
| QA-REG-216 | Actualización concurrente de disponibilidad de un Staff mientras se valida una Reserva nueva | La validación usa el estado más reciente consistente | `03-Business-Rules/02_Booking_Rules.md` |
| QA-REG-217 | Lectura de Score de Marketplace durante escritura concurrente de una nueva reseña | No retorna un estado a medio calcular | `08-Growth-Monetization/01_Marketplace_Algorithm.md` |
| QA-REG-218 | Dos administradores editan el mismo Servicio simultáneamente | Última escritura válida gana sin corromper datos | `04-Data-Model/01_Entities.md` |
| QA-REG-219 | Alta concurrencia de notificaciones de recordatorio a la misma hora | Todas se entregan sin bloqueo mutuo | `02-UX/11_Notifications.md` |
| QA-REG-220 | Recalculo de puntaje de Staff durante un evento especial de doble puntos concurrente con una reversión de fraude | Orden de aplicación correcto y determinista | `03-Business-Rules/05_Staff_Rewards.md` |
| QA-REG-221 | Verificación cruzada: nombre de campo `negocio_id` consistente en todas las tablas que lo requieren | Verificado por auditoría de esquema | `04-Data-Model/02_Relationships.md` |
| QA-REG-222 | Verificación cruzada: todo estado usa `SCREAMING_SNAKE_CASE` | Verificado por auditoría de esquema | `Glossary.md` |
| QA-REG-223 | Verificación cruzada: ninguna tabla de dominio nueva sin política RLS ni entrada en `01_Entities.md` | Verificado | `04-Data-Model/01_Entities.md` |
| QA-REG-224 | Verificación cruzada: todo endpoint de `05-API` tiene rol mínimo documentado coincidente con `03-Business-Rules/01_Roles.md` | Verificado | `05-API/01_Standards.md` |
| QA-REG-225 | Verificación cruzada: todo KPI mostrado en cualquier dashboard existe en `01-PRD/05_KPIs.md` | Verificado | `01-PRD/05_KPIs.md` |
| QA-REG-226 | Verificación cruzada: todo flag activo referenciado en `10-Operations/01_Feature_Flags.md` | Verificado | `10-Operations/01_Feature_Flags.md` |
| QA-REG-227 | Verificación cruzada: toda notificación enviada corresponde a una fila del catálogo de `02-UX/11_Notifications.md` | Verificado | `02-UX/11_Notifications.md` |
| QA-REG-228 | Verificación cruzada: todo caso límite de `03-Business-Rules/08_Edge_Cases.md` tiene un caso de prueba correspondiente | Verificado | `03-Business-Rules/08_Edge_Cases.md` |
| QA-REG-229 | Prueba de carga sostenida sobre el endpoint de disponibilidad (pico de tráfico simulando temporada alta) | Sin degradación fuera de SLA | `10-Operations/06_Analytics_Definitions.md` |
| QA-REG-230 | Prueba de carga sostenida sobre creación de campañas publicitarias | Sin degradación | `08-Growth-Monetization/06_Advertising_System.md` |
| QA-REG-231 | Negocio Raven alcanza exactamente el tope absoluto de 2 Staff | Tercero bloqueado en el límite exacto | `01-PRD/03_Monetization.md` |
| QA-REG-232 | Negocio Jarl agrega Staff más allá de los 5 incluidos | Permite Staff adicional sin tope superior, cobrando el addon de $20.000 | `01-PRD/03_Monetization.md` |
| QA-REG-233 | Negocio Valhalla con exactamente 5 Sedes (máximo incluido) | Válido; una 6ª Sede requiere Allfather | `01-PRD/03_Monetization.md` |
| QA-REG-234 | Seña calculada en el límite exacto del mínimo ($10.000) | Correcta | `03-Business-Rules/03_Payment_Rules.md` |
| QA-REG-235 | Seña calculada en el límite exacto del máximo ($50.000) | Correcta | `03-Business-Rules/03_Payment_Rules.md` |
| QA-REG-236 | Cancelación exactamente a las 24h del límite de ventana | Se resuelve consistentemente hacia un solo lado de la regla | `03-Business-Rules/03_Payment_Rules.md` |
| QA-REG-237 | Cancelación exactamente a las 2h del límite de ventana | Se resuelve consistentemente | `03-Business-Rules/03_Payment_Rules.md` |
| QA-REG-238 | No-show marcado exactamente a los 15 minutos | Transición ocurre en el segundo exacto esperado | `03-Business-Rules/09_No_Show_Policy.md` |
| QA-REG-239 | Puntos expirando exactamente a los 12 meses | Expiración ocurre en la fecha exacta | `03-Business-Rules/04_Loyalty.md` |
| QA-REG-240 | Tercer strike de No-show exactamente en el día 90 de la ventana móvil | Se cuenta correctamente dentro de la ventana | `03-Business-Rules/09_No_Show_Policy.md` |
| QA-REG-241 | Comisión de plataforma en el límite exacto de 3% | Aceptada | `08-Growth-Monetization/02_Commissions.md` |
| QA-REG-242 | Comisión de plataforma en el límite exacto de 15% | Aceptada | `08-Growth-Monetization/02_Commissions.md` |
| QA-REG-243 | Comisión de Staff en el límite exacto de 20% | Aceptada | `08-Growth-Monetization/02_Commissions.md` |
| QA-REG-244 | Comisión de Staff en el límite exacto de 80% | Aceptada | `08-Growth-Monetization/02_Commissions.md` |
| QA-REG-245 | Puntaje exacto de 999 (límite PRO/EXPERT) | Nivel PRO | `03-Business-Rules/05_Staff_Rewards.md` |
| QA-REG-246 | Puntaje exacto de 1000 (límite PRO/EXPERT) | Nivel EXPERT | `03-Business-Rules/05_Staff_Rewards.md` |
| QA-REG-247 | Puntaje exacto de 2999 (límite EXPERT/MASTER) | Nivel EXPERT | `03-Business-Rules/05_Staff_Rewards.md` |
| QA-REG-248 | Puntaje exacto de 3000 (límite EXPERT/MASTER) | Nivel MASTER | `03-Business-Rules/05_Staff_Rewards.md` |
| QA-REG-249 | Ventana de Lista de espera exactamente a los 15 minutos | Se resuelve consistentemente | `03-Business-Rules/10_Waitlist_System.md` |
| QA-REG-250 | Máximo de 5 entradas de Lista de espera, sexta bloqueada en el límite exacto | Verificado | `03-Business-Rules/10_Waitlist_System.md` |
| QA-REG-251 | Reintento de cobro exactamente en el Día 10 (límite de suspensión) | Suspensión ocurre según calendario exacto | `08-Growth-Monetization/05_Billing_Failures.md` |
| QA-REG-252 | Idempotencia de `Idempotency-Key` exactamente a las 24h de vigencia | Se resuelve consistentemente en el límite | `05-API/01_Standards.md` |
| QA-REG-253 | Expiración de invitación de Staff exactamente a los 7 días | Se resuelve consistentemente | `02-UX/02_Onboarding.md` |
| QA-REG-254 | Edición de reseña exactamente a las 48h de publicada | Se resuelve consistentemente en el límite | `02-UX/04_Marketplace.md` |
| QA-REG-255 | Calificación de Reserva exactamente a los 30 días de completada | Se resuelve consistentemente en el límite | `02-UX/07_Appointments.md` |
| QA-REG-256 | Máximo de 2 posiciones patrocinadas consecutivas con exactamente 3 candidatos patrocinados | Verificado en el límite exacto | `03-Business-Rules/06_Marketplace_Ads.md` |
| QA-REG-257 | Radio de búsqueda ampliado hasta exactamente 50km sin resultados | Se detiene en el límite máximo definido | `08-Growth-Monetization/01_Marketplace_Algorithm.md` |
| QA-REG-258 | Access token expira exactamente a los 15 minutos | Refresh se dispara correctamente en el límite | `05-API/02_Auth.md` |
| QA-REG-259 | Impersonación expira exactamente a los 30 minutos de inactividad | Se cierra en el límite exacto | `03-Business-Rules/01_Roles.md` |
| QA-REG-260 | Verificación final: total de casos de prueba de `02` a `10` supera 1.000 | Conteo agregado verificado | `07-QA/01_Strategy.md` |
| QA-REG-261 | Verificación final: 100% de carpetas de la Biblia marcadas `✅` en `README.md` | Verificado | `README.md` |
| QA-REG-262 | Verificación final: `00_AUDIT_REPORT.md` no tiene vacíos sin documento de cierre asociado | Verificado | `00_AUDIT_REPORT.md` |
| QA-REG-263 | Verificación final: ningún documento contiene placeholders prohibidos | Verificado por escaneo de texto | `Documentation_Standards.md` |
| QA-REG-264 | Verificación final: `Business_Rules_Bible.md` responde a cada pregunta de ejemplo dada en la misión original | Verificado uno por uno | `Business_Rules_Bible.md` |
| QA-REG-265 | Verificación final: un desarrollador nuevo completa el onboarding de lectura de la Biblia sin preguntas abiertas pendientes | Validado con revisión cruzada del equipo | `01-PRD/00_Index.md` |

## Estados
Cada caso valida transiciones ya definidas en `04-Data-Model/03_State_Machines.md`, ejecutadas de forma cruzada entre superficies.

## Permisos
Casos ejecutados bajo múltiples roles simultáneamente para verificar aislamiento (Cliente, Staff, Guardian, Barbería, SuperSU).

## Dependencias
Depende de la totalidad de la Biblia — es la capa de verificación final antes de cualquier release.

## Casos límite
Derivados directamente de las fuentes citadas a lo largo de toda la Biblia.

## Criterios de aceptación
- [ ] 100% de los 265 casos tienen Fuente verificable.
- [ ] Los casos de aislamiento multi-tenant (QA-REG-001 a 025) y de idempotencia/webhooks (QA-REG-122, 128, 212) pasan al 100% sin excepción, en cada release.
- [ ] El smoke test (QA-REG-176 a 200) se ejecuta automáticamente en cada despliegue a producción.

## Checklist
- [x] Completo (265 casos)
- [ ] Revisado
