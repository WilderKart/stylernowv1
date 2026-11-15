-- SEMILLA para las tablas multi-tenant que no tenían NINGUNA fila del negocio B (solo base LOCAL de Docker, datos ficticios; NO es migración).
-- Genérica: para cada tabla arma UNA fila ligada al negocio B leyendo el catálogo (columnas obligatorias, llaves foráneas, enums, tipos).
-- Las llaves foráneas se resuelven a filas del negocio B (o se siembra el padre). Lo que no se pueda sembrar queda registrado en
-- _sembrado con el motivo: una tabla sin fila representativa NO se considera probada.
-- Idempotente a medias: si ya hay una fila de B en la tabla, no agrega otra. Aplicar después de seed_datos_ricos + seed_pruebas.
\set ON_ERROR_STOP 0
\set B_NEG '00000000-0000-0000-0006-0000000001b0'
\set B_SEDE '00000000-0000-0000-0006-0000000002b0'
\set B_CLI '00000000-0000-0000-0006-0000000000b3'
\set B_STAFF '00000000-0000-0000-0006-0000000000b2'
\set B_DUENO '00000000-0000-0000-0006-0000000000b1'
\set B_RES '00000000-0000-0000-0006-0000000004b0'

select set_config('seed.b_neg', :'B_NEG', false);
select set_config('seed.b_sede', :'B_SEDE', false);
select set_config('seed.b_cli', :'B_CLI', false);
select set_config('seed.b_staff', :'B_STAFF', false);
select set_config('seed.b_dueno', :'B_DUENO', false);
select set_config('seed.b_res', :'B_RES', false);

drop table if exists public._sembrado;
create unlogged table public._sembrado (tabla text primary key, resultado text, detalle text);

create or replace function pg_temp.pk_de(p_tabla text) returns text language sql as $$
  select a.attname from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
   where i.indrelid = ('public.' || quote_ident(p_tabla))::regclass and i.indisprimary limit 1 $$;

create or replace function pg_temp.tiene_col(p_tabla text, p_col text) returns boolean language sql as $$
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = p_tabla and column_name = p_col) $$;

-- Valor (texto SQL) de la columna de referencia `p_col` de la tabla `p_tabla`, perteneciente al negocio B si es posible.
create or replace function pg_temp.ref_valor(p_tabla text, p_col text, p_prof int) returns text language plpgsql as $$
declare v text; v_fil text := '';
begin
  if p_tabla = 'negocio' and p_col = 'id' then return quote_literal(current_setting('seed.b_neg')); end if;
  if p_tabla = 'sede' and p_col = 'id' then return quote_literal(current_setting('seed.b_sede')); end if;
  if p_tabla = 'perfil' then return quote_literal(current_setting('seed.b_cli')); end if;
  if p_tabla = 'staff' then return quote_literal(current_setting('seed.b_staff')); end if;
  if p_tabla = 'reserva' and p_col = 'id' then return quote_literal(current_setting('seed.b_res')); end if;
  if pg_temp.tiene_col(p_tabla, 'negocio_id') then v_fil := format(' where negocio_id = %L', current_setting('seed.b_neg'));
  elsif pg_temp.tiene_col(p_tabla, 'cliente_id') then v_fil := format(' where cliente_id = %L', current_setting('seed.b_cli')); end if;
  execute format('select %I::text from public.%I %s limit 1', p_col, p_tabla, v_fil) into v;
  if v is null and p_prof < 3 then
    perform pg_temp.sembrar(p_tabla, p_prof + 1, '{}'::jsonb);
    execute format('select %I::text from public.%I %s limit 1', p_col, p_tabla, v_fil) into v;
  end if;
  if v is null then execute format('select %I::text from public.%I limit 1', p_col, p_tabla) into v; end if;
  return case when v is null then null else quote_literal(v) end;
end $$;

