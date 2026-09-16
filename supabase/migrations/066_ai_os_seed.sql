-- StylerNow — Migración 066: AI OS (ADR-013) — datos iniciales.
-- Valores de la matriz oficial del ADR — "iniciales, deben quedar
-- configurables desde SuperSU" (ya lo son: todo pasa por
-- ai_accion_costo, editable vía actualizar_accion_costo_ia()).
-- (creditos nullable en ai_paquete_creditos corregido en migración 065.)

insert into public.ai_accion_costo (accion, categoria, nivel_ia, costo_creditos) values
  ('busqueda_natural', 'CONCIERGE_CLIENTE', 1, 1),
  ('mi_lealtad', 'LEALTAD', 1, 1),
  ('voz_a_texto', 'COACH_STAFF', 1, 2),
  ('resumen_cliente', 'CONCIERGE_CLIENTE', 1, 3),
  ('recomendacion', 'CONCIERGE_CLIENTE', 1, 4),
  ('coach_staff', 'COACH_STAFF', 2, 5),
  ('analista_negocio', 'ANALISTA_NEGOCIO', 2, 8),
  ('campana_asistida', 'CAMPANAS', 1, 12),
  ('campana_automatica', 'CAMPANAS', 2, 20),
  ('prediccion_abandono', 'PREDICCION_ABANDONO', 2, 25),
  ('pricing_advisor', 'PRICING_ADVISOR', 2, 30),
  ('inventory_predictor', 'INVENTORY_PREDICTOR', 2, 35),
  ('marketplace_ai', 'MARKETPLACE_AI', 1, 15);

-- Orden de preferencia del Cost Optimizer. Ollama y Gemini quedan
-- registrados pero `activo = false` — no hay servidor Ollama local ni
-- credencial de Gemini configurada en este proyecto todavía (ver
-- docs/PENDING_DECISIONS.md). El Cost Optimizer real
-- (`src/lib/ia/ai-provider.ts`) omite cualquier fila inactiva o cuya
-- `requiere_credencial` no exista en el entorno.
insert into public.ai_modelo_config (nombre, proveedor, modelo_id, orden_preferencia, requiere_credencial, activo) values
  ('ollama-local', 'OLLAMA', 'llama3', 1, 'OLLAMA_BASE_URL', false),
  ('openrouter-economico', 'OPENROUTER', 'openrouter/free', 2, 'OPENROUTER_API_KEY', true),
  ('gemini', 'GEMINI', 'gemini-1.5-flash', 3, 'GEMINI_API_KEY', false),
  ('nemotron-respaldo', 'NEMOTRON', 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', 4, 'NEMOTRON_API_KEY', true),
  ('premium-fallback', 'PREMIUM', 'openrouter/auto', 5, 'OPENROUTER_API_KEY', true);

insert into public.ai_paquete_creditos (nombre, creditos, precio_cop) values
  ('250 créditos', 250, 25000),
  ('1000 créditos', 1000, 79000),
  ('3000 créditos', 3000, 199000),
  ('Enterprise', null, null);

-- Funciones por Plan — "las funciones dependen del plan, los créditos
-- solo limitan cuánto se usa" (nunca add-ons para desbloquear funciones).
insert into public.plan_funcion_ia (plan_codigo, funcion) values
  ('RAVEN', 'busqueda_natural'), ('RAVEN', 'mi_lealtad'), ('RAVEN', 'voz_a_texto'), ('RAVEN', 'recomendacion'),
  ('JARL', 'busqueda_natural'), ('JARL', 'mi_lealtad'), ('JARL', 'voz_a_texto'), ('JARL', 'recomendacion'),
  ('JARL', 'coach_staff'), ('JARL', 'analista_negocio'), ('JARL', 'campana_asistida'), ('JARL', 'resumen_cliente'),
  ('VALHALLA', 'busqueda_natural'), ('VALHALLA', 'mi_lealtad'), ('VALHALLA', 'voz_a_texto'), ('VALHALLA', 'recomendacion'),
  ('VALHALLA', 'coach_staff'), ('VALHALLA', 'analista_negocio'), ('VALHALLA', 'campana_asistida'), ('VALHALLA', 'resumen_cliente'),
  ('VALHALLA', 'campana_automatica'), ('VALHALLA', 'prediccion_abandono'), ('VALHALLA', 'pricing_advisor'),
  ('VALHALLA', 'inventory_predictor'), ('VALHALLA', 'marketplace_ai'),
  ('ALLFATHER', 'busqueda_natural'), ('ALLFATHER', 'mi_lealtad'), ('ALLFATHER', 'voz_a_texto'), ('ALLFATHER', 'recomendacion'),
  ('ALLFATHER', 'coach_staff'), ('ALLFATHER', 'analista_negocio'), ('ALLFATHER', 'campana_asistida'), ('ALLFATHER', 'resumen_cliente'),
  ('ALLFATHER', 'campana_automatica'), ('ALLFATHER', 'prediccion_abandono'), ('ALLFATHER', 'pricing_advisor'),
  ('ALLFATHER', 'inventory_predictor'), ('ALLFATHER', 'marketplace_ai');
