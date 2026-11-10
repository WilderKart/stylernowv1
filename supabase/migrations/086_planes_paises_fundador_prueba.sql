-- 086 — Planes multi-país, precio fundador, prueba de 14 días, add-ons y Mi Marca.
-- ADITIVA: tablas/columnas/funciones nuevas + UPDATE de los límites de sedes/staff por plan.
-- No renombra planes (RAVEN/JARL/VALHALLA/ALLFATHER), no cambia precios COP, no borra nada.
-- Brasil queda fuera. Todo precio vive en BD y se edita desde Super Admin.

-- ───────────────────────── países ─────────────────────────
create table public.pais (
  codigo char(2) primary key,
  nombre text not null,
  moneda char(3) not null,
  locale text not null,
  activo boolean not null default true,
  -- pasarela de cobro del país; STRIPE/PAYONEER se habilitan cuando existan credenciales.
  pasarela text not null default 'MANUAL' check (pasarela in ('MERCADOPAGO','STRIPE','PAYONEER','MANUAL')),
  -- cobro automático al terminar la prueba: solo true cuando la pasarela soporta tarjeta guardada.
  cobro_recurrente_habilitado boolean not null default false,
  -- ES y MX publican precio + IVA. La tasa queda sin definir hasta que se confirme.
  precio_mas_impuesto boolean not null default false,
  impuesto_pct numeric(5,2) check (impuesto_pct is null or impuesto_pct between 0 and 100),
  fundador_descuento_pct numeric(5,2) not null default 30 check (fundador_descuento_pct between 0 and 100),
  fundador_cupos integer not null default 100 check (fundador_cupos >= 0),
  fundador_meses integer not null default 6 check (fundador_meses > 0),
  anual_meses_pagados integer not null default 10 check (anual_meses_pagados between 1 and 12),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

insert into public.pais (codigo, nombre, moneda, locale, pasarela, precio_mas_impuesto) values
  ('CO', 'Colombia',       'COP', 'es-CO', 'MERCADOPAGO', false),
  ('US', 'Estados Unidos', 'USD', 'en-US', 'MANUAL',      false),
  ('MX', 'México',         'MXN', 'es-MX', 'MERCADOPAGO', true),
  ('ES', 'España',         'EUR', 'es-ES', 'MANUAL',      true);

alter table public.negocio
  add column pais_codigo char(2) not null default 'CO' references public.pais(codigo);

-- ───────────────────────── precios por plan × país ─────────────────────────
create table public.plan_precio (
  plan_codigo public.plan_codigo not null references public.plan(codigo),
  pais_codigo char(2) not null references public.pais(codigo),
  precio_mensual numeric(12,2) check (precio_mensual is null or precio_mensual >= 0), -- null = a cotizar
  es_desde boolean not null default false,
  precio_staff_extra numeric(12,2),  -- null = PENDIENTE de definir
  precio_sede_extra numeric(12,2),   -- null = PENDIENTE de definir
  activo boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  primary key (plan_codigo, pais_codigo)
);

-- Colombia: espejo de `plan` (fuente actual de los precios COP, que no cambian).
insert into public.plan_precio (plan_codigo, pais_codigo, precio_mensual, precio_staff_extra, precio_sede_extra)
select codigo, 'CO', precio_mensual, staff_addon_precio, sede_addon_precio from public.plan;

insert into public.plan_precio (plan_codigo, pais_codigo, precio_mensual, es_desde) values
  ('RAVEN',    'US', 19,   false), ('JARL', 'US', 49,   false), ('VALHALLA', 'US', 99,   false), ('ALLFATHER', 'US', 199,  true),
  ('RAVEN',    'ES', 19,   false), ('JARL', 'ES', 39,   false), ('VALHALLA', 'ES', 79,   false), ('ALLFATHER', 'ES', 149,  true),
  ('RAVEN',    'MX', 249,  false), ('JARL', 'MX', 599,  false), ('VALHALLA', 'MX', 1290, false), ('ALLFATHER', 'MX', 2490, true);

-- `plan` sigue siendo la fuente de COP: cualquier cambio ahí se refleja en el espejo.
create function public.trg_plan_sync_precio_co() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.plan_precio (plan_codigo, pais_codigo, precio_mensual, precio_staff_extra, precio_sede_extra)
  values (new.codigo, 'CO', new.precio_mensual, new.staff_addon_precio, new.sede_addon_precio)
  on conflict (plan_codigo, pais_codigo) do update
    set precio_mensual = excluded.precio_mensual,
        precio_staff_extra = excluded.precio_staff_extra,
        precio_sede_extra = excluded.precio_sede_extra,
        updated_at = now();
  return new;
end $$;
create trigger trg_plan_sync_precio_co after insert or update on public.plan
  for each row execute function public.trg_plan_sync_precio_co();

create table public.addon_precio (
  addon_codigo text not null check (addon_codigo in ('MI_MARCA')),
  pais_codigo char(2) not null references public.pais(codigo),
  precio_mensual numeric(12,2) check (precio_mensual is null or precio_mensual >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  primary key (addon_codigo, pais_codigo)
);
insert into public.addon_precio (addon_codigo, pais_codigo, precio_mensual) values
  ('MI_MARCA','CO',29900), ('MI_MARCA','US',9), ('MI_MARCA','ES',9), ('MI_MARCA','MX',149);

-- ───────────────────────── límites de sedes y staff (tabla del negocio) ─────────────────────────
-- Solo cambian los límites; precios, add-ons y WhatsApp se conservan tal cual.
update public.plan set limite_sedes = 1,  staff_incluido = 1  where codigo = 'RAVEN';
update public.plan set limite_sedes = 2,  staff_incluido = 5  where codigo = 'JARL';
update public.plan set limite_sedes = 5,  staff_incluido = 12 where codigo = 'VALHALLA';
update public.plan set limite_sedes = 10, staff_incluido = 20 where codigo = 'ALLFATHER';

-- ───────────────────────── qué incluye cada plan (feature gating en BD) ─────────────────────────
create table public.plan_caracteristica (
  plan_codigo public.plan_codigo not null references public.plan(codigo),
  clave text not null,
  habilitado boolean not null default true,
  valor text,
  updated_at timestamptz not null default now(),
  primary key (plan_codigo, clave)
);

insert into public.plan_caracteristica (plan_codigo, clave, habilitado, valor) values
  -- perfil en el mapa
  ('RAVEN','perfil_mapa',true,'estandar'),('JARL','perfil_mapa',true,'estandar'),('VALHALLA','perfil_mapa',true,'destacado'),('ALLFATHER','perfil_mapa',true,'destacado'),
  -- reservas con agenda real, anticipo, recordatorios, caja, gift cards: todos
  ('RAVEN','reservas_agenda',true,null),('JARL','reservas_agenda',true,null),('VALHALLA','reservas_agenda',true,null),('ALLFATHER','reservas_agenda',true,null),
  ('RAVEN','anticipo',true,null),('JARL','anticipo',true,null),('VALHALLA','anticipo',true,null),('ALLFATHER','anticipo',true,null),
  ('RAVEN','recordatorios',true,'ilimitados'),('JARL','recordatorios',true,'ilimitados'),('VALHALLA','recordatorios',true,'ilimitados'),('ALLFATHER','recordatorios',true,'ilimitados'),
  ('RAVEN','gift_cards',true,null),('JARL','gift_cards',true,null),('VALHALLA','gift_cards',true,null),('ALLFATHER','gift_cards',true,null),
  -- CRM y caja
  ('RAVEN','crm_caja',true,'basico'),('JARL','crm_caja',true,'completo'),('VALHALLA','crm_caja',true,'completo'),('ALLFATHER','crm_caja',true,'completo'),
  -- desde Studio
  ('RAVEN','fila_virtual',false,null),('JARL','fila_virtual',true,null),('VALHALLA','fila_virtual',true,null),('ALLFATHER','fila_virtual',true,null),
  ('RAVEN','comisiones_turnos',false,null),('JARL','comisiones_turnos',true,null),('VALHALLA','comisiones_turnos',true,null),('ALLFATHER','comisiones_turnos',true,null),
  ('RAVEN','inventario',false,null),('JARL','inventario',true,null),('VALHALLA','inventario',true,null),('ALLFATHER','inventario',true,null),
  ('RAVEN','roles_permisos',false,null),('JARL','roles_permisos',true,'basico'),('VALHALLA','roles_permisos',true,'avanzado'),('ALLFATHER','roles_permisos',true,'por_sede'),
  ('RAVEN','fidelizacion',false,null),('JARL','fidelizacion',true,'basica'),('VALHALLA','fidelizacion',true,'avanzada'),('ALLFATHER','fidelizacion',true,'avanzada'),
  ('RAVEN','migracion_datos',false,null),('JARL','migracion_datos',true,'estandar'),('VALHALLA','migracion_datos',true,'estandar'),('ALLFATHER','migracion_datos',true,'asistida'),
  -- cámara antes/después y My Look
  ('RAVEN','camara_antes_despues',true,'con_marca_agua'),('JARL','camara_antes_despues',true,'con_marca_agua'),('VALHALLA','camara_antes_despues',true,'sin_marca_agua'),('ALLFATHER','camara_antes_despues',true,'sin_marca_agua'),
  ('RAVEN','my_look',false,null),('JARL','my_look',false,null),('VALHALLA','my_look',true,null),('ALLFATHER','my_look',true,null),
  -- reportes, soporte, llamado a la acción
  ('RAVEN','reportes',true,'dia'),('JARL','reportes',true,'semana_mes'),('VALHALLA','reportes',true,'avanzados'),('ALLFATHER','reportes',true,'consolidados'),
  ('RAVEN','soporte',true,'email'),('JARL','soporte',true,'chat'),('VALHALLA','soporte',true,'prioritario'),('ALLFATHER','soporte',true,'gerente'),
  ('RAVEN','llamado_accion',true,'prueba'),('JARL','llamado_accion',true,'prueba'),('VALHALLA','llamado_accion',true,'prueba'),('ALLFATHER','llamado_accion',true,'ventas');

-- ───────────────────────── suscripción: ciclo, prueba, método de pago, gracia ─────────────────────────
alter table public.suscripcion
  add column ciclo text not null default 'MENSUAL' check (ciclo in ('MENSUAL','ANUAL')),
  add column pais_codigo char(2) not null default 'CO' references public.pais(codigo),
  add column prueba_inicio timestamptz,
  add column prueba_fin timestamptz,
  add column metodo_pago_ref text,
  add column metodo_pago_proveedor text,
  add column gracia_fin timestamptz,
  add column aviso_3d_at timestamptz,
  add column aviso_1d_at timestamptz;

-- Una sola prueba por negocio, y por teléfono / documento / correo / dispositivo.
create table public.prueba_uso (
  negocio_id uuid primary key references public.negocio(id),
  owner_user_id uuid not null references auth.users(id),
  telefono_hash text not null,
  documento_hash text not null,
  email_hash text not null,
  dispositivo_hash text not null,
  created_at timestamptz not null default now()
);
create unique index prueba_uso_telefono_uq on public.prueba_uso (telefono_hash);
create unique index prueba_uso_documento_uq on public.prueba_uso (documento_hash);
create unique index prueba_uso_email_uq on public.prueba_uso (email_hash);
create unique index prueba_uso_dispositivo_uq on public.prueba_uso (dispositivo_hash);

-- ───────────────────────── precio fundador ─────────────────────────
create table public.suscripcion_fundador (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null unique references public.negocio(id),
  pais_codigo char(2) not null references public.pais(codigo),
  plan_codigo public.plan_codigo not null references public.plan(codigo),
  descuento_pct numeric(5,2) not null,
  fecha_inicio timestamptz not null,
  fecha_fin timestamptz not null,
  estado text not null default 'ACTIVO' check (estado in ('ACTIVO','PERDIDO','FINALIZADO')),
  perdido_en timestamptz,
  created_at timestamptz not null default now()
);
create index suscripcion_fundador_pais_idx on public.suscripcion_fundador (pais_codigo);

-- ───────────────────────── add-ons y Mi Marca ─────────────────────────
create table public.negocio_addon (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id),
  addon_codigo text not null check (addon_codigo in ('MI_MARCA','STAFF_EXTRA','SEDE_EXTRA')),
  cantidad integer not null default 1 check (cantidad >= 1),
  activo boolean not null default true,
  desde timestamptz not null default now(),
  hasta timestamptz,
  unique (negocio_id, addon_codigo)
);

create table public.negocio_marca (
  negocio_id uuid primary key references public.negocio(id),
  nombre_marca text not null check (char_length(nombre_marca) between 1 and 60),
  slogan text check (slogan is null or char_length(slogan) <= 120),
  logo_url text,
  color_primario text not null default '#FF4D00' check (color_primario ~ '^#[0-9A-Fa-f]{6}$'),
  color_secundario text not null default '#0A0A0A' check (color_secundario ~ '^#[0-9A-Fa-f]{6}$'),
  estado text not null default 'BORRADOR' check (estado in ('BORRADOR','PUBLICADA')),
  updated_at timestamptz not null default now()
);

-- ───────────────────────── RLS ─────────────────────────
alter table public.pais enable row level security;
alter table public.plan_precio enable row level security;
alter table public.addon_precio enable row level security;
alter table public.plan_caracteristica enable row level security;
alter table public.prueba_uso enable row level security;
alter table public.suscripcion_fundador enable row level security;
alter table public.negocio_addon enable row level security;
alter table public.negocio_marca enable row level security;

create policy pais_select_publico on public.pais for select using (activo or public.is_supersu());
create policy pais_write_supersu on public.pais for all using (public.is_supersu()) with check (public.is_supersu());
create policy plan_precio_select_publico on public.plan_precio for select using (activo or public.is_supersu());
create policy plan_precio_write_supersu on public.plan_precio for all using (public.is_supersu()) with check (public.is_supersu());
create policy addon_precio_select_publico on public.addon_precio for select using (true);
create policy addon_precio_write_supersu on public.addon_precio for all using (public.is_supersu()) with check (public.is_supersu());
create policy plan_caracteristica_select_publico on public.plan_caracteristica for select using (true);
create policy plan_caracteristica_write_supersu on public.plan_caracteristica for all using (public.is_supersu()) with check (public.is_supersu());
-- prueba_uso: contiene huellas anti-abuso; solo SuperSU las lee, nadie escribe directo (solo la RPC).
create policy prueba_uso_select_supersu on public.prueba_uso for select using (public.is_supersu());
create policy fundador_select_propio on public.suscripcion_fundador for select
  using (public.is_barberia_de(negocio_id) or public.is_supersu());
create policy addon_select_propio on public.negocio_addon for select
  using (public.is_barberia_de(negocio_id) or public.is_supersu());
create policy marca_select_publicada on public.negocio_marca for select
  using (estado = 'PUBLICADA' or public.is_barberia_de(negocio_id) or public.is_supersu());

-- ───────────────────────── funciones ─────────────────────────
-- Contador visible de cupos ("quedan 23 cupos"): público, solo lectura.
create function public.fundador_cupos_restantes(p_pais char(2))
returns integer language sql stable security definer set search_path = public as $$
  select greatest(p.fundador_cupos - (select count(*) from public.suscripcion_fundador f where f.pais_codigo = p.codigo), 0)::integer
  from public.pais p where p.codigo = p_pais and p.activo;
$$;

-- Interna: reclama un cupo fundador (una vez por negocio; no aplica a ALLFATHER).
create function public._reclamar_fundador(p_negocio uuid, p_pais char(2), p_plan public.plan_codigo, p_inicio timestamptz)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_pais public.pais;
begin
  if p_plan = 'ALLFATHER' then return false; end if;
  select * into v_pais from public.pais where codigo = p_pais and activo for update; -- serializa el conteo
  if not found then return false; end if;
  if exists (select 1 from public.suscripcion_fundador where negocio_id = p_negocio) then return false; end if;
  if (select count(*) from public.suscripcion_fundador where pais_codigo = p_pais) >= v_pais.fundador_cupos then return false; end if;
  insert into public.suscripcion_fundador (negocio_id, pais_codigo, plan_codigo, descuento_pct, fecha_inicio, fecha_fin)
  values (p_negocio, p_pais, p_plan, v_pais.fundador_descuento_pct, p_inicio, p_inicio + make_interval(months => v_pais.fundador_meses));
  return true;
end $$;

-- Cancelar antes de cumplir el periodo fundador lo pierde, sin volver a usarlo.
create function public.trg_suscripcion_pierde_fundador() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.suscripcion_fundador
     set estado = 'PERDIDO', perdido_en = now()
   where negocio_id = new.negocio_id and estado = 'ACTIVO' and fecha_fin > now();
  return new;
end $$;
create trigger trg_suscripcion_pierde_fundador after update of estado on public.suscripcion
  for each row when (new.estado = 'CANCELADA' and old.estado is distinct from 'CANCELADA')
  execute function public.trg_suscripcion_pierde_fundador();

-- Un negocio nuevo ya NO queda ACTIVO sin pagar: queda REQUIERE_PLAN hasta iniciar la prueba.
-- (Misma firma que antes: no crea una sobrecarga.)
create or replace function public.crear_suscripcion_inicial(p_negocio_id uuid, p_plan_codigo public.plan_codigo)
returns public.suscripcion language plpgsql security definer set search_path = public as $$
declare v_suscripcion public.suscripcion;
begin
  if p_plan_codigo = 'ALLFATHER' then raise exception 'ALLFATHER_REQUIERE_COTIZACION'; end if;
  if not exists (select 1 from public.negocio where id = p_negocio_id and owner_user_id = auth.uid()) then
    raise exception 'NO_AUTORIZADO';
  end if;

  insert into public.suscripcion (negocio_id, plan_codigo, estado, fecha_proximo_cobro, pais_codigo)
  select p_negocio_id, p_plan_codigo, 'REQUIERE_PLAN'::public.suscripcion_estado, null::timestamptz, n.pais_codigo from public.negocio n where n.id = p_negocio_id
  on conflict (negocio_id) do update set plan_codigo = excluded.plan_codigo
  returning * into v_suscripcion;

  update public.negocio set plan_codigo = p_plan_codigo where id = p_negocio_id;
  return v_suscripcion;
end $$;

-- Inicia la prueba de 14 días: exige método de pago, una sola prueba por negocio/teléfono/documento/correo/dispositivo.
create function public.iniciar_prueba_negocio(
  p_negocio_id uuid, p_plan_codigo public.plan_codigo, p_ciclo text,
  p_metodo_pago_ref text, p_metodo_pago_proveedor text,
  p_telefono_hash text, p_documento_hash text, p_dispositivo_hash text
) returns public.suscripcion language plpgsql security definer set search_path = public as $$
declare
  v_neg public.negocio; v_pais public.pais; v_susc public.suscripcion; v_fin timestamptz; v_email text;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  select * into v_neg from public.negocio where id = p_negocio_id and owner_user_id = auth.uid();
  if not found then raise exception 'NO_AUTORIZADO'; end if;
  if p_plan_codigo = 'ALLFATHER' then raise exception 'ALLFATHER_REQUIERE_COTIZACION'; end if;
  if p_ciclo not in ('MENSUAL','ANUAL') then raise exception 'CICLO_INVALIDO'; end if;

  select * into v_pais from public.pais where codigo = v_neg.pais_codigo and activo;
  if not found then raise exception 'PAIS_NO_DISPONIBLE'; end if;
  if not exists (select 1 from public.plan_precio where plan_codigo = p_plan_codigo and pais_codigo = v_pais.codigo and activo and precio_mensual is not null) then
    raise exception 'PLAN_SIN_PRECIO_EN_PAIS';
  end if;
  if not v_pais.cobro_recurrente_habilitado then raise exception 'COBRO_NO_DISPONIBLE_PAIS'; end if;
  if coalesce(trim(p_metodo_pago_ref), '') = '' then raise exception 'METODO_PAGO_REQUERIDO'; end if;
  if coalesce(p_telefono_hash, '') = '' or coalesce(p_documento_hash, '') = '' or coalesce(p_dispositivo_hash, '') = '' then
    raise exception 'VERIFICACION_INCOMPLETA';
  end if;

  select * into v_susc from public.suscripcion where negocio_id = p_negocio_id;
  if found and v_susc.estado <> 'REQUIERE_PLAN' then raise exception 'YA_TIENE_SUSCRIPCION'; end if;

  select lower(email) into v_email from auth.users where id = auth.uid();
  begin
    insert into public.prueba_uso (negocio_id, owner_user_id, telefono_hash, documento_hash, email_hash, dispositivo_hash)
    values (p_negocio_id, auth.uid(), p_telefono_hash, p_documento_hash, md5(coalesce(v_email, '')), p_dispositivo_hash);
  exception when unique_violation then
    raise exception 'PRUEBA_YA_USADA';
  end;

  v_fin := now() + interval '14 days';
  insert into public.suscripcion (negocio_id, plan_codigo, estado, fecha_inicio_ciclo, fecha_proximo_cobro, ciclo, pais_codigo,
                                  prueba_inicio, prueba_fin, metodo_pago_ref, metodo_pago_proveedor)
  values (p_negocio_id, p_plan_codigo, 'TRIAL', now(), v_fin, p_ciclo, v_pais.codigo, now(), v_fin, p_metodo_pago_ref, p_metodo_pago_proveedor)
  on conflict (negocio_id) do update set
    plan_codigo = excluded.plan_codigo, estado = 'TRIAL', fecha_inicio_ciclo = excluded.fecha_inicio_ciclo,
    fecha_proximo_cobro = excluded.fecha_proximo_cobro, ciclo = excluded.ciclo, pais_codigo = excluded.pais_codigo,
    prueba_inicio = excluded.prueba_inicio, prueba_fin = excluded.prueba_fin,
    metodo_pago_ref = excluded.metodo_pago_ref, metodo_pago_proveedor = excluded.metodo_pago_proveedor,
    aviso_3d_at = null, aviso_1d_at = null, gracia_fin = null
  returning * into v_susc;

  update public.negocio set plan_codigo = p_plan_codigo where id = p_negocio_id;

  -- El descuento fundador corre desde el primer cobro (fin de la prueba) y solo en facturación mensual.
  if p_ciclo = 'MENSUAL' then
    perform public._reclamar_fundador(p_negocio_id, v_pais.codigo, p_plan_codigo, v_fin);
  end if;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id)
  values ('suscripcion', v_susc.id, 'PRUEBA_INICIADA', 'BARBERIA', auth.uid(), p_negocio_id);
  return v_susc;
