-- 118 · Prueba gratuita con o sin tarjeta (por defecto SIN tarjeta), configurable desde Super Admin.
--
-- Directiva Única Integral §10, §23 (2026-11-12). Sin aplicar.
--
--  * Duración, modalidad (SIN_TARJETA / CON_TARJETA / AMBAS), días de gracia y días de los
--    avisos pasan de constantes en SQL/TS a `configuracion_plataforma`, con auditoría.
--  * La prueba sin tarjeta NO depende del cobro recurrente: al vencer pasa a REQUIERE_PLAN
--    (no se intenta cobrar ni entra en mora). La prueba con tarjeta sigue exigiendo que el
--    país tenga cobro recurrente habilitado y se cobra al vencer, como hasta ahora.
--  * Cero confianza: la versión anterior (`iniciar_prueba_negocio`) estaba abierta a
--    `authenticated`, así que cualquiera podía llamarla por REST con huellas inventadas
--    y saltarse el antiabuso. Se elimina y la reemplaza `iniciar_prueba_negocio_srv`,
--    ejecutable solo por service_role: el servidor verifica la sesión, calcula las huellas
--    HMAC (teléfono, documento, correo, dispositivo) y pasa el usuario verificado.
--    El correo ya no se huellea con md5 sin secreto.

-- ════════════════════════════════════════════════════════════════════════
-- 1. Configuración
-- ════════════════════════════════════════════════════════════════════════

alter table public.configuracion_plataforma
  add column if not exists prueba_dias int not null default 14,
  add column if not exists prueba_modalidad text not null default 'SIN_TARJETA',
  add column if not exists suscripcion_gracia_dias int not null default 3,
  add column if not exists prueba_aviso_dias_1 int not null default 3,
  add column if not exists prueba_aviso_dias_2 int not null default 1;

alter table public.configuracion_plataforma drop constraint if exists prueba_config_valida;
alter table public.configuracion_plataforma
  add constraint prueba_config_valida check (
    prueba_dias between 1 and 90
    and prueba_modalidad in ('SIN_TARJETA','CON_TARJETA','AMBAS')
    and suscripcion_gracia_dias between 0 and 30
    and prueba_aviso_dias_1 between 1 and 30
    and prueba_aviso_dias_2 between 0 and prueba_aviso_dias_1);

