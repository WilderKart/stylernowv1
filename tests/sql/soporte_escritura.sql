-- Prueba de la migración 197. Ejecutar contra la base local:
--   docker exec -i supabase_db_stylernow psql -U postgres -v ON_ERROR_STOP=1 < tests/sql/soporte_escritura.sql
begin;
insert into auth.users (id, email, aud, role) values
  ('e1111111-1111-4111-8111-111111111111', 'esc_studio@t.l', 'authenticated', 'authenticated'),
  ('e2222222-2222-4222-8222-222222222222', 'esc_essential@t.l', 'authenticated', 'authenticated'),
  ('e3333333-3333-4333-8333-333333333333', 'esc_otro@t.l', 'authenticated', 'authenticated');
insert into public.perfil (id, nombre, es_supersu) values
  ('e1111111-1111-4111-8111-111111111111', 'Studio', false),
  ('e2222222-2222-4222-8222-222222222222', 'Essential', false),
  ('e3333333-3333-4333-8333-333333333333', 'Otro', false)
on conflict (id) do update set es_supersu = false;
insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo, plan_codigo) values
  ('eeeeeee1-1111-4111-8111-111111111111', 'e1111111-1111-4111-8111-111111111111', 'Esc Studio', 'esc-studio-test', 'Cali', 'CO', 'STUDIO'),
  ('eeeeeee2-2222-4222-8222-222222222222', 'e2222222-2222-4222-8222-222222222222', 'Esc Essential', 'esc-essential-test', 'Cali', 'CO', 'ESSENTIAL'),
  ('eeeeeee3-3333-4333-8333-333333333333', 'e3333333-3333-4333-8333-333333333333', 'Esc Otro', 'esc-otro-test', 'Cali', 'CO', 'PRESTIGE');
insert into public.suscripcion (negocio_id, plan_codigo, estado, fecha_proximo_cobro, pais_codigo) values
  ('eeeeeee1-1111-4111-8111-111111111111', 'STUDIO', 'ACTIVA', now() + interval '30 days', 'CO'),
  ('eeeeeee2-2222-4222-8222-222222222222', 'ESSENTIAL', 'ACTIVA', now() + interval '30 days', 'CO'),
  ('eeeeeee3-3333-4333-8333-333333333333', 'PRESTIGE', 'ACTIVA', now() + interval '30 days', 'CO')
on conflict (negocio_id) do update set plan_codigo = excluded.plan_codigo, estado = 'ACTIVA';
select set_config('t.super', coalesce((select id::text from public.perfil where es_supersu limit 1), ''), true);

do $$
declare
  v_ok boolean;
  v_super uuid := nullif(current_setting('t.super', true), '')::uuid;
  t1 constant text := 'soporte-escritura:eeeeeee1-1111-4111-8111-111111111111';
  t2 constant text := 'soporte-escritura:eeeeeee2-2222-4222-8222-222222222222';
  t3 constant text := 'soporte-escritura:eeeeeee3-3333-4333-8333-333333333333';
begin
  if v_super is null then raise exception 'La base local no tiene un SuperSU para la prueba'; end if;

  -- Dueño Studio: su canal sí; el de otro negocio no; Essential (sin chat) no.
  perform set_config('request.jwt.claims', json_build_object('sub', 'e1111111-1111-4111-8111-111111111111', 'role', 'authenticated')::text, true);
  set local role authenticated;
  if not public.soporte_puede_canal(t1) then raise exception 'FALLO: el dueño Studio debe poder usar su canal'; end if;
  if public.soporte_puede_canal(t3) then raise exception 'FALLO: el dueño no debe entrar al canal de otro negocio'; end if;
  if public.soporte_puede_canal('soporte-escritura:no-es-uuid') then raise exception 'FALLO: tema mal formado'; end if;
  if public.soporte_puede_canal('otro-tema:eeeeeee1-1111-4111-8111-111111111111') then raise exception 'FALLO: prefijo ajeno'; end if;
  if public.soporte_puede_canal(null) then raise exception 'FALLO: tema nulo'; end if;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', 'e2222222-2222-4222-8222-222222222222', 'role', 'authenticated')::text, true);
  set local role authenticated;
  if public.soporte_puede_canal(t2) then raise exception 'FALLO: Essential no incluye chat'; end if;
  reset role;

  -- SuperSU: cualquier canal de negocio.
  perform set_config('request.jwt.claims', json_build_object('sub', v_super::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if not (public.soporte_puede_canal(t1) and public.soporte_puede_canal(t3)) then raise exception 'FALLO: SuperSU debe poder usar cualquier canal'; end if;
  reset role;

  -- Sin sesión (anon): nada. Y anon no puede ni ejecutar la función.
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
  begin
    v_ok := public.soporte_puede_canal(t1);
    raise exception 'FALLO: anon pudo ejecutar soporte_puede_canal';
  exception when insufficient_privilege then null;
  end;
  reset role;

  raise notice 'OK soporte escritura en vivo';
end $$;
rollback;