end $$;

-- Resultado del cobro automático (lo invoca el cron con service_role tras hablar con la pasarela).
create function public.registrar_resultado_cobro(p_negocio_id uuid, p_exito boolean, p_motivo text default null)
returns public.suscripcion language plpgsql security definer set search_path = public as $$
declare v_s public.suscripcion;
begin
  select * into v_s from public.suscripcion where negocio_id = p_negocio_id for update;
  if not found then raise exception 'SUSCRIPCION_NO_ENCONTRADA'; end if;
  if p_exito then
    update public.suscripcion set
      estado = 'ACTIVA', fecha_inicio_ciclo = now(),
      fecha_proximo_cobro = now() + case ciclo when 'ANUAL' then interval '12 months' else interval '1 month' end,
      reintentos_fallo_count = 0, gracia_fin = null, suspendido_causa = null
    where negocio_id = p_negocio_id returning * into v_s;
  else
    update public.suscripcion set
      estado = 'EN_MORA', reintentos_fallo_count = reintentos_fallo_count + 1,
      gracia_fin = coalesce(gracia_fin, now() + interval '3 days')
    where negocio_id = p_negocio_id returning * into v_s;
  end if;
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, negocio_id, motivo)
  values ('suscripcion', v_s.id, case when p_exito then 'COBRO_OK' else 'COBRO_FALLIDO' end, 'SISTEMA', p_negocio_id, p_motivo);
  return v_s;
