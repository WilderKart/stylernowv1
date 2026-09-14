-- StylerNow — Migración 006: Row Level Security
-- Fuente: 06-Security/02_RLS.md — "Políticas por entidad (resumen normativo)"
-- Principio: RLS por defecto denegado. Toda tabla de dominio tiene política declarada.

-- ════════════════════════════════════════════════════════════════════════
-- perfil
-- ════════════════════════════════════════════════════════════════════════
alter table public.perfil enable row level security;

create policy perfil_select_propio on public.perfil for select
  using (id = auth.uid() or public.is_supersu());

create policy perfil_update_propio on public.perfil for update
  using (id = auth.uid() or public.is_supersu());

create policy perfil_insert_propio on public.perfil for insert
  with check (id = auth.uid());

-- Negocios ven el nombre/foto de sus propios Clientes vía CRM (03-Business-Rules/07_CRM.md):
-- particionado por tener al menos una reserva con ese negocio — ver política en `reserva`
-- que ya limita qué reservas ve un Negocio; aquí exponemos una vista mínima adicional.
create policy perfil_select_crm_negocio on public.perfil for select
  using (
    exists (
      select 1 from public.reserva r
      where r.cliente_id = perfil.id
        and (public.is_barberia_de(r.negocio_id) or public.is_staff_de(r.negocio_id))
    )
  );

-- ════════════════════════════════════════════════════════════════════════
-- negocio
-- ════════════════════════════════════════════════════════════════════════
alter table public.negocio enable row level security;

create policy negocio_select_publico on public.negocio for select
  using (estado = 'ACTIVO');

create policy negocio_select_interno on public.negocio for select
  using (public.is_barberia_de(id) or public.is_staff_de(id) or public.is_supersu());

create policy negocio_insert_owner on public.negocio for insert
  with check (owner_user_id = auth.uid());

create policy negocio_update_barberia on public.negocio for update
  using (public.is_barberia_de(id) or public.is_supersu());

-- ════════════════════════════════════════════════════════════════════════
-- sede / recurso_tipo / recurso
-- ════════════════════════════════════════════════════════════════════════
alter table public.sede enable row level security;
alter table public.recurso_tipo enable row level security;
alter table public.recurso enable row level security;

create policy sede_select_publico on public.sede for select
  using (exists (select 1 from public.negocio n where n.id = sede.negocio_id and n.estado = 'ACTIVO'));

create policy sede_select_interno on public.sede for select
  using (public.tiene_acceso_interno(negocio_id) or public.is_supersu());

create policy sede_insert_barberia on public.sede for insert
  with check (public.is_barberia_de(negocio_id));

create policy sede_update_barberia_guardian on public.sede for update
  using (public.is_barberia_de(negocio_id) or public.is_guardian_de_sede(id) or public.is_supersu());

create policy sede_delete_barberia on public.sede for delete
  using (public.is_barberia_de(negocio_id));

create policy recurso_tipo_select on public.recurso_tipo for select
  using (public.tiene_acceso_interno(negocio_id) or public.is_supersu()
    or exists (select 1 from public.negocio n where n.id = recurso_tipo.negocio_id and n.estado = 'ACTIVO'));
create policy recurso_tipo_write_barberia on public.recurso_tipo for all
  using (public.is_barberia_de(negocio_id)) with check (public.is_barberia_de(negocio_id));

create policy recurso_select on public.recurso for select
  using (exists (select 1 from public.sede s where s.id = recurso.sede_id
    and (public.tiene_acceso_interno(s.negocio_id) or public.is_supersu()
      or exists (select 1 from public.negocio n where n.id = s.negocio_id and n.estado = 'ACTIVO'))));
create policy recurso_write_barberia_guardian on public.recurso for all
  using (exists (select 1 from public.sede s where s.id = recurso.sede_id
    and (public.is_barberia_de(s.negocio_id) or public.is_guardian_de_sede(s.id))));

-- ════════════════════════════════════════════════════════════════════════
-- servicio (+ protección de precio: solo Barbería, ver trigger abajo)
-- ════════════════════════════════════════════════════════════════════════
alter table public.servicio enable row level security;

