-- StylerNow — Migración 003: entidades transaccionales
-- Fuente: 04-Data-Model/01_Entities.md, 03_State_Machines.md, 03-Business-Rules/*

-- ── Reserva ───────────────────────────────────────────────────────────────
create table public.reserva (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.perfil(id),
  negocio_id uuid not null references public.negocio(id),
  sede_id uuid not null references public.sede(id),
  staff_id uuid references public.staff(usuario_id), -- nunca null tras confirmación
  recurso_id uuid references public.recurso(id),
  hora_inicio timestamptz not null,
  hora_fin timestamptz not null,
  estado reserva_estado not null default 'PENDIENTE_PAGO',
  monto_total numeric(12,2) not null,
  monto_sena numeric(12,2) not null,
  checkin_at timestamptz,
  checkout_at timestamptz,
  cancelado_por text check (cancelado_por in ('CLIENTE','NEGOCIO','PLATAFORMA')),
  cancelado_motivo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (hora_fin > hora_inicio)
);
create index reserva_cliente_idx on public.reserva(cliente_id);
create index reserva_negocio_idx on public.reserva(negocio_id);
create index reserva_sede_idx on public.reserva(sede_id, hora_inicio);
create index reserva_staff_idx on public.reserva(staff_id, hora_inicio);
create index reserva_estado_idx on public.reserva(estado);
-- Lock de disponibilidad (03-Business-Rules/02_Booking_Rules.md): evita solapamiento
-- de un mismo Staff en Reservas activas (no CANCELADA/NO_SHOW).
create extension if not exists btree_gist;
alter table public.reserva add column rango tstzrange
  generated always as (tstzrange(hora_inicio, hora_fin, '[)')) stored;
create index reserva_staff_rango_gist on public.reserva using gist (staff_id, rango)
  where estado in ('PENDIENTE_PAGO','CONFIRMADA','EN_CURSO');
alter table public.reserva add constraint reserva_sin_solape_staff
  exclude using gist (staff_id with =, rango with &&)
  where (estado in ('CONFIRMADA','EN_CURSO'));
alter table public.reserva add constraint reserva_sin_solape_recurso
  exclude using gist (recurso_id with =, rango with &&)
  where (estado in ('CONFIRMADA','EN_CURSO') and recurso_id is not null);

create table public.reserva_servicio (
  reserva_id uuid not null references public.reserva(id) on delete cascade,
  servicio_id uuid not null references public.servicio(id),
  precio_congelado_unitario numeric(12,2) not null, -- Business_Rules_Bible.md: precio nunca cambia post-confirmación
  primary key (reserva_id, servicio_id)
);

-- ── Pago ──────────────────────────────────────────────────────────────────
create table public.pago (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid references public.reserva(id),
  negocio_id uuid references public.negocio(id), -- para pagos no ligados a reserva (gift card, créditos)
  tipo pago_tipo not null,
  monto numeric(12,2) not null check (monto >= 0),
  estado pago_estado not null default 'PENDIENTE',
  pasarela text not null default 'WOMPI',
  id_transaccion_pasarela text unique, -- clave de idempotencia (05-API/06_Webhooks.md)
  comision_plataforma_monto numeric(12,2) default 0,
  staff_destino_id uuid references public.staff(usuario_id), -- para PROPINA
  motivo_reembolso text check (motivo_reembolso in (
    'CANCELACION_CLIENTE_VENTANA_TOTAL','CANCELACION_CLIENTE_VENTANA_PARCIAL',
    'CANCELACION_NEGOCIO','NO_SHOW_STAFF','AJUSTE_SERVICIO','RESOLUCION_DISPUTA','CORTESIA_COMERCIAL'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pago_reserva_idx on public.pago(reserva_id);
create index pago_negocio_idx on public.pago(negocio_id);
create index pago_estado_idx on public.pago(estado);

-- ── Fidelización (Cliente) ──────────────────────────────────────────────
create table public.punto_fidelizacion (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.perfil(id),
  negocio_id uuid not null references public.negocio(id),
  cantidad int not null check (cantidad > 0),
  cantidad_disponible int not null check (cantidad_disponible >= 0),
  fecha_otorgamiento timestamptz not null default now(),
  fecha_expiracion timestamptz not null,
  origen text not null,
  created_at timestamptz not null default now()
);
create index punto_cliente_negocio_idx on public.punto_fidelizacion(cliente_id, negocio_id);
create index punto_expiracion_idx on public.punto_fidelizacion(fecha_expiracion) where cantidad_disponible > 0;

-- ── Sistema PRO/EXPERT/MASTER (03-Business-Rules/05_Staff_Rewards.md) ─────
create table public.temporada (
  id uuid primary key default gen_random_uuid(),
  fecha_inicio date not null,
  fecha_fin date not null,
  estado temporada_estado not null default 'EN_CURSO',
  unique (fecha_inicio, fecha_fin)
);

create table public.puntaje_staff_evento (
  id uuid primary key default gen_random_uuid(),
  vinculo_id uuid not null references public.vinculo_staff_negocio(id),
  temporada_id uuid not null references public.temporada(id),
  evento text not null,
  puntos_delta int not null,
  referencia_tipo text,
  referencia_id uuid,
  actor_tipo text not null default 'SISTEMA' check (actor_tipo in ('SISTEMA','BARBERIA','SUPERSU')),
  motivo text,
  created_at timestamptz not null default now()
);
create index puntaje_vinculo_temporada_idx on public.puntaje_staff_evento(vinculo_id, temporada_id);

create table public.nivel_staff_consolidado (
  vinculo_id uuid not null references public.vinculo_staff_negocio(id),
  temporada_id uuid not null references public.temporada(id),
  puntaje_final int not null,
  nivel nivel_staff not null,
  primary key (vinculo_id, temporada_id)
);

-- ── Reseñas ───────────────────────────────────────────────────────────────
create table public.resena (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null unique references public.reserva(id), -- 1 reseña por Reserva
  cliente_id uuid not null references public.perfil(id),
  negocio_id uuid not null references public.negocio(id),
  staff_id uuid references public.staff(usuario_id),
  calificacion int not null check (calificacion between 1 and 5),
  comentario text,
  respuesta_negocio text,
  estado resena_estado not null default 'VISIBLE',
  moderado_por uuid references auth.users(id),
  moderado_motivo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index resena_negocio_idx on public.resena(negocio_id) where estado = 'VISIBLE';

-- ── Lista de espera ───────────────────────────────────────────────────────
create table public.lista_espera (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.perfil(id),
  negocio_id uuid not null references public.negocio(id),
  sede_id uuid not null references public.sede(id),
  staff_id uuid references public.staff(usuario_id), -- null = cualquiera
  servicio_ids uuid[] not null,
  fecha_deseada_inicio date not null,
  fecha_deseada_fin date not null,
  estado lista_espera_estado not null default 'ACTIVA',
  orden_fifo timestamptz not null default now(),
  notificado_at timestamptz,
  created_at timestamptz not null default now()
);
create index lista_espera_negocio_idx on public.lista_espera(negocio_id, sede_id) where estado = 'ACTIVA';
create index lista_espera_cliente_idx on public.lista_espera(cliente_id) where estado = 'ACTIVA';

-- ── Wallet (Negocio) ──────────────────────────────────────────────────────
create table public.wallet (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid unique references public.negocio(id),
  saldo_disponible numeric(14,2) not null default 0,
  saldo_retenido numeric(14,2) not null default 0,
  updated_at timestamptz not null default now()
);

create table public.wallet_movimiento (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallet(id),
  tipo text not null, -- COMISION, REEMBOLSO_COMISION, CAMPANA, RETIRO, AJUSTE
  monto numeric(14,2) not null,
  referencia_tipo text,
  referencia_id uuid,
  created_at timestamptz not null default now()
);
create index wallet_mov_wallet_idx on public.wallet_movimiento(wallet_id);
