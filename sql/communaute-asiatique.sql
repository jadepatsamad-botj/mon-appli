-- Jade : communauté asiatique de France et d'Europe
-- À coller dans Supabase → SQL Editor → Run. Peut être relancé sans risque.
-- Ajoute les origines de chaque membre (Chine, Vietnam, Cambodge…), affichées sur le profil
-- et utilisables dans les filtres de l'Accueil.
alter table public.profiles add column if not exists origins text[] not null default '{}';
create index if not exists profiles_origins_idx on public.profiles using gin (origins);