create policy servicio_select_publico on public.servicio for select
  using (estado = 'ACTIVO' and exists (select 1 from public.negocio n where n.id = servicio.negocio_id and n.estado = 'ACTIVO'));

create policy servicio_select_interno on public.servicio for select
  using (public.tiene_acceso_interno(negocio_id) or public.is_supersu());

create policy servicio_insert_barberia on public.servicio for insert
  with check (public.is_barberia_de(negocio_id));

create policy servicio_update_barberia_guardian on public.servicio for update
  using (public.is_barberia_de(negocio_id) or public.is_guardian_de_negocio(negocio_id));

create policy servicio_delete_barberia on public.servicio for delete
  using (public.is_barberia_de(negocio_id));

-- Matriz 03-Business-Rules/01_Roles.md: "Cambiar precio" es exclusivo de Barbería,
-- aunque "Editar duración"/"Activar-Desactivar" sean 🏢 (Guardian). RLS es a nivel de
-- fila, no de columna — se refuerza con trigger.
create or replace function public.proteger_precio_servicio()
returns trigger language plpgsql as $$
begin
  if new.precio_base is distinct from old.precio_base and not public.is_barberia_de(old.negocio_id) then
    raise exception 'Solo la Barbería puede cambiar el precio de un Servicio';
  end if;
  return new;
end;
$$;
create trigger trg_proteger_precio_servicio
  before update on public.servicio
  for each row execute function public.proteger_precio_servicio();

create trigger trg_updated_at_servicio2 before update on public.servicio
  for each row execute function public.set_updated_at();

-- ════════════════════════════════════════════════════════════════════════
-- staff / vinculo_staff_negocio / staff_servicio / disponibilidad / bloqueo_ausencia
-- ════════════════════════════════════════════════════════════════════════
alter table public.staff enable row level security;
alter table public.vinculo_staff_negocio enable row level security;
alter table public.staff_servicio enable row level security;
alter table public.disponibilidad enable row level security;
alter table public.bloqueo_ausencia enable row level security;

create policy staff_select_propio on public.staff for select
  using (usuario_id = auth.uid() or public.is_supersu());
create policy staff_select_publico on public.staff for select
  using (exists (
    select 1 from public.vinculo_staff_negocio v join public.negocio n on n.id = v.negocio_id
    where v.staff_id = staff.usuario_id and v.estado = 'ACTIVO' and n.estado = 'ACTIVO'
  ));
create policy staff_select_interno on public.staff for select
  using (exists (select 1 from public.vinculo_staff_negocio v
    where v.staff_id = staff.usuario_id and public.tiene_acceso_interno(v.negocio_id)));
create policy staff_upsert_propio on public.staff for insert with check (usuario_id = auth.uid());
create policy staff_update_propio on public.staff for update using (usuario_id = auth.uid() or public.is_supersu());

create policy vinculo_select_propio on public.vinculo_staff_negocio for select
  using (staff_id = auth.uid());
create policy vinculo_select_interno on public.vinculo_staff_negocio for select
  using (public.is_barberia_de(negocio_id) or public.is_guardian_de_negocio(negocio_id) or public.is_supersu());
-- Solo Barbería: invitar/trasladar/otorgar-quitar Guardian/suspender (03-Business-Rules/01_Roles.md)
create policy vinculo_write_barberia on public.vinculo_staff_negocio for all
  using (public.is_barberia_de(negocio_id)) with check (public.is_barberia_de(negocio_id));

create policy staff_servicio_select on public.staff_servicio for select
  using (exists (select 1 from public.staff s where s.usuario_id = staff_servicio.staff_id));
create policy staff_servicio_write_barberia on public.staff_servicio for all
  using (exists (select 1 from public.servicio sv where sv.id = staff_servicio.servicio_id and public.is_barberia_de(sv.negocio_id)));

