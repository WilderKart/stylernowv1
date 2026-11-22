# 02 · Suite `tests/sql/directiva_116_118.sql` actualizada al comportamiento de la migración 133

**Clasificación: CORREGIDO (prueba actualizada; no cambia ninguna regla de negocio ni código).**

## 1. Qué fallaba y por qué
Caso 118: «la prueba sin tarjeta vencida debe pasar a `REQUIERE_PLAN`». Hoy el sistema la deja en `EN_MORA`. **No es una regresión:** la migración 133 (`133_pago_plan_checkout_pro_y_gracia.sql`, cabecera y `mantenimiento_suscripciones()`) cambió deliberadamente el flujo:
```
TRIAL ── vence ──▶ EN_MORA (gracia configurada; sigue recibiendo reservas) ── vence la gracia ──▶ REQUIERE_PLAN
ACTIVA ── vence el periodo pagado ──▶ EN_MORA (gracia) ── vence la gracia ──▶ SUSPENDIDA (IMPAGO)
```
(`configuracion_plataforma.suscripcion_gracia_dias`, 3 por defecto). La prueba 118 original se escribió antes de la 133 y esperaba el salto directo.

## 2. Qué reglas originales siguen vigentes (y siguen probadas)
- Solo el servidor inicia pruebas; un no-dueño no puede.
- Huellas triviales rechazadas.
- Prueba sin tarjeta iniciada con la duración configurable.
- La prueba vencida **conserva el historial** (`prueba_fin` no nulo) y termina en `REQUIERE_PLAN`.
- **Una sola prueba por negocio** (`PRUEBA_YA_USADA`).
- La modalidad `CON_TARJETA` rechaza una prueba sin tarjeta; la modalidad la decide el Super Admin.

## 3. Qué se cambió (único bloque, líneas ~388-415)
Una sola expectativa obsoleta se dividió en dos pasos que reflejan el criterio vigente:
1. Prueba vencida + mantenimiento → `EN_MORA`, con `gracia_fin` futuro y `prueba_fin` conservado.
2. Gracia vencida (`gracia_fin` en el pasado) + mantenimiento → `REQUIERE_PLAN`, `prueba_fin` conservado, y se repite la comprobación de que no se puede repetir la prueba.
Todos los demás escenarios (reembolsos, libro inmutable, comisión programada, cancelación 24/2/50, no presentación) quedaron intactos.

## 4. Cambio de criterio de negocio
**Ninguno nuevo.** La prueba se alineó con la regla ya vigente en la 133 (gracia). No inventé reglas: no se definió, por ejemplo, el número de días de gracia (se usa el configurado) ni se probó que `EN_MORA` permita reservar (lo dice la cabecera de la 133, pero **esa afirmación no está cubierta por esta suite**: PENDIENTE de prueba específica, riesgo bajo).

## 5. Evidencia
```
docker exec -i supabase_db_stylernow-cierre psql -U postgres -d limpia -v ON_ERROR_STOP=1 < tests/sql/directiva_116_118.sql
NOTICE:  OK 118/133: prueba vencida -> EN_MORA con gracia -> REQUIERE_PLAN, sin cobro y una sola prueba por negocio
```
Resultado completo de las 22 suites en `05_RESULTADOS_PRUEBAS.md`.
