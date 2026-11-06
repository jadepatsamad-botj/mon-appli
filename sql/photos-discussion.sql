-- Jade : envoi de photos dans la discussion
-- À coller une seule fois dans Supabase > SQL Editor > New query, puis « Run ».
-- On peut le relancer sans risque.

-- 1. Une colonne pour la photo jointe à un message
alter table public.messages add column if not exists image_path text;
grant select (image_path), insert (image_path) on public.messages to authenticated;

-- 2. Un espace de stockage PRIVÉ pour ces photos (5 Mo max, images uniquement)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-photos', 'chat-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- 3. Les règles : chemin = expéditeur / destinataire / fichier
--    • on ne peut déposer une photo que dans son propre dossier
--    • seules les deux personnes de la conversation peuvent la voir
--    • seul l'expéditeur peut la supprimer
drop policy if exists "chat photos : envoyer" on storage.objects;
create policy "chat photos : envoyer" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "chat photos : voir" on storage.objects;
create policy "chat photos : voir" on storage.objects for select to authenticated
  using (bucket_id = 'chat-photos' and auth.uid()::text in ((storage.foldername(name))[1], (storage.foldername(name))[2]));

drop policy if exists "chat photos : supprimer" on storage.objects;
create policy "chat photos : supprimer" on storage.objects for delete to authenticated
  using (bucket_id = 'chat-photos' and (storage.foldername(name))[1] = auth.uid()::text);
