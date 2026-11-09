-- Jade : photo obligatoire
-- À coller une seule fois dans Supabase → SQL Editor → Run.
--
-- Ce que ça fait :
--  * Un membre sans photo voit son accès à Jade mis en pause tout de suite :
--    il ne peut plus que modifier son profil, jusqu'à ce qu'il ajoute une photo.
--  * Il reçoit aussi un message de « l'équipe Jade » dans Messages.
--  * Ce fichier peut être relancé sans risque (il remplace l'ancienne version).
--  * L'équipe Jade est un compte normal de l'appli, marqué is_team = true (voir tout en bas).

alter table public.profiles add column if not exists photo_warned_at timestamptz;
alter table public.profiles add column if not exists is_team boolean not null default false;

-- Un membre ne peut pas modifier lui-même ces deux colonnes (seulement Supabase et les fonctions ci-dessous)
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
  return new;
end $$;
drop trigger if exists jade_protect_photo_cols on public.profiles;
create trigger jade_protect_photo_cols before insert or update on public.profiles
  for each row execute function public.jade_protect_photo_cols();

-- Le message envoyé par l'équipe Jade (en français et en anglais)
create or replace function public.jade_photo_message() returns text
language sql immutable as $$
  select 'Bonjour, ici l''équipe Jade. Votre profil n''a pas encore de photo. Sur Jade, au moins une photo de vous est obligatoire, pour que les autres membres puissent vous reconnaître. Votre accès à Jade est en pause jusqu''à l''ajout d''une photo dans « Modifier mon profil ». Merci !'
    || E'\n\n'
    || 'Hello, this is the Jade team. Your profile does not have a photo yet. At least one photo of yourself is required on Jade, so other members can recognise you. Your access to Jade is paused until you add a photo in « Edit my profile ». Thank you!'
$$;

-- Appelée par l'appli à chaque connexion : pause immédiate sans photo, message de l'équipe Jade une seule fois
create or replace function public.jade_photo_check() returns json
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  team uuid;
  p public.profiles%rowtype;
  sent boolean := false;
begin
  if me is null then return null; end if;
  select * into p from public.profiles where id = me;
  if not found then return null; end if;

  -- Il a une photo : tout va bien (et on efface l'ancien avertissement)
  if coalesce(p.photo_path, '') <> '' then
    if p.photo_warned_at is not null then
      update public.profiles set photo_warned_at = null where id = me;
    end if;
    return json_build_object('warned', false, 'locked', false);
  end if;
  if p.is_team then return json_build_object('warned', false, 'locked', false); end if;

  -- Pas de photo, pas encore prévenu : message de l'équipe Jade
  if p.photo_warned_at is null then
    select id into team from public.profiles where is_team limit 1;
    if team is not null and team <> me then
      begin
        insert into public.messages (from_id, to_id, body) values (team, me, public.jade_photo_message());
        sent := true;
      exception when others then sent := false;
      end;
    end if;
    update public.profiles set photo_warned_at = now() where id = me;
    return json_build_object('warned', sent, 'locked', true);
  end if;

  -- Déjà prévenu : toujours en pause tant qu'il n'y a pas de photo
  return json_build_object('warned', false, 'locked', true);
end $$;
revoke all on function public.jade_photo_check() from public, anon;
grant execute on function public.jade_photo_check() to authenticated;

-- Bouton « Prévenir les profils sans photo » de la page Administration
create or replace function public.jade_photo_sweep() returns integer
language plpgsql security definer set search_path = public as $$
declare
  team uuid;
  r record;
  n integer := 0;
begin
  if not exists (select 1 from public.admins where user_id = auth.uid()) then
    raise exception 'Réservé aux administrateurs';
  end if;
  select id into team from public.profiles where is_team limit 1;
  if team is null then
    raise exception 'Aucun compte « Équipe Jade » : lancez d''abord la dernière étape de ce fichier';
  end if;
  for r in
    select id from public.profiles
    where coalesce(photo_path, '') = '' and photo_warned_at is null and not is_team and coalesce(suspended, false) = false
  loop
    insert into public.messages (from_id, to_id, body) values (team, r.id, public.jade_photo_message());
    update public.profiles set photo_warned_at = now() where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.jade_photo_sweep() from public, anon;
grant execute on function public.jade_photo_sweep() to authenticated;

-- ============================================================================================
-- DERNIÈRE ÉTAPE : désigner le compte « Équipe Jade »
-- 1. Créez un compte normal sur jadedating.app (prénom « Équipe Jade », photo = le logo Jade).
-- 2. Remplacez l'adresse ci-dessous par l'e-mail de ce compte, puis lancez ces lignes.
--    (hidden = true : le compte de l'équipe n'apparaît pas dans l'Accueil des membres.)
-- ============================================================================================
-- update public.profiles set is_team = true, hidden = true
-- where id = (select id from auth.users where email = 'EMAIL-DU-COMPTE-EQUIPE@exemple.com');
