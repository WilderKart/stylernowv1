-- 099: Exportar datos y eliminar cuenta (C15).
-- DISENO DE ELIMINACION: solicitud con 14 dias de gracia (cancelable) -> proceso del sistema (cron, service_role)
-- ANONIMIZA, no borra filas compartidas: perfil queda como 'Cliente anonimo' sin email/telefono/avatar/fecha de
-- nacimiento; se borran My Look (fotos), notificaciones, favoritos y preferencias; se cancelan citas futuras
-- (auditadas para reembolso); el saldo a favor genera una solicitud de devolucion; resenas, pagos, reservas,
-- chat y auditoria se conservan (comprobantes exigidos por ley / datos del negocio) sin identidad; la cuenta de
-- acceso (auth.users) se inhabilita y se desvincula de email/identidades/sesiones.
create table public.solicitud_cuenta (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfil(id),
  tipo text not null check (tipo in ('EXPORTACION','ELIMINACION')),
  estado text not null check (estado in ('PENDIENTE','COMPLETADA','EJECUTADA','CANCELADA','ERROR')),
  programada_para timestamptz,
  intentos integer not null default 0,
  error text,
  created_at timestamptz not null default now(),
  cancelada_at timestamptz,
  ejecutada_at timestamptz,
  auth_cerrada boolean not null default false
);
create unique index solicitud_eliminacion_pendiente_uq on public.solicitud_cuenta (usuario_id)
  where tipo = 'ELIMINACION' and estado = 'PENDIENTE';
create index solicitud_cuenta_usuario_idx on public.solicitud_cuenta (usuario_id, created_at desc);
alter table public.solicitud_cuenta enable row level security;
revoke all on public.solicitud_cuenta from public, anon, authenticated;
grant select on public.solicitud_cuenta to authenticated;
create policy solicitud_cuenta_select_propia on public.solicitud_cuenta
  for select to authenticated using (usuario_id = auth.uid());

-- Archivos de storage a purgar tras anonimizar (el cron los elimina con la API de storage).
create table public.purga_storage_pendiente (
  id uuid primary key default gen_random_uuid(),
  bucket text not null,
  ruta text not null,
  created_at timestamptz not null default now()
);
alter table public.purga_storage_pendiente enable row level security;
revoke all on public.purga_storage_pendiente from public, anon, authenticated;

