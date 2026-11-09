-- Flokk: grunnskjema
-- Grupper, medlemskap, invitasjoner, arrangementer med tidsavstemning,
-- oppgaver og meldinger (gruppechat og arrangementschat).
-- All tilgang styres med Row Level Security (RLS).

-- ---------------------------------------------------------------------------
-- Typer
-- ---------------------------------------------------------------------------
create type public.group_visibility as enum ('open', 'invite_only');
create type public.member_role as enum ('owner', 'admin', 'member');
create type public.event_status as enum ('planning', 'scheduled', 'cancelled');
create type public.vote_answer as enum ('yes', 'maybe', 'no');
create type public.task_status as enum ('todo', 'done');

-- ---------------------------------------------------------------------------
-- Profiler (én per auth-bruker)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Grupper
-- ---------------------------------------------------------------------------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$')
    check (slug not in (
      'api', 'auth', 'login', 'logout', 'grupper', 'ny', 'profil', 'innstillinger',
      'invitasjon', 'om', 'hjelp', 'admin', 'flokk', 'app', 'static', 'public'
    )),
  name text not null check (char_length(name) between 2 and 80),
  description text not null default '',
  visibility public.group_visibility not null default 'invite_only',
  tint text not null default 'mint'
    check (tint in ('lime', 'mint', 'sky', 'lilac', 'mauve', 'peach')),
  emoji text,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);

-- Den som oppretter gruppen blir eier automatisk
create or replace function public.handle_new_group()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger on_group_created
  after insert on public.groups
  for each row execute function public.handle_new_group();

-- Hjelpefunksjoner for RLS (security definer for å unngå rekursive policyer)
create or replace function public.is_group_member(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

create or replace function public.is_group_admin(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid() and role in ('owner', 'admin')
  );
$$;

-- ---------------------------------------------------------------------------
-- Invitasjoner (delbar lenke med token, valgfritt låst til e-post)
-- ---------------------------------------------------------------------------
create table public.group_invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  email text,
  invited_by uuid not null default auth.uid() references public.profiles (id),
  max_uses integer check (max_uses is null or max_uses > 0),
  use_count integer not null default 0,
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now()
);
create index group_invitations_group_idx on public.group_invitations (group_id);

-- Les en invitasjon uten å være medlem (viser gruppenavn på invitasjonssiden)
create or replace function public.get_invitation(invite_token text)
returns table (group_id uuid, group_slug text, group_name text, group_description text, valid boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.slug, g.name, g.description,
         (i.expires_at > now() and (i.max_uses is null or i.use_count < i.max_uses)) as valid
  from public.group_invitations i
  join public.groups g on g.id = i.group_id
  where i.token = invite_token;
$$;

-- Godta invitasjon: legger innlogget bruker til som medlem
create or replace function public.accept_invitation(invite_token text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.group_invitations;
  user_email text;
  gslug text;
begin
  if auth.uid() is null then
    raise exception 'Du må være innlogget';
  end if;

  select * into inv from public.group_invitations where token = invite_token for update;
  if not found then
    raise exception 'Invitasjonen finnes ikke';
  end if;
  if inv.expires_at <= now() or (inv.max_uses is not null and inv.use_count >= inv.max_uses) then
    raise exception 'Invitasjonen er utløpt';
  end if;

  if inv.email is not null then
    select email into user_email from auth.users where id = auth.uid();
    if lower(user_email) <> lower(inv.email) then
      raise exception 'Invitasjonen gjelder en annen e-postadresse';
    end if;
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (inv.group_id, auth.uid(), 'member')
  on conflict do nothing;

  if found then
    update public.group_invitations set use_count = use_count + 1 where id = inv.id;
  end if;

  select slug into gslug from public.groups where id = inv.group_id;
  return gslug;
end;
$$;

-- ---------------------------------------------------------------------------
-- Arrangementer og tidsavstemning
-- ---------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  description text not null default '',
  location text,
  status public.event_status not null default 'planning',
  chosen_option_id uuid,
  vote_deadline timestamptz,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (id, group_id)
);
create index events_group_idx on public.events (group_id);

create table public.event_time_options (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index event_time_options_event_idx on public.event_time_options (event_id);

alter table public.events
  add constraint events_chosen_option_fk
  foreign key (chosen_option_id) references public.event_time_options (id) on delete set null;

create table public.event_votes (
  option_id uuid not null references public.event_time_options (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  answer public.vote_answer not null,
  updated_at timestamptz not null default now(),
  primary key (option_id, user_id)
);

create or replace function public.event_group_id(eid uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select group_id from public.events where id = eid;
$$;

create or replace function public.option_group_id(oid uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.group_id
  from public.event_time_options o
  join public.events e on e.id = o.event_id
  where o.id = oid;
$$;

create or replace function public.can_manage_event(eid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.events e
    where e.id = eid
      and (e.created_by = auth.uid() or public.is_group_admin(e.group_id))
  );
$$;

-- ---------------------------------------------------------------------------
-- Oppgaver knyttet til et arrangement
-- ---------------------------------------------------------------------------
create table public.event_tasks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  assignee_id uuid references public.profiles (id) on delete set null,
  status public.task_status not null default 'todo',
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);
create index event_tasks_event_idx on public.event_tasks (event_id);

-- ---------------------------------------------------------------------------
-- Meldinger: event_id null = gruppechat, ellers arrangementschat
-- ---------------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  event_id uuid,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  foreign key (event_id, group_id) references public.events (id, group_id) on delete cascade
);
create index messages_group_idx on public.messages (group_id, created_at);
create index messages_event_idx on public.messages (event_id, created_at);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invitations enable row level security;
alter table public.events enable row level security;
alter table public.event_time_options enable row level security;
alter table public.event_votes enable row level security;
alter table public.event_tasks enable row level security;
alter table public.messages enable row level security;

-- Profiler: innloggede kan se profiler (navn/avatar), kun egen kan endres
create policy "profiles_select" on public.profiles
  for select to authenticated using (true);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Grupper: åpne grupper er synlige for alle (også utloggede, for delbar URL),
-- lukkede kun for medlemmer
create policy "groups_select" on public.groups
  for select to anon, authenticated
  using (visibility = 'open' or created_by = auth.uid() or public.is_group_member(id));
create policy "groups_insert" on public.groups
  for insert to authenticated with check (created_by = auth.uid());
create policy "groups_update_admin" on public.groups
  for update to authenticated using (public.is_group_admin(id)) with check (public.is_group_admin(id));
create policy "groups_delete_owner" on public.groups
  for delete to authenticated using (created_by = auth.uid());

-- Medlemskap
create policy "members_select" on public.group_members
  for select to authenticated using (public.is_group_member(group_id));
create policy "members_join_open" on public.group_members
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and role = 'member'
    and exists (select 1 from public.groups g where g.id = group_id and g.visibility = 'open')
  );
create policy "members_update_admin" on public.group_members
  for update to authenticated using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));
