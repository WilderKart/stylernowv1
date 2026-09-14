# 04 — QA: Panel Negocio

## Objetivo
Casos de prueba del Panel Negocio: onboarding, agenda, servicios/staff, CRM, caja/POS, reportes, configuración/plan, publicidad.

## Alcance
Pruebas de integración/E2E de la superficie Negocio. Formato: ID | Caso | Resultado esperado | Fuente.

## Reglas — Casos de prueba

### Onboarding de Negocio (QA-BIZ-001 a 020)
| ID | Caso | Resultado esperado | Fuente |
|---|---|---|---|
| QA-BIZ-001 | Completar datos del negocio (paso 1) | Guardado, avanza a Sedes | `02-UX/02_Onboarding.md` |
| QA-BIZ-002 | Seleccionar categoría multi-vertical | Permite más de una categoría | `01-PRD/01_Product_Vision.md` |
| QA-BIZ-003 | Agregar 1 Sede obligatoria | Mínimo cumplido | `02-UX/02_Onboarding.md` |
| QA-BIZ-004 | Intentar enviar a aprobación sin ninguna Sede | Bloqueado | `02-UX/02_Onboarding.md` |
| QA-BIZ-005 | Cargar al menos 1 Servicio | Mínimo cumplido | `02-UX/02_Onboarding.md` |
| QA-BIZ-006 | Intentar enviar a aprobación sin Servicio | Bloqueado | `02-UX/02_Onboarding.md` |
| QA-BIZ-007 | Invitar Staff (opcional) | Puede omitirse y completar igual | `02-UX/02_Onboarding.md` |
| QA-BIZ-008 | Cerrar la app a mitad del wizard | Progreso persiste al volver | `02-UX/02_Onboarding.md` |
| QA-BIZ-009 | Enviar a aprobación | Negocio pasa a `PENDIENTE_APROBACION` | `04-Data-Model/03_State_Machines.md` |
| QA-BIZ-010 | Negocio en `PENDIENTE_APROBACION` intenta operar | Bloqueado hasta aprobación | `04-Data-Model/03_State_Machines.md` |
| QA-BIZ-011 | Seleccionar Plan durante onboarding | Por defecto Raven si no elige | `01-PRD/03_Monetization.md` |
| QA-BIZ-012 | Configurar Seña y política de cancelación | Dentro de rangos permitidos | `03-Business-Rules/03_Payment_Rules.md` |
| QA-BIZ-013 | Intentar configurar reembolso total con ventana menor a 6h | Bloqueado (mínimo de plataforma) | `03-Business-Rules/03_Payment_Rules.md` |
| QA-BIZ-014 | Importar Clientes vía CSV | Filas válidas se cargan, inválidas se reportan | `10-Operations/02_Migration_Strategy.md` |
| QA-BIZ-015 | Importar historial de Reservas externo | Marcado "Historial importado, no verificado" | `10-Operations/02_Migration_Strategy.md` |
| QA-BIZ-016 | Declarar base legal para datos importados | Registrado con timestamp | `10-Operations/02_Migration_Strategy.md` |
| QA-BIZ-017 | Aprobación de SuperSU | Negocio pasa a `ACTIVO`, visible en Marketplace | `04-Data-Model/03_State_Machines.md` |
| QA-BIZ-018 | Rechazo de SuperSU | Negocio pasa a `RECHAZADO` | `04-Data-Model/03_State_Machines.md` |
| QA-BIZ-019 | Negocio de 1 persona (Staff=Barbería) completa onboarding | Sin invitar a nadie más, operativo | `01-PRD/02_Functional_Architecture.md` |
| QA-BIZ-020 | Elegir 3+ categorías (multi-servicio) | Aceptado sin restricción estructural | `01-PRD/01_Product_Vision.md` |

