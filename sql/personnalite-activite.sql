-- Jade : personnalité MBTI (16 types) et temps d'activité du jour
-- À coller dans Supabase → SQL Editor → Run. Peut être relancé sans risque.
--
-- Ce que ça ajoute :
--  * profiles.mbti : le type de personnalité choisi par le membre (facultatif) ;
--  * profiles.active_day / active_min : les minutes d'activité du jour (heure de Paris),
--    affichées « Actif aujourd'hui · 2 h 15 ». Seule la fonction jade_activity_ping peut les modifier.

-- ---------- Personnalité ----------
alter table public.profiles add column if not exists mbti text;
alter table public.profiles drop constraint if exists profiles_mbti_check;
alter table public.profiles add constraint profiles_mbti_check check (mbti is null or mbti in (
  'INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP','ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP'));

-- ---------- Temps d'activité du jour ----------
alter table public.profiles add column if not exists active_day date;
alter table public.profiles add column if not exists active_min integer not null default 0;
alter table public.profiles add column if not exists active_ping_at timestamptz;

-- Un membre ne peut pas modifier lui-même son compteur
create or replace function public.jade_protect_activity() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.active_day := null; new.active_min := 0; new.active_ping_at := null;
    else
      new.active_day := old.active_day; new.active_min := old.active_min; new.active_ping_at := old.active_ping_at;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists jade_protect_activity on public.profiles;
create trigger jade_protect_activity before insert or update on public.profiles
  for each row execute function public.jade_protect_activity();

-- Appelée par l'appli toutes les 2 minutes quand le membre l'utilise vraiment.
-- Au plus 5 minutes ajoutées par appel, et pas plus d'un appel compté toutes les 90 secondes.
create or replace function public.jade_activity_ping(add_min integer default 2) returns integer
language plpgsql security definer set search_path = public as $$
declare
  today date := (now() at time zone 'Europe/Paris')::date;
  step integer := least(greatest(coalesce(add_min, 0), 0), 5);
  n integer;
begin
  if auth.uid() is null then return 0; end if;
  update public.profiles set
    active_min = least(case when active_day = today then active_min else 0 end + step, 1440),
    active_day = today,
    active_ping_at = now(),
    last_seen = now()
  where id = auth.uid()
    and (active_ping_at is null or active_ping_at < now() - interval '90 seconds')
  returning active_min into n;
  if n is null then select case when active_day = today then active_min else 0 end into n from public.profiles where id = auth.uid(); end if;
  return coalesce(n, 0);
end $$;
revoke all on function public.jade_activity_ping(integer) from public, anon;
grant execute on function public.jade_activity_ping(integer) to authenticated;

select 'Personnalité et temps d''activité : OK' as resultat;
