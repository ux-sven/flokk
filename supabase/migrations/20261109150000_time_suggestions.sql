-- Medlemmer kan foreslå tidspunkt på arrangementer.
-- Den som oppretter arrangementet (eller admin) kan slå det av, og
-- forslag stenges når et tidspunkt er valgt.

alter table public.events
  add column allow_time_suggestions boolean not null default true;

alter table public.event_time_options
  add column created_by uuid default auth.uid() references public.profiles (id) on delete set null;

alter table public.event_time_options
  add constraint event_time_options_unique_start unique (event_id, starts_at);

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
      and public.is_group_member(e.group_id)
      and (
        public.can_manage_event(eid)
        or (e.allow_time_suggestions and e.status = 'planning')
      )
  );
$$;

grant execute on function public.can_suggest_time(uuid) to anon, authenticated;

drop policy "time_options_write" on public.event_time_options;

create policy "time_options_insert" on public.event_time_options
  for insert to authenticated
  with check (created_by = auth.uid() and public.can_suggest_time(event_id));

create policy "time_options_update" on public.event_time_options
  for update to authenticated
  using (public.can_manage_event(event_id))
  with check (public.can_manage_event(event_id));

-- Eget forslag kan trekkes så lenge det ikke er valgt; arrangøren kan fjerne alle
create policy "time_options_delete" on public.event_time_options
  for delete to authenticated
  using (
    public.can_manage_event(event_id)
    or (
      created_by = auth.uid()
      and not exists (select 1 from public.events e where e.chosen_option_id = event_time_options.id)
    )
  );

alter publication supabase_realtime add table public.event_time_options;
