# 02 — AI: Cliente (Recomendaciones)

## Objetivo
Especificar la única función de IA orientada al Cliente en V1 — recomendaciones de descubrimiento — con entradas, proceso, salida y límites explícitos, consistente con la instrucción de la misión: "no construir chatbot, construir inteligencia operativa".

## Alcance
Recomendaciones dentro del Marketplace de la Cliente PWA. No cubre IA de Staff (`03_AI_Staff.md`) ni de Negocio (`04_AI_Business.md`).

## Reglas

### Función: Recomendación de Negocios

**Entradas:**
- Historial de Reservas del propio Cliente (Servicios reservados, Negocios visitados, calificación dada).
- Ubicación actual/ciudad.
- Comportamiento de Clientes con perfil similar (Servicios en común, categoría de Negocio en común) — filtrado colaborativo básico.
- Señales del Marketplace ya calculadas (`08-Growth-Monetization/01_Marketplace_Algorithm.md`: Rating, Disponibilidad).

**Proceso:**
Combina el historial propio del Cliente con similitud de comportamiento agregado de otros Clientes para priorizar, dentro de los resultados ya filtrados por relevancia geográfica/de categoría, cuáles mostrar primero en la sección "Recomendados para ti" del Home (`02-UX/04_Marketplace.md`) — **nunca** reemplaza ni reordena el ranking principal de búsqueda explícita, que sigue las reglas invariantes de `03-Business-Rules/06_Marketplace_Ads.md`; es una sección adicional, no una sustitución del Score.

**Salida:**
Lista ordenada de hasta 10 Negocios sugeridos, cada uno con una razón breve visible ("Porque reservaste Corte + barba antes", "Popular entre clientes como tú").

**Costo y nivel de IA:** Nivel 1 (IA económica), cacheada 24h por Cliente (no se recalcula en cada apertura de Home). A diferencia de las funciones de `03_AI_Staff.md` y `04_AI_Business.md` (que un Negocio específico solicita para sus propios fines y por lo tanto consumen los créditos de ese Negocio), esta función es infraestructura de descubrimiento del Marketplace que beneficia a la plataforma en su conjunto — su costo lo absorbe StylerNow como costo operativo del Marketplace (igual que el cálculo de Score, aunque ese es Nivel 0 y este es Nivel 1), **no** se descuenta de los créditos de ningún Negocio individual. Ver `AI_Credit_System.md`, sección Nivel 1, para la distinción exacta entre funciones que cobran a un Negocio y funciones de infraestructura de plataforma. **Resuelto por ADR-014, Fase E (2026-09-16):** esta función ("Recomendación de Negocios al Cliente", el widget del Home del Marketplace) es **Recomendación Marketplace** — gratuita, algoritmo de plataforma, nunca consume créditos de ningún Negocio, sin excepción. La acción `recomendacion` de `ai_accion_costo` (cobrable al Negocio) es una función DISTINTA — **Recomendación IA del Negocio**: la sugerencia personalizada que el Motor de recompensas de Lealtad genera para un Cliente específico ante un disparador (cumpleaños, objetivo logrado — ver `03-Business-Rules/04_Lealtad.md`, Módulo 12), pedida por un Negocio para su propio beneficio operativo, igual que `campana_asistida`/`prediccion_abandono`. Ambas comparten un nombre parecido mas no son la misma función — no requieren renombrarse en el código porque el contexto (quién la invoca y para qué) ya las distingue sin ambigüedad.

**Limitaciones (explícitas, consistente con `Business_Rules_Bible.md`):**
- No genera contenido de texto libre dirigido al Cliente (no es un chatbot conversacional en V1).
- No tiene acceso a datos de Clientes de otros Negocios más allá de agregados anónimos de comportamiento (nunca expone qué reservó un Cliente específico a otro Cliente).
- Si el Cliente tiene menos de 2 Reservas históricas, la función cae a una recomendación basada solo en popularidad general de la zona (sin personalización, por falta de señal suficiente) — se comunica implícitamente mostrando Negocios "Populares cerca de ti" en vez de "Recomendados para ti".

## Estados
No aplica — es un cálculo de recomendación, no una entidad transaccional.

## Permisos
El Cliente puede desactivar la personalización (Casos de `06-Security/04_Compliance_Colombia.md`, derecho de oposición) — al hacerlo, la sección cae permanentemente al modo de popularidad general para ese Cliente hasta que reactive la personalización.

## Dependencias
- Depende de: `08-Growth-Monetization/01_Marketplace_Algorithm.md`, `01_CRM_Complete.md`, `06-Security/04_Compliance_Colombia.md`, `AI_Credit_System.md`.
- De este documento dependen: `02-UX/04_Marketplace.md`, `07-QA/09_AI.md`.

## Casos límite

- **Un Cliente nuevo sin ninguna Reserva previa abre la app por primera vez.** Ve exclusively recomendaciones de popularidad general — no hay una salida vacía ni un error, es un comportamiento por diseño ya cubierto en las Limitaciones.
- **Las recomendaciones sugieren un Negocio que el Cliente ya calificó negativamente (1-2 estrellas en su propia reseña).** Se excluye explícitamente ese Negocio de sus recomendaciones futuras — la propia señal negativa del Cliente pesa más que la similitud de comportamiento agregado de otros.
- **Un Cliente desactiva la personalización a mitad de sesión.** El cambio aplica en la siguiente carga del Home, no requiere reiniciar la app.

## Criterios de aceptación
- [ ] La sección "Recomendados para ti" nunca reemplaza los resultados de una búsqueda explícita del Cliente.
- [ ] Ningún Negocio calificado negativamente por el propio Cliente aparece en sus recomendaciones personalizadas.
- [ ] Desactivar la personalización se refleja en la siguiente carga de pantalla, sin requerir reinicio de sesión.

## Checklist
- [x] Completo
- [ ] Revisado
