-- Jade : personnalité MBTI (16 types)
-- À coller dans Supabase → SQL Editor → Run. Peut être relancé sans risque.
-- Ajoute profiles.mbti : le type de personnalité choisi par le membre (facultatif).

-- ---------- Personnalité ----------
alter table public.profiles add column if not exists mbti text;
alter table public.profiles drop constraint if exists profiles_mbti_check;
alter table public.profiles add constraint profiles_mbti_check check (mbti is null or mbti in (
  'INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP','ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP'));

select 'Personnalité : OK' as resultat;
