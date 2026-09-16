# 02 — QA: Cliente PWA

## Objetivo
Casos de prueba de la Cliente PWA: onboarding, descubrimiento, reserva, pago, gestión de citas, perfil y fidelización.

## Alcance
Pruebas de integración/E2E de la superficie Cliente. Formato: ID | Caso | Resultado esperado | Fuente.

## Reglas — Casos de prueba

### Onboarding y registro (QA-CLI-001 a 018)
| ID | Caso | Resultado esperado | Fuente |
|---|---|---|---|
| QA-CLI-001 | Registro con celular vía OTP válido | Cuenta creada, sesión iniciada | `02-UX/02_Onboarding.md` |
| QA-CLI-002 | Registro con OTP incorrecto | Error claro, permite reintentar | `02-UX/02_Onboarding.md` |
| QA-CLI-003 | Registro con OTP expirado | Error específico, solicita reenvío | `05-API/02_Auth.md` |
| QA-CLI-004 | Registro con Google | Cuenta creada con datos del proveedor | `02-UX/02_Onboarding.md` |
| QA-CLI-005 | Login con cuenta existente | Sesión iniciada, aterriza en Home | `05-API/02_Auth.md` |
| QA-CLI-006 | Rechazar consentimiento de datos | Bloquea continuar, explica motivo | `06-Security/04_Compliance_Colombia.md` |
| QA-CLI-007 | Aceptar consentimiento | Continúa el flujo, queda timestamp registrado | `06-Security/04_Compliance_Colombia.md` |
| QA-CLI-008 | Rechazar permiso de ubicación | No bloquea, ofrece búsqueda manual por ciudad | `01-PRD/01_Product_Vision.md` |
| QA-CLI-009 | Rechazar permiso de notificaciones | No bloquea, muestra recordatorio in-app en vez de push | `02-UX/11_Notifications.md` |
| QA-CLI-010 | Menor de edad declara fecha de nacimiento menor a 18 | Bloquea registro como titular | `06-Security/04_Compliance_Colombia.md` |
| QA-CLI-011 | Usuario ya es Staff en otro Negocio y se registra como Cliente | Misma identidad, rol adicional disponible | `03-Business-Rules/01_Roles.md` |
| QA-CLI-012 | Refresh token usado dos veces (uno robado) | Se invalida toda la cadena de sesión | `05-API/02_Auth.md` |
| QA-CLI-013 | Access token expirado en medio de una acción | Refresh automático transparente | `05-API/02_Auth.md` |
| QA-CLI-014 | Instalar la PWA tras segunda visita | Prompt de instalación aparece | `02-UX/03_Client_PWA.md` |
| QA-CLI-015 | Instalar la PWA en primera visita | Prompt NO aparece aún | `02-UX/03_Client_PWA.md` |
| QA-CLI-016 | Abrir la app sin conexión tras instalada | Shell carga desde cache | `02-UX/03_Client_PWA.md` |
| QA-CLI-017 | Cambiar de celular y reinstalar con misma cuenta | Historial y Puntos se conservan | `03-Business-Rules/04_Lealtad.md` |
| QA-CLI-018 | Editar teléfono de contacto en perfil | Puntos y reservas se conservan bajo el mismo `cliente_id` | `03-Business-Rules/04_Lealtad.md` |

