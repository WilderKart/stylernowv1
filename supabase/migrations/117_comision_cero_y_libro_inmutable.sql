-- 117 · Comisión de reservas 0 % por defecto (configurable, por vigencia) y libro financiero inmutable.
--
-- Directiva Única Integral §7.4, §11, §19 (2026-11-12). Sin aplicar. Depende de 116
-- (usa public.trg_fila_inmutable).
--
-- Comisión:
--  * El rango pasa de 3–15 % a 0–15 %; el default de plataforma y de negocios nuevos es 0 %.
--  * NO se reescribe la comisión de los 95 negocios existentes (8–10 %) ni ningún pago histórico:
--    el cambio a un negocio existente se PROGRAMA con fecha de vigencia y motivo
--    (`comision_cambio_programado`), y lo aplica el cron cuando llega la fecha.
--  * `actualizar_comision_plataforma_global` ya no pisa a todos los negocios: solo cambia el
--    default para negocios nuevos (antes sobrescribía en el acto, sin vigencia ni aviso).
--  * Cada pago guarda el % con que se calculó (`pago.comision_plataforma_pct`) para que el
--    histórico sea reconstruible aunque el % del negocio cambie después.
--
-- Libro inmutable: ni las API (authenticated/service_role) pueden modificar ni borrar
-- movimientos; las correcciones son movimientos compensatorios.

-- ════════════════════════════════════════════════════════════════════════
-- 1. Rango y defaults de comisión
-- ════════════════════════════════════════════════════════════════════════

alter table public.negocio drop constraint if exists negocio_comision_plataforma_pct_check;
alter table public.negocio add constraint negocio_comision_plataforma_pct_check
  check (comision_plataforma_pct between 0 and 15);
alter table public.negocio alter column comision_plataforma_pct set default 0;

alter table public.configuracion_plataforma drop constraint if exists configuracion_plataforma_comision_plataforma_pct_default_check;
alter table public.configuracion_plataforma add constraint configuracion_plataforma_comision_plataforma_pct_default_check
  check (comision_plataforma_pct_default between 0 and 15);
alter table public.configuracion_plataforma alter column comision_plataforma_pct_default set default 0;

-- Valor vigente del default para negocios NUEVOS (no toca a los existentes).
update public.configuracion_plataforma set comision_plataforma_pct_default = 0, updated_at = now() where id;

-- Los negocios nuevos toman el default configurado por Super Admin, no una constante.
create or replace function public.trg_negocio_comision_default() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select comision_plataforma_pct_default into new.comision_plataforma_pct
    from public.configuracion_plataforma where id;
  new.comision_plataforma_pct := coalesce(new.comision_plataforma_pct, 0);
  return new;
end $$;
revoke all on function public.trg_negocio_comision_default() from public, anon, authenticated;

drop trigger if exists trg_negocio_comision_default on public.negocio;
create trigger trg_negocio_comision_default before insert on public.negocio
  for each row execute function public.trg_negocio_comision_default();

alter table public.pago add column if not exists comision_plataforma_pct numeric(5,2);

-- ════════════════════════════════════════════════════════════════════════
-- 2. Cambios de comisión programados (vigencia por fecha)
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.comision_cambio_programado (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid references public.negocio(id),   -- null = todos los negocios existentes
  pct_nuevo numeric(5,2) not null check (pct_nuevo between 0 and 15),
  efectivo_desde timestamptz not null,
  motivo text not null check (length(btrim(motivo)) > 0),
  creado_por uuid not null,
  created_at timestamptz not null default now(),
  aplicado_at timestamptz,
  anulado_at timestamptz,
  negocios_afectados int
);

alter table public.comision_cambio_programado enable row level security;
create policy comision_cambio_select on public.comision_cambio_programado for select to authenticated
  using (public.is_supersu() or (negocio_id is not null and public.is_barberia_de(negocio_id)));
revoke all on public.comision_cambio_programado from public, anon;
revoke insert, update, delete, truncate on public.comision_cambio_programado from authenticated, service_role;
grant select on public.comision_cambio_programado to authenticated, service_role;

