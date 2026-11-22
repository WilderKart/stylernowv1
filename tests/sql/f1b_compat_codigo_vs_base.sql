-- Fase 1B · compatibilidad CÓDIGO ↔ BASE. Ejecuta, con sesión real de cada rol (set local role + JWT), las consultas del código (VIEJO=desplegado, NUEVO=rama cierre) y
-- levanta EXCEPCIÓN si el contrato no se cumple: (A) matriz esperada para el estado S0 de la base local, (B) toda llamada .rpc(...) de src/ existe en pg_proc
-- con sus argumentos y permiso de ejecución. Todo en ROLLBACK. Control negativo: tests/sql/f1b_compat_control_negativo.sh
\set ON_ERROR_STOP 1
begin;
-- Un único SuperSU (ux_perfil_supersu_unico, 136): se desciende al existente SOLO dentro de esta transacción (ROLLBACK) para crear el ficticio.
update public.perfil set es_supersu = false where es_supersu;
grant select, insert, update, delete on all tables in schema public to service_role;
create temp table _a (alias text primary key, id uuid);
insert into _a values ('super','00000000-0000-0000-0f1d-000000000001'),('dueno','00000000-0000-0000-0f1d-000000000002'),('cliente','00000000-0000-0000-0f1d-000000000004');
grant select on _a to authenticated, anon;
insert into auth.users (id,email,aud,role) select id, alias||'@f1d.test','authenticated','authenticated' from _a;
insert into public.perfil (id,nombre,es_supersu) select id,alias,alias='super' from _a on conflict (id) do update set es_supersu=excluded.es_supersu;
insert into public.negocio (id,owner_user_id,nombre,slug,ciudad,pais_codigo) values ('00000000-0000-0000-0f1d-0000000000a0','00000000-0000-0000-0f1d-000000000002','Neg A','f1d-a','Cali','CO');
update public.suscripcion set estado='ACTIVA' where negocio_id='00000000-0000-0000-0f1d-0000000000a0';
insert into public.referido_config (negocio_id, monto, activo) values ('00000000-0000-0000-0f1d-0000000000a0', 1000, true);
insert into public.vip_nivel (id,negocio_id,nombre,orden) values ('00000000-0000-0000-0f1d-0000000000c1','00000000-0000-0000-0f1d-0000000000a0','Oro',1);
insert into public.vip_miembro (negocio_id, cliente_id, nivel_id, origen) values ('00000000-0000-0000-0f1d-0000000000a0','00000000-0000-0000-0f1d-000000000004','00000000-0000-0000-0f1d-0000000000c1','MANUAL');

create temp table _r (n int, codigo text, actor text, que text, resultado text);
grant all on _r to authenticated, anon;
create or replace function pg_temp.probar(p_n int, p_codigo text, p_actor text, p_que text, p_sql text) returns void language plpgsql as $$
declare v_id uuid; v_obt text; v_cnt bigint;
begin
  select id into v_id from _a where alias = p_actor;
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', v_id, 'role', 'authenticated')::text, true);
    execute 'select count(*) from (' || p_sql || ') q' into v_cnt;
    v_obt := 'FUNCIONA (' || v_cnt || ' filas)';
    raise exception 'REVERTIR';
  exception when others then
    if sqlerrm <> 'REVERTIR' then v_obt := 'FALLA: ' || left(sqlerrm, 70); end if;
  end;
  insert into _r values (p_n, p_codigo, p_actor, p_que, v_obt);
