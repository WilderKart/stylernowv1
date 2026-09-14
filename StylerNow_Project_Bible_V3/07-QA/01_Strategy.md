# 01 — QA Strategy

## Objetivo
Definir la estrategia y metodología de pruebas de StylerNow, y establecer cómo los documentos `02` a `10` de esta carpeta alcanzan, en conjunto, el objetivo de más de 1.000 casos de prueba trazables a una regla de negocio real — nunca casos de relleno.

## Alcance
Estrategia general, pirámide de pruebas, entornos, criterios de entrada/salida, y el método de trazabilidad que conecta cada caso de prueba con su documento fuente. Los casos de prueba concretos están en `02` a `10`.

## Reglas

### Por qué QA se documenta al final

Consistente con ADL-007: cada caso de prueba de esta carpeta existe porque hay una regla, un estado, un permiso o un caso límite ya escrito en `03-Business-Rules`, `04-Data-Model`, `05-API`, `06-Security`, `08-Growth-Monetization`, `09-CRM-Intelligence` o `02-UX` que lo origina. Ningún caso de prueba de esta carpeta inventa una regla nueva — si un caso de prueba necesario revela que falta una regla, la regla se agrega primero al documento de dominio correspondiente, y el caso de prueba se agrega después.

### Pirámide de pruebas

1. **Unitarias** (mayor volumen, no contabilizadas en los ~1.000 casos de esta carpeta — viven en el repositorio de código): funciones puras como el cálculo de Score (`08-Growth-Monetization/01_Marketplace_Algorithm.md`) o el cálculo de puntaje de Staff (`03-Business-Rules/05_Staff_Rewards.md`).
2. **Integración / API** (la mayoría de los casos de `02` a `09` de esta carpeta): validan un endpoint completo de `05-API` contra una regla de negocio, incluyendo condiciones de error y permisos.
3. **End-to-end (E2E)** de journey completo (subconjunto de `10_Regression.md`): validan un flujo completo cruzando varias superficies (ej. Cliente reserva → Staff hace check-in → Barbería ve el reporte actualizado).
4. **Exploratorias/manuales**: casos que requieren juicio humano (ej. calidad percibida de una recomendación de IA, `09_AI.md`) — se documentan con criterio de evaluación explícito, no solo "probar y ver".

### Entornos

- **Staging**: réplica de producción, datos sintéticos, es donde se ejecuta el 100% de la suite antes de cualquier release (`10-Operations/05_Release_Process.md`).
- **Producción (smoke tests)**: subconjunto mínimo de `10_Regression.md` ejecutado inmediatamente después de cada release para detectar fallos críticos en minutos, no en el siguiente ciclo de pruebas completo.

### Formato de un caso de prueba

Cada caso de prueba en `02` a `10` sigue el formato: **ID | Precondición/Acción | Resultado esperado | Fuente**. El campo Fuente enlaza al documento y regla exacta que origina el caso — es lo que hace la suite trazable y evita que un caso de prueba "flote" sin justificación de negocio.

### Metodología para alcanzar >1.000 casos trazables

Cada regla, estado, transición, caso límite y criterio de aceptación de los ~63 documentos de dominio de esta Biblia genera, en promedio, entre 2 y 4 casos de prueba: el camino feliz, al menos un camino de error/rechazo, y — cuando aplica — una verificación de permiso (rol correcto vs. rol incorrecto) y una verificación de caso límite específico ya documentado. Con más de 300 reglas/estados/casos límite distintos documentados a lo largo de la Biblia, la multiplicación por esta metodología es lo que produce el volumen exigido sin relleno artificial — cada fila de las tablas de `02` a `10` es un caso real derivado de un documento fuente específico, verificable.

### Criterios de entrada y salida de una ronda de QA

**Entrada:** el documento de dominio correspondiente está `✅ Completo` en `README.md` (no se escriben casos de prueba contra una regla aún no definida).
**Salida:** 100% de los casos de prueba críticos y altos (ver clasificación de severidad abajo) pasan; casos medios/bajos fallidos se documentan como deuda conocida con ticket asociado, nunca se ignoran silenciosamente.

### Clasificación de severidad

- **Crítica**: pérdida de dinero, fuga de datos cross-tenant, doble cobro, reserva fantasma. Bloquea cualquier release.
- **Alta**: una regla de negocio central no se cumple (ej. un No-show no penaliza). Bloquea release salvo excepción explícita y documentada de SuperSU/CPO.
- **Media**: una regla secundaria o un caso límite no se cumple, con workaround disponible.
- **Baja**: cosmético o de UX menor sin impacto funcional.

## Estados
No aplica — documento de metodología.

## Permisos
No aplica — de lectura obligatoria para todo el equipo de QA e ingeniería.

## Dependencias
Depende de la totalidad de la Biblia (es la capa de verificación de todo lo anterior). De este documento dependen `02` a `10` de esta misma carpeta.

## Casos límite

- **Un caso de prueba de `02` a `10` no tiene una Fuente identificable.** Se elimina o se re-clasifica — un caso sin trazabilidad no cumple el estándar de esta estrategia, consistente con la prohibición de relleno de `Documentation_Standards.md`.
- **Una regla de negocio cambia después de que ya existe un caso de prueba basado en la versión anterior.** El caso de prueba se actualiza en el mismo cambio que actualiza la regla fuente — nunca queda un caso de prueba probando una regla obsoleta.

## Criterios de aceptación
- [ ] El total de casos de prueba entre `02_Client.md` y `10_Regression.md` supera 1.000, contado explícitamente al cierre de cada documento.
- [ ] El 100% de los casos tiene una Fuente verificable en otro documento de la Biblia.

## Checklist
- [x] Completo
- [ ] Revisado
