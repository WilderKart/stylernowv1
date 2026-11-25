# Entrega a producción — 2026-11-25

Alcance: (1) identidad visual única + terminología por negocio (solo código, sin base de datos) y (2) migraciones pendientes del chat de soporte.

## 0. Lo que NO se pudo verificar desde la sesión de desarrollo
El token de Supabase disponible en el entorno no tiene privilegios sobre el proyecto de producción (`wxokamgnrpyhobkqjylm`): no se pudo leer
el estado real de las migraciones. Todo lo de abajo se debe comprobar en producción antes de actuar (cero confianza: nada se da por aplicado).

## 1. Estado de código (rama `main`)
- `main` ya incluye el chat de soporte con adjuntos (código que llama a `soporte_enviar_mensaje` con 5 parámetros, `soporte_bandeja_admin`,
  `soporte_asegurar_conversacion`, tabla `soporte_respuesta_rapida`). Esas funciones **solo existen si la migración 196 está aplicada**.
- Si la 196 no está aplicada, el chat nuevo falla (envío y bandeja de SuperSU) aunque el resto de la app funcione.

## 2. Comprobaciones previas (solo lectura, en producción)
```sql
-- migraciones aplicadas (esperado: 194 y 195 sí; 196 según corresponda)
select version from supabase_migrations.schema_migrations where version in ('194','195','196') order by version;
-- funciones del chat nuevo
select proname, pronargs from pg_proc where proname in ('soporte_enviar_mensaje','soporte_bandeja_admin','soporte_asegurar_conversacion','soporte_ruta_autorizada');
-- debe existir UNA sola soporte_enviar_mensaje (la de 5 parámetros) tras la 196
-- un solo SuperSU (cuenta única a conservar) y que siga siéndolo después
select count(*) from perfil where es_supersu;
```

## 3. Orden de aplicación (base primero, código después)
1. Respaldo vigente de la base (producción no tiene réplica).
2. Si falta, aplicar `supabase/migrations/196_soporte_chat_adjuntos_y_respuestas_rapidas.sql` en una transacción. Ya se probó en local con
   `tests/sql/soporte_chat_adjuntos.sql` (adjuntos, mensaje vacío, otro negocio, plan Essential, respuestas rápidas solo SuperSU, bandeja).
3. Verificar tras aplicarla:
   - una sola `soporte_enviar_mensaje` (la antigua de 2 parámetros se elimina dentro de la migración);
   - `revoke` aplicado a `public`, `anon` y `authenticated` y `grant` solo a `authenticated` en las funciones nuevas;
   - políticas de `storage.objects` del bucket privado `soporte-adjuntos` (`soporte_chat_adjuntos_select/insert`);
   - `select count(*) from perfil where es_supersu` sigue en 1.
4. Prueba de humo con la cuenta de QA: un mensaje de texto y uno con imagen desde la barbería, respuesta de SuperSU con `/hola`.
5. Solo entonces desplegar el código (Vercel despliega `main` automáticamente).

## 4. Cambio de identidad visual (rama `feat/identidad-original-terminologia`)
- Sin migraciones. Todos los negocios (barbería, tattoo, salón, uñas, spa) se ven con el diseño original de StylerNow.
- Los temas suaves por categoría quedan apagados con `TEMAS_POR_CATEGORIA_ACTIVOS = false` (`src/lib/tema/vertical.ts`); reactivarlos es cambiar esa constante.
- Solo cambia la terminología (`src/lib/terminologia.ts`): barbero, tatuador, masajista, estilista, manicurista, lashista; cualquier otra categoría usa «profesional».
- La terminología es solo presentación: no decide permisos ni acceso a datos (la categoría la lee el servidor desde `negocio.categoria`).

## 5. Seguridad (cero confianza) — qué se revisó
- Ninguna decisión de acceso depende de la categoría ni de cookies de aspecto (`sn_vert` es solo decorativa y ya no tiene efecto visual).
- El cambio de identidad no toca RLS, funciones SQL, pagos ni `next.config.ts`.
- Pruebas: 338 pasan (incluye `tests/terminologia.test.ts` y `tests/tema-vertical.test.ts`), `tsc` y `eslint` sin errores.

## 6. Pendiente que no está en esta entrega
- Aplicar las migraciones faltantes en producción (requiere a alguien con permisos sobre la base).
- La rama `feat/rediseno-unificado` (rediseño azul) queda guardada en el repositorio sin mezclar con `main`.