end $$;

-- Mantenimiento diario: mora vencida (3 días de gracia) → SUSPENDIDA (se oculta del mapa); cierra fundadores vencidos.
create function public.mantenimiento_suscripciones() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_susp integer; v_fund integer;
begin
  update public.suscripcion set estado = 'SUSPENDIDA', suspendido_causa = 'IMPAGO'
   where estado = 'EN_MORA' and gracia_fin is not null and gracia_fin < now();
  get diagnostics v_susp = row_count;
  update public.suscripcion_fundador set estado = 'FINALIZADO' where estado = 'ACTIVO' and fecha_fin <= now();
  get diagnostics v_fund = row_count;
  return jsonb_build_object('suspendidas', v_susp, 'fundadores_finalizados', v_fund);
end $$;

-- Pruebas que ya vencieron y hay que cobrar.
create function public.pruebas_por_cobrar()
returns table (negocio_id uuid, plan_codigo public.plan_codigo, ciclo text, pais_codigo char(2), metodo_pago_ref text, metodo_pago_proveedor text)
language sql stable security definer set search_path = public as $$
  select s.negocio_id, s.plan_codigo, s.ciclo, s.pais_codigo, s.metodo_pago_ref, s.metodo_pago_proveedor
  from public.suscripcion s where s.estado = 'TRIAL' and s.prueba_fin <= now();
