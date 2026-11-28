-- 210 · El barbero hereda el horario de la sede donde trabaja (invitación, traslado y cambios de la sede).
--
-- Problema: la disponibilidad de un barbero se guarda por (barbero, sede) en `disponibilidad`. Al trasladarlo o invitarlo a una sede
-- nueva no tenía ninguna fila allí, así que no ofrecía ni un solo horario hasta que alguien le definía el horario a mano; y cuando la
-- sede cambiaba su horario, nada se enteraba.
--
-- Regla nueva (en la base, no en la pantalla):
--   · Si el barbero NO tiene horario propio en su sede, sigue el horario de la sede: una franja por día (de la primera apertura a
--     la última cierre; los cortes del día los respeta el cruce con el horario de la sede al reservar). Esas filas se marcan
--     `heredado = true`.
--   · Cuando el barbero (o la barbería) define un horario propio (_aplicar_semana), esas filas se reemplazan por las suyas
--     (`heredado = false`) y deja de heredar. Rige el cruce de siempre: horario propio ∩ horario de la sede.
--   · Si la sede cambia su horario (o se crea una sede nueva), los barberos que heredan se actualizan solos; los que tienen
--     horario propio no se tocan.
--   · Al trasladar a un barbero, las filas heredadas de la sede anterior se borran y hereda las de la nueva. Su horario propio en la
--     sede anterior se conserva por si vuelve.
--   · Solo hereda quien está ACTIVO y presta servicios. Los barberos que hoy no tienen ningún horario quedan siguiendo el de su sede.
--
-- Nota: si alguien deja un horario propio completamente vacío (sin ningún día), cuenta como «sin horario propio» y vuelve a heredar.
-- Para bloquear días concretos están las ausencias.
-- No toca slots_disponibles ni ninguna otra función de reservas: siguen leyendo `disponibilidad` como siempre.

alter table public.disponibilidad add column if not exists heredado boolean not null default false;
comment on column public.disponibilidad.heredado is
  'true = fila generada a partir del horario de la sede (el barbero no tiene horario propio); se regenera sola cuando la sede cambia.';

-- Copia el horario de la sede a un barbero que no tiene horario propio en ella. Idempotente.
create or replace function public._heredar_horario_sede(p_vinculo uuid, p_sede uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_h jsonb;
  v_claves text[] := array['dom','lun','mar','mie','jue','vie','sab'];
  v_ini time;
  v_fin time;
  i int;
begin
  -- Con horario propio en esa sede no se hereda nada.
  if exists (select 1 from public.disponibilidad where vinculo_id = p_vinculo and sede_id = p_sede and not heredado) then
    return;
  end if;

  select s.horario_base into v_h from public.sede s where s.id = p_sede;
  if not found then return; end if;

  delete from public.disponibilidad where vinculo_id = p_vinculo and sede_id = p_sede and heredado;

  v_h := coalesce(v_h, '{}'::jsonb);
  for i in 0 .. 6 loop
    if v_h = '{}'::jsonb then
      -- Misma lectura que slots_disponibles: sin horario cargado, la sede está abierta todo el día.
      v_ini := '00:00'::time;
      v_fin := '23:59:59'::time;
    else
      select min((e ->> 0)::time), max((e ->> 1)::time)
        into v_ini, v_fin
        from jsonb_array_elements(coalesce(v_h -> v_claves[i + 1], '[]'::jsonb)) e;
    end if;
    if v_ini is not null and v_fin is not null and v_fin > v_ini then
      insert into public.disponibilidad (vinculo_id, sede_id, dia_semana, hora_inicio, hora_fin, heredado)
      values (p_vinculo, p_sede, i, v_ini, v_fin, true);
    end if;
  end loop;
end $$;
revoke all on function public._heredar_horario_sede(uuid, uuid) from public, anon, authenticated;

-- Aplica la herencia a todas las sedes donde trabaja el barbero (su sede activa, o todas si no tiene una fija).
create or replace function public._heredar_horarios_de_vinculo(p_vinculo public.vinculo_staff_negocio)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_sedes uuid[]; s uuid;
begin
  if p_vinculo.estado <> 'ACTIVO' or not p_vinculo.presta_servicios then return; end if;
  select coalesce(array_agg(id), '{}') into v_sedes
    from public.sede
   where negocio_id = p_vinculo.negocio_id and (p_vinculo.sede_activa_id is null or id = p_vinculo.sede_activa_id);
  -- Las filas heredadas de una sede donde ya no trabaja se quitan; el horario propio se conserva.
  delete from public.disponibilidad where vinculo_id = p_vinculo.id and heredado and sede_id <> all (v_sedes);
  foreach s in array v_sedes loop
    perform public._heredar_horario_sede(p_vinculo.id, s);
  end loop;
end $$;
revoke all on function public._heredar_horarios_de_vinculo(public.vinculo_staff_negocio) from public, anon, authenticated;

create or replace function public._trg_vinculo_heredar_horario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._heredar_horarios_de_vinculo(new);
  return new;
end $$;
revoke all on function public._trg_vinculo_heredar_horario() from public, anon, authenticated;

drop trigger if exists trg_vinculo_heredar_horario on public.vinculo_staff_negocio;
create trigger trg_vinculo_heredar_horario
  after insert or update of sede_activa_id, estado, presta_servicios on public.vinculo_staff_negocio
  for each row execute function public._trg_vinculo_heredar_horario();

create or replace function public._trg_sede_heredar_horario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._heredar_horario_sede(v.id, new.id)
    from public.vinculo_staff_negocio v
   where v.negocio_id = new.negocio_id
     and v.estado = 'ACTIVO'
     and v.presta_servicios
     and (v.sede_activa_id is null or v.sede_activa_id = new.id);
  return new;
end $$;
revoke all on function public._trg_sede_heredar_horario() from public, anon, authenticated;

drop trigger if exists trg_sede_heredar_horario on public.sede;
create trigger trg_sede_heredar_horario
  after insert or update of horario_base on public.sede
  for each row execute function public._trg_sede_heredar_horario();

-- Los barberos que hoy no tienen horario propio pasan a seguir el de su sede.
do $$
declare v public.vinculo_staff_negocio;
begin
  for v in select * from public.vinculo_staff_negocio where estado = 'ACTIVO' and presta_servicios loop
    perform public._heredar_horarios_de_vinculo(v);
  end loop;
end $$;
