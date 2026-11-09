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

-- ---------- Mise en route ----------
-- Annonce les activités à venir déjà publiées, puis prévient les membres sans photo.
insert into public.jade_notices (user_id, kind, title, event_id)
  select null, 'event', e.title, e.id from public.events e
  where not e.cancelled and e.starts_at > now()
    and not exists (select 1 from public.jade_notices n where n.event_id = e.id);
select
  (select count(*) from public.jade_notices where kind = 'event') as annonces_activites,
  count(*) filter (where public.jade_warn_no_photo(id)) as membres_sans_photo_prevenus
from public.profiles
where coalesce(photo_path, '') = '' and photo_warned_at is null and not is_team;
