# Business Rules Bible — El Contrato Lógico de StylerNow

## Objetivo

Este es el documento más importante de la Biblia. Es el contrato lógico del sistema: responde, en formato pregunta–respuesta, a los escenarios operativos concretos que un desarrollador, un Negocio o SuperSU enfrentarán en producción. Cada respuesta remite a la regla fuente — este documento no inventa reglas nuevas, las **conecta**.

Si una pregunta razonable sobre el comportamiento del sistema no tiene respuesta aquí ni en el documento fuente al que remite, es un vacío de documentación y debe corregirse de inmediato (ver `Documentation_Standards.md`).

## Alcance

Cubre preguntas transversales que involucran más de un dominio (Reservas + Pagos + Staff + Marketplace, etc.). Preguntas específicas de un solo dominio están más exhaustivamente resueltas en su documento de origen — este documento las referencia sin repetirlas íntegramente.

---

## Reservas y disponibilidad

**P: ¿Qué ocurre si dos Clientes confirman el mismo slot en el mismo instante?**
R: Un lock optimista a nivel de base de datos garantiza que solo una escritura gana; la otra recibe `409 CONFLICT` y su UI reacciona ofreciendo el siguiente horario libre o la Lista de espera. Ver `03-Business-Rules/02_Booking_Rules.md`.

**P: ¿Puede un Cliente reservar dos citas que se solapan en el mismo Negocio con Staff distinto?**
R: Sí — la validación de solapamiento es por `(staff_id o recurso_id, sede_id, rango horario)`, no por Cliente. El sistema no impide que un Cliente reserve dos citas simultáneas (posiblemente por error humano); es responsabilidad del Cliente gestionar su propia agenda. No se documenta como bloqueo porque restringirlo generaría falsos positivos (ej. una persona reservando para sí y para un acompañante desde la misma cuenta).

**P: ¿Qué pasa si un Servicio requiere dos Staff simultáneos (ej. un procedimiento a cuatro manos)?**
R: Fuera de alcance de V1. El modelo de Reserva asume un Staff principal por Reserva (más Recurso opcional). Un Servicio que requiere múltiples Staff se modela en V1 como dos Reservas encadenadas manuales. Se registra como mejora candidata para una fase posterior en `01-PRD/04_Roadmap.md` si se prioriza.

**P: ¿Cómo se decide qué Staff recibe una Reserva de "cualquiera disponible"?**
R: Prioridad por Nivel PRO/EXPERT/MASTER más alto, luego por menor carga del día, luego aleatorio. Ver `03-Business-Rules/02_Booking_Rules.md` y `03-Business-Rules/05_Staff_Rewards.md`.

**P: ¿Qué pasa si un Cliente reserva y luego el Negocio cambia el precio del Servicio antes de la cita?**
R: El precio queda congelado en la Reserva al momento de confirmarla (se copia el valor, no se referencia dinámicamente el precio actual del catálogo). Un cambio de precio del catálogo nunca afecta Reservas ya `CONFIRMADA`.

---

## Pagos

**P: ¿Qué pasa si Wompi (o cualquier pasarela) duplica un webhook?**
R: Cada notificación trae un id de transacción único; el segundo evento con el mismo id se reconoce (`200 OK`) sin repetir ningún efecto de negocio. Ver `03-Business-Rules/03_Payment_Rules.md` y `05-API/06_Webhooks.md`.

**P: ¿Qué pasa si el Cliente paga pero la confirmación de la pasarela nunca llega (timeout de red)?**
R: La Reserva expira a los 10 minutos en `PENDIENTE_PAGO`. Si la pasarela confirma después, el sistema detecta que la Reserva ya no existe en estado válido y reembolsa automáticamente el 100% sin intervención de soporte. Ver `03-Business-Rules/03_Payment_Rules.md`.

**P: ¿Puede un Negocio cobrar el 100% del Servicio por la plataforma en vez de solo la Seña?**
R: Sí, es una configuración opcional por Negocio ("pago completo en app"). Cuando está activa, la comisión de plataforma se calcula sobre el monto total procesado, no solo sobre la Seña (ver `08-Growth-Monetization/02_Commissions.md`).

**P: ¿Qué pasa si el Cliente hace un contracargo (disputa bancaria) después de que el servicio ya fue prestado?**
R: El pago pasa a `EN_DISPUTA`; el servicio ya prestado no se revierte; el caso se congela para resolución manual de SuperSU. Ver `03-Business-Rules/03_Payment_Rules.md`.

