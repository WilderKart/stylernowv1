-- 140 · Un descuento PORCENTAJE de una promoción no puede superar el 100 % (decisión del propietario). ADITIVA, no borra ni modifica filas.
-- NOT VALID: se aplica a toda inserción/actualización nueva sin bloquear por filas previas; si en producción no hay filas fuera de rango se puede
-- validar después con: alter table public.oferta_negocio validate constraint oferta_negocio_porcentaje_max_chk;
-- Reversión: alter table public.oferta_negocio drop constraint if exists oferta_negocio_porcentaje_max_chk;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'oferta_negocio_porcentaje_max_chk' and conrelid = 'public.oferta_negocio'::regclass) then
    alter table public.oferta_negocio
      add constraint oferta_negocio_porcentaje_max_chk check (tipo_descuento <> 'PORCENTAJE' or valor <= 100) not valid;
  end if;
end $$;
