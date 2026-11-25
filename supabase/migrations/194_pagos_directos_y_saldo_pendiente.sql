-- 194 · Pagos directos (Nequi / Daviplata / Bre-B / QR) con conciliación posterior + saldo pendiente por cliente.
--
-- Reglas (innegociables):
--  · Cero split / cero custodia: el cliente transfiere directo a la cuenta del negocio y sube el soporte. Al subir el
--    soporte la cita queda CONFIRMADA al instante (no espera aprobación).
--  · El POS confía en el soporte: descuenta el monto reportado (salvo pago RECHAZADO). El barbero solo cobra la diferencia.
--  · Verificar, anular por anomalía, marcar "no recibido" y ajustar/condonar saldos: SOLO dueño (is_barberia_de) o SUPERSU,
--    siempre con rastro en evento_auditoria. Nunca DELETE de una cita: se pasa a CANCELADA (PAGO_NO_VERIFICADO).
--  · Saldo pendiente aislado por (negocio_id, cliente_id), sin bloquear al cliente: se cobra en su próxima reserva/POS.
--  · El monto del anticipo lo sigue fijando el motor de la migración 129 (reserva.monto_sena); aquí NO se duplica esa regla.
--  · Preparado para pasarelas: pago_reserva.metodo admite WOMPI / MERCADO_PAGO (no se implementan aquí).
--
-- Todo es aditivo e idempotente (create if not exists / create or replace / parches con ancla exacta).

-- ════════════════════════════════════════════════════════════════════════
-- 1. Medios de pago directo del negocio
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.negocio_medio_pago_directo (
  negocio_id uuid primary key references public.negocio(id) on delete cascade,
  activo boolean not null default false,
  llave_breb text,
  nequi text,
  daviplata text,
  link_pago text,
  qr_path text,                       -- ruta dentro del bucket privado `pagos-directos`: <negocio_id>/qr/<archivo>
  instrucciones text,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  constraint medio_pago_largos check (
    coalesce(length(llave_breb), 0) <= 60 and coalesce(length(nequi), 0) <= 30 and coalesce(length(daviplata), 0) <= 30
    and coalesce(length(link_pago), 0) <= 300 and coalesce(length(instrucciones), 0) <= 500),
  constraint medio_pago_link_https check (link_pago is null or link_pago ~* '^https://'),
  constraint medio_pago_qr_ruta check (qr_path is null or qr_path like (negocio_id::text || '/qr/%')),
  -- Para activarlo debe existir al menos un medio por donde transferir.
  constraint medio_pago_activo_con_medio check (
    not activo or coalesce(nullif(trim(llave_breb), ''), nullif(trim(nequi), ''), nullif(trim(daviplata), ''),
                           nullif(trim(link_pago), ''), qr_path) is not null)
);
alter table public.negocio_medio_pago_directo enable row level security;

-- Los datos de cuenta NO son públicos: el cliente los recibe solo por medios_pago_directo_para_reserva (su propia reserva).
drop policy if exists medio_pago_select on public.negocio_medio_pago_directo;
create policy medio_pago_select on public.negocio_medio_pago_directo for select to authenticated
  using (coalesce(public.is_barberia_de(negocio_id), false) or coalesce(public.is_supersu(), false));
drop policy if exists medio_pago_insert on public.negocio_medio_pago_directo;
create policy medio_pago_insert on public.negocio_medio_pago_directo for insert to authenticated
  with check (coalesce(public.is_barberia_de(negocio_id), false) or coalesce(public.is_supersu(), false));
drop policy if exists medio_pago_update on public.negocio_medio_pago_directo;
create policy medio_pago_update on public.negocio_medio_pago_directo for update to authenticated
  using (coalesce(public.is_barberia_de(negocio_id), false) or coalesce(public.is_supersu(), false))
  with check (coalesce(public.is_barberia_de(negocio_id), false) or coalesce(public.is_supersu(), false));