create policy disponibilidad_select on public.disponibilidad for select
  using (exists (select 1 from public.vinculo_staff_negocio v where v.id = disponibilidad.vinculo_id
    and (v.staff_id = auth.uid() or public.tiene_acceso_interno(v.negocio_id))));
create policy disponibilidad_write_propio on public.disponibilidad for all
  using (exists (select 1 from public.vinculo_staff_negocio v where v.id = disponibilidad.vinculo_id and v.staff_id = auth.uid()));
create policy disponibilidad_write_barberia_guardian on public.disponibilidad for all
  using (exists (select 1 from public.vinculo_staff_negocio v where v.id = disponibilidad.vinculo_id
    and (public.is_barberia_de(v.negocio_id) or public.is_guardian_de_sede(v.sede_activa_id))));

create policy bloqueo_ausencia_select on public.bloqueo_ausencia for select
  using (exists (select 1 from public.vinculo_staff_negocio v where v.id = bloqueo_ausencia.vinculo_id
    and (v.staff_id = auth.uid() or public.tiene_acceso_interno(v.negocio_id))));
create policy bloqueo_ausencia_write_propio on public.bloqueo_ausencia for all
  using (exists (select 1 from public.vinculo_staff_negocio v where v.id = bloqueo_ausencia.vinculo_id and v.staff_id = auth.uid()));
create policy bloqueo_ausencia_write_barberia_guardian on public.bloqueo_ausencia for all
  using (exists (select 1 from public.vinculo_staff_negocio v where v.id = bloqueo_ausencia.vinculo_id
    and (public.is_barberia_de(v.negocio_id) or public.is_guardian_de_sede(v.sede_activa_id))));

-- ════════════════════════════════════════════════════════════════════════
-- reserva / reserva_servicio
-- ════════════════════════════════════════════════════════════════════════
alter table public.reserva enable row level security;
alter table public.reserva_servicio enable row level security;

create policy reserva_select_cliente on public.reserva for select using (cliente_id = auth.uid());
create policy reserva_select_staff on public.reserva for select using (staff_id = auth.uid());
create policy reserva_select_guardian on public.reserva for select using (public.is_guardian_de_sede(sede_id));
create policy reserva_select_barberia on public.reserva for select using (public.is_barberia_de(negocio_id));
create policy reserva_select_supersu on public.reserva for select using (public.is_supersu());

create policy reserva_insert_cliente on public.reserva for insert with check (cliente_id = auth.uid());
create policy reserva_insert_interno on public.reserva for insert
  with check (public.is_barberia_de(negocio_id) or public.is_guardian_de_sede(sede_id));

create policy reserva_update_cliente on public.reserva for update using (cliente_id = auth.uid());
create policy reserva_update_staff on public.reserva for update using (staff_id = auth.uid());
create policy reserva_update_interno on public.reserva for update
  using (public.is_barberia_de(negocio_id) or public.is_guardian_de_sede(sede_id));

create policy reserva_servicio_select on public.reserva_servicio for select
  using (exists (select 1 from public.reserva r where r.id = reserva_servicio.reserva_id));
create policy reserva_servicio_insert on public.reserva_servicio for insert
  with check (exists (select 1 from public.reserva r where r.id = reserva_servicio.reserva_id
    and (r.cliente_id = auth.uid() or public.is_barberia_de(r.negocio_id) or public.is_guardian_de_sede(r.sede_id))));

-- ════════════════════════════════════════════════════════════════════════
-- pago (escritura solo vía Edge Functions con service_role — 05-API/04_Payments.md)
-- ════════════════════════════════════════════════════════════════════════
alter table public.pago enable row level security;

create policy pago_select_cliente on public.pago for select
  using (exists (select 1 from public.reserva r where r.id = pago.reserva_id and r.cliente_id = auth.uid())
    or staff_destino_id = auth.uid());
create policy pago_select_interno on public.pago for select
  using (exists (select 1 from public.reserva r where r.id = pago.reserva_id
    and (public.is_barberia_de(r.negocio_id) or public.is_guardian_de_sede(r.sede_id) or public.is_staff_de(r.negocio_id)))
    or public.is_barberia_de(pago.negocio_id) or public.is_supersu());
