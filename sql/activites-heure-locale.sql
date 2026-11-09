-- Jade : activités à l'heure du lieu
-- À coller dans Supabase → SQL Editor → Run (une fois).
-- Enregistre le fuseau horaire du lieu de chaque activité (ex. Asia/Bangkok),
-- pour que les membres voient la date et l'heure sur place.
alter table public.events add column if not exists tz text;
