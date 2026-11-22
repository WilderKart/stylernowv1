-- 177: Barberos adicionales (FASE 2A) — cola de reembolsos y de pagos en revisión, administrables y auditadas por SuperAdmin.
--
-- Política: NO hay reembolsos automáticos. Cancelar una contratación futura no devuelve el periodo ya pagado. Casos de revisión
-- individual: cobro duplicado, cobro incorrecto, error técnico, pago no reconocido, obligación legal.
-- Este proceso REGISTRA la solicitud, la decisión (con motivo y responsable) y el estado. La EJECUCIÓN real del reembolso en Mercado
-- Pago NO está conectada: el worker existente (116) opera sobre la tabla `reembolso` de reservas (checks de motivo/origen propios y
-- efectos sobre wallet/reserva) y extenderlo queda fuera del alcance de la Fase 2A. El operador devuelve el dinero en el panel de
-- Mercado Pago y anota aquí el id del reembolso (EJECUTADO_MANUAL, referencia obligatoria).
-- Rollback: 177_adicionales_reembolsos_y_revision_admin_REVERSION.sql.txt.

create or replace function public.admin_adicional_reembolso_solicitar(p_pago_id uuid, p_causa text, p_detalle text, p_motivo text, p_monto numeric default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_p public.pago; v_c public.adicional_cobro; v_r public.adicional_reembolso; v_monto numeric;
begin
  perform public._adicional_exige_supersu(p_motivo);
  select * into v_p from public.pago where id = p_pago_id;
  if not found or v_p.tipo <> 'SUSCRIPCION' or coalesce(v_p.metadata ->> 'concepto', '') <> 'STAFF_EXTRA' then raise exception 'PAGO_NO_ES_ADICIONAL'; end if;
  if p_causa is null or p_causa not in ('COBRO_DUPLICADO', 'COBRO_INCORRECTO', 'ERROR_TECNICO', 'PAGO_NO_RECONOCIDO', 'OBLIGACION_LEGAL', 'OTRO') then raise exception 'CAUSA_INVALIDA'; end if;
  v_monto := coalesce(p_monto, v_p.monto);
  if v_monto <= 0 or v_monto > v_p.monto then raise exception 'MONTO_INVALIDO'; end if;
  select * into v_c from public.adicional_cobro where pago_id = p_pago_id;
  insert into public.adicional_reembolso (lote_id, cobro_id, pago_id, negocio_id, monto, causa, detalle, solicitado_por)
  values (v_c.lote_id, v_c.id, p_pago_id, v_p.negocio_id, v_monto, p_causa, left(p_detalle, 1000), auth.uid())
  returning * into v_r;
  perform public._auditar('adicional_reembolso', v_r.id, 'ADICIONAL_REEMBOLSO_SOLICITADO', v_p.negocio_id, null,
                          jsonb_build_object('pago_id', p_pago_id, 'monto', v_monto, 'causa', p_causa), p_motivo);
  return to_jsonb(v_r);
exception when unique_violation then
  raise exception 'REEMBOLSO_YA_ABIERTO';
end $$;
revoke all on function public.admin_adicional_reembolso_solicitar(uuid, text, text, text, numeric) from public, anon, authenticated;
grant execute on function public.admin_adicional_reembolso_solicitar(uuid, text, text, text, numeric) to authenticated;

-- decision: EN_REVISION | APROBADO | RECHAZADO | EJECUTADO_MANUAL (requiere referencia; opcional cerrar el lote como REEMBOLSADO)
create or replace function public.admin_adicional_reembolso_decidir(p_id uuid, p_decision text, p_motivo text, p_referencia text default null, p_cerrar_lote boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_r public.adicional_reembolso; v_antes public.adicional_reembolso;
begin
  perform public._adicional_exige_supersu(p_motivo);
  select * into v_r from public.adicional_reembolso where id = p_id for update;
  if not found then raise exception 'REEMBOLSO_NO_ENCONTRADO'; end if;
  v_antes := v_r;
  if not ((v_r.estado = 'SOLICITADO' and p_decision in ('EN_REVISION', 'APROBADO', 'RECHAZADO'))
       or (v_r.estado = 'EN_REVISION' and p_decision in ('APROBADO', 'RECHAZADO'))
       or (v_r.estado = 'APROBADO' and p_decision = 'EJECUTADO_MANUAL')) then
    raise exception 'TRANSICION_REEMBOLSO_NO_PERMITIDA: % -> %', v_r.estado, p_decision;
  end if;
  if p_decision = 'EJECUTADO_MANUAL' and length(btrim(coalesce(p_referencia, ''))) < 3 then raise exception 'REFERENCIA_REQUERIDA'; end if;
  update public.adicional_reembolso set estado = p_decision, decidido_por = auth.uid(), decision_motivo = left(p_motivo, 500), decidido_at = now(),
         referencia_ejecucion = case when p_decision = 'EJECUTADO_MANUAL' then left(p_referencia, 200) else referencia_ejecucion end, updated_at = now()
   where id = p_id returning * into v_r;
  if p_decision = 'EJECUTADO_MANUAL' then
    update public.adicional_cobro set estado = 'REEMBOLSADO', updated_at = now() where id = v_r.cobro_id and estado = 'APROBADO';
    if p_cerrar_lote and v_r.lote_id is not null then
      perform public._adicional_transicionar(v_r.lote_id, 'REEMBOLSADO', 'REEMBOLSADO', 'SUPERSU', auth.uid(), p_motivo, v_r.pago_id);
    end if;
  end if;
  perform public._auditar('adicional_reembolso', p_id, 'ADICIONAL_REEMBOLSO_' || p_decision, v_r.negocio_id, jsonb_build_object('estado', v_antes.estado),
                          jsonb_build_object('estado', p_decision, 'referencia', p_referencia, 'cerrar_lote', p_cerrar_lote), p_motivo);
  return to_jsonb(v_r);
end $$;
revoke all on function public.admin_adicional_reembolso_decidir(uuid, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.admin_adicional_reembolso_decidir(uuid, text, text, text, boolean) to authenticated;

create or replace function public.admin_adicional_reembolso_listar(p_estado text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._adicional_exige_supersu(null, false);
  return coalesce((select jsonb_agg(to_jsonb(r) || jsonb_build_object('negocio', n.nombre, 'mp_payment_id', c.mp_payment_id) order by r.created_at desc)
                   from public.adicional_reembolso r join public.negocio n on n.id = r.negocio_id
                   left join public.adicional_cobro c on c.id = r.cobro_id
                   where p_estado is null or r.estado = p_estado), '[]'::jsonb);
end $$;
revoke all on function public.admin_adicional_reembolso_listar(text) from public, anon, authenticated;
grant execute on function public.admin_adicional_reembolso_listar(text) to authenticated;

-- ── Pagos que no se pudieron aplicar solos ──────────────────────────────────────────────────────────
create or replace function public.admin_adicional_revision_listar(p_estado text default 'PENDIENTE')
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._adicional_exige_supersu(null, false);
  return coalesce((select jsonb_agg(to_jsonb(r) || jsonb_build_object('negocio', n.nombre, 'pago_estado', p.estado, 'pago_monto', p.monto) order by r.created_at desc)
                   from public.adicional_pago_revision r join public.pago p on p.id = r.pago_id left join public.negocio n on n.id = r.negocio_id
                   where p_estado is null or r.estado = p_estado), '[]'::jsonb);
end $$;
revoke all on function public.admin_adicional_revision_listar(text) from public, anon, authenticated;
grant execute on function public.admin_adicional_revision_listar(text) to authenticated;

create or replace function public.admin_adicional_revision_resolver(p_id uuid, p_resolucion text, p_motivo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_r public.adicional_pago_revision;
begin
  perform public._adicional_exige_supersu(p_motivo);
  update public.adicional_pago_revision set estado = 'RESUELTO', resuelto_por = auth.uid(), resuelto_at = now(), resolucion = left(p_resolucion, 1000)
   where id = p_id and estado = 'PENDIENTE' returning * into v_r;
  if not found then raise exception 'REVISION_NO_ENCONTRADA_O_RESUELTA'; end if;
  perform public._auditar('pago', v_r.pago_id, 'ADICIONAL_REVISION_RESUELTA', v_r.negocio_id, null,
                          jsonb_build_object('revision_id', p_id, 'motivo_original', v_r.motivo, 'resolucion', p_resolucion), p_motivo);
  return to_jsonb(v_r);
end $$;
revoke all on function public.admin_adicional_revision_resolver(uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_adicional_revision_resolver(uuid, text, text) to authenticated;
