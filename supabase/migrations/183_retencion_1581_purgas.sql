-- 183 · Cumplimiento técnico de la política de retención (Ley 1581): purga y anonimización programables.
-- La política de datos v3 describe estos plazos pero no existía ningún mecanismo ejecutable excepto
-- la anonimización de cuenta (100) y el limpiador genérico de límite de tasa (112). Esta migración
-- agrega una única RPC de mantenimiento, sin exponer datos personales al API pública.

begin;

alter table public.prueba_uso alter column telefono_hash drop not null;
alter table public.prueba_uso alter column documento_hash drop not null;
alter table public.prueba_uso alter column email_hash drop not null;
alter table public.prueba_uso alter column dispositivo_hash drop not null;

create or replace function public.purgar_retencion_1581()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_intentos integer := 0;
  v_huellas_anuncios integer := 0;
  v_huellas_prueba integer := 0;
  v_tasa integer := 0;
begin
  delete from public.intento_auth
  where created_at < now() - interval '30 days';
  get diagnostics v_intentos = row_count;

  delete from public.anuncio_evento_dedupe
  where dia < ((now() at time zone 'America/Bogota')::date - 30);
  get diagnostics v_huellas_anuncios = row_count;

  -- La cookie sn_disp vive hasta 730 días; después de ese plazo las huellas ya no tienen finalidad.
  update public.prueba_uso
     set ip_hash = null,
         equipo_hash = null,
         telefono_hash = null,
         documento_hash = null,
         email_hash = null,
         dispositivo_hash = null
   where created_at < now() - interval '730 days'
     and (ip_hash is not null or equipo_hash is not null or telefono_hash is not null
          or documento_hash is not null or email_hash is not null or dispositivo_hash is not null);
  get diagnostics v_huellas_prueba = row_count;

  -- La política fija 2 días como plazo máximo de las huellas de intentos por conexión.
  delete from public.limite_tasa_evento
  where creado_at < now() - interval '2 days';
  get diagnostics v_tasa = row_count;

  return jsonb_build_object(
    'intento_auth_eliminados', v_intentos,
    'anuncio_evento_dedupe_eliminados', v_huellas_anuncios,
    'prueba_uso_anonimizados', v_huellas_prueba,
    'limite_tasa_evento_eliminados', v_tasa
  );
end;
$$;

comment on function public.purgar_retencion_1581() is
  'Ejecuta la retención documentada en la política de datos v3. Solo service_role; devuelve conteos sin PII.';

revoke all on function public.purgar_retencion_1581() from public, anon, authenticated;
grant execute on function public.purgar_retencion_1581() to service_role;

commit;
