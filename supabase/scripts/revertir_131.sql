-- Reversión de la migración 131 (procedimiento de recuperación). NO es una migración.
--
-- Deja la base exactamente como estaba antes de la 131:
--   1. Elimina los 101 índices ix_fk_* que agregó.
--   2. Devuelve las 74 políticas a su texto original. Se generó desde el estado original y se
--      verificó contra producción: la huella de las políticas coincide.
--   3. Restaura la versión anterior de obtener_mi_codigo_referido.
-- No toca datos. Atómica: si algo falla, no cambia nada.
--
-- Uso (SQL Editor de Supabase o psql con la cadena de conexión de producción):
--   psql "<cadena>" -v ON_ERROR_STOP=1 -f supabase/scripts/revertir_131.sql

begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- 1 · Índices
drop index if exists public.ix_fk_aceptacion_legal_texto_legal_id;
drop index if exists public.ix_fk_aceptacion_politica_reserva_terminos_id;
drop index if exists public.ix_fk_addon_precio_pais_codigo;
drop index if exists public.ix_fk_addon_precio_updated_by;
drop index if exists public.ix_fk_ai_conversion_cliente_id;
drop index if exists public.ix_fk_ai_conversion_reserva_id;
drop index if exists public.ix_fk_ai_memoria_negocio_creado_por;
drop index if exists public.ix_fk_ai_memoria_negocio_sede_id;
drop index if exists public.ix_fk_ai_prompt_autor_id;
drop index if exists public.ix_fk_banner_home_updated_by;
drop index if exists public.ix_fk_beneficio_marca_marca_id;
drop index if exists public.ix_fk_cashback_movimiento_regla_id;
drop index if exists public.ix_fk_cashback_movimiento_reserva_id;
drop index if exists public.ix_fk_chat_lectura_usuario_id;
drop index if exists public.ix_fk_ciudad_habilitada_updated_by;
drop index if exists public.ix_fk_cliente_etiqueta_cliente_id;
drop index if exists public.ix_fk_cliente_etiqueta_creado_por;
drop index if exists public.ix_fk_cliente_membresia_plan_id;
drop index if exists public.ix_fk_cliente_nota_autor_id;
drop index if exists public.ix_fk_cliente_nota_cliente_id;
drop index if exists public.ix_fk_comision_cambio_programado_negocio_id;
drop index if exists public.ix_fk_conexion_pago_evento_conexion_id;
drop index if exists public.ix_fk_configuracion_plataforma_updated_by;
drop index if exists public.ix_fk_corporativo_consumo_miembro_id;
drop index if exists public.ix_fk_corporativo_consumo_reserva_id;
drop index if exists public.ix_fk_disponibilidad_sede_id;
drop index if exists public.ix_fk_egreso_caja_anulado_por;
drop index if exists public.ix_fk_egreso_caja_registrado_por;
drop index if exists public.ix_fk_evento_auditoria_impersonated_by;
drop index if exists public.ix_fk_familia_grupo_negocio_id;
drop index if exists public.ix_fk_familia_grupo_titular_cliente_id;
drop index if exists public.ix_fk_favorito_negocio_negocio_id;
drop index if exists public.ix_fk_gift_card_corporativo_cuenta_id;
drop index if exists public.ix_fk_gift_card_redencion_cliente_id;
drop index if exists public.ix_fk_invitacion_staff_invitado_por;
drop index if exists public.ix_fk_invitacion_staff_sede_id;
drop index if exists public.ix_fk_lealtad_fraude_evento_cliente_id;
drop index if exists public.ix_fk_lealtad_movimiento_negocio_id;
drop index if exists public.ix_fk_lealtad_movimiento_sede_id;
drop index if exists public.ix_fk_lista_espera_sede_id;
drop index if exists public.ix_fk_lista_espera_staff_id;
drop index if exists public.ix_fk_membresia_uso_reserva_id;
drop index if exists public.ix_fk_movimiento_inventario_actor_id;
drop index if exists public.ix_fk_movimiento_inventario_referencia_reserva_id;
drop index if exists public.ix_fk_movimiento_inventario_sede_id;
drop index if exists public.ix_fk_negocio_pais_codigo;
drop index if exists public.ix_fk_negocio_visita_perfil_campana_id;
drop index if exists public.ix_fk_negocio_visita_perfil_cliente_id;
drop index if exists public.ix_fk_nivel_staff_consolidado_temporada_id;
drop index if exists public.ix_fk_notificacion_envio_negocio_id;
drop index if exists public.ix_fk_notificacion_outbox_evento;
drop index if exists public.ix_fk_notificacion_outbox_negocio_id;
drop index if exists public.ix_fk_notificacion_plantilla_negocio_id;
drop index if exists public.ix_fk_notificacion_preferencia_evento;
drop index if exists public.ix_fk_oauth_estado_negocio_id;
drop index if exists public.ix_fk_pais_updated_by;
drop index if exists public.ix_fk_plan_precio_pais_codigo;
drop index if exists public.ix_fk_plan_precio_updated_by;
drop index if exists public.ix_fk_prueba_uso_owner_user_id;
drop index if exists public.ix_fk_puntaje_staff_evento_temporada_id;
drop index if exists public.ix_fk_punto_fidelizacion_negocio_id;
drop index if exists public.ix_fk_recompensa_regla_negocio_id;
drop index if exists public.ix_fk_recompensa_sugerencia_cliente_id;
drop index if exists public.ix_fk_recompensa_sugerencia_regla_id;
drop index if exists public.ix_fk_recurso_recurso_tipo_id;
drop index if exists public.ix_fk_recurso_tipo_negocio_id;
drop index if exists public.ix_fk_referido_negocio_id;
drop index if exists public.ix_fk_referido_referido_codigo_id;
drop index if exists public.ix_fk_referido_reserva_completada_id;
drop index if exists public.ix_fk_resena_moderado_por;
drop index if exists public.ix_fk_resena_staff_id;
drop index if exists public.ix_fk_reserva_foto_subido_por;
drop index if exists public.ix_fk_sello_cliente_cliente_id;
drop index if exists public.ix_fk_sello_evento_sello_cliente_id;
drop index if exists public.ix_fk_servicio_combo_item_servicio_id;
drop index if exists public.ix_fk_servicio_producto_consumo_producto_id;
drop index if exists public.ix_fk_servicio_requiere_recurso_tipo_id;
drop index if exists public.ix_fk_solicitud_reposicion_producto_id;
drop index if exists public.ix_fk_solicitud_reposicion_sede_id;
drop index if exists public.ix_fk_solicitud_reposicion_solicitado_por;
drop index if exists public.ix_fk_staff_referido_negocio_id;
drop index if exists public.ix_fk_staff_referido_reserva_completada_id;
drop index if exists public.ix_fk_suscripcion_fundador_plan_codigo;
drop index if exists public.ix_fk_suscripcion_pais_codigo;
drop index if exists public.ix_fk_suscripcion_plan_codigo;
drop index if exists public.ix_fk_suscripcion_plan_codigo_destino;
drop index if exists public.ix_fk_ticket_mensaje_autor_id;
drop index if exists public.ix_fk_vip_historial_nivel_anterior_id;
drop index if exists public.ix_fk_vip_historial_nivel_nuevo_id;
drop index if exists public.ix_fk_vip_historial_vip_miembro_id;
drop index if exists public.ix_fk_vip_miembro_asignado_por;
drop index if exists public.ix_fk_vip_miembro_nivel_id;
drop index if exists public.ix_fk_whatsapp_campana_creado_por;
drop index if exists public.ix_fk_whatsapp_campana_plantilla_id;
drop index if exists public.ix_fk_whatsapp_compra_recarga_paquete_id;
drop index if exists public.ix_fk_whatsapp_compra_recarga_solicitado_por;
drop index if exists public.ix_fk_whatsapp_config_updated_by;
drop index if exists public.ix_fk_whatsapp_consumo_lote_id;
drop index if exists public.ix_fk_whatsapp_paquete_created_by;
drop index if exists public.ix_fk_whatsapp_paquete_reemplaza_a;
drop index if exists public.ix_fk_whatsapp_plantilla_creado_por;