$$;

-- Avisos de primer cobro: 3 días y 1 día antes.
create function public.avisos_prueba_pendientes()
returns table (negocio_id uuid, owner_user_id uuid, tipo text, fecha_cobro timestamptz)
language sql stable security definer set search_path = public as $$
  select s.negocio_id, n.owner_user_id, '3D', s.prueba_fin from public.suscripcion s join public.negocio n on n.id = s.negocio_id
   where s.estado = 'TRIAL' and s.aviso_3d_at is null and s.prueba_fin - interval '3 days' <= now() and s.prueba_fin > now()
  union all
  select s.negocio_id, n.owner_user_id, '1D', s.prueba_fin from public.suscripcion s join public.negocio n on n.id = s.negocio_id
   where s.estado = 'TRIAL' and s.aviso_1d_at is null and s.prueba_fin - interval '1 day' <= now() and s.prueba_fin > now();
$$;

create function public.marcar_aviso_prueba(p_negocio_id uuid, p_tipo text) returns void
language sql security definer set search_path = public as $$
  update public.suscripcion set
    aviso_3d_at = case when p_tipo = '3D' then now() else aviso_3d_at end,
    aviso_1d_at = case when p_tipo = '1D' then now() else aviso_1d_at end
  where negocio_id = p_negocio_id;