create or replace function public.exportar_mis_datos()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v jsonb;
begin
  if v_uid is null then raise exception 'NO_AUTENTICADO'; end if;
  if (select count(*) from public.solicitud_cuenta s where s.usuario_id = v_uid and s.tipo = 'EXPORTACION'
        and s.created_at > now() - interval '24 hours') >= 5 then
    raise exception 'DEMASIADAS_EXPORTACIONES';
  end if;
  select jsonb_build_object(
    'generado_at', now(),
    'perfil', (select jsonb_build_object('id', p.id, 'nombre', p.nombre, 'email', p.email, 'telefono', p.telefono,
                 'fecha_nacimiento', p.fecha_nacimiento, 'pais', p.pais, 'locale', p.locale, 'avatar_url', p.avatar_url,
                 'categorias_interes', p.categorias_interes, 'consentimiento_marketing', p.consentimiento_marketing,
                 'creado_at', p.created_at) from public.perfil p where p.id = v_uid),
    'preferencias', (select to_jsonb(cp) - 'usuario_id' from public.cliente_preferencia cp where cp.usuario_id = v_uid),
    'reservas', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'negocio', n.nombre, 'estado', r.estado,
                 'hora_inicio', r.hora_inicio, 'hora_fin', r.hora_fin, 'monto_total', r.monto_total,
                 'monto_sena', r.monto_sena, 'checkin_at', r.checkin_at, 'creada_at', r.created_at) order by r.hora_inicio desc)
                 from public.reserva r join public.negocio n on n.id = r.negocio_id where r.cliente_id = v_uid), '[]'::jsonb),
    'pagos', coalesce((select jsonb_agg(jsonb_build_object('id', pg.id, 'reserva_id', pg.reserva_id, 'tipo', pg.tipo,
                 'monto', pg.monto, 'estado', pg.estado, 'monto_reembolsado', pg.monto_reembolsado, 'creado_at', pg.created_at)
                 order by pg.created_at desc)
                 from public.pago pg join public.reserva r on r.id = pg.reserva_id where r.cliente_id = v_uid), '[]'::jsonb),
    'resenas', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'reserva_id', x.reserva_id,
                 'calificacion', x.calificacion, 'comentario', x.comentario, 'creada_at', x.created_at)
                 order by x.created_at desc) from public.resena x where x.cliente_id = v_uid), '[]'::jsonb),
    'my_look', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'reserva_id', f.reserva_id, 'ruta', f.url,
                 'momento', f.momento, 'compartida', f.compartida, 'creada_at', f.created_at) order by f.created_at desc)
                 from public.reserva_foto f where f.cliente_id = v_uid), '[]'::jsonb),
    'consentimientos', coalesce((select jsonb_agg(jsonb_build_object('proposito', c.proposito, 'otorgado', c.otorgado,
                 'origen', c.origen, 'fecha', c.created_at) order by c.created_at) from public.consentimiento_evento c
                 where c.usuario_id = v_uid), '[]'::jsonb),
    'aceptaciones_legales', coalesce((select jsonb_agg(jsonb_build_object('tipo', t.tipo, 'version', t.version,
                 'aceptado_at', a.aceptado_at)) from public.aceptacion_legal a
                 join public.texto_legal t on t.id = a.texto_legal_id where a.usuario_id = v_uid), '[]'::jsonb),
    'favoritos', coalesce((select jsonb_agg(to_jsonb(fv) - 'cliente_id') from public.favorito_negocio fv
                 where fv.cliente_id = v_uid), '[]'::jsonb),
    'referidos', jsonb_build_object(
        'codigo', (select rc.codigo from public.referido_codigo rc where rc.cliente_id = v_uid),
        'invitados', coalesce((select jsonb_agg(jsonb_build_object('estado', rf.estado, 'fecha', rf.created_at,
                 'monto_recompensa', rf.monto_recompensa)) from public.referido rf where rf.referente_cliente_id = v_uid), '[]'::jsonb)),
    'saldo_y_movimientos', jsonb_build_object(
        'saldo', (select w.saldo_disponible from public.lealtad_wallet w where w.cliente_id = v_uid),
        'movimientos', coalesce((select jsonb_agg(jsonb_build_object('tipo', m.tipo, 'monto', m.monto, 'motivo', m.motivo,
                 'fecha', m.created_at) order by m.created_at desc) from public.lealtad_movimiento m
                 join public.lealtad_wallet w on w.id = m.wallet_id where w.cliente_id = v_uid), '[]'::jsonb)),
    'tickets_soporte', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'asunto', t.asunto, 'estado', t.estado,
                 'creado_at', t.created_at, 'mensajes', coalesce((select jsonb_agg(jsonb_build_object('actor', tm.actor_tipo,
                 'mensaje', tm.mensaje, 'fecha', tm.created_at) order by tm.created_at) from public.ticket_mensaje tm
                 where tm.ticket_id = t.id), '[]'::jsonb))) from public.ticket_soporte t where t.creado_por = v_uid), '[]'::jsonb),
    'chat_mensajes_enviados', coalesce((select jsonb_agg(jsonb_build_object('reserva_id', cc.reserva_id, 'mensaje', cm.cuerpo,
                 'fecha', cm.created_at) order by cm.created_at) from public.chat_mensaje cm
                 join public.chat_conversacion cc on cc.id = cm.conversacion_id where cm.autor_id = v_uid), '[]'::jsonb),
    'notificaciones', coalesce((select jsonb_agg(jsonb_build_object('tipo', nu.tipo, 'titulo', nu.titulo, 'cuerpo', nu.cuerpo,
                 'fecha', nu.created_at) order by nu.created_at desc) from public.notificacion_usuario nu
                 where nu.usuario_id = v_uid), '[]'::jsonb)
  ) into v;
  insert into public.solicitud_cuenta (usuario_id, tipo, estado) values (v_uid, 'EXPORTACION', 'COMPLETADA');
  return v;