### Descubrimiento y Marketplace (QA-CLI-019 a 045)
| ID | Caso | Resultado esperado | Fuente |
|---|---|---|---|
| QA-CLI-019 | Buscar por ciudad sin permiso de ubicación | Resultados de esa ciudad | `02-UX/04_Marketplace.md` |
| QA-CLI-020 | Filtro "Cerca de mí" activo | Resultados ordenados por proximidad dentro del Score | `08-Growth-Monetization/01_Marketplace_Algorithm.md` |
| QA-CLI-021 | Filtro "Disponible hoy" | Solo Negocios con slot en 24h | `08-Growth-Monetization/01_Marketplace_Algorithm.md` |
| QA-CLI-022 | Búsqueda sin resultados en el radio | Radio se amplía automáticamente | `08-Growth-Monetization/01_Marketplace_Algorithm.md` |
| QA-CLI-023 | Resultado patrocinado presente | Etiqueta "Patrocinado" visible | `03-Business-Rules/06_Marketplace_Ads.md` |
| QA-CLI-024 | 3+ Negocios patrocinados compiten por la misma búsqueda | Máximo 2 posiciones consecutivas patrocinadas | `03-Business-Rules/06_Marketplace_Ads.md` |
| QA-CLI-025 | Ver perfil de Negocio `ACTIVO` | Perfil completo visible | `05-API/05_Marketplace.md` |
| QA-CLI-026 | Ver perfil de Negocio `SUSPENDIDO` vía link directo | `404 NEGOCIO_NO_DISPONIBLE` | `05-API/05_Marketplace.md` |
| QA-CLI-027 | Ver perfil de Negocio `CANCELADO` | `404 NEGOCIO_NO_DISPONIBLE` | `05-API/05_Marketplace.md` |
| QA-CLI-028 | Negocio con 0 reseñas | Rating usa promedio bayesiano, no 0 ni vacío | `08-Growth-Monetization/01_Marketplace_Algorithm.md` |
| QA-CLI-029 | Perfil sin fotos cargadas | Placeholder de marca visible | `02-UX/04_Marketplace.md` |
| QA-CLI-030 | Agregar Negocio a Favoritos | Persiste entre sesiones | `02-UX/04_Marketplace.md` |
| QA-CLI-031 | Quitar de Favoritos | Se remueve inmediatamente | `02-UX/04_Marketplace.md` |
| QA-CLI-032 | Compartir link de perfil | Link público accesible sin sesión | `02-UX/04_Marketplace.md` |
| QA-CLI-033 | Dejar reseña sin Reserva `COMPLETADA` asociada | Bloqueado, no existe ese flujo | `04-Data-Model/01_Entities.md` |
| QA-CLI-034 | Dejar reseña tras Reserva `COMPLETADA` | Reseña `VISIBLE` publicada | `02-UX/04_Marketplace.md` |
| QA-CLI-035 | Editar reseña dentro de 48h | Permitido | `02-UX/04_Marketplace.md` |
| QA-CLI-036 | Editar reseña después de 48h | Opción no disponible | `02-UX/04_Marketplace.md` |
| QA-CLI-037 | Reportar una reseña ajena | Pasa a `REPORTADA`, excluida del Score mientras se revisa | `06-Security/03_Fraud.md` |
| QA-CLI-038 | Ver Score exacto de un resultado | Nunca expuesto, solo orden relativo | `05-API/05_Marketplace.md` |
| QA-CLI-039 | Rating agregado tras nueva reseña de 5★ | Se recalcula en la siguiente consulta | `08-Growth-Monetization/01_Marketplace_Algorithm.md` |
| QA-CLI-040 | Banner del Home configurado por SuperSU | Visible según vigencia | `02-UX/10_Super_Admin.md` |
| QA-CLI-041 | Banner fuera de vigencia | No visible | `02-UX/10_Super_Admin.md` |
| QA-CLI-042 | Desactivar personalización de recomendaciones | Cae a modo popularidad general | `09-CRM-Intelligence/02_AI_Client.md` |
| QA-CLI-043 | Cliente nuevo sin historial ve "Recomendados" | Muestra popularidad general, no vacío | `09-CRM-Intelligence/02_AI_Client.md` |
| QA-CLI-044 | Negocio calificado 1★ por el propio Cliente | Excluido de sus recomendaciones futuras | `09-CRM-Intelligence/02_AI_Client.md` |
| QA-CLI-045 | Ciudad deshabilitada por SuperSU | Negocios de esa ciudad no aparecen en descubrimiento | `02-UX/10_Super_Admin.md` |

