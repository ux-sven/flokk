-- Varsler i appen.
-- Databasetriggere lager varsler for medlemmene når noe skjer i en flokk,
-- slik at varsling ikke avhenger av hvilken klient som gjorde endringen.
-- Chat og stemmer slås sammen til ett ulest varsel per tråd (med teller),
-- så et livlig arrangement ikke fyller klokken.

create type public.notification_kind as enum (
  'event_created',   -- nytt arrangement i flokken
  'time_suggested',  -- nytt forslag til tidspunkt
  'vote',            -- noen har stemt (til arrangøren)
  'time_chosen',     -- tidspunkt er bestemt
  'event_cancelled', -- arrangementet er avlyst
  'task_assigned',   -- du har fått en oppgave
  'message'          -- ny melding i gruppe- eller arrangementschat
);

-- Varslingsnivå per medlem per flokk:
--   all       = alt, inkludert chat, stemmer og forslag
--   important = nye arrangementer, valgt tidspunkt, avlysning og egne oppgaver
--   none      = ingen varsler
create type public.notify_level as enum ('all', 'important', 'none');

alter table public.group_members
  add column notify_level public.notify_level not null default 'all';

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  event_id uuid references public.events (id) on delete cascade,
  kind public.notification_kind not null,
  actor_id uuid references public.profiles (id) on delete set null,
  data jsonb not null default '{}'::jsonb,
  count integer not null default 1,
  collapse_key text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, updated_at desc);
create unique index notifications_collapse_idx
  on public.notifications (user_id, collapse_key)
  where read_at is null and collapse_key is not null;

alter table public.notifications enable row level security;

create policy "notifications_select_own" on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy "notifications_update_own" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications_delete_own" on public.notifications
  for delete to authenticated using (user_id = auth.uid());

