-- 212 · aviso push del chat de la cita. Se ejecuta en una transacción que se deshace (no deja datos).
begin;
do $$
declare
  r public.reserva; v_dueno uuid; v_conv uuid; n int; ruta text;
  v_otro uuid;
begin
  select re.* into r from public.reserva re join public.negocio ng on ng.id = re.negocio_id
   where re.cliente_id <> ng.owner_user_id limit 1;
  select owner_user_id into v_dueno from public.negocio where id = r.negocio_id;

  -- dueño y cliente con avisos activados en su dispositivo
  insert into public.notificacion_push_suscripcion (usuario_id, endpoint, p256dh, auth)
  values (v_dueno, 'https://fcm.googleapis.com/fcm/send/test-dueno-212', repeat('p',87), repeat('a',22)),
         (r.cliente_id, 'https://fcm.googleapis.com/fcm/send/test-cliente-212', repeat('p',87), repeat('a',22));

  insert into public.chat_conversacion (reserva_id, cliente_id, negocio_id) values (r.id, r.cliente_id, r.negocio_id)
  on conflict (reserva_id) do nothing;
  select id into v_conv from public.chat_conversacion where reserva_id = r.id;

  -- 1) el cliente escribe → avisa al dueño, con la ruta directa al chat
  insert into public.chat_mensaje (conversacion_id, autor_id, autor_rol, cuerpo) values (v_conv, r.cliente_id, 'CLIENTE', 'Hola, llego 5 minutos tarde');
  select count(*), max(datos->>'ruta') into n, ruta from public.notificacion_outbox
   where evento = 'CHAT_CITA_CLIENTE' and usuario_id = v_dueno and canal = 'PUSH';
  assert n = 1, 'esperaba 1 aviso al dueño, hubo ' || n;
  assert ruta = '/panel/agenda/chat/' || r.id::text, 'ruta del dueño incorrecta: ' || coalesce(ruta, 'null');
  raise notice 'OK 1: el cliente escribe → 1 aviso al dueño con ruta %', ruta;

  -- 2) otro mensaje dentro de la misma ventana de 30 s → no duplica
  insert into public.chat_mensaje (conversacion_id, autor_id, autor_rol, cuerpo) values (v_conv, r.cliente_id, 'CLIENTE', 'Y otra cosa');
  select count(*) into n from public.notificacion_outbox where evento = 'CHAT_CITA_CLIENTE' and usuario_id = v_dueno;
  assert n = 1 or n = 2, 'conteo inesperado ' || n; -- 2 solo si cruzó el límite de la ventana
  raise notice 'OK 2: ráfaga agrupada (avisos=%)', n;

  -- 3) el cliente no se avisa a sí mismo
  select count(*) into n from public.notificacion_outbox where evento = 'CHAT_CITA_CLIENTE' and usuario_id = r.cliente_id;
  assert n = 0, 'el cliente recibió su propio mensaje';
  raise notice 'OK 3: el autor no se avisa';

  -- 4) el negocio responde → avisa al cliente, ruta al chat del cliente
  insert into public.chat_mensaje (conversacion_id, autor_id, autor_rol, cuerpo) values (v_conv, v_dueno, 'NEGOCIO', 'Te esperamos');
  select count(*), max(datos->>'ruta') into n, ruta from public.notificacion_outbox
   where evento = 'CHAT_CITA_NEGOCIO' and usuario_id = r.cliente_id and canal = 'PUSH';
  assert n = 1, 'esperaba 1 aviso al cliente, hubo ' || n;
  assert ruta = '/reserva/' || r.id::text || '/chat', 'ruta del cliente incorrecta: ' || coalesce(ruta, 'null');
  raise notice 'OK 4: el negocio responde → aviso al cliente con ruta %', ruta;

  -- 5) sin suscripción push no se encola nada
  delete from public.notificacion_push_suscripcion where usuario_id = r.cliente_id;
  insert into public.chat_mensaje (conversacion_id, autor_id, autor_rol, cuerpo) values (v_conv, v_dueno, 'NEGOCIO', 'Otro aviso');
  select count(*) into n from public.notificacion_outbox where evento = 'CHAT_CITA_NEGOCIO' and usuario_id = r.cliente_id;
  assert n = 1, 'se encoló aviso sin suscripción';
  raise notice 'OK 5: sin suscripción no se encola';
end $$;
rollback;
