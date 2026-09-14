# 03 — QA: App Staff

## Objetivo
Casos de prueba de la App Staff: agenda, check-in/check-out, Nivel PRO/EXPERT/MASTER, disponibilidad, ganancias, clientes atendidos.

## Alcance
Pruebas de integración/E2E de la superficie Staff. Formato: ID | Caso | Resultado esperado | Fuente.

## Reglas — Casos de prueba

### Onboarding e identidad (QA-STF-001 a 015)
| ID | Caso | Resultado esperado | Fuente |
|---|---|---|---|
| QA-STF-001 | Recibir invitación por email/SMS | Link único de un solo uso, expira en 7 días | `02-UX/02_Onboarding.md` |
| QA-STF-002 | Aceptar invitación sin cuenta previa | Crea cuenta y activa vínculo | `02-UX/02_Onboarding.md` |
| QA-STF-003 | Aceptar invitación con cuenta existente (ya Cliente) | Solo confirma con sesión existente | `02-UX/02_Onboarding.md` |
| QA-STF-004 | Invitación expira sin aceptar | Vínculo nunca se crea, se puede reenviar | `02-UX/02_Onboarding.md` |
| QA-STF-005 | Completar perfil (foto, bio, especialidad) | Guardado correctamente | `02-UX/02_Onboarding.md` |
| QA-STF-006 | Vínculo pasa a `ACTIVO` tras aceptar | Visible en selección de Staff del Cliente | `03-Business-Rules/01_Roles.md` |
| QA-STF-007 | Staff con vínculo a 2 Negocios selecciona contexto | Sesión refleja un solo contexto a la vez | `05-API/02_Auth.md` |
| QA-STF-008 | Cambiar de contexto de Negocio | Emite token nuevo | `05-API/02_Auth.md` |
| QA-STF-009 | Staff sin ningún vínculo activo abre la app | Estado vacío explicativo, no pantalla en blanco | `02-UX/08_Staff_App.md` |
| QA-STF-010 | Staff es también Barbería del mismo Negocio | Accede a ambas apps sin fricción | `01-PRD/02_Functional_Architecture.md` |
| QA-STF-011 | Staff cambia de Sede dentro del mismo Negocio | Vínculo y puntaje se conservan | `04-Data-Model/03_State_Machines.md` |
| QA-STF-012 | Staff renuncia (`RETIRADO`) | Pierde acceso a agenda de ese Negocio | `03-Business-Rules/01_Roles.md` |
| QA-STF-013 | Staff reingresa dentro de la misma temporada | Conserva puntaje al momento del retiro | `03-Business-Rules/05_Staff_Rewards.md` |
| QA-STF-014 | Staff reingresa tras una temporada completa de brecha | Puntaje reinicia a 0 | `03-Business-Rules/05_Staff_Rewards.md` |
| QA-STF-015 | Barbería suspende el vínculo de un Staff | Staff pierde acceso operativo, historial se conserva | `04-Data-Model/03_State_Machines.md` |