---

## Staff y el Sistema PRO/EXPERT/MASTER

**P: ¿Cómo se reparte una propina?**
R: El 100% de la propina va al Staff específico que el Cliente eligió (o al Staff que atendió la Reserva, si no hubo elección explícita). StylerNow no retiene comisión sobre propinas. Detalle completo, incluyendo el caso de propina en un combo con más de un Staff: `08-Growth-Monetization/03_Tips_Distribution.md`.

**P: ¿Cuándo expiran los Puntos de fidelización de un Cliente?**
R: A los 12 meses del otorgamiento, por lote (FIFO), con aviso 30 días antes. Nunca antes de 6 meses ni después de 24, sin importar la configuración del Negocio. Ver `03-Business-Rules/04_Loyalty.md`. (Nota: no confundir con el puntaje de Staff del Sistema PRO/EXPERT/MASTER, que se reinicia por temporada trimestral, no por expiración individual — ver `03-Business-Rules/05_Staff_Rewards.md`.)

**P: ¿Qué pasa si un Staff MASTER cambia de Sede dentro del mismo Negocio?**
R: Su Nivel y puntaje no cambian — el Nivel es por vínculo Staff–Negocio, no por Sede. Ver `03-Business-Rules/05_Staff_Rewards.md`.

**P: ¿Qué pasa si un Staff MASTER se retira del Negocio y se une a otro Negocio competidor?**
R: Empieza desde 0 en el Negocio nuevo — el Nivel nunca es transferible entre Negocios, ni siquiera para el mismo Staff, porque mide desempeño dentro de un contexto operativo específico. Ver `03-Business-Rules/05_Staff_Rewards.md`.

**P: ¿Cómo se mueve un Staff entre Sedes o Negocios sin perder su historial de Clientes atendidos?**
R: El historial de Reservas que atendió permanece asociado al `staff_id` y es visible en su App Staff en cualquier Negocio donde tenga vínculo activo, pero el CRM del Cliente (notas, etiquetas del Negocio) permanece en el Negocio, no viaja con el Staff. Ver `03-Business-Rules/07_CRM.md`, caso límite correspondiente.

**P: ¿Qué pasa si un Staff comete fraude para inflar su puntaje (ej. autorreservas)?**
R: Se revierte con eventos de auditoría opuestos explícitos (nunca edición directa) y, si es reincidente, se activa el protocolo de `06-Security/03_Fraud.md`, que puede congelar el Nivel del Staff durante investigación.

---

## Marketplace y publicidad

**P: ¿Puede un Negocio "comprar" el primer lugar del Marketplace sin ser relevante para la búsqueda?**
R: No. La regla invariante es que la publicidad nunca oculta resultados relevantes ni reemplaza la relevancia — puede destacar dentro de los resultados relevantes, nunca fuera de ellos. Ver `03-Business-Rules/06_Marketplace_Ads.md` y `08-Growth-Monetization/01_Marketplace_Algorithm.md`.

**P: ¿Qué pasa si se detectan reseñas falsas que inflan el Score de un Negocio?**
R: Se anulan las reseñas fraudulentas, se recalcula el Score, y el Negocio pierde elegibilidad para nuevas campañas de Ads hasta resolución del caso. Ver `06-Security/03_Fraud.md`.

**P: ¿Qué pasa con las campañas publicitarias activas si un Negocio es suspendido?**
R: Se pausan automáticamente; el presupuesto no gastado queda retenido en su Wallet, no se pierde ni se reembolsa mientras dure la suspensión. Ver `03-Business-Rules/06_Marketplace_Ads.md`.

---

## Negocios, Sedes y planes

**P: ¿Qué ocurre si una Sede cierra (definitivamente) mientras tiene Reservas futuras?**
R: Todas las Reservas futuras de esa Sede se cancelan automáticamente con reembolso al 100% (tratado igual que cancelación por el Negocio); todas las entradas de Lista de espera de esa Sede se marcan `CANCELADA` con notificación. Ver `08-Growth-Monetization/04_Subscriptions_Lifecycle.md` y `03-Business-Rules/10_Waitlist_System.md`.

**P: ¿Qué pasa si un Negocio Raven necesita más de 2 Staff (su tope absoluto) temporalmente (ej. temporada alta)?**
R: No hay excepción temporal automática — debe hacer upgrade a Jarl, incluso si es solo por un mes. El límite es duro por diseño (ver `01-PRD/03_Monetization.md`) para mantener la lógica de facturación simple y predecible.

