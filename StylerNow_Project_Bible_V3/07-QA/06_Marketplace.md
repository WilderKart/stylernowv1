# 06 — QA: Marketplace

## Objetivo
Casos de prueba del algoritmo de ranking, publicidad y su interacción con el modelo de fraude.

## Alcance
Pruebas de integración del motor de Marketplace (`08-Growth-Monetization/01_Marketplace_Algorithm.md`, `06_Advertising_System.md`) y las reglas invariantes de `03-Business-Rules/06_Marketplace_Ads.md`. Formato: ID | Caso | Resultado esperado | Fuente.

## Reglas — Casos de prueba

### Score y ranking (QA-MKT-001 a 030)
| ID | Caso | Resultado esperado | Fuente |
|---|---|---|---|
| QA-MKT-001 | Suma de pesos de todos los componentes del Score | Exactamente 1.0 | `08-Growth-Monetization/01_Marketplace_Algorithm.md` |
| QA-MKT-002 | Negocio con Rating 5★ y 0 disponibilidad vs. 4★ con disponibilidad hoy | El de disponibilidad puede superar según ponderación | `08-Growth-Monetization/01_Marketplace_Algorithm.md` |
| QA-MKT-003 | Negocio nuevo con 0 reseñas | Usa promedio bayesiano, no penalización extrema | `08-Growth-Monetization/01_Marketplace_Algorithm.md` |
| QA-MKT-004 | Negocio con 4+ reseñas recientes de 5★ | Rating normalizado sube gradualmente, no salto abrupto | `08-Growth-Monetization/01_Marketplace_Algorithm.md` |
| QA-MKT-005 | Cálculo de Proximidad para el resultado más cercano | Normalizado a 1 dentro del conjunto | `08-Growth-Monetization/01_Marketplace_Algorithm.md` |
| QA-MKT-006 | Cálculo de Disponibilidad sin slot en 7 días | Normalizado a 0 | `08-Growth-Monetization/01_Marketplace_Algorithm.md` |
| QA-MKT-007 | Cálculo de Conversión con historial de 90 días | Fórmula correcta | `08-Growth-Monetization/01_Marketplace_Algorithm.md` |
| QA-MKT-008 | Calidad de Staff con 50% de EXPERT/MASTER activo | Componente refleja proporción correcta | `03-Business-Rules/05_Staff_Rewards.md` |
| QA-MKT-009 | Empate exacto a 3 decimales | Desempate por Rating sin redondear | `08-Growth-Monetization/01_Marketplace_Algorithm.md` |
| QA-MKT-010 | Empate persistente tras Rating | Desempate por antigüedad (`fecha_alta`) | `08-Growth-Monetization/01_Marketplace_Algorithm.md` |
| QA-MKT-011 | Empate persistente tras antigüedad | Orden aleatorio estable por sesión | `08-Growth-Monetization/01_Marketplace_Algorithm.md` |
| QA-MKT-012 | Misma búsqueda repetida en la misma sesión | Mismo orden de resultados | `08-Growth-Monetization/01_Marketplace_Algorithm.md` |
| QA-MKT-013 | Negocio no `ACTIVO` | Excluido antes del cálculo de Score | `08-Growth-Monetization/01_Marketplace_Algorithm.md` |
| QA-MKT-014 | Negocio sin Servicio coincidente | Excluido | `08-Growth-Monetization/01_Marketplace_Algorithm.md` |
| QA-MKT-015 | Negocio fuera del radio geográfico | Excluido | `08-Growth-Monetization/01_Marketplace_Algorithm.md` |
| QA-MKT-016 | Negocio con `elegibilidad_marketplace = FALSE` | Excluido sin excepción | `08-Growth-Monetization/01_Marketplace_Algorithm.md` |
| QA-MKT-017 | Búsqueda sin resultados en el radio inicial | Radio se amplía en incrementos de 5km | `08-Growth-Monetization/01_Marketplace_Algorithm.md` |
| QA-MKT-018 | Radio ampliado hasta 50km sin resultados | Informa al Cliente, no falla silenciosamente | `08-Growth-Monetization/01_Marketplace_Algorithm.md` |
| QA-MKT-019 | Score recalculado tras cambio de disponibilidad | Refleja el cambio en la siguiente consulta, sin caché | `03-Business-Rules/06_Marketplace_Ads.md` |
| QA-MKT-020 | Barbería intenta ver Score exacto de un competidor | Solo posición relativa aproximada visible | `08-Growth-Monetization/01_Marketplace_Algorithm.md` |
| QA-MKT-021 | Negocio con Disponibilidad=0 pero campaña patrocinada activa | Sigue siendo elegible, pero Score cae por el peso de Disponibilidad | `08-Growth-Monetization/01_Marketplace_Algorithm.md` |
| QA-MKT-022 | Filtro de búsqueda "Mejor calificadas" | Ordena correctamente sobre Rating | `02-UX/04_Marketplace.md` |
| QA-MKT-023 | Filtro de búsqueda "Precio" | Ordena correctamente | `02-UX/04_Marketplace.md` |
| QA-MKT-024 | Búsqueda por especialidad de Staff | Filtra correctamente por `especialidad` | `Glossary.md` |
| QA-MKT-025 | Búsqueda multi-vertical (barbería + spa en la misma zona) | Ambas categorías aparecen correctamente | `01-PRD/01_Product_Vision.md` |
| QA-MKT-026 | Negocio recién aprobado aparece en el Marketplace | Visible inmediatamente tras `ACTIVO` | `04-Data-Model/03_State_Machines.md` |
| QA-MKT-027 | Negocio recién suspendido | Desaparece inmediatamente | `08-Growth-Monetization/04_Subscriptions_Lifecycle.md` |
| QA-MKT-028 | Cálculo de Score bajo carga concurrente alta | Consistente, sin condición de carrera en el cálculo | `08-Growth-Monetization/01_Marketplace_Algorithm.md` |
| QA-MKT-029 | Negocio Allfather con comisión especial | No afecta el Score (comisión no es un componente del ranking) | `08-Growth-Monetization/01_Marketplace_Algorithm.md` |
| QA-MKT-030 | Ver metadatos SEO de un perfil | Datos estructurados válidos (schema.org) | `02-UX/04_Marketplace.md` |