revoke all on public.negocio_medio_pago_directo from public, anon, authenticated;
grant select, insert, update on public.negocio_medio_pago_directo to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 2. pago_reserva (pagos directos reportados; lista para futura automatización)
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.pago_reserva (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null references public.reserva(id),
  negocio_id uuid not null references public.negocio(id),
  cliente_id uuid not null,
  metodo text not null default 'TRANSFERENCIA_DIRECTA' check (metodo in ('TRANSFERENCIA_DIRECTA', 'WOMPI', 'MERCADO_PAGO')),
  estado text not null default 'REPORTADO' check (estado in ('REPORTADO', 'VERIFICADO', 'RECHAZADO')),
  monto_esperado numeric(12,2) not null check (monto_esperado >= 0),
  monto_reportado numeric(12,2) not null check (monto_reportado > 0),
  comprobante_url text,               -- ruta en el bucket privado `pagos-directos`: <negocio_id>/<reserva_id>/<archivo>
  comprobante_hash text check (comprobante_hash is null or comprobante_hash ~ '^[0-9a-f]{64}$'),
  referencia_corta text,
  revisado_por uuid,
  revisado_at timestamptz,
  motivo_rechazo text,
  created_at timestamptz not null default now(),
  constraint pago_reserva_rechazo_con_motivo check (estado <> 'RECHAZADO' or length(trim(coalesce(motivo_rechazo, ''))) >= 10)
);
create index if not exists pago_reserva_negocio_estado_idx on public.pago_reserva (negocio_id, estado, created_at desc);
create index if not exists pago_reserva_reserva_idx on public.pago_reserva (reserva_id);
-- El mismo pantallazo no se reutiliza en dos citas distintas del mismo negocio (los RECHAZADOS no bloquean).
create unique index if not exists pago_reserva_comprobante_unico
  on public.pago_reserva (negocio_id, comprobante_hash) where comprobante_hash is not null and estado <> 'RECHAZADO';
-- Un solo pago directo vigente por cita.
create unique index if not exists pago_reserva_directo_vigente_unico
  on public.pago_reserva (reserva_id) where metodo = 'TRANSFERENCIA_DIRECTA' and estado <> 'RECHAZADO';

alter table public.pago_reserva enable row level security;
drop policy if exists pago_reserva_select on public.pago_reserva;
create policy pago_reserva_select on public.pago_reserva for select to authenticated
  using (cliente_id = (select auth.uid())
         or coalesce(public.tiene_acceso_interno(negocio_id), false)
         or coalesce(public.is_supersu(), false));
revoke all on public.pago_reserva from public, anon, authenticated;
grant select on public.pago_reserva to authenticated;   -- toda escritura pasa por RPC

-- ════════════════════════════════════════════════════════════════════════
-- 3. Saldo pendiente por cliente (solo en ese negocio) + historial
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.cliente_saldo_pendiente (
  negocio_id uuid not null references public.negocio(id) on delete cascade,
  cliente_id uuid not null,
  saldo_actual numeric(12,2) not null default 0 check (saldo_actual >= 0),
  updated_at timestamptz not null default now(),
  primary key (negocio_id, cliente_id)
);
create table if not exists public.cliente_saldo_movimiento (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id) on delete cascade,
  cliente_id uuid not null,
  tipo text not null check (tipo in ('CARGO_PAGO_NO_RECIBIDO', 'COBRO_POS', 'AJUSTE', 'ABONO', 'CONDONACION')),
  monto_delta numeric(12,2) not null,
  saldo_antes numeric(12,2) not null,
  saldo_despues numeric(12,2) not null check (saldo_despues >= 0),
  motivo text,
  reserva_id uuid,
  pago_reserva_id uuid,
  actor_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists cliente_saldo_mov_idx on public.cliente_saldo_movimiento (negocio_id, cliente_id, created_at desc);

alter table public.cliente_saldo_pendiente enable row level security;
alter table public.cliente_saldo_movimiento enable row level security;
drop policy if exists saldo_select on public.cliente_saldo_pendiente;
create policy saldo_select on public.cliente_saldo_pendiente for select to authenticated
  using (cliente_id = (select auth.uid())
         or coalesce(public.tiene_acceso_interno(negocio_id), false)
         or coalesce(public.is_supersu(), false));
drop policy if exists saldo_mov_select on public.cliente_saldo_movimiento;
create policy saldo_mov_select on public.cliente_saldo_movimiento for select to authenticated
  using (coalesce(public.is_barberia_de(negocio_id), false) or coalesce(public.is_supersu(), false));
