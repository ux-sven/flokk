-- Push til native apper (iOS via APNs, senere Android via FCM).
-- Hver installasjon av appen som slår på varsler får én rad. Edge Function
-- «send-push» leser radene (med service role) sammen med Web Push-abonnementene
-- og sletter tokens Apple/Google sier ikke lenger virker.
-- Skrevet slik at den kan kjøres på nytt.

create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  -- APNs har eget sandkassemiljø for utviklingsbygg
  environment text not null default 'production' check (environment in ('sandbox', 'production')),
  app_version text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists device_tokens_user_idx on public.device_tokens (user_id);

alter table public.device_tokens enable row level security;

drop policy if exists "device_tokens_select_own" on public.device_tokens;
create policy "device_tokens_select_own" on public.device_tokens
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "device_tokens_delete_own" on public.device_tokens;
create policy "device_tokens_delete_own" on public.device_tokens
  for delete to authenticated using (user_id = auth.uid());

-- Innsetting skjer bare via funksjonen under
grant select, delete on public.device_tokens to authenticated;

-- Samme telefon kan ha vært registrert på en annen bruker (ny innlogging).
-- RLS hindrer oss i å se den raden, så overtakelse skjer her.
create or replace function public.register_device_token(
  device_token text,
  device_platform text,
  device_environment text,
  device_app_version text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Du må være innlogget';
  end if;
  if char_length(device_token) not between 16 and 512 then
    raise exception 'Ugyldig token';
  end if;
  insert into public.device_tokens (user_id, token, platform, environment, app_version)
  values (auth.uid(), device_token, device_platform, device_environment, left(device_app_version, 40))
  on conflict (token) do update set
    user_id = auth.uid(),
    platform = excluded.platform,
    environment = excluded.environment,
    app_version = excluded.app_version,
    created_at = now();
end;
$$;

revoke execute on function public.register_device_token(text, text, text, text) from public, anon;
grant execute on function public.register_device_token(text, text, text, text) to authenticated;