end $$;
\o /dev/null
-- Centro de IA del Super Admin
select pg_temp.probar(1,'VIEJO','super','Centro de IA · lista de acciones (select *)','select * from public.ai_accion_costo order by categoria, accion');
select pg_temp.probar(2,'VIEJO','super','Centro de IA · costos por accion (select accion,categoria,costo_proveedor_estimado,costo_creditos)','select accion, categoria, costo_proveedor_estimado, costo_creditos from public.ai_accion_costo');
select pg_temp.probar(3,'NUEVO','super','Centro de IA · rpc ai_acciones_costo_admin()','select * from public.ai_acciones_costo_admin()');
-- Tarjeta ROI de IA del dueño
select pg_temp.probar(4,'VIEJO','dueno','ROI del dueño · select accion,categoria,costo_proveedor_estimado','select accion, categoria, costo_proveedor_estimado from public.ai_accion_costo');
select pg_temp.probar(5,'NUEVO','dueno','ROI del dueño · select accion,categoria','select accion, categoria from public.ai_accion_costo');
-- Lo que no debe cambiar para nadie (mismo código en ambos): lealtad, VIP, familia, fraude
select pg_temp.probar(6,'AMBOS','dueno','Panel lealtad · referido_config de su negocio','select monto, porcentaje, limite_mensual, vigencia_dias, activo from public.referido_config where negocio_id = ''00000000-0000-0000-0f1d-0000000000a0''');
select pg_temp.probar(7,'AMBOS','dueno','Panel lealtad · vip_nivel de su negocio','select id, nombre, orden, beneficios from public.vip_nivel where negocio_id = ''00000000-0000-0000-0f1d-0000000000a0''');
select pg_temp.probar(8,'AMBOS','cliente','Página del negocio · «tu nivel VIP» (vip_miembro → vip_nivel)','select n.nombre from public.vip_miembro m join public.vip_nivel n on n.id = m.nivel_id where m.cliente_id = (select id from _a where alias=''cliente'')');
select pg_temp.probar(9,'AMBOS','cliente','Familia · crear_grupo_familiar(nombre)','select public.crear_grupo_familiar(''Mi familia'')');
select pg_temp.probar(10,'AMBOS','cliente','Lealtad · registrar_evento_fraude(tipo, negocio, payload)','select public.registrar_evento_fraude(''CANJE_DUPLICADO'', ''00000000-0000-0000-0f1d-0000000000a0'', ''MEDIA'', ''{}''::jsonb)');
\o
reset role;
\echo '== Matriz código ↔ base =='
select n, codigo, actor, que, resultado from _r order by n;

-- ══ ASERCIONES (lanzan excepción si el contrato no se cumple) ═══════════════════════════════════════
-- A. Matriz: resultado esperado de cada consulta del código para el ESTADO de la base local = S0 (139/141/142 SIN aplicar, ver
--    docs/plan_cierre/PLAN_LIBERACION_CONTROLADA.md). Si se corre contra otro estado, las expectativas de S0 no aplican: se debe
--    añadir la columna del estado correspondiente (no se relajan las de S0).
create temp table _esperado (n int primary key, funciona boolean);
insert into _esperado values (1,true),(2,true),(3,false),(4,true),(5,true),(6,true),(7,true),(8,true),(9,true),(10,true);
do $$
declare r record; v_mal text := '';
begin
  for r in select e.n, e.funciona, x.resultado, x.que from _esperado e left join _r x on x.n = e.n loop
    if r.resultado is null then v_mal := v_mal || format(E'\n  #%s: no se ejecutó', r.n);
    elsif (r.resultado like 'FUNCIONA%') is distinct from r.funciona then
      v_mal := v_mal || format(E'\n  #%s «%s»: esperaba %s, obtuvo %s', r.n, r.que, case when r.funciona then 'FUNCIONA' else 'FALLA' end, r.resultado);
    end if;
  end loop;
  if (select count(*) from _r) <> (select count(*) from _esperado) then v_mal := v_mal || E'\n  la matriz tiene un número de filas distinto al esperado'; end if;
  if v_mal <> '' then raise exception 'FALLA contrato matriz código↔base:%', v_mal; end if;
end $$;

