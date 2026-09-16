-- StylerNow — Migración 052: Dominio LEALTAD (ADR-011), RLS completa
-- Fuente: ADR_011_Motor_Lealtad.md — "Todas las tablas deben tener
-- políticas completas... probar contra Supabase real, no asumir."
--
-- Mismo principio que `wallet`/`suscripcion` (migraciones 003/006/004):
-- estas tablas son SOLO LECTURA vía RLS para todos los roles de producto
-- — todo INSERT/UPDATE/DELETE pasa exclusivamente por RPCs
-- `SECURITY DEFINER` con su propio chequeo de autorización (migración
-- 053), nunca directo desde el cliente. Evita 25 tablas con políticas de
-- escritura distintas y mantiene un único punto de auditoría por acción.

alter table public.lealtad_wallet enable row level security;
alter table public.lealtad_movimiento enable row level security;
alter table public.membresia_plan enable row level security;
alter table public.cliente_membresia enable row level security;
alter table public.membresia_uso enable row level security;
alter table public.gift_card enable row level security;
alter table public.gift_card_redencion enable row level security;
alter table public.referido_codigo enable row level security;
alter table public.referido enable row level security;
alter table public.referido_config enable row level security;
alter table public.staff_referido enable row level security;
alter table public.sello_campana enable row level security;
alter table public.sello_cliente enable row level security;
alter table public.sello_evento enable row level security;
alter table public.cashback_regla enable row level security;
alter table public.cashback_movimiento enable row level security;
alter table public.vip_nivel enable row level security;
alter table public.vip_miembro enable row level security;
alter table public.vip_historial enable row level security;
alter table public.familia_grupo enable row level security;
alter table public.familia_miembro enable row level security;
alter table public.corporativo_cuenta enable row level security;
alter table public.corporativo_miembro enable row level security;
alter table public.corporativo_consumo enable row level security;
alter table public.recompensa_regla enable row level security;
alter table public.recompensa_sugerencia enable row level security;
alter table public.lealtad_fraude_evento enable row level security;

-- ── Módulo 1 — StylerWallet ─────────────────────────────────────────────
create policy lealtad_wallet_select_propio on public.lealtad_wallet for select
  using (cliente_id = auth.uid() or public.is_supersu());
create policy lealtad_movimiento_select_propio on public.lealtad_movimiento for select
  using (wallet_id in (select id from public.lealtad_wallet where cliente_id = auth.uid()) or public.is_supersu());

-- ── Módulo 2 — Membresías ───────────────────────────────────────────────
-- Catálogo de planes: público (Cliente navega planes disponibles antes de comprar).
create policy membresia_plan_select_publico on public.membresia_plan for select
  using (activo = true or public.tiene_acceso_interno(negocio_id) or public.is_supersu());
create policy cliente_membresia_select on public.cliente_membresia for select
  using (cliente_id = auth.uid() or public.tiene_acceso_interno(negocio_id) or public.is_supersu());
create policy membresia_uso_select on public.membresia_uso for select
  using (
    cliente_membresia_id in (select id from public.cliente_membresia where cliente_id = auth.uid())
    or cliente_membresia_id in (select id from public.cliente_membresia where public.tiene_acceso_interno(negocio_id))
    or public.is_supersu()
  );

-- ── Módulo 3/10 — Gift Cards ────────────────────────────────────────────
create policy gift_card_select on public.gift_card for select
  using (comprador_id = auth.uid() or public.tiene_acceso_interno(negocio_id) or public.is_supersu());
create policy gift_card_redencion_select on public.gift_card_redencion for select
  using (
    cliente_id = auth.uid()
    or gift_card_id in (select id from public.gift_card where public.tiene_acceso_interno(negocio_id))
    or public.is_supersu()
  );

-- ── Módulo 4/11 — Referidos ─────────────────────────────────────────────
create policy referido_codigo_select_propio on public.referido_codigo for select
  using (cliente_id = auth.uid() or public.is_supersu());
create policy referido_select on public.referido for select
  using (referente_cliente_id = auth.uid() or referido_cliente_id = auth.uid() or public.tiene_acceso_interno(negocio_id) or public.is_supersu());
create policy referido_config_select on public.referido_config for select
  using (true); -- config pública: el Cliente debe poder ver la recompensa vigente antes de referir
create policy staff_referido_select on public.staff_referido for select
  using (staff_id = auth.uid() or public.tiene_acceso_interno(negocio_id) or public.is_supersu());