-- 2 · Políticas (texto original)
alter policy aceptacion_legal_propia on public.aceptacion_legal using ((usuario_id = auth.uid())) with check ((usuario_id = auth.uid()));
alter policy aceptacion_politica_select on public.aceptacion_politica_reserva using (((cliente_id = auth.uid()) OR is_barberia_de(negocio_id) OR is_supersu()));
alter policy bloqueo_ausencia_select on public.bloqueo_ausencia using ((EXISTS ( SELECT 1
   FROM vinculo_staff_negocio v
  WHERE ((v.id = bloqueo_ausencia.vinculo_id) AND ((v.staff_id = auth.uid()) OR tiene_acceso_interno(v.negocio_id))))));
alter policy bloqueo_ausencia_write_propio on public.bloqueo_ausencia using ((EXISTS ( SELECT 1
   FROM vinculo_staff_negocio v
  WHERE ((v.id = bloqueo_ausencia.vinculo_id) AND (v.staff_id = auth.uid())))));
alter policy cashback_movimiento_select on public.cashback_movimiento using (((cliente_id = auth.uid()) OR (regla_id IN ( SELECT cashback_regla.id
   FROM cashback_regla
  WHERE tiene_acceso_interno(cashback_regla.negocio_id))) OR is_supersu()));
alter policy chat_lectura_select_propia on public.chat_lectura using ((usuario_id = auth.uid()));
alter policy cliente_etiqueta_insert on public.cliente_etiqueta with check (((is_barberia_de(negocio_id) OR is_guardian_de_negocio(negocio_id)) AND (creado_por = auth.uid())));
alter policy cliente_membresia_select on public.cliente_membresia using (((cliente_id = auth.uid()) OR tiene_acceso_interno(negocio_id) OR is_supersu()));
alter policy cliente_nota_delete on public.cliente_nota using (((autor_id = auth.uid()) OR is_barberia_de(negocio_id)));
alter policy cliente_nota_insert on public.cliente_nota with check (((is_barberia_de(negocio_id) OR is_guardian_de_negocio(negocio_id)) AND (autor_id = auth.uid())));
alter policy cliente_preferencia_select_propia on public.cliente_preferencia using ((usuario_id = auth.uid()));
alter policy consentimiento_select_propio on public.consentimiento_evento using ((usuario_id = auth.uid()));
alter policy corporativo_consumo_select on public.corporativo_consumo using (((miembro_id IN ( SELECT corporativo_miembro.id
   FROM corporativo_miembro
  WHERE (corporativo_miembro.cliente_id = auth.uid()))) OR (miembro_id IN ( SELECT cm.id
   FROM (corporativo_miembro cm
     JOIN corporativo_cuenta cc ON ((cc.id = cm.cuenta_id)))
  WHERE (cc.admin_user_id = auth.uid()))) OR is_supersu()));