-- B. Contrato RPC: TODA llamada `.rpc("nombre", { p_arg… })` del código (src/, generada con tests/sql/gen_contratos_rpc.cjs) debe tener
--    en pg_proc: la función, todos los nombres de argumento que el código envía y permiso de ejecución para quien la llama
--    (anon, authenticated o service_role: el cliente de servidor usa service_role). Las únicas excepciones son las funciones de la migración 139,
--    pendiente de aplicar en la base local (estado S0); son las mismas que la fila #3 de la matriz espera ausentes.
create temp table _contrato (fn text, args text, servidor boolean);
insert into _contrato values
('_reembolso_crear','p_actor_tipo,p_monto,p_motivo,p_origen,p_pago_id,p_pct',false),
('aceptar_invitacion_staff','p_autoriza_tratamiento,p_invitacion_id',false),
('aceptar_politica_reserva','p_reserva_id',false),
('activar_campana','p_campana_id',false),
('activar_perfil_profesional_propietario','p_negocio_id',false),
('actualizar_accion_costo_ia','p_accion,p_activo,p_costo_creditos',false),
('actualizar_banner_home','p_activo,p_id',false),
('actualizar_ciudad_habilitada','p_ciudad,p_habilitada',false),
('actualizar_comision_plataforma_global','p_pct',false),
('actualizar_estado_ticket','p_estado,p_ticket_id',false),
('actualizar_modelo_config_ia','p_activo,p_nombre,p_orden_preferencia',false),
('actualizar_paquete_creditos_ia','p_activo,p_paquete_id,p_precio_cop',false),
('actualizar_plan','p_codigo,p_conversaciones_whatsapp_mes,p_creditos_ia_mes,p_guardian_disponible,p_limite_sedes,p_marketplace_ads_disponible,p_precio_mensual,p_sede_addon_precio,p_staff_addon_precio,p_staff_incluido',false),
('actualizar_tarifas_ads','p_cpc_destacado,p_cpc_pin,p_cpm_pin',false),
('adicional_checkout_fallido_srv','p_actor,p_lote_id,p_motivo',true),
('adicional_mantenimiento_srv','',false),
('adicional_marcar_pago_pendiente_srv','p_id_transaccion,p_pago_id',true),
('admin_activar_negocio_manual','p_dias,p_estado,p_motivo,p_negocio_id,p_plan,p_referencia,p_tipo',false),
('admin_anular_comision_programada','p_id,p_motivo',false),
('admin_configurar_perfil_propietario_plan','p_auto_alta,p_motivo,p_plan,p_por_defecto,p_puede_activar,p_puede_desactivar',false),
('admin_dashboard_resumen','',false),
('admin_decidir_verificacion','p_motivo,p_negocio_id,p_nuevo',false),
('admin_estado_operativo_negocios','p_negocio_ids',false),
('admin_programar_comision','p_efectivo_desde,p_motivo,p_negocio_id,p_pct',false),
('admin_reintentar_reembolso','p_motivo,p_reembolso_id',false),
('admin_set_addon_precio','p_addon,p_pais,p_precio',false),
('admin_set_config_prueba','p_aviso_1,p_aviso_2,p_dias,p_gracia_dias,p_modalidad,p_motivo',false),
('admin_set_config_suscripcion','p_gracia_permite_operar,p_motivo,p_periodo_dias,p_prueba_gracia_dias',false),
('admin_set_limites_politica','p_max_intentos,p_motivo,p_parcial_min,p_pct_max,p_pct_min,p_total_max,p_total_min',false),
('admin_set_pais','p_activo,p_cobro_recurrente,p_codigo,p_fundador_cupos,p_fundador_descuento_pct,p_fundador_meses,p_impuesto_pct,p_pasarela,p_precio_mas_impuesto',false),
('admin_set_plan_caracteristica','p_clave,p_habilitado,p_plan,p_valor',false),
('admin_set_plan_precio','p_activo,p_es_desde,p_pais,p_plan,p_precio_mensual,p_precio_sede_extra,p_precio_staff_extra',false),
('admin_verificacion_detalle','p_negocio_id',false),
('admin_verificaciones_listar','p_estado,p_limite,p_offset,p_q',false),
('ai_acciones_costo_admin','',false),
('ajustar_stock','p_motivo,p_nuevo_stock_actual,p_producto_id,p_sede_id',false),
('alternar_campana_sellos','p_campana_id,p_estado',false),
('alternar_plan_membresia','p_activo,p_plan_id',false),
('alternar_regla_cashback','p_activo,p_regla_id',false),
('anular_egreso_caja','p_egreso_id,p_motivo',false),
('aplicar_comisiones_programadas','',false),
('aplicar_evento_pago','p_estado,p_id_transaccion,p_pago_id,p_payload',false),
('aprobar_memoria_ia','p_memoria_id',false),
('aprobar_negocio','p_negocio_id',false),
('atender_solicitud_reposicion','p_cantidad_recibida,p_solicitud_id',false),
('auditoria_entidades','p_negocio_id',false),
('auditoria_listar','p_accion,p_entidad_tipo,p_limite,p_negocio_id,p_offset',false),
('autorizar_lectura_documento_srv','p_actor,p_documento_id',true),
('autorizar_staff','p_canal,p_documento',false),
('avisos_prueba_pendientes','',false),
('bloquear_gift_card','p_gift_card_id,p_motivo',false),
('cambiar_rol_equipo','p_rol,p_vinculo_id',false),
('cancelar_downgrade_programado','p_negocio_id',false),
('cancelar_invitacion','p_invitacion_id',false),
('cancelar_membresia','p_cliente_membresia_id',false),
('cancelar_negocio_propio','p_motivo,p_negocio_id',false),
('cancelar_negocio_supersu','p_motivo,p_negocio_id',false),
('cancelar_reserva','p_motivo,p_reserva_id',false),
('canjear_lealtad_wallet','p_monto',false),
('cerrar_sede','p_motivo,p_permanente,p_sede_id',false),
('cierre_caja_dia','p_fecha,p_negocio_id,p_sede_id',false),
('completar_onboarding_negocio','p_negocio_id',false),
('completar_registro_con_telefono','p_locale,p_marketing,p_nombre,p_pais,p_telefono',false),
('completar_venta_pos','p_productos,p_reserva_id',false),
('comprar_paquete_creditos_ia','p_negocio_id,p_paquete_id',false),
('conexion_desconectar','p_motivo,p_negocio_id',false),
('conexion_guardar','p_access_cifrado,p_actor,p_cuenta_externa,p_entorno,p_expira_at,p_negocio_id,p_refresh_cifrado,p_scopes',false),
('conexion_marcar_estado','p_conexion_id,p_error,p_estado',true),
('conexion_pago_estado','p_negocio_id',false),
('conexion_renovar_tokens','p_access_cifrado,p_conexion_id,p_expira_at,p_refresh_cifrado',true),
('config_prueba','',false),
('configurar_anticipo','p_maximo,p_minimo,p_modo,p_monto_fijo,p_negocio_id,p_pago_completo,p_pct',false),
('configurar_funcion_plan_ia','p_funcion,p_habilitado,p_plan_codigo',false),
('configurar_politica_cancelacion','p_negocio_id,p_parcial_horas,p_parcial_pct,p_total_horas',false),
('configurar_referidos','p_activo,p_limite_mensual,p_monto,p_negocio_id,p_porcentaje,p_vigencia_dias',false),
('configurar_stock_minimo','p_producto_id,p_sede_id,p_stock_minimo',false),
('confirmar_reserva_sin_anticipo','p_reserva_id',false),
('confirmar_sugerencia_recompensa','p_sugerencia_id',false),
('congelar_membresia','p_cliente_membresia_id,p_dias',false),
('consultar_gift_card','p_codigo,p_pin',false),
('consumir_creditos_ia','p_accion,p_negocio_id,p_referencia_tipo',true),
('consumir_cupo','p_clave',true),
('crear_banner_home','p_imagen_url,p_orden,p_texto,p_url_destino,p_vigencia_desde,p_vigencia_hasta',false),
('crear_campana_publicitaria','p_fecha_fin,p_formato,p_negocio_id,p_presupuesto_diario,p_presupuesto_total,p_unidad_cobro',false),
('crear_campana_sellos','p_negocio_id,p_nombre,p_recompensa_descripcion,p_sellos_requeridos',false),
('crear_cuenta_corporativa','p_contacto_email,p_cupos_totales,p_negocio_id,p_nombre_empresa,p_vigencia_fin',false),
('crear_gift_card','p_destinatario_email,p_destinatario_nombre,p_mensaje,p_monto,p_negocio_id,p_pin',false),
('crear_grupo_familiar','p_nombre',false),
('crear_invitacion_staff','p_comision_pct,p_email,p_negocio_id,p_rol,p_sede_id',false),
('crear_pago_sena','p_reserva_id',false),
('crear_plan_membresia','p_congelacion_max_dias,p_duracion_meses,p_negocio_id,p_nombre,p_precio',false),
('crear_prompt_ia','p_categoria,p_contenido,p_negocio_id,p_nombre,p_tipo',false),
('crear_regla_cashback','p_limite_mensual,p_negocio_id,p_porcentaje',false),
('crear_regla_recompensa','p_condicion,p_disparador,p_negocio_id,p_nivel_ia',false),
('crear_reserva_autorizada','p_autoriza_datos,p_hora_inicio,p_idempotency_key,p_sede_id,p_servicio_ids,p_staff_id',false),
('crear_reserva_manual','p_cliente_id,p_hora_inicio,p_sede_id,p_servicio_ids,p_staff_id',false),
('crear_sede','p_ciudad,p_direccion,p_horario_base,p_latitud,p_longitud,p_negocio_id,p_nombre',false),
('crear_sugerencia_recompensa','p_cliente_id,p_costo_credito_ia,p_descripcion,p_justificacion,p_regla_id',false),
('crear_suscripcion_inicial','p_negocio_id,p_plan_codigo',false),
('crear_ticket_soporte','p_asunto,p_mensaje,p_negocio_id',false),
('cuentas_registro_abandonado','p_horas,p_limite',false),
('cupo_plan_negocio','p_negocio_id',false),
('dashboard_ranking_staff_semana','p_negocio_id,p_sede_id',false),
('dashboard_resumen_dia','p_negocio_id,p_sede_id',false),
('desactivar_perfil_profesional_propietario','p_negocio_id',false),
('descartar_sugerencia_recompensa','p_sugerencia_id',false),
('detectar_horarios_muertos','p_negocio_id',false),
('ejecutar_downgrades_programados','',true),
('elegir_pais_negocio','p_negocio_id,p_pais',false),
('eliminar_banner_home','p_id',false),
('establecer_sede_principal','p_sede_id',false),
('estado_autorizaciones_staff','p_negocio',false),
('evaluar_candidatos_recompensa','p_regla_id',true),
('expirar_reservas_vencidas','',true),
('fijar_foto_principal_negocio','p_negocio_id,p_public_id,p_url',false),
('finalizar_atencion_reserva','p_reserva_id',false),
('finalizar_campana','p_campana_id',false),
('forzar_reactivacion_pago_externo','p_motivo,p_negocio_id',false),
('fundador_cupos_restantes','p_pais',false),
('generar_recordatorios_cita','p_ventana_horas',false),
('generar_roi_snapshot_mensual','',true),
('guardar_marca_negocio','p_color_primario,p_color_secundario,p_logo_url,p_negocio_id,p_nombre,p_publicar,p_slogan',false),
('guardar_memoria_ia','p_categoria,p_contenido,p_negocio_id',false),
('historial_memoria_ia','p_categoria,p_negocio_id',false),
('incrementar_session_version','p_user_id',true),
('iniciar_atencion_reserva','p_reserva_id',false),
('iniciar_prueba_negocio_srv2','p_actor,p_ciclo,p_dispositivo_hash,p_documento_hash,p_email_hash,p_ip_hash,p_metodo_pago_proveedor,p_metodo_pago_ref,p_negocio_id,p_plan_codigo,p_telefono_hash',true),
('libro_totales','p_categoria,p_desde,p_entidad,p_estado,p_hasta,p_negocio_id',false),
('limites_politica_cancelacion','',false),
('limpiar_limite_tasa','',true),
('listar_eventos_fraude','p_revisado',false),
('listar_memoria_ia','p_negocio_id',false),
('listar_prompts_ia','p_negocio_id',false),
('listar_sugerencias_recompensa','p_negocio_id',false),
('mantenimiento_suscripciones','',true),
('marcar_auth_cerrada','p_solicitud_id',false),
('marcar_aviso_prueba','p_negocio_id,p_tipo',false),
('marcar_fraude_revisado','p_evento_id',false),
('marcar_negocio_en_mora','p_motivo,p_negocio_id',false),
('marcar_no_show','p_motivo,p_reserva_id',false),
('marketplace_buscar','p_categoria,p_ciudad,p_lat,p_limite,p_lng,p_offset,p_orden,p_texto',false),
('marketplace_mi_posicion','p_negocio_id',false),
('metricas_ads_plataforma','',false),
('metricas_campana','p_campana_id',false),
('metricas_lealtad_negocio','p_negocio_id',false),
('metricas_lealtad_plataforma','',false),
('mi_cashback','',false),
('mi_familia','',false),
('mi_verificacion_negocio','p_negocio_id',false),
('mis_referidos','',false),
('mis_referidos_staff','p_negocio_id',false),
('mis_sellos','',false),
('moderar_resena','p_accion,p_motivo,p_resena_id',false),
('negocio_acepta_reservas','p_negocio_id',false),
('negocio_cobra_en_linea','p_negocio_id',false),
('negocio_estado_operativo','p_negocio_id',false),
('negocio_resenas_publicas','p_limite,p_negocio_id',false),
('negocio_staff_publico','p_negocio_id',false),
('negocio_tiene_funcion','p_clave,p_negocio_id',false),
('negocio_verificado','p_negocio_id',false),
('notif_entregar_panel','p_limite',true),
('notif_generar_programadas','p_ventana_horas',false),
('notif_outbox_reencolar_no_habilitados','p_canal,p_max_horas',false),
('notif_outbox_registrar','p_codigo,p_id,p_id_externo,p_ok,p_reintentable',true),
('notif_outbox_tomar','p_canales,p_limite',true),
('notif_preferencia_guardar','p_activo,p_canal,p_evento',false),
('notif_preferencias_listar','',false),
('notif_push_desuscribir','p_endpoint',false),
('notif_push_eliminar_endpoint','p_endpoint',false),
('notif_push_suscribir','p_auth,p_endpoint,p_p256dh',false),
('oauth_consumir','p_actor,p_state_hash',true),
('oauth_iniciar','p_actor,p_negocio_id,p_state_hash,p_verifier_cifrado',true),
('obtener_mi_codigo_referido','',false),
('olvidar_memoria_ia','p_memoria_id',false),
('otorgar_creditos_plan_mensual','',true),
('pausar_campana','p_campana_id',false),
('procesar_eliminaciones_cuenta','p_limite',false),
('promover_guardian','p_vinculo_id',false),
('pruebas_por_cobrar','',true),
('publicar_texto_legal','p_cambio_material,p_contenido,p_tipo',false),
('reabrir_sede','p_sede_id',false),
('reactivar_membresia_congelada','p_cliente_membresia_id',false),
('reactivar_negocio_supersu','p_negocio_id',false),
('reactivar_staff','p_vinculo_id',false),
('reasignar_staff_reserva','p_motivo,p_nuevo_staff_id,p_reserva_id',false),
('rechazar_negocio','p_motivo,p_negocio_id',false),
('redimir_gift_card_pos','p_cliente_id,p_codigo,p_pin',false),
('reembolso_registrar_resultado','p_error,p_estado_pasarela,p_id_pasarela,p_reembolso_id',true),
('reembolso_tomar_pendientes','p_limite',true),
('reenviar_invitacion','p_invitacion_id',false),
('registrar_documento_verificacion_srv','p_actor,p_bytes,p_formato,p_negocio_id,p_public_id,p_tipo,p_version',true),
('registrar_egreso_caja','p_categoria,p_concepto,p_monto,p_negocio_id,p_sede_id',false),
('registrar_evento_fraude','p_negocio_id,p_payload,p_tipo',false),
('registrar_evento_patrocinado','p_campana_id,p_huella,p_negocio_id,p_tipo',true),
('registrar_intento_auth','p_email,p_exitoso,p_tipo',true),
('registrar_movimiento_inventario','p_cantidad,p_motivo,p_producto_id,p_sede_id,p_tipo',false),
('registrar_referido','p_codigo',false),
('registrar_resultado_cobro','p_exito,p_motivo,p_negocio_id',false),
('registrar_visita_perfil','p_campana_id,p_negocio_id',false),
('reportar_resena','p_motivo,p_resena_id',false),
('reportes_ingresos_periodo','p_agrupacion,p_desde,p_hasta,p_negocio_id,p_sede_id',false),
('reportes_ranking_staff','p_desde,p_hasta,p_negocio_id,p_sede_id,p_vinculo_id',false),
('reportes_servicios_top','p_negocio_id,p_sede_id',false),
('reprogramar_reserva','p_motivo,p_nueva_hora_inicio,p_reserva_id',false),
('responder_invitacion','p_aceptar,p_invitacion_id',false),
('responder_ticket_soporte','p_mensaje,p_ticket_id',false),
('restaurar_version_memoria_ia','p_memoria_id_historica',false),
('retirar_staff','p_motivo,p_vinculo_id',false),
('revocar_guardian','p_vinculo_id',false),
('revocar_publicacion_staff','',false),
('rol_equipo','p_negocio_id,p_usuario_id',false),
('saldo_creditos_ia','p_negocio_id',false),
('sembrar_niveles_vip_default','p_negocio_id',false),
('simular_consumo_ia','p_num_clientes,p_num_staff,p_plan_codigo',false),
('slots_disponibles','p_fecha,p_sede_id,p_servicio_ids,p_staff_id',false),
('solicitar_downgrade_plan','p_negocio_id,p_plan_codigo_destino',false),
('solicitar_pago_plan','p_ciclo,p_negocio_id,p_plan_codigo',false),
('solicitar_upgrade_plan','p_negocio_id,p_plan_codigo_nuevo',false),
('staff_de_sede','p_sede_id',false),
('staff_mi_nivel_actual','',false),
('staff_mis_propinas','p_desde,p_hasta',false),
('suscribirse_membresia','p_plan_id',false),
('suspender_negocio','p_causa,p_motivo,p_negocio_id',false),
('suspender_staff','p_motivo,p_vinculo_id',false),
('tiene_acceso_interno','p_negocio_id',false),
('trasladar_staff','p_nueva_sede_id,p_vinculo_id',false),
('verificar_rate_limit_auth','p_email,p_tipo',true),
('webhook_registrar','p_conexion_id,p_data_id,p_proveedor,p_request_id,p_topico',true),
('webhook_registrar_resultado','p_error,p_estado_proveedor,p_firma,p_live_mode,p_negocio_id,p_pago_id,p_procesado,p_proveedor,p_request_id,p_resultado',false),
('whatsapp_otorgar_lotes_plan_mes','',false)
;
create temp table _pendientes_139 (fn text primary key);
insert into _pendientes_139 values ('ai_acciones_costo_admin');
-- BRECHA REAL CONOCIDA (no se oculta: se avisa en cada corrida y está en el informe): el cron diario (src/app/api/cron/diario/route.ts) llama a estas 4
-- funciones con el cliente de servidor, pero su ACL solo incluye a postgres: service_role no puede ejecutarlas. No se arregla aquí (es seguridad de otra área).
create temp table _brechas_permiso (fn text primary key);
insert into _brechas_permiso values ('ejecutar_downgrades_programados'), ('expirar_reservas_vencidas'), ('generar_roi_snapshot_mensual'), ('otorgar_creditos_plan_mensual');
do $$
declare r record; v_mal text := ''; v_existe boolean; v_args boolean; v_perm boolean;
begin
  for r in select * from _contrato c where c.fn not in (select fn from _pendientes_139) order by c.fn loop
    select count(*) > 0,
           coalesce(bool_or(coalesce(r.args, '') = '' or not exists (select 1 from unnest(string_to_array(r.args, ',')) a where a <> all (coalesce(p.proargnames, '{}'::text[])))), false),
           coalesce(bool_or(has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')
                            or has_function_privilege('service_role', p.oid, 'execute')), false)
      into v_existe, v_args, v_perm
      from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = r.fn;
    if not v_existe then v_mal := v_mal || format(E'\n  %s: la función NO existe', r.fn);
    elsif not v_args then v_mal := v_mal || format(E'\n  %s: ninguna firma acepta los argumentos del código (%s)', r.fn, r.args);
    elsif not v_perm then
      if exists (select 1 from _brechas_permiso b where b.fn = r.fn) then
        raise notice 'BRECHA CONOCIDA: % no es ejecutable por ningún rol de la API (la llama el cron diario)', r.fn;
      else
        v_mal := v_mal || format(E'\n  %s: ningún rol de la API puede ejecutarla', r.fn);
      end if;
    end if;
  end loop;
  if v_mal <> '' then raise exception 'FALLA contrato RPC código↔base:%', v_mal; end if;
  if (select count(*) from _contrato) < 150 then raise exception 'FALLA: la lista de contratos parece truncada (% filas)', (select count(*) from _contrato); end if;
end $$;
rollback;
select 'OK: f1b_compat_codigo_vs_base — matriz S0 y contratos RPC cumplidos' as resultado;
