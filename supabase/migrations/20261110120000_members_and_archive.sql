-- Fjerne medlemmer og arkivere/slette arrangementer.

-- ---------------------------------------------------------------------------
-- Fjerne medlemmer
-- ---------------------------------------------------------------------------
create or replace function public.is_group_owner(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid() and role = 'owner'
  );
$$;

grant execute on function public.is_group_owner(uuid) to anon, authenticated;

-- Før: et medlem kunne melde seg ut, og admin kunne fjerne hvem som helst (også eieren).
-- Nå:
--   * medlemmer og admins kan melde seg ut selv – eieren kan ikke (flokken ville stått uten eier)
--   * eieren kan fjerne alle andre
--   * admins kan fjerne vanlige medlemmer
drop policy "members_delete_self_or_admin" on public.group_members;

create policy "members_delete" on public.group_members
  for delete to authenticated
  using (
    (user_id = auth.uid() and role <> 'owner')
    or (user_id <> auth.uid() and public.is_group_owner(group_id))
    or (role = 'member' and public.is_group_admin(group_id))
  );

-- Rydd opp etter et medlem som forlater eller fjernes fra flokken
create or replace function public.handle_member_removed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Varsler fra flokken (de kan ikke lenger åpne dem)
  delete from public.notifications
  where user_id = old.user_id and group_id = old.group_id;

  -- Oppgaver blir ledige igjen
  update public.event_tasks t set assignee_id = null
  from public.events e
  where t.event_id = e.id and e.group_id = old.group_id and t.assignee_id = old.user_id;

  -- Stemmer på arrangementer som fortsatt planlegges teller ikke lenger
  delete from public.event_votes v
  using public.event_time_options o, public.events e
  where v.option_id = o.id and o.event_id = e.id
    and e.group_id = old.group_id and e.status = 'planning'
    and v.user_id = old.user_id;

  return old;
end;
$$;

revoke execute on function public.handle_member_removed() from public, anon, authenticated;

create trigger group_members_removed
  after delete on public.group_members
  for each row execute function public.handle_member_removed();

-- ---------------------------------------------------------------------------
-- Arkivering av arrangementer
-- ---------------------------------------------------------------------------
-- Arkiverte arrangementer skjules fra listene, men kan åpnes og gjenopprettes.
-- Arrangøren eller en admin kan arkivere (events_update gjelder allerede).
-- Sletting (events_delete) fjerner tidsforslag, stemmer, oppgaver, chat og varsler.
alter table public.events add column archived_at timestamptz;

create index events_group_active_idx on public.events (group_id, created_at desc) where archived_at is null;

-- Ingen nye tidsforslag på arkiverte arrangementer
create or replace function public.can_suggest_time(eid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.events e
    where e.id = eid
      and e.archived_at is null
      and public.is_group_member(e.group_id)
      and (
        public.can_manage_event(eid)
        or (e.allow_time_suggestions and e.status = 'planning')
      )
  );
$$;
