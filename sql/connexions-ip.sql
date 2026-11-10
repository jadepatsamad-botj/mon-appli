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
