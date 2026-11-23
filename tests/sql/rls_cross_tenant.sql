-- Fase 1 (T1) — Blindaje cross-tenant (migración 179).
--   docker exec -i supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < tests/sql/rls_cross_tenant.sql
-- Base LOCAL únicamente. Transacción con ROLLBACK.
-- Verifica: (a) un dueño NO puede mover un servicio a otro negocio; (b) el resto de la fila
-- sigue editable; (c) el disparador genérico cubre todas las tablas con negocio_id y policy
-- de UPDATE/ALL alcanzable por anon/authenticated.

begin;

-- En Supabase real, anon/authenticated tienen GRANT a nivel tabla en `public`; el control
-- es RLS. La base local del reset no siempre los trae, así que se otorgan aquí como en prod.
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'duenoA@t.l', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a5', 'duenoB@t.l', 'authenticated', 'authenticated');
insert into public.perfil (id, nombre) values
  ('00000000-0000-0000-0000-0000000000a1', 'A'),
  ('00000000-0000-0000-0000-0000000000a5', 'B')
on conflict (id) do nothing;
insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'A', 'ct-a', 'Cali', 'CO'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a5', 'B', 'ct-b', 'Cali', 'CO');
insert into public.sede (id, negocio_id, nombre, direccion, ciudad) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', 'S', 'D', 'Cali');
insert into public.servicio (id, negocio_id, nombre, duracion_minutos, precio_base) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000b1', 'Corte', 30, 30000);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

-- ── Ataque: el dueño A intenta mover su servicio al negocio B ───────────────
do $$
begin
  begin
    update public.servicio set negocio_id = '00000000-0000-0000-0000-0000000000b2'
     where id = '00000000-0000-0000-0000-0000000000e1';
    raise exception 'FALLA CR-1: dueño A pudo mover el servicio al negocio B';
  exception when others then
    if sqlerrm not like '%TENANT_NO_PERMITIDO%' and sqlerrm not like '%row-level security%' then
      raise exception 'FALLA CR-1: excepción inesperada: %', sqlerrm;
    end if;
  end;
  raise notice 'OK: reasignación de servicio a otro tenant bloqueada (%)', 'TENANT_NO_PERMITIDO';
end $$;

-- ── Ataque: mover la sede a otro negocio (cubierto por 125 + disparador 179) ─
do $$
begin
  begin
    update public.sede set negocio_id = '00000000-0000-0000-0000-0000000000b2'
     where id = '00000000-0000-0000-0000-0000000000c1';
    raise exception 'FALLA: dueño A pudo mover la sede al negocio B';
  exception when others then
    if sqlerrm not like '%TENANT_NO_PERMITIDO%' and sqlerrm not like '%row-level security%' then
      raise exception 'FALLA: excepción inesperada: %', sqlerrm;
    end if;
  end;
end $$;

-- ── Legítimo: el dueño A sigue editando el nombre de su servicio ────────────
do $$
begin
  update public.servicio set nombre = 'Corte + barba'
   where id = '00000000-0000-0000-0000-0000000000e1';
  if (select nombre from public.servicio where id = '00000000-0000-0000-0000-0000000000e1') <> 'Corte + barba' then
    raise exception 'FALLA: el dueño no pudo editar su propio servicio';
  end if;
  raise notice 'OK: el dueño sigue editando campos legítimos de su servicio';
end $$;

reset role;

-- ── Escaneo: el disparador existe en toda tabla con negocio_id + policy UPDATE/ALL ──
do $$
declare
  faltantes text;
begin
  select string_agg(t.tabla, ', ') into faltantes
    from (
      select distinct c.relname as tabla
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        join pg_attribute a on a.attrelid = c.oid and a.attname = 'negocio_id'
                           and a.attnum > 0 and not a.attisdropped
       where n.nspname = 'public' and c.relkind = 'r'
         and exists (
           select 1 from pg_policies p
            where p.schemaname = 'public' and p.tablename = c.relname
              and p.cmd in ('UPDATE', 'ALL')
              and ('anon' = any(p.roles) or 'authenticated' = any(p.roles) or 'public' = any(p.roles))
         )
    ) t
   where not exists (
     select 1 from pg_trigger tr
      where tr.tgrelid = format('public.%I', t.tabla)::regclass
        and tr.tgname = 'trg_negocio_id_inmutable' and not tr.tgisinternal
   );
  if faltantes is not null then
    raise exception 'FALLA: tablas con negocio_id sin disparador anti-reasignación: %', faltantes;
  end if;
  raise notice 'OK: todas las tablas con negocio_id y policy UPDATE/ALL tienen el disparador';
end $$;

do $$ begin raise notice 'TODAS LAS PRUEBAS DE CROSS-TENANT PASARON'; end $$;
rollback;
