-- StylerNow — Migración 027: corrige parámetros opcionales de la migración 026
--
-- `crear_banner_home`, `actualizar_banner_home` y `actualizar_plan` reciben
-- campos que son legítimamente opcionales (texto/link/vigencia de un banner,
-- límites numéricos de un Plan) pero sus parámetros SQL no tenían `default
-- null` — PostgREST exige que todo parámetro sin default esté presente en la
-- llamada, y el generador de tipos de Supabase infería el tipo como no-nulo
-- (`string`/`number`), rechazando en tsc el `null` que el frontend sí
-- necesita enviar quando el campo queda vacío. Se corrige agregando `default
-- null` a esos parámetros — el cuerpo de cada función no cambia.

create or replace function public.crear_banner_home(
  p_imagen_url text,
  p_texto text default null,
  p_url_destino text default null,
  p_vigencia_desde timestamptz default null,
  p_vigencia_hasta timestamptz default null,
  p_orden int default 0
)
returns public.banner_home
language plpgsql security definer set search_path = public as $fn$
declare v_row public.banner_home;
begin
  if not public.is_supersu() then raise exception 'NO_AUTORIZADO'; end if;
  if p_imagen_url is null or length(trim(p_imagen_url)) = 0 then raise exception 'IMAGEN_REQUERIDA'; end if;

  insert into public.banner_home (imagen_url, texto, url_destino, vigencia_desde, vigencia_hasta, orden, updated_by)
  values (p_imagen_url, p_texto, p_url_destino, p_vigencia_desde, p_vigencia_hasta, coalesce(p_orden, 0), auth.uid())
  returning * into v_row;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id)
  values ('banner_home', v_row.id, 'BANNER_CREADO', 'SUPERSU', auth.uid());

  return v_row;
end;
$fn$;
grant execute on function public.crear_banner_home(text, text, text, timestamptz, timestamptz, int) to authenticated;

create or replace function public.actualizar_banner_home(
  p_id uuid,
  p_imagen_url text default null,
  p_texto text default null,
  p_url_destino text default null,
  p_vigencia_desde timestamptz default null,
  p_vigencia_hasta timestamptz default null,
  p_orden int default null,
  p_activo boolean default null
)
returns public.banner_home
language plpgsql security definer set search_path = public as $fn$
declare v_row public.banner_home;
begin
  if not public.is_supersu() then raise exception 'NO_AUTORIZADO'; end if;

  update public.banner_home set
    imagen_url = coalesce(p_imagen_url, imagen_url),
    texto = coalesce(p_texto, texto),
    url_destino = coalesce(p_url_destino, url_destino),
    vigencia_desde = coalesce(p_vigencia_desde, vigencia_desde),
    vigencia_hasta = coalesce(p_vigencia_hasta, vigencia_hasta),
    orden = coalesce(p_orden, orden),
    activo = coalesce(p_activo, activo),
    updated_by = auth.uid()
  where id = p_id
  returning * into v_row;

  if not found then raise exception 'BANNER_NO_ENCONTRADO'; end if;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id)
  values ('banner_home', v_row.id, 'BANNER_ACTUALIZADO', 'SUPERSU', auth.uid());

  return v_row;
end;
$fn$;
grant execute on function public.actualizar_banner_home(uuid, text, text, text, timestamptz, timestamptz, int, boolean) to authenticated;

create or replace function public.actualizar_plan(
  p_codigo plan_codigo,
  p_precio_mensual numeric default null,
  p_limite_sedes int default null,
  p_staff_incluido int default null,
  p_staff_addon_precio numeric default null,
  p_sede_addon_precio numeric default null,
  p_guardian_disponible boolean default null,
  p_marketplace_ads_disponible boolean default null,
  p_creditos_ia_mes int default null,
  p_conversaciones_whatsapp_mes int default null
)
returns public.plan
language plpgsql security definer set search_path = public as $fn$
declare v_row public.plan;
begin
  if not public.is_supersu() then raise exception 'NO_AUTORIZADO'; end if;

  update public.plan set
    precio_mensual = p_precio_mensual,
    limite_sedes = p_limite_sedes,
    staff_incluido = p_staff_incluido,
    staff_addon_precio = p_staff_addon_precio,
    sede_addon_precio = p_sede_addon_precio,
    guardian_disponible = coalesce(p_guardian_disponible, guardian_disponible),
    marketplace_ads_disponible = coalesce(p_marketplace_ads_disponible, marketplace_ads_disponible),
    creditos_ia_mes = p_creditos_ia_mes,
    conversaciones_whatsapp_mes = p_conversaciones_whatsapp_mes,
    updated_at = now()
  where codigo = p_codigo
  returning * into v_row;

  if not found then raise exception 'PLAN_NO_ENCONTRADO'; end if;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id)
  values ('plan', null, 'PLAN_ACTUALIZADO_' || p_codigo::text, 'SUPERSU', auth.uid());

  return v_row;
end;
$fn$;
grant execute on function public.actualizar_plan(plan_codigo, numeric, int, int, numeric, numeric, boolean, boolean, int, int) to authenticated;
