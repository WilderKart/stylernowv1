-- Prueba SQL de la migración 202 (catálogo de servicios, servicio por sede, sin borrado físico).
--   docker exec -i supabase_db_stylernow psql -U postgres -v ON_ERROR_STOP=1 < tests/sql/servicios_catalogo_sedes.sql
-- Todo ocurre en una transacción que se revierte al final.
begin;

insert into auth.users (id, email, aud, role) values
  ('a1000001-0000-4000-8000-000000000001', 'c_dueno@t.l', 'authenticated', 'authenticated'),
  ('a1000001-0000-4000-8000-000000000002', 'c_barbero@t.l', 'authenticated', 'authenticated'),
  ('a1000001-0000-4000-8000-000000000003', 'c_guardian@t.l', 'authenticated', 'authenticated'),
  ('a1000001-0000-4000-8000-000000000004', 'c_otro@t.l', 'authenticated', 'authenticated');
insert into public.perfil (id, nombre) values
  ('a1000001-0000-4000-8000-000000000001', 'Dueño'), ('a1000001-0000-4000-8000-000000000002', 'Barbero'),
  ('a1000001-0000-4000-8000-000000000003', 'Guardián'), ('a1000001-0000-4000-8000-000000000004', 'Otro')
on conflict (id) do update set nombre = excluded.nombre;
insert into public.staff (usuario_id, nombre) values
  ('a1000001-0000-4000-8000-000000000002', 'Barbero'), ('a1000001-0000-4000-8000-000000000003', 'Guardián')
on conflict (usuario_id) do nothing;
insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo, plan_codigo, estado) values
  ('b1000001-0000-4000-8000-00000000000a', 'a1000001-0000-4000-8000-000000000001', 'Neg Cat', 'cat-neg-test', 'Cali', 'CO', 'PRESTIGE', 'ACTIVO'),
  ('b1000001-0000-4000-8000-00000000000b', 'a1000001-0000-4000-8000-000000000004', 'Neg Otro', 'cat-otro-test', 'Cali', 'CO', 'PRESTIGE', 'ACTIVO');
insert into public.suscripcion (negocio_id, plan_codigo, estado, fecha_proximo_cobro, pais_codigo) values
  ('b1000001-0000-4000-8000-00000000000a', 'PRESTIGE', 'ACTIVA', now() + interval '30 days', 'CO'),
  ('b1000001-0000-4000-8000-00000000000b', 'PRESTIGE', 'ACTIVA', now() + interval '30 days', 'CO')
on conflict (negocio_id) do update set plan_codigo = excluded.plan_codigo, estado = 'ACTIVA';
delete from public.sede where negocio_id in ('b1000001-0000-4000-8000-00000000000a', 'b1000001-0000-4000-8000-00000000000b');
insert into public.sede (id, negocio_id, nombre, direccion, ciudad, horario_base, es_principal) values
  ('c1000001-0000-4000-8000-000000000001', 'b1000001-0000-4000-8000-00000000000a', 'Sede 1', 'Calle 1', 'Cali', '{}'::jsonb, true),
  ('c1000001-0000-4000-8000-000000000002', 'b1000001-0000-4000-8000-00000000000a', 'Sede 2', 'Calle 2', 'Cali', '{}'::jsonb, false),
  ('c1000001-0000-4000-8000-000000000003', 'b1000001-0000-4000-8000-00000000000b', 'Sede B', 'Calle 3', 'Cali', '{}'::jsonb, true);
insert into public.vinculo_staff_negocio (staff_id, negocio_id, sede_activa_id, estado, es_guardian, presta_servicios) values
  ('a1000001-0000-4000-8000-000000000002', 'b1000001-0000-4000-8000-00000000000a', 'c1000001-0000-4000-8000-000000000001', 'ACTIVO', false, true),
  ('a1000001-0000-4000-8000-000000000003', 'b1000001-0000-4000-8000-00000000000a', 'c1000001-0000-4000-8000-000000000001', 'ACTIVO', true, true);

