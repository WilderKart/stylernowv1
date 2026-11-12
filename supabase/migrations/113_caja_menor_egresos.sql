-- 4.3 Caja menor: egresos diarios (escoba, tintos, etc.) que restan del efectivo para que el cierre cuadre con los billetes.
-- Los egresos no se borran: se anulan con motivo y todo queda auditado. Monto y fecha los fija el servidor.
-- Solo dueño del negocio o guardian de la sede pueden registrar/anular (los barberos no). Nadie escribe la tabla por API directa.
-- PENDIENTE DE APLICAR por Wilder.
create table if not exists public.egreso_caja (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id),
  sede_id uuid not null references public.sede(id),
  monto numeric(12,2) not null check (monto > 0 and monto <= 5000000),
  concepto text not null check (length(btrim(concepto)) between 2 and 120),
  categoria text not null default 'OTRO' check (categoria in ('ASEO','CAFETERIA','INSUMOS','TRANSPORTE','PROPINA_STAFF','OTRO')),
  registrado_por uuid not null references auth.users(id),
  fecha date not null default ((now() at time zone 'America/Bogota')::date),
  created_at timestamptz not null default now(),
  anulado boolean not null default false,
  anulado_por uuid references auth.users(id),
  anulado_motivo text check (anulado_motivo is null or length(btrim(anulado_motivo)) between 3 and 200),
  anulado_at timestamptz
);
create index if not exists egreso_caja_negocio_fecha on public.egreso_caja (negocio_id, sede_id, fecha);
alter table public.egreso_caja enable row level security;
revoke all on public.egreso_caja from anon;
revoke insert, update, delete on public.egreso_caja from authenticated;
drop policy if exists egreso_caja_select on public.egreso_caja;
create policy egreso_caja_select on public.egreso_caja for select to authenticated
  using (public.is_barberia_de(negocio_id) or public.is_guardian_de_sede(sede_id) or public.is_supersu());

create or replace function public.registrar_egreso_caja(p_negocio_id uuid, p_sede_id uuid, p_monto numeric, p_concepto text, p_categoria text default 'OTRO')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if not exists (select 1 from public.sede s where s.id = p_sede_id and s.negocio_id = p_negocio_id) then raise exception 'SEDE_INVALIDA'; end if;
  if not (public.is_barberia_de(p_negocio_id) or public.is_guardian_de_sede(p_sede_id)) then raise exception 'NO_AUTORIZADO'; end if;
  if p_monto is null or p_monto <= 0 or p_monto > 5000000 then raise exception 'MONTO_INVALIDO'; end if;
  if p_concepto is null or length(btrim(p_concepto)) < 2 then raise exception 'CONCEPTO_INVALIDO'; end if;
  insert into public.egreso_caja (negocio_id, sede_id, monto, concepto, categoria, registrado_por)
  values (p_negocio_id, p_sede_id, p_monto, left(btrim(p_concepto), 120), coalesce(nullif(p_categoria, ''), 'OTRO'), auth.uid())
  returning id into v_id;
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_despues)
  values ('egreso_caja', v_id, 'EGRESO_REGISTRADO', 'BARBERIA', auth.uid(), p_negocio_id,
          jsonb_build_object('monto', p_monto, 'concepto', left(btrim(p_concepto), 120)));
  return v_id;
end $$;

create or replace function public.anular_egreso_caja(p_egreso_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare v public.egreso_caja;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  select * into v from public.egreso_caja where id = p_egreso_id for update;
  if not found then raise exception 'EGRESO_NO_ENCONTRADO'; end if;
  if not (public.is_barberia_de(v.negocio_id) or public.is_guardian_de_sede(v.sede_id)) then raise exception 'NO_AUTORIZADO'; end if;
  if v.anulado then raise exception 'EGRESO_YA_ANULADO'; end if;
  if p_motivo is null or length(btrim(p_motivo)) < 3 then raise exception 'MOTIVO_REQUERIDO'; end if;
  update public.egreso_caja
     set anulado = true, anulado_por = auth.uid(), anulado_motivo = left(btrim(p_motivo), 200), anulado_at = now()
   where id = p_egreso_id;
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, motivo, payload_antes)
  values ('egreso_caja', p_egreso_id, 'EGRESO_ANULADO', 'BARBERIA', auth.uid(), v.negocio_id, left(btrim(p_motivo), 200),
          jsonb_build_object('monto', v.monto, 'concepto', v.concepto));
end $$;

-- Funciones nuevas: REVOKE de los tres roles y GRANT solo a authenticated (validan el actor adentro).
revoke all on function public.registrar_egreso_caja(uuid, uuid, numeric, text, text) from public, anon, authenticated;
grant execute on function public.registrar_egreso_caja(uuid, uuid, numeric, text, text) to authenticated;
revoke all on function public.anular_egreso_caja(uuid, text) from public, anon, authenticated;
grant execute on function public.anular_egreso_caja(uuid, text) to authenticated;

-- Cierre de caja: efectivo esperado = efectivo cobrado - egresos del dia (el fondo inicial lo suma la pantalla).
-- Misma firma; agrega claves al JSON. Lo digital (tarjeta/datafono) no entra al efectivo esperado.
create or replace function public.cierre_caja_dia(p_negocio_id uuid, p_sede_id uuid, p_fecha date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_autorizado boolean;
  v_fecha date := coalesce(p_fecha, (now() at time zone 'America/Bogota')::date);
  v_inicio timestamptz; v_fin timestamptz;
  v_efectivo numeric; v_digital numeric; v_total numeric; v_egresos numeric; v_lista jsonb;
begin
  if p_sede_id is not null then
    v_autorizado := public.is_barberia_de(p_negocio_id) or public.is_guardian_de_sede(p_sede_id);
  else
    v_autorizado := public.is_barberia_de(p_negocio_id);
  end if;
  if not v_autorizado then raise exception 'NO_AUTORIZADO'; end if;

  v_inicio := v_fecha::timestamp at time zone 'America/Bogota';
  v_fin := (v_fecha + 1)::timestamp at time zone 'America/Bogota';

  select coalesce(sum(p.monto) filter (where p.pasarela = 'EFECTIVO'), 0),
         coalesce(sum(p.monto) filter (where p.pasarela <> 'EFECTIVO'), 0),
         coalesce(sum(p.monto), 0)
    into v_efectivo, v_digital, v_total
  from public.pago p join public.reserva r on r.id = p.reserva_id
  where p.negocio_id = p_negocio_id and p.estado = 'APROBADO' and p.tipo in ('SALDO', 'PROPINA', 'SENA')
    and p.created_at >= v_inicio and p.created_at < v_fin and (p_sede_id is null or r.sede_id = p_sede_id);

  select coalesce(sum(e.monto) filter (where not e.anulado), 0),
         coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'monto', e.monto, 'concepto', e.concepto, 'categoria', e.categoria,
                  'anulado', e.anulado, 'anulado_motivo', e.anulado_motivo, 'hora', e.created_at) order by e.created_at), '[]'::jsonb)
    into v_egresos, v_lista
  from public.egreso_caja e
  where e.negocio_id = p_negocio_id and e.fecha = v_fecha and (p_sede_id is null or e.sede_id = p_sede_id);

  return jsonb_build_object('fecha', v_fecha, 'efectivo', v_efectivo, 'digital', v_digital, 'total', v_total,
                            'egresos', v_egresos, 'efectivo_esperado', v_efectivo - v_egresos, 'egresos_lista', v_lista);
end $$;
