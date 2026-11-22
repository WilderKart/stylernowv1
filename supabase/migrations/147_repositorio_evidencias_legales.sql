-- 147 — Fase 2: repositorio central de evidencias legales (append-only, con hash encadenado).
--
-- Una fila = un evento demostrable: quién (titular y su rol en ese momento), sobre qué documento o
-- finalidad, qué texto exacto y versión se le presentó, qué hizo (acepta, acepta tácitamente,
-- rechaza, revoca, solicita), por qué canal, cuándo (UTC) y con qué relación a eventos anteriores.
--
-- Integridad:
--  · Solo se inserta (trigger de inmutabilidad para UPDATE/DELETE; ningún rol de API escribe directo).
--  · Cada fila guarda SHA-256 de su contenido canónico + el hash de la fila anterior (cadena): si
--    alguien con acceso directo a la base altera una fila, `verificar_cadena_evidencias()` lo detecta.
--    No es «inmutable absoluto»: es detección verificable de alteraciones.
--  · Sin claves foráneas hacia cuentas, negocios ni perfiles: la evidencia NO se borra en cascada
--    cuando se elimina una cuenta (decisión G). Qué se anonimiza y cuándo lo define la política de
--    conservación (pendiente de validación jurídica): aquí no se borra nada.
--  · Sin IP ni navegador (decisión F).
--
-- Fuentes: las tablas existentes siguen funcionando igual y, por trigger, cada inserción nueva se
-- copia aquí. Lo ya existente se IMPORTA una vez, marcado `importado = true` (no es una aceptación
-- nueva ni retroactiva: es la misma evidencia trasladada, con su fecha original).

create table if not exists public.evidencia_legal (
  id uuid primary key default gen_random_uuid(),
  secuencia bigint not null unique,
  usuario_id uuid not null,
  rol text not null check (rol in ('CLIENTE', 'BARBERIA', 'STAFF', 'GUARDIAN', 'SUPERSU', 'SISTEMA')),
  negocio_id uuid,
  sede_id uuid,
  categoria text not null check (categoria in
    ('CONTRACTUAL', 'TRATAMIENTO_DATOS', 'CONSENTIMIENTO_ESPECIFICO', 'PREFERENCIA_PRIVACIDAD', 'DERECHOS_TITULAR')),
  documento text not null,
  finalidad text not null,
  accion text not null check (accion in ('ACEPTA', 'ACEPTA_TACITA', 'RECHAZA', 'REVOCA', 'MODIFICA', 'SOLICITA')),
  texto text,
  texto_sha256 text,
  version text,
  documento_id uuid,
  canal text not null,
  referencia_tipo text,
  referencia_id uuid,
  relacionado_con uuid,
  fuente_tabla text not null,
  fuente_id text not null,
  importado boolean not null default false,
  ocurrido_at timestamptz not null,
  registrado_at timestamptz not null default clock_timestamp(),
  hash_anterior text,
  hash text not null,
  unique (fuente_tabla, fuente_id)
);

create index if not exists evidencia_legal_usuario_idx on public.evidencia_legal (usuario_id, ocurrido_at);
create index if not exists evidencia_legal_negocio_idx on public.evidencia_legal (negocio_id, ocurrido_at) where negocio_id is not null;
create index if not exists evidencia_legal_documento_idx on public.evidencia_legal (documento, version);

alter table public.evidencia_legal enable row level security;
revoke all on public.evidencia_legal from public, anon, authenticated;
-- service_role: solo lectura. Salta la RLS y TRUNCATE no dispara el trigger de inmutabilidad.
revoke all on public.evidencia_legal from service_role;
grant select on public.evidencia_legal to authenticated;
grant select on public.evidencia_legal to service_role;

-- Titular: ve su propio historial. Negocio: solo eventos ligados a SU negocio (su staff, sus reservas).
-- El Super Admin NO lee directo: usa funciones que dejan auditoría de cada consulta (Fase 4).
drop policy if exists evidencia_legal_titular on public.evidencia_legal;
create policy evidencia_legal_titular on public.evidencia_legal for select to authenticated
  using (usuario_id = (select auth.uid()));
drop policy if exists evidencia_legal_negocio on public.evidencia_legal;
create policy evidencia_legal_negocio on public.evidencia_legal for select to authenticated
  using (negocio_id is not null and coalesce(public.is_barberia_de(negocio_id), false));

