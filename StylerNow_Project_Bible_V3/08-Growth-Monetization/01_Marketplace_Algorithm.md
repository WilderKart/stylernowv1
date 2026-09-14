# 01 — Marketplace Algorithm

## Objetivo
Especificar la fórmula exacta de ranking del Marketplace, sus pesos, sus reglas de desempate y su tratamiento de fraude, de modo que el algoritmo sea una implementación directa de este documento y no una interpretación libre de la fórmula de una línea que existía antes.

## Alcance
Algoritmo de ranking orgánico y su interacción con contenido patrocinado. Las reglas invariantes que este algoritmo nunca puede violar están en `03-Business-Rules/06_Marketplace_Ads.md` (documento superior en jerarquía — ver `Documentation_Standards.md`, regla de contradicción). El sistema publicitario en sí (formatos, presupuestos, facturación) está en `06_Advertising_System.md`.

## Reglas

### Fórmula de Score

```
Score(negocio, búsqueda) =
    0.25 × Rating_normalizado
  + 0.20 × Proximidad_normalizada
  + 0.20 × Disponibilidad_normalizada
  + 0.15 × Conversión_normalizada
  + 0.10 × Calidad_de_Staff
  + 0.10 × Patrocinio_normalizado
```

Todos los componentes se normalizan a un rango `[0, 1]` antes de ponderar, para que ningún componente domine por tener una escala numérica distinta (ej. distancia en metros vs. rating de 1-5).

### Definición de cada componente

- **Rating_normalizado** — promedio de `calificacion` de `resena` (`VISIBLE`) de los últimos 12 meses del Negocio, normalizado sobre la escala 1-5 a 0-1. Un Negocio con menos de 5 reseñas usa un promedio bayesiano (se regresiona hacia el promedio general de la plataforma) para no premiar o castigar desproporcionadamente a Negocios nuevos con pocas reseñas.
- **Proximidad_normalizada** — inversamente proporcional a la distancia entre la ubicación del Cliente (o la ciudad buscada) y la Sede, normalizada dentro del conjunto de resultados de esa búsqueda específica (el Negocio más cercano del resultado obtiene 1, el más lejano dentro del radio de búsqueda obtiene 0).
- **Disponibilidad_normalizada** — 1 si el Negocio tiene al menos un slot disponible dentro de las próximas 48 horas que cumple los criterios de búsqueda (Servicio, y Staff si se especificó); decrece según cuántas horas faltan hasta el primer slot disponible, hasta 0 si no hay disponibilidad dentro de 7 días.
- **Conversión_normalizada** — tasa histórica de Reservas completadas ÷ visitas al perfil del Negocio desde el Marketplace, de los últimos 90 días, normalizada dentro del conjunto de resultados de esa búsqueda.
- **Calidad_de_Staff** — proporción de Staff en Nivel EXPERT o MASTER activo en la Sede relevante, sobre el total de Staff activo de esa Sede (ver `03-Business-Rules/05_Staff_Rewards.md`, sección "Impacto cuantificado").
- **Patrocinio_normalizado** — 1 si el Negocio tiene una `campana_publicitaria` activa y con presupuesto disponible para esa búsqueda (ciudad/categoría objetivo), 0 si no. No es binario en presencia dentro del resultado (ver invariante "nunca ocultar resultados relevantes"), solo afecta la posición relativa dentro de los resultados ya relevantes.

### Desempates

Si dos Negocios obtienen el mismo Score redondeado a 3 decimales: (1) gana el de mayor Rating_normalizado sin redondear, (2) si persiste el empate, gana el de mayor antigüedad en la plataforma (`fecha_alta` más antigua — recompensa la permanencia sobre la novedad), (3) si aún persiste, orden aleatorio estable por sesión de búsqueda (el mismo Cliente ve el mismo orden si repite la búsqueda en la misma sesión, para no generar la sensación de un ranking errático).

### Filtro de elegibilidad previo al Score

Antes de calcular el Score, se excluyen de los resultados los Negocios que: (a) no están en estado `ACTIVO`, (b) no tienen ningún Servicio que coincida con la búsqueda, (c) están fuera del radio geográfico configurado de la búsqueda, (d) han sido marcados con `elegibilidad_marketplace = FALSE` por SuperSU (sanción activa por fraude, ver `06-Security/03_Fraud.md`).

### Recalculo

El Score se recalcula en cada consulta al Marketplace (no se persiste ni se sirve desde caché de resultados de más de unos minutos), porque Disponibilidad y Conversión cambian constantemente — ver `03-Business-Rules/06_Marketplace_Ads.md`, caso límite de anuncio vencido.

## Estados
No aplica — el Score es un valor calculado en tiempo de consulta, no una entidad con estado propio.

## Permisos
- Cualquier Cliente consulta el Marketplace sin restricción.
- Solo SuperSU puede fijar `elegibilidad_marketplace = FALSE` sobre un Negocio.
- Ningún Barbería puede ver el Score exacto de un competidor, solo su propia posición relativa aproximada (rango, no número exacto) para evitar ingeniería inversa competitiva del algoritmo.

## Dependencias
- Depende de: `03-Business-Rules/06_Marketplace_Ads.md`, `03-Business-Rules/05_Staff_Rewards.md`, `06-Security/03_Fraud.md`.
- De este documento dependen: `02-UX/04_Marketplace.md`, `05-API/05_Marketplace.md`, `07-QA/06_Marketplace.md`.

## Casos límite

- **Un Negocio nuevo (0 reseñas) compite contra uno establecido con 500 reseñas de 4.5★.** El promedio bayesiano evita que el Negocio nuevo obtenga un 0 devastador ni un 5 inmerecido por una sola reseña de 5★ inicial — arranca cerca del promedio general de la plataforma y converge a su rating real conforme acumula reseñas.
- **Todos los Negocios de una búsqueda están fuera del radio configurado (zona con poca oferta).** El sistema amplía automáticamente el radio de búsqueda en incrementos (ej. +5km) hasta encontrar al menos 3 resultados o alcanzar un límite máximo de 50km, informando al Cliente que se amplió la búsqueda.
- **Un Negocio con campaña patrocinada activa tiene Disponibilidad_normalizada = 0 (sin cupo en 7 días).** Sigue siendo elegible para aparecer (pasó el filtro de elegibilidad si coincide con la búsqueda), pero su Score total cae significativamente por el peso de 0.20 en Disponibilidad — el patrocinio no compensa la falta de disponibilidad real, es coherente con "nunca ocultar resultados relevantes" pero también con no promover un Negocio que no puede atender al Cliente pronto.

## Criterios de aceptación
- [ ] La suma de los pesos de todos los componentes del Score es exactamente 1.0.
- [ ] Ningún Negocio con `elegibilidad_marketplace = FALSE` aparece en ningún resultado de búsqueda, verificado con una prueba automatizada.
- [ ] El recalculo del Score refleja un cambio de disponibilidad dentro de la misma sesión de búsqueda (sin caché obsoleta).

## Checklist
- [x] Completo
- [ ] Revisado
