-- Paridad EXACTA de privilegios de tabla con producción (instantánea 2026-11-15, leída solo-lectura de wxokamgnrpyhobkqjylm).
-- SOLO base LOCAL de pruebas. Formato por tabla: nombre|anon|authenticated|service_role con letras
-- r=SELECT a=INSERT w=UPDATE d=DELETE D=TRUNCATE. Solo toca privilegios de TABLA (no los de columna, p. ej. `negocio`).
begin;
do $$
declare
  snap text := 'aceptacion_legal|rawdD|rawdD|rawdD aceptacion_politica_reserva||r|r addon_precio|rawdD|rawdD|rawdD ai_accion_costo|rawdD|rawdD|rawdD ai_conversion|rawdD|rawdD|rawdD ai_interaction|rawdD|rawdD|rawdD ai_memoria_negocio|rawdD|rawdD|rawdD ai_modelo_config|rawdD|rawdD|rawdD ai_paquete_creditos|rawdD|rawdD|rawdD ai_prompt|rawdD|rawdD|rawdD ai_roi_snapshot|rawdD|rawdD|rawdD anuncio_evento_dedupe|||rawdD banner_home|rawdD|rawdD|rawdD beneficio_marca||rawd|rawdD bloqueo_ausencia|rawdD|rawdD|rawdD campana_publicitaria|rawdD|rawdD|rawdD cashback_movimiento|r|r|ra cashback_regla|rawdD|rawdD|rawdD chat_conversacion||r|rawdD chat_lectura||r|rawdD chat_mensaje||r|rawdD ciudad_habilitada|rawdD|rawdD|rawdD cliente_etiqueta|rawdD|rawdD|rawdD cliente_membresia|rawdD|rawdD|rawdD cliente_nota|rawdD|rawdD|rawdD cliente_preferencia||r|rawdD comision_cambio_programado||r|r conexion_pago_evento|||r conexion_pago_negocio|||r configuracion_plataforma|r|r|rawdD consentimiento_evento||r|rawdD corporativo_consumo|rawdD|rawdD|rawdD corporativo_cuenta|rawdD|rawdD|rawdD corporativo_miembro|rawdD|rawdD|rawdD credito_ia_consumo|r|r|ra credito_ia_lote|r|r|rawdD disponibilidad|rawdD|rawdD|rawdD egreso_caja||rD|rawdD evento_auditoria|r|r|ra evento_pipeline_handler|rawdD|rawdD|rawdD familia_grupo|rawdD|rawdD|rawdD familia_miembro|rawdD|rawdD|rawdD favorito_negocio|rawdD|rawdD|rawdD feature_flag|rawdD|rawdD|rawdD gift_card|r|r|rawdD gift_card_redencion|r|r|ra intento_auth|||rawdD invitacion_staff|rawdD|rawdD|rawdD lealtad_fraude_evento|rawdD|rawdD|rawdD lealtad_movimiento|r|r|ra lealtad_wallet|r|r|rawdD libro_movimiento||r|r limite_tasa_evento|||rawdD lista_espera|rawdD|rawdD|rawdD marca_aliada||rawd|rawdD membresia_plan|rawdD|rawdD|rawdD membresia_uso|r|r|ra movimiento_inventario|rawdD|rawdD|rawdD negocio|awdD|awdD|rawdD negocio_addon|rawdD|rawdD|rawdD negocio_marca|rawdD|rawdD|rawdD negocio_visita_perfil|rawdD|rawdD|rawdD nivel_staff_consolidado|rawdD|rawdD|rawdD notificacion_envio|rawdD|rawdD|rawdD notificacion_evento|||rawdD notificacion_outbox||r|rawdD notificacion_outbox_evento|||rawdD notificacion_plantilla|||rawdD notificacion_preferencia||r|rawdD notificacion_push_suscripcion|||rawdD notificacion_usuario||r|rawdD oauth_estado|||r oferta_negocio||rawdD|rawdD pago|r|r|raw pais|rawdD|rawdD|rawdD password_history|||rawdD perfil|rawdD|rawdD|rawdD plan|rawdD|rawdD|rawdD plan_caracteristica|rawdD|rawdD|rawdD plan_funcion_ia|rawdD|rawdD|rawdD plan_precio|rawdD|rawdD|rawdD producto|rawdD|rawdD|rawdD producto_stock|rawdD|rawdD|rawdD prueba_uso|r|r|rawdD puntaje_staff_evento|rawdD|rawdD|rawdD punto_fidelizacion|rawdD|rawdD|rawdD purga_storage_pendiente|||rawdD recompensa_regla|rawdD|rawdD|rawdD recompensa_sugerencia|rawdD|rawdD|rawdD recurso|rawdD|rawdD|rawdD recurso_tipo|rawdD|rawdD|rawdD reembolso||r|r reembolso_evento||r|r referido|rawdD|rawdD|rawdD referido_codigo|rawdD|rawdD|rawdD referido_config|rawdD|rawdD|rawdD resena|rawdD|rawdD|rawdD reserva|rawdD|rawdD|rawdD reserva_foto|rawdD|rawdD|rawdD reserva_servicio|r|r|rawdD sede|rawdD|rawdD|rawdD sede_horario_excepcion|rawdD|rawdD|rawdD sello_campana|rawdD|rawdD|rawdD sello_cliente|rawdD|rawdD|rawdD sello_evento|rawdD|rawdD|rawdD servicio|rawdD|rawdD|rawdD servicio_combo|rawdD|rawdD|rawdD servicio_combo_item|rawdD|rawdD|rawdD servicio_producto_consumo|rawdD|rawdD|rawdD solicitud_cuenta||r|rawdD solicitud_devolucion_saldo||r|rawdD solicitud_reposicion|rawdD|rawdD|rawdD staff|rawdD|rawdD|rawdD staff_referido|rawdD|rawdD|rawdD staff_servicio|rawdD|rawdD|rawdD suscripcion|rawdD|rawdD|rawdD suscripcion_fundador|r|r|rawdD temporada|rawdD|rawdD|rawdD texto_legal|rawdD|rawdD|rawdD ticket_mensaje|rawdD|rawdD|rawdD ticket_soporte|rawdD|rawdD|rawdD venta_producto|rawdD|rawdD|rawdD vinculo_staff_negocio|rawdD|rawdD|rawdD vip_historial|rawdD|rawdD|rawdD vip_miembro|rawdD|rawdD|rawdD vip_nivel|rawdD|rawdD|rawdD vista_crm_cliente|rawdD|rawdD|rawdD vista_staff_negocio|rawdD|rawdD|rawdD wallet|r|r|rawdD wallet_movimiento|r|r|ra webhook_evento||r|rawdD whatsapp_alerta||r|rawdD whatsapp_campana||r|rawdD whatsapp_compra_recarga||r|rawdD whatsapp_config||r|rawdD whatsapp_consumo||r|rawdD whatsapp_conversacion_lote|rD|rD|rawdD whatsapp_mensaje||r|rawdD whatsapp_mensaje_evento||r|rawdD whatsapp_paquete||r|rawdD whatsapp_plantilla||r|rawdD';
  ent text; p text[]; roles text[] := array['anon','authenticated','service_role']; i int; l text;
  letras text[] := array['r','a','w','d','D']; privs text[] := array['select','insert','update','delete','truncate'];
  j int; tiene boolean; quiere boolean; v_oid oid;