create or replace function pg_temp.sembrar(p_tabla text, p_prof int default 0, p_ov jsonb default '{}'::jsonb) returns void language plpgsql as $$
declare
  r record; v_cols text[] := '{}'; v_vals text[] := '{}'; v_val text; v_fk record;
  v_tenant text[] := array['negocio_id','sede_id','reserva_id','cliente_id','usuario_id','user_id','staff_id','titular_cliente_id','creado_por','autor_id'];
begin
  -- ya hay una fila ligada a B: no duplicar
  for r in select c as col, case c when 'negocio_id' then current_setting('seed.b_neg') when 'sede_id' then current_setting('seed.b_sede')
                  when 'reserva_id' then current_setting('seed.b_res') else current_setting('seed.b_cli') end as val
             from unnest(array['negocio_id','sede_id','reserva_id','cliente_id']) c where pg_temp.tiene_col(p_tabla, c)
  loop
    execute format('select 1 from public.%I where %I = %L limit 1', p_tabla, r.col, r.val) into v_val;
    if v_val is not null then return; end if;
  end loop;
  for r in
    select c.column_name n, c.data_type t, c.udt_name u, c.is_nullable = 'YES' as nul, c.column_default d, c.is_generated g, c.is_identity idn
      from information_schema.columns c where c.table_schema = 'public' and c.table_name = p_tabla order by c.ordinal_position
  loop
    continue when r.g <> 'NEVER' or r.idn = 'YES';
    -- ¿obligatoria sin valor por defecto, o columna que ata la fila a un tenant/usuario?
    continue when not ((not r.nul and r.d is null) or r.n = any (v_tenant) or p_ov ? r.n);
    v_val := null;
    if p_ov ? r.n then
      v_val := case when jsonb_typeof(p_ov -> r.n) = 'null' then 'null' else quote_literal(p_ov ->> r.n) end;
    else
      select a.attname, fk.confrelid::regclass::text as ref, fa.attname as refcol into v_fk
        from pg_constraint fk join pg_attribute a on a.attrelid = fk.conrelid and a.attnum = fk.conkey[1]
        join pg_attribute fa on fa.attrelid = fk.confrelid and fa.attnum = fk.confkey[1]
       where fk.contype = 'f' and fk.conrelid = ('public.' || quote_ident(p_tabla))::regclass and array_length(fk.conkey, 1) = 1 and a.attname = r.n limit 1;
      if v_fk.ref is not null then
        if v_fk.ref in ('perfil','auth.users') and r.n ~ '(owner|dueno)' then v_val := quote_literal(current_setting('seed.b_dueno'));
        elsif v_fk.ref = 'auth.users' then v_val := quote_literal(current_setting('seed.b_cli'));
        else v_val := pg_temp.ref_valor(regexp_replace(v_fk.ref, '^public\.', ''), v_fk.refcol, p_prof); end if;
      end if;
      if v_val is null and r.n in ('negocio_id') then v_val := quote_literal(current_setting('seed.b_neg')); end if;
      if v_val is null and r.n in ('sede_id') then v_val := quote_literal(current_setting('seed.b_sede')); end if;
      if v_val is null and r.n in ('cliente_id','usuario_id','user_id','titular_cliente_id') then v_val := quote_literal(current_setting('seed.b_cli')); end if;
      if v_val is null and r.n in ('staff_id') then v_val := quote_literal(current_setting('seed.b_staff')); end if;
      if v_val is null and r.n in ('reserva_id') then v_val := quote_literal(current_setting('seed.b_res')); end if;
      if v_val is null then
        select (regexp_match(pg_get_constraintdef(k.oid), '''([^'']+)''::'))[1] into v_val
          from pg_constraint k where k.contype = 'c' and k.conrelid = ('public.' || quote_ident(p_tabla))::regclass
           and pg_get_constraintdef(k.oid) ~ ('[(]*' || r.n || '[)]*(::text)? = ANY') limit 1;
        if v_val is not null then v_val := quote_literal(v_val); end if;
      end if;
      if v_val is null and r.t = 'USER-DEFINED' then
        select quote_literal(e.enumlabel) into v_val from pg_enum e join pg_type ty on ty.oid = e.enumtypid where ty.typname = r.u order by e.enumsortorder limit 1;
      end if;
      if v_val is null then
        v_val := case
          when r.nul and r.n = any (v_tenant) then null
          when r.t = 'uuid' then quote_literal(gen_random_uuid())
          when r.t in ('text','character varying','character') then quote_literal('sem-' || r.n)
          when r.t in ('integer','bigint','smallint','numeric','double precision','real') then '1'
          when r.t = 'boolean' then 'true'
          when r.t like 'timestamp%' then 'now()'
          when r.t = 'date' then 'current_date'
          when r.t like 'time without%' then quote_literal('09:00')
          when r.t = 'interval' then quote_literal('1 hour')
          when r.t in ('jsonb','json') then quote_literal('{}')
          when r.t = 'ARRAY' then quote_literal('{}')
          else null end;
      end if;
    end if;
    if v_val is null and not r.nul then raise exception 'sin valor para % (% / %)', r.n, r.t, r.u; end if;
    v_cols := v_cols || quote_ident(r.n);
    v_vals := v_vals || coalesce(v_val, 'null');
  end loop;
  execute format('insert into public.%I (%s) values (%s)', p_tabla, array_to_string(v_cols, ','), array_to_string(v_vals, ','));
end $$;

create or replace function pg_temp.intentar_sembrar(p_tabla text, p_ov jsonb default '{}'::jsonb) returns void language plpgsql as $$
begin
  perform pg_temp.sembrar(p_tabla, 0, p_ov);
  insert into public._sembrado values (p_tabla, 'OK', null) on conflict (tabla) do update set resultado = 'OK', detalle = null;
exception when others then
  insert into public._sembrado values (p_tabla, 'ERROR', left(sqlerrm, 200)) on conflict (tabla) do update set resultado = 'ERROR', detalle = left(sqlerrm, 200);
end $$;

-- Overrides por tabla (se completan con lo que falle en la primera pasada)
-- Las 61 tablas que no tenían filas de B (lista tomada de docs/plan_cierre/evidencias/matriz_aislamiento.json › cobertura)
select pg_temp.intentar_sembrar(t) from unnest(string_to_array(
 'ai_conversion ai_memoria_negocio ai_prompt ai_roi_snapshot campana_publicitaria cashback_movimiento cashback_regla chat_conversacion comision_cambio_programado conexion_pago_evento corporativo_consumo corporativo_miembro credito_ia_consumo credito_ia_lote disponibilidad familia_grupo familia_miembro favorito_negocio gift_card_redencion lealtad_fraude_evento lealtad_movimiento lealtad_wallet lista_espera membresia_uso negocio_addon negocio_marca negocio_visita_perfil notificacion_envio notificacion_plantilla oauth_estado oferta_negocio prueba_uso punto_fidelizacion recompensa_regla recompensa_sugerencia recurso_tipo recurso referido_codigo referido_config referido resena sede_horario_excepcion sello_campana sello_cliente sello_evento servicio_combo solicitud_devolucion_saldo solicitud_reposicion staff_referido suscripcion_fundador suscripcion ticket_soporte venta_producto vip_miembro vip_nivel webhook_evento whatsapp_alerta whatsapp_campana whatsapp_compra_recarga whatsapp_consumo whatsapp_conversacion_lote', ' ')) t;
-- Reglas CHECK que el generador no deduce solo (se fijan a mano)
select pg_temp.intentar_sembrar('disponibilidad', '{"hora_fin":"18:00"}');
select pg_temp.intentar_sembrar('oferta_negocio', '{"valor":"10"}');
-- ai_prompt: un negocio solo puede crear PROPIO/COMPARTIDO (OFICIAL es de la plataforma y es público por diseño)
delete from public.ai_prompt where negocio_id = current_setting('seed.b_neg')::uuid and tipo = 'OFICIAL';
select pg_temp.intentar_sembrar('ai_prompt', '{"tipo":"PROPIO"}');
\echo
\echo '== resultado de la siembra =='
select resultado, count(*) from public._sembrado group by 1;
select tabla, detalle from public._sembrado where resultado <> 'OK' order by 1;