end $$;
revoke all on function public.exportar_mis_datos() from public, anon, authenticated;
grant execute on function public.exportar_mis_datos() to authenticated;

create or replace function public.resumen_eliminacion_cuenta()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_bloqueo text; v_citas jsonb; v_saldo numeric; v_pend jsonb;
begin
  if v_uid is null then raise exception 'NO_AUTENTICADO'; end if;
  if public.is_supersu() then v_bloqueo := 'ES_SUPERSU';
  elsif exists (select 1 from public.negocio n where n.owner_user_id = v_uid and n.estado::text <> 'CANCELADO') then
    v_bloqueo := 'NEGOCIO_ACTIVO';
  elsif exists (select 1 from public.vinculo_staff_negocio v where v.staff_id = v_uid and v.estado = 'ACTIVO') then
    v_bloqueo := 'STAFF_ACTIVO';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('reserva_id', r.id, 'hora_inicio', r.hora_inicio, 'negocio', n.nombre)
           order by r.hora_inicio), '[]'::jsonb) into v_citas
    from public.reserva r join public.negocio n on n.id = r.negocio_id
    where r.cliente_id = v_uid and r.estado in ('PENDIENTE_PAGO','CONFIRMADA') and r.hora_inicio > now();
  select coalesce(w.saldo_disponible, 0) into v_saldo from public.lealtad_wallet w where w.cliente_id = v_uid;
  select jsonb_build_object('solicitud_id', s.id, 'programada_para', s.programada_para) into v_pend
    from public.solicitud_cuenta s where s.usuario_id = v_uid and s.tipo = 'ELIMINACION' and s.estado = 'PENDIENTE';
  return jsonb_build_object('puede_eliminar', v_bloqueo is null, 'motivo_bloqueo', v_bloqueo,
    'citas_futuras', v_citas, 'saldo', coalesce(v_saldo, 0), 'dias_gracia', 14, 'pendiente', v_pend);
end $$;
revoke all on function public.resumen_eliminacion_cuenta() from public, anon, authenticated;
grant execute on function public.resumen_eliminacion_cuenta() to authenticated;

create or replace function public.solicitar_eliminacion_cuenta(p_confirmacion text)
returns public.solicitud_cuenta language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_res jsonb; v public.solicitud_cuenta;
begin
  if v_uid is null then raise exception 'NO_AUTENTICADO'; end if;
  if upper(trim(coalesce(p_confirmacion, ''))) <> 'ELIMINAR' then raise exception 'CONFIRMACION_INVALIDA'; end if;
  v_res := public.resumen_eliminacion_cuenta();
  if not (v_res->>'puede_eliminar')::boolean then raise exception 'NO_SE_PUEDE_ELIMINAR: %', v_res->>'motivo_bloqueo'; end if;
  select s.* into v from public.solicitud_cuenta s
   where s.usuario_id = v_uid and s.tipo = 'ELIMINACION' and s.estado = 'PENDIENTE';
  if found then return v; end if;
  insert into public.solicitud_cuenta (usuario_id, tipo, estado, programada_para)
  values (v_uid, 'ELIMINACION', 'PENDIENTE', now() + interval '14 days') returning * into v;
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, payload_despues)
  values ('perfil', v_uid, 'ELIMINACION_CUENTA_SOLICITADA', 'CLIENTE', v_uid,
          jsonb_build_object('programada_para', v.programada_para));
  return v;
end $$;
revoke all on function public.solicitar_eliminacion_cuenta(text) from public, anon, authenticated;
grant execute on function public.solicitar_eliminacion_cuenta(text) to authenticated;

create or replace function public.cancelar_eliminacion_cuenta()
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  update public.solicitud_cuenta set estado = 'CANCELADA', cancelada_at = now()
   where usuario_id = auth.uid() and tipo = 'ELIMINACION' and estado = 'PENDIENTE';
  return found;
end $$;
revoke all on function public.cancelar_eliminacion_cuenta() from public, anon, authenticated;
grant execute on function public.cancelar_eliminacion_cuenta() to authenticated;
