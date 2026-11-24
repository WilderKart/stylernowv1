-- 192 · (P1-9) Matriz de planes v3 aplicada a Reportes (docs/PLANES_CORREGIDOS_v3.md §2.6).
--   Essential = del día · Studio = semana y mes · Prestige = avanzados · Signature = consolidados por sede.
-- Se agregan las claves a plan_caracteristica y una función que devuelve las tres banderas del plan vigente del negocio
-- (la suscripción manda; si no hay, el plan del negocio). La aplican las Server Actions (servidor) y la UI las refleja.
-- Se llama desde la app autenticada: solo la Barbería dueña, un Guardian de una sede del negocio o SuperSU.

with matriz(clave, essential, studio, prestige, signature) as (values
  ('reportes_periodo',             false, true,  true,  true),
  ('reportes_avanzados',           false, false, true,  true),
  ('reportes_consolidados_sede',   false, false, false, true)
),
filas as (
  select 'ESSENTIAL'::public.plan_codigo as plan_codigo, clave, essential as h from matriz
  union all select 'STUDIO',    clave, studio    from matriz
  union all select 'PRESTIGE',  clave, prestige  from matriz
  union all select 'SIGNATURE', clave, signature from matriz
)
insert into public.plan_caracteristica (plan_codigo, clave, habilitado, valor)
select plan_codigo, clave, h, null from filas
on conflict (plan_codigo, clave) do update set habilitado = excluded.habilitado, valor = excluded.valor, updated_at = now();

create or replace function public.negocio_reportes_funciones(p_negocio_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_plan public.plan_codigo;
begin
  if not (coalesce(public.is_barberia_de(p_negocio_id), false)
          or coalesce(public.is_supersu(), false)
          or exists (select 1 from public.sede s where s.negocio_id = p_negocio_id and coalesce(public.is_guardian_de_sede(s.id), false))) then
    raise exception 'NO_AUTORIZADO';
  end if;
  v_plan := coalesce((select s.plan_codigo from public.suscripcion s where s.negocio_id = p_negocio_id),
                     (select n.plan_codigo from public.negocio n where n.id = p_negocio_id));
  return jsonb_build_object(
    'periodo',     coalesce((select habilitado from public.plan_caracteristica where plan_codigo = v_plan and clave = 'reportes_periodo'), false),
    'avanzados',   coalesce((select habilitado from public.plan_caracteristica where plan_codigo = v_plan and clave = 'reportes_avanzados'), false),
    'consolidado', coalesce((select habilitado from public.plan_caracteristica where plan_codigo = v_plan and clave = 'reportes_consolidados_sede'), false));
end $$;
revoke all on function public.negocio_reportes_funciones(uuid) from public, anon, authenticated;
grant execute on function public.negocio_reportes_funciones(uuid) to authenticated;
