-- Jade : personnalité MBTI (16 types)
-- À coller dans Supabase → SQL Editor → Run. Peut être relancé sans risque.
-- Ajoute profiles.mbti : le type de personnalité choisi par le membre (facultatif),
-- et donne aux membres le droit de l'enregistrer (corrige « permission denied for table profiles »).

-- ---------- Personnalité ----------
alter table public.profiles add column if not exists mbti text;
alter table public.profiles drop constraint if exists profiles_mbti_check;
alter table public.profiles add constraint profiles_mbti_check check (mbti is null or mbti in (
  'INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP','ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP'));

-- Les membres peuvent enregistrer eux-mêmes leur personnalité et leurs origines
-- (dans Jade, les droits sur « profiles » sont donnés colonne par colonne)
grant insert (mbti, origins), update (mbti, origins) on public.profiles to authenticated;

select 'Personnalité : OK' as resultat;
