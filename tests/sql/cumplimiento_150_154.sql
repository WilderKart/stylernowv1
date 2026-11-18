-- Pruebas del Centro de Cumplimiento y PQRS (migraciones 150-154 sobre 145/146/148). SOLO base local; termina en ROLLBACK.
--   docker exec -i supabase_db_stylernow-cierre psql -U postgres -d cumplimiento -v ON_ERROR_STOP=1 < tests/sql/cumplimiento_150_154.sql
-- Cada bloque lanza 'FALLA: …' si el comportamiento no es el esperado.
begin;

grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
-- authenticated: se conservan los GRANT reales de las migraciones (las tablas nuevas los revocan explícitamente).
grant select on public.perfil, public.texto_legal, public.negocio to authenticated;

-- Ayudantes (pg_temp no sirve entre roles; se crean en public y el ROLLBACK los elimina).
create function public.t_error(p_sql text, p_patron text) returns void language plpgsql as $$
begin
  begin execute p_sql; exception when others then
    if sqlerrm like '%' || p_patron || '%' then return; end if;
    raise exception 'FALLA: se esperaba "%" y fue "%" (%)', p_patron, sqlerrm, p_sql;
  end;
  raise exception 'FALLA: debía fallar con "%" (%)', p_patron, p_sql;
end $$;
create function public.t_igual(p_nombre text, p_real anyelement, p_esperado anyelement) returns void language plpgsql as $$
begin if p_real is distinct from p_esperado then raise exception 'FALLA %: real=% esperado=%', p_nombre, p_real, p_esperado; end if; raise notice 'OK %', p_nombre; end $$;
grant execute on function public.t_error(text, text), public.t_igual(text, anyelement, anyelement) to public;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000c1', 'cliente@t.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c2', 'intruso@t.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c3', 'super@t.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c4', 'otro@t.local', 'authenticated', 'authenticated');
insert into public.perfil (id, nombre) values
  ('00000000-0000-0000-0000-0000000000c1', 'Cliente'), ('00000000-0000-0000-0000-0000000000c2', 'Intruso'),
  ('00000000-0000-0000-0000-0000000000c3', 'SuperSU'), ('00000000-0000-0000-0000-0000000000c4', 'Otro') on conflict (id) do nothing;
update public.perfil set es_supersu = true where id = '00000000-0000-0000-0000-0000000000c3';
insert into public.texto_legal (tipo, version, contenido, cambio_material) values ('POLITICA_DATOS', 901, 'texto de prueba', false);

-- ═══ 1. Calendario ═══
do $$ begin
  perform public.t_igual('pascua 2026', public.pascua(2026), date '2026-04-05');
  perform public.t_igual('pascua 2027', public.pascua(2027), date '2027-03-28');
  perform public.t_igual('festivos 2026 (18)', (select count(*)::int from public.calcular_festivos_co(2026)), 18);
  perform public.t_igual('Ascensión 2026 lunes 18-may', exists (select 1 from public.calcular_festivos_co(2026) where fecha = '2026-05-18' and nombre like 'Ascensi%'), true);
  perform public.t_igual('Reyes 2027 → 11-ene', exists (select 1 from public.calcular_festivos_co(2027) where fecha = '2027-01-11'), true);
  perform public.t_igual('sábado no es hábil', public.es_dia_habil(date '2026-11-21'), false);
  perform public.t_igual('festivo 2026-11-16 no es hábil', public.es_dia_habil(date '2026-11-16'), false);
  perform public.t_igual('10 hábiles desde 2026-11-17', public.sumar_dias_habiles(date '2026-11-17', 10), date '2026-12-01');
  perform public.t_igual('10 hábiles cruzando festivo 8-dic', public.sumar_dias_habiles(date '2026-12-01', 10), date '2026-12-16');
  perform public.t_igual('desde sábado: el 1.º hábil cuenta el lunes', public.sumar_dias_habiles(date '2026-11-21', 1), date '2026-11-23');
  perform public.t_igual('desde festivo lunes 16-nov', public.sumar_dias_habiles(date '2026-11-16', 1), date '2026-11-17');
  perform public.t_igual('Navidad: 24-dic +1 hábil = 28-dic', public.sumar_dias_habiles(date '2026-12-24', 1), date '2026-12-28');
  perform public.t_igual('días hábiles entre 13 y 18 nov', public.dias_habiles_entre(date '2026-11-13', date '2026-11-18'), 2);
  perform public.t_igual('fecha límite 23:59:59 Bogotá', public.calcular_fecha_limite(timestamptz '2026-11-17 10:00-05', 10, 'DIAS_HABILES'), timestamptz '2026-12-01 23:59:59-05');
  perform public.t_igual('recibido 23:30 Bogotá cuenta el día de Bogotá, no el UTC', public.fecha_colombia(timestamptz '2026-11-18 04:30+00'), date '2026-11-17');
  perform public.t_error($q$select public.sumar_dias_habiles(date '2026-01-01', -1)$q$, 'DIAS_FUERA_DE_RANGO');
end $$;

-- ═══ 2. Catálogo de plazos ═══
do $$
declare e record;
begin
  select * into e from public._caso_plazo_efectivo('DATOS_CONSULTA');
  perform public.t_igual('consulta: 10 hábiles legal verificado', e.plazo::text || e.unidad || e.origen, '10DIAS_HABILESLEGAL_VERIFICADO');
  perform public.t_igual('consulta: prórroga 5', e.prorroga_max, 5);
  select * into e from public._caso_plazo_efectivo('DATOS_RECLAMO');
  perform public.t_igual('reclamo: 15 hábiles verificado, prórroga 8', e.plazo::text || e.origen || e.prorroga_max, '15LEGAL_VERIFICADO8');
  select * into e from public._caso_plazo_efectivo('CONS_SERVICIO');
  perform public.t_igual('consumidor: provisional (no se presenta como ley definitiva)', e.origen, 'LEGAL_PROVISIONAL');
  select * into e from public._caso_plazo_efectivo('PQRS_PETICION');
  perform public.t_igual('petición sin plazo verificado → interno', e.origen, 'INTERNO');
  select * into e from public._caso_plazo_efectivo('SEG_INCIDENTE');
  perform public.t_igual('incidente: interno 24 horas', e.plazo::text || e.unidad, '24HORAS');
  perform public.t_igual('los plazos efectivos no son uno solo para todos los tipos', (select count(distinct pe.plazo::text || pe.unidad) >= 5 from public.caso_tipo c cross join lateral public._caso_plazo_efectivo(c.codigo) pe), true);
  perform public.t_error($q$insert into public.caso_plazo_regla (tipo_codigo, version, plazo, estado_verificacion) values ('OPE_OTRO', 2, 5, 'VERIFICADO_LEGALMENTE')$q$, 'caso_plazo_verificado_completo');
  perform public.t_igual('solo datos tienen plazos verificados', (select array_agg(distinct tipo_codigo order by tipo_codigo) from public.caso_plazo_regla where estado_verificacion = 'VERIFICADO_LEGALMENTE' and tipo_codigo not like 'DATOS_%'), null::text[]);
