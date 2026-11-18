-- 148 · CENTRO DE EVIDENCIAS LEGALES (Super Admin) — Fase 4 (2026-11-16)
--
-- La tabla `evidencia_legal` (146) NO tiene política para SuperSU: todo acceso del CRM pasa por
-- estas funciones, que (1) exigen SuperSU con el rol REAL de la sesión, (2) dejan rastro en
-- `evento_auditoria` de CADA consulta y exportación, y (3) recalculan la huella de cada fila.
-- Son VOLATILE porque escriben la auditoría. Ninguna modifica ni borra evidencias.
-- La auditoría se inserta al final, cuando la consulta ya tuvo éxito: un RAISE previo revierte
-- todo, así que no se registran consultas que no devolvieron datos.

begin;

-- Verificación de UNA fila: huella del contenido, huella del texto y enlace con la anterior.
create or replace function public._verificar_evidencia(e public.evidencia_legal)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'contenido_ok', e.hash = public._evidencia_hash(e),
    'texto_ok', e.texto is null or e.texto_sha256 = encode(sha256(convert_to(e.texto, 'UTF8')), 'hex'),
    'enlace_ok', e.hash_anterior is not distinct from (select p.hash from public.evidencia_legal p where p.secuencia = e.secuencia - 1));
$$;
revoke all on function public._verificar_evidencia(public.evidencia_legal) from public, anon, authenticated;

-- ── Búsqueda con filtros (sin el texto completo: eso va en el detalle o el expediente) ──────
create or replace function public.admin_buscar_evidencias(
  p_correo text default null,
  p_usuario uuid default null,
  p_negocio uuid default null,
  p_categoria text default null,
  p_documento text default null,
  p_accion text default null,
  p_desde timestamptz default null,
  p_hasta timestamptz default null,
  p_limite int default 50,
  p_offset int default 0)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_usuario uuid := p_usuario;
  v_total bigint;
  v_filas jsonb;
  v_limite int := least(greatest(coalesce(p_limite, 50), 1), 200);
begin
  if not coalesce(public.is_supersu(), false) then raise exception 'NO_AUTORIZADO'; end if;
  if nullif(btrim(p_correo), '') is not null then
    select u.id into v_usuario from auth.users u where lower(u.email) = lower(btrim(p_correo));
    if v_usuario is null then
      -- Correo sin cuenta: resultado vacío (no se distingue de «sin evidencias»).
      v_usuario := '00000000-0000-0000-0000-000000000000';
    end if;
  end if;

  select count(*) into v_total
  from public.evidencia_legal e
  where (v_usuario is null or e.usuario_id = v_usuario)
    and (p_negocio is null or e.negocio_id = p_negocio)
    and (p_categoria is null or e.categoria = p_categoria)
    and (p_documento is null or e.documento = p_documento)
    and (p_accion is null or e.accion = p_accion)
    and (p_desde is null or e.ocurrido_at >= p_desde)
    and (p_hasta is null or e.ocurrido_at < p_hasta);

  select coalesce(jsonb_agg(f order by (f->>'secuencia')::bigint desc), '[]'::jsonb) into v_filas
  from (
    select jsonb_build_object(
      'id', e.id, 'secuencia', e.secuencia, 'usuario_id', e.usuario_id,
      'correo', (select u.email from auth.users u where u.id = e.usuario_id),
      'rol', e.rol, 'negocio_id', e.negocio_id,
      'negocio', (select n.nombre from public.negocio n where n.id = e.negocio_id),
      'categoria', e.categoria, 'documento', e.documento, 'accion', e.accion, 'version', e.version,
      'canal', e.canal, 'finalidad', e.finalidad, 'importado', e.importado,
      'ocurrido_at', e.ocurrido_at, 'registrado_at', e.registrado_at, 'relacionado_con', e.relacionado_con,
      'tiene_texto', e.texto is not null) as f
    from public.evidencia_legal e
    where (v_usuario is null or e.usuario_id = v_usuario)
      and (p_negocio is null or e.negocio_id = p_negocio)
      and (p_categoria is null or e.categoria = p_categoria)
      and (p_documento is null or e.documento = p_documento)
      and (p_accion is null or e.accion = p_accion)
      and (p_desde is null or e.ocurrido_at >= p_desde)
      and (p_hasta is null or e.ocurrido_at < p_hasta)
    order by e.secuencia desc
    limit v_limite offset greatest(coalesce(p_offset, 0), 0)
  ) s;

  -- Rastro: qué filtros usó (el correo no se guarda en claro; queda el titular resuelto).
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, origen, payload_despues)
  values ('evidencia_legal', v_usuario, 'CONSULTA_EVIDENCIAS', 'SUPERSU', auth.uid(), 'PANEL',
          jsonb_strip_nulls(jsonb_build_object(
            'usuario', v_usuario, 'negocio', p_negocio, 'categoria', p_categoria, 'documento', p_documento,
            'accion', p_accion, 'desde', p_desde, 'hasta', p_hasta, 'offset', p_offset, 'resultados', v_total)));

  return jsonb_build_object('total', v_total, 'filas', v_filas);
end $$;
revoke all on function public.admin_buscar_evidencias(text, uuid, uuid, text, text, text, timestamptz, timestamptz, int, int) from public, anon, authenticated;
grant execute on function public.admin_buscar_evidencias(text, uuid, uuid, text, text, text, timestamptz, timestamptz, int, int) to authenticated;