$$;

-- Reglas de visibilidad: REQUIERE_PLAN se ve pero no recibe reservas; SUSPENDIDA/CANCELADA se oculta.
-- Un negocio sin fila de suscripción (datos previos al modelo) se trata como habilitado.
create function public.negocio_puede_recibir_reservas(p_negocio_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select s.estado in ('ACTIVA','TRIAL') or (s.estado = 'EN_MORA' and (s.gracia_fin is null or s.gracia_fin > now()))
    from public.suscripcion s where s.negocio_id = p_negocio_id
  ), true);
$$;

create function public.negocio_visible_en_mapa(p_negocio_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select s.estado not in ('SUSPENDIDA','CANCELADA') and not (s.estado = 'EN_MORA' and s.gracia_fin is not null and s.gracia_fin <= now())
    from public.suscripcion s where s.negocio_id = p_negocio_id
  ), true);
$$;

-- Feature gating leído de la BD (según el plan vigente del negocio).
create function public.negocio_tiene_funcion(p_negocio_id uuid, p_clave text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select pc.habilitado from public.plan_caracteristica pc
    where pc.clave = p_clave
      and pc.plan_codigo = coalesce((select s.plan_codigo from public.suscripcion s where s.negocio_id = p_negocio_id),
                                    (select n.plan_codigo from public.negocio n where n.id = p_negocio_id))
  ), false)
  and (public.is_barberia_de(p_negocio_id) or public.is_staff_de(p_negocio_id) or public.is_supersu());
