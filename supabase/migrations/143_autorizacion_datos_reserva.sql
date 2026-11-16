-- 143 — Autorización de tratamiento de datos POR RESERVA (texto aprobado por el propietario el 2026-11-16).
--
-- Texto (se reconstruye aquí, en el servidor, con el nombre real del negocio):
--   «Autorizo a StylerNow y a {negocio} a usar mi nombre, celular y correo solo para gestionar esta
--    reserva y avisarme sobre ella, según la Política de Tratamiento de Datos.»
--
-- Zero trust:
--   · La evidencia se guarda en la MISMA transacción que crea la reserva (`crear_reserva_autorizada`):
--     no puede existir una reserva sin su autorización ni una autorización sin reserva.
--   · Se cierra la ejecución directa de `crear_reserva` (public, anon y authenticated): ya no se puede
--     reservar por /rest/v1/rpc saltándose la casilla. Solo la llama la función envolvente.
--   · El cliente es siempre auth.uid() (lo fija `crear_reserva`); el texto y el negocio salen de la base,
--     nunca del navegador.
--   · Filas inmutables (trg_fila_inmutable, migración 116); el cliente, el negocio dueño y el Super Admin
--     pueden leerlas; nadie puede escribirlas directamente.

create table if not exists public.autorizacion_datos_reserva (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null unique references public.reserva(id),
  cliente_id uuid not null references public.perfil(id),
  negocio_id uuid not null references public.negocio(id),
  texto_aceptado text not null,
  version_texto text not null,
  politica_datos_id uuid references public.texto_legal(id),
  aceptado_at timestamptz not null default now()
);

create index if not exists autorizacion_datos_reserva_negocio_idx on public.autorizacion_datos_reserva (negocio_id, aceptado_at);
create index if not exists autorizacion_datos_reserva_cliente_idx on public.autorizacion_datos_reserva (cliente_id);
create index if not exists autorizacion_datos_reserva_politica_idx on public.autorizacion_datos_reserva (politica_datos_id);

alter table public.autorizacion_datos_reserva enable row level security;

drop policy if exists autorizacion_datos_reserva_select on public.autorizacion_datos_reserva;
create policy autorizacion_datos_reserva_select on public.autorizacion_datos_reserva for select to authenticated
  using (cliente_id = (select auth.uid()) or public.is_barberia_de(negocio_id) or public.is_supersu());

revoke all on public.autorizacion_datos_reserva from public, anon, authenticated;
grant select on public.autorizacion_datos_reserva to authenticated;
-- service_role (tareas del servidor): puede leer y registrar; editar/borrar lo impide el trigger de inmutabilidad.
grant select, insert, update, delete on public.autorizacion_datos_reserva to service_role;

drop trigger if exists trg_autorizacion_datos_reserva_inmutable on public.autorizacion_datos_reserva;
create trigger trg_autorizacion_datos_reserva_inmutable before update or delete on public.autorizacion_datos_reserva
  for each row execute function public.trg_fila_inmutable();

create or replace function public.texto_autorizacion_datos_reserva(p_negocio text)
returns text language sql immutable set search_path = public as $$
  select format(
    'Autorizo a StylerNow y a %s a usar mi nombre, celular y correo solo para gestionar esta reserva '
    'y avisarme sobre ella, según la Política de Tratamiento de Datos.', p_negocio);
$$;
revoke all on function public.texto_autorizacion_datos_reserva(text) from public, anon, authenticated;

create or replace function public.crear_reserva_autorizada(
  p_sede_id uuid,
  p_servicio_ids uuid[],
  p_hora_inicio timestamptz,
  p_staff_id uuid default null,
  p_idempotency_key text default null,
  p_autoriza_datos boolean default false
)
returns public.reserva
language plpgsql security definer set search_path = public as $fn$
declare
  v_reserva public.reserva;
  v_negocio text;
  v_politica uuid;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if coalesce(p_autoriza_datos, false) is not true then raise exception 'AUTORIZACION_DATOS_REQUERIDA'; end if;

  -- Toda la lógica de reserva (disponibilidad, plan, idempotencia, anticipo) sigue en crear_reserva.
  v_reserva := public.crear_reserva(p_sede_id, p_servicio_ids, p_hora_inicio, p_staff_id, p_idempotency_key);

  -- Defensa en profundidad: la reserva devuelta debe ser de quien llama.
  if v_reserva.cliente_id is distinct from auth.uid() then raise exception 'RESERVA_NO_ENCONTRADA'; end if;

  select n.nombre into v_negocio from public.negocio n where n.id = v_reserva.negocio_id;
  select t.id into v_politica from public.texto_legal t
   where t.tipo = 'POLITICA_DATOS' and t.publicado_at <= now()
   order by t.version desc limit 1;

  -- Un reintento idempotente devuelve la misma reserva: su autorización ya existe y no se duplica.
  insert into public.autorizacion_datos_reserva (reserva_id, cliente_id, negocio_id, texto_aceptado, version_texto, politica_datos_id)
  values (v_reserva.id, v_reserva.cliente_id, v_reserva.negocio_id,
          public.texto_autorizacion_datos_reserva(coalesce(v_negocio, 'el negocio')), 'v1-2026-11-16', v_politica)
  on conflict (reserva_id) do nothing;

  return v_reserva;
end;
$fn$;

revoke all on function public.crear_reserva_autorizada(uuid, uuid[], timestamptz, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.crear_reserva_autorizada(uuid, uuid[], timestamptz, uuid, text, boolean) to authenticated;

