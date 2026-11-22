-- 156: los límites de cada plan se hacen cumplir en el servidor (auditoría de planes, 2026-11-17).
--
-- Hallazgos que corrige:
--  1. Solo Essential (antes Raven) tenía tope de Staff (staff_tope_absoluto = 2, y por herencia de 004). Studio, Prestige y
--     Signature no tenían ninguno: se podía invitar sin límite aunque el plan "incluye" 5, 15 o 50 profesionales.
--     docs/PLANES_CORREGIDOS_v3.md §1 y §3 dice que Essential incluye 1 y que para más se "sube de plan".
--  2. promover_guardian ignoraba plan.guardian_disponible (false en Essential).
--  3. crear_invitacion_staff aceptaba una comisión en planes sin la función comisiones_turnos (Essential).
--
-- DECISIÓN COMERCIAL PENDIENTE (no se inventa): el documento v3 vende "barbero adicional" (Studio 20.000, Prestige 15.000)
-- pero NINGÚN código cobra ese extra ni permite comprarlo. Mientras no exista el cobro, el tope = lo incluido: es la única
-- regla coherente sin regalar capacidad. Cuando se construya el add-on, basta subir staff_tope_absoluto o ponerlo en null.
-- Signature incluye "hasta 50 en la base; más se cotiza": se topa en 50 hasta que ventas cotice.
--
-- No se tocan precios ni cuotas. No se quita nada a quien ya excede el tope (solo se impide agregar más).

update public.plan set staff_tope_absoluto = staff_incluido, updated_at = now()
where codigo in ('ESSENTIAL', 'STUDIO', 'PRESTIGE', 'SIGNATURE') and staff_incluido is not null;

-- ── crear_invitacion_staff: comisiones solo si el plan las incluye ──────────────────────────
do $$
declare v_def text; v_nuevo text;
  v_ancla constant text := 'insert into public.invitacion_staff (negocio_id, email, sede_id, comision_pct, invitado_por)';
begin
  v_def := pg_get_functiondef('public.crear_invitacion_staff(uuid,text,uuid,numeric)'::regprocedure);
  if position(v_ancla in v_def) = 0 then
    raise exception 'ANCLA_NO_ENCONTRADA crear_invitacion_staff';
  end if;
  if position('PLAN_NO_INCLUYE_COMISIONES' in v_def) = 0 then
    v_nuevo := replace(v_def, v_ancla,
      E'if p_comision_pct is not null and not public.negocio_tiene_funcion(p_negocio_id, ''comisiones_turnos'') then\n'
      || E'    raise exception ''PLAN_NO_INCLUYE_COMISIONES'';\n  end if;\n\n  ' || v_ancla);
    execute v_nuevo;
  end if;
end $$;

-- ── promover_guardian: solo planes con guardian_disponible ──────────────────────────────────
do $$
declare v_def text; v_nuevo text;
  v_ancla constant text := E'  if v_vinculo.es_guardian then\n    raise exception ''YA_ES_GUARDIAN'';';
begin
  v_def := pg_get_functiondef('public.promover_guardian(uuid)'::regprocedure);
  if position(v_ancla in v_def) = 0 then
    raise exception 'ANCLA_NO_ENCONTRADA promover_guardian';
  end if;
  if position('PLAN_NO_INCLUYE_GUARDIAN' in v_def) = 0 then
    v_nuevo := replace(v_def, v_ancla,
      E'  if not coalesce((select p.guardian_disponible from public.plan p\n'
      || E'                   join public.negocio n on n.plan_codigo = p.codigo where n.id = v_vinculo.negocio_id), false) then\n'
      || E'    raise exception ''PLAN_NO_INCLUYE_GUARDIAN'';\n  end if;\n' || v_ancla);
    execute v_nuevo;
  end if;
end $$;

-- ── Lectura de cupos para la interfaz (mensajes de "actualiza tu plan") ─────────────────────
-- Una sola fuente de verdad: la misma cuenta que usa crear_invitacion_staff.
drop function if exists public.cupo_plan_negocio(uuid);
create function public.cupo_plan_negocio(p_negocio_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_plan public.plan;
  v_siguiente public.plan;
  v_staff int;
  v_sedes int;
begin
  if not (public.is_barberia_de(p_negocio_id) or public.is_staff_de(p_negocio_id) or public.is_supersu()) then
    raise exception 'NO_AUTORIZADO';
  end if;

  select p.* into v_plan from public.plan p
  join public.negocio n on n.plan_codigo = p.codigo where n.id = p_negocio_id;
  if not found then
    return null;
  end if;

  select
    (select count(*) from public.vinculo_staff_negocio
      where negocio_id = p_negocio_id and estado in ('ACTIVO', 'SUSPENDIDO', 'INVITADO'))
    + (select count(*) from public.invitacion_staff where negocio_id = p_negocio_id and estado = 'PENDIENTE')
  into v_staff;
  select count(*) into v_sedes from public.sede where negocio_id = p_negocio_id and not cerrada_permanente;

  -- Siguiente plan de la escalera (por capacidad de Staff); Signature es el último.
  select s.* into v_siguiente from public.plan s
  where s.codigo <> v_plan.codigo and coalesce(s.staff_incluido, 0) > coalesce(v_plan.staff_incluido, 0)
  order by s.staff_incluido asc limit 1;

  return jsonb_build_object(
    'plan_codigo', v_plan.codigo, 'plan_nombre', v_plan.nombre,
    'staff_tope', v_plan.staff_tope_absoluto, 'staff_incluido', v_plan.staff_incluido, 'staff_usado', v_staff,
    'sedes_tope', v_plan.limite_sedes, 'sedes_usadas', v_sedes,
    'guardian_disponible', v_plan.guardian_disponible,
    'comisiones', public.negocio_tiene_funcion(p_negocio_id, 'comisiones_turnos'),
    'siguiente_codigo', v_siguiente.codigo, 'siguiente_nombre', v_siguiente.nombre,
    'siguiente_staff', v_siguiente.staff_incluido
  );
end;
$$;

revoke all on function public.cupo_plan_negocio(uuid) from public, anon, authenticated;
grant execute on function public.cupo_plan_negocio(uuid) to authenticated;