### Publicidad (QA-MKT-031 a 060)
| ID | Caso | Resultado esperado | Fuente |
|---|---|---|---|
| QA-MKT-031 | Crear campaña tipo Destacado | Etiquetada "Patrocinado" en resultados | `08-Growth-Monetization/06_Advertising_System.md` |
| QA-MKT-032 | Crear campaña tipo Pin patrocinado | Fijado en primera posición dentro del límite de saturación | `08-Growth-Monetization/06_Advertising_System.md` |
| QA-MKT-033 | Crear campaña tipo Banner | Rotativo en Home según ciudad | `08-Growth-Monetization/06_Advertising_System.md` |
| QA-MKT-034 | Crear Promoción Flash | Ventana temporal correcta | `08-Growth-Monetization/06_Advertising_System.md` |
| QA-MKT-035 | 3 Negocios patrocinados en la misma búsqueda | Máximo 2 posiciones consecutivas | `03-Business-Rules/06_Marketplace_Ads.md` |
| QA-MKT-036 | Resultado relevante no patrocinado | Nunca se oculta por falta de pago | `03-Business-Rules/06_Marketplace_Ads.md` |
| QA-MKT-037 | Presupuesto diario alcanzado | Anuncio se retira automáticamente el resto del día | `08-Growth-Monetization/06_Advertising_System.md` |
| QA-MKT-038 | Presupuesto total alcanzado | Campaña pasa a `AGOTADA` | `04-Data-Model/03_State_Machines.md` |
| QA-MKT-039 | Activar campaña sin saldo en Wallet | `402 SALDO_INSUFICIENTE` | `05-API/05_Marketplace.md` |
| QA-MKT-040 | Pausar campaña manualmente | Pasa a `PAUSADA` | `04-Data-Model/03_State_Machines.md` |
| QA-MKT-041 | Reanudar campaña pausada | Vuelve a `ACTIVA` | `04-Data-Model/03_State_Machines.md` |
| QA-MKT-042 | Campaña alcanza `fecha_fin` | Pasa a `FINALIZADA` | `04-Data-Model/03_State_Machines.md` |
| QA-MKT-043 | Anuncio `FINALIZADA` visible en caché del Cliente | Nunca ocurre, se recalcula por consulta | `03-Business-Rules/06_Marketplace_Ads.md` |
| QA-MKT-044 | Negocio suspendido con campaña activa | Se pausa automáticamente | `03-Business-Rules/06_Marketplace_Ads.md` |
| QA-MKT-045 | Presupuesto no consumido tras pausa por suspensión | Retenido en Wallet, no se pierde | `03-Business-Rules/06_Marketplace_Ads.md` |
| QA-MKT-046 | Segmentar campaña por ciudad | Solo aparece en la ciudad configurada | `08-Growth-Monetization/06_Advertising_System.md` |
| QA-MKT-047 | Segmentar campaña por categoría de Servicio | Solo aparece en búsquedas de esa categoría | `08-Growth-Monetization/06_Advertising_System.md` |
| QA-MKT-048 | Promoción Flash sin disponibilidad real | Bloqueada en validación previa | `08-Growth-Monetization/06_Advertising_System.md` |
| QA-MKT-049 | Ver métricas de campaña (impresiones, clics, CTR) | Datos correctos en tiempo real | `08-Growth-Monetization/06_Advertising_System.md` |
| QA-MKT-050 | Reserva atribuida a un clic patrocinado (ventana 24h) | Vinculada correctamente en el reporte | `08-Growth-Monetization/06_Advertising_System.md` |
| QA-MKT-051 | Reserva fuera de la ventana de 24h desde el clic | No atribuida a la campaña | `08-Growth-Monetization/06_Advertising_System.md` |
| QA-MKT-052 | Dos Negocios pujan por el mismo Pin | Gana el que activó primero | `08-Growth-Monetization/06_Advertising_System.md` |
| QA-MKT-053 | Facturación de campaña sin saldo prepago | Bloqueada (nunca a crédito) | `08-Growth-Monetization/06_Advertising_System.md` |
| QA-MKT-054 | Presupuesto no consumido al finalizar campaña | Permanece en Wallet | `08-Growth-Monetization/06_Advertising_System.md` |
| QA-MKT-055 | Negocio Plan Raven intenta crear campaña | Bloqueado (requiere Jarl+) | `01-PRD/03_Monetization.md` |
| QA-MKT-056 | SuperSU pausa cualquier campaña | Ejecutado con motivo auditado | `08-Growth-Monetization/06_Advertising_System.md` |
| QA-MKT-057 | Retirar campaña sin dejar hueco visual en el resultado | Siguiente resultado orgánico ocupa el lugar | `08-Growth-Monetization/06_Advertising_System.md` |
| QA-MKT-058 | CTR reportado coincide con el cálculo interno de facturación | Sin discrepancia | `08-Growth-Monetization/06_Advertising_System.md` |
| QA-MKT-059 | Corte diario de gasto a medianoche | Reinicia el contador de presupuesto diario | `08-Growth-Monetization/06_Advertising_System.md` |
| QA-MKT-060 | Segmentación demográfica solicitada por un Negocio | No disponible (fuera de alcance V1) | `08-Growth-Monetization/06_Advertising_System.md` |

