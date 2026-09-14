-- StylerNow — Migración 001: extensiones y enums
-- Fuente: StylerNow_Project_Bible_V3/04-Data-Model/01_Entities.md, 03_State_Machines.md

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm"; -- búsqueda difusa de Marketplace (nombre de negocio)

-- ── Enums de estado (Glossary.md: SCREAMING_SNAKE_CASE) ─────────────────────

create type negocio_estado as enum (
  'PENDIENTE_APROBACION', 'ACTIVO', 'SUSPENDIDO', 'RECHAZADO', 'CANCELADO'
);

create type vinculo_estado as enum (
  'INVITADO', 'ACTIVO', 'SUSPENDIDO', 'RETIRADO'
);

create type reserva_estado as enum (
  'PENDIENTE_PAGO', 'CONFIRMADA', 'EN_CURSO', 'COMPLETADA', 'CANCELADA', 'NO_SHOW'
);

create type pago_estado as enum (
  'PENDIENTE', 'APROBADO', 'RECHAZADO', 'REEMBOLSADO', 'REEMBOLSADO_PARCIAL', 'EN_DISPUTA'
);

create type pago_tipo as enum (
  'SENA', 'SALDO', 'PROPINA', 'GIFT_CARD', 'MEMBRESIA', 'PAQUETE_CREDITOS_IA', 'PAQUETE_CONVERSACIONES_WHATSAPP'
);

create type suscripcion_estado as enum (
  'ACTIVA', 'EN_MORA', 'SUSPENDIDA', 'CANCELADA'
);

create type campana_estado as enum (
  'BORRADOR', 'ACTIVA', 'PAUSADA', 'AGOTADA', 'FINALIZADA'
);

create type lista_espera_estado as enum (
  'ACTIVA', 'NOTIFICADA', 'CONVERTIDA', 'EXPIRADA_VENTANA', 'EXPIRADA_FECHA', 'CANCELADA'
);

create type resena_estado as enum (
  'VISIBLE', 'REPORTADA', 'ELIMINADA'
);

create type temporada_estado as enum (
  'EN_CURSO', 'CERRADA', 'CONSOLIDADA'
);

create type nivel_staff as enum (
  'PRO', 'EXPERT', 'MASTER'
);

create type recurso_estado as enum (
  'DISPONIBLE', 'FUERA_DE_SERVICIO'
);

create type servicio_estado as enum (
  'ACTIVO', 'INACTIVO'
);

create type plan_codigo as enum (
  'RAVEN', 'JARL', 'VALHALLA', 'ALLFATHER'
);

create type categoria_puntaje as enum (
  'ESTANDAR', 'PREMIUM', 'COMPLEMENTARIO'
);

comment on type negocio_estado is 'Bible: 04-Data-Model/03_State_Machines.md — máquina Negocio';
comment on type reserva_estado is 'Bible: 04-Data-Model/03_State_Machines.md — máquina Reserva';
comment on type pago_estado is 'Bible: 04-Data-Model/03_State_Machines.md — máquina Pago';
