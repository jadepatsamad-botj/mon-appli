-- ============================================================================================
-- Jade : TOUT EN UN
-- À coller dans Supabase → SQL Editor → New query → Run. Peut être relancé sans risque.
-- Regroupe tous les codes SQL de Jade (messages, photos, activités, messagerie de l'équipe,
-- photo obligatoire, adresses IP, origines). Le résultat en bas résume ce qui est en place.
-- ============================================================================================

-- ############################################################
-- 1. Messages : écrire à tout membre
-- ############################################################
-- Jade : pouvoir écrire à n'importe quel membre (plus besoin de match), comme sur Seeking.
-- À coller une fois dans Supabase > SQL Editor > New query, puis « Run ». On peut le relancer sans risque.
--
-- Cette règle s'AJOUTE aux règles existantes (elle n'en supprime aucune) :
--   • on écrit toujours en son propre nom
--   • pas à soi-même, pas à un compte suspendu
--   • pas si l'un des deux a bloqué l'autre

drop policy if exists "messages : écrire à tout membre" on public.messages;
create policy "messages : écrire à tout membre" on public.messages for insert to authenticated
  with check (
    from_id = auth.uid()
    and to_id <> auth.uid()
    and exists (select 1 from public.profiles p where p.id = to_id and coalesce(p.suspended, false) = false)
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = to_id)
         or (b.blocker_id = to_id and b.blocked_id = auth.uid())
    )
  );

-- ############################################################
-- 2. Photos dans la discussion
-- ############################################################
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

-- ############################################################
-- 3. Activités (sorties en groupe) + heure du lieu
-- ############################################################
-- Jade : activités (sorties en groupe)
-- À coller dans Supabase → SQL Editor → Run. Peut être relancé sans risque.
-- Crée les activités, les inscriptions, le compteur d'inscrits et la liste des inscrits pour l'admin.

-- Les administrateurs (déjà présent normalement ; créé seulement s'il manque)
do $$
begin
  if to_regclass('public.admins') is null then
    create table public.admins (user_id uuid primary key references auth.users(id) on delete cascade);
    alter table public.admins enable row level security;
    create policy "admins: voir sa ligne" on public.admins for select to authenticated using (user_id = auth.uid());
  end if;
end $$;

create or replace function public.jade_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
grant execute on function public.jade_is_admin() to authenticated;

-- Les activités
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 120),
  description text check (char_length(description) <= 3000),
  city text,
  country text,
  starts_at timestamptz not null,
  tz text,                                   -- fuseau horaire du lieu (ex. Asia/Bangkok)
  duration_hours numeric not null default 2 check (duration_hours > 0 and duration_hours <= 240),
  capacity integer not null default 10 check (capacity between 1 and 500),
  price_eur numeric not null default 0 check (price_eur >= 0),
  min_level integer not null default 0 check (min_level between 0 and 3),
  cancelled boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.events add column if not exists tz text;
create index if not exists events_starts_at_idx on public.events (starts_at);