$$;

create function public.negocio_funcion_valor(p_negocio_id uuid, p_clave text) returns text
language sql stable security definer set search_path = public as $$
  select pc.valor from public.plan_caracteristica pc
  where pc.clave = p_clave and pc.habilitado
    and pc.plan_codigo = coalesce((select s.plan_codigo from public.suscripcion s where s.negocio_id = p_negocio_id),
                                  (select n.plan_codigo from public.negocio n where n.id = p_negocio_id))
    and (public.is_barberia_de(p_negocio_id) or public.is_staff_de(p_negocio_id) or public.is_supersu());
$$;

-- Add-ons: los activa el sistema (webhook de pago) o SuperSU, nunca el propio negocio.
create function public.activar_addon_negocio(p_negocio_id uuid, p_addon text, p_activo boolean, p_cantidad integer default 1)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.negocio_addon (negocio_id, addon_codigo, cantidad, activo, desde, hasta)
  values (p_negocio_id, p_addon, greatest(p_cantidad, 1), p_activo, now(), case when p_activo then null else now() end)
  on conflict (negocio_id, addon_codigo) do update set
    activo = excluded.activo, cantidad = excluded.cantidad,
    desde = case when excluded.activo and not negocio_addon.activo then now() else negocio_addon.desde end,
    hasta = excluded.hasta;
