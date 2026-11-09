-- Eksplisitte rettigheter for Data API-rollene.
-- Nye Supabase-prosjekter kan ha automatisk eksponering av tabeller slått av;
-- denne migrasjonen gjør oppsettet uavhengig av det. RLS styrer fortsatt
-- hvilke rader hver bruker får se og endre.

grant usage on schema public to anon, authenticated;

-- Utloggede kan kun lese grupper (RLS begrenser til åpne grupper)
grant select on public.groups to anon;

grant select, insert, update, delete on
  public.profiles,
  public.groups,
  public.group_members,
  public.group_invitations,
  public.events,
  public.event_time_options,
  public.event_votes,
  public.event_tasks,
  public.messages
to authenticated;

-- Trigger-funksjoner skal ikke kunne kalles via API
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_new_group() from public, anon, authenticated;

-- RPC-er
revoke execute on function public.accept_invitation(text) from public, anon;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.get_invitation(text) to anon, authenticated;

-- Hjelpefunksjoner brukt i RLS-policyer (må kunne kjøres av rollene)
grant execute on function
  public.is_group_member(uuid),
  public.is_group_admin(uuid),
  public.event_group_id(uuid),
  public.option_group_id(uuid),
  public.can_manage_event(uuid)
to anon, authenticated;