**P: ¿Qué pasa si falla el cobro recurrente de la suscripción SaaS de un Negocio?**
R: Se sigue un flujo de reintentos con periodo de gracia antes de suspender el Negocio. Ver `08-Growth-Monetization/05_Billing_Failures.md` para el detalle exacto de reintentos y plazos.

**P: ¿Qué le pasa a un Negocio que hace downgrade de Valhalla a Jarl teniendo 3 Sedes activas?**
R: Bloqueado hasta que el Negocio reduzca a 1 Sede (transferir/cerrar las demás según el proceso de cierre de Sede). No hay downgrade parcial automático. Ver `08-Growth-Monetization/04_Subscriptions_Lifecycle.md`.

---

## CRM y datos del Cliente

**P: ¿Qué pasa si un Cliente pide que se eliminen sus datos (Habeas Data) pero tiene historial fiscal?**
R: Se anonimiza el perfil CRM (nombre, notas, fotos) preservando el registro transaccional anónimo requerido por retención fiscal. Ver `03-Business-Rules/07_CRM.md` y `06-Security/04_Compliance_Colombia.md`.

**P: ¿Puede un Negocio ver que un Cliente visita también a su competencia?**
R: No, nunca. El aislamiento de CRM por Negocio es absoluto — ver `03-Business-Rules/07_CRM.md`, Reglas de aislamiento.

**P: ¿Qué pasa si el Cliente cambia de número de teléfono?**
R: Los Puntos, historial y perfil sobreviven porque están atados al `cliente_id` interno, no al dato de contacto — el cambio de teléfono es una actualización de perfil, no una cuenta nueva. Ver `03-Business-Rules/04_Loyalty.md`.

---

## Inteligencia operativa (IA)

**P: ¿La IA puede tomar una acción automática sobre la cuenta de un Cliente o Staff (ej. suspenderlo)?**
R: No. Toda salida de IA en V1 es una **recomendación** presentada a un humano (Negocio o SuperSU) que decide y ejecuta — ver `09-CRM-Intelligence/04_AI_Business.md`, sección de limitaciones. La única excepción son los cálculos determinísticos ya cubiertos por reglas explícitas de esta Biblia (ej. expiración de puntos, No-show automático), que no son "IA", son reglas de negocio fijas.

---

## Seguridad y multi-tenancy

**P: ¿Puede una Barbería, por error de configuración de API, ver datos de otro Negocio?**
R: No debería ser posible ni siquiera con un error de aplicación, porque el aislamiento se garantiza con RLS a nivel de base de datos (`06-Security/02_RLS.md`), no solo con filtros de la capa de aplicación (ver ADL-004).

**P: ¿Qué pasa si SuperSU necesita depurar un problema dentro de un Negocio específico?**
R: Usa el modo impersonación auditado — nunca acceso directo silencioso a la base de datos de producción para casos operativos rutinarios. Ver `03-Business-Rules/01_Roles.md`, sección Modo impersonación.

---

## Referencia cruzada de casos límite por dominio

Este documento no repite el detalle exhaustivo de casos límite de cada dominio — ese detalle vive en la sección "Casos límite" del documento fuente de cada uno, listados en el índice consolidado `03-Business-Rules/08_Edge_Cases.md`. Cualquier escenario nuevo que surja durante el desarrollo y no tenga respuesta en ninguno de los dos documentos debe agregarse primero al documento de dominio correspondiente, y luego reflejarse aquí si es transversal.

## Estados
No aplica — este es un documento de referencia cruzada, no una entidad.

## Permisos
No aplica — lectura libre para todo el equipo.

## Dependencias
Depende de la totalidad de `03-Business-Rules`, `04-Data-Model`, `06-Security` y `08-Growth-Monetization`. Es la capa de síntesis sobre todos ellos.

## Casos límite
Ver la sección "Referencia cruzada" arriba — este documento delega, no duplica.

## Criterios de aceptación
- [ ] Toda pregunta de este documento remite a una fuente verificable, no a una afirmación sin respaldo.
- [ ] Ninguna respuesta contradice al documento que referencia.
- [ ] Este documento crece con cada escenario transversal nuevo que surja durante el desarrollo — no es un documento cerrado.

## Checklist
- [x] Completo (vivo)
- [ ] Revisado