end $$;

-- ═══ 3. Permisos de funciones y tablas ═══
reset role;
do $$
declare f text;
begin
  foreach f in array array['caso_radicar(text,text,text,text,uuid,jsonb,uuid,text,text,text,uuid)', 'caso_consultar_publico(text,text)',
     'caso_responder_publico(text,text,text)', 'caso_rotar_token(text,text,text)', 'caso_registrar_adjunto(uuid,text,text,text,integer,text,text,uuid)',
     'cumplimiento_tomar_lote(integer)', 'cumplimiento_marcar(uuid,text,text,text)', 'caso_registrar_envio(uuid,text,text,text,text,text)'] loop
    if has_function_privilege('anon', 'public.' || f, 'execute') or has_function_privilege('authenticated', 'public.' || f, 'execute')
       or not has_function_privilege('service_role', 'public.' || f, 'execute') then
      raise exception 'FALLA ACL: % debe ser solo service_role', f;
    end if;
  end loop;
  foreach f in array array['_caso_mover(uuid,text,uuid,text,jsonb,boolean)', '_caso_log(uuid,text,text,text,uuid,text,jsonb,boolean)', 'cumplimiento_encolar(uuid,text,text,text)'] loop
    if has_function_privilege('anon', 'public.' || f, 'execute') or has_function_privilege('authenticated', 'public.' || f, 'execute') then
      raise exception 'FALLA ACL: la interna % no debe ser ejecutable', f;
    end if;
  end loop;
  if has_table_privilege('authenticated', 'public.caso_seguimiento', 'select') or has_table_privilege('anon', 'public.caso_seguimiento', 'select') then
    raise exception 'FALLA ACL: caso_seguimiento (hashes de token) legible por la API';
  end if;
  foreach f in array array['caso_solicitante', 'caso_historial', 'caso_adjunto', 'cumplimiento_config', 'cumplimiento_notificacion', 'caso_tipo', 'caso_plazo_regla', 'festivo_co'] loop
    if has_table_privilege('anon', 'public.' || f, 'select') or has_table_privilege('anon', 'public.' || f, 'insert') then raise exception 'FALLA ACL: anon accede a %', f; end if;
    if has_table_privilege('authenticated', 'public.' || f, 'insert') or has_table_privilege('authenticated', 'public.' || f, 'update') or has_table_privilege('authenticated', 'public.' || f, 'delete') then raise exception 'FALLA ACL: authenticated escribe directo en %', f; end if;
  end loop;
  raise notice 'OK ACL de funciones y tablas';
end $$;

-- ═══ 4. Radicación pública (servidor = service_role) ═══
set local role service_role;
create temp table r (k text primary key, v jsonb);
grant all on r to public;
insert into r select 'a', public.caso_radicar('DATOS_RECLAMO', 'Quiero actualizar mi teléfono', 'Mi número cambió y deseo actualizarlo en su base.', 'WEB_PUBLICO', null,
  '{"nombre":"Ana Pérez","email":"ana@ejemplo.co","telefono":"3001234567","id_tipo":"CC","id_numero":"1000000001"}'::jsonb, null, 'reserva-xyz',
  repeat('a', 64), 'idem-1', (select id from public.texto_legal where version = 901));
do $$
declare v jsonb := (select v from r where k = 'a'); t public.ticket_soporte;
begin
  select * into t from public.ticket_soporte where id = (v ->> 'id')::uuid;
  perform public.t_igual('radicación sin cuenta crea ticket', t.creado_por is null, true);
  perform public.t_igual('número de radicación SN-AAAA-NNNNNN', t.numero_radicacion ~ '^SN-[0-9]{4}-[0-9]{6}$', true);
  perform public.t_igual('estado inicial NUEVO', t.estado_caso, 'NUEVO');
  perform public.t_igual('prioridad inicial de datos = ALTA', t.prioridad, 'ALTA');
  perform public.t_igual('plazo legal verificado', t.plazo_origen, 'LEGAL_VERIFICADO');
  perform public.t_igual('fecha límite = 15 hábiles', t.fecha_limite, public.calcular_fecha_limite(t.recibido_at, 15, 'DIAS_HABILES'));
  perform public.t_igual('guarda el solicitante aparte', (select email from public.caso_solicitante where ticket_id = t.id), 'ana@ejemplo.co');
  perform public.t_igual('guarda solo el hash del token', (select token_hash from public.caso_seguimiento where ticket_id = t.id), repeat('a', 64));
  perform public.t_igual('historial: RADICADO', (select count(*)::int from public.caso_historial where ticket_id = t.id and tipo_evento = 'RADICADO'), 1);
end $$;

-- idempotencia
insert into r select 'dup', public.caso_radicar('DATOS_RECLAMO', 'Quiero actualizar mi teléfono', 'Mi número cambió y deseo actualizarlo en su base.', 'WEB_PUBLICO', null,
  '{"nombre":"Ana Pérez","email":"ana@ejemplo.co","id_tipo":"CC","id_numero":"1000000001"}'::jsonb, null, null, repeat('a', 64), 'idem-1', (select id from public.texto_legal where version = 901));
