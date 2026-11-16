-- Slett egen konto (kreves av App Store og Google Play, og av GDPR).
-- Skrevet slik at den kan kjøres på nytt.
--
-- Hva skjer:
--   * Er du eier av en flokk med andre medlemmer, må eierskapet overføres først.
--   * Flokker der du er eneste medlem slettes (med arrangementer, chat osv.).
--   * Arrangementer og oppgaver du har laget i andres flokker blir stående,
--     men eieren av flokken står som arrangør.
--   * Invitasjonslenker du har laget slettes.
--   * Profil, medlemskap, stemmer, meldinger, varsler og push-tokens slettes
--     (on delete cascade fra auth.users → profiles).

create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  blocking text;
begin
  if uid is null then
    raise exception 'Du må være innlogget';
  end if;

  select string_agg(g.name, ', ' order by g.name) into blocking
  from public.group_members m
  join public.groups g on g.id = m.group_id
  where m.user_id = uid and m.role = 'owner'
    and exists (select 1 from public.group_members o where o.group_id = m.group_id and o.user_id <> uid);
  if blocking is not null then
    raise exception 'Overfør eierskapet først: %', blocking using errcode = 'P0001';
  end if;

  -- Flokker der du er alene
  delete from public.groups g
  where exists (select 1 from public.group_members m where m.group_id = g.id and m.user_id = uid and m.role = 'owner');

  -- Det du har laget i andres flokker overtas av eieren av flokken
  update public.events e set created_by = (
    select m.user_id from public.group_members m where m.group_id = e.group_id and m.role = 'owner' limit 1
  )
  where e.created_by = uid;

  update public.event_tasks t set created_by = (
    select m.user_id from public.events e
    join public.group_members m on m.group_id = e.group_id and m.role = 'owner'
    where e.id = t.event_id limit 1
  )
  where t.created_by = uid;

  update public.groups g set created_by = (
    select m.user_id from public.group_members m where m.group_id = g.id and m.role = 'owner' limit 1
  )
  where g.created_by = uid;

  delete from public.group_invitations where invited_by = uid;

  -- Selve kontoen; resten følger med via on delete cascade
  delete from auth.users where id = uid;
end;
$$;

revoke execute on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;

-- /personvern er personvernerklæringen – reserver adressen for flokker
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'groups_slug_not_reserved_privacy') then
    alter table public.groups
      add constraint groups_slug_not_reserved_privacy check (slug not in ('personvern', 'vilkar', 'kontakt'));
  end if;
end $$;
