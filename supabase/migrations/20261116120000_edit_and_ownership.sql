-- Redigering av flokk og arrangement, overføring av eierskap og sletting av flokk.
-- Strammer samtidig inn hvilke kolonner som kan endres direkte via API-et.
-- Skrevet slik at den kan kjøres på nytt.

-- ---------------------------------------------------------------------------
-- Flokker: admins kan endre navn, beskrivelse, synlighet og utseende.
-- Før kunne en admin også endre created_by (og dermed slette flokken).
-- ---------------------------------------------------------------------------
revoke update on public.groups from authenticated;
grant update (name, description, visibility, tint, emoji, backdrop) on public.groups to authenticated;

-- Bare eieren kan slette flokken (rollen, ikke hvem som opprettet den)
drop policy if exists "groups_delete_owner" on public.groups;
create policy "groups_delete_owner" on public.groups
  for delete to authenticated using (public.is_group_owner(id));

-- ---------------------------------------------------------------------------
-- Medlemskap: før kunne en admin gjøre seg selv til eier, eller degradere eieren.
-- Nå kan bare eieren endre roller (medlem ↔ admin), og aldri til/fra «owner».
-- Eierskap flyttes kun med transfer_group_ownership under.
-- Varslingsnivå endres via set_notify_level (security definer).
-- ---------------------------------------------------------------------------
revoke update on public.group_members from authenticated;
grant update (role) on public.group_members to authenticated;

drop policy if exists "members_update_admin" on public.group_members;
drop policy if exists "members_update_owner" on public.group_members;
create policy "members_update_owner" on public.group_members
  for update to authenticated
  using (public.is_group_owner(group_id) and user_id <> auth.uid() and role <> 'owner')
  with check (role <> 'owner');

-- ---------------------------------------------------------------------------
-- Arrangementer: arrangør/admin kan endre innhold og status, men ikke flytte
-- arrangementet til en annen flokk eller bytte arrangør.
-- ---------------------------------------------------------------------------
revoke update on public.events from authenticated;
grant update (
  title, description, location, location_lat, location_lng, status,
  chosen_option_id, vote_deadline, allow_time_suggestions, archived_at, backdrop
) on public.events to authenticated;

-- ---------------------------------------------------------------------------
-- Overføre eierskap til et annet medlem. Den gamle eieren blir admin.
-- ---------------------------------------------------------------------------
create or replace function public.transfer_group_ownership(gid uuid, new_owner uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_group_owner(gid) then
    raise exception 'Bare eieren kan overføre eierskapet';
  end if;
  if new_owner = auth.uid() then
    raise exception 'Du er allerede eier';
  end if;
  if not exists (select 1 from public.group_members where group_id = gid and user_id = new_owner) then
    raise exception 'Personen er ikke medlem av flokken';
  end if;

  update public.group_members set role = 'admin' where group_id = gid and user_id = auth.uid();
  update public.group_members set role = 'owner' where group_id = gid and user_id = new_owner;
  update public.groups set created_by = new_owner where id = gid;
end;
$$;

revoke execute on function public.transfer_group_ownership(uuid, uuid) from public, anon;
grant execute on function public.transfer_group_ownership(uuid, uuid) to authenticated;