alter policy corporativo_cuenta_select on public.corporativo_cuenta using (((admin_user_id = auth.uid()) OR ((negocio_id IS NOT NULL) AND tiene_acceso_interno(negocio_id)) OR is_supersu()));
alter policy corporativo_miembro_select on public.corporativo_miembro using (((cliente_id = auth.uid()) OR (cuenta_id IN ( SELECT corporativo_cuenta.id
   FROM corporativo_cuenta
  WHERE (corporativo_cuenta.admin_user_id = auth.uid()))) OR (cuenta_id IN ( SELECT corporativo_cuenta.id
   FROM corporativo_cuenta
  WHERE ((corporativo_cuenta.negocio_id IS NOT NULL) AND tiene_acceso_interno(corporativo_cuenta.negocio_id)))) OR is_supersu()));
alter policy disponibilidad_select on public.disponibilidad using ((EXISTS ( SELECT 1
   FROM vinculo_staff_negocio v
  WHERE ((v.id = disponibilidad.vinculo_id) AND ((v.staff_id = auth.uid()) OR tiene_acceso_interno(v.negocio_id))))));
alter policy disponibilidad_write_propio on public.disponibilidad using ((EXISTS ( SELECT 1
   FROM vinculo_staff_negocio v
  WHERE ((v.id = disponibilidad.vinculo_id) AND (v.staff_id = auth.uid())))));
alter policy auditoria_select_actor on public.evento_auditoria using ((actor_id = auth.uid()));
alter policy familia_grupo_select on public.familia_grupo using (((titular_cliente_id = auth.uid()) OR _familia_miembro(id) OR ((negocio_id IS NOT NULL) AND tiene_acceso_interno(negocio_id)) OR is_supersu()));
alter policy familia_miembro_select on public.familia_miembro using (((cliente_id = auth.uid()) OR _familia_titular(familia_id) OR is_supersu()));
alter policy favorito_negocio_propio on public.favorito_negocio using ((cliente_id = auth.uid())) with check ((cliente_id = auth.uid()));
alter policy gift_card_select on public.gift_card using (((comprador_id = auth.uid()) OR (destinatario_email = (auth.jwt() ->> 'email'::text)) OR tiene_acceso_interno(negocio_id) OR is_supersu()));
alter policy gift_card_redencion_select on public.gift_card_redencion using (((cliente_id = auth.uid()) OR (gift_card_id IN ( SELECT gift_card.id
   FROM gift_card
  WHERE tiene_acceso_interno(gift_card.negocio_id))) OR is_supersu()));
alter policy invitacion_staff_insert_negocio on public.invitacion_staff with check ((is_barberia_de(negocio_id) AND (invitado_por = auth.uid())));
alter policy invitacion_staff_select_propia on public.invitacion_staff using ((email = ( SELECT perfil.email
   FROM perfil
  WHERE (perfil.id = auth.uid()))));