select set_config('request.jwt.claims', '{"sub":"a1000001-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare
  v_neg constant uuid := 'b1000001-0000-4000-8000-00000000000a';
  s1 constant uuid := 'c1000001-0000-4000-8000-000000000001';
  s2 constant uuid := 'c1000001-0000-4000-8000-000000000002';
  v_id uuid; v_id2 uuid; v_n int;
begin
  v_id := public.servicio_crear_desde_catalogo(v_neg, 'cortes/fade', 'Fade', '/servicios/cortes/skin-fade.webp', 'ESTANDAR', 30, 25000, null,
            array[s1], array['a1000001-0000-4000-8000-000000000002']::uuid[]);
  if (select imagen_url from public.servicio where id = v_id) <> '/servicios/cortes/skin-fade.webp' then raise exception 'FALLA: imagen del catálogo'; end if;
  if (select count(*) from public.servicio_sede where servicio_id = v_id and sede_id = s2 and not activo) <> 1 then raise exception 'FALLA: la sede no elegida debía quedar sin el servicio'; end if;
  if (select count(*) from public.servicio_sede where servicio_id = v_id and sede_id = s1) <> 0 then raise exception 'FALLA: la sede elegida no debe tener excepción'; end if;
  if (select count(*) from public.staff_servicio where servicio_id = v_id) <> 1 then raise exception 'FALLA: no asignó al profesional'; end if;

  -- Validaciones
  begin perform public.servicio_crear_desde_catalogo(v_neg, 'cortes/fade', 'Fade', '/servicios/cortes/skin-fade.webp', 'ESTANDAR', 30, 25000, null, array[s1], null); raise exception 'FALLA: duplicó el servicio';
  exception when others then if sqlerrm not like '%SERVICIO_YA_AGREGADO%' then raise; end if; end;
  begin perform public.servicio_crear_desde_catalogo(v_neg, 'cortes/x', 'Otro', 'https://malo.com/a.webp', 'ESTANDAR', 30, 1, null, array[s1], null); raise exception 'FALLA: aceptó una imagen externa';
  exception when others then if sqlerrm not like '%IMAGEN_INVALIDA%' then raise; end if; end;
  begin perform public.servicio_crear_desde_catalogo(v_neg, 'cortes/x', 'Otro', '/servicios/cortes/../../etc.webp', 'ESTANDAR', 30, 1, null, array[s1], null); raise exception 'FALLA: aceptó path traversal';
  exception when others then if sqlerrm not like '%IMAGEN_INVALIDA%' then raise; end if; end;
  begin perform public.servicio_crear_desde_catalogo(v_neg, 'cortes/y', 'Y1', '/servicios/cortes/a.webp', 'ESTANDAR', 30, 1, null, array[]::uuid[], null); raise exception 'FALLA: aceptó cero sedes';
  exception when others then if sqlerrm not like '%ELIGE_AL_MENOS_UNA_SEDE%' then raise; end if; end;
  begin perform public.servicio_crear_desde_catalogo(v_neg, 'cortes/z', 'Z1', '/servicios/cortes/a.webp', 'ESTANDAR', 30, 1, null, array['c1000001-0000-4000-8000-000000000003']::uuid[], null); raise exception 'FALLA: aceptó una sede ajena';
  exception when others then if sqlerrm not like '%SEDE_INVALIDA%' then raise; end if; end;
  begin perform public.servicio_crear_desde_catalogo(v_neg, 'cortes/w', 'W1', '/servicios/cortes/a.webp', 'ESTANDAR', 3, 1, null, array[s1], null); raise exception 'FALLA: aceptó duración 3';
  exception when others then if sqlerrm not like '%DURACION_INVALIDA%' then raise; end if; end;

  -- Sin borrado físico
  begin delete from public.servicio where id = v_id; raise exception 'FALLA: el dueño pudo borrar un servicio';
  exception when insufficient_privilege then null; end;

  -- Desactivar y volver a agregar = reactivar el MISMO servicio
  update public.servicio set estado = 'INACTIVO' where id = v_id;
  v_id2 := public.servicio_crear_desde_catalogo(v_neg, 'cortes/fade', 'Fade', '/servicios/cortes/skin-fade.webp', 'ESTANDAR', 40, 30000, null, array[s1, s2], null);
  if v_id2 <> v_id then raise exception 'FALLA: duplicó en vez de reactivar'; end if;
  if (select precio_base from public.servicio where id = v_id) <> 30000 then raise exception 'FALLA: no actualizó el precio al reactivar'; end if;
  if (select count(*) from public.servicio_sede where servicio_id = v_id) <> 0 then raise exception 'FALLA: al reactivar con ambas sedes no debe haber excepciones'; end if;

  -- Activar/desactivar por sede
  perform public.servicio_sede_definir(v_id, s2, false);
  if (select count(*) from public.servicio_sede where servicio_id = v_id and sede_id = s2 and not activo) <> 1 then raise exception 'FALLA: desactivar en sede'; end if;
  perform public.servicio_sede_definir(v_id, s2, true);
  if (select count(*) from public.servicio_sede where servicio_id = v_id) <> 0 then raise exception 'FALLA: activar en sede debe quitar la excepción'; end if;
  -- Sin escritura directa a la tabla de excepciones
  begin insert into public.servicio_sede (servicio_id, sede_id, activo) values (v_id, s2, false); raise exception 'FALLA: escritura directa en servicio_sede';
  exception when insufficient_privilege then null; end;
end $$;

-- El motor de reservas respeta la sede: con excepción no hay horarios; el servicio sigue existiendo en las demás.
reset role;
do $$
declare v_id uuid; n_con int; n_sin int;
begin
  select id into v_id from public.servicio where negocio_id = 'b1000001-0000-4000-8000-00000000000a' and catalogo_ref = 'cortes/fade';
  insert into public.servicio_sede (servicio_id, sede_id, activo) values (v_id, 'c1000001-0000-4000-8000-000000000002', false);
  select count(*) into n_con from public.slots_disponibles('c1000001-0000-4000-8000-000000000002', array[v_id], (current_date + 2), null);
  if n_con <> 0 then raise exception 'FALLA: la sede con el servicio desactivado devolvió horarios (%)', n_con; end if;
  perform 1 from public.slots_disponibles('c1000001-0000-4000-8000-000000000001', array[v_id], (current_date + 2), null);   -- no debe fallar
end $$;

-- Permisos por sede y por negocio ajeno
select set_config('request.jwt.claims', '{"sub":"a1000001-0000-4000-8000-000000000003","role":"authenticated"}', true);   -- guardián de la sede 1
set local role authenticated;
do $$
declare v_id uuid;
begin
  select id into v_id from public.servicio where negocio_id = 'b1000001-0000-4000-8000-00000000000a' and catalogo_ref = 'cortes/fade';
  perform public.servicio_sede_definir(v_id, 'c1000001-0000-4000-8000-000000000001', false);   -- su sede: permitido
  begin perform public.servicio_sede_definir(v_id, 'c1000001-0000-4000-8000-000000000002', true); raise exception 'FALLA: el guardián tocó otra sede';
  exception when others then if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if; end;
  begin perform public.servicio_crear_desde_catalogo('b1000001-0000-4000-8000-00000000000a', 'cortes/q', 'Q1', '/servicios/cortes/a.webp', 'ESTANDAR', 30, 1, null, array['c1000001-0000-4000-8000-000000000001']::uuid[], null);
    raise exception 'FALLA: el guardián creó desde el catálogo';
  exception when others then if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if; end;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"a1000001-0000-4000-8000-000000000004","role":"authenticated"}', true);   -- dueño de OTRO negocio
set local role authenticated;
do $$
declare v_id uuid;
begin
  select id into v_id from public.servicio where negocio_id = 'b1000001-0000-4000-8000-00000000000a' and catalogo_ref = 'cortes/fade';
  begin perform public.servicio_sede_definir(v_id, 'c1000001-0000-4000-8000-000000000001', true); raise exception 'FALLA: otro negocio cambió la sede ajena';
  exception when others then if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if; end;
  begin perform public.servicio_crear_desde_catalogo('b1000001-0000-4000-8000-00000000000a', 'cortes/q2', 'Q2', '/servicios/cortes/a.webp', 'ESTANDAR', 30, 1, null, array['c1000001-0000-4000-8000-000000000001']::uuid[], null);
    raise exception 'FALLA: otro negocio creó servicios en el ajeno';
  exception when others then if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if; end;
end $$;

rollback;
select 'OK servicios_catalogo_sedes' as resultado;