### Fraude en Marketplace (QA-MKT-061 a 080)
| ID | Caso | Resultado esperado | Fuente |
|---|---|---|---|
| QA-MKT-061 | Cliente deja 4+ reseñas 5★ al mismo Negocio en 30 días | Señal de riesgo, revisión automática | `06-Security/03_Fraud.md` |
| QA-MKT-062 | Cliente deja reseñas 5★ legítimas a Negocios distintos | No activa la señal (umbral es por mismo Negocio) | `06-Security/03_Fraud.md` |
| QA-MKT-063 | Reseñas con texto casi idéntico entre distintos Clientes | Señal de granja de reseñas | `06-Security/03_Fraud.md` |
| QA-MKT-064 | Reseña reportada | Excluida del cálculo de Score mientras se investiga | `06-Security/03_Fraud.md` |
| QA-MKT-065 | Reseña confirmada como fraude, eliminada | Score se recalcula sin ella | `06-Security/03_Fraud.md` |
| QA-MKT-066 | Reseña reportada resulta legítima tras revisión | Vuelve a `VISIBLE`, se cuenta de nuevo en el Score | `06-Security/03_Fraud.md` |
| QA-MKT-067 | Negocio pierde elegibilidad publicitaria por fraude confirmado | No puede crear nuevas campañas | `03-Business-Rules/06_Marketplace_Ads.md` |
| QA-MKT-068 | Negocio con tasa de reembolso anómala | Entra a revisión antes de liquidación | `06-Security/03_Fraud.md` |
| QA-MKT-069 | Score de un Negocio bajo investigación de fraude | Excluye señales bajo revisión del cálculo | `06-Security/03_Fraud.md` |
| QA-MKT-070 | Ninguna sanción definitiva sin decisión de SuperSU | Verificado en el 100% de los casos de fraude | `06-Security/03_Fraud.md` |
| QA-MKT-071 | Señal de riesgo detectada pero determinada como falso positivo | Registro consultable de todas formas | `06-Security/03_Fraud.md` |
| QA-MKT-072 | Cliente con contracargos recurrentes en distintos Negocios | Marcado para revisión, posible restricción de medios de pago | `06-Security/03_Fraud.md` |
| QA-MKT-073 | Card testing detectado (múltiples rechazos consecutivos) | Bloqueo temporal automático del medio/dispositivo | `06-Security/03_Fraud.md` |
| QA-MKT-074 | Negocio reporta sospecha de fraude de un competidor | Registrado, no ejecuta ninguna acción directa | `06-Security/03_Fraud.md` |
| QA-MKT-075 | Verificación de que toda reseña referencia una `reserva COMPLETADA` | Estructuralmente imposible crear una sin eso | `04-Data-Model/01_Entities.md` |
| QA-MKT-076 | Staff eficiente genuino con duración corta de servicio | Señal de revisión, no sanción automática | `06-Security/03_Fraud.md` |
| QA-MKT-077 | Autorreserva de Staff detectada | Eventos de puntaje revertidos | `06-Security/03_Fraud.md` |
| QA-MKT-078 | Reincidencia de fraude de Staff | Puede escalar a suspensión del vínculo | `06-Security/03_Fraud.md` |
| QA-MKT-079 | Puntaje de Staff muy por encima de la desviación estándar del Negocio | Señal de revisión generada | `06-Security/03_Fraud.md` |
| QA-MKT-080 | Negocio con tasa de reembolso alta por causa legítima (ej. clima) | No se sanciona automáticamente, requiere revisión | `06-Security/03_Fraud.md` |

## Estados
Cada caso valida transiciones de Campaña, Reseña y `elegibilidad_marketplace`.

## Permisos
Casos ejecutados desde el rol correspondiente (Cliente, Barbería, SuperSU) según se indique en cada caso.

## Dependencias
Depende de `08-Growth-Monetization/01_Marketplace_Algorithm.md`, `06_Advertising_System.md`, `03-Business-Rules/06_Marketplace_Ads.md`, `06-Security/03_Fraud.md`.

## Casos límite
Derivados directamente de las fuentes citadas.

## Criterios de aceptación
- [ ] 100% de los 80 casos tienen Fuente verificable.
- [ ] Los casos de invariantes de Marketplace (QA-MKT-035, 036) pasan al 100% sin excepción.

## Checklist
- [x] Completo (80 casos)
- [ ] Revisado
