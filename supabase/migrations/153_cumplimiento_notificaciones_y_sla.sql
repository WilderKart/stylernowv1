-- 153 · Centro de Cumplimiento y PQRS — Grupo D/E: configuración, cola de notificaciones (correo, CRM y SMS preparado pero
--       DESHABILITADO) y motor de SLA con alertas idempotentes.
--
--  * Todo destino es configuración (tabla), editable desde el CRM: el celular, el correo de alertas, el remitente, el correo de
--    atención y el de notificaciones operativas son cuatro claves distintas. Nada está en el código.
--  * SMS: arquitectura lista (proveedor, estado, plantillas, registro, reintentos, idempotencia). Mientras no exista proveedor +
--    credenciales válidas, cada alerta SMS se registra como CANAL_NO_HABILITADO: NUNCA se marca ENVIADA sin evidencia del proveedor.
--  * Correo: se reutiliza el adaptador de Resend ya existente (src/lib/notificaciones/adaptadores.ts); no hay segunda infraestructura.
--  * Credenciales: viven en variables de entorno del servidor; aquí solo se guarda el NOMBRE de la variable (`sms_credenciales_ref`).
--  * Las alertas llevan solo datos mínimos (número, tipo, prioridad, fechas, estado, enlace): sin nombre, documento ni contenido.

