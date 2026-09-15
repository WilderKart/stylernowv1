# ADR-009 — Inventario: el stock se lleva por Sede, no por Negocio

## Estado
Aceptada. Resuelve la Decisión abierta que ADL-009 (sesión anterior) había registrado explícitamente sobre el módulo de Inventario: "se especificará como módulo completo (entidades, reglas, estados, API) en una fase posterior". Esta es esa fase — Módulo 2.9.

## Contexto

A diferencia de todos los módulos anteriores de la Fase 2, Inventario no tenía ningún documento de reglas de negocio en la Biblia. Lo único fijado de antemano era la matriz de permisos de `03-Business-Rules/01_Roles.md` (sección "Inventario"): Ver/Registrar entrada/Registrar salida/Solicitar reposición son 🏢 (alcance de **Sede**) para Guardian y 🌐 (Negocio completo) para Barbería; "Configurar reglas" es exclusivo de Barbería.

El catálogo de `producto` ya existía desde el Módulo 2.8 (POS) como una tabla a nivel de Negocio (mismo nombre/precio en todas las Sedes, igual que `servicio`). La pregunta que este ADR resuelve: ¿el **conteo físico** de stock también vive a nivel de Negocio, o por Sede?

Si el stock fuera a nivel Negocio, el alcance 🏢 de Guardian en la matriz de Roles no tendría ningún sentido — no hay nada que "limitar a su Sede" si todas las Sedes comparten el mismo número. Un negocio real con 3 sucursales tiene 3 estantes físicos distintos de shampoo, no uno solo repartido en la nube.

## Decisión

**El stock se modela como `producto_stock`, una tabla nueva con una fila por cada par (Producto, Sede)** — nunca una columna de cantidad directamente en `producto`. `producto` sigue siendo el catálogo compartido (nombre, precio); `producto_stock` es el conteo físico real, independiente por Sede.

Todo movimiento de stock pasa por una única función (`registrar_movimiento_inventario()` / `ajustar_stock()`), nunca un `UPDATE` directo — cada cambio deja una fila en `movimiento_inventario` (el libro mayor real; `stock_actual` en `producto_stock` es una caché derivada, nunca la fuente de verdad por sí sola). Esto es el mismo principio que ya regía en todo el proyecto: ningún saldo se muta sin dejar el movimiento que lo explica (comparar con `punto_fidelizacion`, `wallet`).

**Conectado con POS (2.8) y Servicios (2.5), como pide el roadmap explícitamente ("Conectar: Staff, Servicios, Sedes")**: `completar_venta_pos()` (migración 021) se extiende para descontar stock por dos caminos distintos, ambos auditados en `movimiento_inventario`:
1. **`SALIDA`** — Productos vendidos directamente en la venta de POS.
2. **`CONSUMO_SERVICIO`** — insumos que un Servicio gasta automáticamente al completarse (`servicio_producto_consumo`, ej. "Corte" consume 5 ml de "Shampoo"), sin que el Cliente los compre — nunca se cobran, solo se descuentan.

**Stock negativo permitido, sin `CHECK` que lo bloquee**: la realidad física (oversell, conteo desactualizado) no debe impedir que un Negocio cobre una cita ya hecha. Se prioriza no romper el flujo de cobro por un problema de inventario — la alerta visual (`stock_actual <= stock_minimo`) ya avisa del problema sin bloquear nada.

**Alertas en tiempo de consulta, no una columna que se pueda desincronizar**: "en alerta" es `stock_actual <= stock_minimo`, evaluado en cada lectura — nunca una bandera guardada que dependa de un job para actualizarse.

## Consecuencias

**Positivas:**
- El alcance de Guardian en la matriz de Roles (🏢, su Sede) ahora tiene un modelo de datos real que lo sostiene, no solo una regla de permisos sin dónde aplicarse.
- Conectar Inventario con POS y Servicios reutilizó exactamente las tablas y funciones ya existentes (`producto` de 2.8, `reserva_servicio` de Módulo 1) — nada se duplicó.
- El re-verificado completo de la suite de POS (14/14) tras extender `completar_venta_pos()` confirmó que agregar el descuento de stock no rompió ningún comportamiento ya probado.

**Negativas / Trade-offs aceptados:**
- Un Producto que se vende en una Sede pero se repone en otra requeriría un movimiento de "transferencia entre Sedes" — no se construyó en esta primera versión (no hay evidencia de que sea un caso frecuente todavía); un Negocio que lo necesite hoy puede simular una transferencia como una SALIDA en una Sede y una ENTRADA en la otra, registradas por separado.
- Sin `CHECK` de stock no-negativo, un reporte de inventario puede mostrar números negativos en negocios con mal hábito de registro — es una decisión consciente (no bloquear ventas), documentada acá para que no se lea como un bug.

## Alternativas consideradas

1. **Stock a nivel de Negocio (una sola cantidad, sin Sede).** Rechazada: contradice directamente el alcance 🏢 que la matriz de Roles ya le dio a Guardian para este módulo — sería una regla de permisos sin ningún dato real que limitar.
2. **Columna `stock_actual` directamente en `producto`, con una fila por Sede duplicando el catálogo.** Rechazada: duplicaría nombre/precio por cada Sede, exactamente el tipo de "arquitectura temporal" que la Regla de Oro prohíbe — `producto_stock` normaliza esto correctamente desde el día uno.

## Dependencias
- Depende de: `03-Business-Rules/01_Roles.md` (matriz "Inventario"), Módulo 2.5 (Servicios), Módulo 2.8 (POS, `producto` y `completar_venta_pos()`).
- De esta decisión depende: cualquier reporte de inventario futuro (2.10, Reportes) que quiera mostrar valorización de stock por Sede.

## Referencia cruzada
`Architecture_Decision_Log.md` (ADL nuevo), `00_MASTER_TASKLIST.md` (Módulo 2.9), `docs/TECH_DEBT_REGISTER.md` (transferencia entre Sedes, no construida).