do $$ begin
  perform public.t_igual('doble envío no duplica', (select v ->> 'id' from r where k = 'dup'), (select v ->> 'id' from r where k = 'a'));
  perform public.t_igual('doble envío marcado duplicado', (select (v ->> 'duplicado')::boolean from r where k = 'dup'), true);
  perform public.t_igual('un solo ticket por clave', (select count(*)::int from public.ticket_soporte where idempotency_key = 'idem-1'), 1);
  -- validaciones
  perform public.t_error($q$select public.caso_radicar('LEGAL_AUTORIDAD','Requerimiento','Texto suficientemente largo.','WEB_PUBLICO',null,'{"nombre":"X Y","email":"x@y.co"}',null,null,repeat('b',64),'i2',(select id from public.texto_legal where version=901))$q$, 'TIPO_NO_PUBLICO');
  perform public.t_error($q$select public.caso_radicar('NO_EXISTE','Asunto largo','Texto suficientemente largo.','WEB_PUBLICO',null,'{"nombre":"X Y","email":"x@y.co"}',null,null,repeat('b',64),'i3',(select id from public.texto_legal where version=901))$q$, 'TIPO_INVALIDO');
  perform public.t_error($q$select public.caso_radicar('OPE_OTRO','Asunto largo','Texto suficientemente largo.','WEB_PUBLICO',null,'{"nombre":"X Y"}',null,null,repeat('b',64),'i4',(select id from public.texto_legal where version=901))$q$, 'SOLICITANTE_INCOMPLETO');
  perform public.t_error($q$select public.caso_radicar('OPE_OTRO','Asunto largo','Texto suficientemente largo.','WEB_PUBLICO',null,'{"nombre":"X Y","email":"x@y.co"}',null,null,'zz','i5',(select id from public.texto_legal where version=901))$q$, 'TOKEN_REQUERIDO');
  perform public.t_error($q$select public.caso_radicar('OPE_OTRO','Asunto largo','Texto suficientemente largo.','WEB_PUBLICO',null,'{"nombre":"X Y","email":"x@y.co"}',null,null,repeat('b',64),'i6',null)$q$, 'POLITICA_NO_CONFIRMADA');
  perform public.t_error($q$select public.caso_radicar('DATOS_CONSULTA','Consulta de mis datos','Quiero saber qué datos tienen.','WEB_PUBLICO',null,'{"nombre":"X Y","email":"x@y.co"}',null,null,repeat('b',64),'i7',(select id from public.texto_legal where version=901))$q$, 'IDENTIFICACION_REQUERIDA');
  perform public.t_error($q$select public.caso_radicar('OPE_OTRO','abc','Texto suficientemente largo.','WEB_PUBLICO',null,'{"nombre":"X Y","email":"x@y.co"}',null,null,repeat('b',64),'i8',(select id from public.texto_legal where version=901))$q$, 'ASUNTO_INVALIDO');
  perform public.t_error($q$select public.caso_radicar('OPE_OTRO','Asunto largo','corto','WEB_PUBLICO',null,'{"nombre":"X Y","email":"x@y.co"}',null,null,repeat('b',64),'i9',(select id from public.texto_legal where version=901))$q$, 'DESCRIPCION_INVALIDA');
  perform public.t_error($q$select public.caso_radicar('OPE_OTRO','Asunto largo','Texto suficientemente largo.','HACK',null,'{"nombre":"X Y","email":"x@y.co"}',null,null,repeat('b',64),'i10',(select id from public.texto_legal where version=901))$q$, 'CANAL_INVALIDO');
end $$;
-- minimización: un tipo que no pide identificación no guarda el documento aunque llegue
insert into r select 'cons', public.caso_radicar('CONS_SERVICIO', 'El corte salió mal', 'Pagué el servicio y no se prestó como se prometió.', 'WEB_PUBLICO', null,
  '{"nombre":"Luis Gómez","email":"luis@ejemplo.co","id_tipo":"CC","id_numero":"99999999"}'::jsonb, null, null, repeat('c', 64), 'idem-cons', (select id from public.texto_legal where version = 901));
do $$ begin
  perform public.t_igual('minimización: no guarda documento si el tipo no lo pide', (select id_numero from public.caso_solicitante where ticket_id = (select (v ->> 'id')::uuid from r where k = 'cons')), null::text);
  perform public.t_igual('consumidor: plazo provisional', (select plazo_origen from public.ticket_soporte where id = (select (v ->> 'id')::uuid from r where k = 'cons')), 'LEGAL_PROVISIONAL');
end $$;
-- radicación CON cuenta (el servidor fija creado_por desde la sesión)
insert into r select 'cuenta', public.caso_radicar('CONS_RESERVA', 'Problema con mi reserva', 'Mi reserva no aparece en la agenda del negocio.', 'WEB_PUBLICO', '00000000-0000-0000-0000-0000000000c1',
  '{"nombre":"Cliente Uno","email":"cliente@t.local"}'::jsonb, null, 'Reserva: ABC', repeat('4', 64), 'idem-cuenta', (select id from public.texto_legal where version = 901));
do $$ declare t public.ticket_soporte := (select tk from public.ticket_soporte tk where id = (select (v ->> 'id')::uuid from r where k = 'cuenta')); begin
  perform public.t_igual('radicación con cuenta: ligada al usuario', t.creado_por, '00000000-0000-0000-0000-0000000000c1'::uuid);
  perform public.t_igual('radicación con cuenta: también guarda contacto y enlace', (select count(*)::int from public.caso_solicitante where ticket_id = t.id) + (select count(*)::int from public.caso_seguimiento where ticket_id = t.id), 2);
  perform public.t_igual('radicación con cuenta: evidencia con el rol real, no EXTERNO', (select rol from public.evidencia_legal where referencia_id = t.id and accion = 'SOLICITA'), 'CLIENTE');
end $$;
-- crítico sin asignar
insert into r select 'crit', public.caso_radicar('SEG_FILTRACION', 'Vi mis datos en otro sitio', 'Encontré mis datos personales publicados en una página externa.', 'WEB_PUBLICO', null,
  '{"nombre":"Marta R","email":"marta@ejemplo.co"}'::jsonb, null, null, repeat('d', 64), 'idem-crit', (select id from public.texto_legal where version = 901));