### Agenda (QA-BIZ-021 a 045)
| ID | Caso | Resultado esperado | Fuente |
|---|---|---|---|
| QA-BIZ-021 | Ver agenda semanal por Staff | Columnas correctas por Staff | `02-UX/09_Business_Panel.md` |
| QA-BIZ-022 | Crear cita manual válida | Sigue las 7 validaciones | `03-Business-Rules/02_Booking_Rules.md` |
| QA-BIZ-023 | Crear cita manual en horario ocupado | Bloqueado, mismo lock que reserva de Cliente | `03-Business-Rules/02_Booking_Rules.md` |
| QA-BIZ-024 | Bloquear horario de un Staff | Crea `bloqueo_ausencia` | `04-Data-Model/01_Entities.md` |
| QA-BIZ-025 | Guardian ve solo su Sede | Alcance limitado verificado | `03-Business-Rules/01_Roles.md` |
| QA-BIZ-026 | Barbería ve todas las Sedes | Alcance completo | `03-Business-Rules/01_Roles.md` |
| QA-BIZ-027 | Reprogramar cita desde el Panel | Mismas validaciones que Cliente | `03-Business-Rules/02_Booking_Rules.md` |
| QA-BIZ-028 | Cancelar cita desde el Panel | Reembolso 100% automático | `03-Business-Rules/02_Booking_Rules.md` |
| QA-BIZ-029 | Cancelar con motivo opcional | Motivo visible al Cliente en el detalle | `02-UX/07_Appointments.md` |
| QA-BIZ-030 | Ver próxima cita destacada en Dashboard | Coincide con la agenda | `02-UX/09_Business_Panel.md` |
| QA-BIZ-031 | Ver ocupación % del día | Fórmula de `01-PRD/05_KPIs.md` | `01-PRD/05_KPIs.md` |
| QA-BIZ-032 | Staff sin `disponibilidad` configurada | Agenda vacía con explicación | `02-UX/08_Staff_App.md` |
| QA-BIZ-033 | Reducir horario con citas confirmadas fuera de rango | Bloqueado hasta resolver | `03-Business-Rules/02_Booking_Rules.md` |
| QA-BIZ-034 | Ver línea de tiempo del día | Orden cronológico | `02-UX/09_Business_Panel.md` |
| QA-BIZ-035 | Cita con Recurso `FUERA_DE_SERVICIO` | Alerta a la Barbería para reasignar | `04-Data-Model/02_Relationships.md` |
| QA-BIZ-036 | Ver Lista de espera agregada de la Sede | Tamaño visible sin datos privados de Cliente | `03-Business-Rules/10_Waitlist_System.md` |
| QA-BIZ-037 | Cierre de Sede con Reservas futuras | Todas se cancelan con reembolso 100% | `08-Growth-Monetization/04_Subscriptions_Lifecycle.md` |
| QA-BIZ-038 | Cierre de Sede con Lista de espera activa | Entradas pasan a `CANCELADA` con notificación | `08-Growth-Monetization/04_Subscriptions_Lifecycle.md` |
| QA-BIZ-039 | Staff sin Sede tras cierre, sin reasignar en 30 días | Vínculo pasa a `SUSPENDIDO` | `08-Growth-Monetization/04_Subscriptions_Lifecycle.md` |
| QA-BIZ-040 | Ver disponibilidad futura de un Staff MASTER | Prioridad reflejada en `CUALQUIERA_DISPONIBLE` | `03-Business-Rules/05_Staff_Rewards.md` |
| QA-BIZ-041 | Doble reserva manual del mismo horario por error de la Barbería | Bloqueada, sin "modo forzado" | `02-UX/09_Business_Panel.md` |
| QA-BIZ-042 | Ver historial de citas completadas del día | Coincide con caja del día | `02-UX/09_Business_Panel.md` |
| QA-BIZ-043 | Ver alerta de cita próxima a No-show | Visible 15 min antes del corte | `03-Business-Rules/09_No_Show_Policy.md` |
| QA-BIZ-044 | Revertir un No-show marcado por error | Revierte strike del Cliente y puntaje del Staff | `03-Business-Rules/09_No_Show_Policy.md` |
| QA-BIZ-045 | Agenda actualizada en tiempo real tras check-in del Staff | Sin necesidad de refrescar manualmente | `02-UX/08_Staff_App.md` |

