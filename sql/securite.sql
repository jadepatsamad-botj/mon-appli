-- Jade : confiance et sécurité (étape 3)
-- À coller dans Supabase → SQL Editor → Run. Peut être relancé sans risque.
--
-- Ce que ça ajoute : chaque message qui parle d'argent, de virement, de cryptomonnaie,
-- ou qui propose de quitter Jade (WhatsApp, Telegram, numéro de téléphone…) est signalé
-- automatiquement à l'administration, dans « Messages suspects ». Le message est quand même envoyé.

create or replace function public.jade_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
grant execute on function public.jade_is_admin() to authenticated;

create table if not exists public.message_flags (
  id bigserial primary key,
  message_id bigint,
  from_id uuid references auth.users(id) on delete cascade,
  to_id uuid references auth.users(id) on delete cascade,
  reason text not null,               -- 'argent' ou 'contact'
  excerpt text,
  reviewed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists message_flags_idx on public.message_flags (reviewed, created_at desc);
alter table public.message_flags enable row level security;
revoke all on public.message_flags from anon, authenticated;

-- Mots qui font penser à une arnaque (argent) ou à une sortie de Jade (contact ailleurs)
create or replace function public.jade_flag_reason(t text) returns text
language plpgsql immutable as $$
declare s text := lower(coalesce(t, ''));
begin
  if s ~ '(argent|money|western union|moneygram|bitcoin|\mbtc\M|crypto|usdt|binance|gift ?card|carte cadeau|itunes|virement|\mwire\M|bank account|compte bancaire|\miban\M|paypal|invest|trading|forex|\mloan\M|prêt|billet d.avion|plane ticket|douane|customs|เงิน|โอน|ลงทุน|คริปโต|tiền|chuyển khoản|đầu tư|钱|汇款|转账|投资|比特币|uang|investasi|rekening|お金|送金|投資|돈|송금|투자|pelaburan|pera|padala|ເງິນ|ລົງທຶນ|លុយ|វិនិយោគ)' then
    return 'argent';
  end if;
  if s ~ '(whatsapp|whats app|telegram|wechat|weixin|微信|\mline id\M|kakao|viber|zalo|snapchat|signal app)'
     or s ~ '\+?[0-9][0-9 .\-]{7,}[0-9]'
     or s ~ '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' then
    return 'contact';
  end if;
  return null;
end $$;

create or replace function public.jade_flag_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare r text;
begin
  r := public.jade_flag_reason(new.body);
  if r is not null then
    insert into public.message_flags (message_id, from_id, to_id, reason, excerpt)
    values (new.id, new.from_id, new.to_id, r, left(new.body, 300));
  end if;
  return null;
exception when others then
  return null;   -- ne jamais bloquer l'envoi d'un message
end $$;
drop trigger if exists jade_flag_message on public.messages;
create trigger jade_flag_message after insert on public.messages
  for each row execute function public.jade_flag_message();

-- Pour l'administration : messages suspects à examiner, avec le nombre total d'alertes de l'expéditeur
create or replace function public.admin_message_flags(show_reviewed boolean default false)
returns table (id bigint, from_id uuid, from_name text, from_suspended boolean, to_name text, reason text, excerpt text,
               created_at timestamptz, total_flags integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.jade_is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  return query
    select f.id, f.from_id, pf.first_name, coalesce(pf.suspended, false), pt.first_name, f.reason, f.excerpt, f.created_at,
      (select count(*)::integer from public.message_flags g where g.from_id = f.from_id)
    from public.message_flags f
    left join public.profiles pf on pf.id = f.from_id
    left join public.profiles pt on pt.id = f.to_id
    where show_reviewed or not f.reviewed
    order by f.created_at desc
    limit 100;
end $$;
revoke all on function public.admin_message_flags(boolean) from public, anon;
grant execute on function public.admin_message_flags(boolean) to authenticated;

create or replace function public.admin_review_flags(sender uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.jade_is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  update public.message_flags set reviewed = true where from_id = sender and not reviewed;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.admin_review_flags(uuid) from public, anon;
grant execute on function public.admin_review_flags(uuid) to authenticated;

select 'Sécurité : OK' as resultat;
