-- 139 · Endurecimiento Fase 1B (F1A-04 a F1A-07). ADITIVA e idempotente. NO borra datos.
-- Reversión: ver supabase/migrations/139_endurecimiento_fase1b_REVERSION.sql.txt (no es migración; se aplica a mano si hiciera falta).
--
-- F1A-04  referido_config y vip_nivel dejan de ser legibles por cualquiera (USING true):
--         · referido_config: configuración INTERNA del negocio (monto, límite, vigencia) → solo personal interno del negocio y SuperSU.
--           Ningún flujo de cliente la lee directamente (el cliente usa obtener_mi_codigo_referido / mis_referidos, que son RPC).
--         · vip_nivel: interna + el cliente ve SOLO el nivel al que pertenece (la página del negocio muestra «tu nivel VIP»).
--         Ya no se exponen niveles ni configuración de negocios inactivos a anónimos.
-- F1A-05  ai_accion_costo: costo_proveedor_estimado y margen_pct (márgenes internos de la plataforma) solo para SuperSU.
--         Se quitan los privilegios de tabla a anon/authenticated y se concede SELECT solo sobre columnas no sensibles.
--         SuperSU lee todas las columnas por la función ai_acciones_costo_admin() (guardia is_supersu()).
-- F1A-06  agregar_miembro_familiar: permite sumar a cualquier perfil conocido por su id SIN su consentimiento. La app no la usa.
--         Se revoca la ejecución a anon/authenticated hasta que se apruebe el flujo con aceptación del invitado (diseño en el informe).
-- F1A-07  p_limite_miembros: validación en servidor y CHECK en base. Techo técnico PROVISIONAL (20) pendiente de decisión comercial;
--         quien no es dueño del negocio ni SuperSU solo puede crear el grupo con el límite por defecto (4), que es lo que la app envía hoy.
-- Directriz de descuentos: familia_grupo.descuento_familiar_pct NO se aplica a ningún precio y no es una promoción comercial.
--         Se deja de permitir escribirlo (solo 0). La columna y sus datos se conservan; qué hacer con ella queda para decisión del propietario.

-- ───────────── F1A-04 ─────────────
drop policy if exists referido_config_select on public.referido_config;
create policy referido_config_select on public.referido_config for select
  using (coalesce(public.tiene_acceso_interno(negocio_id), false) or coalesce(public.is_supersu(), false));

drop policy if exists vip_nivel_select on public.vip_nivel;
create policy vip_nivel_select on public.vip_nivel for select
  using (
    coalesce(public.tiene_acceso_interno(negocio_id), false)
    or coalesce(public.is_supersu(), false)
    or exists (select 1 from public.vip_miembro m where m.nivel_id = vip_nivel.id and m.cliente_id = (select auth.uid()))
  );

-- ───────────── F1A-05 ─────────────
revoke all on public.ai_accion_costo from public, anon, authenticated;
grant select (id, accion, categoria, nivel_ia, costo_creditos, activo, created_at, updated_at) on public.ai_accion_costo to authenticated;

create or replace function public.ai_acciones_costo_admin()
returns setof public.ai_accion_costo
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not coalesce(public.is_supersu(), false) then raise exception 'NO_AUTORIZADO'; end if;
  return query select * from public.ai_accion_costo order by categoria, accion;
end $$;
revoke all on function public.ai_acciones_costo_admin() from public, anon;
grant execute on function public.ai_acciones_costo_admin() to authenticated;

-- ───────────── F1A-06 ─────────────
revoke all on function public.agregar_miembro_familiar(uuid, uuid, text) from public, anon, authenticated;

-- ───────────── F1A-07 + directriz de descuentos ─────────────
create or replace function public.crear_grupo_familiar(
  p_nombre text default 'Mi familia', p_negocio_id uuid default null, p_limite_miembros int default 4, p_descuento_familiar_pct numeric default 0
) returns public.familia_grupo
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_super boolean;
  v_dueno boolean := false;
  v_grupo public.familia_grupo;
  c_limite_defecto constant int := 4;
  c_limite_techo constant int := 20; -- PROVISIONAL: techo técnico, la política comercial la define el propietario
begin
  if v_uid is null then raise exception 'NO_AUTENTICADO'; end if;
  v_super := coalesce(public.is_supersu(), false);

  -- Los grupos familiares NO son un mecanismo de descuento (directriz del propietario): solo se admite 0.
  if p_descuento_familiar_pct is distinct from 0 then raise exception 'DESCUENTO_FAMILIAR_NO_SOPORTADO'; end if;

  if p_limite_miembros is null or p_limite_miembros < 1 or p_limite_miembros > c_limite_techo then raise exception 'LIMITE_MIEMBROS_INVALIDO'; end if;

  if p_negocio_id is not null then
    if not exists (select 1 from public.negocio n where n.id = p_negocio_id) then raise exception 'NEGOCIO_NO_ENCONTRADO'; end if;
    v_dueno := coalesce(public.is_barberia_de(p_negocio_id), false);
    if not v_super and not v_dueno
       and not coalesce(public.tiene_acceso_interno(p_negocio_id), false)
       and not exists (select 1 from public.reserva r where r.cliente_id = v_uid and r.negocio_id = p_negocio_id) then
      raise exception 'NO_AUTORIZADO';
    end if;
  end if;

  -- Cambiar el límite por defecto: solo el dueño del negocio o SuperSU.
  if p_limite_miembros <> c_limite_defecto and not (v_super or v_dueno) then raise exception 'NO_AUTORIZADO'; end if;

  if exists (select 1 from public.familia_miembro where cliente_id = v_uid) then raise exception 'YA_PERTENECE_A_UNA_FAMILIA'; end if;

  insert into public.familia_grupo (titular_cliente_id, negocio_id, nombre, limite_miembros, descuento_familiar_pct)
  values (v_uid, p_negocio_id, left(coalesce(nullif(btrim(p_nombre), ''), 'Mi familia'), 80), p_limite_miembros, 0)
  returning * into v_grupo;

  insert into public.familia_miembro (familia_id, cliente_id, parentesco) values (v_grupo.id, v_uid, 'Titular');
  return v_grupo;
end $$;
revoke all on function public.crear_grupo_familiar(text, uuid, int, numeric) from public, anon;
grant execute on function public.crear_grupo_familiar(text, uuid, int, numeric) to authenticated;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'familia_grupo_limite_miembros_chk' and conrelid = 'public.familia_grupo'::regclass) then
    alter table public.familia_grupo add constraint familia_grupo_limite_miembros_chk check (limite_miembros between 1 and 20) not valid;
  end if;
end $$;