revoke all on public.cliente_saldo_pendiente, public.cliente_saldo_movimiento from public, anon, authenticated;
grant select on public.cliente_saldo_pendiente, public.cliente_saldo_movimiento to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 4. Storage: bucket privado de comprobantes y QR
-- ════════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pagos-directos', 'pagos-directos', false, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 2097152,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

-- Rutas: QR → <negocio_id>/qr/<archivo> · comprobante → <negocio_id>/<reserva_id>/<archivo>
-- Sin políticas de UPDATE/DELETE para clientes: un soporte subido no se reemplaza ni se borra (evidencia).
drop policy if exists pagos_directos_insert on storage.objects;
create policy pagos_directos_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'pagos-directos' and (
      -- QR: solo el dueño del negocio (o SuperSU).
      ((storage.foldername(name))[2] = 'qr'
        and (coalesce(public.is_barberia_de(((storage.foldername(name))[1])::uuid), false) or coalesce(public.is_supersu(), false)))
      or
      -- Comprobante: solo el cliente dueño de una reserva de ese negocio que aún espera el pago.
      ((storage.foldername(name))[2] <> 'qr'
        and exists (select 1 from public.reserva r
                    where r.id::text = (storage.foldername(name))[2]
                      and r.negocio_id::text = (storage.foldername(name))[1]
                      and r.cliente_id = (select auth.uid())
                      and r.estado = 'PENDIENTE_PAGO'))
    ));
drop policy if exists pagos_directos_select on storage.objects;
create policy pagos_directos_select on storage.objects for select to authenticated
  using (
    bucket_id = 'pagos-directos' and (
      coalesce(public.is_supersu(), false)
      or coalesce(public.tiene_acceso_interno(((storage.foldername(name))[1])::uuid), false)
      or ((storage.foldername(name))[2] = 'qr'
          and exists (select 1 from public.reserva r
                      where r.negocio_id::text = (storage.foldername(name))[1] and r.cliente_id = (select auth.uid())
                        and r.estado in ('PENDIENTE_PAGO', 'CONFIRMADA')))
      or ((storage.foldername(name))[2] <> 'qr'
          and exists (select 1 from public.reserva r
                      where r.id::text = (storage.foldername(name))[2] and r.cliente_id = (select auth.uid())))
    ));
drop policy if exists pagos_directos_delete_qr on storage.objects;
create policy pagos_directos_delete_qr on storage.objects for delete to authenticated
  using (bucket_id = 'pagos-directos' and (storage.foldername(name))[2] = 'qr'
         and (coalesce(public.is_barberia_de(((storage.foldername(name))[1])::uuid), false) or coalesce(public.is_supersu(), false)));

-- ════════════════════════════════════════════════════════════════════════
-- 5. Auxiliares internos (no expuestos)
-- ════════════════════════════════════════════════════════════════════════
create or replace function public._es_dueno_o_supersu(p_negocio_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.is_barberia_de(p_negocio_id), false) or coalesce(public.is_supersu(), false);
$$;

create or replace function public._auditar_pago(p_entidad text, p_id uuid, p_accion text, p_negocio uuid, p_motivo text, p_antes jsonb, p_despues jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, motivo, payload_antes, payload_despues, origen)
  values (p_entidad, p_id, p_accion,
          case when coalesce(public.is_supersu(), false) then 'SUPERSU'
               when coalesce(public.is_barberia_de(p_negocio), false) then 'BARBERIA'
               else 'CLIENTE' end,
          auth.uid(), p_negocio, p_motivo, p_antes, p_despues, 'API');
$$;

-- Anticipo que el POS descuenta: el monto REPORTADO si hay pago directo vigente (REPORTADO/VERIFICADO);
-- 0 si el único pago directo fue RECHAZADO; si no hay pago directo, el anticipo del motor de la 129 (reserva.monto_sena).
create or replace function public._anticipo_descontado_reserva(p_reserva_id uuid)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare v_total numeric; v_sena numeric; v_pago record;
begin
  select monto_total, monto_sena into v_total, v_sena from public.reserva where id = p_reserva_id;
  if not found then return 0; end if;
  select estado, monto_reportado into v_pago from public.pago_reserva
    where reserva_id = p_reserva_id and metodo = 'TRANSFERENCIA_DIRECTA'
    order by (estado <> 'RECHAZADO') desc, created_at desc limit 1;
  if not found then return least(coalesce(v_sena, 0), v_total); end if;
  if v_pago.estado = 'RECHAZADO' then return 0; end if;
  return least(v_pago.monto_reportado, v_total);
