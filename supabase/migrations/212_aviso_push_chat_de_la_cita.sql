-- 212 · Aviso push cuando llega un mensaje en el chat de una cita (en ambos sentidos).
--
-- Antes: la barbería solo veía el mensaje al abrir la cita (o en la campanita) y el cliente recibía solo un aviso dentro de la app.
-- Ahora: cada mensaje nuevo genera un aviso PUSH (suena y vibra en el celular, igual que los demás avisos) que, al tocarlo, abre
-- directo el chat de esa cita:
--   · el cliente escribe  → avisa al dueño y a los guardianes de la sede de la cita → /panel/agenda/chat/<reserva>
--   · la barbería escribe → avisa al cliente                                        → /reserva/<reserva>/chat
-- Se usa el motor que ya existe (outbox + despacho inmediato, migraciones 124 y 198): respeta las preferencias de cada persona y
-- solo avisa a quien tiene los avisos activados en su dispositivo.
-- Para no llenar de avisos una conversación rápida, se agrupa: un aviso por conversación cada 30 segundos (la clave de idempotencia
-- incluye la ventana). El trigger nunca hace fallar el envío del mensaje.

insert into public.notificacion_evento (codigo, categoria, audiencia, esencial, descripcion_es, descripcion_en) values
  ('CHAT_CITA_CLIENTE', 'TRANSACCIONAL', 'NEGOCIO', false, 'Un cliente te escribió en el chat de su cita', 'A client wrote to you in their appointment chat'),
  ('CHAT_CITA_NEGOCIO', 'TRANSACCIONAL', 'CLIENTE', false, 'El negocio te escribió en el chat de tu cita', 'The business wrote to you in your appointment chat')
on conflict (codigo) do nothing;

with filas (codigo, canal, idioma, asunto, cuerpo) as (values
  ('CHAT_CITA_CLIENTE', 'PUSH', 'es', '{{cliente}} te escribió', '{{extracto}}'),
  ('CHAT_CITA_CLIENTE', 'PUSH', 'en', '{{cliente}} wrote to you', '{{extracto}}'),
  ('CHAT_CITA_NEGOCIO', 'PUSH', 'es', '{{negocio}} te escribió', '{{extracto}}'),
  ('CHAT_CITA_NEGOCIO', 'PUSH', 'en', '{{negocio}} sent you a message', '{{extracto}}'))
insert into public.notificacion_plantilla (codigo, canal, idioma, negocio_id, asunto, cuerpo, version, activa)
select f.codigo, f.canal, f.idioma, null, f.asunto, f.cuerpo, 1, true from filas f
where not exists (select 1 from public.notificacion_plantilla t
                  where t.codigo = f.codigo and t.canal = f.canal and t.idioma = f.idioma and t.negocio_id is null);

create or replace function public.trg_notif_chat_cita()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r public.reserva;
  v_extracto text;
  v_ventana text;
  v_u uuid;
begin
  begin
    select re.* into r
      from public.chat_conversacion c join public.reserva re on re.id = c.reserva_id
     where c.id = new.conversacion_id;
    if not found then return new; end if;

    v_extracto := left(regexp_replace(btrim(new.cuerpo), '\s+', ' ', 'g'), 90);
    v_ventana := new.conversacion_id::text || ':' || floor(extract(epoch from new.created_at) / 30)::bigint::text;

    if new.autor_rol = 'CLIENTE' then
      -- Quien puede abrir el chat en el panel: el dueño y los guardianes de esa sede (el barbero común no entra al panel).
      for v_u in
        select u from (
          select n.owner_user_id as u from public.negocio n where n.id = r.negocio_id
          union
          select v.staff_id from public.vinculo_staff_negocio v
           where v.negocio_id = r.negocio_id and v.estado = 'ACTIVO' and v.es_guardian
             and (v.sede_activa_id is null or v.sede_activa_id = r.sede_id)
        ) x where u is not null and u <> new.autor_id
      loop
        perform public._notif_encolar_canales('CHAT_CITA_CLIENTE', v_u, r.negocio_id,
          jsonb_build_object(
            'cliente', coalesce((select nullif(btrim(p.nombre), '') from public.perfil p where p.id = r.cliente_id), 'Un cliente'),
            'extracto', v_extracto,
            'ruta', '/panel/agenda/chat/' || r.id::text),
          'chatcita:' || v_ventana, array['PUSH']);
      end loop;
    elsif new.autor_rol = 'NEGOCIO' and r.cliente_id <> new.autor_id then
      perform public._notif_encolar_canales('CHAT_CITA_NEGOCIO', r.cliente_id, r.negocio_id,
        jsonb_build_object(
          'negocio', coalesce((select n.nombre from public.negocio n where n.id = r.negocio_id), 'Tu barbería'),
          'extracto', v_extracto,
          'ruta', '/reserva/' || r.id::text || '/chat'),
        'chatcita:' || v_ventana, array['PUSH']);
    end if;
  exception when others then
    null; -- un fallo de avisos jamás impide enviar el mensaje
  end;
  return new;
end $$;
revoke all on function public.trg_notif_chat_cita() from public, anon, authenticated;

drop trigger if exists notif_chat_cita on public.chat_mensaje;
create trigger notif_chat_cita
  after insert on public.chat_mensaje
  for each row execute function public.trg_notif_chat_cita();