### Servicios, Staff y CRM (QA-BIZ-046 a 080)
| ID | Caso | Resultado esperado | Fuente |
|---|---|---|---|
| QA-BIZ-046 | Crear Servicio nuevo | Guardado con duración/precio/categoría | `04-Data-Model/01_Entities.md` |
| QA-BIZ-047 | Editar precio de un Servicio existente | Reservas futuras usan precio congelado, no el nuevo | `Business_Rules_Bible.md` |
| QA-BIZ-048 | Desactivar Servicio con Reservas futuras | Soft delete, referencias intactas | `04-Data-Model/05_Data_Retention.md` |
| QA-BIZ-049 | Eliminar físicamente un Servicio con historial | Bloqueado | `04-Data-Model/02_Relationships.md` |
| QA-BIZ-050 | Asignar Servicio a un Staff específico | `staff_servicio` refleja el vínculo | `04-Data-Model/02_Relationships.md` |
| QA-BIZ-051 | Configurar Servicio con Recurso requerido | Validación de disponibilidad de Recurso se activa | `03-Business-Rules/02_Booking_Rules.md` |
| QA-BIZ-052 | Invitar nuevo Staff | Invitación enviada con expiración de 7 días | `02-UX/02_Onboarding.md` |
| QA-BIZ-053 | Invitar un 3er Staff en Plan Raven (tope absoluto: 2) | Bloqueado `403 PLAN_LIMIT_EXCEEDED` | `01-PRD/03_Monetization.md` |
| QA-BIZ-054 | Remover Staff de la Sede | Vínculo pasa a `SUSPENDIDO`/`RETIRADO` | `04-Data-Model/03_State_Machines.md` |
| QA-BIZ-055 | Configurar comisión de Staff dentro de rango | Aceptado (20%-80%) | `08-Growth-Monetization/02_Commissions.md` |
| QA-BIZ-056 | Configurar comisión fuera de rango | Bloqueado | `08-Growth-Monetization/02_Commissions.md` |
| QA-BIZ-057 | Escalonar comisión por Nivel EXPERT/MASTER | Reflejado en cálculo de ganancias del Staff | `03-Business-Rules/05_Staff_Rewards.md` |
| QA-BIZ-058 | Ver lista de Clientes con LTV | Fórmula de `01-PRD/05_KPIs.md` | `01-PRD/05_KPIs.md` |
| QA-BIZ-059 | Buscar Cliente por nombre/teléfono | Resultados correctos | `09-CRM-Intelligence/01_CRM_Complete.md` |
| QA-BIZ-060 | Ver detalle de Cliente con historial completo | Todas las Reservas propias del Negocio | `03-Business-Rules/07_CRM.md` |
| QA-BIZ-061 | Intentar ver historial de Cliente en otro Negocio | Bloqueado, aislamiento absoluto | `03-Business-Rules/07_CRM.md` |
| QA-BIZ-062 | Agregar nota privada a un Cliente | No visible para el Cliente ni otro Negocio | `03-Business-Rules/07_CRM.md` |
| QA-BIZ-063 | Agregar foto a un Cliente sin consentimiento | Bloqueado | `03-Business-Rules/07_CRM.md` |
| QA-BIZ-064 | Agregar foto con consentimiento capturado | Permitido | `03-Business-Rules/07_CRM.md` |
| QA-BIZ-065 | Etiqueta automática "VIP" por LTV | Se aplica según regla configurada | `03-Business-Rules/07_CRM.md` |
| QA-BIZ-066 | LTV baja por reembolso, etiqueta se recalcula | Ya no califica automáticamente | `03-Business-Rules/07_CRM.md` |
| QA-BIZ-067 | Crear segmento combinando filtros | Lista correcta generada | `09-CRM-Intelligence/01_CRM_Complete.md` |
| QA-BIZ-068 | Exportar segmento a campaña | Excluye Clientes sin consentimiento de marketing | `09-CRM-Intelligence/01_CRM_Complete.md` |
| QA-BIZ-069 | Usar plantilla de segmento "Inactivos 45+ días" | Resultado correcto | `09-CRM-Intelligence/01_CRM_Complete.md` |
| QA-BIZ-070 | Cliente solicita eliminación de datos con Reserva futura | Se exige resolver la Reserva primero | `04-Data-Model/05_Data_Retention.md` |
| QA-BIZ-071 | Anonimizar Cliente tras solicitud válida | Datos transaccionales preservados, identidad anonimizada | `04-Data-Model/05_Data_Retention.md` |
| QA-BIZ-072 | Exportar base de Clientes propia del Negocio | Funcionalidad disponible como Encargado del Tratamiento | `06-Security/04_Compliance_Colombia.md` |
| QA-BIZ-073 | Staff deja el Negocio, CRM conserva su historial de atención | Datos permanecen en el Negocio | `03-Business-Rules/07_CRM.md` |
| QA-BIZ-074 | Dos Negocios anotan al mismo Cliente con notas distintas | Ambas coexisten sin conflicto | `03-Business-Rules/07_CRM.md` |
| QA-BIZ-075 | Ver riesgo de abandono de un Cliente | Nivel bajo/medio/alto visible | `09-CRM-Intelligence/04_AI_Business.md` |
| QA-BIZ-076 | Negocio nuevo sin historial suficiente | IA muestra "datos insuficientes" | `09-CRM-Intelligence/04_AI_Business.md` |
| QA-BIZ-077 | Sugerencia de campaña generada | Requiere confirmación explícita para enviarse | `09-CRM-Intelligence/04_AI_Business.md` |
| QA-BIZ-078 | Predicción de ocupación mostrada como estimado | Etiquetada explícitamente, no como certeza | `09-CRM-Intelligence/04_AI_Business.md` |
| QA-BIZ-079 | Horario muerto detectado | Sugiere Promoción Flash | `09-CRM-Intelligence/04_AI_Business.md` |
| QA-BIZ-080 | Descartar un insight de IA | Reduce prioridad de insights similares | `09-CRM-Intelligence/03_AI_Staff.md` |

