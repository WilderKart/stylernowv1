-- StylerNow — Migración 007: trigger de alta de usuario, wallet automática, Storage

-- ── Alta automática de `perfil` al crear un usuario en auth.users ─────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfil (id, nombre, telefono, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    new.phone,
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Wallet automática al crear un Negocio ──────────────────────────────────
create or replace function public.handle_new_negocio()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.wallet (negocio_id) values (new.id);
  return new;
end;
$$;

create trigger on_negocio_created
  after insert on public.negocio
  for each row execute function public.handle_new_negocio();

-- ── Storage: buckets ────────────────────────────────────────────────────
-- avatars: fotos de perfil de Cliente/Staff. negocio-media: logos/fotos de Negocio.
-- crm-fotos: fotos de resultados de servicio adjuntas al CRM (03-Business-Rules/07_CRM.md,
-- requiere consentimiento capturado en la fila de `perfil.consentimiento_datos_at`).
-- soporte-adjuntos: adjuntos de tickets.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/png','image/jpeg','image/webp']),
  ('negocio-media', 'negocio-media', true, 10485760, array['image/png','image/jpeg','image/webp']),
  ('crm-fotos', 'crm-fotos', false, 10485760, array['image/png','image/jpeg','image/webp']),
  ('soporte-adjuntos', 'soporte-adjuntos', false, 10485760, null)
on conflict (id) do nothing;

-- Políticas de Storage: cada bucket sigue el mismo alcance que su tabla de dominio.
create policy avatars_select_publico on storage.objects for select using (bucket_id = 'avatars');
create policy avatars_write_propio on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_update_propio on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_delete_propio on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy negocio_media_select_publico on storage.objects for select using (bucket_id = 'negocio-media');
create policy negocio_media_write_barberia on storage.objects for insert
  with check (bucket_id = 'negocio-media' and public.is_barberia_de(((storage.foldername(name))[1])::uuid));
create policy negocio_media_update_barberia on storage.objects for update
  using (bucket_id = 'negocio-media' and public.is_barberia_de(((storage.foldername(name))[1])::uuid));
create policy negocio_media_delete_barberia on storage.objects for delete
  using (bucket_id = 'negocio-media' and public.is_barberia_de(((storage.foldername(name))[1])::uuid));

-- crm-fotos: ruta esperada `<negocio_id>/<cliente_id>/archivo.jpg`
create policy crm_fotos_select_interno on storage.objects for select
  using (bucket_id = 'crm-fotos' and public.tiene_acceso_interno(((storage.foldername(name))[1])::uuid));
create policy crm_fotos_select_cliente on storage.objects for select
  using (bucket_id = 'crm-fotos' and (storage.foldername(name))[2] = auth.uid()::text);
create policy crm_fotos_write_interno on storage.objects for insert
  with check (bucket_id = 'crm-fotos' and public.tiene_acceso_interno(((storage.foldername(name))[1])::uuid));

-- soporte-adjuntos: ruta esperada `<usuario_id>/archivo.ext`
create policy soporte_adjuntos_propio on storage.objects for all
  using (bucket_id = 'soporte-adjuntos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'soporte-adjuntos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy soporte_adjuntos_supersu on storage.objects for select
  using (bucket_id = 'soporte-adjuntos' and public.is_supersu());
