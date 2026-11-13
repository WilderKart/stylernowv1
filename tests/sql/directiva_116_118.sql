-- Pruebas de comportamiento de las migraciones 116, 117 y 118 (Directiva Única Integral).
--
-- Se corren contra la base LOCAL (supabase start), nunca contra producción:
--   docker exec -i supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 < tests/sql/directiva_116_118.sql
-- Todo ocurre dentro de una transacción que termina en ROLLBACK: no deja datos.
-- Cada bloque lanza 'FALLA: …' si el comportamiento no es el esperado; ON_ERROR_STOP corta en el primero.

begin;

-- Paridad con producción: allí service_role tiene todos los privilegios de tabla y
-- authenticated lee con RLS (default privileges de Supabase). La CLI local nueva no los
-- otorga, así que se emulan aquí. Con esto, la inmutabilidad se prueba contra los TRIGGERS
-- (última barrera), no solo contra la falta de permisos.
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant select on all tables in schema public to authenticated;

-- ── Datos de prueba (como postgres) ─────────────────────────────────────────
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'dueno@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a2', 'cliente@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a3', 'intruso@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a4', 'su@test.local', 'authenticated', 'authenticated');

insert into public.perfil (id, nombre) values
  ('00000000-0000-0000-0000-0000000000a1', 'Dueño'), ('00000000-0000-0000-0000-0000000000a2', 'Cliente'),
  ('00000000-0000-0000-0000-0000000000a3', 'Intruso'), ('00000000-0000-0000-0000-0000000000a4', 'SuperSU')
on conflict (id) do nothing;
update public.perfil set es_supersu = true where id = '00000000-0000-0000-0000-0000000000a4';

insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo, comision_plataforma_pct)
values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'Barbería Test', 'barberia-test-dir', 'Cali', 'CO', 12);

do $$ begin
  if (select comision_plataforma_pct from public.negocio where id = '00000000-0000-0000-0000-0000000000b1') <> 0 then
    raise exception 'FALLA 117: un negocio nuevo debe nacer con la comisión default (0 %%), no con la que envía el cliente';
  end if;
  raise notice 'OK 117: negocio nuevo con comisión 0 %%';
end $$;

insert into public.sede (id, negocio_id, nombre, direccion, ciudad)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', 'Principal', 'Cra 1', 'Cali');

-- Habilita reservas (el trigger de plan las bloquea sin suscripción vigente).
update public.suscripcion set estado = 'ACTIVA' where negocio_id = '00000000-0000-0000-0000-0000000000b1';

-- Cuenta de Mercado Pago del negocio conectada (migración 119: sin ella no hay anticipo en línea).
insert into public.conexion_pago_negocio (negocio_id, estado, entorno, cuenta_externa_id, access_token_cifrado, token_expira_at, conectada_at)
values ('00000000-0000-0000-0000-0000000000b1', 'CONECTADA', 'SANDBOX', '123456789', 'v1.iv.tag.datos', now() + interval '180 days', now());

insert into public.reserva (id, cliente_id, negocio_id, sede_id, hora_inicio, hora_fin, estado, monto_total, monto_sena) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b1',
   '00000000-0000-0000-0000-0000000000c1', now() + interval '10 hours', now() + interval '11 hours', 'PENDIENTE_PAGO', 50000, 10000),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b1',
   '00000000-0000-0000-0000-0000000000c1', now() + interval '30 hours', now() + interval '31 hours', 'PENDIENTE_PAGO', 50000, 10000),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b1',
   '00000000-0000-0000-0000-0000000000c1', now() + interval '50 hours', now() + interval '51 hours', 'PENDIENTE_PAGO', 50000, 10000);

-- ── 116: el pago del anticipo exige aceptación previa ──────────────────────
do $$ begin
  begin
    insert into public.pago (reserva_id, negocio_id, tipo, monto, estado)
    values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b1', 'SENA', 10000, 'PENDIENTE');
    raise exception 'FALLA 116: se creó un pago de anticipo sin aceptación de la política';
  exception when others then
    if sqlerrm not like '%POLITICA_NO_ACEPTADA%' then raise; end if;
  end;
  raise notice 'OK 116: sin aceptación no nace el pago';
end $$;

-- ── 116: aceptación como el cliente autenticado ─────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
do $$ begin
  begin
    perform public.aceptar_politica_reserva('00000000-0000-0000-0000-0000000000d1');
    raise exception 'FALLA 116: un tercero aceptó la política de una reserva ajena';
  exception when others then
    if sqlerrm not like '%RESERVA_NO_ENCONTRADA%' then raise; end if;
  end;
  raise notice 'OK 116: un tercero no puede aceptar por otro';
