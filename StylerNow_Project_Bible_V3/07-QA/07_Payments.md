# 07 — QA: Payments

## Objetivo
Casos de prueba de pagos, reembolsos, webhooks, comisiones, propinas y fallos de facturación — el dominio de mayor severidad de la plataforma.

## Alcance
Pruebas de integración del ciclo completo de dinero: Seña, Saldo, reembolsos, webhooks de pasarela, comisión de plataforma, comisión de Staff, propinas, suscripción SaaS. Formato: ID | Caso | Resultado esperado | Fuente.

## Reglas — Casos de prueba

### Cobro de Seña y Saldo (QA-PAY-001 a 025)
| ID | Caso | Resultado esperado | Fuente |
|---|---|---|---|
| QA-PAY-001 | Calcular Seña por defecto (20%, min/max) | Coincide exactamente | `03-Business-Rules/03_Payment_Rules.md` |
| QA-PAY-002 | Seña configurada por Servicio específico | Sobreescribe la regla general del Negocio | `03-Business-Rules/03_Payment_Rules.md` |
| QA-PAY-003 | Seña nunca supera el valor total del Servicio | Verificado en el límite exacto | `03-Business-Rules/03_Payment_Rules.md` |
| QA-PAY-004 | Mínimo de Seña supera el 20% calculado | Gana el mínimo | `03-Business-Rules/03_Payment_Rules.md` |
| QA-PAY-005 | Mínimo de Seña supera el 100% del Servicio | Se limita al 100% del Servicio | `03-Business-Rules/03_Payment_Rules.md` |
| QA-PAY-006 | Pago con Nequi aprobado | `pago APROBADO`, Reserva `CONFIRMADA` | `03-Business-Rules/03_Payment_Rules.md` |
| QA-PAY-007 | Pago con PSE aprobado | Igual resultado | `03-Business-Rules/03_Payment_Rules.md` |
| QA-PAY-008 | Pago con tarjeta aprobado | Igual resultado | `03-Business-Rules/03_Payment_Rules.md` |
| QA-PAY-009 | Pago rechazado | `pago RECHAZADO`, Reserva no confirma | `03-Business-Rules/03_Payment_Rules.md` |
| QA-PAY-010 | Pago pendiente por más de 10 min | Reserva se cancela automáticamente | `03-Business-Rules/03_Payment_Rules.md` |
| QA-PAY-011 | Pasarela confirma después de expirar la Reserva | Reembolso automático 100% | `03-Business-Rules/03_Payment_Rules.md` |
| QA-PAY-012 | Negocio activa "pago completo en app" | Comisión calculada sobre el total | `03-Business-Rules/03_Payment_Rules.md` |
| QA-PAY-013 | Negocio sin "pago completo" activo | Solo la Seña se procesa por la app | `03-Business-Rules/03_Payment_Rules.md` |
| QA-PAY-014 | Doble tap en botón de pago | Un solo cobro ejecutado (`Idempotency-Key`) | `05-API/01_Standards.md` |
| QA-PAY-015 | Reintento tras timeout de red con misma `Idempotency-Key` | Retorna respuesta original, no duplica | `05-API/01_Standards.md` |
| QA-PAY-016 | `Idempotency-Key` repetida con payload distinto | `422 IDEMPOTENCY_KEY_CONFLICT` | `05-API/01_Standards.md` |
| QA-PAY-017 | Segundo intento de cobro sobre Reserva ya con `pago APROBADO` del mismo tipo | `409 PAGO_YA_PROCESADO` | `05-API/04_Payments.md` |
| QA-PAY-018 | Monto de Seña manipulado en el cliente antes de enviar | `422 MONTO_SENA_INVALIDO`, se recalcula server-side | `05-API/04_Payments.md` |
| QA-PAY-019 | Compra de Gift Card exitosa | Saldo disponible | `01-PRD/03_Monetization.md` |
| QA-PAY-020 | Compra de Gift Card fallida | No se emite saldo | `05-API/04_Payments.md` |
| QA-PAY-021 | Redimir Gift Card como método de pago de Seña | Sin comisión adicional | `03-Business-Rules/03_Payment_Rules.md` |
| QA-PAY-022 | Suscribir Membresía, primer cobro exitoso | Beneficio activo | `03-Business-Rules/04_Loyalty.md` |
| QA-PAY-023 | Ver estado de pago vía polling tras iniciar cobro asíncrono | Refleja el estado real una vez confirmado | `05-API/04_Payments.md` |
| QA-PAY-024 | Cerrar la app tras iniciar cobro, antes de completar | `pago` queda `PENDIENTE`, expira con la Reserva | `03-Business-Rules/03_Payment_Rules.md` |
| QA-PAY-025 | Transmisión de monto como entero en pesos (sin subunidad) | Formato correcto en toda request/response | `05-API/01_Standards.md` |