alter policy lealtad_movimiento_select_propio on public.lealtad_movimiento using (((wallet_id IN ( SELECT lealtad_wallet.id
   FROM lealtad_wallet
  WHERE (lealtad_wallet.cliente_id = auth.uid()))) OR is_supersu()));
alter policy lealtad_wallet_select_propio on public.lealtad_wallet using (((cliente_id = auth.uid()) OR is_supersu()));
alter policy lista_espera_delete_propia on public.lista_espera using ((cliente_id = auth.uid()));
alter policy lista_espera_insert_cliente on public.lista_espera with check ((cliente_id = auth.uid()));
alter policy lista_espera_select_propia on public.lista_espera using ((cliente_id = auth.uid()));
alter policy membresia_uso_select on public.membresia_uso using (((cliente_membresia_id IN ( SELECT cliente_membresia.id
   FROM cliente_membresia
  WHERE (cliente_membresia.cliente_id = auth.uid()))) OR (cliente_membresia_id IN ( SELECT cliente_membresia.id
   FROM cliente_membresia
  WHERE tiene_acceso_interno(cliente_membresia.negocio_id))) OR is_supersu()));
alter policy negocio_insert_owner on public.negocio with check ((owner_user_id = auth.uid()));
alter policy negocio_select_invitado on public.negocio using ((EXISTS ( SELECT 1
   FROM invitacion_staff i
  WHERE ((i.negocio_id = negocio.id) AND (i.estado = 'PENDIENTE'::invitacion_staff_estado) AND (i.email = ( SELECT perfil.email
           FROM perfil
          WHERE (perfil.id = auth.uid())))))));
alter policy nivel_consolidado_select_propio on public.nivel_staff_consolidado using ((EXISTS ( SELECT 1
   FROM vinculo_staff_negocio v
  WHERE ((v.id = nivel_staff_consolidado.vinculo_id) AND (v.staff_id = auth.uid())))));
alter policy notificacion_select_propia on public.notificacion_envio using ((destinatario_id = auth.uid()));
alter policy notificacion_outbox_select_propia on public.notificacion_outbox using ((usuario_id = auth.uid()));
alter policy notificacion_preferencia_select_propia on public.notificacion_preferencia using ((usuario_id = auth.uid()));
alter policy notificacion_push_select_propia on public.notificacion_push_suscripcion using ((usuario_id = auth.uid()));
alter policy notificacion_usuario_select_propia on public.notificacion_usuario using ((usuario_id = auth.uid()));
alter policy pago_select_cliente on public.pago using (((EXISTS ( SELECT 1
   FROM reserva r
  WHERE ((r.id = pago.reserva_id) AND (r.cliente_id = auth.uid())))) OR (staff_destino_id = auth.uid())));
alter policy perfil_insert_propio on public.perfil with check ((id = auth.uid()));
alter policy perfil_select_propio on public.perfil using (((id = auth.uid()) OR is_supersu()));
alter policy perfil_update_propio on public.perfil using (((id = auth.uid()) OR is_supersu()));
alter policy puntaje_select_propio on public.puntaje_staff_evento using ((EXISTS ( SELECT 1
   FROM vinculo_staff_negocio v
  WHERE ((v.id = puntaje_staff_evento.vinculo_id) AND (v.staff_id = auth.uid())))));
alter policy punto_select_cliente on public.punto_fidelizacion using ((cliente_id = auth.uid()));
alter policy reembolso_select on public.reembolso using (((cliente_id = auth.uid()) OR is_barberia_de(negocio_id) OR is_supersu()));
alter policy reembolso_evento_select on public.reembolso_evento using ((EXISTS ( SELECT 1
   FROM reembolso r
  WHERE ((r.id = reembolso_evento.reembolso_id) AND ((r.cliente_id = auth.uid()) OR is_barberia_de(r.negocio_id) OR is_supersu())))));
alter policy referido_select on public.referido using (((referente_cliente_id = auth.uid()) OR (referido_cliente_id = auth.uid()) OR tiene_acceso_interno(negocio_id) OR is_supersu()));
alter policy referido_codigo_select_propio on public.referido_codigo using (((cliente_id = auth.uid()) OR is_supersu()));
alter policy resena_insert_cliente on public.resena with check (((cliente_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM reserva r
  WHERE ((r.id = resena.reserva_id) AND (r.cliente_id = auth.uid()) AND (r.estado = 'COMPLETADA'::reserva_estado))))));
