-- 210 — Evidencia de la aceptación de la «Información importante» del pago directo.
-- Hasta ahora solo quedaba evidencia de que el cliente aceptó la política de cancelación (aceptacion_politica_reserva). Cuando el anticipo se
-- transfiere directo a la cuenta del negocio, el cliente también debe aceptar —con un chulo independiente— que el dinero va al comercio, que
-- StylerNow no lo custodia ni lo reembolsa y que cualquier devolución se la gestiona el negocio. Esta migración guarda esa aceptación
-- (texto exacto, a qué cuenta iba el dinero, montos, versión) y la copia al repositorio de evidencias legales.
--
-- Orden de despliegue seguro: la exigencia en el momento de registrar el pago queda APAGADA por defecto
-- (configuracion_plataforma.exigir_info_pago_directo = false) para no romper el código ya desplegado. Se enciende cuando el código nuevo está en
-- producción: update public.configuracion_plataforma set exigir_info_pago_directo = true;

alter table public.configuracion_plataforma add column if not exists exigir_info_pago_directo boolean not null default false;

-- Texto que el cliente ve y acepta. Única fuente de verdad en la base (la pantalla muestra el mismo texto; ver src/lib/pagos-directos/aviso.ts).
create or replace function public.texto_info_pago_directo()
returns text language sql immutable set search_path = public as $$
  select 'El pago se realiza directamente a la cuenta del comercio. StylerNow solo facilita la reserva y no custodia ni valida transferencias. '
      || 'Este anticipo fue transferido directamente a la cuenta del comercio. StylerNow no custodia ni reembolsa ese dinero; '
      || 'cualquier devolución o acuerdo debes gestionarlo directamente con la barbería.';
$$;
revoke all on function public.texto_info_pago_directo() from public, anon, authenticated;
grant execute on function public.texto_info_pago_directo() to authenticated, service_role;

create table if not exists public.aceptacion_info_pago_directo (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null unique references public.reserva(id),
  cliente_id uuid not null references public.perfil(id),
  negocio_id uuid not null references public.negocio(id),
  texto_aceptado text not null,
  version_texto text not null,
  destino jsonb not null,                 -- a qué cuenta se le indicó transferir (llave Bre-B, Nequi, Daviplata, link, si había QR)
  monto_sena numeric(12,2) not null,
  monto_total numeric(12,2) not null,
  hora_inicio_reserva timestamptz not null,
  aceptado_at timestamptz not null default now()
);
create index if not exists aceptacion_info_pago_directo_negocio_idx on public.aceptacion_info_pago_directo (negocio_id, aceptado_at);
create index if not exists aceptacion_info_pago_directo_cliente_idx on public.aceptacion_info_pago_directo (cliente_id);

alter table public.aceptacion_info_pago_directo enable row level security;
drop policy if exists aceptacion_info_pago_directo_select on public.aceptacion_info_pago_directo;
create policy aceptacion_info_pago_directo_select on public.aceptacion_info_pago_directo for select to authenticated
  using (cliente_id = (select auth.uid()) or public.is_barberia_de(negocio_id) or public.is_supersu());
revoke all on public.aceptacion_info_pago_directo from public, anon, authenticated;
grant select on public.aceptacion_info_pago_directo to authenticated;

-- Inmutable: ni el cliente ni el negocio pueden editar o borrar la evidencia.
drop trigger if exists trg_aceptacion_info_pago_inmutable on public.aceptacion_info_pago_directo;
create trigger trg_aceptacion_info_pago_inmutable before delete or update on public.aceptacion_info_pago_directo
  for each row execute function public.trg_fila_inmutable();

-- Copia al repositorio de evidencias legales (mismo patrón que la política de cancelación).
create or replace function public.trg_ev_info_pago_directo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public._registrar_evidencia(
    new.cliente_id, new.negocio_id, null, 'CONTRACTUAL', 'INFORMACION_PAGO_DIRECTO',
    'Información importante del pago directo al comercio: sin custodia ni reembolso de StylerNow',
    'ACEPTA', new.texto_aceptado, new.version_texto, null, 'pago', 'reserva', new.reserva_id, null,
    'aceptacion_info_pago_directo', new.id::text, new.aceptado_at, false, 'CLIENTE');
  return new;
end $$;
revoke all on function public.trg_ev_info_pago_directo() from public, anon, authenticated;
drop trigger if exists trg_ev_info_pago_directo on public.aceptacion_info_pago_directo;
create trigger trg_ev_info_pago_directo after insert on public.aceptacion_info_pago_directo
  for each row execute function public.trg_ev_info_pago_directo();

-- Registro de la aceptación (idempotente: la primera es la que vale). Solo el cliente dueño de la reserva y solo si el negocio tiene pago directo activo.
create or replace function public.aceptar_informacion_pago_directo(p_reserva_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  r public.reserva;
  m public.negocio_medio_pago_directo;
  v_id uuid;
  v_texto text := public.texto_info_pago_directo();
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;

  select * into r from public.reserva where id = p_reserva_id for update;
  if not found or r.cliente_id is distinct from auth.uid() then raise exception 'RESERVA_NO_ENCONTRADA'; end if;

  select id into v_id from public.aceptacion_info_pago_directo where reserva_id = p_reserva_id;
  if found then return v_id; end if;

  -- Misma ventana que registrar_pago_directo_reserva: pendiente de pago, o con bloqueo vencido que aún puede recuperarse.
  if not (r.estado = 'PENDIENTE_PAGO' or (r.estado = 'CANCELADA' and r.cancelado_motivo = 'PAGO_EXPIRADO')) then
    raise exception 'RESERVA_NO_PAGABLE';
  end if;

  select * into m from public.negocio_medio_pago_directo where negocio_id = r.negocio_id;
  if not found or not m.activo then raise exception 'PAGO_DIRECTO_NO_DISPONIBLE'; end if;

  insert into public.aceptacion_info_pago_directo
    (reserva_id, cliente_id, negocio_id, texto_aceptado, version_texto, destino, monto_sena, monto_total, hora_inicio_reserva)
  values
    (p_reserva_id, auth.uid(), r.negocio_id, v_texto, md5(v_texto),
     jsonb_build_object('llave_breb', m.llave_breb, 'nequi', m.nequi, 'daviplata', m.daviplata, 'link_pago', m.link_pago,
                        'tiene_qr', m.qr_path is not null),
     coalesce(r.monto_sena, 0), coalesce(r.monto_total, 0), r.hora_inicio)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.aceptar_informacion_pago_directo(uuid) from public, anon, authenticated;
grant execute on function public.aceptar_informacion_pago_directo(uuid) to authenticated;

-- Sin esta aceptación no nace un pago directo (cuando la exigencia está encendida). Refuerza en la base lo que la pantalla pide.
create or replace function public.trg_pago_reserva_exige_info_directa()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.metodo = 'TRANSFERENCIA_DIRECTA'
     and coalesce((select exigir_info_pago_directo from public.configuracion_plataforma limit 1), false)
     and not exists (select 1 from public.aceptacion_info_pago_directo a where a.reserva_id = new.reserva_id) then
    raise exception 'INFO_PAGO_DIRECTO_NO_ACEPTADA';
  end if;
  return new;
end $$;
revoke all on function public.trg_pago_reserva_exige_info_directa() from public, anon, authenticated;
drop trigger if exists trg_pago_reserva_exige_info_directa on public.pago_reserva;
create trigger trg_pago_reserva_exige_info_directa before insert on public.pago_reserva
  for each row execute function public.trg_pago_reserva_exige_info_directa();