### Reembolsos (QA-PAY-026 a 050)
| ID | Caso | Resultado esperado | Fuente |
|---|---|---|---|
| QA-PAY-026 | Cancelación del Cliente >24h antes | Reembolso 100% | `03-Business-Rules/03_Payment_Rules.md` |
| QA-PAY-027 | Cancelación del Cliente 24h-2h antes | Reembolso 50% | `03-Business-Rules/03_Payment_Rules.md` |
| QA-PAY-028 | Cancelación del Cliente <2h antes | Reembolso 0% | `03-Business-Rules/03_Payment_Rules.md` |
| QA-PAY-029 | Cancelación por el Negocio, cualquier momento | Reembolso 100% siempre | `03-Business-Rules/03_Payment_Rules.md` |
| QA-PAY-030 | Cancelación por suspensión de plataforma | Reembolso 100% siempre | `03-Business-Rules/03_Payment_Rules.md` |
| QA-PAY-031 | Negocio configura ventana de reembolso total menor a 6h | Bloqueado (mínimo de plataforma) | `03-Business-Rules/03_Payment_Rules.md` |
| QA-PAY-032 | Reembolso parcial sin motivo de catálogo cerrado | `422 MOTIVO_REEMBOLSO_INVALIDO` | `05-API/04_Payments.md` |
| QA-PAY-033 | Reembolso parcial con motivo válido | Procesado correctamente | `05-API/04_Payments.md` |
| QA-PAY-034 | Reembolso que excede el monto disponible del `pago` | `422 REEMBOLSO_EXCEDE_DISPONIBLE` | `05-API/04_Payments.md` |
| QA-PAY-035 | Segundo reembolso parcial sobre el mismo `pago` | Se valida contra el saldo restante, no el original | `05-API/04_Payments.md` |
| QA-PAY-036 | Intento de reembolsar un `pago` ya `REEMBOLSADO` | Bloqueado | `05-API/04_Payments.md` |
| QA-PAY-037 | Reembolso revierte comisión de plataforma proporcionalmente | Verificado en el cálculo | `08-Growth-Monetization/02_Commissions.md` |
| QA-PAY-038 | Reembolso de propina vinculada a Reserva cancelada | 100% automático junto con la Seña | `08-Growth-Monetization/03_Tips_Distribution.md` |
| QA-PAY-039 | Cliente disputa (contracargo) tras servicio prestado | `pago` pasa a `EN_DISPUTA`, servicio no se revierte | `03-Business-Rules/03_Payment_Rules.md` |
| QA-PAY-040 | Resolución de disputa por SuperSU | Pasa a `APROBADO` o `REEMBOLSADO` según decisión | `04-Data-Model/03_State_Machines.md` |
| QA-PAY-041 | Ajuste de servicio (Negocio prestó un servicio menor) | Reembolso parcial con motivo `AJUSTE_SERVICIO` | `05-API/04_Payments.md` |
| QA-PAY-042 | Cortesía comercial del Negocio | Reembolso parcial con motivo `CORTESIA_COMERCIAL` | `05-API/04_Payments.md` |
| QA-PAY-043 | Ver monto exacto de reembolso antes de confirmar cancelación | Coincide con lo efectivamente procesado | `02-UX/07_Appointments.md` |
| QA-PAY-044 | Reembolso por No-show del Staff | 100% automático | `03-Business-Rules/09_No_Show_Policy.md` |
| QA-PAY-045 | No reembolso por No-show del Cliente | Seña retenida | `03-Business-Rules/09_No_Show_Policy.md` |
| QA-PAY-046 | Reversión manual de un No-show mal marcado | Revierte también el reembolso si ya se procesó | `03-Business-Rules/09_No_Show_Policy.md` |
| QA-PAY-047 | Reembolso de Membresía cancelada a mitad de ciclo | No se reembolsa el periodo en curso | `03-Business-Rules/04_Loyalty.md` |
| QA-PAY-048 | Reembolso en cascada por cierre de Sede | Todas las Reservas futuras de esa Sede | `08-Growth-Monetization/04_Subscriptions_Lifecycle.md` |
| QA-PAY-049 | Reembolso en cascada por suspensión de Negocio | Todas las Reservas futuras `CONFIRMADA` | `08-Growth-Monetization/04_Subscriptions_Lifecycle.md` |
| QA-PAY-050 | Todo reembolso genera evento de auditoría | Verificable con monto y motivo exactos | `04-Data-Model/04_Audit.md` |