end $$;

-- Mi Marca: el dueño configura su marca solo si tiene el add-on activo.
create function public.guardar_marca_negocio(
  p_negocio_id uuid, p_nombre text, p_slogan text, p_logo_url text,
  p_color_primario text, p_color_secundario text, p_publicar boolean
) returns public.negocio_marca language plpgsql security definer set search_path = public as $$
declare v public.negocio_marca;
begin
  if not public.is_barberia_de(p_negocio_id) then raise exception 'NO_AUTORIZADO'; end if;
  if not exists (select 1 from public.negocio_addon where negocio_id = p_negocio_id and addon_codigo = 'MI_MARCA' and activo) then
    raise exception 'ADDON_MI_MARCA_REQUERIDO';
  end if;
  insert into public.negocio_marca (negocio_id, nombre_marca, slogan, logo_url, color_primario, color_secundario, estado)
  values (p_negocio_id, p_nombre, p_slogan, p_logo_url, p_color_primario, p_color_secundario, case when p_publicar then 'PUBLICADA' else 'BORRADOR' end)
  on conflict (negocio_id) do update set
    nombre_marca = excluded.nombre_marca, slogan = excluded.slogan, logo_url = excluded.logo_url,
    color_primario = excluded.color_primario, color_secundario = excluded.color_secundario,
    estado = excluded.estado, updated_at = now()
  returning * into v;
  return v;
end $$;

-- Super Admin: todo editable sin código (con auditoría).
create function public.admin_set_pais(
  p_codigo char(2), p_activo boolean, p_pasarela text, p_cobro_recurrente boolean,
  p_fundador_descuento_pct numeric, p_fundador_cupos integer, p_fundador_meses integer,
  p_impuesto_pct numeric, p_precio_mas_impuesto boolean
) returns public.pais language plpgsql security definer set search_path = public as $$
declare v public.pais;
begin
  if not public.is_supersu() then raise exception 'NO_AUTORIZADO'; end if;
  update public.pais set
    activo = coalesce(p_activo, activo), pasarela = coalesce(p_pasarela, pasarela),
    cobro_recurrente_habilitado = coalesce(p_cobro_recurrente, cobro_recurrente_habilitado),
    fundador_descuento_pct = coalesce(p_fundador_descuento_pct, fundador_descuento_pct),
    fundador_cupos = coalesce(p_fundador_cupos, fundador_cupos),
    fundador_meses = coalesce(p_fundador_meses, fundador_meses),
    impuesto_pct = p_impuesto_pct, precio_mas_impuesto = coalesce(p_precio_mas_impuesto, precio_mas_impuesto),
    updated_at = now(), updated_by = auth.uid()
  where codigo = p_codigo returning * into v;
  if not found then raise exception 'PAIS_NO_ENCONTRADO'; end if;
  insert into public.evento_auditoria (entidad_tipo, accion, actor_tipo, actor_id, motivo)
  values ('pais', 'PAIS_ACTUALIZADO_' || p_codigo, 'SUPERSU', auth.uid(), null);
  return v;
end $$;

