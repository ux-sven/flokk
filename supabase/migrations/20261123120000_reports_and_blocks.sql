-- Rapportering og blokkering (App Store-retningslinje 1.2 for brukerinnhold).
-- Skrevet slik at den kan kjøres på nytt.
--
--   * Blokkering: du ser ikke lenger meldingene til den du har blokkert, og får ikke
--     varsler om det vedkommende gjør. Den blokkerte får ikke vite det.
--   * Rapportering: en melding eller en bruker kan rapporteres. Rapporten lagrer en kopi
--     av meldingen, så den finnes selv om meldingen slettes. Rapporter behandles av
--     utvikleren (se docs/moderering.md) – Apple forventer svar innen 24 timer.

-- ---------------------------------------------------------------------------
-- Blokkering
-- ---------------------------------------------------------------------------
create table if not exists public.user_blocks (
  blocker_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.user_blocks enable row level security;

drop policy if exists "user_blocks_select_own" on public.user_blocks;
create policy "user_blocks_select_own" on public.user_blocks
  for select to authenticated using (blocker_id = auth.uid());
drop policy if exists "user_blocks_insert_own" on public.user_blocks;
create policy "user_blocks_insert_own" on public.user_blocks
  for insert to authenticated with check (blocker_id = auth.uid());
drop policy if exists "user_blocks_delete_own" on public.user_blocks;
create policy "user_blocks_delete_own" on public.user_blocks
  for delete to authenticated using (blocker_id = auth.uid());

revoke all on public.user_blocks from anon, authenticated;
grant select, insert, delete on public.user_blocks to authenticated;

create or replace function public.is_blocked_by_me(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.user_blocks where blocker_id = auth.uid() and blocked_id = uid);
$$;

revoke execute on function public.is_blocked_by_me(uuid) from public, anon;
grant execute on function public.is_blocked_by_me(uuid) to authenticated;

-- Meldinger fra blokkerte brukere skjules (gjelder også sanntid, som følger RLS)
drop policy if exists "messages_select" on public.messages;
create policy "messages_select" on public.messages
  for select to authenticated
  using (public.is_group_member(group_id) and not public.is_blocked_by_me(author_id));

-- Varsler: ingen varsler om det en blokkert bruker gjør (som push_notification i migrasjon 5,
-- med én ekstra betingelse)
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
    and not exists (
      select 1 from public.user_blocks b where b.blocker_id = m.user_id and b.blocked_id = actor
    )
  on conflict (user_id, collapse_key) where read_at is null and collapse_key is not null
  do update set
    count = n.count + 1,
    actor_id = excluded.actor_id,
    data = excluded.data,
    updated_at = now();
end;
$$;

revoke execute on function public.push_notification(uuid[], uuid, uuid, public.notification_kind, uuid, jsonb, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Rapportering
-- ---------------------------------------------------------------------------
create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid default auth.uid() references public.profiles (id) on delete set null,
  kind text not null check (kind in ('message', 'user')),
  message_id uuid references public.messages (id) on delete set null,
  reported_user_id uuid references public.profiles (id) on delete set null,
  group_id uuid references public.groups (id) on delete set null,
  -- Kopi av meldingen og navnet da rapporten ble sendt
  snapshot text,
  reported_name text,
  reason text not null check (reason in ('spam', 'harassment', 'inappropriate', 'other')),
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists content_reports_open_idx on public.content_reports (created_at) where status = 'open';

alter table public.content_reports enable row level security;

-- Den som rapporterer kan se sine egne rapporter; resten håndteres i SQL Editor
drop policy if exists "content_reports_select_own" on public.content_reports;
create policy "content_reports_select_own" on public.content_reports
  for select to authenticated using (reporter_id = auth.uid());
revoke all on public.content_reports from anon, authenticated;
grant select on public.content_reports to authenticated;

-- Rapporter en melding (target = meldingens id) eller en bruker (target = brukerens id,
-- i en flokk dere begge er med i).
create or replace function public.report_content(
  report_kind text,
  target uuid,
  gid uuid,
  report_reason text,
  report_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  msg public.messages;
  rid uuid;
  ruser uuid;
begin
  if auth.uid() is null then
    raise exception 'Du må være innlogget';
  end if;
  if not public.is_group_member(gid) then
    raise exception 'Du er ikke med i denne flokken';
  end if;

  if report_kind = 'message' then
    select * into msg from public.messages where id = target and group_id = gid;
    if not found then
      raise exception 'Meldingen finnes ikke';
    end if;
    ruser := msg.author_id;
  elsif report_kind = 'user' then
    if not exists (select 1 from public.group_members where group_id = gid and user_id = target) then
      raise exception 'Brukeren er ikke med i flokken';
    end if;
    ruser := target;
  else
    raise exception 'Ukjent type rapport';
  end if;

  if ruser = auth.uid() then
    raise exception 'Du kan ikke rapportere deg selv';
  end if;

  insert into public.content_reports
    (reporter_id, kind, message_id, reported_user_id, group_id, snapshot, reported_name, reason, details)
  values (
    auth.uid(), report_kind, msg.id, ruser, gid, msg.body,
    (select display_name from public.profiles where id = ruser),
    report_reason, nullif(left(trim(coalesce(report_details, '')), 1000), '')
  )
  returning id into rid;
  return rid;
end;
$$;

revoke execute on function public.report_content(text, uuid, uuid, text, text) from public, anon;
grant execute on function public.report_content(text, uuid, uuid, text, text) to authenticated;
