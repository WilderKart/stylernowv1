-- 167 · FASE 2B · Guardia de bloqueo en las RPC que crean o modifican la operación sin pasar por las tablas guardadas en 162
-- (depende de 160 y 162). Se inserta UNA línea al inicio de cada función por ancla exacta (primer «begin» del cuerpo); si la ancla falta,
-- la migración aborta. Cada llamada usa la guardia central: SUSCRIPCION_RESTRINGIDA.
--
-- Parchean 35 RPC (reservas nuevas y manuales, mover cita, confirmar/pagar seña, equipo, precios y políticas, comercial,
-- administrativo, inventario) más slots_disponibles (devuelve vacío si el negocio no acepta reservas, para que ningún flujo ofrezca
-- horarios que luego rechazaría).
-- completar_venta_pos NO se bloquea (es cumplir una cita previa) salvo que la cuenta lleve venta de productos.
-- Reversión: 163_..._REVERSION.sql.txt.

begin;
set local lock_timeout = '5s';

-- Venta de productos en una cita previa = operación comercial nueva: bloqueada; el servicio y la propina de la cita siguen permitidos.
create or replace function public._exigir_operativo_reserva_sin_productos(p_reserva_id uuid, p_productos jsonb)
 returns void language plpgsql stable security definer set search_path to 'public'
as $function$
declare v_neg uuid;
begin
  if coalesce(public.is_supersu(), false) then return; end if;
  if p_productos is null or jsonb_typeof(p_productos) <> 'array' or jsonb_array_length(p_productos) = 0 then return; end if;
  select negocio_id into v_neg from public.reserva where id = p_reserva_id;
  if v_neg is not null then perform public._exigir_operativo(v_neg); end if;
end $function$;
revoke all on function public._exigir_operativo_reserva_sin_productos(uuid, jsonb) from public, anon, authenticated;

-- Un negocio desconocido (null) no se decide aquí: lo valida la función que llama.
do $$
declare v_def text; v_a constant text := E'begin\n  if coalesce(public.is_supersu(), false) then return; end if;';
begin
  v_def := replace(pg_get_functiondef('public._exigir_operativo(uuid)'::regprocedure), chr(13), '');
  if position(v_a in v_def) = 0 then raise exception 'ANCLA_NO_ENCONTRADA _exigir_operativo'; end if;
  execute replace(v_def, v_a, E'begin\n  if p_negocio_id is null or coalesce(public.is_supersu(), false) then return; end if;');
end $$;

