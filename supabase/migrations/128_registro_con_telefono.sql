-- 128 · «Crear cuenta» pide el celular (sin verificar) y solo esa acción completa el registro.
--
-- 1. Celular obligatorio en el registro, con el indicativo del país elegido y validación de formato
--    en la base (no solo en el navegador). Se guarda como NO verificado: `telefono_verificado` solo
--    lo puede poner en true el servidor (p. ej. la futura verificación inversa por WhatsApp).
-- 2. Corrige un hueco de la 127: el registro se daba por completo al fijar el país por primera vez,
--    y `actualizar_idioma_region` también fija el país. Un usuario con registro pendiente podía
--    llamarla por la API y saltarse «Crear cuenta» (incluida la aceptación de Términos). Ahora el
--    registro solo se completa dentro de `completar_registro_con_telefono` (marca de transacción).
-- 3. `completar_registro` deja de ser invocable por los usuarios (lo reemplaza la función nueva).
--
-- Sin aplicar en producción. Re-ejecutable.

alter table public.perfil
  add column if not exists telefono_verificado boolean not null default false,
  add column if not exists telefono_verificado_at timestamptz;

-- Formato del celular por país de registro (E.164).
create or replace function public.telefono_valido_registro(p_pais text, p_telefono text)
returns boolean language sql immutable set search_path = public as $$
  select case upper(coalesce(p_pais, ''))
    when 'CO' then coalesce(p_telefono, '') ~ '^\+573[0-9]{9}$'            -- celular CO: 3XX XXX XXXX
    when 'US' then coalesce(p_telefono, '') ~ '^\+1[2-9][0-9]{2}[2-9][0-9]{6}$'
    when 'MX' then coalesce(p_telefono, '') ~ '^\+52[0-9]{10}$'
    when 'ES' then coalesce(p_telefono, '') ~ '^\+34[67][0-9]{8}$'          -- móvil ES: 6XX / 7XX
    else false end;
$$;
grant execute on function public.telefono_valido_registro(text, text) to authenticated, service_role;

-- Reglas del perfil (SECURITY INVOKER: decide con current_user).
create or replace function public.trg_perfil_registro_pendiente() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    -- Solo «Crear cuenta» completa el registro (marca local de la transacción que pone
    -- completar_registro_con_telefono; un cliente de la API no puede fijarla).
    if new.registro_pendiente and new.pais is not null
       and current_setting('stylernow.completando_registro', true) = 'on' then
      if coalesce(new.telefono, '') = '' then
        raise exception 'TELEFONO_REQUERIDO';
      end if;
      new.registro_pendiente := false;
    elsif new.registro_pendiente is distinct from old.registro_pendiente
          and current_user not in ('postgres', 'supabase_admin') then
      new.registro_pendiente := old.registro_pendiente;
    end if;

    if current_user in ('authenticated', 'anon') then
      -- Nadie se marca el teléfono como verificado por la API.
      if new.telefono_verificado is distinct from old.telefono_verificado
         or new.telefono_verificado_at is distinct from old.telefono_verificado_at then
        new.telefono_verificado := old.telefono_verificado;
        new.telefono_verificado_at := old.telefono_verificado_at;
      end if;
      -- Formato E.164 al cambiar el número; un número nuevo nunca hereda la verificación.
      if new.telefono is distinct from old.telefono then
        if new.telefono is not null and new.telefono !~ '^\+[1-9][0-9]{6,14}$' then
          raise exception 'TELEFONO_INVALIDO';
        end if;
        new.telefono_verificado := false;
        new.telefono_verificado_at := null;
      end if;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.trg_perfil_registro_pendiente() from public, anon, authenticated;

drop trigger if exists trg_perfil_registro_pendiente on public.perfil;
create trigger trg_perfil_registro_pendiente before update on public.perfil
  for each row execute function public.trg_perfil_registro_pendiente();

-- «Crear cuenta»: nombre, país, celular y aceptación legal en una sola transacción.
create or replace function public.completar_registro_con_telefono(
  p_nombre text, p_pais text, p_telefono text, p_marketing boolean default false, p_locale text default 'es')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_res jsonb; v_actual text;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if not public.telefono_valido_registro(p_pais, p_telefono) then raise exception 'TELEFONO_INVALIDO'; end if;

  select telefono into v_actual from public.perfil where id = auth.uid() for update;
  if not found then raise exception 'PERFIL_NO_ENCONTRADO'; end if;

  -- Número distinto al guardado: queda sin verificar (el formato no prueba que sea suyo).
  update public.perfil
     set telefono = p_telefono,
         telefono_verificado = case when v_actual is not distinct from p_telefono then telefono_verificado else false end,
         telefono_verificado_at = case when v_actual is not distinct from p_telefono then telefono_verificado_at else null end
   where id = auth.uid();

  perform set_config('stylernow.completando_registro', 'on', true);
  v_res := public.completar_registro(p_nombre, p_pais, p_marketing, p_locale);
  perform set_config('stylernow.completando_registro', 'off', true);
  return v_res || jsonb_build_object('telefono_verificado', false);
end $$;
revoke all on function public.completar_registro_con_telefono(text, text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.completar_registro_con_telefono(text, text, text, boolean, text) to authenticated;

-- La versión sin celular ya no la llama el cliente (solo la función nueva, como dueño).
revoke all on function public.completar_registro(text, text, boolean, text) from public, anon, authenticated;