create table if not exists public.cumplimiento_config (
  clave text primary key check (clave ~ '^[a-z][a-z0-9_]{2,60}$'),
  valor jsonb not null,
  descripcion text,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
alter table public.cumplimiento_config enable row level security;
revoke all on public.cumplimiento_config from public, anon, authenticated;
grant select on public.cumplimiento_config to authenticated;
drop policy if exists cumplimiento_config_supersu on public.cumplimiento_config;
create policy cumplimiento_config_supersu on public.cumplimiento_config for select to authenticated using (coalesce(public.is_supersu(), false));

insert into public.cumplimiento_config (clave, valor, descripcion) values
  ('alertas_email_destinatarios', '["equipo@stylernow.com"]', 'Correos que reciben las alertas críticas de cumplimiento (provisional: no existe aún un correo dedicado).'),
  ('correo_remitente', '"StylerNow <notificaciones@mail.stylernow.com>"', 'Remitente de los correos (dominio verificado en Resend).'),
  ('correo_atencion', '"equipo@stylernow.com"', 'Correo de atención al usuario que se muestra al solicitante.'),
  ('correo_operativo', '"notificaciones@mail.stylernow.com"', 'Correo de notificaciones operativas del sistema.'),
  ('sms_numero', '"+57 3183943465"', 'Celular que recibirá las alertas por SMS cuando exista proveedor.'),
  ('sms_habilitado', 'false', 'SMS apagado: no hay proveedor ni credenciales.'),
  ('sms_proveedor', 'null', 'Código del proveedor SMS (null = ninguno).'),
  ('sms_credenciales_ref', 'null', 'Nombre de la variable de entorno con las credenciales del proveedor (nunca el secreto).'),
  ('sla_reglas', '{"porcentajes":[50,75],"horas_antes":[24,4],"sin_asignar_minutos":60,"sin_movimiento_dias":5,"repetir_vencido_horas":24}',
   'Reglas operativas de alerta (NO son plazos legales).')
on conflict (clave) do nothing;

-- Edición validada y auditada desde el CRM.
create or replace function public.cumplimiento_config_set(p_clave text, p_valor jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_actor uuid := public._caso_exigir_supersu(); v_ant jsonb; v text; x jsonb;
begin
  select valor into v_ant from public.cumplimiento_config where clave = p_clave;
  if not found then raise exception 'CLAVE_DESCONOCIDA'; end if;
  case p_clave
    when 'alertas_email_destinatarios' then
      if jsonb_typeof(p_valor) <> 'array' or jsonb_array_length(p_valor) not between 1 and 10 then raise exception 'VALOR_INVALIDO'; end if;
      for x in select * from jsonb_array_elements(p_valor) loop
        if jsonb_typeof(x) <> 'string' or (x #>> '{}') !~ '^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$' then raise exception 'EMAIL_INVALIDO'; end if;
      end loop;
    when 'correo_atencion', 'correo_operativo' then
      if jsonb_typeof(p_valor) <> 'string' or (p_valor #>> '{}') !~ '^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$' then raise exception 'EMAIL_INVALIDO'; end if;
    when 'correo_remitente' then
      if jsonb_typeof(p_valor) <> 'string' or length(p_valor #>> '{}') > 200 or (p_valor #>> '{}') !~ '@' then raise exception 'REMITENTE_INVALIDO'; end if;
    when 'sms_numero' then
      if jsonb_typeof(p_valor) <> 'string' or (p_valor #>> '{}') !~ '^\+[0-9][0-9 ]{7,17}$' then raise exception 'TELEFONO_INVALIDO'; end if;
    when 'sms_habilitado' then
      if jsonb_typeof(p_valor) <> 'boolean' then raise exception 'VALOR_INVALIDO'; end if;
      -- No se puede encender SMS sin proveedor ni referencia de credenciales.
      if (p_valor)::text = 'true' and ((select valor from public.cumplimiento_config where clave = 'sms_proveedor') = 'null'::jsonb
         or (select valor from public.cumplimiento_config where clave = 'sms_credenciales_ref') = 'null'::jsonb) then
        raise exception 'SMS_SIN_PROVEEDOR';
      end if;
    when 'sms_proveedor', 'sms_credenciales_ref' then
      if p_valor <> 'null'::jsonb and (jsonb_typeof(p_valor) <> 'string' or (p_valor #>> '{}') !~ '^[A-Za-z][A-Za-z0-9_]{1,60}$') then raise exception 'VALOR_INVALIDO'; end if;
    when 'sla_reglas' then
      if jsonb_typeof(p_valor) <> 'object' or jsonb_typeof(p_valor -> 'porcentajes') <> 'array' or jsonb_typeof(p_valor -> 'horas_antes') <> 'array' then raise exception 'VALOR_INVALIDO'; end if;
    else raise exception 'CLAVE_DESCONOCIDA';
  end case;
  update public.cumplimiento_config set valor = p_valor, updated_by = v_actor, updated_at = now() where clave = p_clave;
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_antes, payload_despues)
  values ('cumplimiento_config', gen_random_uuid(), 'CUMPLIMIENTO_CONFIG_CAMBIADA', 'SUPERSU', v_actor, null,
          jsonb_build_object('clave', p_clave, 'valor', v_ant), jsonb_build_object('clave', p_clave, 'valor', p_valor));
end $$;
revoke all on function public.cumplimiento_config_set(text, jsonb) from public, anon, authenticated;
grant execute on function public.cumplimiento_config_set(text, jsonb) to authenticated;

-- ── Plantillas (sin datos personales) ──────────────────────────────────────
create table if not exists public.cumplimiento_plantilla (
  codigo text not null,
  canal text not null check (canal in ('EMAIL', 'SMS', 'CRM')),
  asunto text not null check (length(asunto) between 1 and 200),
  cuerpo text not null check (length(cuerpo) between 1 and 2000),
  activa boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (codigo, canal)
);
alter table public.cumplimiento_plantilla enable row level security;
revoke all on public.cumplimiento_plantilla from public, anon, authenticated;
grant select on public.cumplimiento_plantilla to authenticated;
drop policy if exists cumplimiento_plantilla_supersu on public.cumplimiento_plantilla;
create policy cumplimiento_plantilla_supersu on public.cumplimiento_plantilla for select to authenticated using (coalesce(public.is_supersu(), false));

insert into public.cumplimiento_plantilla (codigo, canal, asunto, cuerpo)
select c.codigo, k.canal, c.asunto || case when k.canal = 'EMAIL' then ' · {{numero}}' else '' end,
  case k.canal
    when 'SMS' then c.corto || ' {{numero}} · {{prioridad}} · vence {{fecha_limite_corta}}. {{enlace}}'
    else c.corto || E'\nCaso: {{numero}}\nTipo: {{tipo}}\nPrioridad: {{prioridad}}\nEstado: {{estado}}\nRadicado: {{recibido}}\nFecha límite: {{fecha_limite}} ({{plazo_origen}})\nTiempo restante: {{restante}}\nResponsable: {{responsable}}\nAbrir en el CRM: {{enlace}}' end
from (values
  ('CASO_NUEVO',   'Nuevo caso en el Centro de Cumplimiento', 'Se radicó un caso nuevo.'),
  ('CASO_CRITICO', 'CASO CRÍTICO en el Centro de Cumplimiento', 'ALERTA: caso crítico radicado.'),
  ('SIN_ASIGNAR',  'Caso sin responsable asignado', 'Caso sin responsable.'),
  ('SLA_AVANCE',   'Plazo de un caso en riesgo', 'Se consumió buena parte del plazo.'),
  ('SLA_HORAS',    'Un caso vence pronto', 'Un caso vence pronto.'),
  ('VENCIDO',      'CASO VENCIDO', 'ALERTA: plazo vencido.'),
  ('ESCALADO',     'Caso escalado', 'Caso escalado al supervisor.'),
  ('SIN_MOVIMIENTO', 'Caso sin movimiento', 'Caso sin movimiento reciente.')
) as c(codigo, asunto, corto)
cross join (values ('EMAIL'), ('SMS'), ('CRM')) as k(canal)
on conflict (codigo, canal) do nothing;

-- ── Cola de notificaciones de cumplimiento ─────────────────────────────────
create table if not exists public.cumplimiento_notificacion (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.ticket_soporte(id),
  regla text not null check (length(regla) between 3 and 60),
  plantilla text not null,
  canal text not null check (canal in ('EMAIL', 'SMS', 'CRM')),
  destinatario_tipo text not null check (destinatario_tipo in ('ALERTA', 'SOLICITANTE')),
  destinatario text,                       -- correo o celular (null para el CRM)
  datos jsonb not null default '{}'::jsonb check (jsonb_typeof(datos) = 'object'),
  estado text not null default 'PENDIENTE' check (estado in
    ('PENDIENTE', 'PROCESANDO', 'ENVIADO', 'REINTENTANDO', 'FALLIDO', 'CANAL_NO_HABILITADO')),
  intentos integer not null default 0 check (intentos >= 0),
  max_intentos integer not null default 5 check (max_intentos between 1 and 20),
  proximo_intento_at timestamptz,
  ultimo_error text check (length(ultimo_error) <= 200),
  id_externo text check (length(id_externo) <= 300),
  enviado_at timestamptz,
  leida_at timestamptz,
  idempotency_key text not null unique check (length(idempotency_key) between 1 and 400),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cumplimiento_notif_enviado_con_evidencia check (
    estado <> 'ENVIADO' or (id_externo is not null and length(btrim(id_externo)) > 0 and enviado_at is not null))
);
create index if not exists cumplimiento_notif_cola_idx on public.cumplimiento_notificacion (estado, proximo_intento_at)
  where estado in ('PENDIENTE', 'REINTENTANDO', 'PROCESANDO');
create index if not exists cumplimiento_notif_ticket_idx on public.cumplimiento_notificacion (ticket_id, created_at desc);
create index if not exists cumplimiento_notif_crm_idx on public.cumplimiento_notificacion (created_at desc) where canal = 'CRM';

create table if not exists public.cumplimiento_notificacion_evento (
  id bigint generated always as identity primary key,
  notificacion_id uuid not null references public.cumplimiento_notificacion(id),
  estado_origen text, estado_destino text not null, intento integer not null default 0, detalle text,
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists cumplimiento_notif_evento_idx on public.cumplimiento_notificacion_evento (notificacion_id, id);
drop trigger if exists trg_cumplimiento_notif_evento_inmutable on public.cumplimiento_notificacion_evento;
create trigger trg_cumplimiento_notif_evento_inmutable before update or delete on public.cumplimiento_notificacion_evento
  for each row execute function public.trg_fila_inmutable();

alter table public.cumplimiento_notificacion enable row level security;
alter table public.cumplimiento_notificacion_evento enable row level security;
revoke all on public.cumplimiento_notificacion, public.cumplimiento_notificacion_evento from public, anon, authenticated;
grant select on public.cumplimiento_notificacion, public.cumplimiento_notificacion_evento to authenticated;
drop policy if exists cumplimiento_notif_supersu on public.cumplimiento_notificacion;
create policy cumplimiento_notif_supersu on public.cumplimiento_notificacion for select to authenticated using (coalesce(public.is_supersu(), false));
drop policy if exists cumplimiento_notif_evento_supersu on public.cumplimiento_notificacion_evento;
create policy cumplimiento_notif_evento_supersu on public.cumplimiento_notificacion_evento for select to authenticated using (coalesce(public.is_supersu(), false));

create or replace function public.trg_cumplimiento_notif_historial() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.cumplimiento_notificacion_evento (notificacion_id, estado_origen, estado_destino, intento, detalle)
    values (new.id, null, new.estado, 0, left(coalesce(new.ultimo_error, ''), 200));
  elsif new.estado is distinct from old.estado then
    insert into public.cumplimiento_notificacion_evento (notificacion_id, estado_origen, estado_destino, intento, detalle)
    values (new.id, old.estado, new.estado, new.intentos, left(coalesce(new.ultimo_error, ''), 200));
  end if;
  return null;
end $$;
revoke all on function public.trg_cumplimiento_notif_historial() from public, anon, authenticated;
drop trigger if exists trg_cumplimiento_notif_historial on public.cumplimiento_notificacion;
create trigger trg_cumplimiento_notif_historial after insert or update on public.cumplimiento_notificacion
  for each row execute function public.trg_cumplimiento_notif_historial();

-- ── Encolar alertas (deduce destinatarios de la configuración) ─────────────
create or replace function public.cumplimiento_encolar(p_ticket uuid, p_regla text, p_plantilla text, p_ventana text default 'unica')
returns integer language plpgsql security definer set search_path = public as $$
declare
  t public.ticket_soporte; v_datos jsonb; v_n integer := 0; v_rows integer; v_dest jsonb; x jsonb;
  v_sms_ok boolean; v_sms_num text; v_resp text; v_restante numeric; v_key text;
begin
  select * into t from public.ticket_soporte where id = p_ticket;
  if not found then return 0; end if;
  select coalesce(nombre, 'Sin asignar') into v_resp from public.perfil where id = t.responsable_id;
  v_resp := coalesce(v_resp, 'Sin asignar');
  v_restante := case when t.fecha_limite is null then null else round(extract(epoch from (t.fecha_limite - now())) / 3600.0, 1) end;
  v_datos := jsonb_build_object(
    'numero', t.numero_radicacion,
    'tipo', coalesce((select nombre from public.caso_tipo where codigo = t.tipo_codigo), t.tipo_codigo),
    'prioridad', t.prioridad, 'estado', t.estado_caso,
    'recibido', to_char(t.recibido_at at time zone 'America/Bogota', 'YYYY-MM-DD HH24:MI'),
    'fecha_limite', coalesce(to_char(t.fecha_limite at time zone 'America/Bogota', 'YYYY-MM-DD HH24:MI'), 'sin plazo'),
    'fecha_limite_corta', coalesce(to_char(t.fecha_limite at time zone 'America/Bogota', 'MM-DD HH24:MI'), 'sin plazo'),
    'plazo_origen', case t.plazo_origen when 'LEGAL_VERIFICADO' then 'plazo legal verificado' when 'LEGAL_PROVISIONAL' then 'plazo legal provisional, no verificado' else 'plazo interno' end,
    'restante_horas', v_restante, 'responsable', v_resp, 'ruta', '/admin/centro-cumplimiento/' || t.id);

  -- CRM: queda visible en el Centro de Cumplimiento (la «entrega» es la fila persistida).
  v_key := 'cumpl:' || p_ticket || ':' || p_regla || ':' || p_ventana || ':CRM';
  insert into public.cumplimiento_notificacion (ticket_id, regla, plantilla, canal, destinatario_tipo, destinatario, datos, estado,
    idempotency_key, id_externo, enviado_at)
  values (p_ticket, p_regla, p_plantilla, 'CRM', 'ALERTA', null, v_datos, 'ENVIADO', v_key, 'crm:' || v_key, now())
  on conflict (idempotency_key) do nothing;
  get diagnostics v_rows = row_count; v_n := v_n + v_rows;

  -- Correo: un registro por destinatario configurado.
  select valor into v_dest from public.cumplimiento_config where clave = 'alertas_email_destinatarios';
  for x in select * from jsonb_array_elements(coalesce(v_dest, '[]'::jsonb)) loop
    insert into public.cumplimiento_notificacion (ticket_id, regla, plantilla, canal, destinatario_tipo, destinatario, datos, proximo_intento_at, idempotency_key)
    values (p_ticket, p_regla, p_plantilla, 'EMAIL', 'ALERTA', lower(x #>> '{}'), v_datos, now(),
            'cumpl:' || p_ticket || ':' || p_regla || ':' || p_ventana || ':EMAIL:' || lower(x #>> '{}'))
    on conflict (idempotency_key) do nothing;
    get diagnostics v_rows = row_count; v_n := v_n + v_rows;
  end loop;

  -- SMS: se registra SIEMPRE. Si no hay proveedor habilitado queda CANAL_NO_HABILITADO (nunca «enviado»).
  select valor #>> '{}' into v_sms_num from public.cumplimiento_config where clave = 'sms_numero';
  v_sms_ok := coalesce((select (valor)::text = 'true' from public.cumplimiento_config where clave = 'sms_habilitado'), false)
          and (select valor from public.cumplimiento_config where clave = 'sms_proveedor') <> 'null'::jsonb;
  if v_sms_num is not null then
    insert into public.cumplimiento_notificacion (ticket_id, regla, plantilla, canal, destinatario_tipo, destinatario, datos, estado,
      proximo_intento_at, ultimo_error, idempotency_key)
    values (p_ticket, p_regla, p_plantilla, 'SMS', 'ALERTA', v_sms_num,
            v_datos || jsonb_build_object('enlace', '/admin/centro-cumplimiento/' || t.id),
            case when v_sms_ok then 'PENDIENTE' else 'CANAL_NO_HABILITADO' end,
            case when v_sms_ok then now() end, case when v_sms_ok then null else 'SMS_DESHABILITADO' end,
            'cumpl:' || p_ticket || ':' || p_regla || ':' || p_ventana || ':SMS')
    on conflict (idempotency_key) do nothing;
    get diagnostics v_rows = row_count; v_n := v_n + v_rows;
  end if;
  return v_n;
end $$;
revoke all on function public.cumplimiento_encolar(uuid, text, text, text) from public, anon, authenticated;

-- Eventos que disparan alerta inmediata.
create or replace function public.trg_caso_historial_alertas() returns trigger
language plpgsql security definer set search_path = public as $$
declare t public.ticket_soporte;
begin
  if new.tipo_evento = 'RADICADO' then
    select * into t from public.ticket_soporte where id = new.ticket_id;
    perform public.cumplimiento_encolar(new.ticket_id, 'RADICADO', case when t.prioridad = 'CRITICA' then 'CASO_CRITICO' else 'CASO_NUEVO' end);
    -- Un caso crítico sin responsable ya lo dice la propia alerta («Responsable: Sin asignar»): no se envía un segundo aviso idéntico.
  elsif new.tipo_evento = 'ESCALADO' then
    perform public.cumplimiento_encolar(new.ticket_id, 'ESCALADO', 'ESCALADO', new.id::text);
  end if;
  return null;
end $$;
revoke all on function public.trg_caso_historial_alertas() from public, anon, authenticated;
drop trigger if exists trg_caso_historial_alertas on public.caso_historial;
create trigger trg_caso_historial_alertas after insert on public.caso_historial for each row execute function public.trg_caso_historial_alertas();

-- ── Motor de SLA ───────────────────────────────────────────────────────────
-- Idempotente: cada alerta lleva una clave (ticket, regla, ventana); correr el motor mil veces no repite nada.
create or replace function public.cumplimiento_evaluar_sla()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t public.ticket_soporte; cfg jsonb; p numeric; h numeric; v_total numeric; v_gast numeric; v_rest numeric; v_nueva text;
  c_prior integer := 0; c_alertas integer := 0; c_desist integer := 0; c_escal integer := 0; v_meses integer; v_ult timestamptz;
begin
  if not (coalesce(auth.role(), '') = 'service_role' or coalesce(public.is_supersu(), false)
          or coalesce(current_setting('request.jwt.claims', true), '') = '') then
    raise exception 'NO_AUTORIZADO';
  end if;
  select valor into cfg from public.cumplimiento_config where clave = 'sla_reglas';
  cfg := coalesce(cfg, '{}'::jsonb);

  for t in select * from public.ticket_soporte
            where estado_caso not in ('RESUELTO', 'CERRADO', 'DESISTIDO', 'TRASLADADO') order by fecha_limite nulls last loop
    -- Desistimiento: reclamo incompleto sin respuesta en el término (art. 15: 2 meses).
    if t.estado_caso = 'ESPERANDO_SOLICITANTE' and t.subsanacion_requerida_at is not null then
      select coalesce(r.desistimiento_meses, 2) into v_meses from public.caso_plazo_regla r where r.id = t.regla_id;
      if t.subsanacion_requerida_at + make_interval(months => coalesce(v_meses, 2)) < now() then
        perform public._caso_mover(t.id, 'DESISTIDO', null, 'SISTEMA', jsonb_build_object('motivo', 'sin_subsanacion_en_termino'), true);
        perform public._caso_log(t.id, 'DESISTIMIENTO', 'ESPERANDO_SOLICITANTE', 'DESISTIDO', null, 'SISTEMA', jsonb_build_object('meses', coalesce(v_meses, 2)), true);
        c_desist := c_desist + 1;
      end if;
      continue;   -- con el solicitante pendiente el reloj de respuesta no corre
    end if;

    -- Prioridad: solo sube.
    v_nueva := public._caso_prioridad_calculada(t);
    if v_nueva is distinct from t.prioridad then
      update public.ticket_soporte set prioridad = v_nueva where id = t.id;
      perform public._caso_log(t.id, 'PRIORIDAD', null, null, null, 'SISTEMA', jsonb_build_object('de', t.prioridad, 'a', v_nueva), false);
      t.prioridad := v_nueva; c_prior := c_prior + 1;
    end if;

    if t.fecha_limite is not null then
      v_total := extract(epoch from (t.fecha_limite - coalesce(t.recibido_at, t.created_at)));
      v_gast := extract(epoch from (now() - coalesce(t.recibido_at, t.created_at)));
      v_rest := extract(epoch from (t.fecha_limite - now())) / 3600.0;
      if v_rest <= 0 then
        c_alertas := c_alertas + public.cumplimiento_encolar(t.id, 'VENCIDO', 'VENCIDO', 'unica');
        -- recordatorio periódico mientras siga vencido
        c_alertas := c_alertas + public.cumplimiento_encolar(t.id, 'VENCIDO_REPETIDO', 'VENCIDO',
          floor(extract(epoch from now()) / (3600 * coalesce((cfg ->> 'repetir_vencido_horas')::numeric, 24)))::text);
        if t.escalado_at is null then
          update public.ticket_soporte set escalado_at = now() where id = t.id;
          if public._caso_transicion_valida(t.estado_caso, 'ESCALADO') then
            perform public._caso_mover(t.id, 'ESCALADO', null, 'SISTEMA', jsonb_build_object('motivo', 'plazo_vencido'), false);
          end if;
          perform public._caso_log(t.id, 'ESCALADO', null, 'ESCALADO', null, 'SISTEMA', jsonb_build_object('motivo', 'plazo_vencido', 'automatico', true), false);
          c_escal := c_escal + 1;
        end if;
      else
        for p in select (e)::numeric from jsonb_array_elements_text(coalesce(cfg -> 'porcentajes', '[]'::jsonb)) e loop
          if v_total > 0 and v_gast / v_total * 100 >= p then
            c_alertas := c_alertas + public.cumplimiento_encolar(t.id, 'SLA_' || p::int, 'SLA_AVANCE', 'unica');
          end if;
        end loop;
        for h in select (e)::numeric from jsonb_array_elements_text(coalesce(cfg -> 'horas_antes', '[]'::jsonb)) e loop
          -- Solo si el plazo total es mayor que la ventana (una alerta «24 h antes» no tiene sentido en un plazo de 24 h).
          if v_rest <= h and v_total / 3600.0 > h then
            c_alertas := c_alertas + public.cumplimiento_encolar(t.id, 'T_MENOS_' || h::int || 'H', 'SLA_HORAS', 'unica');
          end if;
        end loop;
      end if;
    end if;

    if t.responsable_id is null and now() - t.recibido_at >= make_interval(mins => coalesce((cfg ->> 'sin_asignar_minutos')::int, 60)) then
      c_alertas := c_alertas + public.cumplimiento_encolar(t.id, 'SIN_ASIGNAR', 'SIN_ASIGNAR', to_char(now() at time zone 'America/Bogota', 'YYYY-MM-DD'));
    end if;

    select max(created_at) into v_ult from public.caso_historial where ticket_id = t.id and tipo_evento <> 'ALERTA';
    if v_ult is not null and now() - v_ult >= make_interval(days => coalesce((cfg ->> 'sin_movimiento_dias')::int, 5)) then
      c_alertas := c_alertas + public.cumplimiento_encolar(t.id, 'SIN_MOVIMIENTO', 'SIN_MOVIMIENTO', to_char(now() at time zone 'America/Bogota', 'IYYY-IW'));
    end if;
  end loop;
  return jsonb_build_object('prioridades_subidas', c_prior, 'alertas_creadas', c_alertas, 'desistidos', c_desist, 'escalados', c_escal);
end $$;
revoke all on function public.cumplimiento_evaluar_sla() from public, anon, authenticated;
grant execute on function public.cumplimiento_evaluar_sla() to authenticated, service_role;

-- ── Worker: tomar lote y marcar resultado (solo service_role) ──────────────
create or replace function public.cumplimiento_tomar_lote(p_limite integer default 25)
returns setof public.cumplimiento_notificacion language plpgsql security definer set search_path = public as $$
begin
  return query
  with c as (
    select id from public.cumplimiento_notificacion
     where canal in ('EMAIL', 'SMS')
       and ((estado in ('PENDIENTE', 'REINTENTANDO') and coalesce(proximo_intento_at, now()) <= now())
         or (estado = 'PROCESANDO' and proximo_intento_at < now()))   -- lease vencido: otro worker murió
     order by created_at limit least(greatest(p_limite, 1), 100) for update skip locked)
  update public.cumplimiento_notificacion n set estado = 'PROCESANDO', intentos = n.intentos + 1,
         proximo_intento_at = now() + interval '5 minutes', updated_at = now()
    from c where n.id = c.id returning n.*;
end $$;
revoke all on function public.cumplimiento_tomar_lote(integer) from public, anon, authenticated;
grant execute on function public.cumplimiento_tomar_lote(integer) to service_role;

create or replace function public.cumplimiento_marcar(p_id uuid, p_resultado text, p_id_externo text default null, p_error text default null)
returns text language plpgsql security definer set search_path = public as $$
declare n public.cumplimiento_notificacion; v_estado text;
begin
  select * into n from public.cumplimiento_notificacion where id = p_id for update;
  if not found then raise exception 'NOTIFICACION_NO_ENCONTRADA'; end if;
  if n.estado <> 'PROCESANDO' then return n.estado; end if;   -- ya resuelta por otro proceso
  if p_resultado = 'ENVIADO' then
    if p_id_externo is null or length(btrim(p_id_externo)) = 0 then raise exception 'ENVIADO_SIN_EVIDENCIA'; end if;
    v_estado := 'ENVIADO';
  elsif p_resultado = 'CANAL_NO_HABILITADO' then v_estado := 'CANAL_NO_HABILITADO';
  elsif p_resultado = 'REINTENTABLE' then v_estado := case when n.intentos >= n.max_intentos then 'FALLIDO' else 'REINTENTANDO' end;
  else v_estado := 'FALLIDO'; end if;
  update public.cumplimiento_notificacion set estado = v_estado, id_externo = case when v_estado = 'ENVIADO' then p_id_externo end,
    enviado_at = case when v_estado = 'ENVIADO' then now() end, ultimo_error = left(p_error, 200), updated_at = now(),
    proximo_intento_at = case when v_estado = 'REINTENTANDO' then now() + make_interval(mins => least(power(3, n.intentos)::int, 240)) end
   where id = p_id;
  return v_estado;
end $$;
revoke all on function public.cumplimiento_marcar(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.cumplimiento_marcar(uuid, text, text, text) to service_role;

-- Registro de un envío hecho fuera de la cola (acuse al solicitante: su enlace lleva un token que no debe guardarse).
create or replace function public.caso_registrar_envio(p_ticket uuid, p_plantilla text, p_destinatario text, p_resultado text, p_id_externo text, p_error text)
returns void language plpgsql security definer set search_path = public as $$
declare v_estado text := case when p_resultado = 'ENVIADO' then 'ENVIADO' when p_resultado = 'CANAL_NO_HABILITADO' then 'CANAL_NO_HABILITADO' else 'FALLIDO' end;
begin
  if v_estado = 'ENVIADO' and (p_id_externo is null or btrim(p_id_externo) = '') then raise exception 'ENVIADO_SIN_EVIDENCIA'; end if;
  insert into public.cumplimiento_notificacion (ticket_id, regla, plantilla, canal, destinatario_tipo, destinatario, datos, estado, intentos,
    id_externo, enviado_at, ultimo_error, idempotency_key)
  values (p_ticket, 'ACUSE_SOLICITANTE', p_plantilla, 'EMAIL', 'SOLICITANTE', lower(p_destinatario), '{}'::jsonb, v_estado, 1,
    p_id_externo, case when v_estado = 'ENVIADO' then now() end, left(p_error, 200), 'cumpl:' || p_ticket || ':' || p_plantilla || ':' || gen_random_uuid());
  perform public._caso_log(p_ticket, 'ENVIO', null, null, null, 'SISTEMA', jsonb_build_object('plantilla', p_plantilla, 'estado', v_estado, 'id_externo', p_id_externo), false);
end $$;
revoke all on function public.caso_registrar_envio(uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.caso_registrar_envio(uuid, text, text, text, text, text) to service_role;

-- Marca una alerta CRM como leída (SuperSU).
create or replace function public.cumplimiento_marcar_leidas(p_ids uuid[] default null)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  perform public._caso_exigir_supersu();
  update public.cumplimiento_notificacion set leida_at = now() where canal = 'CRM' and leida_at is null and (p_ids is null or id = any(p_ids));
  get diagnostics n = row_count; return n;
end $$;
revoke all on function public.cumplimiento_marcar_leidas(uuid[]) from public, anon, authenticated;
grant execute on function public.cumplimiento_marcar_leidas(uuid[]) to authenticated;
