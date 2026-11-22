-- 171: Barberos adicionales (FASE 2A) — eventos y plantillas del outbox de notificaciones (124) y helper de envío.
-- Los avisos de vencimiento (7/3/1 días, configurables) y los cambios de estado usan SOLO el outbox transaccional (idempotente por clave).
-- Un fallo al encolar NUNCA revierte el cambio de estado que lo originó (mismo criterio que trg_notif_suscripcion).
-- Rollback: 171_adicionales_notificaciones_REVERSION.sql.txt.

insert into public.notificacion_evento (codigo, categoria, audiencia, esencial, descripcion_es, descripcion_en) values
  ('ADICIONAL_ACTIVADO',   'TRANSACCIONAL', 'NEGOCIO', true,  'Barberos adicionales activados',      'Additional barbers activated'),
  ('ADICIONAL_RENOVADO',   'TRANSACCIONAL', 'NEGOCIO', true,  'Barberos adicionales renovados',      'Additional barbers renewed'),
  ('ADICIONAL_POR_VENCER', 'TRANSACCIONAL', 'NEGOCIO', true,  'Barberos adicionales por vencer',     'Additional barbers expiring soon'),
  ('ADICIONAL_EN_GRACIA',  'TRANSACCIONAL', 'NEGOCIO', true,  'Barberos adicionales en gracia',      'Additional barbers in grace period'),
  ('ADICIONAL_SUSPENDIDO', 'TRANSACCIONAL', 'NEGOCIO', true,  'Barberos adicionales suspendidos',    'Additional barbers suspended'),
  ('ADICIONAL_REACTIVADO', 'TRANSACCIONAL', 'NEGOCIO', true,  'Barberos adicionales reactivados',    'Additional barbers reactivated'),
  ('ADICIONAL_CANCELADO',  'TRANSACCIONAL', 'NEGOCIO', false, 'Renovación de adicionales cancelada', 'Additional barbers renewal cancelled')
on conflict (codigo) do nothing;

