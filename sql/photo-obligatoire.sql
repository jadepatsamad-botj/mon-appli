-- Jade : photo obligatoire
-- À coller dans Supabase → SQL Editor → Run (peut être relancé sans risque, il remplace l'ancienne version).
--
-- Ce que ça fait :
--  * L'équipe Jade est reconnue automatiquement par son e-mail : equipe@jadedating.app
--    (son compte est confirmé, marqué « équipe » et caché de l'Accueil des membres).
--  * Jade repère directement dans la base les membres sans photo et leur écrit dans Messages :
--      - tout de suite pour les membres déjà inscrits (à la fin de ce fichier),
--      - puis automatiquement dès qu'un profil se retrouve sans photo.
--  * Dans l'appli, un membre sans photo est mis en pause tout de suite : il ne peut plus que
--    modifier son profil, jusqu'à ce qu'il ajoute une photo.
--
-- Avant de lancer ce fichier, créez le compte de l'équipe :
-- Authentication → Users → Add user → equipe@jadedating.app, puis complétez son profil sur jadedating.app.

alter table public.profiles add column if not exists photo_warned_at timestamptz;
alter table public.profiles add column if not exists is_team boolean not null default false;
alter table public.profiles add column if not exists hidden boolean not null default false;

-- L'équipe Jade : le compte dont l'e-mail est equipe@jadedating.app
create or replace function public.jade_team_id() returns uuid
language sql stable security definer set search_path = public, auth as $$
  select coalesce(
    (select u.id from auth.users u join public.profiles p on p.id = u.id
      where lower(u.email) = 'equipe@jadedating.app' limit 1),
    (select id from public.profiles where is_team limit 1));
$$;
revoke all on function public.jade_team_id() from public, anon;
grant execute on function public.jade_team_id() to authenticated;

-- Le message envoyé par l'équipe Jade (en français et en anglais)
create or replace function public.jade_photo_message() returns text
language sql immutable as $$
  select 'Bonjour, ici l''équipe Jade. Votre profil n''a pas encore de photo. Sur Jade, au moins une photo de vous est obligatoire, pour que les autres membres puissent vous reconnaître. Votre accès à Jade est en pause jusqu''à l''ajout d''une photo dans « Modifier mon profil ». Merci !'
    || E'\n\n'
    || 'Hello, this is the Jade team. Your profile does not have a photo yet. At least one photo of yourself is required on Jade, so other members can recognise you. Your access to Jade is paused until you add a photo in « Edit my profile ». Thank you!'
$$;

-- Écrit au membre (une seule fois) ; renvoie vrai si le message est parti
create or replace function public.jade_warn_no_photo(uid uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare team uuid := public.jade_team_id();
begin
  if team is null or team = uid then return false; end if;
  if exists (select 1 from public.profiles where id = uid
             and (coalesce(photo_path, '') <> '' or photo_warned_at is not null or is_team)) then
    return false;
  end if;
  insert into public.messages (from_id, to_id, body) values (team, uid, public.jade_photo_message());
  update public.profiles set photo_warned_at = now() where id = uid;
  return true;
exception when others then
  return false;
end $$;
revoke all on function public.jade_warn_no_photo(uuid) from public, anon, authenticated;

-- Avant chaque enregistrement de profil : un membre ne peut pas modifier lui-même ces colonnes,
-- et l'avertissement s'efface dès qu'il a une photo.
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

-- Le compte de l'équipe (reconnu par son e-mail) reste marqué « équipe » et caché de l'Accueil
-- (les déclencheurs passent par ordre alphabétique : celui-ci après le précédent)
create or replace function public.jade_team_flags() returns trigger
language plpgsql security definer set search_path = public, auth as $$
begin
  if exists (select 1 from auth.users where id = new.id and lower(email) = 'equipe@jadedating.app') then
    new.is_team := true; new.hidden := true;
  end if;
  return new;
end $$;
drop trigger if exists jade_team_flags on public.profiles;
create trigger jade_team_flags before insert or update on public.profiles
  for each row execute function public.jade_team_flags();

-- Après chaque enregistrement : si le profil n'a pas de photo, l'équipe Jade écrit tout de suite
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

-- Appelée par l'appli à chaque connexion (filet de sécurité) : pause sans photo, message si pas encore envoyé
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

-- Bouton « Prévenir les profils sans photo » de la page Administration
create or replace function public.jade_photo_sweep() returns integer
language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0;
begin
  if not exists (select 1 from public.admins where user_id = auth.uid()) then
    raise exception 'Réservé aux administrateurs';
  end if;
  if public.jade_team_id() is null then
    raise exception 'Le compte equipe@jadedating.app n''existe pas encore (ou n''a pas de profil)';
  end if;
  for r in select id from public.profiles where coalesce(photo_path, '') = '' and photo_warned_at is null and not is_team loop
    if public.jade_warn_no_photo(r.id) then n := n + 1; end if;
  end loop;
  return n;
end $$;
revoke all on function public.jade_photo_sweep() from public, anon;
grant execute on function public.jade_photo_sweep() to authenticated;

-- ============================================================================================
-- Mise en route : confirme le compte de l'équipe, le marque, puis prévient tout de suite
-- les membres déjà inscrits sans photo. Le résultat affiche ce qui a été trouvé et fait.
-- ============================================================================================
update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now())
  where lower(email) = 'equipe@jadedating.app';
update public.profiles set is_team = true, hidden = true
  where id = (select id from auth.users where lower(email) = 'equipe@jadedating.app');
select
  (select count(*) from public.profiles where is_team) as compte_equipe_trouve,
  count(*) filter (where public.jade_warn_no_photo(id)) as membres_prevenus
from public.profiles
where coalesce(photo_path, '') = '' and photo_warned_at is null and not is_team;