do $$
declare r record; v_def text; v_nuevo text; v_ancla constant text := E'\nbegin\n'; v_linea text;
begin
  for r in select * from (values
    ('crear_reserva(uuid,uuid[],timestamp with time zone,uuid,text)', 'perform public._exigir_operativo_sede(p_sede_id);'),
    ('crear_reserva_manual(uuid,uuid[],timestamp with time zone,uuid,uuid)', 'perform public._exigir_operativo_sede(p_sede_id);'),
    ('reprogramar_reserva(uuid,timestamp with time zone,text)', 'perform public._exigir_operativo_reserva(p_reserva_id);'),
    ('confirmar_reserva_sin_anticipo(uuid)', 'perform public._exigir_operativo_reserva(p_reserva_id);'),
    ('crear_pago_sena(uuid)', 'perform public._exigir_operativo_reserva(p_reserva_id);'),
    ('completar_venta_pos(uuid,jsonb,text,numeric,text,integer)', 'perform public._exigir_operativo_reserva_sin_productos(p_reserva_id, p_productos);'),
    ('crear_invitacion_staff(uuid,text,uuid,numeric,text)', 'perform public._exigir_operativo(p_negocio_id);'),
    ('configurar_anticipo(uuid,text,numeric,numeric,numeric,numeric,boolean,text)', 'perform public._exigir_operativo(p_negocio_id);'),
    ('configurar_politica_cancelacion(uuid,integer,integer,numeric,text)', 'perform public._exigir_operativo(p_negocio_id);'),
    ('configurar_referidos(uuid,numeric,numeric,integer,integer,boolean)', 'perform public._exigir_operativo(p_negocio_id);'),
    ('crear_campana_publicitaria(uuid,text,text,numeric,numeric,timestamp with time zone,jsonb)', 'perform public._exigir_operativo(p_negocio_id);'),
    ('crear_campana_sellos(uuid,text,integer,text,uuid[],integer)', 'perform public._exigir_operativo(p_negocio_id);'),
    ('crear_gift_card(uuid,numeric,text,text,text,integer,text,text)', 'perform public._exigir_operativo(p_negocio_id);'),
    ('crear_grupo_familiar(text,uuid,integer,numeric)', 'perform public._exigir_operativo(p_negocio_id);'),
    ('crear_nivel_vip(uuid,text,integer,text,numeric)', 'perform public._exigir_operativo(p_negocio_id);'),
    ('crear_regla_cashback(uuid,numeric,uuid[],uuid[],numeric,integer)', 'perform public._exigir_operativo(p_negocio_id);'),
    ('crear_regla_recompensa(uuid,text,integer,jsonb,jsonb,boolean)', 'perform public._exigir_operativo(p_negocio_id);'),
    ('asignar_vip(uuid,uuid,uuid)', 'perform public._exigir_operativo(p_negocio_id);'),
    ('sembrar_niveles_vip_default(uuid)', 'perform public._exigir_operativo(p_negocio_id);'),
    ('crear_sede(uuid,text,text,text,jsonb,double precision,double precision)', 'perform public._exigir_operativo(p_negocio_id);'),
    ('fijar_foto_principal_negocio(uuid,text,text)', 'perform public._exigir_operativo(p_negocio_id);'),
    ('registrar_egreso_caja(uuid,uuid,numeric,text,text)', 'perform public._exigir_operativo(p_negocio_id);'),
    ('registrar_referido_staff(uuid,uuid,text,numeric)', 'perform public._exigir_operativo(p_negocio_id);'),
    ('whatsapp_campana_crear(uuid,uuid,text,jsonb,timestamp with time zone)', 'perform public._exigir_operativo(p_negocio_id);'),
    ('whatsapp_plantilla_guardar(uuid,uuid,text,text,text,text,jsonb)', 'perform public._exigir_operativo(p_negocio_id);'),
    ('whatsapp_solicitar_recarga(uuid,uuid)', 'perform public._exigir_operativo(p_negocio_id);'),
    ('comprar_paquete_creditos_ia(uuid,uuid)', 'perform public._exigir_operativo(p_negocio_id);'),
    ('crear_cuenta_corporativa(text,text,integer,date,uuid,text)', 'perform public._exigir_operativo(p_negocio_id);'),
    ('ajustar_stock(uuid,uuid,integer,text)', 'perform public._exigir_operativo_sede(p_sede_id);'),
    ('registrar_movimiento_inventario(uuid,uuid,movimiento_inventario_tipo,integer,text)', 'perform public._exigir_operativo_sede(p_sede_id);'),
    ('configurar_stock_minimo(uuid,uuid,integer)', 'perform public._exigir_operativo_sede(p_sede_id);'),
    ('atender_solicitud_reposicion(uuid,integer)', 'perform public._exigir_operativo((select s.negocio_id from public.solicitud_reposicion s where s.id = p_solicitud_id));'),
    ('suscribirse_membresia(uuid)', 'perform public._exigir_operativo((select m.negocio_id from public.membresia_plan m where m.id = p_plan_id));'),
    ('crear_lote_gift_cards_corporativo(uuid,integer,numeric)', 'perform public._exigir_operativo((select c.negocio_id from public.corporativo_cuenta c where c.id = p_cuenta_id));'),
    ('crear_sugerencia_recompensa(uuid,uuid,text,text,integer)', 'perform public._exigir_operativo((select r.negocio_id from public.recompensa_regla r where r.id = p_regla_id));'),
    ('slots_disponibles(uuid,uuid[],date,uuid,integer)', 'if not coalesce(public.negocio_acepta_reservas((select s.negocio_id from public.sede s where s.id = p_sede_id)), true) then return; end if;')
  ) t(firma, guardia)
  loop
    v_def := replace(pg_get_functiondef(r.firma::regprocedure), chr(13), '');
    v_linea := E'  ' || r.guardia || E'\n';
    if position(v_linea in v_def) > 0 then raise exception 'YA_PARCHEADA %', r.firma; end if;
    if position(v_ancla in v_def) = 0 then raise exception 'ANCLA_NO_ENCONTRADA %', r.firma; end if;
    v_nuevo := overlay(v_def placing v_ancla || v_linea from position(v_ancla in v_def) for char_length(v_ancla));
    execute v_nuevo;
  end loop;
end $$;

commit;