-- Les inscriptions
create table if not exists public.event_signups (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- Sécurité : tout le monde (connecté) voit les activités, seuls les admins les gèrent ;
-- chacun gère ses propres inscriptions.
grant select, insert, update, delete on public.events to authenticated;
grant select, insert, delete on public.event_signups to authenticated;
alter table public.events enable row level security;
alter table public.event_signups enable row level security;

drop policy if exists "events: voir" on public.events;
drop policy if exists "events: admin ajoute" on public.events;
drop policy if exists "events: admin modifie" on public.events;
drop policy if exists "events: admin supprime" on public.events;
create policy "events: voir" on public.events for select to authenticated using (true);
create policy "events: admin ajoute" on public.events for insert to authenticated with check (public.jade_is_admin());
create policy "events: admin modifie" on public.events for update to authenticated using (public.jade_is_admin()) with check (public.jade_is_admin());
create policy "events: admin supprime" on public.events for delete to authenticated using (public.jade_is_admin());

drop policy if exists "inscriptions: voir les siennes" on public.event_signups;
drop policy if exists "inscriptions: s'inscrire" on public.event_signups;
drop policy if exists "inscriptions: se désinscrire" on public.event_signups;
create policy "inscriptions: voir les siennes" on public.event_signups for select to authenticated using (user_id = auth.uid() or public.jade_is_admin());
create policy "inscriptions: s'inscrire" on public.event_signups for insert to authenticated with check (user_id = auth.uid());
create policy "inscriptions: se désinscrire" on public.event_signups for delete to authenticated using (user_id = auth.uid() or public.jade_is_admin());

-- Avant chaque inscription : activité annulée ou passée, ou complète → refusée
create or replace function public.jade_event_signup_check() returns trigger
language plpgsql security definer set search_path = public as $$
declare e public.events%rowtype; n integer;
begin
  select * into e from public.events where id = new.event_id for update;
  if not found or e.cancelled or e.starts_at < now() then raise exception 'EVENT_PAST'; end if;
  select count(*) into n from public.event_signups where event_id = new.event_id;
  if n >= e.capacity then raise exception 'EVENT_FULL'; end if;
  return new;
end $$;
drop trigger if exists jade_event_signup_check on public.event_signups;
create trigger jade_event_signup_check before insert on public.event_signups
  for each row execute function public.jade_event_signup_check();

-- Nombre d'inscrits par activité (pour afficher les places restantes)
create or replace function public.event_counts() returns table (event_id uuid, n integer)
language sql stable security definer set search_path = public as $$
  select s.event_id, count(*)::integer from public.event_signups s group by s.event_id;
$$;
grant execute on function public.event_counts() to authenticated;

-- Liste des inscrits d'une activité (administrateurs seulement)
create or replace function public.admin_event_participants(eid uuid)
returns table (user_id uuid, first_name text, country text, gender text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.jade_is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  return query
    select p.id, p.first_name, p.country, p.gender
    from public.event_signups s join public.profiles p on p.id = s.user_id
    where s.event_id = eid order by s.created_at;
end $$;
revoke all on function public.admin_event_participants(uuid) from public, anon;
grant execute on function public.admin_event_participants(uuid) to authenticated;

-- ############################################################
-- 4. Messagerie de l'équipe Jade + photo obligatoire
-- ############################################################
-- Jade : messagerie de l'équipe Jade (bouton à côté de la loupe, dans Messages)
-- À coller dans Supabase → SQL Editor → Run. Peut être relancé sans risque.
-- À lancer APRÈS sql/activites.sql (les activités doivent exister).
--
-- Ce que ça fait :
--  * Une boîte « Équipe Jade » : annonces pour tous les membres, ou messages pour un membre précis.
--  * Chaque nouvelle activité publiée envoie automatiquement une annonce à tous les membres.
--  * Photo obligatoire : un membre sans photo reçoit l'avertissement dans cette boîte
--    (plus besoin du compte equipe@jadedating.app ; remplace sql/photo-obligatoire.sql).

-- Administrateurs (fonction utilisée plus bas ; déjà créée par sql/activites.sql)
create or replace function public.jade_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
grant execute on function public.jade_is_admin() to authenticated;

-- ---------- La boîte de l'équipe Jade ----------
create table if not exists public.jade_notices (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade,   -- vide = tous les membres
  kind text not null default 'info' check (kind in ('info', 'event', 'photo')),
  title text check (char_length(title) <= 200),
  body text check (char_length(body) <= 4000),
  event_id uuid references public.events(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists jade_notices_user_idx on public.jade_notices (user_id, created_at desc);

-- Jusqu'où chaque membre a lu
create table if not exists public.jade_notice_reads (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  read_at timestamptz not null default now()
);

grant select, insert, delete on public.jade_notices to authenticated;
grant usage on sequence public.jade_notices_id_seq to authenticated;
grant select, insert, update on public.jade_notice_reads to authenticated;
alter table public.jade_notices enable row level security;
alter table public.jade_notice_reads enable row level security;

drop policy if exists "jade: lire" on public.jade_notices;
drop policy if exists "jade: admin écrit" on public.jade_notices;
drop policy if exists "jade: admin supprime" on public.jade_notices;
create policy "jade: lire" on public.jade_notices for select to authenticated
  using (user_id is null or user_id = auth.uid() or public.jade_is_admin());
create policy "jade: admin écrit" on public.jade_notices for insert to authenticated with check (public.jade_is_admin());
create policy "jade: admin supprime" on public.jade_notices for delete to authenticated using (public.jade_is_admin());

drop policy if exists "jade lu: voir" on public.jade_notice_reads;
drop policy if exists "jade lu: ajouter" on public.jade_notice_reads;
drop policy if exists "jade lu: modifier" on public.jade_notice_reads;
create policy "jade lu: voir" on public.jade_notice_reads for select to authenticated using (user_id = auth.uid());
create policy "jade lu: ajouter" on public.jade_notice_reads for insert to authenticated with check (user_id = auth.uid());
create policy "jade lu: modifier" on public.jade_notice_reads for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- Nouvelle activité publiée → annonce à tous ----------
create or replace function public.jade_event_notice() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not new.cancelled then
    insert into public.jade_notices (user_id, kind, title, event_id) values (null, 'event', new.title, new.id);
  end if;
  return null;
end $$;
drop trigger if exists jade_event_notice on public.events;
create trigger jade_event_notice after insert on public.events
  for each row execute function public.jade_event_notice();

-- ---------- Photo obligatoire ----------
alter table public.profiles add column if not exists photo_warned_at timestamptz;
alter table public.profiles add column if not exists is_team boolean not null default false;

-- Avertit le membre sans photo (une seule fois) dans la boîte de l'équipe Jade
create or replace function public.jade_warn_no_photo(uid uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.profiles where id = uid
             and (coalesce(photo_path, '') <> '' or photo_warned_at is not null or is_team)) then
    return false;
  end if;
  insert into public.jade_notices (user_id, kind) values (uid, 'photo');
  update public.profiles set photo_warned_at = now() where id = uid;
  return true;
exception when others then
  return false;
end $$;
revoke all on function public.jade_warn_no_photo(uuid) from public, anon, authenticated;

-- Un membre ne peut pas modifier lui-même ces colonnes ; l'avertissement s'efface avec une photo
create or replace function public.jade_protect_photo_cols() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.photo_warned_at := null; new.is_team := false;
    else
      new.photo_warned_at := old.photo_warned_at; new.is_team := old.is_team;
    end if;
  end if;
  if coalesce(new.photo_path, '') <> '' then new.photo_warned_at := null; end if;
  return new;
end $$;
drop trigger if exists jade_protect_photo_cols on public.profiles;
create trigger jade_protect_photo_cols before insert or update on public.profiles
  for each row execute function public.jade_protect_photo_cols();

-- Dès qu'un profil se retrouve sans photo : avertissement tout de suite
create or replace function public.jade_after_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.photo_path, '') = '' and new.photo_warned_at is null and not new.is_team then
    perform public.jade_warn_no_photo(new.id);
  end if;
  return null;
end $$;
drop trigger if exists jade_after_profile on public.profiles;
create trigger jade_after_profile after insert or update of photo_path on public.profiles
  for each row execute function public.jade_after_profile();

-- Vérification à chaque connexion
create or replace function public.jade_photo_check() returns json
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); p public.profiles%rowtype; sent boolean := false;
begin
  if me is null then return null; end if;
  select * into p from public.profiles where id = me;
  if not found then return null; end if;
  if coalesce(p.photo_path, '') <> '' or p.is_team then
    return json_build_object('warned', false, 'locked', false);
  end if;
  if p.photo_warned_at is null then sent := public.jade_warn_no_photo(me); end if;
  return json_build_object('warned', sent, 'locked', true);
end $$;
revoke all on function public.jade_photo_check() from public, anon;
grant execute on function public.jade_photo_check() to authenticated;

-- Bouton « Prévenir les profils sans photo » de l'Administration
create or replace function public.jade_photo_sweep() returns integer
language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0;
begin
  if not public.jade_is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  for r in select id from public.profiles where coalesce(photo_path, '') = '' and photo_warned_at is null and not is_team loop
    if public.jade_warn_no_photo(r.id) then n := n + 1; end if;
  end loop;
  return n;
end $$;
revoke all on function public.jade_photo_sweep() from public, anon;
grant execute on function public.jade_photo_sweep() to authenticated;

-- ############################################################
-- 5. Adresses IP de connexion
-- ############################################################
-- Jade : adresses IP de connexion (réservées à l'administration)
-- À coller dans Supabase → SQL Editor → Run. Peut être relancé sans risque.
--
-- Ce que ça fait :
--  * À chaque connexion, l'appli enregistre l'adresse IP et le type d'appareil du membre
--    (au plus une ligne toutes les 6 heures pour une même IP).
--  * Seuls les administrateurs peuvent les voir, depuis la page Administration.
--  * Les lignes de plus de 90 jours sont effacées automatiquement (RGPD : durée limitée).

create or replace function public.jade_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
grant execute on function public.jade_is_admin() to authenticated;

create table if not exists public.login_ips (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists login_ips_user_idx on public.login_ips (user_id, created_at desc);
create index if not exists login_ips_ip_idx on public.login_ips (ip);
create index if not exists login_ips_date_idx on public.login_ips (created_at desc);

-- Personne ne lit ni n'écrit cette table directement : tout passe par les fonctions ci-dessous
alter table public.login_ips enable row level security;
revoke all on public.login_ips from anon, authenticated;

-- Appelée par l'appli à la connexion : lit l'IP dans les en-têtes de la requête
create or replace function public.jade_log_login() returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  h json := nullif(current_setting('request.headers', true), '')::json;
  v_ip text;
  v_ua text;
begin
  if me is null or h is null then return; end if;
  v_ip := coalesce(nullif(h->>'cf-connecting-ip', ''), nullif(h->>'x-real-ip', ''),
                   nullif(trim(split_part(coalesce(h->>'x-forwarded-for', ''), ',', 1)), ''));
  v_ua := left(h->>'user-agent', 300);
  if exists (select 1 from public.login_ips where user_id = me and ip is not distinct from v_ip
             and created_at > now() - interval '6 hours') then
    return;
  end if;
  insert into public.login_ips (user_id, ip, user_agent) values (me, v_ip, v_ua);
  delete from public.login_ips where created_at < now() - interval '90 days';
end $$;
revoke all on function public.jade_log_login() from public, anon;
grant execute on function public.jade_log_login() to authenticated;

-- Pour l'administration : dernières connexions (de tous, ou d'un membre),
-- avec le nombre d'autres comptes vus sur la même IP (utile pour repérer les faux comptes)
create or replace function public.admin_login_ips(uid uuid default null, lim integer default 100)
returns table (user_id uuid, first_name text, ip text, user_agent text, created_at timestamptz, other_accounts integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.jade_is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  return query
    select l.user_id, p.first_name, l.ip, l.user_agent, l.created_at,
      (select count(distinct o.user_id)::integer from public.login_ips o
        where o.ip = l.ip and o.user_id <> l.user_id) as other_accounts
    from public.login_ips l left join public.profiles p on p.id = l.user_id
    where uid is null or l.user_id = uid
    order by l.created_at desc
    limit least(greatest(coalesce(lim, 100), 1), 500);
end $$;
revoke all on function public.admin_login_ips(uuid, integer) from public, anon;
grant execute on function public.admin_login_ips(uuid, integer) to authenticated;

-- ############################################################
-- 6. Communauté asiatique : origines
-- ############################################################
-- Jade : communauté asiatique de France et d'Europe
-- À coller dans Supabase → SQL Editor → Run. Peut être relancé sans risque.
-- Ajoute les origines de chaque membre (Chine, Vietnam, Cambodge…), affichées sur le profil
-- et utilisables dans les filtres de l'Accueil.
alter table public.profiles add column if not exists origins text[] not null default '{}';
create index if not exists profiles_origins_idx on public.profiles using gin (origins);

-- ############################################################
-- 6 bis. Sorties Jade : photo, adresse, participants, discussion de groupe, rencontres, badge
-- ############################################################
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

-- ############################################################
-- 6 ter. Sécurité : messages suspects signalés à l'administration
-- ############################################################
-- Jade : confiance et sécurité (étape 3)
-- À coller dans Supabase → SQL Editor → Run. Peut être relancé sans risque.
--
-- Ce que ça ajoute : chaque message qui parle d'argent, de virement, de cryptomonnaie,
-- ou qui propose de quitter Jade (WhatsApp, Telegram, numéro de téléphone…) est signalé
-- automatiquement à l'administration, dans « Messages suspects ». Le message est quand même envoyé.

create or replace function public.jade_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
grant execute on function public.jade_is_admin() to authenticated;

create table if not exists public.message_flags (
  id bigserial primary key,
  message_id bigint,
  from_id uuid references auth.users(id) on delete cascade,
  to_id uuid references auth.users(id) on delete cascade,
  reason text not null,               -- 'argent' ou 'contact'
  excerpt text,
  reviewed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists message_flags_idx on public.message_flags (reviewed, created_at desc);
alter table public.message_flags enable row level security;
revoke all on public.message_flags from anon, authenticated;

-- Mots qui font penser à une arnaque (argent) ou à une sortie de Jade (contact ailleurs)
create or replace function public.jade_flag_reason(t text) returns text
language plpgsql immutable as $$
declare s text := lower(coalesce(t, ''));
begin
  if s ~ '(argent|money|western union|moneygram|bitcoin|\mbtc\M|crypto|usdt|binance|gift ?card|carte cadeau|itunes|virement|\mwire\M|bank account|compte bancaire|\miban\M|paypal|invest|trading|forex|\mloan\M|prêt|billet d.avion|plane ticket|douane|customs|เงิน|โอน|ลงทุน|คริปโต|tiền|chuyển khoản|đầu tư|钱|汇款|转账|投资|比特币|uang|investasi|rekening|お金|送金|投資|돈|송금|투자|pelaburan|pera|padala|ເງິນ|ລົງທຶນ|លុយ|វិនិយោគ)' then
    return 'argent';
  end if;
  if s ~ '(whatsapp|whats app|telegram|wechat|weixin|微信|\mline id\M|kakao|viber|zalo|snapchat|signal app)'
     or s ~ '\+?[0-9][0-9 .\-]{7,}[0-9]'
     or s ~ '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' then
    return 'contact';
  end if;
  return null;
end $$;

create or replace function public.jade_flag_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare r text;
begin
  r := public.jade_flag_reason(new.body);
  if r is not null then
    insert into public.message_flags (message_id, from_id, to_id, reason, excerpt)
    values (new.id, new.from_id, new.to_id, r, left(new.body, 300));
  end if;
  return null;
exception when others then
  return null;   -- ne jamais bloquer l'envoi d'un message
end $$;
drop trigger if exists jade_flag_message on public.messages;
create trigger jade_flag_message after insert on public.messages
  for each row execute function public.jade_flag_message();

-- Pour l'administration : messages suspects à examiner, avec le nombre total d'alertes de l'expéditeur
create or replace function public.admin_message_flags(show_reviewed boolean default false)
returns table (id bigint, from_id uuid, from_name text, from_suspended boolean, to_name text, reason text, excerpt text,
               created_at timestamptz, total_flags integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.jade_is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  return query
    select f.id, f.from_id, pf.first_name, coalesce(pf.suspended, false), pt.first_name, f.reason, f.excerpt, f.created_at,
      (select count(*)::integer from public.message_flags g where g.from_id = f.from_id)
    from public.message_flags f
    left join public.profiles pf on pf.id = f.from_id
    left join public.profiles pt on pt.id = f.to_id
    where show_reviewed or not f.reviewed
    order by f.created_at desc
    limit 100;
end $$;
revoke all on function public.admin_message_flags(boolean) from public, anon;
grant execute on function public.admin_message_flags(boolean) to authenticated;

create or replace function public.admin_review_flags(sender uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.jade_is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  update public.message_flags set reviewed = true where from_id = sender and not reviewed;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.admin_review_flags(uuid) from public, anon;
grant execute on function public.admin_review_flags(uuid) to authenticated;

-- ############################################################
-- 6 quater. Réglages des abonnements (Administration)
-- ############################################################
-- Jade : réglages des abonnements, modifiables depuis l'Administration (étape 5)
-- À coller dans Supabase → SQL Editor → Run. Peut être relancé sans risque (il ne change pas tes réglages).
--
-- Ce que ça ajoute :
--  * une table de réglages : « tout gratuit » oui/non, qui paie (personne, les hommes, tout le monde),
--    et les liens de paiement Stripe — tout se change depuis l'Administration, sans toucher au code ;
--  * une colonne pour relier un membre à son client Stripe (utilisée par la fonction stripe-webhook).

create or replace function public.jade_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
grant execute on function public.jade_is_admin() to authenticated;

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
grant select on public.app_settings to anon, authenticated;
grant insert, update on public.app_settings to authenticated;
alter table public.app_settings enable row level security;
drop policy if exists "réglages : lire" on public.app_settings;
drop policy if exists "réglages : admin ajoute" on public.app_settings;
drop policy if exists "réglages : admin modifie" on public.app_settings;
create policy "réglages : lire" on public.app_settings for select to anon, authenticated using (true);
create policy "réglages : admin ajoute" on public.app_settings for insert to authenticated with check (public.jade_is_admin());
create policy "réglages : admin modifie" on public.app_settings for update to authenticated using (public.jade_is_admin()) with check (public.jade_is_admin());

-- Valeurs de départ (lancement : tout est gratuit), sans écraser ce qui existe déjà
insert into public.app_settings (key, value) values
  ('free_for_all', 'true'::jsonb),
  ('payers', '"hommes"'::jsonb),
  ('stripe_links', '{"premium": "", "gold": "", "diamond": "", "portal": ""}'::jsonb)
on conflict (key) do nothing;

-- Lien entre un membre et son client Stripe (rempli par la fonction stripe-webhook)
alter table public.profiles add column if not exists stripe_customer text;
alter table public.profiles add column if not exists plan text;
alter table public.profiles add column if not exists premium_until timestamptz;

-- ############################################################
-- 6 ter. Personnalité MBTI (16 types)
-- ############################################################
-- ---------- Personnalité ----------
alter table public.profiles add column if not exists mbti text;
alter table public.profiles drop constraint if exists profiles_mbti_check;
alter table public.profiles add constraint profiles_mbti_check check (mbti is null or mbti in (
  'INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP','ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP'));

-- Les membres peuvent enregistrer eux-mêmes leur personnalité et leurs origines
-- (dans Jade, les droits sur « profiles » sont donnés colonne par colonne)
grant insert (mbti, origins), update (mbti, origins) on public.profiles to authenticated;

-- ############################################################
-- 7. Mise en route et résumé
-- ############################################################
-- Annonce dans la messagerie de l'équipe Jade les activités à venir déjà publiées
insert into public.jade_notices (user_id, kind, title, event_id)
  select null, 'event', e.title, e.id from public.events e
  where not e.cancelled and e.starts_at > now()
    and not exists (select 1 from public.jade_notices n where n.event_id = e.id);

-- Résumé (et rappel photo envoyé aux membres qui n'ont pas de photo)
select
  (select count(*) from public.admins) as administrateurs,
  (select count(*) from public.events) as activites,
  (select count(*) from public.profiles) as membres,
  (select count(*) from public.profiles where coalesce(photo_path, '') = '') as membres_sans_photo,
  (select count(*) from public.profiles p where coalesce(p.photo_path, '') = '' and p.photo_warned_at is null and not p.is_team
     and public.jade_warn_no_photo(p.id)) as rappels_photo_envoyes;