end $$;

-- Liquida el saldo pendiente del cliente en ese negocio al cobrarlo en el POS; devuelve lo liquidado.
create or replace function public._saldo_pendiente_liquidar(p_negocio_id uuid, p_cliente_id uuid, p_reserva_id uuid)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_saldo numeric;
begin
  select saldo_actual into v_saldo from public.cliente_saldo_pendiente
    where negocio_id = p_negocio_id and cliente_id = p_cliente_id for update;
  if not found or coalesce(v_saldo, 0) <= 0 then return 0; end if;
  update public.cliente_saldo_pendiente set saldo_actual = 0, updated_at = now()
    where negocio_id = p_negocio_id and cliente_id = p_cliente_id;
  insert into public.cliente_saldo_movimiento (negocio_id, cliente_id, tipo, monto_delta, saldo_antes, saldo_despues, motivo, reserva_id, actor_id)
  values (p_negocio_id, p_cliente_id, 'COBRO_POS', -v_saldo, v_saldo, 0, 'Cobrado en el POS', p_reserva_id, auth.uid());
  perform public._auditar_pago('cliente_saldo', p_cliente_id, 'SALDO_PENDIENTE_COBRADO_POS', p_negocio_id, 'Cobrado en el POS',
    jsonb_build_object('saldo', v_saldo), jsonb_build_object('saldo', 0, 'reserva_id', p_reserva_id));
  return v_saldo;
end $$;

revoke all on function public._es_dueno_o_supersu(uuid), public._auditar_pago(text, uuid, text, uuid, text, jsonb, jsonb),
  public._anticipo_descontado_reserva(uuid), public._saldo_pendiente_liquidar(uuid, uuid, uuid) from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 6. RPC de lectura para el cliente
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.saldo_pendiente_cliente(p_negocio_id uuid, p_cliente_id uuid default null)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare v_cliente uuid := coalesce(p_cliente_id, auth.uid());
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if v_cliente is distinct from auth.uid()
     and not (coalesce(public.tiene_acceso_interno(p_negocio_id), false) or coalesce(public.is_supersu(), false)) then
    raise exception 'NO_AUTORIZADO';
  end if;
  return coalesce((select saldo_actual from public.cliente_saldo_pendiente
                    where negocio_id = p_negocio_id and cliente_id = v_cliente), 0);
end $$;