create or replace function public.admin_set_config_prueba(
  p_dias int, p_modalidad text, p_gracia_dias int, p_aviso_1 int, p_aviso_2 int, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare v_antes jsonb;
begin
  if not public.is_supersu() then raise exception 'NO_AUTORIZADO'; end if;
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'MOTIVO_REQUERIDO'; end if;

  select jsonb_build_object('dias', prueba_dias, 'modalidad', prueba_modalidad, 'gracia_dias', suscripcion_gracia_dias,
                            'aviso_1', prueba_aviso_dias_1, 'aviso_2', prueba_aviso_dias_2)
    into v_antes from public.configuracion_plataforma where id for update;

  -- Aplica a pruebas que se inicien desde ahora; las que ya corren conservan su fecha de fin.
  update public.configuracion_plataforma
     set prueba_dias = p_dias, prueba_modalidad = p_modalidad, suscripcion_gracia_dias = p_gracia_dias,
         prueba_aviso_dias_1 = p_aviso_1, prueba_aviso_dias_2 = p_aviso_2, updated_at = now(), updated_by = auth.uid()
   where id;

  insert into public.evento_auditoria (entidad_tipo, accion, actor_tipo, actor_id, motivo, payload_antes, payload_despues)
  values ('configuracion_plataforma', 'CONFIG_PRUEBA_ACTUALIZADA', 'SUPERSU', auth.uid(), p_motivo, v_antes,
          jsonb_build_object('dias', p_dias, 'modalidad', p_modalidad, 'gracia_dias', p_gracia_dias,
                             'aviso_1', p_aviso_1, 'aviso_2', p_aviso_2));
end $$;
revoke all on function public.admin_set_config_prueba(int, text, int, int, int, text) from public, anon, authenticated;
grant execute on function public.admin_set_config_prueba(int, text, int, int, int, text) to authenticated;

-- Lectura pública mínima para la UI del panel (no expone nada sensible).
create or replace function public.config_prueba()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('dias', prueba_dias, 'modalidad', prueba_modalidad, 'gracia_dias', suscripcion_gracia_dias)
    from public.configuracion_plataforma where id;
$$;
revoke all on function public.config_prueba() from public, anon, authenticated;
grant execute on function public.config_prueba() to authenticated, service_role;

-- ════════════════════════════════════════════════════════════════════════
-- 2. Inicio de la prueba (solo servidor)
-- ════════════════════════════════════════════════════════════════════════

drop function if exists public.iniciar_prueba_negocio(uuid, public.plan_codigo, text, text, text, text, text, text);

create or replace function public.iniciar_prueba_negocio_srv(
  p_actor uuid, p_negocio_id uuid, p_plan_codigo public.plan_codigo, p_ciclo text,
  p_metodo_pago_ref text, p_metodo_pago_proveedor text,
  p_telefono_hash text, p_documento_hash text, p_email_hash text, p_dispositivo_hash text
) returns public.suscripcion language plpgsql security definer set search_path = public as $$
declare
  v_neg public.negocio; v_pais public.pais; v_susc public.suscripcion; v_fin timestamptz;
  v_cfg public.configuracion_plataforma; v_con_tarjeta boolean;
begin
  if p_actor is null then raise exception 'NO_AUTENTICADO'; end if;
  select * into v_neg from public.negocio where id = p_negocio_id and owner_user_id = p_actor for update;
  if not found then raise exception 'NO_AUTORIZADO'; end if;
  if p_plan_codigo = 'SIGNATURE' then raise exception 'SIGNATURE_REQUIERE_COTIZACION'; end if;
  if p_ciclo not in ('MENSUAL','ANUAL') then raise exception 'CICLO_INVALIDO'; end if;

  select * into v_cfg from public.configuracion_plataforma where id;
  select * into v_pais from public.pais where codigo = v_neg.pais_codigo and activo;
  if not found then raise exception 'PAIS_NO_DISPONIBLE'; end if;
  if not exists (select 1 from public.plan_precio where plan_codigo = p_plan_codigo and pais_codigo = v_pais.codigo
                 and activo and precio_mensual is not null) then
    raise exception 'PLAN_SIN_PRECIO_EN_PAIS';
  end if;

  v_con_tarjeta := coalesce(btrim(p_metodo_pago_ref), '') <> '';
  if v_con_tarjeta then
    if v_cfg.prueba_modalidad = 'SIN_TARJETA' then raise exception 'MODALIDAD_PRUEBA_NO_PERMITIDA'; end if;
    if not v_pais.cobro_recurrente_habilitado then raise exception 'COBRO_NO_DISPONIBLE_PAIS'; end if;
  elsif v_cfg.prueba_modalidad = 'CON_TARJETA' then
    raise exception 'METODO_PAGO_REQUERIDO';
  end if;

  -- Huellas HMAC calculadas en el servidor (64 hex). Formato fijo: no se aceptan valores triviales.
  if coalesce(p_telefono_hash, '') !~ '^[0-9a-f]{64}$' or coalesce(p_documento_hash, '') !~ '^[0-9a-f]{64}$'
     or coalesce(p_email_hash, '') !~ '^[0-9a-f]{64}$' or coalesce(p_dispositivo_hash, '') !~ '^[0-9a-f]{64}$' then
    raise exception 'VERIFICACION_INCOMPLETA';
  end if;

  select * into v_susc from public.suscripcion where negocio_id = p_negocio_id for update;
  if found and v_susc.estado <> 'REQUIERE_PLAN' then raise exception 'YA_TIENE_SUSCRIPCION'; end if;

  begin
    insert into public.prueba_uso (negocio_id, owner_user_id, telefono_hash, documento_hash, email_hash, dispositivo_hash)
    values (p_negocio_id, p_actor, p_telefono_hash, p_documento_hash, p_email_hash, p_dispositivo_hash);
  exception when unique_violation then
    raise exception 'PRUEBA_YA_USADA';
  end;

  v_fin := now() + make_interval(days => v_cfg.prueba_dias);
  insert into public.suscripcion (negocio_id, plan_codigo, estado, fecha_inicio_ciclo, fecha_proximo_cobro, ciclo, pais_codigo,
                                  prueba_inicio, prueba_fin, metodo_pago_ref, metodo_pago_proveedor)
  values (p_negocio_id, p_plan_codigo, 'TRIAL', now(), v_fin, p_ciclo, v_pais.codigo, now(), v_fin,
          nullif(btrim(p_metodo_pago_ref), ''), case when v_con_tarjeta then p_metodo_pago_proveedor end)
  on conflict (negocio_id) do update set
    plan_codigo = excluded.plan_codigo, estado = 'TRIAL', fecha_inicio_ciclo = excluded.fecha_inicio_ciclo,
    fecha_proximo_cobro = excluded.fecha_proximo_cobro, ciclo = excluded.ciclo, pais_codigo = excluded.pais_codigo,
    prueba_inicio = excluded.prueba_inicio, prueba_fin = excluded.prueba_fin,
    metodo_pago_ref = excluded.metodo_pago_ref, metodo_pago_proveedor = excluded.metodo_pago_proveedor,
    aviso_3d_at = null, aviso_1d_at = null, gracia_fin = null
  returning * into v_susc;

  update public.negocio set plan_codigo = p_plan_codigo where id = p_negocio_id;

  -- El cupo fundador se reserva al iniciar la prueba; corre desde el primer cobro, solo mensual.
  if p_ciclo = 'MENSUAL' then
    perform public._reclamar_fundador(p_negocio_id, v_pais.codigo, p_plan_codigo, v_fin);
  end if;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_despues)
  values ('suscripcion', v_susc.id, 'PRUEBA_INICIADA', 'BARBERIA', p_actor, p_negocio_id,
          jsonb_build_object('con_tarjeta', v_con_tarjeta, 'dias', v_cfg.prueba_dias, 'fin', v_fin, 'plan', p_plan_codigo));
  return v_susc;