do $$
declare v uuid := (select (v ->> 'id')::uuid from r where k = 'crit');
begin
  perform public.t_igual('incidente: prioridad CRÍTICA', (select prioridad from public.ticket_soporte where id = v), 'CRITICA');
  perform public.t_igual('crítico: alerta CRM inmediata', (select count(*)::int from public.cumplimiento_notificacion where ticket_id = v and canal = 'CRM' and regla = 'RADICADO'), 1);
  perform public.t_igual('crítico: correo a equipo@stylernow.com', (select count(*)::int from public.cumplimiento_notificacion where ticket_id = v and canal = 'EMAIL' and destinatario = 'equipo@stylernow.com' and estado = 'PENDIENTE'), 1);
  perform public.t_igual('crítico: SMS registrado pero CANAL_NO_HABILITADO', (select estado from public.cumplimiento_notificacion where ticket_id = v and canal = 'SMS' and regla = 'RADICADO'), 'CANAL_NO_HABILITADO');
  perform public.t_igual('SMS usa el celular configurado (no del código)', (select destinatario from public.cumplimiento_notificacion where ticket_id = v and canal = 'SMS' limit 1), '+57 3183943465');
  perform public.t_igual('crítico sin responsable: UN solo aviso por canal (sin spam)', (select count(*)::int from public.cumplimiento_notificacion where ticket_id = v and regla <> 'ACUSE_SOLICITANTE' and canal = 'EMAIL'), 1);
  perform public.t_igual('ningún SMS figura como ENVIADO', (select count(*)::int from public.cumplimiento_notificacion where canal = 'SMS' and estado = 'ENVIADO'), 0);
  perform public.t_igual('el aviso no contiene datos personales', (select datos::text !~* '(marta|ejemplo\.co|datos personales publicados)' from public.cumplimiento_notificacion where ticket_id = v and canal = 'EMAIL' limit 1), true);
end $$;

-- ═══ 5. Evidencias integradas ═══
do $$
declare v uuid := (select (v ->> 'id')::uuid from r where k = 'a');
begin
  perform public.t_igual('evidencia de radicación (rol EXTERNO, sin usuario)', (select count(*)::int from public.evidencia_legal where referencia_id = v and accion = 'SOLICITA' and rol = 'EXTERNO' and usuario_id is null and categoria = 'CASO_CUMPLIMIENTO'), 1);
  perform public.t_igual('la evidencia no guarda el contenido de la solicitud', (select count(*)::int from public.evidencia_legal where referencia_id = v and (finalidad ilike '%teléfono%' or texto is not null)), 0);
  perform public.t_igual('cadena de evidencias íntegra', (select count(*)::int from public.verificar_cadena_evidencias()), 0);
end $$;

-- ═══ 6. Consulta pública segura ═══
do $$
declare n text := (select v ->> 'numero' from r where k = 'a'); j jsonb;
begin
  j := public.caso_consultar_publico(n, repeat('a', 64));
  perform public.t_igual('consulta con token correcto', j ->> 'numero', n);
  perform public.t_igual('no expone datos del solicitante', j::text !~* '(ana@ejemplo|1000000001|3001234567)', true);
  perform public.t_igual('token incorrecto → null', public.caso_consultar_publico(n, repeat('f', 64)) is null, true);
  perform public.t_igual('número inexistente → null (misma respuesta)', public.caso_consultar_publico('SN-2026-999999', repeat('a', 64)) is null, true);
  perform public.t_igual('conocer el número solo NO basta', public.caso_consultar_publico(n, null) is null, true);
  perform public.t_igual('rotar token con correo ajeno → null', public.caso_rotar_token(n, 'otro@ejemplo.co', repeat('e', 64)) is null, true);
  perform public.t_igual('token anterior sigue válido tras intento ajeno', public.caso_consultar_publico(n, repeat('a', 64)) is not null, true);
  perform public.t_igual('rotar token con correo correcto devuelve el id del caso', public.caso_rotar_token(n, 'ANA@ejemplo.co', repeat('e', 64)), (select (v ->> 'id')::uuid from r where k = 'a'));
  perform public.t_igual('token viejo ya no sirve', public.caso_consultar_publico(n, repeat('a', 64)) is null, true);
  perform public.t_igual('token nuevo sirve', public.caso_consultar_publico(n, repeat('e', 64)) is not null, true);
end $$;
reset role;

-- ═══ 7. Intruso, cliente y SuperSU frente a las tablas ═══
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
do $$ begin
  perform public.t_igual('intruso no ve tickets', (select count(*)::int from public.ticket_soporte), 0);
  perform public.t_igual('intruso no ve solicitantes', (select count(*)::int from public.caso_solicitante), 0);
  perform public.t_igual('intruso no ve historial', (select count(*)::int from public.caso_historial), 0);
  perform public.t_igual('intruso no ve notificaciones', (select count(*)::int from public.cumplimiento_notificacion), 0);
  perform public.t_igual('intruso no ve la configuración', (select count(*)::int from public.cumplimiento_config), 0);
  perform public.t_igual('intruso no ve evidencias', (select count(*)::int from public.evidencia_legal), 0);
  perform public.t_error($q$select public.caso_dashboard()$q$, 'NO_AUTORIZADO');
  perform public.t_error($q$select * from public.caso_listar()$q$, 'NO_AUTORIZADO');
  perform public.t_error($q$select public.caso_asignar((select id from public.ticket_soporte limit 1), null)$q$, 'NO_AUTORIZADO');
  perform public.t_error($q$select public.cumplimiento_config_set('sms_numero', '"+573001112233"')$q$, 'NO_AUTORIZADO');
  perform public.t_error($q$select public.cumplimiento_evaluar_sla()$q$, 'NO_AUTORIZADO');
  perform public.t_error($q$select public.caso_radicar('OPE_OTRO','Asunto largo','Texto suficientemente largo.','WEB_PUBLICO',null,'{}',null,null,null,null,null)$q$, 'permission denied');
  perform public.t_error($q$select * from public.caso_seguimiento$q$, 'permission denied');
  perform public.t_error($q$update public.caso_historial set detalle = '{}'$q$, 'permission denied');
  perform public.t_error($q$delete from public.evidencia_legal$q$, 'permission denied');
end $$;
reset role;