alter policy resena_select_propio on public.resena using ((cliente_id = auth.uid()));
alter policy resena_update_cliente_48h on public.resena using (((cliente_id = auth.uid()) AND (created_at > (now() - '48:00:00'::interval))));
alter policy reserva_insert_cliente on public.reserva with check ((cliente_id = auth.uid()));
alter policy reserva_select_cliente on public.reserva using ((cliente_id = auth.uid()));
alter policy reserva_select_staff on public.reserva using ((staff_id = auth.uid()));
alter policy reserva_update_cliente on public.reserva using ((cliente_id = auth.uid()));
alter policy reserva_update_staff on public.reserva using ((staff_id = auth.uid()));
alter policy reserva_foto_insert on public.reserva_foto with check (((is_barberia_de(negocio_id) OR is_guardian_de_negocio(negocio_id)) AND (subido_por = auth.uid()) AND (EXISTS ( SELECT 1
   FROM reserva r
  WHERE ((r.id = reserva_foto.reserva_id) AND (r.estado = 'COMPLETADA'::reserva_estado) AND (r.cliente_id = reserva_foto.cliente_id))))));
alter policy reserva_foto_select on public.reserva_foto using ((is_barberia_de(negocio_id) OR is_guardian_de_negocio(negocio_id) OR (cliente_id = auth.uid()) OR is_supersu()));
alter policy sello_cliente_select on public.sello_cliente using (((cliente_id = auth.uid()) OR (campana_id IN ( SELECT sello_campana.id
   FROM sello_campana
  WHERE tiene_acceso_interno(sello_campana.negocio_id))) OR is_supersu()));
alter policy sello_evento_select on public.sello_evento using (((sello_cliente_id IN ( SELECT sello_cliente.id
   FROM sello_cliente
  WHERE (sello_cliente.cliente_id = auth.uid()))) OR (sello_cliente_id IN ( SELECT sc.id
   FROM (sello_cliente sc
     JOIN sello_campana c ON ((c.id = sc.campana_id)))
  WHERE tiene_acceso_interno(c.negocio_id))) OR is_supersu()));
alter policy solicitud_cuenta_select_propia on public.solicitud_cuenta using ((usuario_id = auth.uid()));
alter policy solicitud_devolucion_select_propia on public.solicitud_devolucion_saldo using ((cliente_id = auth.uid()));
alter policy solicitud_reposicion_insert on public.solicitud_reposicion with check (((is_barberia_de(negocio_id) OR is_guardian_de_sede(sede_id)) AND (solicitado_por = auth.uid())));
alter policy solicitud_reposicion_update_cancelar on public.solicitud_reposicion using (((solicitado_por = auth.uid()) OR is_barberia_de(negocio_id)));
alter policy staff_select_propio on public.staff using (((usuario_id = auth.uid()) OR is_supersu()));
alter policy staff_update_propio on public.staff using (((usuario_id = auth.uid()) OR is_supersu()));
alter policy staff_upsert_propio on public.staff with check ((usuario_id = auth.uid()));
alter policy staff_referido_select on public.staff_referido using (((staff_id = auth.uid()) OR tiene_acceso_interno(negocio_id) OR is_supersu()));
alter policy ticket_mensaje_select_propio on public.ticket_mensaje using ((is_supersu() OR (EXISTS ( SELECT 1
   FROM ticket_soporte t
  WHERE ((t.id = ticket_mensaje.ticket_id) AND (t.creado_por = auth.uid()))))));
alter policy ticket_soporte_select_propio on public.ticket_soporte using (((creado_por = auth.uid()) OR is_supersu()));
alter policy vinculo_select_propio on public.vinculo_staff_negocio using ((staff_id = auth.uid()));
alter policy vip_historial_select on public.vip_historial using (((vip_miembro_id IN ( SELECT vip_miembro.id
   FROM vip_miembro
  WHERE (vip_miembro.cliente_id = auth.uid()))) OR (vip_miembro_id IN ( SELECT vip_miembro.id
   FROM vip_miembro
  WHERE tiene_acceso_interno(vip_miembro.negocio_id))) OR is_supersu()));
alter policy vip_miembro_select on public.vip_miembro using (((cliente_id = auth.uid()) OR tiene_acceso_interno(negocio_id) OR is_supersu()));

-- 3 · Función original
create or replace function public.obtener_mi_codigo_referido()
 returns public.referido_codigo
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_codigo public.referido_codigo;
begin
  select * into v_codigo from public.referido_codigo where cliente_id = auth.uid();
  if not found then
    insert into public.referido_codigo (cliente_id, codigo)
    values (auth.uid(), upper(substr(replace(auth.uid()::text, '-', ''), 1, 8)))
    returning * into v_codigo;
  end if;
  return v_codigo;
end;
$function$;

commit;