### Reserva (QA-CLI-046 a 080)
| ID | Caso | Resultado esperado | Fuente |
|---|---|---|---|
| QA-CLI-046 | Ver slots disponibles válidos | Todos cumplen las 7 validaciones | `03-Business-Rules/02_Booking_Rules.md` |
| QA-CLI-047 | Seleccionar Staff específico | Slot filtrado a su disponibilidad real | `03-Business-Rules/02_Booking_Rules.md` |
| QA-CLI-048 | Seleccionar "Cualquiera disponible" | Asigna por prioridad de Nivel y carga | `03-Business-Rules/02_Booking_Rules.md` |
| QA-CLI-049 | Combo de 2 Servicios con mismo Staff posible | Duración = suma + buffers | `03-Business-Rules/02_Booking_Rules.md` |
| QA-CLI-050 | Combo con Servicios sin Staff en común | Bloqueado, sugiere reservar por separado | `02-UX/05_Booking.md` |
| QA-CLI-051 | Slot requiere Recurso y no hay disponible | No se muestra aunque haya Staff libre | `03-Business-Rules/02_Booking_Rules.md` |
| QA-CLI-052 | Dos Clientes confirman el mismo slot simultáneamente | Solo uno gana, el otro recibe `409` | `03-Business-Rules/02_Booking_Rules.md` |
| QA-CLI-053 | Intentar reservar antes del mínimo de anticipación del Negocio | Bloqueado con mensaje claro | `03-Business-Rules/02_Booking_Rules.md` |
| QA-CLI-054 | Intentar reservar más allá de la ventana máxima | Bloqueado | `03-Business-Rules/02_Booking_Rules.md` |
| QA-CLI-055 | No hay disponibilidad en 7 días | Se ofrece Lista de espera | `03-Business-Rules/10_Waitlist_System.md` |
| QA-CLI-056 | Unirse a Lista de espera | Entrada `ACTIVA` creada, FIFO respetado | `03-Business-Rules/10_Waitlist_System.md` |
| QA-CLI-057 | 6ª entrada de Lista de espera del mismo Cliente | Bloqueado (máx. 5) | `03-Business-Rules/10_Waitlist_System.md` |
| QA-CLI-058 | Cupo se libera, Cliente primero en cola | Notificado con ventana de 15 min | `03-Business-Rules/10_Waitlist_System.md` |
| QA-CLI-059 | No confirma dentro de 15 min | Se notifica al siguiente en cola | `03-Business-Rules/10_Waitlist_System.md` |
| QA-CLI-060 | Reprogramar dentro de la ventana permitida | Conserva mismo `id` de Reserva | `03-Business-Rules/02_Booking_Rules.md` |
| QA-CLI-061 | Reprogramar fuera de la ventana | Bloqueado con `VENTANA_REPROGRAMACION_VENCIDA` | `05-API/03_Bookings.md` |
| QA-CLI-062 | Reprogramar a un slot inválido | Mismas 7 validaciones aplican | `03-Business-Rules/02_Booking_Rules.md` |
| QA-CLI-063 | Cancelar con más de 24h de anticipación | Reembolso 100% | `03-Business-Rules/03_Payment_Rules.md` |
| QA-CLI-064 | Cancelar entre 24h y 2h | Reembolso 50% | `03-Business-Rules/03_Payment_Rules.md` |
| QA-CLI-065 | Cancelar con menos de 2h | Reembolso 0% | `03-Business-Rules/03_Payment_Rules.md` |
| QA-CLI-066 | Ver monto de reembolso antes de confirmar cancelación | Cifra exacta visible antes de confirmar | `02-UX/07_Appointments.md` |
| QA-CLI-067 | Negocio cancela la Reserva | Reembolso 100% sin importar ventana | `03-Business-Rules/02_Booking_Rules.md` |
| QA-CLI-068 | Perder conexión antes de confirmar pago | Slot no se bloquea indefinidamente | `03-Business-Rules/02_Booking_Rules.md` |
| QA-CLI-069 | Servicio se desactiva tras reservarlo | Reserva ya creada no se afecta | `03-Business-Rules/02_Booking_Rules.md` |
| QA-CLI-070 | Precio del Servicio cambia tras confirmar Reserva | Reserva conserva precio congelado | `Business_Rules_Bible.md` |
| QA-CLI-071 | Ver detalle de una Reserva | Servicio, Staff, Sede, monto, estado correctos | `02-UX/07_Appointments.md` |
| QA-CLI-072 | Filtrar Mis Citas por Próximas | Solo `PENDIENTE_PAGO`/`CONFIRMADA`/`EN_CURSO` | `02-UX/07_Appointments.md` |
| QA-CLI-073 | Filtrar Mis Citas por Historial | Solo `COMPLETADA`/`CANCELADA`/`NO_SHOW` | `02-UX/07_Appointments.md` |
| QA-CLI-074 | Reserva pasa a NO_SHOW mientras la pantalla está abierta | Se mueve a Historial sin refresco manual | `02-UX/07_Appointments.md` |
| QA-CLI-075 | Calificar dentro de 30 días de completada | Permitido | `02-UX/07_Appointments.md` |
| QA-CLI-076 | Calificar después de 30 días | Opción no disponible, validado server-side | `02-UX/07_Appointments.md` |
| QA-CLI-077 | Reservar dos citas simultáneas con Staff distinto | Ambas se crean, sin bloqueo cruzado | `Business_Rules_Bible.md` |
| QA-CLI-078 | Crear Reserva con `Idempotency-Key` repetida | Retorna la misma Reserva, no duplica | `05-API/01_Standards.md` |
| QA-CLI-079 | Reserva expira tras 10 min sin pago | Slot vuelve a estar disponible | `03-Business-Rules/03_Payment_Rules.md` |
| QA-CLI-080 | Pasarela confirma pago después de expirar la Reserva | Reembolso automático 100% | `03-Business-Rules/03_Payment_Rules.md` |