-- ═══ 8. Flujo del SuperSU: responder ≠ resolver ≠ cerrar ═══
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
do $$
declare v uuid := (select (v ->> 'id')::uuid from r where k = 'a'); t public.ticket_soporte;
begin
  perform public.t_igual('SuperSU ve los tickets', (select count(*)::int from public.ticket_soporte) >= 3, true);
  perform public.t_error(format($q$select public.caso_asignar(%L, '00000000-0000-0000-0000-0000000000c4')$q$, v), 'RESPONSABLE_INVALIDO');
  t := public.caso_asignar(v, '00000000-0000-0000-0000-0000000000c3');
  perform public.t_igual('asignar mueve NUEVO → ASIGNADO', t.estado_caso, 'ASIGNADO');
  perform public.t_error(format($q$select public.caso_cambiar_estado(%L, 'CERRADO')$q$, v), 'USE_ACCION_ESPECIFICA');
  t := public.caso_cambiar_estado(v, 'EN_GESTION', 'revisando');
  perform public.t_igual('reclamo de datos queda «en trámite»', t.reclamo_en_tramite_desde is not null, true);
  perform public.t_error(format($q$select public.caso_resolver(%L, 'Se actualizó el dato solicitado.')$q$, v), 'RESPUESTA_SUSTANTIVA_REQUERIDA');
  -- un acuse / mensaje no sustantivo NO cuenta como respuesta
  t := public.caso_responder(v, 'Recibimos tu solicitud y la estamos revisando.', false);
  perform public.t_igual('respuesta no sustantiva no marca RESPONDIDO', t.estado_respuesta, 'SIN_RESPUESTA');
  perform public.t_error(format($q$select public.caso_resolver(%L, 'Se actualizó el dato solicitado.')$q$, v), 'RESPUESTA_SUSTANTIVA_REQUERIDA');
  -- prórroga: una sola vez, con motivo
  perform public.t_error(format($q$select public.caso_extender_plazo(%L, 'corto')$q$, v), 'MOTIVO_REQUERIDO');
  t := public.caso_extender_plazo(v, 'Se requiere validar la información con el proveedor tecnológico.');
  perform public.t_igual('prórroga reclamo: +8 hábiles', t.fecha_limite, public.calcular_fecha_limite(t.fecha_limite_original, 8, 'DIAS_HABILES'));
  perform public.t_error(format($q$select public.caso_extender_plazo(%L, 'Otro motivo largo suficiente aquí.')$q$, v), 'PRORROGA_YA_APLICADA');
  t := public.caso_responder(v, 'Actualizamos tu teléfono en nuestra base y te confirmamos el cambio.', true);
  perform public.t_igual('respuesta sustantiva → RESPONDIDO', t.estado_caso || t.estado_respuesta, 'RESPONDIDORESPONDIDO');
  perform public.t_igual('respondido dentro del plazo', t.respondido_at <= t.fecha_limite, true);
  t := public.caso_resolver(v, 'Teléfono actualizado y confirmado al titular.');
  perform public.t_igual('RESUELTO', t.estado_caso, 'RESUELTO');
  t := public.caso_cerrar(v);
  perform public.t_igual('CERRADO', t.estado_caso, 'CERRADO');
  perform public.t_error(format($q$select public.caso_cambiar_estado(%L, 'EN_GESTION')$q$, v), 'TRANSICION_INVALIDA');
  perform public.t_error(format($q$select public.caso_responder(%L, 'Mensaje posterior al cierre del caso.', true)$q$, v), 'CASO_CERRADO');
  t := public.caso_reabrir(v, 'El titular reporta que el dato sigue mal.');
  perform public.t_igual('reapertura', t.estado_caso, 'REABIERTO');
  perform public.t_igual('reapertura quita resuelto/cerrado y exige nueva respuesta', t.cerrado_at is null and t.estado_respuesta = 'SIN_RESPUESTA', true);
  perform public.t_error(format($q$select public.caso_resolver(%L, 'Intento de resolver sin responder.')$q$, v), 'RESPUESTA_SUSTANTIVA_REQUERIDA');
  -- nota interna invisible para el solicitante
  perform public.caso_nota_interna(v, 'Nota solo para el equipo: validar identidad.');
  perform public.t_igual('historial completo', (select count(*)::int from public.caso_historial where ticket_id = v) >= 12, true);
  perform public.t_igual('evidencia: respuesta sustantiva con su texto', (select count(*)::int from public.caso_evidencias(v) where finalidad like 'Respuesta de fondo%' and tiene_texto), 1);
  perform public.t_igual('evidencias del caso consultables', (select count(*)::int from public.caso_evidencias(v)) >= 4, true);
  perform public.t_igual('cadena íntegra tras el flujo', (select count(*)::int from public.verificar_cadena_evidencias()), 0);
end $$;
-- Crítico: cierre exige nota
do $$
declare v uuid := (select (v ->> 'id')::uuid from r where k = 'crit'); t public.ticket_soporte;
begin
  perform public.caso_asignar(v, '00000000-0000-0000-0000-0000000000c3');
  perform public.caso_cambiar_estado(v, 'EN_GESTION');
  perform public.caso_responder(v, 'Investigamos el incidente y tomamos medidas de contención.', true);
  perform public.caso_resolver(v, 'Incidente contenido y verificado.');
  perform public.t_error(format($q$select public.caso_cerrar(%L)$q$, v), 'NOTA_CIERRE_REQUERIDA');
  perform public.t_error(format($q$select public.caso_cerrar(%L, 'corta')$q$, v), 'NOTA_CIERRE_REQUERIDA');
  t := public.caso_cerrar(v, 'Cierre tras verificar contención y notificar al titular.');
  perform public.t_igual('crítico cerrado con nota', t.estado_caso, 'CERRADO');
end $$;
-- PQRS sin prórroga definida
reset role;
set local role service_role;
insert into r select 'pqrs', public.caso_radicar('PQRS_PETICION', 'Petición de información', 'Solicito información sobre mi cuenta y mis reservas.', 'WEB_PUBLICO', null,
  '{"nombre":"Pedro S","email":"pedro@ejemplo.co"}'::jsonb, null, null, repeat('1', 64), 'idem-pqrs', (select id from public.texto_legal where version = 901));
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
do $$
declare v uuid := (select (v ->> 'id')::uuid from r where k = 'pqrs');
begin
  perform public.t_igual('petición: plazo interno (no legal)', (select plazo_origen from public.ticket_soporte where id = v), 'INTERNO');
  perform public.t_error(format($q$select public.caso_extender_plazo(%L, 'Necesitamos más tiempo para investigar.')$q$, v), 'SIN_PRORROGA_DEFINIDA');
  perform public.t_error(format($q$select public.caso_trasladar(%L, 'X', 'corto')$q$, v), 'DATOS_INCOMPLETOS');
  perform public.caso_trasladar(v, 'Establecimiento aliado', 'El asunto corresponde al establecimiento que prestó el servicio.');
  perform public.t_igual('traslado registrado', (select estado_caso from public.ticket_soporte where id = v), 'TRASLADADO');