### Webhooks (QA-PAY-051 a 075)
| ID | Caso | Resultado esperado | Fuente |
|---|---|---|---|
| QA-PAY-051 | Webhook con firma HMAC válida | Procesado | `05-API/06_Webhooks.md` |
| QA-PAY-052 | Webhook con firma HMAC inválida | `401 UNAUTHORIZED`, no procesa nada | `05-API/06_Webhooks.md` |
| QA-PAY-053 | Mismo webhook enviado 2 veces (duplicado exacto) | Un solo efecto de negocio | `05-API/06_Webhooks.md` |
| QA-PAY-054 | Mismo webhook enviado 10 veces | Un solo efecto de negocio | `05-API/06_Webhooks.md` |
| QA-PAY-055 | Webhook de un `id_transaccion_pasarela` ya en estado terminal | `200 OK` sin reprocesar | `05-API/06_Webhooks.md` |
| QA-PAY-056 | Respuesta del endpoint en menos de 3 segundos | Verificado bajo carga | `05-API/06_Webhooks.md` |
| QA-PAY-057 | Procesamiento pesado desacoplado a cola asíncrona | No bloquea la respuesta rápida | `05-API/06_Webhooks.md` |
| QA-PAY-058 | Pasarela reintenta tras `5xx` de nuestro endpoint | Tolera cualquier número de reintentos sin duplicar | `05-API/06_Webhooks.md` |
| QA-PAY-059 | Webhook de un `id_transaccion_pasarela` sin `pago PENDIENTE` asociado | Se marca `HUERFANO` para revisión | `05-API/06_Webhooks.md` |
| QA-PAY-060 | Webhook huérfano indica cobro sí ejecutado | Reembolso automático disparado | `05-API/06_Webhooks.md` |
| QA-PAY-061 | Webhook de reembolso llega antes que el de aprobación | Se pone en cola de espera breve antes de fallar | `05-API/06_Webhooks.md` |
| QA-PAY-062 | Firma válida pero payload con esquema inesperado | `200 OK` + registro como error crítico | `05-API/06_Webhooks.md` |
| QA-PAY-063 | Intento de suplantación de webhook (firma inválida repetida) | Registrado como posible ataque | `06-Security/03_Fraud.md` |
| QA-PAY-064 | Webhook saliente a un Negocio Allfather (diseño futuro) | Reintentos con backoff exponencial hasta 24h | `05-API/06_Webhooks.md` |
| QA-PAY-065 | Webhook saliente no entregado tras 24h | Marcado como fallido, expuesto para reenvío manual | `05-API/06_Webhooks.md` |
| QA-PAY-066 | Correlación de eventos de un mismo pago con `request_id`/`id_transaccion_pasarela` | Reconstruible completamente | `10-Operations/04_Logs_Policy.md` |
| QA-PAY-067 | Falla catastrófica durante ventana de procesamiento de webhooks | Idempotencia previene duplicados tras restauración | `10-Operations/03_Disaster_Recovery.md` |
| QA-PAY-068 | Webhook de aprobación tras que la Reserva ya fue cancelada manualmente | Se resuelve como pago huérfano con reembolso | `05-API/06_Webhooks.md` |
| QA-PAY-069 | Volumen alto de webhooks simultáneos | Ninguno se pierde ni se duplica | `05-API/06_Webhooks.md` |
| QA-PAY-070 | Webhook con `id_transaccion_pasarela` corrupto/vacío | Rechazado antes de cualquier procesamiento | `05-API/06_Webhooks.md` |
| QA-PAY-071 | Auditoría de cada transición de `pago` disparada por webhook | Evento generado con actor `SISTEMA` | `04-Data-Model/04_Audit.md` |
| QA-PAY-072 | Reintento de webhook fuera del calendario estándar (forzado por SuperSU) | Registrado con actor `SUPER_ADMIN` y motivo | `08-Growth-Monetization/05_Billing_Failures.md` |
| QA-PAY-073 | Caída general de la pasarela afecta múltiples Negocios | Calendario de reintentos pausable a nivel plataforma | `08-Growth-Monetization/05_Billing_Failures.md` |
| QA-PAY-074 | Verificación de firma antes de cualquier lectura del payload | Orden de validación correcto | `05-API/06_Webhooks.md` |
| QA-PAY-075 | Webhook entrante vs. saliente, garantías distintas (exactly-once vs. at-least-once) | Comportamiento documentado y verificado por separado | `05-API/06_Webhooks.md` |