-- ── Módulo 5 — Sellos digitales ─────────────────────────────────────────
create policy sello_campana_select on public.sello_campana for select
  using (estado = 'ACTIVA' or public.tiene_acceso_interno(negocio_id) or public.is_supersu());
create policy sello_cliente_select on public.sello_cliente for select
  using (
    cliente_id = auth.uid()
    or campana_id in (select id from public.sello_campana where public.tiene_acceso_interno(negocio_id))
    or public.is_supersu()
  );
create policy sello_evento_select on public.sello_evento for select
  using (
    sello_cliente_id in (select id from public.sello_cliente where cliente_id = auth.uid())
    or sello_cliente_id in (select sc.id from public.sello_cliente sc join public.sello_campana c on c.id = sc.campana_id where public.tiene_acceso_interno(c.negocio_id))
    or public.is_supersu()
  );

-- ── Módulo 6 — Cashback ─────────────────────────────────────────────────
create policy cashback_regla_select on public.cashback_regla for select
  using (activo = true or public.tiene_acceso_interno(negocio_id) or public.is_supersu());
create policy cashback_movimiento_select on public.cashback_movimiento for select
  using (
    cliente_id = auth.uid()
    or regla_id in (select id from public.cashback_regla where public.tiene_acceso_interno(negocio_id))
    or public.is_supersu()
  );

-- ── Módulo 7 — Club VIP ─────────────────────────────────────────────────
create policy vip_nivel_select on public.vip_nivel for select
  using (true); -- catálogo de niveles: público (el Cliente ve a qué nivel puede aspirar)
create policy vip_miembro_select on public.vip_miembro for select
  using (cliente_id = auth.uid() or public.tiene_acceso_interno(negocio_id) or public.is_supersu());
create policy vip_historial_select on public.vip_historial for select
  using (
    vip_miembro_id in (select id from public.vip_miembro where cliente_id = auth.uid())
    or vip_miembro_id in (select id from public.vip_miembro where public.tiene_acceso_interno(negocio_id))
    or public.is_supersu()
  );

-- ── Módulo 8 — Paquetes familiares ──────────────────────────────────────
create policy familia_grupo_select on public.familia_grupo for select
  using (
    titular_cliente_id = auth.uid()
    or id in (select familia_id from public.familia_miembro where cliente_id = auth.uid())
    or (negocio_id is not null and public.tiene_acceso_interno(negocio_id))
    or public.is_supersu()
  );
create policy familia_miembro_select on public.familia_miembro for select
  using (
    cliente_id = auth.uid()
    or familia_id in (select id from public.familia_grupo where titular_cliente_id = auth.uid())
    or public.is_supersu()
  );

-- ── Módulo 9 — Suscripciones corporativas ──────────────────────────────
create policy corporativo_cuenta_select on public.corporativo_cuenta for select
  using (admin_user_id = auth.uid() or (negocio_id is not null and public.tiene_acceso_interno(negocio_id)) or public.is_supersu());
create policy corporativo_miembro_select on public.corporativo_miembro for select
  using (
    cliente_id = auth.uid()
    or cuenta_id in (select id from public.corporativo_cuenta where admin_user_id = auth.uid())
    or cuenta_id in (select id from public.corporativo_cuenta where negocio_id is not null and public.tiene_acceso_interno(negocio_id))
    or public.is_supersu()
  );
create policy corporativo_consumo_select on public.corporativo_consumo for select
  using (
    miembro_id in (select id from public.corporativo_miembro where cliente_id = auth.uid())
    or miembro_id in (select cm.id from public.corporativo_miembro cm join public.corporativo_cuenta cc on cc.id = cm.cuenta_id where cc.admin_user_id = auth.uid())
    or public.is_supersu()
  );

-- ── Módulo 12 — Motor de recompensas automáticas ───────────────────────
create policy recompensa_regla_select on public.recompensa_regla for select
  using (public.tiene_acceso_interno(negocio_id) or public.is_supersu());
create policy recompensa_sugerencia_select on public.recompensa_sugerencia for select
  using (public.tiene_acceso_interno(negocio_id) or public.is_supersu());

-- ── Antifraude — nunca visible para Cliente/Staff, solo gestión interna ─
create policy lealtad_fraude_evento_select on public.lealtad_fraude_evento for select
  using (public.is_supersu() or (negocio_id is not null and public.is_barberia_de(negocio_id)));
