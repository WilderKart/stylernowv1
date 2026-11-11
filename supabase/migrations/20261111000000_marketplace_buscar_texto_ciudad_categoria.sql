-- El buscador del marketplace entiende ciudad y categoría (reemplaza los chips de ciudades del home).
-- "cali" o "Bogota" (sin tilde) devuelven los negocios de esa ciudad; "barberia" coincide con la categoría.
-- Parchea los dos filtros de texto de marketplace_buscar sin cambiar su firma (no crea sobrecarga). Idempotente.
do $$
declare
  v_sig regprocedure := 'public.marketplace_buscar(text,text,text,text,integer,integer,double precision,double precision)'::regprocedure;
  v_def text := pg_get_functiondef(v_sig);
  v_nuevo text;
begin
  if v_def like '%translate(lower(n.ciudad)%' then return; end if;
  v_nuevo := replace(
    v_def,
    'n.nombre ilike ''%'' || p_texto || ''%''',
    'n.nombre ilike ''%'' || p_texto || ''%'' or translate(lower(n.ciudad), ''áéíóúñ'', ''aeioun'') ilike ''%'' || translate(lower(p_texto), ''áéíóúñ'', ''aeioun'') || ''%'' or exists (select 1 from unnest(n.categoria) cat where cat ilike ''%'' || p_texto || ''%'')'
  );
  if v_nuevo = v_def then raise exception 'ANCLA_NO_ENCONTRADA en marketplace_buscar'; end if;
  execute v_nuevo;
end $$;
