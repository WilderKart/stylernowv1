-- 144 — Cierra la ejecución directa de crear_reserva (complemento de la 143).
-- Se aplica DESPUÉS de desplegar el código que reserva con crear_reserva_autorizada: desde aquí nadie
-- puede reservar por /rest/v1/rpc saltándose la autorización de datos. La función envolvente
-- (SECURITY DEFINER) la sigue llamando; service_role y el dueño de la base conservan el acceso.
revoke execute on function public.crear_reserva(uuid, uuid[], timestamptz, uuid, text) from public, anon, authenticated;
