-- StylerNow — Migración 042: corrige un bug de seguridad REAL Y GRAVE,
-- preexistente desde la migración 008 — no introducido por este módulo,
-- pero encontrado por su prueba end-to-end
--
-- `revoke all on function ... from public;` NO revoca el privilegio de
-- ejecución que Supabase otorga por defecto a los roles `anon` y
-- `authenticated` (vía `alter default privileges`, configurado a nivel de
-- proyecto) — revocar de `public` solo quita el privilegio implícito que
-- todo rol hereda de PUBLIC, pero `anon`/`authenticated` YA tenían un
-- privilegio EXPLÍCITO propio que sobrevive intacto a ese revoke. Se
-- verificó directamente: un usuario autenticado cualquiera podía llamar
-- `aplicar_evento_pago()` sin pasar por el webhook de Mercado Pago,
-- forzando la confirmación de CUALQUIER Reserva pendiente de pago sin
-- haber pagado realmente — un vector de fraude financiero real, no
-- teórico, activo en producción desde que existe esta función.
--
-- Se corrige revocando explícitamente de `anon` y `authenticated` (además
-- de `public`, por defensa en profundidad) en las 3 funciones de este
-- proyecto que dependían exclusivamente de ese patrón para restringirse a
-- llamadas server-to-server con `service_role` (nunca expuestas a
-- `anon`/`authenticated`, sin ningún chequeo de autorización interno
-- propio porque no estaban pensadas para recibir llamadas de un Cliente
-- real): `aplicar_evento_pago()`, `expirar_reservas_vencidas()`,
-- `revertir_comision_wallet()` (esta última ya nace corregida en la
-- migración 041, pero se repite acá para que quede consolidado en un solo
-- lugar el patrón correcto). El resto de las RPCs del proyecto no dependen
-- de este mecanismo — verifican autorización con `is_barberia_de()`/
-- `is_supersu()`/comparación de `auth.uid()` dentro del propio cuerpo, así
-- que no están expuestas aunque `authenticated` pueda invocarlas.

revoke all on function public.aplicar_evento_pago(uuid, text, pago_estado, jsonb) from public, anon, authenticated;
revoke all on function public.expirar_reservas_vencidas() from public, anon, authenticated;
revoke all on function public.revertir_comision_wallet(uuid, numeric) from public, anon, authenticated;
