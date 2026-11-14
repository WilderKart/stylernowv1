-- 134 · Imagen opcional por servicio (pedido del propietario, 2026-11-14): ayuda al cliente a reconocer
-- servicios cuyo nombre no conoce. El archivo vive en el bucket público negocio-media bajo
-- {negocio_id}/servicios/{servicio_id}.{ext}; las políticas existentes (negocio_media_*_barberia) ya
-- restringen la escritura al dueño de esa carpeta. Aquí solo se guarda la URL pública.
-- Solo agrega una columna anulable con validación: no cambia datos ni permisos.

alter table public.servicio
  add column if not exists imagen_url text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'servicio_imagen_url_valida') then
    alter table public.servicio
      add constraint servicio_imagen_url_valida
      check (imagen_url is null or (imagen_url ~ '^https?://' and length(imagen_url) <= 600));
  end if;
end $$;

comment on column public.servicio.imagen_url is 'URL pública (bucket negocio-media) de la imagen guía del servicio. Opcional.';
