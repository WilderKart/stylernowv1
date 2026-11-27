-- 204: el panel del negocio se actualiza solo cuando entra una reserva o un comprobante de pago directo.
-- Añade `reserva` y `pago_reserva` a la publicación de Realtime. La RLS de cada tabla sigue decidiendo qué eventos recibe cada
-- usuario (el dueño/equipo solo ve los de su negocio); el cliente del panel usa el evento solo como aviso y vuelve a pedir los datos.
-- Reversión: alter publication supabase_realtime drop table public.reserva, public.pago_reserva;

do $$
declare t text;
begin
  foreach t in array array['reserva', 'pago_reserva'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
