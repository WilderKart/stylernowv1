# 05 — QA: SuperSU CMS

## Objetivo
Casos de prueba del SuperSU CMS: aprobación/gestión de Negocios, Planes, configuración global sin código, moderación y soporte.

## Alcance
Pruebas de integración/E2E de la superficie SuperSU. Formato: ID | Caso | Resultado esperado | Fuente.

## Reglas — Casos de prueba

### Autenticación y acceso (QA-ADM-001 a 010)
| ID | Caso | Resultado esperado | Fuente |
|---|---|---|---|
| QA-ADM-001 | Login sin 2FA configurado | Bloqueado, 2FA obligatorio | `05-API/02_Auth.md` |
| QA-ADM-002 | Login con 2FA válido | Acceso concedido | `05-API/02_Auth.md` |
| QA-ADM-003 | Iniciar modo impersonación de un Negocio | Requiere motivo obligatorio | `03-Business-Rules/01_Roles.md` |
| QA-ADM-004 | Impersonación sin motivo | Bloqueado | `03-Business-Rules/01_Roles.md` |
| QA-ADM-005 | Impersonación expira a los 30 min de inactividad | Sesión de impersonación termina | `03-Business-Rules/01_Roles.md` |
| QA-ADM-006 | Intentar modificar comisión/Plan desde dentro de impersonación | Bloqueado | `03-Business-Rules/01_Roles.md` |
| QA-ADM-007 | 2FA de SuperSU expira a mitad de impersonación | Sesión de impersonación se invalida también | `05-API/02_Auth.md` |
| QA-ADM-008 | Toda acción durante impersonación | Auditada con ambos actores | `05-API/02_Auth.md` |
| QA-ADM-009 | Empleado de soporte sin rol SuperSU intenta acceso directo a datos | Bloqueado, no existe bypass de RLS por rol operativo | `06-Security/01_Security_Model.md` |
| QA-ADM-010 | Rol SuperSU no combina con rol de Negocio salvo impersonación | Verificado | `03-Business-Rules/01_Roles.md` |

### Gestión de Negocios (QA-ADM-011 a 030)
| ID | Caso | Resultado esperado | Fuente |
|---|---|---|---|
| QA-ADM-011 | Ver cola de Negocios `PENDIENTE_APROBACION` | Lista correcta | `02-UX/10_Super_Admin.md` |
| QA-ADM-012 | Aprobar un Negocio | Pasa a `ACTIVO`, visible en Marketplace | `04-Data-Model/03_State_Machines.md` |
| QA-ADM-013 | Rechazar un Negocio | Pasa a `RECHAZADO` | `04-Data-Model/03_State_Machines.md` |
| QA-ADM-014 | Suspender un Negocio por infracción | Motivo obligatorio, auditado | `08-Growth-Monetization/04_Subscriptions_Lifecycle.md` |
| QA-ADM-015 | Reactivar Negocio tras infracción resuelta | Requiere decisión explícita | `08-Growth-Monetization/04_Subscriptions_Lifecycle.md` |
| QA-ADM-016 | Ver detalle completo de un Negocio | Datos operativos y financieros visibles | `02-UX/10_Super_Admin.md` |
| QA-ADM-017 | Filtrar Negocios por estado | Resultado correcto | `02-UX/10_Super_Admin.md` |
| QA-ADM-018 | Cancelar definitivamente un Negocio | Terminal, efectos en cascada aplicados | `08-Growth-Monetization/04_Subscriptions_Lifecycle.md` |
| QA-ADM-019 | Ver mapa de ciudades activas | Datos agregados correctos | `02-UX/10_Super_Admin.md` |
| QA-ADM-020 | Exportar CSV de Negocios | Datos correctos y completos | `02-UX/10_Super_Admin.md` |
| QA-ADM-021 | Suspender Negocio con Reservas en curso (`EN_CURSO`) | La Reserva en curso se deja completar | `08-Growth-Monetization/04_Subscriptions_Lifecycle.md` |
| QA-ADM-022 | Forzar reactivación manual (pago verificado fuera de flujo) | Registrado con auditoría explícita | `08-Growth-Monetization/04_Subscriptions_Lifecycle.md` |
| QA-ADM-023 | Ajustar límite de tasa (rate limit) individual de un Negocio | Aplicado correctamente | `05-API/01_Standards.md` |
| QA-ADM-024 | Marcar `elegibilidad_marketplace = FALSE` | Negocio desaparece de resultados de inmediato | `08-Growth-Monetization/01_Marketplace_Algorithm.md` |
| QA-ADM-025 | Revertir sanción de elegibilidad | Negocio reaparece en resultados | `08-Growth-Monetization/01_Marketplace_Algorithm.md` |
| QA-ADM-026 | Negociar comisión especial para Negocio Allfather | Dentro del rango extendido permitido | `08-Growth-Monetization/02_Commissions.md` |
| QA-ADM-027 | Ver historial de auditoría de un Negocio específico | Completo y correcto | `04-Data-Model/04_Audit.md` |
| QA-ADM-028 | Buscar Negocio por nombre/ciudad | Resultado correcto | `02-UX/10_Super_Admin.md` |
| QA-ADM-029 | Ver actividad reciente en el Dashboard global | Eventos correctos y recientes | `02-UX/10_Super_Admin.md` |
| QA-ADM-030 | Negocio suspendido, Puntos de sus Clientes | Congelados correctamente | `03-Business-Rules/04_Loyalty.md` |