create or replace function public.admin_programar_comision(
  p_negocio_id uuid, p_pct numeric, p_efectivo_desde timestamptz, p_motivo text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_supersu() then raise exception 'NO_AUTORIZADO'; end if;
  if p_pct is null or p_pct < 0 or p_pct > 15 then raise exception 'COMISION_FUERA_DE_RANGO'; end if;
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'MOTIVO_REQUERIDO'; end if;
  -- Nunca retroactivo: como mínimo, desde ahora.
  if p_efectivo_desde is null or p_efectivo_desde < now() - interval '1 minute' then
    raise exception 'VIGENCIA_RETROACTIVA_NO_PERMITIDA';
  end if;

  insert into public.comision_cambio_programado (negocio_id, pct_nuevo, efectivo_desde, motivo, creado_por)
  values (p_negocio_id, round(p_pct, 2), p_efectivo_desde, p_motivo, auth.uid())
  returning id into v_id;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, motivo, payload_despues)
  values ('comision_cambio_programado', v_id, 'COMISION_CAMBIO_PROGRAMADO', 'SUPERSU', auth.uid(), p_negocio_id, p_motivo,
          jsonb_build_object('pct_nuevo', round(p_pct, 2), 'efectivo_desde', p_efectivo_desde, 'alcance',
                             case when p_negocio_id is null then 'TODOS' else 'NEGOCIO' end));
  return v_id;
end $$;
revoke all on function public.admin_programar_comision(uuid, numeric, timestamptz, text) from public, anon, authenticated;
grant execute on function public.admin_programar_comision(uuid, numeric, timestamptz, text) to authenticated;

create or replace function public.admin_anular_comision_programada(p_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_supersu() then raise exception 'NO_AUTORIZADO'; end if;
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'MOTIVO_REQUERIDO'; end if;
  update public.comision_cambio_programado set anulado_at = now()
   where id = p_id and aplicado_at is null and anulado_at is null;
  if not found then raise exception 'CAMBIO_NO_ANULABLE'; end if;
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, motivo)
  values ('comision_cambio_programado', p_id, 'COMISION_CAMBIO_ANULADO', 'SUPERSU', auth.uid(), p_motivo);
end $$;
revoke all on function public.admin_anular_comision_programada(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_anular_comision_programada(uuid, text) to authenticated;

-- Cron (service_role): aplica los cambios cuya fecha llegó. Afecta solo pagos FUTUROS:
-- la comisión de cada pago se fija al aprobarse y queda guardada en el propio pago.
create or replace function public.aplicar_comisiones_programadas()
returns int language plpgsql security definer set search_path = public as $$
declare c record; v_n int; v_total int := 0; v_antes jsonb;
begin
  for c in select * from public.comision_cambio_programado
            where aplicado_at is null and anulado_at is null and efectivo_desde <= now()
            order by efectivo_desde for update skip locked
  loop
    select coalesce(jsonb_object_agg(id, comision_plataforma_pct), '{}'::jsonb) into v_antes
      from public.negocio where c.negocio_id is null or id = c.negocio_id;

    update public.negocio set comision_plataforma_pct = c.pct_nuevo
     where (c.negocio_id is null or id = c.negocio_id) and comision_plataforma_pct is distinct from c.pct_nuevo;
    get diagnostics v_n = row_count;

    update public.comision_cambio_programado set aplicado_at = now(), negocios_afectados = v_n where id = c.id;

    insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, negocio_id, motivo, payload_antes, payload_despues)
    values ('comision_cambio_programado', c.id, 'COMISION_CAMBIO_APLICADO', 'SISTEMA', c.negocio_id, c.motivo, v_antes,
            jsonb_build_object('pct_nuevo', c.pct_nuevo, 'negocios_afectados', v_n));
    v_total := v_total + v_n;
  end loop;
  return v_total;
end $$;
revoke all on function public.aplicar_comisiones_programadas() from public, anon, authenticated;
grant execute on function public.aplicar_comisiones_programadas() to service_role;

-- Misma firma; ya no sobrescribe a todos los negocios en el acto.
create or replace function public.actualizar_comision_plataforma_global(p_pct numeric)
returns public.configuracion_plataforma
language plpgsql security definer set search_path = public as $fn$
declare v_anterior numeric; v_config public.configuracion_plataforma;
begin
  if not public.is_supersu() then raise exception 'NO_AUTORIZADO'; end if;
  if p_pct is null or p_pct < 0 or p_pct > 15 then raise exception 'COMISION_FUERA_DE_RANGO'; end if;

  select comision_plataforma_pct_default into v_anterior from public.configuracion_plataforma where id = true;

  update public.configuracion_plataforma
     set comision_plataforma_pct_default = p_pct, updated_at = now(), updated_by = auth.uid()
   where id = true
  returning * into v_config;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, payload_antes, payload_despues, motivo)
  values ('configuracion_plataforma', null, 'COMISION_DEFAULT_ACTUALIZADA', 'SUPERSU', auth.uid(),
          jsonb_build_object('comision_pct_default', v_anterior), jsonb_build_object('comision_pct_default', p_pct),
          'Solo negocios nuevos; los existentes cambian con admin_programar_comision');
  return v_config;
