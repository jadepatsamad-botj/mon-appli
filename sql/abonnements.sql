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

select key, value from public.app_settings order by key;