### Pago y fidelización (QA-CLI-081 a 110)
| ID | Caso | Resultado esperado | Fuente |
|---|---|---|---|
| QA-CLI-081 | Pagar Seña con Nequi | Pago `APROBADO`, Reserva `CONFIRMADA` | `03-Business-Rules/03_Payment_Rules.md` |
| QA-CLI-082 | Pagar Seña con PSE | Mismo resultado, medio distinto | `03-Business-Rules/03_Payment_Rules.md` |
| QA-CLI-083 | Pagar Seña con tarjeta | Mismo resultado | `03-Business-Rules/03_Payment_Rules.md` |
| QA-CLI-084 | Pago rechazado por la pasarela | Reserva vuelve a `PENDIENTE_PAGO`/disponible | `03-Business-Rules/03_Payment_Rules.md` |
| QA-CLI-085 | Ver política de cancelación antes de pagar | Siempre visible antes del botón de pago | `02-UX/05_Booking.md` |
| QA-CLI-086 | Seña calculada por defecto (20%, min $10.000, max $50.000) | Coincide exactamente | `03-Business-Rules/03_Payment_Rules.md` |
| QA-CLI-087 | Seña configurada supera el valor total del Servicio | Se limita al 100% del Servicio | `03-Business-Rules/03_Payment_Rules.md` |
| QA-CLI-088 | Agregar propina en el pago de Seña | Se registra como `pago` independiente | `08-Growth-Monetization/03_Tips_Distribution.md` |
| QA-CLI-089 | Agregar propina tras Reserva `COMPLETADA` | Notificación con acceso directo | `02-UX/06_Payments.md` |
| QA-CLI-090 | Cancelar Reserva con propina ya pagada | Propina se reembolsa 100% junto con Seña | `08-Growth-Monetization/03_Tips_Distribution.md` |
| QA-CLI-091 | Ningún monto de propina preseleccionado | Selector siempre parte sin selección | `02-UX/06_Payments.md` |
| QA-CLI-092 | Propina superior a 3x el valor del Servicio | Solicita confirmación adicional | `02-UX/06_Payments.md` |
| QA-CLI-093 | Doble tap en botón de pago | Solo un cobro se ejecuta | `05-API/01_Standards.md` |
| QA-CLI-094 | Comprar Gift Card | Saldo disponible para uso futuro | `01-PRD/03_Monetization.md` |
| QA-CLI-095 | Usar Gift Card como método de pago de Seña | Sin comisión adicional sobre su redención | `03-Business-Rules/03_Payment_Rules.md` |
| QA-CLI-096 | Suscribir Membresía a un Negocio | Cobro recurrente configurado | `03-Business-Rules/04_Lealtad.md` |
| QA-CLI-097 | Cancelar Membresía a mitad de ciclo | Beneficio se conserva hasta fin del ciclo pagado | `03-Business-Rules/04_Lealtad.md` |
| QA-CLI-098 | Fallo de cobro de Membresía | Pasa a `SUSPENDIDA_POR_IMPAGO`, pierde beneficio de inmediato | `08-Growth-Monetization/05_Billing_Failures.md` |
| QA-CLI-099 | Reserva completada otorga Puntos | 10 pts por cada $10.000 | `03-Business-Rules/04_Lealtad.md` |
| QA-CLI-100 | Reseña con texto otorga Puntos | +15 pts | `03-Business-Rules/04_Lealtad.md` |
| QA-CLI-101 | Referido completa su primera Reserva | +50 pts a quien refirió | `03-Business-Rules/04_Lealtad.md` |
| QA-CLI-102 | Canjear Puntos en Sede | Descuenta hasta $0, excedente permanece | `03-Business-Rules/04_Lealtad.md` |
| QA-CLI-103 | Puntos a 30 días de expirar | Notificación enviada | `03-Business-Rules/04_Lealtad.md` |
| QA-CLI-104 | Puntos expiran a los 12 meses (FIFO) | Lote más antiguo se consume/expira primero | `03-Business-Rules/04_Lealtad.md` |
| QA-CLI-105 | Negocio se suspende con Puntos del Cliente activos | Puntos se congelan, no canjeables | `03-Business-Rules/04_Lealtad.md` |
| QA-CLI-106 | Negocio se reactiva | Puntos vuelven a estar disponibles si no expiraron | `03-Business-Rules/04_Lealtad.md` |
| QA-CLI-107 | 3er strike de No-show en 90 días | Exige pago 100% anticipado en próximas Reservas | `03-Business-Rules/09_No_Show_Policy.md` |
| QA-CLI-108 | Strike expira pasado el periodo de 90 días | Exigencia de pago total se revierte automáticamente | `03-Business-Rules/09_No_Show_Policy.md` |
| QA-CLI-109 | Ver métodos de pago guardados | Datos sensibles enmascarados | `02-UX/06_Payments.md` |
| QA-CLI-110 | Solicitar exportación de datos propios (portabilidad) | Entregado dentro de 15 días hábiles | `04-Data-Model/05_Data_Retention.md` |

