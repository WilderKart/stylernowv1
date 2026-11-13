-- Pruebas de la migración 130 (trazabilidad de webhooks y disputas). Base LOCAL, con ROLLBACK.
--   docker exec -i supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < tests/sql/webhook_130.sql
begin;

-- Nadie fuera de service_role ejecuta las funciones nuevas (las tres audiencias, memoria del proyecto).
do $$
declare f text; r text;
begin
  foreach f in array array[
    'public.webhook_registrar(text,text,text,text,uuid)',
    'public.webhook_registrar_resultado(text,text,boolean,text,text,uuid,uuid,text,boolean,text)',
    'public.pago_registrar_disputa(uuid,text,text)'] loop
    foreach r in array array['public','anon','authenticated'] loop
      if r <> 'public' and has_function_privilege(r, f, 'execute') then
        raise exception 'FALLA 130: % puede ejecutar %', r, f;
      end if;
    end loop;
    if not has_function_privilege('service_role', f, 'execute') then raise exception 'FALLA 130: service_role sin %', f; end if;
  end loop;
  if has_table_privilege('anon', 'public.webhook_evento', 'select') then raise exception 'FALLA 130: anon lee webhook_evento'; end if;
  raise notice 'OK 130: funciones solo para service_role; registro no legible por anon';
end $$;

-- Reintentos y resultado: un fallo transitorio deja el evento pendiente; el éxito lo cierra.
do $$
declare v boolean; w public.webhook_evento;
begin
  if not public.webhook_registrar('MERCADOPAGO', 'req-130', '1', 'payment', null) then raise exception 'FALLA 130: primer registro'; end if;
  perform public.webhook_registrar_resultado('MERCADOPAGO', 'req-130', false, 'PROVEEDOR_500', 'VALIDA', null, null, null, null, 'caido');
  v := public.webhook_registrar('MERCADOPAGO', 'req-130', '1', 'payment', null);
  if not v then raise exception 'FALLA 130: un evento fallido debe poder reprocesarse'; end if;
  perform public.webhook_registrar_resultado('MERCADOPAGO', 'req-130', true, 'APROBADO', 'VALIDA', null, null, 'approved', false, null);
  if public.webhook_registrar('MERCADOPAGO', 'req-130', '1', 'payment', null) then raise exception 'FALLA 130: procesado no debe repetirse'; end if;
  select * into w from public.webhook_evento where request_id = 'req-130';
  if w.intentos <> 3 or w.resultado <> 'APROBADO' or w.error is not null or w.procesado_at is null or w.estado_proveedor <> 'approved' then
    raise exception 'FALLA 130: traza incorrecta %', row_to_json(w);
  end if;
  begin
    update public.webhook_evento set firma = 'CUALQUIERA' where id = w.id;
    raise exception 'FALLA 130: firma admite valores libres';
  exception when check_violation then null; end;
  raise notice 'OK 130: reintentos contados, pendiente tras fallo, cerrado tras éxito';
end $$;

rollback;
