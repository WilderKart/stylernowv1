-- 135 · Prueba gratuita: antiabuso por red y por equipo (pedido del propietario, 2026-11-14).
--
-- Ya existían (118): una prueba por negocio, teléfono, documento, correo y dispositivo (huellas HMAC únicas).
-- El id de dispositivo vivía solo en localStorage: modo incógnito o borrar datos lo regeneraba. Ahora:
--   * el id de dispositivo también va en una cookie httpOnly de 2 años (servidor; el JS no la ve ni la borra);
--   * ip_hash: HMAC de la IP vista por el servidor (nunca la IP en claro);
--   * equipo_hash: HMAC de rasgos del equipo (navegador, pantalla, zona horaria, idioma).
-- Reglas (no se bloquea por IP sola: en Colombia muchos usuarios comparten IP del operador / CGNAT):
--   * misma red + mismo equipo ya usados en una prueba de los últimos 365 días → PRUEBA_YA_USADA;
--   * 3 o más pruebas desde la misma red en 30 días → PRUEBA_YA_USADA.
-- Función nueva iniciar_prueba_negocio_srv2 (la anterior queda sin uso; no se elimina para no romper un
-- despliegue intermedio). Solo service_role.

alter table public.prueba_uso add column if not exists ip_hash text;
alter table public.prueba_uso add column if not exists equipo_hash text;
create index if not exists ix_prueba_uso_ip on public.prueba_uso (ip_hash, created_at);
create index if not exists ix_prueba_uso_ip_equipo on public.prueba_uso (ip_hash, equipo_hash);

create or replace function public.iniciar_prueba_negocio_srv2(
  p_actor uuid, p_negocio_id uuid, p_plan_codigo public.plan_codigo, p_ciclo text,
  p_metodo_pago_ref text, p_metodo_pago_proveedor text,
  p_telefono_hash text, p_documento_hash text, p_email_hash text, p_dispositivo_hash text,
  p_ip_hash text, p_equipo_hash text)
 returns public.suscripcion
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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

  if coalesce(p_telefono_hash, '') !~ '^[0-9a-f]{64}$' or coalesce(p_documento_hash, '') !~ '^[0-9a-f]{64}$'
     or coalesce(p_email_hash, '') !~ '^[0-9a-f]{64}$' or coalesce(p_dispositivo_hash, '') !~ '^[0-9a-f]{64}$'
     or coalesce(p_ip_hash, '') !~ '^[0-9a-f]{64}$' or coalesce(p_equipo_hash, '') !~ '^[0-9a-f]{64}$' then
    raise exception 'VERIFICACION_INCOMPLETA';
  end if;

  select * into v_susc from public.suscripcion where negocio_id = p_negocio_id for update;
  if found and v_susc.estado <> 'REQUIERE_PLAN' then raise exception 'YA_TIENE_SUSCRIPCION'; end if;

  -- Antiabuso por red y equipo (con candado por red para que dos intentos simultáneos no se cuelen).
  perform pg_advisory_xact_lock(hashtext('prueba_ip:' || p_ip_hash));
  if exists (select 1 from public.prueba_uso
              where ip_hash = p_ip_hash and equipo_hash = p_equipo_hash and created_at > now() - interval '365 days') then
    raise exception 'PRUEBA_YA_USADA';
  end if;
  if (select count(*) from public.prueba_uso where ip_hash = p_ip_hash and created_at > now() - interval '30 days') >= 3 then
    raise exception 'PRUEBA_YA_USADA';
  end if;

  begin
    insert into public.prueba_uso (negocio_id, owner_user_id, telefono_hash, documento_hash, email_hash, dispositivo_hash, ip_hash, equipo_hash)
    values (p_negocio_id, p_actor, p_telefono_hash, p_documento_hash, p_email_hash, p_dispositivo_hash, p_ip_hash, p_equipo_hash);
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

  if p_ciclo = 'MENSUAL' then
    perform public._reclamar_fundador(p_negocio_id, v_pais.codigo, p_plan_codigo, v_fin);
  end if;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_despues)
  values ('suscripcion', v_susc.id, 'PRUEBA_INICIADA', 'BARBERIA', p_actor, p_negocio_id,
          jsonb_build_object('con_tarjeta', v_con_tarjeta, 'dias', v_cfg.prueba_dias, 'fin', v_fin, 'plan', p_plan_codigo));
  return v_susc;
end
$function$;

revoke all on function public.iniciar_prueba_negocio_srv2(uuid, uuid, public.plan_codigo, text, text, text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.iniciar_prueba_negocio_srv2(uuid, uuid, public.plan_codigo, text, text, text, text, text, text, text, text, text)
  to service_role;
