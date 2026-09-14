# Pricing Strategy

## Objetivo
Explicar el razonamiento de negocio detrás de los precios y límites exactos de `01-PRD/03_Monetization.md` — por qué cada número es el que es, no solo cuál es. Este documento es la justificación estratégica; `01-PRD/03_Monetization.md` es la referencia técnica exacta que ningún desarrollador debe tener que inferir de aquí.

## Alcance
Racional de precios, posicionamiento de cada Plan, economía de los addons, y psicología de upgrade. No redefine números — cualquier cifra debe coincidir exactamente con `01-PRD/03_Monetization.md`; si hay una discrepancia, gana `01-PRD/03_Monetization.md` y este documento se corrige.

## Reglas

### Posicionamiento de cada Plan

**Raven — el punto de entrada sin fricción.** Precio deliberadamente bajo ($69.900) para que un profesional independiente (1 persona, 1 silla) que hoy gestiona su agenda por WhatsApp o cuaderno no tenga excusa de costo para probar StylerNow. El tope duro de 2 Staff no es una limitación arbitraria — es una barrera de conversión deliberada: en el momento en que un Negocio Raven necesita un tercer Staff, ya dejó de ser "un profesional independiente" y su modelo de negocio justifica el salto a Jarl. El nombre "Raven" (cuervo, mensajero) comunica velocidad y simplicidad de arranque.

**Jarl — el plan de un negocio real.** Precio ($149.900) y límites (5 Staff incluidos, Guardian disponible, Marketplace Ads) diseñados para el caso más común del mercado objetivo: una barbería/salón de tamaño estándar con un equipo pequeño y un dueño que empieza a necesitar delegar supervisión operativa (de ahí que Guardian se habilite exactamente en este Plan, no antes). "Jarl" (título nórdico de gobernante local) comunica autoridad sobre un dominio acotado — coherente con que Jarl es de 1 sola Sede.

**Valhalla — el salto a multi-sede.** Precio ($349.900) y estructura (hasta 5 Sedes, 10 Staff incluidos, Guardian por Sede) diseñados para una cadena pequeña/mediana. El addon de Staff es más barato aquí ($15.000 vs. $20.000 en Jarl) deliberadamente — es un descuento de volumen que recompensa el compromiso de un Negocio más grande, y hace que crecer dentro de Valhalla sea más atractivo que quedarse fragmentado en varias cuentas Jarl. "Valhalla" (el gran salón de los caídos, un lugar de escala) comunica la ambición de operar en múltiples ubicaciones.

**Allfather — el trato a medida.** Sin autoservicio deliberadamente: un cliente que necesita API dedicada, SSO, SLA e integraciones a medida requiere una conversación comercial, no un formulario de checkout. "Allfather" (Odín, la máxima autoridad) comunica que este es el nivel sin límites predefinidos — aunque, consistente con `ADR_001_Monetization_Principles.md`, "sin límites predefinidos" significa "límites definidos por contrato", nunca "sin límites en absoluto".

### Economía de los addons (por qué cada precio de Staff/Sede adicional es el que es)

| Addon | Precio | Racional |
|---|---|---|
| Staff adicional en Jarl | $20.000/mes | Cubre holgadamente el costo marginal de soporte + almacenamiento + eventual consumo de IA/WhatsApp que un Staff adicional genera (ver `ADR_001_Monetization_Principles.md`) y deja margen — nunca se fija un addon por debajo del costo variable que ese Staff puede generar. |
| Staff adicional en Valhalla | $15.000/mes | Descuento de volumen: un Negocio que ya paga $349.900 base tiene una relación de mayor valor, y el costo marginal de soporte por Staff adicional baja ligeramente a escala (economía de atención al cliente por cuenta). |
| Sede adicional en Valhalla | $50.000/mes | Una Sede nueva implica overhead operativo real (nueva ubicación en el Marketplace, nuevo horario base, nueva configuración de Recurso/Staff) — el precio refleja que es una unidad de negocio nueva, no solo más usuarios sobre la misma unidad. |

### Principio rector: ningún precio se fija sin cubrir el costo variable que habilita

Todo precio de Plan o addon de esta estrategia fue diseñado para que, en el escenario de consumo esperado (no el peor caso, pero tampoco el mejor caso), el ingreso cubra el costo variable de IA + WhatsApp + almacenamiento asociado a ese nivel de uso, consistente con `ADR_001_Monetization_Principles.md`. Este es el motivo por el que los créditos IA y las conversaciones WhatsApp escalan con el precio del Plan (Raven 100/20, Jarl 600/100, Valhalla 2.500/500) en vez de ser un número plano igual para todos — un Plan más caro no solo desbloquea más funcionalidad estructural, también financia más consumo variable.

### Psicología de upgrade

- Los límites duros (Sedes, tope absoluto de Staff en Raven) se comunican **antes** de que el Negocio los alcance, no solo cuando fallan — el Panel Negocio muestra el consumo actual contra el límite del Plan de forma visible en todo momento (mismo patrón que `AI_Credit_System.md` y `WhatsApp_Delivery_Engine.md` para recursos variables).
- Un bloqueo por límite (`403 PLAN_LIMIT_EXCEEDED`) siempre ofrece la ruta de resolución más barata primero: si existe un addon (Staff/Sede adicional dentro del mismo Plan), se ofrece antes que el upgrade completo — nunca se empuja a un Negocio a pagar un salto de Plan completo cuando un addon puntual resuelve su necesidad real.

## Estados
No aplica — documento de estrategia, no de entidad transaccional.

## Permisos
No aplica — de lectura interna para Producto/Ventas/Finanzas; no se expone directamente al Negocio (el Negocio ve los precios y límites de `01-PRD/03_Monetization.md`, no el razonamiento interno de este documento).

## Dependencias
- Depende de: `ADR_001_Monetization_Principles.md`, `01-PRD/03_Monetization.md`, `AI_Credit_System.md`, `WhatsApp_Delivery_Engine.md`.
- De este documento no depende ningún otro documento normativo (es explicativo, no prescriptivo) — si algo aquí contradice `01-PRD/03_Monetization.md`, ese documento gana.

## Casos límite

- **Una futura revisión de precios quiere bajar el costo de Staff adicional en Jarl por debajo de $20.000.** Debe primero verificar contra `ADR_001_Monetization_Principles.md` que el nuevo precio sigue cubriendo el costo variable esperado — un cambio de precio que rompa ese principio requiere una entrada nueva del ADL, no solo una edición de este documento.
- **Un competidor lanza un plan de entrada más barato que Raven.** Este documento no es el lugar para una respuesta reactiva de precios — cualquier cambio de precio real se decide en `01-PRD/03_Monetization.md` con la aprobación correspondiente, y este documento se actualiza después para reflejar el nuevo racional, nunca al revés.

## Criterios de aceptación
- [ ] Todo número mencionado en este documento coincide exactamente con `01-PRD/03_Monetization.md`.
- [ ] Ningún precio o límite de este documento contradice el principio de `ADR_001_Monetization_Principles.md`.

## Checklist
- [x] Completo
- [ ] Revisado
