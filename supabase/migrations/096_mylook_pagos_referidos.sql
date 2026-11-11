-- 096: My Look (C07), pagos y saldo (C08), referidos (C09).
-- reserva_foto.url es la ruta en el bucket PRIVADO 'crm-fotos' ({negocio_id}/{cliente_id}/...): la UI firma la URL.

create or replace function public.mi_look_listar(p_limite integer default 60)
returns table (foto_id uuid, reserva_id uuid, url text, momento text, compartida boolean,
               hora_inicio timestamptz, staff_nombre text, negocio_nombre text, servicios text)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  return query
  select rf.id, rf.reserva_id, rf.url, rf.momento, rf.compartida, re.hora_inicio, st.nombre, ng.nombre,
         (select string_agg(s.nombre, ' + ' order by s.nombre) from public.reserva_servicio rs
            join public.servicio s on s.id = rs.servicio_id where rs.reserva_id = re.id)
  from public.reserva_foto rf
  join public.reserva re on re.id = rf.reserva_id
  join public.negocio ng on ng.id = rf.negocio_id
  left join public.staff st on st.usuario_id = re.staff_id
  where rf.cliente_id = auth.uid()
  order by re.hora_inicio desc, rf.momento nulls last, rf.created_at
  limit least(greatest(coalesce(p_limite, 60), 1), 200);
end $$;
revoke all on function public.mi_look_listar(integer) from public, anon, authenticated;
grant execute on function public.mi_look_listar(integer) to authenticated;

-- "Compartir": el cliente decide si la foto aparece en el portafolio publico del profesional.
create or replace function public.mi_look_compartir(p_foto_id uuid, p_compartir boolean)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  update public.reserva_foto
     set compartida = coalesce(p_compartir, false),
         compartida_at = case when coalesce(p_compartir, false) then now() else null end
   where id = p_foto_id and cliente_id = auth.uid();
  if not found then raise exception 'FOTO_NO_ENCONTRADA'; end if;
  return coalesce(p_compartir, false);
end $$;
revoke all on function public.mi_look_compartir(uuid, boolean) from public, anon, authenticated;
grant execute on function public.mi_look_compartir(uuid, boolean) to authenticated;

-- Solicitudes de devolucion del saldo a favor. No mueve dinero: queda PENDIENTE para el proceso de pagos.
create table public.solicitud_devolucion_saldo (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.perfil(id),
  monto numeric not null check (monto > 0),
  estado text not null default 'PENDIENTE' check (estado in ('PENDIENTE','APROBADA','RECHAZADA','PAGADA')),
  origen text not null default 'CLIENTE' check (origen in ('CLIENTE','ELIMINACION_CUENTA')),
  created_at timestamptz not null default now(),
  resuelta_at timestamptz
);
create unique index solicitud_devolucion_pendiente_uq on public.solicitud_devolucion_saldo (cliente_id)
  where estado = 'PENDIENTE';
alter table public.solicitud_devolucion_saldo enable row level security;
revoke all on public.solicitud_devolucion_saldo from public, anon, authenticated;
grant select on public.solicitud_devolucion_saldo to authenticated;
create policy solicitud_devolucion_select_propia on public.solicitud_devolucion_saldo
  for select to authenticated using (cliente_id = auth.uid());

create or replace function public.mi_saldo()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_saldo numeric; v_mon text; v_pend numeric;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  select coalesce(w.saldo_disponible, 0) into v_saldo from public.lealtad_wallet w where w.cliente_id = auth.uid();
  v_saldo := coalesce(v_saldo, 0);
  select pa.moneda::text into v_mon from public.perfil pf join public.pais pa on pa.codigo = pf.pais where pf.id = auth.uid();
  select s.monto into v_pend from public.solicitud_devolucion_saldo s where s.cliente_id = auth.uid() and s.estado = 'PENDIENTE';
  return jsonb_build_object('saldo', v_saldo, 'moneda', coalesce(v_mon, 'COP'), 'devolucion_pendiente', v_pend);
end $$;
revoke all on function public.mi_saldo() from public, anon, authenticated;
grant execute on function public.mi_saldo() to authenticated;

create or replace function public.solicitar_devolucion_saldo(p_monto numeric default null)
returns public.solicitud_devolucion_saldo language plpgsql security definer set search_path = public as $$
declare v_saldo numeric; v_monto numeric; v public.solicitud_devolucion_saldo;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  select coalesce(w.saldo_disponible, 0) into v_saldo from public.lealtad_wallet w where w.cliente_id = auth.uid();
  v_saldo := coalesce(v_saldo, 0);
  v_monto := coalesce(p_monto, v_saldo);
  if v_monto <= 0 or v_saldo <= 0 then raise exception 'SIN_SALDO'; end if;
  if v_monto > v_saldo then raise exception 'SALDO_INSUFICIENTE'; end if;
  if exists (select 1 from public.solicitud_devolucion_saldo s where s.cliente_id = auth.uid() and s.estado = 'PENDIENTE') then
    raise exception 'DEVOLUCION_YA_PENDIENTE';
  end if;
  insert into public.solicitud_devolucion_saldo (cliente_id, monto) values (auth.uid(), v_monto) returning * into v;
  return v;