-- Sin política de INSERT/UPDATE para roles de producto: todo cobro/reembolso pasa por
-- Edge Function con service_role, consistente con "nunca escritura directa" (06-Security/02_RLS.md).

-- ════════════════════════════════════════════════════════════════════════
-- punto_fidelizacion (lectura amplia, escritura solo sistema)
-- ════════════════════════════════════════════════════════════════════════
alter table public.punto_fidelizacion enable row level security;

create policy punto_select_cliente on public.punto_fidelizacion for select using (cliente_id = auth.uid());
create policy punto_select_interno on public.punto_fidelizacion for select
  using (public.tiene_acceso_interno(negocio_id) or public.is_supersu());

-- ════════════════════════════════════════════════════════════════════════
-- Sistema PRO/EXPERT/MASTER (solo lectura para roles de producto)
-- ════════════════════════════════════════════════════════════════════════
alter table public.temporada enable row level security;
alter table public.puntaje_staff_evento enable row level security;
alter table public.nivel_staff_consolidado enable row level security;

create policy temporada_select_todos on public.temporada for select using (true);

create policy puntaje_select_propio on public.puntaje_staff_evento for select
  using (exists (select 1 from public.vinculo_staff_negocio v where v.id = puntaje_staff_evento.vinculo_id and v.staff_id = auth.uid()));
create policy puntaje_select_interno on public.puntaje_staff_evento for select
  using (exists (select 1 from public.vinculo_staff_negocio v where v.id = puntaje_staff_evento.vinculo_id
    and (public.is_barberia_de(v.negocio_id) or public.is_guardian_de_sede(v.sede_activa_id))) or public.is_supersu());

create policy nivel_consolidado_select_propio on public.nivel_staff_consolidado for select
  using (exists (select 1 from public.vinculo_staff_negocio v where v.id = nivel_staff_consolidado.vinculo_id and v.staff_id = auth.uid()));
create policy nivel_consolidado_select_interno on public.nivel_staff_consolidado for select
  using (exists (select 1 from public.vinculo_staff_negocio v where v.id = nivel_staff_consolidado.vinculo_id
    and public.tiene_acceso_interno(v.negocio_id)) or public.is_supersu());

-- ════════════════════════════════════════════════════════════════════════
-- resena
-- ════════════════════════════════════════════════════════════════════════
alter table public.resena enable row level security;

create policy resena_select_publico on public.resena for select using (estado = 'VISIBLE');
create policy resena_select_propio on public.resena for select using (cliente_id = auth.uid());
create policy resena_select_interno on public.resena for select using (public.tiene_acceso_interno(negocio_id) or public.is_supersu());
create policy resena_insert_cliente on public.resena for insert
  with check (cliente_id = auth.uid() and exists (
    select 1 from public.reserva r where r.id = resena.reserva_id and r.cliente_id = auth.uid() and r.estado = 'COMPLETADA'
  ));
create policy resena_update_cliente_48h on public.resena for update
  using (cliente_id = auth.uid() and created_at > now() - interval '48 hours');
create policy resena_update_respuesta_negocio on public.resena for update
  using (public.tiene_acceso_interno(negocio_id));
create policy resena_moderacion_supersu on public.resena for update using (public.is_supersu());

-- ════════════════════════════════════════════════════════════════════════
-- lista_espera
-- ════════════════════════════════════════════════════════════════════════
alter table public.lista_espera enable row level security;

create policy lista_espera_select_propia on public.lista_espera for select using (cliente_id = auth.uid());
create policy lista_espera_select_interno on public.lista_espera for select
  using (public.is_barberia_de(negocio_id) or public.is_guardian_de_sede(sede_id));
create policy lista_espera_insert_cliente on public.lista_espera for insert with check (cliente_id = auth.uid());
create policy lista_espera_insert_interno on public.lista_espera for insert
  with check (public.is_barberia_de(negocio_id) or public.is_guardian_de_sede(sede_id));