end $$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
do $$
declare a uuid; b uuid;
begin
  a := public.aceptar_politica_reserva('00000000-0000-0000-0000-0000000000d1');
  b := public.aceptar_politica_reserva('00000000-0000-0000-0000-0000000000d1');
  if a is distinct from b then raise exception 'FALLA 116: la aceptación no es idempotente'; end if;
  perform public.aceptar_politica_reserva('00000000-0000-0000-0000-0000000000d2');
  perform public.aceptar_politica_reserva('00000000-0000-0000-0000-0000000000d3');
  raise notice 'OK 116: aceptación idempotente por reserva';
end $$;

do $$ begin
  begin
    insert into public.aceptacion_politica_reserva (reserva_id, cliente_id, negocio_id, politica, texto_aceptado, version_politica, zona_horaria, monto_sena, hora_inicio_reserva)
    values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b1', '{}', 'x', 'x', 'UTC', 0, now());
    raise exception 'FALLA 116: authenticated insertó evidencia directamente';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK 116: la evidencia solo la escribe la función';
end $$;
reset role;

-- La evidencia es inmutable incluso para service_role.
set local role service_role;
do $$ begin
  begin
    update public.aceptacion_politica_reserva set texto_aceptado = 'otro' where reserva_id = '00000000-0000-0000-0000-0000000000d1';
    raise exception 'FALLA 116: service_role modificó la evidencia de aceptación';
  exception when others then
    if sqlerrm not like '%REGISTRO_INMUTABLE%' and sqlstate <> '42501' then raise; end if;
  end;
  raise notice 'OK 116: evidencia inmutable';
end $$;
reset role;

-- Pagos aprobados y reservas confirmadas (lo que haría aplicar_evento_pago).
insert into public.pago (id, reserva_id, negocio_id, tipo, monto, estado, id_transaccion_pasarela, comision_plataforma_monto) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b1', 'SENA', 10000, 'APROBADO', '9000001', 0),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000b1', 'SENA', 10000, 'APROBADO', '9000002', 0),
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000b1', 'SENA', 10000, 'APROBADO', '9000003', 0);
update public.reserva set estado = 'CONFIRMADA' where id in ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000d3');

-- ── 116: límites de la política ─────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
do $$ begin
  begin
    perform public.configurar_politica_cancelacion('00000000-0000-0000-0000-0000000000b1', 500, 2, 50);
    raise exception 'FALLA 116: se aceptó una ventana fuera de los límites globales';
  exception when others then
    if sqlerrm not like '%POLITICA_FUERA_DE_LIMITES%' then raise; end if;
  end;
  begin
    perform public.configurar_politica_cancelacion('00000000-0000-0000-0000-0000000000b1', 24, 2, 150);
    raise exception 'FALLA 116: se aceptó un porcentaje > 100';
  exception when others then
    if sqlerrm not like '%POLITICA_FUERA_DE_LIMITES%' and sqlerrm not like '%negocio_reembolso_parcial_pct_rango%' then raise; end if;
  end;
  -- Cambio válido DESPUÉS de que el cliente aceptó 24 h / 2 h / 50 %: no debe afectar sus reservas.
  perform public.configurar_politica_cancelacion('00000000-0000-0000-0000-0000000000b1', 6, 1, 80, 'prueba');
  raise notice 'OK 116: límites de la política aplicados';
end $$;
reset role;

-- ── 116: cancelación por el cliente usa la política ACEPTADA ───────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
do $$
declare r jsonb;
begin
  -- d1: faltan ~10 h. Aceptó 24/2/50 → 50 %. Con la política nueva (6 h) habría sido 100 %.
  r := public.cancelar_reserva('00000000-0000-0000-0000-0000000000d1', null);
  if (r->>'reembolso_pct')::numeric <> 50 or (r->>'reembolso_monto')::numeric <> 5000 then
    raise exception 'FALLA 116: se esperaba 50 %% / 5000 con la política aceptada, llegó %', r;
  end if;
  if r->>'reembolso_id' is null then raise exception 'FALLA 116: no se encoló el reembolso'; end if;
  -- d3: faltan ~50 h ≥ 24 → 100 %.
  r := public.cancelar_reserva('00000000-0000-0000-0000-0000000000d3', null);
  if (r->>'reembolso_pct')::numeric <> 100 then raise exception 'FALLA 116: ≥ 24 h debe ser 100 %%, llegó %', r; end if;
  begin
    perform public.cancelar_reserva('00000000-0000-0000-0000-0000000000d1', null);
    raise exception 'FALLA 116: se canceló dos veces';
  exception when others then
    if sqlerrm not like '%RESERVA_NO_CANCELABLE%' then raise; end if;
  end;
  raise notice 'OK 116: ventanas exactas con la política aceptada';