drop trigger if exists trg_evidencia_legal_inmutable on public.evidencia_legal;
create trigger trg_evidencia_legal_inmutable before update or delete on public.evidencia_legal
  for each row execute function public.trg_fila_inmutable();

-- ── Hash canónico ───────────────────────────────────────────────────────────
create or replace function public._evidencia_canonica(e public.evidencia_legal)
returns text language sql immutable set search_path = public as $$
  select jsonb_build_object(
    'id', e.id, 'secuencia', e.secuencia, 'usuario_id', e.usuario_id, 'rol', e.rol,
    'negocio_id', e.negocio_id, 'sede_id', e.sede_id, 'categoria', e.categoria,
    'documento', e.documento, 'finalidad', e.finalidad, 'accion', e.accion,
    'texto_sha256', e.texto_sha256, 'version', e.version, 'documento_id', e.documento_id,
    'canal', e.canal, 'referencia_tipo', e.referencia_tipo, 'referencia_id', e.referencia_id,
    'relacionado_con', e.relacionado_con, 'fuente_tabla', e.fuente_tabla, 'fuente_id', e.fuente_id,
    'importado', e.importado,
    'ocurrido_at', to_char(e.ocurrido_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'registrado_at', to_char(e.registrado_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))::text;
$$;

create or replace function public._evidencia_hash(e public.evidencia_legal)
returns text language sql immutable set search_path = public as $$
  select encode(sha256(convert_to(coalesce(e.hash_anterior, 'GENESIS') || '|' || public._evidencia_canonica(e), 'UTF8')), 'hex');
$$;

-- Asigna secuencia y hash en orden estricto (un candado por transacción serializa la cadena).
-- Internas: sin ejecución para los roles de la API (los default privileges se lo darían a public).
revoke all on function public._evidencia_canonica(public.evidencia_legal) from public, anon, authenticated;
revoke all on function public._evidencia_hash(public.evidencia_legal) from public, anon, authenticated;

create or replace function public.trg_evidencia_legal_cadena() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_ultima public.evidencia_legal;
begin
  perform pg_advisory_xact_lock(hashtext('evidencia_legal_cadena'));
  select * into v_ultima from public.evidencia_legal order by secuencia desc limit 1;
  new.secuencia := coalesce(v_ultima.secuencia, 0) + 1;
  new.hash_anterior := v_ultima.hash;
  new.registrado_at := clock_timestamp();
  if new.texto is not null then
    new.texto_sha256 := encode(sha256(convert_to(new.texto, 'UTF8')), 'hex');
  end if;
  new.hash := public._evidencia_hash(new);
  return new;
end $$;
revoke all on function public.trg_evidencia_legal_cadena() from public, anon, authenticated;
drop trigger if exists trg_evidencia_legal_cadena on public.evidencia_legal;
create trigger trg_evidencia_legal_cadena before insert on public.evidencia_legal
  for each row execute function public.trg_evidencia_legal_cadena();

-- ── Rol del titular en el momento del evento ────────────────────────────────
create or replace function public._rol_de_usuario(p_usuario uuid, p_negocio uuid default null)
returns text language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from public.perfil p where p.id = p_usuario and p.es_supersu) then 'SUPERSU'
    when p_negocio is not null and exists (select 1 from public.negocio n where n.id = p_negocio and n.owner_user_id = p_usuario) then 'BARBERIA'
    when exists (select 1 from public.vinculo_staff_negocio v where v.staff_id = p_usuario and v.estado <> 'RETIRADO'
                 and (p_negocio is null or v.negocio_id = p_negocio) and v.es_guardian) then 'GUARDIAN'
    when exists (select 1 from public.vinculo_staff_negocio v where v.staff_id = p_usuario and v.estado <> 'RETIRADO'
                 and (p_negocio is null or v.negocio_id = p_negocio)) then 'STAFF'
    when p_negocio is null and exists (select 1 from public.negocio n where n.owner_user_id = p_usuario) then 'BARBERIA'
    else 'CLIENTE'
  end;
$$;
revoke all on function public._rol_de_usuario(uuid, uuid) from public, anon, authenticated;