end $$;
revoke all on function public.iniciar_prueba_negocio_srv(uuid, uuid, public.plan_codigo, text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.iniciar_prueba_negocio_srv(uuid, uuid, public.plan_codigo, text, text, text, text, text, text, text)
  to service_role;

-- ════════════════════════════════════════════════════════════════════════
-- 3. Vencimiento, cobro y avisos
-- ════════════════════════════════════════════════════════════════════════

-- Solo se intenta cobrar a las pruebas que registraron tarjeta.
create or replace function public.pruebas_por_cobrar()
returns table(negocio_id uuid, plan_codigo plan_codigo, ciclo text, pais_codigo character, metodo_pago_ref text, metodo_pago_proveedor text)
language sql stable security definer set search_path = public as $$
  select s.negocio_id, s.plan_codigo, s.ciclo, s.pais_codigo, s.metodo_pago_ref, s.metodo_pago_proveedor
    from public.suscripcion s
   where s.estado = 'TRIAL' and s.prueba_fin <= now() and not s.activacion_manual
     and coalesce(btrim(s.metodo_pago_ref), '') <> '';
$$;
revoke all on function public.pruebas_por_cobrar() from public, anon, authenticated;
grant execute on function public.pruebas_por_cobrar() to service_role;

create or replace function public.mantenimiento_suscripciones()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_susp integer; v_fund integer; v_manual integer; v_sin_tarjeta integer; r record;
begin
  update public.suscripcion set estado = 'SUSPENDIDA', suspendido_causa = 'IMPAGO'
   where estado = 'EN_MORA' and gracia_fin is not null and gracia_fin < now();
  get diagnostics v_susp = row_count;

  update public.suscripcion_fundador set estado = 'FINALIZADO' where estado = 'ACTIVO' and fecha_fin <= now();
  get diagnostics v_fund = row_count;

  update public.suscripcion set estado = 'REQUIERE_PLAN', activacion_manual = false, prueba_inicio = null, prueba_fin = null
   where activacion_manual and manual_hasta is not null and manual_hasta <= now() and estado in ('TRIAL','ACTIVA');
  get diagnostics v_manual = row_count;

  -- Prueba sin tarjeta vencida: el negocio elige plan para seguir recibiendo reservas.
  -- Se conservan prueba_inicio/prueba_fin como historial; nunca se marca como cobrada.
  v_sin_tarjeta := 0;
  for r in
    update public.suscripcion set estado = 'REQUIERE_PLAN'
     where estado = 'TRIAL' and prueba_fin <= now() and not activacion_manual
       and coalesce(btrim(metodo_pago_ref), '') = ''
    returning id, negocio_id
  loop
    insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, negocio_id)
    values ('suscripcion', r.id, 'PRUEBA_VENCIDA_SIN_TARJETA', 'SISTEMA', r.negocio_id);
    v_sin_tarjeta := v_sin_tarjeta + 1;
  end loop;

  return jsonb_build_object('suspendidas', v_susp, 'fundadores_finalizados', v_fund, 'manuales_vencidas', v_manual,
                            'pruebas_sin_tarjeta_vencidas', v_sin_tarjeta);