end $$;
reset role;

-- ── 116: worker de reembolsos y máquina de estados ─────────────────────────
set local role service_role;
do $$
declare n int; v text; v_pago public.pago; r public.reembolso; v_wallet_antes int; v_wallet_desp int;
begin
  select count(*) into n from public.reembolso_tomar_pendientes(10);
  if n <> 2 then raise exception 'FALLA 116: se esperaban 2 reembolsos pendientes, hubo %', n; end if;

  select * into r from public.reembolso where pago_id = '00000000-0000-0000-0000-0000000000e1';
  if r.estado <> 'SOLICITADO' then raise exception 'FALLA 116: estado esperado SOLICITADO, es %', r.estado; end if;

  -- Enviar la solicitud NO es confirmación: "pending" deja PROCESANDO, el pago sigue APROBADO.
  v := public.reembolso_registrar_resultado(r.id, 'pending', '777', null);
  select * into v_pago from public.pago where id = r.pago_id;
  if v <> 'PROCESANDO' or v_pago.estado <> 'APROBADO' then
    raise exception 'FALLA 116: un reembolso pendiente no puede figurar como hecho (% / %)', v, v_pago.estado;
  end if;

  select count(*) into v_wallet_antes from public.wallet_movimiento where referencia_id = r.id;
  v := public.reembolso_registrar_resultado(r.id, 'approved', '777', null);
  v := public.reembolso_registrar_resultado(r.id, 'approved', '777', null);   -- webhook/consulta duplicada
  select count(*) into v_wallet_desp from public.wallet_movimiento where referencia_id = r.id;
  select * into v_pago from public.pago where id = r.pago_id;
  if v <> 'REEMBOLSADO' or v_pago.estado <> 'REEMBOLSADO_PARCIAL' or v_pago.monto_reembolsado <> 5000 then
    raise exception 'FALLA 116: confirmación mal aplicada (% / % / %)', v, v_pago.estado, v_pago.monto_reembolsado;
  end if;
  if v_wallet_desp - v_wallet_antes > 1 then raise exception 'FALLA 116: reverso de wallet duplicado'; end if;
  raise notice 'OK 116: PROCESANDO ≠ REEMBOLSADO; confirmación idempotente';

  -- Fallos repetidos → REQUIERE_REVISION al agotar intentos (max 5).
  select * into r from public.reembolso where pago_id = '00000000-0000-0000-0000-0000000000e3';
  v := public.reembolso_registrar_resultado(r.id, null, null, 'saldo insuficiente');
  if v <> 'FALLIDO' then raise exception 'FALLA 116: error de pasarela debe dejar FALLIDO, quedó %', v; end if;
  select * into v_pago from public.pago where id = r.pago_id;
  if v_pago.estado <> 'APROBADO' then raise exception 'FALLA 116: un reembolso fallido no puede cambiar el pago'; end if;
  update public.reembolso set intentos = 5 where id = r.id;
  -- Simula un nuevo intento tomado por el worker.
  update public.reembolso set estado = 'SOLICITADO' where id = r.id;
  v := public.reembolso_registrar_resultado(r.id, null, null, 'saldo insuficiente');
  if v <> 'REQUIERE_REVISION' then raise exception 'FALLA 116: al agotar intentos debe quedar REQUIERE_REVISION, quedó %', v; end if;
  raise notice 'OK 116: fallos trazables y revisión al agotar intentos';
end $$;

do $$ begin
  begin
    update public.reembolso set estado = 'ELEGIBLE' where pago_id = '00000000-0000-0000-0000-0000000000e1';
    raise exception 'FALLA 116: se permitió volver de REEMBOLSADO a ELEGIBLE';
  exception when others then
    if sqlerrm not like '%TRANSICION_REEMBOLSO_INVALIDA%' and sqlstate <> '42501' then raise; end if;
  end;
  begin
    delete from public.reembolso where pago_id = '00000000-0000-0000-0000-0000000000e1';
    raise exception 'FALLA 116: se borró un reembolso';
  exception when others then
    if sqlerrm not like '%REGISTRO_INMUTABLE%' and sqlstate <> '42501' then raise; end if;
  end;
  raise notice 'OK 116: transiciones inválidas y borrado rechazados';
end $$;
reset role;

