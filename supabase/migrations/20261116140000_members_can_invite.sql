-- Vanlige medlemmer kan lage invitasjonslenker, hvis flokken tillater det.
-- Admins kan slå det av under Innstillinger. Skrevet slik at den kan kjøres på nytt.

alter table public.groups add column if not exists members_can_invite boolean not null default true;

-- Kolonnen må kunne endres av admins (migrasjon 12 begrenser hvilke kolonner som kan endres)
grant update (name, description, visibility, tint, emoji, backdrop, members_can_invite) on public.groups to authenticated;

create or replace function public.can_invite(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_group_admin(gid)
    or (public.is_group_member(gid)
        and exists (select 1 from public.groups g where g.id = gid and g.members_can_invite));
$$;

revoke execute on function public.can_invite(uuid) from public, anon;
grant execute on function public.can_invite(uuid) to authenticated;

-- Admins styrer alle invitasjoner; medlemmer kan lage og se sine egne
drop policy if exists "invitations_member_insert" on public.group_invitations;
create policy "invitations_member_insert" on public.group_invitations
  for insert to authenticated
  with check (public.can_invite(group_id) and invited_by = auth.uid());

drop policy if exists "invitations_member_select_own" on public.group_invitations;
create policy "invitations_member_select_own" on public.group_invitations
  for select to authenticated
  using (invited_by = auth.uid() and public.is_group_member(group_id));