### Comisiones, propinas y facturación SaaS (QA-PAY-076 a 110)
| ID | Caso | Resultado esperado | Fuente |
|---|---|---|---|
| QA-PAY-076 | Comisión de plataforma calculada al 8% por defecto | Exacta | `08-Growth-Monetization/02_Commissions.md` |
| QA-PAY-077 | Comisión ajustada por Negocio dentro de 3%-15% | Aplicada correctamente | `08-Growth-Monetization/02_Commissions.md` |
| QA-PAY-078 | Intento de comisión fuera de rango | Bloqueado | `08-Growth-Monetization/02_Commissions.md` |
| QA-PAY-079 | Comisión no se cobra sobre propinas | Verificado | `08-Growth-Monetization/03_Tips_Distribution.md` |
| QA-PAY-080 | Comisión no se cobra sobre venta de producto fuera del Marketplace | Verificado | `08-Growth-Monetization/02_Commissions.md` |
| QA-PAY-081 | Comisión se acredita al Wallet del Negocio al aprobarse el pago | Monto neto correcto | `08-Growth-Monetization/02_Commissions.md` |
| QA-PAY-082 | Solicitud de retiro del Wallet según ciclo de liquidación | Procesada | `08-Growth-Monetization/02_Commissions.md` |
| QA-PAY-083 | Comisión de Staff configurada al 20% (mínimo) | Aceptado | `08-Growth-Monetization/02_Commissions.md` |
| QA-PAY-084 | Comisión de Staff configurada al 80% (máximo) | Aceptado | `08-Growth-Monetization/02_Commissions.md` |
| QA-PAY-085 | Intento de comisión de Staff al 0% o 100% | Bloqueado | `08-Growth-Monetization/02_Commissions.md` |
| QA-PAY-086 | Propina 100% acreditada al Staff sin comisión | Verificado en el cálculo | `08-Growth-Monetization/03_Tips_Distribution.md` |
| QA-PAY-087 | Propina procesada como `pago` independiente de la Seña | Verificado en el registro | `08-Growth-Monetization/03_Tips_Distribution.md` |
| QA-PAY-088 | Propina anticipada al pagar la Seña | Registrada correctamente | `02-UX/06_Payments.md` |
| QA-PAY-089 | Propina posterior a Reserva `COMPLETADA` | Registrada correctamente | `02-UX/06_Payments.md` |
| QA-PAY-090 | Propina con monto superior a 3x el Servicio | Solicita confirmación adicional | `02-UX/06_Payments.md` |
| QA-PAY-091 | Staff ve desglose de propinas por Cliente y fecha | Datos correctos | `02-UX/08_Staff_App.md` |
| QA-PAY-092 | Cobro de suscripción exitoso en la fecha de renovación | `suscripcion` sigue `ACTIVA` | `08-Growth-Monetization/04_Subscriptions_Lifecycle.md` |
| QA-PAY-093 | Fallo de cobro (Día 0) | Pasa a `EN_MORA`, Negocio sigue operando | `08-Growth-Monetization/05_Billing_Failures.md` |
| QA-PAY-094 | Notificación de fallo (Día 1) | Enviada | `08-Growth-Monetization/05_Billing_Failures.md` |
| QA-PAY-095 | Reintento automático (Día 3) | Ejecutado | `08-Growth-Monetization/05_Billing_Failures.md` |
| QA-PAY-096 | Reintento automático + advertencia (Día 7) | Ejecutado | `08-Growth-Monetization/05_Billing_Failures.md` |
| QA-PAY-097 | Suspensión tras agotar reintentos (Día 10) | `suscripcion SUSPENDIDA` | `08-Growth-Monetization/04_Subscriptions_Lifecycle.md` |
| QA-PAY-098 | Actualización de medio de pago durante mora | Dispara reintento inmediato, no espera al siguiente hito | `08-Growth-Monetization/05_Billing_Failures.md` |
| QA-PAY-099 | Nuevo medio de pago también falla en el Día 9 | Suspensión ocurre en Día 10 igual | `08-Growth-Monetization/05_Billing_Failures.md` |
| QA-PAY-100 | Fallo de cobro de Membresía (Día 0) | `SUSPENDIDA_POR_IMPAGO`, pierde beneficio de inmediato | `08-Growth-Monetization/05_Billing_Failures.md` |
| QA-PAY-101 | Reintento de Membresía (Día 5) | Ejecutado, último intento | `08-Growth-Monetization/05_Billing_Failures.md` |
| QA-PAY-102 | Membresía falla tras Día 5 | Pasa a `CANCELADA` definitivamente | `08-Growth-Monetization/05_Billing_Failures.md` |
| QA-PAY-103 | Upgrade de Plan a mitad de ciclo | Cobro prorrateado correctamente | `01-PRD/03_Monetization.md` |
| QA-PAY-104 | Downgrade de Plan | Efectivo al siguiente ciclo, sin cobro inmediato | `08-Growth-Monetization/04_Subscriptions_Lifecycle.md` |
| QA-PAY-105 | Negocio Allfather con comisión negociada fuera del rango estándar | Requiere configuración explícita de SuperSU | `08-Growth-Monetization/02_Commissions.md` |
| QA-PAY-106 | Extensión manual de gracia por SuperSU | Registrada con motivo | `08-Growth-Monetization/05_Billing_Failures.md` |
| QA-PAY-107 | Caída de pasarela pausa calendario de reintentos globalmente | Ningún Negocio se suspende injustamente durante el incidente | `08-Growth-Monetization/05_Billing_Failures.md` |
| QA-PAY-108 | Todo movimiento del Wallet genera evento de auditoría | Verificado | `04-Data-Model/04_Audit.md` |
| QA-PAY-109 | Wallet retiene monto durante `EN_DISPUTA` | Verificado | `08-Growth-Monetization/02_Commissions.md` |
| QA-PAY-110 | Comisión revertida coincide exactamente con el reembolso proporcional | Sin discrepancia de centavos/pesos | `08-Growth-Monetization/02_Commissions.md` |

## Estados
Cada caso valida `04-Data-Model/03_State_Machines.md`, máquinas "Pago" y "Suscripción".

## Permisos
Casos bajo Cliente (cobro/reembolso propio), Barbería (reembolsos, comisión, Wallet), SuperSU (disputas, extensión de gracia).

## Dependencias
Depende de `03-Business-Rules/03_Payment_Rules.md`, `05-API/04_Payments.md`, `05-API/06_Webhooks.md`, `08-Growth-Monetization` completo.

## Casos límite
Derivados directamente de las fuentes citadas.

## Criterios de aceptación
- [ ] 100% de los 110 casos tienen Fuente verificable.
- [ ] Los casos de idempotencia (QA-PAY-053, 054, 058) pasan al 100% — es la garantía de mayor severidad de toda la Biblia.

## Checklist
- [x] Completo (110 casos)
- [ ] Revisado
