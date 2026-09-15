# Registro de Deuda Técnica

Mejoras detectadas que **no bloquean producción**. Si algo bloquea, va a
`PENDING_DECISIONS.md` o se corrige en el momento — esto es exclusivamente
para lo que puede esperar sin poner en riesgo un lanzamiento.

Cada entrada referencia el commit o módulo donde se detectó, para no
perder el contexto con el tiempo.

| Prioridad | Módulo | Impacto | Esfuerzo | Motivo |
|---|---|---|---|---|
| Baja | 2.2 Dashboard | Subestima levemente el % de ocupación cuando un bloqueo de ausencia se solapa solo parcialmente con una franja de disponibilidad (descuenta la franja completa, no la porción exacta) | Medio (aritmética de intersección de intervalos en SQL) | Documentado como simplificación V1 aceptable en `01-PRD/05_KPIs.md` — el caso típico (ausencia de día completo) ya es exacto |
| Baja | 2.4 Gestión de Staff | Documentos del Staff (certificados, contratos) no tienen pantalla ni storage — solo la arquitectura está prevista (bucket + tabla, sin tocar el resolutor de permisos) | Bajo cuando se necesite | Sin requisito concreto de qué documento guardar ni quién debe verlo todavía — construirlo ahora sería una tabla sin consumidor real |
| Media | 2.4 Gestión de Staff | La comisión de un Staff (`comision_pct`) se fija una sola vez al invitarlo y queda de solo lectura en su ficha — no hay forma de editarla después sin retirarlo y re-invitarlo | Bajo (una RPC `actualizar_comision_staff`, análoga a las ya existentes) | Pertenece conceptualmente a Finanzas (Módulo 2.10, no construido) — se prioriza cuando ese módulo se construya |
| Alta (antes de lanzamiento real) | Fase 1 — Legal | Los textos legales sembrados (Política de Datos, Términos v1) son un borrador funcional, no una revisión de un abogado colombiano | N/A — requiere revisión externa | Flaggeado desde el inicio del proyecto; no bloquea el desarrollo del producto, sí un lanzamiento comercial real |
| Baja | Fase 1 — Auditoría | No existe todavía una pantalla que muestre `evento_auditoria` de forma visual — los datos y los inserts ya existen | Medio | Corresponde a SuperSU CMS (Fase 3) y a Panel Negocio → Reportes (2.10); construir una pantalla suelta ahora duplicaría esa UI cuando lleguen esas fases |
| Media | 2.5 Servicios | `servicio_combo.precio_total_override`/`duracion_minutos_override` se guardan y se muestran en la ficha del combo, pero el motor de disponibilidad (`slots_disponibles`) sigue sumando la duración/precio de cada Servicio individual — el override todavía no tiene ningún efecto en una Reserva real | Medio (requiere detectar en `slots_disponibles` si el conjunto exacto de `servicio_ids` coincide con un combo configurado, y tocar ese RPC crítico) | `slots_disponibles` ya fue el origen de 2 bugs reales corregidos en sesiones anteriores (`max(uuid)`, `found` pisado) — se prioriza no arriesgar ese código verificado por una función opcional del combo |
| Baja | 2.9 Inventario | No existe una operación de "transferencia entre Sedes" (mover stock de la Sede A a la Sede B en un solo paso) — hay que registrar una SALIDA en una y una ENTRADA en la otra por separado | Bajo (una función que envuelva las dos llamadas ya existentes en una transacción) | Sin evidencia todavía de que sea un caso frecuente; se prioriza cuando un Negocio real lo pida — ver `ADR_009_Inventario_Stock_Por_Sede.md` |

## Cómo agregar una entrada
Cuando detectes algo que valga la pena mejorar pero que no bloquea el
módulo que estás cerrando: agregalo acá con el mismo formato, en vez de
dejarlo solo mencionado en un comentario de código que se puede perder.