create function public.admin_set_plan_precio(
  p_plan public.plan_codigo, p_pais char(2), p_precio_mensual numeric, p_es_desde boolean,
  p_precio_staff_extra numeric, p_precio_sede_extra numeric, p_activo boolean
) returns public.plan_precio language plpgsql security definer set search_path = public as $$
declare v public.plan_precio;
begin
  if not public.is_supersu() then raise exception 'NO_AUTORIZADO'; end if;
  if p_pais = 'CO' then
    -- COP vive en `plan`; el trigger refleja el cambio en plan_precio.
    update public.plan set precio_mensual = p_precio_mensual, staff_addon_precio = p_precio_staff_extra,
           sede_addon_precio = p_precio_sede_extra, updated_at = now() where codigo = p_plan;
    update public.plan_precio set es_desde = p_es_desde, activo = coalesce(p_activo, activo), updated_by = auth.uid()
     where plan_codigo = p_plan and pais_codigo = 'CO' returning * into v;
  else
    insert into public.plan_precio (plan_codigo, pais_codigo, precio_mensual, es_desde, precio_staff_extra, precio_sede_extra, activo, updated_by)
    values (p_plan, p_pais, p_precio_mensual, coalesce(p_es_desde, false), p_precio_staff_extra, p_precio_sede_extra, coalesce(p_activo, true), auth.uid())
    on conflict (plan_codigo, pais_codigo) do update set
      precio_mensual = excluded.precio_mensual, es_desde = excluded.es_desde, precio_staff_extra = excluded.precio_staff_extra,
      precio_sede_extra = excluded.precio_sede_extra, activo = excluded.activo, updated_at = now(), updated_by = auth.uid()
    returning * into v;
  end if;
  insert into public.evento_auditoria (entidad_tipo, accion, actor_tipo, actor_id)
  values ('plan_precio', 'PRECIO_ACTUALIZADO_' || p_plan::text || '_' || p_pais, 'SUPERSU', auth.uid());
  return v;
end $$;

create function public.admin_set_addon_precio(p_addon text, p_pais char(2), p_precio numeric)
returns public.addon_precio language plpgsql security definer set search_path = public as $$
declare v public.addon_precio;
begin
  if not public.is_supersu() then raise exception 'NO_AUTORIZADO'; end if;
  insert into public.addon_precio (addon_codigo, pais_codigo, precio_mensual, updated_by) values (p_addon, p_pais, p_precio, auth.uid())
  on conflict (addon_codigo, pais_codigo) do update set precio_mensual = excluded.precio_mensual, updated_at = now(), updated_by = auth.uid()
  returning * into v;
  insert into public.evento_auditoria (entidad_tipo, accion, actor_tipo, actor_id)
  values ('addon_precio', 'ADDON_PRECIO_' || p_addon || '_' || p_pais, 'SUPERSU', auth.uid());
  return v;
end $$;

create function public.admin_set_plan_caracteristica(p_plan public.plan_codigo, p_clave text, p_habilitado boolean, p_valor text)
returns public.plan_caracteristica language plpgsql security definer set search_path = public as $$
declare v public.plan_caracteristica;
begin
  if not public.is_supersu() then raise exception 'NO_AUTORIZADO'; end if;
  insert into public.plan_caracteristica (plan_codigo, clave, habilitado, valor) values (p_plan, p_clave, p_habilitado, p_valor)
  on conflict (plan_codigo, clave) do update set habilitado = excluded.habilitado, valor = excluded.valor, updated_at = now()
  returning * into v;
  insert into public.evento_auditoria (entidad_tipo, accion, actor_tipo, actor_id)
  values ('plan_caracteristica', 'CARACTERISTICA_' || p_plan::text || '_' || p_clave, 'SUPERSU', auth.uid());
  return v;
end $$;

-- ───────────────────────── permisos de ejecución ─────────────────────────
-- Los GRANT a public/anon/authenticated son independientes: se revocan los tres explícitamente.
do $$
declare f text;
begin
  -- Solo service_role (cron / webhooks): nunca invocables desde el navegador.
  foreach f in array array[
    'public._reclamar_fundador(uuid, bpchar, plan_codigo, timestamptz)',
    'public.registrar_resultado_cobro(uuid, boolean, text)',
    'public.mantenimiento_suscripciones()',
    'public.pruebas_por_cobrar()',
    'public.avisos_prueba_pendientes()',
    'public.marcar_aviso_prueba(uuid, text)',
    'public.activar_addon_negocio(uuid, text, boolean, integer)',
    'public.trg_plan_sync_precio_co()',
    'public.trg_suscripcion_pierde_fundador()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
  -- Usuario autenticado (cada una valida auth.uid() / is_supersu() por dentro).
  foreach f in array array[
    'public.iniciar_prueba_negocio(uuid, plan_codigo, text, text, text, text, text, text)',
    'public.guardar_marca_negocio(uuid, text, text, text, text, text, boolean)',
    'public.admin_set_pais(bpchar, boolean, text, boolean, numeric, integer, integer, numeric, boolean)',
    'public.admin_set_plan_precio(plan_codigo, bpchar, numeric, boolean, numeric, numeric, boolean)',
    'public.admin_set_addon_precio(text, bpchar, numeric)',
    'public.admin_set_plan_caracteristica(plan_codigo, text, boolean, text)',
    'public.negocio_tiene_funcion(uuid, text)',
    'public.negocio_funcion_valor(uuid, text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  -- Lectura pública (landing, marketplace): contador de cupos y reglas de visibilidad.
  foreach f in array array[
    'public.fundador_cupos_restantes(bpchar)',
    'public.negocio_puede_recibir_reservas(uuid)',
    'public.negocio_visible_en_mapa(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
end $$;
