# ADR-013 — AI OS: Monetización, Motor de Costos y Fundaciones Transversales de IA

## Estado
Aprobada e implementada por instrucción directa del fundador (2026-09-16). El documento original incluía una extensión ("EXTENSIÓN DEL ADR-012") pidiendo AI Cost Simulator + ROI Dashboard IA — ambos incluidos en esta ADR con el mismo número (ADR-013) para no colisionar con `ADR_012_Component_Registry_Governance.md`, ya usado.

## Contexto
`credito_ia_lote`/`credito_ia_consumo` (migración 004) y `pago_tipo = 'PAQUETE_CREDITOS_IA'` (migración 001) existían desde el inicio del proyecto sin ningún consumidor real — mismo patrón "arquitectura lista, nunca conectada" encontrado varias veces en esta sesión. El ADR-011 (Motor de Lealtad) conectó el primer proveedor real de IA (`AIProvider`: OpenRouter + Nemotron con failover), pero sin ningún motor de costos, créditos ni memoria detrás — cualquier llamada de IA hasta ese punto no tenía límite de consumo ni se cobraba a nadie. El fundador pidió una arquitectura completa de monetización de IA **antes** de seguir construyendo funciones de IA orientadas a Cliente/Staff/Negocio, bajo el principio oficial: **"StylerNow nunca subsidia IA"**.

## Decisión

### Principio rector
Ninguna función de IA con costo real se ejecuta sin descontar créditos del Negocio. Los créditos limitan **cuánto** puede usarse una función; **qué** funciones existen las define el Plan contratado (`plan_funcion_ia`) — nunca un add-on que desbloquea una función nueva fuera del Plan.

### Los 6 sistemas P0 (deben cerrar antes que cualquier función P1)
1. **AIProvider** — ya existía desde ADR-011 (`src/lib/ia/ai-provider.ts`), extendido en esta ADR para leer el orden de proveedores desde la base de datos en vez de tenerlo fijo en código.
2. **AI Pricing Engine** (`ai_accion_costo`) — toda acción de IA tiene una fila editable por SuperSU (costo en créditos, costo estimado de proveedor, margen, nivel de IA). Nada hardcodeado.
3. **Cost Optimizer** (`ai_modelo_config`) — orden de preferencia real de proveedores (Ollama local → OpenRouter económico → Gemini → Nemotron/premium → fallback), activo/inactivo según exista credencial en el entorno.
4. **Credit Meter** (`consumir_creditos_ia`) — valida gating por Plan, valida saldo, consume FIFO por `fecha_otorgamiento` entre lotes de `credito_ia_lote`, nunca deja saldo negativo, audita cada consumo.
5. **AI Memory** (`ai_memoria_negocio`) — persistente en Supabase (nunca en el modelo), versionada, editable/aprobable/olvidable (único `DELETE` real permitido en todo el proyecto, por mandato explícito) y restaurable.
6. **AI Prompt Builder/Library** (`ai_prompt`) — arquitectura completa (OFICIAL/PROPIO/COMPARTIDO/MARKETPLACE_FUTURO), sin Marketplace de prompts todavía.

### Modelo de monetización
- Matriz oficial de costo por acción (13 acciones seedeadas: `busqueda_natural`, `mi_lealtad`, `voz_a_texto`, `resumen_cliente`, `recomendacion`, `coach_staff`, `analista_negocio`, `campana_asistida`, `campana_automatica`, `prediccion_abandono`, `pricing_advisor`, `inventory_predictor`, `marketplace_ai`) — 100% editable después vía `actualizar_accion_costo_ia()`.
- Paquetes de recarga: 250 créditos/$25.000, 1000/$79.000, 3000/$199.000, Enterprise (cotización manual, `precio_cop = null`).
- Funciones habilitadas por Plan (matriz Raven/Jarl/Valhalla/Allfather seedeada en `plan_funcion_ia`) — Allfather = mismo conjunto que Valhalla (sin funciones exclusivas adicionales definidas todavía).
- Compra de paquete de créditos: mismo patrón de cobro único vía Mercado Pago Checkout Pro que Suscripción/Membresía (6ª rama de `aplicar_evento_pago()`).
- Otorgamiento mensual de créditos de Plan: `otorgar_creditos_plan_mensual()`, revocada de `authenticated` (solo `service_role`/cron), enganchada a `/api/cron/diario` (idempotente: no duplica si ya se otorgó en los últimos 30 días).

### AI Cost Simulator (extensión del ADR-012/013)
`simular_consumo_ia(plan, num_staff, num_clientes)` — reusa el mismo AI Pricing Engine, exclusivo de SuperSU. Responde con una estimación de consumo mensual de créditos, si excede lo incluido en el Plan, costo estimado de proveedor y margen promedio. Usa una heurística documentada explícitamente (4 acciones/mes por Staff + 1 cada 20 Clientes/mes) porque todavía no existe histórico real de consumo suficiente para calibrar una fórmula basada en datos.