with base(codigo, idioma, asunto, texto, html) as (values
  ('ADICIONAL_ACTIVADO', 'es', 'Activamos {{cantidad}} barbero(s) adicional(es) en {{negocio}}', 'Disponibles hasta el {{vence}}.',
   '<p>Activamos <strong>{{cantidad}}</strong> barbero(s) adicional(es) en <strong>{{negocio}}</strong>. Tu cupo está vigente hasta el <strong>{{vence}}</strong>.</p>'),
  ('ADICIONAL_ACTIVADO', 'en', 'We activated {{cantidad}} additional barber(s) at {{negocio}}', 'Available until {{vence}}.',
   '<p>We activated <strong>{{cantidad}}</strong> additional barber(s) at <strong>{{negocio}}</strong>. Valid until <strong>{{vence}}</strong>.</p>'),
  ('ADICIONAL_RENOVADO', 'es', 'Renovamos tus barberos adicionales de {{negocio}}', 'Vigentes hasta el {{vence}}.',
   '<p>Renovamos <strong>{{cantidad}}</strong> barbero(s) adicional(es) de <strong>{{negocio}}</strong>. Vigentes hasta el <strong>{{vence}}</strong>.</p>'),
  ('ADICIONAL_RENOVADO', 'en', 'We renewed the additional barbers at {{negocio}}', 'Valid until {{vence}}.',
   '<p>We renewed <strong>{{cantidad}}</strong> additional barber(s) at <strong>{{negocio}}</strong>. Valid until <strong>{{vence}}</strong>.</p>'),
  ('ADICIONAL_POR_VENCER', 'es', 'Tus barberos adicionales de {{negocio}} vencen en {{dias}} día(s)', 'Renueva antes del {{vence}} para no perder el cupo.',
   '<p>Tus <strong>{{cantidad}}</strong> barbero(s) adicional(es) de <strong>{{negocio}}</strong> vencen el <strong>{{vence}}</strong> (en {{dias}} día(s)). Renueva desde Equipo para conservar el cupo.</p>'),
  ('ADICIONAL_POR_VENCER', 'en', 'Your additional barbers at {{negocio}} expire in {{dias}} day(s)', 'Renew before {{vence}} to keep the slots.',
   '<p>Your <strong>{{cantidad}}</strong> additional barber(s) at <strong>{{negocio}}</strong> expire on <strong>{{vence}}</strong> ({{dias}} day(s)). Renew from Team to keep the slots.</p>'),
  ('ADICIONAL_EN_GRACIA', 'es', 'Tus barberos adicionales de {{negocio}} están en gracia', 'Renueva antes del {{vence}}; si no, se suspenderá el cupo.',
   '<p>Venció el periodo de <strong>{{cantidad}}</strong> barbero(s) adicional(es) de <strong>{{negocio}}</strong>. Tienes gracia hasta el <strong>{{vence}}</strong>; después suspenderemos ese cupo. No eliminamos a nadie ni tus citas o historial.</p>'),
  ('ADICIONAL_EN_GRACIA', 'en', 'Your additional barbers at {{negocio}} are in grace period', 'Renew before {{vence}} or the slots will be suspended.',
   '<p>The period of <strong>{{cantidad}}</strong> additional barber(s) at <strong>{{negocio}}</strong> ended. You have a grace period until <strong>{{vence}}</strong>; after that we suspend those slots. Nobody is removed and your appointments and history are kept.</p>'),
  ('ADICIONAL_SUSPENDIDO', 'es', 'Suspendimos el cupo adicional de {{negocio}}', 'Renueva para reactivarlo. No borramos datos.',
   '<p>Suspendimos <strong>{{cantidad}}</strong> cupo(s) adicional(es) de <strong>{{negocio}}</strong>. Nadie fue eliminado ni se perdieron citas, historial o evidencias; solo no podrás sumar más profesionales. Renueva para reactivarlo.</p>'),
  ('ADICIONAL_SUSPENDIDO', 'en', 'We suspended the additional slots at {{negocio}}', 'Renew to reactivate. No data deleted.',
   '<p>We suspended <strong>{{cantidad}}</strong> additional slot(s) at <strong>{{negocio}}</strong>. Nobody was removed and no appointments, history or evidence were lost; you just cannot add more professionals. Renew to reactivate.</p>'),
  ('ADICIONAL_REACTIVADO', 'es', 'Reactivamos tus barberos adicionales de {{negocio}}', 'Vigentes hasta el {{vence}}.',
   '<p>Reactivamos <strong>{{cantidad}}</strong> barbero(s) adicional(es) de <strong>{{negocio}}</strong>. Vigentes hasta el <strong>{{vence}}</strong>.</p>'),
  ('ADICIONAL_REACTIVADO', 'en', 'We reactivated the additional barbers at {{negocio}}', 'Valid until {{vence}}.',
   '<p>We reactivated <strong>{{cantidad}}</strong> additional barber(s) at <strong>{{negocio}}</strong>. Valid until <strong>{{vence}}</strong>.</p>'),
  ('ADICIONAL_CANCELADO', 'es', 'Cancelaste la renovación de tus barberos adicionales', 'Conservas el cupo pagado hasta el {{vence}}.',
   '<p>Cancelaste la renovación de <strong>{{cantidad}}</strong> barbero(s) adicional(es) de <strong>{{negocio}}</strong>. El periodo ya pagado no se reembolsa y conservas el cupo hasta el <strong>{{vence}}</strong>.</p>'),
  ('ADICIONAL_CANCELADO', 'en', 'You cancelled the renewal of your additional barbers', 'You keep the paid slots until {{vence}}.',
   '<p>You cancelled the renewal of <strong>{{cantidad}}</strong> additional barber(s) at <strong>{{negocio}}</strong>. The period already paid is not refunded and you keep the slots until <strong>{{vence}}</strong>.</p>')
), filas as (
  select codigo, 'EMAIL'::text as canal, idioma, asunto, html as cuerpo from base
  union all select codigo, 'PUSH', idioma, asunto, texto from base
  union all select codigo, 'PANEL', idioma, asunto, texto from base
)
insert into public.notificacion_plantilla (codigo, canal, idioma, negocio_id, asunto, cuerpo, version, activa)
select f.codigo, f.canal, f.idioma, null, f.asunto, f.cuerpo, 1, true from filas f
where not exists (select 1 from public.notificacion_plantilla t
                  where t.codigo = f.codigo and t.canal = f.canal and t.idioma = f.idioma and t.negocio_id is null);

-- Encola el aviso al propietario. La clave de idempotencia la fija quien llama (incluye lote, evento y periodo).
create or replace function public._adicional_notificar(p_lote uuid, p_evento text, p_clave text, p_extra jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_l public.adicional_lote; v_owner uuid; v_nombre text; v_fecha timestamptz;
begin
  begin
    select * into v_l from public.adicional_lote where id = p_lote;
    if not found then return; end if;
    select n.owner_user_id, n.nombre into v_owner, v_nombre from public.negocio n where n.id = v_l.negocio_id;
    -- Fecha que se comunica: fin de gracia si está en gracia; si no, vencimiento del periodo.
    v_fecha := case when v_l.estado = 'EN_GRACIA' then v_l.gracia_fin else v_l.vigente_hasta end;
    perform public._notif_encolar_canales(p_evento, v_owner, v_l.negocio_id,
      jsonb_build_object('negocio', v_nombre, 'cantidad', v_l.cantidad::text,
                         'vence', coalesce(to_char(v_fecha at time zone 'America/Bogota', 'DD/MM/YYYY'), ''),
                         'ruta', '/panel/staff') || coalesce(p_extra, '{}'::jsonb),
      'adicional:' || p_lote::text || ':' || p_clave, array['EMAIL', 'PUSH', 'PANEL']);
  exception when others then
    null;  -- un fallo de aviso nunca revierte el cambio que lo origina
  end;
end $$;
revoke all on function public._adicional_notificar(uuid, text, text, jsonb) from public, anon, authenticated;
