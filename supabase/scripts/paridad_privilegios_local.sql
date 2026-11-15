-- Paridad de privilegios con producción para la base LOCAL de pruebas (la CLI local nueva no otorga los default privileges
-- de Supabase que producción sí tiene). Extraído de tests/sql/aislamiento_multiempresa.sql; los revokes reaplican 116/117/119/120/125.
-- SOLO base local. begin/commit propio.
begin;
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

-- 116
revoke insert, update, delete, truncate on public.aceptacion_politica_reserva from public, anon, authenticated;
revoke insert, update, delete, truncate on public.reembolso, public.reembolso_evento from public, anon, authenticated;
revoke usage on sequence public.reembolso_evento_id_seq from public, anon, authenticated;
revoke all on public.aceptacion_politica_reserva, public.reembolso, public.reembolso_evento from anon;
revoke insert, update, delete, truncate on public.aceptacion_politica_reserva, public.reembolso, public.reembolso_evento from service_role;
-- 117
revoke all on public.comision_cambio_programado from public, anon;
revoke insert, update, delete, truncate on public.comision_cambio_programado from authenticated, service_role;
do $$
declare t text;
begin
  foreach t in array array['wallet_movimiento','lealtad_movimiento','cashback_movimiento','evento_auditoria',
                           'credito_ia_consumo','gift_card_redencion','membresia_uso'] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke update, delete, truncate on public.%I from public, anon, authenticated, service_role', t);
    end if;
  end loop;
  foreach t in array array['pago','wallet','wallet_movimiento','lealtad_wallet','lealtad_movimiento','cashback_movimiento',
                           'gift_card','gift_card_redencion','membresia_uso','credito_ia_consumo','credito_ia_lote',
                           'solicitud_devolucion_saldo','suscripcion_fundador','prueba_uso','evento_auditoria',
                           'configuracion_plataforma'] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke insert, update, delete, truncate on public.%I from public, anon, authenticated', t);
    end if;
  end loop;
end $$;
revoke delete, truncate on public.pago from public, anon, authenticated, service_role;
-- 119
revoke all on public.conexion_pago_negocio, public.conexion_pago_evento, public.oauth_estado from public, anon, authenticated;
revoke insert, update, delete, truncate on public.conexion_pago_negocio, public.conexion_pago_evento, public.oauth_estado from service_role;
revoke all on public.webhook_evento from public, anon;
revoke insert, update, delete, truncate on public.webhook_evento from authenticated;
-- 120
revoke all on public.whatsapp_config, public.whatsapp_paquete, public.whatsapp_compra_recarga, public.whatsapp_plantilla,
  public.whatsapp_campana, public.whatsapp_mensaje, public.whatsapp_mensaje_evento, public.whatsapp_consumo,
  public.whatsapp_alerta from public, anon, authenticated;
grant select on public.whatsapp_config, public.whatsapp_paquete, public.whatsapp_compra_recarga, public.whatsapp_plantilla,
  public.whatsapp_campana, public.whatsapp_mensaje, public.whatsapp_mensaje_evento, public.whatsapp_consumo,
  public.whatsapp_alerta to authenticated;
revoke insert, update, delete on public.whatsapp_conversacion_lote from public, anon, authenticated;
-- 125
revoke insert, update, delete, truncate on public.reserva_servicio from public, anon, authenticated;

commit;
