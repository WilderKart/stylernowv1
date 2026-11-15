-- 138 · crear_grupo_familiar: autorización por negocio y límites del descuento (hallazgo F0-05, plan de cierre Fase 1A).
-- Antes: cualquier usuario autenticado podía crear un grupo familiar amarrado a CUALQUIER negocio (incluso inexistente solo
-- fallaba por la llave foránea) y fijar el descuento que quisiera (negativo, >100 %). Hoy el descuento no entra en ningún
-- cálculo de precio, pero la fila queda visible en el panel de ese negocio y quedaría lista para usarse.
-- Ahora (sin cambiar la firma, así que NO crea una sobrecarga nueva):
--   · negocio_id ≠ NULL exige relación autorizada: dueño, personal del negocio, cliente con al menos una reserva en él, o Super Admin;
--   · un descuento > 0 solo lo fija el dueño de ese negocio o el Super Admin (decisión de mínimo privilegio; la regla comercial
--     de quién puede ofrecer descuentos queda pendiente de confirmación del dueño del producto);
--   · el descuento es un porcentaje 0–100 y no admite NULL;
--   · restricción CHECK en la tabla (NOT VALID: protege lo nuevo sin validar filas antiguas) para que tampoco se pueda por otra vía.
-- Aditiva e idempotente.

create or replace function public.crear_grupo_familiar(
  p_nombre text default 'Mi familia',
  p_negocio_id uuid default null,
  p_limite_miembros int default 4,
  p_descuento_familiar_pct numeric default 0
) returns public.familia_grupo
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_super boolean;
  v_grupo public.familia_grupo;
begin
  if v_uid is null then raise exception 'NO_AUTENTICADO'; end if;
  v_super := coalesce(public.is_supersu(), false);

  if p_descuento_familiar_pct is null or p_descuento_familiar_pct < 0 or p_descuento_familiar_pct > 100 then
    raise exception 'DESCUENTO_INVALIDO';
  end if;

  if p_negocio_id is not null then
    if not v_super
       and not coalesce(public.tiene_acceso_interno(p_negocio_id), false)
       and not exists (select 1 from public.reserva r where r.cliente_id = v_uid and r.negocio_id = p_negocio_id) then
      raise exception 'NO_AUTORIZADO';
    end if;
    if not exists (select 1 from public.negocio n where n.id = p_negocio_id) then
      raise exception 'NEGOCIO_NO_ENCONTRADO';
    end if;
  end if;

  if p_descuento_familiar_pct > 0
     and not (v_super or (p_negocio_id is not null and coalesce(public.is_barberia_de(p_negocio_id), false))) then
    raise exception 'NO_AUTORIZADO';
  end if;

  if exists (select 1 from public.familia_miembro where cliente_id = v_uid) then raise exception 'YA_PERTENECE_A_UNA_FAMILIA'; end if;

  insert into public.familia_grupo (titular_cliente_id, negocio_id, nombre, limite_miembros, descuento_familiar_pct)
  values (v_uid, p_negocio_id, p_nombre, greatest(p_limite_miembros, 1), p_descuento_familiar_pct)
  returning * into v_grupo;

  insert into public.familia_miembro (familia_id, cliente_id, parentesco) values (v_grupo.id, v_uid, 'Titular');

  return v_grupo;
end;
$$;

-- Permisos explícitos sobre los TRES roles (public/anon/authenticated son independientes).
revoke all on function public.crear_grupo_familiar(text, uuid, int, numeric) from public, anon;
grant execute on function public.crear_grupo_familiar(text, uuid, int, numeric) to authenticated;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'familia_grupo_descuento_rango_chk' and conrelid = 'public.familia_grupo'::regclass) then
    alter table public.familia_grupo
      add constraint familia_grupo_descuento_rango_chk check (descuento_familiar_pct between 0 and 100) not valid;
  end if;
end $$;