### Planes, configuración global y moderación (QA-ADM-031 a 065)
| ID | Caso | Resultado esperado | Fuente |
|---|---|---|---|
| QA-ADM-031 | Crear un Plan nuevo | Guardado con límites y funcionalidades | `04-Data-Model/01_Entities.md` |
| QA-ADM-032 | Editar precio de un Plan existente | Afecta solo nuevas suscripciones/renovaciones | `02-UX/10_Super_Admin.md` |
| QA-ADM-033 | Cambiar comisión global de plataforma | Aplica a transacciones futuras, no a `pago` en curso | `02-UX/10_Super_Admin.md` |
| QA-ADM-034 | Intentar comisión fuera de 3%-15% | Bloqueado | `08-Growth-Monetization/02_Commissions.md` |
| QA-ADM-035 | Habilitar una ciudad nueva | Negocios de esa ciudad pasan a ser descubribles | `02-UX/10_Super_Admin.md` |
| QA-ADM-036 | Deshabilitar una ciudad con Negocios `ACTIVO` | Desaparecen del Marketplace, no se suspenden | `02-UX/10_Super_Admin.md` |
| QA-ADM-037 | Crear banner del Home | Visible según vigencia configurada | `02-UX/10_Super_Admin.md` |
| QA-ADM-038 | Desactivar banner activo | Deja de mostrarse inmediatamente | `02-UX/10_Super_Admin.md` |
| QA-ADM-039 | Editar texto legal (Términos/Política de Datos) | Genera versión nueva, no sobreescribe | `02-UX/10_Super_Admin.md` |
| QA-ADM-040 | Cliente antiguo ante cambio material de Términos | Se exige re-aceptación en el siguiente login | `06-Security/04_Compliance_Colombia.md` |
| QA-ADM-041 | Activar Evento especial de doble puntos | Notificado con 3+ días de anticipación | `03-Business-Rules/05_Staff_Rewards.md` |
| QA-ADM-042 | Ver cola de reseñas reportadas | Lista correcta | `02-UX/10_Super_Admin.md` |
| QA-ADM-043 | Decidir "Mantener" sobre una reseña reportada | Vuelve a `VISIBLE` | `04-Data-Model/03_State_Machines.md` |
| QA-ADM-044 | Decidir "Eliminar" sobre una reseña reportada | Pasa a `ELIMINADA` (soft, no borrado físico) | `04-Data-Model/03_State_Machines.md` |
| QA-ADM-045 | Moderar reseña sin motivo | Bloqueado (motivo obligatorio) | `04-Data-Model/04_Audit.md` |
| QA-ADM-046 | Ver tickets de soporte de Negocios | Lista con estado correcto | `02-UX/10_Super_Admin.md` |
| QA-ADM-047 | Cambiar estado de un ticket (Abierto → En proceso → Resuelto) | Transición reflejada | `02-UX/10_Super_Admin.md` |
| QA-ADM-048 | Ver MRR agregado de la plataforma | Fórmula de `01-PRD/05_KPIs.md` | `01-PRD/05_KPIs.md` |
| QA-ADM-049 | Ver distribución de Niveles PRO/EXPERT/MASTER agregada | Cifras correctas | `01-PRD/05_KPIs.md` |
| QA-ADM-050 | Activar un Feature Flag por ciudad | Alcance limitado correctamente aplicado | `10-Operations/01_Feature_Flags.md` |
| QA-ADM-051 | Activar un Feature Flag globalmente | Afecta toda la plataforma | `10-Operations/01_Feature_Flags.md` |
| QA-ADM-052 | Flag queda "eterno" sin fecha de revisión | Marcado como hallazgo de gobierno de flags | `10-Operations/01_Feature_Flags.md` |
| QA-ADM-053 | Pausar calendario de reintentos por incidente de pasarela | Aplicado a nivel plataforma | `08-Growth-Monetization/05_Billing_Failures.md` |
| QA-ADM-054 | Detectar señal de fraude de reseñas | Reseñas pasan a `REPORTADA` automáticamente | `06-Security/03_Fraud.md` |
| QA-ADM-055 | Aplicar sanción definitiva de fraude | Requiere decisión explícita, nunca automática | `06-Security/03_Fraud.md` |
| QA-ADM-056 | Ver señal de manipulación de puntaje de Staff | Nivel del Staff señalado se congela | `06-Security/03_Fraud.md` |
| QA-ADM-057 | Ver tasa de reembolso anómala de un Negocio | Entra a revisión antes de la siguiente liquidación | `06-Security/03_Fraud.md` |
| QA-ADM-058 | Solicitud de derecho ARCO recibida | Flujo de producto identificable, no solo correo | `06-Security/04_Compliance_Colombia.md` |
| QA-ADM-059 | Ver log de auditoría completo de plataforma | Accesible solo por SuperSU | `04-Data-Model/04_Audit.md` |
| QA-ADM-060 | Cambiar límites de un Plan existente | No afecta suscripciones activas de forma retroactiva | `02-UX/10_Super_Admin.md` |
| QA-ADM-061 | Ver reporte de ingresos por comisión vs. por publicidad | Cifras separadas correctamente | `01-PRD/05_KPIs.md` |
| QA-ADM-062 | Pausar una campaña publicitaria de cualquier Negocio | Ejecutado con motivo | `08-Growth-Monetization/06_Advertising_System.md` |
| QA-ADM-063 | Configurar rango permitido de comisión de Staff | Aplica como techo/piso a nivel plataforma | `08-Growth-Monetization/02_Commissions.md` |
| QA-ADM-064 | Ver ciudades activas en mapa | Datos correctos | `02-UX/10_Super_Admin.md` |
| QA-ADM-065 | Revisar postmortem de un incidente y registrar en ADL | Entrada agregada correctamente | `06-Security/01_Security_Model.md` |

## Estados
Cada caso valida transiciones de Negocio, Reseña, Campaña y configuración de plataforma.

## Permisos
Todo caso bajo rol SuperSU exclusivamente.

## Dependencias
Depende de `03-Business-Rules/01_Roles.md`, `08-Growth-Monetization`, `06-Security`, `02-UX/10_Super_Admin.md`.

## Casos límite
Derivados directamente de las fuentes citadas.

## Criterios de aceptación
- [ ] 100% de los 65 casos tienen Fuente verificable.
- [ ] Ninguna sanción definitiva de fraude o suspensión se ejecuta sin motivo auditado.

## Checklist
- [x] Completo (65 casos)
- [ ] Revisado