end $$;
revoke all on function public.mantenimiento_suscripciones() from public, anon, authenticated;
grant execute on function public.mantenimiento_suscripciones() to service_role;

-- Cambia el tipo de retorno (agrega con_tarjeta): requiere DROP explícito.
drop function if exists public.avisos_prueba_pendientes();
create function public.avisos_prueba_pendientes()
returns table(negocio_id uuid, owner_user_id uuid, tipo text, fecha_cobro timestamptz, con_tarjeta boolean)
language sql stable security definer set search_path = public as $$
  with c as (select prueba_aviso_dias_1 d1, prueba_aviso_dias_2 d2 from public.configuracion_plataforma where id)
  select s.negocio_id, n.owner_user_id, '3D'::text, s.prueba_fin, coalesce(btrim(s.metodo_pago_ref), '') <> ''
    from public.suscripcion s join public.negocio n on n.id = s.negocio_id, c
   where s.estado = 'TRIAL' and not s.activacion_manual and s.aviso_3d_at is null
     and s.prueba_fin - make_interval(days => c.d1) <= now() and s.prueba_fin > now()
  union all
  select s.negocio_id, n.owner_user_id, '1D'::text, s.prueba_fin, coalesce(btrim(s.metodo_pago_ref), '') <> ''
    from public.suscripcion s join public.negocio n on n.id = s.negocio_id, c
   where s.estado = 'TRIAL' and not s.activacion_manual and s.aviso_1d_at is null and c.d2 > 0
     and s.prueba_fin - make_interval(days => c.d2) <= now() and s.prueba_fin > now();
$$;
revoke all on function public.avisos_prueba_pendientes() from public, anon, authenticated;
grant execute on function public.avisos_prueba_pendientes() to service_role;

-- Gracia configurable en el resultado del cobro (parche de texto con verificación).
do $$
declare
  v_def text := pg_get_functiondef('public.registrar_resultado_cobro(uuid,boolean,text)'::regprocedure);
  v_viejo text := 'now() + interval ''3 days''';
begin
  if position(v_viejo in v_def) = 0 then
    raise exception 'registrar_resultado_cobro cambió: revisar el parche de la 118 a mano';
  end if;
  v_def := replace(v_def, v_viejo,
    'now() + make_interval(days => (select suscripcion_gracia_dias from public.configuracion_plataforma where id))');
  execute v_def;
end $$;
revoke all on function public.registrar_resultado_cobro(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.registrar_resultado_cobro(uuid, boolean, text) to service_role;