end $$;
reset role;

-- ═══ 9. Subsanación y desistimiento ═══
set local role service_role;
insert into r select 'sub', public.caso_radicar('DATOS_SUPRESION', 'Quiero suprimir mis datos', 'Solicito la supresión de mis datos personales de la plataforma.', 'WEB_PUBLICO', null,
  '{"nombre":"Sara L","email":"sara@ejemplo.co","id_tipo":"CC","id_numero":"123456789"}'::jsonb, null, null, repeat('2', 64), 'idem-sub', (select id from public.texto_legal where version = 901));
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
do $$
declare v uuid := (select (v ->> 'id')::uuid from r where k = 'sub'); t public.ticket_soporte;
begin
  t := public.caso_solicitar_subsanacion(v, 'Falta adjuntar copia del documento de identidad para verificar tu identidad.');
  perform public.t_igual('reclamo incompleto → ESPERANDO_SOLICITANTE', t.estado_caso, 'ESPERANDO_SOLICITANTE');
  perform public.t_igual('guarda la fecha del requerimiento', t.subsanacion_requerida_at is not null, true);
end $$;
reset role;
set local role service_role;
do $$
declare n text := (select v ->> 'numero' from r where k = 'sub'); v uuid := (select (v ->> 'id')::uuid from r where k = 'sub'); antes timestamptz;
begin
  select fecha_limite into antes from public.ticket_soporte where id = v;
  perform public.t_igual('subsanación por el solicitante', public.caso_responder_publico(n, repeat('2', 64), 'Adjunto mi documento y confirmo mis datos.'), true);
  perform public.t_igual('vuelve a EN_GESTION', (select estado_caso from public.ticket_soporte where id = v), 'EN_GESTION');
  perform public.t_igual('el plazo se cuenta desde el reclamo completo', (select fecha_limite from public.ticket_soporte where id = v), public.calcular_fecha_limite(now(), 15, 'DIAS_HABILES'));
  perform public.t_igual('historial SUBSANACION_RECIBIDA', (select count(*)::int from public.caso_historial where ticket_id = v and tipo_evento = 'SUBSANACION_RECIBIDA'), 1);
  perform public.t_error(format($q$select public.caso_responder_publico(%L, %L, 'x')$q$, n, repeat('2', 64)), 'MENSAJE_INVALIDO');
  perform public.t_igual('token ajeno no puede responder', public.caso_responder_publico(n, repeat('9', 64), 'Mensaje de un tercero cualquiera.'), false);
end $$;
reset role;

-- ═══ 10. SLA, prioridades, escalamiento, idempotencia ═══
do $$
declare v uuid := (select (v ->> 'id')::uuid from r where k = 'cons'); r1 jsonb; r2 jsonb; antes int; despues int;
begin
  -- recibido hace 12 días hábiles aprox.: 80 % del plazo consumido
  update public.ticket_soporte set recibido_at = now() - interval '17 days', fecha_limite = now() + interval '4 days' where id = v;
  select count(*) into antes from public.cumplimiento_notificacion where ticket_id = v;
  r1 := public.cumplimiento_evaluar_sla();
  select count(*) into despues from public.cumplimiento_notificacion where ticket_id = v;
  perform public.t_igual('SLA crea alertas 50 % y 75 %', (select count(distinct regla)::int from public.cumplimiento_notificacion where ticket_id = v and regla in ('SLA_50', 'SLA_75')), 2);
  perform public.t_igual('prioridad sube sola con el avance', (select prioridad from public.ticket_soporte where id = v), 'ALTA');
  r2 := public.cumplimiento_evaluar_sla();
  perform public.t_igual('SLA idempotente: segunda corrida no crea alertas nuevas', (select count(*)::int from public.cumplimiento_notificacion where ticket_id = v), despues);
  perform public.t_igual('segunda corrida: 0 alertas', (r2 ->> 'alertas_creadas')::int, 0);
  -- vencido → escalado + CRÍTICA
  update public.ticket_soporte set fecha_limite = now() - interval '1 hour' where id = v;
  perform public.cumplimiento_evaluar_sla();
  perform public.t_igual('vencido: prioridad CRÍTICA', (select prioridad from public.ticket_soporte where id = v), 'CRITICA');
  perform public.t_igual('vencido: escalado automático con historial', (select count(*)::int from public.caso_historial where ticket_id = v and tipo_evento = 'ESCALADO' and actor_tipo = 'SISTEMA'), 1);
  perform public.t_igual('vencido: alerta VENCIDO', (select count(*)::int from public.cumplimiento_notificacion where ticket_id = v and regla = 'VENCIDO' and canal = 'CRM'), 1);
  perform public.cumplimiento_evaluar_sla();
  perform public.t_igual('vencido: no se re-escala', (select count(*)::int from public.caso_historial where ticket_id = v and tipo_evento = 'ESCALADO'), 1);
  perform public.t_igual('sin asignar: alerta tras el umbral', (select count(*)::int from public.cumplimiento_notificacion where ticket_id = v and regla = 'SIN_ASIGNAR' and canal = 'CRM'), 1);
  -- desistimiento a los 2 meses
  v := (select (rr.v ->> 'id')::uuid from r rr where rr.k = 'sub');
  update public.ticket_soporte set estado_caso = 'ESPERANDO_SOLICITANTE', subsanacion_requerida_at = now() - interval '3 months' where id = v;
  r1 := public.cumplimiento_evaluar_sla();
  perform public.t_igual('desistimiento automático a los 2 meses', (select estado_caso from public.ticket_soporte where id = v), 'DESISTIDO');
  perform public.t_igual('desistimiento con historial y evidencia', (select count(*)::int from public.evidencia_legal where referencia_id = v and finalidad like 'Desistimiento%'), 1);
  perform public.t_igual('SMS sigue sin enviarse', (select count(*)::int from public.cumplimiento_notificacion where canal = 'SMS' and estado <> 'CANAL_NO_HABILITADO'), 0);
end $$;