### ROI Dashboard IA (extensión del ADR-012/013)
Implementado en `/panel/ia` con un criterio de honestidad explícito: se muestran solo las métricas que son **realmente medibles hoy** con los datos que el proyecto captura (créditos consumidos, costo estimado de proveedor, consumo por categoría, campañas asistidas por IA). Las métricas de atribución de resultado pedidas en el documento original (clientes recuperados, reservas generadas por IA, ventas atribuidas, tiempo ahorrado, ahorro operativo) **no se calculan ni se muestran como número** — no existe en el proyecto ningún mecanismo que vincule una sugerencia/acción de IA con un resultado de negocio posterior. Inventar esa fórmula sin datos reales detrás habría violado la Regla de Oro. Se documenta como decisión pendiente en `docs/PENDING_DECISIONS.md`. Exportación: CSV implementado (sin dependencia nueva); PDF/Excel diferidos (ninguna librería de generación de documentos existe hoy en el proyecto) — ver `docs/PENDING_DECISIONS.md`.

### Primer consumidor real conectado
El Motor de recompensas automáticas de Lealtad (ADR-011, Módulo 6.5) — hasta ahora generaba sugerencias con descripciones de plantilla fija. Las reglas Nivel 1/2 ahora invocan `redactarSugerenciaConIA()`: consume créditos ANTES de llamar al proveedor de IA (el costo se incurre aunque el parseo de la respuesta falle, consistente con "nunca subsidia"), lee la Memoria de IA (categoría TONO) como contexto, y cae de vuelta a la plantilla fija si faltan créditos, la función no está en el Plan, o el proveedor de IA falla — nunca rompe la generación de sugerencias por un problema de IA.

### Frontend construido
- **SuperSU AI Center** (`/admin/ai`): resumen de consumo global, AI Pricing Engine editable, Cost Optimizer editable, paquetes de recarga editables, matriz de funciones por Plan, AI Cost Simulator.
- **AI Workspace de Barbería** (`/panel/ia`): saldo y compra de créditos, Memoria de IA (editar/aprobar/olvidar/historial/restaurar), Biblioteca de prompts (crear PROPIO/COMPARTIDO, ver OFICIAL), historial de consumo exportable a CSV, ROI de IA.

### Ollama — rol oficial (ADR-014, Fase G, 2026-09-16)
Ollama nunca es una dependencia de producción: ningún consumidor real, facturable a un Negocio, puede depender de que un servidor Ollama esté disponible. Su uso legítimo es exclusivamente de **desarrollo interno** (documentación, pruebas, clasificación, tareas internas del equipo) corriendo en la máquina del desarrollador — nunca en el Cost Optimizer que sirve tráfico real de un Negocio. `ai_modelo_config` ya refleja esto sin cambio de código: la fila `ollama-local` solo se activa si `OLLAMA_BASE_URL` existe en el entorno, ausente por diseño en Vercel/producción.

## Consecuencias

**Positivas:**
- Ninguna función de IA futura (P1-P4 del documento original: Concierge de Cliente, Coach de Staff, Analista de Negocio, predicción de abandono, etc.) necesita reinventar créditos, costos o memoria — todas se conectan al mismo Credit Meter/Pricing Engine/Memory ya construido y verificado.
- El patrón "arquitectura lista, nunca conectada" de `credito_ia_lote`/`credito_ia_consumo` (migración 004) y `pago_tipo = 'PAQUETE_CREDITOS_IA'` (migración 001) queda cerrado — ambos tienen ahora un consumidor real de punta a punta.

**Negativas / Trade-offs aceptados:**
- Ollama (requiere servidor propio) y Gemini (sin API key) quedan registrados pero inactivos — el Cost Optimizer funciona hoy solo con OpenRouter + Nemotron. Ver `docs/PENDING_DECISIONS.md`.
- El Prompt Builder es un editor de texto simple, no el constructor visual de variables que sugiere el nombre — la arquitectura de datos (`ai_prompt.variables` jsonb) ya lo soporta sin cambios de esquema cuando se priorice. Ver `docs/TECH_DEBT_REGISTER.md`.
- El ROI Dashboard reporta honestamente que las métricas de atribución de resultado no son medibles todavía, en vez de mostrar un número fabricado.
- No se construyó ninguna pantalla de IA con nombre propio orientada a Cliente/Staff (Concierge, búsqueda en lenguaje natural, Coach de Staff, voz a texto, Analista de Negocio) — el AI OS es la capa P0 compartida; cada superficie con nombre propio es la Fase 6 que sigue, y ya tiene sobre qué construirse.
- Se encontró, durante este trabajo, que el propio Módulo 6.5 (Lealtad) no tiene checkout de Cliente para Membresía ni Gift Card — un hallazgo honesto documentado en `docs/TECH_DEBT_REGISTER.md`/`docs/PENDING_DECISIONS.md`, no una regresión introducida por esta ADR.

## Checklist
- [x] Completo
- [ ] Revisado