### Caja/POS, Reportes y Configuración (QA-BIZ-081 a 115)
| ID | Caso | Resultado esperado | Fuente |
|---|---|---|---|
| QA-BIZ-081 | Registrar venta de producto adicional | Se suma al cierre de caja del día | `02-UX/09_Business_Panel.md` |
| QA-BIZ-082 | Aplicar canje de Puntos en la caja | Descuenta hasta $0, excedente se conserva | `03-Business-Rules/04_Loyalty.md` |
| QA-BIZ-083 | Cierre de caja del día | Total efectivo + digital correcto | `02-UX/09_Business_Panel.md` |
| QA-BIZ-084 | Discrepancia en el cierre de caja | Se registra sin ajuste automático oculto | `02-UX/09_Business_Panel.md` |
| QA-BIZ-085 | Cobrar saldo completo por la app (config. opcional) | Comisión se calcula sobre el total, no solo la Seña | `08-Growth-Monetization/02_Commissions.md` |
| QA-BIZ-086 | Ver gráfico de ingresos por semana | Datos correctos por periodo | `01-PRD/05_KPIs.md` |
| QA-BIZ-087 | Ver servicios más vendidos | Ranking correcto | `02-UX/09_Business_Panel.md` |
| QA-BIZ-088 | Ver ranking de Staff por comisión generada | Orden correcto | `02-UX/09_Business_Panel.md` |
| QA-BIZ-089 | Responder una reseña recibida | Respuesta pública visible | `02-UX/09_Business_Panel.md` |
| QA-BIZ-090 | Ver Plan actual y precio | Coincide con `01-PRD/03_Monetization.md` | `01-PRD/03_Monetization.md` |
| QA-BIZ-091 | Solicitar upgrade de Plan | Efectivo de inmediato, cobro prorrateado | `08-Growth-Monetization/04_Subscriptions_Lifecycle.md` |
| QA-BIZ-092 | Solicitar downgrade de Plan | Efectivo al siguiente ciclo | `08-Growth-Monetization/04_Subscriptions_Lifecycle.md` |
| QA-BIZ-093 | Downgrade con exceso de Sedes/Staff | Bloqueado hasta resolver | `08-Growth-Monetization/04_Subscriptions_Lifecycle.md` |
| QA-BIZ-094 | Downgrade se re-valida el día de ejecución con nuevo exceso | Se cancela automáticamente el downgrade | `08-Growth-Monetization/04_Subscriptions_Lifecycle.md` |
| QA-BIZ-095 | Ver historial de facturación | Registros correctos | `02-UX/09_Business_Panel.md` |
| QA-BIZ-096 | Fallo de cobro de suscripción (Día 0) | Pasa a `EN_MORA`, sigue operando | `08-Growth-Monetization/05_Billing_Failures.md` |
| QA-BIZ-097 | Notificación de fallo de cobro (Día 1) | Enviada correctamente | `08-Growth-Monetization/05_Billing_Failures.md` |
| QA-BIZ-098 | Reintentos automáticos (Día 3 y 7) | Ejecutados sin intervención manual | `08-Growth-Monetization/05_Billing_Failures.md` |
| QA-BIZ-099 | Día 10 sin pago | Pasa a `SUSPENDIDA`, efectos en cascada | `08-Growth-Monetization/04_Subscriptions_Lifecycle.md` |
| QA-BIZ-100 | Actualizar medio de pago durante mora | Dispara reintento inmediato | `08-Growth-Monetization/05_Billing_Failures.md` |
| QA-BIZ-101 | Negocio suspendido desaparece del Marketplace | Verificado en la siguiente consulta | `08-Growth-Monetization/04_Subscriptions_Lifecycle.md` |
| QA-BIZ-102 | Negocio suspendido, Reservas futuras confirmadas | Canceladas con reembolso 100% | `08-Growth-Monetization/04_Subscriptions_Lifecycle.md` |
| QA-BIZ-103 | Reactivación tras pago recibido | Automática | `08-Growth-Monetization/04_Subscriptions_Lifecycle.md` |
| QA-BIZ-104 | Suspensión por infracción | Requiere decisión explícita de SuperSU | `08-Growth-Monetization/04_Subscriptions_Lifecycle.md` |
| QA-BIZ-105 | Reactivación tras infracción | Nunca automática | `08-Growth-Monetization/04_Subscriptions_Lifecycle.md` |
| QA-BIZ-106 | Cancelación definitiva del Negocio | Terminal, sin reactivación | `04-Data-Model/03_State_Machines.md` |
| QA-BIZ-107 | Crear campaña publicitaria (Plan Jarl+) | `BORRADOR` creada | `08-Growth-Monetization/06_Advertising_System.md` |
| QA-BIZ-108 | Activar campaña sin saldo suficiente | `402 SALDO_INSUFICIENTE` | `05-API/05_Marketplace.md` |
| QA-BIZ-109 | Campaña alcanza presupuesto diario | Se retira de la posición sin excederlo | `08-Growth-Monetization/06_Advertising_System.md` |
| QA-BIZ-110 | Ver métricas de campaña (CTR, conversión) | Coinciden con lo facturado | `08-Growth-Monetization/06_Advertising_System.md` |
| QA-BIZ-111 | Activar Promoción Flash sin disponibilidad real | Bloqueado en validación previa | `08-Growth-Monetization/06_Advertising_System.md` |
| QA-BIZ-112 | Negocio suspendido con campaña activa | Se pausa automáticamente, presupuesto retenido en Wallet | `03-Business-Rules/06_Marketplace_Ads.md` |
| QA-BIZ-113 | Guardian intenta acceder a Configuración por URL directa | `403 FORBIDDEN` | `02-UX/09_Business_Panel.md` |
| QA-BIZ-114 | Ver saldo y movimientos del Wallet | Coincide con comisiones y campañas | `08-Growth-Monetization/02_Commissions.md` |
| QA-BIZ-115 | Solicitar retiro del Wallet según ciclo de liquidación | Procesado correctamente | `08-Growth-Monetization/02_Commissions.md` |

## Estados
Cada caso valida transiciones de Negocio, Suscripción, Reserva y Campaña Publicitaria (`04-Data-Model/03_State_Machines.md`).

## Permisos
Casos bajo rol Barbería salvo indicación explícita de Guardian o verificación de rechazo.

## Dependencias
Depende de la totalidad de `03-Business-Rules`, `08-Growth-Monetization`, `09-CRM-Intelligence`, `02-UX/09_Business_Panel.md`.

## Casos límite
Derivados directamente de las fuentes citadas.

## Criterios de aceptación
- [ ] 100% de los 115 casos tienen Fuente verificable.
- [ ] Los casos de suspensión/cascada (QA-BIZ-101 a 106) pasan al 100% antes de cualquier release.

## Checklist
- [x] Completo (115 casos)
- [ ] Revisado
