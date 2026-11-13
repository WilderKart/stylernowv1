-- Pruebas de la migración 128 (celular en el registro y cierre del atajo por país).
--   docker exec -i supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < tests/sql/registro_telefono_128.sql
-- Base LOCAL únicamente. Transacción con ROLLBACK.

begin;
grant select on all tables in schema public to authenticated;
grant update on public.perfil to authenticated;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'atajo@t.l', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a2', 'normal@t.l', 'authenticated', 'authenticated');

set local role authenticated;

-- 1. El atajo de la 127: fijar el país por la función de preferencias NO completa el registro.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select * from public.actualizar_idioma_region('CO', 'es');
do $$ begin
  if not (select registro_pendiente from public.perfil where id = '00000000-0000-0000-0000-0000000000a1') then
    raise exception 'FALLA 128: fijar el país por preferencias completó el registro sin «Crear cuenta»';
  end if;
  raise notice 'OK 128: el atajo por país ya no completa el registro';
end $$;

-- 2. La función vieja sin celular ya no la puede llamar el usuario.
do $$ begin
  begin
    perform public.completar_registro('Atajo', 'CO', false, 'es');
    raise exception 'FALLA 128: completar_registro sigue disponible sin celular';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK 128: completar_registro sin celular cerrado';
end $$;

-- 3. Celulares inválidos rechazados en la base (aunque el navegador se salte la validación).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
do $$
declare v text;
begin
  foreach v in array array['+576012345678', '3001234567', '+57300', '+34912345678', '''; drop table perfil; --'] loop
    begin
      perform public.completar_registro_con_telefono('Normal', case when v like '+34%' then 'ES' else 'CO' end, v, false, 'es');
      raise exception 'FALLA 128: se aceptó el celular inválido %', v;
    exception when others then
      if sqlerrm not like '%TELEFONO_INVALIDO%' then raise; end if;
    end;
  end loop;
  if not (select registro_pendiente from public.perfil where id = '00000000-0000-0000-0000-0000000000a2') then
    raise exception 'FALLA 128: un intento fallido completó el registro';
  end if;
  raise notice 'OK 128: formatos inválidos rechazados y el registro sigue pendiente';
end $$;

-- 4. Registro válido: guarda el celular NO verificado y completa el registro.
do $$
declare p public.perfil;
begin
  perform public.completar_registro_con_telefono('Normal Uno', 'CO', '+573001234567', true, 'es');
  select * into p from public.perfil where id = '00000000-0000-0000-0000-0000000000a2';
  if p.registro_pendiente or p.telefono <> '+573001234567' or p.telefono_verificado or p.pais <> 'CO' then
    raise exception 'FALLA 128: registro mal guardado: %', row_to_json(p);
  end if;
  raise notice 'OK 128: crear cuenta guarda el celular sin verificar y completa el registro';
end $$;

-- 5. Nadie se marca el teléfono como verificado; cambiar el número quita la verificación.
update public.perfil set telefono_verificado = true, telefono_verificado_at = now() where id = '00000000-0000-0000-0000-0000000000a2';
do $$ begin
  if (select telefono_verificado from public.perfil where id = '00000000-0000-0000-0000-0000000000a2') then
    raise exception 'FALLA 128: el usuario se marcó el teléfono como verificado';
  end if;
  raise notice 'OK 128: el teléfono no se puede auto-verificar';
end $$;
reset role;
update public.perfil set telefono_verificado = true, telefono_verificado_at = now() where id = '00000000-0000-0000-0000-0000000000a2';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
update public.perfil set telefono = '+573009998877' where id = '00000000-0000-0000-0000-0000000000a2';
do $$ begin
  if (select telefono_verificado from public.perfil where id = '00000000-0000-0000-0000-0000000000a2') then
    raise exception 'FALLA 128: un número nuevo heredó la verificación del anterior';
  end if;
  begin
    update public.perfil set telefono = 'no-es-un-numero' where id = '00000000-0000-0000-0000-0000000000a2';
    raise exception 'FALLA 128: se guardó un teléfono con formato inválido';
  exception when others then
    if sqlerrm not like '%TELEFONO_INVALIDO%' then raise; end if;
  end;
  raise notice 'OK 128: cambiar el número quita la verificación y el formato se valida';
end $$;
reset role;

do $$ begin raise notice 'TODAS LAS PRUEBAS 128 PASARON'; end $$;
rollback;
