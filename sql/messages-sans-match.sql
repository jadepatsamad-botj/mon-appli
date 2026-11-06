-- Jade : pouvoir écrire à n'importe quel membre (plus besoin de match), comme sur Seeking.
-- À coller une fois dans Supabase > SQL Editor > New query, puis « Run ». On peut le relancer sans risque.
--
-- Cette règle s'AJOUTE aux règles existantes (elle n'en supprime aucune) :
--   • on écrit toujours en son propre nom
--   • pas à soi-même, pas à un compte suspendu
--   • pas si l'un des deux a bloqué l'autre

drop policy if exists "messages : écrire à tout membre" on public.messages;
create policy "messages : écrire à tout membre" on public.messages for insert to authenticated
  with check (
    from_id = auth.uid()
    and to_id <> auth.uid()
    and exists (select 1 from public.profiles p where p.id = to_id and coalesce(p.suspended, false) = false)
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = to_id)
         or (b.blocker_id = to_id and b.blocked_id = auth.uid())
    )
  );

-- Contrôle : affiche les règles et les déclencheurs de la table messages.
-- Si l'envoi reste refusé, envoie une capture de ce résultat à Claude.
select 'règle' as type, policyname as nom, permissive as mode, cmd as action from pg_policies where schemaname = 'public' and tablename = 'messages'
union all
select 'déclencheur', tgname, '', '' from pg_trigger where tgrelid = 'public.messages'::regclass and not tgisinternal;
