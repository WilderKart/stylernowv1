-- 193 · Promoción «2 meses gratis» del anual = promoción de lanzamiento (modificable sin previo aviso) y descuento fundador en el anual.
--  1. _precio_plan_ciclo: en ANUAL el descuento fundador se aplica UNA sola vez y solo sobre UN mes (30 % del precio mensual);
--     la renovación anual vuelve a precio normal. En MENSUAL no cambia (30 % durante los meses fundador).
--     Mismas reglas que src/lib/planes/precios.ts. Misma firma: CREATE OR REPLACE sin crear sobrecarga.
--  2. Términos y Condiciones: nueva versión (max+1) con 8(e) ampliado y 8(f)/(g) nuevos. Aborta si el texto vigente no es el esperado.

begin;
set local lock_timeout = '5s';

create or replace function public._precio_plan_ciclo(p_negocio_id uuid, p_plan public.plan_codigo, p_ciclo text)
 returns numeric
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_pais character(2); v_precio numeric; v_desde boolean; v_meses int; v_pct numeric;
begin
  select coalesce(s.pais_codigo, 'CO') into v_pais from public.suscripcion s where s.negocio_id = p_negocio_id;
  select pp.precio_mensual, pp.es_desde into v_precio, v_desde
    from public.plan_precio pp where pp.plan_codigo = p_plan and pp.pais_codigo = coalesce(v_pais, 'CO') and pp.activo;
  if v_precio is null or v_precio <= 0 then raise exception 'PLAN_SIN_PRECIO'; end if;
  if v_desde then raise exception 'PLAN_REQUIERE_COTIZACION'; end if;
  select f.descuento_pct into v_pct from public.suscripcion_fundador f where f.negocio_id = p_negocio_id and f.estado = 'ACTIVO';
  v_pct := least(greatest(coalesce(v_pct, 0), 0), 100);
  if p_ciclo = 'ANUAL' then
    select anual_meses_pagados into v_meses from public.pais where codigo = coalesce(v_pais, 'CO');
    -- Anual: precio de lista (meses pagados × mensual) menos el descuento fundador de UN solo mes.
    return round(v_precio * coalesce(v_meses, 12) - v_precio * v_pct / 100, 2);
  end if;
  return round(v_precio * (1 - v_pct / 100), 2);
end
$function$;
revoke all on function public._precio_plan_ciclo(uuid, public.plan_codigo, text) from public, anon, authenticated;
grant execute on function public._precio_plan_ciclo(uuid, public.plan_codigo, text) to service_role;

do $publicar$
declare
  v_ult record;
  v_viejo constant text := '(e) Las promociones (como el precio fundador) se rigen por las condiciones publicadas al contratarlas y pueden perderse si cancelas antes del plazo indicado.';
  v_nuevo constant text :=
'(e) Las promociones (como el precio fundador y los meses de regalo del Plan anual) se rigen por las condiciones publicadas al contratarlas y pueden perderse si cancelas antes del plazo indicado. No son acumulables entre sí salvo que se indique lo contrario.' || E'\n\n' ||
'(f) La promoción «2 meses gratis» del Plan anual (pagas 10 meses y usas 12) es una promoción de lanzamiento. Podemos modificarla, suspenderla o retirarla en cualquier momento y sin previo aviso. El cambio aplica a las contrataciones posteriores a su publicación y no altera lo que ya hayas pagado.' || E'\n\n' ||
'(g) Precio fundador: en el Plan mensual, el descuento fundador (30 %) se aplica durante los primeros 3 meses y después se cobra el precio normal. En el Plan anual no se aplica durante 3 meses: el descuento se aplica una sola vez, únicamente sobre el valor de un mes (el primero), y desde ahí, incluida la renovación, se cobra el precio normal. El descuento fundador está sujeto a cupos limitados por país.';
begin
  select version, contenido into v_ult from public.texto_legal where tipo = 'TERMINOS' order by version desc limit 1;
  if v_ult.version is null then raise exception 'TERMINOS_NO_ENCONTRADOS'; end if;
  if position(v_viejo in v_ult.contenido) = 0 then raise exception 'CLAUSULA_8E_INESPERADA: revisar el texto vigente antes de publicar'; end if;
  insert into public.texto_legal (tipo, version, contenido, cambio_material)
  values ('TERMINOS', v_ult.version + 1, replace(v_ult.contenido, v_viejo, v_nuevo), false);
end;
$publicar$;

commit;