end;
$fn$;
revoke all on function public.actualizar_comision_plataforma_global(numeric) from public, anon, authenticated;
grant execute on function public.actualizar_comision_plataforma_global(numeric) to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 3. aplicar_evento_pago: fallback 0 % (no 8 %) y % guardado en el pago
-- ════════════════════════════════════════════════════════════════════════
-- Se parchea el texto de la definición vigente (misma técnica que la 109) para no copiar
-- 170 líneas; si el texto esperado no está, la migración falla y no cambia nada.

do $$
declare
  v_def text := pg_get_functiondef('public.aplicar_evento_pago(uuid,text,pago_estado,jsonb)'::regprocedure);
  v_viejo_calc text := 'coalesce(v_negocio.comision_plataforma_pct, 8)';
  v_viejo_set text := 'comision_plataforma_monto = v_comision,';
begin
  if position(v_viejo_calc in v_def) = 0 or position(v_viejo_set in v_def) = 0 then
    raise exception 'aplicar_evento_pago cambió: revisar el parche de la 117 a mano';
  end if;
  v_def := replace(v_def, v_viejo_calc, 'coalesce(v_negocio.comision_plataforma_pct, 0)');
  v_def := replace(v_def, v_viejo_set,
    'comision_plataforma_monto = v_comision, comision_plataforma_pct = coalesce(v_negocio.comision_plataforma_pct, 0),');
  execute v_def;
end $$;

revoke all on function public.aplicar_evento_pago(uuid, text, pago_estado, jsonb) from public, anon, authenticated;
grant execute on function public.aplicar_evento_pago(uuid, text, pago_estado, jsonb) to service_role;

-- ════════════════════════════════════════════════════════════════════════
-- 4. Libro financiero inmutable
-- ════════════════════════════════════════════════════════════════════════

do $$
declare t text;
begin
  foreach t in array array['wallet_movimiento','lealtad_movimiento','cashback_movimiento','evento_auditoria',
                           'credito_ia_consumo','gift_card_redencion','membresia_uso']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists trg_%s_inmutable on public.%I', t, t);
      execute format('create trigger trg_%s_inmutable before update or delete on public.%I
                      for each row execute function public.trg_fila_inmutable()', t, t);
      execute format('revoke update, delete, truncate on public.%I from public, anon, authenticated, service_role', t);
    end if;
  end loop;
end $$;

-- `pago` sí cambia de estado (máquina de estados), pero su identidad económica no:
-- monto, tipo, negocio, reserva y fecha de creación son inmutables, y no se borra nunca.
create or replace function public.trg_pago_proteger_historial() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('postgres', 'supabase_admin') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then raise exception 'REGISTRO_INMUTABLE: DELETE en pago'; end if;
  if new.monto is distinct from old.monto or new.tipo is distinct from old.tipo
     or new.negocio_id is distinct from old.negocio_id or new.reserva_id is distinct from old.reserva_id
     or new.created_at is distinct from old.created_at
     or (old.comision_plataforma_pct is not null and new.comision_plataforma_pct is distinct from old.comision_plataforma_pct)
     or (old.id_transaccion_pasarela is not null and new.id_transaccion_pasarela is distinct from old.id_transaccion_pasarela) then
    raise exception 'PAGO_CAMPO_INMUTABLE';
  end if;
  if old.estado in ('REEMBOLSADO') and new.estado is distinct from old.estado then
    raise exception 'TRANSICION_PAGO_INVALIDA: % -> %', old.estado, new.estado;
  end if;
  return new;
end $$;
revoke all on function public.trg_pago_proteger_historial() from public, anon, authenticated;

drop trigger if exists trg_pago_proteger_historial on public.pago;
create trigger trg_pago_proteger_historial before update or delete on public.pago
  for each row execute function public.trg_pago_proteger_historial();
revoke delete, truncate on public.pago from public, anon, authenticated, service_role;

-- Cero confianza, segunda barrera: en producción anon/authenticated conservan INSERT/UPDATE/DELETE
-- por los default privileges de Supabase (verificado 2026-11-12: `anon` tiene UPDATE sobre pago y
-- wallet). Hoy los frena solo la RLS (ninguna de estas tablas tiene política de escritura para
-- clientes). Se revoca el privilegio para que un error futuro de RLS no abra el dinero.
do $$
declare t text;
begin
  foreach t in array array['pago','wallet','wallet_movimiento','lealtad_wallet','lealtad_movimiento','cashback_movimiento',
                           'gift_card','gift_card_redencion','membresia_uso','credito_ia_consumo','credito_ia_lote',
                           'solicitud_devolucion_saldo','suscripcion_fundador','prueba_uso','evento_auditoria',
                           'configuracion_plataforma']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke insert, update, delete, truncate on public.%I from public, anon, authenticated', t);
    end if;
  end loop;
end $$;