create policy lista_espera_delete_propia on public.lista_espera for delete using (cliente_id = auth.uid());

-- ════════════════════════════════════════════════════════════════════════
-- wallet / wallet_movimiento (solo lectura del propio negocio)
-- ════════════════════════════════════════════════════════════════════════
alter table public.wallet enable row level security;
alter table public.wallet_movimiento enable row level security;

create policy wallet_select_negocio on public.wallet for select
  using (public.is_barberia_de(negocio_id) or public.is_guardian_de_negocio(negocio_id) or public.is_supersu());
create policy wallet_mov_select on public.wallet_movimiento for select
  using (exists (select 1 from public.wallet w where w.id = wallet_movimiento.wallet_id
    and (public.is_barberia_de(w.negocio_id) or public.is_supersu())));

-- ════════════════════════════════════════════════════════════════════════
-- plan / suscripcion (plan público, suscripción propia; escritura solo SuperSU/sistema)
-- ════════════════════════════════════════════════════════════════════════
alter table public.plan enable row level security;
alter table public.suscripcion enable row level security;

create policy plan_select_publico on public.plan for select using (true);
create policy plan_write_supersu on public.plan for all using (public.is_supersu()) with check (public.is_supersu());

create policy suscripcion_select_negocio on public.suscripcion for select
  using (public.is_barberia_de(negocio_id) or public.is_supersu());
create policy suscripcion_write_supersu on public.suscripcion for all using (public.is_supersu());

-- ════════════════════════════════════════════════════════════════════════
-- campana_publicitaria
-- ════════════════════════════════════════════════════════════════════════
alter table public.campana_publicitaria enable row level security;

create policy campana_select_interno on public.campana_publicitaria for select
  using (public.tiene_acceso_interno(negocio_id) or public.is_supersu());
create policy campana_write_barberia on public.campana_publicitaria for all
  using (public.is_barberia_de(negocio_id)) with check (public.is_barberia_de(negocio_id));
create policy campana_pausa_supersu on public.campana_publicitaria for update using (public.is_supersu());

-- ════════════════════════════════════════════════════════════════════════
-- créditos IA / WhatsApp (lectura interna, escritura solo sistema)
-- ════════════════════════════════════════════════════════════════════════
alter table public.credito_ia_lote enable row level security;
alter table public.credito_ia_consumo enable row level security;
alter table public.whatsapp_conversacion_lote enable row level security;

create policy credito_ia_lote_select on public.credito_ia_lote for select
  using (public.tiene_acceso_interno(negocio_id) or public.is_supersu());
create policy credito_ia_consumo_select on public.credito_ia_consumo for select
  using (public.tiene_acceso_interno(negocio_id) or public.is_supersu());
create policy whatsapp_lote_select on public.whatsapp_conversacion_lote for select
  using (public.tiene_acceso_interno(negocio_id) or public.is_supersu());

-- ════════════════════════════════════════════════════════════════════════
-- notificacion_envio / evento_auditoria / feature_flag / textos legales
-- ════════════════════════════════════════════════════════════════════════
alter table public.notificacion_envio enable row level security;
alter table public.evento_auditoria enable row level security;
alter table public.feature_flag enable row level security;
alter table public.texto_legal enable row level security;
alter table public.aceptacion_legal enable row level security;

create policy notificacion_select_propia on public.notificacion_envio for select using (destinatario_id = auth.uid());

create policy auditoria_select_negocio on public.evento_auditoria for select
  using (public.is_barberia_de(negocio_id));
create policy auditoria_select_actor on public.evento_auditoria for select using (actor_id = auth.uid());
create policy auditoria_select_supersu on public.evento_auditoria for select using (public.is_supersu());

create policy feature_flag_select_publico on public.feature_flag for select using (true);
create policy feature_flag_write_supersu on public.feature_flag for all using (public.is_supersu());

create policy texto_legal_select_publico on public.texto_legal for select using (true);
create policy texto_legal_write_supersu on public.texto_legal for all using (public.is_supersu());

create policy aceptacion_legal_propia on public.aceptacion_legal for all
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
