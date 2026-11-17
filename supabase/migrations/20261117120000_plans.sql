-- Flokk Pluss: gratisgrenser og hvem som har betalt.
-- Skrevet slik at den kan kjøres på nytt.
--
-- Gratis:                         Pluss:
--   * eie inntil 3 flokker          ubegrenset
--   * inntil 8 medlemmer per flokk  ubegrenset
--   * 1 kommende arrangement        ubegrenset
--     per flokk om gangen
--
-- Det er eieren av flokken som har Pluss; da gjelder det alle flokkene eieren har.
-- Grensene sjekkes bare når noe nytt legges til, så flokker som allerede er over
-- grensen får beholde det de har.
--
-- Pluss gis foreløpig manuelt (se docs/flokk-pluss.md). Senere skriver
-- betalingsløsningen (RevenueCat) til user_plans via en Edge Function.

create table if not exists public.user_plans (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  plan text not null default 'plus' check (plan in ('plus')),
  source text not null default 'manual' check (source in ('manual', 'app_store', 'play_store', 'stripe')),
  -- null = livstid
  expires_at timestamptz,
  note text,
  updated_at timestamptz not null default now()
);

alter table public.user_plans enable row level security;

-- Brukeren kan se sin egen plan; bare service role (betalingsløsningen) og SQL Editor kan endre
drop policy if exists "user_plans_select_own" on public.user_plans;
create policy "user_plans_select_own" on public.user_plans
  for select to authenticated using (user_id = auth.uid());
revoke all on public.user_plans from anon, authenticated;
grant select on public.user_plans to authenticated;

-- ---------------------------------------------------------------------------
-- Hjelpefunksjoner
-- ---------------------------------------------------------------------------

-- Gratisgrensene, samlet ett sted
create or replace function public.plan_limit(kind text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case kind
    when 'groups' then 3
    when 'members' then 8
    when 'upcoming_events' then 1
  end;
$$;

create or replace function public.has_plus(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_plans p
    where p.user_id = uid and (p.expires_at is null or p.expires_at > now())
  );
$$;

create or replace function public.group_owner_id(gid uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select user_id from public.group_members where group_id = gid and role = 'owner' limit 1;
$$;

-- Kommende arrangementer: ikke arkivert eller avlyst, og enten valgt tidspunkt som ikke er
-- passert (6 timer etter start, som i appene), eller avstemning med minst ett forslag som
-- ikke er passert. Et arrangement uten forslag regnes som kommende.
create or replace function public.upcoming_event_count(gid uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.events e
  where e.group_id = gid
    and e.archived_at is null
    and e.status <> 'cancelled'
    and case
      when e.chosen_option_id is not null then exists (
        select 1 from public.event_time_options o
        where o.id = e.chosen_option_id and o.starts_at > now() - interval '6 hours')
      else (
        not exists (select 1 from public.event_time_options o where o.event_id = e.id)
        or exists (
          select 1 from public.event_time_options o
          where o.event_id = e.id and o.starts_at > now() - interval '6 hours'))
    end;
$$;

revoke execute on function public.has_plus(uuid), public.group_owner_id(uuid), public.upcoming_event_count(uuid)
  from public, anon;
grant execute on function public.has_plus(uuid), public.group_owner_id(uuid), public.upcoming_event_count(uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Grensene (triggere). Feilene har hint «plan_limit:<type>» så appene kan vise
-- en tydelig melding og etter hvert en knapp for å oppgradere.
-- ---------------------------------------------------------------------------

-- Flokker du eier
create or replace function public.enforce_group_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.has_plus(new.created_by) then
    return new;
  end if;
  if (select count(*) from public.group_members m
      where m.user_id = new.created_by and m.role = 'owner') >= public.plan_limit('groups') then
    raise exception 'Gratisversjonen lar deg eie % flokker. Med Flokk Pluss kan du lage så mange du vil.',
      public.plan_limit('groups')
      using errcode = 'P0001', hint = 'plan_limit:groups';
  end if;
  return new;
end;
$$;

drop trigger if exists groups_plan_limit on public.groups;
create trigger groups_plan_limit
  before insert on public.groups
  for each row execute function public.enforce_group_limit();

-- Medlemmer per flokk
create or replace function public.enforce_member_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
begin
  -- Eieren legges til når flokken lages
  if new.role = 'owner' then
    return new;
  end if;
  -- Allerede medlem: la «on conflict do nothing» i accept_invitation ta seg av det
  if exists (select 1 from public.group_members m where m.group_id = new.group_id and m.user_id = new.user_id) then
    return new;
  end if;
  owner := public.group_owner_id(new.group_id);
  if owner is not null and public.has_plus(owner) then
    return new;
  end if;
  if (select count(*) from public.group_members m where m.group_id = new.group_id) >= public.plan_limit('members') then
    raise exception 'Flokken er full. Gratisversjonen har plass til % medlemmer – eieren kan oppgradere til Flokk Pluss.',
      public.plan_limit('members')
      using errcode = 'P0001', hint = 'plan_limit:members';
  end if;
  return new;
end;
$$;

drop trigger if exists group_members_plan_limit on public.group_members;
create trigger group_members_plan_limit
  before insert on public.group_members
  for each row execute function public.enforce_member_limit();

-- Kommende arrangementer per flokk
create or replace function public.enforce_event_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
begin
  owner := public.group_owner_id(new.group_id);
  if owner is not null and public.has_plus(owner) then
    return new;
  end if;
  if public.upcoming_event_count(new.group_id) >= public.plan_limit('upcoming_events') then
    raise exception 'Gratisversjonen har ett kommende arrangement om gangen. Med Flokk Pluss kan flokken planlegge så mye den vil.'
      using errcode = 'P0001', hint = 'plan_limit:upcoming_events';
  end if;
  return new;
end;
$$;

drop trigger if exists events_plan_limit on public.events;
create trigger events_plan_limit
  before insert on public.events
  for each row execute function public.enforce_event_limit();

revoke execute on function public.enforce_group_limit(), public.enforce_member_limit(), public.enforce_event_limit()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Status til appene
-- ---------------------------------------------------------------------------

-- Din plan og hvor mange flokker du eier
create or replace function public.my_plan()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'plus', public.has_plus(auth.uid()),
    'source', (select source from public.user_plans where user_id = auth.uid()),
    'expires_at', (select expires_at from public.user_plans where user_id = auth.uid()),
    'owned_groups', (select count(*) from public.group_members where user_id = auth.uid() and role = 'owner'),
    'max_groups', public.plan_limit('groups')
  );
$$;

-- Grensene for én flokk (bare for medlemmer). max_* er null når eieren har Pluss.
create or replace function public.group_plan(gid uuid)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  plus boolean;
begin
  if not public.is_group_member(gid) then
    return null;
  end if;
  plus := public.has_plus(public.group_owner_id(gid));
  return json_build_object(
    'plus', plus,
    'members', (select count(*) from public.group_members where group_id = gid),
    'max_members', case when plus then null else public.plan_limit('members') end,
    'upcoming_events', public.upcoming_event_count(gid),
    'max_upcoming_events', case when plus then null else public.plan_limit('upcoming_events') end
  );
end;
$$;

revoke execute on function public.my_plan(), public.group_plan(uuid) from public, anon;
grant execute on function public.my_plan(), public.group_plan(uuid) to authenticated;
