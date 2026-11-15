-- 142 · registrar_evento_fraude: un cliente solo puede registrar eventos ligados a un negocio con el que tiene relación. ADITIVA (misma firma), no borra datos.
-- Hallazgo (Fase 1B): cualquier usuario autenticado podía insertar eventos de fraude en el negocio de OTRO (p_negocio_id libre), con severidad y
-- payload a su elección: contaminaba la bandeja de fraude del dueño y del Super Admin y permitía llenar la tabla con payloads enormes.
-- Ahora: sin sesión → NO_AUTENTICADO; negocio ajeno (sin reserva ni acceso interno) → el evento se registra SIN negocio (no ensucia a nadie);
-- la severidad la fija el servidor (MEDIA) cuando llama un cliente; el payload se limita a 4 KB.
-- Reversión: restaurar la definición previa (supabase/migrations/056_lealtad_referidos_sellos_cashback.sql).
create or replace function public.registrar_evento_fraude(p_tipo text, p_negocio_id uuid default null, p_severidad text default 'MEDIA', p_payload jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_neg uuid := p_negocio_id;
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
begin
  if v_uid is null then raise exception 'NO_AUTENTICADO'; end if;
  if p_tipo is null or p_tipo not in ('CANJE_DUPLICADO', 'ABUSO_REFERIDO') then raise exception 'TIPO_NO_PERMITIDO_DESDE_CLIENTE'; end if;

  if v_neg is not null and not (
       coalesce(public.is_supersu(), false)
       or coalesce(public.tiene_acceso_interno(v_neg), false)
       or exists (select 1 from public.reserva r where r.cliente_id = v_uid and r.negocio_id = v_neg)
     ) then
    v_neg := null; -- sin relación con ese negocio: se registra a nombre del usuario, pero sin tocar al negocio
  end if;

  if length(v_payload::text) > 4096 then v_payload := jsonb_build_object('truncado', true); end if;

  insert into public.lealtad_fraude_evento (tipo, cliente_id, negocio_id, severidad, payload)
  values (p_tipo, v_uid, v_neg, 'MEDIA', v_payload);
end $$;
revoke all on function public.registrar_evento_fraude(text, uuid, text, jsonb) from public, anon;
grant execute on function public.registrar_evento_fraude(text, uuid, text, jsonb) to authenticated;