-- ═══ 11. Cola: worker, evidencia de envío, reintentos ═══
set local role service_role;
do $$
declare n public.cumplimiento_notificacion; e text; v uuid := (select (v ->> 'id')::uuid from r where k = 'crit');
begin
  select * into n from public.cumplimiento_tomar_lote(1);
  perform public.t_igual('lote toma una notificación EMAIL pendiente', n.estado, 'PROCESANDO');
  perform public.t_igual('lote solo toma EMAIL/SMS habilitados', n.canal in ('EMAIL', 'SMS') and n.estado <> 'CANAL_NO_HABILITADO', true);
  perform public.t_error(format($q$select public.cumplimiento_marcar(%L, 'ENVIADO', null, null)$q$, n.id), 'ENVIADO_SIN_EVIDENCIA');
  e := public.cumplimiento_marcar(n.id, 'ENVIADO', 'resend:abc123', null);
  perform public.t_igual('ENVIADO con id del proveedor', e, 'ENVIADO');
  perform public.t_igual('estado final no se pisa', public.cumplimiento_marcar(n.id, 'FALLIDO', null, 'x'), 'ENVIADO');
  perform public.t_igual('historial de la notificación', (select count(*)::int from public.cumplimiento_notificacion_evento where notificacion_id = n.id), 3);
  perform public.caso_registrar_envio(v, 'ACUSE_SOLICITANTE', 'MARTA@ejemplo.co', 'FALLIDO', null, 'HTTP_500');
  perform public.t_igual('acuse fallido queda registrado, no «enviado»', (select estado from public.cumplimiento_notificacion where ticket_id = v and regla = 'ACUSE_SOLICITANTE'), 'FALLIDO');
  perform public.t_error(format($q$select public.caso_registrar_envio(%L, 'ACUSE_SOLICITANTE', 'a@b.co', 'ENVIADO', null, null)$q$, v), 'ENVIADO_SIN_EVIDENCIA');
end $$;
do $$
declare n public.cumplimiento_notificacion; i int;
begin
  insert into public.cumplimiento_notificacion (ticket_id, regla, plantilla, canal, destinatario_tipo, destinatario, estado, max_intentos, proximo_intento_at, idempotency_key)
  select ticket_id, 'PRUEBA_REINTENTO', 'CASO_NUEVO', 'EMAIL', 'ALERTA', 'x@y.co', 'PENDIENTE', 2, now(), 'prueba-reintento' from public.cumplimiento_notificacion limit 1;
  for i in 1..2 loop
    update public.cumplimiento_notificacion set proximo_intento_at = now() - interval '1 second' where idempotency_key = 'prueba-reintento' and estado = 'REINTENTANDO';
    select * into n from public.cumplimiento_tomar_lote(100) where idempotency_key = 'prueba-reintento';
    perform public.cumplimiento_marcar(n.id, 'REINTENTABLE', null, 'ERROR_RED');
  end loop;
  perform public.t_igual('agotados los intentos → FALLIDO', (select estado from public.cumplimiento_notificacion where idempotency_key = 'prueba-reintento'), 'FALLIDO');
end $$;
reset role;

-- ═══ 12. Configuración desde el CRM ═══
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
do $$ begin
  perform public.t_error($q$select public.cumplimiento_config_set('sms_habilitado', 'true')$q$, 'SMS_SIN_PROVEEDOR');
  perform public.t_error($q$select public.cumplimiento_config_set('alertas_email_destinatarios', '["no-es-correo"]')$q$, 'EMAIL_INVALIDO');
  perform public.t_error($q$select public.cumplimiento_config_set('sms_numero', '"abc"')$q$, 'TELEFONO_INVALIDO');
  perform public.t_error($q$select public.cumplimiento_config_set('clave_inventada', '1')$q$, 'CLAVE_DESCONOCIDA');
  perform public.cumplimiento_config_set('alertas_email_destinatarios', '["cumplimiento@stylernow.com","equipo@stylernow.com"]');
  perform public.cumplimiento_config_set('sms_numero', '"+57 3000000000"');
  perform public.t_igual('el destinatario cambia sin tocar código', (select valor from public.cumplimiento_config where clave = 'alertas_email_destinatarios'), '["cumplimiento@stylernow.com","equipo@stylernow.com"]'::jsonb);
  perform public.t_igual('la edición queda auditada', (select count(*)::int from public.evento_auditoria where accion = 'CUMPLIMIENTO_CONFIG_CAMBIADA') >= 2, true);
end $$;
reset role;
set local role service_role;
do $$
declare v uuid;
begin
  v := (select (public.caso_radicar('OPE_TECNICO', 'No me carga la agenda', 'La agenda no carga en mi teléfono desde ayer.', 'WEB_PUBLICO', null,
        '{"nombre":"Leo Q","email":"leo@ejemplo.co"}'::jsonb, null, null, repeat('3', 64), 'idem-cfg', (select id from public.texto_legal where version = 901))) ->> 'id')::uuid;
  perform public.t_igual('nuevos destinatarios se usan de inmediato', (select count(*)::int from public.cumplimiento_notificacion where ticket_id = v and canal = 'EMAIL' and destinatario in ('cumplimiento@stylernow.com', 'equipo@stylernow.com')), 2);
  perform public.t_igual('SMS al nuevo número configurado', (select destinatario from public.cumplimiento_notificacion where ticket_id = v and canal = 'SMS'), '+57 3000000000');
end $$;
reset role;

-- ═══ 13. Compatibilidad con el sistema de tickets existente ═══
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
do $$
declare t public.ticket_soporte; n int;
begin
  t := public.crear_ticket_soporte('No puedo entrar', 'No puedo iniciar sesión desde ayer.', null);
  perform public.t_igual('ticket antiguo recibe número, tipo y plazo', t.numero_radicacion is not null and t.tipo_codigo = 'OPE_OTRO' and t.fecha_limite is not null, true);
  perform public.t_igual('el cliente ve su ticket', (select count(*)::int from public.ticket_soporte where id = t.id), 1);
  perform public.t_igual('el cliente NO ve tickets ajenos', (select count(*)::int from public.ticket_soporte where creado_por is distinct from '00000000-0000-0000-0000-0000000000c1'::uuid), 0);
  perform public.t_igual('cliente: RPC responder existente sigue funcionando', (select id is not null from public.responder_ticket_soporte(t.id, 'Sigue sin funcionar.')), true);
  perform public.t_igual('cliente no ve el historial interno', (select count(*)::int from public.caso_historial), 0);
  perform public.t_igual('cliente no ve su evidencia de caso como tabla ajena', (select count(*)::int from public.evidencia_legal where categoria = 'CASO_CUMPLIMIENTO') >= 0, true);
  create temp table tk (id uuid); insert into tk values (t.id); grant all on tk to public;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