### Agenda y check-in/check-out (QA-STF-016 a 045)
| ID | Caso | Resultado esperado | Fuente |
|---|---|---|---|
| QA-STF-016 | Ver agenda del día | Solo citas propias | `06-Security/02_RLS.md` |
| QA-STF-017 | Intentar ver agenda de otro Staff | Bloqueado a nivel de datos | `06-Security/02_RLS.md` |
| QA-STF-018 | Check-in dentro de ventana válida | Reserva pasa a `EN_CURSO` | `05-API/03_Bookings.md` |
| QA-STF-019 | Check-in antes de la hora permitida | Bloqueado | `05-API/03_Bookings.md` |
| QA-STF-020 | Check-in después de marcado `NO_SHOW` | `422 CHECKIN_FUERA_DE_VENTANA` | `05-API/03_Bookings.md` |
| QA-STF-021 | Check-out tras servicio | Reserva pasa a `COMPLETADA` | `05-API/03_Bookings.md` |
| QA-STF-022 | Cita a menos de 15 min sin check-in | Indicador visual de riesgo de No-show | `02-UX/08_Staff_App.md` |
| QA-STF-023 | Cita transcurre 15 min sin check-in ni cancelación | Pasa a `NO_SHOW` automáticamente | `03-Business-Rules/09_No_Show_Policy.md` |
| QA-STF-024 | Marcar manualmente No-show del Cliente antes de los 15 min | Registrado con mismo efecto | `03-Business-Rules/09_No_Show_Policy.md` |
| QA-STF-025 | Cliente llega tarde pero dentro de 15 min | Staff decide si atender, sin penalización automática | `03-Business-Rules/09_No_Show_Policy.md` |
| QA-STF-026 | No-show atribuible al Staff | Penalización -40 pts, reembolso 100% al Cliente | `03-Business-Rules/09_No_Show_Policy.md` |
| QA-STF-027 | 2+ No-show de Staff en 30 días | Alerta visible a la Barbería | `03-Business-Rules/09_No_Show_Policy.md` |
| QA-STF-028 | Falla de conectividad impide check-in a tiempo | Barbería puede revertir el No-show manualmente | `03-Business-Rules/09_No_Show_Policy.md` |
| QA-STF-029 | Crear un `bloqueo_ausencia` sin conflicto | Se guarda | `04-Data-Model/01_Entities.md` |
| QA-STF-030 | Crear `bloqueo_ausencia` que se solapa con citas confirmadas | Alerta de conflicto, exige resolución previa | `02-UX/08_Staff_App.md` |
| QA-STF-031 | Configurar disponibilidad semanal base | Refleja en validaciones de Reserva | `04-Data-Model/01_Entities.md` |
| QA-STF-032 | Reducir horario con Reservas ya confirmadas fuera del nuevo rango | Bloqueado hasta reprogramar/cancelar | `03-Business-Rules/02_Booking_Rules.md` |
| QA-STF-033 | Crear cita manual (reserva telefónica) desde Panel Negocio | Mismas 7 validaciones que una reserva de Cliente | `02-UX/09_Business_Panel.md` |
| QA-STF-034 | Ver línea de tiempo del día completo | Orden cronológico correcto | `02-UX/09_Business_Panel.md` |
| QA-STF-035 | Cita con Recurso requerido sin Recurso libre | No se muestra como agendable | `03-Business-Rules/02_Booking_Rules.md` |
| QA-STF-036 | Dos check-in simultáneos en condición de carrera | Solo una transición válida se aplica | `04-Data-Model/03_State_Machines.md` |
| QA-STF-037 | Check-in de cita que ya está `EN_CURSO` | Rechazado (transición no listada) | `04-Data-Model/03_State_Machines.md` |
| QA-STF-038 | Check-out de cita que aún está `CONFIRMADA` (sin check-in previo) | Rechazado (transición no listada) | `04-Data-Model/03_State_Machines.md` |
| QA-STF-039 | Ver historial de check-ins a tiempo de la semana | Refleja bono de "semana perfecta" si aplica | `03-Business-Rules/05_Staff_Rewards.md` |
| QA-STF-040 | Llegar tarde (check-in +5 min) | -10 pts, visible en el desglose | `03-Business-Rules/05_Staff_Rewards.md` |
| QA-STF-041 | Día perfecto de puntualidad | +5 pts | `03-Business-Rules/05_Staff_Rewards.md` |
| QA-STF-042 | Semana perfecta de puntualidad | +40 pts adicionales al bono diario | `03-Business-Rules/05_Staff_Rewards.md` |
| QA-STF-043 | Servicio marcado completado en tiempo irrealmente corto | Señal de fraude generada para revisión | `06-Security/03_Fraud.md` |
| QA-STF-044 | Staff atiende Cliente recurrente (2ª visita) | +12 pts de Calidad | `03-Business-Rules/05_Staff_Rewards.md` |
| QA-STF-045 | Queja válida confirmada por el Negocio | -30 pts | `03-Business-Rules/05_Staff_Rewards.md` |