-- Brukeren kan bare markere som lest; varsler lages kun av triggerne
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ---------------------------------------------------------------------------
-- Hjelpefunksjon: send varsel til mottakere som ønsker denne typen
-- ---------------------------------------------------------------------------
create or replace function public.push_notification(
  recipients uuid[],
  gid uuid,
  eid uuid,
  nkind public.notification_kind,
  actor uuid,
  payload jsonb,
  ckey text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  min_all boolean := nkind in ('message', 'vote', 'time_suggested');
begin
  insert into public.notifications as n
    (user_id, group_id, event_id, kind, actor_id, data, collapse_key)
  select m.user_id, gid, eid, nkind, actor, coalesce(payload, '{}'::jsonb), ckey
  from public.group_members m
  where m.group_id = gid
    and m.user_id = any (recipients)
    and m.user_id is distinct from actor
    and m.notify_level <> 'none'
    and (not min_all or m.notify_level = 'all')
  on conflict (user_id, collapse_key) where read_at is null and collapse_key is not null
  do update set
    count = n.count + 1,
    actor_id = excluded.actor_id,
    data = excluded.data,
    updated_at = now();
end;
$$;

create or replace function public.group_member_ids(gid uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(user_id), '{}') from public.group_members where group_id = gid;
$$;

revoke execute on function public.push_notification(uuid[], uuid, uuid, public.notification_kind, uuid, jsonb, text)
  from public, anon, authenticated;
revoke execute on function public.group_member_ids(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Triggere
-- ---------------------------------------------------------------------------

-- Arrangementer: opprettet, tidspunkt valgt, avlyst
create or replace function public.notify_event_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := coalesce(auth.uid(), new.created_by);
  starts timestamptz;
begin
  if tg_op = 'INSERT' then
    perform public.push_notification(
      public.group_member_ids(new.group_id), new.group_id, new.id, 'event_created',
      new.created_by, jsonb_build_object('title', new.title), null);
    return new;
  end if;

  if new.chosen_option_id is not null
     and new.chosen_option_id is distinct from old.chosen_option_id then
    select starts_at into starts from public.event_time_options where id = new.chosen_option_id;
    perform public.push_notification(
      public.group_member_ids(new.group_id), new.group_id, new.id, 'time_chosen',
      actor, jsonb_build_object('title', new.title, 'starts_at', starts), null);
  end if;

  if new.status = 'cancelled' and old.status <> 'cancelled' then
    perform public.push_notification(
      public.group_member_ids(new.group_id), new.group_id, new.id, 'event_cancelled',
      actor, jsonb_build_object('title', new.title), null);
  end if;

  return new;
end;
$$;

create trigger events_notify
  after insert or update of chosen_option_id, status on public.events
  for each row execute function public.notify_event_change();

-- Nye tidsforslag. Tidspunktene som legges inn sammen med selve
-- arrangementet dekkes av «nytt arrangement»-varselet.
create or replace function public.notify_time_option()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ev public.events;
begin
  select * into ev from public.events where id = new.event_id;
  if new.created_at < ev.created_at + interval '2 minutes' then
    return new;
  end if;
  perform public.push_notification(
    public.group_member_ids(ev.group_id), ev.group_id, ev.id, 'time_suggested',
    coalesce(new.created_by, auth.uid()),
    jsonb_build_object('title', ev.title, 'starts_at', new.starts_at),
    'suggest:' || ev.id);
  return new;
end;
$$;

create trigger event_time_options_notify
  after insert on public.event_time_options
  for each row execute function public.notify_time_option();

-- Stemmer: arrangøren får ett samlet varsel
create or replace function public.notify_vote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ev public.events;
begin
  if tg_op = 'UPDATE' and new.answer = old.answer then
    return new;
  end if;
  select e.* into ev
  from public.event_time_options o join public.events e on e.id = o.event_id
  where o.id = new.option_id;
  perform public.push_notification(
    array[ev.created_by], ev.group_id, ev.id, 'vote', new.user_id,
    jsonb_build_object('title', ev.title), 'votes:' || ev.id);
  return new;
end;
$$;

create trigger event_votes_notify
  after insert or update of answer on public.event_votes
  for each row execute function public.notify_vote();

-- Oppgaver: den som får oppgaven varsles
create or replace function public.notify_task()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ev public.events;
begin
  if new.assignee_id is null
     or (tg_op = 'UPDATE' and new.assignee_id is not distinct from old.assignee_id) then
    return new;
  end if;
  select * into ev from public.events where id = new.event_id;
  perform public.push_notification(
    array[new.assignee_id], ev.group_id, ev.id, 'task_assigned',
    coalesce(auth.uid(), new.created_by),
    jsonb_build_object('title', ev.title, 'task', new.title), null);
  return new;
end;
$$;

create trigger event_tasks_notify
  after insert or update of assignee_id on public.event_tasks
  for each row execute function public.notify_task();

-- Chat: ett ulest varsel per tråd, med siste melding som forhåndsvisning
create or replace function public.notify_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ev_title text;
begin
  if new.event_id is not null then
    select title into ev_title from public.events where id = new.event_id;
  end if;
  perform public.push_notification(
    public.group_member_ids(new.group_id), new.group_id, new.event_id, 'message',
    new.author_id,
    jsonb_build_object('title', ev_title, 'preview', left(new.body, 140)),
    'chat:' || coalesce(new.event_id, new.group_id));
  return new;
end;
$$;

create trigger messages_notify
  after insert on public.messages
  for each row execute function public.notify_message();

revoke execute on function
  public.notify_event_change(),
  public.notify_time_option(),
  public.notify_vote(),
  public.notify_task(),
  public.notify_message()
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Eget varslingsnivå (medlemmer kan ikke oppdatere group_members direkte)
-- ---------------------------------------------------------------------------
create or replace function public.set_notify_level(gid uuid, level public.notify_level)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.group_members set notify_level = level
  where group_id = gid and user_id = auth.uid();
$$;

revoke execute on function public.set_notify_level(uuid, public.notify_level) from public, anon;
grant execute on function public.set_notify_level(uuid, public.notify_level) to authenticated;

alter publication supabase_realtime add table public.notifications;