begin
  foreach ent in array string_to_array(snap, ' ') loop
    p := string_to_array(ent, '|');
    v_oid := to_regclass('public.' || quote_ident(p[1]));
    if v_oid is null then continue; end if;
    for i in 1..3 loop
      l := coalesce(p[i + 1], '');
      for j in 1..5 loop
        quiere := position(letras[j] in l) > 0;
        tiene := has_table_privilege(roles[i], v_oid, privs[j]);
        if quiere and not tiene then execute format('grant %s on public.%I to %I', privs[j], p[1], roles[i]);
        elsif tiene and not quiere then execute format('revoke %s on public.%I from %I', privs[j], p[1], roles[i]);
        end if;
      end loop;
    end loop;
  end loop;
end $$;
-- service_role ejecuta todas las funciones en producción, SALVO estas 15 internas (migraciones 122/123/119: revocadas a propósito).
grant execute on all functions in schema public to service_role;
do $$
declare f text;
begin
  foreach f in array array[
    '_auditar(text,uuid,text,uuid,jsonb,jsonb,text)', '_auditoria_cabeceras()', '_auditoria_es_clave_secreta(text)',
    '_auditoria_filtrar(jsonb,text[],text[])', '_auditoria_limpiar(jsonb)', '_auditoria_motivo_cabecera()', '_auditoria_origen()',
    '_auditoria_request_id()', '_conexion_evento(uuid,uuid,text,text,text,uuid,jsonb)', '_libro_desde_pago(pago,text,uuid,boolean)',
    '_libro_desde_reembolso(reembolso,boolean)',
    '_libro_registrar(text,text,uuid,text,text,text,text,numeric,timestamp with time zone,text,uuid,uuid,uuid,uuid,text,text,text,text,uuid,jsonb)',
    '_sincronizar_registro_pendiente(uuid,boolean)', '_trg_auditar_cambio()', '_trg_auditoria_completar()'] loop
    execute format('revoke execute on function public.%s from service_role', f);
  end loop;
end $$;
commit;