-- ── Detalle de una evidencia con el texto exacto y su verificación ──────────────────────────
create or replace function public.admin_evidencia_detalle(p_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare e public.evidencia_legal;
begin
  if not coalesce(public.is_supersu(), false) then raise exception 'NO_AUTORIZADO'; end if;
  select * into e from public.evidencia_legal where id = p_id;
  if not found then raise exception 'NO_ENCONTRADA'; end if;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, origen, negocio_id)
  values ('evidencia_legal', e.id, 'CONSULTA_EVIDENCIA', 'SUPERSU', auth.uid(), 'PANEL', e.negocio_id);

  return to_jsonb(e)
    || jsonb_build_object(
         'correo', (select u.email from auth.users u where u.id = e.usuario_id),
         'negocio', (select n.nombre from public.negocio n where n.id = e.negocio_id),
         'verificacion', public._verificar_evidencia(e));
end $$;
revoke all on function public.admin_evidencia_detalle(uuid) from public, anon, authenticated;
grant execute on function public.admin_evidencia_detalle(uuid) to authenticated;

-- ── Expediente descargable de un titular (requiere motivo) ──────────────────────────────────
create or replace function public.admin_expediente_evidencias(p_usuario uuid, p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_evidencias jsonb;
  v_n int;
  v_fallas int;
  v_correo text;
begin
  if not coalesce(public.is_supersu(), false) then raise exception 'NO_AUTORIZADO'; end if;
  if length(btrim(coalesce(p_motivo, ''))) < 10 then raise exception 'MOTIVO_REQUERIDO'; end if;
  select u.email into v_correo from auth.users u where u.id = p_usuario;

  select coalesce(jsonb_agg(to_jsonb(e) || jsonb_build_object('verificacion', public._verificar_evidencia(e)) order by e.secuencia), '[]'::jsonb),
         count(*)
    into v_evidencias, v_n
  from public.evidencia_legal e where e.usuario_id = p_usuario;

  select count(*) into v_fallas
  from jsonb_array_elements(v_evidencias) x
  where not ((x->'verificacion'->>'contenido_ok')::boolean and (x->'verificacion'->>'texto_ok')::boolean and (x->'verificacion'->>'enlace_ok')::boolean);

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, origen, motivo, payload_despues)
  values ('evidencia_legal', p_usuario, 'EXPORTA_EXPEDIENTE', 'SUPERSU', auth.uid(), 'PANEL', btrim(p_motivo),
          jsonb_build_object('evidencias', v_n, 'fallas_verificacion', v_fallas));

  return jsonb_build_object(
    'formato', 'stylernow.expediente_evidencias.v1',
    'generado_at', clock_timestamp(),
    'generado_por', auth.uid(),
    'motivo', btrim(p_motivo),
    'titular', jsonb_build_object('usuario_id', p_usuario, 'correo', v_correo),
    'total', v_n,
    'fallas_verificacion', v_fallas,
    'metodo_verificacion',
      'Cada evidencia guarda hash = SHA-256 de su forma canónica (jsonb ordenado) concatenada con hash_anterior; '
      || 'texto_sha256 = SHA-256 del texto exacto mostrado. contenido_ok/texto_ok recalculan ambos; enlace_ok compara '
      || 'hash_anterior con el hash de la secuencia previa de la cadena global.',
    'capturado', jsonb_build_array(
      'Fecha y hora del servidor del evento (ocurrido_at) y de su registro en el repositorio (registrado_at)',
      'Titular, rol, negocio y sede cuando aplica',
      'Documento, versión, finalidad y texto exacto (o su huella) mostrado al titular',
      'Acción (acepta, acepta tácitamente, rechaza, revoca, modifica, solicita) y canal',
      'Evento relacionado (p. ej. la aceptación que una revocación retira)'),
    'no_capturado', jsonb_build_array(
      'Dirección IP (decisión F: no se recolecta)',
      'Agente de usuario / navegador (decisión F: no se recolecta)',
      'Evidencias anteriores al repositorio: se importaron (importado = true) con la fecha de su tabla de origen; '
      || 'si la tabla de origen no guardaba el texto, solo consta la versión del documento'),
    'evidencias', v_evidencias);
end $$;
revoke all on function public.admin_expediente_evidencias(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_expediente_evidencias(uuid, text) to authenticated;

-- ── Verificación completa de la cadena desde el CRM (también auditada) ──────────────────────
create or replace function public.admin_verificar_cadena_evidencias()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_problemas jsonb;
  v_total bigint;
begin
  if not coalesce(public.is_supersu(), false) then raise exception 'NO_AUTORIZADO'; end if;
  select count(*) into v_total from public.evidencia_legal;
  select coalesce(jsonb_agg(jsonb_build_object('secuencia', v.secuencia, 'problema', v.problema)), '[]'::jsonb)
    into v_problemas from public.verificar_cadena_evidencias(1, null) v;
  insert into public.evento_auditoria (entidad_tipo, accion, actor_tipo, actor_id, origen, payload_despues)
  values ('evidencia_legal', 'VERIFICA_CADENA', 'SUPERSU', auth.uid(), 'PANEL',
          jsonb_build_object('total', v_total, 'problemas', jsonb_array_length(v_problemas)));
  return jsonb_build_object('total', v_total, 'verificado_at', clock_timestamp(), 'problemas', v_problemas);
end $$;
revoke all on function public.admin_verificar_cadena_evidencias() from public, anon, authenticated;
grant execute on function public.admin_verificar_cadena_evidencias() to authenticated;

commit;