end $$;
revoke all on function public.solicitar_devolucion_saldo(numeric) from public, anon, authenticated;
grant execute on function public.solicitar_devolucion_saldo(numeric) to authenticated;

-- Historial: pagos de sus citas + movimientos de saldo. p_filtro: TODO | PAGOS | SALDO.
create or replace function public.mis_pagos(p_filtro text default 'TODO', p_limite integer default 50)
returns table (fecha timestamptz, categoria text, concepto text, negocio_nombre text,
               monto numeric, estado text, referencia_id uuid)
language plpgsql stable security definer set search_path = public as $$
declare v_f text := upper(coalesce(p_filtro, 'TODO'));
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if v_f not in ('TODO','PAGOS','SALDO') then raise exception 'FILTRO_INVALIDO'; end if;
  return query
  select h.fecha, h.categoria, h.concepto, h.negocio_nombre, h.monto, h.estado, h.referencia_id from (
    select p.created_at as fecha, 'PAGO'::text as categoria,
           case p.tipo::text when 'SENA' then 'ANTICIPO' when 'SALDO' then 'SALDO_EN_SILLA' else p.tipo::text end as concepto,
           ng.nombre as negocio_nombre, -p.monto as monto,
           case p.estado::text when 'APROBADO' then 'PAGADO' when 'PENDIENTE' then 'EN_PROCESO'
                when 'REEMBOLSADO' then 'REEMBOLSADO' when 'REEMBOLSADO_PARCIAL' then 'REEMBOLSADO'
                when 'RECHAZADO' then 'RECHAZADO' else p.estado::text end as estado,
           p.id as referencia_id
    from public.pago p
    join public.reserva re on re.id = p.reserva_id and re.cliente_id = auth.uid()
    join public.negocio ng on ng.id = re.negocio_id
    where p.tipo::text in ('SENA','SALDO','PROPINA') and v_f in ('TODO','PAGOS')
    union all
    select m.created_at, 'SALDO', m.tipo::text, ng.nombre,
           case when m.tipo::text = 'CANJE' then -abs(m.monto) else m.monto end, 'A_SALDO', m.id
    from public.lealtad_movimiento m
    join public.lealtad_wallet w on w.id = m.wallet_id and w.cliente_id = auth.uid()
    left join public.negocio ng on ng.id = m.negocio_id
    where v_f in ('TODO','SALDO')
  ) h order by h.fecha desc limit least(greatest(coalesce(p_limite, 50), 1), 200);
end $$;
revoke all on function public.mis_pagos(text, integer) from public, anon, authenticated;
grant execute on function public.mis_pagos(text, integer) to authenticated;

-- Referidos (C09): codigo, totales e invitados (primer nombre + inicial del apellido).
create or replace function public.mis_referidos_detalle()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_cod public.referido_codigo; v_lista jsonb; v_inv int; v_hechos int; v_ganado numeric;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  v_cod := public.obtener_mi_codigo_referido();
  select count(*), count(*) filter (where r.estado = 'COMPLETADO'),
         coalesce(sum(r.monto_recompensa) filter (where r.estado = 'COMPLETADO'), 0)
    into v_inv, v_hechos, v_ganado from public.referido r where r.referente_cliente_id = auth.uid();
  select coalesce(jsonb_agg(jsonb_build_object(
      'referido_id', r.id,
      'nombre', case when p.nombre is null or p.nombre = 'Cliente anónimo' then 'Cliente anónimo'
                     else split_part(p.nombre, ' ', 1)
                       || case when split_part(p.nombre, ' ', 2) <> '' then ' ' || upper(left(split_part(p.nombre, ' ', 2), 1)) || '.' else '' end end,
      'estado', case r.estado::text when 'COMPLETADO' then 'CITA_HECHA' when 'PENDIENTE' then 'REGISTRADO' else r.estado::text end,
      'se_unio_at', r.created_at, 'completado_at', r.completado_at, 'monto_recompensa', r.monto_recompensa
    ) order by r.created_at desc), '[]'::jsonb) into v_lista
  from public.referido r left join public.perfil p on p.id = r.referido_cliente_id
  where r.referente_cliente_id = auth.uid();
  return jsonb_build_object('codigo', v_cod.codigo, 'invitados', v_inv, 'con_cita', v_hechos,
                            'ganado', v_ganado, 'lista', v_lista);
end $$;
revoke all on function public.mis_referidos_detalle() from public, anon, authenticated;
grant execute on function public.mis_referidos_detalle() to authenticated;
