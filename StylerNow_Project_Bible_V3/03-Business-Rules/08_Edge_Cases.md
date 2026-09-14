# 08 — Casos Límite (Índice Consolidado)

## Objetivo
Servir de índice único de todos los casos límite documentados en la Biblia, para que nadie tenga que recordar en qué documento se resolvió cada uno. El catálogo exhaustivo con narrativa de escenario está en `Business_Rules_Bible.md`; este documento es la tabla de referencia rápida organizada por dominio.

## Alcance
Índice y resumen de resolución. La resolución completa vive en el documento de dominio referenciado — este documento nunca contradice a la fuente, solo apunta a ella.

## Reglas

### Reservas
| Caso | Resolución | Fuente |
|---|---|---|
| Doble reserva simultánea del mismo slot | Lock optimista a nivel de base de datos; la segunda escritura recibe `409 CONFLICT` | `02_Booking_Rules.md` |
| Staff cambia horario con Reservas confirmadas existentes | Bloqueado hasta reprogramar/cancelar con reembolso las Reservas afectadas | `02_Booking_Rules.md` |
| Servicio eliminado del catálogo con Reservas futuras | Soft delete: se desactiva, no se borra; Reservas existentes conservan referencia íntegra | `02_Booking_Rules.md`, `04-Data-Model/05_Data_Retention.md` |
| Recurso limitado sin Staff limitado (ej. spa con más terapeutas que camillas) | La validación de Recurso limita la disponibilidad aunque haya Staff libre | `02_Booking_Rules.md` |
| Cliente pierde conexión antes de pagar | No hay bloqueo de horario más allá del lock transaccional; el slot puede perderse al reconectar | `02_Booking_Rules.md` |

### Pagos
| Caso | Resolución | Fuente |
|---|---|---|
| Webhook duplicado (ej. Wompi reenvía notificación) | Idempotencia por id de transacción; segundo evento se reconoce sin duplicar efecto | `03_Payment_Rules.md`, `05-API/06_Webhooks.md` |
| Reembolso parcial | Solo por motivo de catálogo cerrado (ventana de cancelación, ajuste de servicio, disputa) | `03_Payment_Rules.md` |
| Pago expirado (Reserva no confirmada a tiempo) | Cancelación automática a los 10 min; si la pasarela confirma tarde, reembolso automático 100% | `03_Payment_Rules.md` |

### Staff
| Caso | Resolución | Fuente |
|---|---|---|
| Cambio de sede dentro del mismo Negocio | Puntaje PRO/EXPERT/MASTER no se reinicia (es por Negocio, no por Sede) | `05_Staff_Rewards.md` |
| Renuncia y reingreso | Conserva puntaje si vuelve dentro de la misma temporada; reinicia si hay brecha mayor | `05_Staff_Rewards.md` |
| Suspensión del vínculo Staff-Negocio | Ver máquina de estados del vínculo | `04-Data-Model/03_State_Machines.md`, `01_Roles.md` |
| Staff trabaja en dos Negocios | Nivel y puntaje independientes por vínculo Staff-Negocio | `05_Staff_Rewards.md`, `01_Roles.md` |

### Marketplace
| Caso | Resolución | Fuente |
|---|---|---|
| Anuncio vencido visible por caché | Score se recalcula en cada consulta, sin caché de resultados de más de minutos | `06_Marketplace_Ads.md` |
| Negocio suspendido con campaña activa | Campaña se pausa automáticamente; presupuesto no consumido queda retenido en Wallet | `06_Marketplace_Ads.md`, `08-Growth-Monetization/04_Subscriptions_Lifecycle.md` |
| Fraude de reseñas | Ver protocolo de fraude completo | `06-Security/03_Fraud.md` |

### Recuperación y auditoría

**Regla general (invariante de todo el sistema):** todo evento crítico (cambio de estado de Reserva, Pago, Puntaje, Plan, Nivel) debe ser reversible mediante un evento de auditoría opuesto — nunca mediante edición o borrado del registro original. Esto aplica sin excepción a los 12 dominios de esta tabla y a cualquier caso límite nuevo que se documente en el futuro. Ver `04-Data-Model/04_Audit.md`.

## Estados
No aplica — este documento es un índice, no una entidad.

## Permisos
No aplica — de referencia libre para todo el equipo.

## Dependencias
Depende de todos los documentos de `03-Business-Rules`, `04-Data-Model`, `05-API` y `06-Security` que resuelven cada caso. Es fuente para `Business_Rules_Bible.md` y para `07-QA` (cada fila de esta tabla debe tener al menos un caso de prueba correspondiente).

## Casos límite
No aplica un nivel adicional de "casos límite del documento de casos límite" — cualquier caso nuevo se agrega directamente como fila a las tablas de arriba, en el dominio correspondiente.

## Criterios de aceptación
- [ ] Cada fila de este índice tiene una fuente verificable con la resolución completa (no hay ninguna fila con la palabra "pendiente").
- [ ] Cada fila tiene al menos un caso de prueba correspondiente en `07-QA`.

## Checklist
- [x] Completo
- [ ] Revisado
