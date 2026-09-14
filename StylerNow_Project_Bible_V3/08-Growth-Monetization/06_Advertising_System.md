# 06 — Advertising System

## Objetivo
Especificar en detalle operativo cada formato publicitario del Marketplace — presupuesto, segmentación, facturación, métricas — construyendo sobre las reglas invariantes ya fijadas en `03-Business-Rules/06_Marketplace_Ads.md` y su interacción con `01_Marketplace_Algorithm.md`.

## Alcance
Diseño operativo del sistema publicitario. Las reglas que este sistema nunca puede violar (nunca ocultar resultados relevantes, siempre marcar como patrocinado, límite de saturación) ya están fijadas en `03-Business-Rules/06_Marketplace_Ads.md` y no se repiten aquí.

## Reglas

### Formatos

| Formato | Dónde aparece | Unidad de cobro |
|---|---|---|
| **Destacado** | Dentro de los resultados de búsqueda del Marketplace, con una etiqueta "Patrocinado" y un ligero resaltado visual — no cambia de posición fuera del rango que le da su Score real + bono de Patrocinio (ver `01_Marketplace_Algorithm.md`) | CPC (costo por clic al perfil) |
| **Pin patrocinado** | Fijado en la(s) primera(s) posición(es) de una categoría/búsqueda específica configurada por el Negocio (ej. "manicure en Chapinero"), respetando el límite de saturación de 2 posiciones consecutivas | CPM (costo por mil impresiones) o tarifa fija diaria, a elección del Negocio |
| **Banner** | Espacio editorial en el Home del Marketplace (rotativo entre Negocios con campaña de Banner activa en la ciudad del Cliente) | Tarifa fija diaria |
| **Promoción Flash** | Notificación push segmentada + posición temporal elevada durante una ventana corta (ej. 4 horas) para llenar horarios muertos | Tarifa fija por activación |

### Presupuesto y límites

- Todo formato requiere `presupuesto_diario` y, opcionalmente, `presupuesto_total` (tope del total de la campaña).
- El presupuesto diario nunca se excede, incluso si eso significa dejar de mostrar el anuncio antes de que termine el día (el gasto se detiene automáticamente al alcanzar el 100% del presupuesto diario).
- Límite de saturación (2 posiciones consecutivas patrocinadas máximo) se aplica a nivel de resultado de búsqueda combinado, sin importar cuántos Negocios distintos tengan campañas activas compitiendo por esa búsqueda.

### Segmentación

Un Negocio puede segmentar su campaña por: ciudad, categoría de Servicio, rango horario del día (para Promoción Flash, apuntar a horarios muertos específicos de su propia agenda), y radio de distancia desde su Sede. No se permite segmentar por atributos personales del Cliente más allá de ubicación (no hay segmentación demográfica en V1, para simplicidad y por prudencia de cumplimiento de datos).

### Facturación

- Modelo de prepago: el Negocio carga presupuesto a su Wallet (o lo debita de su saldo de comisión disponible) antes de que la campaña pueda activarse — StylerNow nunca factura publicidad a crédito.
- El gasto real ejecutado se descuenta del Wallet en tiempo real conforme se generan clics/impresiones/activaciones, con corte de reporte diario.
- Al pausar o finalizar una campaña, el presupuesto no consumido permanece en el Wallet, disponible para una campaña futura o para retiro según el ciclo de liquidación de `02_Commissions.md`.

### Métricas expuestas al Negocio

Impresiones, clics, tasa de clic (CTR), Reservas atribuidas (conversión directa desde el clic patrocinado dentro de una ventana de atención de 24 horas), costo por Reserva atribuida, gasto total y presupuesto restante — todo visible en tiempo real desde el Panel Negocio.

## Estados
Ver `04-Data-Model/03_State_Machines.md`, máquina "Campaña Publicitaria".

## Permisos
- Barbería (Plan Jarl+) crea y gestiona sus propias campañas, dentro de su propio presupuesto.
- SuperSU define tarifas de referencia (CPC/CPM base), puede pausar cualquier campaña, y ve métricas agregadas de ingresos publicitarios de toda la plataforma.

## Dependencias
- Depende de: `03-Business-Rules/06_Marketplace_Ads.md`, `01_Marketplace_Algorithm.md`, `02_Commissions.md` (Wallet).
- De este documento dependen: `02-UX/09_Business_Panel.md` (pantalla de gestión de campañas), `05-API/05_Marketplace.md`, `01-PRD/05_KPIs.md` (ingreso por publicidad).

## Casos límite

- **Una Promoción Flash se activa pero el Negocio no tiene disponibilidad real en el horario anunciado** (error de configuración). El sistema valida disponibilidad real al momento de activar la Flash y bloquea la activación si no hay slots disponibles en la ventana anunciada, para no publicitar un horario muerto que en realidad no existe.
- **El presupuesto del Wallet se agota a mitad del día mientras la campaña de Pin patrocinado está en la posición #1.** El anuncio se retira de inmediato de esa posición (no se muestra "fiado"); el resultado orgánico siguiente en Score toma su lugar sin dejar un hueco.
- **Dos Negocios pujan por el mismo Pin patrocinado en la misma búsqueda exacta con el mismo presupuesto.** Gana el que activó su campaña primero (orden de activación, no subasta en tiempo real en V1 — un sistema de subasta dinámica es una mejora candidata para una fase posterior, registrada como Decisión abierta).

## Criterios de aceptación
- [ ] Ninguna campaña gasta más de su `presupuesto_diario` configurado, verificado con una prueba de corte a medianoche.
- [ ] Toda Reserva atribuida a un clic patrocinado queda vinculada en el reporte del Negocio con trazabilidad completa.
- [ ] Ninguna Promoción Flash se activa sin disponibilidad real validada en el momento de activación.

## Checklist
- [x] Completo
- [ ] Revisado