### Nivel PRO/EXPERT/MASTER (QA-STF-046 a 070)
| ID | Caso | Resultado esperado | Fuente |
|---|---|---|---|
| QA-STF-046 | Puntaje 0-999 | Nivel PRO | `03-Business-Rules/05_Staff_Rewards.md` |
| QA-STF-047 | Puntaje 1000-2999 | Nivel EXPERT | `03-Business-Rules/05_Staff_Rewards.md` |
| QA-STF-048 | Puntaje 3000+ | Nivel MASTER | `03-Business-Rules/05_Staff_Rewards.md` |
| QA-STF-049 | Subir de nivel a mitad de temporada | Reflejado en tiempo real, no espera al cierre | `03-Business-Rules/05_Staff_Rewards.md` |
| QA-STF-050 | Cierre de temporada consolidando MASTER | Temporada siguiente arranca en EXPERT (1000 pts) | `03-Business-Rules/05_Staff_Rewards.md` |
| QA-STF-051 | Cierre de temporada consolidando EXPERT | Siguiente arranca en PRO (0 pts) | `03-Business-Rules/05_Staff_Rewards.md` |
| QA-STF-052 | Cierre de temporada consolidando PRO | Siguiente arranca en PRO (0 pts) | `03-Business-Rules/05_Staff_Rewards.md` |
| QA-STF-053 | Staff en 2 Negocios con niveles distintos | Cada Negocio calcula independiente | `03-Business-Rules/05_Staff_Rewards.md` |
| QA-STF-054 | Puntaje nunca queda negativo | Piso en 0 dentro de la temporada | `03-Business-Rules/05_Staff_Rewards.md` |
| QA-STF-055 | Ver desglose de puntaje por categoría | Producción/Calidad/Puntualidad visibles | `02-UX/08_Staff_App.md` |
| QA-STF-056 | Revertir un evento de puntaje erróneo | Genera evento opuesto, nunca edita el original | `03-Business-Rules/05_Staff_Rewards.md` |
| QA-STF-057 | Obtener logro "Racha de Oro" | 30 días sin tardanza, insignia permanente | `03-Business-Rules/05_Staff_Rewards.md` |
| QA-STF-058 | Logro se conserva tras degradación de temporada | Insignias no se pierden con el nivel | `03-Business-Rules/05_Staff_Rewards.md` |
| QA-STF-059 | Evento especial de doble puntos activo | Puntaje de eventos aplicables se duplica | `03-Business-Rules/05_Staff_Rewards.md` |
| QA-STF-060 | Reto de Negocio configurado por la Barbería | Bono aparte, no contamina puntaje de plataforma | `03-Business-Rules/05_Staff_Rewards.md` |
| QA-STF-061 | Beneficio de nivel PRO (badge, cursos) | Visible al Staff | `03-Business-Rules/05_Staff_Rewards.md` |
| QA-STF-062 | Beneficio de nivel EXPERT (comisión configurable) | Barbería puede escalonar dentro de rango | `08-Growth-Monetization/02_Commissions.md` |
| QA-STF-063 | Beneficio de nivel MASTER (prioridad `CUALQUIERA_DISPONIBLE`) | Se asigna primero en la cola de prioridad | `03-Business-Rules/02_Booking_Rules.md` |
| QA-STF-064 | Negocio con Staff MASTER activo | Score de Marketplace recibe bono de Calidad de Staff | `08-Growth-Monetization/01_Marketplace_Algorithm.md` |
| QA-STF-065 | Fraude confirmado (autorreserva) | Eventos revertidos, Nivel congelado | `06-Security/03_Fraud.md` |
| QA-STF-066 | Staff congelado no puede subir de nivel | Verificado durante investigación | `06-Security/03_Fraud.md` |
| QA-STF-067 | Negocio con 1 solo Staff, temporada parcial | Cálculo proporcional, sin ajuste especial de umbral | `03-Business-Rules/05_Staff_Rewards.md` |
| QA-STF-068 | Ver historial de temporadas pasadas | Nivel consolidado de cada una visible | `02-UX/08_Staff_App.md` |
| QA-STF-069 | Intentar editar el puntaje manualmente (cualquier rol) | Rechazado, solo lectura fuera de eventos de sistema | `04-Data-Model/04_Audit.md` |
| QA-STF-070 | Puntaje mostrado en App Staff vs. cálculo interno | Coinciden exactamente en el mismo instante | `03-Business-Rules/05_Staff_Rewards.md` |