-- ── Inserción interna (la usan triggers y funciones del servidor; nunca la API) ──
create or replace function public._registrar_evidencia(
  p_usuario uuid, p_negocio uuid, p_sede uuid, p_categoria text, p_documento text, p_finalidad text,
  p_accion text, p_texto text, p_version text, p_documento_id uuid, p_canal text,
  p_ref_tipo text, p_ref_id uuid, p_relacionado uuid, p_fuente_tabla text, p_fuente_id text,
  p_ocurrido timestamptz, p_importado boolean default false, p_rol text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  insert into public.evidencia_legal (usuario_id, rol, negocio_id, sede_id, categoria, documento, finalidad, accion,
    texto, version, documento_id, canal, referencia_tipo, referencia_id, relacionado_con, fuente_tabla, fuente_id,
    importado, ocurrido_at, secuencia, hash)
  values (p_usuario, coalesce(p_rol, public._rol_de_usuario(p_usuario, p_negocio)), p_negocio, p_sede, p_categoria,
    p_documento, p_finalidad, p_accion, p_texto, p_version, p_documento_id, p_canal, p_ref_tipo, p_ref_id,
    p_relacionado, p_fuente_tabla, p_fuente_id, coalesce(p_importado, false), coalesce(p_ocurrido, clock_timestamp()), 0, '')
  on conflict (fuente_tabla, fuente_id) do nothing
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public._registrar_evidencia(uuid, uuid, uuid, text, text, text, text, text, text, uuid, text, text, uuid, uuid, text, text, timestamptz, boolean, text) from public, anon, authenticated;

-- ── Copia automática desde las tablas existentes ────────────────────────────
-- Términos y Política de Datos
create or replace function public._evidencia_desde_aceptacion_legal(a public.aceptacion_legal, p_importado boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare t public.texto_legal;
begin
  select * into t from public.texto_legal where id = a.texto_legal_id;
  return public._registrar_evidencia(
    a.usuario_id, null, null,
    case when t.tipo = 'POLITICA_DATOS' then 'TRATAMIENTO_DATOS' else 'CONTRACTUAL' end,
    t.tipo,
    case when t.tipo = 'POLITICA_DATOS' then 'Tratamiento de datos personales según la Política de Tratamiento de Datos'
         else 'Uso de la plataforma según los Términos y Condiciones' end,
    case when a.tipo_aceptacion = 'TACITA' then 'ACEPTA_TACITA' else 'ACEPTA' end,
    t.contenido, t.version::text, t.id, a.origen, null, null, null,
    'aceptacion_legal', a.usuario_id::text || ':' || a.texto_legal_id::text, a.aceptado_at, p_importado);
end $$;
revoke all on function public._evidencia_desde_aceptacion_legal(public.aceptacion_legal, boolean) from public, anon, authenticated;

create or replace function public.trg_ev_aceptacion_legal() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public._evidencia_desde_aceptacion_legal(new, false);
  return new;
end $$;
revoke all on function public.trg_ev_aceptacion_legal() from public, anon, authenticated;
drop trigger if exists trg_ev_aceptacion_legal on public.aceptacion_legal;
create trigger trg_ev_aceptacion_legal after insert on public.aceptacion_legal for each row execute function public.trg_ev_aceptacion_legal();

-- Preferencias de privacidad y consentimientos específicos (marketing, analítica, …): la fuente no
-- guarda el texto mostrado; la evidencia lo declara (texto = null → «texto no capturado»).
create or replace function public._evidencia_desde_consentimiento(c public.consentimiento_evento, p_importado boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_anterior uuid;
begin
  -- Un «no otorgado» después de un «otorgado» es una revocación ligada al otorgamiento anterior.
  if not c.otorgado then
    select e.id into v_anterior from public.evidencia_legal e
     where e.usuario_id = c.usuario_id and e.fuente_tabla = 'consentimiento_evento' and e.documento = c.proposito
       and e.accion = 'ACEPTA' and e.ocurrido_at <= c.created_at
     order by e.ocurrido_at desc limit 1;
  end if;
  return public._registrar_evidencia(
    c.usuario_id, null, null,
    case when c.proposito in ('analitica', 'personalizacion') then 'PREFERENCIA_PRIVACIDAD' else 'CONSENTIMIENTO_ESPECIFICO' end,
    c.proposito,
    case c.proposito
      when 'marketing_email' then 'Recibir novedades y ofertas de StylerNow por correo'
      when 'marketing_whatsapp' then 'Recibir novedades y ofertas por WhatsApp'
      when 'analitica' then 'Analítica de uso de la aplicación'
      when 'personalizacion' then 'Personalización de la experiencia'
      when 'ofertas_cercanas' then 'Ofertas de negocios cercanos'
      when 'beneficios_marcas' then 'Beneficios de marcas aliadas'
      else c.proposito end,
    case when c.otorgado then 'ACEPTA' when v_anterior is not null then 'REVOCA' else 'RECHAZA' end,
    null, null, null, c.origen, null, null, v_anterior,
    'consentimiento_evento', c.id::text, c.created_at, p_importado);
end $$;
revoke all on function public._evidencia_desde_consentimiento(public.consentimiento_evento, boolean) from public, anon, authenticated;

create or replace function public.trg_ev_consentimiento() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public._evidencia_desde_consentimiento(new, false);
  return new;
end $$;
revoke all on function public.trg_ev_consentimiento() from public, anon, authenticated;
drop trigger if exists trg_ev_consentimiento on public.consentimiento_evento;
create trigger trg_ev_consentimiento after insert on public.consentimiento_evento for each row execute function public.trg_ev_consentimiento();

-- Política de cancelación aceptada al pagar el anticipo
create or replace function public._evidencia_desde_politica_reserva(a public.aceptacion_politica_reserva, p_importado boolean)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  return public._registrar_evidencia(
    a.cliente_id, a.negocio_id, null, 'CONTRACTUAL', 'POLITICA_CANCELACION',
    'Condiciones de cancelación y reembolso del anticipo de la reserva',
    'ACEPTA', a.texto_aceptado, a.version_politica, null, 'pago', 'reserva', a.reserva_id, null,
    'aceptacion_politica_reserva', a.id::text, a.aceptado_at, p_importado, 'CLIENTE');
end $$;
revoke all on function public._evidencia_desde_politica_reserva(public.aceptacion_politica_reserva, boolean) from public, anon, authenticated;

create or replace function public.trg_ev_politica_reserva() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public._evidencia_desde_politica_reserva(new, false);
  return new;
end $$;
revoke all on function public.trg_ev_politica_reserva() from public, anon, authenticated;
drop trigger if exists trg_ev_politica_reserva on public.aceptacion_politica_reserva;
create trigger trg_ev_politica_reserva after insert on public.aceptacion_politica_reserva for each row execute function public.trg_ev_politica_reserva();

-- Autorización de datos por reserva (143)
create or replace function public._evidencia_desde_autorizacion_reserva(a public.autorizacion_datos_reserva, p_importado boolean)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  return public._registrar_evidencia(
    a.cliente_id, a.negocio_id, null, 'TRATAMIENTO_DATOS', 'AUTORIZACION_DATOS_RESERVA',
    'Usar nombre, celular y correo para gestionar la reserva y avisar sobre ella',
    'ACEPTA', a.texto_aceptado, a.version_texto, a.politica_datos_id, 'reserva', 'reserva', a.reserva_id, null,
    'autorizacion_datos_reserva', a.id::text, a.aceptado_at, p_importado, 'CLIENTE');
end $$;
revoke all on function public._evidencia_desde_autorizacion_reserva(public.autorizacion_datos_reserva, boolean) from public, anon, authenticated;

create or replace function public.trg_ev_autorizacion_reserva() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public._evidencia_desde_autorizacion_reserva(new, false);
  return new;
end $$;
revoke all on function public.trg_ev_autorizacion_reserva() from public, anon, authenticated;
drop trigger if exists trg_ev_autorizacion_reserva on public.autorizacion_datos_reserva;
create trigger trg_ev_autorizacion_reserva after insert on public.autorizacion_datos_reserva for each row execute function public.trg_ev_autorizacion_reserva();

-- Solicitudes de derechos del titular (exportación / eliminación de cuenta)
create or replace function public._evidencia_desde_solicitud(s public.solicitud_cuenta, p_importado boolean)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  return public._registrar_evidencia(
    s.usuario_id, null, null, 'DERECHOS_TITULAR',
    case s.tipo when 'EXPORTACION' then 'SOLICITUD_ACCESO_DATOS' else 'SOLICITUD_SUPRESION' end,
    case s.tipo when 'EXPORTACION' then 'Obtener una copia de los datos personales' else 'Eliminar la cuenta y suprimir los datos personales' end,
    'SOLICITA', null, null, null, 'cuenta', 'solicitud_cuenta', s.id, null,
    'solicitud_cuenta', s.id::text, s.created_at, p_importado);
end $$;
revoke all on function public._evidencia_desde_solicitud(public.solicitud_cuenta, boolean) from public, anon, authenticated;

create or replace function public.trg_ev_solicitud() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public._evidencia_desde_solicitud(new, false);
  return new;
end $$;
revoke all on function public.trg_ev_solicitud() from public, anon, authenticated;
drop trigger if exists trg_ev_solicitud on public.solicitud_cuenta;
create trigger trg_ev_solicitud after insert on public.solicitud_cuenta for each row execute function public.trg_ev_solicitud();

-- ── Importación única de la evidencia que ya existía (en orden cronológico) ──
do $$
declare r record;
begin
  for r in
    select 'AL' k, a.aceptado_at t, a.usuario_id::text || ':' || a.texto_legal_id::text f from public.aceptacion_legal a
    union all select 'CE', c.created_at, c.id::text from public.consentimiento_evento c
    union all select 'PR', p.aceptado_at, p.id::text from public.aceptacion_politica_reserva p
    union all select 'AR', d.aceptado_at, d.id::text from public.autorizacion_datos_reserva d
    union all select 'SC', s.created_at, s.id::text from public.solicitud_cuenta s
    order by 2, 1, 3
  loop
    if r.k = 'AL' then
      perform public._evidencia_desde_aceptacion_legal(a, true) from public.aceptacion_legal a where a.usuario_id::text || ':' || a.texto_legal_id::text = r.f;
    elsif r.k = 'CE' then
      perform public._evidencia_desde_consentimiento(c, true) from public.consentimiento_evento c where c.id::text = r.f;
    elsif r.k = 'PR' then
      perform public._evidencia_desde_politica_reserva(p, true) from public.aceptacion_politica_reserva p where p.id::text = r.f;
    elsif r.k = 'AR' then
      perform public._evidencia_desde_autorizacion_reserva(d, true) from public.autorizacion_datos_reserva d where d.id::text = r.f;
    else
      perform public._evidencia_desde_solicitud(s, true) from public.solicitud_cuenta s where s.id::text = r.f;
    end if;
  end loop;
end $$;

-- ── Verificación de integridad ──────────────────────────────────────────────
-- Recorre la cadena y devuelve las filas cuyo hash no coincide (vacío = íntegra).
create or replace function public.verificar_cadena_evidencias(p_desde bigint default 1, p_hasta bigint default null)
returns table (secuencia bigint, problema text)
language plpgsql stable security definer set search_path = public as $$
declare
  e public.evidencia_legal;
  v_previo text := null;
begin
  -- Dentro de SECURITY DEFINER current_user es el dueño: se valida el rol REAL de quien llama.
  -- Sin JWT (sesión directa del DBA por psql) se permite; por la API siempre hay claims (anon incluido).
  if not (coalesce(public.is_supersu(), false) or coalesce(auth.role(), '') = 'service_role'
          or coalesce(current_setting('request.jwt.claims', true), '') = '') then
    raise exception 'NO_AUTORIZADO';
  end if;
  if p_desde > 1 then
    select x.hash into v_previo from public.evidencia_legal x where x.secuencia = p_desde - 1;
  end if;
  for e in select * from public.evidencia_legal x where x.secuencia >= p_desde and (p_hasta is null or x.secuencia <= p_hasta) order by x.secuencia loop
    if e.hash_anterior is distinct from v_previo then
      secuencia := e.secuencia; problema := 'ENLACE_ROTO'; return next;
    end if;
    if e.hash <> public._evidencia_hash(e) then
      secuencia := e.secuencia; problema := 'CONTENIDO_ALTERADO'; return next;
    end if;
    if e.texto is not null and e.texto_sha256 is distinct from encode(sha256(convert_to(e.texto, 'UTF8')), 'hex') then
      secuencia := e.secuencia; problema := 'TEXTO_ALTERADO'; return next;
    end if;
    v_previo := e.hash;
  end loop;
end $$;
revoke all on function public.verificar_cadena_evidencias(bigint, bigint) from public, anon, authenticated;
grant execute on function public.verificar_cadena_evidencias(bigint, bigint) to authenticated, service_role;
