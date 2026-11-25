-- 197 — Chat de soporte: indicador «está escribiendo…» (Realtime Broadcast, canal PRIVADO).
-- Es un aviso efímero: no se guarda nada y nunca lleva texto. La autorización se decide aquí, en la base: solo SuperSU y el
-- dueño del negocio (con chat incluido en su plan) pueden unirse a, escuchar o emitir en el canal `soporte-escritura:<negocio_id>`.
-- Zero Trust: el navegador no decide el negocio ni el rol; el tema del canal se valida contra is_supersu() / is_barberia_de().

create or replace function public.soporte_puede_canal(p_tema text)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_negocio uuid;
begin
  if auth.uid() is null or p_tema is null then return false; end if;
  -- Formato estricto `soporte-escritura:<uuid>`; cualquier otro tema se rechaza.
  if p_tema !~* '^soporte-escritura:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  v_negocio := split_part(p_tema, ':', 2)::uuid;
  if coalesce(public.is_supersu(), false) then return true; end if;
  return coalesce(public.is_barberia_de(v_negocio), false) and public._soporte_plan_incluye(v_negocio, 'soporte_chat');
end;
$$;

-- public/anon/authenticated son independientes: se revocan los tres y luego se concede solo a authenticated.
revoke all on function public.soporte_puede_canal(text) from public, anon, authenticated;
grant execute on function public.soporte_puede_canal(text) to authenticated;

-- Solo broadcast, solo temas del chat de soporte. Sin política para `presence` ni para otros temas: quedan denegados.
drop policy if exists soporte_escritura_escuchar on realtime.messages;
create policy soporte_escritura_escuchar on realtime.messages
  for select to authenticated
  using (extension = 'broadcast' and public.soporte_puede_canal(realtime.topic()));

drop policy if exists soporte_escritura_emitir on realtime.messages;
create policy soporte_escritura_emitir on realtime.messages
  for insert to authenticated
  with check (extension = 'broadcast' and public.soporte_puede_canal(realtime.topic()));