### Notificaciones y estados de error (QA-CLI-111 a 130)
| ID | Caso | Resultado esperado | Fuente |
|---|---|---|---|
| QA-CLI-111 | Recordatorio 24h antes de la cita | Push + WhatsApp (si habilitado) | `02-UX/11_Notifications.md` |
| QA-CLI-112 | Recordatorio 2h antes | Push | `02-UX/11_Notifications.md` |
| QA-CLI-113 | Reserva cancelada por Negocio | Push + WhatsApp + email | `02-UX/11_Notifications.md` |
| QA-CLI-114 | No-show de Staff | Disculpa automática + reagendar prioritario sin costo | `03-Business-Rules/09_No_Show_Policy.md` |
| QA-CLI-115 | Desactivar notificaciones promocionales | Transaccionales siguen activas | `02-UX/11_Notifications.md` |
| QA-CLI-116 | Intentar desactivar notificación transaccional | No permitido | `02-UX/11_Notifications.md` |
| QA-CLI-117 | Sin permiso de push, evento crítico ocurre | Cae a email + centro de notificaciones in-app | `02-UX/11_Notifications.md` |
| QA-CLI-118 | Pantalla con carga menor a 300ms | No muestra spinner | `02-UX/12_Errors_States.md` |
| QA-CLI-119 | Pantalla con carga mayor a 300ms | Muestra skeleton screen | `02-UX/12_Errors_States.md` |
| QA-CLI-120 | Pérdida de conexión durante navegación | Banner de offline no bloqueante | `02-UX/12_Errors_States.md` |
| QA-CLI-121 | Intentar pagar sin conexión | Acción deshabilitada con explicación | `02-UX/12_Errors_States.md` |
| QA-CLI-122 | Conexión se recupera | Pantalla activa se refresca automáticamente | `02-UX/12_Errors_States.md` |
| QA-CLI-123 | Error `5xx` del servidor | Ofrece reintentar y canal de soporte | `02-UX/12_Errors_States.md` |
| QA-CLI-124 | Error de dominio con `code` conocido | Mensaje humano específico, no genérico | `02-UX/12_Errors_States.md` |
| QA-CLI-125 | Lista vacía por filtro restrictivo | Ofrece "Quitar filtros" | `02-UX/12_Errors_States.md` |
| QA-CLI-126 | Lista vacía genuina (sin citas aún) | Mensaje explicativo + acción al Marketplace | `02-UX/12_Errors_States.md` |
| QA-CLI-127 | Escritura crítica en curso, segundo tap | Botón deshabilitado durante la espera | `02-UX/12_Errors_States.md` |
| QA-CLI-128 | Pago exitoso pero respuesta nunca llega al cliente | UI verifica estado real antes de permitir reintento | `02-UX/12_Errors_States.md` |
| QA-CLI-129 | Indicador de offline persiste tras reconectar | Se revalida cada pocos segundos | `02-UX/12_Errors_States.md` |
| QA-CLI-130 | Agregar cita confirmada a calendario del dispositivo | Archivo `.ics`/integración generado correctamente | `02-UX/06_Payments.md` |

## Estados
Cada caso valida transiciones de `04-Data-Model/03_State_Machines.md` según se referencia en la columna Fuente.

## Permisos
Todo caso de esta suite se ejecuta bajo el rol Cliente, salvo que se indique explícitamente lo contrario (verificación de rechazo de acceso de otro rol se cubre en `10_Regression.md`).

## Dependencias
Depende de `03-Business-Rules`, `05-API`, `02-UX` en su totalidad para la superficie Cliente.

## Casos límite
Los 130 casos de esta tabla derivan directamente de casos límite y reglas ya documentados en sus fuentes — no se listan casos límite adicionales aquí para evitar duplicación (`Documentation_Standards.md`).

## Criterios de aceptación
- [ ] 100% de los 130 casos tienen Fuente verificable.
- [ ] Los casos de severidad Crítica/Alta (pagos, doble reserva, No-show) pasan al 100% antes de cualquier release.

## Checklist
- [x] Completo (130 casos)
- [ ] Revisado