-- Datos para transferir (solo el cliente de esa reserva; las cuentas del negocio no son públicas).
create or replace function public.medios_pago_directo_para_reserva(p_reserva_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r public.reserva; m public.negocio_medio_pago_directo;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  select * into r from public.reserva where id = p_reserva_id;
  if not found or r.cliente_id is distinct from auth.uid() then raise exception 'RESERVA_NO_ENCONTRADA'; end if;
  select * into m from public.negocio_medio_pago_directo where negocio_id = r.negocio_id;
  if not found or not m.activo then return jsonb_build_object('activo', false); end if;
  return jsonb_build_object(
    'activo', true,
    'llave_breb', m.llave_breb, 'nequi', m.nequi, 'daviplata', m.daviplata, 'link_pago', m.link_pago,
    'qr_path', m.qr_path, 'instrucciones', m.instrucciones,
    'monto_anticipo', r.monto_sena,
    'referencia', 'CITA-' || upper(substr(replace(r.id::text, '-', ''), 1, 6)),
    'saldo_pendiente', coalesce((select saldo_actual from public.cliente_saldo_pendiente
                                  where negocio_id = r.negocio_id and cliente_id = r.cliente_id), 0));
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 7. RPC de escritura
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.registrar_pago_directo_reserva(
  p_reserva_id uuid, p_monto_reportado numeric, p_comprobante_url text, p_comprobante_hash text)
returns uuid language plpgsql security definer set search_path = public as $$
declare r public.reserva; m public.negocio_medio_pago_directo; v_id uuid; v_ref text;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  select * into r from public.reserva where id = p_reserva_id for update;
  if not found or r.cliente_id is distinct from auth.uid() then raise exception 'RESERVA_NO_ENCONTRADA'; end if;
  if r.estado <> 'PENDIENTE_PAGO' or (r.expira_at is not null and r.expira_at < now()) then raise exception 'RESERVA_NO_PAGABLE'; end if;
  perform public._exigir_operativo(r.negocio_id);

  select * into m from public.negocio_medio_pago_directo where negocio_id = r.negocio_id;
  if not found or not m.activo then raise exception 'PAGO_DIRECTO_NO_DISPONIBLE'; end if;

  if p_monto_reportado is null or p_monto_reportado <= 0 or p_monto_reportado > r.monto_total then raise exception 'MONTO_INVALIDO'; end if;
  if p_monto_reportado < r.monto_sena then raise exception 'MONTO_MENOR_AL_ANTICIPO'; end if;
  if p_comprobante_hash is null or p_comprobante_hash !~ '^[0-9a-f]{64}$' then raise exception 'COMPROBANTE_INVALIDO'; end if;
  if p_comprobante_url is null or p_comprobante_url not like (r.negocio_id::text || '/' || r.id::text || '/%') then
    raise exception 'COMPROBANTE_INVALIDO';
  end if;

  v_ref := 'CITA-' || upper(substr(replace(r.id::text, '-', ''), 1, 6));
  begin
    insert into public.pago_reserva (reserva_id, negocio_id, cliente_id, metodo, estado, monto_esperado, monto_reportado,
                                     comprobante_url, comprobante_hash, referencia_corta)
    values (r.id, r.negocio_id, r.cliente_id, 'TRANSFERENCIA_DIRECTA', 'REPORTADO', r.monto_sena, p_monto_reportado,
            p_comprobante_url, p_comprobante_hash, v_ref)
    returning id into v_id;
  exception when unique_violation then
    -- Mismo pantallazo ya usado en otra cita, o esta cita ya tiene un pago directo vigente.
    if exists (select 1 from public.pago_reserva where reserva_id = r.id and metodo = 'TRANSFERENCIA_DIRECTA' and estado <> 'RECHAZADO') then
      raise exception 'PAGO_YA_REGISTRADO';
    end if;
    raise exception 'COMPROBANTE_DUPLICADO';
  end;

  begin
    update public.reserva set estado = 'CONFIRMADA', expira_at = null, updated_at = now() where id = r.id;
  exception when exclusion_violation then
    raise exception 'HORARIO_NO_DISPONIBLE';
  end;

  perform public._auditar_pago('pago_reserva', v_id, 'PAGO_DIRECTO_REPORTADO', r.negocio_id, null, null,
    jsonb_build_object('reserva_id', r.id, 'monto_reportado', p_monto_reportado, 'monto_esperado', r.monto_sena, 'referencia', v_ref));
  return v_id;
end $$;

create or replace function public.verificar_pago_reserva(p_pago_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare p public.pago_reserva;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  select * into p from public.pago_reserva where id = p_pago_id for update;
  if not found then raise exception 'PAGO_NO_ENCONTRADO'; end if;
  if not public._es_dueno_o_supersu(p.negocio_id) then raise exception 'NO_AUTORIZADO'; end if;
  if p.estado = 'VERIFICADO' then return; end if;                      -- idempotente
  if p.estado <> 'REPORTADO' then raise exception 'PAGO_NO_VERIFICABLE'; end if;
  update public.pago_reserva set estado = 'VERIFICADO', revisado_por = auth.uid(), revisado_at = now() where id = p.id;
  perform public._auditar_pago('pago_reserva', p.id, 'PAGO_DIRECTO_VERIFICADO', p.negocio_id, null,
    jsonb_build_object('estado', p.estado), jsonb_build_object('estado', 'VERIFICADO', 'reserva_id', p.reserva_id));
end $$;

create or replace function public.anular_cita_por_pago_invalido(p_reserva_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.reserva; p public.pago_reserva;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  select * into r from public.reserva where id = p_reserva_id for update;
  if not found then raise exception 'RESERVA_NO_ENCONTRADA'; end if;
  if not public._es_dueno_o_supersu(r.negocio_id) then raise exception 'NO_AUTORIZADO'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 10 then raise exception 'MOTIVO_OBLIGATORIO'; end if;
  if r.estado <> 'CONFIRMADA' then raise exception 'RESERVA_NO_ANULABLE'; end if;          -- solo antes de la cita
  select * into p from public.pago_reserva
    where reserva_id = r.id and metodo = 'TRANSFERENCIA_DIRECTA' and estado = 'REPORTADO' for update;
  if not found then raise exception 'PAGO_NO_ANULABLE'; end if;                              -- un pago VERIFICADO no se anula por anomalía

  update public.pago_reserva set estado = 'RECHAZADO', motivo_rechazo = trim(p_motivo), revisado_por = auth.uid(), revisado_at = now()
    where id = p.id;
  update public.reserva set estado = 'CANCELADA', cancelado_por = 'NEGOCIO', cancelado_motivo = 'PAGO_NO_VERIFICADO', updated_at = now()
    where id = r.id;                                                                         -- libera el cupo; la cita NUNCA se borra
  perform public._auditar_pago('reserva', r.id, 'CITA_ANULADA_PAGO_NO_VERIFICADO', r.negocio_id, trim(p_motivo),
    jsonb_build_object('estado', r.estado, 'pago_estado', p.estado), jsonb_build_object('estado', 'CANCELADA', 'pago_id', p.id));
  perform public._notificar(r.cliente_id, 'CITA_CANCELADA', 'Tu cita fue cancelada',
    'El negocio no pudo verificar tu pago, por eso la cita se canceló. Puedes reservar de nuevo cuando quieras.',
    'Your appointment was cancelled', 'The business could not verify your payment, so the appointment was cancelled.',
    r.id, r.negocio_id, 'pago_no_verificado:' || r.id::text);
end $$;

create or replace function public.marcar_pago_no_recibido_post_cita(p_pago_id uuid, p_motivo text)
returns numeric language plpgsql security definer set search_path = public as $$
declare p public.pago_reserva; r public.reserva; v_antes numeric; v_despues numeric;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  select * into p from public.pago_reserva where id = p_pago_id for update;
  if not found then raise exception 'PAGO_NO_ENCONTRADO'; end if;
  if not public._es_dueno_o_supersu(p.negocio_id) then raise exception 'NO_AUTORIZADO'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 10 then raise exception 'MOTIVO_OBLIGATORIO'; end if;
  if p.estado = 'RECHAZADO' then raise exception 'PAGO_YA_RECHAZADO'; end if;
  select * into r from public.reserva where id = p.reserva_id;
  if r.estado <> 'COMPLETADA' then raise exception 'RESERVA_NO_COMPLETADA'; end if;          -- antes de la cita se usa anular_cita_por_pago_invalido

  update public.pago_reserva set estado = 'RECHAZADO', motivo_rechazo = trim(p_motivo), revisado_por = auth.uid(), revisado_at = now()
    where id = p.id;

  insert into public.cliente_saldo_pendiente (negocio_id, cliente_id, saldo_actual)
  values (p.negocio_id, p.cliente_id, 0) on conflict do nothing;
  select saldo_actual into v_antes from public.cliente_saldo_pendiente
    where negocio_id = p.negocio_id and cliente_id = p.cliente_id for update;
  v_despues := v_antes + p.monto_reportado;
  update public.cliente_saldo_pendiente set saldo_actual = v_despues, updated_at = now()
    where negocio_id = p.negocio_id and cliente_id = p.cliente_id;
  insert into public.cliente_saldo_movimiento (negocio_id, cliente_id, tipo, monto_delta, saldo_antes, saldo_despues, motivo, reserva_id, pago_reserva_id, actor_id)
  values (p.negocio_id, p.cliente_id, 'CARGO_PAGO_NO_RECIBIDO', p.monto_reportado, v_antes, v_despues, trim(p_motivo), p.reserva_id, p.id, auth.uid());

  perform public._auditar_pago('pago_reserva', p.id, 'PAGO_DIRECTO_NO_RECIBIDO', p.negocio_id, trim(p_motivo),
    jsonb_build_object('estado', p.estado, 'saldo', v_antes),
    jsonb_build_object('estado', 'RECHAZADO', 'saldo', v_despues, 'reserva_id', p.reserva_id));
  return v_despues;
end $$;

create or replace function public.ajustar_saldo_pendiente_cliente(
  p_negocio_id uuid, p_cliente_id uuid, p_nuevo_saldo numeric, p_motivo text, p_tipo text default 'AJUSTE')
returns numeric language plpgsql security definer set search_path = public as $$
declare v_antes numeric;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if not public._es_dueno_o_supersu(p_negocio_id) then raise exception 'NO_AUTORIZADO'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 10 then raise exception 'MOTIVO_OBLIGATORIO'; end if;
  if p_nuevo_saldo is null or p_nuevo_saldo < 0 or p_nuevo_saldo > 100000000 then raise exception 'MONTO_INVALIDO'; end if;
  if p_tipo not in ('AJUSTE', 'ABONO', 'CONDONACION') then raise exception 'TIPO_INVALIDO'; end if;
  if not exists (select 1 from public.reserva where negocio_id = p_negocio_id and cliente_id = p_cliente_id) then
    raise exception 'CLIENTE_NO_ENCONTRADO';                                                -- solo clientes con historial en este negocio
  end if;

  insert into public.cliente_saldo_pendiente (negocio_id, cliente_id, saldo_actual)
  values (p_negocio_id, p_cliente_id, 0) on conflict do nothing;
  select saldo_actual into v_antes from public.cliente_saldo_pendiente
    where negocio_id = p_negocio_id and cliente_id = p_cliente_id for update;
  if p_nuevo_saldo = v_antes then return v_antes; end if;
  if p_tipo in ('ABONO', 'CONDONACION') and p_nuevo_saldo > v_antes then raise exception 'TIPO_INVALIDO'; end if;

  update public.cliente_saldo_pendiente set saldo_actual = p_nuevo_saldo, updated_at = now()
    where negocio_id = p_negocio_id and cliente_id = p_cliente_id;
  insert into public.cliente_saldo_movimiento (negocio_id, cliente_id, tipo, monto_delta, saldo_antes, saldo_despues, motivo, actor_id)
  values (p_negocio_id, p_cliente_id, p_tipo, p_nuevo_saldo - v_antes, v_antes, p_nuevo_saldo, trim(p_motivo), auth.uid());
  perform public._auditar_pago('cliente_saldo', p_cliente_id, 'SALDO_PENDIENTE_' || p_tipo, p_negocio_id, trim(p_motivo),
    jsonb_build_object('saldo', v_antes), jsonb_build_object('saldo', p_nuevo_saldo));
  return p_nuevo_saldo;
end $$;

-- Permisos: ninguna función queda ejecutable por public ni anon; solo authenticated (los permisos reales los decide cada RPC).
revoke all on function public.saldo_pendiente_cliente(uuid, uuid), public.medios_pago_directo_para_reserva(uuid),
  public.registrar_pago_directo_reserva(uuid, numeric, text, text), public.verificar_pago_reserva(uuid),
  public.anular_cita_por_pago_invalido(uuid, text), public.marcar_pago_no_recibido_post_cita(uuid, text),
  public.ajustar_saldo_pendiente_cliente(uuid, uuid, numeric, text, text) from public, anon, authenticated;
grant execute on function public.saldo_pendiente_cliente(uuid, uuid), public.medios_pago_directo_para_reserva(uuid),
  public.registrar_pago_directo_reserva(uuid, numeric, text, text), public.verificar_pago_reserva(uuid),
  public.anular_cita_por_pago_invalido(uuid, text), public.marcar_pago_no_recibido_post_cita(uuid, text),
  public.ajustar_saldo_pendiente_cliente(uuid, uuid, numeric, text, text) to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 8. POS: descuenta el anticipo reportado y cobra/liquida el saldo pendiente (parche con anclas exactas, patrón 188/189)
-- ════════════════════════════════════════════════════════════════════════
do $$
declare
  v_def text;
  v_a1 constant text := E'  v_stock_disp int;\nbegin';
  v_a2 constant text := 'v_saldo_servicio := greatest(v_reserva.monto_total - v_reserva.monto_sena, 0) + v_total_productos;';
  v_a3 constant text := 'v_saldo_final := greatest(v_saldo_servicio - v_descuento_puntos, 0);';
  v_a4 constant text := '''saldo_cobrado'', v_saldo_final,';
begin
  v_def := pg_get_functiondef('public.completar_venta_pos(uuid, jsonb, text, numeric, text, integer)'::regprocedure);
  if position('_anticipo_descontado_reserva' in v_def) > 0 then return; end if;     -- ya migrada
  if position(v_a1 in v_def) = 0 or position(v_a2 in v_def) = 0 or position(v_a3 in v_def) = 0 or position(v_a4 in v_def) = 0 then
    raise exception 'ANCLA_NO_ENCONTRADA completar_venta_pos';
  end if;
  v_def := replace(v_def, v_a1, E'  v_stock_disp int;\n  v_deuda numeric := 0;\nbegin');
  v_def := replace(v_def, v_a2, 'v_saldo_servicio := greatest(v_reserva.monto_total - public._anticipo_descontado_reserva(p_reserva_id), 0) + v_total_productos;');
  v_def := replace(v_def, v_a3, v_a3 || E'\n  v_deuda := public._saldo_pendiente_liquidar(v_reserva.negocio_id, v_reserva.cliente_id, p_reserva_id);\n  v_saldo_final := v_saldo_final + v_deuda;');
  v_def := replace(v_def, v_a4, v_a4 || E' ''saldo_pendiente_cobrado'', v_deuda, ''anticipo_descontado'', public._anticipo_descontado_reserva(p_reserva_id),');
  execute v_def;
end $$;

-- Completar sin POS: no se cobra nada, así que NO liquida el saldo (liquidarlo sin cobro permitiría borrar deudas a un
-- STAFF). Solo informa el anticipo reportado y el saldo vigente en el evento.
do $$
declare
  v_def text;
  v_a1 constant text := '''monto_sena'', coalesce(v_reserva.monto_sena, 0),';
begin
  v_def := pg_get_functiondef('public.completar_reserva_sin_pos(uuid)'::regprocedure);
  if position('_anticipo_descontado_reserva' in v_def) > 0 then return; end if;
  if position(v_a1 in v_def) = 0 then raise exception 'ANCLA_NO_ENCONTRADA completar_reserva_sin_pos'; end if;
  execute replace(v_def, v_a1, v_a1 || E' ''anticipo_descontado'', public._anticipo_descontado_reserva(p_reserva_id), ''saldo_pendiente_vigente'', coalesce((select saldo_actual from public.cliente_saldo_pendiente where negocio_id = v_reserva.negocio_id and cliente_id = v_reserva.cliente_id), 0),');
end $$;

revoke all on function public.completar_venta_pos(uuid, jsonb, text, numeric, text, integer) from public, anon, authenticated;
grant execute on function public.completar_venta_pos(uuid, jsonb, text, numeric, text, integer) to authenticated;
revoke all on function public.completar_reserva_sin_pos(uuid) from public, anon, authenticated;
grant execute on function public.completar_reserva_sin_pos(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 9. El anticipo también se calcula cuando el negocio tiene pagos directos activos
-- ════════════════════════════════════════════════════════════════════════
-- Antes (119) sin Mercado Pago conectado el anticipo era 0 y la reserva nacía CONFIRMADA: no existía el estado
-- PENDIENTE_PAGO que usa el pago directo. El dinero sigue yendo SIEMPRE a la cuenta del negocio, nunca a StylerNow.
create or replace function public.negocio_acepta_anticipo(p_negocio_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.negocio_cobra_en_linea(p_negocio_id)
      or exists (select 1 from public.negocio_medio_pago_directo m where m.negocio_id = p_negocio_id and m.activo);
$$;
revoke all on function public.negocio_acepta_anticipo(uuid) from public, anon, authenticated;
-- La pantalla de reserva (anon/authenticated) solo necesita saber si hay anticipo posible; no expone cuentas.
grant execute on function public.negocio_acepta_anticipo(uuid) to anon, authenticated;

do $$
declare
  r record; v_def text;
  v_viejo constant text := 'public.negocio_cobra_en_linea(p_negocio_id)';
  v_nuevo constant text := 'public.negocio_acepta_anticipo(p_negocio_id)';
begin
  for r in select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
             from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('calcular_sena', 'calcular_sena_servicios')
  loop
    v_def := pg_get_functiondef(r.oid);
    if position(v_nuevo in v_def) > 0 then continue; end if;                       -- ya migrada
    if position(v_viejo in v_def) = 0 then raise exception 'ANCLA_NO_ENCONTRADA %', r.proname; end if;
    execute replace(v_def, v_viejo, v_nuevo);
  end loop;
end $$;