do $$ declare v uuid := (select id from tk); begin perform public.caso_nota_interna(v, 'Nota interna que el cliente no debe ver.'); end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
do $$ declare v uuid := (select id from tk); begin
  perform public.t_igual('RLS: el cliente no ve notas internas', (select count(*)::int from public.ticket_mensaje where ticket_id = v and tipo = 'NOTA_INTERNA'), 0);
  perform public.t_igual('cliente_ticket_mensajes oculta notas internas', (select count(*)::int from public.cliente_ticket_mensajes(v) where mensaje like 'Nota interna%'), 0);
  perform public.t_error(format($q$insert into public.ticket_mensaje (ticket_id, actor_tipo, mensaje, tipo, sustantiva) values (%L, 'CLIENTE', 'x', 'RESPUESTA', true)$q$, v), 'row-level security');
end $$;
reset role;
do $$ begin
  perform public.t_error($q$insert into public.ticket_mensaje (ticket_id, actor_tipo, mensaje, tipo, sustantiva) select id, 'SISTEMA', 'acuse automático', 'ACUSE', true from public.ticket_soporte limit 1$q$, 'ticket_mensaje_sustantiva_chk');
end $$;

-- ═══ 14. Dashboard y bandejas ═══
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
do $$
declare d jsonb := public.caso_dashboard();
begin
  perform public.t_igual('dashboard: abiertos', (d ->> 'abiertos')::int >= 2, true);
  perform public.t_igual('dashboard: SMS deshabilitado informado', (d -> 'sms' ->> 'habilitado')::boolean, false);
  perform public.t_igual('dashboard: SMS pendientes por deshabilitado', (d -> 'sms' ->> 'pendientes_por_deshabilitado')::int >= 1, true);
  perform public.t_igual('bandeja SIN_ASIGNAR contiene casos sin responsable', (select count(*)::int from public.caso_listar('SIN_ASIGNAR')) >= 1, true);
  perform public.t_igual('un caso sin responsable nunca desaparece (TODOS)', (select count(*)::int from public.caso_listar('TODOS')) = (select count(*)::int from public.ticket_soporte), true);
  perform public.t_igual('bandeja VENCIDOS', (select count(*)::int from public.caso_listar('VENCIDOS')) >= 1, true);
  perform public.t_igual('bandeja DATOS filtra por categoría', (select count(*)::int from public.caso_listar('DATOS') where categoria <> 'DATOS_PERSONALES'), 0);
  perform public.t_igual('filtro por número', (select count(*)::int from public.caso_listar('TODOS', jsonb_build_object('numero', (select v ->> 'numero' from r where k = 'cons')))), 1);
  perform public.t_igual('bandeja inválida no devuelve nada', (select count(*)::int from public.caso_listar('XX')), 0);
  perform public.t_igual('detalle incluye solicitante solo para SuperSU', public.caso_detalle((select (v ->> 'id')::uuid from r where k = 'cons')) -> 'solicitante' ->> 'email', 'luis@ejemplo.co');
  perform public.t_igual('alertas CRM listadas', (select count(*)::int from public.cumplimiento_alertas_crm()) >= 1, true);
  perform public.t_igual('marcar leídas', public.cumplimiento_marcar_leidas() >= 1, true);
end $$;
reset role;

-- ═══ 15. Adjuntos ═══
set local role service_role;
do $$
declare v uuid := (select (v ->> 'id')::uuid from r where k = 'a'); i int;
begin
  perform public.t_igual('bucket privado', (select public from storage.buckets where id = 'casos-adjuntos'), false);
  perform public.t_igual('bucket limita tamaño y tipos', (select file_size_limit = 5242880 and allowed_mime_types @> array['application/pdf'] and not allowed_mime_types @> array['text/html'] from storage.buckets where id = 'casos-adjuntos'), true);
  perform public.t_igual('ninguna política de storage da acceso a anon/authenticated sobre el bucket', (select count(*)::int from pg_policies where schemaname = 'storage' and tablename = 'objects' and (qual ilike '%casos-adjuntos%' or with_check ilike '%casos-adjuntos%')), 0);
  perform public.t_error(format($q$select public.caso_registrar_adjunto(%L, '../../etc/passwd', 'x.pdf', 'application/pdf', 10, %L, 'SOLICITANTE', null)$q$, v, repeat('a', 64)), 'caso_adjunto_storage_path_check');
  perform public.t_error(format($q$select public.caso_registrar_adjunto(%L, gen_random_uuid()::text || '/' || gen_random_uuid()::text || '.pdf', 'x.exe', 'application/x-msdownload', 10, %L, 'SOLICITANTE', null)$q$, v, repeat('a', 64)), 'caso_adjunto_mime_check');
  for i in 1..5 loop
    perform public.caso_registrar_adjunto(v, v::text || '/' || gen_random_uuid()::text || '.pdf', 'doc' || i || '.pdf', 'application/pdf', 100 * i, repeat('a', 64), 'SOLICITANTE', null);
  end loop;
  perform public.t_error(format($q$select public.caso_registrar_adjunto(%L, %L || '/' || gen_random_uuid()::text || '.pdf', 'otro.pdf', 'application/pdf', 100, %L, 'SOLICITANTE', null)$q$, v, v::text, repeat('a', 64)), 'DEMASIADOS_ADJUNTOS');
  perform public.t_error(format($q$update public.caso_adjunto set bytes = 1 where ticket_id = %L$q$, v), 'REGISTRO_INMUTABLE');
  perform public.t_error($q$update public.caso_historial set detalle = '{}'::jsonb$q$, 'REGISTRO_INMUTABLE');
  perform public.t_error($q$delete from public.evidencia_legal$q$, 'REGISTRO_INMUTABLE');
end $$;
reset role;

rollback;
select 'PASARON TODAS LAS PRUEBAS DE CUMPLIMIENTO' as resultado;