### Ganancias y clientes (QA-STF-071 a 090)
| ID | Caso | Resultado esperado | Fuente |
|---|---|---|---|
| QA-STF-071 | Ver comisión propia del periodo | Coincide con `comision_pct` configurado | `08-Growth-Monetization/02_Commissions.md` |
| QA-STF-072 | Ver propinas recibidas | Desglose por Cliente y fecha | `08-Growth-Monetization/03_Tips_Distribution.md` |
| QA-STF-073 | Propina no genera comisión de plataforma | Verificado en el cálculo | `08-Growth-Monetization/03_Tips_Distribution.md` |
| QA-STF-074 | Staff con comisión configurada al mínimo (20%) | Aceptado | `08-Growth-Monetization/02_Commissions.md` |
| QA-STF-075 | Intento de configurar comisión fuera de 20%-80% | Bloqueado | `08-Growth-Monetization/02_Commissions.md` |
| QA-STF-076 | Ver lista de Clientes atendidos personalmente | Solo los propios, no el CRM completo | `03-Business-Rules/07_CRM.md` |
| QA-STF-077 | Intentar ver Cliente no atendido por él | Bloqueado a nivel de RLS | `06-Security/02_RLS.md` |
| QA-STF-078 | Agregar nota privada a un Cliente propio | Guardada, no visible para otro Staff | `03-Business-Rules/07_CRM.md` |
| QA-STF-079 | Staff deja el Negocio, historial de Clientes atendidos | Permanece en el CRM del Negocio, no viaja con el Staff | `03-Business-Rules/07_CRM.md` |
| QA-STF-080 | Ver ranking agregado de Staff (si el Negocio lo habilita) | Visible sin exponer datos privados de otros | `03-Business-Rules/01_Roles.md` |
| QA-STF-081 | Editar perfil propio (foto, bio, especialidad) | Guardado correctamente | `02-UX/08_Staff_App.md` |
| QA-STF-082 | Ver panel de insights de IA de rendimiento propio | No accesible (exclusivo de Barbería/Guardian) | `09-CRM-Intelligence/03_AI_Staff.md` |
| QA-STF-083 | Staff deja el Negocio con propinas no liquidadas | Monto permanece visible y reclamable | `08-Growth-Monetization/03_Tips_Distribution.md` |
| QA-STF-084 | Reembolso de una Reserva ya con comisión acreditada | Comisión se revierte proporcionalmente | `08-Growth-Monetization/02_Commissions.md` |
| QA-STF-085 | Ver ganancias filtradas por periodo (día/semana/mes) | Cifras correctas por rango | `02-UX/08_Staff_App.md` |
| QA-STF-086 | Staff en Negocio Allfather con comisión negociada | Refleja el valor negociado, no el estándar | `08-Growth-Monetization/02_Commissions.md` |
| QA-STF-087 | Retiro automático de propinas al Staff | No disponible en V1 (Decisión abierta) | `08-Growth-Monetization/03_Tips_Distribution.md` |
| QA-STF-088 | Ver Servicio premium completado | +25 pts de producción reflejados | `03-Business-Rules/05_Staff_Rewards.md` |
| QA-STF-089 | Ver combo completado | +18 pts de producción | `03-Business-Rules/05_Staff_Rewards.md` |
| QA-STF-090 | Sesión expira tras 30 min de impersonación de SuperSU (contexto de soporte) | Termina automáticamente | `03-Business-Rules/01_Roles.md` |

## Estados
Cada caso valida transiciones de `04-Data-Model/03_State_Machines.md` (Reserva, Vínculo Staff-Negocio, Temporada).

## Permisos
Todo caso bajo rol Staff, salvo verificaciones explícitas de rechazo cruzado (RLS).

## Dependencias
Depende de `03-Business-Rules/01_Roles.md`, `03-Business-Rules/05_Staff_Rewards.md`, `03-Business-Rules/09_No_Show_Policy.md`, `05-API/03_Bookings.md`, `02-UX/08_Staff_App.md`.

## Casos límite
Derivados directamente de las fuentes citadas; no se duplican aquí.

## Criterios de aceptación
- [ ] 100% de los 90 casos tienen Fuente verificable.
- [ ] Los casos de aislamiento de datos (RLS) pasan al 100% sin excepción.

## Checklist
- [x] Completo (90 casos)
- [ ] Revisado