-- ── 116: no presentación ───────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
do $$ begin
  begin
    perform public.marcar_no_show('00000000-0000-0000-0000-0000000000d2');
    raise exception 'FALLA 116: se marcó no-show antes de la hora';
  exception when others then
    if sqlerrm not like '%NO_SHOW_ANTES_DE_LA_HORA%' then raise; end if;
  end;
  raise notice 'OK 116: no-show solo después de la hora';
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
do $$ begin
  begin
    perform public.marcar_no_show('00000000-0000-0000-0000-0000000000d2');
    raise exception 'FALLA 116: un tercero marcó no-show';
  exception when others then
    if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if;
  end;
  begin
    perform public.configurar_politica_cancelacion('00000000-0000-0000-0000-0000000000b1', 24, 2, 50);
    raise exception 'FALLA 116: un tercero cambió la política de otro negocio';
  exception when others then
    if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if;
  end;
  begin
    perform public.admin_programar_comision(null, 5, now() + interval '1 day', 'x');
    raise exception 'FALLA 117: un no-SuperSU programó comisión';
  exception when others then
    if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if;
  end;
  raise notice 'OK 116/117: aislamiento entre negocios y permisos de admin';
end $$;
reset role;

-- ── 117: libro inmutable ───────────────────────────────────────────────────
-- Garantiza que haya filas: un DELETE sin filas no dispara triggers y la prueba no probaría nada.
insert into public.wallet (negocio_id) select '00000000-0000-0000-0000-0000000000b1'
 where not exists (select 1 from public.wallet where negocio_id = '00000000-0000-0000-0000-0000000000b1');
insert into public.wallet_movimiento (wallet_id, tipo, monto, referencia_tipo, referencia_id)
select id, 'AJUSTE', 1, 'prueba', gen_random_uuid() from public.wallet where negocio_id = '00000000-0000-0000-0000-0000000000b1';
do $$ begin
  if not exists (select 1 from public.evento_auditoria) or not exists (select 1 from public.wallet_movimiento) then
    raise exception 'FALLA preparación: sin filas para probar inmutabilidad';
  end if;
end $$;
set local role service_role;
do $$ begin
  begin
    update public.pago set monto = 1 where id = '00000000-0000-0000-0000-0000000000e2';
    raise exception 'FALLA 117: se modificó el monto de un pago';
  exception when others then
    if sqlerrm not like '%PAGO_CAMPO_INMUTABLE%' then raise; end if;
  end;
  begin
    delete from public.pago where id = '00000000-0000-0000-0000-0000000000e2';
    raise exception 'FALLA 117: se borró un pago';
  exception when others then
    if sqlerrm not like '%REGISTRO_INMUTABLE%' and sqlstate <> '42501' then raise; end if;
  end;
  begin
    delete from public.wallet_movimiento where true;
    raise exception 'FALLA 117: se borraron movimientos del wallet';
  exception when others then
    if sqlerrm not like '%REGISTRO_INMUTABLE%' and sqlstate <> '42501' then raise; end if;
  end;
  begin
    update public.evento_auditoria set motivo = 'x' where true;
    raise exception 'FALLA 117: se alteró la auditoría';
  exception when others then
    if sqlerrm not like '%REGISTRO_INMUTABLE%' and sqlstate <> '42501' then raise; end if;
  end;
  raise notice 'OK 117: pagos, wallet y auditoría inmutables para la API';
end $$;
reset role;

-- ── 117: comisión programada, nunca retroactiva ────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}', true);
do $$ begin
  begin
    perform public.admin_programar_comision('00000000-0000-0000-0000-0000000000b1', 5, now() - interval '1 day', 'retro');
    raise exception 'FALLA 117: se aceptó una comisión retroactiva';
  exception when others then
    if sqlerrm not like '%VIGENCIA_RETROACTIVA_NO_PERMITIDA%' then raise; end if;
  end;
  perform public.admin_programar_comision('00000000-0000-0000-0000-0000000000b1', 5, now(), 'acuerdo comercial');
  raise notice 'OK 117: programación de comisión con vigencia';
end $$;
reset role;
set local role service_role;
do $$ begin
  perform public.aplicar_comisiones_programadas();
  if (select comision_plataforma_pct from public.negocio where id = '00000000-0000-0000-0000-0000000000b1') <> 5 then
    raise exception 'FALLA 117: el cambio programado no se aplicó';
  end if;
  if (select comision_plataforma_monto from public.pago where id = '00000000-0000-0000-0000-0000000000e2') <> 0 then
    raise exception 'FALLA 117: el cambio de comisión reescribió un pago histórico';
  end if;
  raise notice 'OK 117: cambio aplicado a futuro sin tocar pagos históricos';
