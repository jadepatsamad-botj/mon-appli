-- Jade : activités enrichies (étape 2 : se rencontrer en vrai)
-- À coller dans Supabase → SQL Editor → Run. Peut être relancé sans risque.
-- À lancer APRÈS sql/tout-en-un.sql.
--
-- Ce que ça ajoute :
--  * une photo et une adresse pour chaque activité (avec lien vers la carte) ;
--  * la liste des participants, visible par les autres participants ;
--  * une discussion de groupe par activité, réservée aux participants ;
--  * après la sortie : « Qui avez-vous aimé rencontrer ? » (si c'est réciproque, les deux sont prévenus) ;
--  * le badge « sorties Jade » : l'admin coche qui était présent.

-- ---------- Photo et adresse ----------
alter table public.events add column if not exists address text;
alter table public.events add column if not exists photo_url text;

-- Espace de stockage PUBLIC pour les photos d'activités (seuls les admins y déposent)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-photos', 'event-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "photos activités : admin dépose" on storage.objects;
create policy "photos activités : admin dépose" on storage.objects for insert to authenticated
  with check (bucket_id = 'event-photos' and public.jade_is_admin());
drop policy if exists "photos activités : admin remplace" on storage.objects;
create policy "photos activités : admin remplace" on storage.objects for update to authenticated
  using (bucket_id = 'event-photos' and public.jade_is_admin());
drop policy if exists "photos activités : admin supprime" on storage.objects;
create policy "photos activités : admin supprime" on storage.objects for delete to authenticated
  using (bucket_id = 'event-photos' and public.jade_is_admin());

-- Est-ce que je participe à cette activité ?
create or replace function public.jade_in_event(eid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.event_signups where event_id = eid and user_id = auth.uid());
$$;
grant execute on function public.jade_in_event(uuid) to authenticated;

-- Un autre membre participe-t-il à cette activité ? (lu sans être limité par les règles d'accès)
create or replace function public.jade_user_in_event(eid uuid, uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.event_signups where event_id = eid and user_id = uid);
$$;
grant execute on function public.jade_user_in_event(uuid, uuid) to authenticated;

-- ---------- Participants (visibles par les autres participants et les admins) ----------
create or replace function public.event_people(eid uuid)
returns table (user_id uuid, first_name text, photo_path text, verified boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.jade_in_event(eid) or public.jade_is_admin()) then return; end if;
  return query
    select p.id, p.first_name, p.photo_path, coalesce(p.verified, false)
    from public.event_signups s join public.profiles p on p.id = s.user_id
    where s.event_id = eid and coalesce(p.suspended, false) = false
    order by s.created_at;
end $$;
revoke all on function public.event_people(uuid) from public, anon;
grant execute on function public.event_people(uuid) to authenticated;

-- ---------- Discussion de groupe ----------
create table if not exists public.event_messages (
  id bigserial primary key,
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists event_messages_idx on public.event_messages (event_id, created_at);
grant select, insert, delete on public.event_messages to authenticated;
grant usage on sequence public.event_messages_id_seq to authenticated;
alter table public.event_messages enable row level security;
drop policy if exists "groupe : lire" on public.event_messages;
drop policy if exists "groupe : écrire" on public.event_messages;
drop policy if exists "groupe : supprimer" on public.event_messages;
create policy "groupe : lire" on public.event_messages for select to authenticated
  using (public.jade_in_event(event_id) or public.jade_is_admin());
create policy "groupe : écrire" on public.event_messages for insert to authenticated
  with check (user_id = auth.uid() and (public.jade_in_event(event_id) or public.jade_is_admin()));
create policy "groupe : supprimer" on public.event_messages for delete to authenticated
  using (user_id = auth.uid() or public.jade_is_admin());

-- ---------- Après la sortie : « Qui avez-vous aimé rencontrer ? » ----------
alter table public.jade_notices add column if not exists other_id uuid references auth.users(id) on delete cascade;
alter table public.jade_notices drop constraint if exists jade_notices_kind_check;
alter table public.jade_notices add constraint jade_notices_kind_check check (kind in ('info', 'event', 'photo', 'meet'));

create table if not exists public.event_likes (
  event_id uuid not null references public.events(id) on delete cascade,
  from_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  to_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, from_id, to_id)
);
grant select, insert, delete on public.event_likes to authenticated;
alter table public.event_likes enable row level security;
drop policy if exists "rencontres : voir les miennes" on public.event_likes;
drop policy if exists "rencontres : aimer" on public.event_likes;
drop policy if exists "rencontres : retirer" on public.event_likes;
-- Discret : on ne voit que ses propres choix
create policy "rencontres : voir les miennes" on public.event_likes for select to authenticated using (from_id = auth.uid());
-- Seulement entre participants d'une activité qui a déjà commencé
create policy "rencontres : aimer" on public.event_likes for insert to authenticated
  with check (
    from_id = auth.uid() and to_id <> auth.uid()
    and public.jade_in_event(event_id)
    and public.jade_user_in_event(event_id, to_id)
    and exists (select 1 from public.events e where e.id = event_likes.event_id and e.starts_at < now())
  );
create policy "rencontres : retirer" on public.event_likes for delete to authenticated using (from_id = auth.uid());

-- Réciproque → les deux reçoivent un message de l'équipe Jade
create or replace function public.jade_event_like_match() returns trigger
language plpgsql security definer set search_path = public as $$
declare t text;
begin
  if exists (select 1 from public.event_likes where event_id = new.event_id and from_id = new.to_id and to_id = new.from_id) then
    select title into t from public.events where id = new.event_id;
    if not exists (select 1 from public.jade_notices where kind = 'meet' and event_id = new.event_id and user_id = new.from_id and other_id = new.to_id) then
      insert into public.jade_notices (user_id, kind, title, event_id, other_id) values
        (new.from_id, 'meet', t, new.event_id, new.to_id),
        (new.to_id, 'meet', t, new.event_id, new.from_id);
    end if;
  end if;
  return null;
end $$;
drop trigger if exists jade_event_like_match on public.event_likes;
create trigger jade_event_like_match after insert on public.event_likes
  for each row execute function public.jade_event_like_match();

-- ---------- Badge « sorties Jade » ----------
alter table public.event_signups add column if not exists attended boolean;
alter table public.profiles add column if not exists outings integer not null default 0;

-- Un membre ne peut pas modifier lui-même son nombre de sorties
create or replace function public.jade_protect_outings() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then new.outings := 0; else new.outings := old.outings; end if;
  end if;
  return new;
end $$;
drop trigger if exists jade_protect_outings on public.profiles;
create trigger jade_protect_outings before insert or update on public.profiles
  for each row execute function public.jade_protect_outings();

-- L'admin coche « présent·e » : le compteur du membre est recalculé
create or replace function public.admin_set_attended(eid uuid, uid uuid, flag boolean)
returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.jade_is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  update public.event_signups set attended = flag where event_id = eid and user_id = uid;
  select count(*) into n from public.event_signups s join public.events e on e.id = s.event_id
    where s.user_id = uid and s.attended and not e.cancelled;
  update public.profiles set outings = n where id = uid;
  return n;
end $$;
revoke all on function public.admin_set_attended(uuid, uuid, boolean) from public, anon;
grant execute on function public.admin_set_attended(uuid, uuid, boolean) to authenticated;

-- Liste des inscrits pour l'admin, avec la présence
create or replace function public.admin_event_people(eid uuid)
returns table (user_id uuid, first_name text, country text, gender text, attended boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.jade_is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  return query
    select p.id, p.first_name, p.country, p.gender, s.attended
    from public.event_signups s join public.profiles p on p.id = s.user_id
    where s.event_id = eid order by s.created_at;
end $$;
revoke all on function public.admin_event_people(uuid) from public, anon;
grant execute on function public.admin_event_people(uuid) to authenticated;

select 'Activités enrichies : OK' as resultat;
