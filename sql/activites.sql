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

-- Résultat : vérifie que tout est en place (et si vous êtes bien administrateur, voir ci-dessous)
select
  (select count(*) from public.events) as activites,
  (select count(*) from public.admins) as administrateurs;