create policy "members_delete_self_or_admin" on public.group_members
  for delete to authenticated
  using (user_id = auth.uid() or public.is_group_admin(group_id));

-- Invitasjoner: kun administratorer
create policy "invitations_admin_all" on public.group_invitations
  for all to authenticated
  using (public.is_group_admin(group_id))
  with check (public.is_group_admin(group_id) and invited_by = auth.uid());

-- Arrangementer
create policy "events_select" on public.events
  for select to authenticated using (public.is_group_member(group_id));
create policy "events_insert" on public.events
  for insert to authenticated
  with check (public.is_group_member(group_id) and created_by = auth.uid());
create policy "events_update" on public.events
  for update to authenticated
  using (created_by = auth.uid() or public.is_group_admin(group_id))
  with check (created_by = auth.uid() or public.is_group_admin(group_id));
create policy "events_delete" on public.events
  for delete to authenticated
  using (created_by = auth.uid() or public.is_group_admin(group_id));

-- Tidsforslag
create policy "time_options_select" on public.event_time_options
  for select to authenticated using (public.is_group_member(public.event_group_id(event_id)));
create policy "time_options_write" on public.event_time_options
  for all to authenticated
  using (public.can_manage_event(event_id))
  with check (public.can_manage_event(event_id));

-- Stemmer: alle medlemmer ser stemmene, hver bruker styrer sine egne
create policy "votes_select" on public.event_votes
  for select to authenticated using (public.is_group_member(public.option_group_id(option_id)));
create policy "votes_insert_own" on public.event_votes
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_group_member(public.option_group_id(option_id)));
create policy "votes_update_own" on public.event_votes
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "votes_delete_own" on public.event_votes
  for delete to authenticated using (user_id = auth.uid());

-- Oppgaver: medlemmer kan opprette, ta og fullføre oppgaver
create policy "tasks_select" on public.event_tasks
  for select to authenticated using (public.is_group_member(public.event_group_id(event_id)));
create policy "tasks_insert" on public.event_tasks
  for insert to authenticated
  with check (created_by = auth.uid() and public.is_group_member(public.event_group_id(event_id)));
create policy "tasks_update" on public.event_tasks
  for update to authenticated
  using (public.is_group_member(public.event_group_id(event_id)))
  with check (public.is_group_member(public.event_group_id(event_id)));
create policy "tasks_delete" on public.event_tasks
  for delete to authenticated
  using (created_by = auth.uid() or public.can_manage_event(event_id));

-- Meldinger
create policy "messages_select" on public.messages
  for select to authenticated using (public.is_group_member(group_id));
create policy "messages_insert" on public.messages
  for insert to authenticated
  with check (author_id = auth.uid() and public.is_group_member(group_id));
create policy "messages_delete_own" on public.messages
  for delete to authenticated
  using (author_id = auth.uid() or public.is_group_admin(group_id));

-- ---------------------------------------------------------------------------
-- Sanntid for chat, stemmer og oppgaver
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.event_votes;
alter publication supabase_realtime add table public.event_tasks;