end $$;
reset role;

-- ── 118: prueba gratuita ───────────────────────────────────────────────────
update public.suscripcion set estado = 'REQUIERE_PLAN' where negocio_id = '00000000-0000-0000-0000-0000000000b1';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
do $$ begin
  begin
    perform public.iniciar_prueba_negocio_srv('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1',
      'STUDIO', 'MENSUAL', null, null, repeat('a', 64), repeat('b', 64), repeat('c', 64), repeat('d', 64));
    raise exception 'FALLA 118: authenticated puede llamar directo a la función de servidor';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK 118: solo el servidor inicia pruebas';
end $$;
reset role;

set local role service_role;
do $$
declare s public.suscripcion;
begin
  begin
    perform public.iniciar_prueba_negocio_srv('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000b1',
      'STUDIO', 'MENSUAL', null, null, repeat('a', 64), repeat('b', 64), repeat('c', 64), repeat('d', 64));
    raise exception 'FALLA 118: un no-dueño inició la prueba';
  exception when others then
    if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if;
  end;
  begin
    perform public.iniciar_prueba_negocio_srv('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1',
      'STUDIO', 'MENSUAL', null, null, 'x', 'y', 'z', 'w');
    raise exception 'FALLA 118: se aceptaron huellas triviales';
  exception when others then
    if sqlerrm not like '%VERIFICACION_INCOMPLETA%' then raise; end if;
  end;

  -- Sin tarjeta y sin cobro recurrente habilitado en CO: debe funcionar (modalidad por defecto).
  s := public.iniciar_prueba_negocio_srv('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1',
      'STUDIO', 'MENSUAL', null, null, repeat('a', 64), repeat('b', 64), repeat('c', 64), repeat('d', 64));
  if s.estado <> 'TRIAL' or s.metodo_pago_ref is not null
     or abs(extract(epoch from (s.prueba_fin - now() - interval '14 days'))) > 60 then
    raise exception 'FALLA 118: prueba sin tarjeta mal creada: %', row_to_json(s);
  end if;
  raise notice 'OK 118: prueba sin tarjeta iniciada (14 días configurables)';

  if exists (select 1 from public.pruebas_por_cobrar() where negocio_id = '00000000-0000-0000-0000-0000000000b1') then
    raise exception 'FALLA 118: una prueba sin tarjeta aparece para cobrar';
  end if;
end $$;
reset role;

-- Vence la prueba (como postgres) y corre el mantenimiento.
update public.suscripcion set prueba_fin = now() - interval '1 minute' where negocio_id = '00000000-0000-0000-0000-0000000000b1';
set local role service_role;
do $$
declare s public.suscripcion;
begin
  perform public.mantenimiento_suscripciones();
  select * into s from public.suscripcion where negocio_id = '00000000-0000-0000-0000-0000000000b1';
  if s.estado <> 'REQUIERE_PLAN' or s.prueba_fin is null then
    raise exception 'FALLA 118: la prueba sin tarjeta vencida debe pasar a REQUIERE_PLAN conservando historial: %', s.estado;
  end if;
  begin
    perform public.iniciar_prueba_negocio_srv('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1',
      'STUDIO', 'MENSUAL', null, null, repeat('a', 64), repeat('b', 64), repeat('c', 64), repeat('d', 64));
    raise exception 'FALLA 118: se repitió la prueba gratuita';
  exception when others then
    if sqlerrm not like '%PRUEBA_YA_USADA%' then raise; end if;
  end;
  raise notice 'OK 118: vencimiento sin cobro y una sola prueba por negocio';
end $$;
reset role;

-- Modalidad CON_TARJETA: sin tarjeta se rechaza.
update public.configuracion_plataforma set prueba_modalidad = 'CON_TARJETA' where id;
insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo)
values ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1', 'Otra', 'otra-test-dir', 'Cali', 'CO');
set local role service_role;
do $$ begin
  begin
    perform public.iniciar_prueba_negocio_srv('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2',
      'STUDIO', 'MENSUAL', null, null, repeat('1', 64), repeat('2', 64), repeat('3', 64), repeat('4', 64));
    raise exception 'FALLA 118: modalidad CON_TARJETA aceptó una prueba sin tarjeta';
  exception when others then
    if sqlerrm not like '%METODO_PAGO_REQUERIDO%' then raise; end if;
  end;
  raise notice 'OK 118: la modalidad la decide Super Admin';
end $$;
reset role;

do $$ begin raise notice 'TODAS LAS PRUEBAS 116-118 PASARON'; end $$;
rollback;
