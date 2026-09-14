# 04 — AI: Negocio (Inteligencia Operativa)

## Objetivo
Especificar las funciones de IA orientadas al Negocio en su conjunto — predicción de ocupación, riesgo de abandono de Cliente, sugerencia de campañas, detección de horarios muertos, oportunidades — cada una con entradas, proceso, salida y límites, consolidando la ambición de "inteligencia operativa, no chatbot" declarada en la misión.

## Alcance
Cuatro funciones de IA para la Barbería. Cada función es independiente y puede fallar/estar no disponible sin afectar a las demás.

## Reglas

### Función 1 — Predicción de ocupación

**Entradas:** historial de Reservas de las últimas 12 semanas del Negocio (por día de semana y franja horaria), estacionalidad (fechas festivas colombianas), tendencia reciente (últimas 4 semanas vs. las 8 anteriores).
**Proceso:** proyecta la ocupación esperada de los próximos 14 días por franja horaria.
**Salida:** vista de calendario con un indicador de "ocupación esperada" (bajo/medio/alto) superpuesto sobre la Agenda del Panel Negocio, antes de que las Reservas reales lleguen.
**Limitación:** es una proyección estadística, no una garantía — se etiqueta explícitamente como "Estimado" en la UI, nunca como un número de certeza absoluta.
**Costo y nivel de IA:** Nivel 2 (IA Premium) — 10 créditos del Negocio por corrida, cada 14 días, por Sede. Ver `AI_Credit_System.md`.

### Función 2 — Riesgo de abandono de Cliente

**Entradas:** frecuencia histórica de visitas del Cliente, días desde la última visita, cambio en su patrón habitual (ej. un Cliente que visitaba cada 3 semanas y ya lleva 8 sin volver), si dejó una reseña negativa reciente, si tuvo un No-show o cancelación reciente.
**Proceso:** calcula un nivel de riesgo (bajo/medio/alto) por Cliente, recalculado semanalmente.
**Salida:** se muestra en el perfil CRM del Cliente (`01_CRM_Complete.md`) y alimenta el segmento sugerido "Clientes en riesgo" para campañas de retención.
**Limitación:** no predice una fecha exacta de abandono, solo un nivel de riesgo relativo dentro de la base de Clientes del propio Negocio.
**Costo y nivel de IA:** Nivel 1 (IA económica) — 1 crédito del Negocio por Cliente evaluado, calculado en lote semanal (no por consulta individual cuando la Barbería abre el perfil de un Cliente — el cálculo ya está hecho y cacheado desde el lote). Ver `AI_Credit_System.md`.

### Función 3 — Sugerencia de campañas

**Entradas:** segmentos de Clientes (`01_CRM_Complete.md`), resultado de campañas anteriores del mismo Negocio (si las hay), horarios muertos detectados (Función 4).
**Proceso:** combina segmento + oportunidad de agenda para sugerir una campaña concreta (ej. "12 Clientes en riesgo de abandono + martes por la tarde con baja ocupación → sugerir 15% de descuento en ese horario para ese segmento").
**Salida:** tarjeta de sugerencia de campaña con un botón de "Crear campaña con estos parámetros" que pre-llena el formulario de notificación/promoción, pero **requiere que la Barbería la revise y confirme explícitamente el envío** — nunca se dispara una campaña ni un descuento sin acción humana.
**Costo y nivel de IA:** Nivel 2 (IA Premium) — 8 créditos del Negocio por sugerencia generada, bajo demanda (cuando la Barbería/Guardian abre la sección de campañas sugeridas), cacheada 24h. Ver `AI_Credit_System.md`.

### Función 4 — Horarios muertos y oportunidades

**Entradas:** disponibilidad configurada vs. Reservas reales, por Staff y franja horaria, últimas 8 semanas.
**Proceso:** identifica franjas con ocupación sistemáticamente baja.
**Salida:** alimenta la Función 3 y también se expone directamente como sugerencia de activar una Promoción Flash (`08-Growth-Monetization/06_Advertising_System.md`) en esa franja específica.
**Costo y nivel de IA:** **Nivel 0 (sin IA, gratuito, sin límite)** — es un conteo estadístico simple sobre disponibilidad vs. Reservas reales, resuelto enteramente con reglas fijas, sin modelo de IA ni consumo de créditos. Ver `AI_Credit_System.md`.

## Estados
No aplica — funciones de cálculo, no entidades transaccionales.

## Permisos
Exclusivo de Barbería y Guardian (alcance de su Sede). Ninguna función de esta sección es visible para Staff ni Cliente.

## Dependencias
- Depende de: `01_CRM_Complete.md`, `03-Business-Rules/09_No_Show_Policy.md`, `08-Growth-Monetization/06_Advertising_System.md`, `01-PRD/05_KPIs.md`, `AI_Credit_System.md`.
- De este documento dependen: `02-UX/09_Business_Panel.md`, `02-UX/11_Notifications.md` (canal de las campañas sugeridas), `07-QA/09_AI.md`.

### Nota transversal — Limitación general (consistente con `Business_Rules_Bible.md`)

Ninguna de las 4 funciones de este documento ejecuta una acción irreversible o de costo (enviar una campaña, aplicar un descuento, cambiar un precio) sin confirmación explícita de un humano con rol Barbería o Guardian. La IA en StylerNow V1 **recomienda**, nunca **actúa** de forma autónoma sobre datos de negocio o dinero.

## Casos límite

- **Un Negocio nuevo no tiene suficiente historial (menos de 4 semanas de operación) para ninguna de las 4 funciones.** Todas las funciones se muestran con un estado explícito de "Aún no hay suficientes datos" en vez de una predicción poco confiable disfrazada de certeza — nunca se inventa una proyección sin base.
- **La predicción de ocupación resulta muy distinta de la realidad en una semana específica** (evento atípico, ej. un puente festivo no capturado en el modelo de estacionalidad). Se documenta como una limitación conocida del modelo estadístico simple de V1; una mejora con calendario festivo colombiano completo es candidata de refinamiento continuo, no un bloqueante de lanzamiento.
- **Dos funciones distintas (riesgo de abandono y sugerencia de campaña) generan recomendaciones que se solapan sobre el mismo Cliente** (ej. aparece en "riesgo alto" y también en una sugerencia de campaña). Es el comportamiento esperado — no es una contradicción, es la Función 3 construyendo sobre la salida de la Función 2 correctamente.

## Criterios de aceptación
- [ ] Ninguna de las 4 funciones ejecuta un cambio de datos, envío de notificación o cargo económico sin confirmación explícita de una Barbería/Guardian.
- [ ] Toda predicción/estimación se etiqueta visualmente como tal, nunca presentada como un hecho certero.
- [ ] Un Negocio con menos de 4 semanas de historial ve el estado "datos insuficientes" en vez de una salida numérica poco confiable.

## Checklist
- [x] Completo
- [ ] Revisado
