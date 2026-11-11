-- 091: Centro de privacidad (C14). Consentimientos por proposito, APPEND-ONLY.
-- Sin concesiones por defecto: ausencia de evento = NO otorgado. Retiro = nuevo evento.
create table public.consentimiento_evento (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfil(id) on delete cascade,
  proposito text not null check (proposito in
    ('analitica','personalizacion','ofertas_cercanas','beneficios_marcas','marketing_email')),
  otorgado boolean not null,
  origen text not null check (origen in ('registro','centro_privacidad','ofertas','sistema')),
  created_at timestamptz not null default now()
);
create index consentimiento_evento_usuario_idx
  on public.consentimiento_evento (usuario_id, proposito, created_at desc);

alter table public.consentimiento_evento enable row level security;
revoke all on public.consentimiento_evento from public, anon, authenticated;
grant select on public.consentimiento_evento to authenticated;
create policy consentimiento_select_propio on public.consentimiento_evento
  for select to authenticated using (usuario_id = auth.uid());

create or replace function public.consentimiento_inmutable()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'CONSENTIMIENTO_INMUTABLE';
  end if;
  -- el borrado solo se permite en cascada (depth>1) al purgar el perfil
  if pg_trigger_depth() <= 1 then
    raise exception 'CONSENTIMIENTO_INMUTABLE';
  end if;
  return old;
end $$;
revoke all on function public.consentimiento_inmutable() from public, anon, authenticated;
create trigger consentimiento_inmutable_trg
  before update or delete on public.consentimiento_evento
  for each row execute function public.consentimiento_inmutable();

-- Estado vigente por proposito (ultimo evento). Interno.
create or replace function public._consentimiento_vigente(p_usuario uuid, p_proposito text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select c.otorgado from public.consentimiento_evento c
    where c.usuario_id = p_usuario and c.proposito = p_proposito
    order by c.created_at desc, c.id desc limit 1), false);
$$;
revoke all on function public._consentimiento_vigente(uuid, text) from public, anon, authenticated;
grant execute on function public._consentimiento_vigente(uuid, text) to service_role;

-- Registra un evento solo si cambia el estado vigente (o si no habia ninguno).
create or replace function public._consentimiento_registrar(
  p_usuario uuid, p_proposito text, p_otorgado boolean, p_origen text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_hay boolean; v_actual boolean;
begin
  select exists (select 1 from public.consentimiento_evento
                 where usuario_id = p_usuario and proposito = p_proposito) into v_hay;
  v_actual := public._consentimiento_vigente(p_usuario, p_proposito);
  if v_hay and v_actual = p_otorgado then
    return false;
  end if;
  insert into public.consentimiento_evento (usuario_id, proposito, otorgado, origen)
  values (p_usuario, p_proposito, p_otorgado, p_origen);
  if p_proposito = 'marketing_email' then
    update public.perfil set consentimiento_marketing = p_otorgado where id = p_usuario;
  end if;
  return true;
end $$;
revoke all on function public._consentimiento_registrar(uuid, text, boolean, text) from public, anon, authenticated;
grant execute on function public._consentimiento_registrar(uuid, text, boolean, text) to service_role;

create or replace function public.privacidad_estado()
returns table (proposito text, otorgado boolean, desde timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  return query
  select p.p, public._consentimiento_vigente(auth.uid(), p.p),
         (select max(c.created_at) from public.consentimiento_evento c
           where c.usuario_id = auth.uid() and c.proposito = p.p)
  from (values ('analitica'),('personalizacion'),('ofertas_cercanas'),
               ('beneficios_marcas'),('marketing_email')) as p(p);
end $$;
revoke all on function public.privacidad_estado() from public, anon, authenticated;
grant execute on function public.privacidad_estado() to authenticated;

-- p_preferencias: {"analitica":true,"personalizacion":false,...}; solo propositos validos.
create or replace function public.privacidad_guardar(p_preferencias jsonb)
returns table (proposito text, otorgado boolean, desde timestamptz)
language plpgsql security definer set search_path = public as $$
declare k text; v jsonb;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if p_preferencias is null or jsonb_typeof(p_preferencias) <> 'object' then
    raise exception 'PREFERENCIAS_INVALIDAS';
  end if;
  for k, v in select * from jsonb_each(p_preferencias) loop
    if k not in ('analitica','personalizacion','ofertas_cercanas','beneficios_marcas','marketing_email') then
      raise exception 'PROPOSITO_INVALIDO';
    end if;
    if jsonb_typeof(v) <> 'boolean' then raise exception 'PREFERENCIAS_INVALIDAS'; end if;
  end loop;
  for k, v in select * from jsonb_each(p_preferencias) loop
    perform public._consentimiento_registrar(auth.uid(), k, (v)::text::boolean, 'centro_privacidad');
  end loop;
  return query select * from public.privacidad_estado();
end $$;
revoke all on function public.privacidad_guardar(jsonb) from public, anon, authenticated;
grant execute on function public.privacidad_guardar(jsonb) to authenticated;

create or replace function public.privacidad_historial(p_limite integer default 50)
returns table (fecha timestamptz, tipo text, proposito text, valor text)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  return query
  select h.fecha, h.tipo, h.proposito, h.valor from (
    select c.created_at as fecha, 'CONSENTIMIENTO'::text as tipo, c.proposito,
           case when c.otorgado then 'ACEPTADO'
                when exists (select 1 from public.consentimiento_evento p
                             where p.usuario_id = c.usuario_id and p.proposito = c.proposito
                               and p.otorgado and p.created_at < c.created_at) then 'RETIRADO'
                else 'RECHAZADO' end as valor
    from public.consentimiento_evento c where c.usuario_id = auth.uid()
    union all
    select a.aceptado_at, 'LEGAL', t.tipo || ' v' || t.version, 'ACEPTADO'
    from public.aceptacion_legal a join public.texto_legal t on t.id = a.texto_legal_id
    where a.usuario_id = auth.uid()
  ) h order by h.fecha desc limit greatest(coalesce(p_limite, 50), 1);
end $$;
revoke all on function public.privacidad_historial(integer) from public, anon, authenticated;
grant execute on function public.privacidad_historial(integer) to authenticated;
